(() => {
  if (window.__BALI_ADMIN_MESSAGES_PRODUCTION__) return;
  window.__BALI_ADMIN_MESSAGES_PRODUCTION__ = true;

  const store = window.BaliStore;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);

  const state = {
    conversations: [],
    messages: [],
    selected: null,
    search: "",
    channel: null,
    opened: false
  };

  const personName = row => [row.first_name, row.last_name].filter(Boolean).join(" ") || row.username || "Пользователь Telegram";
  const initials = row => [row.first_name, row.last_name].filter(Boolean).map(value => String(value)[0]).join("").slice(0, 2).toUpperCase() || "TG";
  const when = value => value ? new Date(value).toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
  }) : "";

  function toast(message) {
    const node = $("#toast");
    if (!node) return;
    node.textContent = message;
    node.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove("show"), 2600);
  }

  function badge() {
    const node = $("#adminMessagesNavBadge");
    if (!node) return;
    const total = state.conversations.reduce((sum, row) => sum + Number(row.unread_admin || 0), 0);
    node.textContent = total > 99 ? "99+" : String(total);
    node.style.display = total ? "grid" : "none";
  }

  async function loadConversations() {
    if (!store?.cloudEnabled || !store.client) {
      state.conversations = [];
      badge();
      return;
    }
    const { data, error } = await store.client
      .from("telegram_conversations")
      .select("*")
      .order("last_message_at", { ascending: false, nullsFirst: false });
    if (error) throw error;
    state.conversations = data || [];
    if (state.selected && !state.conversations.some(row => row.id === state.selected)) {
      state.selected = state.conversations[0]?.id || null;
    }
    badge();
  }

  async function loadMessages() {
    if (!state.selected || !store?.cloudEnabled || !store.client) {
      state.messages = [];
      return;
    }
    const { data, error } = await store.client
      .from("telegram_messages")
      .select("*")
      .eq("conversation_id", state.selected)
      .order("created_at", { ascending: true });
    if (error) throw error;
    state.messages = data || [];
  }

  function filteredConversations() {
    const query = state.search.trim().toLowerCase();
    if (!query) return state.conversations;
    return state.conversations.filter(row =>
      `${personName(row)} ${row.username || ""} ${row.last_message_text || ""}`.toLowerCase().includes(query)
    );
  }

  function avatar(row, large = false) {
    const className = large ? "admin-chat-avatar" : "admin-conversation-avatar";
    return `<span class="${className}">${row?.photo_url ? `<img src="${esc(row.photo_url)}" alt="">` : esc(initials(row || {}))}</span>`;
  }

  function conversationRow(row) {
    return `<button class="admin-conversation ${row.id === state.selected ? "active" : ""}" data-live-dialog="${esc(row.id)}">
      ${avatar(row)}
      <span class="admin-conversation-copy">
        <span class="admin-conversation-name"><strong>${esc(personName(row))}</strong></span>
        <p>${esc(row.last_message_text || "Новый диалог")}</p>
      </span>
      <span class="admin-conversation-meta">
        <time>${when(row.last_message_at)}</time>
        ${Number(row.unread_admin || 0) ? `<b class="admin-unread">${Number(row.unread_admin)}</b>` : ""}
      </span>
    </button>`;
  }

  function messageRow(message) {
    const direction = message.direction === "admin" ? "admin" : message.direction === "system" ? "system" : "user";
    const sender = direction === "admin" ? "BALI" : direction === "system" ? "СИСТЕМА" : "ГОСТЬ";
    return `<article class="admin-message ${direction}" data-live-message="${esc(message.id)}">
      <p>${esc(message.text || "")}</p>
      <div class="admin-message-foot">
        <small><b>${sender}</b> · ${when(message.created_at)}</small>
        <button class="admin-message-delete" type="button" data-delete-live-message="${esc(message.id)}" title="Удалить сообщение">×</button>
      </div>
    </article>`;
  }

  function setupMessage(error = "") {
    return `<section class="panel"><div class="panel-head"><div><h3>Сообщения Telegram</h3><small>Переписка пользователей с администрацией BALI</small></div></div>
      <div class="panel-body"><p>${error ? esc(error) : "Для переписки требуется активный Supabase и Telegram webhook."}</p></div></section>`;
  }

  function render() {
    const root = $("#content");
    if (!root || !state.opened) return;
    if (!store?.cloudEnabled || !store.client) {
      root.innerHTML = setupMessage();
      return;
    }

    const conversations = filteredConversations();
    const current = state.conversations.find(row => row.id === state.selected);

    root.innerHTML = `<section class="admin-messages-shell">
      <aside class="admin-messages-sidebar">
        <div class="admin-messages-toolbar"><input id="liveMessageSearch" placeholder="Поиск по диалогам" value="${esc(state.search)}"></div>
        <div class="admin-messages-list">${conversations.length ? conversations.map(conversationRow).join("") : '<div class="admin-chat-empty">Диалогов пока нет</div>'}</div>
      </aside>
      <div class="admin-messages-main">
        <header class="admin-chat-head">
          <div class="admin-chat-person">${current ? avatar(current, true) : ""}
            <div><strong>${esc(current ? personName(current) : "Выберите диалог")}</strong>
            <small>${current?.username ? `@${esc(String(current.username).replace(/^@/, ""))}` : current ? `Telegram ID: ${esc(current.telegram_user_id)}` : "Telegram"}</small></div>
          </div>
          <div class="admin-chat-tools">
            <button class="ghost" type="button" data-clear-live-dialog ${current ? "" : "disabled"}>Очистить переписку</button>
            <button class="danger" type="button" data-delete-live-dialog ${current ? "" : "disabled"}>Удалить диалог</button>
          </div>
        </header>
        <div class="admin-chat-feed" id="adminLiveMessageFeed">${state.messages.length ? state.messages.map(messageRow).join("") : '<div class="admin-chat-empty">Сообщений пока нет</div>'}</div>
        <form id="liveMessageForm" class="admin-chat-compose">
          <textarea id="liveMessageText" placeholder="Напишите пользователю…" ${current ? "" : "disabled"}></textarea>
          <button class="primary" ${current ? "" : "disabled"}>Отправить</button>
        </form>
      </div>
    </section>`;

    $("#liveMessageSearch")?.addEventListener("input", event => {
      state.search = event.target.value;
      render();
    });
    $("#liveMessageForm")?.addEventListener("submit", send);

    requestAnimationFrame(() => {
      const feed = $("#adminLiveMessageFeed");
      if (feed) feed.scrollTop = feed.scrollHeight;
    });
  }

  async function markRead(id) {
    if (!id) return;
    const { error } = await store.client
      .from("telegram_conversations")
      .update({ unread_admin: 0 })
      .eq("id", id);
    if (error) throw error;
  }

  async function open() {
    state.opened = true;
    $$("#adminNav button").forEach(button => button.classList.toggle("active", button.dataset.view === "messages"));
    $("#pageTitle").textContent = "Сообщения";
    const action = $("#primaryAction");
    if (action) action.style.display = "none";
    $("#content").innerHTML = '<div class="empty">Загрузка переписки…</div>';

    try {
      await loadConversations();
      if (!state.selected && state.conversations[0]) state.selected = state.conversations[0].id;
      if (state.selected) await markRead(state.selected);
      await Promise.all([loadConversations(), loadMessages()]);
      render();
      subscribe();
    } catch (error) {
      $("#content").innerHTML = setupMessage(error?.message || "Не удалось загрузить сообщения");
      toast(error?.message || "Не удалось загрузить сообщения");
    }
  }

  async function choose(id) {
    state.selected = id;
    await markRead(id);
    await Promise.all([loadConversations(), loadMessages()]);
    render();
  }

  async function send(event) {
    event.preventDefault();
    const textarea = $("#liveMessageText");
    const text = textarea?.value.trim();
    if (!text || !state.selected) return;

    const button = event.currentTarget.querySelector("button");
    if (button) button.disabled = true;
    try {
      const { data, error } = await store.client.functions.invoke("telegram-send-message", {
        body: { conversation_id: state.selected, text }
      });
      if (error || data?.error) throw error || new Error(data.error);
      if (textarea) textarea.value = "";
      await Promise.all([loadConversations(), loadMessages()]);
      render();
      toast("Сообщение отправлено");
    } catch (error) {
      toast(error?.message || "Не удалось отправить сообщение");
      if (button) button.disabled = false;
    }
  }

  async function refreshConversationSummary() {
    if (!state.selected) return;
    const { data } = await store.client
      .from("telegram_messages")
      .select("text,created_at")
      .eq("conversation_id", state.selected)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error } = await store.client
      .from("telegram_conversations")
      .update({
        last_message_text: data?.text || "",
        last_message_at: data?.created_at || null,
        unread_admin: 0,
        updated_at: new Date().toISOString()
      })
      .eq("id", state.selected);
    if (error) throw error;
  }

  async function deleteMessage(id) {
    if (!id || !confirm("Удалить это сообщение из истории админки?")) return;
    try {
      const { error } = await store.client.from("telegram_messages").delete().eq("id", id);
      if (error) throw error;
      await refreshConversationSummary();
      await Promise.all([loadConversations(), loadMessages()]);
      render();
      toast("Сообщение удалено");
    } catch (error) {
      toast(error?.message || "Не удалось удалить сообщение");
    }
  }

  async function clearConversation() {
    if (!state.selected || !confirm("Очистить всю переписку? Сообщения будут удалены без возможности восстановления.")) return;
    try {
      const { error } = await store.client.from("telegram_messages").delete().eq("conversation_id", state.selected);
      if (error) throw error;
      await refreshConversationSummary();
      await Promise.all([loadConversations(), loadMessages()]);
      render();
      toast("Переписка очищена");
    } catch (error) {
      toast(error?.message || "Не удалось очистить переписку");
    }
  }

  async function deleteConversation() {
    if (!state.selected || !confirm("Удалить весь диалог вместе со всеми сообщениями?")) return;
    try {
      const id = state.selected;
      const { error } = await store.client.from("telegram_conversations").delete().eq("id", id);
      if (error) throw error;
      state.selected = null;
      state.messages = [];
      await loadConversations();
      state.selected = state.conversations[0]?.id || null;
      if (state.selected) await loadMessages();
      render();
      toast("Диалог удалён");
    } catch (error) {
      toast(error?.message || "Не удалось удалить диалог");
    }
  }

  function subscribe() {
    if (!store?.cloudEnabled || state.channel) return;
    state.channel = store.client
      .channel("bali-production-admin-messages")
      .on("postgres_changes", { event: "*", schema: "public", table: "telegram_conversations" }, async () => {
        await loadConversations().catch(() => {});
        if (state.opened && $('#adminNav [data-view="messages"].active')) render();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "telegram_messages" }, async () => {
        if (state.selected) await loadMessages().catch(() => {});
        if (state.opened && $('#adminNav [data-view="messages"].active')) render();
      })
      .subscribe();
  }

  document.addEventListener("click", event => {
    const nav = event.target.closest('#adminNav [data-view="messages"]');
    if (nav) {
      event.preventDefault();
      event.stopImmediatePropagation();
      open();
      return;
    }
    const dialog = event.target.closest("[data-live-dialog]");
    if (dialog) {
      event.preventDefault();
      choose(dialog.dataset.liveDialog);
      return;
    }
    const message = event.target.closest("[data-delete-live-message]");
    if (message) {
      event.preventDefault();
      deleteMessage(message.dataset.deleteLiveMessage);
      return;
    }
    if (event.target.closest("[data-clear-live-dialog]")) {
      event.preventDefault();
      clearConversation();
      return;
    }
    if (event.target.closest("[data-delete-live-dialog]")) {
      event.preventDefault();
      deleteConversation();
    }
  }, true);

  window.BaliAdminMessages = { open, clearConversation, deleteConversation, deleteMessage };
  setTimeout(() => loadConversations().catch(() => {}), 500);
})();