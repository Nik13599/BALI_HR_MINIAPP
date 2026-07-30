(() => {
  "use strict";
  if (window.__BALI_PRODUCTION_SOCIAL_UI__) return;
  window.__BALI_PRODUCTION_SOCIAL_UI__ = true;

  const production = window.BaliProduction;
  if (!production) return;
  let activeConversation = null;

  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  }[char]));
  const toast = message => {
    const node = document.getElementById("toast");
    if (!node) return;
    node.textContent = message;
    node.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove("show"), 2300);
  };
  const myId = () => String(production.state.me?.id || production.state.profile?.id || "");
  const connectionFor = userKey => production.state.social.connections.find(row =>
    String(row.peer_user_key) === String(userKey)
  );

  async function refreshSocial() {
    const [connections, conversations, invitations] = await Promise.all([
      production.api("/api/v1/social/connections"),
      production.api("/api/v1/social/conversations"),
      production.api("/api/v1/events/invitations/me"),
    ]);
    production.state.social = {
      connections: connections.connections || [],
      conversations: conversations.conversations || [],
      invitations: invitations.invitations || [],
    };
    renderPanel();
    enhanceCards();
  }

  function ensureDialogs() {
    if (!document.getElementById("productionInviteDialog")) {
      const invite = document.createElement("dialog");
      invite.id = "productionInviteDialog";
      invite.className = "social-v2-dialog";
      invite.innerHTML = `<div class="social-v2-sheet"><div class="social-v2-head"><strong>Пригласить на мероприятие</strong><button class="social-v2-close" type="button" data-close-production-social>×</button></div><div class="production-social-list" id="productionInviteList"></div></div>`;
      document.body.appendChild(invite);
    }
    if (!document.getElementById("productionChatDialog")) {
      const chat = document.createElement("dialog");
      chat.id = "productionChatDialog";
      chat.className = "social-v2-dialog production-chat-dialog";
      chat.innerHTML = `<div class="social-v2-sheet"><div class="social-v2-head"><strong id="productionChatTitle">Личный чат</strong><button class="social-v2-close" type="button" data-close-production-social>×</button></div><div class="production-chat-messages" id="productionChatMessages"></div><form class="production-chat-form" id="productionChatForm"><textarea name="body" maxlength="4000" placeholder="Сообщение" required></textarea><button class="primary" type="submit">Отправить</button></form></div>`;
      document.body.appendChild(chat);
    }
  }

  function ensurePanel() {
    const tabs = document.querySelector('[data-screen="dating"] .social-tabs-v2');
    if (!tabs) return null;
    let panel = document.getElementById("productionSocialPanel");
    if (!panel) {
      panel = document.createElement("section");
      panel.id = "productionSocialPanel";
      panel.className = "production-social-panel";
      tabs.insertAdjacentElement("afterend", panel);
    }
    return panel;
  }

  function renderPanel() {
    const panel = ensurePanel();
    if (!panel) return;
    const connections = production.state.social.connections;
    const incoming = connections.filter(row =>
      row.status === "pending" && String(row.recipient_user_key) === myId()
    );
    const accepted = connections.filter(row => row.status === "accepted");
    const invitations = production.state.social.invitations.filter(row => row.status === "pending");
    panel.innerHTML = `
      <details ${incoming.length || invitations.length ? "open" : ""}>
        <summary>Мои люди и приглашения <b>${incoming.length + invitations.length}</b></summary>
        <div class="production-social-list">
          ${incoming.map(row => `<article><div><strong>${esc(row.peer_name)}</strong><small>Хочет познакомиться</small></div><div><button data-connection-response="${esc(row.id)}" data-status="accepted">Принять</button><button data-connection-response="${esc(row.id)}" data-status="declined">Отклонить</button></div></article>`).join("")}
          ${invitations.map(row => `<article><div><strong>${esc(row.sender_name)}</strong><small>Приглашает: ${esc(row.event_title)}</small></div><div><button data-invitation-response="${esc(row.id)}" data-status="going">Иду</button><button data-invitation-response="${esc(row.id)}" data-status="maybe">Возможно</button><button data-invitation-response="${esc(row.id)}" data-status="declined">Нет</button></div></article>`).join("")}
          ${accepted.map(row => `<article><div><strong>${esc(row.peer_name)}</strong><small>В «Моих людях»</small></div>${row.conversation_id ? `<button data-open-conversation="${esc(row.conversation_id)}" data-peer-name="${esc(row.peer_name)}">Чат</button>` : ""}</article>`).join("")}
          ${!incoming.length && !invitations.length && !accepted.length ? '<div class="empty">Заявок и знакомств пока нет</div>' : ""}
        </div>
      </details>`;
  }

  function enhanceCards() {
    document.querySelectorAll(".person-v2[data-open-social-person]").forEach(card => {
      const userKey = card.dataset.openSocialPerson;
      const person = production.state.people.find(row => String(row.id || row.user_key) === String(userKey));
      const actions = card.querySelector(".person-v2-actions");
      if (!person || !actions) return;
      const connection = connectionFor(userKey);
      if (person.actions?.canConnect && !connection && !actions.querySelector("[data-connect-person]")) {
        actions.insertAdjacentHTML("beforeend", `<button type="button" title="Познакомиться" data-connect-person="${esc(userKey)}">🤝</button>`);
      }
      if (person.actions?.canInvite && !actions.querySelector("[data-invite-person]")) {
        actions.insertAdjacentHTML("beforeend", `<button type="button" title="Пригласить на мероприятие" data-invite-person="${esc(userKey)}">🎟</button>`);
      }
      if ((person.clans || []).length && !actions.querySelector("[data-person-clans]")) {
        actions.insertAdjacentHTML("beforeend", `<button type="button" title="Кланы" data-person-clans="${esc(userKey)}">🏛</button>`);
      }
      if (connection?.conversation_id && !actions.querySelector("[data-open-conversation]")) {
        actions.insertAdjacentHTML("beforeend", `<button type="button" title="Личный чат" data-open-conversation="${esc(connection.conversation_id)}" data-peer-name="${esc(person.name)}">💬</button>`);
      }
    });
  }

  function openInvite(userKey) {
    ensureDialogs();
    const events = production.state.events.filter(row =>
      !["completed", "archived", "cancelled"].includes(row.status)
    );
    const list = document.getElementById("productionInviteList");
    list.innerHTML = events.map(row => `<button type="button" data-send-event-invite="${esc(row.id)}" data-user-key="${esc(userKey)}"><strong>${esc(row.title)}</strong><small>${esc(row.event_date)} · ${esc(row.event_time)}</small></button>`).join("") || '<div class="empty">Нет доступных мероприятий</div>';
    document.getElementById("productionInviteDialog").showModal();
  }

  async function openConversation(conversationId, peerName) {
    ensureDialogs();
    activeConversation = conversationId;
    document.getElementById("productionChatTitle").textContent = peerName || "Личный чат";
    const result = await production.api(`/api/v1/social/conversations/${encodeURIComponent(conversationId)}/messages`);
    const root = document.getElementById("productionChatMessages");
    root.innerHTML = (result.messages || []).map(row => `<article class="${row.sender_user_key === myId() ? "mine" : ""}"><strong>${esc(row.author_name || peerName || "BALI")}</strong><p>${esc(row.body)}</p><small>${new Date(row.created_at).toLocaleString("ru-RU")}</small></article>`).join("") || '<div class="empty">Начните общение</div>';
    const dialog = document.getElementById("productionChatDialog");
    if (!dialog.open) dialog.showModal();
    root.scrollTop = root.scrollHeight;
  }

  document.addEventListener("click", async event => {
    try {
      const connect = event.target.closest("[data-connect-person]");
      if (connect) {
      event.preventDefault();
      event.stopPropagation();
      await production.api("/api/v1/social/connections", {
        method: "POST",
        body: JSON.stringify({ recipientUserKey: connect.dataset.connectPerson }),
      });
      toast("Заявка на знакомство отправлена");
      return refreshSocial();
    }
    const invite = event.target.closest("[data-invite-person]");
    if (invite) {
      event.preventDefault();
      event.stopPropagation();
      return openInvite(invite.dataset.invitePerson);
    }
    const sendInvite = event.target.closest("[data-send-event-invite]");
    if (sendInvite) {
      await production.api(`/api/v1/events/${encodeURIComponent(sendInvite.dataset.sendEventInvite)}/invitations`, {
        method: "POST",
        body: JSON.stringify({ recipientUserKey: sendInvite.dataset.userKey }),
      });
      document.getElementById("productionInviteDialog").close();
      return toast("Приглашение отправлено");
    }
    const response = event.target.closest("[data-connection-response]");
    if (response) {
      await production.api(`/api/v1/social/connections/${encodeURIComponent(response.dataset.connectionResponse)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: response.dataset.status }),
      });
      toast("Ответ сохранён");
      return refreshSocial();
    }
    const invitation = event.target.closest("[data-invitation-response]");
    if (invitation) {
      await production.api(`/api/v1/events/invitations/${encodeURIComponent(invitation.dataset.invitationResponse)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: invitation.dataset.status }),
      });
      toast("Ответ на приглашение сохранён");
      await production.refreshCore();
      return refreshSocial();
    }
    const chat = event.target.closest("[data-open-conversation]");
    if (chat) return openConversation(chat.dataset.openConversation, chat.dataset.peerName);
    const clans = event.target.closest("[data-person-clans]");
    if (clans) {
      document.querySelector('[data-people-mode="ranking"]')?.click();
      return;
    }
      if (event.target.closest("[data-close-production-social]")) {
        event.target.closest("dialog")?.close();
      }
    } catch (error) {
      toast(error.message || "Действие не выполнено");
    }
  });

  document.addEventListener("submit", async event => {
    if (event.target.id !== "productionChatForm" || !activeConversation) return;
    event.preventDefault();
    try {
      const data = new FormData(event.target);
      await production.api(`/api/v1/social/conversations/${encodeURIComponent(activeConversation)}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: data.get("body") }),
      });
      event.target.reset();
      await openConversation(activeConversation, document.getElementById("productionChatTitle").textContent);
    } catch (error) {
      toast(error.message || "Сообщение не отправлено");
    }
  });

  window.addEventListener("bali:production-refreshed", () => requestAnimationFrame(() => {
    renderPanel();
    enhanceCards();
  }));
  new MutationObserver(() => {
    ensurePanel();
    enhanceCards();
  }).observe(document.body, { childList: true, subtree: true });
  ensureDialogs();
  renderPanel();
  enhanceCards();
})();
