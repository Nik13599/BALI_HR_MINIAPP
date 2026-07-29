(() => {
  "use strict";
  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;"
  })[char]);
  const fmt = value => value ? new Date(value).toLocaleString("ru-RU") : "—";
  const state = { chats:[], activeClanId:"", detail:null, permissions:[], view:"chats", detailTab:"overview" };
  const loginView = document.getElementById("adminLogin");
  const appView = document.getElementById("adminApp");
  const content = document.getElementById("adminContent");
  const toastNode = document.getElementById("adminToast");
  const dialog = document.getElementById("adminDialog");
  const dialogForm = document.getElementById("adminDialogForm");
  const dialogBody = document.getElementById("adminDialogBody");

  async function api(path, options = {}) {
    const response = await fetch(path, {
      credentials:"same-origin",
      headers:{ "Content-Type":"application/json", ...(options.headers || {}) },
      ...options
    });
    if (response.status === 204) return null;
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload?.error?.message || "Ошибка запроса");
      error.status = response.status;
      throw error;
    }
    return payload;
  }
  function toast(message) {
    toastNode.textContent = message;
    toastNode.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => toastNode.classList.remove("show"), 2200);
  }
  async function act(work, message) {
    try {
      const result = await work();
      if (message) toast(message);
      return result;
    } catch (error) {
      toast(error.message || "Действие не выполнено");
      throw error;
    }
  }
  function modal(title, html, handler) {
    document.getElementById("adminDialogTitle").textContent = title;
    dialogBody.innerHTML = html;
    dialogForm.onsubmit = async event => {
      if (event.submitter?.value === "cancel") return;
      event.preventDefault();
      await handler(new FormData(dialogForm));
    };
    dialog.showModal();
  }

  async function session() {
    try { return await api("/api/v1/auth/admin/session"); }
    catch (error) { if (error.status !== 401) throw error; return null; }
  }
  function showLogin(message = "") {
    loginView.hidden = false;
    appView.hidden = true;
    document.getElementById("adminLoginError").textContent = message;
  }
  async function showApp(admin) {
    loginView.hidden = true;
    appView.hidden = false;
    document.getElementById("adminEmail").textContent = admin.email;
    const permissions = await api("/api/v1/admin/permissions");
    state.permissions = permissions.permissions;
    await loadChats();
  }
  async function loadChats(search = "") {
    const payload = await api(`/api/v1/admin/chats?search=${encodeURIComponent(search)}`);
    state.chats = payload.chats || [];
    document.getElementById("chatList").innerHTML = state.chats.map(row => `
      <button class="chat-row ${row.clan_id === state.activeClanId ? "active" : ""}" type="button" data-admin-clan="${esc(row.clan_id)}">
        <div><b>${esc(row.name)}</b><small>${Number(row.member_count)} участников · ${Number(row.message_count)} сообщений · ${Number(row.active_poll_count)} опросов · ${Number(row.attached_event_count)} событий${row.last_message_at ? ` · ${fmt(row.last_message_at)}` : ""}</small></div>
        <span>${Number(row.open_report_count) ? `⚠ ${Number(row.open_report_count)}` : row.enabled ? "ON" : "OFF"}</span>
      </button>`).join("") || '<div class="admin-empty">Кланы не найдены</div>';
  }
  async function loadDetail(clanId) {
    state.activeClanId = clanId;
    content.innerHTML = '<div class="admin-empty">Загружаем чат…</div>';
    state.detail = await api(`/api/v1/admin/clans/${encodeURIComponent(clanId)}/chat`);
    await loadChats(document.getElementById("chatSearch").value);
    renderDetail();
  }
  function detailHeader() {
    const d = state.detail;
    return `<header class="content-head"><div><p class="eyebrow">КЛАНОВЫЙ ЧАТ</p><h1>${esc(d.chat.clan_name)}</h1><p>${esc(d.chat.clan_type)} · ID ${esc(d.chat.clan_id)}</p></div><div class="status-pills"><span class="${d.chat.enabled ? "on" : ""}">${d.chat.enabled ? "ЧАТ ВКЛЮЧЁН" : "ЧАТ ОТКЛЮЧЁН"}</span><span>${d.chat.read_only ? "ТОЛЬКО ЧТЕНИЕ" : "ЗАПИСЬ РАЗРЕШЕНА"}</span></div></header>
      <nav class="admin-tabs">
        ${[["overview","Управление"],["messages","Сообщения"],["permissions","Права"],["reports","Жалобы"]].map(([id,label]) => `<button class="${state.detailTab === id ? "active" : ""}" type="button" data-detail-tab="${id}">${label}</button>`).join("")}
      </nav>`;
  }
  function renderOverview() {
    const d = state.detail;
    return `<div class="admin-grid">
      <section class="admin-panel"><h2>Настройки чата</h2>
        <form id="chatSettingsForm">
          <label class="checkbox-row"><input name="enabled" type="checkbox" ${d.chat.enabled ? "checked" : ""}> Чат включён</label>
          <label class="checkbox-row"><input name="readOnly" type="checkbox" ${d.chat.read_only ? "checked" : ""}> Только чтение</label>
          <label class="field">Период удаления своего сообщения, сек.<input name="deleteWindow" type="number" min="0" max="86400" value="${Number(d.chat.own_delete_window_seconds)}"></label>
          <label class="field">Причина изменения<input name="reason" required></label>
          <button class="gold-button" type="submit">Сохранить настройки</button>
        </form>
      </section>
      <section class="admin-panel"><h2>Главный клана</h2>
        <form id="leaderForm"><label class="field">Новый главный<select name="userKey">${d.members.filter(row => row.status === "active").map(row => `<option value="${esc(row.user_key)}" ${row.user_key === d.chat.leader_user_key ? "selected" : ""}>${esc(row.name)} · ${esc(row.role)}</option>`).join("")}</select></label><label class="field">Причина<input name="reason" required></label><button class="gold-button">Сменить главного</button></form>
      </section>
      <section class="admin-panel"><h2>Официальное объявление</h2>
        <form id="announcementForm"><label class="field">Заголовок<input name="title" maxlength="200"></label><label class="field">Текст<textarea name="body" maxlength="4000" required></textarea></label><button class="gold-button">Опубликовать</button></form>
      </section>
      <section class="admin-panel"><h2>Материалы</h2>
        <div class="data-list">${d.polls.map(row => `<article class="data-row"><div><b>Опрос: ${esc(row.question)}</b><small>${esc(row.status)} · ${fmt(row.created_at)}</small></div><button class="small-button danger" data-admin-delete-poll="${esc(row.id)}">Удалить</button></article>`).join("") || '<div class="admin-empty">Опросов нет</div>'}
        ${d.events.map(row => `<article class="data-row"><div><b>Событие: ${esc(row.title)}</b><small>${esc(row.event_date)}</small></div><button class="small-button danger" data-admin-delete-event="${esc(row.id)}">Открепить</button></article>`).join("")}</div>
      </section>
    </div>`;
  }
  function renderMessages() {
    const d = state.detail;
    return `<section class="admin-panel full"><h2>История сообщений</h2>
      <form id="adminMessageSearch"><label class="field">Поиск по тексту сообщения<input name="search" type="search" maxlength="500" placeholder="Введите фразу"></label><button class="small-button">Найти</button></form>
      <div class="data-list">${d.messages.map(row => `<article class="data-row message-admin"><div><b>${esc(row.author_name || "BALI")} · ${fmt(row.created_at)}</b><p>${esc(row.body)}</p><small>${row.deleted_at ? `Удалено: ${fmt(row.deleted_at)}` : esc(row.id)}</small></div>${row.deleted_at ? '<span>УДАЛЕНО</span>' : `<button class="small-button danger" data-admin-delete-message="${esc(row.id)}">Удалить</button>`}</article>`).join("") || '<div class="admin-empty">Сообщений нет</div>'}</div></section>`;
  }
  function renderPermissions() {
    const d = state.detail;
    return `<div class="admin-grid">
      <section class="admin-panel"><h2>Выдать отдельное право</h2><form id="grantForm">
        <label class="field">Пользователь<select name="userKey">${d.members.filter(row => row.status === "active").map(row => `<option value="${esc(row.user_key)}">${esc(row.name)} · ${esc(row.role)}</option>`).join("")}</select></label>
        <label class="field">Разрешение<select name="permissionKey">${state.permissions.map(row => `<option value="${esc(row.permission_key)}">${esc(row.permission_key)}</option>`).join("")}</select></label>
        <label class="field">Эффект<select name="effect"><option value="allow">Разрешить</option><option value="deny">Запретить, включая главного</option></select></label>
        <label class="field">Действует до<input name="expiresAt" type="datetime-local"></label><label class="field">Причина<input name="reason" required></label>
        <button class="gold-button">Применить одно право</button></form>
      </section>
      <section class="admin-panel"><h2>Выданные права</h2><div class="data-list">${d.grants.filter(row => !row.revoked_at).map(row => `<article class="data-row"><div><b>${esc(row.user_name)} · ${esc(row.permission_key)}</b><small>${esc(row.effect)} · ${esc(row.reason)}${row.expires_at ? ` · до ${fmt(row.expires_at)}` : ""}</small></div><button class="small-button danger" data-revoke-grant="${esc(row.id)}">Отозвать</button></article>`).join("") || '<div class="admin-empty">Активных grants нет</div>'}</div></section>
      <section class="admin-panel full"><h2>Участники и ограничения</h2><div class="data-list">${d.members.map(row => `<article class="data-row"><div><b>${esc(row.name)}</b><small>${esc(row.user_key)} · роль ${esc(row.role)} · ${esc(row.status)}</small></div>${row.status === "active" ? `<button class="small-button" data-restrict-user="${esc(row.user_key)}">Ограничить чат</button>` : `<span>${esc(row.status)}</span>`}</article>`).join("")}</div></section>
    </div>`;
  }
  function renderReports() {
    const d = state.detail;
    return `<section class="admin-panel full"><h2>Жалобы</h2><div class="data-list">${d.reports.map(row => `<article class="data-row ${row.status === "new" ? "report-new" : ""}"><div><b>${esc(row.reporter_name)} → ${esc(row.message_author_name || "BALI")}</b><small>${esc(row.reason)} · ${fmt(row.created_at)} · ${esc(row.status)}</small></div>${row.status === "new" ? `<button class="small-button" data-review-report="${esc(row.id)}">Рассмотреть</button>` : `<span>${esc(row.status)}</span>`}</article>`).join("") || '<div class="admin-empty">Жалоб нет</div>'}</div></section>`;
  }
  function renderDetail() {
    if (!state.detail) return;
    content.innerHTML = detailHeader() + (state.detailTab === "messages" ? renderMessages() : state.detailTab === "permissions" ? renderPermissions() : state.detailTab === "reports" ? renderReports() : renderOverview());
  }
  async function renderAudit() {
    state.view = "audit";
    document.getElementById("chatSidebar").hidden = true;
    content.innerHTML = '<div class="admin-empty">Загружаем audit log…</div>';
    const payload = await api("/api/v1/admin/audit?limit=500");
    const auditCsvHref = "/api/v1/admin/audit?format=csv&limit=1000";
    content.innerHTML = `<header class="content-head"><div><p class="eyebrow">НЕИЗМЕНЯЕМЫЙ ЖУРНАЛ</p><h1>Audit log</h1></div><a class="gold-button" style="display:grid;place-items:center;padding:0 15px;text-decoration:none" href="${esc(auditCsvHref)}" download="bali-clan-chat-audit.csv">Экспорт CSV</a></header><section class="admin-panel"><div class="table-wrap"><table><thead><tr><th>Время</th><th>Актор</th><th>Право</th><th>Действие</th><th>Объект</th><th>Request ID</th><th>Причина</th></tr></thead><tbody>${payload.audit.map(row => `<tr><td>${fmt(row.created_at)}</td><td>${esc(row.actor_type)} · ${esc(row.actor_id)}</td><td>${esc(row.permission_key)}</td><td>${esc(row.action)}</td><td>${esc(row.target_type)} · ${esc(row.target_id)}</td><td>${esc(row.request_id)}</td><td>${esc(row.reason)}</td></tr>`).join("")}</tbody></table></div></section>`;
  }
  async function renderLimits() {
    state.view = "limits";
    document.getElementById("chatSidebar").hidden = true;
    const payload = await api("/api/v1/admin/rate-limits");
    content.innerHTML = `<header class="content-head"><div><p class="eyebrow">ANTI-SPAM</p><h1>Лимиты действий</h1></div></header><section class="admin-panel"><div>${payload.settings.map(row => `<form class="limit-row" data-limit-bucket="${esc(row.bucket)}"><b>${esc(row.bucket)}</b><label class="field">Количество<input name="limitCount" type="number" min="1" value="${Number(row.limit_count)}"></label><label class="field">Окно, сек.<input name="windowSeconds" type="number" min="1" max="86400" value="${Number(row.window_seconds)}"></label><label class="checkbox-row"><input name="enabled" type="checkbox" ${row.enabled ? "checked" : ""}> Вкл.</label><button class="small-button">Сохранить</button></form>`).join("")}</div></section>`;
  }
  function selectMainView(view) {
    state.view = view;
    document.querySelectorAll("[data-admin-view]").forEach(button => button.classList.toggle("active", button.dataset.adminView === view));
    if (view === "audit") return renderAudit();
    if (view === "limits") return renderLimits();
    document.getElementById("chatSidebar").hidden = false;
    if (state.detail) renderDetail();
    else content.innerHTML = '<div class="admin-empty">Выберите клановый чат.</div>';
  }

  document.getElementById("adminLoginForm").addEventListener("submit", async event => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const result = await api("/api/v1/auth/admin/login", { method:"POST", body:JSON.stringify(data) });
      await showApp(result.admin);
    } catch (error) { showLogin(error.message); }
  });
  document.getElementById("adminLogout").addEventListener("click", async () => {
    await api("/api/v1/auth/admin/logout", { method:"POST", body:"{}" });
    showLogin("Сессия администратора завершена");
  });
  document.getElementById("chatSearch").addEventListener("input", event => loadChats(event.target.value));
  document.addEventListener("click", async event => {
    const main = event.target.closest("[data-admin-view]"); if (main) return selectMainView(main.dataset.adminView);
    const clan = event.target.closest("[data-admin-clan]"); if (clan) return loadDetail(clan.dataset.adminClan);
    const tab = event.target.closest("[data-detail-tab]"); if (tab) { state.detailTab = tab.dataset.detailTab; return renderDetail(); }
    const message = event.target.closest("[data-admin-delete-message]");
    if (message) return modal("Удалить сообщение", '<label class="field">Причина<input name="reason" required></label><button class="gold-button">Удалить</button>', async data => { await act(() => api(`/api/v1/admin/clans/${state.activeClanId}/messages/${message.dataset.adminDeleteMessage}`, { method:"DELETE", body:JSON.stringify({ reason:data.get("reason") }) }), "Сообщение удалено"); dialog.close(); await loadDetail(state.activeClanId); });
    const poll = event.target.closest("[data-admin-delete-poll]"); if (poll && confirm("Удалить опрос?")) { await act(() => api(`/api/v1/admin/clans/${state.activeClanId}/polls/${poll.dataset.adminDeletePoll}`, { method:"DELETE", body:"{}" }), "Опрос удалён"); return loadDetail(state.activeClanId); }
    const attached = event.target.closest("[data-admin-delete-event]"); if (attached && confirm("Открепить событие?")) { await act(() => api(`/api/v1/admin/clans/${state.activeClanId}/events/${attached.dataset.adminDeleteEvent}`, { method:"DELETE", body:"{}" }), "Событие откреплено"); return loadDetail(state.activeClanId); }
    const revoke = event.target.closest("[data-revoke-grant]"); if (revoke && confirm("Отозвать разрешение?")) { await act(() => api(`/api/v1/admin/clans/${state.activeClanId}/grants/${revoke.dataset.revokeGrant}`, { method:"DELETE", body:JSON.stringify({ reason:"Отозвано через админ-панель" }) }), "Разрешение отозвано"); return loadDetail(state.activeClanId); }
    const restrict = event.target.closest("[data-restrict-user]"); if (restrict) return modal("Ограничить участника", '<label class="field">Причина<input name="reason" required></label><label class="field">Действует до<input name="expiresAt" type="datetime-local"></label><button class="gold-button">Ограничить чат</button>', async data => { await act(() => api(`/api/v1/admin/clans/${state.activeClanId}/restrictions`, { method:"POST", body:JSON.stringify({ userKey:restrict.dataset.restrictUser, reason:data.get("reason"), expiresAt:data.get("expiresAt") || null }) }), "Ограничение применено"); dialog.close(); await loadDetail(state.activeClanId); });
    const report = event.target.closest("[data-review-report]"); if (report) return modal("Рассмотреть жалобу", '<label class="field">Решение<select name="status"><option value="resolved">Решена</option><option value="dismissed">Отклонена</option><option value="reviewed">Проверена</option></select></label><label class="field">Комментарий<textarea name="resolution"></textarea></label><button class="gold-button">Сохранить</button>', async data => { await act(() => api(`/api/v1/admin/reports/${report.dataset.reviewReport}`, { method:"PATCH", body:JSON.stringify(Object.fromEntries(data.entries())) }), "Жалоба обработана"); dialog.close(); await loadDetail(state.activeClanId); });
  });
  document.addEventListener("submit", async event => {
    if (event.target.id === "adminMessageSearch") {
      event.preventDefault();
      const search = String(new FormData(event.target).get("search") || "");
      const result = await api(`/api/v1/admin/clans/${state.activeClanId}/messages?search=${encodeURIComponent(search)}&limit=500`);
      state.detail.messages = result.messages;
      return renderDetail();
    }
    if (event.target.id === "chatSettingsForm") { event.preventDefault(); const f=event.target; await act(() => api(`/api/v1/admin/clans/${state.activeClanId}/chat`, { method:"PATCH", body:JSON.stringify({ enabled:f.elements.enabled.checked, readOnly:f.elements.readOnly.checked, ownDeleteWindowSeconds:Number(f.elements.deleteWindow.value), reason:f.elements.reason.value }) }), "Настройки сохранены"); return loadDetail(state.activeClanId); }
    if (event.target.id === "leaderForm") { event.preventDefault(); const d=Object.fromEntries(new FormData(event.target).entries()); await act(() => api(`/api/v1/admin/clans/${state.activeClanId}/leader`, { method:"PUT", body:JSON.stringify(d) }), "Главный клана изменён"); return loadDetail(state.activeClanId); }
    if (event.target.id === "announcementForm") { event.preventDefault(); const d=Object.fromEntries(new FormData(event.target).entries()); await act(() => api(`/api/v1/admin/clans/${state.activeClanId}/announcements`, { method:"POST", body:JSON.stringify(d) }), "Объявление опубликовано"); event.target.reset(); return loadDetail(state.activeClanId); }
    if (event.target.id === "grantForm") { event.preventDefault(); const d=Object.fromEntries(new FormData(event.target).entries()); if (!d.expiresAt) delete d.expiresAt; await act(() => api(`/api/v1/admin/clans/${state.activeClanId}/grants`, { method:"POST", body:JSON.stringify(d) }), "Право применено"); return loadDetail(state.activeClanId); }
    const limit=event.target.closest("[data-limit-bucket]"); if (limit) { event.preventDefault(); await act(() => api(`/api/v1/admin/rate-limits/${encodeURIComponent(limit.dataset.limitBucket)}`, { method:"PUT", body:JSON.stringify({ limitCount:Number(limit.elements.limitCount.value), windowSeconds:Number(limit.elements.windowSeconds.value), enabled:limit.elements.enabled.checked }) }), "Лимит сохранён"); }
  });

  session().then(result => result?.admin ? showApp(result.admin) : showLogin()).catch(error => showLogin(error.message));
})();
