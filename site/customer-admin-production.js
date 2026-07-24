(() => {
  if (window.__BALI_CUSTOMER_ADMIN_PRODUCTION__) return;
  window.__BALI_CUSTOMER_ADMIN_PRODUCTION__ = true;

  const safe = (value = "") => String(value).replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);
  const digits = value => String(value || "").replace(/\D/g, "");
  const fmt = value => value ? new Date(value).toLocaleString("ru-RU", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
  }) : "—";

  function mergeKey(row = {}) {
    if (row.user_key) return `user:${row.user_key}`;
    if (row.telegram_id) return `telegram:${row.telegram_id}`;
    if (digits(row.phone)) return `phone:${digits(row.phone)}`;
    return `id:${row.id || crypto.randomUUID?.() || Math.random()}`;
  }

  async function cloudList(table) {
    if (!store?.cloudEnabled || !store.client) return [];
    const { data, error } = await store.client.from(table).select("*");
    if (error) return [];
    return data || [];
  }

  async function buildRows() {
    const [manual, appUsers, accounts, checkins, bookings] = await Promise.all([
      store.list("customers").catch(() => []),
      window.BaliAppUsers?.listAdmin?.().catch?.(() => []) || Promise.resolve([]),
      cloudList("points_accounts"),
      cloudList("event_checkins"),
      store.list("bookings").catch(() => [])
    ]);

    const map = new Map();
    for (const row of manual) map.set(mergeKey(row), { ...row, source: row.source || "manual" });
    for (const user of appUsers || []) {
      const key = mergeKey(user);
      const previous = map.get(key) || {};
      map.set(key, {
        ...user,
        ...previous,
        user_key: previous.user_key || user.user_key,
        telegram_id: previous.telegram_id || user.telegram_id,
        name: previous.name || user.name || "Гость BALI",
        telegram: previous.telegram || user.username || "",
        telegram_username: previous.telegram_username || user.username || "",
        phone: previous.phone || user.phone || "",
        avatar: previous.avatar || user.avatar || "",
        first_seen_at: previous.first_seen_at || user.first_seen_at,
        last_seen_at: user.last_seen_at || previous.last_seen_at,
        opens: Math.max(Number(previous.opens || 0), Number(user.opens || 0)),
        source: previous.source || "telegram"
      });
    }

    const accountMap = new Map(accounts.map(row => [String(row.user_key || ""), row]));
    const checkinCount = new Map();
    checkins.forEach(row => {
      const key = String(row.user_key || (row.telegram_id ? `tg:${row.telegram_id}` : ""));
      if (key) checkinCount.set(key, (checkinCount.get(key) || 0) + 1);
    });

    return [...map.values()].map(row => {
      const userKey = String(row.user_key || (row.telegram_id ? `tg:${row.telegram_id}` : ""));
      const account = accountMap.get(userKey) || {};
      const completedBookings = bookings.filter(booking => booking.status === "completed" && (
        String(booking.customer_id || "") === String(row.id || "") ||
        (row.telegram_id && String(booking.telegram_id || "") === String(row.telegram_id)) ||
        (digits(row.phone) && digits(booking.phone) === digits(row.phone))
      )).length;
      return {
        ...row,
        balance: Number(account.balance ?? row.points_balance ?? 0),
        visits_calculated: Math.max(Number(row.visits || 0), Number(checkinCount.get(userKey) || 0), completedBookings),
        last_seen: row.last_seen_at || row.updated_at || row.created_at || row.first_seen_at
      };
    }).sort((a, b) => String(b.last_seen || "").localeCompare(String(a.last_seen || "")));
  }

  function table(rows) {
    if (!rows.length) return '<div class="empty">Пользователи пока не зарегистрированы. После подтверждённого входа через Telegram запись появится здесь автоматически.</div>';
    return `<table class="data-table"><thead><tr><th>Пользователь</th><th>Telegram</th><th>Телефон</th><th>Посещения</th><th>Баллы</th><th>Входы</th><th>Последний вход</th><th></th></tr></thead><tbody>${rows.map(row => {
      const actions = row.id ? `<div class="row-actions"><button class="icon-btn" data-edit="customers" data-id="${safe(row.id)}">✎</button><button class="icon-btn" data-delete="customers" data-id="${safe(row.id)}">×</button></div>` : '<span class="status available">Telegram</span>';
      return `<tr><td><strong>${safe(row.name || "Гость BALI")}</strong><br><small>${safe(row.user_key || (row.telegram_id ? `tg:${row.telegram_id}` : row.id || "—"))}</small></td><td>${safe(row.telegram_username || row.telegram || "—")}</td><td>${row.phone ? safe(row.phone) : '<span class="status pending">Не указан</span>'}</td><td>${Number(row.visits_calculated || 0)}</td><td><strong>${Number(row.balance || 0)}</strong></td><td>${Number(row.opens || 0)}</td><td>${safe(fmt(row.last_seen))}</td><td>${actions}</td></tr>`;
    }).join("")}</tbody></table>`;
  }

  window.renderCustomers = async function(root) {
    const rows = await buildRows();
    root.innerHTML = `<section class="panel"><div class="panel-head"><div><h3>Клиентская база Telegram</h3><small>${rows.length} пользователей · профиль создаётся при первом подтверждённом входе</small></div><div class="filter-bar"><input id="customerSearch" placeholder="Имя, телефон, Telegram или ID"></div></div><div id="customerTable">${table(rows)}</div></section>`;
    document.getElementById("customerSearch")?.addEventListener("input", event => {
      const query = event.target.value.toLowerCase();
      document.getElementById("customerTable").innerHTML = table(rows.filter(row => `${row.name || ""} ${row.phone || ""} ${row.telegram || ""} ${row.telegram_username || ""} ${row.telegram_id || ""} ${row.user_key || ""}`.toLowerCase().includes(query)));
    });
  };
})();
