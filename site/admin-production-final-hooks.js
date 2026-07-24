(() => {
  if (window.__BALI_ADMIN_PRODUCTION_FINAL_HOOKS__) return;
  window.__BALI_ADMIN_PRODUCTION_FINAL_HOOKS__ = true;

  const baseRender = render;
  render = async function() {
    const result = await baseRender();
    if (state.view === "settings") {
      try { await window.BaliAdminVenueReviews?.mountVenueSettings?.(); }
      catch (error) { console.warn("[BALI settings venue]", error?.message || error); }
    }
    return result;
  };

  document.addEventListener("click", event => {
    const settings = event.target.closest('#adminNav [data-view="settings"]');
    if (!settings) return;
    setTimeout(() => window.BaliAdminVenueReviews?.mountVenueSettings?.(), 0);
  }, true);
})();