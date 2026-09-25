/**
 * Due dates must be at least this far in the future: a due time in the past, or one that
 * leaves students only a few minutes, is almost always a mistake.
 */
export const MIN_LEAD_MINUTES = 10;

/** Earliest allowed value for an <input type="datetime-local">, in local time. */
export function minDueLocal(now = new Date()): string {
  const d = new Date(now.getTime() + MIN_LEAD_MINUTES * 60_000);
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

/** An error message for a chosen due date, or '' when it is fine (or empty). */
export function dueDateProblem(value?: string, now = new Date()): string {
  if (!value) return '';
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return 'Enter a valid date and time.';
  if (t < now.getTime()) return 'This date and time has already passed.';
  if (t < now.getTime() + MIN_LEAD_MINUTES * 60_000) return `Give students at least ${MIN_LEAD_MINUTES} minutes.`;
  return '';
}
