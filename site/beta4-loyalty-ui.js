(() => {
  if (window.__BALI_BETA4_LOYALTY_UI__) return;
  window.__BALI_BETA4_LOYALTY_UI__ = true;
  const loyalty = window.BaliBeta4Loyalty, points = window.BaliPoints, game = window.BaliBeta4Game;
  if (!loyalty || !points || !game) return;
  const esc = (v = "") => String(v).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const conditionLabel = (reward) => {
    if (reward.conditionType === "visits") return `${Number(reward.threshold || 1)} посещений`;
    if (reward.conditionType === "anniversary") return `${Number(reward.threshold || 1)} ${Number(reward.threshold) === 1 ? "год" : "года"} с BALI`;
    if (reward.conditionType === "event") return reward.eventTitle ? `Посетить «${reward.eventTitle}»` : "Посетить выбранное мероприятие";
    return "Выдаётся заведением";
  };
  function styles() {
    if (document.getElementById("beta4LoyaltyUiStyle")) return;
    const style = document.createElement("style"); style.id = "beta4LoyaltyUiStyle";
    style.textContent = `.points-shop{display:grid;gap:12px}.points-shop-balance{display:grid;grid-template-columns:1fr 1fr;gap:8px}.points-shop-balance article{padding:13px;border:1px solid var(--line);border-radius:16px;background:rgba(255,255,255,.025)}.points-shop-balance small{display:block;color:var(--muted);font-size:8px}.points-shop-balance strong{display:block;margin-top:6px;color:var(--lime);font:600 22px Unbounded}.points-vip-list{display:grid;gap:8px}.points-vip-item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:12px;border:1px solid rgba(227,189,100,.22);border-radius:16px;background:rgba(227,189,100,.045)}.points-vip-item h4{margin:0;font:600 12px Unbounded}.points-vip-item p{margin-top:4px;color:var(--muted);font-size:8px}.points-vip-item button{min-height:40px;padding:0 11px}.chip-exchange{display:grid;gap:10px;padding:13px;border:1px solid rgba(200,255,61,.18);border-radius:16px;background:rgba(200,255,61,.045)}.chip-exchange-head{display:flex;justify-content:space-between;gap:10px}.chip-exchange-head strong{color:var(--lime)}.chip-exchange p{color:var(--muted);font-size:9px;line-height:1.5}.chip-actions{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.chip-actions button{min-height:40px;padding:0 7px}.custom-rewards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.custom-reward{overflow:hidden;border:1px solid var(--line);border-radius:17px;background:var(--panel);opacity:.52}.custom-reward.earned{opacity:1;border-color:rgba(200,255,61,.28)}.custom-reward-media{aspect-ratio:1.25;background:linear-gradient(145deg,#222923,#0e1110);display:grid;place-items:center;font-size:31px}.custom-reward-media img{width:100%;height:100%;object-fit:cover;display:block}.custom-reward-body{display:grid;gap:6px;padding:11px}.custom-reward h4{margin:0;font:600 11px Unbounded}.custom-reward p{color:var(--muted);font-size:8px;line-height:1.45}.custom-reward b{color:var(--lime);font-size:8px}.custom-reward em{font-style:normal;color:#d9c07f;font-size:8px}@media(max-width:360px){.custom-rewards{grid-template-columns:1fr}.points-vip-item{grid-template-columns:1fr}.points-vip-item button{width:100%}}`;
    document.head.appendChild(style);
  }
  function ensureCards() {
    const wallet = document.querySelector(".wallet"), achievements = document.getElementById("achievements");
    if (!wallet || !achievements) return false;
    if (!document.getElementById("pointsShopCard")) {
      const card = document.createElement("section"); card.className = "card"; card.id = "pointsShopCard";
      wallet.insertAdjacentElement("afterend", card);
    }
    if (!document.getElementById("customRewardsCard")) {
      const parent = achievements.closest(".card"), card = document.createElement("section"); card.className = "card"; card.id = "customRewardsCard";
      parent?.insertAdjacentElement("afterend", card);
    }
    return true;
  }
  function renderShop() {
    const root = document.getElementById("pointsShopCard"); if (!root) return;
    const cfg = loyalty.config(), p = points.profile(), chips = loyalty.chipBalance(game.profile()), plans = game.config().plans.filter(row => row.active !== false);
    root.innerHTML = `<div class="card-head"><h3>Купить за баллы</h3><span class="count">BALI SHOP</span></div><div class="points-shop"><div class="points-shop-balance"><article><small>ДОСТУПНО БАЛЛОВ</small><strong>${Number(p.balance || 0)}</strong></article><article><small>ФИШЕК НА БАР</small><strong>${chips}</strong></article></div><div class="points-vip-list">${plans.map(plan => { const price = Number(cfg.vipPointPrices?.[plan.id] || 0); return `<article class="points-vip-item"><div><h4>${esc(plan.name)}</h4><p>${Number(plan.days || 30)} дней · ${Number(plan.discount || 0)}% скидка · ×${Number(plan.pointsMultiplier || 1)} баллы</p></div><button class="primary" type="button" data-buy-vip-points="${esc(plan.id)}" ${price ? "" : "disabled"}>${price ? `${price} баллов` : "Не настроено"}</button></article>`; }).join("")}</div><div class="chip-exchange"><div class="chip-exchange-head"><strong>${Number(cfg.chipRatePoints || 100)} баллов = 1 фишка</strong><span>${chips} фиш.</span></div><p>${esc(cfg.chipDescription)}</p><div class="chip-actions"><button class="secondary" type="button" data-exchange-chips="1">1 фишка</button><button class="secondary" type="button" data-exchange-chips="5">5 фишек</button><button class="secondary" type="button" data-exchange-chips="10">10 фишек</button></div></div></div>`;
  }
  function renderRewards() {
    const root = document.getElementById("customRewardsCard"); if (!root) return;
    loyalty.evaluateRewards(game.profile());
    const rows = loyalty.rewards().filter(row => row.active !== false), earned = loyalty.earnedRewardIds(game.profile());
    root.innerHTML = `<div class="card-head"><h3>Награды BALI</h3><span class="count">${[...earned].filter(id => rows.some(r => r.id === id)).length}/${rows.length}</span></div><div class="custom-rewards">${rows.length ? rows.map(row => `<article class="custom-reward ${earned.has(row.id) ? "earned" : ""}"><div class="custom-reward-media">${row.image ? `<img src="${esc(row.image)}" alt="${esc(row.title)}">` : "🏆"}</div><div class="custom-reward-body"><h4>${esc(row.title)}</h4><p>${esc(row.description || "Памятная награда клуба")}</p><em>${esc(conditionLabel(row))}</em><b>${earned.has(row.id) ? "Получено" : `+${Number(row.xp || 0)} XP`}</b></div></article>`).join("") : '<div class="empty" style="grid-column:1/-1">Новые награды скоро появятся</div>'}</div>`;
  }
  function render() { if (!ensureCards()) return; renderShop(); renderRewards(); }
  document.addEventListener("click", event => {
    const vip = event.target.closest("[data-buy-vip-points]");
    if (vip) {
      event.preventDefault(); const plan = game.config().plans.find(row => row.id === vip.dataset.buyVipPoints), price = Number(loyalty.config().vipPointPrices?.[vip.dataset.buyVipPoints] || 0);
      if (!plan || !confirm(`Купить ${plan.name} за ${price} BALI-Баллов?`)) return;
      const result = loyalty.buyVipWithPoints(plan.id); window.dispatchEvent(new CustomEvent("bali:points-changed"));
      const toast = document.getElementById("toast"); if (toast) { toast.textContent = result.ok ? `${plan.name} активирован` : result.message; toast.classList.add("show"); setTimeout(() => toast.classList.remove("show"), 2400); }
      render(); return;
    }
    const chips = event.target.closest("[data-exchange-chips]");
    if (chips) {
      event.preventDefault(); const count = Number(chips.dataset.exchangeChips || 1), cost = count * Number(loyalty.config().chipRatePoints || 100);
      if (!confirm(`Обменять ${cost} BALI-Баллов на ${count} фиш.?`)) return;
      const result = loyalty.exchangeForChips(count), toast = document.getElementById("toast");
      if (toast) { toast.textContent = result.ok ? `Получено ${count} фиш.` : result.message; toast.classList.add("show"); setTimeout(() => toast.classList.remove("show"), 2400); }
      render();
    }
  }, true);
  styles();
  const observer = new MutationObserver(() => requestAnimationFrame(render)); observer.observe(document.documentElement, { subtree: true, childList: true });
  ["bali:points-changed","bali:beta4-changed","bali:loyalty-changed"].forEach(name => window.addEventListener(name, render));
  setTimeout(render, 0);
})();