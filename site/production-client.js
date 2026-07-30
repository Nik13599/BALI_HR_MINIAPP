(() => {
  "use strict";
  if (window.BaliProduction) return;

  const state = {
    me: null,
    profile: null,
    events: [],
    bookings: [],
    menu: [],
    venue: null,
    reviews: [],
    points: { account: { balance: 0 }, ledger: [] },
    rewards: { catalog: [], rewards: [] },
    gifts: { catalog: [], received: [], sent: [] },
    vip: { plans: [], subscriptions: [] },
    shop: { items: [], orders: [] },
    notifications: { notifications: [], unread: 0 },
    game: { settings: {}, profile: {}, season: null },
    leaderboard: [],
    gamePrizes: [],
    people: [],
    social: { connections: [], conversations: [], invitations: [] },
    platform: { blocks: [], navigation: [], assets: [] },
    layouts: new Map(),
  };

  const api = async (path, options = {}) => {
    const response = await fetch(path, {
      credentials: "include",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    if (response.status === 204) return null;
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload?.error?.message || "Не удалось выполнить запрос");
      error.status = response.status;
      error.code = payload?.error?.code;
      error.details = payload?.error?.details;
      throw error;
    }
    return payload;
  };
  const post = (path, body, key = crypto.randomUUID()) => api(path, {
    method: "POST",
    headers: { "Idempotency-Key": key },
    body: JSON.stringify({ ...body, idempotencyKey: key }),
  });
  const patch = (path, body) => api(path, { method: "PATCH", body: JSON.stringify(body) });
  const dateOnly = value => value ? String(value).slice(0, 10) : "";
  const uniqueRows = (rows, key = "id") => {
    const seen = new Set();
    return (rows || []).filter(row => {
      const identity = String(row?.[key] ?? "");
      if (!identity || seen.has(identity)) return false;
      seen.add(identity);
      return true;
    });
  };
  const eventRows = rows => uniqueRows(rows).map(row => ({
    ...row,
    event_date: dateOnly(row.event_date || row.starts_at),
    event_time: row.event_time || (row.starts_at ? new Date(row.starts_at).toTimeString().slice(0, 5) : "23:00"),
  }));
  const bookingRows = rows => uniqueRows(rows).map(row => ({
    ...row,
    booking_date: dateOnly(row.event_date || row.starts_at),
    booking_time: row.event_time || (row.starts_at ? new Date(row.starts_at).toTimeString().slice(0, 5) : "23:00"),
    table_name: row.table_name || row.table_number || row.table_id,
    owner_key: row.user_key,
  }));

  async function authenticate() {
    try {
      const session = await api("/api/v1/auth/session");
      state.me = session.user;
      return session;
    } catch (error) {
      if (error.status !== 401) throw error;
      const initData = window.Telegram?.WebApp?.initData || "";
      if (!initData) throw error;
      const login = await api("/api/v1/auth/telegram", {
        method: "POST",
        body: JSON.stringify({ initData }),
      });
      state.me = login.user;
      return login;
    }
  }

  async function refreshCore() {
    const [
      profile,
      events,
      bookings,
      points,
      game,
      catalog,
      platform,
    ] = await Promise.all([
      api("/api/v1/people/me"),
      api("/api/v1/events"),
      api("/api/v1/bookings/my"),
      api("/api/v1/economy/points"),
      api("/api/v1/game"),
      api("/api/v1/catalog"),
      api("/api/v1/platform-config"),
    ]);
    state.profile = profile.profile || {};
    state.me = { ...state.me, ...state.profile };
    state.events = eventRows(events.events);
    state.bookings = bookingRows(bookings.bookings);
    state.points = points;
    state.game = game;
    state.menu = uniqueRows(catalog.menu || []);
    state.venue = catalog.venue || null;
    state.reviews = uniqueRows(catalog.reviews || []);
    state.platform = platform;
    window.dispatchEvent(new CustomEvent("bali:production-refreshed"));
    return state;
  }

  let secondaryInFlight = null;
  function refreshSecondary() {
    if (secondaryInFlight) return secondaryInFlight;
    const safe = async path => {
      try {
        return { ok: true, value: await api(path) };
      } catch (error) {
        console.warn(`Secondary BALI request failed: ${path}`, error);
        return { ok: false, value: null };
      }
    };
    secondaryInFlight = (async () => {
      const [
        people,
        rewards,
        gifts,
        vip,
        leaderboard,
        gamePrizes,
        connections,
        conversations,
        invitations,
        shop,
        notifications
      ] = await Promise.all([
        safe("/api/v1/people?limit=100"),
        safe("/api/v1/economy/rewards"),
        safe("/api/v1/economy/gifts"),
        safe("/api/v1/economy/vip"),
        safe("/api/v1/game/leaderboard"),
        safe("/api/v1/game/prizes"),
        safe("/api/v1/social/connections"),
        safe("/api/v1/social/conversations"),
        safe("/api/v1/events/invitations/me"),
        safe("/api/v1/economy/shop"),
        safe("/api/v1/notifications"),
      ]);
      if (people.ok) state.people = uniqueRows(people.value.people || [], "user_key");
      if (rewards.ok) {
        state.rewards = {
          ...rewards.value,
          catalog: uniqueRows(rewards.value.catalog || []),
          rewards: uniqueRows(rewards.value.rewards || []),
        };
      }
      if (gifts.ok) {
        state.gifts = {
          ...gifts.value,
          catalog: uniqueRows(gifts.value.catalog || []),
          received: uniqueRows(gifts.value.received || []),
          sent: uniqueRows(gifts.value.sent || []),
        };
      }
      if (vip.ok) {
        state.vip = {
          ...vip.value,
          plans: uniqueRows(vip.value.plans || []),
          subscriptions: uniqueRows(vip.value.subscriptions || []),
        };
      }
      if (leaderboard.ok) {
        state.leaderboard = uniqueRows(leaderboard.value.leaderboard || [], "user_key");
      }
      if (gamePrizes.ok) {
        state.gamePrizes = uniqueRows(gamePrizes.value.prizes || []);
      }
      state.social = {
        connections: connections.ok
          ? uniqueRows(connections.value.connections || [])
          : state.social.connections,
        conversations: conversations.ok
          ? uniqueRows(conversations.value.conversations || [])
          : state.social.conversations,
        invitations: invitations.ok
          ? uniqueRows(invitations.value.invitations || [])
          : state.social.invitations,
      };
      if (shop.ok) {
        state.shop = {
          items: uniqueRows(shop.value.items || []),
          orders: uniqueRows(shop.value.orders || []),
        };
      }
      if (notifications.ok) {
        state.notifications = {
          notifications: uniqueRows(notifications.value.notifications || []),
          unread: Number(notifications.value.unread || 0),
        };
      }
      window.dispatchEvent(new CustomEvent("bali:production-refreshed"));
      return state;
    })().finally(() => {
      secondaryInFlight = null;
    });
    return secondaryInFlight;
  }

  let refreshQueue = Promise.resolve(state);
  function refresh() {
    refreshQueue = refreshQueue
      .catch(() => state)
      .then(async () => {
        await refreshCore();
        await refreshSecondary();
        return state;
      });
    return refreshQueue;
  }

  async function eventLayout(eventId) {
    if (!state.layouts.has(eventId)) {
      state.layouts.set(eventId, api(`/api/v1/events/${encodeURIComponent(eventId)}/layout`));
    }
    try {
      return await state.layouts.get(eventId);
    } catch (error) {
      state.layouts.delete(eventId);
      throw error;
    }
  }

  const BaliStore = {
    mode: "production-api",
    cloudEnabled: true,
    databaseEnabled: true,
    client: null,
    async list(table, options = {}) {
      const mapping = {
        events: state.events,
        menu_items: state.menu,
        bookings: state.bookings,
        customers: [],
        venue_content: state.venue ? [state.venue] : [],
        reviews: state.reviews,
        hall_tables: [...state.layouts.values()].flatMap(() => []),
      };
      let rows = [...(mapping[table] || [])];
      if (options.filters) {
        for (const [field, value] of Object.entries(options.filters)) {
          rows = rows.filter(row => String(row?.[field] ?? "") === String(value ?? ""));
        }
      }
      const order = options.order || "sort_order";
      const direction = options.ascending === false ? -1 : 1;
      return rows.sort((left, right) => String(left?.[order] ?? "").localeCompare(
        String(right?.[order] ?? ""),
        "ru",
        { numeric: true }
      ) * direction);
    },
    async getAvailability(date) {
      const event = state.events.find(row => row.event_date === date);
      if (!event) return [];
      const layout = await eventLayout(event.id);
      return (layout.tables || []).map(table => ({
        ...table,
        name: table.name || `Стол ${table.table_number}`,
        seats: table.capacity,
        available: ["available", "vip", "clan", "selected"].includes(table.availability_status),
      }));
    },
    async createBooking(data = {}) {
      const hold = await post("/api/v1/bookings/holds", {
        eventId: data.event_id,
        tableId: data.table_id,
        clanId: data.clan_id || undefined,
      });
      const result = await post("/api/v1/bookings", {
        holdId: hold.hold.id,
        customerName: data.name,
        phone: data.phone,
        guests: Number(data.guests || 1),
        comment: data.comment || "",
        consentAccepted: true,
      });
      state.layouts.delete(data.event_id);
      await refresh();
      return bookingRows([result.booking])[0];
    },
    async save(table, row) {
      if (table === "bookings" && row?.id) {
        if (row.status === "cancelled") {
          const result = await post(`/api/v1/bookings/${encodeURIComponent(row.id)}/cancel`, {
            reason: row.cancel_reason || "Отменено пользователем",
          });
          if (row.event_id) state.layouts.delete(row.event_id);
          await refresh();
          return bookingRows([result.booking])[0];
        }
        return row;
      }
      if (table === "reviews") {
        const result = await post("/api/v1/catalog/reviews", {
          rating: Number(row.rating || 5),
          body: row.body || row.text || row.comment || "",
        });
        await refresh();
        return result.review;
      }
      throw new Error("Изменение этого раздела доступно только через админку BALI");
    },
    async remove() {
      throw new Error("Удаление доступно только через админку BALI");
    },
    async signOut() {
      await api("/api/v1/auth/logout", { method: "POST" });
      location.reload();
    },
    async getSession() {
      return api("/api/v1/auth/session");
    },
    async signIn() {
      return authenticate();
    },
  };

  const currentProfile = () => {
    const details = state.profile?.details || {};
    return {
      id: state.me?.id || state.profile?.id || "",
      userKey: state.me?.id || state.profile?.id || "",
      ownerKey: state.me?.id || state.profile?.id || "",
      code: state.me?.id || state.profile?.id || "",
      name: state.profile?.name || details.display_name || state.me?.name || "Гость BALI",
      username: state.profile?.username || state.me?.username || "",
      phone: state.profile?.phone || details.phone || "",
      avatar: state.profile?.avatar || details.avatar_url || "",
      balance: Number(state.points?.account?.balance || 0),
      xp: Number(state.game?.profile?.xp || 0),
      visits: Number(state.profile?.visits || 0),
      bookings: state.bookings.length,
      streak: 0,
      publicRanking: true,
    };
  };
  const pointLedger = () => (state.points?.ledger || []).map(row => ({
    ...row,
    userKey: row.user_key,
    amount: Number(row.amount),
    title: row.reason || row.source_type,
    createdAt: row.created_at,
  }));
  const pointAccounts = () => Object.fromEntries(state.leaderboard.map(row => [
    row.user_key,
    {
      userKey: row.user_key,
      name: row.name,
      avatar: row.avatar,
      xp: Number(row.score),
      balance: Number(row.score),
    },
  ]));
  const BaliPoints = {
    profile: currentProfile,
    ledger: pointLedger,
    accounts: pointAccounts,
    settings: () => ({}),
    actions: () => ({}),
    visits: () => [],
    read: (_key, fallback) => fallback,
    write: (_key, value) => value,
    saveAccount: value => value,
    linkIdentity: value => ({ ...currentProfile(), ...value }),
    add: () => false,
    adjustAccount: () => ({ ok: false, message: "Баллы изменяются только сервером" }),
    redeemVisit: () => ({ ok: false, message: "Используйте QR-код BALI" }),
    accountKey: value => value?.userKey || "",
  };

  const vipPlans = () => (state.vip?.plans || []).map(plan => ({
    id: plan.id,
    name: plan.name,
    stars: Number(plan.points_cost || 0),
    days: Number(plan.duration_days),
    discount: 0,
    freeEntry: false,
    pointsMultiplier: Number(plan.points_multiplier || 1),
    earlyBookingHours: Number(plan.booking_priority || 0),
    guestPasses: 0,
    active: plan.active !== false,
    benefits: plan.benefits || [],
  }));
  const activeVip = () => {
    const subscription = (state.vip?.subscriptions || []).find(row =>
      ["active", "scheduled"].includes(row.status) && new Date(row.ends_at).getTime() > Date.now()
    );
    if (!subscription) return null;
    const plan = vipPlans().find(row => row.id === subscription.plan_id);
    return plan ? {
      id: subscription.id,
      planId: subscription.plan_id,
      plan,
      source: subscription.source_type,
      expiresAt: subscription.ends_at,
    } : null;
  };
  const levels = [
    { id: "new", name: "New Guest", minXp: 0 },
    { id: "starter", name: "Party Starter", minXp: 500 },
    { id: "regular", name: "Night Regular", minXp: 1500 },
    { id: "insider", name: "BALI Insider", minXp: 4000 },
    { id: "legend", name: "Club Legend", minXp: 10000 },
  ];
  const achievements = () => (state.rewards?.catalog || []).map(reward => {
    const earned = (state.rewards?.rewards || []).find(row => row.reward_id === reward.id);
    return {
      id: reward.id,
      icon: reward.icon_url || "★",
      title: reward.name,
      description: reward.description,
      xp: Number(reward.xp || 0),
      earnedAt: earned?.granted_at || null,
    };
  });
  const BaliBeta4Game = {
    config: () => ({ levels, plans: vipPlans(), eventPrivileges: {} }),
    saveConfig: value => value,
    profile: currentProfile,
    saveProfile(patchValue = {}) {
      state.profile = { ...state.profile, ...patchValue };
      patch("/api/v1/people/me", {
        displayName: patchValue.name,
        phone: patchValue.phone,
        avatarUrl: patchValue.avatar,
        statusText: patchValue.statusText,
        bio: patchValue.bio,
        interests: patchValue.interests,
        gender: patchValue.gender,
        birthDate: patchValue.birthDate,
      }).then(refresh).catch(console.error);
      return currentProfile();
    },
    identityKeys: subject => [subject?.id, subject?.userKey, subject?.ownerKey, subject?.code].filter(Boolean),
    achievements,
    awardAchievement: () => false,
    addXp: () => currentProfile(),
    levelFor(xp = currentProfile().xp) {
      let current = levels[0];
      for (const level of levels) if (Number(xp) >= level.minXp) current = level;
      const index = levels.findIndex(level => level.id === current.id);
      const next = levels[index + 1] || null;
      const progress = next
        ? Math.max(0, Math.min(100, ((Number(xp) - current.minXp) / (next.minXp - current.minXp)) * 100))
        : 100;
      return { current, next, progress, levels };
    },
    vip: activeVip,
    vipGifts: () => [],
    giftVip: () => null,
    revokeGift: () => null,
    activateVip(planId) {
      post("/api/v1/economy/vip/purchase", { planId }).then(refresh).catch(console.error);
      return { planId, plan: vipPlans().find(row => row.id === planId) };
    },
    eventPrivilege: () => null,
    recordBooking: () => refresh().catch(console.error),
    recordVisit: () => refresh().catch(console.error),
    recordShare: () => undefined,
    ranking() {
      return state.leaderboard.map(row => ({
        id: row.user_key,
        name: row.name,
        avatar: row.avatar,
        xp: Number(row.score),
        position: Number(row.position),
        isMe: row.user_key === currentProfile().id,
      }));
    },
  };

  const socialProfile = row => ({
    id: row.id,
    name: row.name,
    username: row.username || "",
    photo: row.avatar || "",
    status: row.status || "",
    bio: row.bio || "",
    active: true,
    showPhoto: Boolean(row.avatar),
    actions: row.actions || {},
  });
  const socialGiftCatalog = () => (state.gifts?.catalog || []).map(row => ({
    id: row.id,
    icon: row.image_url || "🎁",
    name: row.name,
    stars: Number(row.points_cost),
    active: row.active !== false,
    sortOrder: Number(row.sort_order),
  }));
  const socialState = { requests: [] };
  const BaliBeta4Social = {
    KEYS: {},
    LEGACY_STATUSES: [],
    statusText: value => String(value || ""),
    DEFAULT_GIFT_CATALOG: [],
    get GIFT_CATALOG() { return socialGiftCatalog(); },
    saveGiftCatalog: () => socialGiftCatalog(),
    profile: () => socialProfile(state.profile || currentProfile()),
    saveProfile(value) {
      BaliBeta4Game.saveProfile({
        name: value.name,
        avatar: value.photo,
        statusText: value.status,
        bio: value.bio,
      });
      return { ...this.profile(), ...value };
    },
    people: () => [socialProfile(state.profile || currentProfile()), ...state.people.map(socialProfile)],
    visiblePeople: () => state.people.map(socialProfile),
    requests: () => socialState.requests,
    sendRequest(targetId, type, event) {
      if (type !== "event" || !event?.id) return { ok: false, message: "Выберите мероприятие" };
      const optimistic = { id: crypto.randomUUID(), toId: targetId, eventId: event.id, status: "pending" };
      socialState.requests.unshift(optimistic);
      post(`/api/v1/events/${encodeURIComponent(event.id)}/invitations`, {
        recipientUserKey: targetId,
      }).then(refresh).catch(console.error);
      return { ok: true, item: optimistic };
    },
    respond: () => null,
    eventEndAt: event => event?.ends_at || event?.event_date || "",
    requestEndAt: request => request?.eventEndAt || "",
    isRequestActive: () => true,
    activeIncomingRequests: () => [],
    gifts: () => [...(state.gifts.received || []), ...(state.gifts.sent || [])],
    incomingGifts: () => state.gifts.received || [],
    recordGift(targetId, giftId) {
      post("/api/v1/economy/gifts", {
        catalogItemId: giftId,
        recipientUserKey: targetId,
        message: "",
      }).then(refresh).catch(console.error);
      return { id: crypto.randomUUID(), toId: targetId, giftId };
    },
    adminGift: () => ({ ok: false, message: "Доступно только администратору" }),
    removeGift: () => ({ ok: false, message: "Подарок нельзя удалить" }),
    myId: () => currentProfile().id,
  };

  const matchConfig = () => {
    const symbols = Array.isArray(state.game?.settings?.symbols) ? state.game.settings.symbols : [];
    const defaults = [
      ["headphones", "Наушники", "/site/assets/match3/headphones.webp"],
      ["martini", "BALI Martini", "/site/assets/match3/martini.webp"],
      ["palm", "Пальма", "/site/assets/match3/palm.webp"],
      ["turntable", "Винил", "/site/assets/match3/turntable.webp"],
      ["disco", "Диско-шар", "/site/assets/match3/disco.webp"],
      ["mask", "Маска", "/site/assets/match3/mask.webp"],
      ["lotus", "Лотос", "/site/assets/match3/lotus.webp"],
      ["triangle", "Портал", "/site/assets/match3/triangle.webp"],
    ];
    return {
      enabled: true,
      title: "BALI Match",
      subtitle: "Недельная игра клуба",
      boardSize: 7,
      startingMoves: 24,
      targetScore: 25000,
      resetDay: 1,
      backgroundImage: "/site/assets/match3/background.webp",
      rewardImage: "/site/assets/match3/reward.webp",
      boosters: { bomb: 3, shuffle: 3, hint: 3, extraMoves: 1 },
      tiles: defaults.map(([id, name, image]) => {
        const custom = symbols.find(row => row.key === id);
        return {
          id,
          name: custom?.label || name,
          image: custom?.imageUrl || custom?.defaultImageUrl || image,
          active: custom?.active !== false,
        };
      }),
      rewards: (state.game?.settings?.default_prizes || []).map((reward, index) => ({
        position: Number(reward.position || index + 1),
        points: Number(reward.points || 0),
        xp: Number(reward.xp || 0),
        reward: Array.isArray(reward.rewardIds) && reward.rewardIds.length
          ? reward.rewardIds.join(", ")
          : "Награда BALI Match",
        vipPlan: reward.vipPlanId || "",
        vipDays: Number(reward.vipDays || 0),
      })),
    };
  };
  let activeGameSession = null;
  let activeGameSessionPromise = null;
  const startGameSession = () => {
    if (activeGameSession) return Promise.resolve(activeGameSession);
    if (activeGameSessionPromise) return activeGameSessionPromise;
    const startKey = crypto.randomUUID();
    activeGameSessionPromise = post(
      "/api/v1/game/sessions",
      { deviceHash: navigator.userAgent },
      startKey,
    )
      .then(result => {
        activeGameSession = result.session;
        return activeGameSession;
      })
      .catch(error => {
        if (error?.code === "active_game_exists" && error?.details?.gameSessionId) {
          activeGameSession = { id: error.details.gameSessionId };
          return activeGameSession;
        }
        throw error;
      })
      .finally(() => {
        activeGameSessionPromise = null;
      });
    return activeGameSessionPromise;
  };
  const BaliMatch3 = {
    KEYS: {},
    config: matchConfig,
    weekInfo: () => {
      const startsAt = new Date(state.game?.season?.starts_at || Date.now()).getTime();
      const endsAt = new Date(state.game?.season?.ends_at || Date.now()).getTime();
      return {
        key: state.game?.season?.id || "weekly",
        startsAt,
        endsAt,
        label: `${new Date(startsAt).toLocaleDateString("ru-RU")} — ${new Date(endsAt).toLocaleDateString("ru-RU")}`,
      };
    },
    leaderboard: () => state.leaderboard.map(row => ({
      userKey: row.user_key,
      name: row.name,
      avatar: row.avatar,
      score: Number(row.score),
      position: Number(row.position),
      attempts: Number(row.attempts || 1),
      isMe: String(row.user_key) === String(currentProfile().id),
    })),
    myRewards: () => state.gamePrizes.map(prize => {
      const payload = prize.reward_payload || {};
      return {
        position: Number(prize.position),
        points: Number(payload.points || 0),
        reward: Array.isArray(payload.rewardIds) && payload.rewardIds.length
          ? payload.rewardIds.join(", ")
          : "Награда BALI Match",
        vipPlan: payload.vipPlanId || "",
        vipDays: Number(payload.vipDays || 0),
        awardedAt: prize.issued_at || prize.created_at,
      };
    }),
    startSession() {
      startGameSession().catch(console.error);
    },
    submitScore(score, details = {}) {
      if (!details.completed) return { ok: true, score: Number(score || 0) };
      startGameSession()
        .then(session => post(`/api/v1/game/sessions/${session.id}/finish`, {
          score: Math.max(0, Math.floor(Number(score || 0))),
          bestCombo: Math.max(0, Math.floor(Number(details.bestCombo || 0))),
          durationSeconds: Math.max(0, Math.floor(Number(details.durationSeconds || 0))),
        }))
        .then(async result => {
          activeGameSession = null;
          await refresh();
          return result;
        })
        .catch(console.error);
      return { ok: true, score: Number(score || 0) };
    },
  };

  const BaliClans = Object.freeze({
    mode: "production-api",
    api,
    currentUser: () => ({
      id: currentProfile().id,
      userKey: currentProfile().id,
      telegramUserId: state.me?.telegramUserId || state.me?.telegram_user_id || null,
      name: currentProfile().name,
      username: currentProfile().username,
    }),
  });

  async function bootstrap() {
    const tg = window.Telegram?.WebApp;
    try {
      tg?.ready();
      tg?.expand();
      tg?.requestFullscreen?.();
      tg?.setHeaderColor?.("#080a0a");
      tg?.setBackgroundColor?.("#080a0a");
    } catch {
      // Older Telegram clients may not expose every fullscreen/color method.
    }
    await authenticate();
    await refreshCore();
    window.BaliStore = Object.freeze(BaliStore);
    window.BaliPoints = BaliPoints;
    window.BaliBeta4Game = BaliBeta4Game;
    window.BaliBeta4Social = BaliBeta4Social;
    window.BaliMatch3 = BaliMatch3;
    window.BaliClans = BaliClans;
    window.BALI_CONFIG = Object.freeze({
      mode: "production",
      demoOnly: false,
      databaseEnabled: true,
      externalAuthEnabled: true,
      venueName: state.venue?.title || "BALI Minsk",
    });
    return state;
  }

  window.BaliProduction = {
    state,
    api,
    post,
    patch,
    authenticate,
    refresh,
    refreshCore,
    refreshSecondary,
    eventLayout,
    bootstrap,
  };
})();
