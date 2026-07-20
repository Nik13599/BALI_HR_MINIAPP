(() => {
  const points = window.BaliPoints;
  const dateTime = (value) => value ? new Date(value).toLocaleString("ru-RU", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
  const phoneKey = (value = "") => String(value).replace(/\D/g, "");

  function enrich(customers, bookings) {
    const accounts = points?.accounts?.() || {};
    return customers.map((customer) => {
      const visitRows = bookings.filter((booking) => booking.status === "completed" && (booking.customer_id === customer.id || booking.owner_key === customer.owner_key || (customer.telegram_id && String(booking.telegram_id || "") === String(customer.telegram_id))));
      const candidates = [customer.client_key, customer.owner_key, customer.telegram_id ? `tg:${customer.telegram_id}` : "", customer.phone ? `phone:${phoneKey(customer.phone)}` : ""].filter(Boolean);
      const account = candidates.map((key) => accounts[key]).find(Boolean) || {};
      return { ...customer, visits_calculated: Math.max(Number(customer.visits || 0), visitRows.length), points_calculated: Number(account.balance ?? customer.points_balance ?? 0) };
    });
  }

  function table(rows) {
    if (!rows.length) return '<div class="empty">Клиентская база пока пуста. Пользователь добавляется при первом входе в Telegram Mini App.</div>';
    return `<table class="data-table"><thead><tr><th>Клиент</th><th>Telegram</th><th>Телефон</th><th>Посещения</th><th>Баллы</th><th>Последний вход</th><th></th></tr></thead><tbody>${rows.map((row) => `<tr><td><strong>${esc(row.name || "Гость BALI")}</strong><br><small>ID: ${esc(row.telegram_id || row.client_key || "—")}</small></td><td>${esc(row.telegram || (row.telegram_username ? `@${row.telegram_username}` : "—"))}</td><td>${row.phone ? esc(row.phone) : '<span class="status pending">Не предоставлен</span>'}</td><td>${Number(row.visits_calculated || 0)}</td><td><strong>${Number(row.points_calculated || 0)}</strong></td><td>${dateTime(row.last_opened_at || row.updated_at || row.created_at)}</td><td><div class="row-actions"><button class="icon-btn" data-edit="customers" data-id="${row.id}">✎</button><button class="icon-btn" data-delete="customers" data-id="${row.id}">×</button></div></td></tr>`).join("")}</tbody></table>`;
  }

  renderCustomers = async function(root) {
    const [customers, bookings] = await Promise.all([store.list("customers"), store.list("bookings")]);
    const rows = enrich(customers, bookings).sort((a, b) => String(b.last_opened_at || b.updated_at || b.created_at || "").localeCompare(String(a.last_opened_at || a.updated_at || a.created_at || "")));
    root.innerHTML = `<section class="panel"><div class="panel-head"><div><h3>Клиентская база Telegram</h3><small>Профиль, телефон, посещения, баллы и история входов</small></div><div class="filter-bar"><input id="customerSearch" placeholder="Имя, телефон, Telegram или ID"/></div></div><div id="customerTable">${table(rows)}</div></section>`;
    $("#customerSearch").addEventListener("input", (event) => {
      const query = event.target.value.toLowerCase();
      $("#customerTable").innerHTML = table(rows.filter((row) => `${row.name} ${row.phone} ${row.telegram} ${row.telegram_username} ${row.telegram_id}`.toLowerCase().includes(query)));
    });
  };
})();