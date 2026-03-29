-- Supabase Auth setup + repair script for application profiles.
-- NOTE: Do NOT create your own "users" table when using Supabase Auth.
-- Supabase already manages users in auth.users.

create extension if not exists pgcrypto;

-- Remove any previously created custom triggers on auth.users so
-- only one predictable profile-sync trigger remains.
do $$
declare
  trigger_name text;
begin
  for trigger_name in
    select tgname
    from pg_trigger
    where tgrelid = 'auth.users'::regclass
      and not tgisinternal
  loop
    execute format('drop trigger if exists %I on auth.users;', trigger_name);
  end loop;
end $$;

drop function if exists public.handle_new_user() cascade;
drop function if exists public.handle_new_auth_user() cascade;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade
);

alter table public.profiles
  add column if not exists email text,
  add column if not exists full_name text,
  add column if not exists avatar_url text,
  add column if not exists role text,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

alter table public.profiles
  alter column email type text using email::text,
  alter column full_name type text using full_name::text,
  alter column avatar_url type text using avatar_url::text,
  alter column role type text using role::text,
  alter column created_at type timestamptz using created_at::timestamptz,
  alter column updated_at type timestamptz using updated_at::timestamptz;

update public.profiles
set role = 'user'
where role is null;

update public.profiles
set created_at = now()
where created_at is null;

update public.profiles
set updated_at = now()
where updated_at is null;

alter table public.profiles
  alter column role set default 'user',
  alter column created_at set default now(),
  alter column updated_at set default now(),
  alter column role set not null,
  alter column created_at set not null,
  alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_role_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_role_check check (role in ('user', 'admin'));
  end if;
end $$;

create unique index if not exists profiles_email_unique_idx
  on public.profiles (email)
  where email is not null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_set_updated_at on public.profiles;
create trigger trg_profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', null),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', null),
    'user'
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name),
        avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);

  return new;
end;
$$;

alter function public.handle_new_auth_user() owner to postgres;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_insert_auth_admin" on public.profiles;
create policy "profiles_insert_auth_admin"
on public.profiles
for insert
to supabase_auth_admin
with check (true);

drop policy if exists "profiles_update_auth_admin" on public.profiles;
create policy "profiles_update_auth_admin"
on public.profiles
for update
to supabase_auth_admin
using (true)
with check (true);
