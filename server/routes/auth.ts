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
