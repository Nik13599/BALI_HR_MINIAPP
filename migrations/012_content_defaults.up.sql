alter table public.admin_assets
  add column if not exists default_name text not null default '';

update public.admin_assets
   set default_name = name
 where default_name = '';

alter table public.ui_navigation_items
  add column if not exists default_label text not null default '',
  add column if not exists default_route text not null default '';

update public.ui_navigation_items
   set default_label = label,
       default_route = route
 where default_label = '' or default_route = '';

alter table public.game_settings
  add column if not exists original_symbols jsonb not null default '[]'::jsonb,
  add column if not exists original_prizes jsonb not null default '[]'::jsonb;

insert into public.admin_assets(
  asset_key, name, default_name, url, default_url, media_type, mime_type,
  width, height, recommended_width, recommended_height, max_bytes, alt_text
)
values
  ('bali-stone', 'Каменный лик BALI', 'Каменный лик BALI', '/site/assets/bali-temple/hero-stone-face.webp', '/site/assets/bali-temple/hero-stone-face.webp', 'image', 'image/webp', 1600, 1000, 1600, 1000, 12582912, 'Каменный лик BALI'),
  ('bali-statues', 'Бронзовые статуи BALI', 'Бронзовые статуи BALI', '/site/assets/bali-temple/bronze-statues.webp', '/site/assets/bali-temple/bronze-statues.webp', 'image', 'image/webp', 1600, 1000, 1600, 1000, 12582912, 'Бронзовые статуи BALI'),
  ('bali-bear', 'Золотой BALI Bear', 'Золотой BALI Bear', '/site/assets/bali-temple/gold-bear.webp', '/site/assets/bali-temple/gold-bear.webp', 'image', 'image/webp', 1080, 1080, 1080, 1080, 12582912, 'Золотой BALI Bear'),
  ('match3-background', 'Фон BALI Match', 'Фон BALI Match', '/site/assets/match3/background.webp', '/site/assets/match3/background.webp', 'image', 'image/webp', 1600, 1000, 1600, 1000, 12582912, 'Фон игры BALI Match')
on conflict (asset_key) do nothing;

insert into public.ui_navigation_items(
  app_type, item_key, label, default_label, route, default_route, icon_url, default_icon_url,
  recommended_width, recommended_height, active, sort_order
)
values
  ('app', 'home', 'Главная', 'Главная', 'home', 'home', '/site/assets/bali-temple/nav-home.svg', '/site/assets/bali-temple/nav-home.svg', 256, 256, true, 10),
  ('app', 'events', 'Афиши', 'Афиши', 'events', 'events', '/site/assets/bali-temple/nav-events.svg', '/site/assets/bali-temple/nav-events.svg', 256, 256, true, 20),
  ('app', 'dating', 'BALI PEOPLE', 'BALI PEOPLE', 'dating', 'dating', '/site/assets/bali-temple/nav-people.svg', '/site/assets/bali-temple/nav-people.svg', 256, 256, true, 30),
  ('app', 'crown', 'Игра', 'Игра', 'crown', 'crown', '/site/assets/bali-temple/nav-game.svg', '/site/assets/bali-temple/nav-game.svg', 256, 256, true, 40),
  ('app', 'profile', 'Профиль', 'Профиль', 'profile', 'profile', '/site/assets/bali-temple/nav-profile.svg', '/site/assets/bali-temple/nav-profile.svg', 256, 256, true, 50)
on conflict (app_type, item_key) do update
set label = case
      when ui_navigation_items.updated_by_admin_id is null then excluded.label
      else ui_navigation_items.label
    end,
    route = excluded.route,
    icon_url = case
      when ui_navigation_items.updated_by_admin_id is null or ui_navigation_items.icon_url = ''
        then excluded.icon_url
      else ui_navigation_items.icon_url
    end,
    default_icon_url = excluded.default_icon_url,
    default_label = excluded.default_label,
    default_route = excluded.default_route,
    recommended_width = excluded.recommended_width,
    recommended_height = excluded.recommended_height,
    active = true,
    sort_order = excluded.sort_order;

update public.ui_navigation_items
   set active = false, updated_at = now()
 where app_type = 'app'
   and item_key in ('vip', 'rewards', 'menu')
   and updated_by_admin_id is null;

