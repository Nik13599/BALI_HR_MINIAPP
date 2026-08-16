(() => {
  "use strict";
  if (!window.BaliProduction || !window.BaliMatch3InfiniteEngine) return;

  const production = window.BaliProduction;
  const engine = window.BaliMatch3InfiniteEngine;
  const state = production.state;
  let serverSession = null;
  let activeAttempt = null;
  let history = [];
  let clanRows = [];
  let clanLoading = false;

  const symbols = settings => {
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
    const configured = Array.isArray(settings?.symbols) ? settings.symbols : [];
    return defaults.map(([id, name, image]) => {
      const row = configured.find(item => item.key === id) || {};
      const original = row.defaultImageUrl || image;
      const active = row.imageUrl || original;
      return {
        id,
        name: row.label || name,
        image: active,
        originalAsset: original,
        activeAsset: active,
        customAsset: row.imageUrl || "",
        active: row.active !== false,
        versions: [],
      };
    });
  };

  function config() {
    const settings = state.game?.settings || {};
    const levelRules = engine.deepMerge(engine.DEFAULT_RULES.level, settings.level_rules || {});
    const scoringRules = engine.deepMerge(engine.DEFAULT_RULES.scoring, settings.scoring_rules || {});
    const ratingRules = engine.deepMerge(engine.DEFAULT_RULES.rating, settings.rating_rules || {});
    const economy = engine.deepMerge({
      firstCompletion: 20,
      starRewards: [0, 5, 10, 20],
      cleanCompletion: 10,
      continueMoves: 5,
      continueCosts: [40, 80],
      boosterCosts: { shuffle: 25, hint: 10, bomb: 45, remove: 35, removeType: 60 },
      lifeCost: 50,
      fullLivesCost: 180,
    }, settings.economy_rules || {});
    const rewards = (settings.default_prizes || []).map((reward, index) => ({
      position: Number(reward.position || index + 1),
      points: Number(reward.points || 0),
      xp: Number(reward.xp || 0),
      reward: Array.isArray(reward.rewardIds) && reward.rewardIds.length ? reward.rewardIds.join(", ") : "Награда BALI Match",
      vipPlan: reward.vipPlanId || "",
      vipDays: Number(reward.vipDays || 0),
    }));
    return {
      enabled: true,
      title: settings.game_title || "BALI Match",
      subtitle: settings.game_subtitle || "Бесконечная сезонная игра",
      boardSize: Number(levelRules.rows || 6),
      startingMoves: Number(levelRules.baseMoves || 25),
      targetScore: Number(levelRules.baseTargetScore || 10_000),
      resetDay: 1,
      backgroundImage: settings.background_image_url || "/site/assets/match3/background.webp",
      rewardImage: settings.reward_image_url || "/site/assets/match3/reward.webp",
      levelRules,
      scoringRules,
      ratingRules,
      economy,
      lives: engine.deepMerge({ maximum: 5, restoreMinutes: 30 }, settings.lives_rules || {}),
      clanRules: engine.deepMerge({
        minimumMembers: 5,
        maximumMembers: 30,
        transitionLockHours: 72,
        taskRatingBonusLimit: 0.1,
        minimumLevelsForChest: 3,
        chestMilestones: [25, 50, 75, 100],
      }, settings.clan_rules || {}),
      season: {
        name: state.game?.season?.name || "Сезон BALI Match",
        description: state.game?.season?.description || "",
        frozen: Boolean(state.game?.season?.frozen_at),
        bestClanRounds: Number(settings.clan_rules?.bestRounds || 4),
      },
      boosters: { bomb: 0, shuffle: 0, hint: 0, remove: 0, removeType: 0 },
      tiles: symbols(settings),
      rewards,
    };
  }

  function progress() {
    const profile = state.game?.profile || {};
    return {
      userKey: state.me?.id || "",
      seasonId: state.game?.season?.id || "",
      accountLevel: Number(profile.account_level || 1),
      seasonLevel: Number(profile.season_level || 1),
      seasonRating: Number(profile.season_rating || 0),
      lives: Number(profile.lives ?? 5),
      maximumLives: Number(config().lives.maximum || 5),
      ballyBalance: Number(profile.bally_balance ?? 0),
      lifetimeLevelsCompleted: Number(profile.lifetime_levels_completed || 0),
      threeStarLevels: Number(profile.three_star_levels || 0),
      cleanLevels: Number(profile.clean_levels || 0),
      boosterInventory: profile.booster_inventory || {},
      history,
      activeAttempt,
    };
  }

  function weekInfo() {
    const startsAt = new Date(state.game?.season?.starts_at || Date.now()).getTime();
    const endsAt = new Date(state.game?.season?.ends_at || Date.now() + 604_800_000).getTime();
    return {
      id: state.game?.season?.id || "weekly",
      startsAt,
      endsAt,
      label: `${new Date(startsAt).toLocaleDateString("ru-RU")} — ${new Date(endsAt).toLocaleDateString("ru-RU")}`,
    };
  }

  function attemptFromSession(session) {
    const level = session.level_config || {};
    const frozenSymbols = Array.isArray(level.symbols) ? level.symbols : [];
    return {
      id: session.id,
      seasonId: session.season_id,
      level: Number(session.level_number || 1),
      config: level,
      tiles: frozenSymbols.map(symbol => ({
        id: symbol.key,
        name: symbol.label || symbol.key,
        image: symbol.imageUrl || "",
        originalAsset: symbol.imageUrl || "",
      })),
      board: session.board_state || [],
      movesRemaining: Number(session.moves_remaining || level.moves || 0),
      continues: Number(session.continues_used || 0),
      score: Number(session.level_score || 0),
      progress: session.goal_progress || {
        score: 0, collected: {}, obstaclesDestroyed: 0,
        specialsCreated: { line: 0, bomb: 0, rainbow: 0 },
        specialsActivated: { line: 0, bomb: 0, rainbow: 0, any: 0 },
      },
      breakdown: session.score_breakdown || {
        combinations: 0, cascades: 0, specials: 0, obstacles: 0,
        goals: 0, remainingMoves: 0, clean: 0,
      },
      bestCascade: Number(session.best_combo || 1),
      status: "active",
      startedAt: session.started_at,
      events: [],
    };
  }

  async function startLevel() {
    try {
      const response = await production.post("/api/v1/game/sessions", {
        deviceHash: navigator.userAgent,
      });
      serverSession = response.session;
    } catch (error) {
      if (error?.code === "game_lives_empty") return { ok: false, reason: "lives_empty", profile: progress() };
      if (error?.code !== "active_game_exists" || !error?.details?.gameSessionId) throw error;
      const response = await production.api(`/api/v1/game/sessions/${error.details.gameSessionId}`);
      serverSession = response.session;
    }
    activeAttempt = attemptFromSession(serverSession);
    return { ok: true, attempt: activeAttempt };
  }

  async function playMove(attempt, first, second) {
    const response = await production.post(`/api/v1/game/sessions/${attempt.id}/moves`, {
      first,
      second,
      sequence: Number(serverSession?.move_sequence || 0) + 1,
    });
    serverSession = response.session;
    const result = response.move?.move_result || {};
    return {
      valid: true,
      board: serverSession.board_state,
      score: Number(response.move?.score_delta || result.scoreDelta || 0),
      collected: result.progressDelta?.collected || {},
      obstaclesDestroyed: Number(result.progressDelta?.obstaclesDestroyed || 0),
      specialsCreated: result.progressDelta?.specialsCreated || {},
      specialsActivated: result.progressDelta?.specialsActivated || {},
      breakdown: result.breakdown || {},
      bestCascade: Number(result.cascades || 1),
      events: [{
        cascade: Number(result.cascades || 1),
        removed: Object.values(result.progressDelta?.collected || {}).reduce((sum, value) => sum + Number(value || 0), 0),
        points: Number(response.move?.score_delta || result.scoreDelta || 0),
      }],
    };
  }

  async function finishLevel(attempt) {
    const response = await production.post(`/api/v1/game/sessions/${attempt.id}/finish`, {
      clientScore: attempt.score,
      clientMoves: attempt.movesRemaining,
    });
    const result = response.result || {};
    const row = {
      id: attempt.id,
      seasonId: attempt.seasonId,
      level: attempt.level,
      status: result.success ? "completed" : "failed",
      score: Number(result.levelScore || 0),
      stars: Number(result.stars || 0),
      continues: attempt.continues,
      breakdown: result.breakdown || attempt.breakdown,
      seasonalPoints: Number(result.seasonalPoints || 0),
      seasonalResult: Number(result.seasonalResult || 0),
      ballyAwarded: Number(result.ballyAwarded || 0),
      bestCascade: attempt.bestCascade,
      endedAt: new Date().toISOString(),
    };
    history.unshift(row);
    history = history.slice(0, 100);
    activeAttempt = null;
    serverSession = null;
    await production.refreshCore();
    production.refreshSecondary().catch(console.error);
    return {
      ok: true,
      success: Boolean(result.success),
      record: row,
      profile: progress(),
      nextLevel: progress().seasonLevel,
    };
  }

  async function continueLevel(attempt) {
    const response = await production.post(`/api/v1/game/sessions/${attempt.id}/continue`, {});
    const extraMoves = Number(response.continue?.extra_moves || config().economy.continueMoves || 5);
    attempt.continues += 1;
    attempt.movesRemaining += extraMoves;
    if (serverSession) {
      serverSession.continues_used = attempt.continues;
      serverSession.moves_remaining = attempt.movesRemaining;
    }
    await production.refreshCore();
    return { ok: true, cost: Number(response.continue?.bally_cost || 0), moves: extraMoves, attempt };
  }

  async function restoreLife(full) {
    const response = await production.post("/api/v1/game/lives/restore", { full });
    state.game.profile = response.profile || state.game.profile;
    await production.refreshCore();
    return {
      ok: true,
      lives: Number(response.profile?.lives || 0),
      balance: Number(response.profile?.bally_balance || 0),
      cost: Number(response.cost || 0),
    };
  }

  function leaderboard() {
    return (state.leaderboard || []).map(row => ({
      userKey: row.user_key,
      name: row.name,
      avatar: row.avatar,
      score: Number(row.score || 0),
      position: Number(row.position || 0),
      attempts: Number(row.attempts || 0),
      level: Number(row.level || 1),
      threeStars: Number(row.three_stars || 0),
      cleanLevels: Number(row.clean_levels || 0),
      isMe: String(row.user_key) === String(state.me?.id),
      updatedAt: new Date().toISOString(),
    }));
  }

  function loadClans() {
    if (clanLoading) return;
    clanLoading = true;
    production.api("/api/v1/game/clans/leaderboard?clanType=user")
      .then(result => {
        clanRows = (result.leaderboard || []).map(row => ({
          id: row.id,
          name: row.name,
          members: Number(row.members || 0),
          active: Number(row.active_members || 0),
          total: Number(row.total_rating || 0),
          average: Number(row.average_rating || 0),
          median: Number(row.median_rating || 0),
          provisional: !row.eligible,
          position: Number(row.position || 0),
        }));
        window.dispatchEvent(new CustomEvent("bali:match3-changed", { detail: { key: "clans" } }));
      })
      .catch(console.error)
      .finally(() => { clanLoading = false; });
  }

  function clanLeaderboard() {
    if (!clanRows.length) loadClans();
    return clanRows;
  }

  function clanTask() {
    return {
      title: "Командный марафон уровней",
      value: 0,
      target: Math.max(1, Number(config().clanRules.minimumMembers || 5) * 5),
      percent: 0,
      personal: history.filter(row => row.status === "completed").length,
      eligible: history.filter(row => row.status === "completed").length >= Number(config().clanRules.minimumLevelsForChest || 3),
    };
  }

  window.BaliMatch3 = {
    KEYS: {},
    config,
    progress,
    weekInfo,
    startLevel,
    playMove,
    updateAttempt(attempt) { activeAttempt = attempt; return attempt; },
    finishLevel,
    continueLevel,
    restoreLife,
    boosterCost(type) { return Number(config().economy.boosterCosts?.[type] || 0); },
    async useBooster(type, context = {}) {
      const attempt = context.attempt || activeAttempt;
      if (!attempt) return { ok: false, reason: "attempt_missing" };
      const response = await production.post(`/api/v1/game/sessions/${attempt.id}/boosters`, {
        type,
        index: context.index,
      });
      serverSession = response.session;
      const result = response.result || {};
      await production.refreshCore();
      return {
        ok: true,
        paid: !response.use?.inventory_used,
        balance: Number(state.game?.profile?.bally_balance || 0),
        serverResult: {
          valid: true,
          board: response.session?.board_state || result.board || attempt.board,
          score: Number(response.use?.result?.scoreDelta || result.scoreDelta || 0),
          collected: response.use?.result?.progressDelta?.collected || result.progressDelta?.collected || {},
          obstaclesDestroyed: Number(response.use?.result?.progressDelta?.obstaclesDestroyed || result.progressDelta?.obstaclesDestroyed || 0),
          cleared: Number(response.use?.result?.cleared || result.cleared || 0),
          hint: response.use?.result?.hint || result.hint || [],
        },
      };
    },
    leaderboard,
    clanLeaderboard,
    clanTask,
    grants: () => [],
    myRewards: () => (state.gamePrizes || []).map(prize => ({
      position: Number(prize.position),
      points: Number(prize.reward_payload?.points || 0),
      reward: (prize.reward_payload?.rewardIds || []).join(", ") || "Награда BALI Match",
      vipPlan: prize.reward_payload?.vipPlanId || "",
      vipDays: Number(prize.reward_payload?.vipDays || 0),
      awardedAt: prize.issued_at || prize.created_at,
    })),
  };
})();
