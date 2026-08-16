(() => {
  const params = new URLSearchParams(location.search);
  const buildBadge = document.getElementById("baliPreviewBuild");
  if (buildBadge) buildBadge.textContent = "BETA 25 · INTEGRATED";

  const userTarget = String(params.get("show") || "").toLowerCase();
  const clanCategory = String(params.get("clanCategory") || "user").toLowerCase();
  const adminTarget = String(params.get("view") || "").toLowerCase();
  let userOpened = !userTarget;
  let adminOpened = !adminTarget;
  let attempts = 0;

  function click(selector) {
    const node = document.querySelector(selector);
    if (!node) return false;
    node.click();
    return true;
  }

  function openUserTarget() {
    if (userOpened) return true;
    if (userTarget === "clans" || userTarget === "my-clans" || userTarget === "people") {
      const page = document.querySelector('.nav [data-page="dating"]');
      if (!page) return false;
      if (!page.classList.contains("active")) page.click();
      if (userTarget === "people") {
        userOpened = click('[data-people-mode="people"]');
        return userOpened;
      }
      const mode = userTarget === "my-clans" ? "clan" : "ranking";
      if (!click(`[data-people-mode="${mode}"]`)) return false;
      if (mode === "ranking" && clanCategory === "corporate") {
        if (!click('[data-clan-ranking-category="corporate"]')) return false;
      }
      userOpened = true;
      return true;
    }
    if (userTarget === "game" || userTarget === "game-ranking") {
      const page = document.querySelector('.nav [data-page="crown"]');
      if (!page) return false;
      if (!page.classList.contains("active")) page.click();
      if (userTarget === "game-ranking" && !click('[data-match3-tab="ranking"]')) return false;
      userOpened = true;
      return true;
    }
    const pageTargets = new Set(["home", "events", "menu", "profile"]);
    if (pageTargets.has(userTarget)) userOpened = click(`.nav [data-page="${userTarget}"]`);
    else userOpened = true;
    return userOpened;
  }

  function openAdminTarget() {
    if (adminOpened) return true;
    const allowed = new Set([
      "dashboard", "events", "crown", "bookings", "customers",
      "clans", "bonuses", "menu", "hall", "reviews", "settings"
    ]);
    if (!allowed.has(adminTarget)) {
      adminOpened = true;
      return true;
    }
    if (typeof window.setView !== "function" || document.getElementById("appView")?.classList.contains("hidden")) {
      return false;
    }
    window.setView(adminTarget);
    adminOpened = true;
    return true;
  }

  const timer = setInterval(() => {
    attempts += 1;
    openUserTarget();
    openAdminTarget();
    if ((userOpened && adminOpened) || attempts > 200) clearInterval(timer);
  }, 50);

  window.addEventListener("bali:full-demo-ready", () => {
    openUserTarget();
    openAdminTarget();
  });
})();
