(() => {
  if (window.__BALI_ADMIN_EVENTS_HISTORY__) return;
  window.__BALI_ADMIN_EVENTS_HISTORY__ = true;

  const store = window.BaliStore;
  const attendance = window.BaliEventQrAttendance;
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = (value = "") => String(value).replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));
  const fmt = value => value ? new Date(`${String(value).slice(0,10)}T12:00:00`).toLocaleDateString("ru-RU", {day:"2-digit",month:"short",year:"numeric"}) : "—";
  let opened = false;

  function eventEnd(event = {}) {
    const date = String(event.event_end_date || event.end_date || event.event_date || "").slice(0,10);
    const start = event.event_time || "23:00";
    const end = event.event_end_time || event.end_time || "06:00";
    if (!date) return null;
    const d = new Date(`${date}T${end}:00`);
    if (!event.event_end_date && !event.end_date && end <= start) d.setDate(d.getDate() + 1);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  async function checkins() {
    if (attendance?.listCheckins) return attendance.listCheckins();
    if (store?.cloudEnabled && store.client) {
      const { data, error } = await store.client.from("event_checkins").select("*");
      if (error) throw error;
      return data || [];
    }
    try { return Object.values(JSON.parse(localStorage.getItem("bali_event_checkins_v1") || "{}")); }
    catch { return []; }
  }

  function summary(event, rows) {
    const all = rows.filter(row => String(row.event_id) === String(event.id));
    const unique = new Map();
    all.forEach(row => unique.set(String(row.user_key || row.telegram_id || row.id), row));
    const visits = [...unique.values()];
    const inside = visits.filter(row => !row.left_at && row.presence_status !== "left").length;
    return { total: visits.length, inside, rows: visits.sort((a,b) => String(b.checked_in_at || "").localeCompare(String(a.checked_in_at || ""))) };
  }

  function status(event) {
    const end = eventEnd(event);
    if (end && end.getTime() < Date.now()) return ["Завершено", "completed"];
    if (event.active === false) return ["Черновик", "pending"];
    return ["Активно", "available"];
  }

  function card(event, stats) {
    const [label, cls] = status(event);
    const visitors = stats.rows.map(row => `<li><strong>${esc(row.name || row.telegram || "Гость BALI")}</strong><span>${row.checked_in_at ? new Date(row.checked_in_at).toLocaleString("ru-RU") : ""}${row.left_at ? " · вышел" : " · внутри"}</span></li>`).join("");
    return `<article class="panel" style="margin-bottom:14px"><div class="panel-head"><div><h3>${esc(event.title || "Мероприятие BALI")}</h3><small>${fmt(event.event_date)} · ${esc(event.event_time || "23:00")}</small></div><span class="status ${cls}">${label}</span></div><div class="panel-body"><div class="stats" style="margin-bottom:14px"><article class="stat-card"><span>QR-СКАНИРОВАНИЙ</span><strong>${stats.total}</strong><em>уникальных гостей</em></article><article class="stat-card"><span>СЕЙЧАС ВНУТРИ</span><strong>${stats.inside}</strong><em>не отметили выход</em></article></div>${event.description ? `<p>${esc(event.description)}</p>` : ""}<details><summary>История посещений (${stats.total})</summary>${visitors ? `<ul style="display:grid;gap:8px;padding:12px 0;list-style:none">${visitors}</ul>` : '<div class="empty">QR-код ещё никто не сканировал</div>'}</details><div class="row-actions" style="margin-top:12px"><button class="icon-btn" data-edit="events" data-id="${esc(event.id)}">✎</button><button class="icon-btn" data-delete="events" data-id="${esc(event.id)}">×</button></div></div></article>`;
  }

  async function render() {
    opened = true;
    if (typeof state !== "undefined") state.view = "events";
    const root = $("#content");
    if (!root) return;
    $("#pageTitle").textContent = "События и история";
    const action = $("#primaryAction");
    if (action) { action.style.display = "inline-flex"; action.textContent = "Добавить событие"; }
    root.innerHTML = '<div class="empty">Загрузка истории мероприятий…</div>';
    try {
      const [events, rows] = await Promise.all([store.list("events", {order:"event_date"}), checkins()]);
      const sorted = [...events].sort((a,b) => `${b.event_date || ""}${b.event_time || ""}`.localeCompare(`${a.event_date || ""}${a.event_time || ""}`));
      const active = sorted.filter(event => status(event)[0] !== "Завершено");
      const history = sorted.filter(event => status(event)[0] === "Завершено");
      root.innerHTML = `<section><div class="panel-head" style="margin-bottom:12px"><div><h3>Текущие мероприятия</h3><small>QR-статистика обновляется из общей базы</small></div></div>${active.length ? active.map(event => card(event, summary(event, rows))).join("") : '<div class="panel"><div class="empty">Активных мероприятий нет</div></div>'}<div class="panel-head" style="margin:24px 0 12px"><div><h3>История мероприятий</h3><small>Завершённые события не удаляются</small></div></div>${history.length ? history.map(event => card(event, summary(event, rows))).join("") : '<div class="panel"><div class="empty">История пока пуста</div></div>'}</section>`;
    } catch (error) {
      root.innerHTML = `<div class="panel"><div class="empty">Ошибка загрузки истории: ${esc(error?.message || "неизвестная ошибка")}</div></div>`;
    }
  }

  document.addEventListener("click", event => {
    const nav = event.target.closest('#adminNav [data-view="events"]');
    if (!nav) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (typeof state !== "undefined") state.view = "events";
    document.querySelectorAll("#adminNav button").forEach(button => button.classList.toggle("active", button === nav));
    render();
  }, true);

  window.addEventListener("bali:data-changed", event => {
    if (opened && ["events", "event_checkins"].includes(event.detail?.table)) render();
  });
  setInterval(() => { if (opened && $('#adminNav [data-view="events"].active')) render(); }, 15000);
  window.BaliAdminEventsHistory = { render };
})();