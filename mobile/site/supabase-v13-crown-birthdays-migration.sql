-- BALI Stable 13: конкурс Король/Королева ночи + дни рождения
-- Выполните один раз в Supabase SQL Editor после предыдущих миграций.

alter table public.events add column if not exists night_crown_enabled boolean not null default false;
alter table public.events add column if not exists night_crown_ever_enabled boolean not null default false;

alter table public.app_users add column if not exists birth_date date;
alter table public.app_users add column if not exists gender text not null default 'unspecified';
alter table public.app_users drop constraint if exists app_users_gender_check;
alter table public.app_users add constraint app_users_gender_check check (gender in ('female','male','unspecified'));
create index if not exists app_users_birth_date_idx on public.app_users(birth_date);

create or replace function public.register_app_user(
  p_user_key text,
  p_telegram_id text default null,
  p_name text default 'Гость BALI',
  p_username text default '',
  p_phone text default '',
  p_avatar text default '',
  p_birth_date date default null,
  p_gender text default 'unspecified'
)
returns void language plpgsql security definer set search_path=public as $$
begin
  if coalesce(trim(p_user_key),'')='' then raise exception 'user_key is required'; end if;
  insert into public.app_users(user_key,telegram_id,name,username,phone,avatar,birth_date,gender,first_seen_at,last_seen_at,opens)
  values(p_user_key,nullif(p_telegram_id,''),coalesce(nullif(trim(p_name),''),'Гость BALI'),coalesce(p_username,''),regexp_replace(coalesce(p_phone,''),'\D','','g'),coalesce(p_avatar,''),p_birth_date,case when p_gender in ('female','male') then p_gender else 'unspecified' end,now(),now(),1)
  on conflict(user_key) do update set
    telegram_id=coalesce(excluded.telegram_id,public.app_users.telegram_id),
    name=case when excluded.name<>'' then excluded.name else public.app_users.name end,
    username=case when excluded.username<>'' then excluded.username else public.app_users.username end,
    phone=case when excluded.phone<>'' then excluded.phone else public.app_users.phone end,
    avatar=case when excluded.avatar<>'' then excluded.avatar else public.app_users.avatar end,
    birth_date=coalesce(excluded.birth_date,public.app_users.birth_date),
    gender=case when excluded.gender in ('female','male') then excluded.gender else public.app_users.gender end,
    last_seen_at=now(),opens=public.app_users.opens+1;
end $$;
revoke all on function public.register_app_user(text,text,text,text,text,text,date,text) from public;
grant execute on function public.register_app_user(text,text,text,text,text,text,date,text) to anon,authenticated;

create table if not exists public.night_crown_entries(
  id text primary key,
  event_id text not null references public.events(id) on delete cascade,
  event_title text not null default '',
  event_date date,
  user_key text not null,
  telegram_id text,
  name text not null default 'Гость BALI',
  username text not null default '',
  gender text not null check(gender in ('female','male')),
  photo_url text not null,
  status text not null default 'pending' check(status in ('pending','approved','rejected')),
  moderation_note text not null default '',
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz,
  rejected_at timestamptz,
  unique(event_id,user_key)
);
create index if not exists night_crown_entries_event_idx on public.night_crown_entries(event_id,status,gender);

create table if not exists public.night_crown_votes(
  id text primary key,
  event_id text not null references public.events(id) on delete cascade,
  event_title text not null default '',
  event_date date,
  voter_key text not null,
  candidate_key text not null,
  candidate_name text not null default '',
  candidate_gender text not null check(candidate_gender in ('female','male')),
  created_at timestamptz not null default now(),
  unique(event_id,voter_key,candidate_key)
);
create index if not exists night_crown_votes_event_idx on public.night_crown_votes(event_id,candidate_key);

create table if not exists public.night_crown_prizes(
  id text primary key,
  event_id text not null references public.events(id) on delete cascade,
  event_title text not null default '',
  event_date date,
  user_key text not null,
  name text not null default '',
  gender text not null default 'unspecified',
  prize_type text not null,
  prize_value text not null default '',
  note text not null default '',
  awarded_at timestamptz not null default now(),
  applied_at timestamptz
);

alter table public.night_crown_entries enable row level security;
alter table public.night_crown_votes enable row level security;
alter table public.night_crown_prizes enable row level security;

