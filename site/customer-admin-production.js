(() => {
  if (window.__BALI_CUSTOMER_ADMIN_PRODUCTION__) return;
  window.__BALI_CUSTOMER_ADMIN_PRODUCTION__ = true;

  const store = window.BaliStore;
  if (!store) return;

  const safe = (value = "") => String(value).replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);
  const digits = value => String(value || "").replace(/\D/g, "");
  const normalizeUsername = value => String(value || "").trim().replace(/^@/, "").toLowerCase();
  const fmt = value => value ? new Date(value).toLocaleString("ru-RU", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
  }) : "—";

  function styles() {
    if (document.getElementById("customerAdminProductionStyle")) return;
    const style = document.createElement("style");
    style.id = "customerAdminProductionStyle";
    style.textContent = `
      .customer-person{display:flex;align-items:center;gap:10px;min-width:210px}.customer-avatar{--customer-ring:#46524b;display:grid;place-items:center;flex:0 0 auto;width:44px;height:44px;overflow:hidden;border:3px solid var(--customer-ring);border-radius:50%;background:#151a17;color:#dfff7c;font-weight:900;box-shadow:0 0 12px color-mix(in srgb,var(--customer-ring) 38%,transparent)}.customer-avatar img{width:100%;height:100%;object-fit:cover}.customer-copy{min-width:0}.customer-copy strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.customer-copy small{display:block;margin-top:3px;color:var(--muted)}.customer-vip{display:inline-flex;margin-top:5px;padding:4px 7px;border:1px solid var(--customer-ring,#c8ff3d);border-radius:999px;background:color-mix(in srgb,var(--customer-ring,#c8ff3d) 10%,transparent);color:var(--customer-ring,#c8ff3d);font-size:7px;font-weight:900}.customer-source{display:inline-flex;margin-top:4px;padding:3px 6px;border-radius:999px;background:#ffffff08;color:var(--muted);font-size:7px}
    `;
    document.head.appendChild(style);
  }

  function fallbackColor(planId = "") {
    const id = String(planId).toLowerCase();
    if (id.includes("legend") || id.includes("gold")) return "#e3bd64";
    if (id.includes("black")) return "#a7b0bd";
    return "#c8ff3d";
  }

  async function cloudList(table, options = {}) {
    if (!store.cloudEnabled || !store.client) return [];
    try {
      let query = store.client.from(table).select(options.select || "*");
      if (options.order) query = query.order(options.order, { ascending: options.ascending !== false });
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.warn(`[BALI customers] ${table}:`, error.message);
      return [];
    }
  }

  function identityCandidates(row = {}) {
    const keys = [];
    const userKey = String(row.user_key || row.userKey || "").trim();
    const telegramId = String(row.telegram_id || row.telegramId || "").trim();
    const phone = digits(row.phone);
    const username = normalizeUsername(row.username || row.telegram_username || row.telegram);
    if (userKey) keys.push(`u:${userKey}`);
    if (telegramId) keys.push(`t:${telegramId}`);
    if (phone) keys.push(`p:${phone}`);
    if (username) keys.push(`n:${username}`);
    return keys;
  }

  function mergePeople(sources) {
    const records = [];
    const aliases = new Map();

    function attachAliases(record) {
      identityCandidates(record).forEach(key => aliases.set(key, record));
    }

    function findRecord(row) {
      for (const key of identityCandidates(row)) {
        const record = aliases.get(key);
        if (record) return record;
      }
      return null;
    }

    function apply(row, source) {
      if (!row) return;
      let record = findRecord(row);
      if (!record) {
        record = { __sources: new Set(), __order: records.length };
        records.push(record);
      }
      const previousAvatar = record.avatar || record.photo || "";
      const previousPhone = record.phone || "";
      const previousName = record.name || "";
      Object.assign(record, row);
      record.user_key = record.user_key || row.userKey || (row.telegram_id ? `tg:${row.telegram_id}` : "");
      record.telegram_id = record.telegram_id || row.telegramId || null;
      record.name = source === "telegram" ? (row.name || previousName || "Гость BALI") : (previousName || row.name || "Гость BALI");
      record.phone = previousPhone || row.phone || "";
      record.avatar = previousAvatar || row.avatar || row.photo || "";
      record.telegram_username = record.telegram_username || row.username || row.telegram || "";
      record.__sources.add(source);
      attachAliases(record);
    }

    sources.appUsers.forEach(row => apply(row, "telegram"));
    sources.accounts.forEach(row => apply(row, "points"));
    sources.manual.forEach(row => apply(row, "manual"));
    return records;
  }

  function initials(name) {
    return String(name || "B").trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase() || "B";
  }

  async function buildRows() {
    const [manual, appUsers, accounts, checkins, bookings, memberships, plans] = await Promise.all([
      store.list("customers").catch(() => []),
      cloudList("app_users", { order: "last_seen_at", ascending: false }),
      cloudList("points_accounts"),
      cloudList("event_checkins"),
      store.list("bookings").catch(() => []),
      cloudList("vip_memberships", { order: "expires_at", ascending: false }),
      cloudList("vip_plans"),
    ]);

    const rows = mergePeople({ manual, appUsers, accounts });
    const accountMap = new Map(accounts.map(row => [String(row.user_key || ""), row]));
    const planMap = new Map(plans.map(row => [String(row.id || ""), row]));
    const membershipMap = new Map();
    for (const membership of memberships) {
      if (new Date(membership.expires_at).getTime() <= Date.now()) continue;
      const key = String(membership.user_key || "");
      if (key && !membershipMap.has(key)) membershipMap.set(key, membership);
    }

    const checkinCount = new Map();
    checkins.forEach(row => {
      const key = String(row.user_key || (row.telegram_id ? `tg:${row.telegram_id}` : ""));
      if (key) checkinCount.set(key, (checkinCount.get(key) || 0) + 1);
    });

    return rows.map(row => {
      const userKey = String(row.user_key || (row.telegram_id ? `tg:${row.telegram_id}` : ""));
      const account = accountMap.get(userKey) || {};
      const membership = membershipMap.get(userKey) || null;
      const plan = membership ? planMap.get(String(membership.plan_id || "")) || {} : {};
      const completedBookings = bookings.filter(booking => booking.status === "completed" && (
        String(booking.customer_id || "") === String(row.id || "") ||
        (row.telegram_id && String(booking.telegram_id || "") === String(row.telegram_id)) ||
        (digits(row.phone) && digits(booking.phone) === digits(row.phone))
      )).length;
      return {
        ...row,
        user_key: userKey,
        balance: Number(account.balance ?? row.points_balance ?? row.balance ?? 0),
        visits_calculated: Math.max(Number(row.visits || 0), Number(checkinCount.get(userKey) || 0), completedBookings),
        last_seen: row.last_seen_at || row.updated_at || row.created_at || row.first_seen_at,
        vip: membership ? {
          ...membership,
          name: membership.plan_name || plan.name || membership.plan_id,
          color: plan.color || fallbackColor(membership.plan_id),
          privileges: Array.isArray(plan.privileges) ? plan.privileges : [],
        } : null,
        source_label: [...(row.__sources || [])].join(" + ") || "manual",
      };
    }).sort((a, b) => String(b.last_seen || "").localeCompare(String(a.last_seen || "")) || a.__order - b.__order);
  }

  function table(rows) {
    if (!rows.length) return '<div class="empty">Пользователи пока не зарегистрированы. После подтверждённого входа через Telegram запись появится здесь автоматически.</div>';
    return `<table class="data-table"><thead><tr><th>Пользователь</th><th>Telegram</th><th>Телефон</th><th>Посещения</th><th>Баллы</th><th>Входы</th><th>Последний вход</th><th></th></tr></thead><tbody>${rows.map(row => {
      const actions = row.id ? `<div class="row-actions"><button class="icon-btn" data-edit="customers" data-id="${safe(row.id)}">✎</button><button class="icon-btn" data-delete="customers" data-id="${safe(row.id)}">×</button></div>` : '<span class="status available">Telegram</span>';
      const avatar = row.avatar ? `<img src="${safe(row.avatar)}" alt="">` : safe(initials(row.name));
      const vip = row.vip ? `<span class="customer-vip" style="--customer-ring:${safe(row.vip.color)}" title="${safe((row.vip.privileges || []).join(" · "))}">${safe(row.vip.name)}</span>` : "";
      return `<tr><td><div class="customer-person"><span class="customer-avatar" style="--customer-ring:${safe(row.vip?.color || "#46524b")}">${avatar}</span><div class="customer-copy"><strong>${safe(row.name || "Гость BALI")}</strong><small>${safe(row.user_key || row.id || "—")}</small>${vip}<span class="customer-source">${safe(row.source_label)}</span></div></div></td><td>${safe(row.telegram_username || row.telegram || "—")}</td><td>${row.phone ? safe(row.phone) : '<span class="status pending">Не указан</span>'}</td><td>${Number(row.visits_calculated || 0)}</td><td><strong>${Number(row.balance || 0)}</strong></td><td>${Number(row.opens || 0)}</td><td>${safe(fmt(row.last_seen))}</td><td>${actions}</td></tr>`;
    }).join("")}</tbody></table>`;
  }

  window.renderCustomers = async function(root) {
    styles();
    const rows = await buildRows();
    root.innerHTML = `<section class="panel"><div class="panel-head"><div><h3>Клиентская база Telegram</h3><small>${rows.length} уникальных пользователей · записи объединены по Telegram ID, user_key, телефону и username</small></div><div class="filter-bar"><input id="customerSearch" placeholder="Имя, телефон, Telegram или ID"></div></div><div id="customerTable">${table(rows)}</div></section>`;
    document.getElementById("customerSearch")?.addEventListener("input", event => {
      const query = event.target.value.toLowerCase();
      document.getElementById("customerTable").innerHTML = table(rows.filter(row => `${row.name || ""} ${row.phone || ""} ${row.telegram || ""} ${row.telegram_username || ""} ${row.telegram_id || ""} ${row.user_key || ""}`.toLowerCase().includes(query)));
    });
  };
})();
