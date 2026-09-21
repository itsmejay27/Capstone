import { supabase } from '../config/supabaseClient';

// Bridge between the app's client-generated IDs (e.g. "class-172...") and Supabase's uuid
// primary keys. Local state always keeps the original id so every page keeps working
// unchanged; this only translates the id used when mirroring to Supabase.
//
// The mapping must be deterministic: a random uuid per session would give the same
// "user-1" a different id on every page load and on every device, so foreign keys
// between rows written at different times could never line up.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function hash32(input: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function toDbId(id: string): string {
  if (UUID_RE.test(id)) return id;
  const hex = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35]
    .map((seed) => hash32(id, seed).toString(16).padStart(8, '0'))
    .join('');
  // Force the RFC-4122 version/variant nibbles so the result is a well-formed uuid.
  const v =
    hex.slice(0, 12) +
    '4' +
    hex.slice(13, 16) +
    (((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16)) +
    hex.slice(17, 32);
  return `${v.slice(0, 8)}-${v.slice(8, 12)}-${v.slice(12, 16)}-${v.slice(16, 20)}-${v.slice(20, 32)}`;
}

function warn(op: string, error: unknown) {
  console.warn(`[supabase] ${op} failed (falling back to local state only):`, error);
}

// ---- users ----
export async function fetchUsers() {
  if (!supabase) return [];
  const { data, error } = await supabase.from('users').select('*');
  if (error) {
    warn('fetchUsers', error);
    return [];
  }
  return (data || []).map((u: any) => ({
    id: u.id,
    email: u.email,
    password: '',
    name: u.name,
    role: u.role,
    avatar: u.avatar || undefined,
  }));
}

export async function upsertUser(user: { id: string; email: string; name: string; role: string; avatar?: string }) {
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('users')
      .upsert(
        {
          id: toDbId(user.id),
          email: user.email,
          name: user.name,
          role: user.role,
          avatar: user.avatar || null,
        },
        // Conflict on the primary key, never on email: the id is what every other
        // table's foreign key points at, so it must stay stable.
        { onConflict: 'id' }
      );
    if (error) warn('upsertUser', error);
  } catch (e) {
    warn('upsertUser', e);
  }
}

// ---- classrooms ----
export async function fetchClassrooms() {
  if (!supabase) return [];
  const { data, error } = await supabase.from('classrooms').select('*, classroom_students(student_id)');
  if (error) {
    warn('fetchClassrooms', error);
    return [];
  }
  return (data || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    subject: c.subject,
    section: c.section,
    instructorId: c.instructor_id,
    classCode: c.class_code,
    students: (c.classroom_students || []).map((s: any) => s.student_id),
    createdAt: c.created_at,
    description: c.description || undefined,
    isArchived: c.is_archived,
  }));
}

export async function upsertClassroom(classroom: any) {
  if (!supabase) return;
  try {
    const { error } = await supabase.from('classrooms').upsert({
      id: toDbId(classroom.id),
      name: classroom.name,
      subject: classroom.subject,
      section: classroom.section,
      instructor_id: toDbId(classroom.instructorId),
      class_code: classroom.classCode,
      description: classroom.description || null,
      is_archived: !!classroom.isArchived,
    });
    if (error) warn('upsertClassroom', error);
  } catch (e) {
    warn('upsertClassroom', e);
  }
}

export async function addClassroomStudent(classroomId: string, studentId: string) {
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('classroom_students')
      .upsert({ classroom_id: toDbId(classroomId), student_id: toDbId(studentId) });
    if (error) warn('addClassroomStudent', error);
  } catch (e) {
    warn('addClassroomStudent', e);
  }
}

// ---- classroom materials ----
export async function fetchClassroomMaterials(): Promise<Record<string, any[]>> {
  if (!supabase) return {};
  const { data, error } = await supabase.from('classroom_materials').select('*');
  if (error) {
    warn('fetchClassroomMaterials', error);
    return {};
  }
  const grouped: Record<string, any[]> = {};
  for (const m of data || []) {
    const key = m.classroom_id;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push({ id: m.id, name: m.name, fileUrl: m.file_url, fileType: m.file_type });
  }
  return grouped;
}

