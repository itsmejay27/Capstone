-- =============================================================================
-- Occidental Mindoro State College (OMSC) Capstone System
-- Migration 003 — Google Classroom parity: Classwork, Topics, Submissions, Comments
--
-- Idempotent. Safe to re-run. Run AFTER migration_002.
--
-- Adds:
--   1. classroom_topics      — instructor-defined headings ("Week 1", "Midterms")
--   2. classwork             — assignments/materials/questions posted to a class
--   3. classwork_submissions — student turn-ins, with attachments and a grade
--   4. post_comments         — class + private comments on announcements and classwork
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. TOPICS — headings that group classwork, ordered by `position`
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS classroom_topics (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    classroom_id TEXT REFERENCES classrooms(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    position INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_classroom_topics_class ON classroom_topics(classroom_id, position);

-- -----------------------------------------------------------------------------
-- 2. CLASSWORK — assignment / material / question posts
-- `kind` mirrors Classroom's post types. An assignment is gradeable (points, due
-- date, submissions); a material is read-only reference; a question is a short
-- prompt answered inline.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS classwork (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    classroom_id TEXT REFERENCES classrooms(id) ON DELETE CASCADE,
    topic_id TEXT REFERENCES classroom_topics(id) ON DELETE SET NULL,
    kind TEXT NOT NULL DEFAULT 'assignment' CHECK (kind IN ('assignment', 'material', 'question')),
    title TEXT NOT NULL,
    instructions TEXT,
    attachments JSONB DEFAULT '[]'::jsonb NOT NULL,
    points NUMERIC,
    due_date TIMESTAMPTZ,
    post_date TIMESTAMPTZ,
    is_published BOOLEAN DEFAULT true NOT NULL,
    allow_late BOOLEAN DEFAULT true NOT NULL,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_classwork_class ON classwork(classroom_id);
CREATE INDEX IF NOT EXISTS idx_classwork_topic ON classwork(topic_id);
CREATE INDEX IF NOT EXISTS idx_classwork_due ON classwork(classroom_id, due_date);

-- -----------------------------------------------------------------------------
-- 3. SUBMISSIONS — one row per (classwork, student)
-- `status` is derived on write: turned_in / returned. `is_late` is stamped at
-- submit time against the due date, because the due date can be edited later and
-- lateness must reflect the rules the student was actually held to.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS classwork_submissions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    classwork_id TEXT REFERENCES classwork(id) ON DELETE CASCADE,
    student_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    text_answer TEXT,
    attachments JSONB DEFAULT '[]'::jsonb NOT NULL,
    status TEXT DEFAULT 'assigned' NOT NULL CHECK (status IN ('assigned', 'turned_in', 'returned')),
    is_late BOOLEAN DEFAULT false NOT NULL,
    grade NUMERIC,
    feedback TEXT,
    submitted_at TIMESTAMPTZ,
    returned_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (classwork_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_submissions_classwork ON classwork_submissions(classwork_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student ON classwork_submissions(student_id);

-- -----------------------------------------------------------------------------
-- 4. COMMENTS — on an announcement or a classwork post
-- `post_type` + `post_id` is a polymorphic reference rather than two tables, since
-- the rendering and permissions are identical for both.
-- `visibility`: 'class' is visible to everyone in the class; 'private' is the
-- student<->instructor side channel Classroom calls a private comment.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS post_comments (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    classroom_id TEXT REFERENCES classrooms(id) ON DELETE CASCADE,
    post_type TEXT NOT NULL CHECK (post_type IN ('announcement', 'classwork')),
    post_id TEXT NOT NULL,
    author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    author_name TEXT,
    body TEXT NOT NULL,
    visibility TEXT DEFAULT 'class' NOT NULL CHECK (visibility IN ('class', 'private')),
    /* For a private comment, the student side of the conversation. */
    private_with_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_comments_post ON post_comments(post_type, post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_class ON post_comments(classroom_id);

-- -----------------------------------------------------------------------------
-- RLS — matches the permissive policy style used by the rest of this schema.
-- NOTE: these are open policies for academic testing, consistent with every other
-- table here. Private comments are filtered in the client, NOT by the database,
-- so they are not a security boundary under this policy set. Tightening this
-- requires real Supabase Auth (auth.uid()), which this app does not use yet.
-- -----------------------------------------------------------------------------
ALTER TABLE classroom_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE classwork ENABLE ROW LEVEL SECURITY;
ALTER TABLE classwork_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on classroom_topics" ON classroom_topics;
DROP POLICY IF EXISTS "Allow all on classwork" ON classwork;
DROP POLICY IF EXISTS "Allow all on classwork_submissions" ON classwork_submissions;
DROP POLICY IF EXISTS "Allow all on post_comments" ON post_comments;

CREATE POLICY "Allow all on classroom_topics" ON classroom_topics FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on classwork" ON classwork FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on classwork_submissions" ON classwork_submissions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on post_comments" ON post_comments FOR ALL USING (true) WITH CHECK (true);
