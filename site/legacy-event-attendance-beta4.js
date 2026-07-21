(() => {
  if (window.__BALI_LEGACY_EVENT_ATTENDANCE__) return;
  window.__BALI_LEGACY_EVENT_ATTENDANCE__ = true;

  const store = window.BaliStore;
  const game = window.BaliBeta4Game;
  const points = window.BaliPoints;
  if (!store || !game || !points) return;

  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  };
  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);
  const digits = value => String(value || "").replace(/\D/g, "");
  const text = value => String(value || "").trim();
  const initials = name => text(name || "B").split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();

  let currentRows = [];
  let currentEventTitle = "Собираются на мероприятие";

  function eventContext() {
    const form = document.getElementById("bookingForm");
    const eventId = text(form?.elements?.event_id?.value);
    const eventDate = text(form?.elements?.booking_date?.value);
    return eventId ? { eventId, eventDate } : null;
  }

  function identities(subject = {}, extra = "") {
    const values = new Set();
    [extra, subject.id, subject.user_key, subject.userKey, subject.owner_key, subject.ownerKey, subject.code, subject.customer_id]
      .filter(Boolean)
      .forEach(value => values.add(text(value)));
    const telegramId = subject.telegram_id || subject.telegramId;
    if (telegramId) values.add(`tg:${telegramId}`);
    const phone = digits(subject.phone);
    if (phone) values.add(`phone:${phone}`);
    return values;
  }

  function intersects(left, right) {
    for (const value of left) if (right.has(value)) return true;
    return false;
  }

  function activeBooking(row, eventId, eventDate) {
    if (["cancelled", "completed"].includes(text(row.status).toLowerCase())) return false;
    return text(row.event_id) === eventId || (!row.event_id && text(row.booking_date) === eventDate);
  }

  function ensureStyle() {
    if (document.getElementById("legacyAttendanceStyle")) return;
    const style = document.createElement("style");
    style.id = "legacyAttendanceStyle";
    style.textContent = `
      #eventGoing{display:none!important}
      #eventDialog #eventSocial .stats{display:block!important}
      .legacy-attendance-total{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:12px;padding:14px;border:1px solid rgba(200,255,61,.25);border-radius:16px;background:rgba(200,255,61,.06);color:inherit;text-align:left;cursor:pointer}
      .legacy-attendance-total:hover,.legacy-attendance-total:focus-visible{border-color:rgba(200,255,61,.55);background:rgba(200,255,61,.1);outline:0}
      .legacy-attendance-total strong{display:block;color:var(--lime);font:600 28px Unbounded}
      .legacy-attendance-total span{display:block;margin-top:4px;color:var(--muted);font-size:8px}
      .legacy-attendance-total em{font-style:normal;color:var(--lime);font-size:9px;font-weight:900;text-align:right}
      .legacy-attendance-dialog{width:min(560px,calc(100% - 16px));max-height:92dvh;padding:0;border:1px solid var(--line);border-radius:24px;background:#0d100f;color:var(--text);overflow:hidden}
      .legacy-attendance-dialog::backdrop{background:rgba(0,0,0,.82);backdrop-filter:blur(5px)}
      .legacy-attendance-sheet{max-height:92dvh;overflow:auto}
      .legacy-attendance-head{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 17px;border-bottom:1px solid var(--line);background:#0d100ff2}
      .legacy-attendance-head h3{margin:4px 0 0;font-size:17px}
      .legacy-attendance-close{width:40px;height:40px;border:1px solid var(--line);border-radius:50%;background:#ffffff08;color:#fff;font-size:23px}
      .legacy-attendance-dialog-body{display:grid;gap:15px;padding:15px}
      .legacy-attendance-summary{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      .legacy-attendance-summary article{padding:12px;border:1px solid var(--line);border-radius:14px;background:#ffffff05;text-align:center}
      .legacy-attendance-summary strong{display:block;color:var(--lime);font:600 20px Unbounded}
      .legacy-attendance-summary span{display:block;margin-top:5px;color:var(--muted);font-size:8px}
      .legacy-attendance-section{display:grid;gap:8px}
      .legacy-attendance-section h4{margin:0;font-size:12px}
      .legacy-attendance-list{display:grid;gap:7px}
      .legacy-attendance-person{display:grid;grid-template-columns:38px minmax(0,1fr) auto;gap:9px;align-items:center;padding:10px;border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.025)}
      .legacy-attendance-avatar{width:38px;height:38px;display:grid;place-items:center;border-radius:50%;background:#1a211d;color:var(--lime);font-weight:900}
      .legacy-attendance-person h5{margin:0;font-size:10px}
      .legacy-attendance-person p{margin:3px 0 0;color:var(--muted);font-size:8px}
      .legacy-attendance-person b{color:var(--lime);font-size:9px}
      .legacy-attendance-empty{padding:18px 12px;border:1px dashed var(--line);border-radius:13px;color:var(--muted);font-size:9px;text-align:center}
    `;
    document.head.appendChild(style);
  }

  function ensureDialog() {
    if (document.getElementById("legacyAttendanceDialog")) return;
    document.body.insertAdjacentHTML("beforeend", `
      <dialog class="legacy-attendance-dialog" id="legacyAttendanceDialog">
        <div class="legacy-attendance-sheet">
          <header class="legacy-attendance-head">
            <div><span class="eyebrow">ХОЧУ ПОЙТИ</span><h3 id="legacyAttendanceDialogTitle">Кто собирается</h3></div>
            <button class="legacy-attendance-close" type="button" data-close-attendance-list>×</button>
          </header>
          <div class="legacy-attendance-dialog-body" id="legacyAttendanceDialogBody"></div>
        </div>
      </dialog>
    `);
  }

  function personHtml(row) {
    const detail = row.type === "booking"
      ? `Забронирован стол на ${row.guests} чел.`
      : "Нажал(а) «Хочу пойти»";
    const amount = row.type === "booking" ? `${row.guests} чел.` : "+1";
    return `<article class="legacy-attendance-person"><span class="legacy-attendance-avatar">${esc(initials(row.name))}</span><div><h5>${esc(row.name)}</h5><p>${detail}</p></div><b>${amount}</b></article>`;
  }

  function renderDialog() {
    ensureDialog();
    const body = document.getElementById("legacyAttendanceDialogBody");
    const title = document.getElementById("legacyAttendanceDialogTitle");
    if (!body || !title) return;

    const bookingRows = currentRows.filter(row => row.type === "booking");
    const interestRows = currentRows.filter(row => row.type === "interest");
    const bookedGuests = bookingRows.reduce((sum, row) => sum + row.guests, 0);
    const total = currentRows.reduce((sum, row) => sum + row.guests, 0);
    title.textContent = currentEventTitle || "Кто собирается";
    body.innerHTML = `
      <div class="legacy-attendance-summary"><article><strong>${total}</strong><span>ВСЕГО СОБИРАЮТСЯ</span></article><article><strong>${bookedGuests}</strong><span>ИЗ НИХ ПО БРОНЯМ</span></article></div>
      <section class="legacy-attendance-section"><h4>Забронировали столик</h4><div class="legacy-attendance-list">${bookingRows.length ? bookingRows.map(personHtml).join("") : '<div class="legacy-attendance-empty">Бронирований столиков пока нет</div>'}</div></section>
      <section class="legacy-attendance-section"><h4>Хотят пойти без бронирования</h4><div class="legacy-attendance-list">${interestRows.length ? interestRows.map(personHtml).join("") : '<div class="legacy-attendance-empty">Пока никто не отметил «Хочу пойти»</div>'}</div></section>
    `;
  }

  function openDialog() {
    renderDialog();
    const dialog = document.getElementById("legacyAttendanceDialog");
    if (dialog && !dialog.open) dialog.showModal();
  }

  let sequence = 0;
  async function refresh() {
    const context = eventContext();
    const root = document.getElementById("eventSocial");
    const toggle = document.getElementById("eventInterested");
    if (!context || !root || !toggle) return;

    const current = ++sequence;
    const bookings = (await store.list("bookings")).filter(row => activeBooking(row, context.eventId, context.eventDate));
    if (current !== sequence) return;

    const bookingRows = bookings.map(row => ({
      type: "booking",
      name: row.customer_name || row.name || "Гость BALI",
      guests: Math.max(1, Number(row.guests || 1)),
      identity: identities(row),
      id: row.id || `${row.table_id}-${row.created_at || ""}`
    }));
    const booked = bookingRows.map(row => row.identity);
    const eventRsvps = read("bali_event_rsvps_v1", {})?.[context.eventId] || {};
    const interestRows = Object.entries(eventRsvps)
      .filter(([, row]) => row?.status === "interested")
      .map(([entryKey, row]) => ({
        type: "interest",
        name: row.name || "Гость BALI",
        guests: 1,
        identity: identities(row, entryKey),
        id: entryKey
      }))
      .filter(row => !booked.some(identity => intersects(identity, row.identity)));

    currentRows = [...bookingRows, ...interestRows];
    currentEventTitle = document.getElementById("eventDialogTitle")?.textContent?.trim() || "Кто собирается";
    const total = currentRows.reduce((sum, row) => sum + row.guests, 0);
    root.innerHTML = `<button class="legacy-attendance-total" type="button" data-open-attendance-list aria-label="Посмотреть, кто собирается на мероприятие"><div><strong>${total}</strong><span>ХОТЯТ ПОЙТИ</span></div><em>Посмотреть, кто собирается →</em></button>`;

    if (document.getElementById("legacyAttendanceDialog")?.open) renderDialog();

    const me = new Set([...identities(game.profile()), ...identities(points.profile())]);
    const myBooking = bookingRows.some(row => intersects(row.identity, me));
    if (myBooking) {
      toggle.disabled = true;
      toggle.classList.add("primary");
      toggle.textContent = "Вы уже идёте · бронь";
    } else {
      toggle.disabled = false;
      const active = Object.entries(eventRsvps).some(([entryKey, row]) => row?.status === "interested" && intersects(identities(row, entryKey), me));
      toggle.classList.toggle("primary", active);
      toggle.textContent = active ? "Отменить" : "Хочу пойти";
    }
  }

  ensureStyle();
  ensureDialog();
  document.addEventListener("click", event => {
    if (event.target.closest("[data-event]")) [80, 220, 500].forEach(delay => setTimeout(refresh, delay));
    if (event.target.closest("#eventInterested")) [0, 80, 180].forEach(delay => setTimeout(refresh, delay));
    if (event.target.closest("[data-open-attendance-list]")) openDialog();
    if (event.target.closest("[data-close-attendance-list]")) document.getElementById("legacyAttendanceDialog")?.close();
  }, true);
  document.addEventListener("submit", event => {
    if (event.target?.id === "bookingForm") [120, 400, 900].forEach(delay => setTimeout(refresh, delay));
  }, true);
  ["bali:data-changed", "bali:beta4-local"].forEach(name => window.addEventListener(name, () => setTimeout(refresh, 0)));
  document.getElementById("eventDialog")?.addEventListener("toggle", () => setTimeout(refresh, 0));
  window.BaliLegacyAttendance = { refresh, openList: openDialog };
})();
