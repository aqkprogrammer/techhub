create extension if not exists pgcrypto;

create table if not exists public.purchase_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  subscription_id text,
  source text not null default 'subscription',
  display_name text not null,
  avatar_url text,
  country_code text,
  country_flag text,
  plan_label text not null,
  provider text not null default 'Stripe',
  purchased_at timestamptz not null default now(),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists purchase_notifications_active_idx
  on public.purchase_notifications (is_active, purchased_at desc);

create index if not exists purchase_notifications_user_idx
  on public.purchase_notifications (user_id);

create unique index if not exists purchase_notifications_subscription_unique
  on public.purchase_notifications (subscription_id);

create or replace function public.tg_touch_purchase_notifications_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tr_touch_purchase_notifications_updated_at on public.purchase_notifications;
create trigger tr_touch_purchase_notifications_updated_at
before update on public.purchase_notifications
for each row
execute function public.tg_touch_purchase_notifications_updated_at();

create or replace function public.log_subscription_purchase_notification()
returns trigger
language plpgsql
security definer
as $$
declare
  normalized_status text;
  profile_name text;
  profile_avatar text;
  resolved_name text;
  resolved_plan text;
  resolved_provider text;
begin
  normalized_status := lower(coalesce(new.status, ''));

  if new.user_id is null then
    return new;
  end if;

  if normalized_status not in ('active', 'trialing') then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if lower(coalesce(old.status, '')) in ('active', 'trialing')
       and coalesce(new.plan, '') = coalesce(old.plan, '')
       and coalesce(new.current_period_end, 'epoch'::timestamptz) = coalesce(old.current_period_end, 'epoch'::timestamptz) then
      return new;
    end if;
  end if;

  select p.full_name, p.avatar_url
  into profile_name, profile_avatar
  from public.profiles p
  where p.id = new.user_id;

  resolved_name := coalesce(nullif(trim(profile_name), ''), 'A tech candidate');
  resolved_plan := coalesce(nullif(trim(new.plan), ''), 'Pro');
  resolved_provider := case
    when coalesce(new.stripe_subscription_id, '') <> '' then 'Stripe'
    else 'Billing'
  end;

  insert into public.purchase_notifications (
    user_id,
    subscription_id,
    source,
    display_name,
    avatar_url,
    plan_label,
    provider,
    purchased_at,
    is_active
  )
  values (
    new.user_id,
    nullif(new.stripe_subscription_id, ''),
    'subscription',
    resolved_name,
    profile_avatar,
    resolved_plan,
    resolved_provider,
    now(),
    true
  )
  on conflict (subscription_id)
  do update
  set
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url,
    plan_label = excluded.plan_label,
    provider = excluded.provider,
    purchased_at = excluded.purchased_at,
    is_active = true,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists tr_log_subscription_purchase_notification on public.subscriptions;
create trigger tr_log_subscription_purchase_notification
after insert or update of status, plan, current_period_end
on public.subscriptions
for each row
execute function public.log_subscription_purchase_notification();

insert into public.purchase_notifications (
  id,
  source,
  display_name,
  country_code,
  country_flag,
  plan_label,
  provider,
  purchased_at,
  is_active
)
values
  ('4f89fce8-64f8-4f08-a31f-3ce7506cb051', 'seed', 'Giovanna', 'PT', '🇵🇹', 'Lifetime', 'Stripe', now() - interval '3 days', true),
  ('6aaea85c-a28f-495c-95b0-57950ee3bc34', 'seed', 'Arjun', 'IN', '🇮🇳', 'Pro', 'Stripe', now() - interval '2 hours', true),
  ('77d5c128-ec23-47f5-8032-5abbca16aee7', 'seed', 'Maya', 'US', '🇺🇸', 'Pro', 'Stripe', now() - interval '42 minutes', true),
  ('8948faef-57c7-4ae6-9255-d85533fe23b7', 'seed', 'Luca', 'IT', '🇮🇹', 'Lifetime', 'Stripe', now() - interval '11 hours', true)
on conflict (id) do nothing;

insert into public.purchase_notifications (
  user_id,
  subscription_id,
  source,
  display_name,
  avatar_url,
  plan_label,
  provider,
  purchased_at,
  is_active
)
select
  s.user_id,
  nullif(s.stripe_subscription_id, ''),
  'backfill',
  coalesce(nullif(trim(p.full_name), ''), 'A tech candidate'),
  p.avatar_url,
  coalesce(nullif(trim(s.plan), ''), 'Pro'),
  case when coalesce(s.stripe_subscription_id, '') <> '' then 'Stripe' else 'Billing' end,
  coalesce(s.created_at, now()),
  true
from public.subscriptions s
left join public.profiles p on p.id = s.user_id
where lower(coalesce(s.status, '')) in ('active', 'trialing')
on conflict (subscription_id) do nothing;
