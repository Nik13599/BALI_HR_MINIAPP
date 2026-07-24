(() => {
  if (window.__BALI_ERROR_BOUNDARY_PRODUCTION_V1__) return;
  window.__BALI_ERROR_BOUNDARY_PRODUCTION_V1__ = true;

  const KEY = "bali_runtime_errors_v1";
  const MAX = 50;
  const ignored = [/ResizeObserver loop/i, /Script error/i, /Loading chunk/i];

  function serialize(error, context = {}) {
    const value = error instanceof Error ? error : new Error(String(error || "Unknown error"));
    return {
      message: String(value.message || value),
      name: String(value.name || "Error"),
      stack: String(value.stack || "").slice(0, 4000),
      context,
      build: document.documentElement.dataset.baliBuild || "",
      url: location.href,
      created_at: new Date().toISOString()
    };
  }

  function capture(error, context = {}) {
    const row = serialize(error, context);
    if (ignored.some(pattern => pattern.test(row.message))) return row;
    try {
      const rows = JSON.parse(localStorage.getItem(KEY) || "[]");
      rows.unshift(row);
      localStorage.setItem(KEY, JSON.stringify(rows.slice(0, MAX)));
    } catch {}
    return row;
  }

  function recover() {
    try {
      window.BaliAppStable?.finalizeLayout?.();
      window.BaliCompactProfile?.mount?.();
      window.BaliSocialCloud?.refresh?.();
    } catch {}
  }

  window.addEventListener("error", event => {
    capture(event.error || event.message, {
      type: "error",
      filename: event.filename || "",
      lineno: event.lineno || 0,
      colno: event.colno || 0
    });
    event.preventDefault();
    setTimeout(recover, 0);
  });

  window.addEventListener("unhandledrejection", event => {
    capture(event.reason, { type: "unhandledrejection" });
    event.preventDefault();
    setTimeout(recover, 0);
  });

  window.BaliErrorBoundary = {
    KEY,
    capture,
    recover,
    list() {
      try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
      catch { return []; }
    },
    clear() { localStorage.removeItem(KEY); }
  };
})();