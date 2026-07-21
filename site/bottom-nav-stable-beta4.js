(() => {
  if (window.__BALI_BOTTOM_NAV_STABLE__) return;
  window.__BALI_BOTTOM_NAV_STABLE__ = true;

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

  function isCanonical(button, meta) {
    const children = button.children;
    return children.length === 2 &&
      children[0].tagName === "I" &&
      children[0].textContent === meta[0] &&
      children[1].tagName === "SPAN" &&
      children[1].textContent === meta[1];
  }

  function cleanButton(button, page) {
    const meta = META[page];
    if (!meta || isCanonical(button, meta)) return false;

    const icon = document.createElement("i");
    icon.textContent = meta[0];
    const label = document.createElement("span");
    label.textContent = meta[1];
    button.replaceChildren(icon, label);
    return true;
  }

  function cleanPages() {
    const root = document.querySelector(".pages");
    if (!root) return false;

    let changed = false;
    const seen = new Set();
    [...root.querySelectorAll(":scope > [data-screen]")].forEach(page => {
      const key = String(page.dataset.screen || "");
      if (!key) return;
      if (seen.has(key)) {
        page.remove();
        changed = true;
      } else {
        seen.add(key);
      }
    });
    return changed;
  }

  function sameOrder(current, desired) {
    return current.length === desired.length && current.every((item, index) => item === desired[index]);
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

      const current = [...nav.querySelectorAll(":scope > button[data-page]")];
      const desired = [
        ...ORDER.map(page => nav.querySelector(`:scope > button[data-page="${page}"]`)).filter(Boolean),
        ...current.filter(button => !ORDER.includes(String(button.dataset.page || "")))
      ];

      if (!sameOrder(current, desired)) desired.forEach(button => nav.appendChild(button));

      const columns = `repeat(${Math.max(1, desired.length)}, minmax(0, 1fr))`;
      if (nav.style.getPropertyValue("grid-template-columns") !== columns) {
        nav.style.setProperty("grid-template-columns", columns, "important");
      }

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
