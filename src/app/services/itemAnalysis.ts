/**
 * Item analysis for a single exam: difficulty index, most-missed ranking, distractor
 * analysis and time-to-completion.
 *
 * Pure module — no React, no network, no AuthContext. `analyzeExam(exam, attempts)` in,
 * a fully-typed report out. It must never throw on degenerate input, because it runs against
 * whatever happens to be in localStorage.
 *
 * ── The constraint that shapes this whole file ──────────────────────────────────────────
 * TakeExam shuffles, PER ATTEMPT, both the question order and the multiple-choice OPTION
 * order, and rewrites that attempt's `correctAnswer` to the new shuffled index. It stores the
 * shuffled array on the attempt as `attempt.questions`. A stored multiple-choice answer is an
 * integer index into THAT ATTEMPT'S option array.
 *
 * So raw answer indices are NOT comparable between students. Aggregating them directly would
 * produce a distractor histogram that is pure noise. Instead, every answer is resolved
 * through its own attempt's snapshot to the option TEXT, grouped by a normalised text key,
 * and then mapped back to the master question's option index for display.
 *
 * Attempts that predate the snapshot being persisted have no `attempt.questions`. For those
 * the index is interpreted against the master order, which is correct for seeded/unshuffled
 * data and a guess otherwise. Rather than discard that data (which would leave the panel
 * empty on any existing install) it is counted, flagged via `degradedOptionMapping`, and
 * surfaced as `snapshotCoverage` so the instructor knows exactly how much of the breakdown
 * is approximate.
 */

export type BandKey = 'easy' | 'moderate' | 'difficult';
export type ExclusionReason = 'ungraded-free-text' | 'missing-answer-key' | 'no-attempts';

export interface Band {
  key: BandKey;
  label: string;
  short: string;
  color: string;
  bg: string;
}

/**
 * Conventional difficulty-index bands for classroom item analysis.
 * p is the proportion answering correctly, so HIGH p = EASY item.
 */
export const BANDS: Record<BandKey, Band> = {
  easy: { key: 'easy', label: 'Easy (p ≥ 0.80)', short: 'Easy', color: '#166534', bg: '#dcfce7' },
  moderate: { key: 'moderate', label: 'Moderate (0.30 ≤ p < 0.80)', short: 'Moderate', color: '#92400e', bg: '#fef3c7' },
  difficult: { key: 'difficult', label: 'Difficult (p < 0.30)', short: 'Difficult', color: '#991b1b', bg: '#fee2e2' },
};

export function bandFor(p: number): BandKey {
  if (p >= 0.8) return 'easy';
  if (p >= 0.3) return 'moderate';
  return 'difficult';
}

/** Discrimination needs enough students to form meaningful upper/lower 27% groups. */
export const MIN_N_FOR_DISCRIMINATION = 10;

/** Elapsed times outside this range are treated as corrupt and excluded from timing stats. */
const MIN_PLAUSIBLE_SECONDS = 1;
const MAX_PLAUSIBLE_SECONDS = 12 * 60 * 60;

export interface OptionStat {
  /** Normalised text key used for cross-attempt grouping. */
  key: string;
  /** Display text of the option. */
  label: string;
  /** Index into the MASTER question's options, or null for the omitted/other buckets. */
  canonicalIndex: number | null;
  isKey: boolean;
  isOmitted: boolean;
  isOther: boolean;
  count: number;
  /** count / administered, 0..1 */
  share: number;
  isTopDistractor: boolean;
}

export interface ItemStat {
  questionId: string;
  /** 1-based position in the master exam. */
  order: number;
  questionText: string;
  type: string;
  points: number;
  topic?: string;
  cognitiveLevel?: string;
  analysable: boolean;
  exclusionReason?: ExclusionReason;
  administered: number;
  answered: number;
  omitted: number;
  correct: number;
  incorrect: number;
  /** p = correct / administered, or null when not analysable. */
  difficultyIndex: number | null;
  band: BandKey | null;
  /** 1 - p */
  missRate: number | null;
  discriminationIndex: number | null;
  options: OptionStat[];
  hasOptionBreakdown: boolean;
  topDistractor: OptionStat | null;
  /** True when at least one attempt's option order had to be guessed. */
  degradedOptionMapping: boolean;
}

