(() => {
  if (window.__BALI_PEOPLE_PRESENCE_VISIBILITY_PRODUCTION__) return;
  window.__BALI_PEOPLE_PRESENCE_VISIBILITY_PRODUCTION__ = true;

  let refreshing = false;
  let visible = false;

  function apply() {
    const tab = document.querySelector('[data-social-v2-tab="inside"]');
    if (!tab) return;
    tab.hidden = !visible;
    tab.style.display = visible ? "" : "none";
    tab.setAttribute("aria-hidden", visible ? "false" : "true");
    const tabs = tab.closest(".social-tabs-v2");
    if (tabs) tabs.style.gridTemplateColumns = visible ? "repeat(3,minmax(0,1fr))" : "repeat(2,minmax(0,1fr))";
    if (!visible && tab.classList.contains("active")) document.querySelector('[data-social-v2-tab="all"]')?.click();
  }

  async function refresh() {
    if (refreshing) return;
    refreshing = true;
    try {
      const attendance = window.BaliEventQrAttendance;
      const rows = attendance?.listPresence ? await attendance.listPresence() : attendance?.listCheckins ? await attendance.listCheckins() : [];
      visible = (rows || []).some(row => !row.left_at && row.presence_status !== "left");
      apply();
    } catch {
      visible = false;
      apply();
    } finally {
      refreshing = false;
    }
  }

  new MutationObserver(() => requestAnimationFrame(apply)).observe(document.body, { childList: true, subtree: true });
  ["bali:production-ready", "bali:checkin-complete", "bali:checkin-left", "bali:presence-changed", "bali:social-changed"]
    .forEach(name => window.addEventListener(name, refresh));
  [0, 300, 1000, 2500].forEach(delay => setTimeout(refresh, delay));
  setInterval(refresh, 15000);

  window.BaliPeoplePresenceVisibility = { refresh, apply, isVisible: () => visible };
})();