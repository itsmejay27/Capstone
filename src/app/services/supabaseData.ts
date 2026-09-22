import { supabase } from '../config/supabaseClient';

// IDs in Supabase are configured as TEXT DEFAULT gen_random_uuid()::text.
// This allows deterministic IDs ('user-1', 'class-1', or UUIDs) to stay consistent
// across browser page reloads without foreign key mismatches.
export function toDbId(id: string): string {
  if (!id) return crypto.randomUUID();
  return id;
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
    password: u.password || '',
    name: u.name,
    role: u.role,
    avatar: u.avatar || undefined,
  }));
}

export async function upsertUser(user: { id: string; email: string; password?: string; name: string; role: string; avatar?: string }) {
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('users')
      .upsert(
        {
          id: toDbId(user.id),
          email: user.email,
          password: user.password || null,
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
// The previous version persisted only {id, classroom_id, name, file_url, file_type} and read
// back only {id, name, fileUrl, fileType}. Since the uploader never set fileUrl, file_url was
// always NULL, and size/type/uploadedAt/uploadedBy/content were dropped entirely — which is
// why a reloaded material rendered as "1.2 MB • Invalid Date" with a blank preview.
export async function fetchClassroomMaterials(): Promise<Record<string, any[]>> {
  if (!supabase) return {};
  const { data, error } = await supabase
    .from('classroom_materials')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    warn('fetchClassroomMaterials', error);
    return {};
  }
  const grouped: Record<string, any[]> = {};
  for (const m of data || []) {
    const key = m.classroom_id;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push({
      id: m.id,
      classroomId: m.classroom_id,
      name: m.name,
      fileUrl: m.file_url || undefined,
      storagePath: m.storage_path || null,
      isDataUrl: false, // data URLs are never written to Postgres
      fileType: m.file_type || undefined,
      type: m.mime_type || undefined,
      size: m.file_size ?? undefined,
      uploadedBy: m.uploaded_by || undefined,
      uploadedById: m.uploaded_by_id || undefined,
      content: m.content || undefined,
      uploadedAt: m.created_at || undefined,
    });
  }
  return grouped;
}

export async function insertClassroomMaterial(classroomId: string, material: any) {
  if (!supabase) return;
  // A base64 data URL is a local-only fallback; pushing megabytes of base64 into a TEXT
  // column would bloat every subsequent fetch, so the row is stored without the payload.
  const isInline = Boolean(material.isDataUrl);
  try {
    const { error } = await supabase.from('classroom_materials').upsert({
      id: toDbId(material.id),
      classroom_id: toDbId(classroomId),
      name: material.name,
      file_url: isInline ? null : material.fileUrl || null,
      file_type: material.fileType || null,
      storage_path: material.storagePath || null,
      mime_type: material.type || material.mimeType || null,
      file_size: Number.isFinite(material.size) ? material.size : null,
      uploaded_by: material.uploadedBy || null,
      uploaded_by_id: material.uploadedById ? toDbId(material.uploadedById) : null,
      content: material.content ? String(material.content).slice(0, 20000) : null,
    });
    if (error) {
      warn('insertClassroomMaterial', error);
      throw error;
    }
  } catch (e) {
    warn('insertClassroomMaterial', e);
    throw e;
  }
}

export async function deleteClassroomMaterialDb(materialId: string) {
  if (!supabase) return;
  try {
    const { error } = await supabase.from('classroom_materials').delete().eq('id', toDbId(materialId));
    if (error) {
      warn('deleteClassroomMaterialDb', error);
      throw error;
    }
  } catch (e) {
    warn('deleteClassroomMaterialDb', e);
    throw e;
  }
}

// ---- announcements (classroom stream) ----
export async function fetchAnnouncements(): Promise<Record<string, any[]>> {
  if (!supabase) return {};
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) {
    warn('fetchAnnouncements', error);
    return {};
  }
  const grouped: Record<string, any[]> = {};
  for (const a of data || []) {
    const key = a.classroom_id;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push({
      id: a.id,
      classroomId: a.classroom_id,
      authorId: a.author_id,
      authorName: a.author_name || 'Instructor',
      bodyHtml: a.body_html || '',
      attachments: Array.isArray(a.attachments) ? a.attachments : [],
      isPinned: !!a.is_pinned,
      createdAt: a.created_at,
      updatedAt: a.updated_at || undefined,
    });
  }
  return grouped;
}

export async function upsertAnnouncement(announcement: any) {
  if (!supabase) return;
  try {
    // Inline data-URL attachments stay local; only Storage-backed ones are durable.
    const attachments = (announcement.attachments || []).filter((att: any) => !att?.isDataUrl);
    const { error } = await supabase.from('announcements').upsert({
      id: toDbId(announcement.id),
      classroom_id: toDbId(announcement.classroomId),
      author_id: announcement.authorId ? toDbId(announcement.authorId) : null,
      author_name: announcement.authorName || null,
      body_html: announcement.bodyHtml || '',
      attachments,
      is_pinned: !!announcement.isPinned,
      updated_at: announcement.updatedAt || null,
    });
    if (error) {
      warn('upsertAnnouncement', error);
      throw error;
    }
  } catch (e) {
    warn('upsertAnnouncement', e);
    throw e;
  }
}

export async function deleteAnnouncementDb(announcementId: string) {
  if (!supabase) return;
  try {
    const { error } = await supabase.from('announcements').delete().eq('id', toDbId(announcementId));
    if (error) {
      warn('deleteAnnouncementDb', error);
      throw error;
    }
  } catch (e) {
    warn('deleteAnnouncementDb', e);
    throw e;
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
    // The per-attempt shuffled question/option snapshot. Item and distractor analysis are
    // impossible without it, because a stored multiple-choice answer is an index into the
    // order THIS student saw, not into the master question's option order.
    questions: Array.isArray(a.questions) ? a.questions : [],
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
      questions: Array.isArray(attempt.questions) ? attempt.questions : [],
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

export async function upsertQuestionBankItem(item: any) {
  if (!supabase) return;
  try {
    const { error } = await supabase.from('question_bank').upsert({
      id: toDbId(item.id),
      type: item.type,
      question: item.question,
      options: item.options || null,
      correct_answer: item.correctAnswer != null ? String(item.correctAnswer) : null,
      points: item.points || 1,
      difficulty: item.difficulty || 'easy',
      topic: item.topic || null,
      cognitive_level: item.cognitiveLevel || null,
      item_placement: item.itemPlacement || null,
      tags: item.tags || [],
      subject: item.subject || null,
      created_by: item.createdBy ? toDbId(item.createdBy) : null,
    });
    if (error) warn('upsertQuestionBankItem', error);
  } catch (e) {
    warn('upsertQuestionBankItem', e);
  }
}

export async function deleteQuestionBankItemDb(itemId: string) {
  if (!supabase) return;
  try {
    const { error } = await supabase.from('question_bank').delete().eq('id', toDbId(itemId));
    if (error) warn('deleteQuestionBankItemDb', error);
  } catch (e) {
    warn('deleteQuestionBankItemDb', e);
  }
}

