(() => {
  if (window.BaliMatch3) return;

  const KEYS = {
    config: "bali_match3_config_v1",
    scores: "bali_match3_weekly_scores_v1",
    grants: "bali_match3_weekly_grants_v1",
    archive: "bali_match3_weekly_archive_v1",
  };

  const DEFAULT_TILES = [
    { id: "headphones", name: "Неоновые наушники", image: "./assets/match3/headphones.webp", active: true },
    { id: "martini", name: "BALI Martini", image: "./assets/match3/martini.webp", active: true },
    { id: "palm", name: "Золотая пальма", image: "./assets/match3/palm.webp", active: true },
    { id: "turntable", name: "DJ-проигрыватель", image: "./assets/match3/turntable.webp", active: true },
    { id: "disco", name: "Диско-шар", image: "./assets/match3/disco.webp", active: true },
    { id: "mask", name: "Маска BALI", image: "./assets/match3/mask.webp", active: true },
    { id: "lotus", name: "Неоновый лотос", image: "./assets/match3/lotus.webp", active: true },
    { id: "triangle", name: "Ночной портал", image: "./assets/match3/triangle.webp", active: true },
  ];

  const DEFAULT_REWARDS = [
    { position: 1, points: 3000, xp: 750, reward: "Легендарный сундук", vipPlan: "legend", vipDays: 7 },
    { position: 2, points: 2200, xp: 600, reward: "Платиновый сундук", vipPlan: "black", vipDays: 7 },
    { position: 3, points: 1600, xp: 500, reward: "Золотой сундук", vipPlan: "vip", vipDays: 7 },
    { position: 4, points: 1200, xp: 400, reward: "Неоновая награда", vipPlan: "", vipDays: 0 },
    { position: 5, points: 1000, xp: 350, reward: "Неоновая награда", vipPlan: "", vipDays: 0 },
    { position: 6, points: 800, xp: 300, reward: "Награда TOP 10", vipPlan: "", vipDays: 0 },
    { position: 7, points: 700, xp: 250, reward: "Награда TOP 10", vipPlan: "", vipDays: 0 },
    { position: 8, points: 600, xp: 220, reward: "Награда TOP 10", vipPlan: "", vipDays: 0 },
    { position: 9, points: 500, xp: 200, reward: "Награда TOP 10", vipPlan: "", vipDays: 0 },
    { position: 10, points: 400, xp: 180, reward: "Награда TOP 10", vipPlan: "", vipDays: 0 },
  ];

  const DEFAULT_CONFIG = {
    enabled: true,
    title: "BALI Match",
    subtitle: "Недельная игра клуба",
    boardSize: 7,
    startingMoves: 24,
    targetScore: 25000,
    resetDay: 1,
    backgroundImage: "./assets/match3/background.webp",
    rewardImage: "./assets/match3/reward.webp",
    boosters: { bomb: 3, shuffle: 3, hint: 3, extraMoves: 1 },
    tiles: DEFAULT_TILES,
    rewards: DEFAULT_REWARDS,
  };

  const SEED_PLAYERS = [
    { userKey: "match3-demo-neon", name: "NEON QUEEN", avatar: "", score: 48750 },
    { userKey: "match3-demo-sunset", name: "DJ SUNSET", avatar: "", score: 35210 },
    { userKey: "match3-demo-boy", name: "BALI BOY", avatar: "", score: 28975 },
    { userKey: "match3-demo-luna", name: "LUNA PINK", avatar: "", score: 11860 },
    { userKey: "match3-demo-vibe", name: "VIBE MASTER", avatar: "", score: 10640 },
    { userKey: "match3-demo-mila", name: "MILA NIGHT", avatar: "", score: 9320 },
    { userKey: "match3-demo-niki", name: "NIKI", avatar: "", score: 8110 },
    { userKey: "match3-demo-alex", name: "ALEX BASS", avatar: "", score: 7350 },
    { userKey: "match3-demo-sky", name: "PURPLE SKY", avatar: "", score: 6820 },
  ];

  const read = (key, fallback) => {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  };

  const write = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent("bali:match3-changed", { detail: { key } }));
    return value;
  };

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const now = () => new Date().toISOString();
  const uid = (prefix) => `${prefix}-${crypto.randomUUID?.() || Date.now()}`;

  function normalizeTiles(rows) {
    const fallback = clone(DEFAULT_TILES);
    if (!Array.isArray(rows) || rows.length < 5) return fallback;
    const normalized = rows.map((row, index) => ({
      id: String(row.id || `tile-${index + 1}`).replace(/[^a-z0-9_-]/gi, "-"),
      name: String(row.name || `Предмет ${index + 1}`).trim(),
      image: String(row.image || "").trim(),
      active: row.active !== false,
    }));
    return normalized.filter((row) => row.active && row.image).length >= 5 ? normalized : fallback;
  }

  function normalizeRewards(rows) {
    const source = Array.isArray(rows) && rows.length ? rows : DEFAULT_REWARDS;
    return Array.from({ length: 10 }, (_, index) => {
      const position = index + 1;
      const fallback = DEFAULT_REWARDS[index];
      const row = source.find((item) => Number(item.position) === position) || fallback;
      return {
        position,
        points: Math.max(0, Number(row.points ?? fallback.points)),
        xp: Math.max(0, Number(row.xp ?? fallback.xp)),
        reward: String(row.reward ?? fallback.reward).trim(),
        vipPlan: ["vip", "black", "legend"].includes(row.vipPlan) ? row.vipPlan : "",
        vipDays: Math.max(0, Number(row.vipDays || 0)),
      };
    });
  }

  function config() {
    const saved = read(KEYS.config, {});
    return {
      ...DEFAULT_CONFIG,
      ...saved,
      boardSize: Math.max(6, Math.min(8, Number(saved.boardSize || DEFAULT_CONFIG.boardSize))),
      startingMoves: Math.max(5, Math.min(99, Number(saved.startingMoves || DEFAULT_CONFIG.startingMoves))),
      targetScore: Math.max(1000, Number(saved.targetScore || DEFAULT_CONFIG.targetScore)),
      resetDay: Math.max(0, Math.min(6, Number(saved.resetDay ?? DEFAULT_CONFIG.resetDay))),
      boosters: { ...DEFAULT_CONFIG.boosters, ...(saved.boosters || {}) },
      tiles: normalizeTiles(saved.tiles),
      rewards: normalizeRewards(saved.rewards),
    };
  }

  function saveConfig(patch = {}) {
    const next = { ...config(), ...patch };
    if (patch.boosters) next.boosters = { ...config().boosters, ...patch.boosters };
    if (patch.tiles) next.tiles = normalizeTiles(patch.tiles);
    if (patch.rewards) next.rewards = normalizeRewards(patch.rewards);
    return write(KEYS.config, next);
  }

  function resetTiles() {
    return saveConfig({ tiles: clone(DEFAULT_TILES) });
  }

  function resetRewards() {
    return saveConfig({ rewards: clone(DEFAULT_REWARDS) });
  }

  function startOfWeek(input = new Date(), resetDay = config().resetDay) {
    const date = new Date(input);
    date.setHours(0, 0, 0, 0);
    const delta = (date.getDay() - resetDay + 7) % 7;
    date.setDate(date.getDate() - delta);
    return date;
  }

  function weekInfo(input = new Date()) {
    const start = startOfWeek(input);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const id = start.toISOString().slice(0, 10);
    return {
      id,
      start: start.toISOString(),
      end: end.toISOString(),
      endsAt: end.getTime(),
      label: `${start.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" })} — ${new Date(end.getTime() - 1).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" })}`,
    };
  }

  function player() {
    const profile = window.BaliBeta4Game?.profile?.() || window.BaliPoints?.profile?.() || {};
    return {
      userKey: String(profile.userKey || profile.id || profile.code || "match3-current-user"),
      name: String(profile.name || "Гость BALI"),
      avatar: String(profile.avatar || ""),
    };
  }

  function allScores() {
    return read(KEYS.scores, {});
  }

  function seedWeek(weekId = weekInfo().id) {
    const scores = allScores();
    if (Array.isArray(scores[weekId]) && scores[weekId].length) return scores[weekId];
    const me = player();
    scores[weekId] = [
      ...SEED_PLAYERS.map((row) => ({ ...row, weekId, attempts: 4, updatedAt: now() })),
      { ...me, weekId, score: 12450, attempts: 1, updatedAt: now(), isMe: true },
    ];
    write(KEYS.scores, scores);
    return scores[weekId];
  }

  function leaderboard(weekId = weekInfo().id) {
    const me = player();
    const rows = seedWeek(weekId).map((row) => ({
      ...row,
      score: Math.max(0, Number(row.score || 0)),
      attempts: Math.max(0, Number(row.attempts || 0)),
      isMe: String(row.userKey) === me.userKey,
    }));
    const uniqueByUser = new Map();
    for (const row of rows) {
      const key = String(row.userKey);
      const previous = uniqueByUser.get(key);
      const newer = String(row.updatedAt || "") > String(previous?.updatedAt || "");
      if (!previous || row.score > previous.score || (row.score === previous.score && newer)) uniqueByUser.set(key, row);
    }
    const unique = [...uniqueByUser.values()];
    return unique
      .sort((a, b) => Number(b.score) - Number(a.score) || String(a.updatedAt).localeCompare(String(b.updatedAt)))
      .map((row, index) => ({ ...row, position: index + 1 }));
  }

  function submitScore(score, details = {}) {
    const week = weekInfo();
    const scores = allScores();
    const rows = Array.isArray(scores[week.id]) ? scores[week.id] : seedWeek(week.id);
    const me = player();
    const index = rows.findIndex((row) => String(row.userKey) === me.userKey);
    const previous = index >= 0 ? rows[index] : { ...me, weekId: week.id, score: 0, attempts: 0 };
    const value = Math.max(0, Math.round(Number(score || 0)));
    const next = {
      ...previous,
      ...me,
      score: Math.max(Number(previous.score || 0), value),
      lastScore: value,
      attempts: Number(previous.attempts || 0) + (details.completed ? 1 : 0),
      bestCombo: Math.max(Number(previous.bestCombo || 0), Number(details.bestCombo || 0)),
      updatedAt: now(),
    };
    if (index >= 0) rows[index] = next;
    else rows.push(next);
    scores[week.id] = rows;
    write(KEYS.scores, scores);
    return {
      row: leaderboard(week.id).find((item) => item.userKey === me.userKey),
      isNewBest: value > Number(previous.score || 0),
      previousBest: Number(previous.score || 0),
    };
  }

  function rewardForPosition(position) {
    return config().rewards.find((row) => Number(row.position) === Number(position)) || null;
  }

  function grants() {
    return read(KEYS.grants, []);
  }

  function finalizeWeek(weekId = weekInfo().id) {
    const rows = leaderboard(weekId).slice(0, 10);
    const existing = grants();
    const points = window.BaliPoints;
    const game = window.BaliBeta4Game;
    const current = player();
    const awarded = [];

    for (const row of rows) {
      const reward = rewardForPosition(row.position);
      if (!reward) continue;
      const grantId = `${weekId}:${row.userKey}:${row.position}`;
      if (existing.some((item) => item.id === grantId)) continue;
      const grant = {
        id: grantId,
        weekId,
        userKey: row.userKey,
        userName: row.name,
        position: row.position,
        score: row.score,
        ...reward,
        awardedAt: now(),
      };
      existing.unshift(grant);
      awarded.push(grant);

      const isCurrent = String(row.userKey) === current.userKey;
      const account = points?.accounts?.()?.[row.userKey] || (isCurrent ? points?.profile?.() : null);
      if (reward.points > 0 && account) {
        points.adjustAccount(account, reward.points, `BALI Match · ${row.position} место · неделя ${weekId}`);
      }
      if (isCurrent && reward.xp > 0) game?.addXp?.(reward.xp, `BALI Match · ${reward.reward}`);
      if (isCurrent && reward.vipPlan && reward.vipDays > 0) {
        try {
          game?.activateVip?.(reward.vipPlan, "match3_weekly", reward.vipDays);
        } catch {}
      }
    }

    write(KEYS.grants, existing.slice(0, 1000));
    const archive = read(KEYS.archive, {});
    const previousArchive = archive[weekId] || {};
    const archivedGrants = [...(previousArchive.grants || []), ...awarded];
    archive[weekId] = {
      finalizedAt: previousArchive.finalizedAt || now(),
      lastCheckedAt: now(),
      leaderboard: rows,
      grants: [...new Map(archivedGrants.map((row) => [row.id, row])).values()],
    };
    write(KEYS.archive, archive);
    return awarded;
  }

  function myRewards() {
    const keys = new Set(window.BaliBeta4Game?.identityKeys?.(window.BaliBeta4Game.profile()) || [player().userKey]);
    return grants().filter((row) => keys.has(String(row.userKey)));
  }

  function resetCurrentWeek() {
    const week = weekInfo();
    const scores = allScores();
    delete scores[week.id];
    write(KEYS.scores, scores);
    return seedWeek(week.id);
  }

  function rollover() {
    const current = weekInfo().id;
    const archive = read(KEYS.archive, {});
    for (const weekId of Object.keys(allScores())) {
      if (weekId < current && !archive[weekId]) finalizeWeek(weekId);
    }
    seedWeek(current);
    const scores = allScores();
    const retainedWeeks = Object.keys(scores).sort().reverse().slice(0, 26);
    if (Object.keys(scores).length > retainedWeeks.length) {
      write(KEYS.scores, Object.fromEntries(retainedWeeks.map((weekId) => [weekId, scores[weekId]])));
    }
  }

  rollover();

  window.BaliMatch3 = {
    KEYS,
    DEFAULT_CONFIG,
    DEFAULT_TILES,
    DEFAULT_REWARDS,
    read,
    write,
    config,
    saveConfig,
    resetTiles,
    resetRewards,
    weekInfo,
    player,
    allScores,
    leaderboard,
    submitScore,
    rewardForPosition,
    grants,
    finalizeWeek,
    myRewards,
    resetCurrentWeek,
    rollover,
    uid,
  };
})();
