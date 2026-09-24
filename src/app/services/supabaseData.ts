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
    termsAcceptedAt: u.terms_accepted_at || undefined,
    ollamaServerUrl: u.ollama_server_url || undefined,
    emailVerified: u.email_verified !== false,
  }));
}

export async function upsertUser(user: { id: string; email: string; password?: string; name: string; role: string; avatar?: string; termsAcceptedAt?: string; ollamaServerUrl?: string }) {
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
          ...(user.termsAcceptedAt ? { terms_accepted_at: user.termsAcceptedAt } : {}),
          ...(user.ollamaServerUrl !== undefined ? { ollama_server_url: user.ollamaServerUrl || null } : {}),
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
    level: c.level || '',
    room: c.room || '',
    theme: c.theme || undefined,
    coInstructors: Array.isArray(c.co_instructors) ? c.co_instructors : [],
    coteachToken: c.coteach_token || undefined,
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
    level: classroom.level || null,
    room: classroom.room || null,
    theme: classroom.theme || null,
    co_instructors: Array.isArray(classroom.coInstructors) ? classroom.coInstructors : [],
    coteach_token: classroom.coteachToken || null,
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
    sourceFiles: Array.isArray(e.source_files) ? e.source_files : [],
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
      source_files: exam.sourceFiles || [],
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
    // Per-assignment detail, set when a template is posted to a class.
    instructions: e.instructions || '',
    topicId: e.topic_id || undefined,
    allowLate: !!e.allow_late,
    shuffleQuestions: !!e.shuffle_questions,
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
      instructions: exam.instructions || null,
      topic_id: exam.topicId ? toDbId(exam.topicId) : null,
      allow_late: !!exam.allowLate,
      shuffle_questions: !!exam.shuffleQuestions,
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
    timing: a.timing || undefined,
    integrity: a.integrity || undefined,
    manualScores: a.manual_scores || undefined,
    gradingStatus: a.grading_status || undefined,
    gradedAt: a.graded_at || undefined,
    feedback: a.feedback || undefined,
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
      timing: attempt.timing || null,
      integrity: attempt.integrity || null,
      manual_scores: attempt.manualScores || null,
      grading_status: attempt.gradingStatus || null,
      graded_at: attempt.gradedAt || null,
      feedback: attempt.feedback || null,
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

// ---- classroom topics ----
// Grouped by classroom, mirroring the shape used for materials and announcements.
export async function fetchTopics(): Promise<Record<string, any[]>> {
  if (!supabase) return {};
  const { data, error } = await supabase
    .from('classroom_topics')
    .select('*')
    .order('position', { ascending: true });
  if (error) {
    warn('fetchTopics', error);
    return {};
  }
  const grouped: Record<string, any[]> = {};
  for (const t of data || []) {
    if (!grouped[t.classroom_id]) grouped[t.classroom_id] = [];
    grouped[t.classroom_id].push({
      id: t.id,
      classroomId: t.classroom_id,
      name: t.name,
      position: t.position ?? 0,
      createdAt: t.created_at,
    });
  }
  return grouped;
}

export async function upsertTopic(topic: any) {
  if (!supabase) return;
  try {
    const { error } = await supabase.from('classroom_topics').upsert({
      id: toDbId(topic.id),
      classroom_id: toDbId(topic.classroomId),
      name: topic.name,
      position: topic.position ?? 0,
    });
    if (error) { warn('upsertTopic', error); throw error; }
  } catch (e) {
    warn('upsertTopic', e);
    throw e;
  }
}

export async function deleteTopicDb(topicId: string) {
  if (!supabase) return;
  try {
    const { error } = await supabase.from('classroom_topics').delete().eq('id', toDbId(topicId));
    if (error) { warn('deleteTopicDb', error); throw error; }
  } catch (e) {
    warn('deleteTopicDb', e);
    throw e;
  }
}

// ---- classwork ----
export async function fetchClasswork(): Promise<Record<string, any[]>> {
  if (!supabase) return {};
  const { data, error } = await supabase
    .from('classwork')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    warn('fetchClasswork', error);
    return {};
  }
  const grouped: Record<string, any[]> = {};
  for (const w of data || []) {
    if (!grouped[w.classroom_id]) grouped[w.classroom_id] = [];
    grouped[w.classroom_id].push({
      id: w.id,
      classroomId: w.classroom_id,
      topicId: w.topic_id || null,
      kind: w.kind || 'assignment',
      title: w.title,
      instructions: w.instructions || '',
      attachments: Array.isArray(w.attachments) ? w.attachments : [],
      points: w.points ?? undefined,
      dueDate: w.due_date || undefined,
      postDate: w.post_date || undefined,
      isPublished: w.is_published !== false,
      allowLate: w.allow_late !== false,
      createdBy: w.created_by || undefined,
      createdAt: w.created_at,
      updatedAt: w.updated_at || undefined,
    });
  }
  return grouped;
}

