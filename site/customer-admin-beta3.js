(() => {
  const points = window.BaliPoints;
  const dateTime = value => value ? new Date(value).toLocaleString("ru-RU", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" }) : "—";
  const phoneKey = value => String(value || "").replace(/\D/g, "");
  const usernameKey = value => String(value || "").trim().replace(/^@/, "").toLowerCase();
  const isOnline = value => value && Date.now() - new Date(value).getTime() < 120000;
  const telegramHref = value => {
    const username = usernameKey(value);
    return username ? `https://t.me/${encodeURIComponent(username)}` : "";
  };

  function mergeRows(customers, appUsers, accounts, bookings) {
    const rows = customers.map(customer => ({ ...customer, _customerId:customer.id }));
    const accountMap = new Map((accounts || []).map(account => [String(account.user_key || ""), account]));

    for (const user of appUsers || []) {
      const phone = phoneKey(user.phone);
      const username = usernameKey(user.username);
      let row = rows.find(item => user.user_key && String(item.user_key || "") === String(user.user_key));
      if (!row && user.telegram_id) row = rows.find(item => String(item.telegram_id || "") === String(user.telegram_id));
      if (!row && phone) row = rows.find(item => phoneKey(item.phone) === phone);
      if (!row && username) row = rows.find(item => usernameKey(item.telegram_username || item.telegram) === username);

      const appData = {
        user_key:user.user_key,
        telegram_id:user.telegram_id,
        name:user.name || row?.name || "Гость BALI",
        telegram_username:user.username || row?.telegram_username || row?.telegram || "",
        telegram:user.username || row?.telegram || "",
        phone:user.phone || row?.phone || "",
        avatar:user.avatar || row?.avatar || "",
        first_seen_at:user.first_seen_at || row?.first_seen_at,
        last_seen_at:user.last_seen_at || row?.last_seen_at,
        opens:Number(user.opens || row?.opens || 0),
        source:row?.source === "manual" ? "manual" : "telegram"
      };

      if (row) Object.assign(row, appData);
      else rows.push({ id:`app:${user.user_key}`, _appOnly:true, visits:0, total_spent:0, notes:"", ...appData });
    }

    return rows.map(row => {
      const account = accountMap.get(String(row.user_key || "")) || {};
      const visitRows = (bookings || []).filter(booking => booking.status === "completed" && (
        String(booking.customer_id || "") === String(row._customerId || row.id || "") ||
        (row.user_key && String(booking.owner_key || "") === String(row.user_key)) ||
        (row.telegram_id && String(booking.telegram_id || "") === String(row.telegram_id)) ||
        (row.phone && phoneKey(booking.phone) === phoneKey(row.phone))
      ));
      return {
        ...row,
        visits_calculated:Math.max(Number(row.visits || 0), visitRows.length),
        points_calculated:Number(account.balance ?? row.points_balance ?? 0)
      };
    }).sort((a,b) => String(b.last_seen_at || b.updated_at || b.created_at || "").localeCompare(String(a.last_seen_at || a.updated_at || a.created_at || "")));
  }

  function table(rows) {
    if (!rows.length) return '<div class="empty">Клиентская база пока пуста. Пользователь появится после первого подтверждённого входа через Telegram.</div>';
    return `<table class="data-table"><thead><tr><th>Клиент</th><th>Telegram</th><th>Телефон</th><th>Активность</th><th>Посещения</th><th>Баллы</th><th></th></tr></thead><tbody>${rows.map(row => {
      const username = row.telegram_username || row.telegram || "";
      const href = telegramHref(username);
      const online = isOnline(row.last_seen_at);
      return `<tr><td><strong>${esc(row.name || "Гость BALI")}</strong><br><small>${row.source === "manual" ? "Ручная карточка" : "Telegram Mini App"} · ${Number(row.opens || 0)} входов</small></td><td>${href ? `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(String(username).startsWith("@") ? username : `@${username}`)}</a>` : '<span class="status pending">Ник отсутствует</span>'}<br><small>ID: ${esc(row.telegram_id || row.user_key || "—")}</small></td><td>${row.phone ? esc(row.phone) : '<span class="status pending">Не предоставлен</span>'}</td><td>${online ? '<span class="status available">● Онлайн</span>' : `<span class="status completed">Был(а) ${esc(dateTime(row.last_seen_at || row.updated_at || row.created_at))}</span>`}</td><td>${Number(row.visits_calculated || 0)}</td><td><strong>${Number(row.points_calculated || 0)}</strong></td><td>${row._appOnly ? '<small>Автопрофиль</small>' : `<div class="row-actions"><button class="icon-btn" data-edit="customers" data-id="${esc(row.id)}">✎</button><button class="icon-btn" data-delete="customers" data-id="${esc(row.id)}">×</button></div>`}</td></tr>`;
    }).join("")}</tbody></table>`;
  }

  async function loadRows() {
    const [customers, bookings] = await Promise.all([store.list("customers"), store.list("bookings")]);
    let appUsers = [];
    let accounts = [];
    if (store?.cloudEnabled && store.client) {
      const [{ data:users, error:userError }, { data:pointRows }] = await Promise.all([
        store.client.from("app_users").select("*").order("last_seen_at", { ascending:false }),
        store.client.from("points_accounts").select("*")
      ]);
      if (userError) throw userError;
      appUsers = users || [];
      accounts = pointRows || [];
    } else {
      appUsers = await window.BaliAppUsers?.listAdmin?.() || [];
      accounts = Object.values(points?.accounts?.() || {});
    }
    return mergeRows(customers, appUsers, accounts, bookings);
  }

  renderCustomers = async function(root) {
    const rows = await loadRows();
    root.innerHTML = `<section class="panel"><div class="panel-head"><div><h3>Единая клиентская база</h3><small>Telegram-профили, ручные карточки, онлайн-статус, посещения и баллы</small></div><div class="filter-bar"><input id="customerSearch" placeholder="Имя, телефон, Telegram или ID"/></div></div><div id="customerTable">${table(rows)}</div></section>`;
    document.getElementById("customerSearch")?.addEventListener("input", event => {
      const query = event.target.value.toLowerCase();
      document.getElementById("customerTable").innerHTML = table(rows.filter(row => `${row.name || ""} ${row.phone || ""} ${row.telegram || ""} ${row.telegram_username || ""} ${row.telegram_id || ""} ${row.user_key || ""}`.toLowerCase().includes(query)));
    });
  };

  clearInterval(window.__BALI_CUSTOMER_ONLINE_REFRESH__);
  window.__BALI_CUSTOMER_ONLINE_REFRESH__ = setInterval(() => {
    if (typeof state !== "undefined" && state.view === "customers" && document.visibilityState === "visible") render().catch(() => {});
  }, 30000);
})();