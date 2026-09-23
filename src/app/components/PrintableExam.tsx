import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { PrintExamHeaderInfo, PrintMode, PrintPaperSize } from '../types';

/**
 * Paper rendering of a saved exam.
 *
 * Written in plain semantic HTML + classNames targeted by src/styles/print.css rather than
 * MUI `sx`. Emotion's generated styles and the MUI theme's colours do not survive a print
 * dialog reliably (backgrounds are stripped, custom properties may not resolve), and a paper
 * exam wants a serif body at a point size, not the app's design system.
 *
 * SECURITY NOTE — mode='student' must not reveal the answer key ANYWHERE in the DOM, not as
 * a marker class, a data- attribute or a visually-hidden node. A student copy that carries
 * the key in the markup is a real leak the moment anyone opens devtools or saves the page.
 * The student branch below therefore never reads `correctAnswer` at all.
 */

const OMSC_BLUE = '#1d3f8f';

/**
 * Inline placeholder seal. There is no logo asset in this repository (no public/ directory
 * and no image files under src/), so referencing one would render a broken image.
 *
 * TO USE THE REAL OMSC SEAL: drop the file at `public/omsc-seal.png` and pass
 * `header.logoUrl = '/omsc-seal.png'` from the calling page — no change to this file needed.
 */
function PlaceholderSeal() {
  return (
    <svg className="omsc-seal" viewBox="0 0 100 100" role="img" aria-label="e Aspire Learning seal">
      <circle cx="50" cy="50" r="47" fill="none" stroke={OMSC_BLUE} strokeWidth="3" />
      <circle cx="50" cy="50" r="39" fill="none" stroke={OMSC_BLUE} strokeWidth="1.2" />
      <text x="50" y="45" textAnchor="middle" fontSize="19" fontWeight="bold" fill={OMSC_BLUE} fontFamily="Georgia, serif">
        e
      </text>
      <text x="50" y="60" textAnchor="middle" fontSize="7.5" fill={OMSC_BLUE} fontFamily="Georgia, serif">
        ASPIRE
      </text>
      <text x="50" y="69" textAnchor="middle" fontSize="7.5" fill={OMSC_BLUE} fontFamily="Georgia, serif">
        LEARNING
      </text>
    </svg>
  );
}

function RuledLines({ count }: { count: number }) {
  return (
    <div className="omsc-lines">
      {Array.from({ length: Math.max(1, count) }, (_, i) => (
        <div className="omsc-line" key={i} />
      ))}
    </div>
  );
}

export interface PrintableExamProps {
  exam: any;
  header: PrintExamHeaderInfo;
  paper?: PrintPaperSize;
  mode?: PrintMode;
  essayLines?: number;
  shortAnswerLines?: number;
}

/**
 * Which questions actually go on the paper.
 *
 * An exam may carry an anti-cheat pool: `activeQuestionCount` items are administered out of
 * a larger bank, with the surplus flagged `isExtra`. But fetchSavedExams drops
 * activeQuestionCount/extraQuestionCount, so on a Supabase-hydrated exam those fields are
 * usually undefined. Order of preference: explicit non-extra flag, then activeQuestionCount,
 * then everything.
 */
function selectPrintableQuestions(exam: any): any[] {
  const all: any[] = Array.isArray(exam?.questions) ? exam.questions : [];
  const nonExtra = all.filter((q) => !q?.isExtra);
  if (nonExtra.length > 0 && nonExtra.length !== all.length) return nonExtra;
  const active = Number(exam?.activeQuestionCount);
  if (Number.isFinite(active) && active > 0 && active < all.length) return all.slice(0, active);
  return all;
}

const TYPE_HEADINGS: Record<string, string> = {
  'multiple-choice': 'PART I — MULTIPLE CHOICE',
  'true-false': 'PART II — TRUE OR FALSE',
  'short-answer': 'PART III — SHORT ANSWER',
  essay: 'PART IV — ESSAY',
};

const TYPE_INSTRUCTIONS: Record<string, string> = {
  'multiple-choice': 'Write the letter of the best answer in the box provided.',
  'true-false': 'Write TRUE if the statement is correct and FALSE if it is not.',
  'short-answer': 'Answer briefly and legibly on the lines provided.',
  essay: 'Answer in complete sentences. Organisation and clarity are part of the mark.',
};