export async function upsertClasswork(work: any) {
  if (!supabase) return;
  try {
    // Inline data-URL attachments are local-only; only Storage-backed ones are durable.
    const attachments = (work.attachments || []).filter((a: any) => !a?.isDataUrl);
    const { error } = await supabase.from('classwork').upsert({
      id: toDbId(work.id),
      classroom_id: toDbId(work.classroomId),
      topic_id: work.topicId ? toDbId(work.topicId) : null,
      kind: work.kind || 'assignment',
      title: work.title,
      instructions: work.instructions || null,
      attachments,
      points: work.points ?? null,
      due_date: work.dueDate || null,
      post_date: work.postDate || null,
      is_published: work.isPublished !== false,
      allow_late: work.allowLate !== false,
      created_by: work.createdBy ? toDbId(work.createdBy) : null,
      updated_at: work.updatedAt || null,
    });
    if (error) { warn('upsertClasswork', error); throw error; }
  } catch (e) {
    warn('upsertClasswork', e);
    throw e;
  }
}

export async function deleteClassworkDb(classworkId: string) {
  if (!supabase) return;
  try {
    const { error } = await supabase.from('classwork').delete().eq('id', toDbId(classworkId));
    if (error) { warn('deleteClassworkDb', error); throw error; }
  } catch (e) {
    warn('deleteClassworkDb', e);
    throw e;
  }
}

// ---- classwork submissions ----
// Flat array (not grouped): the UI filters by classworkId and studentId, and a student's
// own submissions span many classes.
export async function fetchSubmissions() {
  if (!supabase) return [];
  const { data, error } = await supabase.from('classwork_submissions').select('*');
  if (error) {
    warn('fetchSubmissions', error);
    return [];
  }
  return (data || []).map((s: any) => ({
    id: s.id,
    classworkId: s.classwork_id,
    studentId: s.student_id,
    textAnswer: s.text_answer || '',
    attachments: Array.isArray(s.attachments) ? s.attachments : [],
    status: s.status || 'assigned',
    isLate: !!s.is_late,
    grade: s.grade ?? undefined,
    feedback: s.feedback || undefined,
    submittedAt: s.submitted_at || undefined,
    returnedAt: s.returned_at || undefined,
    createdAt: s.created_at,
  }));
}

export async function upsertSubmission(sub: any) {
  if (!supabase) return;
  try {
    const attachments = (sub.attachments || []).filter((a: any) => !a?.isDataUrl);
    const { error } = await supabase.from('classwork_submissions').upsert(
      {
        id: toDbId(sub.id),
        classwork_id: toDbId(sub.classworkId),
        student_id: toDbId(sub.studentId),
        text_answer: sub.textAnswer || null,
        attachments,
        status: sub.status || 'assigned',
        is_late: !!sub.isLate,
        grade: sub.grade ?? null,
        feedback: sub.feedback || null,
        submitted_at: sub.submittedAt || null,
        returned_at: sub.returnedAt || null,
      },
      // One submission per (classwork, student) — resubmitting updates the existing row
      // rather than creating a duplicate that would double-count in the gradebook.
      { onConflict: 'classwork_id,student_id' }
    );
    if (error) { warn('upsertSubmission', error); throw error; }
  } catch (e) {
    warn('upsertSubmission', e);
    throw e;
  }
}

// ---- comments ----
export async function fetchComments() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('post_comments')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) {
    warn('fetchComments', error);
    return [];
  }
  return (data || []).map((c: any) => ({
    id: c.id,
    classroomId: c.classroom_id,
    postType: c.post_type,
    postId: c.post_id,
    authorId: c.author_id,
    authorName: c.author_name || 'User',
    body: c.body || '',
    visibility: c.visibility || 'class',
    privateWithId: c.private_with_id || null,
    createdAt: c.created_at,
    updatedAt: c.updated_at || undefined,
  }));
}

