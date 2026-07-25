(async () => {
  const version = "bali-full-demo-8";
  window.BALI_DEMO_ONLY = true;
  window.BALI_WEB_DEMO = true;
  window.BALI_BROWSER_DEMO = true;
  window.BALI_FULL_DEMO = true;

  const css = [
    "beta4-app.css",
    "beta4-layout-map.css",
    "beta4-home-links.css",
    "beta4-social.css",
    "legacy-nav-final-beta4.css",
    "full-demo-fixes-beta4.css"
  ];

  const critical = [
    "config.js",
    "bali-web-demo-sanitize.js",
    "store.js",
    "auto-event-qr-beta4.js",
    "bali-browser-demo-data.js",
    "full-demo-data-upgrade-beta4.js",
    "demo-event-content-seed-beta4.js",
    "points-core.js",
    "beta4-game.js",
    "app-users-core-beta4.js",
    "bali-age-gate-beta4.js",
    "beta4-loyalty-core.js",
    "chip-requests-core-beta4.js",
    "beta4-reward-icons-core.js",
    "home-design-core-beta4.js",
    "event-qr-attendance-beta4.js",
    "event-qr-local-bridge-beta4.js",
    "night-crown-core-beta4.js",
    "night-crown-checkin-bridge-beta4.js",
    "night-crown-presence-fix-beta4.js",
    "beta4-social-core.js",
    "full-demo-social-economy-beta4.js",
    "full-demo-people-upgrade-beta4.js",
    "bali-people-status-sync-beta4.js",
    "seating-templates-core-beta4.js",
    "full-demo-runtime-fixes-beta4.js",
    "beta4-app.js",
    "fast-event-dialog-beta4.js",
    "fast-event-visuals-beta4.js",
    "legacy-nav-final-beta4.js",
    "home-layout-final-beta4.js",
    "beta4-menu-categories.js",
    "beta4-menu-media.js",
    "beta4-home-links.js",
    "beta4-profile-booking.js",
    "beta4-loyalty-ui-stable.js",
    "beta4-social-page.js",
    "night-crown-beta4.js",
    "full-demo-nav-unlock-beta4.js",
    "beta4-qr-checkin.js"
  ];

  const enhancements = [
    "night-crown-vote-lock-beta4.js",
    "night-crown-photo-fix-beta4.js",
    "night-crown-status-notify-beta4.js",
    "night-crown-prize-notify-beta4.js",
    "night-crown-event-badge-beta4.js",
    "beta4-reward-icon-view.js",
    "beta4-ranking-visits.js",
    "beta4-profile-v2.js",
    "profile-demographics-beta4.js",
    "bali-bonuses-only-beta4.js",
    "bali-people-privacy-beta4.js",
    "bali-people-search-ranking-beta4.js",
    "bali-people-public-cards-beta4.js",
    "bali-people-vip-frame-beta4.js",
    "crown-win-cards-beta4.js",
    "bali-people-crown-frame-beta4.js",
    "full-demo-people-finalizer-beta4.js",
    "profile-ranking-full-beta4.js",
    "profile-recent-rewards-beta4.js",
    "vip-duration-options-beta4.js",
    "chip-requests-user-beta4.js",
    "beta4-home-design.js",
    "profile-full-restore-beta4.js",
    "profile-controls-final-beta4.js",
    "full-demo-review-window-beta4.js",
    "venue-reviews-user-beta4.js"
  ];

  css.forEach(name => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `./${name}?v=${version}`;
    document.head.appendChild(link);
  });

  const loadScript = name => new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `./${name}?v=${version}`;
    script.onload = () => resolve(name);
    script.onerror = () => reject(new Error(`Не удалось загрузить ${name}`));
    document.body.appendChild(script);
  });

  for (const name of critical) await loadScript(name);

  document.documentElement.dataset.baliMode = "full-browser-demo";
  document.documentElement.dataset.database = "disabled";
  document.documentElement.dataset.externalAuth = "disabled";
  document.documentElement.dataset.fullDemoReady = "true";
  window.BaliWebDemoSanitize?.apply?.();
  window.dispatchEvent(new CustomEvent("bali:full-demo-ready"));

  await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
  for (const name of enhancements) {
    try { await loadScript(name); }
    catch (error) { console.warn(error); }
  }

  window.BaliWebDemoSanitize?.apply?.();
  window.BaliFullDemoEvents?.decorateEvents?.();
  window.BaliFullDemoPeople?.mountCurrentEvent?.();
  window.BaliFullDemoPeopleFinalizer?.forceFullRender?.();
  window.BaliFullDemoNavigation?.sync?.();
  window.dispatchEvent(new CustomEvent("bali:full-demo-enhancements-ready"));
})().catch(error => {
  console.error(error);
  document.body.innerHTML = `<div style="padding:24px;color:white;background:#080a0a;min-height:100vh;font-family:system-ui"><h2>Не удалось загрузить полную BALI DEMO</h2><p>${String(error.message || error)}</p><button onclick="location.reload()" style="min-height:44px;padding:0 16px;border:0;border-radius:12px;background:#c8ff3d;color:#080a0a;font-weight:800">Обновить страницу</button></div>`;
})();