export interface AttemptTiming {
  attemptId: string;
  studentId: string;
  seconds: number;
  overTime: boolean;
}

export interface TimingStat {
  allottedMinutes: number | null;
  allottedSeconds: number | null;
  timedAttempts: number;
  /** Submitted attempts whose elapsed time was missing or implausible. */
  untimedAttempts: number;
  meanSeconds: number | null;
  medianSeconds: number | null;
  fastestSeconds: number | null;
  slowestSeconds: number | null;
  overTimeCount: number;
  /** medianSeconds / allottedSeconds (median, so one left-open tab does not skew it), or null when no time limit is set. */
  utilization: number | null;
  perAttempt: AttemptTiming[];
}

export interface ExamItemAnalysis {
  examId: string;
  examTitle: string;
  totalAttempts: number;
  submittedAttempts: number;
  inProgressAttempts: number;
  discriminationAvailable: boolean;
  discriminationGroupSize: number;
  /** Fraction of scored attempts that carried a question snapshot, 0..1. */
  snapshotCoverage: number;
  attemptsMissingSnapshot: number;
  items: ItemStat[];
  mostMissed: ItemStat[];
  excludedItems: ItemStat[];
  /** Answer keys that reference a question no longer on the exam. */
  orphanAnswerKeys: string[];
  meanDifficulty: number | null;
  timing: TimingStat;
}

const OMITTED_KEY = '__omitted__';
const OTHER_KEY = '__other__';

function normKey(v: unknown): string {
  return String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function toMillis(v: unknown): number | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  const t = d.getTime();
  return Number.isFinite(t) ? t : null;
}

function isAnswered(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  return String(v).trim() !== '';
}

/**
 * Grading rules, mirroring TakeExam's scoring exactly so the panel never disagrees with the
 * score the student was shown.
 * - multiple-choice: resolved by option TEXT (shuffle-proof), not by index
 * - true-false / short-answer: case-insensitive trimmed string compare
 * - essay: never actually graded (TakeExam awards a flat 80%), so excluded upstream
 */
function isCorrectNonMC(type: string, answer: unknown, master: any): boolean | null {
  const key = master?.correctAnswer;
  if (key === undefined || key === null || String(key).trim() === '') return null;
  if (type === 'true-false' || type === 'short-answer') {
    return String(answer).trim().toLowerCase() === String(key).trim().toLowerCase();
  }
  return null;
}

/** The attempts that count: latest submitted attempt per student. */
function selectScoredAttempts(attempts: any[], examId: string): any[] {
  const mine = (attempts || []).filter((a) => a && a.examId === examId);
  const submitted = mine.filter((a) => a.submittedAt);
  const latestByStudent = new Map<string, any>();
  for (const a of submitted) {
    const sid = String(a.studentId ?? '');
    const prev = latestByStudent.get(sid);
    if (!prev) {
      latestByStudent.set(sid, a);
      continue;
    }
    // Keep the most recent submission; a re-sit supersedes the earlier attempt.
    const prevT = toMillis(prev.submittedAt) ?? 0;
    const curT = toMillis(a.submittedAt) ?? 0;
    if (curT >= prevT) latestByStudent.set(sid, a);
  }
  return Array.from(latestByStudent.values());
}

