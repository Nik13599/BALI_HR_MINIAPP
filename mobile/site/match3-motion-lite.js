(() => {
  "use strict";
  if (window.__BALI_MATCH3_MOTION_LITE__) return;
  window.__BALI_MATCH3_MOTION_LITE__ = true;

  function pulse(node, className, timeout = 360) {
    if (!node) return;
    node.classList.remove(className);
    void node.offsetWidth;
    node.classList.add(className);
    setTimeout(() => node.classList.remove(className), timeout);
  }

  function attach() {
    const score = document.getElementById("match3Score");
    const board = document.getElementById("match3Board");
    if (!score || !board) return false;
    let previous = score.textContent;
    const observer = new MutationObserver(() => {
      const current = score.textContent;
      if (current === previous) return;
      const before = Number(String(previous || "0").replace(/\s/g, ""));
      const after = Number(String(current || "0").replace(/\s/g, ""));
      previous = current;
      if (Number.isFinite(after) && after > before) {
        pulse(score, "match3-score-pop", 360);
        pulse(board, "match3-board-settle", 420);
      }
    });
    observer.observe(score, { childList:true, characterData:true, subtree:true });
    return true;
  }

  function waitForGame(attempt = 0) {
    if (attach()) return;
    if (attempt < 80) setTimeout(() => waitForGame(attempt + 1), 125);
  }

  window.addEventListener("bali:production-ready", () => waitForGame());
  if (document.readyState !== "loading") waitForGame();
})();
