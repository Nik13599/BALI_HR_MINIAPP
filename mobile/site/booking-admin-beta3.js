(() => {
  const labels = { pending: "Ожидает", confirmed: "Подтверждено", seated: "Гости в клубе", completed: "Завершено", cancelled: "Отменено" };
  const dateKey = value => { const d=value?new Date(`${value}T12:00:00`):new Date(); const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0"); return `${y}-${m}-${day}`; };
  const todayIso = () => dateKey();
  const plusDays = (date, days) => { const next = new Date(`${date}T12:00:00`); next.setDate(next.getDate() + days); return dateKey(next.toISOString().slice(0,10)); };
  const plusMonths = (date, months) => { const next = new Date(`${date}T12:00:00`); next.setMonth(next.getMonth() + months); return dateKey(next.toISOString().slice(0,10)); };
  const byDateTime = (a, b) => `${a.booking_date || ""}T${a.booking_time || ""}`.localeCompare(`${b.booking_date || ""}T${b.booking_time || ""}`);

  function injectStyles() {
    if (document.getElementById("bookingAdminBeta3Style")) return;
    const style = document.createElement("style");
    style.id = "bookingAdminBeta3Style";
    style.textContent = `.booking-period-body{display:grid;gap:16px}.booking-period-toolbar{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}.booking-period-presets,.booking-period-dates{display:flex;gap:8px;flex-wrap:wrap;align-items:end}.booking-period-presets button.active{background:var(--lime);color:#090b08}.booking-period-dates label{display:grid;gap:5px;color:var(--muted);font-size:10px;font-weight:800}.booking-period-dates input,.booking-period-dates select{min-height:42px;padding:0 12px;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.045);color:var(--text)}.booking-period-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.booking-period-summary article{padding:15px;border:1px solid var(--line);border-radius:17px;background:rgba(255,255,255,.025)}.booking-period-summary span{display:block;color:var(--muted);font-size:9px;letter-spacing:.1em}.booking-period-summary strong{display:block;margin-top:7px;font:600 24px Unbounded;color:var(--lime)}#bookingDayGroups{display:grid;gap:14px}.booking-day-group{overflow:hidden;border:1px solid var(--line);border-radius:19px;background:rgba(255,255,255,.018)}.booking-day-group>header{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--line);background:rgba(255,255,255,.025)}.booking-day-group>header div{display:grid;gap:3px}.booking-day-group>header span,.booking-day-group>header small{color:var(--muted);font-size:10px}.booking-day-group>header strong{font:600 17px Unbounded}.booking-day-group>header h4{margin:0;font-size:12px}.booking-day-group>header b{color:var(--lime);font-size:12px}.booking-admin-list{display:grid}.booking-admin-card{display:grid;grid-template-columns:92px minmax(180px,1fr) auto auto;gap:12px;align-items:center;padding:13px 16px;border-bottom:1px solid rgba(255,255,255,.06)}.booking-admin-card:last-child{border-bottom:0}.booking-admin-time,.booking-admin-person{display:grid;gap:3px}.booking-admin-time strong{font:600 16px Unbounded}.booking-admin-time span,.booking-admin-person span,.booking-admin-person small{color:var(--muted);font-size:10px}.booking-admin-person strong{font-size:13px}.booking-admin-actions{display:flex;gap:6px}.danger-soft{color:#ff9696;border-color:rgba(255,112,112,.28)}@media(max-width:760px){.booking-period-summary{grid-template-columns:1fr 1fr}.booking-period-summary article:last-child{grid-column:1/-1}.booking-admin-card{grid-template-columns:70px 1fr auto}.booking-admin-card>.status{grid-column:2}.booking-admin-actions{grid-column:3;grid-row:1/3}.booking-period-dates{width:100%}.booking-period-dates label{flex:1}.booking-period-dates input,.booking-period-dates select{width:100%}}`;
    document.head.appendChild(style);
  }

  const summary = rows => ({
    bookings: rows.filter(row => row.status !== "cancelled").length,
    guests: rows.filter(row => row.status !== "cancelled").reduce((sum, row) => sum + Number(row.guests || 0), 0),
    cancelled: rows.filter(row => row.status === "cancelled").length
  });
  const grouped = rows => rows.reduce((acc, row) => { const key = row.booking_date || "Без даты"; (acc[key] ||= []).push(row); return acc; }, {});

  function bookingCard(row) {
    return `<article class="booking-admin-card"><div class="booking-admin-time"><strong>${esc(row.booking_time || "23:00")}</strong><span>${esc(row.table_name || row.table_id || "Стол не выбран")}</span></div><div class="booking-admin-person"><strong>${esc(row.customer_name || row.name || "Гость")}</strong><span>${esc(row.phone || "—")} · ${Number(row.guests || 0)} гостей</span>${row.comment ? `<small>${esc(row.comment)}</small>` : ""}</div><span class="status ${esc(row.status || "pending")}">${esc(labels[row.status] || row.status || "Ожидает")}</span><div class="booking-admin-actions"><button class="icon-btn" data-edit-booking="${row.id}" title="Редактировать">✎</button>${row.status !== "cancelled" ? `<button class="icon-btn danger-soft" data-cancel-booking="${row.id}" title="Отменить">×</button>` : ""}</div></article>`;
  }

  function dayGroups(rows, eventsByDate) {
    const groups = grouped(rows), dates = Object.keys(groups).sort();
    if (!dates.length) return '<div class="empty">За выбранный период бронирований нет</div>';
    return dates.map(date => {
      const dayRows = groups[date].sort(byDateTime), totals = summary(dayRows), eventNames = eventsByDate.get(date) || [];
      return `<section class="booking-day-group"><header><div><span>${formatDate(date)}</span><h4>${eventNames.length ? esc(eventNames.join(" · ")) : "Без привязанного мероприятия"}</h4><strong>${totals.guests} гостей</strong></div><div><b>${totals.bookings} броней</b>${totals.cancelled ? `<small>${totals.cancelled} отменено</small>` : '<small>Без отмен</small>'}</div></header><div class="booking-admin-list">${dayRows.map(bookingCard).join("")}</div></section>`;
    }).join("");
  }

  async function renderBookingManager(root) {
    const [rows, events] = await Promise.all([store.list("bookings"), store.list("events")]);
    const eventsByDate = new Map();
    events.forEach(event => { const names=eventsByDate.get(event.event_date)||[]; if(event.title&&!names.includes(event.title)) names.push(event.title); eventsByDate.set(event.event_date,names); });
    const today = todayIso();
    state.bookingRange ||= { from: today, to: today, preset: "today", status:"" };
    const filtered = rows.filter(row => (!state.bookingRange.from || row.booking_date >= state.bookingRange.from) && (!state.bookingRange.to || row.booking_date <= state.bookingRange.to) && (!state.bookingRange.status || row.status === state.bookingRange.status));
    const totals = summary(filtered);
    const buttons = [["today","Сегодня"],["tomorrow","Завтра"],["week","Неделя"],["1","Месяц"],["3","3 месяца"],["6","6 месяцев"]];
    root.innerHTML = `<section class="panel"><div class="panel-head"><div><h3>Бронирования по мероприятиям и дням</h3><small>Количество броней, гостей и отмен за выбранный период.</small></div></div><div class="panel-body booking-period-body"><div class="booking-period-toolbar"><div class="booking-period-presets">${buttons.map(([value,label])=>`<button class="ghost ${state.bookingRange.preset===value?"active":""}" data-booking-preset="${value}">${label}</button>`).join("")}</div><div class="booking-period-dates"><label><span>С</span><input id="bookingFrom" type="date" value="${state.bookingRange.from}"/></label><label><span>По</span><input id="bookingTo" type="date" value="${state.bookingRange.to}"/></label><label><span>Статус</span><select id="bookingStatus"><option value="">Все</option>${Object.entries(labels).map(([value,label])=>`<option value="${value}" ${state.bookingRange.status===value?"selected":""}>${label}</option>`).join("")}</select></label><button class="primary compact" id="applyBookingRange" type="button">Показать</button></div></div><div class="booking-period-summary"><article><span>БРОНЕЙ</span><strong>${totals.bookings}</strong></article><article><span>ГОСТЕЙ</span><strong>${totals.guests}</strong></article><article><span>ОТМЕНЕНО</span><strong>${totals.cancelled}</strong></article></div><div id="bookingDayGroups">${dayGroups(filtered,eventsByDate)}</div></div></section>`;
    root.querySelectorAll("[data-booking-preset]").forEach(button => button.addEventListener("click", () => {
      const value=button.dataset.bookingPreset, from=todayIso(), status=state.bookingRange.status||"";
      state.bookingRange=value==="today"?{from,to:from,preset:value,status}:value==="tomorrow"?{from:plusDays(from,1),to:plusDays(from,1),preset:value,status}:value==="week"?{from,to:plusDays(from,6),preset:value,status}:{from,to:plusMonths(from,Number(value)),preset:value,status};
      render();
    }));
    $("#applyBookingRange").addEventListener("click",()=>{state.bookingRange={from:$("#bookingFrom").value,to:$("#bookingTo").value,preset:"custom",status:$("#bookingStatus").value};render()});
    root.querySelectorAll("[data-edit-booking]").forEach(button=>button.addEventListener("click",async()=>{const all=await store.list("bookings");openEditor("bookings",all.find(row=>row.id===button.dataset.editBooking))}));
    root.querySelectorAll("[data-cancel-booking]").forEach(button=>button.addEventListener("click",async()=>{if(!confirm("Отменить это бронирование?"))return;const all=await store.list("bookings"),row=all.find(item=>item.id===button.dataset.cancelBooking);if(!row)return;await store.save("bookings",{...row,status:"cancelled",cancelled_at:new Date().toISOString(),cancelled_by:"admin"});toast("Бронирование отменено");render()}));
  }
  injectStyles();
  const baseRender=render;
  render=async function(){if(state.view!=="bookings")return baseRender();$("#pageTitle").textContent="Бронирования";$("#primaryAction").style.display="inline-flex";$("#primaryAction").textContent="Новая бронь";await renderBookingManager($("#content"))};
})();