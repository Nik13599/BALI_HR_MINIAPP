(() => {
  if (window.__BALI_REVIEW_ELIGIBILITY_PRIVATE__) return;
  window.__BALI_REVIEW_ELIGIBILITY_PRIVATE__ = true;
  const store = window.BaliStore;
  const attendance = window.BaliEventQrAttendance;
  const game = window.BaliBeta4Game;
  if (!store || !attendance) return;
  const esc = (v="") => String(v).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const toast = message => { const n=document.getElementById("toast"); if(!n)return; n.textContent=message; n.classList.add("show"); clearTimeout(toast.t); toast.t=setTimeout(()=>n.classList.remove("show"),2400); };
  const identity = () => { const p=game?.profile?.()||{}; return { key:String(p.id||p.userKey||""), tg:String(p.telegramId||"") }; };
  const dateAt=(d,t="00:00")=>{const x=new Date(`${String(d||"").slice(0,10)}T${t||"00:00"}:00`);return Number.isNaN(x.getTime())?null:x};
  function eventEnd(event={}){const sd=event.event_date||"",st=event.event_time||"23:00",et=event.event_end_time||event.end_time||"06:00";let ed=event.event_end_date||event.end_date||sd;if(!event.event_end_date&&!event.end_date&&et<=st){const d=dateAt(sd,"12:00");if(d){d.setDate(d.getDate()+1);ed=d.toISOString().slice(0,10)}}return dateAt(ed,et)}
  async function eligibleEvents(){
    const [events,checkins]=await Promise.all([store.list("events"),attendance.listCheckins()]);
    const {key,tg}=identity(), now=Date.now();
    return events.filter(event=>{
      const row=checkins.find(r=>String(r.event_id)===String(event.id)&&(String(r.user_key||"")===key||(tg&&String(r.telegram_id||"")===tg)));
      if(!row||!row.checked_in_at)return false;
      const checked=new Date(row.checked_in_at).getTime(), end=eventEnd(event)?.getTime();
      return Number.isFinite(checked)&&now>=checked&&Number.isFinite(end)&&now<=end+12*60*60*1000;
    }).sort((a,b)=>`${b.event_date||""}T${b.event_time||""}`.localeCompare(`${a.event_date||""}T${a.event_time||""}`));
  }
  async function refreshButton(){
    const button=document.querySelector("[data-open-venue-review]"); if(!button)return;
    const rows=await eligibleEvents();
    button.hidden=!rows.length; button.disabled=!rows.length;
    button.title=rows.length?"Оставить отзыв о посещённом мероприятии":"Доступно после входа по QR и 12 часов после завершения";
  }
  async function openAllowed(event){
    const button=event.target.closest("[data-open-venue-review]"); if(!button)return;
    event.preventDefault(); event.stopImmediatePropagation();
    const rows=await eligibleEvents();
    if(!rows.length){toast("Отзывы доступны после входа по QR и ещё 12 часов после завершения мероприятия");return;}
    const select=document.getElementById("reviewEventSelect");
    if(select){select.innerHTML=rows.map(r=>`<option value="${esc(r.id)}">${esc(r.title||"Мероприятие BALI")} · ${esc(r.event_date||"")}</option>`).join(""); select.disabled=rows.length===1;}
    document.getElementById("venueReviewDialog")?.showModal();
  }
  async function submitPrivate(event){
    if(event.target.id!=="venueReviewForm")return;
    event.preventDefault(); event.stopImmediatePropagation();
    const form=event.target,data=Object.fromEntries(new FormData(form).entries()),eligible=await eligibleEvents();
    const selected=eligible.find(r=>String(r.id)===String(data.event_id));
    if(!selected){toast("Срок отправки отзыва истёк или посещение не подтверждено");document.getElementById("venueReviewDialog")?.close();return;}
    const p=game?.profile?.()||{};
    try{
      await store.save("reviews",{user_key:p.id||p.userKey||"",user_name:p.name||"Гость BALI",telegram:p.username||p.telegram||"",event_id:selected.id,event_title:selected.title||"",type:data.type||"event",rating:data.rating?Number(data.rating):null,message:String(data.message||"").trim(),status:"new",visibility:"admin_only",created_at:new Date().toISOString(),updated_at:new Date().toISOString()});
      form.reset(); document.getElementById("venueReviewDialog")?.close(); toast("Спасибо! Сообщение отправлено только администрации BALI"); await refreshButton();
    }catch(error){toast(error.message||"Не удалось отправить отзыв")}
  }
  document.addEventListener("click",openAllowed,true);
  document.addEventListener("submit",submitPrivate,true);
  ["bali:data-changed","bali:checkin-complete","bali:checkin-left","bali:beta4-changed"].forEach(n=>window.addEventListener(n,()=>setTimeout(refreshButton,0)));
  [0,200,700,1500].forEach(d=>setTimeout(refreshButton,d));
  window.BaliReviewEligibilityPrivate={eligibleEvents,refreshButton};
})();