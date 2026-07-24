(() => {
  if (window.__BALI_BETA4_APP_CORE__) return;
  window.__BALI_BETA4_APP_CORE__ = true;

  const app = document.getElementById("app");
  const store = window.BaliStore;
  const points = window.BaliPoints;
  const game = window.BaliBeta4Game;
  const tg = window.Telegram?.WebApp;
  if (!app || !store || !game) return;

  const state = {
    events: [],
    menu: [],
    category: "Все",
    page: "home",
    activeEvent: null,
    availability: [],
    selectedTable: "",
    loadVersion: 0
  };

  const byId = id => document.getElementById(id);
  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);
  const fmtDate = value => value
    ? new Date(`${value}T12:00:00`).toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" })
    : "—";
  const fmtDateTime = value => value
    ? new Date(value).toLocaleString("ru-RU", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";
  const money = value => `${Number(value || 0).toLocaleString("ru-RU")} BYN`;
  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  };
  const write = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent("bali:beta4-local", { detail: { key } }));
    return value;
  };
  const initials = name => String(name || "B").trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();

  function toast(message) {
    const element = byId("toast");
    if (!element) return;
    element.textContent = String(message || "");
    element.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => element.classList.remove("show"), 2400);
  }

  function avatarHtml(user = {}, className = "avatar") {
    return `<span class="${esc(className)}">${user.avatar
      ? `<img src="${esc(user.avatar)}" alt="">`
      : esc(initials(user.name))}</span>`;
  }

  function mount() {
    app.innerHTML = `<div class="shell">
      <header class="top">
        <button class="brand" type="button" data-page="home"><span class="logo">B</span><span><strong>BALI</strong><small>МИНСК · NIGHT CLUB</small></span></button>
        <button class="top-action" id="shareApp" type="button" aria-label="Поделиться">↗</button>
      </header>
      <main class="pages">
        <section class="page active" data-screen="home"><div class="inner">
          <article class="hero"><span class="eyebrow">NIGHT CLUB · CONTACT BAR · 18+</span><h1>Твоя ночь<br><em>начинается здесь</em></h1><p>Клубный формат BALI: события, танцпол, контактный бар, кальяны и индивидуальная рассадка столов. Можно провести ночь за столиком или свободно отдыхать у барной стойки.</p><div class="pills"><span>Кирова, 13</span><span>ПТ–СБ · 23:00–06:00</span><span>5 минут от «Динамо»</span></div></article>
          <div class="actions"><button class="primary" data-page="events">Смотреть афиши</button><button class="secondary" data-page="profile">Мой профиль</button></div>
          <section class="card"><div class="card-head"><h3>Ближайшие события</h3><button data-page="events">Все афиши</button></div><div class="home-events" id="homeEvents"></div></section>
          <section class="card"><div class="card-head"><h3>О клубе</h3></div><p class="muted" style="font-size:11px;line-height:1.65">BALI — ночной клуб с большими экранами, танцполом, контактным баром, кальянами и комфортными столами. Даже без брони можно прийти на мероприятие, танцевать и провести ночь у контактной барной стойки.</p></section>
        </div></section>
        <section class="page" data-screen="events"><div class="inner"><div class="head"><div><span class="eyebrow">БЛИЖАЙШИЕ ДАТЫ</span><h2>Афиши</h2></div><span class="count" id="eventsCount"></span></div><div class="events" id="eventsGrid"></div></div></section>
        <section class="page" data-screen="menu"><div class="inner"><div class="head"><div><span class="eyebrow">БАР · КУХНЯ · КАЛЬЯНЫ</span><h2>Меню</h2></div><span class="count" id="menuCount"></span></div><div class="tabs" id="menuTabs"></div><div class="menu-list" id="menuList"></div></div></section>
        <section class="page" data-screen="ranking" aria-hidden="true"><div class="inner"><div class="head"><div><span class="eyebrow">КЛУБНАЯ АКТИВНОСТЬ</span><h2>Рейтинг</h2></div></div><div class="podium" id="rankingPodium"></div><div class="rank-list" id="rankingList"></div></div></section>
        <section class="page" data-screen="profile"><div class="inner"><div class="head"><div><span class="eyebrow">ЛИЧНЫЙ КАБИНЕТ</span><h2>Мой профиль</h2></div></div><section class="profile-hero" id="profileHero"></section><section class="card xp" id="xpCard"></section><div class="stats" id="profileStats"></div><section class="wallet"><div class="wallet-head"><div><small>НАКОПЛЕНО</small><strong id="pointsBalance">0</strong><small>BALI-Баллов</small></div><button class="secondary" id="refreshPoints">Обновить</button></div><div class="ledger" id="pointsLedger"></div></section><section class="card"><div class="card-head"><h3>Мои награды</h3><span class="count" id="achievementCount"></span></div><div class="achievements" id="achievements"></div></section><section class="card"><div class="card-head"><h3>VIP-статусы</h3><span class="count">Telegram Stars</span></div><div id="activeVip"></div><div class="vip-plans" id="vipPlans"></div></section><section class="card"><div class="card-head"><h3>Настройки профиля</h3></div><form class="profile-form" id="profileForm"><label><span>Имя</span><input name="name" required></label><label><span>Телефон</span><input name="phone" inputmode="tel" placeholder="+375 29 670-03-00"></label><label><span>Telegram</span><input name="username" placeholder="@username"></label><label class="switch"><span>Показывать меня в рейтинге</span><input name="publicRanking" type="checkbox"></label><button class="primary full">Сохранить профиль</button></form></section></div></section>
      </main>
      <nav class="nav"><button class="active" data-page="home"><i>⌂</i><span>Главная</span></button><button data-page="events"><i>◫</i><span>Афиши</span></button><button data-page="menu"><i>◇</i><span>Меню</span></button><button data-page="ranking"><i>♛</i><span>Рейтинг</span></button><button data-page="profile"><i>◎</i><span>Профиль</span></button></nav>
    </div>
    <dialog class="dialog" id="eventDialog"><div class="sheet"><button class="close" data-close>×</button><div class="dialog-media" id="eventDialogMedia"></div><div class="dialog-content"><span class="eyebrow" id="eventDialogDate"></span><h2 id="eventDialogTitle"></h2><p class="detail-copy" id="eventDialogDescription"></p><div id="eventSocial"></div><div id="eventPrivilege"></div><div class="actions"><button class="secondary" id="eventInterested">Хочу пойти</button><button class="secondary" id="eventGoing">Приду без брони</button></div><section class="card"><div class="card-head"><h3>Бронирование стола</h3></div><form class="booking" id="bookingForm"><input name="event_id" type="hidden"><input name="booking_date" type="hidden"><label><span>Свободные столы</span><div class="tables" id="tableChoices"></div><input name="table_id" type="hidden"></label><div class="row"><label><span>Время</span><input name="booking_time" type="time" value="23:00" required></label><label><span>Гостей</span><select name="guests"><option>2</option><option>3</option><option selected>4</option><option>5</option><option>6</option><option value="8">8+</option></select></label></div><label><span>Имя</span><input name="name" required></label><label><span>Телефон</span><input name="phone" inputmode="tel" required></label><label><span>Telegram</span><input name="telegram"></label><label><span>Комментарий</span><textarea name="comment"></textarea></label><button class="primary full">Забронировать стол</button></form></section></div></div></dialog>
    <input class="hidden" id="avatarInput" type="file" accept="image/*">`;

    bind();
    window.dispatchEvent(new CustomEvent("bali:core-mounted"));
  }

  function go(page) {
    const target = document.querySelector(`[data-screen="${CSS.escape(String(page))}"]`);
    if (!target) return;
    state.page = page;
    document.querySelectorAll(".page").forEach(node => node.classList.toggle("active", node === target));
    document.querySelectorAll(".nav [data-page]").forEach(node => node.classList.toggle("active", node.dataset.page === page));
    target.scrollTo?.(0, 0);
    if (page === "profile") renderProfile();
    if (page === "ranking") renderRanking();
    try { tg?.HapticFeedback?.selectionChanged(); } catch {}
  }

  function bind() {
    document.addEventListener("click", onClick);
    byId("profileForm")?.addEventListener("submit", saveProfileForm);
    byId("bookingForm")?.addEventListener("submit", submitBooking);
    byId("avatarInput")?.addEventListener("change", uploadAvatar);
    byId("refreshPoints")?.addEventListener("click", renderProfile);
    byId("shareApp")?.addEventListener("click", shareApp);
    byId("eventInterested")?.addEventListener("click", () => toggleRsvp("interested"));
    byId("eventGoing")?.addEventListener("click", () => toggleRsvp("going"));
  }

  async function onClick(event) {
    const pageButton = event.target.closest("[data-page]");
    if (pageButton) {
      event.preventDefault();
      go(pageButton.dataset.page);
      return;
    }
    const eventButton = event.target.closest("[data-event]");
    if (eventButton) {
      await openEvent(eventButton.dataset.event);
      return;
    }
    const categoryButton = event.target.closest("[data-category]");
    if (categoryButton) {
      state.category = categoryButton.dataset.category;
      renderMenu();
      return;
    }
    const tableButton = event.target.closest("[data-table]");
    if (tableButton && !tableButton.disabled) {
      state.selectedTable = tableButton.dataset.table;
      renderTableChoices();
      return;
    }
    const buyButton = event.target.closest("[data-buy-vip]");
    if (buyButton) {
      await buyVip(buyButton.dataset.buyVip);
      return;
    }
    if (event.target.closest("[data-avatar-edit]")) {
      byId("avatarInput")?.click();
      return;
    }
    const closeButton = event.target.closest("[data-close]");
    if (closeButton) closeButton.closest("dialog")?.close?.();
  }

  async function safeList(table, options = {}) {
    try {
      const rows = await store.list(table, options);
      return Array.isArray(rows) ? rows : [];
    } catch (error) {
      console.warn(`[BALI ${table}]`, error?.message || error);
      return [];
    }
  }

  async function load() {
    const version = ++state.loadVersion;
    const [events, menu] = await Promise.all([
      safeList("events", { order: "event_date" }),
      safeList("menu_items", { order: "sort_order" })
    ]);
    if (version !== state.loadVersion) return;

    state.events = events
      .filter(item => item?.active !== false)
      .sort((a, b) => `${a.event_date || ""}T${a.event_time || "23:59"}`.localeCompare(`${b.event_date || ""}T${b.event_time || "23:59"}`));
    state.menu = menu.filter(item => item?.active !== false);

    renderHome();
    renderEvents();
    renderMenu();
    renderProfile();
    if (state.page === "ranking") renderRanking();
    window.dispatchEvent(new CustomEvent("bali:core-data-ready", { detail: { events: state.events.length, menu: state.menu.length } }));
  }

  function eventMedia(item = {}) {
    return item.image_url
      ? `<img src="${esc(item.image_url)}" alt="${esc(item.title || "BALI")}" loading="lazy">`
      : '<div class="placeholder">BALI</div>';
  }

  function renderHome() {
    const root = byId("homeEvents");
    if (!root) return;
    root.innerHTML = state.events.slice(0, 3).map(item => `<article class="compact-event"><div>${eventMedia(item)}</div><div><h3>${esc(item.title || "Мероприятие BALI")}</h3><p>${fmtDate(item.event_date)} · ${esc(item.event_time || "23:00")}</p></div><button data-event="${esc(item.id)}">＋</button></article>`).join("") || '<div class="empty">Ближайшие события скоро появятся</div>';
  }

  function renderEvents() {
    const count = byId("eventsCount");
    const grid = byId("eventsGrid");
    if (count) count.textContent = `${state.events.length} событий`;
    if (!grid) return;
    grid.innerHTML = state.events.map(item => `<article class="event" data-event="${esc(item.id)}"><div class="event-media">${eventMedia(item)}</div><div class="event-body"><small>${fmtDate(item.event_date)} · ${esc(item.event_time || "23:00")}</small><h3>${esc(item.title || "Мероприятие BALI")}</h3><p>${esc(item.description || "Подробности мероприятия")}</p></div></article>`).join("") || '<div class="empty">Афиш пока нет</div>';
  }

  function renderMenu() {
    const tabs = byId("menuTabs");
    const count = byId("menuCount");
    const list = byId("menuList");
    if (!tabs || !list) return;

    const categories = ["Все", ...new Set(state.menu.map(item => item.category || "Другое"))];
    if (!categories.includes(state.category)) state.category = "Все";
    tabs.innerHTML = categories.map(category => `<button class="${category === state.category ? "active" : ""}" data-category="${esc(category)}">${esc(category)}</button>`).join("");
    const rows = state.category === "Все" ? state.menu : state.menu.filter(item => (item.category || "Другое") === state.category);
    if (count) count.textContent = `${rows.length} позиций`;
    list.innerHTML = rows.map(item => `<article class="menu-item"><div><h3>${esc(item.name || "Позиция меню")}</h3><p>${esc(item.description || "")}</p></div><strong>${money(item.price)}</strong></article>`).join("") || '<div class="empty">В этой категории пока нет позиций</div>';
  }

  function rankRow(item) {
    return `<article class="rank-row ${item.isMe ? "me" : ""}"><b>#${Number(item.position || 0)}</b>${avatarHtml(item, "avatar")}<div><h3>${esc(item.name || "Гость BALI")}</h3><p>${esc(item.username || "")} · ${Number(item.visits || 0)} посещений</p></div><b>${Number(item.xp || 0)} XP</b></article>`;
  }

  function renderRanking() {
    const podium = byId("rankingPodium");
    const list = byId("rankingList");
    if (!podium || !list || typeof game.ranking !== "function") return;
    let rows = [];
    try { rows = game.ranking(Object.values(points?.accounts?.() || {})) || []; }
    catch (error) {
      console.warn("[BALI ranking]", error?.message || error);
      return;
    }
    podium.innerHTML = rows.slice(0, 3).map(item => `<article>${avatarHtml(item, "avatar rank-avatar")}<strong>${esc(item.name || "Гость BALI")}</strong><small>#${Number(item.position || 0)}</small><b>${Number(item.xp || 0)} XP</b></article>`).join("");
    list.innerHTML = rows.slice(3, 30).map(rankRow).join("");
  }

  function filteredLedger() {
    const identityKeys = typeof game.identityKeys === "function" ? game.identityKeys(game.profile()) : [];
    const keys = new Set(identityKeys.map(String));
    return (points?.ledger?.() || []).filter(row => !row.userKey || keys.has(String(row.userKey)));
  }

  function renderLedger(balance) {
    const root = byId("pointsLedger");
    if (!root) return;
    const rows = filteredLedger();
    let running = Number(balance || 0);
    const enriched = rows.map(row => {
      const after = running;
      running -= Number(row.amount || 0);
      return { ...row, after };
    });
    root.innerHTML = enriched.slice(0, 30).map(row => {
      const amount = Number(row.amount || 0);
      const minus = amount < 0;
      return `<article class="ledger-row"><span class="ledger-icon">${minus ? "−" : "＋"}</span><div><h3>${esc(row.title || "Операция BALI")}</h3><p>${fmtDateTime(row.createdAt || row.created_at)} · Баланс после операции: ${Number(row.after || 0)}</p></div><b class="${minus ? "minus" : ""}">${amount > 0 ? "+" : ""}${amount}</b></article>`;
    }).join("") || '<div class="empty">История начислений и списаний пока пуста</div>';
  }

  function renderProfile() {
    let profile;
    try { profile = game.profile(); }
    catch (error) { console.warn("[BALI profile]", error); return; }

    const level = game.levelFor?.(profile.xp) || { current: { name: "BALI Guest" }, next: null, progress: 0 };
    const vip = game.vip?.() || null;
    const achievements = game.achievements?.() || [];
    const balance = Number(points?.profile?.()?.balance ?? profile.points ?? 0);

    const hero = byId("profileHero");
    if (hero) hero.innerHTML = `<div style="position:relative">${avatarHtml(profile, "avatar profile-avatar")}<button class="avatar-label" data-avatar-edit>Изменить фото</button></div><div><h2>${esc(profile.name || "Гость BALI")}</h2><p>${esc(profile.username || "Telegram не указан")}</p><div class="badges"><span>${esc(level.current?.name || "BALI Guest")}</span>${vip?.plan?.name ? `<span class="vip">${esc(vip.plan.name)}</span>` : ""}</div></div>`;

    const xpCard = byId("xpCard");
    if (xpCard) xpCard.innerHTML = `<div class="xp-head"><strong>${esc(level.current?.name || "BALI Guest")}</strong><span>${level.next ? `${Number(profile.xp || 0)} / ${Number(level.next.minXp || 0)} XP` : `${Number(profile.xp || 0)} XP · максимум`}</span></div><div class="progress"><i style="width:${Math.max(0, Math.min(100, Number(level.progress || 0)))}%"></i></div>`;

    const stats = byId("profileStats");
    if (stats) stats.innerHTML = `<article><strong>${Number(profile.visits || 0)}</strong><span>ПОСЕЩЕНИЯ</span></article><article><strong>${Number(profile.bookings || 0)}</strong><span>БРОНИ</span></article><article><strong>${Number(profile.streak || 0)}</strong><span>СЕРИЯ</span></article><article><strong>${achievements.filter(item => item.earnedAt).length}</strong><span>НАГРАДЫ</span></article>`;

    const balanceNode = byId("pointsBalance");
    if (balanceNode) balanceNode.textContent = String(balance);
    renderLedger(balance);

    const achievementCount = byId("achievementCount");
    if (achievementCount) achievementCount.textContent = `${achievements.filter(item => item.earnedAt).length}/${achievements.length}`;
    const achievementRoot = byId("achievements");
    if (achievementRoot) achievementRoot.innerHTML = achievements.map(item => `<article class="achievement ${item.earnedAt ? "earned" : ""}"><i>${esc(item.icon || "🏆")}</i><h3>${esc(item.title || "Награда BALI")}</h3><p>${esc(item.description || "")}</p><b>${item.earnedAt ? `Получено ${fmtDateTime(item.earnedAt)}` : `+${Number(item.xp || 0)} XP`}</b></article>`).join("");

    const activeVip = byId("activeVip");
    if (activeVip) activeVip.innerHTML = vip?.plan?.name ? `<div class="vip-active"><strong>${esc(vip.plan.name)}</strong><br>${vip.source === "admin_gift" ? "Подарок от клуба · " : "Активен до "}${fmtDate(vip.expiresAt?.slice?.(0, 10))}${vip.note ? `<br>${esc(vip.note)}` : ""}</div>` : "";

    const vipPlans = byId("vipPlans");
    if (vipPlans) vipPlans.innerHTML = (game.config?.().plans || []).filter(item => item.active !== false).map(item => `<article class="vip-plan"><div class="vip-plan-head"><h3>${esc(item.name || "VIP")}</h3><strong>⭐ ${Number(item.stars || 0)}</strong></div><div class="benefits"><span>${Number(item.discount || 0)}% скидка</span><span>${item.freeEntry ? "Бесплатный вход" : "Спеццена"}</span><span>×${Number(item.pointsMultiplier || 1)} баллы</span><span>${Number(item.earlyBookingHours || 0)} ч. ранней брони</span></div><button class="primary full" data-buy-vip="${esc(item.id)}">Купить на 30 дней</button></article>`).join("");

    const form = byId("profileForm");
    if (form?.elements) {
      if (form.elements.name) form.elements.name.value = profile.name || "";
      if (form.elements.phone) form.elements.phone.value = profile.phone || "";
      if (form.elements.username) form.elements.username.value = profile.username || "";
      if (form.elements.publicRanking) form.elements.publicRanking.checked = profile.publicRanking !== false;
    }
  }

  function saveProfileForm(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    game.saveProfile?.({
      name: String(data.name || "").trim(),
      phone: String(data.phone || "").trim(),
      username: String(data.username || "").trim(),
      publicRanking: Boolean(form.elements.publicRanking?.checked)
    });
    toast("Профиль сохранён");
    renderProfile();
    if (state.page === "ranking") renderRanking();
  }

  async function uploadAvatar(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const avatar = await resizeImage(file);
      game.saveProfile?.({ avatar });
      toast("Аватар обновлён");
      renderProfile();
      if (state.page === "ranking") renderRanking();
    } catch {
      toast("Не удалось загрузить изображение");
    }
    event.target.value = "";
  }

  function resizeImage(file) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(file);
      image.onload = () => {
        try {
          const size = 360;
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = size;
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Canvas недоступен");
          const scale = Math.max(size / image.width, size / image.height);
          const width = image.width * scale;
          const height = image.height * scale;
          context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.82));
        } catch (error) { reject(error); }
        finally { URL.revokeObjectURL(url); }
      };
      image.onerror = error => { URL.revokeObjectURL(url); reject(error); };
      image.src = url;
    });
  }

  function rsvps() { return read("bali_event_rsvps_v1", {}); }
  function mine(eventId) { return rsvps()?.[eventId]?.[game.profile()?.id] || null; }

  async function socialCounts(eventId) {
    const all = Object.values(rsvps()?.[eventId] || {});
    const bookings = (await safeList("bookings")).filter(item => String(item.event_id) === String(eventId) && !["cancelled", "completed"].includes(item.status));
    return {
      interested: all.filter(item => item.status === "interested").length,
      going: all.filter(item => item.status === "going").length,
      bookedGuests: bookings.reduce((sum, item) => sum + Number(item.guests || 0), 0)
    };
  }

  async function renderSocial() {
    if (!state.activeEvent) return;
    const counts = await socialCounts(state.activeEvent.id);
    const current = mine(state.activeEvent.id)?.status || "";
    const root = byId("eventSocial");
    if (root) root.innerHTML = `<div class="stats"><article><strong>${counts.interested}</strong><span>ХОТЯТ ПОЙТИ</span></article><article><strong>${counts.going}</strong><span>БЕЗ СТОЛА</span></article><article><strong>${counts.bookedGuests}</strong><span>ЗА СТОЛАМИ</span></article><article><strong>${state.availability.filter(item => item.available).length}</strong><span>СВОБОДНО</span></article></div>`;
    byId("eventInterested")?.classList.toggle("primary", current === "interested");
    byId("eventGoing")?.classList.toggle("primary", current === "going");
  }

  function toggleRsvp(status) {
    if (!state.activeEvent) return;
    const all = rsvps();
    const eventId = state.activeEvent.id;
    const profile = game.profile();
    const key = profile.id;
    all[eventId] ||= {};
    const current = all[eventId][key]?.status;
    if (current === "booked") return toast("У вас уже есть бронь стола");
    if (current === status) delete all[eventId][key];
    else all[eventId][key] = { user_key: key, name: profile.name, status, attendance_mode: status === "going" ? "general_admission" : "interest", updated_at: new Date().toISOString() };
    write("bali_event_rsvps_v1", all);
    toast(current === status ? "Статус отменён" : status === "going" ? "Отмечено: приду без брони" : "Добавлено: хочу пойти");
    renderSocial();
  }

  async function availability(event) {
    const layouts = read("bali_event_layouts_v1", {});
    const layout = layouts[event.id];
    const bookings = (await safeList("bookings")).filter(item => (String(item.event_id) === String(event.id) || (!item.event_id && item.booking_date === event.event_date)) && !["cancelled", "completed"].includes(item.status));
    if (layout?.tables?.length) return layout.tables.filter(item => item.active !== false).map(table => ({ ...table, available: !bookings.some(booking => String(booking.table_id) === String(table.id)) }));
    try { return await store.getAvailability(event.event_date) || []; }
    catch { return []; }
  }

  async function openEvent(id) {
    const item = state.events.find(event => String(event.id) === String(id));
    if (!item) return;
    const dialog = byId("eventDialog");
    const media = byId("eventDialogMedia");
    const form = byId("bookingForm");
    if (!dialog || !media || !form) return toast("Не удалось открыть мероприятие");

    state.activeEvent = item;
    state.selectedTable = "";
    state.availability = await availability(item);

    media.style.backgroundImage = item.image_url ? `url('${String(item.image_url).replace(/'/g, "%27")}')` : "";
    const date = byId("eventDialogDate");
    const title = byId("eventDialogTitle");
    const description = byId("eventDialogDescription");
    if (date) date.textContent = `${fmtDate(item.event_date)} · ${item.event_time || "23:00"}`;
    if (title) title.textContent = item.title || "Мероприятие BALI";
    if (description) description.textContent = item.description || "Подробности будут добавлены позднее.";

    const privilege = game.eventPrivilege?.(item.id);
    const privilegeRoot = byId("eventPrivilege");
    if (privilegeRoot) privilegeRoot.innerHTML = privilege ? `<div class="privilege"><strong>${esc(game.vip?.()?.plan?.name || "VIP")}</strong>: ${privilege.freeEntry ? "бесплатный вход" : `${Number(privilege.discount || 0)}% скидка`}, раннее бронирование ${Number(privilege.earlyBookingHours || 0)} ч.${Number(privilege.guestPasses || 0) ? `, гостевых проходов: ${Number(privilege.guestPasses)}` : ""}</div>` : "";

    const profile = game.profile();
    if (form.elements.event_id) form.elements.event_id.value = item.id;
    if (form.elements.booking_date) form.elements.booking_date.value = item.event_date || "";
    if (form.elements.booking_time) form.elements.booking_time.value = item.event_time || "23:00";
    if (form.elements.name) form.elements.name.value = profile.name || "";
    if (form.elements.phone) form.elements.phone.value = profile.phone || "";
    if (form.elements.telegram) form.elements.telegram.value = profile.username || "";

    renderTableChoices();
    await renderSocial();
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function renderTableChoices() {
    const root = byId("tableChoices");
    const tableInput = document.querySelector('#bookingForm [name="table_id"]');
    if (!root) return;
    root.innerHTML = state.availability.map(table => `<button type="button" class="table ${String(state.selectedTable) === String(table.id) ? "selected" : ""}" data-table="${esc(table.id)}" ${table.available ? "" : "disabled"}><strong>${esc(table.name || table.id)}</strong><br>${Number(table.seats || 4)} мест<br>${table.available ? "свободен" : "занят"}</button>`).join("") || '<div class="empty">Схема столов ещё не настроена</div>';
    if (tableInput) tableInput.value = state.selectedTable;
  }

  async function submitBooking(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    if (!data.table_id) return toast("Выберите свободный стол");
    try {
      const chosen = state.availability.find(item => String(item.id) === String(data.table_id));
      const booking = await store.createBooking(data);
      const profile = game.profile();
      await store.save("bookings", { ...booking, event_id: data.event_id, owner_key: profile.id, telegram_id: profile.telegramId || null, telegram: profile.username || data.telegram, table_name: chosen?.name || data.table_id });
      game.saveProfile?.({ phone: data.phone, name: data.name, username: data.telegram || profile.username });
      game.recordBooking?.(data.guests);
      const all = rsvps();
      all[data.event_id] ||= {};
      all[data.event_id][profile.id] = { user_key: profile.id, name: data.name, status: "booked", attendance_mode: "table_booking", booking_id: booking.id, guests: Number(data.guests || 0), updated_at: new Date().toISOString() };
      write("bali_event_rsvps_v1", all);
      toast(`Бронь на ${chosen?.name || "стол"} создана`);
      byId("eventDialog")?.close?.();
      await load();
    } catch (error) {
      toast(error?.message || "Не удалось создать бронь");
    }
  }

  async function buyVip(planId) {
    const plan = (game.config?.().plans || []).find(item => String(item.id) === String(planId));
    if (!plan) return;
    const endpoint = window.BALI_CONFIG?.vipInvoiceEndpoint;
    if (endpoint && tg?.openInvoice) {
      try {
        const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId, initData: tg.initData }) });
        const payload = await response.json();
        if (!payload.invoiceUrl) throw new Error("Счёт не создан");
        tg.openInvoice(payload.invoiceUrl, status => {
          if (status === "paid") {
            game.activateVip?.(planId, "telegram_stars");
            toast("VIP активирован");
            renderProfile();
          }
        });
        return;
      } catch (error) {
        toast(error?.message || "Не удалось открыть оплату");
        return;
      }
    }
    if (!confirm(`Активировать ${plan.name} за ${plan.stars} Stars в тестовом режиме?`)) return;
    game.activateVip?.(planId, "beta_demo");
    toast("VIP активирован в Beta4");
    renderProfile();
  }

  async function shareApp() {
    const url = location.href;
    const text = "BALI Minsk — события, BALI People и VIP";
    game.recordShare?.();
    try {
      if (navigator.share) await navigator.share({ title: "BALI Minsk", text, url });
      else {
        await navigator.clipboard?.writeText(url);
        toast("Ссылка скопирована");
      }
    } catch (error) {
      if (error?.name !== "AbortError") toast("Не удалось поделиться ссылкой");
    }
  }

  try {
    tg?.ready();
    tg?.expand();
    tg?.setHeaderColor?.("#080a0a");
    tg?.setBackgroundColor?.("#080a0a");
  } catch {}

  mount();
  load().catch(error => {
    console.error("[BALI core load]", error);
    toast(error?.message || "Не удалось загрузить приложение");
  });

  window.addEventListener("bali:data-changed", () => load());
  window.addEventListener("bali:points-changed", () => state.page === "profile" && renderProfile());
  window.addEventListener("bali:beta4-changed", () => {
    if (state.page === "profile") renderProfile();
    if (state.page === "ranking") renderRanking();
  });

  window.BaliBeta4App = { load, go, renderHome, renderEvents, renderMenu, renderProfile, renderRanking, openEvent, state };
})();