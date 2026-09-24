import { TOSData, TOSItemSpec, normaliseCogLevel } from './tosParser';

/**
 * Table-of-Specifications compliance validation and bounded regeneration.
 *
 * The generation pipeline had no gate between "the model returned something" and "show the
 * instructor a saved exam". Three separate defects made that dangerous:
 *   - geminiService pairs a batch to its specs POSITIONALLY with a modulo wrap
 *     (`rawBatch[cIdx] || rawBatch[cIdx % rawBatch.length]`), so a short batch emits verbatim
 *     duplicate stems relabelled with different topics and cognitive levels.
 *   - geminiService lets the MODEL's self-declared cognitiveLevel and points override the
 *     blueprint, so the mandated distribution silently drifts.
 * A pure count check would pass several of those. This module therefore validates per-item
 * placement, topic, cognitive level and content quality, not just totals.
 *
 * This module is PURE — no React, no network, no service imports beyond the parser's types.
 * The network lives behind the injected RegenerateFn.
 */

export type ViolationCode =
  | 'MISSING_ITEM'
  | 'DUPLICATE_ITEM'
  | 'EXTRA_ITEM'
  | 'TOPIC_MISMATCH'
  | 'COGNITIVE_MISMATCH'
  | 'TYPE_MISMATCH'
  | 'POINTS_MISMATCH'
  | 'DUPLICATE_STEM'
  | 'PLACEHOLDER_CONTENT'
  | 'MALFORMED_OPTIONS'
  | 'BAD_ANSWER_KEY';

export interface TOSItemViolation {
  itemNumber: number;
  codes: ViolationCode[];
  detail: string;
  expected: { topic: string; cognitiveLevel: string; points: number; questionType?: string };
  actual: Record<string, any> | null;
}

export interface TOSCountRow {
  key: string;
  expected: number;
  actual: number;
  delta: number;
  ok: boolean;
}

export interface TOSComplianceReport {
  compliant: boolean;
  checkedAt: string;
  blueprintFileName?: string;
  expectedTotal: number;
  actualTotal: number;
  totalMatches: boolean;
  byTopic: TOSCountRow[];
  byCognitiveLevel: TOSCountRow[];
  violations: TOSItemViolation[];
  missingItemNumbers: number[];
  duplicateItemNumbers: number[];
  extraItemNumbers: number[];
  compliantItemCount: number;
  attemptsUsed: number;
  /** Discrepancies the PARSER had to reconcile in the source document, surfaced not swallowed. */
  blueprintDiscrepancies: string[];
  summary: string;
}

export interface EnforceOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  onProgress?: (current: number, total: number, message: string) => void;
  /** Injectable so tests do not actually wait. Defaults to a real setTimeout sleep. */
  sleep?: (ms: number) => Promise<void>;
}

export type RegenerateFn = (
  specs: TOSItemSpec[],
  attempt: number,
  report: TOSComplianceReport
) => Promise<any[]>;

// ── Cognitive level algebra ─────────────────────────────────────────────────

/**
 * Composite column labels used by Philippine HEI TOS forms, mapped to the single Bloom
 * levels that satisfy them. A TOS column says "Applying/Analyzing"; a generator emits
 * "Analyzing". That is a match, and a naive string compare would call it a violation.
 *
 * Note normaliseCogLevel() folds 'synthesis'/'synthesizing' into 'Creating', which is why
 * the Synthesizing/Evaluating column accepts Creating.
 */
const COMPOSITE_MEMBERS: Record<string, string[]> = {
  'Remembering / Understanding': ['Remembering', 'Understanding'],
  'Applying / Analyzing': ['Applying', 'Analyzing'],
  'Synthesizing / Evaluating': ['Synthesizing', 'Creating', 'Evaluating'],
};

/** Canonical form for comparison: normalised by the parser, else whitespace/case folded. */
function canonCog(raw?: string): string {
  if (!raw) return '';
  const viaParser = normaliseCogLevel(raw);
  if (viaParser) return viaParser;
  return String(raw).trim().replace(/\s*\/\s*/g, ' / ').replace(/\s+/g, ' ');
}

/** The set of single levels that satisfy an expected level (composite or single). */
function acceptableLevels(expected: string): Set<string> {
  const canon = canonCog(expected);
  const members = COMPOSITE_MEMBERS[canon];
  if (members) return new Set([canon, ...members]);
  return new Set([canon]);
}

/**
 * True when `actual` satisfies the `expected` cognitive level.
 * A single level satisfies a composite column when it is one of that column's members;
 * a composite satisfies itself. An empty actual never satisfies a non-empty expectation.
 */
