(() => {
  "use strict";
  if (window.__BALI_ADMIN_CLANS_BETA4__) return;
  window.__BALI_ADMIN_CLANS_BETA4__ = true;

  const api = (path, options) => window.BaliClans?.api
    ? window.BaliClans.api(path, options)
    : fetch(path, {
        credentials:"include",
        ...options,
        headers:{ "Content-Type":"application/json", ...(options?.headers || {}) }
      }).then(async response => {
        if (response.status === 204) return null;
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error?.message || payload.message || "Ошибка управления кланами");
        return payload;
      });
  const json = (body, method = "POST") => ({ method, body:JSON.stringify(body) });
  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;"
  })[char]);
  const dateTime = value => value ? new Date(value).toLocaleString("ru-RU", {
    day:"2-digit", month:"short", year:"2-digit", hour:"2-digit", minute:"2-digit"
  }) : "—";
  const roleName = role => ({ leader:"Лидер", deputy:"Заместитель", moderator:"Модератор", member:"Участник" })[role] || role;
  const permissionName = key => ({
    "announcement.create":"Объявления",
    "event.attach":"Прикреплять события",
    "event.detach":"Откреплять события",
    "event.set_primary":"Главное событие",
    "message.create":"Писать сообщения",
    "message.delete_any":"Удалять сообщения",
    "message.reply":"Отвечать",
    "pin.create":"Закреплять",
    "poll.cancel":"Отменять опрос",
    "poll.create":"Создавать опрос",
    "poll.delete":"Удалять опрос",
    "poll.finish":"Завершать опрос",
    "poll.vote":"Голосовать",
    "report.create":"Отправлять жалобы",
    "restriction.manage":"Ограничивать участников"
  })[key] || key;
  const viewState = { chats:[], clanId:"", detail:null, tab:"overview", search:"", messageSearch:"", audit:[], limits:[] };
  let adminContext = null;

  function installStyles() {
    if (document.getElementById("adminClansBeta4Style")) return;
    const style = document.createElement("style");
    style.id = "adminClansBeta4Style";
    style.textContent = `
      .clan-admin-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:14px}
      .clan-admin-stat{padding:17px;border:1px solid var(--line);border-radius:17px;background:var(--panel)}
      .clan-admin-stat span{display:block;color:var(--muted);font-size:10px;text-transform:uppercase}.clan-admin-stat strong{display:block;margin-top:7px;font-size:28px;color:var(--lime)}
      .clan-admin-layout{display:grid;grid-template-columns:280px minmax(0,1fr);gap:14px;align-items:start}
      .clan-admin-list,.clan-admin-main{border:1px solid var(--line);border-radius:18px;background:var(--panel);overflow:hidden}
      .clan-admin-list-head{display:grid;gap:9px;padding:13px;border-bottom:1px solid var(--line)}
      .clan-admin-list-head input,.clan-admin-form input,.clan-admin-form textarea,.clan-admin-form select{width:100%;min-height:42px;padding:9px 11px;border:1px solid var(--line);border-radius:11px;background:#0a0d0b;color:#fff;box-sizing:border-box}
      .clan-admin-list-items{display:grid;max-height:68vh;overflow:auto}.clan-admin-clan{display:grid;gap:5px;padding:13px;border:0;border-bottom:1px solid var(--line);background:transparent;color:#fff;text-align:left}
      .clan-admin-clan.active{background:#c8ff3d12;box-shadow:inset 3px 0 var(--lime)}.clan-admin-clan strong{font-size:12px}.clan-admin-clan small{color:var(--muted);font-size:9px}.clan-admin-clan em{color:#f4cf5d;font-style:normal;font-size:9px}
      .clan-admin-title{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:17px;border-bottom:1px solid var(--line)}
      .clan-admin-title h3{margin:4px 0 5px}.clan-admin-title p{margin:0;color:var(--muted);font-size:10px}.clan-admin-status{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
      .clan-admin-badge{display:inline-flex;padding:7px 9px;border:1px solid var(--line);border-radius:999px;color:var(--muted);font-size:9px}.clan-admin-badge.on{border-color:#c8ff3d66;color:var(--lime)}.clan-admin-badge.warn{border-color:#f4cf5d66;color:#f4cf5d}
      .clan-admin-tabs{display:flex;gap:6px;padding:10px;border-bottom:1px solid var(--line);overflow:auto}.clan-admin-tabs button{flex:0 0 auto;min-height:38px;padding:0 11px;border:1px solid var(--line);border-radius:10px;background:#ffffff05;color:var(--muted);font-size:9px}.clan-admin-tabs button.active{background:var(--lime);color:#080a08}
      .clan-admin-body{display:grid;gap:12px;padding:14px}.clan-admin-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
      .clan-admin-card{border:1px solid var(--line);border-radius:15px;background:#ffffff04;overflow:hidden}.clan-admin-card-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 13px;border-bottom:1px solid var(--line)}.clan-admin-card-head h4{margin:0;font-size:12px}.clan-admin-card-head small{color:var(--muted)}
      .clan-admin-form{display:grid;gap:9px;padding:13px}.clan-admin-form label{display:grid;gap:5px;color:var(--muted);font-size:9px}.clan-admin-form .check{display:flex;align-items:center;gap:8px}.clan-admin-form .check input{width:auto;min-height:auto;accent-color:var(--lime)}
      .clan-admin-actions{display:flex;gap:8px;flex-wrap:wrap}.clan-admin-button{min-height:40px;padding:0 13px;border:0;border-radius:10px;background:var(--lime);color:#080a08;font-weight:800}.clan-admin-button.ghost{border:1px solid var(--line);background:#ffffff08;color:#fff}.clan-admin-button.danger{border:1px solid #ff666677;background:#ff444414;color:#ff8c8c}
      .clan-admin-table-wrap{overflow:auto}.clan-admin-table{width:100%;border-collapse:collapse}.clan-admin-table th,.clan-admin-table td{padding:10px 11px;border-bottom:1px solid var(--line);text-align:left;font-size:10px;vertical-align:top}.clan-admin-table th{color:var(--muted);font-size:8px;text-transform:uppercase}.clan-admin-table td small{color:var(--muted)}
      .clan-admin-message{max-width:420px;white-space:normal;overflow-wrap:anywhere}.clan-admin-empty{padding:28px;color:var(--muted);text-align:center;font-size:11px}
      .clan-admin-permissions{display:flex;gap:5px;flex-wrap:wrap}.clan-admin-permissions span{padding:5px 7px;border-radius:999px;background:#c8ff3d10;color:var(--lime);font-size:8px}
      .clan-admin-audit{display:grid;gap:7px;padding:11px}.clan-admin-audit article{display:grid;grid-template-columns:145px 1fr;gap:10px;padding:9px;border:1px solid var(--line);border-radius:10px;font-size:9px}.clan-admin-audit time{color:var(--muted)}
      @media(max-width:1000px){.clan-admin-layout{grid-template-columns:230px minmax(0,1fr)}.clan-admin-stats{grid-template-columns:repeat(2,1fr)}}
      @media(max-width:760px){.clan-admin-layout{grid-template-columns:1fr}.clan-admin-list-items{max-height:210px}.clan-admin-grid{grid-template-columns:1fr}.clan-admin-stats{grid-template-columns:1fr 1fr}.clan-admin-title{display:grid}.clan-admin-status{justify-content:flex-start}.clan-admin-body{padding:9px}.clan-admin-stat{padding:12px}.clan-admin-stat strong{font-size:22px}}
    `;
    document.head.appendChild(style);
  }

  async function loadChats() {
    const result = await api(`/api/v1/admin/chats?search=${encodeURIComponent(viewState.search)}`);
    viewState.chats = result.chats || [];
    if (!viewState.clanId || !viewState.chats.some(row => row.clan_id === viewState.clanId)) {
      viewState.clanId = viewState.chats[0]?.clan_id || "";
    }
  }

  async function loadDetail() {
    if (!viewState.clanId) {
      viewState.detail = null;
      return;
    }
    viewState.detail = await api(`/api/v1/admin/clans/${encodeURIComponent(viewState.clanId)}/chat`);
  }

  async function loadSystem() {
    const [audit, limits] = await Promise.all([
      api("/api/v1/admin/audit?limit=500"),
      api("/api/v1/admin/rate-limits")
    ]);
    viewState.audit = audit.audit || [];
    viewState.limits = limits.settings || [];
  }

  function stats() {
    const enabled = viewState.chats.filter(row => row.enabled).length;
    const members = viewState.chats.reduce((sum, row) => sum + Number(row.member_count || 0), 0);
    const reports = viewState.chats.reduce((sum, row) => sum + Number(row.open_report_count || 0), 0);
    const messages = viewState.chats.reduce((sum, row) => sum + Number(row.message_count || 0), 0);
    return `<div class="clan-admin-stats">
      <article class="clan-admin-stat"><span>Кланы</span><strong>${viewState.chats.length}</strong></article>
      <article class="clan-admin-stat"><span>Активные чаты</span><strong>${enabled}</strong></article>
      <article class="clan-admin-stat"><span>Участники</span><strong>${members}</strong></article>
      <article class="clan-admin-stat"><span>Жалобы / сообщения</span><strong>${reports} / ${messages}</strong></article>
    </div>`;
  }

  function clanList() {
    return `<aside class="clan-admin-list">
      <form class="clan-admin-list-head" id="clanAdminSearchForm"><strong>Кланы BALI PEOPLE</strong><input name="search" value="${esc(viewState.search)}" placeholder="Поиск клана"></form>
      <div class="clan-admin-list-items">${viewState.chats.length ? viewState.chats.map(row => `<button type="button" class="clan-admin-clan ${row.clan_id === viewState.clanId ? "active" : ""}" data-admin-clan-id="${esc(row.clan_id)}"><strong>${esc(row.name)}</strong><small>${row.member_count} участников · ${row.message_count} сообщений</small>${row.open_report_count ? `<em>${row.open_report_count} новых жалоб</em>` : ""}</button>`).join("") : '<div class="clan-admin-empty">Кланы не найдены</div>'}</div>
    </aside>`;
  }

  function detailHeader() {
    const chat = viewState.detail.chat;
    return `<div class="clan-admin-title"><div><span class="eyebrow">BALI PEOPLE · ${esc(chat.clan_type)}</span><h3>${esc(chat.clan_name)}</h3><p>ID: ${esc(chat.clan_id)} · лидер ${esc(chat.leader_user_key)}</p></div><div class="clan-admin-status"><span class="clan-admin-badge ${chat.enabled ? "on" : "warn"}">${chat.enabled ? "Чат включён" : "Чат выключен"}</span><span class="clan-admin-badge ${chat.read_only ? "warn" : "on"}">${chat.read_only ? "Только чтение" : "Запись разрешена"}</span></div></div>`;
  }

  function tabs() {
    const rows = [
      ["overview","Настройки"],["messages","Сообщения"],["members","Участники"],
      ["access","Права"],["content","Контент"],["reports","Жалобы"],["system","Система"]
    ];
    return `<nav class="clan-admin-tabs">${rows.map(([id,label]) => `<button type="button" class="${viewState.tab === id ? "active" : ""}" data-admin-clan-tab="${id}">${label}</button>`).join("")}</nav>`;
  }

  function overview() {
    const chat = viewState.detail.chat;
    const activeMembers = viewState.detail.members.filter(row => row.status === "active").length;
    return `<div class="clan-admin-grid">
      <section class="clan-admin-card"><div class="clan-admin-card-head"><h4>Режим чата</h4><small>Применяется сразу</small></div><form class="clan-admin-form" id="clanAdminSettingsForm">
        <label class="check"><input type="checkbox" name="enabled" ${chat.enabled ? "checked" : ""}> Чат доступен участникам</label>
        <label class="check"><input type="checkbox" name="readOnly" ${chat.read_only ? "checked" : ""}> Только чтение</label>
        <label>Удаление своего сообщения, секунд<input type="number" name="deleteWindow" min="0" max="86400" value="${Number(chat.own_delete_window_seconds || 0)}"></label>
        <label>Причина изменения<input name="reason" value="Настройка через текущую админку BALI"></label>
        <button class="clan-admin-button" type="submit">СОХРАНИТЬ РЕЖИМ</button>
      </form></section>
      <section class="clan-admin-card"><div class="clan-admin-card-head"><h4>Сводка</h4></div><div class="clan-admin-form">
        <label>Активных участников<strong>${activeMembers}</strong></label>
        <label>Сообщений<strong>${viewState.detail.messages.length}</strong></label>
        <label>Опросов / событий<strong>${viewState.detail.polls.length} / ${viewState.detail.events.length}</strong></label>
        <label>Выданных прав / ограничений<strong>${viewState.detail.grants.filter(row => !row.revoked_at).length} / ${viewState.detail.restrictions.filter(row => !row.revoked_at).length}</strong></label>
      </div></section>
    </div>`;
  }

  function messages() {
    const rows = viewState.detail.messages.filter(row => !viewState.messageSearch || String(row.body).toLocaleLowerCase("ru").includes(viewState.messageSearch.toLocaleLowerCase("ru")));
    return `<section class="clan-admin-card"><div class="clan-admin-card-head"><h4>Все сообщения клана</h4><form id="clanAdminMessageSearch"><input name="search" value="${esc(viewState.messageSearch)}" placeholder="Поиск по тексту"></form></div><div class="clan-admin-table-wrap">${rows.length ? `<table class="clan-admin-table"><thead><tr><th>Автор</th><th>Сообщение</th><th>Дата</th><th></th></tr></thead><tbody>${rows.map(row => `<tr><td>${esc(row.author_name || "BALI")}<br><small>${esc(row.message_type)}</small></td><td class="clan-admin-message">${row.deleted_at ? "<s>Удалено</s>" : esc(row.body)}</td><td>${dateTime(row.created_at)}</td><td>${row.deleted_at ? "" : `<button class="clan-admin-button danger" type="button" data-admin-delete-message="${esc(row.id)}">Удалить</button>`}</td></tr>`).join("")}</tbody></table>` : '<div class="clan-admin-empty">Сообщения не найдены</div>'}</div></section>`;
  }

  function members() {
    const rows = viewState.detail.members;
    return `<div class="clan-admin-grid">
      <section class="clan-admin-card"><div class="clan-admin-card-head"><h4>Состав клана</h4><small>${rows.length}</small></div><div class="clan-admin-table-wrap"><table class="clan-admin-table"><thead><tr><th>Участник</th><th>Роль</th><th>Статус</th></tr></thead><tbody>${rows.map(row => `<tr><td><strong>${esc(row.name)}</strong><br><small>@${esc(row.username || "—")} · ${esc(row.user_key)}</small></td><td>${esc(roleName(row.role))}</td><td>${esc(row.status)}</td></tr>`).join("")}</tbody></table></div></section>
      <section class="clan-admin-card"><div class="clan-admin-card-head"><h4>Передать лидерство</h4></div><form class="clan-admin-form" id="clanAdminLeaderForm"><label>Новый лидер<select name="userKey">${rows.map(row => `<option value="${esc(row.user_key)}" ${row.user_key === viewState.detail.chat.leader_user_key ? "selected" : ""}>${esc(row.name)} · ${esc(roleName(row.role))}</option>`).join("")}</select></label><label>Причина<input name="reason" value="Решение администратора BALI"></label><button class="clan-admin-button" type="submit">НАЗНАЧИТЬ ЛИДЕРА</button></form></section>
    </div>`;
  }

  function access() {
    const members = viewState.detail.members;
    const activeGrants = viewState.detail.grants.filter(row => !row.revoked_at);
    const activeRestrictions = viewState.detail.restrictions.filter(row => !row.revoked_at);
    const memberOptions = members.map(row => `<option value="${esc(row.user_key)}">${esc(row.name)} · ${esc(roleName(row.role))}</option>`).join("");
    return `<div class="clan-admin-grid">
      <section class="clan-admin-card"><div class="clan-admin-card-head"><h4>Выдать право</h4></div><form class="clan-admin-form" id="clanAdminGrantForm"><label>Участник<select name="userKey">${memberOptions}</select></label><label>Разрешение<select name="permissionKey">${["announcement.create","event.attach","message.delete_any","poll.create","poll.finish","restriction.manage"].map(key => `<option value="${key}">${esc(permissionName(key))}</option>`).join("")}</select></label><label>Причина<input name="reason" required value="Обязанности в клане"></label><button class="clan-admin-button" type="submit">ВЫДАТЬ ПРАВО</button></form></section>
      <section class="clan-admin-card"><div class="clan-admin-card-head"><h4>Ограничить запись</h4></div><form class="clan-admin-form" id="clanAdminRestrictionForm"><label>Участник<select name="userKey">${memberOptions}</select></label><label>Причина<input name="reason" required value="Нарушение правил клана"></label><button class="clan-admin-button danger" type="submit">ОГРАНИЧИТЬ</button></form></section>
      <section class="clan-admin-card"><div class="clan-admin-card-head"><h4>Действующие права</h4><small>${activeGrants.length}</small></div><div class="clan-admin-table-wrap">${activeGrants.length ? `<table class="clan-admin-table"><tbody>${activeGrants.map(row => `<tr><td>${esc(row.user_name)}<br><small>${esc(permissionName(row.permission_key))}</small></td><td><button class="clan-admin-button danger" type="button" data-admin-revoke-grant="${esc(row.id)}">Отозвать</button></td></tr>`).join("")}</tbody></table>` : '<div class="clan-admin-empty">Дополнительных прав нет</div>'}</div></section>
      <section class="clan-admin-card"><div class="clan-admin-card-head"><h4>Ограничения</h4><small>${activeRestrictions.length}</small></div><div class="clan-admin-table-wrap">${activeRestrictions.length ? `<table class="clan-admin-table"><tbody>${activeRestrictions.map(row => `<tr><td>${esc(row.user_name)}<br><small>${esc(row.reason)}</small></td><td>${dateTime(row.expires_at)}</td></tr>`).join("")}</tbody></table>` : '<div class="clan-admin-empty">Ограничений нет</div>'}</div></section>
    </div>`;
  }

  function content() {
    return `<div class="clan-admin-grid">
      <section class="clan-admin-card"><div class="clan-admin-card-head"><h4>Официальное объявление</h4></div><form class="clan-admin-form" id="clanAdminAnnouncementForm"><label>Заголовок<input name="title" required value="BALI"></label><label>Текст<textarea name="body" required placeholder="Сообщение всем участникам клана"></textarea></label><button class="clan-admin-button" type="submit">ОПУБЛИКОВАТЬ</button></form></section>
      <section class="clan-admin-card"><div class="clan-admin-card-head"><h4>Опросы</h4><small>${viewState.detail.polls.length}</small></div><div class="clan-admin-table-wrap">${viewState.detail.polls.length ? `<table class="clan-admin-table"><tbody>${viewState.detail.polls.map(row => `<tr><td>${esc(row.question)}<br><small>${esc(row.status)} · ${row.options.length} вариантов</small></td><td><button class="clan-admin-button danger" type="button" data-admin-delete-poll="${esc(row.id)}">Удалить</button></td></tr>`).join("")}</tbody></table>` : '<div class="clan-admin-empty">Опросов нет</div>'}</div></section>
      <section class="clan-admin-card"><div class="clan-admin-card-head"><h4>Прикреплённые события</h4><small>${viewState.detail.events.length}</small></div><div class="clan-admin-table-wrap">${viewState.detail.events.length ? `<table class="clan-admin-table"><tbody>${viewState.detail.events.map(row => `<tr><td>${esc(row.title)}<br><small>${esc(row.event_date)} · ${esc(row.event_time)}</small></td><td><button class="clan-admin-button danger" type="button" data-admin-delete-event="${esc(row.id)}">Открепить</button></td></tr>`).join("")}</tbody></table>` : '<div class="clan-admin-empty">Событий нет</div>'}</div></section>
    </div>`;
  }

  function reports() {
    const rows = viewState.detail.reports;
    return `<section class="clan-admin-card"><div class="clan-admin-card-head"><h4>Жалобы участников</h4><small>${rows.filter(row => row.status === "new").length} новых</small></div><div class="clan-admin-table-wrap">${rows.length ? `<table class="clan-admin-table"><thead><tr><th>Кто / на кого</th><th>Причина</th><th>Статус</th><th></th></tr></thead><tbody>${rows.map(row => `<tr><td>${esc(row.reporter_name)}<br><small>на ${esc(row.message_author_name)}</small></td><td>${esc(row.reason)}<br><small>${dateTime(row.created_at)}</small></td><td>${esc(row.status)}</td><td>${row.status === "new" ? `<button type="button" class="clan-admin-button" data-admin-resolve-report="${esc(row.id)}">Обработано</button>` : esc(row.resolution || "")}</td></tr>`).join("")}</tbody></table>` : '<div class="clan-admin-empty">Жалоб нет</div>'}</div></section>`;
  }

  function system() {
    return `<div class="clan-admin-grid">
      <section class="clan-admin-card"><div class="clan-admin-card-head"><h4>Антиспам и лимиты</h4></div><div class="clan-admin-table-wrap"><table class="clan-admin-table"><thead><tr><th>Операция</th><th>Лимит</th><th>Окно</th><th></th></tr></thead><tbody>${viewState.limits.map(row => `<tr><td>${esc(row.bucket)}</td><td><input data-limit-count="${esc(row.bucket)}" type="number" value="${Number(row.limit_count)}" min="1"></td><td><input data-limit-window="${esc(row.bucket)}" type="number" value="${Number(row.window_seconds)}" min="1"></td><td><button class="clan-admin-button ghost" type="button" data-admin-save-limit="${esc(row.bucket)}" data-enabled="${row.enabled}">Сохранить</button></td></tr>`).join("")}</tbody></table></div></section>
      <section class="clan-admin-card"><div class="clan-admin-card-head"><h4>Журнал действий</h4><small>${viewState.audit.length}</small></div><div class="clan-admin-audit">${viewState.audit.slice(0, 30).map(row => `<article><time>${dateTime(row.created_at)}</time><div><strong>${esc(row.action)}</strong><br><small>${esc(row.reason || row.target_id)}</small></div></article>`).join("")}</div></section>
    </div>`;
  }

  async function refresh(root, message = "") {
    try {
      await loadChats();
      if (viewState.tab === "system") await loadSystem();
      await loadDetail();
      await render(root);
      if (message) adminContext?.toast?.(message);
    } catch (error) {
      root.innerHTML = `<div class="panel"><div class="empty">Ошибка кланов: ${esc(error.message)}</div></div>`;
    }
  }

  function bind(root) {
    root.onclick = async event => {
      const clan = event.target.closest("[data-admin-clan-id]");
      if (clan) {
        viewState.clanId = clan.dataset.adminClanId;
        viewState.tab = "overview";
        return refresh(root);
      }
      const tab = event.target.closest("[data-admin-clan-tab]");
      if (tab) {
        viewState.tab = tab.dataset.adminClanTab;
        return refresh(root);
      }
      const destructive = [
        ["adminDeleteMessage","messages","DELETE","Сообщение удалено"],
        ["adminDeletePoll","polls","DELETE","Опрос удалён"],
        ["adminDeleteEvent","events","DELETE","Событие откреплено"]
      ].find(([dataset]) => event.target.closest(`[data-${dataset.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`)}]`));
      if (destructive) {
        const [dataset, segment, method, message] = destructive;
        const button = event.target.closest(`[data-${dataset.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`)}]`);
        if (!confirm("Подтвердить действие?")) return;
        const suffix = segment === "messages" ? "" : "";
        await api(`/api/v1/admin/clans/${encodeURIComponent(viewState.clanId)}/${segment}/${encodeURIComponent(button.dataset[dataset])}${suffix}`, { method, body:JSON.stringify({ reason:"Действие через admin-beta4" }) });
        return refresh(root, message);
      }
      const revoke = event.target.closest("[data-admin-revoke-grant]");
      if (revoke) {
        await api(`/api/v1/admin/clans/${encodeURIComponent(viewState.clanId)}/grants/${encodeURIComponent(revoke.dataset.adminRevokeGrant)}`, { method:"DELETE", body:JSON.stringify({ reason:"Отозвано администратором" }) });
        return refresh(root, "Право отозвано");
      }
      const report = event.target.closest("[data-admin-resolve-report]");
      if (report) {
        await api(`/api/v1/admin/reports/${encodeURIComponent(report.dataset.adminResolveReport)}`, json({ status:"resolved", resolution:"Проверено в admin-beta4" }, "PATCH"));
        return refresh(root, "Жалоба обработана");
      }
      const limit = event.target.closest("[data-admin-save-limit]");
      if (limit) {
        const bucket = limit.dataset.adminSaveLimit;
        const count = root.querySelector(`[data-limit-count="${CSS.escape(bucket)}"]`).value;
        const windowSeconds = root.querySelector(`[data-limit-window="${CSS.escape(bucket)}"]`).value;
        await api(`/api/v1/admin/rate-limits/${encodeURIComponent(bucket)}`, json({ limitCount:Number(count), windowSeconds:Number(windowSeconds), enabled:limit.dataset.enabled === "true" }, "PUT"));
        return refresh(root, "Лимит сохранён");
      }
    };

    root.onsubmit = async event => {
      const form = event.target;
      if (!form.id?.startsWith("clanAdmin")) return;
      event.preventDefault();
      const data = new FormData(form);
      if (form.id === "clanAdminSearchForm") {
        viewState.search = String(data.get("search") || "");
        return refresh(root);
      }
      if (form.id === "clanAdminMessageSearch") {
        viewState.messageSearch = String(data.get("search") || "");
        return render(root);
      }
      if (form.id === "clanAdminSettingsForm") {
        await api(`/api/v1/admin/clans/${encodeURIComponent(viewState.clanId)}/chat`, json({
          enabled:data.get("enabled") === "on",
          readOnly:data.get("readOnly") === "on",
          ownDeleteWindowSeconds:Number(data.get("deleteWindow")),
          reason:data.get("reason")
        }, "PATCH"));
        return refresh(root, "Настройки чата сохранены");
      }
      if (form.id === "clanAdminLeaderForm") {
        await api(`/api/v1/admin/clans/${encodeURIComponent(viewState.clanId)}/leader`, json({ userKey:data.get("userKey"), reason:data.get("reason") }, "PUT"));
        return refresh(root, "Лидер клана изменён");
      }
      if (form.id === "clanAdminGrantForm") {
        await api(`/api/v1/admin/clans/${encodeURIComponent(viewState.clanId)}/grants`, json({ userKey:data.get("userKey"), permissionKey:data.get("permissionKey"), effect:"allow", reason:data.get("reason") }));
        return refresh(root, "Право выдано");
      }
      if (form.id === "clanAdminRestrictionForm") {
        await api(`/api/v1/admin/clans/${encodeURIComponent(viewState.clanId)}/restrictions`, json({ userKey:data.get("userKey"), reason:data.get("reason"), expiresAt:null }));
        return refresh(root, "Ограничение включено");
      }
      if (form.id === "clanAdminAnnouncementForm") {
        await api(`/api/v1/admin/clans/${encodeURIComponent(viewState.clanId)}/announcements`, json({ title:data.get("title"), body:data.get("body") }));
        form.reset();
        return refresh(root, "Объявление опубликовано");
      }
    };
  }

  async function render(root, context) {
    if (context) {
      adminContext = context;
      await loadChats();
      await loadDetail();
      if (viewState.tab === "system") await loadSystem();
    } else {
      if (!viewState.chats.length) await loadChats();
      if (!viewState.detail && viewState.clanId) await loadDetail();
      if (viewState.tab === "system" && !viewState.limits.length) await loadSystem();
    }
    const detail = !viewState.detail ? '<main class="clan-admin-main"><div class="clan-admin-empty">Выберите клан</div></main>' : `<main class="clan-admin-main">${detailHeader()}${tabs()}<div class="clan-admin-body">${
      viewState.tab === "overview" ? overview() :
      viewState.tab === "messages" ? messages() :
      viewState.tab === "members" ? members() :
      viewState.tab === "access" ? access() :
      viewState.tab === "content" ? content() :
      viewState.tab === "reports" ? reports() : system()
    }</div></main>`;
    root.innerHTML = `${stats()}<div class="clan-admin-layout">${clanList()}${detail}</div>`;
    bind(root);
  }

  installStyles();
  window.BaliAdminViews = window.BaliAdminViews || {};
  window.BaliAdminViews.clans = {
    title:"Кланы BALI PEOPLE",
    primaryAction:false,
    render
  };
  window.addEventListener("storage", event => {
    if (event.key !== (window.BaliClans?.storageKey || "bali_clans_integrated_demo_v1")) return;
    const root = document.getElementById("content");
    if (root && document.querySelector('#adminNav [data-view="clans"].active')) refresh(root);
  });
})();
