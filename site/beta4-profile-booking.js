(() => {
  const store = window.BaliStore;
  const game = window.BaliBeta4Game;
  const points = window.BaliPoints;
  if (!store || !game) return;

  const fmtDate = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString("ru-RU", { day:"2-digit", month:"long", year:"numeric" }) : "—";
  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" })[char]);
  const digits = value => String(value || "").replace(/\D/g, "");
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };

  function identityKeys() {
    const values = new Set();
    const profiles = [game.profile(), points?.profile?.() || {}, window.BALI_TELEGRAM_USER || {}];
    for (const profile of profiles) {
      [profile.id, profile.user_key, profile.userKey, profile.owner_key, profile.ownerKey, profile.code].filter(Boolean).forEach(value => values.add(String(value)));
      const telegramId = profile.telegram_id || profile.telegramId;
      if (telegramId) values.add(`tg:${telegramId}`);
      const phone = digits(profile.phone);
      if (phone) values.add(`phone:${phone}`);
    }
    return values;
  }

  function matchesIdentity(row, key = "") {
    const mine = identityKeys();
    const values = new Set([key, row?.user_key, row?.userKey, row?.owner_key, row?.ownerKey, row?.customer_id, row?.code].filter(Boolean).map(String));
    const telegramId = row?.telegram_id || row?.telegramId;
    if (telegramId) values.add(`tg:${telegramId}`);
    const phone = digits(row?.phone);
    if (phone) values.add(`phone:${phone}`);
    for (const value of values) if (mine.has(value)) return true;
    return false;
  }

  function eventEnd(event) {
    const date = event.event_end_date || event.event_date;
    const time = event.event_end_time || "06:00";
    if (!date) return 0;
    let endDate = date;
    if (!event.event_end_date && String(time) <= String(event.event_time || "23:00")) {
      const next = new Date(`${date}T12:00:00`);
      next.setDate(next.getDate() + 1);
      endDate = next.toISOString().slice(0, 10);
    }
    return new Date(`${endDate}T${time}:00`).getTime();
  }

  function card(row) {
    const sources = [...row.sources];
    const sourceText = sources.includes("booking") && sources.includes("interest")
      ? "Столик забронирован · Хочу пойти"
      : sources.includes("booking") ? `Столик забронирован${row.booking?.table_name ? ` · ${row.booking.table_name}` : ""}` : "Вы нажали «Хочу пойти»";
    return `<article class="compact-event"><div class="placeholder">${row.image_url ? `<img src="${esc(row.image_url)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">` : "B"}</div><div><h3>${esc(row.title || "Событие BALI")}</h3><p>${fmtDate(row.event_date)} · ${esc(String(row.event_time || "23:00").slice(0,5))}<br>${esc(sourceText)}</p></div><button type="button" data-event="${esc(row.id)}" aria-label="Открыть событие">→</button></article>`;
  }

  async function render() {
    const stats = document.getElementById("profileStats");
    if (!stats) return;
    let cardRoot = document.getElementById("nextBookingCard");
    if (!cardRoot) {
      cardRoot = document.createElement("section");
      cardRoot.id = "nextBookingCard";
      cardRoot.className = "card";
      const anchor = document.getElementById("profileV2Quick") || stats;
      anchor.insertAdjacentElement("afterend", cardRoot);
    }

    const [events, bookings] = await Promise.all([store.list("events"), store.list("bookings")]);
    const activeEvents = events.filter(event => event.active !== false && eventEnd(event) > Date.now());
    const eventMap = new Map(activeEvents.map(event => [String(event.id), { ...event, sources:new Set(), booking:null }]));

    for (const booking of bookings) {
      if (["cancelled","completed"].includes(String(booking.status || "").toLowerCase()) || !matchesIdentity(booking)) continue;
      let event = booking.event_id ? eventMap.get(String(booking.event_id)) : null;
      if (!event) event = activeEvents.find(item => String(item.event_date) === String(booking.booking_date));
      if (!event) continue;
      const target = eventMap.get(String(event.id));
      target.sources.add("booking");
      target.booking = booking;
    }

    const rsvps = read("bali_event_rsvps_v1", {});
    for (const [eventId, entries] of Object.entries(rsvps || {})) {
      const target = eventMap.get(String(eventId));
      if (!target || !entries || typeof entries !== "object") continue;
      const interested = Object.entries(entries).some(([key, row]) => row?.status === "interested" && matchesIdentity(row, key));
      if (interested) target.sources.add("interest");
    }

    const rows = [...eventMap.values()].filter(event => event.sources.size).sort((a,b) => `${a.event_date}${a.event_time || ""}`.localeCompare(`${b.event_date}${b.event_time || ""}`));
    cardRoot.innerHTML = `<div class="card-head"><h3>Ближайшие события</h3><span class="count">${rows.length}</span></div>${rows.length ? `<div class="profile-v2-list">${rows.slice(0,5).map(card).join("")}</div>` : '<div class="empty">Вы пока не забронировали столик и не отметили «Хочу пойти»</div>'}`;
  }

  window.addEventListener("bali:data-changed", render);
  window.addEventListener("bali:beta4-changed", render);
  window.addEventListener("bali:beta4-local", render);
  document.addEventListener("click", event => { if (event.target.closest('[data-page="profile"]')) setTimeout(render, 50); }, true);
  setTimeout(render, 0);
})();