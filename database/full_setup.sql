-- =============================================================================
-- Occidental Mindoro State College (OMSC) Capstone System
-- AI-Powered Examination & Classroom Management System
-- FULL ALL-IN-ONE SETUP SCRIPT (SCHEMA + RLS + SEED DATA)
-- Run this entire script in your Supabase SQL Editor or PostgreSQL client.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. USERS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    email TEXT UNIQUE NOT NULL,
    password TEXT,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('instructor', 'student', 'admin')),
    avatar TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- -----------------------------------------------------------------------------
-- 2. CLASSROOMS TABLE
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 3. CLASSROOM STUDENTS (ENROLLMENTS)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS classroom_students (
    classroom_id TEXT REFERENCES classrooms(id) ON DELETE CASCADE,
    student_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (classroom_id, student_id)
);

-- -----------------------------------------------------------------------------
-- 4. CLASSROOM MATERIALS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS classroom_materials (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    classroom_id TEXT REFERENCES classrooms(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    file_url TEXT,
    file_type TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- -----------------------------------------------------------------------------
-- 5. SAVED EXAMS (EXAM REPOSITORY)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS saved_exams (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title TEXT NOT NULL,
    description TEXT,
    questions JSONB DEFAULT '[]'::jsonb NOT NULL,
    total_points NUMERIC DEFAULT 0 NOT NULL,
    duration INTEGER,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- -----------------------------------------------------------------------------
-- 6. EXAMS (ASSIGNED CLASSROOM EXAMS)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exams (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    source_exam_id TEXT REFERENCES saved_exams(id) ON DELETE SET NULL,
    classroom_id TEXT REFERENCES classrooms(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    questions JSONB DEFAULT '[]'::jsonb NOT NULL,
    total_points NUMERIC DEFAULT 0 NOT NULL,
    duration INTEGER,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    is_published BOOLEAN DEFAULT false NOT NULL,
    allowed_attempts INTEGER DEFAULT 1 NOT NULL,
    post_date TIMESTAMPTZ,
    due_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- -----------------------------------------------------------------------------
-- 7. EXAM ATTEMPTS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exam_attempts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    exam_id TEXT REFERENCES exams(id) ON DELETE CASCADE,
    student_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    answers JSONB DEFAULT '{}'::jsonb NOT NULL,
    score NUMERIC,
    started_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    submitted_at TIMESTAMPTZ
);

-- -----------------------------------------------------------------------------
-- 8. REVIEWERS TABLE
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- 9. QUESTION BANK TABLE
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- PERFORMANCE INDEXES
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- -----------------------------------------------------------------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE classroom_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE classroom_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_bank ENABLE ROW LEVEL SECURITY;

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

-- =============================================================================
-- SEED DATA
-- =============================================================================

-- Seed Users
INSERT INTO users (id, email, password, name, role, avatar, created_at)
VALUES
    ('user-1', 'prof.santos@omsc.edu.ph', 'instructor123', 'Dr. Maria Santos', 'instructor', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', now()),
    ('user-2', 'juan.cruz@student.omsc.edu.ph', 'student123', 'Juan Cruz', 'student', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150', now())
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    password = EXCLUDED.password,
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    avatar = EXCLUDED.avatar;

-- Seed Classrooms
INSERT INTO classrooms (id, name, subject, section, instructor_id, class_code, description, is_archived, created_at)
VALUES
    ('class-1', 'Web Development 101', 'Computer Science', 'BSCS 3-A', 'user-1', 'WEB101-2024', 'Introduction to Web Development using HTML, CSS, JavaScript, and modern frameworks.', false, '2024-01-15T00:00:00Z'),
    ('class-2', 'Database Systems', 'Computer Science', 'BSCS 3-A', 'user-1', 'DB301-2024', 'Advanced concepts in database design, SQL, normalization, and database management systems.', false, '2024-01-15T00:00:00Z'),
    ('class-3', 'Artificial Intelligence Fundamentals', 'Computer Science', 'BSCS 4-B', 'user-1', 'AI401-2024', 'Introduction to AI concepts including machine learning, neural networks, and LLMs.', false, '2024-02-01T00:00:00Z')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    subject = EXCLUDED.subject,
    section = EXCLUDED.section,
    instructor_id = EXCLUDED.instructor_id,
    class_code = EXCLUDED.class_code,
    description = EXCLUDED.description,
    is_archived = EXCLUDED.is_archived;

-- Seed Enrollments
INSERT INTO classroom_students (classroom_id, student_id, joined_at)
VALUES
    ('class-1', 'user-2', '2024-01-16T00:00:00Z'),
    ('class-2', 'user-2', '2024-01-16T00:00:00Z')
ON CONFLICT (classroom_id, student_id) DO NOTHING;

-- Seed Materials
INSERT INTO classroom_materials (id, classroom_id, name, file_url, file_type, created_at)
VALUES
    ('mat-1', 'class-1', 'Web_Development_101_Syllabus.pdf', 'https://example.com/syllabus.pdf', 'pdf', '2024-01-16T00:00:00Z'),
    ('mat-2', 'class-2', 'Database_Normalization_Lecture_Notes.pdf', 'https://example.com/db_notes.pdf', 'pdf', '2024-01-16T00:00:00Z')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    file_url = EXCLUDED.file_url,
    file_type = EXCLUDED.file_type;

-- Seed Saved Exams (Repository)
INSERT INTO saved_exams (id, title, description, questions, total_points, duration, created_by, created_at)
VALUES
    ('se-template-1',
     'Diagnostic Quiz - JavaScript Mechanics',
     'Comprehensive diagnostic exam covering scope, hoisting, closures, and async event loops.',
     '[
        {
          "id": "q-seq-1",
          "type": "multiple-choice",
          "question": "What is the output of console.log(typeof NaN)?",
          "options": ["\"number\"", "\"NaN\"", "\"undefined\"", "\"object\""],
          "correctAnswer": 0,
          "points": 2,
          "difficulty": "medium",
          "topic": "JavaScript Types"
        },
        {
          "id": "q-seq-2",
          "type": "true-false",
          "question": "JavaScript event loop pushes microtasks (Promises) before macrotasks (setTimeout).",
          "correctAnswer": "true",
          "points": 2,
          "difficulty": "hard",
          "topic": "Event Loop"
        }
     ]'::jsonb,
     4,
     30,
     'user-1',
     '2024-02-01T00:00:00Z')
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    questions = EXCLUDED.questions,
    total_points = EXCLUDED.total_points,
    duration = EXCLUDED.duration;

-- Seed Active Exams
INSERT INTO exams (id, source_exam_id, classroom_id, title, description, questions, total_points, duration, created_by, is_published, allowed_attempts, post_date, due_date, created_at)
VALUES
    ('exam-1',
     'se-template-1',
     'class-1',
     'Midterm Examination - Web Development',
     'Covers HTML, CSS, and JavaScript fundamentals from weeks 1-8.',
     '[
        {
          "id": "q-1",
          "type": "multiple-choice",
          "question": "What does HTML stand for?",
          "options": [
            "Hyper Text Markup Language",
            "High Tech Modern Language",
            "Home Tool Markup Language",
            "Hyperlinks and Text Markup Language"
          ],
          "correctAnswer": 0,
          "points": 2,
          "difficulty": "easy",
          "topic": "HTML Basics"
        },
        {
          "id": "q-2",
          "type": "multiple-choice",
          "question": "Which CSS property is used to change the text color of an element?",
          "options": ["text-color", "font-color", "color", "text-style"],
          "correctAnswer": 2,
          "points": 2,
          "difficulty": "easy",
          "topic": "CSS Basics"
        },
        {
          "id": "q-3",
          "type": "multiple-choice",
          "question": "What is the correct way to declare a JavaScript variable?",
          "options": ["var name = \"John\"", "variable name = \"John\"", "v name = \"John\"", "declare name = \"John\""],
          "correctAnswer": 0,
          "points": 2,
          "difficulty": "easy",
          "topic": "JavaScript Basics"
        },
        {
          "id": "q-4",
          "type": "true-false",
          "question": "React is a JavaScript library for building user interfaces.",
          "correctAnswer": "true",
          "points": 1,
          "difficulty": "easy",
          "topic": "React Fundamentals"
        }
     ]'::jsonb,
     7,
     60,
     'user-1',
     true,
     1,
     '2024-03-10T00:00:00Z',
     '2026-12-31T23:59:59Z',
     '2024-03-10T00:00:00Z'),
    ('exam-2',
     NULL,
     'class-1',
     'Quiz 1 - HTML & CSS',
     'Short quiz covering basic HTML structure and CSS styling.',
     '[
        {
          "id": "q-1",
          "type": "multiple-choice",
          "question": "What does HTML stand for?",
          "options": [
            "Hyper Text Markup Language",
            "High Tech Modern Language",
            "Home Tool Markup Language",
            "Hyperlinks and Text Markup Language"
          ],
          "correctAnswer": 0,
          "points": 2,
          "difficulty": "easy",
          "topic": "HTML Basics"
        },
        {
          "id": "q-2",
          "type": "multiple-choice",
          "question": "Which CSS property is used to change the text color of an element?",
          "options": ["text-color", "font-color", "color", "text-style"],
          "correctAnswer": 2,
          "points": 2,
          "difficulty": "easy",
          "topic": "CSS Basics"
        }
     ]'::jsonb,
     4,
     20,
     'user-1',
     true,
     2,
     '2024-02-15T00:00:00Z',
     '2026-12-31T23:59:59Z',
     '2024-02-15T00:00:00Z')
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    questions = EXCLUDED.questions,
    total_points = EXCLUDED.total_points,
    duration = EXCLUDED.duration,
    is_published = EXCLUDED.is_published,
    allowed_attempts = EXCLUDED.allowed_attempts,
    post_date = EXCLUDED.post_date,
    due_date = EXCLUDED.due_date;

-- Seed Exam Attempts
INSERT INTO exam_attempts (id, exam_id, student_id, answers, score, started_at, submitted_at)
VALUES
    ('attempt-1', 'exam-2', 'user-2', '{"q-1": 0, "q-2": 2}'::jsonb, 4, '2024-02-20T10:00:00Z', '2024-02-20T10:15:00Z')
ON CONFLICT (id) DO UPDATE SET
    answers = EXCLUDED.answers,
    score = EXCLUDED.score,
    submitted_at = EXCLUDED.submitted_at;

-- Seed Reviewers
INSERT INTO reviewers (id, title, subject, difficulty, difficulty_label, module_count, items_per_module, source, status, current_module_index, modules, created_by, created_at)
VALUES
    ('rev-1',
     'Comprehensive Web Development Reviewer',
     'Web Development',
     'medium',
     'Intermediate Level',
     2,
     5,
     'Generated from Web Development 101 Syllabus',
     'ready',
     0,
     '[
        {
          "moduleIndex": 1,
          "title": "HTML5 & Semantic Architecture",
          "overview": "Mastering the foundational building blocks of accessible web pages.",
          "items": [
            {
              "question": "What is the primary function of semantic HTML5 elements like <header>, <main>, and <footer>?",
              "answer": "They provide meaningful structural context to screen readers, search engines, and browsers rather than purely visual formatting.",
              "keyTakeaway": "Semantic HTML enhances accessibility (a11y) and SEO without needing extra CSS classes."
            },
            {
              "question": "How does the <section> tag differ from <div>?",
              "answer": "A <section> represents a standalone thematic grouping of content, typically with a heading, whereas <div> is a purely stylistic, generic container.",
              "keyTakeaway": "Use <div> only when no other semantic element applies."
            }
          ]
        },
        {
          "moduleIndex": 2,
          "title": "CSS Modern Layouts: Flexbox & Grid",
          "overview": "Constructing responsive, high-performance web user interfaces.",
          "items": [
            {
              "question": "When should CSS Grid be chosen over CSS Flexbox?",
              "answer": "CSS Grid is 2-dimensional (handling rows and columns simultaneously), ideal for overall page layouts; Flexbox is 1-dimensional (row OR column), ideal for element alignment within containers.",
              "keyTakeaway": "Use Grid for layout framing and Flexbox for element alignment within containers."
            }
          ]
        }
     ]'::jsonb,
     'user-1',
     now())
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    subject = EXCLUDED.subject,
    difficulty = EXCLUDED.difficulty,
    modules = EXCLUDED.modules,
    status = EXCLUDED.status;

-- Seed Question Bank
INSERT INTO question_bank (id, type, question, options, correct_answer, points, difficulty, topic, cognitive_level, item_placement, tags, subject, created_by, created_at)
VALUES
    ('qb-1',
     'multiple-choice',
     'What is normalization in database design?',
     '["Process of organizing data to reduce redundancy", "Process of creating backup copies", "Process of encrypting data", "Process of indexing tables"]'::jsonb,
     '0',
     3,
     'medium',
     'Database Design',
     'Understanding',
     'Midterm Part II',
     '["database", "normalization", "design"]'::jsonb,
     'Database Systems',
     'user-1',
     '2024-03-01T00:00:00Z'),
    ('qb-2',
     'multiple-choice',
     'Which SQL command is used to retrieve data from a database?',
     '["GET", "SELECT", "RETRIEVE", "FETCH"]'::jsonb,
     '1',
     2,
     'easy',
     'SQL Basics',
     'Remembering',
     'Quiz 1',
     '["sql", "queries"]'::jsonb,
     'Database Systems',
     'user-1',
     '2024-03-01T00:00:00Z'),
    ('qb-3',
     'essay',
     'Discuss the advantages and disadvantages of using NoSQL databases compared to traditional relational databases. Provide specific examples.',
     NULL,
     'A comprehensive answer should evaluate ACID transactions vs BASE consistency, horizontal scalability, schema flexibility, and specific workloads.',
     10,
     'hard',
     'Database Comparison',
     'Evaluation',
     'Final Exam Essay',
     '["database", "nosql", "comparison"]'::jsonb,
     'Database Systems',
     'user-1',
     '2024-03-05T00:00:00Z'),
    ('q-1',
     'multiple-choice',
     'What does HTML stand for?',
     '["Hyper Text Markup Language", "High Tech Modern Language", "Home Tool Markup Language", "Hyperlinks and Text Markup Language"]'::jsonb,
     '0',
     2,
     'easy',
     'HTML Basics',
     'Remembering',
     'Item 1',
     '["html", "basics"]'::jsonb,
     'Web Development',
     'user-1',
     '2024-03-01T00:00:00Z'),
    ('q-2',
     'multiple-choice',
     'Which CSS property is used to change the text color of an element?',
     '["text-color", "font-color", "color", "text-style"]'::jsonb,
     '2',
     2,
     'easy',
     'CSS Basics',
     'Remembering',
     'Item 2',
     '["css", "styling"]'::jsonb,
     'Web Development',
     'user-1',
     '2024-03-01T00:00:00Z'),
    ('q-3',
     'multiple-choice',
     'What is the correct way to declare a JavaScript variable?',
     '["var name = \"John\"", "variable name = \"John\"", "v name = \"John\"", "declare name = \"John\""]'::jsonb,
     '0',
     2,
     'easy',
     'JavaScript Basics',
     'Remembering',
     'Item 3',
     '["javascript", "syntax"]'::jsonb,
     'Web Development',
     'user-1',
     '2024-03-01T00:00:00Z'),
    ('q-4',
     'true-false',
     'React is a JavaScript library for building user interfaces.',
     NULL,
     'true',
     1,
     'easy',
     'React Fundamentals',
     'Understanding',
     'Item 4',
     '["react", "library"]'::jsonb,
     'Web Development',
     'user-1',
     '2024-03-05T00:00:00Z'),
    ('q-5',
     'short-answer',
     'Explain the difference between let and const in JavaScript.',
     NULL,
     'let allows variable reassignment and has block scope; const declares a block-scoped binding that cannot be reassigned.',
     5,
     'medium',
     'JavaScript ES6',
     'Analysis',
     'Item 5',
     '["javascript", "es6", "scoping"]'::jsonb,
     'Web Development',
     'user-1',
     '2024-03-05T00:00:00Z')
ON CONFLICT (id) DO UPDATE SET
    question = EXCLUDED.question,
    options = EXCLUDED.options,
    correct_answer = EXCLUDED.correct_answer,
    points = EXCLUDED.points,
    difficulty = EXCLUDED.difficulty,
    tags = EXCLUDED.tags,
    subject = EXCLUDED.subject;
