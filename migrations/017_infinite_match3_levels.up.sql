alter table public.game_settings
  add column if not exists game_title text not null default 'BALI Match',
  add column if not exists game_subtitle text not null default 'Бесконечная сезонная игра',
  add column if not exists background_image_url text not null default '/site/assets/match3/background.webp',
  add column if not exists reward_image_url text not null default '/site/assets/match3/reward.webp',
  add column if not exists level_rules jsonb not null default '{
    "rows":6,"columns":6,"minTileTypes":5,"maxTileTypes":8,
    "baseMoves":25,"minMoves":12,"baseTargetScore":10000,
    "sqrtDifficulty":0.06,"linearDifficulty":0.004,"maxGoals":3,
    "checkpointEvery":10,"milestoneEvery":25,"specialStartLevel":4,
    "obstacleStartLevel":8,"blockedChanceMax":0.12,"obstacleChanceMax":0.28
  }'::jsonb,
  add column if not exists scoring_rules jsonb not null default '{
    "baseTile":100,"combo3":1,"combo4":1.25,"combo5":1.6,"combo6":2,"comboTL":1.75,
    "cascadeStep":0.35,"maxCascade":3,"lineCreate":250,"bombCreate":400,
    "rainbowCreate":650,"lineActivate":350,"bombActivate":550,"rainbowActivate":900,
    "obstacleLayer":150,"goalComplete":1000,"allGoalsBase":2500,"remainingMove":200,
    "cleanMultiplier":0.1,"star2":1.2,"star3":1.5
  }'::jsonb,
  add column if not exists rating_rules jsonb not null default '{
    "base":1000,"levelLog":0.1,"star1":1,"star2":1.15,"star3":1.35,
    "continue0":1,"continue1":0.85,"continue2":0.65
  }'::jsonb,
  add column if not exists economy_rules jsonb not null default '{
    "firstCompletion":20,"starRewards":[0,5,10,20],"cleanCompletion":10,
    "replayFraction":0.25,"continueMoves":5,"continueCosts":[40,80],
    "boosterCosts":{"shuffle":25,"hint":10,"bomb":45,"remove":35,"removeType":60},
    "lifeCost":50,"fullLivesCost":180
  }'::jsonb,
  add column if not exists lives_rules jsonb not null default '{"maximum":5,"restoreMinutes":30}'::jsonb,
  add column if not exists clan_rules jsonb not null default '{
    "minimumMembers":5,"maximumMembers":30,"transitionLockHours":72,
    "taskRatingBonusLimit":0.1,"minimumLevelsForChest":3,
    "bestRounds":4,"chestMilestones":[25,50,75,100]
  }'::jsonb,
  add column if not exists original_level_rules jsonb not null default '{}'::jsonb,
  add column if not exists original_scoring_rules jsonb not null default '{}'::jsonb,
  add column if not exists original_rating_rules jsonb not null default '{}'::jsonb,
  add column if not exists original_economy_rules jsonb not null default '{}'::jsonb,
  add column if not exists original_lives_rules jsonb not null default '{}'::jsonb,
  add column if not exists original_clan_rules jsonb not null default '{}'::jsonb;

update public.game_settings
   set original_level_rules = case when original_level_rules = '{}'::jsonb then level_rules else original_level_rules end,
       original_scoring_rules = case when original_scoring_rules = '{}'::jsonb then scoring_rules else original_scoring_rules end,
       original_rating_rules = case when original_rating_rules = '{}'::jsonb then rating_rules else original_rating_rules end,
       original_economy_rules = case when original_economy_rules = '{}'::jsonb then economy_rules else original_economy_rules end,
       original_lives_rules = case when original_lives_rules = '{}'::jsonb then lives_rules else original_lives_rules end,
       original_clan_rules = case when original_clan_rules = '{}'::jsonb then clan_rules else original_clan_rules end,
       base_lives = greatest(1, coalesce((lives_rules->>'maximum')::integer, base_lives)),
       continue_points_cost = greatest(0, coalesce((economy_rules->'continueCosts'->>0)::bigint, continue_points_cost))
 where singleton = true;

