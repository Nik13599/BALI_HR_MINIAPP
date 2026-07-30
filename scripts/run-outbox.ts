import { createPool, one, transaction } from "../server/db.js";

const databaseUrl = process.env.DATABASE_URL || "";
const botToken = process.env.TELEGRAM_BOT_TOKEN || "";
if (!databaseUrl) throw new Error("DATABASE_URL is required");
if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN is required");
const db = createPool(databaseUrl);
const once = process.argv.includes("--once");

interface Job {
  id: string;
  aggregate_id: string;
  payload: Record<string, unknown>;
  attempt_count: number;
}

async function claim(): Promise<Job | null> {
  return transaction(db, async client => {
    const job = await one<Job>(
      client,
      `select * from public.outbox_jobs
        where job_type = 'telegram_campaign'
          and status in ('pending','failed')
          and available_at <= now()
        order by created_at
        for update skip locked
        limit 1`
    );
    if (!job) return null;
    await client.query(
      `update public.outbox_jobs
          set status = 'processing', locked_at = now(),
              attempt_count = attempt_count + 1, updated_at = now()
        where id = $1`,
      [job.id]
    );
    return job;
  });
}

async function sendTelegram(telegramUserId: string, text: string): Promise<string> {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: telegramUserId,
      text,
      disable_web_page_preview: true
    }),
    signal: AbortSignal.timeout(15_000)
  });
  const payload = await response.json() as any;
  if (!response.ok || !payload?.ok) {
    throw new Error(String(payload?.description || `Telegram HTTP ${response.status}`).slice(0, 1000));
  }
  return String(payload.result?.message_id || "");
}

async function processCampaign(job: Job): Promise<void> {
  const campaignId = String(job.payload?.campaignId || job.aggregate_id || "");
  const campaign = await one<any>(
    db,
    `select * from public.crm_campaigns where id = $1`,
    [campaignId]
  );
  if (!campaign) throw new Error(`Campaign ${campaignId} was not found`);
  await db.query(
    `update public.crm_campaigns
        set status = 'sending', started_at = coalesce(started_at, now()), updated_at = now()
      where id = $1 and status in ('confirmed','sending','failed')`,
    [campaignId]
  );
  const recipients = (await db.query<any>(
    `select recipient.*, account.telegram_user_id,
            coalesce(preferences.telegram_enabled, true) as telegram_enabled
       from public.crm_campaign_recipients recipient
       join public.telegram_accounts account on account.app_user_key = recipient.user_key
       left join public.notification_preferences preferences on preferences.user_key = recipient.user_key
      where recipient.campaign_id = $1 and recipient.status in ('queued','failed')
      order by recipient.created_at`,
    [campaignId]
  )).rows;
  let failures = 0;
  for (const recipient of recipients) {
    const deduplicationKey = `campaign:${campaignId}:${recipient.user_key}`;
    if (!recipient.telegram_enabled) {
      await db.query(
        `update public.crm_campaign_recipients
            set status = 'skipped', skip_reason = 'telegram_disabled', updated_at = now()
          where id = $1`,
        [recipient.id]
      );
      continue;
    }
    try {
      const providerMessageId = await sendTelegram(
        String(recipient.telegram_user_id),
        String(campaign.message_text)
      );
      await transaction(db, async client => {
        await client.query(
          `insert into public.telegram_delivery_log(
             campaign_recipient_id, telegram_user_id, status,
             provider_message_id, attempt_count, deduplication_key, sent_at
           ) values ($1,$2,'sent',$3,1,$4,now())
           on conflict (deduplication_key) do update
             set status = 'sent', provider_message_id = excluded.provider_message_id,
                 attempt_count = public.telegram_delivery_log.attempt_count + 1,
                 last_error = '', sent_at = now(), updated_at = now()`,
          [recipient.id, recipient.telegram_user_id, providerMessageId, deduplicationKey]
        );
        await client.query(
          `update public.crm_campaign_recipients
              set status = 'sent', sent_at = now(), updated_at = now()
            where id = $1`,
          [recipient.id]
        );
      });
    } catch (error) {
      failures += 1;
      const message = String(error instanceof Error ? error.message : error).slice(0, 1000);
      await transaction(db, async client => {
        await client.query(
          `insert into public.telegram_delivery_log(
             campaign_recipient_id, telegram_user_id, status,
             attempt_count, last_error, deduplication_key, next_attempt_at
           ) values ($1,$2,'failed',1,$3,$4,now() + interval '5 minutes')
           on conflict (deduplication_key) do update
             set status = 'failed',
                 attempt_count = public.telegram_delivery_log.attempt_count + 1,
                 last_error = excluded.last_error,
                 next_attempt_at = excluded.next_attempt_at,
                 updated_at = now()`,
          [recipient.id, recipient.telegram_user_id, message, deduplicationKey]
        );
        await client.query(
          `update public.crm_campaign_recipients
              set status = 'failed', updated_at = now()
            where id = $1`,
          [recipient.id]
        );
      });
    }
  }
  const terminalStatus = failures ? "failed" : "completed";
  await transaction(db, async client => {
    await client.query(
      `update public.crm_campaigns
          set status = $2,
              completed_at = case when $2 = 'completed' then now() else completed_at end,
              updated_at = now()
        where id = $1`,
      [campaignId, terminalStatus]
    );
    await client.query(
      `update public.outbox_jobs
          set status = $2,
              completed_at = case when $2 = 'completed' then now() else null end,
              available_at = case when $2 = 'failed' then now() + interval '5 minutes' else available_at end,
              last_error = case when $2 = 'failed' then $3 else '' end,
              updated_at = now()
        where id = $1`,
      [job.id, terminalStatus, failures ? `${failures} recipient deliveries failed` : ""]
    );
  });
}

async function work(): Promise<void> {
  do {
    const job = await claim();
    if (!job) return;
    try {
      await processCampaign(job);
    } catch (error) {
      await db.query(
        `update public.outbox_jobs
            set status = 'failed', available_at = now() + interval '5 minutes',
                last_error = $2, updated_at = now()
          where id = $1`,
        [job.id, String(error instanceof Error ? error.message : error).slice(0, 2000)]
      );
      if (once) throw error;
    }
  } while (!once);
}

work()
  .finally(() => db.end())
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
