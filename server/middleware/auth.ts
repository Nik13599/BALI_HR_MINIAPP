import type { NextFunction, Request, RequestHandler, Response } from "express";
import { one } from "../db.js";
import { ApiError, asyncHandler } from "../errors.js";
import { hashToken } from "../security.js";
import type { AppConfig, Queryable } from "../types.js";

export const USER_COOKIE = "bali_user_session";
export const ADMIN_COOKIE = "bali_admin_session";

function bearerToken(req: Request): string {
  const authorization = String(req.get("authorization") || "").trim();
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? String(match[1] || "").trim() : "";
}

function requestSessionToken(req: Request, cookieName: string): string {
  return String(req.cookies?.[cookieName] || bearerToken(req) || "").trim();
}

export function optionalUser(db: Queryable, config: AppConfig): RequestHandler {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    const token = requestSessionToken(req, USER_COOKIE);
    if (!token) return next();
    const row = await one<any>(
      db,
      `select s.id as session_id, s.app_user_key, s.last_seen_at, s.auth_method,
              coalesce(a.telegram_user_id::text, '') as telegram_user_id,
              u.name, u.username, u.account_status
         from public.user_sessions s
         join public.app_users u on u.user_key = s.app_user_key
         left join public.telegram_accounts a on a.app_user_key = s.app_user_key
        where s.token_hash = $1 and s.revoked_at is null and s.expires_at > now()
          and u.account_status = 'active' and u.blocked_at is null`,
      [hashToken(token, config.sessionSecret)]
    );
    if (row) {
      const telegramUserId = String(row.telegram_user_id || "");
      const authMethod = row.auth_method === "mobile" || row.auth_method === "telegram"
        ? row.auth_method
        : telegramUserId
          ? "telegram"
          : "mobile";
      let mustChangePassword = false;
      if (authMethod === "mobile") {
        const credential = await one<any>(
          db,
          `select must_change_password from public.mobile_credentials where app_user_key = $1`,
          [row.app_user_key]
        );
        mustChangePassword = Boolean(credential?.must_change_password);
      }
      req.userPrincipal = {
        kind: "user",
        userKey: row.app_user_key,
        telegramUserId,
        sessionId: String(row.session_id),
        name: row.name,
        username: row.username,
        status: row.account_status,
        authMethod,
        mustChangePassword
      };
      if (Date.now() - new Date(row.last_seen_at).getTime() > 300_000) {
        await db.query(
          `update public.user_sessions set last_seen_at = now()
            where id = $1 and last_seen_at < now() - interval '5 minutes'`,
          [row.session_id]
        );
      }
    }
    next();
  });
}

export const requireUser: RequestHandler = (req, _res, next) => {
  if (!req.userPrincipal) return next(new ApiError(401, "User session is required", "authentication_required"));
  next();
};

export function optionalAdmin(db: Queryable, config: AppConfig): RequestHandler {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    const token = requestSessionToken(req, ADMIN_COOKIE);
    if (!token) return next();
    const row = await one<any>(
      db,
      `select s.id as session_id, s.last_seen_at, a.id as admin_id, a.email, a.role, a.status
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
      if (Date.now() - new Date(row.last_seen_at).getTime() > 300_000) {
        await db.query(
          `update public.admin_sessions set last_seen_at = now()
            where id = $1 and last_seen_at < now() - interval '5 minutes'`,
          [row.session_id]
        );
      }
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
