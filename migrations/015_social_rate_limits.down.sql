delete from public.rate_limit_settings
 where bucket in (
   'connection.create',
   'invitation.create',
   'event_invitation.create',
   'direct_message.create',
   'user_report.create',
   'gift.create',
   'booking.hold',
   'game.session',
   'content.upload'
 )
 and updated_by_admin_id is null;
