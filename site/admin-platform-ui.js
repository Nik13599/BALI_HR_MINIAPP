(() => {
  "use strict";
  const views = new Set([
    "dashboard", "crm", "events", "bookings", "operations", "layouts",
    "economy", "content", "campaigns", "moderation",
  ]);
  const content = document.getElementById("adminContent");
  const sidebar = document.getElementById("chatSidebar");
  const toastNode = document.getElementById("adminToast");
  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  }[char]));
  const fmt = value => value ? new Date(value).toLocaleString("ru-RU") : "—";
  const api = async (path, options = {}) => {
    const response = await fetch(path, {
      credentials: "same-origin",
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    });
    if (response.status === 204) return null;
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error?.message || "Ошибка запроса");
    return payload;
  };
  const send = (path, method, body = {}) => api(path, { method, body: JSON.stringify(body) });
  let designState = { assets: [], blocks: [], navigation: [] };
  let economyState = { rewards: [], gifts: [], vipPlans: [], shopItems: [], seasons: [] };
  const uploadImage = async file => {
    const response = await fetch("/api/v1/admin/content/uploads", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": file.type },
      body: file,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error?.message || "Не удалось загрузить изображение");
    return payload.upload;
  };
  const toast = message => {
    toastNode.textContent = message;
    toastNode.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => toastNode.classList.remove("show"), 2300);
  };
  const head = (label, title, copy = "") => `<header class="content-head"><div><p class="eyebrow">${esc(label)}</p><h1>${esc(title)}</h1>${copy ? `<p>${esc(copy)}</p>` : ""}</div></header>`;
  const field = (label, name, value = "", type = "text", required = false) => `<label class="field">${esc(label)}<input name="${esc(name)}" type="${type}" value="${esc(value)}" ${required ? "required" : ""}></label>`;
  const start = () => {
    sidebar.hidden = true;
    content.innerHTML = '<div class="admin-empty">Загружаем актуальные данные…</div>';
  };
  const row = (title, detail, action = "") => `<article class="data-row"><div><b>${esc(title)}</b><small>${esc(detail)}</small></div>${action || "<span>ON</span>"}</article>`;

  async function dashboard() {
    start();
    const data = await api("/api/v1/admin/dashboard");
    const labels = {
      activeUsers: "Активные пользователи",
      upcomingEvents: "Предстоящие события",
      activeBookings: "Активные брони",
      todayCheckIns: "Check-in сегодня",
      openModeration: "Открытые жалобы",
      pointsBalance: "Баллы на счетах",
      pointsEarned: "Всего начислено",
      pointsSpent: "Всего списано",
      activeCampaigns: "Активные рассылки",
      completedCampaigns: "Завершённые рассылки",
    };
    content.innerHTML = head("BALI PRODUCTION", "Операционный дашборд", "Актуальные данные PostgreSQL") +
      `<section class="platform-metrics">${Object.entries(data.metrics).map(([key, value]) =>
        `<article><small>${esc(labels[key] || key)}</small><strong>${Number(value).toLocaleString("ru-RU")}</strong></article>`
      ).join("")}</section>`;
  }

  async function crm(search = "") {
    start();
    const [data, merges] = await Promise.all([
      api(`/api/v1/admin/crm/users?search=${encodeURIComponent(search)}&limit=500`),
      api("/api/v1/admin/crm/merge-reviews?status=pending"),
    ]);
    content.innerHTML = head("ЕДИНАЯ КАРТОЧКА ГОСТЯ", "CRM", "Telegram, профиль, брони, баллы, подарки, VIP и кланы без дублей") + `
      ${merges.reviews.length ? `<section class="admin-panel full"><h2>Ручная проверка Telegram ID · ${merges.reviews.length}</h2>
        <p class="platform-copy">Автоматическое объединение отключено. «Связать» сохраняет существующую CRM-карточку; «Не связывать» освобождает Telegram ID для нового аккаунта.</p>
        <div class="data-list">${merges.reviews.map(item => row(
          `${item.candidate_name || item.candidate_user_key} · Telegram ${item.legacy_id}`,
          `${item.reason} · ${fmt(item.created_at)}`,
          `<div class="panel-actions"><button class="small-button" data-resolve-merge="${esc(item.id)}" data-merge-status="linked">Связать</button><button class="small-button" data-resolve-merge="${esc(item.id)}" data-merge-status="ignored">Не связывать</button></div>`
        )).join("")}</div></section>` : ""}
      <section class="admin-panel full">
        <form id="platformCrmSearch" class="platform-inline">${field("Имя, телефон, username или Telegram ID", "search", search, "search")}<button class="small-button">Найти</button></form>
        <div class="table-wrap"><table><thead><tr><th>Гость</th><th>Telegram</th><th>Контакт</th><th>Баллы</th><th>Брони</th><th>Кланы</th><th>Статус</th><th></th></tr></thead>
        <tbody>${data.users.map(item => `<tr>
          <td>${esc(item.name)}<br><small>${esc(item.user_key)}</small></td>
          <td>${item.telegram_user_id ? esc(item.telegram_user_id) : "—"}<br><small>${item.username ? `@${esc(item.username)}` : ""}</small></td>
          <td>${esc(item.phone || "—")}</td><td>${Number(item.points_balance || 0).toLocaleString("ru-RU")}</td>
          <td>${Number(item.booking_count || 0)}</td><td>${esc([item.personal_clan_name, item.corporate_clan_name].filter(Boolean).join(" · ") || "—")}</td>
          <td>${esc(item.account_status)} · ${esc(item.trust_status)}</td>
          <td><button class="small-button" data-crm-user="${esc(item.user_key)}">Карточка</button></td>
        </tr>`).join("")}</tbody></table></div>
      </section>`;
  }

  async function crmDetail(userKey) {
    start();
    const [data, economyData, clanData] = await Promise.all([
      api(`/api/v1/admin/crm/users/${encodeURIComponent(userKey)}`),
      api("/api/v1/admin/economy"),
      api("/api/v1/admin/chats"),
    ]);
    const customer = data.customer;
    content.innerHTML = head("CRM · ГОСТЬ", customer.name, `${customer.username ? `@${customer.username} · ` : ""}${customer.user_key}`) + `
      <div class="admin-grid">
        <section class="admin-panel"><h2>Статусы и контакт</h2><form id="platformCrmUpdate" data-user="${esc(userKey)}">
          <label class="field">Статус аккаунта<select name="accountStatus">${["active","blocked","deleted"].map(value => `<option ${customer.account_status === value ? "selected" : ""}>${value}</option>`).join("")}</select></label>
          <label class="field">Доверие<select name="trustStatus">${["trusted","normal","watch","restricted"].map(value => `<option ${customer.trust_status === value ? "selected" : ""}>${value}</option>`).join("")}</select></label>
          ${field("Телефон", "phone", customer.phone || "")}
          <label class="checkbox-row"><input name="marketingOptIn" type="checkbox" ${customer.marketing_opt_in ? "checked" : ""}> Marketing opt-in</label>
          ${field("Причина", "reason", "", "text", true)}<button class="gold-button">Сохранить</button>
        </form></section>
        <section class="admin-panel"><h2>Заметка CRM</h2><form id="platformCrmNote" data-user="${esc(userKey)}"><label class="field">Текст<textarea name="body" maxlength="4000" required></textarea></label><button class="gold-button">Добавить</button></form>
          <div class="data-list">${data.notes.map(item => row(item.admin_email || "Администратор", `${fmt(item.created_at)} · ${item.body}`)).join("") || '<div class="admin-empty">Заметок нет</div>'}</div>
        </section>
        <section class="admin-panel"><h2>Сводка</h2>
          ${row("BALI Points", `${Number(customer.balance || 0)} · заработано ${Number(customer.lifetime_earned || 0)} · потрачено ${Number(customer.lifetime_spent || 0)}`)}
          ${row("VIP", `${data.vip.length} записей`)}${row("Награды", `${data.rewards.length}`)}${row("Подарки", `${data.gifts.length}`)}
          ${row("Заказы", `${data.orders.length}`)}${row("Check-in", `${data.checkIns.length}`)}
        </section>
        <section class="admin-panel"><h2>Выдать награду</h2><form id="platformCrmReward" data-user="${esc(userKey)}">
          <label class="field">Награда<select name="rewardId" required>${economyData.rewards.map(item => `<option value="${esc(item.id)}">${esc(item.name)} · ${Number(item.points || 0)} баллов</option>`).join("")}</select></label>
          ${field("Причина", "reason", "", "text", true)}
          <button class="gold-button" ${economyData.rewards.length ? "" : "disabled"}>Выдать</button>
        </form></section>
        <section class="admin-panel"><h2>Выдать подарок</h2><form id="platformCrmGift" data-user="${esc(userKey)}">
          <label class="field">Подарок<select name="catalogItemId" required>${economyData.gifts.map(item => `<option value="${esc(item.id)}">${esc(item.name)} · ${esc(item.gift_type)}</option>`).join("")}</select></label>
          ${field("Сообщение", "message")}${field("Причина", "reason", "", "text", true)}
          <button class="gold-button" ${economyData.gifts.length ? "" : "disabled"}>Выдать</button>
        </form></section>
        <section class="admin-panel"><h2>Выдать VIP</h2><form id="platformCrmVip" data-user="${esc(userKey)}">
          <label class="field">План<select name="planId" required>${economyData.vipPlans.map(item => `<option value="${esc(item.id)}">${esc(item.name)} · ${Number(item.duration_days)} дн.</option>`).join("")}</select></label>
          ${field("Длительность, дней", "durationDays", "30", "number", true)}${field("Причина", "reason", "", "text", true)}
          <button class="gold-button" ${economyData.vipPlans.length ? "" : "disabled"}>Выдать</button>
        </form>
        <div class="data-list">${data.vip.map(item => row(
          `${item.name} · ${item.status}`,
          `${fmt(item.starts_at)} — ${fmt(item.ends_at)}`,
          ["active", "scheduled"].includes(item.status) ? `<button class="small-button" data-revoke-vip="${esc(item.id)}" data-revoke-vip-user="${esc(userKey)}">Отозвать</button>` : ""
        )).join("") || '<div class="admin-empty">VIP не выдавался</div>'}</div></section>
        <section class="admin-panel"><h2>Назначить в клан</h2><form id="platformCrmClan" data-user="${esc(userKey)}">
          <label class="field">Клан<select name="clanId" required>${clanData.chats.filter(item => item.status === "active").map(item => `<option value="${esc(item.clan_id)}">${esc(item.name)} · ${item.clan_type === "corporate" ? "корпоративный" : "пользовательский"}</option>`).join("")}</select></label>
          ${field("Причина", "reason", "", "text", true)}
          <button class="gold-button" ${clanData.chats.length ? "" : "disabled"}>Назначить участника</button>
        </form>
        <div class="data-list">${data.clans.map(item => row(item.name, `${item.clan_type} · ${item.role} · ${item.status}`)).join("") || '<div class="admin-empty">Кланов нет</div>'}</div></section>
        <section class="admin-panel"><h2>Теги</h2><div class="platform-tags">${data.tags.map(item => `<span style="--tag:${esc(item.color)}">${esc(item.name)}</span>`).join("") || "Нет тегов"}</div></section>
        <section class="admin-panel full"><h2>Бронирования</h2><div class="data-list">${data.bookings.map(item => row(item.booking_reference, `${item.event_title} · стол ${item.table_number} · ${item.status} · ${fmt(item.created_at)}`)).join("") || '<div class="admin-empty">Броней нет</div>'}</div></section>
        <section class="admin-panel full"><h2>Point ledger</h2><div class="data-list">${data.pointLedger.slice(0, 100).map(item => row(`${Number(item.amount) > 0 ? "+" : ""}${item.amount}`, `${item.operation_type} · ${item.reason} · ${fmt(item.created_at)} · баланс ${item.balance_after}`)).join("") || '<div class="admin-empty">Операций нет</div>'}</div></section>
      </div>`;
  }

  async function events() {
    start();
    const data = await api("/api/v1/admin/events");
    content.innerHTML = head("АФИША · ЖИЗНЕННЫЙ ЦИКЛ", "Мероприятия", "Черновик, публикация, активное событие, завершение и архив") + `
      <div class="admin-grid">
        <section class="admin-panel"><h2>Новое событие</h2><form id="platformEventCreate">
          ${field("Название", "title", "", "text", true)}${field("Дата", "eventDate", "", "date", true)}${field("Время", "eventTime", "23:00", "time", true)}
          ${field("DJ", "dj")}${field("URL обложки", "imageUrl", "", "url")}
          <label class="field">Описание<textarea name="description" maxlength="6000"></textarea></label>
          <button class="gold-button">Создать черновик</button>
        </form></section>
        <section class="admin-panel full"><div class="table-wrap"><table><thead><tr><th>Событие</th><th>Статус</th><th>Раскладка</th><th>Идут</th><th>Брони</th><th>Check-in</th><th></th></tr></thead><tbody>${data.events.map(item => `<tr>
          <td>${esc(item.title)}<br><small>${fmt(item.starts_at || item.event_date)}</small></td>
          <td>${esc(item.status || (item.active ? "published" : "draft"))}</td><td>${esc(item.layout_name || "не назначена")}</td>
          <td>${Number(item.going_count || 0)}</td><td>${Number(item.booking_count || 0)}</td><td>${Number(item.checkin_count || 0)}</td>
          <td><button class="small-button" data-event-status="${esc(item.id)}" data-status="${esc(item.status || "draft")}">Статус</button></td>
        </tr>`).join("")}</tbody></table></div></section>
      </div>`;
  }

  async function operations() {
    start();
    const data = await api("/api/v1/admin/check-ins");
    content.innerHTML = head("QR · ОДНОКРАТНЫЕ ОПЕРАЦИИ", "Check-in и погашение", "Токены хранятся только в виде SHA-256; повторное использование блокируется") + `
      <div class="admin-grid">
        <section class="admin-panel"><h2>Check-in брони</h2><form id="platformCheckIn">${field("QR-токен", "token", "", "text", true)}${field("Причина", "reason", "Сканирование на входе")}<button class="gold-button">Подтвердить вход</button></form></section>
        <section class="admin-panel"><h2>Погасить подарок</h2><form id="platformGiftRedeem">${field("QR-токен", "token", "", "text", true)}${field("Причина", "reason", "Выдача подарка")}<button class="gold-button">Погасить</button></form></section>
        <section class="admin-panel"><h2>Выдать заказ Shop</h2><form id="platformShopRedeem">${field("QR-токен", "token", "", "text", true)}${field("Причина", "reason", "Выдача заказа")}<button class="gold-button">Погасить</button></form></section>
        <section class="admin-panel full"><h2>Последние check-in</h2><div class="data-list">${data.checkIns.map(item => row(item.name, `${item.event_title} · ${item.booking_reference || "без брони"} · ${fmt(item.checked_in_at)}`)).join("") || '<div class="admin-empty">Check-in пока нет</div>'}</div></section>
      </div>`;
  }

  async function moderation() {
    start();
    const data = await api("/api/v1/admin/moderation");
    content.innerHTML = head("БЕЗОПАСНОСТЬ BALI PEOPLE", "Модерация", "Жалобы пользователей, профилей, личных и клановых чатов") +
      `<section class="admin-panel full"><div class="data-list">${data.cases.map(item => row(
        `${item.priority.toUpperCase()} · ${item.case_type}`,
        `${item.status} · ${item.reported_user_name || item.reported_user_key || "без пользователя"} · ${fmt(item.created_at)} · ${item.resolution || ""}`,
        `<button class="small-button" data-moderation="${esc(item.id)}" data-status="${esc(item.status)}">Рассмотреть</button>`
      )).join("") || '<div class="admin-empty">Открытых дел нет</div>'}</div></section>`;
  }

  async function bookings() {
    start();
    const data = await api("/api/v1/admin/bookings");
    content.innerHTML = head("CRM · БРОНИРОВАНИЯ", "Бронирования", "Серверная история и audit log") +
      `<section class="admin-panel"><div class="table-wrap"><table><thead><tr><th>Номер</th><th>Гость</th><th>Мероприятие</th><th>Стол</th><th>Статус</th><th></th></tr></thead><tbody>${data.bookings.map(item =>
        `<tr><td>${esc(item.booking_reference)}</td><td>${esc(item.customer_name)}<br>${esc(item.phone)}</td><td>${esc(item.event_title)}</td><td>${esc(item.table_number || item.table_name)}</td><td>${esc(item.status)}</td><td><button class="small-button" data-booking="${esc(item.id)}" data-status="${esc(item.status)}">Изменить</button></td></tr>`
      ).join("")}</tbody></table></div></section>`;
  }

  async function layouts() {
    start();
    const [data, settings] = await Promise.all([
      api("/api/v1/admin/layouts"),
      api("/api/v1/admin/booking-settings"),
    ]);
    content.innerHTML = head("СХЕМЫ ЗАЛА · ВЕРСИИ", "Схемы и hold", "Опубликованная версия неизменяема; редактируется её копия") + `
      <div class="admin-grid">
        <section class="admin-panel"><h2>Новая схема</h2><form id="platformLayoutCreate">
          ${field("Название", "name", "", "text", true)}
          ${field("Ширина макета, px", "canvasWidth", "1000", "number", true)}
          ${field("Высота макета, px", "canvasHeight", "1400", "number", true)}
          ${field("URL фона", "backgroundUrl")}
          <button class="gold-button">Создать черновик</button>
        </form></section>
        <section class="admin-panel"><h2>Время удержания</h2><form id="platformHoldSettings">
          ${field("Секунд", "holdSeconds", settings.settings?.hold_seconds || 420, "number", true)}
          <label class="checkbox-row"><input name="autoConfirm" type="checkbox" ${settings.settings?.auto_confirm ? "checked" : ""}> Автоподтверждение</label>
          ${field("Причина", "reason", "Настройка hold", "text", true)}
          <button class="gold-button">Сохранить</button>
        </form></section>
        <section class="admin-panel full"><div class="data-list">${data.layouts.map(item => row(
          `${item.name} · v${item.version}`,
          `${item.status} · ${item.table_count} столов · ${item.element_count} блоков · ${item.canvas_width}×${item.canvas_height} px`,
          `<div class="panel-actions"><button class="small-button" data-clone-layout="${esc(item.id)}">Копия</button>${item.status === "draft" ? `<button class="small-button" data-publish-layout="${esc(item.id)}">Опубликовать</button>` : ""}<button class="small-button" data-open-layout="${esc(item.id)}">Состав</button></div>`
        )).join("")}</div></section>
      </div>`;
  }

  async function layoutDetail(layoutId) {
    start();
    const data = await api(`/api/v1/admin/layouts/${encodeURIComponent(layoutId)}`);
    content.innerHTML = head("РЕДАКТОР СХЕМЫ", data.layout.name, `${data.layout.status} · ${data.layout.canvas_width}×${data.layout.canvas_height} px`) + `
      <div class="admin-grid">
        <section class="admin-panel"><h2>Добавить стол</h2><form id="platformTableCreate" data-layout="${esc(layoutId)}">
          ${field("Номер", "tableNumber", "", "text", true)}${field("Название", "name")}
          ${field("X", "x", "10", "number", true)}${field("Y", "y", "10", "number", true)}
          ${field("Мест", "capacity", "4", "number", true)}${field("Депозит", "minimumDeposit", "0", "number", true)}
          <button class="gold-button" ${data.layout.status !== "draft" ? "disabled" : ""}>Добавить</button>
        </form></section>
        <section class="admin-panel"><h2>Добавить блок</h2><form id="platformElementCreate" data-layout="${esc(layoutId)}">
          <label class="field">Тип<select name="elementType"><option value="stage">Сцена</option><option value="dance_floor">Танцпол</option><option value="bar">Бар</option><option value="entrance">Вход</option><option value="label">Надпись</option><option value="decoration">Декор</option></select></label>
          ${field("Название", "label")}${field("X", "x", "10", "number", true)}${field("Y", "y", "10", "number", true)}
          ${field("Ширина", "width", "20", "number", true)}${field("Высота", "height", "10", "number", true)}
          <button class="gold-button" ${data.layout.status !== "draft" ? "disabled" : ""}>Добавить</button>
        </form></section>
        <section class="admin-panel full"><h2>Столы</h2><div class="data-list">${data.tables.map(item => row(item.table_number, `${item.name || item.table_type} · ${item.capacity} мест · ${item.status} · X ${item.x}, Y ${item.y}`)).join("") || '<div class="admin-empty">Пусто</div>'}</div></section>
        <section class="admin-panel full"><h2>Блоки</h2><div class="data-list">${data.elements.map(item => row(item.label || item.element_type, `${item.element_type} · X ${item.x}, Y ${item.y} · ${item.width}×${item.height}`)).join("") || '<div class="admin-empty">Пусто</div>'}</div></section>
      </div>`;
  }

  async function economy() {
    start();
    const data = await api("/api/v1/admin/economy");
    economyState = data;
    const list = (title, items, describe, action) => `<section class="admin-panel"><h2>${title}</h2><div class="data-list">${items.map(item => row(item.name, describe(item), action(item))).join("") || '<div class="admin-empty">Пусто</div>'}</div></section>`;
    const seasonStart = new Date();
    seasonStart.setUTCHours(0, 0, 0, 0);
    const seasonEnd = new Date(seasonStart.getTime() + Number(data.gameSettings.ranking_period_days || 7) * 86_400_000);
    content.innerHTML = head("БАЛЛЫ · VIP · НАГРАДЫ · ИГРА", "Экономика BALI", "Настройки работают через единый point ledger") + `
      <div class="admin-grid">
        <section class="admin-panel"><h2>Базовые начисления</h2><form id="platformEconomy">
          ${field("Регистрация", "registrationPoints", data.settings.registration_points, "number", true)}
          ${field("Профиль", "profileCompletionPoints", data.settings.profile_completion_points, "number", true)}
          ${field("Check-in", "checkinPoints", data.settings.checkin_points, "number", true)}
          ${field("Приглашённый друг", "invitedFriendPoints", data.settings.invited_friend_points, "number", true)}
          ${field("Клановая активность", "clanActivityPoints", data.settings.clan_activity_points, "number", true)}
          ${field("Причина", "reason", "Плановая настройка экономики", "text", true)}
          <button class="gold-button">Сохранить</button>
        </form></section>
        <section class="admin-panel"><h2>Корректировка баллов</h2><form id="platformPoints">
          ${field("User key", "userKey", "", "text", true)}${field("Сумма (+/−)", "amount", "", "number", true)}${field("Причина", "reason", "", "text", true)}
          <button class="gold-button">Применить</button>
        </form></section>
        <section class="admin-panel"><h2>Новая награда</h2><form id="platformReward">
          ${field("Название", "name", "", "text", true)}${field("URL иконки", "iconUrl", "", "url")}
          ${field("Баллы", "points", "0", "number", true)}${field("XP", "xp", "0", "number", true)}
          <label class="field">Редкость<select name="rarity"><option>common</option><option>rare</option><option>epic</option><option>legendary</option></select></label>
          <button class="gold-button">Создать</button>
        </form></section>
        <section class="admin-panel"><h2>Новый подарок</h2><form id="platformGift">
          ${field("Название", "name", "", "text", true)}${field("URL изображения", "imageUrl", "", "url")}
          ${field("Цена в баллах", "pointsCost", "0", "number", true)}${field("Срок, дней", "validityDays", "365", "number", true)}
          <label class="field">Тип<select name="giftType"><option value="virtual">Виртуальный</option><option value="physical">Физический</option></select></label>
          <button class="gold-button">Создать</button>
        </form></section>
        <section class="admin-panel"><h2>Новый VIP-план</h2><form id="platformVip">
          ${field("Название", "name", "", "text", true)}${field("Цена в баллах", "pointsCost", "0", "number", true)}
          ${field("Длительность, дней", "durationDays", "30", "number", true)}${field("Множитель баллов", "pointsMultiplier", "1", "number", true)}
          ${field("Доп. жизни", "extraGameLives", "0", "number", true)}
          <button class="gold-button">Создать</button>
        </form></section>
        <section class="admin-panel"><h2>Новый товар Shop</h2><form id="platformShop">
          ${field("Название", "name", "", "text", true)}${field("Категория", "category", "other", "text", true)}
          ${field("URL изображения", "imageUrl", "", "url")}${field("Цена в баллах", "pointsCost", "0", "number", true)}
          ${field("Остаток", "stock", "0", "number", true)}
          <label class="checkbox-row"><input name="requiresRedemption" type="checkbox"> Требует QR-погашения</label>
          <button class="gold-button">Создать черновик</button>
        </form></section>
        <section class="admin-panel"><h2>Настройки игры</h2><form id="platformGame">
          ${field("Жизни", "baseLives", data.gameSettings.base_lives, "number", true)}
          ${field("Цена продолжения", "continuePointsCost", data.gameSettings.continue_points_cost, "number", true)}
          ${field("Дней в рейтинге", "rankingPeriodDays", data.gameSettings.ranking_period_days, "number", true)}
          ${field("Макс. очков/сек.", "maxScorePerSecond", data.gameSettings.max_score_per_second, "number", true)}
          ${field("Название игры", "gameTitle", data.gameSettings.game_title || "BALI Match", "text", true)}
          ${field("Подзаголовок игры", "gameSubtitle", data.gameSettings.game_subtitle || "", "text", true)}
          ${field("URL фона", "backgroundImageUrl", data.gameSettings.background_image_url || "", "url", true)}
          ${field("URL изображения награды", "rewardImageUrl", data.gameSettings.reward_image_url || "", "url", true)}
          <label class="field">Фишки игры (JSON)<textarea name="symbolsJson" rows="14" required>${esc(JSON.stringify(data.gameSettings.symbols || [], null, 2))}</textarea></label>
          <p class="platform-copy">Все игровые фишки загружаются квадратными изображениями 512 × 512 px. Для каждой версии сохраняется история, оригинал можно вернуть.</p>
          <label class="field">Награды Top-10 (JSON)<textarea name="prizesJson" rows="16" required>${esc(JSON.stringify(data.gameSettings.default_prizes || [], null, 2))}</textarea></label>
          <label class="field">Генератор уровней (JSON)<textarea name="levelRulesJson" rows="12" required>${esc(JSON.stringify(data.gameSettings.level_rules || {}, null, 2))}</textarea></label>
          <label class="field">Формула очков (JSON)<textarea name="scoringRulesJson" rows="12" required>${esc(JSON.stringify(data.gameSettings.scoring_rules || {}, null, 2))}</textarea></label>
          <label class="field">Формула рейтинга (JSON)<textarea name="ratingRulesJson" rows="10" required>${esc(JSON.stringify(data.gameSettings.rating_rules || {}, null, 2))}</textarea></label>
          <label class="field">Bally, бустеры и продолжения (JSON)<textarea name="economyRulesJson" rows="12" required>${esc(JSON.stringify(data.gameSettings.economy_rules || {}, null, 2))}</textarea></label>
          <label class="field">Жизни (JSON)<textarea name="livesRulesJson" rows="8" required>${esc(JSON.stringify(data.gameSettings.lives_rules || {}, null, 2))}</textarea></label>
          <label class="field">Клановые раунды (JSON)<textarea name="clanRulesJson" rows="10" required>${esc(JSON.stringify(data.gameSettings.clan_rules || {}, null, 2))}</textarea></label>
          <div class="platform-inline"><button class="small-button" type="button" data-reset-game-symbols>Вернуть исходные фишки</button><button class="small-button" type="button" data-reset-game-prizes>Вернуть исходные награды</button><button class="small-button" type="button" data-reset-game-rules>Вернуть исходные формулы</button></div>
          ${field("Причина", "reason", "Настройка игры", "text", true)}
          <button class="gold-button">Сохранить</button>
        </form></section>
        ${list("История изображений фишек · 512 × 512", data.gameSymbolVersions || [],
          item => `${item.symbol_key} · ${item.source} · ${item.width}×${item.height} · ${item.active ? "АКТИВНО" : fmt(item.created_at)}`,
          item => `<button class="small-button" data-restore-game-symbol-version="${esc(item.id)}" data-symbol-key="${esc(item.symbol_key)}">Вернуть эту версию</button>`)}
        <section class="admin-panel"><h2>Недельное состязание</h2><form id="platformGameSeason">
          ${field("Название", "name", `Неделя ${seasonStart.toLocaleDateString("ru-RU")}`, "text", true)}
          ${field("Начало", "startsAt", seasonStart.toISOString().slice(0, 16), "datetime-local", true)}
          ${field("Окончание", "endsAt", seasonEnd.toISOString().slice(0, 16), "datetime-local", true)}
          <label class="field">Статус<select name="status"><option value="scheduled">Запланировано</option><option value="active">Активно</option></select></label>
          <p class="platform-copy">Награды берутся из текущего Top‑10 JSON и фиксируются в сезоне.</p>
          <button class="gold-button">Создать сезон</button>
        </form></section>
        ${list("Награды", data.rewards, item => `${item.rarity} · ${item.points} баллов · ${item.xp} XP · ${item.active ? "ON" : "OFF"}`, item => `<button class="small-button" data-edit-reward="${esc(item.id)}">Изменить</button>`)}
        ${list("Подарки", data.gifts, item => `${item.gift_type} · ${item.points_cost} баллов · ${item.active ? "ON" : "OFF"}`, item => `<button class="small-button" data-edit-gift="${esc(item.id)}">Изменить</button>`)}
        ${list("VIP-планы", data.vipPlans, item => `${item.duration_days} дн. · ${item.points_cost} баллов · ×${item.points_multiplier} · ${item.active ? "ON" : "OFF"}`, item => `<button class="small-button" data-edit-vip="${esc(item.id)}">Изменить</button>`)}
        ${list("Магазин", data.shopItems, item => `${item.category} · ${item.points_cost} баллов · остаток ${item.stock ?? "∞"} · ${item.status}`, item => `<button class="small-button" data-edit-shop="${esc(item.id)}">Изменить</button>`)}
        <section class="admin-panel full"><h2>Недельные сезоны</h2><div class="data-list">${data.seasons.map(item => row(
          item.name,
          `${fmt(item.starts_at)} — ${fmt(item.ends_at)} · ${item.status}`,
          item.status !== "completed" ? `<button class="small-button" data-finalize-season="${esc(item.id)}">Финализировать Top‑10</button>` : "<span>ГОТОВО</span>"
        )).join("")}</div></section>
      </div>`;
  }

  async function design() {
    start();
    const data = await api("/api/v1/admin/content");
    designState = data;
    content.innerHTML = head("ВИЗУАЛЬНАЯ КАСТОМИЗАЦИЯ", "Дизайн и изображения", "Размеры указаны рядом; reset возвращает исходное состояние") + `
      <div class="admin-grid">
        <section class="admin-panel"><h2>Новое изображение</h2><form id="platformAsset">
          ${field("Ключ", "assetKey", "", "text", true)}${field("Название", "name", "", "text", true)}${field("URL (если файл не выбран)", "url", "", "url")}
          <label class="field">Файл PNG, JPG или WEBP до 12 МБ<input name="file" type="file" accept="image/png,image/jpeg,image/webp"></label>
          ${field("Ширина, px", "recommendedWidth", "", "number")}${field("Высота, px", "recommendedHeight", "", "number")}
          <button class="gold-button">Добавить</button>
        </form></section>
        <section class="admin-panel"><h2>Новый блок</h2><form id="platformBlock">
          <label class="field">Раздел<select name="scope"><option value="app">Приложение</option><option value="game">Игра</option><option value="admin">Админка</option><option value="shared">Общий</option></select></label>
          ${field("Ключ", "blockKey", "", "text", true)}${field("Название", "name", "", "text", true)}${field("Заголовок", "title")}${field("Подзаголовок", "subtitle")}${field("Ключ изображения", "assetKey")}
          <button class="gold-button">Добавить</button>
        </form></section>
        <section class="admin-panel full"><h2>Изображения</h2><div class="data-list">${data.assets.map(item => row(
          `${item.name} · ${item.asset_key}`,
          `${item.url} · рекомендовано ${item.recommended_width || "—"}×${item.recommended_height || "—"} px · исходник ${item.default_url}`,
          `<div class="platform-inline"><button class="small-button" data-edit-asset="${esc(item.asset_key)}">Изменить</button><button class="small-button" data-reset-asset="${esc(item.asset_key)}">В исходное</button></div>`
        )).join("") || '<div class="admin-empty">Пусто</div>'}</div></section>
        <section class="admin-panel full"><h2>Блоки</h2><div class="data-list">${data.blocks.map(item => row(
          `${item.scope} · ${item.name}`,
          `${item.block_key} · ${item.title} · ${item.recommended_width || "—"}×${item.recommended_height || "—"} px`,
          `<div class="platform-inline"><button class="small-button" data-edit-block="${esc(item.id)}">Изменить</button><button class="small-button" data-reset-block="${esc(item.id)}">В исходное</button></div>`
        )).join("") || '<div class="admin-empty">Пусто</div>'}</div></section>
        <section class="admin-panel full"><h2>Иконки нижнего меню</h2><div class="data-list">${data.navigation.map(item => row(
          `${item.label} · ${item.item_key}`,
          `${item.route} · ${item.recommended_width}×${item.recommended_height} px · ${item.icon_url || "исходная иконка"}`,
          `<div class="platform-inline"><button class="small-button" data-edit-nav="${esc(item.id)}">Изменить</button><button class="small-button" data-reset-nav="${esc(item.id)}">Сбросить</button></div>`
        )).join("")}</div></section>
      </div>`;
  }

  async function campaigns() {
    start();
    const data = await api("/api/v1/admin/campaigns");
    content.innerHTML = head("CRM · TELEGRAM", "Рассылки", "Сначала preview, затем отдельное подтверждение") + `
      <div class="admin-grid">
        <section class="admin-panel"><h2>Новая рассылка</h2><form id="platformCampaign">
          ${field("Название", "name", "", "text", true)}<label class="field">Текст<textarea name="messageText" maxlength="4000" required></textarea></label>
          <label class="checkbox-row"><input name="marketingOnly" type="checkbox" checked> Только marketing opt-in</label>${field("Clan ID", "clanId")}
          <button class="gold-button">Создать preview</button>
        </form></section>
        <section class="admin-panel"><p class="platform-copy">Подтверждение создаёт зафиксированных получателей и outbox-задание. Повторный запрос не создаёт дублей.</p></section>
        <section class="admin-panel full"><div class="data-list">${data.campaigns.map(item => row(
          item.name,
          `${item.status} · ${item.recipient_count} получателей · ${fmt(item.created_at)}`,
          ["draft", "previewed"].includes(item.status) ? `<button class="small-button" data-confirm-campaign="${esc(item.id)}">Подтвердить</button>` : `<span>${esc(item.status)}</span>`
        )).join("") || '<div class="admin-empty">Пусто</div>'}</div></section>
      </div>`;
  }

  const render = async view => {
    try {
      if (view === "dashboard") return dashboard();
      if (view === "crm") return crm();
      if (view === "events") return events();
      if (view === "bookings") return bookings();
      if (view === "operations") return operations();
      if (view === "layouts") return layouts();
      if (view === "economy") return economy();
      if (view === "content") return design();
      if (view === "campaigns") return campaigns();
      if (view === "moderation") return moderation();
    } catch (error) {
      content.innerHTML = `<div class="admin-empty">${esc(error.message)}</div>`;
    }
  };

  document.addEventListener("click", async event => {
    const main = event.target.closest("[data-admin-view]");
    if (main && views.has(main.dataset.adminView)) {
      document.querySelectorAll("[data-admin-view]").forEach(button => button.classList.toggle("active", button === main));
      return render(main.dataset.adminView);
    }
    const revokeVip = event.target.closest("[data-revoke-vip]");
    if (revokeVip) {
      const reason = prompt("Причина отзыва VIP (попадёт в audit log)");
      if (!reason) return;
      await send(`/api/v1/admin/vip/subscriptions/${encodeURIComponent(revokeVip.dataset.revokeVip)}/revoke`, "POST", { reason });
      toast("VIP отозван");
      return crmDetail(revokeVip.dataset.revokeVipUser);
    }
    const crmUser = event.target.closest("[data-crm-user]");
    if (crmUser) return crmDetail(crmUser.dataset.crmUser);
    const merge = event.target.closest("[data-resolve-merge]");
    if (merge) {
      const reason = prompt("Причина решения (попадёт в audit log)");
      if (!reason) return;
      await send(`/api/v1/admin/crm/merge-reviews/${merge.dataset.resolveMerge}`, "PATCH", {
        status: merge.dataset.mergeStatus,
        reason,
      });
      toast("Проверка Telegram ID завершена");
      return crm();
    }
    const eventStatus = event.target.closest("[data-event-status]");
    if (eventStatus) {
      const status = prompt("Новый статус: draft, published, active, completed, archived или cancelled", eventStatus.dataset.status);
      if (!status || status === eventStatus.dataset.status) return;
      const reason = prompt("Причина изменения");
      if (!reason) return;
      await send(`/api/v1/admin/events/${eventStatus.dataset.eventStatus}`, "PATCH", { status, reason });
      toast("Статус события обновлён");
      return events();
    }
    const moderationCase = event.target.closest("[data-moderation]");
    if (moderationCase) {
      const status = prompt("Статус: reviewing, actioned, dismissed или closed", moderationCase.dataset.status);
      if (!status || status === moderationCase.dataset.status) return;
      const resolution = ["actioned", "dismissed", "closed"].includes(status)
        ? prompt("Решение по жалобе")
        : "";
      if (["actioned", "dismissed", "closed"].includes(status) && !resolution) return;
      await send(`/api/v1/admin/moderation/${moderationCase.dataset.moderation}`, "PATCH", {
        status,
        resolution,
        reason: "Обработка через BALI Control",
      });
      toast("Дело модерации обновлено");
      return moderation();
    }
    const booking = event.target.closest("[data-booking]");
    if (booking) {
      const status = prompt("Новый статус", booking.dataset.status);
      const reason = status && status !== booking.dataset.status ? prompt("Причина изменения") : "";
      if (!reason) return;
      await send(`/api/v1/admin/bookings/${booking.dataset.booking}`, "PATCH", { status, reason });
      toast("Статус обновлён");
      return bookings();
    }
    const clone = event.target.closest("[data-clone-layout]");
    if (clone) { await send(`/api/v1/admin/layouts/${clone.dataset.cloneLayout}/clone`, "POST"); toast("Копия создана"); return layouts(); }
    const publish = event.target.closest("[data-publish-layout]");
    if (publish) { await send(`/api/v1/admin/layouts/${publish.dataset.publishLayout}/publish`, "POST", { reason: "Публикация через админку" }); toast("Опубликовано"); return layouts(); }
    const open = event.target.closest("[data-open-layout]");
    if (open) return layoutDetail(open.dataset.openLayout);
    const season = event.target.closest("[data-finalize-season]");
    if (season && confirm("Зафиксировать Top‑10?")) { await send(`/api/v1/admin/game/seasons/${season.dataset.finalizeSeason}/finalize`, "POST", { reason: "Финализация недельного состязания" }); return economy(); }
    const editReward = event.target.closest("[data-edit-reward]");
    if (editReward) {
      const current = economyState.rewards.find(item => item.id === editReward.dataset.editReward);
      if (!current) return;
      const name = prompt("Название награды", current.name); if (name === null) return;
      const points = prompt("Баллы", current.points); if (points === null) return;
      const xp = prompt("XP", current.xp); if (xp === null) return;
      const active = confirm("Награда должна быть активна?");
      await send(`/api/v1/admin/rewards/${encodeURIComponent(current.id)}`, "PATCH", {
        name, points: Number(points), xp: Number(xp), active,
        reason: "Редактирование награды через BALI Control",
      });
      return economy();
    }
    const editGift = event.target.closest("[data-edit-gift]");
    if (editGift) {
      const current = economyState.gifts.find(item => item.id === editGift.dataset.editGift);
      if (!current) return;
      const name = prompt("Название подарка", current.name); if (name === null) return;
      const pointsCost = prompt("Цена в баллах", current.points_cost); if (pointsCost === null) return;
      const validityDays = prompt("Срок действия, дней", current.validity_days ?? ""); if (validityDays === null) return;
      const giftType = prompt("Тип: virtual или physical", current.gift_type); if (giftType === null) return;
      const active = confirm("Подарок должен быть активен?");
      await send(`/api/v1/admin/gifts/catalog/${encodeURIComponent(current.id)}`, "PATCH", {
        name, pointsCost: Number(pointsCost), validityDays: validityDays ? Number(validityDays) : null,
        giftType, active, reason: "Редактирование подарка через BALI Control",
      });
      return economy();
    }
    const editVip = event.target.closest("[data-edit-vip]");
    if (editVip) {
      const current = economyState.vipPlans.find(item => item.id === editVip.dataset.editVip);
      if (!current) return;
      const name = prompt("Название VIP-плана", current.name); if (name === null) return;
      const pointsCost = prompt("Цена в баллах", current.points_cost); if (pointsCost === null) return;
      const durationDays = prompt("Длительность, дней", current.duration_days); if (durationDays === null) return;
      const pointsMultiplier = prompt("Множитель баллов", current.points_multiplier); if (pointsMultiplier === null) return;
      const active = confirm("VIP-план должен быть активен?");
      await send(`/api/v1/admin/vip/plans/${encodeURIComponent(current.id)}`, "PATCH", {
        name, pointsCost: Number(pointsCost), durationDays: Number(durationDays),
        pointsMultiplier: Number(pointsMultiplier), active,
        reason: "Редактирование VIP-плана через BALI Control",
      });
      return economy();
    }
    const editShop = event.target.closest("[data-edit-shop]");
    if (editShop) {
      const current = economyState.shopItems.find(item => item.id === editShop.dataset.editShop);
      if (!current) return;
      const name = prompt("Название товара", current.name); if (name === null) return;
      const pointsCost = prompt("Цена в баллах", current.points_cost); if (pointsCost === null) return;
      const stock = prompt("Остаток (пусто — без лимита)", current.stock ?? ""); if (stock === null) return;
      const status = prompt("Статус: draft, active, sold_out или archived", current.status); if (status === null) return;
      const requiresRedemption = confirm("Товар требует QR-погашения?");
      await send(`/api/v1/admin/shop/items/${encodeURIComponent(current.id)}`, "PATCH", {
        name, pointsCost: Number(pointsCost), stock: stock ? Number(stock) : null,
        status, requiresRedemption, reason: "Редактирование товара через BALI Control",
      });
      return economy();
    }
    const resetGameSymbols = event.target.closest("[data-reset-game-symbols]");
    if (resetGameSymbols && confirm("Вернуть исходные фишки и изображения игры?")) {
      await send("/api/v1/admin/game/settings", "PATCH", {
        resetSymbols: true,
        reason: "Возврат исходных фишек игры",
      });
      return economy();
    }
    const resetGamePrizes = event.target.closest("[data-reset-game-prizes]");
    if (resetGamePrizes && confirm("Вернуть исходные награды Top‑10?")) {
      await send("/api/v1/admin/game/settings", "PATCH", {
        resetPrizes: true,
        reason: "Возврат исходных наград Top-10",
      });
      return economy();
    }
    const resetGameRules = event.target.closest("[data-reset-game-rules]");
    if (resetGameRules && confirm("Вернуть исходные настройки уровней, формул, Bally, жизней и кланов?")) {
      await send("/api/v1/admin/game/settings", "PATCH", {
        resetGameRules: true,
        reason: "Возврат исходных правил BALI Match",
      });
      return economy();
    }
    const restoreGameSymbol = event.target.closest("[data-restore-game-symbol-version]");
    if (restoreGameSymbol && confirm("Сделать эту версию изображения активной?")) {
      await send(
        `/api/v1/admin/game/symbols/${encodeURIComponent(restoreGameSymbol.dataset.symbolKey)}/versions/${encodeURIComponent(restoreGameSymbol.dataset.restoreGameSymbolVersion)}/restore`,
        "POST",
        { reason: "Восстановление версии изображения фишки через BALI Control" }
      );
      return economy();
    }
    const editAsset = event.target.closest("[data-edit-asset]");
    if (editAsset) {
      const current = designState.assets.find(item => item.asset_key === editAsset.dataset.editAsset);
      if (!current) return;
      const name = prompt("Название изображения", current.name);
      if (name === null) return;
      const url = prompt("URL изображения", current.url);
      if (url === null) return;
      const recommendedWidth = prompt("Рекомендуемая ширина, px", current.recommended_width || "");
      if (recommendedWidth === null) return;
      const recommendedHeight = prompt("Рекомендуемая высота, px", current.recommended_height || "");
      if (recommendedHeight === null) return;
      await send(`/api/v1/admin/content/assets/${current.asset_key}`, "PATCH", {
        name,
        url,
        recommendedWidth: recommendedWidth ? Number(recommendedWidth) : null,
        recommendedHeight: recommendedHeight ? Number(recommendedHeight) : null,
        reason: "Редактирование изображения через BALI Control",
      });
      return design();
    }
    const editBlock = event.target.closest("[data-edit-block]");
    if (editBlock) {
      const current = designState.blocks.find(item => item.id === editBlock.dataset.editBlock);
      if (!current) return;
      const name = prompt("Название блока", current.name);
      if (name === null) return;
      const title = prompt("Заголовок блока", current.title || "");
      if (title === null) return;
      const subtitle = prompt("Подзаголовок блока", current.subtitle || "");
      if (subtitle === null) return;
      const assetKey = prompt("Ключ изображения (пусто — без изображения)", current.asset_key || "");
      if (assetKey === null) return;
      const overlay = prompt("Затемнение от 0 до 88", current.configuration?.overlay ?? 60);
      if (overlay === null) return;
      const position = prompt("Позиция: center, top, bottom, left или right", current.configuration?.position || "center");
      if (position === null) return;
      await send(`/api/v1/admin/content/blocks/${current.id}`, "PATCH", {
        name,
        title,
        subtitle,
        assetKey: assetKey || null,
        configuration: { ...(current.configuration || {}), overlay: Number(overlay), position },
        reason: "Редактирование блока через BALI Control",
      });
      return design();
    }
    const editNav = event.target.closest("[data-edit-nav]");
    if (editNav) {
      const current = designState.navigation.find(item => item.id === editNav.dataset.editNav);
      if (!current) return;
      const label = prompt("Название кнопки", current.label);
      if (label === null) return;
      const iconUrl = prompt("URL иконки", current.icon_url || "");
      if (iconUrl === null) return;
      const route = prompt("Раздел приложения", current.route);
      if (route === null) return;
      await send(`/api/v1/admin/content/navigation/${current.id}`, "PATCH", {
        label,
        iconUrl,
        route,
        reason: "Редактирование нижнего меню через BALI Control",
      });
      return design();
    }
    const asset = event.target.closest("[data-reset-asset]");
    if (asset) { await send(`/api/v1/admin/content/assets/${asset.dataset.resetAsset}`, "PATCH", { reset: true, reason: "Возврат исходного изображения" }); return design(); }
    const block = event.target.closest("[data-reset-block]");
    if (block) { await send(`/api/v1/admin/content/blocks/${block.dataset.resetBlock}`, "PATCH", { reset: true, reason: "Возврат исходного блока" }); return design(); }
    const nav = event.target.closest("[data-reset-nav]");
    if (nav) { await send(`/api/v1/admin/content/navigation/${nav.dataset.resetNav}`, "PATCH", { reset: true, reason: "Возврат исходной иконки" }); return design(); }
    const campaign = event.target.closest("[data-confirm-campaign]");
    if (campaign) {
      const reason = prompt("Причина подтверждения");
      if (!reason) return;
      await send(`/api/v1/admin/campaigns/${campaign.dataset.confirmCampaign}/confirm`, "POST", { reason });
      toast("Рассылка поставлена в очередь");
      return campaigns();
    }
  });

  document.addEventListener("submit", async event => {
    const form = event.target;
    if (!String(form.id).startsWith("platform")) return;
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    if (form.id === "platformLayoutCreate") {
      await send("/api/v1/admin/layouts", "POST", { ...data, canvasWidth: Number(data.canvasWidth), canvasHeight: Number(data.canvasHeight) });
      return layouts();
    }
    if (form.id === "platformHoldSettings") {
      await send("/api/v1/admin/booking-settings", "PATCH", { holdSeconds: Number(data.holdSeconds), autoConfirm: form.elements.autoConfirm.checked, reason: data.reason });
      return toast("Настройки сохранены");
    }
    if (form.id === "platformTableCreate") {
      await send(`/api/v1/admin/layouts/${form.dataset.layout}/tables`, "POST", { ...data, x: Number(data.x), y: Number(data.y), capacity: Number(data.capacity), minimumDeposit: Number(data.minimumDeposit) });
      return layoutDetail(form.dataset.layout);
    }
    if (form.id === "platformElementCreate") {
      await send(`/api/v1/admin/layouts/${form.dataset.layout}/elements`, "POST", { ...data, x: Number(data.x), y: Number(data.y), width: Number(data.width), height: Number(data.height) });
      return layoutDetail(form.dataset.layout);
    }
    if (form.id === "platformEconomy") {
      const body = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, key === "reason" ? value : Number(value)]));
      await send("/api/v1/admin/economy/settings", "PATCH", body);
      return economy();
    }
    if (form.id === "platformPoints") {
      await send("/api/v1/admin/points/adjustments", "POST", { ...data, amount: Number(data.amount), idempotencyKey: crypto.randomUUID() });
      form.reset(); return toast("Баллы скорректированы");
    }
    if (form.id === "platformCrmSearch") return crm(data.search);
    if (form.id === "platformCrmUpdate") {
      await send(`/api/v1/admin/crm/users/${form.dataset.user}`, "PATCH", {
        ...data,
        marketingOptIn: form.elements.marketingOptIn.checked,
      });
      toast("CRM-карточка обновлена");
      return crmDetail(form.dataset.user);
    }
    if (form.id === "platformCrmNote") {
      await send(`/api/v1/admin/crm/users/${form.dataset.user}/notes`, "POST", data);
      toast("Заметка добавлена");
      return crmDetail(form.dataset.user);
    }
    if (form.id === "platformCrmReward") {
      await send(`/api/v1/admin/rewards/${encodeURIComponent(data.rewardId)}/grants`, "POST", {
        userKey: form.dataset.user,
        reason: data.reason,
        idempotencyKey: crypto.randomUUID(),
      });
      toast("Награда выдана");
      return crmDetail(form.dataset.user);
    }
    if (form.id === "platformCrmGift") {
      await send("/api/v1/admin/gifts/grants", "POST", {
        ...data,
        userKey: form.dataset.user,
        idempotencyKey: crypto.randomUUID(),
      });
      toast("Подарок выдан");
      return crmDetail(form.dataset.user);
    }
    if (form.id === "platformCrmVip") {
      await send("/api/v1/admin/vip/grants", "POST", {
        ...data,
        durationDays: Number(data.durationDays),
        userKey: form.dataset.user,
        idempotencyKey: crypto.randomUUID(),
      });
      toast("VIP выдан");
      return crmDetail(form.dataset.user);
    }
    if (form.id === "platformCrmClan") {
      await send(`/api/v1/admin/clans/${encodeURIComponent(data.clanId)}/members`, "POST", {
        userKey: form.dataset.user,
        reason: data.reason,
      });
      toast("Участник назначен в клан");
      return crmDetail(form.dataset.user);
    }
    if (form.id === "platformEventCreate") {
      await send("/api/v1/admin/events", "POST", { ...data, status: "draft" });
      toast("Черновик события создан");
      return events();
    }
    if (form.id === "platformCheckIn") {
      await send("/api/v1/admin/check-ins", "POST", { ...data, idempotencyKey: crypto.randomUUID() });
      toast("Check-in подтверждён");
      return operations();
    }
    if (form.id === "platformGiftRedeem") {
      await send("/api/v1/admin/redemptions/gifts", "POST", data);
      form.reset();
      return toast("Подарок погашен");
    }
    if (form.id === "platformShopRedeem") {
      await send("/api/v1/admin/redemptions/shop", "POST", data);
      form.reset();
      return toast("Заказ выдан");
    }
    if (form.id === "platformReward") {
      await send("/api/v1/admin/rewards", "POST", {
        ...data,
        points: Number(data.points),
        xp: Number(data.xp),
      });
      return economy();
    }
    if (form.id === "platformGift") {
      await send("/api/v1/admin/gifts/catalog", "POST", {
        ...data,
        pointsCost: Number(data.pointsCost),
        validityDays: Number(data.validityDays),
      });
      return economy();
    }
    if (form.id === "platformVip") {
      await send("/api/v1/admin/vip/plans", "POST", {
        ...data,
        pointsCost: Number(data.pointsCost),
        durationDays: Number(data.durationDays),
        pointsMultiplier: Number(data.pointsMultiplier),
        extraGameLives: Number(data.extraGameLives),
        benefits: [],
        eventAccess: [],
        shopAccess: [],
      });
      return economy();
    }
    if (form.id === "platformShop") {
      await send("/api/v1/admin/shop/items", "POST", {
        ...data,
        pointsCost: Number(data.pointsCost),
        stock: Number(data.stock),
        requiresRedemption: form.elements.requiresRedemption.checked,
        status: "draft",
      });
      return economy();
    }
    if (form.id === "platformGame") {
      let symbols;
      let defaultPrizes;
      let levelRules;
      let scoringRules;
      let ratingRules;
      let economyRules;
      let livesRules;
      let clanRules;
      try {
        symbols = JSON.parse(data.symbolsJson);
        defaultPrizes = JSON.parse(data.prizesJson);
        levelRules = JSON.parse(data.levelRulesJson);
        scoringRules = JSON.parse(data.scoringRulesJson);
        ratingRules = JSON.parse(data.ratingRulesJson);
        economyRules = JSON.parse(data.economyRulesJson);
        livesRules = JSON.parse(data.livesRulesJson);
        clanRules = JSON.parse(data.clanRulesJson);
        if (!Array.isArray(symbols) || !Array.isArray(defaultPrizes)
          || [levelRules, scoringRules, ratingRules, economyRules, livesRules, clanRules]
            .some(value => !value || Array.isArray(value) || typeof value !== "object")) throw new Error();
      } catch {
        return toast("Фишки, награды и правила должны содержать корректный JSON");
      }
      await send("/api/v1/admin/game/settings", "PATCH", {
        ...data,
        baseLives: Number(data.baseLives),
        continuePointsCost: Number(data.continuePointsCost),
        rankingPeriodDays: Number(data.rankingPeriodDays),
        maxScorePerSecond: Number(data.maxScorePerSecond),
        symbols,
        defaultPrizes,
        levelRules,
        scoringRules,
        ratingRules,
        economyRules,
        livesRules,
        clanRules,
      });
      toast("Настройки игры сохранены");
      return economy();
    }
    if (form.id === "platformGameSeason") {
      await send("/api/v1/admin/game/seasons", "POST", {
        ...data,
        rewards: economyState.gameSettings.default_prizes || [],
      });
      toast("Недельное состязание создано");
      return economy();
    }
    if (form.id === "platformAsset") {
      const file = form.elements.file.files?.[0];
      const upload = file ? await uploadImage(file) : null;
      const url = upload?.url || data.url;
      if (!url) return toast("Выберите файл или укажите URL изображения");
      await send("/api/v1/admin/content/assets", "POST", {
        ...data,
        url,
        mimeType: upload?.mimeType || "",
        recommendedWidth: data.recommendedWidth ? Number(data.recommendedWidth) : null,
        recommendedHeight: data.recommendedHeight ? Number(data.recommendedHeight) : null,
      });
      return design();
    }
    if (form.id === "platformBlock") {
      await send("/api/v1/admin/content/blocks", "POST", data);
      return design();
    }
    if (form.id === "platformCampaign") {
      await send("/api/v1/admin/campaigns", "POST", {
        name: data.name, messageText: data.messageText,
        segment: { marketingOnly: form.elements.marketingOnly.checked, clanId: data.clanId || null },
        idempotencyKey: crypto.randomUUID(),
      });
      return campaigns();
    }
  });
})();
