import { bandFor, formatDuration, formatPercent, analyzeExam } from '../src/app/services/itemAnalysis';

describe('item analysis helpers', () => {
  test('difficulty bands', () => {
    expect(bandFor(0.9)).toBe('easy');
    expect(bandFor(0.8)).toBe('easy');
    expect(bandFor(0.5)).toBe('moderate');
    expect(bandFor(0.1)).toBe('difficult');
  });
  test('formatDuration', () => {
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(3700)).toBe('1h 01m');
    expect(formatDuration(null)).toBe('—');
  });
  test('formatPercent', () => {
    expect(formatPercent(0.456, 1)).toBe('45.6%');
    expect(formatPercent(undefined)).toBe('—');
  });
  test('analyzeExam works with no attempts', () => {
    const exam = { id: 'e1', totalPoints: 5, questions: [{ id: 'q1', type: 'multiple-choice', options: ['a', 'b'], correctAnswer: 0, points: 5 }] };
    expect(() => analyzeExam(exam, [])).not.toThrow();
  });
});
