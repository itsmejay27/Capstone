import { useCallback, useEffect, useState } from 'react';
import { fetchStudyItems, upsertStudyItem, deleteStudyItem } from './supabaseData';

/**
 * Per-student study items (flashcard decks, practice sets, summaries, concept maps, focus
 * sessions), saved to Supabase and cached in the browser so the Study Hub works offline too.
 */
export type StudyKind = 'deck' | 'practice' | 'summary' | 'map' | 'session';
export interface StudyItem<T = any> { id: string; userId: string; kind: StudyKind; title: string; data: T; createdAt?: string; updatedAt?: string }

const cacheKey = (userId: string) => `studyItems:${userId}`;
const EVENT = 'study-items-changed';

function readCache(userId: string): StudyItem[] {
  try { return JSON.parse(localStorage.getItem(cacheKey(userId)) || '[]'); } catch { return []; }
}
function writeCache(userId: string, items: StudyItem[]) {
  try { localStorage.setItem(cacheKey(userId), JSON.stringify(items)); } catch { /* quota */ }
  window.dispatchEvent(new Event(EVENT));
}

export function useStudyItems(userId?: string | null) {
  const [items, setItems] = useState<StudyItem[]>(() => (userId ? readCache(userId) : []));

  useEffect(() => {
    if (!userId) return;
    setItems(readCache(userId));
    fetchStudyItems(userId).then((remote) => {
      if (remote.length === 0) return;
      // Newest copy of each item wins.
      const byId = new Map<string, StudyItem>();
      for (const it of [...readCache(userId), ...remote] as StudyItem[]) {
        const prev = byId.get(it.id);
        if (!prev || String(it.updatedAt || '') >= String(prev.updatedAt || '')) byId.set(it.id, it);
      }
      const merged = Array.from(byId.values());
      writeCache(userId, merged);
      setItems(merged);
    });
    const on = () => setItems(readCache(userId));
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, [userId]);

  const save = useCallback((item: Omit<StudyItem, 'userId'> & { userId?: string }) => {
    if (!userId) return;
    const full: StudyItem = { ...item, userId, updatedAt: new Date().toISOString(), createdAt: item.createdAt || new Date().toISOString() } as StudyItem;
    const next = [full, ...readCache(userId).filter((i) => i.id !== full.id)];
    writeCache(userId, next);
    void upsertStudyItem(full);
    return full;
  }, [userId]);

  const remove = useCallback((id: string) => {
    if (!userId) return;
    writeCache(userId, readCache(userId).filter((i) => i.id !== id));
    void deleteStudyItem(id);
  }, [userId]);

  const ofKind = useCallback(<T,>(kind: StudyKind) => items.filter((i) => i.kind === kind) as StudyItem<T>[], [items]);

  return { items, ofKind, save, remove };
}

export const newId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/** Log minutes of study for streaks and time-spent (called by the focus timer and tools). */
export function logStudySession(save: ReturnType<typeof useStudyItems>['save'], minutes: number, activity: string) {
  if (minutes <= 0) return;
  save({ id: newId('ses'), kind: 'session', title: activity, data: { minutes: Math.round(minutes * 10) / 10, date: new Date().toISOString(), activity } });
}
