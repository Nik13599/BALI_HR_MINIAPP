(() => {
  if (window.__BALI_UI_REGISTRY_PRODUCTION_V2__) return;
  window.__BALI_UI_REGISTRY_PRODUCTION_V2__ = true;

  const STYLE_ID = "baliUiRegistryProductionV2Style";

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      [data-bali-ui-role="nearest-events"] .card-head h3,
      [data-bali-ui-role="about-club"] .card-head h3,
      #profileV2Quick [data-open-profile-points] strong,
      #profileV2Quick [data-open-profile-rewards] strong,
      #profileV2Quick [data-open-profile-gifts] strong {
        font-size:0!important;
      }
      [data-bali-ui-role="nearest-events"] .card-head h3::after{content:"Ближайшие события";font-size:13px!important}
      [data-bali-ui-role="about-club"] .card-head h3::after{content:"О клубе";font-size:13px!important}
      #profileV2Quick [data-open-profile-points] strong::after{content:"BALI Shop";font-size:19px!important}
      #profileV2Quick [data-open-profile-rewards] strong::after{content:"Мои награды";font-size:19px!important}
      #profileV2Quick [data-open-profile-gifts] strong::after{content:"Мои подарки";font-size:19px!important}
      #profileV2Quick{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important}
      #profileV2Quick .profile-v2-tile.shop{order:1!important}
      #profileV2Quick .profile-v2-tile.rewards{order:2!important}
      #profileV2Quick .profile-v2-tile.gifts{order:3!important;grid-column:1/-1!important}
      #profileV2Quick .profile-v2-tile.invites,[data-open-profile-invitations]{display:none!important}
      [data-screen="home"] .inner{display:flex!important;flex-direction:column!important}
      @media(max-width:400px){
        #profileV2Quick [data-open-profile-points] strong::after,
        #profileV2Quick [data-open-profile-rewards] strong::after,
        #profileV2Quick [data-open-profile-gifts] strong::after{font-size:15px!important}
      }
    `;
    document.head.appendChild(style);
  }

  function eventCard() {
    return document.getElementById("homeEvents")?.closest("section.card") || null;
  }

  function aboutCard(home) {
    if (!home) return null;
    const cards = [...home.querySelectorAll(":scope > section.card")];
    return cards.find(card => {
      if (card === eventCard() || card.id === "clubLinks" || card.id === "eventQrHomeCard") return false;
      const title = String(card.querySelector(".card-head h3")?.textContent || "").trim().toLowerCase();
      return title.includes("о клубе") || title.includes("клуб bali") || title.includes("клуб бали");
    }) || cards.find(card => card !== eventCard() && card.id !== "clubLinks" && card.id !== "eventQrHomeCard" && !card.classList.contains("hero")) || null;
  }

  function setOrder(node, order) {
    if (!node) return;
    node.dataset.baliHomeOrder = String(order);
    node.style.setProperty("order", String(order), "important");
  }

  function assignHomeRoles() {
    const home = document.querySelector('[data-screen="home"] .inner');
    if (!home) return;

    [...home.children].forEach((node, index) => setOrder(node, 50 + index));

    const hero = home.querySelector(":scope > .hero");
    const actions = home.querySelector(":scope > .actions");
    const qr = document.getElementById("eventQrHomeCard");
    const events = eventCard();
    const about = aboutCard(home);
    const contacts = document.getElementById("clubLinks");

    setOrder(hero, 1);
    setOrder(actions, 2);
    setOrder(qr, 3);
    setOrder(events, 4);
    setOrder(about, 5);
    setOrder(contacts, 6);

    if (events) events.dataset.baliUiRole = "nearest-events";
    if (about) about.dataset.baliUiRole = "about-club";
  }

  function normalizeProfile() {
    const quick = document.getElementById("profileV2Quick");
    if (!quick) return;

    const shop = quick.querySelector('[data-open-profile-points]');
    const rewards = quick.querySelector('[data-open-profile-rewards]');
    const gifts = quick.querySelector('[data-open-profile-gifts]');
    const invites = quick.querySelector('[data-open-profile-invitations]');

    shop?.classList.add("shop");
    rewards?.classList.add("rewards");
    gifts?.classList.add("gifts");
    invites?.classList.add("invites");

    const rewardStrong = rewards?.querySelector("strong");
    const giftStrong = gifts?.querySelector("strong");
    const rewardCount = String(rewardStrong?.textContent || "").match(/\d+\s*(?:из|\/|of)\s*\d+/i)?.[0];
    const giftCount = String(giftStrong?.textContent || "").match(/\d+/)?.[0];
    const rewardDescription = rewards?.querySelector("span");
    const giftDescription = gifts?.querySelector("span");
    if (rewardDescription && rewardCount && !rewardDescription.textContent.includes(rewardCount)) {
      rewardDescription.textContent = `${rewardCount} · Полученные и доступные награды BALI →`;
    }
    if (giftDescription && giftCount && !giftDescription.textContent.includes(`Подарков: ${giftCount}`)) {
      giftDescription.textContent = `Подарков: ${giftCount} · Посмотреть подарки и отправителей →`;
    }

    const headings = {
      profilePointsTitle: "BALI Shop",
      profileRewardsTitle: "Мои награды",
      profileGiftsTitle: "Мои подарки",
      profileSettingsTitle: "Настройки профиля",
      profileHistoryTitle: "История посещений"
    };
    Object.entries(headings).forEach(([id, text]) => {
      const node = document.getElementById(id);
      if (node && node.textContent !== text) node.textContent = text;
    });
  }

  function normalizePeople() {
    const pageTitle = document.querySelector('[data-screen="dating"] .head h2');
    if (pageTitle && pageTitle.textContent !== "Люди BALI") pageTitle.textContent = "Люди BALI";
    const all = document.querySelector('[data-social-v2-tab="all"]');
    const inside = document.querySelector('[data-social-v2-tab="inside"]');
    const thumbs = document.querySelector('[data-social-v2-tab="thumbs"]');
    if (all && all.textContent !== "Все") all.textContent = "Все";
    if (inside && inside.textContent !== "Пришёл на мероприятие") inside.textContent = "Пришёл на мероприятие";
    if (thumbs && thumbs.textContent !== "👍 Лайки") thumbs.textContent = "👍 Лайки";
  }

  function apply() {
    ensureStyle();
    assignHomeRoles();
    normalizeProfile();
    normalizePeople();
  }

  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      apply();
    });
  };

  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  ["bali:production-ready", "bali:data-changed", "bali:points-changed", "bali:loyalty-changed", "bali:social-changed", "bali:beta4-changed"]
    .forEach(name => window.addEventListener(name, schedule));
  [0, 100, 400, 1000, 2500].forEach(delay => setTimeout(apply, delay));

  window.BaliUiRegistry = { apply, assignHomeRoles, normalizeProfile, normalizePeople };
})();