import { Router } from "express";
import { many, one, transaction } from "../db.js";
import { ApiError, asyncHandler } from "../errors.js";
import { finalizeEndedGameSeasons } from "../game-prizes.js";
import {
  applyMatch3Booster,
  createMatch3Board,
  generateMatch3Level,
  hashValue,
  initialMatch3Progress,
  match3GoalsComplete,
  match3SeasonRating,
  match3Stars,
  playMatch3Move,
  type Match3Progress
} from "../match3-engine.js";
import { requireUser } from "../middleware/auth.js";
import { enforceRateLimit, requestSubject } from "../rate-limit.js";
import type { Queryable } from "../types.js";
import {
  boundedInteger,
  requiredText,
  uuid
} from "../validation.js";

function requestKey(req: any): string {
  return requiredText(
    String(req.get("idempotency-key") || "").trim() || req.body?.idempotencyKey,
    "idempotencyKey",
    160
  );
}

function gameSymbols(settings: any): Array<{ key: string; label: string; imageUrl: string }> {
  const rows = Array.isArray(settings?.symbols) ? settings.symbols : [];
  return rows
    .filter((row: any) => row?.active !== false && row?.key)
    .map((row: any) => ({
      key: String(row.key),
      label: String(row.label || row.key),
      imageUrl: String(row.imageUrl || row.defaultImageUrl || "")
    }));
}

function mergeNumbers(target: Record<string, number>, patch: Record<string, number> | undefined): void {
  Object.entries(patch || {}).forEach(([key, value]) => {
    target[key] = Number(target[key] || 0) + Number(value || 0);
  });
}

async function ensureCurrentSeason(db: Queryable): Promise<any> {
  await finalizeEndedGameSeasons(db);
  const current = await one<any>(
    db,
    `select * from public.game_seasons
      where status in ('scheduled','active')
        and starts_at <= now() and ends_at > now()
      order by case status when 'active' then 0 else 1 end, starts_at desc
      limit 1`
  );
  if (current) {
    if (current.status === "scheduled") {
      return one<any>(
        db,
        `update public.game_seasons set status = 'active', updated_at = now()
          where id = $1 returning *`,
        [current.id]
      );
    }
    return current;
  }
  const settings = await one<any>(
    db,
    `select ranking_period_days, default_prizes
       from public.game_settings where singleton = true`
  );
  if (!settings) throw new ApiError(500, "Game settings are missing", "game_settings_missing");
  const periodDays = Math.max(1, Number(settings.ranking_period_days || 7));
  const periodMs = periodDays * 86_400_000;
  const anchor = Date.UTC(1970, 0, 5);
  const startsAt = new Date(anchor + Math.floor((Date.now() - anchor) / periodMs) * periodMs);
  const endsAt = new Date(startsAt.getTime() + periodMs);
  await db.query(
    `insert into public.game_seasons(name, starts_at, ends_at, status, rewards)
     values ($1,$2,$3,'active',$4::jsonb)
     on conflict do nothing`,
    [
      `BALI Match-3 · ${startsAt.toISOString().slice(0, 10)}`,
      startsAt.toISOString(),
      endsAt.toISOString(),
      JSON.stringify(Array.isArray(settings.default_prizes) ? settings.default_prizes : [])
    ]
  );
  return one<any>(
    db,
    `select * from public.game_seasons
      where status = 'active' and starts_at <= now() and ends_at > now()
      order by starts_at desc limit 1`
  );
}

async function ensureCurrentClanRound(
  db: Queryable,
  season: any,
  clanType: "user" | "corporate"
): Promise<any> {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setUTCHours(0, 0, 0, 0);
  const day = weekStart.getUTCDay();
  weekStart.setUTCDate(weekStart.getUTCDate() - ((day + 6) % 7));
  const startsAt = new Date(Math.max(new Date(season.starts_at).getTime(), weekStart.getTime()));
  const endsAt = new Date(Math.min(new Date(season.ends_at).getTime(), startsAt.getTime() + 7 * 86_400_000));
  const settings = await one<any>(
    db,
    `select clan_rules from public.game_settings where singleton = true`
  );
  const round = await one<any>(
    db,
    `insert into public.game_clan_rounds(
       season_id, clan_type, starts_at, ends_at, status, rules_snapshot
     ) values ($1,$2,$3,$4,'active',$5::jsonb)
     on conflict (season_id, clan_type, starts_at) do update
       set status = case
         when public.game_clan_rounds.status = 'scheduled' then 'active'
         else public.game_clan_rounds.status end,
           updated_at = now()
     returning *`,
    [
      season.id,
      clanType,
      startsAt.toISOString(),
      endsAt.toISOString(),
      JSON.stringify(settings?.clan_rules || {})
    ]
  );
  if (!round?.frozen_at) {
    await db.query(
      `insert into public.game_clan_round_roster(round_id, clan_id, user_key)
       select $1, membership.clan_id, membership.user_key
         from public.clan_memberships membership
         join public.clans clan on clan.id = membership.clan_id
        where membership.status = 'active' and membership.clan_type = $2
          and clan.status = 'active'
       on conflict (round_id, clan_id, user_key) do nothing`,
      [round!.id, clanType]
    );
    await db.query(
      `update public.game_clan_rounds set frozen_at = now(), updated_at = now()
        where id = $1 and frozen_at is null`,
      [round!.id]
    );
  }
  await db.query(
    `insert into public.game_clan_tasks(
       round_id, clan_id, title, metric, target_value, minimum_personal_contribution
     )
     select $1, roster.clan_id, 'Командный марафон уровней', 'levels',
            greatest(1, count(*) * 5), $2
       from public.game_clan_round_roster roster
      where roster.round_id = $1
      group by roster.clan_id
     on conflict (round_id, clan_id, metric) do nothing`,
    [
      round!.id,
      Math.max(1, Number(settings?.clan_rules?.minimumLevelsForChest || 3))
    ]
  );
  return round;
}

