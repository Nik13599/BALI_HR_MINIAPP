with duplicate_periods as (
  select id,
         row_number() over (
           partition by starts_at, ends_at
           order by case status when 'active' then 0 else 1 end, created_at, id
         ) as position
    from public.game_seasons
   where status in ('scheduled', 'active')
)
update public.game_seasons season
   set status = 'archived', updated_at = now()
  from duplicate_periods duplicate
 where season.id = duplicate.id
   and duplicate.position > 1;

create unique index if not exists game_seasons_open_period_unique
  on public.game_seasons(starts_at, ends_at)
  where status in ('scheduled', 'active');

insert into public.reward_definitions(
  id, name, icon_url, description, points, xp, rarity, condition_type,
  condition_config, repeatable, max_grants_per_user, active
)
values
  ('match3-weekly-top1', 'Чемпион BALI Match', '/site/assets/match3/reward.webp',
   'Первое место недельного рейтинга BALI Match.', 0, 0, 'legendary',
   'game_weekly_position', '{"position":1}'::jsonb, true, 1000000, true),
  ('match3-weekly-top2', 'Серебро BALI Match', '/site/assets/match3/reward.webp',
   'Второе место недельного рейтинга BALI Match.', 0, 0, 'epic',
   'game_weekly_position', '{"position":2}'::jsonb, true, 1000000, true),
  ('match3-weekly-top3', 'Бронза BALI Match', '/site/assets/match3/reward.webp',
   'Третье место недельного рейтинга BALI Match.', 0, 0, 'rare',
   'game_weekly_position', '{"position":3}'::jsonb, true, 1000000, true),
  ('match3-weekly-top10', 'Финалист BALI Match', '/site/assets/match3/reward.webp',
   'Место в Top-10 недельного рейтинга BALI Match.', 0, 0, 'common',
   'game_weekly_position', '{"positions":[4,5,6,7,8,9,10]}'::jsonb, true, 1000000, true)
on conflict (id) do nothing;

insert into public.vip_plans(
  id, name, points_cost, duration_days, benefits, points_multiplier,
  extra_game_lives, event_access, shop_access, active, sort_order
)
values (
  'match3-weekly-vip', 'BALI Match Weekly VIP', 0, 7,
  '["Награда недельного рейтинга BALI Match"]'::jsonb,
  1, 0, '[]'::jsonb, '[]'::jsonb, false, 9000
)
on conflict (id) do nothing;

with configured as (
  select '[
    {"position":1,"points":5000,"rewardIds":["match3-weekly-top1"],"vipPlanId":"match3-weekly-vip","vipDays":30},
    {"position":2,"points":3000,"rewardIds":["match3-weekly-top2"],"vipPlanId":"match3-weekly-vip","vipDays":14},
    {"position":3,"points":2000,"rewardIds":["match3-weekly-top3"],"vipPlanId":"match3-weekly-vip","vipDays":7},
    {"position":4,"points":1000,"rewardIds":["match3-weekly-top10"],"vipPlanId":"","vipDays":0},
    {"position":5,"points":1000,"rewardIds":["match3-weekly-top10"],"vipPlanId":"","vipDays":0},
    {"position":6,"points":500,"rewardIds":["match3-weekly-top10"],"vipPlanId":"","vipDays":0},
    {"position":7,"points":500,"rewardIds":["match3-weekly-top10"],"vipPlanId":"","vipDays":0},
    {"position":8,"points":500,"rewardIds":["match3-weekly-top10"],"vipPlanId":"","vipDays":0},
    {"position":9,"points":500,"rewardIds":["match3-weekly-top10"],"vipPlanId":"","vipDays":0},
    {"position":10,"points":500,"rewardIds":["match3-weekly-top10"],"vipPlanId":"","vipDays":0}
  ]'::jsonb as prizes
)
update public.game_settings settings
   set default_prizes = case
         when settings.default_prizes = settings.original_prizes then configured.prizes
         else settings.default_prizes
       end,
       original_prizes = configured.prizes,
       updated_at = now()
  from configured
 where settings.singleton = true;
