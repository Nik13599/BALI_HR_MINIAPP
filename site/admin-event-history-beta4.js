(() => {
  if (window.__BALI_ADMIN_EVENT_HISTORY__ || !window.BaliStore) return;
  window.__BALI_ADMIN_EVENT_HISTORY__ = true;
  const store = window.BaliStore;
  const lifecycle = window.BaliEventLifecycle || {
    isCompleted(event) {
      const start = new Date(`${event.event_date || ""}T${event.event_time || "23:00"}:00`);
      if (Number.isNaN(start.getTime())) return false;
      const end = new Date(start);
      end.setHours(end.getHours() + 8);
      return end.getTime() <= Date.now();
    }
  };
  const esc = (value = "") => String(value).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const formatDate = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString("ru-RU", { day:"2-digit", month:"long", year:"numeric" }) : "—";

  function eventTable(rows, history = false) {
    if (!rows.length) return `<div class="empty">${history ? "История событий пока пуста" : "Активных событий пока нет"}</div>`;
    return `<table class="data-table"><thead><tr><th>Событие</th><th>Дата</th><th>Время</th><th>Статус</th><th></th></tr></thead><tbody>${rows.map(row => `<tr><td><strong>${esc(row.title)}</strong><br><small>${esc(row.description || "")}</small></td><td>${formatDate(row.event_date)}</td><td>${esc(row.event_time || "23:00")}</td><td><span class="status ${history ? "completed" : row.active !== false ? "available" : "pending"}">${history ? "Завершено" : row.active !== false ? "Опубликовано" : "Скрыто"}</span></td><td><div class="row-actions"><button class="icon-btn" data-edit="events" data-id="${esc(row.id)}" title="Редактировать">✎</button><button class="icon-btn" data-delete="events" data-id="${esc(row.id)}" title="Удалить событие">×</button></div></td></tr>`).join("")}</tbody></table>`;
  }

  async function renderEventsWithHistory(root) {
    const rows = await (store.listAll ? store.listAll("events", { order:"event_date" }) : store.list("events", { order:"event_date", includeCompleted:true }));
    const active = rows.filter(row => !lifecycle.isCompleted(row)).sort((a,b) => `${a.event_date || ""}T${a.event_time || ""}`.localeCompare(`${b.event_date || ""}T${b.event_time || ""}`));
    const history = rows.filter(row => lifecycle.isCompleted(row)).sort((a,b) => `${b.event_date || ""}T${b.event_time || ""}`.localeCompare(`${a.event_date || ""}T${a.event_time || ""}`));
    root.innerHTML = `<section class="panel"><div class="panel-head"><div><h3>Текущие и будущие события</h3><small>${active.length} событий показываются пользователям</small></div></div>${eventTable(active)}</section><section class="panel"><div class="panel-head"><div><h3>История событий</h3><small>${history.length} завершённых событий · доступны только в админке</small></div></div>${eventTable(history, true)}</section>`;
  }

  const install = () => {
    if (typeof window.renderEvents !== "function") return false;
    window.renderEvents = renderEventsWithHistory;
    return true;
  };
  if (!install()) {
    let attempts = 0;
    const timer = setInterval(() => { attempts += 1; if (install() || attempts > 30) clearInterval(timer); }, 100);
  }
})();