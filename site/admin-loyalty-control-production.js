(() => {
  if (window.__BALI_ADMIN_LOYALTY_CONTROL_PRODUCTION__) return;
  window.__BALI_ADMIN_LOYALTY_CONTROL_PRODUCTION__ = true;

  const store = window.BaliStore;
  if (!store) return;

  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" })[char]);
  const notify = message => window.toast ? window.toast(message) : console.info(message);
  const uuid = prefix => `${prefix}-${crypto.randomUUID?.() || Date.now()}`;
  const toLocal = value => value ? new Date(value).toISOString().slice(0, 16) : "";
  const toIso = value => value ? new Date(value).toISOString() : null;
  let snapshot = null;
  let rendering = false;

  function styles() {
    if (document.getElementById("adminLoyaltyControlProductionStyle")) return;
    const style = document.createElement("style");
    style.id = "adminLoyaltyControlProductionStyle";
    style.textContent = `
      .loyalty-prod{display:grid;gap:14px}.loyalty-prod-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.loyalty-prod .panel{margin:0}
      .loyalty-prod-stats{display:grid;grid-template-columns:repeat(5,1fr);gap:9px}.loyalty-prod-stat{padding:13px;border:1px solid var(--line);border-radius:15px;background:#ffffff04}.loyalty-prod-stat span{display:block;color:var(--muted);font-size:8px}.loyalty-prod-stat strong{display:block;margin-top:6px;color:var(--lime);font:700 20px Unbounded}
      .loyalty-prod-form{display:grid;gap:9px}.loyalty-prod-form label{display:grid;gap:5px;color:var(--muted);font-size:9px;font-weight:800}.loyalty-prod-form input,.loyalty-prod-form textarea,.loyalty-prod-form select{width:100%;min-height:43px;padding:9px 11px;border:1px solid var(--line);border-radius:11px;background:#111614;color:#fff}.loyalty-prod-form textarea{min-height:82px;resize:vertical}
      .loyalty-prod-two{display:grid;grid-template-columns:1fr 1fr;gap:8px}.loyalty-prod-three{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.loyalty-prod-check{display:flex!important;align-items:center;justify-content:space-between}.loyalty-prod-check input{width:22px;min-height:22px}
      .loyalty-prod-list{display:grid;gap:8px}.loyalty-prod-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:11px;border:1px solid var(--line);border-radius:13px;background:#ffffff04}.loyalty-prod-row h4{margin:0;font-size:11px}.loyalty-prod-row p{margin:4px 0 0;color:var(--muted);font-size:8px;line-height:1.5}.loyalty-prod-actions{display:flex;gap:6px;flex-wrap:wrap}.loyalty-prod-actions button{min-height:33px;padding:0 8px}
      .loyalty-prod-warning{padding:14px;border:1px solid rgba(255,190,70,.3);border-radius:14px;background:rgba(255,190,70,.07);color:#f1d493;font-size:10px;line-height:1.55}.loyalty-prod-dot{display:inline-block;width:18px;height:18px;margin-right:7px;vertical-align:middle;border:3px solid var(--vip-color,#c8ff3d);border-radius:50%;box-shadow:0 0 12px color-mix(in srgb,var(--vip-color,#c8ff3d) 55%,transparent)}
      .loyalty-prod-section-title{margin:2px 0 8px;font-size:13px}.loyalty-prod-color{display:grid;grid-template-columns:1fr 62px;align-items:end;gap:8px}.loyalty-prod-color input[type=color]{padding:3px}
      @media(max-width:980px){.loyalty-prod-stats{grid-template-columns:repeat(2,1fr)}}@media(max-width:850px){.loyalty-prod-grid,.loyalty-prod-stats,.loyalty-prod-three,.loyalty-prod-two{grid-template-columns:1fr}.loyalty-prod-row{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  async function query(table, order, ascending = true) {
    try {
      let request = store.client.from(table).select("*");
      if (order) request = request.order(order, { ascending });
      const { data, error } = await request;
      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      return { data: [], error };
    }
  }

  function mergeUsers(appUsers, accounts) {
    const map = new Map();
    for (const row of appUsers) {
      const key = String(row.user_key || "");
      if (key) map.set(key, { ...row, user_key: key, balance: 0 });
    }
    for (const row of accounts) {
      const key = String(row.user_key || "");
      if (key) map.set(key, { ...(map.get(key) || {}), ...row, user_key: key, balance: Number(row.balance || 0) });
    }
    return [...map.values()].sort((a, b) => String(a.name || a.user_key).localeCompare(String(b.name || b.user_key), "ru"));
  }

  async function loadSnapshot() {
    if (!store.cloudEnabled || !store.client) throw new Error("Supabase не подключён. Облачное управление баллами недоступно.");
    const results = await Promise.all([
      query("app_users", "name"),
      query("points_accounts", "name"),
      query("vip_plans", "sort_order"),
      query("vip_memberships", "expires_at", false),
      query("loyalty_rewards", "sort_order"),
      query("loyalty_gifts", "sort_order"),
      query("events", "event_date"),
    ]);
    const [users, accounts, plans, memberships, rewards, gifts, events] = results;
    return {
      users: mergeUsers(users.data, accounts.data),
      plans: plans.data,
      memberships: memberships.data.filter(row => new Date(row.expires_at).getTime() > Date.now()),
      rewards: rewards.data,
      gifts: gifts.data,
      events: events.data,
      errors: results.map(result => result.error).filter(Boolean),
    };
  }

  const userOptions = rows => rows.map(row => `<option value="${esc(row.user_key)}">${esc(row.name || "Гость BALI")} · ${esc(row.username || row.telegram || row.phone || row.user_key)} · ${Number(row.balance || 0)} баллов</option>`).join("");
  const planOptions = rows => rows.filter(row => row.active !== false).map(row => `<option value="${esc(row.id)}">${esc(row.name)} · ${Number(row.days || 30)} дней</option>`).join("");
  const eventOptions = rows => `<option value="">Не выбрано</option>${rows.map(row => `<option value="${esc(row.id)}" data-title="${esc(row.title)}">${esc(row.title)}</option>`).join("")}`;

  function actions(kind, id) {
    return `<div class="loyalty-prod-actions"><button class="ghost" type="button" data-loyalty-edit="${kind}" data-id="${esc(id)}">Изменить</button><button class="danger" type="button" data-loyalty-hide="${kind}" data-id="${esc(id)}">Скрыть</button></div>`;
  }

  function planRows() {
    return snapshot.plans.length ? snapshot.plans.map(row => {
      const privileges = Array.isArray(row.privileges) ? row.privileges : [];
      return `<article class="loyalty-prod-row" style="--vip-color:${esc(row.color || "#c8ff3d")}"><div><h4><span class="loyalty-prod-dot"></span>${esc(row.name)}</h4><p>${Number(row.days || 30)} дней · ${Number(row.points_price || 0)} баллов · скидка ${Number(row.discount || 0)}% · ×${Number(row.points_multiplier || 1)}<br>${privileges.length ? esc(privileges.join(" · ")) : "Привилегии не указаны"}</p></div>${actions("plan", row.id)}</article>`;
    }).join("") : '<div class="empty">VIP-тарифов пока нет</div>';
  }

  function membershipRows() {
    return snapshot.memberships.length ? snapshot.memberships.map(row => {
      const user = snapshot.users.find(item => item.user_key === row.user_key);
      const plan = snapshot.plans.find(item => item.id === row.plan_id);
      return `<article class="loyalty-prod-row" style="--vip-color:${esc(plan?.color || "#c8ff3d")}"><div><h4><span class="loyalty-prod-dot"></span>${esc(user?.name || row.user_key)} · ${esc(row.plan_name || plan?.name || row.plan_id)}</h4><p>Действует до ${new Date(row.expires_at).toLocaleString("ru-RU")} · ${esc(row.source || "admin")}</p></div><div class="loyalty-prod-actions"><button class="danger" type="button" data-loyalty-revoke-vip="${esc(row.id)}">Отключить</button></div></article>`;
    }).join("") : '<div class="empty">Активных VIP-статусов пока нет</div>';
  }

  function rewardRows() {
    return snapshot.rewards.length ? snapshot.rewards.map(row => `<article class="loyalty-prod-row"><div><h4>${esc(row.icon || "🏆")} ${esc(row.title)}</h4><p>${esc(row.description || "Без описания")}<br>+${Number(row.xp || 0)} XP · +${Number(row.points_reward || 0)} баллов · ${esc(row.condition_type || "manual")} · ${row.active !== false ? "активна" : "скрыта"}</p></div>${actions("reward", row.id)}</article>`).join("") : '<div class="empty">Наград пока нет</div>';
  }

  function giftRows() {
    return snapshot.gifts.length ? snapshot.gifts.map(row => `<article class="loyalty-prod-row"><div><h4>${esc(row.icon || "🎁")} ${esc(row.title)}</h4><p>${esc(row.category || "Подарки")} · ${Number(row.points_price || 0)} баллов · ${row.stock == null ? "без лимита" : `остаток ${Number(row.stock)}`}<br>${esc(row.description || "Без описания")} · ${row.active !== false ? "показывается" : "скрыт"}</p></div>${actions("gift", row.id)}</article>`).join("") : '<div class="empty">Подарков пока нет</div>';
  }

  async function mount() {
    if (rendering || typeof state === "undefined" || state.view !== "bonuses") return;
    const root = document.getElementById("content");
    if (!root) return;
    rendering = true;
    styles();
    root.innerHTML = '<section class="panel"><div class="empty">Загрузка баллов, VIP, наград и подарков…</div></section>';
    try {
      snapshot = await loadSnapshot();
      const warning = snapshot.errors.length ? '<div class="loyalty-prod-warning"><strong>Supabase настроен не полностью.</strong><br>Выполните файл <b>site/bali-production-fix-2026-07-24.sql</b> и обновите страницу.</div>' : "";
      root.innerHTML = `<div class="loyalty-prod" id="adminLoyaltyControlProduction">
        ${warning}
        <div class="loyalty-prod-stats"><article class="loyalty-prod-stat"><span>ПОЛЬЗОВАТЕЛИ</span><strong>${snapshot.users.length}</strong></article><article class="loyalty-prod-stat"><span>VIP-ТАРИФЫ</span><strong>${snapshot.plans.length}</strong></article><article class="loyalty-prod-stat"><span>АКТИВНЫЕ VIP</span><strong>${snapshot.memberships.length}</strong></article><article class="loyalty-prod-stat"><span>НАГРАДЫ</span><strong>${snapshot.rewards.length}</strong></article><article class="loyalty-prod-stat"><span>ПОДАРКИ</span><strong>${snapshot.gifts.length}</strong></article></div>

        <div class="loyalty-prod-grid">
          <section class="panel"><div class="panel-head"><h3>Баланс пользователя</h3></div><div class="panel-body"><form class="loyalty-prod-form" id="loyaltyPointsForm"><label><span>Пользователь</span><select name="user_key" required>${userOptions(snapshot.users)}</select></label><div class="loyalty-prod-two"><label><span>Операция</span><select name="operation"><option value="add">Начислить</option><option value="remove">Списать</option></select></label><label><span>Количество</span><input name="amount" type="number" min="1" value="100" required></label></div><label><span>Причина</span><input name="note" value="Корректировка администратора" required></label><button class="primary" ${snapshot.users.length ? "" : "disabled"}>Применить</button></form></div></section>
          <section class="panel"><div class="panel-head"><h3>Назначить VIP</h3></div><div class="panel-body"><form class="loyalty-prod-form" id="loyaltyVipAssignForm"><label><span>Пользователь</span><select name="user_key" required>${userOptions(snapshot.users)}</select></label><label><span>VIP-статус</span><select name="plan_id" required>${planOptions(snapshot.plans)}</select></label><label><span>Срок, дней</span><input name="days" type="number" min="1" value="30" required></label><button class="primary" ${snapshot.users.length && snapshot.plans.length ? "" : "disabled"}>Назначить статус</button></form></div></section>
        </div>

        <section class="panel"><div class="panel-head"><h3>Активные VIP пользователей</h3></div><div class="panel-body"><div class="loyalty-prod-list">${membershipRows()}</div></div></section>

        <div class="loyalty-prod-grid">
          <section class="panel"><div class="panel-head"><h3>Редактор VIP-статусов</h3></div><div class="panel-body"><form class="loyalty-prod-form" id="loyaltyPlanForm"><input name="id" type="hidden"><div class="loyalty-prod-two"><label><span>ID статуса</span><input name="new_id" placeholder="vip-plus" required></label><label><span>Название</span><input name="name" placeholder="BALI VIP" required></label></div><label><span>Описание</span><textarea name="description"></textarea></label><label><span>Привилегии — по одной в строке</span><textarea name="privileges" placeholder="Бесплатный вход\nСкидка 15%\nРаннее бронирование"></textarea></label><div class="loyalty-prod-three"><label><span>Срок, дней</span><input name="days" type="number" min="1" value="30"></label><label><span>Цена в баллах</span><input name="points_price" type="number" min="0" value="2500"></label><label class="loyalty-prod-color"><span>Цвет рамки</span><input name="color" type="color" value="#c8ff3d"></label></div><div class="loyalty-prod-three"><label><span>Скидка, %</span><input name="discount" type="number" min="0" max="100" value="10"></label><label><span>Множитель баллов</span><input name="points_multiplier" type="number" min="1" step="0.1" value="1.2"></label><label><span>Ранняя бронь, ч.</span><input name="early_booking_hours" type="number" min="0" value="0"></label></div><div class="loyalty-prod-two"><label><span>Гостевых проходов</span><input name="guest_passes" type="number" min="0" value="0"></label><label class="loyalty-prod-check"><span>Бесплатный вход</span><input name="free_entry" type="checkbox"></label></div><label class="loyalty-prod-check"><span>Активен</span><input name="active" type="checkbox" checked></label><button class="primary">Сохранить VIP</button><button class="ghost" type="button" data-loyalty-reset="plan">Очистить</button></form><div class="loyalty-prod-list" style="margin-top:12px">${planRows()}</div></div></section>

          <section class="panel"><div class="panel-head"><h3>Награды</h3></div><div class="panel-body"><form class="loyalty-prod-form" id="loyaltyRewardForm"><input name="id" type="hidden"><div class="loyalty-prod-two"><label><span>Название</span><input name="title" required></label><label><span>Иконка</span><input name="icon" value="🏆"></label></div><label><span>Описание</span><textarea name="description"></textarea></label><div class="loyalty-prod-three"><label><span>XP</span><input name="xp" type="number" min="0" value="100"></label><label><span>Баллы</span><input name="points_reward" type="number" min="0" value="0"></label><label><span>Порог</span><input name="threshold" type="number" min="1" value="1"></label></div><label><span>Условие</span><select name="condition_type"><option value="manual">Вручную</option><option value="event">За событие</option><option value="visits">За посещения</option><option value="anniversary">За годы с клубом</option></select></label><label><span>Событие</span><select name="event_id">${eventOptions(snapshot.events)}</select></label><label><span>Ссылка на изображение</span><input name="image_url"></label><label class="loyalty-prod-check"><span>Активна</span><input name="active" type="checkbox" checked></label><button class="primary">Сохранить награду</button><button class="ghost" type="button" data-loyalty-reset="reward">Очистить</button></form><form class="loyalty-prod-form" id="loyaltyGrantRewardForm" style="margin-top:14px"><h4 class="loyalty-prod-section-title">Выдать награду</h4><select name="user_key">${userOptions(snapshot.users)}</select><select name="reward_id">${snapshot.rewards.map(row => `<option value="${esc(row.id)}">${esc(row.title)}</option>`).join("")}</select><button class="primary" ${snapshot.users.length && snapshot.rewards.length ? "" : "disabled"}>Выдать</button></form><div class="loyalty-prod-list" style="margin-top:12px">${rewardRows()}</div></div></section>
        </div>

        <section class="panel"><div class="panel-head"><h3>Подарки</h3></div><div class="panel-body"><div class="loyalty-prod-grid"><form class="loyalty-prod-form" id="loyaltyGiftForm"><input name="id" type="hidden"><div class="loyalty-prod-two"><label><span>Название</span><input name="title" required></label><label><span>Категория</span><input name="category" value="Подарки"></label></div><label><span>Описание</span><textarea name="description"></textarea></label><div class="loyalty-prod-three"><label><span>Emoji</span><input name="icon" value="🎁"></label><label><span>Стоимость в баллах</span><input name="points_price" type="number" min="0" value="50"></label><label><span>Остаток</span><input name="stock" type="number" min="0" placeholder="Без лимита"></label></div><label><span>Ссылка на изображение</span><input name="image_url"></label><div class="loyalty-prod-two"><label><span>Доступен с</span><input name="available_from" type="datetime-local"></label><label><span>Доступен до</span><input name="available_until" type="datetime-local"></label></div><label class="loyalty-prod-check"><span>Показывать пользователям</span><input name="active" type="checkbox" checked></label><button class="primary">Сохранить подарок</button><button class="ghost" type="button" data-loyalty-reset="gift">Очистить</button></form><div><form class="loyalty-prod-form" id="loyaltyGrantGiftForm"><h4 class="loyalty-prod-section-title">Выдать подарок вручную</h4><select name="user_key">${userOptions(snapshot.users)}</select><select name="gift_id">${snapshot.gifts.map(row => `<option value="${esc(row.id)}">${esc(row.icon || "🎁")} ${esc(row.title)}</option>`).join("")}</select><label><span>Комментарий</span><input name="note" value="Подарок от BALI"></label><button class="primary" ${snapshot.users.length && snapshot.gifts.length ? "" : "disabled"}>Выдать подарок</button></form><div class="loyalty-prod-list" style="margin-top:12px">${giftRows()}</div></div></div></div></section>
      </div>`;
      bind(root);
    } catch (error) {
      root.innerHTML = `<section class="panel"><div class="admin-route-error"><strong>Баллы + VIP не загрузились</strong><p>${esc(error.message || "Ошибка Supabase")}</p><button class="primary" data-loyalty-retry>Повторить</button></div></section>`;
    } finally {
      rendering = false;
    }
  }

  const dataOf = form => Object.fromEntries(new FormData(form).entries());

  function reset(kind) {
    const form = document.getElementById(kind === "plan" ? "loyaltyPlanForm" : kind === "reward" ? "loyaltyRewardForm" : "loyaltyGiftForm");
    form?.reset();
    if (form?.elements?.id) form.elements.id.value = "";
    if (form?.active) form.active.checked = true;
    if (kind === "plan" && form?.color) form.color.value = "#c8ff3d";
  }

  async function savePlan(form) {
    const data = dataOf(form);
    const id = String(data.id || data.new_id || "").trim();
    if (!id) throw new Error("Укажите ID статуса");
    const payload = {
      id,
      name: String(data.name || "").trim(),
      description: String(data.description || "").trim(),
      privileges: String(data.privileges || "").split(/\r?\n|,/).map(item => item.trim()).filter(Boolean),
      color: String(data.color || "#c8ff3d"),
      days: Math.max(1, Number(data.days || 30)),
      points_price: Math.max(0, Number(data.points_price || 0)),
      discount: Math.max(0, Number(data.discount || 0)),
      points_multiplier: Math.max(1, Number(data.points_multiplier || 1)),
      early_booking_hours: Math.max(0, Number(data.early_booking_hours || 0)),
      guest_passes: Math.max(0, Number(data.guest_passes || 0)),
      free_entry: form.free_entry.checked,
      active: form.active.checked,
      sort_order: snapshot.plans.find(row => row.id === id)?.sort_order || snapshot.plans.length + 1,
    };
    const { error } = await store.client.from("vip_plans").upsert(payload);
    if (error) throw error;
    notify("VIP-статус сохранён");
  }

  async function saveReward(form) {
    const data = dataOf(form);
    const eventOption = form.event_id?.selectedOptions?.[0];
    const payload = {
      id: data.id || uuid("reward"),
      title: String(data.title || "").trim(),
      description: String(data.description || "").trim(),
      icon: String(data.icon || "🏆").trim() || "🏆",
      image_url: String(data.image_url || "").trim(),
      xp: Math.max(0, Number(data.xp || 0)),
      points_reward: Math.max(0, Number(data.points_reward || 0)),
      condition_type: data.condition_type || "manual",
      event_id: data.event_id || null,
      event_title: eventOption?.dataset?.title || "",
      threshold: Math.max(1, Number(data.threshold || 1)),
      active: form.active.checked,
      sort_order: snapshot.rewards.find(row => row.id === data.id)?.sort_order || snapshot.rewards.length + 1,
      updated_at: new Date().toISOString(),
    };
    const { error } = await store.client.from("loyalty_rewards").upsert(payload);
    if (error) throw error;
    notify("Награда сохранена");
  }

  async function saveGift(form) {
    const data = dataOf(form);
    const payload = {
      id: data.id || uuid("gift"),
      title: String(data.title || "").trim(),
      description: String(data.description || "").trim(),
      category: String(data.category || "Подарки").trim() || "Подарки",
      icon: String(data.icon || "🎁").trim() || "🎁",
      image_url: String(data.image_url || "").trim(),
      points_price: Math.max(0, Number(data.points_price || 0)),
      stock: data.stock === "" ? null : Math.max(0, Number(data.stock || 0)),
      available_from: toIso(data.available_from),
      available_until: toIso(data.available_until),
      active: form.active.checked,
      sort_order: snapshot.gifts.find(row => row.id === data.id)?.sort_order || snapshot.gifts.length + 1,
      updated_at: new Date().toISOString(),
    };
    const { error } = await store.client.from("loyalty_gifts").upsert(payload);
    if (error) throw error;
    notify("Подарок сохранён");
  }

  async function grantReward(form) {
    const data = dataOf(form);
    const user = snapshot.users.find(row => row.user_key === data.user_key);
    const reward = snapshot.rewards.find(row => row.id === data.reward_id);
    if (!user || !reward) throw new Error("Выберите пользователя и награду");
    const { error } = await store.client.from("loyalty_reward_grants").insert({ reward_id: reward.id, user_key: user.user_key, user_name: user.name || "Гость BALI", source: "admin_manual", xp: Number(reward.xp || 0) });
    if (error) throw error;
    if (Number(reward.points_reward || 0) > 0) {
      const result = await store.client.rpc("admin_adjust_points", { p_user_key: user.user_key, p_delta: Number(reward.points_reward), p_note: `Награда: ${reward.title}` });
      if (result.error) throw result.error;
    }
    notify("Награда выдана");
  }

  async function grantGift(form) {
    const data = dataOf(form);
    const user = snapshot.users.find(row => row.user_key === data.user_key);
    const gift = snapshot.gifts.find(row => row.id === data.gift_id);
    if (!user || !gift) throw new Error("Выберите пользователя и подарок");
    const { error } = await store.client.from("loyalty_gift_grants").insert({ gift_id: gift.id, gift_title: gift.title, gift_icon: gift.icon || "🎁", from_user_key: null, from_name: "BALI", user_key: user.user_key, user_name: user.name || "Гость BALI", points_price: 0, note: String(data.note || "Подарок от BALI").trim(), status: "active" });
    if (error) throw error;
    notify("Подарок выдан");
  }

  function bind(root) {
    root.addEventListener("submit", async event => {
      event.preventDefault();
      const form = event.target;
      try {
        if (form.id === "loyaltyPointsForm") {
          const data = dataOf(form);
          const delta = Math.max(1, Number(data.amount || 0)) * (data.operation === "remove" ? -1 : 1);
          const result = await store.client.rpc("admin_adjust_points", { p_user_key: data.user_key, p_delta: delta, p_note: String(data.note || "Корректировка администратора") });
          if (result.error) throw result.error;
          notify(`Баланс обновлён: ${Number(result.data || 0)}`);
        } else if (form.id === "loyaltyVipAssignForm") {
          const data = dataOf(form);
          const result = await store.client.rpc("admin_set_vip", { p_user_key: data.user_key, p_plan_id: data.plan_id, p_days: Math.max(1, Number(data.days || 30)) });
          if (result.error) throw result.error;
          notify("VIP назначен");
        } else if (form.id === "loyaltyPlanForm") await savePlan(form);
        else if (form.id === "loyaltyRewardForm") await saveReward(form);
        else if (form.id === "loyaltyGiftForm") await saveGift(form);
        else if (form.id === "loyaltyGrantRewardForm") await grantReward(form);
        else if (form.id === "loyaltyGrantGiftForm") await grantGift(form);
        await mount();
      } catch (error) {
        notify(error.message || "Операция не выполнена");
      }
    }, true);

    root.addEventListener("click", async event => {
      if (event.target.closest("[data-loyalty-retry]")) return mount();
      const resetButton = event.target.closest("[data-loyalty-reset]");
      if (resetButton) return reset(resetButton.dataset.loyaltyReset);

      const edit = event.target.closest("[data-loyalty-edit]");
      if (edit) {
        const kind = edit.dataset.loyaltyEdit;
        const id = edit.dataset.id;
        const row = (kind === "plan" ? snapshot.plans : kind === "reward" ? snapshot.rewards : snapshot.gifts).find(item => String(item.id) === String(id));
        if (!row) return;
        const form = document.getElementById(kind === "plan" ? "loyaltyPlanForm" : kind === "reward" ? "loyaltyRewardForm" : "loyaltyGiftForm");
        if (!form) return;
        for (const [key, value] of Object.entries(row)) {
          const field = form.elements?.[key];
          if (!field || field.type === "checkbox") continue;
          if (key === "privileges") field.value = Array.isArray(value) ? value.join("\n") : "";
          else if (key === "available_from" || key === "available_until") field.value = toLocal(value);
          else field.value = value ?? "";
        }
        if (kind === "plan") form.new_id.value = row.id;
        if (form.active) form.active.checked = row.active !== false;
        if (form.free_entry) form.free_entry.checked = Boolean(row.free_entry);
        form.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      const revoke = event.target.closest("[data-loyalty-revoke-vip]");
      if (revoke) {
        if (!confirm("Отключить VIP-статус у пользователя?")) return;
        const result = await store.client.rpc("admin_revoke_vip", { p_membership_id: revoke.dataset.loyaltyRevokeVip });
        if (result.error) return notify(result.error.message || "Не удалось отключить VIP");
        notify("VIP отключён");
        return mount();
      }

      const hide = event.target.closest("[data-loyalty-hide]");
      if (hide) {
        if (!confirm("Скрыть эту запись из приложения?")) return;
        const table = hide.dataset.loyaltyHide === "plan" ? "vip_plans" : hide.dataset.loyaltyHide === "reward" ? "loyalty_rewards" : "loyalty_gifts";
        const { error } = await store.client.from(table).update({ active: false }).eq("id", hide.dataset.id);
        if (error) return notify(error.message || "Не удалось скрыть запись");
        notify("Запись скрыта");
        return mount();
      }
    }, true);
  }

  const baseRender = window.render;
  if (typeof baseRender === "function") {
    window.render = async function(...args) {
      const result = await baseRender.apply(this, args);
      if (typeof state !== "undefined" && state.view === "bonuses") await mount();
      return result;
    };
  }

  window.addEventListener("bali:data-changed", () => {
    if (typeof state !== "undefined" && state.view === "bonuses") mount();
  });
  setTimeout(mount, 60);
  window.BaliAdminLoyaltyControl = { mount };
})();
