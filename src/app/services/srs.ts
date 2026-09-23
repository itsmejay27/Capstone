/**
 * Spaced repetition (a compact SM-2). Each card carries ease, interval (days) and a due
 * time. "Again" brings a card back in a minute and lowers its ease; "Good" and "Easy" push
 * it further out each time, so cards you know fade away and cards you miss come back sooner.
 */
export interface SrsCard {
  id: string; front: string; back: string; topic?: string;
  ease: number; interval: number; reps: number; lapses: number; due: string;
}
export type Grade = 'again' | 'hard' | 'good' | 'easy';

export function newCard(id: string, front: string, back: string, topic?: string): SrsCard {
  return { id, front, back, topic, ease: 2.5, interval: 0, reps: 0, lapses: 0, due: new Date().toISOString() };
}

export function review(card: SrsCard, grade: Grade, now = new Date()): SrsCard {
  let { ease, interval, reps, lapses } = card;
  const minute = 60 * 1000, day = 24 * 60 * minute;
  let dueMs: number;
  if (grade === 'again') {
    lapses += 1; reps = 0; ease = Math.max(1.3, ease - 0.2); interval = 0;
    dueMs = now.getTime() + minute;
  } else {
    if (grade === 'hard') ease = Math.max(1.3, ease - 0.15);
    if (grade === 'easy') ease += 0.15;
    reps += 1;
    if (reps === 1) interval = grade === 'easy' ? 3 : 1;
    else if (reps === 2) interval = grade === 'hard' ? 3 : 6;
    else interval = Math.round(interval * (grade === 'hard' ? 1.2 : grade === 'easy' ? ease * 1.3 : ease));
    dueMs = now.getTime() + interval * day;
  }
  return { ...card, ease, interval, reps, lapses, due: new Date(dueMs).toISOString() };
}

export const isDue = (c: SrsCard, now = new Date()) => new Date(c.due).getTime() <= now.getTime();

/** Share of cards the student has reviewed successfully at least twice. */
export const retention = (cards: SrsCard[]) => (cards.length ? cards.filter((c) => c.reps >= 2).length / cards.length : 0);
