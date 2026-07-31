(() => {
  "use strict";

  if (window.__BALI_REMOVE_LARGE_HEADING__) return;
  window.__BALI_REMOVE_LARGE_HEADING__ = true;

  let frame = 0;

  function removeLargeBaliHeading() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      document
        .querySelectorAll('[data-screen="home"] .bali-home-reference-hero h1')
        .forEach(node => node.remove());
    });
  }

  const observer = new MutationObserver(removeLargeBaliHeading);

  function start() {
    observer.observe(document.body, { subtree:true, childList:true });
    removeLargeBaliHeading();
    setTimeout(removeLargeBaliHeading, 100);
    setTimeout(removeLargeBaliHeading, 400);
  }

  [
    "bali:full-demo-enhancements-ready",
    "bali:home-design-changed",
    "bali:data-changed",
    "bali:beta4-changed",
    "bali:telegram-viewport-changed"
  ].forEach(name => window.addEventListener(name, removeLargeBaliHeading));

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once:true });
  } else {
    start();
  }
})();
