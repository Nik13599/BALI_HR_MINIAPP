(() => {
  if (window.__BALI_REWARD_ICON_VIEW__ || !window.BaliRewardIcons) return;
  window.__BALI_REWARD_ICON_VIEW__ = true;
  function place(icon, source) {
    if (!icon || !source) return;
    icon.textContent = "";
    const image = document.createElement("img");
    image.src = source;
    image.alt = "";
    image.style.width = "100%";
    image.style.height = "100%";
    image.style.objectFit = "contain";
    icon.appendChild(image);
  }
  function apply() {
    const standard = window.BaliBeta4Game?.achievements?.() || [];
    document.querySelectorAll("#achievements .achievement").forEach((card, index) => {
      place(card.querySelector("i"), window.BaliRewardIcons.get(standard[index]?.id));
    });
    const custom = window.BaliBeta4Loyalty?.rewards?.() || [];
    document.querySelectorAll("#customRewardsCard .achievement").forEach((card, index) => {
      place(card.querySelector("i"), window.BaliRewardIcons.get(custom[index]?.id));
    });
  }
  document.addEventListener("click", event => {
    if (event.target.closest('[data-page="profile"]')) setTimeout(apply, 80);
  }, true);
  window.addEventListener("bali:reward-icons-changed", () => setTimeout(apply, 0));
  setTimeout(apply, 600);
})();