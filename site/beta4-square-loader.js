(async()=>{
  const v='bali-telegram-auth-2';
  const loadScript=name=>new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=name.startsWith('http')?name:`./${name}?v=${v}`;
    script.onload=()=>resolve(name);
    script.onerror=()=>reject(new Error(`Не удалось загрузить ${name}`));
    document.body.appendChild(script);
  });

  await loadScript('config.js');
  await loadScript('telegram-auth-gate.js');
  const auth=await window.BaliTelegramAuth.ready;
  if(!auth?.ok)return;

  const css=['beta4-app.css','beta4-layout-map.css','beta4-home-links.css','beta4-social.css','legacy-nav-final-beta4.css'];
  css.forEach(name=>{
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href=`./${name}?v=${v}`;
    document.head.appendChild(link);
  });

  const core=[
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
    'store.js',
    'hall-layout-data.js',
    'reviews-public-save-beta4.js',
    'points-core.js',
    'beta4-game.js',
    'app-users-core-beta4.js',
    'bali-age-gate-beta4.js',
    'beta4-loyalty-core.js',
    'chip-requests-core-beta4.js',
    'beta4-reward-icons-core.js',
    'home-design-core-beta4.js',
    'event-qr-attendance-beta4.js',
    'event-qr-local-bridge-beta4.js',
    'beta4-social-core.js',
    'seating-templates-core-beta4.js',
    'event-lifecycle-core-beta4.js',
    'beta4-app.js'
  ];
  for(const name of core)await loadScript(name);

  const optional=[
    'bali-people-status-sync-beta4.js',
    'legacy-nav-final-beta4.js',
    'home-layout-final-beta4.js',
    'beta4-menu-categories.js',
    'beta4-menu-media.js',
    'beta4-layout-map.js',
    'beta4-home-links.js',
    'beta4-profile-booking.js',
    'beta4-loyalty-ui-stable.js',
    'beta4-social-page.js',
    'bali-people-open-likes-beta4.js',
    'bali-people-live-event-beta4.js',
    'beta4-reward-icon-view.js',
    'beta4-qr-checkin.js',
    'beta4-ranking-visits.js',
    'beta4-profile-v2.js',
    'profile-history-title-only-beta4.js',
    'profile-demographics-beta4.js',
    'bali-bonuses-only-beta4.js',
    'bali-people-privacy-beta4.js',
    'bali-people-search-ranking-beta4.js',
    'bali-people-public-cards-beta4.js',
    'bali-people-vip-frame-beta4.js',
    'profile-ranking-full-beta4.js',
    'profile-recent-rewards-beta4.js',
    'vip-duration-options-beta4.js',
    'chip-requests-user-beta4.js',
    'beta4-home-design.js',
    'profile-full-restore-beta4.js',
    'profile-controls-final-beta4.js',
    'legacy-event-attendance-beta4.js',
    'event-details-lineup-beta4.js',
    'venue-reviews-user-beta4.js',
    'review-eligibility-private-beta4.js',
    'profile-invitations-split-beta4.js',
    'event-stability-final-beta4.js',
    'remove-contest-final-beta4.js',
    'user-production-features.js'
  ];
  for(const name of optional){
    try{await loadScript(name)}catch(error){console.warn('[BALI optional module]',error.message)}
  }

  const reset=()=>document.querySelector('.booking-data-overlay')?.classList.remove('open');
  document.getElementById('eventDialog')?.addEventListener('close',reset);
  document.addEventListener('click',event=>{if(event.target.closest('[data-event]'))reset()},true);
})().catch(error=>{
  console.error('[BALI loader]',error);
  if(window.BaliTelegramAuth&&!window.BaliTelegramAuth.isAuthenticated())return;
  const message=String(error?.message||'Неизвестная ошибка').replace(/[<>&]/g,'');
  document.body.innerHTML=`<main style="min-height:100dvh;display:grid;place-items:center;padding:24px;background:#07100c;color:white;font-family:system-ui;text-align:center;box-sizing:border-box"><section style="width:min(420px,100%);padding:24px;border:1px solid #c8ff3d55;border-radius:24px;background:#0c1711"><h2 style="margin:0 0 10px">Не удалось загрузить BALI</h2><p style="color:#b7c3bb;line-height:1.55">${message}</p><button onclick="location.reload()" style="width:100%;min-height:50px;margin-top:12px;border:0;border-radius:14px;background:#c8ff3d;color:#07100c;font-weight:900">Повторить загрузку</button></section></main>`;
});