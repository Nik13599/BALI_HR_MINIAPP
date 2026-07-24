(async () => {
  const version = "bali-production-35";
  const loaded = new Set();
  const pending = new Map();
  const url = name => name.startsWith("http") ? name : `./${name}?v=${version}`;

  function load(name, timeout = 12000) {
    if (loaded.has(name)) return Promise.resolve(name);
    if (pending.has(name)) return pending.get(name);
    const task = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      let finished = false;
      const finish = error => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        pending.delete(name);
        if (error) reject(error);
        else {
          loaded.add(name);
          resolve(name);
        }
      };
      const timer = setTimeout(() => finish(new Error(`Модуль ${name} не ответил`)), timeout);
      script.src = url(name);
      script.async = false;
      script.onload = () => finish();
      script.onerror = () => finish(new Error(`Не удалось загрузить ${name}`));
      document.body.appendChild(script);
    });
    pending.set(name, task);
    return task;
  }

  function loadStyle(name) {
    return new Promise(resolve => {
      if (document.querySelector(`link[data-bali-style="${name}"]`)) return resolve(name);
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = url(name);
      link.dataset.baliStyle = name;
      link.onload = () => resolve(name);
      link.onerror = () => resolve(name);
      document.head.appendChild(link);
    });
  }

  const optional = async (name, timeout = 7000) => {
    try { return await load(name, timeout); }
    catch (error) {
      window.BaliErrorBoundary?.capture?.(error, { module:name, optional:true });
      console.warn("[BALI optional]", name, error?.message || error);
      return null;
    }
  };

  document.documentElement.dataset.baliBuild = version;

  await load("config.js");
  await load("bali-error-boundary-production.js");
  await load("bali-runtime-safety-production.js");
  await load("bali-event-coalescer-production.js");
  await load("telegram-auth-gate.js");
  if (!(await window.BaliTelegramAuth.ready)?.ok) return;

  await Promise.all([
    loadStyle("beta4-app.css"),
    loadStyle("beta4-layout-map.css"),
    loadStyle("beta4-social.css")
  ]);

  await load("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2");
  await load("store.js");
  await optional("reviews-public-save-beta4.js");
  await load("points-core.js");
  await load("beta4-game.js");

  await Promise.all([
    load("app-users-core-beta4.js"),
    optional("event-lifecycle-core-beta4.js"),
    optional("beta4-loyalty-core.js"),
    optional("event-qr-attendance-beta4.js"),
    load("beta4-social-core.js")
  ]);

  await Promise.all([
    optional("social-cloud-sync-production.js", 10000),
    optional("cloud-loyalty-production.js", 10000),
    optional("event-checkin-cloud-production.js", 10000),
    optional("loyalty-catalog-cloud-production.js", 10000)
  ]);
  await optional("event-qr-safety-production.js");

  await load("bali-app-stable-production.js");
  await load("bali-fixed-labels-production.js");

  const modules = [
    "beta4-layout-map.js",
    "bali-profile-lite-production.js",
    "bali-people-page-production.js",
    "event-details-lineup-beta4.js",
    "venue-reviews-user-beta4.js",
    "review-eligibility-private-beta4.js",
    "beta4-qr-checkin.js"
  ];

  for (const module of modules) await optional(module, 7000);

  window.BaliRuntimeSafety?.ensureRequiredNodes?.();
  window.BaliFixedLabels?.apply?.();
  window.BaliAppStable?.finalizeLayout?.();
  window.BaliCompactProfile?.mount?.();
  await window.BaliPeoplePage?.refresh?.({ useCloud:true });
  window.BaliFixedLabels?.apply?.();
  window.BaliRuntimeSafety?.removeTechnicalOverlays?.();

  document.getElementById("baliBoot")?.remove();
  window.dispatchEvent(new CustomEvent("bali:production-ready", {
    detail:{ version, phase:"complete", runtime:"stable-v3" }
  }));
})().catch(error => {
  window.BaliErrorBoundary?.capture?.(error, { module:"production-loader", fatal:true });
  window.BaliRuntimeSafety?.recover?.(error);
  console.error("[BALI loader 35]", error);
  document.getElementById("baliBoot")?.remove();
  const root = document.getElementById("app");
  if (root && !root.children.length) {
    root.innerHTML = `<main style="min-height:100dvh;display:grid;place-items:center;padding:24px;background:#07100c;color:#fff;font-family:system-ui;text-align:center"><section><h2>Не удалось загрузить BALI</h2><p>Проверьте интернет-соединение и откройте приложение повторно.</p><button onclick="location.reload()" style="min-height:46px;padding:0 20px;border:0;border-radius:13px;background:#c8ff3d;color:#07100c;font-weight:900">Повторить</button></section></main>`;
  }
});