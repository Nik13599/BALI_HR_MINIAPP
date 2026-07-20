(() => {
  const points = window.BaliPoints;
  const store = window.BaliStore;
  if (!store) return;

  const RSVP_KEY = "bali_event_rsvps_v1";
  const QR_KEY = "bali_event_qr_v1";
  const CHECKIN_KEY = "bali_event_checkins_v1";
  let activeEventId = "";

  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  };
  const write = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent("bali:event-engagement-changed", { detail: { key } }));
    return value;
  };
  const currentUserKey = () => {
    const telegramId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if (telegramId) return `tg:${telegramId}`;
    return points?.profile?.()?.userKey || points?.profile?.()?.code || localStorage.getItem("bali_guest_booking_owner_v1") || "guest";
  };
  const currentUserName = () => {
    const user = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (user) return `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.username || "Гость BALI";
    return points?.profile?.()?.name || "Гость BALI";
  };

  function rsvps() { return read(RSVP_KEY, {}); }
  function qrCodes() { return read(QR_KEY, {}); }
  function checkins() { return read(CHECKIN_KEY, {}); }

  function userRsvp(eventId) {
    return rsvps()?.[eventId]?.[currentUserKey()] || null;
  }

  function setRsvp(eventId, status, extra = {}) {
    if (!eventId) return null;
    const all = rsvps();
    all[eventId] ||= {};
    const key = currentUserKey();
    if (!status) delete all[eventId][key];
    else all[eventId][key] = {
      ...(all[eventId][key] || {}),
      user_key: key,
      name: currentUserName(),
      status,
      updated_at: new Date().toISOString(),
      ...extra
    };
    write(RSVP_KEY, all);
    refreshVisibleEvent();
    return all[eventId][key] || null;
  }

  async function counts(eventId) {
    const eventRows = Object.values(rsvps()?.[eventId] || {});
    const bookings = (await store.list("bookings")).filter((booking) => booking.event_id === eventId && !["cancelled", "completed"].includes(booking.status));
    const bookedUsers = new Set(bookings.map((booking) => booking.owner_key || booking.client_key || booking.telegram_id || booking.customer_id || booking.id));
    return {
      interested: eventRows.filter((row) => row.status === "interested").length,
      going: eventRows.filter((row) => row.status === "going").length,
      booked: bookedUsers.size,
      bookedGuests: bookings.reduce((sum, booking) => sum + Number(booking.guests || 0), 0),
      bookedTables: bookings.length,
      checkedIn: Object.values(checkins()).filter((row) => row.event_id === eventId).length
    };
  }

  function ensureQr(event, reward = null) {
    const all = qrCodes();
    if (!all[event.id]) {
      const token = Array.from(crypto.getRandomValues(new Uint8Array(8))).map((byte) => byte.toString(16).padStart(2, "0")).join("");
      all[event.id] = {
        event_id: event.id,
        event_title: event.title,
        event_date: event.event_date,
        token,
        reward: Number(reward ?? points?.settings?.()?.attendance ?? 100),
        created_at: new Date().toISOString()
      };
      write(QR_KEY, all);
    }
    return all[event.id];
  }

  function qrDeepLink(event, config = ensureQr(event)) {
    const username = String(window.BALI_CONFIG?.telegramUsername || "BALI_MINSK").replace(/^@/, "");
    const payload = `att_${event.id}_${config.token}`;
    return `https://t.me/${username}?startapp=${encodeURIComponent(payload)}`;
  }

  function parseAttendancePayload() {
    const telegramPayload = window.Telegram?.WebApp?.initDataUnsafe?.start_param || "";
    const params = new URLSearchParams(location.search);
    const raw = telegramPayload || params.get("startapp") || params.get("tgWebAppStartParam") || "";
    if (!raw.startsWith("att_")) return null;
    const body = raw.slice(4);
    const splitAt = body.lastIndexOf("_");
    if (splitAt < 1) return null;
    return { eventId: body.slice(0, splitAt), token: body.slice(splitAt + 1) };
  }

  async function processAttendancePayload() {
    const payload = parseAttendancePayload();
    if (!payload) return;
    const events = await store.list("events");
    const event = events.find((item) => item.id === payload.eventId);
    if (!event) return toast("Мероприятие для QR-кода не найдено");
    const config = qrCodes()[event.id] || { token: payload.token, reward: Number(points?.settings?.()?.attendance || 100) };
    if (config.token !== payload.token) return toast("QR-код мероприятия недействителен");
    const key = `${event.id}:${currentUserKey()}`;
    const rows = checkins();
    if (rows[key]) return toast("Посещение этого мероприятия уже отмечено");

    const amount = Number(config.reward || points?.settings?.()?.attendance || 100);
    const actionKey = `event-attendance-${event.id}-${currentUserKey()}`;
    const added = points?.add?.("attendance", amount, `Посещение «${event.title}»`, actionKey);
    if (points && !added) return toast("Баллы за это мероприятие уже начислены");

    rows[key] = {
      id: key,
      event_id: event.id,
      event_title: event.title,
      user_key: currentUserKey(),
      name: currentUserName(),
      reward: amount,
      checked_in_at: new Date().toISOString()
    };
    write(CHECKIN_KEY, rows);
    setRsvp(event.id, "going", { checked_in: true });
    await incrementCustomerVisit();
    toast(`Посещение подтверждено · +${amount} BALI-баллов`);
  }

  async function incrementCustomerVisit() {
    const telegramId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    if (!telegramId) return;
    const customers = await store.list("customers");
    const customer = customers.find((item) => String(item.telegram_id || "") === String(telegramId));
    if (!customer) return;
    await store.save("customers", { ...customer, visits: Number(customer.visits || 0) + 1, last_visit_at: new Date().toISOString() });
  }

  const baseCreateBooking = store.createBooking.bind(store);
  store.createBooking = async function(data) {
    const booking = await baseCreateBooking(data);
    const eventId = booking?.event_id || data.event_id || (await window.BaliEventLayouts?.eventByDate?.(data.booking_date))?.id;
    if (eventId) setRsvp(eventId, "booked", { booking_id: booking?.id || "", guests: Number(data.guests || booking?.guests || 0) });
    return booking;
  };

  function injectStyles() {
    if (document.getElementById("eventEngagementStyle")) return;
    const style = document.createElement("style");
    style.id = "eventEngagementStyle";
    style.textContent = `.event-social-proof{display:grid;gap:11px;padding:17px;border:1px solid rgba(255,255,255,.08);border-radius:18px;background:rgba(255,255,255,.025)}.event-social-proof h3{margin:0}.event-counts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.event-counts article{padding:11px;border:1px solid rgba(255,255,255,.07);border-radius:14px;background:rgba(255,255,255,.025)}.event-counts span{display:block;color:var(--muted);font-size:8px;letter-spacing:.08em}.event-counts strong{display:block;margin-top:5px;color:var(--lime);font:600 18px Unbounded}.event-rsvp-actions{display:flex;gap:8px;flex-wrap:wrap}.event-rsvp-actions button{flex:1;min-width:145px}.event-rsvp-actions button.active{border-color:rgba(200,255,61,.65);background:rgba(200,255,61,.12);color:var(--lime)}.event-rsvp-note{color:var(--muted);font-size:10px;line-height:1.5}@media(max-width:520px){.event-counts{grid-template-columns:1fr}.event-rsvp-actions{display:grid}.event-rsvp-actions button{width:100%}}`;
    document.head.appendChild(style);
  }

  async function engagementHtml(eventId) {
    const event = (await store.list("events")).find((item) => item.id === eventId);
    if (!event) return "";
    ensureQr(event);
    const totals = await counts(eventId);
    const mine = userRsvp(eventId)?.status || "";
    return `<section class="event-social-proof" data-event-engagement="${eventId}"><h3>Кто собирается в BALI</h3><div class="event-counts"><article><span>ХОТЯТ ПОЙТИ</span><strong>${totals.interested}</strong></article><article><span>ТОЧНО ПРИДУТ</span><strong>${totals.going}</strong></article><article><span>ЗАБРОНИРОВАЛИ</span><strong>${totals.bookedGuests || totals.booked}</strong></article></div><div class="event-rsvp-actions"><button class="secondary ${mine === "interested" ? "active" : ""}" type="button" data-rsvp-status="interested">Хочу пойти</button><button class="primary ${mine === "going" ? "active" : ""}" type="button" data-rsvp-status="going">Я точно приду</button></div><small class="event-rsvp-note">Статистика доступна пользователям Mini App. После бронирования столика ваш статус автоматически учитывается как подтверждённое посещение.</small></section>`;
  }

  async function refreshVisibleEvent() {
    const body = document.querySelector("#eventDetailsSheet .event-details-body");
    if (!body || !activeEventId) return;
    body.querySelector("[data-event-engagement]")?.remove();
    const description = body.querySelector(".event-description");
    description?.insertAdjacentHTML("afterend", await engagementHtml(activeEventId));
    bindRsvpButtons(body);
  }

  function bindRsvpButtons(root = document) {
    root.querySelectorAll("[data-rsvp-status]").forEach((button) => button.addEventListener("click", () => {
      const current = userRsvp(activeEventId)?.status || "";
      const next = current === button.dataset.rsvpStatus ? "" : button.dataset.rsvpStatus;
      setRsvp(activeEventId, next);
      toast(next === "interested" ? "Добавлено: хочу пойти" : next === "going" ? "Добавлено: точно приду" : "Статус отменён");
    }));
  }

  injectStyles();
  document.getElementById("eventTrack")?.addEventListener("click", (event) => {
    const poster = event.target.closest("[data-event]");
    if (poster && !event.target.closest("[data-event-share]")) activeEventId = poster.dataset.event;
  }, true);

  const observer = new MutationObserver(() => {
    if (document.querySelector("#eventDetailsSheet .event-details-body") && activeEventId && !document.querySelector("#eventDetailsSheet [data-event-engagement]")) refreshVisibleEvent();
  });
  observer.observe(document.body, { subtree: true, childList: true });

  window.BaliEventEngagement = { RSVP_KEY, QR_KEY, CHECKIN_KEY, rsvps, qrCodes, checkins, userRsvp, setRsvp, counts, ensureQr, qrDeepLink, processAttendancePayload, currentUserKey };
  window.addEventListener("bali:event-engagement-changed", refreshVisibleEvent);
  processAttendancePayload().catch((error) => toast(error.message || "Не удалось подтвердить посещение"));
})();