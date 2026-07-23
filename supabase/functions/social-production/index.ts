import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json, validateTelegramInitData } from "../_shared/telegram-auth.ts";

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error:"Метод не поддерживается" },405);
  try {
    const body=await req.json().catch(()=>({}));
    const action=String(body.action||"list");
    const token=Deno.env.get("TELEGRAM_BOT_TOKEN")||"";
    const url=Deno.env.get("SUPABASE_URL")||"";
    const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
    if(!token||!url||!key)throw new Error("Серверные секреты не настроены");
    const {user}=await validateTelegramInitData(String(body.init_data||""),token);
    const db=createClient(url,key);
    const me=`tg:${user.id}`;
    await ensureProfile(db,me,user,body.profile||{});

    if(action==="save_profile"){
      const p=body.profile||{};
      const {error}=await db.from("social_profiles").update({
        name:String(p.name||[user.first_name,user.last_name].filter(Boolean).join(" ")||"Гость BALI"),
        username:String(p.username||(user.username?`@${user.username}`:"")),phone:String(p.phone||""),photo:String(p.photo||user.photo_url||""),
        crop_x:Number(p.cropX??50),crop_y:Number(p.cropY??40),status:String(p.status||"closed"),bio:String(p.bio||"").slice(0,180),
        active:p.active===true,gender:String(p.gender||"unspecified"),birth_date:p.birthDate||null,updated_at:new Date().toISOString()
      }).eq("user_key",me);
      if(error)throw error;
    }

    if(action==="toggle_like"){
      const target=String(body.target_user_key||"");
      if(!target||target===me)return json({error:"Профиль не выбран"},400);
      const {data:existing}=await db.from("social_likes").select("id").eq("from_user_key",me).eq("to_user_key",target).maybeSingle();
      if(existing)await db.from("social_likes").delete().eq("id",existing.id);
      else {
        const {data:targetProfile}=await db.from("social_profiles").select("user_key").eq("user_key",target).eq("active",true).neq("status","closed").maybeSingle();
        if(!targetProfile)return json({error:"Профиль недоступен"},404);
        const {error}=await db.from("social_likes").insert({from_user_key:me,to_user_key:target});if(error)throw error;
      }
      return json({ok:true,active:!existing,...await payload(db,me)});
    }

    return json({ok:true,...await payload(db,me)});
  }catch(error){console.error(error);return json({error:error instanceof Error?error.message:"Ошибка BALI People"},500)}
});

async function ensureProfile(db:any,key:string,user:any,p:any){
  const name=String(p.name||[user.first_name,user.last_name].filter(Boolean).join(" ")||"Гость BALI");
  await db.from("social_profiles").upsert({
    user_key:key,telegram_id:user.id,name,username:String(p.username||(user.username?`@${user.username}`:"")),photo:String(p.photo||user.photo_url||""),
    status:String(p.status||"closed"),bio:String(p.bio||"").slice(0,180),active:p.active===true,gender:String(p.gender||"unspecified"),
    birth_date:p.birthDate||null,updated_at:new Date().toISOString()
  },{onConflict:"user_key"});
}
async function payload(db:any,me:string){
  const [{data:profiles},{data:likes},{data:mine}]=await Promise.all([
    db.from("social_profiles").select("*").eq("active",true).neq("status","closed").order("updated_at",{ascending:false}).limit(300),
    db.from("social_likes").select("from_user_key,to_user_key,created_at").or(`from_user_key.eq.${me},to_user_key.eq.${me}`).limit(1000),
    db.from("social_profiles").select("*").eq("user_key",me).single()
  ]);
  return {profiles:profiles||[],likes:likes||[],me:mine||null};
}