export function analyzeExam(exam: any, attempts: any[]): ExamItemAnalysis {
  const examId = String(exam?.id ?? '');
  const examTitle = String(exam?.title ?? 'Untitled exam');
  const masterQuestions: any[] = Array.isArray(exam?.questions) ? exam.questions : [];

  const allForExam = (attempts || []).filter((a) => a && a.examId === examId);
  const scored = selectScoredAttempts(attempts || [], examId);
  const inProgressAttempts = allForExam.filter((a) => !a.submittedAt).length;

  let attemptsMissingSnapshot = 0;
  for (const a of scored) {
    if (!Array.isArray(a.questions) || a.questions.length === 0) attemptsMissingSnapshot++;
  }
  const snapshotCoverage = scored.length === 0 ? 1 : (scored.length - attemptsMissingSnapshot) / scored.length;

  // Per-attempt snapshot lookup: attemptId -> (questionId -> snapshot question)
  const snapshotIndex = new Map<string, Map<string, any>>();
  for (const a of scored) {
    const m = new Map<string, any>();
    if (Array.isArray(a.questions)) {
      for (const q of a.questions) if (q?.id) m.set(String(q.id), q);
    }
    snapshotIndex.set(String(a.id), m);
  }

  // Answer keys that no longer correspond to a question on the exam.
  const masterIds = new Set(masterQuestions.map((q) => String(q?.id)));
  const orphan = new Set<string>();
  for (const a of scored) {
    for (const k of Object.keys(a.answers || {})) {
      if (!masterIds.has(String(k))) orphan.add(String(k));
    }
  }

  // Per-student correctness, retained for the discrimination pass.
  const perAttemptCorrect = new Map<string, Map<string, boolean>>();
  for (const a of scored) perAttemptCorrect.set(String(a.id), new Map());

  const items: ItemStat[] = masterQuestions.map((master, idx) => {
    const qid = String(master?.id ?? `q-${idx}`);
    const type = String(master?.type ?? 'multiple-choice');
    const points = Number(master?.points) || 0;
    const masterOptions: string[] = Array.isArray(master?.options) ? master.options : [];

    const base: ItemStat = {
      questionId: qid,
      order: idx + 1,
      questionText: String(master?.question ?? ''),
      type,
      points,
      topic: master?.topic,
      cognitiveLevel: master?.cognitiveLevel,
      analysable: true,
      administered: 0,
      answered: 0,
      omitted: 0,
      correct: 0,
      incorrect: 0,
      difficultyIndex: null,
      band: null,
      missRate: null,
      discriminationIndex: null,
      options: [],
      hasOptionBreakdown: false,
      topDistractor: null,
      degradedOptionMapping: false,
    };

    // Essays are never really graded — TakeExam awards a flat 80% of points for any non-empty
    // answer — so a difficulty index over them would report the answer rate, not correctness.
    if (type === 'essay') {
      return { ...base, analysable: false, exclusionReason: 'ungraded-free-text', administered: scored.length };
    }

    const masterCorrectIdx = Number(master?.correctAnswer);
    const hasMcKey =
      type === 'multiple-choice' && Number.isInteger(masterCorrectIdx) &&
      masterCorrectIdx >= 0 && masterCorrectIdx < masterOptions.length;
    const hasOtherKey = type !== 'multiple-choice' &&
      master?.correctAnswer !== undefined && master?.correctAnswer !== null &&
      String(master?.correctAnswer).trim() !== '';

    if (!hasMcKey && !hasOtherKey) {
      return { ...base, analysable: false, exclusionReason: 'missing-answer-key', administered: scored.length };
    }

    if (scored.length === 0) {
      return { ...base, analysable: false, exclusionReason: 'no-attempts' };
    }

    const masterCorrectText = hasMcKey ? normKey(masterOptions[masterCorrectIdx]) : '';
    const counts = new Map<string, number>();
    const labels = new Map<string, string>();
    let correct = 0;
    let answered = 0;
    let omitted = 0;
    let degraded = false;

    for (const a of scored) {
      const raw = (a.answers || {})[qid];
      const attemptCorrect = perAttemptCorrect.get(String(a.id))!;

      if (!isAnswered(raw)) {
        omitted++;
        counts.set(OMITTED_KEY, (counts.get(OMITTED_KEY) ?? 0) + 1);
        attemptCorrect.set(qid, false);
        continue;
      }
      answered++;

      if (type === 'multiple-choice') {
        const snap = snapshotIndex.get(String(a.id))?.get(qid);
        const snapOptions: string[] = Array.isArray(snap?.options) ? snap.options : [];
        const chosenIdx = Number(raw);

        let chosenText: string | undefined;
        if (snapOptions.length > 0) {
          // Authoritative path: resolve through the order this student actually saw.
          if (Number.isInteger(chosenIdx) && chosenIdx >= 0 && chosenIdx < snapOptions.length) {
            chosenText = snapOptions[chosenIdx];
          }
        } else {
          // No snapshot: interpret against the master order and flag the approximation.
          degraded = true;
          if (Number.isInteger(chosenIdx) && chosenIdx >= 0 && chosenIdx < masterOptions.length) {
            chosenText = masterOptions[chosenIdx];
          }
        }

        if (chosenText === undefined) {
          // An index that fits no known option order — count it, but never as correct.
          counts.set(OTHER_KEY, (counts.get(OTHER_KEY) ?? 0) + 1);
          attemptCorrect.set(qid, false);
          continue;
        }

        const key = normKey(chosenText);
        counts.set(key, (counts.get(key) ?? 0) + 1);
        if (!labels.has(key)) labels.set(key, String(chosenText));

        const isRight = key === masterCorrectText;
        if (isRight) correct++;
        attemptCorrect.set(qid, isRight);
      } else {
        const verdict = isCorrectNonMC(type, raw, master);
        const isRight = verdict === true;
        if (isRight) correct++;
        attemptCorrect.set(qid, isRight);
        // True/false gets an option breakdown keyed on the submitted value itself.
        const key = normKey(raw);
        counts.set(key, (counts.get(key) ?? 0) + 1);
        if (!labels.has(key)) labels.set(key, String(raw));
      }
    }

    const administered = scored.length;
    const p = administered > 0 ? correct / administered : 0;

    // Build the option breakdown. Every master option appears even at zero, so a distractor
    // nobody picked is visibly distinct from one that was never offered.
    const optionStats: OptionStat[] = [];
    if (type === 'multiple-choice' && masterOptions.length > 0) {
      masterOptions.forEach((opt, oIdx) => {
        const key = normKey(opt);
        const count = counts.get(key) ?? 0;
        optionStats.push({
          key,
          label: String(opt),
          canonicalIndex: oIdx,
          isKey: oIdx === masterCorrectIdx,
          isOmitted: false,
          isOther: false,
          count,
          share: administered > 0 ? count / administered : 0,
          isTopDistractor: false,
        });
      });
    } else if (type === 'true-false') {
      ['true', 'false'].forEach((v) => {
        const count = counts.get(v) ?? 0;
        optionStats.push({
          key: v,
          label: v === 'true' ? 'True' : 'False',
          canonicalIndex: null,
          isKey: normKey(master?.correctAnswer) === v,
          isOmitted: false,
          isOther: false,
          count,
          share: administered > 0 ? count / administered : 0,
          isTopDistractor: false,
        });
      });
    }

    if (optionStats.length > 0) {
      const otherCount = counts.get(OTHER_KEY) ?? 0;
      if (otherCount > 0) {
        optionStats.push({
          key: OTHER_KEY, label: 'Unrecognised response', canonicalIndex: null,
          isKey: false, isOmitted: false, isOther: true, count: otherCount,
          share: administered > 0 ? otherCount / administered : 0, isTopDistractor: false,
        });
      }
      if (omitted > 0) {
        optionStats.push({
          key: OMITTED_KEY, label: 'No answer', canonicalIndex: null,
          isKey: false, isOmitted: true, isOther: false, count: omitted,
          share: administered > 0 ? omitted / administered : 0, isTopDistractor: false,
        });
      }
    }

    // Top distractor = most-chosen option that is not the key and not a bookkeeping bucket.
    let topDistractor: OptionStat | null = null;
    for (const o of optionStats) {
      if (o.isKey || o.isOmitted || o.isOther || o.count === 0) continue;
      if (!topDistractor || o.count > topDistractor.count) topDistractor = o;
    }
    if (topDistractor) topDistractor.isTopDistractor = true;

    return {
      ...base,
      analysable: true,
      administered,
      answered,
      omitted,
      correct,
      incorrect: administered - correct,
      difficultyIndex: p,
      band: bandFor(p),
      missRate: 1 - p,
      discriminationIndex: null, // filled in below
      options: optionStats,
      hasOptionBreakdown: optionStats.length > 0,
      topDistractor,
      degradedOptionMapping: degraded,
    };
  });

  // ── Discrimination index: upper 27% vs lower 27% by total score ──
  const discriminationAvailable = scored.length >= MIN_N_FOR_DISCRIMINATION;
  let groupSize = 0;
  if (discriminationAvailable) {
    const ranked = [...scored].sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
    groupSize = Math.max(1, Math.round(ranked.length * 0.27));
    const upper = ranked.slice(0, groupSize);
    const lower = ranked.slice(-groupSize);
    for (const item of items) {
      if (!item.analysable) continue;
      const countCorrect = (group: any[]) =>
        group.reduce((n, a) => n + (perAttemptCorrect.get(String(a.id))?.get(item.questionId) ? 1 : 0), 0);
      item.discriminationIndex = (countCorrect(upper) - countCorrect(lower)) / groupSize;
    }
  }

  // ── Timing ──
  const rawDuration = Number(exam?.duration);
  // A null duration column maps to undefined, which would make `duration * 60` NaN in
  // TakeExam. Treat an absent duration as "no allotted time", never as zero.
  const allottedMinutes = Number.isFinite(rawDuration) && rawDuration > 0 ? rawDuration : null;
  const allottedSeconds = allottedMinutes === null ? null : allottedMinutes * 60;

  const perAttempt: AttemptTiming[] = [];
  let untimedAttempts = 0;
  for (const a of scored) {
    const start = toMillis(a.startedAt);
    const end = toMillis(a.submittedAt);
    if (start === null || end === null) {
      untimedAttempts++;
      continue;
    }
    const seconds = (end - start) / 1000;
    // Seeded mock attempts have startedAt === submittedAt (0s). Discard rather than average in.
    if (seconds < MIN_PLAUSIBLE_SECONDS || seconds > MAX_PLAUSIBLE_SECONDS) {
      untimedAttempts++;
      continue;
    }
    perAttempt.push({
      attemptId: String(a.id),
      studentId: String(a.studentId ?? ''),
      seconds,
      overTime: allottedSeconds !== null && seconds > allottedSeconds,
    });
  }

  const secs = perAttempt.map((t) => t.seconds).sort((x, y) => x - y);
  const mean = secs.length ? secs.reduce((s, v) => s + v, 0) / secs.length : null;
  const median = secs.length
    ? secs.length % 2 === 1
      ? secs[(secs.length - 1) / 2]
      : (secs[secs.length / 2 - 1] + secs[secs.length / 2]) / 2
    : null;

  const timing: TimingStat = {
    allottedMinutes,
    allottedSeconds,
    timedAttempts: perAttempt.length,
    untimedAttempts,
    meanSeconds: mean,
    medianSeconds: median,
    fastestSeconds: secs.length ? secs[0] : null,
    slowestSeconds: secs.length ? secs[secs.length - 1] : null,
    overTimeCount: perAttempt.filter((t) => t.overTime).length,
    utilization: median !== null && allottedSeconds ? median / allottedSeconds : null,
    perAttempt,
  };

  const analysable = items.filter((i) => i.analysable);
  const meanDifficulty = analysable.length
    ? analysable.reduce((s, i) => s + (i.difficultyIndex ?? 0), 0) / analysable.length
    : null;

  const mostMissed = [...analysable]
    .filter((i) => (i.missRate ?? 0) > 0)
    .sort((a, b) => (b.missRate ?? 0) - (a.missRate ?? 0) || a.order - b.order);

  return {
    examId,
    examTitle,
    totalAttempts: allForExam.length,
    submittedAttempts: scored.length,
    inProgressAttempts,
    discriminationAvailable,
    discriminationGroupSize: groupSize,
    snapshotCoverage,
    attemptsMissingSnapshot,
    items,
    mostMissed,
    excludedItems: items.filter((i) => !i.analysable),
    orphanAnswerKeys: Array.from(orphan),
    meanDifficulty,
    timing,
  };
}

/** mm:ss / h mm for display. */
export function formatDuration(seconds?: number | null): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '—';
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export function formatPercent(v?: number | null, digits = 0): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return `${(v * 100).toFixed(digits)}%`;
}
