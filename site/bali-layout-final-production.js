(() => {
  if (window.__BALI_LAYOUT_FINAL_PRODUCTION__) return;
  window.__BALI_LAYOUT_FINAL_PRODUCTION__ = true;

  function firstOnly(selector) {
    const nodes = [...document.querySelectorAll(selector)];
    nodes.slice(1).forEach(node => node.remove());
    return nodes[0] || null;
  }

  function findEventCard() {
    return document.getElementById("homeEvents")?.closest("section.card") || null;
  }

  function findAboutCard(home, eventCard) {
    return [...home.querySelectorAll(":scope > section.card")].find(card => {
      if (card === eventCard || card.id === "clubLinks" || card.id === "eventQrHomeCard") return false;
      const title = String(card.querySelector(".card-head h3")?.textContent || "").trim().toLowerCase();
      return title.includes("о клубе") || title.includes("клуб bali") || title.includes("клуб бали");
    }) || null;
  }

  function findReferralCard(home) {
    return [...home.children].find(node => /пригласить\s+друга/i.test(String(node.textContent || ""))) || null;
  }

  function arrangeHome() {
    const home = document.querySelector('[data-screen="home"] .inner');
    if (!home) return false;

    firstOnly("#clubLinks");
    firstOnly("#eventQrHomeCard");

    const hero = home.querySelector(":scope > .hero");
    const actions = home.querySelector(":scope > .actions");
    const events = findEventCard();
    const about = findAboutCard(home, events);
    const referral = findReferralCard(home);
    const qr = document.getElementById("eventQrHomeCard");
    const contacts = document.getElementById("clubLinks");

    const known = new Set([hero, actions, events, about, referral, qr, contacts].filter(Boolean));
    const extras = [...home.children].filter(node => !known.has(node));
    const desired = [hero, actions, events, about, referral, qr, ...extras, contacts].filter(Boolean);
    const current = [...home.children];
    const changed = current.length !== desired.length || current.some((node, index) => node !== desired[index]);
    if (changed) desired.forEach(node => home.appendChild(node));

    const eventsTitle = events?.querySelector(".card-head h3");
    if (eventsTitle && eventsTitle.textContent !== "Ближайшие события") eventsTitle.textContent = "Ближайшие события";
    const aboutTitle = about?.querySelector(".card-head h3");
    if (aboutTitle && aboutTitle.textContent !== "О клубе") aboutTitle.textContent = "О клубе";
    return true;
  }

  function arrangeProfile() {
    const quick = firstOnly("#profileV2Quick");
    if (!quick) return false;

    const shop = quick.querySelector("[data-open-profile-points]");
    const rewards = quick.querySelector("[data-open-profile-rewards]");
    const gifts = quick.querySelector("[data-open-profile-gifts]");
    quick.querySelectorAll("[data-open-profile-invitations]").forEach(node => node.remove());

    const setTile = (tile, smallText, strongText) => {
      if (!tile) return;
      const small = tile.querySelector("small");
      const strong = tile.querySelector("strong");
      if (small && small.textContent !== smallText) small.textContent = smallText;
      if (strong && strong.textContent !== strongText) strong.textContent = strongText;
    };
    setTile(shop, "МАГАЗИН", "BALI Shop");
    setTile(rewards, "МОИ НАГРАДЫ", "Мои награды");
    setTile(gifts, "МОИ ПОДАРКИ", "Мои подарки");

    const desired = [shop, rewards, gifts].filter(Boolean);
    const current = [...quick.children].filter(node => desired.includes(node));
    if (current.length !== desired.length || current.some((node, index) => node !== desired[index])) {
      desired.forEach(node => quick.appendChild(node));
    }
    return true;
  }

  function arrangePeople() {
    const title = document.querySelector('[data-screen="dating"] .head h2');
    if (title && title.textContent !== "Люди BALI") title.textContent = "Люди BALI";
    const labels = { all: "Все", inside: "Пришёл на мероприятие", thumbs: "👍 Лайки" };
    Object.entries(labels).forEach(([key, text]) => {
      const node = document.querySelector(`[data-social-v2-tab="${key}"]`);
      if (node && node.textContent !== text) node.textContent = text;
    });
  }

  function apply() {
    arrangeHome();
    arrangeProfile();
    arrangePeople();
  }

  [0, 80, 220, 500, 900, 1700, 3000].forEach(delay => setTimeout(apply, delay));
  window.addEventListener("bali:production-ready", apply, { once: true });
  window.addEventListener("bali:core-data-ready", apply);
  window.BaliUiRegistry = { apply, arrangeHome, arrangeProfile, arrangePeople };
})();