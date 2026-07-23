-- BALI Telegram messaging schema
-- Выполнить в Supabase Dashboard -> SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.telegram_conversations (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id bigint not null unique,
  telegram_chat_id bigint not null unique,
  username text,
  first_name text,
  last_name text,
  photo_url text,
  status text not null default 'open' check (status in ('open','closed','blocked')),
  assigned_admin uuid references auth.users(id) on delete set null,
  last_message_text text,
  last_message_at timestamptz,
  unread_admin integer not null default 0 check (unread_admin >= 0),
  unread_user integer not null default 0 check (unread_user >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.telegram_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.telegram_conversations(id) on delete cascade,
  direction text not null check (direction in ('user','admin','system')),
  sender_telegram_id bigint,
  admin_user_id uuid references auth.users(id) on delete set null,
  telegram_message_id bigint,
  message_type text not null default 'text',
  text text not null default '',
  payload jsonb not null default '{}'::jsonb,
  delivery_status text not null default 'received' check (delivery_status in ('received','queued','sent','delivered','failed')),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists telegram_conversations_last_message_idx on public.telegram_conversations(last_message_at desc nulls last);
create index if not exists telegram_conversations_unread_idx on public.telegram_conversations(unread_admin) where unread_admin > 0;
create index if not exists telegram_messages_conversation_created_idx on public.telegram_messages(conversation_id, created_at);
drop index if exists public.telegram_messages_telegram_id_idx;
create unique index if not exists telegram_messages_chat_message_idx
  on public.telegram_messages(conversation_id, telegram_message_id)
  where telegram_message_id is not null;

alter table public.telegram_conversations enable row level security;
alter table public.telegram_messages enable row level security;

-- Админская панель уже защищена входом Supabase Auth.
-- Эти политики дают доступ только авторизованным сотрудникам.
drop policy if exists telegram_conversations_admin_select on public.telegram_conversations;
create policy telegram_conversations_admin_select on public.telegram_conversations for select to authenticated using (true);

drop policy if exists telegram_conversations_admin_update on public.telegram_conversations;
create policy telegram_conversations_admin_update on public.telegram_conversations for update to authenticated using (true) with check (true);

drop policy if exists telegram_messages_admin_select on public.telegram_messages;
create policy telegram_messages_admin_select on public.telegram_messages for select to authenticated using (true);

-- Вставка ответов из браузера запрещена: отправка выполняется только защищённой Edge Function.
-- Service Role внутри Edge Functions обходит RLS.

create or replace function public.touch_telegram_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.telegram_conversations
  set
    last_message_text = new.text,
    last_message_at = new.created_at,
    updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists telegram_messages_touch_conversation on public.telegram_messages;
create trigger telegram_messages_touch_conversation
after insert on public.telegram_messages
for each row execute function public.touch_telegram_conversation();

-- Включаем Realtime для мгновенного появления сообщений в админке.
do $$
begin
  begin
    alter publication supabase_realtime add table public.telegram_conversations;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.telegram_messages;
  exception when duplicate_object then null;
  end;
end $$;

comment on table public.telegram_conversations is 'Диалоги пользователей с Telegram-ботом BALI';
comment on table public.telegram_messages is 'Входящие и исходящие сообщения Telegram-бота BALI';