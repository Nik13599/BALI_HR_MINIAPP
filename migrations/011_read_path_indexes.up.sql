create index if not exists app_users_active_last_seen_idx
  on public.app_users(last_seen_at desc, user_key)
  where account_status = 'active' and blocked_at is null;

create index if not exists user_profiles_discoverable_idx
  on public.user_profiles(user_key)
  where discoverable = true;

create index if not exists user_blocks_blocked_blocker_idx
  on public.user_blocks(blocked_user_key, blocker_user_key);

create index if not exists user_connections_requester_status_idx
  on public.user_connections(requester_user_key, status, updated_at desc);

create index if not exists event_attendance_user_status_idx
  on public.event_attendance(user_key, status, updated_at desc);

create index if not exists booking_records_crm_created_idx
  on public.booking_records(crm_customer_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications(user_key, created_at desc)
  where read_at is null and status not in ('cancelled', 'failed');

create index if not exists crm_campaign_recipients_delivery_idx
  on public.crm_campaign_recipients(campaign_id, status, created_at);
