import { one } from "./db.js";
import { ApiError } from "./errors.js";
import type { Queryable } from "./types.js";

export const PRIVACY_MODES = new Set(["public", "clan", "vip", "private"]);
export const PRIVACY_FIELDS = ["avatar", "username", "phone", "birth_date"] as const;
export type PrivacyField = typeof PRIVACY_FIELDS[number];
export type PrivacyMode = "public" | "clan" | "vip" | "private";

function modeFor(privacy: Record<string, unknown> | null, field: PrivacyField): PrivacyMode {
  const value = String(privacy?.[field] || (field === "avatar" ? "public" : "private"));
  return PRIVACY_MODES.has(value) ? value as PrivacyMode : "private";
}

export async function visibleProfile(
  db: Queryable,
  viewerUserKey: string,
  targetUserKey: string
): Promise<Record<string, unknown>> {
  const target = await one<any>(
    db,
    `select user_key, name, username, phone, avatar, birth_date,
            profile_privacy, vip_expires_at, account_status
       from public.app_users where user_key = $1 and account_status = 'active'`,
    [targetUserKey]
  );
  if (!target) throw new ApiError(404, "BALI profile was not found", "not_found");
  const ownProfile = viewerUserKey === targetUserKey;
  const viewer = ownProfile ? target : await one<any>(
    db,
    `select vip_expires_at from public.app_users
      where user_key = $1 and account_status = 'active'`,
    [viewerUserKey]
  );
  if (!viewer) throw new ApiError(401, "Viewer account is unavailable", "authentication_required");
  const viewerHasVip = Boolean(
    viewer.vip_expires_at && new Date(viewer.vip_expires_at).getTime() > Date.now()
  );
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

  const canSee = (field: PrivacyField): boolean => {
    if (ownProfile) return true;
    const mode = modeFor(target.profile_privacy, field);
    if (mode === "public") return true;
    if (mode === "clan") return sharedClan;
    if (mode === "vip") return viewerHasVip;
    return false;
  };

  const result: Record<string, unknown> = {
    id: target.user_key,
    name: target.name,
    privacy: ownProfile ? target.profile_privacy : undefined
  };
  if (canSee("avatar") && target.avatar) result.avatar = target.avatar;
  if (canSee("username") && target.username) result.username = target.username;
  if (canSee("phone") && target.phone) result.phone = target.phone;
  if (canSee("birth_date") && target.birth_date) result.birthDate = target.birth_date;
  return result;
}
