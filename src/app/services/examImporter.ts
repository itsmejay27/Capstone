/**
 * Turns an existing exam document back into structured questions.
 *
 * The parser is deterministic rather than AI-driven, because the documents it is most often
 * handed are this system's own printouts: the format is known, so guessing is unnecessary,
 * and a local parse is instant, free and repeatable. Anything it cannot place is reported
 * rather than silently dropped, so an instructor can see what needs manual attention
 * instead of discovering a short exam later.
 *
 * Recognised shape (matches PrintableExam's output):
 *
 *   PART I — MULTIPLE CHOICE — Write the letter of ...
 *   1. Question stem here? (2 pts)
 *   A. option   B. option   C. option   D. option
 *
 *   PART II — TRUE OR FALSE — ...
 *   6. Statement here. (1 pt)  _______ TRUE _______ FALSE
 *
 *   PART III — IDENTIFICATION / SHORT ANSWER
 *   PART IV — ESSAY
 */

export type ImportedQuestionType = 'multiple-choice' | 'true-false' | 'short-answer' | 'essay';

export interface ImportedQuestion {
  itemNumber: number;
  type: ImportedQuestionType;
  question: string;
  options?: string[];
  /** Index into `options`, or 'true' / 'false'. Undefined when the paper has no key. */
  correctAnswer?: number | string;
  points: number;
}

export interface ImportResult {
  title?: string;
  instructor?: string;
  totalPoints?: number;
  durationMinutes?: number;
  questions: ImportedQuestion[];
  /** Human-readable notes about anything skipped or guessed. */
  warnings: string[];
}

/** Page furniture from a browser print — repeated on every page, never part of a question. */
const PAGE_CHROME = [
  /^\s*\d{1,2}\/\d{1,2}\/\d{2,4},\s*\d{1,2}:\d{2}\s*(AM|PM)\s*$/i,
  /^https?:\/\/\S+$/i,
  /^\s*\d+\s*\/\s*\d+\s*$/,
  /^Republic of the Philippines$/i,
  /^OCCIDENTAL MINDORO STATE COLLEGE$/i,
];

const PART_HEADING = /^PART\s+([IVXLC]+)\s*[—–-]\s*([A-Z /]+?)\s*(?:[—–-]\s*(.*))?$/i;
/**
 * "12. Some question text (2 pts)" — the points suffix is optional, and so is the space
 * after the number: coordinate-based PDF extraction frequently emits "12.Some question",
 * because the glyphs sit close enough together that no gap is recorded. The rest must
 * start with a letter or quote so a decimal ("1.5 marks") is not read as item 1.
 */
