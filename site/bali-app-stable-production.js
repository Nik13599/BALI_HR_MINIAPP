(() => {
  if (window.__BALI_APP_STABLE_PRODUCTION_V1__) return;
  window.__BALI_APP_STABLE_PRODUCTION_V1__ = true;

  const app = document.getElementById("app");
  const store = window.BaliStore;
  const points = window.BaliPoints;
  const game = window.BaliBeta4Game;
  const tg = window.Telegram?.WebApp;
  const cfg = window.BALI_CONFIG || {};
  if (!app || !store || !game) return;

  const state = {
    events: [],
    menu: [],
    category: "Все",
    page: "home",
    activeEvent: null,
    availability: [],
    selectedTable: "",
    loading: false,
    pendingReload: false
  };

  const byId = id => document.getElementById(id);
  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);
  const fmtDate = value => value
    ? new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString("ru-RU", { day:"2-digit", month:"long", year:"numeric" })
    : "—";
  const fmtDateTime = value => value
    ? new Date(value).toLocaleString("ru-RU", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" })
    : "—";
  const money = value => `${Number(value || 0).toLocaleString("ru-RU")} BYN`;
  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  };
  const write = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent("bali:beta4-local", { detail:{ key } }));
    return value;
  };
  const initials = name => String(name || "B").trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();

  function capture(error, context = "") {
    try { window.BaliErrorBoundary?.capture?.(error, { context }); } catch {}
    console.error(`[BALI ${context || "runtime"}]`, error);
  }

  function safe(context, fn, fallback = null) {
    try { return fn(); }
    catch (error) {
      capture(error, context);
      return fallback;
    }
  }

  async function safeAsync(context, fn, fallback = null) {
    try { return await fn(); }
    catch (error) {
      capture(error, context);
      return fallback;
    }
  }

  function toast(message) {
    const node = byId("toast");
    if (!node) return;
    node.textContent = String(message || "");
    node.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove("show"), 2400);
  }

  function avatarHtml(user = {}, className = "avatar") {
    const avatar = user.avatar || user.photo || "";
    return `<span class="${className}">${avatar ? `<img src="${esc(avatar)}" alt="">` : esc(initials(user.name))}</span>`;
  }

  function ensureStyles() {
    if (byId("baliStableRuntimeStyle")) return;
    const style = document.createElement("style");
    style.id = "baliStableRuntimeStyle";
    style.textContent = `
      [data-screen="ranking"]{display:none!important}
      .bali-referral-card{display:grid;gap:14px;padding:18px;border:1px solid rgba(200,255,61,.25);border-radius:22px;background:linear-gradient(145deg,rgba(200,255,61,.07),rgba(255,255,255,.02))}
      .bali-referral-card h3{margin:0;font-size:20px}.bali-referral-card p{margin:0;color:var(--muted);font-size:10px;line-height:1.55}
      .bali-referral-card button{width:100%;min-height:48px}
      .bali-contact-card{display:grid;gap:14px}
      .bali-contact-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
      .bali-contact-grid a{display:grid;gap:4px;padding:13px;border:1px solid var(--line);border-radius:15px;background:#ffffff05;color:#fff;text-decoration:none}
      .bali-contact-grid strong{font-size:11px}.bali-contact-grid small{color:var(--muted);font-size:8px;line-height:1.4}
      .bali-home-loading{padding:18px;border:1px dashed var(--line);border-radius:16px;color:var(--muted);text-align:center}
      .profile-v2-quick{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      .profile-v2-quick .gifts{grid-column:1/-1}
      @media(max-width:390px){.bali-contact-grid{grid-template-columns:1fr}.profile-v2-quick{gap:7px}}
    `;
    document.head.appendChild(style);
  }

  function mount() {
    ensureStyles();
    app.innerHTML = `
      <div class="shell">
        <header class="top">
          <button class="brand" type="button" data-page="home">
            <span class="logo">B</span>
            <span><strong>BALI</strong><small>МИНСК · NIGHT CLUB</small></span>
          </button>
          <button class="top-action" id="shareApp" type="button" aria-label="Поделиться">↗</button>
        </header>

        <main class="pages">
          <section class="page active" data-screen="home">
            <div class="inner" id="homeInner">
              <article class="hero" id="homeHero">
                <span class="eyebrow">NIGHT CLUB · CONTACT BAR · 18+</span>
                <h1>Твоя ночь<br><em>начинается здесь</em></h1>
                <p>Клубный формат BALI: события, танцпол, контактный бар, кальяны и индивидуальная рассадка столов.</p>
                <div class="pills"><span>Кирова, 13</span><span>ПТ–СБ · 23:00–06:00</span><span>5 минут от «Динамо»</span></div>
              </article>

              <div class="actions" id="homeActions">
                <button class="primary" data-page="events">Смотреть афиши</button>
                <button class="secondary" data-page="profile">Мой профиль</button>
              </div>

              <section class="card" id="homeEventsCard">
                <div class="card-head"><h3>Ближайшие события</h3><button data-page="events">Все афиши</button></div>
                <div class="home-events" id="homeEvents"><div class="bali-home-loading">Загружаем ближайшие события…</div></div>
              </section>

              <section class="card" id="homeAboutCard">
                <div class="card-head"><h3>О клубе</h3></div>
                <p class="muted" style="font-size:11px;line-height:1.65">BALI — ночной клуб с большими экранами, танцполом, контактным баром, кальянами и комфортными столами. Можно прийти без брони и провести ночь у контактной барной стойки.</p>
              </section>

              <section class="bali-referral-card" id="baliReferralCard">
                <div><h3>Пригласить друга в BALI</h3><p>10 BALI-Баллов начислятся, когда новый друг перейдёт по ссылке и впервые откроет приложение.</p></div>
                <button class="primary" type="button" id="inviteFriend">Пригласить</button>
              </section>

              <section class="card bali-contact-card" id="clubLinks">
                <div class="card-head"><h3>Контакты BALI</h3></div>
                <div class="bali-contact-grid">
                  <a href="${esc(cfg.instagramUrl || "https://www.instagram.com/baliminsk/")}" data-open-link><strong>Instagram</strong><small>Новости и атмосфера клуба</small></a>
                  <a href="${esc(cfg.telegramChannelUrl || "https://t.me/baliclubminsk")}" data-telegram-link><strong>Telegram-канал</strong><small>Афиши и новости</small></a>
                  <a href="tel:${esc(String(cfg.venuePhone || "+375296700300").replace(/[^+\d]/g, ""))}"><strong>Позвонить</strong><small>${esc(cfg.venuePhone || "+375 29 670-03-00")}</small></a>
                  <a href="${esc(cfg.yandexMapUrl || "https://yandex.by/maps/")}" data-open-link><strong>Яндекс Карты</strong><small>${esc(cfg.venueAddress || "Минск, ул. Кирова, 13")}</small></a>
                </div>
              </section>
            </div>
          </section>

          <section class="page" data-screen="events">
            <div class="inner"><div class="head"><div><span class="eyebrow">БЛИЖАЙШИЕ ДАТЫ</span><h2>Афиши</h2></div><span class="count" id="eventsCount"></span></div><div class="events" id="eventsGrid"></div></div>
          </section>

          <section class="page" data-screen="menu">
            <div class="inner"><div class="head"><div><span class="eyebrow">БАР · КУХНЯ · КАЛЬЯНЫ</span><h2>Меню</h2></div><span class="count" id="menuCount"></span></div><div class="tabs" id="menuTabs"></div><div class="menu-list" id="menuList"></div></div>
          </section>

          <section class="page" data-screen="dating">
            <div class="inner">
              <div class="head"><div><span class="eyebrow">BALI PEOPLE · 18+</span><h2>Люди BALI</h2></div><span class="count" id="peopleCount"></span></div>
              <div class="social-tabs-v2">
                <button class="active" data-social-v2-tab="all">Все</button>
                <button data-social-v2-tab="inside">Пришёл на мероприятие</button>
                <button data-social-v2-tab="thumbs">👍 Лайки</button>
              </div>
              <div id="socialV2Content"><div class="social-v2-empty">Загружаем пользователей BALI…</div></div>
            </div>
          </section>

          <section class="page" data-screen="ranking" aria-hidden="true">
            <div class="inner"><div class="podium" id="rankingPodium"></div><div class="rank-list" id="rankingList"></div></div>
          </section>

          <section class="page" data-screen="profile">
            <div class="inner">
              <div class="head"><div><span class="eyebrow">ЛИЧНЫЙ КАБИНЕТ</span><h2>Мой профиль</h2></div></div>
              <section class="profile-hero" id="profileHero"></section>
              <section class="card xp" id="xpCard"></section>
              <section id="profileV2Quick" class="profile-v2-quick"></section>
              <div class="stats" id="profileStats"></div>
              <section class="wallet"><div class="wallet-head"><div><small>НАКОПЛЕНО</small><strong id="pointsBalance">0</strong><small>BALI-Баллов</small></div><button class="secondary" id="refreshPoints" type="button">Обновить</button></div><div class="ledger" id="pointsLedger"></div></section>
              <section class="card"><div class="card-head"><h3>Мои награды</h3><span class="count" id="achievementCount"></span></div><div class="achievements" id="achievements"></div></section>
              <section class="card"><div class="card-head"><h3>VIP-статусы</h3><span class="count">Telegram Stars</span></div><div id="activeVip"></div><div class="vip-plans" id="vipPlans"></div></section>
              <section class="card"><div class="card-head"><h3>Настройки профиля</h3></div><form class="profile-form" id="profileForm"><label><span>Имя</span><input name="name" required></label><label><span>Телефон</span><input name="phone" inputmode="tel" placeholder="+375 29 670-03-00"></label><label><span>Telegram</span><input name="username" placeholder="@username"></label><label class="switch"><span>Показывать меня в рейтинге</span><input name="publicRanking" type="checkbox"></label><button class="primary full">Сохранить профиль</button></form></section>
            </div>
          </section>
        </main>

        <nav class="nav" data-navigation-ready="true">
          <button class="active" data-page="home"><i>⌂</i><span>Главная</span></button>
          <button data-page="events"><i>◫</i><span>Афиши</span></button>
          <button data-page="menu"><i>◇</i><span>Меню</span></button>
          <button data-page="dating"><i>🌴</i><span>BALI PEOPLE</span></button>
          <button data-page="profile"><i>◎</i><span>Профиль</span></button>
        </nav>
      </div>

      <dialog class="dialog" id="eventDialog">
        <div class="sheet">
          <button class="close" data-close>×</button>
          <div class="dialog-media" id="eventDialogMedia"></div>
          <div class="dialog-content">
            <span class="eyebrow" id="eventDialogDate"></span>
            <h2 id="eventDialogTitle"></h2>
            <p class="detail-copy" id="eventDialogDescription"></p>
            <div id="eventSocial"></div>
            <div id="eventPrivilege"></div>
            <div class="actions"><button class="secondary" id="eventInterested" type="button">Хочу пойти</button><button class="secondary" id="eventGoing" type="button">Приду без брони</button></div>
            <section class="card">
              <div class="card-head"><h3>Бронирование стола</h3></div>
              <form class="booking" id="bookingForm">
                <input name="event_id" type="hidden"><input name="booking_date" type="hidden">
                <label><span>Свободные столы</span><div class="tables" id="tableChoices"></div><input name="table_id" type="hidden"></label>
                <div class="row"><label><span>Время</span><input name="booking_time" type="time" value="23:00" required></label><label><span>Гостей</span><select name="guests"><option>2</option><option>3</option><option selected>4</option><option>5</option><option>6</option><option value="8">8+</option></select></label></div>
                <label><span>Имя</span><input name="name" required></label>
                <label><span>Телефон</span><input name="phone" inputmode="tel" required></label>
                <label><span>Telegram</span><input name="telegram"></label>
                <label><span>Комментарий</span><textarea name="comment"></textarea></label>
                <button class="primary full">Забронировать стол</button>
              </form>
            </section>
          </div>
        </div>
      </dialog>
      <input class="hidden" id="avatarInput" type="file" accept="image/*">
    `;

    bind();
    finalizeLayout();
    window.dispatchEvent(new CustomEvent("bali:app-mounted"));
  }

  function bind() {
    document.addEventListener("click", onClick);
    document.addEventListener("submit", onSubmit);
    document.addEventListener("change", onChange);
  }

  function go(page) {
    if (!document.querySelector(`[data-screen="${page}"]`)) return;
    state.page = page;
    document.querySelectorAll(".page").forEach(node => node.classList.toggle("active", node.dataset.screen === page));
    document.querySelectorAll(".nav [data-page]").forEach(node => node.classList.toggle("active", node.dataset.page === page));
    document.querySelector(`[data-screen="${page}"]`)?.scrollTo?.(0, 0);
    if (page === "profile") {
      renderProfile();
      window.BaliCompactProfile?.mount?.();
    }
    if (page === "dating") window.BaliSocialCloud?.refresh?.();
    try { tg?.HapticFeedback?.selectionChanged?.(); } catch {}
  }

  async function onClick(event) {
    const page = event.target.closest("[data-page]");
    if (page) {
      event.preventDefault();
      go(page.dataset.page);
      return;
    }

    const eventButton = event.target.closest("[data-event]");
    if (eventButton) {
      await openEvent(eventButton.dataset.event);
      return;
    }

    const category = event.target.closest("[data-category]");
    if (category) {
      state.category = category.dataset.category;
      renderMenu();
      return;
    }

    const table = event.target.closest("[data-table]");
    if (table && !table.disabled) {
      state.selectedTable = table.dataset.table;
      renderTableChoices();
      return;
    }

    const buy = event.target.closest("[data-buy-vip]");
    if (buy) {
      await buyVip(buy.dataset.buyVip);
      return;
    }

    if (event.target.closest("[data-avatar-edit]")) {
      byId("avatarInput")?.click();
      return;
    }

    if (event.target.closest("#refreshPoints")) {
      renderProfile();
      window.BaliCompactProfile?.mount?.();
      return;
    }

    if (event.target.closest("#shareApp")) {
      shareApp();
      return;
    }

    if (event.target.closest("#inviteFriend")) {
      inviteFriend();
      return;
    }

    if (event.target.closest("#eventInterested")) {
      toggleRsvp("interested");
      return;
    }

    if (event.target.closest("#eventGoing")) {
      toggleRsvp("going");
      return;
    }

    const telegramLink = event.target.closest("[data-telegram-link]");
    if (telegramLink) {
      event.preventDefault();
      if (tg?.openTelegramLink) tg.openTelegramLink(telegramLink.href);
      else window.open(telegramLink.href, "_blank", "noopener");
      return;
    }

    const external = event.target.closest("[data-open-link]");
    if (external) {
      event.preventDefault();
      if (tg?.openLink) tg.openLink(external.href);
      else window.open(external.href, "_blank", "noopener");
      return;
    }

    const close = event.target.closest("[data-close]");
    if (close) close.closest("dialog")?.close();
  }

  function onSubmit(event) {
    if (event.target.id === "profileForm") return saveProfileForm(event);
    if (event.target.id === "bookingForm") return submitBooking(event);
  }

  function onChange(event) {
    if (event.target.id === "avatarInput") uploadAvatar(event);
  }

  async function loadData() {
    if (state.loading) {
      state.pendingReload = true;
      return;
    }
    state.loading = true;
    try {
      const [eventsResult, menuResult] = await Promise.allSettled([
        store.list("events", { order:"event_date" }),
        store.list("menu_items", { order:"sort_order" })
      ]);

      state.events = eventsResult.status === "fulfilled" && Array.isArray(eventsResult.value) ? eventsResult.value : [];
      state.menu = menuResult.status === "fulfilled" && Array.isArray(menuResult.value) ? menuResult.value : [];

      if (eventsResult.status === "rejected") capture(eventsResult.reason, "events-load");
      if (menuResult.status === "rejected") capture(menuResult.reason, "menu-load");

      state.events = state.events
        .filter(item => item && item.active !== false)
        .sort((a, b) => `${a.event_date || ""}T${a.event_time || "23:59"}`.localeCompare(`${b.event_date || ""}T${b.event_time || "23:59"}`));
      state.menu = state.menu.filter(item => item && item.active !== false);

      renderAll();
    } finally {
      state.loading = false;
      if (state.pendingReload) {
        state.pendingReload = false;
        setTimeout(loadData, 0);
      }
    }
  }

  function renderAll() {
    safe("render-home", renderHome);
    safe("render-events", renderEvents);
    safe("render-menu", renderMenu);
    safe("render-ranking", renderRanking);
    safe("render-profile", renderProfile);
    finalizeLayout();
  }

  function eventMedia(item = {}) {
    return item.image_url
      ? `<img src="${esc(item.image_url)}" alt="${esc(item.title || "Событие BALI")}" loading="lazy">`
      : `<div class="placeholder">BALI</div>`;
  }

  function renderHome() {
    const root = byId("homeEvents");
    if (!root) return;
    const rows = state.events.slice(0, 3);
    root.innerHTML = rows.length
      ? rows.map(item => `<article class="compact-event"><div>${eventMedia(item)}</div><div><h3>${esc(item.title || "Событие BALI")}</h3><p>${fmtDate(item.event_date)} · ${esc(item.event_time || "23:00")}</p></div><button type="button" data-event="${esc(item.id)}">＋</button></article>`).join("")
      : '<div class="empty">Ближайшие события скоро появятся</div>';
  }

  function renderEvents() {
    const count = byId("eventsCount");
    const grid = byId("eventsGrid");
    if (count) count.textContent = `${state.events.length} событий`;
    if (!grid) return;
    grid.innerHTML = state.events.length
      ? state.events.map(item => `<article class="event" data-event="${esc(item.id)}"><div class="event-media">${eventMedia(item)}</div><div class="event-body"><small>${fmtDate(item.event_date)} · ${esc(item.event_time || "23:00")}</small><h3>${esc(item.title || "Событие BALI")}</h3><p>${esc(item.description || "Подробности мероприятия")}</p></div></article>`).join("")
      : '<div class="empty">Афиш пока нет</div>';
  }

  function renderMenu() {
    const tabs = byId("menuTabs");
    const count = byId("menuCount");
    const list = byId("menuList");
    const categories = ["Все", ...new Set(state.menu.map(item => item.category || "Другое"))];
    if (!categories.includes(state.category)) state.category = "Все";
    if (tabs) tabs.innerHTML = categories.map(category => `<button type="button" class="${category === state.category ? "active" : ""}" data-category="${esc(category)}">${esc(category)}</button>`).join("");
    const rows = state.category === "Все" ? state.menu : state.menu.filter(item => (item.category || "Другое") === state.category);
    if (count) count.textContent = `${rows.length} позиций`;
    if (!list) return;
    list.innerHTML = rows.length
      ? rows.map(item => `<article class="menu-item">${item.image_url ? `<img src="${esc(item.image_url)}" alt="${esc(item.name || "")}" loading="lazy" style="width:56px;height:56px;object-fit:cover;border-radius:12px">` : ""}<div><h3>${esc(item.name || "Позиция меню")}</h3><p>${esc(item.description || "")}</p></div><strong>${money(item.price)}</strong></article>`).join("")
      : '<div class="empty">В этой категории пока нет позиций</div>';
  }

  function rankRow(item) {
    return `<article class="rank-row ${item.isMe ? "me" : ""}"><b>#${Number(item.position || 0)}</b>${avatarHtml(item, "avatar")}<div><h3>${esc(item.name || "Гость BALI")}</h3><p>${esc(item.username || "")} · ${Number(item.visits || 0)} посещений</p></div><b>${Number(item.xp || 0)} XP</b></article>`;
  }

  function renderRanking() {
    const podium = byId("rankingPodium");
    const list = byId("rankingList");
    if (!podium || !list) return;
    const rows = game.ranking?.(Object.values(points?.accounts?.() || {})) || [];
    const top = rows.slice(0, 3);
    podium.innerHTML = top.map(item => `<article>${avatarHtml(item, "avatar rank-avatar")}<strong>${esc(item.name || "Гость BALI")}</strong><small>#${Number(item.position || 0)}</small><b>${Number(item.xp || 0)} XP</b></article>`).join("");
    list.innerHTML = rows.slice(3, 30).map(rankRow).join("");
  }

  function filteredLedger() {
    const identity = new Set(game.identityKeys?.(game.profile()) || []);
    return (points?.ledger?.() || []).filter(row => !row.userKey || identity.has(String(row.userKey)));
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
    root.innerHTML = enriched.length
      ? enriched.slice(0, 30).map(row => {
          const amount = Number(row.amount || 0);
          return `<article class="ledger-row"><span class="ledger-icon">${amount < 0 ? "−" : "＋"}</span><div><h3>${esc(row.title || "Операция BALI")}</h3><p>${fmtDateTime(row.createdAt || row.created_at)} · Баланс после операции: ${Number(row.after || 0)}</p></div><b class="${amount < 0 ? "minus" : ""}">${amount > 0 ? "+" : ""}${amount}</b></article>`;
        }).join("")
      : '<div class="empty">История начислений и списаний пока пуста</div>';
  }

  function renderProfile() {
    const profile = game.profile();
    const level = game.levelFor?.(profile.xp) || { current:{ name:"BALI Guest" }, next:null, progress:0 };
    const vip = game.vip?.() || null;
    const achievements = game.achievements?.() || [];
    const balance = Number(points?.profile?.()?.balance ?? profile.points ?? 0);

    const hero = byId("profileHero");
    const xp = byId("xpCard");
    const stats = byId("profileStats");
    const balanceNode = byId("pointsBalance");
    const achievementCount = byId("achievementCount");
    const achievementsNode = byId("achievements");
    const activeVip = byId("activeVip");
    const vipPlans = byId("vipPlans");
    const form = byId("profileForm");

    if (hero) hero.innerHTML = `<div style="position:relative">${avatarHtml(profile, "avatar profile-avatar")}<button class="avatar-label" type="button" data-avatar-edit>Изменить фото</button></div><div><h2>${esc(profile.name || "Гость BALI")}</h2><p>${esc(profile.username || "Telegram не указан")}</p><div class="badges"><span>${esc(level.current?.name || "BALI Guest")}</span>${vip ? `<span class="vip">${esc(vip.plan?.name || "VIP")}</span>` : ""}</div></div>`;
    if (xp) xp.innerHTML = `<div class="xp-head"><strong>${esc(level.current?.name || "BALI Guest")}</strong><span>${level.next ? `${Number(profile.xp || 0)} / ${Number(level.next.minXp || 0)} XP` : `${Number(profile.xp || 0)} XP · максимум`}</span></div><div class="progress"><i style="width:${Number(level.progress || 0)}%"></i></div>`;
    if (stats) stats.innerHTML = `<article><strong>${Number(profile.visits || 0)}</strong><span>ПОСЕЩЕНИЯ</span></article><article><strong>${Number(profile.bookings || 0)}</strong><span>БРОНИ</span></article><article><strong>${Number(profile.streak || 0)}</strong><span>СЕРИЯ</span></article><article><strong>${achievements.filter(item => item.earnedAt).length}</strong><span>НАГРАДЫ</span></article>`;
    if (balanceNode) balanceNode.textContent = String(balance);
    renderLedger(balance);
    if (achievementCount) achievementCount.textContent = `${achievements.filter(item => item.earnedAt).length}/${achievements.length}`;
    if (achievementsNode) achievementsNode.innerHTML = achievements.map(item => `<article class="achievement ${item.earnedAt ? "earned" : ""}"><i>${esc(item.icon || "🏆")}</i><h3>${esc(item.title || "Награда")}</h3><p>${esc(item.description || "")}</p><b>${item.earnedAt ? `Получено ${fmtDateTime(item.earnedAt)}` : `+${Number(item.xp || 0)} XP`}</b></article>`).join("");
    if (activeVip) activeVip.innerHTML = vip ? `<div class="vip-active"><strong>${esc(vip.plan?.name || "VIP")}</strong><br>${vip.source === "admin_gift" ? "Подарок от клуба · " : "Активен до "}${fmtDate(vip.expiresAt?.slice(0, 10))}${vip.note ? `<br>${esc(vip.note)}` : ""}</div>` : "";
    if (vipPlans) vipPlans.innerHTML = (game.config?.().plans || []).filter(item => item.active !== false).map(item => `<article class="vip-plan"><div class="vip-plan-head"><h3>${esc(item.name || "VIP")}</h3><strong>⭐ ${Number(item.stars || 0)}</strong></div><div class="benefits"><span>${Number(item.discount || 0)}% скидка</span><span>${item.freeEntry ? "Бесплатный вход" : "Спеццена"}</span><span>×${Number(item.pointsMultiplier || 1)} баллы</span><span>${Number(item.earlyBookingHours || 0)} ч. ранней брони</span></div><button class="primary full" type="button" data-buy-vip="${esc(item.id)}">Купить на 30 дней</button></article>`).join("");

    if (form) {
      if (form.elements.name) form.elements.name.value = profile.name || "";
      if (form.elements.phone) form.elements.phone.value = profile.phone || "";
      if (form.elements.username) form.elements.username.value = profile.username || "";
      if (form.elements.publicRanking) form.elements.publicRanking.checked = profile.publicRanking !== false;
    }
  }

  function saveProfileForm(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target).entries());
    game.saveProfile({
      name:String(data.name || "").trim(),
      phone:String(data.phone || "").trim(),
      username:String(data.username || "").trim(),
      publicRanking:Boolean(event.target.elements.publicRanking?.checked)
    });
    toast("Профиль сохранён");
    renderProfile();
    renderRanking();
    window.BaliCompactProfile?.mount?.();
  }

  async function uploadAvatar(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const avatar = await resizeImage(file);
      game.saveProfile({ avatar });
      window.BaliBeta4Social?.saveProfile?.({ photo:avatar });
      toast("Аватар обновлён");
      renderProfile();
      renderRanking();
    } catch (error) {
      capture(error, "avatar-upload");
      toast("Не удалось загрузить изображение");
    } finally {
      event.target.value = "";
    }
  }

  function resizeImage(file) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(file);
      image.onload = () => {
        const size = 500;
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        const context = canvas.getContext("2d");
        const scale = Math.max(size / image.width, size / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", .84));
      };
      image.onerror = error => {
        URL.revokeObjectURL(url);
        reject(error);
      };
      image.src = url;
    });
  }

  function rsvps() { return read("bali_event_rsvps_v1", {}); }
  function mine(eventId) { return rsvps()?.[eventId]?.[game.profile().id] || null; }

  async function socialCounts(eventId) {
    const all = Object.values(rsvps()?.[eventId] || {});
    const bookings = await safeAsync("social-bookings", () => store.list("bookings"), []);
    const activeBookings = (bookings || []).filter(item => item.event_id === eventId && !["cancelled", "completed"].includes(item.status));
    return {
      interested:all.filter(item => item.status === "interested").length,
      going:all.filter(item => item.status === "going").length,
      bookedGuests:activeBookings.reduce((sum, item) => sum + Number(item.guests || 0), 0)
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
    const key = game.profile().id;
    all[eventId] ||= {};
    const current = all[eventId][key]?.status;
    if (current === "booked") return toast("У вас уже есть бронь стола");
    if (current === status) delete all[eventId][key];
    else all[eventId][key] = {
      user_key:key,
      name:game.profile().name,
      status,
      attendance_mode:status === "going" ? "general_admission" : "interest",
      updated_at:new Date().toISOString()
    };
    write("bali_event_rsvps_v1", all);
    toast(current === status ? "Статус отменён" : status === "going" ? "Отмечено: приду без брони" : "Добавлено: хочу пойти");
    renderSocial();
  }

  async function availability(event) {
    const layouts = read("bali_event_layouts_v1", {});
    const layout = layouts[event.id];
    const bookings = await safeAsync("availability-bookings", () => store.list("bookings"), []);
    const activeBookings = (bookings || []).filter(item =>
      (item.event_id === event.id || (!item.event_id && item.booking_date === event.event_date))
      && !["cancelled", "completed"].includes(item.status)
    );
    if (layout?.tables?.length) {
      return layout.tables
        .filter(item => item.active !== false)
        .map(table => ({ ...table, available:!activeBookings.some(booking => String(booking.table_id) === String(table.id)) }));
    }
    return await safeAsync("availability", () => store.getAvailability(event.event_date), []);
  }

  async function openEvent(id) {
    const event = state.events.find(item => String(item.id) === String(id));
    if (!event) return;
    state.activeEvent = event;
    state.selectedTable = "";
    state.availability = await availability(event);

    const dialog = byId("eventDialog");
    const media = byId("eventDialogMedia");
    const form = byId("bookingForm");
    if (!dialog || !form) return toast("Не удалось открыть событие");

    if (media) media.style.backgroundImage = event.image_url ? `url("${String(event.image_url).replace(/"/g, "%22")}")` : "";
    if (byId("eventDialogDate")) byId("eventDialogDate").textContent = `${fmtDate(event.event_date)} · ${event.event_time || "23:00"}`;
    if (byId("eventDialogTitle")) byId("eventDialogTitle").textContent = event.title || "Событие BALI";
    if (byId("eventDialogDescription")) byId("eventDialogDescription").textContent = event.description || "Подробности будут добавлены позднее.";

    const privilege = game.eventPrivilege?.(event.id);
    const privilegeRoot = byId("eventPrivilege");
    if (privilegeRoot) {
      privilegeRoot.innerHTML = privilege
        ? `<div class="privilege"><strong>${esc(game.vip()?.plan?.name || "VIP")}</strong>: ${privilege.freeEntry ? "бесплатный вход" : `${Number(privilege.discount || 0)}% скидка`}, раннее бронирование ${Number(privilege.earlyBookingHours || 0)} ч.${Number(privilege.guestPasses || 0) ? `, гостевых проходов: ${Number(privilege.guestPasses)}` : ""}</div>`
        : "";
    }

    const profile = game.profile();
    form.elements.event_id.value = event.id;
    form.elements.booking_date.value = event.event_date || "";
    form.elements.booking_time.value = event.event_time || "23:00";
    form.elements.name.value = profile.name || "";
    form.elements.phone.value = profile.phone || "";
    form.elements.telegram.value = profile.username || "";

    renderTableChoices();
    await renderSocial();
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function renderTableChoices() {
    const root = byId("tableChoices");
    const form = byId("bookingForm");
    if (!root || !form) return;
    root.innerHTML = state.availability.length
      ? state.availability.map(table => `<button type="button" class="table ${String(state.selectedTable) === String(table.id) ? "selected" : ""}" data-table="${esc(table.id)}" ${table.available ? "" : "disabled"}><strong>${esc(table.name || table.id)}</strong><br>${Number(table.seats || 4)} мест<br>${table.available ? "свободен" : "занят"}</button>`).join("")
      : '<div class="empty">Схема столов ещё не настроена</div>';
    if (form.elements.table_id) form.elements.table_id.value = state.selectedTable;
  }

  async function submitBooking(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target).entries());
    if (!data.table_id) return toast("Выберите свободный стол");
    try {
      const chosen = state.availability.find(item => String(item.id) === String(data.table_id));
      const booking = await store.createBooking(data);
      const profile = game.profile();
      await store.save("bookings", {
        ...booking,
        event_id:data.event_id,
        owner_key:profile.id,
        telegram_id:profile.telegramId || null,
        telegram:profile.username || data.telegram,
        table_name:chosen?.name || data.table_id
      });
      game.saveProfile({ phone:data.phone, name:data.name, username:data.telegram || profile.username });
      game.recordBooking?.(data.guests);

      const all = rsvps();
      all[data.event_id] ||= {};
      all[data.event_id][profile.id] = {
        user_key:profile.id,
        name:data.name,
        status:"booked",
        attendance_mode:"table_booking",
        booking_id:booking.id,
        guests:Number(data.guests || 0),
        updated_at:new Date().toISOString()
      };
      write("bali_event_rsvps_v1", all);

      toast(`Бронь на ${chosen?.name || "стол"} создана`);
      byId("eventDialog")?.close?.();
      await loadData();
    } catch (error) {
      capture(error, "booking");
      toast(error?.message || "Не удалось создать бронь");
    }
  }

  async function buyVip(planId) {
    const plan = (game.config?.().plans || []).find(item => String(item.id) === String(planId));
    if (!plan) return;
    const endpoint = cfg.vipInvoiceEndpoint;
    if (endpoint && tg?.openInvoice) {
      try {
        const response = await fetch(endpoint, {
          method:"POST",
          headers:{ "Content-Type":"application/json" },
          body:JSON.stringify({ planId, initData:tg.initData })
        });
        const payload = await response.json();
        if (!payload.invoiceUrl) throw new Error("Счёт не создан");
        tg.openInvoice(payload.invoiceUrl, status => {
          if (status === "paid") {
            game.activateVip(planId, "telegram_stars");
            toast("VIP активирован");
            renderProfile();
          }
        });
        return;
      } catch (error) {
        capture(error, "vip-invoice");
        toast(error?.message || "Не удалось открыть оплату");
        return;
      }
    }
    toast("Оплата VIP пока не подключена");
  }

  function shareApp() {
    const url = `${cfg.miniAppUrl || location.origin + location.pathname}?v=${encodeURIComponent(document.documentElement.dataset.baliBuild || "production")}`;
    const text = "BALI Minsk — события, бронирование и BALI PEOPLE";
    game.recordShare?.();
    if (navigator.share) navigator.share({ title:"BALI Minsk", text, url }).catch(() => {});
    else navigator.clipboard?.writeText(url).then(() => toast("Ссылка скопирована")).catch(() => toast("Не удалось скопировать ссылку"));
  }

  function inviteFriend() {
    const telegramId = tg?.initDataUnsafe?.user?.id || game.profile()?.telegramId || "";
    const bot = String(cfg.telegramUsername || "BaliMinskAppBot").replace(/^@/, "");
    const start = telegramId ? `ref_${telegramId}` : "bali";
    const appLink = `https://t.me/${bot}?startapp=${encodeURIComponent(start)}`;
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(appLink)}&text=${encodeURIComponent("Присоединяйся к BALI Minsk 🌴")}`;
    if (tg?.openTelegramLink) tg.openTelegramLink(shareUrl);
    else window.open(shareUrl, "_blank", "noopener");
  }

  function finalizeLayout() {
    const home = byId("homeInner");
    if (home) {
      const nodes = [
        byId("homeHero"),
        byId("homeActions"),
        byId("homeEventsCard"),
        byId("homeAboutCard"),
        byId("baliReferralCard"),
        byId("eventQrHomeCard"),
        byId("clubLinks")
      ].filter(Boolean);
      const current = [...home.children].filter(node => nodes.includes(node));
      const same = current.length === nodes.length && current.every((node, index) => node === nodes[index]);
      if (!same) nodes.forEach(node => home.appendChild(node));
    }

    const eventsTitle = byId("homeEventsCard")?.querySelector(".card-head h3");
    if (eventsTitle && eventsTitle.textContent !== "Ближайшие события") eventsTitle.textContent = "Ближайшие события";
    const aboutTitle = byId("homeAboutCard")?.querySelector(".card-head h3");
    if (aboutTitle && aboutTitle.textContent !== "О клубе") aboutTitle.textContent = "О клубе";

    const nav = document.querySelector(".shell > nav.nav");
    if (nav) {
      const desired = ["home", "events", "menu", "dating", "profile"];
      const existing = [...nav.querySelectorAll(":scope > button[data-page]")];
      const valid = existing.length === desired.length && existing.every((button, index) => button.dataset.page === desired[index]);
      if (!valid) {
        const labels = {
          home:["⌂", "Главная"],
          events:["◫", "Афиши"],
          menu:["◇", "Меню"],
          dating:["🌴", "BALI PEOPLE"],
          profile:["◎", "Профиль"]
        };
        nav.replaceChildren(...desired.map(page => {
          const button = document.createElement("button");
          button.dataset.page = page;
          if (page === state.page) button.classList.add("active");
          button.innerHTML = `<i>${labels[page][0]}</i><span>${labels[page][1]}</span>`;
          return button;
        }));
      }
    }
  }

  let layoutQueued = false;
  function queueLayout() {
    if (layoutQueued) return;
    layoutQueued = true;
    requestAnimationFrame(() => {
      layoutQueued = false;
      finalizeLayout();
    });
  }

  try {
    tg?.ready?.();
    tg?.expand?.();
    tg?.setHeaderColor?.("#080a0a");
    tg?.setBackgroundColor?.("#080a0a");
  } catch {}

  mount();
  loadData();

  window.addEventListener("bali:data-changed", () => loadData());
  window.addEventListener("bali:points-changed", () => {
    safe("points-profile", renderProfile);
    safe("points-ranking", renderRanking);
    window.BaliCompactProfile?.mount?.();
  });
  window.addEventListener("bali:beta4-changed", () => {
    safe("game-profile", renderProfile);
    safe("game-ranking", renderRanking);
    window.BaliCompactProfile?.mount?.();
  });
  ["bali:checkin-complete", "bali:checkin-left", "bali:social-changed", "bali:production-ready"].forEach(name => window.addEventListener(name, queueLayout));

  window.BaliAppStable = {
    state,
    loadData,
    renderAll,
    renderProfile,
    renderRanking,
    openEvent,
    finalizeLayout,
    go
  };
})();