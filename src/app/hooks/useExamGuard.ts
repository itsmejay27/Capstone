import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Exam integrity and timing.
 *
 * TIMING: seconds are credited to the question the student is working on — the one they
 * last clicked, typed in or answered, or failing that the one most in view — and only while
 * the tab is visible. The result is total time plus seconds per question, which the
 * instructor sees in the gradebook.
 *
 * INTEGRITY: copy, cut, paste, right-click, selection and the usual screenshot / print /
 * devtools shortcuts are blocked and counted, and leaving the tab is counted. The content is
 * blurred whenever the window loses focus, and the Print Screen key wipes the clipboard.
 *
 * Honest limit: a web page cannot stop an OS-level screenshot, a phone camera or a second
 * device. These measures deter casual copying and give the instructor a record of
 * suspicious behaviour; they are not a lockdown browser.
 */

export interface ExamIntegrity {
  tabSwitches: number;
  copyAttempts: number;
  pasteAttempts: number;
  screenshotAttempts: number;
  rightClicks: number;
  shortcutAttempts: number;
}

export interface ExamTiming {
  totalSeconds: number;
  perQuestion: Record<string, number>;
  averageSecondsPerQuestion: number;
}

const EMPTY: ExamIntegrity = { tabSwitches: 0, copyAttempts: 0, pasteAttempts: 0, screenshotAttempts: 0, rightClicks: 0, shortcutAttempts: 0 };

export function useExamGuard(active: boolean, onViolation?: (message: string) => void, initial?: { timing?: ExamTiming; integrity?: ExamIntegrity }) {
  const perQuestion = useRef<Record<string, number>>({ ...(initial?.timing?.perQuestion || {}) });
  const total = useRef<number>(initial?.timing?.totalSeconds || 0);
  const current = useRef<string | null>(null);
  const integrity = useRef<ExamIntegrity>({ ...EMPTY, ...(initial?.integrity || {}) });
  const [obscured, setObscured] = useState(false);
  const warnRef = useRef(onViolation);
  warnRef.current = onViolation;

  /** Mark the question being worked on (call on click/focus/answer). */
  const focusQuestion = useCallback((questionId: string) => { current.current = questionId; }, []);

  // Tick: one second to the current question while visible and focused.
  useEffect(() => {
    if (!active) return;
    const pickVisible = () => {
      if (current.current) return current.current;
      let best: string | null = null; let bestArea = 0;
      document.querySelectorAll<HTMLElement>('[data-question-id]').forEach((el) => {
        const r = el.getBoundingClientRect();
        const visible = Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0));
        if (visible > bestArea) { bestArea = visible; best = el.dataset.questionId || null; }
      });
      return best;
    };
    const t = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      total.current += 1;
      const q = pickVisible();
      if (q) perQuestion.current[q] = (perQuestion.current[q] || 0) + 1;
    }, 1000);
    return () => window.clearInterval(t);
  }, [active]);

  // Integrity listeners.
  useEffect(() => {
    if (!active) return;
    const bump = (k: keyof ExamIntegrity, msg: string) => { integrity.current[k] += 1; warnRef.current?.(msg); };

    const onCopy = (e: ClipboardEvent) => { e.preventDefault(); bump('copyAttempts', 'Copying is disabled during the exam.'); };
    const onPaste = (e: ClipboardEvent) => { e.preventDefault(); bump('pasteAttempts', 'Pasting is disabled during the exam.'); };
    const onContext = (e: MouseEvent) => { e.preventDefault(); bump('rightClicks', 'Right-click is disabled during the exam.'); };
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;
      if (e.key === 'PrintScreen' || (e.metaKey && e.shiftKey && ['3', '4', '5', 's'].includes(k)) || (e.key === 'S' && e.shiftKey && e.metaKey)) {
        e.preventDefault(); bump('screenshotAttempts', 'Screenshots are not allowed during the exam. This was recorded.');
        return;
      }
      if (mod && ['c', 'x', 'v', 'a', 'p', 's', 'u'].includes(k)) {
        e.preventDefault();
        bump(k === 'v' ? 'pasteAttempts' : k === 'c' || k === 'x' ? 'copyAttempts' : 'shortcutAttempts', 'That shortcut is disabled during the exam.');
        return;
      }
      if (e.key === 'F12' || (mod && e.shiftKey && ['i', 'j', 'c'].includes(k))) {
        e.preventDefault(); bump('shortcutAttempts', 'Developer tools are disabled during the exam.');
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      // Windows puts the capture on the clipboard; overwrite it.
      if (e.key === 'PrintScreen') {
        navigator.clipboard?.writeText('Screenshots are disabled during this exam.').catch(() => {});
        bump('screenshotAttempts', 'Screenshots are not allowed during the exam. This was recorded.');
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') bump('tabSwitches', 'You left the exam tab. This was recorded.');
    };
    const onBlur = () => setObscured(true);
    const onFocus = () => setObscured(false);

    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCopy);
    document.addEventListener('paste', onPaste);
    document.addEventListener('contextmenu', onContext);
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('keyup', onKeyUp, true);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    document.body.classList.add('exam-guard-active');
    return () => {
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCopy);
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('contextmenu', onContext);
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('keyup', onKeyUp, true);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      document.body.classList.remove('exam-guard-active');
    };
  }, [active]);

  /** Snapshot to store on the attempt. */
  const snapshot = useCallback((questionCount: number): { timing: ExamTiming; integrity: ExamIntegrity } => {
    const answeredTimes = Object.values(perQuestion.current);
    const spent = answeredTimes.reduce((a, b) => a + b, 0);
    return {
      timing: {
        totalSeconds: total.current,
        perQuestion: { ...perQuestion.current },
        averageSecondsPerQuestion: questionCount > 0 ? Math.round(spent / questionCount) : 0,
      },
      integrity: { ...integrity.current },
    };
  }, []);

  return { focusQuestion, snapshot, obscured };
}

/** "3m 05s" */
export function formatDuration(seconds?: number): string {
  if (!seconds && seconds !== 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`;
}
