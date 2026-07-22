(() => {
  if (window.__BALI_HOME_FINAL_LAYOUT__) return;
  window.__BALI_HOME_FINAL_LAYOUT__ = true;

  const game = window.BaliBeta4Game;
  if (!game) return;

  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);
  const initials = name => String(name || "B").trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();

  function styles() {
    if (document.getElementById("homeFinalLayoutStyle")) return;
    const style = document.createElement("style");
    style.id = "homeFinalLayoutStyle";
    style.textContent = `
      .top-profile-button{position:relative;width:44px;height:44px;display:grid;place-items:center;padding:3px;border:0;border-radius:50%;background:#171c1a;cursor:pointer}
      .top-profile-avatar{width:100%;height:100%;display:grid;place-items:center;overflow:hidden;border-radius:50%;background:linear-gradient(145deg,#2a312d,#111513);color:var(--lime);font:600 12px Unbounded}
      .top-profile-avatar img{width:100%;height:100%;object-fit:cover}
      .top-profile-status{position:absolute;right:-2px;bottom:-1px;min-width:17px;height:17px;display:grid;place-items:center;padding:0 3px;border:2px solid #080a0a;border-radius:999px;background:var(--lime);color:#080a0a;font-size:8px;font-weight:950}
      .top-profile-button.profile-ring-vip{box-shadow:0 0 0 2px #e3bd64,0 0 14px rgba(227,189,100,.35)}
      .top-profile-button.profile-ring-black{box-shadow:0 0 0 2px #e5e5e5,0 0 0 4px #191c1a,0 0 15px rgba(255,255,255,.22)}
      .top-profile-button.profile-ring-legend{box-shadow:0 0 0 2px #e3bd64,0 0 0 4px #9c6cff,0 0 18px rgba(156,108,255,.45)}
      .top-profile-button.profile-ring-insider{box-shadow:0 0 0 2px #4fd5ff,0 0 13px rgba(79,213,255,.35)}
      .top-profile-button.profile-ring-regular{box-shadow:0 0 0 2px var(--lime)}
      [data-screen="home"] .actions{display:none!important}
      #homeEvents{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:7px!important}
      #homeEvents .compact-event{position:relative;display:block!important;min-width:0;padding:6px!important;border-radius:14px!important;cursor:pointer;overflow:hidden}
      #homeEvents .compact-event>div:first-child{width:100%;margin:0 0 7px}
      #homeEvents .compact-event img,#homeEvents .compact-event .placeholder{width:100%!important;aspect-ratio:4/5!important;border-radius:10px!important}
      #homeEvents .compact-event h3{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;font-size:9px!important;line-height:1.25!important}
      #homeEvents .compact-event p{margin-top:4px!important;font-size:7px!important;line-height:1.35}
      #homeEvents .compact-event button{display:none!important}
      #clubLinks .club-links{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px!important}
      #clubLinks .club-links a{min-width:0}
      #clubLinks .club-links a[data-contact-key="manager"],#clubLinks .club-links a[data-contact-key="map"]{grid-column:1/-1}
      #clubLinks .home-social-label{grid-column:1/-1;margin:5px 1px -1px;padding-top:10px;border-top:1px solid var(--line);color:var(--muted);font-size:8px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}
      #clubLinks .club-links a[data-contact-key="instagram"],#clubLinks .club-links a[data-contact-key="telegram"]{background:rgba(200,255,61,.035)}
      .home-club-footer{order:99}
      @media(max-width:370px){#homeEvents{gap:5px!important}#homeEvents .compact-event{padding:5px!important}#homeEvents .compact-event h3{font-size:8px!important}#homeEvents .compact-event p{font-size:6px!important}.top-profile-button{width:42px;height:42px}}
    `;
    document.head.appendChild(style);
  }

  function profileStatus() {
    const profile = game.profile();
    const vip = game.vip();
    if (vip) {
      const planId = String(vip.planId || vip.plan?.id || "vip");
      if (planId === "legend") return { className: "profile-ring-legend", icon: "◆", label: vip.plan?.name || "BALI LEGEND" };
      if (planId === "black") return { className: "profile-ring-black", icon: "B", label: vip.plan?.name || "BALI BLACK" };
      return { className: "profile-ring-vip", icon: "★", label: vip.plan?.name || "BALI VIP" };
    }
    const level = game.levelFor(Number(profile.xp || 0)).current;
    if (level.id === "legend") return { className: "profile-ring-legend", icon: "◆", label: level.name };
    if (level.id === "insider") return { className: "profile-ring-insider", icon: "✓", label: level.name };
    if (level.id === "regular") return { className: "profile-ring-regular", icon: "✓", label: level.name };
    return { className: "", icon: "✓", label: level.name || "Профиль BALI" };
  }

  function renderTopProfile() {
    const top = document.querySelector(".top");
    const brand = top?.querySelector(".brand");
    if (!top || !brand) return false;
    let button = document.getElementById("topProfileButton");
    if (!button) {
      top.querySelector(".top-action")?.remove();
      button = document.createElement("button");
      button.type = "button";
      button.id = "topProfileButton";
      button.dataset.page = "profile";
      top.appendChild(button);
    }
    const profile = game.profile();
    const status = profileStatus();
    const className = `top-profile-button ${status.className}`.trim();
    const title = `Мой профиль · ${status.label}`;
    const html = `<span class="top-profile-avatar">${profile.avatar ? `<img src="${esc(profile.avatar)}" alt="${esc(profile.name || "Мой профиль")}">` : esc(initials(profile.name))}</span><span class="top-profile-status">${esc(status.icon)}</span>`;
    if (button.className !== className) button.className = className;
    if (button.title !== title) button.title = title;
    if (button.getAttribute("aria-label") !== `Мой профиль. Статус: ${status.label}`) button.setAttribute("aria-label", `Мой профиль. Статус: ${status.label}`);
    if (button.innerHTML !== html) button.innerHTML = html;
    return true;
  }

  function eventCard() {
    return document.getElementById("homeEvents")?.closest("section.card") || null;
  }

  function aboutCard(inner) {
    return [...inner.querySelectorAll(":scope > section.card")].find(card => card !== eventCard() && card.id !== "clubLinks") || null;
  }

  function decorateEvents() {
    const card = eventCard();
    if (!card) return;
    const title = card.querySelector(".card-head h3");
    const all = card.querySelector('.card-head [data-page="events"]');
    if (title && title.textContent !== "Ближайшие события") title.textContent = "Ближайшие события";
    if (all && all.textContent !== "Остальные афиши") all.textContent = "Остальные афиши";
    card.querySelectorAll("#homeEvents .compact-event").forEach(article => {
      const button = article.querySelector("[data-event]");
      if (button?.dataset.event) {
        if (article.dataset.event !== button.dataset.event) article.dataset.event = button.dataset.event;
        if (article.getAttribute("role") !== "button") article.setAttribute("role", "button");
        if (article.tabIndex !== 0) article.tabIndex = 0;
      }
    });
  }

  function decorateContacts() {
    const card = document.getElementById("clubLinks");
    const links = card?.querySelector(".club-links");
    if (!card || !links) return;
    const title = card.querySelector(".card-head h3");
    if (title && title.textContent !== "Связаться с BALI") title.textContent = "Связаться с BALI";
    let label = links.querySelector(".home-social-label");
    const instagram = links.querySelector('[data-contact-key="instagram"]');
    if (!label && instagram) {
      label = document.createElement("div");
      label.className = "home-social-label";
      label.textContent = "Мы в социальных сетях";
      instagram.before(label);
    }
  }

  function arrangeHome() {
    const inner = document.querySelector('[data-screen="home"] .inner');
    if (!inner) return false;
    const hero = inner.querySelector(":scope > .hero");
    const actions = inner.querySelector(":scope > .actions");
    const checkin = document.getElementById("eventQrHomeCard");
    const upcoming = eventCard();
    const contacts = document.getElementById("clubLinks");
    const about = aboutCard(inner);
    if (about) {
      about.classList.add("home-club-footer");
      const title = about.querySelector(".card-head h3");
      if (title && title.textContent.trim() === "О клубе") title.textContent = "Клуб BALI";
    }
    const desired = [hero, actions, checkin, upcoming, contacts, about].filter(Boolean);
    const desiredSet = new Set(desired);
    const current = [...inner.children].filter(node => desiredSet.has(node));
    const orderChanged = current.length !== desired.length || desired.some((node, index) => current[index] !== node);
    if (orderChanged) desired.forEach(node => inner.appendChild(node));
    decorateEvents();
    decorateContacts();
    return Boolean(hero && checkin && upcoming && contacts);
  }

  function refresh() {
    renderTopProfile();
    arrangeHome();
  }

  document.addEventListener("keydown", event => {
    const card = event.target.closest?.("#homeEvents .compact-event[data-event]");
    if (card && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      card.click();
    }
  });

  styles();
  ["bali:beta4-changed", "bali:points-changed", "bali:data-changed", "bali:home-design-changed", "bali:checkin-complete", "bali:checkin-left"].forEach(name => window.addEventListener(name, () => setTimeout(refresh, 0)));
  const observer = new MutationObserver(() => requestAnimationFrame(refresh));
  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    refresh();
    const inner = document.querySelector('[data-screen="home"] .inner');
    if (inner && !observer.__started) {
      observer.__started = true;
      observer.observe(inner, { childList: true, subtree: true });
    }
    if (arrangeHome() || attempts > 60) clearInterval(timer);
  }, 100);

  window.BaliHomeFinalLayout = { refresh, arrangeHome, renderTopProfile };
})();