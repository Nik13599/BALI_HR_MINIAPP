(() => {
  if (window.__BALI_ADMIN_STABLE_ORCHESTRATOR_PRODUCTION__) return;
  window.__BALI_ADMIN_STABLE_ORCHESTRATOR_PRODUCTION__ = true;

  const store = window.BaliStore;
  const byId = id => document.getElementById(id);
  const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;"
  })[char]);

  const NAV = [
    ["dashboard", "▦", "Обзор"],
    ["messages", "✉", "Сообщения"],
    ["bookings", "◷", "Брони"],
    ["events", "◫", "События"],
    ["customers", "◎", "Клиенты"],
    ["bonuses", "★", "Баллы + VIP"],
    ["menu", "◈", "Меню"],
    ["hall", "⌗", "Схемы"],
    ["reviews", "✦", "Отзывы"],
    ["settings", "⚙", "Настройки"]
  ];

  let rendering = false;
  let queued = false;

  function capture(error, context) {
    window.BaliAdminErrorBoundary?.capture?.(error, { context });
  }

  function ensureNavigation() {
    const nav = byId("adminNav");
    if (!nav) return;
    const active = typeof state !== "undefined" ? state.view : "dashboard";
    const existing = [...nav.querySelectorAll(":scope > button[data-view]")];
    const valid = existing.length === NAV.length && existing.every((button, index) => button.dataset.view === NAV[index][0]);
    if (!valid) {
      nav.replaceChildren(...NAV.map(([view, icon, label]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.view = view;
        if (view === active) button.classList.add("active");
        button.innerHTML = `${icon} <span>${label}</span>${view === "messages" ? '<b id="adminMessagesNavBadge" class="admin-unread" style="display:none;margin-left:auto">0</b>' : ""}`;
        return button;
      }));
    } else {
      existing.forEach((button, index) => {
        button.classList.toggle("active", NAV[index][0] === active);
        const span = button.querySelector("span");
        if (span && span.textContent !== NAV[index][2]) span.textContent = NAV[index][2];
      });
    }
  }

  function uniqueCustomers(rows = []) {
    const map = new Map();
    for (const row of rows || []) {
      if (!row) continue;
      const phone = String(row.phone || "").replace(/\D/g, "");
      const telegram = String(row.telegram || row.username || "").replace(/^@/, "").trim().toLowerCase();
      const id = String(row.id || row.user_key || "");
      const key = phone ? `phone:${phone}` : telegram ? `telegram:${telegram}` : id ? `id:${id}` : "";
      if (!key) continue;
      const previous = map.get(key);
      const previousDate = String(previous?.updated_at || previous?.created_at || "");
      const rowDate = String(row.updated_at || row.created_at || "");
      if (!previous || rowDate >= previousDate) map.set(key, row);
    }
    return [...map.values()];
  }

  async function syncCustomerCounters() {
    if (!store || typeof state === "undefined" || !["dashboard", "customers"].includes(state.view)) return;
    let rows = [];
    try { rows = uniqueCustomers(await store.list("customers")); }
    catch (error) { capture(error, "customers-list"); }

    if (state.view === "dashboard") {
      const count = document.querySelector("#content .stats .stat-card:nth-child(2) strong");
      if (count) count.textContent = String(rows.length);
    }

    if (state.view === "customers") {
      const table = byId("customerTable");
      if (table && typeof customersTable === "function") table.innerHTML = customersTable(rows);
      const subtitle = document.querySelector("#content .panel-head small");
      if (subtitle) subtitle.textContent = `${rows.length} реальных карточек клиентов`;
    }
  }

  async function afterRender() {
    ensureNavigation();
    if (typeof state === "undefined") return;

    if (state.view === "settings") {
      try { await window.BaliAdminVenueReviews?.mountVenueSettings?.(); }
      catch (error) { capture(error, "settings-venue"); }
    }

    if (state.view === "bonuses") {
      try { await window.BaliAdminLoyaltyIssuance?.mount?.(); }
      catch (error) { capture(error, "loyalty-issuance"); }
    }

    await syncCustomerCounters();
  }

  if (typeof render === "function") {
    const baseRender = render;
    render = async function stableAdminRender() {
      if (rendering) {
        queued = true;
        return;
      }
      rendering = true;
      const content = byId("content");
      try {
        await baseRender();
        await afterRender();
      } catch (error) {
        capture(error, `render:${typeof state !== "undefined" ? state.view : "unknown"}`);
        if (content) {
          content.innerHTML = `<section class="panel"><div class="panel-head"><h3>Раздел временно недоступен</h3></div><div class="panel-body"><div class="empty">${esc(error?.message || "Ошибка загрузки")}</div><button class="primary" type="button" data-admin-retry>Повторить</button></div></section>`;
        }
      } finally {
        rendering = false;
        if (queued) {
          queued = false;
          queueMicrotask(() => render());
        }
      }
    };
  }

  document.addEventListener("click", event => {
    if (event.target.closest("[data-admin-retry]")) {
      event.preventDefault();
      render();
      return;
    }
    const navButton = event.target.closest("#adminNav button[data-view]");
    if (!navButton) return;
    requestAnimationFrame(ensureNavigation);
  }, true);

  [0, 100, 400, 1000].forEach(delay => setTimeout(ensureNavigation, delay));
  window.BaliAdminStable = { ensureNavigation, uniqueCustomers, syncCustomerCounters, afterRender };
})();