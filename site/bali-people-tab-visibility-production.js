(() => {
  if (window.__BALI_PEOPLE_TAB_VISIBILITY_PRODUCTION__) return;
  window.__BALI_PEOPLE_TAB_VISIBILITY_PRODUCTION__ = true;

  function activePresence() {
    const rows = window.BaliPeoplePage?.presence?.() || [];
    return rows.filter(row => !row.left_at && row.presence_status !== "left");
  }

  function apply() {
    const tab = document.querySelector('[data-social-v2-tab="inside"]');
    if (!tab) return;
    const visible = activePresence().length > 0;
    tab.hidden = !visible;
    tab.style.display = visible ? "" : "none";
    tab.setAttribute("aria-hidden", visible ? "false" : "true");

    const tabs = tab.closest(".social-tabs-v2");
    if (tabs) tabs.style.gridTemplateColumns = visible ? "repeat(3,minmax(0,1fr))" : "repeat(2,minmax(0,1fr))";

    if (!visible && tab.classList.contains("active")) {
      document.querySelector('[data-social-v2-tab="all"]')?.click();
    }
  }

  [0, 100, 400, 1200].forEach(delay => setTimeout(apply, delay));
  ["bali:production-ready", "bali:social-changed", "bali:checkin-complete", "bali:checkin-left", "bali:presence-changed"]
    .forEach(name => window.addEventListener(name, () => setTimeout(apply, 0)));
  setInterval(apply, 15000);

  window.BaliPeopleTabVisibility = { apply };
})();