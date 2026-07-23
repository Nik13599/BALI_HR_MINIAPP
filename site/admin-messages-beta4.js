(() => {
  if (window.__BALI_ADMIN_MESSAGES__) return;
  window.__BALI_ADMIN_MESSAGES__ = true;

  const store = window.BaliStore;
  const q = (selector, root = document) => root.querySelector(selector);
  const qa = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value = "") => String(value).replace(/[&<>'"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[ch]));
  const formatTime = (value) => value ? new Date(value).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }) : "";
  const formatListTime = (value) => {
    if (!value) return "";
    const date = new Date(value);
    const today = new Date();
    return date.toDateString() === today.toDateString()
      ? formatTime(value)
      : date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
  };
  const fullName = (row = {}) => [row.first_name, row.last_name].filter(Boolean).join(" ") || row.username || "Пользователь Telegram";
  const initials = (row = {}) => fullName(row).split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "TG";
  const avatar = (row, className) => row.photo_url
    ? `<span class="${className}"><img src="${esc(row.photo_url)}" alt=""/></span>`
    : `<span class="${className}">${esc(initials(row))}</span>`;

  const demoKey = "bali_admin_messages_demo_v1";
  const demoSeed = {
    conversations: [
      { id: "demo-dialog-1", telegram_user_id: 10001, telegram_chat_id: 10001, first_name: "Анна", last_name: "Ковалёва", username: "anna_k", status: "open", unread_admin: 2, last_message_text: "Подскажите, столик ещё свободен?", last_message_at: new Date(Date.now() - 1000 * 60 * 4).toISOString() },
      { id: "demo-dialog-2", telegram_user_id: 10002, telegram_chat_id: 10002, first_name: "Максим", username: "max_bali", status: "open", unread_admin: 0, last_message_text: "Спасибо, бронь подтверждена", last_message_at: new Date(Date.now() - 1000 * 60 * 70).toISOString() }
    ],
    messages: [
      { id: "demo-message-1", conversation_id: "demo-dialog-1", direction: "user", text: "Здравствуйте! Хотим прийти в субботу вчетвером.", delivery_status: "received", created_at: new Date(Date.now() - 1000 * 60 * 10).toISOString() },
      { id: "demo-message-2", conversation_id: "demo-dialog-1", direction: "admin", text: "Здравствуйте! Да, могу помочь с бронированием. Какой столик рассматриваете?", delivery_status: "sent", created_at: new Date(Date.now() - 1000 * 60 * 7).toISOString() },
      { id: "demo-message-3", conversation_id: "demo-dialog-1", direction: "user", text: "Подскажите, столик ещё свободен?", delivery_status: "received", created_at: new Date(Date.now() - 1000 * 60 * 4).toISOString() },
      { id: "demo-message-4", conversation_id: "demo-dialog-2", direction: "admin", text: "Ваша бронь подтверждена на пятницу, 23:00.", delivery_status: "sent", created_at: new Date(Date.now() - 1000 * 60 * 90).toISOString() },
      { id: "demo-message-5", conversation_id: "demo-dialog-2", direction: "user", text: "Спасибо, бронь подтверждена", delivery_status: "received", created_at: new Date(Date.now() - 1000 * 60 * 70).toISOString() }
    ]
  };

  const state = { conversations: [], messages: [], selectedId: null, search: "", channel: null, loading: false, setupError: null };

  function toast(message) {
    const node = q("#toast");
    if (!node) return;
    node.textContent = message;
    node.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove("show"), 2600);
  }

  function readDemo() {
    const raw = localStorage.getItem(demoKey);
    if (!raw) {
      localStorage.setItem(demoKey, JSON.stringify(demoSeed));
      return structuredClone(demoSeed);
    }
    try { return JSON.parse(raw); } catch { return structuredClone(demoSeed); }
  }

  function writeDemo(data) {
    localStorage.setItem(demoKey, JSON.stringify(data));
  }

  function ensureNav() {
    const nav = q("#adminNav");
    if (!nav || q('[data-view="messages"]', nav)) return;
    const settings = q('[data-view="settings"]', nav);
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.view = "messages";
    button.innerHTML = '✉ <span>Сообщения</span><b id="adminMessagesNavBadge" class="admin-unread" style="display:none;margin-left:auto">0</b>';
    nav.insertBefore(button, settings || null);
  }

  async function fetchConversations() {
    state.setupError = null;
    if (!store?.cloudEnabled) {
      const demo = readDemo();
      state.conversations = [...demo.conversations].sort((a, b) => String(b.last_message_at || "").localeCompare(String(a.last_message_at || "")));
      return;
    }
    const { data, error } = await store.client.from("telegram_conversations").select("*").order("last_message_at", { ascending: false, nullsFirst: false });
    if (error) {
      state.setupError = error;
      state.conversations = [];
      return;
    }
    state.conversations = data || [];
  }

  async function fetchMessages(conversationId) {
    if (!conversationId) { state.messages = []; return; }
    if (!store?.cloudEnabled) {
      state.messages = readDemo().messages.filter((row) => row.conversation_id === conversationId).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
      return;
    }
    const { data, error } = await store.client.from("telegram_messages").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: true });
    if (error) throw error;
    state.messages = data || [];
  }

  async function markRead(conversationId) {
    const conversation = state.conversations.find((row) => row.id === conversationId);
    if (conversation) conversation.unread_admin = 0;
    if (store?.cloudEnabled) await store.client.from("telegram_conversations").update({ unread_admin: 0, updated_at: new Date().toISOString() }).eq("id", conversationId);
    else {
      const demo = readDemo();
      const row = demo.conversations.find((item) => item.id === conversationId);
      if (row) row.unread_admin = 0;
      writeDemo(demo);
    }
    updateBadge();
  }

  function updateBadge() {
    const total = state.conversations.reduce((sum, row) => sum + Number(row.unread_admin || 0), 0);
    const badge = q("#adminMessagesNavBadge");
    if (!badge) return;
    badge.textContent = total > 99 ? "99+" : String(total);
    badge.style.display = total ? "grid" : "none";
  }

  function filteredConversations() {
    const search = state.search.trim().toLowerCase();
    if (!search) return state.conversations;
    return state.conversations.filter((row) => `${fullName(row)} ${row.username || ""} ${row.last_message_text || ""}`.toLowerCase().includes(search));
  }

  function conversationList() {
    const rows = filteredConversations();
    if (!rows.length) return '<div class="admin-chat-empty">Диалоги не найдены</div>';
    return rows.map((row) => `
      <button type="button" class="admin-conversation ${row.id === state.selectedId ? "active" : ""}" data-conversation-id="${esc(row.id)}">
        ${avatar(row, "admin-conversation-avatar")}
        <span class="admin-conversation-copy">
          <span class="admin-conversation-name"><strong>${esc(fullName(row))}</strong>${row.status === "blocked" ? '<span class="status cancelled">Заблокирован</span>' : ""}</span>
          <p>${esc(row.last_message_text || "Новый диалог")}</p>
        </span>
        <span class="admin-conversation-meta"><time>${esc(formatListTime(row.last_message_at))}</time>${Number(row.unread_admin || 0) ? `<b class="admin-unread">${Number(row.unread_admin)}</b>` : ""}</span>
      </button>`).join("");
  }

  function messageFeed() {
    if (!state.selectedId) return '<div class="admin-chat-empty">Выберите диалог слева, чтобы открыть переписку</div>';
    if (!state.messages.length) return '<div class="admin-chat-empty">В этом диалоге пока нет сообщений</div>';
    return state.messages.map((row) => {
      const direction = row.direction === "admin" ? "admin" : row.direction === "system" ? "system" : "user";
      const delivery = direction === "admin" ? `<span class="admin-message-delivery">${row.delivery_status === "failed" ? "Ошибка" : row.delivery_status === "delivered" ? "✓✓" : "✓"}</span>` : "";
      return `<article class="admin-message ${direction}"><p>${esc(row.text || "")}</p><small>${esc(formatTime(row.created_at))}${delivery}</small></article>`;
    }).join("");
  }

  function selectedConversation() {
    return state.conversations.find((row) => row.id === state.selectedId) || null;
  }

  function chatHead() {
    const row = selectedConversation();
    if (!row) return '<div class="admin-chat-person"><strong>Диалог не выбран</strong><small>Сообщения от пользователей Telegram</small></div>';
    return `<div class="admin-chat-person">${avatar(row, "admin-chat-avatar")}<div><strong>${esc(fullName(row))}</strong><small>${row.username ? `@${esc(row.username)}` : "Telegram ID: " + esc(row.telegram_user_id || "—")}</small></div></div><span class="admin-chat-status">${row.status === "closed" ? "Диалог закрыт" : "Бот подключён"}</span>`;
  }

  function setupPanel(error) {
    const detail = error?.message || "Таблицы Telegram-сообщений ещё не созданы в Supabase.";
    return `<div class="admin-messages-setup"><section class="panel"><div class="panel-head"><div><h3>Нужно подключить сервер сообщений</h3><small>Интерфейс админки уже установлен</small></div></div><div class="panel-body"><p>${esc(detail)}</p><p>Для запуска переписки необходимо выполнить SQL-файл и развернуть две Supabase Edge Functions.</p><code>telegram-messaging-schema.sql
telegram-webhook
telegram-send-message</code><a class="primary compact" href="./telegram-messaging-schema.sql" target="_blank">Открыть SQL-схему</a></div></section></div>`;
  }

  function renderShell() {
    const root = q("#content");
    if (!root) return;
    if (state.setupError) {
      root.innerHTML = setupPanel(state.setupError);
      return;
    }
    const mode = store?.cloudEnabled ? "ОБЛАЧНЫЕ ДИАЛОГИ" : "ДЕМОНСТРАЦИОННЫЙ ЧАТ";
    root.innerHTML = `
      <section class="admin-messages-shell">
        <aside class="admin-messages-sidebar">
          <div class="admin-messages-toolbar"><input id="adminMessagesSearch" type="search" placeholder="Поиск по имени, username или сообщению" value="${esc(state.search)}"/><span class="admin-messages-mode ${store?.cloudEnabled ? "cloud" : ""}">${mode}</span></div>
          <div id="adminMessagesList" class="admin-messages-list">${conversationList()}</div>
        </aside>
        <div class="admin-messages-main">
          <header class="admin-chat-head">${chatHead()}</header>
          <div id="adminChatFeed" class="admin-chat-feed">${messageFeed()}</div>
          <form id="adminMessageForm" class="admin-chat-compose">
            <textarea id="adminMessageText" maxlength="4000" placeholder="Напишите ответ пользователю…" ${state.selectedId ? "" : "disabled"}></textarea>
            <button class="primary" type="submit" ${state.selectedId ? "" : "disabled"}>Отправить</button>
          </form>
        </div>
      </section>`;

    q("#adminMessagesSearch")?.addEventListener("input", (event) => {
      state.search = event.target.value;
      q("#adminMessagesList").innerHTML = conversationList();
    });
    q("#adminMessageForm")?.addEventListener("submit", sendMessage);
    q("#adminMessageText")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        q("#adminMessageForm")?.requestSubmit();
      }
    });
    requestAnimationFrame(() => {
      const feed = q("#adminChatFeed");
      if (feed) feed.scrollTop = feed.scrollHeight;
    });
  }

  async function openConversation(id) {
    state.selectedId = id;
    try {
      await Promise.all([fetchMessages(id), markRead(id)]);
      renderShell();
    } catch (error) { toast(error.message || "Не удалось открыть диалог"); }
  }

  async function sendMessage(event) {
    event.preventDefault();
    const input = q("#adminMessageText");
    const text = input?.value.trim();
    if (!text || !state.selectedId || state.loading) return;
    state.loading = true;
    const button = q('#adminMessageForm button[type="submit"]');
    if (button) { button.disabled = true; button.textContent = "Отправка…"; }
    try {
      if (!store?.cloudEnabled) {
        const demo = readDemo();
        const now = new Date().toISOString();
        demo.messages.push({ id: `demo-message-${Date.now()}`, conversation_id: state.selectedId, direction: "admin", text, delivery_status: "sent", created_at: now });
        const conversation = demo.conversations.find((row) => row.id === state.selectedId);
        if (conversation) { conversation.last_message_text = text; conversation.last_message_at = now; conversation.unread_user = Number(conversation.unread_user || 0) + 1; }
        writeDemo(demo);
      } else {
        const { data, error } = await store.client.functions.invoke("telegram-send-message", { body: { conversation_id: state.selectedId, text } });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      }
      input.value = "";
      await Promise.all([fetchConversations(), fetchMessages(state.selectedId)]);
      renderShell();
      toast(store?.cloudEnabled ? "Сообщение отправлено в Telegram" : "Демо-сообщение добавлено");
    } catch (error) {
      toast(error.message || "Не удалось отправить сообщение");
      if (button) { button.disabled = false; button.textContent = "Отправить"; }
    } finally { state.loading = false; }
  }

  function subscribeRealtime() {
    if (!store?.cloudEnabled || state.channel) return;
    state.channel = store.client.channel("bali-admin-telegram-messages")
      .on("postgres_changes", { event: "*", schema: "public", table: "telegram_conversations" }, async () => {
        await fetchConversations(); updateBadge();
        if (q('[data-view="messages"].active')) renderShell();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "telegram_messages" }, async (payload) => {
        if (payload.new?.conversation_id === state.selectedId) {
          await fetchMessages(state.selectedId);
          if (q('[data-view="messages"].active')) renderShell();
        }
      }).subscribe();
  }

  async function openMessages() {
    ensureNav();
    qa("#adminNav button").forEach((button) => button.classList.toggle("active", button.dataset.view === "messages"));
    q("#pageTitle").textContent = "Сообщения";
    const action = q("#primaryAction");
    if (action) action.style.display = "none";
    q("#content").innerHTML = '<div class="empty">Загрузка диалогов…</div>';
    await fetchConversations();
    updateBadge();
    if (!state.selectedId && state.conversations.length) state.selectedId = state.conversations[0].id;
    if (state.selectedId) {
      try { await Promise.all([fetchMessages(state.selectedId), markRead(state.selectedId)]); } catch (error) { state.setupError = error; }
    }
    renderShell();
    subscribeRealtime();
  }

  document.addEventListener("click", (event) => {
    const navButton = event.target.closest('#adminNav button[data-view="messages"]');
    if (navButton) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openMessages();
      return;
    }
    const conversation = event.target.closest("[data-conversation-id]");
    if (conversation && q('[data-view="messages"].active')) openConversation(conversation.dataset.conversationId);
  }, true);

  window.BaliAdminMessages = { open: openMessages, openConversation };
  ensureNav();
  [0, 250, 800, 1600].forEach((delay) => setTimeout(async () => { ensureNav(); if (!state.conversations.length) { await fetchConversations(); updateBadge(); } }, delay));
})();