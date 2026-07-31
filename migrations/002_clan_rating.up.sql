alter table public.clans
  add column if not exists rating_points integer not null default 0;

alter table public.clans
  drop constraint if exists clans_rating_points_nonnegative;

alter table public.clans
  add constraint clans_rating_points_nonnegative
  check (rating_points >= 0);

create index if not exists clans_public_rating_idx
  on public.clans(status, rating_points desc, name);
