(() => {
  const points = window.BaliPoints;
  if (!points) return;
  const digits = (value = "") => String(value).replace(/\D/g, "");

  function injectStyles() {
    if (document.getElementById("manualPointsAdminStyle")) return;
    const style = document.createElement("style");
    style.id = "manualPointsAdminStyle";
    style.textContent = `.manual-points-panel{grid-column:1/-1}.manual-points-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,.8fr);gap:16px}.manual-points-form{display:grid;gap:12px}.manual-points-form label{display:grid;gap:6px;color:var(--muted);font-size:11px;font-weight:800}.manual-points-form input,.manual-points-form select{width:100%;min-height:48px;padding:0 13px;border:1px solid var(--line);border-radius:13px;background:rgba(255,255,255,.045);color:var(--text)}.points-user-list{display:grid;gap:8px}.points-user-row{display:grid;grid-template-columns:1fr auto;gap:10px;padding:11px;border:1px solid rgba(255,255,255,.07);border-radius:13px}.points-user-row strong,.points-user-row small{display:block}.points-user-row small{margin-top:3px;color:var(--muted);font-size:9px}.points-user-row b{color:var(--lime);font:600 14px Unbounded}@media(max-width:780px){.manual-points-grid{grid-template-columns:1fr}}`;
    document.head.appendChild(style);
  }

  function usersFrom(customers) {
    const registry = points.accounts();
    const map = new Map();
    Object.values(registry).forEach((account) => {
      const key = account.userKey || account.code;
      if (key) map.set(key, { ...account, key });
    });
    customers.forEach((customer) => {
      const key = digits(customer.phone) ? `phone:${digits(customer.phone)}` : customer.id;
      const existing = map.get(key) || {};
      map.set(key, { ...existing, key, name: customer.name || existing.name || "Гость", phone: digits(customer.phone) || existing.phone || "", telegram: customer.telegram || existing.telegram || "", balance: Number(existing.balance || 0) });
    });
    const current = points.profile();
    map.set(current.userKey || current.code, { ...current, key: current.userKey || current.code });
    return [...map.values()].sort((a, b) => String(a.name || a.phone || a.key).localeCompare(String(b.name || b.phone || b.key), "ru"));
  }

  async function appendManualPanel() {
    if (state.view !== "bonuses") return;
    const root = $("#content");
    if (!root || root.querySelector("#manualPointsForm")) return;
    const customers = await store.list("customers");
    const users = usersFrom(customers);
    root.insertAdjacentHTML("beforeend", `<section class="panel manual-points-panel"><div class="panel-head"><div><h3>Начислить или списать баллы</h3><small>Ручная корректировка баланса конкретного пользователя</small></div></div><div class="panel-body manual-points-grid"><form class="manual-points-form" id="manualPointsForm"><label><span>Пользователь</span><select name="userKey" required>${users.map((user) => `<option value="${esc(user.key)}">${esc(user.name || "Пользователь")} · ${esc(user.phone || user.telegram || user.code || user.key)} · ${Number(user.balance || 0)} баллов</option>`).join("")}</select></label><label><span>Операция</span><select name="operation"><option value="add">Начислить</option><option value="remove">Списать</option></select></label><label><span>Количество</span><input name="amount" type="number" min="1" value="50" required/></label><label><span>Причина</span><input name="note" type="text" placeholder="Подарок, компенсация, корректировка" required/></label><button class="primary" type="submit">Применить</button><div class="beta-note">Пользователь определяется по Telegram, телефону или персональному коду BALI.</div></form><div class="points-user-list">${users.length ? users.slice(0, 30).map((user) => `<div class="points-user-row"><div><strong>${esc(user.name || "Пользователь BALI")}</strong><small>${esc(user.phone || user.telegram || user.code || user.key)}</small></div><b>${Number(user.balance || 0)}</b></div>`).join("") : '<div class="empty">Пользователей пока нет</div>'}</div></div></section>`);
    $("#manualPointsForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      const user = users.find((item) => item.key === data.userKey) || { userKey: data.userKey };
      const signed = Math.max(1, Number(data.amount || 0)) * (data.operation === "remove" ? -1 : 1);
      const result = points.adjustAccount(user, signed, data.note || "Корректировка администратора");
      toast(result.ok ? `${signed > 0 ? "Начислено" : "Списано"} ${Math.abs(signed)} баллов` : result.message);
      render();
    });
  }

  injectStyles();
  const baseRender = render;
  render = async function() { await baseRender(); await appendManualPanel(); };
  if (state.view === "bonuses") appendManualPanel();
})();