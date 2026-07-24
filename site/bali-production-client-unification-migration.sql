-- BALI Minsk: unified customer base
-- Run once in Supabase SQL Editor after the production schema.
-- Safe to run repeatedly. Existing manual cards remain primary.

alter table public.customers add column if not exists user_key text;
alter table public.customers add column if not exists telegram_username text not null default '';
alter table public.customers add column if not exists avatar text not null default '';
alter table public.customers add column if not exists source text not null default 'manual';
alter table public.customers add column if not exists first_seen_at timestamptz;
alter table public.customers add column if not exists last_seen_at timestamptz;
alter table public.customers add column if not exists opens integer not null default 0;

-- Empty phones are valid for Telegram users who have not shared a phone yet.
alter table public.customers drop constraint if exists customers_phone_key;
drop index if exists public.customers_phone_normalized_unique;
create unique index customers_phone_normalized_unique
  on public.customers ((regexp_replace(phone, '\D', '', 'g')))
  where regexp_replace(phone, '\D', '', 'g') <> '';

drop index if exists public.customers_user_key_unique;
create unique index customers_user_key_unique on public.customers(user_key) where coalesce(user_key,'') <> '';
drop index if exists public.customers_telegram_id_unique;
create unique index customers_telegram_id_unique on public.customers(telegram_id) where telegram_id is not null;
drop index if exists public.customers_telegram_username_unique;
create unique index customers_telegram_username_unique
  on public.customers ((lower(regexp_replace(telegram_username, '^@', ''))))
  where regexp_replace(telegram_username, '^@', '') <> '';

create or replace function public.merge_customer_identity(
  p_id text default null,
  p_user_key text default null,
  p_telegram_id bigint default null,
  p_name text default null,
  p_username text default null,
  p_phone text default null,
  p_avatar text default null,
  p_notes text default null,
  p_visits integer default null,
  p_total_spent numeric default null,
  p_source text default 'telegram'
) returns public.customers
language plpgsql security definer set search_path=public as $$
declare
  v_phone text := regexp_replace(coalesce(p_phone,''), '\D', '', 'g');
  v_username text := lower(regexp_replace(trim(coalesce(p_username,'')), '^@', ''));
  v_target public.customers;
  v_duplicate_ids text[];
begin
  select c.* into v_target
  from public.customers c
  where (p_id is not null and c.id=p_id)
     or (coalesce(p_user_key,'')<>'' and c.user_key=p_user_key)
     or (p_telegram_id is not null and c.telegram_id=p_telegram_id)
     or (v_phone<>'' and regexp_replace(c.phone,'\D','','g')=v_phone)
     or (v_username<>'' and lower(regexp_replace(coalesce(nullif(c.telegram_username,''),c.telegram,''),'^@',''))=v_username)
  order by
    case when c.source='manual' then 0 else 1 end,
    case when p_id is not null and c.id=p_id then 0 else 1 end,
    case when v_phone<>'' and regexp_replace(c.phone,'\D','','g')=v_phone then 0 else 1 end,
    c.created_at asc
  limit 1;

  if v_target.id is null then
    insert into public.customers(
      id,name,phone,telegram,telegram_id,notes,visits,total_spent,
      user_key,telegram_username,avatar,source,first_seen_at,last_seen_at,opens
    ) values (
      coalesce(nullif(p_id,''),gen_random_uuid()::text),
      coalesce(nullif(trim(p_name),''),'Гость BALI'),
      v_phone,
      case when v_username<>'' then '@'||v_username else '' end,
      p_telegram_id,
      coalesce(p_notes,''),coalesce(p_visits,0),coalesce(p_total_spent,0),
      nullif(p_user_key,''),case when v_username<>'' then '@'||v_username else '' end,
      coalesce(p_avatar,''),coalesce(nullif(p_source,''),'telegram'),now(),now(),1
    ) returning * into v_target;
  else
    update public.customers c set
      user_key=coalesce(nullif(p_user_key,''),c.user_key),
      telegram_id=coalesce(p_telegram_id,c.telegram_id),
      name=case when nullif(trim(p_name),'') is not null then trim(p_name) else c.name end,
      phone=case when v_phone<>'' then v_phone else c.phone end,
      telegram=case when v_username<>'' then '@'||v_username else c.telegram end,
      telegram_username=case when v_username<>'' then '@'||v_username else c.telegram_username end,
      avatar=case when coalesce(p_avatar,'')<>'' then p_avatar else c.avatar end,
      notes=case when p_notes is not null then p_notes else c.notes end,
      visits=case when p_visits is not null then greatest(c.visits,p_visits) else c.visits end,
      total_spent=case when p_total_spent is not null then greatest(c.total_spent,p_total_spent) else c.total_spent end,
      source=case when c.source='manual' then 'manual' else coalesce(nullif(p_source,''),c.source) end,
      first_seen_at=coalesce(c.first_seen_at,now()),
      last_seen_at=now(),
      opens=c.opens+case when coalesce(p_source,'telegram')='telegram' then 1 else 0 end,
      updated_at=now()
    where c.id=v_target.id
    returning * into v_target;
  end if;

  select array_agg(c.id) into v_duplicate_ids
  from public.customers c
  where c.id<>v_target.id and (
       (coalesce(p_user_key,'')<>'' and c.user_key=p_user_key)
    or (p_telegram_id is not null and c.telegram_id=p_telegram_id)
    or (v_phone<>'' and regexp_replace(c.phone,'\D','','g')=v_phone)
    or (v_username<>'' and lower(regexp_replace(coalesce(nullif(c.telegram_username,''),c.telegram,''),'^@',''))=v_username)
  );

  if coalesce(array_length(v_duplicate_ids,1),0)>0 then
    update public.bookings set customer_id=v_target.id where customer_id=any(v_duplicate_ids);
    delete from public.customers where id=any(v_duplicate_ids);
  end if;

  return v_target;
end $$;

create or replace function public.sync_app_user_customer_trigger()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  perform public.merge_customer_identity(
    null,new.user_key,new.telegram_id,new.name,new.username,new.phone,new.avatar,
    null,null,null,'telegram'
  );
  return new;
end $$;

drop trigger if exists app_users_sync_customer on public.app_users;
create trigger app_users_sync_customer
after insert or update of telegram_id,name,username,phone,avatar,last_seen_at on public.app_users
for each row execute function public.sync_app_user_customer_trigger();

create or replace function public.admin_upsert_customer(
  p_id text default null,
  p_name text default null,
  p_phone text default null,
  p_username text default null,
  p_notes text default null,
  p_visits integer default 0,
  p_total_spent numeric default 0
) returns public.customers
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Требуется вход администратора'; end if;
  return public.merge_customer_identity(
    p_id,null,null,p_name,p_username,p_phone,null,p_notes,p_visits,p_total_spent,'manual'
  );
end $$;

grant execute on function public.admin_upsert_customer(text,text,text,text,text,integer,numeric) to authenticated;

-- Backfill all Telegram users already registered before this migration.
do $$ declare u public.app_users; begin
  for u in select * from public.app_users loop
    perform public.merge_customer_identity(null,u.user_key,u.telegram_id,u.name,u.username,u.phone,u.avatar,null,null,null,'telegram');
  end loop;
end $$;

notify pgrst, 'reload schema';
