(() => {
  if (window.__BALI_PEOPLE_DISCOVERY_FAST__) return;
  window.__BALI_PEOPLE_DISCOVERY_FAST__ = true;

  const social = window.BaliBeta4Social;
  const game = window.BaliBeta4Game;
  const points = window.BaliPoints;
  if (!social || !game || !points) return;

  let query = "";
  let gender = "all";
  let minAge = 18;
  let maxAge = 99;
  let scheduled = false;
  let decorating = false;

  const norm = value => String(value || "").toLocaleLowerCase("ru").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

  function ageFor(person) {
    const direct = Number(person?.age || 0);
    if (direct >= 18 && direct <= 99) return direct;
    const raw = person?.birth_date || person?.birthDate || person?.birthday || "";
    if (!raw) return 0;
    const birth = new Date(`${String(raw).slice(0, 10)}T12:00:00`);
    if (Number.isNaN(birth.getTime())) return 0;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age -= 1;
    return age >= 18 && age <= 99 ? age : 0;
  }

  function genderFor(person) {
    const value = norm(person?.gender || person?.sex || "");
    if (["female", "f", "woman", "женщина", "женский"].includes(value)) return "female";
    if (["male", "m", "man", "мужчина", "мужской"].includes(value)) return "male";
    return "unknown";
  }

  function genderLabel(value) {
    return value === "female" ? "Женщина" : value === "male" ? "Мужчина" : "Пол не указан";
  }

  function ranking() {
    return game.ranking(Object.values(points.accounts?.() || {}));
  }

  function accountFor(person) {
    const id = String(person?.id || person?.userKey || person?.user_key || "");
    const name = norm(person?.name || "");
    return ranking().find(row => String(row.id || row.userKey || row.user_key || "") === id)
      || ranking().find(row => name && norm(row.name || "") === name)
      || person || {};
  }

  function identityKeys(person, account = {}) {
    const set = new Set();
    [person?.id, person?.userKey, person?.user_key, person?.ownerKey, person?.owner_key, person?.code, account?.id, account?.userKey, account?.user_key]
      .filter(Boolean).forEach(value => set.add(String(value)));
    try { game.identityKeys({ ...account, ...person }).forEach(value => set.add(String(value))); } catch {}
    return set;
  }

  function vipFor(person, account) {
    const keys = identityKeys(person, account);
    return game.vipGifts().filter(item => !item.revokedAt && new Date(item.expiresAt).getTime() > Date.now() && item.targetKeys?.some(key => keys.has(String(key))))
      .sort((a, b) => String(b.expiresAt).localeCompare(String(a.expiresAt)))[0] || null;
  }

  async function statusFor(person) {
    const account = accountFor(person);
    const vip = vipFor(person, account);
    if (vip) {
      const plan = game.config().plans.find(row => String(row.id) === String(vip.planId));
      if (vip.planId === "legend") return ["people-status-legend", plan?.name || "BALI LEGEND"];
      if (vip.planId === "black") return ["people-status-black", plan?.name || "BALI BLACK"];
      return ["people-status-vip", plan?.name || "BALI VIP"];
    }
    if (window.BaliCrownWinCards?.winCounts) {
      try {
        const wins = await window.BaliCrownWinCards.winCounts(person);
        if (Number(wins.miss || 0) + Number(wins.mister || 0) > 0) return ["people-status-crown", wins.miss ? "Королева ночи" : "Король ночи"];
      } catch {}
    }
    const level = game.levelFor(Number(account.xp || person?.xp || 0)).current?.name || "New Guest";
    return [`people-level-${norm(level).replace(/\s+/g, "-")}`, level];
  }

  function styles() {
    if (document.getElementById("baliPeopleDiscoveryFastStyle")) return;
    const style = document.createElement("style");
    style.id = "baliPeopleDiscoveryFastStyle";
    style.textContent = `
      .bali-people-fast-tools{display:grid;gap:8px;margin-bottom:12px}
      .bali-people-fast-search{position:relative}.bali-people-fast-search i{position:absolute;left:13px;top:14px;color:var(--muted);font-style:normal}.bali-people-fast-search input{width:100%;min-height:46px;padding:0 12px 0 38px;border:1px solid var(--line);border-radius:14px;background:#111513;color:#fff}
      .bali-people-fast-filters{display:grid;grid-template-columns:1fr 76px 12px 76px;gap:7px;align-items:center}.bali-people-fast-filters select,.bali-people-fast-filters input{width:100%;min-height:40px;padding:0 8px;border:1px solid var(--line);border-radius:12px;background:#111513;color:#fff;font-size:9px}.bali-people-fast-filters b{color:var(--muted);text-align:center}
      .bali-people-fast-note{color:var(--muted);font-size:8px}
      [data-screen="dating"] .people-v2-grid{display:grid!important;grid-template-columns:1fr!important;gap:7px!important}
      [data-screen="dating"] .person-v2{display:grid!important;grid-template-columns:76px minmax(0,1fr)!important;align-items:center;min-height:94px;overflow:visible!important;border-radius:16px!important}
      [data-screen="dating"] .person-v2>.person-v2-photo{width:60px!important;height:60px!important;aspect-ratio:1!important;margin:8px!important;border-radius:50%!important;overflow:hidden!important}
      [data-screen="dating"] .person-v2>.person-v2-photo .person-v2-status{display:none!important}
      [data-screen="dating"] .person-v2>.person-v2-body{min-width:0;padding:8px 10px 8px 0!important}
      [data-screen="dating"] .person-v2>.person-v2-body h3{font-size:12px!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      [data-screen="dating"] .person-v2>.person-v2-body p{font-size:8px!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      [data-screen="dating"] .person-v2-actions{grid-template-columns:repeat(3,38px)!important;justify-content:start;margin-top:6px!important}
      [data-screen="dating"] .person-v2-actions button{min-height:31px!important;font-size:14px!important}
      .people-fast-meta{display:block;margin-top:4px;color:#c9d0cc;font-size:8px}.people-fast-rank,.people-fast-status{display:inline-flex;align-items:center;min-height:21px;margin:5px 5px 0 0;padding:0 7px;border:1px solid rgba(200,255,61,.25);border-radius:999px;background:rgba(200,255,61,.07);color:var(--lime);font-size:7px;font-weight:900}.people-fast-status{border-color:rgba(242,205,102,.3);background:rgba(242,205,102,.07);color:#f2cd66}
      .person-v2-photo.people-status-vip{box-shadow:0 0 0 3px #f2cd66,0 0 15px rgba(242,205,102,.42)}.person-v2-photo.people-status-black{box-shadow:0 0 0 3px #e2e2e2,0 0 0 6px #171918}.person-v2-photo.people-status-legend{box-shadow:0 0 0 3px #f2cd66,0 0 0 6px #9c6cff,0 0 19px rgba(156,108,255,.46)}.person-v2-photo.people-status-crown{box-shadow:0 0 0 3px #ff79c6,0 0 0 6px #f2cd66}.person-v2-photo.people-level-club-legend{box-shadow:0 0 0 3px #a77cff}.person-v2-photo.people-level-bali-insider{box-shadow:0 0 0 3px #4fd5ff}.person-v2-photo.people-level-night-regular{box-shadow:0 0 0 3px var(--lime)}.person-v2-photo.people-level-party-starter{box-shadow:0 0 0 3px #bcc5c0}
      .social-v2-profile>.person-v2-photo{width:100%!important;height:auto!important;aspect-ratio:4/5!important;margin:0!important;border-radius:18px!important}
      @media(max-width:360px){.bali-people-fast-filters{grid-template-columns:1fr 68px 10px 68px}[data-screen="dating"] .person-v2{grid-template-columns:68px minmax(0,1fr)!important}[data-screen="dating"] .person-v2>.person-v2-photo{width:54px!important;height:54px!important}}
    `;
    document.head.appendChild(style);
  }

  function ensureTools() {
    const tabs = document.querySelector('[data-screen="dating"] .social-tabs-v2');
    if (!tabs) return false;
    if (document.getElementById("baliPeopleFastTools")) return true;
    const tools = document.createElement("section");
    tools.id = "baliPeopleFastTools";
    tools.className = "bali-people-fast-tools";
    tools.innerHTML = `<label class="bali-people-fast-search"><i>⌕</i><input type="search" placeholder="Поиск по имени" autocomplete="off"></label><div class="bali-people-fast-filters"><select><option value="all">Все пользователи</option><option value="female">Женщины</option><option value="male">Мужчины</option></select><input type="number" min="18" max="99" value="18" aria-label="Возраст от"><b>—</b><input type="number" min="18" max="99" value="99" aria-label="Возраст до"></div><small class="bali-people-fast-note">Телефон и Telegram других гостей скрыты.</small>`;
    tabs.before(tools);
    const [search, select, from, to] = [tools.querySelector('input[type="search"]'), tools.querySelector("select"), ...tools.querySelectorAll('input[type="number"]')];
    search.addEventListener("input", event => { query = norm(event.target.value); filter(); });
    select.addEventListener("change", event => { gender = event.target.value; filter(); });
    from.addEventListener("input", event => { minAge = Math.max(18, Math.min(99, Number(event.target.value || 18))); filter(); });
    to.addEventListener("input", event => { maxAge = Math.max(18, Math.min(99, Number(event.target.value || 99))); filter(); });
    return true;
  }

  async function decorate() {
    if (decorating) return;
    decorating = true;
    try {
      if (!ensureTools()) return;
      const people = social.visiblePeople?.() || [];
      const cards = [...document.querySelectorAll('[data-screen="dating"] [data-open-social-person]')];
      await Promise.all(cards.map(async card => {
        const person = people.find(row => String(row.id) === String(card.dataset.openSocialPerson)) || {};
        const body = card.querySelector(".person-v2-body");
        const photo = card.querySelector(".person-v2-photo");
        if (!body || !photo) return;
        const age = ageFor(person);
        const personGender = genderFor(person);
        const account = accountFor(person);
        card.dataset.fastName = norm(person.name || "");
        card.dataset.fastAge = String(age || 0);
        card.dataset.fastGender = personGender;
        let meta = body.querySelector(".people-fast-meta");
        if (!meta) { meta = document.createElement("span"); meta.className = "people-fast-meta"; body.querySelector("p")?.insertAdjacentElement("afterend", meta); }
        meta.textContent = `${age ? `${age} лет` : "Возраст не указан"} · ${genderLabel(personGender)}`;
        let rank = body.querySelector(".people-fast-rank");
        if (!rank) { rank = document.createElement("span"); rank.className = "people-fast-rank"; meta.insertAdjacentElement("afterend", rank); }
        rank.textContent = account.position ? `Рейтинг #${account.position}` : "Без места в рейтинге";
        [...photo.classList].filter(name => name.startsWith("people-status-") || name.startsWith("people-level-")).forEach(name => photo.classList.remove(name));
        const [className, label] = await statusFor(person);
        photo.classList.add(className);
        let status = body.querySelector(".people-fast-status");
        if (!status) { status = document.createElement("span"); status.className = "people-fast-status"; rank.insertAdjacentElement("afterend", status); }
        status.textContent = label;
      }));
      filter();
    } finally {
      decorating = false;
    }
  }

  function filter() {
    const low = Math.min(minAge, maxAge);
    const high = Math.max(minAge, maxAge);
    const ageActive = low > 18 || high < 99;
    document.querySelectorAll('[data-screen="dating"] [data-open-social-person]').forEach(card => {
      const age = Number(card.dataset.fastAge || 0);
      const hide = Boolean(query && !String(card.dataset.fastName || "").includes(query))
        || (gender !== "all" && card.dataset.fastGender !== gender)
        || (ageActive && (!age || age < low || age > high));
      card.hidden = hide;
    });
  }

  function schedule(delays = [0, 120]) {
    if (scheduled) return;
    scheduled = true;
    delays.forEach(delay => setTimeout(() => decorate(), delay));
    setTimeout(() => { scheduled = false; }, Math.max(...delays) + 30);
  }

  styles();
  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    if (ensureTools()) {
      decorate();
      clearInterval(timer);
    } else if (attempts >= 50) clearInterval(timer);
  }, 100);
  document.addEventListener("click", event => {
    if (event.target.closest('[data-page="dating"],[data-social-v2-tab],[data-open-social-person]')) schedule([0, 100, 280]);
  }, true);
  ["bali:social-changed", "bali:data-changed", "bali:points-changed", "bali:crown-win-cards-ready"].forEach(name => window.addEventListener(name, () => schedule([0, 160])));
})();