export function cognitiveSatisfies(expected: string, actual?: string): boolean {
  const exp = canonCog(expected);
  if (!exp) return true; // the blueprint did not constrain this item
  const act = canonCog(actual);
  if (!act) return false;
  if (acceptableLevels(exp).has(act)) return true;
  // The reverse direction: expected 'Analyzing', model answered with the composite column label.
  const actMembers = COMPOSITE_MEMBERS[act];
  return Array.isArray(actMembers) && actMembers.includes(exp);
}

// ── Topic matching ──────────────────────────────────────────────────────────

const TOPIC_STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'for', 'to', 'with', 'vs', 'versus',
]);

/** Lowercase, depunctuate, drop stopwords — a stable key for topic comparison. */
export function normaliseTopicKey(t?: string): string {
  if (!t) return '';
  return String(t)
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !TOPIC_STOPWORDS.has(w))
    .join(' ')
    .trim();
}

/**
 * Tolerant topic comparison. The model routinely echoes a shortened or reworded topic
 * ("React Native" for "Mobile Frontend: React Native"), which must pass, while an unrelated
 * topic must fail.
 *
 * The rule: exact key match, OR one key is a prefix/substring of the other, OR the two share
 * at least half of the shorter key's significant words (min 2). Requiring a *shared-word
 * majority* rather than any overlap is what stops "Database Integration" from matching
 * "Systems Integration" on the single word "integration".
 */
export function topicMatches(expected: string, actual?: string): boolean {
  const exp = normaliseTopicKey(expected);
  if (!exp) return true; // unconstrained
  const act = normaliseTopicKey(actual);
  if (!act) return false;
  if (exp === act) return true;
  if (exp.includes(act) || act.includes(exp)) return true;

  const expWords = new Set(exp.split(' ').filter(Boolean));
  const actWords = new Set(act.split(' ').filter(Boolean));
  const shorter = Math.min(expWords.size, actWords.size);
  if (shorter === 0) return false;
  let shared = 0;
  expWords.forEach((w) => {
    if (actWords.has(w)) shared++;
  });
  const needed = Math.max(2, Math.ceil(shorter / 2));
  return shared >= needed;
}

// ── Content quality heuristics ──────────────────────────────────────────────

/**
 * Stems the generators emit when they have nothing real to say. These come from
 * geminiService's anti-hallucination rewrite and the canned fallback template pool.
 */
const PLACEHOLDER_PATTERNS: RegExp[] = [
  /^question regarding /i,
  /which of the following best describes its core purpose and functional mechanism\?$/i,
  /^new custom .*question: enter text here/i,
  /enter (?:question )?text here/i,
  /^(?:lorem ipsum|sample question|placeholder)/i,
  /^\s*$/,
];

