import { autoPoints, scoreAttempt, gradeFor, isPending, isManual, PASSING_GRADE } from '../src/app/services/grading';

const mc = { id: 'q1', type: 'multiple-choice', options: ['a', 'b', 'c'], correctAnswer: 1, points: 5 };
const tf = { id: 'q2', type: 'true-false', correctAnswer: 'true', points: 2 };
const sa = { id: 'q3', type: 'short-answer', correctAnswer: 'Manila', points: 3 };
const es = { id: 'q4', type: 'essay', points: 10 };
const all = [mc, tf, sa, es];

describe('autoPoints', () => {
  test('multiple choice: right and wrong', () => {
    expect(autoPoints(mc, 1)).toBe(5);
    expect(autoPoints(mc, 0)).toBe(0);
  });
  test('true/false ignores letter case', () => {
    expect(autoPoints(tf, 'TRUE')).toBe(2);
    expect(autoPoints(tf, 'false')).toBe(0);
  });
  test('unanswered scores zero', () => {
    expect(autoPoints(mc, undefined)).toBe(0);
    expect(autoPoints(tf, '  ')).toBe(0);
  });
  test('short answer and essay are left for the instructor', () => {
    expect(autoPoints(sa, 'Manila')).toBeNull();
    expect(autoPoints(es, 'text')).toBeNull();
    expect(isManual(sa)).toBe(true);
    expect(isManual(mc)).toBe(false);
  });
});

describe('scoreAttempt', () => {
  test('written answers stay pending until checked', () => {
    const r = scoreAttempt(all, { q1: 1, q2: 'true', q3: 'Manila', q4: 'My essay' });
    expect(r.auto).toBe(7);
    expect(r.total).toBe(7);
    expect(r.pendingIds).toEqual(['q3', 'q4']);
    expect(r.hasManual).toBe(true);
  });
  test('instructor points are added once given', () => {
    const r = scoreAttempt(all, { q1: 1, q2: 'true', q3: 'Manila', q4: 'My essay' }, { q3: 3, q4: 8 });
    expect(r.manual).toBe(11);
    expect(r.total).toBe(18);
    expect(r.pendingIds).toEqual([]);
  });
  test('an unanswered written item needs no check', () => {
    const r = scoreAttempt(all, { q1: 0 });
    expect(r.total).toBe(0);
    expect(r.pendingIds).toEqual([]);
  });
  test('an exam with only objective items is never pending', () => {
    expect(scoreAttempt([mc, tf], { q1: 1 }).pendingIds).toHaveLength(0);
  });
  test('handles missing questions safely', () => {
    expect(scoreAttempt(undefined as any, {}).total).toBe(0);
  });
});

describe('gradeFor (65–100 scale)', () => {
  test.each([
    [0, 20, 65],
    [20, 20, 100],
    [10, 20, 83], // 65 + 17.5 rounded
    [6, 20, 76],
  ])('%i of %i → %i', (score, total, grade) => {
    expect(gradeFor(score, total).grade).toBe(grade);
  });
  test('75 is the passing mark', () => {
    expect(PASSING_GRADE).toBe(75);
    expect(gradeFor(6, 20).passed).toBe(true);
    expect(gradeFor(5, 20).passed).toBe(false); // 73.75 → 74
  });
  test('never goes outside 65–100', () => {
    expect(gradeFor(30, 20).grade).toBe(100);
    expect(gradeFor(-5, 20).grade).toBe(65);
    expect(gradeFor(5, 0).grade).toBe(65);
  });
  test('remarks follow the grade', () => {
    expect(gradeFor(20, 20).remark).toBe('Excellent');
    expect(gradeFor(0, 20).remark).toBe('Failed');
  });
});

describe('isPending', () => {
  test('only an explicit pending status counts', () => {
    expect(isPending({ gradingStatus: 'pending' })).toBe(true);
    expect(isPending({ gradingStatus: 'graded' })).toBe(false);
    expect(isPending({})).toBe(false); // older attempts
    expect(isPending(undefined)).toBe(false);
  });
});
