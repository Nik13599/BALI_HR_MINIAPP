import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json, validateTelegramInitData } from "../_shared/telegram-auth.ts";

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Метод не поддерживается" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "list");
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!botToken || !supabaseUrl || !serviceKey) throw new Error("Серверные секреты не настроены");
    const { user } = await validateTelegramInitData(String(body.init_data || ""), botToken);
    const db = createClient(supabaseUrl, serviceKey);

    const { data: existing } = await db.from("telegram_conversations").select("*").eq("telegram_user_id", user.id).maybeSingle();
    let conversation = existing;
    if (!conversation) {
      const { data, error } = await db.from("telegram_conversations").insert({
        telegram_user_id: user.id,
        telegram_chat_id: user.id,
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        username: user.username || "",
        photo_url: user.photo_url || "",
        status: "open"
      }).select("*").single();
      if (error) throw error;
      conversation = data;
    } else {
      await db.from("telegram_conversations").update({
        first_name: user.first_name || conversation.first_name,
        last_name: user.last_name || conversation.last_name,
        username: user.username || conversation.username,
        photo_url: user.photo_url || conversation.photo_url,
        updated_at: new Date().toISOString()
      }).eq("id", conversation.id);
    }

    if (action === "send") {
      const text = String(body.text || "").trim();
      if (!text) return json({ error: "Сообщение пустое" }, 400);
      if (text.length > 4000) return json({ error: "Сообщение слишком длинное" }, 400);
      const now = new Date().toISOString();
      const { error } = await db.from("telegram_messages").insert({
        conversation_id: conversation.id,
        direction: "user",
        message_type: "text",
        text,
        delivery_status: "received",
        payload: { source: "mini_app" },
        created_at: now
      });
      if (error) throw error;
      await db.from("telegram_conversations").update({
        unread_admin: Number(conversation.unread_admin || 0) + 1,
        last_message_text: text,
        last_message_at: now,
        updated_at: now
      }).eq("id", conversation.id);
    }

    if (action === "list_and_read") {
      const now = new Date().toISOString();
      await db.from("telegram_conversations").update({ unread_user: 0, updated_at: now }).eq("id", conversation.id);
      await db.from("telegram_messages").update({ read_at: now }).eq("conversation_id", conversation.id).eq("direction", "admin").is("read_at", null);
      conversation.unread_user = 0;
    }

    const { data: messages, error: messageError } = await db.from("telegram_messages").select("id,direction,text,message_type,delivery_status,created_at,read_at").eq("conversation_id", conversation.id).order("created_at", { ascending: true }).limit(300);
    if (messageError) throw messageError;
    const { data: fresh } = await db.from("telegram_conversations").select("unread_user").eq("id", conversation.id).single();
    return json({ ok: true, conversation_id: conversation.id, unread: Number(fresh?.unread_user || 0), messages: messages || [] });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Ошибка чата" }, 500);
  }
});