(async () => {
  const version = "bali-production-15";
  const loaded = new Set();
  const pending = new Map();
  const url = name => name.startsWith("http") ? name : `./${name}?v=${version}`;

  function load(name, timeout = 9000) {
    if (loaded.has(name)) return Promise.resolve(name);
    if (pending.has(name)) return pending.get(name);
    const task = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      let finished = false;
      const timer = setTimeout(() => done(new Error(`Модуль ${name} не ответил`)), timeout);
      const done = error => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        pending.delete(name);
        if (error) reject(error); else { loaded.add(name); resolve(name); }
      };
      script.src = url(name);
      script.async = false;
      script.onload = () => done();
      script.onerror = () => done(new Error(`Не удалось загрузить ${name}`));
      document.body.appendChild(script);
    });
    pending.set(name, task);
    return task;
  }

  const optional = (name, timeout = 5000) => load(name, timeout).catch(error => { console.warn('[BALI optional]', error.message); return null; });

  await load('config.js');
  await load('telegram-auth-gate.js');
  if (!(await window.BaliTelegramAuth.ready)?.ok) return;
  await load('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
  await load('store.js');
  await Promise.all([
    load('points-core.js'),
    load('app-users-core-beta4.js'),
    optional('event-lifecycle-core-beta4.js'),
    optional('beta4-loyalty-core.js'),
    optional('event-qr-attendance-beta4.js'),
    load('beta4-social-core.js')
  ]);
  await Promise.all([
    optional('social-cloud-sync-production.js',9000),
    optional('cloud-loyalty-production.js',9000),
    optional('event-checkin-cloud-production.js',9000)
  ]);
  await load('beta4-app.js');

  const modules = [
    'legacy-nav-final-beta4.js','beta4-profile-v2.js','beta4-social-page.js',
    'profile-full-restore-beta4.js','event-stability-final-beta4.js',
    'user-profile-final-cleanup.js','user-ui-labels-stability-production.js',
    'bali-production-integrity-fix.js',
    'bali-people-status-sync-beta4.js','bali-people-public-cards-beta4.js',
    'bali-people-vip-frame-beta4.js','beta4-qr-checkin.js'
  ];
  for (const module of modules) await optional(module,4500);

  document.getElementById('baliBoot')?.remove();
  window.dispatchEvent(new CustomEvent('bali:production-ready',{detail:{version,phase:'complete'}}));
})().catch(error => console.error('[BALI loader]', error));
