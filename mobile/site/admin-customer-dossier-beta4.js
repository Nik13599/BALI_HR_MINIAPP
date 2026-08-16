(() => {
  if (window.__BALI_CUSTOMER_DOSSIER__) return;
  window.__BALI_CUSTOMER_DOSSIER__ = true;

  const points = window.BaliPoints;
  const game = window.BaliBeta4Game;
  const attendance = window.BaliEventQrAttendance;
  const loyalty = window.BaliBeta4Loyalty;
  const chipRequests = window.BaliChipRequests;
  const appUsers = window.BaliAppUsers;
  if (!points || !game || !window.BaliStore) return;

  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);
  const digits = value => String(value || "").replace(/\D/g, "");
  const norm = value => String(value || "").trim().replace(/^@/, "").toLowerCase();
  const fmt = value => value ? new Date(value).toLocaleString("ru-RU", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
  const toast = message => window.toast?.(message);
  let activeSubject = null;

  function styles() {
    if (document.getElementById("customerDossierStyle")) return;
    const style = document.createElement("style");
    style.id = "customerDossierStyle";
    style.textContent = `.customer-row-open{cursor:pointer}.customer-row-open:hover{background:#c8ff3d08}.customer-dossier{width:min(940px,calc(100% - 12px));max-height:96dvh;padding:0;border:1px solid var(--line);border-radius:22px;background:#090c0b;color:var(--text);overflow:hidden}.customer-dossier::backdrop{background:#000e;backdrop-filter:blur(6px)}.customer-dossier-shell{max-height:96dvh;overflow:auto}.customer-dossier-head{position:sticky;top:0;z-index:3;display:flex;justify-content:space-between;align-items:center;padding:15px 17px;border-bottom:1px solid var(--line);background:#090c0bf2}.customer-dossier-head h2{margin:4px 0 0}.customer-dossier-close{width:42px;height:42px;border:1px solid var(--line);border-radius:50%;background:#ffffff09;color:#fff;font-size:24px}.customer-dossier-body{display:grid;gap:13px;padding:14px}.customer-dossier-stats{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.customer-dossier-stats article,.customer-dossier-card{padding:13px;border:1px solid var(--line);border-radius:16px;background:#ffffff05}.customer-dossier-stats span{display:block;color:var(--muted);font-size:8px}.customer-dossier-stats strong{display:block;margin-top:5px;color:var(--lime);font:600 18px Unbounded}.customer-dossier-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.customer-dossier-card h3{margin:0 0 10px}.customer-contact-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.customer-contact{padding:11px;border:1px solid var(--line);border-radius:13px;background:#ffffff04}.customer-contact small{display:block;color:var(--muted);font-size:8px}.customer-contact strong,.customer-contact a{display:block;margin-top:5px;color:#fff;font-size:10px;text-decoration:none;word-break:break-word}.customer-dossier-form{display:grid;gap:9px}.customer-dossier-form label{display:grid;gap:5px;color:var(--muted);font-size:9px}.customer-dossier-form input,.customer-dossier-form select{min-height:44px;padding:0 11px;border:1px solid var(--line);border-radius:12px;background:#ffffff08;color:#fff}.customer-dossier-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.customer-history{display:grid;gap:7px}.customer-history-row{display:grid;grid-template-columns:110px minmax(0,1fr) auto;gap:9px;align-items:center;padding:10px;border:1px solid var(--line);border-radius:13px;background:#ffffff04}.customer-history-row small{color:var(--muted);font-size:8px}.customer-history-row strong{font-size:10px}.customer-history-row b{color:var(--lime);font-size:9px}.admin-user-link{cursor:pointer!important;text-decoration:underline;text-decoration-color:#c8ff3d66;text-underline-offset:3px}.admin-user-link:hover{color:var(--lime)!important}@media(max-width:720px){.customer-dossier-stats{grid-template-columns:1fr 1fr}.customer-dossier-grid,.customer-contact-grid{grid-template-columns:1fr}.customer-history-row{grid-template-columns:85px 1fr}.customer-history-row b{grid-column:2}}`;
    document.head.appendChild(style);
  }

  function dialog() {
    let node = document.getElementById("customerDossierDialog");
    if (node) return node;
    document.body.insertAdjacentHTML("beforeend", `<dialog id="customerDossierDialog" class="customer-dossier"><div class="customer-dossier-shell"><header class="customer-dossier-head"><div><span class="eyebrow">ПОЛНАЯ КАРТОЧКА ПОЛЬЗОВАТЕЛЯ</span><h2 id="customerDossierTitle">Гость BALI</h2></div><button class="customer-dossier-close" type="button" data-close-customer-dossier>×</button></header><div class="customer-dossier-body" id="customerDossierBody"></div></div></dialog>`);
    return document.getElementById("customerDossierDialog");
  }

  function identityKeys(subject = {}, account = {}) {
    const set = new Set();
    [subject.id, subject.customer_id, subject.client_key, subject.owner_key, subject.user_key, subject.userKey, subject.code, account.userKey, account.code]
      .filter(Boolean).forEach(value => set.add(String(value)));
    const phone = digits(subject.phone || account.phone);
    if (phone) set.add(`phone:${phone}`);
    const telegramId = subject.telegram_id || subject.telegramId || account.telegram_id || account.telegramId;
    if (telegramId) set.add(`tg:${telegramId}`);
    return set;
  }

  function matches(subject, ref) {
    const refPhone = digits(ref.phone);
    const subjectPhone = digits(subject.phone);
    const refTelegram = norm(ref.telegram || ref.username);
    const subjectTelegram = norm(subject.telegram || subject.username || subject.telegram_username);
    const ids = [subject.id, subject.customer_id, subject.client_key, subject.owner_key, subject.user_key, subject.userKey, subject.code].filter(Boolean).map(String);
    const refIds = [ref.id, ref.customer_id, ref.client_key, ref.owner_key, ref.user_key, ref.userKey, ref.code].filter(Boolean).map(String);
    return refIds.some(id => ids.includes(id)) || (refPhone && subjectPhone === refPhone) || (refTelegram && subjectTelegram === refTelegram) || (ref.name && norm(subject.name) === norm(ref.name));
  }

  async function resolve(ref = {}) {
    if (typeof ref === "string") ref = { id: ref };
    const [customers, users] = await Promise.all([
      store.list("customers"),
      appUsers?.listAdmin?.() || Promise.resolve([])
    ]);
    const accounts = Object.values(points.accounts?.() || {});
    const customer = customers.find(row => matches(row, ref));
    const user = users.find(row => matches(row, ref));
    const account = accounts.find(row => matches(row, ref)) || accounts.find(row => customer && matches(row, customer));
    const merged = {
      ...(account || {}),
      ...(user || {}),
      ...(customer || {}),
      ...ref
    };
    if (!merged.id && !merged.userKey && !merged.user_key && !merged.phone && !merged.telegram && !merged.name) return null;
    merged.name ||= account?.name || user?.name || customer?.name || "Гость BALI";
    merged.phone ||= account?.phone || user?.phone || customer?.phone || "";
    merged.telegram ||= account?.telegram || user?.telegram || user?.username || customer?.telegram || "";
    merged.customerId = customer?.id || ref.customer_id || "";
    return merged;
  }

  function accountFor(subject) {
    const all = points.accounts?.() || {};
    const keys = identityKeys(subject);
    for (const key of keys) if (all[key]) return { ...all[key], userKey: key };
    const rows = Object.values(all);
    return rows.find(row => matches(row, subject)) || { ...subject, userKey: subject.user_key || subject.userKey || subject.owner_key || subject.code || (digits(subject.phone) ? `phone:${digits(subject.phone)}` : String(subject.id || "")), balance: Number(subject.points_balance || subject.balance || 0) };
  }

  function rankFor(subject, account) {
    const ranking = game.ranking(Object.values(points.accounts?.() || {}));
    const keys = identityKeys(subject, account);
    return ranking.find(row => keys.has(String(row.id || row.userKey || ""))) || ranking.find(row => matches(row, subject)) || null;
  }

  function vipFor(subject, account) {
    const keys = identityKeys(subject, account);
    return game.vipGifts().filter(item => !item.revokedAt && new Date(item.expiresAt).getTime() > Date.now() && item.targetKeys?.some(key => keys.has(String(key)))).sort((a, b) => String(b.expiresAt).localeCompare(String(a.expiresAt)))[0] || null;
  }

  async function visitHistory(subject, account) {
    const keys = identityKeys(subject, account);
    const phone = digits(subject.phone || account.phone);
    const telegramId = String(subject.telegram_id || subject.telegramId || account.telegram_id || account.telegramId || "");
    const [bookings, checkins] = await Promise.all([store.list("bookings"), attendance?.listCheckins?.() || Promise.resolve([])]);
    const rows = [];
    checkins.filter(row => keys.has(String(row.user_key || "")) || (telegramId && String(row.telegram_id || "") === telegramId) || (phone && digits(row.phone) === phone)).forEach(row => rows.push({ date: row.checked_in_at, title: row.event_title || "Мероприятие BALI", type: row.left_at ? `QR-вход · ушёл ${fmt(row.left_at)}` : "QR-вход", detail: `+${Number(row.reward || 0)} баллов` }));
    bookings.filter(row => matches(row, subject) || keys.has(String(row.owner_key || "")) || (phone && digits(row.phone) === phone)).forEach(row => rows.push({ date: row.completed_at || row.updated_at || row.created_at || row.booking_date, title: row.event_title || row.table_name || "Бронирование", type: `Бронь · ${row.status || "—"}`, detail: `${Number(row.guests || 0)} гостей` }));
    return rows.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  }

  function pointsHistory(subject, account) {
    const keys = identityKeys(subject, account);
    return (points.ledger?.() || []).filter(row => !row.userKey || keys.has(String(row.userKey))).slice(0, 50);
  }

  function rewardsHistory(subject, account) {
    const keys = identityKeys(subject, account);
    const rewards = new Map((loyalty?.rewards?.() || []).map(row => [String(row.id), row]));
    return (loyalty?.grants?.() || []).filter(row => !row.revokedAt && keys.has(String(row.userKey))).map(row => ({ ...row, reward: rewards.get(String(row.rewardId)) })).sort((a, b) => String(b.earnedAt || "").localeCompare(String(a.earnedAt || "")));
  }

  async function chipHistory(subject, account) {
    const keys = identityKeys(subject, account);
    const phone = digits(subject.phone || account.phone);
    return (await chipRequests?.list?.() || []).filter(row => keys.has(String(row.user_key || "")) || (phone && digits(row.phone) === phone));
  }

  async function open(ref) {
    styles();
    const node = dialog();
    const body = node.querySelector("#customerDossierBody");
    body.innerHTML = '<div class="empty">Загрузка карточки пользователя…</div>';
    if (!node.open) node.showModal();
    const subject = await resolve(ref);
    if (!subject) {
      body.innerHTML = '<div class="empty">Пользователь не найден</div>';
      return;
    }
    activeSubject = subject;
    const account = accountFor(subject);
    const ranking = rankFor(subject, account);
    const vip = vipFor(subject, account);
    const plan = vip ? game.config().plans.find(row => row.id === vip.planId) : null;
    const [visits, chips] = await Promise.all([visitHistory(subject, account), chipHistory(subject, account)]);
    const ledger = pointsHistory(subject, account);
    const rewards = rewardsHistory(subject, account);
    const chipBalance = loyalty?.chipBalance?.(account) || 0;
    node.querySelector("#customerDossierTitle").textContent = subject.name || "Гость BALI";
    body.innerHTML = `
      <div class="customer-dossier-stats"><article><span>БАЛЛЫ</span><strong>${Number(account.balance || 0)}</strong></article><article><span>ПОСЕЩЕНИЯ</span><strong>${visits.filter(row => row.type.startsWith("QR-вход")).length}</strong></article><article><span>РЕЙТИНГ</span><strong>${ranking ? `#${ranking.position}` : "—"}</strong></article><article><span>НАГРАДЫ</span><strong>${rewards.length}</strong></article><article><span>ФИШКИ</span><strong>${Number(chipBalance)}</strong></article></div>
      <section class="customer-dossier-card"><h3>Контактная информация</h3><div class="customer-contact-grid"><article class="customer-contact"><small>Телефон</small>${subject.phone ? `<a href="tel:${esc(subject.phone)}">${esc(subject.phone)}</a>` : "<strong>Не указан</strong>"}</article><article class="customer-contact"><small>Telegram</small>${subject.telegram || subject.username ? `<a href="https://t.me/${esc(norm(subject.telegram || subject.username))}" target="_blank">@${esc(norm(subject.telegram || subject.username))}</a>` : "<strong>Не указан</strong>"}</article><article class="customer-contact"><small>Дата рождения</small><strong>${esc(subject.birth_date || subject.birthDate || "Не указана")}</strong></article><article class="customer-contact"><small>VIP</small><strong>${plan ? `${esc(plan.name)} · до ${fmt(vip.expiresAt)}` : "Нет активного VIP"}</strong></article></div></section>
      <div class="customer-dossier-grid"><section class="customer-dossier-card"><h3>Баллы</h3><form class="customer-dossier-form" id="customerPointsForm"><label><span>Количество</span><input name="amount" type="number" min="1" required></label><label><span>Комментарий</span><input name="note" value="Корректировка через карточку пользователя"></label><div class="customer-dossier-actions"><button class="primary" type="button" data-customer-points="add">Начислить</button><button class="danger" type="button" data-customer-points="remove">Списать</button></div></form></section><section class="customer-dossier-card"><h3>VIP-статус</h3>${vip ? `<div class="vip-active"><strong>${esc(plan?.name || vip.planId)}</strong><br>до ${fmt(vip.expiresAt)}</div><button class="danger full" data-revoke-customer-vip="${esc(vip.id)}">Убрать VIP</button>` : `<form class="customer-dossier-form" id="customerVipForm"><label><span>Тариф</span><select name="planId">${game.config().plans.filter(row => row.active !== false).map(row => `<option value="${esc(row.id)}">${esc(row.name)}</option>`).join("")}</select></label><label><span>Срок</span><select name="days"><option value="1">1 день</option><option value="30">1 месяц</option><option value="90">3 месяца</option><option value="180">6 месяцев</option><option value="365">1 год</option></select></label><label><span>Комментарий</span><input name="note" value="Подарок от BALI"></label><button class="primary full" type="submit">Подарить VIP</button></form>`}</section></div>
      <section class="customer-dossier-card"><h3>История посещений и бронирований</h3><div class="customer-history">${visits.map(row => `<article class="customer-history-row"><small>${fmt(row.date)}</small><div><strong>${esc(row.title)}</strong><small>${esc(row.type)}</small></div><b>${esc(row.detail)}</b></article>`).join("") || '<div class="empty">Истории пока нет</div>'}</div></section>
      <section class="customer-dossier-card"><h3>История баллов и бонусов</h3><div class="customer-history">${ledger.map(row => `<article class="customer-history-row"><small>${fmt(row.createdAt || row.created_at)}</small><div><strong>${esc(row.title || "Операция")}</strong><small>${esc(row.type || "BALI-Баллы")}</small></div><b>${Number(row.amount || 0) > 0 ? "+" : ""}${Number(row.amount || 0)}</b></article>`).join("") || '<div class="empty">Операций нет</div>'}</div></section>
      <section class="customer-dossier-card"><h3>Полученные награды</h3><div class="customer-history">${rewards.map(row => `<article class="customer-history-row"><small>${fmt(row.earnedAt)}</small><div><strong>${esc(row.reward?.title || "Награда BALI")}</strong><small>${esc(row.source || "Выдана администратором")}</small></div><b>+${Number(row.xp || row.reward?.xp || 0)} XP</b></article>`).join("") || '<div class="empty">Наград пока нет</div>'}</div></section>
      <section class="customer-dossier-card"><h3>Заявки на фишки</h3><div class="customer-history">${chips.map(row => `<article class="customer-history-row"><small>${fmt(row.created_at)}</small><div><strong>${Number(row.quantity || 0)} фишек</strong><small>${row.status === "fulfilled" ? `Вручено ${fmt(row.fulfilled_at)}` : row.status === "cancelled" ? "Отменено" : "Ожидает выдачи"}</small></div><b>${Number(row.points_cost || 0)} баллов</b></article>`).join("") || '<div class="empty">Заявок нет</div>'}</div></section>`;
  }

  function decorateCustomers() {
    document.querySelectorAll("#customerTable tbody tr").forEach(row => {
      const edit = row.querySelector('[data-edit="customers"]');
      if (!edit) return;
      row.classList.add("customer-row-open");
      row.dataset.customerDossier = edit.dataset.id;
      row.querySelector("td strong")?.classList.add("admin-user-link");
    });
  }

  document.addEventListener("click", async event => {
    if (event.target.closest("[data-close-customer-dossier]")) return dialog().close();
    const direct = event.target.closest("[data-open-customer-dossier]");
    if (direct) { event.preventDefault(); event.stopPropagation(); return open({ id: direct.dataset.openCustomerDossier }); }
    const row = event.target.closest("tr[data-customer-dossier]");
    if (row && !event.target.closest("button")) return open({ id: row.dataset.customerDossier });
    const action = event.target.closest("[data-customer-points]");
    if (action && activeSubject) {
      const account = accountFor(activeSubject);
      const form = document.getElementById("customerPointsForm");
      const amount = Math.max(1, Number(form.amount.value || 0)) * (action.dataset.customerPoints === "remove" ? -1 : 1);
      const result = points.adjustAccount(account, amount, form.note.value || "Корректировка администратора");
      toast(result.ok ? "Баллы обновлены" : result.message);
      return open(activeSubject);
    }
    const revoke = event.target.closest("[data-revoke-customer-vip]");
    if (revoke && confirm("Убрать VIP-статус?")) {
      game.revokeGift(revoke.dataset.revokeCustomerVip);
      toast("VIP убран");
      return open(activeSubject);
    }
  }, true);

  document.addEventListener("submit", event => {
    if (event.target.id !== "customerVipForm" || !activeSubject) return;
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target).entries());
    game.giftVip({ ...activeSubject, ...accountFor(activeSubject) }, data.planId, Number(data.days || 30), data.note || "Подарок от BALI");
    toast("VIP подарен");
    open(activeSubject);
  }, true);

  styles();
  new MutationObserver(decorateCustomers).observe(document.body, { childList: true, subtree: true });
  decorateCustomers();
  window.BaliAdminCustomerDossier = { open, resolve };
})();