(() => {
  if (window.__BALI_WEB_DEMO_SANITIZE__) return;
  window.__BALI_WEB_DEMO_SANITIZE__ = true;
  window.BALI_WEB_DEMO = true;

  const AUTH_KEY_PATTERN = /(?:^|[_-])(?:telegram|tg)(?:[_-]?(?:auth|initdata|session|token))|^sb-.*-auth-token$|supabase.*auth/i;
  const TELEGRAM_SDK_PATTERN = /telegram-web-app|telegram\.org\/js/i;

  function removeAuthKeys(storage) {
    if (!storage) return;
    const keys = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && AUTH_KEY_PATTERN.test(key)) keys.push(key);
    }
    keys.forEach(key => storage.removeItem(key));
  }

  function removeTelegramSdk(root = document) {
    root.querySelectorAll?.("script[src]").forEach(script => {
      if (TELEGRAM_SDK_PATTERN.test(script.getAttribute("src") || "")) script.remove();
    });
  }

  function apply() {
    try { delete window.Telegram; } catch { window.Telegram = undefined; }
    removeAuthKeys(window.localStorage);
    removeAuthKeys(window.sessionStorage);
    removeTelegramSdk(document);
  }

  apply();
  document.addEventListener("DOMContentLoaded", apply, { once:true });
  window.addEventListener("bali:full-demo-ready", apply);

  window.BaliWebDemoSanitize = { apply, removeAuthKeys };
})();