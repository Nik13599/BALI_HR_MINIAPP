(() => {
  if (window.__BALI_FULL_DEMO_NAV_UNLOCK__) return;
  window.__BALI_FULL_DEMO_NAV_UNLOCK__ = true;

  function screen(page) {
    return document.querySelector(`[data-screen="${String(page || "home").replace(/[^a-z0-9_-]/gi, "")}"]`);
  }
  function sync() {
    document.querySelectorAll(".nav [data-page]").forEach(button => {
      const available = Boolean(screen(button.dataset.page));
      if (available) {
        button.disabled = false;
        button.classList.remove("navigation-loading");
        button.setAttribute("aria-busy", "false");
        button.removeAttribute("title");
      }
    });
    const nav = document.querySelector(".shell > nav.nav");
    if (nav) nav.dataset.navigationReady = "true";
  }
  function go(page) {
    const target = screen(page);
    if (!target) return false;
    document.querySelectorAll(".page[data-screen]").forEach(node => node.classList.toggle("active", node === target));
    document.querySelectorAll(".nav [data-page]").forEach(button => button.classList.toggle("active", button.dataset.page === page));
    target.scrollTop = 0;
    return true;
  }

  document.addEventListener("click", event => {
    const button = event.target.closest(".nav [data-page]");
    if (!button) return;
    sync();
    if (go(button.dataset.page)) event.preventDefault();
  }, true);

  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; sync(); });
  };
  const app = document.getElementById("app");
  if (app) new MutationObserver(schedule).observe(app,{childList:true});
  ["bali:full-demo-ready","bali:full-demo-enhancements-ready","bali:social-changed","bali:match3-changed"].forEach(name => window.addEventListener(name,schedule));
  schedule();
  window.BaliFullDemoNavigation = { sync, go };
})();
