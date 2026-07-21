(() => {
  if (window.__BALI_DEMO_ADMIN_TOOLBAR__ || !window.BaliDemo) return;
  window.__BALI_DEMO_ADMIN_TOOLBAR__ = true;

  if (window.BaliStore) {
    window.BaliStore.resetDemo = () => {
      window.BaliDemo.reset();
      location.reload();
    };
  }

  function openDemo() {
    const button = document.getElementById("demoLogin");
    const app = document.getElementById("appView");
    if (button && app?.classList.contains("hidden")) button.click();
    const badge = document.getElementById("modeBadge");
    if (badge) badge.textContent = "ДЕМО · 6 ГОСТЕЙ";
    document.querySelectorAll('a[href*="beta4-stable.html"]').forEach(link => {
      link.href = "./beta4-stable.html?v=bali-club-suite-11-crown-birthdays-final-2";
      link.textContent = "Открыть пользователя ↗";
    });
    const hint = document.getElementById("loginHint");
    if (hint) hint.textContent = "Демо-база загружена: пользователи, брони, баллы, VIP и конкурс.";
  }

  [0, 120, 350, 800, 1400].forEach(delay => setTimeout(openDemo, delay));
})();
