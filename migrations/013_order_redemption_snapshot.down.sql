drop index if exists public.shop_order_items_redemption_idx;

alter table public.shop_order_items
  drop column if exists requires_redemption;
