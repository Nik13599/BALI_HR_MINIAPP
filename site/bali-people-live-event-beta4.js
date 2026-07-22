(() => {
  if (window.__BALI_PEOPLE_LIVE_EVENT__) return;
  window.__BALI_PEOPLE_LIVE_EVENT__ = true;
  const store = window.BaliStore;
  const attendance = window.BaliEventQrAttendance;
  if (!store || !attendance) return;

  const esc = (v="") => String(v).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const dateAt=(d,t="00:00")=>{const x=new Date(`${String(d||"").slice(0,10)}T${t||"00:00"}:00`);return Number.isNaN(x.getTime())?null:x};
  function bounds(event={}){
    const start=dateAt(event.event_date,event.event_time||"23:00");
    const st=event.event_time||"23:00", et=event.event_end_time||event.end_time||"06:00";
    let endDate=event.event_end_date||event.end_date||event.event_date||"";
    if(!event.event_end_date&&!event.end_date&&et<=st){const d=dateAt(event.event_date,"12:00");if(d){d.setDate(d.getDate()+1);endDate=d.toISOString().slice(0,10)}}
    return {start,end:dateAt(endDate,et)};
  }
  async function activeEvents(){
    const now=Date.now();
    return (await store.list("events")).filter(event=>{
      if(event.active===false)return false;
      const {start,end}=bounds(event);
      return start&&end&&start.getTime()<=now&&now<end.getTime();
    }).sort((a,b)=>`${a.event_date||""}T${a.event_time||""}`.localeCompare(`${b.event_date||""}T${b.event_time||""}`));
  }
  async function attendeeMap(){
    const events=await activeEvents();
    const map=new Map();
    for(const event of events){
      const rows=await attendance.listCheckins(event.id);
      rows.filter(row=>!row.left_at&&row.presence_status!=="left").forEach(row=>{
        const keys=[String(row.user_key||""),row.telegram_id?`tg:${row.telegram_id}`:""].filter(Boolean);
        keys.forEach(key=>map.set(key,{event,row}));
      });
    }
    return {events,map};
  }
  function style(){
    if(document.getElementById("baliPeopleLiveEventStyle"))return;
    const s=document.createElement("style");s.id="baliPeopleLiveEventStyle";
    s.textContent='.person-v2-live-event{margin-top:7px;padding:7px 9px;border:1px solid rgba(200,255,61,.25);border-radius:11px;background:rgba(200,255,61,.07);color:#dfe8df;font-size:8px;line-height:1.45}.person-v2-live-event b{color:var(--lime)}';
    document.head.appendChild(s);
  }
  async function refreshTab(){
    const button=document.querySelector('[data-social-v2-tab="inside"]');
    if(!button)return;
    const events=await activeEvents();
    button.hidden=!events.length;
    button.disabled=!events.length;
    button.textContent=events.length===1?`Пришли на ${events[0].title||"мероприятие"}`:"Сейчас на мероприятии";
    if(!events.length&&button.classList.contains("active"))document.querySelector('[data-social-v2-tab="all"]')?.click();
  }
  async function decorateInside(){
    const inside=document.querySelector('[data-social-v2-tab="inside"]');
    if(!inside?.classList.contains("active"))return;
    const root=document.getElementById("socialV2Content");if(!root)return;
    const {events,map}=await attendeeMap();
    if(!events.length){document.querySelector('[data-social-v2-tab="all"]')?.click();return;}
    let visible=0;
    root.querySelectorAll('article.person-v2[data-open-social-person]').forEach(card=>{
      const id=String(card.dataset.openSocialPerson||"");
      const person=window.BaliBeta4Social?.visiblePeople?.().find(p=>String(p.id)===id);
      const hit=map.get(id)||(person?.telegramId?map.get(`tg:${person.telegramId}`):null)||(person?.userKey?map.get(String(person.userKey)):null);
      if(!hit){card.remove();return;}
      visible++;
      let note=card.querySelector('.person-v2-live-event');
      if(!note){note=document.createElement('div');note.className='person-v2-live-event';card.querySelector('.person-v2-body')?.appendChild(note);}
      note.innerHTML=`Пришёл на: <b>${esc(hit.event.title||"Мероприятие BALI")}</b>`;
    });
    if(!visible)root.innerHTML='<div class="social-v2-empty">На текущее мероприятие пока никто не вошёл по QR-коду.</div>';
  }
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-social-v2-tab="inside"]'))setTimeout(decorateInside,40);
    if(event.target.closest('[data-page="dating"]'))setTimeout(refreshTab,40);
  },true);
  ["bali:data-changed","bali:checkin-complete","bali:checkin-left","bali:beta4-changed"].forEach(name=>window.addEventListener(name,()=>{setTimeout(refreshTab,0);setTimeout(decorateInside,60)}));
  style();
  [0,200,700,1500].forEach(delay=>setTimeout(refreshTab,delay));
  setInterval(()=>{refreshTab();decorateInside();},60000);
  window.BaliPeopleLiveEvent={activeEvents,attendeeMap,refreshTab,decorateInside};
})();