import type { Request } from "express";
import type { Queryable } from "./types.js";
import { one } from "./db.js";
import { ApiError } from "./errors.js";

const DEFAULTS: Record<string, { limit: number; windowSeconds: number }> = {
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
  "notification.broadcast": { limit: 3, windowSeconds: 3600 }
};

export function requestSubject(req: Request, suffix = ""): string {
  const principal = req.userPrincipal?.userKey || req.adminPrincipal?.adminId || req.ip || "unknown";
  return suffix ? `${principal}:${suffix}` : principal;
}

export async function enforceRateLimit(
  db: Queryable,
  req: Request,
  bucket: string,
  subjectKey: string,
  cost = 1
): Promise<void> {
  const stored = await one<any>(
    db,
    `select limit_count, window_seconds, enabled
       from public.rate_limit_settings where bucket = $1`,
    [bucket]
  );
  const fallback = DEFAULTS[bucket] || { limit: 30, windowSeconds: 60 };
  const limit = Number(stored?.limit_count || fallback.limit);
  const windowSeconds = Number(stored?.window_seconds || fallback.windowSeconds);
  if (stored?.enabled === false) return;

  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const requestCost = Math.max(1, Math.min(1000, Math.floor(cost)));
  const start = new Date(Math.floor(now / windowMs) * windowMs);
  const expires = new Date(start.getTime() + windowMs);
  const row = await one<any>(
    db,
    `insert into public.rate_limit_buckets(
       bucket, subject_key, window_started_at, request_count, expires_at
     ) values ($1, $2, $3, $4, $5)
     on conflict (bucket, subject_key, window_started_at)
     do update set request_count = public.rate_limit_buckets.request_count + excluded.request_count
     returning request_count`,
    [bucket, subjectKey, start.toISOString(), requestCost, expires.toISOString()]
  );

  if (Number(row?.request_count || 1) > limit) {
    const retryAfter = Math.max(1, Math.ceil((expires.getTime() - now) / 1000));
    throw new ApiError(429, "Too many requests", "rate_limit_exceeded", {
      bucket,
      retryAfter,
      requestId: req.requestId
    });
  }
}
