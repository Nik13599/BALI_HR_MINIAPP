drop table if exists public.game_clan_tasks;
drop table if exists public.game_clan_round_results;
drop table if exists public.game_clan_round_roster;
drop table if exists public.game_clan_rounds;
drop table if exists public.game_symbol_versions;
drop table if exists public.game_booster_uses;
drop table if exists public.game_level_results;
drop table if exists public.game_moves;

delete from public.game_continues where point_transaction_id is null;
alter table public.game_continues
  drop column if exists bally_cost,
  alter column point_transaction_id set not null;

alter table public.game_sessions
  drop column if exists client_finish_payload,
  drop column if exists score_breakdown,
  drop column if exists goal_progress,
  drop column if exists completion_status,
  drop column if exists stars,
  drop column if exists bally_awarded,
  drop column if exists seasonal_points,
  drop column if exists level_score,
  drop column if exists moves_remaining,
  drop column if exists move_sequence,
  drop column if exists board_state,
  drop column if exists config_signature,
  drop column if exists level_seed,
  drop column if exists level_config,
  drop column if exists season_level_number,
  drop column if exists level_number;

alter table public.game_seasons
  drop column if exists frozen_at,
  drop column if exists progress_mode,
  drop column if exists configuration,
  drop column if exists description;

alter table public.game_profiles
  drop column if exists booster_inventory,
  drop column if exists current_season_id,
  drop column if exists clean_levels,
  drop column if exists three_star_levels,
  drop column if exists lifetime_levels_completed,
  drop column if exists bally_balance,
  drop column if exists season_rating,
  drop column if exists season_level,
  drop column if exists account_level;

alter table public.game_settings
  drop column if exists original_clan_rules,
  drop column if exists original_lives_rules,
  drop column if exists original_economy_rules,
  drop column if exists original_rating_rules,
  drop column if exists original_scoring_rules,
  drop column if exists original_level_rules,
  drop column if exists clan_rules,
  drop column if exists lives_rules,
  drop column if exists economy_rules,
  drop column if exists rating_rules,
  drop column if exists scoring_rules,
  drop column if exists level_rules,
  drop column if exists reward_image_url,
  drop column if exists background_image_url,
  drop column if exists game_subtitle,
  drop column if exists game_title;
