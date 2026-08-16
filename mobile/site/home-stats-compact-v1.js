(() => {
  "use strict";

  if (window.__BALI_HOME_STATS_COMPACT_V1__) return;
  window.__BALI_HOME_STATS_COMPACT_V1__ = true;

  function apply() {
    let style = document.getElementById("baliHomeStatsCompactV1");
    if (!style) {
      style = document.createElement("style");
      style.id = "baliHomeStatsCompactV1";
      document.head.appendChild(style);
    }

    style.textContent = `
      @media (max-width:760px){
        [data-screen="home"] .bali-home-reference-stats{gap:3px!important}
        [data-screen="home"] .bali-home-stat{
          min-height:54px!important;
          padding:4px!important;
          border-radius:9px!important;
        }
        [data-screen="home"] .bali-home-stat-icon{
          width:19px!important;
          height:19px!important;
          border-radius:6px!important;
        }
        [data-screen="home"] .bali-home-stat-copy{gap:1px!important}
        [data-screen="home"] .bali-home-stat-label{
          font-size:5.2px!important;
          line-height:1!important;
        }
        [data-screen="home"] .bali-home-stat strong{
          font-size:11.5px!important;
          line-height:1!important;
        }
        [data-screen="home"] .bali-home-stat small{
          font-size:5px!important;
          line-height:1.05!important;
        }
        [data-screen="home"] .bali-home-notice-badge{
          top:2px!important;
          left:18px!important;
          min-width:13px!important;
          height:13px!important;
          padding:0 3px!important;
          font-size:6.5px!important;
        }
      }
    `;

    window.BaliHomeOneScreen?.fit?.();
  }

  apply();
  document.addEventListener("DOMContentLoaded", apply, { once:true });
  [
    "bali:full-demo-enhancements-ready",
    "bali:home-design-changed",
    "bali:data-changed",
    "bali:beta4-changed"
  ].forEach(name => window.addEventListener(name, apply));
})();