export default function PrintableExam({
  exam,
  header,
  paper = 'A4',
  mode = 'student',
  essayLines = 8,
  shortAnswerLines = 2,
}: PrintableExamProps) {
  const questions = useMemo(() => selectPrintableQuestions(exam), [exam]);

  // Group by type so the paper reads as parts, preserving each question's original number.
  const grouped = useMemo(() => {
    const order = ['multiple-choice', 'true-false', 'short-answer', 'essay'];
    const buckets = new Map<string, Array<{ q: any; number: number }>>();
    questions.forEach((q, i) => {
      const t = String(q?.type || 'multiple-choice');
      if (!buckets.has(t)) buckets.set(t, []);
      buckets.get(t)!.push({ q, number: i + 1 });
    });
    return order.filter((t) => buckets.has(t)).map((t) => ({ type: t, items: buckets.get(t)! }));
  }, [questions]);

  const totalPoints = useMemo(() => {
    const declared = Number(exam?.totalPoints);
    if (Number.isFinite(declared) && declared > 0) return declared;
    return questions.reduce((s, q) => s + (Number(q?.points) || 0), 0);
  }, [exam, questions]);

  const duration = Number(exam?.duration);
  const hasDuration = Number.isFinite(duration) && duration > 0;
  const isKey = mode === 'key';

  return (
    <div className={`omsc-print-root omsc-paper--${paper === 'Letter' ? 'letter' : 'a4'}`}>
      <div className="omsc-letterhead">
        {header.logoUrl ? (
          <img className="omsc-seal" src={header.logoUrl} alt="" />
        ) : (
          <PlaceholderSeal />
        )}
        <div className="omsc-letterhead-text">
          {/* A school's own letterhead when one is set; otherwise the platform name. */}
          {header.schoolName && <p className="omsc-republic">Republic of the Philippines</p>}
          <p className="omsc-college">{header.schoolName || 'e Aspire Learning'}</p>
          {header.subject && <p className="omsc-program">{header.subject}</p>}
        </div>
      </div>

      {isKey && <div className="omsc-key-badge">ANSWER KEY — INSTRUCTOR COPY</div>}

      <h1 className="omsc-exam-title">{exam?.title || 'Examination'}</h1>
      <p className="omsc-exam-sub">
        {totalPoints > 0 && `Total Points: ${totalPoints}`}
        {totalPoints > 0 && hasDuration && '  •  '}
        {hasDuration && `Time Allotted: ${duration} minutes`}
      </p>

      {/* Class/instructor come from context; student/date/score are blanks the student fills.
          Anything missing degrades to a ruled blank rather than printing "undefined". */}
      <div className="omsc-meta-grid">
        <div className="omsc-meta-item">
          <span className="omsc-meta-label">Class:</span>
          {header.className ? <span className="omsc-meta-value">{header.className}</span> : <span className="omsc-blank" />}
        </div>
        {header.section && (
          <div className="omsc-meta-item">
            <span className="omsc-meta-label">Section:</span>
            <span className="omsc-meta-value">{header.section}</span>
          </div>
        )}
        <div className="omsc-meta-item">
          <span className="omsc-meta-label">Instructor:</span>
          {header.instructorName ? <span className="omsc-meta-value">{header.instructorName}</span> : <span className="omsc-blank" />}
        </div>
      </div>
      <div className="omsc-meta-grid">
        <div className="omsc-meta-item" style={{ flexBasis: '55%' }}>
          <span className="omsc-meta-label">Name:</span>
          <span className="omsc-blank" />
        </div>
        <div className="omsc-meta-item">
          <span className="omsc-meta-label">Date:</span>
          <span className="omsc-blank" />
        </div>
        <div className="omsc-meta-item">
          <span className="omsc-meta-label">Score:</span>
          <span className="omsc-blank" />
        </div>
      </div>

      {exam?.description && (
        <div className="omsc-instructions">
          <p className="omsc-instructions-title">General Instructions</p>
          <div>{exam.description}</div>
        </div>
      )}

      {questions.length === 0 && <p><em>This exam has no questions.</em></p>}

      {grouped.map(({ type, items }) => (
        <section key={type}>
          <h2 className="omsc-section-heading">
            {TYPE_HEADINGS[type] || 'QUESTIONS'}
            <span style={{ fontWeight: 'normal', fontSize: '9.5pt', fontStyle: 'italic' }}>
              {'  '}— {TYPE_INSTRUCTIONS[type] || ''}
            </span>
          </h2>

          {items.map(({ q, number }) => {
            const points = Number(q?.points) || 0;
            const options: string[] = Array.isArray(q?.options) ? q.options : [];
            const correctIdx = Number(q?.correctAnswer);
            const hasValidKey = Number.isInteger(correctIdx) && correctIdx >= 0 && correctIdx < options.length;

            return (
              <div className="omsc-question" key={q?.id ?? number}>
                <div className="omsc-question-head">
                  {type === 'multiple-choice' && <span className="omsc-answer-box" />}
                  <span className="omsc-question-number">{number}.</span>
                  <span className="omsc-question-text">
                    {q?.question || '(no question text)'}
                    {points > 0 && <span className="omsc-points"> ({points} {points === 1 ? 'pt' : 'pts'})</span>}
                  </span>
                </div>

                {type === 'multiple-choice' && options.length > 0 && (
                  <ol className="omsc-options">
                    {options.map((opt, oi) => (
                      <li
                        key={oi}
                        /* Correct-option styling exists ONLY in key mode — never emitted on a student copy. */
                        className={isKey && hasValidKey && oi === correctIdx ? 'omsc-option omsc-option--correct' : 'omsc-option'}
                      >
                        <span className="omsc-option-letter">{String.fromCharCode(65 + oi)}.</span>
                        <span>{opt}</span>
                      </li>
                    ))}
                  </ol>
                )}

                {type === 'true-false' && (
                  <div className="omsc-tf-options">
                    <span>_______ TRUE</span>
                    <span>_______ FALSE</span>
                  </div>
                )}

                {type === 'short-answer' && <RuledLines count={shortAnswerLines} />}
                {type === 'essay' && <RuledLines count={essayLines} />}

                {isKey && type !== 'multiple-choice' && q?.correctAnswer !== undefined && q?.correctAnswer !== null && String(q.correctAnswer).trim() !== '' && (
                  <div className="omsc-answer-reveal">Answer: {String(q.correctAnswer)}</div>
                )}
                {isKey && type === 'multiple-choice' && hasValidKey && (
                  <div className="omsc-answer-reveal">Answer: {String.fromCharCode(65 + correctIdx)}</div>
                )}
              </div>
            );
          })}
        </section>
      ))}

      <div className="omsc-footer">
        <span>{header.className || ''}{header.section ? ` — ${header.section}` : ''}</span>
        <span>{isKey ? 'Instructor answer key — do not distribute' : 'Do not write on this page beyond the spaces provided.'}</span>
      </div>
    </div>
  );
}

