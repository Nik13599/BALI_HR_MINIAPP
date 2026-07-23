import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Метод не поддерживается" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    if (!supabaseUrl || !anonKey || !serviceRoleKey || !botToken) throw new Error("Не настроены серверные секреты Telegram/Supabase");

    const authorization = req.headers.get("Authorization");
    if (!authorization) return json({ error: "Требуется вход администратора" }, 401);

    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData.user) return json({ error: "Сессия администратора недействительна" }, 401);

    const body = await req.json().catch(() => ({}));
    const conversationId = String(body.conversation_id || "");
    const text = String(body.text || "").trim();
    if (!conversationId || !text) return json({ error: "Не выбран диалог или пустое сообщение" }, 400);
    if (text.length > 4000) return json({ error: "Сообщение слишком длинное" }, 400);

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: conversation, error: conversationError } = await admin
      .from("telegram_conversations")
      .select("id, telegram_chat_id, status, unread_user")
      .eq("id", conversationId)
      .single();
    if (conversationError || !conversation) return json({ error: "Диалог не найден" }, 404);
    if (conversation.status === "blocked") return json({ error: "Пользователь заблокирован" }, 409);

    const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: conversation.telegram_chat_id, text }),
    });
    const telegram = await telegramResponse.json();
    if (!telegramResponse.ok || !telegram.ok) throw new Error(telegram.description || "Telegram не принял сообщение");

    const now = new Date().toISOString();
    const { data: message, error: insertError } = await admin
      .from("telegram_messages")
      .insert({
        conversation_id: conversation.id,
        direction: "admin",
        admin_user_id: authData.user.id,
        telegram_message_id: telegram.result?.message_id ?? null,
        message_type: "text",
        text,
        payload: telegram.result || {},
        delivery_status: "sent",
        created_at: now,
      })
      .select("*")
      .single();
    if (insertError) throw insertError;

    await admin.from("telegram_conversations").update({
      unread_user: Number(conversation.unread_user || 0) + 1,
      last_message_text: text,
      last_message_at: now,
      updated_at: now,
    }).eq("id", conversation.id);

    return json({ ok: true, message });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Ошибка отправки" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}
