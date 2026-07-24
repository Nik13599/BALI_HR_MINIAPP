import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ error:"Метод не поддерживается" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
    if (!supabaseUrl || !anonKey || !serviceRoleKey || !botToken) throw new Error("Сервер рассылок не настроен");

    const authorization = req.headers.get("Authorization") || "";
    if (!authorization) return reply({ error:"Требуется вход администратора" }, 401);
    const authClient = createClient(supabaseUrl, anonKey, { global:{ headers:{ Authorization:authorization } } });
    const { data:authData, error:authError } = await authClient.auth.getUser();
    if (authError || !authData.user) return reply({ error:"Сессия администратора недействительна" }, 401);

    const body = await req.json().catch(() => ({}));
    const broadcastId = String(body.broadcast_id || "");
    const action = String(body.action || "send_batch");
    if (!broadcastId) return reply({ error:"Рассылка не выбрана" }, 400);

    const db = createClient(supabaseUrl, serviceRoleKey);
    const { data:broadcast, error:broadcastError } = await db.from("telegram_broadcasts").select("*").eq("id", broadcastId).single();
    if (broadcastError || !broadcast) return reply({ error:"Рассылка не найдена" }, 404);

    if (action === "retry_failed") {
      await db.from("telegram_broadcast_deliveries").update({ status:"pending", error_text:"", sent_at:null }).eq("broadcast_id", broadcastId).eq("status", "failed");
      await db.from("telegram_broadcasts").update({ status:"sending", updated_at:new Date().toISOString() }).eq("id", broadcastId);
    }

    if (broadcast.status === "draft" || action === "prepare") {
      await prepareRecipients(db, broadcastId);
      await db.from("telegram_broadcasts").update({ status:"sending", created_by:authData.user.id, updated_at:new Date().toISOString() }).eq("id", broadcastId);
      if (action === "prepare") return await totals(db, broadcastId);
    }

    const { data:pending, error:pendingError } = await db.from("telegram_broadcast_deliveries")
      .select("*").eq("broadcast_id", broadcastId).eq("status", "pending").order("created_at").limit(20);
    if (pendingError) throw pendingError;

    let fileId = String(broadcast.telegram_file_id || "");
    for (const delivery of pending || []) {
      try {
        const result = broadcast.image_data || fileId
          ? await sendPhoto(botToken, delivery.telegram_chat_id, broadcast.message_text, fileId, broadcast.image_data, broadcast.image_mime)
          : await sendText(botToken, delivery.telegram_chat_id, broadcast.message_text);
        if (!fileId && result.photo?.length) {
          fileId = String(result.photo[result.photo.length - 1].file_id || "");
          if (fileId) await db.from("telegram_broadcasts").update({ telegram_file_id:fileId, updated_at:new Date().toISOString() }).eq("id", broadcastId);
        }
        await db.from("telegram_broadcast_deliveries").update({ status:"sent", telegram_message_id:result.message_id || null, sent_at:new Date().toISOString(), error_text:"" }).eq("id", delivery.id);
      } catch (error) {
        await db.from("telegram_broadcast_deliveries").update({ status:"failed", error_text:String(error instanceof Error ? error.message : error).slice(0,500), sent_at:new Date().toISOString() }).eq("id", delivery.id);
      }
      await new Promise(resolve => setTimeout(resolve, 60));
    }

    return await totals(db, broadcastId);
  } catch (error) {
    console.error(error);
    return reply({ error:error instanceof Error ? error.message : "Ошибка рассылки" }, 500);
  }
});

