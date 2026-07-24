(() => {
  if (window.__BALI_ADMIN_MOBILE_RUNTIME__) return;
  window.__BALI_ADMIN_MOBILE_RUNTIME__ = true;

  const VERSION = "bali-admin-production-9";
  const moduleSets = {
    dashboard: ["points-core.js","beta4-game.js","beta4-loyalty-core.js","event-qr-attendance-beta4.js","app-users-core-beta4.js","admin-dashboard-beta4.js","admin-birthdays-beta4.js","chip-requests-core-beta4.js","admin-chip-requests-beta4.js"],
    menu: ["admin-menu-categories-dialog-beta4.js","admin-menu-media-beta4.js"],
    hall: ["seating-templates-core-beta4.js","admin-seating-templates-beta4.js"],
    settings: ["home-design-cloud-bootstrap.js","home-design-core-beta4.js","admin-home-design-upload-fix-beta4.js","admin-home-design-beta4.js"],
    events: ["seating-templates-core-beta4.js","admin-seating-templates-beta4.js","event-qr-attendance-beta4.js","admin-events-mobile-list.js","event-attendees-admin-beta3.js","admin-event-qr-beta4.js","admin-event-history-beta4.js"],
    bookings: ["seating-templates-core-beta4.js","event-layouts-beta3.js","booking-admin-beta3.js"],
    customers: ["store-customer-unification.js","points-core.js","beta4-game.js","beta4-loyalty-core.js","event-qr-attendance-beta4.js","app-users-core-beta4.js","customer-admin-beta3.js","customer-admin-production.js","admin-customer-dossier-beta4.js"],
    bonuses: ["points-core.js","beta4-game.js","beta4-loyalty-core.js","chip-requests-core-beta4.js","beta4-reward-icons-core.js","reward-png-validator-beta4.js","points-admin.js","points-admin-manual.js","admin-vip-beta4.js","admin-loyalty-economy-beta4.js","admin-vip-variants-beta4.js","admin-custom-rewards-beta4.js","admin-reward-icon-list-beta4.js","admin-user-search-beta4.js","admin-bonuses-only-beta4.js","admin-chip-requests-beta4.js","admin-bonuses-hub-beta4.js","admin-bonuses-hub-v7-fix.js","admin-vip-mobile-sections-beta4.js","admin-bonuses-structure-v11.js","admin-points-mobile-sections-beta4.js","admin-bonuses-final-beta4.js","admin-gifts-production.js"],
    reviews: []
  };
  const viewTitles = {
    dashboard: "Обзор",
    menu: "Меню",
    events: "Афиши + рассадка + QR входа",
    hall: "Схемы рассадки",
    bonuses: "Баллы + VIP",
    bookings: "Бронирования",
    customers: "Клиентская база",
    reviews: "Отзывы и предложения",
    settings: "Настройки дизайна и системы"
  };

  const loaded = new Set();
  const loading = new Map();
  let requestId = 0;

  document.querySelectorAll("script[src]").forEach(script => {
    const name = String(script.getAttribute("src") || "").split("?")[0].split("/").pop();
    if (name) loaded.add(name);
  });

  const frame = () => new Promise(resolve => requestAnimationFrame(resolve));

  function loadScript(name) {
    if (loaded.has(name)) {
      if (name === "home-design-cloud-bootstrap.js" && window.BaliHomeDesignCloudReady) {
        return Promise.resolve(window.BaliHomeDesignCloudReady).then(() => undefined);
      }
      return Promise.resolve();
    }
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
          resolve();
        }
      };
      const timer = setTimeout(() => finish(new Error(`Модуль ${name} не ответил`)), 20000);
      script.src = `./${name}?v=${VERSION}`;
      script.async = false;
      script.dataset.adminModule = name;
      script.onload = () => {
        if (name === "home-design-cloud-bootstrap.js" && window.BaliHomeDesignCloudReady) {
          Promise.resolve(window.BaliHomeDesignCloudReady).then(() => finish()).catch(() => finish());
        } else {
          finish();
        }
      };
      script.onerror = () => finish(new Error(`Не удалось загрузить ${name}`));
      document.body.appendChild(script);
    });

    loading.set(name, promise);
    return promise;
  }

  async function loadModules(names = []) {
    for (const name of names) {
      await loadScript(name);
      await frame();
    }
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
      new Promise((_, reject) => setTimeout(() => reject(new Error("Раздел загружается слишком долго")), 20000))
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
      for (const name of moduleSets[view] || []) {
        if (id !== requestId) return;
        await loadScript(name);
        if (id !== requestId) return;
        await frame();
      }
      if (id !== requestId) return;
      await renderWithTimeout(view, id);
      if (id !== requestId) return;
      if (options.openNew) {
        const type = view === "hall" ? "hall_tables" : view === "menu" ? "menu_items" : view;
        window.openEditor?.(type);
      }
    } catch (error) {
      if (id !== requestId) return;
      state.view = view;
      const content = document.getElementById("content");
      if (content) content.innerHTML = `<section class="panel"><div class="admin-route-error"><strong>Раздел не открылся</strong><p>${esc(error?.message || "Неизвестная ошибка")}</p><button class="primary" data-admin-retry="${view}">Повторить</button></div></section>`;
      window.toast?.("Не удалось открыть раздел");
    } finally {
      if (id === requestId) document.body.classList.remove("admin-route-loading");
    }
  }

  function navigate(view, options = {}) {
    if (!Object.prototype.hasOwnProperty.call(moduleSets, view)) view = "dashboard";
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

  window.setView = (view, openNew = false) => view === "messages"
    ? window.BaliAdminMessages?.open?.()
    : navigate(view, { openNew });
  window.BaliAdminRouter = { navigate, loadModules, loadedModules: loaded };

  window.addEventListener("error", () => document.body.classList.remove("admin-route-loading"));
  window.addEventListener("unhandledrejection", () => document.body.classList.remove("admin-route-loading"));
  sessionStorage.removeItem("bali_admin_last_view");
})();