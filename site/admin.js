const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const store = window.BaliStore;
const state = { view: "dashboard", editing: null, hallDate: new Date().toISOString().slice(0, 10) };

const titles = {
  dashboard: "Обзор",
  menu: "Меню",
  events: "Афиши",
  hall: "Рассадка зала",
  bookings: "Бронирования",
  customers: "Клиентская база",
  settings: "Настройки"
};
const statusLabels = { pending: "Ожидает", confirmed: "Подтверждено", seated: "Гости в клубе", completed: "Завершено", cancelled: "Отменено" };
const esc = (value = "") => String(value).replace(/[&<>'"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[ch]));
const formatDate = (value) => value ? new Date(`${value}T12:00:00`).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const money = (value) => `${Number(value || 0).toLocaleString("ru-RU")} BYN`;

function toast(message) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove("show"), 2400);
}

function openApp() {
  $("#loginView").classList.add("hidden");
  $("#appView").classList.remove("hidden");
  $("#modeBadge").textContent = store.cloudEnabled ? "ОБЛАКО" : "ДЕМО";
  $("#modeBadge").classList.toggle("cloud", store.cloudEnabled);
  render();
}

$("#demoLogin").addEventListener("click", openApp);
$("#loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    await store.signIn(form.get("email"), form.get("password"));
    openApp();
  } catch (error) { toast(error.message || "Не удалось войти"); }
});
$("#logoutButton").addEventListener("click", async () => { await store.signOut(); location.reload(); });

$("#adminNav").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-view]");
  if (!button) return;
  state.view = button.dataset.view;
  $$("#adminNav button").forEach((item) => item.classList.toggle("active", item === button));
  render();
});

$("#primaryAction").addEventListener("click", () => {
  if (state.view === "dashboard") return setView("bookings", true);
  if (state.view === "settings") return window.open("./supabase-schema.sql", "_blank");
  const type = state.view === "hall" ? "hall_tables" : state.view === "menu" ? "menu_items" : state.view;
  openEditor(type);
});

function setView(view, openNew = false) {
  state.view = view;
  $$("#adminNav button").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  render().then(() => { if (openNew) openEditor(view); });
}

async function render() {
  $("#pageTitle").textContent = titles[state.view];
  const action = $("#primaryAction");
  action.style.display = "inline-flex";
  action.textContent = ({ dashboard: "Новая бронь", menu: "Добавить позицию", events: "Добавить афишу", hall: "Добавить стол", bookings: "Новая бронь", customers: "Добавить клиента", settings: "Открыть SQL" })[state.view];
  const content = $("#content");
  content.innerHTML = '<div class="empty">Загрузка…</div>';
  try {
    if (state.view === "dashboard") await renderDashboard(content);
    if (state.view === "menu") await renderMenu(content);
    if (state.view === "events") await renderEvents(content);
    if (state.view === "hall") await renderHall(content);
    if (state.view === "bookings") await renderBookings(content);
    if (state.view === "customers") await renderCustomers(content);
    if (state.view === "settings") renderSettings(content);
  } catch (error) {
    content.innerHTML = `<div class="panel"><div class="empty">Ошибка загрузки: ${esc(error.message)}</div></div>`;
  }
}

