(() => {
  if (window.__BALI_ADMIN_BOOKING_MANAGER__) return;
  window.__BALI_ADMIN_BOOKING_MANAGER__ = true;

  const store = window.BaliStore;
  const points = window.BaliPoints;
  const game = window.BaliBeta4Game;
  const attendance = window.BaliEventQrAttendance;
  const appUsers = window.BaliAppUsers;
  if (!store) return;

  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);
  const digits = value => String(value || "").replace(/\D/g, "");
  const norm = value => String(value || "").trim().toLowerCase().replace(/^@/, "");
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const write = (key, value) => { localStorage.setItem(key, JSON.stringify(value)); window.dispatchEvent(new CustomEvent("bali:data-changed")); return value; };
  const now = () => new Date().toISOString();
  const toast = message => {
    const node = document.getElementById("toast");
    if (!node) return;
    node.textContent = message;
    node.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove("show"), 2400);
  };

  function dateAt(value, time = "12:00") {
    const date = new Date(`${String(value || "").slice(0, 10)}T${time || "12:00"}:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  function addDays(value, days) {
    const date = dateAt(value);
    if (!date) return value;
    date.setDate(date.getDate() + days);
    return date.toISOString().slice(0, 10);
  }
  function addMinutes(time, minutes) {
    const [hours, mins] = String(time || "23:00").split(":").map(Number);
    const total = (hours * 60 + mins + minutes) % 1440;
    return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }
  function formatDate(value) {
    const date = dateAt(value);
    return date ? date.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }) : "Дата не указана";
  }
  function formatShortDate(value) {
    const date = dateAt(value);
    return date ? date.toLocaleDateString("ru-RU", { day: "numeric", month: "long" }) : "—";
  }
  function statusLabel(status) {
    return ({ pending: "Ожидает", confirmed: "Подтверждено", seated: "Гость пришёл", completed: "Завершено", cancelled: "Отменено" })[status] || status || "Ожидает";
  }

  function styles() {
    if (document.getElementById("bookingManagerStyle")) return;
    const style = document.createElement("style");
    style.id = "bookingManagerStyle";
    style.textContent = `
      .manager-groups{display:grid;gap:14px}.manager-party{overflow:hidden;border:1px solid var(--line);border-radius:18px;background:#0d1110}.manager-party-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:14px 16px;border-bottom:1px solid var(--line);background:linear-gradient(135deg,#c8ff3d12,#ffffff03)}.manager-party-head h4{margin:0;font:600 14px Unbounded}.manager-party-head p{margin:5px 0 0;color:var(--muted);font-size:9px;line-height:1.45}.manager-party-total{text-align:right}.manager-party-total strong{display:block;color:var(--lime);font:600 18px Unbounded}.manager-party-total span{color:var(--muted);font-size:8px}.manager-bookings{display:grid}.manager-booking{display:grid;grid-template-columns:112px minmax(0,1fr) auto;gap:13px;align-items:center;padding:13px 15px;border-bottom:1px solid #ffffff0d}.manager-booking:last-child{border-bottom:0}.manager-arrival strong{display:block;font:600 14px Unbounded}.manager-arrival small{display:block;margin-top:4px;color:var(--muted);font-size:8px}.manager-guest h4{margin:0;font-size:12px}.manager-guest p{margin:4px 0 0;color:var(--muted);font-size:9px;line-height:1.45}.manager-actions{display:flex;justify-content:flex-end;gap:6px;flex-wrap:wrap}.manager-actions button{min-height:34px;padding:0 9px;border:1px solid var(--line);border-radius:10px;background:#ffffff07;color:#fff;font-size:8px;font-weight:800}.manager-actions .confirm{border-color:#c8ff3d55;color:var(--lime)}.manager-actions .arrive{border-color:#71a7ff55;color:#9fc0ff}.manager-actions .cancel{border-color:#ff707055;color:#ff9d9d}.manager-empty{padding:28px 15px;color:var(--muted);text-align:center;font-size:10px}.manager-manual{margin-left:8px}.manager-dialog{width:min(680px,calc(100% - 18px));max-height:92dvh;padding:0;border:1px solid var(--line);border-radius:24px;background:#101413;color:#fff;overflow:hidden}.manager-dialog::backdrop{background:#000c;backdrop-filter:blur(5px)}.manager-sheet{max-height:92dvh;overflow:auto}.manager-dialog-head{position:sticky;top:0;z-index:2;display:flex;justify-content:space-between;align-items:center;padding:16px 18px;border-bottom:1px solid var(--line);background:#101413f5}.manager-dialog-head h3{font-size:18px}.manager-dialog-close{width:40px;height:40px;border:1px solid var(--line);border-radius:50%;background:#ffffff08;font-size:23px}.manager-profile{display:grid;gap:14px;padding:17px}.manager-contact-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.manager-contact{padding:12px;border:1px solid var(--line);border-radius:14px;background:#ffffff05}.manager-contact small{display:block;color:var(--muted);font-size:8px}.manager-contact strong,.manager-contact a{display:block;margin-top:5px;color:#fff;font-size:11px;text-decoration:none;word-break:break-word}.manager-profile-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.manager-profile-stats article{padding:11px 6px;border:1px solid var(--line);border-radius:13px;background:#ffffff05;text-align:center}.manager-profile-stats strong{display:block;color:var(--lime);font:600 16px Unbounded}.manager-profile-stats span{display:block;margin-top:5px;color:var(--muted);font-size:7px}.manager-history{display:grid;gap:7px}.manager-history article{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:9px;padding:11px;border:1px solid var(--line);border-radius:13px;background:#ffffff05}.manager-history h4{margin:0;font-size:10px}.manager-history p{margin:4px 0 0;color:var(--muted);font-size:8px}.manager-manual-form{display:grid;gap:11px}.manager-manual-form label{display:grid;gap:6px;color:var(--muted);font-size:9px;font-weight:800}.manager-manual-form select{width:100%;min-height:47px;padding:0 11px;border:1px solid var(--line);border-radius:13px;background:#171b19;color:#fff}@media(max-width:760px){.manager-booking{grid-template-columns:1fr}.manager-actions{justify-content:flex-start}.manager-party-head{grid-template-columns:1fr}.manager-party-total{text-align:left}.manager-contact-grid{grid-template-columns:1fr}.manager-profile-stats{grid-template-columns:repeat(2,1fr)}}`;
    document.head.appendChild(style);
  }

  function ensureDialogs() {
    if (!document.getElementById("managerGuestDialog")) {
      document.body.insertAdjacentHTML("beforeend", `
        <dialog class="manager-dialog" id="managerGuestDialog"><div class="manager-sheet"><div class="manager-dialog-head"><div><span class="eyebrow">КАРТОЧКА ГОСТЯ</span><h3 id="managerGuestTitle">Гость BALI</h3></div><button class="manager-dialog-close" type="button" data-manager-close>×</button></div><div class="manager-profile" id="managerGuestBody"></div></div></dialog>
        <dialog class="manager-dialog" id="managerManualDialog"><div class="manager-sheet"><div class="manager-dialog-head"><div><span class="eyebrow">БЕЗ QR-КОДА</span><h3>Ручное подтверждение прихода</h3></div><button class="manager-dialog-close" type="button" data-manager-close>×</button></div><div class="manager-profile"><form class="manager-manual-form" id="managerManualForm"><label><span>Вечеринка</span><select name="event_id" required></select></label><label><span>Бронирование / пользователь</span><select name="booking_id" required></select></label><button class="primary" type="submit">Подтвердить приход вручную</button><p style="margin:0;color:var(--muted);font-size:9px;line-height:1.55">Администратор подтверждает фактический вход гостя. Посещение и BALI-баллы начисляются так же, как после сканирования QR.</p></form></div></div></dialog>`);
    }
  }

  async function data() {
    const [bookings, events, customers, users, checkins] = await Promise.all([
      store.list("bookings"), store.list("events"), store.list("customers"), appUsers?.listAdmin?.() || [], attendance?.listCheckins?.() || []
    ]);
    return { bookings, events, customers, users, checkins };
  }

  function eventForBooking(booking, events) {
    return events.find(event => String(event.id) === String(booking.event_id || ""))
      || events.find(event => String(event.event_date || "") === String(booking.booking_date || ""))
      || null;
  }
  function groupKey(booking, event) { return event ? `event:${event.id}` : `date:${booking.booking_date}`; }
  function partyWindow(event, booking) {
    const startDate = event?.event_date || booking.booking_date;
    const startTime = event?.event_time || "23:00";
    const endDate = event?.event_end_date || event?.end_date || addDays(startDate, 1);
    const endTime = event?.event_end_time || event?.end_time || "06:00";
    return `с ${formatShortDate(startDate)} ${startTime} — по ${formatDate(endDate)} ${endTime}`;
  }
  function bookingArrival(booking) {
    const from = booking.booking_time || booking.arrival_from || "23:00";
    const to = booking.arrival_to || addMinutes(from, 60);
    return { from, to };
  }

  function groupedHtml(rows, events, options = {}) {
    const groups = new Map();
    [...rows].sort((a, b) => `${a.booking_date || ""}${a.booking_time || ""}`.localeCompare(`${b.booking_date || ""}${b.booking_time || ""}`)).forEach(booking => {
      const event = eventForBooking(booking, events);
      const key = groupKey(booking, event);
      if (!groups.has(key)) groups.set(key, { event, date: booking.booking_date, rows: [] });
      groups.get(key).rows.push(booking);
    });
    if (!groups.size) return '<div class="manager-empty">Ближайших бронирований пока нет</div>';
    return `<div class="manager-groups">${[...groups.values()].map(group => {
      const first = group.rows[0];
      const title = group.event?.title || `Бронирования на ${formatDate(group.date)}`;
      const guests = group.rows.reduce((sum, row) => sum + Number(row.guests || 0), 0);
      return `<section class="manager-party"><header class="manager-party-head"><div><h4>${esc(title)}</h4><p>${esc(partyWindow(group.event, first))}</p></div><div class="manager-party-total"><strong>${guests}</strong><span>${group.rows.length} броней · гостей</span></div></header><div class="manager-bookings">${group.rows.map(booking => bookingHtml(booking, group.event, options)).join("")}</div></section>`;
    }).join("")}</div>`;
  }

  function bookingHtml(booking, event, options) {
    const arrival = bookingArrival(booking);
    return `<article class="manager-booking" data-manager-booking-row="${esc(booking.id)}"><div class="manager-arrival"><strong>${esc(arrival.from)}–${esc(arrival.to)}</strong><small>ожидаемый приход</small></div><div class="manager-guest"><h4>${esc(booking.customer_name || booking.name || "Гость BALI")} · ${Number(booking.guests || 0)} чел.</h4><p>${esc(booking.table_name || booking.table_id || "Стол не указан")} · ${esc(booking.phone || "Телефон не указан")} · ${esc(statusLabel(booking.status))}</p></div><div class="manager-actions"><button type="button" data-manager-profile="${esc(booking.id)}">Профиль</button>${booking.status === "pending" ? `<button class="confirm" type="button" data-manager-confirm="${esc(booking.id)}">Подтвердить</button>` : ""}${!['seated','completed','cancelled'].includes(booking.status) ? `<button class="arrive" type="button" data-manager-arrive="${esc(booking.id)}">Пришёл</button>` : ""}${!['cancelled','completed'].includes(booking.status) ? `<button class="cancel" type="button" data-manager-cancel="${esc(booking.id)}">Отменить</button>` : ""}</div></article>`;
  }

  let applying = false;
  async function apply() {
    if (applying || document.getElementById("appView")?.classList.contains("hidden")) return;
    applying = true;
    try {
      const snapshot = await data();
      const today = new Date().toISOString().slice(0, 10);
      const upcoming = snapshot.bookings.filter(row => String(row.booking_date || "") >= today && !["cancelled", "completed"].includes(row.status));

      const dashboardPanel = [...document.querySelectorAll(".panel")].find(panel => /Ближайшие бронирования/i.test(panel.querySelector(".panel-head h3")?.textContent || ""));
      if (dashboardPanel) {
        const body = dashboardPanel.querySelector(".panel-body");
        const head = dashboardPanel.querySelector(".panel-head");
        if (head && !head.querySelector("[data-manager-manual-open]")) head.insertAdjacentHTML("beforeend", '<button class="ghost manager-manual" type="button" data-manager-manual-open>Ручное подтверждение</button>');
        if (body) {
          const signature = JSON.stringify(upcoming.map(row => [row.id, row.status, row.booking_date, row.booking_time, row.arrival_to, row.guests]));
          if (body.dataset.managerSignature !== signature) {
            body.dataset.managerSignature = signature;
            body.innerHTML = groupedHtml(upcoming, snapshot.events, { dashboard: true });
          }
        }
      }

      const bookingTable = document.getElementById("bookingTable");
      if (bookingTable) {
        const date = document.getElementById("bookingDateFilter")?.value || "";
        const status = document.getElementById("bookingStatusFilter")?.value || "";
        const filtered = snapshot.bookings.filter(row => (!date || row.booking_date === date) && (!status || row.status === status));
        const signature = JSON.stringify([date, status, ...filtered.map(row => [row.id, row.status, row.booking_date, row.booking_time, row.arrival_to, row.guests])]);
        if (bookingTable.dataset.managerSignature !== signature) {
          bookingTable.dataset.managerSignature = signature;
          bookingTable.innerHTML = groupedHtml(filtered, snapshot.events);
        }
      }
      await enhanceEditor(snapshot.events, snapshot.bookings);
    } finally { applying = false; }
  }

  let pendingBookingId = "";
  async function enhanceEditor(events, bookings) {
    const dialog = document.getElementById("editorDialog");
    if (!dialog?.open) return;
    const title = document.getElementById("editorTitle")?.textContent || "";
    const fields = document.getElementById("editorFields");
    if (!fields) return;
    if (/Бронирование стола/i.test(title)) {
      const row = bookings.find(item => String(item.id) === String(pendingBookingId)) || {};
      if (!fields.querySelector('[name="event_id"]')) {
        const dateLabel = fields.querySelector('[name="booking_date"]')?.closest("label");
        dateLabel?.insertAdjacentHTML("afterend", `<label><span>Вечеринка</span><select name="event_id"><option value="">Определить по дате</option>${events.map(event => `<option value="${esc(event.id)}" ${String(row.event_id || "") === String(event.id) ? "selected" : ""}>${esc(event.title)} · ${esc(formatShortDate(event.event_date))}</option>`).join("")}</select></label>`);
      }
      if (!fields.querySelector('[name="arrival_to"]')) {
        const timeLabel = fields.querySelector('[name="booking_time"]')?.closest("label");
        timeLabel?.insertAdjacentHTML("afterend", `<label><span>Ожидаем гостя до</span><input name="arrival_to" type="time" value="${esc(row.arrival_to || addMinutes(fields.querySelector('[name="booking_time"]')?.value || "23:00", 60))}"></label>`);
      }
    }
    if (/Афиша/i.test(title) || /Событие/i.test(title)) {
      if (!fields.querySelector('[name="event_end_date"]')) {
        const dateInput = fields.querySelector('[name="event_date"]');
        const dateLabel = dateInput?.closest("label");
        dateLabel?.insertAdjacentHTML("afterend", `<label><span>Дата окончания</span><input name="event_end_date" type="date" value="${esc(addDays(dateInput?.value || new Date().toISOString().slice(0, 10), 1))}"></label>`);
      }
      if (!fields.querySelector('[name="event_end_time"]')) {
        const timeLabel = fields.querySelector('[name="event_time"]')?.closest("label");
        timeLabel?.insertAdjacentHTML("afterend", '<label><span>Время окончания</span><input name="event_end_time" type="time" value="06:00"></label>');
      }
    }
  }

  function matchUser(booking, users, accounts, customer) {
    const phone = digits(booking.phone || customer?.phone);
    const telegram = norm(booking.telegram || customer?.telegram);
    const name = norm(booking.customer_name || customer?.name);
    const user = users.find(row => String(row.user_key) === String(booking.owner_key || booking.user_key || ""))
      || users.find(row => phone && digits(row.phone) === phone)
      || users.find(row => telegram && norm(row.username || row.telegram) === telegram)
      || users.find(row => name && norm(row.name) === name);
    const accountRows = Object.values(accounts || {});
    const account = accountRows.find(row => String(row.userKey) === String(user?.user_key || booking.owner_key || ""))
      || accountRows.find(row => phone && digits(row.phone) === phone)
      || accountRows.find(row => telegram && norm(row.telegram || row.username) === telegram)
      || accountRows.find(row => name && norm(row.name) === name);
    return { user, account };
  }

  async function openProfile(bookingId) {
    const snapshot = await data();
    const booking = snapshot.bookings.find(row => String(row.id) === String(bookingId));
    if (!booking) return toast("Бронирование не найдено");
    const customer = snapshot.customers.find(row => String(row.id) === String(booking.customer_id || ""))
      || snapshot.customers.find(row => digits(row.phone) && digits(row.phone) === digits(booking.phone));
    const { user, account } = matchUser(booking, snapshot.users, points?.accounts?.() || {}, customer);
    const history = snapshot.bookings.filter(row => String(row.customer_id || "") === String(customer?.id || "") || (digits(row.phone) && digits(row.phone) === digits(booking.phone))).sort((a, b) => String(b.booking_date || "").localeCompare(String(a.booking_date || "")));
    const visits = snapshot.checkins.filter(row => String(row.user_key || "") === String(user?.user_key || account?.userKey || "") || (digits(row.phone) && digits(row.phone) === digits(booking.phone)));
    document.getElementById("managerGuestTitle").textContent = booking.customer_name || customer?.name || user?.name || "Гость BALI";
    document.getElementById("managerGuestBody").innerHTML = `
      <div class="manager-contact-grid"><article class="manager-contact"><small>ТЕЛЕФОН</small><a href="tel:${esc(booking.phone || customer?.phone || user?.phone || "")}">${esc(booking.phone || customer?.phone || user?.phone || "Не указан")}</a></article><article class="manager-contact"><small>TELEGRAM</small><strong>${esc(booking.telegram || customer?.telegram || user?.username || account?.telegram || "Не указан")}</strong></article><article class="manager-contact"><small>БЛИЖАЙШАЯ ВЕЧЕРИНКА</small><strong>${esc(eventForBooking(booking, snapshot.events)?.title || formatDate(booking.booking_date))}</strong></article><article class="manager-contact"><small>ОЖИДАЕМЫЙ ПРИХОД</small><strong>${esc(bookingArrival(booking).from)}–${esc(bookingArrival(booking).to)}</strong></article></div>
      <div class="manager-profile-stats"><article><strong>${Number(account?.balance || 0)}</strong><span>BALI-БАЛЛЫ</span></article><article><strong>${Math.max(Number(customer?.visits || 0), Number(account?.visits || 0), visits.length)}</strong><span>ПОСЕЩЕНИЯ</span></article><article><strong>${history.length}</strong><span>БРОНИ</span></article><article><strong>${Number(account?.xp || 0)}</strong><span>XP</span></article></div>
      <div class="manager-actions" style="justify-content:flex-start"><button class="confirm" type="button" data-manager-confirm="${esc(booking.id)}">Подтвердить бронь</button><button class="arrive" type="button" data-manager-arrive="${esc(booking.id)}">Подтвердить приход</button><button class="cancel" type="button" data-manager-cancel="${esc(booking.id)}">Отменить бронь</button><button type="button" data-edit="bookings" data-id="${esc(booking.id)}" data-manager-edit-booking>Редактировать</button></div>
      <section><h3 style="font-size:13px;margin-bottom:9px">История бронирований</h3><div class="manager-history">${history.map(row => `<article><div><h4>${esc(eventForBooking(row, snapshot.events)?.title || formatDate(row.booking_date))}</h4><p>${esc(formatDate(row.booking_date))} · ${esc(row.booking_time || "23:00")} · ${Number(row.guests || 0)} гостей · ${esc(row.table_name || row.table_id || "—")}</p></div><span class="status ${esc(row.status)}">${esc(statusLabel(row.status))}</span></article>`).join("") || '<div class="manager-empty">Истории пока нет</div>'}</div></section>`;
    document.getElementById("managerGuestDialog").showModal();
  }

  async function updateBookingStatus(id, status) {
    const rows = await store.list("bookings");
    const booking = rows.find(row => String(row.id) === String(id));
    if (!booking) return toast("Бронирование не найдено");
    await store.save("bookings", { ...booking, status, updated_at: now() });
    toast(status === "confirmed" ? "Бронирование подтверждено" : "Бронирование отменено");
    document.getElementById("managerGuestDialog")?.close();
    await apply();
  }

  async function manualCheckIn(bookingId, selectedEventId = "") {
    const snapshot = await data();
    const booking = snapshot.bookings.find(row => String(row.id) === String(bookingId));
    if (!booking) return toast("Бронирование не найдено");
    const event = snapshot.events.find(row => String(row.id) === String(selectedEventId || booking.event_id || "")) || eventForBooking(booking, snapshot.events) || { id: `date-${booking.booking_date}`, title: `BALI · ${formatDate(booking.booking_date)}`, event_date: booking.booking_date, event_time: booking.booking_time };
    const customer = snapshot.customers.find(row => String(row.id) === String(booking.customer_id || "")) || snapshot.customers.find(row => digits(row.phone) === digits(booking.phone));
    const { user, account } = matchUser(booking, snapshot.users, points?.accounts?.() || {}, customer);
    const userKey = String(user?.user_key || account?.userKey || booking.owner_key || booking.user_key || (digits(booking.phone) ? `phone:${digits(booking.phone)}` : booking.customer_id || booking.id));
    const existing = snapshot.checkins.find(row => String(row.event_id) === String(event.id) && (String(row.user_key || "") === userKey || (digits(row.phone) && digits(row.phone) === digits(booking.phone))));
    if (existing) return toast("Приход этого гостя уже подтверждён");

    const reward = Number(points?.settings?.().attendance || 100);
    const xp = 250;
    const checkedAt = now();
    const row = {
      id: `checkin-${event.id}-${userKey.replace(/[^a-zA-Z0-9_-]/g, "-")}`,
      event_id: event.id,
      event_title: event.title,
      event_date: event.event_date || booking.booking_date,
      event_time: event.event_time || booking.booking_time || "23:00",
      user_key: userKey,
      telegram_id: user?.telegram_id || account?.telegramId || null,
      telegram: user?.username || account?.telegram || booking.telegram || customer?.telegram || "",
      name: booking.customer_name || customer?.name || user?.name || account?.name || "Гость BALI",
      phone: booking.phone || customer?.phone || user?.phone || account?.phone || "",
      checked_in_at: checkedAt,
      source: "admin_manual",
      reward,
      xp
    };

    const registry = read(attendance?.CHECKIN_KEY || "bali_event_checkins_v1", {});
    registry[row.id] = row;
    write(attendance?.CHECKIN_KEY || "bali_event_checkins_v1", registry);
    if (store.cloudEnabled && store.client) {
      try { await store.client.from("event_checkins").upsert(row, { onConflict: "event_id,user_key" }); } catch {}
    }

    if (points?.adjustAccount) {
      const result = points.adjustAccount({ ...(account || {}), ...(user || {}), userKey, phone: row.phone, telegram: row.telegram, name: row.name }, reward, `Ручное подтверждение посещения «${event.title}»`);
      const updated = result?.account;
      if (updated) points.saveAccount({ ...updated, visits: Number(updated.visits || 0) + 1, xp: Number(updated.xp || 0) + xp, lastVisitAt: checkedAt });
    }
    if (game?.identityKeys && game?.profile) {
      const activeKeys = new Set(game.identityKeys(game.profile()));
      const targetKeys = new Set([userKey, ...(user?.telegram_id ? [`tg:${user.telegram_id}`] : []), ...(row.phone ? [`phone:${digits(row.phone)}`] : [])]);
      if ([...targetKeys].some(key => activeKeys.has(key))) game.saveProfile({ visits: Number(game.profile().visits || 0) + 1, xp: Number(game.profile().xp || 0) + xp, lastVisitAt: checkedAt });
    }
    if (customer) await store.save("customers", { ...customer, visits: Number(customer.visits || 0) + 1, last_visit_at: checkedAt });
    await store.save("bookings", { ...booking, event_id: event.id, status: "seated", checked_in_at: checkedAt, checkin_source: "admin_manual" });
    const rsvps = read("bali_event_rsvps_v1", {});
    rsvps[event.id] ||= {};
    rsvps[event.id][userKey] = { user_key: userKey, name: row.name, telegram: row.telegram, status: "checked_in", attendance_mode: "admin_manual", updated_at: checkedAt };
    localStorage.setItem("bali_event_rsvps_v1", JSON.stringify(rsvps));
    document.getElementById("managerGuestDialog")?.close();
    document.getElementById("managerManualDialog")?.close();
    toast(`Приход подтверждён · +${reward} BALI-баллов`);
    await apply();
  }

  async function openManualDialog() {
    const snapshot = await data();
    const today = new Date().toISOString().slice(0, 10);
    const events = snapshot.events.filter(event => event.active !== false && String(event.event_date || "") >= addDays(today, -1)).sort((a, b) => String(a.event_date).localeCompare(String(b.event_date)));
    const bookings = snapshot.bookings.filter(row => !["cancelled", "completed", "seated"].includes(row.status) && String(row.booking_date || "") >= addDays(today, -1));
    const eventSelect = document.querySelector('#managerManualForm [name="event_id"]');
    const bookingSelect = document.querySelector('#managerManualForm [name="booking_id"]');
    eventSelect.innerHTML = events.map(event => `<option value="${esc(event.id)}">${esc(event.title)} · ${esc(formatDate(event.event_date))}</option>`).join("") || '<option value="">События не найдены</option>';
    const fillBookings = () => {
      const event = events.find(row => String(row.id) === String(eventSelect.value));
      const rows = bookings.filter(row => !event || String(row.event_id || "") === String(event.id) || (!row.event_id && row.booking_date === event.event_date));
      bookingSelect.innerHTML = rows.map(row => `<option value="${esc(row.id)}">${esc(row.customer_name || "Гость")} · ${Number(row.guests || 0)} чел. · ${esc(row.booking_time || "23:00")}</option>`).join("") || '<option value="">Подходящих бронирований нет</option>';
    };
    eventSelect.onchange = fillBookings;
    fillBookings();
    document.getElementById("managerManualDialog").showModal();
  }

  document.addEventListener("click", async event => {
    const edit = event.target.closest('[data-edit="bookings"]');
    if (edit) pendingBookingId = edit.dataset.id || "";
    if (event.target.closest('[data-new="bookings"], #primaryAction')) pendingBookingId = "";
    const profile = event.target.closest("[data-manager-profile]");
    if (profile) return openProfile(profile.dataset.managerProfile);
    const confirmButton = event.target.closest("[data-manager-confirm]");
    if (confirmButton) return updateBookingStatus(confirmButton.dataset.managerConfirm, "confirmed");
    const cancelButton = event.target.closest("[data-manager-cancel]");
    if (cancelButton && confirm("Отменить это бронирование?")) return updateBookingStatus(cancelButton.dataset.managerCancel, "cancelled");
    const arrive = event.target.closest("[data-manager-arrive]");
    if (arrive && confirm("Подтвердить фактический приход гостя без сканирования QR?")) return manualCheckIn(arrive.dataset.managerArrive);
    if (event.target.closest("[data-manager-manual-open]")) return openManualDialog();
    if (event.target.closest("[data-manager-close]")) return event.target.closest("dialog")?.close();
    if (event.target.closest("[data-manager-edit-booking]")) document.getElementById("managerGuestDialog")?.close();
  }, true);

  document.addEventListener("submit", event => {
    if (event.target.id !== "managerManualForm") return;
    event.preventDefault();
    const form = new FormData(event.target);
    manualCheckIn(form.get("booking_id"), form.get("event_id"));
  }, true);

  ["bookingDateFilter", "bookingStatusFilter"].forEach(id => document.addEventListener("change", event => { if (event.target.id === id) setTimeout(apply, 0); }, true));
  ["bali:data-changed", "bali:points-changed", "bali:app-users-changed"].forEach(name => window.addEventListener(name, () => setTimeout(apply, 0)));

  styles();
  ensureDialogs();
  let scheduled = false;
  new MutationObserver(records => {
    if (scheduled || !records.some(record => record.addedNodes.length || record.removedNodes.length)) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; apply(); });
  }).observe(document.getElementById("content"), { childList: true, subtree: true });
  [0, 250, 700, 1400].forEach(delay => setTimeout(apply, delay));
})();
