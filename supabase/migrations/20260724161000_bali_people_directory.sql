begin;

do $$
begin
  if to_regclass('public.app_users') is null then
    raise exception 'public.app_users is required before creating bali_people_directory';
  end if;

  if to_regclass('public.social_profiles') is not null then
    execute $view$
      create or replace view public.bali_people_directory as
      select
        au.user_key::text as user_key,
        au.telegram_id::bigint as telegram_id,
        coalesce(nullif(sp.name, ''), nullif(au.name, ''), 'Гость BALI')::text as name,
        case
          when coalesce(sp.share_telegram, false)
            then coalesce(nullif(sp.username, ''), nullif(au.username, ''), '')
          else ''
        end::text as username,
        coalesce(nullif(sp.photo, ''), nullif(au.avatar, ''), '')::text as photo,
        coalesce(sp.crop_x, 50)::double precision as crop_x,
        coalesce(sp.crop_y, 40)::double precision as crop_y,
        case when coalesce(sp.status, 'chat') = 'closed' then 'chat' else coalesce(sp.status, 'chat') end::text as status,
        coalesce(nullif(sp.bio, ''), 'Пользователь BALI')::text as bio,
        coalesce(sp.active, au.active, true)::boolean as active,
        coalesce(sp.active, true)::boolean as profile_active,
        coalesce(sp.share_telegram, false)::boolean as share_telegram,
        coalesce(nullif(sp.gender, ''), nullif(au.gender, ''), 'unspecified')::text as gender,
        coalesce(sp.updated_at, au.updated_at, au.last_seen_at, now())::timestamptz as updated_at,
        coalesce(sp.created_at, au.created_at, au.first_seen_at, now())::timestamptz as created_at
      from public.app_users au
      left join public.social_profiles sp on sp.user_key = au.user_key
      where coalesce(sp.active, au.active, true) = true
    $view$;
  else
    execute $view$
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
      where coalesce(au.active, true) = true
    $view$;
  end if;
end $$;

revoke all on public.bali_people_directory from public;
grant select on public.bali_people_directory to anon, authenticated, service_role;
comment on view public.bali_people_directory is 'Privacy-safe public directory for BALI People. It excludes phone, birth date, balance and private Telegram usernames.';

commit;

notify pgrst, 'reload schema';