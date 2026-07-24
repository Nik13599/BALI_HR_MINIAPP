(() => {
  if (window.__BALI_ADMIN_PRODUCTION_COMPLETE_RUNTIME__) return;
  window.__BALI_ADMIN_PRODUCTION_COMPLETE_RUNTIME__ = true;

  const store = window.BaliStore;
  const $ = (selector, root = document) => root.querySelector(selector);
  const escHtml = (value = "") => String(value).replace(/[&<>'"]/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[ch]));
  const number = value => Number(value || 0).toLocaleString("ru-RU");
  let loyaltyTab = "rules";
  let editing = null;

  const tableNames = {
    loyalty_rules: "Правило начисления",
    loyalty_rewards: "Награда",
    loyalty_gifts: "Подарок"
  };

  const definitions = {
    loyalty_rules: [
      ["title", "Название правила", "text", true],
      ["action", "Код действия", "text", true],
      ["points", "Количество баллов", "number", true],
      ["description", "Описание", "textarea", false],
      ["active", "Правило активно", "checkbox", false]
    ],
    loyalty_rewards: [
      ["title", "Название награды", "text", true],
      ["description", "Описание", "textarea", false],
      ["icon", "Иконка", "text", false],
      ["points_cost", "Стоимость в баллах", "number", false],
      ["stock", "Количество (пусто — без ограничений)", "number", false],
      ["active", "Награда активна", "checkbox", false]
    ],
    loyalty_gifts: [
      ["title", "Название подарка", "text", true],
      ["description", "Описание", "textarea", false],
      ["icon", "Иконка", "text", false],
      ["image", "Ссылка на изображение", "url", false],
      ["points_cost", "Стоимость в баллах", "number", false],
      ["stock", "Количество (пусто — без ограничений)", "number", false],
      ["active", "Подарок активен", "checkbox", false]
    ]
  };

  function ensureStyles() {
    if ($("#adminCompleteRuntimeStyle")) return;
    const style = document.createElement("style");
    style.id = "adminCompleteRuntimeStyle";
    style.textContent = `
      .admin-complete-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}
      .admin-complete-tabs button{min-height:40px;padding:0 13px;border:1px solid var(--line);border-radius:11px;background:#111614;color:#fff}
      .admin-complete-tabs button.active{background:var(--lime);color:#07100c;border-color:var(--lime)}
      .admin-complete-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:14px}
      .admin-complete-card{padding:15px;border:1px solid var(--line);border-radius:16px;background:#101412}
      .admin-complete-card span{display:block;color:var(--muted);font-size:8px;font-weight:900;letter-spacing:.1em}
      .admin-complete-card strong{display:block;margin-top:7px;color:var(--lime);font:600 28px Unbounded}
      .admin-complete-form{display:grid;gap:11px}.admin-complete-form label{display:grid;gap:6px;color:var(--muted);font-size:9px;font-weight:800}
      .admin-complete-form input,.admin-complete-form textarea,.admin-complete-form select{width:100%;min-height:45px;padding:9px 11px;border:1px solid var(--line);border-radius:12px;background:#111614;color:#fff}
      .admin-complete-form textarea{min-height:90px;resize:vertical}.admin-complete-check{display:flex!important;align-items:center;justify-content:space-between}.admin-complete-check input{width:22px!important;min-height:22px!important}
      .admin-health{display:grid;gap:8px}.admin-health-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:11px;border:1px solid var(--line);border-radius:13px;background:#ffffff05}.admin-health-row small{display:block;margin-top:3px;color:var(--muted)}
      .admin-health-row b.ok{color:var(--lime)}.admin-health-row b.warn{color:#ffd36a}.admin-health-row b.bad{color:#ff9b9b}
      .admin-inline-actions{display:flex;gap:7px;justify-content:flex-end;flex-wrap:wrap}.admin-inline-actions button{min-height:36px;padding:0 10px}
      @media(max-width:900px){.admin-complete-grid{grid-template-columns:1fr}.data-table{min-width:720px}.panel{overflow:auto}}
    `;
    document.head.appendChild(style);
  }

  function addNavigation() {
    const nav = $("#adminNav");
    if (!nav) return;
    if (!nav.querySelector('[data-view="reviews"]')) {
      const button = document.createElement("button");
      button.dataset.view = "reviews";
      button.innerHTML = "✦ <span>Отзывы</span>";
      nav.insertBefore(button, nav.querySelector('[data-view="settings"]'));
    }
  }

  function uniqueCustomers(rows = []) {
    const map = new Map();
    for (const row of rows) {
      const phone = String(row.phone || "").replace(/\D/g, "");
      const telegram = String(row.telegram || row.username || "").replace(/^@/, "").trim().toLowerCase();
      const key = phone ? `phone:${phone}` : telegram ? `tg:${telegram}` : `id:${row.id}`;
      const previous = map.get(key);
      if (!previous || String(row.updated_at || row.created_at || "") > String(previous.updated_at || previous.created_at || "")) map.set(key, row);
    }
    return [...map.values()];
  }

  async function fixCustomerViews() {
    const rows = uniqueCustomers(await store.list("customers"));
    if (state.view === "dashboard") {
      const stat = $("#content .stats .stat-card:nth-child(2) strong");
      if (stat) stat.textContent = String(rows.length);
    }
    if (state.view === "customers") {
      const table = $("#customerTable");
      if (table && typeof customersTable === "function") table.innerHTML = customersTable(rows);
      const subtitle = $("#content .panel-head small");
      if (subtitle) subtitle.textContent = `${rows.length} реальных карточек клиентов`;
    }
  }

  function statusBadge(active) {
    return `<span class="status ${active !== false ? "available" : "completed"}">${active !== false ? "Активно" : "Скрыто"}</span>`;
  }

  function empty(text) { return `<div class="empty">${escHtml(text)}</div>`; }

  function ruleTable(rows) {
    return rows.length ? `<table class="data-table"><thead><tr><th>Правило</th><th>Действие</th><th>Баллы</th><th>Статус</th><th></th></tr></thead><tbody>${rows.map(row => `<tr><td><strong>${escHtml(row.title)}</strong><br><small>${escHtml(row.description || "")}</small></td><td><code>${escHtml(row.action)}</code></td><td><strong>${Number(row.points || 0) > 0 ? "+" : ""}${Number(row.points || 0)}</strong></td><td>${statusBadge(row.active)}</td><td><div class="admin-inline-actions"><button class="icon-btn" data-loyalty-edit="loyalty_rules" data-id="${escHtml(row.id)}">✎</button><button class="icon-btn" data-loyalty-delete="loyalty_rules" data-id="${escHtml(row.id)}">×</button></div></td></tr>`).join("")}</tbody></table>` : empty("Правила начисления пока не созданы");
  }

  function catalogTable(rows, type) {
    const isGift = type === "loyalty_gifts";
    return rows.length ? `<table class="data-table"><thead><tr><th>${isGift ? "Подарок" : "Награда"}</th><th>Стоимость</th><th>Остаток</th><th>Статус</th><th></th></tr></thead><tbody>${rows.map(row => `<tr><td><strong>${escHtml(row.icon || (isGift ? "🎁" : "🏆"))} ${escHtml(row.title)}</strong><br><small>${escHtml(row.description || "")}</small></td><td>${number(row.points_cost)} баллов</td><td>${row.stock === null || row.stock === undefined || row.stock === "" ? "Без ограничений" : number(row.stock)}</td><td>${statusBadge(row.active)}</td><td><div class="admin-inline-actions"><button class="icon-btn" data-loyalty-edit="${type}" data-id="${escHtml(row.id)}">✎</button><button class="icon-btn" data-loyalty-delete="${type}" data-id="${escHtml(row.id)}">×</button></div></td></tr>`).join("")}</tbody></table>` : empty(isGift ? "Каталог подарков пока пуст" : "Таблица наград пока пуста");
  }

  function grantsTable(rewardGrants, giftGrants, rewards, gifts) {
    const rewardMap = new Map(rewards.map(row => [String(row.id), row]));
    const giftMap = new Map(gifts.map(row => [String(row.id), row]));
    const rows = [
      ...rewardGrants.map(row => ({ ...row, kind: "Награда", title: rewardMap.get(String(row.reward_id))?.title || row.reward_title || "Награда BALI", user: row.user_key })),
      ...giftGrants.map(row => ({ ...row, kind: "Подарок", title: giftMap.get(String(row.gift_id))?.title || row.gift_title || "Подарок BALI", user: row.to_user_key, from: row.from_user_key }))
    ].sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
    return rows.length ? `<table class="data-table"><thead><tr><th>Тип</th><th>Название</th><th>Получатель</th><th>Отправитель</th><th>Дата</th></tr></thead><tbody>${rows.map(row => `<tr><td>${escHtml(row.kind)}</td><td><strong>${escHtml(row.title)}</strong></td><td>${escHtml(row.user || "—")}</td><td>${escHtml(row.from || "BALI")}</td><td>${row.created_at ? new Date(row.created_at).toLocaleString("ru-RU") : "—"}</td></tr>`).join("")}</tbody></table>` : empty("История выдач пока пуста");
  }

  async function renderBonuses() {
    const root = $("#content");
    $("#pageTitle").textContent = "Баллы + VIP";
    const action = $("#primaryAction");
    action.style.display = "inline-flex";
    action.textContent = loyaltyTab === "rules" ? "Добавить правило" : loyaltyTab === "rewards" ? "Добавить награду" : loyaltyTab === "gifts" ? "Добавить подарок" : "Добавить";
    if (loyaltyTab === "history") action.style.display = "none";
    root.innerHTML = empty("Загрузка таблиц баллов и наград…");

    const [rules, rewards, gifts, rewardGrants, giftGrants] = await Promise.all([
      store.list("loyalty_rules"), store.list("loyalty_rewards"), store.list("loyalty_gifts"),
      store.list("reward_grants"), store.list("gift_grants")
    ]);

    const activeRules = rules.filter(row => row.active !== false).length;
    const activeRewards = rewards.filter(row => row.active !== false).length;
    const activeGifts = gifts.filter(row => row.active !== false).length;
    const body = loyaltyTab === "rules" ? ruleTable(rules)
      : loyaltyTab === "rewards" ? catalogTable(rewards, "loyalty_rewards")
      : loyaltyTab === "gifts" ? catalogTable(gifts, "loyalty_gifts")
      : grantsTable(rewardGrants, giftGrants, rewards, gifts);

    root.innerHTML = `<div class="admin-complete-grid"><article class="admin-complete-card"><span>ПРАВИЛ НАЧИСЛЕНИЯ</span><strong>${activeRules}</strong></article><article class="admin-complete-card"><span>НАГРАД В КАТАЛОГЕ</span><strong>${activeRewards}</strong></article><article class="admin-complete-card"><span>ПОДАРКОВ В КАТАЛОГЕ</span><strong>${activeGifts}</strong></article></div><section class="panel"><div class="panel-head"><div><h3>Управление программой лояльности</h3><small>Все таблицы доступны для создания, редактирования и удаления</small></div></div><div class="panel-body"><div class="admin-complete-tabs"><button data-loyalty-tab="rules" class="${loyaltyTab === "rules" ? "active" : ""}">Правила начисления</button><button data-loyalty-tab="rewards" class="${loyaltyTab === "rewards" ? "active" : ""}">Награды</button><button data-loyalty-tab="gifts" class="${loyaltyTab === "gifts" ? "active" : ""}">Подарки</button><button data-loyalty-tab="history" class="${loyaltyTab === "history" ? "active" : ""}">История выдач</button></div>${body}</div></section>`;
  }

  function ensureEditor() {
    if ($("#loyaltyEditorDialog")) return;
    document.body.insertAdjacentHTML("beforeend", `<dialog id="loyaltyEditorDialog" class="modal"><button class="modal-close" type="button" data-close-loyalty>×</button><form id="loyaltyEditorForm" class="editor-form admin-complete-form"><div><span class="eyebrow">БАЛЛЫ + VIP</span><h3 id="loyaltyEditorTitle">Запись</h3></div><div id="loyaltyEditorFields" class="editor-fields"></div><div class="modal-actions"><button type="button" class="ghost" data-close-loyalty>Отмена</button><button type="submit" class="primary">Сохранить</button></div></form></dialog>`);
  }

  function field([name, label, type, required], value) {
    if (type === "checkbox") return `<label class="admin-complete-check full"><span>${escHtml(label)}</span><input name="${name}" type="checkbox" ${value !== false ? "checked" : ""}></label>`;
    if (type === "textarea") return `<label class="full"><span>${escHtml(label)}</span><textarea name="${name}" ${required ? "required" : ""}>${escHtml(value || "")}</textarea></label>`;
    return `<label><span>${escHtml(label)}</span><input name="${name}" type="${type}" value="${escHtml(value ?? "")}" ${required ? "required" : ""}></label>`;
  }

  async function openLoyaltyEditor(type, id = "") {
    ensureEditor();
    const rows = await store.list(type);
    const row = rows.find(item => String(item.id) === String(id)) || {};
    editing = { type, row };
    $("#loyaltyEditorTitle").textContent = `${row.id ? "Редактировать" : "Создать"}: ${tableNames[type]}`;
    $("#loyaltyEditorFields").innerHTML = definitions[type].map(def => field(def, row[def[0]])).join("");
    $("#loyaltyEditorDialog").showModal();
  }

  async function databaseHealth() {
    const tables = ["loyalty_rules", "loyalty_rewards", "reward_grants", "loyalty_gifts", "gift_grants", "reviews", "app_settings", "app_users", "event_checkins"];
    if (!store.cloudEnabled || !store.client) return tables.map(table => ({ table, ok: false, local: true, message: "Локальное хранилище" }));
    return Promise.all(tables.map(async table => {
      try {
        const { error } = await store.client.from(table).select("id").limit(1);
        if (error) return { table, ok: false, message: error.message };
        return { table, ok: true, message: "Подключено" };
      } catch (error) { return { table, ok: false, message: error.message }; }
    }));
  }

  async function qrHealth() {
    const events = await store.list("events").catch(() => []);
    const checkins = window.BaliEventQrAttendance?.listCheckins ? await window.BaliEventQrAttendance.listCheckins().catch(() => []) : await store.list("event_checkins").catch(() => []);
    return {
      api: Boolean(window.BaliEventQrAttendance?.checkIn && window.BaliEventQrAttendance?.listCheckins),
      events: events.length,
      tokens: events.filter(event => event.qr_token).length,
      checkins: checkins.length
    };
  }

  async function renderSettingsComplete() {
    const root = $("#content");
    $("#pageTitle").textContent = "Настройки";
    $("#primaryAction").style.display = "none";
    root.innerHTML = empty("Проверяем настройки и таблицы…");
    const [settingsRows, health, qr] = await Promise.all([store.list("app_settings"), databaseHealth(), qrHealth()]);
    const settings = settingsRows.find(row => String(row.id) === "main") || settingsRows[0] || { id: "main" };
    root.innerHTML = `<div class="settings-grid"><section class="panel"><div class="panel-head"><div><h3>Настройки приложения BALI</h3><small>Изменения сохраняются в общей таблице app_settings</small></div></div><div class="panel-body"><form id="adminAppSettingsForm" class="admin-complete-form" data-id="${escHtml(settings.id || "main")}"><label><span>Название клуба</span><input name="club_name" value="${escHtml(settings.club_name || "BALI")}"></label><label><span>Адрес</span><input name="address" value="${escHtml(settings.address || "Минск, ул. Кирова, 13")}"></label><label><span>Телефон</span><input name="phone" value="${escHtml(settings.phone || "+375 (29) 670-03-00")}"></label><label><span>Заголовок событий</span><input name="events_title" value="Ближайшие события" readonly></label><label><span>Заголовок информации о клубе</span><input name="about_title" value="О клубе" readonly></label><label><span>Баллы за QR-посещение</span><input name="attendance_points" type="number" value="${Number(settings.attendance_points ?? 100)}"></label><button class="primary" type="submit">Сохранить настройки</button></form></div></section><section class="panel"><div class="panel-head"><div><h3>Состояние базы данных</h3><small>Проверка таблиц без использования кэша</small></div><a class="ghost" href="./bali-production-database-final.sql" target="_blank">Открыть SQL</a></div><div class="panel-body admin-health">${health.map(row => `<div class="admin-health-row"><div><strong>${escHtml(row.table)}</strong><small>${escHtml(row.message)}</small></div><b class="${row.ok ? "ok" : row.local ? "warn" : "bad"}">${row.ok ? "РАБОТАЕТ" : row.local ? "ЛОКАЛЬНО" : "НЕТ ТАБЛИЦЫ"}</b></div>`).join("")}</div></section><section class="panel"><div class="panel-head"><div><h3>Проверка QR-сканера</h3><small>Создание QR, запись входа и история посещений</small></div></div><div class="panel-body admin-health"><div class="admin-health-row"><div><strong>Модуль QR</strong><small>BaliEventQrAttendance</small></div><b class="${qr.api ? "ok" : "bad"}">${qr.api ? "РАБОТАЕТ" : "НЕ ЗАГРУЖЕН"}</b></div><div class="admin-health-row"><div><strong>Мероприятий</strong><small>Всего / с созданным QR-токеном</small></div><b class="${qr.events === qr.tokens ? "ok" : "warn"}">${qr.events} / ${qr.tokens}</b></div><div class="admin-health-row"><div><strong>Записей сканирования</strong><small>event_checkins</small></div><b class="ok">${qr.checkins}</b></div></div></section></div>`;
  }

  const baseRender = render;
  render = async function() {
    addNavigation();
    if (state.view === "bonuses") return renderBonuses();
    if (state.view === "settings") return renderSettingsComplete();
    await baseRender();
    if (["dashboard", "customers"].includes(state.view)) await fixCustomerViews();
  };

  document.addEventListener("click", async event => {
    const tab = event.target.closest("[data-loyalty-tab]");
    if (tab) {
      loyaltyTab = tab.dataset.loyaltyTab;
      await renderBonuses();
      return;
    }
    const edit = event.target.closest("[data-loyalty-edit]");
    if (edit) return openLoyaltyEditor(edit.dataset.loyaltyEdit, edit.dataset.id);
    const del = event.target.closest("[data-loyalty-delete]");
    if (del && confirm("Удалить запись без возможности восстановления?")) {
      await store.remove(del.dataset.loyaltyDelete, del.dataset.id);
      toast("Удалено");
      await renderBonuses();
      return;
    }
    if (event.target.closest("[data-close-loyalty]")) $("#loyaltyEditorDialog")?.close();
  }, true);

  $("#primaryAction")?.addEventListener("click", event => {
    if (state.view !== "bonuses") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const type = loyaltyTab === "rules" ? "loyalty_rules" : loyaltyTab === "rewards" ? "loyalty_rewards" : loyaltyTab === "gifts" ? "loyalty_gifts" : "";
    if (type) openLoyaltyEditor(type);
  }, true);

  document.addEventListener("submit", async event => {
    if (event.target.id === "loyaltyEditorForm") {
      event.preventDefault();
      const form = event.target;
      const data = Object.fromEntries(new FormData(form).entries());
      const payload = { ...editing.row, ...data };
      definitions[editing.type].forEach(([name, , type]) => {
        if (type === "checkbox") payload[name] = form.elements[name].checked;
        if (type === "number") payload[name] = data[name] === "" ? null : Number(data[name] || 0);
      });
      await store.save(editing.type, payload);
      $("#loyaltyEditorDialog").close();
      toast("Сохранено");
      await renderBonuses();
      return;
    }
    if (event.target.id === "adminAppSettingsForm") {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.target).entries());
      await store.save("app_settings", { id: event.target.dataset.id || "main", ...data, attendance_points: Number(data.attendance_points || 100), events_title: "Ближайшие события", about_title: "О клубе" });
      toast("Настройки сохранены");
      await renderSettingsComplete();
    }
  }, true);

  window.addEventListener("bali:storage-fallback", event => {
    const table = event.detail?.table;
    if (table && state.view !== "dashboard") console.warn(`[BALI admin] ${table} работает через локальный резерв`);
  });

  ensureStyles();
  ensureEditor();
  addNavigation();
  window.BaliAdminComplete = { renderBonuses, renderSettingsComplete, uniqueCustomers, databaseHealth, qrHealth };
})();