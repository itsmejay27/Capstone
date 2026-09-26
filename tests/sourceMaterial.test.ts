import { buildSourcePassages, passagesForTopics, passagesForBatch, syllabusOutline } from '../src/app/services/sourceMaterial';

const slides = Array.from({ length: 12 }, (_, i) => {
  const n = i + 1;
  const topic = n <= 4 ? 'Normalization removes redundancy; first normal form requires atomic values.'
    : n <= 8 ? 'SQL joins combine rows: inner join, left join, right join and full outer join.'
    : 'Transactions follow ACID: atomicity, consistency, isolation and durability.';
  return `--- Slide ${n} ---\nOMSC College of Computing\n${topic} Detail ${n} ${'x'.repeat(300)}`;
}).join('\n\n');

const upload = [
  '=== COURSE SYLLABUS: syllabus.pdf ===',
  'Course description: Database Systems covers relational design, SQL and transactions.\nPage 1 of 3',
  '',
  '=== ATTACHED MATERIAL: lesson.pptx ===',
  slides,
].join('\n');

describe('source material', () => {
  const passages = buildSourcePassages(upload);

  it('labels passages with their file and slide range', () => {
    expect(passages.some((p) => p.kind === 'syllabus')).toBe(true);
    const labels = passages.filter((p) => p.kind === 'material').map((p) => p.label);
    expect(labels[0]).toMatch(/^lesson\.pptx · Slide 1/);
    expect(labels.every((l) => l.startsWith('lesson.pptx'))).toBe(true);
  });

  it('drops headers repeated on every slide and page-number lines', () => {
    const all = passages.map((p) => p.text).join('\n');
    expect(all).not.toMatch(/OMSC College of Computing/);
    expect(all).not.toMatch(/Page 1 of 3/);
  });

  it('picks the passages that match a batch topic', () => {
    const text = passagesForTopics(passages, ['ACID transactions isolation'], 2000);
    expect(text).toMatch(/durability/);
    expect(text).not.toMatch(/inner join/);
  });

  it('gives each batch a different part of the material', () => {
    const first = passagesForBatch(passages, 0, 3);
    const last = passagesForBatch(passages, 2, 3);
    expect(first).toMatch(/Normalization/);
    expect(last).toMatch(/ACID/);
    expect(first).not.toEqual(last);
  });

  it('keeps a short syllabus outline for every batch', () => {
    expect(syllabusOutline(passages)).toMatch(/Database Systems covers/);
  });

  it('returns nothing when no files were uploaded', () => {
    expect(buildSourcePassages('')).toEqual([]);
    expect(passagesForBatch([], 0, 2)).toBe('');
  });
});
