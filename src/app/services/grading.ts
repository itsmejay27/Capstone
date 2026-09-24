/**
 * Exam grading rules shared by the exam page, results page and gradebook.
 *
 * Multiple-choice and true/false items are scored automatically. Short-answer and essay
 * items are checked by the instructor, so an attempt that has any of them stays "pending"
 * and shows no grade until the instructor finishes checking.
 *
 * Grades use a 65–100 scale: 0% correct is 65, 100% correct is 100, and 75 is passing.
 */

export const MANUAL_TYPES = new Set(['short-answer', 'essay']);
export const PASSING_GRADE = 75;

export const isManual = (q: any) => MANUAL_TYPES.has(q?.type);

const answered = (v: any) => v !== undefined && v !== null && String(v).trim() !== '';

/** Points for one automatically scored question, or null when the instructor must check it. */
export function autoPoints(q: any, answer: any): number | null {
  if (isManual(q)) return null;
  if (!answered(answer)) return 0;
  if (q.type === 'multiple-choice') return answer === q.correctAnswer ? q.points || 0 : 0;
  if (q.type === 'true-false') {
    return String(answer).toLowerCase() === String(q.correctAnswer).toLowerCase() ? q.points || 0 : 0;
  }
  return 0;
}

export function scoreAttempt(questions: any[], answers: Record<string, any>, manualScores: Record<string, number> = {}) {
  let auto = 0;
  let manual = 0;
  const pendingIds: string[] = [];
  for (const q of questions || []) {
    const p = autoPoints(q, answers?.[q.id]);
    if (p !== null) { auto += p; continue; }
    // An unanswered written item needs no checking: it is simply zero.
    if (!answered(answers?.[q.id])) continue;
    if (typeof manualScores[q.id] === 'number') manual += manualScores[q.id];
    else pendingIds.push(q.id);
  }
  return { auto, manual, total: auto + manual, pendingIds, hasManual: (questions || []).some(isManual) };
}

/** Whether the attempt still waits on the instructor. Older attempts without a status count as graded. */
export function isPending(attempt: any): boolean {
  return attempt?.gradingStatus === 'pending';
}

export function gradeFor(score: number, total: number) {
  const pct = total > 0 ? Math.max(0, Math.min(1, score / total)) : 0;
  const grade = Math.round(65 + pct * 35);
  const passed = grade >= PASSING_GRADE;
  let remark = 'Failed';
  let color = 'var(--c-red-600)';
  let bg = 'var(--c-red-100)';
  if (grade >= 95) { remark = 'Excellent'; color = 'var(--c-green-700)'; bg = 'var(--c-green-100)'; }
  else if (grade >= 90) { remark = 'Very good'; color = 'var(--c-green-700)'; bg = 'var(--c-green-100)'; }
  else if (grade >= 85) { remark = 'Good'; color = 'var(--c-sky-700)'; bg = 'var(--c-sky-100)'; }
  else if (grade >= 80) { remark = 'Satisfactory'; color = 'var(--c-sky-700)'; bg = 'var(--c-sky-100)'; }
  else if (grade >= 75) { remark = 'Passed'; color = 'var(--c-amber-700)'; bg = 'var(--c-amber-100)'; }
  return { pct: pct * 100, grade, passed, remark, color, bg };
}
