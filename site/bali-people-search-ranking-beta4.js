(() => {
  if (window.__BALI_PEOPLE_SEARCH_RANKING__) return;
  window.__BALI_PEOPLE_SEARCH_RANKING__ = true;

  const social = window.BaliBeta4Social;
  const game = window.BaliBeta4Game;
  const points = window.BaliPoints;
  if (!social || !game || !points) return;

  let query = "";
  let genderFilter = "all";
  let ageMin = 18;
  let ageMax = 99;
  let scheduled = false;
  let refreshing = false;

  const normalize = value => String(value || "").toLocaleLowerCase("ru").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

  function styles() {
    if (document.getElementById("baliPeopleSearchRankingStyle")) return;
    const style = document.createElement("style");
    style.id = "baliPeopleSearchRankingStyle";
    style.textContent = `
      .bali-people-discovery{display:grid;gap:8px;margin:0 0 12px}
      .bali-people-search-main{position:relative;display:flex;align-items:center}
      .bali-people-search-main i{position:absolute;left:13px;color:var(--muted);font-style:normal;font-size:16px;pointer-events:none}
      .bali-people-search-main input{width:100%;min-height:47px;padding:0 14px 0 39px;border:1px solid var(--line);border-radius:15px;background:#111513;color:#fff;font-size:12px}
      .bali-people-filters{display:grid;grid-template-columns:1fr 82px 16px 82px;gap:7px;align-items:center}
      .bali-people-filters select,.bali-people-filters input{width:100%;min-height:42px;padding:0 9px;border:1px solid var(--line);border-radius:12px;background:#111513;color:#fff;font-size:9px}
      .bali-people-filters b{color:var(--muted);font-size:9px;text-align:center}
      .bali-people-discovery small{color:var(--muted);font-size:8px;line-height:1.45}
      .people-v2-grid{grid-template-columns:1fr!important;gap:7px!important}
      .person-v2{display:grid!important;grid-template-columns:78px minmax(0,1fr)!important;align-items:center;min-height:96px;border-radius:16px!important;overflow:visible!important}
      .person-v2>.person-v2-photo{width:62px!important;height:62px!important;aspect-ratio:1!important;margin:9px 7px 9px 9px!important;border-radius:50%!important;overflow:hidden!important;flex:none}
      .person-v2>.person-v2-photo .person-v2-status{display:none!important}
      .person-v2>.person-v2-body{min-width:0;padding:9px 10px 9px 2px!important}
      .person-v2>.person-v2-body h3{font-size:12px!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .person-v2>.person-v2-body p{display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden;font-size:8px!important}
      .person-v2>.person-v2-body .person-v2-actions{grid-template-columns:repeat(3,40px)!important;justify-content:start;margin-top:7px!important}
      .person-v2>.person-v2-body .person-v2-actions button{min-height:32px!important;font-size:15px!important}
      .people-demographic-meta{display:block;margin-top:4px;color:#c9d0cc;font-size:8px}
      .people-rank-badge,.people-status-chip{display:inline-flex;align-items:center;min-height:22px;margin:6px 5px 0 0;padding:0 7px;border:1px solid rgba(200,255,61,.25);border-radius:999px;background:rgba(200,255,61,.07);color:var(--lime);font-size:7px;font-weight:900}
      .people-status-chip{border-color:rgba(242,205,102,.32);background:rgba(242,205,102,.08);color:#f2cd66}
      .person-v2-photo.people-status-vip{box-shadow:0 0 0 3px #f2cd66,0 0 17px rgba(242,205,102,.4)}
      .person-v2-photo.people-status-black{box-shadow:0 0 0 3px #dadada,0 0 0 6px #181a19,0 0 18px rgba(255,255,255,.2)}
      .person-v2-photo.people-status-legend{box-shadow:0 0 0 3px #f2cd66,0 0 0 6px #9c6cff,0 0 22px rgba(156,108,255,.48)}
      .person-v2-photo.people-status-crown{box-shadow:0 0 0 3px #ff79c6,0 0 0 6px #f2cd66,0 0 20px rgba(255,121,198,.4)}
      .person-v2-photo.people-level-club-legend{box-shadow:0 0 0 3px #a77cff,0 0 16px rgba(167,124,255,.38)}
      .person-v2-photo.people-level-bali-insider{box-shadow:0 0 0 3px #4fd5ff,0 0 15px rgba(79,213,255,.3)}
      .person-v2-photo.people-level-night-regular{box-shadow:0 0 0 3px var(--lime)}
      .person-v2-photo.people-level-party-starter{box-shadow:0 0 0 3px #bcc5c0}
      .social-v2-profile>.person-v2-photo{width:100%!important;height:auto!important;aspect-ratio:4/5!important;margin:0!important;border-radius:18px!important}
      .profile-rank-button{display:grid!important;gap:1px!important;min-width:76px!important;padding:6px 10px!important;text-align:center}.profile-rank-button span{font-size:9px;font-weight:900}.profile-rank-button small{color:var(--lime);font-size:8px}
      @media(max-width:390px){.bali-people-filters{grid-template-columns:1fr 70px 12px 70px}.person-v2{grid-template-columns:70px minmax(0,1fr)!important}.person-v2>.person-v2-photo{width:56px!important;height:56px!important}}
    `;
    document.head.appendChild(style);
  }

  function rankingRows() {
    return game.ranking(Object.values(points.accounts?.() || {}));
  }

  function positionFor(person) {
    const rows = rankingRows();
    const id = String(person?.id || person?.userKey || person?.user_key || "");
    const name = normalize(person?.name || "");
    return rows.find(row => String(row.id || row.userKey || row.user_key || "") === id)
      || rows.find(row => name && normalize(row.name || "") === name)
      || null;
  }

  function ageFor(person) {
    const explicit = Number(person?.age || 0);
    if (explicit >= 18 && explicit <= 99) return explicit;
    const raw = person?.birth_date || person?.birthDate || person?.birthday || "";
    if (!raw) return 0;
    const birth = new Date(`${String(raw).slice(0, 10)}T12:00:00`);
    if (Number.isNaN(birth.getTime())) return 0;
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const beforeBirthday = now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
    if (beforeBirthday) age -= 1;
    return age >= 18 && age <= 99 ? age : 0;
  }

  function genderFor(person) {
    const value = normalize(person?.gender || person?.sex || "");
    if (["female", "f", "woman", "женщина", "женский"].includes(value)) return "female";
    if (["male", "m", "man", "мужчина", "мужской"].includes(value)) return "male";
    return "unknown";
  }

  function genderLabel(gender) {
    if (gender === "female") return "Женщина";
    if (gender === "male") return "Мужчина";
    return "Пол не указан";
  }

  function identityKeys(person, account = {}) {
    const values = new Set();
    [person?.id, person?.userKey, person?.user_key, person?.ownerKey, person?.owner_key, person?.code, account?.id, account?.userKey, account?.user_key, account?.ownerKey, account?.code]
      .filter(Boolean).forEach(value => values.add(String(value)));
    try { game.identityKeys({ ...account, ...person }).forEach(value => values.add(String(value))); } catch {}
    return values;
  }

  function activeVipFor(person, account) {
    const keys = identityKeys(person, account);
    return game.vipGifts().filter(gift => !gift.revokedAt && new Date(gift.expiresAt).getTime() > Date.now() && gift.targetKeys?.some(key => keys.has(String(key))))
      .sort((a, b) => String(b.expiresAt).localeCompare(String(a.expiresAt)))[0] || null;
  }

  function baseStatus(person) {
    const account = positionFor(person) || person || {};
    const vip = activeVipFor(person, account);
    if (vip) {
      const plan = game.config().plans.find(row => String(row.id) === String(vip.planId));
      if (vip.planId === "legend") return { className: "people-status-legend", label: plan?.name || "BALI LEGEND", locked: true };
      if (vip.planId === "black") return { className: "people-status-black", label: plan?.name || "BALI BLACK", locked: true };
      return { className: "people-status-vip", label: plan?.name || "BALI VIP", locked: true };
    }
    const xp = Number(account.xp || person?.xp || 0);
    const level = game.levelFor(xp).current;
    const className = `people-level-${normalize(level.name).replace(/\s+/g, "-")}`;
    return { className, label: level.name, locked: false };
  }

  function clearStatus(photo) {
    [...photo.classList].filter(name => name.startsWith("people-status-") || name.startsWith("people-level-")).forEach(name => photo.classList.remove(name));
  }

  async function applyStatus(card, person) {
    const photo = card.querySelector(".person-v2-photo");
    const body = card.querySelector(".person-v2-body");
    if (!photo || !body) return;
    clearStatus(photo);
    const status = baseStatus(person);
    let finalStatus = status;
    if (!status.locked && window.BaliCrownWinCards?.winCounts) {
      try {
        const wins = await window.BaliCrownWinCards.winCounts(person);
        if (Number(wins.miss || 0) + Number(wins.mister || 0) > 0) finalStatus = { className: "people-status-crown", label: wins.miss ? "Королева ночи" : "Король ночи" };
      } catch {}
    }
    photo.classList.add(finalStatus.className);
    let badge = body.querySelector(".people-status-chip");
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "people-status-chip";
      body.querySelector(".people-rank-badge")?.insertAdjacentElement("afterend", badge) || body.appendChild(badge);
    }
    badge.textContent = finalStatus.label;
  }

  function ensureSearch() {
    const tabs = document.querySelector('[data-screen="dating"] .social-tabs-v2');
    if (!tabs) return;
    let box = document.getElementById("baliPeopleSearch");
    if (!box) {
      box = document.createElement("section");
      box.id = "baliPeopleSearch";
      box.className = "bali-people-discovery";
      box.innerHTML = `
        <label class="bali-people-search-main"><i>⌕</i><input id="baliPeopleNameSearch" type="search" autocomplete="off" placeholder="Поиск по имени"></label>
        <div class="bali-people-filters">
          <select id="baliPeopleGender"><option value="all">Все пользователи</option><option value="female">Женщины</option><option value="male">Мужчины</option></select>
          <input id="baliPeopleAgeMin" type="number" min="18" max="99" value="18" aria-label="Возраст от">
          <b>—</b>
          <input id="baliPeopleAgeMax" type="number" min="18" max="99" value="99" aria-label="Возраст до">
        </div>
        <small>Поиск работает только по публичному имени. Телефон и Telegram других пользователей скрыты.</small>`;
      tabs.before(box);
      box.querySelector("#baliPeopleNameSearch").addEventListener("input", event => { query = normalize(event.target.value); filterCards(); });
      box.querySelector("#baliPeopleGender").addEventListener("change", event => { genderFilter = event.target.value; filterCards(); });
      box.querySelector("#baliPeopleAgeMin").addEventListener("input", event => { ageMin = Math.max(18, Math.min(99, Number(event.target.value || 18))); filterCards(); });
      box.querySelector("#baliPeopleAgeMax").addEventListener("input", event => { ageMax = Math.max(18, Math.min(99, Number(event.target.value || 99))); filterCards(); });
    }
  }

  async function decorateCards() {
    const people = social.visiblePeople?.() || [];
    const tasks = [];
    document.querySelectorAll('[data-open-social-person]').forEach(card => {
      const id = String(card.dataset.openSocialPerson || "");
      const person = people.find(item => String(item.id) === id) || {};
      const body = card.querySelector(".person-v2-body");
      if (!body) return;
      const position = positionFor(person);
      const age = ageFor(person);
      const gender = genderFor(person);
      card.dataset.peopleSearch = normalize(person.name || "");
      card.dataset.peopleGender = gender;
      card.dataset.peopleAge = String(age || 0);

      let meta = body.querySelector(".people-demographic-meta");
      if (!meta) {
        meta = document.createElement("span");
        meta.className = "people-demographic-meta";
        body.querySelector("p")?.insertAdjacentElement("afterend", meta);
      }
      meta.textContent = `${age ? `${age} лет` : "Возраст не указан"} · ${genderLabel(gender)}`;

      let rank = body.querySelector(".people-rank-badge");
      if (!rank) {
        rank = document.createElement("span");
        rank.className = "people-rank-badge";
        meta.insertAdjacentElement("afterend", rank);
      }
      rank.textContent = position ? `Рейтинг #${position.position}` : "Без места в рейтинге";
      tasks.push(applyStatus(card, person));
    });
    await Promise.all(tasks);
    filterCards();
  }

  function filterCards() {
    const customAge = ageMin > 18 || ageMax < 99;
    document.querySelectorAll('[data-open-social-person]').forEach(card => {
      const name = String(card.dataset.peopleSearch || "");
      const gender = card.dataset.peopleGender || "unknown";
      const age = Number(card.dataset.peopleAge || 0);
      const nameMismatch = Boolean(query && !name.includes(query));
      const genderMismatch = genderFilter !== "all" && gender !== genderFilter;
      const ageMismatch = customAge && (!age || age < Math.min(ageMin, ageMax) || age > Math.max(ageMin, ageMax));
      card.hidden = nameMismatch || genderMismatch || ageMismatch;
    });
  }

  function moveRanking() {
    document.querySelector('.nav [data-page="ranking"]')?.remove();
    const controls = document.querySelector("#profileHero .profile-v2-controls");
    if (!controls) return;
    const position = positionFor(game.profile());
    let button = controls.querySelector(".profile-rank-button");
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "profile-rank-button";
      button.dataset.page = "ranking";
      controls.prepend(button);
    }
    const total = rankingRows().length;
    button.innerHTML = `<span>Рейтинг</span><small>${position ? `#${position.position} из ${total}` : `нет места · ${total}`}</small>`;
  }

  async function refresh() {
    if (refreshing) return;
    refreshing = true;
    try {
      ensureSearch();
      await decorateCards();
      moveRanking();
    } finally {
      refreshing = false;
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(async () => {
      scheduled = false;
      await refresh();
    });
  }

  document.addEventListener("click", event => {
    const card = event.target.closest("[data-open-social-person]");
    if (card && !event.target.closest("button")) setTimeout(schedule, 0);
  }, true);

  styles();
  refresh();
  new MutationObserver(records => {
    if (refreshing || !records.some(record => record.addedNodes.length || record.removedNodes.length)) return;
    schedule();
  }).observe(document.body, { childList: true, subtree: true });
  ["bali:social-changed", "bali:beta4-changed", "bali:points-changed", "bali:data-changed", "bali:night-crown-changed", "bali:crown-win-cards-ready"].forEach(name => window.addEventListener(name, schedule));
})();