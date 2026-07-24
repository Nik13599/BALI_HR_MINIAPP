(() => {
  if (window.__BALI_PRODUCTION_INTEGRITY_FIX__) return;
  window.__BALI_PRODUCTION_INTEGRITY_FIX__ = true;

  const LABELS = {
    events: "Ближайшие события",
    about: "О клубе",
    shop: "BALI Shop",
    rewards: "Мои награды",
    gifts: "Мои подарки"
  };

  const applyLabels = () => {
    document.querySelectorAll('[data-block="nearest-events"] .title,[data-section="nearest-events"] .title').forEach(n => n.textContent = LABELS.events);
    document.querySelectorAll('[data-block="about-club"] .title,[data-section="about-club"] .title').forEach(n => n.textContent = LABELS.about);
    document.querySelectorAll('[data-open-profile-points] strong').forEach(n => n.textContent = LABELS.shop);
    document.querySelectorAll('[data-open-profile-rewards] strong').forEach(n => n.textContent = LABELS.rewards);
    document.querySelectorAll('[data-open-profile-gifts] strong').forEach(n => n.textContent = LABELS.gifts);
  };

  const hasActiveQrAttendance = async () => {
    try {
      const attendance = window.BaliEventQrAttendance;
      const rows = attendance?.listCheckins ? await attendance.listCheckins() : [];
      return (rows || []).some(row => !row.left_at && row.presence_status !== "left");
    } catch (_) { return false; }
  };

  async function refreshInsideTab() {
    const tab = document.querySelector('[data-social-v2-tab="inside"]');
    if (!tab) return;
    const visible = await hasActiveQrAttendance();
    tab.hidden = !visible;
    tab.style.display = visible ? "" : "none";
  }

  window.addEventListener("bali:production-ready", applyLabels);
  window.addEventListener("bali:social-changed", applyLabels);
  window.addEventListener("bali:checkin-complete", refreshInsideTab);
  new MutationObserver(applyLabels).observe(document.body, {childList:true,subtree:true});
  setTimeout(applyLabels, 500);
  setInterval(refreshInsideTab, 15000);
})();
