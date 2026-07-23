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

    if (action === "get_profile") {
      return json(await profilePayload(db, userKey));
    }

    if (action === "buy_vip") {
      const planId = String(body.plan_id || "");
      const { data: plan, error } = await db.from("vip_plans").select("*").eq("id", planId).eq("active", true).single();
      if (error || !plan) return json({ error: "VIP-план не найден" }, 404);
      const cost = Number(plan.points_price || 0);
      if (cost <= 0) return json({ error: "Стоимость VIP не настроена" }, 409);
      const actionKey = `vip:${plan.id}:${crypto.randomUUID()}`;
      await debit(db, userKey, cost, `Покупка ${plan.name}`, actionKey);
      const days = Math.max(1, Number(body.days || plan.days || 30));
      const expires = new Date(Date.now() + days * 86400000).toISOString();
      await db.from("vip_memberships").insert({ user_key:userKey, plan_id:plan.id, plan_name:plan.name, expires_at:expires, source:"bali_points" });
      return json({ ok:true, ...(await profilePayload(db,userKey)) });
    }

    if (action === "create_chip_request") {
      const quantity = Math.max(1, Math.floor(Number(body.quantity || 0)));
      const rate = 100;
      const cost = quantity * rate;
      const requestId = `chip-request-${crypto.randomUUID()}`;
      await debit(db, userKey, cost, `Заявка на ${quantity} фиш.`, `chip-request:${requestId}`);
      const { error } = await db.from("chip_requests").insert({
        id:requestId,
        lookup_token:crypto.randomUUID(),
        user_key:userKey,
        telegram_id:user.id,
        name:[user.first_name,user.last_name].filter(Boolean).join(" ") || "Гость BALI",
        telegram:user.username ? `@${user.username}` : "",
        quantity,
        points_cost:cost,
        rate_points:rate,
        status:"pending"
      });
      if (error) {
        await creditByKey(db,userKey,user.id,cost,"Возврат за неотправленную заявку",`refund:${requestId}`,user);
        throw error;
      }
      return json({ ok:true, request_id:requestId, ...(await profilePayload(db,userKey)) });
    }

    if (action === "confirm_event_share") {
      const token = String(body.share_token || "");
      const { data: row, error } = await db.from("loyalty_share_tokens").select("*").eq("token", token).eq("kind", "event").eq("inviter_user_key", userKey).single();
      if (error || !row) return json({ error: "Репост не найден" }, 404);
      if (new Date(row.expires_at) < new Date()) return json({ error: "Срок репоста истёк" }, 409);
      if (!row.base_reward_granted_at) {
        await credit(db, userKey, user, 5, "Репост события", `event-share:${row.event_id}:${userKey}`);
        await db.from("loyalty_share_tokens").update({ share_confirmed_at:new Date().toISOString(), base_reward_granted_at:new Date().toISOString() }).eq("token", token);
      }
      return json({ ok:true, ...(await profilePayload(db,userKey)) });
    }

    if (action === "consume_start_param") {
      const start = String(body.start_param || "");
      if (!start.startsWith("share_")) return json({ ok:true, ...(await profilePayload(db,userKey)) });
      const token = start.slice(6);
      const { data: row, error } = await db.from("loyalty_share_tokens").select("*").eq("token", token).single();
      if (error || !row || new Date(row.expires_at) < new Date()) return json({ ok:true, ...(await profilePayload(db,userKey)) });
      if (String(row.inviter_user_key) === userKey) return json({ ok:true, ...(await profilePayload(db,userKey)) });
      const { data: existing } = await db.from("loyalty_conversions").select("id").eq("token", token).eq("invited_user_key", userKey).maybeSingle();
      if (existing) return json({ ok:true, ...(await profilePayload(db,userKey)) });

      let reward = 0;
      let title = "";
      if (row.kind === "referral" && !before) { reward = 10; title = "Приглашённый друг открыл BALI"; }
      if (row.kind === "event") { reward = 5; title = "Друг перешёл по репосту события"; }
      await db.from("loyalty_conversions").insert({ token:row.token, invited_user_key:userKey, invited_telegram_id:user.id, reward_amount:reward });
      if (reward > 0) await creditByKey(db, row.inviter_user_key, row.inviter_telegram_id, reward, title, `conversion:${row.token}:${userKey}`);
      return json({ ok:true, inviter_reward:reward, ...(await profilePayload(db,userKey)) });
    }

    return json({ error:"Неизвестное действие" }, 400);
  } catch (error) {
    console.error(error);
    return json({ error:error instanceof Error ? error.message : "Ошибка бонусной системы" }, 500);
  }
});

