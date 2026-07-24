import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json, validateTelegramInitData } from "../_shared/telegram-auth.ts";

type AnyRow = Record<string, any>;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Метод не поддерживается" }, 405);

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
      const now = new Date().toISOString();
      const fallbackName = [user.first_name, user.last_name].filter(Boolean).join(" ") || "Гость BALI";
      const username = user.username ? `@${user.username}` : "";
      const avatar = String(patch.photo || user.photo_url || "").slice(0, 2_500_000);

      const extendedUser = {
        user_key:userKey,
        telegram_id:Number(user.id),
        name:String(patch.name || fallbackName).slice(0, 120),
        username,
        avatar,
        gender:normalizeGender(patch.gender),
        birth_date:patch.birth_date || null,
        active:true,
        last_seen_at:now,
        updated_at:now
      };
      const { error:extendedError } = await db.from("app_users").upsert(extendedUser, { onConflict:"user_key" });
      if (extendedError) {
        console.warn("BALI PEOPLE extended app_users:", extendedError.message);
        const { error:minimalError } = await db.from("app_users").upsert({
          user_key:userKey,
          telegram_id:Number(user.id),
          name:String(patch.name || fallbackName).slice(0, 120),
          active:true,
          updated_at:now
        }, { onConflict:"user_key" });
        if (minimalError) console.warn("BALI PEOPLE minimal app_users:", minimalError.message);
      }

      const { error:pointsError } = await db.from("points_accounts").upsert({
        user_key:userKey,
        telegram_id:Number(user.id),
        name:String(patch.name || fallbackName).slice(0, 120),
        telegram:username,
        updated_at:now
      }, { onConflict:"user_key" });
      if (pointsError) console.warn("BALI PEOPLE points_accounts:", pointsError.message);

      const profilePayload = {
        user_key:userKey,
        telegram_id:Number(user.id),
        name:String(patch.name || fallbackName).slice(0, 120),
        username:String(user.username || "").replace(/^@/, "").slice(0, 64),
        phone:"",
        photo:avatar,
        crop_x:clamp(patch.crop_x ?? patch.cropX ?? 50),
        crop_y:clamp(patch.crop_y ?? patch.cropY ?? 40),
        status:normalizeStatus(patch.status),
        bio:String(patch.bio || "").slice(0, 180),
        active:true,
        share_telegram:Boolean(patch.share_telegram ?? patch.shareTelegram),
        gender:normalizeGender(patch.gender),
        birth_date:patch.birth_date || null,
        updated_at:now
      };

      const { data, error } = await db.from("social_profiles")
        .upsert(profilePayload, { onConflict:"user_key" })
        .select("*")
        .single();
      if (error) {
        console.warn("BALI PEOPLE sync social_profiles:", error.message);
        return json({ ok:true, profile:sanitizeProfile(profilePayload) });
      }
      return json({ ok:true, profile:sanitizeProfile(data) });
    }

    if (action === "list") {
      const now = new Date().toISOString();
      const [appUsers, pointUsers, profiles, memberships, plans] = await Promise.all([
        safeRows(db.from("app_users").select("*").limit(1000)),
        safeRows(db.from("points_accounts").select("*").limit(1000)),
        safeRows(db.from("social_profiles").select("*").limit(1000)),
        safeRows(db.from("vip_memberships").select("*").lte("starts_at", now).gt("expires_at", now).limit(2000)),
        safeRows(db.from("vip_plans").select("*").eq("active", true).limit(200))
      ]);

      const directory = new Map<string, AnyRow>();
      for (const row of pointUsers) {
        const key = String(row.user_key || row.id || "");
        if (!key) continue;
        directory.set(key, {
          user_key:key,
          telegram_id:row.telegram_id || null,
          name:row.name || "Гость BALI",
          username:row.telegram || row.username || "",
          avatar:row.avatar || row.photo || "",
          gender:row.gender || "unspecified",
          first_seen_at:row.created_at || null,
          last_seen_at:row.updated_at || null
        });
      }
      for (const row of appUsers) {
        const key = String(row.user_key || "");
        if (!key) continue;
        directory.set(key, { ...(directory.get(key) || {}), ...row, user_key:key });
      }

      const profileMap = new Map(profiles.map(row => [String(row.user_key || ""), row]));
      const membershipMap = new Map<string, AnyRow>();
      for (const row of memberships) {
        const key = String(row.user_key || "");
        if (key && !membershipMap.has(key)) membershipMap.set(key, row);
      }
      const planMap = new Map(plans.map(row => [String(row.id || ""), row]));

      const rows = [...directory.values()]
        .filter(row => String(row.user_key || "") !== userKey)
        .map(appUser => {
          const profile = profileMap.get(String(appUser.user_key || "")) || {};
          const membership = membershipMap.get(String(appUser.user_key || "")) || null;
          const plan = membership ? planMap.get(String(membership.plan_id || "")) || {} : {};
          return sanitizeDirectoryUser(appUser, profile, membership, plan);
        })
        .filter(row => row.user_key)
        .sort((a, b) => String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || "")));

      return json({ ok:true, profiles:rows, total:rows.length, refreshed_at:now });
    }

    return json({ error:"Неизвестное действие" }, 400);
  } catch (error) {
    console.error(error);
    return json({ error:error instanceof Error ? error.message : "Ошибка BALI PEOPLE" }, 400);
  }
});