async function prepareRecipients(db:any, broadcastId:string) {
  const [{ data:users, error:userError }, { data:conversations, error:conversationError }] = await Promise.all([
    db.from("app_users").select("telegram_id").not("telegram_id", "is", null),
    db.from("telegram_conversations").select("id,telegram_user_id,telegram_chat_id,status").neq("status", "blocked"),
  ]);
  if (userError) throw userError;
  if (conversationError) throw conversationError;
  const conversationMap = new Map((conversations || []).map((row:any) => [String(row.telegram_user_id), row]));
  const recipients = new Map<string,any>();
  for (const user of users || []) {
    const id = Number(user.telegram_id);
    if (!id) continue;
    const conversation = conversationMap.get(String(id));
    recipients.set(String(id), {
      broadcast_id:broadcastId,
      telegram_user_id:id,
      telegram_chat_id:Number(conversation?.telegram_chat_id || id),
      conversation_id:conversation?.id || null,
      status:"pending",
      error_text:"",
    });
  }
  for (const conversation of conversations || []) {
    const id = Number(conversation.telegram_user_id);
    if (!id) continue;
    recipients.set(String(id), {
      broadcast_id:broadcastId,
      telegram_user_id:id,
      telegram_chat_id:Number(conversation.telegram_chat_id || id),
      conversation_id:conversation.id || null,
      status:"pending",
      error_text:"",
    });
  }
  const rows = [...recipients.values()];
  for (let index=0; index<rows.length; index+=200) {
    const { error } = await db.from("telegram_broadcast_deliveries").upsert(rows.slice(index,index+200), { onConflict:"broadcast_id,telegram_chat_id", ignoreDuplicates:true });
    if (error) throw error;
  }
  await db.from("telegram_broadcasts").update({ recipient_count:rows.length, updated_at:new Date().toISOString() }).eq("id", broadcastId);
}

async function totals(db:any, broadcastId:string) {
  const [sent,failed,pending,total] = await Promise.all([
    db.from("telegram_broadcast_deliveries").select("id", { count:"exact", head:true }).eq("broadcast_id",broadcastId).eq("status","sent"),
    db.from("telegram_broadcast_deliveries").select("id", { count:"exact", head:true }).eq("broadcast_id",broadcastId).eq("status","failed"),
    db.from("telegram_broadcast_deliveries").select("id", { count:"exact", head:true }).eq("broadcast_id",broadcastId).eq("status","pending"),
    db.from("telegram_broadcast_deliveries").select("id", { count:"exact", head:true }).eq("broadcast_id",broadcastId),
  ]);
  const success = Number(sent.count || 0), failures = Number(failed.count || 0), remaining = Number(pending.count || 0), recipients = Number(total.count || 0);
  const status = remaining > 0 ? "sending" : "completed";
  await db.from("telegram_broadcasts").update({ status, recipient_count:recipients, success_count:success, failure_count:failures, sent_at:remaining ? null : new Date().toISOString(), updated_at:new Date().toISOString() }).eq("id",broadcastId);
  return reply({ ok:true, broadcast_id:broadcastId, status, recipient_count:recipients, success_count:success, failure_count:failures, remaining });
}

async function sendText(token:string, chatId:number, text:string) {
  if (!String(text || "").trim()) throw new Error("Текст рассылки пуст");
  return await telegram(token, "sendMessage", { chat_id:chatId, text });
}

async function sendPhoto(token:string, chatId:number, caption:string, fileId:string, imageData:string, mime:string) {
  if (fileId) return await telegram(token, "sendPhoto", { chat_id:chatId, photo:fileId, caption:caption || undefined });
  const match = String(imageData || "").match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Изображение рассылки повреждено");
  const bytes = Uint8Array.from(atob(match[2]), char => char.charCodeAt(0));
  const form = new FormData();
  form.set("chat_id", String(chatId));
  if (caption) form.set("caption", caption);
  form.set("photo", new Blob([bytes], { type:mime || match[1] || "image/jpeg" }), "broadcast-image");
  const response = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method:"POST", body:form });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.description || "Telegram не принял изображение");
  return data.result;
}

async function telegram(token:string, method:string, body:unknown) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.description || `Telegram ${method} error`);
  return data.result;
}

function reply(data:unknown, status=200) {
  return new Response(JSON.stringify(data), { status, headers:{ ...corsHeaders, "Content-Type":"application/json; charset=utf-8" } });
}