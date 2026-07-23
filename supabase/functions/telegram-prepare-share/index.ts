import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json, validateTelegramInitData } from "../_shared/telegram-auth.ts";

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Метод не поддерживается" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const kind = body.kind === "event" ? "event" : "referral";
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const botUsername = Deno.env.get("TELEGRAM_BOT_USERNAME") || "BaliMinskAppBot";
    if (!botToken || !supabaseUrl || !serviceKey) throw new Error("Серверные секреты не настроены");
    const { user } = await validateTelegramInitData(String(body.init_data || ""), botToken);
    const db = createClient(supabaseUrl, serviceKey);
    const userKey = `tg:${user.id}`;

    let event: any = null;
    if (kind === "event") {
      const eventId = String(body.event_id || "");
      if (!eventId) return json({ error: "Событие не выбрано" }, 400);
      const { data, error } = await db.from("events").select("id,title,event_date,event_time,description,image_url,active").eq("id", eventId).single();
      if (error || !data || data.active === false) return json({ error: "Событие не найдено" }, 404);
      event = data;
    }

    const { data: tokenRow, error: tokenError } = await db.from("loyalty_share_tokens").insert({
      kind,
      inviter_user_key: userKey,
      inviter_telegram_id: user.id,
      event_id: event?.id || null
    }).select("*").single();
    if (tokenError) throw tokenError;

    const trackedUrl = `https://t.me/${botUsername}?startapp=share_${tokenRow.token}`;
    const when = event ? `${new Date(`${event.event_date}T12:00:00`).toLocaleDateString("ru-RU", { day:"2-digit", month:"long" })} · ${String(event.event_time || "23:00").slice(0,5)}` : "";
    const caption = event
      ? `<b>${escapeHtml(event.title)}</b>\n${escapeHtml(when)}\nBALI Minsk · ул. Кирова, 13\n\n${escapeHtml(event.description || "")}`
      : `<b>BALI Minsk</b>\nАфиши, бонусная система, BALI Shop, подарки и BALI People.`;

    const result = event?.image_url
      ? {
          type: "photo",
          id: tokenRow.token,
          photo_url: event.image_url,
          thumbnail_url: event.image_url,
          caption,
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: [[{ text: "Открыть BALI", url: trackedUrl }]] }
        }
      : {
          type: "article",
          id: tokenRow.token,
          title: event?.title || "BALI Minsk",
          description: event ? `${when} · ул. Кирова, 13` : "Присоединиться к приложению BALI",
          input_message_content: { message_text: `${caption}\n\n${trackedUrl}`, parse_mode: "HTML", link_preview_options: { is_disabled: false } },
          reply_markup: { inline_keyboard: [[{ text: "Открыть BALI", url: trackedUrl }]] }
        };

    const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/savePreparedInlineMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: user.id,
        result,
        allow_user_chats: true,
        allow_bot_chats: false,
        allow_group_chats: true,
        allow_channel_chats: true
      })
    });
    const telegram = await telegramResponse.json();
    if (!telegramResponse.ok || !telegram.ok) throw new Error(telegram.description || "Telegram не подготовил сообщение");
    return json({ ok: true, prepared_message_id: telegram.result.id, share_token: tokenRow.token, tracked_url: trackedUrl });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Ошибка подготовки сообщения" }, 500);
  }
});

function escapeHtml(value: string) {
  return String(value || "").replace(/[&<>]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;" }[char] || char));
}