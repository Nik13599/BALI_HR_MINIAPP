(() => {
  if (window.__BALI_HOME_FINAL_LAYOUT__) return;
  window.__BALI_HOME_FINAL_LAYOUT__ = true;

  const game = window.BaliBeta4Game;
  const cfg = window.BALI_CONFIG || {};
  if (!game) return;

  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);
  const initials = name => String(name || "B").trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
  let layoutReady = false;
  let scheduled = false;

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
      .pages{min-height:0!important;overflow:hidden!important;touch-action:pan-y!important}
      .page{overflow-y:auto!important;overflow-x:hidden!important;touch-action:pan-y!important;overscroll-behavior-y:contain!important;-webkit-overflow-scrolling:touch!important}
      .page.active{display:block!important}
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
      #clubLinks{display:grid!important;gap:10px!important;padding:0!important;border:0!important;background:transparent!important}
      .home-contact-group{padding:15px;border:1px solid var(--line);border-radius:20px;background:var(--panel)}
      .home-contact-group h3{margin:0 0 5px;font-size:15px}.home-contact-group>p{margin:0 0 11px;color:var(--muted);font-size:9px;line-height:1.5}
      .home-contact-row{display:grid;gap:7px}.home-contact-row.social{grid-template-columns:repeat(3,minmax(0,1fr))}.home-contact-row.contact{grid-template-columns:repeat(2,minmax(0,1fr))}
      .home-contact-link{min-width:0;min-height:54px;display:grid;place-items:center;gap:3px;padding:8px;border:1px solid var(--line);border-radius:14px;background:#ffffff06;text-align:center;text-decoration:none}
      .home-contact-link i{font-style:normal;font-size:18px}.home-contact-link strong{display:block;font-size:9px}.home-contact-link small{display:block;color:var(--muted);font-size:7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
      .home-map-link{grid-template-columns:32px minmax(0,1fr) auto!important;place-items:center start!important;text-align:left!important;padding:10px 12px!important}.home-map-link b{color:var(--lime)}
      @media(max-width:360px){[data-screen="home"] .home-events{gap:5px!important}[data-screen="home"] .compact-event h3{font-size:8px!important}.home-contact-link strong{font-size:8px}}
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
    const html = `<span class="top-profile-avatar">${avatar ? `<img src="${esc(avatar)}" alt="${esc(profile.name || "Профиль")}">` : esc(initials(profile.name))}</span>`;
    if (button.innerHTML !== html) button.innerHTML = html;
    return true;
  }

  function upcomingCard() {
    return document.getElementById("homeEvents")?.closest(".card") || null;
  }

  function aboutCard(inner, upcoming, contacts) {
    return [...inner.querySelectorAll(":scope > section.card")].find(card => card !== upcoming && card !== contacts) || null;
  }

  function buildContacts(contacts) {
    if (!contacts || contacts.dataset.grouped === "true") return;
    const instagram = cfg.instagramUrl || "https://www.instagram.com/baliminsk/";
    const telegram = cfg.telegramChannelUrl || "https://t.me/baliclubminsk";
    const tiktok = cfg.tiktokUrl || "https://www.tiktok.com/@baliminsk";
    const map = cfg.yandexMapUrl || "https://yandex.by/maps/org/bali_night_club/104137822369/";
    const manager = cfg.managerTelegramUrl || "https://t.me/BALI_MINSK";
    const phone = cfg.venuePhone || "+375296700300";
    const address = cfg.venueAddress || "г. Минск, ул. Кирова, д. 13";
    contacts.dataset.grouped = "true";
    contacts.innerHTML = `
      <section class="home-contact-group"><h3>Мы в соцсетях</h3><p>Новости, афиши и атмосфера BALI</p><div class="home-contact-row social">
        <a class="home-contact-link" href="${esc(instagram)}" data-open-link><i>◎</i><strong>Instagram</strong></a>
        <a class="home-contact-link" href="${esc(telegram)}" data-telegram-link><i>✈</i><strong>Telegram</strong></a>
        <a class="home-contact-link" href="${esc(tiktok)}" data-open-link><i>♪</i><strong>TikTok</strong></a>
      </div></section>
      <section class="home-contact-group"><h3>Как нас найти</h3><p>${esc(address)}</p><div class="home-contact-row">
        <a class="home-contact-link home-map-link" href="${esc(map)}" data-open-link><i>⌖</i><span><strong>Как добраться</strong><small>Открыть маршрут в Яндекс Картах</small></span><b>›</b></a>
      </div></section>
      <section class="home-contact-group"><h3>Связь с BALI</h3><p>Бронирование и вопросы по посещению</p><div class="home-contact-row contact">
        <a class="home-contact-link" href="${esc(manager)}" data-telegram-link><i>💬</i><strong>Менеджер</strong><small>Открыть чат</small></a>
        <a class="home-contact-link" href="tel:${esc(String(phone).replace(/[^+\d]/g, ""))}"><i>☎</i><strong>Позвонить</strong><small>${esc(phone)}</small></a>
      </div></section>`;
  }

  function layout() {
    const inner = document.querySelector('[data-screen="home"] .inner');
    const hero = inner?.querySelector(".hero");
    const checkin = document.getElementById("eventQrHomeCard");
    const upcoming = upcomingCard();
    const contacts = document.getElementById("clubLinks");
    if (!inner || !hero || !checkin || !upcoming || !contacts) return false;

    const title = upcoming.querySelector(".card-head h3");
    if (title) title.textContent = "Ближайшие события";
    upcoming.querySelector('.card-head [data-page="events"]')?.remove();
    let all = upcoming.querySelector(".home-all-events");
    if (!all) {
      all = document.createElement("button");
      all.type = "button";
      all.className = "secondary home-all-events";
      all.dataset.page = "events";
      all.textContent = "Остальные афиши";
      upcoming.appendChild(all);
    }

    buildContacts(contacts);
    const about = aboutCard(inner, upcoming, contacts);
    if (hero.nextElementSibling !== checkin) hero.insertAdjacentElement("afterend", checkin);
    if (checkin.nextElementSibling !== upcoming) checkin.insertAdjacentElement("afterend", upcoming);
    if (upcoming.nextElementSibling !== contacts) upcoming.insertAdjacentElement("afterend", contacts);
    if (about && contacts.nextElementSibling !== about) contacts.insertAdjacentElement("afterend", about);
    layoutReady = true;
    return true;
  }

  function apply() {
    styles();
    mountProfileButton();
    if (!layoutReady) layout();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      mountProfileButton();
    });
  }

  styles();
  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    apply();
    if (layoutReady || attempts >= 50) clearInterval(timer);
  }, 100);
  ["bali:beta4-changed", "bali:points-changed"].forEach(name => window.addEventListener(name, schedule));
})();