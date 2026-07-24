(() => {
  'use strict';

  const cfg = window.BALI_CONFIG || {};
  const store = window.BaliStore;
  const client = store?.client || null;
  const tg = window.Telegram?.WebApp || null;
  const app = document.getElementById('app');
  if (!app || !store) return;

  const state = {
    page: 'home',
    peopleTab: 'all',
    events: [],
    menu: [],
    people: [],
    checkins: [],
    rewards: [],
    gifts: [],
    myRewards: [],
    myGifts: [],
    activeEvent: null,
    availability: [],
    loading: false
  };

  const user = (() => {
    const raw = tg?.initDataUnsafe?.user || {};
    let fallback = localStorage.getItem('bali_rebuild_guest_id');
    if (!fallback) {
      fallback = crypto.randomUUID?.() || `guest-${Date.now()}`;
      localStorage.setItem('bali_rebuild_guest_id', fallback);
    }
    const telegramId = raw.id ? Number(raw.id) : null;
    const name = [raw.first_name, raw.last_name].filter(Boolean).join(' ').trim() || 'Гость BALI';
    return {
      user_key: telegramId ? `tg:${telegramId}` : `guest:${fallback}`,
      telegram_id: telegramId,
      name,
      username: raw.username ? `@${raw.username}` : '',
      avatar: raw.photo_url || ''
    };
  })();

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value = '') => String(value).replace(/[&<>'"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[ch]));
  const fmtDate = value => value ? new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString('ru-RU', { day:'2-digit', month:'long' }) : 'Дата уточняется';
  const initials = name => String(name || 'B').trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  const toast = message => {
    const node = $('#toast');
    if (!node) return;
    node.textContent = String(message || '');
    node.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove('show'), 2600);
  };

  function openExternal(url, mode = 'external') {
    if (!url) return;
    try {
      if (mode === 'telegram' && tg?.openTelegramLink) {
        tg.openTelegramLink(url);
        return;
      }
      if (mode === 'external' && tg?.openLink) {
        tg.openLink(url, { try_instant_view:false });
        return;
      }
    } catch (error) {
      console.warn('[BALI link]', error);
    }
    window.location.assign(url);
  }

  function callPhone(phone) {
    const value = String(phone || cfg.venuePhone || '+375296700300').replace(/[^+\d]/g, '');
    window.location.href = `tel:${value}`;
  }

  async function safeList(table, options = {}) {
    try { return await store.list(table, options); }
    catch (error) {
      console.warn(`[BALI ${table}]`, error);
      return store.readCache?.(table) || [];
    }
  }

  async function registerUser() {
    const endpoint = cfg.telegramAuthEndpoint;
    if (endpoint && tg?.initData && cfg.supabaseAnonKey) {
      try {
        await fetch(endpoint, {
          method:'POST',
          headers:{ 'Content-Type':'application/json', apikey:cfg.supabaseAnonKey, Authorization:`Bearer ${cfg.supabaseAnonKey}` },
          body:JSON.stringify({ action:'update_profile', init_data:tg.initData, profile:{ name:user.name } })
        });
        return;
      } catch (error) {
        console.warn('[BALI register edge]', error);
      }
    }
    const rows = store.readCache?.('app_users') || [];
    const next = rows.filter(row => String(row.user_key) !== user.user_key);
    next.unshift({ ...user, active:true, last_seen_at:new Date().toISOString() });
    store.writeCache?.('app_users', next);
  }

  function avatar(person, className = 'avatar') {
    return `<span class="${className}">${person.avatar ? `<img src="${esc(person.avatar)}" alt="">` : esc(initials(person.name))}</span>`;
  }

  function mount() {
    app.innerHTML = `
      <div class="bali-app">
        <header class="bali-topbar">
          <button type="button" class="bali-brand" data-page="home"><b>B</b><span><strong>BALI</strong><small>МИНСК · NIGHT CLUB</small></span></button>
          <button type="button" class="bali-icon-button" data-action="share" aria-label="Поделиться">↗</button>
        </header>
        <main class="bali-pages">
          <section class="bali-page active" data-screen="home">
            <div class="bali-container">
              <article class="bali-hero"><span>МИНСК · КИРОВА, 13</span><h1>Твоя ночь<br><em>начинается здесь</em></h1><p>Афиши, бронирование, BALI People, награды и подарки — в одном приложении.</p><div class="bali-pills"><i>ПТ–СБ</i><i>23:00–06:00</i><i>Вход свободный</i></div></article>
              <div class="bali-actions"><button class="primary" data-page="events">Смотреть афиши</button><button data-page="profile">Мой профиль</button></div>
              <section class="bali-card"><div class="bali-card-head"><h2>Ближайшие события</h2><button data-page="events">Все афиши</button></div><div id="homeEvents" class="bali-list"></div></section>
              <section class="bali-card"><div class="bali-card-head"><h2>О клубе</h2></div><p>BALI — ночной клуб в центре Минска: танцпол, контактный бар, кальяны, большие экраны и комфортные столы.</p></section>
              <section class="bali-card"><div class="bali-card-head"><h2>Связаться с BALI</h2></div><div class="bali-link-grid">
                <button data-link="instagram">Instagram<small>@baliminsk</small></button>
                <button data-link="manager">Связаться с менеджером<small>Telegram</small></button>
                <button data-link="phone">Позвонить<small>${esc(cfg.venuePhone || '+375 29 670-03-00')}</small></button>
                <button data-link="map">Как добраться<small>Яндекс Карты</small></button>
              </div></section>
            </div>
          </section>
          <section class="bali-page" data-screen="events"><div class="bali-container"><div class="bali-page-head"><span>АФИШИ</span><h2>События BALI</h2></div><div id="eventsList" class="bali-event-grid"></div></div></section>
          <section class="bali-page" data-screen="menu"><div class="bali-container"><div class="bali-page-head"><span>БАР · КУХНЯ · КАЛЬЯНЫ</span><h2>Меню</h2></div><div id="menuList" class="bali-list"></div></div></section>
          <section class="bali-page" data-screen="people"><div class="bali-container"><div class="bali-page-head"><span>BALI PEOPLE · 18+</span><h2>Люди BALI</h2></div><div class="bali-tabs"><button class="active" data-people-tab="all">Все</button><button data-people-tab="inside">На мероприятии</button></div><div id="peopleList" class="bali-people-grid"></div></div></section>
          <section class="bali-page" data-screen="profile"><div class="bali-container"><div class="bali-page-head"><span>ЛИЧНЫЙ КАБИНЕТ</span><h2>Мой профиль</h2></div><div id="profileContent"></div></div></section>
        </main>
        <nav class="bali-nav">
          <button class="active" data-page="home"><i>⌂</i><span>Главная</span></button>
          <button data-page="events"><i>◫</i><span>Афиши</span></button>
          <button data-page="menu"><i>◇</i><span>Меню</span></button>
          <button data-page="people"><i>🌴</i><span>People</span></button>
          <button data-page="profile"><i>◎</i><span>Профиль</span></button>
        </nav>
      </div>
      <dialog id="eventDialog" class="bali-dialog"><div class="bali-sheet"><button class="bali-close" data-action="close-dialog">×</button><div id="eventDialogContent"></div></div></dialog>
    `;
    bind();
  }

  function bind() {
    document.addEventListener('click', async event => {
      const pageButton = event.target.closest('[data-page]');
      if (pageButton) return go(pageButton.dataset.page);

      const linkButton = event.target.closest('[data-link]');
      if (linkButton) {
        const type = linkButton.dataset.link;
        if (type === 'instagram') openExternal(cfg.instagramUrl || 'https://www.instagram.com/baliminsk/');
        if (type === 'manager') openExternal(cfg.managerTelegramUrl || 'https://t.me/BaliMinskAppBot', 'telegram');
        if (type === 'phone') callPhone(cfg.venuePhone);
        if (type === 'map') openExternal(cfg.yandexMapUrl || 'https://yandex.by/maps/');
        return;
      }

      const eventCard = event.target.closest('[data-event-id]');
      if (eventCard) return openEvent(eventCard.dataset.eventId);

      const peopleTab = event.target.closest('[data-people-tab]');
      if (peopleTab) {
        state.peopleTab = peopleTab.dataset.peopleTab;
        $$('.bali-tabs button').forEach(button => button.classList.toggle('active', button === peopleTab));
        renderPeople();
        return;
      }

      const action = event.target.closest('[data-action]')?.dataset.action;
      if (action === 'close-dialog') $('#eventDialog')?.close();
      if (action === 'share') shareApp();
      if (action === 'book') showBookingForm();
      if (action === 'scan-qr') scanQr();
    });

    document.addEventListener('submit', async event => {
      if (event.target.id !== 'bookingForm') return;
      event.preventDefault();
      await submitBooking(event.target);
    });
  }

  function go(page) {
    state.page = page;
    $$('.bali-page').forEach(node => node.classList.toggle('active', node.dataset.screen === page));
    $$('.bali-nav [data-page]').forEach(node => node.classList.toggle('active', node.dataset.page === page));
    window.scrollTo({ top:0, behavior:'instant' });
    if (page === 'people') refreshPeople();
    if (page === 'profile') refreshProfile();
    try { tg?.HapticFeedback?.selectionChanged?.(); } catch {}
  }

  function renderEvents() {
    const cards = state.events.map(item => `
      <article class="bali-event" data-event-id="${esc(item.id)}">
        <div class="bali-event-media">${item.image_url ? `<img src="${esc(item.image_url)}" alt="">` : '<b>BALI</b>'}</div>
        <div><small>${fmtDate(item.event_date)} · ${esc(item.event_time || '23:00')}</small><h3>${esc(item.title || 'Событие BALI')}</h3><p>${esc(item.description || '')}</p></div>
      </article>`).join('');
    $('#eventsList').innerHTML = cards || '<div class="bali-empty">Афиши скоро появятся</div>';
    $('#homeEvents').innerHTML = state.events.slice(0, 3).map(item => `<button class="bali-row" data-event-id="${esc(item.id)}"><span><b>${esc(item.title || 'Событие BALI')}</b><small>${fmtDate(item.event_date)} · ${esc(item.event_time || '23:00')}</small></span><i>＋</i></button>`).join('') || '<div class="bali-empty">Ближайшие события скоро появятся</div>';
  }

  function renderMenu() {
    $('#menuList').innerHTML = state.menu.map(item => `<article class="bali-menu-row"><span><b>${esc(item.name || 'Позиция')}</b><small>${esc(item.description || item.category || '')}</small></span><strong>${Number(item.price || 0).toLocaleString('ru-RU')} BYN</strong></article>`).join('') || '<div class="bali-empty">Меню пока не заполнено</div>';
  }

  function normalizePerson(row = {}) {
    const telegramId = row.telegram_id || row.telegramId || null;
    return {
      user_key: String(row.user_key || row.userKey || (telegramId ? `tg:${telegramId}` : row.id ? `customer:${row.id}` : '')),
      telegram_id: telegramId,
      name: row.name || row.user_name || row.customer_name || 'Гость BALI',
      username: row.username || row.telegram || '',
      avatar: row.avatar || row.photo || '',
      inside: false,
      event_title: ''
    };
  }

  function renderPeople() {
    const insideKeys = new Map(state.checkins.filter(row => row.presence_status === 'inside' && !row.left_at).map(row => [String(row.user_key || (row.telegram_id ? `tg:${row.telegram_id}` : '')), row]));
    const rows = state.people.map(person => {
      const checkin = insideKeys.get(person.user_key) || state.checkins.find(row => person.telegram_id && Number(row.telegram_id) === Number(person.telegram_id) && row.presence_status === 'inside' && !row.left_at);
      return { ...person, inside:Boolean(checkin), event_title:checkin?.event_title || '' };
    }).filter(person => state.peopleTab === 'all' || person.inside);

    $('#peopleList').innerHTML = rows.map(person => `<article class="bali-person">${avatar(person)}<div><h3>${esc(person.name)}</h3><p>${esc(person.username || 'Пользователь BALI')}</p>${person.inside ? `<span>НА МЕРОПРИЯТИИ${person.event_title ? ` · ${esc(person.event_title)}` : ''}</span>` : ''}${person.user_key === user.user_key ? '<em>ЭТО ВЫ</em>' : ''}</div></article>`).join('') || `<div class="bali-empty">${state.peopleTab === 'inside' ? 'Сейчас никто не отмечен на мероприятии' : 'Пользователи ещё не загрузились'}</div>`;
  }

  function renderProfile() {
    const rewardCards = state.rewards.map(item => `<article class="bali-catalog-card"><b>${esc(item.icon || '🏆')}</b><div><h3>${esc(item.title)}</h3><p>${esc(item.description || '')}</p><strong>${Number(item.points_cost || 0)} баллов</strong></div></article>`).join('');
    const giftCards = state.gifts.map(item => `<article class="bali-catalog-card"><b>${esc(item.icon || '🎁')}</b><div><h3>${esc(item.title)}</h3><p>${esc(item.description || '')}</p><strong>${Number(item.points_cost || 0)} баллов</strong></div></article>`).join('');
    $('#profileContent').innerHTML = `
      <section class="bali-profile-card">${avatar(user, 'avatar large')}<div><h3>${esc(user.name)}</h3><p>${esc(user.username || 'Telegram Mini App')}</p></div><button data-action="scan-qr">Сканировать QR</button></section>
      <section class="bali-card"><div class="bali-card-head"><h2>BALI Shop</h2></div><p>Каталог наград и подарков, доступных за BALI-Баллы.</p></section>
      <section class="bali-card"><div class="bali-card-head"><h2>Мои награды</h2></div><div class="bali-catalog">${rewardCards || '<div class="bali-empty">Награды пока не добавлены администратором</div>'}</div></section>
      <section class="bali-card"><div class="bali-card-head"><h2>Мои подарки</h2></div><div class="bali-catalog">${giftCards || '<div class="bali-empty">Подарки пока не добавлены администратором</div>'}</div></section>
    `;
  }

  async function refreshPeople() {
    const [appUsers, customers, checkins] = await Promise.all([
      safeList('app_users', { order:'last_seen_at', ascending:false }),
      safeList('customers'),
      safeList('event_checkins', { order:'checked_in_at', ascending:false })
    ]);
    const merged = [user, ...appUsers.map(normalizePerson), ...customers.map(normalizePerson)];
    state.people = [...new Map(merged.filter(person => person.user_key).map(person => [person.user_key, person])).values()];
    state.checkins = checkins;
    renderPeople();
  }

  async function refreshProfile() {
    const [rewards, gifts, rewardGrants, giftGrants] = await Promise.all([
      safeList('loyalty_rewards'), safeList('loyalty_gifts'), safeList('reward_grants'), safeList('gift_grants')
    ]);
    state.rewards = rewards.filter(item => item.active !== false);
    state.gifts = gifts.filter(item => item.active !== false);
    state.myRewards = rewardGrants.filter(item => String(item.user_key) === user.user_key);
    state.myGifts = giftGrants.filter(item => String(item.to_user_key) === user.user_key);
    renderProfile();
  }

  async function openEvent(id) {
    state.activeEvent = state.events.find(item => String(item.id) === String(id));
    if (!state.activeEvent) return;
    const item = state.activeEvent;
    $('#eventDialogContent').innerHTML = `
      <div class="bali-dialog-media">${item.image_url ? `<img src="${esc(item.image_url)}" alt="">` : '<b>BALI</b>'}</div>
      <span>${fmtDate(item.event_date)} · ${esc(item.event_time || '23:00')}</span><h2>${esc(item.title || 'Событие BALI')}</h2><p>${esc(item.description || '')}</p>
      <div class="bali-actions"><button class="primary" data-action="book">Забронировать стол</button><button data-action="share">Поделиться</button></div><div id="bookingArea"></div>`;
    $('#eventDialog').showModal();
  }

  async function showBookingForm() {
    if (!state.activeEvent) return;
    state.availability = await store.getAvailability(state.activeEvent.event_date).catch(() => []);
    const available = state.availability.filter(item => item.active !== false && item.available !== false);
    $('#bookingArea').innerHTML = `
      <form id="bookingForm" class="bali-form">
        <label>Стол<select name="table_id" required><option value="">Выберите стол</option>${available.map(table => `<option value="${esc(table.id)}">${esc(table.name || `Стол ${table.id}`)} · ${Number(table.seats || 4)} мест</option>`).join('')}</select></label>
        <div class="bali-form-row"><label>Время<input type="time" name="booking_time" value="23:00" required></label><label>Гостей<input type="number" name="guests" min="1" max="20" value="4" required></label></div>
        <label>Имя<input name="name" value="${esc(user.name)}" required></label><label>Телефон<input name="phone" inputmode="tel" required placeholder="+375 29 670-03-00"></label><label>Telegram<input name="telegram" value="${esc(user.username)}"></label><label>Комментарий<textarea name="comment"></textarea></label>
        <button class="primary" type="submit">Подтвердить бронь</button>
      </form>`;
  }

  async function submitBooking(form) {
    const data = Object.fromEntries(new FormData(form));
    const table = state.availability.find(item => String(item.id) === String(data.table_id));
    try {
      await store.createBooking({ ...data, event_id:state.activeEvent.id, booking_date:state.activeEvent.event_date, table_name:table?.name || '', status:'pending' });
      toast('Бронирование отправлено');
      $('#eventDialog')?.close();
    } catch (error) {
      toast(error.message || 'Не удалось создать бронь');
    }
  }

  function shareApp() {
    const url = cfg.miniAppUrl || location.href;
    const text = state.activeEvent ? `${state.activeEvent.title} в BALI` : 'BALI Minsk';
    try {
      if (tg?.openTelegramLink) {
        tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`);
        return;
      }
    } catch {}
    navigator.share?.({ title:text, url }).catch(() => navigator.clipboard?.writeText(url).then(() => toast('Ссылка скопирована')));
  }

  function parseQr(raw) {
    const value = String(raw || '').trim();
    try {
      const url = new URL(value);
      return { event_id:url.searchParams.get('event_id') || url.searchParams.get('event'), qr_token:url.searchParams.get('qr_token') || url.searchParams.get('token') };
    } catch {}
    const [event_id, qr_token] = value.replace(/^checkin_/, '').split(':');
    return { event_id, qr_token };
  }

  async function checkin(raw) {
    if (!tg?.initData || !cfg.supabaseUrl || !cfg.supabaseAnonKey) throw new Error('QR-вход доступен только внутри Telegram');
    const parsed = parseQr(raw);
    if (!parsed.event_id || !parsed.qr_token) throw new Error('Неверный QR-код мероприятия');
    const response = await fetch(`${String(cfg.supabaseUrl).replace(/\/$/, '')}/functions/v1/event-checkin-production`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', apikey:cfg.supabaseAnonKey, Authorization:`Bearer ${cfg.supabaseAnonKey}` },
      body:JSON.stringify({ action:'checkin', init_data:tg.initData, event_id:parsed.event_id, qr_token:parsed.qr_token })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.error) throw new Error(result.error || 'Не удалось подтвердить вход');
    return result;
  }

  function scanQr() {
    if (!tg?.showScanQrPopup) {
      toast('Сканер QR доступен внутри мобильного Telegram');
      return;
    }
    tg.showScanQrPopup({ text:'Отсканируйте QR мероприятия BALI' }, async raw => {
      tg.closeScanQrPopup();
      try {
        const result = await checkin(raw);
        toast(`Вход подтверждён${Number(result.points || 0) ? ` · +${Number(result.points)} баллов` : ''}`);
        await refreshPeople();
      } catch (error) { toast(error.message); }
      return true;
    });
  }

  async function load() {
    if (state.loading) return;
    state.loading = true;
    try {
      const [events, menu] = await Promise.all([safeList('events', { order:'event_date' }), safeList('menu_items', { order:'sort_order' })]);
      state.events = events.filter(item => item.active !== false).sort((a, b) => `${a.event_date || ''}${a.event_time || ''}`.localeCompare(`${b.event_date || ''}${b.event_time || ''}`));
      state.menu = menu.filter(item => item.active !== false);
      renderEvents();
      renderMenu();
      await Promise.all([refreshPeople(), refreshProfile()]);
    } finally { state.loading = false; }
  }

  try { tg?.ready?.(); tg?.expand?.(); tg?.setHeaderColor?.('#07100c'); tg?.setBackgroundColor?.('#07100c'); } catch {}
  mount();
  registerUser();
  load();
})();
