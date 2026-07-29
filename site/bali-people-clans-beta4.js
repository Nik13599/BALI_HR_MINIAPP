(() => {
  "use strict";
  if (window.__BALI_PEOPLE_CLANS_BETA4__) return;
  window.__BALI_PEOPLE_CLANS_BETA4__ = true;

  const api = (path, options) => {
    if (window.BaliClans?.api) return window.BaliClans.api(path, options);
    return fetch(path, {
      credentials:"include",
      ...options,
      headers:{ "Content-Type":"application/json", ...(options?.headers || {}) }
    }).then(async response => {
      if (response.status === 204) return null;
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error?.message || payload.message || "Ошибка загрузки клана");
      return payload;
    });
  };
  const state = { mode:"people", tab:"chat", clans:[], clanId:"", bundle:null, availableEvents:[], loading:false };
  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;"
  })[char]);
  const dateTime = value => value ? new Date(value).toLocaleString("ru-RU", {
    day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit"
  }) : "—";
  const roleName = role => ({ leader:"Лидер", deputy:"Заместитель", moderator:"Модератор", member:"Участник" })[role] || role;
  const can = permission => state.bundle?.permissions?.includes(permission);
  const currentUserId = () => String(window.BaliClans?.currentUser?.()?.id || "tg:1001");
  const toast = message => {
    const node = document.getElementById("toast");
    if (!node) return;
    node.textContent = message;
    node.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove("show"), 2400);
  };
  const json = body => ({ method:"POST", body:JSON.stringify(body) });

  function installStyles() {
    if (document.getElementById("baliPeopleClansStyle")) return;
    const style = document.createElement("style");
    style.id = "baliPeopleClansStyle";
    style.textContent = `
      .people-mode-switch{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:0 0 12px;padding:4px;border:1px solid var(--line);border-radius:15px;background:#090c0b}
      .people-mode-switch button{min-height:42px;border:0;border-radius:11px;background:transparent;color:var(--muted);font:800 10px/1.2 system-ui;letter-spacing:.08em}
      .people-mode-switch button.active{background:var(--lime);color:#080a08}
      .bali-clan-pane[hidden],.bali-people-directory[hidden]{display:none!important}
      .clan-integrated-shell{display:grid;gap:10px;padding-bottom:92px}
      .clan-hero{position:relative;overflow:hidden;padding:15px;border:1px solid rgba(200,255,61,.28);border-radius:19px;background:radial-gradient(circle at 90% 0,rgba(200,255,61,.18),transparent 42%),linear-gradient(145deg,#151a17,#090c0b)}
      .clan-hero:after{content:"B";position:absolute;right:-8px;bottom:-34px;color:#c8ff3d0d;font:900 120px/1 Unbounded}
      .clan-hero-top{position:relative;z-index:1;display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
      .clan-hero h3{margin:5px 0 4px;font:800 17px/1.2 Unbounded;color:#fff}.clan-hero p{margin:0;color:var(--muted);font-size:9px}
      .clan-role{display:inline-flex;padding:7px 9px;border-radius:999px;background:var(--lime);color:#080a08;font:900 8px/1 system-ui;text-transform:uppercase}
      .clan-selector{width:100%;min-height:43px;margin-top:13px;padding:0 11px;border:1px solid var(--line);border-radius:12px;background:#111512;color:#fff;font-size:10px}
      .clan-main-tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
      .clan-main-tabs button{min-height:46px;padding:5px 2px;border:1px solid var(--line);border-radius:12px;background:#ffffff06;color:var(--muted);font:700 8px/1.15 system-ui}
      .clan-main-tabs button i{display:block;margin-bottom:4px;color:var(--lime);font-style:normal;font-size:15px}
      .clan-main-tabs button.active{border-color:var(--lime);background:#c8ff3d14;color:#fff}
      .clan-card{overflow:hidden;border:1px solid var(--line);border-radius:17px;background:#101411}
      .clan-card-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 13px;border-bottom:1px solid var(--line)}
      .clan-card-head h4{margin:0;font-size:11px}.clan-card-head small{color:var(--muted);font-size:8px}
      .clan-announcement{padding:12px 13px;border-bottom:1px solid var(--line);background:linear-gradient(90deg,#c8ff3d12,transparent)}
      .clan-announcement strong{display:block;margin-bottom:4px;color:var(--lime);font-size:10px}.clan-announcement p{margin:0;color:#e9eee9;font-size:9px;line-height:1.5}
      .clan-event-mini{display:grid;grid-template-columns:72px 1fr;gap:10px;padding:10px}
      .clan-event-mini img{width:72px;height:66px;border-radius:11px;object-fit:cover}.clan-event-mini h4{margin:4px 0;font-size:10px}.clan-event-mini p{margin:0;color:var(--muted);font-size:8px}
      .clan-messages{display:grid;gap:9px;max-height:46dvh;padding:12px;overflow:auto}
      .clan-message{max-width:88%;padding:9px 10px;border:1px solid var(--line);border-radius:14px 14px 14px 4px;background:#171b18}
      .clan-message.mine{justify-self:end;border-color:#c8ff3d55;border-radius:14px 14px 4px 14px;background:#263018}
      .clan-message.announcement{max-width:100%;border-color:#c8ff3d44;background:#c8ff3d0c}
      .clan-message-meta{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:4px;color:var(--lime);font-size:8px}.clan-message-meta time{color:var(--muted)}
      .clan-message p{margin:0;color:#fff;font-size:10px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}
      .clan-message-actions{display:flex;gap:8px;margin-top:6px}.clan-message-actions button{padding:0;border:0;background:transparent;color:var(--muted);font-size:8px}
      .clan-composer{display:grid;grid-template-columns:1fr auto;gap:7px;padding:10px;border-top:1px solid var(--line)}
      .clan-composer textarea{min-height:46px;max-height:120px;padding:11px;border:1px solid var(--line);border-radius:13px;background:#080b09;color:#fff;resize:vertical;font:10px/1.4 system-ui}
      .clan-composer button,.clan-action{min-height:44px;padding:0 13px;border:0;border-radius:12px;background:var(--lime);color:#080a08;font:900 9px/1 system-ui}
      .clan-action.ghost{border:1px solid var(--line);background:#ffffff08;color:#fff}
      .clan-readonly{padding:12px;color:#f4cf5d;text-align:center;font-size:9px}
      .clan-member-list,.clan-poll-list,.clan-event-list{display:grid;gap:8px;padding:10px}
      .clan-member{display:grid;grid-template-columns:42px 1fr auto;align-items:center;gap:9px;padding:9px;border:1px solid var(--line);border-radius:13px;background:#ffffff04}
      .clan-avatar{display:grid;width:42px;height:42px;place-items:center;border-radius:50%;background:#c8ff3d17;color:var(--lime);font:800 12px Unbounded}
      .clan-member h4{margin:0 0 3px;font-size:10px}.clan-member p{margin:0;color:var(--muted);font-size:8px}.clan-member span{color:var(--lime);font-size:8px}
      .clan-poll{padding:12px;border:1px solid var(--line);border-radius:14px;background:#ffffff04}.clan-poll h4{margin:0 0 9px;font-size:11px;line-height:1.35}
      .clan-poll-option{display:grid;grid-template-columns:1fr auto;gap:8px;width:100%;margin-top:6px;padding:10px;border:1px solid var(--line);border-radius:11px;background:#090c0a;color:#fff;text-align:left;font-size:9px}
      .clan-poll-option.selected{border-color:var(--lime);background:#c8ff3d12}.clan-poll-option b{color:var(--lime)}
      .clan-tools{display:grid;gap:8px;padding:10px}.clan-tools form{display:grid;gap:7px;padding:10px;border:1px solid var(--line);border-radius:13px;background:#ffffff04}
      .clan-tools input,.clan-tools textarea,.clan-tools select{width:100%;min-height:42px;padding:9px;border:1px solid var(--line);border-radius:11px;background:#090c0a;color:#fff;font:9px/1.4 system-ui;box-sizing:border-box}
      .clan-empty{padding:25px 12px;color:var(--muted);text-align:center;font-size:9px;line-height:1.5}
      .clan-notification{display:flex;align-items:center;gap:7px;color:var(--muted);font-size:8px}.clan-notification input{accent-color:var(--lime)}
      @media(max-width:360px){.clan-main-tabs button{font-size:7px}.clan-event-mini{grid-template-columns:60px 1fr}.clan-event-mini img{width:60px}.clan-composer{grid-template-columns:1fr}.clan-composer button{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function mount() {
    const screen = document.querySelector('[data-screen="dating"]');
    const inner = screen?.querySelector(".inner");
    const socialTabs = inner?.querySelector(".social-tabs-v2");
    const socialContent = inner?.querySelector("#socialV2Content");
    if (!inner || !socialTabs || !socialContent) return false;
    if (inner.querySelector(".people-mode-switch")) return true;

    const modeSwitch = document.createElement("div");
    modeSwitch.className = "people-mode-switch";
    modeSwitch.innerHTML = `
      <button type="button" class="active" data-people-mode="people">ЛЮДИ</button>
      <button type="button" data-people-mode="clan">МОЙ КЛАН</button>`;
    socialTabs.before(modeSwitch);

    const directory = document.createElement("div");
    directory.className = "bali-people-directory";
    socialTabs.before(directory);
    directory.append(socialTabs, socialContent);

    const clanPane = document.createElement("div");
    clanPane.className = "bali-clan-pane";
    clanPane.id = "baliPeopleClanPane";
    clanPane.hidden = true;
    directory.after(clanPane);
    renderMode();
    return true;
  }

  function renderMode() {
    document.querySelectorAll("[data-people-mode]").forEach(button => {
      button.classList.toggle("active", button.dataset.peopleMode === state.mode);
    });
    const directory = document.querySelector(".bali-people-directory");
    const clanPane = document.getElementById("baliPeopleClanPane");
    if (!directory || !clanPane) return;
    directory.hidden = state.mode !== "people";
    clanPane.hidden = state.mode !== "clan";
    if (state.mode === "clan") loadClan();
  }

  async function loadClan(force = false) {
    const root = document.getElementById("baliPeopleClanPane");
    if (!root || state.loading) return;
    state.loading = true;
    if (!state.bundle || force) root.innerHTML = '<div class="clan-empty">Загружаем кланы BALI…</div>';
    try {
      if (!state.clans.length || force) {
        const result = await api("/api/v1/clans");
        state.clans = result.clans || [];
        if (!state.clanId || !state.clans.some(row => row.id === state.clanId)) {
          state.clanId = state.clans[0]?.id || "";
        }
      }
      if (!state.clanId) {
        state.bundle = null;
        root.innerHTML = '<div class="clan-empty">Вы пока не состоите в клане BALI.</div>';
        return;
      }
      state.bundle = await api(`/api/v1/clans/${encodeURIComponent(state.clanId)}/chat`);
      if (state.tab === "events") {
        const result = await api(`/api/v1/clans/${encodeURIComponent(state.clanId)}/events/available`);
        state.availableEvents = result.events || [];
      }
      await api(`/api/v1/clans/${encodeURIComponent(state.clanId)}/read`, json({}));
      renderClan();
    } catch (error) {
      root.innerHTML = `<div class="clan-empty">Не удалось открыть клан.<br>${esc(error.message)}</div>`;
    } finally {
      state.loading = false;
    }
  }

  function hero() {
    const clan = state.bundle.clan;
    return `
      <section class="clan-hero">
        <div class="clan-hero-top">
          <div><span class="eyebrow">BALI PEOPLE · КЛАН</span><h3>${esc(clan.name)}</h3><p>${state.bundle.chat.readOnly ? "Чат временно только для чтения" : "Закрытое пространство участников"}</p></div>
          <span class="clan-role">${esc(roleName(clan.role))}</span>
        </div>
        ${state.clans.length > 1 ? `<select class="clan-selector" data-clan-select>${state.clans.map(row => `<option value="${esc(row.id)}" ${row.id === state.clanId ? "selected" : ""}>${esc(row.name)} · ${esc(roleName(row.role))}</option>`).join("")}</select>` : ""}
      </section>
      <nav class="clan-main-tabs">
        ${[["chat","✦","Чат"],["members","●","Участники"],["polls","✓","Опросы"],["events","◫","События"]].map(([id,icon,label]) => `<button type="button" class="${state.tab === id ? "active" : ""}" data-clan-tab="${id}"><i>${icon}</i>${label}</button>`).join("")}
      </nav>`;
  }

  function announcements() {
    const row = state.bundle.announcements?.[0];
    if (!row) return "";
    return `<div class="clan-announcement"><strong>${row.official ? "ОФИЦИАЛЬНО · " : ""}${esc(row.title)}</strong><p>${esc(row.body)}</p></div>`;
  }

  function primaryEvent() {
    const row = state.bundle.events?.find(event => event.is_primary) || state.bundle.events?.[0];
    if (!row) return "";
    return `<div class="clan-event-mini">${row.image_url ? `<img src="${esc(row.image_url)}" alt="">` : '<div class="clan-avatar">B</div>'}<div><span class="eyebrow">СОБЫТИЕ КЛАНА</span><h4>${esc(row.title)}</h4><p>${esc(row.event_date || "")} · ${esc(row.event_time || "")}</p></div></div>`;
  }

  function chatView() {
    const messages = state.bundle.messages || [];
    return `
      <section class="clan-card">
        ${announcements()}${primaryEvent()}
        <div class="clan-messages" id="clanMessageList">
          ${messages.length ? messages.map(message => {
            const mine = String(message.author?.id) === currentUserId();
            return `<article class="clan-message ${mine ? "mine" : ""} ${message.messageType === "announcement" ? "announcement" : ""}">
              <div class="clan-message-meta"><strong>${esc(message.author?.name || "BALI")}</strong><time>${dateTime(message.createdAt)}</time></div>
              ${message.reply ? `<small>↪ ${esc(message.reply.authorName)}: ${esc(message.reply.body)}</small>` : ""}
              <p>${esc(message.body)}</p>
              <div class="clan-message-actions">
                ${can("message.reply") ? `<button type="button" data-clan-reply="${esc(message.id)}" data-clan-reply-name="${esc(message.author?.name || "BALI")}">Ответить</button>` : ""}
                ${(mine || can("message.delete_any")) && message.messageType !== "announcement" ? `<button type="button" data-clan-delete-message="${esc(message.id)}">Удалить</button>` : ""}
                ${!mine && can("report.create") ? `<button type="button" data-clan-report-message="${esc(message.id)}">Пожаловаться</button>` : ""}
              </div>
            </article>`;
          }).join("") : '<div class="clan-empty">Сообщений пока нет.</div>'}
        </div>
        ${can("message.create") && !state.bundle.chat.readOnly ? `
          <form class="clan-composer" id="clanMessageForm">
            <textarea name="body" maxlength="2000" placeholder="Сообщение участникам клана…" required></textarea>
            <input type="hidden" name="replyToId">
            <button type="submit">ОТПРАВИТЬ</button>
          </form>` : '<div class="clan-readonly">Лидер включил режим «только чтение».</div>'}
      </section>
      <section class="clan-card"><div class="clan-card-head"><h4>Уведомления</h4></div><div class="clan-tools">
        <label class="clan-notification"><input type="checkbox" data-clan-announcements-only ${state.bundle.notificationPreference?.announcements_only ? "checked" : ""}> Только важные объявления</label>
      </div></section>`;
  }

  async function membersView() {
    const result = await api(`/api/v1/clans/${encodeURIComponent(state.clanId)}/members`);
    const members = result.members || [];
    return `<section class="clan-card"><div class="clan-card-head"><h4>Участники</h4><small>${members.length}</small></div><div class="clan-member-list">
      ${members.map(member => `<article class="clan-member"><div class="clan-avatar">${esc(String(member.profile?.name || "B").split(/\s+/).map(part => part[0]).join("").slice(0, 2))}</div><div><h4>${esc(member.profile?.name || "Участник")}</h4><p>${member.profile?.username ? `@${esc(String(member.profile.username).replace(/^@/, ""))}` : "BALI PEOPLE"}</p></div><span>${esc(roleName(member.role))}</span></article>`).join("")}
    </div></section>`;
  }

  function pollsView() {
    const polls = state.bundle.polls || [];
    return `
      <section class="clan-card"><div class="clan-card-head"><h4>Опросы клана</h4><small>${polls.filter(row => row.status === "active").length} активных</small></div><div class="clan-poll-list">
        ${polls.length ? polls.map(poll => `<article class="clan-poll"><h4>${esc(poll.question)}</h4>${poll.options.map(option => `<button type="button" class="clan-poll-option ${poll.myOptionIds?.includes(option.id) ? "selected" : ""}" data-clan-vote="${esc(poll.id)}" data-option-id="${esc(option.id)}" ${poll.status !== "active" ? "disabled" : ""}><span>${esc(option.label)}</span><b>${Number(option.votes || 0)}</b></button>`).join("")}<small>${poll.status === "active" ? "Голосование открыто" : "Опрос завершён"}</small></article>`).join("") : '<div class="clan-empty">Опросов пока нет.</div>'}
      </div></section>
      ${can("poll.create") ? `<section class="clan-card"><div class="clan-card-head"><h4>Новый опрос</h4></div><div class="clan-tools"><form id="clanPollForm"><input name="question" maxlength="240" placeholder="Вопрос" required><textarea name="options" placeholder="Варианты, каждый с новой строки" required></textarea><button class="clan-action" type="submit">СОЗДАТЬ ОПРОС</button></form></div></section>` : ""}`;
  }

  function eventCard(row, available = false) {
    return `<article class="clan-event-mini">${row.image_url ? `<img src="${esc(row.image_url)}" alt="">` : '<div class="clan-avatar">B</div>'}<div><span class="eyebrow">${available ? "ДОСТУПНО" : row.is_primary ? "ГЛАВНОЕ" : "ПРИКРЕПЛЕНО"}</span><h4>${esc(row.title)}</h4><p>${esc(row.event_date || "")} · ${esc(row.event_time || "")}</p>${available && can("event.attach") ? `<button class="clan-action ghost" type="button" data-clan-attach-event="${esc(row.id)}">Прикрепить</button>` : ""}</div></article>`;
  }

  function eventsView() {
    return `
      <section class="clan-card"><div class="clan-card-head"><h4>События клана</h4><small>${state.bundle.events?.length || 0}</small></div><div class="clan-event-list">
        ${state.bundle.events?.length ? state.bundle.events.map(row => eventCard(row)).join("") : '<div class="clan-empty">События ещё не прикреплены.</div>'}
      </div></section>
      ${can("event.attach") ? `<section class="clan-card"><div class="clan-card-head"><h4>Добавить из афиши</h4></div><div class="clan-event-list">${state.availableEvents.length ? state.availableEvents.map(row => eventCard(row, true)).join("") : '<div class="clan-empty">Все доступные события уже прикреплены.</div>'}</div></section>` : ""}
      ${can("announcement.create") ? `<section class="clan-card"><div class="clan-card-head"><h4>Объявление участникам</h4></div><div class="clan-tools"><form id="clanAnnouncementForm"><input name="title" maxlength="120" placeholder="Заголовок" required><textarea name="body" maxlength="2000" placeholder="Текст объявления" required></textarea><button class="clan-action" type="submit">ОПУБЛИКОВАТЬ</button></form></div></section>` : ""}`;
  }

  async function renderClan() {
    const root = document.getElementById("baliPeopleClanPane");
    if (!root || !state.bundle) return;
    let content = "";
    if (state.tab === "chat") content = chatView();
    if (state.tab === "members") content = await membersView();
    if (state.tab === "polls") content = pollsView();
    if (state.tab === "events") content = eventsView();
    root.innerHTML = `<div class="clan-integrated-shell">${hero()}${content}</div>`;
    requestAnimationFrame(() => {
      const list = document.getElementById("clanMessageList");
      if (list) list.scrollTop = list.scrollHeight;
    });
  }

  document.addEventListener("click", async event => {
    const mode = event.target.closest("[data-people-mode]");
    if (mode) {
      state.mode = mode.dataset.peopleMode;
      renderMode();
      return;
    }
    const tab = event.target.closest("[data-clan-tab]");
    if (tab) {
      state.tab = tab.dataset.clanTab;
      await loadClan(true);
      return;
    }
    const reply = event.target.closest("[data-clan-reply]");
    if (reply) {
      const form = document.getElementById("clanMessageForm");
      if (!form) return;
      form.elements.replyToId.value = reply.dataset.clanReply;
      form.elements.body.placeholder = `Ответ для ${reply.dataset.clanReplyName}…`;
      form.elements.body.focus();
      return;
    }
    const remove = event.target.closest("[data-clan-delete-message]");
    if (remove && confirm("Удалить сообщение из чата?")) {
      await api(`/api/v1/clans/${encodeURIComponent(state.clanId)}/messages/${encodeURIComponent(remove.dataset.clanDeleteMessage)}`, { method:"DELETE" });
      toast("Сообщение удалено");
      await loadClan(true);
      return;
    }
    const report = event.target.closest("[data-clan-report-message]");
    if (report) {
      const reason = prompt("Причина жалобы:", "Нарушение правил клана");
      if (!reason) return;
      await api(`/api/v1/clans/${encodeURIComponent(state.clanId)}/messages/${encodeURIComponent(report.dataset.clanReportMessage)}/reports`, json({ reason }));
      toast("Жалоба отправлена модераторам");
      return;
    }
    const vote = event.target.closest("[data-clan-vote]");
    if (vote) {
      await api(`/api/v1/clans/${encodeURIComponent(state.clanId)}/polls/${encodeURIComponent(vote.dataset.clanVote)}/votes`, json({ optionIds:[vote.dataset.optionId] }));
      toast("Голос учтён");
      await loadClan(true);
      return;
    }
    const attach = event.target.closest("[data-clan-attach-event]");
    if (attach) {
      await api(`/api/v1/clans/${encodeURIComponent(state.clanId)}/events`, json({ eventId:attach.dataset.clanAttachEvent }));
      toast("Событие прикреплено");
      await loadClan(true);
    }
  });

  document.addEventListener("change", async event => {
    if (event.target.matches("[data-clan-select]")) {
      state.clanId = event.target.value;
      state.bundle = null;
      await loadClan(true);
    }
    if (event.target.matches("[data-clan-announcements-only]")) {
      await api(`/api/v1/clans/${encodeURIComponent(state.clanId)}/notifications`, {
        method:"PUT",
        body:JSON.stringify({ announcementsOnly:event.target.checked, mutedUntil:null })
      });
      toast("Настройки уведомлений сохранены");
      await loadClan(true);
    }
  });

  document.addEventListener("submit", async event => {
    if (event.target.id === "clanMessageForm") {
      event.preventDefault();
      const form = new FormData(event.target);
      await api(`/api/v1/clans/${encodeURIComponent(state.clanId)}/messages`, json({
        body:form.get("body"), replyToId:form.get("replyToId") || null
      }));
      event.target.reset();
      await loadClan(true);
    }
    if (event.target.id === "clanPollForm") {
      event.preventDefault();
      const form = new FormData(event.target);
      const options = String(form.get("options") || "").split(/\r?\n/).map(row => row.trim()).filter(Boolean);
      await api(`/api/v1/clans/${encodeURIComponent(state.clanId)}/polls`, json({
        question:form.get("question"), options, allowMultiple:false
      }));
      toast("Опрос создан");
      await loadClan(true);
    }
    if (event.target.id === "clanAnnouncementForm") {
      event.preventDefault();
      const form = new FormData(event.target);
      await api(`/api/v1/clans/${encodeURIComponent(state.clanId)}/announcements`, json({
        title:form.get("title"), body:form.get("body")
      }));
      toast("Объявление опубликовано");
      state.tab = "chat";
      await loadClan(true);
    }
  });

  window.addEventListener("bali:demo-user-changed", () => {
    state.bundle = null;
    if (state.mode === "clan") loadClan(true);
  });
  window.addEventListener("bali:clan-beta-updated", () => {
    if (state.mode === "clan" && !state.loading) loadClan(true);
  });
  window.addEventListener("storage", event => {
    if (event.key !== (window.BaliClans?.storageKey || "bali_clans_integrated_demo_v1")) return;
    state.bundle = null;
    if (state.mode === "clan" && !state.loading) loadClan(true);
  });

  installStyles();
  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (mount() || attempts > 100) clearInterval(timer);
  }, 50);
})();
