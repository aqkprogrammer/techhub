create extension if not exists pgcrypto;

create table if not exists public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, question_id)
);

create index if not exists bookmarks_user_id_idx on public.bookmarks (user_id);
create index if not exists bookmarks_question_id_idx on public.bookmarks (question_id);

create table if not exists public.daily_questions (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  question_id uuid not null references public.questions(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (date)
);

create index if not exists daily_questions_question_id_idx on public.daily_questions (question_id);

create table if not exists public.user_streaks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_activity_date date,
  updated_at timestamptz not null default now()
);

create table if not exists public.question_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  viewed_at timestamptz not null default now()
);

create index if not exists question_views_user_id_idx on public.question_views (user_id);
create index if not exists question_views_question_id_idx on public.question_views (question_id);
create index if not exists question_views_viewed_at_idx on public.question_views (viewed_at desc);

create table if not exists public.ai_interviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic text,
  difficulty text,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_interviews_user_id_idx on public.ai_interviews (user_id);
create index if not exists ai_interviews_created_at_idx on public.ai_interviews (created_at desc);

create table if not exists public.ai_answer_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid references public.questions(id) on delete set null,
  question text,
  user_answer text not null,
  score integer,
  strengths jsonb,
  missing_concepts jsonb,
  improvements jsonb,
  review_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_answer_reviews_user_id_idx on public.ai_answer_reviews (user_id);
create index if not exists ai_answer_reviews_question_id_idx on public.ai_answer_reviews (question_id);
