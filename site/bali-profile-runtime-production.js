(() => {
  if (window.__BALI_PROFILE_RUNTIME_PRODUCTION_V2__) return;
  window.__BALI_PROFILE_RUNTIME_PRODUCTION_V2__ = true;

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
  const fmt = value => value ? new Date(value).toLocaleString("ru-RU", {
    day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit"
  }) : "—";

  function capture(error, context) {
    try { window.BaliErrorBoundary?.capture?.(error, { context }); } catch {}
    console.error(`[BALI profile ${context}]`, error);
  }

  function toast(message) {
    const node = byId("toast");
    if (!node) return;
    node.textContent = String(message || "");
    node.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove("show"), 2200);
  }

  function ensureStyle() {
    if (byId("baliProfileRuntimeStyle")) return;
    const style = document.createElement("style");
    style.id = "baliProfileRuntimeStyle";
    style.textContent = `
      .profile-v2-hidden{display:none!important}
      #profileStats{display:none!important}
      #profileHero{position:relative!important;padding-right:72px!important}
      .profile-stable-controls{position:absolute;right:12px;top:12px;bottom:12px;display:flex;flex-direction:column;justify-content:space-between;gap:8px}
      .profile-stable-controls button{width:43px;height:43px;display:grid;place-items:center;padding:0;border:1px solid var(--line);border-radius:50%;background:#101510e8;color:#fff;font-size:18px}
      #profileV2Quick{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important}
      .profile-v2-tile{position:relative;display:grid;align-content:end;gap:6px;min-height:140px;padding:16px;border:1px solid var(--line);border-radius:21px;background:linear-gradient(145deg,#151a17,#0e110f);color:#fff;text-align:left;overflow:hidden}
      .profile-v2-tile small{color:var(--muted);font-size:8px;font-weight:900;letter-spacing:.12em}
      .profile-v2-tile strong{font:600 18px Unbounded;color:var(--lime)}
      .profile-v2-tile span{color:#c8ceca;font-size:9px;line-height:1.45}
      .profile-v2-tile.gifts{grid-column:1/-1!important}
      .profile-runtime-dialog{width:min(600px,calc(100% - 14px));max-height:95dvh;padding:0;border:1px solid var(--line);border-radius:23px;background:#0b0e0d;color:#fff;overflow:hidden}
      .profile-runtime-dialog::backdrop{background:#000d;backdrop-filter:blur(6px)}
      .profile-runtime-sheet{max-height:95dvh;overflow:auto}
      .profile-runtime-head{position:sticky;top:0;z-index:3;display:flex;justify-content:space-between;align-items:center;padding:15px 16px;border-bottom:1px solid var(--line);background:#0b0e0df2}
      .profile-runtime-head h2{margin:3px 0 0;font-size:18px}
      .profile-runtime-close{width:41px;height:41px;border:1px solid var(--line);border-radius:50%;background:#ffffff08;color:#fff;font-size:24px}
      .profile-runtime-body{display:grid;gap:14px;padding:14px}
      .profile-runtime-section{display:grid;gap:9px}.profile-runtime-section>h3{font-size:14px}
      .profile-runtime-balance{padding:18px;border:1px solid #c8ff3d38;border-radius:18px;background:#c8ff3d0f;text-align:center}
      .profile-runtime-balance strong{display:block;color:var(--lime);font:600 38px Unbounded}.profile-runtime-balance small{color:var(--muted)}
      .profile-runtime-list{display:grid;gap:8px}
      .profile-runtime-row{display:grid;grid-template-columns:42px minmax(0,1fr) auto;gap:10px;align-items:center;padding:11px;border:1px solid var(--line);border-radius:14px;background:#ffffff06}
      .profile-runtime-row i{width:42px;height:42px;display:grid;place-items:center;overflow:hidden;border-radius:12px;background:#ffffff08;font-style:normal}
      .profile-runtime-row h3{margin:0;font-size:11px}.profile-runtime-row p{margin:3px 0 0;color:var(--muted);font-size:8px;line-height:1.45}.profile-runtime-row b{color:var(--lime);font-size:9px;text-align:right}.profile-runtime-row.locked{opacity:.52}
      .profile-runtime-form{display:grid;gap:10px}.profile-runtime-form label{display:grid;gap:6px;color:var(--muted);font-size:9px;font-weight:800}
      .profile-runtime-form input,.profile-runtime-form select,.profile-runtime-form textarea{width:100%;min-height:47px;padding:10px 12px;border:1px solid var(--line);border-radius:13px;background:#171b19;color:#fff}
      .profile-runtime-form textarea{min-height:90px}.profile-runtime-switch{display:flex!important;align-items:center;justify-content:space-between}.profile-runtime-switch input{width:22px!important;min-height:22px!important}
      @media(max-width:400px){#profileV2Quick{gap:7px!important}.profile-v2-tile{min-height:128px;padding:13px}.profile-v2-tile strong{font-size:15px}.profile-runtime-row{grid-template-columns:38px minmax(0,1fr) auto}.profile-runtime-row i{width:38px;height:38px}}
    `;
    document.head.appendChild(style);
  }

  function ensureDialogs() {
    const definitions = [
      ["Points", "BALI Shop"],
      ["Rewards", "Мои награды"],
      ["Gifts", "Мои подарки"],
      ["Settings", "Настройки профиля"],
      ["History", "История посещений"]
    ];
    for (const [name, title] of definitions) {
      if (byId(`profile${name}Dialog`)) continue;
      document.body.insertAdjacentHTML("beforeend", `
        <dialog class="profile-runtime-dialog" id="profile${name}Dialog">
          <div class="profile-runtime-sheet">
            <div class="profile-runtime-head">
              <div><span class="eyebrow">МОЙ ПРОФИЛЬ</span><h2 id="profile${name}Title">${title}</h2></div>
              <button class="profile-runtime-close" type="button" data-profile-runtime-close>×</button>
            </div>
            <div class="profile-runtime-body" id="profile${name}Body"></div>
          </div>
        </dialog>`);
    }
  }

  function hideLegacy() {
    [
      document.querySelector(".wallet"),
      byId("achievements")?.closest(".card"),
      byId("activeVip")?.closest(".card"),
      byId("profileForm")?.closest(".card"),
      byId("pointsShopCard"),
      byId("customRewardsCard"),
      byId("socialProfileCard")
    ].filter(Boolean).forEach(node => {
      node.hidden = true;
      node.classList.add("profile-v2-hidden");
    });
  }

  function rewardRows() {
    try { loyalty?.evaluateRewards?.(game.profile()); } catch (error) { capture(error, "evaluate-rewards"); }
    const standard = (game.achievements?.() || []).map(row => ({ ...row, earned:Boolean(row.earnedAt) }));
    const custom = (loyalty?.rewards?.() || []).filter(row => row.active !== false);
    const earned = loyalty?.earnedRewardIds?.(game.profile()) || new Set();
    return [...standard, ...custom.map(row => ({ ...row, earned:earned.has(row.id) }))];
  }

  function giftRows() {
    try { return social?.incomingGifts?.() || []; }
    catch (error) { capture(error, "gifts"); return []; }
  }

  function desiredQuickHtml() {
    const rewards = rewardRows();
    const earned = rewards.filter(row => row.earned).length;
    const gifts = giftRows();
    const balance = Number(points.profile?.().balance || 0);
    return `
      <button class="profile-v2-tile shop" type="button" data-open-profile-points>
        <small>МАГАЗИН</small><strong>BALI Shop</strong><span>${balance} баллов · VIP, фишки и покупки →</span>
      </button>
      <button class="profile-v2-tile rewards" type="button" data-open-profile-rewards>
        <small>МОИ НАГРАДЫ</small><strong>Мои награды</strong><span>${earned} из ${rewards.length} получено →</span>
      </button>
      <button class="profile-v2-tile gifts" type="button" data-open-profile-gifts>
        <small>МОИ ПОДАРКИ</small><strong>Мои подарки</strong><span>${gifts.length} подарков →</span>
      </button>`;
  }

  function mount() {
    const hero = byId("profileHero");
    const xp = byId("xpCard");
    const quick = byId("profileV2Quick");
    if (!hero || !xp || !quick) return false;

    ensureStyle();
    ensureDialogs();
    hideLegacy();

    let controls = hero.querySelector(".profile-stable-controls");
    if (!controls) {
      controls = document.createElement("div");
      controls.className = "profile-stable-controls";
      controls.innerHTML = '<button type="button" data-open-profile-settings aria-label="Настройки профиля">⚙</button><button type="button" data-open-profile-history aria-label="История посещений">◷</button>';
      hero.appendChild(controls);
    }

    if (quick.previousElementSibling !== xp) xp.insertAdjacentElement("afterend", quick);
    const html = desiredQuickHtml().trim();
    if (quick.innerHTML.trim() !== html) quick.innerHTML = html;
    return true;
  }

  function open(name) {
    const dialog = byId(`profile${name}Dialog`);
    if (!dialog || dialog.open) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function renderShop() {
    const root = byId("profilePointsBody");
    if (!root) return;
    const balance = Number(points.profile?.().balance || 0);
    const chips = Number(loyalty?.chipBalance?.(game.profile()) || 0);
    root.innerHTML = `
      <div class="profile-runtime-balance"><span>ВАШ БАЛАНС</span><strong>${balance}</strong><small>BALI-Баллов · ${chips} фишек</small></div>
      <section class="profile-runtime-section"><h3>VIP-статусы</h3><div id="profileVipBody"></div></section>
      <section class="profile-runtime-section"><h3>Обмен баллов на фишки</h3><p class="muted">Выберите доступный вариант обмена в BALI Shop.</p></section>`;
    setTimeout(() => window.BaliVipVariants?.renderShop?.(), 0);
  }

  function renderRewards() {
    const root = byId("profileRewardsBody");
    if (!root) return;
    const rows = rewardRows();
    root.innerHTML = `<section class="profile-runtime-section"><h3>Награды BALI</h3><div class="profile-runtime-list">${
      rows.map(row => `<article class="profile-runtime-row ${row.earned ? "" : "locked"}"><i>${row.image ? `<img src="${esc(row.image)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:10px">` : esc(row.icon || "🏆")}</i><div><h3>${esc(row.title || "Награда BALI")}</h3><p>${esc(row.description || "Продолжайте пользоваться приложением BALI")}</p></div><b>${row.earned ? "Получено" : `+${Number(row.xp || 0)} XP`}</b></article>`).join("") || '<div class="empty">Награды скоро появятся</div>'
    }</div></section>`;
  }

  function renderGifts() {
    const root = byId("profileGiftsBody");
    if (!root) return;
    const rows = giftRows();
    root.innerHTML = `<div class="profile-runtime-list">${
      rows.map(row => `<article class="profile-runtime-row"><i>${esc(row.icon || "🎁")}</i><div><h3>${esc(row.giftName || "Подарок BALI")}</h3><p>От: ${esc(row.fromName || "Пользователь BALI")} · ${fmt(row.createdAt)}</p></div><b>Получено</b></article>`).join("") || '<div class="empty">Вам пока не дарили подарки</div>'
    }</div>`;
  }

  function renderSettings() {
    const root = byId("profileSettingsBody");
    if (!root) return;
    const profile = game.profile();
    const socialProfile = social?.profile?.() || {};
    const statuses = social?.STATUSES || [];
    root.innerHTML = `
      <form class="profile-runtime-form" id="profileRuntimeSettingsForm">
        <label><span>Имя</span><input name="name" required value="${esc(profile.name || "")}"></label>
        <label><span>Телефон</span><input name="phone" inputmode="tel" value="${esc(profile.phone || "")}"></label>
        <label><span>Telegram username</span><input name="username" value="${esc(profile.username || "")}"></label>
        <label class="profile-runtime-switch"><span>Показывать меня в рейтинге</span><input name="publicRanking" type="checkbox" ${profile.publicRanking !== false ? "checked" : ""}></label>
        <label class="profile-runtime-switch"><span>Показывать меня в BALI PEOPLE</span><input name="socialActive" type="checkbox" ${socialProfile.active !== false ? "checked" : ""}></label>
        <label><span>Статус в BALI PEOPLE</span><select name="socialStatus">${statuses.map(([id, title]) => `<option value="${esc(id)}" ${socialProfile.status === id ? "selected" : ""}>${esc(title)}</option>`).join("")}</select></label>
        <label><span>О себе</span><textarea name="bio" maxlength="180">${esc(socialProfile.bio || "")}</textarea></label>
        <button class="primary full" type="submit">Сохранить настройки</button>
      </form>`;
  }

  async function renderHistory() {
    const root = byId("profileHistoryBody");
    if (!root) return;
    const profile = game.profile();
    const keys = new Set(game.identityKeys?.(profile) || []);
    let rows = [];
    try { rows = attendance?.listCheckins ? await attendance.listCheckins() : []; }
    catch (error) { capture(error, "history"); }
    rows = (rows || []).filter(row =>
      keys.has(String(row.user_key || "")) ||
      String(row.telegram_id || "") === String(profile.telegramId || "")
    );
    root.innerHTML = `<div class="profile-runtime-list">${
      rows.map(row => `<article class="profile-runtime-row"><i>✓</i><div><h3>${esc(row.event_title || "Мероприятие BALI")}</h3><p>${fmt(row.checked_in_at)} · ${Number(row.reward || 0)} баллов · ${Number(row.xp || 0)} XP</p></div><b>${esc(row.level || "")}</b></article>`).join("") || '<div class="empty">Подтверждённых посещений пока нет</div>'
    }</div>`;
  }

  document.addEventListener("click", async event => {
    if (event.target.closest("[data-open-profile-points]")) { renderShop(); open("Points"); }
    if (event.target.closest("[data-open-profile-rewards]")) { renderRewards(); open("Rewards"); }
    if (event.target.closest("[data-open-profile-gifts]")) { renderGifts(); open("Gifts"); }
    if (event.target.closest("[data-open-profile-settings]")) { renderSettings(); open("Settings"); }
    if (event.target.closest("[data-open-profile-history]")) { await renderHistory(); open("History"); }
    if (event.target.closest("[data-profile-runtime-close]")) event.target.closest("dialog")?.close();
  }, true);

  document.addEventListener("submit", event => {
    if (event.target.id !== "profileRuntimeSettingsForm") return;
    event.preventDefault();
    const form = event.target;
    const data = Object.fromEntries(new FormData(form).entries());
    game.saveProfile({
      name:String(data.name || "").trim(),
      phone:String(data.phone || "").trim(),
      username:String(data.username || "").trim(),
      publicRanking:Boolean(form.elements.publicRanking?.checked)
    });
    social?.saveProfile?.({
      name:String(data.name || "").trim(),
      active:Boolean(form.elements.socialActive?.checked),
      status:form.elements.socialActive?.checked ? data.socialStatus : "closed",
      bio:String(data.bio || "").trim(),
      photo:game.profile().avatar || social?.profile?.().photo || ""
    });
    toast("Настройки сохранены");
    byId("profileSettingsDialog")?.close?.();
    window.BaliAppStable?.renderProfile?.();
    mount();
  }, true);

  let queued = false;
  function queueMount() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      try { mount(); } catch (error) { capture(error, "mount"); }
    });
  }

  ["bali:app-mounted", "bali:points-changed", "bali:beta4-changed", "bali:loyalty-changed", "bali:social-changed", "bali:data-changed"]
    .forEach(name => window.addEventListener(name, queueMount));

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", queueMount, { once:true });
  else queueMount();

  window.BaliCompactProfile = { mount, renderShop, renderRewards, renderGifts, renderSettings, renderHistory };
})();