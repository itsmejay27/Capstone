import { supabase } from '../config/supabaseClient';

/**
 * Transactional email, sent through the `send-email` Supabase Edge Function.
 *
 * The Resend API key is NEVER present in this file, in any `VITE_*` variable, or anywhere in
 * the client bundle — Vite inlines `VITE_*` into public JS, so a key placed there is readable
 * by anyone who opens devtools. The key lives only as a Supabase secret read by the function.
 * (Resend also rejects browser-origin requests, so a direct call from here would fail.)
 *
 * Every send is best-effort and non-blocking: email is a notification channel, not the
 * source of truth. A failure is reported to the caller but must never prevent an
 * announcement being posted or an assignment being created.
 */

export type EmailTemplate = 'announcement' | 'assignment' | 'due_reminder' | 'graded' | 'comment';

export interface EmailResult {
  ok: boolean;
  sent?: number;
  error?: string;
  /** True when email is simply not set up; callers should stay silent rather than alarm the user. */
  skipped?: boolean;
}

export interface SendEmailArgs {
  template: EmailTemplate;
  to: string[];
  data: {
    className?: string;
    title?: string;
    authorName?: string;
    body?: string;
    dueLabel?: string;
    grade?: number;
    ctaUrl?: string;
    ctaLabel?: string;
  };
}

/** Where the app is deployed, for the CTA link in the email. */
function appOrigin(): string {
  return typeof window !== 'undefined' ? window.location.origin : '';
}

export function classroomUrl(classroomId: string, tab?: string): string {
  const base = `${appOrigin()}/classroom/${classroomId}`;
  return tab ? `${base}?tab=${tab}` : base;
}

export async function sendEmail({ template, to, data }: SendEmailArgs): Promise<EmailResult> {
  const recipients = (to || []).filter((e) => typeof e === 'string' && e.includes('@'));
  if (recipients.length === 0) return { ok: true, sent: 0, skipped: true };

  if (!supabase) {
    // Offline / unconfigured: not an error the user needs to see.
    console.info('[email] Supabase is not configured; skipping notification email.');
    return { ok: true, skipped: true };
  }

  try {
    const { data: result, error } = await supabase.functions.invoke('send-email', {
      body: { template, to: recipients, data },
    });

    if (error) {
      // A missing function is a deployment gap, not a runtime bug — degrade quietly.
      const msg = String(error.message || error);
      if (/not found|404/i.test(msg)) {
        console.info('[email] send-email function is not deployed; skipping notification email.');
        return { ok: true, skipped: true };
      }
      console.warn('[email] send failed:', msg);
      return { ok: false, error: msg };
    }

    if (result?.error) {
      console.warn('[email] function reported:', result.error);
      return { ok: false, error: String(result.error) };
    }

    return { ok: true, sent: result?.sent ?? recipients.length };
  } catch (e: any) {
    console.warn('[email] send threw:', e);
    return { ok: false, error: e?.message || String(e) };
  }
}

/** Email addresses of the students enrolled in a class. */
export function classRecipients(classroom: any, users: any[]): string[] {
  const ids: string[] = classroom?.students || [];
  return users
    .filter((u) => ids.includes(u.id) && typeof u.email === 'string' && u.email.includes('@'))
    .map((u) => u.email);
}

/** Notify a class that an announcement was posted. Fire-and-forget by design. */
export async function notifyAnnouncement(
  classroom: any, users: any[], announcement: { authorName?: string; bodyHtml?: string }
): Promise<EmailResult> {
  const plain = String(announcement.bodyHtml || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return sendEmail({
    template: 'announcement',
    to: classRecipients(classroom, users),
    data: {
      className: classroom?.name,
      title: plain.slice(0, 70) || 'New announcement',
      authorName: announcement.authorName,
      body: plain.slice(0, 600),
      ctaUrl: classroomUrl(classroom?.id, 'stream'),
      ctaLabel: 'Open the class stream',
    },
  });
}

/** Link straight to one piece of classwork or one exam, not the class page. */
export function workUrl(classroomId: string, workId: string): string {
  return `${appOrigin()}/classroom/${classroomId}/work/${workId}`;
}
export function examUrl(classroomId: string, examId: string): string {
  return `${appOrigin()}/classroom/${classroomId}/exam/${examId}`;
}

/** Notify a class that an exam was assigned; the button opens the exam's own page. */
export async function notifyExam(
  classroom: any, users: any[],
  exam: { id: string; title: string; instructions?: string; authorName?: string; dueLabel?: string; opensLabel?: string; duration?: number; questionCount?: number }
): Promise<EmailResult> {
  const facts = [
    exam.opensLabel,
    exam.duration ? `Time limit: ${exam.duration} minutes` : '',
    exam.questionCount ? `${exam.questionCount} questions` : '',
  ].filter(Boolean).join(' · ');
  return sendEmail({
    template: 'exam',
    to: classRecipients(classroom, users),
    data: {
      className: classroom?.name,
      title: exam.title,
      authorName: exam.authorName,
      dueLabel: exam.dueLabel,
      body: [exam.instructions?.slice(0, 500), facts].filter(Boolean).join('\n\n'),
      ctaUrl: examUrl(classroom?.id, exam.id),
      ctaLabel: 'Open the exam',
    },
  });
}

/** Notify a class that new classwork was posted. */
export async function notifyAssignment(
  classroom: any, users: any[], work: { id?: string; title: string; instructions?: string; dueLabel?: string }
): Promise<EmailResult> {
  return sendEmail({
    template: 'assignment',
    to: classRecipients(classroom, users),
    data: {
      className: classroom?.name,
      title: work.title,
      body: work.instructions?.slice(0, 600),
      dueLabel: work.dueLabel,
      ctaUrl: work.id ? workUrl(classroom?.id, work.id) : classroomUrl(classroom?.id, 'classwork'),
      ctaLabel: 'View the assignment',
    },
  });
}

/** Notify a single student that their work has been graded and returned. */
export async function notifyGraded(
  classroom: any, studentEmail: string, work: { title: string; grade?: number; feedback?: string }
): Promise<EmailResult> {
  return sendEmail({
    template: 'graded',
    to: [studentEmail],
    data: {
      className: classroom?.name,
      title: work.title,
      grade: work.grade,
      body: work.feedback,
      ctaUrl: classroomUrl(classroom?.id, 'classwork'),
      ctaLabel: 'See your feedback',
    },
  });
}

/** Tell one person that someone commented on a post they care about. */
export async function notifyComment(
  classroom: any,
  recipientEmail: string,
  c: { authorName?: string; body?: string; postTitle?: string; isPrivate?: boolean; tab?: string }
): Promise<EmailResult> {
  return sendEmail({
    template: 'comment',
    to: [recipientEmail],
    data: {
      className: classroom?.name,
      title: c.postTitle,
      authorName: c.authorName,
      body: String(c.body || '').slice(0, 600),
      ctaUrl: classroomUrl(classroom?.id, c.tab),
      ctaLabel: c.isPrivate ? 'Reply privately' : 'View the comment',
    },
  });
}
