(() => {
  const points = window.BaliPoints;
  if (!points) return;
  const byDate = (a, b) => `${a.event_date || "9999-12-31"}T${a.event_time || "23:59"}`.localeCompare(`${b.event_date || "9999-12-31"}T${b.event_time || "23:59"}`);
  const icon = (type) => ({ referral: "👥", attendance: "🎟", event: "↗" })[type] || "★";
  const when = (value) => new Date(value).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  titles.bonuses = "BALI-Баллы";
  if (editorDefinitions?.events?.fields) editorDefinitions.events.fields = editorDefinitions.events.fields.filter((field) => field[0] !== "sort_order");

  async function renderPointsAdmin(root) {
    const rules = points.settings();
    const profile = points.profile();
    const ledger = points.ledger();
    const codes = points.visits();
    const events = (await store.list("events")).sort(byDate);
    const total = ledger.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    root.innerHTML = `
      <div class="bonus-admin-grid">
        <section class="panel">
          <div class="panel-head"><div><h3>Правила начисления баллов</h3><small>Количество баллов меняется без правки кода</small></div></div>
          <div class="panel-body">
            <form class="bonus-settings" id="pointsSettingsForm">
              <label><span>За приглашение друга</span><input name="referral" type="number" min="0" value="${Number(rules.referral)}" /></label>
              <label><span>За посещение мероприятия</span><input name="attendance" type="number" min="0" value="${Number(rules.attendance)}" /></label>
              <label><span>За репост одной афиши</span><input name="eventShare" type="number" min="0" value="${Number(rules.eventShare)}" /></label>
              <button class="primary" type="submit">Сохранить правила</button>
              <div class="beta-note">В Beta3 посещение подтверждается одноразовым кодом, который администратор создаёт ниже.</div>
            </form>
          </div>
        </section>
        <section class="panel">
          <div class="panel-head"><div><h3>Коды посещения</h3><small>Выдайте код гостю после фактического посещения</small></div><button class="danger" id="clearVisitCodes" type="button">Очистить</button></div>
          <div class="panel-body">
            <form class="bonus-settings" id="visitCodeForm">
              <label><span>Мероприятие</span><select name="eventId">${events.map((event) => `<option value="${event.id}">${esc(event.title)} · ${formatDate(event.event_date)}</option>`).join("") || '<option value="">Без мероприятия</option>'}</select></label>
              <label><span>Баллы за этот код</span><input name="amount" type="number" min="0" value="${Number(rules.attendance)}" /></label>
              <button class="primary" type="submit">Создать одноразовый код</button>
            </form>
            <div class="bonus-ledger" style="margin-top:14px">${codes.length ? codes.slice(0, 15).map((code) => `<div class="bonus-ledger-row"><i>${code.usedAt ? "✓" : "🎟"}</i><div><strong>${esc(code.code)}</strong><small>${esc(code.eventTitle || "Посещение BALI")} · ${code.usedAt ? "использован" : "активен"}</small></div><button class="icon-btn" data-copy-visit="${esc(code.code)}">⧉</button></div>`).join("") : '<div class="empty">Кодов посещения пока нет</div>'}</div>
          </div>
        </section>
        <section class="panel" style="grid-column:1/-1">
          <div class="panel-head"><div><h3>Тестовая активность</h3><small>Начисления гостевой части этого браузера</small></div><button class="danger" id="resetPointsDemo" type="button">Сбросить баланс</button></div>
          <div class="panel-body">
            <div class="bonus-admin-stats"><div class="bonus-admin-stat"><span>БАЛАНС</span><strong>${Number(profile.balance || 0)}</strong></div><div class="bonus-admin-stat"><span>НАЧИСЛЕНО</span><strong>${total}</strong></div><div class="bonus-admin-stat"><span>ОПЕРАЦИЙ</span><strong>${ledger.length}</strong></div></div>
            <div class="bonus-ledger">${ledger.length ? ledger.slice(0, 12).map((item) => `<div class="bonus-ledger-row"><i>${icon(item.type)}</i><div><strong>${esc(item.title)}</strong><small>${when(item.createdAt)}</small></div><b>+${Number(item.amount || 0)}</b></div>`).join("") : '<div class="empty">Тестовых начислений пока нет</div>'}</div>
          </div>
        </section>
      </div>`;

    $("#pointsSettingsForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      points.write(points.keys.settings, { referral: Math.max(0, Number(data.referral || 0)), attendance: Math.max(0, Number(data.attendance || 0)), eventShare: Math.max(0, Number(data.eventShare || 0)) });
      toast("Правила BALI-Баллов сохранены"); render();
    });
    $("#visitCodeForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      const selected = events.find((item) => item.id === data.eventId);
      const rows = points.visits();
      const code = `VISIT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      rows.unshift({ code, eventId: selected?.id || "", eventTitle: selected?.title || "Посещение BALI", eventDate: selected?.event_date || "", amount: Math.max(0, Number(data.amount || rules.attendance)), createdAt: new Date().toISOString(), usedAt: null });
      points.write(points.keys.visits, rows.slice(0, 100));
      navigator.clipboard?.writeText(code);
      toast(`Код ${code} создан и скопирован`); render();
    });
    root.addEventListener("click", async (event) => {
      const copy = event.target.closest("[data-copy-visit]");
      if (copy) { await navigator.clipboard.writeText(copy.dataset.copyVisit); toast("Код скопирован"); }
    });
    $("#clearVisitCodes").addEventListener("click", () => { if (confirm("Удалить все коды посещения?")) { points.write(points.keys.visits, []); render(); } });
    $("#resetPointsDemo").addEventListener("click", () => {
      if (!confirm("Сбросить тестовый баланс и историю начислений?")) return;
      const current = points.profile(); points.write(points.keys.profile, { ...current, balance: 0 }); points.write(points.keys.ledger, []); points.write(points.keys.actions, {}); toast("Тестовые баллы сброшены"); render();
    });
  }

  renderEvents = async function(root) {
    const rows = (await store.list("events")).sort(byDate);
    root.innerHTML = `<section class="panel"><div class="panel-head"><div><h3>Афиши и события</h3><small>Ближайшие даты показываются первыми; загружайте изображение для каждой афиши</small></div></div>${rows.length ? `<table class="data-table"><thead><tr><th>Изображение</th><th>Событие</th><th>Дата</th><th>Время</th><th>Статус</th><th></th></tr></thead><tbody>${rows.map((row) => `<tr><td>${row.image_url ? `<img class="poster-admin-thumb" src="${esc(row.image_url)}" alt="${esc(row.title)}"/>` : '<div class="poster-admin-empty">НЕТ<br>ФОТО</div>'}</td><td><strong>${esc(row.title)}</strong><br><small>${esc(row.description)}</small></td><td>${formatDate(row.event_date)}</td><td>${esc(row.event_time)}</td><td><span class="status ${row.active !== false ? "available" : "completed"}">${row.active !== false ? "Опубликовано" : "Черновик"}</span></td><td><div class="row-actions"><button class="icon-btn" data-edit="events" data-id="${row.id}">✎</button><button class="icon-btn" data-delete="events" data-id="${row.id}">×</button></div></td></tr>`).join("")}</tbody></table>` : '<div class="empty">Афиш пока нет</div>'}</section>`;
  };

  const baseHall = renderHall;
  renderHall = async function(root) { await baseHall(root); const layout = $("#hallLayout", root); if (layout?.classList.contains("has-background")) layout.style.backgroundSize = "auto, auto, contain"; };
  const baseRender = render;
  render = async function() { if (state.view !== "bonuses") return baseRender(); $("#pageTitle").textContent = "BALI-Баллы"; $("#primaryAction").style.display = "none"; await renderPointsAdmin($("#content")); };
  window.addEventListener("storage", (event) => { if (Object.values(points.keys).includes(event.key) && state.view === "bonuses") render(); });
})();