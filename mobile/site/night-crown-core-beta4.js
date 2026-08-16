(() => {
  if (window.BaliNightCrown) return;
  const store=window.BaliStore,game=window.BaliBeta4Game,attendance=window.BaliEventQrAttendance,points=window.BaliPoints,loyalty=window.BaliBeta4Loyalty;
  if(!store||!game||!attendance)return;
  const ENTRY_KEY="bali_night_crown_entries_v1",VOTE_KEY="bali_night_crown_votes_v1",PRIZE_KEY="bali_night_crown_prizes_v1";
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
  const write=(key,value)=>{localStorage.setItem(key,JSON.stringify(value));window.dispatchEvent(new CustomEvent("bali:night-crown-changed",{detail:{key}}));return value};
  const now=()=>new Date().toISOString(),safe=v=>String(v||"guest").replace(/[^a-zA-Z0-9_-]/g,"-");
  const profile=()=>game.profile(),myKey=()=>String(profile().id||profile().userKey||points?.profile?.().userKey||profile().code||"");
  const myKeys=()=>new Set(game.identityKeys(profile()).map(String));
  const entriesLocal=()=>read(ENTRY_KEY,[]),votesLocal=()=>read(VOTE_KEY,[]),prizesLocal=()=>read(PRIZE_KEY,[]);
  const at=(date,time="00:00")=>{const value=new Date(`${String(date||"").slice(0,10)}T${time||"00:00"}:00`);return Number.isNaN(value.getTime())?null:value};
  function eventEnd(event){
    const startDate=event?.event_date||"",startTime=event?.event_time||"23:00",endTime=event?.event_end_time||event?.end_time||"06:00";
    let endDate=event?.event_end_date||event?.end_date||startDate;
    if(!event?.event_end_date&&!event?.end_date&&endTime<=startTime){const date=at(startDate,"12:00");if(date){date.setDate(date.getDate()+1);endDate=date.toISOString().slice(0,10)}}
    return at(endDate,endTime)?.getTime()||0;
  }
  const isActiveEvent=event=>eventEnd(event)>Date.now();
  async function adminSession(){if(!store.cloudEnabled||!store.client)return false;try{const{data}=await store.client.auth.getSession();return Boolean(data?.session?.user)}catch{return false}}
  async function cloud(table,eventId=""){
    if(!store.cloudEnabled||!store.client)return[];
    try{let q=store.client.from(table).select("*");if(eventId)q=q.eq("event_id",eventId);const{data,error}=await q;return error?[]:data||[]}catch{return[]}
  }
  async function merge(table,key,eventId=""){
    const local=(key===ENTRY_KEY?entriesLocal():key===VOTE_KEY?votesLocal():prizesLocal()).filter(r=>!eventId||String(r.event_id)===String(eventId));
    const remote=await cloud(table,eventId);return[...new Map([...remote,...local].map(r=>[String(r.id),r])).values()];
  }
  async function save(table,key,row){
    const rows=key===ENTRY_KEY?entriesLocal():key===VOTE_KEY?votesLocal():prizesLocal(),i=rows.findIndex(x=>String(x.id)===String(row.id));if(i>=0)rows[i]=row;else rows.unshift(row);write(key,rows.slice(0,15000));
    if(store.cloudEnabled&&store.client){try{await store.client.from(table).upsert(row)}catch{}}
    return row;
  }
  async function remove(table,key,id){const rows=(key===ENTRY_KEY?entriesLocal():key===VOTE_KEY?votesLocal():prizesLocal()).filter(x=>String(x.id)!==String(id));write(key,rows);if(store.cloudEnabled&&store.client){try{await store.client.from(table).delete().eq("id",id)}catch{}}}
  async function events(){return(await store.list("events")).filter(e=>e.night_crown_enabled===true||e.night_crown_enabled==="true")}
  async function eventById(id){return(await store.list("events")).find(e=>String(e.id)===String(id))||null}
  async function myCheckin(eventId){const rows=await attendance.listCheckins(eventId),keys=myKeys(),tg=String(profile().telegramId||"");return rows.find(r=>keys.has(String(r.user_key||""))||(tg&&String(r.telegram_id||"")===tg))||null}
  async function activeEvent(){const enabled=(await events()).filter(isActiveEvent),all=await attendance.listCheckins(),keys=myKeys(),tg=String(profile().telegramId||"");const mine=all.filter(r=>keys.has(String(r.user_key||""))||(tg&&String(r.telegram_id||"")===tg)).sort((a,b)=>String(b.checked_in_at||"").localeCompare(String(a.checked_in_at||"")));for(const row of mine){const e=enabled.find(x=>String(x.id)===String(row.event_id));if(e)return e}const today=new Date().toISOString().slice(0,10);return enabled.find(e=>String(e.event_date)===today)||null}
  async function canAccess(eventId){const event=await eventById(eventId);return Boolean(event&&isActiveEvent(event)&&await myCheckin(eventId))}
  async function entries(eventId="",all=false){const rows=await merge("night_crown_entries",ENTRY_KEY,eventId);return rows.filter(r=>all||r.status==="approved")}
  async function myEntry(eventId){const key=myKey(),tg=String(profile().telegramId||"");return(await entries(eventId,true)).find(r=>String(r.user_key)===key||(tg&&String(r.telegram_id||"")===tg))||null}
  async function join(eventId,{gender,photo}){
    const event=await eventById(eventId);if(!event||!(event.night_crown_enabled===true||event.night_crown_enabled==="true"))return{ok:false,message:"Конкурс для этого мероприятия не активирован"};
    if(!(await canAccess(eventId)))return{ok:false,message:"Участие доступно только во время мероприятия после подтверждения входа по QR"};
    if(!["female","male"].includes(gender))return{ok:false,message:"Выберите женский или мужской сектор"};if(!photo)return{ok:false,message:"Загрузите фотографию, сделанную в клубе BALI"};
    const p=profile(),id=`crown-entry-${safe(eventId)}-${safe(myKey())}`,previous=await myEntry(eventId);
    const row={...(previous||{}),id,event_id:String(eventId),event_title:event.title||"Мероприятие BALI",event_date:event.event_date||"",user_key:myKey(),telegram_id:p.telegramId||null,name:p.name||"Гость BALI",username:p.username||p.telegram||"",gender,photo_url:photo,status:"pending",moderation_note:"",joined_at:previous?.joined_at||now(),updated_at:now(),approved_at:null,rejected_at:null};
    await save("night_crown_entries",ENTRY_KEY,row);return{ok:true,entry:row};
  }
  async function moderate(id,status,note=""){
    if(!(await adminSession())&&store.cloudEnabled)return{ok:false,message:"Требуется вход администратора"};const row=(await entries("",true)).find(x=>String(x.id)===String(id));if(!row)return{ok:false,message:"Заявка не найдена"};
    const next={...row,status,moderation_note:note||"",updated_at:now(),approved_at:status==="approved"?now():row.approved_at,rejected_at:status==="rejected"?now():null};await save("night_crown_entries",ENTRY_KEY,next);return{ok:true,entry:next};
  }
  async function rawVotes(eventId=""){return merge("night_crown_votes",VOTE_KEY,eventId)}
  async function votes(eventId=""){
    const rows=(await rawVotes(eventId)).sort((a,b)=>String(b.created_at||"").localeCompare(String(a.created_at||"")));
    const latest=new Map();
    for(const row of rows){const key=`${row.event_id}:${row.voter_key}:${row.candidate_gender||"unknown"}`;if(!latest.has(key))latest.set(key,row)}
    return[...latest.values()];
  }
  async function toggleVote(eventId,candidateKey){
    if(!(await canAccess(eventId)))return{ok:false,message:"Голосовать можно только во время мероприятия после QR-входа"};
    const candidate=(await entries(eventId)).find(x=>String(x.user_key)===String(candidateKey));
    if(!candidate)return{ok:false,message:"Участник не допущен к голосованию"};
    if(String(candidate.user_key)===myKey())return{ok:false,message:"Нельзя голосовать за себя"};

    const voter=myKey(),allVotes=await rawVotes(eventId);
    const sectorVotes=allVotes.filter(v=>String(v.event_id)===String(eventId)&&String(v.voter_key)===voter&&String(v.candidate_gender)===String(candidate.gender));
    const targetWasActive=sectorVotes.some(v=>String(v.candidate_key)===String(candidateKey));
    const replaced=sectorVotes.some(v=>String(v.candidate_key)!==String(candidateKey));

    for(const vote of sectorVotes) await remove("night_crown_votes",VOTE_KEY,vote.id);
    if(targetWasActive)return{ok:true,active:false,replaced:false,gender:candidate.gender};

    const event=await eventById(eventId),id=`crown-vote-${safe(eventId)}-${safe(voter)}-${safe(candidateKey)}`;
    const row={id,event_id:String(eventId),event_title:event?.title||candidate.event_title||"Мероприятие BALI",event_date:event?.event_date||candidate.event_date||"",voter_key:voter,candidate_key:String(candidateKey),candidate_name:candidate.name,candidate_gender:candidate.gender,created_at:now()};
    await save("night_crown_votes",VOTE_KEY,row);
    return{ok:true,active:true,replaced,gender:candidate.gender};
  }
  async function ranking(eventId,gender=""){
    const [list,allVotes]=await Promise.all([entries(eventId),votes(eventId)]),filtered=list.filter(x=>!gender||x.gender===gender),total=allVotes.filter(v=>!gender||v.candidate_gender===gender).length;
    return filtered.map(entry=>{const count=allVotes.filter(v=>String(v.candidate_key)===String(entry.user_key)).length;return{...entry,votes:count,percent:total?Math.round(count/total*100):0}}).sort((a,b)=>b.votes-a.votes||String(a.name).localeCompare(String(b.name),"ru"));
  }
  async function history(){const enabled=await events(),result=[];for(const event of enabled.sort((a,b)=>String(b.event_date).localeCompare(String(a.event_date)))){const female=await ranking(event.id,"female"),male=await ranking(event.id,"male"),prizes=(await merge("night_crown_prizes",PRIZE_KEY,event.id));result.push({event,female,male,winners:{female:female[0]||null,male:male[0]||null},prizes})}return result}
  async function award(eventId,targetKey,type,value,note=""){
    const entry=(await entries(eventId,true)).find(x=>String(x.user_key)===String(targetKey));if(!entry)return{ok:false,message:"Участник не найден"};const id=`crown-prize-${safe(eventId)}-${safe(targetKey)}-${safe(type)}-${Date.now()}`,row={id,event_id:String(eventId),event_title:entry.event_title,event_date:entry.event_date,user_key:String(targetKey),name:entry.name,gender:entry.gender,prize_type:type,prize_value:String(value||""),note,awarded_at:now(),applied_at:null};
    if(type==="points"&&Number(value))points?.adjustAccount?.({userKey:targetKey,name:entry.name},Number(value),`Приз конкурса ${entry.event_title}`);
    if(type==="vip"&&value){const [planId,daysRaw]=String(value).split(":");game?.giftVip?.({userKey:targetKey,name:entry.name},planId,Number(daysRaw||1),`Приз конкурса ${entry.event_title}`)}
    if(type==="reward"&&value){try{loyalty?.grantReward?.(String(value),{userKey:targetKey,name:entry.name},`Приз конкурса ${entry.event_title}`)}catch{}}
    await save("night_crown_prizes",PRIZE_KEY,row);return{ok:true,prize:row};
  }
  window.BaliNightCrown={ENTRY_KEY,VOTE_KEY,PRIZE_KEY,events,eventById,activeEvent,myCheckin,canAccess,entries,myEntry,join,moderate,votes,toggleVote,ranking,history,award,myKey,eventEnd,isActiveEvent};
})();