drop table if exists public.ui_navigation_items;
drop table if exists public.ui_content_blocks;
drop table if exists public.admin_assets;

alter table public.game_settings
  drop column if exists default_prizes,
  drop column if exists symbols;

-- Membership priority correction is intentionally not reversed: rollback must
-- never re-activate duplicate memberships or remove the current valid leader.
