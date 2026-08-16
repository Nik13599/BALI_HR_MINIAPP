(() => {
  if (window.__BALI_ADMIN_DASHBOARD_V12__) return;
  window.__BALI_ADMIN_DASHBOARD_V12__ = true;
  const attendance = window.BaliEventQrAttendance;
  const appUsers = window.BaliAppUsers;
  const points = window.BaliPoints;
  const digits = value => String(value || "").replace(/\D/g, "");
  const dateKey = value => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
    const y = date.getFullYear(), m = String(date.getMonth() + 1).padStart(2, "0"), d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };
  const todayKey = () => dateKey(new Date());
  const monthStart = value => `${String(value).slice(0,7)}-01`;

  function styles() {
    if (document.getElementById("adminDashboardV12Style")) return;
    const style = document.createElement("style");
    style.id = "adminDashboardV12Style";
    style.textContent = `.dashboard-metrics-v12{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.dashboard-metric-v12{padding:15px;border:1px solid var(--line);border-radius:18px;background:linear-gradient(145deg,rgba(255,255,255,.045),rgba(255,255,255,.018))}.dashboard-metric-v12 span{display:block;color:var(--muted);font-size:8px;letter-spacing:.09em}.dashboard-metric-v12 strong{display:block;margin-top:7px;color:var(--lime);font:600 24px Unbounded}.dashboard-metric-v12 em{display:block;margin-top:5px;color:var(--muted);font-size:9px;font-style:normal}.visitor-period-panel{display:grid;gap:13px}.visitor-period-controls{display:flex;align-items:end;gap:8px;flex-wrap:wrap}.visitor-period-controls label{display:grid;gap:5px;flex:1;min-width:130px;color:var(--muted);font-size:9px;font-weight:800}.visitor-period-controls input{width:100%;min-height:43px;padding:0 11px;border:1px solid var(--line);border-radius:12px;background:#ffffff08;color:#fff}.visitor-period-result{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.visitor-period-result article{padding:12px;border:1px solid var(--line);border-radius:14px;background:#ffffff04}.visitor-period-result span{display:block;color:var(--muted);font-size:8px}.visitor-period-result strong{display:block;margin-top:5px;color:var(--lime);font:600 19px Unbounded}.upcoming-event-bookings{display:grid;gap:10px}.upcoming-event-booking{padding:14px;border:1px solid var(--line);border-radius:17px;background:#ffffff04}.upcoming-event-booking header{display:flex;justify-content:space-between;align-items:start;gap:10px}.upcoming-event-booking h4{margin:2px 0 0;font-size:14px}.upcoming-event-booking time{color:var(--muted);font-size:9px}.upcoming-event-totals{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.upcoming-event-totals span{padding:6px 8px;border:1px solid var(--line);border-radius:999px;color:var(--muted);font-size:8px}.upcoming-event-totals b{color:var(--lime)}.upcoming-event-people{display:grid;gap:5px;margin-top:10px}.upcoming-event-person{display:flex;justify-content:space-between;gap:8px;padding-top:7px;border-top:1px solid rgba(255,255,255,.06);font-size:9px}.upcoming-event-person span{color:var(--muted)}@media(max-width:900px){.dashboard-metrics-v12{grid-template-columns:1fr 1fr}}@media(max-width:560px){.dashboard-metrics-v12,.visitor-period-result{grid-template-columns:1fr 1fr}.dashboard-metric-v12:last-child{grid-column:1/-1}.visitor-period-result article:last-child{grid-column:1/-1}}`;
    document.head.appendChild(style);
  }

  function aliases(row = {}, fallback = "") {
    const result = [];
    const userKey = row.user_key || row.userKey || row.ownerKey || row.code;
    if (userKey) result.push(`u:${String(userKey)}`);
    const tgId = row.telegram_id || row.telegramId;
    if (tgId) result.push(`tg:${String(tgId)}`);
    const phone = digits(row.phone);
    if (phone) result.push(`p:${phone}`);
    const username = String(row.username || row.telegram || "").toLowerCase().replace(/^@/, "").trim();
    if (username) result.push(`n:${username}`);
    if (!result.length && (row.id || fallback)) result.push(`i:${row.id || fallback}`);
    return result;
  }

  function uniquePeople(rows = []) {
    const parent = new Map();
    const find = value => { if (!parent.has(value)) parent.set(value, value); const p = parent.get(value); if (p !== value) parent.set(value, find(p)); return parent.get(value); };
    const union = (a,b) => { const ra=find(a),rb=find(b); if (ra!==rb) parent.set(rb,ra); };
    rows.forEach((row,index) => { const keys=aliases(row,index); keys.forEach(find); for(let i=1;i<keys.length;i++) union(keys[0],keys[i]); });
    return new Set([...parent.keys()].map(find)).size;
  }

  function eventCard(event, bookings) {
    const rows = bookings.filter(row => row.booking_date === event.event_date);
    const active = rows.filter(row => row.status !== "cancelled");
    const cancelled = rows.filter(row => row.status === "cancelled");
    const guests = active.reduce((sum,row) => sum + Number(row.guests || 0), 0);
    return `<article class="upcoming-event-booking"><header><div><time>${formatDate(event.event_date)} · ${esc(event.event_time || "23:00")}</time><h4>${esc(event.title)}</h4></div><button class="ghost compact" type="button" data-dashboard-open-bookings="${esc(event.event_date)}">Открыть</button></header><div class="upcoming-event-totals"><span><b>${active.length}</b> броней</span><span><b>${guests}</b> гостей</span><span>${cancelled.length} отмен</span></div>${active.length ? `<div class="upcoming-event-people">${active.slice(0,4).map(row => `<div class="upcoming-event-person"><strong>${esc(row.customer_name || row.name || "Гость")}</strong><span>${esc(row.booking_time || "23:00")} · ${Number(row.guests || 0)} чел.</span></div>`).join("")}</div>` : '<div class="empty" style="padding:12px 0 0">Бронирований пока нет</div>'}</article>`;
  }

  async function renderDashboardV12(root) {
    const [events, bookings, customers, checkins, registered] = await Promise.all([
      store.list("events"),
      store.list("bookings"),
      store.list("customers"),
      attendance?.listCheckins?.() || [],
      appUsers?.listAdmin?.() || []
    ]);
    const today = todayKey();
    const todayRows = checkins.filter(row => dateKey(row.checked_in_at) === today);
    const todayGuests = uniquePeople(todayRows);
    const accountRows = Object.values(points?.accounts?.() || {});
    const totalClients = uniquePeople([...registered, ...customers, ...checkins, ...accountRows]);
    const upcomingEvents = events.filter(event => event.active !== false && event.event_date >= today).sort((a,b) => `${a.event_date}T${a.event_time || "23:00"}`.localeCompare(`${b.event_date}T${b.event_time || "23:00"}`)).slice(0,2);
    const activeUpcomingBookings = bookings.filter(row => row.booking_date >= today && row.status !== "cancelled");
    const defaultFrom = state.dashboardVisitorRange?.from || monthStart(today);
    const defaultTo = state.dashboardVisitorRange?.to || today;

    root.innerHTML = `<div class="dashboard-metrics-v12"><article class="dashboard-metric-v12"><span>ГОСТЕЙ СЕГОДНЯ</span><strong>${todayGuests}</strong><em>подтвердили вход по QR</em></article><article class="dashboard-metric-v12"><span>КЛИЕНТОВ В БАЗЕ ВСЕГО</span><strong>${totalClients}</strong><em>уникальные пользователи приложения</em></article><article class="dashboard-metric-v12"><span>БЛИЖАЙШИЕ МЕРОПРИЯТИЯ</span><strong>${upcomingEvents.length}</strong><em>показываются два следующих</em></article><article class="dashboard-metric-v12"><span>БУДУЩИХ БРОНЕЙ</span><strong>${activeUpcomingBookings.length}</strong><em>${activeUpcomingBookings.reduce((s,row)=>s+Number(row.guests||0),0)} гостей</em></article></div><div class="dashboard-grid"><section class="panel"><div class="panel-head"><div><h3>Посетители за период</h3><small>Учитываются подтверждённые входы по QR-коду.</small></div></div><div class="panel-body visitor-period-panel"><div class="visitor-period-controls"><label><span>С</span><input id="dashboardVisitorsFrom" type="date" value="${esc(defaultFrom)}"></label><label><span>По</span><input id="dashboardVisitorsTo" type="date" value="${esc(defaultTo)}"></label><button class="primary compact" id="dashboardVisitorsApply" type="button">Показать</button></div><div class="visitor-period-result" id="dashboardVisitorResult"></div></div></section><section class="panel"><div class="panel-head"><div><h3>Ближайшие бронирования</h3><small>Два следующих мероприятия</small></div><button class="ghost" data-new="bookings">Добавить</button></div><div class="panel-body upcoming-event-bookings">${upcomingEvents.length ? upcomingEvents.map(event => eventCard(event, bookings)).join("") : '<div class="empty">Ближайших мероприятий нет</div>'}</div></section></div>`;

    const applyPeriod = () => {
      const from = root.querySelector("#dashboardVisitorsFrom")?.value || "";
      const to = root.querySelector("#dashboardVisitorsTo")?.value || "";
      state.dashboardVisitorRange = { from, to };
      const filtered = checkins.filter(row => { const key=dateKey(row.checked_in_at); return (!from || key>=from) && (!to || key<=to); });
      const guests = uniquePeople(filtered);
      const eventsCount = new Set(filtered.map(row => String(row.event_id || row.event_title || "")).filter(Boolean)).size;
      const scans = filtered.length;
      const target = root.querySelector("#dashboardVisitorResult");
      if (target) target.innerHTML = `<article><span>УНИКАЛЬНЫХ ГОСТЕЙ</span><strong>${guests}</strong></article><article><span>ПОСЕЩЕНИЙ</span><strong>${scans}</strong></article><article><span>МЕРОПРИЯТИЙ</span><strong>${eventsCount}</strong></article>`;
    };
    root.querySelector("#dashboardVisitorsApply")?.addEventListener("click", applyPeriod);
    root.querySelectorAll("[data-dashboard-open-bookings]").forEach(button => button.addEventListener("click", () => { const date=button.dataset.dashboardOpenBookings; state.bookingRange={from:date,to:date,preset:"custom"}; setView("bookings"); }));
    applyPeriod();
  }

  styles();
  window.renderDashboard = renderDashboardV12;
})();