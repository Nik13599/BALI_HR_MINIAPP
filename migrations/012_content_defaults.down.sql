delete from public.ui_content_blocks
 where updated_by_admin_id is null
   and block_key in (
     'home.hero','home.checkin','home.upcoming','home.social','home.map','home.contacts','home.about',
     'events.header','events.catalog','menu.header','menu.categories','menu.catalog',
     'people.header','people.filters','people.connections','people.catalog',
     'game.header','game.metrics','game.board','game.ranking','game.rewards','game.myRewards',
     'profile.header','profile.hero','profile.level','profile.economy','profile.shop','profile.rewards',
     'profile.invitations','profile.gifts'
   );

delete from public.admin_assets
 where updated_by_admin_id is null
   and asset_key in ('bali-stone','bali-statues','bali-bear','match3-background');

delete from public.ui_navigation_items
 where app_type = 'app'
   and item_key in ('dating', 'crown')
   and updated_by_admin_id is null;

update public.ui_navigation_items
   set active = true, updated_at = now()
 where app_type = 'app'
   and item_key in ('vip', 'rewards')
   and updated_by_admin_id is null;

update public.game_settings
   set symbols = (
     select coalesce(jsonb_agg(
       case
         when item->>'key' = 'martini' then
           (item - 'key' - 'defaultImageUrl') || '{"key":"cocktail","defaultImageUrl":""}'::jsonb
         else item - 'defaultImageUrl'
       end
       order by ordinal
     ) filter (where item->>'key' <> 'triangle'), '[]'::jsonb)
     from jsonb_array_elements(game_settings.symbols) with ordinality source(item, ordinal)
   ),
   updated_at = now()
 where singleton = true
   and updated_by_admin_id is null;

alter table public.ui_navigation_items
  drop column if exists default_route,
  drop column if exists default_label;

alter table public.admin_assets
  drop column if exists default_name;

alter table public.game_settings
  drop column if exists original_prizes,
  drop column if exists original_symbols;
