-- Questions and answers schema for admin CRUD and public interview listing.

create extension if not exists pgcrypto;

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null,
  difficulty text not null check (difficulty in ('junior', 'mid', 'senior', 'easy', 'medium', 'hard')),
  topic_id uuid references public.topics(id) on delete set null,
  free_preview boolean default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists questions_slug_unique_idx on public.questions (lower(slug));
create index if not exists questions_topic_id_idx on public.questions (topic_id);
create index if not exists questions_created_at_idx on public.questions (created_at desc);

create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid references public.questions(id) on delete cascade,
  short_answer text not null,
  deep_explanation text,
  real_world_example text,
  common_mistakes text,
  follow_ups jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint answers_question_id_unique unique (question_id)
);

create index if not exists answers_question_id_idx on public.answers (question_id);
create index if not exists answers_created_at_idx on public.answers (created_at desc);

create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_questions_set_updated_at on public.questions;
create trigger trg_questions_set_updated_at
before update on public.questions
for each row
execute function public.set_row_updated_at();

drop trigger if exists trg_answers_set_updated_at on public.answers;
create trigger trg_answers_set_updated_at
before update on public.answers
for each row
execute function public.set_row_updated_at();

