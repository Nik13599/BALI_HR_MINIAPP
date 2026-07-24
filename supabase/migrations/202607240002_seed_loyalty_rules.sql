-- Default BALI loyalty rules. Safe to execute repeatedly.

insert into public.loyalty_rules (title, action, description, points, active)
select 'Посещение мероприятия по QR', 'event_checkin', 'Начисляется один раз за первое подтверждение входа на мероприятие.', 100, true
where not exists (select 1 from public.loyalty_rules where action in ('event_checkin','attendance','qr_checkin'));

insert into public.loyalty_rules (title, action, description, points, active)
select 'Отзыв о мероприятии', 'review', 'Начисляется один раз за первый отзыв пользователя о посещённом мероприятии.', 100, true
where not exists (select 1 from public.loyalty_rules where action = 'review');

insert into public.loyalty_rules (title, action, description, points, active)
select 'Репост мероприятия', 'event_share', 'Начисляется за подтверждённый репост мероприятия.', 5, true
where not exists (select 1 from public.loyalty_rules where action = 'event_share');

insert into public.loyalty_rules (title, action, description, points, active)
select 'Приглашение нового пользователя', 'referral', 'Начисляется после первого входа действительно нового пользователя по приглашению.', 10, true
where not exists (select 1 from public.loyalty_rules where action = 'referral');

update public.app_settings
set attendance_points = coalesce((select points from public.loyalty_rules where action in ('event_checkin','attendance','qr_checkin') and active = true order by updated_at desc limit 1), attendance_points),
    updated_at = now()
where id = 'main';

notify pgrst, 'reload schema';
