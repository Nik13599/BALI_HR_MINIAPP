(() => {
  if (window.__BALI_FULL_DEMO_EVENT_PRESENCE__) return;
  window.__BALI_FULL_DEMO_EVENT_PRESENCE__ = true;

  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
  const initials = name => String(name || "B").trim().split(/\s+/).slice(0,2).map(part=>part[0]).join("").toUpperCase();
  let currentEvent = null;
  let currentRows = [];

  function styles() {
    if (document.getElementById("fullEventPresenceStyle")) return;
    const style = document.createElement("style");
    style.id = "fullEventPresenceStyle";
    style.textContent = `
      .event-presence-block{display:grid;gap:10px;padding:13px;border:1px solid rgba(200,255,61,.28);border-radius:16px;background:rgba(200,255,61,.055)}
      .event-presence-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.event-presence-head h3{font-size:13px}.event-presence-head span{color:var(--lime);font:600 16px Unbounded}
      .event-presence-preview{display:flex;align-items:center;gap:0;min-height:40px}.event-presence-avatar{width:39px;height:39px;display:grid;place-items:center;overflow:hidden;margin-right:-8px;border:2px solid #0d100f;border-radius:50%;background:#1a211d;color:var(--lime);font-size:9px;font-weight:900}.event-presence-avatar img{width:100%;height:100%;object-fit:cover}.event-presence-more{margin-left:14px;color:var(--muted);font-size:9px}
      .event-presence-open{min-height:41px;border:1px solid rgba(200,255,61,.25);border-radius:12px;background:#c8ff3d12;color:var(--lime);font-size:9px;font-weight:900}
      .event-presence-dialog{width:min(560px,calc(100% - 16px));max-height:92dvh;padding:0;border:1px solid var(--line);border-radius:23px;background:#0d100f;color:#fff;overflow:hidden}.event-presence-dialog::backdrop{background:#000d;backdrop-filter:blur(5px)}.event-presence-sheet{max-height:92dvh;overflow:auto}.event-presence-dialog-head{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;padding:15px;border-bottom:1px solid var(--line);background:#0d100ff2}.event-presence-dialog-head h3{margin:4px 0 0;font-size:16px}.event-presence-close{width:40px;height:40px;border:1px solid var(--line);border-radius:50%;background:#ffffff08;color:#fff;font-size:23px}.event-presence-list{display:grid;gap:8px;padding:14px}.event-presence-person{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px;border:1px solid var(--line);border-radius:14px;background:#ffffff05}.event-presence-person .event-presence-avatar{width:44px;height:44px;margin:0;border:0}.event-presence-person h4{margin:0;font-size:11px}.event-presence-person p{margin:4px 0 0;color:var(--muted);font-size:8px}.event-presence-person b{color:var(--lime);font-size:8px}
    `;
    document.head.appendChild(style);
  }

  function ensureDialog() {
    if (document.getElementById("eventPresenceDialog")) return;
    document.body.insertAdjacentHTML("beforeend", `<dialog class="event-presence-dialog" id="eventPresenceDialog"><div class="event-presence-sheet"><header class="event-presence-dialog-head"><div><span class="eyebrow">УЖЕ В BALI</span><h3 id="eventPresenceTitle">Гости мероприятия</h3></div><button class="event-presence-close" type="button" data-close-event-presence>×</button></header><div class="event-presence-list" id="eventPresenceList"></div></div></dialog>`);
  }

  function peopleMap() {
    return new Map(read("bali_social_people_v1", []).map(person => [String(person.id), person]));
  }
  function activeRows(eventId) {
    const map = peopleMap();
    return Object.values(read("bali_event_checkins_v1", {}))
      .filter(row => String(row.event_id) === String(eventId) && !row.left_at && row.presence_status !== "left")
      .sort((a,b)=>String(a.checked_in_at||"").localeCompare(String(b.checked_in_at||"")))
      .map(row => ({ ...row, person:map.get(String(row.user_key || "")) || null }));
  }
  function avatar(row) {
    const photo = row.person?.photo || row.person?.avatar || "";
    return `<span class="event-presence-avatar">${photo ? `<img src="${esc(photo)}" alt="${esc(row.name || row.person?.name || "Гость BALI")}" loading="lazy">` : esc(initials(row.name || row.person?.name))}</span>`;
  }

  function renderDialog() {
    ensureDialog();
    document.getElementById("eventPresenceTitle").textContent = currentEvent?.title || "Гости мероприятия";
    document.getElementById("eventPresenceList").innerHTML = currentRows.length ? currentRows.map(row => `<article class="event-presence-person">${avatar(row)}<div><h4>${esc(row.name || row.person?.name || "Гость BALI")}</h4><p>QR-вход подтверждён ${row.checked_in_at ? new Date(row.checked_in_at).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"}) : ""}</p></div><b>В КЛУБЕ</b></article>`).join("") : '<div class="empty">Пока никто не подтвердил вход через QR-код</div>';
  }

  function refresh() {
    const form = document.getElementById("bookingForm");
    const eventId = form?.elements?.event_id?.value;
    const host = document.getElementById("eventSocial");
    if (!eventId || !host) return;
    currentEvent = read("bali_events_v2", []).find(event => String(event.id) === String(eventId)) || null;
    const today = currentEvent && window.BaliFullDemoEvents?.isToday?.(currentEvent);
    let block = document.getElementById("eventPresenceBlock");
    if (!today) { block?.remove(); return; }
    currentRows = activeRows(eventId);
    if (!block) {
      block = document.createElement("section");
      block.id = "eventPresenceBlock";
      block.className = "event-presence-block";
      host.insertAdjacentElement("afterend", block);
    }
    block.innerHTML = `<div class="event-presence-head"><h3>Уже на мероприятии</h3><span>${currentRows.length}</span></div><div class="event-presence-preview">${currentRows.slice(0,6).map(avatar).join("")}${currentRows.length > 6 ? `<span class="event-presence-more">+${currentRows.length-6}</span>` : currentRows.length ? "" : '<span class="event-presence-more">Пока никто не отметился</span>'}</div><button class="event-presence-open" type="button" data-open-event-presence>Посмотреть всех гостей</button>`;
    if (document.getElementById("eventPresenceDialog")?.open) renderDialog();
  }

  document.addEventListener("click", event => {
    if (event.target.closest("[data-event]")) setTimeout(refresh, 0);
    if (event.target.closest("[data-open-event-presence]")) { renderDialog(); document.getElementById("eventPresenceDialog")?.showModal(); }
    if (event.target.closest("[data-close-event-presence]")) document.getElementById("eventPresenceDialog")?.close();
  }, true);
  ["bali:checkin-complete","bali:checkin-left","bali:data-changed"].forEach(name => window.addEventListener(name, () => setTimeout(refresh,0)));
  styles();
  ensureDialog();
  window.BaliFullDemoEventPresence = { refresh, activeRows };
})();