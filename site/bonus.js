(() => {
  const SETTINGS_KEY = "bali_bonus_settings_v1";
  const PROFILE_KEY = "bali_bonus_profile_v1";
  const LEDGER_KEY = "bali_bonus_ledger_v1";
  const ACTIONS_KEY = "bali_bonus_actions_v1";
  const DEFAULT_SETTINGS = { referral: 50, story: 30, eventShare: 10 };

  const readJson = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  };
  const writeJson = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent("bali:bonus-changed"));
    return value;
  };
  const getSettings = () => ({ ...DEFAULT_SETTINGS, ...readJson(SETTINGS_KEY, {}) });
  const getLedger = () => readJson(LEDGER_KEY, []);
  const getActions = () => readJson(ACTIONS_KEY, {});

  function getProfile() {
    const saved = readJson(PROFILE_KEY, null);
    if (saved?.code) return saved;
    const telegramUser = tg?.initDataUnsafe?.user;
    const source = telegramUser?.id ? String(telegramUser.id) : String(Date.now()).slice(-7);
    const code = `BALI-${source.slice(-7).toUpperCase()}`;
    return writeJson(PROFILE_KEY, {
      code,
      balance: 0,
      name: telegramUser?.first_name || "Гость BALI",
      createdAt: new Date().toISOString()
    });
  }

  function addBonus(type, amount, title, actionKey) {
    const actions = getActions();
    if (actionKey && actions[actionKey]) return false;
    const profile = getProfile();
    const value = Math.max(0, Number(amount || 0));
    profile.balance = Number(profile.balance || 0) + value;
    const ledger = getLedger();
    ledger.unshift({ id: crypto.randomUUID?.() || String(Date.now()), type, title, amount: value, createdAt: new Date().toISOString() });
    if (actionKey) actions[actionKey] = new Date().toISOString();
    writeJson(PROFILE_KEY, profile);
    writeJson(LEDGER_KEY, ledger.slice(0, 50));
    writeJson(ACTIONS_KEY, actions);
    renderBonuses();
    return true;
  }

  function formatTime(value) {
    return new Date(value).toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  function actionIcon(type) {
    return ({ referral: "👥", story: "📸", event: "↗" })[type] || "★";
  }

  function renderBonuses() {
    const root = document.getElementById("bonuses");
    if (!root) return;
    const settings = getSettings();
    const profile = getProfile();
    const ledger = getLedger();
    $("#bonusBalance").textContent = Number(profile.balance || 0).toLocaleString("ru-RU");
    $("#bonusReferralCode").textContent = profile.code;
    $("#referralReward").textContent = settings.referral;
    $("#storyReward").textContent = settings.story;
    $("#eventShareReward").textContent = settings.eventShare;
    $("#bonusHistoryCount").textContent = `${ledger.length} операций`;
    $("#bonusHistory").innerHTML = ledger.length ? ledger.slice(0, 8).map((item) => `
      <div class="bonus-history-item">
        <i>${actionIcon(item.type)}</i>
        <div><strong>${esc(item.title)}</strong><small>${formatTime(item.createdAt)}</small></div>
        <b>+${Number(item.amount || 0)}</b>
      </div>`).join("") : '<div class="bonus-empty">Начислений пока нет. Выполните первое действие и проверьте механику Beta3.</div>';
  }

  async function sharePayload(payload) {
    if (navigator.share) {
      await navigator.share(payload);
      return true;
    }
    const url = payload.url || location.href;
    const text = encodeURIComponent(`${payload.text || payload.title || "BALI"}\n${url}`);
    if (tg?.openTelegramLink) tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${text}`);
    else await navigator.clipboard.writeText(`${payload.text || ""} ${url}`.trim());
    return true;
  }

  async function inviteFriend() {
    const settings = getSettings();
    const profile = getProfile();
    const url = new URL(location.href);
    url.searchParams.set("ref", profile.code);
    url.hash = "bonuses";
    try {
      await sharePayload({ title: "BALI Minsk", text: `Присоединяйся к BALI по моему коду ${profile.code}`, url: url.toString() });
      const added = addBonus("referral", settings.referral, "Приглашение друга — Beta3", "referral-beta3");
      toast(added ? `Начислено ${settings.referral} BALI-бонусов` : "Бонус за тестовое приглашение уже получен");
    } catch { toast("Отправка приглашения отменена"); }
  }

  async function shareEvent(eventId) {
    const event = state.events.find((item) => item.id === eventId);
    if (!event) return;
    const settings = getSettings();
    try {
      const url = new URL(location.href);
      url.hash = "events";
      await sharePayload({ title: event.title, text: `${event.title} в BALI · ${formatDate(event.event_date)} · ${event.event_time}`, url: url.toString() });
      const added = addBonus("event", settings.eventShare, `Поделились событием «${event.title}»`, `event-share-${event.id}`);
      toast(added ? `Начислено ${settings.eventShare} BALI-бонусов` : "Бонус за эту афишу уже получен");
      renderEvents();
    } catch { toast("Публикация события отменена"); }
  }

  const originalRenderEvents = renderEvents;
  renderEvents = function() {
    const settings = getSettings();
    const actions = getActions();
    const track = $("#eventTrack");
    $("#eventCount").textContent = `${state.events.length} событий`;
    track.innerHTML = state.events.length ? state.events.map((event, index) => {
      const claimed = Boolean(actions[`event-share-${event.id}`]);
      return `
        <article class="poster poster-${(index % 3) + 1}" data-event="${event.id}">
          ${event.image_url ? `<img src="${esc(event.image_url)}" alt="${esc(event.title)}"/>` : ""}
          <button class="poster-share ${claimed ? "claimed" : ""}" type="button" data-event-share="${event.id}">${claimed ? "✓ Бонус получен" : `Поделиться · +${settings.eventShare}`}</button>
          <div class="poster-visual"><small>BALI PRESENTS</small><b>${esc(event.title)}</b><i>${formatDate(event.event_date)} · ${esc(event.event_time)}</i></div>
          <div class="poster-info"><span>${formatDate(event.event_date)}</span><h3>${esc(event.title)}</h3><p>${esc(event.description)}</p></div>
        </article>`;
    }).join("") : '<div class="empty-card">Новые афиши скоро появятся</div>';
  };

  $("#eventTrack").addEventListener("click", (event) => {
    const button = event.target.closest("[data-event-share]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    shareEvent(button.dataset.eventShare);
  });

  $("#inviteFriendButton").addEventListener("click", inviteFriend);
  $("#copyReferralCode").addEventListener("click", async () => {
    await navigator.clipboard.writeText(getProfile().code);
    toast("Код приглашения скопирован");
  });
  $("#storyProofButton").addEventListener("click", () => $("#storyProofInput").click());
  $("#storyProofInput").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const day = new Date().toISOString().slice(0, 10);
    const settings = getSettings();
    const added = addBonus("story", settings.story, `Stories подтверждена: ${file.name}`, `story-${day}`);
    toast(added ? `Начислено ${settings.story} BALI-бонусов` : "Бонус за Stories сегодня уже получен");
    event.target.value = "";
  });

  window.addEventListener("storage", (event) => {
    if ([SETTINGS_KEY, PROFILE_KEY, LEDGER_KEY, ACTIONS_KEY, "bali_hall_layout_config_v1", "bali_tables_v2", "bali_events_v2"].includes(event.key)) {
      renderBonuses();
      if (event.key === "bali_events_v2") loadContent();
      if (["bali_hall_layout_config_v1", "bali_tables_v2"].includes(event.key)) loadAvailability();
    }
  });
  window.addEventListener("bali:bonus-changed", renderBonuses);

  renderEvents();
  renderBonuses();
})();