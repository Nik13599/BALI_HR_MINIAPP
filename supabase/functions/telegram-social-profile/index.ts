import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json, validateTelegramInitData } from "../_shared/telegram-auth.ts";

type Row = Record<string, any>;

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers:corsHeaders });
  if (req.method !== "POST") return json({ error:"Метод не поддерживается" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
    if (!url || !serviceKey || !botToken) throw new Error("Сервер BALI PEOPLE не настроен");

    const body = await req.json().catch(() => ({}));
    const { user } = await validateTelegramInitData(String(body.init_data || ""), botToken, 86400);
    const db = createClient(url, serviceKey);
    const action = String(body.action || "list");
    const userKey = `tg:${user.id}`;
    const now = new Date().toISOString();

    if (action === "sync") {
      const patch = body.profile && typeof body.profile === "object" ? body.profile : {};
      const name = String(patch.name || [user.first_name, user.last_name].filter(Boolean).join(" ") || "Гость BALI").slice(0, 120);
      const username = user.username ? `@${user.username}` : "";
      const photo = String(patch.photo || user.photo_url || "").slice(0, 2_500_000);
      const status = normalizeStatus(patch.status);
      const gender = normalizeGender(patch.gender);

      await Promise.all([
        safeUpsert(db, "app_users", {
          user_key:userKey, telegram_id:Number(user.id), name, username, avatar:photo,
          gender, active:true, last_seen_at:now, updated_at:now
        }),
        safeUpsert(db, "points_accounts", {
          user_key:userKey, telegram_id:Number(user.id), name, telegram:username, updated_at:now
        }),
        safeUpsert(db, "social_profiles", {
          user_key:userKey, telegram_id:Number(user.id), name,
          username:String(user.username || "").replace(/^@/, ""), phone:"", photo,
          crop_x:clamp(patch.crop_x ?? patch.cropX ?? 50),
          crop_y:clamp(patch.crop_y ?? patch.cropY ?? 40),
          status, bio:String(patch.bio || "").slice(0, 180), active:true,
          share_telegram:Boolean(patch.share_telegram ?? patch.shareTelegram),
          gender, birth_date:patch.birth_date || null, updated_at:now
        })
      ]);

      return json({ ok:true, profile:{
        user_key:userKey, telegram_id:Number(user.id), name,
        username:Boolean(patch.share_telegram ?? patch.shareTelegram) ? String(user.username || "") : "",
        photo, crop_x:clamp(patch.crop_x ?? patch.cropX ?? 50), crop_y:clamp(patch.crop_y ?? patch.cropY ?? 40),
        status, bio:String(patch.bio || "").slice(0, 180), active:true,
        share_telegram:Boolean(patch.share_telegram ?? patch.shareTelegram), gender, updated_at:now
      }});
    }

    if (action !== "list") return json({ error:"Неизвестное действие" }, 400);

    const [appUsers, accounts, customers, profiles, memberships, plans] = await Promise.all([
      safeRows(db.from("app_users").select("*").limit(3000)),
      safeRows(db.from("points_accounts").select("*").limit(3000)),
      safeRows(db.from("customers").select("*").limit(3000)),
      safeRows(db.from("social_profiles").select("*").limit(3000)),
      safeRows(db.from("vip_memberships").select("*").lte("starts_at", now).gt("expires_at", now).limit(3000)),
      safeRows(db.from("vip_plans").select("*").eq("active", true).limit(300))
    ]);

    const directory = new Map<string, Row>();
    const merge = (key:string, row:Row) => {
      if (!key) return;
      directory.set(key, { ...(directory.get(key) || {}), ...row, user_key:key });
    };

    for (const row of accounts) {
      const key = identityKey(row);
      merge(key, {
        telegram_id:telegramId(row), name:row.name || "Гость BALI",
        username:row.telegram || row.username || "", avatar:row.avatar || row.photo || "",
        gender:row.gender || "unspecified", created_at:row.created_at || null,
        updated_at:row.updated_at || null
      });
    }

    for (const row of customers) {
      const key = identityKey(row) || (row.id ? `customer:${row.id}` : "");
      merge(key, {
        telegram_id:telegramId(row), name:row.name || row.full_name || "Гость BALI",
        username:row.telegram || row.username || "", avatar:row.avatar || row.photo || "",
        gender:row.gender || "unspecified", created_at:row.created_at || null,
        updated_at:row.updated_at || row.last_seen_at || null, source:"customers"
      });
    }

    for (const row of appUsers) merge(identityKey(row), { ...row, telegram_id:telegramId(row) });

    merge(userKey, {
      telegram_id:Number(user.id),
      name:[user.first_name, user.last_name].filter(Boolean).join(" ") || "Гость BALI",
      username:user.username ? `@${user.username}` : "", avatar:user.photo_url || "",
      active:true, updated_at:now
    });

    const profileMap = new Map(profiles.map(row => [String(row.user_key || ""), row]));
    const planMap = new Map(plans.map(row => [String(row.id || ""), row]));
    const membershipMap = new Map<string, Row>();
    for (const row of memberships) {
      const key = String(row.user_key || "");
      if (key && !membershipMap.has(key)) membershipMap.set(key, row);
    }

    const result = [...directory.values()].map(base => {
      const key = String(base.user_key || "");
      const profile = profileMap.get(key) || {};
      const membership = membershipMap.get(key) || null;
      const plan = membership ? planMap.get(String(membership.plan_id || "")) || {} : {};
      const shareTelegram = Boolean(profile.share_telegram);
      const rawUsername = String(profile.username || base.username || "").replace(/^@/, "");
      return {
        user_key:key,
        telegram_id:telegramId(base),
        name:String(profile.name || base.name || "Гость BALI"),
        username:shareTelegram && rawUsername ? rawUsername : "",
        photo:String(profile.photo || base.avatar || base.photo || ""),
        crop_x:Number(profile.crop_x ?? 50), crop_y:Number(profile.crop_y ?? 40),
        status:normalizeStatus(profile.status), bio:String(profile.bio || "Пользователь BALI"),
        active:true, profile_active:true, share_telegram:shareTelegram,
        gender:normalizeGender(profile.gender || base.gender),
        vip_plan_id:membership ? String(membership.plan_id || "") : "",
        vip_plan_name:membership ? String(membership.plan_name || plan.name || "VIP") : "",
        vip_color:membership ? String(plan.color || "#c8ff3d") : "",
        vip_description:membership ? String(plan.description || "") : "",
        vip_privileges:membership ? privileges(plan.privileges) : [],
        vip_starts_at:membership?.starts_at || null,
        vip_expires_at:membership?.expires_at || null,
        updated_at:profile.updated_at || base.updated_at || base.last_seen_at || null,
        created_at:profile.created_at || base.created_at || base.first_seen_at || null
      };
    }).filter(row => row.user_key)
      .sort((a, b) => String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || "")));

    return json({ ok:true, profiles:result, total:result.length, refreshed_at:now });
  } catch (error) {
    console.error(error);
    return json({ error:error instanceof Error ? error.message : "Ошибка BALI PEOPLE" }, 400);
  }
});