export async function insertClassroomMaterial(classroomId: string, material: any) {
  if (!supabase) return;
  try {
    const { error } = await supabase.from('classroom_materials').insert({
      id: toDbId(material.id),
      classroom_id: toDbId(classroomId),
      name: material.name,
      file_url: material.fileUrl || null,
      file_type: material.fileType || material.type || null,
    });
    if (error) warn('insertClassroomMaterial', error);
  } catch (e) {
    warn('insertClassroomMaterial', e);
  }
}

export async function deleteClassroomMaterialDb(materialId: string) {
  if (!supabase) return;
  try {
    const { error } = await supabase.from('classroom_materials').delete().eq('id', toDbId(materialId));
    if (error) warn('deleteClassroomMaterialDb', error);
  } catch (e) {
    warn('deleteClassroomMaterialDb', e);
  }
}

// ---- saved exams (repository) ----
export async function fetchSavedExams() {
  if (!supabase) return [];
  const { data, error } = await supabase.from('saved_exams').select('*');
  if (error) {
    warn('fetchSavedExams', error);
    return [];
  }
  return (data || []).map((e: any) => ({
    id: e.id,
    title: e.title,
    description: e.description || '',
    questions: e.questions || [],
    totalPoints: e.total_points,
    duration: e.duration || undefined,
    createdBy: e.created_by,
    createdAt: e.created_at,
  }));
}

export async function upsertSavedExam(exam: any) {
  if (!supabase) return;
  try {
    const { error } = await supabase.from('saved_exams').upsert({
      id: toDbId(exam.id),
      title: exam.title,
      description: exam.description || null,
      questions: exam.questions || [],
      total_points: exam.totalPoints || 0,
      duration: exam.duration || null,
      created_by: exam.createdBy ? toDbId(exam.createdBy) : null,
    });
    if (error) warn('upsertSavedExam', error);
  } catch (e) {
    warn('upsertSavedExam', e);
  }
}

export async function deleteSavedExamDb(examId: string) {
  if (!supabase) return;
  try {
    const { error } = await supabase.from('saved_exams').delete().eq('id', toDbId(examId));
    if (error) warn('deleteSavedExamDb', error);
  } catch (e) {
    warn('deleteSavedExamDb', e);
  }
}

// ---- exams (assigned to classrooms) ----
export async function fetchExams() {
  if (!supabase) return [];
  const { data, error } = await supabase.from('exams').select('*');
  if (error) {
    warn('fetchExams', error);
    return [];
  }
  return (data || []).map((e: any) => ({
    id: e.id,
    sourceExamId: e.source_exam_id || undefined,
    title: e.title,
    description: e.description || '',
    classroomId: e.classroom_id,
    questions: e.questions || [],
    totalPoints: e.total_points,
    duration: e.duration || undefined,
    createdBy: e.created_by,
    createdAt: e.created_at,
    isPublished: e.is_published,
    allowedAttempts: e.allowed_attempts,
    postDate: e.post_date || undefined,
    dueDate: e.due_date || undefined,
  }));
}

export async function upsertExam(exam: any) {
  if (!supabase) return;
  try {
    const { error } = await supabase.from('exams').upsert({
      id: toDbId(exam.id),
      source_exam_id: exam.sourceExamId ? toDbId(exam.sourceExamId) : null,
      title: exam.title,
      description: exam.description || null,
      classroom_id: toDbId(exam.classroomId),
      questions: exam.questions || [],
      total_points: exam.totalPoints || 0,
      duration: exam.duration || null,
      created_by: exam.createdBy ? toDbId(exam.createdBy) : null,
      is_published: !!exam.isPublished,
      allowed_attempts: exam.allowedAttempts || 1,
      post_date: exam.postDate || null,
      due_date: exam.dueDate || null,
    });
    if (error) warn('upsertExam', error);
  } catch (e) {
    warn('upsertExam', e);
  }
}

