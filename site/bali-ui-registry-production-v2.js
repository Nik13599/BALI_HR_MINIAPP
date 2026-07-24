(() => {
  if (window.__BALI_UI_REGISTRY_PRODUCTION_V4__) return;
  window.__BALI_UI_REGISTRY_PRODUCTION_V4__ = true;

  let applying = false;
  let scheduled = false;

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

  function referralCard(home) {
    if (!home) return null;
    return [...home.children].find(node => /пригласить\s+друга/i.test(String(node.textContent || ""))) || null;
  }

  function sameOrder(parent, nodes) {
    const current = [...parent.children].filter(node => nodes.includes(node));
    return current.length === nodes.length && current.every((node, index) => node === nodes[index]);
  }

  function stabilizeHome() {
    const home = document.querySelector('[data-screen="home"] .inner');
    if (!home) return;

    firstOnly("#clubLinks");
    firstOnly("#eventQrHomeCard");

    const hero = home.querySelector(":scope > .hero");
    const actions = home.querySelector(":scope > .actions");
    const events = eventCard();
    const about = aboutCard(home);
    const referral = referralCard(home);
    const qr = document.getElementById("eventQrHomeCard");
    const contacts = document.getElementById("clubLinks");
    const known = new Set([hero, actions, events, about, referral, qr, contacts].filter(Boolean));
    const extras = [...home.children].filter(node => !known.has(node));
    const order = [hero, actions, events, about, referral, qr, ...extras, contacts].filter(Boolean);

    if (!sameOrder(home, order)) order.forEach(node => home.appendChild(node));

    const eventsTitle = events?.querySelector(".card-head h3");
    if (eventsTitle) eventsTitle.textContent = "Ближайшие события";
    const aboutTitle = about?.querySelector(".card-head h3");
    if (aboutTitle) aboutTitle.textContent = "О клубе";
  }

  function stabilizeProfile() {
    const quick = firstOnly("#profileV2Quick");
    if (!quick) return;
    const shop = quick.querySelector("[data-open-profile-points]");
    const rewards = quick.querySelector("[data-open-profile-rewards]");
    const gifts = quick.querySelector("[data-open-profile-gifts]");
    const invites = quick.querySelector("[data-open-profile-invitations]");
    invites?.remove();

    const setTile = (tile, smallText, strongText) => {
      if (!tile) return;
      const small = tile.querySelector("small");
      const strong = tile.querySelector("strong");
      if (small) small.textContent = smallText;
      if (strong) strong.textContent = strongText;
    };
    setTile(shop, "МАГАЗИН", "BALI Shop");
    setTile(rewards, "МОИ НАГРАДЫ", "Мои награды");
    setTile(gifts, "МОИ ПОДАРКИ", "Мои подарки");

    [shop, rewards, gifts].filter(Boolean).forEach(node => quick.appendChild(node));
  }

  function stabilizePeople() {
    const pageTitle = document.querySelector('[data-screen="dating"] .head h2');
    if (pageTitle) pageTitle.textContent = "Люди BALI";
    const labels = { all:"Все", inside:"Пришёл на мероприятие", thumbs:"👍 Лайки" };
    Object.entries(labels).forEach(([key, text]) => {
      const node = document.querySelector(`[data-social-v2-tab="${key}"]`);
      if (node) node.textContent = text;
    });
  }

  function apply() {
    if (applying) return;
    applying = true;
    try {
      stabilizeHome();
      stabilizeProfile();
      stabilizePeople();
      window.BaliDomStability?.apply?.();
    } finally {
      applying = false;
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      apply();
    });
  }

  new MutationObserver(records => {
    if (records.some(record => record.addedNodes.length || record.removedNodes.length)) schedule();
  }).observe(document.body, { childList:true, subtree:true });

  [0, 80, 250, 700, 1600, 3200].forEach(delay => setTimeout(apply, delay));
  ["bali:production-ready","bali:data-changed","bali:points-changed","bali:loyalty-changed","bali:social-changed","bali:beta4-changed"]
    .forEach(name => window.addEventListener(name, schedule));

  window.BaliUiRegistry = { apply, stabilizeHome, stabilizeProfile, stabilizePeople };
})();