-- Exam timing (total + per question) and integrity events (tab switches, copy/paste and
-- screenshot-key attempts) recorded while a student takes an exam.
alter table public.exam_attempts add column if not exists timing jsonb;
alter table public.exam_attempts add column if not exists integrity jsonb;

-- Terms of Service acceptance.
alter table public.users add column if not exists terms_accepted_at timestamptz;

-- Student study tools: flashcard decks, summaries, concept maps, practice sets, plans,
-- study sessions. One row per item, owned by a user; data holds the tool-specific payload.
create table if not exists public.study_items (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  kind text not null,
  title text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists study_items_user_idx on public.study_items (user_id, kind);
alter table public.study_items enable row level security;
drop policy if exists "Allow all on study_items" on public.study_items;
create policy "Allow all on study_items" on public.study_items for all using (true) with check (true);
