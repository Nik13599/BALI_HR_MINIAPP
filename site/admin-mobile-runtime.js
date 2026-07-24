(() => {
  if (window.__BALI_ADMIN_MOBILE_RUNTIME__) return;
  window.__BALI_ADMIN_MOBILE_RUNTIME__ = true;

  const VERSION = "bali-admin-production-8";
  const routes = {
    dashboard: {
      critical: ["admin-dashboard-beta4.js"],
      optional: ["admin-birthdays-beta4.js", "chip-requests-core-beta4.js", "admin-chip-requests-beta4.js"],
    },
    menu: {
      critical: [],
      optional: ["admin-menu-categories-dialog-beta4.js", "admin-menu-media-beta4.js"],
    },
    hall: {
      critical: ["seating-templates-core-beta4.js"],
      optional: ["admin-seating-templates-beta4.js"],
    },
    settings: {
      critical: [],
      optional: ["home-design-core-beta4.js", "admin-home-design-upload-fix-beta4.js", "admin-home-design-beta4.js"],
    },
    events: {
      critical: ["event-qr-attendance-beta4.js", "admin-event-qr-beta4.js"],
      optional: ["seating-templates-core-beta4.js", "admin-seating-templates-beta4.js", "admin-events-mobile-list.js", "event-attendees-admin-beta3.js", "admin-event-history-beta4.js"],
    },
    bookings: {
      critical: [],
      optional: ["seating-templates-core-beta4.js", "event-layouts-beta3.js", "booking-admin-beta3.js"],
    },
    customers: {
      critical: ["app-users-core-beta4.js", "customer-admin-production.js"],
      optional: ["store-customer-unification.js", "customer-admin-beta3.js", "admin-customer-dossier-beta4.js", "admin-user-card-links-beta4.js"],
    },
    bonuses: {
      critical: ["admin-loyalty-control-production.js"],
      optional: ["chip-requests-core-beta4.js", "admin-chip-requests-beta4.js"],
    },
    reviews: {
      critical: ["admin-venue-reviews-beta4.js"],
      optional: ["admin-review-reward-beta4.js"],
    },
  };

  const viewTitles = {
    dashboard: "Обзор",
    menu: "Меню",
    events: "Афиши + рассадка + QR входа",
    hall: "Схемы рассадки",
    bonuses: "Баллы + VIP + Награды + Подарки",
    bookings: "Бронирования",
    customers: "Клиентская база",
    reviews: "Отзывы и предложения",
    settings: "Настройки дизайна и системы",
  };

  const loaded = new Set();
  const loading = new Map();
  let requestId = 0;

  document.querySelectorAll("script[src]").forEach(script => {
    const name = String(script.getAttribute("src") || "").split("?")[0].split("/").pop();
    if (name) loaded.add(name);
  });

  function loadScript(name, timeout = 7000) {
    if (loaded.has(name)) return Promise.resolve(name);
    if (loading.has(name)) return loading.get(name);
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      let done = false;
      const finish = error => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        loading.delete(name);
        if (error) reject(error);
        else {
          loaded.add(name);
          resolve(name);
        }
      };
      const timer = setTimeout(() => finish(new Error(`Модуль ${name} не ответил`)), timeout);
      script.src = `./${name}?v=${VERSION}`;
      script.async = false;
      script.dataset.adminModule = name;
      script.onload = () => finish();
      script.onerror = () => finish(new Error(`Не удалось загрузить ${name}`));
      document.body.appendChild(script);
    });
    loading.set(name, promise);
    return promise;
  }

  async function loadCritical(names = [], id = requestId) {
    for (const name of names) {
      if (id !== requestId) return;
      await loadScript(name);
    }
  }

  async function loadOptional(names = [], id = requestId) {
    const results = await Promise.allSettled(names.map(name => loadScript(name, 5000)));
    results.forEach((result, index) => {
      if (result.status === "rejected") console.warn("[BALI Admin optional]", names[index], result.reason?.message || result.reason);
    });
    if (id !== requestId) return;
  }

  function closeDialogs() {
    document.querySelectorAll("dialog[open]").forEach(dialog => {
      try { dialog.close(); } catch { dialog.removeAttribute("open"); }
    });
  }

  function setActive(view) {
    document.querySelectorAll("#adminNav button[data-view]").forEach(button => {
      const active = button.dataset.view === view;
      button.classList.toggle("active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });
  }

  function skeleton(view) {
    const title = document.getElementById("pageTitle");
    const content = document.getElementById("content");
    if (title) title.textContent = viewTitles[view] || "BALI Control";
    if (content) content.innerHTML = '<section class="admin-route-skeleton"><div class="admin-skeleton-line wide"></div><div class="admin-skeleton-grid"><i></i><i></i><i></i></div><span>Открываю раздел…</span></section>';
  }

  async function renderWithTimeout(view, id) {
    state.view = view;
    await Promise.race([
      Promise.resolve().then(() => window.render()),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Раздел загружается слишком долго")), 9000)),
    ]);
    if (id !== requestId) return;
    const content = document.getElementById("content");
    if (content) content.dataset.route = view;
  }

  async function perform(view, options, id) {
    closeDialogs();
    setActive(view);
    skeleton(view);
    document.body.classList.add("admin-route-loading");
    try {
      const route = routes[view] || { critical: [], optional: [] };
      await loadCritical(route.critical, id);
      if (id !== requestId) return;
      await renderWithTimeout(view, id);
      if (id !== requestId) return;
      document.body.classList.remove("admin-route-loading");
      loadOptional(route.optional, id).then(() => {
        if (id === requestId && state.view === view) window.render?.();
      });
      if (options.openNew) {
        const type = view === "hall" ? "hall_tables" : view === "menu" ? "menu_items" : view;
        window.openEditor?.(type);
      }
    } catch (error) {
      if (id !== requestId) return;
      state.view = view;
      const content = document.getElementById("content");
      if (content) content.innerHTML = `<section class="panel"><div class="admin-route-error"><strong>Раздел не открылся</strong><p>${window.esc ? window.esc(error?.message || "Неизвестная ошибка") : String(error?.message || "Неизвестная ошибка")}</p><button class="primary" data-admin-retry="${view}">Повторить</button></div></section>`;
      window.toast?.("Не удалось открыть раздел");
    } finally {
      if (id === requestId) document.body.classList.remove("admin-route-loading");
    }
  }

  function navigate(view, options = {}) {
    if (!Object.prototype.hasOwnProperty.call(routes, view)) view = "dashboard";
    const id = ++requestId;
    perform(view, options, id);
    return Promise.resolve();
  }

  document.addEventListener("click", event => {
    const retry = event.target.closest("[data-admin-retry]");
    if (retry) {
      event.preventDefault();
      event.stopImmediatePropagation();
      navigate(retry.dataset.adminRetry);
      return;
    }
    const button = event.target.closest("#adminNav button[data-view]");
    if (!button || button.dataset.view === "messages") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    navigate(button.dataset.view);
  }, true);

  window.setView = (view, openNew = false) => view === "messages" ? window.BaliAdminMessages?.open?.() : navigate(view, { openNew });
  window.BaliAdminRouter = {
    navigate,
    loadModules: names => loadOptional(names),
    loadedModules: loaded,
  };

  const clearLoading = () => document.body.classList.remove("admin-route-loading");
  window.addEventListener("error", clearLoading);
  window.addEventListener("unhandledrejection", clearLoading);
  sessionStorage.removeItem("bali_admin_last_view");

  const idle = window.requestIdleCallback || (callback => setTimeout(callback, 1200));
  idle(() => {
    ["admin-loyalty-control-production.js", "customer-admin-production.js", "admin-event-qr-beta4.js"]
      .forEach(name => loadScript(name, 5000).catch(() => {}));
  });
})();
