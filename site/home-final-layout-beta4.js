(() => {
  if (window.__BALI_HOME_FINAL_LAYOUT__) return;
  window.__BALI_HOME_FINAL_LAYOUT__ = true;

  const game = window.BaliBeta4Game;
  if (!game) return;

  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);
  const initials = name => String(name || "B").trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();

  function profileKeys(profile) {
    const set = new Set();
    [profile.id, profile.userKey, profile.user_key, profile.ownerKey, profile.owner_key, profile.code].filter(Boolean).forEach(value => set.add(String(value)));
    try { game.identityKeys(profile).forEach(value => set.add(String(value))); } catch {}
    return set;
  }

  function activeVip(profile) {
    const keys = profileKeys(profile);
    return game.vipGifts().filter(gift => !gift.revokedAt && new Date(gift.expiresAt).getTime() > Date.now() && gift.targetKeys?.some(key => keys.has(String(key))))
      .sort((a, b) => String(b.expiresAt).localeCompare(String(a.expiresAt)))[0] || null;
  }

  function statusClass(profile) {
    const vip = activeVip(profile);
    if (vip?.planId === "legend") return "home-profile-legend";
    if (vip?.planId === "black") return "home-profile-black";
    if (vip) return "home-profile-vip";
    const level = game.levelFor(Number(profile.xp || 0)).current?.name || "";
    if (/legend/i.test(level)) return "home-profile-level-legend";
    if (/insider/i.test(level)) return "home-profile-level-insider";
    if (/regular/i.test(level)) return "home-profile-level-regular";
    return "home-profile-default";
  }

  function styles() {
    if (document.getElementById("homeFinalLayoutStyle")) return;
    const style = document.createElement("style");
    style.id = "homeFinalLayoutStyle";
    style.textContent = `
      .top{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important}
      .top .brand{min-width:0;flex:1}
      .top-profile-button{position:relative;width:46px;height:46px;flex:0 0 46px;padding:0;border:0;border-radius:50%;background:#151917;color:#fff;overflow:visible}
      .top-profile-button .top-profile-avatar{width:42px;height:42px;display:grid;place-items:center;border-radius:50%;overflow:hidden;background:#1d221f;color:var(--lime);font:600 13px Unbounded}
      .top-profile-button img{width:100%;height:100%;object-fit:cover}
      .top-profile-button:after{content:"✓";position:absolute;right:-2px;bottom:-1px;width:17px;height:17px;display:grid;place-items:center;border:2px solid #080a0a;border-radius:50%;background:var(--lime);color:#071006;font-size:9px;font-weight:950}
      .top-profile-button.home-profile-vip .top-profile-avatar{box-shadow:0 0 0 3px #f2cd66,0 0 15px rgba(242,205,102,.45)}
      .top-profile-button.home-profile-black .top-profile-avatar{box-shadow:0 0 0 3px #e6e6e6,0 0 0 6px #171918}
      .top-profile-button.home-profile-legend .top-profile-avatar{box-shadow:0 0 0 3px #f2cd66,0 0 0 6px #9c6cff,0 0 19px rgba(156,108,255,.5)}
      .top-profile-button.home-profile-level-legend .top-profile-avatar{box-shadow:0 0 0 3px #a77cff}
      .top-profile-button.home-profile-level-insider .top-profile-avatar{box-shadow:0 0 0 3px #4fd5ff}
      .top-profile-button.home-profile-level-regular .top-profile-avatar{box-shadow:0 0 0 3px var(--lime)}
      .top-profile-button.home-profile-default .top-profile-avatar{box-shadow:0 0 0 2px rgba(255,255,255,.22)}
      [data-screen="home"] .actions{display:none!important}
      [data-screen="home"] #eventQrHomeCard{margin-top:12px}
      [data-screen="home"] .home-events{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:7px!important}
      [data-screen="home"] .compact-event{display:flex!important;flex-direction:column!important;min-width:0!important;overflow:hidden!important;border:1px solid var(--line)!important;border-radius:14px!important;background:#101311!important}
      [data-screen="home"] .compact-event>div:first-child{width:100%!important;aspect-ratio:4/5!important;overflow:hidden!important}
      [data-screen="home"] .compact-event>div:first-child img,[data-screen="home"] .compact-event>div:first-child .placeholder{width:100%!important;height:100%!important;object-fit:cover!important}
      [data-screen="home"] .compact-event>div:nth-child(2){padding:8px!important;min-width:0!important}
      [data-screen="home"] .compact-event h3{margin:0 0 4px!important;font-size:9px!important;line-height:1.3!important;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
      [data-screen="home"] .compact-event p{margin:0!important;font-size:7px!important;line-height:1.4!important}
      [data-screen="home"] .compact-event>button{width:calc(100% - 12px)!important;min-height:31px!important;margin:auto 6px 6px!important;border-radius:10px!important}
      .home-all-events{width:100%;min-height:44px;margin-top:9px}
      #clubLinks .club-links{display:grid!important;grid-template-columns:1fr!important;gap:7px!important}
      #clubLinks .club-links a{min-height:57px!important}
      @media(max-width:360px){[data-screen="home"] .home-events{gap:5px!important}[data-screen="home"] .compact-event h3{font-size:8px!important}}
    `;
    document.head.appendChild(style);
  }

  function mountProfileButton() {
    const top = document.querySelector(".shell > .top");
    if (!top) return false;
    top.querySelector("#shareApp")?.remove();
    let button = top.querySelector(".top-profile-button");
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "top-profile-button";
      button.dataset.page = "profile";
      button.title = "Мой профиль";
      top.appendChild(button);
    }
    const profile = game.profile();
    [...button.classList].filter(name => name.startsWith("home-profile-")).forEach(name => button.classList.remove(name));
    button.classList.add(statusClass(profile));
    const avatar = profile.avatar || profile.photo || "";
    button.innerHTML = `<span class="top-profile-avatar">${avatar ? `<img src="${esc(avatar)}" alt="${esc(profile.name || "Профиль")}">` : esc(initials(profile.name))}</span>`;
    return true;
  }

  function upcomingCard(inner) {
    return document.getElementById("homeEvents")?.closest(".card") || null;
  }

  function aboutCard(inner, upcoming, contacts) {
    return [...inner.querySelectorAll(":scope > section.card")].find(card => card !== upcoming && card !== contacts) || null;
  }

  function reorderContacts(contacts) {
    const links = contacts?.querySelector(".club-links");
    if (!links) return;
    const items = [...links.querySelectorAll("a")];
    const find = pattern => items.find(item => pattern.test(item.textContent || ""));
    [find(/менеджер/i), find(/позвонить/i), find(/добраться|карт/i), find(/instagram/i), find(/telegram/i)].filter(Boolean).forEach(item => links.appendChild(item));
  }

  function layout() {
    const inner = document.querySelector('[data-screen="home"] .inner');
    const hero = inner?.querySelector(".hero");
    const checkin = document.getElementById("eventQrHomeCard");
    const upcoming = inner ? upcomingCard(inner) : null;
    const contacts = document.getElementById("clubLinks");
    if (!inner || !hero || !checkin || !upcoming || !contacts) return false;

    const title = upcoming.querySelector(".card-head h3");
    const oldButton = upcoming.querySelector('.card-head [data-page="events"]');
    if (title) title.textContent = "Ближайшие события";
    oldButton?.remove();
    let all = upcoming.querySelector(".home-all-events");
    if (!all) {
      all = document.createElement("button");
      all.type = "button";
      all.className = "secondary home-all-events";
      all.dataset.page = "events";
      all.textContent = "Остальные афиши";
      upcoming.appendChild(all);
    }

    const contactsTitle = contacts.querySelector(".card-head h3");
    if (contactsTitle) contactsTitle.textContent = "Связаться с BALI";
    reorderContacts(contacts);
    const about = aboutCard(inner, upcoming, contacts);

    hero.insertAdjacentElement("afterend", checkin);
    checkin.insertAdjacentElement("afterend", upcoming);
    upcoming.insertAdjacentElement("afterend", contacts);
    if (about) contacts.insertAdjacentElement("afterend", about);
    return true;
  }

  function apply() {
    styles();
    mountProfileButton();
    layout();
  }

  const observer = new MutationObserver(records => {
    if (records.some(record => record.addedNodes.length)) requestAnimationFrame(apply);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  ["bali:beta4-changed", "bali:data-changed", "bali:points-changed", "bali:home-design-changed"].forEach(name => window.addEventListener(name, () => setTimeout(apply, 0)));
  setTimeout(apply, 100);
  setTimeout(apply, 400);
})();