import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const webhookSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") || "";
    const webAppUrl = Deno.env.get("TELEGRAM_WEBAPP_URL") || "https://bali-minsk-app.pages.dev";
    if (!supabaseUrl || !serviceRoleKey || !botToken) throw new Error("Не настроены серверные секреты Telegram/Supabase");

    if (webhookSecret) {
      const received = req.headers.get("X-Telegram-Bot-Api-Secret-Token") || "";
      if (received !== webhookSecret) return new Response("forbidden", { status: 403 });
    }

    const update = await req.json();
    const message = update.message || update.edited_message;
    if (!message?.chat || message.chat.type !== "private" || !message.from) return new Response("ok");

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const user = message.from;
    const chatId = Number(message.chat.id);
    const userId = Number(user.id);
    const now = new Date().toISOString();
    const messageType = detectMessageType(message);
    const text = extractText(message);

    const { data: existing } = await admin
      .from("telegram_conversations")
      .select("id, unread_admin")
      .eq("telegram_user_id", userId)
      .maybeSingle();

    const conversationPayload = {
      telegram_user_id: userId,
      telegram_chat_id: chatId,
      username: user.username || null,
      first_name: user.first_name || null,
      last_name: user.last_name || null,
      status: "open",
      last_message_text: text,
      last_message_at: now,
      unread_admin: Number(existing?.unread_admin || 0) + 1,
      updated_at: now,
    };

    let conversationId = existing?.id;
    if (conversationId) {
      const { error } = await admin.from("telegram_conversations").update(conversationPayload).eq("id", conversationId);
      if (error) throw error;
    } else {
      const { data, error } = await admin
        .from("telegram_conversations")
        .insert({ ...conversationPayload, created_at: now })
        .select("id")
        .single();
      if (error) throw error;
      conversationId = data.id;
    }

    const { error: messageError } = await admin.from("telegram_messages").upsert({
      conversation_id: conversationId,
      direction: "user",
      sender_telegram_id: userId,
      telegram_message_id: Number(message.message_id),
      message_type: messageType,
      text,
      payload: message,
      delivery_status: "received",
      created_at: message.date ? new Date(Number(message.date) * 1000).toISOString() : now,
    }, { onConflict: "conversation_id,telegram_message_id", ignoreDuplicates: true });
    if (messageError) throw messageError;

    if (String(message.text || "").startsWith("/start")) {
      await sendTelegram(botToken, "sendMessage", {
        chat_id: chatId,
        text: "Добро пожаловать в BALI Minsk 🌴\n\nЗдесь можно написать администрации, уточнить бронь и открыть приложение BALI.",
        reply_markup: {
          inline_keyboard: [[{ text: "Открыть BALI", web_app: { url: webAppUrl } }]],
        },
      });
    }

    return new Response("ok");
  } catch (error) {
    console.error(error);
    return new Response("error", { status: 500 });
  }
});

function detectMessageType(message: Record<string, unknown>) {
  if (message.photo) return "photo";
  if (message.document) return "document";
  if (message.voice) return "voice";
  if (message.video) return "video";
  if (message.sticker) return "sticker";
  if (message.location) return "location";
  return "text";
}

function extractText(message: Record<string, any>) {
  if (message.text) return String(message.text);
  if (message.caption) return String(message.caption);
  if (message.photo) return "📷 Фотография";
  if (message.document) return `📎 ${message.document.file_name || "Документ"}`;
  if (message.voice) return "🎤 Голосовое сообщение";
  if (message.video) return "🎬 Видео";
  if (message.sticker) return "Стикер";
  if (message.location) return "📍 Геолокация";
  return "Новое сообщение";
}

async function sendTelegram(token: string, method: string, body: unknown) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.description || `Telegram ${method} error`);
  return result;
}
