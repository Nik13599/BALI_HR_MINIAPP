-- BALI PEOPLE event voting
-- Run after supabase-event-qr.sql

create table if not exists public.bali_people_votes (
  id text primary key,
  event_id text not null references public.events(id) on delete cascade,
  event_title text not null default '',
  event_date date not null,
  voter_key text not null,
  candidate_key text not null,
  candidate_name text not null default 'Гость BALI',
  candidate_gender text not null default 'unspecified'
    check (candidate_gender in ('female','male','unspecified')),
  created_at timestamptz not null default now(),
  unique(event_id, voter_key, candidate_key),
  check (voter_key <> candidate_key)
);

create index if not exists bali_people_votes_event_idx
  on public.bali_people_votes(event_id, created_at desc);
create index if not exists bali_people_votes_period_idx
  on public.bali_people_votes(event_date desc);

alter table public.bali_people_votes enable row level security;

drop policy if exists "Public reads BALI PEOPLE rankings" on public.bali_people_votes;
create policy "Public reads BALI PEOPLE rankings"
  on public.bali_people_votes for select
  to anon, authenticated
  using (true);

drop policy if exists "Public creates BALI PEOPLE votes" on public.bali_people_votes;
create policy "Public creates BALI PEOPLE votes"
  on public.bali_people_votes for insert
  to anon, authenticated
  with check (
    exists (
      select 1 from public.event_checkins voter
      where voter.event_id = bali_people_votes.event_id
        and voter.user_key = bali_people_votes.voter_key
    )
    and exists (
      select 1 from public.event_checkins candidate
      where candidate.event_id = bali_people_votes.event_id
        and candidate.user_key = bali_people_votes.candidate_key
    )
  );

drop policy if exists "Public removes own BALI PEOPLE votes" on public.bali_people_votes;
create policy "Public removes own BALI PEOPLE votes"
  on public.bali_people_votes for delete
  to anon, authenticated
  using (
    exists (
      select 1 from public.event_checkins voter
      where voter.event_id = bali_people_votes.event_id
        and voter.user_key = bali_people_votes.voter_key
    )
  );

grant select, insert, delete on public.bali_people_votes to anon, authenticated;
