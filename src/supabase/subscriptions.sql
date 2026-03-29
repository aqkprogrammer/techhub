create extension if not exists "pgcrypto";

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null,
  currency text not null,
  amount numeric not null,
  expires_at timestamp with time zone null,
  is_lifetime boolean not null default false,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_subscriptions_user_id on public.subscriptions(user_id);
