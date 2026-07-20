(() => {
  const store = window.BaliStore;
  if (!store) return;

  const RSVP_KEY = "bali_event_rsvps_v1";
  const CHECKIN_KEY = "bali_event_checkins_v1";
  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  };
  const digits = (value = "") => String(value).replace(/\D/g, "");
  const statusLabels = {
    interested: "Хочет пойти",
    going: "Придёт без брони",
    booked: "Забронировал стол",
    checked_in: "Уже посетил"
  };

  function injectStyles() {
    if (document.getElementById("eventAttendeesAdminStyle")) return;
    const style = document.createElement("style");
    style.id = "eventAttendeesAdminStyle";
    style.textContent = `.event-attendees-dialog{width:min(980px,calc(100% - 18px));max-height:92vh;padding:0;border:1px solid var(--line);border-radius:24px;background:#0a0c0c;color:#fff}.event-attendees-dialog::backdrop{background:rgba(0,0,0,.82);backdrop-filter:blur(8px)}.event-attendees-sheet{overflow:auto;max-height:92vh}.event-attendees-head{position:sticky;top:0;z-index:20;display:flex;justify-content:space-between;gap:14px;padding:17px 18px;border-bottom:1px solid var(--line);background:rgba(10,12,12,.95);backdrop-filter:blur(12px)}.event-attendees-head h2{margin:4px 0 0}.event-attendees-head button{width:40px;height:40px;border:1px solid var(--line);border-radius:50%;background:rgba(255,255,255,.04);color:#fff;font-size:23px}.event-attendees-body{display:grid;gap:15px;padding:16px}.event-attendees-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.event-attendees-summary article{padding:13px;border:1px solid var(--line);border-radius:16px;background:rgba(255,255,255,.025)}.event-attendees-summary span{display:block;color:var(--muted);font-size:8px;letter-spacing:.1em}.event-attendees-summary strong{display:block;margin-top:6px;color:var(--lime);font:600 22px Unbounded}.event-attendee-group{overflow:hidden;border:1px solid var(--line);border-radius:18px;background:rgba(255,255,255,.018)}.event-attendee-group>header{display:flex;justify-content:space-between;align-items:center;padding:13px 15px;border-bottom:1px solid var(--line);background:rgba(255,255,255,.025)}.event-attendee-group h3{margin:0}.event-attendee-group header span{color:var(--lime);font-weight:900}.event-attendee-list{display:grid}.event-attendee-row{display:grid;grid-template-columns:minmax(170px,1fr) minmax(140px,.8fr) minmax(130px,.7fr) minmax(120px,.6fr);gap:12px;align-items:center;padding:12px 15px;border-bottom:1px solid rgba(255,255,255,.06)}.event-attendee-row:last-child{border-bottom:0}.event-attendee-row strong,.event-attendee-row small{display:block}.event-attendee-row small{margin-top:3px;color:var(--muted);font-size:9px}.event-attendee-row .table-mark{color:var(--lime);font-weight:900}.event-attendee-empty{padding:16px;color:var(--muted);font-size:11px;text-align:center}.event-attendees-note{padding:12px 14px;border:1px solid rgba(200,255,61,.18);border-radius:15px;background:rgba(200,255,61,.06);color:var(--muted);font-size:10px;line-height:1.55}@media(max-width:760px){.event-attendees-summary{grid-template-columns:1fr 1fr}.event-attendee-row{grid-template-columns:1fr 1fr}.event-attendee-row>div:nth-child(3),.event-attendee-row>div:nth-child(4){grid-column:span 1}}@media(max-width:500px){.event-attendees-summary,.event-attendee-row{grid-template-columns:1fr}.event-attendee-row>div{grid-column:1!important}}`;
    document.head.appendChild(style);
  }

  function ensureDialog() {
    if (document.getElementById("eventAttendeesDialog")) return;
    document.body.insertAdjacentHTML("beforeend", '<dialog class="event-attendees-dialog" id="eventAttendeesDialog"><div class="event-attendees-sheet"><div class="event-attendees-head"><div><span class="eyebrow">ТОЛЬКО ДЛЯ АДМИНИСТРАТОРА</span><h2 id="eventAttendeesTitle">Гости мероприятия</h2></div><button type="button" data-attendees-close>×</button></div><div class="event-attendees-body" id="eventAttendeesBody"></div></div></dialog>');
    document.querySelector("[data-attendees-close]").addEventListener("click", () => document.getElementById("eventAttendeesDialog").close());
  }

  function customerIndexes(customers) {
    const byKey = new Map();
    const byId = new Map();
    customers.forEach((customer) => {
      if (customer.id) byId.set(customer.id, customer);
      [customer.client_key, customer.owner_key, customer.telegram_id ? `tg:${customer.telegram_id}` : "", customer.phone ? `phone:${digits(customer.phone)}` : ""].filter(Boolean).forEach((key) => byKey.set(String(key), customer));
    });
    return { byKey, byId };
  }

  function contactFrom(customer = {}, fallback = {}) {
    return {
      name: customer.name || fallback.name || fallback.customer_name || "Гость BALI",
      telegram: customer.telegram || (customer.telegram_username ? `@${customer.telegram_username}` : "") || fallback.telegram || (fallback.telegram_username ? `@${fallback.telegram_username}` : "") || "—",
      phone: customer.phone || fallback.phone || "—",
      telegram_id: customer.telegram_id || fallback.telegram_id || ""
    };
  }

  function bookingIdentity(booking) {
    return String(booking.owner_key || booking.client_key || (booking.telegram_id ? `tg:${booking.telegram_id}` : "") || booking.customer_id || booking.id || "");
  }

  async function collect(eventId) {
    const [customers, bookings] = await Promise.all([store.list("customers"), store.list("bookings")]);
    const indexes = customerIndexes(customers);
    const rsvpMap = read(RSVP_KEY, {})?.[eventId] || {};
    const checkins = Object.values(read(CHECKIN_KEY, {})).filter((row) => row.event_id === eventId);
    const activeBookings = bookings.filter((booking) => booking.event_id === eventId && !["cancelled", "completed"].includes(booking.status));
    const bookedKeys = new Set(activeBookings.map(bookingIdentity).filter(Boolean));

    const rsvpRows = Object.values(rsvpMap).map((row) => {
      const customer = indexes.byKey.get(String(row.user_key || "")) || {};
      return { ...contactFrom(customer, row), status: row.status, updated_at: row.updated_at || "", user_key: String(row.user_key || "") };
    }).filter((row) => !bookedKeys.has(row.user_key));

    const bookedRows = activeBookings.map((booking) => {
      const key = bookingIdentity(booking);
      const customer = indexes.byId.get(booking.customer_id) || indexes.byKey.get(key) || {};
      return {
        ...contactFrom(customer, booking),
        status: "booked",
        booking_id: booking.id,
        guests: Number(booking.guests || 0),
        table_name: booking.table_name || booking.table_id || "Стол не указан",
        booking_time: booking.booking_time || "23:00",
        booking_status: booking.status || "pending"
      };
    });

    const checkedRows = checkins.map((row) => {
      const customer = indexes.byKey.get(String(row.user_key || "")) || {};
      return { ...contactFrom(customer, row), status: "checked_in", checked_in_at: row.checked_in_at || "", reward: Number(row.reward || 0) };
    });

    return {
      interested: rsvpRows.filter((row) => row.status === "interested"),
      going: rsvpRows.filter((row) => row.status === "going"),
      booked: bookedRows,
      checkedIn: checkedRows
    };
  }

  function attendeeRow(row, type) {
    const table = type === "booked" ? `<div><strong class="table-mark">${esc(row.table_name)}</strong><small>${Number(row.guests || 0)} гостей · ${esc(row.booking_time || "")}</small></div>` : `<div><strong>${esc(statusLabels[type] || type)}</strong><small>${row.updated_at ? new Date(row.updated_at).toLocaleString("ru-RU") : ""}</small></div>`;
    return `<div class="event-attendee-row"><div><strong>${esc(row.name)}</strong><small>${row.telegram_id ? `Telegram ID: ${esc(row.telegram_id)}` : "Профиль Mini App"}</small></div><div><strong>${esc(row.telegram)}</strong><small>Telegram</small></div><div><strong>${esc(row.phone)}</strong><small>Телефон</small></div>${table}</div>`;
  }

  function group(title, rows, type) {
    return `<section class="event-attendee-group"><header><h3>${title}</h3><span>${rows.length}</span></header><div class="event-attendee-list">${rows.length ? rows.map((row) => attendeeRow(row, type)).join("") : '<div class="event-attendee-empty">Пользователей в этой категории пока нет.</div>'}</div></section>`;
  }

  async function openAttendees(eventId) {
    const event = (await store.list("events")).find((item) => item.id === eventId);
    if (!event) return;
    const data = await collect(eventId);
    ensureDialog();
    document.getElementById("eventAttendeesTitle").textContent = `${event.title} · ${formatDate(event.event_date)}`;
    document.getElementById("eventAttendeesBody").innerHTML = `<div class="event-attendees-summary"><article><span>ХОТЯТ ПОЙТИ</span><strong>${data.interested.length}</strong></article><article><span>БЕЗ БРОНИ</span><strong>${data.going.length}</strong></article><article><span>ЗАБРОНИРОВАЛИ</span><strong>${data.booked.length}</strong></article><article><span>УЖЕ ПРИШЛИ</span><strong>${data.checkedIn.length}</strong></article></div><div class="event-attendees-note">Этот список доступен только в административной части. Гости без брони планируют клубный формат, танцпол и контактный бар. Брони столов считаются отдельно и содержат номер стола и количество гостей.</div>${group("Хочет пойти", data.interested, "interested")}${group("Придут без брони / контактный бар", data.going, "going")}${group("Забронировал стол", data.booked, "booked")}${group("Отметился по QR", data.checkedIn, "checked_in")}`;
    document.getElementById("eventAttendeesDialog").showModal();
  }

  async function decorate(root) {
    const events = await store.list("events");
    events.forEach((event) => {
      const card = root.querySelector(`[data-event-layout="${CSS.escape(event.id)}"]`)?.closest(".event-admin-card");
      const actions = card?.querySelector(".event-admin-actions");
      if (!actions || actions.querySelector(`[data-event-attendees="${CSS.escape(event.id)}"]`)) return;
      actions.insertAdjacentHTML("beforeend", `<button class="primary" type="button" data-event-attendees="${event.id}">Список гостей</button>`);
    });
    root.querySelectorAll("[data-event-attendees]").forEach((button) => button.addEventListener("click", () => openAttendees(button.dataset.eventAttendees)));
  }

  injectStyles();
  ensureDialog();
  const baseRenderEvents = renderEvents;
  renderEvents = async function(root) {
    await baseRenderEvents(root);
    await decorate(root);
  };
  window.BaliEventAttendeesAdmin = { collect, openAttendees };
  if (state.view === "events") render();
})();