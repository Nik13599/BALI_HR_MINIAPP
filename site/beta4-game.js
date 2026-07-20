(() => {
  if (window.BaliBeta4Game) return;

  const KEYS = {
    profile: "bali_beta4_profile_v1",
    vip: "bali_beta4_vip_v1",
    config: "bali_vip_config_v1",
    achievements: "bali_beta4_achievements_v1"
  };

  const DEFAULT_CONFIG = {
    levels: [
      { id: "new", name: "New Guest", minXp: 0 },
      { id: "starter", name: "Party Starter", minXp: 500 },
      { id: "regular", name: "Night Regular", minXp: 1500 },
      { id: "insider", name: "BALI Insider", minXp: 4000 },
      { id: "legend", name: "Club Legend", minXp: 10000 }
    ],
    plans: [
      { id: "vip", name: "BALI VIP", stars: 299, days: 30, discount: 10, freeEntry: false, pointsMultiplier: 1.25, earlyBookingHours: 24, guestPasses: 0, active: true },
      { id: "black", name: "BALI BLACK", stars: 699, days: 30, discount: 20, freeEntry: true, pointsMultiplier: 1.5, earlyBookingHours: 48, guestPasses: 1, active: true },
      { id: "legend", name: "BALI LEGEND", stars: 1299, days: 30, discount: 30, freeEntry: true, pointsMultiplier: 2, earlyBookingHours: 72, guestPasses: 2, active: true }
    ],
    eventPrivileges: {}
  };

  const DEFAULT_ACHIEVEMENTS = [
    { id: "first_open", icon: "✨", title: "Добро пожаловать", description: "Открыть BALI Mini App", xp: 50, condition: "open" },
    { id: "first_booking", icon: "🪑", title: "Первый стол", description: "Создать первое бронирование", xp: 150, condition: "booking" },
    { id: "first_visit", icon: "🎟", title: "Первая ночь", description: "Отметиться на мероприятии", xp: 250, condition: "visit" },
    { id: "social", icon: "📣", title: "Амбассадор", description: "Поделиться мероприятием", xp: 80, condition: "share" },
    { id: "company", icon: "🥂", title: "Большая компания", description: "Забронировать стол на 6+ гостей", xp: 300, condition: "company" },
    { id: "vip_member", icon: "👑", title: "VIP-гость", description: "Активировать VIP-статус", xp: 500, condition: "vip" }
  ];

  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  };
  const write = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent("bali:beta4-changed", { detail: { key } }));
    return value;
  };
  const now = () => new Date().toISOString();

  function config() {
    const saved = read(KEYS.config, {});
    return {
      ...DEFAULT_CONFIG,
      ...saved,
      levels: Array.isArray(saved.levels) && saved.levels.length ? saved.levels : DEFAULT_CONFIG.levels,
      plans: Array.isArray(saved.plans) && saved.plans.length ? saved.plans : DEFAULT_CONFIG.plans,
      eventPrivileges: saved.eventPrivileges || {}
    };
  }

  function telegramUser() {
    return window.Telegram?.WebApp?.initDataUnsafe?.user || null;
  }

  function profile() {
    const saved = read(KEYS.profile, null);
    const tgUser = telegramUser();
    const pointsProfile = window.BaliPoints?.profile?.() || {};
    const base = saved || {
      id: tgUser?.id ? `tg:${tgUser.id}` : pointsProfile.userKey || `guest:${Date.now()}`,
      telegramId: tgUser?.id || pointsProfile.telegramId || null,
      name: tgUser?.first_name || pointsProfile.name || "Гость BALI",
      username: tgUser?.username ? `@${tgUser.username}` : pointsProfile.telegram || "",
      phone: pointsProfile.phone || "",
      avatar: tgUser?.photo_url || "",
      xp: 0,
      visits: 0,
      bookings: 0,
      streak: 0,
      publicRanking: true,
      createdAt: now()
    };
    const merged = {
      ...base,
      name: base.name || tgUser?.first_name || "Гость BALI",
      username: base.username || (tgUser?.username ? `@${tgUser.username}` : ""),
      avatar: base.avatar || tgUser?.photo_url || "",
      points: Number(pointsProfile.balance || base.points || 0)
    };
    if (!saved) write(KEYS.profile, merged);
    return merged;
  }

  function saveProfile(patch = {}) {
    const next = { ...profile(), ...patch, updatedAt: now() };
    write(KEYS.profile, next);
    if (window.BaliPoints?.linkIdentity) {
      window.BaliPoints.linkIdentity({ name: next.name, phone: next.phone, telegram: next.username, ownerKey: next.id });
    }
    return next;
  }

  function achievements() {
    const earned = read(KEYS.achievements, {});
    return DEFAULT_ACHIEVEMENTS.map((item) => ({ ...item, earnedAt: earned[item.id] || null }));
  }

  function awardAchievement(id) {
    const item = DEFAULT_ACHIEVEMENTS.find((row) => row.id === id);
    if (!item) return false;
    const earned = read(KEYS.achievements, {});
    if (earned[id]) return false;
    earned[id] = now();
    write(KEYS.achievements, earned);
    addXp(item.xp, `Награда: ${item.title}`);
    return true;
  }

  function addXp(amount, reason = "Активность BALI") {
    const value = Math.max(0, Number(amount || 0));
    if (!value) return profile();
    const current = profile();
    const next = saveProfile({ xp: Number(current.xp || 0) + value, lastXpReason: reason });
    return next;
  }

  function levelFor(xp = profile().xp) {
    const levels = [...config().levels].sort((a, b) => Number(a.minXp) - Number(b.minXp));
    let current = levels[0];
    for (const level of levels) if (Number(xp) >= Number(level.minXp)) current = level;
    const index = levels.findIndex((item) => item.id === current.id);
    const next = levels[index + 1] || null;
    const progress = next ? Math.max(0, Math.min(100, ((Number(xp) - Number(current.minXp)) / Math.max(1, Number(next.minXp) - Number(current.minXp))) * 100)) : 100;
    return { current, next, progress, levels };
  }

  function vip() {
    const value = read(KEYS.vip, null);
    if (!value) return null;
    if (value.expiresAt && new Date(value.expiresAt).getTime() <= Date.now()) return null;
    const plan = config().plans.find((item) => item.id === value.planId);
    return plan ? { ...value, plan } : null;
  }

  function activateVip(planId, source = "beta") {
    const plan = config().plans.find((item) => item.id === planId && item.active !== false);
    if (!plan) throw new Error("VIP-тариф не найден");
    const start = new Date();
    const expires = new Date(start.getTime() + Number(plan.days || 30) * 86400000);
    const value = { planId, source, purchasedAt: start.toISOString(), expiresAt: expires.toISOString(), stars: Number(plan.stars || 0) };
    write(KEYS.vip, value);
    awardAchievement("vip_member");
    return { ...value, plan };
  }

  function eventPrivilege(eventId) {
    const currentVip = vip();
    if (!currentVip) return null;
    const overrides = config().eventPrivileges?.[eventId]?.[currentVip.planId] || {};
    return { ...currentVip.plan, ...overrides, planId: currentVip.planId, expiresAt: currentVip.expiresAt };
  }

  function recordBooking(guests = 0) {
    const current = profile();
    saveProfile({ bookings: Number(current.bookings || 0) + 1 });
    awardAchievement("first_booking");
    if (Number(guests) >= 6) awardAchievement("company");
    addXp(120, "Бронирование стола");
  }

  function recordVisit() {
    const current = profile();
    saveProfile({ visits: Number(current.visits || 0) + 1, streak: Number(current.streak || 0) + 1, lastVisitAt: now() });
    awardAchievement("first_visit");
    addXp(250, "Посещение мероприятия");
  }

  function recordShare() {
    awardAchievement("social");
    addXp(30, "Репост мероприятия");
  }

  function ranking(accounts = []) {
    const me = profile();
    const seed = [
      { id: "demo-1", name: "ANI", username: "@ani", xp: 6250, visits: 21, avatar: "" },
      { id: "demo-2", name: "Lera Night", username: "@lera", xp: 4780, visits: 16, avatar: "" },
      { id: "demo-3", name: "Niki", username: "@niki", xp: 3320, visits: 12, avatar: "" },
      { id: "demo-4", name: "Papa Guva", username: "@papaguva", xp: 2480, visits: 10, avatar: "" },
      { id: "demo-5", name: "Mila", username: "@mila", xp: 1740, visits: 8, avatar: "" }
    ];
    const external = accounts.map((item, index) => ({
      id: item.userKey || item.id || `account-${index}`,
      name: item.name || "Гость BALI",
      username: item.telegram || "",
      xp: Number(item.xp ?? item.balance ?? 0),
      visits: Number(item.visits || 0),
      avatar: item.avatar || ""
    }));
    const rows = [...seed, ...external];
    if (me.publicRanking !== false) rows.push({ id: me.id, name: me.name, username: me.username, xp: Number(me.xp || 0), visits: Number(me.visits || 0), avatar: me.avatar, isMe: true });
    const unique = [...new Map(rows.map((item) => [item.id, item])).values()];
    return unique.sort((a, b) => Number(b.xp) - Number(a.xp)).map((item, index) => ({ ...item, position: index + 1 }));
  }

  awardAchievement("first_open");

  window.BaliBeta4Game = {
    KEYS, DEFAULT_CONFIG, DEFAULT_ACHIEVEMENTS, read, write, config, profile, saveProfile,
    achievements, awardAchievement, addXp, levelFor, vip, activateVip, eventPrivilege,
    recordBooking, recordVisit, recordShare, ranking
  };
})();