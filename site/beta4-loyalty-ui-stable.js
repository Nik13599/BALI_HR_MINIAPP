(() => {
  if (window.__BALI_LOYALTY_UI_STABLE__) return;
  window.__BALI_LOYALTY_UI_STABLE__ = true;
  const loyalty=window.BaliBeta4Loyalty,points=window.BaliPoints,game=window.BaliBeta4Game;
  if(!loyalty||!points||!game)return;
  const esc=(v="")=>String(v).replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const number=v=>Number(v||0).toLocaleString("ru-RU");
  const date=v=>v?new Date(v).toLocaleDateString("ru-RU"):"";
  const pointsStatus=g=>({credited:"начислено",pending:"ожидает",retry_required:"восстанавливается",skipped_repeat:"начислено при первом получении",not_applicable:"без начисления"}[g?.pointsStatus]||"");
  let busy=false;
  function styles(){
    if(document.getElementById("rewardPointsUserStyle"))return;
    const style=document.createElement("style");
    style.id="rewardPointsUserStyle";
    style.textContent=`#customRewardsCard .achievement{align-items:flex-start}#customRewardsCard .achievement>div{min-width:0;display:grid;gap:3px}.reward-points-value{display:inline-flex;width:max-content;max-width:100%;padding:3px 6px;border:1px solid rgba(226,166,78,.3);border-radius:999px;background:rgba(226,166,78,.08);color:#e7b76d!important;font-size:8px!important;font-weight:900}.reward-points-earned{color:var(--lime)!important}.reward-points-meta{color:var(--muted);font-size:7px;line-height:1.35}`;
    document.head.appendChild(style);
  }
  function showUnread(){
    const row=loyalty.notifications?.(game.profile(),true)?.[0];
    if(!row)return;
    notice(row.text);
    loyalty.markNotificationRead?.(row.id);
  }
  function mount(){
    if(busy)return;
    const wallet=document.querySelector(".wallet"),achievements=document.getElementById("achievements");
    if(!wallet||!achievements)return;
    busy=true;
    try{
      let shop=document.getElementById("pointsShopCard");
      if(!shop){shop=document.createElement("section");shop.className="card";shop.id="pointsShopCard";wallet.insertAdjacentElement("afterend",shop)}
      let rewards=document.getElementById("customRewardsCard");
      if(!rewards){rewards=document.createElement("section");rewards.className="card";rewards.id="customRewardsCard";achievements.closest(".card")?.insertAdjacentElement("afterend",rewards)}
      const cfg=loyalty.config(),profile=points.profile(),chips=loyalty.chipBalance(game.profile()),plans=game.config().plans.filter(p=>p.active!==false);
      shop.innerHTML=`<div class="card-head"><h3>Купить за баллы</h3><span class="count">BALI SHOP</span></div><div class="points-shop-balance"><article><small>БАЛЛЫ</small><strong>${Number(profile.balance||0)}</strong></article><article><small>ФИШКИ</small><strong>${chips}</strong></article></div><div class="vip-plans">${plans.map(p=>{const price=Number(cfg.vipPointPrices?.[p.id]||0);return `<article><div><strong>${esc(p.name)}</strong><small>${Number(p.days||30)} дней</small></div><button class="primary" data-buy-vip-points="${esc(p.id)}" ${price?"":"disabled"}>${price||"—"} баллов</button></article>`}).join("")}</div><div class="card" style="margin-top:10px"><strong>${Number(cfg.chipRatePoints||100)} баллов = 1 фишка</strong><p class="muted">${esc(cfg.chipDescription||"")}</p><div class="actions"><button class="secondary" data-exchange-chips="1">1 фишка</button><button class="secondary" data-exchange-chips="5">5 фишек</button></div></div>`;
      loyalty.evaluateRewards(game.profile());
      const rows=loyalty.rewards().filter(r=>r.active!==false),earned=loyalty.earnedRewardIds(game.profile()),myGrants=loyalty.grantsFor?.(game.profile())||[];
      const latestGrant=new Map();
      myGrants.filter(g=>!g.revokedAt).forEach(g=>{if(!latestGrant.has(g.rewardId))latestGrant.set(g.rewardId,g)});
      rewards.innerHTML=`<div class="card-head"><h3>Награды BALI</h3><span class="count">${[...earned].length}/${rows.length}</span></div><div class="achievements">${rows.length?rows.map(r=>{const grant=latestGrant.get(r.id),showPoints=r.awardPointsEnabled&&Number(r.pointsRewardAmount||0)>0&&r.awardPointsMode!=="none",pointsText=grant?.pointsStatus==="credited"?`Получено ${number(grant.pointsAwarded)} баллов`:grant?.pointsStatus==="not_applicable"?"Получено ранее без баллов":grant?.pointsStatus==="skipped_repeat"?"Баллы — только за первое получение":`За получение: +${number(r.pointsRewardAmount)} баллов`;return `<article class="achievement ${earned.has(r.id)?"earned":""}">${r.image?`<img src="${esc(r.image)}" alt="">`:'<i>🏆</i>'}<div><strong>${esc(r.title)}</strong><small>${esc(r.description||"")} · +${Number(r.xp||0)} XP</small>${showPoints?`<b class="reward-points-value ${grant?.pointsStatus==="credited"?"reward-points-earned":""}">${pointsText}</b>`:""}${grant?`<span class="reward-points-meta">${date(grant.pointsCreditedAt||grant.earnedAt)} · ${esc(pointsStatus(grant))}</span>`:""}</div></article>`}).join(""):'<div class="empty">Награды скоро появятся</div>'}</div>`;
      showUnread();
    } finally {busy=false}
  }
  function notice(text){const el=document.getElementById("toast");if(!el)return;el.textContent=text;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2200)}
  document.addEventListener("click",e=>{
    if(e.target.closest('[data-page="profile"]'))setTimeout(mount,0);
    const vip=e.target.closest("[data-buy-vip-points]");
    if(vip){const plan=game.config().plans.find(p=>p.id===vip.dataset.buyVipPoints),price=Number(loyalty.config().vipPointPrices?.[vip.dataset.buyVipPoints]||0);if(plan&&confirm(`Купить ${plan.name} за ${price} баллов?`)){const result=loyalty.buyVipWithPoints(plan.id);notice(result.ok?"VIP активирован":result.message);mount()}return}
    const chip=e.target.closest("[data-exchange-chips]");
    if(chip){const count=Number(chip.dataset.exchangeChips||1),cost=count*Number(loyalty.config().chipRatePoints||100);if(confirm(`Обменять ${cost} баллов на ${count} фиш.?`)){const result=loyalty.exchangeForChips(count);notice(result.ok?"Фишки начислены":result.message);mount()}}
  },true);
  styles();
  ["bali:points-changed","bali:loyalty-changed","storage","focus"].forEach(name=>window.addEventListener(name,()=>requestAnimationFrame(mount)));
  let tries=0;const timer=setInterval(()=>{tries++;mount();if(document.getElementById("pointsShopCard")||tries>20)clearInterval(timer)},100);
})();
