if (typeof window !== "undefined" && !window.BaliMatch3InfiniteEngine && typeof require === "function") {
  try { require("./match3-infinite-engine-beta4.js"); } catch {}
}

(() => {
  "use strict";
  if (window.BaliMatch3 || !window.BaliMatch3InfiniteEngine) return;

  const engine = window.BaliMatch3InfiniteEngine;
  const KEYS = {
    config: "bali_match3_config_v1",
    scores: "bali_match3_weekly_scores_v1",
    grants: "bali_match3_weekly_grants_v1",
    archive: "bali_match3_weekly_archive_v1",
    progress: "bali_match3_infinite_progress_v1",
    attempts: "bali_match3_level_attempts_v1",
    clanRounds: "bali_match3_clan_rounds_v1",
  };

  const DEFAULT_TILES = [
    ["headphones", "Неоновые наушники", "./assets/match3/headphones.webp"],
    ["martini", "BALI Martini", "./assets/match3/martini.webp"],
    ["palm", "Золотая пальма", "./assets/match3/palm.webp"],
    ["turntable", "DJ-проигрыватель", "./assets/match3/turntable.webp"],
    ["disco", "Диско-шар", "./assets/match3/disco.webp"],
    ["mask", "Маска BALI", "./assets/match3/mask.webp"],
    ["lotus", "Неоновый лотос", "./assets/match3/lotus.webp"],
    ["triangle", "Ночной портал", "./assets/match3/triangle.webp"],
  ].map(([id, name, image]) => ({
    id,
    name,
    image,
    originalAsset: image,
    activeAsset: image,
    customAsset: "",
    active: true,
    versions: [],
  }));

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
    subtitle: "Бесконечная сезонная игра",
    boardSize: 6,
    startingMoves: 25,
    targetScore: 10000,
    resetDay: 1,
    backgroundImage: "./assets/match3/background.webp",
    rewardImage: "./assets/match3/reward.webp",
    levelRules: {
      ...engine.DEFAULT_RULES.level,
      rows: 6,
      columns: 6,
    },
    scoringRules: { ...engine.DEFAULT_RULES.scoring },
    ratingRules: { ...engine.DEFAULT_RULES.rating },
    economy: {
      firstCompletion: 20,
      starRewards: [0, 5, 10, 20],
      cleanCompletion: 10,
      replayFraction: 0.25,
      continueMoves: 5,
      continueCosts: [40, 80],
      boosterCosts: { shuffle: 25, remove: 35, bomb: 45, removeType: 60, hint: 10 },
      lifeCost: 50,
      fullLivesCost: 180,
    },
    lives: { maximum: 5, restoreMinutes: 30 },
    boosters: { bomb: 1, shuffle: 1, hint: 2, remove: 0, removeType: 0 },
    season: {
      name: "Ночной сезон BALI",
      description: "Бесконечные уровни, личный и клановый рейтинги",
      progressMode: "account_keep_season_reset",
      frozen: false,
      bestClanRounds: 4,
    },
    clanRules: {
      minimumMembers: 5,
      maximumMembers: 30,
      transitionLockHours: 72,
      taskRatingBonusLimit: 0.1,
      minimumLevelsForChest: 3,
      chestMilestones: [25, 50, 75, 100],
    },
    tiles: DEFAULT_TILES,
    rewards: DEFAULT_REWARDS,
  };

  const SEED_PLAYERS = [
    { userKey: "match3-demo-neon", name: "NEON QUEEN", avatar: "", score: 48750, level: 38, threeStars: 21 },
    { userKey: "match3-demo-sunset", name: "DJ SUNSET", avatar: "", score: 35210, level: 31, threeStars: 17 },
    { userKey: "match3-demo-boy", name: "BALI BOY", avatar: "", score: 28975, level: 27, threeStars: 12 },
    { userKey: "match3-demo-luna", name: "LUNA PINK", avatar: "", score: 11860, level: 14, threeStars: 6 },
    { userKey: "match3-demo-vibe", name: "VIBE MASTER", avatar: "", score: 10640, level: 13, threeStars: 5 },
    { userKey: "match3-demo-mila", name: "MILA NIGHT", avatar: "", score: 9320, level: 11, threeStars: 4 },
    { userKey: "match3-demo-niki", name: "NIKI", avatar: "", score: 8110, level: 10, threeStars: 4 },
    { userKey: "match3-demo-alex", name: "ALEX BASS", avatar: "", score: 7350, level: 9, threeStars: 3 },
    { userKey: "match3-demo-sky", name: "PURPLE SKY", avatar: "", score: 6820, level: 8, threeStars: 3 },
  ];

  const CLAN_SEEDS = [
    { id: "clan-neon", name: "NEON FAMILY", members: 8, active: 7, total: 122400, median: 14320 },
    { id: "clan-bali", name: "BALI PEOPLE", members: 12, active: 10, total: 174000, median: 13250 },
    { id: "clan-sunset", name: "SUNSET CREW", members: 5, active: 5, total: 68250, median: 13100 },
    { id: "clan-palm", name: "GOLDEN PALMS", members: 4, active: 4, total: 49800, median: 12100 },
  ];

  const clone = value => JSON.parse(JSON.stringify(value));
  const now = () => new Date().toISOString();
  const uid = prefix => `${prefix}-${crypto.randomUUID?.() || Date.now()}`;
  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? clone(fallback); }
    catch { return clone(fallback); }
  };
  const write = (key, value) => {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent("bali:match3-changed", { detail: { key } }));
    return value;
  };

  function normalizeTiles(rows) {
    const source = Array.isArray(rows) && rows.length >= 5 ? rows : DEFAULT_TILES;
    const normalized = source.map((row, index) => {
      const fallback = DEFAULT_TILES.find(tile => tile.id === row.id) || DEFAULT_TILES[index] || DEFAULT_TILES[0];
      const originalAsset = String(row.originalAsset || fallback.originalAsset || fallback.image);
      const customAsset = String(row.customAsset || "");
      const activeAsset = String(row.activeAsset || row.image || customAsset || originalAsset);
      return {
        id: String(row.id || `tile-${index + 1}`).replace(/[^a-z0-9_-]/gi, "-"),
        name: String(row.name || fallback.name || `Предмет ${index + 1}`).trim(),
        image: activeAsset,
        originalAsset,
        activeAsset,
        customAsset,
        active: row.active !== false,
        versions: Array.isArray(row.versions) ? row.versions.slice(0, 20) : [],
      };
    });
    return normalized.filter(tile => tile.active && tile.activeAsset).length >= 5 ? normalized : clone(DEFAULT_TILES);
  }

  function normalizeRewards(rows) {
    const source = Array.isArray(rows) && rows.length ? rows : DEFAULT_REWARDS;
    return Array.from({ length: 10 }, (_, index) => {
      const position = index + 1;
      const fallback = DEFAULT_REWARDS[index];
      const row = source.find(item => Number(item.position) === position) || fallback;
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
    const merged = engine.deepMerge(DEFAULT_CONFIG, saved);
    // The former demo stored boardSize/startingMoves/targetScore at the root.
    // Those shadowed the new infinite-level rules forever and made an old 8×8
    // board reappear after the upgrade. Nested CRM rules are now authoritative.
    merged.levelRules.rows = Math.max(5, Math.min(10, Number(merged.levelRules.rows || 6)));
    merged.levelRules.columns = Math.max(5, Math.min(10, Number(merged.levelRules.columns || 6)));
    merged.levelRules.minTileTypes = Math.max(5, Math.min(8, Number(merged.levelRules.minTileTypes || 5)));
    merged.levelRules.maxTileTypes = Math.max(merged.levelRules.minTileTypes, Math.min(8, Number(merged.levelRules.maxTileTypes || 8)));
    merged.boardSize = merged.levelRules.rows;
    merged.startingMoves = Math.max(5, Math.min(99, Number(merged.levelRules.baseMoves || 25)));
    merged.targetScore = Math.max(1000, Number(merged.levelRules.baseTargetScore || 10000));
    merged.resetDay = Math.max(0, Math.min(6, Number(merged.resetDay ?? 1)));
    merged.tiles = normalizeTiles(merged.tiles);
    merged.rewards = normalizeRewards(merged.rewards);
    return merged;
  }

  function saveConfig(patch = {}) {
    const current = config();
    const next = engine.deepMerge(current, patch);
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
    return {
      id: start.toISOString().slice(0, 10),
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

  function defaultProgress() {
    const maximum = Number(config().lives.maximum || 5);
    return {
      userKey: player().userKey,
      seasonId: weekInfo().id,
      accountLevel: 1,
      seasonLevel: 1,
      seasonRating: 12450,
      lives: maximum,
      lastLifeAt: now(),
      ballyBalance: 1250,
      lifetimeLevelsCompleted: 0,
      threeStarLevels: 0,
      cleanLevels: 0,
      bestByLevel: {},
      boosterInventory: { ...config().boosters },
      history: [],
      activeAttempt: null,
      updatedAt: now(),
    };
  }

  function refreshLives(value) {
    const settings = config();
    const maximum = Math.max(1, Number(settings.lives.maximum || 5));
    const minutes = Math.max(1, Number(settings.lives.restoreMinutes || 30));
    const elapsed = Date.now() - new Date(value.lastLifeAt || Date.now()).getTime();
    const restored = Math.floor(elapsed / (minutes * 60000));
    if (restored > 0 && Number(value.lives || 0) < maximum) {
      value.lives = Math.min(maximum, Number(value.lives || 0) + restored);
      value.lastLifeAt = new Date(new Date(value.lastLifeAt || Date.now()).getTime() + restored * minutes * 60000).toISOString();
    }
    value.maximumLives = maximum;
    value.nextLifeAt = Number(value.lives || 0) >= maximum
      ? null
      : new Date(new Date(value.lastLifeAt || Date.now()).getTime() + minutes * 60000).toISOString();
    return value;
  }

  function progress() {
    const currentWeek = weekInfo().id;
    const saved = engine.deepMerge(defaultProgress(), read(KEYS.progress, {}));
    if (saved.seasonId !== currentWeek) {
      const mode = config().season.progressMode;
      saved.seasonId = currentWeek;
      saved.seasonLevel = mode === "carry_all" ? saved.seasonLevel : 1;
      saved.seasonRating = 0;
      saved.bestByLevel = {};
      saved.activeAttempt = null;
      if (mode === "reset_all") saved.accountLevel = 1;
    }
    refreshLives(saved);
    localStorage.setItem(KEYS.progress, JSON.stringify(saved));
    return saved;
  }

  function saveProgress(value) {
    value.updatedAt = now();
    return write(KEYS.progress, refreshLives(value));
  }

  function levelConfig(level = progress().seasonLevel) {
    return engine.generateLevel(level, config(), weekInfo().id);
  }

  function tilesForLevel(level = levelConfig()) {
    return config().tiles.filter(tile => tile.active !== false && tile.activeAsset).slice(0, level.tileTypes);
  }

  function startLevel(requestedLevel) {
    const profile = progress();
    if (profile.lives < 1) return { ok: false, reason: "lives_empty", profile };
    const levelNumber = Math.max(1, Number(requestedLevel || profile.seasonLevel || 1));
    const generated = levelConfig(levelNumber);
    const frozenTiles = tilesForLevel(generated).map(tile => ({
      id: tile.id,
      name: tile.name,
      image: tile.activeAsset,
      originalAsset: tile.originalAsset,
    }));
    const attempt = {
      id: uid("attempt"),
      seasonId: weekInfo().id,
      level: levelNumber,
      config: generated,
      tiles: frozenTiles,
      board: engine.createBoard(generated, frozenTiles.map(tile => tile.id)),
      movesRemaining: generated.moves,
      continues: 0,
      score: 0,
      progress: {
        score: 0,
        collected: {},
        obstaclesDestroyed: 0,
        specialsCreated: { line: 0, bomb: 0, rainbow: 0 },
        specialsActivated: { line: 0, bomb: 0, rainbow: 0, any: 0 },
      },
      breakdown: { combinations: 0, cascades: 0, specials: 0, obstacles: 0, goals: 0, remainingMoves: 0, clean: 0 },
      bestCascade: 1,
      status: "active",
      startedAt: now(),
      configSignature: String(engine.hashSeed(JSON.stringify({ level: generated, tiles: frozenTiles }))),
    };
    profile.activeAttempt = attempt;
    saveProgress(profile);
    return { ok: true, attempt };
  }

  function updateAttempt(attempt) {
    const profile = progress();
    if (profile.activeAttempt?.id === attempt.id) {
      profile.activeAttempt = clone(attempt);
      saveProgress(profile);
    }
    return attempt;
  }

  function spendBally(amount, reason = "Игровая покупка") {
    const profile = progress();
    const cost = Math.max(0, Math.round(Number(amount || 0)));
    if (profile.ballyBalance < cost) return { ok: false, reason: "insufficient_bally", balance: profile.ballyBalance };
    profile.ballyBalance -= cost;
    profile.history.unshift({ id: uid("bally"), type: "bally_spend", amount: -cost, reason, createdAt: now() });
    saveProgress(profile);
    return { ok: true, balance: profile.ballyBalance, cost };
  }

  function continueLevel(attempt) {
    const costs = config().economy.continueCosts || [40, 80];
    if (!attempt || attempt.status !== "active" || attempt.continues >= costs.length) return { ok: false, reason: "continue_limit" };
    const cost = Number(costs[attempt.continues] || 0);
    const payment = spendBally(cost, `Продолжение уровня ${attempt.level}`);
    if (!payment.ok) return payment;
    attempt.continues += 1;
    attempt.movesRemaining += Number(config().economy.continueMoves || 5);
    updateAttempt(attempt);
    return { ok: true, cost, moves: Number(config().economy.continueMoves || 5), attempt, balance: payment.balance };
  }

  function boosterCost(type) {
    return Math.max(0, Number(config().economy.boosterCosts?.[type] || 0));
  }

  function useBooster(type) {
    const profile = progress();
    const inventory = Number(profile.boosterInventory?.[type] || 0);
    if (inventory > 0) {
      profile.boosterInventory[type] = inventory - 1;
      saveProgress(profile);
      return { ok: true, paid: false, remaining: profile.boosterInventory[type], balance: profile.ballyBalance };
    }
    const payment = spendBally(boosterCost(type), `Бустер ${type}`);
    return payment.ok ? { ok: true, paid: true, remaining: 0, balance: payment.balance } : payment;
  }

  function restoreLife(full = false) {
    const profile = progress();
    const maximum = Number(config().lives.maximum || 5);
    if (profile.lives >= maximum) return { ok: true, lives: profile.lives, balance: profile.ballyBalance, unchanged: true };
    const cost = full ? Number(config().economy.fullLivesCost || 180) : Number(config().economy.lifeCost || 50);
    const payment = spendBally(cost, full ? "Полное восстановление жизней" : "Восстановление жизни");
    if (!payment.ok) return payment;
    const updated = progress();
    updated.lives = full ? maximum : Math.min(maximum, Number(updated.lives || 0) + 1);
    updated.lastLifeAt = now();
    saveProgress(updated);
    return { ok: true, lives: updated.lives, balance: updated.ballyBalance, cost };
  }

  function starsReward(stars, economy = config().economy) {
    return Number((economy.starRewards || [0, 5, 10, 20])[Math.max(0, Math.min(3, stars))] || 0);
  }

  function finishLevel(attempt, runtime = {}, forcedStatus = "") {
    const profile = progress();
    if (!attempt || attempt.status !== "active") return { ok: false, reason: "attempt_finished" };
    const tileIds = attempt.tiles.map(tile => tile.id);
    const goalStates = engine.goalsStatus(attempt.config, runtime.progress || attempt.progress, tileIds);
    const success = forcedStatus === "success" || (!forcedStatus && goalStates.every(goal => goal.complete));
    const scoring = attempt.config.scoring;
    const baseBreakdown = engine.deepMerge(attempt.breakdown, runtime.breakdown || {});
    let levelScore = Math.max(0, Math.round(Number(runtime.score ?? attempt.score ?? 0)));
    if (success) {
      baseBreakdown.goals = goalStates.filter(goal => goal.complete).length * Number(scoring.goalComplete || 1000)
        + Math.round(Number(scoring.allGoalsBase || 2500) * Number(attempt.config.difficulty || 1));
      baseBreakdown.remainingMoves = Math.round(
        Math.max(0, Number(runtime.movesRemaining ?? attempt.movesRemaining ?? 0))
        * Number(scoring.remainingMove || 200)
        * Number(attempt.config.difficulty || 1)
      );
      levelScore += baseBreakdown.goals + baseBreakdown.remainingMoves;
      if (attempt.continues === 0) {
        baseBreakdown.clean = Math.round(levelScore * Number(scoring.cleanMultiplier || 0.1));
        levelScore += baseBreakdown.clean;
      }
    }
    const stars = engine.starsFor(levelScore, attempt.config.targetScore, success, scoring);
    const ratingResult = success
      ? engine.seasonalRating(attempt.level, stars, attempt.continues, attempt.config.rating)
      : 0;
    const levelKey = String(attempt.level);
    const previous = profile.bestByLevel[levelKey] || { rating: 0, stars: 0, score: 0, clean: false };
    const ratingDelta = Math.max(0, ratingResult - Number(previous.rating || 0));
    let ballyAwarded = 0;
    if (success) {
      if (!previous.completed) ballyAwarded += Number(config().economy.firstCompletion || 20);
      ballyAwarded += Math.max(0, starsReward(stars) - starsReward(Number(previous.stars || 0)));
      if (attempt.continues === 0 && !previous.clean) ballyAwarded += Number(config().economy.cleanCompletion || 10);
      profile.accountLevel = Math.max(Number(profile.accountLevel || 1), attempt.level + 1);
      profile.seasonLevel = Math.max(Number(profile.seasonLevel || 1), attempt.level + 1);
      profile.seasonRating = Number(profile.seasonRating || 0) + ratingDelta;
      profile.ballyBalance = Number(profile.ballyBalance || 0) + ballyAwarded;
      profile.lifetimeLevelsCompleted += previous.completed ? 0 : 1;
      profile.threeStarLevels += stars === 3 && Number(previous.stars || 0) < 3 ? 1 : 0;
      profile.cleanLevels += attempt.continues === 0 && !previous.clean ? 1 : 0;
      profile.bestByLevel[levelKey] = {
        completed: true,
        score: Math.max(levelScore, Number(previous.score || 0)),
        rating: Math.max(ratingResult, Number(previous.rating || 0)),
        stars: Math.max(stars, Number(previous.stars || 0)),
        clean: previous.clean || attempt.continues === 0,
        updatedAt: now(),
      };
    } else {
      profile.lives = Math.max(0, Number(profile.lives || 0) - 1);
      profile.lastLifeAt = now();
    }
    attempt.status = success ? "completed" : "failed";
    attempt.endedAt = now();
    profile.activeAttempt = null;
    const record = {
      id: attempt.id,
      seasonId: attempt.seasonId,
      level: attempt.level,
      status: attempt.status,
      startedAt: attempt.startedAt,
      endedAt: attempt.endedAt,
      durationSeconds: Math.max(0, Math.round((Date.now() - new Date(attempt.startedAt).getTime()) / 1000)),
      score: levelScore,
      stars,
      continues: attempt.continues,
      boosters: runtime.boosters || [],
      breakdown: baseBreakdown,
      goalStates,
      seasonalPoints: ratingDelta,
      seasonalResult: ratingResult,
      ballyAwarded,
      clanContribution: ratingDelta,
      bestCascade: Number(runtime.bestCascade || attempt.bestCascade || 1),
    };
    profile.history.unshift(record);
    profile.history = profile.history.slice(0, 300);
    saveProgress(profile);
    submitScore(profile.seasonRating, {
      completed: true,
      bestCombo: record.bestCascade,
      level: profile.seasonLevel,
      threeStars: profile.threeStarLevels,
      cleanLevels: profile.cleanLevels,
      lastLevelScore: levelScore,
    });
    return { ok: true, success, record, profile: progress(), nextLevel: success ? profile.seasonLevel : attempt.level };
  }

  function allScores() {
    return read(KEYS.scores, {});
  }

  function seedWeek(weekId = weekInfo().id) {
    const scores = allScores();
    if (Array.isArray(scores[weekId]) && scores[weekId].length) return scores[weekId];
    const me = player();
    const profile = progress();
    scores[weekId] = [
      ...SEED_PLAYERS.map(row => ({ ...row, weekId, attempts: 4, updatedAt: now() })),
      {
        ...me,
        weekId,
        score: Number(profile.seasonRating || 0),
        level: Number(profile.seasonLevel || 1),
        threeStars: Number(profile.threeStarLevels || 0),
        attempts: Math.max(1, profile.history.filter(row => row.seasonId === weekId).length),
        updatedAt: now(),
        isMe: true,
      },
    ];
    write(KEYS.scores, scores);
    return scores[weekId];
  }

  function leaderboard(weekId = weekInfo().id) {
    const me = player();
    const rows = seedWeek(weekId).map(row => ({
      ...row,
      score: Math.max(0, Number(row.score || 0)),
      attempts: Math.max(0, Number(row.attempts || 0)),
      level: Math.max(1, Number(row.level || 1)),
      threeStars: Math.max(0, Number(row.threeStars || 0)),
      isMe: String(row.userKey) === me.userKey,
    }));
    const uniqueByUser = new Map();
    rows.forEach(row => {
      const previous = uniqueByUser.get(row.userKey);
      if (!previous || row.score > previous.score || (row.score === previous.score && String(row.updatedAt) < String(previous.updatedAt))) uniqueByUser.set(row.userKey, row);
    });
    return [...uniqueByUser.values()]
      .sort((left, right) => right.score - left.score || right.level - left.level || String(left.updatedAt).localeCompare(String(right.updatedAt)))
      .map((row, index) => ({ ...row, position: index + 1 }));
  }

  function submitScore(score, details = {}) {
    const week = weekInfo();
    const scores = allScores();
    const rows = Array.isArray(scores[week.id]) ? scores[week.id] : seedWeek(week.id);
    const me = player();
    const index = rows.findIndex(row => String(row.userKey) === me.userKey);
    const previous = index >= 0 ? rows[index] : { ...me, weekId: week.id, score: 0, attempts: 0 };
    const value = Math.max(0, Math.round(Number(score || 0)));
    const next = {
      ...previous,
      ...me,
      score: Math.max(Number(previous.score || 0), value),
      lastScore: value,
      attempts: Number(previous.attempts || 0) + (details.completed ? 1 : 0),
      bestCombo: Math.max(Number(previous.bestCombo || 0), Number(details.bestCombo || 0)),
      level: Math.max(Number(previous.level || 1), Number(details.level || 1)),
      threeStars: Math.max(Number(previous.threeStars || 0), Number(details.threeStars || 0)),
      cleanLevels: Math.max(Number(previous.cleanLevels || 0), Number(details.cleanLevels || 0)),
      lastLevelScore: Number(details.lastLevelScore || previous.lastLevelScore || 0),
      updatedAt: now(),
    };
    if (index >= 0) rows[index] = next;
    else rows.push(next);
    scores[week.id] = rows;
    write(KEYS.scores, scores);
    return {
      row: leaderboard(week.id).find(item => item.userKey === me.userKey),
      isNewBest: value > Number(previous.score || 0),
      previousBest: Number(previous.score || 0),
    };
  }

  function rewardForPosition(position) {
    return config().rewards.find(row => Number(row.position) === Number(position)) || null;
  }
  function grants() {
    return read(KEYS.grants, []);
  }

  function finalizeWeek(weekId = weekInfo().id) {
    const rows = leaderboard(weekId).slice(0, 10);
    const existing = grants();
    const game = window.BaliBeta4Game;
    const points = window.BaliPoints;
    const current = player();
    const awarded = [];
    rows.forEach(row => {
      const reward = rewardForPosition(row.position);
      if (!reward) return;
      const grantId = `${weekId}:${row.userKey}:${row.position}`;
      if (existing.some(item => item.id === grantId)) return;
      const grant = { id: grantId, weekId, userKey: row.userKey, userName: row.name, position: row.position, score: row.score, ...reward, awardedAt: now() };
      existing.unshift(grant);
      awarded.push(grant);
      if (String(row.userKey) === current.userKey) {
        const profile = progress();
        profile.history.unshift({ id: uid("season-prize"), type: "season_prize", amount: Number(reward.points || 0), reason: `${row.position} место · ${reward.reward}`, createdAt: now() });
        saveProgress(profile);
        const account = points?.accounts?.()?.[row.userKey] || points?.profile?.();
        if (reward.points > 0 && account) {
          points.adjustAccount(account, reward.points, `BALI Match · ${row.position} место · неделя ${weekId}`);
        }
        if (reward.xp > 0) game?.addXp?.(reward.xp, `BALI Match · ${reward.reward}`);
        if (reward.vipPlan && reward.vipDays > 0) {
          try { game?.activateVip?.(reward.vipPlan, "match3_weekly", reward.vipDays); } catch {}
        }
      }
    });
    write(KEYS.grants, existing.slice(0, 1000));
    const archive = read(KEYS.archive, {});
    archive[weekId] = {
      finalizedAt: archive[weekId]?.finalizedAt || now(),
      lastCheckedAt: now(),
      leaderboard: rows,
      grants: [...new Map([...(archive[weekId]?.grants || []), ...awarded].map(row => [row.id, row])).values()],
    };
    write(KEYS.archive, archive);
    return awarded;
  }

  function myRewards() {
    const keys = new Set(window.BaliBeta4Game?.identityKeys?.(window.BaliBeta4Game.profile()) || [player().userKey]);
    return grants().filter(row => keys.has(String(row.userKey)));
  }

  function resetCurrentWeek() {
    const week = weekInfo();
    const scores = allScores();
    delete scores[week.id];
    write(KEYS.scores, scores);
    const profile = progress();
    profile.seasonRating = 0;
    profile.seasonLevel = 1;
    profile.bestByLevel = {};
    profile.activeAttempt = null;
    saveProgress(profile);
    return seedWeek(week.id);
  }

  function clanLeaderboard() {
    const me = progress();
    const rows = CLAN_SEEDS.map((clan, index) => {
      const members = Math.max(1, Number(clan.members || 1));
      const total = Number(clan.total || 0) + (index === 1 ? Number(me.seasonRating || 0) : 0);
      const average = Math.round(total / members);
      return {
        ...clan,
        total,
        average,
        provisional: members < Number(config().clanRules.minimumMembers || 5),
        taskProgress: Math.min(100, Math.round((total / (members * 18000)) * 100)),
      };
    });
    return rows.sort((left, right) => right.average - left.average || right.median - left.median || right.active - left.active || right.total - left.total)
      .map((clan, index) => ({ ...clan, position: index + 1 }));
  }

  function clanTask() {
    const profile = progress();
    const members = 12;
    const target = members * 5;
    const completed = profile.history.filter(row => row.seasonId === weekInfo().id && row.status === "completed").length;
    const progressValue = Math.min(target, completed + 34);
    return {
      title: "Командный марафон уровней",
      metric: "levels",
      members,
      target,
      value: progressValue,
      percent: Math.round(progressValue / target * 100),
      personal: completed,
      eligible: completed >= Number(config().clanRules.minimumLevelsForChest || 3),
      milestones: config().clanRules.chestMilestones || [25, 50, 75, 100],
    };
  }

  function resetProgress() {
    localStorage.removeItem(KEYS.progress);
    return saveProgress(defaultProgress());
  }

  function rollover() {
    const current = weekInfo().id;
    const archive = read(KEYS.archive, {});
    Object.keys(allScores()).forEach(weekId => {
      if (weekId < current && !archive[weekId]) finalizeWeek(weekId);
    });
    progress();
    seedWeek(current);
    const scores = allScores();
    const retainedWeeks = Object.keys(scores).sort().reverse().slice(0, 26);
    if (Object.keys(scores).length > retainedWeeks.length) write(KEYS.scores, Object.fromEntries(retainedWeeks.map(weekId => [weekId, scores[weekId]])));
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
    resetProgress,
    weekInfo,
    player,
    progress,
    saveProgress,
    levelConfig,
    tilesForLevel,
    startLevel,
    updateAttempt,
    finishLevel,
    continueLevel,
    spendBally,
    boosterCost,
    useBooster,
    restoreLife,
    allScores,
    leaderboard,
    submitScore,
    rewardForPosition,
    grants,
    finalizeWeek,
    myRewards,
    resetCurrentWeek,
    clanLeaderboard,
    clanTask,
    rollover,
    uid,
  };
})();
