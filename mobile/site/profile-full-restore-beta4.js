(() => {
  if (window.__BALI_FULL_PROFILE_RESTORE__) return;
  window.__BALI_FULL_PROFILE_RESTORE__ = true;

  const SELECTORS = [
    ".wallet",
    "#achievements",
    "#activeVip",
    "#profileForm",
    "#pointsShopCard",
    "#customRewardsCard",
    "#socialProfileCard"
  ];

  function cardFor(selector) {
    const node = document.querySelector(selector);
    if (!node) return null;
    if (node.matches(".wallet, #pointsShopCard, #customRewardsCard, #socialProfileCard")) return node;
    return node.closest(".card") || node;
  }

  function compact() {
    const profile = document.querySelector('[data-screen="profile"]');
    if (!profile) return false;
    SELECTORS.forEach(selector => {
      const card = cardFor(selector);
      if (!card) return;
      card.classList.add("profile-v2-hidden");
      card.hidden = true;
      card.dataset.profileCollapsed = "true";
    });
    const quick = document.getElementById("profileV2Quick");
    if (quick) {
      quick.hidden = false;
      quick.classList.remove("profile-v2-hidden");
      quick.dataset.compactProfileMenu = "true";
    }
    return true;
  }

  document.addEventListener("click", event => {
    if (event.target.closest('[data-page="profile"]')) [0, 80, 220].forEach(delay => setTimeout(compact, delay));
  }, true);

  ["bali:points-changed", "bali:beta4-changed", "bali:loyalty-changed", "bali:social-changed", "bali:data-changed", "bali:chip-requests-changed"]
    .forEach(name => window.addEventListener(name, () => requestAnimationFrame(compact)));

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    compact();
    if ((document.getElementById("profileV2Quick") && document.getElementById("profileForm")) || attempts > 60) clearInterval(timer);
  }, 100);

  window.BaliFullProfile = { compact };
})();