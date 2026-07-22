(() => {
  if (window.__BALI_ADMIN_REVIEW_REWARD__) return;
  window.__BALI_ADMIN_REVIEW_REWARD__ = true;
  const points=window.BaliPoints;
  if(!points)return;
  const reward=()=>Math.max(0,Number(points.settings().review??100));
  function save(value){const current=points.read(points.keys.settings,{});points.write(points.keys.settings,{...current,review:Math.max(0,Number(value||0))});}
  function enhance(){
    if(document.getElementById('reviewRewardAdminPanel'))return;
    const root=document.querySelector('#content .panel');
    if(!root||document.getElementById('pageTitle')?.textContent.trim()!=='Отзывы')return;
    root.insertAdjacentHTML('afterbegin',`<section id="reviewRewardAdminPanel" style="margin:0 0 14px;padding:14px;border:1px solid rgba(200,255,61,.24);border-radius:16px;background:rgba(200,255,61,.05)"><div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap"><div><strong style="display:block;font-size:12px">Награда за отзыв</strong><small style="color:var(--muted);font-size:9px">Начисляется один раз за первое сообщение пользователя по каждому посещённому мероприятию.</small></div><label style="display:flex;align-items:center;gap:8px;font-size:9px"><input id="reviewRewardAmount" type="number" min="0" step="10" value="${reward()}" style="width:100px;min-height:40px;padding:0 10px;border:1px solid var(--line);border-radius:10px;background:#111614;color:#fff"><span>баллов</span><button id="saveReviewReward" class="primary compact" type="button">Сохранить</button></label></div></section>`);
    document.getElementById('saveReviewReward')?.addEventListener('click',()=>{save(document.getElementById('reviewRewardAmount')?.value);const t=document.getElementById('toast');if(t){t.textContent=`Награда за отзыв: ${reward()} баллов`;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2200)}});
    document.querySelectorAll('.review-admin-card').forEach(card=>{
      if(card.querySelector('.review-reward-badge'))return;
      const meta=card.querySelector('.review-admin-meta'); if(!meta)return;
      const id=card.dataset.reviewId; const rows=window.BaliStore?.list?null:null;
      const span=document.createElement('span');span.className='review-reward-badge';span.textContent='🎁 Награда проверяется';meta.appendChild(span);
    });
    window.BaliStore?.list?.('reviews').then(rows=>rows.forEach(row=>{
      const badge=document.querySelector(`.review-admin-card[data-review-id="${CSS.escape(String(row.id))}"] .review-reward-badge`);if(!badge)return;
      const amount=Number(row.reward_amount??reward());
      badge.textContent=row.reward_status==='granted'?`🎁 +${amount} баллов начислено`:row.reward_status==='already_received'?`🎁 Награда ранее получена`:`🎁 +${amount} баллов`;
    })).catch(()=>{});
  }
  new MutationObserver(()=>requestAnimationFrame(enhance)).observe(document.body,{childList:true,subtree:true});
  [0,300,900,1600].forEach(x=>setTimeout(enhance,x));
})();