// =============================================================================
// Occidental Mindoro State College (OMSC) Capstone System
// Database Connection & Table Health Verification Script
// Run: node scripts/test_db_connection.js
// =============================================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Helper to load .env variables
function loadEnv() {
  const envPath = path.join(rootDir, '.env');
  const envLocalPath = path.join(rootDir, '.env.local');
  const activePath = fs.existsSync(envLocalPath) ? envLocalPath : (fs.existsSync(envPath) ? envPath : null);

  if (!activePath) return {};

  const content = fs.readFileSync(activePath, 'utf8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      env[key] = val;
    }
  }
  return env;
}

async function verifyDatabase() {
  console.log('\n=============================================================');
  console.log('  OMSC Capstone AI System - Database Health Diagnostic');
  console.log('=============================================================\n');

  const env = loadEnv();
  const supabaseUrl = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('<your-project-ref>')) {
    console.warn('⚠️  Supabase environment variables are not set or contain placeholder values.');
    console.log('   Current VITE_SUPABASE_URL:', supabaseUrl || '(not set)');
    console.log('   Current VITE_SUPABASE_ANON_KEY:', supabaseKey ? '***' + supabaseKey.slice(-6) : '(not set)');
    console.log('\n👉 ACTION REQUIRED:');
    console.log('   1. Create a free project at https://supabase.com');
    console.log('   2. Run database/full_setup.sql in your Supabase SQL Editor');
    console.log('   3. Add your Project URL & Anon Key to your .env file:');
    console.log('      VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co');
    console.log('      VITE_SUPABASE_ANON_KEY=eyJhbGciOi...');
    console.log('\n   See DATABASE_SETUP.md for detailed instructions.\n');
    return;
  }

  console.log(`Connecting to Supabase at: ${supabaseUrl}`);
  const supabase = createClient(supabaseUrl, supabaseKey);

  const tables = [
    'users',
    'classrooms',
    'classroom_students',
    'classroom_materials',
    'saved_exams',
    'exams',
    'exam_attempts',
    'reviewers',
    'question_bank',
  ];

  let passed = 0;
  let failed = 0;

  for (const table of tables) {
    try {
      const { data, count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: false })
        .limit(3);

      if (error) {
        console.error(`❌ Table [${table}]: ERROR -> ${error.message} (Code: ${error.code})`);
        failed++;
      } else {
        const rowCount = count !== null ? count : (data ? data.length : 0);
        console.log(`✅ Table [${table}]: OK (Found ${rowCount} rows)`);
        passed++;
      }
    } catch (err) {
      console.error(`❌ Table [${table}]: Network or execution error:`, err.message);
      failed++;
    }
  }

  console.log('\n-------------------------------------------------------------');
  console.log(`Diagnostic Summary: ${passed}/${tables.length} tables verified.`);
  if (failed === 0) {
    console.log('🎉 Database is fully configured and ready for production/demo use!');
  } else {
    console.log(`⚠️  ${failed} tables failed. Please run database/full_setup.sql in the Supabase SQL Editor.`);
  }
  console.log('-------------------------------------------------------------\n');
}

verifyDatabase();
