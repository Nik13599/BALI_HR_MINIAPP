(() => {
  if (window.__BALI_ADMIN_EVENT_HISTORY__ || !window.BaliStore) return;
  window.__BALI_ADMIN_EVENT_HISTORY__ = true;
  const store=window.BaliStore;
  const lifecycle=window.BaliEventLifecycle||{isCompleted(event){const start=new Date(`${event.event_date||""}T${event.event_time||"23:00"}:00+03:00`);if(Number.isNaN(start.getTime()))return false;const end=new Date(start.getTime()+8*3600000);return end.getTime()<=Date.now()}};
  const esc=(v="")=>String(v).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const formatDate=value=>value?new Date(`${String(value).slice(0,10)}T12:00:00+03:00`).toLocaleDateString("ru-RU",{day:"2-digit",month:"long",year:"numeric"}):"—";
  const performers=value=>{if(Array.isArray(value))return value;if(!value)return[];try{const rows=JSON.parse(value);return Array.isArray(rows)?rows:[]}catch{return[]}};

  function table(rows,history=false){
    if(!rows.length)return`<div class="empty">${history?"История событий пока пуста":"Активных событий пока нет"}</div>`;
    return `<table class="data-table"><thead><tr><th>Афиша</th><th>Событие</th><th>Участники</th><th>Дата / время</th><th>Статус</th><th></th></tr></thead><tbody>${rows.map(row=>{const artists=performers(row.performers);return`<tr><td>${row.image_url?`<img class="poster-admin-thumb" src="${esc(row.image_url)}" alt="${esc(row.title)}">`:'<div class="poster-admin-empty">НЕТ<br>ФОТО</div>'}</td><td><strong>${esc(row.title||"Событие BALI")}</strong><br><small>${esc(row.description||"")}</small></td><td><b class="event-lineup-count">${artists.length}</b><br><small>${artists.slice(0,2).map(a=>esc(`${a.role||"Артист"}: ${a.name||"без имени"}`)).join(" · ")||"Не добавлены"}</small></td><td>${formatDate(row.event_date)}<br><small>${esc(row.event_time||"23:00")}</small></td><td><span class="status ${history?"completed":row.active!==false?"available":"pending"}">${history?"Завершено":row.active!==false?"Опубликовано":"Скрыто"}</span></td><td><div class="row-actions"><button class="icon-btn" type="button" data-event-qr="${esc(row.id)}" title="QR-код входа">QR</button><button class="icon-btn" type="button" data-edit="events" data-id="${esc(row.id)}" title="Редактировать">✎</button><button class="icon-btn" type="button" data-delete="events" data-id="${esc(row.id)}" title="Удалить событие">×</button></div></td></tr>`}).join("")}</tbody></table>`;
  }
  async function renderEventsWithHistory(root){
    const rows=await(store.listAll?store.listAll("events",{order:"event_date"}):store.list("events",{order:"event_date",includeCompleted:true}));
    const active=rows.filter(row=>!lifecycle.isCompleted(row)).sort((a,b)=>`${a.event_date||""}T${a.event_time||""}`.localeCompare(`${b.event_date||""}T${b.event_time||""}`));
    const history=rows.filter(row=>lifecycle.isCompleted(row)).sort((a,b)=>`${b.event_date||""}T${b.event_time||""}`.localeCompare(`${a.event_date||""}T${a.event_time||""}`));
    root.innerHTML=`<section class="panel"><div class="panel-head"><div><h3>Текущие и будущие события</h3><small>${active.length} событий доступны для управления</small></div><button class="ghost" data-new="events">Добавить событие</button></div>${table(active)}</section><section class="panel"><div class="panel-head"><div><h3>История событий</h3><small>${history.length} завершённых событий · пользователи их больше не видят</small></div></div>${table(history,true)}</section>`;
  }
  const install=()=>{if(typeof window.renderEvents!=="function")return false;window.renderEvents=renderEventsWithHistory;return true};
  if(!install()){let attempts=0;const timer=setInterval(()=>{attempts++;if(install()||attempts>30)clearInterval(timer)},100)}
})();