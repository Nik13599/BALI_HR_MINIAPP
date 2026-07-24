import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const webhookSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") || "";
    const webAppUrl = Deno.env.get("TELEGRAM_WEBAPP_URL") || "https://nik13599.github.io/BALI_HR_MINIAPP/site/?v=bali-production-31";
    if (!supabaseUrl || !serviceRoleKey || !botToken) throw new Error("Не настроены серверные секреты Telegram/Supabase");
    if (webhookSecret) {
      const received = req.headers.get("X-Telegram-Bot-Api-Secret-Token") || "";
      if (received !== webhookSecret) return new Response("forbidden", { status: 403 });
    }

    const update = await req.json();
    const message = update.message || update.edited_message;
    const isEdited = Boolean(update.edited_message);
    if (!message?.chat || message.chat.type !== "private" || !message.from) return new Response("ok");

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const user = message.from;
    const chatId = Number(message.chat.id);
    const userId = Number(user.id);
    const now = new Date().toISOString();
    const createdAt = message.date ? new Date(Number(message.date) * 1000).toISOString() : now;
    const messageType = detectMessageType(message);
    const text = extractText(message);

    const { data: existing, error: existingError } = await admin
      .from("telegram_conversations")
      .select("id,unread_admin")
      .eq("telegram_user_id", userId)
      .maybeSingle();
    if (existingError) throw existingError;

    let conversationId = existing?.id;
    if (!conversationId) {
      const { data, error } = await admin.from("telegram_conversations").insert({
        telegram_user_id: userId,
        telegram_chat_id: chatId,
        username: user.username || "",
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        status: "open",
        last_message_text: "",
        last_message_at: null,
        unread_admin: 0,
        created_at: now,
        updated_at: now,
      }).select("id").single();
      if (error) throw error;
      conversationId = data.id;
    }

    const messagePayload = {
      conversation_id: conversationId,
      direction: "user",
      telegram_message_id: Number(message.message_id),
      message_type: messageType,
      text,
      payload: message,
      delivery_status: "received",
      created_at: createdAt,
    };

    let inserted = false;
    if (isEdited) {
      const { data: updated, error } = await admin.from("telegram_messages")
        .update({ text, message_type: messageType, payload: message })
        .eq("conversation_id", conversationId)
        .eq("telegram_message_id", Number(message.message_id))
        .eq("direction", "user")
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!updated) {
        const { error: insertError } = await admin.from("telegram_messages").insert(messagePayload);
        if (insertError && insertError.code !== "23505") throw insertError;
        inserted = !insertError;
      }
    } else {
      const { error: insertError } = await admin.from("telegram_messages").insert(messagePayload);
      if (insertError && insertError.code !== "23505") throw insertError;
      inserted = !insertError;
    }

    if (inserted || isEdited) {
      const conversationUpdate: Record<string, unknown> = {
        telegram_chat_id: chatId,
        username: user.username || "",
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        status: "open",
        last_message_text: text,
        last_message_at: createdAt,
        updated_at: now,
      };
      if (inserted && !isEdited) conversationUpdate.unread_admin = Number(existing?.unread_admin || 0) + 1;
      const { error } = await admin.from("telegram_conversations").update(conversationUpdate).eq("id", conversationId);
      if (error) throw error;
    }

    if (inserted && String(message.text || "").startsWith("/start")) {
      await sendTelegram(botToken, "sendMessage", {
        chat_id: chatId,
        text: "Добро пожаловать в BALI Minsk 🌴\n\nЗдесь можно написать администрации, уточнить бронь и открыть приложение BALI.",
        reply_markup: { inline_keyboard: [[{ text: "Открыть BALI", web_app: { url: webAppUrl } }]] },
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
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.description || `Telegram ${method} error`);
  return result;
}