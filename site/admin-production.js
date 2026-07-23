(() => {
  const store = window.BaliStore;
  const cfg = window.BALI_CONFIG || {};
  if (!store) return;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v = "") => String(v).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const date = v => v ? new Date(`${String(v).slice(0,10)}T12:00:00`).toLocaleDateString("ru-RU", { day:"2-digit", month:"short", year:"numeric" }) : "—";
  const time = v => v ? String(v).slice(0,5) : "—";
  const dt = v => v ? new Date(v).toLocaleString("ru-RU", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" }) : "—";
  const today = () => new Date().toISOString().slice(0,10);
  const money = v => `${Number(v || 0).toLocaleString("ru-RU")} BYN`;
  const LOGIN = String(cfg.adminLogin || "BaliBali");
  const ADMIN_EMAIL = String(cfg.adminEmail || "balibali@bali.local");
  const PASSWORD_SHA256 = "b3866eebf3d9c3d40280fbca38cee1ccf618f97f824f7705f7c46635b39c47f0";
  const SESSION = "bali_admin_authenticated_v2";

  const state = { view:"dashboard", selectedConversation:"", conversations:[], messages:[], eventTab:"current" };
  const titles = { dashboard:"Обзор", messages:"Сообщения", events:"События", bookings:"Брони", customers:"Клиенты", bonuses:"Баллы + VIP", menu:"Меню", hall:"Схемы", settings:"Настройки" };

  function toast(message) {
    const node = $("#toast");
    if (!node) return;
    node.textContent = message;
    node.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => node.classList.remove("show"), 2600);
  }
  async function hash(value) {
    const data = new TextEncoder().encode(String(value || ""));
    const digest = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2,"0")).join("");
  }
  function openApp() {
    $("#loginView")?.classList.add("hidden");
    $("#appView")?.classList.remove("hidden");
    const badge = $("#modeBadge");
    if (badge) { badge.textContent = store.cloudEnabled ? "PRODUCTION" : "БАЗА НЕ ПОДКЛЮЧЕНА"; badge.classList.toggle("cloud", store.cloudEnabled); }
    go("dashboard");
  }

  $("#loginForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const login = String(fd.get("login") || fd.get("email") || "").trim();
    const password = String(fd.get("password") || "");
    try {
      if (login !== LOGIN || await hash(password) !== PASSWORD_SHA256) throw new Error("Неверный логин или пароль");
      if (store.cloudEnabled) await store.signIn(ADMIN_EMAIL, password);
      sessionStorage.setItem(SESSION, "1");
      openApp();
    } catch (error) { toast(error.message || "Не удалось войти"); }
  });
  $("#logoutButton")?.addEventListener("click", async () => { sessionStorage.removeItem(SESSION); await store.signOut(); location.reload(); });

  $("#adminNav")?.addEventListener("click", e => {
    const button = e.target.closest("button[data-view]");
    if (!button) return;
    go(button.dataset.view);
  });
  $("#primaryAction")?.addEventListener("click", () => {
    if (state.view === "events") return editEvent();
    if (state.view === "bookings" || state.view === "dashboard") return editBooking();
    if (state.view === "menu") return editMenu();
    if (state.view === "hall") return editTable();
  });

  function go(view) {
    state.view = view;
    $$("#adminNav button").forEach(b => b.classList.toggle("active", b.dataset.view === view));
    $("#pageTitle").textContent = titles[view] || "BALI Admin";
    const action = $("#primaryAction");
    const labels = { dashboard:"Новая бронь", events:"Добавить событие", bookings:"Новая бронь", menu:"Добавить позицию", hall:"Добавить стол" };
    if (action) { action.style.display = labels[view] ? "inline-flex" : "none"; action.textContent = labels[view] || ""; }
    render();
  }

  async function list(table, options = {}) {
    try { return await store.list(table, options); }
    catch (error) { console.error(table, error); return []; }
  }
  function cloudNotice(title = "Рабочая база не подключена") {
    return `<section class="panel"><div class="panel-head"><div><h3>${esc(title)}</h3><small>Демонстрационные данные отключены</small></div></div><div class="panel-body"><p class="muted">Чтобы раздел работал с реальными пользователями, нужно подключить Supabase в <code>config.js</code>, выполнить <a href="/bali-production-schema.sql" target="_blank">production SQL-схему</a> и развернуть серверные функции.</p></div></section>`;
  }
  async function render() {
    const root = $("#content");
    root.innerHTML = '<div class="empty">Загрузка…</div>';
    try {
      if (state.view === "dashboard") return renderDashboard(root);
      if (state.view === "messages") return renderMessages(root);
      if (state.view === "events") return renderEvents(root);
      if (state.view === "bookings") return renderBookings(root);
      if (state.view === "customers") return renderCustomers(root);
      if (state.view === "bonuses") return renderBonuses(root);
      if (state.view === "menu") return renderMenu(root);
      if (state.view === "hall") return renderHall(root);
      if (state.view === "settings") return renderSettings(root);
    } catch (error) { root.innerHTML = `<section class="panel"><div class="empty">${esc(error.message || "Ошибка загрузки")}</div></section>`; }
  }

  function birthdayDistance(value) {
    if (!value) return 999;
    const b = new Date(`${String(value).slice(0,10)}T12:00:00`), n = new Date();
    const next = new Date(n.getFullYear(), b.getMonth(), b.getDate(), 12);
    if (next < new Date(n.getFullYear(), n.getMonth(), n.getDate(), 12)) next.setFullYear(next.getFullYear() + 1);
    return Math.floor((next - new Date(n.getFullYear(), n.getMonth(), n.getDate(), 12)) / 86400000);
  }
  async function renderDashboard(root) {
    const [checkins, users, customers, bookings, chips] = await Promise.all([
      list("event_checkins", { order:"checked_in_at", ascending:false }), list("app_users", { order:"last_seen_at", ascending:false }),
      list("customers"), list("bookings"), list("chip_requests", { order:"created_at", ascending:false })
    ]);
    const day = today();
    const guestsToday = checkins.filter(r => String(r.checked_in_at || "").slice(0,10) === day && !r.left_at && r.presence_status !== "left");
    const clients = users.length || customers.length;
    const birthdays = users.filter(r => r.birth_date).map(r => ({...r, distance:birthdayDistance(r.birth_date)})).sort((a,b) => a.distance-b.distance);
    const birthdayToday = birthdays.filter(r => r.distance === 0);
    const upcomingBirthdays = birthdays.filter(r => r.distance > 0).slice(0,10);
    const upcomingBookings = bookings.filter(r => String(r.booking_date || "") >= day && !["completed","cancelled"].includes(r.status)).sort((a,b) => `${a.booking_date}${a.booking_time}`.localeCompare(`${b.booking_date}${b.booking_time}`));
    const pendingChips = chips.filter(r => r.status === "pending");
    root.innerHTML = `${!store.cloudEnabled ? cloudNotice() : ""}
      <div class="stats">
        <article class="stat-card"><span>ГОСТЕЙ СЕГОДНЯ</span><strong>${guestsToday.length}</strong><em>вошли по QR-коду</em></article>
        <article class="stat-card"><span>КЛИЕНТОВ В БАЗЕ</span><strong>${clients}</strong><em>пользователи BALI</em></article>
        <article class="stat-card"><span>ДЕНЬ РОЖДЕНИЯ СЕГОДНЯ</span><strong>${birthdayToday.length}</strong><em>${birthdayToday.length ? birthdayToday.map(x=>esc(x.name)).join(", ") : "сегодня нет"}</em></article>
        <button class="stat-card" type="button" id="openBirthdays"><span>БЛИЖАЙШИЕ ДНИ РОЖДЕНИЯ</span><strong>${upcomingBirthdays.length}</strong><em>открыть список →</em></button>
      </div>
      <div class="head-actions" style="margin-bottom:14px"><button class="ghost" id="openVisitorsPeriod">Посетители за период</button></div>
      <div class="dashboard-grid">
        <section class="panel"><div class="panel-head"><div><h3>Ближайшие бронирования</h3><small>Добавление и подтверждение без перехода в другой раздел</small></div><button class="ghost" id="dashboardAddBooking">Добавить</button></div><div class="panel-body">${upcomingBookings.length ? upcomingBookings.slice(0,10).map(r => `<div class="booking-row"><div class="booking-time">${esc(time(r.booking_time))}</div><div><strong>${esc(r.customer_name || r.name || "Гость")}</strong><p>${date(r.booking_date)} · ${Number(r.guests||0)} гостей · ${esc(r.table_name||r.table_id||"без стола")}</p></div><span class="status ${esc(r.status)}">${esc(r.status||"pending")}</span>${r.status === "pending" ? `<button class="ghost" data-confirm-booking="${esc(r.id)}">Подтвердить</button>` : ""}</div>`).join("") : '<div class="empty">Ближайших броней нет</div>'}</div></section>
        <section class="panel"><div class="panel-head"><div><h3>Заявки на фишки</h3><small>${pendingChips.length} ожидают решения</small></div></div><div class="panel-body">${pendingChips.length ? pendingChips.slice(0,10).map(r => `<div class="booking-row"><div><strong>${esc(r.name || "Пользователь")}</strong><p>${Number(r.quantity||0)} фишек · ${Number(r.points_cost||0)} баллов</p></div><button class="ghost" data-chip-approve="${esc(r.id)}">Выдать</button><button class="danger" data-chip-reject="${esc(r.id)}">Отклонить</button></div>`).join("") : '<div class="empty">Новых заявок нет</div>'}</div></section>
      </div>`;
    $("#dashboardAddBooking")?.addEventListener("click", () => editBooking());
    $("#openBirthdays")?.addEventListener("click", () => showList("Ближайшие дни рождения", [...birthdayToday, ...upcomingBirthdays].map(r => `<div class="booking-row"><div><strong>${esc(r.name||"Пользователь")}</strong><p>${date(r.birth_date)} · через ${r.distance} дн.</p></div></div>`).join("") || '<div class="empty">Даты рождения не указаны</div>'));
    $("#openVisitorsPeriod")?.addEventListener("click", () => openVisitors(checkins));
  }

  function ensureDialog() {
    let dialog = $("#productionAdminDialog");
    if (!dialog) {
      document.body.insertAdjacentHTML("beforeend", '<dialog id="productionAdminDialog" class="modal"><button class="modal-close" data-production-close>×</button><div id="productionAdminDialogBody" class="editor-form"></div></dialog>');
      dialog = $("#productionAdminDialog");
      dialog.addEventListener("click", e => { if (e.target.closest("[data-production-close]")) dialog.close(); });
    }
    return dialog;
  }
  function showList(title, body) { const d=ensureDialog(); $("#productionAdminDialogBody").innerHTML=`<div><span class="eyebrow">BALI CONTROL</span><h3>${esc(title)}</h3></div><div class="panel-body">${body}</div>`; d.showModal(); }
  function openVisitors(rows) {
    const d = ensureDialog();
    $("#productionAdminDialogBody").innerHTML = `<div><span class="eyebrow">АНАЛИТИКА</span><h3>Посетители за период</h3></div><div class="filter-bar"><input id="visitorsFrom" type="date"><input id="visitorsTo" type="date" value="${today()}"></div><div id="visitorsResult"></div>`;
    const draw = () => { const from=$("#visitorsFrom").value, to=$("#visitorsTo").value; const filtered=rows.filter(r => (!from||String(r.checked_in_at||"").slice(0,10)>=from)&&(!to||String(r.checked_in_at||"").slice(0,10)<=to)); $("#visitorsResult").innerHTML=filtered.length?filtered.map(r=>`<div class="booking-row"><div><strong>${esc(r.name||r.user_name||"Гость BALI")}</strong><p>${dt(r.checked_in_at)} · ${esc(r.event_title||"Событие BALI")}</p></div></div>`).join(""):'<div class="empty">Посещений за период нет</div>'; };
    $("#visitorsFrom").addEventListener("change",draw); $("#visitorsTo").addEventListener("change",draw); draw(); d.showModal();
  }

  async function renderMessages(root) {
    if (!store.cloudEnabled) { root.innerHTML = cloudNotice("Сообщения Telegram ещё не подключены"); return; }
    state.conversations = await list("telegram_conversations", { order:"last_message_at", ascending:false });
    if (!state.selectedConversation && state.conversations.length) state.selectedConversation = state.conversations[0].id;
    if (state.selectedConversation) state.messages = await list("telegram_messages", { filters:{ conversation_id:state.selectedConversation }, order:"created_at" });
    const selected = state.conversations.find(x => x.id === state.selectedConversation);
    root.innerHTML = `<section class="admin-messages-shell"><aside class="admin-messages-sidebar"><div class="admin-messages-toolbar"><input id="messageSearch" placeholder="Поиск сообщений"></div><div id="conversationList" class="admin-messages-list">${conversationList(state.conversations)}</div></aside><div class="admin-messages-main"><header class="admin-chat-head"><div class="admin-chat-person"><strong>${esc(selected ? [selected.first_name,selected.last_name].filter(Boolean).join(" ") || selected.username || "Пользователь" : "Выберите диалог")}</strong><small>${selected?.username ? `@${esc(selected.username)}` : "Telegram"}</small></div></header><div id="messageFeed" class="admin-chat-feed">${state.messages.length ? state.messages.map(m=>`<article class="admin-message ${m.direction === "admin" ? "admin" : "user"}"><p>${esc(m.text||"")}</p><small>${dt(m.created_at)}</small></article>`).join("") : '<div class="admin-chat-empty">Сообщений пока нет</div>'}</div><form id="sendMessageForm" class="admin-chat-compose"><textarea id="sendMessageText" placeholder="Напишите пользователю…" ${selected?"":"disabled"}></textarea><button class="primary" ${selected?"":"disabled"}>Отправить</button></form></div></section>`;
    $("#conversationList")?.addEventListener("click", async e => { const b=e.target.closest("[data-conversation]"); if(!b)return; state.selectedConversation=b.dataset.conversation; await store.client.from("telegram_conversations").update({unread_admin:0}).eq("id",state.selectedConversation); renderMessages(root); });
    $("#messageSearch")?.addEventListener("input", e => { const q=e.target.value.toLowerCase(); $("#conversationList").innerHTML=conversationList(state.conversations.filter(r=>`${r.first_name||""} ${r.last_name||""} ${r.username||""} ${r.last_message_text||""}`.toLowerCase().includes(q))); });
    $("#sendMessageForm")?.addEventListener("submit", async e => { e.preventDefault(); const text=$("#sendMessageText").value.trim(); if(!text)return; try { const {data,error}=await store.client.functions.invoke("telegram-send-message",{body:{conversation_id:state.selectedConversation,text}}); if(error||data?.error)throw error||new Error(data.error); $("#sendMessageText").value=""; toast("Сообщение отправлено"); renderMessages(root); } catch(error){toast(error.message||"Ошибка отправки");} });
  }
  function conversationList(rows) { return rows.length ? rows.map(r=>`<button class="admin-conversation ${r.id===state.selectedConversation?"active":""}" data-conversation="${esc(r.id)}"><span class="admin-conversation-copy"><strong>${esc([r.first_name,r.last_name].filter(Boolean).join(" ")||r.username||"Пользователь")}</strong><p>${esc(r.last_message_text||"Новый диалог")}</p></span><span class="admin-conversation-meta"><time>${dt(r.last_message_at)}</time>${Number(r.unread_admin||0)?`<b class="admin-unread">${Number(r.unread_admin)}</b>`:""}</span></button>`).join("") : '<div class="admin-chat-empty">Диалогов пока нет</div>'; }

  function eventEnd(row) {
    const start = String(row.event_date||"").slice(0,10), st=String(row.event_time||"23:00").slice(0,5), et=String(row.event_end_time||"06:00").slice(0,5);
    let end=String(row.event_end_date||start).slice(0,10); if(!row.event_end_date&&et<=st){const d=new Date(`${start}T12:00:00`);d.setDate(d.getDate()+1);end=d.toISOString().slice(0,10);} return new Date(`${end}T${et}:00`);
  }
  async function renderEvents(root) {
    const rows = await list("events", { order:"event_date" });
    const current=rows.filter(r=>eventEnd(r)>new Date()), history=rows.filter(r=>eventEnd(r)<=new Date()).sort((a,b)=>String(b.event_date).localeCompare(String(a.event_date)));
    const shown=state.eventTab==="history"?history:current;
    root.innerHTML=`${!store.cloudEnabled?cloudNotice():""}<div class="tabs"><button class="${state.eventTab==="current"?"active":""}" data-event-tab="current">Текущие и будущие · ${current.length}</button><button class="${state.eventTab==="history"?"active":""}" data-event-tab="history">История событий · ${history.length}</button></div><section class="panel"><div class="panel-head"><div><h3>${state.eventTab==="history"?"История событий":"Активные события"}</h3><small>Завершённые события автоматически исчезают у пользователей</small></div></div>${shown.length?`<table class="data-table"><thead><tr><th>Событие</th><th>Дата</th><th>Время</th><th>Статус</th><th></th></tr></thead><tbody>${shown.map(r=>`<tr><td><strong>${esc(r.title)}</strong><br><small>${esc(r.description||"")}</small></td><td>${date(r.event_date)}</td><td>${time(r.event_time)}</td><td><span class="status ${state.eventTab==="history"?"completed":"available"}">${state.eventTab==="history"?"Завершено":r.active===false?"Скрыто":"Опубликовано"}</span></td><td><div class="row-actions"><button class="icon-btn" data-edit-event="${esc(r.id)}">✎</button><button class="icon-btn" data-delete-event="${esc(r.id)}">×</button></div></td></tr>`).join("")}</tbody></table>`:'<div class="empty">Событий нет</div>'}</section>`;
    root.addEventListener("click", async e => { const tab=e.target.closest("[data-event-tab]"); if(tab){state.eventTab=tab.dataset.eventTab;return renderEvents(root);} const edit=e.target.closest("[data-edit-event]"); if(edit)return editEvent(rows.find(r=>r.id===edit.dataset.editEvent)); const del=e.target.closest("[data-delete-event]"); if(del&&confirm("Удалить событие окончательно? История посещений пользователей сохранится.")){try{await store.remove("events",del.dataset.deleteEvent);toast("Событие удалено");renderEvents(root);}catch(error){toast(error.message||"Не удалось удалить");}} });
  }

  async function renderBookings(root) {
    const rows=await list("bookings"); rows.sort((a,b)=>`${b.booking_date}${b.booking_time}`.localeCompare(`${a.booking_date}${a.booking_time}`));
    root.innerHTML=`${!store.cloudEnabled?cloudNotice():""}<section class="panel"><div class="panel-head"><div><h3>Бронирования</h3><small>Подтверждение, отмена и удаление</small></div></div>${rows.length?`<table class="data-table"><thead><tr><th>Дата</th><th>Клиент</th><th>Стол</th><th>Гостей</th><th>Статус</th><th></th></tr></thead><tbody>${rows.map(r=>`<tr><td>${date(r.booking_date)}<br><small>${time(r.booking_time)}</small></td><td><strong>${esc(r.customer_name||r.name||"Гость")}</strong><br><small>${esc(r.phone||"")}</small></td><td>${esc(r.table_name||r.table_id||"—")}</td><td>${Number(r.guests||0)}</td><td><span class="status ${esc(r.status)}">${esc(r.status||"pending")}</span></td><td><div class="row-actions">${r.status==="pending"?`<button class="icon-btn" data-confirm-booking="${esc(r.id)}">✓</button>`:""}<button class="icon-btn" data-edit-booking="${esc(r.id)}">✎</button><button class="icon-btn" data-delete-booking="${esc(r.id)}">×</button></div></td></tr>`).join("")}</tbody></table>`:'<div class="empty">Броней пока нет</div>'}</section>`;
    root.addEventListener("click", async e=>{const confirmBtn=e.target.closest("[data-confirm-booking]");if(confirmBtn){const row=rows.find(x=>x.id===confirmBtn.dataset.confirmBooking);await store.save("bookings",{...row,status:"confirmed"});toast("Бронь подтверждена");return renderBookings(root);}const edit=e.target.closest("[data-edit-booking]");if(edit)return editBooking(rows.find(x=>x.id===edit.dataset.editBooking));const del=e.target.closest("[data-delete-booking]");if(del&&confirm("Удалить бронь?")){await store.remove("bookings",del.dataset.deleteBooking);toast("Бронь удалена");renderBookings(root);}});
  }

  async function renderCustomers(root) {
    const users=await list("app_users",{order:"last_seen_at",ascending:false}), customers=users.length?users:await list("customers");
    root.innerHTML=`${!store.cloudEnabled?cloudNotice():""}<section class="panel"><div class="panel-head"><div><h3>Клиенты</h3><small>${customers.length} человек в базе</small></div><input id="customerSearch" placeholder="Поиск"></div><div id="customerRows">${customerTable(customers)}</div></section>`;
    $("#customerSearch")?.addEventListener("input",e=>{const q=e.target.value.toLowerCase();$("#customerRows").innerHTML=customerTable(customers.filter(r=>`${r.name||""} ${r.phone||""} ${r.username||r.telegram||""}`.toLowerCase().includes(q)));});
  }
  function customerTable(rows){return rows.length?`<table class="data-table"><thead><tr><th>Клиент</th><th>Телефон</th><th>Telegram</th><th>Последний вход</th></tr></thead><tbody>${rows.map(r=>`<tr><td><strong>${esc(r.name||"Пользователь BALI")}</strong></td><td>${esc(r.phone||"—")}</td><td>${esc(r.username||r.telegram||"—")}</td><td>${dt(r.last_seen_at||r.updated_at)}</td></tr>`).join("")}</tbody></table>`:'<div class="empty">Клиентов пока нет</div>';}

  async function renderBonuses(root) {
    if(!store.cloudEnabled){root.innerHTML=cloudNotice("Баллы + VIP требуют рабочую базу");return;}
    const [accounts,vips,plans,ledger]=await Promise.all([list("points_accounts",{order:"updated_at",ascending:false}),list("vip_memberships",{order:"expires_at",ascending:false}),list("vip_plans"),list("points_ledger",{order:"created_at",ascending:false})]);
    root.innerHTML=`<div class="stats"><article class="stat-card"><span>ПОЛЬЗОВАТЕЛЕЙ С БАЛЛАМИ</span><strong>${accounts.length}</strong></article><article class="stat-card"><span>БАЛЛОВ В ОБОРОТЕ</span><strong>${accounts.reduce((s,r)=>s+Number(r.balance||0),0)}</strong></article><article class="stat-card"><span>АКТИВНЫХ VIP</span><strong>${vips.filter(r=>!r.expires_at||new Date(r.expires_at)>new Date()).length}</strong></article></div><section class="panel"><div class="panel-head"><div><h3>Баллы и VIP пользователей</h3><small>Начисление, списание и назначение статуса</small></div></div>${accounts.length?`<table class="data-table"><thead><tr><th>Пользователь</th><th>Баланс</th><th>VIP</th><th>Управление</th></tr></thead><tbody>${accounts.map(a=>{const vip=vips.find(v=>String(v.user_key)===String(a.user_key)&&(!v.expires_at||new Date(v.expires_at)>new Date()));return`<tr><td><strong>${esc(a.name||a.user_key)}</strong><br><small>${esc(a.telegram||a.phone||"")}</small></td><td><strong>${Number(a.balance||0)}</strong></td><td>${esc(vip?.plan_name||"Нет")}</td><td><div class="row-actions"><button class="ghost" data-points-user="${esc(a.user_key)}" data-points-delta="add">+ Баллы</button><button class="ghost" data-points-user="${esc(a.user_key)}" data-points-delta="remove">− Баллы</button><button class="ghost" data-vip-user="${esc(a.user_key)}">VIP</button></div></td></tr>`}).join("")}</tbody></table>`:'<div class="empty">Счета пользователей ещё не созданы</div>'}</section><section class="panel"><div class="panel-head"><h3>Последние операции</h3></div><div class="panel-body">${ledger.slice(0,30).map(r=>`<div class="booking-row"><div><strong>${esc(r.title||"Операция")}</strong><p>${esc(r.user_key||"")} · ${dt(r.created_at)}</p></div><b>${Number(r.amount||0)>0?"+":""}${Number(r.amount||0)}</b></div>`).join("")||'<div class="empty">Операций нет</div>'}</div></section>`;
    root.addEventListener("click",async e=>{const p=e.target.closest("[data-points-user]");if(p){const raw=prompt(p.dataset.pointsDelta==="add"?"Сколько баллов начислить?":"Сколько баллов списать?");const value=Number(raw);if(!value)return;const delta=p.dataset.pointsDelta==="add"?Math.abs(value):-Math.abs(value);try{const{data,error}=await store.client.rpc("admin_adjust_points",{p_user_key:p.dataset.pointsUser,p_delta:delta,p_note:"Корректировка администратора"});if(error)throw error;toast("Баллы обновлены");renderBonuses(root);}catch(error){toast(error.message||"Ошибка баллов");}}const v=e.target.closest("[data-vip-user]");if(v){const options=plans.map((p,i)=>`${i+1}. ${p.name}`).join("\n");const chosen=Number(prompt(`Выберите VIP:\n${options}`))-1;if(!plans[chosen])return;try{const{error}=await store.client.rpc("admin_set_vip",{p_user_key:v.dataset.vipUser,p_plan_id:plans[chosen].id,p_days:Number(plans[chosen].days||30)});if(error)throw error;toast("VIP назначен");renderBonuses(root);}catch(error){toast(error.message||"Ошибка VIP");}}});
  }

  async function renderMenu(root){const rows=await list("menu_items",{order:"sort_order"});root.innerHTML=`${!store.cloudEnabled?cloudNotice():""}<section class="panel"><div class="panel-head"><h3>Меню</h3></div>${rows.length?`<table class="data-table"><tbody>${rows.map(r=>`<tr><td><strong>${esc(r.name)}</strong><br><small>${esc(r.category||"")}</small></td><td>${money(r.price)}</td><td><div class="row-actions"><button class="icon-btn" data-edit-menu="${esc(r.id)}">✎</button><button class="icon-btn" data-delete-menu="${esc(r.id)}">×</button></div></td></tr>`).join("")}</tbody></table>`:'<div class="empty">Меню пусто</div>'}</section>`;root.addEventListener("click",async e=>{const edit=e.target.closest("[data-edit-menu]");if(edit)return editMenu(rows.find(x=>x.id===edit.dataset.editMenu));const del=e.target.closest("[data-delete-menu]");if(del&&confirm("Удалить позицию?")){await store.remove("menu_items",del.dataset.deleteMenu);renderMenu(root);}});}
  async function renderHall(root){const rows=await list("hall_tables");root.innerHTML=`${!store.cloudEnabled?cloudNotice():""}<section class="panel"><div class="panel-head"><h3>Схемы и столы</h3></div>${rows.length?`<table class="data-table"><tbody>${rows.map(r=>`<tr><td><strong>${esc(r.name)}</strong></td><td>${Number(r.seats||0)} мест</td><td>${esc(r.shape||"round")}</td><td><button class="icon-btn" data-edit-table="${esc(r.id)}">✎</button></td></tr>`).join("")}</tbody></table>`:'<div class="empty">Столы не настроены</div>'}</section>`;root.addEventListener("click",e=>{const b=e.target.closest("[data-edit-table]");if(b)editTable(rows.find(x=>x.id===b.dataset.editTable));});}
  function renderSettings(root){root.innerHTML=`<section class="panel"><div class="panel-head"><div><h3>Production-конфигурация</h3><small>Демонстрационный режим удалён</small></div></div><div class="panel-body steps"><div class="step"><b>1</b><div><strong>Supabase</strong><p>${store.cloudEnabled?"Подключён":"Не подключён: заполните supabaseUrl и supabaseAnonKey"}</p></div></div><div class="step"><b>2</b><div><strong>SQL-схема</strong><p><a href="/bali-production-schema.sql" target="_blank">Открыть единую production-схему</a></p></div></div><div class="step"><b>3</b><div><strong>Telegram</strong><p>Бот: @${esc(cfg.telegramUsername||"BaliMinskAppBot")}. Токен хранится только в Supabase Secrets.</p></div></div></div></section>`;}

  function editForm(title, fields, row, save) { const d=ensureDialog(); $("#productionAdminDialogBody").innerHTML=`<div><span class="eyebrow">${row?.id?"РЕДАКТИРОВАНИЕ":"НОВАЯ ЗАПИСЬ"}</span><h3>${esc(title)}</h3></div><form id="productionEditor" class="editor-fields">${fields.map(f=>{const [name,label,type="text",required=false]=f;const value=row?.[name]??"";if(type==="textarea")return`<label class="full"><span>${esc(label)}</span><textarea name="${name}" ${required?"required":""}>${esc(value)}</textarea></label>`;if(type==="checkbox")return`<label class="check-row full"><input name="${name}" type="checkbox" ${value!==false?"checked":""}><span>${esc(label)}</span></label>`;return`<label><span>${esc(label)}</span><input name="${name}" type="${type}" value="${esc(value)}" ${required?"required":""}></label>`}).join("")}<button class="primary full">Сохранить</button></form>`;$("#productionEditor").addEventListener("submit",async e=>{e.preventDefault();const fd=new FormData(e.currentTarget),payload={...(row||{})};for(const[k,v]of fd.entries())payload[k]=v;fields.filter(f=>f[2]==="checkbox").forEach(f=>payload[f[0]]=e.currentTarget.elements[f[0]].checked);try{await save(payload);d.close();toast("Сохранено");render();}catch(error){toast(error.message||"Ошибка сохранения");}});d.showModal(); }
  function editEvent(row={}){editForm("Событие",[["title","Название","text",true],["event_date","Дата","date",true],["event_time","Начало","time",true],["event_end_date","Дата окончания","date"],["event_end_time","Окончание","time"],["image_url","Изображение","url"],["description","Описание","textarea"],["active","Опубликовать","checkbox"]],row,p=>store.save("events",p));}
  function editBooking(row={}){editForm("Бронирование",[["booking_date","Дата","date",true],["booking_time","Время","time",true],["customer_name","Имя","text",true],["phone","Телефон","tel",true],["guests","Гостей","number",true],["table_id","ID стола","text"],["comment","Комментарий","textarea"]],row,p=>row.id?store.save("bookings",{...p,guests:Number(p.guests||0)}):store.createBooking({...p,name:p.customer_name,guests:Number(p.guests||0)}));}
  function editMenu(row={}){editForm("Позиция меню",[["name","Название","text",true],["category","Категория","text",true],["price","Цена","number",true],["description","Описание","textarea"],["active","Показывать","checkbox"]],row,p=>store.save("menu_items",{...p,price:Number(p.price||0)}));}
  function editTable(row={}){editForm("Стол",[["name","Название","text",true],["seats","Мест","number",true],["shape","Форма","text"],["active","Активен","checkbox"]],row,p=>store.save("hall_tables",{...p,seats:Number(p.seats||0)}));}

  document.addEventListener("click",async e=>{const c=e.target.closest("[data-confirm-booking]");if(c&&state.view==="dashboard"){const rows=await list("bookings");const row=rows.find(x=>x.id===c.dataset.confirmBooking);if(row){await store.save("bookings",{...row,status:"confirmed"});toast("Бронь подтверждена");render();}}const a=e.target.closest("[data-chip-approve]");if(a){const rows=await list("chip_requests");const row=rows.find(x=>x.id===a.dataset.chipApprove);if(row){await store.save("chip_requests",{...row,status:"fulfilled",fulfilled_at:new Date().toISOString(),fulfilled_by:LOGIN});toast("Фишки отмечены как выданные");render();}}const r=e.target.closest("[data-chip-reject]");if(r){const rows=await list("chip_requests");const row=rows.find(x=>x.id===r.dataset.chipReject);if(row){await store.save("chip_requests",{...row,status:"cancelled",cancelled_at:new Date().toISOString(),cancelled_by:LOGIN});toast("Заявка отклонена");render();}}});

  if (sessionStorage.getItem(SESSION) === "1") openApp();
})();