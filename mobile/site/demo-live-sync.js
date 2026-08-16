(() => {
  const demo = window.BaliDemo;
  if (!demo || window.__BALI_DEMO_LIVE_SYNC__) return;
  window.__BALI_DEMO_LIVE_SYNC__ = true;

  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const originalSelect = demo.selectUser.bind(demo);
  const originalReset = demo.reset.bind(demo);
  const staticUser = key => demo.users.find(user => user.key === key) || demo.users[0];

  function liveUser(key) {
    const user = staticUser(key);
    const account = read("bali_points_accounts_v1", {})[user.key] || {};
    return {
      ...user,
      balance: Number(account.balance ?? user.balance ?? 0),
      xp: Number(account.xp ?? user.xp ?? 0),
      visits: Number(account.visits ?? user.visits ?? 0),
      bookings: Number(account.bookings ?? user.bookings ?? 0),
      avatar: account.avatar || user.avatar,
      phone: account.phone || user.phone,
      username: account.telegram || user.username
    };
  }

  function applyLive(key) {
    const selected = originalSelect(key);
    const user = liveUser(selected.key);
    const account = read("bali_points_accounts_v1", {})[user.key] || {};
    const pointsProfile = read("bali_bonus_profile_v1", {});
    write("bali_bonus_profile_v1", {
      ...pointsProfile,
      ...account,
      userKey:user.key,
      ownerKey:user.key,
      code:user.code,
      telegramId:user.telegramId,
      name:user.name,
      telegram:user.username,
      phone:user.phone,
      avatar:user.avatar,
      balance:user.balance,
      xp:user.xp,
      visits:user.visits,
      bookings:user.bookings
    });
    const gameProfile = read("bali_beta4_profile_v1", {});
    write("bali_beta4_profile_v1", {
      ...gameProfile,
      id:user.key,
      userKey:user.key,
      ownerKey:user.key,
      code:user.code,
      telegramId:user.telegramId,
      name:user.name,
      username:user.username,
      telegram:user.username,
      phone:user.phone,
      avatar:user.avatar,
      birthDate:user.birthDate,
      gender:user.gender,
      points:user.balance,
      xp:user.xp,
      visits:user.visits,
      bookings:user.bookings
    });
    return user;
  }

  demo.selectUser = applyLive;
  demo.activeUser = () => liveUser(localStorage.getItem(demo.keys.active));
  demo.reset = () => {
    originalReset();
    return applyLive(demo.users[0].key);
  };
  demo.reseed = demo.reset;
  applyLive(localStorage.getItem(demo.keys.active));
})();