function normaliseStem(q: any): string {
  return String(q?.question ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function placementOf(q: any): number | null {
  const n = Number(q?.itemPlacement);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

// ── Validation ──────────────────────────────────────────────────────────────

function countRows(
  expectedCounts: Map<string, number>,
  actualCounts: Map<string, number>
): TOSCountRow[] {
  const keys = new Set<string>([...expectedCounts.keys(), ...actualCounts.keys()]);
  return Array.from(keys)
    .sort()
    .map((key) => {
      const expected = expectedCounts.get(key) ?? 0;
      const actual = actualCounts.get(key) ?? 0;
      return { key, expected, actual, delta: actual - expected, ok: actual === expected };
    });
}

/**
 * Validate a generated question array against a parsed TOS blueprint.
 *
 * Every item spec in `tosData.itemSpecs` is looked up by its item number in the generated
 * set — NOT positionally — because positional pairing is precisely the bug that lets a short
 * batch bind questions to the wrong specs.
 */
export function validateExamAgainstTOS(
  questions: any[],
  tosData: TOSData | null | undefined,
  attemptsUsed: number = 0
): TOSComplianceReport {
  const checkedAt = new Date().toISOString();
  const items = Array.isArray(questions) ? questions : [];
  const specs = tosData?.itemSpecs ?? [];
  const blueprintDiscrepancies = (tosData as any)?.discrepancies ?? [];

  // No blueprint => nothing to enforce. Report compliant-by-vacuity but say so plainly.
  if (!tosData || specs.length === 0) {
    return {
      compliant: true,
      checkedAt,
      blueprintFileName: tosData?.fileName,
      expectedTotal: 0,
      actualTotal: items.length,
      totalMatches: true,
      byTopic: [],
      byCognitiveLevel: [],
      violations: [],
      missingItemNumbers: [],
      duplicateItemNumbers: [],
      extraItemNumbers: [],
      compliantItemCount: items.length,
      attemptsUsed,
      blueprintDiscrepancies,
      summary: 'No Table of Specifications was attached, so no blueprint constraints were enforced.',
    };
  }

  // Index the generated items by placement. Duplicates are recorded, not overwritten.
  const byPlacement = new Map<number, any[]>();
  const unplaced: any[] = [];
  for (const q of items) {
    const p = placementOf(q);
    if (p === null) {
      unplaced.push(q);
      continue;
    }
    const bucket = byPlacement.get(p);
    if (bucket) bucket.push(q);
    else byPlacement.set(p, [q]);
  }

  // Duplicate stems across the whole exam — the modulo-wrap duplication bug's signature.
  const stemCounts = new Map<string, number>();
  for (const q of items) {
    const s = normaliseStem(q);
    if (!s) continue;
    stemCounts.set(s, (stemCounts.get(s) ?? 0) + 1);
  }

  const violations: TOSItemViolation[] = [];
  const missingItemNumbers: number[] = [];
  const duplicateItemNumbers: number[] = [];
  const expectedTopicCounts = new Map<string, number>();
  const expectedCogCounts = new Map<string, number>();
  const actualTopicCounts = new Map<string, number>();
  const actualCogCounts = new Map<string, number>();
  let compliantItemCount = 0;

  for (const spec of specs) {
    const expTopic = spec.topic || '';
    const expCog = canonCog(spec.cognitiveLevel) || spec.cognitiveLevel || '';
    expectedTopicCounts.set(expTopic, (expectedTopicCounts.get(expTopic) ?? 0) + 1);
    expectedCogCounts.set(expCog, (expectedCogCounts.get(expCog) ?? 0) + 1);

    const expected = {
      topic: expTopic,
      cognitiveLevel: expCog,
      points: spec.points || 1,
      questionType: spec.questionType,
    };

    const matches = byPlacement.get(spec.itemNumber) ?? [];
    if (matches.length === 0) {
      missingItemNumbers.push(spec.itemNumber);
      violations.push({
        itemNumber: spec.itemNumber,
        codes: ['MISSING_ITEM'],
        detail: `No generated question carries item placement ${spec.itemNumber}.`,
        expected,
        actual: null,
      });
      continue;
    }

    if (matches.length > 1) duplicateItemNumbers.push(spec.itemNumber);

    // Judge the first item at this placement; extras are reported as duplicates.
    const q = matches[0];
    const codes: ViolationCode[] = [];
    const details: string[] = [];

    if (matches.length > 1) {
      codes.push('DUPLICATE_ITEM');
      details.push(`${matches.length} questions claim placement ${spec.itemNumber}.`);
    }

    // Tally the actual distribution against the BLUEPRINT's keys, so the expected and actual
    // columns of byTopic/byCognitiveLevel line up and a shortfall is visible on one row. An
    // item that satisfies its spec counts toward that spec's key; one that does not counts
    // toward whatever it actually claims, which is what makes the deficit show up.
    const actTopic = q?.topic;
    const topicOk = topicMatches(expTopic, actTopic);
    if (!topicOk) {
      codes.push('TOPIC_MISMATCH');
      details.push(`topic is "${actTopic ?? '(none)'}", blueprint requires "${expTopic}"`);
    }
    const topicKey = topicOk ? expTopic : (actTopic || '(none)');
    actualTopicCounts.set(topicKey, (actualTopicCounts.get(topicKey) ?? 0) + 1);

    const actCog = q?.cognitiveLevel;
    const cogOk = cognitiveSatisfies(expCog, actCog);
    if (!cogOk) {
      codes.push('COGNITIVE_MISMATCH');
      details.push(`cognitive level is "${actCog ?? '(none)'}", blueprint requires "${expCog}"`);
    }
    const cogKey = cogOk ? expCog : (canonCog(actCog) || '(none)');
    actualCogCounts.set(cogKey, (actualCogCounts.get(cogKey) ?? 0) + 1);

    if (spec.questionType && q?.type && String(q.type) !== String(spec.questionType)) {
      codes.push('TYPE_MISMATCH');
      details.push(`type is "${q.type}", blueprint requires "${spec.questionType}"`);
    }

    const expPoints = spec.points || 1;
    const actPoints = Number(q?.points);
    if (Number.isFinite(actPoints) && actPoints !== expPoints) {
      codes.push('POINTS_MISMATCH');
      details.push(`points is ${actPoints}, blueprint requires ${expPoints}`);
    }

    const stem = normaliseStem(q);
    if ((stemCounts.get(stem) ?? 0) > 1) {
      codes.push('DUPLICATE_STEM');
      details.push('this question stem appears more than once in the exam');
    }
    if (!stem || PLACEHOLDER_PATTERNS.some((re) => re.test(String(q?.question ?? '')))) {
      codes.push('PLACEHOLDER_CONTENT');
      details.push('the question stem is a placeholder, not a real item');
    }

    if ((q?.type ?? spec.questionType) === 'multiple-choice') {
      const opts = Array.isArray(q?.options) ? q.options : [];
      const distinct = new Set(opts.map((o: any) => String(o).trim().toLowerCase()).filter(Boolean));
      if (opts.length < 2 || distinct.size < opts.length || distinct.size < 2) {
        codes.push('MALFORMED_OPTIONS');
        details.push(`multiple-choice item has ${opts.length} option(s), ${distinct.size} distinct`);
      }
      const key = Number(q?.correctAnswer);
      if (!Number.isInteger(key) || key < 0 || key >= opts.length) {
        codes.push('BAD_ANSWER_KEY');
        details.push(`correctAnswer ${JSON.stringify(q?.correctAnswer)} is not a valid index into ${opts.length} options`);
      }
    }

    if (codes.length === 0) {
      compliantItemCount++;
    } else {
      violations.push({
        itemNumber: spec.itemNumber,
        codes,
        detail: details.join('; '),
        expected,
        actual: {
          topic: actTopic,
          cognitiveLevel: actCog,
          type: q?.type,
          points: q?.points,
          question: String(q?.question ?? '').slice(0, 200),
        },
      });
    }
  }

  // Items the blueprint never asked for.
  const specNumbers = new Set(specs.map((s) => s.itemNumber));
  const extraItemNumbers = Array.from(byPlacement.keys())
    .filter((p) => !specNumbers.has(p))
    .sort((a, b) => a - b);
  for (const p of extraItemNumbers) {
    violations.push({
      itemNumber: p,
      codes: ['EXTRA_ITEM'],
      detail: `Generated item ${p} is outside the blueprint's item range.`,
      expected: { topic: '', cognitiveLevel: '', points: 0 },
      actual: { question: String(byPlacement.get(p)?.[0]?.question ?? '').slice(0, 200) },
    });
  }
  for (const q of unplaced) {
    violations.push({
      itemNumber: 0,
      codes: ['EXTRA_ITEM'],
      detail: 'Generated question has no usable itemPlacement.',
      expected: { topic: '', cognitiveLevel: '', points: 0 },
      actual: { question: String(q?.question ?? '').slice(0, 200) },
    });
  }

  const expectedTotal = specs.length;
  const actualTotal = items.length;
  const totalMatches = expectedTotal === actualTotal;
  const byTopic = countRows(expectedTopicCounts, actualTopicCounts);
  const byCognitiveLevel = countRows(expectedCogCounts, actualCogCounts);
  const compliant = totalMatches && violations.length === 0;

  const summaryParts: string[] = [];
  summaryParts.push(
    compliant
      ? `Compliant: all ${expectedTotal} items match the Table of Specifications.`
      : `NOT compliant: ${compliantItemCount}/${expectedTotal} items match the blueprint.`
  );
  if (!totalMatches) summaryParts.push(`Item count is ${actualTotal}, blueprint requires ${expectedTotal}.`);
  if (missingItemNumbers.length) summaryParts.push(`Missing items: ${summariseNumbers(missingItemNumbers)}.`);
  if (duplicateItemNumbers.length) summaryParts.push(`Duplicated placements: ${summariseNumbers(duplicateItemNumbers)}.`);
  if (extraItemNumbers.length) summaryParts.push(`Unexpected items: ${summariseNumbers(extraItemNumbers)}.`);
  const offTopic = byTopic.filter((r) => !r.ok);
  if (offTopic.length) {
    summaryParts.push(
      `Topic distribution off for: ${offTopic.map((r) => `${r.key} (${r.actual}/${r.expected})`).join(', ')}.`
    );
  }

  return {
    compliant,
    checkedAt,
    blueprintFileName: tosData.fileName,
    expectedTotal,
    actualTotal,
    totalMatches,
    byTopic,
    byCognitiveLevel,
    violations,
    missingItemNumbers,
    duplicateItemNumbers,
    extraItemNumbers,
    compliantItemCount,
    attemptsUsed,
    blueprintDiscrepancies,
    summary: summaryParts.join(' '),
  };
}

/** "1-3, 7, 19-28" — compact enough for a summary line. */
function summariseNumbers(nums: number[]): string {
  const sorted = Array.from(new Set(nums)).sort((a, b) => a - b);
  const out: string[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    out.push(i === j ? `${sorted[i]}` : `${sorted[i]}-${sorted[j]}`);
    i = j + 1;
  }
  return out.join(', ');
}

/**
 * The specs whose items must be regenerated: everything that is missing, duplicated or
 * failed a per-item check. Deliberately excludes EXTRA_ITEM — those are dropped, not re-asked.
 */
export function specsNeedingRegeneration(report: TOSComplianceReport, tosData: TOSData): TOSItemSpec[] {
  const bad = new Set<number>();
  for (const v of report.violations) {
    if (v.codes.length === 1 && v.codes[0] === 'EXTRA_ITEM') continue;
    if (v.itemNumber > 0) bad.add(v.itemNumber);
  }
  report.missingItemNumbers.forEach((n) => bad.add(n));
  report.duplicateItemNumbers.forEach((n) => bad.add(n));
  return (tosData.itemSpecs ?? [])
    .filter((s) => bad.has(s.itemNumber))
    .sort((a, b) => a.itemNumber - b.itemNumber);
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Validate, and on failure re-request ONLY the non-compliant items, up to `maxAttempts`.
 *
 * Regenerating the whole exam on every failure would be both slow and destructive — it would
 * throw away items that already satisfied the blueprint. The loop therefore splices repaired
 * items back in by placement.
 *
 * On exhaustion it returns the best set it achieved together with a report whose `compliant`
 * is false. It never reports a non-compliant exam as compliant; deciding what to do about
 * that is the caller's job (ExamGenerator blocks the save behind an explicit override).
 */
export async function enforceTOSCompliance(
  questions: any[],
  tosData: TOSData,
  regenerate: RegenerateFn,
  opts: EnforceOptions = {}
): Promise<{ questions: any[]; report: TOSComplianceReport }> {
  const maxAttempts = Math.max(0, opts.maxAttempts ?? 3);
  const baseDelayMs = opts.baseDelayMs ?? 800;
  const maxDelayMs = opts.maxDelayMs ?? 6000;
  const sleep = opts.sleep ?? defaultSleep;
  const onProgress = opts.onProgress;

  let current = Array.isArray(questions) ? [...questions] : [];
  let report = validateExamAgainstTOS(current, tosData, 0);

  for (let attempt = 1; attempt <= maxAttempts && !report.compliant; attempt++) {
    const specs = specsNeedingRegeneration(report, tosData);
    if (specs.length === 0) break; // non-compliant only via EXTRA_ITEM; regenerating cannot help

    onProgress?.(
      report.compliantItemCount,
      report.expectedTotal,
      `TOS check failed — regenerating ${specs.length} non-compliant item${specs.length === 1 ? '' : 's'} (attempt ${attempt} of ${maxAttempts})...`
    );

    let replacements: any[] = [];
    try {
      replacements = (await regenerate(specs, attempt, report)) ?? [];
    } catch (e: any) {
      console.warn(`[tosValidator] regeneration attempt ${attempt} threw:`, e);
      replacements = [];
    }

    if (replacements.length > 0) {
      // Splice by placement. Anything the retry returned without a usable placement is
      // matched back to the spec it was asked for, positionally, as a last resort.
      const byPlacement = new Map<number, any>();
      replacements.forEach((r, i) => {
        const p = placementOf(r) ?? specs[i]?.itemNumber ?? null;
        if (p !== null && !byPlacement.has(p)) byPlacement.set(p, { ...r, itemPlacement: p });
      });

      const targeted = new Set(specs.map((s) => s.itemNumber));
      // Drop every old item at a targeted placement, then insert the repaired ones.
      current = current.filter((q) => {
        const p = placementOf(q);
        return p === null ? true : !targeted.has(p);
      });
      byPlacement.forEach((q) => current.push(q));
      current.sort((a, b) => (placementOf(a) ?? 1e9) - (placementOf(b) ?? 1e9));
    }

    report = validateExamAgainstTOS(current, tosData, attempt);

    if (!report.compliant && attempt < maxAttempts) {
      await sleep(Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt - 1)));
    }
  }

  onProgress?.(
    report.compliantItemCount,
    report.expectedTotal,
    report.compliant
      ? `TOS compliance verified: ${report.expectedTotal} items match the blueprint.`
      : `TOS compliance could not be reached after ${report.attemptsUsed} regeneration attempt(s). ${report.summary}`
  );

  return { questions: current, report };
}
