(() => {
  if (window.__BALI_PROFILE_HISTORY_TITLE_ONLY__) return;
  window.__BALI_PROFILE_HISTORY_TITLE_ONLY__ = true;
  const style = document.createElement("style");
  style.textContent = `#profileHistoryBody .profile-v2-row{grid-template-columns:42px minmax(0,1fr)!important}#profileHistoryBody .profile-v2-row p,#profileHistoryBody .profile-v2-row>b{display:none!important}#profileHistoryBody .profile-v2-row h3{font-size:12px!important;margin:0!important}`;
  document.head.appendChild(style);
})();