async function safeRows(query:any):Promise<AnyRow[]> {
  try {
    const { data, error } = await query;
    if (error) {
      console.warn("BALI PEOPLE source:", error.message);
      return [];
    }
    return data || [];
  } catch (error) {
    console.warn("BALI PEOPLE source:", error instanceof Error ? error.message : error);
    return [];
  }
}

function sanitizeDirectoryUser(appUser:AnyRow, profile:AnyRow, membership:AnyRow|null, plan:AnyRow) {
  const shareTelegram = Boolean(profile.share_telegram);
  const planId = membership ? String(membership.plan_id || "") : "";
  return {
    user_key:String(appUser.user_key || ""),
    telegram_id:appUser.telegram_id ? Number(appUser.telegram_id) : null,
    name:String(profile.name || appUser.name || "Гость BALI"),
    username:shareTelegram ? String(profile.username || appUser.username || "").replace(/^@/, "") : "",
    photo:String(profile.photo || appUser.avatar || appUser.photo || ""),
    crop_x:Number(profile.crop_x ?? 50),
    crop_y:Number(profile.crop_y ?? 40),
    status:normalizeStatus(profile.status),
    bio:String(profile.bio || "Пользователь BALI"),
    active:true,
    profile_active:Boolean(profile.active),
    share_telegram:shareTelegram,
    gender:normalizeGender(profile.gender || appUser.gender),
    vip_plan_id:planId,
    vip_plan_name:membership ? String(membership.plan_name || plan.name || "VIP") : "",
    vip_color:membership ? String(plan.color || colorForPlan(planId)) : "",
    vip_description:membership ? String(plan.description || "") : "",
    vip_privileges:membership ? normalizePrivileges(plan.privileges) : [],
    vip_starts_at:membership?.starts_at || null,
    vip_expires_at:membership?.expires_at || null,
    updated_at:profile.updated_at || appUser.last_seen_at || appUser.updated_at || null,
    created_at:profile.created_at || appUser.first_seen_at || appUser.created_at || null
  };
}

function sanitizeProfile(row:AnyRow) {
  const share = Boolean(row.share_telegram);
  return {
    user_key:String(row.user_key || ""),
    telegram_id:row.telegram_id ? Number(row.telegram_id) : null,
    name:String(row.name || "Гость BALI"),
    username:share ? String(row.username || "").replace(/^@/, "") : "",
    photo:String(row.photo || ""),
    crop_x:Number(row.crop_x ?? 50),
    crop_y:Number(row.crop_y ?? 40),
    status:normalizeStatus(row.status),
    bio:String(row.bio || ""),
    active:true,
    share_telegram:share,
    gender:normalizeGender(row.gender),
    updated_at:row.updated_at || null,
    created_at:row.created_at || null
  };
}

function normalizeStatus(value:unknown) {
  return ["party", "table", "chat"].includes(String(value)) ? String(value) : "chat";
}
function normalizeGender(value:unknown) {
  return ["male", "female", "unspecified"].includes(String(value)) ? String(value) : "unspecified";
}
function normalizePrivileges(value:unknown):string[] {
  if (Array.isArray(value)) return value.map(item => String(item || "").trim()).filter(Boolean).slice(0, 20);
  if (typeof value === "string") return value.split(/\r?\n|,/).map(item => item.trim()).filter(Boolean).slice(0, 20);
  return [];
}
function colorForPlan(planId:string) {
  const id = planId.toLowerCase();
  if (id.includes("legend") || id.includes("gold")) return "#e3bd64";
  if (id.includes("black")) return "#9aa4b2";
  return "#c8ff3d";
}
function clamp(value:unknown) {
  return Math.max(0, Math.min(100, Number(value ?? 50)));
}