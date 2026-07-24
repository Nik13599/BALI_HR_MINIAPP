(() => {
  if (window.__BALI_PROFILE_STABLE_PRODUCTION__) return;
  window.__BALI_PROFILE_STABLE_PRODUCTION__ = true;

  const game = window.BaliBeta4Game;
  const points = window.BaliPoints;
  const loyalty = window.BaliBeta4Loyalty;
  const social = window.BaliBeta4Social;
  const attendance = window.BaliEventQrAttendance;
  if (!game || !points) return;

  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
  const fmt = value => value ? new Date(value).toLocaleString("ru-RU", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" }) : "—";
  let mounted = false;

  function toast(message) {
    const node = document.getElementById("toast");
    if (!node) return;
    node.textContent = message;
    node.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove("show"), 2200);
  }

  function ensureStyle() {
    if (document.getElementById("profileStableProductionStyle")) return;
    const style = document.createElement("style");
    style.id = "profileStableProductionStyle";
    style.textContent = `
      .profile-v2-hidden{display:none!important}
      #profileStats{display:none!important}
      #profileHero{position:relative!important;padding-right:72px!important}
      .profile-stable-controls{position:absolute;right:12px;top:12px;bottom:12px;display:flex;flex-direction:column;justify-content:space-between;gap:8px}
      .profile-stable-controls button{width:43px;height:43px;display:grid;place-items:center;padding:0;border:1px solid var(--line);border-radius:50%;background:#101510e8;color:#fff;font-size:18px}
      #profileV2Quick{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      #profileV2Quick .profile-v2-tile{position:relative;display:grid;align-content:end;gap:6px;min-height:140px;padding:16px;border:1px solid var(--line);border-radius:21px;background:linear-gradient(145deg,#151a17,#0e110f);color:#fff;text-align:left;overflow:hidden}
      #profileV2Quick .profile-v2-tile small{color:var(--muted);font-size:8px;font-weight:900;letter-spacing:.12em}
      #profileV2Quick .profile-v2-tile strong{font:600 17px Unbounded;color:var(--lime)}
      #profileV2Quick .profile-v2-tile span{color:#c8ceca;font-size:9px;line-height:1.45}
      #profileV2Quick .profile-v2-tile.gifts{grid-column:1/-1}
      .profile-stable-dialog{width:min(600px,calc(100% - 14px));max-height:95dvh;padding:0;border:1px solid var(--line);border-radius:23px;background:#0b0e0d;color:#fff;overflow:hidden}
      .profile-stable-dialog::backdrop{background:#000d;backdrop-filter:blur(6px)}
      .profile-stable-sheet{max-height:95dvh;overflow:auto}.profile-stable-head{position:sticky;top:0;z-index:3;display:flex;justify-content:space-between;align-items:center;padding:15px 16px;border-bottom:1px solid var(--line);background:#0b0e0df2}
      .profile-stable-head h2{margin:3px 0 0;font-size:18px}.profile-stable-close{width:41px;height:41px;border:1px solid var(--line);border-radius:50%;background:#ffffff08;color:#fff;font-size:24px}
      .profile-stable-body{display:grid;gap:14px;padding:14px}.profile-stable-section{display:grid;gap:9px}.profile-stable-section>h3{font-size:14px}
      .profile-stable-balance{padding:18px;border:1px solid #c8ff3d38;border-radius:18px;background:#c8ff3d0f;text-align:center}.profile-stable-balance strong{display:block;color:var(--lime);font:600 38px Unbounded}.profile-stable-balance small{color:var(--muted)}
      .profile-stable-list{display:grid;gap:8px}.profile-stable-row{display:grid;grid-template-columns:42px minmax(0,1fr) auto;gap:10px;align-items:center;padding:11px;border:1px solid var(--line);border-radius:14px;background:#ffffff06}.profile-stable-row i{width:42px;height:42px;display:grid;place-items:center;border-radius:12px;background:#ffffff08;font-style:normal}.profile-stable-row h3{margin:0;font-size:11px}.profile-stable-row p{margin:3px 0 0;color:var(--muted);font-size:8px;line-height:1.45}.profile-stable-row b{color:var(--lime);font-size:9px;text-align:right}.profile-stable-row.locked{opacity:.52}
      .profile-stable-form{display:grid;gap:10px}.profile-stable-form label{display:grid;gap:6px;color:var(--muted);font-size:9px;font-weight:800}.profile-stable-form input,.profile-stable-form select,.profile-stable-form textarea{width:100%;min-height:47px;padding:10px 12px;border:1px solid var(--line);border-radius:13px;background:#171b19;color:#fff}.profile-stable-form textarea{min-height:90px}.profile-stable-switch{display:flex!important;align-items:center;justify-content:space-between}.profile-stable-switch input{width:22px!important;min-height:22px!important}
      @media(max-width:400px){#profileV2Quick{gap:7px}#profileV2Quick .profile-v2-tile{min-height:126px;padding:13px}#profileV2Quick .profile-v2-tile strong{font-size:15px}}
    `;
    document.head.appendChild(style);
  }

  function ensureDialogs() {
    if (document.getElementById("profilePointsDialog")) return;
    const rows = [
      ["Points", "BALI Shop"],
      ["Rewards", "Мои награды"],
      ["Gifts", "Мои подарки"],
      ["Settings", "Настройки профиля"],
      ["History", "История посещений"]
    ];
    document.body.insertAdjacentHTML("beforeend", rows.map(([name, title]) => `
      <dialog class="profile-stable-dialog" id="profile${name}Dialog">
        <div class="profile-stable-sheet">
          <div class="profile-stable-head"><div><span class="eyebrow">МОЙ ПРОФИЛЬ</span><h2 id="profile${name}Title">${title}</h2></div><button class="profile-stable-close" type="button" data-profile-stable-close>×</button></div>
          <div class="profile-stable-body" id="profile${name}Body"></div>
        </div>
      </dialog>`).join(""));
  }

  function hideLegacy() {
    [
      document.querySelector(".wallet"),
      document.getElementById("achievements")?.closest(".card"),
      document.getElementById("activeVip")?.closest(".card"),
      document.getElementById("profileForm")?.closest(".card"),
      document.getElementById("pointsShopCard"),
      document.getElementById("customRewardsCard"),
      document.getElementById("socialProfileCard")
    ].filter(Boolean).forEach(node => { node.hidden = true; node.classList.add("profile-v2-hidden"); });
  }

  function rewardRows() {
    loyalty?.evaluateRewards?.(game.profile());
    const standard = (game.achievements?.() || []).map(row => ({ ...row, earned:Boolean(row.earnedAt) }));
    const custom = loyalty?.rewards?.().filter(row => row.active !== false) || [];
    const earned = loyalty?.earnedRewardIds?.(game.profile()) || new Set();
    return [...standard, ...custom.map(row => ({ ...row, earned:earned.has(row.id) }))];
  }

  function giftRows() { return social?.incomingGifts?.() || []; }

  function mount() {
    const hero = document.getElementById("profileHero");
    const xp = document.getElementById("xpCard");
    const stats = document.getElementById("profileStats");
    if (!hero || !xp || !stats) return false;

    ensureStyle();
    ensureDialogs();
    hideLegacy();
    stats.hidden = true;

    let controls = hero.querySelector(".profile-stable-controls");
    if (!controls) {
      controls = document.createElement("div");
      controls.className = "profile-stable-controls";
      controls.innerHTML = '<button type="button" data-open-profile-settings aria-label="Настройки профиля">⚙</button><button type="button" data-open-profile-history aria-label="История посещений">◷</button>';
      hero.appendChild(controls);
    }

    let quick = document.getElementById("profileV2Quick");
    if (!quick) {
      quick = document.createElement("section");
      quick.id = "profileV2Quick";
      quick.className = "profile-v2-quick";
    }
    if (quick.previousElementSibling !== xp) xp.insertAdjacentElement("afterend", quick);

    const rewards = rewardRows();
    const earned = rewards.filter(row => row.earned).length;
    const gifts = giftRows();
    const balance = Number(points.profile?.().balance || 0);
    quick.innerHTML = `
      <button class="profile-v2-tile shop" type="button" data-open-profile-points><small>МАГАЗИН</small><strong>BALI Shop</strong><span>${balance} баллов · VIP, фишки и покупки →</span></button>
      <button class="profile-v2-tile rewards" type="button" data-open-profile-rewards><small>МОИ НАГРАДЫ</small><strong>Мои награды</strong><span>${earned} из ${rewards.length} получено →</span></button>
      <button class="profile-v2-tile gifts" type="button" data-open-profile-gifts><small>МОИ ПОДАРКИ</small><strong>Мои подарки</strong><span>${gifts.length} подарков от пользователей →</span></button>`;
    mounted = true;
    return true;
  }

  function open(name) {
    const dialog = document.getElementById(`profile${name}Dialog`);
    if (!dialog || dialog.open) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function renderShop() {
    const root = document.getElementById("profilePointsBody");
    if (!root) return;
    const balance = Number(points.profile?.().balance || 0);
    const chips = Number(loyalty?.chipBalance?.(game.profile()) || 0);
    root.innerHTML = `<div class="profile-stable-balance"><span>ВАШ БАЛАНС</span><strong>${balance}</strong><small>BALI-Баллов · ${chips} фишек</small></div><section class="profile-stable-section"><h3>VIP-статусы</h3><div id="profileVipBody"></div></section><section class="profile-stable-section"><h3>Обмен баллов на фишки</h3><p class="muted">Выберите вариант обмена в BALI Shop.</p></section>`;
    setTimeout(() => window.BaliVipVariants?.renderShop?.(), 0);
  }

  function renderRewards() {
    const root = document.getElementById("profileRewardsBody");
    if (!root) return;
    const rows = rewardRows();
    root.innerHTML = `<section class="profile-stable-section"><h3>Награды BALI</h3><div class="profile-stable-list">${rows.map(row => `<article class="profile-stable-row ${row.earned ? "" : "locked"}"><i>${row.image ? `<img src="${esc(row.image)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:10px">` : esc(row.icon || "🏆")}</i><div><h3>${esc(row.title || "Награда BALI")}</h3><p>${esc(row.description || "Продолжайте пользоваться приложением BALI")}</p></div><b>${row.earned ? "Получено" : `+${Number(row.xp || 0)} XP`}</b></article>`).join("") || '<div class="empty">Награды скоро появятся</div>'}</div></section>`;
  }

  function renderGifts() {
    const root = document.getElementById("profileGiftsBody");
    if (!root) return;
    const rows = giftRows();
    root.innerHTML = `<div class="profile-stable-list">${rows.map(row => `<article class="profile-stable-row"><i>${esc(row.icon || "🎁")}</i><div><h3>${esc(row.giftName || "Подарок BALI")}</h3><p>От: ${esc(row.fromName || "Пользователь BALI")} · ${fmt(row.createdAt)}</p></div><b>Получено</b></article>`).join("") || '<div class="empty">Вам пока не дарили подарки</div>'}</div>`;
  }

  function renderSettings() {
    const root = document.getElementById("profileSettingsBody");
    if (!root) return;
    const profile = game.profile();
    const socialProfile = social?.profile?.() || {};
    const statuses = social?.STATUSES || [];
    root.innerHTML = `<form class="profile-stable-form" id="profileStableSettingsForm"><label><span>Имя</span><input name="name" required value="${esc(profile.name || "")}"></label><label><span>Телефон</span><input name="phone" inputmode="tel" value="${esc(profile.phone || "")}"></label><label><span>Telegram username</span><input name="username" value="${esc(profile.username || "")}"></label><label class="profile-stable-switch"><span>Показывать меня в рейтинге</span><input name="publicRanking" type="checkbox" ${profile.publicRanking !== false ? "checked" : ""}></label><label class="profile-stable-switch"><span>Показывать меня в BALI PEOPLE</span><input name="socialActive" type="checkbox" ${socialProfile.active !== false ? "checked" : ""}></label><label><span>Статус в BALI PEOPLE</span><select name="socialStatus">${statuses.map(([id,title]) => `<option value="${esc(id)}" ${socialProfile.status === id ? "selected" : ""}>${esc(title)}</option>`).join("")}</select></label><label><span>О себе</span><textarea name="bio" maxlength="180">${esc(socialProfile.bio || "")}</textarea></label><button class="primary full" type="submit">Сохранить настройки</button></form>`;
  }

  async function renderHistory() {
    const root = document.getElementById("profileHistoryBody");
    if (!root) return;
    const profile = game.profile();
    const keys = new Set(game.identityKeys?.(profile) || []);
    let rows = [];
    try { rows = attendance?.listCheckins ? await attendance.listCheckins() : []; } catch {}
    rows = (rows || []).filter(row => keys.has(String(row.user_key || "")) || String(row.telegram_id || "") === String(profile.telegramId || ""));
    root.innerHTML = `<div class="profile-stable-list">${rows.map(row => `<article class="profile-stable-row"><i>✓</i><div><h3>${esc(row.event_title || "Мероприятие BALI")}</h3><p>${fmt(row.checked_in_at)} · ${Number(row.reward || 0)} баллов · ${Number(row.xp || 0)} XP</p></div><b>${esc(row.level || "")}</b></article>`).join("") || '<div class="empty">Подтверждённых посещений пока нет</div>'}</div>`;
  }

  document.addEventListener("click", async event => {
    if (event.target.closest('[data-page="profile"]')) setTimeout(mount, 0);
    if (event.target.closest("[data-open-profile-points]")) { renderShop(); open("Points"); }
    if (event.target.closest("[data-open-profile-rewards]")) { renderRewards(); open("Rewards"); }
    if (event.target.closest("[data-open-profile-gifts]")) { renderGifts(); open("Gifts"); }
    if (event.target.closest("[data-open-profile-settings]")) { renderSettings(); open("Settings"); }
    if (event.target.closest("[data-open-profile-history]")) { await renderHistory(); open("History"); }
    if (event.target.closest("[data-profile-stable-close]")) event.target.closest("dialog")?.close();
  }, true);

  document.addEventListener("submit", event => {
    if (event.target.id !== "profileStableSettingsForm") return;
    event.preventDefault();
    const form = event.target;
    const data = Object.fromEntries(new FormData(form).entries());
    game.saveProfile({ name:String(data.name || "").trim(), phone:String(data.phone || "").trim(), username:String(data.username || "").trim(), publicRanking:form.publicRanking.checked });
    social?.saveProfile?.({ name:String(data.name || "").trim(), active:form.socialActive.checked, status:form.socialActive.checked ? data.socialStatus : "closed", bio:String(data.bio || "").trim(), photo:game.profile().avatar || social.profile?.().photo || "" });
    toast("Настройки сохранены");
    document.getElementById("profileSettingsDialog")?.close();
    mount();
  }, true);

  ["bali:points-changed","bali:beta4-changed","bali:loyalty-changed","bali:social-changed","bali:data-changed"]
    .forEach(name => window.addEventListener(name, () => requestAnimationFrame(mount)));

  [0, 100, 300, 800, 1600].forEach(delay => setTimeout(mount, delay));
  window.BaliCompactProfile = { mount, renderShop, renderRewards, renderGifts, renderSettings, renderHistory, isMounted:() => mounted };
})();