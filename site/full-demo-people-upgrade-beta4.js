(() => {
  if (window.__BALI_FULL_DEMO_PEOPLE_UPGRADE__) return;
  window.__BALI_FULL_DEMO_PEOPLE_UPGRADE__ = true;

  const social = window.BaliBeta4Social;
  const game = window.BaliBeta4Game;
  const points = window.BaliPoints;
  const loyalty = window.BaliBeta4Loyalty;
  if (!social || !game || !points) return;

  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
  const normalize = value => String(value || "").toLocaleLowerCase("ru").replace(/^@/, "").replace(/[^\p{L}\p{N}+]+/gu, " ").trim();
  const digits = value => String(value || "").replace(/\D/g, "");
  const fmt = value => value ? new Date(value).toLocaleString("ru-RU", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" }) : "—";
  const originalVisiblePeople = social.visiblePeople?.bind(social);

  social.visiblePeople = () => social.people().filter(person => String(person.id) !== String(social.myId()) && person.active === true);

  function viewerHasVip() { return Boolean(game.vip?.()); }
  function ageFor(person = {}) {
    const explicit = Number(person.age || 0);
    if (explicit >= 18 && explicit <= 99) return explicit;
    const raw = person.birthDate || person.birth_date || person.birthday || "";
    if (!raw) return 0;
    const birth = new Date(`${String(raw).slice(0,10)}T12:00:00`);
    if (Number.isNaN(birth.getTime())) return 0;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age -= 1;
    return age >= 18 && age <= 99 ? age : 0;
  }
  function genderFor(person = {}) {
    const value = normalize(person.gender || person.sex || "");
    if (["female","f","woman","женщина","женский"].includes(value)) return "female";
    if (["male","m","man","мужчина","мужской"].includes(value)) return "male";
    return "unknown";
  }
  function accountFor(person = {}) {
    const accounts = Object.values(points.accounts?.() || {});
    const id = String(person.id || person.userKey || person.user_key || "");
    const phone = digits(person.phone);
    const name = normalize(person.name);
    return accounts.find(row => String(row.userKey || row.id || "") === id)
      || accounts.find(row => phone && digits(row.phone) === phone)
      || accounts.find(row => name && normalize(row.name) === name)
      || person;
  }
  function identityKeys(person = {}, account = accountFor(person)) {
    const values = new Set();
    [person.id,person.userKey,person.user_key,person.ownerKey,person.owner_key,person.code,account.id,account.userKey,account.user_key,account.ownerKey,account.code]
      .filter(Boolean).forEach(value => values.add(String(value)));
    const phone = digits(person.phone || account.phone);
    if (phone) values.add(`phone:${phone}`);
    return values;
  }
  function activeVip(person) {
    const account = accountFor(person), keys = identityKeys(person, account);
    const gift = game.vipGifts().filter(row => !row.revokedAt && new Date(row.expiresAt).getTime() > Date.now() && row.targetKeys?.some(key => keys.has(String(key))))
      .sort((a,b)=>String(b.expiresAt).localeCompare(String(a.expiresAt)))[0];
    if (!gift) return null;
    return { ...gift, plan:game.config().plans.find(row => String(row.id) === String(gift.planId)) };
  }
  function rewardsFor(person) {
    if (!loyalty) return [];
    const keys = identityKeys(person);
    const rewards = new Map(loyalty.rewards().map(row => [String(row.id), row]));
    return loyalty.grants().filter(row => !row.revokedAt && keys.has(String(row.userKey))).map(row => ({ ...row, reward:rewards.get(String(row.rewardId)) })).sort((a,b)=>String(b.earnedAt||"").localeCompare(String(a.earnedAt||"")));
  }
  function visitsFor(person) {
    const keys = identityKeys(person);
    return Object.values(read("bali_event_checkins_v1", {})).filter(row => keys.has(String(row.user_key || ""))).sort((a,b)=>String(b.checked_in_at||"").localeCompare(String(a.checked_in_at||"")));
  }
  function privacyMode(person, field) {
    const direct = person?.privacy?.[field] || person?.[`privacy${field[0].toUpperCase()}${field.slice(1)}`];
    if (["public","vip","private"].includes(direct)) return direct;
    if (field === "phone") return person.sharePhone === true ? "public" : "private";
    if (field === "telegram") return person.shareTelegram === true ? "public" : "private";
    if (field === "age") return person.shareAge === true ? "public" : "private";
    if (field === "photo") return person.showPhoto === true ? "public" : "private";
    return "private";
  }
  function canSee(person, field) {
    const mode = privacyMode(person, field);
    if (mode === "public") return true;
    if (mode === "vip") return viewerHasVip();
    return false;
  }

  function styles() {
    if (document.getElementById("fullDemoPeopleUpgradeStyle")) return;
    const style = document.createElement("style");
    style.id = "fullDemoPeopleUpgradeStyle";
    style.textContent = `
      .people-current-event{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;margin-bottom:11px;padding:14px;border:1px solid var(--line);border-radius:17px;background:#ffffff05;color:#9ba39e;text-align:left}
      .people-current-event.active{border-color:rgba(200,255,61,.42);background:linear-gradient(145deg,rgba(200,255,61,.12),rgba(255,255,255,.03));color:#fff;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.22)}
      .people-current-event small{display:block;color:var(--muted);font-size:8px;font-weight:900;letter-spacing:.1em}.people-current-event strong{display:block;margin-top:5px;font-size:13px}.people-current-event b{color:var(--lime);font:600 18px Unbounded}
      .people-detail-section{display:grid;gap:8px;margin-top:12px;padding:12px;border:1px solid var(--line);border-radius:15px;background:#ffffff05}.people-detail-section h3{margin:0;font-size:12px}.people-detail-list{display:grid;gap:6px}.people-detail-row{display:flex;justify-content:space-between;gap:10px;padding:8px;border-radius:11px;background:#0002;color:#d8dfda;font-size:9px}.people-detail-row span{color:var(--muted)}
      .people-public-badges{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.people-public-badges span{display:inline-flex;align-items:center;min-height:25px;padding:0 8px;border:1px solid rgba(200,255,61,.25);border-radius:999px;background:rgba(200,255,61,.07);color:var(--lime);font-size:8px;font-weight:900}.people-public-badges .vip{border-color:rgba(242,205,102,.42);background:rgba(242,205,102,.1);color:#f2cd66}
      .people-reward-mini{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}.people-reward-mini span{min-width:27px;min-height:27px;display:grid;place-items:center;border:1px solid var(--line);border-radius:9px;background:#ffffff06;font-size:14px}
      .profile-invite-columns{display:grid;grid-template-columns:1fr 1fr;gap:10px}.profile-invite-column{display:grid;align-content:start;gap:8px}.profile-invite-column>h3{font-size:13px}.privacy-vip-note{padding:10px;border:1px solid rgba(242,205,102,.25);border-radius:13px;background:rgba(242,205,102,.07);color:#ddc980;font-size:8px;line-height:1.5}
      @media(max-width:600px){.profile-invite-columns{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function decorateCard(card, person) {
    if (!card || !person) return;
    const body = card.querySelector(".person-v2-body"), photo = card.querySelector(".person-v2-photo");
    if (!body || !photo) return;
    const account = accountFor(person), vip = activeVip(person), rewards = rewardsFor(person);
    const searchable = [person.name];
    if (canSee(person,"telegram")) searchable.push(person.username);
    if (canSee(person,"phone")) searchable.push(person.phone);
    card.dataset.peopleSearch = normalize(searchable.join(" "));
    card.dataset.peopleAge = String(ageFor(person) || 0);
    card.dataset.peopleGender = genderFor(person);
    const unlocked = canSee(person,"photo");
    photo.classList.toggle("is-locked", !unlocked);
    if (unlocked) photo.querySelector(".person-v2-lock")?.remove();
    else if (!photo.querySelector(".person-v2-lock")) photo.insertAdjacentHTML("beforeend", '<div class="person-v2-lock">Фото скрыто настройками конфиденциальности</div>');
    let badges = body.querySelector(".people-public-badges");
    if (!badges) { badges = document.createElement("div"); badges.className = "people-public-badges"; body.querySelector(".person-v2-actions")?.insertAdjacentElement("beforebegin", badges); }
    badges.innerHTML = `${vip ? `<span class="vip">${esc(vip.plan?.name || vip.planId || "VIP")}</span>` : ""}${canSee(person,"points") ? `<span>${Number(account.balance || 0)} баллов</span>` : ""}${rewards.length ? `<span>🏆 ${rewards.length}</span>` : ""}`;
    let mini = body.querySelector(".people-reward-mini");
    if (rewards.length) {
      if (!mini) { mini = document.createElement("div"); mini.className = "people-reward-mini"; badges.insertAdjacentElement("afterend", mini); }
      mini.innerHTML = rewards.slice(0,6).map(row => `<span title="${esc(row.reward?.title || "Награда BALI")}">${esc(row.reward?.icon || "🏆")}</span>`).join("");
    } else mini?.remove();
  }

  function decorateCards() {
    const rows = social.visiblePeople();
    document.querySelectorAll("[data-open-social-person]").forEach(card => decorateCard(card, rows.find(person => String(person.id) === String(card.dataset.openSocialPerson))));
    const input = document.getElementById("baliPeopleNameSearch");
    if (input) input.placeholder = "Имя, Telegram или телефон";
  }

  function activeCheckins(eventId) {
    return Object.values(read("bali_event_checkins_v1", {})).filter(row => String(row.event_id) === String(eventId) && !row.left_at && row.presence_status !== "left");
  }
  function mountCurrentEvent() {
    const tabs = document.querySelector('[data-screen="dating"] .social-tabs-v2');
    if (!tabs) return;
    let card = document.getElementById("peopleCurrentEvent");
    if (!card) {
      card = document.createElement("button");
      card.type = "button";
      card.id = "peopleCurrentEvent";
      card.className = "people-current-event";
      tabs.before(card);
    }
    const event = window.BaliFullDemoEvents?.activeEvents?.()[0] || null;
    if (!event) {
      card.disabled = true;
      card.classList.remove("active");
      card.removeAttribute("data-open-current-event");
      card.innerHTML = '<div><small>СЕЙЧАС В BALI</small><strong>Активного мероприятия нет</strong></div><b>0</b>';
      return;
    }
    const count = activeCheckins(event.id).length;
    card.disabled = false;
    card.classList.add("active");
    card.dataset.openCurrentEvent = event.id;
    card.innerHTML = `<div><small>СЕЙЧАС В BALI · НАЖМИТЕ, ЧТОБЫ ПОСМОТРЕТЬ</small><strong>${esc(event.title)}</strong></div><b>${count}</b>`;
    const inside = document.querySelector('[data-social-v2-tab="inside"]');
    if (inside) inside.textContent = `Уже пришли · ${count}`;
  }

  async function decorateDialog(personId) {
    const body = document.getElementById("socialPersonBody");
    const person = social.visiblePeople().find(row => String(row.id) === String(personId));
    if (!body || !person) return;
    const vip = activeVip(person), rewards = rewardsFor(person), visits = visitsFor(person), account = accountFor(person);
    body.querySelector("#fullPeopleDetails")?.remove();
    let crown = { miss:0, mister:0 };
    try { crown = await window.BaliCrownWinCards?.winCounts?.(person) || crown; } catch {}
    body.insertAdjacentHTML("beforeend", `<div id="fullPeopleDetails"><section class="people-detail-section"><h3>О пользователе</h3><div class="people-detail-list"><div class="people-detail-row"><span>Статус пользователя</span><strong>${esc(social.statusText?.(person.status) || person.status || "Не указан")}</strong></div><div class="people-detail-row"><span>Уровень BALI</span><strong>${esc(vip?.plan?.name || game.levelFor(Number(account.xp || 0)).current.name)}</strong></div>${canSee(person,"age") && ageFor(person) ? `<div class="people-detail-row"><span>Возраст</span><strong>${ageFor(person)} лет</strong></div>` : ""}${canSee(person,"telegram") && person.username ? `<div class="people-detail-row"><span>Telegram</span><strong>${esc(person.username)}</strong></div>` : ""}${canSee(person,"phone") && person.phone ? `<div class="people-detail-row"><span>Телефон</span><strong>${esc(person.phone)}</strong></div>` : ""}${canSee(person,"points") ? `<div class="people-detail-row"><span>BALI-баллы</span><strong>${Number(account.balance || 0)}</strong></div>` : ""}</div></section><section class="people-detail-section"><h3>Награды и победы</h3><div class="people-detail-list">${rewards.map(row => `<div class="people-detail-row"><span>${esc(row.reward?.icon || "🏆")} ${esc(row.reward?.title || "Награда BALI")}</span><strong>${esc(fmt(row.earnedAt))}</strong></div>`).join("") || '<div class="people-detail-row"><span>Награды</span><strong>Пока нет</strong></div>'}${crown.miss ? `<div class="people-detail-row"><span>👑 Королева BALI</span><strong>${crown.miss}×</strong></div>` : ""}${crown.mister ? `<div class="people-detail-row"><span>👑 Король BALI</span><strong>${crown.mister}×</strong></div>` : ""}</div></section><section class="people-detail-section"><h3>История посещений</h3><div class="people-detail-list">${visits.slice(0,20).map(row => `<div class="people-detail-row"><span>${esc(row.event_title || "Мероприятие BALI")}</span><strong>${esc(fmt(row.checked_in_at))}</strong></div>`).join("") || '<div class="people-detail-row"><span>Посещений пока нет</span><strong>—</strong></div>'}</div></section></div>`);
  }

  function injectPrivacySettings() {
    const form = document.getElementById("profileV2SettingsForm");
    if (!form || form.querySelector('[name="privacyAge"]')) return;
    const person = social.profile();
    const submit = form.querySelector("button[type=submit]");
    const wrapper = document.createElement("div");
    const options = selected => [["public","Видно всем"],["vip","Видно VIP-пользователям"],["private","Скрыто от всех"]].map(([value,label]) => `<option value="${value}" ${selected === value ? "selected" : ""}>${label}</option>`).join("");
    wrapper.innerHTML = `${viewerHasVip() ? '<div class="privacy-vip-note">VIP не обходит конфиденциальность: он видит только поля с режимом «Видно VIP-пользователям».</div>' : ""}<label><span>Кому виден мой возраст</span><select name="privacyAge">${options(privacyMode(person,"age"))}</select></label><label><span>Кому видно моё фото</span><select name="privacyPhoto">${options(privacyMode(person,"photo"))}</select></label><label><span>Кому видны мои BALI-баллы</span><select name="privacyPoints">${options(privacyMode(person,"points"))}</select></label>`;
    while (wrapper.firstChild) submit?.insertAdjacentElement("beforebegin", wrapper.firstChild);
  }

  function requestStatus(value) { return value === "accepted" ? "Принято" : value === "declined" ? "Отклонено" : "Ожидает ответа"; }
  function renderInviteCenter() {
    const root = document.getElementById("profileInvitationsBody");
    if (!root) return;
    const me = String(social.myId()), rows = social.requests().filter(row => social.isRequestActive?.(row) !== false);
    const incoming = rows.filter(row => String(row.toId) === me);
    const outgoing = rows.filter(row => String(row.fromId) === me);
    const card = (row, incomingMode) => `<article class="profile-invite-card"><header><div><h3>${esc(row.eventTitle || "Мероприятие BALI")}</h3><p>${incomingMode ? `От: <strong>${esc(row.fromName || "Пользователь BALI")}</strong>` : `Кому: <strong>${esc(row.toName || "Пользователь BALI")}</strong>`}</p></div><span class="${esc(row.status || "pending")}">${requestStatus(row.status)}</span></header><p>${esc(row.eventDate || "")} · ${esc(row.eventTime || "23:00")}</p>${incomingMode ? `<div class="profile-invite-actions"><button type="button" class="secondary accept" data-profile-invite-response="${esc(row.id)}:accepted">Принять</button><button type="button" class="secondary decline" data-profile-invite-response="${esc(row.id)}:declined">Отклонить</button></div>` : ""}</article>`;
    root.innerHTML = `<div class="profile-invite-columns"><section class="profile-invite-column"><h3>Кто пригласил меня · ${incoming.length}</h3>${incoming.map(row => card(row,true)).join("") || '<div class="empty">Входящих приглашений нет</div>'}</section><section class="profile-invite-column"><h3>Кого пригласил я · ${outgoing.length}</h3>${outgoing.map(row => card(row,false)).join("") || '<div class="empty">Вы ещё никого не приглашали</div>'}</section></div>`;
  }

  function filterByExtendedSearch() {
    const input = document.getElementById("baliPeopleNameSearch");
    if (!input) return;
    const query = normalize(input.value);
    const gender = document.getElementById("baliPeopleGender")?.value || "all";
    const min = Number(document.getElementById("baliPeopleAgeMin")?.value || 18);
    const max = Number(document.getElementById("baliPeopleAgeMax")?.value || 99);
    const useAge = min > 18 || max < 99;
    document.querySelectorAll("[data-open-social-person]").forEach(card => {
      const age = Number(card.dataset.peopleAge || 0);
      card.hidden = !((!query || String(card.dataset.peopleSearch || "").includes(query)) && (gender === "all" || card.dataset.peopleGender === gender) && (!useAge || (age && age >= Math.min(min,max) && age <= Math.max(min,max))));
    });
  }

  let scheduled = false;
  function refresh() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      styles();
      mountCurrentEvent();
      injectPrivacySettings();
      decorateCards();
      filterByExtendedSearch();
      if (document.getElementById("profileInvitationsDialog")?.open) renderInviteCenter();
    });
  }

  document.addEventListener("click", event => {
    const personCard = event.target.closest("[data-open-social-person]");
    if (personCard && !event.target.closest("button")) setTimeout(() => decorateDialog(personCard.dataset.openSocialPerson), 0);
    if (event.target.closest("[data-open-current-event]")) document.querySelector('[data-social-v2-tab="inside"]')?.click();
    if (event.target.closest("[data-page=\"dating\"],[data-social-v2-tab]")) setTimeout(refresh, 0);
    if (event.target.closest("[data-open-profile-settings]")) setTimeout(injectPrivacySettings, 0);
    if (event.target.closest("[data-open-profile-invitations]")) setTimeout(renderInviteCenter, 0);
    if (event.target.closest("[data-profile-invite-response]")) setTimeout(renderInviteCenter, 20);
  }, true);
  document.addEventListener("submit", event => {
    if (event.target.id !== "profileV2SettingsForm") return;
    const profile = social.profile();
    social.saveProfile({ privacy:{ ...(profile.privacy || {}), age:event.target.elements.privacyAge?.value || "private", photo:event.target.elements.privacyPhoto?.value || "private", points:event.target.elements.privacyPoints?.value || "private" } });
  }, true);
  document.addEventListener("input", event => {
    if (["baliPeopleNameSearch","baliPeopleAgeMin","baliPeopleAgeMax"].includes(event.target.id)) requestAnimationFrame(filterByExtendedSearch);
  });
  document.addEventListener("change", event => {
    if (event.target.id === "baliPeopleGender") requestAnimationFrame(filterByExtendedSearch);
  });

  ["bali:full-demo-ready","bali:full-demo-enhancements-ready","bali:social-changed","bali:points-changed","bali:beta4-changed","bali:loyalty-changed","bali:checkin-complete","bali:checkin-left"].forEach(name => window.addEventListener(name, refresh));
  setInterval(mountCurrentEvent, 30000);
  styles();
  refresh();
  window.BaliFullDemoPeople = { viewerHasVip, canSee, activeVip, rewardsFor, visitsFor, renderInviteCenter, mountCurrentEvent, originalVisiblePeople };
})();
