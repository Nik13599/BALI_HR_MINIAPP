alter table public.shop_order_items
  add column if not exists requires_redemption boolean not null default false;

update public.shop_order_items order_item
   set requires_redemption = item.requires_redemption
  from public.shop_items item
 where item.id = order_item.item_id
   and order_item.requires_redemption is distinct from item.requires_redemption;

create index if not exists shop_order_items_redemption_idx
  on public.shop_order_items(order_id)
  where requires_redemption = true;
