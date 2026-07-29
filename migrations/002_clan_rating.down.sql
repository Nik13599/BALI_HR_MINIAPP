drop index if exists public.clans_public_rating_idx;

alter table public.clans
  drop constraint if exists clans_rating_points_nonnegative;

alter table public.clans
  drop column if exists rating_points;
