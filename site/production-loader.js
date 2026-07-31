(async () => {
  "use strict";
  const version = "bali-production-match3-infinite-1";
  window.BALI_DEMO_ONLY = false;
  window.BALI_WEB_DEMO = false;
  window.BALI_BROWSER_DEMO = false;
  window.BALI_FULL_DEMO = false;
  window.BALI_COMPACT_PROFILE = true;

  const gate = document.getElementById("productionGate");
  const gateTitle = document.getElementById("productionGateTitle");
  const gateMessage = document.getElementById("productionGateMessage");
  const app = document.getElementById("app");
  const css = [
    "beta4-app.css",
    "beta4-layout-map.css",
    "beta4-home-links.css",
    "beta4-social.css",
    "match3-game-beta4.css",
    "legacy-nav-final-beta4.css",
    "full-demo-fixes-beta4.css",
    "bali-temple-theme-beta4.css",
    "bali-visual-blocks-beta4.css",
    "production-shell.css",
  ];
  const critical = [
    "match3-infinite-engine-beta4.js",
    "production-client.js",
    "production-match3-infinite.js",
    "beta4-app.js",
    "match3-game-ui-beta4.js",
    "home-community-copy-beta4.js",
    "home-booking-controls-beta4.js",
    "fast-event-dialog-beta4.js",
    "nav-icons-core-beta4.js",
    "legacy-nav-final-beta4.js",
    "home-layout-final-beta4.js",
    "beta4-menu-media.js",
    "beta4-home-links.js",
    "beta4-profile-booking.js",
    "production-booking-qr.js",
    "production-profile-economy.js",
    "beta4-social-page.js",
    "production-social-ui.js",
    "bali-people-clans-beta4.js",
  ];
  const enhancements = [
    "beta4-reward-icon-view.js",
    "beta4-ranking-visits.js",
    "bali-people-public-cards-beta4.js",
    "bali-people-vip-frame-beta4.js",
    "people-profile-stability-beta4.js",
    "bali-visual-blocks-core-beta4.js",
  ];
  const publicConfig = fetch("/api/v1/config/public", { credentials: "same-origin" })
    .then(response => response.ok ? response.json() : {})
    .then(config => {
      const meta = document.querySelector('meta[name="bali-telegram-url"]');
      if (meta && config.telegramBotUrl) meta.content = config.telegramBotUrl;
      return config;
    })
    .catch(() => ({}));

  css.forEach(name => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `/site/${name}?v=${version}`;
    document.head.appendChild(link);
  });
  const loadScript = (name, optional = false) => new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `/site/${name}?v=${version}`;
    script.onload = () => resolve(name);
    script.onerror = () => {
      const error = new Error(`Не удалось загрузить ${name}`);
      if (optional) {
        console.warn(error);
        resolve(null);
      } else {
        reject(error);
      }
    };
    document.body.appendChild(script);
  });
  const loadOrdered = async (names, optional = false) => {
    for (const name of names) await loadScript(name, optional);
  };

  try {
    await loadScript("match3-infinite-engine-beta4.js");
    await loadScript("production-client.js");
    await window.BaliProduction.bootstrap();
    gate.hidden = true;
    app.hidden = false;
    await loadOrdered(critical.slice(2));
    document.documentElement.dataset.baliMode = "production";
    document.documentElement.dataset.database = "enabled";
    document.documentElement.dataset.externalAuth = "telegram";
    document.documentElement.dataset.productionReady = "true";
    window.dispatchEvent(new CustomEvent("bali:production-ready"));
    await new Promise(resolve => requestAnimationFrame(resolve));
    await loadOrdered(enhancements, true);
    window.BaliHomeCommunityCopy?.apply?.();
    window.BaliHomeBookingControls?.renderBooking?.();
    await window.BaliProduction.refreshSecondary().catch(error => {
      console.warn("Secondary production data will be retried after the next action", error);
    });
  } catch (error) {
    await publicConfig;
    console.error(error);
    app.hidden = true;
    gate.hidden = false;
    if (error?.status === 401) {
      gateTitle.textContent = "Откройте BALI через Telegram";
      gateMessage.textContent = "Доступ к пользовательскому приложению появляется после проверки Telegram Mini App.";
      const telegramUrl = document.querySelector('meta[name="bali-telegram-url"]')?.content;
      const link = document.getElementById("productionTelegramLink");
      if (telegramUrl) {
        link.href = telegramUrl;
        link.hidden = false;
      }
    } else {
      gateTitle.textContent = "BALI временно недоступен";
      gateMessage.textContent = error?.message || "Не удалось загрузить приложение. Повторите попытку.";
      document.getElementById("productionRetry").hidden = false;
    }
  }
})();
