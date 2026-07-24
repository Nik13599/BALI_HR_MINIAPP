-- BALI Minsk: shared visual settings for all devices
-- Run after site/bali-production-finalize.sql. Safe to run repeatedly.

alter table public.venue_content
  add column if not exists home_design jsonb not null default '{}'::jsonb;

insert into public.venue_content(id,title,active,home_design)
values ('venue-main','Площадка BALI',true,'{}'::jsonb)
on conflict(id) do nothing;

grant select on public.venue_content to anon;
grant select,insert,update,delete on public.venue_content to authenticated;

notify pgrst, 'reload schema';