insert into public.ui_content_blocks(
  scope, block_key, name, title, asset_key, configuration, default_value,
  recommended_width, recommended_height, active, sort_order
)
values
  ('app','home.hero','Главный баннер','BALI','bali-stone','{"overlay":48,"position":"center"}','{"title":"BALI","assetKey":"bali-stone","configuration":{"overlay":48,"position":"center"}}',1600,1000,true,10),
  ('app','home.checkin','QR-подтверждение входа','Подтвердить вход','bali-stone','{"overlay":58,"position":"center"}','{"title":"Подтвердить вход","assetKey":"bali-stone","configuration":{"overlay":58,"position":"center"}}',1200,800,true,20),
  ('app','home.upcoming','Ближайшие события','Ближайшие события','bali-statues','{"overlay":68,"position":"center"}','{"title":"Ближайшие события","assetKey":"bali-statues","configuration":{"overlay":68,"position":"center"}}',1400,900,true,30),
  ('app','home.social','Социальные сети','Мы в соцсетях','bali-statues','{"overlay":66,"position":"center"}','{"title":"Мы в соцсетях","assetKey":"bali-statues","configuration":{"overlay":66,"position":"center"}}',1200,720,true,40),
  ('app','home.map','Карта и маршрут','Как нас найти','bali-stone','{"overlay":68,"position":"center"}','{"title":"Как нас найти","assetKey":"bali-stone","configuration":{"overlay":68,"position":"center"}}',1200,720,true,50),
  ('app','home.contacts','Контакты клуба','Связаться с BALI','bali-statues','{"overlay":68,"position":"center"}','{"title":"Связаться с BALI","assetKey":"bali-statues","configuration":{"overlay":68,"position":"center"}}',1200,720,true,60),
  ('app','home.about','О клубе','Клуб BALI','bali-stone','{"overlay":62,"position":"center"}','{"title":"Клуб BALI","assetKey":"bali-stone","configuration":{"overlay":62,"position":"center"}}',1400,850,true,70),
  ('app','events.header','Шапка афиш','Афиши','bali-statues','{"overlay":52,"position":"center"}','{"title":"Афиши","assetKey":"bali-statues","configuration":{"overlay":52,"position":"center"}}',1600,600,true,110),
  ('app','events.catalog','Каталог событий','Каталог событий','bali-stone','{"overlay":74,"position":"center"}','{"title":"Каталог событий","assetKey":"bali-stone","configuration":{"overlay":74,"position":"center"}}',1400,900,true,120),
  ('app','menu.header','Шапка меню','Меню','bali-bear','{"overlay":55,"position":"center"}','{"title":"Меню","assetKey":"bali-bear","configuration":{"overlay":55,"position":"center"}}',1600,600,true,210),
  ('app','menu.categories','Категории меню','Категории меню','bali-statues','{"overlay":74,"position":"center"}','{"title":"Категории меню","assetKey":"bali-statues","configuration":{"overlay":74,"position":"center"}}',1400,520,true,220),
  ('app','menu.catalog','Позиции меню','Позиции меню','bali-stone','{"overlay":78,"position":"center"}','{"title":"Позиции меню","assetKey":"bali-stone","configuration":{"overlay":78,"position":"center"}}',1400,1000,true,230),
  ('app','people.header','Шапка BALI PEOPLE','Люди BALI','bali-statues','{"overlay":54,"position":"center"}','{"title":"Люди BALI","assetKey":"bali-statues","configuration":{"overlay":54,"position":"center"}}',1600,600,true,310),
  ('app','people.filters','Фильтры сообщества','Фильтры','bali-stone','{"overlay":74,"position":"center"}','{"title":"Фильтры","assetKey":"bali-stone","configuration":{"overlay":74,"position":"center"}}',1400,520,true,320),
  ('app','people.connections','Знакомства и приглашения','Заявки, приглашения и мои люди','bali-stone','{"overlay":74,"position":"center"}','{"title":"Заявки, приглашения и мои люди","assetKey":"bali-stone","configuration":{"overlay":74,"position":"center"}}',1400,720,true,330),
  ('app','people.catalog','Карточки участников','Участники сообщества','bali-statues','{"overlay":78,"position":"center"}','{"title":"Участники сообщества","assetKey":"bali-statues","configuration":{"overlay":78,"position":"center"}}',1400,1000,true,340),
  ('game','game.header','Шапка игры','BALI Match','match3-background','{"overlay":50,"position":"center"}','{"title":"BALI Match","assetKey":"match3-background","configuration":{"overlay":50,"position":"center"}}',1600,600,true,410),
  ('game','game.metrics','Показатели раунда','Показатели раунда','match3-background','{"overlay":72,"position":"center"}','{"title":"Показатели раунда","assetKey":"match3-background","configuration":{"overlay":72,"position":"center"}}',1400,520,true,420),
  ('game','game.board','Игровое поле','Ночной раунд','match3-background','{"overlay":76,"position":"center"}','{"title":"Ночной раунд","assetKey":"match3-background","configuration":{"overlay":76,"position":"center"}}',1200,1200,true,430),
  ('game','game.ranking','Недельный рейтинг','TOP 10 недели','bali-statues','{"overlay":78,"position":"center"}','{"title":"TOP 10 недели","assetKey":"bali-statues","configuration":{"overlay":78,"position":"center"}}',1200,900,true,440),
  ('game','game.rewards','Награды TOP 10','Награды TOP 10','bali-bear','{"overlay":78,"position":"center"}','{"title":"Награды TOP 10","assetKey":"bali-bear","configuration":{"overlay":78,"position":"center"}}',1200,900,true,450),
  ('game','game.myRewards','Мои игровые награды','Мои награды','bali-bear','{"overlay":78,"position":"center"}','{"title":"Мои награды","assetKey":"bali-bear","configuration":{"overlay":78,"position":"center"}}',1200,900,true,460),
  ('app','profile.header','Шапка профиля','Мой профиль','bali-stone','{"overlay":54,"position":"center"}','{"title":"Мой профиль","assetKey":"bali-stone","configuration":{"overlay":54,"position":"center"}}',1600,600,true,510),
  ('app','profile.hero','Карточка пользователя','Карточка пользователя','bali-stone','{"overlay":60,"position":"center"}','{"title":"Карточка пользователя","assetKey":"bali-stone","configuration":{"overlay":60,"position":"center"}}',1200,800,true,520),
  ('app','profile.level','Статус и прогресс','Статус и прогресс','bali-statues','{"overlay":72,"position":"center"}','{"title":"Статус и прогресс","assetKey":"bali-statues","configuration":{"overlay":72,"position":"center"}}',1200,720,true,530),
  ('app','profile.economy','BALI Club: баллы, подарки и VIP','BALI Club','bali-bear','{"overlay":68,"position":"center"}','{"title":"BALI Club","assetKey":"bali-bear","configuration":{"overlay":68,"position":"center"}}',1200,900,true,540),
  ('app','profile.shop','BALI Shop','BALI Shop','bali-bear','{"overlay":64,"position":"center"}','{"title":"BALI Shop","assetKey":"bali-bear","configuration":{"overlay":64,"position":"center"}}',1080,1080,true,550),
  ('app','profile.rewards','Мои награды','Мои награды','bali-statues','{"overlay":68,"position":"center"}','{"title":"Мои награды","assetKey":"bali-statues","configuration":{"overlay":68,"position":"center"}}',1080,1080,true,560),
  ('app','profile.invitations','Приглашения','Приглашения','bali-stone','{"overlay":68,"position":"center"}','{"title":"Приглашения","assetKey":"bali-stone","configuration":{"overlay":68,"position":"center"}}',1080,1080,true,570),
  ('app','profile.gifts','Мои подарки','Мои подарки','bali-bear','{"overlay":68,"position":"center"}','{"title":"Мои подарки","assetKey":"bali-bear","configuration":{"overlay":68,"position":"center"}}',1080,1080,true,580)
