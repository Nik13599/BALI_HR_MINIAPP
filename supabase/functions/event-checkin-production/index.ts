import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json, validateTelegramInitData } from "../_shared/telegram-auth.ts";

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST")return json({error:"Метод не поддерживается"},405);
  try{
    const body=await req.json().catch(()=>({}));
    const action=String(body.action||"list");
    const token=Deno.env.get("TELEGRAM_BOT_TOKEN")||"",url=Deno.env.get("SUPABASE_URL")||"",key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
    if(!token||!url||!key)throw new Error("Серверные секреты не настроены");
    const {user}=await validateTelegramInitData(String(body.init_data||""),token);
    const db=createClient(url,key),userKey=`tg:${user.id}`;
    const name=[user.first_name,user.last_name].filter(Boolean).join(" ")||"Гость BALI";
    const now=new Date().toISOString();
    await db.from("app_users").upsert({user_key:userKey,telegram_id:user.id,name,username:user.username?`@${user.username}`:"",avatar:user.photo_url||"",last_seen_at:now,updated_at:now},{onConflict:"user_key"});
    await db.from("points_accounts").upsert({user_key:userKey,telegram_id:user.id,name,telegram:user.username?`@${user.username}`:"",updated_at:now},{onConflict:"user_key"});

    if(action==="list"){
      const {data,error}=await db.from("event_checkins").select("*").eq("user_key",userKey).order("checked_in_at",{ascending:false});
      if(error)throw error;
      return json({ok:true,checkins:data||[]});
    }

    if(action==="presence"){
      const [{data:rows,error:rowsError},{data:events,error:eventsError}]=await Promise.all([
        db.from("event_checkins").select("event_id,user_key,telegram_id,checked_in_at,left_at,presence_status").is("left_at",null).neq("presence_status","left").order("checked_in_at",{ascending:false}).limit(5000),
        db.from("events").select("id,event_date,event_time,event_end_date,event_end_time,active").eq("active",true)
      ]);
      if(rowsError)throw rowsError;
      if(eventsError)throw eventsError;
      const activeIds=new Set((events||[]).filter(event=>!eventEnded(event)).map(event=>String(event.id)));
      const presence=(rows||[]).filter(row=>activeIds.has(String(row.event_id)));
      return json({ok:true,presence,total:presence.length,refreshed_at:new Date().toISOString()});
    }

    if(action==="leave"){
      const eventId=String(body.event_id||"");
      let query=db.from("event_checkins").select("*").eq("user_key",userKey).is("left_at",null).order("checked_in_at",{ascending:false}).limit(1);
      if(eventId)query=query.eq("event_id",eventId);
      const {data}=await query.maybeSingle();
      if(!data)return json({error:"Активное посещение не найдено"},404);
      const leftAt=new Date().toISOString();
      const {data:updated,error}=await db.from("event_checkins").update({left_at:leftAt,presence_status:"left",updated_at:leftAt}).eq("id",data.id).select("*").single();
      if(error)throw error;
      await updateEventHistory(db,String(data.event_id));
      return json({ok:true,row:updated});
    }

    if(action!=="checkin")return json({error:"Неизвестное действие"},400);
    const eventId=String(body.event_id||""),qrToken=String(body.qr_token||"");
    if(!eventId||!qrToken)return json({error:"QR-код неполный"},400);
    const {data:event,error:eventError}=await db.from("events").select("*").eq("id",eventId).single();
    if(eventError||!event||event.active===false)return json({error:"Мероприятие не найдено или закрыто"},404);
    if(!event.qr_token||String(event.qr_token)!==qrToken)return json({error:"QR-код недействителен"},403);
    if(eventEnded(event))return json({error:"Мероприятие уже завершено"},409);

    const {data:existing}=await db.from("event_checkins").select("*").eq("event_id",eventId).eq("user_key",userKey).maybeSingle();
    if(existing&&!existing.left_at)return json({error:"Посещение этого мероприятия уже подтверждено",duplicate:true,row:existing},409);
    if(existing&&existing.left_at){
      const reenteredAt=new Date().toISOString();
      const {data:reentered,error}=await db.from("event_checkins").update({left_at:null,presence_status:"inside",checked_in_at:reenteredAt,reentered_at:reenteredAt,updated_at:reenteredAt}).eq("id",existing.id).select("*").single();
      if(error)throw error;
      await updateEventHistory(db,eventId);
      return json({ok:true,reentered:true,row:reentered,event:{id:event.id,title:event.title,event_date:event.event_date,event_time:event.event_time},points:0,balance:await getBalance(db,userKey)});
    }

    const reward=await attendanceReward(db);
    const checkedAt=new Date().toISOString();
    const {count}=await db.from("event_checkins").select("id",{count:"exact",head:true}).eq("user_key",userKey);
    const row={
      id:`checkin-${crypto.randomUUID()}`,event_id:event.id,event_title:event.title,event_date:event.event_date,event_time:event.event_time,
      user_key:userKey,telegram_id:user.id,telegram:user.username?`@${user.username}`:"",name,checked_in_at:checkedAt,left_at:null,
      presence_status:"inside",source:"event_qr",reward,xp:250,visits:Number(count||0)+1,level:"",updated_at:checkedAt
    };
    const {data:created,error:createError}=await db.from("event_checkins").insert(row).select("*").single();
    if(createError)throw createError;
    if(reward>0)await creditOnce(db,userKey,reward,`Посещение «${event.title}»`,`event-checkin:${event.id}:${userKey}`);
    await db.from("customers").update({visits:Number(count||0)+1,updated_at:checkedAt}).eq("telegram_id",user.id);
    await updateEventHistory(db,eventId);
    return json({ok:true,row:created,event:{id:event.id,title:event.title,event_date:event.event_date,event_time:event.event_time},points:reward,balance:await getBalance(db,userKey)});
  }catch(error){
    console.error(error);
    return json({error:error instanceof Error?error.message:"Ошибка QR-входа"},500);
  }
});

