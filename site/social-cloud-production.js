(() => {
  if (window.__BALI_SOCIAL_CLOUD_PRODUCTION__) return;
  window.__BALI_SOCIAL_CLOUD_PRODUCTION__ = true;
  const social=window.BaliBeta4Social,store=window.BaliStore,tg=window.Telegram?.WebApp,cfg=window.BALI_CONFIG||{},game=window.BaliBeta4Game;
  if(!social)return;
  let profiles=[],likes=[],busy=false;
  const originalSave=social.saveProfile.bind(social);
  const myId=()=>String(social.myId());
  const url=()=>cfg.supabaseUrl?`${String(cfg.supabaseUrl).replace(/\/$/,"")}/functions/v1/social-production`:"";
  const currentProfile=()=>{const p=social.profile(),g=game?.profile?.()||{};return{name:p.name||g.name,username:p.username||g.username,phone:g.phone||"",photo:p.photo||g.avatar||"",cropX:Number(p.cropX??50),cropY:Number(p.cropY??40),status:p.status||"closed",bio:p.bio||"",active:p.active===true,gender:p.gender||g.gender||"unspecified",birthDate:p.birthDate||g.birthDate||null}};
  async function invoke(action,extra={}){if(!store?.cloudEnabled||!tg?.initData)throw new Error("BALI People ещё не подключён к общей базе");const response=await fetch(url(),{method:"POST",headers:{"Content-Type":"application/json",apikey:cfg.supabaseAnonKey,Authorization:`Bearer ${cfg.supabaseAnonKey}`},body:JSON.stringify({action,init_data:tg.initData,profile:currentProfile(),...extra})});const data=await response.json().catch(()=>({}));if(!response.ok||data.error)throw new Error(data.error||"Ошибка BALI People");return data}
  function normalizeProfile(row){return{id:String(row.user_key),userKey:String(row.user_key),telegramId:row.telegram_id||null,name:row.name||"Гость BALI",username:row.username||"",phone:row.phone||"",photo:row.photo||"",cropX:Number(row.crop_x??50),cropY:Number(row.crop_y??40),status:row.status||"closed",bio:row.bio||"",active:row.active===true,gender:row.gender||"unspecified",birthDate:row.birth_date||"",updatedAt:row.updated_at||""}}
  function apply(data){profiles=(data.profiles||[]).map(normalizeProfile);if(data.me){const me=normalizeProfile(data.me),index=profiles.findIndex(x=>x.id===me.id);if(index>=0)profiles[index]=me;else profiles.unshift(me)}likes=(data.likes||[]).map((row,index)=>({id:`cloud-like-${index}-${row.from_user_key}-${row.to_user_key}`,fromId:String(row.from_user_key),toId:String(row.to_user_key),decision:"thumb",createdAt:row.created_at||""}));localStorage.setItem(social.KEYS.people,JSON.stringify(profiles));localStorage.setItem(social.KEYS.thumbs,JSON.stringify(likes));window.dispatchEvent(new CustomEvent("bali:social-changed"))}
  async function sync(){if(busy)return;busy=true;try{apply(await invoke("list"))}catch{}finally{busy=false}}
  social.people=()=>{const me=social.profile(),rows=profiles.length?profiles:[];return[me,...rows.filter(x=>x.id!==me.id)]};
  social.visiblePeople=()=>social.people().filter(x=>String(x.id)!==myId()&&x.active===true&&x.status!=="closed");
  social.thumbs=()=>likes;
  social.hasThumb=(fromId,toId)=>likes.some(x=>String(x.fromId)===String(fromId)&&String(x.toId)===String(toId));
  social.likeCount=userId=>likes.filter(x=>String(x.toId)===String(userId)).length;
  social.incomingThumbs=()=>social.visiblePeople().filter(person=>social.hasThumb(person.id,myId()));
  social.connections=()=>social.visiblePeople().filter(person=>social.hasThumb(myId(),person.id)&&social.hasThumb(person.id,myId()));
  social.isConnection=id=>social.hasThumb(myId(),id)&&social.hasThumb(id,myId());
  social.saveProfile=patch=>{const result=originalSave(patch);invoke("save_profile",{profile:{...currentProfile(),...patch}}).then(apply).catch(()=>{});return result};
  social.toggleThumb=targetId=>{const active=!social.hasThumb(myId(),targetId);likes=likes.filter(x=>!(String(x.fromId)===myId()&&String(x.toId)===String(targetId)));if(active)likes.unshift({id:`optimistic-${Date.now()}`,fromId:myId(),toId:String(targetId),decision:"thumb",createdAt:new Date().toISOString()});window.dispatchEvent(new CustomEvent("bali:social-changed"));invoke("toggle_like",{target_user_key:String(targetId)}).then(apply).catch(()=>sync());return{active,connected:false,count:social.likeCount(targetId)}};
  document.addEventListener("click",event=>{if(event.target.closest('[data-page="dating"]'))sync()},true);
  setTimeout(sync,700);setInterval(sync,60000);
  window.BaliSocialCloud={sync};
})();