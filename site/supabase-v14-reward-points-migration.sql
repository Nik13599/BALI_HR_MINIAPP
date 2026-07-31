-- BALI Stable 14: транзакционные баллы за получение награды
-- Выполните после supabase-telegram-crm-beta3.sql и миграций app_users.

begin;

alter table public.customers
  add column if not exists points_balance integer not null default 0;

create table if not exists public.reward_definitions (
  id text primary key default gen_random_uuid()::text,
  title text not null,
  description text not null default '',
  image_url text not null default '',
  xp integer not null default 0 check (xp >= 0),
  condition_type text not null default 'manual',
  condition_value jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  repeatable boolean not null default false,
  award_points_enabled boolean not null default false,
  points_reward_amount integer not null default 0 check (points_reward_amount >= 0),
  points_reward_type text not null default 'points' check (points_reward_type = 'points'),
  award_points_mode text not null default 'first' check (award_points_mode in ('first','each','none')),
  deduct_points_on_revoke boolean not null default false,
  points_history_comment text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_rewards (
  id text primary key default gen_random_uuid()::text,
  reward_id text not null references public.reward_definitions(id) on delete restrict,
  customer_id text not null references public.customers(id) on delete cascade,
  source_type text not null,
  source_id text not null,
  idempotency_key text not null unique,
  points_status text not null default 'pending'
    check (points_status in ('pending','credited','not_applicable','skipped_repeat','retry_required','revoked','partially_deducted')),
  points_configured_amount integer not null default 0 check (points_configured_amount >= 0),
  points_awarded integer not null default 0 check (points_awarded >= 0),
  points_transaction_id text,
  admin_id uuid,
  override_reason text not null default '',
  earned_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid,
  revoke_reason text not null default ''
);

create index if not exists user_rewards_customer_idx
  on public.user_rewards(customer_id, earned_at desc);
create index if not exists user_rewards_reward_idx
  on public.user_rewards(reward_id, earned_at desc);
create unique index if not exists user_rewards_source_once_idx
  on public.user_rewards(reward_id, customer_id, source_type, source_id);

create table if not exists public.points_transactions (
  id text primary key default gen_random_uuid()::text,
  customer_id text not null references public.customers(id) on delete cascade,
  amount integer not null check (amount <> 0),
  balance_before integer not null check (balance_before >= 0),
  balance_after integer not null check (balance_after >= 0),
  operation_type text not null,
  title text not null,
  idempotency_key text not null unique,
  source_type text not null default '',
  source_id text not null default '',
  reward_id text references public.reward_definitions(id) on delete set null,
  user_reward_id text references public.user_rewards(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists points_transactions_customer_idx
  on public.points_transactions(customer_id, created_at desc);
create index if not exists points_transactions_reward_idx
  on public.points_transactions(reward_id, created_at desc);

create table if not exists public.reward_points_audit (
  id text primary key default gen_random_uuid()::text,
  action text not null,
  reward_id text,
  user_reward_id text,
  user_id text,
  admin_id uuid,
  amount integer not null default 0,
  points_type text not null default 'points',
  balance_before integer,
  balance_after integer,
  transaction_id text,
  source_type text not null default '',
  source_id text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists reward_points_audit_reward_idx
  on public.reward_points_audit(reward_id, created_at desc);
create index if not exists reward_points_audit_user_idx
  on public.reward_points_audit(user_id, created_at desc);

create or replace function public.has_reward_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.role() = 'service_role'
    or (
      auth.role() = 'authenticated'
      and coalesce(
        (auth.jwt() -> 'app_metadata' -> 'permissions') ? p_permission,
        true
      )
    );
$$;

create or replace function public.award_reward_with_points(
  p_reward_id text,
  p_customer_id text,
  p_source_type text,
  p_source_id text,
  p_override_amount integer default null,
  p_override_reason text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reward public.reward_definitions;
  v_customer public.customers;
  v_user_reward public.user_rewards;
  v_existing public.user_rewards;
  v_amount integer := 0;
  v_before integer := 0;
  v_after integer := 0;
  v_transaction_id text := '';
  v_idempotency text;
  v_points_idempotency text;
begin
  if not public.has_reward_permission('rewards.points.view') then
    raise exception 'permission denied';
  end if;
  if coalesce(trim(p_source_type),'') = '' or coalesce(trim(p_source_id),'') = '' then
    raise exception 'source_type and source_id are required';
  end if;

  select * into v_reward
  from public.reward_definitions
  where id = p_reward_id and active = true
  for update;
  if v_reward.id is null then raise exception 'Награда не найдена или выключена'; end if;

  select * into v_customer
  from public.customers
  where id = p_customer_id
  for update;
  if v_customer.id is null then raise exception 'Пользователь не найден'; end if;

  v_idempotency := case
    when v_reward.repeatable
      then format('reward:%s:user:%s:source:%s:%s', p_reward_id, p_customer_id, p_source_type, p_source_id)
    else format('reward:%s:user:%s:once', p_reward_id, p_customer_id)
  end;

  select * into v_existing
  from public.user_rewards
  where idempotency_key = v_idempotency
  limit 1;
  if v_existing.id is not null then
    insert into public.reward_points_audit(
      action,reward_id,user_reward_id,user_id,admin_id,amount,transaction_id,source_type,source_id,metadata
    ) values (
      'reward_points_retry_idempotent',p_reward_id,v_existing.id,p_customer_id,auth.uid(),
      v_existing.points_awarded,v_existing.points_transaction_id,p_source_type,p_source_id,
      jsonb_build_object('idempotency_key',v_idempotency)
    );
    return jsonb_build_object('ok',true,'duplicate',true,'user_reward_id',v_existing.id,'points_awarded',v_existing.points_awarded);
  end if;

  if not v_reward.repeatable then
    select * into v_existing
    from public.user_rewards
    where reward_id = p_reward_id and customer_id = p_customer_id and revoked_at is null
    order by earned_at desc
    limit 1;
    if v_existing.id is not null then
      return jsonb_build_object('ok',true,'duplicate',true,'user_reward_id',v_existing.id,'points_awarded',v_existing.points_awarded);
    end if;
  end if;

  if p_override_amount is not null then
    if not public.has_reward_permission('rewards.award.override_points') then
      raise exception 'permission denied: rewards.award.override_points';
    end if;
    if p_override_amount < 0 then raise exception 'Количество баллов не может быть отрицательным'; end if;
    if coalesce(trim(p_override_reason),'') = '' then raise exception 'Укажите причину изменения суммы'; end if;
  end if;

  v_amount := case
    when not v_reward.award_points_enabled or v_reward.award_points_mode = 'none' then 0
    when p_override_amount is not null then p_override_amount
    else v_reward.points_reward_amount
  end;

  if v_reward.repeatable and v_reward.award_points_mode = 'first' and exists (
    select 1 from public.user_rewards ur
    where ur.reward_id = p_reward_id
      and ur.customer_id = p_customer_id
      and ur.points_status = 'credited'
      and ur.points_awarded > 0
  ) then
    v_amount := 0;
  end if;

  insert into public.user_rewards(
    reward_id,customer_id,source_type,source_id,idempotency_key,points_status,
    points_configured_amount,points_awarded,admin_id,override_reason
  ) values (
    p_reward_id,p_customer_id,p_source_type,p_source_id,v_idempotency,
    case when v_amount > 0 then 'pending'
         when v_reward.repeatable and v_reward.award_points_mode = 'first' then 'skipped_repeat'
         else 'not_applicable' end,
    v_reward.points_reward_amount,0,auth.uid(),coalesce(p_override_reason,'')
  )
  returning * into v_user_reward;

  if p_override_amount is not null then
    insert into public.reward_points_audit(
      action,reward_id,user_reward_id,user_id,admin_id,amount,source_type,source_id,metadata
    ) values (
      'reward_points_override',p_reward_id,v_user_reward.id,p_customer_id,auth.uid(),v_amount,
      p_source_type,p_source_id,jsonb_build_object('configured_amount',v_reward.points_reward_amount,'reason',p_override_reason)
    );
  end if;

  if v_amount > 0 then
    v_before := v_customer.points_balance;
    v_after := v_before + v_amount;
    v_points_idempotency := 'reward_points:' || v_user_reward.id;
    v_transaction_id := gen_random_uuid()::text;

    update public.customers
    set points_balance = v_after, updated_at = now()
    where id = p_customer_id;

    insert into public.points_transactions(
      id,customer_id,amount,balance_before,balance_after,operation_type,title,idempotency_key,
      source_type,source_id,reward_id,user_reward_id,metadata
    ) values (
      v_transaction_id,p_customer_id,v_amount,v_before,v_after,'reward_award',
      coalesce(nullif(v_reward.points_history_comment,''),'Награда: ' || v_reward.title),
      v_points_idempotency,p_source_type,p_source_id,p_reward_id,v_user_reward.id,
      jsonb_build_object('reward_id',p_reward_id,'user_reward_id',v_user_reward.id)
    );

    update public.user_rewards
    set points_status = 'credited', points_awarded = v_amount, points_transaction_id = v_transaction_id
    where id = v_user_reward.id
    returning * into v_user_reward;

    insert into public.reward_points_audit(
      action,reward_id,user_reward_id,user_id,admin_id,amount,balance_before,balance_after,
      transaction_id,source_type,source_id,metadata
    ) values (
      case when v_reward.repeatable then 'reward_points_repeat_credited' else 'reward_points_credited' end,
      p_reward_id,v_user_reward.id,p_customer_id,auth.uid(),v_amount,v_before,v_after,
      v_transaction_id,p_source_type,p_source_id,jsonb_build_object('idempotency_key',v_points_idempotency)
    );
  end if;

  return jsonb_build_object(
    'ok',true,
    'duplicate',false,
    'user_reward_id',v_user_reward.id,
    'points_awarded',v_user_reward.points_awarded,
    'points_status',v_user_reward.points_status,
    'transaction_id',coalesce(v_user_reward.points_transaction_id,'')
  );
end;
$$;

create or replace function public.revoke_reward_with_points(
  p_user_reward_id text,
  p_reason text default 'Отзыв администратором'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_reward public.user_rewards;
  v_reward public.reward_definitions;
  v_customer public.customers;
  v_before integer := 0;
  v_after integer := 0;
  v_deducted integer := 0;
  v_transaction_id text := '';
begin
  if not public.has_reward_permission('rewards.points.revoke') then
    raise exception 'permission denied: rewards.points.revoke';
  end if;

  select * into v_user_reward
  from public.user_rewards
  where id = p_user_reward_id
  for update;
  if v_user_reward.id is null then raise exception 'Выданная награда не найдена'; end if;
  if v_user_reward.revoked_at is not null then
    return jsonb_build_object('ok',true,'duplicate',true,'points_deducted',0);
  end if;

  select * into v_reward from public.reward_definitions where id = v_user_reward.reward_id;
  select * into v_customer from public.customers where id = v_user_reward.customer_id for update;

  if v_reward.deduct_points_on_revoke and v_user_reward.points_awarded > 0 then
    v_before := v_customer.points_balance;
    v_deducted := least(v_before, v_user_reward.points_awarded);
    if v_deducted = 0 then raise exception 'Недостаточно баллов для связанного списания'; end if;
    v_after := v_before - v_deducted;
    v_transaction_id := gen_random_uuid()::text;
    update public.customers set points_balance = v_after, updated_at = now() where id = v_customer.id;
    insert into public.points_transactions(
      id,customer_id,amount,balance_before,balance_after,operation_type,title,idempotency_key,
      source_type,source_id,reward_id,user_reward_id,metadata
    ) values (
      v_transaction_id,v_customer.id,-v_deducted,v_before,v_after,'reward_revoke',
      'Отзыв награды: ' || v_reward.title,'reward_points_revoke:' || v_user_reward.id,
      'admin_revoke',v_user_reward.id,v_reward.id,v_user_reward.id,
      jsonb_build_object('original_transaction_id',v_user_reward.points_transaction_id,'partial',v_deducted < v_user_reward.points_awarded)
    );
  end if;

  update public.user_rewards
  set revoked_at = now(), revoked_by = auth.uid(), revoke_reason = coalesce(p_reason,''),
      points_status = case when v_deducted > 0 and v_deducted < points_awarded then 'partially_deducted' else 'revoked' end
  where id = v_user_reward.id;

  insert into public.reward_points_audit(
    action,reward_id,user_reward_id,user_id,admin_id,amount,balance_before,balance_after,
    transaction_id,source_type,source_id,metadata
  ) values (
    case when v_deducted > 0 then 'reward_points_revoked' else 'reward_revoked_without_points' end,
    v_reward.id,v_user_reward.id,v_customer.id,auth.uid(),v_deducted,
    case when v_deducted > 0 then v_before else null end,
    case when v_deducted > 0 then v_after else null end,
    v_transaction_id,'admin_revoke',v_user_reward.id,
    jsonb_build_object('original_transaction_id',v_user_reward.points_transaction_id,'reason',coalesce(p_reason,''))
  );

  return jsonb_build_object('ok',true,'duplicate',false,'points_deducted',v_deducted,'transaction_id',v_transaction_id);
end;
$$;

alter table public.reward_definitions enable row level security;
alter table public.user_rewards enable row level security;
alter table public.points_transactions enable row level security;
alter table public.reward_points_audit enable row level security;

drop policy if exists "staff manage reward definitions" on public.reward_definitions;
create policy "staff manage reward definitions"
on public.reward_definitions for all to authenticated
using (public.has_reward_permission('rewards.points.view'))
with check (public.has_reward_permission('rewards.points.configure'));

drop policy if exists "staff read user rewards" on public.user_rewards;
create policy "staff read user rewards"
on public.user_rewards for select to authenticated
using (public.has_reward_permission('rewards.points.view'));

drop policy if exists "staff read reward point transactions" on public.points_transactions;
create policy "staff read reward point transactions"
on public.points_transactions for select to authenticated
using (public.has_reward_permission('rewards.points.view'));

drop policy if exists "staff read reward points audit" on public.reward_points_audit;
create policy "staff read reward points audit"
on public.reward_points_audit for select to authenticated
using (public.has_reward_permission('rewards.points.audit'));

revoke all on function public.has_reward_permission(text) from public;
revoke all on function public.award_reward_with_points(text,text,text,text,integer,text) from public;
revoke all on function public.revoke_reward_with_points(text,text) from public;
grant execute on function public.has_reward_permission(text) to authenticated;
grant execute on function public.award_reward_with_points(text,text,text,text,integer,text) to authenticated;
grant execute on function public.revoke_reward_with_points(text,text) to authenticated;
grant select,insert,update,delete on public.reward_definitions to authenticated;
grant select on public.user_rewards,public.points_transactions,public.reward_points_audit to authenticated;

commit;