function identityKey(row:Row):string {
  const explicit = String(row.user_key || row.userKey || "").trim();
  if (explicit) return explicit;
  const id = telegramId(row);
  return id ? `tg:${id}` : "";
}

function telegramId(row:Row):number|null {
  const value = Number(row.telegram_id || row.telegramId || 0);
  return Number.isFinite(value) && value > 0 ? value : null;
}

async function safeRows(query:any):Promise<Row[]> {
  try {
    const { data, error } = await query;
    if (error) {
      console.warn("BALI PEOPLE source:", error.message);
      return [];
    }
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn("BALI PEOPLE source:", error instanceof Error ? error.message : error);
    return [];
  }
}

async function safeUpsert(db:any, table:string, payload:Row) {
  try {
    const { error } = await db.from(table).upsert(payload, { onConflict:"user_key" });
    if (error) console.warn(`BALI PEOPLE ${table}:`, error.message);
  } catch (error) {
    console.warn(`BALI PEOPLE ${table}:`, error instanceof Error ? error.message : error);
  }
}

function normalizeStatus(value:unknown) {
  return ["party", "table", "chat"].includes(String(value)) ? String(value) : "chat";
}
function normalizeGender(value:unknown) {
  return ["male", "female", "unspecified"].includes(String(value)) ? String(value) : "unspecified";
}
function privileges(value:unknown):string[] {
  if (Array.isArray(value)) return value.map(item => String(item || "").trim()).filter(Boolean).slice(0, 20);
  if (typeof value === "string") return value.split(/\r?\n|,/).map(item => item.trim()).filter(Boolean).slice(0, 20);
  return [];
}
function clamp(value:unknown) {
  return Math.max(0, Math.min(100, Number(value ?? 50)));
}