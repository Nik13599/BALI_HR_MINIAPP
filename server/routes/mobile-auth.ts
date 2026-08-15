import { Router } from "express";
import { one } from "../db.js";
import { ApiError, asyncHandler } from "../errors.js";
import { USER_COOKIE, cookieOptions, requireUser } from "../middleware/auth.js";
import { enforceRateLimit, requestSubject } from "../rate-limit.js";
import { createSessionToken, hashPassword, hashToken, sha256, verifyPassword } from "../security.js";
import type { AppConfig, Queryable } from "../types.js";
import { requiredText } from "../validation.js";

function normalizePhone(value: unknown): string {
  const raw = requiredText(value, "phone", 40);
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 15) {
    throw new ApiError(400, "Введите корректный номер телефона", "invalid_phone");
  }
  return `+${digits}`;
}

function normalizeTelegramUsername(value: unknown): string {
  const username = requiredText(value, "telegramUsername", 64).replace(/^@+/, "");
  if (!/^[A-Za-z0-9_]{5,32}$/.test(username)) {
    throw new ApiError(400, "Введите Telegram username в формате @username", "invalid_telegram_username");
  }
  return username;
}

function clientMetadata(req: any) {
  return {
    ipHash: sha256(String(req.ip || "")),
    userAgent: String(req.get("user-agent") || "").slice(0, 500)
  };
}

async function createMobileSession(db: Queryable, config: AppConfig, req: any, res: any, user: any) {
  const sessionToken = createSessionToken();
  const expiresAt = new Date(Date.now() + config.sessionTtlSeconds * 1000);
  const metadata = clientMetadata(req);
  await db.query(
    `insert into public.user_sessions(
       app_user_key, token_hash, telegram_auth_date, expires_at, ip_hash, user_agent, auth_method
     ) values ($1,$2,now(),$3,$4,$5,'mobile')`,
    [
      user.user_key,
      hashToken(sessionToken, config.sessionSecret),
      expiresAt.toISOString(),
      metadata.ipHash,
      metadata.userAgent
    ]
  );
  res.cookie(USER_COOKIE, sessionToken, cookieOptions(config, config.sessionTtlSeconds * 1000));
  return expiresAt;
}

