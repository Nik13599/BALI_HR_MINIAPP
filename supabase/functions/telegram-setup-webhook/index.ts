import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS"
};
Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST")return respond({error:"Метод не поддерживается"},405);
  try{
    const url=Deno.env.get("SUPABASE_URL")||"",anon=Deno.env.get("SUPABASE_ANON_KEY")||"",token=Deno.env.get("TELEGRAM_BOT_TOKEN")||"",secret=Deno.env.get("TELEGRAM_WEBHOOK_SECRET")||"";
    if(!url||!anon||!token)throw new Error("Не настроены серверные секреты");
    const auth=req.headers.get("Authorization")||"";
    const client=createClient(url,anon,{global:{headers:{Authorization:auth}}});
    const {data,error}=await client.auth.getUser();
    if(error||!data.user)return respond({error:"Требуется вход администратора"},401);
    const webhookUrl=`${url.replace(/\/$/,"")}/functions/v1/telegram-webhook`;
    const webhook=await telegram(token,"setWebhook",{
      url:webhookUrl,
      secret_token:secret||undefined,
      allowed_updates:["message","edited_message"],
      drop_pending_updates:false
    });
    await telegram(token,"setMyCommands",{commands:[{command:"start",description:"Открыть BALI и написать администрации"}]});
    const info=await telegram(token,"getWebhookInfo",{});
    return respond({ok:true,webhook:webhook.result,info:info.result,url:webhookUrl});
  }catch(error){console.error(error);return respond({error:error instanceof Error?error.message:"Ошибка настройки webhook"},500)}
});
async function telegram(token:string,method:string,body:unknown){const response=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const data=await response.json();if(!response.ok||!data.ok)throw new Error(data.description||`Telegram ${method} error`);return data}
function respond(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{...corsHeaders,"Content-Type":"application/json; charset=utf-8"}})}