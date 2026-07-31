drop table if exists public.backup_runs;
drop table if exists public.migration_preflight_runs;
drop table if exists public.outbox_jobs;
drop table if exists public.analytics_events;

drop trigger if exists bali_admin_audit_immutable on public.admin_audit_log;
drop function if exists public.bali_reject_admin_audit_mutation();
drop table if exists public.admin_audit_log;

drop table if exists public.moderation_cases;

alter table if exists public.telegram_delivery_log
  drop constraint if exists telegram_delivery_campaign_recipient_fk;
drop table if exists public.crm_campaign_recipients;
drop table if exists public.crm_campaigns;
drop table if exists public.telegram_delivery_log;
drop table if exists public.notifications;
drop table if exists public.notification_preferences;
