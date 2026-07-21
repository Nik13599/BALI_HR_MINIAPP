(() => {
  if (window.__BALI_PEOPLE_SEARCH_RANKING__) return;
  window.__BALI_PEOPLE_SEARCH_RANKING__ = true;
  const social = window.BaliBeta4Social;
  const game = window.BaliBeta4Game;
  const points = window.BaliPoints;
  if (!social || !game || !points) return;

  let query = "";
  let scheduled = false;
  let refreshing = false;
  const normalize = value => String(value || "").toLocaleLowerCase("ru").replace(/[^\p{L}\p{N}@+]+/gu, " ").trim();
  const digits = value => String(value || "").replace(/\D/g, "");

  function styles() {
    if (document.getElementById("baliPeopleSearchRankingStyle")) return;
    const style = document.createElement("style");
    style.id = "baliPeopleSearchRankingStyle";
    style.textContent = `.bali-people-search{display:grid;gap:6px;margin:0 0 11px}.bali-people-search input{width:100%;min-height:46px;padding:0 14px;border:1px solid var(--line);border-radius:14px;background:#111513;color:#fff}.bali-people-search small{color:var(--muted);font-size:8px}.people-rank-badge{display:inline-flex;align-items:center;min-height:24px;margin:7px 0 0;padding:0 8px;border:1px solid rgba(200,255,61,.25);border-radius:999px;background:rgba(200,255,61,.07);color:var(--lime);font-size:8px;font-weight:900}.profile-rank-button{display:grid!important;gap:1px!important;min-width:76px!important;padding:6px 10px!important;text-align:center}.profile-rank-button span{font-size:9px;font-weight:900}.profile-rank-button small{color:var(--lime);font-size:8px}.nav{grid-template-columns:repeat(5,minmax(0,1fr))!important}`;
    document.head.appendChild(style);
  }

  function rankingRows() {
    return game.ranking(Object.values(points.accounts?.() || {}));
  }

  function positionFor(person) {
    const rows = rankingRows();
    const id = String(person?.id || person?.userKey || "");
    const username = normalize(person?.username || person?.telegram || "");
    const phone = digits(person?.phone || "");
    const name = normalize(person?.name || "");
    return rows.find(row => String(row.id || row.userKey || "") === id)
      || rows.find(row => username && normalize(row.username || row.telegram || "") === username)
      || rows.find(row => phone && digits(row.phone || "") === phone)
      || rows.find(row => name && normalize(row.name || "") === name)
      || null;
  }

  function ensureSearch() {
    const tabs = document.querySelector('[data-screen="dating"] .social-tabs-v2');
    if (!tabs || document.getElementById("baliPeopleSearch")) return;
    const box = document.createElement("label");
    box.id = "baliPeopleSearch";
    box.className = "bali-people-search";
    box.innerHTML = `<input type="search" autocomplete="off" placeholder="Поиск по имени, @username или телефону"><small>Телефон используется только для поиска и не показывается другим гостям.</small>`;
    tabs.before(box);
    box.querySelector("input").addEventListener("input", event => {
      query = normalize(event.target.value);
      filterCards();
    });
  }

  function decorateCards() {
    const people = social.visiblePeople?.() || [];
    document.querySelectorAll('[data-open-social-person]').forEach(card => {
      const id = String(card.dataset.openSocialPerson || "");
      const person = people.find(item => String(item.id) === id) || {};
      const body = card.querySelector(".person-v2-body");
      if (!body) return;
      const position = positionFor(person);
      let badge = body.querySelector(".people-rank-badge");
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "people-rank-badge";
        const paragraph = body.querySelector("p");
        paragraph?.insertAdjacentElement("afterend", badge);
      }
      const badgeText = position ? `Рейтинг #${position.position}` : "Без места в рейтинге";
      if (badge.textContent !== badgeText) badge.textContent = badgeText;
      const searchValue = normalize(`${person.name || ""} ${person.username || person.telegram || ""} ${person.phone || ""} ${digits(person.phone || "")}`);
      if (card.dataset.peopleSearch !== searchValue) card.dataset.peopleSearch = searchValue;
    });
    filterCards();
  }

  function filterCards() {
    const queryDigits = digits(query);
    document.querySelectorAll('[data-open-social-person]').forEach(card => {
      const searchValue = String(card.dataset.peopleSearch || "");
      const hidden = Boolean(query && !searchValue.includes(query) && !(queryDigits && digits(searchValue).includes(queryDigits)));
      if (card.hidden !== hidden) card.hidden = hidden;
    });
  }

  function moveRanking() {
    document.querySelector('.nav [data-page="ranking"]')?.remove();
    const nav = document.querySelector(".nav");
    if (nav) {
      const columns = `repeat(${Math.max(1, nav.children.length)}, minmax(0,1fr))`;
      if (nav.style.gridTemplateColumns !== columns) nav.style.gridTemplateColumns = columns;
    }
    const controls = document.querySelector("#profileHero .profile-v2-controls");
    if (!controls) return;
    const me = game.profile();
    const position = positionFor(me);
    let button = controls.querySelector(".profile-rank-button");
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "profile-rank-button";
      button.dataset.page = "ranking";
      controls.prepend(button);
    }
    const total = rankingRows().length;
    const html = `<span>Рейтинг</span><small>${position ? `#${position.position} из ${total}` : `нет места · ${total}`}</small>`;
    if (button.innerHTML !== html) button.innerHTML = html;
  }

  function refresh() {
    if (refreshing) return;
    refreshing = true;
    try {
      ensureSearch();
      decorateCards();
      moveRanking();
    } finally {
      refreshing = false;
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      refresh();
    });
  }

  styles();
  refresh();
  new MutationObserver(records => {
    if (refreshing || !records.some(record => record.addedNodes.length || record.removedNodes.length)) return;
    schedule();
  }).observe(document.body, { childList: true, subtree: true });
  ["bali:social-changed", "bali:beta4-changed", "bali:points-changed", "bali:data-changed"].forEach(name => window.addEventListener(name, schedule));
})();