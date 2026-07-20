(() => {
  const layouts = window.BaliEventLayouts;
  if (!layouts) return;

  let activeEvent = null;
  let draftLayout = null;
  let selectedTableId = "";
  const byDate = (a, b) => `${a.event_date || "9999-12-31"}T${a.event_time || "23:59"}`.localeCompare(`${b.event_date || "9999-12-31"}T${b.event_time || "23:59"}`);
  const tableLabel = (name = "") => String(name).replace(/^Стол\s*/i, "").replace(/^VIP\s*/i, "VIP ");

  function injectStyles() {
    if (document.getElementById("eventLayoutAdminStyle")) return;
    const style = document.createElement("style");
    style.id = "eventLayoutAdminStyle";
    style.textContent = `.event-admin-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px}.event-admin-card{overflow:hidden;border:1px solid var(--line);border-radius:20px;background:rgba(255,255,255,.022)}.event-admin-poster{aspect-ratio:4/5;overflow:hidden;background:linear-gradient(145deg,#242925,#0b0d0c)}.event-admin-poster img{width:100%;height:100%;object-fit:cover;display:block}.event-admin-poster-empty{display:grid;place-items:center;height:100%;color:rgba(255,255,255,.35);font:600 24px Unbounded}.event-admin-info{display:grid;gap:10px;padding:15px}.event-admin-info h3{margin:0;font-size:18px}.event-admin-info p{margin:0;color:var(--muted);font-size:11px;line-height:1.5}.event-admin-chips,.event-admin-actions{display:flex;gap:7px;flex-wrap:wrap}.event-admin-chip{padding:6px 8px;border:1px solid var(--line);border-radius:999px;color:var(--muted);font-size:9px;font-weight:800}.event-admin-chip.ready{border-color:rgba(200,255,61,.32);color:var(--lime)}.event-admin-chip.warn{border-color:rgba(255,180,87,.34);color:#ffc36d}.event-admin-actions button{flex:1;min-width:105px}.event-layout-dialog{width:min(1080px,calc(100% - 18px));max-height:94vh;padding:0;border:1px solid var(--line);border-radius:25px;background:#0a0c0c;color:#fff}.event-layout-dialog::backdrop{background:rgba(0,0,0,.82);backdrop-filter:blur(8px)}.event-layout-sheet{overflow:auto;max-height:94vh}.event-layout-head{position:sticky;top:0;z-index:20;display:flex;justify-content:space-between;gap:12px;padding:16px 18px;border-bottom:1px solid var(--line);background:rgba(10,12,12,.94);backdrop-filter:blur(12px)}.event-layout-head h2{margin:4px 0 0}.event-layout-head button{width:40px;height:40px;border:1px solid var(--line);border-radius:50%;background:rgba(255,255,255,.04);color:#fff;font-size:23px}.event-layout-body{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:14px;padding:16px}.event-layout-workspace{display:grid;gap:10px}.event-layout-toolbar{display:flex;gap:7px;flex-wrap:wrap}.event-layout-toolbar button,.event-layout-toolbar label{min-height:42px;padding:0 12px;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.04);color:#fff;font-weight:800;cursor:pointer}.event-layout-toolbar input{display:none}.event-layout-canvas{position:relative;min-height:520px;overflow:hidden;border:1px solid rgba(255,255,255,.1);border-radius:21px;background:radial-gradient(circle at 50% 42%,rgba(200,255,61,.08),transparent 34%),linear-gradient(145deg,#171b19,#090b0a);background-size:auto,auto,contain;background-position:center;background-repeat:no-repeat}.event-layout-table{position:absolute;transform:translate(-50%,-50%);display:grid;place-items:center;width:62px;height:62px;border:1px solid rgba(200,255,61,.58);border-radius:50%;background:rgba(29,40,27,.94);color:#fff;cursor:grab;touch-action:none}.event-layout-table.square{border-radius:15px}.event-layout-table.vip{width:82px;border-radius:20px;border-color:rgba(255,199,75,.65);background:#2b2216}.event-layout-table.selected{box-shadow:0 0 0 5px rgba(200,255,61,.18)}.event-layout-table b{font-size:11px}.event-layout-table small{font-size:7px;color:#cfd4ce}.event-layout-caption{padding:11px 13px;border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.025)}.event-layout-caption span{display:block;color:var(--muted);font-size:9px}.event-layout-caption strong{display:block;margin-top:4px;color:var(--lime)}.event-layout-side{display:grid;align-content:start;gap:11px}.event-layout-inspector{display:grid;gap:10px;padding:14px;border:1px solid var(--line);border-radius:17px;background:rgba(255,255,255,.025)}.event-layout-inspector label{display:grid;gap:5px;color:var(--muted);font-size:10px;font-weight:800}.event-layout-inspector input,.event-layout-inspector select{width:100%;min-height:43px;padding:0 11px;border:1px solid var(--line);border-radius:11px;background:rgba(255,255,255,.045);color:#fff}.event-layout-status{padding:13px;border:1px solid rgba(200,255,61,.2);border-radius:15px;background:rgba(200,255,61,.06);color:var(--muted);font-size:10px;line-height:1.5}.event-layout-status strong{color:var(--lime)}.event-layout-footer{display:flex;gap:8px;flex-wrap:wrap;padding:0 16px 16px}.event-layout-footer button{flex:1;min-width:160px}@media(max-width:820px){.event-layout-body{grid-template-columns:1fr}.event-layout-canvas{min-height:390px}.event-layout-side{grid-template-columns:1fr 1fr}}@media(max-width:560px){.event-layout-side{grid-template-columns:1fr}.event-layout-canvas{min-height:330px}.event-layout-body{padding:10px}.event-layout-head{padding:13px}}`;
    document.head.appendChild(style);
  }

  function ensureDialog() {
    if (document.getElementById("eventLayoutDialog")) return;
    document.body.insertAdjacentHTML("beforeend", '<dialog class="event-layout-dialog" id="eventLayoutDialog"><div class="event-layout-sheet"><div class="event-layout-head"><div><span class="eyebrow">ИНДИВИДУАЛЬНАЯ РАССАДКА</span><h2 id="eventLayoutTitle">Схема мероприятия</h2></div><button type="button" data-layout-close>×</button></div><div id="eventLayoutEditor"></div></div></dialog>');
    document.querySelector("[data-layout-close]").addEventListener("click", () => document.getElementById("eventLayoutDialog").close());
  }

  async function imageFile(file) {
    if (window.BaliImageTools?.fileToDataUrl) return window.BaliImageTools.fileToDataUrl(file, 1800, 0.86);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => resolve(String(reader.result || ""));
      reader.readAsDataURL(file);
    });
  }

  function selectedTable() {
    return draftLayout?.tables?.find((table) => table.id === selectedTableId) || null;
  }

  function canvasBackground(node) {
    if (!draftLayout?.background) return;
    const safe = String(draftLayout.background).replace(/\\/g, "\\\\").replace(/'/g, "%27");
    node.style.backgroundImage = `radial-gradient(circle at 50% 42%,rgba(200,255,61,.07),transparent 34%),linear-gradient(145deg,rgba(18,18,16,.78),rgba(8,10,9,.88)),url('${safe}')`;
    node.style.backgroundSize = "auto,auto,contain";
    node.style.backgroundPosition = "center,center,center";
    node.style.backgroundRepeat = "no-repeat,no-repeat,no-repeat";
  }

  function inspectorHtml() {
    const table = selectedTable();
    if (!table) return '<div class="event-layout-inspector"><strong>Выберите стол</strong><small class="muted">Нажмите на стол на схеме, чтобы изменить название, количество мест и форму.</small></div>';
    return `<form class="event-layout-inspector" id="eventTableInspector"><strong>${esc(table.name)}</strong><label><span>Название</span><input name="name" value="${esc(table.name)}"/></label><label><span>Количество мест</span><input name="seats" type="number" min="1" value="${Number(table.seats || 4)}"/></label><label><span>Форма</span><select name="shape"><option value="round" ${table.shape === "round" ? "selected" : ""}>Круглый</option><option value="square" ${table.shape === "square" ? "selected" : ""}>Квадратный</option><option value="vip" ${table.shape === "vip" ? "selected" : ""}>VIP-диван</option></select></label><button class="danger" id="deleteEventTable" type="button">Удалить стол</button></form>`;
  }

  function renderEditor() {
    const root = document.getElementById("eventLayoutEditor");
    if (!root || !activeEvent || !draftLayout) return;
    const ready = Boolean(draftLayout.background && draftLayout.tables.some((table) => table.active !== false));
    document.getElementById("eventLayoutTitle").textContent = `${activeEvent.title} · ${formatDate(activeEvent.event_date)}`;
    root.innerHTML = `<div class="event-layout-body"><div class="event-layout-workspace"><div class="event-layout-toolbar"><label>🖼 Загрузить схему<input id="eventLayoutImageInput" type="file" accept="image/*"/></label><button type="button" id="cloneBaseLayout">Копировать базовый шаблон</button><button type="button" id="addEventTable">＋ Добавить стол</button></div><div class="event-layout-canvas" id="eventLayoutCanvas">${draftLayout.tables.map((table) => `<button type="button" class="event-layout-table ${esc(table.shape || "round")} ${table.id === selectedTableId ? "selected" : ""}" style="left:${Number(table.x)}%;top:${Number(table.y)}%" data-layout-table="${table.id}"><b>${esc(tableLabel(table.name))}</b><small>${Number(table.seats || 0)} мест</small></button>`).join("")}</div><div class="event-layout-caption"><span>${formatDate(activeEvent.event_date).toUpperCase()} · ${esc(activeEvent.event_time || "23:00")}</span><strong>${esc(activeEvent.title)}</strong></div></div><aside class="event-layout-side">${inspectorHtml()}<div class="event-layout-status">${ready ? '<strong>Схема готова к публикации.</strong>' : '<strong>Схема ещё не готова.</strong>'}<br/>Для публикации нужна картинка локации и хотя бы один активный стол.</div></aside></div><div class="event-layout-footer"><button class="ghost" type="button" id="saveEventLayout">Сохранить рассадку</button><button class="primary" type="button" id="publishEventWithLayout" ${ready ? "" : "disabled"}>${activeEvent.active !== false ? "Обновить и оставить опубликованным" : "Сохранить и опубликовать"}</button></div>`;
    canvasBackground(document.getElementById("eventLayoutCanvas"));
    bindEditor();
  }

  function bindDragging() {
    const canvas = document.getElementById("eventLayoutCanvas");
    canvas.querySelectorAll("[data-layout-table]").forEach((node) => {
      let dragging = false;
      node.addEventListener("pointerdown", (event) => {
        selectedTableId = node.dataset.layoutTable;
        dragging = true;
        node.setPointerCapture(event.pointerId);
        canvas.querySelectorAll(".event-layout-table").forEach((item) => item.classList.toggle("selected", item === node));
      });
      node.addEventListener("pointermove", (event) => {
        if (!dragging) return;
        const rect = canvas.getBoundingClientRect();
        const x = Math.max(3, Math.min(97, ((event.clientX - rect.left) / rect.width) * 100));
        const y = Math.max(4, Math.min(96, ((event.clientY - rect.top) / rect.height) * 100));
        node.style.left = `${x}%`;
        node.style.top = `${y}%`;
        const table = selectedTable();
        if (table) { table.x = Number(x.toFixed(2)); table.y = Number(y.toFixed(2)); }
      });
      node.addEventListener("pointerup", () => { dragging = false; renderEditor(); });
      node.addEventListener("click", () => { selectedTableId = node.dataset.layoutTable; renderEditor(); });
    });
  }

  function bindEditor() {
    bindDragging();
    document.getElementById("eventLayoutImageInput")?.addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      draftLayout.background = await imageFile(file);
      draftLayout.background_name = file.name;
      renderEditor();
    });
    document.getElementById("cloneBaseLayout")?.addEventListener("click", async () => {
      const cloned = await layouts.cloneBase(activeEvent);
      draftLayout = { ...cloned, background: draftLayout.background || cloned.background, background_name: draftLayout.background_name || cloned.background_name };
      selectedTableId = draftLayout.tables[0]?.id || "";
      renderEditor();
    });
    document.getElementById("addEventTable")?.addEventListener("click", () => {
      const number = draftLayout.tables.length + 1;
      const table = { id: `${activeEvent.id}-custom-${Date.now()}`, name: `Стол ${number}`, seats: 4, x: 50, y: 50, shape: "round", active: true };
      draftLayout.tables.push(table);
      selectedTableId = table.id;
      renderEditor();
    });
    document.getElementById("eventTableInspector")?.addEventListener("input", (event) => {
      const table = selectedTable();
      if (!table) return;
      table[event.target.name] = event.target.name === "seats" ? Number(event.target.value || 1) : event.target.value;
      const node = document.querySelector(`[data-layout-table="${CSS.escape(table.id)}"]`);
      if (node) {
        node.className = `event-layout-table ${table.shape} selected`;
        node.querySelector("b").textContent = tableLabel(table.name);
        node.querySelector("small").textContent = `${table.seats} мест`;
      }
    });
    document.getElementById("deleteEventTable")?.addEventListener("click", () => {
      draftLayout.tables = draftLayout.tables.filter((table) => table.id !== selectedTableId);
      selectedTableId = draftLayout.tables[0]?.id || "";
      renderEditor();
    });
    document.getElementById("saveEventLayout")?.addEventListener("click", async () => {
      draftLayout = await layouts.save(activeEvent, draftLayout);
      toast(draftLayout.ready ? "Рассадка сохранена и готова" : "Черновик рассадки сохранён");
      renderEditor();
      if (state.view === "events") render();
    });
    document.getElementById("publishEventWithLayout")?.addEventListener("click", async () => {
      draftLayout = await layouts.save(activeEvent, draftLayout);
      if (!draftLayout.ready) return toast("Сначала загрузите схему и добавьте столы");
      activeEvent = await store.save("events", { ...activeEvent, active: true });
      toast("Мероприятие и рассадка опубликованы");
      document.getElementById("eventLayoutDialog").close();
      render();
    });
  }

  async function openLayout(eventId) {
    activeEvent = (await store.list("events")).find((event) => event.id === eventId);
    if (!activeEvent) return;
    draftLayout = await layouts.getForEvent(activeEvent) || await layouts.cloneBase(activeEvent);
    selectedTableId = draftLayout.tables[0]?.id || "";
    ensureDialog();
    renderEditor();
    document.getElementById("eventLayoutDialog").showModal();
  }

  async function eventCards(root) {
    await layouts.ensureForExistingEvents();
    const events = (await store.list("events")).sort(byDate);
    root.innerHTML = `<section class="panel"><div class="panel-head"><div><h3>Афиши и индивидуальная рассадка</h3><small>Сначала создайте афишу, затем настройте схему на её дату и только после этого публикуйте.</small></div></div><div class="panel-body"><div class="event-admin-grid">${events.length ? events.map((event) => {
      const layout = layouts.getByEventId(event.id);
      const ready = Boolean(layout?.ready && layout?.background && layout?.tables?.length);
      return `<article class="event-admin-card"><div class="event-admin-poster">${event.image_url ? `<img src="${esc(event.image_url)}" alt="${esc(event.title)}"/>` : '<div class="event-admin-poster-empty">BALI</div>'}</div><div class="event-admin-info"><div><span class="eyebrow">${formatDate(event.event_date).toUpperCase()} · ${esc(event.event_time || "23:00")}</span><h3>${esc(event.title)}</h3><p>${esc(event.description || "Описание не заполнено")}</p></div><div class="event-admin-chips"><span class="event-admin-chip ${ready ? "ready" : "warn"}">${ready ? `Схема готова · ${layout.tables.length} столов` : "Схема не готова"}</span><span class="event-admin-chip ${event.active !== false ? "ready" : ""}">${event.active !== false ? "Опубликовано" : "Черновик"}</span></div><div class="event-admin-actions"><button class="ghost" data-edit="events" data-id="${event.id}">Изменить</button><button class="ghost" data-event-layout="${event.id}">Рассадка</button><button class="${event.active !== false ? "danger" : "primary"}" data-event-publish="${event.id}" ${!ready && event.active === false ? "disabled" : ""}>${event.active !== false ? "Снять" : "Опубликовать"}</button><button class="icon-btn" data-event-delete="${event.id}">×</button></div></div></article>`;
    }).join("") : '<div class="empty">Афиш пока нет</div>'}</div></div></section>`;

    root.querySelectorAll("[data-event-layout]").forEach((button) => button.addEventListener("click", () => openLayout(button.dataset.eventLayout)));
    root.querySelectorAll("[data-event-publish]").forEach((button) => button.addEventListener("click", async () => {
      const event = events.find((item) => item.id === button.dataset.eventPublish);
      const layout = layouts.getByEventId(event.id);
      if (event.active === false && !layout?.ready) return toast("Сначала настройте рассадку мероприятия");
      await store.save("events", { ...event, active: event.active === false });
      toast(event.active === false ? "Мероприятие опубликовано" : "Мероприятие снято с публикации");
      render();
    }));
    root.querySelectorAll("[data-event-delete]").forEach((button) => button.addEventListener("click", async () => {
      if (!confirm("Удалить афишу и её индивидуальную рассадку?")) return;
      layouts.remove(button.dataset.eventDelete);
      await store.remove("events", button.dataset.eventDelete);
      toast("Афиша и рассадка удалены");
      render();
    }));
  }

  const baseOpenEditor = openEditor;
  openEditor = async function(type, row = null) {
    await baseOpenEditor(type, row);
    if (type !== "events") return;
    const layout = row?.id ? layouts.getByEventId(row.id) : null;
    const activeInput = document.querySelector('#editorFields input[name="active"]');
    if (activeInput && !layout?.ready) {
      activeInput.checked = false;
      activeInput.disabled = true;
      activeInput.closest("label")?.insertAdjacentHTML("afterend", '<div class="beta-note full">Новое мероприятие сохраняется как черновик. Опубликовать его можно после загрузки индивидуальной схемы и расстановки столов.</div>');
    }
  };

  const baseBookingEditor = openBookingEditor;
  openBookingEditor = async function(row = {}) {
    const events = (await store.list("events")).sort(byDate);
    const selectedEvent = events.find((event) => event.id === row?.event_id) || events.find((event) => event.event_date === row?.booking_date) || events[0];
    if (!selectedEvent) return baseBookingEditor(row);
    const layout = await layouts.getForEvent(selectedEvent);
    const tables = layout?.tables || [];
    state.editing = { type: "bookings", row: row || {} };
    $("#editorEyebrow").textContent = row?.id ? "РЕДАКТИРОВАНИЕ" : "НОВАЯ БРОНЬ";
    $("#editorTitle").textContent = "Бронирование мероприятия";
    const fields = [
      ["event_id", "Мероприятие", "select", true, "full", events.map((event) => [event.id, `${event.title} · ${formatDate(event.event_date)}`])],
      ["booking_date", "Дата", "date", true], ["booking_time", "Время", "time", true],
      ["table_id", "Стол", "select", true, "", tables.map((table) => [table.id, `${table.name} · ${table.seats} мест`])],
      ["status", "Статус", "select", true, "", Object.entries(statusLabels)], ["name", "Имя клиента", "text", true],
      ["phone", "Телефон", "tel", true], ["guests", "Количество гостей", "number", true], ["telegram", "Telegram", "text"], ["comment", "Комментарий", "textarea", false, "full"]
    ];
    const source = { ...row, event_id: selectedEvent.id, booking_date: row?.booking_date || selectedEvent.event_date, booking_time: row?.booking_time || selectedEvent.event_time || "23:00" };
    $("#editorFields").innerHTML = fields.map(([name, label, type, required, cls, options]) => fieldHtml(name, label, type, source[name] ?? source[name === "name" ? "customer_name" : name], required, cls, options)).join("");
    $("#editorFields select[name='event_id']").addEventListener("change", async (event) => {
      const chosen = events.find((item) => item.id === event.target.value);
      const chosenLayout = await layouts.getForEvent(chosen);
      $("#editorFields input[name='booking_date']").value = chosen.event_date;
      $("#editorFields input[name='booking_time']").value = chosen.event_time || "23:00";
      $("#editorFields select[name='table_id']").innerHTML = (chosenLayout?.tables || []).map((table) => `<option value="${table.id}">${esc(table.name)} · ${Number(table.seats)} мест</option>`).join("");
    });
    $("#editorDialog").showModal();
  };

  injectStyles();
  ensureDialog();
  titles.events = "Афиши и рассадка";
  const eventsLabel = document.querySelector('[data-view="events"] span');
  if (eventsLabel) eventsLabel.textContent = "Афиши + рассадка";
  const hallLabel = document.querySelector('[data-view="hall"] span');
  if (hallLabel) hallLabel.textContent = "Базовый шаблон";
  renderEvents = eventCards;
  if (state.view === "events") render();
})();