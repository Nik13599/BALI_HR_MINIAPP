(() => {
  if (window.__BALI_PROFILE_V2__) return;
  window.__BALI_PROFILE_V2__ = true;

  const game = window.BaliBeta4Game;
  const points = window.BaliPoints;
  const loyalty = window.BaliBeta4Loyalty;
  const social = window.BaliBeta4Social;
  const attendance = window.BaliEventQrAttendance;
  if (!game || !points) return;

  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);
  const fmt = value => value ? new Date(value).toLocaleString("ru-RU", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
  }) : "—";
  const fmtEvent = row => {
    const date = row.eventDate ? new Date(`${row.eventDate}T12:00:00`).toLocaleDateString("ru-RU", { day:"2-digit", month:"long", year:"numeric" }) : "Дата не указана";
    return `${date}${row.eventTime ? ` · ${row.eventTime}` : ""}`;
  };
  const toast = message => {
    const node = document.getElementById("toast");
    if (!node) return;
    node.textContent = message;
    node.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove("show"), 2300);
  };

  function styles() {
    if (document.getElementById("profileV2Style")) return;
    const style = document.createElement("style");
    style.id = "profileV2Style";
    style.textContent = `
      .profile-v2-hidden{display:none!important}
      #profileStats{display:none!important}
      #profileHero{position:relative!important;padding-right:72px!important}
      .profile-v2-controls{position:absolute;right:12px;top:12px;bottom:12px;display:flex;flex-direction:column;justify-content:space-between;align-items:center;gap:8px}
      .profile-v2-controls button{width:43px;height:43px;display:grid;place-items:center;padding:0;border:1px solid var(--line);border-radius:50%;background:#101510e8;color:#fff;font-size:18px;box-shadow:0 8px 22px #0006}
      .profile-v2-controls button[data-open-profile-history]{border-color:rgba(200,255,61,.32);color:var(--lime)}
      .profile-v2-quick{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .profile-v2-tile{position:relative;display:grid;align-content:end;gap:6px;min-height:140px;padding:16px;border:1px solid var(--line);border-radius:21px;background:linear-gradient(145deg,#151a17,#0e110f);color:#fff;text-align:left;overflow:hidden}
      .profile-v2-tile:after{position:absolute;right:12px;top:8px;color:#ffffff0d;font:700 66px Unbounded}
      .profile-v2-tile.shop:after{content:"B"}.profile-v2-tile.rewards:after{content:"★"}.profile-v2-tile.invites:after{content:"✉"}.profile-v2-tile.gifts:after{content:"🎁";font-size:48px}
      .profile-v2-tile small{position:relative;z-index:1;color:var(--muted);font-size:8px;font-weight:900;letter-spacing:.12em}
      .profile-v2-tile strong{position:relative;z-index:1;font:600 19px Unbounded;color:var(--lime)}
      .profile-v2-tile span{position:relative;z-index:1;color:#c8ceca;font-size:9px;line-height:1.45}
      .profile-v2-dialog{width:min(600px,calc(100% - 14px));max-height:95dvh;padding:0;border:1px solid var(--line);border-radius:23px;background:#0b0e0d;color:#fff;overflow:hidden}
      .profile-v2-dialog::backdrop{background:#000d;backdrop-filter:blur(6px)}
      .profile-v2-sheet{max-height:95dvh;overflow:auto}
      .profile-v2-head{position:sticky;top:0;z-index:3;display:flex;justify-content:space-between;align-items:center;padding:15px 16px;border-bottom:1px solid var(--line);background:#0b0e0df2}
      .profile-v2-head h2{margin:3px 0 0;font-size:18px}
      .profile-v2-close{width:41px;height:41px;border:1px solid var(--line);border-radius:50%;background:#ffffff08;color:#fff;font-size:24px}
      .profile-v2-body{display:grid;gap:14px;padding:14px}
      .profile-v2-section{display:grid;gap:9px}.profile-v2-section>h3{font-size:14px}
      .profile-v2-balance{padding:18px;border:1px solid #c8ff3d38;border-radius:18px;background:#c8ff3d0f;text-align:center}
      .profile-v2-balance strong{display:block;color:var(--lime);font:600 38px Unbounded}.profile-v2-balance small{color:var(--muted)}
      .profile-v2-list{display:grid;gap:8px}
      .profile-v2-row{display:grid;grid-template-columns:42px minmax(0,1fr) auto;gap:10px;align-items:center;padding:11px;border:1px solid var(--line);border-radius:14px;background:#ffffff06}
      .profile-v2-row i{width:42px;height:42px;display:grid;place-items:center;overflow:hidden;border-radius:12px;background:#ffffff08;font-style:normal}.profile-v2-row i img{width:100%;height:100%;object-fit:contain}
      .profile-v2-row h3{margin:0;font-size:11px}.profile-v2-row p{margin:3px 0 0;color:var(--muted);font-size:8px;line-height:1.45}.profile-v2-row b{color:var(--lime);font-size:9px;text-align:right}.profile-v2-row.locked{opacity:.52}
      .profile-v2-form{display:grid;gap:10px}.profile-v2-form label{display:grid;gap:6px;color:var(--muted);font-size:9px;font-weight:800}
      .profile-v2-form input,.profile-v2-form select,.profile-v2-form textarea{width:100%;min-height:47px;padding:10px 12px;border:1px solid var(--line);border-radius:13px;background:#171b19;color:#fff}
      .profile-v2-form textarea{min-height:90px}.profile-v2-switch{display:flex!important;align-items:center;justify-content:space-between}.profile-v2-switch input{width:22px!important;min-height:22px!important}
      .profile-v2-avatar{display:flex;align-items:center;gap:12px;padding:10px;border:1px solid var(--line);border-radius:14px}.profile-v2-avatar img,.profile-v2-avatar .avatar{width:68px;height:68px;object-fit:cover;border-radius:50%}
      .profile-v2-shop-note{padding:11px;border:1px solid var(--line);border-radius:14px;background:#ffffff05;color:var(--muted);font-size:9px;line-height:1.55}
      .profile-invite-card{display:grid;gap:10px;padding:13px;border:1px solid var(--line);border-radius:17px;background:#ffffff05}
      .profile-invite-card header{display:flex;justify-content:space-between;align-items:start;gap:10px}.profile-invite-card h3{font-size:13px}.profile-invite-card header span{padding:5px 7px;border-radius:999px;background:#ffffff08;color:var(--muted);font-size:8px;font-weight:900}
      .profile-invite-card header span.accepted{background:#c8ff3d18;color:var(--lime)}.profile-invite-card header span.declined{background:#ff77771a;color:#ff9b9b}
      .profile-invite-card p{color:var(--muted);font-size:9px;line-height:1.5}.profile-invite-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.profile-invite-actions button.active.accept{border-color:var(--lime);background:#c8ff3d18;color:var(--lime)}.profile-invite-actions button.active.decline{border-color:#ff7777;background:#ff777714;color:#ff9b9b}
      .profile-gift-card{display:grid;grid-template-columns:52px minmax(0,1fr) auto;gap:11px;align-items:center;padding:13px;border:1px solid var(--line);border-radius:17px;background:#ffffff05}.profile-gift-icon{width:52px;height:52px;display:grid;place-items:center;border-radius:15px;background:#c8ff3d0d;font-size:27px}.profile-gift-card h3{font-size:12px}.profile-gift-card p{margin-top:4px;color:var(--muted);font-size:9px}.profile-gift-card time{color:var(--muted);font-size:7px;text-align:right}
      @media(max-width:400px){.profile-v2-quick{gap:7px}.profile-v2-tile{min-height:128px;padding:13px}.profile-v2-tile strong{font-size:15px}.profile-v2-row{grid-template-columns:38px minmax(0,1fr) auto}.profile-v2-row i{width:38px;height:38px}.profile-gift-card{grid-template-columns:46px minmax(0,1fr)}.profile-gift-card time{grid-column:2;text-align:left}}
    `;
    document.head.appendChild(style);
  }

  function dialogs() {
    if (document.getElementById("profilePointsDialog")) return;
    document.body.insertAdjacentHTML("beforeend", ["Points", "Rewards", "Invitations", "Gifts", "Settings", "History"].map(name => `
      <dialog class="profile-v2-dialog" id="profile${name}Dialog">
        <div class="profile-v2-sheet">
          <div class="profile-v2-head">
            <div><span class="eyebrow">МОЙ ПРОФИЛЬ</span><h2 id="profile${name}Title"></h2></div>
            <button class="profile-v2-close" type="button" data-profile-v2-close>×</button>
          </div>
          <div class="profile-v2-body" id="profile${name}Body"></div>
        </div>
      </dialog>`).join(""));
  }

  function legacyCards() {
    return [
      document.querySelector(".wallet"),
      document.getElementById("achievements")?.closest(".card"),
      document.getElementById("activeVip")?.closest(".card"),
      document.getElementById("profileForm")?.closest(".card"),
      document.getElementById("pointsShopCard"),
      document.getElementById("customRewardsCard"),
      document.getElementById("socialProfileCard")
    ].filter(Boolean);
  }

  function hideOld() {
    legacyCards().forEach(node => {
      node.classList.add("profile-v2-hidden");
      node.hidden = true;
    });
  }

  function rewardRows() {
    loyalty?.evaluateRewards?.(game.profile());
    const standard = game.achievements().map(row => ({ ...row, earned: Boolean(row.earnedAt), image: "", source: "Награда BALI" }));
    const custom = loyalty ? loyalty.rewards().filter(row => row.active !== false) : [];
    const earnedCustom = loyalty ? loyalty.earnedRewardIds(game.profile()) : new Set();
    return [...standard, ...custom.map(row => ({ ...row, earned: earnedCustom.has(row.id), source: "Награда BALI" }))];
  }

  function incomingInvitations() {
    return social?.activeIncomingRequests?.() || [];
  }

  function incomingGifts() {
    return social?.incomingGifts?.() || [];
  }

  function mount() {
    const hero = document.getElementById("profileHero");
    const stats = document.getElementById("profileStats");
    const xp = document.getElementById("xpCard");
    if (!hero || !stats || !xp) return false;
    hideOld();

    const rows = rewardRows();
    const earned = rows.filter(row => row.earned).length;
    const balance = Number(points.profile().balance || 0);
    const invitations = incomingInvitations();
    const pending = invitations.filter(row => row.status === "pending").length;
    const gifts = incomingGifts();

    stats.innerHTML = "";
    stats.hidden = true;
    stats.classList.add("profile-v2-hidden");

    let controls = hero.querySelector(".profile-v2-controls");
    if (!controls) {
      controls = document.createElement("div");
      controls.className = "profile-v2-controls";
      hero.appendChild(controls);
    }
    controls.innerHTML = `
      <button type="button" data-open-profile-settings title="Настройки профиля" aria-label="Настройки профиля">⚙</button>
      <button type="button" data-open-profile-history title="История посещений" aria-label="История посещений">◷</button>`;

    let quick = document.getElementById("profileV2Quick");
    if (!quick) {
      quick = document.createElement("section");
      quick.id = "profileV2Quick";
      quick.className = "profile-v2-quick";
    }
    xp.insertAdjacentElement("afterend", quick);
    quick.innerHTML = `
      <button class="profile-v2-tile shop" type="button" data-open-profile-points data-open-profile-vip>
        <small>МАГАЗИН</small><strong>BALI Shop</strong><span>${balance} баллов · VIP, фишки и покупки →</span>
      </button>
      <button class="profile-v2-tile rewards" type="button" data-open-profile-rewards>
        <small>МОИ НАГРАДЫ</small><strong>${earned} из ${rows.length}</strong><span>Полученные и доступные награды BALI →</span>
      </button>
      <button class="profile-v2-tile invites" type="button" data-open-profile-invitations>
        <small>ВХОДЯЩИЕ</small><strong>Приглашения · ${invitations.length}</strong><span>${pending ? `Без ответа: ${pending}` : "Все ответы сохранены"} →</span>
      </button>
      <button class="profile-v2-tile gifts" type="button" data-open-profile-gifts>
        <small>ОТ ПОЛЬЗОВАТЕЛЕЙ</small><strong>Мои подарки · ${gifts.length}</strong><span>Посмотреть подарки и отправителей →</span>
      </button>`;
    return true;
  }

  function setTitle(name, text) {
    const title = document.getElementById(`profile${name}Title`);
    if (title) title.textContent = text;
  }

  function open(name) {
    const dialog = document.getElementById(`profile${name}Dialog`);
    if (!dialog || dialog.open) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function renderShop() {
    setTitle("Points", "BALI Shop");
    const balance = Number(points.profile().balance || 0);
    const chips = loyalty ? loyalty.chipBalance(game.profile()) : 0;
    const root = document.getElementById("profilePointsBody");
    if (!root) return;
    root.innerHTML = `
      <div class="profile-v2-balance"><span>ВАШ БАЛАНС</span><strong>${balance}</strong><small>BALI-Баллов · ${chips} фишек</small></div>
      <section class="profile-v2-section"><h3>VIP-статусы</h3><div class="profile-v2-shop-note">Все доступные статусы BALI, сроки действия и варианты покупки находятся здесь.</div><div id="profileVipBody"></div></section>
      <section class="profile-v2-section"><h3>Обмен баллов на фишки</h3><div class="profile-v2-shop-note">Выберите количество фишек. Заявка поступит администратору, а выдача подтверждается в заведении.</div></section>`;
    setTimeout(() => window.BaliVipVariants?.renderShop?.(), 0);
  }

  function renderRewards() {
    setTitle("Rewards", "Мои награды");
    const rows = rewardRows();
    const root = document.getElementById("profileRewardsBody");
    if (!root) return;
    root.innerHTML = `<section class="profile-v2-section"><h3>Награды BALI</h3><div class="profile-v2-list">${rows.map(row => `
      <article class="profile-v2-row ${row.earned ? "" : "locked"}"><i>${row.image ? `<img src="${esc(row.image)}" alt="">` : esc(row.icon || "🏆")}</i><div><h3>${esc(row.title || "Награда BALI")}</h3><p>${esc(row.description || "Продолжайте посещать BALI, чтобы получить награду")}</p></div><b>${row.earned ? "Получено" : `+${Number(row.xp || 0)} XP`}</b></article>`).join("") || '<div class="empty">Награды скоро появятся</div>'}</div></section>`;
  }

  function renderInvitations() {
    setTitle("Invitations", "Входящие приглашения");
    const rows = incomingInvitations();
    const root = document.getElementById("profileInvitationsBody");
    if (!root) return;
    root.innerHTML = rows.length ? `
      <div class="profile-v2-shop-note">Ответ можно изменить в любой момент до окончания мероприятия. После завершения события приглашение исчезнет автоматически.</div>
      <div class="profile-v2-list">${rows.map(row => {
        const status = row.status === "accepted" ? "Принято" : row.status === "declined" ? "Отклонено" : "Без ответа";
        return `<article class="profile-invite-card"><header><div><h3>${esc(row.eventTitle || "Мероприятие BALI")}</h3><p>От: <strong>${esc(row.fromName || "Пользователь BALI")}</strong></p></div><span class="${esc(row.status || "pending")}">${status}</span></header><p>${esc(fmtEvent(row))}<br>Доступно до ${esc(fmt(social.requestEndAt(row)))}</p><div class="profile-invite-actions"><button type="button" class="secondary accept ${row.status === "accepted" ? "active" : ""}" data-profile-invite-response="${esc(row.id)}:accepted">Принять</button><button type="button" class="secondary decline ${row.status === "declined" ? "active" : ""}" data-profile-invite-response="${esc(row.id)}:declined">Отклонить</button></div></article>`;
      }).join("")}</div>` : '<div class="empty">Актуальных приглашений пока нет</div>';
  }

  function renderGifts() {
    setTitle("Gifts", "Мои подарки");
    const rows = incomingGifts();
    const root = document.getElementById("profileGiftsBody");
    if (!root) return;
    root.innerHTML = rows.length ? `<div class="profile-v2-list">${rows.map(row => `
      <article class="profile-gift-card"><span class="profile-gift-icon">${esc(row.icon || "🎁")}</span><div><h3>${esc(row.giftName || "Подарок BALI")}</h3><p>От кого: <strong>${esc(row.fromName || "Пользователь BALI")}</strong></p></div><time>${esc(fmt(row.createdAt))}</time></article>`).join("")}</div>` : '<div class="empty">Вам пока не дарили подарки</div>';
  }

  function renderSettings() {
    setTitle("Settings", "Настройки профиля");
    const profile = game.profile();
    const socialProfile = social?.profile?.() || {};
    const statuses = social?.STATUSES || [];
    const root = document.getElementById("profileSettingsBody");
    if (!root) return;
    root.innerHTML = `
      <form class="profile-v2-form" id="profileV2SettingsForm">
        <div class="profile-v2-avatar">${profile.avatar ? `<img src="${esc(profile.avatar)}" alt="">` : '<div class="avatar">B</div>'}<div><strong>Фотография профиля</strong><br><button class="secondary" type="button" data-v2-pick-avatar>Загрузить фото</button></div><input id="profileV2AvatarInput" type="file" accept="image/*" hidden></div>
        <label><span>Имя</span><input name="name" required value="${esc(profile.name || "")}"></label>
        <label><span>Телефон</span><input name="phone" inputmode="tel" value="${esc(profile.phone || "")}"></label>
        <label><span>Telegram username</span><input name="username" value="${esc(profile.username || "")}"></label>
        <label class="profile-v2-switch"><span>Показывать меня в рейтинге</span><input name="publicRanking" type="checkbox" ${profile.publicRanking !== false ? "checked" : ""}></label>
        <label class="profile-v2-switch"><span>Показывать меня в BALI PEOPLE</span><input name="socialActive" type="checkbox" ${socialProfile.active ? "checked" : ""}></label>
        <label><span>Статус в BALI PEOPLE</span><select name="socialStatus">${statuses.map(([id, title]) => `<option value="${esc(id)}" ${socialProfile.status === id ? "selected" : ""}>${esc(title)}</option>`).join("")}</select></label>
        <label><span>О себе</span><textarea name="bio" maxlength="180">${esc(socialProfile.bio || "")}</textarea></label>
        <button class="primary full" type="submit">Сохранить настройки</button>
      </form>`;
  }

  async function renderHistory() {
    setTitle("History", "История посещений");
    const profile = game.profile();
    const keys = new Set(game.identityKeys(profile));
    let rows = [];
    try { rows = attendance ? await attendance.listCheckins() : Object.values(JSON.parse(localStorage.getItem("bali_event_checkins_v1") || "{}")); } catch {}
    rows = rows.filter(row => keys.has(String(row.user_key || "")) || String(row.telegram_id || "") === String(profile.telegramId || ""));
    const root = document.getElementById("profileHistoryBody");
    if (!root) return;
    root.innerHTML = `<div class="profile-v2-list">${rows.map(row => `<article class="profile-v2-row"><i>✓</i><div><h3>${esc(row.event_title || "Мероприятие BALI")}</h3><p>${fmt(row.checked_in_at)} · ${Number(row.reward || 0)} баллов · ${Number(row.xp || 0)} XP</p></div><b>${esc(row.level || "")}</b></article>`).join("") || '<div class="empty">Подтверждённых посещений пока нет</div>'}</div>`;
  }

  function imageData(file) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const url = URL.createObjectURL(file);
      image.onload = () => {
        const size = 500;
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        const context = canvas.getContext("2d");
        const scale = Math.max(size / image.width, size / image.height);
        const width = image.width * scale, height = image.height * scale;
        context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", .84));
      };
      image.onerror = reject;
      image.src = url;
    });
  }

  document.addEventListener("click", async event => {
    if (event.target.closest('[data-page="profile"]')) setTimeout(mount, 0);
    if (event.target.closest("[data-open-profile-points]")) { renderShop(); open("Points"); }
    if (event.target.closest("[data-open-profile-rewards]")) { renderRewards(); open("Rewards"); }
    if (event.target.closest("[data-open-profile-invitations]")) { renderInvitations(); open("Invitations"); }
    if (event.target.closest("[data-open-profile-gifts]")) { renderGifts(); open("Gifts"); }
    if (event.target.closest("[data-open-profile-settings]")) { renderSettings(); open("Settings"); }
    if (event.target.closest("[data-open-profile-history]")) { await renderHistory(); open("History"); }
    const response = event.target.closest("[data-profile-invite-response]");
    if (response) {
      const [id, decision] = response.dataset.profileInviteResponse.split(":");
      const result = social?.respond?.(id, decision);
      toast(result ? (decision === "accepted" ? "Приглашение принято" : "Приглашение отклонено") : "Срок приглашения истёк");
      renderInvitations();
      mount();
    }
    if (event.target.closest("[data-profile-v2-close]")) event.target.closest("dialog")?.close();
    if (event.target.closest("[data-v2-pick-avatar]")) document.getElementById("profileV2AvatarInput")?.click();
  }, true);

  document.addEventListener("submit", event => {
    if (event.target.id !== "profileV2SettingsForm") return;
    event.preventDefault();
    const form = event.target;
    const data = Object.fromEntries(new FormData(form).entries());
    game.saveProfile({ name:String(data.name || "").trim(), phone:String(data.phone || "").trim(), username:String(data.username || "").trim(), publicRanking:form.publicRanking.checked });
    social?.saveProfile?.({ name:String(data.name || "").trim(), active:form.socialActive.checked, status:form.socialActive.checked ? data.socialStatus : "closed", bio:String(data.bio || "").trim(), photo:game.profile().avatar || social.profile().photo || "" });
    toast("Настройки сохранены");
    document.getElementById("profileSettingsDialog")?.close();
    mount();
  }, true);

  document.addEventListener("change", async event => {
    if (event.target.id !== "profileV2AvatarInput") return;
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const avatar = await imageData(file);
      game.saveProfile({ avatar });
      social?.saveProfile?.({ photo: avatar });
      toast("Фото обновлено");
      renderSettings();
      mount();
    } catch { toast("Не удалось загрузить фото"); }
  }, true);

  styles();
  dialogs();
  ["bali:points-changed", "bali:beta4-changed", "bali:loyalty-changed", "bali:social-changed", "bali:data-changed"]
    .forEach(name => window.addEventListener(name, () => requestAnimationFrame(mount)));
  let attempts = 0;
  const timer = setInterval(() => { attempts += 1; if (mount() || attempts > 40) clearInterval(timer); }, 100);
  setInterval(() => {
    mount();
    if (document.getElementById("profileInvitationsDialog")?.open) renderInvitations();
  }, 60000);

  window.BaliCompactProfile = { mount, renderShop, renderRewards, renderInvitations, renderGifts, renderSettings, renderHistory };
})();