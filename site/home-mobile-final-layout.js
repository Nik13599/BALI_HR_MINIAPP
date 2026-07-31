(() => {
  "use strict";

  if (window.__BALI_HOME_FINAL_LAYOUT__) return;
  window.__BALI_HOME_FINAL_LAYOUT__ = true;

  const mobileQuery = window.matchMedia("(max-width: 760px)");
  const fallbackText = "BALI — приложение ночного клуба и комьюнити людей, объединённых музыкой, любимыми диджеями, артистами и яркими вечеринками.";
  let lastDescription = fallbackText;
  let frame = 0;

  function ensureStyles() {
    if (document.getElementById("baliHomeFinalLayoutStyles")) return;
    const style = document.createElement("style");
    style.id = "baliHomeFinalLayoutStyles";
    style.textContent = `
      @media (max-width:760px){
        .shell{
          grid-template-rows:calc(70px + var(--safe-top)) minmax(0,1fr) calc(46px + var(--safe))!important;
        }
        .top{
          min-height:68px!important;
          display:grid!important;
          grid-template-columns:minmax(0,1fr) auto!important;
          grid-template-rows:auto auto!important;
          align-content:center!important;
          column-gap:8px!important;
          row-gap:1px!important;
          padding:3px 8px!important;
          background:transparent!important;
        }
        .top .brand{
          grid-column:1!important;
          grid-row:1!important;
          min-width:0!important;
          gap:8px!important;
        }
        .top .logo{
          width:38px!important;
          height:38px!important;
          border-radius:12px!important;
          font-size:18px!important;
        }
        .top .brand strong{font-size:19px!important}
        .top .brand small{font-size:7px!important;margin-top:2px!important}
        .top-profile-button{
          grid-column:2!important;
          grid-row:1/3!important;
          align-self:center!important;
          width:40px!important;
          height:40px!important;
        }
        .bali-top-description{
          grid-column:1!important;
          grid-row:2!important;
          min-width:0!important;
          max-width:calc(100vw - 68px)!important;
          margin:0!important;
          color:#d5d8d5!important;
          font:500 8.7px/1.18 Manrope,system-ui,sans-serif!important;
          letter-spacing:0!important;
        }
        [data-screen="home"] .bali-home-reference-hero,
        [data-screen="home"] .bali-home-people-link{
          display:none!important;
        }
        [data-screen="home"] .bali-home-reference{
          gap:5px!important;
        }
        [data-screen="home"] .bali-home-stat{
          min-height:66px!important;
          padding:6px!important;
        }
        [data-screen="home"] .bali-home-stat-icon{
          width:23px!important;
          height:23px!important;
        }
        [data-screen="home"] .bali-home-stat strong{font-size:14px!important}
        [data-screen="home"] .bali-home-stat-label{font-size:6px!important}
        [data-screen="home"] .bali-home-stat small{font-size:6px!important}
        [data-screen="home"] .bali-home-event-grid{
          grid-template-columns:102px minmax(0,1fr)!important;
          gap:8px!important;
        }
        [data-screen="home"] .bali-home-event-poster{
          min-height:170px!important;
          height:170px!important;
        }
        [data-screen="home"] .bali-home-event-title{font-size:21px!important}
        [data-screen="home"] .bali-home-event-description{font-size:8.5px!important}
        [data-screen="home"] .bali-home-count{min-height:24px!important;font-size:7px!important}
        [data-screen="home"] .bali-home-event-actions button{min-height:29px!important;font-size:9.5px!important}
        [data-screen="home"] .bali-home-reference-checkin{min-height:55px!important;padding:6px!important}
        [data-screen="home"] .bali-home-checkin-copy h3{font-size:12px!important}
        [data-screen="home"] .bali-home-checkin-copy p{font-size:6.5px!important}
        [data-screen="home"] .bali-home-scan{min-height:23px!important;font-size:8px!important}
        [data-screen="home"] .bali-home-booking-strip{min-height:40px!important}
        [data-screen="home"] .bali-home-social-link{min-height:35px!important}
        [data-screen="home"] .bali-home-bottom-card,
        [data-screen="home"] .bali-home-reference-phone,
        [data-screen="home"] .bali-home-reference-about{min-height:42px!important}
        .shell>nav.nav[data-navigation-ready="true"]{
          width:calc(100% - 8px)!important;
          min-height:42px!important;
          margin:0 auto 2px!important;
          padding:2px 3px calc(2px + var(--safe))!important;
          border-radius:12px!important;
        }
        .shell>nav.nav[data-navigation-ready="true"]>button[data-page]>i{
          width:18px!important;
          height:18px!important;
        }
        .shell>nav.nav[data-navigation-ready="true"]>button[data-page]>span{
          font-size:5px!important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function applyLayout() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (!mobileQuery.matches) return;
      ensureStyles();

      const top = document.querySelector(".top");
      const home = document.querySelector('[data-screen="home"]');
      const root = home?.querySelector(".bali-home-reference");
      if (!top || !root) return;

      const hero = root.querySelector(".bali-home-reference-hero");
      const heroText = hero?.querySelector("p")?.textContent?.trim();
      if (heroText) lastDescription = heroText;

      let description = top.querySelector(":scope > .bali-top-description");
      if (!description) {
        description = document.createElement("p");
        description.className = "bali-top-description";
        top.appendChild(description);
      }
      if (description.textContent !== lastDescription) description.textContent = lastDescription;

      hero?.remove();
      root.querySelectorAll(".bali-home-people-link").forEach(node => node.remove());

      window.BaliHomeOneScreen?.fit?.();
    });
  }

  const observer = new MutationObserver(mutations => {
    if (mutations.some(mutation => mutation.type === "childList")) applyLayout();
  });

  function start() {
    observer.observe(document.body, { subtree:true, childList:true });
    applyLayout();
    setTimeout(applyLayout, 100);
    setTimeout(applyLayout, 400);
  }

  window.addEventListener("resize", applyLayout, { passive:true });
  window.addEventListener("orientationchange", applyLayout, { passive:true });
  [
    "bali:full-demo-enhancements-ready",
    "bali:home-design-changed",
    "bali:data-changed",
    "bali:beta4-changed",
    "bali:telegram-viewport-changed"
  ].forEach(name => window.addEventListener(name, applyLayout));

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once:true });
  else start();

  window.BaliHomeFinalLayout = { apply:applyLayout };
})();
