import { Router } from "express";
import { many, one, transaction } from "../db.js";
import { mutatePoints } from "../economy.js";
import { ApiError, asyncHandler } from "../errors.js";
import { finalizeEndedGameSeasons } from "../game-prizes.js";
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

export function createGameRouter(db: Queryable): Router {
  const router = Router();
  router.use(requireUser);

  router.get("/", asyncHandler(async (req, res) => {
    const [settings, profile, season] = await Promise.all([
      one<any>(db, `select * from public.game_settings where singleton = true`),
      one<any>(
        db,
        `select * from public.game_profiles where user_key = $1`,
        [req.userPrincipal!.userKey]
      ),
      ensureCurrentSeason(db)
    ]);
    res.json({ settings, profile, season });
  }));

  router.get("/leaderboard", asyncHandler(async (req, res) => {
    const seasonId = req.query.seasonId ? uuid(req.query.seasonId, "seasonId") : null;
    const season = seasonId
      ? await one<any>(db, `select * from public.game_seasons where id = $1`, [seasonId])
      : await ensureCurrentSeason(db);
    const periodDays = await one<any>(
      db,
      `select ranking_period_days from public.game_settings where singleton = true`
    );
    const rows = await many<any>(
      db,
      `select ranked.position, ranked.user_key, ranked.score, ranked.ended_at,
              ranked.attempts,
              user_row.name, user_row.avatar, user_row.username
         from (
           select best.user_key, best.score, best.ended_at, best.attempts,
                  row_number() over (order by best.score desc, best.ended_at asc, best.user_key)::integer as position
             from (
               select session.user_key, max(session.final_score)::bigint as score,
                      count(*)::integer as attempts,
                      min(session.ended_at) filter (
                        where session.final_score = (
                          select max(inner_session.final_score)
                            from public.game_sessions inner_session
                           where inner_session.user_key = session.user_key
                             and inner_session.status = 'completed'
                             and inner_session.suspicious = false
                             and ($1::uuid is null or inner_session.season_id = $1)
                             and ($1::uuid is not null or inner_session.ended_at > now() - make_interval(days => $2))
                        )
                      ) as ended_at
                 from public.game_sessions session
                where session.status = 'completed'
                  and session.suspicious = false
                  and ($1::uuid is null or session.season_id = $1)
                  and ($1::uuid is not null or session.ended_at > now() - make_interval(days => $2))
                group by session.user_key
             ) best
         ) ranked
         join public.app_users user_row on user_row.user_key = ranked.user_key
        order by ranked.position
        limit 100`,
      [season?.id || null, Number(periodDays?.ranking_period_days || 7)]
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
      const season = await ensureCurrentSeason(client);
      await client.query(
        `update public.game_profiles
            set lives = lives - 1, last_life_at = now(), updated_at = now()
          where user_key = $1`,
        [userKey]
      );
      return one<any>(
        client,
        `insert into public.game_sessions(
           user_key, season_id, user_session_id, status, device_hash,
           idempotency_key
         ) values ($1,$2,$3,'active',$4,$5)
         returning *`,
        [
          userKey,
          season?.id || null,
          req.userPrincipal!.sessionId,
          String(req.body?.deviceHash || "").slice(0, 160),
          key
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

  router.post("/sessions/:sessionId/finish", asyncHandler(async (req, res) => {
    const sessionId = uuid(req.params.sessionId, "sessionId");
    const key = requestKey(req);
    const score = boundedInteger(req.body?.score, 0, 0, Number.MAX_SAFE_INTEGER);
    const bestCombo = boundedInteger(req.body?.bestCombo, 0, 0, 1_000_000);
    const reportedDuration = boundedInteger(req.body?.durationSeconds, 0, 0, 86_400);
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
      const elapsed = Math.max(
        1,
        Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1000)
      );
      const allowedScore = Math.ceil(
        elapsed * Number(settings?.max_score_per_second || 500) * 1.15 + 1000
      );
      const reasons: string[] = [];
      if (score > allowedScore) reasons.push("score_rate_exceeded");
      if (reportedDuration > elapsed + 10 || reportedDuration < Math.max(0, elapsed - 120)) {
        reasons.push("duration_mismatch");
      }
      const suspicious = reasons.length > 0;
      const updated = await one<any>(
        client,
        `update public.game_sessions
            set status = 'completed', ended_at = now(), duration_seconds = $2,
                final_score = $3, best_combo = $4, suspicious = $5,
                suspicious_reasons = $6::jsonb, updated_at = now()
          where id = $1
          returning *`,
        [
          sessionId,
          elapsed,
          score,
          bestCombo,
          suspicious,
          JSON.stringify(reasons)
        ]
      );
      await client.query(
        `update public.game_profiles
            set best_score = greatest(best_score, $2),
                xp = xp + $3,
                suspicious_score_count = suspicious_score_count + case when $4 then 1 else 0 end,
                updated_at = now()
          where user_key = $1`,
        [
          req.userPrincipal!.userKey,
          suspicious ? 0 : score,
          suspicious ? 0 : Math.floor(score / 100),
          suspicious
        ]
      );
      await client.query(
        `insert into public.idempotency_records(
           scope, idempotency_key, actor_key, response_code, response_body, completed_at
         ) values ('game.finish',$1,$2,200,$3::jsonb,now())`,
        [key, req.userPrincipal!.userKey, JSON.stringify(updated)]
      );
      return { session: updated, replayed: false };
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
      const settings = await one<any>(
        client,
        `select continue_points_cost from public.game_settings where singleton = true`
      );
      const cost = Number(settings?.continue_points_cost || 0);
      if (cost <= 0) {
        throw new ApiError(409, "Paid game continues are disabled", "game_continue_disabled");
      }
      const pointResult = await mutatePoints(client, {
        userKey: req.userPrincipal!.userKey,
        amount: -cost,
        operationType: "debit",
        sourceType: "game_continue",
        sourceId: sessionId,
        reason: "Продолжение игры",
        idempotencyKey: `game-continue-points:${key}`
      });
      const created = await one<any>(
        client,
        `insert into public.game_continues(
           game_session_id, user_key, points_cost, point_transaction_id, idempotency_key
         ) values ($1,$2,$3,$4,$5)
         returning *`,
        [sessionId, req.userPrincipal!.userKey, cost, pointResult.ledger.id, key]
      );
      await client.query(
        `update public.game_sessions
            set continues_used = continues_used + 1, updated_at = now()
          where id = $1`,
        [sessionId]
      );
      return created;
    });
    res.status(201).json({ continue: result, replayed: false });
  }));

  router.post("/sessions/:sessionId/abandon", asyncHandler(async (req, res) => {
    const sessionId = uuid(req.params.sessionId, "sessionId");
    const session = await one<any>(
      db,
      `update public.game_sessions
          set status = 'abandoned', ended_at = now(),
              duration_seconds = greatest(0, extract(epoch from now() - started_at)::integer),
              updated_at = now()
        where id = $1 and user_key = $2 and status = 'active'
        returning *`,
      [sessionId, req.userPrincipal!.userKey]
    );
    if (!session) throw new ApiError(404, "Active game session was not found", "not_found");
    res.json({ session });
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
