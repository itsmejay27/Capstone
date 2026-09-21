-- =============================================================================
-- Occidental Mindoro State College (OMSC) Capstone System
-- Migration 002 — course-material persistence, announcements, item analysis
--
-- Idempotent. Safe to run against an already-provisioned Supabase project and
-- safe to re-run. Run this AFTER database/schema.sql.
--
-- Covers three defects / features:
--   1. classroom_materials never stored the file itself or its metadata, so
--      uploads rendered as "1.2 MB / Invalid Date" with a blank preview after
--      a reload.
--   2. There was no announcements (stream) table at all.
--   3. exam_attempts never stored the per-attempt shuffled question snapshot,
--      without which multiple-choice answer indices are uninterpretable and
--      item/distractor analysis is impossible.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. CLASSROOM MATERIALS — columns the app always produced but never stored
-- -----------------------------------------------------------------------------
ALTER TABLE classroom_materials
    ADD COLUMN IF NOT EXISTS storage_path   TEXT,
    ADD COLUMN IF NOT EXISTS mime_type      TEXT,
    ADD COLUMN IF NOT EXISTS file_size      BIGINT,
    ADD COLUMN IF NOT EXISTS uploaded_by    TEXT,
    ADD COLUMN IF NOT EXISTS uploaded_by_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS content        TEXT;

-- -----------------------------------------------------------------------------
-- 2. EXAM ATTEMPTS — per-attempt question/option snapshot
-- TakeExam shuffles question order AND multiple-choice option order per attempt,
-- remapping correctAnswer to the shuffled index. A stored answer index is only
-- meaningful against this snapshot, so it must survive the round trip.
-- -----------------------------------------------------------------------------
ALTER TABLE exam_attempts
    ADD COLUMN IF NOT EXISTS questions JSONB DEFAULT '[]'::jsonb NOT NULL;

-- -----------------------------------------------------------------------------
-- 3. ANNOUNCEMENTS — instructor stream posts (rich text + attachments)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS announcements (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    classroom_id TEXT REFERENCES classrooms(id) ON DELETE CASCADE,
    author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    author_name TEXT,
    body_html TEXT DEFAULT '' NOT NULL,
    attachments JSONB DEFAULT '[]'::jsonb NOT NULL,
    is_pinned BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_announcements_classroom ON announcements(classroom_id);
-- Matches the feed's ORDER BY is_pinned DESC, created_at DESC
CREATE INDEX IF NOT EXISTS idx_announcements_feed ON announcements(classroom_id, is_pinned DESC, created_at DESC);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on announcements" ON announcements;
CREATE POLICY "Allow all on announcements" ON announcements FOR ALL USING (true) WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 4. STORAGE — public bucket for course materials and announcement attachments
-- `public = true` is what makes getPublicUrl() return a URL that renders in an
-- <iframe>/<img> without a signed request.
-- 26214400 bytes = 25 MB, matching MAX_STORAGE_UPLOAD_BYTES in fileStorage.ts.
--
-- NOTE: on a hosted Supabase project the storage.* schema is owned by the
-- supabase_storage_admin role. If these statements fail with "permission
-- denied", create the bucket from the Dashboard (Storage -> New bucket ->
-- name `classroom-files`, Public) and skip to the policies below.
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('classroom-files', 'classroom-files', true, 26214400)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 26214400;

DROP POLICY IF EXISTS "Allow read on classroom-files"   ON storage.objects;
DROP POLICY IF EXISTS "Allow insert on classroom-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow update on classroom-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow delete on classroom-files" ON storage.objects;

CREATE POLICY "Allow read on classroom-files"   ON storage.objects FOR SELECT USING (bucket_id = 'classroom-files');
CREATE POLICY "Allow insert on classroom-files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'classroom-files');
CREATE POLICY "Allow update on classroom-files" ON storage.objects FOR UPDATE USING (bucket_id = 'classroom-files') WITH CHECK (bucket_id = 'classroom-files');
CREATE POLICY "Allow delete on classroom-files" ON storage.objects FOR DELETE USING (bucket_id = 'classroom-files');

-- -----------------------------------------------------------------------------
-- 5. Retire the dead seed material URLs.
-- database/seed.sql seeds mat-1/mat-2 pointing at https://example.com/syllabus.pdf,
-- which 404s in the preview iframe. Null them so the UI shows the honest
-- "no preview available" state instead of a broken frame.
-- -----------------------------------------------------------------------------
UPDATE classroom_materials
   SET file_url = NULL
 WHERE file_url = 'https://example.com/syllabus.pdf';
