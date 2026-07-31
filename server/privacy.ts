import { many, one } from "./db.js";
import { ApiError } from "./errors.js";
import type { Queryable } from "./types.js";

export const PRIVACY_MODES = new Set(["public", "clan", "private"]);
export const PRIVACY_FIELDS = [
  "avatar",
  "username",
  "phone",
  "birth_date",
  "status",
  "events",
  "clan"
] as const;
export type PrivacyField = typeof PRIVACY_FIELDS[number];
export type PrivacyMode = "public" | "clan" | "private";

function modeFor(privacy: Record<string, unknown> | null, field: PrivacyField): PrivacyMode {
  const defaultMode = ["avatar", "status", "clan"].includes(field)
    ? "public"
    : field === "events" ? "clan" : "private";
  const value = String(privacy?.[field] || defaultMode);
  return PRIVACY_MODES.has(value) ? value as PrivacyMode : "private";
}

export async function visibleProfile(
  db: Queryable,
  viewerUserKey: string,
  targetUserKey: string
): Promise<Record<string, unknown>> {
  const target = await one<any>(
    db,
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
  const viewer = ownProfile ? target : await one<any>(
    db,
    `select user_key from public.app_users
      where user_key = $1 and account_status = 'active'`,
    [viewerUserKey]
  );
  if (!viewer) throw new ApiError(401, "Viewer account is unavailable", "authentication_required");
  const [pairLow, pairHigh] = viewerUserKey < targetUserKey
    ? [viewerUserKey, targetUserKey]
    : [targetUserKey, viewerUserKey];
  const sharedClan = ownProfile ? true : Boolean(await one<any>(
    db,
    `select 1
       from public.clan_memberships mine
       join public.clan_memberships theirs on theirs.clan_id = mine.clan_id
      where mine.user_key = $1 and theirs.user_key = $2
        and mine.status = 'active' and theirs.status = 'active'
      limit 1`,
    [viewerUserKey, targetUserKey]
  ));
  const acceptedConnection = ownProfile ? true : Boolean(await one<any>(
    db,
    `select 1
       from public.user_connections connection
      where connection.pair_low = $1
        and connection.pair_high = $2
        and connection.status = 'accepted'
      limit 1`,
    [pairLow, pairHigh]
  ));
  const blocked = ownProfile ? false : Boolean(await one<any>(
    db,
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

  const canSee = (field: PrivacyField): boolean => {
    if (ownProfile) return true;
    const mode = modeFor(target.profile_privacy, field);
    if (mode === "public") return true;
    if (mode === "clan") return sharedClan;
    return false;
  };

  const result: Record<string, unknown> = {
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
    privacy: ownProfile ? target.profile_privacy : undefined
  };
  if (canSee("avatar") && target.avatar) result.avatar = target.avatar;
  if (canSee("username") && target.username) result.username = target.username;
  if (canSee("phone") && target.phone) result.phone = target.phone;
  if (canSee("birth_date") && target.birth_date) result.birthDate = target.birth_date;
  if (canSee("status") && target.status_text) result.status = target.status_text;
  if (canSee("clan")) {
    result.clans = await (async () => {
      const rows = await db.query<any>(
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
    result.upcomingEvent = await one<any>(
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
      [targetUserKey]
    );
  }
  return result;
}

export async function visibleProfiles(
  db: Queryable,
  viewerUserKey: string,
  targetUserKeys: string[]
): Promise<Record<string, unknown>[]> {
  const uniqueTargets = [...new Set(targetUserKeys)].filter(Boolean).slice(0, 100);
  if (!uniqueTargets.length) return [];
  const viewer = await one<any>(
    db,
    `select user_key from public.app_users
      where user_key = $1 and account_status = 'active'`,
    [viewerUserKey]
  );
  if (!viewer) throw new ApiError(401, "Viewer account is unavailable", "authentication_required");
  const [targets, sharedRows, connectionRows, blockedRows, clanRows, eventRows] = await Promise.all([
    many<any>(
      db,
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
    many<any>(
      db,
      `select distinct theirs.user_key as target_user_key
         from public.clan_memberships mine
         join public.clan_memberships theirs on theirs.clan_id = mine.clan_id
        where mine.user_key = $1
          and theirs.user_key = any($2::text[])
          and mine.status = 'active' and theirs.status = 'active'`,
      [viewerUserKey, uniqueTargets]
    ),
    many<any>(
      db,
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
    many<any>(
      db,
      `select case
                when blocker_user_key = $1 then blocked_user_key
                else blocker_user_key
              end as target_user_key
         from public.user_blocks
        where (blocker_user_key = $1 and blocked_user_key = any($2::text[]))
           or (blocked_user_key = $1 and blocker_user_key = any($2::text[]))`,
      [viewerUserKey, uniqueTargets]
    ),
    many<any>(
      db,
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
    many<any>(
      db,
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
  const shared = new Set(sharedRows.map(row => row.target_user_key));
  const accepted = new Set(connectionRows.map(row => row.target_user_key));
  const blocked = new Set(blockedRows.map(row => row.target_user_key));
  const clans = new Map<string, any[]>();
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
  const events = new Map(eventRows.map(row => [row.target_user_key, {
    id: row.id,
    title: row.title,
    event_date: row.event_date,
    event_time: row.event_time,
    status: row.status
  }]));
  const targetByKey = new Map(targets.map(target => [target.user_key, target]));
  const output: Record<string, unknown>[] = [];
  for (const userKey of uniqueTargets) {
    const target = targetByKey.get(userKey);
    if (!target || blocked.has(userKey)) continue;
    const isShared = shared.has(userKey);
    if (!target.discoverable && !isShared && !accepted.has(userKey)) continue;
    const canSee = (field: PrivacyField): boolean => {
      const mode = modeFor(target.profile_privacy, field);
      return mode === "public" || (mode === "clan" && isShared);
    };
    const result: Record<string, unknown> = {
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
