(() => {
  if (window.__BALI_PEOPLE_PUBLIC_CARDS__ || !window.BaliBeta4Social) return;
  window.__BALI_PEOPLE_PUBLIC_CARDS__ = true;

  const social = window.BaliBeta4Social;
  const points = window.BaliPoints;
  const game = window.BaliBeta4Game;
  const loyalty = window.BaliBeta4Loyalty;
  const originalProfile = social.profile.bind(social);
  const originalPeople = social.people.bind(social);
  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);

  function accountRows() { return Object.values(points?.accounts?.() || {}); }

  function accountFor(person) {
    const id = String(person?.id || "");
    const name = String(person?.name || "").trim().toLowerCase();
    return accountRows().find(account => [account.id, account.userKey, account.code, account.ownerKey].some(value => String(value || "") === id))
      || accountRows().find(account => name && String(account.name || "").trim().toLowerCase() === name)
      || person || {};
  }

  function publicContact(person, account = {}) {
    if (!person?.shareTelegram) return { username:"", telegram:"", shareTelegram:false };
    const nick = person.username || person.telegram || account.telegram || account.username || "";
    return { username:nick, telegram:nick, shareTelegram:Boolean(nick) };
  }

  function publicPeople() {
    const me = String(social.myId());
    const saved = originalPeople();
    const map = new Map(saved.map(person => [String(person.id), { ...person }]));
    for (const account of accountRows()) {
      const id = String(account.id || account.userKey || account.code || account.ownerKey || "");
      if (!id || id === me) continue;
      const previous = map.get(id) || {};
      const contact = publicContact(previous, account);
      map.set(id, {
        ...account,
        ...previous,
        id,
        name: previous.name || account.name || "Гость BALI",
        photo: previous.photo || account.avatar || account.photo || "",
        bio: previous.bio || account.bio || "Пользователь BALI",
        status: previous.status === "closed" ? "chat" : (previous.status || "chat"),
        active: true,
        ...contact,
        phone: ""
      });
    }
    return [...map.values()].filter(person => String(person.id) !== me).map(person => {
      const contact = publicContact(person, person);
      return {
        ...person,
        active: true,
        status: person.status === "closed" ? "chat" : (person.status || "chat"),
        ...contact,
        phone: ""
      };
    });
  }

  social.profile = () => {
    const profile = originalProfile();
    return { ...profile, active:true, status:profile.status === "closed" ? "chat" : profile.status };
  };
  social.visiblePeople = publicPeople;
  social.incomingThumbs = () => publicPeople().filter(person => social.hasThumb(person.id, social.myId()));
  social.connections = () => publicPeople().filter(person => social.isConnection(person.id));

  function rankingData(person) {
    const account = accountFor(person);
    const ranking = game?.ranking?.(accountRows()) || [];
    const index = ranking.findIndex(row => [row.id,row.userKey,row.code,row.ownerKey].some(value => String(value || "") === String(account.id || account.userKey || account.code || account.ownerKey || person.id))
      || (person.name && String(row.name || "").trim().toLowerCase() === String(person.name).trim().toLowerCase()));
    const row = index >= 0 ? ranking[index] : account;
    return { account, place:Number(row?.position || (index >= 0 ? index + 1 : 0)), xp:Number(row?.xp || account.xp || 0), visits:Number(row?.visits || account.visits || 0), level:row?.level?.name || row?.levelName || row?.level || game?.levelFor?.(Number(row?.xp || account.xp || 0))?.current?.name || "BALI Guest" };
  }

  function rewardData(person, account) {
    const keys = new Set([person.id,account.id,account.userKey,account.code,account.ownerKey].filter(Boolean).map(String));
    const grants = (loyalty?.grants?.() || []).filter(grant => !grant.revokedAt && keys.has(String(grant.userKey || "")));
    const rewards = loyalty?.rewards?.() || [];
    return grants.map(grant => ({ ...rewards.find(reward => String(reward.id) === String(grant.rewardId)), ...grant }));
  }

  function styles() {
    if (document.getElementById("baliPeoplePublicCardsStyle")) return;
    const style = document.createElement("style");
    style.id = "baliPeoplePublicCardsStyle";
    style.textContent = `.person-v2-photo.is-locked img,.person-v2-photo.is-locked .person-v2-placeholder{filter:none!important;transform:none!important}.person-v2-lock{display:none!important}.person-v2-photo{cursor:pointer}.bali-people-public-note{margin:10px 0 0;padding:9px 11px;border:1px solid var(--line);border-radius:13px;color:var(--muted);font-size:8px;line-height:1.5}.bali-people-public-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:13px}.bali-people-public-stats article{padding:10px 7px;border:1px solid var(--line);border-radius:13px;background:#ffffff05;text-align:center}.bali-people-public-stats span{display:block;color:var(--muted);font-size:7px}.bali-people-public-stats strong{display:block;margin-top:5px;color:var(--lime);font:600 14px Unbounded}.bali-people-public-level{margin-top:9px;padding:10px;border:1px solid rgba(200,255,61,.2);border-radius:13px;background:rgba(200,255,61,.06);font-size:9px}.bali-people-rewards{display:grid;gap:7px;margin-top:13px}.bali-people-rewards h3{margin:0 0 2px;font-size:12px}.bali-people-reward{display:grid;grid-template-columns:38px 1fr;gap:9px;align-items:center;padding:9px;border:1px solid var(--line);border-radius:13px;background:#ffffff04}.bali-people-reward i{width:38px;height:38px;display:grid;place-items:center;border-radius:11px;background:#c8ff3d12;color:var(--lime);font-style:normal}.bali-people-reward strong{font-size:9px}.bali-people-reward small{display:block;margin-top:3px;color:var(--muted);font-size:7px}@media(max-width:360px){.bali-people-public-stats{grid-template-columns:1fr}}`;
    document.head.appendChild(style);
  }

  function enhancePublicCard(id) {
    const body = document.getElementById("socialPersonBody");
    if (!body) return;
    const person = publicPeople().find(item => String(item.id) === String(id));
    if (!person) return;
    const data = rankingData(person);
    const rewards = rewardData(person,data.account);
    body.querySelector(".bali-people-public-details")?.remove();
    const contactNote = person.shareTelegram ? "Telegram-ник открыт пользователем и доступен выше." : "Telegram-ник скрыт настройками пользователя.";
    body.insertAdjacentHTML("beforeend", `<section class="bali-people-public-details"><div class="bali-people-public-note">${contactNote} Телефон другим пользователям не показывается.</div><div class="bali-people-public-stats"><article><span>МЕСТО</span><strong>${data.place ? `#${data.place}` : "—"}</strong></article><article><span>ПОСЕЩЕНИЯ</span><strong>${data.visits}</strong></article><article><span>XP</span><strong>${data.xp}</strong></article></div><div class="bali-people-public-level">Текущий уровень: <b>${esc(data.level)}</b></div><div class="bali-people-rewards"><h3>Награды пользователя</h3>${rewards.length ? rewards.map(reward => `<article class="bali-people-reward"><i>${reward.image ? `<img src="${esc(reward.image)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:10px">` : "🏆"}</i><div><strong>${esc(reward.title || reward.rewardTitle || "Награда BALI")}</strong><small>${esc(reward.description || reward.source || "Получена в BALI")}</small></div></article>`).join("") : '<div class="social-v2-empty">Наград пока нет</div>'}</div></section>`);
  }

  document.addEventListener("click", event => { const card=event.target.closest("[data-open-social-person]"); if(card&&!event.target.closest("button"))setTimeout(()=>enhancePublicCard(card.dataset.openSocialPerson),0); });
  window.addEventListener("bali:social-changed",()=>setTimeout(()=>document.querySelectorAll(".person-v2-lock").forEach(node=>node.remove()),0));
  styles();
  window.dispatchEvent(new CustomEvent("bali:social-changed"));
})();