import { many, one, transaction } from "./db.js";
import { mutatePoints } from "./economy.js";
import { ApiError } from "./errors.js";
import type { Queryable } from "./types.js";

interface PrizePayload {
  points?: number;
  rewardIds?: string[];
  vipPlanId?: string;
  vipDays?: number;
}

export async function finalizeGameSeason(
  db: Queryable,
  seasonId: string,
  issuedByAdminId: string | null = null
): Promise<{ season: any; winners: any[]; replayed: boolean }> {
  return transaction(db, async client => {
    const season = await one<any>(
      client,
      `select * from public.game_seasons where id = $1 for update`,
      [seasonId]
    );
    if (!season) throw new ApiError(404, "Game season was not found", "not_found");
    if (season.status === "completed") {
      const prizes = await many<any>(
        client,
        `select user_key, position, reward_payload, status
           from public.game_prizes where season_id = $1 order by position`,
        [seasonId]
      );
      return { season, winners: prizes, replayed: true };
    }
    if (season.status === "scheduled" && new Date(season.starts_at).getTime() > Date.now()) {
      throw new ApiError(
        409,
        "A scheduled game season cannot be finalized before it starts",
        "game_season_not_started"
      );
    }
    const winners = await many<any>(
      client,
      `select best.user_key, best.score,
              row_number() over (
                order by best.score desc, best.level desc, best.three_stars desc,
                         best.updated_at asc, best.user_key
              )::integer as position
         from (
           select user_key, sum(best_rating)::bigint as score,
                  max(level_number)::integer as level,
                  count(*) filter (where best_stars = 3)::integer as three_stars,
                  min(updated_at) as updated_at
             from public.game_level_results
            where season_id = $1
            group by user_key
         ) best
        order by position limit 10`,
      [seasonId]
    );
    const configuredRewards = Array.isArray(season.rewards) ? season.rewards : [];
    for (const winner of winners) {
      const payload = (configuredRewards[Number(winner.position) - 1] || {}) as PrizePayload;
      const prizeKey = `game-prize:${seasonId}:${winner.position}`;
      const prize = await one<any>(
        client,
        `insert into public.game_prizes(
           season_id, user_key, position, reward_payload, idempotency_key
         ) values ($1,$2,$3,$4::jsonb,$5)
         on conflict (season_id, position) do nothing
         returning *`,
        [seasonId, winner.user_key, winner.position, JSON.stringify(payload), prizeKey]
      );
      if (!prize) continue;

      const points = Number(payload.points || 0);
      if (Number.isSafeInteger(points) && points > 0) {
        await mutatePoints(client, {
          userKey: winner.user_key,
          amount: points,
          operationType: "credit",
          sourceType: "game_prize",
          sourceId: seasonId,
          reason: `BALI Match: ${winner.position} место`,
          administratorId: issuedByAdminId,
          idempotencyKey: `${prizeKey}:points`
        });
      }

      for (const rewardId of Array.isArray(payload.rewardIds) ? payload.rewardIds : []) {
        const reward = await one<any>(
          client,
          `select * from public.reward_definitions where id = $1`,
          [String(rewardId)]
        );
        if (!reward) continue;
        const grant = await one<any>(
          client,
          `insert into public.user_rewards(
             reward_id, user_key, source_type, source_id, idempotency_key,
             granted_by_admin_id, metadata
           ) values ($1,$2,'game',$3,$4,$5,$6::jsonb)
           on conflict (idempotency_key) do nothing
           returning *`,
          [
            reward.id,
            winner.user_key,
            seasonId,
            `${prizeKey}:reward:${reward.id}`,
            issuedByAdminId,
            JSON.stringify({ position: winner.position, score: winner.score })
          ]
        );
        if (!grant) continue;
        if (Number(reward.points || 0) > 0) {
          await mutatePoints(client, {
            userKey: winner.user_key,
            amount: Number(reward.points),
            operationType: "credit",
            sourceType: "reward",
            sourceId: reward.id,
            reason: `Награда: ${reward.name}`,
            administratorId: issuedByAdminId,
            idempotencyKey: `${prizeKey}:reward-points:${reward.id}`
          });
        }
        await client.query(
          `update public.game_profiles set xp = xp + $2, updated_at = now()
            where user_key = $1`,
          [winner.user_key, Number(reward.xp || 0)]
        );
      }

      const vipDays = Number(payload.vipDays || 0);
      const vipPlanId = String(payload.vipPlanId || "");
      if (vipPlanId && Number.isSafeInteger(vipDays) && vipDays > 0) {
        const plan = await one<any>(client, `select id from public.vip_plans where id = $1`, [vipPlanId]);
        if (plan) {
          const current = await one<any>(
            client,
            `select ends_at from public.user_vip_subscriptions
              where user_key = $1 and status in ('active','scheduled') and ends_at > now()
              order by ends_at desc limit 1 for update`,
            [winner.user_key]
          );
          const startsAt = current ? new Date(current.ends_at) : new Date();
          const endsAt = new Date(startsAt.getTime() + vipDays * 86_400_000);
          await client.query(
            `insert into public.user_vip_subscriptions(
               user_key, plan_id, source_type, starts_at, ends_at, status,
               issued_by_admin_id, idempotency_key
             ) values ($1,$2,'game_prize',$3,$4,$5,$6,$7)
             on conflict (idempotency_key) do nothing`,
            [
              winner.user_key,
              vipPlanId,
              startsAt.toISOString(),
              endsAt.toISOString(),
              startsAt.getTime() > Date.now() ? "scheduled" : "active",
              issuedByAdminId,
              `${prizeKey}:vip`
            ]
          );
          await client.query(
            `update public.app_users
                set vip_expires_at = greatest(coalesce(vip_expires_at, $2), $2),
                    updated_at = now()
              where user_key = $1`,
            [winner.user_key, endsAt.toISOString()]
          );
        }
      }

      await client.query(
        `update public.game_prizes
            set status = 'issued', issued_by_admin_id = $2, issued_at = now()
          where id = $1`,
        [prize.id, issuedByAdminId]
      );
      await client.query(
        `insert into public.notifications(
           user_key, notification_type, title, body, data, idempotency_key
         ) values ($1,'game_prize','Награда BALI Match',$2,$3::jsonb,$4)
         on conflict (idempotency_key) do nothing`,
        [
          winner.user_key,
          `${winner.position} место в недельном рейтинге. Награда начислена.`,
          JSON.stringify({ seasonId, position: winner.position, score: winner.score, payload }),
          `${prizeKey}:notification`
        ]
      );
    }
    const completed = await one<any>(
      client,
      `update public.game_seasons set status = 'completed', updated_at = now()
        where id = $1 returning *`,
      [seasonId]
    );
    return { season: completed, winners, replayed: false };
  });
}

export async function finalizeEndedGameSeasons(db: Queryable): Promise<void> {
  const ended = await many<any>(
    db,
    `select id from public.game_seasons
      where status = 'active' and ends_at <= now()
      order by ends_at limit 20`
  );
  for (const season of ended) await finalizeGameSeason(db, season.id);
}
