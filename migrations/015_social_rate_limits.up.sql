insert into public.rate_limit_settings(bucket, limit_count, window_seconds) values
  ('connection.create', 10, 86400),
  ('invitation.create', 20, 86400),
  ('event_invitation.create', 20, 86400),
  ('direct_message.create', 60, 60),
  ('user_report.create', 5, 86400),
  ('gift.create', 20, 3600),
  ('booking.hold', 10, 60),
  ('game.session', 30, 3600),
  ('content.upload', 30, 3600)
on conflict (bucket) do nothing;