export async function upsertComment(comment: any) {
  if (!supabase) return;
  try {
    const { error } = await supabase.from('post_comments').upsert({
      id: toDbId(comment.id),
      classroom_id: toDbId(comment.classroomId),
      post_type: comment.postType,
      post_id: toDbId(comment.postId),
      author_id: comment.authorId ? toDbId(comment.authorId) : null,
      author_name: comment.authorName || null,
      body: comment.body,
      visibility: comment.visibility || 'class',
      private_with_id: comment.privateWithId ? toDbId(comment.privateWithId) : null,
      updated_at: comment.updatedAt || null,
    });
    if (error) { warn('upsertComment', error); throw error; }
  } catch (e) {
    warn('upsertComment', e);
    throw e;
  }
}

export async function deleteCommentDb(commentId: string) {
  if (!supabase) return;
  try {
    const { error } = await supabase.from('post_comments').delete().eq('id', toDbId(commentId));
    if (error) { warn('deleteCommentDb', error); throw error; }
  } catch (e) {
    warn('deleteCommentDb', e);
    throw e;
  }
}


// ── Subscriptions ────────────────────────────────────────────────────────────

/** The plan catalogue. Readable without signing in, so the pricing page works for guests. */
export async function fetchSubscriptionPlans() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
  if (error) {
    warn('fetchSubscriptionPlans', error);
    return [];
  }
  return (data || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    description: p.description || '',
    priceCentavos: p.price_centavos ?? 0,
    currency: p.currency || 'PHP',
    interval: p.interval || 'month',
    features: Array.isArray(p.features) ? p.features : [],
    maxClassrooms: p.max_classrooms ?? null,
    maxExamsPerMonth: p.max_exams_per_month ?? null,
    sortOrder: p.sort_order ?? 0,
  }));
}

/**
 * The signed-in user's current subscription, or null when they are on the free plan.
 *
 * Only an `active` row whose period has not yet elapsed counts. Rows are never deleted, so
 * an expired subscription stays on record without granting anything.
 */
export async function fetchUserSubscription(userId: string) {
  if (!supabase || !userId) return null;
  const { data, error } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', toDbId(userId))
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) {
    warn('fetchUserSubscription', error);
    return null;
  }
  const row = (data || [])[0];
  if (!row) return null;
  if (row.current_period_end && new Date(row.current_period_end).getTime() < Date.now()) {
    return null;
  }
  return {
    id: row.id,
    userId: row.user_id,
    planId: row.plan_id,
    status: row.status,
    currentPeriodStart: row.current_period_start || undefined,
    currentPeriodEnd: row.current_period_end || undefined,
    amountCentavos: row.amount_centavos ?? undefined,
  };
}

// ---- study tools (student) ----
export async function fetchStudyItems(userId: string) {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase.from('study_items').select('*').eq('user_id', userId).order('updated_at', { ascending: false });
  if (error) { warn('fetchStudyItems', error); return []; }
  return (data || []).map((r: any) => ({ id: r.id, userId: r.user_id, kind: r.kind, title: r.title, data: r.data || {}, createdAt: r.created_at, updatedAt: r.updated_at }));
}
export async function upsertStudyItem(item: { id: string; userId: string; kind: string; title: string; data: any }) {
  if (!supabase) return;
  const { error } = await supabase.from('study_items').upsert({
    id: item.id, user_id: item.userId, kind: item.kind, title: item.title, data: item.data, updated_at: new Date().toISOString(),
  });
  if (error) warn('upsertStudyItem', error);
}
export async function deleteStudyItem(id: string) {
  if (!supabase) return;
  const { error } = await supabase.from('study_items').delete().eq('id', id);
  if (error) warn('deleteStudyItem', error);
}

// ---- instructor grade sheets (class record) ----
export async function fetchGradeSheet(classroomId: string): Promise<any | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('grade_sheets').select('data').eq('classroom_id', classroomId).maybeSingle();
  if (error) { warn('fetchGradeSheet', error); return null; }
  return data?.data || null;
}

export async function saveGradeSheet(classroomId: string, sheet: any): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('grade_sheets').upsert({ classroom_id: classroomId, data: sheet, updated_at: new Date().toISOString() });
  if (error) { warn('saveGradeSheet', error); return false; }
  return true;
}
