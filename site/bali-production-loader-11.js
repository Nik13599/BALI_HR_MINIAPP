(async () => {
  const version = "bali-production-18";
  const loaded = new Set();
  const pending = new Map();
  const url = name => name.startsWith("http") ? name : `./${name}?v=${version}`;

  function load(name, timeout = 9000) {
    if (loaded.has(name)) return Promise.resolve(name);
    if (pending.has(name)) return pending.get(name);
    const task = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      let finished = false;
      const done = error => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        pending.delete(name);
        if (error) reject(error);
        else { loaded.add(name); resolve(name); }
      };
      const timer = setTimeout(() => done(new Error(`Модуль ${name} не ответил`)), timeout);
      script.src = url(name);
      script.async = false;
      script.onload = () => done();
      script.onerror = () => done(new Error(`Не удалось загрузить ${name}`));
      document.body.appendChild(script);
    });
    pending.set(name, task);
    return task;
  }

  function loadStyle(name) {
    return new Promise(resolve => {
      const selector = `link[data-bali-style="${name}"]`;
      if (document.querySelector(selector)) return resolve(name);
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = url(name);
      link.dataset.baliStyle = name;
      link.onload = () => resolve(name);
      link.onerror = () => resolve(name);
      document.head.appendChild(link);
    });
  }

  const optional = (name, timeout = 5000) => load(name, timeout).catch(error => {
    console.warn("[BALI optional]", error?.message || error);
    return null;
  });

  await load("config.js");
  await load("telegram-auth-gate.js");
  if (!(await window.BaliTelegramAuth.ready)?.ok) return;

  await Promise.all([
    loadStyle("beta4-app.css"),
    loadStyle("beta4-layout-map.css"),
    loadStyle("beta4-home-links.css"),
    loadStyle("beta4-social.css"),
    loadStyle("legacy-nav-final-beta4.css")
  ]);

  await load("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2");
  await load("store.js");
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
    optional("social-cloud-sync-production.js", 9000),
    optional("cloud-loyalty-production.js", 9000),
    optional("event-checkin-cloud-production.js", 9000)
  ]);

  await load("beta4-app.js");

  const modules = [
    "legacy-nav-final-beta4.js",
    "beta4-profile-v2.js",
    "beta4-social-page.js",
    "event-stability-final-beta4.js",
    "bali-people-public-cards-beta4.js",
    "bali-people-vip-frame-beta4.js",
    "beta4-qr-checkin.js",
    "bali-ui-registry-production-v2.js"
  ];

  for (const module of modules) await optional(module, 5000);

  document.getElementById("baliBoot")?.remove();
  window.dispatchEvent(new CustomEvent("bali:production-ready", {
    detail: { version, phase: "complete" }
  }));
})().catch(error => {
  console.error("[BALI loader 18]", error);
  document.getElementById("baliBoot")?.remove();
  const root = document.getElementById("app");
  if (root && !root.children.length) root.innerHTML = `<main style="min-height:100dvh;display:grid;place-items:center;padding:24px;background:#07100c;color:#fff;font-family:system-ui;text-align:center"><section><h2>Не удалось загрузить BALI</h2><p>${String(error?.message || "Ошибка загрузки")}</p><button onclick="location.reload()" style="min-height:46px;padding:0 20px;border:0;border-radius:13px;background:#c8ff3d;color:#07100c;font-weight:900">Повторить</button></section></main>`;
});