(() => {
  if (window.__BALI_HOME_BOOKING_CONTROLS__) return;
  window.__BALI_HOME_BOOKING_CONTROLS__ = true;
  const store = window.BaliStore;
  const game = window.BaliBeta4Game;
  if (!store || !game) return;
  const COPY = "BALI — приложение ночного клуба и комьюнити людей, объединённых музыкой, любимыми диджеями, артистами и яркими вечеринками.";
  const esc = (v="") => String(v).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const fmt = v => v ? new Date(`${v}T12:00:00`).toLocaleDateString("ru-RU",{day:"2-digit",month:"long",year:"numeric"}) : "—";
  const toast = message => { const el=document.getElementById("toast"); if(!el)return; el.textContent=message; el.classList.add("show"); clearTimeout(toast.t); toast.t=setTimeout(()=>el.classList.remove("show"),2400); };

  function applyHomeCopy(){
    const hero=document.querySelector('[data-screen="home"] .hero');
    if(!hero)return;
    const h=hero.querySelector("h1");
    if(h) h.textContent="BALI";
    const p=hero.querySelector(":scope > p");
    if(p) p.textContent=COPY;
  }

  function myKeys(){ const p=game.profile(); return {p,keys:new Set(game.identityKeys(p))}; }
  async function myUpcoming(){
    const {p,keys}=myKeys();
    const today=new Date().toISOString().slice(0,10);
    return (await store.list("bookings")).filter(b=>String(b.booking_date||"")>=today&&!['cancelled','completed'].includes(b.status)&&(keys.has(String(b.owner_key||""))||String(b.telegram_id||"")===String(p.telegramId||"")||(p.phone&&String(b.phone||"").replace(/\D/g,"")===String(p.phone).replace(/\D/g,"")))).sort((a,b)=>`${a.booking_date||""}${a.booking_time||""}`.localeCompare(`${b.booking_date||""}${b.booking_time||""}`));
  }

  function ensureDialog(){
    if(document.getElementById("userBookingEditDialog"))return;
    document.body.insertAdjacentHTML("beforeend",`<dialog id="userBookingEditDialog" class="dialog"><div class="sheet"><button class="close" type="button" data-user-booking-close>×</button><div class="dialog-content"><span class="eyebrow">МОЁ БРОНИРОВАНИЕ</span><h2>Изменить бронь</h2><form class="booking" id="userBookingEditForm"><input name="id" type="hidden"><label><span>Дата</span><input name="booking_date" type="date" required></label><label><span>Время</span><input name="booking_time" type="time" required></label><label><span>Количество гостей</span><input name="guests" type="number" min="1" max="30" required></label><label><span>Комментарий</span><textarea name="comment"></textarea></label><button class="primary full">Сохранить изменения</button></form></div></div></dialog>`);
  }

  async function renderBooking(){
    const stats=document.getElementById("profileStats"); if(!stats)return;
    let card=document.getElementById("nextBookingCard");
    if(!card){card=document.createElement("section");card.id="nextBookingCard";card.className="card";stats.insertAdjacentElement("afterend",card)}
    const b=(await myUpcoming())[0];
    card.innerHTML=b?`<div class="card-head"><h3>Ближайшее бронирование</h3><span class="count">${esc(b.status||"активно")}</span></div><div class="compact-event"><div class="placeholder">${esc(String(b.table_name||b.table_id||"B").replace(/^Стол\s*/i,""))}</div><div><h3>${esc(b.event_title||b.table_name||b.table_id||"Бронирование BALI")}</h3><p>${fmt(b.booking_date)} · ${esc(b.booking_time||"23:00")} · ${Number(b.guests||0)} гостей</p></div></div><div class="actions" style="margin-top:10px"><button class="secondary" type="button" data-user-booking-edit="${esc(b.id)}">Изменить</button><button class="secondary" type="button" data-user-booking-cancel="${esc(b.id)}">Отменить бронь</button></div>`:`<div class="card-head"><h3>Ближайшее бронирование</h3></div><div class="empty">Активных бронирований пока нет</div>`;
  }

  async function openEdit(id){
    ensureDialog(); const b=(await store.list("bookings")).find(x=>String(x.id)===String(id)); if(!b)return;
    const f=document.getElementById("userBookingEditForm"); f.id.value=b.id; f.booking_date.value=b.booking_date||""; f.booking_time.value=b.booking_time||"23:00"; f.guests.value=Number(b.guests||2); f.comment.value=b.comment||""; document.getElementById("userBookingEditDialog").showModal();
  }
  async function cancel(id){
    if(!confirm("Отменить это бронирование?"))return;
    const b=(await store.list("bookings")).find(x=>String(x.id)===String(id)); if(!b)return;
    await store.save("bookings",{...b,status:"cancelled",cancelled_at:new Date().toISOString(),cancelled_by:"user"}); toast("Бронирование отменено"); renderBooking();
  }

  document.addEventListener("click",e=>{
    const edit=e.target.closest("[data-user-booking-edit]"); if(edit){e.preventDefault();openEdit(edit.dataset.userBookingEdit);return;}
    const cancelBtn=e.target.closest("[data-user-booking-cancel]"); if(cancelBtn){e.preventDefault();cancel(cancelBtn.dataset.userBookingCancel);return;}
    if(e.target.closest("[data-user-booking-close]")) document.getElementById("userBookingEditDialog")?.close();
  },true);
  document.addEventListener("submit",async e=>{
    if(e.target.id!=="userBookingEditForm")return; e.preventDefault(); const f=e.target; const rows=await store.list("bookings"); const b=rows.find(x=>String(x.id)===String(f.id.value)); if(!b)return;
    const conflict=rows.some(x=>String(x.id)!==String(b.id)&&String(x.booking_date)===String(f.booking_date.value)&&String(x.table_id)===String(b.table_id)&&!['cancelled','completed'].includes(x.status));
    if(conflict){toast("Этот стол уже занят на выбранную дату");return;}
    await store.save("bookings",{...b,booking_date:f.booking_date.value,booking_time:f.booking_time.value,guests:Number(f.guests.value||1),comment:f.comment.value,updated_at:new Date().toISOString(),updated_by:"user"}); document.getElementById("userBookingEditDialog")?.close(); toast("Бронирование обновлено"); renderBooking();
  },true);

  const observer=new MutationObserver(()=>requestAnimationFrame(()=>{applyHomeCopy();renderBooking();}));
  observer.observe(document.documentElement,{childList:true,subtree:true});
  ["bali:data-changed","bali:beta4-changed","bali:full-demo-ready","bali:full-demo-enhancements-ready"].forEach(n=>window.addEventListener(n,()=>{applyHomeCopy();renderBooking();}));
  applyHomeCopy(); renderBooking(); ensureDialog();
  window.BaliHomeBookingControls={applyHomeCopy,renderBooking};
})();