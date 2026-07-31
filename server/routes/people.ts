import { Router } from "express";
import { many, one, transaction } from "../db.js";
import { ApiError, asyncHandler } from "../errors.js";
import { requireUser, USER_COOKIE } from "../middleware/auth.js";
import {
  PRIVACY_FIELDS,
  PRIVACY_MODES,
  visibleProfile,
  visibleProfiles
} from "../privacy.js";
import type { Queryable } from "../types.js";
import {
  booleanValue,
  boundedInteger,
  enumValue,
  identifier,
  isoDateOrNull,
  optionalText,
  requiredText,
  uniqueStrings
} from "../validation.js";

export function createPeopleRouter(db: Queryable): Router {
  const router = Router();
  router.use(requireUser);

  router.get("/", asyncHandler(async (req, res) => {
    const limit = boundedInteger(req.query.limit, 30, 1, 100);
    const query = String(req.query.search || "").trim();
    const rows = await many<any>(
      db,
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
      [req.userPrincipal!.userKey, query, limit]
    );
    const profiles = await visibleProfiles(
      db,
      req.userPrincipal!.userKey,
      rows.map(row => row.user_key)
    );
    res.json({ people: profiles });
  }));

  router.get("/me", asyncHandler(async (req, res) => {
    const [profile, details, consents, clans, upcomingEvent] = await Promise.all([
      visibleProfile(db, req.userPrincipal!.userKey, req.userPrincipal!.userKey),
      one<any>(
        db,
        `select * from public.user_profiles where user_key = $1`,
        [req.userPrincipal!.userKey]
      ),
      one<any>(
        db,
        `select * from public.user_consents where user_key = $1`,
        [req.userPrincipal!.userKey]
      ),
      many<any>(
        db,
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
        [req.userPrincipal!.userKey]
      ),
      one<any>(
        db,
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
        [req.userPrincipal!.userKey]
      )
    ]);
    res.json({ profile: { ...profile, details, clans, upcomingEvent }, consents });
  }));

  router.patch("/me", asyncHandler(async (req, res) => {
    const current = await one<any>(
      db,
      `select profile.*, user_row.name
         from public.user_profiles profile
         join public.app_users user_row on user_row.user_key = profile.user_key
        where profile.user_key = $1`,
      [req.userPrincipal!.userKey]
    );
    if (!current) throw new ApiError(404, "BALI profile was not found", "not_found");
    const displayName = req.body?.displayName === undefined
      ? current.display_name || current.name
      : requiredText(req.body.displayName, "displayName", 120);
    const statusText = req.body?.statusText === undefined
      ? current.status_text
      : optionalText(req.body.statusText, 80);
    const bio = req.body?.bio === undefined ? current.bio : optionalText(req.body.bio, 1000);
    const interests = req.body?.interests === undefined
      ? current.interests || []
      : uniqueStrings(req.body.interests, "interests", 0, 30, 80);
    const gender = req.body?.gender === undefined
      ? current.gender
      : enumValue(req.body.gender, "gender", ["female", "male", "unspecified"] as const);
    const birthDate = req.body?.birthDate === undefined
      ? current.birth_date
      : isoDateOrNull(req.body.birthDate)?.slice(0, 10) || null;
    const avatarUrl = req.body?.avatarUrl === undefined
      ? current.avatar_url
      : optionalText(req.body.avatarUrl, 2000);
    const phone = req.body?.phone === undefined ? current.phone : optionalText(req.body.phone, 80);
    const discoverable = req.body?.discoverable === undefined
      ? current.discoverable
      : booleanValue(req.body.discoverable);
    const allowConnections = req.body?.allowConnections === undefined
      ? current.allow_connections
      : booleanValue(req.body.allowConnections);
    const allowEventInvites = req.body?.allowEventInvites === undefined
      ? current.allow_event_invites
      : booleanValue(req.body.allowEventInvites);
    const allowGifts = req.body?.allowGifts === undefined
      ? current.allow_gifts
      : booleanValue(req.body.allowGifts);
    const updated = await one<any>(
      db,
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
        req.userPrincipal!.userKey,
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
    await db.query(
      `update public.app_users
          set name = $2,
              birth_date = $3,
              avatar = $4,
              phone = $5,
              updated_at = now()
        where user_key = $1`,
      [req.userPrincipal!.userKey, displayName, birthDate, avatarUrl, phone]
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
    const consents = await one<any>(
      db,
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
      [req.userPrincipal!.userKey, termsVersion, privacyVersion, marketingOptIn]
    );
    await db.query(
      `insert into public.notification_preferences(user_key, marketing_enabled)
       values ($1,$2)
       on conflict (user_key) do update
         set marketing_enabled = excluded.marketing_enabled,
             updated_at = now()`,
      [req.userPrincipal!.userKey, marketingOptIn]
    );
    res.json({ consents });
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

  router.get("/me/export", asyncHandler(async (req, res) => {
    const userKey = req.userPrincipal!.userKey;
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
      one<any>(db, `select * from public.app_users where user_key = $1`, [userKey]),
      one<any>(db, `select * from public.user_profiles where user_key = $1`, [userKey]),
      one<any>(db, `select * from public.user_consents where user_key = $1`, [userKey]),
      many<any>(db, `select * from public.clan_memberships where user_key = $1 order by created_at`, [userKey]),
      many<any>(db, `select * from public.event_attendance where user_key = $1 order by created_at`, [userKey]),
      many<any>(db, `select * from public.booking_records where user_key = $1 order by created_at`, [userKey]),
      many<any>(db, `select * from public.point_ledger where user_key = $1 order by created_at`, [userKey]),
      many<any>(db, `select * from public.user_rewards where user_key = $1 order by granted_at`, [userKey]),
      many<any>(
        db,
        `select * from public.gifts
          where sender_user_key = $1 or recipient_user_key = $1
          order by created_at`,
        [userKey]
      ),
      many<any>(db, `select * from public.user_vip_subscriptions where user_key = $1 order by created_at`, [userKey]),
      many<any>(db, `select * from public.shop_orders where user_key = $1 order by created_at`, [userKey]),
      many<any>(db, `select * from public.game_sessions where user_key = $1 order by started_at`, [userKey]),
      many<any>(
        db,
        `select * from public.user_connections
          where requester_user_key = $1 or recipient_user_key = $1
          order by created_at`,
        [userKey]
      ),
      many<any>(db, `select * from public.direct_messages where sender_user_key = $1 order by created_at`, [userKey]),
      many<any>(
        db,
        `select * from public.user_reports
          where reporter_user_key = $1 or reported_user_key = $1
          order by created_at`,
        [userKey]
      ),
      many<any>(db, `select * from public.notifications where user_key = $1 order by created_at`, [userKey])
    ]);
    res.setHeader("Content-Disposition", `attachment; filename="bali-data-${encodeURIComponent(userKey)}.json"`);
    res.json({
      exportedAt: new Date().toISOString(),
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
    const reason = optionalText(req.body?.reason, 1000);
    const userKey = req.userPrincipal!.userKey;
    const deletion = await transaction(db, async client => {
      const account = await one<any>(
        client,
        `select user_key, telegram_id, name, username, phone, account_status
           from public.app_users where user_key = $1 for update`,
        [userKey]
      );
      if (!account) throw new ApiError(404, "BALI account was not found", "not_found");
      if (account.account_status === "deleted") {
        throw new ApiError(409, "BALI account has already been deleted", "account_already_deleted");
      }
      const ledClan = await one<any>(
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
      const request = await one<any>(
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
                name = 'Удалённый пользователь',
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
            set display_name = 'Удалённый пользователь',
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
            set phone = '', first_name = 'Удалённый пользователь',
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
            set customer_name = 'Удалённый пользователь',
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
    res.json({ profile: await visibleProfile(db, req.userPrincipal!.userKey, userKey) });
  }));

  return router;
}
