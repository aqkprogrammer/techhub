-- Promote admin@techhub.com to admin and repair malformed auth.users row if needed.
-- Run in Supabase SQL editor.

begin;

-- Ensure the auth user row has valid Supabase auth defaults.
update auth.users
set
  aud = coalesce(aud, 'authenticated'),
  role = coalesce(role, 'authenticated'),
  raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
    || '{"provider":"email","providers":["email"]}'::jsonb,
  email_confirmed_at = coalesce(email_confirmed_at, now()),
  updated_at = now()
where lower(email) = lower('admin@techhub.com');

-- Ensure profile exists and has admin role.
insert into public.profiles (id, email, full_name, role)
select
  u.id,
  u.email,
  coalesce(nullif(trim(u.raw_user_meta_data->>'full_name'), ''), 'Techhub Admin'),
  'admin'
from auth.users u
where lower(u.email) = lower('admin@techhub.com')
on conflict (id) do update
set
  email = excluded.email,
  full_name = coalesce(excluded.full_name, public.profiles.full_name),
  role = 'admin',
  updated_at = now();

commit;

-- Verify
select
  u.id,
  u.email,
  u.aud,
  u.role as auth_role,
  p.role as profile_role,
  p.full_name
from auth.users u
left join public.profiles p on p.id = u.id
where lower(u.email) = lower('admin@techhub.com');