on conflict (scope, block_key) do nothing;

update public.ui_content_blocks
   set default_value = default_value || jsonb_build_object('name', name)
 where not (default_value ? 'name');

update public.game_settings
   set symbols = (
     select coalesce(jsonb_agg(
       case
         when item->>'key' = 'cocktail' then
           (item - 'key') ||
           '{"key":"martini","defaultImageUrl":"/site/assets/match3/martini.webp"}'::jsonb
         else item || jsonb_build_object(
           'defaultImageUrl',
           '/site/assets/match3/' || (item->>'key') || '.webp'
         )
       end
       order by ordinal
     ), '[]'::jsonb) ||
     case when exists (
       select 1 from jsonb_array_elements(game_settings.symbols) existing
        where existing->>'key' = 'triangle'
     ) then '[]'::jsonb
     else '[{"key":"triangle","label":"Портал","imageUrl":"","defaultImageUrl":"/site/assets/match3/triangle.webp","active":true,"weight":1}]'::jsonb
     end
     from jsonb_array_elements(game_settings.symbols) with ordinality source(item, ordinal)
   ),
   updated_at = now()
 where singleton = true;

update public.game_settings
   set original_symbols = '[
     {"key":"headphones","label":"Наушники","imageUrl":"","defaultImageUrl":"/site/assets/match3/headphones.webp","active":true,"weight":1},
     {"key":"martini","label":"BALI Martini","imageUrl":"","defaultImageUrl":"/site/assets/match3/martini.webp","active":true,"weight":1},
     {"key":"palm","label":"Пальма","imageUrl":"","defaultImageUrl":"/site/assets/match3/palm.webp","active":true,"weight":1},
     {"key":"turntable","label":"Винил","imageUrl":"","defaultImageUrl":"/site/assets/match3/turntable.webp","active":true,"weight":1},
     {"key":"disco","label":"Диско-шар","imageUrl":"","defaultImageUrl":"/site/assets/match3/disco.webp","active":true,"weight":1},
     {"key":"mask","label":"Маска","imageUrl":"","defaultImageUrl":"/site/assets/match3/mask.webp","active":true,"weight":1},
     {"key":"lotus","label":"Лотос","imageUrl":"","defaultImageUrl":"/site/assets/match3/lotus.webp","active":true,"weight":1},
     {"key":"triangle","label":"Портал","imageUrl":"","defaultImageUrl":"/site/assets/match3/triangle.webp","active":true,"weight":1}
   ]'::jsonb,
       original_prizes = '[
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
   ]'::jsonb
 where singleton = true;
