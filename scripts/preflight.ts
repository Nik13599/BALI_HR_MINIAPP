import { createHash } from "node:crypto";
import { createPool } from "../server/db.js";

const databaseUrl = process.env.DATABASE_URL || "";
if (!databaseUrl) throw new Error("DATABASE_URL is required for the production preflight");
const db = createPool(databaseUrl);

const checks = [
  {
    key: "duplicate_telegram_ids",
    severity: "blocking",
    sql: `select telegram_id as identity, count(*)::integer as count
            from public.app_users
           where telegram_id is not null and telegram_id <> ''
           group by telegram_id having count(*) > 1`
  },
  {
    key: "duplicate_telegram_accounts",
    severity: "blocking",
    sql: `select telegram_user_id::text as identity, count(*)::integer as count
            from public.telegram_accounts
           group by telegram_user_id having count(*) > 1`
  },
  {
    key: "legacy_telegram_ids_without_binding",
    severity: "blocking",
    sql: `select user_row.user_key as identity, user_row.telegram_id
            from public.app_users user_row
            left join public.telegram_accounts account
              on account.telegram_user_id::text = user_row.telegram_id
           where user_row.telegram_id is not null
             and user_row.telegram_id <> ''
             and account.id is null`
  },
  {
    key: "telegram_binding_mismatch",
    severity: "blocking",
    sql: `select account.telegram_user_id::text as identity,
                  account.app_user_key, user_row.user_key as legacy_user_key
            from public.telegram_accounts account
            join public.app_users user_row
              on user_row.telegram_id = account.telegram_user_id::text
           where user_row.user_key <> account.app_user_key`
  },
  {
    key: "missing_crm_customers",
    severity: "blocking",
    sql: `select user_row.user_key as identity
            from public.app_users user_row
            left join public.crm_customers customer on customer.user_key = user_row.user_key
           where customer.id is null`
  },
  {
    key: "duplicate_crm_phones",
    severity: "warning",
    sql: `select regexp_replace(phone, '[^0-9]+', '', 'g') as identity,
                  count(*)::integer as count
            from public.crm_customers
           where regexp_replace(phone, '[^0-9]+', '', 'g') <> ''
           group by regexp_replace(phone, '[^0-9]+', '', 'g')
          having count(*) > 1`
  },
  {
    key: "pending_manual_merge_reviews",
    severity: "blocking",
    sql: `select id::text as identity, entity_type, legacy_id, candidate_user_key
            from public.data_merge_review
           where status = 'pending'`
  },
  {
    key: "negative_point_balances",
    severity: "blocking",
    sql: `select user_key as identity, balance from public.point_accounts where balance < 0`
  },
  {
    key: "point_ledger_balance_mismatch",
    severity: "blocking",
    sql: `select id::text as identity, balance_before, amount, balance_after
            from public.point_ledger
           where balance_after <> balance_before + amount`
  },
  {
    key: "duplicate_active_table_bookings",
    severity: "blocking",
    sql: `select event_id || ':' || table_id as identity, count(*)::integer as count
            from public.booking_records
           where status in ('held','new','pending','confirmed','checked_in')
           group by event_id, table_id having count(*) > 1`
  },
  {
    key: "booking_layout_mismatch",
    severity: "blocking",
    sql: `select booking.id as identity, booking.event_id, booking.layout_id, booking.table_id
            from public.booking_records booking
            left join public.layout_tables layout_table on layout_table.id = booking.table_id
           where layout_table.id is null
              or layout_table.layout_id <> booking.layout_id`
  },
  {
    key: "duplicate_active_clan_categories",
    severity: "blocking",
    sql: `select membership.user_key || ':' || clan.clan_type as identity,
                  count(*)::integer as count
            from public.clan_memberships membership
            join public.clans clan on clan.id = membership.clan_id
           where membership.status = 'active'
           group by membership.user_key, clan.clan_type having count(*) > 1`
  },
  {
    key: "duplicate_active_game_sessions",
    severity: "blocking",
    sql: `select user_key as identity, count(*)::integer as count
            from public.game_sessions where status = 'active'
           group by user_key having count(*) > 1`
  },
  {
    key: "overlapping_open_game_seasons",
    severity: "blocking",
    sql: `select left_season.id::text as identity, right_season.id::text as conflicting_id
            from public.game_seasons left_season
            join public.game_seasons right_season
              on left_season.id < right_season.id
             and left_season.starts_at < right_season.ends_at
             and right_season.starts_at < left_season.ends_at
           where left_season.status in ('scheduled','active')
             and right_season.status in ('scheduled','active')`
  },
  {
    key: "unissued_game_prizes",
    severity: "blocking",
    sql: `select id::text as identity, season_id, user_key, position
            from public.game_prizes where status = 'pending'`
  },
  {
    key: "suspicious_unreviewed_game_results",
    severity: "warning",
    sql: `select id::text as identity, user_key, final_score, suspicious_reasons
            from public.game_sessions
           where suspicious = true and status <> 'excluded'`
  },
  {
    key: "expired_active_vip",
    severity: "warning",
    sql: `select id::text as identity, user_key, ends_at
            from public.user_vip_subscriptions
           where status = 'active' and ends_at <= now()`
  },
  {
    key: "expired_delivered_gifts",
    severity: "warning",
    sql: `select id::text as identity, recipient_user_key, expires_at
            from public.gifts
           where status in ('pending','delivered') and expires_at <= now()`
  }
] as const;

async function run(): Promise<void> {
  const database = await db.query<{ database: string; schema: string }>(
    `select current_database() as database, current_schema() as schema`
  );
  const results = [];
  for (const check of checks) {
    const rows = (await db.query(check.sql)).rows;
    results.push({
      key: check.key,
      severity: check.severity,
      count: rows.length,
      examples: rows.slice(0, 20)
    });
  }
  const blockingIssueCount = results
    .filter(item => item.severity === "blocking")
    .reduce((sum, item) => sum + item.count, 0);
  const warningCount = results
    .filter(item => item.severity === "warning")
    .reduce((sum, item) => sum + item.count, 0);
  const target = process.env.MIGRATION_TARGET || "latest";
  const fingerprint = createHash("sha256")
    .update(`${database.rows[0]?.database || ""}:${database.rows[0]?.schema || ""}`)
    .digest("hex");
  console.log(JSON.stringify({
    ok: blockingIssueCount === 0,
    migrationTarget: target,
    databaseFingerprint: fingerprint,
    blockingIssueCount,
    warningCount,
    results
  }, null, 2));
  if (blockingIssueCount) process.exitCode = 2;
}

run()
  .finally(() => db.end())
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
