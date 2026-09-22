export type UserRole = 'instructor' | 'student';

export interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  role: UserRole;
  avatar?: string;
}

export interface Classroom {
  id: string;
  name: string;
  subject: string;
  section: string;
  instructorId: string;
  classCode: string;
  /** Year level, e.g. "BSCS 3". Optional, mirroring Google Classroom. */
  level?: string;
  /** Physical or virtual room. Optional. */
  room?: string;
  students: string[];
  createdAt: Date;
  description?: string;
}

export interface Question {
  id: string;
  type: 'multiple-choice' | 'true-false' | 'essay' | 'short-answer';
  question: string;
  options?: string[];
  correctAnswer?: string | number;
  points: number;
  difficulty: 'easy' | 'medium' | 'hard';
  topic?: string;
  cognitiveLevel?: string;
  itemPlacement?: number | string;
  createdBy: string;
  createdAt: Date;
  // Set at runtime by the generators and the repository editor; declared here so the
  // printer and the item-analysis module can read them without casting.
  image?: string;
  optionsImages?: string[];
  isExtra?: boolean;
}

export interface Exam {
  id: string;
  title: string;
  description: string;
  classroomId: string;
  questions: Question[];
  totalPoints: number;
  duration: number;
  createdBy: string;
  createdAt: Date;
  dueDate?: Date;
  isPublished: boolean;
  allowedAttempts: number;
}

export interface ExamAttempt {
  id: string;
  examId: string;
  studentId: string;
  answers: Record<string, any>;
  score?: number;
  // ISO strings when they come from Supabase, Date objects once AuthContext revives them.
  submittedAt?: Date | string;
  startedAt: Date | string;
  /**
   * The per-attempt snapshot of questions as the student actually saw them. TakeExam
   * shuffles both question order and multiple-choice option order per attempt and
   * remaps correctAnswer to the shuffled index, so a stored answer index is only
   * meaningful against this array. Item analysis is impossible without it.
   */
  questions?: Question[];
}

export interface QuestionBankItem extends Question {
  tags?: string[];
  subject?: string;
}

// ── Course materials & announcements ──

export interface StoredFileRef {
  /** Public https URL from Supabase Storage, or a base64 data: URL in offline mode. */
  fileUrl: string;
  /** Object key inside the `classroom-files` bucket; null when the file is inlined. */
  storagePath?: string | null;
  /** True when fileUrl is a data: URL (offline fallback) — never written to Postgres. */
  isDataUrl?: boolean;
}

export interface ClassroomMaterial extends StoredFileRef {
  id: string;
  classroomId?: string;
  name: string;
  /** Bytes. Undefined only for rows created before file metadata was persisted. */
  size?: number;
  /** MIME type, e.g. 'application/pdf'. */
  type?: string;
  /** Lowercased extension, e.g. 'pdf' — what getMaterialIcon() keys off. */
  fileType?: string;
  /** ISO 8601 string (maps to classroom_materials.created_at). */
  uploadedAt?: string;
  uploadedBy?: string;
  uploadedById?: string;
  /** Extracted document text (truncated) used by the AI pipeline and the preview dialog. */
  content?: string;
}

export interface AnnouncementAttachment extends StoredFileRef {
  id: string;
  name: string;
  size: number;
  mimeType: string;
}

export interface Announcement {
  id: string;
  classroomId: string;
  authorId: string;
  authorName: string;
  /** Sanitized HTML (allow-list in src/app/utils/sanitizeHtml.ts). Re-sanitized at render. */
  bodyHtml: string;
  attachments: AnnouncementAttachment[];
  isPinned: boolean;
  /** ISO 8601 strings — stored as TIMESTAMPTZ. */
  createdAt: string;
  updatedAt?: string;
}

/** Returned by AuthContext mutators that write through to Supabase, so the UI can report failure. */
export interface MutationResult {
  ok: boolean;
  error?: string;
}

// ── Classwork (Google Classroom parity) ──

/** Instructor-defined heading that groups classwork, e.g. "Week 1", "Midterms". */
export interface ClassroomTopic {
  id: string;
  classroomId: string;
  name: string;
  /** Sort order within the class; lower comes first. */
  position: number;
  createdAt?: string;
}

export type ClassworkKind = 'assignment' | 'material' | 'question';

export interface Classwork {
  id: string;
  classroomId: string;
  topicId?: string | null;
  kind: ClassworkKind;
  title: string;
  instructions?: string;
  attachments: AnnouncementAttachment[];
  /** Gradeable only when `kind` is 'assignment' or 'question'. */
  points?: number;
  dueDate?: string;
  postDate?: string;
  isPublished: boolean;
  allowLate: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export type SubmissionStatus = 'assigned' | 'turned_in' | 'returned';

export interface ClassworkSubmission {
  id: string;
  classworkId: string;
  studentId: string;
  textAnswer?: string;
  attachments: AnnouncementAttachment[];
  status: SubmissionStatus;
  /**
   * Stamped at submit time against the due date then in force. The due date can be edited
   * afterwards, and lateness must reflect the rule the student was actually held to.
   */
  isLate: boolean;
  grade?: number;
  feedback?: string;
  submittedAt?: string;
  returnedAt?: string;
  createdAt?: string;
}

export type CommentVisibility = 'class' | 'private';

export interface PostComment {
  id: string;
  classroomId: string;
  postType: 'announcement' | 'classwork';
  postId: string;
  authorId: string;
  authorName: string;
  body: string;
  visibility: CommentVisibility;
  /** For a private comment, the student side of the conversation. */
  privateWithId?: string | null;
  createdAt: string;
  updatedAt?: string;
}

// ── Printing ──

export type PrintPaperSize = 'A4' | 'Letter';
export type PrintMode = 'student' | 'key';

export interface PrintExamHeaderInfo {
  className: string;
  section?: string;
  subject?: string;
  instructorName: string;
  schoolName?: string;
  logoUrl?: string;
}

// ── TOS compliance ──

/** Per-item TOS verdict stamped by src/app/services/tosValidator.ts */
export interface TOSItemAudit {
  tosCompliant?: boolean;
  tosFailureReason?: string;
  needsAuthoring?: boolean;
  aiClaimedTopic?: string;
  aiClaimedCognitiveLevel?: string;
  aiClaimedPlacement?: number;
}

export interface GeneratedQuestion extends Question, TOSItemAudit {}

/** Snapshot persisted with a saved exam template. */
export interface TOSComplianceSnapshot {
  compliant: boolean;
  expectedTotal: number;
  actualTotal: number;
  compliantItemCount: number;
  violationCount: number;
  attemptsUsed: number;
  blueprintFileName?: string;
  checkedAt: string;
  acknowledgedOverride: boolean;
}
