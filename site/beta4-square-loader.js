(async () => {
  const version = "bali-web-demo-2";
  window.BALI_DEMO_ONLY = true;
  window.BALI_WEB_DEMO = true;

  const css = [
    "beta4-app.css",
    "beta4-layout-map.css",
    "beta4-home-links.css",
    "beta4-social.css",
    "legacy-nav-final-beta4.css"
  ];

  const js = [
    "config.js",
    "store.js",
    "reviews-public-save-beta4.js",
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
    "bali-people-status-sync-beta4.js",
    "seating-templates-core-beta4.js",
    "beta4-app.js",
    "legacy-nav-final-beta4.js",
    "home-layout-final-beta4.js",
    "beta4-menu-categories.js",
    "beta4-menu-media.js",
    "beta4-layout-map.js",
    "beta4-home-links.js",
    "beta4-profile-booking.js",
    "beta4-loyalty-ui-stable.js",
    "beta4-social-page.js",
    "night-crown-beta4.js",
    "night-crown-vote-lock-beta4.js",
    "night-crown-photo-fix-beta4.js",
    "night-crown-status-notify-beta4.js",
    "night-crown-prize-notify-beta4.js",
    "night-crown-event-badge-beta4.js",
    "beta4-reward-icon-view.js",
    "beta4-qr-checkin.js",
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
    "profile-ranking-full-beta4.js",
    "profile-recent-rewards-beta4.js",
    "vip-duration-options-beta4.js",
    "chip-requests-user-beta4.js",
    "beta4-home-design.js",
    "profile-full-restore-beta4.js",
    "profile-controls-final-beta4.js",
    "legacy-event-attendance-beta4.js",
    "event-details-lineup-beta4.js",
    "venue-reviews-user-beta4.js",
    "bali-web-demo-sanitize.js"
  ];

  css.forEach(name => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `./${name}?v=${version}`;
    document.head.appendChild(link);
  });

  for (const name of js) {
    await new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `./${name}?v=${version}`;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Не удалось загрузить ${name}`));
      document.body.appendChild(script);
    });
  }

  document.documentElement.dataset.baliMode = "web-demo";
  document.documentElement.dataset.database = "disabled";
  document.documentElement.dataset.externalAuth = "disabled";

  const reset = () => document.querySelector(".booking-data-overlay")?.classList.remove("open");
  document.getElementById("eventDialog")?.addEventListener("close", reset);
  document.addEventListener("click", event => {
    if (event.target.closest("[data-event]")) reset();
  }, true);
})().catch(error => {
  console.error(error);
  document.body.innerHTML = '<div style="padding:24px;color:white;background:#080a0a;min-height:100vh;font-family:system-ui"><h2>Не удалось загрузить автономную WEB DEMO</h2><p>Обновите страницу и попробуйте ещё раз.</p></div>';
});