alter table public.game_profiles
  add column if not exists account_level integer not null default 1 check (account_level > 0),
  add column if not exists season_level integer not null default 1 check (season_level > 0),
  add column if not exists season_rating bigint not null default 0 check (season_rating >= 0),
  add column if not exists bally_balance bigint not null default 1250 check (bally_balance >= 0),
  add column if not exists lifetime_levels_completed integer not null default 0 check (lifetime_levels_completed >= 0),
  add column if not exists three_star_levels integer not null default 0 check (three_star_levels >= 0),
  add column if not exists clean_levels integer not null default 0 check (clean_levels >= 0),
  add column if not exists current_season_id uuid references public.game_seasons(id) on delete set null,
  add column if not exists booster_inventory jsonb not null default '{"bomb":1,"shuffle":1,"hint":2,"remove":0,"removeType":0}'::jsonb;

update public.game_profiles set bally_balance = 1250 where bally_balance = 0;

alter table public.game_continues
  alter column point_transaction_id drop not null,
  add column if not exists bally_cost bigint not null default 0 check (bally_cost >= 0);

alter table public.game_seasons
  add column if not exists description text not null default '',
  add column if not exists configuration jsonb not null default '{}'::jsonb,
  add column if not exists progress_mode text not null default 'account_keep_season_reset'
    check (progress_mode in ('account_keep_season_reset','carry_all','reset_all')),
  add column if not exists frozen_at timestamptz;

alter table public.game_sessions
  add column if not exists level_number integer not null default 1 check (level_number > 0),
  add column if not exists season_level_number integer not null default 1 check (season_level_number > 0),
  add column if not exists level_config jsonb not null default '{}'::jsonb,
  add column if not exists level_seed text not null default '',
  add column if not exists config_signature text not null default '',
  add column if not exists board_state jsonb not null default '[]'::jsonb,
  add column if not exists move_sequence integer not null default 0 check (move_sequence >= 0),
  add column if not exists moves_remaining integer not null default 0 check (moves_remaining >= 0),
  add column if not exists level_score bigint not null default 0 check (level_score >= 0),
  add column if not exists seasonal_points bigint not null default 0 check (seasonal_points >= 0),
  add column if not exists bally_awarded bigint not null default 0 check (bally_awarded >= 0),
  add column if not exists stars integer not null default 0 check (stars between 0 and 3),
  add column if not exists completion_status text not null default 'active'
    check (completion_status in ('active','success','failed','abandoned')),
  add column if not exists goal_progress jsonb not null default '{
    "score":0,"collected":{},"obstaclesDestroyed":0,
    "specialsCreated":{"line":0,"bomb":0,"rainbow":0},
    "specialsActivated":{"line":0,"bomb":0,"rainbow":0,"any":0}
  }'::jsonb,
  add column if not exists score_breakdown jsonb not null default '{
    "combinations":0,"cascades":0,"specials":0,"obstacles":0,
    "goals":0,"remainingMoves":0,"clean":0
  }'::jsonb,
  add column if not exists client_finish_payload jsonb not null default '{}'::jsonb;

create table if not exists public.game_moves (
  id uuid primary key default gen_random_uuid(),
  game_session_id uuid not null references public.game_sessions(id) on delete cascade,
  user_key text not null references public.app_users(user_key) on delete restrict,
  sequence integer not null check (sequence > 0),
  first_index integer not null check (first_index >= 0),
  second_index integer not null check (second_index >= 0),
  board_before_hash text not null,
  board_after_hash text not null,
  score_delta bigint not null default 0 check (score_delta >= 0),
  move_result jsonb not null default '{}'::jsonb,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  unique (game_session_id, sequence)
);

