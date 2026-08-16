(() => {
  const store = window.BaliStore;
  if (!store) return;

  const STORAGE_KEY = "bali_event_layouts_v1";
  const GLOBAL_HALL_KEY = "bali_hall_layout_config_v1";
  const deepCopy = (value) => JSON.parse(JSON.stringify(value));
  const nowIso = () => new Date().toISOString();
  const byEventDate = (a, b) => `${a.event_date || "9999-12-31"}T${a.event_time || "23:59"}`.localeCompare(`${b.event_date || "9999-12-31"}T${b.event_time || "23:59"}`);
  const tableNumber = (name = "") => String(name).replace(/^Стол\s*/i, "").replace(/^VIP\s*/i, "VIP ");
  let currentEvent = null;
  let currentLayout = null;

  function readAll() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch { return {}; }
  }

  function writeAll(value) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent("bali:event-layouts-changed"));
    window.dispatchEvent(new CustomEvent("bali:data-changed", { detail: { table: "event_layouts" } }));
    return value;
  }

  function globalBackground() {
    try { return JSON.parse(localStorage.getItem(GLOBAL_HALL_KEY)) || {}; }
    catch { return {}; }
  }

  function normalizeTable(eventId, table, index = 0) {
    const sourceId = String(table.id || `table-${index + 1}`).replace(/[^a-zA-Z0-9_-]/g, "-");
    return {
      ...table,
      id: sourceId.startsWith(`${eventId}-`) ? sourceId : `${eventId}-${sourceId}`,
      source_table_id: table.source_table_id || table.id || "",
      name: table.name || `Стол ${index + 1}`,
      seats: Number(table.seats || 4),
      x: Number(table.x ?? 50),
      y: Number(table.y ?? 50),
      shape: table.shape || "round",
      active: table.active !== false
    };
  }

  function normalizeLayout(event, layout = {}) {
    return {
      id: layout.id || `layout-${event.id}`,
      event_id: event.id,
      event_title: event.title,
      event_date: event.event_date,
      background: layout.background || "",
      background_name: layout.background_name || "",
      tables: (layout.tables || []).map((table, index) => normalizeTable(event.id, table, index)),
      ready: Boolean(layout.ready),
      created_at: layout.created_at || nowIso(),
      updated_at: layout.updated_at || nowIso()
    };
  }

  async function eventById(eventId) {
    const events = await store.list("events");
    return events.find((event) => event.id === eventId) || null;
  }

  async function eventByDate(date) {
    if (!date) return null;
    const events = (await store.list("events")).filter((event) => event.active !== false && event.event_date === date).sort(byEventDate);
    return events[0] || null;
  }

  function getByEventId(eventId) {
    const layout = readAll()[eventId];
    return layout ? deepCopy(layout) : null;
  }

  async function getForEvent(eventOrId) {
    const event = typeof eventOrId === "string" ? await eventById(eventOrId) : eventOrId;
    if (!event) return null;
    const saved = getByEventId(event.id);
    return saved ? normalizeLayout(event, saved) : null;
  }

  async function cloneBase(eventOrId, options = {}) {
    const event = typeof eventOrId === "string" ? await eventById(eventOrId) : eventOrId;
    if (!event) throw new Error("Мероприятие не найдено");
    const [tables, background] = await Promise.all([store.list("hall_tables"), Promise.resolve(globalBackground())]);
    return normalizeLayout(event, {
      background: options.background ?? background.image ?? "",
      background_name: options.background_name ?? background.imageName ?? "Базовая схема",
      tables: tables.filter((table) => table.active !== false),
      ready: Boolean((options.background ?? background.image) && tables.some((table) => table.active !== false))
    });
  }

  async function save(eventOrId, nextLayout) {
    const event = typeof eventOrId === "string" ? await eventById(eventOrId) : eventOrId;
    if (!event) throw new Error("Мероприятие не найдено");
    const layout = normalizeLayout(event, { ...nextLayout, updated_at: nowIso() });
    layout.ready = Boolean(layout.background && layout.tables.some((table) => table.active !== false));
    const all = readAll();
    all[event.id] = layout;
    writeAll(all);
    return deepCopy(layout);
  }

  function remove(eventId) {
    const all = readAll();
    delete all[eventId];
    writeAll(all);
  }

  async function ensureForExistingEvents() {
    const events = await store.list("events");
    const all = readAll();
    let changed = false;
    for (const event of events) {
      if (all[event.id]) continue;
      const cloned = await cloneBase(event);
      all[event.id] = cloned;
      changed = true;
    }
    if (changed) writeAll(all);
    return all;
  }

  async function availability(date, eventId = "") {
    const event = eventId ? await eventById(eventId) : await eventByDate(date);
    if (!event) return [];
    const layout = await getForEvent(event);
    if (!layout?.ready) return [];
    const bookings = await store.list("bookings", { filters: { booking_date: date || event.event_date } });
    const activeBookings = bookings.filter((booking) => !["cancelled", "completed"].includes(booking.status) && (booking.event_id === event.id || layout.tables.some((table) => table.id === booking.table_id)));
    return layout.tables.filter((table) => table.active !== false).map((table) => {
      const booking = activeBookings.find((item) => item.table_id === table.id);
      return { ...table, event_id: event.id, event_title: event.title, event_date: event.event_date, booking: booking || null, available: !booking };
    });
  }

  const originalGetAvailability = store.getAvailability.bind(store);
  store.getAvailability = async function(date, eventId = "") {
    const event = eventId ? await eventById(eventId) : await eventByDate(date);
    if (!event) return [];
    const layout = await getForEvent(event);
    if (!layout?.ready) return [];
    if (store.cloudEnabled && store.client) {
      try {
        const { data, error } = await store.client.rpc("get_event_layout_availability_beta", { p_event_id: event.id });
        if (!error && Array.isArray(data)) return data;
      } catch {}
    }
    return availability(date, event.id);
  };
  store.getBaseAvailability = originalGetAvailability;

  const originalCreateBooking = store.createBooking.bind(store);
  store.createBooking = async function(data) {
    const event = data.event_id ? await eventById(data.event_id) : await eventByDate(data.booking_date);
    if (!event) throw new Error("На выбранную дату мероприятие не опубликовано");
    const layout = await getForEvent(event);
    if (!layout?.ready) throw new Error("Рассадка для этого мероприятия ещё не опубликована");
    const table = layout.tables.find((item) => item.id === data.table_id && item.active !== false);
    if (!table) throw new Error("Стол не найден в схеме мероприятия");
    const occupied = (await availability(event.event_date, event.id)).find((item) => item.id === table.id && !item.available);
    if (occupied) throw new Error("Этот стол уже забронирован");

    if (store.cloudEnabled && store.client) {
      try {
        const { data: booking, error } = await store.client.rpc("create_event_booking_beta", {
          p_event_id: event.id,
          p_table_id: table.id,
          p_booking_time: data.booking_time || event.event_time || "23:00",
          p_name: data.name || data.customer_name || "Гость",
          p_phone: data.phone || "",
          p_guests: Number(data.guests || 2),
          p_telegram: data.telegram || "",
          p_telegram_id: data.telegram_id || "",
          p_comment: data.comment || ""
        });
        if (!error && booking) return booking;
      } catch {}
    }

    const customer = await store.findOrCreateCustomer(data);
    return store.save("bookings", {
      booking_date: event.event_date,
      booking_time: data.booking_time || event.event_time || "23:00",
      event_id: event.id,
      event_title: event.title,
      layout_id: layout.id,
      table_id: table.id,
      table_name: table.name,
      customer_id: customer?.id || data.customer_id || null,
      customer_name: data.name || data.customer_name || customer?.name || "Гость",
      phone: data.phone || customer?.phone || "",
      telegram: data.telegram || customer?.telegram || "",
      guests: Number(data.guests || 2),
      status: data.status || "pending",
      comment: data.comment || "",
      created_at: nowIso()
    });
  };
  store.createBaseBooking = originalCreateBooking;

  function injectGuestStyles() {
    if (document.getElementById("eventLayoutsGuestStyle")) return;
    const style = document.createElement("style");
    style.id = "eventLayoutsGuestStyle";
    style.textContent = `.event-card-clean{overflow:hidden}.event-card-clean .poster-image-clean{position:relative;aspect-ratio:4/5;overflow:hidden;background:linear-gradient(145deg,#262b27,#0b0d0c)}.event-card-clean .poster-image-clean img{width:100%;height:100%;object-fit:cover;display:block}.event-card-clean .poster-image-placeholder{display:grid;place-items:center;height:100%;color:rgba(255,255,255,.4);font:600 22px Unbounded}.event-card-clean .poster-info{position:relative;padding:15px 14px 16px;background:#111413}.event-card-clean .poster-info span{color:var(--lime);font-size:9px;font-weight:900}.event-card-clean .poster-info h3{margin:7px 0 5px}.event-card-clean .poster-info p{display:-webkit-box;overflow:hidden;-webkit-line-clamp:2;-webkit-box-orient:vertical}.event-card-clean .poster-share{position:static;width:100%;margin-top:11px}.booking-event-context{display:grid;gap:4px;margin:10px 0 0;padding:12px 14px;border:1px solid rgba(200,255,61,.18);border-radius:15px;background:rgba(200,255,61,.06)}.booking-event-context span{color:var(--muted);font-size:9px;letter-spacing:.09em}.booking-event-context strong{color:var(--lime)}.hall-map.event-layout-empty{display:grid;place-items:center;text-align:center;padding:25px;color:var(--muted);font-size:12px;line-height:1.55}.hall-map.event-layout-empty::before,.hall-map.event-layout-empty::after{display:none}`;
    document.head.appendChild(style);
  }

  function guestRenderEvents() {
    if (!window.state || !document.getElementById("eventTrack")) return;
    const points = window.BaliPoints;
    const settings = points?.settings?.() || { eventShare: 0 };
    const used = points?.actions?.() || {};
    const events = [...state.events].sort(byEventDate);
    state.events = events;
    $("#eventCount").textContent = `${events.length} событий`;
    $("#eventTrack").innerHTML = events.length ? events.map((event) => {
      const claimed = Boolean(used[`event-share-${event.id}`]);
      return `<article class="poster event-card-clean" data-event="${event.id}"><div class="poster-image-clean">${event.image_url ? `<img src="${esc(event.image_url)}" alt="${esc(event.title)}"/>` : '<div class="poster-image-placeholder">BALI</div>'}</div><div class="poster-info"><span>${formatDate(event.event_date)} · ${esc(event.event_time || "23:00")}</span><h3>${esc(event.title)}</h3><p>${esc(event.description || "Клубная ночь BALI")}</p>${points ? `<button class="poster-share ${claimed ? "claimed" : ""}" type="button" data-event-share="${event.id}">${claimed ? "✓ Баллы получены" : `Поделиться · +${settings.eventShare}`}</button>` : ""}</div></article>`;
    }).join("") : '<div class="empty-card">Новые афиши скоро появятся</div>';
  }

  async function guestLoadAvailability() {
    const dateInput = document.getElementById("bookingDate");
    const date = dateInput?.value || "";
    if (!date) {
      currentEvent = null;
      currentLayout = null;
      state.availability = [];
      guestRenderHall();
      return;
    }
    currentEvent = await eventByDate(date);
    currentLayout = currentEvent ? await getForEvent(currentEvent) : null;
    state.availability = currentEvent ? await availability(date, currentEvent.id) : [];
    state.availability.sort((a, b) => String(a.name).localeCompare(String(b.name), "ru", { numeric: true }));
    if (state.selectedTable && !state.availability.find((table) => table.id === state.selectedTable && table.available)) state.selectedTable = null;
    guestRenderHall();
  }

  function guestRenderHall() {
    const hall = document.getElementById("hallMap");
    if (!hall || !window.state) return;
    let context = document.getElementById("bookingEventContext");
    if (!context) {
      hall.insertAdjacentHTML("afterend", '<div class="booking-event-context" id="bookingEventContext"></div>');
      context = document.getElementById("bookingEventContext");
    }
    hall.classList.remove("event-layout-empty", "has-background");
    hall.style.removeProperty("background-image");
    hall.style.removeProperty("background-size");
    hall.style.removeProperty("background-position");
    hall.style.removeProperty("background-repeat");

    if (!document.getElementById("bookingDate")?.value) {
      hall.classList.add("event-layout-empty");
      hall.innerHTML = "Сначала выберите дату мероприятия — после этого появится индивидуальная схема рассадки.";
      context.innerHTML = '<span>МЕРОПРИЯТИЕ</span><strong>Дата ещё не выбрана</strong>';
      $("#selectedTableText").textContent = "Сначала выберите дату";
      $("#selectedTableId").value = "";
      return;
    }
    if (!currentEvent) {
      hall.classList.add("event-layout-empty");
      hall.innerHTML = "На выбранную дату опубликованного мероприятия пока нет.";
      context.innerHTML = '<span>МЕРОПРИЯТИЕ</span><strong>Не опубликовано</strong>';
      $("#selectedTableText").textContent = "Выберите другую дату";
      $("#selectedTableId").value = "";
      return;
    }
    if (!currentLayout?.ready) {
      hall.classList.add("event-layout-empty");
      hall.innerHTML = "Рассадка для этого мероприятия ещё готовится.";
      context.innerHTML = `<span>${formatDate(currentEvent.event_date).toUpperCase()}</span><strong>${esc(currentEvent.title)}</strong>`;
      $("#selectedTableText").textContent = "Схема ещё не опубликована";
      $("#selectedTableId").value = "";
      return;
    }

    if (currentLayout.background) {
      const safe = String(currentLayout.background).replace(/\\/g, "\\\\").replace(/'/g, "%27");
      hall.classList.add("has-background");
      hall.style.backgroundImage = `radial-gradient(circle at 50% 42%,rgba(200,255,61,.08),transparent 34%),linear-gradient(145deg,rgba(18,18,16,.83),rgba(8,10,9,.92)),url('${safe}')`;
      hall.style.backgroundSize = "auto,auto,contain";
      hall.style.backgroundPosition = "center,center,center";
      hall.style.backgroundRepeat = "no-repeat,no-repeat,no-repeat";
    }
    hall.innerHTML = state.availability.map((table) => `<button type="button" class="guest-table ${esc(table.shape || "round")} ${table.available ? "free" : "booked"} ${state.selectedTable === table.id ? "selected" : ""}" style="left:${Number(table.x)}%;top:${Number(table.y)}%" data-table="${table.id}" ${table.available ? "" : "disabled"}><b>${esc(tableNumber(table.name))}</b><small>${table.available ? "свободен" : "занят"}</small></button>`).join("");
    context.innerHTML = `<span>${formatDate(currentEvent.event_date).toUpperCase()} · ${esc(currentEvent.event_time || "23:00")}</span><strong>${esc(currentEvent.title)}</strong>`;
    const selected = state.availability.find((table) => table.id === state.selectedTable);
    $("#selectedTableText").textContent = selected ? `${selected.name} · ${selected.seats} мест · свободен` : "Выберите свободный стол на схеме";
    $("#selectedTableId").value = selected?.id || "";
  }

  window.BaliEventLayouts = { STORAGE_KEY, readAll, writeAll, getByEventId, getForEvent, eventById, eventByDate, cloneBase, save, remove, ensureForExistingEvents, availability, current: () => ({ event: currentEvent, layout: currentLayout }) };

  if (document.getElementById("hallMap") && window.state) {
    injectGuestStyles();
    renderEvents = guestRenderEvents;
    loadAvailability = guestLoadAvailability;
    renderHall = guestRenderHall;
    const dateInput = document.getElementById("bookingDate");
    if (dateInput) {
      dateInput.value = "";
      state.selectedTable = null;
    }
    ensureForExistingEvents().then(() => { guestRenderEvents(); guestLoadAvailability(); });
  }
})();