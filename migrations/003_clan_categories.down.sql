drop index if exists public.clans_category_rating_idx;
drop index if exists public.clan_memberships_one_active_category;

drop trigger if exists bali_set_membership_clan_type on public.clan_memberships;
drop function if exists public.bali_set_membership_clan_type();

alter table public.clan_memberships
  drop constraint if exists clan_memberships_clan_type_fk;

alter table public.clan_memberships
  drop constraint if exists clan_memberships_clan_type_category;

alter table public.clan_memberships
  drop column if exists clan_type;

alter table public.clans
  drop constraint if exists clans_id_type_unique;

alter table public.clans
  drop constraint if exists clans_clan_type_category;

update public.clans
   set clan_type = case
     when clan_type = 'corporate' then 'vip'
     else 'community'
   end;

alter table public.clans
  alter column clan_type set default 'community';
