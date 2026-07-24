(() => {
  if (window.__BALI_DOM_STABILITY_PRODUCTION__) return;
  window.__BALI_DOM_STABILITY_PRODUCTION__ = true;

  let scheduled = false;
  let applying = false;

  function ensureRankingRoots() {
    const pages = document.querySelector(".pages");
    if (!pages) return false;

    const rankingScreens = [...document.querySelectorAll('[data-screen="ranking"]')];
    let screen = rankingScreens.shift() || null;
    rankingScreens.forEach(node => node.remove());

    if (!screen) {
      screen = document.createElement("section");
      screen.className = "page";
      screen.dataset.screen = "ranking";
      screen.setAttribute("aria-hidden", "true");
      screen.innerHTML = '<div class="inner"><div class="head"><div><span class="eyebrow">КЛУБНАЯ АКТИВНОСТЬ</span><h2>Рейтинг</h2></div></div><div class="podium" id="rankingPodium"></div><div class="rank-list" id="rankingList"></div></div>';
      pages.appendChild(screen);
    }

    let inner = screen.querySelector(":scope > .inner");
    if (!inner) {
      inner = document.createElement("div");
      inner.className = "inner";
      screen.appendChild(inner);
    }

    if (!document.getElementById("rankingPodium")) {
      const podium = document.createElement("div");
      podium.className = "podium";
      podium.id = "rankingPodium";
      inner.appendChild(podium);
    }
    if (!document.getElementById("rankingList")) {
      const list = document.createElement("div");
      list.className = "rank-list";
      list.id = "rankingList";
      inner.appendChild(list);
    }
    return true;
  }

  function apply() {
    if (applying) return;
    applying = true;
    try { ensureRankingRoots(); }
    finally { applying = false; }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      apply();
    });
  }

  new MutationObserver(records => {
    if (records.some(record => record.addedNodes.length || record.removedNodes.length)) schedule();
  }).observe(document.documentElement, { childList: true, subtree: true });

  [0, 20, 60, 150, 400, 1000, 2500].forEach(delay => setTimeout(apply, delay));
  window.BaliDomStability = { apply, ensureRankingRoots };
})();