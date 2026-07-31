alter table public.clans
  alter column clan_type drop default;

update public.clans
   set clan_type = case
     when lower(clan_type) in ('corporate', 'vip') then 'corporate'
     else 'user'
   end;

alter table public.clans
  alter column clan_type set default 'user';

alter table public.clans
  drop constraint if exists clans_clan_type_category;

alter table public.clans
  add constraint clans_clan_type_category
  check (clan_type in ('user', 'corporate'));

alter table public.clans
  drop constraint if exists clans_id_type_unique;

alter table public.clans
  add constraint clans_id_type_unique unique (id, clan_type);

alter table public.clan_memberships
  add column if not exists clan_type text;

update public.clan_memberships membership
   set clan_type = clan.clan_type
  from public.clans clan
 where clan.id = membership.clan_id;

insert into public.clan_chat_audit_log(
  actor_type, actor_id, action, target_type, target_id, clan_id, chat_id,
  request_id, reason, before_value, after_value
)
select
  'system',
  'migration-003',
  'membership.category.deduplicate',
  'membership',
  duplicate.id::text,
  duplicate.clan_id,
  chat.id,
  'migration:003:' || duplicate.id::text,
  'Оставлено одно активное членство пользователя в каждой категории кланов',
  jsonb_build_object('status', duplicate.status, 'clanType', duplicate.clan_type),
  jsonb_build_object('status', 'left', 'clanType', duplicate.clan_type)
from (
  select membership.*,
         row_number() over (
           partition by membership.user_key, membership.clan_type
           order by membership.joined_at desc, membership.id desc
         ) as category_position
    from public.clan_memberships membership
   where membership.status = 'active'
) duplicate
left join public.clan_chats chat on chat.clan_id = duplicate.clan_id
where duplicate.category_position > 1;

with duplicate_memberships as (
  select id,
         row_number() over (
           partition by user_key, clan_type
           order by joined_at desc, id desc
         ) as category_position
    from public.clan_memberships
   where status = 'active'
)
update public.clan_memberships membership
   set status = 'left',
       ended_at = coalesce(membership.ended_at, now()),
       updated_at = now()
  from duplicate_memberships duplicate
 where duplicate.id = membership.id
   and duplicate.category_position > 1;

alter table public.clan_memberships
  alter column clan_type set default 'user',
  alter column clan_type set not null;

alter table public.clan_memberships
  drop constraint if exists clan_memberships_clan_type_category;

alter table public.clan_memberships
  add constraint clan_memberships_clan_type_category
  check (clan_type in ('user', 'corporate'));

alter table public.clan_memberships
  drop constraint if exists clan_memberships_clan_type_fk;

alter table public.clan_memberships
  add constraint clan_memberships_clan_type_fk
  foreign key (clan_id, clan_type)
  references public.clans(id, clan_type)
  on update cascade
  on delete cascade;

create or replace function public.bali_set_membership_clan_type()
returns trigger
language plpgsql
as $$
begin
  select clan_type
    into new.clan_type
    from public.clans
   where id = new.clan_id;
  if new.clan_type is null then
    raise exception 'Clan % was not found', new.clan_id;
  end if;
  return new;
end;
$$;

drop trigger if exists bali_set_membership_clan_type on public.clan_memberships;
create trigger bali_set_membership_clan_type
before insert or update of clan_id
on public.clan_memberships
for each row execute function public.bali_set_membership_clan_type();

create unique index if not exists clan_memberships_one_active_category
  on public.clan_memberships(user_key, clan_type)
  where status = 'active';

create index if not exists clans_category_rating_idx
  on public.clans(clan_type, status, rating_points desc, name);
