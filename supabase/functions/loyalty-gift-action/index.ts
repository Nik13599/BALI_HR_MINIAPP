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
    if (!botToken || !supabaseUrl || !serviceRoleKey) throw new Error("Сервер подарков ещё не настроен");

    const { user } = await validateTelegramInitData(String(body.init_data || ""), botToken, 86400);
    const db = createClient(supabaseUrl, serviceRoleKey);
    const userKey = `tg:${user.id}`;
    const action = String(body.action || "catalog");

    if (action === "catalog") {
      const { data, error } = await db.from("loyalty_gifts").select("*").eq("active", true).order("sort_order");
      if (error) throw error;
      return json({ ok: true, gifts: data || [] });
    }

    if (action === "inbox") {
      const { data, error } = await db.from("loyalty_gift_grants").select("*").eq("user_key", userKey).neq("status", "revoked").order("granted_at", { ascending:false });
      if (error) throw error;
      return json({ ok: true, gifts: data || [] });
    }

    if (action !== "send") return json({ error: "Неизвестное действие" }, 400);

    const giftId = String(body.gift_id || "");
    const targetUserKey = String(body.target_user_key || "");
    const note = String(body.note || "").trim().slice(0, 250);
    if (!giftId || !targetUserKey) return json({ error: "Не выбран подарок или получатель" }, 400);
    if (targetUserKey === userKey) return json({ error: "Нельзя отправить подарок самому себе" }, 400);

    const [{ data:gift, error:giftError }, { data:sender, error:senderError }, { data:recipient, error:recipientError }] = await Promise.all([
      db.from("loyalty_gifts").select("*").eq("id", giftId).eq("active", true).single(),
      db.from("app_users").select("user_key,name").eq("user_key", userKey).single(),
      db.from("app_users").select("user_key,name").eq("user_key", targetUserKey).single(),
    ]);
    if (giftError || !gift) return json({ error: "Подарок недоступен" }, 404);
    if (senderError || !sender) return json({ error: "Профиль отправителя не найден" }, 404);
    if (recipientError || !recipient) return json({ error: "Профиль получателя не найден" }, 404);

    const price = Math.max(0, Number(gift.points_price || 0));
    const { data:account, error:accountError } = await db.from("points_accounts").select("balance").eq("user_key", userKey).single();
    if (accountError || !account) return json({ error: "Баланс пользователя не найден" }, 404);
    const oldBalance = Number(account.balance || 0);
    if (oldBalance < price) return json({ error: "Недостаточно BALI-Баллов" }, 409);

    const newBalance = oldBalance - price;
    const { data:updated, error:updateError } = await db.from("points_accounts")
      .update({ balance:newBalance, updated_at:new Date().toISOString() })
      .eq("user_key", userKey).eq("balance", oldBalance).select("balance").maybeSingle();
    if (updateError) throw updateError;
    if (!updated) return json({ error: "Баланс изменился. Повторите отправку" }, 409);

    const grantId = crypto.randomUUID();
    const now = new Date().toISOString();
    try {
      const { error:grantError } = await db.from("loyalty_gift_grants").insert({
        id:grantId,
        gift_id:gift.id,
        gift_title:gift.title,
        gift_icon:gift.icon || "🎁",
        from_user_key:userKey,
        from_name:sender.name || user.first_name || "Пользователь BALI",
        user_key:targetUserKey,
        user_name:recipient.name || "Гость BALI",
        points_price:price,
        note,
        status:"active",
        granted_at:now,
      });
      if (grantError) throw grantError;

      const { error:ledgerError } = await db.from("points_ledger").insert({
        user_key:userKey,
        type:"gift_sent",
        title:`Подарок «${gift.title}» для ${recipient.name || "пользователя BALI"}`,
        amount:-price,
        action_key:`gift:${grantId}`,
        metadata:{ gift_id:gift.id, recipient_user_key:targetUserKey },
        created_at:now,
      });
      if (ledgerError) throw ledgerError;
    } catch (error) {
      await db.from("points_accounts").update({ balance:oldBalance, updated_at:new Date().toISOString() }).eq("user_key", userKey).eq("balance", newBalance);
      await db.from("loyalty_gift_grants").delete().eq("id", grantId);
      throw error;
    }

    return json({ ok:true, balance:newBalance, gift:{ id:grantId, title:gift.title, icon:gift.icon || "🎁", recipient:recipient.name } });
  } catch (error) {
    console.error(error);
    return json({ error:error instanceof Error ? error.message : "Ошибка подарка" }, 400);
  }
});