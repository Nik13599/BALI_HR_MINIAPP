(() => {
  if (window.__BALI_FAST_EVENT_VISUALS__) return;
  window.__BALI_FAST_EVENT_VISUALS__ = true;

  const api = window.BaliFastEventDialog;
  const game = window.BaliBeta4Game;
  if (!api) return;

  const PEOPLE_KEY = "bali_social_people_v1";
  const LAYOUTS_KEY = "bali_event_layouts_v1";
  const HALL_KEY = "bali_hall_layout_config_v1";
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
  const norm = value => String(value || "").trim().toLocaleLowerCase("ru").replace(/^@/, "");
  const digits = value => String(value || "").replace(/\D/g, "");
  const initials = value => String(value || "B").trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase();
  const clamp = value => Math.max(3, Math.min(97, Number(value ?? 50)));
  let lastListType = "want";

  function styles() {
    if (document.getElementById("fastEventVisualsStyle")) return;
    const style = document.createElement("style");
    style.id = "fastEventVisualsStyle";
    style.textContent = `
      #tableChoices{display:block!important;width:100%}
      .fast-hall-map{position:relative;width:100%;aspect-ratio:1;overflow:hidden;border:1px solid rgba(255,255,255,.14);border-radius:18px;background:#eee8df url('./hall-plan.svg') center/contain no-repeat;touch-action:manipulation}
      .fast-hall-table{position:absolute;transform:translate(-50%,-50%);display:grid;place-items:center;align-content:center;gap:1px;width:42px;height:42px;padding:2px;border:2px solid rgba(18,22,20,.72);border-radius:50%;background:#c8ff3d;color:#09100b;box-shadow:0 5px 14px rgba(0,0,0,.28);font:800 8px/1.1 system-ui;z-index:2;transition:transform .12s ease,box-shadow .12s ease}
      .fast-hall-table.square{border-radius:9px}.fast-hall-table.vip{background:#e4c86e;border-color:#6d5316;color:#251b04}.fast-hall-table.busy{background:#ff7777;border-color:#671b1b;color:#2a0505;opacity:1}.fast-hall-table.selected{transform:translate(-50%,-50%) scale(1.13);box-shadow:0 0 0 4px rgba(255,255,255,.72),0 8px 20px rgba(0,0,0,.35);z-index:4}.fast-hall-table small{font-size:6px;font-weight:900;opacity:.82}.fast-hall-table:disabled{pointer-events:none}
      .fast-hall-legend{display:flex;justify-content:center;gap:10px;margin-top:9px;flex-wrap:wrap}.fast-hall-legend span{display:flex;align-items:center;gap:5px;color:#9da49f;font-size:8px}.fast-hall-legend i{width:9px;height:9px;border-radius:50%;background:#c8ff3d}.fast-hall-legend i.busy{background:#ff7777}.fast-hall-legend i.vip{background:#e4c86e}.fast-hall-legend i.selected{background:#fff;box-shadow:0 0 0 2px #c8ff3d}.fast-hall-help{text-align:center;margin-top:7px;color:#9da49f;font-size:9px}
      .fast-event-person{display:grid!important;grid-template-columns:48px minmax(0,1fr) auto!important;align-items:center!important;gap:10px!important}.fast-event-person-main{min-width:0}.fast-event-person-main strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px}.fast-event-person-main small{display:block;margin-top:3px;color:var(--muted);font-size:8px}.fast-event-avatar{position:relative;width:44px;height:44px;display:grid;place-items:center;overflow:hidden;border:3px solid #66716b;border-radius:50%;background:#1b211e;color:#fff;font-size:10px;font-weight:1000;box-shadow:0 0 0 2px rgba(255,255,255,.05)}.fast-event-avatar img{width:100%;height:100%;object-fit:cover}.fast-event-avatar.status-vip{border-color:#e4c86e;box-shadow:0 0 0 2px rgba(228,200,110,.18)}.fast-event-avatar.status-black{border-color:#e8edf0;background:#080909;box-shadow:0 0 0 2px rgba(255,255,255,.22)}.fast-event-avatar.status-legend{border-color:#a875ff;box-shadow:0 0 0 2px rgba(168,117,255,.25),0 0 16px rgba(168,117,255,.26)}.fast-event-avatar.status-crown{border-color:#ffd54a;box-shadow:0 0 0 2px rgba(255,213,74,.25),0 0 16px rgba(255,213,74,.24)}.fast-event-avatar.status-special{border-color:#62d9ff;box-shadow:0 0 0 2px rgba(98,217,255,.18)}.fast-event-status{display:inline-flex;margin-top:4px;padding:3px 6px;border:1px solid currentColor;border-radius:999px;color:#aab3ae;font-size:7px;font-weight:900;letter-spacing:.05em}.fast-event-status.status-vip{color:#e4c86e}.fast-event-status.status-black{color:#e8edf0}.fast-event-status.status-legend{color:#b995ff}.fast-event-status.status-crown{color:#ffd54a}.fast-event-status.status-special{color:#62d9ff}
      @media(max-width:390px){.fast-hall-table{width:37px;height:37px;font-size:7px}.fast-event-avatar{width:41px;height:41px}}
    `;
    document.head.appendChild(style);
  }

  function identityValues(person = {}) {
    const values = new Set();
    [person.id, person.user_key, person.userKey, person.ownerKey, person.code].filter(Boolean).forEach(value => values.add(String(value)));
    const phone = digits(person.phone);
    if (phone) values.add(`phone:${phone}`);
    return values;
  }

  function findPerson(row = {}) {
    const people = read(PEOPLE_KEY, []);
    const rowIds = new Set([row.user_key, row.userKey, row.id, row.owner_key, row.ownerKey].filter(Boolean).map(String));
    const rowPhone = digits(row.phone);
    const rowName = norm(row.name);
    return people.find(person => {
      const ids = identityValues(person);
      if ([...rowIds].some(id => ids.has(id))) return true;
      if (rowPhone && digits(person.phone) === rowPhone) return true;
      return Boolean(rowName && norm(person.name) === rowName);
    }) || row;
  }

  function vipPlan(person = {}) {
    const direct = String(person.vipPlanId || person.vip_plan_id || "").toLowerCase();
    if (direct) return direct;
    const keys = identityValues(person);
    const gift = game?.vipGifts?.().filter(item => !item.revokedAt && (!item.expiresAt || new Date(item.expiresAt).getTime() > Date.now()) && item.targetKeys?.some(key => keys.has(String(key))))
      .sort((left, right) => String(right.expiresAt || "").localeCompare(String(left.expiresAt || "")))[0];
    return String(gift?.planId || "").toLowerCase();
  }

  async function statusFor(person = {}) {
    try {
      const wins = await window.BaliCrownWinCards?.winCounts?.(person);
      if (Number(wins?.miss || 0) > 0) return { cls:"status-crown", label:"КОРОЛЕВА BALI" };
      if (Number(wins?.mister || 0) > 0) return { cls:"status-crown", label:"КОРОЛЬ BALI" };
    } catch {}
    const plan = vipPlan(person);
    if (plan === "legend") return { cls:"status-legend", label:"BALI LEGEND" };
    if (plan === "black") return { cls:"status-black", label:"BALI BLACK" };
    if (plan) return { cls:"status-vip", label:"BALI VIP" };
    const custom = String(person.statusTitle || person.status_name || person.levelName || person.level || "").trim();
    if (custom) return { cls:"status-special", label:custom.toUpperCase() };
    return { cls:"", label:"" };
  }

  function photoFor(person = {}) {
    return person.photo || person.avatar || person.photo_url || person.avatar_url || person.image_url || "";
  }

  function avatarHtml(person, status) {
    const name = person.name || "Гость BALI";
    const photo = photoFor(person);
    return `<span class="fast-event-avatar ${status.cls}">${photo ? `<img src="${esc(photo)}" alt="${esc(name)}" loading="lazy" decoding="async">` : esc(initials(name))}</span>`;
  }

  async function renderPeopleList(type = lastListType) {
    const eventId = document.querySelector('#bookingForm [name="event_id"]')?.value;
    const root = document.getElementById("fastEventList");
    if (!eventId || !root || !document.getElementById("fastEventListDialog")?.open) return;
    lastListType = type;
    const rows = type === "present" ? api.presentRows(eventId) : api.wantRows(eventId);
    const models = await Promise.all(rows.map(async row => {
      const person = findPerson(row);
      return { row, person, status:await statusFor(person) };
    }));
    root.innerHTML = models.length ? models.map(({row, person, status}) => {
      const name = person.name || row.name || "Гость BALI";
      const size = type === "present" ? 1 : Math.max(1, Number(row.partySize || row.party_size || row.guests || 1));
      return `<article class="fast-event-person">${avatarHtml(person,status)}<div class="fast-event-person-main"><strong>${esc(name)}</strong>${status.label ? `<span class="fast-event-status ${status.cls}">${esc(status.label)}</span>` : `<small>Пользователь BALI</small>`}</div><b>${type === "present" ? "В BALI" : (size > 1 ? `+${size - 1}` : "1")}</b></article>`;
    }).join("") : `<div class="empty">${type === "present" ? "Пока никто не подтвердил вход по QR" : "Пока никто не отметил «Хочу пойти»"}</div>`;
  }

  function renderHallMap() {
    const root = document.getElementById("tableChoices");
    const form = document.getElementById("bookingForm");
    const eventId = form?.elements?.event_id?.value;
    if (!root || !form || !eventId || !document.getElementById("eventDialog")?.open) return;
    const event = read("bali_events_v2", []).find(item => String(item.id) === String(eventId));
    if (!event) return;
    const tables = api.computeAvailability(event);
    const selected = String(form.elements.table_id?.value || "");
    const layouts = read(LAYOUTS_KEY, {});
    const layout = layouts?.[eventId] || {};
    const base = read(HALL_KEY, {});
    const buttons = tables.map(table => {
      const isVip = table.shape === "vip" || table.vip === true || /^vip\b/i.test(String(table.name || ""));
      const shape = isVip ? "vip" : table.shape === "square" ? "square" : "round";
      const classes = ["fast-hall-table", shape, table.available ? "" : "busy", selected === String(table.id) ? "selected" : ""].filter(Boolean).join(" ");
      const label = String(table.name || table.id).replace(/^Стол\s*/i, "");
      return `<button type="button" class="${classes}" data-fast-table="${esc(table.id)}" style="left:${clamp(table.x)}%;top:${clamp(table.y)}%" ${table.available ? "" : "disabled"}><span>${esc(label)}</span><small>${Number(table.seats || 4)} мест</small></button>`;
    }).join("");
    root.innerHTML = `<div class="fast-hall-map" id="fastHallMap">${buttons || '<div class="booking-layout-empty">Схема ещё не настроена</div>'}</div><div class="fast-hall-legend"><span><i></i>Свободен</span><span><i class="busy"></i>Занят</span><span><i class="vip"></i>VIP</span><span><i class="selected"></i>Выбран</span></div><div class="fast-hall-help">Нажмите на свободный стол, затем заполните данные бронирования</div>`;
    const background = layout.background || base.image || "";
    if (background) document.getElementById("fastHallMap").style.backgroundImage = `url("${String(background).replace(/"/g, "%22")}")`;
    const title = root.closest("label")?.querySelector(":scope > span");
    if (title) title.textContent = "Схема зала и выбор стола";
  }

  const scheduleMap = (delay = 0) => setTimeout(() => requestAnimationFrame(renderHallMap), delay);
  window.addEventListener("click", event => {
    if (event.target.closest("[data-event]") && !event.target.closest("dialog")) scheduleMap(30);
    if (event.target.closest("[data-fast-table]")) scheduleMap(0);
    const list = event.target.closest("[data-fast-event-list]");
    if (list) setTimeout(() => renderPeopleList(list.dataset.fastEventList), 0);
  }, true);
  document.addEventListener("submit", event => {
    if (event.target.id === "bookingForm") scheduleMap(60);
  }, true);
  ["bali:data-changed","bali:checkin-complete","bali:checkin-left","bali:rsvp-changed","bali:beta4-changed","bali:crown-win-cards-ready"].forEach(name => window.addEventListener(name, () => {
    if (document.getElementById("eventDialog")?.open) scheduleMap(0);
    if (document.getElementById("fastEventListDialog")?.open) requestAnimationFrame(() => renderPeopleList(lastListType));
  }));

  styles();
  window.BaliFastEventVisuals = { renderHallMap, renderPeopleList, statusFor };
})();