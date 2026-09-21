# Database Setup Guide & Documentation
## Occidental Mindoro State College (OMSC) Capstone System
### AI-Powered Examination & Classroom Management System

This guide provides step-by-step instructions for creating, configuring, and connecting the database for the system.

---

## 📋 System Database Overview

The system uses **PostgreSQL** hosted on **Supabase** (or any standard PostgreSQL instance). It contains **9 core tables** supporting all classroom, AI exam generation, question banking, and student attempt workflows:

| Table Name | Description | Key Relationships |
| :--- | :--- | :--- |
| `users` | Instructors, students, and system administrators | Primary actor in all modules |
| `classrooms` | Academic courses and sections | Managed by `users.id` (Instructor) |
| `classroom_students` | Student classroom enrollments (Many-to-Many) | Junction between `classrooms` & `users` |
| `classroom_materials` | Course syllabus, TOS, PDF documents, and lecture files | Belongs to `classrooms` |
| `saved_exams` | Exam Repository / reusable examination templates | Created by `users.id` (Instructor) |
| `exams` | Active/published examinations assigned to classrooms | Belongs to `classrooms`, references `saved_exams` |
| `exam_attempts` | Student submissions, item answers, timings, and scores | Belongs to `exams` and `users` (Student) |
| `reviewers` | AI-generated interactive review packages & flashcards | Created by `users.id` |
| `question_bank` | Reusable items categorized by cognitive levels, tags, and topics | Created by `users.id` |

---

## 🚀 Quick Setup (Recommended: Free Supabase Cloud)

You can set up your database in about **2 minutes** using Supabase's free tier.

### Step 1: Create a Supabase Project
1. Go to [https://supabase.com](https://supabase.com) and sign in (or create a free account).
2. Click **"New project"**.
3. Fill in your project details:
   - **Name**: `omsc-ai-classroom` (or any name you prefer)
   - **Database Password**: Choose a secure password (save it in a safe place)
   - **Region**: Choose the closest region (e.g., `Singapore - ap-southeast-1` or closest to Philippines)
4. Click **"Create new project"** and wait ~1 minute for provisioning to complete.

---

### Step 2: Run the Database Schema & Seed Data
1. In your Supabase project dashboard, click on the **SQL Editor** icon in the left navigation sidebar (looks like `>_` or SQL terminal).
2. Click **"New query"**.
3. Open the file [database/full_setup.sql](file:///c:/Users/John%20Carlo/Downloads/Capstone-AI-Generated-Quiz-Classroom-main_2.0-feature-my-updates/Capstone-AI-Generated-Quiz-Classroom-main_2.0-feature-my-updates/database/full_setup.sql) from your workspace.
4. Copy its entire content, paste it into the Supabase SQL Editor query window.
5. Click **"Run"** (or press `Ctrl` + `Enter`).
6. You will see `Success. No rows returned` or a list of affected rows.
   - All 9 tables, indexes, Row Level Security (RLS) policies, and demo seed records are now created!

> [!TIP]
> Alternatively, you can run `database/schema.sql` (schema only) followed by `database/seed.sql` (sample data only).

---

### Step 3: Configure Your `.env` File
1. In the Supabase Dashboard, go to **Project Settings** (gear icon at the bottom left) -> **API**.
2. Locate the following two values:
   - **Project URL** (e.g., `https://xyzcompany.supabase.co`)
   - **Project API Keys** -> `anon` / `public` (starts with `eyJhbGciOi...` or `sb_publishable_...`)
3. In your project workspace, open your `.env` file and add:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```
4. Save the `.env` file.

---

### Step 4: Verify Your Database Connection
Run the automated diagnostic script in your terminal:
```bash
node scripts/test_db_connection.js
```
You will see output verifying connectivity to all 9 tables:
```
=============================================================
  OMSC Capstone AI System - Database Health Diagnostic
=============================================================

Connecting to Supabase at: https://xxxxxxxxxxxx.supabase.co
✅ Table [users]: OK (Found 2 rows)
✅ Table [classrooms]: OK (Found 3 rows)
✅ Table [classroom_students]: OK (Found 2 rows)
✅ Table [classroom_materials]: OK (Found 2 rows)
✅ Table [saved_exams]: OK (Found 1 rows)
✅ Table [exams]: OK (Found 2 rows)
✅ Table [exam_attempts]: OK (Found 1 rows)
✅ Table [reviewers]: OK (Found 1 rows)
✅ Table [question_bank]: OK (Found 8 rows)

-------------------------------------------------------------
Diagnostic Summary: 9/9 tables verified.
🎉 Database is fully configured and ready for production/demo use!
-------------------------------------------------------------
```

---

### Step 5: Start the Application
Start the development server:
```bash
npm run dev
```
Open your browser at the local URL (typically `http://localhost:5173`).

---

## 🔑 Pre-Seeded Demo Accounts

The seed script initializes the following credentials matching your Capstone prototype:

| Role | Name | Email | Password |
| :--- | :--- | :--- | :--- |
| **Instructor** | Dr. Maria Santos | `prof.santos@omsc.edu.ph` | `instructor123` |
| **Student** | Juan Cruz | `juan.cruz@student.omsc.edu.ph` | `student123` |

You can also use **Google One-Tap Sign-In** with any real Google account. The database will automatically register and persist new Google accounts in the `users` table upon their first login.

---

## 🔒 Security & Row Level Security (RLS)

- **Row Level Security** is enabled on all 9 tables.
- Standard permissive policies (`FOR ALL USING (true) WITH CHECK (true)`) are provided by default to allow smooth development, testing, and capstone presentation without authentication hurdles.
- If you wish to restrict student access from editing exams in production later, you can replace the policies with role-based checks (`auth.jwt() ->> 'role' = 'instructor'`).

---

## 📁 Database Files in This Project

- **[database/full_setup.sql](file:///c:/Users/John%20Carlo/Downloads/Capstone-AI-Generated-Quiz-Classroom-main_2.0-feature-my-updates/Capstone-AI-Generated-Quiz-Classroom-main_2.0-feature-my-updates/database/full_setup.sql)**: All-in-one script containing table schemas, indexes, RLS, and seed data.
- **[database/schema.sql](file:///c:/Users/John%20Carlo/Downloads/Capstone-AI-Generated-Quiz-Classroom-main_2.0-feature-my-updates/Capstone-AI-Generated-Quiz-Classroom-main_2.0-feature-my-updates/database/schema.sql)**: Standalone table definitions, foreign keys, and RLS policies.
- **[database/seed.sql](file:///c:/Users/John%20Carlo/Downloads/Capstone-AI-Generated-Quiz-Classroom-main_2.0-feature-my-updates/Capstone-AI-Generated-Quiz-Classroom-main_2.0-feature-my-updates/database/seed.sql)**: Pre-populated sample classrooms, exams, attempts, questions, and reviewer modules.
- **[supabase/schema.sql](file:///c:/Users/John%20Carlo/Downloads/Capstone-AI-Generated-Quiz-Classroom-main_2.0-feature-my-updates/Capstone-AI-Generated-Quiz-Classroom-main_2.0-feature-my-updates/supabase/schema.sql)**: Mirror copy formatted for Supabase CLI.
- **[scripts/test_db_connection.js](file:///c:/Users/John%20Carlo/Downloads/Capstone-AI-Generated-Quiz-Classroom-main_2.0-feature-my-updates/Capstone-AI-Generated-Quiz-Classroom-main_2.0-feature-my-updates/scripts/test_db_connection.js)**: Automated verification script to test table health and connectivity.
