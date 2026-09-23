import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import {
  AutoAwesome, Quiz, School, Insights, Login, Shield, DarkModeOutlined,
  LightModeOutlined, Bolt, Groups, Devices, ArrowForward, PlayArrowRounded, MenuBook,
  CloudUpload, CheckCircle,
} from '@mui/icons-material';
import { useThemeMode } from '../../context/ThemeModeContext';
import './landing.css';

/**
 * Aspire e Learning — public landing page.
 *
 * Visual language: a dark, glowing perspective grid floor, serif-italic accent words,
 * floating icon chips, a bento feature grid and headings that assemble word by word as they
 * scroll into view. Every colour is a token with a light and a dark value (landing.css),
 * and the page shares the app's theme toggle so the choice carries into the app.
 */

export const BRAND = 'Aspire e Learning';

/** Adds `ea-in` to any .ea-reveal / .ea-words element once it scrolls into view. */
function useReveal(root: React.RefObject<HTMLElement>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const targets = el.querySelectorAll('.ea-reveal, .ea-words, [data-ea-in]');
    if (!('IntersectionObserver' in window)) {
      targets.forEach((t) => t.classList.add('ea-in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('ea-in');
          io.unobserve(e.target);
        }
      }),
      { threshold: 0.18, rootMargin: '0px 0px -40px 0px' }
    );
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, [root]);
}

/** Splits a heading into words so each can fade in on its own delay. */
function Words({ children, as: Tag = 'h2', className = '' }: { children: ReactNode[] | ReactNode; as?: any; className?: string }) {
  let i = 0;
  const parts = Array.isArray(children) ? children : [children];
  return (
    <Tag className={`ea-words ${className}`}>
      {parts.map((part, pi) => (
        <span key={pi}>
          {pi > 0 && ' '}
          {typeof part === 'string'
            ? part.trim().split(/(\s+)/).map((w, wi) =>
                /^\s+$/.test(w) ? w : <span key={wi} className="w" style={{ '--i': i++ } as CSSProperties}>{w}</span>
              )
            : <span className="w" style={{ '--i': i++ } as CSSProperties}>{part}</span>}
        </span>
      ))}
    </Tag>
  );
}

function Floor() {
  return (
    <div className="ea-floor" aria-hidden="true">
      <div className="ea-floor-plane" />
    </div>
  );
}

const AUDIENCES = [
  { icon: <School fontSize="small" />, label: 'Universities' },
  { icon: <MenuBook fontSize="small" />, label: 'High schools' },
  { icon: <Groups fontSize="small" />, label: 'Review centers' },
  { icon: <AutoAwesome fontSize="small" />, label: 'Independent tutors' },
  { icon: <Devices fontSize="small" />, label: 'Online academies' },
  { icon: <Insights fontSize="small" />, label: 'Training teams' },
];

const FAQS = [
  { q: 'Who is Aspire e Learning for?', a: 'Any teacher, school or training team. Create a class, invite learners with a code or link, and run exams, assignments and announcements in one place.' },
  { q: 'How does the AI build an exam?', a: 'Upload your lesson files or a Table of Specifications. The AI drafts questions across the topics and cognitive levels you choose, and you review and edit every item before it is published.' },
  { q: 'Can I reuse questions I already have?', a: 'Yes. Import an existing exam file, save questions to your question bank, and pull them into new exams whenever you need them.' },
  { q: 'Is there a free plan?', a: 'Yes. The free plan covers the essentials. Paid plans add more classes and monthly exams, and you can pay with QR Ph through any bank or e-wallet app.' },
  { q: 'Is my data secure?', a: 'Accounts are verified by email, payment details never touch our servers, and secret keys live only on the server — never in your browser.' },
];