create table if not exists public.game_level_results (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.game_seasons(id) on delete cascade,
  user_key text not null references public.app_users(user_key) on delete restrict,
  level_number integer not null check (level_number > 0),
  best_session_id uuid not null references public.game_sessions(id) on delete restrict,
  best_score bigint not null default 0 check (best_score >= 0),
  best_stars integer not null default 0 check (best_stars between 0 and 3),
  best_rating bigint not null default 0 check (best_rating >= 0),
  clean_completed boolean not null default false,
  attempts integer not null default 1 check (attempts > 0),
  first_completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (season_id, user_key, level_number)
);

create table if not exists public.game_booster_uses (
  id uuid primary key default gen_random_uuid(),
  game_session_id uuid not null references public.game_sessions(id) on delete cascade,
  user_key text not null references public.app_users(user_key) on delete restrict,
  booster_type text not null check (booster_type in ('shuffle','hint','bomb','remove','removeType')),
  target_index integer,
  inventory_used boolean not null default false,
  points_cost bigint not null default 0 check (points_cost >= 0),
  bally_cost bigint not null default 0 check (bally_cost >= 0),
  point_transaction_id uuid references public.point_ledger(id) on delete set null,
  result jsonb not null default '{}'::jsonb,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists game_level_results_ranking_idx
  on public.game_level_results(season_id, user_key, best_rating desc);

create table if not exists public.game_symbol_versions (
  id uuid primary key default gen_random_uuid(),
  symbol_key text not null,
  label text not null,
  image_url text not null,
  width integer not null default 512 check (width > 0),
  height integer not null default 512 check (height > 0),
  source text not null default 'custom' check (source in ('original','custom','restored')),
  active boolean not null default false,
  created_by_admin_id uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists game_symbol_versions_key_created_idx
  on public.game_symbol_versions(symbol_key, created_at desc);

create table if not exists public.game_clan_rounds (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.game_seasons(id) on delete cascade,
  clan_type text not null check (clan_type in ('user','corporate')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled','active','frozen','completed','archived')),
  rules_snapshot jsonb not null default '{}'::jsonb,
  frozen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create unique index if not exists game_clan_rounds_period_unique
  on public.game_clan_rounds(season_id, clan_type, starts_at);

create table if not exists public.game_clan_round_roster (
  round_id uuid not null references public.game_clan_rounds(id) on delete cascade,
  clan_id text not null references public.clans(id) on delete cascade,
  user_key text not null references public.app_users(user_key) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (round_id, clan_id, user_key)
);

create table if not exists public.game_clan_round_results (
  round_id uuid not null references public.game_clan_rounds(id) on delete cascade,
  clan_id text not null references public.clans(id) on delete cascade,
  members_count integer not null default 0 check (members_count >= 0),
  active_members integer not null default 0 check (active_members >= 0),
  total_rating bigint not null default 0 check (total_rating >= 0),
  average_rating numeric(18,3) not null default 0 check (average_rating >= 0),
  median_rating numeric(18,3) not null default 0 check (median_rating >= 0),
  task_bonus numeric(8,5) not null default 0 check (task_bonus >= 0),
  eligible boolean not null default false,
  position integer,
  updated_at timestamptz not null default now(),
  primary key (round_id, clan_id)
);

create table if not exists public.game_clan_tasks (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.game_clan_rounds(id) on delete cascade,
  clan_id text not null references public.clans(id) on delete cascade,
  title text not null,
  metric text not null default 'levels',
  target_value bigint not null check (target_value > 0),
  current_value bigint not null default 0 check (current_value >= 0),
  reward_payload jsonb not null default '{}'::jsonb,
  minimum_personal_contribution bigint not null default 3 check (minimum_personal_contribution >= 0),
  created_at timestamptz not null default now(),
  unique (round_id, clan_id, metric)
);

alter table public.game_moves enable row level security;
alter table public.game_booster_uses enable row level security;
alter table public.game_level_results enable row level security;
alter table public.game_symbol_versions enable row level security;
alter table public.game_clan_rounds enable row level security;
alter table public.game_clan_round_roster enable row level security;
alter table public.game_clan_round_results enable row level security;
alter table public.game_clan_tasks enable row level security;
