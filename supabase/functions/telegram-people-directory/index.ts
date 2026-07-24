import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json, validateTelegramInitData } from "../_shared/telegram-auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Метод не поддерживается" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!botToken || !supabaseUrl || !serviceRoleKey) throw new Error("Каталог BALI People ещё не настроен");

    const { user } = await validateTelegramInitData(String(body.init_data || ""), botToken, 86400);
    const db = createClient(supabaseUrl, serviceRoleKey);

    const [appUsersResult, customersResult, checkinsResult] = await Promise.all([
      db.from("app_users").select("*").eq("active", true).order("last_seen_at", { ascending:false }),
      db.from("customers").select("*"),
      db.from("event_checkins").select("*").eq("presence_status", "inside").is("left_at", null).order("checked_in_at", { ascending:false })
    ]);

    const appUsers = appUsersResult.error ? [] : (appUsersResult.data || []);
    const customers = customersResult.error ? [] : (customersResult.data || []);
    const checkins = checkinsResult.error ? [] : (checkinsResult.data || []);

    const profiles = new Map<string, Record<string, unknown>>();
    for (const row of appUsers) {
      const key = String(row.user_key || (row.telegram_id ? `tg:${row.telegram_id}` : row.id ? `app:${row.id}` : ""));
      if (!key) continue;
      profiles.set(key, {
        user_key:key,
        telegram_id:row.telegram_id || null,
        name:row.name || "Гость BALI",
        username:row.username || "",
        avatar:row.avatar || "",
        last_seen_at:row.last_seen_at || row.updated_at || null
      });
    }

    for (const row of customers) {
      const telegramId = row.telegram_id || null;
      const key = String(telegramId ? `tg:${telegramId}` : row.id ? `customer:${row.id}` : "");
      if (!key || profiles.has(key)) continue;
      profiles.set(key, {
        user_key:key,
        telegram_id:telegramId,
        name:row.name || row.customer_name || "Гость BALI",
        username:row.telegram || row.username || "",
        avatar:row.avatar || "",
        last_seen_at:row.updated_at || row.created_at || null
      });
    }

    const ownKey = `tg:${user.id}`;
    if (!profiles.has(ownKey)) {
      profiles.set(ownKey, {
        user_key:ownKey,
        telegram_id:user.id,
        name:[user.first_name, user.last_name].filter(Boolean).join(" ") || "Гость BALI",
        username:user.username ? `@${user.username}` : "",
        avatar:user.photo_url || "",
        last_seen_at:new Date().toISOString()
      });
    }

    return json({
      ok:true,
      user_key:ownKey,
      people:[...profiles.values()],
      checkins:checkins.map((row) => ({
        event_id:row.event_id,
        event_title:row.event_title || "",
        user_key:row.user_key || (row.telegram_id ? `tg:${row.telegram_id}` : ""),
        telegram_id:row.telegram_id || null,
        name:row.name || "Гость BALI",
        presence_status:row.presence_status || "inside",
        checked_in_at:row.checked_in_at || null,
        left_at:row.left_at || null
      }))
    });
  } catch (error) {
    console.error(error);
    return json({ error:error instanceof Error ? error.message : "Не удалось загрузить BALI People" }, 401);
  }
});
