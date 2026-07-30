drop index if exists public.game_seasons_open_period_unique;

with configured as (
  select
    '[
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
    ]'::jsonb as newer,
    '[
      {"position":1,"points":5000,"rewardIds":[],"vipPlanId":"","vipDays":30},
      {"position":2,"points":3000,"rewardIds":[],"vipPlanId":"","vipDays":14},
      {"position":3,"points":2000,"rewardIds":[],"vipPlanId":"","vipDays":7},
      {"position":4,"points":1000,"rewardIds":[],"vipPlanId":"","vipDays":0},
      {"position":5,"points":1000,"rewardIds":[],"vipPlanId":"","vipDays":0},
      {"position":6,"points":500,"rewardIds":[],"vipPlanId":"","vipDays":0},
      {"position":7,"points":500,"rewardIds":[],"vipPlanId":"","vipDays":0},
      {"position":8,"points":500,"rewardIds":[],"vipPlanId":"","vipDays":0},
      {"position":9,"points":500,"rewardIds":[],"vipPlanId":"","vipDays":0},
      {"position":10,"points":500,"rewardIds":[],"vipPlanId":"","vipDays":0}
    ]'::jsonb as older
)
update public.game_settings settings
   set default_prizes = case
         when settings.default_prizes = configured.newer then configured.older
         else settings.default_prizes
       end,
       original_prizes = case
         when settings.original_prizes = configured.newer then configured.older
         else settings.original_prizes
       end,
       updated_at = now()
  from configured
 where settings.singleton = true;

delete from public.vip_plans
 where id = 'match3-weekly-vip'
   and not exists (
     select 1 from public.user_vip_subscriptions where plan_id = 'match3-weekly-vip'
   );

delete from public.reward_definitions
 where id in (
   'match3-weekly-top1',
   'match3-weekly-top2',
   'match3-weekly-top3',
   'match3-weekly-top10'
 )
 and not exists (
   select 1 from public.user_rewards where reward_id = reward_definitions.id
 );
