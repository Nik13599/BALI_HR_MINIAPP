delete from public.rate_limit_settings where bucket in (
  'auth.mobile_request','auth.mobile_login','auth.mobile_reset','auth.mobile_password'
);

alter table public.user_sessions drop column if exists auth_method;
drop table if exists public.mobile_access_requests;
drop table if exists public.mobile_credentials;
