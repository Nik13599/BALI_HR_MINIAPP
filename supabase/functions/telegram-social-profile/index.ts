import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json, validateTelegramInitData } from "../_shared/telegram-auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error:"Метод не поддерживается" }, 405);
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
    if (!supabaseUrl || !serviceRoleKey || !botToken) throw new Error("Сервер BALI PEOPLE не настроен");
    const body = await req.json().catch(() => ({}));
    const { user } = await validateTelegramInitData(String(body.init_data || ""), botToken, 86400);
    const db = createClient(supabaseUrl, serviceRoleKey);
    const userKey = `tg:${user.id}`;
    const action = String(body.action || "list");

    if (action === "sync") {
      const patch = body.profile && typeof body.profile === "object" ? body.profile : {};
      const { data:appUser } = await db.from("app_users").select("name,username,avatar,birth_date,gender").eq("user_key", userKey).maybeSingle();
      const payload = {
        user_key:userKey,
        telegram_id:Number(user.id),
        name:String(patch.name || appUser?.name || [user.first_name,user.last_name].filter(Boolean).join(" ") || "Гость BALI").slice(0,120),
        username:String(appUser?.username || user.username || "").replace(/^@/, "").slice(0,64),
        phone:"",
        photo:String(patch.photo || appUser?.avatar || user.photo_url || "").slice(0,2_500_000),
        crop_x:Math.max(0,Math.min(100,Number(patch.crop_x ?? patch.cropX ?? 50))),
        crop_y:Math.max(0,Math.min(100,Number(patch.crop_y ?? patch.cropY ?? 40))),
        status:["party","table","chat","closed"].includes(String(patch.status)) ? String(patch.status) : "closed",
        bio:String(patch.bio || "").slice(0,180),
        active:Boolean(patch.active),
        share_telegram:Boolean(patch.share_telegram ?? patch.shareTelegram),
        gender:["male","female","unspecified"].includes(String(patch.gender)) ? String(patch.gender) : String(appUser?.gender || "unspecified"),
        birth_date:patch.birth_date || appUser?.birth_date || null,
        updated_at:new Date().toISOString(),
      };
      const { data, error } = await db.from("social_profiles").upsert(payload, { onConflict:"user_key" }).select("*").single();
      if (error) throw error;
      return json({ ok:true, profile:sanitize(data) });
    }

    if (action === "list") {
      const { data, error } = await db.from("social_profiles").select("user_key,telegram_id,name,username,photo,crop_x,crop_y,status,bio,active,share_telegram,gender,updated_at,created_at").eq("active", true).neq("status", "closed").order("updated_at", { ascending:false }).limit(500);
      if (error) throw error;
      return json({ ok:true, profiles:(data || []).filter(row => row.user_key !== userKey).map(sanitize) });
    }

    return json({ error:"Неизвестное действие" }, 400);
  } catch (error) {
    console.error(error);
    return json({ error:error instanceof Error ? error.message : "Ошибка BALI PEOPLE" }, 400);
  }
});

function sanitize(row:Record<string,any>) {
  const share = Boolean(row.share_telegram);
  return {
    user_key:String(row.user_key || ""),
    telegram_id:row.telegram_id ? Number(row.telegram_id) : null,
    name:String(row.name || "Гость BALI"),
    username:share ? String(row.username || "").replace(/^@/, "") : "",
    photo:String(row.photo || ""),
    crop_x:Number(row.crop_x ?? 50),
    crop_y:Number(row.crop_y ?? 40),
    status:String(row.status || "closed"),
    bio:String(row.bio || ""),
    active:Boolean(row.active),
    share_telegram:share,
    gender:String(row.gender || "unspecified"),
    updated_at:row.updated_at || null,
    created_at:row.created_at || null,
  };
}