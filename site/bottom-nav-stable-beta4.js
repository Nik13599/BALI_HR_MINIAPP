(() => {
  if (window.__BALI_BOTTOM_NAV_STABLE_WORKING__) return;
  window.__BALI_BOTTOM_NAV_STABLE_WORKING__ = true;

  const ORDER = ["home", "events", "menu", "dating", "crown", "profile"];
  let busy = false;

  function activate(page) {
    const screen = document.querySelector(`.page[data-screen="${page}"]`);
    if (!screen) return false;
    document.querySelectorAll(".page[data-screen]").forEach(node => {
      node.classList.toggle("active", node === screen);
    });
    document.querySelectorAll(".nav button[data-page]").forEach(button => {
      button.classList.toggle("active", button.dataset.page === page);
    });
    try { screen.scrollTo(0, 0); } catch {}
    return true;
  }

  function clean() {
    if (busy) return;
    busy = true;
    try {
      const nav = document.querySelector(".shell > .nav, nav.nav");
      if (!nav) return;

      nav.style.pointerEvents = "auto";
      nav.style.zIndex = "60";
      nav.querySelectorAll(':scope > button[data-page="ranking"]').forEach(button => button.remove());

      const seen = new Map();
      [...nav.querySelectorAll(":scope > button[data-page]")].forEach(button => {
        const page = String(button.dataset.page || "");
        if (!page) return;
        if (!seen.has(page)) {
          seen.set(page, button);
          button.type = "button";
          button.style.pointerEvents = "auto";
          button.removeAttribute("disabled");
          const icons = [...button.querySelectorAll(":scope > i")];
          const labels = [...button.querySelectorAll(":scope > span")];
          icons.slice(1).forEach(node => node.remove());
          labels.slice(1).forEach(node => node.remove());
        } else {
          button.remove();
        }
      });

      ORDER.forEach(page => {
        const button = seen.get(page);
        if (button) nav.appendChild(button);
      });
      nav.style.setProperty("grid-template-columns", `repeat(${Math.max(1, nav.children.length)}, minmax(0, 1fr))`, "important");
    } finally {
      busy = false;
    }
  }

  document.addEventListener("click", event => {
    const button = event.target.closest(".nav button[data-page]");
    if (!button) return;
    const page = String(button.dataset.page || "");
    setTimeout(() => {
      const screen = document.querySelector(`.page[data-screen="${page}"]`);
      if (screen && !screen.classList.contains("active")) activate(page);
    }, 0);
  });

  new MutationObserver(records => {
    if (!busy && records.some(record => record.addedNodes.length || record.removedNodes.length)) {
      requestAnimationFrame(clean);
    }
  }).observe(document.body, { childList: true, subtree: true });

  [0, 100, 300, 700].forEach(delay => setTimeout(clean, delay));
})();