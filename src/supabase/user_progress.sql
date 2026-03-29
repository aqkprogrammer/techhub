create extension if not exists pgcrypto;

create table if not exists public.user_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  question_id uuid references public.questions(id) on delete cascade,
  completed boolean not null default false,
  bookmarked boolean not null default false,
  last_viewed timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists user_progress_user_question_unique
  on public.user_progress (user_id, question_id);

create index if not exists user_progress_user_id_idx
  on public.user_progress (user_id);

create index if not exists user_progress_question_id_idx
  on public.user_progress (question_id);

create index if not exists user_progress_last_viewed_idx
  on public.user_progress (last_viewed desc);
