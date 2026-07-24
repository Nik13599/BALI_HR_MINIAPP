import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json, validateTelegramInitData } from "../_shared/telegram-auth.ts";

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Метод не поддерживается" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!botToken || !supabaseUrl || !serviceKey) throw new Error("Сервер отзывов не настроен");

    const { user } = await validateTelegramInitData(String(body.init_data || ""), botToken);
    const db = createClient(supabaseUrl, serviceKey);
    const userKey = `tg:${user.id}`;
    const message = String(body.message || "").trim();
    const eventId = String(body.event_id || "").trim();
    const type = String(body.type || "other").slice(0, 40);
    const ratingRaw = Number(body.rating || 0);
    const rating = ratingRaw >= 1 && ratingRaw <= 5 ? ratingRaw : null;
    if (!message) return json({ error: "Введите текст отзыва" }, 400);
    if (message.length > 2000) return json({ error: "Отзыв слишком длинный" }, 400);

    const now = new Date().toISOString();
    const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || "Гость BALI";
    await db.from("app_users").upsert({
      user_key:userKey,
      telegram_id:user.id,
      name,
      username:user.username ? `@${user.username}` : "",
      avatar:user.photo_url || "",
      last_seen_at:now,
      updated_at:now
    }, { onConflict:"user_key" });
    await db.from("points_accounts").upsert({
      user_key:userKey,
      telegram_id:user.id,
      name,
      telegram:user.username ? `@${user.username}` : "",
      updated_at:now
    }, { onConflict:"user_key" });

    let eventTitle = "";
    let eligible = false;
    if (eventId) {
      const [{ data:event }, { data:checkin }] = await Promise.all([
        db.from("events").select("id,title").eq("id", eventId).maybeSingle(),
        db.from("event_checkins").select("id").eq("event_id", eventId).eq("user_key", userKey).limit(1).maybeSingle()
      ]);
      eventTitle = String(event?.title || "");
      eligible = Boolean(checkin);
    }

    const actionKey = eventId ? `review:${eventId}:${userKey}` : "";
    let rewardAmount = 0;
    let rewardStatus = "not_eligible";
    if (eligible && actionKey) {
      const { data:used } = await db.from("points_ledger").select("id").eq("user_key", userKey).eq("action_key", actionKey).maybeSingle();
      if (used) {
        rewardStatus = "already_received";
      } else {
        rewardAmount = await rulePoints(db, "review", 100);
        if (rewardAmount > 0) {
          await creditOnce(db, userKey, rewardAmount, `Отзыв о «${eventTitle || "мероприятии BALI"}»`, actionKey);
          rewardStatus = "granted";
        }
      }
    }

    const review = {
      id:`review-${crypto.randomUUID()}`,
      user_key:userKey,
      telegram_id:user.id,
      telegram:user.username ? `@${user.username}` : "",
      user_name:name,
      type,
      event_id:eventId || null,
      event_title:eventTitle,
      message,
      rating,
      status:"new",
      admin_reply:"",
      reward_amount:rewardAmount,
      reward_status:rewardStatus,
      reward_action_key:actionKey || null,
      rewarded_at:rewardStatus === "granted" ? now : null,
      created_at:now,
      updated_at:now
    };

    const { data:created, error } = await db.from("reviews").insert(review).select("*").single();
    if (error) throw error;
    return json({ ok:true, review:created, reward_amount:rewardAmount, reward_status:rewardStatus, balance:await getBalance(db,userKey) });
  } catch (error) {
    console.error(error);
    return json({ error:error instanceof Error ? error.message : "Не удалось отправить отзыв" }, 500);
  }
});

async function rulePoints(db:any, action:string, fallback:number) {
  const { data } = await db.from("loyalty_rules").select("points").eq("action", action).eq("active", true).order("updated_at", { ascending:false }).limit(1);
  return Math.max(0, Number(data?.[0]?.points ?? fallback));
}

async function creditOnce(db:any, userKey:string, amount:number, title:string, actionKey:string) {
  const { data:used } = await db.from("points_ledger").select("id").eq("user_key", userKey).eq("action_key", actionKey).maybeSingle();
  if (used) return;
  const { data:account } = await db.from("points_accounts").select("balance").eq("user_key", userKey).single();
  await db.from("points_accounts").update({ balance:Number(account?.balance || 0) + amount, updated_at:new Date().toISOString() }).eq("user_key", userKey);
  await db.from("points_ledger").insert({ user_key:userKey, type:"review", title, amount, action_key:actionKey });
}

async function getBalance(db:any, userKey:string) {
  const { data } = await db.from("points_accounts").select("balance").eq("user_key", userKey).single();
  return Number(data?.balance || 0);
}
