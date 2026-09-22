-- Google Classroom-style assignment detail, captured when a template is assigned to a class.
-- The template keeps its own title/description; these are per-assignment overrides so the
-- same template can be posted to two classes with different instructions and due dates.
--
-- Applied to the live project (vcolqqvicukqjxdrjolz) on 2026-09-22.
ALTER TABLE public.exams
  ADD COLUMN IF NOT EXISTS instructions      text,
  ADD COLUMN IF NOT EXISTS topic_id          text,
  ADD COLUMN IF NOT EXISTS allow_late        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shuffle_questions boolean NOT NULL DEFAULT false;
