(() => {
  'use strict';

  const cfg = window.BALI_CONFIG || {};
  const store = window.BaliStore;
  const root = document.getElementById('adminRoot');
  if (!root || !store) return;

  const state = {
    view:'overview',
    editing:null,
    issuing:null,
    selectedConversation:null,
    conversations:[],
    messages:[],
    fallbackTables:new Set()
  };

  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
  const esc = (value = '') => String(value).replace(/[&<>'"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[ch]));
  const fmtDate = value => value ? new Date(value).toLocaleString('ru-RU', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
  const money = value => `${Number(value || 0).toLocaleString('ru-RU')} BYN`;
  const toast = message => {
    const node = $('#adminToast');
    if (!node) return;
    node.textContent = String(message || '');
    node.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove('show'), 2600);
  };

  window.addEventListener('bali:storage-fallback', event => {
    if (event.detail?.table) state.fallbackTables.add(event.detail.table);
  });

  async function safeList(table, options = {}) {
    try { return await store.list(table, options); }
    catch (error) {
      console.warn(`[ADMIN ${table}]`, error);
      return store.readCache?.(table) || [];
    }
  }

  function loginView() {
    root.innerHTML = `
      <main class="admin-login"><form id="adminLoginForm" class="admin-login-card"><div class="admin-logo">B</div><span>BALI CONTROL</span><h1>Панель управления</h1><p>Полное управление приложением BALI.</p><label>Логин<input name="login" autocomplete="username" required></label><label>Пароль<input name="password" type="password" autocomplete="current-password" required></label><button class="primary">Войти</button></form></main><div id="adminToast" class="admin-toast"></div>`;
    $('#adminLoginForm').addEventListener('submit', async event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      try {
        await store.signIn(form.get('login'), form.get('password'));
        mountApp();
      } catch (error) { toast(error.message || 'Не удалось войти'); }
    });
  }

  const navItems = [
    ['overview','▦','Обзор'],
    ['messages','✉','Сообщения'],
    ['bookings','◷','Брони'],
    ['events','◫','События'],
    ['customers','◎','Клиенты'],
    ['rules','⚡','Правила баллов'],
    ['rewards','🏆','Награды'],
    ['gifts','🎁','Подарки'],
    ['grants','★','Выдачи'],
    ['menu','◈','Меню'],
    ['hall','⌗','Схема зала'],
    ['reviews','✦','Отзывы'],
    ['settings','⚙','Настройки']
  ];

  function mountApp() {
    root.innerHTML = `
      <div class="admin-shell">
        <aside class="admin-sidebar"><div class="admin-brand"><b>B</b><span><strong>BALI</strong><small>CONTROL</small></span></div><nav id="adminNav">${navItems.map(([view,icon,label]) => `<button class="${view === state.view ? 'active' : ''}" data-view="${view}">${icon} <span>${label}</span></button>`).join('')}</nav><div class="admin-sidebar-foot"><a href="${esc(cfg.miniAppUrl || './index.html?v=bali-rebuild-4')}" target="_blank">Открыть приложение ↗</a><button data-action="logout">Выйти</button></div></aside>
        <main class="admin-workspace"><header class="admin-head"><div><span>BALI ADMIN</span><h1 id="adminTitle">Обзор</h1></div><button id="adminPrimary" class="primary">Добавить</button></header><section id="adminContent" class="admin-content"></section></main>
      </div>
      <dialog id="adminModal" class="admin-modal"><div class="admin-modal-sheet"><button type="button" class="admin-close" data-action="close-modal">×</button><div id="adminModalContent"></div></div></dialog>
      <div id="adminToast" class="admin-toast"></div>`;
    bind();
    render();
  }

  function bind() {
    $('#adminNav').addEventListener('click', event => {
      const button = event.target.closest('[data-view]');
      if (!button) return;
      state.view = button.dataset.view;
      $$('#adminNav button').forEach(item => item.classList.toggle('active', item === button));
      render();
    });

    document.addEventListener('click', async event => {
      const node = event.target.closest('[data-action]');
      if (!node) return;
      const action = node.dataset.action;
      if (action === 'logout') { await store.signOut(); location.reload(); }
      if (action === 'close-modal') $('#adminModal')?.close();
      if (action === 'edit') openEditor(node.dataset.table, node.dataset.id);
      if (action === 'delete') removeRow(node.dataset.table, node.dataset.id);
      if (action === 'issue') openIssue(node.dataset.kind, node.dataset.id);
      if (action === 'conversation') openConversation(node.dataset.id);
      if (action === 'refresh') render();
    });

    $('#adminPrimary').addEventListener('click', () => {
      const table = ({ bookings:'bookings', events:'events', customers:'customers', rules:'loyalty_rules', rewards:'loyalty_rewards', gifts:'loyalty_gifts', menu:'menu_items', hall:'hall_tables' })[state.view];
      if (table) openEditor(table);
      else if (state.view === 'settings') $('#settingsForm')?.requestSubmit();
    });

    document.addEventListener('submit', async event => {
      if (event.target.id === 'adminEditorForm') { event.preventDefault(); await saveEditor(event.target); }
      if (event.target.id === 'adminIssueForm') { event.preventDefault(); await saveIssue(event.target); }
      if (event.target.id === 'settingsForm') { event.preventDefault(); await saveSettings(event.target); }
      if (event.target.id === 'messageForm') { event.preventDefault(); await sendMessage(event.target); }
    });
  }

  const titles = Object.fromEntries(navItems.map(([view,,label]) => [view,label]));
  const primaryLabels = {
    bookings:'Новая бронь', events:'Добавить событие', customers:'Добавить клиента', rules:'Добавить правило',
    rewards:'Добавить награду', gifts:'Добавить подарок', menu:'Добавить позицию', hall:'Добавить стол', settings:'Сохранить'
  };

  async function render() {
    $('#adminTitle').textContent = titles[state.view] || 'BALI';
    const primary = $('#adminPrimary');
    primary.hidden = !primaryLabels[state.view];
    primary.textContent = primaryLabels[state.view] || 'Добавить';
    const content = $('#adminContent');
    content.innerHTML = '<div class="admin-empty">Загрузка…</div>';
    try {
      if (state.view === 'overview') return await renderOverview(content);
      if (state.view === 'messages') return await renderMessages(content);
      if (state.view === 'bookings') return await renderBookings(content);
      if (state.view === 'events') return await renderEvents(content);
      if (state.view === 'customers') return await renderCustomers(content);
      if (state.view === 'rules') return await renderRules(content);
      if (state.view === 'rewards') return await renderCatalog(content, 'loyalty_rewards', 'Награды');
      if (state.view === 'gifts') return await renderCatalog(content, 'loyalty_gifts', 'Подарки');
      if (state.view === 'grants') return await renderGrants(content);
      if (state.view === 'menu') return await renderMenu(content);
      if (state.view === 'hall') return await renderHall(content);
      if (state.view === 'reviews') return await renderReviews(content);
      if (state.view === 'settings') return await renderSettings(content);
    } catch (error) {
      content.innerHTML = `<section class="admin-panel"><div class="admin-empty">Ошибка: ${esc(error.message || error)}</div></section>`;
    }
  }

  function dedupeCustomers(rows) {
    const map = new Map();
    for (const row of rows) {
      const phone = String(row.phone || '').replace(/\D/g, '');
      const telegram = String(row.telegram_id || row.telegram || row.username || '').toLowerCase();
      const key = phone || telegram || String(row.id);
      if (!map.has(key)) map.set(key, row);
    }
    return [...map.values()];
  }

  async function renderOverview(node) {
    const [bookings, events, customers, rules, rewards, gifts, reviews, menu, hall] = await Promise.all([
      safeList('bookings'), safeList('events'), safeList('customers'), safeList('loyalty_rules'), safeList('loyalty_rewards'),
      safeList('loyalty_gifts'), safeList('reviews'), safeList('menu_items'), safeList('hall_tables')
    ]);
    const uniqueCustomers = dedupeCustomers(customers);
    node.innerHTML = `<div class="admin-stats"><article><span>АКТИВНЫХ БРОНЕЙ</span><strong>${bookings.filter(row => !['cancelled','completed'].includes(row.status)).length}</strong><small>${bookings.length} всего</small></article><article><span>КЛИЕНТОВ</span><strong>${uniqueCustomers.length}</strong><small>уникальных карточек</small></article><article><span>НАГРАД / ПОДАРКОВ</span><strong>${rewards.length + gifts.length}</strong><small>${rules.length} правил баллов</small></article><article><span>ОТЗЫВОВ</span><strong>${reviews.length}</strong><small>${events.length} событий</small></article></div><section class="admin-panel"><div class="admin-panel-head"><h2>Состояние системы</h2><button data-action="refresh">Обновить</button></div><div class="admin-system-list"><p><b>Облачная база:</b> ${store.cloudEnabled ? 'подключена' : 'локальный режим'}</p><p><b>Меню:</b> ${menu.length} позиций; <b>столы:</b> ${hall.length}</p><p><b>Чистая пересборка:</b> старые UI-модули не загружаются.</p>${state.fallbackTables.size ? `<p class="warning"><b>Локальный резерв:</b> ${esc([...state.fallbackTables].join(', '))}. Проверьте применение миграций Supabase.</p>` : ''}</div></section>`;
  }

  async function renderBookings(node) {
    const rows = (await safeList('bookings')).sort((a,b) => `${b.booking_date || ''}${b.booking_time || ''}`.localeCompare(`${a.booking_date || ''}${a.booking_time || ''}`));
    node.innerHTML = tablePanel('Бронирования', rows.length, ['Дата / время','Клиент','Телефон','Стол','Гостей','Статус',''], rows.map(row => `<tr><td>${esc(row.booking_date || '—')}<br><small>${esc(row.booking_time || '')}</small></td><td><b>${esc(row.customer_name || row.name || 'Гость')}</b></td><td>${esc(row.phone || '—')}</td><td>${esc(row.table_name || row.table_id || '—')}</td><td>${Number(row.guests || 0)}</td><td>${esc(row.status || 'pending')}</td><td>${rowActions('bookings',row.id)}</td></tr>`));
  }

  async function renderEvents(node) {
    const rows = await safeList('events', { order:'event_date' });
    node.innerHTML = tablePanel('События', rows.length, ['Событие','Дата','Время','Статус',''], rows.map(row => `<tr><td><b>${esc(row.title || 'Событие')}</b><br><small>${esc(row.description || '')}</small></td><td>${esc(row.event_date || '—')}</td><td>${esc(row.event_time || '23:00')}</td><td>${row.active === false ? 'Черновик' : 'Опубликовано'}</td><td>${rowActions('events',row.id)}</td></tr>`));
  }

  async function renderCustomers(node) {
    const rows = dedupeCustomers(await safeList('customers'));
    node.innerHTML = tablePanel('Клиентская база', rows.length, ['Клиент','Телефон','Telegram','Посещения','Сумма',''], rows.map(row => `<tr><td><b>${esc(row.name || 'Гость')}</b></td><td>${esc(row.phone || '—')}</td><td>${esc(row.telegram || row.username || '—')}</td><td>${Number(row.visits || 0)}</td><td>${money(row.total_spent)}</td><td>${rowActions('customers',row.id,false)}</td></tr>`));
  }

  async function renderRules(node) {
    const rows = await safeList('loyalty_rules', { order:'created_at', ascending:false });
    node.innerHTML = tablePanel('Правила начисления баллов', rows.length, ['Название','Действие','Баллы','Статус',''], rows.map(row => `<tr><td><b>${esc(row.title || 'Правило')}</b><br><small>${esc(row.description || '')}</small></td><td><code>${esc(row.action || '')}</code></td><td><b>${Number(row.points || 0)}</b></td><td>${row.active === false ? 'Выключено' : 'Активно'}</td><td>${rowActions('loyalty_rules',row.id)}</td></tr>`));
  }

  async function renderCatalog(node, table, title) {
    const rows = await safeList(table, { order:'created_at', ascending:false });
    const kind = table === 'loyalty_rewards' ? 'reward' : 'gift';
    node.innerHTML = `<section class="admin-panel"><div class="admin-panel-head"><div><h2>${title}</h2><small>${rows.length} записей</small></div></div>${rows.length ? `<div class="admin-cards">${rows.map(row => `<article class="admin-catalog-card"><div class="admin-catalog-icon">${esc(row.icon || (kind === 'reward' ? '🏆' : '🎁'))}</div><div><h3>${esc(row.title || 'Без названия')}</h3><p>${esc(row.description || '')}</p><div class="admin-tags"><span>${Number(row.points_cost || 0)} баллов</span><span>${row.stock == null ? 'Без лимита' : `Остаток: ${Number(row.stock)}`}</span><span class="${row.active === false ? 'off' : ''}">${row.active === false ? 'Скрыто' : 'Активно'}</span></div></div><div class="admin-card-actions"><button data-action="issue" data-kind="${kind}" data-id="${esc(row.id)}">Выдать</button><button data-action="edit" data-table="${table}" data-id="${esc(row.id)}">Изменить</button><button class="danger" data-action="delete" data-table="${table}" data-id="${esc(row.id)}">Удалить</button></div></article>`).join('')}</div>` : `<div class="admin-empty">${title} ещё не созданы. Нажмите кнопку «Добавить».</div>`}</section>`;
  }

  async function renderGrants(node) {
    const [rewardGrants, giftGrants] = await Promise.all([safeList('reward_grants', { order:'created_at', ascending:false }), safeList('gift_grants', { order:'created_at', ascending:false })]);
    const rows = [...rewardGrants.map(row => ({ ...row, kind:'Награда', title:row.reward_title, user:row.user_key })), ...giftGrants.map(row => ({ ...row, kind:'Подарок', title:row.gift_title, user:row.to_user_key }))].sort((a,b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    node.innerHTML = tablePanel('История выдач', rows.length, ['Тип','Название','Пользователь','Статус','Дата'], rows.map(row => `<tr><td>${row.kind}</td><td><b>${esc(row.title || '—')}</b></td><td>${esc(row.user || '—')}</td><td>${esc(row.status || 'issued')}</td><td>${fmtDate(row.created_at)}</td></tr>`), false);
  }

  async function renderMenu(node) {
    const rows = await safeList('menu_items', { order:'sort_order' });
    node.innerHTML = tablePanel('Меню', rows.length, ['Название','Категория','Цена','Статус',''], rows.map(row => `<tr><td><b>${esc(row.name || 'Позиция')}</b><br><small>${esc(row.description || '')}</small></td><td>${esc(row.category || '—')}</td><td>${money(row.price)}</td><td>${row.active === false ? 'Скрыто' : 'Показывается'}</td><td>${rowActions('menu_items',row.id)}</td></tr>`));
  }

  async function renderHall(node) {
    const rows = await safeList('hall_tables');
    node.innerHTML = tablePanel('Столы и схема зала', rows.length, ['Стол','Мест','Форма','Позиция','Статус',''], rows.map(row => `<tr><td><b>${esc(row.name || `Стол ${row.id}`)}</b></td><td>${Number(row.seats || 4)}</td><td>${esc(row.shape || 'round')}</td><td>${Number(row.x || 50)}% / ${Number(row.y || 50)}%</td><td>${row.active === false ? 'Скрыт' : 'Активен'}</td><td>${rowActions('hall_tables',row.id)}</td></tr>`));
  }

  async function renderReviews(node) {
    const rows = await safeList('reviews', { order:'created_at', ascending:false });
    node.innerHTML = `<section class="admin-panel"><div class="admin-panel-head"><div><h2>Отзывы</h2><small>${rows.length} записей</small></div></div>${rows.length ? `<div class="admin-review-list">${rows.map(row => `<article class="admin-review-card"><div><b>${esc(row.user_name || row.name || 'Гость')}</b><span>${'★'.repeat(Math.max(0,Math.min(5,Number(row.rating || 0))))}</span><small>${fmtDate(row.created_at)}</small></div><p>${esc(row.message || row.text || '')}</p>${row.admin_reply ? `<blockquote>${esc(row.admin_reply)}</blockquote>` : ''}<button data-action="edit" data-table="reviews" data-id="${esc(row.id)}">Ответить / изменить</button></article>`).join('')}</div>` : '<div class="admin-empty">Отзывов пока нет</div>'}</section>`;
  }

  async function renderSettings(node) {
    const rows = await safeList('app_settings');
    const item = rows.find(row => row.id === 'main') || { id:'main', club_name:'BALI', address:'Минск, ул. Кирова, 13', phone:'+375 29 670-03-00', events_title:'Ближайшие события', about_title:'О клубе', attendance_points:100 };
    node.innerHTML = `<section class="admin-panel"><div class="admin-panel-head"><h2>Настройки приложения</h2></div><form id="settingsForm" class="admin-form admin-settings-form"><input type="hidden" name="id" value="main"><label>Название клуба<input name="club_name" value="${esc(item.club_name)}"></label><label>Адрес<input name="address" value="${esc(item.address)}"></label><label>Телефон<input name="phone" value="${esc(item.phone)}"></label><label>Заголовок событий<input name="events_title" value="Ближайшие события" readonly></label><label>Заголовок клуба<input name="about_title" value="О клубе" readonly></label><label>Баллы за QR-вход<input name="attendance_points" type="number" value="${Number(item.attendance_points || 100)}"></label><button class="primary">Сохранить настройки</button></form></section>`;
  }

  async function renderMessages(node) {
    if (!store.cloudEnabled || !store.client) {
      node.innerHTML = '<section class="admin-panel"><div class="admin-empty">Сообщения доступны только при подключённом Supabase.</div></section>';
      return;
    }
    const { data, error } = await store.client.from('telegram_conversations').select('*').order('last_message_at', { ascending:false, nullsFirst:false });
    if (error) {
      node.innerHTML = `<section class="admin-panel"><div class="admin-empty">Переписка пока недоступна: ${esc(error.message)}</div></section>`;
      return;
    }
    state.conversations = data || [];
    if (!state.selectedConversation && state.conversations[0]) state.selectedConversation = state.conversations[0].id;
    if (state.selectedConversation) await loadConversationMessages(state.selectedConversation);
    const current = state.conversations.find(row => String(row.id) === String(state.selectedConversation));
    node.innerHTML = `<section class="admin-message-shell"><aside><h2>Диалоги</h2>${state.conversations.length ? state.conversations.map(row => `<button class="${String(row.id) === String(state.selectedConversation) ? 'active' : ''}" data-action="conversation" data-id="${esc(row.id)}"><b>${esc([row.first_name,row.last_name].filter(Boolean).join(' ') || row.username || 'Пользователь')}</b><small>${esc(row.last_message_text || 'Новый диалог')}</small></button>`).join('') : '<div class="admin-empty">Диалогов пока нет</div>'}</aside><div class="admin-message-main"><header><h2>${esc(current ? ([current.first_name,current.last_name].filter(Boolean).join(' ') || current.username || 'Пользователь') : 'Выберите диалог')}</h2></header><div class="admin-message-feed">${state.messages.length ? state.messages.map(row => `<article class="${row.direction === 'admin' ? 'admin' : 'user'}"><p>${esc(row.text || '')}</p><small>${fmtDate(row.created_at)}</small></article>`).join('') : '<div class="admin-empty">Сообщений пока нет</div>'}</div><form id="messageForm"><textarea name="text" placeholder="Ответить пользователю" ${current ? '' : 'disabled'}></textarea><button class="primary" ${current ? '' : 'disabled'}>Отправить</button></form></div></section>`;
  }

  async function loadConversationMessages(id) {
    const { data, error } = await store.client.from('telegram_messages').select('*').eq('conversation_id', id).order('created_at', { ascending:true });
    state.messages = error ? [] : (data || []);
  }

  async function openConversation(id) {
    state.selectedConversation = id;
    await loadConversationMessages(id);
    render();
  }

  async function sendMessage(form) {
    const text = String(new FormData(form).get('text') || '').trim();
    if (!text || !state.selectedConversation) return;
    try {
      const { data, error } = await store.client.functions.invoke('telegram-send-message', { body:{ conversation_id:state.selectedConversation, text } });
      if (error || data?.error) throw error || new Error(data.error);
      form.reset();
      await loadConversationMessages(state.selectedConversation);
      await render();
      toast('Сообщение отправлено');
    } catch (error) { toast(error.message || 'Не удалось отправить сообщение'); }
  }

  function tablePanel(title, count, headers, rows) {
    return `<section class="admin-panel"><div class="admin-panel-head"><div><h2>${title}</h2><small>${count} записей</small></div></div>${rows.length ? `<div class="admin-table-wrap"><table><thead><tr>${headers.map(header => `<th>${header}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>` : '<div class="admin-empty">Записей пока нет</div>'}</section>`;
  }

  function rowActions(table, id, removable = true) {
    return `<div class="admin-inline-actions"><button data-action="edit" data-table="${table}" data-id="${esc(id)}">Изменить</button>${removable ? `<button class="danger" data-action="delete" data-table="${table}" data-id="${esc(id)}">Удалить</button>` : ''}</div>`;
  }

  async function openEditor(table, id = '') {
    const rows = await safeList(table);
    const row = rows.find(item => String(item.id) === String(id)) || {};
    state.editing = { table, id };
    let fields = '';
    if (table === 'bookings') fields = `<div class="admin-form-row"><label>Дата<input name="booking_date" type="date" value="${esc(row.booking_date || '')}" required></label><label>Время<input name="booking_time" type="time" value="${esc(row.booking_time || '23:00')}" required></label></div><label>Имя клиента<input name="customer_name" value="${esc(row.customer_name || row.name || '')}" required></label><label>Телефон<input name="phone" value="${esc(row.phone || '')}" required></label><div class="admin-form-row"><label>Стол<input name="table_id" value="${esc(row.table_id || '')}"></label><label>Название стола<input name="table_name" value="${esc(row.table_name || '')}"></label></div><div class="admin-form-row"><label>Гостей<input name="guests" type="number" min="1" value="${Number(row.guests || 2)}"></label><label>Статус<select name="status">${['pending','confirmed','seated','completed','cancelled'].map(value => `<option value="${value}" ${row.status === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label></div><label>Комментарий<textarea name="comment">${esc(row.comment || '')}</textarea></label>`;
    if (table === 'events') fields = `<label>Название<input name="title" value="${esc(row.title || '')}" required></label><label>Описание<textarea name="description">${esc(row.description || '')}</textarea></label><div class="admin-form-row"><label>Дата<input name="event_date" type="date" value="${esc(row.event_date || '')}" required></label><label>Время<input name="event_time" type="time" value="${esc(row.event_time || '23:00')}"></label></div><label>Ссылка на изображение<input name="image_url" value="${esc(row.image_url || '')}"></label><label class="admin-check"><input name="active" type="checkbox" ${row.active === false ? '' : 'checked'}> Опубликовано</label>`;
    if (table === 'customers') fields = `<label>Имя<input name="name" value="${esc(row.name || '')}" required></label><label>Телефон<input name="phone" value="${esc(row.phone || '')}"></label><label>Telegram<input name="telegram" value="${esc(row.telegram || '')}"></label><label>Заметки<textarea name="notes">${esc(row.notes || '')}</textarea></label>`;
    if (table === 'loyalty_rules') fields = `<label>Название<input name="title" value="${esc(row.title || '')}" required></label><label>Ключ действия<input name="action" value="${esc(row.action || '')}" placeholder="event_checkin" required></label><label>Описание<textarea name="description">${esc(row.description || '')}</textarea></label><label>Баллы<input name="points" type="number" value="${Number(row.points || 0)}"></label><label class="admin-check"><input name="active" type="checkbox" ${row.active === false ? '' : 'checked'}> Активно</label>`;
    if (['loyalty_rewards','loyalty_gifts'].includes(table)) fields = `<label>Название<input name="title" value="${esc(row.title || '')}" required></label><label>Описание<textarea name="description">${esc(row.description || '')}</textarea></label><div class="admin-form-row"><label>Иконка<input name="icon" value="${esc(row.icon || (table === 'loyalty_rewards' ? '🏆' : '🎁'))}"></label><label>Стоимость в баллах<input name="points_cost" type="number" min="0" value="${Number(row.points_cost || 0)}"></label></div><div class="admin-form-row"><label>Остаток<input name="stock" type="number" min="0" value="${row.stock == null ? '' : Number(row.stock)}" placeholder="Без лимита"></label><label class="admin-check"><input name="active" type="checkbox" ${row.active === false ? '' : 'checked'}> Показывать в приложении</label></div>`;
    if (table === 'menu_items') fields = `<label>Название<input name="name" value="${esc(row.name || '')}" required></label><label>Категория<input name="category" value="${esc(row.category || '')}" required></label><label>Описание<textarea name="description">${esc(row.description || '')}</textarea></label><div class="admin-form-row"><label>Цена<input name="price" type="number" step="0.01" value="${Number(row.price || 0)}"></label><label>Порядок<input name="sort_order" type="number" value="${Number(row.sort_order || 0)}"></label></div><label>Ссылка на изображение<input name="image_url" value="${esc(row.image_url || '')}"></label><label class="admin-check"><input name="active" type="checkbox" ${row.active === false ? '' : 'checked'}> Показывать</label>`;
    if (table === 'hall_tables') fields = `<label>Название<input name="name" value="${esc(row.name || '')}" required></label><div class="admin-form-row"><label>Мест<input name="seats" type="number" min="1" value="${Number(row.seats || 4)}"></label><label>Форма<select name="shape">${['round','square','vip'].map(value => `<option value="${value}" ${row.shape === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label></div><div class="admin-form-row"><label>X, %<input name="x" type="number" min="0" max="100" value="${Number(row.x || 50)}"></label><label>Y, %<input name="y" type="number" min="0" max="100" value="${Number(row.y || 50)}"></label></div><label class="admin-check"><input name="active" type="checkbox" ${row.active === false ? '' : 'checked'}> Активен</label>`;
    if (table === 'reviews') fields = `<p><b>Отзыв:</b> ${esc(row.message || row.text || '')}</p><label>Ответ администратора<textarea name="admin_reply">${esc(row.admin_reply || '')}</textarea></label><label>Статус<select name="status">${['new','read','answered','archived'].map(value => `<option value="${value}" ${row.status === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>`;
    $('#adminModalContent').innerHTML = `<h2>${id ? 'Изменить запись' : 'Новая запись'}</h2><form id="adminEditorForm" class="admin-form"><input type="hidden" name="id" value="${esc(row.id || '')}">${fields}<button class="primary">Сохранить</button></form>`;
    $('#adminModal').showModal();
  }

  async function saveEditor(form) {
    const table = state.editing?.table;
    if (!table) return;
    const payload = Object.fromEntries(new FormData(form));
    if (!payload.id) delete payload.id;
    for (const field of ['points','points_cost','stock','price','sort_order','seats','x','y','guests']) {
      if (!(field in payload)) continue;
      payload[field] = payload[field] === '' && field === 'stock' ? null : Number(payload[field] || 0);
    }
    if (['events','loyalty_rules','loyalty_rewards','loyalty_gifts','menu_items','hall_tables'].includes(table)) payload.active = Boolean(form.elements.active?.checked);
    if (['loyalty_rewards','loyalty_gifts'].includes(table)) payload.image = payload.image || '';
    if (table === 'bookings') payload.customer_name = payload.customer_name || 'Гость';
    try {
      await store.save(table, payload);
      $('#adminModal').close();
      toast('Сохранено');
      await render();
    } catch (error) { toast(error.message || 'Не удалось сохранить'); }
  }

  async function removeRow(table, id) {
    if (!confirm('Удалить запись?')) return;
    try { await store.remove(table, id); toast('Удалено'); await render(); }
    catch (error) { toast(error.message || 'Не удалось удалить'); }
  }

  async function openIssue(kind, id) {
    const table = kind === 'reward' ? 'loyalty_rewards' : 'loyalty_gifts';
    const rows = await safeList(table);
    const item = rows.find(row => String(row.id) === String(id));
    const users = await safeList('app_users', { order:'last_seen_at', ascending:false });
    state.issuing = { kind, item };
    $('#adminModalContent').innerHTML = `<h2>Выдать: ${esc(item?.title || '')}</h2><form id="adminIssueForm" class="admin-form"><label>Пользователь<select name="user_key" required><option value="">Выберите пользователя</option>${users.map(person => `<option value="${esc(person.user_key)}">${esc(person.name || person.username || person.user_key)} · ${esc(person.user_key)}</option>`).join('')}</select></label><label>Статус<select name="status"><option value="issued">Выдано</option><option value="reserved">Зарезервировано</option></select></label><button class="primary">Выдать</button></form>`;
    $('#adminModal').showModal();
  }

  async function saveIssue(form) {
    const info = state.issuing;
    if (!info?.item) return;
    const data = Object.fromEntries(new FormData(form));
    try {
      if (info.kind === 'reward') await store.save('reward_grants', { user_key:data.user_key, reward_id:info.item.id, reward_title:info.item.title, status:data.status || 'issued', source:'admin' });
      else await store.save('gift_grants', { from_user_key:null, to_user_key:data.user_key, gift_id:info.item.id, gift_title:info.item.title, status:data.status === 'reserved' ? 'reserved' : 'sent' });
      $('#adminModal').close();
      toast('Выдача сохранена');
      state.view = 'grants';
      $$('#adminNav button').forEach(button => button.classList.toggle('active', button.dataset.view === 'grants'));
      await render();
    } catch (error) { toast(error.message || 'Не удалось выдать'); }
  }

  async function saveSettings(form) {
    const data = Object.fromEntries(new FormData(form));
    data.attendance_points = Number(data.attendance_points || 100);
    data.events_title = 'Ближайшие события';
    data.about_title = 'О клубе';
    try { await store.save('app_settings', data); toast('Настройки сохранены'); }
    catch (error) { toast(error.message || 'Не удалось сохранить настройки'); }
  }

  store.getSession().then(session => session ? mountApp() : loginView()).catch(() => loginView());
})();
