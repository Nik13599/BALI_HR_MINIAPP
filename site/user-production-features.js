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
  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
  let enhanceTimer = 0;

  function toast(message) {
    const node = document.getElementById("toast");
    if (!node) return;
    node.textContent = message;
    node.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove("show"), 2400);
  }

  function endpoint(name) {
    return cfg.supabaseUrl ? `${String(cfg.supabaseUrl).replace(/\/$/, "")}/functions/v1/${name}` : "";
  }

  async function invoke(name, body) {
    if (!store?.cloudEnabled || !tg?.initData) throw new Error("Сервер BALI ещё не подключён");
    const response = await fetch(endpoint(name), {
      method: "POST",
      headers: { "Content-Type":"application/json", apikey:cfg.supabaseAnonKey, Authorization:`Bearer ${cfg.supabaseAnonKey}` },
      body: JSON.stringify({ ...body, init_data:tg.initData })
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
      .profile-v2-tile.shop strong{font-size:14px!important}
      .profile-v2-tile.production-count{align-content:center;text-align:center;min-height:112px}
      .profile-v2-tile.production-count strong{font-size:30px}
      .profile-v2-bonus-copy{display:block;color:#d9e2dc;font-size:8px;line-height:1.45;margin-top:3px}
      .home-invite-card{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;margin-top:12px;padding:15px;border:1px solid #c8ff3d3d;border-radius:18px;background:linear-gradient(135deg,#c8ff3d12,#ffffff05)}
      .home-invite-card h3{margin:0 0 4px;font-size:14px}.home-invite-card p{margin:0;color:var(--muted);font-size:9px;line-height:1.5}
      .social-like-split-card{display:grid;grid-template-columns:58px 1fr;gap:10px;align-items:center;padding:10px;border:1px solid var(--line);border-radius:15px;background:#ffffff06}
      .social-like-split-card img,.social-like-split-avatar{width:58px;height:68px;border-radius:12px;object-fit:cover}
      .social-like-split-avatar{display:grid;place-items:center;background:#1a1e1b;color:var(--lime);font:600 20px Unbounded}
      .social-like-split-card h3{margin:0 0 4px;font-size:12px}.social-like-split-card p{margin:0;color:var(--muted);font-size:8px}
      @media(max-width:420px){.home-invite-card{grid-template-columns:1fr}.home-invite-card button{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function rewardCount() {
    try {
      const standard = game?.achievements?.() || [];
      const custom = loyalty?.rewards?.() || [];
      const earned = new Set(loyalty?.earnedRewardIds?.(game?.profile?.()) || []);
      return standard.filter(row => row.earnedAt).length + custom.filter(row => earned.has(row.id)).length;
    } catch { return 0; }
  }

  function giftCount() {
    try { return social?.incomingGifts?.().length || 0; } catch { return 0; }
  }

  function invitationCounts() {
    try {
      const incoming = social?.activeIncomingRequests?.() || [];
      const outgoing = social?.activeOutgoingRequests?.() || [];
      return { incoming:incoming.length, outgoing:outgoing.length, total:incoming.length + outgoing.length };
    } catch { return { incoming:0, outgoing:0, total:0 }; }
  }

  function patchProfile() {
    const quick = document.getElementById("profileV2Quick");
    if (!quick) return false;
    const balance = Number(points?.profile?.().balance || 0);
    const invitations = invitationCounts();
    quick.innerHTML = `
      <button class="profile-v2-tile shop" type="button" data-open-profile-points data-open-profile-vip>
        <strong>BALI Shop</strong><span>${balance} BALI-Баллов</span>
        <span class="profile-v2-bonus-copy">Накапливайте баллы и оплачивайте ими до 90% стоимости продукции клуба.</span>
      </button>
      <button class="profile-v2-tile invites" type="button" data-open-profile-invitations>
        <small>ПРИГЛАШЕНИЯ</small><strong>${invitations.total}</strong>
        <span>Входящие: ${invitations.incoming} · Отправленные: ${invitations.outgoing} →</span>
      </button>
      <button class="profile-v2-tile gifts production-count" type="button" data-open-profile-gifts aria-label="Подарки">
        <strong>${giftCount()}</strong><span>Подарков</span>
      </button>
      <button class="profile-v2-tile rewards production-count" type="button" data-open-profile-rewards>
        <strong>${rewardCount()}</strong><span>Мои награды</span>
      </button>`;
    return true;
  }

  function addInviteFriendCard() {
    const home = document.querySelector('[data-screen="home"] .inner');
    if (!home || document.getElementById("homeInviteFriendProduction")) return;
    const card = document.createElement("section");
    card.id = "homeInviteFriendProduction";
    card.className = "home-invite-card";
    card.innerHTML = '<div><h3>Пригласить друга в BALI</h3><p>10 BALI-Баллов начислятся, когда новый друг перейдёт по ссылке и впервые откроет приложение.</p></div><button class="primary" type="button" data-invite-friend-production>Пригласить</button>';
    const anchor = home.querySelector(".actions") || home.firstElementChild;
    anchor?.insertAdjacentElement("afterend", card);
  }

  function activeEvent() {
    return {
      id:document.querySelector('#bookingForm [name="event_id"]')?.value || "",
      title:document.getElementById("eventDialogTitle")?.textContent?.trim() || "Событие BALI",
      when:document.getElementById("eventDialogDate")?.textContent?.trim() || ""
    };
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

  function applyBalance(value) {
    if (value === undefined || !points?.keys?.profile) return;
    try { points.write(points.keys.profile, { ...points.profile(), balance:Number(value) }); } catch {}
  }

  async function preparedShare(kind, event = null) {
    if (!tg?.shareMessage || !store?.cloudEnabled) return fallbackShare(kind, event);
    try {
      const data = await invoke("telegram-prepare-share", { kind, event_id:event?.id || null });
      if (!data.prepared_message_id) throw new Error("Сообщение не подготовлено");
      tg.shareMessage(data.prepared_message_id, async sent => {
        if (!sent) return;
        if (kind === "event") {
          try {
            const result = await invoke("loyalty-action", { action:"confirm_event_share", share_token:data.share_token });
            applyBalance(result.balance);
            toast("Событие отправлено · +5 BALI-Баллов");
          } catch { toast("Событие отправлено"); }
        } else toast("Приглашение отправлено. Баллы начислятся после первого входа друга");
      });
    } catch { fallbackShare(kind, event); }
  }

  function fallbackShare(kind, event) {
    const profile = points?.profile?.() || game?.profile?.() || {};
    const code = encodeURIComponent(profile.code || profile.userKey || "BALI");
    const start = kind === "event" ? `event_${encodeURIComponent(event?.id || "")}_${code}` : `ref_${code}`;
    const link = `https://t.me/${bot}?startapp=${start}`;
    const text = kind === "event"
      ? `${event?.title || "Событие BALI"}\n${event?.when || ""}\nBALI Minsk · Кирова, 13`
      : "Присоединяйся к BALI Minsk — афиши, бонусы, подарки и BALI People";
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
    tg?.openTelegramLink ? tg.openTelegramLink(shareUrl) : window.open(shareUrl, "_blank");
    toast(kind === "event" ? "Открылось окно отправки события" : "Открылось окно приглашения");
  }

  async function consumeStartParam() {
    const start = tg?.initDataUnsafe?.start_param;
    if (!start || !store?.cloudEnabled || sessionStorage.getItem(`bali_start_consumed_${start}`) === "1") return;
    try {
      const data = await invoke("loyalty-action", { action:"consume_start_param", start_param:start });
      sessionStorage.setItem(`bali_start_consumed_${start}`, "1");
      applyBalance(data.balance);
    } catch {}
  }

  function splitLikes() {
    const tabs = document.querySelector(".social-tabs-v2");
    if (!tabs || tabs.dataset.productionSplit === "1") return;
    tabs.querySelector('[data-social-v2-tab="thumbs"]')?.remove();
    tabs.insertAdjacentHTML("beforeend", '<button data-social-v2-tab="incoming-production">Кто лайкнул меня</button><button data-social-v2-tab="outgoing-production">Кому я поставил лайк</button>');
    tabs.style.gridTemplateColumns = "repeat(2,1fr)";
    tabs.dataset.productionSplit = "1";
  }

  function renderLikeSplit(type) {
    const root = document.getElementById("socialV2Content");
    if (!root || !social) return;
    const rows = type === "incoming-production"
      ? social.incomingThumbs()
      : social.visiblePeople().filter(person => social.hasThumb(social.myId(), person.id));
    document.querySelectorAll("[data-social-v2-tab]").forEach(button => button.classList.toggle("active", button.dataset.socialV2Tab === type));
    root.innerHTML = rows.length
      ? `<div class="profile-v2-list">${rows.map(person => `<article class="social-like-split-card" data-open-social-person="${esc(person.id)}">${person.photo ? `<img src="${esc(person.photo)}" alt="">` : `<span class="social-like-split-avatar">${esc(String(person.name || "B").slice(0,1))}</span>`}<div><h3>${esc(person.name || "Пользователь BALI")}</h3><p>${type === "incoming-production" ? "Поставил(а) вам 👍" : "Вы поставили 👍"}</p></div></article>`).join("")}</div>`
      : `<div class="social-v2-empty">${type === "incoming-production" ? "Пока никто не поставил вам лайк." : "Вы пока никому не поставили лайк."}</div>`;
  }

  function cleanLabels() {
    document.querySelectorAll('[data-screen="dating"] .head .count').forEach(node => { if (/beta/i.test(node.textContent || "")) node.remove(); });
    document.querySelectorAll(".top .brand small").forEach(node => {
      const next = String(node.textContent || "").replace(/\s*·?\s*BETA\s*4?/gi, "").trim();
      if (next && next !== node.textContent) node.textContent = next;
    });
  }

  function enhance() {
    addInviteFriendCard();
    addEventShareButton();
    patchProfile();
    splitLikes();
    cleanLabels();
  }

  function schedule(delay = 50) {
    clearTimeout(enhanceTimer);
    enhanceTimer = setTimeout(enhance, delay);
  }

  document.addEventListener("click", event => {
    if (event.target.closest("[data-invite-friend-production]")) return preparedShare("referral");
    if (event.target.closest("[data-share-event-production]")) return preparedShare("event", activeEvent());
    const likeTab = event.target.closest('[data-social-v2-tab="incoming-production"],[data-social-v2-tab="outgoing-production"]');
    if (likeTab) return setTimeout(() => renderLikeSplit(likeTab.dataset.socialV2Tab), 0);
    if (event.target.closest('[data-page="profile"],[data-page="dating"],[data-page="home"],[data-event]')) schedule(80);
  }, true);

  window.addEventListener("bali:social-changed", () => schedule(60));
  window.addEventListener("bali:data-changed", () => schedule(80));

  addStyles();
  [0,180,650,1500].forEach(delay => setTimeout(enhance, delay));
  consumeStartParam();
})();