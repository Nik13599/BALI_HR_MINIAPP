(() => {
  'use strict';
  const cfg = window.BALI_CONFIG || {};
  const store = window.BaliStore;
  const root = document.getElementById('adminRoot');
  if (!root || !store) return;

  const state = { view:'overview', editing:null, issuing:null, fallbackTables:new Set() };
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
  const esc = (value = '') => String(value).replace(/[&<>'"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[ch]));
  const fmtDate = value => value ? new Date(value).toLocaleString('ru-RU', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
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
      console.error(`[ADMIN ${table}]`, error);
      toast(`Ошибка ${table}: ${error.message || error}`);
      return store.readCache?.(table) || [];
    }
  }

  function loginView() {
    root.innerHTML = `
      <main class="admin-login"><form id="adminLoginForm" class="admin-login-card"><div class="admin-logo">B</div><span>BALI CONTROL</span><h1>Панель управления</h1><p>Управление приложением BALI.</p><label>Логин<input name="login" autocomplete="username" required></label><label>Пароль<input name="password" type="password" autocomplete="current-password" required></label><button class="primary">Войти</button></form></main><div id="adminToast" class="admin-toast"></div>`;
    $('#adminLoginForm').addEventListener('submit', async event => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      try {
        await store.signIn(form.get('login'), form.get('password'));
        mountApp();
      } catch (error) { toast(error.message || 'Не удалось войти'); }
    });
  }

  function mountApp() {
    root.innerHTML = `
      <div class="admin-shell">
        <aside class="admin-sidebar"><div class="admin-brand"><b>B</b><span><strong>BALI</strong><small>CONTROL</small></span></div><nav id="adminNav">
          <button class="active" data-view="overview">▦ <span>Обзор</span></button>
          <button data-view="rewards">🏆 <span>Награды</span></button>
          <button data-view="gifts">🎁 <span>Подарки</span></button>
          <button data-view="grants">★ <span>Выдачи</span></button>
          <button data-view="customers">◎ <span>Клиенты</span></button>
          <button data-view="events">◫ <span>События</span></button>
          <button data-view="settings">⚙ <span>Настройки</span></button>
        </nav><div class="admin-sidebar-foot"><a href="./index.html?v=bali-rebuild-1" target="_blank">Открыть приложение ↗</a><button data-action="logout">Выйти</button></div></aside>
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
      const actionNode = event.target.closest('[data-action]');
      if (!actionNode) return;
      const action = actionNode.dataset.action;
      if (action === 'logout') { await store.signOut(); location.reload(); }
      if (action === 'close-modal') $('#adminModal')?.close();
      if (action === 'edit') openEditor(actionNode.dataset.table, actionNode.dataset.id);
      if (action === 'delete') removeRow(actionNode.dataset.table, actionNode.dataset.id);
      if (action === 'issue') openIssue(actionNode.dataset.kind, actionNode.dataset.id);
    });
    $('#adminPrimary').addEventListener('click', () => {
      if (state.view === 'rewards') openEditor('loyalty_rewards');
      else if (state.view === 'gifts') openEditor('loyalty_gifts');
      else if (state.view === 'events') openEditor('events');
      else if (state.view === 'customers') openEditor('customers');
      else if (state.view === 'settings') saveSettingsFromView();
    });
    document.addEventListener('submit', async event => {
      if (event.target.id === 'adminEditorForm') { event.preventDefault(); await saveEditor(event.target); }
      if (event.target.id === 'adminIssueForm') { event.preventDefault(); await saveIssue(event.target); }
      if (event.target.id === 'settingsForm') { event.preventDefault(); await saveSettings(event.target); }
    });
  }

  const titles = { overview:'Обзор', rewards:'Награды', gifts:'Подарки', grants:'История выдач', customers:'Клиенты', events:'События', settings:'Настройки' };

  async function render() {
    $('#adminTitle').textContent = titles[state.view] || 'BALI';
    const primary = $('#adminPrimary');
    primary.hidden = !['rewards','gifts','events','customers','settings'].includes(state.view);
    primary.textContent = state.view === 'settings' ? 'Сохранить' : ({ rewards:'Добавить награду', gifts:'Добавить подарок', events:'Добавить событие', customers:'Добавить клиента' }[state.view] || 'Добавить');
    const content = $('#adminContent');
    content.innerHTML = '<div class="admin-empty">Загрузка…</div>';
    if (state.view === 'overview') return renderOverview(content);
    if (state.view === 'rewards') return renderCatalog(content, 'loyalty_rewards', 'Награды');
    if (state.view === 'gifts') return renderCatalog(content, 'loyalty_gifts', 'Подарки');
    if (state.view === 'grants') return renderGrants(content);
    if (state.view === 'customers') return renderCustomers(content);
    if (state.view === 'events') return renderEvents(content);
    if (state.view === 'settings') return renderSettings(content);
  }

  async function renderOverview(rootNode) {
    const [rewards, gifts, rewardGrants, giftGrants, customers, events] = await Promise.all([
      safeList('loyalty_rewards'), safeList('loyalty_gifts'), safeList('reward_grants'), safeList('gift_grants'), safeList('customers'), safeList('events')
    ]);
    const uniqueCustomers = dedupeCustomers(customers);
    rootNode.innerHTML = `<div class="admin-stats"><article><span>НАГРАД</span><strong>${rewards.length}</strong><small>${rewards.filter(x => x.active !== false).length} активных</small></article><article><span>ПОДАРКОВ</span><strong>${gifts.length}</strong><small>${gifts.filter(x => x.active !== false).length} активных</small></article><article><span>ВЫДАЧ</span><strong>${rewardGrants.length + giftGrants.length}</strong><small>наград и подарков</small></article><article><span>КЛИЕНТОВ</span><strong>${uniqueCustomers.length}</strong><small>уникальных карточек</small></article></div><section class="admin-panel"><div class="admin-panel-head"><h2>Состояние пересборки</h2></div><div class="admin-system-list"><p><b>Пользовательское приложение:</b> чистая автономная сборка без старых UI-модулей.</p><p><b>Каталоги:</b> ${rewards.length ? 'награды загружены' : 'каталог наград пуст'}; ${gifts.length ? 'подарки загружены' : 'каталог подарков пуст'}.</p><p><b>Облачное подключение:</b> ${store.cloudEnabled ? 'включено' : 'локальный режим'}.</p>${state.fallbackTables.size ? `<p class="warning"><b>Локальный резерв:</b> ${esc([...state.fallbackTables].join(', '))}. Примените миграцию Supabase.</p>` : ''}<p><b>События:</b> ${events.length}</p></div></section>`;
  }

  async function renderCatalog(rootNode, table, title) {
    const rows = await safeList(table, { order:'created_at', ascending:false });
    const kind = table === 'loyalty_rewards' ? 'reward' : 'gift';
    rootNode.innerHTML = `<section class="admin-panel"><div class="admin-panel-head"><div><h2>${title}</h2><small>${rows.length} записей</small></div></div>${rows.length ? `<div class="admin-cards">${rows.map(row => `<article class="admin-catalog-card"><div class="admin-catalog-icon">${esc(row.icon || (kind === 'reward' ? '🏆' : '🎁'))}</div><div><h3>${esc(row.title || 'Без названия')}</h3><p>${esc(row.description || '')}</p><div class="admin-tags"><span>${Number(row.points_cost || 0)} баллов</span><span>${row.stock == null ? 'Без лимита' : `Остаток: ${Number(row.stock)}`}</span><span class="${row.active === false ? 'off' : ''}">${row.active === false ? 'Скрыто' : 'Активно'}</span></div></div><div class="admin-card-actions"><button data-action="issue" data-kind="${kind}" data-id="${esc(row.id)}">Выдать</button><button data-action="edit" data-table="${table}" data-id="${esc(row.id)}">Изменить</button><button class="danger" data-action="delete" data-table="${table}" data-id="${esc(row.id)}">Удалить</button></div></article>`).join('')}</div>` : `<div class="admin-empty">${title} ещё не созданы. Нажмите кнопку «Добавить».</div>`}</section>`;
  }

  async function renderGrants(rootNode) {
    const [rewardGrants, giftGrants] = await Promise.all([safeList('reward_grants', { order:'created_at', ascending:false }), safeList('gift_grants', { order:'created_at', ascending:false })]);
    const rows = [
      ...rewardGrants.map(row => ({ ...row, kind:'Награда', title:row.reward_title, user:row.user_key })),
      ...giftGrants.map(row => ({ ...row, kind:'Подарок', title:row.gift_title, user:row.to_user_key }))
    ].sort((a,b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    rootNode.innerHTML = `<section class="admin-panel"><div class="admin-panel-head"><div><h2>История выдач</h2><small>${rows.length} операций</small></div></div>${rows.length ? `<div class="admin-table-wrap"><table><thead><tr><th>Тип</th><th>Название</th><th>Пользователь</th><th>Статус</th><th>Дата</th></tr></thead><tbody>${rows.map(row => `<tr><td>${row.kind}</td><td><b>${esc(row.title || '—')}</b></td><td>${esc(row.user || '—')}</td><td>${esc(row.status || 'issued')}</td><td>${fmtDate(row.created_at)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="admin-empty">Выдач пока нет</div>'}</section>`;
  }

  function dedupeCustomers(rows) {
    const map = new Map();
    for (const row of rows) {
      const phone = String(row.phone || '').replace(/\D/g, '');
      const tg = String(row.telegram_id || row.telegram || '').toLowerCase();
      const key = phone || tg || String(row.id);
      if (!map.has(key)) map.set(key, row);
    }
    return [...map.values()];
  }

  async function renderCustomers(rootNode) {
    const rows = dedupeCustomers(await safeList('customers'));
    rootNode.innerHTML = `<section class="admin-panel"><div class="admin-panel-head"><div><h2>Клиентская база</h2><small>${rows.length} уникальных клиентов</small></div></div>${rows.length ? `<div class="admin-table-wrap"><table><thead><tr><th>Клиент</th><th>Телефон</th><th>Telegram</th><th>Посещения</th><th></th></tr></thead><tbody>${rows.map(row => `<tr><td><b>${esc(row.name || 'Гость')}</b></td><td>${esc(row.phone || '—')}</td><td>${esc(row.telegram || row.username || '—')}</td><td>${Number(row.visits || 0)}</td><td><button data-action="edit" data-table="customers" data-id="${esc(row.id)}">Изменить</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="admin-empty">Клиентов пока нет</div>'}</section>`;
  }

  async function renderEvents(rootNode) {
    const rows = await safeList('events', { order:'event_date' });
    rootNode.innerHTML = `<section class="admin-panel"><div class="admin-panel-head"><div><h2>События</h2><small>${rows.length} записей</small></div></div>${rows.length ? `<div class="admin-table-wrap"><table><thead><tr><th>Название</th><th>Дата</th><th>Время</th><th>Статус</th><th></th></tr></thead><tbody>${rows.map(row => `<tr><td><b>${esc(row.title || 'Событие')}</b></td><td>${esc(row.event_date || '—')}</td><td>${esc(row.event_time || '23:00')}</td><td>${row.active === false ? 'Черновик' : 'Опубликовано'}</td><td><button data-action="edit" data-table="events" data-id="${esc(row.id)}">Изменить</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="admin-empty">Событий пока нет</div>'}</section>`;
  }

  async function renderSettings(rootNode) {
    const rows = await safeList('app_settings');
    const item = rows.find(row => row.id === 'main') || { id:'main', club_name:'BALI', address:'Минск, ул. Кирова, 13', phone:'+375 29 670-03-00', events_title:'Ближайшие события', about_title:'О клубе', attendance_points:100 };
    rootNode.innerHTML = `<section class="admin-panel"><div class="admin-panel-head"><h2>Настройки приложения</h2></div><form id="settingsForm" class="admin-form"><input type="hidden" name="id" value="main"><label>Название клуба<input name="club_name" value="${esc(item.club_name)}"></label><label>Адрес<input name="address" value="${esc(item.address)}"></label><label>Телефон<input name="phone" value="${esc(item.phone)}"></label><label>Заголовок событий<input name="events_title" value="Ближайшие события" readonly></label><label>Заголовок клуба<input name="about_title" value="О клубе" readonly></label><label>Баллы за QR-вход<input name="attendance_points" type="number" value="${Number(item.attendance_points || 100)}"></label><button class="primary">Сохранить настройки</button></form></section>`;
  }

  async function openEditor(table, id = '') {
    const rows = await safeList(table);
    const row = rows.find(item => String(item.id) === String(id)) || {};
    state.editing = { table, id };
    const modal = $('#adminModal');
    const title = id ? 'Изменить запись' : 'Новая запись';
    let fields = '';
    if (['loyalty_rewards','loyalty_gifts'].includes(table)) fields = `<label>Название<input name="title" value="${esc(row.title || '')}" required></label><label>Описание<textarea name="description">${esc(row.description || '')}</textarea></label><div class="admin-form-row"><label>Иконка<input name="icon" value="${esc(row.icon || (table === 'loyalty_rewards' ? '🏆' : '🎁'))}"></label><label>Стоимость в баллах<input name="points_cost" type="number" min="0" value="${Number(row.points_cost || 0)}"></label></div><div class="admin-form-row"><label>Остаток<input name="stock" type="number" min="0" value="${row.stock == null ? '' : Number(row.stock)}" placeholder="Без лимита"></label><label class="admin-check"><input name="active" type="checkbox" ${row.active === false ? '' : 'checked'}> Показывать в приложении</label></div>`;
    if (table === 'events') fields = `<label>Название<input name="title" value="${esc(row.title || '')}" required></label><label>Описание<textarea name="description">${esc(row.description || '')}</textarea></label><div class="admin-form-row"><label>Дата<input name="event_date" type="date" value="${esc(row.event_date || '')}" required></label><label>Время<input name="event_time" type="time" value="${esc(row.event_time || '23:00')}"></label></div><label>Ссылка на изображение<input name="image_url" value="${esc(row.image_url || '')}"></label><label class="admin-check"><input name="active" type="checkbox" ${row.active === false ? '' : 'checked'}> Опубликовано</label>`;
    if (table === 'customers') fields = `<label>Имя<input name="name" value="${esc(row.name || '')}" required></label><label>Телефон<input name="phone" value="${esc(row.phone || '')}"></label><label>Telegram<input name="telegram" value="${esc(row.telegram || '')}"></label><label>Заметки<textarea name="notes">${esc(row.notes || '')}</textarea></label>`;
    $('#adminModalContent').innerHTML = `<h2>${title}</h2><form id="adminEditorForm" class="admin-form"><input type="hidden" name="id" value="${esc(row.id || '')}">${fields}<button class="primary">Сохранить</button></form>`;
    modal.showModal();
  }

  async function saveEditor(form) {
    const table = state.editing?.table;
    if (!table) return;
    const raw = Object.fromEntries(new FormData(form));
    const payload = { ...raw };
    if (!payload.id) delete payload.id;
    if (['loyalty_rewards','loyalty_gifts'].includes(table)) {
      payload.points_cost = Number(payload.points_cost || 0);
      payload.stock = payload.stock === '' ? null : Number(payload.stock);
      payload.active = form.elements.active.checked;
      payload.image = payload.image || '';
    }
    if (table === 'events') payload.active = form.elements.active.checked;
    try {
      await store.save(table, payload);
      $('#adminModal').close();
      toast('Сохранено');
      render();
    } catch (error) { toast(error.message || 'Не удалось сохранить'); }
  }

  async function removeRow(table, id) {
    if (!confirm('Удалить запись?')) return;
    try { await store.remove(table, id); toast('Удалено'); render(); }
    catch (error) { toast(error.message || 'Не удалось удалить'); }
  }

  async function openIssue(kind, id) {
    const table = kind === 'reward' ? 'loyalty_rewards' : 'loyalty_gifts';
    const rows = await safeList(table);
    const item = rows.find(row => String(row.id) === String(id));
    const users = await safeList('app_users', { order:'last_seen_at', ascending:false });
    state.issuing = { kind, item };
    $('#adminModalContent').innerHTML = `<h2>Выдать: ${esc(item?.title || '')}</h2><form id="adminIssueForm" class="admin-form"><label>Пользователь<select name="user_key" required><option value="">Выберите пользователя</option>${users.map(user => `<option value="${esc(user.user_key)}">${esc(user.name || user.username || user.user_key)} · ${esc(user.user_key)}</option>`).join('')}</select></label><label>Статус<select name="status"><option value="issued">Выдано</option><option value="reserved">Зарезервировано</option></select></label><button class="primary">Выдать</button></form>`;
    $('#adminModal').showModal();
  }

  async function saveIssue(form) {
    const info = state.issuing;
    if (!info?.item) return;
    const data = Object.fromEntries(new FormData(form));
    try {
      if (info.kind === 'reward') await store.save('reward_grants', { user_key:data.user_key, reward_id:info.item.id, reward_title:info.item.title, status:data.status || 'issued', source:'admin' });
      else await store.save('gift_grants', { from_user_key:null, to_user_key:data.user_key, gift_id:info.item.id, gift_title:info.item.title, status:data.status || 'sent' });
      $('#adminModal').close();
      toast('Выдача сохранена');
      state.view = 'grants';
      $$('#adminNav button').forEach(button => button.classList.toggle('active', button.dataset.view === 'grants'));
      render();
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

  function saveSettingsFromView() { $('#settingsForm')?.requestSubmit(); }

  store.getSession().then(session => session ? mountApp() : loginView()).catch(loginView);
})();