/**
 * Renders `children` into a body-level portal and drives window.print().
 *
 * A dedicated portal host (rather than a print route) keeps the instructor on the page they
 * started from — no navigation, no state loss — and the host being a direct child of <body>
 * is exactly what makes the `body.omsc-printing > *` hiding rule in print.css work against
 * MUI's own portals.
 */
export function PrintPortal({ open, onFinished, children }: {
  open: boolean;
  onFinished: () => void;
  children: React.ReactNode;
}) {
  const host = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const el = document.createElement('div');
    el.className = 'omsc-print-portal';
    return el;
  }, []);

  useEffect(() => {
    if (!host || typeof document === 'undefined') return;
    document.body.appendChild(host);
    return () => {
      if (host.parentNode) host.parentNode.removeChild(host);
    };
  }, [host]);

  useEffect(() => {
    if (!open || !host || typeof window === 'undefined') return;

    document.body.classList.add('omsc-printing');

    const cleanup = () => {
      document.body.classList.remove('omsc-printing');
      onFinished();
    };
    window.addEventListener('afterprint', cleanup, { once: true });

    // Let React commit the portal's children before the (synchronous, blocking) print call.
    const timer = window.setTimeout(() => window.print(), 120);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('afterprint', cleanup);
      document.body.classList.remove('omsc-printing');
    };
    // onFinished is intentionally excluded: re-running this effect would reprint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, host]);

  if (!host || !open) return null;
  return createPortal(children, host);
}
