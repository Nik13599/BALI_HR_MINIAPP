(() => {
  if (window.__BALI_BOTTOM_NAV_CONTROLLER__) return;
  window.__BALI_BOTTOM_NAV_CONTROLLER__ = true;

  const PAGES = new Set(["home", "events", "menu", "dating", "crown", "profile", "ranking"]);
  const bound = new WeakSet();
  let observerScheduled = false;
  let lastPointerActivation = { page: "", at: 0 };

  function screenFor(page) {
    return [...document.querySelectorAll(".page[data-screen]")]
      .find(node => String(node.dataset.screen || "") === String(page || "")) || null;
  }

  function activate(page) {
    page = String(page || "");
    if (!PAGES.has(page)) return false;

    const screen = screenFor(page);
    if (!screen) return false;

    document.querySelectorAll(".page[data-screen]").forEach(node => {
      const active = node === screen;
      node.classList.toggle("active", active);
      node.setAttribute("aria-hidden", active ? "false" : "true");
    });

    document.querySelectorAll(".nav button[data-page]").forEach(button => {
      const active = String(button.dataset.page || "") === page;
      button.classList.toggle("active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });

    try { screen.scrollTo({ top: 0, left: 0, behavior: "auto" }); }
    catch { try { screen.scrollTop = 0; } catch {} }

    window.dispatchEvent(new CustomEvent("bali:page-opened", { detail: { page } }));
    return true;
  }

  function buttonFromEvent(event, nav) {
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest("button[data-page]");
    return button && nav.contains(button) ? button : null;
  }

  function handlePointer(event, nav) {
    const button = buttonFromEvent(event, nav);
    if (!button) return;
    const page = String(button.dataset.page || "");
    if (!screenFor(page)) return;

    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();

    lastPointerActivation = { page, at: Date.now() };
    activate(page);
  }

  function handleClick(event, nav) {
    const button = buttonFromEvent(event, nav);
    if (!button) return;
    const page = String(button.dataset.page || "");
    if (!screenFor(page)) return;

    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();

    if (lastPointerActivation.page === page && Date.now() - lastPointerActivation.at < 650) return;
    activate(page);
  }

  function prepare(nav) {
    nav.style.pointerEvents = "auto";
    nav.style.position = "relative";
    nav.style.zIndex = "2147482000";
    nav.style.isolation = "isolate";

    nav.querySelectorAll("button[data-page]").forEach(button => {
      button.type = "button";
      button.disabled = false;
      button.style.pointerEvents = "auto";
      button.style.touchAction = "manipulation";
      button.style.webkitTapHighlightColor = "transparent";
    });

    if (bound.has(nav)) return;
    bound.add(nav);

    nav.addEventListener("pointerup", event => handlePointer(event, nav), true);
    nav.addEventListener("touchend", event => handlePointer(event, nav), { capture: true, passive: false });
    nav.addEventListener("click", event => handleClick(event, nav), true);
  }

  function mount() {
    document.querySelectorAll("nav.nav").forEach(prepare);
  }

  function scheduleMount() {
    if (observerScheduled) return;
    observerScheduled = true;
    requestAnimationFrame(() => {
      observerScheduled = false;
      mount();
    });
  }

  const style = document.createElement("style");
  style.id = "baliBottomNavControllerStyle";
  style.textContent = `.nav{position:relative!important;z-index:2147482000!important;pointer-events:auto!important;isolation:isolate}.nav button[data-page]{pointer-events:auto!important;touch-action:manipulation!important;-webkit-user-select:none;user-select:none}`;
  document.head.appendChild(style);

  new MutationObserver(records => {
    if (records.some(record => record.addedNodes.length || record.removedNodes.length)) scheduleMount();
  }).observe(document.body, { childList: true, subtree: true });

  [0, 80, 220, 500, 1000, 1800].forEach(delay => setTimeout(mount, delay));
  window.BaliBottomNavigation = { activate, mount };
})();