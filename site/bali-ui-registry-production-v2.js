(() => {
  if (window.__BALI_UI_REGISTRY_PRODUCTION_V3__) return;
  window.__BALI_UI_REGISTRY_PRODUCTION_V3__ = true;

  const STYLE_ID = "baliUiRegistryProductionV3Style";

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      [data-screen="home"] .inner{display:flex!important;flex-direction:column!important}
      [data-screen="home"] .inner>[data-bali-home-order="1"]{order:1!important}
      [data-screen="home"] .inner>[data-bali-home-order="2"]{order:2!important}
      [data-screen="home"] .inner>[data-bali-home-order="3"]{order:3!important}
      [data-screen="home"] .inner>[data-bali-home-order="4"]{order:4!important}
      [data-screen="home"] .inner>[data-bali-home-order="5"]{order:5!important}
      [data-screen="home"] .inner>[data-bali-home-order="6"]{order:6!important}
      #profileV2Quick{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important}
      #profileV2Quick .profile-v2-tile.shop{order:1!important}
      #profileV2Quick .profile-v2-tile.rewards{order:2!important}
      #profileV2Quick .profile-v2-tile.gifts{order:3!important;grid-column:1/-1!important}
      #profileV2Quick .profile-v2-tile.invites,[data-open-profile-invitations]{display:none!important}
      @media(max-width:400px){#profileV2Quick{gap:7px!important}}
    `;
    document.head.appendChild(style);
  }

  function firstOnly(selector) {
    const nodes = [...document.querySelectorAll(selector)];
    nodes.slice(1).forEach(node => node.remove());
    return nodes[0] || null;
  }

  function eventCard() {
    return document.getElementById("homeEvents")?.closest("section.card") || null;
  }

  function aboutCard(home) {
    if (!home) return null;
    return [...home.querySelectorAll(":scope > section.card")].find(card => {
      if (card === eventCard() || card.id === "clubLinks" || card.id === "eventQrHomeCard") return false;
      const title = String(card.querySelector(".card-head h3")?.textContent || "").trim().toLowerCase();
      return title.includes("о клубе") || title.includes("клуб bali") || title.includes("клуб бали");
    }) || null;
  }

  function assignHomeRoles() {
    const home = document.querySelector('[data-screen="home"] .inner');
    if (!home) return;

    firstOnly("#clubLinks");
    firstOnly("#eventQrHomeCard");
    firstOnly("#profileV2Quick");

    const hero = home.querySelector(":scope > .hero");
    const actions = home.querySelector(":scope > .actions");
    const qr = document.getElementById("eventQrHomeCard");
    const events = eventCard();
    const about = aboutCard(home);
    const contacts = document.getElementById("clubLinks");

    [hero, actions, qr, events, about, contacts].forEach((node, index) => {
      if (node) node.dataset.baliHomeOrder = String(index + 1);
    });

    const eventsTitle = events?.querySelector(".card-head h3");
    if (eventsTitle && eventsTitle.textContent !== "Ближайшие события") eventsTitle.textContent = "Ближайшие события";

    const aboutTitle = about?.querySelector(".card-head h3");
    if (aboutTitle && aboutTitle.textContent !== "О клубе") aboutTitle.textContent = "О клубе";
  }

  function normalizeProfile() {
    const quick = firstOnly("#profileV2Quick");
    if (!quick) return;

    const shop = quick.querySelector('[data-open-profile-points]');
    const rewards = quick.querySelector('[data-open-profile-rewards]');
    const gifts = quick.querySelector('[data-open-profile-gifts]');
    const invites = quick.querySelector('[data-open-profile-invitations]');

    shop?.classList.add("shop");
    rewards?.classList.add("rewards");
    gifts?.classList.add("gifts");
    invites?.classList.add("invites");

    const setStrong = (tile, text) => {
      const strong = tile?.querySelector("strong");
      if (strong && strong.textContent !== text) strong.textContent = text;
    };
    setStrong(shop, "BALI Shop");
    setStrong(rewards, "Мои награды");
    setStrong(gifts, "Мои подарки");

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
    const labels = {
      all: "Все",
      inside: "Пришёл на мероприятие",
      thumbs: "👍 Лайки"
    };
    Object.entries(labels).forEach(([key, text]) => {
      const node = document.querySelector(`[data-social-v2-tab="${key}"]`);
      if (node && node.textContent !== text) node.textContent = text;
    });
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

  new MutationObserver(records => {
    if (records.some(record => record.addedNodes.length || record.removedNodes.length)) schedule();
  }).observe(document.body, { childList: true, subtree: true });

  ["bali:production-ready", "bali:data-changed", "bali:points-changed", "bali:loyalty-changed", "bali:social-changed", "bali:beta4-changed"]
    .forEach(name => window.addEventListener(name, schedule));

  [0, 100, 400, 1000].forEach(delay => setTimeout(apply, delay));
  window.BaliUiRegistry = { apply, assignHomeRoles, normalizeProfile, normalizePeople };
})();