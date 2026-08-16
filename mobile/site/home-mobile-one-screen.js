(() => {
  "use strict";

  if (window.__BALI_HOME_ONE_SCREEN__) return;
  window.__BALI_HOME_ONE_SCREEN__ = true;

  let frame = 0;
  let observer;
  let delayed = [];

  function reset(root, screen) {
    if (root) {
      root.style.removeProperty("transform");
      root.style.removeProperty("transform-origin");
      delete root.dataset.oneScreenScale;
    }
    if (screen) {
      screen.style.removeProperty("overflow");
      screen.style.removeProperty("overscroll-behavior");
    }
  }

  function fit() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const screen = document.querySelector('[data-screen="home"]');
      const root = screen?.querySelector(".bali-home-reference");
      if (!screen || !root) return;

      const mobile = window.matchMedia("(max-width: 760px)").matches;
      const visible = screen.offsetParent !== null && getComputedStyle(screen).display !== "none";
      if (!mobile || !visible) {
        reset(root, screen);
        return;
      }

      root.style.removeProperty("transform");
      root.style.transformOrigin = "top center";
      screen.scrollTop = 0;
      screen.style.overflow = "hidden";
      screen.style.overscrollBehavior = "none";

      const style = getComputedStyle(screen);
      const verticalPadding = parseFloat(style.paddingTop || "0") + parseFloat(style.paddingBottom || "0");
      const available = Math.max(1, screen.clientHeight - verticalPadding - 2);
      const natural = Math.max(1, root.scrollHeight);
      const scale = Math.min(1, available / natural);
      const applied = Math.max(0.4, scale);
      root.style.transform = `scale(${applied.toFixed(4)})`;
      root.dataset.oneScreenScale = applied.toFixed(4);
    });
  }

  function schedule() {
    delayed.forEach(clearTimeout);
    delayed = [];
    fit();
    delayed.push(setTimeout(fit, 80), setTimeout(fit, 260));
  }

  observer = new MutationObserver(mutations => {
    if (mutations.some(mutation => mutation.type === "childList" || mutation.attributeName === "class")) schedule();
  });

  const start = () => {
    observer.observe(document.documentElement, {
      subtree:true,
      childList:true,
      attributes:true,
      attributeFilter:["class"]
    });
    schedule();
  };

  window.addEventListener("resize", schedule, { passive:true });
  window.addEventListener("orientationchange", schedule, { passive:true });
  window.visualViewport?.addEventListener("resize", schedule, { passive:true });
  [
    "bali:full-demo-enhancements-ready",
    "bali:home-design-changed",
    "bali:data-changed",
    "bali:beta4-changed",
    "bali:telegram-viewport-changed"
  ].forEach(name => window.addEventListener(name, schedule));

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once:true });
  else start();

  window.BaliHomeOneScreen = { fit:schedule };
})();