export function createGameRouter(db: Queryable): Router {
  const router = Router();
  router.use(requireUser);

  router.get("/", asyncHandler(async (req, res) => {
    const [settings, initialProfile, season] = await Promise.all([
      one<any>(db, `select * from public.game_settings where singleton = true`),
      one<any>(
        db,
        `select * from public.game_profiles where user_key = $1`,
        [req.userPrincipal!.userKey]
      ),
      ensureCurrentSeason(db)
    ]);
    let profile = initialProfile;
    if (settings && profile) {
      const maximum = Math.max(1, Number(settings.lives_rules?.maximum || settings.base_lives || 5));
      const restoreMinutes = Math.max(1, Number(settings.lives_rules?.restoreMinutes || 30));
      const elapsed = profile.last_life_at
        ? Date.now() - new Date(profile.last_life_at).getTime()
        : 0;
      const restored = Math.floor(elapsed / (restoreMinutes * 60_000));
      if (restored > 0 && Number(profile.lives || 0) < maximum) {
        profile = await one<any>(
          db,
          `update public.game_profiles
              set lives = least($2, lives + $3),
                  last_life_at = case
                    when lives + $3 >= $2 then now()
                    else last_life_at + ($4 * $3) * interval '1 minute'
                  end,
                  updated_at = now()
            where user_key = $1 returning *`,
          [req.userPrincipal!.userKey, maximum, restored, restoreMinutes]
        );
      }
    }
    res.json({ settings, profile, season });
  }));

  router.get("/leaderboard", asyncHandler(async (req, res) => {
    const seasonId = req.query.seasonId ? uuid(req.query.seasonId, "seasonId") : null;
    const season = seasonId
      ? await one<any>(db, `select * from public.game_seasons where id = $1`, [seasonId])
      : await ensureCurrentSeason(db);
    const rows = await many<any>(
      db,
      `select ranked.position, ranked.user_key, ranked.score, ranked.level,
              ranked.three_stars, ranked.clean_levels, ranked.attempts,
              user_row.name, user_row.avatar, user_row.username
         from (
           select best.user_key, best.score, best.level, best.three_stars,
                  best.clean_levels, best.attempts,
                  row_number() over (
                    order by best.score desc, best.level desc, best.three_stars desc, best.updated_at asc, best.user_key
                  )::integer as position
             from (
               select result.user_key, sum(result.best_rating)::bigint as score,
                      max(result.level_number)::integer as level,
                      count(*) filter (where result.best_stars = 3)::integer as three_stars,
                      count(*) filter (where result.clean_completed)::integer as clean_levels,
                      sum(result.attempts)::integer as attempts,
                      min(result.updated_at) as updated_at
                 from public.game_level_results result
                where result.season_id = $1
                group by result.user_key
             ) best
         ) ranked
         join public.app_users user_row on user_row.user_key = ranked.user_key
        order by ranked.position
        limit 100`,
      [season?.id || null]
    );
    const me = rows.find(row => row.user_key === req.userPrincipal!.userKey) || null;
    res.json({ season, leaderboard: rows, me });
  }));

  router.post("/sessions", asyncHandler(async (req, res) => {
    await enforceRateLimit(db, req, "game.session", requestSubject(req));
    const key = requestKey(req);
    const userKey = req.userPrincipal!.userKey;
    const existing = await one<any>(
      db,
      `select * from public.game_sessions where idempotency_key = $1 and user_key = $2`,
      [key, userKey]
    );
    if (existing) return res.json({ session: existing, replayed: true });
    let session: any;
    try {
      session = await transaction(db, async client => {
      const active = await one<any>(
        client,
        `select * from public.game_sessions
          where user_key = $1 and status = 'active' for update`,
        [userKey]
      );
      if (active) {
        throw new ApiError(409, "Finish or abandon the active game first", "active_game_exists", {
          gameSessionId: active.id
        });
      }
      const profile = await one<any>(
        client,
        `select * from public.game_profiles where user_key = $1 for update`,
        [userKey]
      );
      if (!profile || Number(profile.lives) < 1) {
        throw new ApiError(409, "No game lives are available", "game_lives_empty");
      }
      const [season, settings] = await Promise.all([
        ensureCurrentSeason(client),
        one<any>(client, `select * from public.game_settings where singleton = true`)
      ]);
      if (!settings) throw new ApiError(500, "Game settings are missing", "game_settings_missing");
      const seasonChanged = String(profile.current_season_id || "") !== String(season?.id || "");
      const seasonLevel = seasonChanged ? 1 : Math.max(1, Number(profile.season_level || 1));
      if (seasonChanged) {
        await client.query(
          `update public.game_profiles
              set current_season_id = $2, season_level = 1, season_rating = 0, updated_at = now()
            where user_key = $1`,
          [userKey, season?.id || null]
        );
      }
      const generated = generateMatch3Level(seasonLevel, settings, String(season?.id || "weekly"));
      const symbols = gameSymbols(settings).slice(0, generated.tileTypes);
      if (symbols.length < 5) {
        throw new ApiError(409, "At least five active game symbols are required", "game_symbols_missing");
      }
      const board = createMatch3Board(generated, symbols.map(symbol => symbol.key));
      const signature = hashValue({ generated, symbols });
      return one<any>(
        client,
        `insert into public.game_sessions(
           user_key, season_id, user_session_id, status, device_hash,
           idempotency_key, level_number, season_level_number, level_config,
           level_seed, config_signature, board_state, moves_remaining,
           goal_progress, score_breakdown, lives_used
         ) values ($1,$2,$3,'active',$4,$5,$6,$6,$7::jsonb,$8,$9,$10::jsonb,$11,$12::jsonb,$13::jsonb,0)
         returning *`,
        [
          userKey,
          season?.id || null,
          req.userPrincipal!.sessionId,
          String(req.body?.deviceHash || "").slice(0, 160),
          key,
          seasonLevel,
          JSON.stringify({ ...generated, symbols }),
          generated.seed,
          signature,
          JSON.stringify(board),
          generated.moves,
          JSON.stringify(initialMatch3Progress()),
          JSON.stringify({
            combinations: 0,
            cascades: 0,
            specials: 0,
            obstacles: 0,
            goals: 0,
            remainingMoves: 0,
            clean: 0
          })
        ]
      );
      });
    } catch (error: any) {
      if (error?.code === "23505") {
        const replay = await one<any>(
          db,
          `select * from public.game_sessions
            where idempotency_key = $1 and user_key = $2`,
          [key, userKey]
        );
        if (replay) return res.json({ session: replay, replayed: true });
        const active = await one<any>(
          db,
          `select id from public.game_sessions
            where user_key = $1 and status = 'active'`,
          [userKey]
        );
        if (active) {
          throw new ApiError(409, "Finish or abandon the active game first", "active_game_exists", {
            gameSessionId: active.id
          });
        }
      }
      throw error;
    }
    res.status(201).json({ session, replayed: false });
  }));

  router.post("/sessions/:sessionId/moves", asyncHandler(async (req, res) => {
    await enforceRateLimit(db, req, "game.move", requestSubject(req));
    const sessionId = uuid(req.params.sessionId, "sessionId");
    const key = requestKey(req);
    const first = boundedInteger(req.body?.first, 0, 0, 99);
    const second = boundedInteger(req.body?.second, 0, 0, 99);
    const sequence = boundedInteger(req.body?.sequence, 0, 1, 100_000);
    const result = await transaction(db, async client => {
      const replay = await one<any>(
        client,
        `select * from public.game_moves where idempotency_key = $1 and user_key = $2`,
        [key, req.userPrincipal!.userKey]
      );
      if (replay) {
        const session = await one<any>(client, `select * from public.game_sessions where id = $1`, [sessionId]);
        return { move: replay, session, replayed: true };
      }
      const session = await one<any>(
        client,
        `select * from public.game_sessions
          where id = $1 and user_key = $2 and status = 'active'
          for update`,
        [sessionId, req.userPrincipal!.userKey]
      );
      if (!session) throw new ApiError(404, "Active game session was not found", "not_found");
      if (sequence !== Number(session.move_sequence || 0) + 1) {
        throw new ApiError(409, "Move sequence is out of order", "game_move_sequence_mismatch", {
          expectedSequence: Number(session.move_sequence || 0) + 1
        });
      }
      if (Number(session.moves_remaining || 0) < 1) {
        throw new ApiError(409, "No moves remain", "game_moves_empty");
      }
      const config = session.level_config || {};
      const symbols = Array.isArray(config.symbols) ? config.symbols : [];
      const tileIds = symbols.map((symbol: any) => String(symbol.key));
      const board = Array.isArray(session.board_state) ? session.board_state : [];
      const beforeHash = hashValue(board);
      if (req.body?.boardHash && String(req.body.boardHash) !== beforeHash) {
        throw new ApiError(409, "Client board is stale", "game_board_mismatch", {
          expectedBoardHash: beforeHash
        });
      }
      const moveResult = playMatch3Move(board, first, second, config, tileIds, sequence);
      if (!moveResult.valid) {
        throw new ApiError(400, "Move does not create a valid combination", "game_move_invalid", {
          reason: moveResult.reason
        });
      }
      const progress = {
        ...initialMatch3Progress(),
        ...(session.goal_progress || {})
      } as Match3Progress;
      progress.score = Number(progress.score || 0) + moveResult.scoreDelta;
      progress.collected = { ...(progress.collected || {}) };
      progress.specialsCreated = { ...(progress.specialsCreated || {}) };
      progress.specialsActivated = { ...(progress.specialsActivated || {}) };
      mergeNumbers(progress.collected, moveResult.progressDelta.collected);
      mergeNumbers(progress.specialsCreated, moveResult.progressDelta.specialsCreated);
      mergeNumbers(progress.specialsActivated, moveResult.progressDelta.specialsActivated);
      progress.obstaclesDestroyed = Number(progress.obstaclesDestroyed || 0)
        + Number(moveResult.progressDelta.obstaclesDestroyed || 0);
      const breakdown = { ...(session.score_breakdown || {}) };
      mergeNumbers(breakdown, moveResult.breakdown);
      const boardAfterHash = hashValue(moveResult.board);
      const updated = await one<any>(
        client,
        `update public.game_sessions
            set board_state = $2::jsonb, move_sequence = $3,
                moves_remaining = moves_remaining - 1,
                level_score = level_score + $4,
                final_score = level_score + $4,
                goal_progress = $5::jsonb, score_breakdown = $6::jsonb,
                best_combo = greatest(best_combo, $7), updated_at = now()
          where id = $1 returning *`,
        [
          sessionId,
          JSON.stringify(moveResult.board),
          sequence,
          moveResult.scoreDelta,
          JSON.stringify(progress),
          JSON.stringify(breakdown),
          moveResult.cascades
        ]
      );
      const move = await one<any>(
        client,
        `insert into public.game_moves(
           game_session_id, user_key, sequence, first_index, second_index,
           board_before_hash, board_after_hash, score_delta, move_result, idempotency_key
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)
         returning *`,
        [
          sessionId,
          req.userPrincipal!.userKey,
          sequence,
          first,
          second,
          beforeHash,
          boardAfterHash,
          moveResult.scoreDelta,
          JSON.stringify(moveResult),
          key
        ]
      );
      return { move, session: updated, replayed: false };
    });
    res.status(result.replayed ? 200 : 201).json(result);
  }));

  router.post("/sessions/:sessionId/boosters", asyncHandler(async (req, res) => {
    await enforceRateLimit(db, req, "game.booster", requestSubject(req));
    const sessionId = uuid(req.params.sessionId, "sessionId");
    const key = requestKey(req);
    const type = String(req.body?.type || "");
    if (!["shuffle", "hint", "bomb", "remove", "removeType"].includes(type)) {
      throw new ApiError(400, "Unsupported game booster", "validation_error");
    }
    const targetIndex = req.body?.index === undefined || req.body?.index === null
      ? null
      : boundedInteger(req.body.index, 0, 0, 99);
    const result = await transaction(db, async client => {
      const replay = await one<any>(
        client,
        `select * from public.game_booster_uses
          where idempotency_key = $1 and user_key = $2`,
        [key, req.userPrincipal!.userKey]
      );
      if (replay) {
        const session = await one<any>(client, `select * from public.game_sessions where id = $1`, [sessionId]);
        return { use: replay, session, result: replay.result, replayed: true };
      }
      const [session, profile, settings] = await Promise.all([
        one<any>(
          client,
          `select * from public.game_sessions
            where id = $1 and user_key = $2 and status = 'active' for update`,
          [sessionId, req.userPrincipal!.userKey]
        ),
        one<any>(
          client,
          `select * from public.game_profiles where user_key = $1 for update`,
          [req.userPrincipal!.userKey]
        ),
        one<any>(client, `select * from public.game_settings where singleton = true`)
      ]);
      if (!session || !profile || !settings) {
        throw new ApiError(404, "Active game session was not found", "not_found");
      }
      const config = session.level_config || {};
      const symbols = Array.isArray(config.symbols) ? config.symbols : [];
      const tileIds = symbols.map((symbol: any) => String(symbol.key));
      const board = Array.isArray(session.board_state) ? session.board_state : [];
      const useNumber = await one<any>(
        client,
        `select count(*)::integer as count from public.game_booster_uses
          where game_session_id = $1`,
        [sessionId]
      );
      const boosterResult = applyMatch3Booster(
        board,
        type as "shuffle" | "hint" | "bomb" | "remove" | "removeType",
        targetIndex,
        config,
        tileIds,
        Number(useNumber?.count || 0) + 1
      );
      if (!boosterResult.valid) {
        throw new ApiError(409, "Game booster cannot be applied", "game_booster_invalid", {
          reason: boosterResult.reason
        });
      }
      const inventory = { ...(profile.booster_inventory || {}) };
      const inventoryUsed = Number(inventory[type] || 0) > 0;
      let ballyCost = 0;
      if (inventoryUsed) {
        inventory[type] = Number(inventory[type] || 0) - 1;
        await client.query(
          `update public.game_profiles
              set booster_inventory = $2::jsonb, updated_at = now()
            where user_key = $1`,
          [req.userPrincipal!.userKey, JSON.stringify(inventory)]
        );
      } else {
        ballyCost = Number(settings.economy_rules?.boosterCosts?.[type] || 0);
        const paid = await one<any>(
          client,
          `update public.game_profiles
              set bally_balance = bally_balance - $2, updated_at = now()
            where user_key = $1 and bally_balance >= $2
            returning bally_balance`,
          [req.userPrincipal!.userKey, ballyCost]
        );
        if (!paid) throw new ApiError(409, "Not enough Bally", "insufficient_bally");
      }
      const progress = { ...initialMatch3Progress(), ...(session.goal_progress || {}) } as Match3Progress;
      progress.score = Number(progress.score || 0) + boosterResult.scoreDelta;
      progress.collected = { ...(progress.collected || {}) };
      mergeNumbers(progress.collected, boosterResult.progressDelta.collected);
      progress.obstaclesDestroyed = Number(progress.obstaclesDestroyed || 0)
        + Number(boosterResult.progressDelta.obstaclesDestroyed || 0);
      const breakdown = { ...(session.score_breakdown || {}) };
      breakdown.specials = Number(breakdown.specials || 0) + boosterResult.scoreDelta;
      const updated = await one<any>(
        client,
        `update public.game_sessions
            set board_state = $2::jsonb, level_score = level_score + $3,
                final_score = level_score + $3, goal_progress = $4::jsonb,
                score_breakdown = $5::jsonb, updated_at = now()
          where id = $1 returning *`,
        [
          sessionId,
          JSON.stringify(boosterResult.board),
          boosterResult.scoreDelta,
          JSON.stringify(progress),
          JSON.stringify(breakdown)
        ]
      );
      const created = await one<any>(
        client,
        `insert into public.game_booster_uses(
           game_session_id, user_key, booster_type, target_index,
           inventory_used, points_cost, bally_cost, point_transaction_id, result, idempotency_key
         ) values ($1,$2,$3,$4,$5,0,$6,null,$7::jsonb,$8)
         returning *`,
        [
          sessionId,
          req.userPrincipal!.userKey,
          type,
          targetIndex,
          inventoryUsed,
          ballyCost,
          JSON.stringify(boosterResult),
          key
        ]
      );
      return { use: created, session: updated, result: boosterResult, replayed: false };
    });
    res.status(result.replayed ? 200 : 201).json(result);
  }));

  router.post("/sessions/:sessionId/finish", asyncHandler(async (req, res) => {
    const sessionId = uuid(req.params.sessionId, "sessionId");
    const key = requestKey(req);
    const result = await transaction(db, async client => {
      const replay = await one<any>(
        client,
        `select * from public.idempotency_records
          where scope = 'game.finish' and idempotency_key = $1`,
        [key]
      );
      if (replay?.response_body) {
        return { session: replay.response_body, replayed: true };
      }
      const session = await one<any>(
        client,
        `select * from public.game_sessions
          where id = $1 and user_key = $2 for update`,
        [sessionId, req.userPrincipal!.userKey]
      );
      if (!session) throw new ApiError(404, "Game session was not found", "not_found");
      const replayAfterLock = await one<any>(
        client,
        `select * from public.idempotency_records
          where scope = 'game.finish' and idempotency_key = $1`,
        [key]
      );
      if (replayAfterLock?.response_body) {
        return { session: replayAfterLock.response_body, replayed: true };
      }
      if (session.status !== "active") {
        throw new ApiError(409, "Game session has already ended", "game_already_ended");
      }
      const settings = await one<any>(
        client,
        `select * from public.game_settings where singleton = true`
      );
      if (!settings) throw new ApiError(500, "Game settings are missing", "game_settings_missing");
      const elapsed = Math.max(
        1,
        Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000)
      );
      const config = session.level_config || {};
      const symbols = Array.isArray(config.symbols) ? config.symbols : [];
      const tileIds = symbols.map((symbol: any) => String(symbol.key));
      const signatureValid = hashValue({ generated: {
        ...config,
        symbols: undefined
      }, symbols }) === String(session.config_signature);
      const reasons: string[] = [];
      if (!signatureValid) reasons.push("config_signature_mismatch");
      if (Number(session.move_sequence || 0) > Number(config.moves || 0)
        + Number(session.continues_used || 0) * Number(settings.economy_rules?.continueMoves || 5)) {
        reasons.push("move_limit_exceeded");
      }
      const suspicious = reasons.length > 0;
      const progress = { ...initialMatch3Progress(), ...(session.goal_progress || {}) } as Match3Progress;
      const success = !suspicious && match3GoalsComplete(config, progress, tileIds);
      const scoring = config.scoring || {};
      const breakdown = { ...(session.score_breakdown || {}) };
      let levelScore = Number(session.level_score || 0);
      if (success) {
        breakdown.goals = config.goals.length * Number(scoring.goalComplete || 1000)
          + Math.round(Number(scoring.allGoalsBase || 2500) * Number(config.difficulty || 1));
        breakdown.remainingMoves = Math.round(
          Number(session.moves_remaining || 0)
          * Number(scoring.remainingMove || 200)
          * Number(config.difficulty || 1)
        );
        levelScore += Number(breakdown.goals || 0) + Number(breakdown.remainingMoves || 0);
        if (Number(session.continues_used || 0) === 0) {
          breakdown.clean = Math.round(levelScore * Number(scoring.cleanMultiplier || 0.1));
          levelScore += Number(breakdown.clean || 0);
        }
      }
      const stars = match3Stars(levelScore, Number(config.targetScore || 0), success, scoring);
      const seasonalResult = success
        ? match3SeasonRating(Number(session.level_number), stars, Number(session.continues_used || 0), config.rating || {})
        : 0;
      const previous = success
        ? await one<any>(
          client,
          `select * from public.game_level_results
            where season_id = $1 and user_key = $2 and level_number = $3
            for update`,
          [session.season_id, req.userPrincipal!.userKey, session.level_number]
        )
        : null;
      const ratingDelta = Math.max(0, seasonalResult - Number(previous?.best_rating || 0));
      const economy = settings.economy_rules || {};
      const starRewards = Array.isArray(economy.starRewards) ? economy.starRewards : [0, 5, 10, 20];
      let ballyAwarded = 0;
      if (success) {
        if (!previous) ballyAwarded += Number(economy.firstCompletion || 20);
        ballyAwarded += Math.max(0, Number(starRewards[stars] || 0) - Number(starRewards[previous?.best_stars || 0] || 0));
        if (Number(session.continues_used || 0) === 0 && !previous?.clean_completed) {
          ballyAwarded += Number(economy.cleanCompletion || 10);
        }
      }
      const updated = await one<any>(
        client,
        `update public.game_sessions
            set status = 'completed', ended_at = now(), duration_seconds = $2,
                final_score = $3, level_score = $3, suspicious = $4,
                suspicious_reasons = $5::jsonb, completion_status = $6,
                stars = $7, seasonal_points = $8, bally_awarded = $9,
                score_breakdown = $10::jsonb, lives_used = $11,
                client_finish_payload = $12::jsonb, updated_at = now()
          where id = $1
          returning *`,
        [
          sessionId,
          elapsed,
          levelScore,
          suspicious,
          JSON.stringify(reasons),
          success ? "success" : "failed",
          stars,
          ratingDelta,
          ballyAwarded,
          JSON.stringify(breakdown),
          success ? 0 : 1,
          JSON.stringify(req.body || {})
        ]
      );
      if (success) {
        await client.query(
          `insert into public.game_level_results(
             season_id, user_key, level_number, best_session_id, best_score,
             best_stars, best_rating, clean_completed, attempts, first_completed_at
           ) values ($1,$2,$3,$4,$5,$6,$7,$8,1,now())
           on conflict (season_id, user_key, level_number) do update
             set best_session_id = case
                   when excluded.best_rating > game_level_results.best_rating then excluded.best_session_id
                   else game_level_results.best_session_id end,
                 best_score = greatest(game_level_results.best_score, excluded.best_score),
                 best_stars = greatest(game_level_results.best_stars, excluded.best_stars),
                 best_rating = greatest(game_level_results.best_rating, excluded.best_rating),
                 clean_completed = game_level_results.clean_completed or excluded.clean_completed,
                 attempts = game_level_results.attempts + 1, updated_at = now()`,
          [
            session.season_id,
            req.userPrincipal!.userKey,
            session.level_number,
            sessionId,
            levelScore,
            stars,
            seasonalResult,
            Number(session.continues_used || 0) === 0
          ]
        );
        await client.query(
          `update public.game_profiles
              set account_level = greatest(account_level, $2 + 1),
                  season_level = greatest(season_level, $2 + 1),
                  season_rating = season_rating + $3,
                  bally_balance = bally_balance + $4,
                  lifetime_levels_completed = lifetime_levels_completed + case when $5 then 1 else 0 end,
                  three_star_levels = three_star_levels + case when $6 then 1 else 0 end,
                  clean_levels = clean_levels + case when $7 then 1 else 0 end,
                  best_score = greatest(best_score, $8), xp = xp + floor($8 / 100),
                  updated_at = now()
            where user_key = $1`,
          [
            req.userPrincipal!.userKey,
            Number(session.level_number),
            ratingDelta,
            ballyAwarded,
            !previous,
            stars === 3 && Number(previous?.best_stars || 0) < 3,
            Number(session.continues_used || 0) === 0 && !previous?.clean_completed,
            levelScore
          ]
        );
      } else {
        await client.query(
          `update public.game_profiles
              set lives = greatest(0, lives - 1), last_life_at = now(),
                  suspicious_score_count = suspicious_score_count + case when $2 then 1 else 0 end,
                  updated_at = now()
            where user_key = $1`,
          [req.userPrincipal!.userKey, suspicious]
        );
      }
      await client.query(
        `insert into public.idempotency_records(
           scope, idempotency_key, actor_key, response_code, response_body, completed_at
         ) values ('game.finish',$1,$2,200,$3::jsonb,now())`,
        [key, req.userPrincipal!.userKey, JSON.stringify(updated)]
      );
      return {
        session: updated,
        replayed: false,
        result: {
          success,
          levelScore,
          stars,
          seasonalResult,
          seasonalPoints: ratingDelta,
          ballyAwarded,
          breakdown
        }
      };
    });
    res.json(result);
  }));

  router.post("/sessions/:sessionId/continue", asyncHandler(async (req, res) => {
    const sessionId = uuid(req.params.sessionId, "sessionId");
    const key = requestKey(req);
    const existing = await one<any>(
      db,
      `select * from public.game_continues
        where idempotency_key = $1 and user_key = $2`,
      [key, req.userPrincipal!.userKey]
    );
    if (existing) return res.json({ continue: existing, replayed: true });
    const result = await transaction(db, async client => {
      const session = await one<any>(
        client,
        `select * from public.game_sessions
          where id = $1 and user_key = $2 and status = 'active'
          for update`,
        [sessionId, req.userPrincipal!.userKey]
      );
      if (!session) throw new ApiError(404, "Active game session was not found", "not_found");
      if (Number(session.continues_used || 0) >= 2) {
        throw new ApiError(409, "The maximum of two continues has been reached", "game_continue_limit");
      }
      const settings = await one<any>(
        client,
        `select continue_points_cost, economy_rules from public.game_settings where singleton = true`
      );
      const economy = settings?.economy_rules || {};
      const costs = Array.isArray(economy.continueCosts)
        ? economy.continueCosts
        : [settings?.continue_points_cost || 0, Number(settings?.continue_points_cost || 0) * 2];
      const cost = Number(costs[Number(session.continues_used || 0)] || 0);
      const extraMoves = Math.max(1, Number(economy.continueMoves || 5));
      if (cost <= 0) {
        throw new ApiError(409, "Paid game continues are disabled", "game_continue_disabled");
      }
      const paid = await one<any>(
        client,
        `update public.game_profiles
            set bally_balance = bally_balance - $2, updated_at = now()
          where user_key = $1 and bally_balance >= $2
          returning bally_balance`,
        [req.userPrincipal!.userKey, cost]
      );
      if (!paid) throw new ApiError(409, "Not enough Bally", "insufficient_bally");
      const created = await one<any>(
        client,
        `insert into public.game_continues(
           game_session_id, user_key, points_cost, bally_cost, point_transaction_id, idempotency_key
         ) values ($1,$2,0,$3,null,$4)
         returning *`,
        [sessionId, req.userPrincipal!.userKey, cost, key]
      );
      await client.query(
        `update public.game_sessions
            set continues_used = continues_used + 1,
                moves_remaining = moves_remaining + $2, updated_at = now()
          where id = $1`,
        [sessionId, extraMoves]
      );
      return { ...created, extra_moves: extraMoves };
    });
    res.status(201).json({ continue: result, replayed: false });
  }));

  router.post("/sessions/:sessionId/abandon", asyncHandler(async (req, res) => {
    const sessionId = uuid(req.params.sessionId, "sessionId");
    const session = await transaction(db, async client => {
      const updated = await one<any>(
        client,
        `update public.game_sessions
            set status = 'abandoned', completion_status = 'abandoned', ended_at = now(),
                duration_seconds = greatest(0, extract(epoch from now() - started_at)::integer),
                lives_used = 1, updated_at = now()
          where id = $1 and user_key = $2 and status = 'active'
          returning *`,
        [sessionId, req.userPrincipal!.userKey]
      );
      if (updated) {
        await client.query(
          `update public.game_profiles
              set lives = greatest(0, lives - 1), last_life_at = now(), updated_at = now()
            where user_key = $1`,
          [req.userPrincipal!.userKey]
        );
      }
      return updated;
    });
    if (!session) throw new ApiError(404, "Active game session was not found", "not_found");
    res.json({ session });
  }));

  router.post("/lives/restore", asyncHandler(async (req, res) => {
    const key = requestKey(req);
    const full = Boolean(req.body?.full);
    const result = await transaction(db, async client => {
      const replay = await one<any>(
        client,
        `select * from public.idempotency_records
          where scope = 'game.lives.restore' and idempotency_key = $1`,
        [key]
      );
      if (replay?.response_body) return { ...replay.response_body, replayed: true };
      const [profile, settings] = await Promise.all([
        one<any>(
          client,
          `select * from public.game_profiles where user_key = $1 for update`,
          [req.userPrincipal!.userKey]
        ),
        one<any>(client, `select * from public.game_settings where singleton = true`)
      ]);
      if (!profile || !settings) throw new ApiError(404, "Game profile was not found", "not_found");
      const maximum = Math.max(1, Number(settings.lives_rules?.maximum || settings.base_lives || 5));
      if (Number(profile.lives || 0) >= maximum) {
        return { profile, replayed: false, unchanged: true };
      }
      const cost = full
        ? Number(settings.economy_rules?.fullLivesCost || 180)
        : Number(settings.economy_rules?.lifeCost || 50);
      const updated = await one<any>(
        client,
        `update public.game_profiles
            set bally_balance = bally_balance - $4,
                lives = case when $2 then $3 else least($3, lives + 1) end,
                last_life_at = now(), updated_at = now()
          where user_key = $1 and bally_balance >= $4
          returning *`,
        [req.userPrincipal!.userKey, full, maximum, cost]
      );
      if (!updated) throw new ApiError(409, "Not enough Bally", "insufficient_bally");
      const responseBody = { profile: updated, cost, full };
      await client.query(
        `insert into public.idempotency_records(
           scope, idempotency_key, actor_key, response_code, response_body, completed_at
         ) values ('game.lives.restore',$1,$2,200,$3::jsonb,now())`,
        [key, req.userPrincipal!.userKey, JSON.stringify(responseBody)]
      );
      return { ...responseBody, replayed: false };
    });
    res.json(result);
  }));

  router.get("/clans/leaderboard", asyncHandler(async (req, res) => {
    const clanType = String(req.query.clanType || "user");
    if (!["user", "corporate"].includes(clanType)) {
      throw new ApiError(400, "Unsupported clan category", "validation_error");
    }
    const [season, settings] = await Promise.all([
      ensureCurrentSeason(db),
      one<any>(db, `select clan_rules from public.game_settings where singleton = true`)
    ]);
    const round = await ensureCurrentClanRound(db, season, clanType as "user" | "corporate");
    const minimumMembers = Math.max(2, Number(settings?.clan_rules?.minimumMembers || 5));
    const rows = await many<any>(
      db,
      `with member_scores as (
         select roster.clan_id, roster.user_key,
                coalesce(sum(result.best_rating),0)::bigint as rating,
                coalesce(max(result.level_number),0)::integer as level
           from public.game_clan_round_roster roster
           left join public.game_level_results result
             on result.user_key = roster.user_key and result.season_id = $1
            and result.updated_at >= $4 and result.updated_at < $5
          where roster.round_id = $3
          group by roster.clan_id, roster.user_key
       ), clan_scores as (
         select clan.id, clan.name, clan.clan_type,
                count(score.user_key)::integer as members,
                count(score.user_key) filter (where score.rating > 0)::integer as active_members,
                coalesce(sum(score.rating),0)::bigint as total_rating,
                coalesce(avg(score.rating),0)::numeric(18,3) as average_rating,
                coalesce(percentile_cont(0.5) within group (order by score.rating),0)::numeric(18,3) as median_rating
           from public.clans clan
           left join member_scores score on score.clan_id = clan.id
          where clan.clan_type = $2 and clan.status = 'active'
          group by clan.id, clan.name, clan.clan_type
       )
       select score.*,
              (score.members >= $6) as eligible,
              row_number() over (
                order by
                  case when score.members >= $6 then 0 else 1 end,
                  score.average_rating desc, score.median_rating desc,
                  score.active_members desc, score.total_rating desc, score.name
              )::integer as position
         from clan_scores score
        order by position`,
      [season?.id || null, clanType, round.id, round.starts_at, round.ends_at, minimumMembers]
    );
    res.json({ season, round, clanType, minimumMembers, leaderboard: rows });
  }));

  router.get("/prizes", asyncHandler(async (req, res) => {
    const prizes = await many<any>(
      db,
      `select prize.*, season.name as season_name, season.starts_at, season.ends_at
         from public.game_prizes prize
         join public.game_seasons season on season.id = prize.season_id
        where prize.user_key = $1
        order by season.ends_at desc`,
      [req.userPrincipal!.userKey]
    );
    res.json({ prizes });
  }));

  router.get("/seasons/:seasonId", asyncHandler(async (req, res) => {
    const seasonId = uuid(req.params.seasonId, "seasonId");
    const season = await one<any>(
      db,
      `select * from public.game_seasons where id = $1`,
      [seasonId]
    );
    if (!season) throw new ApiError(404, "Game season was not found", "not_found");
    res.json({ season });
  }));

  router.get("/sessions/:sessionId", asyncHandler(async (req, res) => {
    const sessionId = uuid(req.params.sessionId, "sessionId");
    const session = await one<any>(
      db,
      `select * from public.game_sessions where id = $1 and user_key = $2`,
      [sessionId, req.userPrincipal!.userKey]
    );
    if (!session) throw new ApiError(404, "Game session was not found", "not_found");
    res.json({ session });
  }));

  return router;
}
