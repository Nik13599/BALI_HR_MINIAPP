(() => {
  if (window.__BALI_ADMIN_MOBILE_RUNTIME__) return;
  window.__BALI_ADMIN_MOBILE_RUNTIME__ = true;

  const VERSION = "beta3-mobile-stable";
  const moduleSets = {
    dashboard: [],
    menu: [],
    hall: [],
    settings: [],
    bookings: ["event-layouts-beta3.js", "booking-admin-beta3.js"],
    customers: ["points-core.js", "customer-admin-beta3.js"],
    bonuses: ["points-core.js", "points-admin.js", "points-admin-manual.js"],
    events: [
      "points-core.js",
      "event-layouts-beta3.js",
      "event-layout-admin-beta3.js",
      "event-engagement-admin-beta3.js",
      "event-attendees-admin-beta3.js",
      "event-attendance-mode-admin-beta3.js"
    ]
  };
  const viewTitles = {
    dashboard: "Обзор",
    menu: "Меню",
    events: "Афиши + рассадка",
    hall: "Базовый шаблон",
    bonuses: "BALI-Баллы",
    bookings: "Бронирования",
    customers: "Клиентская база",
    settings: "Настройки"
  };
  const loaded = new Set();
  const loading = new Map();
  let running = false;
  let pending = null;
  let requestId = 0;

  document.querySelectorAll("script[src]").forEach((script) => {
    const name = String(script.getAttribute("src") || "").split("?")[0].split("/").pop();
    if (name) loaded.add(name);
  });

  function nextFrame() {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }

  function loadScript(name) {
    if (loaded.has(name)) return Promise.resolve();
    if (loading.has(name)) return loading.get(name);

    const promise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      const timer = setTimeout(() => reject(new Error(`Модуль ${name} загружается слишком долго`)), 15000);
      script.src = `./${name}?v=${VERSION}`;
      script.async = false;
      script.dataset.adminModule = name;
      script.onload = () => {
        clearTimeout(timer);
        loaded.add(name);
        loading.delete(name);
        resolve();
      };
      script.onerror = () => {
        clearTimeout(timer);
        loading.delete(name);
        reject(new Error(`Не удалось загрузить ${name}`));
      };
      document.body.appendChild(script);
    });

    loading.set(name, promise);
    return promise;
  }

  function closeTransientDialogs() {
    document.querySelectorAll("dialog[open]").forEach((dialog) => {
      try { dialog.close(); } catch { dialog.removeAttribute("open"); }
    });
  }

  function setActiveButton(view) {
    document.querySelectorAll("#adminNav button[data-view]").forEach((button) => {
      button.classList.toggle("active", button.dataset.view === view);
      button.setAttribute("aria-current", button.dataset.view === view ? "page" : "false");
    });
  }

  function showSkeleton(view) {
    const title = document.getElementById("pageTitle");
    const content = document.getElementById("content");
    if (title) title.textContent = viewTitles[view] || "BALI Control";
    if (!content) return;
    content.dataset.route = view;
    content.innerHTML = `<section class="admin-route-skeleton" aria-live="polite"><div class="admin-skeleton-line wide"></div><div class="admin-skeleton-grid"><i></i><i></i><i></i></div><span>Открываю раздел…</span></section>`;
  }

  async function ensureModules(view, id) {
    const names = moduleSets[view] || [];
    if (!names.length) return;
    const requestedView = view;
    state.view = "__module_loading__";
    for (const name of names) {
      if (id !== requestId) return;
      await loadScript(name);
      await nextFrame();
    }
    if (id === requestId) state.view = requestedView;
  }

  async function callRender(view, id) {
    state.view = view;
    const renderPromise = Promise.resolve().then(() => window.render());
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Раздел не ответил вовремя")), 12000));
    await Promise.race([renderPromise, timeout]);
    if (id !== requestId) return;
    const content = document.getElementById("content");
    if (content) content.dataset.route = view;
  }

  async function performNavigation(job) {
    const { view, openNew, id } = job;
    closeTransientDialogs();
    setActiveButton(view);
    showSkeleton(view);
    document.body.classList.add("admin-route-loading");

    try {
      await ensureModules(view, id);
      if (id !== requestId) return;
      await nextFrame();
      await callRender(view, id);
      if (id !== requestId) return;
      sessionStorage.setItem("bali_admin_last_view", view);
      if (openNew) {
        const type = view === "hall" ? "hall_tables" : view === "menu" ? "menu_items" : view;
        window.openEditor?.(type);
      }
    } catch (error) {
      if (id !== requestId) return;
      state.view = view;
      const content = document.getElementById("content");
      if (content) {
        content.innerHTML = `<section class="panel"><div class="admin-route-error"><strong>Не удалось открыть раздел</strong><p>${String(error?.message || "Неизвестная ошибка")}</p><button class="primary" type="button" data-admin-retry="${view}">Повторить</button></div></section>`;
      }
      window.toast?.("Раздел не загрузился. Нажмите «Повторить».");
    } finally {
      if (id === requestId) document.body.classList.remove("admin-route-loading");
    }
  }

  async function pump() {
    if (running) return;
    running = true;
    try {
      while (pending) {
        const job = pending;
        pending = null;
        await performNavigation(job);
      }
    } finally {
      running = false;
      if (pending) pump();
    }
  }

  function navigate(view, options = {}) {
    if (!moduleSets[view]) view = "dashboard";
    const id = ++requestId;
    pending = { view, openNew: Boolean(options.openNew), id };
    pump();
    return Promise.resolve();
  }

  document.addEventListener("click", (event) => {
    const retry = event.target.closest("[data-admin-retry]");
    if (retry) {
      event.preventDefault();
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
  window.BaliAdminRouter = { navigate, loadedModules: loaded };

  window.addEventListener("error", () => document.body.classList.remove("admin-route-loading"));
  window.addEventListener("unhandledrejection", () => document.body.classList.remove("admin-route-loading"));

  const lastView = sessionStorage.getItem("bali_admin_last_view");
  if (lastView && lastView !== "dashboard") {
    const observer = new MutationObserver(() => {
      const app = document.getElementById("appView");
      if (!app || app.classList.contains("hidden")) return;
      observer.disconnect();
      navigate(lastView);
    });
    observer.observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ["class"] });
  }
})();