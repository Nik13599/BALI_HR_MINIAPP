(() => {
  if (window.__BALI_BONUSES_ONLY__) return;
  window.__BALI_BONUSES_ONLY__ = true;
  const social = window.BaliBeta4Social;
  const loyalty = window.BaliBeta4Loyalty;
  const game = window.BaliBeta4Game;
  if (!social || !loyalty || !game) return;

  let giftTarget = "";
  social.GIFT_CATALOG?.forEach(gift => { gift.points = Math.max(1, Number(gift.points || gift.stars || 1)); });
  const toast = message => {
    const element = document.getElementById("toast");
    if (!element) return;
    element.textContent = message;
    element.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => element.classList.remove("show"), 2400);
  };

  function cleanVisibleUi() {
    const vipCount = document.querySelector('[data-screen="profile"] .card-head .count');
    if (vipCount && /Stars/i.test(vipCount.textContent || "")) vipCount.textContent = "BALI-Баллы";

    document.querySelectorAll("#socialGiftV2 [data-send-social-gift]").forEach(button => {
      const gift = social.GIFT_CATALOG.find(item => item.id === button.dataset.sendSocialGift);
      const small = button.querySelector("small");
      if (small && gift) small.textContent = `${gift.points} BALI-Баллов`;
    });

    document.querySelectorAll("#profileVipDialog .profile-v2-plan").forEach(plan => {
      const pointButton = plan.querySelector("[data-v2-buy-vip-points]");
      const starsButton = plan.querySelector("[data-buy-vip]");
      const planId = pointButton?.dataset.v2BuyVipPoints || starsButton?.dataset.buyVip || "";
      const price = Number(loyalty.config()?.vipPointPrices?.[planId] || 0);
      starsButton?.remove();
      const priceLabel = plan.querySelector(".profile-v2-plan-head strong");
      if (priceLabel) priceLabel.textContent = price ? `${price} баллов` : "Цена не настроена";
      if (pointButton) {
        pointButton.textContent = price ? `Получить за ${price} баллов` : "Недоступно за баллы";
        pointButton.disabled = !price;
        pointButton.style.gridColumn = "1/-1";
      }
    });

    document.querySelectorAll(".vip-plan").forEach(plan => {
      const button = plan.querySelector("[data-buy-vip]");
      const planId = button?.dataset.buyVip || "";
      const price = Number(loyalty.config()?.vipPointPrices?.[planId] || 0);
      const label = plan.querySelector(".vip-plan-head strong");
      if (label) label.textContent = price ? `${price} баллов` : "Цена не настроена";
      if (button) {
        button.textContent = price ? `Получить за ${price} баллов` : "Недоступно за баллы";
        button.disabled = !price;
      }
    });
  }

  window.addEventListener("click", event => {
    const openGift = event.target.closest?.("[data-person-gift]");
    if (openGift) giftTarget = String(openGift.dataset.personGift || "");

    const giftButton = event.target.closest?.("[data-send-social-gift]");
    if (giftButton) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const gift = social.GIFT_CATALOG.find(item => item.id === giftButton.dataset.sendSocialGift);
      if (!gift || !giftTarget) return toast("Пользователь для подарка не выбран");
      const result = loyalty.spendPoints(gift.points, `Подарок ${gift.name} пользователю BALI`, "social_gift");
      if (!result.ok) return toast(result.message || "Недостаточно BALI-Баллов");
      social.recordGift(giftTarget, gift.id, "bali_points");
      document.getElementById("socialGiftV2")?.close();
      toast(`Подарок отправлен за ${gift.points} BALI-Баллов`);
      return;
    }

    const starsVip = event.target.closest?.("[data-buy-vip]");
    if (starsVip) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const planId = starsVip.dataset.buyVip;
      const price = Number(loyalty.config()?.vipPointPrices?.[planId] || 0);
      if (!price) return toast("Цена VIP в BALI-Баллах не настроена");
      if (!confirm(`Получить VIP за ${price} BALI-Баллов?`)) return;
      const result = loyalty.buyVipWithPoints(planId);
      toast(result.ok ? "VIP-статус активирован" : result.message);
      cleanVisibleUi();
    }
  }, true);

  cleanVisibleUi();
  let scheduled = false;
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; cleanVisibleUi(); });
  }).observe(document.body, { childList: true, subtree: true });
  ["bali:loyalty-changed", "bali:social-changed", "bali:beta4-changed"].forEach(name => window.addEventListener(name, cleanVisibleUi));
})();