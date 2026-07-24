(() => {
  if (window.__BALI_ADMIN_LOYALTY_PRODUCTION__) return;
  window.__BALI_ADMIN_LOYALTY_PRODUCTION__ = true;

  const store = window.BaliStore;
  if (!store?.client) return;

  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);
  const toast = message => window.toast ? window.toast(message) : console.info(message);
  const uid = prefix => `${prefix}-${crypto.randomUUID?.() || Date.now()}`;
  const tableFor = kind => kind === "plan" ? "vip_plans" : kind === "reward" ? "loyalty_rewards" : "loyalty_gifts";
  const formFor = kind => document.getElementById(kind === "plan" ? "prodPlanForm" : kind === "reward" ? "prodRewardForm" : "prodGiftForm");

  let dataState = {
    users: [], plans: [], rewards: [], gifts: [], events: [], settings: null,
    rewardsError: null, giftsError: null, settingsError: null
  };

  function addStyles() {
    if (document.getElementById("baliProductionLoyaltyStyle")) return;
    const style = document.createElement("style");
    style.id = "baliProductionLoyaltyStyle";
    style.textContent = `
      #content[data-production-loyalty="1"] > :not(#productionLoyaltyControl){display:none!important}
      .prod-loyalty{display:grid;gap:14px}
      .prod-loyalty-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
      .prod-loyalty .panel{margin:0}
      .prod-form{display:grid;gap:9px}
      .prod-form label{display:grid;gap:5px;color:var(--muted);font-size:9px;font-weight:800}
      .prod-form input,.prod-form textarea,.prod-form select{width:100%;min-height:43px;padding:9px 11px;border:1px solid var(--line);border-radius:11px;background:#111614;color:#fff}
      .prod-form textarea{min-height:78px;resize:vertical}
      .prod-two{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      .prod-list{display:grid;gap:8px}
      .prod-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:11px;border:1px solid var(--line);border-radius:13px;background:#ffffff04}
      .prod-row h4{margin:0;font-size:11px}.prod-row p{margin:4px 0 0;color:var(--muted);font-size:8px;line-height:1.45}
      .prod-actions{display:flex;gap:6px;flex-wrap:wrap}.prod-actions button{min-height:33px;padding:0 8px}
      .prod-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}
      .prod-stat{padding:13px;border:1px solid var(--line);border-radius:15px;background:#ffffff04}
      .prod-stat span{display:block;color:var(--muted);font-size:8px}.prod-stat strong{display:block;margin-top:6px;color:var(--lime);font:700 20px Unbounded}
      .prod-schema-warning{padding:14px;border:1px solid rgba(255,190,70,.3);border-radius:14px;background:rgba(255,190,70,.07);color:#f1d493;font-size:10px;line-height:1.55}
      .prod-check{display:flex!important;align-items:center;justify-content:space-between}.prod-check input{width:22px;min-height:22px}
      .prod-section-title{margin:0 0 10px;font-size:14px}
      @media(max-width:850px){.prod-loyalty-grid,.prod-stats{grid-template-columns:1fr}.prod-two{grid-template-columns:1fr}.prod-row{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  async function select(table, order) {
    try {
      let query = store.client.from(table).select("*");
      if (order) query = query.order(order);
      const { data, error } = await query;
      if (error) throw error;
      return { rows: data || [], error: null };
    } catch (error) {
      return { rows: [], error };
    }
  }

  function mergeUsers(appUsers, accounts) {
    const map = new Map();
    accounts.forEach(row => {
      if (row.user_key) map.set(String(row.user_key), { ...row, balance: Number(row.balance || 0) });
    });
    appUsers.forEach(user => {
      if (!user.user_key) return;
      const key = String(user.user_key);
      map.set(key, { ...(map.get(key) || {}), ...user, user_key: key, balance: Number(map.get(key)?.balance || 0) });
    });
    return [...map.values()].sort((a, b) => String(a.name || a.user_key).localeCompare(String(b.name || b.user_key), "ru"));
  }

  async function loadData() {
    const [users, accounts, plans, rewards, gifts, events, settings] = await Promise.all([
      select("app_users", "name"),
      select("points_accounts", "name"),
      select("vip_plans", "sort_order"),
      select("loyalty_rewards", "sort_order"),
      select("loyalty_gifts", "sort_order"),
      select("events", "event_date"),
      select("loyalty_settings")
    ]);
    dataState = {
      users: mergeUsers(users.rows, accounts.rows),
      plans: plans.rows,
      rewards: rewards.rows,
      gifts: gifts.rows,
      events: events.rows,
      settings: settings.rows[0] || null,
      rewardsError: rewards.error,
      giftsError: gifts.error,
      settingsError: settings.error
    };
    return dataState;
  }

  const userOptions = rows => rows.map(row =>
    `<option value="${esc(row.user_key)}">${esc(row.name || "Гость BALI")} · ${esc(row.username || row.phone || row.user_key)} · ${Number(row.balance || 0)} баллов</option>`
  ).join("");

  const planOptions = rows => rows.filter(row => row.active !== false).map(row =>
    `<option value="${esc(row.id)}">${esc(row.name)} · ${Number(row.days || 30)} дней</option>`
  ).join("");

  const eventOptions = rows => `<option value="">Не выбрано</option>${rows.map(row =>
    `<option value="${esc(row.id)}" data-title="${esc(row.title)}">${esc(row.title)}</option>`
  ).join("")}`;

  const actions = (kind, id) => `<div class="prod-actions">
    <button class="ghost" type="button" data-prod-edit="${kind}" data-id="${esc(id)}">Изменить</button>
    <button class="danger" type="button" data-prod-delete="${kind}" data-id="${esc(id)}">Удалить</button>
  </div>`;

  function plansList(rows) {
    return rows.length ? rows.map(row => `<article class="prod-row"><div><h4>${esc(row.name)}</h4>
      <p>${Number(row.days || 30)} дней · ${Number(row.points_price || 0)} баллов · скидка ${Number(row.discount || 0)}% · множитель ${Number(row.points_multiplier || 1)}</p>
      </div>${actions("plan", row.id)}</article>`).join("") : '<div class="empty">VIP-тарифов пока нет</div>';
  }

  function rewardsList(rows) {
    return rows.length ? rows.map(row => `<article class="prod-row"><div><h4>${esc(row.title)}</h4>
      <p>${esc(row.description || "Без описания")}<br>+${Number(row.xp || 0)} XP · ${esc(row.condition_type || "manual")} · ${row.active !== false ? "активна" : "скрыта"}</p>
      </div>${actions("reward", row.id)}</article>`).join("") : '<div class="empty">Наград пока нет</div>';
  }

  function giftsList(rows) {
    return rows.length ? rows.map(row => `<article class="prod-row"><div><h4>${esc(row.icon || "🎁")} ${esc(row.title)}</h4>
      <p>${esc(row.description || "Без описания")}<br>${Number(row.points_price || 0)} BALI-Баллов · ${row.active !== false ? "показывается" : "скрыт"}</p>
      </div>${actions("gift", row.id)}</article>`).join("") : '<div class="empty">Подарков пока нет</div>';
  }

  function settingsForm(settings = {}) {
    return `<form class="prod-form" id="prodSettingsForm">
      <div class="prod-two">
        <label><span>За приглашение друга</span><input name="referral_points" type="number" min="0" value="${Number(settings.referral_points ?? 50)}"></label>
        <label><span>За подтверждённое посещение</span><input name="attendance_points" type="number" min="0" value="${Number(settings.attendance_points ?? 100)}"></label>
      </div>
      <div class="prod-two">
        <label><span>За репост события</span><input name="event_share_points" type="number" min="0" value="${Number(settings.event_share_points ?? 10)}"></label>
        <label><span>За отзыв</span><input name="review_points" type="number" min="0" value="${Number(settings.review_points ?? 100)}"></label>
      </div>
      <label><span>Сколько баллов стоит 1 фишка</span><input name="chip_rate_points" type="number" min="1" value="${Number(settings.chip_rate_points ?? 100)}"></label>
      <button class="primary">Сохранить правила начисления</button>
    </form>`;
  }

  async function mount() {
    if (typeof state === "undefined" || state.view !== "bonuses") return;
    addStyles();
    const root = document.getElementById("content");
    if (!root) return;
    root.dataset.productionLoyalty = "1";
    root.innerHTML = '<div class="empty">Загрузка баллов, VIP, наград и подарков…</div>';

    await loadData();
    const missing = dataState.rewardsError || dataState.giftsError || dataState.settingsError;

    root.innerHTML = `<div class="prod-loyalty" id="productionLoyaltyControl">
      ${missing ? '<div class="prod-schema-warning"><strong>Не завершена структура Supabase.</strong><br>Выполните файл <b>site/bali-production-finalize.sql</b> в SQL Editor. После этого заработают отзывы, награды, подарки и правила начисления.</div>' : ""}
      <div class="prod-stats">
        <article class="prod-stat"><span>ПОЛЬЗОВАТЕЛИ</span><strong>${dataState.users.length}</strong></article>
        <article class="prod-stat"><span>VIP-ТАРИФЫ</span><strong>${dataState.plans.length}</strong></article>
        <article class="prod-stat"><span>НАГРАДЫ</span><strong>${dataState.rewards.length}</strong></article>
        <article class="prod-stat"><span>ПОДАРКИ</span><strong>${dataState.gifts.length}</strong></article>
      </div>

      <div class="prod-loyalty-grid">
        <section class="panel"><div class="panel-head"><h3>Начислить или списать баллы</h3></div><div class="panel-body">
          <form class="prod-form" id="prodPointsForm">
            <label><span>Пользователь</span><select name="user_key" required>${userOptions(dataState.users)}</select></label>
            <div class="prod-two"><label><span>Операция</span><select name="operation"><option value="add">Начислить</option><option value="remove">Списать</option></select></label>
            <label><span>Количество</span><input name="amount" type="number" min="1" value="100" required></label></div>
            <label><span>Причина</span><input name="note" value="Корректировка администратора" required></label>
            <button class="primary" ${dataState.users.length ? "" : "disabled"}>Применить</button>
          </form>
        </div></section>
        <section class="panel"><div class="panel-head"><h3>Назначить VIP пользователю</h3></div><div class="panel-body">
          <form class="prod-form" id="prodVipAssignForm">
            <label><span>Пользователь</span><select name="user_key" required>${userOptions(dataState.users)}</select></label>
            <label><span>VIP-статус</span><select name="plan_id" required>${planOptions(dataState.plans)}</select></label>
            <label><span>Срок, дней</span><input name="days" type="number" min="1" value="30" required></label>
            <button class="primary" ${dataState.users.length && dataState.plans.length ? "" : "disabled"}>Назначить VIP</button>
          </form>
        </div></section>
      </div>

      <div class="prod-loyalty-grid">
        <section class="panel"><div class="panel-head"><h3>Редактор VIP-статусов</h3></div><div class="panel-body">
          <form class="prod-form" id="prodPlanForm">
            <input name="id" type="hidden">
            <div class="prod-two"><label><span>ID тарифа</span><input name="new_id" placeholder="vip-plus" required></label>
            <label><span>Название</span><input name="name" placeholder="BALI VIP" required></label></div>
            <div class="prod-two"><label><span>Срок, дней</span><input name="days" type="number" min="1" value="30"></label>
            <label><span>Цена в баллах</span><input name="points_price" type="number" min="0" value="2500"></label></div>
            <div class="prod-two"><label><span>Скидка, %</span><input name="discount" type="number" min="0" max="100" value="10"></label>
            <label><span>Множитель баллов</span><input name="points_multiplier" type="number" min="1" step="0.1" value="1.2"></label></div>
            <label class="prod-check"><span>Активен</span><input name="active" type="checkbox" checked></label>
            <button class="primary">Сохранить VIP-тариф</button><button class="ghost" type="button" data-prod-reset="plan">Очистить</button>
          </form>
          <div class="prod-list" style="margin-top:12px">${plansList(dataState.plans)}</div>
        </div></section>

        <section class="panel"><div class="panel-head"><h3>Правила начисления</h3></div><div class="panel-body">
          ${dataState.settingsError ? '<div class="empty">Таблица настроек ещё не создана</div>' : settingsForm(dataState.settings)}
        </div></section>
      </div>

      <div class="prod-loyalty-grid">
        <section class="panel"><div class="panel-head"><h3>Создание и выдача наград</h3></div><div class="panel-body">
          ${dataState.rewardsError ? '<div class="empty">Таблица наград ещё не создана</div>' : `<form class="prod-form" id="prodRewardForm">
            <input name="id" type="hidden">
            <label><span>Название</span><input name="title" required></label>
            <label><span>Описание</span><textarea name="description"></textarea></label>
            <div class="prod-two"><label><span>XP</span><input name="xp" type="number" min="0" value="100"></label>
            <label><span>Условие</span><select name="condition_type"><option value="manual">Вручную</option><option value="event">За событие</option><option value="visits">За посещения</option><option value="anniversary">За годы с клубом</option></select></label></div>
            <label><span>Событие</span><select name="event_id">${eventOptions(dataState.events)}</select></label>
            <div class="prod-two"><label><span>Порог</span><input name="threshold" type="number" min="1" value="1"></label>
            <label><span>Ссылка на изображение</span><input name="image_url"></label></div>
            <label class="prod-check"><span>Активна</span><input name="active" type="checkbox" checked></label>
            <button class="primary">Сохранить награду</button><button class="ghost" type="button" data-prod-reset="reward">Очистить</button>
          </form>
          <form class="prod-form" id="prodGrantRewardForm" style="margin-top:14px">
            <h4 class="prod-section-title">Выдать награду пользователю</h4>
            <select name="user_key">${userOptions(dataState.users)}</select>
            <select name="reward_id">${dataState.rewards.map(row => `<option value="${esc(row.id)}">${esc(row.title)}</option>`).join("")}</select>
            <button class="primary" ${dataState.users.length && dataState.rewards.length ? "" : "disabled"}>Выдать награду</button>
          </form>
          <div class="prod-list" style="margin-top:12px">${rewardsList(dataState.rewards)}</div>`}
        </div></section>

        <section class="panel"><div class="panel-head"><h3>Каталог подарков</h3></div><div class="panel-body">
          ${dataState.giftsError ? '<div class="empty">Таблица подарков ещё не создана</div>' : `<form class="prod-form" id="prodGiftForm">
            <input name="id" type="hidden">
            <label><span>Название</span><input name="title" required></label>
            <label><span>Описание</span><textarea name="description"></textarea></label>
            <div class="prod-two"><label><span>Emoji</span><input name="icon" value="🎁"></label>
            <label><span>Стоимость в баллах</span><input name="points_price" type="number" min="0" value="50"></label></div>
            <label><span>Ссылка на изображение</span><input name="image_url"></label>
            <label class="prod-check"><span>Показывать пользователям</span><input name="active" type="checkbox" checked></label>
            <button class="primary">Сохранить подарок</button><button class="ghost" type="button" data-prod-reset="gift">Очистить</button>
          </form>
          <form class="prod-form" id="prodGrantGiftForm" style="margin-top:14px">
            <h4 class="prod-section-title">Выдать подарок пользователю</h4>
            <select name="user_key">${userOptions(dataState.users)}</select>
            <select name="gift_id">${dataState.gifts.map(row => `<option value="${esc(row.id)}">${esc(row.title)}</option>`).join("")}</select>
            <input name="note" placeholder="Комментарий" value="Подарок от BALI">
            <button class="primary" ${dataState.users.length && dataState.gifts.length ? "" : "disabled"}>Выдать подарок</button>
          </form>
          <div class="prod-list" style="margin-top:12px">${giftsList(dataState.gifts)}</div>`}
        </div></section>
      </div>
    </div>`;

    bind(root);
  }

  function formData(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  function resetForm(kind) {
    const form = formFor(kind);
    form?.reset();
    if (form?.elements?.id) form.elements.id.value = "";
    if (form?.elements?.active) form.elements.active.checked = true;
    if (kind === "plan" && form?.elements?.new_id) form.elements.new_id.readOnly = false;
  }

  async function savePlan(form) {
    const values = formData(form);
    const id = String(values.id || values.new_id || "").trim();
    if (!id) throw new Error("Укажите ID тарифа");
    const previous = dataState.plans.find(row => String(row.id) === id);
    const payload = {
      id,
      name: String(values.name || "").trim(),
      days: Number(values.days || 30),
      points_price: Number(values.points_price || 0),
      discount: Number(values.discount || 0),
      points_multiplier: Number(values.points_multiplier || 1),
      active: form.elements.active.checked,
      sort_order: previous?.sort_order || dataState.plans.length + 1
    };
    const { error } = await store.client.from("vip_plans").upsert(payload);
    if (error) throw error;
  }

  async function saveReward(form) {
    const values = formData(form);
    const eventOption = form.elements.event_id?.selectedOptions?.[0];
    const previous = dataState.rewards.find(row => String(row.id) === String(values.id));
    const payload = {
      id: values.id || uid("reward"),
      title: String(values.title || "").trim(),
      description: String(values.description || "").trim(),
      image_url: String(values.image_url || "").trim(),
      xp: Number(values.xp || 0),
      condition_type: values.condition_type || "manual",
      event_id: values.event_id || null,
      event_title: eventOption?.dataset?.title || "",
      threshold: Number(values.threshold || 1),
      active: form.elements.active.checked,
      sort_order: previous?.sort_order || dataState.rewards.length + 1,
      updated_at: new Date().toISOString()
    };
    const { error } = await store.client.from("loyalty_rewards").upsert(payload);
    if (error) throw error;
  }

  async function saveGift(form) {
    const values = formData(form);
    const previous = dataState.gifts.find(row => String(row.id) === String(values.id));
    const payload = {
      id: values.id || uid("gift"),
      title: String(values.title || "").trim(),
      description: String(values.description || "").trim(),
      icon: String(values.icon || "🎁").trim() || "🎁",
      image_url: String(values.image_url || "").trim(),
      points_price: Number(values.points_price || 0),
      active: form.elements.active.checked,
      sort_order: previous?.sort_order || dataState.gifts.length + 1,
      updated_at: new Date().toISOString()
    };
    const { error } = await store.client.from("loyalty_gifts").upsert(payload);
    if (error) throw error;
  }

  function bind(root) {
    if (root.dataset.prodLoyaltyBound === "1") return;
    root.dataset.prodLoyaltyBound = "1";

    root.addEventListener("submit", async event => {
      const form = event.target.closest(".prod-form");
      if (!form) return;
      event.preventDefault();
      try {
        if (form.id === "prodPointsForm") {
          const values = formData(form);
          const delta = Math.max(1, Number(values.amount || 0)) * (values.operation === "remove" ? -1 : 1);
          const { data, error } = await store.client.rpc("admin_adjust_points", {
            p_user_key: values.user_key, p_delta: delta, p_note: values.note
          });
          if (error) throw error;
          toast(`Баланс обновлён: ${Number(data || 0)}`);
        } else if (form.id === "prodVipAssignForm") {
          const values = formData(form);
          const { error } = await store.client.rpc("admin_set_vip", {
            p_user_key: values.user_key, p_plan_id: values.plan_id, p_days: Number(values.days || 30)
          });
          if (error) throw error;
          toast("VIP назначен");
        } else if (form.id === "prodPlanForm") {
          await savePlan(form); toast("VIP-тариф сохранён");
        } else if (form.id === "prodSettingsForm") {
          const values = formData(form);
          const { error } = await store.client.from("loyalty_settings").upsert({
            id: "main",
            referral_points: Number(values.referral_points || 0),
            attendance_points: Number(values.attendance_points || 0),
            event_share_points: Number(values.event_share_points || 0),
            review_points: Number(values.review_points || 0),
            chip_rate_points: Math.max(1, Number(values.chip_rate_points || 1)),
            updated_at: new Date().toISOString()
          });
          if (error) throw error;
          toast("Правила начисления сохранены");
        } else if (form.id === "prodRewardForm") {
          await saveReward(form); toast("Награда сохранена");
        } else if (form.id === "prodGiftForm") {
          await saveGift(form); toast("Подарок сохранён");
        } else if (form.id === "prodGrantRewardForm") {
          const values = formData(form);
          const reward = dataState.rewards.find(row => String(row.id) === String(values.reward_id));
          const user = dataState.users.find(row => String(row.user_key) === String(values.user_key));
          const { error } = await store.client.from("loyalty_reward_grants").insert({
            reward_id: values.reward_id,
            user_key: values.user_key,
            user_name: user?.name || "Гость BALI",
            source: "admin_manual",
            xp: Number(reward?.xp || 0)
          });
          if (error) throw error;
          toast("Награда выдана");
        } else if (form.id === "prodGrantGiftForm") {
          const values = formData(form);
          const gift = dataState.gifts.find(row => String(row.id) === String(values.gift_id));
          const user = dataState.users.find(row => String(row.user_key) === String(values.user_key));
          const { error } = await store.client.from("loyalty_gift_grants").insert({
            gift_id: values.gift_id,
            gift_title: gift?.title || "Подарок BALI",
            gift_icon: gift?.icon || "🎁",
            from_name: "BALI",
            user_key: values.user_key,
            user_name: user?.name || "Гость BALI",
            points_price: 0,
            note: String(values.note || ""),
            status: "active"
          });
          if (error) throw error;
          toast("Подарок выдан");
        }
        await mount();
      } catch (error) {
        toast(error?.message || "Операция не выполнена");
      }
    }, true);

    root.addEventListener("click", async event => {
      const reset = event.target.closest("[data-prod-reset]");
      if (reset) {
        resetForm(reset.dataset.prodReset);
        return;
      }

      const edit = event.target.closest("[data-prod-edit]");
      if (edit) {
        const kind = edit.dataset.prodEdit;
        const rows = kind === "plan" ? dataState.plans : kind === "reward" ? dataState.rewards : dataState.gifts;
        const row = rows.find(item => String(item.id) === String(edit.dataset.id));
        const form = formFor(kind);
        if (!row || !form) return;
        Object.entries(row).forEach(([key, value]) => {
          const field = form.elements[key];
          if (field && field.type !== "checkbox") field.value = value ?? "";
        });
        if (form.elements.id) form.elements.id.value = row.id;
        if (kind === "plan" && form.elements.new_id) {
          form.elements.new_id.value = row.id;
          form.elements.new_id.readOnly = true;
        }
        if (form.elements.active) form.elements.active.checked = row.active !== false;
        form.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      const remove = event.target.closest("[data-prod-delete]");
      if (remove) {
        if (!confirm("Удалить запись?")) return;
        const { error } = await store.client.from(tableFor(remove.dataset.prodDelete)).delete().eq("id", remove.dataset.id);
        if (error) return toast(error.message || "Не удалось удалить");
        toast("Удалено");
        await mount();
      }
    }, true);
  }

  const baseRender = window.render;
  if (typeof baseRender === "function") {
    window.render = async function(...args) {
      const result = await baseRender.apply(this, args);
      const root = document.getElementById("content");
      if (typeof state !== "undefined" && state.view === "bonuses") {
        await mount();
      } else if (root) {
        delete root.dataset.productionLoyalty;
      }
      return result;
    };
  }

  setTimeout(mount, 250);
})();