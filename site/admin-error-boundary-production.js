(() => {
  if (window.__BALI_ADMIN_ERROR_BOUNDARY_PRODUCTION__) return;
  window.__BALI_ADMIN_ERROR_BOUNDARY_PRODUCTION__ = true;

  const KEY = "bali_admin_runtime_errors_v1";

  function capture(error, context = {}) {
    const value = error instanceof Error ? error : new Error(String(error || "Неизвестная ошибка"));
    const row = {
      message:String(value.message || value),
      stack:String(value.stack || "").slice(0, 4000),
      context,
      build:document.body?.dataset?.adminBuild || "",
      created_at:new Date().toISOString()
    };
    try {
      const rows = JSON.parse(localStorage.getItem(KEY) || "[]");
      rows.unshift(row);
      localStorage.setItem(KEY, JSON.stringify(rows.slice(0, 50)));
    } catch {}
    console.error("[BALI admin]", row);
    return row;
  }

  function notify(message) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = String(message || "Ошибка админки");
    toast.classList.add("show");
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => toast.classList.remove("show"), 3500);
  }

  window.addEventListener("error", event => {
    capture(event.error || event.message, {
      type:"error",
      filename:event.filename || "",
      lineno:event.lineno || 0,
      colno:event.colno || 0
    });
    event.preventDefault();
    notify("Ошибка раздела перехвачена. Обновите раздел ещё раз.");
  });

  window.addEventListener("unhandledrejection", event => {
    capture(event.reason, { type:"unhandledrejection" });
    event.preventDefault();
    notify("Операция не завершилась. Повторите действие.");
  });

  window.BaliAdminErrorBoundary = {
    KEY,
    capture,
    notify,
    list() {
      try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
      catch { return []; }
    },
    clear() { localStorage.removeItem(KEY); }
  };
})();