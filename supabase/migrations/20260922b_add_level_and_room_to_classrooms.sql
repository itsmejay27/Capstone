-- Google Classroom captures a year level and a room alongside subject and section, and
-- instructors expect the same fields when creating a class here.
--
-- Applied to the live project (vcolqqvicukqjxdrjolz) on 2026-09-22.
ALTER TABLE public.classrooms
  ADD COLUMN IF NOT EXISTS level text,
  ADD COLUMN IF NOT EXISTS room  text;
