(() => {
  if (window.__BALI_EVENT_CHECKIN_CLOUD__) return;
  window.__BALI_EVENT_CHECKIN_CLOUD__ = true;
  const attendance=window.BaliEventQrAttendance,store=window.BaliStore,tg=window.Telegram?.WebApp,cfg=window.BALI_CONFIG||{},points=window.BaliPoints,game=window.BaliBeta4Game;
  if(!attendance)return;
  const original={...attendance};
  const endpoint=()=>cfg.supabaseUrl?`${String(cfg.supabaseUrl).replace(/\/$/,"")}/functions/v1/event-checkin-production`:"";
  async function invoke(action,extra={}){if(!store?.cloudEnabled||!tg?.initData)throw new Error("Рабочая система QR-входа ещё не подключена");const response=await fetch(endpoint(),{method:"POST",headers:{"Content-Type":"application/json",apikey:cfg.supabaseAnonKey,Authorization:`Bearer ${cfg.supabaseAnonKey}`},body:JSON.stringify({action,init_data:tg.initData,...extra})});const data=await response.json().catch(()=>({}));if(!response.ok||data.error){const error=new Error(data.error||"Ошибка QR-входа");error.duplicate=data.duplicate;error.row=data.row;throw error}return data}
  function applyBalance(balance){if(balance===undefined||!points?.keys?.profile)return;const profile=points.profile();points.write(points.keys.profile,{...profile,balance:Number(balance||0)})}
  attendance.listOwnCheckins=async eventId=>{if(!store?.cloudEnabled)return[];try{const data=await invoke("list");return(data.checkins||[]).filter(row=>!eventId||String(row.event_id)===String(eventId))}catch{return[]}};
  attendance.listPresence=async()=>{if(!store?.cloudEnabled)return[];try{const data=await invoke("presence");return data.presence||[]}catch{return[]}};
  attendance.listCheckins=async eventId=>{
    const [own,presence]=await Promise.all([attendance.listOwnCheckins(eventId),attendance.listPresence()]);
    const filteredPresence=(presence||[]).filter(row=>!eventId||String(row.event_id)===String(eventId));
    return [...new Map([...filteredPresence,...own].map(row=>[`${row.event_id}:${row.user_key||row.telegram_id||row.id}`,row])).values()];
  };
  attendance.checkIn=async raw=>{let parsed;try{parsed=original.parse(raw)}catch(error){return{ok:false,message:error.message}}try{const data=await invoke("checkin",{event_id:parsed.eventId,qr_token:parsed.token});applyBalance(data.balance);if(!data.reentered){game?.recordVisit?.();try{game?.awardAchievement?.("first_visit")}catch{}}window.dispatchEvent(new CustomEvent("bali:checkin-complete",{detail:{event:data.event,result:data}}));window.dispatchEvent(new CustomEvent("bali:presence-changed"));return{ok:true,...data,points:Number(data.points||0),xp:Number(data.row?.xp||0),visits:Number(data.row?.visits||0),level:data.row?.level||game?.levelFor?.(game.profile().xp)?.current?.name||""}}catch(error){return{ok:false,duplicate:Boolean(error.duplicate),row:error.row||null,message:error.message||"Не удалось подтвердить вход"}}};
  attendance.leave=async eventId=>{try{const data=await invoke("leave",{event_id:eventId||""});window.dispatchEvent(new CustomEvent("bali:checkin-left",{detail:{eventId:data.row?.event_id,row:data.row}}));window.dispatchEvent(new CustomEvent("bali:presence-changed"));return{ok:true,row:data.row}}catch(error){return{ok:false,message:error.message||"Не удалось отметить выход"}}};
  window.BaliEventQrAttendance=attendance;

  async function consumeQrStart(){
    const start=String(tg?.initDataUnsafe?.start_param||"");
    if(!start.startsWith("checkin_"))return;
    const key=`bali_checkin_start_${start.slice(0,80)}`;
    if(sessionStorage.getItem(key)==="1")return;
    sessionStorage.setItem(key,"1");
    const result=await attendance.checkIn(start.slice(8));
    const message=result.ok
      ? `${result.reentered?"Повторный вход подтверждён":"Вход подтверждён"}${result.event?.title?`\n${result.event.title}`:""}${Number(result.points||0)>0?`\n+${Number(result.points)} BALI-Баллов`:""}`
      : result.message||"Не удалось подтвердить вход";
    try{tg?.showAlert?.(message)}catch{alert(message)}
  }
  setTimeout(consumeQrStart,900);
})();