(() => {
  if (window.__BALI_PROFILE_CONTROLS_FINAL__) return;
  window.__BALI_PROFILE_CONTROLS_FINAL__ = true;

  function apply() {
    const stats = document.getElementById("profileStats");
    if (stats) {
      stats.innerHTML = "";
      stats.hidden = true;
      stats.classList.add("profile-v2-hidden");
    }
    document.querySelector(".profile-visit-history")?.remove();
    document.querySelectorAll("#profileHero .profile-rank-button").forEach(node => node.remove());
    const hero = document.getElementById("profileHero");
    if (!hero) return false;
    let controls = hero.querySelector(".profile-v2-controls");
    if (!controls) {
      controls = document.createElement("div");
      controls.className = "profile-v2-controls";
      hero.appendChild(controls);
    }
    [...controls.children].forEach(node => {
      if (!node.matches("[data-open-profile-settings],[data-open-profile-history]")) node.remove();
    });
    if (!controls.querySelector("[data-open-profile-settings]")) controls.insertAdjacentHTML("afterbegin", '<button type="button" data-open-profile-settings title="Настройки профиля" aria-label="Настройки профиля">⚙</button>');
    if (!controls.querySelector("[data-open-profile-history]")) controls.insertAdjacentHTML("beforeend", '<button type="button" data-open-profile-history title="История посещений" aria-label="История посещений">◷</button>');
    return true;
  }

  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; apply(); });
  };
  new MutationObserver(records => {
    if (records.some(record => record.addedNodes.length || record.removedNodes.length)) schedule();
  }).observe(document.body, { childList:true, subtree:true });
  ["bali:beta4-changed","bali:points-changed","bali:social-changed","bali:data-changed"].forEach(name => window.addEventListener(name, schedule));
  schedule();
  window.BaliProfileControlsFinal = { apply };
})();