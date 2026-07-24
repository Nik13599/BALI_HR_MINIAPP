-- Review reward state used by the authenticated review submission function.

alter table public.reviews add column if not exists reward_amount integer not null default 0;
alter table public.reviews add column if not exists reward_status text not null default 'not_eligible';
alter table public.reviews add column if not exists reward_action_key text;

create index if not exists reviews_user_event_idx on public.reviews(user_key, event_id, created_at desc);
create index if not exists reviews_reward_status_idx on public.reviews(reward_status, created_at desc);

notify pgrst, 'reload schema';
