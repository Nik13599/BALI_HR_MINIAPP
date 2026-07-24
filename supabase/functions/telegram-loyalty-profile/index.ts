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
    if (!botToken || !supabaseUrl || !serviceRoleKey) throw new Error("Сервис наград ещё не настроен");

    const { user } = await validateTelegramInitData(String(body.init_data || ""), botToken, 86400);
    const db = createClient(supabaseUrl, serviceRoleKey);
    const userKey = `tg:${user.id}`;

    const [rewardsResult, giftsResult, rewardGrantsResult, giftGrantsResult] = await Promise.all([
      db.from("loyalty_rewards").select("*").eq("active", true).order("created_at", { ascending: true }),
      db.from("loyalty_gifts").select("*").eq("active", true).order("created_at", { ascending: true }),
      db.from("reward_grants").select("*").eq("user_key", userKey).order("created_at", { ascending: false }),
      db.from("gift_grants").select("*").eq("to_user_key", userKey).order("created_at", { ascending: false })
    ]);

    for (const result of [rewardsResult, giftsResult, rewardGrantsResult, giftGrantsResult]) {
      if (result.error) throw result.error;
    }

    return json({
      ok: true,
      user_key: userKey,
      rewards: rewardsResult.data || [],
      gifts: giftsResult.data || [],
      reward_grants: rewardGrantsResult.data || [],
      gift_grants: giftGrantsResult.data || []
    });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Не удалось загрузить награды и подарки" }, 401);
  }
});
