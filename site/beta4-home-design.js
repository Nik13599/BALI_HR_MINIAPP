(() => {
  if (window.__BALI_HOME_DESIGN_GUEST__ || !window.BaliHomeDesign) return;
  window.__BALI_HOME_DESIGN_GUEST__ = true;
  const design = window.BaliHomeDesign;
  const cfg = window.BALI_CONFIG || {};
  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[char]));

  function styles() {
    if (document.getElementById("guestHomeDesignStyle")) return;
    const style = document.createElement("style");
    style.id = "guestHomeDesignStyle";
    style.textContent = `.home-design-icon{width:23px;height:23px;object-fit:contain;flex:0 0 auto}.brand .logo img{width:100%;height:100%;object-fit:contain;border-radius:inherit}.hero.home-designed,.home-designed-card{background-position:center!important;background-size:cover!important;background-repeat:no-repeat!important}.home-designed[data-align="center"],.home-designed-card[data-align="center"]{text-align:center}.home-designed[data-align="right"],.home-designed-card[data-align="right"]{text-align:right}.home-designed[data-align="center"] .pills,.home-designed-card[data-align="center"] .card-head,.home-designed-card[data-align="center"] .club-links a{justify-content:center}.home-designed[data-align="right"] .pills,.home-designed-card[data-align="right"] .card-head{justify-content:flex-end}.home-designed-card[data-align="center"] .club-links a{text-align:left}.home-action-designed{background-position:center;background-size:cover;background-repeat:no-repeat;border-radius:18px;padding:4px}.home-action-designed button{display:flex;align-items:center;justify-content:center;gap:8px}.club-links a>i.has-image{background:transparent}.club-links a>i.has-image img{width:100%;height:100%;object-fit:contain}.event-checkin-card[data-align="center"]{text-align:center}.event-checkin-card[data-align="center"] button{justify-content:center}.event-checkin-card[data-align="right"]{text-align:right}`;
    document.head.appendChild(style);
  }

  function blockStyle(node, section) {
    if (!node || !section) return;
    node.classList.add("home-designed-card");
    node.dataset.align = section.align || "left";
    node.style.backgroundColor = section.backgroundColor || "";
    node.style.minHeight = Number(section.minHeight || 0) ? `${Number(section.minHeight)}px` : "";
    node.style.backgroundImage = section.backgroundImage ? `linear-gradient(rgba(4,7,5,.34),rgba(4,7,5,.62)),url("${String(section.backgroundImage).replace(/"/g,"%22")}")` : "";
  }

  function iconButton(button, title, icon) {
    if (!button) return;
    button.replaceChildren();
    if (icon) {
      const image = document.createElement("img");
      image.className = "home-design-icon";
      image.src = icon;
      image.alt = "";
      button.appendChild(image);
    }
    button.appendChild(document.createTextNode(title || ""));
  }

  function applyBrand(current) {
    const brand = document.querySelector(".top .brand");
    if (!brand) return;
    const logo = brand.querySelector(".logo");
    if (logo) logo.innerHTML = current.brand.logo ? `<img src="${esc(current.brand.logo)}" alt="${esc(current.brand.name)}">` : esc((current.brand.name || "B").slice(0,1));
    const strong = brand.querySelector("strong"), small = brand.querySelector("small");
    if (strong) strong.textContent = current.brand.name || "BALI";
    if (small) small.textContent = current.brand.subtitle || "";
  }

  function applyHero(current) {
    const hero = document.querySelector('[data-screen="home"] .hero');
    if (!hero) return;
    hero.classList.add("home-designed");
    hero.dataset.align = current.hero.align || "left";
    hero.style.minHeight = `${Number(current.hero.minHeight || 310)}px`;
    hero.style.backgroundColor = current.hero.backgroundColor || "";
    hero.style.backgroundImage = current.hero.backgroundImage ? `linear-gradient(rgba(4,7,5,.25),rgba(4,7,5,.72)),url("${String(current.hero.backgroundImage).replace(/"/g,"%22")}")` : "";
    const eyebrow = hero.querySelector(".eyebrow"), title = hero.querySelector("h1"), text = hero.querySelector("p"), pills = hero.querySelector(".pills");
    if (eyebrow) eyebrow.textContent = current.hero.eyebrow || "";
    if (title) title.innerHTML = `${esc(current.hero.title || "")}<br><em>${esc(current.hero.accentTitle || "")}</em>`;
    if (text) text.textContent = current.hero.text || "";
    if (pills) pills.innerHTML = (current.hero.pills || []).map(item => `<span>${esc(item)}</span>`).join("");
  }

  function applyActions(current) {
    const actions = document.querySelector('[data-screen="home"] .actions');
    if (!actions) return;
    actions.classList.add("home-action-designed");
    actions.style.justifyContent = current.actions.align === "right" ? "flex-end" : current.actions.align === "left" ? "flex-start" : "center";
    actions.style.backgroundColor = current.actions.backgroundColor || "";
    actions.style.backgroundImage = current.actions.backgroundImage ? `url("${String(current.actions.backgroundImage).replace(/"/g,"%22")}")` : "";
    iconButton(actions.querySelector('[data-page="events"]'), current.actions.events.title, current.actions.events.icon);
    iconButton(actions.querySelector('[data-page="profile"]'), current.actions.profile.title, current.actions.profile.icon);
  }

  function applyUpcoming(current) {
    const home = document.querySelector('[data-screen="home"] .inner');
    const card = document.getElementById("homeEvents")?.closest(".card");
    if (!home || !card) return;
    blockStyle(card, current.upcoming);
    const title = card.querySelector(".card-head h3"), button = card.querySelector('.card-head [data-page="events"]');
    if (title) title.textContent = current.upcoming.title || "";
    if (button) button.textContent = current.upcoming.button || "";
  }

  function applyAbout(current) {
    const cards = [...document.querySelectorAll('[data-screen="home"] .inner > section.card')];
    const about = cards.find(card => card !== document.getElementById("homeEvents")?.closest(".card") && card.id !== "clubLinks");
    if (!about) return;
    blockStyle(about, current.about);
    const title = about.querySelector(".card-head h3"), text = about.querySelector("p");
    if (title) title.textContent = current.about.title || "";
    if (text) text.textContent = current.about.text || "";
  }

  function applyContacts(current) {
    const card = document.getElementById("clubLinks");
    if (!card) return;
    blockStyle(card, current.contacts);
    const title = card.querySelector(".card-head h3");
    if (title) title.textContent = current.contacts.title || "";
    [...card.querySelectorAll(".club-links a")].forEach(link => {
      const key = link.dataset.contactKey || "";
      const item = current.contacts[key] || {};
      const strong = link.querySelector("strong"), small = link.querySelector("small"), icon = link.querySelector("i");
      if (strong && item.title) strong.textContent = item.title;
      if (small && item.subtitle) small.textContent = item.subtitle;
      if (icon) {
        icon.classList.toggle("has-image", Boolean(item.icon));
        if (item.icon) icon.innerHTML = `<img src="${esc(item.icon)}" alt="">`;
      }
      if (item.href) {
        link.href = key === "phone" && !item.href.startsWith("tel:") ? `tel:${item.href.replace(/[^+\d]/g,"")}` : item.href;
      } else if (key === "instagram") link.href = cfg.instagramUrl || link.href;
      else if (key === "telegram") link.href = cfg.telegramChannelUrl || link.href;
      else if (key === "manager") link.href = cfg.managerTelegramUrl || link.href;
      else if (key === "phone") link.href = `tel:${String(cfg.venuePhone || "+375296700300").replace(/[^+\d]/g,"")}`;
      else if (key === "map") link.href = cfg.yandexMapUrl || link.href;
    });
  }

  function applyCheckin(current) {
    const card = document.getElementById("eventQrHomeCard");
    if (!card) return;
    card.dataset.align = current.checkin.align || "left";
    card.style.minHeight = Number(current.checkin.minHeight || 0) ? `${Number(current.checkin.minHeight)}px` : "";
    card.style.backgroundColor = current.checkin.backgroundColor || "";
    card.style.backgroundImage = current.checkin.backgroundImage ? `linear-gradient(rgba(4,7,5,.3),rgba(4,7,5,.7)),url("${String(current.checkin.backgroundImage).replace(/"/g,"%22")}")` : "";
    card.style.backgroundPosition = "center";
    card.style.backgroundSize = "cover";
    const eyebrow = card.querySelector(".eyebrow"), title = card.querySelector("h3"), text = card.querySelector("p"), button = card.querySelector("[data-open-event-qr]");
    if (eyebrow) eyebrow.textContent = current.checkin.eyebrow || "";
    if (title) title.textContent = current.checkin.title || "";
    if (text) text.textContent = current.checkin.text || "";
    iconButton(button, current.checkin.button, current.checkin.icon);
  }

  function apply() {
    const current = design.read();
    document.documentElement.style.setProperty("--lime", current.global.accent || "#c8ff3d");
    document.documentElement.style.setProperty("--text", current.global.text || "#f5f7f5");
    document.body.style.backgroundColor = current.global.pageBackground || "#080a0a";
    applyBrand(current); applyHero(current); applyActions(current); applyUpcoming(current); applyAbout(current); applyContacts(current); applyCheckin(current);
  }

  styles();
  window.addEventListener("bali:home-design-changed", apply);
  window.addEventListener("bali:data-changed", () => requestAnimationFrame(apply));
  let attempts = 0;
  const timer = setInterval(() => { attempts += 1; apply(); if ((document.getElementById("clubLinks") && document.getElementById("eventQrHomeCard")) || attempts > 40) clearInterval(timer); }, 100);
})();