(() => {
  if (window.__BALI_ADMIN_CHIP_REQUESTS__) return;
  window.__BALI_ADMIN_CHIP_REQUESTS__ = true;
  const requests = window.BaliChipRequests, store = window.BaliStore;
  if (!requests) return;
  const esc = (v = "") => String(v).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const fmt = v => v ? new Date(v).toLocaleString("ru-RU", {day:"2-digit",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"}) : "—";
  let refreshing = false, lastPending = 0;

  function styles() {
    if (document.getElementById("adminChipRequestsStyle")) return;
    const s = document.createElement("style");
    s.id = "adminChipRequestsStyle";
    s.textContent = `.admin-chip-badge{display:inline-grid;place-items:center;min-width:20px;height:20px;margin-left:auto;padding:0 5px;border-radius:999px;background:#ffcc5b;color:#151005;font-size:9px;font-weight:900}.admin-chip-list{display:grid;gap:10px}.admin-chip-section-title{display:flex;justify-content:space-between;align-items:center;gap:10px;margin:8px 0 0}.admin-chip-section-title h4{margin:0;font-size:13px}.admin-chip-section-title span{color:var(--muted);font-size:9px}.admin-chip-row{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(150px,.75fr) auto;gap:12px;align-items:center;padding:13px;border:1px solid var(--line);border-radius:16px;background:#ffffff05}.admin-chip-user{display:grid;gap:4px}.admin-chip-user strong{font-size:12px}.admin-chip-user span,.admin-chip-user small{color:var(--muted);font-size:9px;line-height:1.45}.admin-chip-user small b{color:#dce3de}.admin-chip-amount{display:grid;gap:3px}.admin-chip-amount strong{color:var(--lime);font:600 17px Unbounded}.admin-chip-amount span{color:var(--muted);font-size:9px}.admin-chip-actions{display:flex;gap:6px;align-items:center}.admin-chip-empty{padding:20px;border:1px dashed var(--line);border-radius:16px;color:var(--muted);text-align:center}.admin-chip-status{padding:6px 8px;border-radius:999px;font-size:8px;font-weight:900}.admin-chip-status.pending{background:#f3c75d1c;color:#f3c75d}.admin-chip-status.fulfilled{background:#c8ff3d18;color:var(--lime)}.admin-chip-status.cancelled{background:#ff73731a;color:#ff9696}.admin-chip-cancelled{opacity:.66}@media(max-width:720px){.admin-chip-row{grid-template-columns:1fr}.admin-chip-actions{justify-content:flex-start}.admin-chip-section-title{align-items:flex-start;flex-direction:column}}`;
    document.head.appendChild(s);
  }

  function rowHtml(row) {
    const pending = row.status === "pending";
    const fulfilled = row.status === "fulfilled";
    const dateLabel = fulfilled ? "Вручено" : row.status === "cancelled" ? "Отменено" : "Заявка";
    const dateValue = fulfilled ? row.fulfilled_at : row.status === "cancelled" ? row.cancelled_at : row.created_at;
    return `<article class="admin-chip-row ${row.status === "cancelled" ? "admin-chip-cancelled" : ""}"><div class="admin-chip-user"><strong>${esc(row.name || "Гость BALI")}</strong><span>${esc(row.telegram || row.phone || row.user_key || "—")}</span><small><b>${dateLabel}:</b> ${fmt(dateValue)}</small>${fulfilled && row.fulfilled_by ? `<small>Подтвердил: ${esc(row.fulfilled_by)}</small>` : ""}</div><div class="admin-chip-amount"><strong>${Number(row.quantity || 0)} фиш.</strong><span>${Number(row.points_cost || 0)} BALI-Баллов</span></div><div class="admin-chip-actions">${pending ? `<button class="primary compact" type="button" data-chip-request-fulfill="${esc(row.id)}">✓ Вручено</button><button class="ghost compact" type="button" data-chip-request-cancel="${esc(row.id)}">Отменить</button>` : `<span class="admin-chip-status ${esc(row.status)}">${fulfilled ? "Вручено" : "Отменено"}</span>`}</div></article>`;
  }

  async function refresh() {
    if (refreshing) return;
    refreshing = true;
    try {
      const rows = await requests.list();
      const pending = rows.filter(r => r.status === "pending").sort((a,b) => String(a.created_at || "").localeCompare(String(b.created_at || "")));
      const fulfilled = rows.filter(r => r.status === "fulfilled").sort((a,b) => String(b.fulfilled_at || b.created_at || "").localeCompare(String(a.fulfilled_at || a.created_at || ""))).slice(0,200);
      const cancelled = rows.filter(r => r.status === "cancelled").sort((a,b) => String(b.cancelled_at || b.created_at || "").localeCompare(String(a.cancelled_at || a.created_at || ""))).slice(0,30);
      const button = document.querySelector('#adminNav button[data-view="bonuses"]');
      let badge = button?.querySelector(".admin-chip-badge");
      if (!pending.length) badge?.remove();
      else {
        if (!badge && button) { badge = document.createElement("span"); badge.className = "admin-chip-badge"; button.appendChild(badge); }
        if (badge) badge.textContent = String(pending.length);
      }
      if (pending.length > lastPending && lastPending >= 0) toast(`Новая заявка на фишки · ожидают ${pending.length}`);
      lastPending = pending.length;
      if (state.view !== "bonuses" && state.view !== "dashboard") return;
      const root = document.getElementById("content");
      if (!root) return;
      root.querySelector("#chipAdminForm")?.remove();
      let panel = root.querySelector("#adminChipRequestsPanel") || document.querySelector("#adminChipRequestsPanel");
      if (!panel) { panel = document.createElement("section"); panel.id = "adminChipRequestsPanel"; panel.className = "panel"; root.appendChild(panel); }
      panel.innerHTML = `<div class="panel-head"><div><h3>Заявки на фишки</h3><small>${pending.length} ожидают выдачи · баллы списываются при оформлении заявки</small></div></div><div class="panel-body admin-chip-list"><div class="admin-chip-section-title"><h4>Ожидают выдачи</h4><span>${pending.length} заявок</span></div>${pending.map(rowHtml).join("") || '<div class="admin-chip-empty">Новых заявок на фишки нет</div>'}<div class="admin-chip-section-title"><h4>История операций</h4><span>Пользователь · дата и время · количество фишек</span></div>${fulfilled.map(rowHtml).join("") || '<div class="admin-chip-empty">Выданных фишек пока нет</div>'}${cancelled.length ? `<div class="admin-chip-section-title"><h4>Отменённые заявки</h4><span>${cancelled.length}</span></div>${cancelled.map(rowHtml).join("")}` : ""}</div>`;
    } finally { refreshing = false; }
  }

  document.addEventListener("click", async e => {
    const done = e.target.closest("[data-chip-request-fulfill]");
    if (done) {
      e.preventDefault();
      if (!confirm("Подтвердить, что фишки вручены гостю?")) return;
      const result = await requests.fulfill(done.dataset.chipRequestFulfill, "BALI Admin");
      toast(result.ok ? "Выдача фишек подтверждена" : result.message);
      refresh();
      return;
    }
    const cancel = e.target.closest("[data-chip-request-cancel]");
    if (cancel) {
      e.preventDefault();
      if (!confirm("Отменить заявку и вернуть пользователю списанные баллы?")) return;
      const result = await requests.cancel(cancel.dataset.chipRequestCancel, true, "BALI Admin");
      toast(result.ok ? "Заявка отменена, баллы возвращены" : result.message);
      refresh();
    }
  }, true);

  styles();
  const baseRender = window.render;
  window.render = async function() { const result = await baseRender.apply(this, arguments); await refresh(); return result; };
  window.addEventListener("bali:chip-requests-changed", refresh);
  setInterval(() => { if (!document.hidden) refresh(); }, 15000);
  if (store?.cloudEnabled && store.client) { try { store.client.channel("bali-chip-requests-admin").on("postgres_changes", {event:"*",schema:"public",table:"chip_requests"}, refresh).subscribe(); } catch {} }
  setTimeout(refresh, 0);
})();