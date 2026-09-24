-- Manual grading of short-answer/essay items, co-instructors, and the instructor's class record sheet.
alter table exam_attempts add column if not exists manual_scores jsonb;
alter table exam_attempts add column if not exists grading_status text;
alter table exam_attempts add column if not exists graded_at timestamptz;
alter table exam_attempts add column if not exists feedback text;

alter table classrooms add column if not exists co_instructors text[] not null default '{}';
alter table classrooms add column if not exists coteach_token text;

create table if not exists grade_sheets (
  classroom_id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table grade_sheets enable row level security;
drop policy if exists grade_sheets_all on grade_sheets;
create policy grade_sheets_all on grade_sheets for all using (true) with check (true);
