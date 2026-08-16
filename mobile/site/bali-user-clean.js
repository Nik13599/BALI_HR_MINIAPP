(() => {
  if (window.__BALI_CLEAN_USER_APP__) return;
  window.__BALI_CLEAN_USER_APP__ = true;

  const app = document.getElementById("app");
  const store = window.BaliStore;
  const points = window.BaliPoints;
  const game = window.BaliBeta4Game;
  if (!app || !store || !points || !game) {
    document.body.innerHTML = '<div style="padding:24px;color:white;font-family:system-ui">Не удалось запустить пользовательское приложение.</div>';
    return;
  }

  const state = {
    page: "home",
    events: [],
    menu: [],
    category: "Все",
    activeEvent: null,
    availability: [],
    selectedTable: ""
  };

  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  };
  const write = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent("bali:clean-data", { detail: { key } }));
    return value;
  };
  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);
  const fmtDate = value => value ? new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString("ru-RU", { day: "2-digit", month: "long" }) : "—";
  const fmtDateTime = value => value ? new Date(value).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
  const money = value => `${Number(value || 0).toLocaleString("ru-RU")} BYN`;
  const initials = name => String(name || "B").trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();

  function toast(message) {
    const node = document.getElementById("toast");
    if (!node) return;
    node.textContent = message;
    node.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove("show"), 2300);
  }

  function avatar(user, className = "") {
    return user.avatar
      ? `<img class="${esc(className)}" src="${esc(user.avatar)}" alt="${esc(user.name || "BALI")}">`
      : `<div class="${esc(className)}" style="display:grid;place-items:center;background:#1a211c;color:#c8ff3d;font:600 22px Unbounded;border-radius:50%">${esc(initials(user.name))}</div>`;
  }

  function mount() {
    app.innerHTML = `
      <div class="clean-shell">
        <header class="clean-top">
          <button class="clean-brand" type="button" data-page="home">
            <span class="clean-logo">B</span>
            <span><strong>BALI</strong><small>МИНСК · КИРОВА, 13</small></span>
          </button>
          <button class="clean-share" id="cleanShare" type="button" aria-label="Поделиться">↗</button>
        </header>

        <main class="clean-pages">
          <section class="clean-page active" data-screen="home"><div class="clean-inner">
            <article class="hero">
              <span class="eyebrow">NIGHT CLUB · CONTACT BAR · 18+</span>
              <h1>Твоя ночь<br><em>начинается здесь</em></h1>
              <p>События, музыка, бар, кальяны, знакомства, конкурсы и бронирование столов в одном приложении BALI.</p>
              <div class="pills"><span>Кирова, 13</span><span>ПТ–СБ · 23:00–06:00</span><span>5 минут от «Динамо»</span></div>
              <div class="hero-actions"><button class="primary" type="button" data-page="events">Смотреть афиши</button><button class="secondary" type="button" data-page="profile">Мой профиль</button></div>
            </article>
            <section class="clean-card"><div class="card-title"><h3>Ближайшие события</h3><button type="button" data-page="events">Все афиши</button></div><div class="event-list" id="cleanHomeEvents"></div></section>
            <section class="clean-card"><div class="card-title"><h3>О клубе</h3></div><p style="color:var(--muted);font-size:10px;line-height:1.65">Большие экраны, танцпол, контактный бар, кальяны и комфортная рассадка. После мероприятий ночь продолжается в клубном формате BALI.</p></section>
          </div></section>

          <section class="clean-page" data-screen="events"><div class="clean-inner"><div class="clean-head"><div><span class="eyebrow">БЛИЖАЙШИЕ ДАТЫ</span><h2>Афиши</h2></div><span class="count" id="cleanEventsCount"></span></div><div class="events-grid" id="cleanEventsGrid"></div></div></section>

          <section class="clean-page" data-screen="menu"><div class="clean-inner"><div class="clean-head"><div><span class="eyebrow">БАР · КУХНЯ · КАЛЬЯНЫ</span><h2>Меню</h2></div><span class="count" id="cleanMenuCount"></span></div><div class="tabs" id="cleanMenuTabs"></div><div class="menu-list" id="cleanMenuList"></div></div></section>

          <section class="clean-page" data-screen="people"><div class="clean-inner"><div class="clean-head"><div><span class="eyebrow">BALI PEOPLE</span><h2>Люди BALI</h2></div><span class="count">18+</span></div><div class="people-grid" id="cleanPeopleGrid"></div></div></section>

          <section class="clean-page" data-screen="crown"><div class="clean-inner"><div class="clean-head"><div><span class="eyebrow">КОНКУРС ЭТОЙ НОЧИ</span><h2>Король и Королева</h2></div><span class="count">👑</span></div><section class="clean-card" id="cleanCrownIntro"></section><div class="crown-columns" id="cleanCrownColumns"></div></div></section>

          <section class="clean-page" data-screen="profile"><div class="clean-inner"><div class="clean-head"><div><span class="eyebrow">ЛИЧНЫЙ КАБИНЕТ</span><h2>Профиль</h2></div></div><div id="cleanProfile"></div></div></section>
        </main>

        <nav class="clean-nav" aria-label="Основная навигация">
          <button class="active" type="button" data-page="home"><i>⌂</i><span>Главная</span></button>
          <button type="button" data-page="events"><i>◫</i><span>Афиши</span></button>
          <button type="button" data-page="menu"><i>◇</i><span>Меню</span></button>
          <button type="button" data-page="people"><i>🌴</i><span>BALI PEOPLE</span></button>
          <button type="button" data-page="crown"><i>👑</i><span>Конкурс</span></button>
          <button type="button" data-page="profile"><i>◎</i><span>Профиль</span></button>
        </nav>
      </div>

      <dialog class="clean-dialog" id="cleanEventDialog">
        <div class="dialog-sheet">
          <div class="dialog-media"><img id="cleanEventImage" alt=""><button class="dialog-close" type="button" data-close-dialog>×</button></div>
          <div class="dialog-body">
            <span class="eyebrow" id="cleanEventDate"></span>
            <h2 id="cleanEventTitle"></h2>
            <p class="dialog-description" id="cleanEventDescription"></p>
            <section class="interest-box">
              <div class="interest-count"><strong id="cleanInterestedCount">0</strong><span>ХОТЯТ ПОЙТИ</span></div>
              <button class="secondary interest-toggle" id="cleanInterestToggle" type="button">Хочу пойти</button>
            </section>
            <section class="clean-card"><div class="card-title"><h3>Бронирование стола</h3></div>
              <form class="booking-form" id="cleanBookingForm">
                <input type="hidden" name="event_id"><input type="hidden" name="booking_date"><input type="hidden" name="table_id">
                <label><span>Выберите стол</span><div class="tables" id="cleanTableChoices"></div></label>
                <div class="booking-row"><label><span>Время</span><input type="time" name="booking_time" value="23:00" required></label><label><span>Гостей</span><select name="guests"><option>2</option><option>3</option><option selected>4</option><option>5</option><option>6</option><option value="8">8+</option></select></label></div>
                <label><span>Имя</span><input name="name" required></label>
                <label><span>Телефон</span><input name="phone" inputmode="tel" required></label>
                <label><span>Telegram</span><input name="telegram"></label>
                <label><span>Комментарий</span><textarea name="comment"></textarea></label>
                <button class="primary full" type="submit">Забронировать стол</button>
              </form>
            </section>
          </div>
        </div>
      </dialog>`;
  }

  function go(page) {
    if (!document.querySelector(`[data-screen="${page}"]`)) return;
    state.page = page;
    document.querySelectorAll(".clean-page[data-screen]").forEach(node => node.classList.toggle("active", node.dataset.screen === page));
    document.querySelectorAll(".clean-nav button[data-page]").forEach(button => button.classList.toggle("active", button.dataset.page === page));
    const screen = document.querySelector(`[data-screen="${page}"]`);
    if (screen) screen.scrollTop = 0;
    if (page === "people") renderPeople();
    if (page === "crown") renderCrown();
    if (page === "profile") renderProfile();
  }

  function eventMedia(event) {
    return event.image_url ? `<img src="${esc(event.image_url)}" alt="${esc(event.title)}">` : `<div style="display:grid;place-items:center;aspect-ratio:4/5;background:#1a201d;color:#c8ff3d;font:600 20px Unbounded">BALI</div>`;
  }

  function renderHome() {
    const root = document.getElementById("cleanHomeEvents");
    root.innerHTML = state.events.slice(0, 3).map(event => `<article class="home-event">${eventMedia(event)}<div><h3>${esc(event.title)}</h3><p>${fmtDate(event.event_date)} · ${esc(event.event_time || "23:00")}</p></div><button type="button" data-open-event="${esc(event.id)}">＋</button></article>`).join("") || '<div class="empty">События скоро появятся</div>';
  }

  function renderEvents() {
    document.getElementById("cleanEventsCount").textContent = `${state.events.length} событий`;
    document.getElementById("cleanEventsGrid").innerHTML = state.events.map(event => `<button class="event-card" type="button" data-open-event="${esc(event.id)}">${eventMedia(event)}<span class="event-card-body"><small>${fmtDate(event.event_date)} · ${esc(event.event_time || "23:00")}</small><h3>${esc(event.title)}</h3><p>${esc(event.description || "Подробности мероприятия")}</p></span></button>`).join("") || '<div class="empty">Афиш пока нет</div>';
  }

  function renderMenu() {
    const categories = ["Все", ...new Set(state.menu.map(item => item.category || "Другое"))];
    document.getElementById("cleanMenuTabs").innerHTML = categories.map(category => `<button type="button" class="${category === state.category ? "active" : ""}" data-category="${esc(category)}">${esc(category)}</button>`).join("");
    const rows = state.category === "Все" ? state.menu : state.menu.filter(item => (item.category || "Другое") === state.category);
    document.getElementById("cleanMenuCount").textContent = `${rows.length} позиций`;
    document.getElementById("cleanMenuList").innerHTML = rows.map(item => `<article class="menu-item"><div><h3>${esc(item.name)}</h3><p>${esc(item.description || "")}</p></div><strong>${money(item.price)}</strong></article>`).join("") || '<div class="empty">В этой категории пока нет позиций</div>';
  }

  function renderPeople() {
    const me = game.profile();
    const rows = read("bali_social_people_v1", []).filter(person => person.active !== false && String(person.id) !== String(me.id));
    const statusNames = { party: "Ищу компанию", table: "Приглашу за столик", chat: "Открыт(а) к общению", closed: "Не знакомлюсь" };
    document.getElementById("cleanPeopleGrid").innerHTML = rows.map(person => `<article class="person-card"><div class="person-photo">${person.photo ? `<img src="${esc(person.photo)}" alt="${esc(person.name)}">` : `<div style="height:100%;display:grid;place-items:center;color:#c8ff3d;font:600 34px Unbounded">${esc(initials(person.name))}</div>`}</div><div class="person-body"><h3>${esc(person.name)}</h3><p>${esc(person.bio || "Гость BALI")}</p><span class="person-status">${esc(statusNames[person.status] || "Открыт(а) к общению")}</span></div></article>`).join("") || '<div class="empty">Анкеты пока не опубликованы</div>';
  }

  function renderCrown() {
    const events = state.events.filter(event => event.night_crown_enabled === true || event.night_crown_enabled === "true");
    const event = events.find(item => item.event_date === new Date().toISOString().slice(0, 10)) || events[0];
    const intro = document.getElementById("cleanCrownIntro");
    const columns = document.getElementById("cleanCrownColumns");
    if (!event) {
      intro.innerHTML = '<div class="card-title"><h3>Конкурс пока не активирован</h3></div><p style="color:var(--muted);font-size:9px;line-height:1.6">Раздел становится активным во время выбранного мероприятия.</p>';
      columns.innerHTML = "";
      return;
    }
    intro.innerHTML = `<div class="card-title"><h3>${esc(event.title)}</h3><span class="count">${fmtDate(event.event_date)}</span></div><p style="color:var(--muted);font-size:9px;line-height:1.6">Гости голосуют за одобренных участников. Список отсортирован по количеству голосов.</p>`;
    const entries = read("bali_night_crown_entries_v1", []).filter(entry => entry.event_id === event.id && entry.status === "approved");
    const votes = read("bali_night_crown_votes_v1", []).filter(vote => vote.event_id === event.id);
    const build = (gender, title) => {
      const rows = entries.filter(entry => entry.gender === gender).map(entry => ({ ...entry, votes: votes.filter(vote => String(vote.candidate_key) === String(entry.user_key)).length })).sort((a, b) => b.votes - a.votes);
      return `<section><div class="card-title"><h3>${title}</h3><span class="count">${rows.length}</span></div><div class="crown-list">${rows.map((entry, index) => `<article class="crown-person"><b>#${index + 1}</b>${entry.photo_url ? `<img src="${esc(entry.photo_url)}" alt="${esc(entry.name)}">` : `<div style="width:48px;height:58px;display:grid;place-items:center;background:#1a201d;border-radius:11px">${esc(initials(entry.name))}</div>`}<div><h4>${esc(entry.name)}</h4><p>${esc(entry.username || "")}</p></div><b>${entry.votes} 👑</b></article>`).join("") || '<div class="empty">Участников пока нет</div>'}</div></section>`;
    };
    columns.innerHTML = build("female", "Королева ночи") + build("male", "Король ночи");
  }

  function currentBalance() {
    const profile = points.profile();
    const account = points.accounts()?.[profile.userKey];
    return Number(account?.balance ?? profile.balance ?? 0);
  }

  function renderProfile() {
    const profile = game.profile();
    const level = game.levelFor(profile.xp);
    const vip = game.vip();
    const ledger = (points.ledger() || []).filter(row => !row.userKey || String(row.userKey) === String(points.profile().userKey)).slice(0, 12);
    const bookings = read("bali_bookings_v2", []).filter(row => String(row.owner_key || "") === String(profile.id) || String(row.phone || "").replace(/\D/g, "") === String(profile.phone || "").replace(/\D/g, "")).sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || ""))).slice(0, 5);
    document.getElementById("cleanProfile").innerHTML = `
      <div class="clean-inner">
        <section class="profile-hero">${avatar(profile)}<div><h2>${esc(profile.name)}</h2><p>${esc(profile.username || "Telegram не указан")}</p><div class="badges"><span>${esc(level.current.name)}</span>${vip ? `<span class="vip">${esc(vip.plan.name)}</span>` : ""}</div></div></section>
        <div class="profile-stats"><article><strong>${currentBalance()}</strong><span>BALI-БАЛЛЫ</span></article><article><strong>${Number(profile.visits || 0)}</strong><span>ПОСЕЩЕНИЯ</span></article><article><strong>${Number(profile.bookings || 0)}</strong><span>БРОНИ</span></article></div>
        <section class="clean-card"><div class="card-title"><h3>Настройки профиля</h3></div><form class="profile-form" id="cleanProfileForm"><label><span>Имя</span><input name="name" value="${esc(profile.name || "")}" required></label><label><span>Телефон</span><input name="phone" inputmode="tel" value="${esc(profile.phone || "")}"></label><label><span>Telegram</span><input name="username" value="${esc(profile.username || "")}"></label><button class="primary full" type="submit">Сохранить профиль</button></form></section>
        <section class="clean-card"><div class="card-title"><h3>Последние бронирования</h3></div><div class="profile-list">${bookings.map(row => `<article class="menu-item"><div><h3>${esc(row.table_name || row.table_id || "Стол")}</h3><p>${fmtDate(row.booking_date)} · ${esc(row.booking_time || "23:00")} · ${Number(row.guests || 0)} гостей</p></div><strong>${esc(row.status || "pending")}</strong></article>`).join("") || '<div class="empty">Бронирований пока нет</div>'}</div></section>
        <section class="clean-card"><div class="card-title"><h3>История баллов</h3></div><div class="profile-list">${ledger.map(row => `<article class="menu-item"><div><h3>${esc(row.title || "Операция BALI")}</h3><p>${fmtDateTime(row.createdAt || row.created_at)}</p></div><strong>${Number(row.amount || 0) > 0 ? "+" : ""}${Number(row.amount || 0)}</strong></article>`).join("") || '<div class="empty">Операций пока нет</div>'}</div></section>
      </div>`;
  }

  function rsvps() { return read("bali_event_rsvps_v1", {}); }
  function userKey() { return String(game.profile().id || points.profile().userKey || "guest"); }
  function interestedCount(eventId) {
    return Object.values(rsvps()?.[eventId] || {}).filter(row => row.status === "interested").length;
  }
  function isInterested(eventId) {
    return rsvps()?.[eventId]?.[userKey()]?.status === "interested";
  }
  function renderInterest() {
    if (!state.activeEvent) return;
    document.getElementById("cleanInterestedCount").textContent = interestedCount(state.activeEvent.id);
    const button = document.getElementById("cleanInterestToggle");
    const active = isInterested(state.activeEvent.id);
    button.classList.toggle("active", active);
    button.textContent = active ? "Отменить" : "Хочу пойти";
  }
  function toggleInterest() {
    if (!state.activeEvent) return;
    const all = rsvps();
    const eventId = state.activeEvent.id;
    const key = userKey();
    all[eventId] ||= {};
    if (all[eventId][key]?.status === "interested") delete all[eventId][key];
    else all[eventId][key] = { user_key: key, name: game.profile().name, status: "interested", attendance_mode: "interest", updated_at: new Date().toISOString() };
    write("bali_event_rsvps_v1", all);
    renderInterest();
    toast(all[eventId][key] ? "Добавлено: хочу пойти" : "Статус отменён");
  }

  async function getAvailability(event) {
    const bookings = (await store.list("bookings")).filter(row => (row.event_id === event.id || (!row.event_id && row.booking_date === event.event_date)) && !["cancelled", "completed"].includes(row.status));
    const tables = await store.list("hall_tables");
    return tables.filter(table => table.active !== false).map(table => ({ ...table, available: !bookings.some(booking => booking.table_id === table.id) }));
  }

  function renderTableChoices() {
    const root = document.getElementById("cleanTableChoices");
    root.innerHTML = state.availability.map(table => `<button class="table-option ${state.selectedTable === table.id ? "selected" : ""}" type="button" data-table="${esc(table.id)}" ${table.available ? "" : "disabled"}><strong>${esc(table.name || table.id)}</strong><br>${Number(table.seats || 4)} мест<br>${table.available ? "свободен" : "занят"}</button>`).join("") || '<div class="empty">Столы пока не настроены</div>';
    document.querySelector('#cleanBookingForm [name="table_id"]').value = state.selectedTable;
  }

  async function openEvent(id) {
    const event = state.events.find(item => String(item.id) === String(id));
    if (!event) return;
    state.activeEvent = event;
    state.selectedTable = "";
    state.availability = await getAvailability(event);
    document.getElementById("cleanEventImage").src = event.image_url || "";
    document.getElementById("cleanEventDate").textContent = `${fmtDate(event.event_date)} · ${event.event_time || "23:00"}`;
    document.getElementById("cleanEventTitle").textContent = event.title;
    document.getElementById("cleanEventDescription").textContent = event.description || "Подробности будут добавлены позднее.";
    const profile = game.profile();
    const form = document.getElementById("cleanBookingForm");
    form.event_id.value = event.id;
    form.booking_date.value = event.event_date;
    form.booking_time.value = event.event_time || "23:00";
    form.name.value = profile.name || "";
    form.phone.value = profile.phone || "";
    form.telegram.value = profile.username || "";
    renderInterest();
    renderTableChoices();
    document.getElementById("cleanEventDialog").showModal();
  }

  async function submitBooking(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    if (!data.table_id) return toast("Выберите свободный стол");
    try {
      const selected = state.availability.find(table => table.id === data.table_id);
      const booking = await store.createBooking(data);
      const profile = game.profile();
      await store.save("bookings", { ...booking, event_id: data.event_id, owner_key: profile.id, telegram_id: profile.telegramId || null, telegram: profile.username || data.telegram, table_name: selected?.name || data.table_id });
      game.saveProfile({ phone: data.phone, username: data.telegram });
      game.recordBooking(Number(data.guests || 0));
      toast("Бронирование отправлено");
      document.getElementById("cleanEventDialog").close();
      renderProfile();
    } catch (error) {
      toast(error?.message || "Не удалось создать бронирование");
    }
  }

  function shareApp() {
    const url = location.href;
    const text = "BALI Minsk — афиши, бронирование и клубные события";
    if (navigator.share) navigator.share({ title: "BALI Minsk", text, url }).catch(() => {});
    else navigator.clipboard?.writeText(url).then(() => toast("Ссылка скопирована")).catch(() => toast("Скопируйте ссылку из адресной строки"));
  }

  function bind() {
    document.querySelector(".clean-nav").addEventListener("click", event => {
      const button = event.target.closest("button[data-page]");
      if (button) go(button.dataset.page);
    });
    document.addEventListener("click", event => {
      const page = event.target.closest("[data-page]");
      if (page && !page.closest(".clean-nav")) return go(page.dataset.page);
      const eventButton = event.target.closest("[data-open-event]");
      if (eventButton) return openEvent(eventButton.dataset.openEvent);
      const category = event.target.closest("[data-category]");
      if (category) { state.category = category.dataset.category; return renderMenu(); }
      const table = event.target.closest("[data-table]");
      if (table && !table.disabled) { state.selectedTable = table.dataset.table; return renderTableChoices(); }
      if (event.target.closest("[data-close-dialog]")) return document.getElementById("cleanEventDialog").close();
    });
    document.getElementById("cleanInterestToggle").addEventListener("click", toggleInterest);
    document.getElementById("cleanBookingForm").addEventListener("submit", event => { event.preventDefault(); submitBooking(event.currentTarget); });
    document.getElementById("cleanShare").addEventListener("click", shareApp);
    document.addEventListener("submit", event => {
      if (event.target.id !== "cleanProfileForm") return;
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.target).entries());
      game.saveProfile({ name: String(data.name || "").trim(), phone: String(data.phone || "").trim(), username: String(data.username || "").trim() });
      toast("Профиль сохранён");
      renderProfile();
    });
  }

  async function load() {
    [state.events, state.menu] = await Promise.all([store.list("events", { order: "event_date" }), store.list("menu_items", { order: "sort_order" })]);
    state.events = state.events.filter(event => event.active !== false).sort((a, b) => `${a.event_date}T${a.event_time || "23:59"}`.localeCompare(`${b.event_date}T${b.event_time || "23:59"}`));
    state.menu = state.menu.filter(item => item.active !== false);
    renderHome();
    renderEvents();
    renderMenu();
    renderPeople();
    renderCrown();
    renderProfile();
  }

  mount();
  bind();
  load().catch(error => {
    console.error(error);
    toast("Не удалось загрузить данные приложения");
  });
})();
