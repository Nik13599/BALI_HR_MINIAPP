(() => {
  "use strict";

  if (window.__BALI_REMOVE_PEOPLE_CLANS_BUTTON__) return;
  window.__BALI_REMOVE_PEOPLE_CLANS_BUTTON__ = true;

  const normalized = value => String(value || "").replace(/\s+/g, " ").trim().toLowerCase();

  function removeButton() {
    document.querySelectorAll(".bali-home-people-link").forEach(node => node.remove());
    document.querySelectorAll('[data-screen="home"] button').forEach(button => {
      const text = normalized(button.textContent);
      if (text.includes("посмотреть людей и кланы") || text.includes("посмотреть, людей и кланы")) {
        button.remove();
      }
    });
  }

  let frame = 0;
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(removeButton);
  };

  const observer = new MutationObserver(schedule);
  const start = () => {
    observer.observe(document.documentElement, { subtree:true, childList:true });
    removeButton();
    setTimeout(removeButton, 100);
    setTimeout(removeButton, 500);
    setTimeout(removeButton, 1500);
  };

  ["bali:data-changed", "bali:beta4-changed", "bali:home-design-changed", "bali:full-demo-enhancements-ready"]
    .forEach(name => window.addEventListener(name, schedule));

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once:true });
  else start();
})();