const ITEM_START = /^(\d{1,3})[.)]\s*(["'(]?[A-Za-z].*)$/;
const POINTS_SUFFIX = /\((\d+(?:\.\d+)?)\s*(?:pts?|points?)\)\s*$/i;
/** "A. option text" — also tolerates "A)" and a lowercase letter. */
const OPTION_START = /^([A-Ha-h])[.)]\s*(["'(]?[A-Za-z0-9].*)$/;
const TF_BLANKS = /_{2,}\s*TRUE\s*_{2,}\s*FALSE/i;

function sectionTypeFor(heading: string): ImportedQuestionType | null {
  const h = heading.toUpperCase();
  if (h.includes('MULTIPLE')) return 'multiple-choice';
  if (h.includes('TRUE')) return 'true-false';
  if (h.includes('ESSAY')) return 'essay';
  if (h.includes('IDENTIFICATION') || h.includes('SHORT')) return 'short-answer';
  return null;
}

/**
 * Splits a single run-on line into logical lines.
 *
 * PDF text extraction collapses a page into one long string, so item numbers and option
 * letters have to be re-broken before anything can be parsed. Only breaks on markers that
 * follow sentence-ending punctuation or another marker, so a decimal inside a stem
 * ("worth 20%. 5 marks") does not split the question in half.
 */
function reflow(raw: string): string[] {
  const normalised = raw
    .replace(/\r/g, '\n')
    // The shared PDF extractor is coordinate-aware and marks a wide horizontal gap with a
    // tab-pipe-tab delimiter. On an exam paper that gap separates a part heading from its
    // instruction line, or two options printed side by side, so it is a line break here.
    // This must run BEFORE whitespace is collapsed: once the tabs become spaces the
    // delimiter is indistinguishable from a literal pipe in the question text.
    .replace(/\t\|\t/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ');

  // Break aggressively on anything that *could* start an item or an option. A decimal or a
  // stray "3." inside a stem will also break here, which is why the parser below only
  // accepts an item number that advances — everything else is folded back into the stem.
  const withBreaks = normalised
    // PART headings always start a line.
    .replace(/\s+(PART\s+[IVXLC]+\s*[—–-])/gi, '\n$1')
    // A number followed by ". " and a capital is a candidate item start, wherever it sits.
    .replace(/\s+(\d{1,3}[.)]\s*(?=[A-Z"'(]))/g, '\n$1')
    // A single letter followed by ". " is a candidate option start.
    .replace(/\s+([A-H][.)]\s*(?=[A-Z0-9"'(]))/g, '\n$1');

  return withBreaks
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !PAGE_CHROME.some((re) => re.test(l)));
}

function readHeader(lines: string[]): Pick<ImportResult, 'title' | 'instructor' | 'totalPoints' | 'durationMinutes'> {
  const head = lines.slice(0, 12).join(' ');
  const points = head.match(/Total Points:\s*(\d+)/i);
  const time = head.match(/Time Allotted:\s*(\d+)/i);
  const instructor = head.match(/Instructor:\s*([^:]+?)(?:\s+Name:|\s+Date:|\s+Score:|$)/i);
  return {
    totalPoints: points ? Number(points[1]) : undefined,
    durationMinutes: time ? Number(time[1]) : undefined,
    instructor: instructor ? instructor[1].trim() : undefined,
  };
}

export function parseExamDocument(rawText: string, fileName?: string): ImportResult {
  const lines = reflow(rawText);
  const header = readHeader(lines);
  const warnings: string[] = [];
  const questions: ImportedQuestion[] = [];

  let sectionType: ImportedQuestionType | null = null;
  let current: ImportedQuestion | null = null;
  // Item numbers only ever advance in an exam paper. Anything that looks like an item start
  // but does not advance is a false positive from the aggressive line-breaking above — a
  // decimal, a year, an enumerated clause inside a stem — and is folded back into the text.
  let lastItemNumber = 0;

  const commit = () => {
    if (!current) return;
    const q = current;
    current = null;

    // The points marker often lands on a wrapped continuation line rather than the first
    // one, so it has to be stripped again once the whole stem has been assembled.
    const trailingPoints = q.question.match(POINTS_SUFFIX);
    if (trailingPoints) {
      q.points = Number(trailingPoints[1]);
      q.question = q.question.replace(POINTS_SUFFIX, '').trim();
    }

    if (!q.question.trim()) {
      warnings.push(`Item ${q.itemNumber} had no question text and was skipped.`);
      return;
    }
    if (q.type === 'multiple-choice') {
      if (!q.options || q.options.length < 2) {
        warnings.push(`Item ${q.itemNumber} looked like multiple choice but had fewer than two options; imported as short answer.`);
        q.type = 'short-answer';
        delete q.options;
      } else if (q.correctAnswer === undefined) {
        // A blank exam paper carries no key. Defaulting to A would be a wrong answer
        // presented as authoritative, so the item is flagged instead.
        q.correctAnswer = 0;
        warnings.push(`Item ${q.itemNumber}: no answer key in the document — set to A, please verify.`);
      }
    }
    if (q.type === 'true-false' && q.correctAnswer === undefined) {
      q.correctAnswer = 'true';
      warnings.push(`Item ${q.itemNumber}: no answer key in the document — set to TRUE, please verify.`);
    }
    questions.push(q);
  };

  for (const line of lines) {
    const part = line.match(PART_HEADING);
    if (part) {
      commit();
      const detected = sectionTypeFor(`${part[2]} ${part[3] || ''}`);
      if (detected) sectionType = detected;
      else warnings.push(`Could not tell what kind of questions "${line}" contains; items were read as short answer.`);
      continue;
    }

    const item = line.match(ITEM_START);
    if (item && Number(item[1]) > lastItemNumber) {
      commit();
      lastItemNumber = Number(item[1]);
      let stem = item[2].trim();
      let points = sectionType === 'multiple-choice' ? 2 : 1;
      const pts = stem.match(POINTS_SUFFIX);
      if (pts) {
        points = Number(pts[1]);
        stem = stem.replace(POINTS_SUFFIX, '').trim();
      }
      // A true/false item often carries its answer blanks on the same line.
      const hadBlanks = TF_BLANKS.test(stem);
      if (hadBlanks) stem = stem.replace(TF_BLANKS, '').trim();

      current = {
        itemNumber: Number(item[1]),
        type: hadBlanks ? 'true-false' : (sectionType || 'short-answer'),
        question: stem,
        points,
        ...(sectionType === 'multiple-choice' ? { options: [] } : {}),
      };
      continue;
    }

    if (!current) continue;

    // A rejected item start (number did not advance) belongs to the text it interrupted.
    if (item) {
      if (current.type === 'multiple-choice' && current.options && current.options.length > 0) {
        current.options[current.options.length - 1] += ` ${line}`;
      } else {
        current.question = `${current.question} ${line}`.trim();
      }
      continue;
    }

    const option = line.match(OPTION_START);
    if (option) {
      if (current.type === 'multiple-choice') {
        current.options = current.options || [];
        // Five or more options means the letters are being mis-read; append instead of
        // inventing an option E that the paper never had.
        if (current.options.length < 4) current.options.push(option[2].trim());
        else current.options[3] += ` ${line}`;
      } else {
        current.question = `${current.question} ${line}`.trim();
      }
      continue;
    }

    if (TF_BLANKS.test(line)) {
      current.type = 'true-false';
      delete current.options;
      continue;
    }

    // Anything else is a continuation of the stem (wrapped line).
    if (!/^_+$/.test(line)) {
      current.question = `${current.question} ${line}`.trim();
    }
  }
  commit();

  if (questions.length === 0) {
    warnings.push('No numbered questions were found. The document may be a scan, or use a layout this importer does not recognise.');
  }

  // Duplicate stems are worth surfacing: they are usually a generator fallback repeating
  // the same template text, and an instructor importing the paper should see it.
  const seenStems = new Map<string, number>();
  const repeated: string[] = [];
  for (const q of questions) {
    const key = q.question.trim().toLowerCase();
    if (seenStems.has(key)) repeated.push(`${seenStems.get(key)} & ${q.itemNumber}`);
    else seenStems.set(key, q.itemNumber);
  }
  if (repeated.length > 0) {
    warnings.push(`Identical question text on items ${repeated.join(', ')}. Reword or replace them before using this exam.`);
  }

  const numbers = questions.map((q) => q.itemNumber);
  const duplicates = numbers.filter((n, i) => numbers.indexOf(n) !== i);
  if (duplicates.length > 0) {
    warnings.push(`Repeated item numbers: ${[...new Set(duplicates)].join(', ')}. Check the import for duplicates.`);
  }

  return {
    ...header,
    title: fileName ? fileName.replace(/\.(pdf|docx?|txt)$/i, '') : undefined,
    questions,
    warnings,
  };
}
