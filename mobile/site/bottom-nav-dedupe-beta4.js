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
    if (!meta) return false;
    let changed = false;
    const icons = [...button.querySelectorAll(":scope > i")];
    const labels = [...button.querySelectorAll(":scope > span")];

    icons.slice(1).forEach(node => { node.remove(); changed = true; });
    labels.slice(1).forEach(node => { node.remove(); changed = true; });

    let icon = icons[0];
    if (!icon) {
      icon = document.createElement("i");
      icon.textContent = meta[0];
      button.prepend(icon);
      changed = true;
    } else if (!icon.textContent?.trim()) {
      icon.textContent = meta[0];
      changed = true;
    }

    let label = labels[0];
    if (!label) {
      label = document.createElement("span");
      label.textContent = meta[1];
      button.append(label);
      changed = true;
    } else if (!label.textContent?.trim()) {
      label.textContent = meta[1];
      changed = true;
    }

    if (button.type !== "button") { button.type = "button"; changed = true; }
    if (button.style.pointerEvents !== "auto") { button.style.pointerEvents = "auto"; changed = true; }
    if (button.disabled) { button.disabled = false; changed = true; }
    return changed;
  }

  function sameOrder(current, desired) {
    return current.length === desired.length && current.every((button, index) => button === desired[index]);
  }

  function clean() {
    if (cleaning) return;
    cleaning = true;
    try {
      const shell = document.querySelector(".shell");
      const navs = shell ? [...shell.querySelectorAll(":scope > .nav")] : [...document.querySelectorAll("nav.nav")];
      if (!navs.length) return;

      const nav = navs[0];
      navs.slice(1).forEach(extra => extra.remove());
      if (nav.style.pointerEvents !== "auto") nav.style.pointerEvents = "auto";
      if (nav.style.zIndex !== "50") nav.style.zIndex = "50";
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

      const current = [...nav.querySelectorAll(":scope > button[data-page]")];
      const desired = [
        ...ORDER.map(page => keep.get(page)).filter(Boolean),
        ...current.filter(button => !ORDER.includes(String(button.dataset.page || "")))
      ];
      desired.forEach(button => normalizeButton(button, String(button.dataset.page || "")));
      if (!sameOrder(current, desired)) desired.forEach(button => nav.appendChild(button));

      const columns = `repeat(${Math.max(1, desired.length)}, minmax(0, 1fr))`;
      if (nav.style.getPropertyValue("grid-template-columns") !== columns) {
        nav.style.setProperty("grid-template-columns", columns, "important");
      }
    } finally {
      cleaning = false;
    }
  }

  function activate(page) {
    const screen = document.querySelector(`.page[data-screen="${CSS.escape(page)}"]`);
    if (!screen) return;
    document.querySelectorAll(".page[data-screen]").forEach(node => node.classList.toggle("active", node === screen));
    document.querySelectorAll(".nav button[data-page]").forEach(button => button.classList.toggle("active", button.dataset.page === page));
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