export default function Landing({ onSignIn }: { onSignIn: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const dashRef = useRef<HTMLDivElement>(null);
  const { mode, toggle } = useThemeMode();
  useReveal(rootRef);

  // Tilt the dashboard up flat as it scrolls into the middle of the screen.
  useEffect(() => {
    const el = dashRef.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const p = Math.min(1, Math.max(0, (vh - r.top) / (vh * 0.9)));
      el.style.setProperty('--tilt', `${(1 - p) * 22}deg`);
      el.style.setProperty('--scale', `${0.92 + p * 0.08}`);
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // Card spotlight follows the pointer.
  const onCardMove = (e: React.MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
  };

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="ea" data-mode={mode} ref={rootRef}>
      {/* ── Nav ── */}
      <nav className="ea-nav">
        <div className="ea-wrap ea-nav-row">
          <a className="ea-brand" href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
            <span className="ea-logo">A</span>
            {BRAND}
          </a>
          <div className="ea-links">
            <button onClick={() => scrollTo('features')}>Features</button>
            <button onClick={() => scrollTo('why')}>Why us</button>
            <button onClick={() => scrollTo('showcase')}>Dashboard</button>
            <button onClick={() => scrollTo('faq')}>FAQ</button>
          </div>
          <div className="ea-nav-actions">
            <button
              className="ea-icon-btn"
              onClick={toggle}
              aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={mode === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {mode === 'dark' ? <LightModeOutlined fontSize="small" /> : <DarkModeOutlined fontSize="small" />}
            </button>
            <button className="ea-btn ea-btn-ghost" onClick={onSignIn}>Log in</button>
            <button className="ea-btn ea-btn-primary" onClick={onSignIn}>Get started</button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <header className="ea-hero" id="top">
        <div className="ea-wrap" style={{ position: 'relative' }}>
          <span className="ea-chip" style={{ left: '6%', top: 150, '--r': '-10deg' } as CSSProperties}><Quiz /></span>
          <span className="ea-chip" style={{ right: '7%', top: 110, '--r': '9deg', animationDelay: '-2s' } as CSSProperties}><AutoAwesome /></span>
          <span className="ea-chip" style={{ right: '14%', top: 330, '--r': '-6deg', animationDelay: '-4s' } as CSSProperties}><Insights /></span>

          <div className="ea-reveal"><span className="ea-pill"><span className="ea-pill-dot" /> AI-powered teaching, for everyone</span></div>
          <Words as="h1" className="ea-h1">
            {'Teach, Test & Grow With'}
            <span className="ea-serif">Confidence</span>
          </Words>
          <p className="ea-sub ea-reveal" style={{ '--d': '300ms' } as CSSProperties}>
            Stop juggling files, spreadsheets and chat groups. {BRAND} builds exams with AI, runs your
            classes and shows you exactly how every learner is doing — in one calm, simple workspace.
          </p>
          <div className="ea-cta-row ea-reveal" style={{ '--d': '450ms' } as CSSProperties}>
            <button className="ea-btn ea-btn-primary ea-btn-lg" onClick={onSignIn}>Start for free <ArrowForward fontSize="small" /></button>
            <button className="ea-btn ea-btn-outline ea-btn-lg" onClick={() => scrollTo('showcase')}><PlayArrowRounded fontSize="small" /> See how it works</button>
          </div>
        </div>
        <Floor />
        <div className="ea-trust ea-wrap">
          <div className="ea-trust-label">Built for every kind of classroom</div>
          <div className="ea-marquee">
            <div className="ea-marquee-track">
              {[...AUDIENCES, ...AUDIENCES].map((a, i) => (
                <span className="ea-marquee-item" key={i} aria-hidden={i >= AUDIENCES.length}>{a.icon}{a.label}</span>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* ── Features (bento) ── */}
      <section className="ea-section" id="features">
        <div className="ea-wrap">
          <div className="ea-center">
            <span className="ea-eyebrow ea-reveal">Features</span>
            <Words className="ea-h2">
              {'The Toolkit Every Modern'}
              <span className="ea-serif">Educator Needs</span>
            </Words>
            <p className="ea-lead ea-reveal">
              Simple enough for your first class, powerful enough for a whole department. Everything you
              need to plan, assess and follow up is already here.
            </p>
          </div>

          <div className="ea-bento">
            <article className="ea-card ea-span-3 ea-reveal" onMouseMove={onCardMove}>
              <div className="ea-visual">
                <div className="ea-mini">
                  <div className="ea-mini-row"><span>Class average</span><span>This term</span></div>
                  <div className="ea-mini-big">86.4%</div>
                  <svg className="ea-spark" viewBox="0 0 300 80" width="100%" height="80" preserveAspectRatio="none" aria-hidden="true">
                    <defs>
                      <linearGradient id="ea-area" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="var(--ea-accent)" stopOpacity=".35" />
                        <stop offset="100%" stopColor="var(--ea-accent)" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path className="area" d="M0,62 C30,58 45,40 75,44 C105,48 120,26 150,30 C180,34 195,16 225,20 C255,24 270,8 300,10 L300,80 L0,80 Z" />
                    <path className="line" d="M0,62 C30,58 45,40 75,44 C105,48 120,26 150,30 C180,34 195,16 225,20 C255,24 270,8 300,10" />
                  </svg>
                </div>
              </div>
              <h3>Unified class dashboard</h3>
              <p>Every class, exam and submission side by side, with scores and progress updated as learners work.</p>
            </article>

            <article className="ea-card ea-span-3 ea-reveal" style={{ '--d': '120ms' } as CSSProperties} onMouseMove={onCardMove}>
              <div className="ea-visual" style={{ display: 'block' }}>
                <div className="ea-toast"><span className="ea-dot-ok" /><div><b>Maria submitted Quiz 3</b><span>Science 10 — Rizal · just now</span></div></div>
                <div className="ea-toast"><span className="ea-dot-ok" /><div><b>New comment on your post</b><span>Math 7 — Mabini · 2 min ago</span></div></div>
              </div>
              <h3>Real-time notifications</h3>
              <p>Know the moment work is turned in or a learner asks a question — in the app and by email.</p>
            </article>

            <article className="ea-card ea-span-2 ea-reveal" onMouseMove={onCardMove}>
              <div className="ea-visual"><div className="ea-orb"><AutoAwesome /></div></div>
              <h3>AI exam generator</h3>
              <p>Turn lessons or a Table of Specifications into a balanced exam in seconds, then fine-tune every item.</p>
            </article>

            <article className="ea-card ea-span-2 ea-reveal" style={{ '--d': '120ms' } as CSSProperties} onMouseMove={onCardMove}>
              <div className="ea-visual" data-ea-in>
                <div className="ea-mini">
                  <div className="ea-mini-row"><span>Question bank</span><span>1,284 items</span></div>
                  {['Photosynthesis — MCQ', 'Linear equations — Short answer', 'Philippine history — T/F'].map((t) => (
                    <div key={t} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, fontSize: '.76rem', color: 'var(--ea-ink-2)' }}>
                      <CheckCircle sx={{ fontSize: 14, color: 'var(--ea-accent)' }} /> {t}
                    </div>
                  ))}
                </div>
              </div>
              <h3>Reusable question bank</h3>
              <p>Import old exams, save great questions and build new tests from them in a few clicks.</p>
            </article>

            <article className="ea-card ea-span-2 ea-reveal" style={{ '--d': '240ms' } as CSSProperties} onMouseMove={onCardMove}>
              <div className="ea-visual"><div className="ea-orb"><Shield /></div></div>
              <h3>Secure by design</h3>
              <p>Email-verified accounts, server-side keys and payments handled by PayMongo — never by the browser.</p>
            </article>
          </div>
        </div>
      </section>

      {/* ── Why us ── */}
      <section className="ea-section ea-section-alt" id="why">
        <div className="ea-wrap">
          <span className="ea-eyebrow ea-reveal">Benefits</span>
          <Words className="ea-h2">
            {'Why'}
            <span className="ea-serif">Educators</span>
            {'Choose Us'}
          </Words>
          <p className="ea-lead ea-reveal">
            We built one workspace that replaces a stack of tools — so your time goes to teaching, not to
            copying scores between apps.
          </p>
          <div className="ea-pillars">
            {[
              { icon: <Bolt />, t: 'Classes without friction', d: 'Create a class, share a code or link, and learners are in. No setup days, no training sessions.' },
              { icon: <CloudUpload />, t: 'Exams that write themselves', d: 'Upload what you already teach. The AI drafts, you approve, and the exam is ready to assign.' },
              { icon: <Insights />, t: 'Insight without spreadsheets', d: 'Item analysis, averages and missing work appear automatically — no formulas, no exports.' },
            ].map((p, i) => (
              <div className="ea-pillar ea-reveal" key={p.t} style={{ '--d': `${i * 120}ms` } as CSSProperties}>
                <div className="ea-pillar-ico">{p.icon}</div>
                <h4>{p.t}</h4>
                <p>{p.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Dashboard showcase ── */}
      <section className="ea-section" id="showcase">
        <div className="ea-wrap">
          <div className="ea-center">
            <span className="ea-eyebrow ea-reveal">How it works</span>
            <Words className="ea-h2">
              {'See Every Class'}
              <span className="ea-serif">Like Never Before</span>
            </Words>
            <p className="ea-lead ea-reveal">
              Scores, submissions and progress in one view. Spot who needs help before the grading period ends.
            </p>
          </div>
          <div className="ea-stage">
            <div className="ea-dash" ref={dashRef} data-ea-in>
              <div className="ea-dash-top"><i /><i /><i /><span style={{ marginLeft: 10, fontSize: '.75rem', color: 'var(--ea-ink-3)' }}>{BRAND} — Dashboard</span></div>
              <div className="ea-dash-body">
                <div className="ea-dash-side">
                  <div className="on">Overview</div><div>Classes</div><div>Exam generator</div><div>Question bank</div><div>Notifications</div>
                </div>
                <div>
                  <div className="ea-stats">
                    <div className="ea-stat"><small>Active learners</small><strong>1,248</strong><em>+12% this month</em></div>
                    <div className="ea-stat"><small>Exams this term</small><strong>36</strong><em>+8 new</em></div>
                    <div className="ea-stat"><small>Average score</small><strong>84.7%</strong><em>+3.1 pts</em></div>
                  </div>
                  <div className="ea-bars" aria-hidden="true">
                    {[42, 58, 50, 72, 64, 80, 70, 88, 76, 92, 84, 96].map((h, i) => (
                      <span key={i} style={{ height: `${h}%`, transitionDelay: `${i * 60}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Roles ── */}
      <section className="ea-section ea-section-alt">
        <div className="ea-wrap ea-center">
          <div className="ea-orbit">
            {[
              { l: 'T', c: '#0ea5c6', s: { left: '8%', top: 10 } },
              { l: 'S', c: '#6366f1', s: { left: '18%', top: 120, animationDelay: '-2s' } },
              { l: 'A', c: '#22c55e', s: { right: '10%', top: 20, animationDelay: '-3s' } },
              { l: 'P', c: '#f59e0b', s: { right: '20%', top: 130, animationDelay: '-1s' } },
            ].map((a) => (
              <span key={a.l + a.c} className="ea-avatar" style={{ background: a.c, ...a.s } as CSSProperties} aria-hidden="true">{a.l}</span>
            ))}
            <Words className="ea-h2">
              {'Made for'}
              <span className="ea-serif">Teachers</span>
              {'and'}
              <span className="ea-serif">Learners</span>
              {'Alike'}
            </Words>
            <p className="ea-lead ea-reveal">Each role gets a workspace built for what they actually do every day.</p>
          </div>
          <div className="ea-quotes" style={{ textAlign: 'left' }}>
            {[
              { l: 'T', c: '#0ea5c6', who: 'For teachers', role: 'Plan, assess, follow up', text: 'Generate an exam from your lesson, assign it to a class, and watch results come in — with item analysis done for you.' },
              { l: 'S', c: '#6366f1', who: 'For learners', role: 'Know what is next', text: 'One to-do list for every class: what is assigned, what is missing and what is done, plus reviewers to study from.' },
              { l: 'A', c: '#22c55e', who: 'For schools', role: 'One place for everyone', text: 'Bring every section onto one platform with plans that grow with you, from a single tutor to a full department.' },
            ].map((q, i) => (
              <figure className="ea-quote ea-reveal" key={q.who} style={{ margin: 0, '--d': `${i * 120}ms` } as CSSProperties}>
                <p>{q.text}</p>
                <footer>
                  <span className="ea-avatar" style={{ background: q.c }}>{q.l}</span>
                  <div><b>{q.who}</b><span>{q.role}</span></div>
                </footer>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="ea-section" id="faq">
        <div className="ea-wrap">
          <div className="ea-center">
            <span className="ea-eyebrow ea-reveal">FAQ</span>
            <Words className="ea-h2">
              {'Questions,'}
              <span className="ea-serif">Answered</span>
            </Words>
          </div>
          <div className="ea-faq">
            {FAQS.map((f, i) => (
              <details key={f.q} className="ea-reveal" style={{ '--d': `${i * 60}ms` } as CSSProperties}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="ea-final">
        <div className="ea-wrap">
          <Words className="ea-h2">
            {'Start Teaching'}
            <span className="ea-serif">Smarter</span>
            {'Today'}
          </Words>
          <p className="ea-lead ea-reveal" style={{ margin: '0 auto' }}>
            Join educators who spend less time on paperwork and more time on learners. Free to start — no card needed.
          </p>
          <div className="ea-cta-row ea-reveal">
            <button className="ea-btn ea-btn-primary ea-btn-lg" onClick={onSignIn}>Start for free <ArrowForward fontSize="small" /></button>
            <button className="ea-btn ea-btn-outline ea-btn-lg" onClick={onSignIn}><Login fontSize="small" /> Log in</button>
          </div>
        </div>
        <Floor />
      </section>

      {/* ── Footer ── */}
      <footer className="ea-footer">
        <div className="ea-wrap">
          <div className="ea-foot-grid">
            <div>
              <div className="ea-brand" style={{ marginBottom: 12 }}><span className="ea-logo">A</span>{BRAND}</div>
              <p style={{ margin: 0, color: 'var(--ea-ink-2)', fontSize: '.86rem', lineHeight: 1.6, maxWidth: 300 }}>
                AI-powered exams, classes and insight for every educator.
              </p>
            </div>
            <div>
              <h5>Product</h5>
              <button onClick={() => scrollTo('features')}>Features</button>
              <button onClick={() => scrollTo('showcase')}>Dashboard</button>
              <button onClick={onSignIn}>Pricing</button>
            </div>
            <div>
              <h5>Company</h5>
              <button onClick={() => scrollTo('why')}>Why us</button>
              <button onClick={() => scrollTo('faq')}>FAQ</button>
            </div>
            <div>
              <h5>Account</h5>
              <button onClick={onSignIn}>Log in</button>
              <button onClick={onSignIn}>Create account</button>
            </div>
          </div>
          <div className="ea-foot-bottom">
            <span>&copy; {new Date().getFullYear()} {BRAND}. All rights reserved.</span>
            <span>Made in the Philippines</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
