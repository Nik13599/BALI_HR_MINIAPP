(() => {
  if (window.__BALI_BOTTOM_NAV_SAFE__) return;
  window.__BALI_BOTTOM_NAV_SAFE__ = true;

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

  function normalizeButton(button, page) {
    const meta = META[page];
    if (!meta) return;

    const icons = [...button.querySelectorAll(":scope > i")];
    const labels = [...button.querySelectorAll(":scope > span")];

    icons.slice(1).forEach(node => node.remove());
    labels.slice(1).forEach(node => node.remove());

    let icon = icons[0];
    if (!icon) {
      icon = document.createElement("i");
      button.prepend(icon);
    }
    if (!icon.textContent?.trim()) icon.textContent = meta[0];

    let label = labels[0];
    if (!label) {
      label = document.createElement("span");
      button.append(label);
    }
    if (!label.textContent?.trim()) label.textContent = meta[1];

    button.type = "button";
    button.style.pointerEvents = "auto";
    button.removeAttribute("disabled");
  }

  function clean() {
    if (cleaning) return;
    cleaning = true;
    try {
      const shell = document.querySelector(".shell");
      const navs = shell
        ? [...shell.querySelectorAll(":scope > .nav")]
        : [...document.querySelectorAll("nav.nav")];
      if (!navs.length) return;

      const nav = navs[0];
      navs.slice(1).forEach(extra => extra.remove());
      nav.style.pointerEvents = "auto";
      nav.style.zIndex = "50";

      nav.querySelectorAll(':scope > button[data-page="ranking"]').forEach(button => button.remove());

      const keep = new Map();
      [...nav.querySelectorAll(":scope > button[data-page]")].forEach(button => {
        const page = String(button.dataset.page || "");
        if (!page) return;
        const existing = keep.get(page);
        if (!existing) {
          keep.set(page, button);
          return;
        }
        if (button.classList.contains("active") && !existing.classList.contains("active")) {
          existing.remove();
          keep.set(page, button);
        } else {
          button.remove();
        }
      });

      ORDER.forEach(page => {
        const button = keep.get(page);
        if (!button) return;
        normalizeButton(button, page);
        nav.appendChild(button);
      });

      nav.style.setProperty(
        "grid-template-columns",
        `repeat(${Math.max(1, nav.querySelectorAll(":scope > button[data-page]").length)}, minmax(0, 1fr))`,
        "important"
      );
    } finally {
      cleaning = false;
    }
  }

  function activate(page) {
    const screen = document.querySelector(`.page[data-screen="${CSS.escape(page)}"]`);
    if (!screen) return;
    document.querySelectorAll(".page[data-screen]").forEach(node => {
      node.classList.toggle("active", node === screen);
    });
    document.querySelectorAll(".nav button[data-page]").forEach(button => {
      button.classList.toggle("active", button.dataset.page === page);
    });
    try { screen.scrollTo(0, 0); } catch {}
    window.dispatchEvent(new CustomEvent("bali:page-opened", { detail: { page } }));
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      clean();
    });
  }

  document.addEventListener("click", event => {
    const button = event.target.closest(".nav button[data-page]");
    if (!button) return;
    const page = String(button.dataset.page || "");
    if (!page) return;
    setTimeout(() => {
      const screen = document.querySelector(`.page[data-screen="${CSS.escape(page)}"]`);
      if (screen && !screen.classList.contains("active")) activate(page);
    }, 0);
  });

  new MutationObserver(records => {
    if (!cleaning && records.some(record => record.addedNodes.length || record.removedNodes.length)) schedule();
  }).observe(document.body, { childList: true, subtree: true });

  [0, 100, 300, 700, 1400].forEach(delay => setTimeout(clean, delay));
})();