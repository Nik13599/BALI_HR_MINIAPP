import type { NextFunction, Request, RequestHandler, Response } from "express";
import { one } from "../db.js";
import { ApiError, asyncHandler } from "../errors.js";
import { hashToken } from "../security.js";
import type { AppConfig, Queryable } from "../types.js";

export const USER_COOKIE = "bali_user_session";
export const ADMIN_COOKIE = "bali_admin_session";

export function optionalUser(db: Queryable, config: AppConfig): RequestHandler {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    const token = req.cookies?.[USER_COOKIE];
    if (!token) return next();
    const row = await one<any>(
      db,
      `select s.id as session_id, s.app_user_key, a.telegram_user_id,
              u.name, u.username, u.account_status
         from public.user_sessions s
         join public.app_users u on u.user_key = s.app_user_key
         join public.telegram_accounts a on a.app_user_key = s.app_user_key
        where s.token_hash = $1 and s.revoked_at is null and s.expires_at > now()
          and u.account_status = 'active' and u.blocked_at is null`,
      [hashToken(token, config.sessionSecret)]
    );
    if (row) {
      req.userPrincipal = {
        kind: "user",
        userKey: row.app_user_key,
        telegramUserId: String(row.telegram_user_id),
        sessionId: String(row.session_id),
        name: row.name,
        username: row.username,
        status: row.account_status
      };
      await db.query(
        `update public.user_sessions set last_seen_at = now() where id = $1`,
        [row.session_id]
      );
    }
    next();
  });
}

export const requireUser: RequestHandler = (req, _res, next) => {
  if (!req.userPrincipal) return next(new ApiError(401, "Verified Telegram session is required", "authentication_required"));
  next();
};

export function optionalAdmin(db: Queryable, config: AppConfig): RequestHandler {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    const token = req.cookies?.[ADMIN_COOKIE];
    if (!token) return next();
    const row = await one<any>(
      db,
      `select s.id as session_id, a.id as admin_id, a.email, a.role, a.status
         from public.admin_sessions s
         join public.admin_users a on a.id = s.admin_user_id
        where s.token_hash = $1 and s.revoked_at is null and s.expires_at > now()
          and a.status = 'active'`,
      [hashToken(token, config.sessionSecret)]
    );
    if (row) {
      req.adminPrincipal = {
        kind: "admin",
        adminId: String(row.admin_id),
        sessionId: String(row.session_id),
        email: row.email,
        role: row.role,
        status: row.status
      };
      await db.query(`update public.admin_sessions set last_seen_at = now() where id = $1`, [row.session_id]);
    }
    next();
  });
}

export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (!req.adminPrincipal) return next(new ApiError(401, "Administrator session is required", "admin_authentication_required"));
  next();
};

export function cookieOptions(config: AppConfig, maxAgeMs: number) {
  return {
    httpOnly: true,
    secure: config.secureCookies,
    sameSite: "strict" as const,
    path: "/",
    maxAge: maxAgeMs
  };
}
