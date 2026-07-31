(() => {
  "use strict";

  if (window.__BALI_ALL_PAGES_ONE_SCREEN_V1__) return;
  window.__BALI_ALL_PAGES_ONE_SCREEN_V1__ = true;

  const mobileQuery = window.matchMedia("(max-width: 760px)");
  const targets = new Set(["events", "menu", "dating", "people", "ranking", "crown", "profile"]);
  let frame = 0;
  let timers = [];

  function ensureStyles() {
    if (document.getElementById("baliAllPagesOneScreenV1")) return;
    const style = document.createElement("style");
    style.id = "baliAllPagesOneScreenV1";
    style.textContent = `
      @media (max-width:760px){
        .pages,
        .page[data-screen]{min-height:0!important}
        .page[data-screen]:not([data-screen="home"]){
          overflow:hidden!important;
          overscroll-behavior:none!important;
        }
        .page[data-screen]:not([data-screen="home"])>.inner{
          box-sizing:border-box!important;
          height:100%!important;
          min-height:0!important;
          padding:5px 7px 4px!important;
          overflow:hidden!important;
        }
        .page[data-screen]:not([data-screen="home"]) .head{
          min-height:30px!important;
          margin:0 0 4px!important;
          align-items:center!important;
        }
        .page[data-screen]:not([data-screen="home"]) .head h2{
          margin:0!important;
          font-size:18px!important;
          line-height:1!important;
        }
        .page[data-screen]:not([data-screen="home"]) .head .eyebrow{
          font-size:6px!important;
          line-height:1!important;
        }
        .page[data-screen]:not([data-screen="home"]) .head .count{
          font-size:6.5px!important;
          padding:4px 7px!important;
        }

        /* Афиши: две компактные строки с горизонтальным листанием. */
        [data-screen="events"]>.inner{
          display:grid!important;
          grid-template-rows:auto minmax(0,1fr)!important;
        }
        [data-screen="events"] .events{
          min-height:0!important;
          display:grid!important;
          grid-auto-flow:column!important;
          grid-template-rows:repeat(2,minmax(0,1fr))!important;
          grid-auto-columns:min(47vw,210px)!important;
          gap:6px!important;
          overflow-x:auto!important;
          overflow-y:hidden!important;
          scroll-snap-type:x proximity!important;
          touch-action:pan-x!important;
          scrollbar-width:none!important;
        }
        [data-screen="events"] .events::-webkit-scrollbar{display:none!important}
        [data-screen="events"] .event{
          min-height:0!important;
          height:100%!important;
          display:grid!important;
          grid-template-rows:minmax(0,1fr) auto!important;
          scroll-snap-align:start!important;
          overflow:hidden!important;
          border-radius:13px!important;
        }
        [data-screen="events"] .event-media{
          min-height:0!important;
          height:auto!important;
          aspect-ratio:auto!important;
        }
        [data-screen="events"] .event-body{padding:5px 6px!important}
        [data-screen="events"] .event-body small{font-size:5.8px!important}
        [data-screen="events"] .event-body h3{margin:2px 0!important;font-size:10px!important;line-height:1.08!important}
        [data-screen="events"] .event-body p{
          margin:0!important;
          font-size:6.5px!important;
          line-height:1.2!important;
          display:-webkit-box!important;
          -webkit-box-orient:vertical!important;
          -webkit-line-clamp:2!important;
          overflow:hidden!important;
        }

        /* Меню: четыре строки, категории и позиции листаются только вбок. */
        [data-screen="menu"]>.inner{
          display:grid!important;
          grid-template-rows:auto auto minmax(0,1fr)!important;
        }
        [data-screen="menu"] .tabs{
          min-height:27px!important;
          margin:0 0 4px!important;
          display:flex!important;
          flex-wrap:nowrap!important;
          gap:4px!important;
          overflow-x:auto!important;
          overflow-y:hidden!important;
          touch-action:pan-x!important;
          scrollbar-width:none!important;
        }
        [data-screen="menu"] .tabs::-webkit-scrollbar{display:none!important}
        [data-screen="menu"] .tabs button{
          flex:0 0 auto!important;
          min-height:24px!important;
          padding:0 8px!important;
          font-size:6.5px!important;
          border-radius:9px!important;
        }
        [data-screen="menu"] .menu-list{
          min-height:0!important;
          display:grid!important;
          grid-auto-flow:column!important;
          grid-template-rows:repeat(4,minmax(0,1fr))!important;
          grid-auto-columns:min(48vw,220px)!important;
          gap:5px!important;
          overflow-x:auto!important;
          overflow-y:hidden!important;
          scroll-snap-type:x proximity!important;
          touch-action:pan-x!important;
          scrollbar-width:none!important;
        }
        [data-screen="menu"] .menu-list::-webkit-scrollbar{display:none!important}
        [data-screen="menu"] .menu-item{
          min-height:0!important;
          height:100%!important;
          padding:6px 7px!important;
          border-radius:11px!important;
          scroll-snap-align:start!important;
          overflow:hidden!important;
        }
        [data-screen="menu"] .menu-item h3{margin:0 0 2px!important;font-size:9px!important;line-height:1.05!important}
        [data-screen="menu"] .menu-item p{
          margin:0!important;
          font-size:6px!important;
          line-height:1.15!important;
          display:-webkit-box!important;
          -webkit-box-orient:vertical!important;
          -webkit-line-clamp:2!important;
          overflow:hidden!important;
        }
        [data-screen="menu"] .menu-item>strong{font-size:8px!important;white-space:nowrap!important}

        /* Люди / BALI PEOPLE: карточки в две строки, вертикальная прокрутка исключена. */
        [data-screen="dating"]>.inner,
        [data-screen="people"]>.inner{
          display:grid!important;
          grid-template-rows:auto auto minmax(0,1fr)!important;
        }
        [data-screen="dating"] .social-tabs-v2,
        [data-screen="people"] .social-tabs-v2{
          min-height:27px!important;
          margin:0 0 4px!important;
          gap:4px!important;
        }
        [data-screen="dating"] .social-tabs-v2 button,
        [data-screen="people"] .social-tabs-v2 button{
          min-height:25px!important;
          font-size:6px!important;
          border-radius:9px!important;
        }
        [data-screen="dating"] #socialV2Content,
        [data-screen="people"] #socialV2Content{
          min-height:0!important;
          overflow:hidden!important;
        }
        [data-screen="dating"] .people-v2-grid,
        [data-screen="people"] .people-v2-grid{
          height:100%!important;
          min-height:0!important;
          display:grid!important;
          grid-auto-flow:column!important;
          grid-template-rows:repeat(2,minmax(0,1fr))!important;
          grid-auto-columns:min(43vw,190px)!important;
          gap:6px!important;
          overflow-x:auto!important;
          overflow-y:hidden!important;
          scroll-snap-type:x proximity!important;
          touch-action:pan-x!important;
          scrollbar-width:none!important;
        }
        [data-screen="dating"] .people-v2-grid::-webkit-scrollbar,
        [data-screen="people"] .people-v2-grid::-webkit-scrollbar{display:none!important}
        [data-screen="dating"] .person-v2,
        [data-screen="people"] .person-v2{
          min-height:0!important;
          height:100%!important;
          display:grid!important;
          grid-template-rows:minmax(0,1fr) auto!important;
          border-radius:12px!important;
          scroll-snap-align:start!important;
        }
        [data-screen="dating"] .person-v2-photo,
        [data-screen="people"] .person-v2-photo{
          min-height:0!important;
          height:auto!important;
          aspect-ratio:auto!important;
        }
        [data-screen="dating"] .person-v2-body,
        [data-screen="people"] .person-v2-body{padding:5px!important}
        [data-screen="dating"] .person-v2-body h3,
        [data-screen="people"] .person-v2-body h3{margin:0 0 2px!important;font-size:9px!important}
        [data-screen="dating"] .person-v2-custom-status,
        [data-screen="people"] .person-v2-custom-status{margin:0 0 2px!important;font-size:5.8px!important}
        [data-screen="dating"] .person-v2-body p,
        [data-screen="people"] .person-v2-body p{
          font-size:5.8px!important;
          line-height:1.15!important;
          display:-webkit-box!important;
          -webkit-box-orient:vertical!important;
          -webkit-line-clamp:1!important;
          overflow:hidden!important;
        }
        [data-screen="dating"] .person-v2-actions,
        [data-screen="people"] .person-v2-actions{margin-top:3px!important;gap:3px!important}
        [data-screen="dating"] .person-v2-actions button,
        [data-screen="people"] .person-v2-actions button{min-height:23px!important;font-size:11px!important;border-radius:8px!important}
        [data-screen="dating"] .person-v2-status,
        [data-screen="people"] .person-v2-status{left:4px!important;right:4px!important;bottom:4px!important;padding:3px!important;font-size:5.5px!important}

        /* Общий рейтинг: podium сверху, остальные строки листаются вбок. */
        [data-screen="ranking"]>.inner{
          display:grid!important;
          grid-template-rows:auto auto minmax(0,1fr)!important;
        }
        [data-screen="ranking"] .podium{
          min-height:72px!important;
          max-height:72px!important;
          margin:0 0 4px!important;
          gap:4px!important;
        }
        [data-screen="ranking"] .podium article{padding:5px!important}
        [data-screen="ranking"] .rank-list{
          min-height:0!important;
          display:grid!important;
          grid-auto-flow:column!important;
          grid-template-rows:repeat(3,minmax(0,1fr))!important;
          grid-auto-columns:min(78vw,330px)!important;
          gap:5px!important;
          overflow-x:auto!important;
          overflow-y:hidden!important;
          touch-action:pan-x!important;
          scrollbar-width:none!important;
        }
        [data-screen="ranking"] .rank-list::-webkit-scrollbar{display:none!important}
        [data-screen="ranking"] .rank-row{min-height:0!important;height:100%!important;padding:5px 7px!important}

        /* Профиль: основные блоки становятся горизонтальными слайдами. */
        [data-screen="profile"]>.inner{
          display:grid!important;
          grid-template-rows:auto minmax(0,1fr)!important;
        }
        .bali-profile-one-screen-track{
          min-height:0!important;
          height:100%!important;
          display:flex!important;
          gap:7px!important;
          overflow-x:auto!important;
          overflow-y:hidden!important;
          scroll-snap-type:x mandatory!important;
          touch-action:pan-x!important;
          scrollbar-width:none!important;
        }
        .bali-profile-one-screen-track::-webkit-scrollbar{display:none!important}
        .bali-profile-one-screen-slide{
          box-sizing:border-box!important;
          flex:0 0 calc(100vw - 28px)!important;
          width:calc(100vw - 28px)!important;
          height:100%!important;
          min-height:0!important;
          padding:2px!important;
          overflow:hidden!important;
          scroll-snap-align:start!important;
        }
        .bali-profile-one-screen-slide>.bali-profile-slide-content{
          width:100%!important;
          transform-origin:top left!important;
        }
        [data-screen="profile"] .ledger,
        [data-screen="profile"] .achievements,
        [data-screen="profile"] .vip-plans{
          display:grid!important;
          grid-auto-flow:column!important;
          grid-template-rows:repeat(3,minmax(0,1fr))!important;
          grid-auto-columns:min(75%,220px)!important;
          gap:4px!important;
          overflow-x:auto!important;
          overflow-y:hidden!important;
          scrollbar-width:none!important;
        }
        [data-screen="profile"] .ledger::-webkit-scrollbar,
        [data-screen="profile"] .achievements::-webkit-scrollbar,
        [data-screen="profile"] .vip-plans::-webkit-scrollbar{display:none!important}
        [data-screen="profile"] .profile-form{
          display:grid!important;
          grid-template-columns:repeat(2,minmax(0,1fr))!important;
          gap:5px!important;
        }
        [data-screen="profile"] .profile-form .full,
        [data-screen="profile"] .profile-form .switch{grid-column:1/-1!important}

        /* Игра: активная игровая сцена всегда вписывается в доступную высоту. */
        [data-screen="crown"]{
          overflow:hidden!important;
        }
        [data-screen="crown"] .match3-scene{
          min-height:0!important;
          overflow:hidden!important;
          transform-origin:top center!important;
        }

        .bali-horizontal-one-screen{
          scrollbar-width:none!important;
        }
        .bali-horizontal-one-screen::-webkit-scrollbar{display:none!important}
      }
    `;
    document.head.appendChild(style);
  }

  function resetFittedRoots() {
    document.querySelectorAll("[data-bali-all-pages-fit]").forEach(node => {
      node.style.removeProperty("transform");
      node.style.removeProperty("transform-origin");
      node.removeAttribute("data-bali-all-pages-fit");
    });
  }

  function prepareProfile(screen) {
    const inner = screen.querySelector(":scope > .inner");
    if (!inner) return;
    let track = inner.querySelector(":scope > .bali-profile-one-screen-track");
    if (!track) {
      track = document.createElement("div");
      track.className = "bali-profile-one-screen-track";
      inner.appendChild(track);
    }

    Array.from(inner.children).forEach(node => {
      if (node === track || node.classList.contains("head")) return;
      const slide = document.createElement("div");
      slide.className = "bali-profile-one-screen-slide";
      const content = document.createElement("div");
      content.className = "bali-profile-slide-content";
      node.replaceWith(slide);
      content.appendChild(node);
      slide.appendChild(content);
      track.appendChild(slide);
    });

    track.querySelectorAll(":scope > .bali-profile-one-screen-slide").forEach(slide => {
      const content = slide.querySelector(":scope > .bali-profile-slide-content");
      if (!content) return;
      content.style.removeProperty("transform");
      content.style.width = "100%";
      const availableHeight = Math.max(1, slide.clientHeight - 4);
      const availableWidth = Math.max(1, slide.clientWidth - 4);
      const naturalHeight = Math.max(1, content.scrollHeight);
      const naturalWidth = Math.max(1, content.scrollWidth);
      const scale = Math.min(1, availableHeight / naturalHeight, availableWidth / naturalWidth);
      content.style.transformOrigin = "top left";
      content.style.transform = `scale(${scale.toFixed(4)})`;
      content.dataset.baliAllPagesFit = scale.toFixed(4);
    });
  }

  function fitGame(screen) {
    const root = screen.querySelector(":scope > .match3-scene") || screen.firstElementChild;
    if (!root) return;
    root.style.removeProperty("transform");
    root.style.transformOrigin = "top center";
    const availableHeight = Math.max(1, screen.clientHeight - 2);
    const availableWidth = Math.max(1, screen.clientWidth - 2);
    const naturalHeight = Math.max(1, root.scrollHeight);
    const naturalWidth = Math.max(1, root.scrollWidth);
    const scale = Math.min(1, availableHeight / naturalHeight, availableWidth / naturalWidth);
    root.style.transform = `scale(${scale.toFixed(4)})`;
    root.dataset.baliAllPagesFit = scale.toFixed(4);
  }

  function fitFallback(screen) {
    const root = screen.querySelector(":scope > .inner") || screen.firstElementChild;
    if (!root) return;
    root.style.removeProperty("transform");
    root.style.transformOrigin = "top center";
    const availableHeight = Math.max(1, screen.clientHeight - 2);
    const naturalHeight = Math.max(1, root.scrollHeight);
    const scale = Math.min(1, availableHeight / naturalHeight);
    root.style.transform = `scale(${scale.toFixed(4)})`;
    root.dataset.baliAllPagesFit = scale.toFixed(4);
  }

  function fitNow() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      ensureStyles();
      resetFittedRoots();
      if (!mobileQuery.matches) return;

      const screen = document.querySelector(".page.active[data-screen]");
      if (!screen || !targets.has(screen.dataset.screen)) return;
      screen.scrollTop = 0;
      screen.style.overflow = "hidden";
      screen.style.overscrollBehavior = "none";

      if (screen.dataset.screen === "profile") prepareProfile(screen);
      else if (screen.dataset.screen === "crown") fitGame(screen);
      else if (!["events", "menu", "dating", "people", "ranking"].includes(screen.dataset.screen)) fitFallback(screen);
    });
  }

  function schedule() {
    timers.forEach(clearTimeout);
    timers = [];
    fitNow();
    timers.push(setTimeout(fitNow, 60), setTimeout(fitNow, 180), setTimeout(fitNow, 420));
  }

  const observer = new MutationObserver(mutations => {
    if (mutations.some(mutation => mutation.type === "childList" || mutation.attributeName === "class")) schedule();
  });

  function start() {
    ensureStyles();
    observer.observe(document.documentElement, {
      subtree:true,
      childList:true,
      attributes:true,
      attributeFilter:["class"]
    });
    schedule();
  }

  window.addEventListener("resize", schedule, { passive:true });
  window.addEventListener("orientationchange", schedule, { passive:true });
  window.visualViewport?.addEventListener("resize", schedule, { passive:true });
  [
    "bali:full-demo-ready",
    "bali:full-demo-enhancements-ready",
    "bali:data-changed",
    "bali:beta4-changed",
    "bali:social-changed",
    "bali:clans-changed",
    "bali:points-changed",
    "bali:telegram-viewport-changed"
  ].forEach(name => window.addEventListener(name, schedule));

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once:true });
  else start();

  window.BaliAllPagesOneScreen = { fit:schedule };
})();
