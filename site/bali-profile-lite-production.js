(() => {
  if (window.__BALI_PROFILE_LITE_PRODUCTION__) return;
  window.__BALI_PROFILE_LITE_PRODUCTION__ = true;

  const game = window.BaliBeta4Game;
  const points = window.BaliPoints;
  const loyalty = window.BaliBeta4Loyalty;
  const social = window.BaliBeta4Social;
  const attendance = window.BaliEventQrAttendance;
  if (!game || !points) return;

  const byId = id => document.getElementById(id);
  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;"
  })[char]);
  const fmt = value => value ? new Date(value).toLocaleString("ru-RU", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" }) : "—";
  const initials = name => String(name || "B").trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
  const toast = message => {
    const node = byId("toast");
    if (!node) return;
    node.textContent = String(message || "");
    node.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove("show"), 2200);
  };

  let headerSignature = "";
  let quickSignature = "";
  let updateTimer = 0;

  function ensureStyle() {
    if (byId("baliProfileLiteStyle")) return;
    const style = document.createElement("style");
    style.id = "baliProfileLiteStyle";
    style.textContent = `
      .profile-lite-hidden{display:none!important}
      #profileStats{display:none!important}
      #profileHero{position:relative!important;padding-right:72px!important}
      .profile-lite-controls{position:absolute;right:12px;top:12px;bottom:12px;display:flex;flex-direction:column;justify-content:space-between;gap:8px}
      .profile-lite-controls button{width:43px;height:43px;display:grid;place-items:center;padding:0;border:1px solid var(--line);border-radius:50%;background:#101510e8;color:#fff;font-size:18px}
      #profileV2Quick{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important}
      .profile-lite-tile{display:grid;align-content:end;gap:6px;min-height:136px;padding:16px;border:1px solid var(--line);border-radius:21px;background:linear-gradient(145deg,#151a17,#0e110f);color:#fff;text-align:left}
      .profile-lite-tile small{color:var(--muted);font-size:8px;font-weight:900;letter-spacing:.12em}.profile-lite-tile strong{font:600 18px Unbounded;color:var(--lime)}.profile-lite-tile span{color:#c8ceca;font-size:9px;line-height:1.45}
      .profile-lite-tile.gifts{grid-column:1/-1}
      .profile-lite-dialog{width:min(600px,calc(100% - 14px));max-height:95dvh;padding:0;border:1px solid var(--line);border-radius:23px;background:#0b0e0d;color:#fff;overflow:hidden}
      .profile-lite-dialog::backdrop{background:#000d;backdrop-filter:blur(6px)}.profile-lite-sheet{max-height:95dvh;overflow:auto}
      .profile-lite-head{position:sticky;top:0;z-index:3;display:flex;justify-content:space-between;align-items:center;padding:15px 16px;border-bottom:1px solid var(--line);background:#0b0e0df2}.profile-lite-head h2{margin:3px 0 0;font-size:18px}
      .profile-lite-close{width:41px;height:41px;border:1px solid var(--line);border-radius:50%;background:#ffffff08;color:#fff;font-size:24px}.profile-lite-body{display:grid;gap:14px;padding:14px}
      .profile-lite-balance{padding:18px;border:1px solid #c8ff3d38;border-radius:18px;background:#c8ff3d0f;text-align:center}.profile-lite-balance strong{display:block;color:var(--lime);font:600 38px Unbounded}.profile-lite-list{display:grid;gap:8px}
      .profile-lite-row{display:grid;grid-template-columns:42px minmax(0,1fr) auto;gap:10px;align-items:center;padding:11px;border:1px solid var(--line);border-radius:14px;background:#ffffff06}.profile-lite-row i{width:42px;height:42px;display:grid;place-items:center;border-radius:12px;background:#ffffff08;font-style:normal}.profile-lite-row h3{margin:0;font-size:11px}.profile-lite-row p{margin:3px 0 0;color:var(--muted);font-size:8px;line-height:1.45}.profile-lite-row b{color:var(--lime);font-size:9px}.profile-lite-row.locked{opacity:.52}
      .profile-lite-form{display:grid;gap:10px}.profile-lite-form label{display:grid;gap:6px;color:var(--muted);font-size:9px;font-weight:800}.profile-lite-form input,.profile-lite-form select,.profile-lite-form textarea{width:100%;min-height:47px;padding:10px 12px;border:1px solid var(--line);border-radius:13px;background:#171b19;color:#fff}.profile-lite-form textarea{min-height:90px}.profile-lite-switch{display:flex!important;align-items:center;justify-content:space-between}.profile-lite-switch input{width:22px!important;min-height:22px!important}
      @media(max-width:400px){#profileV2Quick{gap:7px!important}.profile-lite-tile{min-height:124px;padding:13px}.profile-lite-tile strong{font-size:15px}}
    `;
    document.head.appendChild(style);
  }

  function ensureDialogs() {
    const definitions = [["Points","BALI Shop"],["Rewards","Мои награды"],["Gifts","Мои подарки"],["Settings","Настройки профиля"],["History","История посещений"]];
    for (const [name, title] of definitions) {
      if (byId(`profile${name}Dialog`)) continue;
      document.body.insertAdjacentHTML("beforeend", `<dialog class="profile-lite-dialog" id="profile${name}Dialog"><div class="profile-lite-sheet"><div class="profile-lite-head"><div><span class="eyebrow">МОЙ ПРОФИЛЬ</span><h2>${title}</h2></div><button class="profile-lite-close" type="button" data-profile-lite-close>×</button></div><div class="profile-lite-body" id="profile${name}Body"></div></div></dialog>`);
    }
  }

  function hideLegacy() {
    [document.querySelector(".wallet"), byId("achievements")?.closest(".card"), byId("activeVip")?.closest(".card"), byId("profileForm")?.closest(".card"), byId("pointsShopCard"), byId("customRewardsCard"), byId("socialProfileCard")]
      .filter(Boolean).forEach(node => { node.hidden = true; node.classList.add("profile-lite-hidden"); });
  }

  function rewards() {
    try { loyalty?.evaluateRewards?.(game.profile()); } catch {}
    const standard = (game.achievements?.() || []).map(row => ({ ...row, earned:Boolean(row.earnedAt) }));
    const custom = (loyalty?.rewards?.() || []).filter(row => row.active !== false);
    const earnedIds = loyalty?.earnedRewardIds?.(game.profile()) || new Set();
    return [...standard, ...custom.map(row => ({ ...row, earned:earnedIds.has(row.id) }))];
  }

  function gifts() {
    try { return social?.incomingGifts?.() || []; } catch { return []; }
  }

  function renderHeader() {
    const profile = game.profile?.() || {};
    const level = game.levelFor?.(profile.xp) || { current:{ name:"BALI Guest" }, next:null, progress:0 };
    const vip = game.vip?.() || null;
    const signature = JSON.stringify([profile.name, profile.username, profile.avatar, profile.xp, level.current?.name, level.next?.minXp, level.progress, vip?.plan?.name, vip?.expiresAt]);
    if (signature === headerSignature) return;
    headerSignature = signature;

    const hero = byId("profileHero");
    const xp = byId("xpCard");
    if (hero) {
      const avatar = profile.avatar ? `<img src="${esc(profile.avatar)}" alt="" style="width:100%;height:100%;object-fit:cover">` : esc(initials(profile.name));
      hero.innerHTML = `<div style="position:relative"><span class="avatar profile-avatar">${avatar}</span><button class="avatar-label" type="button" data-avatar-edit>Изменить фото</button></div><div><h2>${esc(profile.name || "Гость BALI")}</h2><p>${esc(profile.username || "Telegram не указан")}</p><div class="badges"><span>${esc(level.current?.name || "BALI Guest")}</span>${vip ? `<span class="vip">${esc(vip.plan?.name || "VIP")}</span>` : ""}</div></div>`;
    }
    if (xp) xp.innerHTML = `<div class="xp-head"><strong>${esc(level.current?.name || "BALI Guest")}</strong><span>${level.next ? `${Number(profile.xp || 0)} / ${Number(level.next.minXp || 0)} XP` : `${Number(profile.xp || 0)} XP · максимум`}</span></div><div class="progress"><i style="width:${Number(level.progress || 0)}%"></i></div>`;
  }

  function mount() {
    const hero = byId("profileHero");
    const xp = byId("xpCard");
    const quick = byId("profileV2Quick");
    if (!hero || !xp || !quick) return false;
    ensureStyle();
    ensureDialogs();
    hideLegacy();
    renderHeader();

    let controls = hero.querySelector(".profile-lite-controls");
    if (!controls) {
      controls = document.createElement("div");
      controls.className = "profile-lite-controls";
      controls.innerHTML = '<button type="button" data-open-profile-settings aria-label="Настройки">⚙</button><button type="button" data-open-profile-history aria-label="История">◷</button>';
      hero.appendChild(controls);
    }

    if (quick.previousElementSibling !== xp) xp.insertAdjacentElement("afterend", quick);
    const rewardRows = rewards();
    const giftRows = gifts();
    const balance = Number(points.profile?.().balance || 0);
    const signature = JSON.stringify([balance, rewardRows.length, rewardRows.filter(row => row.earned).length, giftRows.length]);
    if (signature !== quickSignature) {
      quickSignature = signature;
      quick.innerHTML = `<button class="profile-lite-tile shop" type="button" data-open-profile-points><small>МАГАЗИН</small><strong>BALI Shop</strong><span>${balance} баллов · VIP, фишки и покупки →</span></button><button class="profile-lite-tile rewards" type="button" data-open-profile-rewards><small>МОИ НАГРАДЫ</small><strong>Мои награды</strong><span>${rewardRows.filter(row => row.earned).length} из ${rewardRows.length} получено →</span></button><button class="profile-lite-tile gifts" type="button" data-open-profile-gifts><small>МОИ ПОДАРКИ</small><strong>Мои подарки</strong><span>${giftRows.length} подарков →</span></button>`;
    }
    return true;
  }

  function activateProfile() {
    document.querySelectorAll(".page").forEach(node => node.classList.toggle("active", node.dataset.screen === "profile"));
    document.querySelectorAll(".nav [data-page]").forEach(node => node.classList.toggle("active", node.dataset.page === "profile"));
    document.querySelector('[data-screen="profile"]')?.scrollTo?.(0, 0);
    mount();
  }

  function open(name) {
    const dialog = byId(`profile${name}Dialog`);
    if (!dialog || dialog.open) return;
    if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", "");
  }

  function renderShop() {
    const root = byId("profilePointsBody");
    if (!root) return;
    const balance = Number(points.profile?.().balance || 0);
    const chips = Number(loyalty?.chipBalance?.(game.profile()) || 0);
    root.innerHTML = `<div class="profile-lite-balance"><span>ВАШ БАЛАНС</span><strong>${balance}</strong><small>BALI-Баллов · ${chips} фишек</small></div><section><h3>VIP-статусы</h3><div id="profileVipBody"></div></section><section><h3>Обмен баллов на фишки</h3><p class="muted">Доступные варианты обмена отображаются в BALI Shop.</p></section>`;
    setTimeout(() => window.BaliVipVariants?.renderShop?.(), 0);
  }

  function renderRewards() {
    const root = byId("profileRewardsBody");
    if (!root) return;
    const rows = rewards();
    root.innerHTML = `<div class="profile-lite-list">${rows.map(row => `<article class="profile-lite-row ${row.earned ? "" : "locked"}"><i>${esc(row.icon || "🏆")}</i><div><h3>${esc(row.title || "Награда BALI")}</h3><p>${esc(row.description || "Продолжайте пользоваться BALI")}</p></div><b>${row.earned ? "Получено" : `+${Number(row.xp || 0)} XP`}</b></article>`).join("") || '<div class="empty">Награды скоро появятся</div>'}</div>`;
  }

  function renderGifts() {
    const root = byId("profileGiftsBody");
    if (!root) return;
    const rows = gifts();
    root.innerHTML = `<div class="profile-lite-list">${rows.map(row => `<article class="profile-lite-row"><i>${esc(row.icon || "🎁")}</i><div><h3>${esc(row.giftName || "Подарок BALI")}</h3><p>От: ${esc(row.fromName || "Пользователь BALI")} · ${fmt(row.createdAt)}</p></div><b>Получено</b></article>`).join("") || '<div class="empty">Вам пока не дарили подарки</div>'}</div>`;
  }

  function renderSettings() {
    const root = byId("profileSettingsBody");
    if (!root) return;
    const profile = game.profile?.() || {};
    const socialProfile = social?.profile?.() || {};
    const statuses = social?.STATUSES || [];
    root.innerHTML = `<form class="profile-lite-form" id="profileLiteSettingsForm"><label><span>Имя</span><input name="name" required value="${esc(profile.name || "")}"></label><label><span>Телефон</span><input name="phone" inputmode="tel" value="${esc(profile.phone || "")}"></label><label><span>Telegram username</span><input name="username" value="${esc(profile.username || "")}"></label><label class="profile-lite-switch"><span>Показывать меня в BALI PEOPLE</span><input name="socialActive" type="checkbox" checked></label><label><span>Статус в BALI PEOPLE</span><select name="socialStatus">${statuses.map(([id,title]) => `<option value="${esc(id)}" ${socialProfile.status === id ? "selected" : ""}>${esc(title)}</option>`).join("")}</select></label><label><span>О себе</span><textarea name="bio" maxlength="180">${esc(socialProfile.bio || "")}</textarea></label><button class="primary full" type="submit">Сохранить настройки</button></form>`;
  }

  async function renderHistory() {
    const root = byId("profileHistoryBody");
    if (!root) return;
    const profile = game.profile?.() || {};
    const keys = new Set(game.identityKeys?.(profile) || []);
    let rows = [];
    try { rows = attendance?.listOwnCheckins ? await attendance.listOwnCheckins() : attendance?.listCheckins ? await attendance.listCheckins() : []; } catch {}
    rows = (rows || []).filter(row => keys.has(String(row.user_key || "")) || String(row.telegram_id || "") === String(profile.telegramId || ""));
    root.innerHTML = `<div class="profile-lite-list">${rows.map(row => `<article class="profile-lite-row"><i>✓</i><div><h3>${esc(row.event_title || "Мероприятие BALI")}</h3><p>${fmt(row.checked_in_at)} · ${Number(row.reward || 0)} баллов</p></div><b>${esc(row.level || "")}</b></article>`).join("") || '<div class="empty">Подтверждённых посещений пока нет</div>'}</div>`;
  }

  function queueUpdate() {
    clearTimeout(updateTimer);
    updateTimer = setTimeout(() => {
      const profileActive = document.querySelector('[data-screen="profile"]')?.classList.contains("active");
      const dialogOpen = Boolean(document.querySelector(".profile-lite-dialog[open]"));
      if (profileActive || dialogOpen) {
        headerSignature = "";
        mount();
      }
    }, 120);
  }

  document.addEventListener("click", async event => {
    const profileButton = event.target.closest('[data-page="profile"]');
    if (profileButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      activateProfile();
      return;
    }
    if (event.target.closest("[data-open-profile-points]")) { renderShop(); open("Points"); }
    if (event.target.closest("[data-open-profile-rewards]")) { renderRewards(); open("Rewards"); }
    if (event.target.closest("[data-open-profile-gifts]")) { renderGifts(); open("Gifts"); }
    if (event.target.closest("[data-open-profile-settings]")) { renderSettings(); open("Settings"); }
    if (event.target.closest("[data-open-profile-history]")) { await renderHistory(); open("History"); }
    if (event.target.closest("[data-profile-lite-close]")) event.target.closest("dialog")?.close?.();
  }, true);

  document.addEventListener("submit", event => {
    if (event.target.id !== "profileLiteSettingsForm") return;
    event.preventDefault();
    const form = event.target;
    const data = Object.fromEntries(new FormData(form).entries());
    game.saveProfile?.({ name:String(data.name || "").trim(), phone:String(data.phone || "").trim(), username:String(data.username || "").trim() });
    social?.saveProfile?.({ name:String(data.name || "").trim(), active:true, status:data.socialStatus || "chat", bio:String(data.bio || "").trim(), photo:game.profile?.().avatar || social.profile?.().photo || "" });
    toast("Настройки сохранены");
    byId("profileSettingsDialog")?.close?.();
    headerSignature = "";
    quickSignature = "";
    mount();
  }, true);

  ["bali:app-mounted","bali:points-changed","bali:beta4-changed","bali:loyalty-changed","bali:social-changed"].forEach(name => window.addEventListener(name, queueUpdate));
  ensureStyle();
  ensureDialogs();
  setTimeout(mount, 0);

  window.BaliCompactProfile = { mount, activateProfile, renderShop, renderRewards, renderGifts, renderSettings, renderHistory };
})();