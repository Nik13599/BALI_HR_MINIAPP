begin;

do $$
begin
  if to_regclass('public.app_users') is null then
    raise exception 'public.app_users is required before creating bali_people_directory';
  end if;
end $$;

create or replace view public.bali_people_directory as
select
  au.user_key::text as user_key,
  au.telegram_id::bigint as telegram_id,
  coalesce(nullif(au.name, ''), 'Гость BALI')::text as name,
  ''::text as username,
  coalesce(nullif(au.avatar, ''), '')::text as photo,
  50::double precision as crop_x,
  40::double precision as crop_y,
  'chat'::text as status,
  'Пользователь BALI'::text as bio,
  coalesce(au.active, true)::boolean as active,
  true::boolean as profile_active,
  false::boolean as share_telegram,
  coalesce(nullif(au.gender, ''), 'unspecified')::text as gender,
  coalesce(au.updated_at, au.last_seen_at, now())::timestamptz as updated_at,
  coalesce(au.created_at, au.first_seen_at, now())::timestamptz as created_at
from public.app_users au
where coalesce(au.active, true) = true;

revoke all on public.bali_people_directory from public;
grant select on public.bali_people_directory to anon, authenticated, service_role;
comment on view public.bali_people_directory is 'Privacy-safe fallback directory for BALI People. Extended profile data is served by the Telegram-authenticated Edge Function.';

commit;

notify pgrst, 'reload schema';