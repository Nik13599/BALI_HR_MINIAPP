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
      const { data: appUser } = await db
        .from("app_users")
        .select("name,username,avatar,birth_date,gender")
        .eq("user_key", userKey)
        .maybeSingle();

      const payload = {
        user_key: userKey,
        telegram_id: Number(user.id),
        name: String(patch.name || appUser?.name || [user.first_name, user.last_name].filter(Boolean).join(" ") || "Гость BALI").slice(0, 120),
        username: String(appUser?.username || user.username || "").replace(/^@/, "").slice(0, 64),
        phone: "",
        photo: String(patch.photo || appUser?.avatar || user.photo_url || "").slice(0, 2_500_000),
        crop_x: clamp(patch.crop_x ?? patch.cropX ?? 50),
        crop_y: clamp(patch.crop_y ?? patch.cropY ?? 40),
        status: ["party", "table", "chat", "closed"].includes(String(patch.status)) ? String(patch.status) : "closed",
        bio: String(patch.bio || "").slice(0, 180),
        active: Boolean(patch.active),
        share_telegram: Boolean(patch.share_telegram ?? patch.shareTelegram),
        gender: ["male", "female", "unspecified"].includes(String(patch.gender)) ? String(patch.gender) : String(appUser?.gender || "unspecified"),
        birth_date: patch.birth_date || appUser?.birth_date || null,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await db
        .from("social_profiles")
        .upsert(payload, { onConflict: "user_key" })
        .select("*")
        .single();
      if (error) throw error;
      return json({ ok: true, profile: sanitizeProfile(data) });
    }

    if (action === "list") {
      const now = new Date().toISOString();
      const [usersResult, profilesResult, membershipsResult, plansResult] = await Promise.all([
        db.from("app_users")
          .select("user_key,telegram_id,name,username,avatar,gender,first_seen_at,last_seen_at")
          .order("last_seen_at", { ascending: false })
          .limit(1000),
        db.from("social_profiles")
          .select("user_key,telegram_id,name,username,photo,crop_x,crop_y,status,bio,active,share_telegram,gender,updated_at,created_at")
          .limit(1000),
        db.from("vip_memberships")
          .select("user_key,plan_id,plan_name,starts_at,expires_at")
          .lte("starts_at", now)
          .gt("expires_at", now)
          .order("expires_at", { ascending: false })
          .limit(2000),
        loadPlans(db)
      ]);

      if (usersResult.error) throw usersResult.error;
      if (profilesResult.error) console.warn("BALI PEOPLE profiles:", profilesResult.error.message);
      if (membershipsResult.error) console.warn("BALI PEOPLE VIP:", membershipsResult.error.message);

      const profiles = new Map((profilesResult.data || []).map((row: AnyRow) => [String(row.user_key || ""), row]));
      const memberships = new Map<string, AnyRow>();
      for (const membership of membershipsResult.data || []) {
        const key = String(membership.user_key || "");
        if (key && !memberships.has(key)) memberships.set(key, membership);
      }
      const plans = new Map((plansResult || []).map((row: AnyRow) => [String(row.id || ""), row]));

      const directory = (usersResult.data || [])
        .filter((row: AnyRow) => String(row.user_key || "") !== userKey)
        .map((appUser: AnyRow) => {
          const profile = profiles.get(String(appUser.user_key || "")) || {};
          const membership = memberships.get(String(appUser.user_key || "")) || null;
          const plan = membership ? plans.get(String(membership.plan_id || "")) || {} : {};
          return sanitizeDirectoryUser(appUser, profile, membership, plan);
        });

      return json({ ok: true, profiles: directory, total: directory.length, refreshed_at: now });
    }

    return json({ error: "Неизвестное действие" }, 400);
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : "Ошибка BALI PEOPLE" }, 400);
  }
});

async function loadPlans(db: any): Promise<AnyRow[]> {
  const extended = await db.from("vip_plans")
    .select("id,name,color,description,privileges")
    .eq("active", true);
  if (!extended.error) return extended.data || [];

  const fallback = await db.from("vip_plans")
    .select("id,name")
    .eq("active", true);
  return fallback.data || [];
}

function sanitizeDirectoryUser(appUser: AnyRow, profile: AnyRow, membership: AnyRow | null, plan: AnyRow) {
  const profileActive = Boolean(profile.active) && String(profile.status || "closed") !== "closed";
  const shareTelegram = Boolean(profile.share_telegram);
  const planId = membership ? String(membership.plan_id || "") : "";
  const planName = membership ? String(membership.plan_name || plan.name || "VIP") : "";

  return {
    user_key: String(appUser.user_key || ""),
    telegram_id: appUser.telegram_id ? Number(appUser.telegram_id) : null,
    name: String(profile.name || appUser.name || "Гость BALI"),
    username: shareTelegram ? String(profile.username || appUser.username || "").replace(/^@/, "") : "",
    photo: String(profile.photo || appUser.avatar || ""),
    crop_x: Number(profile.crop_x ?? 50),
    crop_y: Number(profile.crop_y ?? 40),
    status: profileActive ? String(profile.status || "chat") : "chat",
    bio: profileActive ? String(profile.bio || "") : "Пользователь BALI",
    active: true,
    profile_active: profileActive,
    share_telegram: shareTelegram,
    gender: String(profile.gender || appUser.gender || "unspecified"),
    vip_plan_id: planId,
    vip_plan_name: planName,
    vip_color: membership ? String(plan.color || colorForPlan(planId)) : "",
    vip_description: membership ? String(plan.description || "") : "",
    vip_privileges: membership ? normalizePrivileges(plan.privileges) : [],
    vip_starts_at: membership?.starts_at || null,
    vip_expires_at: membership?.expires_at || null,
    updated_at: profile.updated_at || appUser.last_seen_at || null,
    created_at: profile.created_at || appUser.first_seen_at || null
  };
}

function sanitizeProfile(row: AnyRow) {
  const share = Boolean(row.share_telegram);
  return {
    user_key: String(row.user_key || ""),
    telegram_id: row.telegram_id ? Number(row.telegram_id) : null,
    name: String(row.name || "Гость BALI"),
    username: share ? String(row.username || "").replace(/^@/, "") : "",
    photo: String(row.photo || ""),
    crop_x: Number(row.crop_x ?? 50),
    crop_y: Number(row.crop_y ?? 40),
    status: String(row.status || "closed"),
    bio: String(row.bio || ""),
    active: Boolean(row.active),
    share_telegram: share,
    gender: String(row.gender || "unspecified"),
    updated_at: row.updated_at || null,
    created_at: row.created_at || null
  };
}

function normalizePrivileges(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(item => String(item || "").trim()).filter(Boolean).slice(0, 20);
  if (typeof value === "string") return value.split(/\r?\n|,/).map(item => item.trim()).filter(Boolean).slice(0, 20);
  return [];
}

function colorForPlan(planId: string) {
  const id = planId.toLowerCase();
  if (id.includes("legend") || id.includes("gold")) return "#e3bd64";
  if (id.includes("black")) return "#9aa4b2";
  return "#c8ff3d";
}

function clamp(value: unknown) {
  return Math.max(0, Math.min(100, Number(value ?? 50)));
}
