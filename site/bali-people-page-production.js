(() => {
  if (window.__BALI_PEOPLE_PAGE_PRODUCTION__) return;
  window.__BALI_PEOPLE_PAGE_PRODUCTION__ = true;

  const social = window.BaliBeta4Social;
  const cloud = window.BaliSocialCloud;
  const attendance = window.BaliEventQrAttendance;
  const store = window.BaliStore;
  const points = window.BaliPoints;
  const game = window.BaliBeta4Game;
  const tg = window.Telegram?.WebApp;
  if (!social || !game) return;

  let activeTab = "all";
  let directory = [];
  let presence = [];
  let activePersonId = "";
  let activeEvents = [];
  let refreshPromise = null;
  let renderQueued = false;
  let lastHtml = "";

  const byId = id => document.getElementById(id);
  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;"
  })[char]);
  const initials = name => String(name || "B").trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
  const toast = message => {
    const node = byId("toast");
    if (!node) return;
    node.textContent = String(message || "");
    node.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove("show"), 2200);
  };

  function ensureStyle() {
    if (byId("baliPeoplePageProductionStyle")) return;
    const style = document.createElement("style");
    style.id = "baliPeoplePageProductionStyle";
    style.textContent = `
      .social-tabs-v2{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-bottom:12px}
      .social-tabs-v2 button{min-height:42px;padding:5px 7px;border:1px solid var(--line);border-radius:13px;background:#ffffff08;color:var(--muted);font-size:8px;line-height:1.2}
      .social-tabs-v2 button.active{background:var(--lime);color:#090b08}
      .people-v2-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      .person-v2{overflow:hidden;border:1px solid var(--line);border-radius:18px;background:#111413}
      .person-v2-photo{position:relative;aspect-ratio:4/5;overflow:hidden;background:#1a1e1b}
      .person-v2-photo img{width:100%;height:100%;object-fit:cover}
      .person-v2-placeholder{height:100%;display:grid;place-items:center;font:600 36px Unbounded;color:var(--lime)}
      .person-v2-status{position:absolute;left:8px;right:8px;bottom:8px;padding:6px 8px;border-radius:999px;background:#080a0acc;color:#fff;font-size:8px;text-align:center}
      .person-v2-presence{position:absolute;left:8px;top:8px;padding:6px 8px;border-radius:999px;background:var(--lime);color:#090b08;font-size:7px;font-weight:900}
      .person-v2-self{position:absolute;right:8px;top:8px;padding:6px 8px;border-radius:999px;background:#ffffffdd;color:#090b08;font-size:7px;font-weight:900}
      .person-v2-body{padding:10px}.person-v2-body h3{margin:0 0 4px;font-size:13px}.person-v2-body p{margin:0;color:var(--muted);font-size:9px;line-height:1.4}
      .person-v2-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:9px}.person-v2-actions button{min-height:38px;padding:0;border-radius:11px;font-size:18px}.person-v2-actions button.active{background:var(--lime);color:#090b08}
      .social-v2-empty{padding:28px 14px;border:1px dashed var(--line);border-radius:18px;color:var(--muted);text-align:center;font-size:10px;line-height:1.6}
      .bali-people-dialog{width:min(520px,calc(100% - 16px));max-height:94dvh;padding:0;border:1px solid var(--line);border-radius:23px;background:#0c0f0e;color:#fff;overflow:hidden}
      .bali-people-dialog::backdrop{background:#000d;backdrop-filter:blur(5px)}
      .bali-people-sheet{max-height:94dvh;overflow:auto}.bali-people-head{display:flex;justify-content:space-between;align-items:center;padding:15px;border-bottom:1px solid var(--line)}
      .bali-people-close{width:41px;height:41px;border:1px solid var(--line);border-radius:50%;background:#ffffff08;color:#fff;font-size:23px}
      .bali-people-body{padding:14px}.bali-people-body h2{margin:12px 0 5px}.bali-people-body>p{color:var(--muted);font-size:10px;line-height:1.55}
      .bali-people-options{display:grid;gap:10px;padding:14px}.bali-people-options select{width:100%;min-height:50px;padding:0 11px;border:1px solid var(--line);border-radius:13px;background:#171b19;color:#fff}
      .bali-people-gifts{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.bali-people-gifts button{display:grid;gap:4px;padding:14px;border:1px solid var(--line);border-radius:14px;background:#ffffff08;color:#fff}.bali-people-gifts i{font-style:normal;font-size:28px}
      @media(max-width:360px){.people-v2-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function ensureDialogs() {
    if (!byId("baliPeoplePersonDialog")) {
      document.body.insertAdjacentHTML("beforeend", `
        <dialog class="bali-people-dialog" id="baliPeoplePersonDialog"><div class="bali-people-sheet"><div class="bali-people-head"><strong>Профиль BALI</strong><button class="bali-people-close" type="button" data-bali-people-close>×</button></div><div class="bali-people-body" id="baliPeoplePersonBody"></div></div></dialog>
        <dialog class="bali-people-dialog" id="baliPeopleInviteDialog"><div class="bali-people-sheet"><div class="bali-people-head"><strong>Пригласить на мероприятие</strong><button class="bali-people-close" type="button" data-bali-people-close>×</button></div><div class="bali-people-options"><select id="baliPeopleInviteEvent"></select><button class="primary full" type="button" id="baliPeopleInviteSubmit">Пригласить</button></div></div></dialog>
        <dialog class="bali-people-dialog" id="baliPeopleGiftDialog"><div class="bali-people-sheet"><div class="bali-people-head"><strong>Отправить подарок</strong><button class="bali-people-close" type="button" data-bali-people-close>×</button></div><div class="bali-people-options"><div class="bali-people-gifts" id="baliPeopleGiftList"></div></div></div></dialog>`);
    }
  }

  function normalize(row = {}) {
    const telegramId = row.telegram_id || row.telegramId || null;
    const id = String(row.user_key || row.userKey || row.id || (telegramId ? `tg:${telegramId}` : ""));
    if (!id) return null;
    const username = String(row.username || row.telegram || "").replace(/^@/, "");
    return {
      ...row,
      id,
      userKey:id,
      user_key:id,
      telegramId,
      telegram_id:telegramId,
      name:row.name || "Гость BALI",
      username:username ? `@${username}` : "",
      telegram:username ? `@${username}` : "",
      photo:row.photo || row.avatar || "",
      avatar:row.photo || row.avatar || "",
      bio:row.bio || "Пользователь BALI",
      status:["party","table","chat"].includes(String(row.status)) ? String(row.status) : "chat",
      active:true,
      updatedAt:row.updatedAt || row.updated_at || row.last_seen_at || "",
      createdAt:row.createdAt || row.created_at || row.first_seen_at || ""
    };
  }

  function currentKeys() {
    const profile = social.profile?.() || {};
    const gameProfile = game.profile?.() || {};
    const telegramId = tg?.initDataUnsafe?.user?.id || gameProfile.telegramId || profile.telegramId || null;
    return new Set([
      profile.id, profile.userKey, profile.user_key,
      gameProfile.id, gameProfile.userKey, gameProfile.user_key,
      telegramId ? `tg:${telegramId}` : ""
    ].filter(Boolean).map(String));
  }

  function addRows(map, rows) {
    for (const source of rows || []) {
      const row = normalize(source);
      if (!row) continue;
      const previous = map.get(row.id) || {};
      map.set(row.id, { ...previous, ...row, photo:row.photo || previous.photo || "", name:row.name || previous.name || "Гость BALI" });
    }
  }

  async function safeDirectoryView() {
    if (!store?.client) return [];
    try {
      const { data, error } = await store.client.from("bali_people_directory").select("*").limit(2000);
      return error ? [] : (data || []);
    } catch { return []; }
  }

  function localAppUsers() {
    try { return Object.values(JSON.parse(localStorage.getItem("bali_app_users_v1") || "{}")); }
    catch { return []; }
  }

  async function buildDirectory({ useCloud = false } = {}) {
    if (useCloud) {
      try { await cloud?.refresh?.(); } catch {}
    }

    const map = new Map();
    addRows(map, social.people?.() || []);
    addRows(map, cloud?.profiles?.() || []);
    addRows(map, Object.values(points?.accounts?.() || {}));
    addRows(map, localAppUsers());
    addRows(map, await safeDirectoryView());

    const socialProfile = social.profile?.() || {};
    const gameProfile = game.profile?.() || {};
    const telegramId = tg?.initDataUnsafe?.user?.id || gameProfile.telegramId || socialProfile.telegramId || null;
    addRows(map, [{
      ...gameProfile,
      ...socialProfile,
      id:socialProfile.id || gameProfile.id || (telegramId ? `tg:${telegramId}` : ""),
      user_key:socialProfile.user_key || gameProfile.user_key || (telegramId ? `tg:${telegramId}` : ""),
      telegram_id:telegramId,
      name:socialProfile.name || gameProfile.name || tg?.initDataUnsafe?.user?.first_name || "Гость BALI",
      photo:socialProfile.photo || gameProfile.avatar || tg?.initDataUnsafe?.user?.photo_url || "",
      active:true,
      status:socialProfile.status === "closed" ? "chat" : (socialProfile.status || "chat")
    }]);

    const mine = currentKeys();
    directory = [...map.values()]
      .map(row => ({ ...row, isMe:mine.has(String(row.id)) || (row.telegramId && mine.has(`tg:${row.telegramId}`)) }))
      .sort((a, b) => Number(b.isMe) - Number(a.isMe) || String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")) || String(a.name).localeCompare(String(b.name), "ru"));
    return directory;
  }

  async function loadPresence() {
    try { presence = attendance?.listPresence ? await attendance.listPresence() : []; }
    catch { presence = []; }
    return presence;
  }

  function presenceKeys() {
    const keys = new Set();
    for (const row of presence || []) {
      if (row.left_at || row.presence_status === "left") continue;
      if (row.user_key) keys.add(String(row.user_key));
      if (row.telegram_id) keys.add(`tg:${row.telegram_id}`);
    }
    return keys;
  }

  function isInside(person, keys = presenceKeys()) {
    return keys.has(String(person.id)) || keys.has(String(person.userKey || "")) || (person.telegramId && keys.has(`tg:${person.telegramId}`));
  }

  function statusName(status) {
    const rows = social.STATUSES || [];
    return rows.find(row => row[0] === status)?.[1] || "Открыт(а) к общению";
  }

  function photoHtml(person, inside) {
    return `<div class="person-v2-photo">${person.photo ? `<img src="${esc(person.photo)}" alt="${esc(person.name)}">` : `<div class="person-v2-placeholder">${esc(initials(person.name))}</div>`}${inside ? '<span class="person-v2-presence">НА МЕРОПРИЯТИИ</span>' : ""}${person.isMe ? '<span class="person-v2-self">ЭТО ВЫ</span>' : ""}<span class="person-v2-status">${esc(statusName(person.status))}</span></div>`;
  }

  function cardHtml(person, keys) {
    const inside = isInside(person, keys);
    const liked = !person.isMe && Boolean(social.hasThumb?.(social.myId?.(), person.id));
    const actions = person.isMe ? '<p style="margin-top:9px;color:var(--lime);font-size:9px">Ваш профиль отображается в общем списке.</p>' : `<div class="person-v2-actions"><button type="button" title="Пригласить" data-person-invite="${esc(person.id)}">＋</button><button type="button" title="Подарок" data-person-gift="${esc(person.id)}">🎁</button><button type="button" title="Лайк" class="${liked ? "active" : ""}" data-person-thumb="${esc(person.id)}">👍</button></div>`;
    return `<article class="person-v2" data-open-social-person="${esc(person.id)}">${photoHtml(person, inside)}<div class="person-v2-body"><h3>${esc(person.name)}</h3><p>${esc(person.bio || statusName(person.status))}</p>${actions}</div></article>`;
  }

  function rowsForTab() {
    const keys = presenceKeys();
    if (activeTab === "inside") return directory.filter(person => isInside(person, keys));
    if (activeTab === "thumbs") {
      const incoming = new Set((social.incomingThumbs?.() || []).map(row => String(row.id || row.userKey || row.user_key || "")));
      return directory.filter(person => incoming.has(String(person.id)));
    }
    return directory;
  }

  function render() {
    ensureStyle();
    ensureDialogs();
    const root = byId("socialV2Content");
    if (!root) return;
    document.querySelectorAll("[data-social-v2-tab]").forEach(button => button.classList.toggle("active", button.dataset.socialV2Tab === activeTab));
    const rows = rowsForTab();
    const count = byId("peopleCount");
    if (count) count.textContent = activeTab === "inside" ? `${rows.length} внутри` : `${directory.length} пользователей`;
    const keys = presenceKeys();
    const html = rows.length
      ? `<div class="people-v2-grid">${rows.map(person => cardHtml(person, keys)).join("")}</div>`
      : `<div class="social-v2-empty">${activeTab === "inside" ? "Сейчас никто не подтвердил вход на активное мероприятие через QR-код." : activeTab === "thumbs" ? "Никто ещё не поставил вам 👍." : "Пользователи загружаются. Откройте этот раздел повторно через несколько секунд."}</div>`;
    if (html !== lastHtml) {
      lastHtml = html;
      root.innerHTML = html;
    }
  }

  function queueRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      render();
    });
  }

  async function refresh({ useCloud = false } = {}) {
    if (refreshPromise) return refreshPromise;
    refreshPromise = (async () => {
      await Promise.all([buildDirectory({ useCloud }), loadPresence()]);
      render();
      return directory;
    })().finally(() => { refreshPromise = null; });
    return refreshPromise;
  }

  function findPerson(id) { return directory.find(row => String(row.id) === String(id)); }

  function openPerson(id) {
    const person = findPerson(id);
    if (!person) return;
    activePersonId = person.id;
    const inside = isInside(person);
    byId("baliPeoplePersonBody").innerHTML = `${photoHtml(person, inside)}<h2>${esc(person.name)}</h2><p>${esc(person.bio || statusName(person.status))}</p>${person.username ? `<p>${esc(person.username)}</p>` : ""}`;
    byId("baliPeoplePersonDialog")?.showModal?.();
  }

  async function openInvite(id) {
    activePersonId = id;
    try { activeEvents = (await store.list("events") || []).filter(event => event.active !== false).sort((a, b) => `${a.event_date || ""}T${a.event_time || ""}`.localeCompare(`${b.event_date || ""}T${b.event_time || ""}`)); }
    catch { activeEvents = []; }
    const select = byId("baliPeopleInviteEvent");
    if (select) select.innerHTML = activeEvents.length ? activeEvents.map(event => `<option value="${esc(event.id)}">${esc(event.title || "Мероприятие BALI")} · ${esc(event.event_date || "")}</option>`).join("") : '<option value="">Нет доступных мероприятий</option>';
    byId("baliPeopleInviteSubmit").disabled = !activeEvents.length;
    byId("baliPeopleInviteDialog")?.showModal?.();
  }

  function openGift(id) {
    activePersonId = id;
    const gifts = social.GIFT_CATALOG || [];
    byId("baliPeopleGiftList").innerHTML = gifts.length ? gifts.map(gift => `<button type="button" data-send-social-gift="${esc(gift.id)}"><i>${esc(gift.icon || "🎁")}</i><strong>${esc(gift.name || "Подарок")}</strong><small>⭐ ${Number(gift.stars || 0)}</small></button>`).join("") : '<div class="social-v2-empty">Каталог подарков пока пуст.</div>';
    byId("baliPeopleGiftDialog")?.showModal?.();
  }

  document.addEventListener("click", async event => {
    if (event.target.closest('[data-page="dating"]')) setTimeout(() => refresh({ useCloud:true }), 0);

    const tabButton = event.target.closest("[data-social-v2-tab]");
    if (tabButton) {
      event.preventDefault();
      activeTab = tabButton.dataset.socialV2Tab || "all";
      if (activeTab === "inside") await loadPresence();
      render();
      return;
    }

    const open = event.target.closest("[data-open-social-person]");
    if (open && !event.target.closest("button")) return openPerson(open.dataset.openSocialPerson);

    const invite = event.target.closest("[data-person-invite]");
    if (invite) { event.preventDefault(); event.stopPropagation(); return openInvite(invite.dataset.personInvite); }

    const gift = event.target.closest("[data-person-gift]");
    if (gift) { event.preventDefault(); event.stopPropagation(); return openGift(gift.dataset.personGift); }

    const thumb = event.target.closest("[data-person-thumb]");
    if (thumb) {
      event.preventDefault();
      event.stopPropagation();
      const result = social.toggleThumb?.(thumb.dataset.personThumb) || {};
      toast(result.connected ? "Взаимный 👍" : "Лайк сохранён");
      render();
      return;
    }

    if (event.target.closest("#baliPeopleInviteSubmit")) {
      const selected = activeEvents.find(eventRow => String(eventRow.id) === String(byId("baliPeopleInviteEvent")?.value));
      const result = social.sendRequest?.(activePersonId, "event", selected) || { ok:false, message:"Не удалось отправить приглашение" };
      toast(result.ok ? "Приглашение отправлено" : result.message);
      if (result.ok) byId("baliPeopleInviteDialog")?.close?.();
      return;
    }

    const giftSend = event.target.closest("[data-send-social-gift]");
    if (giftSend) {
      social.recordGift?.(activePersonId, giftSend.dataset.sendSocialGift, "bali_app");
      toast("Подарок отправлен");
      byId("baliPeopleGiftDialog")?.close?.();
      return;
    }

    if (event.target.closest("[data-bali-people-close]")) event.target.closest("dialog")?.close?.();
  }, true);

  window.addEventListener("bali:social-changed", () => {
    buildDirectory({ useCloud:false }).then(queueRender);
  });
  ["bali:checkin-complete", "bali:checkin-left", "bali:presence-changed"].forEach(name => window.addEventListener(name, () => loadPresence().then(queueRender)));
  window.addEventListener("focus", () => {
    if (document.querySelector('[data-screen="dating"]')?.classList.contains("active")) refresh({ useCloud:true });
  });

  ensureStyle();
  ensureDialogs();
  refresh({ useCloud:true });
  setInterval(() => {
    if (document.querySelector('[data-screen="dating"]')?.classList.contains("active")) refresh({ useCloud:true });
  }, 20000);

  window.BaliPeoplePage = { refresh, render, directory:() => [...directory], presence:() => [...presence] };
})();