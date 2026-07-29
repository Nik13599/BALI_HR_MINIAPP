(() => {
  "use strict";
  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;"
  })[char]);
  const formatDate = value => value ? new Date(value).toLocaleString("ru-RU", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" }) : "";
  const roleName = role => role === "leader" ? "Главный" : role === "deputy" ? "Заместитель" : role === "moderator" ? "Модератор" : "Участник";

  window.BaliClanChatApp = function BaliClanChatApp({ api, user }) {
    const state = {
      clans: [],
      activeClanId: "",
      tab: "home",
      bundle: null,
      members: [],
      availableEvents: [],
      reply: null,
      refreshTimer: null
    };
    const view = document.getElementById("clanView");
    const composer = document.getElementById("messageComposer");
    const dialog = document.getElementById("actionDialog");
    const dialogForm = document.getElementById("actionDialogForm");
    const dialogBody = document.getElementById("dialogBody");
    const toastNode = document.getElementById("toast");

    const can = permission => state.bundle?.permissions?.includes(permission);
    function toast(message) {
      toastNode.textContent = message;
      toastNode.classList.add("show");
      clearTimeout(toast.timer);
      toast.timer = setTimeout(() => toastNode.classList.remove("show"), 2400);
    }
    async function action(work, success) {
      try {
        const result = await work();
        if (success) toast(success);
        return result;
      } catch (error) {
        toast(error.message || "Не удалось выполнить действие");
        throw error;
      }
    }
    function modal(title, eyebrow, html, submitHandler) {
      document.getElementById("dialogTitle").textContent = title;
      document.getElementById("dialogEyebrow").textContent = eyebrow;
      dialogBody.innerHTML = html;
      dialogForm.onsubmit = async event => {
        if (event.submitter?.value === "cancel") return;
        event.preventDefault();
        await submitHandler(new FormData(dialogForm));
      };
      dialog.showModal();
    }

    function renderClanSwitcher() {
      document.getElementById("clanSwitcher").innerHTML = state.clans.map(clan => `
        <button type="button" class="${clan.id === state.activeClanId ? "active" : ""}" data-select-clan="${esc(clan.id)}">
          ${esc(clan.name)}${Number(clan.unread_count) ? `<b>${Number(clan.unread_count)}</b>` : ""}
        </button>`).join("");
    }
    function renderHeader() {
      const clan = state.bundle?.clan;
      document.getElementById("clanTitle").textContent = clan?.name || "Клан BALI";
      document.getElementById("clanSubtitle").textContent = state.bundle?.chat?.enabled ? "Только для действующих участников" : "Чат временно отключён";
      document.getElementById("clanRole").textContent = roleName(clan?.role);
      const status = document.getElementById("chatStatus");
      const notes = [];
      if (!state.bundle?.chat?.enabled) notes.push("Чат отключён администрацией");
      if (state.bundle?.chat?.readOnly) notes.push("Включён режим «только чтение»");
      status.hidden = !notes.length;
      status.textContent = notes.join(" · ");
      const pins = state.bundle?.pins || [];
      const pinned = document.getElementById("pinnedStrip");
      pinned.hidden = !pins.length;
      pinned.innerHTML = pins.length ? `⌑ Закреплено материалов: <b>${pins.length}</b>` : "";
      composer.hidden = state.tab !== "chat" || !can("message.create");
    }

    function renderMessages() {
      const messages = state.bundle?.messages || [];
      view.innerHTML = `
        <div class="section-head"><h2>Общий чат</h2>
          <div>${can("announcement.create") ? '<button type="button" data-create-announcement>Объявление</button>' : ""}</div>
        </div>
        ${messages.length ? `<div class="message-list">${messages.map(message => `
          <article class="message ${message.messageType === "announcement" ? "announcement" : ""}">
            <span class="message-avatar">${esc((message.author?.name || "B")[0])}</span>
            <div>
              <header class="message-head"><b>${esc(message.author?.name || "BALI")}</b><time>${esc(formatDate(message.createdAt))}</time></header>
              ${message.reply ? `<div class="message-reply"><b>${esc(message.reply.authorName)}</b> · ${esc(message.reply.body)}</div>` : ""}
              <p class="message-body">${esc(message.body)}</p>
              ${!message.deleted ? `<div class="message-actions">
                ${can("message.reply") ? `<button type="button" data-reply-message="${esc(message.id)}" data-reply-label="${esc(message.author?.name || "BALI")}: ${esc(message.body.slice(0,80))}">Ответить</button>` : ""}
                ${message.author?.id === user.id || can("message.delete_any") ? `<button type="button" data-delete-message="${esc(message.id)}">Удалить</button>` : ""}
                ${can("report.create") ? `<button type="button" data-report-message="${esc(message.id)}">Пожаловаться</button>` : ""}
              </div>` : ""}
            </div>
          </article>`).join("")}</div>` : '<div class="empty-card">В этом клане пока нет сообщений. Начните общение первым.</div>'}`;
    }

    function renderOverview() {
      const messages = state.bundle?.messages || [];
      const polls = state.bundle?.polls || [];
      const events = state.bundle?.events || [];
      const announcements = state.bundle?.announcements || [];
      const lastMessage = messages.at(-1);
      const activePoll = polls.find(row => row.status === "active");
      const nextEvent = events.find(row => row.active !== false);
      const announcement = announcements[0];
      const currentClan = state.clans.find(row => row.id === state.activeClanId);
      view.innerHTML = `<div class="section-head"><h2>Главная клана</h2><span class="role-badge">${Number(currentClan?.unread_count || 0)} новых</span></div>
        <div class="overview-grid">
          <article class="overview-card wide"><span>ПОСЛЕДНЕЕ СООБЩЕНИЕ</span><h3>${esc(lastMessage?.author?.name || "Чат BALI")}</h3><p>${esc(lastMessage?.body || "Сообщений пока нет")}</p></article>
          <article class="overview-card"><span>АКТИВНЫЙ ОПРОС</span><h3>${esc(activePoll?.question || "Нет опроса")}</h3><p>${activePoll ? `${activePoll.options.length} вариантов ответа` : "Главный клана может создать новый опрос"}</p></article>
          <article class="overview-card"><span>БЛИЖАЙШЕЕ СОБЫТИЕ</span><h3>${esc(nextEvent?.title || "Не выбрано")}</h3><p>${nextEvent ? `${esc(nextEvent.event_date)} · ${esc(String(nextEvent.event_time || "").slice(0,5))}` : "Событие пока не прикреплено"}</p></article>
          <article class="overview-card wide"><span>ВАЖНОЕ ОБЪЯВЛЕНИЕ</span><h3>${esc(announcement?.title || "Новости клана")}</h3><p>${esc(announcement?.body || "Новых объявлений пока нет")}</p></article>
        </div>`;
    }

    function renderPolls() {
      const polls = state.bundle?.polls || [];
      view.innerHTML = `
        <div class="section-head"><h2>Опросы</h2>${can("poll.create") ? '<button type="button" data-create-poll>Создать</button>' : ""}</div>
        ${polls.length ? polls.map(poll => {
          const total = poll.options.reduce((sum, option) => sum + Number(option.votes || 0), 0);
          return `<article class="poll-card">
            <header><h3>${esc(poll.question)}</h3><span>${poll.status === "active" ? "Активен" : esc(poll.status)}</span></header>
            <form class="poll-options" data-vote-poll="${esc(poll.id)}">
              ${poll.options.map(option => {
                const percent = total ? Math.round(Number(option.votes || 0) / total * 100) : 0;
                const selected = poll.myOptionIds.includes(option.id);
                return `<label class="poll-option"><span class="poll-bar" style="width:${percent}%"></span>
                  <input type="${poll.allow_multiple ? "checkbox" : "radio"}" name="optionId" value="${esc(option.id)}" ${selected ? "checked" : ""} ${poll.status !== "active" ? "disabled" : ""}>
                  <span>${esc(option.label)}</span><b>${Number(option.votes || 0)}</b>
                </label>`;
              }).join("")}
              ${poll.status === "active" && can("poll.vote") ? '<button class="primary-button" type="submit">Голосовать</button>' : ""}
            </form>
            <div class="card-actions">
              ${poll.status === "active" && can("poll.finish") ? `<button type="button" data-poll-finish="${esc(poll.id)}">Завершить</button>` : ""}
              ${poll.status === "active" && can("poll.cancel") ? `<button type="button" data-poll-cancel="${esc(poll.id)}">Отменить</button>` : ""}
              ${can("poll.delete") ? `<button type="button" data-poll-delete="${esc(poll.id)}">Удалить</button>` : ""}
            </div>
          </article>`;
        }).join("") : '<div class="empty-card">Активных опросов пока нет.</div>'}`;
    }

    function renderEvents() {
      const events = state.bundle?.events || [];
      view.innerHTML = `
        <div class="section-head"><h2>События клана</h2>${can("event.attach") ? '<button type="button" data-attach-event>Прикрепить</button>' : ""}</div>
        ${events.length ? events.map(row => `<article class="event-card ${row.is_primary ? "primary-event" : ""}">
          ${row.image_url ? `<img src="${esc(row.image_url)}" alt="">` : '<img alt="">'}
          <div><header><h3>${esc(row.title)}</h3>${row.is_primary ? "<span>ГЛАВНОЕ</span>" : ""}</header>
          <p>${esc(row.event_date)} · ${esc(String(row.event_time || "").slice(0,5))}</p><p>${esc(row.description || "")}</p>
          <div class="card-actions">
            ${can("event.set_primary") && !row.is_primary ? `<button type="button" data-primary-event="${esc(row.id)}">Сделать главным</button>` : ""}
            ${can("event.detach") ? `<button type="button" data-detach-event="${esc(row.id)}">Открепить</button>` : ""}
          </div></div>
        </article>`).join("") : '<div class="empty-card">Клан пока не прикрепил мероприятия.</div>'}`;
    }

    function renderMembers() {
      view.innerHTML = `<div class="section-head"><h2>Участники</h2><span class="role-badge">${state.members.length}</span></div>
        <div class="member-list">${state.members.map(member => `<article class="member-card">
          <span class="message-avatar">${esc((member.profile.name || "B")[0])}</span>
          <div><h3>${esc(member.profile.name)}</h3><small>${member.profile.username ? `@${esc(member.profile.username)}` : "Контакты скрыты настройками"}</small></div>
          <span>${esc(roleName(member.role))}</span>
        </article>`).join("")}</div>`;
    }

    function render() {
      renderClanSwitcher();
      renderHeader();
      document.querySelectorAll("[data-clan-tab]").forEach(button => button.classList.toggle("active", button.dataset.clanTab === state.tab));
      if (state.tab === "home") renderOverview();
      else if (state.tab === "polls") renderPolls();
      else if (state.tab === "events") renderEvents();
      else if (state.tab === "members") renderMembers();
      else renderMessages();
    }

    async function loadClan(clanId, quiet = false) {
      state.activeClanId = clanId;
      if (!quiet) view.innerHTML = '<div class="loading-card">Загружаем закрытый чат…</div>';
      const [bundle, members, available] = await Promise.all([
        api(`/api/v1/clans/${encodeURIComponent(clanId)}/chat`),
        api(`/api/v1/clans/${encodeURIComponent(clanId)}/members`),
        api(`/api/v1/clans/${encodeURIComponent(clanId)}/events/available`)
      ]);
      state.bundle = bundle;
      state.members = members.members || [];
      state.availableEvents = available.events || [];
      const last = bundle.messages.at(-1);
      if (last) {
        await api(`/api/v1/clans/${encodeURIComponent(clanId)}/read`, {
          method: "POST",
          body: JSON.stringify({ messageId: last.id })
        });
      }
      render();
    }

    async function loadClans() {
      const payload = await api("/api/v1/clans");
      state.clans = payload.clans || [];
      if (!state.clans.length) {
        document.getElementById("clanSwitcher").innerHTML = "";
        view.innerHTML = '<div class="empty-card">У вас пока нет активного членства в клане.</div>';
        composer.hidden = true;
        return;
      }
      const next = state.clans.some(row => row.id === state.activeClanId) ? state.activeClanId : state.clans[0].id;
      await loadClan(next);
    }

    function setReply(id, label) {
      state.reply = id ? { id, label } : null;
      const node = document.getElementById("replyPreview");
      node.hidden = !state.reply;
      document.getElementById("replyPreviewText").textContent = state.reply ? `Ответ: ${state.reply.label}` : "";
      composer.elements.body.focus();
    }

    document.addEventListener("click", async event => {
      const clan = event.target.closest("[data-select-clan]");
      if (clan) return loadClan(clan.dataset.selectClan);
      const tab = event.target.closest("[data-clan-tab]");
      if (tab) { state.tab = tab.dataset.clanTab; return render(); }
      if (event.target.closest("[data-notification-settings]")) {
        const preference = state.bundle?.notificationPreference || {};
        const muted = preference.muted_until && new Date(preference.muted_until).getTime() > Date.now();
        const selected = preference.announcements_only ? "announcements" : muted ? "muted" : "all";
        return modal("Уведомления", "ЛИЧНЫЕ НАСТРОЙКИ", `<label>Режим<select name="mode">
          <option value="all" ${selected === "all" ? "selected" : ""}>Все сообщения</option>
          <option value="announcements" ${selected === "announcements" ? "selected" : ""}>Только объявления</option>
          <option value="muted" ${selected === "muted" ? "selected" : ""}>Выключить на 8 часов</option>
        </select></label><button class="dialog-submit" type="submit">Сохранить</button>`, async data => {
          const mode = String(data.get("mode") || "all");
          await action(() => api(`/api/v1/clans/${state.activeClanId}/notifications`, {
            method:"PUT",
            body:JSON.stringify({
              announcementsOnly:mode === "announcements",
              mutedUntil:mode === "muted" ? new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString() : null
            })
          }), "Настройки уведомлений сохранены");
          dialog.close();
          await loadClan(state.activeClanId, true);
        });
      }
      const reply = event.target.closest("[data-reply-message]");
      if (reply) return setReply(reply.dataset.replyMessage, reply.dataset.replyLabel);
      if (event.target.closest("[data-cancel-reply]")) return setReply("", "");
      const remove = event.target.closest("[data-delete-message]");
      if (remove && confirm("Удалить сообщение?")) {
        await action(() => api(`/api/v1/clans/${state.activeClanId}/messages/${remove.dataset.deleteMessage}`, { method:"DELETE", body:"{}" }), "Сообщение удалено");
        return loadClan(state.activeClanId, true);
      }
      const report = event.target.closest("[data-report-message]");
      if (report) return modal("Жалоба", "МОДЕРАЦИЯ", '<label>Причина<textarea name="reason" maxlength="1000" required></textarea></label><button class="dialog-submit" type="submit">Отправить жалобу</button>', async data => {
        await action(() => api(`/api/v1/clans/${state.activeClanId}/messages/${report.dataset.reportMessage}/reports`, { method:"POST", body:JSON.stringify({ reason:data.get("reason") }) }), "Жалоба отправлена");
        dialog.close();
      });
      if (event.target.closest("[data-create-poll]")) return modal("Новый опрос", "КЛАНОВОЕ ГОЛОСОВАНИЕ", '<label>Вопрос<input name="question" maxlength="500" required></label><label>Варианты — по одному в строке<textarea name="options" required>Буду\nНе буду</textarea></label><label><span>Разрешить несколько ответов</span><input name="multiple" type="checkbox"></label><button class="dialog-submit" type="submit">Создать опрос</button>', async data => {
        const options = String(data.get("options") || "").split(/\r?\n/).map(row => row.trim()).filter(Boolean);
        await action(() => api(`/api/v1/clans/${state.activeClanId}/polls`, { method:"POST", body:JSON.stringify({ question:data.get("question"), options, allowMultiple:data.get("multiple") === "on" }) }), "Опрос создан");
        dialog.close(); await loadClan(state.activeClanId, true);
      });
      for (const actionName of ["finish", "cancel", "delete"]) {
        const button = event.target.closest(`[data-poll-${actionName}]`);
        if (button && confirm("Подтвердить действие с опросом?")) {
          const id = button.dataset[`poll${actionName[0].toUpperCase()}${actionName.slice(1)}`];
          await action(() => api(`/api/v1/clans/${state.activeClanId}/polls/${id}${actionName === "delete" ? "" : `/${actionName}`}`, { method:actionName === "delete" ? "DELETE" : "POST", body:"{}" }), "Опрос обновлён");
          return loadClan(state.activeClanId, true);
        }
      }
      if (event.target.closest("[data-attach-event]")) {
        return modal("Прикрепить событие", "ОФИЦИАЛЬНАЯ АФИША BALI", `<label>Событие<select name="eventId">${state.availableEvents.map(row => `<option value="${esc(row.id)}">${esc(row.title)} · ${esc(row.event_date)}</option>`).join("")}</select></label><button class="dialog-submit" type="submit">Прикрепить</button>`, async data => {
          await action(() => api(`/api/v1/clans/${state.activeClanId}/events`, { method:"POST", body:JSON.stringify({ eventId:data.get("eventId") }) }), "Событие прикреплено");
          dialog.close(); await loadClan(state.activeClanId, true);
        });
      }
      const detach = event.target.closest("[data-detach-event]");
      if (detach && confirm("Открепить событие?")) {
        await action(() => api(`/api/v1/clans/${state.activeClanId}/events/${detach.dataset.detachEvent}`, { method:"DELETE", body:"{}" }), "Событие откреплено");
        return loadClan(state.activeClanId, true);
      }
      const primary = event.target.closest("[data-primary-event]");
      if (primary) {
        await action(() => api(`/api/v1/clans/${state.activeClanId}/events/${primary.dataset.primaryEvent}/primary`, { method:"POST", body:"{}" }), "Главное событие выбрано");
        return loadClan(state.activeClanId, true);
      }
      if (event.target.closest("[data-create-announcement]")) return modal("Объявление", "ОФИЦИАЛЬНО ОТ КЛАНА", '<label>Заголовок<input name="title" maxlength="200"></label><label>Текст<textarea name="body" maxlength="4000" required></textarea></label><button class="dialog-submit" type="submit">Опубликовать</button>', async data => {
        await action(() => api(`/api/v1/clans/${state.activeClanId}/announcements`, { method:"POST", body:JSON.stringify({ title:data.get("title"), body:data.get("body") }) }), "Объявление опубликовано");
        dialog.close(); await loadClan(state.activeClanId, true);
      });
    });

    document.addEventListener("submit", async event => {
      const vote = event.target.closest("[data-vote-poll]");
      if (vote) {
        event.preventDefault();
        const optionIds = [...new FormData(vote).getAll("optionId")];
        await action(() => api(`/api/v1/clans/${state.activeClanId}/polls/${vote.dataset.votePoll}/votes`, { method:"POST", body:JSON.stringify({ optionIds }) }), "Голос учтён");
        return loadClan(state.activeClanId, true);
      }
    });
    composer.addEventListener("submit", async event => {
      event.preventDefault();
      const body = String(new FormData(composer).get("body") || "").trim();
      if (!body) return;
      await action(() => api(`/api/v1/clans/${state.activeClanId}/messages`, { method:"POST", body:JSON.stringify({ body, replyToId:state.reply?.id || null }) }), "Отправлено");
      composer.reset(); setReply("", ""); await loadClan(state.activeClanId, true);
      requestAnimationFrame(() => window.scrollTo({ top:document.body.scrollHeight, behavior:"smooth" }));
    });

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden && state.activeClanId) loadClan(state.activeClanId, true).catch(() => {});
    });
    state.refreshTimer = setInterval(() => {
      if (!document.hidden && state.activeClanId) loadClan(state.activeClanId, true).catch(() => {});
    }, 12000);
    loadClans().catch(error => {
      view.innerHTML = `<div class="empty-card">${esc(error.message || "Не удалось открыть кланы")}</div>`;
    });
    return { reload:loadClans, destroy:() => clearInterval(state.refreshTimer) };
  };
})();
