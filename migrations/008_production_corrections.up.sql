alter table public.game_settings
  add column if not exists symbols jsonb not null default
    '[
      {"key":"headphones","label":"Наушники","imageUrl":"","defaultImageUrl":"","active":true,"weight":1},
      {"key":"cocktail","label":"Коктейль","imageUrl":"","defaultImageUrl":"","active":true,"weight":1},
      {"key":"palm","label":"Пальма","imageUrl":"","defaultImageUrl":"","active":true,"weight":1},
      {"key":"turntable","label":"Винил","imageUrl":"","defaultImageUrl":"","active":true,"weight":1},
      {"key":"disco","label":"Диско-шар","imageUrl":"","defaultImageUrl":"","active":true,"weight":1},
      {"key":"mask","label":"Маска","imageUrl":"","defaultImageUrl":"","active":true,"weight":1},
      {"key":"lotus","label":"Лотос","imageUrl":"","defaultImageUrl":"","active":true,"weight":1}
    ]'::jsonb,
  add column if not exists default_prizes jsonb not null default
    '[
      {"position":1,"points":5000,"rewardIds":[],"vipPlanId":"","vipDays":30},
      {"position":2,"points":3000,"rewardIds":[],"vipPlanId":"","vipDays":14},
      {"position":3,"points":2000,"rewardIds":[],"vipPlanId":"","vipDays":7},
      {"position":4,"points":1000,"rewardIds":[],"vipPlanId":"","vipDays":0},
      {"position":5,"points":1000,"rewardIds":[],"vipPlanId":"","vipDays":0},
      {"position":6,"points":500,"rewardIds":[],"vipPlanId":"","vipDays":0},
      {"position":7,"points":500,"rewardIds":[],"vipPlanId":"","vipDays":0},
      {"position":8,"points":500,"rewardIds":[],"vipPlanId":"","vipDays":0},
      {"position":9,"points":500,"rewardIds":[],"vipPlanId":"","vipDays":0},
      {"position":10,"points":500,"rewardIds":[],"vipPlanId":"","vipDays":0}
    ]'::jsonb;

update public.game_seasons
   set rewards = settings.default_prizes,
       updated_at = now()
  from public.game_settings settings
 where settings.singleton = true
   and game_seasons.rewards = '[]'::jsonb;

drop index if exists public.clan_memberships_one_active_category;

with affected_memberships as (
  select membership.*,
         row_number() over (
           partition by membership.user_key, membership.clan_type
           order by
             case membership.role
               when 'leader' then 1
               when 'deputy' then 2
               when 'moderator' then 3
               else 4
             end,
             membership.joined_at desc,
             membership.id desc
         ) as preferred_position
    from public.clan_memberships membership
   where membership.status = 'active'
      or exists (
        select 1
          from public.clan_chat_audit_log audit
         where audit.actor_type = 'system'
           and audit.actor_id = 'migration-003'
           and audit.action = 'membership.category.deduplicate'
           and audit.target_id = membership.id::text
      )
),
conflicted_groups as (
  select user_key, clan_type
    from affected_memberships
   group by user_key, clan_type
  having count(*) > 1
)
update public.clan_memberships membership
   set status = case when affected.preferred_position = 1 then 'active' else 'left' end,
       ended_at = case when affected.preferred_position = 1 then null else coalesce(membership.ended_at, now()) end,
       updated_at = now()
  from affected_memberships affected
  join conflicted_groups conflicted
    on conflicted.user_key = affected.user_key
   and conflicted.clan_type = affected.clan_type
 where membership.id = affected.id;

create unique index if not exists clan_memberships_one_active_category
  on public.clan_memberships(user_key, clan_type)
  where status = 'active';

insert into public.clan_chat_audit_log(
  actor_type, actor_id, action, target_type, target_id, clan_id, chat_id,
  request_id, reason, after_value
)
select
  'system',
  'migration-008',
  'membership.category.priority_corrected',
  'membership',
  membership.id::text,
  membership.clan_id,
  chat.id,
  'migration:008:' || membership.id::text,
  'Исправлен приоритет дедупликации: leader > deputy > moderator > member > latest',
  jsonb_build_object(
    'status', membership.status,
    'role', membership.role,
    'clanType', membership.clan_type
  )
from public.clan_memberships membership
left join public.clan_chats chat on chat.clan_id = membership.clan_id
where exists (
  select 1
    from public.clan_chat_audit_log previous
   where previous.actor_type = 'system'
     and previous.actor_id = 'migration-003'
     and previous.action = 'membership.category.deduplicate'
     and previous.target_id = membership.id::text
)
and not exists (
  select 1
    from public.clan_chat_audit_log current_audit
   where current_audit.request_id = 'migration:008:' || membership.id::text
);

create table if not exists public.admin_assets (
  id uuid primary key default gen_random_uuid(),
  asset_key text not null unique,
  name text not null,
  url text not null,
  default_url text not null default '',
  media_type text not null default 'image'
    check (media_type in ('image', 'video', 'audio', 'icon')),
  mime_type text not null default '',
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  recommended_width integer check (recommended_width is null or recommended_width > 0),
  recommended_height integer check (recommended_height is null or recommended_height > 0),
  max_bytes integer check (max_bytes is null or max_bytes > 0),
  alt_text text not null default '',
  updated_by_admin_id uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ui_content_blocks (
  id uuid primary key default gen_random_uuid(),
  scope text not null
    check (scope in ('app', 'admin', 'shared', 'game')),
  block_key text not null,
  name text not null,
  title text not null default '',
  subtitle text not null default '',
  asset_key text references public.admin_assets(asset_key) on update cascade on delete set null,
  configuration jsonb not null default '{}'::jsonb,
  default_value jsonb not null default '{}'::jsonb,
  recommended_width integer check (recommended_width is null or recommended_width > 0),
  recommended_height integer check (recommended_height is null or recommended_height > 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  updated_by_admin_id uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scope, block_key)
);

create table if not exists public.ui_navigation_items (
  id uuid primary key default gen_random_uuid(),
  app_type text not null check (app_type in ('app', 'admin')),
  item_key text not null,
  label text not null,
  route text not null,
  icon_url text not null default '',
  default_icon_url text not null default '',
  recommended_width integer not null default 64 check (recommended_width > 0),
  recommended_height integer not null default 64 check (recommended_height > 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  updated_by_admin_id uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (app_type, item_key)
);

insert into public.ui_navigation_items(
  app_type, item_key, label, route, recommended_width, recommended_height, sort_order
)
values
  ('app','home','Главная','home',64,64,10),
  ('app','events','Афиша','events',64,64,20),
  ('app','vip','VIP','vip',64,64,30),
  ('app','rewards','Награды','rewards',64,64,40),
  ('app','profile','Профиль','profile',64,64,50)
on conflict (app_type, item_key) do nothing;

alter table public.admin_assets enable row level security;
alter table public.ui_content_blocks enable row level security;
alter table public.ui_navigation_items enable row level security;
