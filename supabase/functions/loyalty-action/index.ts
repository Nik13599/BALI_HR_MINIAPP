import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json, validateTelegramInitData } from "../_shared/telegram-auth.ts";

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Метод не поддерживается" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!botToken || !supabaseUrl || !serviceKey) throw new Error("Серверные секреты не настроены");
    const { user } = await validateTelegramInitData(String(body.init_data || ""), botToken);
    const db = createClient(supabaseUrl, serviceKey);
    const userKey = `tg:${user.id}`;
    const { data: before } = await db.from("app_users").select("user_key").eq("user_key", userKey).maybeSingle();
    await registerUser(db, userKey, user);

    if (action === "confirm_event_share") {
      const token = String(body.share_token || "");
      const { data: row, error } = await db.from("loyalty_share_tokens").select("*").eq("token", token).eq("kind", "event").eq("inviter_user_key", userKey).single();
      if (error || !row) return json({ error: "Репост не найден" }, 404);
      if (new Date(row.expires_at) < new Date()) return json({ error: "Срок репоста истёк" }, 409);
      if (!row.base_reward_granted_at) {
        await credit(db, userKey, user, 5, "Репост события", `event-share:${row.event_id}:${userKey}`);
        await db.from("loyalty_share_tokens").update({ share_confirmed_at:new Date().toISOString(), base_reward_granted_at:new Date().toISOString() }).eq("token", token);
      }
      return json({ ok:true, balance:await balance(db,userKey) });
    }

    if (action === "consume_start_param") {
      const start = String(body.start_param || "");
      if (!start.startsWith("share_")) return json({ ok:true, balance:await balance(db,userKey) });
      const token = start.slice(6);
      const { data: row, error } = await db.from("loyalty_share_tokens").select("*").eq("token", token).single();
      if (error || !row || new Date(row.expires_at) < new Date()) return json({ ok:true, balance:await balance(db,userKey) });
      if (String(row.inviter_user_key) === userKey) return json({ ok:true, balance:await balance(db,userKey) });
      const { data: existing } = await db.from("loyalty_conversions").select("id").eq("token", token).eq("invited_user_key", userKey).maybeSingle();
      if (existing) return json({ ok:true, balance:await balance(db,userKey) });

      let reward = 0;
      let title = "";
      if (row.kind === "referral" && !before) { reward = 10; title = "Приглашённый друг открыл BALI"; }
      if (row.kind === "event") { reward = 5; title = "Друг перешёл по репосту события"; }
      await db.from("loyalty_conversions").insert({ token:row.token, invited_user_key:userKey, invited_telegram_id:user.id, reward_amount:reward });
      if (reward > 0) await creditByKey(db, row.inviter_user_key, row.inviter_telegram_id, reward, title, `conversion:${row.token}:${userKey}`);
      return json({ ok:true, balance:await balance(db,userKey), inviter_reward:reward });
    }

    return json({ error:"Неизвестное действие" }, 400);
  } catch (error) {
    console.error(error);
    return json({ error:error instanceof Error ? error.message : "Ошибка бонусной системы" }, 500);
  }
});

async function registerUser(db:any,userKey:string,user:any){
  await db.from("app_users").upsert({user_key:userKey,telegram_id:user.id,name:[user.first_name,user.last_name].filter(Boolean).join(" ")||"Гость BALI",username:user.username?`@${user.username}`:"",avatar:user.photo_url||"",last_seen_at:new Date().toISOString()},{onConflict:"user_key"});
  await db.from("points_accounts").upsert({user_key:userKey,telegram_id:user.id,name:[user.first_name,user.last_name].filter(Boolean).join(" ")||"Гость BALI",telegram:user.username?`@${user.username}`:"",updated_at:new Date().toISOString()},{onConflict:"user_key"});
}
async function credit(db:any,userKey:string,user:any,amount:number,title:string,actionKey:string){await creditByKey(db,userKey,user.id,amount,title,actionKey,user);}
async function creditByKey(db:any,userKey:string,telegramId:number,amount:number,title:string,actionKey:string,user?:any){
  const {data:used}=await db.from("points_ledger").select("id").eq("user_key",userKey).eq("action_key",actionKey).maybeSingle();
  if(used)return;
  await db.from("points_accounts").upsert({user_key:userKey,telegram_id:telegramId,name:user?[user.first_name,user.last_name].filter(Boolean).join(" ")||"Гость BALI":"Гость BALI",updated_at:new Date().toISOString()},{onConflict:"user_key"});
  const {data:account}=await db.from("points_accounts").select("balance").eq("user_key",userKey).single();
  await db.from("points_accounts").update({balance:Number(account?.balance||0)+amount,updated_at:new Date().toISOString()}).eq("user_key",userKey);
  await db.from("points_ledger").insert({user_key:userKey,type:"referral",title,amount,action_key:actionKey});
}
async function balance(db:any,userKey:string){const{data}=await db.from("points_accounts").select("balance").eq("user_key",userKey).maybeSingle();return Number(data?.balance||0);}