async function renderDashboard(root) {
  const [menu, events, tables, bookings, customers] = await Promise.all([
    store.list("menu_items"), store.list("events"), store.list("hall_tables"), store.list("bookings"), store.list("customers")
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = bookings.filter((b) => b.booking_date >= today && !["cancelled", "completed"].includes(b.status)).sort((a, b) => `${a.booking_date}${a.booking_time}`.localeCompare(`${b.booking_date}${b.booking_time}`));
  const confirmedToday = bookings.filter((b) => b.booking_date === today && ["confirmed", "seated"].includes(b.status));
  root.innerHTML = `
    <div class="stats">
      <article class="stat-card"><span>БРОНИ СЕГОДНЯ</span><strong>${confirmedToday.length}</strong><em>${confirmedToday.reduce((s,b)=>s+Number(b.guests||0),0)} гостей</em></article>
      <article class="stat-card"><span>КЛИЕНТОВ В БАЗЕ</span><strong>${customers.length}</strong><em>CRM клуба</em></article>
      <article class="stat-card"><span>АКТИВНЫХ СТОЛОВ</span><strong>${tables.filter(t=>t.active!==false).length}</strong><em>на схеме зала</em></article>
      <article class="stat-card"><span>ПОЗИЦИЙ МЕНЮ</span><strong>${menu.filter(i=>i.active!==false).length}</strong><em>${events.filter(e=>e.active!==false).length} афиши</em></article>
    </div>
    <div class="dashboard-grid">
      <section class="panel"><div class="panel-head"><h3>Ближайшие бронирования</h3><button class="ghost" data-new="bookings">Добавить</button></div><div class="panel-body">${upcoming.length ? upcoming.slice(0,8).map(bookingRow).join("") : '<div class="empty">Бронирований пока нет</div>'}</div></section>
      <section class="panel"><div class="panel-head"><h3>Состояние системы</h3></div><div class="panel-body steps">
        <div class="step"><b>1</b><div><strong>${store.cloudEnabled ? "Облачная база подключена" : "Демонстрационный режим"}</strong><p>${store.cloudEnabled ? "Данные синхронизируются между устройствами." : "Данные хранятся только в текущем браузере."}</p></div></div>
        <div class="step"><b>2</b><div><strong>Гостевое приложение</strong><p>Афиши, меню и доступные столы читаются из той же базы.</p></div></div>
        <div class="step"><b>3</b><div><strong>Клиентская база</strong><p>Новый клиент создаётся автоматически при бронировании.</p></div></div>
      </div></section>
    </div>`;
}

function bookingRow(booking) {
  return `<div class="booking-row"><div class="booking-time">${esc(booking.booking_time || "23:00")}</div><div><strong>${esc(booking.customer_name)}</strong><p>${formatDate(booking.booking_date)} · ${booking.guests} гостей · ${esc(booking.phone)}</p></div><span class="status ${esc(booking.status)}">${statusLabels[booking.status] || booking.status}</span></div>`;
}

async function renderMenu(root) {
  const rows = await store.list("menu_items", { order: "sort_order" });
  const categories = [...new Set(rows.map((r) => r.category))];
  root.innerHTML = `<section class="panel"><div class="panel-head"><div><h3>Позиции меню</h3><small>${rows.length} позиций · ${categories.length} категорий</small></div><div class="filter-bar"><input id="menuSearch" placeholder="Поиск по меню"/><select id="categoryFilter"><option value="">Все категории</option>${categories.map(c=>`<option>${esc(c)}</option>`).join("")}</select></div></div><div id="menuTable">${menuTable(rows)}</div></section>`;
  const apply = () => {
    const q = $("#menuSearch").value.toLowerCase(); const cat = $("#categoryFilter").value;
    $("#menuTable").innerHTML = menuTable(rows.filter(r => (!cat || r.category===cat) && (!q || `${r.name} ${r.description}`.toLowerCase().includes(q))));
  };
  $("#menuSearch").addEventListener("input", apply); $("#categoryFilter").addEventListener("change", apply);
}
function menuTable(rows) {
  return rows.length ? `<table class="data-table"><thead><tr><th>Название</th><th>Категория</th><th>Цена</th><th>Статус</th><th></th></tr></thead><tbody>${rows.map(r=>`<tr><td><strong>${esc(r.name)}</strong><br><small>${esc(r.description)}</small></td><td>${esc(r.category)}</td><td>${money(r.price)}</td><td><span class="status ${r.active!==false?'available':'completed'}">${r.active!==false?'Показывается':'Скрыто'}</span></td><td><div class="row-actions"><button class="icon-btn" data-edit="menu_items" data-id="${r.id}">✎</button><button class="icon-btn" data-delete="menu_items" data-id="${r.id}">×</button></div></td></tr>`).join("")}</tbody></table>` : '<div class="empty">Позиции не найдены</div>';
}

async function renderEvents(root) {
  const rows = await store.list("events", { order: "sort_order" });
  root.innerHTML = `<section class="panel"><div class="panel-head"><div><h3>Афиши и события</h3><small>Управление карточками в гостевом приложении</small></div></div>${rows.length ? `<table class="data-table"><thead><tr><th>Событие</th><th>Дата</th><th>Время</th><th>Статус</th><th></th></tr></thead><tbody>${rows.map(r=>`<tr><td><strong>${esc(r.title)}</strong><br><small>${esc(r.description)}</small></td><td>${formatDate(r.event_date)}</td><td>${esc(r.event_time)}</td><td><span class="status ${r.active!==false?'available':'completed'}">${r.active!==false?'Опубликовано':'Черновик'}</span></td><td><div class="row-actions"><button class="icon-btn" data-edit="events" data-id="${r.id}">✎</button><button class="icon-btn" data-delete="events" data-id="${r.id}">×</button></div></td></tr>`).join("")}</tbody></table>` : '<div class="empty">Афиш пока нет</div>'}</section>`;
}

async function renderBookings(root) {
  const rows = await store.list("bookings");
  const dates = [...new Set(rows.map(r=>r.booking_date))].sort();
  root.innerHTML = `<section class="panel"><div class="panel-head"><div><h3>Журнал бронирований</h3><small>Свободные и занятые столы по датам</small></div><div class="filter-bar"><input id="bookingDateFilter" type="date"/><select id="bookingStatusFilter"><option value="">Все статусы</option>${Object.entries(statusLabels).map(([v,l])=>`<option value="${v}">${l}</option>`).join("")}</select></div></div><div id="bookingTable">${bookingsTable(rows)}</div></section>`;
  const apply=()=>{const d=$("#bookingDateFilter").value,s=$("#bookingStatusFilter").value;$("#bookingTable").innerHTML=bookingsTable(rows.filter(r=>(!d||r.booking_date===d)&&(!s||r.status===s)));};
  $("#bookingDateFilter").addEventListener("change",apply);$("#bookingStatusFilter").addEventListener("change",apply);
}
function bookingsTable(rows) {
  rows = [...rows].sort((a,b)=>`${b.booking_date}${b.booking_time}`.localeCompare(`${a.booking_date}${a.booking_time}`));
  return rows.length ? `<table class="data-table"><thead><tr><th>Дата / время</th><th>Клиент</th><th>Стол</th><th>Гостей</th><th>Статус</th><th></th></tr></thead><tbody>${rows.map(r=>`<tr><td><strong>${formatDate(r.booking_date)}</strong><br><small>${esc(r.booking_time)}</small></td><td><strong>${esc(r.customer_name)}</strong><br><small>${esc(r.phone)}</small></td><td>${esc(r.table_name || r.table_id || '—')}</td><td>${r.guests}</td><td><span class="status ${esc(r.status)}">${statusLabels[r.status]||r.status}</span></td><td><div class="row-actions"><button class="icon-btn" data-edit="bookings" data-id="${r.id}">✎</button><button class="icon-btn" data-delete="bookings" data-id="${r.id}">×</button></div></td></tr>`).join("")}</tbody></table>` : '<div class="empty">Бронирований не найдено</div>';
}

async function renderCustomers(root) {
  const rows = await store.list("customers");
  root.innerHTML = `<section class="panel"><div class="panel-head"><div><h3>Клиентская база</h3><small>Контакты, заметки и история посещений</small></div><div class="filter-bar"><input id="customerSearch" placeholder="Имя или телефон"/></div></div><div id="customerTable">${customersTable(rows)}</div></section>`;
  $("#customerSearch").addEventListener("input",e=>{const q=e.target.value.toLowerCase();$("#customerTable").innerHTML=customersTable(rows.filter(r=>`${r.name} ${r.phone} ${r.telegram}`.toLowerCase().includes(q)));});
}
function customersTable(rows) {
  return rows.length ? `<table class="data-table"><thead><tr><th>Клиент</th><th>Телефон</th><th>Telegram</th><th>Посещения</th><th>Сумма</th><th></th></tr></thead><tbody>${rows.map(r=>`<tr><td><strong>${esc(r.name)}</strong><br><small>${esc(r.notes||'Без заметок')}</small></td><td>${esc(r.phone)}</td><td>${esc(r.telegram||'—')}</td><td>${Number(r.visits||0)}</td><td>${money(r.total_spent)}</td><td><div class="row-actions"><button class="icon-btn" data-edit="customers" data-id="${r.id}">✎</button><button class="icon-btn" data-delete="customers" data-id="${r.id}">×</button></div></td></tr>`).join("")}</tbody></table>` : '<div class="empty">Клиентская база пока пуста. Клиенты добавляются автоматически при бронировании.</div>';
}

async function renderHall(root) {
  const availability = await store.getAvailability(state.hallDate);
  root.innerHTML = `<section class="panel"><div class="panel-head"><div><h3>Схема зала</h3><small>Перетаскивайте столы для изменения рассадки</small></div><div class="filter-bar"><input id="hallDate" type="date" value="${state.hallDate}"/><button class="ghost" data-new="bookings">Создать бронь</button></div></div><div class="panel-body"><div id="hallLayout" class="hall-layout">${availability.map(t=>`<button class="table-node ${esc(t.shape||'round')} ${t.available?'':'booked'}" style="left:${Number(t.x)}%;top:${Number(t.y)}%" data-table-id="${t.id}" title="${t.booking?`${esc(t.booking.customer_name)} · ${esc(t.booking.phone)}`:'Свободен'}"><b>${esc(t.name)}</b><small>${t.seats} мест<br>${t.available?'свободен':statusLabels[t.booking.status]||'занят'}</small></button>`).join("")}</div><div class="hall-legend"><span><i class="legend-dot"></i>Свободен</span><span><i class="legend-dot red"></i>Забронирован</span><span><i class="legend-dot gold"></i>VIP</span><span>Двойной клик — изменить стол</span></div></div></section>`;
  $("#hallDate").addEventListener("change",e=>{state.hallDate=e.target.value;renderHall(root);});
  enableHallDragging();
}

function enableHallDragging() {
  const layout = $("#hallLayout");
  $$(".table-node", layout).forEach(node => {
    let dragging=false;
    node.addEventListener("pointerdown",e=>{dragging=true;node.setPointerCapture(e.pointerId);});
    node.addEventListener("pointermove",e=>{if(!dragging)return;const r=layout.getBoundingClientRect();const x=Math.max(4,Math.min(96,(e.clientX-r.left)/r.width*100));const y=Math.max(8,Math.min(94,(e.clientY-r.top)/r.height*100));node.style.left=`${x}%`;node.style.top=`${y}%`;});
    node.addEventListener("pointerup",async()=>{if(!dragging)return;dragging=false;const tables=await store.list("hall_tables");const table=tables.find(t=>t.id===node.dataset.tableId);if(table){await store.save("hall_tables",{...table,x:parseFloat(node.style.left),y:parseFloat(node.style.top)});toast("Положение стола сохранено");}});
    node.addEventListener("dblclick",async()=>{const tables=await store.list("hall_tables");openEditor("hall_tables",tables.find(t=>t.id===node.dataset.tableId));});
    node.addEventListener("click",async()=>{if(node.classList.contains("booked"))return;openEditor("bookings",{booking_date:state.hallDate,table_id:node.dataset.tableId,status:"confirmed",booking_time:"23:00",guests:2});});
  });
}

function renderSettings(root) {
  const cfg=window.BALI_CONFIG||{};
  root.innerHTML=`<div class="settings-grid"><section class="panel"><div class="panel-head"><h3>Подключение общей базы</h3></div><div class="panel-body steps">
    <div class="step"><b>1</b><div><strong>Создайте проект Supabase</strong><p>Нужны URL проекта и publishable/anon key.</p></div></div>
    <div class="step"><b>2</b><div><strong>Запустите SQL-схему</strong><p>Откройте файл <a href="./supabase-schema.sql" target="_blank">supabase-schema.sql</a> и выполните его в SQL Editor.</p></div></div>
    <div class="step"><b>3</b><div><strong>Заполните config.js</strong><p>После этого админ-панель и гостевое приложение будут использовать одну базу.</p></div></div>
    <button class="danger" id="resetDemo">Сбросить демонстрационные данные</button>
  </div></section><section class="panel"><div class="panel-head"><h3>Текущая конфигурация</h3></div><div class="panel-body"><div class="code-box">window.BALI_CONFIG = {<br>  supabaseUrl: "${esc(cfg.supabaseUrl||'')}",<br>  supabaseAnonKey: "${cfg.supabaseAnonKey?'••••••••':'Строка не заполнена'}",<br>  telegramUsername: "${esc(cfg.telegramUsername||'')}"<br>};</div><p class="muted">Никогда не размещайте service_role key в браузере. Для сайта используется только publishable/anon key вместе с RLS-политиками.</p></div></section></div>`;
  $("#resetDemo").addEventListener("click",()=>{if(confirm("Удалить все демонстрационные изменения?"))store.resetDemo();});
}

const editorDefinitions = {
  menu_items: { title: "Позиция меню", fields: [
    ["name","Название","text",true],["category","Категория","text",true],["price","Цена, BYN","number",true],["sort_order","Порядок","number"],["description","Описание","textarea",false,"full"],["active","Показывать гостям","checkbox"]
  ]},
  events: { title: "Афиша", fields: [
    ["title","Название события","text",true],["event_date","Дата","date",true],["event_time","Время","time",true],["sort_order","Порядок","number"],["image_url","Ссылка на изображение","url",false,"full"],["description","Описание","textarea",false,"full"],["active","Опубликовать","checkbox"]
  ]},
  hall_tables: { title: "Стол", fields: [
    ["name","Название","text",true],["seats","Количество мест","number",true],["shape","Форма","select",true,"",[["round","Круглый"],["square","Квадратный"],["vip","VIP-диван"]]],["active","Активен","checkbox"]
  ]},
  customers: { title: "Клиент", fields: [
    ["name","Имя","text",true],["phone","Телефон","tel",true],["telegram","Telegram","text"],["visits","Посещения","number"],["total_spent","Сумма покупок","number"],["notes","Заметки","textarea",false,"full"]
  ]}
};

async function openEditor(type, row = null) {
  if (type === "bookings") return openBookingEditor(row);
  const def=editorDefinitions[type]; if(!def)return;
  state.editing={type,row:row||{}};
  $("#editorEyebrow").textContent=row?.id?"РЕДАКТИРОВАНИЕ":"НОВАЯ ЗАПИСЬ";
  $("#editorTitle").textContent=def.title;
  $("#editorFields").innerHTML=def.fields.map(([name,label,inputType,required,cls,options])=>fieldHtml(name,label,inputType,row?.[name],required,cls,options)).join("");
  $("#editorDialog").showModal();
}

async function openBookingEditor(row={}) {
  const tables=await store.list("hall_tables");
  state.editing={type:"bookings",row:row||{}};
  $("#editorEyebrow").textContent=row?.id?"РЕДАКТИРОВАНИЕ":"НОВАЯ БРОНЬ";
  $("#editorTitle").textContent="Бронирование стола";
  const fields=[
    ["booking_date","Дата","date",true],["booking_time","Время","time",true],["table_id","Стол","select",true,"",tables.map(t=>[t.id,`${t.name} · ${t.seats} мест`])],["status","Статус","select",true,"",Object.entries(statusLabels)],["name","Имя клиента","text",true],["phone","Телефон","tel",true],["guests","Количество гостей","number",true],["telegram","Telegram","text"],["comment","Комментарий","textarea",false,"full"]
  ];
  $("#editorFields").innerHTML=fields.map(([n,l,t,r,c,o])=>fieldHtml(n,l,t,row?.[n]??row?.[n==='name'?'customer_name':n],r,c,o)).join("");
  $("#editorDialog").showModal();
}

function fieldHtml(name,label,type,value,required,cls="",options=[]) {
  if(type==="checkbox")return `<label class="check-row full"><input name="${name}" type="checkbox" ${value!==false?'checked':''}/><span>${label}</span></label>`;
  if(type==="textarea")return `<label class="${cls}"><span>${label}</span><textarea name="${name}" ${required?'required':''}>${esc(value||'')}</textarea></label>`;
  if(type==="select")return `<label class="${cls}"><span>${label}</span><select name="${name}" ${required?'required':''}>${options.map(([v,l])=>`<option value="${esc(v)}" ${String(value??'')===String(v)?'selected':''}>${esc(l)}</option>`).join('')}</select></label>`;
  return `<label class="${cls}"><span>${label}</span><input name="${name}" type="${type}" value="${esc(value??'')}" ${required?'required':''}/></label>`;
}

$("#editorForm").addEventListener("submit",async event=>{
  event.preventDefault();
  const form=new FormData(event.currentTarget),{type,row}=state.editing;
  const payload={...row};
  for(const [key,value] of form.entries()) payload[key]=value;
  $$('#editorFields input[type="checkbox"]').forEach(input=>payload[input.name]=input.checked);
  ["price","sort_order","seats","visits","total_spent","guests"].forEach(k=>{if(payload[k]!==undefined)payload[k]=Number(payload[k]);});
  try{
    if(type==="bookings"){
      const tables=await store.list("hall_tables");payload.table_name=tables.find(t=>t.id===payload.table_id)?.name||payload.table_id;
      if(row.id) await store.save("bookings",{...payload,customer_name:payload.name}); else await store.createBooking(payload);
    } else await store.save(type,payload);
    $("#editorDialog").close();toast("Сохранено");render();
  }catch(error){toast(error.message||"Ошибка сохранения");}
});

$$('[data-close]').forEach(button=>button.addEventListener('click',()=>$("#editorDialog").close()));
$("#content").addEventListener("click",async event=>{
  const edit=event.target.closest("[data-edit]");const del=event.target.closest("[data-delete]");const add=event.target.closest("[data-new]");
  if(add)return openEditor(add.dataset.new);
  if(edit){const rows=await store.list(edit.dataset.edit);return openEditor(edit.dataset.edit,rows.find(r=>r.id===edit.dataset.id));}
  if(del&&confirm("Удалить запись без возможности восстановления?")){await store.remove(del.dataset.delete,del.dataset.id);toast("Удалено");render();}
});

(async()=>{
  if(store.cloudEnabled){const session=await store.getSession();$("#loginHint").textContent="Войдите учётной записью администратора Supabase.";if(session?.user)openApp();}
})();
