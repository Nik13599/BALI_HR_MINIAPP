(() => {
  if (window.__BALI_FAST_EVENT_DIALOG__) return;
  window.__BALI_FAST_EVENT_DIALOG__ = true;

  const store = window.BaliStore;
  const game = window.BaliBeta4Game;
  if (!store || !game) return;

  const RSVP_KEY = "bali_event_rsvps_v1";
  const CHECKIN_KEY = "bali_event_checkins_v1";
  const EVENTS_KEY = "bali_events_v2";
  const BOOKINGS_KEY = "bali_bookings_v2";
  const TABLES_KEY = "bali_tables_v2";
  const LAYOUTS_KEY = "bali_event_layouts_v1";

  const state = { event:null, availability:[], selectedTable:"", loadingTables:false };
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const write = (key, value) => { localStorage.setItem(key, JSON.stringify(value)); return value; };
  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
  const fmtDate = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString("ru-RU", { day:"2-digit", month:"long", year:"numeric" }) : "—";
  const activeBooking = row => !["cancelled","completed"].includes(String(row?.status || "pending"));
  const profileKey = () => String(game.profile()?.id || game.profile()?.userKey || game.profile()?.code || "browser-user");
  const toast = message => {
    const node = document.getElementById("toast");
    if (!node) return;
    node.textContent = message;
    node.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove("show"), 2300);
  };

  function styles() {
    if (document.getElementById("fastEventDialogStyle")) return;
    const style = document.createElement("style");
    style.id = "fastEventDialogStyle";
    style.textContent = `
      #eventGoing{display:none!important}
      .fast-event-counts{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:12px 0}
      .fast-event-count{display:grid;gap:4px;padding:13px;border:1px solid var(--line);border-radius:15px;background:#ffffff05;text-align:left;color:#fff}
      .fast-event-count strong{font:600 27px Unbounded;color:var(--lime)}
      .fast-event-count span{font-size:9px;font-weight:900;letter-spacing:.07em}
      .fast-event-count small{color:var(--muted);font-size:8px;line-height:1.4}
      .fast-event-list-dialog{width:min(520px,calc(100% - 16px));max-height:88dvh;padding:0;border:1px solid var(--line);border-radius:22px;background:#0d100f;color:#fff;overflow:hidden}
      .fast-event-list-dialog::backdrop{background:#000d;backdrop-filter:blur(5px)}
      .fast-event-list-head{display:flex;justify-content:space-between;align-items:center;padding:15px;border-bottom:1px solid var(--line)}
      .fast-event-list-head h3{margin:4px 0 0;font-size:16px}.fast-event-list-close{width:40px;height:40px;border:1px solid var(--line);border-radius:50%;background:#ffffff08;color:#fff;font-size:23px}
      .fast-event-list{display:grid;gap:7px;max-height:68dvh;padding:13px;overflow:auto}.fast-event-person{display:flex;justify-content:space-between;gap:10px;padding:11px;border:1px solid var(--line);border-radius:13px;background:#ffffff05;font-size:10px}.fast-event-person b{color:var(--lime)}
      .fast-table-loading{padding:14px;border:1px dashed var(--line);border-radius:13px;color:var(--muted);font-size:9px;text-align:center}
      .fast-lineup{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}.fast-lineup span{padding:6px 8px;border:1px solid rgba(200,255,61,.2);border-radius:999px;background:rgba(200,255,61,.06);color:#dce6df;font-size:8px}
      @media(max-width:380px){.fast-event-counts{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function ensureListDialog() {
    if (document.getElementById("fastEventListDialog")) return;
    document.body.insertAdjacentHTML("beforeend", `<dialog class="fast-event-list-dialog" id="fastEventListDialog"><header class="fast-event-list-head"><div><span class="eyebrow" id="fastEventListEyebrow">МЕРОПРИЯТИЕ</span><h3 id="fastEventListTitle">Участники</h3></div><button class="fast-event-list-close" type="button" data-close-fast-event-list>×</button></header><div class="fast-event-list" id="fastEventList"></div></dialog>`);
  }

  function events() { return read(EVENTS_KEY, []); }
  function eventById(id) { return events().find(row => String(row.id) === String(id)); }
  function rsvps() { return read(RSVP_KEY, {}); }
  function eventRsvps(eventId) { return Object.values(rsvps()?.[eventId] || {}); }

  function hasIntent(row = {}) {
    if (row.interested === true) return true;
    if (row.interested === false) return false;
    return ["interested","going","booked","checked_in"].includes(String(row.status || ""));
  }
  function partySize(row = {}) {
    if (!hasIntent(row)) return 0;
    return Math.max(1, Number(row.party_size || row.partySize || row.guests || row.interest_count || 1));
  }
  function wantRows(eventId) {
    return eventRsvps(eventId).filter(hasIntent).map(row => ({ ...row, partySize:partySize(row) }));
  }
  function presentRows(eventId) {
    return Object.values(read(CHECKIN_KEY, {})).filter(row => String(row.event_id) === String(eventId) && !row.left_at && row.presence_status !== "left");
  }
  function wantTotal(eventId) { return wantRows(eventId).reduce((sum, row) => sum + row.partySize, 0); }
  function mine(eventId) { return rsvps()?.[eventId]?.[profileKey()] || null; }

  function renderCounts() {
    if (!state.event) return;
    const host = document.getElementById("eventSocial");
    if (!host) return;
    const wanted = wantTotal(state.event.id);
    const present = presentRows(state.event.id).length;
    host.innerHTML = `<div class="fast-event-counts"><button type="button" class="fast-event-count" data-fast-event-list="want"><strong>${wanted}</strong><span>ХОЧУТ ПОЙТИ</span><small>Нажмите, чтобы посмотреть список</small></button><button type="button" class="fast-event-count" data-fast-event-list="present"><strong>${present}</strong><span>УЖЕ НА МЕРОПРИЯТИИ</span><small>Вход подтверждён QR-кодом</small></button></div>`;
    const button = document.getElementById("eventInterested");
    const current = mine(state.event.id);
    const size = partySize(current || {});
    if (button) {
      button.hidden = false;
      button.classList.toggle("primary", hasIntent(current || {}));
      button.textContent = hasIntent(current || {}) ? (size > 1 ? `Вы +${size - 1} хотите пойти` : "Вы хотите пойти") : "Хочу пойти";
    }
    const going = document.getElementById("eventGoing");
    if (going) going.hidden = true;
  }

  function lineupHtml(event = {}) {
    const rows = Array.isArray(event.performers) ? event.performers : [];
    const fallback = [event.host_name, event.dj_name].filter(Boolean).map((name, index) => ({ name, role:index ? "DJ" : "Ведущий" }));
    const performers = rows.length ? rows : fallback;
    return performers.length ? `<div class="fast-lineup">${performers.map(row => `<span>${esc(row.role || row.type || "Участник")}: <b>${esc(row.name || row.title || "BALI")}</b></span>`).join("")}</div>` : "";
  }

  function computeAvailability(event) {
    const layouts = read(LAYOUTS_KEY, {});
    const layoutTables = layouts?.[event.id]?.tables;
    const tables = Array.isArray(layoutTables) && layoutTables.length ? layoutTables : read(TABLES_KEY, []);
    const bookings = read(BOOKINGS_KEY, []).filter(row => activeBooking(row) && (String(row.event_id || "") === String(event.id) || (!row.event_id && row.booking_date === event.event_date)));
    return tables.filter(row => row.active !== false).map(table => ({ ...table, available:!bookings.some(booking => String(booking.table_id) === String(table.id)) }));
  }

  function renderTables() {
    const root = document.getElementById("tableChoices");
    if (!root) return;
    if (state.loadingTables) {
      root.innerHTML = '<div class="fast-table-loading">Загружаем свободные столы…</div>';
      return;
    }
    root.innerHTML = state.availability.map(table => `<button type="button" class="table ${state.selectedTable === table.id ? "selected" : ""}" data-fast-table="${esc(table.id)}" ${table.available ? "" : "disabled"}><strong>${esc(table.name || table.id)}</strong><br>${Number(table.seats || 4)} мест<br>${table.available ? "свободен" : "занят"}</button>`).join("") || '<div class="empty">Схема столов ещё не настроена</div>';
    const input = document.querySelector('#bookingForm [name="table_id"]');
    if (input) input.value = state.selectedTable;
  }

  function loadTablesAfterOpen() {
    state.loadingTables = true;
    renderTables();
    requestAnimationFrame(() => setTimeout(() => {
      if (!state.event) return;
      state.availability = computeAvailability(state.event);
      state.loadingTables = false;
      renderTables();
    }, 0));
  }

  function openEvent(id) {
    const event = eventById(id);
    const dialog = document.getElementById("eventDialog");
    if (!event || !dialog) return;
    state.event = event;
    state.selectedTable = "";
    state.availability = [];

    const media = document.getElementById("eventDialogMedia");
    if (media) media.style.backgroundImage = event.image_url ? `url('${String(event.image_url).replace(/'/g, "%27")}')` : "";
    const date = document.getElementById("eventDialogDate");
    if (date) date.textContent = `${fmtDate(event.event_date)} · ${event.event_time || "23:00"}`;
    const title = document.getElementById("eventDialogTitle");
    if (title) title.textContent = event.title || "Мероприятие BALI";
    const description = document.getElementById("eventDialogDescription");
    if (description) description.textContent = event.details_description || event.description || "Подробности будут добавлены позднее.";

    const privilege = document.getElementById("eventPrivilege");
    if (privilege) {
      const vip = game.eventPrivilege?.(event.id);
      privilege.innerHTML = `${lineupHtml(event)}${vip ? `<div class="privilege"><strong>${esc(game.vip()?.plan?.name || "VIP")}</strong>: ${vip.freeEntry ? "бесплатный вход" : `${Number(vip.discount || 0)}% скидка`}</div>` : ""}`;
    }

    const form = document.getElementById("bookingForm");
    const profile = game.profile();
    if (form) {
      form.event_id.value = event.id;
      form.booking_date.value = event.event_date;
      form.booking_time.value = event.event_time || "23:00";
      form.name.value = profile.name || "";
      form.phone.value = profile.phone || "";
      if (form.telegram) form.telegram.value = profile.username || "";
    }

    renderCounts();
    loadTablesAfterOpen();
    if (!dialog.open) dialog.showModal();
    document.body.classList.add("bali-dialog-open");
    window.BaliFullDemoEvents?.decorateEvents?.();
  }

  function toggleInterest() {
    if (!state.event) return;
    const registry = rsvps();
    registry[state.event.id] ||= {};
    const key = profileKey();
    const current = registry[state.event.id][key] || {};
    const hasBooking = Boolean(current.booking_id || current.status === "booked" || Number(current.party_size || current.guests || 0) > 1);
    const nextIntent = hasBooking ? true : !hasIntent(current);
    registry[state.event.id][key] = {
      ...current,
      user_key:key,
      name:game.profile().name || "Гость BALI",
      interested:nextIntent,
      party_size:Math.max(1, Number(current.party_size || current.guests || 1)),
      companions:Math.max(0, Number(current.party_size || current.guests || 1) - 1),
      status:hasBooking ? "booked" : (nextIntent ? "interested" : "cancelled_interest"),
      attendance_mode:hasBooking ? "table_booking" : "interest",
      updated_at:new Date().toISOString()
    };
    write(RSVP_KEY, registry);
    window.dispatchEvent(new CustomEvent("bali:rsvp-changed", { detail:{ eventId:state.event.id } }));
    toast(hasBooking ? "Бронь уже учитывает вас и вашу компанию" : (nextIntent ? "Добавлено: хочу пойти" : "Отметка снята"));
    renderCounts();
  }

  async function submitBooking(form) {
    if (!state.event) return;
    const data = Object.fromEntries(new FormData(form).entries());
    if (!data.table_id) return toast("Выберите свободный стол");
    try {
      const selected = state.availability.find(row => String(row.id) === String(data.table_id));
      const booking = await store.createBooking(data);
      const profile = game.profile();
      await store.save("bookings", { ...booking, event_id:data.event_id, owner_key:profile.id, table_name:selected?.name || data.table_id });
      game.saveProfile({ phone:data.phone, name:data.name, username:data.telegram || profile.username });
      game.recordBooking(Number(data.guests || 2));

      const registry = rsvps();
      registry[data.event_id] ||= {};
      const key = profileKey();
      const partySizeValue = Math.max(1, Number(data.guests || 1));
      registry[data.event_id][key] = {
        ...(registry[data.event_id][key] || {}),
        user_key:key,
        name:data.name || profile.name || "Гость BALI",
        interested:true,
        party_size:partySizeValue,
        companions:partySizeValue - 1,
        status:"booked",
        attendance_mode:"table_booking",
        booking_id:booking.id,
        guests:partySizeValue,
        updated_at:new Date().toISOString()
      };
      write(RSVP_KEY, registry);
      window.dispatchEvent(new CustomEvent("bali:rsvp-changed", { detail:{ eventId:data.event_id } }));
      toast(partySizeValue > 1 ? `Стол забронирован: вы +${partySizeValue - 1}` : "Стол забронирован");
      state.selectedTable = "";
      state.availability = computeAvailability(state.event);
      renderTables();
      renderCounts();
    } catch (error) {
      toast(error.message || "Не удалось создать бронь");
    }
  }

  function openList(type) {
    if (!state.event) return;
    ensureListDialog();
    const rows = type === "present" ? presentRows(state.event.id) : wantRows(state.event.id);
    const title = document.getElementById("fastEventListTitle");
    const eyebrow = document.getElementById("fastEventListEyebrow");
    const root = document.getElementById("fastEventList");
    if (title) title.textContent = type === "present" ? "Уже на мероприятии" : "Хочу пойти";
    if (eyebrow) eyebrow.textContent = state.event.title || "МЕРОПРИЯТИЕ";
    if (root) root.innerHTML = rows.length ? rows.map(row => {
      const name = row.name || row.person?.name || "Гость BALI";
      const size = type === "present" ? 1 : partySize(row);
      return `<article class="fast-event-person"><span>${esc(name)}</span><b>${type === "present" ? "В BALI" : (size > 1 ? `+${size - 1}` : "1")}</b></article>`;
    }).join("") : `<div class="empty">${type === "present" ? "Пока никто не подтвердил вход по QR" : "Пока никто не отметил «Хочу пойти»"}</div>`;
    const dialog = document.getElementById("fastEventListDialog");
    if (dialog && !dialog.open) dialog.showModal();
  }

  document.addEventListener("click", event => {
    const eventCard = event.target.closest("[data-event]");
    if (eventCard && !event.target.closest("dialog")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openEvent(eventCard.dataset.event);
      return;
    }
    const interested = event.target.closest("#eventInterested");
    if (interested) {
      event.preventDefault();
      event.stopImmediatePropagation();
      toggleInterest();
      return;
    }
    const table = event.target.closest("[data-fast-table]");
    if (table && !table.disabled) {
      event.preventDefault();
      event.stopImmediatePropagation();
      state.selectedTable = table.dataset.fastTable;
      renderTables();
      return;
    }
    const list = event.target.closest("[data-fast-event-list]");
    if (list) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openList(list.dataset.fastEventList);
      return;
    }
    if (event.target.closest("[data-close-fast-event-list]")) {
      event.preventDefault();
      document.getElementById("fastEventListDialog")?.close();
    }
  }, true);

  document.addEventListener("submit", event => {
    if (event.target.id !== "bookingForm") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    submitBooking(event.target);
  }, true);

  const refreshCounts = event => {
    if (!state.event || !document.getElementById("eventDialog")?.open) return;
    const changedEventId = event?.detail?.eventId || event?.detail?.event?.id || "";
    if (changedEventId && String(changedEventId) !== String(state.event.id)) return;
    requestAnimationFrame(renderCounts);
  };
  ["bali:checkin-complete","bali:checkin-left","bali:rsvp-changed"].forEach(name => window.addEventListener(name, refreshCounts));

  styles();
  ensureListDialog();
  window.BaliFastEventDialog = { openEvent, renderCounts, wantRows, presentRows, wantTotal, computeAvailability };
})();