export async function deleteExamDb(examId: string) {
  if (!supabase) return;
  try {
    const { error } = await supabase.from('exams').delete().eq('id', toDbId(examId));
    if (error) warn('deleteExamDb', error);
  } catch (e) {
    warn('deleteExamDb', e);
  }
}

// ---- exam attempts ----
export async function fetchExamAttempts() {
  if (!supabase) return [];
  const { data, error } = await supabase.from('exam_attempts').select('*');
  if (error) {
    warn('fetchExamAttempts', error);
    return [];
  }
  return (data || []).map((a: any) => ({
    id: a.id,
    examId: a.exam_id,
    studentId: a.student_id,
    answers: a.answers || {},
    score: a.score ?? undefined,
    startedAt: a.started_at,
    submittedAt: a.submitted_at || undefined,
  }));
}

export async function upsertExamAttempt(attempt: any) {
  if (!supabase) return;
  try {
    const { error } = await supabase.from('exam_attempts').upsert({
      id: toDbId(attempt.id),
      exam_id: toDbId(attempt.examId),
      student_id: toDbId(attempt.studentId),
      answers: attempt.answers || {},
      score: attempt.score ?? null,
      started_at: attempt.startedAt,
      submitted_at: attempt.submittedAt || null,
    });
    if (error) warn('upsertExamAttempt', error);
  } catch (e) {
    warn('upsertExamAttempt', e);
  }
}

// ---- reviewers ----
export async function fetchReviewers() {
  if (!supabase) return [];
  const { data, error } = await supabase.from('reviewers').select('*');
  if (error) {
    warn('fetchReviewers', error);
    return [];
  }
  return (data || []).map((r: any) => ({
    id: r.id,
    title: r.title,
    subject: r.subject || undefined,
    difficulty: r.difficulty || undefined,
    difficultyLabel: r.difficulty_label || undefined,
    moduleCount: r.module_count,
    itemsPerModule: r.items_per_module,
    source: r.source || undefined,
    status: r.status,
    currentModuleIndex: r.current_module_index,
    modules: r.modules || [],
    createdBy: r.created_by,
    createdAt: r.created_at,
  }));
}

export async function upsertReviewer(reviewer: any) {
  if (!supabase) return;
  try {
    const { error } = await supabase.from('reviewers').upsert({
      id: toDbId(reviewer.id),
      title: reviewer.title,
      subject: reviewer.subject || null,
      difficulty: reviewer.difficulty || null,
      difficulty_label: reviewer.difficultyLabel || null,
      module_count: reviewer.moduleCount || 0,
      items_per_module: reviewer.itemsPerModule || 0,
      source: reviewer.source || null,
      status: reviewer.status || 'in-progress',
      current_module_index: reviewer.currentModuleIndex || 0,
      modules: reviewer.modules || [],
      created_by: reviewer.createdBy ? toDbId(reviewer.createdBy) : null,
    });
    if (error) warn('upsertReviewer', error);
  } catch (e) {
    warn('upsertReviewer', e);
  }
}

export async function deleteReviewerDb(reviewerId: string) {
  if (!supabase) return;
  try {
    const { error } = await supabase.from('reviewers').delete().eq('id', toDbId(reviewerId));
    if (error) warn('deleteReviewerDb', error);
  } catch (e) {
    warn('deleteReviewerDb', e);
  }
}

// ---- question bank ----
export async function fetchQuestionBank() {
  if (!supabase) return [];
  const { data, error } = await supabase.from('question_bank').select('*');
  if (error) {
    warn('fetchQuestionBank', error);
    return [];
  }
  return (data || []).map((q: any) => ({
    id: q.id,
    type: q.type,
    question: q.question,
    options: q.options || undefined,
    correctAnswer: q.correct_answer ?? undefined,
    points: q.points,
    difficulty: q.difficulty,
    topic: q.topic || undefined,
    cognitiveLevel: q.cognitive_level || undefined,
    itemPlacement: q.item_placement || undefined,
    createdBy: q.created_by,
    createdAt: q.created_at,
    tags: q.tags || undefined,
    subject: q.subject || undefined,
  }));
}
