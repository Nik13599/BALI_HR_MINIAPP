var xa=Object.defineProperty;var D=(t,i)=>()=>(t&&(i=t(t=0)),i);var it=(t,i)=>{for(var e in i)xa(t,e,{get:i[e],enumerable:!0})};var St={};it(St,{createPool:()=>Pa,many:()=>w,one:()=>d,transaction:()=>S});import Sa from"pg";function Pa(t,i){if(!t)throw new Error("DATABASE_URL is required");let e=Number.parseInt(process.env.DB_POOL_MAX||"",10),a=Number.isFinite(i)&&Number(i)>0?Number(i):Number.isFinite(e)&&e>0?e:process.env.VERCEL?1:10;return new Sa.Pool({connectionString:t,max:a,idleTimeoutMillis:3e4,connectionTimeoutMillis:1e4,ssl:/sslmode=require/i.test(t)?{rejectUnauthorized:!1}:void 0})}async function d(t,i,e=[]){return(await t.query(i,e)).rows[0]||null}async function w(t,i,e=[]){return(await t.query(i,e)).rows}async function S(t,i){if(!t.connect)return i(t);let e=await t.connect();try{await e.query("begin");let a=await i(e);return await e.query("commit"),a}catch(a){throw await e.query("rollback"),a}finally{e.release()}}var B=D(()=>{"use strict"});function p(t){return(i,e,a)=>void t(i,e,a).catch(a)}var _,Pt,Tt,L=D(()=>{"use strict";_=class extends Error{constructor(e,a,n="request_failed",s){super(a);this.status=e;this.code=n;this.details=s}};Pt=(t,i,e)=>{e(new _(404,`Route ${t.method} ${t.path} was not found`,"not_found"))},Tt=(t,i,e,a)=>{let n=Number(t?.status||500);n>=500&&console.error(`[${i.requestId}]`,t);let s=Number(t?.details?.retryAfter);n===429&&Number.isFinite(s)&&s>0&&e.setHeader("Retry-After",String(Math.ceil(s))),e.status(n).json({error:{code:t?.code||(n>=500?"internal_error":"request_failed"),message:n>=500?"Internal server error":String(t?.message||"Request failed"),details:n>=500?void 0:t?.details,requestId:i.requestId}})}});import{createHash as Ta,createHmac as rt,randomBytes as At,scrypt as Na,timingSafeEqual as ct,webcrypto as Aa}from"node:crypto";import{Buffer as $e}from"node:buffer";import{promisify as Ka}from"node:util";function Oa(){let t=globalThis.crypto?.subtle||Aa.subtle;if(!t)throw new Error("Web Crypto API is unavailable");return t}async function Rt(t,i,e,a){let n=Oa(),s=await n.importKey("raw",Ma.encode(t),"PBKDF2",!1,["deriveBits"]),o=await n.deriveBits({name:"PBKDF2",hash:"SHA-256",salt:i,iterations:e},s,a*8);return new Uint8Array(o)}function ge(t,i){return rt("sha256",i).update(t).digest("hex")}function ie(){return At(32).toString("base64url")}function Dt(t,i,e,a=Math.floor(Date.now()/1e3)){if(!t||!i)throw new le("Telegram authentication is unavailable");let n=new URLSearchParams(t),s=n.get("hash")||"";if(n.delete("hash"),n.delete("signature"),!/^[a-f0-9]{64}$/i.test(s))throw new le("Invalid Telegram signature");let o=[...n.entries()].sort(([b],[v])=>b.localeCompare(v)).map(([b,v])=>`${b}=${v}`).join(`
`),r=rt("sha256","WebAppData").update(i).digest(),c=rt("sha256",r).update(o).digest(),u=$e.from(s,"hex");if(u.length!==c.length||!ct(u,c))throw new le("Invalid Telegram signature");let l=Number(n.get("auth_date")||0);if(!Number.isInteger(l)||l<=0)throw new le("Invalid Telegram auth date");let m=a-l;if(m<-30||m>e)throw new le("Telegram authentication expired");let y;try{y=JSON.parse(n.get("user")||"")}catch{throw new le("Invalid Telegram user payload")}if(!Number.isSafeInteger(y?.id)||y.id<=0||!String(y.first_name||"").trim())throw new le("Invalid Telegram user payload");return{user:y,authDate:l,queryId:n.get("query_id")||void 0,startParam:n.get("start_param")||void 0}}async function He(t){if(t.length<12)throw new Error("Administrator password must contain at least 12 characters");let i=At(16),e=await Rt(t,i,Nt,Da);return`${Kt}:${Nt}:${i.toString("base64url")}:${$e.from(e).toString("base64url")}`}async function Se(t,i){let e=String(i||"").split(":");if(e[0]===Kt){let o=Number(e[1]),r=e[2],c=e[3];if(!Number.isInteger(o)||o<1e5||o>2e6||!r||!c)return!1;let u=$e.from(c,"base64url");if(!u.length)return!1;let l=await Rt(t,$e.from(r,"base64url"),o,u.length),m=$e.from(l);return u.length===m.length&&ct(u,m)}let[a,n,s]=e;if(a!=="scrypt"||!n||!s)return!1;try{let o=$e.from(s,"base64url"),r=await Ra(t,$e.from(n,"base64url"),o.length);return o.length===r.length&&ct(o,r)}catch{return!1}}function Y(t){return Ta("sha256").update(t).digest("hex")}var Ra,Kt,Nt,Da,Ma,le,me=D(()=>{"use strict";Ra=Ka(Na),Kt="pbkdf2-sha256",Nt=6e5,Da=32,Ma=new TextEncoder;le=class extends Error{status=401}});function Ca(t){let e=String(t.get("authorization")||"").trim().match(/^Bearer\s+(.+)$/i);return e?String(e[1]||"").trim():""}function Mt(t,i){return String(t.cookies?.[i]||Ca(t)||"").trim()}function Ot(t,i){return p(async(e,a,n)=>{let s=Mt(e,he);if(!s)return n();let o=await d(t,`select s.id as session_id, s.app_user_key, s.last_seen_at, s.auth_method,
              coalesce(a.telegram_user_id::text, '') as telegram_user_id,
              u.name, u.username, u.account_status
         from public.user_sessions s
         join public.app_users u on u.user_key = s.app_user_key
         left join public.telegram_accounts a on a.app_user_key = s.app_user_key
        where s.token_hash = $1 and s.revoked_at is null and s.expires_at > now()
          and u.account_status = 'active' and u.blocked_at is null`,[ge(s,i.sessionSecret)]);if(o){let r=String(o.telegram_user_id||""),c=o.auth_method==="mobile"||o.auth_method==="telegram"?o.auth_method:r?"telegram":"mobile",u=!1;c==="mobile"&&(u=!!(await d(t,"select must_change_password from public.mobile_credentials where app_user_key = $1",[o.app_user_key]))?.must_change_password),e.userPrincipal={kind:"user",userKey:o.app_user_key,telegramUserId:r,sessionId:String(o.session_id),name:o.name,username:o.username,status:o.account_status,authMethod:c,mustChangePassword:u},Date.now()-new Date(o.last_seen_at).getTime()>3e5&&await t.query(`update public.user_sessions set last_seen_at = now()
            where id = $1 and last_seen_at < now() - interval '5 minutes'`,[o.session_id])}n()})}function Ct(t,i){return p(async(e,a,n)=>{let s=Mt(e,Qe);if(!s)return n();let o=await d(t,`select s.id as session_id, s.last_seen_at, a.id as admin_id, a.email, a.role, a.status
         from public.admin_sessions s
         join public.admin_users a on a.id = s.admin_user_id
        where s.token_hash = $1 and s.revoked_at is null and s.expires_at > now()
          and a.status = 'active'`,[ge(s,i.sessionSecret)]);o&&(e.adminPrincipal={kind:"admin",adminId:String(o.admin_id),sessionId:String(o.session_id),email:o.email,role:o.role,status:o.status},Date.now()-new Date(o.last_seen_at).getTime()>3e5&&await t.query(`update public.admin_sessions set last_seen_at = now()
            where id = $1 and last_seen_at < now() - interval '5 minutes'`,[o.session_id])),n()})}function Re(t,i){return{httpOnly:!0,secure:t.secureCookies,sameSite:"strict",path:"/",maxAge:i}}var he,Qe,H,X,z=D(()=>{"use strict";B();L();me();he="bali_user_session",Qe="bali_admin_session";H=(t,i,e)=>{if(!t.userPrincipal)return e(new _(401,"User session is required","authentication_required"));e()};X=(t,i,e)=>{if(!t.adminPrincipal)return e(new _(401,"Administrator session is required","admin_authentication_required"));e()}});function M(t,i=""){let e=t.userPrincipal?.userKey||t.adminPrincipal?.adminId||t.ip||"unknown";return i?`${e}:${i}`:e}async function O(t,i,e,a,n=1){let s=await d(t,`select limit_count, window_seconds, enabled
       from public.rate_limit_settings where bucket = $1`,[e]),o=Ea[e]||{limit:30,windowSeconds:60},r=Number(s?.limit_count||o.limit),c=Number(s?.window_seconds||o.windowSeconds);if(s?.enabled===!1)return;let u=Date.now(),l=c*1e3,m=Math.max(1,Math.min(1e3,Math.floor(n))),y=new Date(Math.floor(u/l)*l),b=new Date(y.getTime()+l),v=await d(t,`insert into public.rate_limit_buckets(
       bucket, subject_key, window_started_at, request_count, expires_at
     ) values ($1, $2, $3, $4, $5)
     on conflict (bucket, subject_key, window_started_at)
     do update set request_count = public.rate_limit_buckets.request_count + excluded.request_count
     returning request_count`,[e,a,y.toISOString(),m,b.toISOString()]);if(Number(v?.request_count||1)>r){let h=Math.max(1,Math.ceil((b.getTime()-u)/1e3));throw new _(429,"Too many requests","rate_limit_exceeded",{bucket:e,retryAfter:h,requestId:i.requestId})}}var Ea,ye=D(()=>{"use strict";B();L();Ea={"auth.telegram":{limit:10,windowSeconds:60},"auth.admin":{limit:8,windowSeconds:300},"message.create":{limit:20,windowSeconds:60},"message.repeat":{limit:3,windowSeconds:300},"message.mentions":{limit:8,windowSeconds:60},"message.links":{limit:5,windowSeconds:60},"poll.create":{limit:5,windowSeconds:3600},"poll.vote":{limit:30,windowSeconds:60},"event.attach":{limit:10,windowSeconds:3600},"report.create":{limit:5,windowSeconds:3600},"notification.broadcast":{limit:3,windowSeconds:3600},"connection.create":{limit:10,windowSeconds:86400},"invitation.create":{limit:20,windowSeconds:86400},"event_invitation.create":{limit:20,windowSeconds:86400},"direct_message.create":{limit:60,windowSeconds:60},"user_report.create":{limit:5,windowSeconds:86400},"gift.create":{limit:20,windowSeconds:3600},"booking.hold":{limit:10,windowSeconds:60},"game.session":{limit:30,windowSeconds:3600},"content.upload":{limit:30,windowSeconds:3600}}});function f(t,i,e,a=1){let n=String(t??"").trim();if(n.length<a||n.length>e)throw new _(400,`${i} must contain ${a}-${e} characters`,"validation_error");return n}function g(t,i){let e=String(t??"").trim();if(e.length>i)throw new _(400,`Text is longer than ${i} characters`,"validation_error");return e}function P(t,i="id"){let e=String(t||"");if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(e))throw new _(400,`${i} is invalid`,"validation_error");return e}function $(t,i="id"){let e=String(t||"").trim();if(!/^[a-zA-Z0-9:_-]{1,160}$/.test(e))throw new _(400,`${i} is invalid`,"validation_error");return e}function k(t,i,e,a){if(t==null||t==="")return i;let n=Number(t);if(!Number.isInteger(n)||n<e||n>a)throw new _(400,`Value must be an integer from ${e} to ${a}`,"validation_error");return n}function A(t,i=!1){if(t===void 0)return i;if(t===!0||t===!1)return t;throw new _(400,"Value must be a boolean","validation_error")}function K(t,i,e){let a=String(t??"").trim();if(!e.includes(a))throw new _(400,`${i} must be one of: ${e.join(", ")}`,"validation_error");return a}function Q(t,i,e,a){if(t==null||t==="")return i;let n=Number(t);if(!Number.isFinite(n)||n<e||n>a)throw new _(400,`Value must be a number from ${e} to ${a}`,"validation_error");return n}function ke(t,i,e,a,n=200){if(!Array.isArray(t))throw new _(400,`${i} must be an array`,"validation_error");let s=[...new Set(t.map(o=>f(o,i,n)))];if(s.length<e||s.length>a)throw new _(400,`${i} must contain ${e}-${a} unique values`,"validation_error");return s}function E(t){if(!t)return null;let i=new Date(String(t));if(Number.isNaN(i.getTime()))throw new _(400,"Invalid date","validation_error");return i.toISOString()}var Z=D(()=>{"use strict";L()});import{Router as Ua}from"express";function Et(t){return{ipHash:Y(String(t.ip||"")),userAgent:String(t.get("user-agent")||"").slice(0,500)}}function Ut(t,i){let e=Ua();return e.post("/telegram",p(async(a,n)=>{await O(t,a,"auth.telegram",M(a));let s;try{s=Dt(String(a.body?.initData||""),i.telegramBotToken,i.telegramAuthMaxAgeSeconds)}catch(h){throw h instanceof le?new _(401,h.message,"telegram_auth_failed"):h}let o=s.user,r=`tg:${o.id}`,c=`${o.first_name||""} ${o.last_name||""}`.trim()||"\u0413\u043E\u0441\u0442\u044C BALI",u=await d(t,"select app_user_key from public.telegram_accounts where telegram_user_id = $1",[o.id]);if(!u){let h=await d(t,`select user_key
           from public.app_users
          where telegram_id = $1 and user_key <> $2
          limit 1`,[String(o.id),r]);if(h)throw await t.query(`insert into public.data_merge_review(
             entity_type, legacy_id, candidate_user_key, reason, payload
           ) values ('telegram_identity',$1,$2,$3,$4::jsonb)
           on conflict (entity_type, legacy_id) do update
             set candidate_user_key = excluded.candidate_user_key,
                 reason = excluded.reason,
                 payload = excluded.payload,
                 status = case
                   when data_merge_review.status = 'linked' then data_merge_review.status
                   else 'pending'
                 end`,[String(o.id),h.user_key,"Legacy Telegram ID requires administrator review before account binding",JSON.stringify({signedTelegramUser:o,canonicalUserKey:r})]),new _(409,"Account binding requires administrator review","identity_merge_review_required")}let l=u?.app_user_key||r,m=ie(),y=new Date(Date.now()+i.sessionTtlSeconds*1e3),b=Et(a),v=await S(t,async h=>{let j=await d(h,`insert into public.app_users(
           user_key, telegram_id, name, username, avatar,
           first_seen_at, last_seen_at, opens, account_status, updated_at
         ) values ($1,$2,$3,$4,$5,now(),now(),1,'active',now())
         on conflict (user_key) do update set
           telegram_id = excluded.telegram_id,
           name = excluded.name,
           username = excluded.username,
           avatar = excluded.avatar,
           last_seen_at = now(),
           opens = public.app_users.opens + 1,
           updated_at = now()
         returning user_key, name, username, avatar, account_status, blocked_at`,[l,String(o.id),c,o.username||"",o.photo_url||""]);if(!j||j.account_status!=="active"||j.blocked_at)throw new _(403,"BALI account is blocked","account_blocked");if(await h.query(`insert into public.telegram_accounts(
           app_user_key, telegram_user_id, username, first_name, last_name,
           language_code, photo_url, is_premium, first_verified_at, last_verified_at
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,now(),now())
         on conflict (telegram_user_id) do update set
           username = excluded.username,
           first_name = excluded.first_name,
           last_name = excluded.last_name,
           language_code = excluded.language_code,
           photo_url = excluded.photo_url,
           is_premium = excluded.is_premium,
           last_verified_at = now(),
           updated_at = now()`,[l,o.id,o.username||"",o.first_name,o.last_name||"",o.language_code||"",o.photo_url||"",!!o.is_premium]),await h.query(`insert into public.user_profiles(
           user_key, display_name, avatar_url, phone
         ) values ($1,$2,$3,'')
         on conflict (user_key) do nothing`,[l,c,o.photo_url||""]),await h.query(`insert into public.user_consents(user_key)
         values ($1)
         on conflict (user_key) do nothing`,[l]),await h.query(`insert into public.crm_customers(
           user_key, first_name, last_name, last_activity_at, app_opens
         ) values ($1,$2,$3,now(),1)
         on conflict (user_key) do update
           set first_name = excluded.first_name,
               last_name = excluded.last_name,
               last_activity_at = now(),
               app_opens = public.crm_customers.app_opens + 1,
               updated_at = now()`,[l,o.first_name,o.last_name||""]),await h.query(`insert into public.point_accounts(user_key)
         values ($1)
         on conflict (user_key) do nothing`,[l]),await h.query(`insert into public.game_profiles(user_key)
         values ($1)
         on conflict (user_key) do nothing`,[l]),await h.query(`insert into public.notification_preferences(user_key)
         values ($1)
         on conflict (user_key) do nothing`,[l]),!u){let N=`registration:${l}`;if(await d(h,`insert into public.idempotency_records(
             scope, idempotency_key, actor_key, completed_at
           ) values ('points',$1,$2,now())
           on conflict (scope, idempotency_key) do nothing
           returning idempotency_key`,[N,l])){let x=await d(h,`select registration_points as amount
               from public.economy_settings
              where singleton = true`),R=Number(x?.amount||0),J=await d(h,`select balance from public.point_accounts
              where user_key = $1 for update`,[l]),U=Number(J?.balance||0),C=U+R;await h.query(`update public.point_accounts
                set balance = $2,
                    lifetime_earned = lifetime_earned + $3,
                    version = version + 1,
                    updated_at = now()
              where user_key = $1`,[l,C,R]),R>0&&await h.query(`insert into public.point_ledger(
                 user_key, amount, balance_before, balance_after,
                 operation_type, source_type, source_id, reason, idempotency_key
               ) values ($1,$2,$3,$4,'credit','registration',$1,$5,$6)
               on conflict (idempotency_key) do nothing`,[l,R,U,C,"\u041D\u0430\u0447\u0438\u0441\u043B\u0435\u043D\u0438\u0435 \u0437\u0430 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044E",N])}}return await h.query(`insert into public.user_sessions(
           app_user_key, token_hash, telegram_auth_date, expires_at, ip_hash, user_agent
         ) values ($1,$2,$3,$4,$5,$6)`,[l,ge(m,i.sessionSecret),new Date(s.authDate*1e3).toISOString(),y.toISOString(),b.ipHash,b.userAgent]),await h.query(`insert into public.analytics_events(
           user_key, event_name, source, entity_type, entity_id, properties
         ) values ($1,'app_open','telegram','user',$1,$2::jsonb)`,[l,JSON.stringify({firstOpen:!u})]),j});n.cookie(he,m,Re(i,i.sessionTtlSeconds*1e3)),n.status(201).json({user:{id:v.user_key,name:v.name,username:v.username,avatar:v.avatar},environment:i.environment,expiresAt:y.toISOString()})})),e.get("/session",H,p(async(a,n)=>{n.json({user:{id:a.userPrincipal.userKey,name:a.userPrincipal.name,username:a.userPrincipal.username},environment:i.environment})})),e.post("/logout",H,p(async(a,n)=>{await t.query("update public.user_sessions set revoked_at = now() where id = $1",[a.userPrincipal.sessionId]),n.clearCookie(he,{path:"/"}),n.status(204).end()})),e.post("/admin/login",p(async(a,n)=>{await O(t,a,"auth.admin",M(a));let s=f(a.body?.email,"email",320).toLowerCase(),o=f(a.body?.password,"password",1e3),r=await d(t,"select id, email, password_hash, role, status from public.admin_users where email = $1",[s]);if(!r||r.status!=="active"||!await Se(o,r.password_hash))throw new _(401,"Invalid administrator credentials","admin_login_failed");let c=ie(),u=new Date(Date.now()+720*60*1e3),l=Et(a);await t.query(`insert into public.admin_sessions(
         admin_user_id, token_hash, expires_at, ip_hash, user_agent
       ) values ($1,$2,$3,$4,$5)`,[r.id,ge(c,i.sessionSecret),u.toISOString(),l.ipHash,l.userAgent]),n.cookie(Qe,c,Re(i,720*60*1e3)),n.json({admin:{id:r.id,email:r.email,role:r.role},expiresAt:u,accessToken:c,tokenType:"Bearer"})})),e.get("/admin/session",X,p(async(a,n)=>{n.json({admin:a.adminPrincipal})})),e.post("/admin/logout",X,p(async(a,n)=>{await t.query("update public.admin_sessions set revoked_at = now() where id = $1",[a.adminPrincipal.sessionId]),n.clearCookie(Qe,{path:"/"}),n.status(204).end()})),e}var Bt=D(()=>{"use strict";B();L();z();ye();me();Z()});import{Router as Ba}from"express";function ut(t){let e=f(t,"phone",40).replace(/\D/g,"");if(e.length<9||e.length>15)throw new _(400,"\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 \u043D\u043E\u043C\u0435\u0440 \u0442\u0435\u043B\u0435\u0444\u043E\u043D\u0430","invalid_phone");return`+${e}`}function Lt(t){let i=f(t,"telegramUsername",64).replace(/^@+/,"");if(!/^[A-Za-z0-9_]{5,32}$/.test(i))throw new _(400,"\u0412\u0432\u0435\u0434\u0438\u0442\u0435 Telegram username \u0432 \u0444\u043E\u0440\u043C\u0430\u0442\u0435 @username","invalid_telegram_username");return i}function La(t){return{ipHash:Y(String(t.ip||"")),userAgent:String(t.get("user-agent")||"").slice(0,500)}}async function Ha(t,i,e,a,n){let s=ie(),o=new Date(Date.now()+i.sessionTtlSeconds*1e3),r=La(e);return await t.query(`insert into public.user_sessions(
       app_user_key, token_hash, telegram_auth_date, expires_at, ip_hash, user_agent, auth_method
     ) values ($1,$2,now(),$3,$4,$5,'mobile')`,[n.user_key,ge(s,i.sessionSecret),o.toISOString(),r.ipHash,r.userAgent]),a.cookie(he,s,Re(i,i.sessionTtlSeconds*1e3)),{expiresAt:o,sessionToken:s}}function Ht(t,i){let e=Ba();return e.get("/mobile/session",H,p(async(a,n)=>{n.json({user:{id:a.userPrincipal.userKey,name:a.userPrincipal.name,username:a.userPrincipal.username},authMethod:a.userPrincipal.authMethod,mustChangePassword:a.userPrincipal.mustChangePassword})})),e.post("/mobile/register-request",p(async(a,n)=>{await O(t,a,"auth.mobile_request",M(a));let s=ut(a.body?.phone),o=Lt(a.body?.telegramUsername),r=f(a.body?.displayName,"displayName",120,2);if(await d(t,"select app_user_key from public.mobile_credentials where phone = $1",[s]))throw new _(409,"\u0410\u043A\u043A\u0430\u0443\u043D\u0442 \u0441 \u044D\u0442\u0438\u043C \u043D\u043E\u043C\u0435\u0440\u043E\u043C \u0443\u0436\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442","account_exists");let u=await d(t,`insert into public.mobile_access_requests(
         request_type, phone, telegram_username, display_name, status
       ) values ('registration',$1,$2,$3,'pending')
       on conflict (phone, request_type) where status = 'pending'
       do update set telegram_username = excluded.telegram_username,
                     display_name = excluded.display_name,
                     requested_at = now(),
                     updated_at = now()
       returning id, status, requested_at`,[s,o,r]);n.status(202).json({request:u,message:"\u0417\u0430\u044F\u0432\u043A\u0430 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0430 \u0430\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u0443"})})),e.post("/mobile/reset-request",p(async(a,n)=>{await O(t,a,"auth.mobile_reset",M(a));let s=ut(a.body?.phone),o=Lt(a.body?.telegramUsername),r=await d(t,`select app_user_key from public.mobile_credentials
        where phone = $1 and lower(telegram_username) = lower($2)`,[s,o]);r&&await t.query(`insert into public.mobile_access_requests(
           request_type, phone, telegram_username, app_user_key, status
         ) values ('reset',$1,$2,$3,'pending')
         on conflict (phone, request_type) where status = 'pending'
         do update set telegram_username = excluded.telegram_username,
                       app_user_key = excluded.app_user_key,
                       requested_at = now(),
                       updated_at = now()`,[s,o,r.app_user_key]),n.status(202).json({message:"\u0415\u0441\u043B\u0438 \u0434\u0430\u043D\u043D\u044B\u0435 \u0441\u043E\u0432\u043F\u0430\u043B\u0438, \u0430\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440 \u043F\u043E\u043B\u0443\u0447\u0438\u043B \u0437\u0430\u043F\u0440\u043E\u0441 \u043D\u0430 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435"})})),e.post("/mobile/login",p(async(a,n)=>{await O(t,a,"auth.mobile_login",M(a));let s=ut(a.body?.phone),o=f(a.body?.password,"password",256),r=await d(t,`select c.app_user_key, c.password_hash, c.must_change_password, c.locked_until,
              u.user_key, u.name, u.username, u.avatar, u.account_status, u.blocked_at
         from public.mobile_credentials c
         join public.app_users u on u.user_key = c.app_user_key
        where c.phone = $1`,[s]);if(!r||r.account_status!=="active"||r.blocked_at)throw new _(401,"\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u043D\u043E\u043C\u0435\u0440 \u0442\u0435\u043B\u0435\u0444\u043E\u043D\u0430 \u0438\u043B\u0438 \u043F\u0430\u0440\u043E\u043B\u044C","mobile_login_failed");if(r.locked_until&&new Date(r.locked_until).getTime()>Date.now())throw new _(429,"\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u043C\u043D\u043E\u0433\u043E \u043F\u043E\u043F\u044B\u0442\u043E\u043A. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u043F\u043E\u0437\u0436\u0435","mobile_login_locked");if(!await Se(o,r.password_hash))throw await t.query(`update public.mobile_credentials
            set failed_login_count = failed_login_count + 1,
                locked_until = case when failed_login_count + 1 >= 8 then now() + interval '15 minutes' else locked_until end
          where app_user_key = $1`,[r.app_user_key]),new _(401,"\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u043D\u043E\u043C\u0435\u0440 \u0442\u0435\u043B\u0435\u0444\u043E\u043D\u0430 \u0438\u043B\u0438 \u043F\u0430\u0440\u043E\u043B\u044C","mobile_login_failed");await t.query(`update public.mobile_credentials
          set failed_login_count = 0, locked_until = null, last_login_at = now()
        where app_user_key = $1`,[r.app_user_key]),await t.query(`update public.app_users set last_seen_at = now(), opens = opens + 1, updated_at = now()
        where user_key = $1`,[r.app_user_key]);let{expiresAt:c,sessionToken:u}=await Ha(t,i,a,n,r);await t.query(`insert into public.analytics_events(user_key, event_name, source, entity_type, entity_id, properties)
       values ($1,'app_open','mobile','user',$1,$2::jsonb)`,[r.app_user_key,JSON.stringify({authMethod:"mobile"})]),n.json({user:{id:r.user_key,name:r.name,username:r.username,avatar:r.avatar},mustChangePassword:!!r.must_change_password,expiresAt:c.toISOString(),accessToken:u,tokenType:"Bearer"})})),e.post("/mobile/change-password",H,p(async(a,n)=>{await O(t,a,"auth.mobile_password",M(a));let s=f(a.body?.currentPassword,"currentPassword",256),o=f(a.body?.newPassword,"newPassword",128,12),r=await d(t,"select password_hash from public.mobile_credentials where app_user_key = $1",[a.userPrincipal.userKey]);if(!r||!await Se(s,r.password_hash))throw new _(401,"\u0422\u0435\u043A\u0443\u0449\u0438\u0439 \u043F\u0430\u0440\u043E\u043B\u044C \u0432\u0432\u0435\u0434\u0451\u043D \u043D\u0435\u0432\u0435\u0440\u043D\u043E","current_password_invalid");if(await Se(o,r.password_hash))throw new _(400,"\u041D\u043E\u0432\u044B\u0439 \u043F\u0430\u0440\u043E\u043B\u044C \u0434\u043E\u043B\u0436\u0435\u043D \u043E\u0442\u043B\u0438\u0447\u0430\u0442\u044C\u0441\u044F \u043E\u0442 \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E\u0433\u043E","password_not_changed");let c=await He(o);await t.query(`update public.mobile_credentials
          set password_hash = $2,
              must_change_password = false,
              password_changed_at = now(),
              failed_login_count = 0,
              locked_until = null
        where app_user_key = $1`,[a.userPrincipal.userKey,c]),await t.query(`update public.mobile_access_requests
          set status = 'completed', completed_at = now(), updated_at = now()
        where app_user_key = $1 and status = 'issued'`,[a.userPrincipal.userKey]),await t.query(`update public.user_sessions set revoked_at = now()
        where app_user_key = $1 and id <> $2 and revoked_at is null`,[a.userPrincipal.userKey,a.userPrincipal.sessionId]),n.json({ok:!0,mustChangePassword:!1})})),e}var Qt=D(()=>{"use strict";B();L();z();ye();me();Z()});async function Ie(t,i,e,a){let n=await d(t,`select
       m.id as membership_id, m.user_key, m.role, m.status as membership_status,
       c.id as clan_id, c.name as clan_name, c.clan_type, c.status as clan_status, c.leader_user_key,
       ch.id as chat_id, ch.enabled, ch.read_only, ch.own_delete_window_seconds, ch.settings
     from public.clan_memberships m
     join public.clans c on c.id = m.clan_id
     join public.clan_chats ch on ch.clan_id = c.id
     where m.clan_id = $1 and m.user_key = $2`,[e,i.userKey]);if(!n||n.membership_status!=="active"||n.clan_status!=="active")return{allowed:!1,source:"none"};let s=await d(t,`select * from public.clan_chat_restrictions
      where chat_id = $1 and user_key = $2 and revoked_at is null
        and (expires_at is null or expires_at > now())
      order by created_at desc limit 1`,[n.chat_id,i.userKey]),o=await d(t,`select effect from public.clan_chat_permission_grants
      where clan_id = $1 and user_key = $2 and permission_key = $3
        and revoked_at is null and (expires_at is null or expires_at > now())
      order by created_at desc limit 1`,[e,i.userKey,a]),r={membership:n,chat:n,restriction:s};return o?.effect==="deny"?{...r,allowed:!1,source:"denied"}:!n.enabled&&a!=="chat.read"&&a!=="message.read"?{...r,allowed:!1,source:"denied"}:zt.has(a)&&(n.read_only||s?.can_write===!1)?{...r,allowed:!1,source:"denied"}:(n.leader_user_key===i.userKey||n.role==="leader")&&Jt.has(a)?{...r,allowed:!0,source:"leader"}:o?.effect==="allow"?{...r,allowed:!0,source:"grant"}:dt.has(a)?{...r,allowed:!0,source:"member"}:{...r,allowed:!1,source:"none"}}function G(t,i){return p(async(e,a,n)=>{if(!e.userPrincipal)throw new _(401,"User session is required","authentication_required");let s=String(e.params.clanId||"");if(!s)throw new _(400,"Clan id is required","validation_error");let o=await Ie(t,e.userPrincipal,s,i);if(e.permissionDecision=o,!o.allowed)throw new _(403,"The requested clan action is not permitted","permission_denied",{permission:i});n()})}function ne(t){return t?.source==="leader"?"leader":t?.source==="grant"?"delegate":"user"}async function Vt(t,i,e){let a=await d(t,`select m.role, m.status as membership_status, c.status as clan_status,
            c.leader_user_key, ch.enabled, ch.read_only
       from public.clan_memberships m
       join public.clans c on c.id = m.clan_id
       join public.clan_chats ch on ch.clan_id = c.id
      where m.clan_id = $1 and m.user_key = $2`,[e,i.userKey]);if(!a||a.membership_status!=="active"||a.clan_status!=="active")return[];let n=(await t.query(`select permission_key, effect
       from public.clan_chat_permission_grants
      where clan_id = $1 and user_key = $2 and revoked_at is null
        and (expires_at is null or expires_at > now())
      order by created_at asc`,[e,i.userKey])).rows,s=new Set(a.leader_user_key===i.userKey||a.role==="leader"?Jt:dt);for(let o of n)o.effect==="deny"?s.delete(o.permission_key):s.add(o.permission_key);if(!a.enabled)for(let o of[...s])["chat.read","message.read"].includes(o)||s.delete(o);if(a.read_only)for(let o of zt)s.delete(o);return[...s].sort()}var dt,Jt,zt,Gt=D(()=>{"use strict";B();L();dt=new Set(["chat.read","chat.write","chat.reply","message.read","message.create","message.reply","message.delete_own","poll.read","poll.vote","event.read","report.create"]),Jt=new Set([...dt,"chat.enable","chat.disable","chat.set_read_only","chat.settings.update","message.delete_any","message.pin","poll.create","poll.finish","poll.cancel","poll.delete","poll.pin","event.attach","event.detach","event.set_primary","event.link_poll","event.pin","announcement.create","notification.broadcast","member.restrict_chat","member.unrestrict_chat","audit.read"]),zt=new Set(["chat.write","chat.reply","message.create","message.reply"])});async function ee(t,i,e){let a=e.chatId||i.permissionDecision?.chat?.chat_id||null;!a&&e.clanId&&(a=(await d(t,"select id from public.clan_chats where clan_id = $1",[e.clanId]))?.id||null);let n=i.userPrincipal?.userKey||(["user","leader","delegate"].includes(e.actorType)?e.actorId:null);await t.query(`insert into public.clan_chat_audit_log(
       actor_type, actor_id, actor_telegram_id, actor_user_key,
       permission_key, action, target_type, target_id, clan_id, chat_id,
       request_id, reason, before_value, after_value, metadata
     ) values (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15::jsonb
     )`,[e.actorType,e.actorId,i.userPrincipal?.telegramUserId||null,n,e.permissionKey||"",e.action,e.targetType,e.targetId,e.clanId||null,a,i.requestId,e.reason||"",e.before===void 0?null:JSON.stringify(e.before),e.after===void 0?null:JSON.stringify(e.after),JSON.stringify(e.metadata||{})])}async function T(t,i,e){await t.query(`insert into public.admin_audit_log(
       admin_user_id, actor_email, action, target_type, target_id,
       request_id, reason, before_value, after_value, ip_hash, user_agent
     ) values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11)`,[i.adminPrincipal.adminId,i.adminPrincipal.email,e.action,e.targetType,e.targetId||"",i.requestId,e.reason||"",e.before===void 0?null:JSON.stringify(e.before),e.after===void 0?null:JSON.stringify(e.after),Y(String(i.ip||"")),String(i.get("user-agent")||"").slice(0,500)])}var ve=D(()=>{"use strict";B();me()});function Wt(t,i){let e=["avatar","status","clan"].includes(i)?"public":i==="events"?"clan":"private",a=String(t?.[i]||e);return lt.has(a)?a:"private"}async function _t(t,i,e){let a=await d(t,`select user_row.user_key,
            case when profile.display_name is not null and profile.display_name <> ''
              then profile.display_name else user_row.name end as name,
            user_row.username,
            case when profile.phone is not null and profile.phone <> ''
              then profile.phone else user_row.phone end as phone,
            case when profile.avatar_url is not null and profile.avatar_url <> ''
              then profile.avatar_url else user_row.avatar end as avatar,
            coalesce(profile.birth_date, user_row.birth_date) as birth_date,
            user_row.profile_privacy,
            user_row.account_status,
            profile.status_text,
            profile.bio,
            profile.interests,
            profile.gender,
            coalesce(profile.discoverable, true) as discoverable,
            coalesce(profile.allow_connections, true) as allow_connections,
            coalesce(profile.allow_event_invites, true) as allow_event_invites,
            coalesce(profile.allow_gifts, true) as allow_gifts
       from public.app_users user_row
       left join public.user_profiles profile on profile.user_key = user_row.user_key
      where user_row.user_key = $1 and user_row.account_status = 'active'`,[e]);if(!a)throw new _(404,"BALI profile was not found","not_found");let n=i===e;if(!(n?a:await d(t,`select user_key from public.app_users
      where user_key = $1 and account_status = 'active'`,[i])))throw new _(401,"Viewer account is unavailable","authentication_required");let[o,r]=i<e?[i,e]:[e,i],c=n?!0:!!await d(t,`select 1
       from public.clan_memberships mine
       join public.clan_memberships theirs on theirs.clan_id = mine.clan_id
      where mine.user_key = $1 and theirs.user_key = $2
        and mine.status = 'active' and theirs.status = 'active'
      limit 1`,[i,e]),u=n?!0:!!await d(t,`select 1
       from public.user_connections connection
      where connection.pair_low = $1
        and connection.pair_high = $2
        and connection.status = 'accepted'
      limit 1`,[o,r]);if(n?!1:!!await d(t,`select 1
       from public.user_blocks block
      where (block.blocker_user_key = $1 and block.blocked_user_key = $2)
         or (block.blocker_user_key = $2 and block.blocked_user_key = $1)
      limit 1`,[i,e]))throw new _(404,"BALI profile was not found","not_found");if(!a.discoverable&&!n&&!c&&!u)throw new _(404,"BALI profile was not found","not_found");let m=b=>{if(n)return!0;let v=Wt(a.profile_privacy,b);return v==="public"?!0:v==="clan"?c:!1},y={id:a.user_key,name:a.name,bio:a.bio||"",interests:a.interests||[],gender:a.gender||"unspecified",actions:{canConnect:!n&&!!a.allow_connections,canInvite:!n&&!!a.allow_event_invites,canGift:!n&&!!a.allow_gifts},privacy:n?a.profile_privacy:void 0};return m("avatar")&&a.avatar&&(y.avatar=a.avatar),m("username")&&a.username&&(y.username=a.username),m("phone")&&a.phone&&(y.phone=a.phone),m("birth_date")&&a.birth_date&&(y.birthDate=a.birth_date),m("status")&&a.status_text&&(y.status=a.status_text),m("clan")&&(y.clans=await(async()=>(await t.query(`select clan.id, clan.name, clan.clan_type,
                profile.logo_url, profile.description
           from public.clan_memberships membership
           join public.clans clan on clan.id = membership.clan_id
           left join public.clan_profiles profile on profile.clan_id = clan.id
          where membership.user_key = $1
            and membership.status = 'active'
            and clan.status = 'active'
          order by clan.clan_type`,[e])).rows)()),m("events")&&(y.upcomingEvent=await d(t,`select event.id, event.title, event.event_date, event.event_time,
              attendance.status
         from public.event_attendance attendance
         join public.events event on event.id = attendance.event_id
         left join public.event_runtime runtime on runtime.event_id = event.id
        where attendance.user_key = $1
          and attendance.status in ('going', 'maybe')
          and coalesce(runtime.status, 'published') in ('published', 'active')
          and coalesce(runtime.ends_at, runtime.starts_at, event.event_date::timestamptz) > now()
        order by coalesce(runtime.starts_at, event.event_date::timestamptz)
        limit 1`,[e])),y}async function Je(t,i,e){let a=[...new Set(e)].filter(Boolean).slice(0,100);if(!a.length)return[];if(!await d(t,`select user_key from public.app_users
      where user_key = $1 and account_status = 'active'`,[i]))throw new _(401,"Viewer account is unavailable","authentication_required");let[s,o,r,c,u,l]=await Promise.all([w(t,`select user_row.user_key,
              case when profile.display_name is not null and profile.display_name <> ''
                then profile.display_name else user_row.name end as name,
              user_row.username,
              case when profile.phone is not null and profile.phone <> ''
                then profile.phone else user_row.phone end as phone,
              case when profile.avatar_url is not null and profile.avatar_url <> ''
                then profile.avatar_url else user_row.avatar end as avatar,
              coalesce(profile.birth_date, user_row.birth_date) as birth_date,
              user_row.profile_privacy, profile.status_text, profile.bio,
              profile.interests, profile.gender,
              coalesce(profile.discoverable, true) as discoverable,
              coalesce(profile.allow_connections, true) as allow_connections,
              coalesce(profile.allow_event_invites, true) as allow_event_invites,
              coalesce(profile.allow_gifts, true) as allow_gifts
         from public.app_users user_row
         left join public.user_profiles profile on profile.user_key = user_row.user_key
        where user_row.user_key = any($1::text[])
          and user_row.account_status = 'active'`,[a]),w(t,`select distinct theirs.user_key as target_user_key
         from public.clan_memberships mine
         join public.clan_memberships theirs on theirs.clan_id = mine.clan_id
        where mine.user_key = $1
          and theirs.user_key = any($2::text[])
          and mine.status = 'active' and theirs.status = 'active'`,[i,a]),w(t,`select case
                when requester_user_key = $1 then recipient_user_key
                else requester_user_key
              end as target_user_key
         from public.user_connections
        where status = 'accepted'
          and (requester_user_key = $1 or recipient_user_key = $1)
          and (requester_user_key = any($2::text[]) or recipient_user_key = any($2::text[]))`,[i,a]),w(t,`select case
                when blocker_user_key = $1 then blocked_user_key
                else blocker_user_key
              end as target_user_key
         from public.user_blocks
        where (blocker_user_key = $1 and blocked_user_key = any($2::text[]))
           or (blocked_user_key = $1 and blocker_user_key = any($2::text[]))`,[i,a]),w(t,`select membership.user_key as target_user_key,
              clan.id, clan.name, clan.clan_type,
              profile.logo_url, profile.description
         from public.clan_memberships membership
         join public.clans clan on clan.id = membership.clan_id
         left join public.clan_profiles profile on profile.clan_id = clan.id
        where membership.user_key = any($1::text[])
          and membership.status = 'active' and clan.status = 'active'
        order by membership.user_key, clan.clan_type`,[a]),w(t,`select distinct on (attendance.user_key)
              attendance.user_key as target_user_key,
              event.id, event.title, event.event_date, event.event_time,
              attendance.status
         from public.event_attendance attendance
         join public.events event on event.id = attendance.event_id
         left join public.event_runtime runtime on runtime.event_id = event.id
        where attendance.user_key = any($1::text[])
          and attendance.status in ('going', 'maybe')
          and coalesce(runtime.status, 'published') in ('published', 'active')
          and coalesce(runtime.ends_at, runtime.starts_at, event.event_date::timestamptz) > now()
        order by attendance.user_key,
                 coalesce(runtime.starts_at, event.event_date::timestamptz)`,[a])]),m=new Set(o.map(I=>I.target_user_key)),y=new Set(r.map(I=>I.target_user_key)),b=new Set(c.map(I=>I.target_user_key)),v=new Map;for(let I of u){let x=v.get(I.target_user_key)||[];x.push({id:I.id,name:I.name,clan_type:I.clan_type,logo_url:I.logo_url,description:I.description}),v.set(I.target_user_key,x)}let h=new Map(l.map(I=>[I.target_user_key,{id:I.id,title:I.title,event_date:I.event_date,event_time:I.event_time,status:I.status}])),j=new Map(s.map(I=>[I.user_key,I])),N=[];for(let I of a){let x=j.get(I);if(!x||b.has(I))continue;let R=m.has(I);if(!x.discoverable&&!R&&!y.has(I))continue;let J=C=>{let W=Wt(x.profile_privacy,C);return W==="public"||W==="clan"&&R},U={id:x.user_key,user_key:x.user_key,name:x.name,bio:x.bio||"",interests:x.interests||[],gender:x.gender||"unspecified",actions:{canConnect:!!x.allow_connections,canInvite:!!x.allow_event_invites,canGift:!!x.allow_gifts}};J("avatar")&&x.avatar&&(U.avatar=x.avatar),J("username")&&x.username&&(U.username=x.username),J("phone")&&x.phone&&(U.phone=x.phone),J("birth_date")&&x.birth_date&&(U.birthDate=x.birth_date),J("status")&&x.status_text&&(U.status=x.status_text),J("clan")&&(U.clans=v.get(I)||[]),J("events")&&(U.upcomingEvent=h.get(I)||null),N.push(U)}return N}var lt,Ft,pt=D(()=>{"use strict";B();L();lt=new Set(["public","clan","private"]),Ft=["avatar","username","phone","birth_date","status","events","clan"]});import{Router as Qa}from"express";function F(t){let i=t.permissionDecision?.chat?.chat_id;if(!i)throw new _(403,"Clan chat is unavailable","chat_unavailable");return String(i)}function Ja(t){return t.deleted_at?t.deleted_by_type==="admin"?"\u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u0443\u0434\u0430\u043B\u0435\u043D\u043E \u0430\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u043E\u043C BALI":["leader","delegate"].includes(t.deleted_by_type)?"\u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u0443\u0434\u0430\u043B\u0435\u043D\u043E \u0440\u0443\u043A\u043E\u0432\u043E\u0434\u0438\u0442\u0435\u043B\u0435\u043C \u043A\u043B\u0430\u043D\u0430":"\u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u0443\u0434\u0430\u043B\u0435\u043D\u043E \u0430\u0432\u0442\u043E\u0440\u043E\u043C":t.body}function Zt(t){return{id:t.id,body:Ja(t),messageType:t.message_type,author:t.author_user_key?{id:t.author_user_key,name:t.author_name||"\u0423\u0447\u0430\u0441\u0442\u043D\u0438\u043A BALI"}:null,reply:t.reply_to_message_id?{id:t.reply_to_message_id,body:t.reply_deleted_at?"\u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u0443\u0434\u0430\u043B\u0435\u043D\u043E":t.reply_body,authorName:t.reply_author_name||"\u0423\u0447\u0430\u0441\u0442\u043D\u0438\u043A BALI"}:null,deleted:!!t.deleted_at,createdAt:t.created_at,updatedAt:t.updated_at}}async function Yt(t,i,e,a){return(await w(t,`select m.*, u.name as author_name,
            parent.body as reply_body, parent.deleted_at as reply_deleted_at,
            parent_user.name as reply_author_name
       from public.clan_chat_messages m
       left join public.app_users u on u.user_key = m.author_user_key
       left join public.clan_chat_messages parent on parent.id = m.reply_to_message_id
       left join public.app_users parent_user on parent_user.user_key = parent.author_user_key
      where m.chat_id = $1
        and ($2::timestamptz is null or m.created_at < $2::timestamptz)
      order by m.created_at desc, m.id desc
      limit $3`,[i,e,a])).reverse().map(Zt)}async function za(t,i,e){let a=await w(t,`select * from public.clan_chat_polls
      where chat_id = $1 and status <> 'deleted'
      order by created_at desc limit 30`,[i]);if(!a.length)return[];let n=[];for(let s of a){let o=await w(t,`select o.id, o.label, o.sort_order, count(v.id)::integer as votes
         from public.clan_chat_poll_options o
         left join public.clan_chat_poll_votes v on v.option_id = o.id
        where o.poll_id = $1
        group by o.id, o.label, o.sort_order
        order by o.sort_order`,[s.id]),r=await w(t,`select option_id from public.clan_chat_poll_votes
        where poll_id = $1 and voter_user_key = $2`,[s.id,e]);n.push({...s,options:o,myOptionIds:r.map(c=>c.option_id),responseCreatesCheckin:!1})}return n}async function Va(t,i,e,a){let s={message:"clan_chat_messages",poll:"clan_chat_polls",event:"clan_chat_events",announcement:"clan_chat_announcements"}[i];if(!s)throw new _(400,"Unsupported pin target","validation_error");if(!await d(t,`select id from public.${s} where id = $1 and chat_id = $2`,[e,a]))throw new _(404,"Pin target was not found","not_found")}function Xt(t){let i=Qa();i.use(H),i.get("/",p(async(e,a)=>{let n=await w(t,`select c.id, c.name, c.clan_type, m.role, ch.id as chat_id, ch.enabled, ch.read_only
         from public.clan_memberships m
         join public.clans c on c.id = m.clan_id and c.status = 'active'
         join public.clan_chats ch on ch.clan_id = c.id
        where m.user_key = $1 and m.status = 'active'
        order by c.name`,[e.userPrincipal.userKey]),s=n.length?await w(t,`select message.chat_id, count(*)::integer as unread_count
             from public.clan_chat_messages message
             left join public.clan_chat_read_states read_state
               on read_state.chat_id = message.chat_id and read_state.user_key = $1
            where message.chat_id in (${n.map((c,u)=>`$${u+2}`).join(",")})
              and message.deleted_at is null
              and message.created_at > coalesce(
                read_state.last_read_at,
                '1970-01-01T00:00:00Z'::timestamptz
              )
              and (message.author_user_key is null or message.author_user_key <> $1)
            group by message.chat_id`,[e.userPrincipal.userKey,...n.map(c=>c.chat_id)]):[],o=new Map(s.map(c=>[String(c.chat_id),Number(c.unread_count||0)])),r=n.map(c=>({...c,unread_count:o.get(String(c.chat_id))||0}));a.json({clans:r})})),i.get("/ranking",p(async(e,a)=>{let n=await w(t,`select c.id, c.name, c.clan_type, c.rating_points,
              leader.name as leader_name,
              coalesce(members.member_count, 0)::integer as member_count,
              case when mine.clan_id is null then false else true end as is_member
         from public.clans c
         left join public.app_users leader on leader.user_key = c.leader_user_key
         left join (
           select clan_id, count(*) as member_count
             from public.clan_memberships
            where status = 'active'
            group by clan_id
         ) members on members.clan_id = c.id
         left join (
           select distinct clan_id
             from public.clan_memberships
            where user_key = $1 and status = 'active'
         ) mine on mine.clan_id = c.id
        where c.status = 'active'
        order by c.clan_type, c.rating_points desc, coalesce(members.member_count, 0) desc, c.name asc`,[e.userPrincipal.userKey]),s={user:0,corporate:0},o=n.map(r=>{let c=r.clan_type==="corporate"?"corporate":"user";return s[c]+=1,{id:r.id,name:r.name,clanType:c,leaderName:r.leader_name||"",ratingPoints:Number(r.rating_points||0),memberCount:Number(r.member_count||0),isMember:!!r.is_member,position:s[c]}});a.json({clans:o,categories:{user:o.filter(r=>r.clanType==="user"),corporate:o.filter(r=>r.clanType==="corporate")}})})),i.get("/invitations/me",p(async(e,a)=>{let n=await w(t,`select invitation.*, clan.name as clan_name, clan.clan_type,
              inviter.name as inviter_name
         from public.clan_invitations invitation
         join public.clans clan on clan.id = invitation.clan_id
         join public.app_users inviter on inviter.user_key = invitation.inviter_user_key
        where invitation.invitee_user_key = $1
          and invitation.status = 'pending'
          and (invitation.expires_at is null or invitation.expires_at > now())
        order by invitation.created_at desc`,[e.userPrincipal.userKey]);a.json({invitations:n})})),i.patch("/invitations/:invitationId",p(async(e,a)=>{let n=P(e.params.invitationId,"invitationId"),s=e.body?.status==="accepted"?"accepted":e.body?.status==="declined"?"declined":"";if(!s)throw new _(400,"status must be accepted or declined","validation_error");let o=await S(t,async r=>{let c=await d(r,`select invitation.*, clan.clan_type, clan.status as clan_status
           from public.clan_invitations invitation
           join public.clans clan on clan.id = invitation.clan_id
          where invitation.id = $1 and invitation.invitee_user_key = $2
          for update`,[n,e.userPrincipal.userKey]);if(!c)throw new _(404,"Clan invitation was not found","not_found");if(c.status!=="pending")throw new _(409,"Clan invitation has already been answered","clan_invitation_answered");if(c.expires_at&&new Date(c.expires_at).getTime()<=Date.now())throw await r.query("update public.clan_invitations set status = 'expired', updated_at = now() where id = $1",[n]),new _(409,"Clan invitation has expired","clan_invitation_expired");if(c.clan_status!=="active")throw new _(409,"Clan is not active","clan_unavailable");if(s==="accepted"){let l=await d(r,`select clan.id, clan.name
             from public.clan_memberships membership
             join public.clans clan on clan.id = membership.clan_id
            where membership.user_key = $1
              and membership.status = 'active'
              and membership.clan_type = $2
            limit 1`,[e.userPrincipal.userKey,c.clan_type]);if(l)throw new _(409,"You already belong to a clan in this category","clan_category_membership_conflict",{clanId:l.id,clanName:l.name,clanType:c.clan_type});await r.query(`insert into public.clan_memberships(
             clan_id, user_key, clan_type, role, status
           ) values ($1,$2,$3,'member','active')`,[c.clan_id,e.userPrincipal.userKey,c.clan_type])}let u=await d(r,`update public.clan_invitations
            set status = $2, responded_at = now(), updated_at = now()
          where id = $1 returning *`,[n,s]);return await r.query(`insert into public.notifications(
           user_key, notification_type, title, body, data, idempotency_key
         ) values ($1,'clan_invitation_response',$2,$3,$4::jsonb,$5)
         on conflict (idempotency_key) do nothing`,[c.inviter_user_key,s==="accepted"?"\u041F\u0440\u0438\u0433\u043B\u0430\u0448\u0435\u043D\u0438\u0435 \u0432 \u043A\u043B\u0430\u043D \u043F\u0440\u0438\u043D\u044F\u0442\u043E":"\u041F\u0440\u0438\u0433\u043B\u0430\u0448\u0435\u043D\u0438\u0435 \u0432 \u043A\u043B\u0430\u043D \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u043E",`${e.userPrincipal.name}: ${s==="accepted"?"\u0432\u0441\u0442\u0443\u043F\u0438\u043B \u0432 \u043A\u043B\u0430\u043D":"\u043E\u0442\u043A\u043B\u043E\u043D\u0438\u043B \u043F\u0440\u0438\u0433\u043B\u0430\u0448\u0435\u043D\u0438\u0435"}.`,JSON.stringify({invitationId:n,clanId:c.clan_id,status:s}),`clan-invitation-response:${n}`]),u});a.json({invitation:o})})),i.post("/:clanId/invitations",p(async(e,a)=>{await O(t,e,"invitation.create",M(e,e.params.clanId));let n=$(e.body?.inviteeUserKey,"inviteeUserKey"),s=g(e.body?.message,500);if(n===e.userPrincipal.userKey)throw new _(400,"A leader cannot invite themselves","validation_error");let o=await d(t,`select clan.*, membership.role
         from public.clans clan
         join public.clan_memberships membership on membership.clan_id = clan.id
        where clan.id = $1
          and membership.user_key = $2
          and membership.status = 'active'`,[e.params.clanId,e.userPrincipal.userKey]);if(!o||o.status!=="active")throw new _(404,"Active clan was not found","not_found");if(o.role!=="leader")throw new _(403,"Only the clan leader can invite members","permission_denied");let[r,c]=await Promise.all([d(t,`select user_key, name from public.app_users
          where user_key = $1 and account_status = 'active'`,[n]),d(t,`select clan.id, clan.name
           from public.clan_memberships membership
           join public.clans clan on clan.id = membership.clan_id
          where membership.user_key = $1
            and membership.status = 'active'
            and membership.clan_type = $2
          limit 1`,[n,o.clan_type])]);if(!r)throw new _(404,"Invitee was not found","not_found");if(c)throw new _(409,"This user already belongs to a clan in the same category","clan_category_membership_conflict",{clanId:c.id,clanName:c.name,clanType:o.clan_type});try{let u=await S(t,async l=>{let m=await d(l,`insert into public.clan_invitations(
             clan_id, inviter_user_key, invitee_user_key, message, expires_at
           ) values ($1,$2,$3,$4,now() + interval '7 days')
           returning *`,[o.id,e.userPrincipal.userKey,n,s]);return await l.query(`insert into public.notifications(
             user_key, notification_type, title, body, data, idempotency_key
           ) values ($1,'clan_invitation',$2,$3,$4::jsonb,$5)
           on conflict (idempotency_key) do nothing`,[n,"\u041F\u0440\u0438\u0433\u043B\u0430\u0448\u0435\u043D\u0438\u0435 \u0432 \u043A\u043B\u0430\u043D",`${e.userPrincipal.name} \u043F\u0440\u0438\u0433\u043B\u0430\u0448\u0430\u0435\u0442 \u0432\u0430\u0441 \u0432 \xAB${o.name}\xBB.`,JSON.stringify({invitationId:m.id,clanId:o.id}),`clan-invitation:${m.id}`]),m});a.status(201).json({invitation:u})}catch(u){throw u?.code==="23505"?new _(409,"A pending invitation already exists","clan_invitation_pending"):u}})),i.get("/:clanId/chat",G(t,"chat.read"),p(async(e,a)=>{let n=F(e),s=k(e.query.limit,50,1,100),o=e.query.before?E(e.query.before):null,[r,c,u,l,m,y,b]=await Promise.all([Yt(t,n,o,s),za(t,n,e.userPrincipal.userKey),w(t,`select ce.id, ce.is_primary, ce.created_at,
                e.id as event_id, e.title, e.event_date, e.event_time,
                e.description, e.image_url, e.active
           from public.clan_chat_events ce
           join public.events e on e.id = ce.event_id
          where ce.chat_id = $1
          order by ce.is_primary desc, e.event_date asc, e.event_time asc`,[n]),w(t,`select * from public.clan_chat_announcements
          where chat_id = $1 order by published_at desc limit 20`,[n]),w(t,`select * from public.clan_chat_pins
          where chat_id = $1 order by created_at desc`,[n]),d(t,`select muted_until, announcements_only
           from public.clan_chat_notification_preferences
          where chat_id = $1 and user_key = $2`,[n,e.userPrincipal.userKey]),Vt(t,e.userPrincipal,e.params.clanId)]);a.json({clan:{id:e.permissionDecision.membership.clan_id,name:e.permissionDecision.membership.clan_name,clanType:e.permissionDecision.membership.clan_type,role:e.permissionDecision.membership.role},chat:{id:n,enabled:e.permissionDecision.chat.enabled,readOnly:e.permissionDecision.chat.read_only,ownDeleteWindowSeconds:e.permissionDecision.chat.own_delete_window_seconds,settings:e.permissionDecision.chat.settings},permissions:b,messages:r,pagination:{hasMore:r.length===s,nextBefore:r[0]?.createdAt||null},polls:c,events:u,announcements:l,pins:m,notificationPreference:y||{muted_until:null,announcements_only:!1}})})),i.get("/:clanId/messages",G(t,"message.read"),p(async(e,a)=>{let n=k(e.query.limit,50,1,100),s=e.query.before?E(e.query.before):null,o=await Yt(t,F(e),s,n);a.json({messages:o,pagination:{hasMore:o.length===n,nextBefore:o[0]?.createdAt||null}})})),i.get("/:clanId/members",G(t,"chat.read"),p(async(e,a)=>{let n=await w(t,`select user_key, role from public.clan_memberships
        where clan_id = $1 and status = 'active'
        order by case when role = 'leader' then 0 else 1 end, joined_at`,[e.params.clanId]),s=await Je(t,e.userPrincipal.userKey,n.map(c=>c.user_key)),o=new Map(s.map(c=>[String(c.id),c])),r=n.filter(c=>o.has(c.user_key)).map(c=>({role:c.role,profile:o.get(c.user_key)}));a.json({members:r})})),i.get("/:clanId/events/available",G(t,"event.read"),p(async(e,a)=>{let n=await w(t,`select id, title, event_date, event_time, description, image_url
         from public.events
        where active = true and event_date >= current_date
        order by event_date, event_time limit 100`);a.json({events:n})})),i.post("/:clanId/messages",G(t,"message.create"),p(async(e,a)=>{await O(t,e,"message.create",M(e,e.params.clanId));let n=f(e.body?.body,"body",4e3),s=e.body?.replyToId?P(e.body.replyToId,"replyToId"):null,o=F(e);if(s){if(!(await Ie(t,e.userPrincipal,e.params.clanId,"message.reply")).allowed)throw new _(403,"Reply is not permitted","permission_denied");if(!await d(t,"select id from public.clan_chat_messages where id = $1 and chat_id = $2",[s,o]))throw new _(404,"Reply target was not found","not_found")}let r=n.match(/https?:\/\/\S+/gi)||[];r.length&&await O(t,e,"message.links",M(e,e.params.clanId),r.length);let c=n.match(/@[\p{L}\p{N}_]{2,32}/gu)||[];c.length&&await O(t,e,"message.mentions",M(e,e.params.clanId),c.length);let u=Y(n.toLocaleLowerCase("ru").replace(/\s+/g," ").trim()).slice(0,24);await O(t,e,"message.repeat",M(e,`${e.params.clanId}:${u}`));let l=await S(t,async m=>{let y=await d(m,`insert into public.clan_chat_messages(
           chat_id, author_user_key, body, reply_to_message_id
         ) values ($1,$2,$3,$4)
         returning *`,[o,e.userPrincipal.userKey,n,s]);return s&&await m.query(`insert into public.clan_chat_message_replies(message_id, parent_message_id)
           values ($1,$2)`,[y.id,s]),y});a.status(201).json({message:Zt({...l,author_name:e.userPrincipal.name})})})),i.delete("/:clanId/messages/:messageId",p(async(e,a)=>{let n=await Ie(t,e.userPrincipal,e.params.clanId,"message.delete_own");if(!n.membership?.chat_id)throw new _(403,"Clan access is denied","permission_denied");let s=P(e.params.messageId,"messageId"),o=await d(t,"select * from public.clan_chat_messages where id = $1 and chat_id = $2",[s,n.membership.chat_id]);if(!o)throw new _(404,"Message was not found","not_found");if(o.deleted_at)return a.status(204).end();let r=o.author_user_key===e.userPrincipal.userKey,c=(Date.now()-new Date(o.created_at).getTime())/1e3,u=n;if((!r||c>Number(n.chat?.own_delete_window_seconds||0))&&(u=await Ie(t,e.userPrincipal,e.params.clanId,"message.delete_any")),!u.allowed)throw new _(403,"Message deletion is not permitted","permission_denied");let l=g(e.body?.reason,500),m=ne(u),y=m==="leader"||m==="delegate"?"\u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u0443\u0434\u0430\u043B\u0435\u043D\u043E \u0440\u0443\u043A\u043E\u0432\u043E\u0434\u0438\u0442\u0435\u043B\u0435\u043C \u043A\u043B\u0430\u043D\u0430":"\u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u0443\u0434\u0430\u043B\u0435\u043D\u043E \u0430\u0432\u0442\u043E\u0440\u043E\u043C";await t.query(`update public.clan_chat_messages
          set body = $1, deleted_at = now(), deleted_by_type = $2,
              deleted_by_id = $3, deletion_reason = $4
        where id = $5`,[y,m,e.userPrincipal.userKey,l,s]),m!=="user"&&await ee(t,e,{actorType:m,actorId:e.userPrincipal.userKey,permissionKey:"message.delete_any",action:"message.delete",targetType:"message",targetId:s,clanId:e.params.clanId,reason:l,before:{body:o.body,authorUserKey:o.author_user_key},after:{deleted:!0}}),a.status(204).end()})),i.post("/:clanId/read",G(t,"chat.read"),p(async(e,a)=>{let n=e.body?.messageId?P(e.body.messageId,"messageId"):null;if(n&&!await d(t,"select id from public.clan_chat_messages where id = $1 and chat_id = $2",[n,F(e)]))throw new _(404,"Message was not found","not_found");await t.query(`insert into public.clan_chat_read_states(chat_id, user_key, last_read_message_id, last_read_at)
       values ($1,$2,$3,now())
       on conflict (chat_id, user_key) do update set
         last_read_message_id = excluded.last_read_message_id,
         last_read_at = now(),
         updated_at = now()`,[F(e),e.userPrincipal.userKey,n]),a.status(204).end()})),i.post("/:clanId/messages/:messageId/reports",G(t,"report.create"),p(async(e,a)=>{await O(t,e,"report.create",M(e,e.params.clanId));let n=P(e.params.messageId,"messageId"),s=f(e.body?.reason,"reason",1e3);if(!await d(t,"select id from public.clan_chat_messages where id = $1 and chat_id = $2",[n,F(e)]))throw new _(404,"Message was not found","not_found");let r=await d(t,`insert into public.clan_chat_reports(chat_id, message_id, reporter_user_key, reason)
       values ($1,$2,$3,$4)
       on conflict (message_id, reporter_user_key) do update set
         reason = excluded.reason, status = 'new', updated_at = now()
       returning *`,[F(e),n,e.userPrincipal.userKey,s]);a.status(201).json({report:r})})),i.post("/:clanId/polls",G(t,"poll.create"),p(async(e,a)=>{await O(t,e,"poll.create",M(e,e.params.clanId));let n=f(e.body?.question,"question",500),s=ke(e.body?.options,"options",2,10,200),o=E(e.body?.closesAt);if(o&&new Date(o).getTime()<=Date.now())throw new _(400,"Poll close time must be in the future","validation_error");let r=await S(t,async c=>{let u=await d(c,`insert into public.clan_chat_polls(
           chat_id, created_by_user_key, question, allow_multiple,
           anonymous, show_results_before_vote, closes_at
         ) values ($1,$2,$3,$4,$5,$6,$7)
         returning *`,[F(e),e.userPrincipal.userKey,n,A(e.body?.allowMultiple),A(e.body?.anonymous),A(e.body?.showResultsBeforeVote),o]);for(let l=0;l<s.length;l+=1)await c.query(`insert into public.clan_chat_poll_options(poll_id, label, sort_order)
           values ($1,$2,$3)`,[u.id,s[l],l]);return u});await ee(t,e,{actorType:ne(e.permissionDecision),actorId:e.userPrincipal.userKey,permissionKey:"poll.create",action:"poll.create",targetType:"poll",targetId:r.id,clanId:e.params.clanId,after:{question:n,options:s}}),a.status(201).json({poll:r})})),i.post("/:clanId/polls/:pollId/votes",G(t,"poll.vote"),p(async(e,a)=>{await O(t,e,"poll.vote",M(e,e.params.clanId));let n=P(e.params.pollId,"pollId"),s=ke(e.body?.optionIds,"optionIds",1,10,80).map(u=>P(u,"optionId")),o=await d(t,"select * from public.clan_chat_polls where id = $1 and chat_id = $2",[n,F(e)]);if(!o)throw new _(404,"Poll was not found","not_found");if(o.status!=="active"||o.closes_at&&new Date(o.closes_at).getTime()<=Date.now())throw new _(409,"Poll is closed","poll_closed");if(!o.allow_multiple&&s.length!==1)throw new _(400,"This poll accepts one option","validation_error");let r=await w(t,"select id from public.clan_chat_poll_options where poll_id = $1",[n]),c=new Set(r.map(u=>String(u.id)));if(s.some(u=>!c.has(u)))throw new _(400,"Poll option is invalid","validation_error");await S(t,async u=>{await u.query("delete from public.clan_chat_poll_votes where poll_id = $1 and voter_user_key = $2",[n,e.userPrincipal.userKey]);for(let l of s)await u.query(`insert into public.clan_chat_poll_votes(poll_id, option_id, voter_user_key)
           values ($1,$2,$3)`,[n,l,e.userPrincipal.userKey])}),a.json({voted:!0,optionIds:s,checkinCreated:!1})}));for(let[e,a,n]of[["finish","poll.finish","finished"],["cancel","poll.cancel","cancelled"]])i.post(`/:clanId/polls/:pollId/${e}`,G(t,a),p(async(s,o)=>{let r=P(s.params.pollId,"pollId"),c=await d(t,"select * from public.clan_chat_polls where id = $1 and chat_id = $2",[r,F(s)]);if(!c)throw new _(404,"Poll was not found","not_found");let u=await d(t,"update public.clan_chat_polls set status = $1 where id = $2 returning *",[n,r]);await ee(t,s,{actorType:ne(s.permissionDecision),actorId:s.userPrincipal.userKey,permissionKey:a,action:`poll.${e}`,targetType:"poll",targetId:r,clanId:s.params.clanId,before:c,after:u}),o.json({poll:u})}));return i.delete("/:clanId/polls/:pollId",G(t,"poll.delete"),p(async(e,a)=>{let n=P(e.params.pollId,"pollId"),s=await d(t,"select * from public.clan_chat_polls where id = $1 and chat_id = $2",[n,F(e)]);if(!s)throw new _(404,"Poll was not found","not_found");await t.query("update public.clan_chat_polls set status = 'deleted' where id = $1",[n]),await ee(t,e,{actorType:ne(e.permissionDecision),actorId:e.userPrincipal.userKey,permissionKey:"poll.delete",action:"poll.delete",targetType:"poll",targetId:n,clanId:e.params.clanId,before:s,after:{status:"deleted"}}),a.status(204).end()})),i.post("/:clanId/events",G(t,"event.attach"),p(async(e,a)=>{await O(t,e,"event.attach",M(e,e.params.clanId));let n=$(e.body?.eventId,"eventId"),s=await d(t,`select id, title, event_date, event_time, active from public.events
        where id = $1 and active = true`,[n]);if(!s)throw new _(404,"Official event was not found","not_found");let o=await d(t,`insert into public.clan_chat_events(chat_id, event_id, attached_by_user_key)
       values ($1,$2,$3)
       on conflict (chat_id, event_id) do update set updated_at = now()
       returning *`,[F(e),n,e.userPrincipal.userKey]);await ee(t,e,{actorType:ne(e.permissionDecision),actorId:e.userPrincipal.userKey,permissionKey:"event.attach",action:"event.attach",targetType:"event_attachment",targetId:o.id,clanId:e.params.clanId,after:s}),a.status(201).json({attachment:{...o,event:s}})})),i.delete("/:clanId/events/:attachmentId",G(t,"event.detach"),p(async(e,a)=>{let n=P(e.params.attachmentId,"attachmentId"),s=await d(t,"select * from public.clan_chat_events where id = $1 and chat_id = $2",[n,F(e)]);if(!s)throw new _(404,"Event attachment was not found","not_found");await t.query("delete from public.clan_chat_events where id = $1",[n]),await ee(t,e,{actorType:ne(e.permissionDecision),actorId:e.userPrincipal.userKey,permissionKey:"event.detach",action:"event.detach",targetType:"event_attachment",targetId:n,clanId:e.params.clanId,before:s}),a.status(204).end()})),i.post("/:clanId/events/:attachmentId/primary",G(t,"event.set_primary"),p(async(e,a)=>{let n=P(e.params.attachmentId,"attachmentId"),s=await S(t,async o=>(await o.query("update public.clan_chat_events set is_primary = false where chat_id = $1",[F(e)]),d(o,`update public.clan_chat_events set is_primary = true
          where id = $1 and chat_id = $2 returning *`,[n,F(e)])));if(!s)throw new _(404,"Event attachment was not found","not_found");await ee(t,e,{actorType:ne(e.permissionDecision),actorId:e.userPrincipal.userKey,permissionKey:"event.set_primary",action:"event.set_primary",targetType:"event_attachment",targetId:n,clanId:e.params.clanId,after:{isPrimary:!0}}),a.json({attachment:s})})),i.post("/:clanId/polls/:pollId/event",G(t,"event.link_poll"),p(async(e,a)=>{let n=P(e.params.pollId,"pollId"),s=P(e.body?.attachmentId,"attachmentId"),o=await d(t,`update public.clan_chat_polls p set linked_event_attachment_id = $1
        where p.id = $2 and p.chat_id = $3
          and exists (
            select 1 from public.clan_chat_events e
             where e.id = $1 and e.chat_id = p.chat_id
          )
        returning *`,[s,n,F(e)]);if(!o)throw new _(404,"Poll or event attachment was not found","not_found");await ee(t,e,{actorType:ne(e.permissionDecision),actorId:e.userPrincipal.userKey,permissionKey:"event.link_poll",action:"event.link_poll",targetType:"poll",targetId:n,clanId:e.params.clanId,after:{attachmentId:s}}),a.json({poll:o})})),i.post("/:clanId/announcements",G(t,"announcement.create"),p(async(e,a)=>{let n=g(e.body?.title,200),s=f(e.body?.body,"body",4e3),o=await S(t,async r=>{let c=await d(r,`insert into public.clan_chat_announcements(
           chat_id, author_user_key, title, body, official
         ) values ($1,$2,$3,$4,false) returning *`,[F(e),e.userPrincipal.userKey,n,s]);return await r.query(`insert into public.clan_chat_messages(
           chat_id, author_user_key, body, message_type
         ) values ($1,$2,$3,'announcement')`,[F(e),e.userPrincipal.userKey,n?`${n}
${s}`:s]),c});await ee(t,e,{actorType:ne(e.permissionDecision),actorId:e.userPrincipal.userKey,permissionKey:"announcement.create",action:"announcement.create",targetType:"announcement",targetId:o.id,clanId:e.params.clanId,after:{title:n,body:s}}),a.status(201).json({announcement:o})})),i.post("/:clanId/pins",p(async(e,a)=>{let n=f(e.body?.targetType,"targetType",30),s=P(e.body?.targetId,"targetId"),o=n==="message"?"message.pin":n==="poll"?"poll.pin":n==="event"?"event.pin":"announcement.create",r=await Ie(t,e.userPrincipal,e.params.clanId,o);if(e.permissionDecision=r,!r.allowed)throw new _(403,"Pin is not permitted","permission_denied");await Va(t,n,s,String(r.chat.chat_id));let c=await d(t,`insert into public.clan_chat_pins(chat_id, target_type, target_id, pinned_by_user_key)
       values ($1,$2,$3,$4)
       on conflict (chat_id, target_type, target_id) do update set
         pinned_by_user_key = excluded.pinned_by_user_key
       returning *`,[r.chat.chat_id,n,s,e.userPrincipal.userKey]);await ee(t,e,{actorType:ne(r),actorId:e.userPrincipal.userKey,permissionKey:o,action:"pin.create",targetType:n,targetId:s,clanId:e.params.clanId,after:c}),a.status(201).json({pin:c})})),i.delete("/:clanId/pins/:pinId",p(async(e,a)=>{let n=P(e.params.pinId,"pinId"),s=await d(t,`select p.*, ch.clan_id from public.clan_chat_pins p
       join public.clan_chats ch on ch.id = p.chat_id
       where p.id = $1 and ch.clan_id = $2`,[n,e.params.clanId]);if(!s)throw new _(404,"Pin was not found","not_found");let o=s.target_type==="message"?"message.pin":s.target_type==="poll"?"poll.pin":s.target_type==="event"?"event.pin":"announcement.create",r=await Ie(t,e.userPrincipal,e.params.clanId,o);if(!r.allowed)throw new _(403,"Pin removal is not permitted","permission_denied");await t.query("delete from public.clan_chat_pins where id = $1",[n]),await ee(t,e,{actorType:ne(r),actorId:e.userPrincipal.userKey,permissionKey:o,action:"pin.delete",targetType:s.target_type,targetId:s.target_id,clanId:e.params.clanId,before:s}),a.status(204).end()})),i.post("/:clanId/restrictions",G(t,"member.restrict_chat"),p(async(e,a)=>{let n=$(e.body?.userKey,"userKey"),s=f(e.body?.reason,"reason",1e3),o=E(e.body?.expiresAt);if(!await d(t,`select id from public.clan_memberships
        where clan_id = $1 and user_key = $2 and status = 'active'`,[e.params.clanId,n]))throw new _(404,"Active clan member was not found","not_found");let c=await d(t,`insert into public.clan_chat_restrictions(
         chat_id, user_key, can_write, reason, expires_at, created_by_type, created_by_id
       ) values ($1,$2,false,$3,$4,$5,$6)
       on conflict (chat_id, user_key) where revoked_at is null
       do update set reason = excluded.reason, expires_at = excluded.expires_at,
         updated_at = now()
       returning *`,[F(e),n,s,o,ne(e.permissionDecision),e.userPrincipal.userKey]);await ee(t,e,{actorType:ne(e.permissionDecision),actorId:e.userPrincipal.userKey,permissionKey:"member.restrict_chat",action:"member.restrict_chat",targetType:"member",targetId:n,clanId:e.params.clanId,reason:s,after:c}),a.status(201).json({restriction:c})})),i.delete("/:clanId/restrictions/:userKey",G(t,"member.unrestrict_chat"),p(async(e,a)=>{let n=$(e.params.userKey,"userKey"),s=await d(t,`update public.clan_chat_restrictions
          set revoked_at = now(), updated_at = now()
        where chat_id = $1 and user_key = $2 and revoked_at is null
        returning *`,[F(e),n]);if(!s)throw new _(404,"Active restriction was not found","not_found");await ee(t,e,{actorType:ne(e.permissionDecision),actorId:e.userPrincipal.userKey,permissionKey:"member.unrestrict_chat",action:"member.unrestrict_chat",targetType:"member",targetId:n,clanId:e.params.clanId,before:s}),a.status(204).end()})),i.put("/:clanId/notifications",G(t,"chat.read"),p(async(e,a)=>{let n=E(e.body?.mutedUntil),s=await d(t,`insert into public.clan_chat_notification_preferences(
         chat_id, user_key, muted_until, announcements_only
       ) values ($1,$2,$3,$4)
       on conflict (chat_id, user_key) do update set
         muted_until = excluded.muted_until,
         announcements_only = excluded.announcements_only,
         updated_at = now()
       returning *`,[F(e),e.userPrincipal.userKey,n,A(e.body?.announcementsOnly)]);a.json({preference:s})})),i.get("/:clanId/audit",G(t,"audit.read"),p(async(e,a)=>{let n=k(e.query.limit,50,1,100),s=await w(t,`select * from public.clan_chat_audit_log
        where clan_id = $1 and actor_id = $2
        order by created_at desc limit $3`,[e.params.clanId,e.userPrincipal.userKey,n]);a.json({audit:s})})),i}var qt=D(()=>{"use strict";B();L();z();Gt();ye();Z();ve();pt();me()});import{randomUUID as Ga}from"node:crypto";import{Router as Fa}from"express";function te(...t){return(i,e,a)=>{if(!i.adminPrincipal||!t.includes(i.adminPrincipal.role))return a(new _(403,"Administrator role does not permit this action","admin_permission_denied"));a()}}function Wa(t){let i=String(t||"").trim().toLowerCase();if(i!=="user"&&i!=="corporate")throw new _(400,"clanType must be user or corporate","validation_error");return i}async function _e(t,i){let e=await d(t,`select c.id as clan_id, c.name as clan_name, c.clan_type, c.status as clan_status,
            c.rating_points,
            c.leader_user_key, ch.*
       from public.clans c
       join public.clan_chats ch on ch.clan_id = c.id
      where c.id = $1`,[i]);if(!e)throw new _(404,"Clan chat was not found","not_found");return e}async function ae(t,i,e){return ee(t,i,{actorType:"admin",actorId:i.adminPrincipal.adminId,...e})}function Ya(t){return`"${(t==null?"":typeof t=="object"?JSON.stringify(t):String(t)).replaceAll('"','""')}"`}function en(t){let i=Fa();return i.use(X),i.get("/permissions",p(async(e,a)=>{let n=await w(t,"select * from public.clan_chat_permissions order by permission_key");a.json({permissions:n})})),i.get("/users",p(async(e,a)=>{let n=String(e.query.search||"").trim(),s=await w(t,`select u.user_key, u.name, u.username,
              max(case when c.clan_type = 'user' and m.status = 'active' then c.name end) as user_clan_name,
              max(case when c.clan_type = 'corporate' and m.status = 'active' then c.name end) as corporate_clan_name
         from public.app_users u
         left join public.clan_memberships m on m.user_key = u.user_key
         left join public.clans c on c.id = m.clan_id
        where u.account_status = 'active'
          and ($1 = '' or lower(u.name) like '%' || lower($1) || '%'
            or lower(u.username) like '%' || lower($1) || '%')
        group by u.user_key, u.name, u.username
        order by u.name, u.user_key
        limit 200`,[n]);a.json({users:s})})),i.post("/clans",te("admin","superadmin"),p(async(e,a)=>{let n=f(e.body?.name,"name",120),s=Wa(e.body?.clanType),o=$(e.body?.leaderUserKey,"leaderUserKey"),r=k(e.body?.ratingPoints,0,0,1e9),c=g(e.body?.reason,1e3),u=`clan-${Ga()}`,l=await d(t,`select user_key, name, username from public.app_users
          where user_key = $1 and account_status = 'active'`,[o]);if(!l)throw new _(404,"Active senior user was not found","not_found");let m=await d(t,`select c.id, c.name
           from public.clan_memberships m
           join public.clans c on c.id = m.clan_id
          where m.user_key = $1 and m.status = 'active' and c.clan_type = $2
          limit 1`,[o,s]);if(m)throw new _(409,`The selected senior already belongs to a ${s} clan`,"clan_category_membership_conflict",{clanId:m.id,clanName:m.name,clanType:s});let y;try{y=await S(t,async b=>{let v=await d(b,`insert into public.clans(id, name, clan_type, leader_user_key, rating_points)
             values ($1,$2,$3,$4,$5)
             returning id, name, clan_type, leader_user_key, rating_points, status, created_at`,[u,n,s,o,r]);await b.query(`insert into public.clan_memberships(clan_id, user_key, role, status, clan_type)
             values ($1,$2,'leader','active',$3)`,[u,o,s]);let h=await d(b,`insert into public.clan_chats(clan_id)
             values ($1)
             on conflict (clan_id) do update set clan_id = excluded.clan_id
             returning id, clan_id, enabled, read_only`,[u]);return{clan:v,chat:h}})}catch(b){throw b?.code==="23505"?new _(409,`The selected senior already belongs to a ${s} clan`,"clan_category_membership_conflict"):b}await ae(t,e,{permissionKey:"clan.create",action:"clan.create",targetType:"clan",targetId:u,clanId:u,reason:c,after:{...y.clan,leaderName:l.name,leaderUserKey:o}}),a.status(201).json(y)})),i.get("/chats",p(async(e,a)=>{let n=String(e.query.search||"").trim(),s=await w(t,`select c.id as clan_id, c.name, c.clan_type, c.status, c.rating_points,
              c.leader_user_key, leader.name as leader_name,
              ch.id as chat_id, ch.enabled, ch.read_only,
              coalesce(members.member_count, 0)::integer as member_count,
              coalesce(messages.message_count, 0)::integer as message_count,
              messages.last_message_at,
              coalesce(polls.active_poll_count, 0)::integer as active_poll_count,
              coalesce(events.attached_event_count, 0)::integer as attached_event_count,
              coalesce(reports.open_report_count, 0)::integer as open_report_count
         from public.clans c
         join public.clan_chats ch on ch.clan_id = c.id
         left join public.app_users leader on leader.user_key = c.leader_user_key
         left join (
           select clan_id, count(*) as member_count
             from public.clan_memberships
            where status = 'active'
            group by clan_id
         ) members on members.clan_id = c.id
         left join (
           select chat_id, count(*) as message_count, max(created_at) as last_message_at
             from public.clan_chat_messages
            group by chat_id
         ) messages on messages.chat_id = ch.id
         left join (
           select chat_id, count(*) as active_poll_count
             from public.clan_chat_polls
            where status = 'active'
            group by chat_id
         ) polls on polls.chat_id = ch.id
         left join (
           select chat_id, count(*) as attached_event_count
             from public.clan_chat_events
            group by chat_id
         ) events on events.chat_id = ch.id
         left join (
           select chat_id, count(*) as open_report_count
             from public.clan_chat_reports
            where status = 'new'
            group by chat_id
         ) reports on reports.chat_id = ch.id
        where ($1 = '' or lower(c.name) like '%' || lower($1) || '%')
        order by c.name`,[n]);a.json({chats:s})})),i.put("/clans/:clanId/rating",te("admin","superadmin"),p(async(e,a)=>{let n=$(e.params.clanId,"clanId"),s=await d(t,"select id, name, rating_points from public.clans where id = $1",[n]);if(!s)throw new _(404,"Clan was not found","not_found");let o=k(e.body?.ratingPoints,Number(s.rating_points||0),0,1e9),r=await d(t,`update public.clans
            set rating_points = $1, updated_at = now()
          where id = $2
          returning id, name, rating_points`,[o,n]);await ae(t,e,{permissionKey:"clan.rating.update",action:"clan.rating.update",targetType:"clan",targetId:n,clanId:n,reason:g(e.body?.reason,1e3),before:s,after:r}),a.json({clan:r})})),i.get("/clans/:clanId/chat",p(async(e,a)=>{let n=await _e(t,e.params.clanId),s=k(e.query.limit,100,1,200),[o,r,c,u,l,m,y]=await Promise.all([w(t,`select m.*, u.name, u.username, u.account_status
           from public.clan_memberships m
           join public.app_users u on u.user_key = m.user_key
          where m.clan_id = $1 order by m.status, m.joined_at`,[e.params.clanId]),w(t,`select msg.*, u.name as author_name
           from public.clan_chat_messages msg
           left join public.app_users u on u.user_key = msg.author_user_key
          where msg.chat_id = $1
          order by msg.created_at desc limit $2`,[n.id,s]),w(t,`select p.*, u.name as creator_name
           from public.clan_chat_polls p
           left join public.app_users u on u.user_key = p.created_by_user_key
          where p.chat_id = $1 order by p.created_at desc`,[n.id]),w(t,`select ce.*, e.title, e.event_date, e.event_time
           from public.clan_chat_events ce
           join public.events e on e.id = ce.event_id
          where ce.chat_id = $1 order by ce.is_primary desc, e.event_date`,[n.id]),w(t,`select g.*, u.name as user_name, a.email as granted_by_email
           from public.clan_chat_permission_grants g
           join public.app_users u on u.user_key = g.user_key
           left join public.admin_users a on a.id = g.granted_by_admin_id
          where g.clan_id = $1 order by g.created_at desc`,[e.params.clanId]),w(t,`select r.*, u.name as user_name
           from public.clan_chat_restrictions r
           join public.app_users u on u.user_key = r.user_key
          where r.chat_id = $1 order by r.created_at desc`,[n.id]),w(t,`select r.*, reporter.name as reporter_name, author.name as message_author_name
           from public.clan_chat_reports r
           join public.app_users reporter on reporter.user_key = r.reporter_user_key
           join public.clan_chat_messages msg on msg.id = r.message_id
           left join public.app_users author on author.user_key = msg.author_user_key
          where r.chat_id = $1 order by r.created_at desc`,[n.id])]);a.json({chat:n,members:o,messages:r,polls:c,events:u,grants:l,restrictions:m,reports:y})})),i.get("/clans/:clanId/messages",te("admin","superadmin","moderator","auditor"),p(async(e,a)=>{let n=await _e(t,e.params.clanId),s=String(e.query.search||"").trim().slice(0,500),o=k(e.query.limit,100,1,500),r=await w(t,`select msg.*, author.name as author_name
           from public.clan_chat_messages msg
           left join public.app_users author on author.user_key = msg.author_user_key
          where msg.chat_id = $1
            and ($2 = '' or lower(msg.body) like '%' || lower($2) || '%')
          order by msg.created_at desc
          limit $3`,[n.id,s,o]);a.json({messages:r})})),i.patch("/clans/:clanId/chat",te("admin","superadmin"),p(async(e,a)=>{let n=await _e(t,e.params.clanId),s=e.body?.enabled===void 0?n.enabled:A(e.body.enabled),o=e.body?.readOnly===void 0?n.read_only:A(e.body.readOnly),r=k(e.body?.ownDeleteWindowSeconds,Number(n.own_delete_window_seconds),0,86400),c=n.settings;if(typeof c=="string")try{c=JSON.parse(c)}catch{c={}}let u=e.body?.settings===void 0?c:e.body.settings;if(!u||Array.isArray(u)||typeof u!="object")throw new _(400,"settings must be an object","validation_error");let l=await d(t,`update public.clan_chats
            set enabled = $1, read_only = $2, own_delete_window_seconds = $3,
                settings = $4::jsonb
          where clan_id = $5 returning *`,[s,o,r,JSON.stringify(u),e.params.clanId]);await ae(t,e,{permissionKey:"chat.settings.update",action:"chat.settings.update",targetType:"chat",targetId:l.id,clanId:e.params.clanId,reason:g(e.body?.reason,1e3),before:n,after:l}),a.json({chat:l})})),i.delete("/clans/:clanId/messages/:messageId",te("admin","superadmin","moderator"),p(async(e,a)=>{let n=await _e(t,e.params.clanId),s=P(e.params.messageId,"messageId"),o=await d(t,"select * from public.clan_chat_messages where id = $1 and chat_id = $2",[s,n.id]);if(!o)throw new _(404,"Message was not found","not_found");o.deleted_at||await t.query(`update public.clan_chat_messages
              set body = '\u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u0443\u0434\u0430\u043B\u0435\u043D\u043E \u0430\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u043E\u043C BALI',
                  deleted_at = now(), deleted_by_type = 'admin',
                  deleted_by_id = $1, deletion_reason = $2
            where id = $3`,[e.adminPrincipal.adminId,g(e.body?.reason,500),s]),await ae(t,e,{permissionKey:"message.delete_any",action:"message.delete",targetType:"message",targetId:s,clanId:e.params.clanId,reason:g(e.body?.reason,500),before:o,after:{deleted:!0}}),a.status(204).end()})),i.post("/clans/:clanId/grants",te("admin","superadmin"),p(async(e,a)=>{await _e(t,e.params.clanId);let n=$(e.body?.userKey,"userKey"),s=f(e.body?.permissionKey,"permissionKey",100),o=e.body?.effect==="deny"?"deny":"allow",r=E(e.body?.expiresAt),c=f(e.body?.reason,"reason",1e3),[u,l]=await Promise.all([d(t,`select id from public.clan_memberships
            where clan_id = $1 and user_key = $2 and status = 'active'`,[e.params.clanId,n]),d(t,"select permission_key from public.clan_chat_permissions where permission_key = $1",[s])]);if(!u)throw new _(404,"Active clan member was not found","not_found");if(!l)throw new _(400,"Unknown permission","validation_error");let m=await d(t,`insert into public.clan_chat_permission_grants(
           clan_id, user_key, permission_key, effect, reason,
           granted_by_admin_id, expires_at
         ) values ($1,$2,$3,$4,$5,$6,$7)
         returning *`,[e.params.clanId,n,s,o,c,e.adminPrincipal.adminId,r]);await ae(t,e,{permissionKey:s,action:o==="deny"?"permission.deny":"permission.grant",targetType:"permission_grant",targetId:m.id,clanId:e.params.clanId,reason:c,after:m}),a.status(201).json({grant:m})})),i.delete("/clans/:clanId/grants/:grantId",te("admin","superadmin"),p(async(e,a)=>{let n=P(e.params.grantId,"grantId"),s=await d(t,`update public.clan_chat_permission_grants
            set revoked_at = now(), updated_at = now()
          where id = $1 and clan_id = $2 and revoked_at is null
          returning *`,[n,e.params.clanId]);if(!s)throw new _(404,"Active permission grant was not found","not_found");await ae(t,e,{permissionKey:s.permission_key,action:"permission.revoke",targetType:"permission_grant",targetId:n,clanId:e.params.clanId,reason:g(e.body?.reason,1e3),before:s,after:{revoked:!0}}),a.status(204).end()})),i.post("/clans/:clanId/members",te("admin","superadmin"),p(async(e,a)=>{let n=$(e.params.clanId,"clanId"),s=$(e.body?.userKey,"userKey"),o=f(e.body?.reason,"reason",1e3),[r,c,u]=await Promise.all([d(t,"select id, name, clan_type, status from public.clans where id = $1",[n]),d(t,"select user_key, name, account_status from public.app_users where user_key = $1",[s]),d(t,"select * from public.clan_memberships where clan_id = $1 and user_key = $2",[n,s])]);if(!r||r.status!=="active")throw new _(404,"Active clan was not found","not_found");if(!c||c.account_status!=="active")throw new _(404,"Active user was not found","not_found");let l=await d(t,`select membership.id, clan.id as clan_id, clan.name
           from public.clan_memberships membership
           join public.clans clan on clan.id = membership.clan_id
          where membership.user_key = $1
            and membership.status = 'active'
            and membership.clan_type = $2
            and membership.clan_id <> $3
          limit 1`,[s,r.clan_type,n]);if(l)throw new _(409,"User already belongs to a clan in this category","clan_category_membership_conflict",{clanId:l.clan_id,clanName:l.name,clanType:r.clan_type});let m=await d(t,`insert into public.clan_memberships(
           clan_id, user_key, clan_type, role, status
         ) values ($1,$2,$3,'member','active')
         on conflict (clan_id, user_key) do update
           set clan_type = excluded.clan_type,
               role = case
                 when public.clan_memberships.role = 'leader' then 'leader'
                 else 'member'
               end,
               status = 'active',
               ended_at = null,
               joined_at = now(),
               updated_at = now()
         returning *`,[n,s,r.clan_type]);await ae(t,e,{permissionKey:"clan.membership.manage",action:u?.status==="active"?"clan.member.confirm":"clan.member.assign",targetType:"clan_membership",targetId:m.id,clanId:n,reason:o,before:u,after:m}),a.status(u?.status==="active"?200:201).json({membership:m})})),i.put("/clans/:clanId/leader",te("admin","superadmin"),p(async(e,a)=>{let n=$(e.body?.userKey,"userKey"),s=f(e.body?.reason,"reason",1e3),o=await _e(t,e.params.clanId);if(!await d(t,`select * from public.clan_memberships
          where clan_id = $1 and user_key = $2 and status = 'active'`,[e.params.clanId,n]))throw new _(404,"Active clan member was not found","not_found");await S(t,async c=>{await c.query(`update public.clan_memberships set role = 'member'
            where clan_id = $1 and role = 'leader'`,[e.params.clanId]),await c.query(`update public.clan_memberships set role = 'leader'
            where clan_id = $1 and user_key = $2`,[e.params.clanId,n]),await c.query("update public.clans set leader_user_key = $1 where id = $2",[n,e.params.clanId])}),await ae(t,e,{permissionKey:"chat.settings.update",action:"clan.leader.transfer",targetType:"clan",targetId:e.params.clanId,clanId:e.params.clanId,reason:s,before:{leaderUserKey:o.leader_user_key},after:{leaderUserKey:n}}),a.json({leaderUserKey:n})})),i.post("/clans/:clanId/restrictions",te("admin","superadmin","moderator"),p(async(e,a)=>{let n=await _e(t,e.params.clanId),s=$(e.body?.userKey,"userKey"),o=f(e.body?.reason,"reason",1e3),r=E(e.body?.expiresAt);if(!await d(t,`select id from public.clan_memberships
          where clan_id = $1 and user_key = $2 and status = 'active'`,[e.params.clanId,s]))throw new _(404,"Active clan member was not found","not_found");let u=await d(t,`insert into public.clan_chat_restrictions(
           chat_id, user_key, can_write, reason, expires_at, created_by_type, created_by_id
         ) values ($1,$2,false,$3,$4,'admin',$5)
         on conflict (chat_id, user_key) where revoked_at is null
         do update set reason = excluded.reason, expires_at = excluded.expires_at,
           updated_at = now()
         returning *`,[n.id,s,o,r,e.adminPrincipal.adminId]);await ae(t,e,{permissionKey:"member.restrict_chat",action:"member.restrict_chat",targetType:"member",targetId:s,clanId:e.params.clanId,reason:o,after:u}),a.status(201).json({restriction:u})})),i.delete("/clans/:clanId/restrictions/:userKey",te("admin","superadmin","moderator"),p(async(e,a)=>{let n=await _e(t,e.params.clanId),s=$(e.params.userKey,"userKey"),o=await d(t,`update public.clan_chat_restrictions
            set revoked_at = now(), updated_at = now()
          where chat_id = $1 and user_key = $2 and revoked_at is null
          returning *`,[n.id,s]);if(!o)throw new _(404,"Active restriction was not found","not_found");await ae(t,e,{permissionKey:"member.unrestrict_chat",action:"member.unrestrict_chat",targetType:"member",targetId:s,clanId:e.params.clanId,before:o}),a.status(204).end()})),i.post("/clans/:clanId/announcements",te("admin","superadmin"),p(async(e,a)=>{let n=await _e(t,e.params.clanId),s=g(e.body?.title,200),o=f(e.body?.body,"body",4e3),r=await S(t,async c=>{let u=await d(c,`insert into public.clan_chat_announcements(
             chat_id, title, body, official
           ) values ($1,$2,$3,true) returning *`,[n.id,s,o]);return await c.query(`insert into public.clan_chat_messages(chat_id, body, message_type)
           values ($1,$2,'announcement')`,[n.id,s?`${s}
${o}`:o]),u});await ae(t,e,{permissionKey:"announcement.create",action:"announcement.create",targetType:"announcement",targetId:r.id,clanId:e.params.clanId,after:r}),a.status(201).json({announcement:r})})),i.delete("/clans/:clanId/polls/:pollId",te("admin","superadmin","moderator"),p(async(e,a)=>{let n=await _e(t,e.params.clanId),s=P(e.params.pollId,"pollId"),o=await d(t,`update public.clan_chat_polls set status = 'deleted'
          where id = $1 and chat_id = $2 returning *`,[s,n.id]);if(!o)throw new _(404,"Poll was not found","not_found");await ae(t,e,{permissionKey:"poll.delete",action:"poll.delete",targetType:"poll",targetId:s,clanId:e.params.clanId,before:o}),a.status(204).end()})),i.delete("/clans/:clanId/events/:attachmentId",te("admin","superadmin","moderator"),p(async(e,a)=>{let n=await _e(t,e.params.clanId),s=P(e.params.attachmentId,"attachmentId"),o=await d(t,`delete from public.clan_chat_events
          where id = $1 and chat_id = $2 returning *`,[s,n.id]);if(!o)throw new _(404,"Event attachment was not found","not_found");await ae(t,e,{permissionKey:"event.detach",action:"event.detach",targetType:"event_attachment",targetId:s,clanId:e.params.clanId,before:o}),a.status(204).end()})),i.patch("/reports/:reportId",te("admin","superadmin","moderator"),p(async(e,a)=>{let n=P(e.params.reportId,"reportId"),s=String(e.body?.status||"");if(!["reviewed","resolved","dismissed"].includes(s))throw new _(400,"Invalid report status","validation_error");let o=await d(t,"select * from public.clan_chat_reports where id = $1",[n]);if(!o)throw new _(404,"Report was not found","not_found");let r=await d(t,`update public.clan_chat_reports
            set status = $1, resolution = $2, reviewed_by_admin_id = $3,
                reviewed_at = now()
          where id = $4 returning *`,[s,g(e.body?.resolution,2e3),e.adminPrincipal.adminId,n]),c=await d(t,"select clan_id from public.clan_chats where id = $1",[o.chat_id]);await ae(t,e,{permissionKey:"report.review",action:"report.review",targetType:"report",targetId:n,clanId:c?.clan_id,before:o,after:r}),a.json({report:r})})),i.get("/audit",p(async(e,a)=>{let n=k(e.query.limit,100,1,1e3),s=String(e.query.clanId||""),o=String(e.query.actorId||""),r=String(e.query.action||""),c=[],u=[],l=(y,b)=>{b&&(u.push(b),c.push(`${y} = $${u.length}`))};l("clan_id",s),l("actor_id",o),l("action",r);let m=await w(t,`select * from public.clan_chat_audit_log
        ${c.length?`where ${c.join(" and ")}`:""}
        order by created_at desc limit ${n}`,u);if(e.query.format==="csv"){let y=["id","created_at","actor_type","actor_id","actor_telegram_id","actor_user_key","permission_key","action","target_type","target_id","clan_id","chat_id","request_id","reason","before_value","after_value"],b=[y.join(","),...m.map(v=>y.map(h=>Ya(v[h])).join(","))].join(`
`);a.type("text/csv").attachment("bali-clan-audit.csv").send(b);return}a.json({audit:m})})),i.get("/rate-limits",p(async(e,a)=>{let n=await w(t,"select * from public.rate_limit_settings order by bucket");a.json({settings:n})})),i.put("/rate-limits/:bucket",te("admin","superadmin"),p(async(e,a)=>{let n=String(e.params.bucket||"");if(!/^[a-z][a-z0-9.-]{1,80}$/.test(n))throw new _(400,"Invalid rate-limit bucket","validation_error");let s=await d(t,"select * from public.rate_limit_settings where bucket = $1",[n]);if(!s)throw new _(404,"Rate-limit setting was not found","not_found");let o=await d(t,`update public.rate_limit_settings
            set limit_count = $1, window_seconds = $2, enabled = $3,
                updated_by_admin_id = $4
          where bucket = $5 returning *`,[k(e.body?.limitCount,Number(s.limit_count),1,1e5),k(e.body?.windowSeconds,Number(s.window_seconds),1,86400),e.body?.enabled===void 0?s.enabled:A(e.body.enabled),e.adminPrincipal.adminId,n]);await ae(t,e,{action:"rate_limit.update",targetType:"rate_limit_setting",targetId:n,before:s,after:o}),a.json({setting:o})})),i}var tn=D(()=>{"use strict";B();L();z();ve();Z()});import{Router as Za}from"express";async function De(t,i,e=!1){let a=await d(t,`select * from public.hall_layouts
      where id = $1
        and status ${e?"in ('published','archived')":"= 'published'"}`,[i]);if(!a)throw new _(404,"Published layout was not found","not_found");let[n,s]=await Promise.all([w(t,`select * from public.layout_tables
        where layout_id = $1 and active = true
        order by sort_order, table_number`,[i]),w(t,`select * from public.hall_layout_elements
        where layout_id = $1 and active = true
        order by sort_order, id`,[i])]);return{layout:a,tables:n,elements:s}}function nn(t){let i=Za();return i.use(H),i.get("/",p(async(e,a)=>{let n=await w(t,`select id, layout_family_key, name, internal_description,
              canvas_width, canvas_height, background_url, version, published_at
         from public.hall_layouts
        where status = 'published'
        order by name, version desc`);a.json({layouts:n})})),i.get("/:layoutId",p(async(e,a)=>{let n=$(e.params.layoutId,"layoutId");a.json(await De(t,n))})),i}var ze=D(()=>{"use strict";B();L();z();Z()});import{randomUUID as Ve}from"node:crypto";import{Router as Xa}from"express";async function Pe(t,i){let e=await d(t,"select * from public.hall_layouts where id = $1",[i]);if(!e)throw new _(404,"Layout was not found","not_found");if(e.status!=="draft")throw new _(409,"Only a draft layout can be edited; clone this version first","layout_not_editable");return e}function un(t){let i=Xa();return i.use(X),i.get("/layouts",p(async(e,a)=>{let n=e.query.status?K(e.query.status,"status",qa):null,s=await w(t,`select layout.*,
              coalesce(table_count.count, 0)::integer as table_count,
              coalesce(element_count.count, 0)::integer as element_count,
              coalesce(assignment_count.count, 0)::integer as assigned_event_count
         from public.hall_layouts layout
         left join (
           select layout_id, count(*) as count from public.layout_tables group by layout_id
         ) table_count on table_count.layout_id = layout.id
         left join (
           select layout_id, count(*) as count from public.hall_layout_elements group by layout_id
         ) element_count on element_count.layout_id = layout.id
         left join (
           select layout_id, count(*) as count from public.event_layout_assignments group by layout_id
         ) assignment_count on assignment_count.layout_id = layout.id
        where ($1::text is null or layout.status = $1)
        order by layout.updated_at desc`,[n]);a.json({layouts:s})})),i.get("/layouts/:layoutId",p(async(e,a)=>{let n=$(e.params.layoutId,"layoutId"),s=await d(t,"select * from public.hall_layouts where id = $1",[n]);if(!s)throw new _(404,"Layout was not found","not_found");let o=s.status==="published"?await De(t,n):{layout:s,tables:await w(t,"select * from public.layout_tables where layout_id = $1 order by sort_order, table_number",[n]),elements:await w(t,"select * from public.hall_layout_elements where layout_id = $1 order by sort_order, id",[n])};a.json(o)})),i.post("/layouts",p(async(e,a)=>{let n=f(e.body?.name,"name",160),s=`layout-${Ve()}`,o=e.body?.layoutFamilyKey?$(e.body.layoutFamilyKey,"layoutFamilyKey"):`layout-family-${Ve()}`,r=await d(t,`insert into public.hall_layouts(
         id, layout_family_key, name, internal_description, canvas_width,
         canvas_height, background_url, status, version, created_by_admin_id
       ) values ($1,$2,$3,$4,$5,$6,$7,'draft',1,$8)
       returning *`,[s,o,n,g(e.body?.internalDescription,2e3),k(e.body?.canvasWidth,1e3,240,1e4),k(e.body?.canvasHeight,1400,240,1e4),g(e.body?.backgroundUrl,2e3),e.adminPrincipal.adminId]);await T(t,e,{action:"layout.create",targetType:"hall_layout",targetId:s,after:r}),a.status(201).json({layout:r})})),i.post("/layouts/:layoutId/clone",p(async(e,a)=>{let n=$(e.params.layoutId,"layoutId"),s=await S(t,async o=>{let r=await d(o,"select * from public.hall_layouts where id = $1 for update",[n]);if(!r)throw new _(404,"Layout was not found","not_found");let c=await d(o,`select coalesce(max(version), 0)::integer + 1 as version
           from public.hall_layouts where layout_family_key = $1`,[r.layout_family_key]),u=`layout-${Ve()}`,l=await d(o,`insert into public.hall_layouts(
           id, layout_family_key, name, internal_description, canvas_width,
           canvas_height, background_url, status, version, source_layout_id,
           created_by_admin_id
         ) values ($1,$2,$3,$4,$5,$6,$7,'draft',$8,$9,$10)
         returning *`,[u,r.layout_family_key,g(e.body?.name,160)||`${r.name} v${c.version}`,r.internal_description,r.canvas_width,r.canvas_height,r.background_url,c.version,n,e.adminPrincipal.adminId]);return await o.query(`insert into public.hall_layout_elements(
           layout_id, element_type, label, x, y, width, height, rotation,
           style, sort_order, active
         )
         select $1, element_type, label, x, y, width, height, rotation,
                style, sort_order, active
           from public.hall_layout_elements where layout_id = $2`,[u,n]),await o.query(`insert into public.layout_tables(
           id, layout_id, table_number, name, x, y, width, height, rotation,
           shape, capacity, recommended_guests, minimum_deposit, table_type,
           description, status, sort_order, active
         )
         select 'table-' || gen_random_uuid()::text, $1, table_number, name,
                x, y, width, height, rotation, shape, capacity,
                recommended_guests, minimum_deposit, table_type,
                description, status, sort_order, active
           from public.layout_tables where layout_id = $2`,[u,n]),{source:r,layout:l}});await T(t,e,{action:"layout.clone",targetType:"hall_layout",targetId:s.layout.id,before:s.source,after:s.layout}),a.status(201).json({layout:s.layout})})),i.patch("/layouts/:layoutId",p(async(e,a)=>{let n=$(e.params.layoutId,"layoutId"),s=await Pe(t,n),o=await d(t,`update public.hall_layouts
          set name = $2, internal_description = $3, canvas_width = $4,
              canvas_height = $5, background_url = $6, updated_at = now()
        where id = $1
        returning *`,[n,e.body?.name===void 0?s.name:f(e.body.name,"name",160),e.body?.internalDescription===void 0?s.internal_description:g(e.body.internalDescription,2e3),k(e.body?.canvasWidth,Number(s.canvas_width),240,1e4),k(e.body?.canvasHeight,Number(s.canvas_height),240,1e4),e.body?.backgroundUrl===void 0?s.background_url:g(e.body.backgroundUrl,2e3)]);await T(t,e,{action:"layout.update",targetType:"hall_layout",targetId:n,reason:g(e.body?.reason,1e3),before:s,after:o}),a.json({layout:o})})),i.post("/layouts/:layoutId/publish",p(async(e,a)=>{let n=$(e.params.layoutId,"layoutId"),s=await S(t,async o=>{let r=await d(o,"select * from public.hall_layouts where id = $1 for update",[n]);if(!r)throw new _(404,"Layout was not found","not_found");let c=await d(o,`select count(*)::integer as count from public.layout_tables
          where layout_id = $1 and active = true`,[n]);if(!Number(c?.count||0))throw new _(409,"A layout without active tables cannot be published","layout_has_no_tables");await o.query(`update public.hall_layouts
            set status = 'archived', archived_at = now(), updated_at = now()
          where layout_family_key = $1 and status = 'published' and id <> $2`,[r.layout_family_key,n]);let u=await d(o,`update public.hall_layouts
            set status = 'published', published_at = now(), archived_at = null,
                published_by_admin_id = $2, updated_at = now()
          where id = $1 returning *`,[n,e.adminPrincipal.adminId]);return{before:r,layout:u}});await T(t,e,{action:"layout.publish",targetType:"hall_layout",targetId:n,reason:g(e.body?.reason,1e3),before:s.before,after:s.layout}),a.json({layout:s.layout})})),i.post("/layouts/:layoutId/archive",p(async(e,a)=>{let n=$(e.params.layoutId,"layoutId"),s=await d(t,"select * from public.hall_layouts where id = $1",[n]);if(!s)throw new _(404,"Layout was not found","not_found");let o=await d(t,`select count(*)::integer as count
         from public.event_layout_assignments where layout_id = $1`,[n]);if(Number(o?.count||0)>0)throw new _(409,"An assigned layout cannot be archived","layout_is_assigned");let r=await d(t,`update public.hall_layouts
          set status = 'archived', archived_at = now(), updated_at = now()
        where id = $1 returning *`,[n]);await T(t,e,{action:"layout.archive",targetType:"hall_layout",targetId:n,reason:f(e.body?.reason,"reason",1e3),before:s,after:r}),a.json({layout:r})})),i.post("/layouts/:layoutId/tables",p(async(e,a)=>{let n=$(e.params.layoutId,"layoutId");await Pe(t,n);let s=`table-${Ve()}`,o=k(e.body?.capacity,4,1,100),r=k(e.body?.recommendedGuests,o,1,o),c=await d(t,`insert into public.layout_tables(
         id, layout_id, table_number, name, x, y, width, height, rotation,
         shape, capacity, recommended_guests, minimum_deposit, table_type,
         description, status, sort_order, active
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       returning *`,[s,n,f(e.body?.tableNumber,"tableNumber",80),g(e.body?.name,160),Q(e.body?.x,0,-1e4,1e4),Q(e.body?.y,0,-1e4,1e4),Q(e.body?.width,8,.1,1e4),Q(e.body?.height,8,.1,1e4),Q(e.body?.rotation,0,-3600,3600),K(e.body?.shape||"round","shape",an),o,r,Q(e.body?.minimumDeposit,0,0,1e9),K(e.body?.tableType||"regular","tableType",sn),g(e.body?.description,2e3),K(e.body?.status||"available","status",on),k(e.body?.sortOrder,0,-1e6,1e6),A(e.body?.active,!0)]);await T(t,e,{action:"layout.table.create",targetType:"layout_table",targetId:s,after:c}),a.status(201).json({table:c})})),i.patch("/layouts/:layoutId/tables/:tableId",p(async(e,a)=>{let n=$(e.params.layoutId,"layoutId"),s=$(e.params.tableId,"tableId");await Pe(t,n);let o=await d(t,"select * from public.layout_tables where id = $1 and layout_id = $2",[s,n]);if(!o)throw new _(404,"Table was not found","not_found");let r=k(e.body?.capacity,Number(o.capacity),1,100),c=k(e.body?.recommendedGuests,Math.min(Number(o.recommended_guests),r),1,r),u=await d(t,`update public.layout_tables
          set table_number = $3, name = $4, x = $5, y = $6, width = $7,
              height = $8, rotation = $9, shape = $10, capacity = $11,
              recommended_guests = $12, minimum_deposit = $13,
              table_type = $14, description = $15, status = $16,
              sort_order = $17, active = $18, updated_at = now()
        where id = $1 and layout_id = $2
        returning *`,[s,n,e.body?.tableNumber===void 0?o.table_number:f(e.body.tableNumber,"tableNumber",80),e.body?.name===void 0?o.name:g(e.body.name,160),Q(e.body?.x,Number(o.x),-1e4,1e4),Q(e.body?.y,Number(o.y),-1e4,1e4),Q(e.body?.width,Number(o.width),.1,1e4),Q(e.body?.height,Number(o.height),.1,1e4),Q(e.body?.rotation,Number(o.rotation),-3600,3600),e.body?.shape===void 0?o.shape:K(e.body.shape,"shape",an),r,c,Q(e.body?.minimumDeposit,Number(o.minimum_deposit),0,1e9),e.body?.tableType===void 0?o.table_type:K(e.body.tableType,"tableType",sn),e.body?.description===void 0?o.description:g(e.body.description,2e3),e.body?.status===void 0?o.status:K(e.body.status,"status",on),k(e.body?.sortOrder,Number(o.sort_order),-1e6,1e6),e.body?.active===void 0?o.active:A(e.body.active)]);await T(t,e,{action:"layout.table.update",targetType:"layout_table",targetId:s,reason:g(e.body?.reason,1e3),before:o,after:u}),a.json({table:u})})),i.delete("/layouts/:layoutId/tables/:tableId",p(async(e,a)=>{let n=$(e.params.layoutId,"layoutId"),s=$(e.params.tableId,"tableId");await Pe(t,n);let o=await d(t,"select * from public.layout_tables where id = $1 and layout_id = $2",[s,n]);if(!o)throw new _(404,"Table was not found","not_found");try{await t.query("delete from public.layout_tables where id = $1 and layout_id = $2",[s,n])}catch(r){throw r?.code==="23503"?new _(409,"A table with booking history cannot be deleted; mark it inactive","table_has_history"):r}await T(t,e,{action:"layout.table.delete",targetType:"layout_table",targetId:s,reason:f(e.body?.reason,"reason",1e3),before:o}),a.status(204).end()})),i.post("/layouts/:layoutId/elements",p(async(e,a)=>{let n=$(e.params.layoutId,"layoutId");await Pe(t,n);let s=e.body?.style&&typeof e.body.style=="object"&&!Array.isArray(e.body.style)?e.body.style:{},o=await d(t,`insert into public.hall_layout_elements(
         layout_id, element_type, label, x, y, width, height, rotation,
         style, sort_order, active
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)
       returning *`,[n,K(e.body?.elementType,"elementType",rn),g(e.body?.label,160),Q(e.body?.x,0,-1e4,1e4),Q(e.body?.y,0,-1e4,1e4),Q(e.body?.width,10,.1,1e4),Q(e.body?.height,10,.1,1e4),Q(e.body?.rotation,0,-3600,3600),JSON.stringify(s),k(e.body?.sortOrder,0,-1e6,1e6),A(e.body?.active,!0)]);await T(t,e,{action:"layout.element.create",targetType:"layout_element",targetId:o.id,after:o}),a.status(201).json({element:o})})),i.patch("/layouts/:layoutId/elements/:elementId",p(async(e,a)=>{let n=$(e.params.layoutId,"layoutId"),s=P(e.params.elementId,"elementId");await Pe(t,n);let o=await d(t,"select * from public.hall_layout_elements where id = $1 and layout_id = $2",[s,n]);if(!o)throw new _(404,"Layout element was not found","not_found");let r=e.body?.style===void 0?o.style:e.body.style&&typeof e.body.style=="object"&&!Array.isArray(e.body.style)?e.body.style:(()=>{throw new _(400,"style must be an object","validation_error")})(),c=await d(t,`update public.hall_layout_elements
          set element_type = $3, label = $4, x = $5, y = $6, width = $7,
              height = $8, rotation = $9, style = $10::jsonb,
              sort_order = $11, active = $12, updated_at = now()
        where id = $1 and layout_id = $2
        returning *`,[s,n,e.body?.elementType===void 0?o.element_type:K(e.body.elementType,"elementType",rn),e.body?.label===void 0?o.label:g(e.body.label,160),Q(e.body?.x,Number(o.x),-1e4,1e4),Q(e.body?.y,Number(o.y),-1e4,1e4),Q(e.body?.width,Number(o.width),.1,1e4),Q(e.body?.height,Number(o.height),.1,1e4),Q(e.body?.rotation,Number(o.rotation),-3600,3600),JSON.stringify(r),k(e.body?.sortOrder,Number(o.sort_order),-1e6,1e6),e.body?.active===void 0?o.active:A(e.body.active)]);await T(t,e,{action:"layout.element.update",targetType:"layout_element",targetId:s,reason:g(e.body?.reason,1e3),before:o,after:c}),a.json({element:c})})),i.post("/events/:eventId/layout",p(async(e,a)=>{let n=$(e.params.eventId,"eventId"),s=$(e.body?.layoutId,"layoutId"),o=A(e.body?.confirmed),r=f(e.body?.reason,"reason",1e3),c=e.body?.tableMappings&&typeof e.body.tableMappings=="object"?e.body.tableMappings:{},u=await S(t,async l=>{let[m,y,b]=await Promise.all([d(l,"select id, title from public.events where id = $1",[n]),d(l,"select * from public.hall_layouts where id = $1 and status = 'published'",[s]),d(l,"select * from public.event_layout_assignments where event_id = $1 for update",[n])]);if(!m)throw new _(404,"Event was not found","not_found");if(!y)throw new _(404,"Published layout was not found","layout_not_found");let v=await w(l,`select id, table_id, status
           from public.booking_records
          where event_id = $1
            and status in ('new','pending','confirmed','checked_in')
          for update`,[n]),h=[],j=[];for(let I of v){let x=String(c[I.table_id]||"").trim();if(!x){j.push(I);continue}if(!await d(l,`select id from public.layout_tables
            where id = $1 and layout_id = $2 and active = true`,[x,s]))throw new _(400,`Mapped table ${x} is not active in the selected layout`,"invalid_table_mapping");h.push({bookingId:I.id,oldTableId:I.table_id,newTableId:x})}if(v.length&&(!o||j.length))throw new _(409,"Layout change affects active bookings and requires confirmation plus a table mapping for every booking","layout_assignment_conflict",{affectedBookingCount:v.length,unresolvedBookings:j,requiredMappingKeys:j.map(I=>I.table_id)});for(let I of h)await l.query(`update public.booking_records
              set layout_id = $2, table_id = $3, updated_at = now()
            where id = $1`,[I.bookingId,s,I.newTableId]);await l.query(`update public.booking_holds
            set status = 'released', released_at = now(), updated_at = now()
          where event_id = $1 and status = 'active'`,[n]);let N=await d(l,`insert into public.event_layout_assignments(
           event_id, layout_id, assigned_by_admin_id
         ) values ($1,$2,$3)
         on conflict (event_id) do update
           set layout_id = excluded.layout_id,
               assigned_by_admin_id = excluded.assigned_by_admin_id,
               updated_at = now()
         returning *`,[n,s,e.adminPrincipal.adminId]);return await l.query(`insert into public.event_layout_assignment_history(
           event_id, previous_layout_id, next_layout_id, affected_booking_count,
           conflict_count, confirmed, reason, changed_by_admin_id
         ) values ($1,$2,$3,$4,$5,$6,$7,$8)`,[n,b?.layout_id||null,s,v.length,v.length,o,r,e.adminPrincipal.adminId]),{event:m,layout:y,previousAssignment:b,assignment:N,mappedRows:h}});await T(t,e,{action:"event.layout.assign",targetType:"event",targetId:n,reason:r,before:u.previousAssignment,after:{assignment:u.assignment,mappedRows:u.mappedRows}}),a.json({assignment:u.assignment,mappedBookings:u.mappedRows})})),i.get("/bookings",p(async(e,a)=>{let n=e.query.eventId?$(e.query.eventId,"eventId"):null,s=e.query.status?K(e.query.status,"status",cn):null,o=String(e.query.search||"").trim().slice(0,160),r=await w(t,`select booking.*, event.title as event_title,
              layout_table.table_number, layout_table.name as table_name,
              app_user.name as app_user_name, app_user.username,
              clan.name as clan_name
         from public.booking_records booking
         join public.events event on event.id = booking.event_id
         join public.layout_tables layout_table on layout_table.id = booking.table_id
         join public.app_users app_user on app_user.user_key = booking.user_key
         left join public.clans clan on clan.id = booking.clan_id
        where ($1::text is null or booking.event_id = $1)
          and ($2::text is null or booking.status = $2)
          and ($3 = '' or lower(booking.customer_name) like '%' || lower($3) || '%'
            or lower(booking.phone) like '%' || lower($3) || '%'
            or lower(booking.booking_reference) like '%' || lower($3) || '%')
        order by booking.created_at desc
        limit 500`,[n,s,o]);a.json({bookings:r})})),i.patch("/bookings/:bookingId",p(async(e,a)=>{let n=$(e.params.bookingId,"bookingId"),s=K(e.body?.status,"status",cn),o=f(e.body?.reason,"reason",1e3),r=await S(t,async c=>{let u=await d(c,"select * from public.booking_records where id = $1 for update",[n]);if(!u)throw new _(404,"Booking was not found","not_found");let l=await d(c,`update public.booking_records
            set status = $2,
                confirmed_at = case when $2 = 'confirmed' then coalesce(confirmed_at, now()) else confirmed_at end,
                cancelled_at = case when $2 = 'cancelled' then now() else cancelled_at end,
                cancelled_by = case when $2 = 'cancelled' then $3 else cancelled_by end,
                checked_in_at = case when $2 = 'checked_in' then now() else checked_in_at end,
                no_show_at = case when $2 = 'no_show' then now() else no_show_at end,
                completed_at = case when $2 = 'completed' then now() else completed_at end,
                updated_at = now()
          where id = $1
          returning *`,[n,s,e.adminPrincipal.email]);return await c.query(`insert into public.booking_status_history(
           booking_id, previous_status, next_status, actor_type, actor_id,
           reason, before_value, after_value
         ) values ($1,$2,$3,'admin',$4,$5,$6::jsonb,$7::jsonb)`,[n,u.status,s,e.adminPrincipal.adminId,o,JSON.stringify(u),JSON.stringify(l)]),{before:u,after:l}});await T(t,e,{action:"booking.status.update",targetType:"booking",targetId:n,reason:o,before:r.before,after:r.after}),a.json({booking:r.after})})),i.get("/booking-settings",p(async(e,a)=>{let n=await d(t,"select * from public.booking_settings where singleton = true");a.json({settings:n})})),i.patch("/booking-settings",p(async(e,a)=>{let n=await d(t,"select * from public.booking_settings where singleton = true");if(!n)throw new _(500,"Booking settings are missing","booking_settings_missing");let s=await d(t,`update public.booking_settings
          set hold_seconds = $1, allow_capacity_override = $2, auto_confirm = $3,
              updated_by_admin_id = $4, updated_at = now()
        where singleton = true
        returning *`,[k(e.body?.holdSeconds,Number(n.hold_seconds),60,3600),e.body?.allowCapacityOverride===void 0?n.allow_capacity_override:A(e.body.allowCapacityOverride),e.body?.autoConfirm===void 0?n.auto_confirm:A(e.body.autoConfirm),e.adminPrincipal.adminId]);await T(t,e,{action:"booking.settings.update",targetType:"booking_settings",targetId:"singleton",reason:g(e.body?.reason,1e3),before:n,after:s}),a.json({settings:s})})),i}var qa,an,sn,on,rn,cn,dn=D(()=>{"use strict";ve();B();L();z();Z();ze();qa=["draft","published","archived"],an=["round","square","rectangle","sofa","custom"],sn=["regular","vip","bar","sofa","clan","service"],on=["available","unavailable","vip_only","clan_only"],rn=["stage","dance_floor","bar","entrance","exit","cloakroom","restroom","dj_zone","stairs","partition","decoration","label"],cn=["new","pending","confirmed","cancelled","checked_in","no_show","completed"]});async function re(t,i){if(!Number.isSafeInteger(i.amount)||i.amount===0)throw new _(400,"Point amount must be a non-zero safe integer","validation_error");return S(t,async e=>{let a=await d(e,"select * from public.point_ledger where idempotency_key = $1",[i.idempotencyKey]);if(a){if(a.user_key!==i.userKey||Number(a.amount)!==i.amount)throw new _(409,"Idempotency key was already used for another operation","idempotency_conflict");return{ledger:a,replayed:!0}}await e.query(`insert into public.point_accounts(user_key)
       values ($1)
       on conflict (user_key) do nothing`,[i.userKey]);let n=await d(e,"select * from public.point_accounts where user_key = $1 for update",[i.userKey]),s=Number(n?.balance||0),o=s+i.amount;if(o<0)throw new _(409,"Not enough BALI points","insufficient_points",{balance:s,required:Math.abs(i.amount)});return await e.query(`update public.point_accounts
          set balance = $2,
              lifetime_earned = lifetime_earned + case when $3 > 0 then $3 else 0 end,
              lifetime_spent = lifetime_spent + case when $3 < 0 then -$3 else 0 end,
              version = version + 1,
              updated_at = now()
        where user_key = $1`,[i.userKey,o,i.amount]),{ledger:await d(e,`insert into public.point_ledger(
         user_key, amount, balance_before, balance_after, operation_type,
         source_type, source_id, reason, administrator_id, idempotency_key, metadata
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
       returning *`,[i.userKey,i.amount,s,o,i.operationType,i.sourceType,i.sourceId||"",i.reason||"",i.administratorId||null,i.idempotencyKey,JSON.stringify(i.metadata||{})]),replayed:!1}})}var Me=D(()=>{"use strict";B();L()});async function mt(t,i,e=null){return S(t,async a=>{let n=await d(a,"select * from public.game_seasons where id = $1 for update",[i]);if(!n)throw new _(404,"Game season was not found","not_found");if(n.status==="completed"){let c=await w(a,`select user_key, position, reward_payload, status
           from public.game_prizes where season_id = $1 order by position`,[i]);return{season:n,winners:c,replayed:!0}}if(n.status==="scheduled"&&new Date(n.starts_at).getTime()>Date.now())throw new _(409,"A scheduled game season cannot be finalized before it starts","game_season_not_started");let s=await w(a,`select best.user_key, best.score,
              row_number() over (
                order by best.score desc, best.level desc, best.three_stars desc,
                         best.updated_at asc, best.user_key
              )::integer as position
         from (
           select user_key, sum(best_rating)::bigint as score,
                  max(level_number)::integer as level,
                  count(*) filter (where best_stars = 3)::integer as three_stars,
                  min(updated_at) as updated_at
             from public.game_level_results
            where season_id = $1
            group by user_key
         ) best
        order by position limit 10`,[i]),o=Array.isArray(n.rewards)?n.rewards:[];for(let c of s){let u=o[Number(c.position)-1]||{},l=`game-prize:${i}:${c.position}`,m=await d(a,`insert into public.game_prizes(
           season_id, user_key, position, reward_payload, idempotency_key
         ) values ($1,$2,$3,$4::jsonb,$5)
         on conflict (season_id, position) do nothing
         returning *`,[i,c.user_key,c.position,JSON.stringify(u),l]);if(!m)continue;let y=Number(u.points||0);Number.isSafeInteger(y)&&y>0&&await re(a,{userKey:c.user_key,amount:y,operationType:"credit",sourceType:"game_prize",sourceId:i,reason:`BALI Match: ${c.position} \u043C\u0435\u0441\u0442\u043E`,administratorId:e,idempotencyKey:`${l}:points`});for(let h of Array.isArray(u.rewardIds)?u.rewardIds:[]){let j=await d(a,"select * from public.reward_definitions where id = $1",[String(h)]);!j||!await d(a,`insert into public.user_rewards(
             reward_id, user_key, source_type, source_id, idempotency_key,
             granted_by_admin_id, metadata
           ) values ($1,$2,'game',$3,$4,$5,$6::jsonb)
           on conflict (idempotency_key) do nothing
           returning *`,[j.id,c.user_key,i,`${l}:reward:${j.id}`,e,JSON.stringify({position:c.position,score:c.score})])||(Number(j.points||0)>0&&await re(a,{userKey:c.user_key,amount:Number(j.points),operationType:"credit",sourceType:"reward",sourceId:j.id,reason:`\u041D\u0430\u0433\u0440\u0430\u0434\u0430: ${j.name}`,administratorId:e,idempotencyKey:`${l}:reward-points:${j.id}`}),await a.query(`update public.game_profiles set xp = xp + $2, updated_at = now()
            where user_key = $1`,[c.user_key,Number(j.xp||0)]))}let b=Number(u.vipDays||0),v=String(u.vipPlanId||"");if(v&&Number.isSafeInteger(b)&&b>0&&await d(a,"select id from public.vip_plans where id = $1",[v])){let j=await d(a,`select ends_at from public.user_vip_subscriptions
              where user_key = $1 and status in ('active','scheduled') and ends_at > now()
              order by ends_at desc limit 1 for update`,[c.user_key]),N=j?new Date(j.ends_at):new Date,I=new Date(N.getTime()+b*864e5);await a.query(`insert into public.user_vip_subscriptions(
               user_key, plan_id, source_type, starts_at, ends_at, status,
               issued_by_admin_id, idempotency_key
             ) values ($1,$2,'game_prize',$3,$4,$5,$6,$7)
             on conflict (idempotency_key) do nothing`,[c.user_key,v,N.toISOString(),I.toISOString(),N.getTime()>Date.now()?"scheduled":"active",e,`${l}:vip`]),await a.query(`update public.app_users
                set vip_expires_at = greatest(coalesce(vip_expires_at, $2), $2),
                    updated_at = now()
              where user_key = $1`,[c.user_key,I.toISOString()])}await a.query(`update public.game_prizes
            set status = 'issued', issued_by_admin_id = $2, issued_at = now()
          where id = $1`,[m.id,e]),await a.query(`insert into public.notifications(
           user_key, notification_type, title, body, data, idempotency_key
         ) values ($1,'game_prize','\u041D\u0430\u0433\u0440\u0430\u0434\u0430 BALI Match',$2,$3::jsonb,$4)
         on conflict (idempotency_key) do nothing`,[c.user_key,`${c.position} \u043C\u0435\u0441\u0442\u043E \u0432 \u043D\u0435\u0434\u0435\u043B\u044C\u043D\u043E\u043C \u0440\u0435\u0439\u0442\u0438\u043D\u0433\u0435. \u041D\u0430\u0433\u0440\u0430\u0434\u0430 \u043D\u0430\u0447\u0438\u0441\u043B\u0435\u043D\u0430.`,JSON.stringify({seasonId:i,position:c.position,score:c.score,payload:u}),`${l}:notification`])}return{season:await d(a,`update public.game_seasons set status = 'completed', updated_at = now()
        where id = $1 returning *`,[i]),winners:s,replayed:!1}})}async function ln(t){let i=await w(t,`select id from public.game_seasons
      where status = 'active' and ends_at <= now()
      order by ends_at limit 20`);for(let e of i)await mt(t,e.id)}var yt=D(()=>{"use strict";B();Me();L()});import{randomUUID as Ge}from"node:crypto";import{Router as es}from"express";function pe(t,i){if(!t||Array.isArray(t)||typeof t!="object")throw new _(400,`${i} must be an object`,"validation_error");return t}function be(t,i){if(!Array.isArray(t))throw new _(400,`${i} must be an array`,"validation_error");return t}async function Oe(t,i,e){if(!new Set(["reward_definitions","gift_catalog","vip_plans","shop_items","game_seasons"]).has(i))throw new Error("Unsupported administrator catalog table");let n=await d(t,`select * from public.${i} where id = $1`,[e]);if(!n)throw new _(404,"Catalog item was not found","not_found");return n}function yn(t){let i=es();return i.use(X),i.get("/economy",p(async(e,a)=>{let[n,s,o,r,c,u,l,m]=await Promise.all([d(t,"select * from public.economy_settings where singleton = true"),w(t,"select * from public.reward_definitions order by updated_at desc"),w(t,"select * from public.gift_catalog order by sort_order, name"),w(t,"select * from public.vip_plans order by sort_order, points_cost"),w(t,"select * from public.shop_items order by sort_order, name"),d(t,"select * from public.game_settings where singleton = true"),w(t,"select * from public.game_seasons order by starts_at desc"),w(t,"select * from public.game_symbol_versions order by created_at desc limit 200")]);a.json({settings:n,rewards:s,gifts:o,vipPlans:r,shopItems:c,gameSettings:u,seasons:l,gameSymbolVersions:m})})),i.patch("/economy/settings",p(async(e,a)=>{let n=await d(t,"select * from public.economy_settings where singleton = true");if(!n)throw new _(500,"Economy settings are missing","economy_settings_missing");let s=await d(t,`update public.economy_settings
          set registration_points = $1, profile_completion_points = $2,
              checkin_points = $3, invited_friend_points = $4,
              clan_activity_points = $5, updated_by_admin_id = $6,
              updated_at = now()
        where singleton = true returning *`,[k(e.body?.registrationPoints,Number(n.registration_points),0,1e9),k(e.body?.profileCompletionPoints,Number(n.profile_completion_points),0,1e9),k(e.body?.checkinPoints,Number(n.checkin_points),0,1e9),k(e.body?.invitedFriendPoints,Number(n.invited_friend_points),0,1e9),k(e.body?.clanActivityPoints,Number(n.clan_activity_points),0,1e9),e.adminPrincipal.adminId]);await T(t,e,{action:"economy.settings.update",targetType:"economy_settings",targetId:"singleton",reason:f(e.body?.reason,"reason",1e3),before:n,after:s}),a.json({settings:s})})),i.get("/points/ledger",p(async(e,a)=>{let n=e.query.userKey?$(e.query.userKey,"userKey"):null,s=await w(t,`select ledger.*, user_row.name, user_row.username, admin.email as administrator_email
         from public.point_ledger ledger
         join public.app_users user_row on user_row.user_key = ledger.user_key
         left join public.admin_users admin on admin.id = ledger.administrator_id
        where ($1::text is null or ledger.user_key = $1)
        order by ledger.created_at desc limit 1000`,[n]);a.json({ledger:s})})),i.post("/points/adjustments",p(async(e,a)=>{let n=$(e.body?.userKey,"userKey"),s=k(e.body?.amount,0,-1e9,1e9);if(!s)throw new _(400,"amount must not be zero","validation_error");let o=f(e.body?.reason,"reason",1e3),r=f(e.body?.idempotencyKey,"idempotencyKey",160),c=await re(t,{userKey:n,amount:s,operationType:"adjustment",sourceType:"admin",sourceId:e.adminPrincipal.adminId,reason:o,administratorId:e.adminPrincipal.adminId,idempotencyKey:`admin-adjustment:${r}`});await T(t,e,{action:"points.adjust",targetType:"app_user",targetId:n,reason:o,after:c.ledger}),a.status(c.replayed?200:201).json(c)})),i.post("/rewards",p(async(e,a)=>{let n=e.body?.id?$(e.body.id,"id"):`reward-${Ge()}`,s=e.body?.conditionConfig===void 0?{}:pe(e.body.conditionConfig,"conditionConfig"),o=await d(t,`insert into public.reward_definitions(
         id, name, icon_url, description, points, xp, rarity, condition_type,
         condition_config, event_id, clan_id, valid_from, valid_until,
         repeatable, max_grants_per_user, active, created_by_admin_id
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,$15,$16,$17)
       returning *`,[n,f(e.body?.name,"name",160),g(e.body?.iconUrl,2e3),g(e.body?.description,2e3),k(e.body?.points,0,0,1e9),k(e.body?.xp,0,0,1e9),K(e.body?.rarity||"common","rarity",_n),f(e.body?.conditionType||"manual","conditionType",100),JSON.stringify(s),e.body?.eventId?$(e.body.eventId,"eventId"):null,e.body?.clanId?$(e.body.clanId,"clanId"):null,E(e.body?.validFrom),E(e.body?.validUntil),A(e.body?.repeatable),k(e.body?.maxGrantsPerUser,1,1,1e6),A(e.body?.active,!0),e.adminPrincipal.adminId]);await T(t,e,{action:"reward.create",targetType:"reward_definition",targetId:n,after:o}),a.status(201).json({reward:o})})),i.patch("/rewards/:rewardId",p(async(e,a)=>{let n=$(e.params.rewardId,"rewardId"),s=await Oe(t,"reward_definitions",n),o=e.body?.conditionConfig===void 0?s.condition_config:pe(e.body.conditionConfig,"conditionConfig"),r=await d(t,`update public.reward_definitions
          set name = $2, icon_url = $3, description = $4, points = $5, xp = $6,
              rarity = $7, condition_type = $8, condition_config = $9::jsonb,
              valid_from = $10, valid_until = $11, repeatable = $12,
              max_grants_per_user = $13, active = $14, updated_at = now()
        where id = $1 returning *`,[n,e.body?.name===void 0?s.name:f(e.body.name,"name",160),e.body?.iconUrl===void 0?s.icon_url:g(e.body.iconUrl,2e3),e.body?.description===void 0?s.description:g(e.body.description,2e3),k(e.body?.points,Number(s.points),0,1e9),k(e.body?.xp,Number(s.xp),0,1e9),e.body?.rarity===void 0?s.rarity:K(e.body.rarity,"rarity",_n),e.body?.conditionType===void 0?s.condition_type:f(e.body.conditionType,"conditionType",100),JSON.stringify(o),e.body?.validFrom===void 0?s.valid_from:E(e.body.validFrom),e.body?.validUntil===void 0?s.valid_until:E(e.body.validUntil),e.body?.repeatable===void 0?s.repeatable:A(e.body.repeatable),k(e.body?.maxGrantsPerUser,Number(s.max_grants_per_user),1,1e6),e.body?.active===void 0?s.active:A(e.body.active)]);await T(t,e,{action:"reward.update",targetType:"reward_definition",targetId:n,reason:g(e.body?.reason,1e3),before:s,after:r}),a.json({reward:r})})),i.post("/rewards/:rewardId/grants",p(async(e,a)=>{let n=$(e.params.rewardId,"rewardId"),s=$(e.body?.userKey,"userKey"),o=f(e.body?.idempotencyKey,"idempotencyKey",160),r=await Oe(t,"reward_definitions",n),c=await S(t,async u=>{let l=await d(u,"select * from public.user_rewards where idempotency_key = $1",[`reward-grant:${o}`]);if(l)return{grant:l,replayed:!0};let m=await d(u,`select count(*)::integer as count from public.user_rewards
          where reward_id = $1 and user_key = $2 and status <> 'revoked'`,[n,s]);if(!r.repeatable&&Number(m?.count||0)>0)throw new _(409,"This reward has already been granted","reward_already_granted");if(Number(m?.count||0)>=Number(r.max_grants_per_user))throw new _(409,"Reward grant limit reached","reward_grant_limit");let y=null;Number(r.points)>0&&(y=(await re(u,{userKey:s,amount:Number(r.points),operationType:"credit",sourceType:"reward",sourceId:n,reason:`\u041D\u0430\u0433\u0440\u0430\u0434\u0430: ${r.name}`,administratorId:e.adminPrincipal.adminId,idempotencyKey:`reward-points:${o}`})).ledger.id);let b=await d(u,`insert into public.user_rewards(
           reward_id, user_key, source_type, source_id, idempotency_key,
           granted_by_admin_id, metadata
         ) values ($1,$2,'admin',$3,$4,$5,$6::jsonb)
         returning *`,[n,s,e.adminPrincipal.adminId,`reward-grant:${o}`,e.adminPrincipal.adminId,JSON.stringify({pointTransactionId:y})]);return await u.query(`update public.game_profiles
            set xp = xp + $2, updated_at = now()
          where user_key = $1`,[s,Number(r.xp||0)]),{grant:b,replayed:!1}});await T(t,e,{action:"reward.grant",targetType:"app_user",targetId:s,reason:f(e.body?.reason,"reason",1e3),after:c.grant}),a.status(c.replayed?200:201).json(c)})),i.post("/gifts/catalog",p(async(e,a)=>{let n=e.body?.id?$(e.body.id,"id"):`gift-${Ge()}`,s=await d(t,`insert into public.gift_catalog(
         id, name, description, image_url, gift_type, points_cost,
         validity_days, active, sort_order, created_by_admin_id
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       returning *`,[n,f(e.body?.name,"name",160),g(e.body?.description,2e3),g(e.body?.imageUrl,2e3),K(e.body?.giftType||"virtual","giftType",pn),k(e.body?.pointsCost,0,0,1e9),e.body?.validityDays===null?null:k(e.body?.validityDays,365,1,3650),A(e.body?.active,!0),k(e.body?.sortOrder,0,-1e6,1e6),e.adminPrincipal.adminId]);await T(t,e,{action:"gift.catalog.create",targetType:"gift_catalog",targetId:n,after:s}),a.status(201).json({gift:s})})),i.patch("/gifts/catalog/:itemId",p(async(e,a)=>{let n=$(e.params.itemId,"itemId"),s=await Oe(t,"gift_catalog",n),o=await d(t,`update public.gift_catalog
          set name = $2, description = $3, image_url = $4, gift_type = $5,
              points_cost = $6, validity_days = $7, active = $8,
              sort_order = $9, updated_at = now()
        where id = $1 returning *`,[n,e.body?.name===void 0?s.name:f(e.body.name,"name",160),e.body?.description===void 0?s.description:g(e.body.description,2e3),e.body?.imageUrl===void 0?s.image_url:g(e.body.imageUrl,2e3),e.body?.giftType===void 0?s.gift_type:K(e.body.giftType,"giftType",pn),k(e.body?.pointsCost,Number(s.points_cost),0,1e9),e.body?.validityDays===void 0?s.validity_days:e.body.validityDays===null?null:k(e.body.validityDays,365,1,3650),e.body?.active===void 0?s.active:A(e.body.active),k(e.body?.sortOrder,Number(s.sort_order),-1e6,1e6)]);await T(t,e,{action:"gift.catalog.update",targetType:"gift_catalog",targetId:n,reason:g(e.body?.reason,1e3),before:s,after:o}),a.json({gift:o})})),i.post("/gifts/grants",p(async(e,a)=>{let n=$(e.body?.catalogItemId,"catalogItemId"),s=$(e.body?.userKey,"userKey"),o=f(e.body?.reason,"reason",1e3),r=f(e.body?.idempotencyKey,"idempotencyKey",160),c=g(e.body?.message,500),u;try{u=await S(t,async l=>{let m=await d(l,"select * from public.gifts where idempotency_key = $1",[`admin-gift:${r}`]);if(m){if(m.recipient_user_key!==s||m.catalog_item_id!==n)throw new _(409,"Idempotency key was used for another gift","idempotency_conflict");return{gift:m,replayed:!0}}let[y,b]=await Promise.all([d(l,"select * from public.gift_catalog where id = $1",[n]),d(l,"select user_key from public.app_users where user_key = $1 and account_status = 'active'",[s])]);if(!y)throw new _(404,"Gift catalog item was not found","not_found");if(!b)throw new _(404,"Active recipient was not found","not_found");let v=await d(l,`insert into public.gifts(
           catalog_item_id, sender_user_key, recipient_user_key, points_cost,
           message, status, qr_token_hash, expires_at, idempotency_key
         ) values (
           $1,null,$2,0,$3,'delivered',null,
           case when $4::integer is null then null else now() + make_interval(days => $4) end,
           $5
         ) returning *`,[n,s,c,y.validity_days,`admin-gift:${r}`]);return await l.query(`insert into public.notifications(
           user_key, notification_type, title, body, data, idempotency_key
         ) values ($1,'gift_received','\u041F\u043E\u0434\u0430\u0440\u043E\u043A \u043E\u0442 BALI',$2,$3::jsonb,$4)
         on conflict (idempotency_key) do nothing`,[s,c||`\u0412\u0430\u043C \u0432\u044B\u0434\u0430\u043D \u043F\u043E\u0434\u0430\u0440\u043E\u043A \xAB${y.name}\xBB.`,JSON.stringify({giftId:v.id,catalogItemId:n}),`admin-gift-notification:${r}`]),{gift:v,replayed:!1}})}catch(l){if(l?.code!=="23505")throw l;let m=await d(t,"select * from public.gifts where idempotency_key = $1",[`admin-gift:${r}`]);if(!m||m.recipient_user_key!==s||m.catalog_item_id!==n)throw new _(409,"Idempotency key was used for another gift","idempotency_conflict");u={gift:m,replayed:!0}}await T(t,e,{action:"gift.grant",targetType:"app_user",targetId:s,reason:o,after:u.gift}),a.status(u.replayed?200:201).json(u)})),i.post("/vip/plans",p(async(e,a)=>{let n=e.body?.id?$(e.body.id,"id"):`vip-${Ge()}`,s=await d(t,`insert into public.vip_plans(
         id, name, points_cost, duration_days, benefits, points_multiplier,
         extra_game_lives, event_access, shop_access, booking_priority,
         profile_frame_url, badge_url, active, sort_order, created_by_admin_id
       ) values ($1,$2,$3,$4,$5::jsonb,$6,$7,$8::jsonb,$9::jsonb,$10,$11,$12,$13,$14,$15)
       returning *`,[n,f(e.body?.name,"name",160),k(e.body?.pointsCost,0,0,1e9),k(e.body?.durationDays,30,1,3650),JSON.stringify(be(e.body?.benefits||[],"benefits")),Q(e.body?.pointsMultiplier,1,1,100),k(e.body?.extraGameLives,0,0,1e3),JSON.stringify(be(e.body?.eventAccess||[],"eventAccess")),JSON.stringify(be(e.body?.shopAccess||[],"shopAccess")),k(e.body?.bookingPriority,0,-1e3,1e3),g(e.body?.profileFrameUrl,2e3),g(e.body?.badgeUrl,2e3),A(e.body?.active,!0),k(e.body?.sortOrder,0,-1e6,1e6),e.adminPrincipal.adminId]);await T(t,e,{action:"vip.plan.create",targetType:"vip_plan",targetId:n,after:s}),a.status(201).json({vipPlan:s})})),i.patch("/vip/plans/:planId",p(async(e,a)=>{let n=$(e.params.planId,"planId"),s=await Oe(t,"vip_plans",n),o=await d(t,`update public.vip_plans
          set name = $2, points_cost = $3, duration_days = $4, benefits = $5::jsonb,
              points_multiplier = $6, extra_game_lives = $7,
              event_access = $8::jsonb, shop_access = $9::jsonb,
              booking_priority = $10, profile_frame_url = $11,
              badge_url = $12, active = $13, sort_order = $14, updated_at = now()
        where id = $1 returning *`,[n,e.body?.name===void 0?s.name:f(e.body.name,"name",160),k(e.body?.pointsCost,Number(s.points_cost),0,1e9),k(e.body?.durationDays,Number(s.duration_days),1,3650),JSON.stringify(e.body?.benefits===void 0?s.benefits:be(e.body.benefits,"benefits")),Q(e.body?.pointsMultiplier,Number(s.points_multiplier),1,100),k(e.body?.extraGameLives,Number(s.extra_game_lives),0,1e3),JSON.stringify(e.body?.eventAccess===void 0?s.event_access:be(e.body.eventAccess,"eventAccess")),JSON.stringify(e.body?.shopAccess===void 0?s.shop_access:be(e.body.shopAccess,"shopAccess")),k(e.body?.bookingPriority,Number(s.booking_priority),-1e3,1e3),e.body?.profileFrameUrl===void 0?s.profile_frame_url:g(e.body.profileFrameUrl,2e3),e.body?.badgeUrl===void 0?s.badge_url:g(e.body.badgeUrl,2e3),e.body?.active===void 0?s.active:A(e.body.active),k(e.body?.sortOrder,Number(s.sort_order),-1e6,1e6)]);await T(t,e,{action:"vip.plan.update",targetType:"vip_plan",targetId:n,reason:g(e.body?.reason,1e3),before:s,after:o}),a.json({vipPlan:o})})),i.post("/vip/grants",p(async(e,a)=>{let n=$(e.body?.planId,"planId"),s=$(e.body?.userKey,"userKey"),o=f(e.body?.reason,"reason",1e3),r=f(e.body?.idempotencyKey,"idempotencyKey",160),c;try{c=await S(t,async u=>{let l=await d(u,"select * from public.user_vip_subscriptions where idempotency_key = $1",[`admin-vip:${r}`]);if(l){if(l.user_key!==s||l.plan_id!==n)throw new _(409,"Idempotency key was used for another VIP grant","idempotency_conflict");return{subscription:l,replayed:!0}}let[m,y,b]=await Promise.all([d(u,"select * from public.vip_plans where id = $1",[n]),d(u,"select user_key from public.app_users where user_key = $1 and account_status = 'active'",[s]),d(u,`select ends_at from public.user_vip_subscriptions
            where user_key = $1 and status in ('active','scheduled') and ends_at > now()
            order by ends_at desc limit 1 for update`,[s])]);if(!m)throw new _(404,"VIP plan was not found","not_found");if(!y)throw new _(404,"Active user was not found","not_found");let v=k(e.body?.durationDays,Number(m.duration_days),1,3650),h=b?new Date(b.ends_at):new Date,j=new Date(h.getTime()+v*864e5),N=await d(u,`insert into public.user_vip_subscriptions(
           user_key, plan_id, source_type, starts_at, ends_at, status,
           issued_by_admin_id, idempotency_key
         ) values ($1,$2,'admin',$3,$4,$5,$6,$7)
         returning *`,[s,n,h.toISOString(),j.toISOString(),h.getTime()>Date.now()?"scheduled":"active",e.adminPrincipal.adminId,`admin-vip:${r}`]);return await u.query("update public.app_users set vip_expires_at = $2, updated_at = now() where user_key = $1",[s,j.toISOString()]),await u.query(`insert into public.notifications(
           user_key, notification_type, title, body, data, idempotency_key
         ) values ($1,'vip_granted','VIP \u043E\u0442 BALI',$2,$3::jsonb,$4)
         on conflict (idempotency_key) do nothing`,[s,`\u0412\u0430\u043C \u0432\u044B\u0434\u0430\u043D VIP \xAB${m.name}\xBB \u043D\u0430 ${v} \u0434\u043D.`,JSON.stringify({subscriptionId:N.id,planId:n,endsAt:j.toISOString()}),`admin-vip-notification:${r}`]),{subscription:N,replayed:!1}})}catch(u){if(u?.code!=="23505")throw u;let l=await d(t,"select * from public.user_vip_subscriptions where idempotency_key = $1",[`admin-vip:${r}`]);if(!l||l.user_key!==s||l.plan_id!==n)throw new _(409,"Idempotency key was used for another VIP grant","idempotency_conflict");c={subscription:l,replayed:!0}}await T(t,e,{action:"vip.grant",targetType:"app_user",targetId:s,reason:o,after:c.subscription}),a.status(c.replayed?200:201).json(c)})),i.post("/vip/subscriptions/:subscriptionId/revoke",p(async(e,a)=>{let n=P(e.params.subscriptionId,"subscriptionId"),s=f(e.body?.reason,"reason",1e3),o=await S(t,async r=>{let c=await d(r,"select * from public.user_vip_subscriptions where id = $1 for update",[n]);if(!c)throw new _(404,"VIP subscription was not found","not_found");if(c.status==="revoked")return{before:c,subscription:c,replayed:!0};let u=await d(r,`update public.user_vip_subscriptions
            set status = 'revoked', revoked_by_admin_id = $2, revoked_at = now(),
                revocation_reason = $3, updated_at = now()
          where id = $1 returning *`,[n,e.adminPrincipal.adminId,s]),l=await d(r,`select max(ends_at) as vip_expires_at
           from public.user_vip_subscriptions
          where user_key = $1 and id <> $2
            and status in ('active','scheduled') and ends_at > now()`,[c.user_key,n]);return await r.query("update public.app_users set vip_expires_at = $2, updated_at = now() where user_key = $1",[c.user_key,l?.vip_expires_at||null]),{before:c,subscription:u,replayed:!1}});o.replayed||await T(t,e,{action:"vip.revoke",targetType:"user_vip_subscription",targetId:n,reason:s,before:o.before,after:o.subscription}),a.json({subscription:o.subscription,replayed:o.replayed})})),i.post("/shop/items",p(async(e,a)=>{let n=e.body?.id?$(e.body.id,"id"):`shop-${Ge()}`,s=e.body?.metadata===void 0?{}:pe(e.body.metadata,"metadata"),o=await d(t,`insert into public.shop_items(
         id, name, description, image_url, category, points_cost, stock,
         valid_from, valid_until, status, per_user_limit, requires_redemption,
         sort_order, metadata, created_by_admin_id
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15)
       returning *`,[n,f(e.body?.name,"name",160),g(e.body?.description,2e3),g(e.body?.imageUrl,2e3),f(e.body?.category||"other","category",100),k(e.body?.pointsCost,0,0,1e9),e.body?.stock===null?null:k(e.body?.stock,0,0,1e9),E(e.body?.validFrom),E(e.body?.validUntil),K(e.body?.status||"draft","status",mn),e.body?.perUserLimit===null?null:k(e.body?.perUserLimit,1,1,1e6),A(e.body?.requiresRedemption),k(e.body?.sortOrder,0,-1e6,1e6),JSON.stringify(s),e.adminPrincipal.adminId]);await T(t,e,{action:"shop.item.create",targetType:"shop_item",targetId:n,after:o}),a.status(201).json({shopItem:o})})),i.patch("/shop/items/:itemId",p(async(e,a)=>{let n=$(e.params.itemId,"itemId"),s=await Oe(t,"shop_items",n),o=e.body?.metadata===void 0?s.metadata:pe(e.body.metadata,"metadata"),r=await d(t,`update public.shop_items
          set name = $2, description = $3, image_url = $4, category = $5,
              points_cost = $6, stock = $7, valid_from = $8, valid_until = $9,
              status = $10, per_user_limit = $11, requires_redemption = $12,
              sort_order = $13, metadata = $14::jsonb, updated_at = now()
        where id = $1 returning *`,[n,e.body?.name===void 0?s.name:f(e.body.name,"name",160),e.body?.description===void 0?s.description:g(e.body.description,2e3),e.body?.imageUrl===void 0?s.image_url:g(e.body.imageUrl,2e3),e.body?.category===void 0?s.category:f(e.body.category,"category",100),k(e.body?.pointsCost,Number(s.points_cost),0,1e9),e.body?.stock===void 0?s.stock:e.body.stock===null?null:k(e.body.stock,0,0,1e9),e.body?.validFrom===void 0?s.valid_from:E(e.body.validFrom),e.body?.validUntil===void 0?s.valid_until:E(e.body.validUntil),e.body?.status===void 0?s.status:K(e.body.status,"status",mn),e.body?.perUserLimit===void 0?s.per_user_limit:e.body.perUserLimit===null?null:k(e.body.perUserLimit,1,1,1e6),e.body?.requiresRedemption===void 0?s.requires_redemption:A(e.body.requiresRedemption),k(e.body?.sortOrder,Number(s.sort_order),-1e6,1e6),JSON.stringify(o)]);await T(t,e,{action:"shop.item.update",targetType:"shop_item",targetId:n,reason:g(e.body?.reason,1e3),before:s,after:r}),a.json({shopItem:r})})),i.patch("/game/settings",p(async(e,a)=>{let n=await d(t,"select * from public.game_settings where singleton = true");if(!n)throw new _(500,"Game settings are missing","game_settings_missing");let s=A(e.body?.resetSymbols),o=A(e.body?.resetPrizes),r=A(e.body?.resetGameRules),c=s?n.original_symbols:e.body?.symbols===void 0?n.symbols:be(e.body.symbols,"symbols"),u=await d(t,`update public.game_settings
          set base_lives = $1, continue_points_cost = $2, ranking_period_days = $3,
              max_score_per_second = $4, symbols = $5::jsonb,
              default_prizes = $6::jsonb, game_title = $7, game_subtitle = $8,
              background_image_url = $9, reward_image_url = $10,
              level_rules = $11::jsonb, scoring_rules = $12::jsonb,
              rating_rules = $13::jsonb, economy_rules = $14::jsonb,
              lives_rules = $15::jsonb, clan_rules = $16::jsonb,
              updated_by_admin_id = $17, updated_at = now()
        where singleton = true returning *`,[k(e.body?.baseLives,Number(n.base_lives),1,100),k(e.body?.continuePointsCost,Number(n.continue_points_cost),0,1e9),k(e.body?.rankingPeriodDays,Number(n.ranking_period_days),1,366),Q(e.body?.maxScorePerSecond,Number(n.max_score_per_second),1,1e6),JSON.stringify(c),JSON.stringify(o?n.original_prizes:e.body?.defaultPrizes===void 0?n.default_prizes:be(e.body.defaultPrizes,"defaultPrizes")),e.body?.gameTitle===void 0?n.game_title:f(e.body.gameTitle,"gameTitle",160),e.body?.gameSubtitle===void 0?n.game_subtitle:f(e.body.gameSubtitle,"gameSubtitle",300),e.body?.backgroundImageUrl===void 0?n.background_image_url:g(e.body.backgroundImageUrl,2e3),e.body?.rewardImageUrl===void 0?n.reward_image_url:g(e.body.rewardImageUrl,2e3),JSON.stringify(r?n.original_level_rules:e.body?.levelRules===void 0?n.level_rules:pe(e.body.levelRules,"levelRules")),JSON.stringify(r?n.original_scoring_rules:e.body?.scoringRules===void 0?n.scoring_rules:pe(e.body.scoringRules,"scoringRules")),JSON.stringify(r?n.original_rating_rules:e.body?.ratingRules===void 0?n.rating_rules:pe(e.body.ratingRules,"ratingRules")),JSON.stringify(r?n.original_economy_rules:e.body?.economyRules===void 0?n.economy_rules:pe(e.body.economyRules,"economyRules")),JSON.stringify(r?n.original_lives_rules:e.body?.livesRules===void 0?n.lives_rules:pe(e.body.livesRules,"livesRules")),JSON.stringify(r?n.original_clan_rules:e.body?.clanRules===void 0?n.clan_rules:pe(e.body.clanRules,"clanRules")),e.adminPrincipal.adminId]);for(let l of c){let m=Array.isArray(n.symbols)?n.symbols.find(v=>String(v.key)===String(l?.key)):null,y=String(l?.imageUrl||l?.defaultImageUrl||""),b=String(m?.imageUrl||m?.defaultImageUrl||"");!l?.key||!y||y===b||(await t.query("update public.game_symbol_versions set active = false where symbol_key = $1",[String(l.key)]),await t.query(`insert into public.game_symbol_versions(
           symbol_key, label, image_url, width, height, source, active, created_by_admin_id
         ) values ($1,$2,$3,512,512,$4,true,$5)`,[String(l.key),String(l.label||l.key),y,s?"restored":"custom",e.adminPrincipal.adminId]))}await T(t,e,{action:"game.settings.update",targetType:"game_settings",targetId:"singleton",reason:f(e.body?.reason,"reason",1e3),before:n,after:u}),a.json({settings:u})})),i.get("/game/symbols/:symbolKey/versions",p(async(e,a)=>{let n=$(e.params.symbolKey,"symbolKey"),s=await w(t,`select * from public.game_symbol_versions
        where symbol_key = $1 order by created_at desc limit 50`,[n]);a.json({symbolKey:n,recommendedWidth:512,recommendedHeight:512,versions:s})})),i.post("/game/symbols/:symbolKey/versions/:versionId/restore",p(async(e,a)=>{let n=$(e.params.symbolKey,"symbolKey"),s=P(e.params.versionId,"versionId"),o=await d(t,"select * from public.game_settings where singleton = true"),r=await d(t,"select * from public.game_symbol_versions where id = $1 and symbol_key = $2",[s,n]);if(!o||!r)throw new _(404,"Game symbol version was not found","not_found");let c=(Array.isArray(o.symbols)?o.symbols:[]).map(l=>String(l.key)===n?{...l,imageUrl:r.image_url,active:!0}:l),u=await d(t,`update public.game_settings
          set symbols = $1::jsonb, updated_by_admin_id = $2, updated_at = now()
        where singleton = true returning *`,[JSON.stringify(c),e.adminPrincipal.adminId]);await t.query(`update public.game_symbol_versions set active = (id = $2)
        where symbol_key = $1`,[n,s]),await T(t,e,{action:"game.symbol.version.restore",targetType:"game_symbol",targetId:n,reason:f(e.body?.reason,"reason",1e3),before:o,after:u}),a.json({settings:u,version:r})})),i.post("/game/seasons",p(async(e,a)=>{let n=E(e.body?.startsAt),s=E(e.body?.endsAt);if(!n||!s||new Date(s)<=new Date(n))throw new _(400,"A valid season date range is required","validation_error");let o=await d(t,`select id, name from public.game_seasons
        where status in ('scheduled','active')
          and starts_at < $2 and $1 < ends_at
        limit 1`,[n,s]);if(o)throw new _(409,"Game season overlaps another open season","game_season_overlap",{seasonId:o.id,seasonName:o.name});let r=await d(t,`insert into public.game_seasons(
         name, description, starts_at, ends_at, status, rewards,
         configuration, progress_mode, created_by_admin_id
       ) values ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9)
       returning *`,[f(e.body?.name,"name",160),g(e.body?.description,1e3),n,s,K(e.body?.status||"scheduled","status",ts),JSON.stringify(be(e.body?.rewards||[],"rewards")),JSON.stringify(e.body?.configuration===void 0?{}:pe(e.body.configuration,"configuration")),K(e.body?.progressMode||"account_keep_season_reset","progressMode",["account_keep_season_reset","carry_all","reset_all"]),e.adminPrincipal.adminId]);await T(t,e,{action:"game.season.create",targetType:"game_season",targetId:r.id,after:r}),a.status(201).json({season:r})})),i.post("/game/seasons/:seasonId/finalize",p(async(e,a)=>{let n=P(e.params.seasonId,"seasonId"),s=f(e.body?.reason,"reason",1e3),o=await mt(t,n,e.adminPrincipal.adminId);await T(t,e,{action:"game.season.finalize",targetType:"game_season",targetId:n,reason:s,after:o}),a.json(o)})),i.post("/game/sessions/:sessionId/exclude",p(async(e,a)=>{let n=P(e.params.sessionId,"sessionId"),s=f(e.body?.reason,"reason",1e3),o=await d(t,"select * from public.game_sessions where id = $1",[n]);if(!o)throw new _(404,"Game session was not found","not_found");let r=await d(t,`update public.game_sessions
          set status = 'excluded', suspicious = true,
              excluded_by_admin_id = $2, exclusion_reason = $3, updated_at = now()
        where id = $1 returning *`,[n,e.adminPrincipal.adminId,s]);await T(t,e,{action:"game.session.exclude",targetType:"game_session",targetId:n,reason:s,before:o,after:r}),a.json({session:r})})),i}var _n,pn,mn,ts,bn=D(()=>{"use strict";ve();B();Me();L();yt();z();Z();_n=["common","rare","epic","legendary"],pn=["virtual","physical"],mn=["draft","active","sold_out","archived"],ts=["scheduled","active","completed","archived"]});import{randomUUID as ns}from"node:crypto";import{writeFile as as}from"node:fs/promises";import ss from"node:path";import os from"express";import{Router as is}from"express";function ds(t,i){return i==="image/png"?t.length>=24&&t.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):i==="image/jpeg"?t.length>=4&&t[0]===255&&t[1]===216:i==="image/webp"?t.length>=12&&t.toString("ascii",0,4)==="RIFF"&&t.toString("ascii",8,12)==="WEBP":!1}function Fe(t,i){if(!t||Array.isArray(t)||typeof t!="object")throw new _(400,`${i} must be an object`,"validation_error");return t}function ce(t,i){return t==null||t===""?null:k(t,0,1,1e5)}function fn(t){let i=t===void 0?{}:Fe(t,"segment");return{userKeys:i.userKeys===void 0||i.userKeys===null?null:Array.isArray(i.userKeys)?[...new Set(i.userKeys.map(a=>$(a,"userKey")))].slice(0,1e4):(()=>{throw new _(400,"segment.userKeys must be an array","validation_error")})(),marketingOnly:A(i.marketingOnly),clanId:i.clanId?$(i.clanId,"clanId"):null,hasVip:i.hasVip===void 0||i.hasVip===null?null:A(i.hasVip)}}async function gn(t,i){return w(t,`select user_row.user_key, user_row.name, account.telegram_user_id,
            coalesce(preferences.telegram_enabled, true) as telegram_enabled,
            coalesce(consent.marketing_opt_in, false) as marketing_opt_in
       from public.app_users user_row
       join public.telegram_accounts account on account.app_user_key = user_row.user_key
       left join public.user_consents consent on consent.user_key = user_row.user_key
       left join public.notification_preferences preferences on preferences.user_key = user_row.user_key
      where user_row.account_status = 'active' and user_row.blocked_at is null
        and ($1::text[] is null or user_row.user_key = any($1::text[]))
        and ($2::boolean = false or coalesce(consent.marketing_opt_in, false) = true)
        and ($3::text is null or exists (
          select 1 from public.clan_memberships membership
           where membership.user_key = user_row.user_key
             and membership.clan_id = $3 and membership.status = 'active'
        ))
        and ($4::boolean is null or exists (
          select 1 from public.user_vip_subscriptions vip
           where vip.user_key = user_row.user_key
             and vip.status = 'active' and vip.starts_at <= now() and vip.ends_at > now()
        ) = $4)
      order by user_row.user_key`,[i.userKeys,i.marketingOnly,i.clanId,i.hasVip])}function hn(t,i){let e=is();return e.use(X),e.post("/content/uploads",os.raw({type:["image/png","image/jpeg","image/webp"],limit:"12mb"}),p(async(a,n)=>{await O(t,a,"content.upload",M(a));let s=String(a.get("content-type")||"").split(";")[0].trim().toLowerCase(),o=us.get(s),r=Buffer.isBuffer(a.body)?a.body:Buffer.alloc(0);if(!o||!ds(r,s))throw new _(400,"Only valid PNG, JPG and WEBP images are accepted","invalid_image");let c=`${ns()}.${o}`;await as(ss.join(i,c),r,{flag:"wx",mode:416});let u=`/uploads/${c}`;await T(t,a,{action:"content.upload.create",targetType:"uploaded_asset",targetId:c,after:{url:u,mimeType:s,bytes:r.length}}),n.status(201).json({upload:{url:u,mimeType:s,bytes:r.length}})})),e.get("/content",p(async(a,n)=>{let[s,o,r]=await Promise.all([w(t,"select * from public.admin_assets order by asset_key"),w(t,"select * from public.ui_content_blocks order by scope, sort_order, block_key"),w(t,"select * from public.ui_navigation_items order by app_type, sort_order, item_key")]);n.json({assets:s,blocks:o,navigation:r})})),e.post("/content/assets",p(async(a,n)=>{let s=$(a.body?.assetKey,"assetKey"),o=f(a.body?.url,"url",4e3),r=await d(t,`insert into public.admin_assets(
         asset_key, name, default_name, url, default_url, media_type, mime_type,
         width, height, recommended_width, recommended_height,
         max_bytes, alt_text, updated_by_admin_id
       ) values ($1,$2,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       returning *`,[s,f(a.body?.name,"name",200),o,g(a.body?.defaultUrl,4e3)||o,K(a.body?.mediaType||"image","mediaType",wn),g(a.body?.mimeType,200),ce(a.body?.width,"width"),ce(a.body?.height,"height"),ce(a.body?.recommendedWidth,"recommendedWidth"),ce(a.body?.recommendedHeight,"recommendedHeight"),a.body?.maxBytes===void 0||a.body.maxBytes===null?null:k(a.body.maxBytes,0,1,1e8),g(a.body?.altText,500),a.adminPrincipal.adminId]);await T(t,a,{action:"content.asset.create",targetType:"admin_asset",targetId:s,after:r}),n.status(201).json({asset:r})})),e.patch("/content/assets/:assetKey",p(async(a,n)=>{let s=$(a.params.assetKey,"assetKey"),o=await d(t,"select * from public.admin_assets where asset_key = $1",[s]);if(!o)throw new _(404,"Asset was not found","not_found");let r=A(a.body?.reset),c=await d(t,`update public.admin_assets
          set name = $2, url = $3, media_type = $4, mime_type = $5,
              width = $6, height = $7, recommended_width = $8,
              recommended_height = $9, max_bytes = $10, alt_text = $11,
              updated_by_admin_id = $12, updated_at = now()
        where asset_key = $1 returning *`,[s,r?o.default_name:a.body?.name===void 0?o.name:f(a.body.name,"name",200),r?o.default_url:a.body?.url===void 0?o.url:f(a.body.url,"url",4e3),a.body?.mediaType===void 0?o.media_type:K(a.body.mediaType,"mediaType",wn),a.body?.mimeType===void 0?o.mime_type:g(a.body.mimeType,200),a.body?.width===void 0?o.width:ce(a.body.width,"width"),a.body?.height===void 0?o.height:ce(a.body.height,"height"),a.body?.recommendedWidth===void 0?o.recommended_width:ce(a.body.recommendedWidth,"recommendedWidth"),a.body?.recommendedHeight===void 0?o.recommended_height:ce(a.body.recommendedHeight,"recommendedHeight"),a.body?.maxBytes===void 0?o.max_bytes:a.body.maxBytes===null?null:k(a.body.maxBytes,0,1,1e8),a.body?.altText===void 0?o.alt_text:g(a.body.altText,500),a.adminPrincipal.adminId]);await T(t,a,{action:r?"content.asset.reset":"content.asset.update",targetType:"admin_asset",targetId:s,reason:g(a.body?.reason,1e3),before:o,after:c}),n.json({asset:c})})),e.post("/content/blocks",p(async(a,n)=>{let s=K(a.body?.scope,"scope",rs),o=$(a.body?.blockKey,"blockKey"),r=a.body?.configuration===void 0?{}:Fe(a.body.configuration,"configuration"),c=a.body?.defaultValue===void 0?{name:f(a.body?.name,"name",200),title:g(a.body?.title,500),subtitle:g(a.body?.subtitle,1e3),assetKey:a.body?.assetKey||null,configuration:r}:Fe(a.body.defaultValue,"defaultValue"),u=await d(t,`insert into public.ui_content_blocks(
         scope, block_key, name, title, subtitle, asset_key,
         configuration, default_value, recommended_width, recommended_height,
         active, sort_order, updated_by_admin_id
       ) values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11,$12,$13)
       returning *`,[s,o,f(a.body?.name,"name",200),g(a.body?.title,500),g(a.body?.subtitle,1e3),a.body?.assetKey?$(a.body.assetKey,"assetKey"):null,JSON.stringify(r),JSON.stringify(c),ce(a.body?.recommendedWidth,"recommendedWidth"),ce(a.body?.recommendedHeight,"recommendedHeight"),A(a.body?.active,!0),k(a.body?.sortOrder,0,-1e6,1e6),a.adminPrincipal.adminId]);await T(t,a,{action:"content.block.create",targetType:"ui_content_block",targetId:u.id,after:u}),n.status(201).json({block:u})})),e.patch("/content/blocks/:blockId",p(async(a,n)=>{let s=String(a.params.blockId||"");if(!/^[0-9a-f-]{36}$/i.test(s))throw new _(400,"blockId is invalid","validation_error");let o=await d(t,"select * from public.ui_content_blocks where id = $1",[s]);if(!o)throw new _(404,"Content block was not found","not_found");let r=A(a.body?.reset),c=o.default_value||{},u=r?c.configuration||{}:a.body?.configuration===void 0?o.configuration:Fe(a.body.configuration,"configuration"),l=await d(t,`update public.ui_content_blocks
          set name = $2, title = $3, subtitle = $4, asset_key = $5,
              configuration = $6::jsonb, recommended_width = $7,
              recommended_height = $8, active = $9, sort_order = $10,
              updated_by_admin_id = $11, updated_at = now()
        where id = $1 returning *`,[s,r?String(c.name||o.name):a.body?.name===void 0?o.name:f(a.body.name,"name",200),r?String(c.title||""):a.body?.title===void 0?o.title:g(a.body.title,500),r?String(c.subtitle||""):a.body?.subtitle===void 0?o.subtitle:g(a.body.subtitle,1e3),r?c.assetKey||null:a.body?.assetKey===void 0?o.asset_key:a.body.assetKey?$(a.body.assetKey,"assetKey"):null,JSON.stringify(u),a.body?.recommendedWidth===void 0?o.recommended_width:ce(a.body.recommendedWidth,"recommendedWidth"),a.body?.recommendedHeight===void 0?o.recommended_height:ce(a.body.recommendedHeight,"recommendedHeight"),a.body?.active===void 0?o.active:A(a.body.active),k(a.body?.sortOrder,Number(o.sort_order),-1e6,1e6),a.adminPrincipal.adminId]);await T(t,a,{action:r?"content.block.reset":"content.block.update",targetType:"ui_content_block",targetId:s,reason:g(a.body?.reason,1e3),before:o,after:l}),n.json({block:l})})),e.patch("/content/navigation/:itemId",p(async(a,n)=>{let s=String(a.params.itemId||"");if(!/^[0-9a-f-]{36}$/i.test(s))throw new _(400,"itemId is invalid","validation_error");let o=await d(t,"select * from public.ui_navigation_items where id = $1",[s]);if(!o)throw new _(404,"Navigation item was not found","not_found");let r=A(a.body?.reset),c=await d(t,`update public.ui_navigation_items
          set app_type = $2, label = $3, route = $4, icon_url = $5,
              recommended_width = $6, recommended_height = $7,
              active = $8, sort_order = $9, updated_by_admin_id = $10,
              updated_at = now()
        where id = $1 returning *`,[s,a.body?.appType===void 0?o.app_type:K(a.body.appType,"appType",cs),r?o.default_label:a.body?.label===void 0?o.label:f(a.body.label,"label",120),r?o.default_route:a.body?.route===void 0?o.route:f(a.body.route,"route",200),r?o.default_icon_url:a.body?.iconUrl===void 0?o.icon_url:g(a.body.iconUrl,4e3),k(a.body?.recommendedWidth,Number(o.recommended_width),1,1e4),k(a.body?.recommendedHeight,Number(o.recommended_height),1,1e4),a.body?.active===void 0?o.active:A(a.body.active),k(a.body?.sortOrder,Number(o.sort_order),-1e6,1e6),a.adminPrincipal.adminId]);await T(t,a,{action:r?"content.navigation.reset":"content.navigation.update",targetType:"ui_navigation_item",targetId:s,reason:g(a.body?.reason,1e3),before:o,after:c}),n.json({item:c})})),e.get("/campaigns",p(async(a,n)=>{let s=await w(t,`select campaign.*, creator.email as creator_email, confirmer.email as confirmer_email
         from public.crm_campaigns campaign
         left join public.admin_users creator on creator.id = campaign.created_by_admin_id
         left join public.admin_users confirmer on confirmer.id = campaign.confirmed_by_admin_id
        order by campaign.created_at desc limit 500`);n.json({campaigns:s})})),e.post("/campaigns",p(async(a,n)=>{let s=fn(a.body?.segment),o=f(a.body?.idempotencyKey,"idempotencyKey",160),r=await d(t,"select * from public.crm_campaigns where idempotency_key = $1",[o]);if(r)return n.json({campaign:r,replayed:!0});let c=await gn(t,s),u=await d(t,`insert into public.crm_campaigns(
         name, segment, message_text, recipient_count, status,
         idempotency_key, created_by_admin_id
       ) values ($1,$2::jsonb,$3,$4,'previewed',$5,$6)
       returning *`,[f(a.body?.name,"name",200),JSON.stringify(s),f(a.body?.messageText,"messageText",4e3),c.length,o,a.adminPrincipal.adminId]);await T(t,a,{action:"campaign.preview",targetType:"crm_campaign",targetId:u.id,after:{campaign:u,sample:c.slice(0,20)}}),n.status(201).json({campaign:u,sample:c.slice(0,20),replayed:!1})})),e.post("/campaigns/:campaignId/confirm",p(async(a,n)=>{let s=String(a.params.campaignId||"");if(!/^[0-9a-f-]{36}$/i.test(s))throw new _(400,"campaignId is invalid","validation_error");let o=f(a.body?.reason,"reason",1e3),r=await S(t,async c=>{let u=await d(c,"select * from public.crm_campaigns where id = $1 for update",[s]);if(!u)throw new _(404,"Campaign was not found","not_found");if(u.status==="sending"||u.status==="completed")return{campaign:u,queued:Number(u.recipient_count),replayed:!0};if(!["draft","previewed"].includes(u.status))throw new _(409,"Campaign cannot be confirmed in its current state","campaign_not_confirmable");let l=fn(u.segment),m=await gn(c,l);for(let b of m){let v=await d(c,`insert into public.crm_campaign_recipients(campaign_id, user_key, status)
           values ($1,$2,$3)
           on conflict (campaign_id, user_key) do update set status = excluded.status
           returning *`,[s,b.user_key,b.telegram_enabled?"queued":"skipped"]);if(!b.telegram_enabled){await c.query(`update public.crm_campaign_recipients
                set skip_reason = 'telegram_disabled', updated_at = now()
              where id = $1`,[v.id]);continue}let h=await d(c,`insert into public.notifications(
             user_key, notification_type, title, body, data, idempotency_key
           ) values ($1,'campaign',$2,$3,$4::jsonb,$5)
           on conflict (idempotency_key) do update set idempotency_key = excluded.idempotency_key
           returning *`,[b.user_key,u.name,u.message_text,JSON.stringify({campaignId:s}),`campaign-notification:${s}:${b.user_key}`]);await c.query(`insert into public.telegram_delivery_log(
             notification_id, campaign_recipient_id, telegram_user_id,
             deduplication_key
           ) values ($1,$2,$3,$4)
           on conflict (deduplication_key) do nothing`,[h.id,v.id,b.telegram_user_id,`campaign-delivery:${s}:${b.user_key}`])}return await c.query(`insert into public.outbox_jobs(
           job_type, aggregate_type, aggregate_id, payload, idempotency_key
         ) values ('telegram_campaign','crm_campaign',$1,$2::jsonb,$3)
         on conflict (idempotency_key) do nothing`,[s,JSON.stringify({campaignId:s}),`campaign-outbox:${s}`]),{campaign:await d(c,`update public.crm_campaigns
            set status = 'sending', recipient_count = $2,
                confirmed_by_admin_id = $3, confirmed_at = now(),
                started_at = now(), updated_at = now()
          where id = $1 returning *`,[s,m.length,a.adminPrincipal.adminId]),queued:m.length,replayed:!1}});await T(t,a,{action:"campaign.confirm",targetType:"crm_campaign",targetId:s,reason:o,after:r}),n.json(r)})),e}var rs,wn,cs,us,vn=D(()=>{"use strict";ve();B();L();z();ye();Z();rs=["app","admin","shared","game"],wn=["image","video","audio","icon"],cs=["app","admin"],us=new Map([["image/png","png"],["image/jpeg","jpg"],["image/webp","webp"]])});import{randomUUID as ls}from"node:crypto";import{Router as _s}from"express";function xn(t,i){let e=f(t,i,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(e)||Number.isNaN(new Date(`${e}T00:00:00Z`).getTime()))throw new _(400,`${i} must use YYYY-MM-DD`,"validation_error");return e}function Sn(t,i){let e=f(t,i,8);if(!/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(e))throw new _(400,`${i} must use HH:MM`,"validation_error");return e}async function Te(t,i){let e=await d(t,`select customer.*, user_row.name, user_row.username, user_row.avatar,
            user_row.account_status, user_row.blocked_at, user_row.last_seen_at,
            account.telegram_user_id,
            profile.status_text, profile.bio, profile.interests,
            profile.discoverable, consent.marketing_opt_in,
            points.balance, points.lifetime_earned, points.lifetime_spent
       from public.crm_customers customer
       join public.app_users user_row on user_row.user_key = customer.user_key
       left join public.telegram_accounts account on account.app_user_key = customer.user_key
       left join public.user_profiles profile on profile.user_key = customer.user_key
       left join public.user_consents consent on consent.user_key = customer.user_key
       left join public.point_accounts points on points.user_key = customer.user_key
      where customer.user_key = $1`,[i]);if(!e)throw new _(404,"CRM customer was not found","not_found");return e}function Pn(t){let i=_s();return i.use(X),i.get("/dashboard",p(async(e,a)=>{let[n,s,o,r,c,u,l]=await Promise.all([d(t,"select count(*)::integer as value from public.app_users where account_status = 'active'"),d(t,`select count(*)::integer as value
           from public.event_runtime
          where status in ('published','active') and coalesce(ends_at, starts_at, now()) >= now()`),d(t,`select count(*)::integer as value
           from public.booking_records
          where status in ('new','pending','confirmed','checked_in')`),d(t,`select count(*)::integer as value
           from public.event_checkins
          where checked_in_at >= date_trunc('day', now())`),d(t,`select count(*)::integer as value
           from public.moderation_cases
          where status in ('open','reviewing')`),d(t,`select coalesce(sum(balance),0)::bigint as balance,
                coalesce(sum(lifetime_earned),0)::bigint as earned,
                coalesce(sum(lifetime_spent),0)::bigint as spent
           from public.point_accounts`),d(t,`select count(*) filter (where status in ('confirmed','sending'))::integer as active,
                count(*) filter (where status = 'completed')::integer as completed
           from public.crm_campaigns`)]);a.json({metrics:{activeUsers:Number(n?.value||0),upcomingEvents:Number(s?.value||0),activeBookings:Number(o?.value||0),todayCheckIns:Number(r?.value||0),openModeration:Number(c?.value||0),pointsBalance:Number(u?.balance||0),pointsEarned:Number(u?.earned||0),pointsSpent:Number(u?.spent||0),activeCampaigns:Number(l?.active||0),completedCampaigns:Number(l?.completed||0)}})})),i.get("/crm/merge-reviews",p(async(e,a)=>{let n=K(e.query.status||"pending","status",["pending","linked","ignored"]),s=await w(t,`select review.*, candidate.name as candidate_name,
              candidate.username as candidate_username
         from public.data_merge_review review
         left join public.app_users candidate
           on candidate.user_key = review.candidate_user_key
        where review.status = $1
        order by review.created_at`,[n]);a.json({reviews:s})})),i.patch("/crm/merge-reviews/:reviewId",p(async(e,a)=>{let n=P(e.params.reviewId,"reviewId"),s=K(e.body?.status,"status",["linked","ignored"]),o=f(e.body?.reason,"reason",1e3),r=await S(t,async c=>{let u=await d(c,"select * from public.data_merge_review where id = $1 for update",[n]);if(!u)throw new _(404,"Merge review was not found","not_found");if(u.status!=="pending")throw new _(409,"Merge review has already been resolved","merge_review_resolved");if(u.entity_type!=="telegram_identity"||!u.candidate_user_key)throw new _(409,"This merge type requires a dedicated migration","merge_type_unsupported");let l=f(u.legacy_id,"telegramId",32);if(!/^\d+$/.test(l))throw new _(409,"Telegram ID in review is invalid","merge_identity_invalid");if(s==="linked"){let y=await d(c,`select * from public.telegram_accounts
            where telegram_user_id = $1 or app_user_key = $2
            for update`,[l,u.candidate_user_key]);if(y&&(String(y.telegram_user_id)!==l||y.app_user_key!==u.candidate_user_key))throw new _(409,"Telegram identity is already bound to another account","identity_binding_conflict");let b=u.payload?.signedTelegramUser||{};await c.query(`insert into public.telegram_accounts(
             app_user_key, telegram_user_id, username, first_name, last_name,
             language_code, photo_url, is_premium, first_verified_at, last_verified_at
           ) values ($1,$2,$3,$4,$5,$6,$7,$8,now(),now())
           on conflict (telegram_user_id) do update
             set username = excluded.username,
                 first_name = excluded.first_name,
                 last_name = excluded.last_name,
                 language_code = excluded.language_code,
                 photo_url = excluded.photo_url,
                 is_premium = excluded.is_premium,
                 last_verified_at = now(),
                 updated_at = now()`,[u.candidate_user_key,l,String(b.username||""),String(b.first_name||""),String(b.last_name||""),String(b.language_code||""),String(b.photo_url||""),!!b.is_premium])}else await c.query(`update public.app_users
              set telegram_id = null, updated_at = now()
            where user_key = $1 and telegram_id = $2`,[u.candidate_user_key,l]);let m=await d(c,`update public.data_merge_review
            set status = $2, reviewed_by_admin_id = $3,
                reviewed_at = now(),
                payload = payload || $4::jsonb
          where id = $1 returning *`,[n,s,e.adminPrincipal.adminId,JSON.stringify({resolutionReason:o})]);return{before:u,review:m}});await T(t,e,{action:`crm.merge_review.${s}`,targetType:"data_merge_review",targetId:n,reason:o,before:r.before,after:r.review}),a.json({review:r.review})})),i.get("/crm/users",p(async(e,a)=>{let n=String(e.query.search||"").trim().slice(0,200),s=e.query.trustStatus?K(e.query.trustStatus,"trustStatus",$n):"",o=e.query.accountStatus?K(e.query.accountStatus,"accountStatus",kn):"",r=k(e.query.limit,200,1,500),c=await w(t,`select customer.id as customer_id, customer.user_key, customer.phone,
              customer.first_name, customer.last_name, customer.birth_date,
              customer.trust_status, customer.marketing_opt_in,
              customer.first_seen_at, customer.last_activity_at, customer.app_opens,
              user_row.name, user_row.username, user_row.avatar,
              user_row.account_status, account.telegram_user_id,
              coalesce(points.balance, 0)::bigint as points_balance,
              coalesce(bookings.booking_count, 0)::integer as booking_count,
              bookings.last_booking_at,
              vip.ends_at as vip_ends_at,
              personal_clan.name as personal_clan_name,
              corporate_clan.name as corporate_clan_name
         from public.crm_customers customer
         join public.app_users user_row on user_row.user_key = customer.user_key
         left join public.telegram_accounts account on account.app_user_key = customer.user_key
         left join public.point_accounts points on points.user_key = customer.user_key
         left join (
           select user_key, count(*) as booking_count, max(created_at) as last_booking_at
             from public.booking_records group by user_key
         ) bookings on bookings.user_key = customer.user_key
         left join lateral (
           select ends_at from public.user_vip_subscriptions
            where user_key = customer.user_key and status = 'active' and ends_at > now()
            order by ends_at desc limit 1
         ) vip on true
         left join lateral (
           select clan.name
             from public.clan_memberships membership
             join public.clans clan on clan.id = membership.clan_id
            where membership.user_key = customer.user_key
              and membership.status = 'active' and clan.clan_type = 'user'
            limit 1
         ) personal_clan on true
         left join lateral (
           select clan.name
             from public.clan_memberships membership
             join public.clans clan on clan.id = membership.clan_id
            where membership.user_key = customer.user_key
              and membership.status = 'active' and clan.clan_type = 'corporate'
            limit 1
         ) corporate_clan on true
        where ($1 = '' or lower(user_row.name) like '%' || lower($1) || '%'
          or lower(user_row.username) like '%' || lower($1) || '%'
          or lower(customer.phone) like '%' || lower($1) || '%'
          or account.telegram_user_id::text = $1)
          and ($2 = '' or customer.trust_status = $2)
          and ($3 = '' or user_row.account_status = $3)
        order by customer.last_activity_at desc, customer.user_key
        limit $4`,[n,s,o,r]);a.json({users:c})})),i.get("/crm/users/:userKey",p(async(e,a)=>{let n=$(e.params.userKey,"userKey"),s=await Te(t,n),[o,r,c,u,l,m,y,b,v,h]=await Promise.all([w(t,`select tag.* from public.crm_tags tag
          join public.crm_customer_tags link on link.tag_id = tag.id
         where link.customer_id = $1 order by tag.name`,[s.id]),w(t,`select note.*, admin.email as admin_email
           from public.crm_notes note
           left join public.admin_users admin on admin.id = note.created_by_admin_id
          where note.customer_id = $1 order by note.created_at desc limit 200`,[s.id]),w(t,`select booking.*, event.title as event_title, table_row.table_number
           from public.booking_records booking
           join public.events event on event.id = booking.event_id
           join public.layout_tables table_row on table_row.id = booking.table_id
          where booking.user_key = $1 order by booking.created_at desc`,[n]),w(t,"select * from public.point_ledger where user_key = $1 order by created_at desc limit 300",[n]),w(t,`select grant_row.*, reward.name, reward.icon_url
           from public.user_rewards grant_row
           join public.reward_definitions reward on reward.id = grant_row.reward_id
          where grant_row.user_key = $1 order by grant_row.granted_at desc`,[n]),w(t,`select gift.*, catalog.name, catalog.image_url
           from public.gifts gift
           join public.gift_catalog catalog on catalog.id = gift.catalog_item_id
          where gift.recipient_user_key = $1 or gift.sender_user_key = $1
          order by gift.created_at desc`,[n]),w(t,`select subscription.*, plan.name
           from public.user_vip_subscriptions subscription
           join public.vip_plans plan on plan.id = subscription.plan_id
          where subscription.user_key = $1 order by subscription.ends_at desc`,[n]),w(t,`select shop_order.* from public.shop_orders shop_order
          where shop_order.user_key = $1 order by shop_order.created_at desc`,[n]),w(t,`select clan.id, clan.name, clan.clan_type, membership.role, membership.status
           from public.clan_memberships membership
           join public.clans clan on clan.id = membership.clan_id
          where membership.user_key = $1 order by membership.joined_at desc`,[n]),w(t,`select checkin.*, event.title as event_title
           from public.event_checkins checkin
           join public.events event on event.id = checkin.event_id
          where checkin.user_key = $1 order by checkin.checked_in_at desc`,[n])]);a.json({customer:s,tags:o,notes:r,bookings:c,pointLedger:u,rewards:l,gifts:m,vip:y,orders:b,clans:v,checkIns:h})})),i.patch("/crm/users/:userKey",p(async(e,a)=>{let n=$(e.params.userKey,"userKey"),s=await Te(t,n),o=e.body?.trustStatus===void 0?s.trust_status:K(e.body.trustStatus,"trustStatus",$n),r=e.body?.accountStatus===void 0?s.account_status:K(e.body.accountStatus,"accountStatus",kn),c=f(e.body?.reason,"reason",1e3),u=await S(t,async l=>(await l.query(`update public.crm_customers
            set trust_status = $2,
                marketing_opt_in = $3,
                phone = $4,
                updated_at = now()
          where user_key = $1`,[n,o,e.body?.marketingOptIn===void 0?s.marketing_opt_in:A(e.body.marketingOptIn),e.body?.phone===void 0?s.phone:g(e.body.phone,40)]),await l.query(`update public.app_users
            set account_status = $2,
                blocked_at = case when $2 = 'blocked' then coalesce(blocked_at, now()) else null end,
                updated_at = now()
          where user_key = $1`,[n,r]),r!=="active"&&await l.query(`update public.user_sessions set revoked_at = coalesce(revoked_at, now())
            where app_user_key = $1`,[n]),Te(l,n)));await T(t,e,{action:"crm.customer.update",targetType:"crm_customer",targetId:n,reason:c,before:s,after:u}),a.json({customer:u})})),i.post("/crm/users/:userKey/notes",p(async(e,a)=>{let n=$(e.params.userKey,"userKey"),s=await Te(t,n),o=await d(t,`insert into public.crm_notes(customer_id, body, created_by_admin_id)
       values ($1,$2,$3) returning *`,[s.id,f(e.body?.body,"body",4e3),e.adminPrincipal.adminId]);await T(t,e,{action:"crm.note.create",targetType:"crm_note",targetId:String(o.id),after:o}),a.status(201).json({note:o})})),i.post("/crm/tags",p(async(e,a)=>{let n=f(e.body?.name,"name",100),s=f(e.body?.color||"#c8ff3d","color",20);if(!/^#[0-9a-f]{6}$/i.test(s))throw new _(400,"color must be a six-digit hex value","validation_error");let o=await d(t,`insert into public.crm_tags(name, color, created_by_admin_id)
       values ($1,$2,$3)
       on conflict (name) do update set color = excluded.color
       returning *`,[n,s,e.adminPrincipal.adminId]);await T(t,e,{action:"crm.tag.upsert",targetType:"crm_tag",targetId:String(o.id),after:o}),a.status(201).json({tag:o})})),i.post("/crm/users/:userKey/tags/:tagId",p(async(e,a)=>{let n=$(e.params.userKey,"userKey"),s=P(e.params.tagId,"tagId"),o=await Te(t,n);await t.query(`insert into public.crm_customer_tags(customer_id, tag_id, assigned_by_admin_id)
       values ($1,$2,$3) on conflict do nothing`,[o.id,s,e.adminPrincipal.adminId]),await T(t,e,{action:"crm.tag.assign",targetType:"crm_customer",targetId:n,after:{tagId:s}}),a.status(204).end()})),i.delete("/crm/users/:userKey/tags/:tagId",p(async(e,a)=>{let n=$(e.params.userKey,"userKey"),s=P(e.params.tagId,"tagId"),o=await Te(t,n);await t.query("delete from public.crm_customer_tags where customer_id = $1 and tag_id = $2",[o.id,s]),await T(t,e,{action:"crm.tag.remove",targetType:"crm_customer",targetId:n,before:{tagId:s}}),a.status(204).end()})),i.get("/events",p(async(e,a)=>{let n=await w(t,`select event.*, runtime.status, runtime.starts_at, runtime.ends_at,
              runtime.age_limit, runtime.dj, runtime.artists, runtime.metadata,
              assignment.layout_id, layout.name as layout_name,
              coalesce(attendance.going_count,0)::integer as going_count,
              coalesce(bookings.booking_count,0)::integer as booking_count,
              coalesce(checkins.checkin_count,0)::integer as checkin_count
         from public.events event
         left join public.event_runtime runtime on runtime.event_id = event.id
         left join public.event_layout_assignments assignment on assignment.event_id = event.id
         left join public.hall_layouts layout on layout.id = assignment.layout_id
         left join (
           select event_id, count(*) filter (where status = 'going') as going_count
             from public.event_attendance group by event_id
         ) attendance on attendance.event_id = event.id
         left join (
           select event_id, count(*) as booking_count from public.booking_records
            where status not in ('cancelled','expired') group by event_id
         ) bookings on bookings.event_id = event.id
         left join (
           select event_id, count(*) as checkin_count from public.event_checkins group by event_id
         ) checkins on checkins.event_id = event.id
        order by coalesce(runtime.starts_at, event.event_date::timestamptz) desc`);a.json({events:n})})),i.post("/events",p(async(e,a)=>{let n=e.body?.id?$(e.body.id,"id"):`event-${ls()}`,s=xn(e.body?.eventDate,"eventDate"),o=Sn(e.body?.eventTime||"23:00","eventTime"),r=K(e.body?.status||"draft","status",In),c=E(e.body?.startsAt)||new Date(`${s}T${o}`).toISOString(),u=E(e.body?.endsAt),l=await S(t,async m=>{let y=await d(m,`insert into public.events(
           id, title, event_date, event_time, description,
           image_url, active, sort_order
         ) values ($1,$2,$3,$4,$5,$6,$7,$8)
         returning *`,[n,f(e.body?.title,"title",200),s,o,g(e.body?.description,6e3),g(e.body?.imageUrl,4e3),!["draft","archived","cancelled"].includes(r),k(e.body?.sortOrder,0,-1e6,1e6)]),b=await d(m,`insert into public.event_runtime(
           event_id, status, starts_at, ends_at, age_limit, dj,
           artists, metadata, published_at
         ) values (
           $1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,
           case when $2 in ('published','active') then now() else null end
         ) returning *`,[n,r,c,u,k(e.body?.ageLimit,18,18,99),g(e.body?.dj,300),JSON.stringify(Array.isArray(e.body?.artists)?e.body.artists.slice(0,100):[]),JSON.stringify(e.body?.metadata&&typeof e.body.metadata=="object"?e.body.metadata:{})]);return{event:y,runtime:b}});await T(t,e,{action:"event.create",targetType:"event",targetId:n,after:l}),a.status(201).json(l)})),i.patch("/events/:eventId",p(async(e,a)=>{let n=$(e.params.eventId,"eventId"),s=await d(t,`select event.*, runtime.status, runtime.starts_at, runtime.ends_at,
              runtime.age_limit, runtime.dj, runtime.artists, runtime.metadata
         from public.events event
         left join public.event_runtime runtime on runtime.event_id = event.id
        where event.id = $1`,[n]);if(!s)throw new _(404,"Event was not found","not_found");let o=e.body?.status===void 0?s.status:K(e.body.status,"status",In),r=await S(t,async c=>{let u=await d(c,`update public.events
            set title = $2, event_date = $3, event_time = $4,
                description = $5, image_url = $6, active = $7, sort_order = $8
          where id = $1 returning *`,[n,e.body?.title===void 0?s.title:f(e.body.title,"title",200),e.body?.eventDate===void 0?s.event_date:xn(e.body.eventDate,"eventDate"),e.body?.eventTime===void 0?s.event_time:Sn(e.body.eventTime,"eventTime"),e.body?.description===void 0?s.description:g(e.body.description,6e3),e.body?.imageUrl===void 0?s.image_url:g(e.body.imageUrl,4e3),!["draft","archived","cancelled"].includes(o),k(e.body?.sortOrder,Number(s.sort_order||0),-1e6,1e6)]),l=await d(c,`update public.event_runtime
            set status = $2, starts_at = $3, ends_at = $4, age_limit = $5,
                dj = $6, artists = $7::jsonb, metadata = $8::jsonb,
                published_at = case
                  when $2 in ('published','active') then coalesce(published_at, now())
                  else published_at end,
                completed_at = case when $2 = 'completed' then coalesce(completed_at, now()) else null end,
                archived_at = case when $2 = 'archived' then coalesce(archived_at, now()) else null end,
                updated_at = now()
          where event_id = $1 returning *`,[n,o,e.body?.startsAt===void 0?s.starts_at:E(e.body.startsAt),e.body?.endsAt===void 0?s.ends_at:E(e.body.endsAt),k(e.body?.ageLimit,Number(s.age_limit||18),18,99),e.body?.dj===void 0?s.dj:g(e.body.dj,300),JSON.stringify(e.body?.artists===void 0?s.artists:Array.isArray(e.body.artists)?e.body.artists.slice(0,100):[]),JSON.stringify(e.body?.metadata===void 0?s.metadata:e.body.metadata&&typeof e.body.metadata=="object"?e.body.metadata:{})]);return{event:u,runtime:l}});await T(t,e,{action:"event.update",targetType:"event",targetId:n,reason:f(e.body?.reason,"reason",1e3),before:s,after:r}),a.json(r)})),i.get("/moderation",p(async(e,a)=>{let n=e.query.status?K(e.query.status,"status",jn):"",s=await w(t,`select moderation.*, user_row.name as reported_user_name,
              admin.email as assigned_admin_email
         from public.moderation_cases moderation
         left join public.app_users user_row on user_row.user_key = moderation.reported_user_key
         left join public.admin_users admin on admin.id = moderation.assigned_admin_id
        where ($1 = '' or moderation.status = $1)
        order by case moderation.priority
          when 'critical' then 0 when 'high' then 1 when 'normal' then 2 else 3 end,
          moderation.created_at`,[n]);a.json({cases:s})})),i.patch("/moderation/:caseId",p(async(e,a)=>{let n=P(e.params.caseId,"caseId"),s=await d(t,"select * from public.moderation_cases where id = $1",[n]);if(!s)throw new _(404,"Moderation case was not found","not_found");let o=e.body?.status===void 0?s.status:K(e.body.status,"status",jn),r=e.body?.priority===void 0?s.priority:K(e.body.priority,"priority",ps),c=e.body?.resolution===void 0?s.resolution:g(e.body.resolution,4e3);if(["actioned","dismissed","closed"].includes(o)&&!c)throw new _(400,"A resolution is required to close a moderation case","validation_error");let u=await d(t,`update public.moderation_cases
          set status = $2, priority = $3, resolution = $4,
              assigned_admin_id = $5,
              closed_at = case when $2 in ('actioned','dismissed','closed') then now() else null end,
              updated_at = now()
        where id = $1 returning *`,[n,o,r,c,e.adminPrincipal.adminId]);await T(t,e,{action:"moderation.case.update",targetType:"moderation_case",targetId:n,reason:g(e.body?.reason,1e3),before:s,after:u}),a.json({case:u})})),i.get("/platform-audit",p(async(e,a)=>{let n=k(e.query.limit,500,1,2e3),s=String(e.query.action||"").trim().slice(0,200),o=await w(t,`select * from public.admin_audit_log
        where ($1 = '' or action = $1)
        order by created_at desc limit $2`,[s,n]);a.json({audit:o})})),i}var $n,kn,In,jn,ps,Tn=D(()=>{"use strict";ve();B();L();z();Z();$n=["trusted","normal","watch","restricted"],kn=["active","blocked","deleted"],In=["draft","published","active","completed","archived","cancelled"],jn=["open","reviewing","actioned","dismissed","closed"],ps=["low","normal","high","critical"]});import{Router as ms}from"express";function ys(t){return f(String(t.get("idempotency-key")||"").trim()||t.body?.idempotencyKey,"idempotencyKey",160)}function Nn(t){let i=ms();return i.use(X),i.get("/check-ins",p(async(e,a)=>{let n=String(e.query.eventId||"").trim(),s=await w(t,`select checkin.*, user_row.name, user_row.username,
              booking.booking_reference, event.title as event_title
         from public.event_checkins checkin
         join public.app_users user_row on user_row.user_key = checkin.user_key
         join public.events event on event.id = checkin.event_id
         left join public.booking_records booking on booking.id = checkin.booking_id
        where ($1 = '' or checkin.event_id = $1)
        order by checkin.checked_in_at desc
        limit 500`,[n]);a.json({checkIns:s})})),i.post("/check-ins",p(async(e,a)=>{let n=f(e.body?.token,"token",1e3),s=ys(e),o=g(e.body?.reason,1e3),r;try{r=await S(t,async c=>{let u=await d(c,`select checkin.* from public.event_checkins checkin
          where checkin.idempotency_key = $1`,[s]);if(u)return{checkIn:u,replayed:!0,points:null};let l=await d(c,`select qr.*, booking.event_id, booking.status as booking_status,
                booking.clan_id, booking.booking_reference
           from public.booking_qr_tokens qr
           join public.booking_records booking on booking.id = qr.booking_id
          where qr.token_hash = $1
          for update of qr`,[Y(n)]);if(!l)throw new _(404,"QR code was not recognized","qr_not_found");if(l.revoked_at)throw new _(409,"QR code has been revoked","qr_revoked");if(l.redeemed_at)throw new _(409,"QR code has already been used","qr_already_used");if(new Date(l.expires_at).getTime()<=Date.now())throw new _(409,"QR code has expired","qr_expired");if(!["confirmed","pending","new"].includes(l.booking_status))throw new _(409,"Booking cannot be checked in","booking_checkin_unavailable");let m=await d(c,`insert into public.event_checkins(
           event_id, user_key, booking_id, idempotency_key,
           qr_subject_type, qr_subject_id, checked_in_by_admin_id, metadata
         ) values ($1,$2,$3,$4,'booking',$3,$5,$6::jsonb)
         returning *`,[l.event_id,l.user_key,l.booking_id,s,e.adminPrincipal.adminId,JSON.stringify({bookingReference:l.booking_reference,reason:o})]);await c.query(`update public.booking_qr_tokens
            set redeemed_at = now(), redeemed_by_admin_id = $2, updated_at = now()
          where id = $1`,[l.id,e.adminPrincipal.adminId]),await c.query(`update public.booking_records
            set status = 'checked_in', checked_in_at = now(), updated_at = now()
          where id = $1`,[l.booking_id]),await c.query(`insert into public.booking_status_history(
           booking_id, previous_status, next_status, actor_type, actor_id,
           reason, after_value
         ) values ($1,$2,'checked_in','checkin',$3,$4,$5::jsonb)`,[l.booking_id,l.booking_status,e.adminPrincipal.adminId,o,JSON.stringify(m)]);let y=await d(c,`select checkin_points, clan_activity_points
           from public.economy_settings where singleton = true`),b=Number(y?.checkin_points||0)>0?await re(c,{userKey:l.user_key,amount:Number(y.checkin_points),operationType:"credit",sourceType:"event_checkin",sourceId:String(m.id),reason:"BALI event check-in",administratorId:e.adminPrincipal.adminId,idempotencyKey:`checkin-points:${l.event_id}:${l.user_key}`}):null;return l.clan_id&&Number(y?.clan_activity_points||0)>0&&(await c.query(`insert into public.clan_points_ledger(
             clan_id, user_key, points, source_type, source_id,
             idempotency_key, reason
           ) values ($1,$2,$3,'event_checkin',$4,$5,$6)
           on conflict (idempotency_key) do nothing`,[l.clan_id,l.user_key,Number(y.clan_activity_points),String(m.id),`checkin-clan-points:${l.event_id}:${l.user_key}`,"BALI event check-in"]),await c.query(`update public.clans
              set rating_points = rating_points + $2, updated_at = now()
            where id = $1
              and exists (
                select 1 from public.clan_points_ledger
                 where idempotency_key = $3 and source_id = $4
              )`,[l.clan_id,Number(y.clan_activity_points),`checkin-clan-points:${l.event_id}:${l.user_key}`,String(m.id)])),await c.query(`insert into public.notifications(
           user_key, notification_type, title, body, data, status,
           idempotency_key
         ) values ($1,'event_checkin','Check-in \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D',$2,$3::jsonb,'queued',$4)
         on conflict (idempotency_key) do nothing`,[l.user_key,b?`\u041D\u0430\u0447\u0438\u0441\u043B\u0435\u043D\u043E ${y.checkin_points} BALI Points.`:"\u0414\u043E\u0431\u0440\u043E \u043F\u043E\u0436\u0430\u043B\u043E\u0432\u0430\u0442\u044C \u0432 BALI.",JSON.stringify({eventId:l.event_id,bookingId:l.booking_id}),`checkin-notification:${l.event_id}:${l.user_key}`]),{checkIn:m,replayed:!1,points:b}})}catch(c){throw c?.code==="23505"&&await d(t,`select checkin.*
             from public.event_checkins checkin
             join public.booking_qr_tokens qr on qr.booking_id = checkin.booking_id
            where qr.token_hash = $1
            limit 1`,[Y(n)])?new _(409,"This guest has already checked in","checkin_already_exists"):c}await T(t,e,{action:"booking.checkin",targetType:"event_checkin",targetId:String(r.checkIn.id),reason:o,after:r.checkIn}),a.status(r.replayed?200:201).json(r)})),i.post("/redemptions/gifts",p(async(e,a)=>{let n=f(e.body?.token,"token",1e3),s=g(e.body?.reason,1e3),o=await S(t,async r=>{let c=await d(r,"select * from public.gifts where qr_token_hash = $1 for update",[Y(n)]);if(!c)throw new _(404,"Gift QR was not recognized","qr_not_found");if(c.status==="redeemed")return c;if(!["pending","delivered"].includes(c.status))throw new _(409,"Gift cannot be redeemed","gift_redemption_unavailable");if(c.expires_at&&new Date(c.expires_at).getTime()<=Date.now())throw new _(409,"Gift has expired","gift_expired");return d(r,`update public.gifts
            set status = 'redeemed', redeemed_at = now(),
                redeemed_by_admin_id = $2, updated_at = now()
          where id = $1 returning *`,[c.id,e.adminPrincipal.adminId])});await T(t,e,{action:"gift.redeem",targetType:"gift",targetId:String(o.id),reason:s,after:o}),a.json({gift:o})})),i.post("/redemptions/shop",p(async(e,a)=>{let n=f(e.body?.token,"token",1e3),s=g(e.body?.reason,1e3),o=await S(t,async r=>{let c=await d(r,`select shop_order.*
           from public.shop_orders shop_order
          where shop_order.qr_token_hash = $1
            and exists (
              select 1
                from public.shop_order_items order_item
               where order_item.order_id = shop_order.id
                 and order_item.requires_redemption = true
            )
          for update`,[Y(n)]);if(!c)throw new _(404,"Shop QR was not recognized","qr_not_found");if(c.status==="redeemed")return c;if(!["paid","fulfilled"].includes(c.status))throw new _(409,"Order cannot be redeemed","shop_redemption_unavailable");return d(r,`update public.shop_orders
            set status = 'redeemed', redeemed_at = now(),
                redeemed_by_admin_id = $2, updated_at = now()
          where id = $1 returning *`,[c.id,e.adminPrincipal.adminId])});await T(t,e,{action:"shop.redeem",targetType:"shop_order",targetId:String(o.id),reason:s,after:o}),a.json({order:o})})),i.post("/redemptions/rewards/:rewardGrantId",p(async(e,a)=>{let n=P(e.params.rewardGrantId,"rewardGrantId"),s=g(e.body?.reason,1e3),o=await S(t,async r=>{let c=await d(r,"select * from public.user_rewards where id = $1 for update",[n]);if(!c)throw new _(404,"Reward was not found","not_found");if(c.status==="redeemed")return c;if(c.status!=="active")throw new _(409,"Reward cannot be redeemed","reward_redemption_unavailable");if(c.expires_at&&new Date(c.expires_at).getTime()<=Date.now())throw new _(409,"Reward has expired","reward_expired");return d(r,`update public.user_rewards
            set status = 'redeemed', redeemed_at = now()
          where id = $1 returning *`,[n])});await T(t,e,{action:"reward.redeem",targetType:"user_reward",targetId:n,reason:s,after:o}),a.json({reward:o})})),i}var An=D(()=>{"use strict";ve();B();Me();L();z();me();Z()});import{randomBytes as bs,randomUUID as ws}from"node:crypto";import{Router as fs}from"express";function gs(){return`Bali-${bs(7).toString("base64url")}9!`}function hs(t){return`https://t.me/${String(t||"").replace(/^@+/,"")}`}async function vs(t,i,e){let a=`mobile:${ws()}`,n=String(i.display_name||"\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C BALI").trim(),s=n.split(/\s+/),o=s.shift()||n,r=s.join(" ");await t.query(`insert into public.app_users(
       user_key, name, username, phone, first_seen_at, last_seen_at, opens, account_status, updated_at
     ) values ($1,$2,$3,$4,now(),now(),1,'active',now())`,[a,n,i.telegram_username,i.phone]),await t.query(`insert into public.mobile_credentials(
       app_user_key, phone, telegram_username, password_hash, must_change_password, password_issued_at
     ) values ($1,$2,$3,$4,true,now())`,[a,i.phone,i.telegram_username,e]),await t.query(`insert into public.user_profiles(user_key, display_name, avatar_url, phone)
     values ($1,$2,'',$3) on conflict (user_key) do update set display_name = excluded.display_name, phone = excluded.phone`,[a,n,i.phone]),await t.query("insert into public.user_consents(user_key) values ($1) on conflict (user_key) do nothing",[a]),await t.query(`insert into public.crm_customers(user_key, first_name, last_name, last_activity_at, app_opens)
     values ($1,$2,$3,now(),1) on conflict (user_key) do nothing`,[a,o,r]),await t.query("insert into public.point_accounts(user_key) values ($1) on conflict (user_key) do nothing",[a]),await t.query("insert into public.game_profiles(user_key) values ($1) on conflict (user_key) do nothing",[a]),await t.query("insert into public.notification_preferences(user_key) values ($1) on conflict (user_key) do nothing",[a]);let c=await d(t,"select registration_points as amount from public.economy_settings where singleton = true"),u=Number(c?.amount||0);if(u>0){let l=`registration:${a}`,m=await d(t,"select balance from public.point_accounts where user_key = $1 for update",[a]),y=Number(m?.balance||0),b=y+u;await t.query(`update public.point_accounts
          set balance = $2, lifetime_earned = lifetime_earned + $3, version = version + 1, updated_at = now()
        where user_key = $1`,[a,b,u]),await t.query(`insert into public.point_ledger(
         user_key, amount, balance_before, balance_after, operation_type, source_type, source_id, reason, idempotency_key
       ) values ($1,$2,$3,$4,'credit','registration',$1,'\u041D\u0430\u0447\u0438\u0441\u043B\u0435\u043D\u0438\u0435 \u0437\u0430 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044E',$5)
       on conflict (idempotency_key) do nothing`,[a,u,y,b,l])}return a}function Kn(t){let i=fs();return i.use(X),i.get("/mobile-access",p(async(e,a)=>{let n=e.query.status?K(e.query.status,"status",["pending","issued","completed","rejected","cancelled"]):"pending",s=await w(t,`select r.id, r.request_type, r.phone, r.telegram_username, r.display_name,
              r.app_user_key, r.status, r.requested_at, r.issued_at, r.completed_at, r.note,
              c.must_change_password, c.last_login_at,
              u.name as user_name
         from public.mobile_access_requests r
         left join public.mobile_credentials c on c.app_user_key = r.app_user_key
         left join public.app_users u on u.user_key = r.app_user_key
        where r.status = $1
        order by r.requested_at desc
        limit 250`,[n]),o=await d(t,`select
         count(*) filter (where status = 'pending')::int as pending,
         count(*) filter (where status = 'issued')::int as issued,
         count(*) filter (where status = 'completed')::int as completed
       from public.mobile_access_requests`);a.json({requests:s,counts:o||{pending:0,issued:0,completed:0}})})),i.post("/mobile-access/:requestId/issue",p(async(e,a)=>{let n=P(e.params.requestId,"requestId"),s=gs(),o=await He(s),r=await S(t,async c=>{let u=await d(c,"select * from public.mobile_access_requests where id = $1 for update",[n]);if(!u)throw new _(404,"\u0417\u0430\u044F\u0432\u043A\u0430 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430","mobile_access_request_not_found");if(u.status!=="pending")throw new _(409,"\u0417\u0430\u044F\u0432\u043A\u0430 \u0443\u0436\u0435 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u0430\u043D\u0430","mobile_access_already_processed");let l=u.app_user_key;if(u.request_type==="registration"){if(await d(c,"select app_user_key from public.mobile_credentials where phone = $1",[u.phone]))throw new _(409,"\u0414\u043B\u044F \u044D\u0442\u043E\u0433\u043E \u0442\u0435\u043B\u0435\u0444\u043E\u043D\u0430 \u0430\u043A\u043A\u0430\u0443\u043D\u0442 \u0443\u0436\u0435 \u0441\u043E\u0437\u0434\u0430\u043D","mobile_account_exists");l=await vs(c,u,o)}else{let m=await d(c,"select app_user_key from public.mobile_credentials where app_user_key = $1 or phone = $2 limit 1",[l,u.phone]);if(!m)throw new _(404,"\u041C\u043E\u0431\u0438\u043B\u044C\u043D\u044B\u0439 \u0430\u043A\u043A\u0430\u0443\u043D\u0442 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D","mobile_account_not_found");l=m.app_user_key,await c.query(`update public.mobile_credentials
              set password_hash = $2,
                  telegram_username = $3,
                  must_change_password = true,
                  password_issued_at = now(),
                  password_changed_at = null,
                  failed_login_count = 0,
                  locked_until = null
            where app_user_key = $1`,[l,o,u.telegram_username]),await c.query(`update public.user_sessions set revoked_at = now()
            where app_user_key = $1 and revoked_at is null`,[l])}return await c.query(`update public.mobile_access_requests
            set app_user_key = $2,
                status = 'issued',
                issued_at = now(),
                issued_by_admin_id = $3,
                updated_at = now()
          where id = $1`,[n,l,e.adminPrincipal.adminId]),{...u,app_user_key:l}});a.json({requestId:n,requestType:r.request_type,phone:r.phone,telegramUsername:r.telegram_username,telegramUrl:hs(r.telegram_username),temporaryPassword:s,mustChangePassword:!0,message:"\u0412\u0440\u0435\u043C\u0435\u043D\u043D\u044B\u0439 \u043F\u0430\u0440\u043E\u043B\u044C \u0441\u043E\u0437\u0434\u0430\u043D. \u041E\u043D \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u0430\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u0443 \u0442\u043E\u043B\u044C\u043A\u043E \u0432 \u044D\u0442\u043E\u043C \u043E\u0442\u0432\u0435\u0442\u0435."})})),i.post("/mobile-access/:requestId/reject",p(async(e,a)=>{let n=P(e.params.requestId,"requestId"),s=f(e.body?.note||"\u041E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u043E \u0430\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u043E\u043C","note",500);if(!await d(t,`update public.mobile_access_requests
          set status = 'rejected', note = $2, issued_by_admin_id = $3, updated_at = now()
        where id = $1 and status = 'pending'
        returning id`,[n,s,e.adminPrincipal.adminId]))throw new _(409,"\u0417\u0430\u044F\u0432\u043A\u0430 \u0443\u0436\u0435 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u0430\u043D\u0430 \u0438\u043B\u0438 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430","mobile_access_already_processed");a.json({ok:!0})})),i}var Rn=D(()=>{"use strict";B();L();z();me();Z()});import{randomUUID as Dn}from"node:crypto";import{Router as $s}from"express";import ks from"qrcode";async function Mn(t){await t.query(`update public.booking_holds
        set status = 'expired', updated_at = now()
      where status = 'active' and expires_at <= now()`)}async function Is(t,i,e){let a=await d(t,`select booking.*, event.title as event_title, event.event_date, event.event_time,
            layout.name as layout_name, layout_table.table_number, layout_table.name as table_name
       from public.booking_records booking
       join public.events event on event.id = booking.event_id
       join public.hall_layouts layout on layout.id = booking.layout_id
       join public.layout_tables layout_table on layout_table.id = booking.table_id
      where booking.id = $1 and booking.user_key = $2`,[i,e]);if(!a)throw new _(404,"Booking was not found","not_found");return a}async function On(t,i,e){let a=await d(t,`select membership.*, clan.name as clan_name, clan.clan_type
       from public.clan_memberships membership
       join public.clans clan on clan.id = membership.clan_id
      where membership.user_key = $1
        and membership.clan_id = $2
        and membership.status = 'active'
        and membership.role = 'leader'
        and clan.status = 'active'`,[i,e]);if(!a)throw new _(403,"Only the active clan leader can create a clan booking","clan_leader_required");return a}async function Cn(t,i,e,a){if(!i.active||i.status==="unavailable")throw new _(409,"Table is unavailable","table_unavailable");if(i.status==="clan_only"||i.table_type==="clan"){if(!a)throw new _(403,"This table can be booked only by a clan leader","clan_booking_required");await On(t,e,a)}else a&&await On(t,e,a);if((i.status==="vip_only"||i.table_type==="vip")&&!await d(t,`select subscription.id
         from public.user_vip_subscriptions subscription
        where subscription.user_key = $1
          and subscription.status = 'active'
          and subscription.starts_at <= now()
          and subscription.ends_at > now()
        limit 1`,[e]))throw new _(403,"An active VIP status is required for this table","vip_required")}function En(t){let i=$s();return i.use(H),i.get("/my",p(async(e,a)=>{let n=await w(t,`select booking.*, event.title as event_title, event.event_date, event.event_time,
              runtime.starts_at, runtime.ends_at,
              layout.name as layout_name,
              layout_table.table_number, layout_table.name as table_name
         from public.booking_records booking
         join public.events event on event.id = booking.event_id
         left join public.event_runtime runtime on runtime.event_id = event.id
         join public.hall_layouts layout on layout.id = booking.layout_id
         join public.layout_tables layout_table on layout_table.id = booking.table_id
        where booking.user_key = $1
        order by booking.created_at desc`,[e.userPrincipal.userKey]);a.json({bookings:n})})),i.post("/holds",p(async(e,a)=>{await O(t,e,"booking.hold",M(e));let n=$(e.body?.eventId,"eventId"),s=$(e.body?.tableId,"tableId"),o=e.body?.clanId?$(e.body.clanId,"clanId"):null;await Mn(t);let r=await S(t,async c=>{let u=await d(c,`select * from public.booking_holds
          where user_key = $1 and status = 'active'
          for update`,[e.userPrincipal.userKey]);if(u){if(u.event_id===n&&u.table_id===s)return{hold:await d(c,`update public.booking_holds hold
                set expires_at = now() + make_interval(secs => settings.hold_seconds),
                    updated_at = now()
               from public.booking_settings settings
              where hold.id = $1 and settings.singleton = true
              returning hold.*`,[u.id]),refreshed:!0};throw new _(409,"Release the current table hold before selecting another table","active_hold_exists",{holdId:u.id,eventId:u.event_id,tableId:u.table_id})}let l=await d(c,`select layout_table.*, assignment.layout_id as assigned_layout_id
           from public.event_layout_assignments assignment
           join public.hall_layouts layout
             on layout.id = assignment.layout_id and layout.status = 'published'
           join public.layout_tables layout_table
             on layout_table.layout_id = assignment.layout_id
          where assignment.event_id = $1 and layout_table.id = $2
          for update of layout_table`,[n,s]);if(!l)throw new _(404,"Table is not part of the event's published layout","table_not_found");if(await Cn(c,l,e.userPrincipal.userKey,o),await d(c,`select id, status
           from public.booking_records
          where event_id = $1 and table_id = $2
            and status in ('held','new','pending','confirmed','checked_in')
          limit 1`,[n,s]))throw new _(409,"Table is already booked","table_already_booked");let y=await d(c,`select id, expires_at
           from public.booking_holds
          where event_id = $1 and table_id = $2
            and status = 'active' and expires_at > now()
          limit 1`,[n,s]);if(y)throw new _(409,"Table is temporarily held by another user","table_temporarily_held",{retryAt:y.expires_at});let b=await d(c,`insert into public.booking_holds(
           event_id, layout_id, table_id, user_key, clan_id, session_id, expires_at
         )
         select $1,$2,$3,$4,$5,$6,
                now() + make_interval(secs => settings.hold_seconds)
           from public.booking_settings settings
          where settings.singleton = true
         returning *`,[n,l.assigned_layout_id,s,e.userPrincipal.userKey,o,e.userPrincipal.sessionId]);if(!b)throw new _(500,"Booking settings are missing","booking_settings_missing");return{hold:b,refreshed:!1}});a.status(r.refreshed?200:201).json(r)})),i.delete("/holds/:holdId",p(async(e,a)=>{let n=P(e.params.holdId,"holdId");if(!await d(t,`update public.booking_holds
          set status = 'released', released_at = now(), updated_at = now()
        where id = $1 and user_key = $2 and status = 'active'
        returning *`,[n,e.userPrincipal.userKey]))throw new _(404,"Active table hold was not found","not_found");a.status(204).end()})),i.post("/",p(async(e,a)=>{let n=String(e.get("idempotency-key")||"").trim(),s=f(n||e.body?.idempotencyKey,"idempotencyKey",160),o=P(e.body?.holdId,"holdId"),r=f(e.body?.customerName,"customerName",160),c=f(e.body?.phone,"phone",40),u=k(e.body?.guests,1,1,100),l=g(e.body?.comment,2e3);if(!A(e.body?.consentAccepted))throw new _(400,"Booking consent must be accepted","booking_consent_required");let y=await d(t,`select * from public.booking_records
        where idempotency_key = $1 and user_key = $2`,[s,e.userPrincipal.userKey]);if(y)return a.json({booking:y,replayed:!0});try{let b=await S(t,async v=>{await Mn(v);let h=await d(v,`select hold.*, layout_table.capacity, layout_table.minimum_deposit,
                  layout_table.status as table_status, layout_table.table_type,
                  assignment.layout_id as current_layout_id,
                  settings.auto_confirm
             from public.booking_holds hold
             join public.layout_tables layout_table on layout_table.id = hold.table_id
             join public.event_layout_assignments assignment on assignment.event_id = hold.event_id
             join public.booking_settings settings on settings.singleton = true
            where hold.id = $1 and hold.user_key = $2
            for update of hold`,[o,e.userPrincipal.userKey]);if(!h)throw new _(404,"Table hold was not found","not_found");if(h.status!=="active"||new Date(h.expires_at).getTime()<=Date.now())throw new _(409,"Table hold has expired","hold_expired");if(h.layout_id!==h.current_layout_id)throw new _(409,"Event layout changed; select a table again","event_layout_changed");if(u>Number(h.capacity))throw new _(400,`This table supports no more than ${h.capacity} guests`,"table_capacity_exceeded");await Cn(v,h,e.userPrincipal.userKey,h.clan_id||null);let j=await d(v,`insert into public.crm_customers(
             user_key, phone, first_name, last_activity_at
           ) values ($1,$2,$3,now())
           on conflict (user_key) do update
             set phone = excluded.phone,
                 first_name = excluded.first_name,
                 last_activity_at = now(),
                 updated_at = now()
           returning *`,[e.userPrincipal.userKey,c,r]),N=`booking-${Dn()}`,I=`BALI-${Dn().replaceAll("-","").slice(0,10).toUpperCase()}`,x=h.auto_confirm?"confirmed":"pending",R=await d(v,`insert into public.booking_records(
             id, booking_reference, idempotency_key, event_id, layout_id, table_id,
             hold_id, user_key, crm_customer_id, clan_id, booking_kind,
             customer_name, phone, guests, deposit, comment, status,
             consent_accepted, confirmed_at
           ) values (
             $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
             $12,$13,$14,$15,$16,$17,true,
             case when $17 = 'confirmed' then now() else null end
           )
           returning *`,[N,I,s,h.event_id,h.layout_id,h.table_id,h.id,e.userPrincipal.userKey,j.id,h.clan_id,h.clan_id?"clan":"personal",r,c,u,h.minimum_deposit,l,x]);return await v.query(`update public.booking_holds
              set status = 'converted', converted_at = now(), updated_at = now()
            where id = $1`,[h.id]),await v.query(`insert into public.booking_status_history(
             booking_id, previous_status, next_status, actor_type, actor_id, after_value
           ) values ($1,'held',$2,'user',$3,$4::jsonb)`,[R.id,x,e.userPrincipal.userKey,JSON.stringify(R)]),await v.query(`insert into public.notifications(
             user_key, notification_type, title, body, data, idempotency_key
           ) values ($1,'booking_created',$2,$3,$4::jsonb,$5)
           on conflict (idempotency_key) do nothing`,[e.userPrincipal.userKey,"\u0411\u0440\u043E\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 \u0441\u043E\u0437\u0434\u0430\u043D\u043E",`\u041D\u043E\u043C\u0435\u0440 \u0431\u0440\u043E\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F: ${R.booking_reference}`,JSON.stringify({bookingId:R.id,eventId:R.event_id}),`booking-created:${R.id}`]),R});a.status(201).json({booking:b,replayed:!1})}catch(b){if(b?.code==="23505"){let v=await d(t,`select * from public.booking_records
            where idempotency_key = $1 and user_key = $2`,[s,e.userPrincipal.userKey]);if(v)return a.json({booking:v,replayed:!0});throw new _(409,"Table was booked by another request","table_already_booked")}throw b}})),i.get("/:bookingId",p(async(e,a)=>{let n=$(e.params.bookingId,"bookingId"),s=await Is(t,n,e.userPrincipal.userKey);a.json({booking:s})})),i.post("/:bookingId/qr",p(async(e,a)=>{let n=$(e.params.bookingId,"bookingId"),s=ie(),o=await S(t,async c=>{let u=await d(c,`select * from public.booking_records
          where id = $1 and user_key = $2
          for update`,[n,e.userPrincipal.userKey]);if(!u)throw new _(404,"Booking was not found","not_found");if(!["confirmed","pending","new"].includes(u.status))throw new _(409,"A QR code is unavailable for this booking","booking_qr_unavailable");let l=await d(c,"select ends_at from public.event_runtime where event_id = $1",[u.event_id]),m=new Date(Date.now()+7*864e5).toISOString(),y=l?.ends_at&&new Date(l.ends_at).getTime()>Date.now()?new Date(l.ends_at).toISOString():m;return d(c,`insert into public.booking_qr_tokens(
           booking_id, user_key, token_hash, expires_at
         ) values ($1,$2,$3,$4)
         on conflict (booking_id) do update
           set token_hash = excluded.token_hash,
               expires_at = excluded.expires_at,
               redeemed_at = null,
               redeemed_by_admin_id = null,
               revoked_at = null,
               updated_at = now()
         returning id, booking_id, expires_at, created_at, updated_at`,[n,e.userPrincipal.userKey,Y(s),y])}),r=await ks.toDataURL(s,{errorCorrectionLevel:"M",margin:2,width:640,color:{dark:"#080a08",light:"#ffffff"}});a.json({qr:o,token:s,qrDataUrl:r})})),i.post("/:bookingId/cancel",p(async(e,a)=>{let n=$(e.params.bookingId,"bookingId"),s=g(e.body?.reason,1e3),o=await S(t,async r=>{let c=await d(r,`select * from public.booking_records
          where id = $1 and user_key = $2
          for update`,[n,e.userPrincipal.userKey]);if(!c)throw new _(404,"Booking was not found","not_found");if(!["new","pending","confirmed"].includes(c.status))throw new _(409,"Booking cannot be cancelled in its current state","booking_not_cancellable");let u=await d(r,`update public.booking_records
            set status = 'cancelled', cancelled_at = now(),
                cancelled_by = $2, updated_at = now()
          where id = $1
          returning *`,[n,e.userPrincipal.userKey]);return await r.query(`insert into public.booking_status_history(
           booking_id, previous_status, next_status, actor_type, actor_id,
           reason, before_value, after_value
         ) values ($1,$2,'cancelled','user',$3,$4,$5::jsonb,$6::jsonb)`,[n,c.status,e.userPrincipal.userKey,s,JSON.stringify(c),JSON.stringify(u)]),u});a.json({booking:o})})),i}var Un=D(()=>{"use strict";B();L();z();ye();me();Z()});import{Router as js}from"express";function Bn(t){let i=js();return i.use(H),i.get("/",p(async(e,a)=>{let[n,s,o]=await Promise.all([w(t,`select * from public.menu_catalog_items
          where active = true order by sort_order, category, name`),d(t,"select * from public.venue_content where id = 'venue-main' and active = true"),w(t,`select review.id, review.rating, review.body, review.created_at,
                user_row.name, user_row.avatar
           from public.venue_reviews review
           join public.app_users user_row on user_row.user_key = review.user_key
          where review.status = 'published'
          order by review.created_at desc limit 100`)]);a.json({menu:n,venue:s,reviews:o})})),i.post("/reviews",p(async(e,a)=>{let n=k(e.body?.rating,0,1,5),s=g(e.body?.body,2e3);if(!s)throw new _(400,"Review text is required","validation_error");let o=await d(t,`insert into public.venue_reviews(user_key, rating, body)
       values ($1,$2,$3)
       returning *`,[e.userPrincipal.userKey,n,s]);a.status(201).json({review:o})})),i}var Ln=D(()=>{"use strict";B();L();z();Z()});import{Router as xs}from"express";import Ss from"qrcode";function bt(t){return f(String(t.get("idempotency-key")||"").trim()||t.body?.idempotencyKey,"idempotencyKey",160)}async function Ps(t,i,e,a,n,s,o){await t.query(`insert into public.notifications(
       user_key, notification_type, title, body, data, idempotency_key
     ) values ($1,$2,$3,$4,$5::jsonb,$6)
     on conflict (idempotency_key) do nothing`,[i,e,a,n,JSON.stringify(s),o])}function wt(t){return Ss.toDataURL(t,{errorCorrectionLevel:"M",margin:2,width:640,color:{dark:"#080a08",light:"#ffffff"}})}function Hn(t){let i=xs();return i.use(H),i.get("/points",p(async(e,a)=>{let[n,s]=await Promise.all([d(t,"select * from public.point_accounts where user_key = $1",[e.userPrincipal.userKey]),w(t,`select * from public.point_ledger
          where user_key = $1 order by created_at desc limit 100`,[e.userPrincipal.userKey])]);a.json({account:n||{balance:0,lifetime_earned:0,lifetime_spent:0},ledger:s})})),i.get("/rewards",p(async(e,a)=>{let[n,s]=await Promise.all([w(t,`select * from public.reward_definitions
          where active = true
            and (valid_from is null or valid_from <= now())
            and (valid_until is null or valid_until > now())
          order by rarity, name`),w(t,`select user_reward.*, reward.name, reward.icon_url, reward.description,
                reward.rarity, reward.points, reward.xp
           from public.user_rewards user_reward
           join public.reward_definitions reward on reward.id = user_reward.reward_id
          where user_reward.user_key = $1
          order by user_reward.granted_at desc`,[e.userPrincipal.userKey])]);a.json({catalog:n,rewards:s})})),i.get("/gifts",p(async(e,a)=>{let[n,s,o]=await Promise.all([w(t,"select * from public.gift_catalog where active = true order by sort_order, name"),w(t,`select gift.*, catalog.name, catalog.description, catalog.image_url,
                sender.name as sender_name, sender.avatar as sender_avatar
           from public.gifts gift
           join public.gift_catalog catalog on catalog.id = gift.catalog_item_id
           left join public.app_users sender on sender.user_key = gift.sender_user_key
          where gift.recipient_user_key = $1
          order by gift.created_at desc`,[e.userPrincipal.userKey]),w(t,`select gift.*, catalog.name, catalog.image_url,
                recipient.name as recipient_name
           from public.gifts gift
           join public.gift_catalog catalog on catalog.id = gift.catalog_item_id
           join public.app_users recipient on recipient.user_key = gift.recipient_user_key
          where gift.sender_user_key = $1
          order by gift.created_at desc`,[e.userPrincipal.userKey])]);a.json({catalog:n,received:s,sent:o})})),i.post("/gifts",p(async(e,a)=>{await O(t,e,"gift.create",M(e));let n=bt(e),s=$(e.body?.catalogItemId,"catalogItemId"),o=$(e.body?.recipientUserKey,"recipientUserKey"),r=g(e.body?.message,500),c=e.userPrincipal.userKey;if(c===o)throw new _(400,"A user cannot send a gift to themselves","validation_error");let u=await d(t,`select * from public.gifts
        where idempotency_key = $1 and sender_user_key = $2`,[n,c]);if(u)return a.json({gift:u,replayed:!0});let l=ie();try{let m=await S(t,async y=>{let[b,v,h]=await Promise.all([d(y,"select * from public.gift_catalog where id = $1 and active = true for update",[s]),d(y,`select user_row.user_key, user_row.name,
                    coalesce(profile.allow_gifts, true) as allow_gifts
               from public.app_users user_row
               left join public.user_profiles profile on profile.user_key = user_row.user_key
              where user_row.user_key = $1 and user_row.account_status = 'active'`,[o]),d(y,`select 1 from public.user_blocks
              where (blocker_user_key = $1 and blocked_user_key = $2)
                 or (blocker_user_key = $2 and blocked_user_key = $1)
              limit 1`,[c,o])]);if(!b)throw new _(404,"Gift was not found","not_found");if(!v||!v.allow_gifts||h)throw new _(403,"This user cannot receive gifts from you","gift_unavailable");let j=Number(b.points_cost||0),N=j>0?await re(y,{userKey:c,amount:-j,operationType:"debit",sourceType:"gift",sourceId:s,reason:`\u041F\u043E\u0434\u0430\u0440\u043E\u043A: ${b.name}`,idempotencyKey:`gift-points:${n}`}):null;return d(y,`insert into public.gifts(
             catalog_item_id, sender_user_key, recipient_user_key, points_cost,
             point_transaction_id, message, status, qr_token_hash, expires_at,
             idempotency_key
           ) values (
             $1,$2,$3,$4,$5,$6,'delivered',$7,
             case when $8::integer is null then null else now() + make_interval(days => $8) end,
             $9
           )
           returning *`,[s,c,o,j,N?.ledger?.id||null,r,b.gift_type==="physical"?Y(l):null,b.validity_days,n])});await Ps(t,o,"gift_received","\u041D\u043E\u0432\u044B\u0439 \u043F\u043E\u0434\u0430\u0440\u043E\u043A",`${e.userPrincipal.name} \u043E\u0442\u043F\u0440\u0430\u0432\u0438\u043B \u0432\u0430\u043C \u043F\u043E\u0434\u0430\u0440\u043E\u043A.`,{giftId:m.id},`gift-received:${m.id}`),a.status(201).json({gift:m,replayed:!1})}catch(m){if(m?.code==="23505"){let y=await d(t,"select * from public.gifts where idempotency_key = $1 and sender_user_key = $2",[n,c]);if(y)return a.json({gift:y,replayed:!0})}throw m}})),i.post("/gifts/:giftId/qr",p(async(e,a)=>{let n=P(e.params.giftId,"giftId"),s=ie(),o=await d(t,`update public.gifts gift
          set qr_token_hash = $3, updated_at = now()
         from public.gift_catalog catalog
        where gift.id = $1
          and gift.recipient_user_key = $2
          and gift.catalog_item_id = catalog.id
          and catalog.gift_type = 'physical'
          and gift.status = 'delivered'
          and (gift.expires_at is null or gift.expires_at > now())
        returning gift.id, gift.status, gift.expires_at, catalog.name`,[n,e.userPrincipal.userKey,Y(s)]);if(!o)throw new _(409,"This gift cannot be redeemed","gift_redemption_unavailable");a.json({gift:o,token:s,qrDataUrl:await wt(s)})})),i.get("/vip",p(async(e,a)=>{let[n,s]=await Promise.all([w(t,"select * from public.vip_plans where active = true order by sort_order, points_cost"),w(t,`select subscription.*, plan.name, plan.benefits, plan.badge_url,
                plan.profile_frame_url, plan.points_multiplier, plan.extra_game_lives
           from public.user_vip_subscriptions subscription
           join public.vip_plans plan on plan.id = subscription.plan_id
          where subscription.user_key = $1
          order by subscription.ends_at desc`,[e.userPrincipal.userKey])]);a.json({plans:n,subscriptions:s})})),i.post("/vip/purchase",p(async(e,a)=>{let n=bt(e),s=$(e.body?.planId,"planId"),o=e.userPrincipal.userKey,r=await d(t,`select * from public.user_vip_subscriptions
        where idempotency_key = $1 and user_key = $2`,[n,o]);if(r)return a.json({subscription:r,replayed:!0});let c;try{c=await S(t,async u=>{let l=await d(u,"select * from public.vip_plans where id = $1 and active = true for update",[s]);if(!l)throw new _(404,"VIP plan was not found","not_found");let m=await d(u,`select * from public.user_vip_subscriptions
          where user_key = $1 and status = 'active' and ends_at > now()
          order by ends_at desc limit 1 for update`,[o]),y=m&&new Date(m.ends_at).getTime()>Date.now()?new Date(m.ends_at):new Date,b=new Date(y.getTime()+Number(l.duration_days)*864e5),v=Number(l.points_cost||0),h=v>0?await re(u,{userKey:o,amount:-v,operationType:"debit",sourceType:"vip",sourceId:s,reason:`VIP: ${l.name}`,idempotencyKey:`vip-points:${n}`}):null,j=await d(u,`insert into public.user_vip_subscriptions(
           user_key, plan_id, source_type, point_transaction_id, starts_at,
           ends_at, status, idempotency_key
         ) values ($1,$2,'purchase',$3,$4,$5,$6,$7)
         returning *`,[o,s,h?.ledger?.id||null,y.toISOString(),b.toISOString(),y.getTime()>Date.now()?"scheduled":"active",n]);return await u.query(`update public.app_users set vip_expires_at = $2, updated_at = now()
          where user_key = $1`,[o,b.toISOString()]),j})}catch(u){if(u?.code==="23505"){let l=await d(t,`select * from public.user_vip_subscriptions
            where idempotency_key = $1 and user_key = $2`,[n,o]);if(l)return a.json({subscription:l,replayed:!0})}throw u}a.status(201).json({subscription:c,replayed:!1})})),i.get("/shop",p(async(e,a)=>{let[n,s]=await Promise.all([w(t,`select * from public.shop_items
          where status = 'active'
            and (valid_from is null or valid_from <= now())
            and (valid_until is null or valid_until > now())
            and (stock is null or stock > 0)
          order by sort_order, name`),w(t,`select shop_order.*,
                coalesce(json_agg(order_item order by order_item.created_at)
                  filter (where order_item.id is not null), '[]'::json) as items
           from public.shop_orders shop_order
           left join public.shop_order_items order_item on order_item.order_id = shop_order.id
          where shop_order.user_key = $1
          group by shop_order.id
          order by shop_order.created_at desc`,[e.userPrincipal.userKey])]);a.json({items:n,orders:s})})),i.post("/shop/orders",p(async(e,a)=>{let n=bt(e),s=e.userPrincipal.userKey,o=Array.isArray(e.body?.items)?e.body.items:[];if(!o.length||o.length>20)throw new _(400,"Order must contain 1-20 items","validation_error");let r=o.map(m=>({itemId:$(m?.itemId,"itemId"),quantity:k(m?.quantity,1,1,100)}));if(new Set(r.map(m=>m.itemId)).size!==r.length)throw new _(400,"Each shop item must occur only once","validation_error");let c=await d(t,"select * from public.shop_orders where idempotency_key = $1 and user_key = $2",[n,s]);if(c)return a.json({order:c,replayed:!0});let u=ie(),l;try{l=await S(t,async m=>{let y=[],b=0;for(let j of r){let N=await d(m,`select * from public.shop_items
            where id = $1 and status = 'active'
              and (valid_from is null or valid_from <= now())
              and (valid_until is null or valid_until > now())
            for update`,[j.itemId]);if(!N)throw new _(404,`Shop item ${j.itemId} is unavailable`,"shop_item_unavailable");if(N.stock!==null&&Number(N.stock)<j.quantity)throw new _(409,`Not enough stock for ${N.name}`,"shop_stock_insufficient");if(N.per_user_limit!==null){let I=await d(m,`select coalesce(sum(order_item.quantity), 0)::integer as quantity
               from public.shop_order_items order_item
               join public.shop_orders shop_order on shop_order.id = order_item.order_id
              where shop_order.user_key = $1 and order_item.item_id = $2
                and shop_order.status not in ('cancelled','refunded')`,[s,N.id]);if(Number(I?.quantity||0)+j.quantity>Number(N.per_user_limit))throw new _(409,`Purchase limit reached for ${N.name}`,"shop_user_limit")}b+=Number(N.points_cost)*j.quantity,y.push({...N,quantity:j.quantity})}let v=b>0?await re(m,{userKey:s,amount:-b,operationType:"debit",sourceType:"shop",sourceId:n,reason:"\u0417\u0430\u043A\u0430\u0437 BALI Shop",idempotencyKey:`shop-points:${n}`}):null,h=await d(m,`insert into public.shop_orders(
           user_key, total_points, point_transaction_id, status,
           qr_token_hash, idempotency_key
         ) values ($1,$2,$3,'paid',$4,$5)
         returning *`,[s,b,v?.ledger?.id||null,Y(u),n]);for(let j of y)await m.query(`insert into public.shop_order_items(
             order_id, item_id, item_name, unit_points, quantity, requires_redemption
           ) values ($1,$2,$3,$4,$5,$6)`,[h.id,j.id,j.name,j.points_cost,j.quantity,!!j.requires_redemption]),j.stock!==null&&await m.query(`update public.shop_items
                set stock = stock - $2,
                    status = case when stock - $2 <= 0 then 'sold_out' else status end,
                    updated_at = now()
              where id = $1`,[j.id,j.quantity]);return{order:h,requiresRedemption:y.some(j=>!!j.requires_redemption)}})}catch(m){if(m?.code==="23505"){let y=await d(t,`select * from public.shop_orders
            where idempotency_key = $1 and user_key = $2`,[n,s]);if(y)return a.json({order:y,replayed:!0})}throw m}a.status(201).json({order:l.order,qrToken:l.requiresRedemption?u:void 0,qrDataUrl:l.requiresRedemption?await wt(u):void 0,replayed:!1})})),i.post("/shop/orders/:orderId/qr",p(async(e,a)=>{let n=P(e.params.orderId,"orderId"),s=ie(),o=await d(t,`update public.shop_orders shop_order
          set qr_token_hash = $3, updated_at = now()
        where shop_order.id = $1
          and shop_order.user_key = $2
          and shop_order.status = 'paid'
          and exists (
            select 1
              from public.shop_order_items order_item
             where order_item.order_id = shop_order.id
               and order_item.requires_redemption = true
          )
        returning shop_order.id, shop_order.total_points, shop_order.status,
                  shop_order.created_at, shop_order.updated_at`,[n,e.userPrincipal.userKey,Y(s)]);if(!o)throw new _(409,"This order cannot be redeemed","shop_redemption_unavailable");a.json({order:o,token:s,qrDataUrl:await wt(s)})})),i}var Qn=D(()=>{"use strict";B();Me();L();z();ye();me();Z()});import{Router as Ts}from"express";function Jn(t){if(["completed","archived","cancelled"].includes(String(t.runtime_status||"")))return!1;let i=t.event_date?`${String(t.event_date).slice(0,10)}T${String(t.event_time||"23:00").slice(0,5)}:00`:"",e=t.starts_at?new Date(t.starts_at).getTime():Number.NaN,a=t.ends_at?new Date(t.ends_at).getTime():Number.isNaN(e)?i?new Date(i).getTime()+720*60*1e3:Number.NaN:e+720*60*1e3;return Number.isNaN(a)||a>Date.now()}async function Ce(t,i){let e=await d(t,`select e.*, r.status as runtime_status, r.starts_at, r.ends_at, r.age_limit,
            r.dj, r.artists, r.metadata
       from public.events e
       left join public.event_runtime r on r.event_id = e.id
      where e.id = $1`,[i]);if(!e)throw new _(404,"Event was not found","not_found");return e}async function zn(t,i){await t.query(`insert into public.notifications(
       user_key, notification_type, title, body, data, idempotency_key
     ) values ($1,$2,$3,$4,$5::jsonb,$6)
     on conflict (idempotency_key) do nothing`,[i.userKey,i.type,i.title,i.body,JSON.stringify(i.data||{}),i.idempotencyKey])}function Vn(t){let i=Ts();return i.use(H),i.get("/",p(async(e,a)=>{let n=await w(t,`select e.id, e.title, e.event_date, e.event_time, e.description, e.image_url,
              e.active, e.sort_order,
              coalesce(r.status, case when e.active then 'published' else 'draft' end) as status,
              r.starts_at, r.ends_at, r.age_limit, r.dj, r.artists, r.metadata,
              attendance.status as my_attendance_status,
              coalesce(counts.going_count, 0)::integer as going_count,
              coalesce(counts.maybe_count, 0)::integer as maybe_count,
              coalesce(checkins.checked_in_count, 0)::integer as checked_in_count
         from public.events e
         left join public.event_runtime r on r.event_id = e.id
         left join public.event_attendance attendance
           on attendance.event_id = e.id and attendance.user_key = $1
         left join (
           select event_id,
                  count(*) filter (where status = 'going') as going_count,
                  count(*) filter (where status = 'maybe') as maybe_count
             from public.event_attendance
            group by event_id
         ) counts on counts.event_id = e.id
         left join (
           select event_id, count(*)::integer as checked_in_count
             from public.event_checkins
            group by event_id
         ) checkins on checkins.event_id = e.id
        where e.active = true
          and coalesce(r.status, 'published') in ('published', 'active', 'completed')
        order by coalesce(r.starts_at, e.event_date::timestamptz), e.sort_order, e.title`,[e.userPrincipal.userKey]);a.json({events:n})})),i.get("/invitations/me",p(async(e,a)=>{let n=await w(t,`select invitation.*, sender.name as sender_name, sender.avatar as sender_avatar,
              event.title as event_title, event.event_date, event.event_time,
              runtime.starts_at, runtime.ends_at
         from public.event_invitations invitation
         join public.app_users sender on sender.user_key = invitation.sender_user_key
         join public.events event on event.id = invitation.event_id
         left join public.event_runtime runtime on runtime.event_id = event.id
        where invitation.recipient_user_key = $1
        order by case when invitation.status = 'pending' then 0 else 1 end,
                 invitation.created_at desc`,[e.userPrincipal.userKey]);a.json({invitations:n})})),i.patch("/invitations/:invitationId",p(async(e,a)=>{let n=P(e.params.invitationId,"invitationId"),s=K(e.body?.status,"status",As),o=await S(t,async r=>{let c=await d(r,`select invitation.*, event.title as event_title
           from public.event_invitations invitation
           join public.events event on event.id = invitation.event_id
          where invitation.id = $1 and invitation.recipient_user_key = $2
          for update`,[n,e.userPrincipal.userKey]);if(!c)throw new _(404,"Invitation was not found","not_found");if(c.status!=="pending")throw new _(409,"Invitation has already been answered","invitation_already_answered");let u=await d(r,`update public.event_invitations
            set status = $2, responded_at = now(), updated_at = now()
          where id = $1
          returning *`,[n,s]);return(s==="going"||s==="maybe")&&await r.query(`insert into public.event_attendance(
             event_id, user_key, status, source_type, source_id
           ) values ($1,$2,$3,'invitation',$4)
           on conflict (event_id, user_key) do update
             set status = excluded.status,
                 source_type = excluded.source_type,
                 source_id = excluded.source_id,
                 responded_at = now(),
                 updated_at = now()`,[c.event_id,e.userPrincipal.userKey,s,n]),await zn(r,{userKey:c.sender_user_key,type:"event_invitation_response",title:"\u041E\u0442\u0432\u0435\u0442 \u043D\u0430 \u043F\u0440\u0438\u0433\u043B\u0430\u0448\u0435\u043D\u0438\u0435",body:`${e.userPrincipal.name} \u043E\u0442\u0432\u0435\u0442\u0438\u043B \u043D\u0430 \u043F\u0440\u0438\u0433\u043B\u0430\u0448\u0435\u043D\u0438\u0435: ${s==="going"?"\u0418\u0434\u0443":s==="maybe"?"\u0412\u043E\u0437\u043C\u043E\u0436\u043D\u043E":"\u041E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u043E"}.`,data:{invitationId:n,eventId:c.event_id,status:s},idempotencyKey:`event-invitation-response:${n}`}),u});a.json({invitation:o})})),i.get("/:eventId/layout",p(async(e,a)=>{let n=$(e.params.eventId,"eventId");await Ce(t,n);let s=await d(t,`select assignment.*, layout.status as layout_status
         from public.event_layout_assignments assignment
         join public.hall_layouts layout on layout.id = assignment.layout_id
        where assignment.event_id = $1`,[n]);if(!s)throw new _(404,"Event layout was not assigned","event_layout_not_found");let o=await De(t,s.layout_id,!0),r=await w(t,`select layout_table.id,
              case
                when booking.id is not null then
                  case when booking.status in ('new','pending') then 'pending' else 'booked' end
                when hold.id is not null and hold.user_key = $2 then 'selected'
                when hold.id is not null then 'held'
                when layout_table.status = 'unavailable' then 'unavailable'
                when layout_table.status = 'vip_only' then 'vip'
                when layout_table.status = 'clan_only' then 'clan'
                else 'available'
              end as availability_status,
              hold.expires_at as hold_expires_at,
              case when hold.user_key = $2 then hold.id else null end as my_hold_id
         from public.layout_tables layout_table
         left join public.booking_records booking
           on booking.event_id = $1
          and booking.table_id = layout_table.id
          and booking.status in ('held','new','pending','confirmed','checked_in')
         left join public.booking_holds hold
           on hold.event_id = $1
          and hold.table_id = layout_table.id
          and hold.status = 'active'
          and hold.expires_at > now()
        where layout_table.layout_id = $3 and layout_table.active = true`,[n,e.userPrincipal.userKey,s.layout_id]),c=new Map(r.map(u=>[u.id,u]));a.json({eventId:n,assignment:s,layout:o.layout,elements:o.elements,tables:o.tables.map(u=>({...u,...c.get(u.id)||{availability_status:"available"}}))})})),i.get("/:eventId",p(async(e,a)=>{let n=$(e.params.eventId,"eventId"),s=await Ce(t,n),[o,r,c]=await Promise.all([w(t,`select attendance.status, attendance.updated_at,
                user_row.user_key, user_row.name, user_row.avatar,
                profile.status_text
           from public.event_attendance attendance
           join public.app_users user_row on user_row.user_key = attendance.user_key
           left join public.user_profiles profile on profile.user_key = user_row.user_key
          where attendance.event_id = $1
            and attendance.status in ('going', 'maybe')
            and coalesce(profile.discoverable, true) = true
          order by attendance.updated_at desc`,[n]),w(t,`select distinct clan.id, clan.name, clan.clan_type,
                count(clan_attendance.user_key)::integer as participant_count
           from public.clan_event_attendance clan_attendance
           join public.clans clan on clan.id = clan_attendance.clan_id
          where clan_attendance.event_id = $1
            and clan_attendance.status in ('going', 'maybe')
          group by clan.id, clan.name, clan.clan_type
          order by participant_count desc, clan.name`,[n]),w(t,`select checkin.checked_in_at,
                user_row.user_key, user_row.name, user_row.avatar,
                profile.status_text
           from public.event_checkins checkin
           join public.app_users user_row on user_row.user_key = checkin.user_key
           left join public.user_profiles profile on profile.user_key = user_row.user_key
          where checkin.event_id = $1
            and coalesce(profile.discoverable, true) = true
          order by checkin.checked_in_at desc`,[n])]);a.json({event:s,participants:o,checkedIn:c,clans:r})})),i.put("/:eventId/attendance",p(async(e,a)=>{let n=$(e.params.eventId,"eventId"),s=K(e.body?.status,"status",Ns),o=await Ce(t,n);if(!Jn(o)&&s!=="cancelled")throw new _(409,"Attendance can be changed only for an active future event","event_not_active");let r=await d(t,`insert into public.event_attendance(event_id, user_key, status, source_type)
       values ($1,$2,$3,'self')
       on conflict (event_id, user_key) do update
         set status = excluded.status,
             source_type = 'self',
             responded_at = now(),
             updated_at = now()
       returning *`,[n,e.userPrincipal.userKey,s]);a.json({attendance:r})})),i.post("/:eventId/invitations",p(async(e,a)=>{await O(t,e,"event_invitation.create",M(e));let n=$(e.params.eventId,"eventId"),s=$(e.body?.recipientUserKey,"recipientUserKey"),o=g(e.body?.message,500);if(s===e.userPrincipal.userKey)throw new _(400,"A user cannot invite themselves","validation_error");let r=await Ce(t,n);if(!Jn(r))throw new _(409,"Only active future events can be invited to","event_not_active");let c=await d(t,`select user_row.user_key, user_row.name,
              coalesce(profile.allow_event_invites, true) as allow_event_invites,
              exists(
                select 1 from public.user_blocks block
                 where (block.blocker_user_key = $1 and block.blocked_user_key = user_row.user_key)
                    or (block.blocker_user_key = user_row.user_key and block.blocked_user_key = $1)
              ) as blocked
         from public.app_users user_row
         left join public.user_profiles profile on profile.user_key = user_row.user_key
        where user_row.user_key = $2 and user_row.account_status = 'active'`,[e.userPrincipal.userKey,s]);if(!c)throw new _(404,"Recipient was not found","not_found");if(c.blocked)throw new _(403,"Invitation is unavailable because one of the users blocked the other","user_blocked");if(!c.allow_event_invites)throw new _(403,"Recipient disabled event invitations","event_invitations_disabled");try{let u=await S(t,async l=>{let m=await d(l,`insert into public.event_invitations(
             event_id, sender_user_key, recipient_user_key, message
           ) values ($1,$2,$3,$4)
           returning *`,[n,e.userPrincipal.userKey,s,o]);return await zn(l,{userKey:s,type:"event_invitation",title:"\u041F\u0440\u0438\u0433\u043B\u0430\u0448\u0435\u043D\u0438\u0435 \u043D\u0430 \u043C\u0435\u0440\u043E\u043F\u0440\u0438\u044F\u0442\u0438\u0435",body:`${e.userPrincipal.name} \u043F\u0440\u0438\u0433\u043B\u0430\u0448\u0430\u0435\u0442 \u0432\u0430\u0441 \u043D\u0430 \xAB${r.title}\xBB.`,data:{invitationId:m.id,eventId:n},idempotencyKey:`event-invitation:${m.id}`}),m});a.status(201).json({invitation:u})}catch(u){throw u?.code==="23505"?new _(409,"An unanswered invitation already exists","invitation_already_pending"):u}})),i.post("/:eventId/archive-invitations",p(async(e,a)=>{let n=$(e.params.eventId,"eventId");await Ce(t,n);let s=await t.query(`update public.event_invitations
          set status = 'archived', archived_at = now(), updated_at = now()
        where event_id = $1
          and (sender_user_key = $2 or recipient_user_key = $2)
          and status <> 'archived'`,[n,e.userPrincipal.userKey]);a.json({archived:s.rowCount||0})})),i}var Ns,As,Gn=D(()=>{"use strict";B();L();z();ye();Z();ze();Ns=["going","maybe","not_going","cancelled"],As=["going","maybe","declined"]});import{createHash as Ks}from"node:crypto";function Xe(t){return t&&!Array.isArray(t)&&typeof t=="object"?t:{}}function ue(t,i,e,a){let n=Number(t);return Number.isFinite(n)?Math.max(e,Math.min(a,Math.round(n))):i}function Ee(t,i,e,a){let n=Number(t);return Number.isFinite(n)?Math.max(e,Math.min(a,n)):i}function ft(t){return Array.isArray(t)?t.map(ft):t&&typeof t=="object"?Object.fromEntries(Object.entries(t).filter(([,i])=>i!==void 0).sort(([i],[e])=>i.localeCompare(e)).map(([i,e])=>[i,ft(e)])):t}function je(t){return Ks("sha256").update(JSON.stringify(ft(t))).digest("hex")}function Ms(t){return Number.parseInt(je(t).slice(0,8),16)>>>0}function Fn(t){let i=Ms(t)||1;return()=>{i+=1831565813;let e=i;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}}function Os(t,i={}){let e={...Ze,...Xe(i)},a=Math.max(1,Math.floor(t));return 1+Ee(e.sqrtDifficulty,Ze.sqrtDifficulty,0,10)*Math.sqrt(a-1)+Ee(e.linearDifficulty,Ze.linearDifficulty,0,10)*(a-1)}function Cs(t,i,e,a){let n=Math.min(ue(a.maxGoals,3,1,5),1+Math.floor(t/12)),s=t%7,o=[{type:"score",target:e}];return n>1&&(s===0||s===3?o.push({type:"collect",tileIndex:t%5,target:Math.round(12+i*5)}):t>=ue(a.obstacleStartLevel,8,1,1e6)?o.push({type:"obstacles",target:Math.round(4+i*2)}):o.push({type:"createSpecial",special:"line",target:Math.max(1,Math.round(i))})),n>2&&o.push(t%2?{type:"activateSpecial",special:"any",target:Math.max(1,Math.round(i))}:{type:"collect",tileIndex:(t+2)%5,target:Math.round(10+i*4)}),o}function Wn(t,i,e){let a={...Ze,...Xe(i.level_rules??i.levelRules)},n={...Rs,...Xe(i.scoring_rules??i.scoringRules)},s={...Ds,...Xe(i.rating_rules??i.ratingRules)},o=Math.max(1,Math.floor(t)),r=Os(o,a),c=ue(a.rows,6,5,10),u=ue(a.columns,6,5,10),l=ue(a.minTileTypes,5,5,8),m=ue(a.maxTileTypes,8,l,8),y=Math.min(m,l+Math.floor((o-1)/18)),b=Math.max(500,Math.round(Ee(a.baseTargetScore,1e4,500,1e9)*r/100)*100),v=Math.max(ue(a.minMoves,12,5,99),ue(a.baseMoves,25,5,99)-Math.floor(Math.log2(o+1))),h=Math.max(0,o-ue(a.obstacleStartLevel,8,1,1e6)),j=ue(a.checkpointEvery,10,1,1e4),N=ue(a.milestoneEvery,25,1,1e4);return{level:o,seed:`${e}:${o}`,difficulty:Number(r.toFixed(5)),rows:c,columns:u,tileTypes:y,moves:v,targetScore:b,goals:Cs(o,r,b,a),checkpoint:o%j===0,multistage:o%N===0,obstacleChance:o<ue(a.obstacleStartLevel,8,1,1e6)?0:Math.min(Ee(a.obstacleChanceMax,.28,0,.8),.04+h*.006),blockedChance:o<N?0:Math.min(Ee(a.blockedChanceMax,.12,0,.5),.02+o*5e-4),scoring:n,rating:s}}function We(t){return t&&!t.blocked?t.tile:""}function gt(t,i,e){let a=[];for(let n=0;n<i;n+=1){let s=0;for(let o=1;o<=e;o+=1){let r=We(t[n*e+s]),c=o<e?We(t[n*e+o]):"";(!r||c!==r)&&(r&&o-s>=3&&a.push(Array.from({length:o-s},(u,l)=>n*e+s+l)),s=o)}}for(let n=0;n<e;n+=1){let s=0;for(let o=1;o<=i;o+=1){let r=We(t[s*e+n]),c=o<i?We(t[o*e+n]):"";(!r||c!==r)&&(r&&o-s>=3&&a.push(Array.from({length:o-s},(u,l)=>(s+l)*e+n)),s=o)}}return a}function Yn(t,i,e){let a=Math.floor(t/e),n=Math.floor(i/e);return Math.abs(a-n)+Math.abs(t%e-i%e)===1}function qe(t,i,e){[t[i],t[e]]=[t[e],t[i]]}function Zn(t,i,e){for(let a=0;a<t.length;a+=1)for(let n of[a+1,a+e]){if(n>=t.length||!Yn(a,n,e)||t[a]?.blocked||t[n]?.blocked)continue;qe(t,a,n);let s=gt(t,i,e).length>0;if(qe(t,a,n),s)return[a,n]}return null}function Xn(t,i,e){return!!Zn(t,i,e)}function et(t,i){let e=i.slice(0,t.tileTypes);if(e.length<5)throw new Error("At least five active Match-3 symbols are required");for(let a=0;a<80;a+=1){let n=Fn(`${t.seed}:board:${a}`),s=[];for(let o=0;o<t.rows*t.columns;o+=1){let r=Math.floor(o/t.columns),c=o%t.columns,u=new Set;c>=2&&s[o-1]?.tile===s[o-2]?.tile&&u.add(s[o-1].tile),r>=2&&s[o-t.columns]?.tile===s[o-t.columns*2]?.tile&&u.add(s[o-t.columns].tile);let l=e.filter(b=>!u.has(b)),m=t.blockedChance>0&&n()<t.blockedChance,y=!m&&t.obstacleChance>0&&n()<t.obstacleChance?n()<.2?2:1:0;s.push({tile:l[Math.floor(n()*l.length)]||e[0],special:"",obstacle:y,blocked:m})}if(Xn(s,t.rows,t.columns))return s}throw new Error("Unable to generate a playable Match-3 board")}function qn(t,i,e,a,n,s){let o=Fn(`${e.seed}:move:${n}:cascade:${s}:${je(t)}`),r=t.map(c=>({...c}));for(let c=0;c<e.columns;c+=1){let u=[];for(let m=e.rows-1;m>=0;m-=1){let y=m*e.columns+c;r[y]?.blocked||i.has(y)||u.push(r[y])}let l=0;for(let m=e.rows-1;m>=0;m-=1){let y=m*e.columns+c;r[y]?.blocked||(r[y]=u[l++]||{tile:a[Math.floor(o()*Math.min(a.length,e.tileTypes))],special:"",obstacle:0,blocked:!1})}}return r}function Ye(t,i,e,a,n){let s=t[i];if(!s?.special)return[];let o=Math.floor(i/n),r=i%n;if(s.special==="line-h")return Array.from({length:n},(u,l)=>o*n+l);if(s.special==="line-v")return Array.from({length:a},(u,l)=>l*n+r);if(s.special==="bomb"){let u=[];for(let l=-1;l<=1;l+=1)for(let m=-1;m<=1;m+=1){let y=o+l,b=r+m;y>=0&&y<a&&b>=0&&b<n&&u.push(y*n+b)}return u}let c=t[e]?.tile;return t.flatMap((u,l)=>!u.blocked&&(!c||u.tile===c)?[l]:[])}function ea(t,i,e,a,n,s){let o=t.map(I=>({...I}));if(!Number.isInteger(i)||!Number.isInteger(e)||!Yn(i,e,a.columns))return{valid:!1,reason:"not_adjacent",board:o,scoreDelta:0,progressDelta:{},breakdown:{},cascades:0};if(!o[i]||!o[e]||o[i].blocked||o[e].blocked)return{valid:!1,reason:"blocked",board:o,scoreDelta:0,progressDelta:{},breakdown:{},cascades:0};qe(o,i,e);let r=o[i]?.special,c=o[e]?.special,u=new Set;if(r&&c?r==="rainbow"||c==="rainbow"?o.forEach((I,x)=>{I.blocked||u.add(x)}):(Ye(o,i,e,a.rows,a.columns).forEach(I=>u.add(I)),Ye(o,e,i,a.rows,a.columns).forEach(I=>u.add(I))):(r||c)&&Ye(o,r?i:e,r?e:i,a.rows,a.columns).forEach(R=>u.add(R)),!u.size&&!gt(o,a.rows,a.columns).length)return qe(o,i,e),{valid:!1,reason:"no_match",board:o,scoreDelta:0,progressDelta:{},breakdown:{},cascades:0};let l=o,m=0,y=0,b={},v={line:0,bomb:0,rainbow:0},h={line:0,bomb:0,rainbow:0,any:0},j={combinations:0,cascades:0,specials:0,obstacles:0},N=0;for(let I=1;I<=12;I+=1){let x=gt(l,a.rows,a.columns);if(!x.length&&!u.size)break;N=I;let R=new Set(u.size?u:x.flat()),J=[...R],U=new Set;for(;J.length;){let V=J.shift(),q=l[V]?.special;if(!q||U.has(V))continue;U.add(V);let st=V===i?e:i;for(let ot of Ye(l,V,st,a.rows,a.columns))R.has(ot)||J.push(ot),R.add(ot);let Ke=q.startsWith("line")?"line":q;h[Ke]=Number(h[Ke]||0)+1,h.any+=1;let xt=Number(a.scoring[`${Ke}Activate`]||0);j.specials+=xt,m+=xt}let C="",W=x.flatMap((V,q)=>x.slice(q+1).flatMap(st=>V.filter(Ke=>st.includes(Ke)))),oe=x.find(V=>V.includes(e))||x[0]||[...R];!u.size&&W.length?C="bomb":!u.size&&oe.length>=5?C="rainbow":!u.size&&oe.length===4&&(C=oe.every(q=>Math.floor(q/a.columns)===Math.floor(oe[0]/a.columns))?"line-h":"line-v");let se=W[0]??(oe.includes(e)?e:oe[0]);if(C){R.delete(se);let V=C==="rainbow"?"rainbow":C==="bomb"?"bomb":"line";v[V]+=1;let q=Number(a.scoring[`${V}Create`]||0);j.specials+=q,m+=q}let de=0,we=0;for(let V of R){let q=l[V];!q||q.blocked||(b[q.tile]=Number(b[q.tile]||0)+1,q.obstacle>0&&(y+=1,we+=a.scoring.obstacleLayer),de+=1)}let Le=Math.min(a.scoring.maxCascade,1+a.scoring.cascadeStep*(I-1)),fe=x.length?Math.max(...x.map(V=>V.length>=6?a.scoring.combo6:V.length===5?a.scoring.combo5:V.length===4?a.scoring.combo4:a.scoring.combo3)):1,xe=Math.round(de*a.scoring.baseTile*fe*Le);j.obstacles+=we,m+=xe+we,I===1?j.combinations+=xe:j.cascades+=xe,l=qn(l,R,a,n,s,I),C&&l[se]&&!l[se].blocked&&(l[se].special=C),u=new Set}return Xn(l,a.rows,a.columns)||(l=et({...a,seed:`${a.seed}:reshuffle:${s}`},n)),{valid:!0,board:l,scoreDelta:m,progressDelta:{collected:b,obstaclesDestroyed:y,specialsCreated:v,specialsActivated:h},breakdown:j,cascades:N}}function ta(t,i,e,a,n,s){let o=t.map(m=>({...m}));if(i==="hint"){let m=Zn(o,a.rows,a.columns);return{valid:!!m,reason:m?void 0:"no_hint",board:o,scoreDelta:0,progressDelta:{},hint:m||[]}}if(i==="shuffle")return{valid:!0,board:et({...a,seed:`${a.seed}:booster:shuffle:${s}`},n),scoreDelta:0,progressDelta:{}};if(!Number.isInteger(e)||e===null||e<0||e>=o.length)return{valid:!1,reason:"invalid_target",board:o,scoreDelta:0,progressDelta:{}};if(o[e]?.blocked)return{valid:!1,reason:"blocked",board:o,scoreDelta:0,progressDelta:{}};let r=new Set;if(i==="remove"&&r.add(e),i==="removeType"){let m=o[e]?.tile;o.forEach((y,b)=>{!y.blocked&&y.tile===m&&r.add(b)})}if(i==="bomb"){let m=Math.floor(e/a.columns),y=e%a.columns;for(let b=-1;b<=1;b+=1)for(let v=-1;v<=1;v+=1){let h=m+b,j=y+v;if(h>=0&&h<a.rows&&j>=0&&j<a.columns){let N=h*a.columns+j;o[N]?.blocked||r.add(N)}}}let c={},u=0;for(let m of r){let y=o[m];y&&(c[y.tile]=Number(c[y.tile]||0)+1,y.obstacle>0&&(u+=1))}let l=Math.round(r.size*Number(a.scoring.baseTile||100));return{valid:!0,board:qn(o,r,a,n,1e5+s,1),scoreDelta:l,progressDelta:{collected:c,obstaclesDestroyed:u},cleared:r.size}}function Ue(){return{score:0,collected:{},obstaclesDestroyed:0,specialsCreated:{line:0,bomb:0,rainbow:0},specialsActivated:{line:0,bomb:0,rainbow:0,any:0}}}function Es(t,i,e){return t.type==="score"?Number(i.score||0):t.type==="collect"?Number(i.collected[e[t.tileIndex||0]]||0):t.type==="obstacles"?Number(i.obstaclesDestroyed||0):t.type==="createSpecial"?Number(i.specialsCreated[t.special||"line"]||0):Number(i.specialsActivated[t.special||"any"]||0)}function na(t,i,e){return t.goals.every(a=>Es(a,i,e)>=a.target)}function aa(t,i,e,a){return e?t>=i*a.star3?3:t>=i*a.star2?2:1:0}function sa(t,i,e,a){return i<1?0:Math.round(a.base*(1+a.levelLog*Math.log(Math.max(1,t)))*a[`star${i}`]*a[`continue${Math.min(2,e)}`])}var Ze,Rs,Ds,oa=D(()=>{"use strict";Ze={rows:6,columns:6,minTileTypes:5,maxTileTypes:8,baseMoves:25,minMoves:12,baseTargetScore:1e4,sqrtDifficulty:.06,linearDifficulty:.004,maxGoals:3,checkpointEvery:10,milestoneEvery:25,specialStartLevel:4,obstacleStartLevel:8,blockedChanceMax:.12,obstacleChanceMax:.28},Rs={baseTile:100,combo3:1,combo4:1.25,combo5:1.6,combo6:2,comboTL:1.75,cascadeStep:.35,maxCascade:3,lineCreate:250,bombCreate:400,rainbowCreate:650,lineActivate:350,bombActivate:550,rainbowActivate:900,obstacleLayer:150,goalComplete:1e3,allGoalsBase:2500,remainingMove:200,cleanMultiplier:.1,star2:1.2,star3:1.5},Ds={base:1e3,levelLog:.1,star1:1,star2:1.15,star3:1.35,continue0:1,continue1:.85,continue2:.65}});import{Router as Us}from"express";function Ne(t){return f(String(t.get("idempotency-key")||"").trim()||t.body?.idempotencyKey,"idempotencyKey",160)}function Bs(t){return(Array.isArray(t?.symbols)?t.symbols:[]).filter(e=>e?.active!==!1&&e?.key).map(e=>({key:String(e.key),label:String(e.label||e.key),imageUrl:String(e.imageUrl||e.defaultImageUrl||"")}))}function Be(t,i){Object.entries(i||{}).forEach(([e,a])=>{t[e]=Number(t[e]||0)+Number(a||0)})}async function tt(t){await ln(t);let i=await d(t,`select * from public.game_seasons
      where status in ('scheduled','active')
        and starts_at <= now() and ends_at > now()
      order by case status when 'active' then 0 else 1 end, starts_at desc
      limit 1`);if(i)return i.status==="scheduled"?d(t,`update public.game_seasons set status = 'active', updated_at = now()
          where id = $1 returning *`,[i.id]):i;let e=await d(t,`select ranking_period_days, default_prizes
       from public.game_settings where singleton = true`);if(!e)throw new _(500,"Game settings are missing","game_settings_missing");let n=Math.max(1,Number(e.ranking_period_days||7))*864e5,s=Date.UTC(1970,0,5),o=new Date(s+Math.floor((Date.now()-s)/n)*n),r=new Date(o.getTime()+n);return await t.query(`insert into public.game_seasons(name, starts_at, ends_at, status, rewards)
     values ($1,$2,$3,'active',$4::jsonb)
     on conflict do nothing`,[`BALI Match-3 \xB7 ${o.toISOString().slice(0,10)}`,o.toISOString(),r.toISOString(),JSON.stringify(Array.isArray(e.default_prizes)?e.default_prizes:[])]),d(t,`select * from public.game_seasons
      where status = 'active' and starts_at <= now() and ends_at > now()
      order by starts_at desc limit 1`)}async function Ls(t,i,e){let a=new Date,n=new Date(a);n.setUTCHours(0,0,0,0);let s=n.getUTCDay();n.setUTCDate(n.getUTCDate()-(s+6)%7);let o=new Date(Math.max(new Date(i.starts_at).getTime(),n.getTime())),r=new Date(Math.min(new Date(i.ends_at).getTime(),o.getTime()+7*864e5)),c=await d(t,"select clan_rules from public.game_settings where singleton = true"),u=await d(t,`insert into public.game_clan_rounds(
       season_id, clan_type, starts_at, ends_at, status, rules_snapshot
     ) values ($1,$2,$3,$4,'active',$5::jsonb)
     on conflict (season_id, clan_type, starts_at) do update
       set status = case
         when public.game_clan_rounds.status = 'scheduled' then 'active'
         else public.game_clan_rounds.status end,
           updated_at = now()
     returning *`,[i.id,e,o.toISOString(),r.toISOString(),JSON.stringify(c?.clan_rules||{})]);return u?.frozen_at||(await t.query(`insert into public.game_clan_round_roster(round_id, clan_id, user_key)
       select $1, membership.clan_id, membership.user_key
         from public.clan_memberships membership
         join public.clans clan on clan.id = membership.clan_id
        where membership.status = 'active' and membership.clan_type = $2
          and clan.status = 'active'
       on conflict (round_id, clan_id, user_key) do nothing`,[u.id,e]),await t.query(`update public.game_clan_rounds set frozen_at = now(), updated_at = now()
        where id = $1 and frozen_at is null`,[u.id])),await t.query(`insert into public.game_clan_tasks(
       round_id, clan_id, title, metric, target_value, minimum_personal_contribution
     )
     select $1, roster.clan_id, '\u041A\u043E\u043C\u0430\u043D\u0434\u043D\u044B\u0439 \u043C\u0430\u0440\u0430\u0444\u043E\u043D \u0443\u0440\u043E\u0432\u043D\u0435\u0439', 'levels',
            greatest(1, count(*) * 5), $2
       from public.game_clan_round_roster roster
      where roster.round_id = $1
      group by roster.clan_id
     on conflict (round_id, clan_id, metric) do nothing`,[u.id,Math.max(1,Number(c?.clan_rules?.minimumLevelsForChest||3))]),u}function ia(t){let i=Us();return i.use(H),i.get("/",p(async(e,a)=>{let[n,s,o]=await Promise.all([d(t,"select * from public.game_settings where singleton = true"),d(t,"select * from public.game_profiles where user_key = $1",[e.userPrincipal.userKey]),tt(t)]),r=s;if(n&&r){let c=Math.max(1,Number(n.lives_rules?.maximum||n.base_lives||5)),u=Math.max(1,Number(n.lives_rules?.restoreMinutes||30)),l=r.last_life_at?Date.now()-new Date(r.last_life_at).getTime():0,m=Math.floor(l/(u*6e4));m>0&&Number(r.lives||0)<c&&(r=await d(t,`update public.game_profiles
              set lives = least($2, lives + $3),
                  last_life_at = case
                    when lives + $3 >= $2 then now()
                    else last_life_at + ($4 * $3) * interval '1 minute'
                  end,
                  updated_at = now()
            where user_key = $1 returning *`,[e.userPrincipal.userKey,c,m,u]))}a.json({settings:n,profile:r,season:o})})),i.get("/leaderboard",p(async(e,a)=>{let n=e.query.seasonId?P(e.query.seasonId,"seasonId"):null,s=n?await d(t,"select * from public.game_seasons where id = $1",[n]):await tt(t),o=await w(t,`select ranked.position, ranked.user_key, ranked.score, ranked.level,
              ranked.three_stars, ranked.clean_levels, ranked.attempts,
              user_row.name, user_row.avatar, user_row.username
         from (
           select best.user_key, best.score, best.level, best.three_stars,
                  best.clean_levels, best.attempts,
                  row_number() over (
                    order by best.score desc, best.level desc, best.three_stars desc, best.updated_at asc, best.user_key
                  )::integer as position
             from (
               select result.user_key, sum(result.best_rating)::bigint as score,
                      max(result.level_number)::integer as level,
                      count(*) filter (where result.best_stars = 3)::integer as three_stars,
                      count(*) filter (where result.clean_completed)::integer as clean_levels,
                      sum(result.attempts)::integer as attempts,
                      min(result.updated_at) as updated_at
                 from public.game_level_results result
                where result.season_id = $1
                group by result.user_key
             ) best
         ) ranked
         join public.app_users user_row on user_row.user_key = ranked.user_key
        order by ranked.position
        limit 100`,[s?.id||null]),r=o.find(c=>c.user_key===e.userPrincipal.userKey)||null;a.json({season:s,leaderboard:o,me:r})})),i.post("/sessions",p(async(e,a)=>{await O(t,e,"game.session",M(e));let n=Ne(e),s=e.userPrincipal.userKey,o=await d(t,"select * from public.game_sessions where idempotency_key = $1 and user_key = $2",[n,s]);if(o)return a.json({session:o,replayed:!0});let r;try{r=await S(t,async c=>{let u=await d(c,`select * from public.game_sessions
          where user_key = $1 and status = 'active' for update`,[s]);if(u)throw new _(409,"Finish or abandon the active game first","active_game_exists",{gameSessionId:u.id});let l=await d(c,"select * from public.game_profiles where user_key = $1 for update",[s]);if(!l||Number(l.lives)<1)throw new _(409,"No game lives are available","game_lives_empty");let[m,y]=await Promise.all([tt(c),d(c,"select * from public.game_settings where singleton = true")]);if(!y)throw new _(500,"Game settings are missing","game_settings_missing");let b=String(l.current_season_id||"")!==String(m?.id||""),v=b?1:Math.max(1,Number(l.season_level||1));b&&await c.query(`update public.game_profiles
              set current_season_id = $2, season_level = 1, season_rating = 0, updated_at = now()
            where user_key = $1`,[s,m?.id||null]);let h=Wn(v,y,String(m?.id||"weekly")),j=Bs(y).slice(0,h.tileTypes);if(j.length<5)throw new _(409,"At least five active game symbols are required","game_symbols_missing");let N=et(h,j.map(x=>x.key)),I=je({generated:h,symbols:j});return d(c,`insert into public.game_sessions(
           user_key, season_id, user_session_id, status, device_hash,
           idempotency_key, level_number, season_level_number, level_config,
           level_seed, config_signature, board_state, moves_remaining,
           goal_progress, score_breakdown, lives_used
         ) values ($1,$2,$3,'active',$4,$5,$6,$6,$7::jsonb,$8,$9,$10::jsonb,$11,$12::jsonb,$13::jsonb,0)
         returning *`,[s,m?.id||null,e.userPrincipal.sessionId,String(e.body?.deviceHash||"").slice(0,160),n,v,JSON.stringify({...h,symbols:j}),h.seed,I,JSON.stringify(N),h.moves,JSON.stringify(Ue()),JSON.stringify({combinations:0,cascades:0,specials:0,obstacles:0,goals:0,remainingMoves:0,clean:0})])})}catch(c){if(c?.code==="23505"){let u=await d(t,`select * from public.game_sessions
            where idempotency_key = $1 and user_key = $2`,[n,s]);if(u)return a.json({session:u,replayed:!0});let l=await d(t,`select id from public.game_sessions
            where user_key = $1 and status = 'active'`,[s]);if(l)throw new _(409,"Finish or abandon the active game first","active_game_exists",{gameSessionId:l.id})}throw c}a.status(201).json({session:r,replayed:!1})})),i.post("/sessions/:sessionId/moves",p(async(e,a)=>{await O(t,e,"game.move",M(e));let n=P(e.params.sessionId,"sessionId"),s=Ne(e),o=k(e.body?.first,0,0,99),r=k(e.body?.second,0,0,99),c=k(e.body?.sequence,0,1,1e5),u=await S(t,async l=>{let m=await d(l,"select * from public.game_moves where idempotency_key = $1 and user_key = $2",[s,e.userPrincipal.userKey]);if(m){let W=await d(l,"select * from public.game_sessions where id = $1",[n]);return{move:m,session:W,replayed:!0}}let y=await d(l,`select * from public.game_sessions
          where id = $1 and user_key = $2 and status = 'active'
          for update`,[n,e.userPrincipal.userKey]);if(!y)throw new _(404,"Active game session was not found","not_found");if(c!==Number(y.move_sequence||0)+1)throw new _(409,"Move sequence is out of order","game_move_sequence_mismatch",{expectedSequence:Number(y.move_sequence||0)+1});if(Number(y.moves_remaining||0)<1)throw new _(409,"No moves remain","game_moves_empty");let b=y.level_config||{},h=(Array.isArray(b.symbols)?b.symbols:[]).map(W=>String(W.key)),j=Array.isArray(y.board_state)?y.board_state:[],N=je(j);if(e.body?.boardHash&&String(e.body.boardHash)!==N)throw new _(409,"Client board is stale","game_board_mismatch",{expectedBoardHash:N});let I=ea(j,o,r,b,h,c);if(!I.valid)throw new _(400,"Move does not create a valid combination","game_move_invalid",{reason:I.reason});let x={...Ue(),...y.goal_progress||{}};x.score=Number(x.score||0)+I.scoreDelta,x.collected={...x.collected||{}},x.specialsCreated={...x.specialsCreated||{}},x.specialsActivated={...x.specialsActivated||{}},Be(x.collected,I.progressDelta.collected),Be(x.specialsCreated,I.progressDelta.specialsCreated),Be(x.specialsActivated,I.progressDelta.specialsActivated),x.obstaclesDestroyed=Number(x.obstaclesDestroyed||0)+Number(I.progressDelta.obstaclesDestroyed||0);let R={...y.score_breakdown||{}};Be(R,I.breakdown);let J=je(I.board),U=await d(l,`update public.game_sessions
            set board_state = $2::jsonb, move_sequence = $3,
                moves_remaining = moves_remaining - 1,
                level_score = level_score + $4,
                final_score = level_score + $4,
                goal_progress = $5::jsonb, score_breakdown = $6::jsonb,
                best_combo = greatest(best_combo, $7), updated_at = now()
          where id = $1 returning *`,[n,JSON.stringify(I.board),c,I.scoreDelta,JSON.stringify(x),JSON.stringify(R),I.cascades]);return{move:await d(l,`insert into public.game_moves(
           game_session_id, user_key, sequence, first_index, second_index,
           board_before_hash, board_after_hash, score_delta, move_result, idempotency_key
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)
         returning *`,[n,e.userPrincipal.userKey,c,o,r,N,J,I.scoreDelta,JSON.stringify(I),s]),session:U,replayed:!1}});a.status(u.replayed?200:201).json(u)})),i.post("/sessions/:sessionId/boosters",p(async(e,a)=>{await O(t,e,"game.booster",M(e));let n=P(e.params.sessionId,"sessionId"),s=Ne(e),o=String(e.body?.type||"");if(!["shuffle","hint","bomb","remove","removeType"].includes(o))throw new _(400,"Unsupported game booster","validation_error");let r=e.body?.index===void 0||e.body?.index===null?null:k(e.body.index,0,0,99),c=await S(t,async u=>{let l=await d(u,`select * from public.game_booster_uses
          where idempotency_key = $1 and user_key = $2`,[s,e.userPrincipal.userKey]);if(l){let de=await d(u,"select * from public.game_sessions where id = $1",[n]);return{use:l,session:de,result:l.result,replayed:!0}}let[m,y,b]=await Promise.all([d(u,`select * from public.game_sessions
            where id = $1 and user_key = $2 and status = 'active' for update`,[n,e.userPrincipal.userKey]),d(u,"select * from public.game_profiles where user_key = $1 for update",[e.userPrincipal.userKey]),d(u,"select * from public.game_settings where singleton = true")]);if(!m||!y||!b)throw new _(404,"Active game session was not found","not_found");let v=m.level_config||{},j=(Array.isArray(v.symbols)?v.symbols:[]).map(de=>String(de.key)),N=Array.isArray(m.board_state)?m.board_state:[],I=await d(u,`select count(*)::integer as count from public.game_booster_uses
          where game_session_id = $1`,[n]),x=ta(N,o,r,v,j,Number(I?.count||0)+1);if(!x.valid)throw new _(409,"Game booster cannot be applied","game_booster_invalid",{reason:x.reason});let R={...y.booster_inventory||{}},J=Number(R[o]||0)>0,U=0;if(J)R[o]=Number(R[o]||0)-1,await u.query(`update public.game_profiles
              set booster_inventory = $2::jsonb, updated_at = now()
            where user_key = $1`,[e.userPrincipal.userKey,JSON.stringify(R)]);else if(U=Number(b.economy_rules?.boosterCosts?.[o]||0),!await d(u,`update public.game_profiles
              set bally_balance = bally_balance - $2, updated_at = now()
            where user_key = $1 and bally_balance >= $2
            returning bally_balance`,[e.userPrincipal.userKey,U]))throw new _(409,"Not enough Bally","insufficient_bally");let C={...Ue(),...m.goal_progress||{}};C.score=Number(C.score||0)+x.scoreDelta,C.collected={...C.collected||{}},Be(C.collected,x.progressDelta.collected),C.obstaclesDestroyed=Number(C.obstaclesDestroyed||0)+Number(x.progressDelta.obstaclesDestroyed||0);let W={...m.score_breakdown||{}};W.specials=Number(W.specials||0)+x.scoreDelta;let oe=await d(u,`update public.game_sessions
            set board_state = $2::jsonb, level_score = level_score + $3,
                final_score = level_score + $3, goal_progress = $4::jsonb,
                score_breakdown = $5::jsonb, updated_at = now()
          where id = $1 returning *`,[n,JSON.stringify(x.board),x.scoreDelta,JSON.stringify(C),JSON.stringify(W)]);return{use:await d(u,`insert into public.game_booster_uses(
           game_session_id, user_key, booster_type, target_index,
           inventory_used, points_cost, bally_cost, point_transaction_id, result, idempotency_key
         ) values ($1,$2,$3,$4,$5,0,$6,null,$7::jsonb,$8)
         returning *`,[n,e.userPrincipal.userKey,o,r,J,U,JSON.stringify(x),s]),session:oe,result:x,replayed:!1}});a.status(c.replayed?200:201).json(c)})),i.post("/sessions/:sessionId/finish",p(async(e,a)=>{let n=P(e.params.sessionId,"sessionId"),s=Ne(e),o=await S(t,async r=>{let c=await d(r,`select * from public.idempotency_records
          where scope = 'game.finish' and idempotency_key = $1`,[s]);if(c?.response_body)return{session:c.response_body,replayed:!0};let u=await d(r,`select * from public.game_sessions
          where id = $1 and user_key = $2 for update`,[n,e.userPrincipal.userKey]);if(!u)throw new _(404,"Game session was not found","not_found");let l=await d(r,`select * from public.idempotency_records
          where scope = 'game.finish' and idempotency_key = $1`,[s]);if(l?.response_body)return{session:l.response_body,replayed:!0};if(u.status!=="active")throw new _(409,"Game session has already ended","game_already_ended");let m=await d(r,"select * from public.game_settings where singleton = true");if(!m)throw new _(500,"Game settings are missing","game_settings_missing");let y=Math.max(1,Math.floor((Date.now()-new Date(u.started_at).getTime())/1e3)),b=u.level_config||{},v=Array.isArray(b.symbols)?b.symbols:[],h=v.map(V=>String(V.key)),j=je({generated:{...b,symbols:void 0},symbols:v})===String(u.config_signature),N=[];j||N.push("config_signature_mismatch"),Number(u.move_sequence||0)>Number(b.moves||0)+Number(u.continues_used||0)*Number(m.economy_rules?.continueMoves||5)&&N.push("move_limit_exceeded");let I=N.length>0,x={...Ue(),...u.goal_progress||{}},R=!I&&na(b,x,h),J=b.scoring||{},U={...u.score_breakdown||{}},C=Number(u.level_score||0);R&&(U.goals=b.goals.length*Number(J.goalComplete||1e3)+Math.round(Number(J.allGoalsBase||2500)*Number(b.difficulty||1)),U.remainingMoves=Math.round(Number(u.moves_remaining||0)*Number(J.remainingMove||200)*Number(b.difficulty||1)),C+=Number(U.goals||0)+Number(U.remainingMoves||0),Number(u.continues_used||0)===0&&(U.clean=Math.round(C*Number(J.cleanMultiplier||.1)),C+=Number(U.clean||0)));let W=aa(C,Number(b.targetScore||0),R,J),oe=R?sa(Number(u.level_number),W,Number(u.continues_used||0),b.rating||{}):0,se=R?await d(r,`select * from public.game_level_results
            where season_id = $1 and user_key = $2 and level_number = $3
            for update`,[u.season_id,e.userPrincipal.userKey,u.level_number]):null,de=Math.max(0,oe-Number(se?.best_rating||0)),we=m.economy_rules||{},Le=Array.isArray(we.starRewards)?we.starRewards:[0,5,10,20],fe=0;R&&(se||(fe+=Number(we.firstCompletion||20)),fe+=Math.max(0,Number(Le[W]||0)-Number(Le[se?.best_stars||0]||0)),Number(u.continues_used||0)===0&&!se?.clean_completed&&(fe+=Number(we.cleanCompletion||10)));let xe=await d(r,`update public.game_sessions
            set status = 'completed', ended_at = now(), duration_seconds = $2,
                final_score = $3, level_score = $3, suspicious = $4,
                suspicious_reasons = $5::jsonb, completion_status = $6,
                stars = $7, seasonal_points = $8, bally_awarded = $9,
                score_breakdown = $10::jsonb, lives_used = $11,
                client_finish_payload = $12::jsonb, updated_at = now()
          where id = $1
          returning *`,[n,y,C,I,JSON.stringify(N),R?"success":"failed",W,de,fe,JSON.stringify(U),R?0:1,JSON.stringify(e.body||{})]);return R?(await r.query(`insert into public.game_level_results(
             season_id, user_key, level_number, best_session_id, best_score,
             best_stars, best_rating, clean_completed, attempts, first_completed_at
           ) values ($1,$2,$3,$4,$5,$6,$7,$8,1,now())
           on conflict (season_id, user_key, level_number) do update
             set best_session_id = case
                   when excluded.best_rating > game_level_results.best_rating then excluded.best_session_id
                   else game_level_results.best_session_id end,
                 best_score = greatest(game_level_results.best_score, excluded.best_score),
                 best_stars = greatest(game_level_results.best_stars, excluded.best_stars),
                 best_rating = greatest(game_level_results.best_rating, excluded.best_rating),
                 clean_completed = game_level_results.clean_completed or excluded.clean_completed,
                 attempts = game_level_results.attempts + 1, updated_at = now()`,[u.season_id,e.userPrincipal.userKey,u.level_number,n,C,W,oe,Number(u.continues_used||0)===0]),await r.query(`update public.game_profiles
              set account_level = greatest(account_level, $2 + 1),
                  season_level = greatest(season_level, $2 + 1),
                  season_rating = season_rating + $3,
                  bally_balance = bally_balance + $4,
                  lifetime_levels_completed = lifetime_levels_completed + case when $5 then 1 else 0 end,
                  three_star_levels = three_star_levels + case when $6 then 1 else 0 end,
                  clean_levels = clean_levels + case when $7 then 1 else 0 end,
                  best_score = greatest(best_score, $8), xp = xp + floor($8 / 100),
                  updated_at = now()
            where user_key = $1`,[e.userPrincipal.userKey,Number(u.level_number),de,fe,!se,W===3&&Number(se?.best_stars||0)<3,Number(u.continues_used||0)===0&&!se?.clean_completed,C])):await r.query(`update public.game_profiles
              set lives = greatest(0, lives - 1), last_life_at = now(),
                  suspicious_score_count = suspicious_score_count + case when $2 then 1 else 0 end,
                  updated_at = now()
            where user_key = $1`,[e.userPrincipal.userKey,I]),await r.query(`insert into public.idempotency_records(
           scope, idempotency_key, actor_key, response_code, response_body, completed_at
         ) values ('game.finish',$1,$2,200,$3::jsonb,now())`,[s,e.userPrincipal.userKey,JSON.stringify(xe)]),{session:xe,replayed:!1,result:{success:R,levelScore:C,stars:W,seasonalResult:oe,seasonalPoints:de,ballyAwarded:fe,breakdown:U}}});a.json(o)})),i.post("/sessions/:sessionId/continue",p(async(e,a)=>{let n=P(e.params.sessionId,"sessionId"),s=Ne(e),o=await d(t,`select * from public.game_continues
        where idempotency_key = $1 and user_key = $2`,[s,e.userPrincipal.userKey]);if(o)return a.json({continue:o,replayed:!0});let r=await S(t,async c=>{let u=await d(c,`select * from public.game_sessions
          where id = $1 and user_key = $2 and status = 'active'
          for update`,[n,e.userPrincipal.userKey]);if(!u)throw new _(404,"Active game session was not found","not_found");if(Number(u.continues_used||0)>=2)throw new _(409,"The maximum of two continues has been reached","game_continue_limit");let l=await d(c,"select continue_points_cost, economy_rules from public.game_settings where singleton = true"),m=l?.economy_rules||{},y=Array.isArray(m.continueCosts)?m.continueCosts:[l?.continue_points_cost||0,Number(l?.continue_points_cost||0)*2],b=Number(y[Number(u.continues_used||0)]||0),v=Math.max(1,Number(m.continueMoves||5));if(b<=0)throw new _(409,"Paid game continues are disabled","game_continue_disabled");if(!await d(c,`update public.game_profiles
            set bally_balance = bally_balance - $2, updated_at = now()
          where user_key = $1 and bally_balance >= $2
          returning bally_balance`,[e.userPrincipal.userKey,b]))throw new _(409,"Not enough Bally","insufficient_bally");let j=await d(c,`insert into public.game_continues(
           game_session_id, user_key, points_cost, bally_cost, point_transaction_id, idempotency_key
         ) values ($1,$2,0,$3,null,$4)
         returning *`,[n,e.userPrincipal.userKey,b,s]);return await c.query(`update public.game_sessions
            set continues_used = continues_used + 1,
                moves_remaining = moves_remaining + $2, updated_at = now()
          where id = $1`,[n,v]),{...j,extra_moves:v}});a.status(201).json({continue:r,replayed:!1})})),i.post("/sessions/:sessionId/abandon",p(async(e,a)=>{let n=P(e.params.sessionId,"sessionId"),s=await S(t,async o=>{let r=await d(o,`update public.game_sessions
            set status = 'abandoned', completion_status = 'abandoned', ended_at = now(),
                duration_seconds = greatest(0, extract(epoch from now() - started_at)::integer),
                lives_used = 1, updated_at = now()
          where id = $1 and user_key = $2 and status = 'active'
          returning *`,[n,e.userPrincipal.userKey]);return r&&await o.query(`update public.game_profiles
              set lives = greatest(0, lives - 1), last_life_at = now(), updated_at = now()
            where user_key = $1`,[e.userPrincipal.userKey]),r});if(!s)throw new _(404,"Active game session was not found","not_found");a.json({session:s})})),i.post("/lives/restore",p(async(e,a)=>{let n=Ne(e),s=!!e.body?.full,o=await S(t,async r=>{let c=await d(r,`select * from public.idempotency_records
          where scope = 'game.lives.restore' and idempotency_key = $1`,[n]);if(c?.response_body)return{...c.response_body,replayed:!0};let[u,l]=await Promise.all([d(r,"select * from public.game_profiles where user_key = $1 for update",[e.userPrincipal.userKey]),d(r,"select * from public.game_settings where singleton = true")]);if(!u||!l)throw new _(404,"Game profile was not found","not_found");let m=Math.max(1,Number(l.lives_rules?.maximum||l.base_lives||5));if(Number(u.lives||0)>=m)return{profile:u,replayed:!1,unchanged:!0};let y=Number(s?l.economy_rules?.fullLivesCost||180:l.economy_rules?.lifeCost||50),b=await d(r,`update public.game_profiles
            set bally_balance = bally_balance - $4,
                lives = case when $2 then $3 else least($3, lives + 1) end,
                last_life_at = now(), updated_at = now()
          where user_key = $1 and bally_balance >= $4
          returning *`,[e.userPrincipal.userKey,s,m,y]);if(!b)throw new _(409,"Not enough Bally","insufficient_bally");let v={profile:b,cost:y,full:s};return await r.query(`insert into public.idempotency_records(
           scope, idempotency_key, actor_key, response_code, response_body, completed_at
         ) values ('game.lives.restore',$1,$2,200,$3::jsonb,now())`,[n,e.userPrincipal.userKey,JSON.stringify(v)]),{...v,replayed:!1}});a.json(o)})),i.get("/clans/leaderboard",p(async(e,a)=>{let n=String(e.query.clanType||"user");if(!["user","corporate"].includes(n))throw new _(400,"Unsupported clan category","validation_error");let[s,o]=await Promise.all([tt(t),d(t,"select clan_rules from public.game_settings where singleton = true")]),r=await Ls(t,s,n),c=Math.max(2,Number(o?.clan_rules?.minimumMembers||5)),u=await w(t,`with member_scores as (
         select roster.clan_id, roster.user_key,
                coalesce(sum(result.best_rating),0)::bigint as rating,
                coalesce(max(result.level_number),0)::integer as level
           from public.game_clan_round_roster roster
           left join public.game_level_results result
             on result.user_key = roster.user_key and result.season_id = $1
            and result.updated_at >= $4 and result.updated_at < $5
          where roster.round_id = $3
          group by roster.clan_id, roster.user_key
       ), clan_scores as (
         select clan.id, clan.name, clan.clan_type,
                count(score.user_key)::integer as members,
                count(score.user_key) filter (where score.rating > 0)::integer as active_members,
                coalesce(sum(score.rating),0)::bigint as total_rating,
                coalesce(avg(score.rating),0)::numeric(18,3) as average_rating,
                coalesce(percentile_cont(0.5) within group (order by score.rating),0)::numeric(18,3) as median_rating
           from public.clans clan
           left join member_scores score on score.clan_id = clan.id
          where clan.clan_type = $2 and clan.status = 'active'
          group by clan.id, clan.name, clan.clan_type
       )
       select score.*,
              (score.members >= $6) as eligible,
              row_number() over (
                order by
                  case when score.members >= $6 then 0 else 1 end,
                  score.average_rating desc, score.median_rating desc,
                  score.active_members desc, score.total_rating desc, score.name
              )::integer as position
         from clan_scores score
        order by position`,[s?.id||null,n,r.id,r.starts_at,r.ends_at,c]);a.json({season:s,round:r,clanType:n,minimumMembers:c,leaderboard:u})})),i.get("/prizes",p(async(e,a)=>{let n=await w(t,`select prize.*, season.name as season_name, season.starts_at, season.ends_at
         from public.game_prizes prize
         join public.game_seasons season on season.id = prize.season_id
        where prize.user_key = $1
        order by season.ends_at desc`,[e.userPrincipal.userKey]);a.json({prizes:n})})),i.get("/seasons/:seasonId",p(async(e,a)=>{let n=P(e.params.seasonId,"seasonId"),s=await d(t,"select * from public.game_seasons where id = $1",[n]);if(!s)throw new _(404,"Game season was not found","not_found");a.json({season:s})})),i.get("/sessions/:sessionId",p(async(e,a)=>{let n=P(e.params.sessionId,"sessionId"),s=await d(t,"select * from public.game_sessions where id = $1 and user_key = $2",[n,e.userPrincipal.userKey]);if(!s)throw new _(404,"Game session was not found","not_found");a.json({session:s})})),i}var ra=D(()=>{"use strict";B();L();yt();oa();z();ye();Z()});import{Router as Hs}from"express";function ca(t){let i=Hs();return i.use(H),i.get("/",p(async(e,a)=>{let n=await w(t,`select * from public.notifications
        where user_key = $1
          and status <> 'cancelled'
          and (expires_at is null or expires_at > now())
        order by created_at desc
        limit 200`,[e.userPrincipal.userKey]),s=n.filter(o=>!o.read_at).length;a.json({notifications:n,unread:s})})),i.patch("/:notificationId/read",p(async(e,a)=>{let n=P(e.params.notificationId,"notificationId"),s=await d(t,`update public.notifications
          set read_at = coalesce(read_at, now()), updated_at = now()
        where id = $1 and user_key = $2
        returning *`,[n,e.userPrincipal.userKey]);if(!s)throw new _(404,"Notification was not found","not_found");a.json({notification:s})})),i.post("/read-all",p(async(e,a)=>{let n=await t.query(`update public.notifications
          set read_at = coalesce(read_at, now()), updated_at = now()
        where user_key = $1 and read_at is null`,[e.userPrincipal.userKey]);a.json({updated:n.rowCount||0})})),i.get("/preferences/me",p(async(e,a)=>{let n=await d(t,"select * from public.notification_preferences where user_key = $1",[e.userPrincipal.userKey]);a.json({preferences:n})})),i.patch("/preferences/me",p(async(e,a)=>{let n=await d(t,"select * from public.notification_preferences where user_key = $1",[e.userPrincipal.userKey]);if(!n)throw new _(404,"Notification preferences were not found","not_found");let s=e.body?.quietHoursStart===void 0?n.quiet_hours_start:E(`1970-01-01T${String(e.body.quietHoursStart)}Z`)?.slice(11,19)||null,o=e.body?.quietHoursEnd===void 0?n.quiet_hours_end:E(`1970-01-01T${String(e.body.quietHoursEnd)}Z`)?.slice(11,19)||null,r=e.body?.disabledTypes===void 0?n.disabled_types||[]:ke(e.body.disabledTypes,"disabledTypes",0,100,100),c=await d(t,`update public.notification_preferences
          set in_app_enabled = $2, telegram_enabled = $3, marketing_enabled = $4,
              quiet_hours_start = $5, quiet_hours_end = $6,
              disabled_types = $7::text[], updated_at = now()
        where user_key = $1 returning *`,[e.userPrincipal.userKey,e.body?.inAppEnabled===void 0?n.in_app_enabled:A(e.body.inAppEnabled),e.body?.telegramEnabled===void 0?n.telegram_enabled:A(e.body.telegramEnabled),e.body?.marketingEnabled===void 0?n.marketing_enabled:A(e.body.marketingEnabled),s,o,r]);a.json({preferences:c})})),i}var ua=D(()=>{"use strict";B();L();z();Z()});import{Router as Qs}from"express";function da(t){let i=Qs();return i.use(H),i.get("/",p(async(e,a)=>{let n=k(e.query.limit,30,1,100),s=String(e.query.search||"").trim(),o=await w(t,`select user_row.user_key
         from public.app_users user_row
         left join public.user_profiles profile on profile.user_key = user_row.user_key
        where user_row.account_status = 'active' and user_row.user_key <> $1
          and coalesce(profile.discoverable, true) = true
          and ($2 = '' or lower(name) like '%' || lower($2) || '%')
          and not exists (
            select 1 from public.user_blocks block
             where (block.blocker_user_key = $1 and block.blocked_user_key = user_row.user_key)
                or (block.blocker_user_key = user_row.user_key and block.blocked_user_key = $1)
          )
        order by user_row.last_seen_at desc limit $3`,[e.userPrincipal.userKey,s,n]),r=await Je(t,e.userPrincipal.userKey,o.map(c=>c.user_key));a.json({people:r})})),i.get("/me",p(async(e,a)=>{let[n,s,o,r,c]=await Promise.all([_t(t,e.userPrincipal.userKey,e.userPrincipal.userKey),d(t,"select * from public.user_profiles where user_key = $1",[e.userPrincipal.userKey]),d(t,"select * from public.user_consents where user_key = $1",[e.userPrincipal.userKey]),w(t,`select clan.id, clan.name, clan.clan_type, clan.logo_url
           from (
             select c.id, c.name, c.clan_type, profile.logo_url
               from public.clan_memberships membership
               join public.clans c on c.id = membership.clan_id
               left join public.clan_profiles profile on profile.clan_id = c.id
              where membership.user_key = $1
                and membership.status = 'active'
                and c.status = 'active'
           ) clan
          order by clan.clan_type`,[e.userPrincipal.userKey]),d(t,`select event.id, event.title, event.event_date, event.event_time,
                attendance.status
           from public.event_attendance attendance
           join public.events event on event.id = attendance.event_id
           left join public.event_runtime runtime on runtime.event_id = event.id
          where attendance.user_key = $1
            and attendance.status in ('going', 'maybe')
            and coalesce(runtime.status, 'published') in ('published', 'active')
            and coalesce(runtime.ends_at, runtime.starts_at, event.event_date::timestamptz) > now()
          order by coalesce(runtime.starts_at, event.event_date::timestamptz)
          limit 1`,[e.userPrincipal.userKey])]);a.json({profile:{...n,details:s,clans:r,upcomingEvent:c},consents:o})})),i.patch("/me",p(async(e,a)=>{let n=await d(t,`select profile.*, user_row.name
         from public.user_profiles profile
         join public.app_users user_row on user_row.user_key = profile.user_key
        where profile.user_key = $1`,[e.userPrincipal.userKey]);if(!n)throw new _(404,"BALI profile was not found","not_found");let s=e.body?.displayName===void 0?n.display_name||n.name:f(e.body.displayName,"displayName",120),o=e.body?.statusText===void 0?n.status_text:g(e.body.statusText,80),r=e.body?.bio===void 0?n.bio:g(e.body.bio,1e3),c=e.body?.interests===void 0?n.interests||[]:ke(e.body.interests,"interests",0,30,80),u=e.body?.gender===void 0?n.gender:K(e.body.gender,"gender",["female","male","unspecified"]),l=e.body?.birthDate===void 0?n.birth_date:E(e.body.birthDate)?.slice(0,10)||null,m=e.body?.avatarUrl===void 0?n.avatar_url:g(e.body.avatarUrl,2e3),y=e.body?.phone===void 0?n.phone:g(e.body.phone,80),b=e.body?.discoverable===void 0?n.discoverable:A(e.body.discoverable),v=e.body?.allowConnections===void 0?n.allow_connections:A(e.body.allowConnections),h=e.body?.allowEventInvites===void 0?n.allow_event_invites:A(e.body.allowEventInvites),j=e.body?.allowGifts===void 0?n.allow_gifts:A(e.body.allowGifts),N=await d(t,`update public.user_profiles
          set display_name = $2,
              status_text = $3,
              bio = $4,
              interests = $5::text[],
              gender = $6,
              birth_date = $7,
              avatar_url = $8,
              phone = $9,
              discoverable = $10,
              allow_connections = $11,
              allow_event_invites = $12,
              allow_gifts = $13,
              updated_at = now()
        where user_key = $1
        returning *`,[e.userPrincipal.userKey,s,o,r,c,u,l,m,y,b,v,h,j]);await t.query(`update public.app_users
          set name = $2,
              birth_date = $3,
              avatar = $4,
              phone = $5,
              updated_at = now()
        where user_key = $1`,[e.userPrincipal.userKey,s,l,m,y]),a.json({profile:N})})),i.put("/me/consents",p(async(e,a)=>{let n=A(e.body?.ageConfirmed),s=f(e.body?.termsVersion,"termsVersion",80),o=f(e.body?.privacyVersion,"privacyVersion",80),r=A(e.body?.marketingOptIn);if(!n)throw new _(400,"The 18+ confirmation is required","age_confirmation_required");let c=await d(t,`insert into public.user_consents(
         user_key, age_confirmed, age_confirmed_at,
         terms_version, terms_accepted_at,
         privacy_version, privacy_accepted_at,
         marketing_opt_in, marketing_updated_at
       ) values ($1,true,now(),$2,now(),$3,now(),$4,now())
       on conflict (user_key) do update
         set age_confirmed = true,
             age_confirmed_at = coalesce(user_consents.age_confirmed_at, now()),
             terms_version = excluded.terms_version,
             terms_accepted_at = now(),
             privacy_version = excluded.privacy_version,
             privacy_accepted_at = now(),
             marketing_opt_in = excluded.marketing_opt_in,
             marketing_updated_at = now(),
             updated_at = now()
       returning *`,[e.userPrincipal.userKey,s,o,r]);await t.query(`insert into public.notification_preferences(user_key, marketing_enabled)
       values ($1,$2)
       on conflict (user_key) do update
         set marketing_enabled = excluded.marketing_enabled,
             updated_at = now()`,[e.userPrincipal.userKey,r]),a.json({consents:c})})),i.patch("/me/privacy",p(async(e,a)=>{let n=await d(t,"select profile_privacy from public.app_users where user_key = $1",[e.userPrincipal.userKey]);if(!n)throw new _(404,"BALI profile was not found","not_found");let s={...n.profile_privacy||{}};for(let o of Ft){if(e.body?.[o]===void 0)continue;let r=String(e.body[o]);if(!lt.has(r))throw new _(400,`Invalid privacy mode for ${o}`,"validation_error");s[o]=r}await t.query("update public.app_users set profile_privacy = $1::jsonb where user_key = $2",[JSON.stringify(s),e.userPrincipal.userKey]),a.json({privacy:s})})),i.get("/me/export",p(async(e,a)=>{let n=e.userPrincipal.userKey,[s,o,r,c,u,l,m,y,b,v,h,j,N,I,x,R]=await Promise.all([d(t,"select * from public.app_users where user_key = $1",[n]),d(t,"select * from public.user_profiles where user_key = $1",[n]),d(t,"select * from public.user_consents where user_key = $1",[n]),w(t,"select * from public.clan_memberships where user_key = $1 order by created_at",[n]),w(t,"select * from public.event_attendance where user_key = $1 order by created_at",[n]),w(t,"select * from public.booking_records where user_key = $1 order by created_at",[n]),w(t,"select * from public.point_ledger where user_key = $1 order by created_at",[n]),w(t,"select * from public.user_rewards where user_key = $1 order by granted_at",[n]),w(t,`select * from public.gifts
          where sender_user_key = $1 or recipient_user_key = $1
          order by created_at`,[n]),w(t,"select * from public.user_vip_subscriptions where user_key = $1 order by created_at",[n]),w(t,"select * from public.shop_orders where user_key = $1 order by created_at",[n]),w(t,"select * from public.game_sessions where user_key = $1 order by started_at",[n]),w(t,`select * from public.user_connections
          where requester_user_key = $1 or recipient_user_key = $1
          order by created_at`,[n]),w(t,"select * from public.direct_messages where sender_user_key = $1 order by created_at",[n]),w(t,`select * from public.user_reports
          where reporter_user_key = $1 or reported_user_key = $1
          order by created_at`,[n]),w(t,"select * from public.notifications where user_key = $1 order by created_at",[n])]);a.setHeader("Content-Disposition",`attachment; filename="bali-data-${encodeURIComponent(n)}.json"`),a.json({exportedAt:new Date().toISOString(),account:s,profile:o,consents:r,clans:c,attendance:u,bookings:l,pointLedger:m,rewards:y,gifts:b,vip:v,orders:h,gameSessions:j,connections:N,sentMessages:I,reports:x,notifications:R})})),i.delete("/me",p(async(e,a)=>{if(f(e.body?.confirmation,"confirmation",20)!=="DELETE")throw new _(400,"Type DELETE to confirm account deletion","deletion_confirmation_required");let s=g(e.body?.reason,1e3),o=e.userPrincipal.userKey,r=await S(t,async c=>{let u=await d(c,`select user_key, telegram_id, name, username, phone, account_status
           from public.app_users where user_key = $1 for update`,[o]);if(!u)throw new _(404,"BALI account was not found","not_found");if(u.account_status==="deleted")throw new _(409,"BALI account has already been deleted","account_already_deleted");let l=await d(c,`select id, name from public.clans
          where leader_user_key = $1 and status = 'active'
          limit 1`,[o]);if(l)throw new _(409,"Transfer clan leadership before deleting the account","clan_leadership_transfer_required",{clanId:l.id,clanName:l.name});let m=await d(c,`insert into public.account_deletion_requests(
           user_key, reason, status, processed_at, metadata
         ) values ($1,$2,'completed',now(),$3::jsonb)
         returning *`,[o,s,JSON.stringify({previousTelegramId:u.telegram_id,previousName:u.name,previousUsername:u.username})]);return await c.query(`update public.app_users
            set telegram_id = null,
                name = '\u0423\u0434\u0430\u043B\u0451\u043D\u043D\u044B\u0439 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C',
                username = '',
                phone = '',
                avatar = '',
                birth_date = null,
                account_status = 'deleted',
                blocked_at = now(),
                profile_privacy = '{"avatar":"private","username":"private","phone":"private","birth_date":"private","status":"private","events":"private","clan":"private"}'::jsonb,
                updated_at = now()
          where user_key = $1`,[o]),await c.query(`update public.user_profiles
            set display_name = '\u0423\u0434\u0430\u043B\u0451\u043D\u043D\u044B\u0439 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C',
                status_text = '',
                bio = '',
                interests = '{}',
                birth_date = null,
                gender = 'unspecified',
                avatar_url = '',
                phone = '',
                discoverable = false,
                allow_connections = false,
                allow_event_invites = false,
                allow_gifts = false,
                updated_at = now()
          where user_key = $1`,[o]),await c.query(`update public.user_consents
            set marketing_opt_in = false, marketing_updated_at = now(), updated_at = now()
          where user_key = $1`,[o]),await c.query(`update public.notification_preferences
            set in_app_enabled = false, telegram_enabled = false,
                marketing_enabled = false, updated_at = now()
          where user_key = $1`,[o]),await c.query(`update public.crm_customers
            set phone = '', first_name = '\u0423\u0434\u0430\u043B\u0451\u043D\u043D\u044B\u0439 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C',
                last_name = '', birth_date = null, marketing_opt_in = false,
                updated_at = now()
          where user_key = $1`,[o]),await c.query(`update public.clan_memberships
            set status = 'left', ended_at = coalesce(ended_at, now()), updated_at = now()
          where user_key = $1 and status = 'active'`,[o]),await c.query(`update public.user_connections
            set status = 'removed', updated_at = now()
          where requester_user_key = $1 or recipient_user_key = $1`,[o]),await c.query(`update public.direct_conversations
            set archived_at = coalesce(archived_at, now()), updated_at = now()
          where pair_low = $1 or pair_high = $1`,[o]),await c.query(`update public.direct_messages
            set sender_user_key = null, updated_at = now()
          where sender_user_key = $1`,[o]),await c.query(`update public.event_attendance
            set status = 'cancelled', updated_at = now()
          where user_key = $1 and status in ('going','maybe')`,[o]),await c.query(`update public.booking_holds
            set status = 'released', released_at = now(), updated_at = now()
          where user_key = $1 and status = 'active'`,[o]),await c.query(`update public.booking_records
            set customer_name = '\u0423\u0434\u0430\u043B\u0451\u043D\u043D\u044B\u0439 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C',
                phone = '', comment = '', updated_at = now()
          where user_key = $1`,[o]),await c.query(`update public.gifts
            set message = '', updated_at = now()
          where sender_user_key = $1 or recipient_user_key = $1`,[o]),await c.query("delete from public.notifications where user_key = $1",[o]),await c.query("delete from public.telegram_accounts where app_user_key = $1",[o]),await c.query(`update public.user_sessions set revoked_at = now()
          where app_user_key = $1 and revoked_at is null`,[o]),m});a.clearCookie(he,{path:"/"}),a.json({deletion:r})})),i.get("/:userKey",p(async(e,a)=>{let n=$(e.params.userKey,"userKey");a.json({profile:await _t(t,e.userPrincipal.userKey,n)})})),i}var la=D(()=>{"use strict";B();L();z();pt();Z()});import{Router as Js}from"express";function _a(t){let i=Js();return i.use(H),i.get("/",p(async(e,a)=>{let[n,s,o]=await Promise.all([w(t,`select scope, block_key, name, title, subtitle, asset_key,
                configuration, recommended_width, recommended_height, sort_order
           from public.ui_content_blocks
          where active = true
          order by scope, sort_order, block_key`),w(t,`select app_type, item_key, label, route, icon_url,
                recommended_width, recommended_height, sort_order
           from public.ui_navigation_items
          where active = true
          order by app_type, sort_order, item_key`),w(t,`select asset_key, name, url, media_type, width, height,
                recommended_width, recommended_height, alt_text
           from public.admin_assets`)]);a.json({blocks:n,navigation:s,assets:o})})),i}var pa=D(()=>{"use strict";B();L();z()});import{Router as zs}from"express";function ma(t,i){return t<i?[t,i]:[i,t]}async function $t(t,i,e){return!!await d(t,`select 1
       from public.user_blocks
      where (blocker_user_key = $1 and blocked_user_key = $2)
         or (blocker_user_key = $2 and blocked_user_key = $1)
      limit 1`,[i,e])}async function ht(t,i,e){let a=await d(t,`select conversation.*, connection.status as connection_status
       from public.direct_conversations conversation
       join public.user_connections connection on connection.id = conversation.connection_id
      where conversation.id = $1
        and $2 in (conversation.pair_low, conversation.pair_high)`,[i,e]);if(!a)throw new _(404,"Conversation was not found","not_found");if(a.connection_status!=="accepted"||a.archived_at)throw new _(403,"Conversation is not active","conversation_unavailable");let n=a.pair_low===e?a.pair_high:a.pair_low;if(await $t(t,e,n))throw new _(403,"Conversation is unavailable because one user blocked the other","user_blocked");return{...a,peerKey:n}}async function vt(t,i,e,a,n,s,o){await t.query(`insert into public.notifications(
       user_key, notification_type, title, body, data, idempotency_key
     ) values ($1,$2,$3,$4,$5::jsonb,$6)
     on conflict (idempotency_key) do nothing`,[i,e,a,n,JSON.stringify(s),o])}function ya(t){let i=zs();return i.use(H),i.get("/connections",p(async(e,a)=>{let n=await w(t,`select connection.*,
              case when connection.requester_user_key = $1
                then recipient.name else requester.name end as peer_name,
              case when connection.requester_user_key = $1
                then recipient.avatar else requester.avatar end as peer_avatar,
              case when connection.requester_user_key = $1
                then connection.recipient_user_key else connection.requester_user_key end as peer_user_key,
              conversation.id as conversation_id
         from public.user_connections connection
         join public.app_users requester on requester.user_key = connection.requester_user_key
         join public.app_users recipient on recipient.user_key = connection.recipient_user_key
         left join public.direct_conversations conversation
           on conversation.connection_id = connection.id
        where $1 in (connection.requester_user_key, connection.recipient_user_key)
          and connection.status in ('pending', 'accepted')
        order by case when connection.status = 'pending' then 0 else 1 end,
                 connection.updated_at desc`,[e.userPrincipal.userKey]);a.json({connections:n})})),i.post("/connections",p(async(e,a)=>{await O(t,e,"connection.create",M(e));let n=$(e.body?.recipientUserKey,"recipientUserKey"),s=g(e.body?.message,500),o=e.userPrincipal.userKey;if(n===o)throw new _(400,"A user cannot send a connection request to themselves","validation_error");if(await $t(t,o,n))throw new _(403,"Connection request is unavailable because one user blocked the other","user_blocked");let r=await d(t,`select user_row.user_key, user_row.name,
              coalesce(profile.allow_connections, true) as allow_connections
         from public.app_users user_row
         left join public.user_profiles profile on profile.user_key = user_row.user_key
        where user_row.user_key = $1
          and user_row.account_status = 'active'
          and user_row.blocked_at is null`,[n]);if(!r)throw new _(404,"Recipient was not found","not_found");if(!r.allow_connections)throw new _(403,"Recipient disabled connection requests","connections_disabled");let c=await d(t,`select count(*)::integer as count
         from public.user_connections
        where requester_user_key = $1
          and created_at > now() - interval '24 hours'`,[o]);if(Number(c?.count||0)>=10)throw new _(429,"Daily connection request limit has been reached","connection_daily_limit",{retryAfter:3600});let[u,l]=ma(o,n),m=await S(t,async y=>{let b=await d(y,`select * from public.user_connections
          where pair_low = $1 and pair_high = $2
          for update`,[u,l]);if(b){if(b.status==="accepted")throw new _(409,"Users are already connected","connection_already_exists");if(b.status==="pending")throw new _(409,"A connection request is already pending","connection_already_pending");if(b.cooldown_until&&new Date(b.cooldown_until).getTime()>Date.now())throw new _(409,"A new request is temporarily unavailable after rejection","connection_cooldown",{cooldownUntil:b.cooldown_until});return await d(y,`update public.user_connections
              set requester_user_key = $2,
                  recipient_user_key = $3,
                  status = 'pending',
                  request_message = $4,
                  cooldown_until = null,
                  responded_at = null,
                  created_at = now(),
                  updated_at = now()
            where id = $1
            returning *`,[b.id,o,n,s])}return d(y,`insert into public.user_connections(
           requester_user_key, recipient_user_key, pair_low, pair_high, request_message
         ) values ($1,$2,$3,$4,$5)
         returning *`,[o,n,u,l,s])});await vt(t,n,"connection_request","\u041D\u043E\u0432\u0430\u044F \u0437\u0430\u044F\u0432\u043A\u0430 \u043D\u0430 \u0437\u043D\u0430\u043A\u043E\u043C\u0441\u0442\u0432\u043E",`${e.userPrincipal.name} \u0445\u043E\u0447\u0435\u0442 \u043F\u043E\u0437\u043D\u0430\u043A\u043E\u043C\u0438\u0442\u044C\u0441\u044F.`,{connectionId:m.id,requesterUserKey:o},`connection-request:${m.id}:${m.created_at}`),a.status(201).json({connection:m})})),i.patch("/connections/:connectionId",p(async(e,a)=>{let n=P(e.params.connectionId,"connectionId"),s=K(e.body?.status,"status",Vs),o=await S(t,async r=>{let c=await d(r,`select * from public.user_connections
          where id = $1 and recipient_user_key = $2
          for update`,[n,e.userPrincipal.userKey]);if(!c)throw new _(404,"Connection request was not found","not_found");if(c.status!=="pending")throw new _(409,"Connection request has already been answered","connection_already_answered");if(await $t(r,c.requester_user_key,c.recipient_user_key))throw new _(403,"Connection is unavailable because one user blocked the other","user_blocked");let u=await d(r,`update public.user_connections
            set status = $2,
                responded_at = now(),
                cooldown_until = case when $2 = 'declined' then now() + interval '30 days' else null end,
                updated_at = now()
          where id = $1
          returning *`,[n,s]),l=null;return s==="accepted"&&(l=await d(r,`insert into public.direct_conversations(pair_low, pair_high, connection_id)
           values ($1,$2,$3)
           on conflict (pair_low, pair_high) do update
             set connection_id = excluded.connection_id,
                 archived_at = null,
                 updated_at = now()
           returning *`,[c.pair_low,c.pair_high,c.id])),await vt(r,c.requester_user_key,s==="accepted"?"connection_accepted":"connection_declined",s==="accepted"?"\u0417\u043D\u0430\u043A\u043E\u043C\u0441\u0442\u0432\u043E \u043F\u0440\u0438\u043D\u044F\u0442\u043E":"\u0417\u0430\u044F\u0432\u043A\u0430 \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0430",s==="accepted"?`${e.userPrincipal.name} \u043F\u0440\u0438\u043D\u044F\u043B \u0432\u0430\u0448\u0443 \u0437\u0430\u044F\u0432\u043A\u0443. \u0422\u0435\u043F\u0435\u0440\u044C \u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D \u043B\u0438\u0447\u043D\u044B\u0439 \u0447\u0430\u0442.`:`${e.userPrincipal.name} \u043E\u0442\u043A\u043B\u043E\u043D\u0438\u043B \u0432\u0430\u0448\u0443 \u0437\u0430\u044F\u0432\u043A\u0443.`,{connectionId:n,conversationId:l?.id||null,status:s},`connection-response:${n}`),{connection:u,conversation:l}});a.json(o)})),i.delete("/connections/:connectionId",p(async(e,a)=>{let n=P(e.params.connectionId,"connectionId");if(!await d(t,`update public.user_connections
          set status = 'removed', updated_at = now()
        where id = $1
          and $2 in (requester_user_key, recipient_user_key)
          and status = 'accepted'
        returning *`,[n,e.userPrincipal.userKey]))throw new _(404,"Active connection was not found","not_found");await t.query(`update public.direct_conversations
          set archived_at = now(), updated_at = now()
        where connection_id = $1`,[n]),a.status(204).end()})),i.get("/conversations",p(async(e,a)=>{let n=await w(t,`select conversation.*,
              case when conversation.pair_low = $1 then conversation.pair_high else conversation.pair_low end as peer_user_key,
              peer.name as peer_name,
              peer.avatar as peer_avatar,
              latest.body as last_message,
              latest.created_at as last_message_at,
              coalesce(unread.unread_count, 0)::integer as unread_count
         from public.direct_conversations conversation
         join public.user_connections connection
           on connection.id = conversation.connection_id and connection.status = 'accepted'
         join public.app_users peer
           on peer.user_key = case when conversation.pair_low = $1 then conversation.pair_high else conversation.pair_low end
         left join lateral (
           select message.body, message.created_at
             from public.direct_messages message
            where message.conversation_id = conversation.id and message.deleted_at is null
            order by message.created_at desc
            limit 1
         ) latest on true
         left join lateral (
           select count(*) as unread_count
             from public.direct_messages message
             left join public.direct_message_read_states read_state
               on read_state.conversation_id = conversation.id and read_state.user_key = $1
            where message.conversation_id = conversation.id
              and message.sender_user_key <> $1
              and message.deleted_at is null
              and message.created_at > coalesce(read_state.last_read_at, '-infinity'::timestamptz)
         ) unread on true
        where $1 in (conversation.pair_low, conversation.pair_high)
          and conversation.archived_at is null
          and not exists (
            select 1 from public.user_blocks block
             where (block.blocker_user_key = conversation.pair_low and block.blocked_user_key = conversation.pair_high)
                or (block.blocker_user_key = conversation.pair_high and block.blocked_user_key = conversation.pair_low)
          )
        order by latest.created_at desc nulls last, conversation.updated_at desc`,[e.userPrincipal.userKey]);a.json({conversations:n})})),i.get("/conversations/:conversationId/messages",p(async(e,a)=>{let n=P(e.params.conversationId,"conversationId");await ht(t,n,e.userPrincipal.userKey);let s=await w(t,`select message.*, author.name as author_name, author.avatar as author_avatar
         from public.direct_messages message
         left join public.app_users author on author.user_key = message.sender_user_key
        where message.conversation_id = $1
        order by message.created_at asc
        limit 200`,[n]);await t.query(`insert into public.direct_message_read_states(conversation_id, user_key, last_read_at)
       values ($1,$2,now())
       on conflict (conversation_id, user_key) do update
         set last_read_at = excluded.last_read_at`,[n,e.userPrincipal.userKey]),a.json({messages:s})})),i.post("/conversations/:conversationId/messages",p(async(e,a)=>{await O(t,e,"direct_message.create",M(e));let n=P(e.params.conversationId,"conversationId"),s=f(e.body?.body,"body",4e3),o=e.body?.replyToMessageId?P(e.body.replyToMessageId,"replyToMessageId"):null,r=await ht(t,n,e.userPrincipal.userKey);if(o&&!await d(t,`select id from public.direct_messages
          where id = $1 and conversation_id = $2`,[o,n]))throw new _(404,"Reply message was not found","not_found");let c=await d(t,`insert into public.direct_messages(
         conversation_id, sender_user_key, body, reply_to_message_id
       ) values ($1,$2,$3,$4)
       returning *`,[n,e.userPrincipal.userKey,s,o]);await t.query("update public.direct_conversations set updated_at = now() where id = $1",[n]),await vt(t,r.peerKey,"direct_message",`\u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u043E\u0442 ${e.userPrincipal.name}`,s.slice(0,300),{conversationId:n,messageId:c.id},`direct-message:${c.id}`),a.status(201).json({message:c})})),i.post("/blocks",p(async(e,a)=>{let n=$(e.body?.blockedUserKey,"blockedUserKey"),s=g(e.body?.reason,1e3);if(n===e.userPrincipal.userKey)throw new _(400,"A user cannot block themselves","validation_error");if(!await d(t,"select user_key from public.app_users where user_key = $1",[n]))throw new _(404,"User was not found","not_found");let[r,c]=ma(e.userPrincipal.userKey,n),u=await S(t,async l=>{let m=await d(l,`insert into public.user_blocks(blocker_user_key, blocked_user_key, reason)
         values ($1,$2,$3)
         on conflict (blocker_user_key, blocked_user_key) do update
           set reason = excluded.reason
         returning *`,[e.userPrincipal.userKey,n,s]);return await l.query(`update public.user_connections
            set status = 'blocked', updated_at = now()
          where pair_low = $1 and pair_high = $2`,[r,c]),await l.query(`update public.direct_conversations
            set archived_at = now(), updated_at = now()
          where pair_low = $1 and pair_high = $2`,[r,c]),m});a.status(201).json({block:u})})),i.delete("/blocks/:blockedUserKey",p(async(e,a)=>{let n=$(e.params.blockedUserKey,"blockedUserKey");if(!(await t.query(`delete from public.user_blocks
        where blocker_user_key = $1 and blocked_user_key = $2`,[e.userPrincipal.userKey,n])).rowCount)throw new _(404,"Block was not found","not_found");a.status(204).end()})),i.post("/reports",p(async(e,a)=>{await O(t,e,"user_report.create",M(e));let n=$(e.body?.reportedUserKey,"reportedUserKey"),s=f(e.body?.reasonCode,"reasonCode",100),o=g(e.body?.details,2e3),r=e.body?.conversationId?P(e.body.conversationId,"conversationId"):null,c=e.body?.messageId?P(e.body.messageId,"messageId"):null;if(n===e.userPrincipal.userKey)throw new _(400,"A user cannot report themselves","validation_error");r&&await ht(t,r,e.userPrincipal.userKey);let u=await S(t,async l=>{let m=await d(l,`insert into public.user_reports(
           reporter_user_key, reported_user_key, conversation_id, message_id,
           reason_code, details
         ) values ($1,$2,$3,$4,$5,$6)
         returning *`,[e.userPrincipal.userKey,n,r,c,s,o]);return await l.query(`insert into public.moderation_cases(
           case_type, source_type, source_id, reported_user_key, priority
         ) values ('user_report','user_report',$1,$2,'normal')`,[m.id,n]),m});a.status(201).json({report:u})})),i}var Vs,ba=D(()=>{"use strict";B();L();z();ye();Z();Vs=["accepted","declined"]});var fa={};it(fa,{createApp:()=>qs});import{randomUUID as Gs}from"node:crypto";import{mkdirSync as Fs}from"node:fs";import Ae from"node:path";import Ws from"cookie-parser";import nt from"express";import Ys from"helmet";function qs(t,i){wa||Fs(kt,{recursive:!0});let e=nt();return e.disable("x-powered-by"),i.trustProxy&&e.set("trust proxy",1),e.use((a,n,s)=>{let o=String(a.get("origin")||"");if(o&&Xs.has(o)&&(n.setHeader("Access-Control-Allow-Origin",o),n.setHeader("Access-Control-Allow-Credentials","true"),n.setHeader("Access-Control-Allow-Methods","GET,POST,PATCH,PUT,DELETE,OPTIONS"),n.setHeader("Access-Control-Allow-Headers","Content-Type,Authorization,Idempotency-Key,X-Request-ID"),n.setHeader("Access-Control-Max-Age","600"),n.append("Vary","Origin"),a.method==="OPTIONS"))return n.status(204).end();s()}),e.use((a,n,s)=>{a.requestId=String(a.get("x-request-id")||Gs()).slice(0,160),n.setHeader("x-request-id",a.requestId),n.setHeader("x-bali-environment",i.environment),s()}),e.use(Ys({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'","'unsafe-inline'"],styleSrc:["'self'","'unsafe-inline'","https://fonts.googleapis.com"],fontSrc:["'self'","https://fonts.gstatic.com","data:"],imgSrc:["'self'","data:","blob:","https:"],connectSrc:["'self'"],frameAncestors:["'self'"]}},crossOriginEmbedderPolicy:!1})),e.use(nt.json({limit:"256kb"})),e.use(Ws()),e.use(Ot(t,i)),e.use(Ct(t,i)),e.use("/api/v1",(a,n,s)=>{n.setHeader("Cache-Control","private, no-store, max-age=0"),n.setHeader("Pragma","no-cache"),s()}),e.get("/api/v1/health",(a,n)=>{n.json({ok:!0,environment:i.environment})}),e.get("/api/v1/config/public",(a,n)=>{n.json({environment:i.environment,demoAvailable:!["production","staging"].includes(i.environment),authentication:"mobile-password"})}),e.use("/api/v1/auth",Ut(t,i)),e.use("/api/v1/auth",Ht(t,i)),e.use("/api/v1/clans",Xt(t)),e.use("/api/v1/people",da(t)),e.use("/api/v1/events",Vn(t)),e.use("/api/v1/layouts",nn(t)),e.use("/api/v1/bookings",En(t)),e.use("/api/v1/catalog",Bn(t)),e.use("/api/v1/economy",Hn(t)),e.use("/api/v1/game",ia(t)),e.use("/api/v1/notifications",ca(t)),e.use("/api/v1/platform-config",_a(t)),e.use("/api/v1/social",ya(t)),e.use("/api/v1/admin",en(t)),e.use("/api/v1/admin",un(t)),e.use("/api/v1/admin",yn(t)),e.use("/api/v1/admin",hn(t,kt)),e.use("/api/v1/admin",Pn(t)),e.use("/api/v1/admin",Nn(t)),e.use("/api/v1/admin",Kn(t)),e.use("/site",nt.static(at,{etag:!0,maxAge:i.environment==="production"?"1h":0,index:!1})),e.use("/uploads",nt.static(kt,{etag:!0,immutable:i.environment==="production",maxAge:i.environment==="production"?"1y":0,index:!1,fallthrough:!1})),e.get("/app",(a,n)=>{n.setHeader("Cache-Control","no-store, max-age=0"),n.sendFile(Ae.join(at,"app-production.html"))}),e.get("/admin",(a,n)=>{n.setHeader("Cache-Control","no-store, max-age=0"),n.sendFile(Ae.join(at,"admin-production.html"))}),["production","staging"].includes(i.environment)||e.get("/demo",(a,n)=>{n.sendFile(Ae.join(at,"index.html"))}),e.get("/",(a,n)=>{n.redirect(i.environment==="production"?"/app":"/demo")}),e.use(Pt),e.use(Tt),e}var at,wa,Zs,kt,Xs,ga=D(()=>{"use strict";Bt();Qt();qt();tn();dn();bn();vn();Tn();An();Rn();Un();Ln();Qn();Gn();ra();ze();ua();la();pa();ba();L();z();at=Ae.resolve(process.cwd(),"site"),wa=!!globalThis.Deno,Zs=process.env.VERCEL||wa?"/tmp/bali-uploads":Ae.join(process.cwd(),"var","uploads"),kt=Ae.resolve(process.env.BALI_UPLOAD_DIR||Zs),Xs=new Set(["capacitor://localhost","ionic://localhost","http://localhost","https://localhost","https://nik13599.github.io"])});var ha={};it(ha,{loadConfig:()=>to});function It(t,i){let e=Number.parseInt(t||"",10);return Number.isFinite(e)&&e>0?e:i}function to(t=process.env){let i=t.BALI_ENV||t.NODE_ENV||"development",e=eo.has(i)?i:"development",a=e==="production"||e==="staging",n={environment:e,port:It(t.PORT,8080),databaseUrl:t.DATABASE_URL||"",telegramBotToken:t.TELEGRAM_BOT_TOKEN||"",telegramBotUrl:t.TELEGRAM_BOT_URL||"",sessionSecret:t.SESSION_SECRET||"",sessionTtlSeconds:It(t.SESSION_TTL_SECONDS,720*60*60),telegramAuthMaxAgeSeconds:It(t.TELEGRAM_AUTH_MAX_AGE_SECONDS,300),adminBootstrapEmail:(t.ADMIN_BOOTSTRAP_EMAIL||"").trim().toLowerCase(),adminBootstrapPassword:t.ADMIN_BOOTSTRAP_PASSWORD||"",trustProxy:t.TRUST_PROXY==="1",secureCookies:a};if(a){let s=[!n.databaseUrl&&"DATABASE_URL",n.sessionSecret.length<32&&"SESSION_SECRET (minimum 32 characters)"].filter(Boolean);if(s.length)throw new Error(`Missing production configuration: ${s.join(", ")}`)}return n}var eo,va=D(()=>{"use strict";eo=new Set(["demo","development","staging","production","test"])});import jt from"node:process";import no from"express";var $a=globalThis.Deno?.env,ao={...jt.env,BALI_ENV:"production",DATABASE_URL:$a?.get("SUPABASE_DB_URL")||jt.env.SUPABASE_DB_URL||"",SESSION_SECRET:$a?.get("SUPABASE_SERVICE_ROLE_KEY")||jt.env.SUPABASE_SERVICE_ROLE_KEY||"",TRUST_PROXY:"1",PORT:"8000"},[{createApp:so},{loadConfig:oo},{createPool:io}]=await Promise.all([Promise.resolve().then(()=>(ga(),fa)),Promise.resolve().then(()=>(va(),ha)),Promise.resolve().then(()=>(B(),St))]),ka=oo(ao),Ia=io(ka.databaseUrl,1);await Ia.query("select 1");var ro=so(Ia,ka),ja=no();ja.use((t,i)=>{let e=["/functions/v1/bali-api","/bali-api"];for(let a of e)t.url===a?t.url="/":t.url.startsWith(`${a}/`)&&(t.url=t.url.slice(a.length));return ro(t,i)});ja.listen(8e3,()=>console.log("BALI Edge API listening on 8000"));
