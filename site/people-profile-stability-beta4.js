(() => {
  if (window.__BALI_PEOPLE_PROFILE_STABILITY__) return;
  window.__BALI_PEOPLE_PROFILE_STABILITY__ = true;

  const social = window.BaliBeta4Social;
  const peopleApi = window.BaliFullDemoPeople;
  const game = window.BaliBeta4Game;
  const points = window.BaliPoints;
  if (!social) return;

  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
  const initials = name => String(name || "B").trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase();
  const normalize = value => String(value || "").toLocaleLowerCase("ru").replace(/^@/, "").trim();
  const digits = value => String(value || "").replace(/\D/g, "");
  const fmt = value => value ? new Date(value).toLocaleString("ru-RU", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" }) : "—";

  function styles() {
    if (document.getElementById("peopleProfileStabilityStyle")) return;
    const style = document.createElement("style");
    style.id = "peopleProfileStabilityStyle";
    style.textContent = `
      [data-screen="dating"].page.active{overflow-y:auto!important;overscroll-behavior-y:contain!important;-webkit-overflow-scrolling:touch!important;touch-action:pan-y!important}
      [data-screen="dating"] .inner{min-height:max-content;padding-bottom:120px}
      [data-screen="dating"] #socialV2Content{min-height:0;touch-action:pan-y}
      [data-screen="dating"] .person-v2{cursor:pointer;touch-action:pan-y;transform:translateZ(0)}
      [data-screen="dating"] .people-v2-grid{align-items:start}
      .social-v2-dialog[open]{display:block}.social-v2-sheet{overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
      #profileV2Quick{min-height:280px;align-items:stretch;contain:layout}
      #profileV2Quick .profile-v2-tile{min-height:128px;transform:none!important;animation:none!important;transition:border-color .15s ease,background-color .15s ease!important}
      #profileHero .profile-v2-controls{contain:layout paint;min-height:96px}
    `;
    document.head.appendChild(style);
  }

  function accountFor(person = {}) {
    const accounts = Object.values(points?.accounts?.() || {});
    const id = String(person.id || person.userKey || person.user_key || "");
    const phone = digits(person.phone);
    const name = normalize(person.name);
    return accounts.find(row => String(row.userKey || row.id || "") === id)
      || accounts.find(row => phone && digits(row.phone) === phone)
      || accounts.find(row => name && normalize(row.name) === name)
      || person;
  }

  function statusLabel(person, account) {
    const vip = peopleApi?.activeVip?.(person);
    if (vip) return vip.plan?.name || vip.planId || "BALI VIP";
    return game?.levelFor?.(Number(account?.xp || 0))?.current?.name || "Гость BALI";
  }

  function canSee(person, field) {
    if (peopleApi?.canSee) return peopleApi.canSee(person, field);
    if (field === "photo") return person.showPhoto === true || social.isConnection?.(person.id);
    if (field === "phone") return person.sharePhone === true;
    if (field === "telegram") return person.shareTelegram === true;
    if (field === "age") return person.shareAge === true;
    return false;
  }

  function openFallbackPerson(id) {
    const person = social.visiblePeople().find(row => String(row.id) === String(id));
    const dialog = document.getElementById("socialPersonDialog");
    const body = document.getElementById("socialPersonBody");
    if (!person || !dialog || !body) return false;

    const account = accountFor(person);
    const visits = peopleApi?.visitsFor?.(person) || [];
    const rewards = peopleApi?.rewardsFor?.(person) || [];
    const ranking = game?.ranking?.(Object.values(points?.accounts?.() || {})) || [];
    const rank = ranking.find(row => String(row.id || row.userKey || "") === String(person.id || person.userKey || ""));
    const photoVisible = canSee(person, "photo");
    const photo = person.photo || person.avatar || "";
    const mine = social.hasThumb?.(social.myId(), person.id);
    const instagramVisible = peopleApi?.viewerHasVip?.() || person.shareInstagram === true;

    body.innerHTML = `
      <div class="person-v2-photo ${photoVisible ? "" : "is-locked"}">
        ${photo ? `<img src="${esc(photo)}" alt="${esc(person.name || "Пользователь BALI")}" style="object-position:${Number(person.cropX ?? 50)}% ${Number(person.cropY ?? 40)}%">` : `<div class="person-v2-placeholder">${esc(initials(person.name))}</div>`}
        ${photoVisible ? "" : '<div class="person-v2-lock">Фото скрыто настройками конфиденциальности</div>'}
        <span class="person-v2-status">${esc(statusLabel(person, account))}</span>
      </div>
      <h2>${esc(person.name || "Пользователь BALI")}</h2>
      <p>${esc(person.bio || "Пользователь сообщества BALI")}</p>
      <section class="people-detail-section"><h3>Профиль BALI</h3><div class="people-detail-list">
        <div class="people-detail-row"><span>Уровень</span><strong>${esc(statusLabel(person, account))}</strong></div>
        <div class="people-detail-row"><span>Место в рейтинге</span><strong>${rank?.position ? `#${Number(rank.position)}` : "—"}</strong></div>
        <div class="people-detail-row"><span>Посещения</span><strong>${Number(visits.length || account.visits || 0)}</strong></div>
        <div class="people-detail-row"><span>Награды</span><strong>${Number(rewards.length || 0)}</strong></div>
        ${canSee(person,"age") && person.age ? `<div class="people-detail-row"><span>Возраст</span><strong>${Number(person.age)} лет</strong></div>` : ""}
        ${canSee(person,"telegram") && person.username ? `<div class="people-detail-row"><span>Telegram</span><strong>${esc(person.username)}</strong></div>` : ""}
        ${canSee(person,"phone") && person.phone ? `<div class="people-detail-row"><span>Телефон</span><strong>${esc(person.phone)}</strong></div>` : ""}
        ${instagramVisible && person.instagram ? `<div class="people-detail-row"><span>Instagram</span><strong>${esc(person.instagram)}</strong></div>` : ""}
      </div></section>
      ${rewards.length ? `<section class="people-detail-section"><h3>Награды</h3><div class="people-detail-list">${rewards.slice(0,20).map(row => `<div class="people-detail-row"><span>${esc(row.reward?.icon || "🏆")} ${esc(row.reward?.title || "Награда BALI")}</span><strong>${esc(fmt(row.earnedAt))}</strong></div>`).join("")}</div></section>` : ""}
      <div class="person-v2-actions">
        <button type="button" title="Пригласить на мероприятие" data-person-invite="${esc(person.id)}">＋</button>
        <button type="button" title="Подарок" data-person-gift="${esc(person.id)}">🎁</button>
        <button type="button" title="Лайк" class="${mine ? "active" : ""}" data-person-thumb="${esc(person.id)}">👍</button>
      </div>`;

    if (!dialog.open) {
      try { dialog.showModal(); }
      catch { dialog.setAttribute("open", ""); }
    }
    return true;
  }

  let peopleScroll = 0;
  let profileScroll = 0;
  document.addEventListener("scroll", event => {
    const target = event.target;
    if (target?.matches?.('[data-screen="dating"]')) peopleScroll = target.scrollTop;
    if (target?.matches?.('[data-screen="profile"]')) profileScroll = target.scrollTop;
  }, true);

  function restoreScroll(screen, value) {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const page = document.querySelector(`[data-screen="${screen}"].active`);
      if (page && !document.querySelector("dialog[open]")) page.scrollTop = value;
    }));
  }

  document.addEventListener("click", event => {
    const card = event.target.closest?.("[data-open-social-person]");
    if (card && !event.target.closest("button")) {
      const id = card.dataset.openSocialPerson;
      setTimeout(() => {
        if (!document.getElementById("socialPersonDialog")?.open) openFallbackPerson(id);
      }, 24);
    }
    if (event.target.closest?.('[data-page="dating"]')) peopleScroll = 0;
    if (event.target.closest?.('[data-page="profile"]')) profileScroll = 0;
  }, true);

  ["bali:social-changed","bali:points-changed","bali:loyalty-changed","bali:beta4-changed","bali:data-changed"].forEach(name => window.addEventListener(name, () => {
    if (document.querySelector('[data-screen="dating"].active')) restoreScroll("dating", peopleScroll);
    if (document.querySelector('[data-screen="profile"].active')) restoreScroll("profile", profileScroll);
  }));

  function relabel() {
    const inside = document.querySelector('[data-social-v2-tab="inside"]');
    if (inside && !/^Уже в клубе/.test(inside.textContent || "")) {
      const count = (inside.textContent || "").match(/\d+/)?.[0];
      inside.textContent = `Уже в клубе${count ? ` · ${count}` : ""}`;
    }
  }

  styles();
  relabel();
  ["bali:full-demo-ready","bali:full-demo-enhancements-ready","bali:checkin-complete","bali:checkin-left"].forEach(name => window.addEventListener(name, () => setTimeout(relabel, 0)));
  window.BaliPeopleProfileStability = { openFallbackPerson, restoreScroll, relabel };
})();