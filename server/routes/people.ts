import { Router } from "express";
import { many, one } from "../db.js";
import { ApiError, asyncHandler } from "../errors.js";
import { requireUser } from "../middleware/auth.js";
import {
  PRIVACY_FIELDS,
  PRIVACY_MODES,
  visibleProfile
} from "../privacy.js";
import type { Queryable } from "../types.js";
import { boundedInteger, identifier } from "../validation.js";

export function createPeopleRouter(db: Queryable): Router {
  const router = Router();
  router.use(requireUser);

  router.get("/", asyncHandler(async (req, res) => {
    const limit = boundedInteger(req.query.limit, 30, 1, 100);
    const query = String(req.query.search || "").trim();
    const rows = await many<any>(
      db,
      `select user_key from public.app_users
        where account_status = 'active' and user_key <> $1
          and ($2 = '' or lower(name) like '%' || lower($2) || '%')
        order by last_seen_at desc limit $3`,
      [req.userPrincipal!.userKey, query, limit]
    );
    const profiles = [];
    for (const row of rows) {
      profiles.push(await visibleProfile(db, req.userPrincipal!.userKey, row.user_key));
    }
    res.json({ people: profiles });
  }));

  router.get("/me", asyncHandler(async (req, res) => {
    res.json({ profile: await visibleProfile(db, req.userPrincipal!.userKey, req.userPrincipal!.userKey) });
  }));

  router.patch("/me/privacy", asyncHandler(async (req, res) => {
    const current = await one<any>(
      db,
      `select profile_privacy from public.app_users where user_key = $1`,
      [req.userPrincipal!.userKey]
    );
    if (!current) throw new ApiError(404, "BALI profile was not found", "not_found");
    const next = { ...(current.profile_privacy || {}) };
    for (const field of PRIVACY_FIELDS) {
      if (req.body?.[field] === undefined) continue;
      const mode = String(req.body[field]);
      if (!PRIVACY_MODES.has(mode)) {
        throw new ApiError(400, `Invalid privacy mode for ${field}`, "validation_error");
      }
      next[field] = mode;
    }
    await db.query(
      `update public.app_users set profile_privacy = $1::jsonb where user_key = $2`,
      [JSON.stringify(next), req.userPrincipal!.userKey]
    );
    res.json({ privacy: next });
  }));

  router.get("/:userKey", asyncHandler(async (req, res) => {
    const userKey = identifier(req.params.userKey, "userKey");
    res.json({ profile: await visibleProfile(db, req.userPrincipal!.userKey, userKey) });
  }));

  return router;
}
