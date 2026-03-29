-- Performance indexes for questions list search/filter/sort.

-- Optional extension for ILIKE acceleration.
create extension if not exists pg_trgm;

create index if not exists questions_title_trgm_idx
  on public.questions using gin (title gin_trgm_ops);

create index if not exists questions_topic_difficulty_preview_idx
  on public.questions (topic_id, difficulty, free_preview);

create index if not exists questions_created_at_desc_idx
  on public.questions (created_at desc);

create index if not exists questions_title_lower_idx
  on public.questions (lower(title));
