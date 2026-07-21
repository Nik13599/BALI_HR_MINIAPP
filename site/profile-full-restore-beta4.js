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

  function reveal() {
    const profile = document.querySelector('[data-screen="profile"]');
    if (!profile) return false;

    SELECTORS.forEach(selector => {
      const card = cardFor(selector);
      if (!card) return;
      card.classList.remove("profile-v2-hidden");
      card.hidden = false;
      card.style.removeProperty("display");
      card.style.removeProperty("visibility");
    });

    const wallet = document.querySelector(".wallet");
    const shop = document.getElementById("pointsShopCard");
    const achievements = document.getElementById("achievements")?.closest(".card");
    const customRewards = document.getElementById("customRewardsCard");
    const vip = document.getElementById("activeVip")?.closest(".card");
    const settings = document.getElementById("profileForm")?.closest(".card");

    if (wallet && shop && shop.previousElementSibling !== wallet) wallet.insertAdjacentElement("afterend", shop);
    if (achievements && customRewards && customRewards.previousElementSibling !== achievements) achievements.insertAdjacentElement("afterend", customRewards);

    [wallet, shop, achievements, customRewards, vip, settings].filter(Boolean).forEach(card => {
      card.dataset.fullProfileVisible = "true";
    });

    const quick = document.getElementById("profileV2Quick");
    if (quick) quick.dataset.fullProfileShortcuts = "true";
    return true;
  }

  function ensureLabels() {
    const shopTitle = document.querySelector("#pointsShopCard .card-head h3");
    if (shopTitle) shopTitle.textContent = "Магазин BALI — покупки за баллы";

    const walletTitle = document.querySelector(".wallet .wallet-head small");
    if (walletTitle && /накоплено/i.test(walletTitle.textContent || "")) walletTitle.textContent = "БАЛАНС BALI-БАЛЛОВ";

    const settingsTitle = document.querySelector("#profileForm")?.closest(".card")?.querySelector(".card-head h3");
    if (settingsTitle) settingsTitle.textContent = "Основные настройки профиля";
  }

  function apply() {
    const visible = reveal();
    if (visible) ensureLabels();
  }

  document.addEventListener("click", event => {
    if (event.target.closest('[data-page="profile"]')) [0, 80, 220, 500].forEach(delay => setTimeout(apply, delay));
    if (event.target.closest("[data-open-profile-points], [data-open-profile-rewards], [data-open-profile-settings], [data-open-profile-vip]")) setTimeout(apply, 0);
  }, true);

  ["bali:points-changed", "bali:beta4-changed", "bali:loyalty-changed", "bali:social-changed", "bali:data-changed", "bali:chip-requests-changed"]
    .forEach(name => window.addEventListener(name, () => requestAnimationFrame(apply)));

  let scheduled = false;
  new MutationObserver(records => {
    if (scheduled || !records.some(record => record.addedNodes.length || record.type === "attributes")) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      apply();
    });
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "hidden"] });

  let attempts = 0;
  const timer = setInterval(() => {
    attempts += 1;
    apply();
    if ((document.getElementById("pointsShopCard") && document.getElementById("profileForm")) || attempts > 60) clearInterval(timer);
  }, 100);

  window.BaliFullProfile = { reveal: apply };
})();
