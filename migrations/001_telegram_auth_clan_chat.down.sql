drop trigger if exists bali_audit_immutable on public.clan_chat_audit_log;
drop trigger if exists bali_create_clan_chat on public.clans;

drop table if exists public.rate_limit_buckets;
drop table if exists public.rate_limit_settings;
drop table if exists public.clan_chat_audit_log;
drop table if exists public.clan_chat_reports;
drop table if exists public.clan_chat_permission_grants;
drop table if exists public.clan_chat_permissions;
drop table if exists public.clan_chat_notification_preferences;
drop table if exists public.clan_chat_pins;
drop table if exists public.clan_chat_announcements;
drop table if exists public.clan_chat_poll_votes;
drop table if exists public.clan_chat_poll_options;
alter table if exists public.clan_chat_polls
  drop constraint if exists clan_chat_polls_linked_event_attachment_id_fkey;
drop table if exists public.clan_chat_events;
drop table if exists public.clan_chat_polls;
drop table if exists public.clan_chat_restrictions;
drop table if exists public.clan_chat_read_states;
drop table if exists public.clan_chat_message_replies;
drop table if exists public.clan_chat_messages;
drop table if exists public.clan_chats;
drop table if exists public.clan_memberships;
drop table if exists public.clan_roles;
drop table if exists public.clans;
drop table if exists public.admin_sessions;
drop table if exists public.admin_users;
drop table if exists public.user_sessions;
drop table if exists public.telegram_accounts;

alter table if exists public.app_users
  drop column if exists account_status,
  drop column if exists blocked_at,
  drop column if exists profile_privacy,
  drop column if exists vip_expires_at,
  drop column if exists birth_date,
  drop column if exists updated_at;

drop function if exists public.bali_reject_audit_mutation();
drop function if exists public.bali_create_clan_chat();
drop function if exists public.bali_set_updated_at();
