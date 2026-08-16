// server/app.ts
import { randomUUID as randomUUID8 } from "node:crypto";
import { mkdirSync } from "node:fs";
import path2 from "node:path";
import cookieParser from "cookie-parser";
import express2 from "express";
import helmet from "helmet";

// server/routes/auth.ts
import { Router } from "express";

// server/db.ts
import pg from "pg";
function createPool(databaseUrl) {
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const configuredMax = Number.parseInt(process.env.DB_POOL_MAX || "", 10);
  const max = Number.isFinite(configuredMax) && configuredMax > 0 ? configuredMax : process.env.VERCEL ? 1 : 10;
  return new pg.Pool({
    connectionString: databaseUrl,
    max,
    idleTimeoutMillis: 3e4,
    connectionTimeoutMillis: 1e4,
    ssl: /sslmode=require/i.test(databaseUrl) ? { rejectUnauthorized: false } : void 0
  });
}
async function one(db2, text, values = []) {
  const result = await db2.query(text, values);
  return result.rows[0] || null;
}
async function many(db2, text, values = []) {
  return (await db2.query(text, values)).rows;
}
async function transaction(db2, callback) {
  if (!db2.connect) return callback(db2);
  const client = await db2.connect();
  try {
    await client.query("begin");
    const result = await callback(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

// server/errors.ts
var ApiError = class extends Error {
  constructor(status, message, code = "request_failed", details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
};
function asyncHandler(handler2) {
  return (req, res, next) => void handler2(req, res, next).catch(next);
}
var notFoundHandler = (req, _res, next) => {
  next(new ApiError(404, `Route ${req.method} ${req.path} was not found`, "not_found"));
};
var errorHandler = (error, req, res, _next) => {
  const status = Number(error?.status || 500);
  if (status >= 500) console.error(`[${req.requestId}]`, error);
  const retryAfter = Number(error?.details?.retryAfter);
  if (status === 429 && Number.isFinite(retryAfter) && retryAfter > 0) {
    res.setHeader("Retry-After", String(Math.ceil(retryAfter)));
  }
  res.status(status).json({
    error: {
      code: error?.code || (status >= 500 ? "internal_error" : "request_failed"),
      message: status >= 500 ? "Internal server error" : String(error?.message || "Request failed"),
      details: status >= 500 ? void 0 : error?.details,
      requestId: req.requestId
    }
  });
};

// server/security.ts
import {
  createHash,
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual
} from "node:crypto";
import { promisify } from "node:util";
var scrypt = promisify(scryptCallback);
var AuthenticationError = class extends Error {
  status = 401;
};
function hashToken(token, secret) {
  return createHmac("sha256", secret).update(token).digest("hex");
}
function createSessionToken() {
  return randomBytes(32).toString("base64url");
}
function verifyTelegramInitData(initData, botToken, maxAgeSeconds, nowSeconds = Math.floor(Date.now() / 1e3)) {
  if (!initData || !botToken) throw new AuthenticationError("Telegram authentication is unavailable");
  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash") || "";
  params.delete("hash");
  params.delete("signature");
  if (!/^[a-f0-9]{64}$/i.test(receivedHash)) throw new AuthenticationError("Invalid Telegram signature");
  const dataCheckString = [...params.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${key}=${value}`).join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expectedHash = createHmac("sha256", secretKey).update(dataCheckString).digest();
  const receivedBuffer = Buffer.from(receivedHash, "hex");
  if (receivedBuffer.length !== expectedHash.length || !timingSafeEqual(receivedBuffer, expectedHash)) {
    throw new AuthenticationError("Invalid Telegram signature");
  }
  const authDate = Number(params.get("auth_date") || 0);
  if (!Number.isInteger(authDate) || authDate <= 0) throw new AuthenticationError("Invalid Telegram auth date");
  const age = nowSeconds - authDate;
  if (age < -30 || age > maxAgeSeconds) throw new AuthenticationError("Telegram authentication expired");
  let user;
  try {
    user = JSON.parse(params.get("user") || "");
  } catch {
    throw new AuthenticationError("Invalid Telegram user payload");
  }
  if (!Number.isSafeInteger(user?.id) || user.id <= 0 || !String(user.first_name || "").trim()) {
    throw new AuthenticationError("Invalid Telegram user payload");
  }
  return {
    user,
    authDate,
    queryId: params.get("query_id") || void 0,
    startParam: params.get("start_param") || void 0
  };
}
async function hashPassword(password) {
  if (password.length < 12) throw new Error("Administrator password must contain at least 12 characters");
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  return `scrypt:${salt.toString("base64url")}:${derived.toString("base64url")}`;
}
async function verifyPassword(password, encoded) {
  const [algorithm, saltText, hashText] = String(encoded || "").split(":");
  if (algorithm !== "scrypt" || !saltText || !hashText) return false;
  const expected = Buffer.from(hashText, "base64url");
  const derived = await scrypt(password, Buffer.from(saltText, "base64url"), expected.length);
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}
function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

// server/middleware/auth.ts
var USER_COOKIE = "bali_user_session";
var ADMIN_COOKIE = "bali_admin_session";
function optionalUser(db2, config2) {
  return asyncHandler(async (req, _res, next) => {
    const token = req.cookies?.[USER_COOKIE];
    if (!token) return next();
    const row = await one(
      db2,
      `select s.id as session_id, s.app_user_key, s.last_seen_at,
              coalesce(a.telegram_user_id::text, '') as telegram_user_id,
              u.name, u.username, u.account_status
         from public.user_sessions s
         join public.app_users u on u.user_key = s.app_user_key
         left join public.telegram_accounts a on a.app_user_key = s.app_user_key
        where s.token_hash = $1 and s.revoked_at is null and s.expires_at > now()
          and u.account_status = 'active' and u.blocked_at is null`,
      [hashToken(token, config2.sessionSecret)]
    );
    if (row) {
      const telegramUserId = String(row.telegram_user_id || "");
      let mustChangePassword = false;
      if (!telegramUserId) {
        const credential = await one(
          db2,
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
        authMethod: telegramUserId ? "telegram" : "mobile",
        mustChangePassword
      };
      if (Date.now() - new Date(row.last_seen_at).getTime() > 3e5) {
        await db2.query(
          `update public.user_sessions set last_seen_at = now()
            where id = $1 and last_seen_at < now() - interval '5 minutes'`,
          [row.session_id]
        );
      }
    }
    next();
  });
}
var requireUser = (req, _res, next) => {
  if (!req.userPrincipal) return next(new ApiError(401, "User session is required", "authentication_required"));
  next();
};
function optionalAdmin(db2, config2) {
  return asyncHandler(async (req, _res, next) => {
    const token = req.cookies?.[ADMIN_COOKIE];
    if (!token) return next();
    const row = await one(
      db2,
      `select s.id as session_id, s.last_seen_at, a.id as admin_id, a.email, a.role, a.status
         from public.admin_sessions s
         join public.admin_users a on a.id = s.admin_user_id
        where s.token_hash = $1 and s.revoked_at is null and s.expires_at > now()
          and a.status = 'active'`,
      [hashToken(token, config2.sessionSecret)]
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
      if (Date.now() - new Date(row.last_seen_at).getTime() > 3e5) {
        await db2.query(
          `update public.admin_sessions set last_seen_at = now()
            where id = $1 and last_seen_at < now() - interval '5 minutes'`,
          [row.session_id]
        );
      }
    }
    next();
  });
}
var requireAdmin = (req, _res, next) => {
  if (!req.adminPrincipal) return next(new ApiError(401, "Administrator session is required", "admin_authentication_required"));
  next();
};
function cookieOptions(config2, maxAgeMs) {
  return {
    httpOnly: true,
    secure: config2.secureCookies,
    sameSite: "strict",
    path: "/",
    maxAge: maxAgeMs
  };
}

// server/rate-limit.ts
var DEFAULTS = {
  "auth.telegram": { limit: 10, windowSeconds: 60 },
  "auth.admin": { limit: 8, windowSeconds: 300 },
  "message.create": { limit: 20, windowSeconds: 60 },
  "message.repeat": { limit: 3, windowSeconds: 300 },
  "message.mentions": { limit: 8, windowSeconds: 60 },
  "message.links": { limit: 5, windowSeconds: 60 },
  "poll.create": { limit: 5, windowSeconds: 3600 },
  "poll.vote": { limit: 30, windowSeconds: 60 },
  "event.attach": { limit: 10, windowSeconds: 3600 },
  "report.create": { limit: 5, windowSeconds: 3600 },
  "notification.broadcast": { limit: 3, windowSeconds: 3600 },
  "connection.create": { limit: 10, windowSeconds: 86400 },
  "invitation.create": { limit: 20, windowSeconds: 86400 },
  "event_invitation.create": { limit: 20, windowSeconds: 86400 },
  "direct_message.create": { limit: 60, windowSeconds: 60 },
  "user_report.create": { limit: 5, windowSeconds: 86400 },
  "gift.create": { limit: 20, windowSeconds: 3600 },
  "booking.hold": { limit: 10, windowSeconds: 60 },
  "game.session": { limit: 30, windowSeconds: 3600 },
  "content.upload": { limit: 30, windowSeconds: 3600 }
};
function requestSubject(req, suffix = "") {
  const principal = req.userPrincipal?.userKey || req.adminPrincipal?.adminId || req.ip || "unknown";
  return suffix ? `${principal}:${suffix}` : principal;
}
async function enforceRateLimit(db2, req, bucket, subjectKey, cost = 1) {
  const stored = await one(
    db2,
    `select limit_count, window_seconds, enabled
       from public.rate_limit_settings where bucket = $1`,
    [bucket]
  );
  const fallback = DEFAULTS[bucket] || { limit: 30, windowSeconds: 60 };
  const limit = Number(stored?.limit_count || fallback.limit);
  const windowSeconds = Number(stored?.window_seconds || fallback.windowSeconds);
  if (stored?.enabled === false) return;
  const now = Date.now();
  const windowMs = windowSeconds * 1e3;
  const requestCost = Math.max(1, Math.min(1e3, Math.floor(cost)));
  const start = new Date(Math.floor(now / windowMs) * windowMs);
  const expires = new Date(start.getTime() + windowMs);
  const row = await one(
    db2,
    `insert into public.rate_limit_buckets(
       bucket, subject_key, window_started_at, request_count, expires_at
     ) values ($1, $2, $3, $4, $5)
     on conflict (bucket, subject_key, window_started_at)
     do update set request_count = public.rate_limit_buckets.request_count + excluded.request_count
     returning request_count`,
    [bucket, subjectKey, start.toISOString(), requestCost, expires.toISOString()]
  );
  if (Number(row?.request_count || 1) > limit) {
    const retryAfter = Math.max(1, Math.ceil((expires.getTime() - now) / 1e3));
    throw new ApiError(429, "Too many requests", "rate_limit_exceeded", {
      bucket,
      retryAfter,
      requestId: req.requestId
    });
  }
}

// server/validation.ts
function requiredText(value, field, maxLength, minLength = 1) {
  const text = String(value ?? "").trim();
  if (text.length < minLength || text.length > maxLength) {
    throw new ApiError(400, `${field} must contain ${minLength}-${maxLength} characters`, "validation_error");
  }
  return text;
}
function optionalText(value, maxLength) {
  const text = String(value ?? "").trim();
  if (text.length > maxLength) throw new ApiError(400, `Text is longer than ${maxLength} characters`, "validation_error");
  return text;
}
function uuid(value, field = "id") {
  const text = String(value || "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    throw new ApiError(400, `${field} is invalid`, "validation_error");
  }
  return text;
}
function identifier(value, field = "id") {
  const text = String(value || "").trim();
  if (!/^[a-zA-Z0-9:_-]{1,160}$/.test(text)) throw new ApiError(400, `${field} is invalid`, "validation_error");
  return text;
}
function boundedInteger(value, fallback, min, max) {
  if (value === void 0 || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new ApiError(400, `Value must be an integer from ${min} to ${max}`, "validation_error");
  }
  return parsed;
}
function booleanValue(value, fallback = false) {
  if (value === void 0) return fallback;
  if (value === true || value === false) return value;
  throw new ApiError(400, "Value must be a boolean", "validation_error");
}
function enumValue(value, field, allowed) {
  const text = String(value ?? "").trim();
  if (!allowed.includes(text)) {
    throw new ApiError(400, `${field} must be one of: ${allowed.join(", ")}`, "validation_error");
  }
  return text;
}
function boundedNumber(value, fallback, min, max) {
  if (value === void 0 || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new ApiError(400, `Value must be a number from ${min} to ${max}`, "validation_error");
  }
  return parsed;
}
function uniqueStrings(value, field, min, max, itemMax = 200) {
  if (!Array.isArray(value)) throw new ApiError(400, `${field} must be an array`, "validation_error");
  const rows = [...new Set(value.map((item) => requiredText(item, field, itemMax)))];
  if (rows.length < min || rows.length > max) {
    throw new ApiError(400, `${field} must contain ${min}-${max} unique values`, "validation_error");
  }
  return rows;
}
function isoDateOrNull(value) {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new ApiError(400, "Invalid date", "validation_error");
  return date.toISOString();
}

// server/routes/auth.ts
function clientMetadata(req) {
  return {
    ipHash: sha256(String(req.ip || "")),
    userAgent: String(req.get("user-agent") || "").slice(0, 500)
  };
}
function createAuthRouter(db2, config2) {
  const router = Router();
  router.post("/telegram", asyncHandler(async (req, res) => {
    await enforceRateLimit(db2, req, "auth.telegram", requestSubject(req));
    let verified;
    try {
      verified = verifyTelegramInitData(
        String(req.body?.initData || ""),
        config2.telegramBotToken,
        config2.telegramAuthMaxAgeSeconds
      );
    } catch (error) {
      if (error instanceof AuthenticationError) throw new ApiError(401, error.message, "telegram_auth_failed");
      throw error;
    }
    const telegram = verified.user;
    const userKey = `tg:${telegram.id}`;
    const fullName = `${telegram.first_name || ""} ${telegram.last_name || ""}`.trim() || "\u0413\u043E\u0441\u0442\u044C BALI";
    const existing = await one(
      db2,
      `select app_user_key from public.telegram_accounts where telegram_user_id = $1`,
      [telegram.id]
    );
    if (!existing) {
      const legacy = await one(
        db2,
        `select user_key
           from public.app_users
          where telegram_id = $1 and user_key <> $2
          limit 1`,
        [String(telegram.id), userKey]
      );
      if (legacy) {
        await db2.query(
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
    const expiresAt = new Date(Date.now() + config2.sessionTtlSeconds * 1e3);
    const metadata = clientMetadata(req);
    const account = await transaction(db2, async (client) => {
      const user = await one(
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
        const claim = await one(
          client,
          `insert into public.idempotency_records(
             scope, idempotency_key, actor_key, completed_at
           ) values ('points',$1,$2,now())
           on conflict (scope, idempotency_key) do nothing
           returning idempotency_key`,
          [registrationKey, linkedUserKey]
        );
        if (claim) {
          const settings = await one(
            client,
            `select registration_points as amount
               from public.economy_settings
              where singleton = true`
          );
          const amount = Number(settings?.amount || 0);
          const account2 = await one(
            client,
            `select balance from public.point_accounts
              where user_key = $1 for update`,
            [linkedUserKey]
          );
          const balanceBefore = Number(account2?.balance || 0);
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
                "\u041D\u0430\u0447\u0438\u0441\u043B\u0435\u043D\u0438\u0435 \u0437\u0430 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044E",
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
          hashToken(sessionToken, config2.sessionSecret),
          new Date(verified.authDate * 1e3).toISOString(),
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
    res.cookie(USER_COOKIE, sessionToken, cookieOptions(config2, config2.sessionTtlSeconds * 1e3));
    res.status(201).json({
      user: {
        id: account.user_key,
        name: account.name,
        username: account.username,
        avatar: account.avatar
      },
      environment: config2.environment,
      expiresAt: expiresAt.toISOString()
    });
  }));
  router.get("/session", requireUser, asyncHandler(async (req, res) => {
    res.json({
      user: {
        id: req.userPrincipal.userKey,
        name: req.userPrincipal.name,
        username: req.userPrincipal.username
      },
      environment: config2.environment
    });
  }));
  router.post("/logout", requireUser, asyncHandler(async (req, res) => {
    await db2.query(`update public.user_sessions set revoked_at = now() where id = $1`, [
      req.userPrincipal.sessionId
    ]);
    res.clearCookie(USER_COOKIE, { path: "/" });
    res.status(204).end();
  }));
  router.post("/admin/login", asyncHandler(async (req, res) => {
    await enforceRateLimit(db2, req, "auth.admin", requestSubject(req));
    const email = requiredText(req.body?.email, "email", 320).toLowerCase();
    const password = requiredText(req.body?.password, "password", 1e3);
    const admin = await one(
      db2,
      `select id, email, password_hash, role, status from public.admin_users where email = $1`,
      [email]
    );
    if (!admin || admin.status !== "active" || !await verifyPassword(password, admin.password_hash)) {
      throw new ApiError(401, "Invalid administrator credentials", "admin_login_failed");
    }
    const token = createSessionToken();
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1e3);
    const metadata = clientMetadata(req);
    await db2.query(
      `insert into public.admin_sessions(
         admin_user_id, token_hash, expires_at, ip_hash, user_agent
       ) values ($1,$2,$3,$4,$5)`,
      [
        admin.id,
        hashToken(token, config2.sessionSecret),
        expiresAt.toISOString(),
        metadata.ipHash,
        metadata.userAgent
      ]
    );
    res.cookie(ADMIN_COOKIE, token, cookieOptions(config2, 12 * 60 * 60 * 1e3));
    res.json({ admin: { id: admin.id, email: admin.email, role: admin.role }, expiresAt });
  }));
  router.get("/admin/session", requireAdmin, asyncHandler(async (req, res) => {
    res.json({ admin: req.adminPrincipal });
  }));
  router.post("/admin/logout", requireAdmin, asyncHandler(async (req, res) => {
    await db2.query(`update public.admin_sessions set revoked_at = now() where id = $1`, [
      req.adminPrincipal.sessionId
    ]);
    res.clearCookie(ADMIN_COOKIE, { path: "/" });
    res.status(204).end();
  }));
  return router;
}

// server/routes/mobile-auth.ts
import { Router as Router2 } from "express";
function normalizePhone(value) {
  const raw = requiredText(value, "phone", 40);
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 15) {
    throw new ApiError(400, "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 \u043D\u043E\u043C\u0435\u0440 \u0442\u0435\u043B\u0435\u0444\u043E\u043D\u0430", "invalid_phone");
  }
  return `+${digits}`;
}
function normalizeTelegramUsername(value) {
  const username = requiredText(value, "telegramUsername", 64).replace(/^@+/, "");
  if (!/^[A-Za-z0-9_]{5,32}$/.test(username)) {
    throw new ApiError(400, "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 Telegram username \u0432 \u0444\u043E\u0440\u043C\u0430\u0442\u0435 @username", "invalid_telegram_username");
  }
  return username;
}
function clientMetadata2(req) {
  return {
    ipHash: sha256(String(req.ip || "")),
    userAgent: String(req.get("user-agent") || "").slice(0, 500)
  };
}
async function createMobileSession(db2, config2, req, res, user) {
  const sessionToken = createSessionToken();
  const expiresAt = new Date(Date.now() + config2.sessionTtlSeconds * 1e3);
  const metadata = clientMetadata2(req);
  await db2.query(
    `insert into public.user_sessions(
       app_user_key, token_hash, telegram_auth_date, expires_at, ip_hash, user_agent, auth_method
     ) values ($1,$2,now(),$3,$4,$5,'mobile')`,
    [
      user.user_key,
      hashToken(sessionToken, config2.sessionSecret),
      expiresAt.toISOString(),
      metadata.ipHash,
      metadata.userAgent
    ]
  );
  res.cookie(USER_COOKIE, sessionToken, cookieOptions(config2, config2.sessionTtlSeconds * 1e3));
  return expiresAt;
}
function createMobileAuthRouter(db2, config2) {
  const router = Router2();
  router.get("/mobile/session", requireUser, asyncHandler(async (req, res) => {
    res.json({
      user: {
        id: req.userPrincipal.userKey,
        name: req.userPrincipal.name,
        username: req.userPrincipal.username
      },
      authMethod: req.userPrincipal.authMethod,
      mustChangePassword: req.userPrincipal.mustChangePassword
    });
  }));
  router.post("/mobile/register-request", asyncHandler(async (req, res) => {
    await enforceRateLimit(db2, req, "auth.mobile_request", requestSubject(req));
    const phone = normalizePhone(req.body?.phone);
    const telegramUsername = normalizeTelegramUsername(req.body?.telegramUsername);
    const displayName = requiredText(req.body?.displayName, "displayName", 120, 2);
    const existing = await one(db2, `select app_user_key from public.mobile_credentials where phone = $1`, [phone]);
    if (existing) throw new ApiError(409, "\u0410\u043A\u043A\u0430\u0443\u043D\u0442 \u0441 \u044D\u0442\u0438\u043C \u043D\u043E\u043C\u0435\u0440\u043E\u043C \u0443\u0436\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442", "account_exists");
    const request = await one(
      db2,
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
    res.status(202).json({ request, message: "\u0417\u0430\u044F\u0432\u043A\u0430 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0430 \u0430\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u0443" });
  }));
  router.post("/mobile/reset-request", asyncHandler(async (req, res) => {
    await enforceRateLimit(db2, req, "auth.mobile_reset", requestSubject(req));
    const phone = normalizePhone(req.body?.phone);
    const telegramUsername = normalizeTelegramUsername(req.body?.telegramUsername);
    const credential = await one(
      db2,
      `select app_user_key from public.mobile_credentials
        where phone = $1 and lower(telegram_username) = lower($2)`,
      [phone, telegramUsername]
    );
    if (credential) {
      await db2.query(
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
    res.status(202).json({ message: "\u0415\u0441\u043B\u0438 \u0434\u0430\u043D\u043D\u044B\u0435 \u0441\u043E\u0432\u043F\u0430\u043B\u0438, \u0430\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440 \u043F\u043E\u043B\u0443\u0447\u0438\u043B \u0437\u0430\u043F\u0440\u043E\u0441 \u043D\u0430 \u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435" });
  }));
  router.post("/mobile/login", asyncHandler(async (req, res) => {
    await enforceRateLimit(db2, req, "auth.mobile_login", requestSubject(req));
    const phone = normalizePhone(req.body?.phone);
    const password = requiredText(req.body?.password, "password", 256);
    const row = await one(
      db2,
      `select c.app_user_key, c.password_hash, c.must_change_password, c.locked_until,
              u.user_key, u.name, u.username, u.avatar, u.account_status, u.blocked_at
         from public.mobile_credentials c
         join public.app_users u on u.user_key = c.app_user_key
        where c.phone = $1`,
      [phone]
    );
    if (!row || row.account_status !== "active" || row.blocked_at) {
      throw new ApiError(401, "\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u043D\u043E\u043C\u0435\u0440 \u0442\u0435\u043B\u0435\u0444\u043E\u043D\u0430 \u0438\u043B\u0438 \u043F\u0430\u0440\u043E\u043B\u044C", "mobile_login_failed");
    }
    if (row.locked_until && new Date(row.locked_until).getTime() > Date.now()) {
      throw new ApiError(429, "\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u043C\u043D\u043E\u0433\u043E \u043F\u043E\u043F\u044B\u0442\u043E\u043A. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u043F\u043E\u0437\u0436\u0435", "mobile_login_locked");
    }
    if (!await verifyPassword(password, row.password_hash)) {
      await db2.query(
        `update public.mobile_credentials
            set failed_login_count = failed_login_count + 1,
                locked_until = case when failed_login_count + 1 >= 8 then now() + interval '15 minutes' else locked_until end
          where app_user_key = $1`,
        [row.app_user_key]
      );
      throw new ApiError(401, "\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u043D\u043E\u043C\u0435\u0440 \u0442\u0435\u043B\u0435\u0444\u043E\u043D\u0430 \u0438\u043B\u0438 \u043F\u0430\u0440\u043E\u043B\u044C", "mobile_login_failed");
    }
    await db2.query(
      `update public.mobile_credentials
          set failed_login_count = 0, locked_until = null, last_login_at = now()
        where app_user_key = $1`,
      [row.app_user_key]
    );
    await db2.query(
      `update public.app_users set last_seen_at = now(), opens = opens + 1, updated_at = now()
        where user_key = $1`,
      [row.app_user_key]
    );
    const expiresAt = await createMobileSession(db2, config2, req, res, row);
    await db2.query(
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
    await enforceRateLimit(db2, req, "auth.mobile_password", requestSubject(req));
    const currentPassword = requiredText(req.body?.currentPassword, "currentPassword", 256);
    const newPassword = requiredText(req.body?.newPassword, "newPassword", 128, 12);
    const credential = await one(
      db2,
      `select password_hash from public.mobile_credentials where app_user_key = $1`,
      [req.userPrincipal.userKey]
    );
    if (!credential || !await verifyPassword(currentPassword, credential.password_hash)) {
      throw new ApiError(401, "\u0422\u0435\u043A\u0443\u0449\u0438\u0439 \u043F\u0430\u0440\u043E\u043B\u044C \u0432\u0432\u0435\u0434\u0451\u043D \u043D\u0435\u0432\u0435\u0440\u043D\u043E", "current_password_invalid");
    }
    if (await verifyPassword(newPassword, credential.password_hash)) {
      throw new ApiError(400, "\u041D\u043E\u0432\u044B\u0439 \u043F\u0430\u0440\u043E\u043B\u044C \u0434\u043E\u043B\u0436\u0435\u043D \u043E\u0442\u043B\u0438\u0447\u0430\u0442\u044C\u0441\u044F \u043E\u0442 \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E\u0433\u043E", "password_not_changed");
    }
    const passwordHash = await hashPassword(newPassword);
    await db2.query(
      `update public.mobile_credentials
          set password_hash = $2,
              must_change_password = false,
              password_changed_at = now(),
              failed_login_count = 0,
              locked_until = null
        where app_user_key = $1`,
      [req.userPrincipal.userKey, passwordHash]
    );
    await db2.query(
      `update public.mobile_access_requests
          set status = 'completed', completed_at = now(), updated_at = now()
        where app_user_key = $1 and status = 'issued'`,
      [req.userPrincipal.userKey]
    );
    await db2.query(
      `update public.user_sessions set revoked_at = now()
        where app_user_key = $1 and id <> $2 and revoked_at is null`,
      [req.userPrincipal.userKey, req.userPrincipal.sessionId]
    );
    res.json({ ok: true, mustChangePassword: false });
  }));
  return router;
}

// server/routes/clans.ts
import { Router as Router3 } from "express";

// server/permissions.ts
var MEMBER_PERMISSIONS = /* @__PURE__ */ new Set([
  "chat.read",
  "chat.write",
  "chat.reply",
  "message.read",
  "message.create",
  "message.reply",
  "message.delete_own",
  "poll.read",
  "poll.vote",
  "event.read",
  "report.create"
]);
var LEADER_PERMISSIONS = /* @__PURE__ */ new Set([
  ...MEMBER_PERMISSIONS,
  "chat.enable",
  "chat.disable",
  "chat.set_read_only",
  "chat.settings.update",
  "message.delete_any",
  "message.pin",
  "poll.create",
  "poll.finish",
  "poll.cancel",
  "poll.delete",
  "poll.pin",
  "event.attach",
  "event.detach",
  "event.set_primary",
  "event.link_poll",
  "event.pin",
  "announcement.create",
  "notification.broadcast",
  "member.restrict_chat",
  "member.unrestrict_chat",
  "audit.read"
]);
var WRITE_PERMISSIONS = /* @__PURE__ */ new Set([
  "chat.write",
  "chat.reply",
  "message.create",
  "message.reply"
]);
async function decidePermission(db2, principal, clanId, permission) {
  const context = await one(
    db2,
    `select
       m.id as membership_id, m.user_key, m.role, m.status as membership_status,
       c.id as clan_id, c.name as clan_name, c.clan_type, c.status as clan_status, c.leader_user_key,
       ch.id as chat_id, ch.enabled, ch.read_only, ch.own_delete_window_seconds, ch.settings
     from public.clan_memberships m
     join public.clans c on c.id = m.clan_id
     join public.clan_chats ch on ch.clan_id = c.id
     where m.clan_id = $1 and m.user_key = $2`,
    [clanId, principal.userKey]
  );
  if (!context || context.membership_status !== "active" || context.clan_status !== "active") {
    return { allowed: false, source: "none" };
  }
  const restriction = await one(
    db2,
    `select * from public.clan_chat_restrictions
      where chat_id = $1 and user_key = $2 and revoked_at is null
        and (expires_at is null or expires_at > now())
      order by created_at desc limit 1`,
    [context.chat_id, principal.userKey]
  );
  const override = await one(
    db2,
    `select effect from public.clan_chat_permission_grants
      where clan_id = $1 and user_key = $2 and permission_key = $3
        and revoked_at is null and (expires_at is null or expires_at > now())
      order by created_at desc limit 1`,
    [clanId, principal.userKey, permission]
  );
  const base = { membership: context, chat: context, restriction };
  if (override?.effect === "deny") return { ...base, allowed: false, source: "denied" };
  if (!context.enabled && permission !== "chat.read" && permission !== "message.read") {
    return { ...base, allowed: false, source: "denied" };
  }
  if (WRITE_PERMISSIONS.has(permission) && (context.read_only || restriction?.can_write === false)) {
    return { ...base, allowed: false, source: "denied" };
  }
  const isLeader = context.leader_user_key === principal.userKey || context.role === "leader";
  if (isLeader && LEADER_PERMISSIONS.has(permission)) return { ...base, allowed: true, source: "leader" };
  if (override?.effect === "allow") return { ...base, allowed: true, source: "grant" };
  if (MEMBER_PERMISSIONS.has(permission)) return { ...base, allowed: true, source: "member" };
  return { ...base, allowed: false, source: "none" };
}
function requireClanPermission(db2, permission) {
  return asyncHandler(async (req, _res, next) => {
    if (!req.userPrincipal) throw new ApiError(401, "User session is required", "authentication_required");
    const clanId = String(req.params.clanId || "");
    if (!clanId) throw new ApiError(400, "Clan id is required", "validation_error");
    const decision = await decidePermission(db2, req.userPrincipal, clanId, permission);
    req.permissionDecision = decision;
    if (!decision.allowed) {
      throw new ApiError(403, "The requested clan action is not permitted", "permission_denied", {
        permission
      });
    }
    next();
  });
}
function actorTypeForDecision(decision) {
  if (decision?.source === "leader") return "leader";
  if (decision?.source === "grant") return "delegate";
  return "user";
}
async function effectivePermissionKeys(db2, principal, clanId) {
  const context = await one(
    db2,
    `select m.role, m.status as membership_status, c.status as clan_status,
            c.leader_user_key, ch.enabled, ch.read_only
       from public.clan_memberships m
       join public.clans c on c.id = m.clan_id
       join public.clan_chats ch on ch.clan_id = c.id
      where m.clan_id = $1 and m.user_key = $2`,
    [clanId, principal.userKey]
  );
  if (!context || context.membership_status !== "active" || context.clan_status !== "active") return [];
  const rows = (await db2.query(
    `select permission_key, effect
       from public.clan_chat_permission_grants
      where clan_id = $1 and user_key = $2 and revoked_at is null
        and (expires_at is null or expires_at > now())
      order by created_at asc`,
    [clanId, principal.userKey]
  )).rows;
  const keys = new Set(
    context.leader_user_key === principal.userKey || context.role === "leader" ? LEADER_PERMISSIONS : MEMBER_PERMISSIONS
  );
  for (const row of rows) {
    if (row.effect === "deny") keys.delete(row.permission_key);
    else keys.add(row.permission_key);
  }
  if (!context.enabled) {
    for (const key of [...keys]) if (!["chat.read", "message.read"].includes(key)) keys.delete(key);
  }
  if (context.read_only) {
    for (const key of WRITE_PERMISSIONS) keys.delete(key);
  }
  return [...keys].sort();
}

// server/audit.ts
async function writeAudit(db2, req, input) {
  let chatId2 = input.chatId || req.permissionDecision?.chat?.chat_id || null;
  if (!chatId2 && input.clanId) {
    const chat = await one(
      db2,
      `select id from public.clan_chats where clan_id = $1`,
      [input.clanId]
    );
    chatId2 = chat?.id || null;
  }
  const actorUserKey = req.userPrincipal?.userKey || (["user", "leader", "delegate"].includes(input.actorType) ? input.actorId : null);
  await db2.query(
    `insert into public.clan_chat_audit_log(
       actor_type, actor_id, actor_telegram_id, actor_user_key,
       permission_key, action, target_type, target_id, clan_id, chat_id,
       request_id, reason, before_value, after_value, metadata
     ) values (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15::jsonb
     )`,
    [
      input.actorType,
      input.actorId,
      req.userPrincipal?.telegramUserId || null,
      actorUserKey,
      input.permissionKey || "",
      input.action,
      input.targetType,
      input.targetId,
      input.clanId || null,
      chatId2,
      req.requestId,
      input.reason || "",
      input.before === void 0 ? null : JSON.stringify(input.before),
      input.after === void 0 ? null : JSON.stringify(input.after),
      JSON.stringify(input.metadata || {})
    ]
  );
}
async function writeAdminAudit(db2, req, input) {
  await db2.query(
    `insert into public.admin_audit_log(
       admin_user_id, actor_email, action, target_type, target_id,
       request_id, reason, before_value, after_value, ip_hash, user_agent
     ) values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11)`,
    [
      req.adminPrincipal.adminId,
      req.adminPrincipal.email,
      input.action,
      input.targetType,
      input.targetId || "",
      req.requestId,
      input.reason || "",
      input.before === void 0 ? null : JSON.stringify(input.before),
      input.after === void 0 ? null : JSON.stringify(input.after),
      sha256(String(req.ip || "")),
      String(req.get("user-agent") || "").slice(0, 500)
    ]
  );
}

// server/privacy.ts
var PRIVACY_MODES = /* @__PURE__ */ new Set(["public", "clan", "private"]);
var PRIVACY_FIELDS = [
  "avatar",
  "username",
  "phone",
  "birth_date",
  "status",
  "events",
  "clan"
];
function modeFor(privacy, field) {
  const defaultMode = ["avatar", "status", "clan"].includes(field) ? "public" : field === "events" ? "clan" : "private";
  const value = String(privacy?.[field] || defaultMode);
  return PRIVACY_MODES.has(value) ? value : "private";
}
async function visibleProfile(db2, viewerUserKey, targetUserKey) {
  const target = await one(
    db2,
    `select user_row.user_key,
            case when profile.display_name is not null and profile.display_name <> ''
              then profile.display_name else user_row.name end as name,
            user_row.username,
            case when profile.phone is not null and profile.phone <> ''
              then profile.phone else user_row.phone end as phone,
            case when profile.avatar_url is not null and profile.avatar_url <> ''
              then profile.avatar_url else user_row.avatar end as avatar,
            coalesce(profile.birth_date, user_row.birth_date) as birth_date,
            user_row.profile_privacy,
            user_row.account_status,
            profile.status_text,
            profile.bio,
            profile.interests,
            profile.gender,
            coalesce(profile.discoverable, true) as discoverable,
            coalesce(profile.allow_connections, true) as allow_connections,
            coalesce(profile.allow_event_invites, true) as allow_event_invites,
            coalesce(profile.allow_gifts, true) as allow_gifts
       from public.app_users user_row
       left join public.user_profiles profile on profile.user_key = user_row.user_key
      where user_row.user_key = $1 and user_row.account_status = 'active'`,
    [targetUserKey]
  );
  if (!target) throw new ApiError(404, "BALI profile was not found", "not_found");
  const ownProfile = viewerUserKey === targetUserKey;
  const viewer = ownProfile ? target : await one(
    db2,
    `select user_key from public.app_users
      where user_key = $1 and account_status = 'active'`,
    [viewerUserKey]
  );
  if (!viewer) throw new ApiError(401, "Viewer account is unavailable", "authentication_required");
  const [pairLow, pairHigh] = viewerUserKey < targetUserKey ? [viewerUserKey, targetUserKey] : [targetUserKey, viewerUserKey];
  const sharedClan = ownProfile ? true : Boolean(await one(
    db2,
    `select 1
       from public.clan_memberships mine
       join public.clan_memberships theirs on theirs.clan_id = mine.clan_id
      where mine.user_key = $1 and theirs.user_key = $2
        and mine.status = 'active' and theirs.status = 'active'
      limit 1`,
    [viewerUserKey, targetUserKey]
  ));
  const acceptedConnection = ownProfile ? true : Boolean(await one(
    db2,
    `select 1
       from public.user_connections connection
      where connection.pair_low = $1
        and connection.pair_high = $2
        and connection.status = 'accepted'
      limit 1`,
    [pairLow, pairHigh]
  ));
  const blocked = ownProfile ? false : Boolean(await one(
    db2,
    `select 1
       from public.user_blocks block
      where (block.blocker_user_key = $1 and block.blocked_user_key = $2)
         or (block.blocker_user_key = $2 and block.blocked_user_key = $1)
      limit 1`,
    [viewerUserKey, targetUserKey]
  ));
  if (blocked) throw new ApiError(404, "BALI profile was not found", "not_found");
  if (!target.discoverable && !ownProfile && !sharedClan && !acceptedConnection) {
    throw new ApiError(404, "BALI profile was not found", "not_found");
  }
  const canSee = (field) => {
    if (ownProfile) return true;
    const mode = modeFor(target.profile_privacy, field);
    if (mode === "public") return true;
    if (mode === "clan") return sharedClan;
    return false;
  };
  const result = {
    id: target.user_key,
    name: target.name,
    bio: target.bio || "",
    interests: target.interests || [],
    gender: target.gender || "unspecified",
    actions: {
      canConnect: !ownProfile && Boolean(target.allow_connections),
      canInvite: !ownProfile && Boolean(target.allow_event_invites),
      canGift: !ownProfile && Boolean(target.allow_gifts)
    },
    privacy: ownProfile ? target.profile_privacy : void 0
  };
  if (canSee("avatar") && target.avatar) result.avatar = target.avatar;
  if (canSee("username") && target.username) result.username = target.username;
  if (canSee("phone") && target.phone) result.phone = target.phone;
  if (canSee("birth_date") && target.birth_date) result.birthDate = target.birth_date;
  if (canSee("status") && target.status_text) result.status = target.status_text;
  if (canSee("clan")) {
    result.clans = await (async () => {
      const rows = await db2.query(
        `select clan.id, clan.name, clan.clan_type,
                profile.logo_url, profile.description
           from public.clan_memberships membership
           join public.clans clan on clan.id = membership.clan_id
           left join public.clan_profiles profile on profile.clan_id = clan.id
          where membership.user_key = $1
            and membership.status = 'active'
            and clan.status = 'active'
          order by clan.clan_type`,
        [targetUserKey]
      );
      return rows.rows;
    })();
  }
  if (canSee("events")) {
    result.upcomingEvent = await one(
      db2,
      `select event.id, event.title, event.event_date, event.event_time,
              attendance.status
         from public.event_attendance attendance
         join public.events event on event.id = attendance.event_id
         left join public.event_runtime runtime on runtime.event_id = event.id
        where attendance.user_key = $1
          and attendance.status in ('going', 'maybe')
          and coalesce(runtime.status, 'published') in ('published', 'active')
          and coalesce(runtime.ends_at, runtime.starts_at, event.event_date::timestamptz) > now()
        order by coalesce(runtime.starts_at, event.event_date::timestamptz)
        limit 1`,
      [targetUserKey]
    );
  }
  return result;
}
async function visibleProfiles(db2, viewerUserKey, targetUserKeys) {
  const uniqueTargets = [...new Set(targetUserKeys)].filter(Boolean).slice(0, 100);
  if (!uniqueTargets.length) return [];
  const viewer = await one(
    db2,
    `select user_key from public.app_users
      where user_key = $1 and account_status = 'active'`,
    [viewerUserKey]
  );
  if (!viewer) throw new ApiError(401, "Viewer account is unavailable", "authentication_required");
  const [targets, sharedRows, connectionRows, blockedRows, clanRows, eventRows] = await Promise.all([
    many(
      db2,
      `select user_row.user_key,
              case when profile.display_name is not null and profile.display_name <> ''
                then profile.display_name else user_row.name end as name,
              user_row.username,
              case when profile.phone is not null and profile.phone <> ''
                then profile.phone else user_row.phone end as phone,
              case when profile.avatar_url is not null and profile.avatar_url <> ''
                then profile.avatar_url else user_row.avatar end as avatar,
              coalesce(profile.birth_date, user_row.birth_date) as birth_date,
              user_row.profile_privacy, profile.status_text, profile.bio,
              profile.interests, profile.gender,
              coalesce(profile.discoverable, true) as discoverable,
              coalesce(profile.allow_connections, true) as allow_connections,
              coalesce(profile.allow_event_invites, true) as allow_event_invites,
              coalesce(profile.allow_gifts, true) as allow_gifts
         from public.app_users user_row
         left join public.user_profiles profile on profile.user_key = user_row.user_key
        where user_row.user_key = any($1::text[])
          and user_row.account_status = 'active'`,
      [uniqueTargets]
    ),
    many(
      db2,
      `select distinct theirs.user_key as target_user_key
         from public.clan_memberships mine
         join public.clan_memberships theirs on theirs.clan_id = mine.clan_id
        where mine.user_key = $1
          and theirs.user_key = any($2::text[])
          and mine.status = 'active' and theirs.status = 'active'`,
      [viewerUserKey, uniqueTargets]
    ),
    many(
      db2,
      `select case
                when requester_user_key = $1 then recipient_user_key
                else requester_user_key
              end as target_user_key
         from public.user_connections
        where status = 'accepted'
          and (requester_user_key = $1 or recipient_user_key = $1)
          and (requester_user_key = any($2::text[]) or recipient_user_key = any($2::text[]))`,
      [viewerUserKey, uniqueTargets]
    ),
    many(
      db2,
      `select case
                when blocker_user_key = $1 then blocked_user_key
                else blocker_user_key
              end as target_user_key
         from public.user_blocks
        where (blocker_user_key = $1 and blocked_user_key = any($2::text[]))
           or (blocked_user_key = $1 and blocker_user_key = any($2::text[]))`,
      [viewerUserKey, uniqueTargets]
    ),
    many(
      db2,
      `select membership.user_key as target_user_key,
              clan.id, clan.name, clan.clan_type,
              profile.logo_url, profile.description
         from public.clan_memberships membership
         join public.clans clan on clan.id = membership.clan_id
         left join public.clan_profiles profile on profile.clan_id = clan.id
        where membership.user_key = any($1::text[])
          and membership.status = 'active' and clan.status = 'active'
        order by membership.user_key, clan.clan_type`,
      [uniqueTargets]
    ),
    many(
      db2,
      `select distinct on (attendance.user_key)
              attendance.user_key as target_user_key,
              event.id, event.title, event.event_date, event.event_time,
              attendance.status
         from public.event_attendance attendance
         join public.events event on event.id = attendance.event_id
         left join public.event_runtime runtime on runtime.event_id = event.id
        where attendance.user_key = any($1::text[])
          and attendance.status in ('going', 'maybe')
          and coalesce(runtime.status, 'published') in ('published', 'active')
          and coalesce(runtime.ends_at, runtime.starts_at, event.event_date::timestamptz) > now()
        order by attendance.user_key,
                 coalesce(runtime.starts_at, event.event_date::timestamptz)`,
      [uniqueTargets]
    )
  ]);
  const shared = new Set(sharedRows.map((row) => row.target_user_key));
  const accepted = new Set(connectionRows.map((row) => row.target_user_key));
  const blocked = new Set(blockedRows.map((row) => row.target_user_key));
  const clans = /* @__PURE__ */ new Map();
  for (const row of clanRows) {
    const list = clans.get(row.target_user_key) || [];
    list.push({
      id: row.id,
      name: row.name,
      clan_type: row.clan_type,
      logo_url: row.logo_url,
      description: row.description
    });
    clans.set(row.target_user_key, list);
  }
  const events = new Map(eventRows.map((row) => [row.target_user_key, {
    id: row.id,
    title: row.title,
    event_date: row.event_date,
    event_time: row.event_time,
    status: row.status
  }]));
  const targetByKey = new Map(targets.map((target) => [target.user_key, target]));
  const output = [];
  for (const userKey of uniqueTargets) {
    const target = targetByKey.get(userKey);
    if (!target || blocked.has(userKey)) continue;
    const isShared = shared.has(userKey);
    if (!target.discoverable && !isShared && !accepted.has(userKey)) continue;
    const canSee = (field) => {
      const mode = modeFor(target.profile_privacy, field);
      return mode === "public" || mode === "clan" && isShared;
    };
    const result = {
      id: target.user_key,
      user_key: target.user_key,
      name: target.name,
      bio: target.bio || "",
      interests: target.interests || [],
      gender: target.gender || "unspecified",
      actions: {
        canConnect: Boolean(target.allow_connections),
        canInvite: Boolean(target.allow_event_invites),
        canGift: Boolean(target.allow_gifts)
      }
    };
    if (canSee("avatar") && target.avatar) result.avatar = target.avatar;
    if (canSee("username") && target.username) result.username = target.username;
    if (canSee("phone") && target.phone) result.phone = target.phone;
    if (canSee("birth_date") && target.birth_date) result.birthDate = target.birth_date;
    if (canSee("status") && target.status_text) result.status = target.status_text;
    if (canSee("clan")) result.clans = clans.get(userKey) || [];
    if (canSee("events")) result.upcomingEvent = events.get(userKey) || null;
    output.push(result);
  }
  return output;
}

// server/routes/clans.ts
function chatId(req) {
  const id = req.permissionDecision?.chat?.chat_id;
  if (!id) throw new ApiError(403, "Clan chat is unavailable", "chat_unavailable");
  return String(id);
}
function deletedText(row) {
  if (!row.deleted_at) return row.body;
  if (row.deleted_by_type === "admin") return "\u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u0443\u0434\u0430\u043B\u0435\u043D\u043E \u0430\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u043E\u043C BALI";
  if (["leader", "delegate"].includes(row.deleted_by_type)) return "\u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u0443\u0434\u0430\u043B\u0435\u043D\u043E \u0440\u0443\u043A\u043E\u0432\u043E\u0434\u0438\u0442\u0435\u043B\u0435\u043C \u043A\u043B\u0430\u043D\u0430";
  return "\u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u0443\u0434\u0430\u043B\u0435\u043D\u043E \u0430\u0432\u0442\u043E\u0440\u043E\u043C";
}
function serializeMessage(row) {
  return {
    id: row.id,
    body: deletedText(row),
    messageType: row.message_type,
    author: row.author_user_key ? {
      id: row.author_user_key,
      name: row.author_name || "\u0423\u0447\u0430\u0441\u0442\u043D\u0438\u043A BALI"
    } : null,
    reply: row.reply_to_message_id ? {
      id: row.reply_to_message_id,
      body: row.reply_deleted_at ? "\u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u0443\u0434\u0430\u043B\u0435\u043D\u043E" : row.reply_body,
      authorName: row.reply_author_name || "\u0423\u0447\u0430\u0441\u0442\u043D\u0438\u043A BALI"
    } : null,
    deleted: Boolean(row.deleted_at),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
async function listMessages(db2, id, before, limit) {
  const rows = await many(
    db2,
    `select m.*, u.name as author_name,
            parent.body as reply_body, parent.deleted_at as reply_deleted_at,
            parent_user.name as reply_author_name
       from public.clan_chat_messages m
       left join public.app_users u on u.user_key = m.author_user_key
       left join public.clan_chat_messages parent on parent.id = m.reply_to_message_id
       left join public.app_users parent_user on parent_user.user_key = parent.author_user_key
      where m.chat_id = $1
        and ($2::timestamptz is null or m.created_at < $2::timestamptz)
      order by m.created_at desc, m.id desc
      limit $3`,
    [id, before, limit]
  );
  return rows.reverse().map(serializeMessage);
}
async function pollBundle(db2, id, userKey) {
  const polls = await many(
    db2,
    `select * from public.clan_chat_polls
      where chat_id = $1 and status <> 'deleted'
      order by created_at desc limit 30`,
    [id]
  );
  if (!polls.length) return [];
  const result = [];
  for (const poll of polls) {
    const options = await many(
      db2,
      `select o.id, o.label, o.sort_order, count(v.id)::integer as votes
         from public.clan_chat_poll_options o
         left join public.clan_chat_poll_votes v on v.option_id = o.id
        where o.poll_id = $1
        group by o.id, o.label, o.sort_order
        order by o.sort_order`,
      [poll.id]
    );
    const mine = await many(
      db2,
      `select option_id from public.clan_chat_poll_votes
        where poll_id = $1 and voter_user_key = $2`,
      [poll.id, userKey]
    );
    result.push({
      ...poll,
      options,
      myOptionIds: mine.map((row) => row.option_id),
      responseCreatesCheckin: false
    });
  }
  return result;
}
async function ensureTargetInChat(db2, type, targetId, id) {
  const tables = {
    message: "clan_chat_messages",
    poll: "clan_chat_polls",
    event: "clan_chat_events",
    announcement: "clan_chat_announcements"
  };
  const table = tables[type];
  if (!table) throw new ApiError(400, "Unsupported pin target", "validation_error");
  const target = await one(db2, `select id from public.${table} where id = $1 and chat_id = $2`, [targetId, id]);
  if (!target) throw new ApiError(404, "Pin target was not found", "not_found");
}
function createClanRouter(db2) {
  const router = Router3();
  router.use(requireUser);
  router.get("/", asyncHandler(async (req, res) => {
    const rows = await many(
      db2,
      `select c.id, c.name, c.clan_type, m.role, ch.id as chat_id, ch.enabled, ch.read_only
         from public.clan_memberships m
         join public.clans c on c.id = m.clan_id and c.status = 'active'
         join public.clan_chats ch on ch.clan_id = c.id
        where m.user_key = $1 and m.status = 'active'
        order by c.name`,
      [req.userPrincipal.userKey]
    );
    const counts = rows.length ? await many(
      db2,
      `select message.chat_id, count(*)::integer as unread_count
             from public.clan_chat_messages message
             left join public.clan_chat_read_states read_state
               on read_state.chat_id = message.chat_id and read_state.user_key = $1
            where message.chat_id in (${rows.map((_, index) => `$${index + 2}`).join(",")})
              and message.deleted_at is null
              and message.created_at > coalesce(
                read_state.last_read_at,
                '1970-01-01T00:00:00Z'::timestamptz
              )
              and (message.author_user_key is null or message.author_user_key <> $1)
            group by message.chat_id`,
      [req.userPrincipal.userKey, ...rows.map((row) => row.chat_id)]
    ) : [];
    const countsByChat = new Map(
      counts.map((row) => [String(row.chat_id), Number(row.unread_count || 0)])
    );
    const clans = rows.map((row) => ({
      ...row,
      unread_count: countsByChat.get(String(row.chat_id)) || 0
    }));
    res.json({ clans });
  }));
  router.get("/ranking", asyncHandler(async (req, res) => {
    const rows = await many(
      db2,
      `select c.id, c.name, c.clan_type, c.rating_points,
              leader.name as leader_name,
              coalesce(members.member_count, 0)::integer as member_count,
              case when mine.clan_id is null then false else true end as is_member
         from public.clans c
         left join public.app_users leader on leader.user_key = c.leader_user_key
         left join (
           select clan_id, count(*) as member_count
             from public.clan_memberships
            where status = 'active'
            group by clan_id
         ) members on members.clan_id = c.id
         left join (
           select distinct clan_id
             from public.clan_memberships
            where user_key = $1 and status = 'active'
         ) mine on mine.clan_id = c.id
        where c.status = 'active'
        order by c.clan_type, c.rating_points desc, coalesce(members.member_count, 0) desc, c.name asc`,
      [req.userPrincipal.userKey]
    );
    const positions = { user: 0, corporate: 0 };
    const clans = rows.map((row) => {
      const clanType = row.clan_type === "corporate" ? "corporate" : "user";
      positions[clanType] += 1;
      return {
        id: row.id,
        name: row.name,
        clanType,
        leaderName: row.leader_name || "",
        ratingPoints: Number(row.rating_points || 0),
        memberCount: Number(row.member_count || 0),
        isMember: Boolean(row.is_member),
        position: positions[clanType]
      };
    });
    res.json({
      clans,
      categories: {
        user: clans.filter((row) => row.clanType === "user"),
        corporate: clans.filter((row) => row.clanType === "corporate")
      }
    });
  }));
  router.get("/invitations/me", asyncHandler(async (req, res) => {
    const invitations = await many(
      db2,
      `select invitation.*, clan.name as clan_name, clan.clan_type,
              inviter.name as inviter_name
         from public.clan_invitations invitation
         join public.clans clan on clan.id = invitation.clan_id
         join public.app_users inviter on inviter.user_key = invitation.inviter_user_key
        where invitation.invitee_user_key = $1
          and invitation.status = 'pending'
          and (invitation.expires_at is null or invitation.expires_at > now())
        order by invitation.created_at desc`,
      [req.userPrincipal.userKey]
    );
    res.json({ invitations });
  }));
  router.patch("/invitations/:invitationId", asyncHandler(async (req, res) => {
    const invitationId = uuid(req.params.invitationId, "invitationId");
    const status = req.body?.status === "accepted" ? "accepted" : req.body?.status === "declined" ? "declined" : "";
    if (!status) throw new ApiError(400, "status must be accepted or declined", "validation_error");
    const result = await transaction(db2, async (client) => {
      const invitation = await one(
        client,
        `select invitation.*, clan.clan_type, clan.status as clan_status
           from public.clan_invitations invitation
           join public.clans clan on clan.id = invitation.clan_id
          where invitation.id = $1 and invitation.invitee_user_key = $2
          for update`,
        [invitationId, req.userPrincipal.userKey]
      );
      if (!invitation) throw new ApiError(404, "Clan invitation was not found", "not_found");
      if (invitation.status !== "pending") {
        throw new ApiError(409, "Clan invitation has already been answered", "clan_invitation_answered");
      }
      if (invitation.expires_at && new Date(invitation.expires_at).getTime() <= Date.now()) {
        await client.query(
          `update public.clan_invitations set status = 'expired', updated_at = now() where id = $1`,
          [invitationId]
        );
        throw new ApiError(409, "Clan invitation has expired", "clan_invitation_expired");
      }
      if (invitation.clan_status !== "active") {
        throw new ApiError(409, "Clan is not active", "clan_unavailable");
      }
      if (status === "accepted") {
        const conflict = await one(
          client,
          `select clan.id, clan.name
             from public.clan_memberships membership
             join public.clans clan on clan.id = membership.clan_id
            where membership.user_key = $1
              and membership.status = 'active'
              and membership.clan_type = $2
            limit 1`,
          [req.userPrincipal.userKey, invitation.clan_type]
        );
        if (conflict) {
          throw new ApiError(
            409,
            "You already belong to a clan in this category",
            "clan_category_membership_conflict",
            { clanId: conflict.id, clanName: conflict.name, clanType: invitation.clan_type }
          );
        }
        await client.query(
          `insert into public.clan_memberships(
             clan_id, user_key, clan_type, role, status
           ) values ($1,$2,$3,'member','active')`,
          [invitation.clan_id, req.userPrincipal.userKey, invitation.clan_type]
        );
      }
      const updated = await one(
        client,
        `update public.clan_invitations
            set status = $2, responded_at = now(), updated_at = now()
          where id = $1 returning *`,
        [invitationId, status]
      );
      await client.query(
        `insert into public.notifications(
           user_key, notification_type, title, body, data, idempotency_key
         ) values ($1,'clan_invitation_response',$2,$3,$4::jsonb,$5)
         on conflict (idempotency_key) do nothing`,
        [
          invitation.inviter_user_key,
          status === "accepted" ? "\u041F\u0440\u0438\u0433\u043B\u0430\u0448\u0435\u043D\u0438\u0435 \u0432 \u043A\u043B\u0430\u043D \u043F\u0440\u0438\u043D\u044F\u0442\u043E" : "\u041F\u0440\u0438\u0433\u043B\u0430\u0448\u0435\u043D\u0438\u0435 \u0432 \u043A\u043B\u0430\u043D \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u043E",
          `${req.userPrincipal.name}: ${status === "accepted" ? "\u0432\u0441\u0442\u0443\u043F\u0438\u043B \u0432 \u043A\u043B\u0430\u043D" : "\u043E\u0442\u043A\u043B\u043E\u043D\u0438\u043B \u043F\u0440\u0438\u0433\u043B\u0430\u0448\u0435\u043D\u0438\u0435"}.`,
          JSON.stringify({ invitationId, clanId: invitation.clan_id, status }),
          `clan-invitation-response:${invitationId}`
        ]
      );
      return updated;
    });
    res.json({ invitation: result });
  }));
  router.post("/:clanId/invitations", asyncHandler(async (req, res) => {
    await enforceRateLimit(db2, req, "invitation.create", requestSubject(req, req.params.clanId));
    const inviteeUserKey = identifier(req.body?.inviteeUserKey, "inviteeUserKey");
    const message = optionalText(req.body?.message, 500);
    if (inviteeUserKey === req.userPrincipal.userKey) {
      throw new ApiError(400, "A leader cannot invite themselves", "validation_error");
    }
    const clan = await one(
      db2,
      `select clan.*, membership.role
         from public.clans clan
         join public.clan_memberships membership on membership.clan_id = clan.id
        where clan.id = $1
          and membership.user_key = $2
          and membership.status = 'active'`,
      [req.params.clanId, req.userPrincipal.userKey]
    );
    if (!clan || clan.status !== "active") {
      throw new ApiError(404, "Active clan was not found", "not_found");
    }
    if (clan.role !== "leader") {
      throw new ApiError(403, "Only the clan leader can invite members", "permission_denied");
    }
    const [invitee, conflict] = await Promise.all([
      one(
        db2,
        `select user_key, name from public.app_users
          where user_key = $1 and account_status = 'active'`,
        [inviteeUserKey]
      ),
      one(
        db2,
        `select clan.id, clan.name
           from public.clan_memberships membership
           join public.clans clan on clan.id = membership.clan_id
          where membership.user_key = $1
            and membership.status = 'active'
            and membership.clan_type = $2
          limit 1`,
        [inviteeUserKey, clan.clan_type]
      )
    ]);
    if (!invitee) throw new ApiError(404, "Invitee was not found", "not_found");
    if (conflict) {
      throw new ApiError(
        409,
        "This user already belongs to a clan in the same category",
        "clan_category_membership_conflict",
        { clanId: conflict.id, clanName: conflict.name, clanType: clan.clan_type }
      );
    }
    try {
      const invitation = await transaction(db2, async (client) => {
        const created = await one(
          client,
          `insert into public.clan_invitations(
             clan_id, inviter_user_key, invitee_user_key, message, expires_at
           ) values ($1,$2,$3,$4,now() + interval '7 days')
           returning *`,
          [clan.id, req.userPrincipal.userKey, inviteeUserKey, message]
        );
        await client.query(
          `insert into public.notifications(
             user_key, notification_type, title, body, data, idempotency_key
           ) values ($1,'clan_invitation',$2,$3,$4::jsonb,$5)
           on conflict (idempotency_key) do nothing`,
          [
            inviteeUserKey,
            "\u041F\u0440\u0438\u0433\u043B\u0430\u0448\u0435\u043D\u0438\u0435 \u0432 \u043A\u043B\u0430\u043D",
            `${req.userPrincipal.name} \u043F\u0440\u0438\u0433\u043B\u0430\u0448\u0430\u0435\u0442 \u0432\u0430\u0441 \u0432 \xAB${clan.name}\xBB.`,
            JSON.stringify({ invitationId: created.id, clanId: clan.id }),
            `clan-invitation:${created.id}`
          ]
        );
        return created;
      });
      res.status(201).json({ invitation });
    } catch (error) {
      if (error?.code === "23505") {
        throw new ApiError(409, "A pending invitation already exists", "clan_invitation_pending");
      }
      throw error;
    }
  }));
  router.get("/:clanId/chat", requireClanPermission(db2, "chat.read"), asyncHandler(async (req, res) => {
    const id = chatId(req);
    const limit = boundedInteger(req.query.limit, 50, 1, 100);
    const before = req.query.before ? isoDateOrNull(req.query.before) : null;
    const [messages, polls, events, announcements, pins, notificationPreference, permissions] = await Promise.all([
      listMessages(db2, id, before, limit),
      pollBundle(db2, id, req.userPrincipal.userKey),
      many(
        db2,
        `select ce.id, ce.is_primary, ce.created_at,
                e.id as event_id, e.title, e.event_date, e.event_time,
                e.description, e.image_url, e.active
           from public.clan_chat_events ce
           join public.events e on e.id = ce.event_id
          where ce.chat_id = $1
          order by ce.is_primary desc, e.event_date asc, e.event_time asc`,
        [id]
      ),
      many(
        db2,
        `select * from public.clan_chat_announcements
          where chat_id = $1 order by published_at desc limit 20`,
        [id]
      ),
      many(
        db2,
        `select * from public.clan_chat_pins
          where chat_id = $1 order by created_at desc`,
        [id]
      ),
      one(
        db2,
        `select muted_until, announcements_only
           from public.clan_chat_notification_preferences
          where chat_id = $1 and user_key = $2`,
        [id, req.userPrincipal.userKey]
      ),
      effectivePermissionKeys(db2, req.userPrincipal, req.params.clanId)
    ]);
    res.json({
      clan: {
        id: req.permissionDecision.membership.clan_id,
        name: req.permissionDecision.membership.clan_name,
        clanType: req.permissionDecision.membership.clan_type,
        role: req.permissionDecision.membership.role
      },
      chat: {
        id,
        enabled: req.permissionDecision.chat.enabled,
        readOnly: req.permissionDecision.chat.read_only,
        ownDeleteWindowSeconds: req.permissionDecision.chat.own_delete_window_seconds,
        settings: req.permissionDecision.chat.settings
      },
      permissions,
      messages,
      pagination: { hasMore: messages.length === limit, nextBefore: messages[0]?.createdAt || null },
      polls,
      events,
      announcements,
      pins,
      notificationPreference: notificationPreference || {
        muted_until: null,
        announcements_only: false
      }
    });
  }));
  router.get("/:clanId/messages", requireClanPermission(db2, "message.read"), asyncHandler(async (req, res) => {
    const limit = boundedInteger(req.query.limit, 50, 1, 100);
    const before = req.query.before ? isoDateOrNull(req.query.before) : null;
    const messages = await listMessages(db2, chatId(req), before, limit);
    res.json({
      messages,
      pagination: { hasMore: messages.length === limit, nextBefore: messages[0]?.createdAt || null }
    });
  }));
  router.get("/:clanId/members", requireClanPermission(db2, "chat.read"), asyncHandler(async (req, res) => {
    const rows = await many(
      db2,
      `select user_key, role from public.clan_memberships
        where clan_id = $1 and status = 'active'
        order by case when role = 'leader' then 0 else 1 end, joined_at`,
      [req.params.clanId]
    );
    const profiles = await visibleProfiles(
      db2,
      req.userPrincipal.userKey,
      rows.map((row) => row.user_key)
    );
    const profileByKey = new Map(profiles.map((profile) => [String(profile.id), profile]));
    const members = rows.filter((row) => profileByKey.has(row.user_key)).map((row) => ({ role: row.role, profile: profileByKey.get(row.user_key) }));
    res.json({ members });
  }));
  router.get("/:clanId/events/available", requireClanPermission(db2, "event.read"), asyncHandler(async (_req, res) => {
    const events = await many(
      db2,
      `select id, title, event_date, event_time, description, image_url
         from public.events
        where active = true and event_date >= current_date
        order by event_date, event_time limit 100`
    );
    res.json({ events });
  }));
  router.post("/:clanId/messages", requireClanPermission(db2, "message.create"), asyncHandler(async (req, res) => {
    await enforceRateLimit(db2, req, "message.create", requestSubject(req, req.params.clanId));
    const body = requiredText(req.body?.body, "body", 4e3);
    const replyToId = req.body?.replyToId ? uuid(req.body.replyToId, "replyToId") : null;
    const id = chatId(req);
    if (replyToId) {
      const replyPermission = await decidePermission(db2, req.userPrincipal, req.params.clanId, "message.reply");
      if (!replyPermission.allowed) throw new ApiError(403, "Reply is not permitted", "permission_denied");
      const parent = await one(
        db2,
        `select id from public.clan_chat_messages where id = $1 and chat_id = $2`,
        [replyToId, id]
      );
      if (!parent) throw new ApiError(404, "Reply target was not found", "not_found");
    }
    const links = body.match(/https?:\/\/\S+/gi) || [];
    if (links.length) {
      await enforceRateLimit(db2, req, "message.links", requestSubject(req, req.params.clanId), links.length);
    }
    const mentions = body.match(/@[\p{L}\p{N}_]{2,32}/gu) || [];
    if (mentions.length) {
      await enforceRateLimit(db2, req, "message.mentions", requestSubject(req, req.params.clanId), mentions.length);
    }
    const repeatedBodyKey = sha256(body.toLocaleLowerCase("ru").replace(/\s+/g, " ").trim()).slice(0, 24);
    await enforceRateLimit(
      db2,
      req,
      "message.repeat",
      requestSubject(req, `${req.params.clanId}:${repeatedBodyKey}`)
    );
    const message = await transaction(db2, async (client) => {
      const row = await one(
        client,
        `insert into public.clan_chat_messages(
           chat_id, author_user_key, body, reply_to_message_id
         ) values ($1,$2,$3,$4)
         returning *`,
        [id, req.userPrincipal.userKey, body, replyToId]
      );
      if (replyToId) {
        await client.query(
          `insert into public.clan_chat_message_replies(message_id, parent_message_id)
           values ($1,$2)`,
          [row.id, replyToId]
        );
      }
      return row;
    });
    res.status(201).json({ message: serializeMessage({ ...message, author_name: req.userPrincipal.name }) });
  }));
  router.delete("/:clanId/messages/:messageId", asyncHandler(async (req, res) => {
    const ownDecision = await decidePermission(db2, req.userPrincipal, req.params.clanId, "message.delete_own");
    if (!ownDecision.membership?.chat_id) throw new ApiError(403, "Clan access is denied", "permission_denied");
    const messageId = uuid(req.params.messageId, "messageId");
    const message = await one(
      db2,
      `select * from public.clan_chat_messages where id = $1 and chat_id = $2`,
      [messageId, ownDecision.membership.chat_id]
    );
    if (!message) throw new ApiError(404, "Message was not found", "not_found");
    if (message.deleted_at) return res.status(204).end();
    const isOwn = message.author_user_key === req.userPrincipal.userKey;
    const ageSeconds = (Date.now() - new Date(message.created_at).getTime()) / 1e3;
    let decision = ownDecision;
    if (!isOwn || ageSeconds > Number(ownDecision.chat?.own_delete_window_seconds || 0)) {
      decision = await decidePermission(db2, req.userPrincipal, req.params.clanId, "message.delete_any");
    }
    if (!decision.allowed) throw new ApiError(403, "Message deletion is not permitted", "permission_denied");
    const reason = optionalText(req.body?.reason, 500);
    const actorType = actorTypeForDecision(decision);
    const replacement = actorType === "leader" || actorType === "delegate" ? "\u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u0443\u0434\u0430\u043B\u0435\u043D\u043E \u0440\u0443\u043A\u043E\u0432\u043E\u0434\u0438\u0442\u0435\u043B\u0435\u043C \u043A\u043B\u0430\u043D\u0430" : "\u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u0443\u0434\u0430\u043B\u0435\u043D\u043E \u0430\u0432\u0442\u043E\u0440\u043E\u043C";
    await db2.query(
      `update public.clan_chat_messages
          set body = $1, deleted_at = now(), deleted_by_type = $2,
              deleted_by_id = $3, deletion_reason = $4
        where id = $5`,
      [replacement, actorType, req.userPrincipal.userKey, reason, messageId]
    );
    if (actorType !== "user") {
      await writeAudit(db2, req, {
        actorType,
        actorId: req.userPrincipal.userKey,
        permissionKey: "message.delete_any",
        action: "message.delete",
        targetType: "message",
        targetId: messageId,
        clanId: req.params.clanId,
        reason,
        before: { body: message.body, authorUserKey: message.author_user_key },
        after: { deleted: true }
      });
    }
    res.status(204).end();
  }));
  router.post("/:clanId/read", requireClanPermission(db2, "chat.read"), asyncHandler(async (req, res) => {
    const messageId = req.body?.messageId ? uuid(req.body.messageId, "messageId") : null;
    if (messageId) {
      const found = await one(
        db2,
        `select id from public.clan_chat_messages where id = $1 and chat_id = $2`,
        [messageId, chatId(req)]
      );
      if (!found) throw new ApiError(404, "Message was not found", "not_found");
    }
    await db2.query(
      `insert into public.clan_chat_read_states(chat_id, user_key, last_read_message_id, last_read_at)
       values ($1,$2,$3,now())
       on conflict (chat_id, user_key) do update set
         last_read_message_id = excluded.last_read_message_id,
         last_read_at = now(),
         updated_at = now()`,
      [chatId(req), req.userPrincipal.userKey, messageId]
    );
    res.status(204).end();
  }));
  router.post("/:clanId/messages/:messageId/reports", requireClanPermission(db2, "report.create"), asyncHandler(async (req, res) => {
    await enforceRateLimit(db2, req, "report.create", requestSubject(req, req.params.clanId));
    const messageId = uuid(req.params.messageId, "messageId");
    const reason = requiredText(req.body?.reason, "reason", 1e3);
    const message = await one(
      db2,
      `select id from public.clan_chat_messages where id = $1 and chat_id = $2`,
      [messageId, chatId(req)]
    );
    if (!message) throw new ApiError(404, "Message was not found", "not_found");
    const report = await one(
      db2,
      `insert into public.clan_chat_reports(chat_id, message_id, reporter_user_key, reason)
       values ($1,$2,$3,$4)
       on conflict (message_id, reporter_user_key) do update set
         reason = excluded.reason, status = 'new', updated_at = now()
       returning *`,
      [chatId(req), messageId, req.userPrincipal.userKey, reason]
    );
    res.status(201).json({ report });
  }));
  router.post("/:clanId/polls", requireClanPermission(db2, "poll.create"), asyncHandler(async (req, res) => {
    await enforceRateLimit(db2, req, "poll.create", requestSubject(req, req.params.clanId));
    const question = requiredText(req.body?.question, "question", 500);
    const options = uniqueStrings(req.body?.options, "options", 2, 10, 200);
    const closesAt = isoDateOrNull(req.body?.closesAt);
    if (closesAt && new Date(closesAt).getTime() <= Date.now()) {
      throw new ApiError(400, "Poll close time must be in the future", "validation_error");
    }
    const poll = await transaction(db2, async (client) => {
      const row = await one(
        client,
        `insert into public.clan_chat_polls(
           chat_id, created_by_user_key, question, allow_multiple,
           anonymous, show_results_before_vote, closes_at
         ) values ($1,$2,$3,$4,$5,$6,$7)
         returning *`,
        [
          chatId(req),
          req.userPrincipal.userKey,
          question,
          booleanValue(req.body?.allowMultiple),
          booleanValue(req.body?.anonymous),
          booleanValue(req.body?.showResultsBeforeVote),
          closesAt
        ]
      );
      for (let index = 0; index < options.length; index += 1) {
        await client.query(
          `insert into public.clan_chat_poll_options(poll_id, label, sort_order)
           values ($1,$2,$3)`,
          [row.id, options[index], index]
        );
      }
      return row;
    });
    await writeAudit(db2, req, {
      actorType: actorTypeForDecision(req.permissionDecision),
      actorId: req.userPrincipal.userKey,
      permissionKey: "poll.create",
      action: "poll.create",
      targetType: "poll",
      targetId: poll.id,
      clanId: req.params.clanId,
      after: { question, options }
    });
    res.status(201).json({ poll });
  }));
  router.post("/:clanId/polls/:pollId/votes", requireClanPermission(db2, "poll.vote"), asyncHandler(async (req, res) => {
    await enforceRateLimit(db2, req, "poll.vote", requestSubject(req, req.params.clanId));
    const pollId = uuid(req.params.pollId, "pollId");
    const optionIds = uniqueStrings(req.body?.optionIds, "optionIds", 1, 10, 80).map((value) => uuid(value, "optionId"));
    const poll = await one(
      db2,
      `select * from public.clan_chat_polls where id = $1 and chat_id = $2`,
      [pollId, chatId(req)]
    );
    if (!poll) throw new ApiError(404, "Poll was not found", "not_found");
    if (poll.status !== "active" || poll.closes_at && new Date(poll.closes_at).getTime() <= Date.now()) {
      throw new ApiError(409, "Poll is closed", "poll_closed");
    }
    if (!poll.allow_multiple && optionIds.length !== 1) {
      throw new ApiError(400, "This poll accepts one option", "validation_error");
    }
    const validOptions = await many(
      db2,
      `select id from public.clan_chat_poll_options where poll_id = $1`,
      [pollId]
    );
    const valid = new Set(validOptions.map((row) => String(row.id)));
    if (optionIds.some((id) => !valid.has(id))) throw new ApiError(400, "Poll option is invalid", "validation_error");
    await transaction(db2, async (client) => {
      await client.query(
        `delete from public.clan_chat_poll_votes where poll_id = $1 and voter_user_key = $2`,
        [pollId, req.userPrincipal.userKey]
      );
      for (const optionId of optionIds) {
        await client.query(
          `insert into public.clan_chat_poll_votes(poll_id, option_id, voter_user_key)
           values ($1,$2,$3)`,
          [pollId, optionId, req.userPrincipal.userKey]
        );
      }
    });
    res.json({ voted: true, optionIds, checkinCreated: false });
  }));
  for (const [action, permission, status] of [
    ["finish", "poll.finish", "finished"],
    ["cancel", "poll.cancel", "cancelled"]
  ]) {
    router.post(`/:clanId/polls/:pollId/${action}`, requireClanPermission(db2, permission), asyncHandler(async (req, res) => {
      const pollId = uuid(req.params.pollId, "pollId");
      const before = await one(
        db2,
        `select * from public.clan_chat_polls where id = $1 and chat_id = $2`,
        [pollId, chatId(req)]
      );
      if (!before) throw new ApiError(404, "Poll was not found", "not_found");
      const after = await one(
        db2,
        `update public.clan_chat_polls set status = $1 where id = $2 returning *`,
        [status, pollId]
      );
      await writeAudit(db2, req, {
        actorType: actorTypeForDecision(req.permissionDecision),
        actorId: req.userPrincipal.userKey,
        permissionKey: permission,
        action: `poll.${action}`,
        targetType: "poll",
        targetId: pollId,
        clanId: req.params.clanId,
        before,
        after
      });
      res.json({ poll: after });
    }));
  }
  router.delete("/:clanId/polls/:pollId", requireClanPermission(db2, "poll.delete"), asyncHandler(async (req, res) => {
    const pollId = uuid(req.params.pollId, "pollId");
    const before = await one(
      db2,
      `select * from public.clan_chat_polls where id = $1 and chat_id = $2`,
      [pollId, chatId(req)]
    );
    if (!before) throw new ApiError(404, "Poll was not found", "not_found");
    await db2.query(`update public.clan_chat_polls set status = 'deleted' where id = $1`, [pollId]);
    await writeAudit(db2, req, {
      actorType: actorTypeForDecision(req.permissionDecision),
      actorId: req.userPrincipal.userKey,
      permissionKey: "poll.delete",
      action: "poll.delete",
      targetType: "poll",
      targetId: pollId,
      clanId: req.params.clanId,
      before,
      after: { status: "deleted" }
    });
    res.status(204).end();
  }));
  router.post("/:clanId/events", requireClanPermission(db2, "event.attach"), asyncHandler(async (req, res) => {
    await enforceRateLimit(db2, req, "event.attach", requestSubject(req, req.params.clanId));
    const eventId = identifier(req.body?.eventId, "eventId");
    const event = await one(
      db2,
      `select id, title, event_date, event_time, active from public.events
        where id = $1 and active = true`,
      [eventId]
    );
    if (!event) throw new ApiError(404, "Official event was not found", "not_found");
    const attachment = await one(
      db2,
      `insert into public.clan_chat_events(chat_id, event_id, attached_by_user_key)
       values ($1,$2,$3)
       on conflict (chat_id, event_id) do update set updated_at = now()
       returning *`,
      [chatId(req), eventId, req.userPrincipal.userKey]
    );
    await writeAudit(db2, req, {
      actorType: actorTypeForDecision(req.permissionDecision),
      actorId: req.userPrincipal.userKey,
      permissionKey: "event.attach",
      action: "event.attach",
      targetType: "event_attachment",
      targetId: attachment.id,
      clanId: req.params.clanId,
      after: event
    });
    res.status(201).json({ attachment: { ...attachment, event } });
  }));
  router.delete("/:clanId/events/:attachmentId", requireClanPermission(db2, "event.detach"), asyncHandler(async (req, res) => {
    const attachmentId = uuid(req.params.attachmentId, "attachmentId");
    const before = await one(
      db2,
      `select * from public.clan_chat_events where id = $1 and chat_id = $2`,
      [attachmentId, chatId(req)]
    );
    if (!before) throw new ApiError(404, "Event attachment was not found", "not_found");
    await db2.query(`delete from public.clan_chat_events where id = $1`, [attachmentId]);
    await writeAudit(db2, req, {
      actorType: actorTypeForDecision(req.permissionDecision),
      actorId: req.userPrincipal.userKey,
      permissionKey: "event.detach",
      action: "event.detach",
      targetType: "event_attachment",
      targetId: attachmentId,
      clanId: req.params.clanId,
      before
    });
    res.status(204).end();
  }));
  router.post("/:clanId/events/:attachmentId/primary", requireClanPermission(db2, "event.set_primary"), asyncHandler(async (req, res) => {
    const attachmentId = uuid(req.params.attachmentId, "attachmentId");
    const updated = await transaction(db2, async (client) => {
      await client.query(`update public.clan_chat_events set is_primary = false where chat_id = $1`, [chatId(req)]);
      return one(
        client,
        `update public.clan_chat_events set is_primary = true
          where id = $1 and chat_id = $2 returning *`,
        [attachmentId, chatId(req)]
      );
    });
    if (!updated) throw new ApiError(404, "Event attachment was not found", "not_found");
    await writeAudit(db2, req, {
      actorType: actorTypeForDecision(req.permissionDecision),
      actorId: req.userPrincipal.userKey,
      permissionKey: "event.set_primary",
      action: "event.set_primary",
      targetType: "event_attachment",
      targetId: attachmentId,
      clanId: req.params.clanId,
      after: { isPrimary: true }
    });
    res.json({ attachment: updated });
  }));
  router.post("/:clanId/polls/:pollId/event", requireClanPermission(db2, "event.link_poll"), asyncHandler(async (req, res) => {
    const pollId = uuid(req.params.pollId, "pollId");
    const attachmentId = uuid(req.body?.attachmentId, "attachmentId");
    const linked = await one(
      db2,
      `update public.clan_chat_polls p set linked_event_attachment_id = $1
        where p.id = $2 and p.chat_id = $3
          and exists (
            select 1 from public.clan_chat_events e
             where e.id = $1 and e.chat_id = p.chat_id
          )
        returning *`,
      [attachmentId, pollId, chatId(req)]
    );
    if (!linked) throw new ApiError(404, "Poll or event attachment was not found", "not_found");
    await writeAudit(db2, req, {
      actorType: actorTypeForDecision(req.permissionDecision),
      actorId: req.userPrincipal.userKey,
      permissionKey: "event.link_poll",
      action: "event.link_poll",
      targetType: "poll",
      targetId: pollId,
      clanId: req.params.clanId,
      after: { attachmentId }
    });
    res.json({ poll: linked });
  }));
  router.post("/:clanId/announcements", requireClanPermission(db2, "announcement.create"), asyncHandler(async (req, res) => {
    const title = optionalText(req.body?.title, 200);
    const body = requiredText(req.body?.body, "body", 4e3);
    const result = await transaction(db2, async (client) => {
      const announcement = await one(
        client,
        `insert into public.clan_chat_announcements(
           chat_id, author_user_key, title, body, official
         ) values ($1,$2,$3,$4,false) returning *`,
        [chatId(req), req.userPrincipal.userKey, title, body]
      );
      await client.query(
        `insert into public.clan_chat_messages(
           chat_id, author_user_key, body, message_type
         ) values ($1,$2,$3,'announcement')`,
        [chatId(req), req.userPrincipal.userKey, title ? `${title}
${body}` : body]
      );
      return announcement;
    });
    await writeAudit(db2, req, {
      actorType: actorTypeForDecision(req.permissionDecision),
      actorId: req.userPrincipal.userKey,
      permissionKey: "announcement.create",
      action: "announcement.create",
      targetType: "announcement",
      targetId: result.id,
      clanId: req.params.clanId,
      after: { title, body }
    });
    res.status(201).json({ announcement: result });
  }));
  router.post("/:clanId/pins", asyncHandler(async (req, res) => {
    const type = requiredText(req.body?.targetType, "targetType", 30);
    const targetId = uuid(req.body?.targetId, "targetId");
    const permission = type === "message" ? "message.pin" : type === "poll" ? "poll.pin" : type === "event" ? "event.pin" : "announcement.create";
    const decision = await decidePermission(db2, req.userPrincipal, req.params.clanId, permission);
    req.permissionDecision = decision;
    if (!decision.allowed) throw new ApiError(403, "Pin is not permitted", "permission_denied");
    await ensureTargetInChat(db2, type, targetId, String(decision.chat.chat_id));
    const pin = await one(
      db2,
      `insert into public.clan_chat_pins(chat_id, target_type, target_id, pinned_by_user_key)
       values ($1,$2,$3,$4)
       on conflict (chat_id, target_type, target_id) do update set
         pinned_by_user_key = excluded.pinned_by_user_key
       returning *`,
      [decision.chat.chat_id, type, targetId, req.userPrincipal.userKey]
    );
    await writeAudit(db2, req, {
      actorType: actorTypeForDecision(decision),
      actorId: req.userPrincipal.userKey,
      permissionKey: permission,
      action: "pin.create",
      targetType: type,
      targetId,
      clanId: req.params.clanId,
      after: pin
    });
    res.status(201).json({ pin });
  }));
  router.delete("/:clanId/pins/:pinId", asyncHandler(async (req, res) => {
    const pinId = uuid(req.params.pinId, "pinId");
    const pin = await one(
      db2,
      `select p.*, ch.clan_id from public.clan_chat_pins p
       join public.clan_chats ch on ch.id = p.chat_id
       where p.id = $1 and ch.clan_id = $2`,
      [pinId, req.params.clanId]
    );
    if (!pin) throw new ApiError(404, "Pin was not found", "not_found");
    const permission = pin.target_type === "message" ? "message.pin" : pin.target_type === "poll" ? "poll.pin" : pin.target_type === "event" ? "event.pin" : "announcement.create";
    const decision = await decidePermission(db2, req.userPrincipal, req.params.clanId, permission);
    if (!decision.allowed) throw new ApiError(403, "Pin removal is not permitted", "permission_denied");
    await db2.query(`delete from public.clan_chat_pins where id = $1`, [pinId]);
    await writeAudit(db2, req, {
      actorType: actorTypeForDecision(decision),
      actorId: req.userPrincipal.userKey,
      permissionKey: permission,
      action: "pin.delete",
      targetType: pin.target_type,
      targetId: pin.target_id,
      clanId: req.params.clanId,
      before: pin
    });
    res.status(204).end();
  }));
  router.post("/:clanId/restrictions", requireClanPermission(db2, "member.restrict_chat"), asyncHandler(async (req, res) => {
    const userKey = identifier(req.body?.userKey, "userKey");
    const reason = requiredText(req.body?.reason, "reason", 1e3);
    const expiresAt = isoDateOrNull(req.body?.expiresAt);
    const member = await one(
      db2,
      `select id from public.clan_memberships
        where clan_id = $1 and user_key = $2 and status = 'active'`,
      [req.params.clanId, userKey]
    );
    if (!member) throw new ApiError(404, "Active clan member was not found", "not_found");
    const restriction = await one(
      db2,
      `insert into public.clan_chat_restrictions(
         chat_id, user_key, can_write, reason, expires_at, created_by_type, created_by_id
       ) values ($1,$2,false,$3,$4,$5,$6)
       on conflict (chat_id, user_key) where revoked_at is null
       do update set reason = excluded.reason, expires_at = excluded.expires_at,
         updated_at = now()
       returning *`,
      [
        chatId(req),
        userKey,
        reason,
        expiresAt,
        actorTypeForDecision(req.permissionDecision),
        req.userPrincipal.userKey
      ]
    );
    await writeAudit(db2, req, {
      actorType: actorTypeForDecision(req.permissionDecision),
      actorId: req.userPrincipal.userKey,
      permissionKey: "member.restrict_chat",
      action: "member.restrict_chat",
      targetType: "member",
      targetId: userKey,
      clanId: req.params.clanId,
      reason,
      after: restriction
    });
    res.status(201).json({ restriction });
  }));
  router.delete("/:clanId/restrictions/:userKey", requireClanPermission(db2, "member.unrestrict_chat"), asyncHandler(async (req, res) => {
    const userKey = identifier(req.params.userKey, "userKey");
    const before = await one(
      db2,
      `update public.clan_chat_restrictions
          set revoked_at = now(), updated_at = now()
        where chat_id = $1 and user_key = $2 and revoked_at is null
        returning *`,
      [chatId(req), userKey]
    );
    if (!before) throw new ApiError(404, "Active restriction was not found", "not_found");
    await writeAudit(db2, req, {
      actorType: actorTypeForDecision(req.permissionDecision),
      actorId: req.userPrincipal.userKey,
      permissionKey: "member.unrestrict_chat",
      action: "member.unrestrict_chat",
      targetType: "member",
      targetId: userKey,
      clanId: req.params.clanId,
      before
    });
    res.status(204).end();
  }));
  router.put("/:clanId/notifications", requireClanPermission(db2, "chat.read"), asyncHandler(async (req, res) => {
    const mutedUntil = isoDateOrNull(req.body?.mutedUntil);
    const preference = await one(
      db2,
      `insert into public.clan_chat_notification_preferences(
         chat_id, user_key, muted_until, announcements_only
       ) values ($1,$2,$3,$4)
       on conflict (chat_id, user_key) do update set
         muted_until = excluded.muted_until,
         announcements_only = excluded.announcements_only,
         updated_at = now()
       returning *`,
      [chatId(req), req.userPrincipal.userKey, mutedUntil, booleanValue(req.body?.announcementsOnly)]
    );
    res.json({ preference });
  }));
  router.get("/:clanId/audit", requireClanPermission(db2, "audit.read"), asyncHandler(async (req, res) => {
    const limit = boundedInteger(req.query.limit, 50, 1, 100);
    const rows = await many(
      db2,
      `select * from public.clan_chat_audit_log
        where clan_id = $1 and actor_id = $2
        order by created_at desc limit $3`,
      [req.params.clanId, req.userPrincipal.userKey, limit]
    );
    res.json({ audit: rows });
  }));
  return router;
}

// server/routes/admin.ts
import { randomUUID } from "node:crypto";
import { Router as Router4 } from "express";
function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.adminPrincipal || !roles.includes(req.adminPrincipal.role)) {
      return next(new ApiError(403, "Administrator role does not permit this action", "admin_permission_denied"));
    }
    next();
  };
}
function clanCategory(value) {
  const category = String(value || "").trim().toLowerCase();
  if (category !== "user" && category !== "corporate") {
    throw new ApiError(400, "clanType must be user or corporate", "validation_error");
  }
  return category;
}
async function clanChat(db2, clanId) {
  const row = await one(
    db2,
    `select c.id as clan_id, c.name as clan_name, c.clan_type, c.status as clan_status,
            c.rating_points,
            c.leader_user_key, ch.*
       from public.clans c
       join public.clan_chats ch on ch.clan_id = c.id
      where c.id = $1`,
    [clanId]
  );
  if (!row) throw new ApiError(404, "Clan chat was not found", "not_found");
  return row;
}
async function adminAudit(db2, req, input) {
  return writeAudit(db2, req, {
    actorType: "admin",
    actorId: req.adminPrincipal.adminId,
    ...input
  });
}
function csv(value) {
  const text = value === null || value === void 0 ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}
function createAdminRouter(db2) {
  const router = Router4();
  router.use(requireAdmin);
  router.get("/permissions", asyncHandler(async (_req, res) => {
    const permissions = await many(
      db2,
      `select * from public.clan_chat_permissions order by permission_key`
    );
    res.json({ permissions });
  }));
  router.get("/users", asyncHandler(async (req, res) => {
    const search = String(req.query.search || "").trim();
    const users = await many(
      db2,
      `select u.user_key, u.name, u.username,
              max(case when c.clan_type = 'user' and m.status = 'active' then c.name end) as user_clan_name,
              max(case when c.clan_type = 'corporate' and m.status = 'active' then c.name end) as corporate_clan_name
         from public.app_users u
         left join public.clan_memberships m on m.user_key = u.user_key
         left join public.clans c on c.id = m.clan_id
        where u.account_status = 'active'
          and ($1 = '' or lower(u.name) like '%' || lower($1) || '%'
            or lower(u.username) like '%' || lower($1) || '%')
        group by u.user_key, u.name, u.username
        order by u.name, u.user_key
        limit 200`,
      [search]
    );
    res.json({ users });
  }));
  router.post(
    "/clans",
    requireRole("admin", "superadmin"),
    asyncHandler(async (req, res) => {
      const name = requiredText(req.body?.name, "name", 120);
      const clanType = clanCategory(req.body?.clanType);
      const leaderUserKey = identifier(req.body?.leaderUserKey, "leaderUserKey");
      const ratingPoints = boundedInteger(req.body?.ratingPoints, 0, 0, 1e9);
      const reason = optionalText(req.body?.reason, 1e3);
      const clanId = `clan-${randomUUID()}`;
      const leader = await one(
        db2,
        `select user_key, name, username from public.app_users
          where user_key = $1 and account_status = 'active'`,
        [leaderUserKey]
      );
      if (!leader) throw new ApiError(404, "Active senior user was not found", "not_found");
      const conflict = await one(
        db2,
        `select c.id, c.name
           from public.clan_memberships m
           join public.clans c on c.id = m.clan_id
          where m.user_key = $1 and m.status = 'active' and c.clan_type = $2
          limit 1`,
        [leaderUserKey, clanType]
      );
      if (conflict) {
        throw new ApiError(
          409,
          `The selected senior already belongs to a ${clanType} clan`,
          "clan_category_membership_conflict",
          { clanId: conflict.id, clanName: conflict.name, clanType }
        );
      }
      let created;
      try {
        created = await transaction(db2, async (client) => {
          const clan = await one(
            client,
            `insert into public.clans(id, name, clan_type, leader_user_key, rating_points)
             values ($1,$2,$3,$4,$5)
             returning id, name, clan_type, leader_user_key, rating_points, status, created_at`,
            [clanId, name, clanType, leaderUserKey, ratingPoints]
          );
          await client.query(
            `insert into public.clan_memberships(clan_id, user_key, role, status, clan_type)
             values ($1,$2,'leader','active',$3)`,
            [clanId, leaderUserKey, clanType]
          );
          const chat = await one(
            client,
            `insert into public.clan_chats(clan_id)
             values ($1)
             on conflict (clan_id) do update set clan_id = excluded.clan_id
             returning id, clan_id, enabled, read_only`,
            [clanId]
          );
          return { clan, chat };
        });
      } catch (error) {
        if (error?.code === "23505") {
          throw new ApiError(
            409,
            `The selected senior already belongs to a ${clanType} clan`,
            "clan_category_membership_conflict"
          );
        }
        throw error;
      }
      await adminAudit(db2, req, {
        permissionKey: "clan.create",
        action: "clan.create",
        targetType: "clan",
        targetId: clanId,
        clanId,
        reason,
        after: {
          ...created.clan,
          leaderName: leader.name,
          leaderUserKey
        }
      });
      res.status(201).json(created);
    })
  );
  router.get("/chats", asyncHandler(async (req, res) => {
    const search = String(req.query.search || "").trim();
    const rows = await many(
      db2,
      `select c.id as clan_id, c.name, c.clan_type, c.status, c.rating_points,
              c.leader_user_key, leader.name as leader_name,
              ch.id as chat_id, ch.enabled, ch.read_only,
              coalesce(members.member_count, 0)::integer as member_count,
              coalesce(messages.message_count, 0)::integer as message_count,
              messages.last_message_at,
              coalesce(polls.active_poll_count, 0)::integer as active_poll_count,
              coalesce(events.attached_event_count, 0)::integer as attached_event_count,
              coalesce(reports.open_report_count, 0)::integer as open_report_count
         from public.clans c
         join public.clan_chats ch on ch.clan_id = c.id
         left join public.app_users leader on leader.user_key = c.leader_user_key
         left join (
           select clan_id, count(*) as member_count
             from public.clan_memberships
            where status = 'active'
            group by clan_id
         ) members on members.clan_id = c.id
         left join (
           select chat_id, count(*) as message_count, max(created_at) as last_message_at
             from public.clan_chat_messages
            group by chat_id
         ) messages on messages.chat_id = ch.id
         left join (
           select chat_id, count(*) as active_poll_count
             from public.clan_chat_polls
            where status = 'active'
            group by chat_id
         ) polls on polls.chat_id = ch.id
         left join (
           select chat_id, count(*) as attached_event_count
             from public.clan_chat_events
            group by chat_id
         ) events on events.chat_id = ch.id
         left join (
           select chat_id, count(*) as open_report_count
             from public.clan_chat_reports
            where status = 'new'
            group by chat_id
         ) reports on reports.chat_id = ch.id
        where ($1 = '' or lower(c.name) like '%' || lower($1) || '%')
        order by c.name`,
      [search]
    );
    res.json({ chats: rows });
  }));
  router.put(
    "/clans/:clanId/rating",
    requireRole("admin", "superadmin"),
    asyncHandler(async (req, res) => {
      const clanId = identifier(req.params.clanId, "clanId");
      const before = await one(
        db2,
        `select id, name, rating_points from public.clans where id = $1`,
        [clanId]
      );
      if (!before) throw new ApiError(404, "Clan was not found", "not_found");
      const ratingPoints = boundedInteger(req.body?.ratingPoints, Number(before.rating_points || 0), 0, 1e9);
      const after = await one(
        db2,
        `update public.clans
            set rating_points = $1, updated_at = now()
          where id = $2
          returning id, name, rating_points`,
        [ratingPoints, clanId]
      );
      await adminAudit(db2, req, {
        permissionKey: "clan.rating.update",
        action: "clan.rating.update",
        targetType: "clan",
        targetId: clanId,
        clanId,
        reason: optionalText(req.body?.reason, 1e3),
        before,
        after
      });
      res.json({ clan: after });
    })
  );
  router.get("/clans/:clanId/chat", asyncHandler(async (req, res) => {
    const chat = await clanChat(db2, req.params.clanId);
    const limit = boundedInteger(req.query.limit, 100, 1, 200);
    const [members, messages, polls, events, grants, restrictions, reports] = await Promise.all([
      many(
        db2,
        `select m.*, u.name, u.username, u.account_status
           from public.clan_memberships m
           join public.app_users u on u.user_key = m.user_key
          where m.clan_id = $1 order by m.status, m.joined_at`,
        [req.params.clanId]
      ),
      many(
        db2,
        `select msg.*, u.name as author_name
           from public.clan_chat_messages msg
           left join public.app_users u on u.user_key = msg.author_user_key
          where msg.chat_id = $1
          order by msg.created_at desc limit $2`,
        [chat.id, limit]
      ),
      many(
        db2,
        `select p.*, u.name as creator_name
           from public.clan_chat_polls p
           left join public.app_users u on u.user_key = p.created_by_user_key
          where p.chat_id = $1 order by p.created_at desc`,
        [chat.id]
      ),
      many(
        db2,
        `select ce.*, e.title, e.event_date, e.event_time
           from public.clan_chat_events ce
           join public.events e on e.id = ce.event_id
          where ce.chat_id = $1 order by ce.is_primary desc, e.event_date`,
        [chat.id]
      ),
      many(
        db2,
        `select g.*, u.name as user_name, a.email as granted_by_email
           from public.clan_chat_permission_grants g
           join public.app_users u on u.user_key = g.user_key
           left join public.admin_users a on a.id = g.granted_by_admin_id
          where g.clan_id = $1 order by g.created_at desc`,
        [req.params.clanId]
      ),
      many(
        db2,
        `select r.*, u.name as user_name
           from public.clan_chat_restrictions r
           join public.app_users u on u.user_key = r.user_key
          where r.chat_id = $1 order by r.created_at desc`,
        [chat.id]
      ),
      many(
        db2,
        `select r.*, reporter.name as reporter_name, author.name as message_author_name
           from public.clan_chat_reports r
           join public.app_users reporter on reporter.user_key = r.reporter_user_key
           join public.clan_chat_messages msg on msg.id = r.message_id
           left join public.app_users author on author.user_key = msg.author_user_key
          where r.chat_id = $1 order by r.created_at desc`,
        [chat.id]
      )
    ]);
    res.json({ chat, members, messages, polls, events, grants, restrictions, reports });
  }));
  router.get(
    "/clans/:clanId/messages",
    requireRole("admin", "superadmin", "moderator", "auditor"),
    asyncHandler(async (req, res) => {
      const chat = await clanChat(db2, req.params.clanId);
      const search = String(req.query.search || "").trim().slice(0, 500);
      const limit = boundedInteger(req.query.limit, 100, 1, 500);
      const messages = await many(
        db2,
        `select msg.*, author.name as author_name
           from public.clan_chat_messages msg
           left join public.app_users author on author.user_key = msg.author_user_key
          where msg.chat_id = $1
            and ($2 = '' or lower(msg.body) like '%' || lower($2) || '%')
          order by msg.created_at desc
          limit $3`,
        [chat.id, search, limit]
      );
      res.json({ messages });
    })
  );
  router.patch(
    "/clans/:clanId/chat",
    requireRole("admin", "superadmin"),
    asyncHandler(async (req, res) => {
      const before = await clanChat(db2, req.params.clanId);
      const enabled = req.body?.enabled === void 0 ? before.enabled : booleanValue(req.body.enabled);
      const readOnly = req.body?.readOnly === void 0 ? before.read_only : booleanValue(req.body.readOnly);
      const ownDeleteWindowSeconds = boundedInteger(
        req.body?.ownDeleteWindowSeconds,
        Number(before.own_delete_window_seconds),
        0,
        86400
      );
      let storedSettings = before.settings;
      if (typeof storedSettings === "string") {
        try {
          storedSettings = JSON.parse(storedSettings);
        } catch {
          storedSettings = {};
        }
      }
      const settings = req.body?.settings === void 0 ? storedSettings : req.body.settings;
      if (!settings || Array.isArray(settings) || typeof settings !== "object") {
        throw new ApiError(400, "settings must be an object", "validation_error");
      }
      const after = await one(
        db2,
        `update public.clan_chats
            set enabled = $1, read_only = $2, own_delete_window_seconds = $3,
                settings = $4::jsonb
          where clan_id = $5 returning *`,
        [enabled, readOnly, ownDeleteWindowSeconds, JSON.stringify(settings), req.params.clanId]
      );
      await adminAudit(db2, req, {
        permissionKey: "chat.settings.update",
        action: "chat.settings.update",
        targetType: "chat",
        targetId: after.id,
        clanId: req.params.clanId,
        reason: optionalText(req.body?.reason, 1e3),
        before,
        after
      });
      res.json({ chat: after });
    })
  );
  router.delete(
    "/clans/:clanId/messages/:messageId",
    requireRole("admin", "superadmin", "moderator"),
    asyncHandler(async (req, res) => {
      const chat = await clanChat(db2, req.params.clanId);
      const messageId = uuid(req.params.messageId, "messageId");
      const before = await one(
        db2,
        `select * from public.clan_chat_messages where id = $1 and chat_id = $2`,
        [messageId, chat.id]
      );
      if (!before) throw new ApiError(404, "Message was not found", "not_found");
      if (!before.deleted_at) {
        await db2.query(
          `update public.clan_chat_messages
              set body = '\u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u0443\u0434\u0430\u043B\u0435\u043D\u043E \u0430\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u043E\u043C BALI',
                  deleted_at = now(), deleted_by_type = 'admin',
                  deleted_by_id = $1, deletion_reason = $2
            where id = $3`,
          [
            req.adminPrincipal.adminId,
            optionalText(req.body?.reason, 500),
            messageId
          ]
        );
      }
      await adminAudit(db2, req, {
        permissionKey: "message.delete_any",
        action: "message.delete",
        targetType: "message",
        targetId: messageId,
        clanId: req.params.clanId,
        reason: optionalText(req.body?.reason, 500),
        before,
        after: { deleted: true }
      });
      res.status(204).end();
    })
  );
  router.post(
    "/clans/:clanId/grants",
    requireRole("admin", "superadmin"),
    asyncHandler(async (req, res) => {
      await clanChat(db2, req.params.clanId);
      const userKey = identifier(req.body?.userKey, "userKey");
      const permissionKey = requiredText(req.body?.permissionKey, "permissionKey", 100);
      const effect = req.body?.effect === "deny" ? "deny" : "allow";
      const expiresAt = isoDateOrNull(req.body?.expiresAt);
      const reason = requiredText(req.body?.reason, "reason", 1e3);
      const [member, permission] = await Promise.all([
        one(
          db2,
          `select id from public.clan_memberships
            where clan_id = $1 and user_key = $2 and status = 'active'`,
          [req.params.clanId, userKey]
        ),
        one(
          db2,
          `select permission_key from public.clan_chat_permissions where permission_key = $1`,
          [permissionKey]
        )
      ]);
      if (!member) throw new ApiError(404, "Active clan member was not found", "not_found");
      if (!permission) throw new ApiError(400, "Unknown permission", "validation_error");
      const grant = await one(
        db2,
        `insert into public.clan_chat_permission_grants(
           clan_id, user_key, permission_key, effect, reason,
           granted_by_admin_id, expires_at
         ) values ($1,$2,$3,$4,$5,$6,$7)
         returning *`,
        [
          req.params.clanId,
          userKey,
          permissionKey,
          effect,
          reason,
          req.adminPrincipal.adminId,
          expiresAt
        ]
      );
      await adminAudit(db2, req, {
        permissionKey,
        action: effect === "deny" ? "permission.deny" : "permission.grant",
        targetType: "permission_grant",
        targetId: grant.id,
        clanId: req.params.clanId,
        reason,
        after: grant
      });
      res.status(201).json({ grant });
    })
  );
  router.delete(
    "/clans/:clanId/grants/:grantId",
    requireRole("admin", "superadmin"),
    asyncHandler(async (req, res) => {
      const grantId = uuid(req.params.grantId, "grantId");
      const grant = await one(
        db2,
        `update public.clan_chat_permission_grants
            set revoked_at = now(), updated_at = now()
          where id = $1 and clan_id = $2 and revoked_at is null
          returning *`,
        [grantId, req.params.clanId]
      );
      if (!grant) throw new ApiError(404, "Active permission grant was not found", "not_found");
      await adminAudit(db2, req, {
        permissionKey: grant.permission_key,
        action: "permission.revoke",
        targetType: "permission_grant",
        targetId: grantId,
        clanId: req.params.clanId,
        reason: optionalText(req.body?.reason, 1e3),
        before: grant,
        after: { revoked: true }
      });
      res.status(204).end();
    })
  );
  router.post(
    "/clans/:clanId/members",
    requireRole("admin", "superadmin"),
    asyncHandler(async (req, res) => {
      const clanId = identifier(req.params.clanId, "clanId");
      const userKey = identifier(req.body?.userKey, "userKey");
      const reason = requiredText(req.body?.reason, "reason", 1e3);
      const [clan, user, existing] = await Promise.all([
        one(
          db2,
          `select id, name, clan_type, status from public.clans where id = $1`,
          [clanId]
        ),
        one(
          db2,
          `select user_key, name, account_status from public.app_users where user_key = $1`,
          [userKey]
        ),
        one(
          db2,
          `select * from public.clan_memberships where clan_id = $1 and user_key = $2`,
          [clanId, userKey]
        )
      ]);
      if (!clan || clan.status !== "active") {
        throw new ApiError(404, "Active clan was not found", "not_found");
      }
      if (!user || user.account_status !== "active") {
        throw new ApiError(404, "Active user was not found", "not_found");
      }
      const conflict = await one(
        db2,
        `select membership.id, clan.id as clan_id, clan.name
           from public.clan_memberships membership
           join public.clans clan on clan.id = membership.clan_id
          where membership.user_key = $1
            and membership.status = 'active'
            and membership.clan_type = $2
            and membership.clan_id <> $3
          limit 1`,
        [userKey, clan.clan_type, clanId]
      );
      if (conflict) {
        throw new ApiError(
          409,
          "User already belongs to a clan in this category",
          "clan_category_membership_conflict",
          { clanId: conflict.clan_id, clanName: conflict.name, clanType: clan.clan_type }
        );
      }
      const membership = await one(
        db2,
        `insert into public.clan_memberships(
           clan_id, user_key, clan_type, role, status
         ) values ($1,$2,$3,'member','active')
         on conflict (clan_id, user_key) do update
           set clan_type = excluded.clan_type,
               role = case
                 when public.clan_memberships.role = 'leader' then 'leader'
                 else 'member'
               end,
               status = 'active',
               ended_at = null,
               joined_at = now(),
               updated_at = now()
         returning *`,
        [clanId, userKey, clan.clan_type]
      );
      await adminAudit(db2, req, {
        permissionKey: "clan.membership.manage",
        action: existing?.status === "active" ? "clan.member.confirm" : "clan.member.assign",
        targetType: "clan_membership",
        targetId: membership.id,
        clanId,
        reason,
        before: existing,
        after: membership
      });
      res.status(existing?.status === "active" ? 200 : 201).json({ membership });
    })
  );
  router.put(
    "/clans/:clanId/leader",
    requireRole("admin", "superadmin"),
    asyncHandler(async (req, res) => {
      const userKey = identifier(req.body?.userKey, "userKey");
      const reason = requiredText(req.body?.reason, "reason", 1e3);
      const before = await clanChat(db2, req.params.clanId);
      const member = await one(
        db2,
        `select * from public.clan_memberships
          where clan_id = $1 and user_key = $2 and status = 'active'`,
        [req.params.clanId, userKey]
      );
      if (!member) throw new ApiError(404, "Active clan member was not found", "not_found");
      await transaction(db2, async (client) => {
        await client.query(
          `update public.clan_memberships set role = 'member'
            where clan_id = $1 and role = 'leader'`,
          [req.params.clanId]
        );
        await client.query(
          `update public.clan_memberships set role = 'leader'
            where clan_id = $1 and user_key = $2`,
          [req.params.clanId, userKey]
        );
        await client.query(
          `update public.clans set leader_user_key = $1 where id = $2`,
          [userKey, req.params.clanId]
        );
      });
      await adminAudit(db2, req, {
        permissionKey: "chat.settings.update",
        action: "clan.leader.transfer",
        targetType: "clan",
        targetId: req.params.clanId,
        clanId: req.params.clanId,
        reason,
        before: { leaderUserKey: before.leader_user_key },
        after: { leaderUserKey: userKey }
      });
      res.json({ leaderUserKey: userKey });
    })
  );
  router.post(
    "/clans/:clanId/restrictions",
    requireRole("admin", "superadmin", "moderator"),
    asyncHandler(async (req, res) => {
      const chat = await clanChat(db2, req.params.clanId);
      const userKey = identifier(req.body?.userKey, "userKey");
      const reason = requiredText(req.body?.reason, "reason", 1e3);
      const expiresAt = isoDateOrNull(req.body?.expiresAt);
      const member = await one(
        db2,
        `select id from public.clan_memberships
          where clan_id = $1 and user_key = $2 and status = 'active'`,
        [req.params.clanId, userKey]
      );
      if (!member) throw new ApiError(404, "Active clan member was not found", "not_found");
      const restriction = await one(
        db2,
        `insert into public.clan_chat_restrictions(
           chat_id, user_key, can_write, reason, expires_at, created_by_type, created_by_id
         ) values ($1,$2,false,$3,$4,'admin',$5)
         on conflict (chat_id, user_key) where revoked_at is null
         do update set reason = excluded.reason, expires_at = excluded.expires_at,
           updated_at = now()
         returning *`,
        [chat.id, userKey, reason, expiresAt, req.adminPrincipal.adminId]
      );
      await adminAudit(db2, req, {
        permissionKey: "member.restrict_chat",
        action: "member.restrict_chat",
        targetType: "member",
        targetId: userKey,
        clanId: req.params.clanId,
        reason,
        after: restriction
      });
      res.status(201).json({ restriction });
    })
  );
  router.delete(
    "/clans/:clanId/restrictions/:userKey",
    requireRole("admin", "superadmin", "moderator"),
    asyncHandler(async (req, res) => {
      const chat = await clanChat(db2, req.params.clanId);
      const userKey = identifier(req.params.userKey, "userKey");
      const before = await one(
        db2,
        `update public.clan_chat_restrictions
            set revoked_at = now(), updated_at = now()
          where chat_id = $1 and user_key = $2 and revoked_at is null
          returning *`,
        [chat.id, userKey]
      );
      if (!before) throw new ApiError(404, "Active restriction was not found", "not_found");
      await adminAudit(db2, req, {
        permissionKey: "member.unrestrict_chat",
        action: "member.unrestrict_chat",
        targetType: "member",
        targetId: userKey,
        clanId: req.params.clanId,
        before
      });
      res.status(204).end();
    })
  );
  router.post(
    "/clans/:clanId/announcements",
    requireRole("admin", "superadmin"),
    asyncHandler(async (req, res) => {
      const chat = await clanChat(db2, req.params.clanId);
      const title = optionalText(req.body?.title, 200);
      const body = requiredText(req.body?.body, "body", 4e3);
      const announcement = await transaction(db2, async (client) => {
        const row = await one(
          client,
          `insert into public.clan_chat_announcements(
             chat_id, title, body, official
           ) values ($1,$2,$3,true) returning *`,
          [chat.id, title, body]
        );
        await client.query(
          `insert into public.clan_chat_messages(chat_id, body, message_type)
           values ($1,$2,'announcement')`,
          [chat.id, title ? `${title}
${body}` : body]
        );
        return row;
      });
      await adminAudit(db2, req, {
        permissionKey: "announcement.create",
        action: "announcement.create",
        targetType: "announcement",
        targetId: announcement.id,
        clanId: req.params.clanId,
        after: announcement
      });
      res.status(201).json({ announcement });
    })
  );
  router.delete(
    "/clans/:clanId/polls/:pollId",
    requireRole("admin", "superadmin", "moderator"),
    asyncHandler(async (req, res) => {
      const chat = await clanChat(db2, req.params.clanId);
      const pollId = uuid(req.params.pollId, "pollId");
      const before = await one(
        db2,
        `update public.clan_chat_polls set status = 'deleted'
          where id = $1 and chat_id = $2 returning *`,
        [pollId, chat.id]
      );
      if (!before) throw new ApiError(404, "Poll was not found", "not_found");
      await adminAudit(db2, req, {
        permissionKey: "poll.delete",
        action: "poll.delete",
        targetType: "poll",
        targetId: pollId,
        clanId: req.params.clanId,
        before
      });
      res.status(204).end();
    })
  );
  router.delete(
    "/clans/:clanId/events/:attachmentId",
    requireRole("admin", "superadmin", "moderator"),
    asyncHandler(async (req, res) => {
      const chat = await clanChat(db2, req.params.clanId);
      const attachmentId = uuid(req.params.attachmentId, "attachmentId");
      const before = await one(
        db2,
        `delete from public.clan_chat_events
          where id = $1 and chat_id = $2 returning *`,
        [attachmentId, chat.id]
      );
      if (!before) throw new ApiError(404, "Event attachment was not found", "not_found");
      await adminAudit(db2, req, {
        permissionKey: "event.detach",
        action: "event.detach",
        targetType: "event_attachment",
        targetId: attachmentId,
        clanId: req.params.clanId,
        before
      });
      res.status(204).end();
    })
  );
  router.patch(
    "/reports/:reportId",
    requireRole("admin", "superadmin", "moderator"),
    asyncHandler(async (req, res) => {
      const reportId = uuid(req.params.reportId, "reportId");
      const status = String(req.body?.status || "");
      if (!["reviewed", "resolved", "dismissed"].includes(status)) {
        throw new ApiError(400, "Invalid report status", "validation_error");
      }
      const before = await one(db2, `select * from public.clan_chat_reports where id = $1`, [reportId]);
      if (!before) throw new ApiError(404, "Report was not found", "not_found");
      const after = await one(
        db2,
        `update public.clan_chat_reports
            set status = $1, resolution = $2, reviewed_by_admin_id = $3,
                reviewed_at = now()
          where id = $4 returning *`,
        [
          status,
          optionalText(req.body?.resolution, 2e3),
          req.adminPrincipal.adminId,
          reportId
        ]
      );
      const clan = await one(
        db2,
        `select clan_id from public.clan_chats where id = $1`,
        [before.chat_id]
      );
      await adminAudit(db2, req, {
        permissionKey: "report.review",
        action: "report.review",
        targetType: "report",
        targetId: reportId,
        clanId: clan?.clan_id,
        before,
        after
      });
      res.json({ report: after });
    })
  );
  router.get("/audit", asyncHandler(async (req, res) => {
    const limit = boundedInteger(req.query.limit, 100, 1, 1e3);
    const clanId = String(req.query.clanId || "");
    const actorId = String(req.query.actorId || "");
    const action = String(req.query.action || "");
    const filters = [];
    const values = [];
    const addFilter = (column, value) => {
      if (!value) return;
      values.push(value);
      filters.push(`${column} = $${values.length}`);
    };
    addFilter("clan_id", clanId);
    addFilter("actor_id", actorId);
    addFilter("action", action);
    const rows = await many(
      db2,
      `select * from public.clan_chat_audit_log
        ${filters.length ? `where ${filters.join(" and ")}` : ""}
        order by created_at desc limit ${limit}`,
      values
    );
    if (req.query.format === "csv") {
      const headers = [
        "id",
        "created_at",
        "actor_type",
        "actor_id",
        "actor_telegram_id",
        "actor_user_key",
        "permission_key",
        "action",
        "target_type",
        "target_id",
        "clan_id",
        "chat_id",
        "request_id",
        "reason",
        "before_value",
        "after_value"
      ];
      const body = [
        headers.join(","),
        ...rows.map((row) => headers.map((key) => csv(row[key])).join(","))
      ].join("\n");
      res.type("text/csv").attachment("bali-clan-audit.csv").send(body);
      return;
    }
    res.json({ audit: rows });
  }));
  router.get("/rate-limits", asyncHandler(async (_req, res) => {
    const settings = await many(
      db2,
      `select * from public.rate_limit_settings order by bucket`
    );
    res.json({ settings });
  }));
  router.put(
    "/rate-limits/:bucket",
    requireRole("admin", "superadmin"),
    asyncHandler(async (req, res) => {
      const bucket = String(req.params.bucket || "");
      if (!/^[a-z][a-z0-9.-]{1,80}$/.test(bucket)) {
        throw new ApiError(400, "Invalid rate-limit bucket", "validation_error");
      }
      const before = await one(
        db2,
        `select * from public.rate_limit_settings where bucket = $1`,
        [bucket]
      );
      if (!before) throw new ApiError(404, "Rate-limit setting was not found", "not_found");
      const after = await one(
        db2,
        `update public.rate_limit_settings
            set limit_count = $1, window_seconds = $2, enabled = $3,
                updated_by_admin_id = $4
          where bucket = $5 returning *`,
        [
          boundedInteger(req.body?.limitCount, Number(before.limit_count), 1, 1e5),
          boundedInteger(req.body?.windowSeconds, Number(before.window_seconds), 1, 86400),
          req.body?.enabled === void 0 ? before.enabled : booleanValue(req.body.enabled),
          req.adminPrincipal.adminId,
          bucket
        ]
      );
      await adminAudit(db2, req, {
        action: "rate_limit.update",
        targetType: "rate_limit_setting",
        targetId: bucket,
        before,
        after
      });
      res.json({ setting: after });
    })
  );
  return router;
}

// server/routes/admin-platform.ts
import { randomUUID as randomUUID2 } from "node:crypto";
import { Router as Router6 } from "express";

// server/routes/layouts.ts
import { Router as Router5 } from "express";
async function publishedLayoutBundle(db2, layoutId, allowArchived = false) {
  const layout = await one(
    db2,
    `select * from public.hall_layouts
      where id = $1
        and status ${allowArchived ? "in ('published','archived')" : "= 'published'"}`,
    [layoutId]
  );
  if (!layout) throw new ApiError(404, "Published layout was not found", "not_found");
  const [tables, elements] = await Promise.all([
    many(
      db2,
      `select * from public.layout_tables
        where layout_id = $1 and active = true
        order by sort_order, table_number`,
      [layoutId]
    ),
    many(
      db2,
      `select * from public.hall_layout_elements
        where layout_id = $1 and active = true
        order by sort_order, id`,
      [layoutId]
    )
  ]);
  return { layout, tables, elements };
}
function createLayoutsRouter(db2) {
  const router = Router5();
  router.use(requireUser);
  router.get("/", asyncHandler(async (_req, res) => {
    const layouts = await many(
      db2,
      `select id, layout_family_key, name, internal_description,
              canvas_width, canvas_height, background_url, version, published_at
         from public.hall_layouts
        where status = 'published'
        order by name, version desc`
    );
    res.json({ layouts });
  }));
  router.get("/:layoutId", asyncHandler(async (req, res) => {
    const layoutId = identifier(req.params.layoutId, "layoutId");
    res.json(await publishedLayoutBundle(db2, layoutId));
  }));
  return router;
}

// server/routes/admin-platform.ts
var LAYOUT_STATUSES = ["draft", "published", "archived"];
var TABLE_SHAPES = ["round", "square", "rectangle", "sofa", "custom"];
var TABLE_TYPES = ["regular", "vip", "bar", "sofa", "clan", "service"];
var TABLE_STATUSES = ["available", "unavailable", "vip_only", "clan_only"];
var ELEMENT_TYPES = [
  "stage",
  "dance_floor",
  "bar",
  "entrance",
  "exit",
  "cloakroom",
  "restroom",
  "dj_zone",
  "stairs",
  "partition",
  "decoration",
  "label"
];
var BOOKING_STATUSES = [
  "new",
  "pending",
  "confirmed",
  "cancelled",
  "checked_in",
  "no_show",
  "completed"
];
async function editableLayout(db2, layoutId) {
  const layout = await one(
    db2,
    `select * from public.hall_layouts where id = $1`,
    [layoutId]
  );
  if (!layout) throw new ApiError(404, "Layout was not found", "not_found");
  if (layout.status !== "draft") {
    throw new ApiError(409, "Only a draft layout can be edited; clone this version first", "layout_not_editable");
  }
  return layout;
}
function createAdminPlatformRouter(db2) {
  const router = Router6();
  router.use(requireAdmin);
  router.get("/layouts", asyncHandler(async (req, res) => {
    const status = req.query.status ? enumValue(req.query.status, "status", LAYOUT_STATUSES) : null;
    const layouts = await many(
      db2,
      `select layout.*,
              coalesce(table_count.count, 0)::integer as table_count,
              coalesce(element_count.count, 0)::integer as element_count,
              coalesce(assignment_count.count, 0)::integer as assigned_event_count
         from public.hall_layouts layout
         left join (
           select layout_id, count(*) as count from public.layout_tables group by layout_id
         ) table_count on table_count.layout_id = layout.id
         left join (
           select layout_id, count(*) as count from public.hall_layout_elements group by layout_id
         ) element_count on element_count.layout_id = layout.id
         left join (
           select layout_id, count(*) as count from public.event_layout_assignments group by layout_id
         ) assignment_count on assignment_count.layout_id = layout.id
        where ($1::text is null or layout.status = $1)
        order by layout.updated_at desc`,
      [status]
    );
    res.json({ layouts });
  }));
  router.get("/layouts/:layoutId", asyncHandler(async (req, res) => {
    const layoutId = identifier(req.params.layoutId, "layoutId");
    const layout = await one(db2, `select * from public.hall_layouts where id = $1`, [layoutId]);
    if (!layout) throw new ApiError(404, "Layout was not found", "not_found");
    const bundle = layout.status === "published" ? await publishedLayoutBundle(db2, layoutId) : {
      layout,
      tables: await many(
        db2,
        `select * from public.layout_tables where layout_id = $1 order by sort_order, table_number`,
        [layoutId]
      ),
      elements: await many(
        db2,
        `select * from public.hall_layout_elements where layout_id = $1 order by sort_order, id`,
        [layoutId]
      )
    };
    res.json(bundle);
  }));
  router.post("/layouts", asyncHandler(async (req, res) => {
    const name = requiredText(req.body?.name, "name", 160);
    const layoutId = `layout-${randomUUID2()}`;
    const familyKey = req.body?.layoutFamilyKey ? identifier(req.body.layoutFamilyKey, "layoutFamilyKey") : `layout-family-${randomUUID2()}`;
    const layout = await one(
      db2,
      `insert into public.hall_layouts(
         id, layout_family_key, name, internal_description, canvas_width,
         canvas_height, background_url, status, version, created_by_admin_id
       ) values ($1,$2,$3,$4,$5,$6,$7,'draft',1,$8)
       returning *`,
      [
        layoutId,
        familyKey,
        name,
        optionalText(req.body?.internalDescription, 2e3),
        boundedInteger(req.body?.canvasWidth, 1e3, 240, 1e4),
        boundedInteger(req.body?.canvasHeight, 1400, 240, 1e4),
        optionalText(req.body?.backgroundUrl, 2e3),
        req.adminPrincipal.adminId
      ]
    );
    await writeAdminAudit(db2, req, {
      action: "layout.create",
      targetType: "hall_layout",
      targetId: layoutId,
      after: layout
    });
    res.status(201).json({ layout });
  }));
  router.post("/layouts/:layoutId/clone", asyncHandler(async (req, res) => {
    const sourceId = identifier(req.params.layoutId, "layoutId");
    const result = await transaction(db2, async (client) => {
      const source = await one(
        client,
        `select * from public.hall_layouts where id = $1 for update`,
        [sourceId]
      );
      if (!source) throw new ApiError(404, "Layout was not found", "not_found");
      const versionRow = await one(
        client,
        `select coalesce(max(version), 0)::integer + 1 as version
           from public.hall_layouts where layout_family_key = $1`,
        [source.layout_family_key]
      );
      const layoutId = `layout-${randomUUID2()}`;
      const layout = await one(
        client,
        `insert into public.hall_layouts(
           id, layout_family_key, name, internal_description, canvas_width,
           canvas_height, background_url, status, version, source_layout_id,
           created_by_admin_id
         ) values ($1,$2,$3,$4,$5,$6,$7,'draft',$8,$9,$10)
         returning *`,
        [
          layoutId,
          source.layout_family_key,
          optionalText(req.body?.name, 160) || `${source.name} v${versionRow.version}`,
          source.internal_description,
          source.canvas_width,
          source.canvas_height,
          source.background_url,
          versionRow.version,
          sourceId,
          req.adminPrincipal.adminId
        ]
      );
      await client.query(
        `insert into public.hall_layout_elements(
           layout_id, element_type, label, x, y, width, height, rotation,
           style, sort_order, active
         )
         select $1, element_type, label, x, y, width, height, rotation,
                style, sort_order, active
           from public.hall_layout_elements where layout_id = $2`,
        [layoutId, sourceId]
      );
      await client.query(
        `insert into public.layout_tables(
           id, layout_id, table_number, name, x, y, width, height, rotation,
           shape, capacity, recommended_guests, minimum_deposit, table_type,
           description, status, sort_order, active
         )
         select 'table-' || gen_random_uuid()::text, $1, table_number, name,
                x, y, width, height, rotation, shape, capacity,
                recommended_guests, minimum_deposit, table_type,
                description, status, sort_order, active
           from public.layout_tables where layout_id = $2`,
        [layoutId, sourceId]
      );
      return { source, layout };
    });
    await writeAdminAudit(db2, req, {
      action: "layout.clone",
      targetType: "hall_layout",
      targetId: result.layout.id,
      before: result.source,
      after: result.layout
    });
    res.status(201).json({ layout: result.layout });
  }));
  router.patch("/layouts/:layoutId", asyncHandler(async (req, res) => {
    const layoutId = identifier(req.params.layoutId, "layoutId");
    const before = await editableLayout(db2, layoutId);
    const layout = await one(
      db2,
      `update public.hall_layouts
          set name = $2, internal_description = $3, canvas_width = $4,
              canvas_height = $5, background_url = $6, updated_at = now()
        where id = $1
        returning *`,
      [
        layoutId,
        req.body?.name === void 0 ? before.name : requiredText(req.body.name, "name", 160),
        req.body?.internalDescription === void 0 ? before.internal_description : optionalText(req.body.internalDescription, 2e3),
        boundedInteger(req.body?.canvasWidth, Number(before.canvas_width), 240, 1e4),
        boundedInteger(req.body?.canvasHeight, Number(before.canvas_height), 240, 1e4),
        req.body?.backgroundUrl === void 0 ? before.background_url : optionalText(req.body.backgroundUrl, 2e3)
      ]
    );
    await writeAdminAudit(db2, req, {
      action: "layout.update",
      targetType: "hall_layout",
      targetId: layoutId,
      reason: optionalText(req.body?.reason, 1e3),
      before,
      after: layout
    });
    res.json({ layout });
  }));
  router.post("/layouts/:layoutId/publish", asyncHandler(async (req, res) => {
    const layoutId = identifier(req.params.layoutId, "layoutId");
    const result = await transaction(db2, async (client) => {
      const before = await one(
        client,
        `select * from public.hall_layouts where id = $1 for update`,
        [layoutId]
      );
      if (!before) throw new ApiError(404, "Layout was not found", "not_found");
      const tableCount = await one(
        client,
        `select count(*)::integer as count from public.layout_tables
          where layout_id = $1 and active = true`,
        [layoutId]
      );
      if (!Number(tableCount?.count || 0)) {
        throw new ApiError(409, "A layout without active tables cannot be published", "layout_has_no_tables");
      }
      await client.query(
        `update public.hall_layouts
            set status = 'archived', archived_at = now(), updated_at = now()
          where layout_family_key = $1 and status = 'published' and id <> $2`,
        [before.layout_family_key, layoutId]
      );
      const layout = await one(
        client,
        `update public.hall_layouts
            set status = 'published', published_at = now(), archived_at = null,
                published_by_admin_id = $2, updated_at = now()
          where id = $1 returning *`,
        [layoutId, req.adminPrincipal.adminId]
      );
      return { before, layout };
    });
    await writeAdminAudit(db2, req, {
      action: "layout.publish",
      targetType: "hall_layout",
      targetId: layoutId,
      reason: optionalText(req.body?.reason, 1e3),
      before: result.before,
      after: result.layout
    });
    res.json({ layout: result.layout });
  }));
  router.post("/layouts/:layoutId/archive", asyncHandler(async (req, res) => {
    const layoutId = identifier(req.params.layoutId, "layoutId");
    const before = await one(db2, `select * from public.hall_layouts where id = $1`, [layoutId]);
    if (!before) throw new ApiError(404, "Layout was not found", "not_found");
    const assigned = await one(
      db2,
      `select count(*)::integer as count
         from public.event_layout_assignments where layout_id = $1`,
      [layoutId]
    );
    if (Number(assigned?.count || 0) > 0) {
      throw new ApiError(409, "An assigned layout cannot be archived", "layout_is_assigned");
    }
    const layout = await one(
      db2,
      `update public.hall_layouts
          set status = 'archived', archived_at = now(), updated_at = now()
        where id = $1 returning *`,
      [layoutId]
    );
    await writeAdminAudit(db2, req, {
      action: "layout.archive",
      targetType: "hall_layout",
      targetId: layoutId,
      reason: requiredText(req.body?.reason, "reason", 1e3),
      before,
      after: layout
    });
    res.json({ layout });
  }));
  router.post("/layouts/:layoutId/tables", asyncHandler(async (req, res) => {
    const layoutId = identifier(req.params.layoutId, "layoutId");
    await editableLayout(db2, layoutId);
    const tableId = `table-${randomUUID2()}`;
    const capacity = boundedInteger(req.body?.capacity, 4, 1, 100);
    const recommended = boundedInteger(req.body?.recommendedGuests, capacity, 1, capacity);
    const table = await one(
      db2,
      `insert into public.layout_tables(
         id, layout_id, table_number, name, x, y, width, height, rotation,
         shape, capacity, recommended_guests, minimum_deposit, table_type,
         description, status, sort_order, active
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       returning *`,
      [
        tableId,
        layoutId,
        requiredText(req.body?.tableNumber, "tableNumber", 80),
        optionalText(req.body?.name, 160),
        boundedNumber(req.body?.x, 0, -1e4, 1e4),
        boundedNumber(req.body?.y, 0, -1e4, 1e4),
        boundedNumber(req.body?.width, 8, 0.1, 1e4),
        boundedNumber(req.body?.height, 8, 0.1, 1e4),
        boundedNumber(req.body?.rotation, 0, -3600, 3600),
        enumValue(req.body?.shape || "round", "shape", TABLE_SHAPES),
        capacity,
        recommended,
        boundedNumber(req.body?.minimumDeposit, 0, 0, 1e9),
        enumValue(req.body?.tableType || "regular", "tableType", TABLE_TYPES),
        optionalText(req.body?.description, 2e3),
        enumValue(req.body?.status || "available", "status", TABLE_STATUSES),
        boundedInteger(req.body?.sortOrder, 0, -1e6, 1e6),
        booleanValue(req.body?.active, true)
      ]
    );
    await writeAdminAudit(db2, req, {
      action: "layout.table.create",
      targetType: "layout_table",
      targetId: tableId,
      after: table
    });
    res.status(201).json({ table });
  }));
  router.patch("/layouts/:layoutId/tables/:tableId", asyncHandler(async (req, res) => {
    const layoutId = identifier(req.params.layoutId, "layoutId");
    const tableId = identifier(req.params.tableId, "tableId");
    await editableLayout(db2, layoutId);
    const before = await one(
      db2,
      `select * from public.layout_tables where id = $1 and layout_id = $2`,
      [tableId, layoutId]
    );
    if (!before) throw new ApiError(404, "Table was not found", "not_found");
    const capacity = boundedInteger(req.body?.capacity, Number(before.capacity), 1, 100);
    const recommended = boundedInteger(
      req.body?.recommendedGuests,
      Math.min(Number(before.recommended_guests), capacity),
      1,
      capacity
    );
    const table = await one(
      db2,
      `update public.layout_tables
          set table_number = $3, name = $4, x = $5, y = $6, width = $7,
              height = $8, rotation = $9, shape = $10, capacity = $11,
              recommended_guests = $12, minimum_deposit = $13,
              table_type = $14, description = $15, status = $16,
              sort_order = $17, active = $18, updated_at = now()
        where id = $1 and layout_id = $2
        returning *`,
      [
        tableId,
        layoutId,
        req.body?.tableNumber === void 0 ? before.table_number : requiredText(req.body.tableNumber, "tableNumber", 80),
        req.body?.name === void 0 ? before.name : optionalText(req.body.name, 160),
        boundedNumber(req.body?.x, Number(before.x), -1e4, 1e4),
        boundedNumber(req.body?.y, Number(before.y), -1e4, 1e4),
        boundedNumber(req.body?.width, Number(before.width), 0.1, 1e4),
        boundedNumber(req.body?.height, Number(before.height), 0.1, 1e4),
        boundedNumber(req.body?.rotation, Number(before.rotation), -3600, 3600),
        req.body?.shape === void 0 ? before.shape : enumValue(req.body.shape, "shape", TABLE_SHAPES),
        capacity,
        recommended,
        boundedNumber(req.body?.minimumDeposit, Number(before.minimum_deposit), 0, 1e9),
        req.body?.tableType === void 0 ? before.table_type : enumValue(req.body.tableType, "tableType", TABLE_TYPES),
        req.body?.description === void 0 ? before.description : optionalText(req.body.description, 2e3),
        req.body?.status === void 0 ? before.status : enumValue(req.body.status, "status", TABLE_STATUSES),
        boundedInteger(req.body?.sortOrder, Number(before.sort_order), -1e6, 1e6),
        req.body?.active === void 0 ? before.active : booleanValue(req.body.active)
      ]
    );
    await writeAdminAudit(db2, req, {
      action: "layout.table.update",
      targetType: "layout_table",
      targetId: tableId,
      reason: optionalText(req.body?.reason, 1e3),
      before,
      after: table
    });
    res.json({ table });
  }));
  router.delete("/layouts/:layoutId/tables/:tableId", asyncHandler(async (req, res) => {
    const layoutId = identifier(req.params.layoutId, "layoutId");
    const tableId = identifier(req.params.tableId, "tableId");
    await editableLayout(db2, layoutId);
    const before = await one(
      db2,
      `select * from public.layout_tables where id = $1 and layout_id = $2`,
      [tableId, layoutId]
    );
    if (!before) throw new ApiError(404, "Table was not found", "not_found");
    try {
      await db2.query(`delete from public.layout_tables where id = $1 and layout_id = $2`, [tableId, layoutId]);
    } catch (error) {
      if (error?.code === "23503") {
        throw new ApiError(409, "A table with booking history cannot be deleted; mark it inactive", "table_has_history");
      }
      throw error;
    }
    await writeAdminAudit(db2, req, {
      action: "layout.table.delete",
      targetType: "layout_table",
      targetId: tableId,
      reason: requiredText(req.body?.reason, "reason", 1e3),
      before
    });
    res.status(204).end();
  }));
  router.post("/layouts/:layoutId/elements", asyncHandler(async (req, res) => {
    const layoutId = identifier(req.params.layoutId, "layoutId");
    await editableLayout(db2, layoutId);
    const style = req.body?.style && typeof req.body.style === "object" && !Array.isArray(req.body.style) ? req.body.style : {};
    const element = await one(
      db2,
      `insert into public.hall_layout_elements(
         layout_id, element_type, label, x, y, width, height, rotation,
         style, sort_order, active
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)
       returning *`,
      [
        layoutId,
        enumValue(req.body?.elementType, "elementType", ELEMENT_TYPES),
        optionalText(req.body?.label, 160),
        boundedNumber(req.body?.x, 0, -1e4, 1e4),
        boundedNumber(req.body?.y, 0, -1e4, 1e4),
        boundedNumber(req.body?.width, 10, 0.1, 1e4),
        boundedNumber(req.body?.height, 10, 0.1, 1e4),
        boundedNumber(req.body?.rotation, 0, -3600, 3600),
        JSON.stringify(style),
        boundedInteger(req.body?.sortOrder, 0, -1e6, 1e6),
        booleanValue(req.body?.active, true)
      ]
    );
    await writeAdminAudit(db2, req, {
      action: "layout.element.create",
      targetType: "layout_element",
      targetId: element.id,
      after: element
    });
    res.status(201).json({ element });
  }));
  router.patch("/layouts/:layoutId/elements/:elementId", asyncHandler(async (req, res) => {
    const layoutId = identifier(req.params.layoutId, "layoutId");
    const elementId = uuid(req.params.elementId, "elementId");
    await editableLayout(db2, layoutId);
    const before = await one(
      db2,
      `select * from public.hall_layout_elements where id = $1 and layout_id = $2`,
      [elementId, layoutId]
    );
    if (!before) throw new ApiError(404, "Layout element was not found", "not_found");
    const style = req.body?.style === void 0 ? before.style : req.body.style && typeof req.body.style === "object" && !Array.isArray(req.body.style) ? req.body.style : (() => {
      throw new ApiError(400, "style must be an object", "validation_error");
    })();
    const element = await one(
      db2,
      `update public.hall_layout_elements
          set element_type = $3, label = $4, x = $5, y = $6, width = $7,
              height = $8, rotation = $9, style = $10::jsonb,
              sort_order = $11, active = $12, updated_at = now()
        where id = $1 and layout_id = $2
        returning *`,
      [
        elementId,
        layoutId,
        req.body?.elementType === void 0 ? before.element_type : enumValue(req.body.elementType, "elementType", ELEMENT_TYPES),
        req.body?.label === void 0 ? before.label : optionalText(req.body.label, 160),
        boundedNumber(req.body?.x, Number(before.x), -1e4, 1e4),
        boundedNumber(req.body?.y, Number(before.y), -1e4, 1e4),
        boundedNumber(req.body?.width, Number(before.width), 0.1, 1e4),
        boundedNumber(req.body?.height, Number(before.height), 0.1, 1e4),
        boundedNumber(req.body?.rotation, Number(before.rotation), -3600, 3600),
        JSON.stringify(style),
        boundedInteger(req.body?.sortOrder, Number(before.sort_order), -1e6, 1e6),
        req.body?.active === void 0 ? before.active : booleanValue(req.body.active)
      ]
    );
    await writeAdminAudit(db2, req, {
      action: "layout.element.update",
      targetType: "layout_element",
      targetId: elementId,
      reason: optionalText(req.body?.reason, 1e3),
      before,
      after: element
    });
    res.json({ element });
  }));
  router.post("/events/:eventId/layout", asyncHandler(async (req, res) => {
    const eventId = identifier(req.params.eventId, "eventId");
    const nextLayoutId = identifier(req.body?.layoutId, "layoutId");
    const confirmed = booleanValue(req.body?.confirmed);
    const reason = requiredText(req.body?.reason, "reason", 1e3);
    const mappings = req.body?.tableMappings && typeof req.body.tableMappings === "object" ? req.body.tableMappings : {};
    const result = await transaction(db2, async (client) => {
      const [event, layout, current] = await Promise.all([
        one(client, `select id, title from public.events where id = $1`, [eventId]),
        one(
          client,
          `select * from public.hall_layouts where id = $1 and status = 'published'`,
          [nextLayoutId]
        ),
        one(
          client,
          `select * from public.event_layout_assignments where event_id = $1 for update`,
          [eventId]
        )
      ]);
      if (!event) throw new ApiError(404, "Event was not found", "not_found");
      if (!layout) throw new ApiError(404, "Published layout was not found", "layout_not_found");
      const activeBookings = await many(
        client,
        `select id, table_id, status
           from public.booking_records
          where event_id = $1
            and status in ('new','pending','confirmed','checked_in')
          for update`,
        [eventId]
      );
      const mappedRows = [];
      const unresolved = [];
      for (const booking of activeBookings) {
        const mappedTableId = String(mappings[booking.table_id] || "").trim();
        if (!mappedTableId) {
          unresolved.push(booking);
          continue;
        }
        const targetTable = await one(
          client,
          `select id from public.layout_tables
            where id = $1 and layout_id = $2 and active = true`,
          [mappedTableId, nextLayoutId]
        );
        if (!targetTable) {
          throw new ApiError(400, `Mapped table ${mappedTableId} is not active in the selected layout`, "invalid_table_mapping");
        }
        mappedRows.push({
          bookingId: booking.id,
          oldTableId: booking.table_id,
          newTableId: mappedTableId
        });
      }
      if (activeBookings.length && (!confirmed || unresolved.length)) {
        throw new ApiError(
          409,
          "Layout change affects active bookings and requires confirmation plus a table mapping for every booking",
          "layout_assignment_conflict",
          {
            affectedBookingCount: activeBookings.length,
            unresolvedBookings: unresolved,
            requiredMappingKeys: unresolved.map((row) => row.table_id)
          }
        );
      }
      for (const mapping of mappedRows) {
        await client.query(
          `update public.booking_records
              set layout_id = $2, table_id = $3, updated_at = now()
            where id = $1`,
          [mapping.bookingId, nextLayoutId, mapping.newTableId]
        );
      }
      await client.query(
        `update public.booking_holds
            set status = 'released', released_at = now(), updated_at = now()
          where event_id = $1 and status = 'active'`,
        [eventId]
      );
      const assignment = await one(
        client,
        `insert into public.event_layout_assignments(
           event_id, layout_id, assigned_by_admin_id
         ) values ($1,$2,$3)
         on conflict (event_id) do update
           set layout_id = excluded.layout_id,
               assigned_by_admin_id = excluded.assigned_by_admin_id,
               updated_at = now()
         returning *`,
        [eventId, nextLayoutId, req.adminPrincipal.adminId]
      );
      await client.query(
        `insert into public.event_layout_assignment_history(
           event_id, previous_layout_id, next_layout_id, affected_booking_count,
           conflict_count, confirmed, reason, changed_by_admin_id
         ) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          eventId,
          current?.layout_id || null,
          nextLayoutId,
          activeBookings.length,
          activeBookings.length,
          confirmed,
          reason,
          req.adminPrincipal.adminId
        ]
      );
      return { event, layout, previousAssignment: current, assignment, mappedRows };
    });
    await writeAdminAudit(db2, req, {
      action: "event.layout.assign",
      targetType: "event",
      targetId: eventId,
      reason,
      before: result.previousAssignment,
      after: { assignment: result.assignment, mappedRows: result.mappedRows }
    });
    res.json({ assignment: result.assignment, mappedBookings: result.mappedRows });
  }));
  router.get("/bookings", asyncHandler(async (req, res) => {
    const eventId = req.query.eventId ? identifier(req.query.eventId, "eventId") : null;
    const status = req.query.status ? enumValue(req.query.status, "status", BOOKING_STATUSES) : null;
    const search = String(req.query.search || "").trim().slice(0, 160);
    const bookings = await many(
      db2,
      `select booking.*, event.title as event_title,
              layout_table.table_number, layout_table.name as table_name,
              app_user.name as app_user_name, app_user.username,
              clan.name as clan_name
         from public.booking_records booking
         join public.events event on event.id = booking.event_id
         join public.layout_tables layout_table on layout_table.id = booking.table_id
         join public.app_users app_user on app_user.user_key = booking.user_key
         left join public.clans clan on clan.id = booking.clan_id
        where ($1::text is null or booking.event_id = $1)
          and ($2::text is null or booking.status = $2)
          and ($3 = '' or lower(booking.customer_name) like '%' || lower($3) || '%'
            or lower(booking.phone) like '%' || lower($3) || '%'
            or lower(booking.booking_reference) like '%' || lower($3) || '%')
        order by booking.created_at desc
        limit 500`,
      [eventId, status, search]
    );
    res.json({ bookings });
  }));
  router.patch("/bookings/:bookingId", asyncHandler(async (req, res) => {
    const bookingId = identifier(req.params.bookingId, "bookingId");
    const nextStatus = enumValue(req.body?.status, "status", BOOKING_STATUSES);
    const reason = requiredText(req.body?.reason, "reason", 1e3);
    const result = await transaction(db2, async (client) => {
      const before = await one(
        client,
        `select * from public.booking_records where id = $1 for update`,
        [bookingId]
      );
      if (!before) throw new ApiError(404, "Booking was not found", "not_found");
      const after = await one(
        client,
        `update public.booking_records
            set status = $2,
                confirmed_at = case when $2 = 'confirmed' then coalesce(confirmed_at, now()) else confirmed_at end,
                cancelled_at = case when $2 = 'cancelled' then now() else cancelled_at end,
                cancelled_by = case when $2 = 'cancelled' then $3 else cancelled_by end,
                checked_in_at = case when $2 = 'checked_in' then now() else checked_in_at end,
                no_show_at = case when $2 = 'no_show' then now() else no_show_at end,
                completed_at = case when $2 = 'completed' then now() else completed_at end,
                updated_at = now()
          where id = $1
          returning *`,
        [bookingId, nextStatus, req.adminPrincipal.email]
      );
      await client.query(
        `insert into public.booking_status_history(
           booking_id, previous_status, next_status, actor_type, actor_id,
           reason, before_value, after_value
         ) values ($1,$2,$3,'admin',$4,$5,$6::jsonb,$7::jsonb)`,
        [
          bookingId,
          before.status,
          nextStatus,
          req.adminPrincipal.adminId,
          reason,
          JSON.stringify(before),
          JSON.stringify(after)
        ]
      );
      return { before, after };
    });
    await writeAdminAudit(db2, req, {
      action: "booking.status.update",
      targetType: "booking",
      targetId: bookingId,
      reason,
      before: result.before,
      after: result.after
    });
    res.json({ booking: result.after });
  }));
  router.get("/booking-settings", asyncHandler(async (_req, res) => {
    const settings = await one(
      db2,
      `select * from public.booking_settings where singleton = true`
    );
    res.json({ settings });
  }));
  router.patch("/booking-settings", asyncHandler(async (req, res) => {
    const before = await one(db2, `select * from public.booking_settings where singleton = true`);
    if (!before) throw new ApiError(500, "Booking settings are missing", "booking_settings_missing");
    const settings = await one(
      db2,
      `update public.booking_settings
          set hold_seconds = $1, allow_capacity_override = $2, auto_confirm = $3,
              updated_by_admin_id = $4, updated_at = now()
        where singleton = true
        returning *`,
      [
        boundedInteger(req.body?.holdSeconds, Number(before.hold_seconds), 60, 3600),
        req.body?.allowCapacityOverride === void 0 ? before.allow_capacity_override : booleanValue(req.body.allowCapacityOverride),
        req.body?.autoConfirm === void 0 ? before.auto_confirm : booleanValue(req.body.autoConfirm),
        req.adminPrincipal.adminId
      ]
    );
    await writeAdminAudit(db2, req, {
      action: "booking.settings.update",
      targetType: "booking_settings",
      targetId: "singleton",
      reason: optionalText(req.body?.reason, 1e3),
      before,
      after: settings
    });
    res.json({ settings });
  }));
  return router;
}

// server/routes/admin-economy.ts
import { randomUUID as randomUUID3 } from "node:crypto";
import { Router as Router7 } from "express";

// server/economy.ts
async function mutatePoints(db2, input) {
  if (!Number.isSafeInteger(input.amount) || input.amount === 0) {
    throw new ApiError(400, "Point amount must be a non-zero safe integer", "validation_error");
  }
  return transaction(db2, async (client) => {
    const replay = await one(
      client,
      `select * from public.point_ledger where idempotency_key = $1`,
      [input.idempotencyKey]
    );
    if (replay) {
      if (replay.user_key !== input.userKey || Number(replay.amount) !== input.amount) {
        throw new ApiError(409, "Idempotency key was already used for another operation", "idempotency_conflict");
      }
      return { ledger: replay, replayed: true };
    }
    await client.query(
      `insert into public.point_accounts(user_key)
       values ($1)
       on conflict (user_key) do nothing`,
      [input.userKey]
    );
    const account = await one(
      client,
      `select * from public.point_accounts where user_key = $1 for update`,
      [input.userKey]
    );
    const balanceBefore = Number(account?.balance || 0);
    const balanceAfter = balanceBefore + input.amount;
    if (balanceAfter < 0) {
      throw new ApiError(409, "Not enough BALI points", "insufficient_points", {
        balance: balanceBefore,
        required: Math.abs(input.amount)
      });
    }
    await client.query(
      `update public.point_accounts
          set balance = $2,
              lifetime_earned = lifetime_earned + case when $3 > 0 then $3 else 0 end,
              lifetime_spent = lifetime_spent + case when $3 < 0 then -$3 else 0 end,
              version = version + 1,
              updated_at = now()
        where user_key = $1`,
      [input.userKey, balanceAfter, input.amount]
    );
    const ledger = await one(
      client,
      `insert into public.point_ledger(
         user_key, amount, balance_before, balance_after, operation_type,
         source_type, source_id, reason, administrator_id, idempotency_key, metadata
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
       returning *`,
      [
        input.userKey,
        input.amount,
        balanceBefore,
        balanceAfter,
        input.operationType,
        input.sourceType,
        input.sourceId || "",
        input.reason || "",
        input.administratorId || null,
        input.idempotencyKey,
        JSON.stringify(input.metadata || {})
      ]
    );
    return { ledger, replayed: false };
  });
}

// server/game-prizes.ts
async function finalizeGameSeason(db2, seasonId, issuedByAdminId = null) {
  return transaction(db2, async (client) => {
    const season = await one(
      client,
      `select * from public.game_seasons where id = $1 for update`,
      [seasonId]
    );
    if (!season) throw new ApiError(404, "Game season was not found", "not_found");
    if (season.status === "completed") {
      const prizes = await many(
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
    const winners = await many(
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
      const payload = configuredRewards[Number(winner.position) - 1] || {};
      const prizeKey = `game-prize:${seasonId}:${winner.position}`;
      const prize = await one(
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
          reason: `BALI Match: ${winner.position} \u043C\u0435\u0441\u0442\u043E`,
          administratorId: issuedByAdminId,
          idempotencyKey: `${prizeKey}:points`
        });
      }
      for (const rewardId of Array.isArray(payload.rewardIds) ? payload.rewardIds : []) {
        const reward = await one(
          client,
          `select * from public.reward_definitions where id = $1`,
          [String(rewardId)]
        );
        if (!reward) continue;
        const grant = await one(
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
            reason: `\u041D\u0430\u0433\u0440\u0430\u0434\u0430: ${reward.name}`,
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
        const plan = await one(client, `select id from public.vip_plans where id = $1`, [vipPlanId]);
        if (plan) {
          const current = await one(
            client,
            `select ends_at from public.user_vip_subscriptions
              where user_key = $1 and status in ('active','scheduled') and ends_at > now()
              order by ends_at desc limit 1 for update`,
            [winner.user_key]
          );
          const startsAt = current ? new Date(current.ends_at) : /* @__PURE__ */ new Date();
          const endsAt = new Date(startsAt.getTime() + vipDays * 864e5);
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
         ) values ($1,'game_prize','\u041D\u0430\u0433\u0440\u0430\u0434\u0430 BALI Match',$2,$3::jsonb,$4)
         on conflict (idempotency_key) do nothing`,
        [
          winner.user_key,
          `${winner.position} \u043C\u0435\u0441\u0442\u043E \u0432 \u043D\u0435\u0434\u0435\u043B\u044C\u043D\u043E\u043C \u0440\u0435\u0439\u0442\u0438\u043D\u0433\u0435. \u041D\u0430\u0433\u0440\u0430\u0434\u0430 \u043D\u0430\u0447\u0438\u0441\u043B\u0435\u043D\u0430.`,
          JSON.stringify({ seasonId, position: winner.position, score: winner.score, payload }),
          `${prizeKey}:notification`
        ]
      );
    }
    const completed = await one(
      client,
      `update public.game_seasons set status = 'completed', updated_at = now()
        where id = $1 returning *`,
      [seasonId]
    );
    return { season: completed, winners, replayed: false };
  });
}
async function finalizeEndedGameSeasons(db2) {
  const ended = await many(
    db2,
    `select id from public.game_seasons
      where status = 'active' and ends_at <= now()
      order by ends_at limit 20`
  );
  for (const season of ended) await finalizeGameSeason(db2, season.id);
}

// server/routes/admin-economy.ts
var RARITIES = ["common", "rare", "epic", "legendary"];
var GIFT_TYPES = ["virtual", "physical"];
var SHOP_STATUSES = ["draft", "active", "sold_out", "archived"];
var SEASON_STATUSES = ["scheduled", "active", "completed", "archived"];
function jsonObject(value, field) {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new ApiError(400, `${field} must be an object`, "validation_error");
  }
  return value;
}
function jsonArray(value, field) {
  if (!Array.isArray(value)) throw new ApiError(400, `${field} must be an array`, "validation_error");
  return value;
}
async function targetRow(db2, table, id) {
  const allowed = /* @__PURE__ */ new Set([
    "reward_definitions",
    "gift_catalog",
    "vip_plans",
    "shop_items",
    "game_seasons"
  ]);
  if (!allowed.has(table)) throw new Error("Unsupported administrator catalog table");
  const row = await one(db2, `select * from public.${table} where id = $1`, [id]);
  if (!row) throw new ApiError(404, "Catalog item was not found", "not_found");
  return row;
}
function createAdminEconomyRouter(db2) {
  const router = Router7();
  router.use(requireAdmin);
  router.get("/economy", asyncHandler(async (_req, res) => {
    const [
      settings,
      rewards,
      gifts,
      vipPlans,
      shopItems,
      gameSettings,
      seasons,
      gameSymbolVersions
    ] = await Promise.all([
      one(db2, `select * from public.economy_settings where singleton = true`),
      many(db2, `select * from public.reward_definitions order by updated_at desc`),
      many(db2, `select * from public.gift_catalog order by sort_order, name`),
      many(db2, `select * from public.vip_plans order by sort_order, points_cost`),
      many(db2, `select * from public.shop_items order by sort_order, name`),
      one(db2, `select * from public.game_settings where singleton = true`),
      many(db2, `select * from public.game_seasons order by starts_at desc`),
      many(db2, `select * from public.game_symbol_versions order by created_at desc limit 200`)
    ]);
    res.json({ settings, rewards, gifts, vipPlans, shopItems, gameSettings, seasons, gameSymbolVersions });
  }));
  router.patch("/economy/settings", asyncHandler(async (req, res) => {
    const before = await one(db2, `select * from public.economy_settings where singleton = true`);
    if (!before) throw new ApiError(500, "Economy settings are missing", "economy_settings_missing");
    const settings = await one(
      db2,
      `update public.economy_settings
          set registration_points = $1, profile_completion_points = $2,
              checkin_points = $3, invited_friend_points = $4,
              clan_activity_points = $5, updated_by_admin_id = $6,
              updated_at = now()
        where singleton = true returning *`,
      [
        boundedInteger(req.body?.registrationPoints, Number(before.registration_points), 0, 1e9),
        boundedInteger(req.body?.profileCompletionPoints, Number(before.profile_completion_points), 0, 1e9),
        boundedInteger(req.body?.checkinPoints, Number(before.checkin_points), 0, 1e9),
        boundedInteger(req.body?.invitedFriendPoints, Number(before.invited_friend_points), 0, 1e9),
        boundedInteger(req.body?.clanActivityPoints, Number(before.clan_activity_points), 0, 1e9),
        req.adminPrincipal.adminId
      ]
    );
    await writeAdminAudit(db2, req, {
      action: "economy.settings.update",
      targetType: "economy_settings",
      targetId: "singleton",
      reason: requiredText(req.body?.reason, "reason", 1e3),
      before,
      after: settings
    });
    res.json({ settings });
  }));
  router.get("/points/ledger", asyncHandler(async (req, res) => {
    const userKey = req.query.userKey ? identifier(req.query.userKey, "userKey") : null;
    const ledger = await many(
      db2,
      `select ledger.*, user_row.name, user_row.username, admin.email as administrator_email
         from public.point_ledger ledger
         join public.app_users user_row on user_row.user_key = ledger.user_key
         left join public.admin_users admin on admin.id = ledger.administrator_id
        where ($1::text is null or ledger.user_key = $1)
        order by ledger.created_at desc limit 1000`,
      [userKey]
    );
    res.json({ ledger });
  }));
  router.post("/points/adjustments", asyncHandler(async (req, res) => {
    const userKey = identifier(req.body?.userKey, "userKey");
    const amount = boundedInteger(req.body?.amount, 0, -1e9, 1e9);
    if (!amount) throw new ApiError(400, "amount must not be zero", "validation_error");
    const reason = requiredText(req.body?.reason, "reason", 1e3);
    const key = requiredText(req.body?.idempotencyKey, "idempotencyKey", 160);
    const result = await mutatePoints(db2, {
      userKey,
      amount,
      operationType: "adjustment",
      sourceType: "admin",
      sourceId: req.adminPrincipal.adminId,
      reason,
      administratorId: req.adminPrincipal.adminId,
      idempotencyKey: `admin-adjustment:${key}`
    });
    await writeAdminAudit(db2, req, {
      action: "points.adjust",
      targetType: "app_user",
      targetId: userKey,
      reason,
      after: result.ledger
    });
    res.status(result.replayed ? 200 : 201).json(result);
  }));
  router.post("/rewards", asyncHandler(async (req, res) => {
    const rewardId = req.body?.id ? identifier(req.body.id, "id") : `reward-${randomUUID3()}`;
    const config2 = req.body?.conditionConfig === void 0 ? {} : jsonObject(req.body.conditionConfig, "conditionConfig");
    const reward = await one(
      db2,
      `insert into public.reward_definitions(
         id, name, icon_url, description, points, xp, rarity, condition_type,
         condition_config, event_id, clan_id, valid_from, valid_until,
         repeatable, max_grants_per_user, active, created_by_admin_id
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14,$15,$16,$17)
       returning *`,
      [
        rewardId,
        requiredText(req.body?.name, "name", 160),
        optionalText(req.body?.iconUrl, 2e3),
        optionalText(req.body?.description, 2e3),
        boundedInteger(req.body?.points, 0, 0, 1e9),
        boundedInteger(req.body?.xp, 0, 0, 1e9),
        enumValue(req.body?.rarity || "common", "rarity", RARITIES),
        requiredText(req.body?.conditionType || "manual", "conditionType", 100),
        JSON.stringify(config2),
        req.body?.eventId ? identifier(req.body.eventId, "eventId") : null,
        req.body?.clanId ? identifier(req.body.clanId, "clanId") : null,
        isoDateOrNull(req.body?.validFrom),
        isoDateOrNull(req.body?.validUntil),
        booleanValue(req.body?.repeatable),
        boundedInteger(req.body?.maxGrantsPerUser, 1, 1, 1e6),
        booleanValue(req.body?.active, true),
        req.adminPrincipal.adminId
      ]
    );
    await writeAdminAudit(db2, req, {
      action: "reward.create",
      targetType: "reward_definition",
      targetId: rewardId,
      after: reward
    });
    res.status(201).json({ reward });
  }));
  router.patch("/rewards/:rewardId", asyncHandler(async (req, res) => {
    const rewardId = identifier(req.params.rewardId, "rewardId");
    const before = await targetRow(db2, "reward_definitions", rewardId);
    const config2 = req.body?.conditionConfig === void 0 ? before.condition_config : jsonObject(req.body.conditionConfig, "conditionConfig");
    const reward = await one(
      db2,
      `update public.reward_definitions
          set name = $2, icon_url = $3, description = $4, points = $5, xp = $6,
              rarity = $7, condition_type = $8, condition_config = $9::jsonb,
              valid_from = $10, valid_until = $11, repeatable = $12,
              max_grants_per_user = $13, active = $14, updated_at = now()
        where id = $1 returning *`,
      [
        rewardId,
        req.body?.name === void 0 ? before.name : requiredText(req.body.name, "name", 160),
        req.body?.iconUrl === void 0 ? before.icon_url : optionalText(req.body.iconUrl, 2e3),
        req.body?.description === void 0 ? before.description : optionalText(req.body.description, 2e3),
        boundedInteger(req.body?.points, Number(before.points), 0, 1e9),
        boundedInteger(req.body?.xp, Number(before.xp), 0, 1e9),
        req.body?.rarity === void 0 ? before.rarity : enumValue(req.body.rarity, "rarity", RARITIES),
        req.body?.conditionType === void 0 ? before.condition_type : requiredText(req.body.conditionType, "conditionType", 100),
        JSON.stringify(config2),
        req.body?.validFrom === void 0 ? before.valid_from : isoDateOrNull(req.body.validFrom),
        req.body?.validUntil === void 0 ? before.valid_until : isoDateOrNull(req.body.validUntil),
        req.body?.repeatable === void 0 ? before.repeatable : booleanValue(req.body.repeatable),
        boundedInteger(req.body?.maxGrantsPerUser, Number(before.max_grants_per_user), 1, 1e6),
        req.body?.active === void 0 ? before.active : booleanValue(req.body.active)
      ]
    );
    await writeAdminAudit(db2, req, {
      action: "reward.update",
      targetType: "reward_definition",
      targetId: rewardId,
      reason: optionalText(req.body?.reason, 1e3),
      before,
      after: reward
    });
    res.json({ reward });
  }));
  router.post("/rewards/:rewardId/grants", asyncHandler(async (req, res) => {
    const rewardId = identifier(req.params.rewardId, "rewardId");
    const userKey = identifier(req.body?.userKey, "userKey");
    const key = requiredText(req.body?.idempotencyKey, "idempotencyKey", 160);
    const reward = await targetRow(db2, "reward_definitions", rewardId);
    const result = await transaction(db2, async (client) => {
      const existing = await one(
        client,
        `select * from public.user_rewards where idempotency_key = $1`,
        [`reward-grant:${key}`]
      );
      if (existing) return { grant: existing, replayed: true };
      const count = await one(
        client,
        `select count(*)::integer as count from public.user_rewards
          where reward_id = $1 and user_key = $2 and status <> 'revoked'`,
        [rewardId, userKey]
      );
      if (!reward.repeatable && Number(count?.count || 0) > 0) {
        throw new ApiError(409, "This reward has already been granted", "reward_already_granted");
      }
      if (Number(count?.count || 0) >= Number(reward.max_grants_per_user)) {
        throw new ApiError(409, "Reward grant limit reached", "reward_grant_limit");
      }
      let pointTransactionId = null;
      if (Number(reward.points) > 0) {
        const pointResult = await mutatePoints(client, {
          userKey,
          amount: Number(reward.points),
          operationType: "credit",
          sourceType: "reward",
          sourceId: rewardId,
          reason: `\u041D\u0430\u0433\u0440\u0430\u0434\u0430: ${reward.name}`,
          administratorId: req.adminPrincipal.adminId,
          idempotencyKey: `reward-points:${key}`
        });
        pointTransactionId = pointResult.ledger.id;
      }
      const grant = await one(
        client,
        `insert into public.user_rewards(
           reward_id, user_key, source_type, source_id, idempotency_key,
           granted_by_admin_id, metadata
         ) values ($1,$2,'admin',$3,$4,$5,$6::jsonb)
         returning *`,
        [
          rewardId,
          userKey,
          req.adminPrincipal.adminId,
          `reward-grant:${key}`,
          req.adminPrincipal.adminId,
          JSON.stringify({ pointTransactionId })
        ]
      );
      await client.query(
        `update public.game_profiles
            set xp = xp + $2, updated_at = now()
          where user_key = $1`,
        [userKey, Number(reward.xp || 0)]
      );
      return { grant, replayed: false };
    });
    await writeAdminAudit(db2, req, {
      action: "reward.grant",
      targetType: "app_user",
      targetId: userKey,
      reason: requiredText(req.body?.reason, "reason", 1e3),
      after: result.grant
    });
    res.status(result.replayed ? 200 : 201).json(result);
  }));
  router.post("/gifts/catalog", asyncHandler(async (req, res) => {
    const itemId = req.body?.id ? identifier(req.body.id, "id") : `gift-${randomUUID3()}`;
    const gift = await one(
      db2,
      `insert into public.gift_catalog(
         id, name, description, image_url, gift_type, points_cost,
         validity_days, active, sort_order, created_by_admin_id
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       returning *`,
      [
        itemId,
        requiredText(req.body?.name, "name", 160),
        optionalText(req.body?.description, 2e3),
        optionalText(req.body?.imageUrl, 2e3),
        enumValue(req.body?.giftType || "virtual", "giftType", GIFT_TYPES),
        boundedInteger(req.body?.pointsCost, 0, 0, 1e9),
        req.body?.validityDays === null ? null : boundedInteger(req.body?.validityDays, 365, 1, 3650),
        booleanValue(req.body?.active, true),
        boundedInteger(req.body?.sortOrder, 0, -1e6, 1e6),
        req.adminPrincipal.adminId
      ]
    );
    await writeAdminAudit(db2, req, {
      action: "gift.catalog.create",
      targetType: "gift_catalog",
      targetId: itemId,
      after: gift
    });
    res.status(201).json({ gift });
  }));
  router.patch("/gifts/catalog/:itemId", asyncHandler(async (req, res) => {
    const itemId = identifier(req.params.itemId, "itemId");
    const before = await targetRow(db2, "gift_catalog", itemId);
    const gift = await one(
      db2,
      `update public.gift_catalog
          set name = $2, description = $3, image_url = $4, gift_type = $5,
              points_cost = $6, validity_days = $7, active = $8,
              sort_order = $9, updated_at = now()
        where id = $1 returning *`,
      [
        itemId,
        req.body?.name === void 0 ? before.name : requiredText(req.body.name, "name", 160),
        req.body?.description === void 0 ? before.description : optionalText(req.body.description, 2e3),
        req.body?.imageUrl === void 0 ? before.image_url : optionalText(req.body.imageUrl, 2e3),
        req.body?.giftType === void 0 ? before.gift_type : enumValue(req.body.giftType, "giftType", GIFT_TYPES),
        boundedInteger(req.body?.pointsCost, Number(before.points_cost), 0, 1e9),
        req.body?.validityDays === void 0 ? before.validity_days : req.body.validityDays === null ? null : boundedInteger(req.body.validityDays, 365, 1, 3650),
        req.body?.active === void 0 ? before.active : booleanValue(req.body.active),
        boundedInteger(req.body?.sortOrder, Number(before.sort_order), -1e6, 1e6)
      ]
    );
    await writeAdminAudit(db2, req, {
      action: "gift.catalog.update",
      targetType: "gift_catalog",
      targetId: itemId,
      reason: optionalText(req.body?.reason, 1e3),
      before,
      after: gift
    });
    res.json({ gift });
  }));
  router.post("/gifts/grants", asyncHandler(async (req, res) => {
    const catalogItemId = identifier(req.body?.catalogItemId, "catalogItemId");
    const userKey = identifier(req.body?.userKey, "userKey");
    const reason = requiredText(req.body?.reason, "reason", 1e3);
    const key = requiredText(req.body?.idempotencyKey, "idempotencyKey", 160);
    const message = optionalText(req.body?.message, 500);
    let result;
    try {
      result = await transaction(db2, async (client) => {
        const replay = await one(
          client,
          `select * from public.gifts where idempotency_key = $1`,
          [`admin-gift:${key}`]
        );
        if (replay) {
          if (replay.recipient_user_key !== userKey || replay.catalog_item_id !== catalogItemId) {
            throw new ApiError(409, "Idempotency key was used for another gift", "idempotency_conflict");
          }
          return { gift: replay, replayed: true };
        }
        const [catalog, recipient] = await Promise.all([
          one(client, `select * from public.gift_catalog where id = $1`, [catalogItemId]),
          one(
            client,
            `select user_key from public.app_users where user_key = $1 and account_status = 'active'`,
            [userKey]
          )
        ]);
        if (!catalog) throw new ApiError(404, "Gift catalog item was not found", "not_found");
        if (!recipient) throw new ApiError(404, "Active recipient was not found", "not_found");
        const gift = await one(
          client,
          `insert into public.gifts(
           catalog_item_id, sender_user_key, recipient_user_key, points_cost,
           message, status, qr_token_hash, expires_at, idempotency_key
         ) values (
           $1,null,$2,0,$3,'delivered',null,
           case when $4::integer is null then null else now() + make_interval(days => $4) end,
           $5
         ) returning *`,
          [catalogItemId, userKey, message, catalog.validity_days, `admin-gift:${key}`]
        );
        await client.query(
          `insert into public.notifications(
           user_key, notification_type, title, body, data, idempotency_key
         ) values ($1,'gift_received','\u041F\u043E\u0434\u0430\u0440\u043E\u043A \u043E\u0442 BALI',$2,$3::jsonb,$4)
         on conflict (idempotency_key) do nothing`,
          [
            userKey,
            message || `\u0412\u0430\u043C \u0432\u044B\u0434\u0430\u043D \u043F\u043E\u0434\u0430\u0440\u043E\u043A \xAB${catalog.name}\xBB.`,
            JSON.stringify({ giftId: gift.id, catalogItemId }),
            `admin-gift-notification:${key}`
          ]
        );
        return { gift, replayed: false };
      });
    } catch (error) {
      if (error?.code !== "23505") throw error;
      const replay = await one(
        db2,
        `select * from public.gifts where idempotency_key = $1`,
        [`admin-gift:${key}`]
      );
      if (!replay || replay.recipient_user_key !== userKey || replay.catalog_item_id !== catalogItemId) {
        throw new ApiError(409, "Idempotency key was used for another gift", "idempotency_conflict");
      }
      result = { gift: replay, replayed: true };
    }
    await writeAdminAudit(db2, req, {
      action: "gift.grant",
      targetType: "app_user",
      targetId: userKey,
      reason,
      after: result.gift
    });
    res.status(result.replayed ? 200 : 201).json(result);
  }));
  router.post("/vip/plans", asyncHandler(async (req, res) => {
    const planId = req.body?.id ? identifier(req.body.id, "id") : `vip-${randomUUID3()}`;
    const vipPlan = await one(
      db2,
      `insert into public.vip_plans(
         id, name, points_cost, duration_days, benefits, points_multiplier,
         extra_game_lives, event_access, shop_access, booking_priority,
         profile_frame_url, badge_url, active, sort_order, created_by_admin_id
       ) values ($1,$2,$3,$4,$5::jsonb,$6,$7,$8::jsonb,$9::jsonb,$10,$11,$12,$13,$14,$15)
       returning *`,
      [
        planId,
        requiredText(req.body?.name, "name", 160),
        boundedInteger(req.body?.pointsCost, 0, 0, 1e9),
        boundedInteger(req.body?.durationDays, 30, 1, 3650),
        JSON.stringify(jsonArray(req.body?.benefits || [], "benefits")),
        boundedNumber(req.body?.pointsMultiplier, 1, 1, 100),
        boundedInteger(req.body?.extraGameLives, 0, 0, 1e3),
        JSON.stringify(jsonArray(req.body?.eventAccess || [], "eventAccess")),
        JSON.stringify(jsonArray(req.body?.shopAccess || [], "shopAccess")),
        boundedInteger(req.body?.bookingPriority, 0, -1e3, 1e3),
        optionalText(req.body?.profileFrameUrl, 2e3),
        optionalText(req.body?.badgeUrl, 2e3),
        booleanValue(req.body?.active, true),
        boundedInteger(req.body?.sortOrder, 0, -1e6, 1e6),
        req.adminPrincipal.adminId
      ]
    );
    await writeAdminAudit(db2, req, {
      action: "vip.plan.create",
      targetType: "vip_plan",
      targetId: planId,
      after: vipPlan
    });
    res.status(201).json({ vipPlan });
  }));
  router.patch("/vip/plans/:planId", asyncHandler(async (req, res) => {
    const planId = identifier(req.params.planId, "planId");
    const before = await targetRow(db2, "vip_plans", planId);
    const vipPlan = await one(
      db2,
      `update public.vip_plans
          set name = $2, points_cost = $3, duration_days = $4, benefits = $5::jsonb,
              points_multiplier = $6, extra_game_lives = $7,
              event_access = $8::jsonb, shop_access = $9::jsonb,
              booking_priority = $10, profile_frame_url = $11,
              badge_url = $12, active = $13, sort_order = $14, updated_at = now()
        where id = $1 returning *`,
      [
        planId,
        req.body?.name === void 0 ? before.name : requiredText(req.body.name, "name", 160),
        boundedInteger(req.body?.pointsCost, Number(before.points_cost), 0, 1e9),
        boundedInteger(req.body?.durationDays, Number(before.duration_days), 1, 3650),
        JSON.stringify(req.body?.benefits === void 0 ? before.benefits : jsonArray(req.body.benefits, "benefits")),
        boundedNumber(req.body?.pointsMultiplier, Number(before.points_multiplier), 1, 100),
        boundedInteger(req.body?.extraGameLives, Number(before.extra_game_lives), 0, 1e3),
        JSON.stringify(req.body?.eventAccess === void 0 ? before.event_access : jsonArray(req.body.eventAccess, "eventAccess")),
        JSON.stringify(req.body?.shopAccess === void 0 ? before.shop_access : jsonArray(req.body.shopAccess, "shopAccess")),
        boundedInteger(req.body?.bookingPriority, Number(before.booking_priority), -1e3, 1e3),
        req.body?.profileFrameUrl === void 0 ? before.profile_frame_url : optionalText(req.body.profileFrameUrl, 2e3),
        req.body?.badgeUrl === void 0 ? before.badge_url : optionalText(req.body.badgeUrl, 2e3),
        req.body?.active === void 0 ? before.active : booleanValue(req.body.active),
        boundedInteger(req.body?.sortOrder, Number(before.sort_order), -1e6, 1e6)
      ]
    );
    await writeAdminAudit(db2, req, {
      action: "vip.plan.update",
      targetType: "vip_plan",
      targetId: planId,
      reason: optionalText(req.body?.reason, 1e3),
      before,
      after: vipPlan
    });
    res.json({ vipPlan });
  }));
  router.post("/vip/grants", asyncHandler(async (req, res) => {
    const planId = identifier(req.body?.planId, "planId");
    const userKey = identifier(req.body?.userKey, "userKey");
    const reason = requiredText(req.body?.reason, "reason", 1e3);
    const key = requiredText(req.body?.idempotencyKey, "idempotencyKey", 160);
    let result;
    try {
      result = await transaction(db2, async (client) => {
        const replay = await one(
          client,
          `select * from public.user_vip_subscriptions where idempotency_key = $1`,
          [`admin-vip:${key}`]
        );
        if (replay) {
          if (replay.user_key !== userKey || replay.plan_id !== planId) {
            throw new ApiError(409, "Idempotency key was used for another VIP grant", "idempotency_conflict");
          }
          return { subscription: replay, replayed: true };
        }
        const [plan, user, current] = await Promise.all([
          one(client, `select * from public.vip_plans where id = $1`, [planId]),
          one(
            client,
            `select user_key from public.app_users where user_key = $1 and account_status = 'active'`,
            [userKey]
          ),
          one(
            client,
            `select ends_at from public.user_vip_subscriptions
            where user_key = $1 and status in ('active','scheduled') and ends_at > now()
            order by ends_at desc limit 1 for update`,
            [userKey]
          )
        ]);
        if (!plan) throw new ApiError(404, "VIP plan was not found", "not_found");
        if (!user) throw new ApiError(404, "Active user was not found", "not_found");
        const durationDays = boundedInteger(
          req.body?.durationDays,
          Number(plan.duration_days),
          1,
          3650
        );
        const startsAt = current ? new Date(current.ends_at) : /* @__PURE__ */ new Date();
        const endsAt = new Date(startsAt.getTime() + durationDays * 864e5);
        const subscription = await one(
          client,
          `insert into public.user_vip_subscriptions(
           user_key, plan_id, source_type, starts_at, ends_at, status,
           issued_by_admin_id, idempotency_key
         ) values ($1,$2,'admin',$3,$4,$5,$6,$7)
         returning *`,
          [
            userKey,
            planId,
            startsAt.toISOString(),
            endsAt.toISOString(),
            startsAt.getTime() > Date.now() ? "scheduled" : "active",
            req.adminPrincipal.adminId,
            `admin-vip:${key}`
          ]
        );
        await client.query(
          `update public.app_users set vip_expires_at = $2, updated_at = now() where user_key = $1`,
          [userKey, endsAt.toISOString()]
        );
        await client.query(
          `insert into public.notifications(
           user_key, notification_type, title, body, data, idempotency_key
         ) values ($1,'vip_granted','VIP \u043E\u0442 BALI',$2,$3::jsonb,$4)
         on conflict (idempotency_key) do nothing`,
          [
            userKey,
            `\u0412\u0430\u043C \u0432\u044B\u0434\u0430\u043D VIP \xAB${plan.name}\xBB \u043D\u0430 ${durationDays} \u0434\u043D.`,
            JSON.stringify({ subscriptionId: subscription.id, planId, endsAt: endsAt.toISOString() }),
            `admin-vip-notification:${key}`
          ]
        );
        return { subscription, replayed: false };
      });
    } catch (error) {
      if (error?.code !== "23505") throw error;
      const replay = await one(
        db2,
        `select * from public.user_vip_subscriptions where idempotency_key = $1`,
        [`admin-vip:${key}`]
      );
      if (!replay || replay.user_key !== userKey || replay.plan_id !== planId) {
        throw new ApiError(409, "Idempotency key was used for another VIP grant", "idempotency_conflict");
      }
      result = { subscription: replay, replayed: true };
    }
    await writeAdminAudit(db2, req, {
      action: "vip.grant",
      targetType: "app_user",
      targetId: userKey,
      reason,
      after: result.subscription
    });
    res.status(result.replayed ? 200 : 201).json(result);
  }));
  router.post("/vip/subscriptions/:subscriptionId/revoke", asyncHandler(async (req, res) => {
    const subscriptionId = uuid(req.params.subscriptionId, "subscriptionId");
    const reason = requiredText(req.body?.reason, "reason", 1e3);
    const result = await transaction(db2, async (client) => {
      const before = await one(
        client,
        `select * from public.user_vip_subscriptions where id = $1 for update`,
        [subscriptionId]
      );
      if (!before) throw new ApiError(404, "VIP subscription was not found", "not_found");
      if (before.status === "revoked") return { before, subscription: before, replayed: true };
      const subscription = await one(
        client,
        `update public.user_vip_subscriptions
            set status = 'revoked', revoked_by_admin_id = $2, revoked_at = now(),
                revocation_reason = $3, updated_at = now()
          where id = $1 returning *`,
        [subscriptionId, req.adminPrincipal.adminId, reason]
      );
      const remaining = await one(
        client,
        `select max(ends_at) as vip_expires_at
           from public.user_vip_subscriptions
          where user_key = $1 and id <> $2
            and status in ('active','scheduled') and ends_at > now()`,
        [before.user_key, subscriptionId]
      );
      await client.query(
        `update public.app_users set vip_expires_at = $2, updated_at = now() where user_key = $1`,
        [before.user_key, remaining?.vip_expires_at || null]
      );
      return { before, subscription, replayed: false };
    });
    if (!result.replayed) {
      await writeAdminAudit(db2, req, {
        action: "vip.revoke",
        targetType: "user_vip_subscription",
        targetId: subscriptionId,
        reason,
        before: result.before,
        after: result.subscription
      });
    }
    res.json({ subscription: result.subscription, replayed: result.replayed });
  }));
  router.post("/shop/items", asyncHandler(async (req, res) => {
    const itemId = req.body?.id ? identifier(req.body.id, "id") : `shop-${randomUUID3()}`;
    const metadata = req.body?.metadata === void 0 ? {} : jsonObject(req.body.metadata, "metadata");
    const shopItem = await one(
      db2,
      `insert into public.shop_items(
         id, name, description, image_url, category, points_cost, stock,
         valid_from, valid_until, status, per_user_limit, requires_redemption,
         sort_order, metadata, created_by_admin_id
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15)
       returning *`,
      [
        itemId,
        requiredText(req.body?.name, "name", 160),
        optionalText(req.body?.description, 2e3),
        optionalText(req.body?.imageUrl, 2e3),
        requiredText(req.body?.category || "other", "category", 100),
        boundedInteger(req.body?.pointsCost, 0, 0, 1e9),
        req.body?.stock === null ? null : boundedInteger(req.body?.stock, 0, 0, 1e9),
        isoDateOrNull(req.body?.validFrom),
        isoDateOrNull(req.body?.validUntil),
        enumValue(req.body?.status || "draft", "status", SHOP_STATUSES),
        req.body?.perUserLimit === null ? null : boundedInteger(req.body?.perUserLimit, 1, 1, 1e6),
        booleanValue(req.body?.requiresRedemption),
        boundedInteger(req.body?.sortOrder, 0, -1e6, 1e6),
        JSON.stringify(metadata),
        req.adminPrincipal.adminId
      ]
    );
    await writeAdminAudit(db2, req, {
      action: "shop.item.create",
      targetType: "shop_item",
      targetId: itemId,
      after: shopItem
    });
    res.status(201).json({ shopItem });
  }));
  router.patch("/shop/items/:itemId", asyncHandler(async (req, res) => {
    const itemId = identifier(req.params.itemId, "itemId");
    const before = await targetRow(db2, "shop_items", itemId);
    const metadata = req.body?.metadata === void 0 ? before.metadata : jsonObject(req.body.metadata, "metadata");
    const shopItem = await one(
      db2,
      `update public.shop_items
          set name = $2, description = $3, image_url = $4, category = $5,
              points_cost = $6, stock = $7, valid_from = $8, valid_until = $9,
              status = $10, per_user_limit = $11, requires_redemption = $12,
              sort_order = $13, metadata = $14::jsonb, updated_at = now()
        where id = $1 returning *`,
      [
        itemId,
        req.body?.name === void 0 ? before.name : requiredText(req.body.name, "name", 160),
        req.body?.description === void 0 ? before.description : optionalText(req.body.description, 2e3),
        req.body?.imageUrl === void 0 ? before.image_url : optionalText(req.body.imageUrl, 2e3),
        req.body?.category === void 0 ? before.category : requiredText(req.body.category, "category", 100),
        boundedInteger(req.body?.pointsCost, Number(before.points_cost), 0, 1e9),
        req.body?.stock === void 0 ? before.stock : req.body.stock === null ? null : boundedInteger(req.body.stock, 0, 0, 1e9),
        req.body?.validFrom === void 0 ? before.valid_from : isoDateOrNull(req.body.validFrom),
        req.body?.validUntil === void 0 ? before.valid_until : isoDateOrNull(req.body.validUntil),
        req.body?.status === void 0 ? before.status : enumValue(req.body.status, "status", SHOP_STATUSES),
        req.body?.perUserLimit === void 0 ? before.per_user_limit : req.body.perUserLimit === null ? null : boundedInteger(req.body.perUserLimit, 1, 1, 1e6),
        req.body?.requiresRedemption === void 0 ? before.requires_redemption : booleanValue(req.body.requiresRedemption),
        boundedInteger(req.body?.sortOrder, Number(before.sort_order), -1e6, 1e6),
        JSON.stringify(metadata)
      ]
    );
    await writeAdminAudit(db2, req, {
      action: "shop.item.update",
      targetType: "shop_item",
      targetId: itemId,
      reason: optionalText(req.body?.reason, 1e3),
      before,
      after: shopItem
    });
    res.json({ shopItem });
  }));
  router.patch("/game/settings", asyncHandler(async (req, res) => {
    const before = await one(db2, `select * from public.game_settings where singleton = true`);
    if (!before) throw new ApiError(500, "Game settings are missing", "game_settings_missing");
    const resetSymbols = booleanValue(req.body?.resetSymbols);
    const resetPrizes = booleanValue(req.body?.resetPrizes);
    const resetGameRules = booleanValue(req.body?.resetGameRules);
    const nextSymbols = resetSymbols ? before.original_symbols : req.body?.symbols === void 0 ? before.symbols : jsonArray(req.body.symbols, "symbols");
    const settings = await one(
      db2,
      `update public.game_settings
          set base_lives = $1, continue_points_cost = $2, ranking_period_days = $3,
              max_score_per_second = $4, symbols = $5::jsonb,
              default_prizes = $6::jsonb, game_title = $7, game_subtitle = $8,
              background_image_url = $9, reward_image_url = $10,
              level_rules = $11::jsonb, scoring_rules = $12::jsonb,
              rating_rules = $13::jsonb, economy_rules = $14::jsonb,
              lives_rules = $15::jsonb, clan_rules = $16::jsonb,
              updated_by_admin_id = $17, updated_at = now()
        where singleton = true returning *`,
      [
        boundedInteger(req.body?.baseLives, Number(before.base_lives), 1, 100),
        boundedInteger(req.body?.continuePointsCost, Number(before.continue_points_cost), 0, 1e9),
        boundedInteger(req.body?.rankingPeriodDays, Number(before.ranking_period_days), 1, 366),
        boundedNumber(req.body?.maxScorePerSecond, Number(before.max_score_per_second), 1, 1e6),
        JSON.stringify(nextSymbols),
        JSON.stringify(resetPrizes ? before.original_prizes : req.body?.defaultPrizes === void 0 ? before.default_prizes : jsonArray(req.body.defaultPrizes, "defaultPrizes")),
        req.body?.gameTitle === void 0 ? before.game_title : requiredText(req.body.gameTitle, "gameTitle", 160),
        req.body?.gameSubtitle === void 0 ? before.game_subtitle : requiredText(req.body.gameSubtitle, "gameSubtitle", 300),
        req.body?.backgroundImageUrl === void 0 ? before.background_image_url : optionalText(req.body.backgroundImageUrl, 2e3),
        req.body?.rewardImageUrl === void 0 ? before.reward_image_url : optionalText(req.body.rewardImageUrl, 2e3),
        JSON.stringify(resetGameRules ? before.original_level_rules : req.body?.levelRules === void 0 ? before.level_rules : jsonObject(req.body.levelRules, "levelRules")),
        JSON.stringify(resetGameRules ? before.original_scoring_rules : req.body?.scoringRules === void 0 ? before.scoring_rules : jsonObject(req.body.scoringRules, "scoringRules")),
        JSON.stringify(resetGameRules ? before.original_rating_rules : req.body?.ratingRules === void 0 ? before.rating_rules : jsonObject(req.body.ratingRules, "ratingRules")),
        JSON.stringify(resetGameRules ? before.original_economy_rules : req.body?.economyRules === void 0 ? before.economy_rules : jsonObject(req.body.economyRules, "economyRules")),
        JSON.stringify(resetGameRules ? before.original_lives_rules : req.body?.livesRules === void 0 ? before.lives_rules : jsonObject(req.body.livesRules, "livesRules")),
        JSON.stringify(resetGameRules ? before.original_clan_rules : req.body?.clanRules === void 0 ? before.clan_rules : jsonObject(req.body.clanRules, "clanRules")),
        req.adminPrincipal.adminId
      ]
    );
    for (const symbol of nextSymbols) {
      const previous = Array.isArray(before.symbols) ? before.symbols.find((row) => String(row.key) === String(symbol?.key)) : null;
      const imageUrl = String(symbol?.imageUrl || symbol?.defaultImageUrl || "");
      const previousUrl = String(previous?.imageUrl || previous?.defaultImageUrl || "");
      if (!symbol?.key || !imageUrl || imageUrl === previousUrl) continue;
      await db2.query(
        `update public.game_symbol_versions set active = false where symbol_key = $1`,
        [String(symbol.key)]
      );
      await db2.query(
        `insert into public.game_symbol_versions(
           symbol_key, label, image_url, width, height, source, active, created_by_admin_id
         ) values ($1,$2,$3,512,512,$4,true,$5)`,
        [
          String(symbol.key),
          String(symbol.label || symbol.key),
          imageUrl,
          resetSymbols ? "restored" : "custom",
          req.adminPrincipal.adminId
        ]
      );
    }
    await writeAdminAudit(db2, req, {
      action: "game.settings.update",
      targetType: "game_settings",
      targetId: "singleton",
      reason: requiredText(req.body?.reason, "reason", 1e3),
      before,
      after: settings
    });
    res.json({ settings });
  }));
  router.get("/game/symbols/:symbolKey/versions", asyncHandler(async (req, res) => {
    const symbolKey = identifier(req.params.symbolKey, "symbolKey");
    const versions = await many(
      db2,
      `select * from public.game_symbol_versions
        where symbol_key = $1 order by created_at desc limit 50`,
      [symbolKey]
    );
    res.json({ symbolKey, recommendedWidth: 512, recommendedHeight: 512, versions });
  }));
  router.post("/game/symbols/:symbolKey/versions/:versionId/restore", asyncHandler(async (req, res) => {
    const symbolKey = identifier(req.params.symbolKey, "symbolKey");
    const versionId = uuid(req.params.versionId, "versionId");
    const before = await one(db2, `select * from public.game_settings where singleton = true`);
    const version = await one(
      db2,
      `select * from public.game_symbol_versions where id = $1 and symbol_key = $2`,
      [versionId, symbolKey]
    );
    if (!before || !version) throw new ApiError(404, "Game symbol version was not found", "not_found");
    const symbols = (Array.isArray(before.symbols) ? before.symbols : []).map(
      (symbol) => String(symbol.key) === symbolKey ? { ...symbol, imageUrl: version.image_url, active: true } : symbol
    );
    const settings = await one(
      db2,
      `update public.game_settings
          set symbols = $1::jsonb, updated_by_admin_id = $2, updated_at = now()
        where singleton = true returning *`,
      [JSON.stringify(symbols), req.adminPrincipal.adminId]
    );
    await db2.query(
      `update public.game_symbol_versions set active = (id = $2)
        where symbol_key = $1`,
      [symbolKey, versionId]
    );
    await writeAdminAudit(db2, req, {
      action: "game.symbol.version.restore",
      targetType: "game_symbol",
      targetId: symbolKey,
      reason: requiredText(req.body?.reason, "reason", 1e3),
      before,
      after: settings
    });
    res.json({ settings, version });
  }));
  router.post("/game/seasons", asyncHandler(async (req, res) => {
    const startsAt = isoDateOrNull(req.body?.startsAt);
    const endsAt = isoDateOrNull(req.body?.endsAt);
    if (!startsAt || !endsAt || new Date(endsAt) <= new Date(startsAt)) {
      throw new ApiError(400, "A valid season date range is required", "validation_error");
    }
    const overlap = await one(
      db2,
      `select id, name from public.game_seasons
        where status in ('scheduled','active')
          and starts_at < $2 and $1 < ends_at
        limit 1`,
      [startsAt, endsAt]
    );
    if (overlap) {
      throw new ApiError(
        409,
        "Game season overlaps another open season",
        "game_season_overlap",
        { seasonId: overlap.id, seasonName: overlap.name }
      );
    }
    const season = await one(
      db2,
      `insert into public.game_seasons(
         name, description, starts_at, ends_at, status, rewards,
         configuration, progress_mode, created_by_admin_id
       ) values ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9)
       returning *`,
      [
        requiredText(req.body?.name, "name", 160),
        optionalText(req.body?.description, 1e3),
        startsAt,
        endsAt,
        enumValue(req.body?.status || "scheduled", "status", SEASON_STATUSES),
        JSON.stringify(jsonArray(req.body?.rewards || [], "rewards")),
        JSON.stringify(req.body?.configuration === void 0 ? {} : jsonObject(req.body.configuration, "configuration")),
        enumValue(
          req.body?.progressMode || "account_keep_season_reset",
          "progressMode",
          ["account_keep_season_reset", "carry_all", "reset_all"]
        ),
        req.adminPrincipal.adminId
      ]
    );
    await writeAdminAudit(db2, req, {
      action: "game.season.create",
      targetType: "game_season",
      targetId: season.id,
      after: season
    });
    res.status(201).json({ season });
  }));
  router.post("/game/seasons/:seasonId/finalize", asyncHandler(async (req, res) => {
    const seasonId = uuid(req.params.seasonId, "seasonId");
    const reason = requiredText(req.body?.reason, "reason", 1e3);
    const result = await finalizeGameSeason(db2, seasonId, req.adminPrincipal.adminId);
    await writeAdminAudit(db2, req, {
      action: "game.season.finalize",
      targetType: "game_season",
      targetId: seasonId,
      reason,
      after: result
    });
    res.json(result);
  }));
  router.post("/game/sessions/:sessionId/exclude", asyncHandler(async (req, res) => {
    const sessionId = uuid(req.params.sessionId, "sessionId");
    const reason = requiredText(req.body?.reason, "reason", 1e3);
    const before = await one(
      db2,
      `select * from public.game_sessions where id = $1`,
      [sessionId]
    );
    if (!before) throw new ApiError(404, "Game session was not found", "not_found");
    const session = await one(
      db2,
      `update public.game_sessions
          set status = 'excluded', suspicious = true,
              excluded_by_admin_id = $2, exclusion_reason = $3, updated_at = now()
        where id = $1 returning *`,
      [sessionId, req.adminPrincipal.adminId, reason]
    );
    await writeAdminAudit(db2, req, {
      action: "game.session.exclude",
      targetType: "game_session",
      targetId: sessionId,
      reason,
      before,
      after: session
    });
    res.json({ session });
  }));
  return router;
}

// server/routes/admin-content.ts
import { randomUUID as randomUUID4 } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import express from "express";
import { Router as Router8 } from "express";
var SCOPES = ["app", "admin", "shared", "game"];
var MEDIA_TYPES = ["image", "video", "audio", "icon"];
var APP_TYPES = ["app", "admin"];
var IMAGE_TYPES = /* @__PURE__ */ new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"]
]);
function validImage(buffer, mimeType) {
  if (mimeType === "image/png") {
    return buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  if (mimeType === "image/jpeg") return buffer.length >= 4 && buffer[0] === 255 && buffer[1] === 216;
  if (mimeType === "image/webp") {
    return buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  }
  return false;
}
function objectValue(value, field) {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new ApiError(400, `${field} must be an object`, "validation_error");
  }
  return value;
}
function nullableDimension(value, _field) {
  if (value === void 0 || value === null || value === "") return null;
  return boundedInteger(value, 0, 1, 1e5);
}
function campaignSegment(value) {
  const source = value === void 0 ? {} : objectValue(value, "segment");
  const userKeys = source.userKeys === void 0 || source.userKeys === null ? null : Array.isArray(source.userKeys) ? [...new Set(source.userKeys.map((key) => identifier(key, "userKey")))].slice(0, 1e4) : (() => {
    throw new ApiError(400, "segment.userKeys must be an array", "validation_error");
  })();
  return {
    userKeys,
    marketingOnly: booleanValue(source.marketingOnly),
    clanId: source.clanId ? identifier(source.clanId, "clanId") : null,
    hasVip: source.hasVip === void 0 || source.hasVip === null ? null : booleanValue(source.hasVip)
  };
}
async function campaignCandidates(db2, segment) {
  return many(
    db2,
    `select user_row.user_key, user_row.name, account.telegram_user_id,
            coalesce(preferences.telegram_enabled, true) as telegram_enabled,
            coalesce(consent.marketing_opt_in, false) as marketing_opt_in
       from public.app_users user_row
       join public.telegram_accounts account on account.app_user_key = user_row.user_key
       left join public.user_consents consent on consent.user_key = user_row.user_key
       left join public.notification_preferences preferences on preferences.user_key = user_row.user_key
      where user_row.account_status = 'active' and user_row.blocked_at is null
        and ($1::text[] is null or user_row.user_key = any($1::text[]))
        and ($2::boolean = false or coalesce(consent.marketing_opt_in, false) = true)
        and ($3::text is null or exists (
          select 1 from public.clan_memberships membership
           where membership.user_key = user_row.user_key
             and membership.clan_id = $3 and membership.status = 'active'
        ))
        and ($4::boolean is null or exists (
          select 1 from public.user_vip_subscriptions vip
           where vip.user_key = user_row.user_key
             and vip.status = 'active' and vip.starts_at <= now() and vip.ends_at > now()
        ) = $4)
      order by user_row.user_key`,
    [segment.userKeys, segment.marketingOnly, segment.clanId, segment.hasVip]
  );
}
function createAdminContentRouter(db2, uploadDirectory2) {
  const router = Router8();
  router.use(requireAdmin);
  router.post(
    "/content/uploads",
    express.raw({ type: ["image/png", "image/jpeg", "image/webp"], limit: "12mb" }),
    asyncHandler(async (req, res) => {
      await enforceRateLimit(db2, req, "content.upload", requestSubject(req));
      const mimeType = String(req.get("content-type") || "").split(";")[0].trim().toLowerCase();
      const extension = IMAGE_TYPES.get(mimeType);
      const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      if (!extension || !validImage(body, mimeType)) {
        throw new ApiError(400, "Only valid PNG, JPG and WEBP images are accepted", "invalid_image");
      }
      const filename = `${randomUUID4()}.${extension}`;
      await writeFile(path.join(uploadDirectory2, filename), body, { flag: "wx", mode: 416 });
      const url = `/uploads/${filename}`;
      await writeAdminAudit(db2, req, {
        action: "content.upload.create",
        targetType: "uploaded_asset",
        targetId: filename,
        after: { url, mimeType, bytes: body.length }
      });
      res.status(201).json({ upload: { url, mimeType, bytes: body.length } });
    })
  );
  router.get("/content", asyncHandler(async (_req, res) => {
    const [assets, blocks, navigation] = await Promise.all([
      many(db2, `select * from public.admin_assets order by asset_key`),
      many(db2, `select * from public.ui_content_blocks order by scope, sort_order, block_key`),
      many(db2, `select * from public.ui_navigation_items order by app_type, sort_order, item_key`)
    ]);
    res.json({ assets, blocks, navigation });
  }));
  router.post("/content/assets", asyncHandler(async (req, res) => {
    const assetKey = identifier(req.body?.assetKey, "assetKey");
    const url = requiredText(req.body?.url, "url", 4e3);
    const asset = await one(
      db2,
      `insert into public.admin_assets(
         asset_key, name, default_name, url, default_url, media_type, mime_type,
         width, height, recommended_width, recommended_height,
         max_bytes, alt_text, updated_by_admin_id
       ) values ($1,$2,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       returning *`,
      [
        assetKey,
        requiredText(req.body?.name, "name", 200),
        url,
        optionalText(req.body?.defaultUrl, 4e3) || url,
        enumValue(req.body?.mediaType || "image", "mediaType", MEDIA_TYPES),
        optionalText(req.body?.mimeType, 200),
        nullableDimension(req.body?.width, "width"),
        nullableDimension(req.body?.height, "height"),
        nullableDimension(req.body?.recommendedWidth, "recommendedWidth"),
        nullableDimension(req.body?.recommendedHeight, "recommendedHeight"),
        req.body?.maxBytes === void 0 || req.body.maxBytes === null ? null : boundedInteger(req.body.maxBytes, 0, 1, 1e8),
        optionalText(req.body?.altText, 500),
        req.adminPrincipal.adminId
      ]
    );
    await writeAdminAudit(db2, req, {
      action: "content.asset.create",
      targetType: "admin_asset",
      targetId: assetKey,
      after: asset
    });
    res.status(201).json({ asset });
  }));
  router.patch("/content/assets/:assetKey", asyncHandler(async (req, res) => {
    const assetKey = identifier(req.params.assetKey, "assetKey");
    const before = await one(db2, `select * from public.admin_assets where asset_key = $1`, [assetKey]);
    if (!before) throw new ApiError(404, "Asset was not found", "not_found");
    const reset = booleanValue(req.body?.reset);
    const asset = await one(
      db2,
      `update public.admin_assets
          set name = $2, url = $3, media_type = $4, mime_type = $5,
              width = $6, height = $7, recommended_width = $8,
              recommended_height = $9, max_bytes = $10, alt_text = $11,
              updated_by_admin_id = $12, updated_at = now()
        where asset_key = $1 returning *`,
      [
        assetKey,
        reset ? before.default_name : req.body?.name === void 0 ? before.name : requiredText(req.body.name, "name", 200),
        reset ? before.default_url : req.body?.url === void 0 ? before.url : requiredText(req.body.url, "url", 4e3),
        req.body?.mediaType === void 0 ? before.media_type : enumValue(req.body.mediaType, "mediaType", MEDIA_TYPES),
        req.body?.mimeType === void 0 ? before.mime_type : optionalText(req.body.mimeType, 200),
        req.body?.width === void 0 ? before.width : nullableDimension(req.body.width, "width"),
        req.body?.height === void 0 ? before.height : nullableDimension(req.body.height, "height"),
        req.body?.recommendedWidth === void 0 ? before.recommended_width : nullableDimension(req.body.recommendedWidth, "recommendedWidth"),
        req.body?.recommendedHeight === void 0 ? before.recommended_height : nullableDimension(req.body.recommendedHeight, "recommendedHeight"),
        req.body?.maxBytes === void 0 ? before.max_bytes : req.body.maxBytes === null ? null : boundedInteger(req.body.maxBytes, 0, 1, 1e8),
        req.body?.altText === void 0 ? before.alt_text : optionalText(req.body.altText, 500),
        req.adminPrincipal.adminId
      ]
    );
    await writeAdminAudit(db2, req, {
      action: reset ? "content.asset.reset" : "content.asset.update",
      targetType: "admin_asset",
      targetId: assetKey,
      reason: optionalText(req.body?.reason, 1e3),
      before,
      after: asset
    });
    res.json({ asset });
  }));
  router.post("/content/blocks", asyncHandler(async (req, res) => {
    const scope = enumValue(req.body?.scope, "scope", SCOPES);
    const blockKey = identifier(req.body?.blockKey, "blockKey");
    const configuration = req.body?.configuration === void 0 ? {} : objectValue(req.body.configuration, "configuration");
    const defaultValue = req.body?.defaultValue === void 0 ? {
      name: requiredText(req.body?.name, "name", 200),
      title: optionalText(req.body?.title, 500),
      subtitle: optionalText(req.body?.subtitle, 1e3),
      assetKey: req.body?.assetKey || null,
      configuration
    } : objectValue(req.body.defaultValue, "defaultValue");
    const block = await one(
      db2,
      `insert into public.ui_content_blocks(
         scope, block_key, name, title, subtitle, asset_key,
         configuration, default_value, recommended_width, recommended_height,
         active, sort_order, updated_by_admin_id
       ) values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11,$12,$13)
       returning *`,
      [
        scope,
        blockKey,
        requiredText(req.body?.name, "name", 200),
        optionalText(req.body?.title, 500),
        optionalText(req.body?.subtitle, 1e3),
        req.body?.assetKey ? identifier(req.body.assetKey, "assetKey") : null,
        JSON.stringify(configuration),
        JSON.stringify(defaultValue),
        nullableDimension(req.body?.recommendedWidth, "recommendedWidth"),
        nullableDimension(req.body?.recommendedHeight, "recommendedHeight"),
        booleanValue(req.body?.active, true),
        boundedInteger(req.body?.sortOrder, 0, -1e6, 1e6),
        req.adminPrincipal.adminId
      ]
    );
    await writeAdminAudit(db2, req, {
      action: "content.block.create",
      targetType: "ui_content_block",
      targetId: block.id,
      after: block
    });
    res.status(201).json({ block });
  }));
  router.patch("/content/blocks/:blockId", asyncHandler(async (req, res) => {
    const blockId = String(req.params.blockId || "");
    if (!/^[0-9a-f-]{36}$/i.test(blockId)) throw new ApiError(400, "blockId is invalid", "validation_error");
    const before = await one(db2, `select * from public.ui_content_blocks where id = $1`, [blockId]);
    if (!before) throw new ApiError(404, "Content block was not found", "not_found");
    const reset = booleanValue(req.body?.reset);
    const defaults = before.default_value || {};
    const configuration = reset ? defaults.configuration || {} : req.body?.configuration === void 0 ? before.configuration : objectValue(req.body.configuration, "configuration");
    const block = await one(
      db2,
      `update public.ui_content_blocks
          set name = $2, title = $3, subtitle = $4, asset_key = $5,
              configuration = $6::jsonb, recommended_width = $7,
              recommended_height = $8, active = $9, sort_order = $10,
              updated_by_admin_id = $11, updated_at = now()
        where id = $1 returning *`,
      [
        blockId,
        reset ? String(defaults.name || before.name) : req.body?.name === void 0 ? before.name : requiredText(req.body.name, "name", 200),
        reset ? String(defaults.title || "") : req.body?.title === void 0 ? before.title : optionalText(req.body.title, 500),
        reset ? String(defaults.subtitle || "") : req.body?.subtitle === void 0 ? before.subtitle : optionalText(req.body.subtitle, 1e3),
        reset ? defaults.assetKey || null : req.body?.assetKey === void 0 ? before.asset_key : req.body.assetKey ? identifier(req.body.assetKey, "assetKey") : null,
        JSON.stringify(configuration),
        req.body?.recommendedWidth === void 0 ? before.recommended_width : nullableDimension(req.body.recommendedWidth, "recommendedWidth"),
        req.body?.recommendedHeight === void 0 ? before.recommended_height : nullableDimension(req.body.recommendedHeight, "recommendedHeight"),
        req.body?.active === void 0 ? before.active : booleanValue(req.body.active),
        boundedInteger(req.body?.sortOrder, Number(before.sort_order), -1e6, 1e6),
        req.adminPrincipal.adminId
      ]
    );
    await writeAdminAudit(db2, req, {
      action: reset ? "content.block.reset" : "content.block.update",
      targetType: "ui_content_block",
      targetId: blockId,
      reason: optionalText(req.body?.reason, 1e3),
      before,
      after: block
    });
    res.json({ block });
  }));
  router.patch("/content/navigation/:itemId", asyncHandler(async (req, res) => {
    const itemId = String(req.params.itemId || "");
    if (!/^[0-9a-f-]{36}$/i.test(itemId)) throw new ApiError(400, "itemId is invalid", "validation_error");
    const before = await one(db2, `select * from public.ui_navigation_items where id = $1`, [itemId]);
    if (!before) throw new ApiError(404, "Navigation item was not found", "not_found");
    const reset = booleanValue(req.body?.reset);
    const item = await one(
      db2,
      `update public.ui_navigation_items
          set app_type = $2, label = $3, route = $4, icon_url = $5,
              recommended_width = $6, recommended_height = $7,
              active = $8, sort_order = $9, updated_by_admin_id = $10,
              updated_at = now()
        where id = $1 returning *`,
      [
        itemId,
        req.body?.appType === void 0 ? before.app_type : enumValue(req.body.appType, "appType", APP_TYPES),
        reset ? before.default_label : req.body?.label === void 0 ? before.label : requiredText(req.body.label, "label", 120),
        reset ? before.default_route : req.body?.route === void 0 ? before.route : requiredText(req.body.route, "route", 200),
        reset ? before.default_icon_url : req.body?.iconUrl === void 0 ? before.icon_url : optionalText(req.body.iconUrl, 4e3),
        boundedInteger(req.body?.recommendedWidth, Number(before.recommended_width), 1, 1e4),
        boundedInteger(req.body?.recommendedHeight, Number(before.recommended_height), 1, 1e4),
        req.body?.active === void 0 ? before.active : booleanValue(req.body.active),
        boundedInteger(req.body?.sortOrder, Number(before.sort_order), -1e6, 1e6),
        req.adminPrincipal.adminId
      ]
    );
    await writeAdminAudit(db2, req, {
      action: reset ? "content.navigation.reset" : "content.navigation.update",
      targetType: "ui_navigation_item",
      targetId: itemId,
      reason: optionalText(req.body?.reason, 1e3),
      before,
      after: item
    });
    res.json({ item });
  }));
  router.get("/campaigns", asyncHandler(async (_req, res) => {
    const campaigns = await many(
      db2,
      `select campaign.*, creator.email as creator_email, confirmer.email as confirmer_email
         from public.crm_campaigns campaign
         left join public.admin_users creator on creator.id = campaign.created_by_admin_id
         left join public.admin_users confirmer on confirmer.id = campaign.confirmed_by_admin_id
        order by campaign.created_at desc limit 500`
    );
    res.json({ campaigns });
  }));
  router.post("/campaigns", asyncHandler(async (req, res) => {
    const segment = campaignSegment(req.body?.segment);
    const key = requiredText(req.body?.idempotencyKey, "idempotencyKey", 160);
    const existing = await one(db2, `select * from public.crm_campaigns where idempotency_key = $1`, [key]);
    if (existing) return res.json({ campaign: existing, replayed: true });
    const candidates = await campaignCandidates(db2, segment);
    const campaign = await one(
      db2,
      `insert into public.crm_campaigns(
         name, segment, message_text, recipient_count, status,
         idempotency_key, created_by_admin_id
       ) values ($1,$2::jsonb,$3,$4,'previewed',$5,$6)
       returning *`,
      [
        requiredText(req.body?.name, "name", 200),
        JSON.stringify(segment),
        requiredText(req.body?.messageText, "messageText", 4e3),
        candidates.length,
        key,
        req.adminPrincipal.adminId
      ]
    );
    await writeAdminAudit(db2, req, {
      action: "campaign.preview",
      targetType: "crm_campaign",
      targetId: campaign.id,
      after: { campaign, sample: candidates.slice(0, 20) }
    });
    res.status(201).json({ campaign, sample: candidates.slice(0, 20), replayed: false });
  }));
  router.post("/campaigns/:campaignId/confirm", asyncHandler(async (req, res) => {
    const campaignId = String(req.params.campaignId || "");
    if (!/^[0-9a-f-]{36}$/i.test(campaignId)) throw new ApiError(400, "campaignId is invalid", "validation_error");
    const reason = requiredText(req.body?.reason, "reason", 1e3);
    const result = await transaction(db2, async (client) => {
      const campaign = await one(
        client,
        `select * from public.crm_campaigns where id = $1 for update`,
        [campaignId]
      );
      if (!campaign) throw new ApiError(404, "Campaign was not found", "not_found");
      if (campaign.status === "sending" || campaign.status === "completed") {
        return { campaign, queued: Number(campaign.recipient_count), replayed: true };
      }
      if (!["draft", "previewed"].includes(campaign.status)) {
        throw new ApiError(409, "Campaign cannot be confirmed in its current state", "campaign_not_confirmable");
      }
      const segment = campaignSegment(campaign.segment);
      const candidates = await campaignCandidates(client, segment);
      for (const candidate of candidates) {
        const recipient = await one(
          client,
          `insert into public.crm_campaign_recipients(campaign_id, user_key, status)
           values ($1,$2,$3)
           on conflict (campaign_id, user_key) do update set status = excluded.status
           returning *`,
          [
            campaignId,
            candidate.user_key,
            candidate.telegram_enabled ? "queued" : "skipped"
          ]
        );
        if (!candidate.telegram_enabled) {
          await client.query(
            `update public.crm_campaign_recipients
                set skip_reason = 'telegram_disabled', updated_at = now()
              where id = $1`,
            [recipient.id]
          );
          continue;
        }
        const notification = await one(
          client,
          `insert into public.notifications(
             user_key, notification_type, title, body, data, idempotency_key
           ) values ($1,'campaign',$2,$3,$4::jsonb,$5)
           on conflict (idempotency_key) do update set idempotency_key = excluded.idempotency_key
           returning *`,
          [
            candidate.user_key,
            campaign.name,
            campaign.message_text,
            JSON.stringify({ campaignId }),
            `campaign-notification:${campaignId}:${candidate.user_key}`
          ]
        );
        await client.query(
          `insert into public.telegram_delivery_log(
             notification_id, campaign_recipient_id, telegram_user_id,
             deduplication_key
           ) values ($1,$2,$3,$4)
           on conflict (deduplication_key) do nothing`,
          [
            notification.id,
            recipient.id,
            candidate.telegram_user_id,
            `campaign-delivery:${campaignId}:${candidate.user_key}`
          ]
        );
      }
      await client.query(
        `insert into public.outbox_jobs(
           job_type, aggregate_type, aggregate_id, payload, idempotency_key
         ) values ('telegram_campaign','crm_campaign',$1,$2::jsonb,$3)
         on conflict (idempotency_key) do nothing`,
        [
          campaignId,
          JSON.stringify({ campaignId }),
          `campaign-outbox:${campaignId}`
        ]
      );
      const updated = await one(
        client,
        `update public.crm_campaigns
            set status = 'sending', recipient_count = $2,
                confirmed_by_admin_id = $3, confirmed_at = now(),
                started_at = now(), updated_at = now()
          where id = $1 returning *`,
        [campaignId, candidates.length, req.adminPrincipal.adminId]
      );
      return { campaign: updated, queued: candidates.length, replayed: false };
    });
    await writeAdminAudit(db2, req, {
      action: "campaign.confirm",
      targetType: "crm_campaign",
      targetId: campaignId,
      reason,
      after: result
    });
    res.json(result);
  }));
  return router;
}

// server/routes/admin-crm.ts
import { randomUUID as randomUUID5 } from "node:crypto";
import { Router as Router9 } from "express";
var TRUST_STATUSES = ["trusted", "normal", "watch", "restricted"];
var ACCOUNT_STATUSES = ["active", "blocked", "deleted"];
var EVENT_STATUSES = [
  "draft",
  "published",
  "active",
  "completed",
  "archived",
  "cancelled"
];
var MODERATION_STATUSES = ["open", "reviewing", "actioned", "dismissed", "closed"];
var MODERATION_PRIORITIES = ["low", "normal", "high", "critical"];
function dateOnly(value, field) {
  const text = requiredText(value, field, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN((/* @__PURE__ */ new Date(`${text}T00:00:00Z`)).getTime())) {
    throw new ApiError(400, `${field} must use YYYY-MM-DD`, "validation_error");
  }
  return text;
}
function timeOnly(value, field) {
  const text = requiredText(value, field, 8);
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(text)) {
    throw new ApiError(400, `${field} must use HH:MM`, "validation_error");
  }
  return text;
}
async function crmCustomer(db2, userKey) {
  const customer = await one(
    db2,
    `select customer.*, user_row.name, user_row.username, user_row.avatar,
            user_row.account_status, user_row.blocked_at, user_row.last_seen_at,
            account.telegram_user_id,
            profile.status_text, profile.bio, profile.interests,
            profile.discoverable, consent.marketing_opt_in,
            points.balance, points.lifetime_earned, points.lifetime_spent
       from public.crm_customers customer
       join public.app_users user_row on user_row.user_key = customer.user_key
       left join public.telegram_accounts account on account.app_user_key = customer.user_key
       left join public.user_profiles profile on profile.user_key = customer.user_key
       left join public.user_consents consent on consent.user_key = customer.user_key
       left join public.point_accounts points on points.user_key = customer.user_key
      where customer.user_key = $1`,
    [userKey]
  );
  if (!customer) throw new ApiError(404, "CRM customer was not found", "not_found");
  return customer;
}
function createAdminCrmRouter(db2) {
  const router = Router9();
  router.use(requireAdmin);
  router.get("/dashboard", asyncHandler(async (_req, res) => {
    const [
      users,
      upcomingEvents,
      activeBookings,
      todayCheckIns,
      openModeration,
      points,
      campaigns
    ] = await Promise.all([
      one(db2, `select count(*)::integer as value from public.app_users where account_status = 'active'`),
      one(
        db2,
        `select count(*)::integer as value
           from public.event_runtime
          where status in ('published','active') and coalesce(ends_at, starts_at, now()) >= now()`
      ),
      one(
        db2,
        `select count(*)::integer as value
           from public.booking_records
          where status in ('new','pending','confirmed','checked_in')`
      ),
      one(
        db2,
        `select count(*)::integer as value
           from public.event_checkins
          where checked_in_at >= date_trunc('day', now())`
      ),
      one(
        db2,
        `select count(*)::integer as value
           from public.moderation_cases
          where status in ('open','reviewing')`
      ),
      one(
        db2,
        `select coalesce(sum(balance),0)::bigint as balance,
                coalesce(sum(lifetime_earned),0)::bigint as earned,
                coalesce(sum(lifetime_spent),0)::bigint as spent
           from public.point_accounts`
      ),
      one(
        db2,
        `select count(*) filter (where status in ('confirmed','sending'))::integer as active,
                count(*) filter (where status = 'completed')::integer as completed
           from public.crm_campaigns`
      )
    ]);
    res.json({
      metrics: {
        activeUsers: Number(users?.value || 0),
        upcomingEvents: Number(upcomingEvents?.value || 0),
        activeBookings: Number(activeBookings?.value || 0),
        todayCheckIns: Number(todayCheckIns?.value || 0),
        openModeration: Number(openModeration?.value || 0),
        pointsBalance: Number(points?.balance || 0),
        pointsEarned: Number(points?.earned || 0),
        pointsSpent: Number(points?.spent || 0),
        activeCampaigns: Number(campaigns?.active || 0),
        completedCampaigns: Number(campaigns?.completed || 0)
      }
    });
  }));
  router.get("/crm/merge-reviews", asyncHandler(async (req, res) => {
    const status = enumValue(
      req.query.status || "pending",
      "status",
      ["pending", "linked", "ignored"]
    );
    const reviews = await many(
      db2,
      `select review.*, candidate.name as candidate_name,
              candidate.username as candidate_username
         from public.data_merge_review review
         left join public.app_users candidate
           on candidate.user_key = review.candidate_user_key
        where review.status = $1
        order by review.created_at`,
      [status]
    );
    res.json({ reviews });
  }));
  router.patch("/crm/merge-reviews/:reviewId", asyncHandler(async (req, res) => {
    const reviewId = uuid(req.params.reviewId, "reviewId");
    const status = enumValue(req.body?.status, "status", ["linked", "ignored"]);
    const reason = requiredText(req.body?.reason, "reason", 1e3);
    const result = await transaction(db2, async (client) => {
      const before = await one(
        client,
        `select * from public.data_merge_review where id = $1 for update`,
        [reviewId]
      );
      if (!before) throw new ApiError(404, "Merge review was not found", "not_found");
      if (before.status !== "pending") {
        throw new ApiError(409, "Merge review has already been resolved", "merge_review_resolved");
      }
      if (before.entity_type !== "telegram_identity" || !before.candidate_user_key) {
        throw new ApiError(409, "This merge type requires a dedicated migration", "merge_type_unsupported");
      }
      const telegramId = requiredText(before.legacy_id, "telegramId", 32);
      if (!/^\d+$/.test(telegramId)) {
        throw new ApiError(409, "Telegram ID in review is invalid", "merge_identity_invalid");
      }
      if (status === "linked") {
        const conflicting = await one(
          client,
          `select * from public.telegram_accounts
            where telegram_user_id = $1 or app_user_key = $2
            for update`,
          [telegramId, before.candidate_user_key]
        );
        if (conflicting && (String(conflicting.telegram_user_id) !== telegramId || conflicting.app_user_key !== before.candidate_user_key)) {
          throw new ApiError(409, "Telegram identity is already bound to another account", "identity_binding_conflict");
        }
        const telegram = before.payload?.signedTelegramUser || {};
        await client.query(
          `insert into public.telegram_accounts(
             app_user_key, telegram_user_id, username, first_name, last_name,
             language_code, photo_url, is_premium, first_verified_at, last_verified_at
           ) values ($1,$2,$3,$4,$5,$6,$7,$8,now(),now())
           on conflict (telegram_user_id) do update
             set username = excluded.username,
                 first_name = excluded.first_name,
                 last_name = excluded.last_name,
                 language_code = excluded.language_code,
                 photo_url = excluded.photo_url,
                 is_premium = excluded.is_premium,
                 last_verified_at = now(),
                 updated_at = now()`,
          [
            before.candidate_user_key,
            telegramId,
            String(telegram.username || ""),
            String(telegram.first_name || ""),
            String(telegram.last_name || ""),
            String(telegram.language_code || ""),
            String(telegram.photo_url || ""),
            Boolean(telegram.is_premium)
          ]
        );
      } else {
        await client.query(
          `update public.app_users
              set telegram_id = null, updated_at = now()
            where user_key = $1 and telegram_id = $2`,
          [before.candidate_user_key, telegramId]
        );
      }
      const review = await one(
        client,
        `update public.data_merge_review
            set status = $2, reviewed_by_admin_id = $3,
                reviewed_at = now(),
                payload = payload || $4::jsonb
          where id = $1 returning *`,
        [
          reviewId,
          status,
          req.adminPrincipal.adminId,
          JSON.stringify({ resolutionReason: reason })
        ]
      );
      return { before, review };
    });
    await writeAdminAudit(db2, req, {
      action: `crm.merge_review.${status}`,
      targetType: "data_merge_review",
      targetId: reviewId,
      reason,
      before: result.before,
      after: result.review
    });
    res.json({ review: result.review });
  }));
  router.get("/crm/users", asyncHandler(async (req, res) => {
    const search = String(req.query.search || "").trim().slice(0, 200);
    const trustStatus = req.query.trustStatus ? enumValue(req.query.trustStatus, "trustStatus", TRUST_STATUSES) : "";
    const accountStatus = req.query.accountStatus ? enumValue(req.query.accountStatus, "accountStatus", ACCOUNT_STATUSES) : "";
    const limit = boundedInteger(req.query.limit, 200, 1, 500);
    const users = await many(
      db2,
      `select customer.id as customer_id, customer.user_key, customer.phone,
              customer.first_name, customer.last_name, customer.birth_date,
              customer.trust_status, customer.marketing_opt_in,
              customer.first_seen_at, customer.last_activity_at, customer.app_opens,
              user_row.name, user_row.username, user_row.avatar,
              user_row.account_status, account.telegram_user_id,
              coalesce(points.balance, 0)::bigint as points_balance,
              coalesce(bookings.booking_count, 0)::integer as booking_count,
              bookings.last_booking_at,
              vip.ends_at as vip_ends_at,
              personal_clan.name as personal_clan_name,
              corporate_clan.name as corporate_clan_name
         from public.crm_customers customer
         join public.app_users user_row on user_row.user_key = customer.user_key
         left join public.telegram_accounts account on account.app_user_key = customer.user_key
         left join public.point_accounts points on points.user_key = customer.user_key
         left join (
           select user_key, count(*) as booking_count, max(created_at) as last_booking_at
             from public.booking_records group by user_key
         ) bookings on bookings.user_key = customer.user_key
         left join lateral (
           select ends_at from public.user_vip_subscriptions
            where user_key = customer.user_key and status = 'active' and ends_at > now()
            order by ends_at desc limit 1
         ) vip on true
         left join lateral (
           select clan.name
             from public.clan_memberships membership
             join public.clans clan on clan.id = membership.clan_id
            where membership.user_key = customer.user_key
              and membership.status = 'active' and clan.clan_type = 'user'
            limit 1
         ) personal_clan on true
         left join lateral (
           select clan.name
             from public.clan_memberships membership
             join public.clans clan on clan.id = membership.clan_id
            where membership.user_key = customer.user_key
              and membership.status = 'active' and clan.clan_type = 'corporate'
            limit 1
         ) corporate_clan on true
        where ($1 = '' or lower(user_row.name) like '%' || lower($1) || '%'
          or lower(user_row.username) like '%' || lower($1) || '%'
          or lower(customer.phone) like '%' || lower($1) || '%'
          or account.telegram_user_id::text = $1)
          and ($2 = '' or customer.trust_status = $2)
          and ($3 = '' or user_row.account_status = $3)
        order by customer.last_activity_at desc, customer.user_key
        limit $4`,
      [search, trustStatus, accountStatus, limit]
    );
    res.json({ users });
  }));
  router.get("/crm/users/:userKey", asyncHandler(async (req, res) => {
    const userKey = identifier(req.params.userKey, "userKey");
    const customer = await crmCustomer(db2, userKey);
    const [
      tags,
      notes,
      bookings,
      points,
      rewards,
      gifts,
      vip,
      orders,
      clans,
      checkIns
    ] = await Promise.all([
      many(
        db2,
        `select tag.* from public.crm_tags tag
          join public.crm_customer_tags link on link.tag_id = tag.id
         where link.customer_id = $1 order by tag.name`,
        [customer.id]
      ),
      many(
        db2,
        `select note.*, admin.email as admin_email
           from public.crm_notes note
           left join public.admin_users admin on admin.id = note.created_by_admin_id
          where note.customer_id = $1 order by note.created_at desc limit 200`,
        [customer.id]
      ),
      many(
        db2,
        `select booking.*, event.title as event_title, table_row.table_number
           from public.booking_records booking
           join public.events event on event.id = booking.event_id
           join public.layout_tables table_row on table_row.id = booking.table_id
          where booking.user_key = $1 order by booking.created_at desc`,
        [userKey]
      ),
      many(db2, `select * from public.point_ledger where user_key = $1 order by created_at desc limit 300`, [userKey]),
      many(
        db2,
        `select grant_row.*, reward.name, reward.icon_url
           from public.user_rewards grant_row
           join public.reward_definitions reward on reward.id = grant_row.reward_id
          where grant_row.user_key = $1 order by grant_row.granted_at desc`,
        [userKey]
      ),
      many(
        db2,
        `select gift.*, catalog.name, catalog.image_url
           from public.gifts gift
           join public.gift_catalog catalog on catalog.id = gift.catalog_item_id
          where gift.recipient_user_key = $1 or gift.sender_user_key = $1
          order by gift.created_at desc`,
        [userKey]
      ),
      many(
        db2,
        `select subscription.*, plan.name
           from public.user_vip_subscriptions subscription
           join public.vip_plans plan on plan.id = subscription.plan_id
          where subscription.user_key = $1 order by subscription.ends_at desc`,
        [userKey]
      ),
      many(
        db2,
        `select shop_order.* from public.shop_orders shop_order
          where shop_order.user_key = $1 order by shop_order.created_at desc`,
        [userKey]
      ),
      many(
        db2,
        `select clan.id, clan.name, clan.clan_type, membership.role, membership.status
           from public.clan_memberships membership
           join public.clans clan on clan.id = membership.clan_id
          where membership.user_key = $1 order by membership.joined_at desc`,
        [userKey]
      ),
      many(
        db2,
        `select checkin.*, event.title as event_title
           from public.event_checkins checkin
           join public.events event on event.id = checkin.event_id
          where checkin.user_key = $1 order by checkin.checked_in_at desc`,
        [userKey]
      )
    ]);
    res.json({
      customer,
      tags,
      notes,
      bookings,
      pointLedger: points,
      rewards,
      gifts,
      vip,
      orders,
      clans,
      checkIns
    });
  }));
  router.patch("/crm/users/:userKey", asyncHandler(async (req, res) => {
    const userKey = identifier(req.params.userKey, "userKey");
    const before = await crmCustomer(db2, userKey);
    const trustStatus = req.body?.trustStatus === void 0 ? before.trust_status : enumValue(req.body.trustStatus, "trustStatus", TRUST_STATUSES);
    const accountStatus = req.body?.accountStatus === void 0 ? before.account_status : enumValue(req.body.accountStatus, "accountStatus", ACCOUNT_STATUSES);
    const reason = requiredText(req.body?.reason, "reason", 1e3);
    const after = await transaction(db2, async (client) => {
      await client.query(
        `update public.crm_customers
            set trust_status = $2,
                marketing_opt_in = $3,
                phone = $4,
                updated_at = now()
          where user_key = $1`,
        [
          userKey,
          trustStatus,
          req.body?.marketingOptIn === void 0 ? before.marketing_opt_in : booleanValue(req.body.marketingOptIn),
          req.body?.phone === void 0 ? before.phone : optionalText(req.body.phone, 40)
        ]
      );
      await client.query(
        `update public.app_users
            set account_status = $2,
                blocked_at = case when $2 = 'blocked' then coalesce(blocked_at, now()) else null end,
                updated_at = now()
          where user_key = $1`,
        [userKey, accountStatus]
      );
      if (accountStatus !== "active") {
        await client.query(
          `update public.user_sessions set revoked_at = coalesce(revoked_at, now())
            where app_user_key = $1`,
          [userKey]
        );
      }
      return crmCustomer(client, userKey);
    });
    await writeAdminAudit(db2, req, {
      action: "crm.customer.update",
      targetType: "crm_customer",
      targetId: userKey,
      reason,
      before,
      after
    });
    res.json({ customer: after });
  }));
  router.post("/crm/users/:userKey/notes", asyncHandler(async (req, res) => {
    const userKey = identifier(req.params.userKey, "userKey");
    const customer = await crmCustomer(db2, userKey);
    const note = await one(
      db2,
      `insert into public.crm_notes(customer_id, body, created_by_admin_id)
       values ($1,$2,$3) returning *`,
      [customer.id, requiredText(req.body?.body, "body", 4e3), req.adminPrincipal.adminId]
    );
    await writeAdminAudit(db2, req, {
      action: "crm.note.create",
      targetType: "crm_note",
      targetId: String(note.id),
      after: note
    });
    res.status(201).json({ note });
  }));
  router.post("/crm/tags", asyncHandler(async (req, res) => {
    const name = requiredText(req.body?.name, "name", 100);
    const color = requiredText(req.body?.color || "#c8ff3d", "color", 20);
    if (!/^#[0-9a-f]{6}$/i.test(color)) {
      throw new ApiError(400, "color must be a six-digit hex value", "validation_error");
    }
    const tag = await one(
      db2,
      `insert into public.crm_tags(name, color, created_by_admin_id)
       values ($1,$2,$3)
       on conflict (name) do update set color = excluded.color
       returning *`,
      [name, color, req.adminPrincipal.adminId]
    );
    await writeAdminAudit(db2, req, {
      action: "crm.tag.upsert",
      targetType: "crm_tag",
      targetId: String(tag.id),
      after: tag
    });
    res.status(201).json({ tag });
  }));
  router.post("/crm/users/:userKey/tags/:tagId", asyncHandler(async (req, res) => {
    const userKey = identifier(req.params.userKey, "userKey");
    const tagId = uuid(req.params.tagId, "tagId");
    const customer = await crmCustomer(db2, userKey);
    await db2.query(
      `insert into public.crm_customer_tags(customer_id, tag_id, assigned_by_admin_id)
       values ($1,$2,$3) on conflict do nothing`,
      [customer.id, tagId, req.adminPrincipal.adminId]
    );
    await writeAdminAudit(db2, req, {
      action: "crm.tag.assign",
      targetType: "crm_customer",
      targetId: userKey,
      after: { tagId }
    });
    res.status(204).end();
  }));
  router.delete("/crm/users/:userKey/tags/:tagId", asyncHandler(async (req, res) => {
    const userKey = identifier(req.params.userKey, "userKey");
    const tagId = uuid(req.params.tagId, "tagId");
    const customer = await crmCustomer(db2, userKey);
    await db2.query(
      `delete from public.crm_customer_tags where customer_id = $1 and tag_id = $2`,
      [customer.id, tagId]
    );
    await writeAdminAudit(db2, req, {
      action: "crm.tag.remove",
      targetType: "crm_customer",
      targetId: userKey,
      before: { tagId }
    });
    res.status(204).end();
  }));
  router.get("/events", asyncHandler(async (_req, res) => {
    const events = await many(
      db2,
      `select event.*, runtime.status, runtime.starts_at, runtime.ends_at,
              runtime.age_limit, runtime.dj, runtime.artists, runtime.metadata,
              assignment.layout_id, layout.name as layout_name,
              coalesce(attendance.going_count,0)::integer as going_count,
              coalesce(bookings.booking_count,0)::integer as booking_count,
              coalesce(checkins.checkin_count,0)::integer as checkin_count
         from public.events event
         left join public.event_runtime runtime on runtime.event_id = event.id
         left join public.event_layout_assignments assignment on assignment.event_id = event.id
         left join public.hall_layouts layout on layout.id = assignment.layout_id
         left join (
           select event_id, count(*) filter (where status = 'going') as going_count
             from public.event_attendance group by event_id
         ) attendance on attendance.event_id = event.id
         left join (
           select event_id, count(*) as booking_count from public.booking_records
            where status not in ('cancelled','expired') group by event_id
         ) bookings on bookings.event_id = event.id
         left join (
           select event_id, count(*) as checkin_count from public.event_checkins group by event_id
         ) checkins on checkins.event_id = event.id
        order by coalesce(runtime.starts_at, event.event_date::timestamptz) desc`
    );
    res.json({ events });
  }));
  router.post("/events", asyncHandler(async (req, res) => {
    const eventId = req.body?.id ? identifier(req.body.id, "id") : `event-${randomUUID5()}`;
    const eventDate = dateOnly(req.body?.eventDate, "eventDate");
    const eventTime = timeOnly(req.body?.eventTime || "23:00", "eventTime");
    const status = enumValue(req.body?.status || "draft", "status", EVENT_STATUSES);
    const startsAt = isoDateOrNull(req.body?.startsAt) || (/* @__PURE__ */ new Date(`${eventDate}T${eventTime}`)).toISOString();
    const endsAt = isoDateOrNull(req.body?.endsAt);
    const created = await transaction(db2, async (client) => {
      const event = await one(
        client,
        `insert into public.events(
           id, title, event_date, event_time, description,
           image_url, active, sort_order
         ) values ($1,$2,$3,$4,$5,$6,$7,$8)
         returning *`,
        [
          eventId,
          requiredText(req.body?.title, "title", 200),
          eventDate,
          eventTime,
          optionalText(req.body?.description, 6e3),
          optionalText(req.body?.imageUrl, 4e3),
          !["draft", "archived", "cancelled"].includes(status),
          boundedInteger(req.body?.sortOrder, 0, -1e6, 1e6)
        ]
      );
      const runtime = await one(
        client,
        `insert into public.event_runtime(
           event_id, status, starts_at, ends_at, age_limit, dj,
           artists, metadata, published_at
         ) values (
           $1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,
           case when $2 in ('published','active') then now() else null end
         ) returning *`,
        [
          eventId,
          status,
          startsAt,
          endsAt,
          boundedInteger(req.body?.ageLimit, 18, 18, 99),
          optionalText(req.body?.dj, 300),
          JSON.stringify(Array.isArray(req.body?.artists) ? req.body.artists.slice(0, 100) : []),
          JSON.stringify(req.body?.metadata && typeof req.body.metadata === "object" ? req.body.metadata : {})
        ]
      );
      return { event, runtime };
    });
    await writeAdminAudit(db2, req, {
      action: "event.create",
      targetType: "event",
      targetId: eventId,
      after: created
    });
    res.status(201).json(created);
  }));
  router.patch("/events/:eventId", asyncHandler(async (req, res) => {
    const eventId = identifier(req.params.eventId, "eventId");
    const before = await one(
      db2,
      `select event.*, runtime.status, runtime.starts_at, runtime.ends_at,
              runtime.age_limit, runtime.dj, runtime.artists, runtime.metadata
         from public.events event
         left join public.event_runtime runtime on runtime.event_id = event.id
        where event.id = $1`,
      [eventId]
    );
    if (!before) throw new ApiError(404, "Event was not found", "not_found");
    const status = req.body?.status === void 0 ? before.status : enumValue(req.body.status, "status", EVENT_STATUSES);
    const updated = await transaction(db2, async (client) => {
      const event = await one(
        client,
        `update public.events
            set title = $2, event_date = $3, event_time = $4,
                description = $5, image_url = $6, active = $7, sort_order = $8
          where id = $1 returning *`,
        [
          eventId,
          req.body?.title === void 0 ? before.title : requiredText(req.body.title, "title", 200),
          req.body?.eventDate === void 0 ? before.event_date : dateOnly(req.body.eventDate, "eventDate"),
          req.body?.eventTime === void 0 ? before.event_time : timeOnly(req.body.eventTime, "eventTime"),
          req.body?.description === void 0 ? before.description : optionalText(req.body.description, 6e3),
          req.body?.imageUrl === void 0 ? before.image_url : optionalText(req.body.imageUrl, 4e3),
          !["draft", "archived", "cancelled"].includes(status),
          boundedInteger(req.body?.sortOrder, Number(before.sort_order || 0), -1e6, 1e6)
        ]
      );
      const runtime = await one(
        client,
        `update public.event_runtime
            set status = $2, starts_at = $3, ends_at = $4, age_limit = $5,
                dj = $6, artists = $7::jsonb, metadata = $8::jsonb,
                published_at = case
                  when $2 in ('published','active') then coalesce(published_at, now())
                  else published_at end,
                completed_at = case when $2 = 'completed' then coalesce(completed_at, now()) else null end,
                archived_at = case when $2 = 'archived' then coalesce(archived_at, now()) else null end,
                updated_at = now()
          where event_id = $1 returning *`,
        [
          eventId,
          status,
          req.body?.startsAt === void 0 ? before.starts_at : isoDateOrNull(req.body.startsAt),
          req.body?.endsAt === void 0 ? before.ends_at : isoDateOrNull(req.body.endsAt),
          boundedInteger(req.body?.ageLimit, Number(before.age_limit || 18), 18, 99),
          req.body?.dj === void 0 ? before.dj : optionalText(req.body.dj, 300),
          JSON.stringify(req.body?.artists === void 0 ? before.artists : Array.isArray(req.body.artists) ? req.body.artists.slice(0, 100) : []),
          JSON.stringify(req.body?.metadata === void 0 ? before.metadata : req.body.metadata && typeof req.body.metadata === "object" ? req.body.metadata : {})
        ]
      );
      return { event, runtime };
    });
    await writeAdminAudit(db2, req, {
      action: "event.update",
      targetType: "event",
      targetId: eventId,
      reason: requiredText(req.body?.reason, "reason", 1e3),
      before,
      after: updated
    });
    res.json(updated);
  }));
  router.get("/moderation", asyncHandler(async (req, res) => {
    const status = req.query.status ? enumValue(req.query.status, "status", MODERATION_STATUSES) : "";
    const cases = await many(
      db2,
      `select moderation.*, user_row.name as reported_user_name,
              admin.email as assigned_admin_email
         from public.moderation_cases moderation
         left join public.app_users user_row on user_row.user_key = moderation.reported_user_key
         left join public.admin_users admin on admin.id = moderation.assigned_admin_id
        where ($1 = '' or moderation.status = $1)
        order by case moderation.priority
          when 'critical' then 0 when 'high' then 1 when 'normal' then 2 else 3 end,
          moderation.created_at`,
      [status]
    );
    res.json({ cases });
  }));
  router.patch("/moderation/:caseId", asyncHandler(async (req, res) => {
    const caseId = uuid(req.params.caseId, "caseId");
    const before = await one(db2, `select * from public.moderation_cases where id = $1`, [caseId]);
    if (!before) throw new ApiError(404, "Moderation case was not found", "not_found");
    const status = req.body?.status === void 0 ? before.status : enumValue(req.body.status, "status", MODERATION_STATUSES);
    const priority = req.body?.priority === void 0 ? before.priority : enumValue(req.body.priority, "priority", MODERATION_PRIORITIES);
    const resolution = req.body?.resolution === void 0 ? before.resolution : optionalText(req.body.resolution, 4e3);
    if (["actioned", "dismissed", "closed"].includes(status) && !resolution) {
      throw new ApiError(400, "A resolution is required to close a moderation case", "validation_error");
    }
    const after = await one(
      db2,
      `update public.moderation_cases
          set status = $2, priority = $3, resolution = $4,
              assigned_admin_id = $5,
              closed_at = case when $2 in ('actioned','dismissed','closed') then now() else null end,
              updated_at = now()
        where id = $1 returning *`,
      [caseId, status, priority, resolution, req.adminPrincipal.adminId]
    );
    await writeAdminAudit(db2, req, {
      action: "moderation.case.update",
      targetType: "moderation_case",
      targetId: caseId,
      reason: optionalText(req.body?.reason, 1e3),
      before,
      after
    });
    res.json({ case: after });
  }));
  router.get("/platform-audit", asyncHandler(async (req, res) => {
    const limit = boundedInteger(req.query.limit, 500, 1, 2e3);
    const action = String(req.query.action || "").trim().slice(0, 200);
    const audit = await many(
      db2,
      `select * from public.admin_audit_log
        where ($1 = '' or action = $1)
        order by created_at desc limit $2`,
      [action, limit]
    );
    res.json({ audit });
  }));
  return router;
}

// server/routes/admin-operations.ts
import { Router as Router10 } from "express";
function idempotencyKey(req) {
  return requiredText(
    String(req.get("idempotency-key") || "").trim() || req.body?.idempotencyKey,
    "idempotencyKey",
    160
  );
}
function createAdminOperationsRouter(db2) {
  const router = Router10();
  router.use(requireAdmin);
  router.get("/check-ins", asyncHandler(async (req, res) => {
    const eventId = String(req.query.eventId || "").trim();
    const rows = await many(
      db2,
      `select checkin.*, user_row.name, user_row.username,
              booking.booking_reference, event.title as event_title
         from public.event_checkins checkin
         join public.app_users user_row on user_row.user_key = checkin.user_key
         join public.events event on event.id = checkin.event_id
         left join public.booking_records booking on booking.id = checkin.booking_id
        where ($1 = '' or checkin.event_id = $1)
        order by checkin.checked_in_at desc
        limit 500`,
      [eventId]
    );
    res.json({ checkIns: rows });
  }));
  router.post("/check-ins", asyncHandler(async (req, res) => {
    const token = requiredText(req.body?.token, "token", 1e3);
    const key = idempotencyKey(req);
    const reason = optionalText(req.body?.reason, 1e3);
    let result;
    try {
      result = await transaction(db2, async (client) => {
        const replay = await one(
          client,
          `select checkin.* from public.event_checkins checkin
          where checkin.idempotency_key = $1`,
          [key]
        );
        if (replay) return { checkIn: replay, replayed: true, points: null };
        const qr = await one(
          client,
          `select qr.*, booking.event_id, booking.status as booking_status,
                booking.clan_id, booking.booking_reference
           from public.booking_qr_tokens qr
           join public.booking_records booking on booking.id = qr.booking_id
          where qr.token_hash = $1
          for update of qr`,
          [sha256(token)]
        );
        if (!qr) throw new ApiError(404, "QR code was not recognized", "qr_not_found");
        if (qr.revoked_at) throw new ApiError(409, "QR code has been revoked", "qr_revoked");
        if (qr.redeemed_at) throw new ApiError(409, "QR code has already been used", "qr_already_used");
        if (new Date(qr.expires_at).getTime() <= Date.now()) {
          throw new ApiError(409, "QR code has expired", "qr_expired");
        }
        if (!["confirmed", "pending", "new"].includes(qr.booking_status)) {
          throw new ApiError(409, "Booking cannot be checked in", "booking_checkin_unavailable");
        }
        const checkIn = await one(
          client,
          `insert into public.event_checkins(
           event_id, user_key, booking_id, idempotency_key,
           qr_subject_type, qr_subject_id, checked_in_by_admin_id, metadata
         ) values ($1,$2,$3,$4,'booking',$3,$5,$6::jsonb)
         returning *`,
          [
            qr.event_id,
            qr.user_key,
            qr.booking_id,
            key,
            req.adminPrincipal.adminId,
            JSON.stringify({ bookingReference: qr.booking_reference, reason })
          ]
        );
        await client.query(
          `update public.booking_qr_tokens
            set redeemed_at = now(), redeemed_by_admin_id = $2, updated_at = now()
          where id = $1`,
          [qr.id, req.adminPrincipal.adminId]
        );
        await client.query(
          `update public.booking_records
            set status = 'checked_in', checked_in_at = now(), updated_at = now()
          where id = $1`,
          [qr.booking_id]
        );
        await client.query(
          `insert into public.booking_status_history(
           booking_id, previous_status, next_status, actor_type, actor_id,
           reason, after_value
         ) values ($1,$2,'checked_in','checkin',$3,$4,$5::jsonb)`,
          [
            qr.booking_id,
            qr.booking_status,
            req.adminPrincipal.adminId,
            reason,
            JSON.stringify(checkIn)
          ]
        );
        const settings = await one(
          client,
          `select checkin_points, clan_activity_points
           from public.economy_settings where singleton = true`
        );
        const points = Number(settings?.checkin_points || 0) > 0 ? await mutatePoints(client, {
          userKey: qr.user_key,
          amount: Number(settings.checkin_points),
          operationType: "credit",
          sourceType: "event_checkin",
          sourceId: String(checkIn.id),
          reason: "BALI event check-in",
          administratorId: req.adminPrincipal.adminId,
          idempotencyKey: `checkin-points:${qr.event_id}:${qr.user_key}`
        }) : null;
        if (qr.clan_id && Number(settings?.clan_activity_points || 0) > 0) {
          await client.query(
            `insert into public.clan_points_ledger(
             clan_id, user_key, points, source_type, source_id,
             idempotency_key, reason
           ) values ($1,$2,$3,'event_checkin',$4,$5,$6)
           on conflict (idempotency_key) do nothing`,
            [
              qr.clan_id,
              qr.user_key,
              Number(settings.clan_activity_points),
              String(checkIn.id),
              `checkin-clan-points:${qr.event_id}:${qr.user_key}`,
              "BALI event check-in"
            ]
          );
          await client.query(
            `update public.clans
              set rating_points = rating_points + $2, updated_at = now()
            where id = $1
              and exists (
                select 1 from public.clan_points_ledger
                 where idempotency_key = $3 and source_id = $4
              )`,
            [
              qr.clan_id,
              Number(settings.clan_activity_points),
              `checkin-clan-points:${qr.event_id}:${qr.user_key}`,
              String(checkIn.id)
            ]
          );
        }
        await client.query(
          `insert into public.notifications(
           user_key, notification_type, title, body, data, status,
           idempotency_key
         ) values ($1,'event_checkin','Check-in \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D',$2,$3::jsonb,'queued',$4)
         on conflict (idempotency_key) do nothing`,
          [
            qr.user_key,
            points ? `\u041D\u0430\u0447\u0438\u0441\u043B\u0435\u043D\u043E ${settings.checkin_points} BALI Points.` : "\u0414\u043E\u0431\u0440\u043E \u043F\u043E\u0436\u0430\u043B\u043E\u0432\u0430\u0442\u044C \u0432 BALI.",
            JSON.stringify({ eventId: qr.event_id, bookingId: qr.booking_id }),
            `checkin-notification:${qr.event_id}:${qr.user_key}`
          ]
        );
        return { checkIn, replayed: false, points };
      });
    } catch (error) {
      if (error?.code === "23505") {
        const duplicate = await one(
          db2,
          `select checkin.*
             from public.event_checkins checkin
             join public.booking_qr_tokens qr on qr.booking_id = checkin.booking_id
            where qr.token_hash = $1
            limit 1`,
          [sha256(token)]
        );
        if (duplicate) {
          throw new ApiError(409, "This guest has already checked in", "checkin_already_exists");
        }
      }
      throw error;
    }
    await writeAdminAudit(db2, req, {
      action: "booking.checkin",
      targetType: "event_checkin",
      targetId: String(result.checkIn.id),
      reason,
      after: result.checkIn
    });
    res.status(result.replayed ? 200 : 201).json(result);
  }));
  router.post("/redemptions/gifts", asyncHandler(async (req, res) => {
    const token = requiredText(req.body?.token, "token", 1e3);
    const reason = optionalText(req.body?.reason, 1e3);
    const gift = await transaction(db2, async (client) => {
      const before = await one(
        client,
        `select * from public.gifts where qr_token_hash = $1 for update`,
        [sha256(token)]
      );
      if (!before) throw new ApiError(404, "Gift QR was not recognized", "qr_not_found");
      if (before.status === "redeemed") return before;
      if (!["pending", "delivered"].includes(before.status)) {
        throw new ApiError(409, "Gift cannot be redeemed", "gift_redemption_unavailable");
      }
      if (before.expires_at && new Date(before.expires_at).getTime() <= Date.now()) {
        throw new ApiError(409, "Gift has expired", "gift_expired");
      }
      return one(
        client,
        `update public.gifts
            set status = 'redeemed', redeemed_at = now(),
                redeemed_by_admin_id = $2, updated_at = now()
          where id = $1 returning *`,
        [before.id, req.adminPrincipal.adminId]
      );
    });
    await writeAdminAudit(db2, req, {
      action: "gift.redeem",
      targetType: "gift",
      targetId: String(gift.id),
      reason,
      after: gift
    });
    res.json({ gift });
  }));
  router.post("/redemptions/shop", asyncHandler(async (req, res) => {
    const token = requiredText(req.body?.token, "token", 1e3);
    const reason = optionalText(req.body?.reason, 1e3);
    const order = await transaction(db2, async (client) => {
      const before = await one(
        client,
        `select shop_order.*
           from public.shop_orders shop_order
          where shop_order.qr_token_hash = $1
            and exists (
              select 1
                from public.shop_order_items order_item
               where order_item.order_id = shop_order.id
                 and order_item.requires_redemption = true
            )
          for update`,
        [sha256(token)]
      );
      if (!before) throw new ApiError(404, "Shop QR was not recognized", "qr_not_found");
      if (before.status === "redeemed") return before;
      if (!["paid", "fulfilled"].includes(before.status)) {
        throw new ApiError(409, "Order cannot be redeemed", "shop_redemption_unavailable");
      }
      return one(
        client,
        `update public.shop_orders
            set status = 'redeemed', redeemed_at = now(),
                redeemed_by_admin_id = $2, updated_at = now()
          where id = $1 returning *`,
        [before.id, req.adminPrincipal.adminId]
      );
    });
    await writeAdminAudit(db2, req, {
      action: "shop.redeem",
      targetType: "shop_order",
      targetId: String(order.id),
      reason,
      after: order
    });
    res.json({ order });
  }));
  router.post("/redemptions/rewards/:rewardGrantId", asyncHandler(async (req, res) => {
    const rewardGrantId = uuid(req.params.rewardGrantId, "rewardGrantId");
    const reason = optionalText(req.body?.reason, 1e3);
    const reward = await transaction(db2, async (client) => {
      const before = await one(
        client,
        `select * from public.user_rewards where id = $1 for update`,
        [rewardGrantId]
      );
      if (!before) throw new ApiError(404, "Reward was not found", "not_found");
      if (before.status === "redeemed") return before;
      if (before.status !== "active") {
        throw new ApiError(409, "Reward cannot be redeemed", "reward_redemption_unavailable");
      }
      if (before.expires_at && new Date(before.expires_at).getTime() <= Date.now()) {
        throw new ApiError(409, "Reward has expired", "reward_expired");
      }
      return one(
        client,
        `update public.user_rewards
            set status = 'redeemed', redeemed_at = now()
          where id = $1 returning *`,
        [rewardGrantId]
      );
    });
    await writeAdminAudit(db2, req, {
      action: "reward.redeem",
      targetType: "user_reward",
      targetId: rewardGrantId,
      reason,
      after: reward
    });
    res.json({ reward });
  }));
  return router;
}

// server/routes/admin-mobile-access.ts
import { randomBytes as randomBytes2, randomUUID as randomUUID6 } from "node:crypto";
import { Router as Router11 } from "express";
function temporaryPassword() {
  return `Bali-${randomBytes2(7).toString("base64url")}9!`;
}
function telegramUrl(username) {
  return `https://t.me/${String(username || "").replace(/^@+/, "")}`;
}
async function createMobileUser(client, request, passwordHash) {
  const userKey = `mobile:${randomUUID6()}`;
  const displayName = String(request.display_name || "\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C BALI").trim();
  const parts = displayName.split(/\s+/);
  const firstName = parts.shift() || displayName;
  const lastName = parts.join(" ");
  await client.query(
    `insert into public.app_users(
       user_key, name, username, phone, first_seen_at, last_seen_at, opens, account_status, updated_at
     ) values ($1,$2,$3,$4,now(),now(),1,'active',now())`,
    [userKey, displayName, request.telegram_username, request.phone]
  );
  await client.query(
    `insert into public.mobile_credentials(
       app_user_key, phone, telegram_username, password_hash, must_change_password, password_issued_at
     ) values ($1,$2,$3,$4,true,now())`,
    [userKey, request.phone, request.telegram_username, passwordHash]
  );
  await client.query(
    `insert into public.user_profiles(user_key, display_name, avatar_url, phone)
     values ($1,$2,'',$3) on conflict (user_key) do update set display_name = excluded.display_name, phone = excluded.phone`,
    [userKey, displayName, request.phone]
  );
  await client.query(`insert into public.user_consents(user_key) values ($1) on conflict (user_key) do nothing`, [userKey]);
  await client.query(
    `insert into public.crm_customers(user_key, first_name, last_name, last_activity_at, app_opens)
     values ($1,$2,$3,now(),1) on conflict (user_key) do nothing`,
    [userKey, firstName, lastName]
  );
  await client.query(`insert into public.point_accounts(user_key) values ($1) on conflict (user_key) do nothing`, [userKey]);
  await client.query(`insert into public.game_profiles(user_key) values ($1) on conflict (user_key) do nothing`, [userKey]);
  await client.query(`insert into public.notification_preferences(user_key) values ($1) on conflict (user_key) do nothing`, [userKey]);
  const settings = await one(client, `select registration_points as amount from public.economy_settings where singleton = true`);
  const amount = Number(settings?.amount || 0);
  if (amount > 0) {
    const registrationKey = `registration:${userKey}`;
    const account = await one(client, `select balance from public.point_accounts where user_key = $1 for update`, [userKey]);
    const before = Number(account?.balance || 0);
    const after = before + amount;
    await client.query(
      `update public.point_accounts
          set balance = $2, lifetime_earned = lifetime_earned + $3, version = version + 1, updated_at = now()
        where user_key = $1`,
      [userKey, after, amount]
    );
    await client.query(
      `insert into public.point_ledger(
         user_key, amount, balance_before, balance_after, operation_type, source_type, source_id, reason, idempotency_key
       ) values ($1,$2,$3,$4,'credit','registration',$1,'\u041D\u0430\u0447\u0438\u0441\u043B\u0435\u043D\u0438\u0435 \u0437\u0430 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044E',$5)
       on conflict (idempotency_key) do nothing`,
      [userKey, amount, before, after, registrationKey]
    );
  }
  return userKey;
}
function createAdminMobileAccessRouter(db2) {
  const router = Router11();
  router.use(requireAdmin);
  router.get("/mobile-access", asyncHandler(async (req, res) => {
    const status = req.query.status ? enumValue(req.query.status, "status", ["pending", "issued", "completed", "rejected", "cancelled"]) : "pending";
    const rows = await many(
      db2,
      `select r.id, r.request_type, r.phone, r.telegram_username, r.display_name,
              r.app_user_key, r.status, r.requested_at, r.issued_at, r.completed_at, r.note,
              c.must_change_password, c.last_login_at,
              u.name as user_name
         from public.mobile_access_requests r
         left join public.mobile_credentials c on c.app_user_key = r.app_user_key
         left join public.app_users u on u.user_key = r.app_user_key
        where r.status = $1
        order by r.requested_at desc
        limit 250`,
      [status]
    );
    const counts = await one(
      db2,
      `select
         count(*) filter (where status = 'pending')::int as pending,
         count(*) filter (where status = 'issued')::int as issued,
         count(*) filter (where status = 'completed')::int as completed
       from public.mobile_access_requests`
    );
    res.json({ requests: rows, counts: counts || { pending: 0, issued: 0, completed: 0 } });
  }));
  router.post("/mobile-access/:requestId/issue", asyncHandler(async (req, res) => {
    const requestId = uuid(req.params.requestId, "requestId");
    const password = temporaryPassword();
    const passwordHash = await hashPassword(password);
    const result = await transaction(db2, async (client) => {
      const request = await one(
        client,
        `select * from public.mobile_access_requests where id = $1 for update`,
        [requestId]
      );
      if (!request) throw new ApiError(404, "\u0417\u0430\u044F\u0432\u043A\u0430 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430", "mobile_access_request_not_found");
      if (request.status !== "pending") throw new ApiError(409, "\u0417\u0430\u044F\u0432\u043A\u0430 \u0443\u0436\u0435 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u0430\u043D\u0430", "mobile_access_already_processed");
      let userKey = request.app_user_key;
      if (request.request_type === "registration") {
        const duplicate = await one(client, `select app_user_key from public.mobile_credentials where phone = $1`, [request.phone]);
        if (duplicate) throw new ApiError(409, "\u0414\u043B\u044F \u044D\u0442\u043E\u0433\u043E \u0442\u0435\u043B\u0435\u0444\u043E\u043D\u0430 \u0430\u043A\u043A\u0430\u0443\u043D\u0442 \u0443\u0436\u0435 \u0441\u043E\u0437\u0434\u0430\u043D", "mobile_account_exists");
        userKey = await createMobileUser(client, request, passwordHash);
      } else {
        const credential = await one(
          client,
          `select app_user_key from public.mobile_credentials where app_user_key = $1 or phone = $2 limit 1`,
          [userKey, request.phone]
        );
        if (!credential) throw new ApiError(404, "\u041C\u043E\u0431\u0438\u043B\u044C\u043D\u044B\u0439 \u0430\u043A\u043A\u0430\u0443\u043D\u0442 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D", "mobile_account_not_found");
        userKey = credential.app_user_key;
        await client.query(
          `update public.mobile_credentials
              set password_hash = $2,
                  telegram_username = $3,
                  must_change_password = true,
                  password_issued_at = now(),
                  password_changed_at = null,
                  failed_login_count = 0,
                  locked_until = null
            where app_user_key = $1`,
          [userKey, passwordHash, request.telegram_username]
        );
        await client.query(
          `update public.user_sessions set revoked_at = now()
            where app_user_key = $1 and revoked_at is null`,
          [userKey]
        );
      }
      await client.query(
        `update public.mobile_access_requests
            set app_user_key = $2,
                status = 'issued',
                issued_at = now(),
                issued_by_admin_id = $3,
                updated_at = now()
          where id = $1`,
        [requestId, userKey, req.adminPrincipal.adminId]
      );
      return { ...request, app_user_key: userKey };
    });
    res.json({
      requestId,
      requestType: result.request_type,
      phone: result.phone,
      telegramUsername: result.telegram_username,
      telegramUrl: telegramUrl(result.telegram_username),
      temporaryPassword: password,
      mustChangePassword: true,
      message: "\u0412\u0440\u0435\u043C\u0435\u043D\u043D\u044B\u0439 \u043F\u0430\u0440\u043E\u043B\u044C \u0441\u043E\u0437\u0434\u0430\u043D. \u041E\u043D \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u0430\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u0443 \u0442\u043E\u043B\u044C\u043A\u043E \u0432 \u044D\u0442\u043E\u043C \u043E\u0442\u0432\u0435\u0442\u0435."
    });
  }));
  router.post("/mobile-access/:requestId/reject", asyncHandler(async (req, res) => {
    const requestId = uuid(req.params.requestId, "requestId");
    const note = requiredText(req.body?.note || "\u041E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u043E \u0430\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u043E\u043C", "note", 500);
    const updated = await one(
      db2,
      `update public.mobile_access_requests
          set status = 'rejected', note = $2, issued_by_admin_id = $3, updated_at = now()
        where id = $1 and status = 'pending'
        returning id`,
      [requestId, note, req.adminPrincipal.adminId]
    );
    if (!updated) throw new ApiError(409, "\u0417\u0430\u044F\u0432\u043A\u0430 \u0443\u0436\u0435 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u0430\u043D\u0430 \u0438\u043B\u0438 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430", "mobile_access_already_processed");
    res.json({ ok: true });
  }));
  return router;
}

// server/routes/bookings.ts
import { randomUUID as randomUUID7 } from "node:crypto";
import { Router as Router12 } from "express";
import QRCode from "qrcode";
async function expireStaleHolds(db2) {
  await db2.query(
    `update public.booking_holds
        set status = 'expired', updated_at = now()
      where status = 'active' and expires_at <= now()`
  );
}
async function bookingForUser(db2, bookingId, userKey) {
  const booking = await one(
    db2,
    `select booking.*, event.title as event_title, event.event_date, event.event_time,
            layout.name as layout_name, layout_table.table_number, layout_table.name as table_name
       from public.booking_records booking
       join public.events event on event.id = booking.event_id
       join public.hall_layouts layout on layout.id = booking.layout_id
       join public.layout_tables layout_table on layout_table.id = booking.table_id
      where booking.id = $1 and booking.user_key = $2`,
    [bookingId, userKey]
  );
  if (!booking) throw new ApiError(404, "Booking was not found", "not_found");
  return booking;
}
async function activeClanLeadership(db2, userKey, clanId) {
  const membership = await one(
    db2,
    `select membership.*, clan.name as clan_name, clan.clan_type
       from public.clan_memberships membership
       join public.clans clan on clan.id = membership.clan_id
      where membership.user_key = $1
        and membership.clan_id = $2
        and membership.status = 'active'
        and membership.role = 'leader'
        and clan.status = 'active'`,
    [userKey, clanId]
  );
  if (!membership) {
    throw new ApiError(
      403,
      "Only the active clan leader can create a clan booking",
      "clan_leader_required"
    );
  }
  return membership;
}
async function assertTableEligibility(db2, table, userKey, clanId) {
  if (!table.active || table.status === "unavailable") {
    throw new ApiError(409, "Table is unavailable", "table_unavailable");
  }
  if (table.status === "clan_only" || table.table_type === "clan") {
    if (!clanId) {
      throw new ApiError(403, "This table can be booked only by a clan leader", "clan_booking_required");
    }
    await activeClanLeadership(db2, userKey, clanId);
  } else if (clanId) {
    await activeClanLeadership(db2, userKey, clanId);
  }
  if (table.status === "vip_only" || table.table_type === "vip") {
    const vip = await one(
      db2,
      `select subscription.id
         from public.user_vip_subscriptions subscription
        where subscription.user_key = $1
          and subscription.status = 'active'
          and subscription.starts_at <= now()
          and subscription.ends_at > now()
        limit 1`,
      [userKey]
    );
    if (!vip) throw new ApiError(403, "An active VIP status is required for this table", "vip_required");
  }
}
function createBookingsRouter(db2) {
  const router = Router12();
  router.use(requireUser);
  router.get("/my", asyncHandler(async (req, res) => {
    const bookings = await many(
      db2,
      `select booking.*, event.title as event_title, event.event_date, event.event_time,
              runtime.starts_at, runtime.ends_at,
              layout.name as layout_name,
              layout_table.table_number, layout_table.name as table_name
         from public.booking_records booking
         join public.events event on event.id = booking.event_id
         left join public.event_runtime runtime on runtime.event_id = event.id
         join public.hall_layouts layout on layout.id = booking.layout_id
         join public.layout_tables layout_table on layout_table.id = booking.table_id
        where booking.user_key = $1
        order by booking.created_at desc`,
      [req.userPrincipal.userKey]
    );
    res.json({ bookings });
  }));
  router.post("/holds", asyncHandler(async (req, res) => {
    await enforceRateLimit(db2, req, "booking.hold", requestSubject(req));
    const eventId = identifier(req.body?.eventId, "eventId");
    const tableId = identifier(req.body?.tableId, "tableId");
    const clanId = req.body?.clanId ? identifier(req.body.clanId, "clanId") : null;
    await expireStaleHolds(db2);
    const result = await transaction(db2, async (client) => {
      const existing = await one(
        client,
        `select * from public.booking_holds
          where user_key = $1 and status = 'active'
          for update`,
        [req.userPrincipal.userKey]
      );
      if (existing) {
        if (existing.event_id === eventId && existing.table_id === tableId) {
          const refreshed = await one(
            client,
            `update public.booking_holds hold
                set expires_at = now() + make_interval(secs => settings.hold_seconds),
                    updated_at = now()
               from public.booking_settings settings
              where hold.id = $1 and settings.singleton = true
              returning hold.*`,
            [existing.id]
          );
          return { hold: refreshed, refreshed: true };
        }
        throw new ApiError(
          409,
          "Release the current table hold before selecting another table",
          "active_hold_exists",
          { holdId: existing.id, eventId: existing.event_id, tableId: existing.table_id }
        );
      }
      const row = await one(
        client,
        `select layout_table.*, assignment.layout_id as assigned_layout_id
           from public.event_layout_assignments assignment
           join public.hall_layouts layout
             on layout.id = assignment.layout_id and layout.status = 'published'
           join public.layout_tables layout_table
             on layout_table.layout_id = assignment.layout_id
          where assignment.event_id = $1 and layout_table.id = $2
          for update of layout_table`,
        [eventId, tableId]
      );
      if (!row) throw new ApiError(404, "Table is not part of the event's published layout", "table_not_found");
      await assertTableEligibility(client, row, req.userPrincipal.userKey, clanId);
      const occupied = await one(
        client,
        `select id, status
           from public.booking_records
          where event_id = $1 and table_id = $2
            and status in ('held','new','pending','confirmed','checked_in')
          limit 1`,
        [eventId, tableId]
      );
      if (occupied) throw new ApiError(409, "Table is already booked", "table_already_booked");
      const competingHold = await one(
        client,
        `select id, expires_at
           from public.booking_holds
          where event_id = $1 and table_id = $2
            and status = 'active' and expires_at > now()
          limit 1`,
        [eventId, tableId]
      );
      if (competingHold) {
        throw new ApiError(409, "Table is temporarily held by another user", "table_temporarily_held", {
          retryAt: competingHold.expires_at
        });
      }
      const hold = await one(
        client,
        `insert into public.booking_holds(
           event_id, layout_id, table_id, user_key, clan_id, session_id, expires_at
         )
         select $1,$2,$3,$4,$5,$6,
                now() + make_interval(secs => settings.hold_seconds)
           from public.booking_settings settings
          where settings.singleton = true
         returning *`,
        [
          eventId,
          row.assigned_layout_id,
          tableId,
          req.userPrincipal.userKey,
          clanId,
          req.userPrincipal.sessionId
        ]
      );
      if (!hold) throw new ApiError(500, "Booking settings are missing", "booking_settings_missing");
      return { hold, refreshed: false };
    });
    res.status(result.refreshed ? 200 : 201).json(result);
  }));
  router.delete("/holds/:holdId", asyncHandler(async (req, res) => {
    const holdId = uuid(req.params.holdId, "holdId");
    const hold = await one(
      db2,
      `update public.booking_holds
          set status = 'released', released_at = now(), updated_at = now()
        where id = $1 and user_key = $2 and status = 'active'
        returning *`,
      [holdId, req.userPrincipal.userKey]
    );
    if (!hold) throw new ApiError(404, "Active table hold was not found", "not_found");
    res.status(204).end();
  }));
  router.post("/", asyncHandler(async (req, res) => {
    const headerKey = String(req.get("idempotency-key") || "").trim();
    const idempotencyKey3 = requiredText(
      headerKey || req.body?.idempotencyKey,
      "idempotencyKey",
      160
    );
    const holdId = uuid(req.body?.holdId, "holdId");
    const customerName = requiredText(req.body?.customerName, "customerName", 160);
    const phone = requiredText(req.body?.phone, "phone", 40);
    const guests = boundedInteger(req.body?.guests, 1, 1, 100);
    const comment = optionalText(req.body?.comment, 2e3);
    const consentAccepted = booleanValue(req.body?.consentAccepted);
    if (!consentAccepted) {
      throw new ApiError(400, "Booking consent must be accepted", "booking_consent_required");
    }
    const existing = await one(
      db2,
      `select * from public.booking_records
        where idempotency_key = $1 and user_key = $2`,
      [idempotencyKey3, req.userPrincipal.userKey]
    );
    if (existing) return res.json({ booking: existing, replayed: true });
    try {
      const booking = await transaction(db2, async (client) => {
        await expireStaleHolds(client);
        const hold = await one(
          client,
          `select hold.*, layout_table.capacity, layout_table.minimum_deposit,
                  layout_table.status as table_status, layout_table.table_type,
                  assignment.layout_id as current_layout_id,
                  settings.auto_confirm
             from public.booking_holds hold
             join public.layout_tables layout_table on layout_table.id = hold.table_id
             join public.event_layout_assignments assignment on assignment.event_id = hold.event_id
             join public.booking_settings settings on settings.singleton = true
            where hold.id = $1 and hold.user_key = $2
            for update of hold`,
          [holdId, req.userPrincipal.userKey]
        );
        if (!hold) throw new ApiError(404, "Table hold was not found", "not_found");
        if (hold.status !== "active" || new Date(hold.expires_at).getTime() <= Date.now()) {
          throw new ApiError(409, "Table hold has expired", "hold_expired");
        }
        if (hold.layout_id !== hold.current_layout_id) {
          throw new ApiError(409, "Event layout changed; select a table again", "event_layout_changed");
        }
        if (guests > Number(hold.capacity)) {
          throw new ApiError(
            400,
            `This table supports no more than ${hold.capacity} guests`,
            "table_capacity_exceeded"
          );
        }
        await assertTableEligibility(
          client,
          hold,
          req.userPrincipal.userKey,
          hold.clan_id || null
        );
        const customer = await one(
          client,
          `insert into public.crm_customers(
             user_key, phone, first_name, last_activity_at
           ) values ($1,$2,$3,now())
           on conflict (user_key) do update
             set phone = excluded.phone,
                 first_name = excluded.first_name,
                 last_activity_at = now(),
                 updated_at = now()
           returning *`,
          [req.userPrincipal.userKey, phone, customerName]
        );
        const bookingId = `booking-${randomUUID7()}`;
        const reference = `BALI-${randomUUID7().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
        const nextStatus = hold.auto_confirm ? "confirmed" : "pending";
        const created = await one(
          client,
          `insert into public.booking_records(
             id, booking_reference, idempotency_key, event_id, layout_id, table_id,
             hold_id, user_key, crm_customer_id, clan_id, booking_kind,
             customer_name, phone, guests, deposit, comment, status,
             consent_accepted, confirmed_at
           ) values (
             $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
             $12,$13,$14,$15,$16,$17,true,
             case when $17 = 'confirmed' then now() else null end
           )
           returning *`,
          [
            bookingId,
            reference,
            idempotencyKey3,
            hold.event_id,
            hold.layout_id,
            hold.table_id,
            hold.id,
            req.userPrincipal.userKey,
            customer.id,
            hold.clan_id,
            hold.clan_id ? "clan" : "personal",
            customerName,
            phone,
            guests,
            hold.minimum_deposit,
            comment,
            nextStatus
          ]
        );
        await client.query(
          `update public.booking_holds
              set status = 'converted', converted_at = now(), updated_at = now()
            where id = $1`,
          [hold.id]
        );
        await client.query(
          `insert into public.booking_status_history(
             booking_id, previous_status, next_status, actor_type, actor_id, after_value
           ) values ($1,'held',$2,'user',$3,$4::jsonb)`,
          [created.id, nextStatus, req.userPrincipal.userKey, JSON.stringify(created)]
        );
        await client.query(
          `insert into public.notifications(
             user_key, notification_type, title, body, data, idempotency_key
           ) values ($1,'booking_created',$2,$3,$4::jsonb,$5)
           on conflict (idempotency_key) do nothing`,
          [
            req.userPrincipal.userKey,
            "\u0411\u0440\u043E\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 \u0441\u043E\u0437\u0434\u0430\u043D\u043E",
            `\u041D\u043E\u043C\u0435\u0440 \u0431\u0440\u043E\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F: ${created.booking_reference}`,
            JSON.stringify({ bookingId: created.id, eventId: created.event_id }),
            `booking-created:${created.id}`
          ]
        );
        return created;
      });
      res.status(201).json({ booking, replayed: false });
    } catch (error) {
      if (error?.code === "23505") {
        const replay = await one(
          db2,
          `select * from public.booking_records
            where idempotency_key = $1 and user_key = $2`,
          [idempotencyKey3, req.userPrincipal.userKey]
        );
        if (replay) return res.json({ booking: replay, replayed: true });
        throw new ApiError(409, "Table was booked by another request", "table_already_booked");
      }
      throw error;
    }
  }));
  router.get("/:bookingId", asyncHandler(async (req, res) => {
    const bookingId = identifier(req.params.bookingId, "bookingId");
    const booking = await bookingForUser(db2, bookingId, req.userPrincipal.userKey);
    res.json({ booking });
  }));
  router.post("/:bookingId/qr", asyncHandler(async (req, res) => {
    const bookingId = identifier(req.params.bookingId, "bookingId");
    const rawToken = createSessionToken();
    const qr = await transaction(db2, async (client) => {
      const booking = await one(
        client,
        `select * from public.booking_records
          where id = $1 and user_key = $2
          for update`,
        [bookingId, req.userPrincipal.userKey]
      );
      if (!booking) throw new ApiError(404, "Booking was not found", "not_found");
      if (!["confirmed", "pending", "new"].includes(booking.status)) {
        throw new ApiError(409, "A QR code is unavailable for this booking", "booking_qr_unavailable");
      }
      const runtime = await one(
        client,
        `select ends_at from public.event_runtime where event_id = $1`,
        [booking.event_id]
      );
      const fallbackExpiry = new Date(Date.now() + 7 * 864e5).toISOString();
      const eventExpiry = runtime?.ends_at && new Date(runtime.ends_at).getTime() > Date.now() ? new Date(runtime.ends_at).toISOString() : fallbackExpiry;
      return one(
        client,
        `insert into public.booking_qr_tokens(
           booking_id, user_key, token_hash, expires_at
         ) values ($1,$2,$3,$4)
         on conflict (booking_id) do update
           set token_hash = excluded.token_hash,
               expires_at = excluded.expires_at,
               redeemed_at = null,
               redeemed_by_admin_id = null,
               revoked_at = null,
               updated_at = now()
         returning id, booking_id, expires_at, created_at, updated_at`,
        [bookingId, req.userPrincipal.userKey, sha256(rawToken), eventExpiry]
      );
    });
    const qrDataUrl2 = await QRCode.toDataURL(rawToken, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 640,
      color: { dark: "#080a08", light: "#ffffff" }
    });
    res.json({ qr, token: rawToken, qrDataUrl: qrDataUrl2 });
  }));
  router.post("/:bookingId/cancel", asyncHandler(async (req, res) => {
    const bookingId = identifier(req.params.bookingId, "bookingId");
    const reason = optionalText(req.body?.reason, 1e3);
    const booking = await transaction(db2, async (client) => {
      const before = await one(
        client,
        `select * from public.booking_records
          where id = $1 and user_key = $2
          for update`,
        [bookingId, req.userPrincipal.userKey]
      );
      if (!before) throw new ApiError(404, "Booking was not found", "not_found");
      if (!["new", "pending", "confirmed"].includes(before.status)) {
        throw new ApiError(409, "Booking cannot be cancelled in its current state", "booking_not_cancellable");
      }
      const updated = await one(
        client,
        `update public.booking_records
            set status = 'cancelled', cancelled_at = now(),
                cancelled_by = $2, updated_at = now()
          where id = $1
          returning *`,
        [bookingId, req.userPrincipal.userKey]
      );
      await client.query(
        `insert into public.booking_status_history(
           booking_id, previous_status, next_status, actor_type, actor_id,
           reason, before_value, after_value
         ) values ($1,$2,'cancelled','user',$3,$4,$5::jsonb,$6::jsonb)`,
        [
          bookingId,
          before.status,
          req.userPrincipal.userKey,
          reason,
          JSON.stringify(before),
          JSON.stringify(updated)
        ]
      );
      return updated;
    });
    res.json({ booking });
  }));
  return router;
}

// server/routes/catalog.ts
import { Router as Router13 } from "express";
function createCatalogRouter(db2) {
  const router = Router13();
  router.use(requireUser);
  router.get("/", asyncHandler(async (_req, res) => {
    const [menu, venue, reviews] = await Promise.all([
      many(
        db2,
        `select * from public.menu_catalog_items
          where active = true order by sort_order, category, name`
      ),
      one(
        db2,
        `select * from public.venue_content where id = 'venue-main' and active = true`
      ),
      many(
        db2,
        `select review.id, review.rating, review.body, review.created_at,
                user_row.name, user_row.avatar
           from public.venue_reviews review
           join public.app_users user_row on user_row.user_key = review.user_key
          where review.status = 'published'
          order by review.created_at desc limit 100`
      )
    ]);
    res.json({ menu, venue, reviews });
  }));
  router.post("/reviews", asyncHandler(async (req, res) => {
    const rating = boundedInteger(req.body?.rating, 0, 1, 5);
    const body = optionalText(req.body?.body, 2e3);
    if (!body) throw new ApiError(400, "Review text is required", "validation_error");
    const review = await one(
      db2,
      `insert into public.venue_reviews(user_key, rating, body)
       values ($1,$2,$3)
       returning *`,
      [req.userPrincipal.userKey, rating, body]
    );
    res.status(201).json({ review });
  }));
  return router;
}

// server/routes/economy.ts
import { Router as Router14 } from "express";
import QRCode2 from "qrcode";
function idempotencyKey2(req) {
  return requiredText(
    String(req.get("idempotency-key") || "").trim() || req.body?.idempotencyKey,
    "idempotencyKey",
    160
  );
}
async function notify(db2, userKey, type, title, body, data, key) {
  await db2.query(
    `insert into public.notifications(
       user_key, notification_type, title, body, data, idempotency_key
     ) values ($1,$2,$3,$4,$5::jsonb,$6)
     on conflict (idempotency_key) do nothing`,
    [userKey, type, title, body, JSON.stringify(data), key]
  );
}
function qrDataUrl(token) {
  return QRCode2.toDataURL(token, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 640,
    color: { dark: "#080a08", light: "#ffffff" }
  });
}
function createEconomyRouter(db2) {
  const router = Router14();
  router.use(requireUser);
  router.get("/points", asyncHandler(async (req, res) => {
    const [account, ledger] = await Promise.all([
      one(
        db2,
        `select * from public.point_accounts where user_key = $1`,
        [req.userPrincipal.userKey]
      ),
      many(
        db2,
        `select * from public.point_ledger
          where user_key = $1 order by created_at desc limit 100`,
        [req.userPrincipal.userKey]
      )
    ]);
    res.json({ account: account || { balance: 0, lifetime_earned: 0, lifetime_spent: 0 }, ledger });
  }));
  router.get("/rewards", asyncHandler(async (req, res) => {
    const [catalog, mine] = await Promise.all([
      many(
        db2,
        `select * from public.reward_definitions
          where active = true
            and (valid_from is null or valid_from <= now())
            and (valid_until is null or valid_until > now())
          order by rarity, name`
      ),
      many(
        db2,
        `select user_reward.*, reward.name, reward.icon_url, reward.description,
                reward.rarity, reward.points, reward.xp
           from public.user_rewards user_reward
           join public.reward_definitions reward on reward.id = user_reward.reward_id
          where user_reward.user_key = $1
          order by user_reward.granted_at desc`,
        [req.userPrincipal.userKey]
      )
    ]);
    res.json({ catalog, rewards: mine });
  }));
  router.get("/gifts", asyncHandler(async (req, res) => {
    const [catalog, received, sent] = await Promise.all([
      many(
        db2,
        `select * from public.gift_catalog where active = true order by sort_order, name`
      ),
      many(
        db2,
        `select gift.*, catalog.name, catalog.description, catalog.image_url,
                sender.name as sender_name, sender.avatar as sender_avatar
           from public.gifts gift
           join public.gift_catalog catalog on catalog.id = gift.catalog_item_id
           left join public.app_users sender on sender.user_key = gift.sender_user_key
          where gift.recipient_user_key = $1
          order by gift.created_at desc`,
        [req.userPrincipal.userKey]
      ),
      many(
        db2,
        `select gift.*, catalog.name, catalog.image_url,
                recipient.name as recipient_name
           from public.gifts gift
           join public.gift_catalog catalog on catalog.id = gift.catalog_item_id
           join public.app_users recipient on recipient.user_key = gift.recipient_user_key
          where gift.sender_user_key = $1
          order by gift.created_at desc`,
        [req.userPrincipal.userKey]
      )
    ]);
    res.json({ catalog, received, sent });
  }));
  router.post("/gifts", asyncHandler(async (req, res) => {
    await enforceRateLimit(db2, req, "gift.create", requestSubject(req));
    const key = idempotencyKey2(req);
    const catalogItemId = identifier(req.body?.catalogItemId, "catalogItemId");
    const recipientUserKey = identifier(req.body?.recipientUserKey, "recipientUserKey");
    const message = optionalText(req.body?.message, 500);
    const senderUserKey = req.userPrincipal.userKey;
    if (senderUserKey === recipientUserKey) {
      throw new ApiError(400, "A user cannot send a gift to themselves", "validation_error");
    }
    const existing = await one(
      db2,
      `select * from public.gifts
        where idempotency_key = $1 and sender_user_key = $2`,
      [key, senderUserKey]
    );
    if (existing) return res.json({ gift: existing, replayed: true });
    const qrToken = createSessionToken();
    try {
      const gift = await transaction(db2, async (client) => {
        const [catalog, recipient, blocked] = await Promise.all([
          one(
            client,
            `select * from public.gift_catalog where id = $1 and active = true for update`,
            [catalogItemId]
          ),
          one(
            client,
            `select user_row.user_key, user_row.name,
                    coalesce(profile.allow_gifts, true) as allow_gifts
               from public.app_users user_row
               left join public.user_profiles profile on profile.user_key = user_row.user_key
              where user_row.user_key = $1 and user_row.account_status = 'active'`,
            [recipientUserKey]
          ),
          one(
            client,
            `select 1 from public.user_blocks
              where (blocker_user_key = $1 and blocked_user_key = $2)
                 or (blocker_user_key = $2 and blocked_user_key = $1)
              limit 1`,
            [senderUserKey, recipientUserKey]
          )
        ]);
        if (!catalog) throw new ApiError(404, "Gift was not found", "not_found");
        if (!recipient || !recipient.allow_gifts || blocked) {
          throw new ApiError(403, "This user cannot receive gifts from you", "gift_unavailable");
        }
        const points = Number(catalog.points_cost || 0);
        const pointResult = points > 0 ? await mutatePoints(client, {
          userKey: senderUserKey,
          amount: -points,
          operationType: "debit",
          sourceType: "gift",
          sourceId: catalogItemId,
          reason: `\u041F\u043E\u0434\u0430\u0440\u043E\u043A: ${catalog.name}`,
          idempotencyKey: `gift-points:${key}`
        }) : null;
        return one(
          client,
          `insert into public.gifts(
             catalog_item_id, sender_user_key, recipient_user_key, points_cost,
             point_transaction_id, message, status, qr_token_hash, expires_at,
             idempotency_key
           ) values (
             $1,$2,$3,$4,$5,$6,'delivered',$7,
             case when $8::integer is null then null else now() + make_interval(days => $8) end,
             $9
           )
           returning *`,
          [
            catalogItemId,
            senderUserKey,
            recipientUserKey,
            points,
            pointResult?.ledger?.id || null,
            message,
            catalog.gift_type === "physical" ? sha256(qrToken) : null,
            catalog.validity_days,
            key
          ]
        );
      });
      await notify(
        db2,
        recipientUserKey,
        "gift_received",
        "\u041D\u043E\u0432\u044B\u0439 \u043F\u043E\u0434\u0430\u0440\u043E\u043A",
        `${req.userPrincipal.name} \u043E\u0442\u043F\u0440\u0430\u0432\u0438\u043B \u0432\u0430\u043C \u043F\u043E\u0434\u0430\u0440\u043E\u043A.`,
        { giftId: gift.id },
        `gift-received:${gift.id}`
      );
      res.status(201).json({ gift, replayed: false });
    } catch (error) {
      if (error?.code === "23505") {
        const replay = await one(
          db2,
          `select * from public.gifts where idempotency_key = $1 and sender_user_key = $2`,
          [key, senderUserKey]
        );
        if (replay) return res.json({ gift: replay, replayed: true });
      }
      throw error;
    }
  }));
  router.post("/gifts/:giftId/qr", asyncHandler(async (req, res) => {
    const giftId = uuid(req.params.giftId, "giftId");
    const token = createSessionToken();
    const gift = await one(
      db2,
      `update public.gifts gift
          set qr_token_hash = $3, updated_at = now()
         from public.gift_catalog catalog
        where gift.id = $1
          and gift.recipient_user_key = $2
          and gift.catalog_item_id = catalog.id
          and catalog.gift_type = 'physical'
          and gift.status = 'delivered'
          and (gift.expires_at is null or gift.expires_at > now())
        returning gift.id, gift.status, gift.expires_at, catalog.name`,
      [giftId, req.userPrincipal.userKey, sha256(token)]
    );
    if (!gift) throw new ApiError(409, "This gift cannot be redeemed", "gift_redemption_unavailable");
    res.json({ gift, token, qrDataUrl: await qrDataUrl(token) });
  }));
  router.get("/vip", asyncHandler(async (req, res) => {
    const [plans, subscriptions] = await Promise.all([
      many(db2, `select * from public.vip_plans where active = true order by sort_order, points_cost`),
      many(
        db2,
        `select subscription.*, plan.name, plan.benefits, plan.badge_url,
                plan.profile_frame_url, plan.points_multiplier, plan.extra_game_lives
           from public.user_vip_subscriptions subscription
           join public.vip_plans plan on plan.id = subscription.plan_id
          where subscription.user_key = $1
          order by subscription.ends_at desc`,
        [req.userPrincipal.userKey]
      )
    ]);
    res.json({ plans, subscriptions });
  }));
  router.post("/vip/purchase", asyncHandler(async (req, res) => {
    const key = idempotencyKey2(req);
    const planId = identifier(req.body?.planId, "planId");
    const userKey = req.userPrincipal.userKey;
    const existing = await one(
      db2,
      `select * from public.user_vip_subscriptions
        where idempotency_key = $1 and user_key = $2`,
      [key, userKey]
    );
    if (existing) return res.json({ subscription: existing, replayed: true });
    let subscription;
    try {
      subscription = await transaction(db2, async (client) => {
        const plan = await one(
          client,
          `select * from public.vip_plans where id = $1 and active = true for update`,
          [planId]
        );
        if (!plan) throw new ApiError(404, "VIP plan was not found", "not_found");
        const current = await one(
          client,
          `select * from public.user_vip_subscriptions
          where user_key = $1 and status = 'active' and ends_at > now()
          order by ends_at desc limit 1 for update`,
          [userKey]
        );
        const startsAt = current && new Date(current.ends_at).getTime() > Date.now() ? new Date(current.ends_at) : /* @__PURE__ */ new Date();
        const endsAt = new Date(startsAt.getTime() + Number(plan.duration_days) * 864e5);
        const points = Number(plan.points_cost || 0);
        const pointResult = points > 0 ? await mutatePoints(client, {
          userKey,
          amount: -points,
          operationType: "debit",
          sourceType: "vip",
          sourceId: planId,
          reason: `VIP: ${plan.name}`,
          idempotencyKey: `vip-points:${key}`
        }) : null;
        const created = await one(
          client,
          `insert into public.user_vip_subscriptions(
           user_key, plan_id, source_type, point_transaction_id, starts_at,
           ends_at, status, idempotency_key
         ) values ($1,$2,'purchase',$3,$4,$5,$6,$7)
         returning *`,
          [
            userKey,
            planId,
            pointResult?.ledger?.id || null,
            startsAt.toISOString(),
            endsAt.toISOString(),
            startsAt.getTime() > Date.now() ? "scheduled" : "active",
            key
          ]
        );
        await client.query(
          `update public.app_users set vip_expires_at = $2, updated_at = now()
          where user_key = $1`,
          [userKey, endsAt.toISOString()]
        );
        return created;
      });
    } catch (error) {
      if (error?.code === "23505") {
        const replay = await one(
          db2,
          `select * from public.user_vip_subscriptions
            where idempotency_key = $1 and user_key = $2`,
          [key, userKey]
        );
        if (replay) return res.json({ subscription: replay, replayed: true });
      }
      throw error;
    }
    res.status(201).json({ subscription, replayed: false });
  }));
  router.get("/shop", asyncHandler(async (req, res) => {
    const [items, orders] = await Promise.all([
      many(
        db2,
        `select * from public.shop_items
          where status = 'active'
            and (valid_from is null or valid_from <= now())
            and (valid_until is null or valid_until > now())
            and (stock is null or stock > 0)
          order by sort_order, name`
      ),
      many(
        db2,
        `select shop_order.*,
                coalesce(json_agg(order_item order by order_item.created_at)
                  filter (where order_item.id is not null), '[]'::json) as items
           from public.shop_orders shop_order
           left join public.shop_order_items order_item on order_item.order_id = shop_order.id
          where shop_order.user_key = $1
          group by shop_order.id
          order by shop_order.created_at desc`,
        [req.userPrincipal.userKey]
      )
    ]);
    res.json({ items, orders });
  }));
  router.post("/shop/orders", asyncHandler(async (req, res) => {
    const key = idempotencyKey2(req);
    const userKey = req.userPrincipal.userKey;
    const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!rawItems.length || rawItems.length > 20) {
      throw new ApiError(400, "Order must contain 1-20 items", "validation_error");
    }
    const requested = rawItems.map((row) => ({
      itemId: identifier(row?.itemId, "itemId"),
      quantity: boundedInteger(row?.quantity, 1, 1, 100)
    }));
    if (new Set(requested.map((row) => row.itemId)).size !== requested.length) {
      throw new ApiError(400, "Each shop item must occur only once", "validation_error");
    }
    const existing = await one(
      db2,
      `select * from public.shop_orders where idempotency_key = $1 and user_key = $2`,
      [key, userKey]
    );
    if (existing) return res.json({ order: existing, replayed: true });
    const qrToken = createSessionToken();
    let result;
    try {
      result = await transaction(db2, async (client) => {
        const items = [];
        let total = 0;
        for (const requestedItem of requested) {
          const item = await one(
            client,
            `select * from public.shop_items
            where id = $1 and status = 'active'
              and (valid_from is null or valid_from <= now())
              and (valid_until is null or valid_until > now())
            for update`,
            [requestedItem.itemId]
          );
          if (!item) throw new ApiError(404, `Shop item ${requestedItem.itemId} is unavailable`, "shop_item_unavailable");
          if (item.stock !== null && Number(item.stock) < requestedItem.quantity) {
            throw new ApiError(409, `Not enough stock for ${item.name}`, "shop_stock_insufficient");
          }
          if (item.per_user_limit !== null) {
            const purchased = await one(
              client,
              `select coalesce(sum(order_item.quantity), 0)::integer as quantity
               from public.shop_order_items order_item
               join public.shop_orders shop_order on shop_order.id = order_item.order_id
              where shop_order.user_key = $1 and order_item.item_id = $2
                and shop_order.status not in ('cancelled','refunded')`,
              [userKey, item.id]
            );
            if (Number(purchased?.quantity || 0) + requestedItem.quantity > Number(item.per_user_limit)) {
              throw new ApiError(409, `Purchase limit reached for ${item.name}`, "shop_user_limit");
            }
          }
          total += Number(item.points_cost) * requestedItem.quantity;
          items.push({ ...item, quantity: requestedItem.quantity });
        }
        const pointResult = total > 0 ? await mutatePoints(client, {
          userKey,
          amount: -total,
          operationType: "debit",
          sourceType: "shop",
          sourceId: key,
          reason: "\u0417\u0430\u043A\u0430\u0437 BALI Shop",
          idempotencyKey: `shop-points:${key}`
        }) : null;
        const created = await one(
          client,
          `insert into public.shop_orders(
           user_key, total_points, point_transaction_id, status,
           qr_token_hash, idempotency_key
         ) values ($1,$2,$3,'paid',$4,$5)
         returning *`,
          [userKey, total, pointResult?.ledger?.id || null, sha256(qrToken), key]
        );
        for (const item of items) {
          await client.query(
            `insert into public.shop_order_items(
             order_id, item_id, item_name, unit_points, quantity, requires_redemption
           ) values ($1,$2,$3,$4,$5,$6)`,
            [
              created.id,
              item.id,
              item.name,
              item.points_cost,
              item.quantity,
              Boolean(item.requires_redemption)
            ]
          );
          if (item.stock !== null) {
            await client.query(
              `update public.shop_items
                set stock = stock - $2,
                    status = case when stock - $2 <= 0 then 'sold_out' else status end,
                    updated_at = now()
              where id = $1`,
              [item.id, item.quantity]
            );
          }
        }
        return {
          order: created,
          requiresRedemption: items.some((item) => Boolean(item.requires_redemption))
        };
      });
    } catch (error) {
      if (error?.code === "23505") {
        const replay = await one(
          db2,
          `select * from public.shop_orders
            where idempotency_key = $1 and user_key = $2`,
          [key, userKey]
        );
        if (replay) return res.json({ order: replay, replayed: true });
      }
      throw error;
    }
    res.status(201).json({
      order: result.order,
      qrToken: result.requiresRedemption ? qrToken : void 0,
      qrDataUrl: result.requiresRedemption ? await qrDataUrl(qrToken) : void 0,
      replayed: false
    });
  }));
  router.post("/shop/orders/:orderId/qr", asyncHandler(async (req, res) => {
    const orderId = uuid(req.params.orderId, "orderId");
    const token = createSessionToken();
    const order = await one(
      db2,
      `update public.shop_orders shop_order
          set qr_token_hash = $3, updated_at = now()
        where shop_order.id = $1
          and shop_order.user_key = $2
          and shop_order.status = 'paid'
          and exists (
            select 1
              from public.shop_order_items order_item
             where order_item.order_id = shop_order.id
               and order_item.requires_redemption = true
          )
        returning shop_order.id, shop_order.total_points, shop_order.status,
                  shop_order.created_at, shop_order.updated_at`,
      [orderId, req.userPrincipal.userKey, sha256(token)]
    );
    if (!order) throw new ApiError(409, "This order cannot be redeemed", "shop_redemption_unavailable");
    res.json({ order, token, qrDataUrl: await qrDataUrl(token) });
  }));
  return router;
}

// server/routes/events.ts
import { Router as Router15 } from "express";
var ATTENDANCE = ["going", "maybe", "not_going", "cancelled"];
var INVITATION_RESPONSE = ["going", "maybe", "declined"];
function eventIsFuture(row) {
  if (["completed", "archived", "cancelled"].includes(String(row.runtime_status || ""))) return false;
  const fallback = row.event_date ? `${String(row.event_date).slice(0, 10)}T${String(row.event_time || "23:00").slice(0, 5)}:00` : "";
  const startsAt = row.starts_at ? new Date(row.starts_at).getTime() : Number.NaN;
  const timestamp = row.ends_at ? new Date(row.ends_at).getTime() : Number.isNaN(startsAt) ? fallback ? new Date(fallback).getTime() + 12 * 60 * 60 * 1e3 : Number.NaN : startsAt + 12 * 60 * 60 * 1e3;
  return Number.isNaN(timestamp) || timestamp > Date.now();
}
async function eventRecord(db2, eventId) {
  const row = await one(
    db2,
    `select e.*, r.status as runtime_status, r.starts_at, r.ends_at, r.age_limit,
            r.dj, r.artists, r.metadata
       from public.events e
       left join public.event_runtime r on r.event_id = e.id
      where e.id = $1`,
    [eventId]
  );
  if (!row) throw new ApiError(404, "Event was not found", "not_found");
  return row;
}
async function queueNotification(db2, input) {
  await db2.query(
    `insert into public.notifications(
       user_key, notification_type, title, body, data, idempotency_key
     ) values ($1,$2,$3,$4,$5::jsonb,$6)
     on conflict (idempotency_key) do nothing`,
    [
      input.userKey,
      input.type,
      input.title,
      input.body,
      JSON.stringify(input.data || {}),
      input.idempotencyKey
    ]
  );
}
function createEventsRouter(db2) {
  const router = Router15();
  router.use(requireUser);
  router.get("/", asyncHandler(async (req, res) => {
    const rows = await many(
      db2,
      `select e.id, e.title, e.event_date, e.event_time, e.description, e.image_url,
              e.active, e.sort_order,
              coalesce(r.status, case when e.active then 'published' else 'draft' end) as status,
              r.starts_at, r.ends_at, r.age_limit, r.dj, r.artists, r.metadata,
              attendance.status as my_attendance_status,
              coalesce(counts.going_count, 0)::integer as going_count,
              coalesce(counts.maybe_count, 0)::integer as maybe_count,
              coalesce(checkins.checked_in_count, 0)::integer as checked_in_count
         from public.events e
         left join public.event_runtime r on r.event_id = e.id
         left join public.event_attendance attendance
           on attendance.event_id = e.id and attendance.user_key = $1
         left join (
           select event_id,
                  count(*) filter (where status = 'going') as going_count,
                  count(*) filter (where status = 'maybe') as maybe_count
             from public.event_attendance
            group by event_id
         ) counts on counts.event_id = e.id
         left join (
           select event_id, count(*)::integer as checked_in_count
             from public.event_checkins
            group by event_id
         ) checkins on checkins.event_id = e.id
        where e.active = true
          and coalesce(r.status, 'published') in ('published', 'active', 'completed')
        order by coalesce(r.starts_at, e.event_date::timestamptz), e.sort_order, e.title`,
      [req.userPrincipal.userKey]
    );
    res.json({ events: rows });
  }));
  router.get("/invitations/me", asyncHandler(async (req, res) => {
    const rows = await many(
      db2,
      `select invitation.*, sender.name as sender_name, sender.avatar as sender_avatar,
              event.title as event_title, event.event_date, event.event_time,
              runtime.starts_at, runtime.ends_at
         from public.event_invitations invitation
         join public.app_users sender on sender.user_key = invitation.sender_user_key
         join public.events event on event.id = invitation.event_id
         left join public.event_runtime runtime on runtime.event_id = event.id
        where invitation.recipient_user_key = $1
        order by case when invitation.status = 'pending' then 0 else 1 end,
                 invitation.created_at desc`,
      [req.userPrincipal.userKey]
    );
    res.json({ invitations: rows });
  }));
  router.patch("/invitations/:invitationId", asyncHandler(async (req, res) => {
    const invitationId = uuid(req.params.invitationId, "invitationId");
    const status = enumValue(req.body?.status, "status", INVITATION_RESPONSE);
    const result = await transaction(db2, async (client) => {
      const invitation = await one(
        client,
        `select invitation.*, event.title as event_title
           from public.event_invitations invitation
           join public.events event on event.id = invitation.event_id
          where invitation.id = $1 and invitation.recipient_user_key = $2
          for update`,
        [invitationId, req.userPrincipal.userKey]
      );
      if (!invitation) throw new ApiError(404, "Invitation was not found", "not_found");
      if (invitation.status !== "pending") {
        throw new ApiError(409, "Invitation has already been answered", "invitation_already_answered");
      }
      const updated = await one(
        client,
        `update public.event_invitations
            set status = $2, responded_at = now(), updated_at = now()
          where id = $1
          returning *`,
        [invitationId, status]
      );
      if (status === "going" || status === "maybe") {
        await client.query(
          `insert into public.event_attendance(
             event_id, user_key, status, source_type, source_id
           ) values ($1,$2,$3,'invitation',$4)
           on conflict (event_id, user_key) do update
             set status = excluded.status,
                 source_type = excluded.source_type,
                 source_id = excluded.source_id,
                 responded_at = now(),
                 updated_at = now()`,
          [invitation.event_id, req.userPrincipal.userKey, status, invitationId]
        );
      }
      await queueNotification(client, {
        userKey: invitation.sender_user_key,
        type: "event_invitation_response",
        title: "\u041E\u0442\u0432\u0435\u0442 \u043D\u0430 \u043F\u0440\u0438\u0433\u043B\u0430\u0448\u0435\u043D\u0438\u0435",
        body: `${req.userPrincipal.name} \u043E\u0442\u0432\u0435\u0442\u0438\u043B \u043D\u0430 \u043F\u0440\u0438\u0433\u043B\u0430\u0448\u0435\u043D\u0438\u0435: ${status === "going" ? "\u0418\u0434\u0443" : status === "maybe" ? "\u0412\u043E\u0437\u043C\u043E\u0436\u043D\u043E" : "\u041E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u043E"}.`,
        data: { invitationId, eventId: invitation.event_id, status },
        idempotencyKey: `event-invitation-response:${invitationId}`
      });
      return updated;
    });
    res.json({ invitation: result });
  }));
  router.get("/:eventId/layout", asyncHandler(async (req, res) => {
    const eventId = identifier(req.params.eventId, "eventId");
    await eventRecord(db2, eventId);
    const assignment = await one(
      db2,
      `select assignment.*, layout.status as layout_status
         from public.event_layout_assignments assignment
         join public.hall_layouts layout on layout.id = assignment.layout_id
        where assignment.event_id = $1`,
      [eventId]
    );
    if (!assignment) throw new ApiError(404, "Event layout was not assigned", "event_layout_not_found");
    const bundle = await publishedLayoutBundle(db2, assignment.layout_id, true);
    const availability = await many(
      db2,
      `select layout_table.id,
              case
                when booking.id is not null then
                  case when booking.status in ('new','pending') then 'pending' else 'booked' end
                when hold.id is not null and hold.user_key = $2 then 'selected'
                when hold.id is not null then 'held'
                when layout_table.status = 'unavailable' then 'unavailable'
                when layout_table.status = 'vip_only' then 'vip'
                when layout_table.status = 'clan_only' then 'clan'
                else 'available'
              end as availability_status,
              hold.expires_at as hold_expires_at,
              case when hold.user_key = $2 then hold.id else null end as my_hold_id
         from public.layout_tables layout_table
         left join public.booking_records booking
           on booking.event_id = $1
          and booking.table_id = layout_table.id
          and booking.status in ('held','new','pending','confirmed','checked_in')
         left join public.booking_holds hold
           on hold.event_id = $1
          and hold.table_id = layout_table.id
          and hold.status = 'active'
          and hold.expires_at > now()
        where layout_table.layout_id = $3 and layout_table.active = true`,
      [eventId, req.userPrincipal.userKey, assignment.layout_id]
    );
    const availabilityById = new Map(availability.map((row) => [row.id, row]));
    res.json({
      eventId,
      assignment,
      layout: bundle.layout,
      elements: bundle.elements,
      tables: bundle.tables.map((table) => ({
        ...table,
        ...availabilityById.get(table.id) || { availability_status: "available" }
      }))
    });
  }));
  router.get("/:eventId", asyncHandler(async (req, res) => {
    const eventId = identifier(req.params.eventId, "eventId");
    const event = await eventRecord(db2, eventId);
    const [attendance, clans, checkins] = await Promise.all([
      many(
        db2,
        `select attendance.status, attendance.updated_at,
                user_row.user_key, user_row.name, user_row.avatar,
                profile.status_text
           from public.event_attendance attendance
           join public.app_users user_row on user_row.user_key = attendance.user_key
           left join public.user_profiles profile on profile.user_key = user_row.user_key
          where attendance.event_id = $1
            and attendance.status in ('going', 'maybe')
            and coalesce(profile.discoverable, true) = true
          order by attendance.updated_at desc`,
        [eventId]
      ),
      many(
        db2,
        `select distinct clan.id, clan.name, clan.clan_type,
                count(clan_attendance.user_key)::integer as participant_count
           from public.clan_event_attendance clan_attendance
           join public.clans clan on clan.id = clan_attendance.clan_id
          where clan_attendance.event_id = $1
            and clan_attendance.status in ('going', 'maybe')
          group by clan.id, clan.name, clan.clan_type
          order by participant_count desc, clan.name`,
        [eventId]
      ),
      many(
        db2,
        `select checkin.checked_in_at,
                user_row.user_key, user_row.name, user_row.avatar,
                profile.status_text
           from public.event_checkins checkin
           join public.app_users user_row on user_row.user_key = checkin.user_key
           left join public.user_profiles profile on profile.user_key = user_row.user_key
          where checkin.event_id = $1
            and coalesce(profile.discoverable, true) = true
          order by checkin.checked_in_at desc`,
        [eventId]
      )
    ]);
    res.json({ event, participants: attendance, checkedIn: checkins, clans });
  }));
  router.put("/:eventId/attendance", asyncHandler(async (req, res) => {
    const eventId = identifier(req.params.eventId, "eventId");
    const status = enumValue(req.body?.status, "status", ATTENDANCE);
    const event = await eventRecord(db2, eventId);
    if (!eventIsFuture(event) && status !== "cancelled") {
      throw new ApiError(409, "Attendance can be changed only for an active future event", "event_not_active");
    }
    const attendance = await one(
      db2,
      `insert into public.event_attendance(event_id, user_key, status, source_type)
       values ($1,$2,$3,'self')
       on conflict (event_id, user_key) do update
         set status = excluded.status,
             source_type = 'self',
             responded_at = now(),
             updated_at = now()
       returning *`,
      [eventId, req.userPrincipal.userKey, status]
    );
    res.json({ attendance });
  }));
  router.post("/:eventId/invitations", asyncHandler(async (req, res) => {
    await enforceRateLimit(db2, req, "event_invitation.create", requestSubject(req));
    const eventId = identifier(req.params.eventId, "eventId");
    const recipientUserKey = identifier(req.body?.recipientUserKey, "recipientUserKey");
    const message = optionalText(req.body?.message, 500);
    if (recipientUserKey === req.userPrincipal.userKey) {
      throw new ApiError(400, "A user cannot invite themselves", "validation_error");
    }
    const event = await eventRecord(db2, eventId);
    if (!eventIsFuture(event)) {
      throw new ApiError(409, "Only active future events can be invited to", "event_not_active");
    }
    const recipient = await one(
      db2,
      `select user_row.user_key, user_row.name,
              coalesce(profile.allow_event_invites, true) as allow_event_invites,
              exists(
                select 1 from public.user_blocks block
                 where (block.blocker_user_key = $1 and block.blocked_user_key = user_row.user_key)
                    or (block.blocker_user_key = user_row.user_key and block.blocked_user_key = $1)
              ) as blocked
         from public.app_users user_row
         left join public.user_profiles profile on profile.user_key = user_row.user_key
        where user_row.user_key = $2 and user_row.account_status = 'active'`,
      [req.userPrincipal.userKey, recipientUserKey]
    );
    if (!recipient) throw new ApiError(404, "Recipient was not found", "not_found");
    if (recipient.blocked) throw new ApiError(403, "Invitation is unavailable because one of the users blocked the other", "user_blocked");
    if (!recipient.allow_event_invites) throw new ApiError(403, "Recipient disabled event invitations", "event_invitations_disabled");
    try {
      const invitation = await transaction(db2, async (client) => {
        const created = await one(
          client,
          `insert into public.event_invitations(
             event_id, sender_user_key, recipient_user_key, message
           ) values ($1,$2,$3,$4)
           returning *`,
          [eventId, req.userPrincipal.userKey, recipientUserKey, message]
        );
        await queueNotification(client, {
          userKey: recipientUserKey,
          type: "event_invitation",
          title: "\u041F\u0440\u0438\u0433\u043B\u0430\u0448\u0435\u043D\u0438\u0435 \u043D\u0430 \u043C\u0435\u0440\u043E\u043F\u0440\u0438\u044F\u0442\u0438\u0435",
          body: `${req.userPrincipal.name} \u043F\u0440\u0438\u0433\u043B\u0430\u0448\u0430\u0435\u0442 \u0432\u0430\u0441 \u043D\u0430 \xAB${event.title}\xBB.`,
          data: { invitationId: created.id, eventId },
          idempotencyKey: `event-invitation:${created.id}`
        });
        return created;
      });
      res.status(201).json({ invitation });
    } catch (error) {
      if (error?.code === "23505") {
        throw new ApiError(409, "An unanswered invitation already exists", "invitation_already_pending");
      }
      throw error;
    }
  }));
  router.post("/:eventId/archive-invitations", asyncHandler(async (req, res) => {
    const eventId = identifier(req.params.eventId, "eventId");
    await eventRecord(db2, eventId);
    const result = await db2.query(
      `update public.event_invitations
          set status = 'archived', archived_at = now(), updated_at = now()
        where event_id = $1
          and (sender_user_key = $2 or recipient_user_key = $2)
          and status <> 'archived'`,
      [eventId, req.userPrincipal.userKey]
    );
    res.json({ archived: result.rowCount || 0 });
  }));
  return router;
}

// server/routes/game.ts
import { Router as Router16 } from "express";

// server/match3-engine.ts
import { createHash as createHash2 } from "node:crypto";
var DEFAULT_LEVEL = {
  rows: 6,
  columns: 6,
  minTileTypes: 5,
  maxTileTypes: 8,
  baseMoves: 25,
  minMoves: 12,
  baseTargetScore: 1e4,
  sqrtDifficulty: 0.06,
  linearDifficulty: 4e-3,
  maxGoals: 3,
  checkpointEvery: 10,
  milestoneEvery: 25,
  specialStartLevel: 4,
  obstacleStartLevel: 8,
  blockedChanceMax: 0.12,
  obstacleChanceMax: 0.28
};
var DEFAULT_SCORING = {
  baseTile: 100,
  combo3: 1,
  combo4: 1.25,
  combo5: 1.6,
  combo6: 2,
  comboTL: 1.75,
  cascadeStep: 0.35,
  maxCascade: 3,
  lineCreate: 250,
  bombCreate: 400,
  rainbowCreate: 650,
  lineActivate: 350,
  bombActivate: 550,
  rainbowActivate: 900,
  obstacleLayer: 150,
  goalComplete: 1e3,
  allGoalsBase: 2500,
  remainingMove: 200,
  cleanMultiplier: 0.1,
  star2: 1.2,
  star3: 1.5
};
var DEFAULT_RATING = {
  base: 1e3,
  levelLog: 0.1,
  star1: 1,
  star2: 1.15,
  star3: 1.35,
  continue0: 1,
  continue1: 0.85,
  continue2: 0.65
};
function object(value) {
  return value && !Array.isArray(value) && typeof value === "object" ? value : {};
}
function integer(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, Math.round(parsed))) : fallback;
}
function numeric(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : fallback;
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).filter(([, item]) => item !== void 0).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, canonical(item)])
    );
  }
  return value;
}
function hashValue(value) {
  return createHash2("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}
function seedNumber(value) {
  return Number.parseInt(hashValue(value).slice(0, 8), 16) >>> 0;
}
function seededRandom(seed) {
  let state = seedNumber(seed) || 1;
  return () => {
    state += 1831565813;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}
function match3Difficulty(level, rawRules = {}) {
  const rules = { ...DEFAULT_LEVEL, ...object(rawRules) };
  const normalized = Math.max(1, Math.floor(level));
  return 1 + numeric(rules.sqrtDifficulty, DEFAULT_LEVEL.sqrtDifficulty, 0, 10) * Math.sqrt(normalized - 1) + numeric(rules.linearDifficulty, DEFAULT_LEVEL.linearDifficulty, 0, 10) * (normalized - 1);
}
function levelGoals(level, difficulty, targetScore, rules) {
  const count = Math.min(integer(rules.maxGoals, 3, 1, 5), 1 + Math.floor(level / 12));
  const cycle = level % 7;
  const goals = [{ type: "score", target: targetScore }];
  if (count > 1) {
    if (cycle === 0 || cycle === 3) {
      goals.push({ type: "collect", tileIndex: level % 5, target: Math.round(12 + difficulty * 5) });
    } else if (level >= integer(rules.obstacleStartLevel, 8, 1, 1e6)) {
      goals.push({ type: "obstacles", target: Math.round(4 + difficulty * 2) });
    } else {
      goals.push({ type: "createSpecial", special: "line", target: Math.max(1, Math.round(difficulty)) });
    }
  }
  if (count > 2) {
    goals.push(level % 2 ? { type: "activateSpecial", special: "any", target: Math.max(1, Math.round(difficulty)) } : { type: "collect", tileIndex: (level + 2) % 5, target: Math.round(10 + difficulty * 4) });
  }
  return goals;
}
function generateMatch3Level(level, settings, seasonId) {
  const raw = { ...DEFAULT_LEVEL, ...object(settings.level_rules ?? settings.levelRules) };
  const scoring = { ...DEFAULT_SCORING, ...object(settings.scoring_rules ?? settings.scoringRules) };
  const rating = { ...DEFAULT_RATING, ...object(settings.rating_rules ?? settings.ratingRules) };
  const normalized = Math.max(1, Math.floor(level));
  const difficulty = match3Difficulty(normalized, raw);
  const rows = integer(raw.rows, 6, 5, 10);
  const columns = integer(raw.columns, 6, 5, 10);
  const minimumTiles = integer(raw.minTileTypes, 5, 5, 8);
  const maximumTiles = integer(raw.maxTileTypes, 8, minimumTiles, 8);
  const tileTypes = Math.min(maximumTiles, minimumTiles + Math.floor((normalized - 1) / 18));
  const targetScore = Math.max(500, Math.round(
    numeric(raw.baseTargetScore, 1e4, 500, 1e9) * difficulty / 100
  ) * 100);
  const moves = Math.max(
    integer(raw.minMoves, 12, 5, 99),
    integer(raw.baseMoves, 25, 5, 99) - Math.floor(Math.log2(normalized + 1))
  );
  const obstacleProgress = Math.max(0, normalized - integer(raw.obstacleStartLevel, 8, 1, 1e6));
  const checkpointEvery = integer(raw.checkpointEvery, 10, 1, 1e4);
  const milestoneEvery = integer(raw.milestoneEvery, 25, 1, 1e4);
  return {
    level: normalized,
    seed: `${seasonId}:${normalized}`,
    difficulty: Number(difficulty.toFixed(5)),
    rows,
    columns,
    tileTypes,
    moves,
    targetScore,
    goals: levelGoals(normalized, difficulty, targetScore, raw),
    checkpoint: normalized % checkpointEvery === 0,
    multistage: normalized % milestoneEvery === 0,
    obstacleChance: normalized < integer(raw.obstacleStartLevel, 8, 1, 1e6) ? 0 : Math.min(numeric(raw.obstacleChanceMax, 0.28, 0, 0.8), 0.04 + obstacleProgress * 6e-3),
    blockedChance: normalized < milestoneEvery ? 0 : Math.min(numeric(raw.blockedChanceMax, 0.12, 0, 0.5), 0.02 + normalized * 5e-4),
    scoring,
    rating
  };
}
function tileValue(cell) {
  return cell && !cell.blocked ? cell.tile : "";
}
function matches(board, rows, columns) {
  const groups = [];
  for (let row = 0; row < rows; row += 1) {
    let start = 0;
    for (let column = 1; column <= columns; column += 1) {
      const first = tileValue(board[row * columns + start]);
      const current = column < columns ? tileValue(board[row * columns + column]) : "";
      if (!first || current !== first) {
        if (first && column - start >= 3) groups.push(
          Array.from({ length: column - start }, (_, offset) => row * columns + start + offset)
        );
        start = column;
      }
    }
  }
  for (let column = 0; column < columns; column += 1) {
    let start = 0;
    for (let row = 1; row <= rows; row += 1) {
      const first = tileValue(board[start * columns + column]);
      const current = row < rows ? tileValue(board[row * columns + column]) : "";
      if (!first || current !== first) {
        if (first && row - start >= 3) groups.push(
          Array.from({ length: row - start }, (_, offset) => (start + offset) * columns + column)
        );
        start = row;
      }
    }
  }
  return groups;
}
function adjacent(first, second, columns) {
  const firstRow = Math.floor(first / columns);
  const secondRow = Math.floor(second / columns);
  return Math.abs(firstRow - secondRow) + Math.abs(first % columns - second % columns) === 1;
}
function swap(board, first, second) {
  [board[first], board[second]] = [board[second], board[first]];
}
function hintPair(board, rows, columns) {
  for (let index = 0; index < board.length; index += 1) {
    for (const other of [index + 1, index + columns]) {
      if (other >= board.length || !adjacent(index, other, columns)) continue;
      if (board[index]?.blocked || board[other]?.blocked) continue;
      swap(board, index, other);
      const valid = matches(board, rows, columns).length > 0;
      swap(board, index, other);
      if (valid) return [index, other];
    }
  }
  return null;
}
function hasHint(board, rows, columns) {
  return Boolean(hintPair(board, rows, columns));
}
function createMatch3Board(level, tileIds) {
  const available = tileIds.slice(0, level.tileTypes);
  if (available.length < 5) throw new Error("At least five active Match-3 symbols are required");
  for (let boardAttempt = 0; boardAttempt < 80; boardAttempt += 1) {
    const random = seededRandom(`${level.seed}:board:${boardAttempt}`);
    const board = [];
    for (let index = 0; index < level.rows * level.columns; index += 1) {
      const row = Math.floor(index / level.columns);
      const column = index % level.columns;
      const blockedTiles = /* @__PURE__ */ new Set();
      if (column >= 2 && board[index - 1]?.tile === board[index - 2]?.tile) blockedTiles.add(board[index - 1].tile);
      if (row >= 2 && board[index - level.columns]?.tile === board[index - level.columns * 2]?.tile) {
        blockedTiles.add(board[index - level.columns].tile);
      }
      const choices = available.filter((tile) => !blockedTiles.has(tile));
      const blocked = level.blockedChance > 0 && random() < level.blockedChance;
      const obstacle = !blocked && level.obstacleChance > 0 && random() < level.obstacleChance ? random() < 0.2 ? 2 : 1 : 0;
      board.push({
        tile: choices[Math.floor(random() * choices.length)] || available[0],
        special: "",
        obstacle,
        blocked
      });
    }
    if (hasHint(board, level.rows, level.columns)) return board;
  }
  throw new Error("Unable to generate a playable Match-3 board");
}
function collapse(board, cleared, level, tileIds, moveNumber, cascade) {
  const random = seededRandom(`${level.seed}:move:${moveNumber}:cascade:${cascade}:${hashValue(board)}`);
  const next = board.map((cell) => ({ ...cell }));
  for (let column = 0; column < level.columns; column += 1) {
    const kept = [];
    for (let row = level.rows - 1; row >= 0; row -= 1) {
      const index = row * level.columns + column;
      if (next[index]?.blocked) continue;
      if (!cleared.has(index)) kept.push(next[index]);
    }
    let cursor = 0;
    for (let row = level.rows - 1; row >= 0; row -= 1) {
      const index = row * level.columns + column;
      if (next[index]?.blocked) continue;
      next[index] = kept[cursor++] || {
        tile: tileIds[Math.floor(random() * Math.min(tileIds.length, level.tileTypes))],
        special: "",
        obstacle: 0,
        blocked: false
      };
    }
  }
  return next;
}
function specialCells(board, index, pairedIndex, rows, columns) {
  const cell = board[index];
  if (!cell?.special) return [];
  const row = Math.floor(index / columns);
  const column = index % columns;
  if (cell.special === "line-h") return Array.from({ length: columns }, (_, offset) => row * columns + offset);
  if (cell.special === "line-v") return Array.from({ length: rows }, (_, offset) => offset * columns + column);
  if (cell.special === "bomb") {
    const indices = [];
    for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
      for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
        const targetRow2 = row + rowOffset;
        const targetColumn = column + columnOffset;
        if (targetRow2 >= 0 && targetRow2 < rows && targetColumn >= 0 && targetColumn < columns) {
          indices.push(targetRow2 * columns + targetColumn);
        }
      }
    }
    return indices;
  }
  const pairedTile = board[pairedIndex]?.tile;
  return board.flatMap(
    (item, itemIndex) => !item.blocked && (!pairedTile || item.tile === pairedTile) ? [itemIndex] : []
  );
}
function playMatch3Move(input, first, second, level, tileIds, moveNumber) {
  const board = input.map((cell) => ({ ...cell }));
  if (!Number.isInteger(first) || !Number.isInteger(second) || !adjacent(first, second, level.columns)) {
    return { valid: false, reason: "not_adjacent", board, scoreDelta: 0, progressDelta: {}, breakdown: {}, cascades: 0 };
  }
  if (!board[first] || !board[second] || board[first].blocked || board[second].blocked) {
    return { valid: false, reason: "blocked", board, scoreDelta: 0, progressDelta: {}, breakdown: {}, cascades: 0 };
  }
  swap(board, first, second);
  const firstSpecial = board[first]?.special;
  const secondSpecial = board[second]?.special;
  let forced = /* @__PURE__ */ new Set();
  if (firstSpecial && secondSpecial) {
    if (firstSpecial === "rainbow" || secondSpecial === "rainbow") {
      board.forEach((cell, index) => {
        if (!cell.blocked) forced.add(index);
      });
    } else {
      specialCells(board, first, second, level.rows, level.columns).forEach((index) => forced.add(index));
      specialCells(board, second, first, level.rows, level.columns).forEach((index) => forced.add(index));
    }
  } else if (firstSpecial || secondSpecial) {
    const specialIndex = firstSpecial ? first : second;
    const pairedIndex = firstSpecial ? second : first;
    specialCells(board, specialIndex, pairedIndex, level.rows, level.columns).forEach((index) => forced.add(index));
  }
  if (!forced.size && !matches(board, level.rows, level.columns).length) {
    swap(board, first, second);
    return { valid: false, reason: "no_match", board, scoreDelta: 0, progressDelta: {}, breakdown: {}, cascades: 0 };
  }
  let current = board;
  let scoreDelta = 0;
  let obstaclesDestroyed = 0;
  const collected = {};
  const specialsCreated = { line: 0, bomb: 0, rainbow: 0 };
  const specialsActivated = { line: 0, bomb: 0, rainbow: 0, any: 0 };
  const breakdown = { combinations: 0, cascades: 0, specials: 0, obstacles: 0 };
  let cascadeCount = 0;
  for (let cascade = 1; cascade <= 12; cascade += 1) {
    const groups = matches(current, level.rows, level.columns);
    if (!groups.length && !forced.size) break;
    cascadeCount = cascade;
    const cleared = new Set(forced.size ? forced : groups.flat());
    const activationQueue = [...cleared];
    const activated = /* @__PURE__ */ new Set();
    while (activationQueue.length) {
      const index = activationQueue.shift();
      const special = current[index]?.special;
      if (!special || activated.has(index)) continue;
      activated.add(index);
      const pairedIndex = index === first ? second : first;
      for (const extraIndex of specialCells(current, index, pairedIndex, level.rows, level.columns)) {
        if (!cleared.has(extraIndex)) activationQueue.push(extraIndex);
        cleared.add(extraIndex);
      }
      const type = special.startsWith("line") ? "line" : special;
      specialsActivated[type] = Number(specialsActivated[type] || 0) + 1;
      specialsActivated.any += 1;
      const activationBonus = Number(level.scoring[`${type}Activate`] || 0);
      breakdown.specials += activationBonus;
      scoreDelta += activationBonus;
    }
    let created = "";
    const intersections = groups.flatMap(
      (group, groupIndex) => groups.slice(groupIndex + 1).flatMap((other) => group.filter((index) => other.includes(index)))
    );
    const preferred = groups.find((group) => group.includes(second)) || groups[0] || [...cleared];
    if (!forced.size && intersections.length) created = "bomb";
    else if (!forced.size && preferred.length >= 5) created = "rainbow";
    else if (!forced.size && preferred.length === 4) {
      const sameRow = preferred.every((index) => Math.floor(index / level.columns) === Math.floor(preferred[0] / level.columns));
      created = sameRow ? "line-h" : "line-v";
    }
    const anchor = intersections[0] ?? (preferred.includes(second) ? second : preferred[0]);
    if (created) {
      cleared.delete(anchor);
      const createdType = created === "rainbow" ? "rainbow" : created === "bomb" ? "bomb" : "line";
      specialsCreated[createdType] += 1;
      const bonus = Number(level.scoring[`${createdType}Create`] || 0);
      breakdown.specials += bonus;
      scoreDelta += bonus;
    }
    let removed = 0;
    let obstacleBonus = 0;
    for (const index of cleared) {
      const cell = current[index];
      if (!cell || cell.blocked) continue;
      collected[cell.tile] = Number(collected[cell.tile] || 0) + 1;
      if (cell.obstacle > 0) {
        obstaclesDestroyed += 1;
        obstacleBonus += level.scoring.obstacleLayer;
      }
      removed += 1;
    }
    const multiplier = Math.min(level.scoring.maxCascade, 1 + level.scoring.cascadeStep * (cascade - 1));
    const groupCoefficient = groups.length ? Math.max(...groups.map((group) => {
      if (group.length >= 6) return level.scoring.combo6;
      if (group.length === 5) return level.scoring.combo5;
      if (group.length === 4) return level.scoring.combo4;
      return level.scoring.combo3;
    })) : 1;
    const points = Math.round(removed * level.scoring.baseTile * groupCoefficient * multiplier);
    breakdown.obstacles += obstacleBonus;
    scoreDelta += points + obstacleBonus;
    if (cascade === 1) breakdown.combinations += points;
    else breakdown.cascades += points;
    current = collapse(current, cleared, level, tileIds, moveNumber, cascade);
    if (created && current[anchor] && !current[anchor].blocked) current[anchor].special = created;
    forced = /* @__PURE__ */ new Set();
  }
  if (!hasHint(current, level.rows, level.columns)) {
    current = createMatch3Board({ ...level, seed: `${level.seed}:reshuffle:${moveNumber}` }, tileIds);
  }
  return {
    valid: true,
    board: current,
    scoreDelta,
    progressDelta: { collected, obstaclesDestroyed, specialsCreated, specialsActivated },
    breakdown,
    cascades: cascadeCount
  };
}
function applyMatch3Booster(input, type, targetIndex, level, tileIds, useNumber) {
  const board = input.map((cell) => ({ ...cell }));
  if (type === "hint") {
    const hint = hintPair(board, level.rows, level.columns);
    return {
      valid: Boolean(hint),
      reason: hint ? void 0 : "no_hint",
      board,
      scoreDelta: 0,
      progressDelta: {},
      hint: hint || []
    };
  }
  if (type === "shuffle") {
    return {
      valid: true,
      board: createMatch3Board({ ...level, seed: `${level.seed}:booster:shuffle:${useNumber}` }, tileIds),
      scoreDelta: 0,
      progressDelta: {}
    };
  }
  if (!Number.isInteger(targetIndex) || targetIndex === null || targetIndex < 0 || targetIndex >= board.length) {
    return { valid: false, reason: "invalid_target", board, scoreDelta: 0, progressDelta: {} };
  }
  if (board[targetIndex]?.blocked) {
    return { valid: false, reason: "blocked", board, scoreDelta: 0, progressDelta: {} };
  }
  const cleared = /* @__PURE__ */ new Set();
  if (type === "remove") cleared.add(targetIndex);
  if (type === "removeType") {
    const tile = board[targetIndex]?.tile;
    board.forEach((cell, index) => {
      if (!cell.blocked && cell.tile === tile) cleared.add(index);
    });
  }
  if (type === "bomb") {
    const targetRow2 = Math.floor(targetIndex / level.columns);
    const targetColumn = targetIndex % level.columns;
    for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
      for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
        const row = targetRow2 + rowOffset;
        const column = targetColumn + columnOffset;
        if (row >= 0 && row < level.rows && column >= 0 && column < level.columns) {
          const index = row * level.columns + column;
          if (!board[index]?.blocked) cleared.add(index);
        }
      }
    }
  }
  const collected = {};
  let obstaclesDestroyed = 0;
  for (const index of cleared) {
    const cell = board[index];
    if (!cell) continue;
    collected[cell.tile] = Number(collected[cell.tile] || 0) + 1;
    if (cell.obstacle > 0) obstaclesDestroyed += 1;
  }
  const scoreDelta = Math.round(cleared.size * Number(level.scoring.baseTile || 100));
  return {
    valid: true,
    board: collapse(board, cleared, level, tileIds, 1e5 + useNumber, 1),
    scoreDelta,
    progressDelta: { collected, obstaclesDestroyed },
    cleared: cleared.size
  };
}
function initialMatch3Progress() {
  return {
    score: 0,
    collected: {},
    obstaclesDestroyed: 0,
    specialsCreated: { line: 0, bomb: 0, rainbow: 0 },
    specialsActivated: { line: 0, bomb: 0, rainbow: 0, any: 0 }
  };
}
function goalValue(goal, progress, tileIds) {
  if (goal.type === "score") return Number(progress.score || 0);
  if (goal.type === "collect") return Number(progress.collected[tileIds[goal.tileIndex || 0]] || 0);
  if (goal.type === "obstacles") return Number(progress.obstaclesDestroyed || 0);
  if (goal.type === "createSpecial") return Number(progress.specialsCreated[goal.special || "line"] || 0);
  return Number(progress.specialsActivated[goal.special || "any"] || 0);
}
function match3GoalsComplete(level, progress, tileIds) {
  return level.goals.every((goal) => goalValue(goal, progress, tileIds) >= goal.target);
}
function match3Stars(score, target, success, scoring) {
  if (!success) return 0;
  if (score >= target * scoring.star3) return 3;
  if (score >= target * scoring.star2) return 2;
  return 1;
}
function match3SeasonRating(level, stars, continues, rating) {
  if (stars < 1) return 0;
  return Math.round(
    rating.base * (1 + rating.levelLog * Math.log(Math.max(1, level))) * rating[`star${stars}`] * rating[`continue${Math.min(2, continues)}`]
  );
}

// server/routes/game.ts
function requestKey(req) {
  return requiredText(
    String(req.get("idempotency-key") || "").trim() || req.body?.idempotencyKey,
    "idempotencyKey",
    160
  );
}
function gameSymbols(settings) {
  const rows = Array.isArray(settings?.symbols) ? settings.symbols : [];
  return rows.filter((row) => row?.active !== false && row?.key).map((row) => ({
    key: String(row.key),
    label: String(row.label || row.key),
    imageUrl: String(row.imageUrl || row.defaultImageUrl || "")
  }));
}
function mergeNumbers(target, patch) {
  Object.entries(patch || {}).forEach(([key, value]) => {
    target[key] = Number(target[key] || 0) + Number(value || 0);
  });
}
async function ensureCurrentSeason(db2) {
  await finalizeEndedGameSeasons(db2);
  const current = await one(
    db2,
    `select * from public.game_seasons
      where status in ('scheduled','active')
        and starts_at <= now() and ends_at > now()
      order by case status when 'active' then 0 else 1 end, starts_at desc
      limit 1`
  );
  if (current) {
    if (current.status === "scheduled") {
      return one(
        db2,
        `update public.game_seasons set status = 'active', updated_at = now()
          where id = $1 returning *`,
        [current.id]
      );
    }
    return current;
  }
  const settings = await one(
    db2,
    `select ranking_period_days, default_prizes
       from public.game_settings where singleton = true`
  );
  if (!settings) throw new ApiError(500, "Game settings are missing", "game_settings_missing");
  const periodDays = Math.max(1, Number(settings.ranking_period_days || 7));
  const periodMs = periodDays * 864e5;
  const anchor = Date.UTC(1970, 0, 5);
  const startsAt = new Date(anchor + Math.floor((Date.now() - anchor) / periodMs) * periodMs);
  const endsAt = new Date(startsAt.getTime() + periodMs);
  await db2.query(
    `insert into public.game_seasons(name, starts_at, ends_at, status, rewards)
     values ($1,$2,$3,'active',$4::jsonb)
     on conflict do nothing`,
    [
      `BALI Match-3 \xB7 ${startsAt.toISOString().slice(0, 10)}`,
      startsAt.toISOString(),
      endsAt.toISOString(),
      JSON.stringify(Array.isArray(settings.default_prizes) ? settings.default_prizes : [])
    ]
  );
  return one(
    db2,
    `select * from public.game_seasons
      where status = 'active' and starts_at <= now() and ends_at > now()
      order by starts_at desc limit 1`
  );
}
async function ensureCurrentClanRound(db2, season, clanType) {
  const now = /* @__PURE__ */ new Date();
  const weekStart = new Date(now);
  weekStart.setUTCHours(0, 0, 0, 0);
  const day = weekStart.getUTCDay();
  weekStart.setUTCDate(weekStart.getUTCDate() - (day + 6) % 7);
  const startsAt = new Date(Math.max(new Date(season.starts_at).getTime(), weekStart.getTime()));
  const endsAt = new Date(Math.min(new Date(season.ends_at).getTime(), startsAt.getTime() + 7 * 864e5));
  const settings = await one(
    db2,
    `select clan_rules from public.game_settings where singleton = true`
  );
  const round = await one(
    db2,
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
    await db2.query(
      `insert into public.game_clan_round_roster(round_id, clan_id, user_key)
       select $1, membership.clan_id, membership.user_key
         from public.clan_memberships membership
         join public.clans clan on clan.id = membership.clan_id
        where membership.status = 'active' and membership.clan_type = $2
          and clan.status = 'active'
       on conflict (round_id, clan_id, user_key) do nothing`,
      [round.id, clanType]
    );
    await db2.query(
      `update public.game_clan_rounds set frozen_at = now(), updated_at = now()
        where id = $1 and frozen_at is null`,
      [round.id]
    );
  }
  await db2.query(
    `insert into public.game_clan_tasks(
       round_id, clan_id, title, metric, target_value, minimum_personal_contribution
     )
     select $1, roster.clan_id, '\u041A\u043E\u043C\u0430\u043D\u0434\u043D\u044B\u0439 \u043C\u0430\u0440\u0430\u0444\u043E\u043D \u0443\u0440\u043E\u0432\u043D\u0435\u0439', 'levels',
            greatest(1, count(*) * 5), $2
       from public.game_clan_round_roster roster
      where roster.round_id = $1
      group by roster.clan_id
     on conflict (round_id, clan_id, metric) do nothing`,
    [
      round.id,
      Math.max(1, Number(settings?.clan_rules?.minimumLevelsForChest || 3))
    ]
  );
  return round;
}
function createGameRouter(db2) {
  const router = Router16();
  router.use(requireUser);
  router.get("/", asyncHandler(async (req, res) => {
    const [settings, initialProfile, season] = await Promise.all([
      one(db2, `select * from public.game_settings where singleton = true`),
      one(
        db2,
        `select * from public.game_profiles where user_key = $1`,
        [req.userPrincipal.userKey]
      ),
      ensureCurrentSeason(db2)
    ]);
    let profile = initialProfile;
    if (settings && profile) {
      const maximum = Math.max(1, Number(settings.lives_rules?.maximum || settings.base_lives || 5));
      const restoreMinutes = Math.max(1, Number(settings.lives_rules?.restoreMinutes || 30));
      const elapsed = profile.last_life_at ? Date.now() - new Date(profile.last_life_at).getTime() : 0;
      const restored = Math.floor(elapsed / (restoreMinutes * 6e4));
      if (restored > 0 && Number(profile.lives || 0) < maximum) {
        profile = await one(
          db2,
          `update public.game_profiles
              set lives = least($2, lives + $3),
                  last_life_at = case
                    when lives + $3 >= $2 then now()
                    else last_life_at + ($4 * $3) * interval '1 minute'
                  end,
                  updated_at = now()
            where user_key = $1 returning *`,
          [req.userPrincipal.userKey, maximum, restored, restoreMinutes]
        );
      }
    }
    res.json({ settings, profile, season });
  }));
  router.get("/leaderboard", asyncHandler(async (req, res) => {
    const seasonId = req.query.seasonId ? uuid(req.query.seasonId, "seasonId") : null;
    const season = seasonId ? await one(db2, `select * from public.game_seasons where id = $1`, [seasonId]) : await ensureCurrentSeason(db2);
    const rows = await many(
      db2,
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
    const me = rows.find((row) => row.user_key === req.userPrincipal.userKey) || null;
    res.json({ season, leaderboard: rows, me });
  }));
  router.post("/sessions", asyncHandler(async (req, res) => {
    await enforceRateLimit(db2, req, "game.session", requestSubject(req));
    const key = requestKey(req);
    const userKey = req.userPrincipal.userKey;
    const existing = await one(
      db2,
      `select * from public.game_sessions where idempotency_key = $1 and user_key = $2`,
      [key, userKey]
    );
    if (existing) return res.json({ session: existing, replayed: true });
    let session;
    try {
      session = await transaction(db2, async (client) => {
        const active = await one(
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
        const profile = await one(
          client,
          `select * from public.game_profiles where user_key = $1 for update`,
          [userKey]
        );
        if (!profile || Number(profile.lives) < 1) {
          throw new ApiError(409, "No game lives are available", "game_lives_empty");
        }
        const [season, settings] = await Promise.all([
          ensureCurrentSeason(client),
          one(client, `select * from public.game_settings where singleton = true`)
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
        const board = createMatch3Board(generated, symbols.map((symbol) => symbol.key));
        const signature = hashValue({ generated, symbols });
        return one(
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
            req.userPrincipal.sessionId,
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
    } catch (error) {
      if (error?.code === "23505") {
        const replay = await one(
          db2,
          `select * from public.game_sessions
            where idempotency_key = $1 and user_key = $2`,
          [key, userKey]
        );
        if (replay) return res.json({ session: replay, replayed: true });
        const active = await one(
          db2,
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
    await enforceRateLimit(db2, req, "game.move", requestSubject(req));
    const sessionId = uuid(req.params.sessionId, "sessionId");
    const key = requestKey(req);
    const first = boundedInteger(req.body?.first, 0, 0, 99);
    const second = boundedInteger(req.body?.second, 0, 0, 99);
    const sequence = boundedInteger(req.body?.sequence, 0, 1, 1e5);
    const result = await transaction(db2, async (client) => {
      const replay = await one(
        client,
        `select * from public.game_moves where idempotency_key = $1 and user_key = $2`,
        [key, req.userPrincipal.userKey]
      );
      if (replay) {
        const session2 = await one(client, `select * from public.game_sessions where id = $1`, [sessionId]);
        return { move: replay, session: session2, replayed: true };
      }
      const session = await one(
        client,
        `select * from public.game_sessions
          where id = $1 and user_key = $2 and status = 'active'
          for update`,
        [sessionId, req.userPrincipal.userKey]
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
      const config2 = session.level_config || {};
      const symbols = Array.isArray(config2.symbols) ? config2.symbols : [];
      const tileIds = symbols.map((symbol) => String(symbol.key));
      const board = Array.isArray(session.board_state) ? session.board_state : [];
      const beforeHash = hashValue(board);
      if (req.body?.boardHash && String(req.body.boardHash) !== beforeHash) {
        throw new ApiError(409, "Client board is stale", "game_board_mismatch", {
          expectedBoardHash: beforeHash
        });
      }
      const moveResult = playMatch3Move(board, first, second, config2, tileIds, sequence);
      if (!moveResult.valid) {
        throw new ApiError(400, "Move does not create a valid combination", "game_move_invalid", {
          reason: moveResult.reason
        });
      }
      const progress = {
        ...initialMatch3Progress(),
        ...session.goal_progress || {}
      };
      progress.score = Number(progress.score || 0) + moveResult.scoreDelta;
      progress.collected = { ...progress.collected || {} };
      progress.specialsCreated = { ...progress.specialsCreated || {} };
      progress.specialsActivated = { ...progress.specialsActivated || {} };
      mergeNumbers(progress.collected, moveResult.progressDelta.collected);
      mergeNumbers(progress.specialsCreated, moveResult.progressDelta.specialsCreated);
      mergeNumbers(progress.specialsActivated, moveResult.progressDelta.specialsActivated);
      progress.obstaclesDestroyed = Number(progress.obstaclesDestroyed || 0) + Number(moveResult.progressDelta.obstaclesDestroyed || 0);
      const breakdown = { ...session.score_breakdown || {} };
      mergeNumbers(breakdown, moveResult.breakdown);
      const boardAfterHash = hashValue(moveResult.board);
      const updated = await one(
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
      const move = await one(
        client,
        `insert into public.game_moves(
           game_session_id, user_key, sequence, first_index, second_index,
           board_before_hash, board_after_hash, score_delta, move_result, idempotency_key
         ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)
         returning *`,
        [
          sessionId,
          req.userPrincipal.userKey,
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
    await enforceRateLimit(db2, req, "game.booster", requestSubject(req));
    const sessionId = uuid(req.params.sessionId, "sessionId");
    const key = requestKey(req);
    const type = String(req.body?.type || "");
    if (!["shuffle", "hint", "bomb", "remove", "removeType"].includes(type)) {
      throw new ApiError(400, "Unsupported game booster", "validation_error");
    }
    const targetIndex = req.body?.index === void 0 || req.body?.index === null ? null : boundedInteger(req.body.index, 0, 0, 99);
    const result = await transaction(db2, async (client) => {
      const replay = await one(
        client,
        `select * from public.game_booster_uses
          where idempotency_key = $1 and user_key = $2`,
        [key, req.userPrincipal.userKey]
      );
      if (replay) {
        const session2 = await one(client, `select * from public.game_sessions where id = $1`, [sessionId]);
        return { use: replay, session: session2, result: replay.result, replayed: true };
      }
      const [session, profile, settings] = await Promise.all([
        one(
          client,
          `select * from public.game_sessions
            where id = $1 and user_key = $2 and status = 'active' for update`,
          [sessionId, req.userPrincipal.userKey]
        ),
        one(
          client,
          `select * from public.game_profiles where user_key = $1 for update`,
          [req.userPrincipal.userKey]
        ),
        one(client, `select * from public.game_settings where singleton = true`)
      ]);
      if (!session || !profile || !settings) {
        throw new ApiError(404, "Active game session was not found", "not_found");
      }
      const config2 = session.level_config || {};
      const symbols = Array.isArray(config2.symbols) ? config2.symbols : [];
      const tileIds = symbols.map((symbol) => String(symbol.key));
      const board = Array.isArray(session.board_state) ? session.board_state : [];
      const useNumber = await one(
        client,
        `select count(*)::integer as count from public.game_booster_uses
          where game_session_id = $1`,
        [sessionId]
      );
      const boosterResult = applyMatch3Booster(
        board,
        type,
        targetIndex,
        config2,
        tileIds,
        Number(useNumber?.count || 0) + 1
      );
      if (!boosterResult.valid) {
        throw new ApiError(409, "Game booster cannot be applied", "game_booster_invalid", {
          reason: boosterResult.reason
        });
      }
      const inventory = { ...profile.booster_inventory || {} };
      const inventoryUsed = Number(inventory[type] || 0) > 0;
      let ballyCost = 0;
      if (inventoryUsed) {
        inventory[type] = Number(inventory[type] || 0) - 1;
        await client.query(
          `update public.game_profiles
              set booster_inventory = $2::jsonb, updated_at = now()
            where user_key = $1`,
          [req.userPrincipal.userKey, JSON.stringify(inventory)]
        );
      } else {
        ballyCost = Number(settings.economy_rules?.boosterCosts?.[type] || 0);
        const paid = await one(
          client,
          `update public.game_profiles
              set bally_balance = bally_balance - $2, updated_at = now()
            where user_key = $1 and bally_balance >= $2
            returning bally_balance`,
          [req.userPrincipal.userKey, ballyCost]
        );
        if (!paid) throw new ApiError(409, "Not enough Bally", "insufficient_bally");
      }
      const progress = { ...initialMatch3Progress(), ...session.goal_progress || {} };
      progress.score = Number(progress.score || 0) + boosterResult.scoreDelta;
      progress.collected = { ...progress.collected || {} };
      mergeNumbers(progress.collected, boosterResult.progressDelta.collected);
      progress.obstaclesDestroyed = Number(progress.obstaclesDestroyed || 0) + Number(boosterResult.progressDelta.obstaclesDestroyed || 0);
      const breakdown = { ...session.score_breakdown || {} };
      breakdown.specials = Number(breakdown.specials || 0) + boosterResult.scoreDelta;
      const updated = await one(
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
      const created = await one(
        client,
        `insert into public.game_booster_uses(
           game_session_id, user_key, booster_type, target_index,
           inventory_used, points_cost, bally_cost, point_transaction_id, result, idempotency_key
         ) values ($1,$2,$3,$4,$5,0,$6,null,$7::jsonb,$8)
         returning *`,
        [
          sessionId,
          req.userPrincipal.userKey,
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
    const result = await transaction(db2, async (client) => {
      const replay = await one(
        client,
        `select * from public.idempotency_records
          where scope = 'game.finish' and idempotency_key = $1`,
        [key]
      );
      if (replay?.response_body) {
        return { session: replay.response_body, replayed: true };
      }
      const session = await one(
        client,
        `select * from public.game_sessions
          where id = $1 and user_key = $2 for update`,
        [sessionId, req.userPrincipal.userKey]
      );
      if (!session) throw new ApiError(404, "Game session was not found", "not_found");
      const replayAfterLock = await one(
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
      const settings = await one(
        client,
        `select * from public.game_settings where singleton = true`
      );
      if (!settings) throw new ApiError(500, "Game settings are missing", "game_settings_missing");
      const elapsed = Math.max(
        1,
        Math.floor((Date.now() - new Date(session.started_at).getTime()) / 1e3)
      );
      const config2 = session.level_config || {};
      const symbols = Array.isArray(config2.symbols) ? config2.symbols : [];
      const tileIds = symbols.map((symbol) => String(symbol.key));
      const signatureValid = hashValue({ generated: {
        ...config2,
        symbols: void 0
      }, symbols }) === String(session.config_signature);
      const reasons = [];
      if (!signatureValid) reasons.push("config_signature_mismatch");
      if (Number(session.move_sequence || 0) > Number(config2.moves || 0) + Number(session.continues_used || 0) * Number(settings.economy_rules?.continueMoves || 5)) {
        reasons.push("move_limit_exceeded");
      }
      const suspicious = reasons.length > 0;
      const progress = { ...initialMatch3Progress(), ...session.goal_progress || {} };
      const success = !suspicious && match3GoalsComplete(config2, progress, tileIds);
      const scoring = config2.scoring || {};
      const breakdown = { ...session.score_breakdown || {} };
      let levelScore = Number(session.level_score || 0);
      if (success) {
        breakdown.goals = config2.goals.length * Number(scoring.goalComplete || 1e3) + Math.round(Number(scoring.allGoalsBase || 2500) * Number(config2.difficulty || 1));
        breakdown.remainingMoves = Math.round(
          Number(session.moves_remaining || 0) * Number(scoring.remainingMove || 200) * Number(config2.difficulty || 1)
        );
        levelScore += Number(breakdown.goals || 0) + Number(breakdown.remainingMoves || 0);
        if (Number(session.continues_used || 0) === 0) {
          breakdown.clean = Math.round(levelScore * Number(scoring.cleanMultiplier || 0.1));
          levelScore += Number(breakdown.clean || 0);
        }
      }
      const stars = match3Stars(levelScore, Number(config2.targetScore || 0), success, scoring);
      const seasonalResult = success ? match3SeasonRating(Number(session.level_number), stars, Number(session.continues_used || 0), config2.rating || {}) : 0;
      const previous = success ? await one(
        client,
        `select * from public.game_level_results
            where season_id = $1 and user_key = $2 and level_number = $3
            for update`,
        [session.season_id, req.userPrincipal.userKey, session.level_number]
      ) : null;
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
      const updated = await one(
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
            req.userPrincipal.userKey,
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
            req.userPrincipal.userKey,
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
          [req.userPrincipal.userKey, suspicious]
        );
      }
      await client.query(
        `insert into public.idempotency_records(
           scope, idempotency_key, actor_key, response_code, response_body, completed_at
         ) values ('game.finish',$1,$2,200,$3::jsonb,now())`,
        [key, req.userPrincipal.userKey, JSON.stringify(updated)]
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
    const existing = await one(
      db2,
      `select * from public.game_continues
        where idempotency_key = $1 and user_key = $2`,
      [key, req.userPrincipal.userKey]
    );
    if (existing) return res.json({ continue: existing, replayed: true });
    const result = await transaction(db2, async (client) => {
      const session = await one(
        client,
        `select * from public.game_sessions
          where id = $1 and user_key = $2 and status = 'active'
          for update`,
        [sessionId, req.userPrincipal.userKey]
      );
      if (!session) throw new ApiError(404, "Active game session was not found", "not_found");
      if (Number(session.continues_used || 0) >= 2) {
        throw new ApiError(409, "The maximum of two continues has been reached", "game_continue_limit");
      }
      const settings = await one(
        client,
        `select continue_points_cost, economy_rules from public.game_settings where singleton = true`
      );
      const economy = settings?.economy_rules || {};
      const costs = Array.isArray(economy.continueCosts) ? economy.continueCosts : [settings?.continue_points_cost || 0, Number(settings?.continue_points_cost || 0) * 2];
      const cost = Number(costs[Number(session.continues_used || 0)] || 0);
      const extraMoves = Math.max(1, Number(economy.continueMoves || 5));
      if (cost <= 0) {
        throw new ApiError(409, "Paid game continues are disabled", "game_continue_disabled");
      }
      const paid = await one(
        client,
        `update public.game_profiles
            set bally_balance = bally_balance - $2, updated_at = now()
          where user_key = $1 and bally_balance >= $2
          returning bally_balance`,
        [req.userPrincipal.userKey, cost]
      );
      if (!paid) throw new ApiError(409, "Not enough Bally", "insufficient_bally");
      const created = await one(
        client,
        `insert into public.game_continues(
           game_session_id, user_key, points_cost, bally_cost, point_transaction_id, idempotency_key
         ) values ($1,$2,0,$3,null,$4)
         returning *`,
        [sessionId, req.userPrincipal.userKey, cost, key]
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
    const session = await transaction(db2, async (client) => {
      const updated = await one(
        client,
        `update public.game_sessions
            set status = 'abandoned', completion_status = 'abandoned', ended_at = now(),
                duration_seconds = greatest(0, extract(epoch from now() - started_at)::integer),
                lives_used = 1, updated_at = now()
          where id = $1 and user_key = $2 and status = 'active'
          returning *`,
        [sessionId, req.userPrincipal.userKey]
      );
      if (updated) {
        await client.query(
          `update public.game_profiles
              set lives = greatest(0, lives - 1), last_life_at = now(), updated_at = now()
            where user_key = $1`,
          [req.userPrincipal.userKey]
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
    const result = await transaction(db2, async (client) => {
      const replay = await one(
        client,
        `select * from public.idempotency_records
          where scope = 'game.lives.restore' and idempotency_key = $1`,
        [key]
      );
      if (replay?.response_body) return { ...replay.response_body, replayed: true };
      const [profile, settings] = await Promise.all([
        one(
          client,
          `select * from public.game_profiles where user_key = $1 for update`,
          [req.userPrincipal.userKey]
        ),
        one(client, `select * from public.game_settings where singleton = true`)
      ]);
      if (!profile || !settings) throw new ApiError(404, "Game profile was not found", "not_found");
      const maximum = Math.max(1, Number(settings.lives_rules?.maximum || settings.base_lives || 5));
      if (Number(profile.lives || 0) >= maximum) {
        return { profile, replayed: false, unchanged: true };
      }
      const cost = full ? Number(settings.economy_rules?.fullLivesCost || 180) : Number(settings.economy_rules?.lifeCost || 50);
      const updated = await one(
        client,
        `update public.game_profiles
            set bally_balance = bally_balance - $4,
                lives = case when $2 then $3 else least($3, lives + 1) end,
                last_life_at = now(), updated_at = now()
          where user_key = $1 and bally_balance >= $4
          returning *`,
        [req.userPrincipal.userKey, full, maximum, cost]
      );
      if (!updated) throw new ApiError(409, "Not enough Bally", "insufficient_bally");
      const responseBody = { profile: updated, cost, full };
      await client.query(
        `insert into public.idempotency_records(
           scope, idempotency_key, actor_key, response_code, response_body, completed_at
         ) values ('game.lives.restore',$1,$2,200,$3::jsonb,now())`,
        [key, req.userPrincipal.userKey, JSON.stringify(responseBody)]
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
      ensureCurrentSeason(db2),
      one(db2, `select clan_rules from public.game_settings where singleton = true`)
    ]);
    const round = await ensureCurrentClanRound(db2, season, clanType);
    const minimumMembers = Math.max(2, Number(settings?.clan_rules?.minimumMembers || 5));
    const rows = await many(
      db2,
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
    const prizes = await many(
      db2,
      `select prize.*, season.name as season_name, season.starts_at, season.ends_at
         from public.game_prizes prize
         join public.game_seasons season on season.id = prize.season_id
        where prize.user_key = $1
        order by season.ends_at desc`,
      [req.userPrincipal.userKey]
    );
    res.json({ prizes });
  }));
  router.get("/seasons/:seasonId", asyncHandler(async (req, res) => {
    const seasonId = uuid(req.params.seasonId, "seasonId");
    const season = await one(
      db2,
      `select * from public.game_seasons where id = $1`,
      [seasonId]
    );
    if (!season) throw new ApiError(404, "Game season was not found", "not_found");
    res.json({ season });
  }));
  router.get("/sessions/:sessionId", asyncHandler(async (req, res) => {
    const sessionId = uuid(req.params.sessionId, "sessionId");
    const session = await one(
      db2,
      `select * from public.game_sessions where id = $1 and user_key = $2`,
      [sessionId, req.userPrincipal.userKey]
    );
    if (!session) throw new ApiError(404, "Game session was not found", "not_found");
    res.json({ session });
  }));
  return router;
}

// server/routes/notifications.ts
import { Router as Router17 } from "express";
function createNotificationsRouter(db2) {
  const router = Router17();
  router.use(requireUser);
  router.get("/", asyncHandler(async (req, res) => {
    const notifications = await many(
      db2,
      `select * from public.notifications
        where user_key = $1
          and status <> 'cancelled'
          and (expires_at is null or expires_at > now())
        order by created_at desc
        limit 200`,
      [req.userPrincipal.userKey]
    );
    const unread = notifications.filter((row) => !row.read_at).length;
    res.json({ notifications, unread });
  }));
  router.patch("/:notificationId/read", asyncHandler(async (req, res) => {
    const notificationId = uuid(req.params.notificationId, "notificationId");
    const notification = await one(
      db2,
      `update public.notifications
          set read_at = coalesce(read_at, now()), updated_at = now()
        where id = $1 and user_key = $2
        returning *`,
      [notificationId, req.userPrincipal.userKey]
    );
    if (!notification) throw new ApiError(404, "Notification was not found", "not_found");
    res.json({ notification });
  }));
  router.post("/read-all", asyncHandler(async (req, res) => {
    const result = await db2.query(
      `update public.notifications
          set read_at = coalesce(read_at, now()), updated_at = now()
        where user_key = $1 and read_at is null`,
      [req.userPrincipal.userKey]
    );
    res.json({ updated: result.rowCount || 0 });
  }));
  router.get("/preferences/me", asyncHandler(async (req, res) => {
    const preferences = await one(
      db2,
      `select * from public.notification_preferences where user_key = $1`,
      [req.userPrincipal.userKey]
    );
    res.json({ preferences });
  }));
  router.patch("/preferences/me", asyncHandler(async (req, res) => {
    const before = await one(
      db2,
      `select * from public.notification_preferences where user_key = $1`,
      [req.userPrincipal.userKey]
    );
    if (!before) throw new ApiError(404, "Notification preferences were not found", "not_found");
    const quietStart = req.body?.quietHoursStart === void 0 ? before.quiet_hours_start : isoDateOrNull(`1970-01-01T${String(req.body.quietHoursStart)}Z`)?.slice(11, 19) || null;
    const quietEnd = req.body?.quietHoursEnd === void 0 ? before.quiet_hours_end : isoDateOrNull(`1970-01-01T${String(req.body.quietHoursEnd)}Z`)?.slice(11, 19) || null;
    const disabledTypes = req.body?.disabledTypes === void 0 ? before.disabled_types || [] : uniqueStrings(req.body.disabledTypes, "disabledTypes", 0, 100, 100);
    const preferences = await one(
      db2,
      `update public.notification_preferences
          set in_app_enabled = $2, telegram_enabled = $3, marketing_enabled = $4,
              quiet_hours_start = $5, quiet_hours_end = $6,
              disabled_types = $7::text[], updated_at = now()
        where user_key = $1 returning *`,
      [
        req.userPrincipal.userKey,
        req.body?.inAppEnabled === void 0 ? before.in_app_enabled : booleanValue(req.body.inAppEnabled),
        req.body?.telegramEnabled === void 0 ? before.telegram_enabled : booleanValue(req.body.telegramEnabled),
        req.body?.marketingEnabled === void 0 ? before.marketing_enabled : booleanValue(req.body.marketingEnabled),
        quietStart,
        quietEnd,
        disabledTypes
      ]
    );
    res.json({ preferences });
  }));
  return router;
}

// server/routes/people.ts
import { Router as Router18 } from "express";
function createPeopleRouter(db2) {
  const router = Router18();
  router.use(requireUser);
  router.get("/", asyncHandler(async (req, res) => {
    const limit = boundedInteger(req.query.limit, 30, 1, 100);
    const query = String(req.query.search || "").trim();
    const rows = await many(
      db2,
      `select user_row.user_key
         from public.app_users user_row
         left join public.user_profiles profile on profile.user_key = user_row.user_key
        where user_row.account_status = 'active' and user_row.user_key <> $1
          and coalesce(profile.discoverable, true) = true
          and ($2 = '' or lower(name) like '%' || lower($2) || '%')
          and not exists (
            select 1 from public.user_blocks block
             where (block.blocker_user_key = $1 and block.blocked_user_key = user_row.user_key)
                or (block.blocker_user_key = user_row.user_key and block.blocked_user_key = $1)
          )
        order by user_row.last_seen_at desc limit $3`,
      [req.userPrincipal.userKey, query, limit]
    );
    const profiles = await visibleProfiles(
      db2,
      req.userPrincipal.userKey,
      rows.map((row) => row.user_key)
    );
    res.json({ people: profiles });
  }));
  router.get("/me", asyncHandler(async (req, res) => {
    const [profile, details, consents, clans, upcomingEvent] = await Promise.all([
      visibleProfile(db2, req.userPrincipal.userKey, req.userPrincipal.userKey),
      one(
        db2,
        `select * from public.user_profiles where user_key = $1`,
        [req.userPrincipal.userKey]
      ),
      one(
        db2,
        `select * from public.user_consents where user_key = $1`,
        [req.userPrincipal.userKey]
      ),
      many(
        db2,
        `select clan.id, clan.name, clan.clan_type, clan.logo_url
           from (
             select c.id, c.name, c.clan_type, profile.logo_url
               from public.clan_memberships membership
               join public.clans c on c.id = membership.clan_id
               left join public.clan_profiles profile on profile.clan_id = c.id
              where membership.user_key = $1
                and membership.status = 'active'
                and c.status = 'active'
           ) clan
          order by clan.clan_type`,
        [req.userPrincipal.userKey]
      ),
      one(
        db2,
        `select event.id, event.title, event.event_date, event.event_time,
                attendance.status
           from public.event_attendance attendance
           join public.events event on event.id = attendance.event_id
           left join public.event_runtime runtime on runtime.event_id = event.id
          where attendance.user_key = $1
            and attendance.status in ('going', 'maybe')
            and coalesce(runtime.status, 'published') in ('published', 'active')
            and coalesce(runtime.ends_at, runtime.starts_at, event.event_date::timestamptz) > now()
          order by coalesce(runtime.starts_at, event.event_date::timestamptz)
          limit 1`,
        [req.userPrincipal.userKey]
      )
    ]);
    res.json({ profile: { ...profile, details, clans, upcomingEvent }, consents });
  }));
  router.patch("/me", asyncHandler(async (req, res) => {
    const current = await one(
      db2,
      `select profile.*, user_row.name
         from public.user_profiles profile
         join public.app_users user_row on user_row.user_key = profile.user_key
        where profile.user_key = $1`,
      [req.userPrincipal.userKey]
    );
    if (!current) throw new ApiError(404, "BALI profile was not found", "not_found");
    const displayName = req.body?.displayName === void 0 ? current.display_name || current.name : requiredText(req.body.displayName, "displayName", 120);
    const statusText = req.body?.statusText === void 0 ? current.status_text : optionalText(req.body.statusText, 80);
    const bio = req.body?.bio === void 0 ? current.bio : optionalText(req.body.bio, 1e3);
    const interests = req.body?.interests === void 0 ? current.interests || [] : uniqueStrings(req.body.interests, "interests", 0, 30, 80);
    const gender = req.body?.gender === void 0 ? current.gender : enumValue(req.body.gender, "gender", ["female", "male", "unspecified"]);
    const birthDate = req.body?.birthDate === void 0 ? current.birth_date : isoDateOrNull(req.body.birthDate)?.slice(0, 10) || null;
    const avatarUrl = req.body?.avatarUrl === void 0 ? current.avatar_url : optionalText(req.body.avatarUrl, 2e3);
    const phone = req.body?.phone === void 0 ? current.phone : optionalText(req.body.phone, 80);
    const discoverable = req.body?.discoverable === void 0 ? current.discoverable : booleanValue(req.body.discoverable);
    const allowConnections = req.body?.allowConnections === void 0 ? current.allow_connections : booleanValue(req.body.allowConnections);
    const allowEventInvites = req.body?.allowEventInvites === void 0 ? current.allow_event_invites : booleanValue(req.body.allowEventInvites);
    const allowGifts = req.body?.allowGifts === void 0 ? current.allow_gifts : booleanValue(req.body.allowGifts);
    const updated = await one(
      db2,
      `update public.user_profiles
          set display_name = $2,
              status_text = $3,
              bio = $4,
              interests = $5::text[],
              gender = $6,
              birth_date = $7,
              avatar_url = $8,
              phone = $9,
              discoverable = $10,
              allow_connections = $11,
              allow_event_invites = $12,
              allow_gifts = $13,
              updated_at = now()
        where user_key = $1
        returning *`,
      [
        req.userPrincipal.userKey,
        displayName,
        statusText,
        bio,
        interests,
        gender,
        birthDate,
        avatarUrl,
        phone,
        discoverable,
        allowConnections,
        allowEventInvites,
        allowGifts
      ]
    );
    await db2.query(
      `update public.app_users
          set name = $2,
              birth_date = $3,
              avatar = $4,
              phone = $5,
              updated_at = now()
        where user_key = $1`,
      [req.userPrincipal.userKey, displayName, birthDate, avatarUrl, phone]
    );
    res.json({ profile: updated });
  }));
  router.put("/me/consents", asyncHandler(async (req, res) => {
    const ageConfirmed = booleanValue(req.body?.ageConfirmed);
    const termsVersion = requiredText(req.body?.termsVersion, "termsVersion", 80);
    const privacyVersion = requiredText(req.body?.privacyVersion, "privacyVersion", 80);
    const marketingOptIn = booleanValue(req.body?.marketingOptIn);
    if (!ageConfirmed) {
      throw new ApiError(400, "The 18+ confirmation is required", "age_confirmation_required");
    }
    const consents = await one(
      db2,
      `insert into public.user_consents(
         user_key, age_confirmed, age_confirmed_at,
         terms_version, terms_accepted_at,
         privacy_version, privacy_accepted_at,
         marketing_opt_in, marketing_updated_at
       ) values ($1,true,now(),$2,now(),$3,now(),$4,now())
       on conflict (user_key) do update
         set age_confirmed = true,
             age_confirmed_at = coalesce(user_consents.age_confirmed_at, now()),
             terms_version = excluded.terms_version,
             terms_accepted_at = now(),
             privacy_version = excluded.privacy_version,
             privacy_accepted_at = now(),
             marketing_opt_in = excluded.marketing_opt_in,
             marketing_updated_at = now(),
             updated_at = now()
       returning *`,
      [req.userPrincipal.userKey, termsVersion, privacyVersion, marketingOptIn]
    );
    await db2.query(
      `insert into public.notification_preferences(user_key, marketing_enabled)
       values ($1,$2)
       on conflict (user_key) do update
         set marketing_enabled = excluded.marketing_enabled,
             updated_at = now()`,
      [req.userPrincipal.userKey, marketingOptIn]
    );
    res.json({ consents });
  }));
  router.patch("/me/privacy", asyncHandler(async (req, res) => {
    const current = await one(
      db2,
      `select profile_privacy from public.app_users where user_key = $1`,
      [req.userPrincipal.userKey]
    );
    if (!current) throw new ApiError(404, "BALI profile was not found", "not_found");
    const next = { ...current.profile_privacy || {} };
    for (const field of PRIVACY_FIELDS) {
      if (req.body?.[field] === void 0) continue;
      const mode = String(req.body[field]);
      if (!PRIVACY_MODES.has(mode)) {
        throw new ApiError(400, `Invalid privacy mode for ${field}`, "validation_error");
      }
      next[field] = mode;
    }
    await db2.query(
      `update public.app_users set profile_privacy = $1::jsonb where user_key = $2`,
      [JSON.stringify(next), req.userPrincipal.userKey]
    );
    res.json({ privacy: next });
  }));
  router.get("/me/export", asyncHandler(async (req, res) => {
    const userKey = req.userPrincipal.userKey;
    const [
      account,
      profile,
      consents,
      clans,
      attendance,
      bookings,
      points,
      rewards,
      gifts,
      vip,
      orders,
      gameSessions,
      connections,
      sentMessages,
      reports,
      notifications
    ] = await Promise.all([
      one(db2, `select * from public.app_users where user_key = $1`, [userKey]),
      one(db2, `select * from public.user_profiles where user_key = $1`, [userKey]),
      one(db2, `select * from public.user_consents where user_key = $1`, [userKey]),
      many(db2, `select * from public.clan_memberships where user_key = $1 order by created_at`, [userKey]),
      many(db2, `select * from public.event_attendance where user_key = $1 order by created_at`, [userKey]),
      many(db2, `select * from public.booking_records where user_key = $1 order by created_at`, [userKey]),
      many(db2, `select * from public.point_ledger where user_key = $1 order by created_at`, [userKey]),
      many(db2, `select * from public.user_rewards where user_key = $1 order by granted_at`, [userKey]),
      many(
        db2,
        `select * from public.gifts
          where sender_user_key = $1 or recipient_user_key = $1
          order by created_at`,
        [userKey]
      ),
      many(db2, `select * from public.user_vip_subscriptions where user_key = $1 order by created_at`, [userKey]),
      many(db2, `select * from public.shop_orders where user_key = $1 order by created_at`, [userKey]),
      many(db2, `select * from public.game_sessions where user_key = $1 order by started_at`, [userKey]),
      many(
        db2,
        `select * from public.user_connections
          where requester_user_key = $1 or recipient_user_key = $1
          order by created_at`,
        [userKey]
      ),
      many(db2, `select * from public.direct_messages where sender_user_key = $1 order by created_at`, [userKey]),
      many(
        db2,
        `select * from public.user_reports
          where reporter_user_key = $1 or reported_user_key = $1
          order by created_at`,
        [userKey]
      ),
      many(db2, `select * from public.notifications where user_key = $1 order by created_at`, [userKey])
    ]);
    res.setHeader("Content-Disposition", `attachment; filename="bali-data-${encodeURIComponent(userKey)}.json"`);
    res.json({
      exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
      account,
      profile,
      consents,
      clans,
      attendance,
      bookings,
      pointLedger: points,
      rewards,
      gifts,
      vip,
      orders,
      gameSessions,
      connections,
      sentMessages,
      reports,
      notifications
    });
  }));
  router.delete("/me", asyncHandler(async (req, res) => {
    const confirmation = requiredText(req.body?.confirmation, "confirmation", 20);
    if (confirmation !== "DELETE") {
      throw new ApiError(400, "Type DELETE to confirm account deletion", "deletion_confirmation_required");
    }
    const reason = optionalText(req.body?.reason, 1e3);
    const userKey = req.userPrincipal.userKey;
    const deletion = await transaction(db2, async (client) => {
      const account = await one(
        client,
        `select user_key, telegram_id, name, username, phone, account_status
           from public.app_users where user_key = $1 for update`,
        [userKey]
      );
      if (!account) throw new ApiError(404, "BALI account was not found", "not_found");
      if (account.account_status === "deleted") {
        throw new ApiError(409, "BALI account has already been deleted", "account_already_deleted");
      }
      const ledClan = await one(
        client,
        `select id, name from public.clans
          where leader_user_key = $1 and status = 'active'
          limit 1`,
        [userKey]
      );
      if (ledClan) {
        throw new ApiError(
          409,
          "Transfer clan leadership before deleting the account",
          "clan_leadership_transfer_required",
          { clanId: ledClan.id, clanName: ledClan.name }
        );
      }
      const request = await one(
        client,
        `insert into public.account_deletion_requests(
           user_key, reason, status, processed_at, metadata
         ) values ($1,$2,'completed',now(),$3::jsonb)
         returning *`,
        [
          userKey,
          reason,
          JSON.stringify({
            previousTelegramId: account.telegram_id,
            previousName: account.name,
            previousUsername: account.username
          })
        ]
      );
      await client.query(
        `update public.app_users
            set telegram_id = null,
                name = '\u0423\u0434\u0430\u043B\u0451\u043D\u043D\u044B\u0439 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C',
                username = '',
                phone = '',
                avatar = '',
                birth_date = null,
                account_status = 'deleted',
                blocked_at = now(),
                profile_privacy = '{"avatar":"private","username":"private","phone":"private","birth_date":"private","status":"private","events":"private","clan":"private"}'::jsonb,
                updated_at = now()
          where user_key = $1`,
        [userKey]
      );
      await client.query(
        `update public.user_profiles
            set display_name = '\u0423\u0434\u0430\u043B\u0451\u043D\u043D\u044B\u0439 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C',
                status_text = '',
                bio = '',
                interests = '{}',
                birth_date = null,
                gender = 'unspecified',
                avatar_url = '',
                phone = '',
                discoverable = false,
                allow_connections = false,
                allow_event_invites = false,
                allow_gifts = false,
                updated_at = now()
          where user_key = $1`,
        [userKey]
      );
      await client.query(
        `update public.user_consents
            set marketing_opt_in = false, marketing_updated_at = now(), updated_at = now()
          where user_key = $1`,
        [userKey]
      );
      await client.query(
        `update public.notification_preferences
            set in_app_enabled = false, telegram_enabled = false,
                marketing_enabled = false, updated_at = now()
          where user_key = $1`,
        [userKey]
      );
      await client.query(
        `update public.crm_customers
            set phone = '', first_name = '\u0423\u0434\u0430\u043B\u0451\u043D\u043D\u044B\u0439 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C',
                last_name = '', birth_date = null, marketing_opt_in = false,
                updated_at = now()
          where user_key = $1`,
        [userKey]
      );
      await client.query(
        `update public.clan_memberships
            set status = 'left', ended_at = coalesce(ended_at, now()), updated_at = now()
          where user_key = $1 and status = 'active'`,
        [userKey]
      );
      await client.query(
        `update public.user_connections
            set status = 'removed', updated_at = now()
          where requester_user_key = $1 or recipient_user_key = $1`,
        [userKey]
      );
      await client.query(
        `update public.direct_conversations
            set archived_at = coalesce(archived_at, now()), updated_at = now()
          where pair_low = $1 or pair_high = $1`,
        [userKey]
      );
      await client.query(
        `update public.direct_messages
            set sender_user_key = null, updated_at = now()
          where sender_user_key = $1`,
        [userKey]
      );
      await client.query(
        `update public.event_attendance
            set status = 'cancelled', updated_at = now()
          where user_key = $1 and status in ('going','maybe')`,
        [userKey]
      );
      await client.query(
        `update public.booking_holds
            set status = 'released', released_at = now(), updated_at = now()
          where user_key = $1 and status = 'active'`,
        [userKey]
      );
      await client.query(
        `update public.booking_records
            set customer_name = '\u0423\u0434\u0430\u043B\u0451\u043D\u043D\u044B\u0439 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C',
                phone = '', comment = '', updated_at = now()
          where user_key = $1`,
        [userKey]
      );
      await client.query(
        `update public.gifts
            set message = '', updated_at = now()
          where sender_user_key = $1 or recipient_user_key = $1`,
        [userKey]
      );
      await client.query(`delete from public.notifications where user_key = $1`, [userKey]);
      await client.query(`delete from public.telegram_accounts where app_user_key = $1`, [userKey]);
      await client.query(
        `update public.user_sessions set revoked_at = now()
          where app_user_key = $1 and revoked_at is null`,
        [userKey]
      );
      return request;
    });
    res.clearCookie(USER_COOKIE, { path: "/" });
    res.json({ deletion });
  }));
  router.get("/:userKey", asyncHandler(async (req, res) => {
    const userKey = identifier(req.params.userKey, "userKey");
    res.json({ profile: await visibleProfile(db2, req.userPrincipal.userKey, userKey) });
  }));
  return router;
}

// server/routes/platform-config.ts
import { Router as Router19 } from "express";
function createPlatformConfigRouter(db2) {
  const router = Router19();
  router.use(requireUser);
  router.get("/", asyncHandler(async (_req, res) => {
    const [blocks, navigation, assets] = await Promise.all([
      many(
        db2,
        `select scope, block_key, name, title, subtitle, asset_key,
                configuration, recommended_width, recommended_height, sort_order
           from public.ui_content_blocks
          where active = true
          order by scope, sort_order, block_key`
      ),
      many(
        db2,
        `select app_type, item_key, label, route, icon_url,
                recommended_width, recommended_height, sort_order
           from public.ui_navigation_items
          where active = true
          order by app_type, sort_order, item_key`
      ),
      many(
        db2,
        `select asset_key, name, url, media_type, width, height,
                recommended_width, recommended_height, alt_text
           from public.admin_assets`
      )
    ]);
    res.json({ blocks, navigation, assets });
  }));
  return router;
}

// server/routes/social.ts
import { Router as Router20 } from "express";
var CONNECTION_RESPONSES = ["accepted", "declined"];
function pair(left, right) {
  return left < right ? [left, right] : [right, left];
}
async function blockedBetween(db2, first, second) {
  return Boolean(await one(
    db2,
    `select 1
       from public.user_blocks
      where (blocker_user_key = $1 and blocked_user_key = $2)
         or (blocker_user_key = $2 and blocked_user_key = $1)
      limit 1`,
    [first, second]
  ));
}
async function conversationAccess(db2, conversationId, userKey) {
  const row = await one(
    db2,
    `select conversation.*, connection.status as connection_status
       from public.direct_conversations conversation
       join public.user_connections connection on connection.id = conversation.connection_id
      where conversation.id = $1
        and $2 in (conversation.pair_low, conversation.pair_high)`,
    [conversationId, userKey]
  );
  if (!row) throw new ApiError(404, "Conversation was not found", "not_found");
  if (row.connection_status !== "accepted" || row.archived_at) {
    throw new ApiError(403, "Conversation is not active", "conversation_unavailable");
  }
  const peerKey = row.pair_low === userKey ? row.pair_high : row.pair_low;
  if (await blockedBetween(db2, userKey, peerKey)) {
    throw new ApiError(403, "Conversation is unavailable because one user blocked the other", "user_blocked");
  }
  return { ...row, peerKey };
}
async function notify2(db2, userKey, type, title, body, data, idempotencyKey3) {
  await db2.query(
    `insert into public.notifications(
       user_key, notification_type, title, body, data, idempotency_key
     ) values ($1,$2,$3,$4,$5::jsonb,$6)
     on conflict (idempotency_key) do nothing`,
    [userKey, type, title, body, JSON.stringify(data), idempotencyKey3]
  );
}
function createSocialRouter(db2) {
  const router = Router20();
  router.use(requireUser);
  router.get("/connections", asyncHandler(async (req, res) => {
    const rows = await many(
      db2,
      `select connection.*,
              case when connection.requester_user_key = $1
                then recipient.name else requester.name end as peer_name,
              case when connection.requester_user_key = $1
                then recipient.avatar else requester.avatar end as peer_avatar,
              case when connection.requester_user_key = $1
                then connection.recipient_user_key else connection.requester_user_key end as peer_user_key,
              conversation.id as conversation_id
         from public.user_connections connection
         join public.app_users requester on requester.user_key = connection.requester_user_key
         join public.app_users recipient on recipient.user_key = connection.recipient_user_key
         left join public.direct_conversations conversation
           on conversation.connection_id = connection.id
        where $1 in (connection.requester_user_key, connection.recipient_user_key)
          and connection.status in ('pending', 'accepted')
        order by case when connection.status = 'pending' then 0 else 1 end,
                 connection.updated_at desc`,
      [req.userPrincipal.userKey]
    );
    res.json({ connections: rows });
  }));
  router.post("/connections", asyncHandler(async (req, res) => {
    await enforceRateLimit(db2, req, "connection.create", requestSubject(req));
    const recipientUserKey = identifier(req.body?.recipientUserKey, "recipientUserKey");
    const message = optionalText(req.body?.message, 500);
    const requesterUserKey = req.userPrincipal.userKey;
    if (recipientUserKey === requesterUserKey) {
      throw new ApiError(400, "A user cannot send a connection request to themselves", "validation_error");
    }
    if (await blockedBetween(db2, requesterUserKey, recipientUserKey)) {
      throw new ApiError(403, "Connection request is unavailable because one user blocked the other", "user_blocked");
    }
    const recipient = await one(
      db2,
      `select user_row.user_key, user_row.name,
              coalesce(profile.allow_connections, true) as allow_connections
         from public.app_users user_row
         left join public.user_profiles profile on profile.user_key = user_row.user_key
        where user_row.user_key = $1
          and user_row.account_status = 'active'
          and user_row.blocked_at is null`,
      [recipientUserKey]
    );
    if (!recipient) throw new ApiError(404, "Recipient was not found", "not_found");
    if (!recipient.allow_connections) {
      throw new ApiError(403, "Recipient disabled connection requests", "connections_disabled");
    }
    const sentToday = await one(
      db2,
      `select count(*)::integer as count
         from public.user_connections
        where requester_user_key = $1
          and created_at > now() - interval '24 hours'`,
      [requesterUserKey]
    );
    if (Number(sentToday?.count || 0) >= 10) {
      throw new ApiError(429, "Daily connection request limit has been reached", "connection_daily_limit", {
        retryAfter: 3600
      });
    }
    const [pairLow, pairHigh] = pair(requesterUserKey, recipientUserKey);
    const connection = await transaction(db2, async (client) => {
      const existing = await one(
        client,
        `select * from public.user_connections
          where pair_low = $1 and pair_high = $2
          for update`,
        [pairLow, pairHigh]
      );
      if (existing) {
        if (existing.status === "accepted") {
          throw new ApiError(409, "Users are already connected", "connection_already_exists");
        }
        if (existing.status === "pending") {
          throw new ApiError(409, "A connection request is already pending", "connection_already_pending");
        }
        if (existing.cooldown_until && new Date(existing.cooldown_until).getTime() > Date.now()) {
          throw new ApiError(409, "A new request is temporarily unavailable after rejection", "connection_cooldown", {
            cooldownUntil: existing.cooldown_until
          });
        }
        const reopened = await one(
          client,
          `update public.user_connections
              set requester_user_key = $2,
                  recipient_user_key = $3,
                  status = 'pending',
                  request_message = $4,
                  cooldown_until = null,
                  responded_at = null,
                  created_at = now(),
                  updated_at = now()
            where id = $1
            returning *`,
          [existing.id, requesterUserKey, recipientUserKey, message]
        );
        return reopened;
      }
      return one(
        client,
        `insert into public.user_connections(
           requester_user_key, recipient_user_key, pair_low, pair_high, request_message
         ) values ($1,$2,$3,$4,$5)
         returning *`,
        [requesterUserKey, recipientUserKey, pairLow, pairHigh, message]
      );
    });
    await notify2(
      db2,
      recipientUserKey,
      "connection_request",
      "\u041D\u043E\u0432\u0430\u044F \u0437\u0430\u044F\u0432\u043A\u0430 \u043D\u0430 \u0437\u043D\u0430\u043A\u043E\u043C\u0441\u0442\u0432\u043E",
      `${req.userPrincipal.name} \u0445\u043E\u0447\u0435\u0442 \u043F\u043E\u0437\u043D\u0430\u043A\u043E\u043C\u0438\u0442\u044C\u0441\u044F.`,
      { connectionId: connection.id, requesterUserKey },
      `connection-request:${connection.id}:${connection.created_at}`
    );
    res.status(201).json({ connection });
  }));
  router.patch("/connections/:connectionId", asyncHandler(async (req, res) => {
    const connectionId = uuid(req.params.connectionId, "connectionId");
    const status = enumValue(req.body?.status, "status", CONNECTION_RESPONSES);
    const result = await transaction(db2, async (client) => {
      const connection = await one(
        client,
        `select * from public.user_connections
          where id = $1 and recipient_user_key = $2
          for update`,
        [connectionId, req.userPrincipal.userKey]
      );
      if (!connection) throw new ApiError(404, "Connection request was not found", "not_found");
      if (connection.status !== "pending") {
        throw new ApiError(409, "Connection request has already been answered", "connection_already_answered");
      }
      if (await blockedBetween(client, connection.requester_user_key, connection.recipient_user_key)) {
        throw new ApiError(403, "Connection is unavailable because one user blocked the other", "user_blocked");
      }
      const updated = await one(
        client,
        `update public.user_connections
            set status = $2,
                responded_at = now(),
                cooldown_until = case when $2 = 'declined' then now() + interval '30 days' else null end,
                updated_at = now()
          where id = $1
          returning *`,
        [connectionId, status]
      );
      let conversation = null;
      if (status === "accepted") {
        conversation = await one(
          client,
          `insert into public.direct_conversations(pair_low, pair_high, connection_id)
           values ($1,$2,$3)
           on conflict (pair_low, pair_high) do update
             set connection_id = excluded.connection_id,
                 archived_at = null,
                 updated_at = now()
           returning *`,
          [connection.pair_low, connection.pair_high, connection.id]
        );
      }
      await notify2(
        client,
        connection.requester_user_key,
        status === "accepted" ? "connection_accepted" : "connection_declined",
        status === "accepted" ? "\u0417\u043D\u0430\u043A\u043E\u043C\u0441\u0442\u0432\u043E \u043F\u0440\u0438\u043D\u044F\u0442\u043E" : "\u0417\u0430\u044F\u0432\u043A\u0430 \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0430",
        status === "accepted" ? `${req.userPrincipal.name} \u043F\u0440\u0438\u043D\u044F\u043B \u0432\u0430\u0448\u0443 \u0437\u0430\u044F\u0432\u043A\u0443. \u0422\u0435\u043F\u0435\u0440\u044C \u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D \u043B\u0438\u0447\u043D\u044B\u0439 \u0447\u0430\u0442.` : `${req.userPrincipal.name} \u043E\u0442\u043A\u043B\u043E\u043D\u0438\u043B \u0432\u0430\u0448\u0443 \u0437\u0430\u044F\u0432\u043A\u0443.`,
        { connectionId, conversationId: conversation?.id || null, status },
        `connection-response:${connectionId}`
      );
      return { connection: updated, conversation };
    });
    res.json(result);
  }));
  router.delete("/connections/:connectionId", asyncHandler(async (req, res) => {
    const connectionId = uuid(req.params.connectionId, "connectionId");
    const updated = await one(
      db2,
      `update public.user_connections
          set status = 'removed', updated_at = now()
        where id = $1
          and $2 in (requester_user_key, recipient_user_key)
          and status = 'accepted'
        returning *`,
      [connectionId, req.userPrincipal.userKey]
    );
    if (!updated) throw new ApiError(404, "Active connection was not found", "not_found");
    await db2.query(
      `update public.direct_conversations
          set archived_at = now(), updated_at = now()
        where connection_id = $1`,
      [connectionId]
    );
    res.status(204).end();
  }));
  router.get("/conversations", asyncHandler(async (req, res) => {
    const rows = await many(
      db2,
      `select conversation.*,
              case when conversation.pair_low = $1 then conversation.pair_high else conversation.pair_low end as peer_user_key,
              peer.name as peer_name,
              peer.avatar as peer_avatar,
              latest.body as last_message,
              latest.created_at as last_message_at,
              coalesce(unread.unread_count, 0)::integer as unread_count
         from public.direct_conversations conversation
         join public.user_connections connection
           on connection.id = conversation.connection_id and connection.status = 'accepted'
         join public.app_users peer
           on peer.user_key = case when conversation.pair_low = $1 then conversation.pair_high else conversation.pair_low end
         left join lateral (
           select message.body, message.created_at
             from public.direct_messages message
            where message.conversation_id = conversation.id and message.deleted_at is null
            order by message.created_at desc
            limit 1
         ) latest on true
         left join lateral (
           select count(*) as unread_count
             from public.direct_messages message
             left join public.direct_message_read_states read_state
               on read_state.conversation_id = conversation.id and read_state.user_key = $1
            where message.conversation_id = conversation.id
              and message.sender_user_key <> $1
              and message.deleted_at is null
              and message.created_at > coalesce(read_state.last_read_at, '-infinity'::timestamptz)
         ) unread on true
        where $1 in (conversation.pair_low, conversation.pair_high)
          and conversation.archived_at is null
          and not exists (
            select 1 from public.user_blocks block
             where (block.blocker_user_key = conversation.pair_low and block.blocked_user_key = conversation.pair_high)
                or (block.blocker_user_key = conversation.pair_high and block.blocked_user_key = conversation.pair_low)
          )
        order by latest.created_at desc nulls last, conversation.updated_at desc`,
      [req.userPrincipal.userKey]
    );
    res.json({ conversations: rows });
  }));
  router.get("/conversations/:conversationId/messages", asyncHandler(async (req, res) => {
    const conversationId = uuid(req.params.conversationId, "conversationId");
    await conversationAccess(db2, conversationId, req.userPrincipal.userKey);
    const rows = await many(
      db2,
      `select message.*, author.name as author_name, author.avatar as author_avatar
         from public.direct_messages message
         left join public.app_users author on author.user_key = message.sender_user_key
        where message.conversation_id = $1
        order by message.created_at asc
        limit 200`,
      [conversationId]
    );
    await db2.query(
      `insert into public.direct_message_read_states(conversation_id, user_key, last_read_at)
       values ($1,$2,now())
       on conflict (conversation_id, user_key) do update
         set last_read_at = excluded.last_read_at`,
      [conversationId, req.userPrincipal.userKey]
    );
    res.json({ messages: rows });
  }));
  router.post("/conversations/:conversationId/messages", asyncHandler(async (req, res) => {
    await enforceRateLimit(db2, req, "direct_message.create", requestSubject(req));
    const conversationId = uuid(req.params.conversationId, "conversationId");
    const body = requiredText(req.body?.body, "body", 4e3);
    const replyToMessageId = req.body?.replyToMessageId ? uuid(req.body.replyToMessageId, "replyToMessageId") : null;
    const conversation = await conversationAccess(db2, conversationId, req.userPrincipal.userKey);
    if (replyToMessageId) {
      const reply = await one(
        db2,
        `select id from public.direct_messages
          where id = $1 and conversation_id = $2`,
        [replyToMessageId, conversationId]
      );
      if (!reply) throw new ApiError(404, "Reply message was not found", "not_found");
    }
    const message = await one(
      db2,
      `insert into public.direct_messages(
         conversation_id, sender_user_key, body, reply_to_message_id
       ) values ($1,$2,$3,$4)
       returning *`,
      [conversationId, req.userPrincipal.userKey, body, replyToMessageId]
    );
    await db2.query(
      `update public.direct_conversations set updated_at = now() where id = $1`,
      [conversationId]
    );
    await notify2(
      db2,
      conversation.peerKey,
      "direct_message",
      `\u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u043E\u0442 ${req.userPrincipal.name}`,
      body.slice(0, 300),
      { conversationId, messageId: message.id },
      `direct-message:${message.id}`
    );
    res.status(201).json({ message });
  }));
  router.post("/blocks", asyncHandler(async (req, res) => {
    const blockedUserKey = identifier(req.body?.blockedUserKey, "blockedUserKey");
    const reason = optionalText(req.body?.reason, 1e3);
    if (blockedUserKey === req.userPrincipal.userKey) {
      throw new ApiError(400, "A user cannot block themselves", "validation_error");
    }
    const target = await one(
      db2,
      `select user_key from public.app_users where user_key = $1`,
      [blockedUserKey]
    );
    if (!target) throw new ApiError(404, "User was not found", "not_found");
    const [pairLow, pairHigh] = pair(req.userPrincipal.userKey, blockedUserKey);
    const result = await transaction(db2, async (client) => {
      const block = await one(
        client,
        `insert into public.user_blocks(blocker_user_key, blocked_user_key, reason)
         values ($1,$2,$3)
         on conflict (blocker_user_key, blocked_user_key) do update
           set reason = excluded.reason
         returning *`,
        [req.userPrincipal.userKey, blockedUserKey, reason]
      );
      await client.query(
        `update public.user_connections
            set status = 'blocked', updated_at = now()
          where pair_low = $1 and pair_high = $2`,
        [pairLow, pairHigh]
      );
      await client.query(
        `update public.direct_conversations
            set archived_at = now(), updated_at = now()
          where pair_low = $1 and pair_high = $2`,
        [pairLow, pairHigh]
      );
      return block;
    });
    res.status(201).json({ block: result });
  }));
  router.delete("/blocks/:blockedUserKey", asyncHandler(async (req, res) => {
    const blockedUserKey = identifier(req.params.blockedUserKey, "blockedUserKey");
    const result = await db2.query(
      `delete from public.user_blocks
        where blocker_user_key = $1 and blocked_user_key = $2`,
      [req.userPrincipal.userKey, blockedUserKey]
    );
    if (!result.rowCount) throw new ApiError(404, "Block was not found", "not_found");
    res.status(204).end();
  }));
  router.post("/reports", asyncHandler(async (req, res) => {
    await enforceRateLimit(db2, req, "user_report.create", requestSubject(req));
    const reportedUserKey = identifier(req.body?.reportedUserKey, "reportedUserKey");
    const reasonCode = requiredText(req.body?.reasonCode, "reasonCode", 100);
    const details = optionalText(req.body?.details, 2e3);
    const conversationId = req.body?.conversationId ? uuid(req.body.conversationId, "conversationId") : null;
    const messageId = req.body?.messageId ? uuid(req.body.messageId, "messageId") : null;
    if (reportedUserKey === req.userPrincipal.userKey) {
      throw new ApiError(400, "A user cannot report themselves", "validation_error");
    }
    if (conversationId) {
      await conversationAccess(db2, conversationId, req.userPrincipal.userKey);
    }
    const report = await transaction(db2, async (client) => {
      const created = await one(
        client,
        `insert into public.user_reports(
           reporter_user_key, reported_user_key, conversation_id, message_id,
           reason_code, details
         ) values ($1,$2,$3,$4,$5,$6)
         returning *`,
        [
          req.userPrincipal.userKey,
          reportedUserKey,
          conversationId,
          messageId,
          reasonCode,
          details
        ]
      );
      await client.query(
        `insert into public.moderation_cases(
           case_type, source_type, source_id, reported_user_key, priority
         ) values ('user_report','user_report',$1,$2,'normal')`,
        [created.id, reportedUserKey]
      );
      return created;
    });
    res.status(201).json({ report });
  }));
  return router;
}

// server/app.ts
var siteDirectory = path2.resolve(process.cwd(), "site");
var defaultUploadDirectory = process.env.VERCEL ? "/tmp/bali-uploads" : path2.join(process.cwd(), "var", "uploads");
var uploadDirectory = path2.resolve(process.env.BALI_UPLOAD_DIR || defaultUploadDirectory);
function createApp(db2, config2) {
  mkdirSync(uploadDirectory, { recursive: true });
  const app2 = express2();
  app2.disable("x-powered-by");
  if (config2.trustProxy) app2.set("trust proxy", 1);
  app2.use((req, res, next) => {
    req.requestId = String(req.get("x-request-id") || randomUUID8()).slice(0, 160);
    res.setHeader("x-request-id", req.requestId);
    res.setHeader("x-bali-environment", config2.environment);
    next();
  });
  app2.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'"],
        frameAncestors: ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false
  }));
  app2.use(express2.json({ limit: "256kb" }));
  app2.use(cookieParser());
  app2.use(optionalUser(db2, config2));
  app2.use(optionalAdmin(db2, config2));
  app2.use("/api/v1", (_req, res, next) => {
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("Pragma", "no-cache");
    next();
  });
  app2.get("/api/v1/health", (_req, res) => {
    res.json({ ok: true, environment: config2.environment });
  });
  app2.get("/api/v1/config/public", (_req, res) => {
    res.json({
      environment: config2.environment,
      demoAvailable: !["production", "staging"].includes(config2.environment),
      authentication: "mobile-password"
    });
  });
  app2.use("/api/v1/auth", createAuthRouter(db2, config2));
  app2.use("/api/v1/auth", createMobileAuthRouter(db2, config2));
  app2.use("/api/v1/clans", createClanRouter(db2));
  app2.use("/api/v1/people", createPeopleRouter(db2));
  app2.use("/api/v1/events", createEventsRouter(db2));
  app2.use("/api/v1/layouts", createLayoutsRouter(db2));
  app2.use("/api/v1/bookings", createBookingsRouter(db2));
  app2.use("/api/v1/catalog", createCatalogRouter(db2));
  app2.use("/api/v1/economy", createEconomyRouter(db2));
  app2.use("/api/v1/game", createGameRouter(db2));
  app2.use("/api/v1/notifications", createNotificationsRouter(db2));
  app2.use("/api/v1/platform-config", createPlatformConfigRouter(db2));
  app2.use("/api/v1/social", createSocialRouter(db2));
  app2.use("/api/v1/admin", createAdminRouter(db2));
  app2.use("/api/v1/admin", createAdminPlatformRouter(db2));
  app2.use("/api/v1/admin", createAdminEconomyRouter(db2));
  app2.use("/api/v1/admin", createAdminContentRouter(db2, uploadDirectory));
  app2.use("/api/v1/admin", createAdminCrmRouter(db2));
  app2.use("/api/v1/admin", createAdminOperationsRouter(db2));
  app2.use("/api/v1/admin", createAdminMobileAccessRouter(db2));
  app2.use("/site", express2.static(siteDirectory, {
    etag: true,
    maxAge: config2.environment === "production" ? "1h" : 0,
    index: false
  }));
  app2.use("/uploads", express2.static(uploadDirectory, {
    etag: true,
    immutable: config2.environment === "production",
    maxAge: config2.environment === "production" ? "1y" : 0,
    index: false,
    fallthrough: false
  }));
  app2.get("/app", (_req, res) => {
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.sendFile(path2.join(siteDirectory, "app-production.html"));
  });
  app2.get("/admin", (_req, res) => {
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.sendFile(path2.join(siteDirectory, "admin-production.html"));
  });
  if (!["production", "staging"].includes(config2.environment)) {
    app2.get("/demo", (_req, res) => {
      res.sendFile(path2.join(siteDirectory, "index.html"));
    });
  }
  app2.get("/", (_req, res) => {
    res.redirect(config2.environment === "production" ? "/app" : "/demo");
  });
  app2.use(notFoundHandler);
  app2.use(errorHandler);
  return app2;
}

// server/config.ts
var ENVIRONMENTS = /* @__PURE__ */ new Set([
  "demo",
  "development",
  "staging",
  "production",
  "test"
]);
function integer2(value, fallback) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
function loadConfig(env = process.env) {
  const requested = env.BALI_ENV || env.NODE_ENV || "development";
  const environment = ENVIRONMENTS.has(requested) ? requested : "development";
  const productionLike = environment === "production" || environment === "staging";
  const config2 = {
    environment,
    port: integer2(env.PORT, 8080),
    databaseUrl: env.DATABASE_URL || "",
    telegramBotToken: env.TELEGRAM_BOT_TOKEN || "",
    telegramBotUrl: env.TELEGRAM_BOT_URL || "",
    sessionSecret: env.SESSION_SECRET || "",
    sessionTtlSeconds: integer2(env.SESSION_TTL_SECONDS, 30 * 24 * 60 * 60),
    telegramAuthMaxAgeSeconds: integer2(env.TELEGRAM_AUTH_MAX_AGE_SECONDS, 300),
    adminBootstrapEmail: (env.ADMIN_BOOTSTRAP_EMAIL || "").trim().toLowerCase(),
    adminBootstrapPassword: env.ADMIN_BOOTSTRAP_PASSWORD || "",
    trustProxy: env.TRUST_PROXY === "1",
    secureCookies: productionLike
  };
  if (productionLike) {
    const missing = [
      !config2.databaseUrl && "DATABASE_URL",
      config2.sessionSecret.length < 32 && "SESSION_SECRET (minimum 32 characters)"
    ].filter(Boolean);
    if (missing.length) throw new Error(`Missing production configuration: ${missing.join(", ")}`);
  }
  return config2;
}

// api/index.ts
var config = loadConfig();
var db = createPool(config.databaseUrl);
var app = createApp(db, config);
var initialization = null;
async function initialize() {
  if (!initialization) {
    initialization = (async () => {
      await db.query("select 1");
      if (!config.adminBootstrapEmail || !config.adminBootstrapPassword) return;
      const existing = await one(db, "select id from public.admin_users where email = $1", [
        config.adminBootstrapEmail
      ]);
      if (existing) return;
      const passwordHash = await hashPassword(config.adminBootstrapPassword);
      await db.query(
        `insert into public.admin_users(email, password_hash, role)
         values ($1,$2,'superadmin')
         on conflict (email) do nothing`,
        [config.adminBootstrapEmail, passwordHash]
      );
    })();
  }
  return initialization;
}
async function handler(req, res) {
  try {
    await initialize();
    return app(req, res);
  } catch (error) {
    console.error("BALI Vercel initialization failed", error);
    if (!res.headersSent) {
      return res.status(503).json({
        error: "service_unavailable",
        message: "BALI backend is not ready"
      });
    }
  }
}
export {
  handler as default
};
