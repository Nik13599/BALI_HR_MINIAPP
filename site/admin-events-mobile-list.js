(() => {
  if (window.__BALI_EVENTS_MOBILE_LIST__) return;
  window.__BALI_EVENTS_MOBILE_LIST__ = true;
  const LAYOUT_KEY = "bali_event_layouts_v1";
  const readLayouts = () => { try { return JSON.parse(localStorage.getItem(LAYOUT_KEY)) || {}; } catch { return {}; } };
  const byDate = (a,b) => `${a.event_date||"9999-12-31"}T${a.event_time||"23:59"}`.localeCompare(`${b.event_date||"9999-12-31"}T${b.event_time||"23:59"}`);

  if (!document.getElementById("eventsMobileListStyle")) {
    const style = document.createElement("style");
    style.id = "eventsMobileListStyle";
    style.textContent = `.events-mobile-list{display:grid;gap:11px}.event-mobile-card{display:grid;grid-template-columns:86px minmax(0,1fr);gap:11px;padding:11px;border:1px solid var(--line);border-radius:17px;background:rgba(255,255,255,.022)}.event-mobile-card img,.event-mobile-poster{width:86px;aspect-ratio:4/5;object-fit:cover;border-radius:12px;background:#171b19}.event-mobile-poster{display:grid;place-items:center;color:var(--muted);font-weight:900}.event-mobile-main{min-width:0;display:grid;gap:8px;align-content:start}.event-mobile-main h3{font-size:14px;line-height:1.15}.event-mobile-main p{margin:0;color:var(--muted);font-size:9px;line-height:1.45;display:-webkit-box;overflow:hidden;-webkit-line-clamp:2;-webkit-box-orient:vertical}.event-mobile-tags,.event-mobile-actions{display:flex;gap:6px;flex-wrap:wrap}.event-mobile-tag{padding:5px 7px;border:1px solid var(--line);border-radius:999px;color:var(--muted);font-size:8px;font-weight:800}.event-mobile-tag.ok{color:var(--lime);border-color:rgba(200,255,61,.3)}.event-mobile-tag.warn{color:var(--warn);border-color:rgba(255,200,87,.3)}.event-mobile-actions button{min-height:37px;padding:0 9px;border-radius:10px;font-size:9px;flex:1;min-width:80px}.event-mobile-actions .qr-action{color:#090b08;background:var(--lime);border-color:var(--lime)}.events-mobile-note{padding:11px;border:1px solid rgba(200,255,61,.17);border-radius:14px;background:rgba(200,255,61,.05);color:var(--muted);font-size:10px;line-height:1.5}@media(max-width:390px){.event-mobile-card{grid-template-columns:72px minmax(0,1fr)}.event-mobile-card img,.event-mobile-poster{width:72px}.event-mobile-actions{grid-column:1/-1}}`;
    document.head.appendChild(style);
  }

  async function renderLite(root) {
    const events = (await store.list("events")).sort(byDate);
    const layouts = readLayouts();
    const cards = events.map((item) => {
      const layout = layouts[item.id];
      const ready = Boolean(layout?.ready && layout?.background && layout?.tables?.length);
      return `<article class="event-mobile-card" data-admin-event-id="${esc(item.id)}">
        <div>${item.image_url ? `<img src="${esc(item.image_url)}" alt="${esc(item.title)}" loading="lazy">` : '<div class="event-mobile-poster">BALI</div>'}</div>
        <div class="event-mobile-main">
          <div><span class="eyebrow">${formatDate(item.event_date).toUpperCase()} · ${esc(item.event_time || "23:00")}</span><h3>${esc(item.title)}</h3></div>
          <p>${esc(item.description || "Описание не заполнено")}</p>
          <div class="event-mobile-tags"><span class="event-mobile-tag ${ready ? "ok" : "warn"}">${ready ? `${layout.tables.length} столов` : "Рассадка не готова"}</span><span class="event-mobile-tag ${item.active !== false ? "ok" : ""}">${item.active !== false ? "Опубликовано" : "Черновик"}</span><span class="event-mobile-tag ${item.qr_token ? "ok" : "warn"}">${item.qr_token ? "QR готов" : "QR создаётся"}</span></div>
          <div class="event-mobile-actions"><button class="ghost" data-mobile-event-edit="${esc(item.id)}">Изменить</button><button class="ghost" data-mobile-event-layout="${esc(item.id)}">Рассадка</button><button class="qr-action" data-event-qr="${esc(item.id)}">QR входа</button><button class="ghost" data-event-attendees="${esc(item.id)}">Участники</button><button class="${item.active !== false ? "danger" : "primary"}" data-mobile-event-publish="${esc(item.id)}" ${item.active === false && !ready ? "disabled" : ""}>${item.active !== false ? "Снять" : "Опубликовать"}</button></div>
        </div>
      </article>`;
    }).join("");
    root.innerHTML = `<section class="panel"><div class="panel-head"><div><h3>Афиши и мероприятия</h3><small>QR-код входа создаётся автоматически для каждой афиши</small></div></div><div class="panel-body"><div class="events-mobile-note">Скачайте или распечатайте QR-код мероприятия и разместите его возле хостес. Каждый пользователь сможет подтвердить одно посещение этого события.</div><div class="events-mobile-list" style="margin-top:11px">${cards || '<div class="empty">Афиш пока нет</div>'}</div></div></section>`;
  }

  async function openLayout(eventId, button) {
    button.disabled = true;
    button.textContent = "Загрузка…";
    try {
      await window.BaliAdminRouter.loadModules(["event-layouts-beta3.js", "event-layout-admin-beta3.js"]);
      state.view = "events";
      await window.render();
      requestAnimationFrame(() => document.querySelector(`[data-event-layout="${CSS.escape(eventId)}"]`)?.click());
      setTimeout(() => { window.renderEvents = renderLite; }, 150);
    } catch (error) {
      toast(error.message || "Не удалось открыть рассадку");
      window.renderEvents = renderLite;
      await window.render();
    }
  }

  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-mobile-event-edit],[data-mobile-event-layout],[data-mobile-event-publish]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const eventId = button.dataset.mobileEventEdit || button.dataset.mobileEventLayout || button.dataset.mobileEventPublish;
    const events = await store.list("events");
    const item = events.find((row) => row.id === eventId);
    if (!item) return;
    if (button.dataset.mobileEventEdit) return openEditor("events", item);
    if (button.dataset.mobileEventLayout) return openLayout(eventId, button);
    const layout = readLayouts()[eventId];
    if (item.active === false && !layout?.ready) return toast("Сначала настройте рассадку");
    await store.save("events", { ...item, active: item.active === false });
    toast(item.active === false ? "Мероприятие опубликовано" : "Мероприятие снято");
    window.render();
  }, true);

  window.renderEvents = renderLite;
})();