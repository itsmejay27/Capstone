/**
 * Turns the instructor's uploaded files (syllabus, TOS, slides, readings) into labelled
 * passages the exam generator can ground its questions in.
 *
 * The generator used to send only the first 3,000 characters of everything combined — about
 * one page — so most of a slide deck never reached the model and questions drifted to general
 * knowledge. Instead the text is cleaned, split into passages that remember their file and
 * slide/page, and each batch of questions gets the passages that matter to it:
 *  - with a TOS, the passages that best match the batch's topics;
 *  - without one, a different slice of the material per batch, so the exam covers all of it.
 */

export interface SourcePassage {
  /** Order in the original material, used to keep picked passages readable. */
  order: number;
  /** "Lesson3.pptx · Slide 7", "Syllabus.pdf", … */
  label: string;
  kind: 'syllabus' | 'tos' | 'material';
  text: string;
  words: Set<string>;
}

const STOP = new Set('the a an and or of to in on for is are was were be by with as at from that this these those it its into than then which who what when where how why can will not no yes you your our their they we he she his her them also such may must should use used using each other more most all any both about between within per via'.split(' '));

const words = (s: string) => new Set(
  s.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w))
);

/** Lines repeated on many pages (headers, footers, "Page 3 of 20") add noise, not content. */
function dropRepeatedLines(text: string): string {
  const lines = text.split('\n');
  const counts = new Map<string, number>();
  for (const l of lines) {
    const k = l.trim().toLowerCase();
    if (k) counts.set(k, (counts.get(k) || 0) + 1);
  }
  return lines
    .filter((l) => {
      const k = l.trim().toLowerCase();
      if (!k) return true;
      if (/^(page\s*)?\d+(\s*(of|\/)\s*\d+)?$/.test(k)) return false;
      return (counts.get(k) || 0) < 4 || k.length > 120;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
}

const TARGET = 1400;

/**
 * Split the combined upload text (sections headed "=== KIND: file ===") into passages of
 * roughly TARGET characters, cut at slide, page or paragraph boundaries.
 */
export function buildSourcePassages(uploadedText?: string): SourcePassage[] {
  if (!uploadedText?.trim()) return [];
  const sections = uploadedText.split(/\n*=== (.+?) ===\n/).slice(1);
  const out: SourcePassage[] = [];
  for (let i = 0; i < sections.length; i += 2) {
    const header = sections[i] || '';
    const body = dropRepeatedLines(sections[i + 1] || '');
    const kind: SourcePassage['kind'] = /SYLLABUS/i.test(header) ? 'syllabus' : /SPECIFICATION/i.test(header) ? 'tos' : 'material';
    const file = header.replace(/^[^:(]*[:(]\s*/, '').replace(/\)\s*$/, '').trim() || header;

    // Slides and pages are natural units; otherwise paragraphs.
    const isSlides = /--- Slide \d+ ---/.test(body);
    const units = isSlides ? body.split(/(?=--- Slide \d+ ---)/) : body.split(/\n\s*\n/);
    // A slide usually holds one idea, so slides stay separate unless they are very short.
    const limit = isSlides ? 450 : TARGET;
    let buf = '';
    let bufLabel = '';
    const flush = () => {
      const text = buf.trim();
      if (text.length > 40) out.push({ order: out.length, label: bufLabel || file, kind, text, words: words(text) });
      buf = '';
      bufLabel = '';
    };
    for (const unit of units) {
      const u = unit.trim();
      if (!u) continue;
      const slide = u.match(/^--- Slide (\d+) ---/)?.[1];
      const unitLabel = slide ? `${file} · Slide ${slide}` : file;
      if (buf && buf.length + u.length > limit) flush();
      if (!bufLabel) bufLabel = unitLabel;
      else if (slide && !bufLabel.endsWith(`Slide ${slide}`)) bufLabel = bufLabel.replace(/(Slide \d+)(–\d+)?$/, `$1–${slide}`);
      buf += (buf ? '\n' : '') + (u.length > TARGET * 2 ? u.slice(0, TARGET * 2) : u);
    }
    flush();
  }
  return out;
}

function render(picked: SourcePassage[]): string {
  return [...picked]
    .sort((a, b) => a.order - b.order)
    .map((p) => `[${p.label}]\n${p.text}`)
    .join('\n\n');
}

function takeWithinBudget(list: SourcePassage[], budget: number): SourcePassage[] {
  const picked: SourcePassage[] = [];
  let used = 0;
  for (const p of list) {
    if (used + p.text.length > budget && picked.length > 0) continue;
    picked.push(p);
    used += p.text.length;
    if (used >= budget) break;
  }
  return picked;
}

/** The syllabus's course description / outcomes, kept short, for every batch. */
export function syllabusOutline(passages: SourcePassage[], budget = 2500): string {
  return render(takeWithinBudget(passages.filter((p) => p.kind === 'syllabus'), budget));
}

/**
 * Passages most relevant to the given topics (TOS batches). Scored by shared words, so a
 * topic "Normalization and 3NF" pulls the slides that actually talk about normal forms.
 */
export function passagesForTopics(passages: SourcePassage[], topics: string[], budget = 14000): string {
  // The syllabus is already sent as the outline; match against the teaching material.
  const material = passages.filter((p) => p.kind === 'material');
  const pool = material.length ? material : passages.filter((p) => p.kind !== 'tos');
  if (pool.length === 0) return '';
  const q = words(topics.join(' '));
  const scored = pool
    .map((p) => {
      let hits = 0;
      q.forEach((w) => { if (p.words.has(w)) hits++; });
      return { p, score: q.size ? hits / Math.sqrt(q.size) : 0 };
    })
    .sort((a, b) => b.score - a.score);
  const relevant = scored.filter((s) => s.score > 0).map((s) => s.p);
  // Nothing matched (a vague topic): fall back to an even spread so the batch still has material.
  const list = relevant.length ? relevant : spreadSlice(pool, 0, 1);
  return render(takeWithinBudget(list, budget));
}

function spreadSlice(pool: SourcePassage[], index: number, count: number): SourcePassage[] {
  if (count <= 1) return pool;
  const size = Math.ceil(pool.length / count);
  return pool.slice(index * size, index * size + size);
}

/**
 * A different part of the material for each batch (no TOS), so ten questions come from ten
 * places in the slides instead of all from the first pages.
 */
export function passagesForBatch(passages: SourcePassage[], batchIndex: number, batchCount: number, budget = 14000): string {
  const pool = passages.filter((p) => p.kind === 'material');
  const use = pool.length ? pool : passages.filter((p) => p.kind !== 'tos');
  if (use.length === 0) return '';
  const slice = spreadSlice(use, batchIndex % Math.max(1, batchCount), batchCount);
  return render(takeWithinBudget(slice.length ? slice : use, budget));
}

/** The shared grounding rules, added to a batch's prompt whenever there is source material. */
export const GROUNDING_RULES = `GROUNDING RULES — the SOURCE MATERIAL is the instructor's own files and is the ground truth:
1. Write every question from the SOURCE MATERIAL: its definitions, examples, terminology, figures, steps and facts. Do not introduce facts it does not support.
2. The correct answer must be verifiable from the source, and each distractor must be wrong according to the source.
3. Prefer concepts the source explains in depth over words it only mentions in passing. Spread questions across different passages; do not ask two questions about the same sentence.
4. Use the source's own terms and naming, so students recognise what was taught.
5. Ignore administrative text: course codes, schedules, grading policy, signatures, revision numbers and page headers.
6. Set "source" on each question to the bracketed label of the passage it came from (for example "Lesson3.pptx · Slide 7").`;
