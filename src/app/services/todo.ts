import { teachesClass } from './classAccess';
/**
 * To-do / Upcoming derivation — Google Classroom's "Assigned / Missing / Done" for students
 * and "To review" for instructors.
 *
 * Pure module: it derives everything from the existing exams, classwork and attempts rather
 * than storing a parallel to-do list, so it can never drift out of sync with the real work.
 */

export type TodoBucket = 'assigned' | 'missing' | 'done' | 'review';

export interface TodoItem {
  id: string;
  /** 'exam' or 'assignment' — both appear in the same list, as in Classroom. */
  kind: 'exam' | 'assignment';
  title: string;
  classroomId: string;
  className: string;
  dueDate?: string | Date;
  postDate?: string | Date;
  bucket: TodoBucket;
  /** Instructor view: how many submissions are waiting. */
  pendingCount?: number;
  totalPoints?: number;
  /** Route to open the item. */
  href: string;
}

function toDate(v: unknown): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

function isPublished(item: any): boolean {
  const post = toDate(item.postDate);
  if (!post) return item.isPublished !== false;
  return post <= new Date();
}

export function isOverdue(due: unknown): boolean {
  const d = toDate(due);
  return d !== null && d < new Date();
}

/** Human "in 3 days" / "2 days ago" without pulling in a formatter at every call site. */
export function dueLabel(due: unknown): string {
  const d = toDate(due);
  if (!d) return 'No due date';
  const ms = d.getTime() - Date.now();
  const days = Math.round(ms / 86_400_000);
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days === -1) return 'Due yesterday';
  if (days > 1 && days <= 14) return `Due in ${days} days`;
  if (days < -1 && days >= -14) return `${Math.abs(days)} days overdue`;
  return `Due ${d.toLocaleDateString()}`;
}

/**
 * Build the student's to-do list.
 *
 * - assigned: published, not submitted, not past due
 * - missing:  published, not submitted, past due
 * - done:     submitted
 */
export function buildStudentTodo(
  studentId: string,
  classrooms: any[],
  exams: any[],
  classwork: any[],
  attempts: any[],
  submissions: any[]
): TodoItem[] {
  const myClasses = classrooms.filter((c) => c.students?.includes(studentId) && !c.isArchived);
  const classById = new Map(myClasses.map((c) => [c.id, c]));
  const items: TodoItem[] = [];

  for (const exam of exams || []) {
    const cls = classById.get(exam.classroomId);
    if (!cls || !isPublished(exam)) continue;
    const submitted = (attempts || []).some(
      (a) => a.examId === exam.id && a.studentId === studentId && a.submittedAt
    );
    items.push({
      id: exam.id,
      kind: 'exam',
      title: exam.title,
      classroomId: cls.id,
      className: cls.name,
      dueDate: exam.dueDate,
      postDate: exam.postDate,
      totalPoints: exam.totalPoints,
      bucket: submitted ? 'done' : isOverdue(exam.dueDate) ? 'missing' : 'assigned',
      href: `/exam/${exam.id}/take`,
    });
  }

  for (const work of classwork || []) {
    const cls = classById.get(work.classroomId);
    if (!cls || !isPublished(work)) continue;
    const submitted = (submissions || []).some(
      (s) => s.classworkId === work.id && s.studentId === studentId && s.submittedAt
    );
    items.push({
      id: work.id,
      kind: 'assignment',
      title: work.title,
      classroomId: cls.id,
      className: cls.name,
      dueDate: work.dueDate,
      postDate: work.postDate,
      totalPoints: work.points,
      bucket: submitted ? 'done' : isOverdue(work.dueDate) ? 'missing' : 'assigned',
      href: `/classroom/${cls.id}/work/${work.id}`,
    });
  }

  return sortTodo(items);
}

/** Build the instructor's "needs review" list: published work with unreviewed submissions. */
export function buildInstructorTodo(
  instructorId: string,
  classrooms: any[],
  exams: any[],
  classwork: any[],
  attempts: any[],
  submissions: any[]
): TodoItem[] {
  const myClasses = classrooms.filter((c) => teachesClass(c, instructorId) && !c.isArchived);
  const classById = new Map(myClasses.map((c) => [c.id, c]));
  const items: TodoItem[] = [];

  for (const exam of exams || []) {
    const cls = classById.get(exam.classroomId);
    if (!cls) continue;
    // Only attempts still waiting on the teacher (short-answer/essay not yet checked).
    const pending = (attempts || []).filter((a) => a.examId === exam.id && a.submittedAt && a.gradingStatus === 'pending').length;
    items.push({
      id: exam.id,
      kind: 'exam',
      title: exam.title,
      classroomId: cls.id,
      className: cls.name,
      dueDate: exam.dueDate,
      totalPoints: exam.totalPoints,
      pendingCount: pending,
      bucket: pending > 0 ? 'review' : 'done',
      href: `/classroom/${cls.id}?tab=gradebook`,
    });
  }

  for (const work of classwork || []) {
    const cls = classById.get(work.classroomId);
    if (!cls) continue;
    const pending = (submissions || []).filter(
      (s) => s.classworkId === work.id && s.submittedAt && s.status !== 'returned' && s.status !== 'assigned'
        && (s.grade === undefined || s.grade === null)
    ).length;
    items.push({
      id: work.id,
      kind: 'assignment',
      title: work.title,
      classroomId: cls.id,
      className: cls.name,
      dueDate: work.dueDate,
      totalPoints: work.points,
      pendingCount: pending,
      bucket: pending > 0 ? 'review' : 'done',
      href: `/classroom/${cls.id}/work/${work.id}`,
    });
  }

  // Most submissions waiting first, then soonest due.
  return items.sort((a, b) => {
    if ((b.pendingCount ?? 0) !== (a.pendingCount ?? 0)) return (b.pendingCount ?? 0) - (a.pendingCount ?? 0);
    const ad = toDate(a.dueDate)?.getTime() ?? Infinity;
    const bd = toDate(b.dueDate)?.getTime() ?? Infinity;
    return ad - bd;
  });
}

/** Missing first (most urgent), then assigned by soonest due, then done by most recent. */
function sortTodo(items: TodoItem[]): TodoItem[] {
  const rank: Record<TodoBucket, number> = { missing: 0, assigned: 1, review: 2, done: 3 };
  return items.sort((a, b) => {
    if (rank[a.bucket] !== rank[b.bucket]) return rank[a.bucket] - rank[b.bucket];
    const ad = toDate(a.dueDate)?.getTime() ?? Infinity;
    const bd = toDate(b.dueDate)?.getTime() ?? Infinity;
    return a.bucket === 'done' ? bd - ad : ad - bd;
  });
}

/** Work due within `days`, for the Upcoming widget on a class page. */
export function upcomingWithin(items: TodoItem[], days = 7): TodoItem[] {
  const cutoff = Date.now() + days * 86_400_000;
  return items.filter((i) => {
    if (i.bucket === 'done') return false;
    const d = toDate(i.dueDate);
    return d !== null && d.getTime() <= cutoff;
  });
}
