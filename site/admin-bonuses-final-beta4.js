(() => {
  if (window.__BALI_ADMIN_BONUSES_FINAL__) return;
  window.__BALI_ADMIN_BONUSES_FINAL__ = true;

  const requests = window.BaliChipRequests;
  const points = window.BaliPoints;
  const store = window.BaliStore;
  if (!requests || !points || !store) return;

  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[char]);
  const digits = value => String(value || "").replace(/\D/g, "");
  const fmt = value => value ? new Date(value).toLocaleString("ru-RU", {
    day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit"
  }) : "—";
  const toast = message => window.toast?.(message);

  function styles() {
    if (document.getElementById("adminBonusesFinalStyle")) return;
    const style = document.createElement("style");
    style.id = "adminBonusesFinalStyle";
    style.textContent = `
      #adminChipRequestsPanel,#bonusSection-chip-requests{display:none!important}
      .bonus-hub-card[data-open-bonus-section="chip-requests"]{display:none!important}
      .bonus-priority{display:grid;gap:12px;margin-bottom:14px}
      .bonus-priority-panel{overflow:hidden;border:1px solid rgba(255,204,91,.28);border-radius:20px;background:linear-gradient(145deg,rgba(255,204,91,.08),rgba(255,255,255,.02))}
      .bonus-priority-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:15px 16px;border-bottom:1px solid var(--line)}
      .bonus-priority-head h3{margin:0;font-size:15px}.bonus-priority-head p{margin:5px 0 0;color:var(--muted);font-size:9px}
      .bonus-priority-count{min-width:38px;height:38px;display:grid;place-items:center;border-radius:12px;background:#ffcc5b;color:#171005;font:700 15px Unbounded}
      .bonus-pending-list{display:grid;gap:8px;padding:12px}
      .bonus-pending-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(130px,.45fr) auto;gap:10px;align-items:center;padding:12px;border:1px solid var(--line);border-radius:15px;background:#0e1210}
      .bonus-pending-user strong,.bonus-pending-user span,.bonus-pending-user small{display:block}.bonus-pending-user strong{font-size:11px}.bonus-pending-user span,.bonus-pending-user small{margin-top:4px;color:var(--muted);font-size:8px}
      .bonus-pending-value strong{display:block;color:var(--lime);font:600 16px Unbounded}.bonus-pending-value span{display:block;margin-top:4px;color:var(--muted);font-size:8px}
      .bonus-pending-actions{display:flex;gap:6px;flex-wrap:wrap}.bonus-pending-actions button{min-height:36px;padding:0 9px}
      .bonus-priority-empty{padding:22px;color:var(--muted);text-align:center;font-size:9px}
      .bonus-priority-tools{display:grid;grid-template-columns:1fr 1fr;gap:9px}
      .bonus-tool-card{display:grid;grid-template-columns:46px minmax(0,1fr) auto;gap:10px;align-items:center;min-height:88px;padding:13px;border:1px solid var(--line);border-radius:17px;background:#ffffff05;color:#fff;text-align:left}
      .bonus-tool-card i{width:46px;height:46px;display:grid;place-items:center;border-radius:13px;background:#c8ff3d12;color:var(--lime);font-style:normal;font-weight:900}.bonus-tool-card strong{display:block;font-size:11px}.bonus-tool-card small{display:block;margin-top:5px;color:var(--muted);font-size:8px;line-height:1.4}.bonus-tool-card b{color:var(--lime);font-size:17px}
      .bonus-final-dialog{width:min(820px,calc(100% - 16px));max-height:94dvh;padding:0;border:1px solid var(--line);border-radius:23px;background:#0b0e0d;color:#fff;overflow:hidden}.bonus-final-dialog::backdrop{background:#000d;backdrop-filter:blur(6px)}
      .bonus-final-shell{max-height:94dvh;overflow:auto}.bonus-final-head{position:sticky;top:0;z-index:3;display:flex;justify-content:space-between;align-items:center;padding:15px 17px;border-bottom:1px solid var(--line);background:#0b0e0df2}.bonus-final-head h2{margin:4px 0 0;font-size:18px}.bonus-final-close{width:41px;height:41px;border:1px solid var(--line);border-radius:50%;background:#ffffff07;color:#fff;font-size:23px}.bonus-final-body{display:grid;gap:11px;padding:14px}
      .bonus-history-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;padding:12px;border:1px solid var(--line);border-radius:14px;background:#ffffff04}.bonus-history-row h4{margin:0;font-size:10px}.bonus-history-row p{margin:5px 0 0;color:var(--muted);font-size:8px;line-height:1.5}.bonus-history-row b{color:var(--lime);font-size:10px}
      .bonus-manual-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,.75fr);gap:14px}.bonus-manual-form{display:grid;gap:10px}.bonus-manual-form label{display:grid;gap:6px;color:var(--muted);font-size:9px;font-weight:800}.bonus-manual-form input,.bonus-manual-form select{width:100%;min-height:47px;padding:0 12px;border:1px solid var(--line);border-radius:13px;background:#171b19;color:#fff}
      .bonus-user-list{display:grid;gap:7px;max-height:480px;overflow:auto}.bonus-user-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:9px;padding:10px;border:1px solid var(--line);border-radius:13px;background:#ffffff04}.bonus-user-row strong,.bonus-user-row small{display:block}.bonus-user-row small{margin-top:4px;color:var(--muted);font-size:8px}.bonus-user-row b{color:var(--lime);font:600 13px Unbounded}
      @media(max-width:760px){.bonus-pending-row{grid-template-columns:1fr}.bonus-priority-tools,.bonus-manual-grid{grid-template-columns:1fr}.bonus-pending-actions{justify-content:flex-start}}
    `;
    document.head.appendChild(style);
  }

  function ensureDialogs() {
    if (!document.getElementById("chipHistoryDialog")) {
      document.body.insertAdjacentHTML("beforeend", `
        <dialog class="bonus-final-dialog" id="chipHistoryDialog"><div class="bonus-final-shell"><header class="bonus-final-head"><div><span class="eyebrow">ФИШКИ</span><h2>История вручения фишек</h2></div><button class="bonus-final-close" type="button" data-close-bonus-final>×</button></header><div class="bonus-final-body" id="chipHistoryBody"></div></div></dialog>
        <dialog class="bonus-final-dialog" id="manualPointsDialog"><div class="bonus-final-shell"><header class="bonus-final-head"><div><span class="eyebrow">BALI-БАЛЛЫ</span><h2>Начислить или списать баллы</h2></div><button class="bonus-final-close" type="button" data-close-bonus-final>×</button></header><div class="bonus-final-body" id="manualPointsBody"></div></div></dialog>
      `);
    }
  }

  function usersFrom(customers) {
    const map = new Map();
    Object.values(points.accounts?.() || {}).forEach(account => {
      const key = account.userKey || account.code;
      if (key) map.set(String(key), { ...account, key: String(key) });
    });
    customers.forEach(customer => {
      const key = digits(customer.phone) ? `phone:${digits(customer.phone)}` : String(customer.id || "");
      if (!key) return;
      const existing = map.get(key) || {};
      map.set(key, {
        ...existing,
        key,
        name: customer.name || existing.name || "Гость BALI",
        phone: digits(customer.phone) || existing.phone || "",
        telegram: customer.telegram || existing.telegram || "",
        balance: Number(existing.balance || 0)
      });
    });
    const current = points.profile?.() || {};
    const currentKey = current.userKey || current.code;
    if (currentKey) map.set(String(currentKey), { ...current, key: String(currentKey) });
    return [...map.values()].sort((a, b) => String(a.name || a.phone || a.key).localeCompare(String(b.name || b.phone || b.key), "ru"));
  }

  function pendingRow(row) {
    return `<article class="bonus-pending-row"><div class="bonus-pending-user"><strong>${esc(row.name || "Гость BALI")}</strong><span>${esc(row.telegram || row.phone || row.user_key || "Контакт не указан")}</span><small>Запрос: ${fmt(row.created_at)}</small></div><div class="bonus-pending-value"><strong>${Number(row.quantity || 0)} фиш.</strong><span>${Number(row.points_cost || 0)} BALI-Баллов уже списано</span></div><div class="bonus-pending-actions"><button class="primary compact" type="button" data-final-chip-fulfill="${esc(row.id)}">✓ Вручено</button><button class="ghost compact" type="button" data-final-chip-cancel="${esc(row.id)}">Отменить</button></div></article>`;
  }

  async function renderHistory(rows) {
    ensureDialogs();
    const body = document.getElementById("chipHistoryBody");
    if (!body) return;
    const history = rows.filter(row => row.status !== "pending").sort((a, b) => String(b.fulfilled_at || b.cancelled_at || b.created_at || "").localeCompare(String(a.fulfilled_at || a.cancelled_at || a.created_at || "")));
    body.innerHTML = history.length ? history.map(row => `<article class="bonus-history-row"><div><h4>${esc(row.name || "Гость BALI")} · ${Number(row.quantity || 0)} фиш.</h4><p>${esc(row.telegram || row.phone || row.user_key || "—")}<br>${row.status === "fulfilled" ? `Вручено ${fmt(row.fulfilled_at)} · ${esc(row.fulfilled_by || "BALI Admin")}` : `Отменено ${fmt(row.cancelled_at)} · баллы ${row.refund_at ? "возвращены" : "не возвращены"}`}</p></div><b>${row.status === "fulfilled" ? "ВРУЧЕНО" : "ОТМЕНЕНО"}</b></article>`).join("") : '<div class="bonus-priority-empty">Истории вручения пока нет</div>';
  }

  async function renderManualPoints() {
    ensureDialogs();
    const body = document.getElementById("manualPointsBody");
    if (!body) return;
    const users = usersFrom(await store.list("customers"));
    body.innerHTML = `<div class="bonus-manual-grid"><form class="bonus-manual-form" id="finalManualPointsForm"><label><span>Пользователь</span><select name="userKey" required>${users.map(user => `<option value="${esc(user.key)}">${esc(user.name || "Пользователь")} · ${esc(user.phone || user.telegram || user.code || user.key)} · ${Number(user.balance || 0)} баллов</option>`).join("")}</select></label><label><span>Операция</span><select name="operation"><option value="add">Начислить</option><option value="remove">Списать</option></select></label><label><span>Количество</span><input name="amount" type="number" min="1" value="50" required></label><label><span>Причина</span><input name="note" type="text" placeholder="Подарок, компенсация, корректировка" required></label><button class="primary" type="submit">Применить</button></form><div class="bonus-user-list">${users.length ? users.map(user => `<article class="bonus-user-row"><div><strong>${esc(user.name || "Пользователь BALI")}</strong><small>${esc(user.phone || user.telegram || user.code || user.key)}</small></div><b>${Number(user.balance || 0)}</b></article>`).join("") : '<div class="bonus-priority-empty">Пользователей пока нет</div>'}</div></div>`;
    body.querySelector("#finalManualPointsForm")?.addEventListener("submit", event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      const user = users.find(item => String(item.key) === String(data.userKey)) || { userKey: data.userKey };
      const amount = Math.max(1, Number(data.amount || 0)) * (data.operation === "remove" ? -1 : 1);
      const result = points.adjustAccount(user, amount, data.note || "Корректировка администратора");
      toast(result.ok ? `${amount > 0 ? "Начислено" : "Списано"} ${Math.abs(amount)} баллов` : result.message);
      renderManualPoints();
    }, { once: true });
  }

  let running = false;
  async function refresh() {
    if (running || typeof state === "undefined" || state.view !== "bonuses") return;
    running = true;
    try {
      styles();
      ensureDialogs();
      const root = document.getElementById("content");
      if (!root) return;
      const rows = await requests.list();
      const pending = rows.filter(row => row.status === "pending").sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")));

      root.querySelector("#adminChipRequestsPanel")?.remove();
      document.getElementById("bonusSection-chip-requests")?.remove();
      root.querySelector('.bonus-hub-card[data-open-bonus-section="chip-requests"]')?.remove();
      document.querySelectorAll(".manual-points-panel").forEach(panel => panel.style.display = "none");

      let area = root.querySelector("#bonusPriorityArea");
      if (!area) {
        area = document.createElement("section");
        area.id = "bonusPriorityArea";
        area.className = "bonus-priority";
        root.prepend(area);
      }
      area.innerHTML = `<section class="bonus-priority-panel"><header class="bonus-priority-head"><div><h3>Новые заявки на фишки</h3><p>Показываются сразу. Подтвердите фактическую выдачу или отмените заявку с возвратом баллов.</p></div><span class="bonus-priority-count">${pending.length}</span></header><div class="bonus-pending-list">${pending.length ? pending.map(pendingRow).join("") : '<div class="bonus-priority-empty">Новых заявок на фишки нет</div>'}</div></section><div class="bonus-priority-tools"><button class="bonus-tool-card" type="button" data-open-final-manual-points><i>B</i><span><strong>Начислить или списать баллы</strong><small>Выбрать конкретного пользователя и сразу изменить его баланс</small></span><b>›</b></button><button class="bonus-tool-card" type="button" data-open-chip-history><i>◷</i><span><strong>Открыть историю вручения фишек</strong><small>Выданные и отменённые заявки открываются только по запросу</small></span><b>›</b></button></div>`;
      await renderHistory(rows);
    } finally {
      running = false;
    }
  }

  document.addEventListener("click", async event => {
    const fulfill = event.target.closest("[data-final-chip-fulfill]");
    if (fulfill) {
      event.preventDefault();
      if (!confirm("Подтвердить, что фишки вручены гостю?")) return;
      const result = await requests.fulfill(fulfill.dataset.finalChipFulfill, "BALI Admin");
      toast(result.ok ? "Выдача фишек подтверждена" : result.message);
      return refresh();
    }
    const cancel = event.target.closest("[data-final-chip-cancel]");
    if (cancel) {
      event.preventDefault();
      if (!confirm("Отменить заявку и вернуть пользователю списанные баллы?")) return;
      const result = await requests.cancel(cancel.dataset.finalChipCancel, true, "BALI Admin");
      toast(result.ok ? "Заявка отменена, баллы возвращены" : result.message);
      return refresh();
    }
    if (event.target.closest("[data-open-chip-history]")) {
      event.preventDefault();
      await renderHistory(await requests.list());
      document.getElementById("chipHistoryDialog")?.showModal();
    }
    if (event.target.closest("[data-open-final-manual-points]")) {
      event.preventDefault();
      await renderManualPoints();
      document.getElementById("manualPointsDialog")?.showModal();
    }
    if (event.target.closest("[data-close-bonus-final]")) {
      event.preventDefault();
      event.target.closest("dialog")?.close();
    }
  }, true);

  const baseRender = window.render;
  if (typeof baseRender === "function") {
    window.render = async function(...args) {
      const result = await baseRender.apply(this, args);
      if (typeof state !== "undefined" && state.view === "bonuses") setTimeout(refresh, 80);
      return result;
    };
  }
  window.addEventListener("bali:chip-requests-changed", () => setTimeout(refresh, 0));
  window.addEventListener("bali:points-changed", () => setTimeout(refresh, 0));
  setTimeout(refresh, 350);
})();