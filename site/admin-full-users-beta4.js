(() => {
  if (window.__BALI_ADMIN_FULL_USERS__) return;
  window.__BALI_ADMIN_FULL_USERS__ = true;

  const store = window.BaliStore;
  const points = window.BaliPoints;
  const game = window.BaliBeta4Game;
  const appUsers = window.BaliAppUsers;
  if (!store || !points || !game) return;

  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const write = (key, value) => { localStorage.setItem(key, JSON.stringify(value)); window.dispatchEvent(new CustomEvent("bali:social-changed")); };
  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
  const norm = value => String(value || "").trim().replace(/^@/,"").toLocaleLowerCase("ru");
  const digits = value => String(value || "").replace(/\D/g, "");
  const GIFT_CATALOG = [
    {id:"rose",icon:"🌹",name:"Роза"},{id:"cocktail",icon:"🍸",name:"Коктейль"},{id:"disco",icon:"🪩",name:"Диско-шар"},{id:"crown",icon:"👑",name:"VIP-корона"}
  ];
  let allRows = [];
  let activeGiftSubject = null;

  function ageFor(row = {}) {
    const explicit = Number(row.age || 0);
    if (explicit >= 18 && explicit <= 99) return explicit;
    const raw = row.birth_date || row.birthDate || row.birthday || "";
    if (!raw) return 0;
    const birth = new Date(`${String(raw).slice(0,10)}T12:00:00`);
    if (Number.isNaN(birth.getTime())) return 0;
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age -= 1;
    return age;
  }
  function mergeMatch(left = {}, right = {}) {
    const leftIds = [left.id,left.user_key,left.userKey,left.ownerKey,left.code].filter(Boolean).map(String);
    const rightIds = [right.id,right.user_key,right.userKey,right.ownerKey,right.code].filter(Boolean).map(String);
    if (leftIds.some(id => rightIds.includes(id))) return true;
    const lp = digits(left.phone), rp = digits(right.phone);
    if (lp && rp && lp === rp) return true;
    return Boolean(left.name && right.name && norm(left.name) === norm(right.name));
  }
  function vipFor(row) {
    const ids = new Set([row.id,row.user_key,row.userKey,row.ownerKey,row.code].filter(Boolean).map(String));
    const phone = digits(row.phone); if (phone) ids.add(`phone:${phone}`);
    const gift = game.vipGifts().filter(item => !item.revokedAt && new Date(item.expiresAt).getTime() > Date.now() && item.targetKeys?.some(key => ids.has(String(key))))
      .sort((a,b)=>String(b.expiresAt).localeCompare(String(a.expiresAt)))[0];
    if (!gift) return null;
    return { ...gift, plan:game.config().plans.find(plan => String(plan.id) === String(gift.planId)) };
  }
  function rewardCount(row) {
    const keys = new Set([row.id,row.user_key,row.userKey,row.ownerKey,row.code].filter(Boolean).map(String));
    return read("bali_beta4_reward_grants_v1", []).filter(grant => !grant.revokedAt && keys.has(String(grant.userKey))).length;
  }

  async function unifiedUsers() {
    const [customers, users] = await Promise.all([store.list("customers"), appUsers?.listAdmin?.() || Promise.resolve([])]);
    const sources = [
      ...read("bali_social_people_v1", []),
      ...users,
      ...Object.values(points.accounts?.() || {}),
      ...customers
    ];
    const rows = [];
    sources.forEach(source => {
      const index = rows.findIndex(row => mergeMatch(row, source));
      if (index >= 0) rows[index] = { ...rows[index], ...source, id:rows[index].id || source.id || source.user_key || source.userKey };
      else rows.push({ ...source, id:source.id || source.user_key || source.userKey || source.code || `crm-${rows.length}` });
    });
    return rows.map(row => {
      const account = Object.values(points.accounts?.() || {}).find(item => mergeMatch(item,row)) || {};
      const vip = vipFor({ ...account, ...row });
      return { ...account, ...row, balance:Number(account.balance ?? row.balance ?? 0), age:ageFor(row), vip, rewards:rewardCount({ ...account,...row }) };
    }).sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""),"ru"));
  }

  function styles() {
    if (document.getElementById("adminFullUsersStyle")) return;
    const style = document.createElement("style");
    style.id = "adminFullUsersStyle";
    style.textContent = `
      .admin-user-filters{display:grid;grid-template-columns:minmax(220px,2fr) repeat(4,minmax(110px,1fr));gap:8px;width:100%;margin-top:10px}.admin-user-filters input,.admin-user-filters select{min-height:42px;padding:0 10px;border:1px solid var(--line);border-radius:12px;background:#101412;color:#fff}.admin-user-filter-age{display:grid;grid-template-columns:1fr 12px 1fr;gap:5px;align-items:center}.admin-user-filter-age b{text-align:center;color:var(--muted)}
      .crm-vip{display:inline-flex;padding:4px 7px;border:1px solid rgba(242,205,102,.35);border-radius:999px;background:rgba(242,205,102,.08);color:#f2cd66;font-size:8px;font-weight:900}.crm-none{color:var(--muted);font-size:8px}.admin-gift-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.admin-gift-grid button{display:grid;gap:5px;padding:12px;border:1px solid var(--line);border-radius:13px;background:#ffffff06;color:#fff}.admin-gift-grid i{font-style:normal;font-size:25px}.admin-gift-grid small{color:var(--muted)}
      @media(max-width:1050px){.admin-user-filters{grid-template-columns:1fr 1fr 1fr}.admin-user-filters>input:first-child{grid-column:1/-1}}@media(max-width:620px){.admin-user-filters{grid-template-columns:1fr}.admin-user-filters>input:first-child{grid-column:auto}.admin-gift-grid{grid-template-columns:1fr 1fr}}
    `;
    document.head.appendChild(style);
  }

  function table(rows) {
    return rows.length ? `<table class="data-table"><thead><tr><th>Пользователь</th><th>Контакты</th><th>Возраст / пол</th><th>Баллы</th><th>VIP</th><th>Награды</th><th></th></tr></thead><tbody>${rows.map(row => `<tr data-open-customer-dossier="${esc(row.id)}"><td><strong class="admin-user-link">${esc(row.name || "Гость BALI")}</strong><br><small>${esc(row.bio || row.notes || "Без заметок")}</small></td><td><strong>${esc(row.phone || "—")}</strong><br><small>${esc(row.telegram || row.username || "—")}</small></td><td>${row.age ? `${row.age} лет` : "—"}<br><small>${row.gender === "female" ? "Женский" : row.gender === "male" ? "Мужской" : "Не указан"}</small></td><td><strong>${Number(row.balance || 0)}</strong></td><td>${row.vip ? `<span class="crm-vip">${esc(row.vip.plan?.name || row.vip.planId)}</span>` : '<span class="crm-none">Нет</span>'}</td><td>${Number(row.rewards || 0)}</td><td><button class="icon-btn" type="button" data-open-customer-dossier="${esc(row.id)}">Открыть</button></td></tr>`).join("")}</tbody></table>` : '<div class="empty">Пользователи не найдены</div>';
  }

  function applyFilters() {
    const q = norm(document.getElementById("adminUserSearch")?.value);
    const gender = document.getElementById("adminUserGender")?.value || "all";
    const vip = document.getElementById("adminUserVip")?.value || "all";
    const min = Number(document.getElementById("adminUserAgeMin")?.value || 18);
    const max = Number(document.getElementById("adminUserAgeMax")?.value || 99);
    const rows = allRows.filter(row => {
      const haystack = norm(`${row.name||""} ${row.phone||""} ${row.telegram||row.username||""}`);
      return (!q || haystack.includes(q)) && (gender === "all" || row.gender === gender) && (vip === "all" || (vip === "yes" ? Boolean(row.vip) : !row.vip)) && (!row.age || (row.age >= Math.min(min,max) && row.age <= Math.max(min,max)));
    });
    const root = document.getElementById("adminUsersTable");
    if (root) root.innerHTML = table(rows);
  }

  async function renderFullUsers(root) {
    styles();
    allRows = await unifiedUsers();
    root.innerHTML = `<section class="panel"><div class="panel-head"><div><h3>Все пользователи BALI</h3><small>${allRows.length} пользователей · администратору доступна полная информация</small></div></div><div class="admin-user-filters"><input id="adminUserSearch" placeholder="Имя, телефон или Telegram"><select id="adminUserGender"><option value="all">Любой пол</option><option value="female">Женский</option><option value="male">Мужской</option></select><div class="admin-user-filter-age"><input id="adminUserAgeMin" type="number" min="18" max="99" value="18"><b>—</b><input id="adminUserAgeMax" type="number" min="18" max="99" value="99"></div><select id="adminUserVip"><option value="all">Все статусы</option><option value="yes">Только VIP</option><option value="no">Без VIP</option></select><button class="ghost" type="button" id="adminUserReset">Сбросить</button></div><div id="adminUsersTable">${table(allRows)}</div></section>`;
    ["adminUserSearch","adminUserAgeMin","adminUserAgeMax"].forEach(id => document.getElementById(id)?.addEventListener("input",applyFilters));
    ["adminUserGender","adminUserVip"].forEach(id => document.getElementById(id)?.addEventListener("change",applyFilters));
    document.getElementById("adminUserReset")?.addEventListener("click",()=>renderFullUsers(root));
  }

  if (typeof window.renderCustomers === "function") window.renderCustomers = renderFullUsers;

  const dossier = window.BaliAdminCustomerDossier;
  if (dossier?.open && dossier?.resolve && !dossier.__adminGiftsWrapped) {
    dossier.__adminGiftsWrapped = true;
    const originalOpen = dossier.open.bind(dossier);
    dossier.open = async ref => {
      activeGiftSubject = await dossier.resolve(ref);
      await originalOpen(ref);
      const body = document.getElementById("customerDossierBody");
      if (!body || !activeGiftSubject) return;
      body.querySelector("#adminUserGifts")?.remove();
      body.insertAdjacentHTML("beforeend", `<section class="customer-dossier-card" id="adminUserGifts"><h3>Подарить подарок</h3><div class="admin-gift-grid">${GIFT_CATALOG.map(gift => `<button type="button" data-admin-user-gift="${esc(gift.id)}"><i>${gift.icon}</i><strong>${esc(gift.name)}</strong><small>От администрации BALI</small></button>`).join("")}</div></section>`);
    };
  }

  function targetSocialId(subject) {
    const people = read("bali_social_people_v1", []);
    return people.find(person => mergeMatch(person,subject))?.id || subject.user_key || subject.userKey || subject.id;
  }
  document.addEventListener("click", event => {
    const giftButton = event.target.closest("[data-admin-user-gift]");
    if (!giftButton || !activeGiftSubject) return;
    const gift = GIFT_CATALOG.find(item => item.id === giftButton.dataset.adminUserGift);
    if (!gift) return;
    const rows = read("bali_social_gifts_v1", []);
    rows.unshift({ id:`admin-gift-${crypto.randomUUID?.() || Date.now()}`, fromId:"bali-admin", fromName:"Администрация BALI", toId:targetSocialId(activeGiftSubject), toName:activeGiftSubject.name || "Гость BALI", giftId:gift.id, giftName:gift.name, icon:gift.icon, source:"admin_gift", createdAt:new Date().toISOString() });
    write("bali_social_gifts_v1", rows.slice(0,1000));
    window.toast?.(`Подарок «${gift.name}» отправлен`);
  }, true);

  styles();
  window.BaliAdminFullUsers = { unifiedUsers, renderFullUsers, applyFilters };
})();