drop policy if exists "public read approved crown entries" on public.night_crown_entries;
create policy "public read approved crown entries" on public.night_crown_entries for select to anon using(status='approved');
drop policy if exists "staff manage crown entries" on public.night_crown_entries;
create policy "staff manage crown entries" on public.night_crown_entries for all to authenticated using(true) with check(true);
drop policy if exists "public read crown votes" on public.night_crown_votes;
create policy "public read crown votes" on public.night_crown_votes for select to anon using(true);
drop policy if exists "staff manage crown votes" on public.night_crown_votes;
create policy "staff manage crown votes" on public.night_crown_votes for all to authenticated using(true) with check(true);
drop policy if exists "public read crown prizes" on public.night_crown_prizes;
create policy "public read crown prizes" on public.night_crown_prizes for select to anon using(true);
drop policy if exists "staff manage crown prizes" on public.night_crown_prizes;
create policy "staff manage crown prizes" on public.night_crown_prizes for all to authenticated using(true) with check(true);

create or replace function public.submit_night_crown_entry(
  p_event_id text,p_user_key text,p_telegram_id text,p_name text,p_username text,p_gender text,p_photo_url text
) returns public.night_crown_entries language plpgsql security definer set search_path=public as $$
declare v_event public.events;v_row public.night_crown_entries;
begin
  select * into v_event from public.events where id=p_event_id and night_crown_enabled=true;
  if v_event.id is null then raise exception 'Конкурс не активирован';end if;
  if p_gender not in ('female','male') then raise exception 'Не выбран сектор';end if;
  if not exists(select 1 from public.event_checkins c where c.event_id=p_event_id and (c.user_key=p_user_key or (nullif(p_telegram_id,'') is not null and c.telegram_id=p_telegram_id))) then raise exception 'QR-вход не подтверждён';end if;
  insert into public.night_crown_entries(id,event_id,event_title,event_date,user_key,telegram_id,name,username,gender,photo_url,status,moderation_note,joined_at,updated_at,approved_at,rejected_at)
  values('crown-entry-'||regexp_replace(p_event_id||'-'||p_user_key,'[^a-zA-Z0-9_-]','-','g'),p_event_id,v_event.title,v_event.event_date,p_user_key,nullif(p_telegram_id,''),coalesce(nullif(p_name,''),'Гость BALI'),coalesce(p_username,''),p_gender,p_photo_url,'pending','',now(),now(),null,null)
  on conflict(event_id,user_key) do update set telegram_id=excluded.telegram_id,name=excluded.name,username=excluded.username,gender=excluded.gender,photo_url=excluded.photo_url,status='pending',moderation_note='',updated_at=now(),approved_at=null,rejected_at=null returning * into v_row;
  return v_row;
end $$;
grant execute on function public.submit_night_crown_entry(text,text,text,text,text,text,text) to anon,authenticated;

create or replace function public.get_my_night_crown_entry(p_event_id text,p_user_key text)
returns setof public.night_crown_entries language sql security definer set search_path=public as $$ select * from public.night_crown_entries where event_id=p_event_id and user_key=p_user_key limit 1 $$;
grant execute on function public.get_my_night_crown_entry(text,text) to anon,authenticated;

create or replace function public.toggle_night_crown_vote(p_event_id text,p_voter_key text,p_candidate_key text)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_candidate public.night_crown_entries;v_event public.events;v_id text;
begin
  select * into v_event from public.events where id=p_event_id and night_crown_enabled=true;
  if v_event.id is null then raise exception 'Конкурс не активирован';end if;
  if p_voter_key=p_candidate_key then raise exception 'Нельзя голосовать за себя';end if;
  if not exists(select 1 from public.event_checkins where event_id=p_event_id and user_key=p_voter_key) then raise exception 'QR-вход не подтверждён';end if;
  select * into v_candidate from public.night_crown_entries where event_id=p_event_id and user_key=p_candidate_key and status='approved';
  if v_candidate.id is null then raise exception 'Участник не допущен';end if;
  v_id='crown-vote-'||regexp_replace(p_event_id||'-'||p_voter_key||'-'||p_candidate_key,'[^a-zA-Z0-9_-]','-','g');
  if exists(select 1 from public.night_crown_votes where event_id=p_event_id and voter_key=p_voter_key and candidate_key=p_candidate_key) then delete from public.night_crown_votes where event_id=p_event_id and voter_key=p_voter_key and candidate_key=p_candidate_key;return false;end if;
  insert into public.night_crown_votes(id,event_id,event_title,event_date,voter_key,candidate_key,candidate_name,candidate_gender) values(v_id,p_event_id,v_event.title,v_event.event_date,p_voter_key,p_candidate_key,v_candidate.name,v_candidate.gender);
  return true;
end $$;
grant execute on function public.toggle_night_crown_vote(text,text,text) to anon,authenticated;

grant select on public.night_crown_entries,public.night_crown_votes,public.night_crown_prizes to anon,authenticated;
grant insert,update,delete on public.night_crown_entries,public.night_crown_votes,public.night_crown_prizes to authenticated;