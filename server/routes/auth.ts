import { Router } from "express";
import { one, transaction } from "../db.js";
import { ApiError, asyncHandler } from "../errors.js";
import {
  ADMIN_COOKIE,
  USER_COOKIE,
  cookieOptions,
  requireAdmin,
  requireUser
} from "../middleware/auth.js";
import { enforceRateLimit, requestSubject } from "../rate-limit.js";
import {
  AuthenticationError,
  createSessionToken,
  hashToken,
  sha256,
  verifyPassword,
  verifyTelegramInitData
} from "../security.js";
import type { AppConfig, Queryable } from "../types.js";
import { requiredText } from "../validation.js";

function clientMetadata(req: any) {
  return {
    ipHash: sha256(String(req.ip || "")),
    userAgent: String(req.get("user-agent") || "").slice(0, 500)
  };
}

export function createAuthRouter(db: Queryable, config: AppConfig): Router {
  const router = Router();

  router.post("/telegram", asyncHandler(async (req, res) => {
    await enforceRateLimit(db, req, "auth.telegram", requestSubject(req));
    let verified;
    try {
      verified = verifyTelegramInitData(
        String(req.body?.initData || ""),
        config.telegramBotToken,
        config.telegramAuthMaxAgeSeconds
      );
    } catch (error) {
      if (error instanceof AuthenticationError) throw new ApiError(401, error.message, "telegram_auth_failed");
      throw error;
    }

    const telegram = verified.user;
    const userKey = `tg:${telegram.id}`;
    const fullName = `${telegram.first_name || ""} ${telegram.last_name || ""}`.trim() || "Гость BALI";
    const existing = await one<any>(
      db,
      `select app_user_key from public.telegram_accounts where telegram_user_id = $1`,
      [telegram.id]
    );
    if (!existing) {
      const legacy = await one<any>(
        db,
        `select user_key
           from public.app_users
          where telegram_id = $1 and user_key <> $2
          limit 1`,
        [String(telegram.id), userKey]
      );
      if (legacy) {
        await db.query(
          `insert into public.data_merge_review(
             entity_type, legacy_id, candidate_user_key, reason, payload
           ) values ('telegram_identity',$1,$2,$3,$4::jsonb)
           on conflict (entity_type, legacy_id) do update
             set candidate_user_key = excluded.candidate_user_key,
                 reason = excluded.reason,
                 payload = excluded.payload,
                 status = case
                   when data_merge_review.status = 'linked' then data_merge_review.status
                   else 'pending'
                 end`,
          [
            String(telegram.id),
            legacy.user_key,
            "Legacy Telegram ID requires administrator review before account binding",
            JSON.stringify({ signedTelegramUser: telegram, canonicalUserKey: userKey })
          ]
        );
        throw new ApiError(
          409,
          "Account binding requires administrator review",
          "identity_merge_review_required"
        );
      }
    }
    const linkedUserKey = existing?.app_user_key || userKey;
    const sessionToken = createSessionToken();
    const expiresAt = new Date(Date.now() + config.sessionTtlSeconds * 1000);
    const metadata = clientMetadata(req);

    const account = await transaction(db, async client => {
      const user = await one<any>(
        client,
        `insert into public.app_users(
           user_key, telegram_id, name, username, avatar,
           first_seen_at, last_seen_at, opens, account_status, updated_at
         ) values ($1,$2,$3,$4,$5,now(),now(),1,'active',now())
         on conflict (user_key) do update set
           telegram_id = excluded.telegram_id,
           name = excluded.name,
           username = excluded.username,
           avatar = excluded.avatar,
           last_seen_at = now(),
           opens = public.app_users.opens + 1,
           updated_at = now()
         returning user_key, name, username, avatar, account_status, blocked_at`,
        [
          linkedUserKey,
          String(telegram.id),
          fullName,
          telegram.username || "",
          telegram.photo_url || ""
        ]
      );
      if (!user || user.account_status !== "active" || user.blocked_at) {
        throw new ApiError(403, "BALI account is blocked", "account_blocked");
      }

      await client.query(
        `insert into public.telegram_accounts(
           app_user_key, telegram_user_id, username, first_name, last_name,
           language_code, photo_url, is_premium, first_verified_at, last_verified_at
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,now(),now())
         on conflict (telegram_user_id) do update set
           username = excluded.username,
           first_name = excluded.first_name,
           last_name = excluded.last_name,
           language_code = excluded.language_code,
           photo_url = excluded.photo_url,
           is_premium = excluded.is_premium,
           last_verified_at = now(),
           updated_at = now()`,
        [
          linkedUserKey,
          telegram.id,
          telegram.username || "",
          telegram.first_name,
          telegram.last_name || "",
          telegram.language_code || "",
          telegram.photo_url || "",
          Boolean(telegram.is_premium)
        ]
      );
      await client.query(
        `insert into public.user_profiles(
           user_key, display_name, avatar_url, phone
         ) values ($1,$2,$3,'')
         on conflict (user_key) do nothing`,
        [linkedUserKey, fullName, telegram.photo_url || ""]
      );
      await client.query(
        `insert into public.user_consents(user_key)
         values ($1)
         on conflict (user_key) do nothing`,
        [linkedUserKey]
      );
      await client.query(
        `insert into public.crm_customers(
           user_key, first_name, last_name, last_activity_at, app_opens
         ) values ($1,$2,$3,now(),1)
         on conflict (user_key) do update
           set first_name = excluded.first_name,
               last_name = excluded.last_name,
               last_activity_at = now(),
               app_opens = public.crm_customers.app_opens + 1,
               updated_at = now()`,
        [linkedUserKey, telegram.first_name, telegram.last_name || ""]
      );
      await client.query(
        `insert into public.point_accounts(user_key)
         values ($1)
         on conflict (user_key) do nothing`,
        [linkedUserKey]
      );
      await client.query(
        `insert into public.game_profiles(user_key)
         values ($1)
         on conflict (user_key) do nothing`,
        [linkedUserKey]
      );
      await client.query(
        `insert into public.notification_preferences(user_key)
         values ($1)
         on conflict (user_key) do nothing`,
        [linkedUserKey]
      );
      if (!existing) {
        const registrationKey = `registration:${linkedUserKey}`;
        const claim = await one<any>(
          client,
          `insert into public.idempotency_records(
             scope, idempotency_key, actor_key, completed_at
           ) values ('points',$1,$2,now())
           on conflict (scope, idempotency_key) do nothing
           returning idempotency_key`,
          [registrationKey, linkedUserKey]
        );
        if (claim) {
          const settings = await one<any>(
            client,
            `select registration_points as amount
               from public.economy_settings
              where singleton = true`
          );
          const amount = Number(settings?.amount || 0);
          const account = await one<any>(
            client,
            `select balance from public.point_accounts
              where user_key = $1 for update`,
            [linkedUserKey]
          );
          const balanceBefore = Number(account?.balance || 0);
          const balanceAfter = balanceBefore + amount;
          await client.query(
            `update public.point_accounts
                set balance = $2,
                    lifetime_earned = lifetime_earned + $3,
                    version = version + 1,
                    updated_at = now()
              where user_key = $1`,
            [linkedUserKey, balanceAfter, amount]
          );
          if (amount > 0) {
            await client.query(
              `insert into public.point_ledger(
                 user_key, amount, balance_before, balance_after,
                 operation_type, source_type, source_id, reason, idempotency_key
               ) values ($1,$2,$3,$4,'credit','registration',$1,$5,$6)
               on conflict (idempotency_key) do nothing`,
              [
                linkedUserKey,
                amount,
                balanceBefore,
                balanceAfter,
                "Начисление за регистрацию",
                registrationKey
              ]
            );
          }
        }
      }
      await client.query(
        `insert into public.user_sessions(
           app_user_key, token_hash, telegram_auth_date, expires_at, ip_hash, user_agent
         ) values ($1,$2,$3,$4,$5,$6)`,
        [
          linkedUserKey,
          hashToken(sessionToken, config.sessionSecret),
          new Date(verified.authDate * 1000).toISOString(),
          expiresAt.toISOString(),
          metadata.ipHash,
          metadata.userAgent
        ]
      );
      await client.query(
        `insert into public.analytics_events(
           user_key, event_name, source, entity_type, entity_id, properties
         ) values ($1,'app_open','telegram','user',$1,$2::jsonb)`,
        [linkedUserKey, JSON.stringify({ firstOpen: !existing })]
      );
      return user;
    });

    res.cookie(USER_COOKIE, sessionToken, cookieOptions(config, config.sessionTtlSeconds * 1000));
    res.status(201).json({
      user: {
        id: account.user_key,
        name: account.name,
        username: account.username,
        avatar: account.avatar
      },
      environment: config.environment,
      expiresAt: expiresAt.toISOString()
    });
  }));

  router.get("/session", requireUser, asyncHandler(async (req, res) => {
    res.json({
      user: {
        id: req.userPrincipal!.userKey,
        name: req.userPrincipal!.name,
        username: req.userPrincipal!.username
      },
      environment: config.environment
    });
  }));

  router.post("/logout", requireUser, asyncHandler(async (req, res) => {
    await db.query(`update public.user_sessions set revoked_at = now() where id = $1`, [
      req.userPrincipal!.sessionId
    ]);
    res.clearCookie(USER_COOKIE, { path: "/" });
    res.status(204).end();
  }));

  router.post("/admin/login", asyncHandler(async (req, res) => {
    await enforceRateLimit(db, req, "auth.admin", requestSubject(req));
    const email = requiredText(req.body?.email, "email", 320).toLowerCase();
    const password = requiredText(req.body?.password, "password", 1000);
    const admin = await one<any>(
      db,
      `select id, email, password_hash, role, status from public.admin_users where email = $1`,
      [email]
    );
    if (!admin || admin.status !== "active" || !(await verifyPassword(password, admin.password_hash))) {
      throw new ApiError(401, "Invalid administrator credentials", "admin_login_failed");
    }
    const token = createSessionToken();
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
    const metadata = clientMetadata(req);
    await db.query(
      `insert into public.admin_sessions(
         admin_user_id, token_hash, expires_at, ip_hash, user_agent
       ) values ($1,$2,$3,$4,$5)`,
      [
        admin.id,
        hashToken(token, config.sessionSecret),
        expiresAt.toISOString(),
        metadata.ipHash,
        metadata.userAgent
      ]
    );
    res.cookie(ADMIN_COOKIE, token, cookieOptions(config, 12 * 60 * 60 * 1000));
    res.json({ admin: { id: admin.id, email: admin.email, role: admin.role }, expiresAt });
  }));

  router.get("/admin/session", requireAdmin, asyncHandler(async (req, res) => {
    res.json({ admin: req.adminPrincipal });
  }));

  router.post("/admin/logout", requireAdmin, asyncHandler(async (req, res) => {
    await db.query(`update public.admin_sessions set revoked_at = now() where id = $1`, [
      req.adminPrincipal!.sessionId
    ]);
    res.clearCookie(ADMIN_COOKIE, { path: "/" });
    res.status(204).end();
  }));

  return router;
}
