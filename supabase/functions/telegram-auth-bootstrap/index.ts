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
    if (!botToken || !supabaseUrl || !serviceRoleKey) throw new Error("Сервер авторизации ещё не настроен");

    const { user, authDate, startParam } = await validateTelegramInitData(String(body.init_data || ""), botToken, 86400);
    const db = createClient(supabaseUrl, serviceRoleKey);
    const userKey = `tg:${user.id}`;
    const now = new Date().toISOString();
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ") || "Гость BALI";
    const username = user.username ? `@${user.username}` : "";

    const { data: existing, error: existingError } = await db
      .from("app_users")
      .select("*")
      .eq("user_key", userKey)
      .maybeSingle();
    if (existingError) throw existingError;

    const action = String(body.action || "bootstrap");
    const profile = body.profile && typeof body.profile === "object" ? body.profile : {};
    const allowedGender = ["male", "female", "unspecified"].includes(String(profile.gender))
      ? String(profile.gender)
      : (existing?.gender || "unspecified");

    const payload = {
      user_key: userKey,
      telegram_id: user.id,
      name: action === "update_profile" && String(profile.name || "").trim()
        ? String(profile.name).trim().slice(0, 100)
        : fullName,
      username,
      phone: action === "update_profile" ? String(profile.phone || existing?.phone || "").replace(/\s+/g, "").slice(0, 40) : (existing?.phone || ""),
      avatar: user.photo_url || existing?.avatar || "",
      birth_date: action === "update_profile" && profile.birth_date ? String(profile.birth_date).slice(0, 10) : (existing?.birth_date || null),
      gender: allowedGender,
      first_seen_at: existing?.first_seen_at || now,
      last_seen_at: now,
      opens: Number(existing?.opens || 0) + (action === "bootstrap" ? 1 : 0)
    };

    const { data: saved, error: saveError } = await db
      .from("app_users")
      .upsert(payload, { onConflict: "user_key" })
      .select("*")
      .single();
    if (saveError) throw saveError;

    const { error: accountError } = await db.from("points_accounts").upsert({
      user_key: userKey,
      telegram_id: user.id,
      name: saved.name,
      phone: saved.phone || "",
      telegram: username,
      updated_at: now
    }, { onConflict: "user_key" });
    if (accountError) throw accountError;

    const [{ data: account }, { data: vip }] = await Promise.all([
      db.from("points_accounts").select("balance").eq("user_key", userKey).maybeSingle(),
      db.from("vip_memberships").select("*").eq("user_key", userKey).gt("expires_at", now).order("expires_at", { ascending:false }).limit(1).maybeSingle()
    ]);

    return json({
      ok: true,
      authenticated: true,
      auth_date: authDate,
      start_param: startParam,
      user: saved,
      balance: Number(account?.balance || 0),
      vip: vip || null
    });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Ошибка входа через Telegram" }, 401);
  }
});