async function registerUser(db:any,userKey:string,user:any){
  const name=[user.first_name,user.last_name].filter(Boolean).join(" ")||"Гость BALI";
  await db.from("app_users").upsert({user_key:userKey,telegram_id:user.id,name,username:user.username?`@${user.username}`:"",avatar:user.photo_url||"",last_seen_at:new Date().toISOString()},{onConflict:"user_key"});
  await db.from("points_accounts").upsert({user_key:userKey,telegram_id:user.id,name,telegram:user.username?`@${user.username}`:"",updated_at:new Date().toISOString()},{onConflict:"user_key"});
}
async function profilePayload(db:any,userKey:string){
  const now=new Date().toISOString();
  const [{data:account},{data:vip},{data:plans},{data:requests}]=await Promise.all([
    db.from("points_accounts").select("*").eq("user_key",userKey).single(),
    db.from("vip_memberships").select("*").eq("user_key",userKey).gt("expires_at",now).order("expires_at",{ascending:false}).limit(1).maybeSingle(),
    db.from("vip_plans").select("*").eq("active",true).order("sort_order"),
    db.from("chip_requests").select("id,quantity,points_cost,status,created_at,fulfilled_at,cancelled_at").eq("user_key",userKey).order("created_at",{ascending:false}).limit(10)
  ]);
  return {ok:true,balance:Number(account?.balance||0),account,vip:vip||null,plans:plans||[],chip_requests:requests||[]};
}
async function debit(db:any,userKey:string,amount:number,title:string,actionKey:string){
  const {data:account,error}=await db.from("points_accounts").select("balance").eq("user_key",userKey).single();
  if(error)throw error;
  if(Number(account?.balance||0)<amount)throw new Error("Недостаточно BALI-Баллов");
  const {data:used}=await db.from("points_ledger").select("id").eq("user_key",userKey).eq("action_key",actionKey).maybeSingle();
  if(used)return;
  await db.from("points_accounts").update({balance:Number(account.balance)-amount,updated_at:new Date().toISOString()}).eq("user_key",userKey);
  await db.from("points_ledger").insert({user_key:userKey,type:"purchase",title,amount:-amount,action_key:actionKey});
}
async function credit(db:any,userKey:string,user:any,amount:number,title:string,actionKey:string){await creditByKey(db,userKey,user.id,amount,title,actionKey,user);}
async function creditByKey(db:any,userKey:string,telegramId:number,amount:number,title:string,actionKey:string,user?:any){
  const {data:used}=await db.from("points_ledger").select("id").eq("user_key",userKey).eq("action_key",actionKey).maybeSingle();
  if(used)return;
  const name=user?[user.first_name,user.last_name].filter(Boolean).join(" ")||"Гость BALI":"Гость BALI";
  await db.from("points_accounts").upsert({user_key:userKey,telegram_id:telegramId,name,updated_at:new Date().toISOString()},{onConflict:"user_key"});
  const {data:account}=await db.from("points_accounts").select("balance").eq("user_key",userKey).single();
  await db.from("points_accounts").update({balance:Number(account?.balance||0)+amount,updated_at:new Date().toISOString()}).eq("user_key",userKey);
  await db.from("points_ledger").insert({user_key:userKey,type:"referral",title,amount,action_key:actionKey});
}