(() => {
  if (window.__BALI_USER_PRODUCTION_FEATURES__) return;
  window.__BALI_USER_PRODUCTION_FEATURES__ = true;

  const cfg = window.BALI_CONFIG || {};
  const store = window.BaliStore;
  const tg = window.Telegram?.WebApp;
  const game = window.BaliBeta4Game;
  const points = window.BaliPoints;
  const social = window.BaliBeta4Social;
  const loyalty = window.BaliBeta4Loyalty;
  const bot = String(cfg.telegramUsername || "BaliMinskAppBot").replace(/^@/, "");
  const appUrl = cfg.miniAppUrl || location.origin;
  const esc = (v = "") => String(v).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const state = { unread:0, messages:[], loading:false };

  function toast(message) {
    const node = document.getElementById("toast");
    if (!node) return;
    node.textContent = message;
    node.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => node.classList.remove("show"), 2400);
  }
  function functionUrl(name) {
    if (!cfg.supabaseUrl) return "";
    return `${String(cfg.supabaseUrl).replace(/\/$/, "")}/functions/v1/${name}`;
  }
  async function invoke(name, body) {
    if (!store?.cloudEnabled || !tg?.initData) throw new Error("Рабочая база или Telegram-профиль ещё не подключены");
    const url = functionUrl(name);
    const response = await fetch(url, {
      method:"POST",
      headers:{ "Content-Type":"application/json", apikey:cfg.supabaseAnonKey, Authorization:`Bearer ${cfg.supabaseAnonKey}` },
      body:JSON.stringify({ ...body, init_data:tg.initData })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.error) throw new Error(data.error || "Ошибка сервера");
    return data;
  }

  function addStyles() {
    if (document.getElementById("baliProductionUserStyle")) return;
    const style = document.createElement("style");
    style.id = "baliProductionUserStyle";
    style.textContent = `
      .profile-v2-tile.shop strong{font-size:14px!important}.profile-v2-tile.production-count{align-content:center;text-align:center;min-height:112px}.profile-v2-tile.production-count strong{font-size:30px}.profile-v2-tile.production-count span{font-size:9px}.profile-v2-bonus-copy{display:block;color:#d9e2dc;font-size:8px;line-height:1.45;margin-top:3px}
      .home-invite-card{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;margin-top:12px;padding:15px;border:1px solid #c8ff3d3d;border-radius:18px;background:linear-gradient(135deg,#c8ff3d12,#ffffff05)}.home-invite-card h3{margin:0 0 4px;font-size:14px}.home-invite-card p{margin:0;color:var(--muted);font-size:9px;line-height:1.5}.home-invite-card button{white-space:nowrap}
      .user-chat-dialog{width:min(560px,calc(100% - 14px));height:min(720px,94dvh);padding:0;border:1px solid var(--line);border-radius:23px;background:#0b0e0d;color:#fff;overflow:hidden}.user-chat-dialog::backdrop{background:#000d}.user-chat-shell{height:100%;display:grid;grid-template-rows:auto 1fr auto}.user-chat-head{display:flex;justify-content:space-between;align-items:center;padding:15px;border-bottom:1px solid var(--line)}.user-chat-feed{display:flex;flex-direction:column;gap:8px;overflow:auto;padding:14px}.user-chat-message{max-width:84%;padding:10px 12px;border-radius:15px;background:#ffffff0b}.user-chat-message.admin{align-self:flex-start}.user-chat-message.user{align-self:flex-end;background:#c8ff3d1a;border:1px solid #c8ff3d30}.user-chat-message p{margin:0;font-size:10px;line-height:1.5}.user-chat-message small{display:block;margin-top:4px;color:var(--muted);font-size:7px}.user-chat-compose{display:grid;grid-template-columns:1fr auto;gap:8px;padding:12px;border-top:1px solid var(--line)}.user-chat-compose textarea{min-height:48px;max-height:110px;padding:11px;border:1px solid var(--line);border-radius:13px;background:#171b19;color:#fff;resize:none}
      .social-like-split-card{display:grid;grid-template-columns:58px 1fr;gap:10px;align-items:center;padding:10px;border:1px solid var(--line);border-radius:15px;background:#ffffff06}.social-like-split-card img,.social-like-split-avatar{width:58px;height:68px;border-radius:12px;object-fit:cover}.social-like-split-avatar{display:grid;place-items:center;background:#1a1e1b;color:var(--lime);font:600 20px Unbounded}.social-like-split-card h3{margin:0 0 4px;font-size:12px}.social-like-split-card p{margin:0;color:var(--muted);font-size:8px}
    `;
    document.head.appendChild(style);
  }

  function ensureChatDialog() {
    if (document.getElementById("userProductionChat")) return;
    document.body.insertAdjacentHTML("beforeend", `<dialog id="userProductionChat" class="user-chat-dialog"><div class="user-chat-shell"><header class="user-chat-head"><div><span class="eyebrow">BALI SUPPORT</span><strong>Сообщения</strong></div><button class="profile-v2-close" type="button" data-user-chat-close>×</button></header><div id="userChatFeed" class="user-chat-feed"></div><form id="userChatForm" class="user-chat-compose"><textarea id="userChatText" maxlength="4000" placeholder="Напишите администрации BALI…"></textarea><button class="primary" type="submit">Отправить</button></form></div></dialog>`);
    document.addEventListener("click", e => { if (e.target.closest("[data-user-chat-close]")) document.getElementById("userProductionChat")?.close(); });
    document.getElementById("userChatForm")?.addEventListener("submit", sendUserMessage);
  }
  function renderChat() {
    const feed = document.getElementById("userChatFeed");
    if (!feed) return;
    if (!store?.cloudEnabled) {
      feed.innerHTML = `<div class="empty">Сервер сообщений ещё не подключён.<br><a href="https://t.me/${esc(bot)}" target="_blank">Открыть чат с ботом</a></div>`;
      return;
    }
    feed.innerHTML = state.messages.length ? state.messages.map(row => `<article class="user-chat-message ${row.direction === "user" ? "user" : "admin"}"><p>${esc(row.text || "")}</p><small>${row.created_at ? new Date(row.created_at).toLocaleString("ru-RU",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}) : ""}</small></article>`).join("") : '<div class="empty">Сообщений пока нет. Напишите администрации BALI.</div>';
    requestAnimationFrame(() => feed.scrollTop = feed.scrollHeight);
  }
  async function loadMessages(markRead = false) {
    try {
      const data = await invoke("telegram-user-chat", { action:markRead ? "list_and_read" : "list" });
      state.messages = data.messages || [];
      state.unread = Number(data.unread || 0);
      renderChat();
      patchProfile();
    } catch (error) {
      state.messages = [];
      state.unread = 0;
      renderChat();
    }
  }
  async function openMessages() {
    ensureChatDialog();
    document.getElementById("userProductionChat")?.showModal();
    renderChat();
    await loadMessages(true);
  }
  async function sendUserMessage(event) {
    event.preventDefault();
    const input = document.getElementById("userChatText");
    const text = input?.value.trim();
    if (!text || state.loading) return;
    state.loading = true;
    try {
      await invoke("telegram-user-chat", { action:"send", text });
      input.value = "";
      await loadMessages(true);
    } catch (error) { toast(error.message || "Не удалось отправить сообщение"); }
    finally { state.loading = false; }
  }

  function rewardsCount() {
    try {
      const standard = game?.achievements?.() || [];
      const custom = loyalty?.rewards?.() || [];
      const earned = new Set(loyalty?.earnedRewardIds?.(game?.profile?.()) || []);
      return standard.filter(x => x.earnedAt).length + custom.filter(x => earned.has(x.id)).length;
    } catch { return 0; }
  }
  function giftsCount() { try { return social?.incomingGifts?.().length || 0; } catch { return 0; } }
  function patchProfile() {
    const quick = document.getElementById("profileV2Quick");
    if (!quick) return false;
    const balance = Number(points?.profile?.().balance || 0);
    quick.innerHTML = `
      <button class="profile-v2-tile shop" type="button" data-open-profile-points data-open-profile-vip><small>BALI SHOP</small><strong>BALI Shop</strong><span>${balance} BALI-Баллов</span><span class="profile-v2-bonus-copy">Накапливайте баллы и оплачивайте ими до 90% стоимости продукции клуба.</span></button>
      <button class="profile-v2-tile invites" type="button" data-open-user-messages><small>СООБЩЕНИЯ</small><strong>${state.unread ? `${state.unread} новых` : "Сообщения"}</strong><span>${state.unread ? "Откройте непрочитанные сообщения" : "Написать администрации BALI"} →</span></button>
      <button class="profile-v2-tile gifts production-count" type="button" data-open-profile-gifts><strong>${giftsCount()}</strong><span>Подарков</span></button>
      <button class="profile-v2-tile rewards production-count" type="button" data-open-profile-rewards><strong>${rewardsCount()}</strong><span>Награды</span></button>`;
    return true;
  }

  function addInviteCard() {
    const home = document.querySelector('[data-screen="home"] .inner');
    if (!home || document.getElementById("homeInviteFriendProduction")) return;
    const actions = home.querySelector(".actions");
    const card = document.createElement("section");
    card.id = "homeInviteFriendProduction";
    card.className = "home-invite-card";
    card.innerHTML = `<div><h3>Пригласить друга</h3><p>Получите 10 BALI-Баллов, когда новый друг перейдёт по вашей ссылке и впервые откроет приложение.</p></div><button class="primary" type="button" data-invite-friend-production>Пригласить</button>`;
    (actions || home.firstElementChild)?.insertAdjacentElement("afterend", card);
  }

  function activeEvent() {
    const id = document.querySelector('#bookingForm [name="event_id"]')?.value || "";
    const title = document.getElementById("eventDialogTitle")?.textContent?.trim() || "Событие BALI";
    const when = document.getElementById("eventDialogDate")?.textContent?.trim() || "";
    const image = document.querySelector("#eventDialogMedia img")?.src || "";
    return { id, title, when, image };
  }
  function addEventShareButton() {
    const actions = document.querySelector("#eventDialog .dialog-content > .actions");
    if (!actions || document.getElementById("eventShareProduction")) return;
    const button = document.createElement("button");
    button.id = "eventShareProduction";
    button.className = "secondary";
    button.type = "button";
    button.dataset.shareEventProduction = "1";
    button.textContent = "Поделиться событием";
    actions.appendChild(button);
  }

  async function preparedShare(kind, event = null) {
    if (!tg?.shareMessage || !store?.cloudEnabled) return fallbackShare(kind, event);
    try {
      const data = await invoke("telegram-prepare-share", { kind, event_id:event?.id || null });
      if (!data.prepared_message_id) throw new Error("Сообщение не подготовлено");
      tg.shareMessage(data.prepared_message_id, async success => {
        if (!success) return;
        if (kind === "event") {
          try {
            const result = await invoke("loyalty-action", { action:"confirm_event_share", share_token:data.share_token });
            applyServerBalance(result.balance);
            toast("Событие отправлено · +5 BALI-Баллов");
          } catch { toast("Событие отправлено"); }
        } else toast("Приглашение отправлено. +10 баллов после первого входа друга");
      });
    } catch (error) { fallbackShare(kind, event); }
  }
  function fallbackShare(kind, event) {
    const profile = points?.profile?.() || game?.profile?.() || {};
    const code = encodeURIComponent(profile.code || profile.userKey || "BALI");
    const start = kind === "event" ? `event_${encodeURIComponent(event?.id || "")}_${code}` : `ref_${code}`;
    const link = `https://t.me/${bot}?startapp=${start}`;
    const text = kind === "event" ? `${event?.title || "Событие BALI"}\n${event?.when || ""}\nBALI Minsk · Кирова, 13` : "Присоединяйся к BALI Minsk — афиши, бонусы, подарки и BALI People";
    const url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
    tg?.openTelegramLink ? tg.openTelegramLink(url) : window.open(url, "_blank");
    toast(kind === "event" ? "Открылось окно отправки. Баллы начислятся только после подтверждённого репоста." : "Открылось окно приглашения");
  }
  function applyServerBalance(balance) {
    if (balance === undefined || !points?.keys?.profile) return;
    try {
      const current = points.profile();
      points.write(points.keys.profile, { ...current, balance:Number(balance) });
    } catch {}
  }
  async function consumeStartParam() {
    const param = tg?.initDataUnsafe?.start_param;
    if (!param || sessionStorage.getItem(`bali_start_consumed_${param}`) === "1") return;
    try {
      const data = await invoke("loyalty-action", { action:"consume_start_param", start_param:param });
      sessionStorage.setItem(`bali_start_consumed_${param}`, "1");
      applyServerBalance(data.balance);
    } catch {}
  }

  function splitLikes() {
    const tabs = document.querySelector(".social-tabs-v2");
    if (!tabs || tabs.dataset.productionSplit === "1") return;
    const old = tabs.querySelector('[data-social-v2-tab="thumbs"]');
    if (!old) return;
    old.remove();
    tabs.style.gridTemplateColumns = "repeat(2,1fr)";
    tabs.insertAdjacentHTML("beforeend", '<button data-social-v2-tab="incoming-production">Кто лайкнул меня</button><button data-social-v2-tab="outgoing-production">Кому поставил лайк</button>');
    tabs.dataset.productionSplit = "1";
  }
  function renderLikeSplit(type) {
    const root = document.getElementById("socialV2Content");
    if (!root || !social) return;
    const rows = type === "incoming-production"
      ? social.incomingThumbs()
      : social.visiblePeople().filter(person => social.hasThumb(social.myId(), person.id));
    document.querySelectorAll("[data-social-v2-tab]").forEach(b => b.classList.toggle("active", b.dataset.socialV2Tab === type));
    root.innerHTML = rows.length ? `<div class="profile-v2-list">${rows.map(person => `<article class="social-like-split-card" data-open-social-person="${esc(person.id)}">${person.photo ? `<img src="${esc(person.photo)}" alt="">` : `<span class="social-like-split-avatar">${esc(String(person.name||"B").slice(0,1))}</span>`}<div><h3>${esc(person.name || "Пользователь BALI")}</h3><p>${type === "incoming-production" ? "Поставил(а) вам 👍" : "Вы поставили 👍"}</p></div></article>`).join("")}</div>` : `<div class="social-v2-empty">${type === "incoming-production" ? "Пока никто не поставил вам лайк." : "Вы пока никому не поставили лайк."}</div>`;
  }

  document.addEventListener("click", event => {
    if (event.target.closest("[data-open-user-messages]")) { event.preventDefault(); return openMessages(); }
    if (event.target.closest("[data-invite-friend-production]")) return preparedShare("referral");
    if (event.target.closest("[data-share-event-production]")) return preparedShare("event", activeEvent());
    const likeTab = event.target.closest('[data-social-v2-tab="incoming-production"],[data-social-v2-tab="outgoing-production"]');
    if (likeTab) setTimeout(() => renderLikeSplit(likeTab.dataset.socialV2Tab), 0);
    if (event.target.closest('[data-page="profile"]')) setTimeout(() => { patchProfile(); loadMessages(false); }, 80);
    if (event.target.closest('[data-page="dating"]')) setTimeout(splitLikes, 80);
  }, true);

  addStyles();
  ensureChatDialog();
  const observer = new MutationObserver(() => {
    addInviteCard(); addEventShareButton(); patchProfile(); splitLikes();
    const active = document.querySelector('[data-social-v2-tab="incoming-production"].active,[data-social-v2-tab="outgoing-production"].active');
    if (active) renderLikeSplit(active.dataset.socialV2Tab);
  });
  observer.observe(document.body, { childList:true, subtree:true });
  [0,150,500,1200].forEach(delay => setTimeout(() => { addInviteCard(); addEventShareButton(); patchProfile(); splitLikes(); }, delay));
  setTimeout(() => loadMessages(false), 700);
  setInterval(() => loadMessages(false), 60000);
  consumeStartParam();
  window.BaliUserMessages = { open:openMessages, load:loadMessages, unreadCount:() => state.unread };
})();