async function attendanceReward(db:any){
  const {data:rules}=await db.from("loyalty_rules").select("points,action").eq("active",true).in("action",["event_checkin","attendance","qr_checkin"]).order("updated_at",{ascending:false}).limit(1);
  if(rules?.length)return Math.max(0,Number(rules[0].points||0));
  const {data:settings}=await db.from("app_settings").select("attendance_points").eq("id","main").maybeSingle();
  return Math.max(0,Number(settings?.attendance_points??100));
}

async function updateEventHistory(db:any,eventId:string){
  const {data:rows,error}=await db.from("event_checkins").select("user_key,left_at,presence_status,checked_in_at").eq("event_id",eventId);
  if(error)return;
  const unique=new Map<string,any>();
  for(const row of rows||[])unique.set(String(row.user_key||""),row);
  const visits=[...unique.values()];
  const inside=visits.filter(row=>!row.left_at&&row.presence_status!=="left").length;
  const lastScan=visits.map(row=>row.checked_in_at).filter(Boolean).sort().pop()||null;
  await db.from("event_history").upsert({event_id:eventId,total_scans:(rows||[]).length,unique_visitors:visits.length,current_inside:inside,last_scan_at:lastScan,updated_at:new Date().toISOString()},{onConflict:"event_id"});
}

function eventEnded(event:any){
  const start=String(event.event_date||"").slice(0,10),startTime=String(event.event_time||"23:00").slice(0,5),endTime=String(event.event_end_time||"06:00").slice(0,5);
  let end=String(event.event_end_date||start).slice(0,10);
  if(!event.event_end_date&&endTime<=startTime){const date=new Date(`${start}T12:00:00+03:00`);date.setUTCDate(date.getUTCDate()+1);end=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Minsk",year:"numeric",month:"2-digit",day:"2-digit"}).format(date)}
  return new Date(`${end}T${endTime}:00+03:00`).getTime()<=Date.now();
}

async function creditOnce(db:any,userKey:string,amount:number,title:string,actionKey:string){
  const {data:used}=await db.from("points_ledger").select("id").eq("user_key",userKey).eq("action_key",actionKey).maybeSingle();
  if(used)return;
  const {data:account}=await db.from("points_accounts").select("balance").eq("user_key",userKey).single();
  await db.from("points_accounts").update({balance:Number(account?.balance||0)+amount,updated_at:new Date().toISOString()}).eq("user_key",userKey);
  await db.from("points_ledger").insert({user_key:userKey,type:"attendance",title,amount,action_key:actionKey});
}

async function getBalance(db:any,userKey:string){
  const{data}=await db.from("points_accounts").select("balance").eq("user_key",userKey).single();
  return Number(data?.balance||0);
}