export function createMobileAuthRouter(db: Queryable, config: AppConfig): Router {
  const router = Router();

  router.post("/mobile/register-request", asyncHandler(async (req, res) => {
    await enforceRateLimit(db, req, "auth.mobile_request", requestSubject(req));
    const phone = normalizePhone(req.body?.phone);
    const telegramUsername = normalizeTelegramUsername(req.body?.telegramUsername);
    const displayName = requiredText(req.body?.displayName, "displayName", 120, 2);

    const existing = await one<any>(db, `select app_user_key from public.mobile_credentials where phone = $1`, [phone]);
    if (existing) throw new ApiError(409, "Аккаунт с этим номером уже существует", "account_exists");

    const request = await one<any>(
      db,
      `insert into public.mobile_access_requests(
         request_type, phone, telegram_username, display_name, status
       ) values ('registration',$1,$2,$3,'pending')
       on conflict (phone, request_type) where status = 'pending'
       do update set telegram_username = excluded.telegram_username,
                     display_name = excluded.display_name,
                     requested_at = now(),
                     updated_at = now()
       returning id, status, requested_at`,
      [phone, telegramUsername, displayName]
    );
    res.status(202).json({ request, message: "Заявка отправлена администратору" });
  }));

  router.post("/mobile/reset-request", asyncHandler(async (req, res) => {
    await enforceRateLimit(db, req, "auth.mobile_reset", requestSubject(req));
    const phone = normalizePhone(req.body?.phone);
    const telegramUsername = normalizeTelegramUsername(req.body?.telegramUsername);
    const credential = await one<any>(
      db,
      `select app_user_key from public.mobile_credentials
        where phone = $1 and lower(telegram_username) = lower($2)`,
      [phone, telegramUsername]
    );
    if (credential) {
      await db.query(
        `insert into public.mobile_access_requests(
           request_type, phone, telegram_username, app_user_key, status
         ) values ('reset',$1,$2,$3,'pending')
         on conflict (phone, request_type) where status = 'pending'
         do update set telegram_username = excluded.telegram_username,
                       app_user_key = excluded.app_user_key,
                       requested_at = now(),
                       updated_at = now()`,
        [phone, telegramUsername, credential.app_user_key]
      );
    }
    res.status(202).json({ message: "Если данные совпали, администратор получил запрос на восстановление" });
  }));

  router.post("/mobile/login", asyncHandler(async (req, res) => {
    await enforceRateLimit(db, req, "auth.mobile_login", requestSubject(req));
    const phone = normalizePhone(req.body?.phone);
    const password = requiredText(req.body?.password, "password", 256);
    const row = await one<any>(
      db,
      `select c.app_user_key, c.password_hash, c.must_change_password, c.locked_until,
              u.user_key, u.name, u.username, u.avatar, u.account_status, u.blocked_at
         from public.mobile_credentials c
         join public.app_users u on u.user_key = c.app_user_key
        where c.phone = $1`,
      [phone]
    );
    if (!row || row.account_status !== "active" || row.blocked_at) {
      throw new ApiError(401, "Неверный номер телефона или пароль", "mobile_login_failed");
    }
    if (row.locked_until && new Date(row.locked_until).getTime() > Date.now()) {
      throw new ApiError(429, "Слишком много попыток. Попробуйте позже", "mobile_login_locked");
    }
    if (!(await verifyPassword(password, row.password_hash))) {
      await db.query(
        `update public.mobile_credentials
            set failed_login_count = failed_login_count + 1,
                locked_until = case when failed_login_count + 1 >= 8 then now() + interval '15 minutes' else locked_until end
          where app_user_key = $1`,
        [row.app_user_key]
      );
      throw new ApiError(401, "Неверный номер телефона или пароль", "mobile_login_failed");
    }

    await db.query(
      `update public.mobile_credentials
          set failed_login_count = 0, locked_until = null, last_login_at = now()
        where app_user_key = $1`,
      [row.app_user_key]
    );
    await db.query(
      `update public.app_users set last_seen_at = now(), opens = opens + 1, updated_at = now()
        where user_key = $1`,
      [row.app_user_key]
    );
    const expiresAt = await createMobileSession(db, config, req, res, row);
    await db.query(
      `insert into public.analytics_events(user_key, event_name, source, entity_type, entity_id, properties)
       values ($1,'app_open','mobile','user',$1,$2::jsonb)`,
      [row.app_user_key, JSON.stringify({ authMethod: "mobile" })]
    );
    res.json({
      user: { id: row.user_key, name: row.name, username: row.username, avatar: row.avatar },
      mustChangePassword: Boolean(row.must_change_password),
      expiresAt: expiresAt.toISOString()
    });
  }));

  router.post("/mobile/change-password", requireUser, asyncHandler(async (req, res) => {
    await enforceRateLimit(db, req, "auth.mobile_password", requestSubject(req));
    const currentPassword = requiredText(req.body?.currentPassword, "currentPassword", 256);
    const newPassword = requiredText(req.body?.newPassword, "newPassword", 128, 12);
    const credential = await one<any>(
      db,
      `select password_hash from public.mobile_credentials where app_user_key = $1`,
      [req.userPrincipal!.userKey]
    );
    if (!credential || !(await verifyPassword(currentPassword, credential.password_hash))) {
      throw new ApiError(401, "Текущий пароль введён неверно", "current_password_invalid");
    }
    if (await verifyPassword(newPassword, credential.password_hash)) {
      throw new ApiError(400, "Новый пароль должен отличаться от временного", "password_not_changed");
    }
    const passwordHash = await hashPassword(newPassword);
    await db.query(
      `update public.mobile_credentials
          set password_hash = $2,
              must_change_password = false,
              password_changed_at = now(),
              failed_login_count = 0,
              locked_until = null
        where app_user_key = $1`,
      [req.userPrincipal!.userKey, passwordHash]
    );
    await db.query(
      `update public.mobile_access_requests
          set status = 'completed', completed_at = now(), updated_at = now()
        where app_user_key = $1 and status = 'issued'`,
      [req.userPrincipal!.userKey]
    );
    await db.query(
      `update public.user_sessions set revoked_at = now()
        where app_user_key = $1 and id <> $2 and revoked_at is null`,
      [req.userPrincipal!.userKey, req.userPrincipal!.sessionId]
    );
    res.json({ ok: true, mustChangePassword: false });
  }));

  return router;
}
