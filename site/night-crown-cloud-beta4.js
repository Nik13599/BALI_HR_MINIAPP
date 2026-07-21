(() => {
  if(window.__BALI_NIGHT_CROWN_CLOUD__||!window.BaliNightCrown)return;window.__BALI_NIGHT_CROWN_CLOUD__=true;
  const crown=window.BaliNightCrown,store=window.BaliStore,game=window.BaliBeta4Game,attendance=window.BaliEventQrAttendance;
  const baseJoin=crown.join,baseEntry=crown.myEntry,baseVote=crown.toggleVote;
  const safe=v=>String(v||"guest").replace(/[^a-zA-Z0-9_-]/g,"-");
  const myKey=()=>crown.myKey(),profile=()=>game.profile();
  const localRows=key=>{try{return JSON.parse(localStorage.getItem(key)||"[]")}catch{return[]}};
  const saveLocal=(key,rows)=>{localStorage.setItem(key,JSON.stringify(rows));window.dispatchEvent(new CustomEvent("bali:night-crown-changed"))};
  const at=(date,time="00:00")=>{const value=new Date(`${String(date||"").slice(0,10)}T${time||"00:00"}:00`);return Number.isNaN(value.getTime())?null:value};
  function eventEnd(event){
    const startDate=event?.event_date||"",startTime=event?.event_time||"23:00",endTime=event?.event_end_time||event?.end_time||"06:00";
    let endDate=event?.event_end_date||event?.end_date||startDate;
    if(!event?.event_end_date&&!event?.end_date&&endTime<=startTime){const date=at(startDate,"12:00");if(date){date.setDate(date.getDate()+1);endDate=date.toISOString().slice(0,10)}}
    return at(endDate,endTime)?.getTime()||0;
  }
  const isActiveEvent=event=>eventEnd(event)>Date.now();
  async function allEvents(){return(await store.list("events")).filter(e=>e.night_crown_enabled===true||e.night_crown_enabled==="true"||e.night_crown_ever_enabled===true||e.night_crown_ever_enabled==="true")}
  async function activeEvent(){const enabled=(await store.list("events")).filter(e=>(e.night_crown_enabled===true||e.night_crown_enabled==="true")&&isActiveEvent(e)),rows=await attendance.listCheckins(),keys=new Set(game.identityKeys(profile()).map(String)),tg=String(profile().telegramId||"");const mine=rows.filter(r=>keys.has(String(r.user_key||""))||(tg&&String(r.telegram_id||"")===tg)).sort((a,b)=>String(b.checked_in_at||"").localeCompare(String(a.checked_in_at||"")));for(const row of mine){const e=enabled.find(x=>String(x.id)===String(row.event_id));if(e)return e}const today=new Date().toISOString().slice(0,10);return enabled.find(e=>String(e.event_date)===today)||null}
  async function myEntry(eventId){const local=await baseEntry(eventId);if(local||!store.cloudEnabled||!store.client)return local;try{const{data,error}=await store.client.rpc("get_my_night_crown_entry",{p_event_id:String(eventId),p_user_key:myKey()});return error?null:data?.[0]||null}catch{return null}}
  async function join(eventId,data){const result=await baseJoin(eventId,data);if(!result.ok||!store.cloudEnabled||!store.client)return result;const p=profile(),rollback=()=>result.entry?.id&&saveLocal(crown.ENTRY_KEY,localRows(crown.ENTRY_KEY).filter(x=>String(x.id)!==String(result.entry.id)));try{const{data:row,error}=await store.client.rpc("submit_night_crown_entry",{p_event_id:String(eventId),p_user_key:myKey(),p_telegram_id:p.telegramId?String(p.telegramId):null,p_name:p.name||"Гость BALI",p_username:p.username||p.telegram||"",p_gender:data.gender,p_photo_url:data.photo});if(error){rollback();return{ok:false,message:error.message||"Не удалось отправить заявку"}}return{ok:true,entry:row}}catch(error){rollback();return{ok:false,message:error.message||"Не удалось отправить заявку"}}}
  async function toggleVote(eventId,candidateKey){
    if(!store.cloudEnabled||!store.client)return baseVote(eventId,candidateKey);
    if(!(await crown.canAccess(eventId)))return{ok:false,message:"Голосовать могут только гости этого мероприятия после QR-входа"};
    const candidate=(await crown.entries(eventId)).find(x=>String(x.user_key)===String(candidateKey));
    if(!candidate)return{ok:false,message:"Участник не допущен к голосованию"};
    if(String(candidate.user_key)===myKey())return{ok:false,message:"Нельзя голосовать за себя"};
    try{
      const voter=myKey();
      const{data:remote,error:readError}=await store.client.from("night_crown_votes").select("*").eq("event_id",String(eventId)).eq("voter_key",voter).eq("candidate_gender",candidate.gender);
      if(readError)return{ok:false,message:readError.message||"Не удалось проверить предыдущий голос"};
      const sectorVotes=remote||[];
      const targetWasActive=sectorVotes.some(row=>String(row.candidate_key)===String(candidateKey));
      const replaced=sectorVotes.some(row=>String(row.candidate_key)!==String(candidateKey));
      const candidateKeys=[...new Set(sectorVotes.map(row=>String(row.candidate_key)).filter(Boolean))];
      for(const previousKey of candidateKeys){
        const{error}=await store.client.rpc("toggle_night_crown_vote",{p_event_id:String(eventId),p_voter_key:voter,p_candidate_key:previousKey});
        if(error)return{ok:false,message:error.message||"Не удалось заменить голос"};
      }
      let active=false;
      if(!targetWasActive){
        const{data,error}=await store.client.rpc("toggle_night_crown_vote",{p_event_id:String(eventId),p_voter_key:voter,p_candidate_key:String(candidateKey)});
        if(error)return{ok:false,message:error.message||"Голос не принят"};
        active=Boolean(data);
      }
      const rows=localRows(crown.VOTE_KEY).filter(row=>!(String(row.event_id)===String(eventId)&&String(row.voter_key)===voter&&String(row.candidate_gender)===String(candidate.gender)));
      if(active)rows.unshift({id:`crown-vote-${safe(eventId)}-${safe(voter)}-${safe(candidateKey)}`,event_id:String(eventId),voter_key:voter,candidate_key:String(candidateKey),candidate_name:candidate.name,candidate_gender:candidate.gender,created_at:new Date().toISOString()});
      saveLocal(crown.VOTE_KEY,rows);
      return{ok:true,active,replaced:active&&replaced,gender:candidate.gender};
    }catch(error){return{ok:false,message:error.message||"Голос не принят"}}
  }
  async function history(){const events=await allEvents(),result=[];let cloudPrizes=[];if(store.cloudEnabled&&store.client){try{const{data}=await store.client.from("night_crown_prizes").select("*");cloudPrizes=data||[]}catch{}}const local=localRows(crown.PRIZE_KEY),prizes=[...new Map([...cloudPrizes,...local].map(x=>[String(x.id),x])).values()];for(const event of events.sort((a,b)=>String(b.event_date).localeCompare(String(a.event_date)))){const female=await crown.ranking(event.id,"female"),male=await crown.ranking(event.id,"male");result.push({event,female,male,winners:{female:female[0]||null,male:male[0]||null},prizes:prizes.filter(p=>String(p.event_id)===String(event.id))})}return result}
  crown.events=allEvents;crown.activeEvent=activeEvent;crown.myEntry=myEntry;crown.join=join;crown.toggleVote=toggleVote;crown.history=history;
})();