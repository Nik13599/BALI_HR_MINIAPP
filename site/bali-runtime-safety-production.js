(() => {
  if (window.__BALI_RUNTIME_SAFETY_PRODUCTION__) return;
  window.__BALI_RUNTIME_SAFETY_PRODUCTION__ = true;

  const requiredIds = {
    rankingPodium: ["div", "podium"],
    rankingList: ["div", "rank-list"],
    homeEvents: ["div", "home-events"],
    eventsCount: ["span", "count"],
    eventsGrid: ["div", "events"],
    menuTabs: ["div", "tabs"],
    menuCount: ["span", "count"],
    menuList: ["div", "menu-list"],
    profileHero: ["section", "profile-hero"],
    xpCard: ["section", "card xp"],
    profileStats: ["div", "stats"],
    pointsBalance: ["strong", ""],
    pointsLedger: ["div", "ledger"],
    achievementCount: ["span", "count"],
    achievements: ["div", "achievements"],
    activeVip: ["div", ""],
    vipPlans: ["div", "vip-plans"]
  };

  function screen(name) {
    return document.querySelector(`[data-screen="${name}"] .inner`);
  }

  function fallbackParent(id) {
    if (id.startsWith("ranking")) return screen("ranking");
    if (["homeEvents"].includes(id)) return screen("home");
    if (id.startsWith("events")) return screen("events");
    if (id.startsWith("menu")) return screen("menu");
    return screen("profile");
  }

  function ensureRequiredNodes() {
    for (const [id, [tag, className]] of Object.entries(requiredIds)) {
      if (document.getElementById(id)) continue;
      const parent = fallbackParent(id);
      if (!parent) continue;
      const node = document.createElement(tag);
      node.id = id;
      if (className) node.className = className;
      node.hidden = id.startsWith("ranking");
      parent.appendChild(node);
    }
  }

  function isTechnicalErrorText(text) {
    const value = String(text || "").toLowerCase();
    return value.includes("null is not an object") ||
      value.includes("undefined is not an object") ||
      value.includes("document.getelementbyid") ||
      value.includes("unhandled promise rejection") ||
      value.includes("cannot set properties of null");
  }

  function removeTechnicalOverlays() {
    document.querySelectorAll("body *").forEach(node => {
      if (!(node instanceof HTMLElement)) return;
      if (node.children.length > 8) return;
      const text = node.textContent || "";
      if (!isTechnicalErrorText(text)) return;
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      if (style.position === "fixed" || style.position === "absolute" || rect.width > innerWidth * .65) node.remove();
    });
  }

  function notifyRecovery() {
    const toast = document.getElementById("toast");
    if (!toast || toast.dataset.runtimeRecoveryShown === "1") return;
    toast.dataset.runtimeRecoveryShown = "1";
    toast.textContent = "Интерфейс восстановлен";
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 1800);
  }

  function recover(error) {
    console.error("[BALI runtime recovered]", error);
    ensureRequiredNodes();
    removeTechnicalOverlays();
    window.BaliDomStability?.apply?.();
    window.BaliUiRegistry?.apply?.();
    window.BaliCompactProfile?.mount?.();
    notifyRecovery();
  }

  window.addEventListener("error", event => {
    recover(event.error || event.message);
    event.preventDefault?.();
  }, true);

  window.addEventListener("unhandledrejection", event => {
    recover(event.reason);
    event.preventDefault?.();
  }, true);

  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      ensureRequiredNodes();
      removeTechnicalOverlays();
    });
  };

  new MutationObserver(schedule).observe(document.documentElement, { childList:true, subtree:true });
  [0, 20, 80, 250, 800, 2000].forEach(delay => setTimeout(schedule, delay));
  window.BaliRuntimeSafety = { recover, ensureRequiredNodes, removeTechnicalOverlays };
})();