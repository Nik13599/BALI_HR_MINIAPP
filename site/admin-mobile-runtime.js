(() => {
  if (window.__BALI_ADMIN_MOBILE_RUNTIME__) return;
  window.__BALI_ADMIN_MOBILE_RUNTIME__ = true;

  const VERSION = "beta4-event-qr-1";
  const moduleSets = {
    dashboard: [],
    menu: [],
    hall: [],
    settings: [],
    events: ["event-qr-attendance-beta4.js", "admin-events-mobile-list.js", "event-attendees-admin-beta3.js", "admin-event-qr-beta4.js"],
    bookings: ["event-layouts-beta3.js", "booking-admin-beta3.js"],
    customers: ["points-core.js", "customer-admin-beta3.js"],
    bonuses: [
      "points-core.js",
      "beta4-game.js",
      "beta4-loyalty-core.js",
      "beta4-reward-icons-core.js",
      "reward-png-validator-beta4.js",
      "points-admin.js",
      "points-admin-manual.js",
      "admin-vip-beta4.js",
      "admin-loyalty-economy-beta4.js",
      "admin-custom-rewards-beta4.js",
      "admin-reward-icon-list-beta4.js"
    ]
  };
  const viewTitles = {
    dashboard: "Обзор",
    menu: "Меню",
    events: "Афиши + рассадка + QR входа",
    hall: "Базовый шаблон",
    bonuses: "BALI-Баллы, VIP, фишки и награды",
    bookings: "Бронирования",
    customers: "Клиентская база",
    settings: "Настройки"
  };
  const loaded = new Set();
  const loading = new Map();
  let requestId = 0;

  document.querySelectorAll("script[src]").forEach((script) => {
    const name = String(script.getAttribute("src") || "").split("?")[0].split("/").pop();
    if (name) loaded.add(name);
  });

  const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

  function loadScript(name) {
    if (loaded.has(name)) return Promise.resolve();
    if (loading.has(name)) return loading.get(name);
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      let settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        loading.delete(name);
        if (error) reject(error);
        else { loaded.add(name); resolve(); }
      };
      const timer = setTimeout(() => finish(new Error(`Модуль ${name} не ответил`)), 8000);
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

  async function loadModules(names = []) {
    for (const name of names) {
      await loadScript(name);
      await nextFrame();
    }
  }

  function closeDialogs() {
    document.querySelectorAll("dialog[open]").forEach((dialog) => {
      try { dialog.close(); } catch { dialog.removeAttribute("open"); }
    });
  }

  function setActive(view) {
    document.querySelectorAll("#adminNav button[data-view]").forEach((button) => {
      const active = button.dataset.view === view;
      button.classList.toggle("active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });
  }

  function skeleton(view) {
    const title = document.getElementById("pageTitle");
    const content = document.getElementById("content");
    if (title) title.textContent = viewTitles[view] || "BALI Control";
    if (content) content.innerHTML = `<section class="admin-route-skeleton"><div class="admin-skeleton-line wide"></div><div class="admin-skeleton-grid"><i></i><i></i><i></i></div><span>Открываю раздел…</span></section>`;
  }

  async function renderWithTimeout(view, id) {
    state.view = view;
    const rendering = Promise.resolve().then(() => window.render());
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Раздел загружается слишком долго")), 8000));
    await Promise.race([rendering, timeout]);
    if (id !== requestId) return;
    const content = document.getElementById("content");
    if (content) content.dataset.route = view;
  }

  async function performNavigation(view, options, id) {
    closeDialogs();
    setActive(view);
    skeleton(view);
    document.body.classList.add("admin-route-loading");
    try {
      const names = moduleSets[view] || [];
      for (const name of names) {
        if (id !== requestId) return;
        await loadScript(name);
        if (id !== requestId) return;
        await nextFrame();
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
    performNavigation(view, options, id);
    return Promise.resolve();
  }

  document.addEventListener("click", (event) => {
    const retry = event.target.closest("[data-admin-retry]");
    if (retry) {
      event.preventDefault();
      event.stopImmediatePropagation();
      navigate(retry.dataset.adminRetry);
      return;
    }
    const button = event.target.closest("#adminNav button[data-view]");
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    navigate(button.dataset.view);
  }, true);

  window.setView = (view, openNew = false) => navigate(view, { openNew });
  window.BaliAdminRouter = { navigate, loadModules, loadedModules: loaded };

  window.addEventListener("error", () => document.body.classList.remove("admin-route-loading"));
  window.addEventListener("unhandledrejection", () => document.body.classList.remove("admin-route-loading"));
  sessionStorage.removeItem("bali_admin_last_view");
})();