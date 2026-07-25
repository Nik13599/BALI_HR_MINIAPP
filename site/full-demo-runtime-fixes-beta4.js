(() => {
  if (window.__BALI_FULL_DEMO_RUNTIME_FIXES__) return;
  window.__BALI_FULL_DEMO_RUNTIME_FIXES__ = true;

  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const pad = value => String(value).padStart(2, "0");
  const localDate = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const addDays = (value, days) => { const date = new Date(`${value}T12:00:00`); date.setDate(date.getDate() + days); return localDate(date); };
  const minutes = value => { const [hours, mins] = String(value || "00:00").split(":").map(Number); return (hours || 0) * 60 + (mins || 0); };

  function eventStart(event = {}) {
    return new Date(`${event.event_date || localDate()}T${event.event_time || "23:00"}:00`);
  }

  function eventEnd(event = {}) {
    if (event.end_at || event.event_end_at) return new Date(event.end_at || event.event_end_at);
    const startTime = event.event_time || "23:00";
    const endTime = event.event_end_time || event.end_time || "06:00";
    let endDate = event.event_end_date || event.end_date || event.event_date || localDate();
    if (!event.event_end_date && !event.end_date && minutes(endTime) <= minutes(startTime)) endDate = addDays(endDate, 1);
    return new Date(`${endDate}T${endTime}:00`);
  }

  function isUpcoming(event) {
    return event?.active !== false && eventEnd(event).getTime() >= Date.now();
  }

  function isToday(event) {
    const current = new Date();
    return event?.event_date === localDate(current) || (current >= eventStart(event) && current <= eventEnd(event));
  }

  function activeEvents() {
    const current = new Date();
    return read("bali_events_v2", []).filter(event => event.active !== false && current >= eventStart(event) && current <= eventEnd(event));
  }

  function normalizeDemoEvents() {
    const today = localDate();
    const markerKey = "bali_full_demo_event_day_v3";
    const marker = localStorage.getItem(markerKey);
    const offsets = {"event-demo-crown":0,"event-demo-tropic":5,"event-demo-football":9,"event-demo-black":14};
    const events = read("bali_events_v2", []);
    let changed = false;
    events.forEach(event => {
      if (!event.event_end_time) { event.event_end_time = "06:00"; changed = true; }
      if (marker !== today && Object.prototype.hasOwnProperty.call(offsets, event.id)) {
        event.event_date = addDays(today, offsets[event.id]);
        changed = true;
      }
    });
    if (changed) write("bali_events_v2", events);
    localStorage.setItem(markerKey, today);
  }

  function ensureDemoAttendees() {
    const events = read("bali_events_v2", []);
    const people = read("bali_social_people_v1", []);
    const extras = [
      {id:"demo-guest-7",name:"Елена"}, {id:"demo-guest-8",name:"Игорь"},
      {id:"demo-guest-9",name:"Виктория"}, {id:"demo-guest-10",name:"Алексей"},
      {id:"demo-guest-11",name:"Мария"}, {id:"demo-guest-12",name:"Денис"}
    ];
    const pool = [...people, ...extras];
    const desired = {"event-demo-crown":10,"event-demo-tropic":8,"event-demo-football":7,"event-demo-black":6};
    const all = read("bali_event_rsvps_v1", {});
    let changed = false;
    events.forEach(event => {
      all[event.id] ||= {};
      const target = desired[event.id] || Math.min(5, pool.length);
      for (let index = 0; index < Math.min(target, pool.length); index += 1) {
        const person = pool[index];
        const key = String(person.id || person.user_key || `demo-person-${index}`);
        if (!all[event.id][key]) {
          all[event.id][key] = {
            user_key:key,
            name:person.name || `Гость ${index + 1}`,
            interested:true,
            party_size:1,
            companions:0,
            status:"interested",
            attendance_mode:"interest",
            updated_at:new Date().toISOString()
          };
          changed = true;
        }
      }
    });
    if (changed) write("bali_event_rsvps_v1", all);
  }

  normalizeDemoEvents();
  ensureDemoAttendees();

  const originalStore = window.BaliStore;
  if (originalStore && !originalStore.__fullDemoPatched) {
    const originalList = originalStore.list.bind(originalStore);
    const patchedList = async (table, options = {}) => {
      const rows = await originalList(table, options);
      if (table !== "events") return rows;
      return rows.filter(isUpcoming).sort((left, right) => eventStart(left) - eventStart(right));
    };
    window.BaliStore = Object.freeze({ ...originalStore, list:patchedList, __fullDemoPatched:true });
  }

  function eventById(id) {
    return read("bali_events_v2", []).find(event => String(event.id) === String(id));
  }

  function showPage(page) {
    const screen = document.querySelector(`[data-screen="${CSS.escape(String(page || "home"))}"]`);
    if (!screen) return false;
    document.querySelectorAll(".page[data-screen]").forEach(node => node.classList.toggle("active", node === screen));
    document.querySelectorAll(".nav [data-page]").forEach(node => {
      node.disabled = false;
      node.classList.remove("navigation-loading");
      node.classList.toggle("active", node.dataset.page === page);
      node.setAttribute("aria-busy", "false");
    });
    screen.scrollTop = 0;
    return true;
  }

  function todayLabel(card) {
    let label = card.querySelector(":scope > .bali-today-label");
    if (!label) {
      label = document.createElement("span");
      label.className = "bali-today-label";
      label.textContent = "УЖЕ СЕГОДНЯ";
      card.prepend(label);
    }
  }

  function decorateEvents() {
    document.querySelectorAll("[data-event]").forEach(node => {
      const id = node.dataset.event;
      const event = eventById(id);
      const card = node.matches("article") ? node : node.closest("article");
      if (!card || !event) return;
      card.classList.toggle("bali-today", isToday(event));
      if (isToday(event)) todayLabel(card); else card.querySelector(":scope > .bali-today-label")?.remove();
    });
    const form = document.getElementById("bookingForm");
    const active = eventById(form?.elements?.event_id?.value);
    const date = document.getElementById("eventDialogDate");
    date?.classList.toggle("bali-today-date", Boolean(active && isToday(active)));
  }

  function closeDialog(dialog) {
    if (!dialog) return;
    try { if (dialog.open && typeof dialog.close === "function") dialog.close(); else dialog.removeAttribute("open"); } catch { dialog.removeAttribute("open"); }
    document.body.classList.remove("bali-dialog-open");
  }

  document.addEventListener("click", event => {
    const nav = event.target.closest(".nav [data-page], [data-page]");
    if (nav && showPage(nav.dataset.page)) {
      event.preventDefault();
      requestAnimationFrame(decorateEvents);
      return;
    }
    const close = event.target.closest("[data-close], [data-social-v2-close], [data-profile-v2-close], [data-close-venue-dialog], [data-close-attendance-list]");
    if (close) {
      event.preventDefault();
      closeDialog(close.closest("dialog"));
      return;
    }
    if (event.target instanceof HTMLDialogElement) {
      const rect = event.target.getBoundingClientRect();
      const outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
      if (outside) closeDialog(event.target);
    }
  }, true);

  document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    [...document.querySelectorAll("dialog[open]")].reverse().slice(0, 1).forEach(closeDialog);
  });

  document.addEventListener("toggle", event => {
    if (!(event.target instanceof HTMLDialogElement)) return;
    document.body.classList.toggle("bali-dialog-open", Boolean(document.querySelector("dialog[open]")));
    if (event.target.id === "eventDialog" && event.target.open) requestAnimationFrame(decorateEvents);
  }, true);

  let scheduled = false;
  const scheduleDecorate = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; decorateEvents(); });
  };
  ["bali:full-demo-ready","bali:data-changed","bali:beta4-local"].forEach(name => window.addEventListener(name, scheduleDecorate));
  scheduleDecorate();

  window.BaliFullDemoEvents = { eventStart, eventEnd, isUpcoming, isToday, activeEvents, normalizeDemoEvents, ensureDemoAttendees, showPage, decorateEvents };
})();