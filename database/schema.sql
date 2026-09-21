-- =============================================================================
-- Occidental Mindoro State College (OMSC) Capstone System
-- AI-Powered Examination & Classroom Management System
-- Complete Database Schema (PostgreSQL / Supabase)
-- =============================================================================

-- Enable pgcrypto extension for gen_random_uuid() support if not already available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. USERS TABLE
-- Stores instructors, students, and administrators
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    email TEXT UNIQUE NOT NULL,
    password TEXT,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('instructor', 'student', 'admin')),
    avatar TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =============================================================================
-- 2. CLASSROOMS TABLE
-- Academic classes created and administered by instructors
-- =============================================================================
CREATE TABLE IF NOT EXISTS classrooms (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    section TEXT NOT NULL,
    instructor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    class_code TEXT UNIQUE NOT NULL,
    description TEXT,
    is_archived BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =============================================================================
-- 3. CLASSROOM STUDENTS (JOIN TABLE)
-- Student enrollments in classrooms
-- =============================================================================
CREATE TABLE IF NOT EXISTS classroom_students (
    classroom_id TEXT REFERENCES classrooms(id) ON DELETE CASCADE,
    student_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (classroom_id, student_id)
);

-- =============================================================================
-- 4. CLASSROOM MATERIALS TABLE
-- Uploaded syllabus, lecture notes, TOS, and reference documents
-- =============================================================================
CREATE TABLE IF NOT EXISTS classroom_materials (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    classroom_id TEXT REFERENCES classrooms(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    file_url TEXT,
    file_type TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =============================================================================
-- 5. SAVED EXAMS (EXAM REPOSITORY) TABLE
-- Reusable exam templates and generated drafts created by instructors
-- =============================================================================
CREATE TABLE IF NOT EXISTS saved_exams (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title TEXT NOT NULL,
    description TEXT,
    questions JSONB DEFAULT '[]'::jsonb NOT NULL,
    total_points NUMERIC DEFAULT 0 NOT NULL,
    duration INTEGER, -- duration in minutes
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =============================================================================
-- 6. EXAMS (ASSIGNED CLASSROOM EXAMS) TABLE
-- Published/assigned examinations linked to a specific classroom
-- =============================================================================
CREATE TABLE IF NOT EXISTS exams (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    source_exam_id TEXT REFERENCES saved_exams(id) ON DELETE SET NULL,
    classroom_id TEXT REFERENCES classrooms(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    questions JSONB DEFAULT '[]'::jsonb NOT NULL,
    total_points NUMERIC DEFAULT 0 NOT NULL,
    duration INTEGER, -- duration in minutes
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    is_published BOOLEAN DEFAULT false NOT NULL,
    allowed_attempts INTEGER DEFAULT 1 NOT NULL,
    post_date TIMESTAMPTZ,
    due_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =============================================================================
-- 7. EXAM ATTEMPTS TABLE
-- Student submissions, answers, scores, and timestamps
-- =============================================================================
CREATE TABLE IF NOT EXISTS exam_attempts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    exam_id TEXT REFERENCES exams(id) ON DELETE CASCADE,
    student_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    answers JSONB DEFAULT '{}'::jsonb NOT NULL,
    score NUMERIC,
    started_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    submitted_at TIMESTAMPTZ
);

-- =============================================================================
-- 8. REVIEWERS TABLE
-- AI-generated modular review packages and flashcards
-- =============================================================================
CREATE TABLE IF NOT EXISTS reviewers (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title TEXT NOT NULL,
    subject TEXT,
    difficulty TEXT,
    difficulty_label TEXT,
    module_count INTEGER DEFAULT 0 NOT NULL,
    items_per_module INTEGER DEFAULT 0 NOT NULL,
    source TEXT,
    status TEXT DEFAULT 'in-progress' NOT NULL,
    current_module_index INTEGER DEFAULT 0 NOT NULL,
    modules JSONB DEFAULT '[]'::jsonb NOT NULL,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =============================================================================
-- 9. QUESTION BANK TABLE
-- Categorized reusable items with cognitive levels and placement specs
-- =============================================================================
CREATE TABLE IF NOT EXISTS question_bank (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    type TEXT NOT NULL,
    question TEXT NOT NULL,
    options JSONB,
    correct_answer TEXT,
    points NUMERIC DEFAULT 1 NOT NULL,
    difficulty TEXT DEFAULT 'easy' NOT NULL,
    topic TEXT,
    cognitive_level TEXT,
    item_placement TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    subject TEXT,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =============================================================================
-- PERFORMANCE INDEXES
-- Optimizes foreign key lookups and frequent filter criteria
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_classrooms_instructor ON classrooms(instructor_id);
CREATE INDEX IF NOT EXISTS idx_classrooms_code ON classrooms(class_code);
CREATE INDEX IF NOT EXISTS idx_classroom_students_student ON classroom_students(student_id);
CREATE INDEX IF NOT EXISTS idx_classroom_materials_class ON classroom_materials(classroom_id);
CREATE INDEX IF NOT EXISTS idx_saved_exams_created_by ON saved_exams(created_by);
CREATE INDEX IF NOT EXISTS idx_exams_classroom ON exams(classroom_id);
CREATE INDEX IF NOT EXISTS idx_exams_created_by ON exams(created_by);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_exam ON exam_attempts(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_student ON exam_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_reviewers_created_by ON reviewers(created_by);
CREATE INDEX IF NOT EXISTS idx_question_bank_subject ON question_bank(subject);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Enables open access for both anon and authenticated roles for academic testing
-- =============================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE classroom_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE classroom_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_bank ENABLE ROW LEVEL SECURITY;

-- Drop existing generic policies if any to allow safe re-running
DROP POLICY IF EXISTS "Allow all on users" ON users;
DROP POLICY IF EXISTS "Allow all on classrooms" ON classrooms;
DROP POLICY IF EXISTS "Allow all on classroom_students" ON classroom_students;
DROP POLICY IF EXISTS "Allow all on classroom_materials" ON classroom_materials;
DROP POLICY IF EXISTS "Allow all on saved_exams" ON saved_exams;
DROP POLICY IF EXISTS "Allow all on exams" ON exams;
DROP POLICY IF EXISTS "Allow all on exam_attempts" ON exam_attempts;
DROP POLICY IF EXISTS "Allow all on reviewers" ON reviewers;
DROP POLICY IF EXISTS "Allow all on question_bank" ON question_bank;

CREATE POLICY "Allow all on users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on classrooms" ON classrooms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on classroom_students" ON classroom_students FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on classroom_materials" ON classroom_materials FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on saved_exams" ON saved_exams FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on exams" ON exams FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on exam_attempts" ON exam_attempts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on reviewers" ON reviewers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on question_bank" ON question_bank FOR ALL USING (true) WITH CHECK (true);
