(() => {
  "use strict";

  if (window.__BALI_HOME_FINAL_LAYOUT_V4__) return;
  window.__BALI_HOME_FINAL_LAYOUT_V4__ = true;

  const mobileQuery = window.matchMedia("(max-width: 760px)");
  const fallbackText = "BALI — приложение ночного клуба и комьюнити людей, объединённых музыкой, любимыми диджеями, артистами и яркими вечеринками.";
  const clubLine = "NIGHT CLUB · CONTACT BAR · 18+";
  let lastDescription = fallbackText;
  let frame = 0;

  function ensureStyles() {
    document.getElementById("baliHomeFinalLayoutStyles")?.remove();
    if (document.getElementById("baliHomeFinalLayoutStylesV4")) return;

    const style = document.createElement("style");
    style.id = "baliHomeFinalLayoutStylesV4";
    style.textContent = `
      @media (max-width:760px){
        .shell{
          grid-template-rows:calc(60px + var(--safe-top)) minmax(0,1fr) calc(42px + var(--safe))!important;
        }
        .top{
          min-height:58px!important;
          display:flex!important;
          align-items:center!important;
          gap:6px!important;
          padding:2px 7px!important;
          background:transparent!important;
        }
        .top .brand{
          flex:1 1 auto!important;
          min-width:0!important;
          display:flex!important;
          align-items:center!important;
          gap:6px!important;
        }
        .top .logo{
          flex:0 0 auto!important;
          width:38px!important;
          height:38px!important;
          border-radius:12px!important;
          font-size:18px!important;
        }
        .top .bali-brand-copy{
          min-width:0!important;
          display:flex!important;
          flex-direction:column!important;
          justify-content:center!important;
          gap:0!important;
          margin:0!important;
          padding:0!important;
        }
        .top .brand strong{
          margin:0!important;
          font-size:19px!important;
          line-height:.95!important;
        }
        .top .brand small{
          margin:1px 0 0!important;
          color:#b8bcb8!important;
          font-size:6.8px!important;
          line-height:1.05!important;
          letter-spacing:.035em!important;
          white-space:nowrap!important;
        }
        .top-profile-button{
          flex:0 0 auto!important;
          width:38px!important;
          height:38px!important;
          padding:2px!important;
        }
        .bali-top-description{
          max-width:calc(100vw - 92px)!important;
          margin:1px 0 0!important;
          color:#d8dbd8!important;
          font:500 7.8px/1.08 Manrope,system-ui,sans-serif!important;
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
          min-height:70px!important;
          padding:6px!important;
        }
        [data-screen="home"] .bali-home-stat-icon{
          width:24px!important;
          height:24px!important;
        }
        [data-screen="home"] .bali-home-stat strong{font-size:15px!important}
        [data-screen="home"] .bali-home-stat-label{font-size:6.3px!important}
        [data-screen="home"] .bali-home-stat small{font-size:6.2px!important}
        [data-screen="home"] .bali-home-event-grid{
          grid-template-columns:108px minmax(0,1fr)!important;
          gap:8px!important;
        }
        [data-screen="home"] .bali-home-event-poster{
          min-height:178px!important;
          height:178px!important;
        }
        [data-screen="home"] .bali-home-event-title{font-size:22px!important}
        [data-screen="home"] .bali-home-event-description{font-size:9px!important}
        [data-screen="home"] .bali-home-count{min-height:25px!important;font-size:7.3px!important}
        [data-screen="home"] .bali-home-event-actions button{min-height:31px!important;font-size:10px!important}
        [data-screen="home"] .bali-home-reference-checkin{min-height:58px!important;padding:6px!important}
        [data-screen="home"] .bali-home-checkin-copy h3{font-size:12.5px!important}
        [data-screen="home"] .bali-home-checkin-copy p{font-size:7px!important}
        [data-screen="home"] .bali-home-scan{min-height:24px!important;font-size:8.3px!important}
        [data-screen="home"] .bali-home-booking-strip{min-height:42px!important}
        [data-screen="home"] .bali-home-social-link{min-height:37px!important}
        [data-screen="home"] .bali-home-bottom-card,
        [data-screen="home"] .bali-home-reference-phone,
        [data-screen="home"] .bali-home-reference-about{min-height:44px!important}
        .shell>nav.nav[data-navigation-ready="true"]{
          width:calc(100% - 8px)!important;
          min-height:38px!important;
          margin:0 auto 1px!important;
          padding:1px 3px calc(1px + var(--safe))!important;
          border-radius:11px!important;
        }
        .shell>nav.nav[data-navigation-ready="true"]>button[data-page]>i{
          width:17px!important;
          height:17px!important;
        }
        .shell>nav.nav[data-navigation-ready="true"]>button[data-page]>span{
          font-size:4.8px!important;
        }
      }
      @media (max-width:360px){
        .bali-top-description{font-size:7.2px!important}
        [data-screen="home"] .bali-home-event-grid{grid-template-columns:96px minmax(0,1fr)!important}
        [data-screen="home"] .bali-home-event-poster{min-height:170px!important;height:170px!important}
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
      const brand = top?.querySelector(".brand");
      const subtitle = brand?.querySelector("small");
      const home = document.querySelector('[data-screen="home"]');
      const root = home?.querySelector(".bali-home-reference");
      if (!top || !brand || !subtitle || !root) return;

      const hero = root.querySelector(".bali-home-reference-hero");
      const heroText = hero?.querySelector("p")?.textContent?.trim();
      if (heroText) lastDescription = heroText;

      subtitle.textContent = clubLine;
      const copy = subtitle.parentElement;
      copy?.classList.add("bali-brand-copy");

      let description = copy?.querySelector(":scope > .bali-top-description");
      if (!description && copy) {
        description = document.createElement("p");
        description.className = "bali-top-description";
        subtitle.insertAdjacentElement("afterend", description);
      }
      if (description && description.textContent !== lastDescription) {
        description.textContent = lastDescription;
      }

      top.querySelectorAll(":scope > .bali-top-description").forEach(node => node.remove());
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
