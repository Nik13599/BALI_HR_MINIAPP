(() => {
  if (window.__BALI_BOTTOM_NAV_DEDUPE__) return;
  window.__BALI_BOTTOM_NAV_DEDUPE__ = true;

  const META = {
    home: ["⌂", "Главная"],
    events: ["◫", "Афиши"],
    menu: ["◇", "Меню"],
    dating: ["🌴", "BALI PEOPLE"],
    crown: ["👑", "Конкурс"],
    profile: ["◎", "Профиль"]
  };
  const ORDER = ["home", "events", "menu", "dating", "crown", "profile"];
  let scheduled = false;
  let cleaning = false;

  function cleanButton(button, page) {
    const meta = META[page];
    if (!meta) return;
    const icon = document.createElement("i");
    icon.textContent = meta[0];
    const label = document.createElement("span");
    label.textContent = meta[1];
    button.replaceChildren(icon, label);
  }

  function cleanPages() {
    const root = document.querySelector(".pages");
    if (!root) return;
    const seen = new Set();
    [...root.querySelectorAll(":scope > [data-screen]")].forEach(page => {
      const key = String(page.dataset.screen || "");
      if (!key) return;
      if (seen.has(key)) page.remove();
      else seen.add(key);
    });
  }

  function clean() {
    if (cleaning) return;
    cleaning = true;
    try {
      const navs = [...document.querySelectorAll("nav.nav, .shell > .nav")];
      if (!navs.length) return;
      const nav = navs[0];
      navs.slice(1).forEach(extra => extra.remove());

      nav.querySelectorAll(':scope > button[data-page="ranking"]').forEach(button => button.remove());
      const seen = new Set();
      [...nav.querySelectorAll(":scope > button[data-page]")].forEach(button => {
        const page = String(button.dataset.page || "");
        if (!page) return;
        if (seen.has(page)) {
          button.remove();
          return;
        }
        seen.add(page);
        cleanButton(button, page);
      });

      ORDER.forEach(page => {
        const button = nav.querySelector(`:scope > button[data-page="${page}"]`);
        if (button) nav.appendChild(button);
      });
      nav.style.setProperty("grid-template-columns", `repeat(${Math.max(1, nav.children.length)}, minmax(0, 1fr))`, "important");
      cleanPages();
    } finally {
      cleaning = false;
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      clean();
    });
  }

  new MutationObserver(records => {
    if (!cleaning && records.some(record => record.addedNodes.length || record.removedNodes.length)) schedule();
  }).observe(document.body, { childList: true, subtree: true });

  [0, 150, 400, 900].forEach(delay => setTimeout(clean, delay));
})();