(async()=>{
  const version='bali-production-7';
  const load=(name,limit=20000)=>new Promise((resolve,reject)=>{
    const s=document.createElement('script');
    const timer=setTimeout(()=>reject(new Error(`Модуль ${name} не ответил`)),limit);
    s.src=name.startsWith('http')?name:`./${name}?v=${version}`;
    s.onload=()=>{clearTimeout(timer);resolve(name)};
    s.onerror=()=>{clearTimeout(timer);reject(new Error(`Не удалось загрузить ${name}`))};
    document.body.appendChild(s);
  });
  const optional=async name=>{try{await load(name)}catch(error){console.warn('[BALI]',error.message)}};

  await load('config.js');
  await load('telegram-auth-gate.js');
  const auth=await window.BaliTelegramAuth.ready;
  if(!auth?.ok)return;

  const style=document.createElement('style');
  style.textContent='html[data-bali-boot="1"] #app{visibility:hidden}#baliBoot{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;background:#07100c;color:#fff;font-family:system-ui;text-align:center}#baliBoot i{display:block;width:40px;height:40px;margin:0 auto 14px;border:3px solid #ffffff22;border-top-color:#c8ff3d;border-radius:50%;animation:baliSpin .8s linear infinite}#baliBoot small{display:block;margin-top:7px;color:#91a097}@keyframes baliSpin{to{transform:rotate(360deg)}}';
  document.head.appendChild(style);
  document.documentElement.dataset.baliBoot='1';
  document.body.insertAdjacentHTML('beforeend','<div id="baliBoot"><div><i></i><strong>Загружаем BALI</strong><small>Подключаем актуальную версию</small></div></div>');

  ['beta4-app.css','beta4-layout-map.css','beta4-home-links.css','beta4-social.css','legacy-nav-final-beta4.css'].forEach(name=>{
    const link=document.createElement('link');link.rel='stylesheet';link.href=`./${name}?v=${version}`;document.head.appendChild(link);
  });

  const core=['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2','store.js','hall-layout-data.js','reviews-public-save-beta4.js','points-core.js','beta4-game.js','app-users-core-beta4.js','bali-age-gate-beta4.js','beta4-loyalty-core.js','chip-requests-core-beta4.js','beta4-reward-icons-core.js','home-design-core-beta4.js','event-qr-attendance-beta4.js','event-qr-local-bridge-beta4.js','beta4-social-core.js','seating-templates-core-beta4.js','event-lifecycle-core-beta4.js','beta4-app.js'];
  for(const name of core)await load(name);

  const visual=['legacy-nav-final-beta4.js','home-layout-final-beta4.js','beta4-menu-categories.js','beta4-menu-media.js','beta4-layout-map.js','beta4-home-links.js','beta4-profile-booking.js','beta4-loyalty-ui-stable.js','beta4-social-page.js','beta4-profile-v2.js','profile-demographics-beta4.js','bali-bonuses-only-beta4.js','profile-ranking-full-beta4.js','profile-recent-rewards-beta4.js','beta4-home-design.js','profile-full-restore-beta4.js','profile-controls-final-beta4.js','event-details-lineup-beta4.js','venue-reviews-user-beta4.js','review-eligibility-private-beta4.js','event-stability-final-beta4.js','remove-contest-final-beta4.js','user-production-features.js','user-profile-final-cleanup.js'];
  for(const name of visual)await optional(name);

  document.getElementById('baliBoot')?.remove();
  delete document.documentElement.dataset.baliBoot;
  window.dispatchEvent(new CustomEvent('bali:production-ready',{detail:{version}}));

  const extras=['bali-people-status-sync-beta4.js','social-gifts-production.js','bali-people-open-likes-beta4.js','bali-people-live-event-beta4.js','beta4-reward-icon-view.js','beta4-qr-checkin.js','beta4-ranking-visits.js','profile-history-title-only-beta4.js','bali-people-privacy-beta4.js','bali-people-search-ranking-beta4.js','bali-people-public-cards-beta4.js','bali-people-vip-frame-beta4.js','vip-duration-options-beta4.js','chip-requests-user-beta4.js','legacy-event-attendance-beta4.js'];
  setTimeout(async()=>{for(const name of extras)await optional(name)},200);
})().catch(error=>{
  console.error('[BALI production loader]',error);
  document.getElementById('baliBoot')?.remove();
  delete document.documentElement.dataset.baliBoot;
  if(window.BaliTelegramAuth&&!window.BaliTelegramAuth.isAuthenticated())return;
  const root=document.getElementById('app')||document.body;
  root.innerHTML='<main style="min-height:100dvh;display:grid;place-items:center;padding:24px;background:#07100c;color:white;font-family:system-ui;text-align:center"><section><h2>Не удалось загрузить BALI</h2><p id="baliLoadError"></p><button id="baliReload" style="min-height:48px;padding:0 22px;border:0;border-radius:14px;background:#c8ff3d;color:#07100c;font-weight:900">Повторить</button></section></main>';
  const message=document.getElementById('baliLoadError');if(message)message.textContent=error?.message||'Ошибка загрузки';
  document.getElementById('baliReload')?.addEventListener('click',()=>location.reload());
});
