(() => {
  if (window.__BALI_FULL_DEMO_SOCIAL_ECONOMY__) return;
  window.__BALI_FULL_DEMO_SOCIAL_ECONOMY__ = true;

  const social = window.BaliBeta4Social;
  const loyalty = window.BaliBeta4Loyalty;
  const points = window.BaliPoints;
  if (!social || !points) return;

  const COSTS = Object.freeze({ rose:250, cocktail:500, disco:1000, crown:2500 });
  let targetId = "";

  function toast(message) {
    const node = document.getElementById("toast");
    if (!node) return;
    node.textContent = message;
    node.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove("show"), 2400);
  }

  function costFor(giftId) {
    const gift = social.GIFT_CATALOG.find(row => row.id === giftId);
    return Number(COSTS[giftId] || Number(gift?.stars || 0) * 10 || 100);
  }

  function spend(cost, title) {
    if (loyalty?.spendPoints) return loyalty.spendPoints(cost, title, "social_gift");
    const profile = points.profile();
    if (Number(profile.balance || 0) < cost) return { ok:false, message:"Недостаточно BALI-Баллов" };
    const result = points.adjustAccount(profile, -cost, title);
    return result.ok ? { ok:true, balance:Number(result.account?.balance || 0) } : result;
  }

  function decorate() {
    document.querySelectorAll("[data-person-thumb]").forEach(button => {
      button.textContent = "❤️";
      button.title = "Поставить сердечко";
    });
    document.querySelectorAll("[data-send-social-gift]").forEach(button => {
      const id = button.dataset.sendSocialGift;
      const small = button.querySelector("small");
      if (small) small.textContent = `${costFor(id)} баллов`;
      button.title = `Подарить за ${costFor(id)} BALI-Баллов`;
    });
  }

  document.addEventListener("click", event => {
    const openGift = event.target.closest("[data-person-gift]");
    if (openGift) targetId = String(openGift.dataset.personGift || "");

    const send = event.target.closest("[data-send-social-gift]");
    if (!send) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const giftId = send.dataset.sendSocialGift;
    const gift = social.GIFT_CATALOG.find(row => row.id === giftId);
    if (!gift || !targetId) return toast("Пользователь или подарок не выбран");
    const cost = costFor(giftId);
    const result = spend(cost, `Подарок «${gift.name}» пользователю BALI`);
    if (!result.ok) return toast(result.message || "Недостаточно BALI-Баллов");
    const row = social.recordGift(targetId, giftId, "bali_points");
    if (!row) {
      points.adjustAccount(points.profile(), cost, `Возврат за подарок «${gift.name}»`);
      return toast("Не удалось отправить подарок");
    }
    const gifts = JSON.parse(localStorage.getItem("bali_social_gifts_v1") || "[]");
    const index = gifts.findIndex(item => item.id === row.id);
    if (index >= 0) {
      gifts[index] = { ...gifts[index], pointsCost:cost, currency:"bali_points" };
      localStorage.setItem("bali_social_gifts_v1", JSON.stringify(gifts));
    }
    document.getElementById("socialGiftV2")?.close();
    toast(`Подарок отправлен · −${cost} баллов`);
    window.dispatchEvent(new CustomEvent("bali:social-changed"));
    window.dispatchEvent(new CustomEvent("bali:points-changed"));
  }, true);

  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; decorate(); });
  };
  new MutationObserver(schedule).observe(document.documentElement, { childList:true, subtree:true });
  ["bali:social-changed","bali:points-changed"].forEach(name => window.addEventListener(name, schedule));
  schedule();
  window.BaliFullDemoSocialEconomy = { COSTS, costFor };
})();