(() => {
  'use strict';
  const store = window.BaliStore;
  if (!store || window.__BALI_REBUILD_ADMIN_BOOTSTRAP_V1__) return;
  window.__BALI_REBUILD_ADMIN_BOOTSTRAP_V1__ = true;

  const rewardDefaults = [
    { title:'VIP-статус на 7 дней', description:'Временный VIP-статус в приложении BALI.', icon:'👑', points_cost:500, stock:null, active:true, image:'' },
    { title:'Приоритетная бронь', description:'Приоритетное подтверждение бронирования стола.', icon:'⭐', points_cost:300, stock:null, active:true, image:'' },
    { title:'Комплимент от BALI', description:'Специальный комплимент от клуба при следующем посещении.', icon:'🌴', points_cost:250, stock:null, active:true, image:'' }
  ];
  const giftDefaults = [
    { title:'Коктейль BALI', description:'Подарочный коктейль из специального меню.', icon:'🍸', points_cost:300, stock:null, active:true, image:'' },
    { title:'Кальян BALI', description:'Подарочный кальян при следующем посещении клуба.', icon:'💨', points_cost:700, stock:null, active:true, image:'' },
    { title:'Пять шотов', description:'Подарочный сет из пяти шотов.', icon:'🥃', points_cost:500, stock:null, active:true, image:'' }
  ];

  async function seedTable(table, defaults) {
    const rows = await store.list(table).catch(() => store.readCache?.(table) || []);
    const titles = new Set(rows.map(row => String(row.title || '').trim().toLowerCase()));
    for (const item of defaults) {
      if (!titles.has(item.title.toLowerCase())) await store.save(table, item);
    }
  }

  async function seed() {
    await Promise.all([
      seedTable('loyalty_rewards', rewardDefaults),
      seedTable('loyalty_gifts', giftDefaults)
    ]);
    const settings = await store.list('app_settings').catch(() => []);
    if (!settings.some(row => row.id === 'main')) {
      await store.save('app_settings', {
        id:'main', club_name:'BALI', address:'Минск, ул. Кирова, 13', phone:'+375 29 670-03-00',
        events_title:'Ближайшие события', about_title:'О клубе', attendance_points:100
      });
    }
  }

  const originalGetSession = store.getSession.bind(store);
  store.getSession = async (...args) => {
    const session = await originalGetSession(...args);
    if (session) await seed().catch(error => console.warn('[BALI admin seed]', error));
    return session;
  };

  const originalSignIn = store.signIn.bind(store);
  store.signIn = async (...args) => {
    const result = await originalSignIn(...args);
    await seed().catch(error => console.warn('[BALI admin seed]', error));
    return result;
  };

  window.BaliAdminRebuildBootstrap = { seed };
})();
