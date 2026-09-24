import { newCard, review, isDue, retention } from '../src/app/services/srs';

const now = new Date('2026-01-01T00:00:00Z');
const DAY = 86400000;

describe('spaced repetition', () => {
  test('a new card is due immediately', () => {
    expect(isDue(newCard('1', 'f', 'b'), new Date(Date.now() + 1000))).toBe(true);
  });
  test('"Again" brings the card back in a minute and lowers ease', () => {
    const c = review(newCard('1', 'f', 'b'), 'again', now);
    expect(new Date(c.due).getTime() - now.getTime()).toBe(60000);
    expect(c.ease).toBeCloseTo(2.3);
    expect(c.lapses).toBe(1);
  });
  test('"Good" schedules 1 day, then 6 days, then grows', () => {
    let c = review(newCard('1', 'f', 'b'), 'good', now);
    expect(c.interval).toBe(1);
    c = review(c, 'good', now);
    expect(c.interval).toBe(6);
    c = review(c, 'good', now);
    expect(c.interval).toBe(15); // 6 * 2.5
    expect(new Date(c.due).getTime() - now.getTime()).toBe(15 * DAY);
  });
  test('"Easy" starts at 3 days', () => {
    expect(review(newCard('1', 'f', 'b'), 'easy', now).interval).toBe(3);
  });
  test('ease never drops below 1.3', () => {
    let c = newCard('1', 'f', 'b');
    for (let i = 0; i < 20; i++) c = review(c, 'again', now);
    expect(c.ease).toBe(1.3);
  });
  test('retention counts cards reviewed well at least twice', () => {
    const a = review(review(newCard('a', 'f', 'b'), 'good', now), 'good', now);
    const b = newCard('b', 'f', 'b');
    expect(retention([a, b])).toBe(0.5);
    expect(retention([])).toBe(0);
  });
});
