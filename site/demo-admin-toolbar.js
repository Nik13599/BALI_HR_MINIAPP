(() => {
  if (window.__BALI_DEMO_ADMIN_TOOLBAR__) return;
  window.__BALI_DEMO_ADMIN_TOOLBAR__ = true;

  function openDemo() {
    const button = document.getElementById("demoLogin");
    const app = document.getElementById("appView");
    if (button && app?.classList.contains("hidden")) button.click();
    const badge = document.getElementById("modeBadge");
    if (badge) badge.textContent = "ДЕМО · 6 ГОСТЕЙ";
    document.querySelectorAll('a[href*="beta4-stable.html"]').forEach(link => {
      link.href = "./demo-user.html";
      link.textContent = "Открыть демо гостя ↗";
    });
  }

  [0, 120, 350, 800].forEach(delay => setTimeout(openDemo, delay));
})();
