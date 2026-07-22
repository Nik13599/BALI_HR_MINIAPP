(() => {
  if (window.__BALI_DEMO_ADMIN_TOOLBAR__ || !window.BaliDemo) return;
  window.__BALI_DEMO_ADMIN_TOOLBAR__ = true;

  if (window.BaliStore) {
    window.BaliStore.resetDemo = () => {
      window.BaliDemo.reset();
      localStorage.removeItem("bali_event_content_demo_seed_v1");
      localStorage.removeItem("bali_venue_content_v1");
      localStorage.removeItem("bali_reviews_v1");
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
      link.href = "./beta4-stable.html?v=bali-event-venue-reviews-2-final";
      link.textContent = "Открыть пользователя ↗";
    });
    const hint = document.getElementById("loginHint");
    if (hint) hint.textContent = "Демо-база загружена: события, артисты, площадка, отзывы, пользователи, брони, баллы, VIP и конкурс.";
  }

  [0, 120, 350, 800, 1400].forEach(delay => setTimeout(openDemo, delay));
})();