(() => {
  if (window.__BALI_ADMIN_MESSAGES_LIVE_ONLY__) return;
  window.__BALI_ADMIN_MESSAGES_LIVE_ONLY__ = true;

  const store = window.BaliStore;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);
  const state = { conversations: [], messages: [], selected: null, search: "", channel: null };
  const displayName = row => [row.first_name, row.last_name].filter(Boolean).join(" ") || row.username || "Пользователь Telegram";
  const initials = row => displayName(row).split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase() || "TG";
  const when = value => value ? new Date(value).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";

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

  function setup(error = "") {
    return `<section class="panel"><div class="panel-head"><div><h3>Сообщения Telegram</h3><small>Переписка пользователей с @BaliMinskAppBot</small></div></div><div class="panel-body"><p>${esc(error || "Не удалось загрузить переписку. Проверьте Supabase и Telegram webhook.")}</p></div></section>`;
  }

  async function loadConversations() {
    if (!store?.cloudEnabled) { state.conversations = []; return; }
    const { data, error } = await store.client.from("telegram_conversations").select("*").order("last_message_at", { ascending: false, nullsFirst: false });
    if (error) throw error;
    state.conversations = data || [];
    if (state.selected && !state.conversations.some(row => row.id === state.selected)) state.selected = null;
    badge();
  }

  async function loadMessages() {
    if (!state.selected || !store?.cloudEnabled) { state.messages = []; return; }
    const { data, error } = await store.client.from("telegram_messages").select("*").eq("conversation_id", state.selected).order("created_at");
    if (error) throw error;
    state.messages = data || [];
  }

  function filteredRows() {
    const query = state.search.toLowerCase();
    return state.conversations.filter(row => !query || `${displayName(row)} ${row.username || ""} ${row.last_message_text || ""}`.toLowerCase().includes(query));
  }

  function avatar(row, className) {
    return `<span class="${className}">${row?.photo_url ? `<img src="${esc(row.photo_url)}" alt="">` : esc(initials(row || {}))}</span>`;
  }

  function messageHtml(message) {
    const direction = message.direction === "admin" ? "admin" : message.direction === "system" ? "system" : "user";
    return `<article class="admin-message ${direction}" data-live-message-id="${esc(message.id)}"><p>${esc(message.text || "")}</p><div class="admin-message-foot"><small>${when(message.created_at)}</small><button type="button" class="admin-message-delete" data-delete-live-message="${esc(message.id)}" title="Удалить сообщение">×</button></div></article>`;
  }

  function render() {
    const root = $("#content");
    if (!root) return;
    if (!store?.cloudEnabled) { root.innerHTML = setup("Общая база не подключена."); return; }
    const current = state.conversations.find(row => row.id === state.selected);
    const rows = filteredRows();
    root.innerHTML = `<section class="admin-messages-shell">
      <aside class="admin-messages-sidebar">
        <div class="admin-messages-toolbar"><input id="liveMessageSearch" placeholder="Поиск по имени или сообщению" value="${esc(state.search)}"></div>
        <div class="admin-messages-list">${rows.length ? rows.map(row => `<button class="admin-conversation ${row.id === state.selected ? "active" : ""}" data-live-dialog="${esc(row.id)}">${avatar(row, "admin-conversation-avatar")}<span class="admin-conversation-copy"><span class="admin-conversation-name"><strong>${esc(displayName(row))}</strong></span><p>${esc(row.last_message_text || "Новый диалог")}</p></span><span class="admin-conversation-meta"><time>${when(row.last_message_at)}</time>${Number(row.unread_admin || 0) ? `<b class="admin-unread">${Number(row.unread_admin)}</b>` : ""}</span></button>`).join("") : '<div class="admin-chat-empty">Диалогов пока нет</div>'}</div>
      </aside>
      <div class="admin-messages-main">
        <header class="admin-chat-head"><div class="admin-chat-person">${current ? avatar(current, "admin-chat-avatar") : ""}<div><strong>${esc(current ? displayName(current) : "Выберите диалог")}</strong><small>${current?.username ? `@${esc(String(current.username).replace(/^@/, ""))}` : "Telegram"}</small></div></div><div class="admin-chat-tools">${current ? '<button class="ghost compact" type="button" data-clear-live-dialog>Очистить</button><button class="danger compact" type="button" data-delete-live-dialog>Удалить диалог</button>' : ""}</div></header>
        <div class="admin-chat-feed" id="liveChatFeed">${state.messages.length ? state.messages.map(messageHtml).join("") : '<div class="admin-chat-empty">Сообщений пока нет</div>'}</div>
        <form id="liveMessageForm" class="admin-chat-compose"><textarea id="liveMessageText" maxlength="4000" placeholder="Напишите пользователю…" ${current ? "" : "disabled"}></textarea><button class="primary" ${current ? "" : "disabled"}>Отправить</button></form>
      </div>
    </section>`;
    $("#liveMessageSearch")?.addEventListener("input", event => { state.search = event.target.value; render(); });
    $("#liveMessageForm")?.addEventListener("submit", send);
    requestAnimationFrame(() => { const feed = $("#liveChatFeed"); if (feed) feed.scrollTop = feed.scrollHeight; });
  }

  async function open() {
    $$("#adminNav button").forEach(button => button.classList.toggle("active", button.dataset.view === "messages"));
    $("#pageTitle").textContent = "Сообщения";
    const action = $("#primaryAction");
    if (action) action.style.display = "none";
    $("#content").innerHTML = '<div class="empty">Загрузка…</div>';
    try {
      await loadConversations();
      if (!state.selected && state.conversations[0]) state.selected = state.conversations[0].id;
      await loadMessages();
      render();
      subscribe();
    } catch (error) {
      $("#content").innerHTML = setup(error?.message || "Не удалось загрузить сообщения");
      toast(error?.message || "Не удалось загрузить сообщения");
    }
  }

  async function choose(id) {
    state.selected = id;
    const { error } = await store.client.from("telegram_conversations").update({ unread_admin: 0 }).eq("id", id);
    if (error) return toast(error.message || "Не удалось открыть диалог");
    await Promise.all([loadConversations(), loadMessages()]);
    render();
  }

  async function send(event) {
    event.preventDefault();
    const text = $("#liveMessageText")?.value.trim();
    if (!text || !state.selected) return;
    try {
      const { data, error } = await store.client.functions.invoke("telegram-send-message", { body: { conversation_id: state.selected, text } });
      if (error || data?.error) throw error || new Error(data.error);
      await Promise.all([loadConversations(), loadMessages()]);
      render();
      toast("Сообщение отправлено");
    } catch (error) { toast(error?.message || "Не удалось отправить"); }
  }

  async function refreshPreview() {
    if (!state.selected) return;
    const last = state.messages[state.messages.length - 1] || null;
    await store.client.from("telegram_conversations").update({
      last_message_text: last?.text || "",
      last_message_at: last?.created_at || null,
      unread_admin: state.messages.filter(row => row.direction === "user" && !row.read_at).length,
      updated_at: new Date().toISOString()
    }).eq("id", state.selected);
  }

  async function deleteMessage(id) {
    if (!confirm("Удалить это сообщение из истории?")) return;
    const { error } = await store.client.from("telegram_messages").delete().eq("id", id);
    if (error) return toast(error.message || "Не удалось удалить сообщение");
    await loadMessages();
    await refreshPreview();
    await loadConversations();
    render();
    toast("Сообщение удалено");
  }

  async function clearDialog() {
    if (!state.selected || !confirm("Очистить все сообщения в этой переписке?")) return;
    const { error } = await store.client.from("telegram_messages").delete().eq("conversation_id", state.selected);
    if (error) return toast(error.message || "Не удалось очистить переписку");
    await store.client.from("telegram_conversations").update({ last_message_text: "", last_message_at: null, unread_admin: 0, unread_user: 0, updated_at: new Date().toISOString() }).eq("id", state.selected);
    await Promise.all([loadConversations(), loadMessages()]);
    render();
    toast("Переписка очищена");
  }

  async function deleteDialog() {
    if (!state.selected || !confirm("Удалить диалог полностью? При новом сообщении пользователя он будет создан заново.")) return;
    const id = state.selected;
    const { error } = await store.client.from("telegram_conversations").delete().eq("id", id);
    if (error) return toast(error.message || "Не удалось удалить диалог");
    state.selected = null;
    await loadConversations();
    if (state.conversations[0]) state.selected = state.conversations[0].id;
    await loadMessages();
    render();
    toast("Диалог удалён");
  }

  function subscribe() {
    if (!store?.cloudEnabled || state.channel) return;
    state.channel = store.client.channel("bali-live-admin-messages")
      .on("postgres_changes", { event: "*", schema: "public", table: "telegram_conversations" }, async () => { await loadConversations(); if ($('#adminNav [data-view="messages"].active')) render(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "telegram_messages" }, async () => { await loadMessages(); if ($('#adminNav [data-view="messages"].active')) render(); })
      .subscribe();
  }

  document.addEventListener("click", event => {
    const nav = event.target.closest('#adminNav [data-view="messages"]');
    if (nav) { event.preventDefault(); event.stopImmediatePropagation(); open(); return; }
    const dialog = event.target.closest("[data-live-dialog]");
    if (dialog) { choose(dialog.dataset.liveDialog); return; }
    const removeMessage = event.target.closest("[data-delete-live-message]");
    if (removeMessage) { deleteMessage(removeMessage.dataset.deleteLiveMessage); return; }
    if (event.target.closest("[data-clear-live-dialog]")) { clearDialog(); return; }
    if (event.target.closest("[data-delete-live-dialog]")) deleteDialog();
  }, true);

  window.BaliAdminMessages = { open };
  setTimeout(() => loadConversations().catch(() => {}), 500);
})();