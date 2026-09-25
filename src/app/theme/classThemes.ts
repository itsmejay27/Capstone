/**
 * Classroom banner themes. Each is a gradient plus a soft glow, in the landing page's style.
 * White text sits on every one of them, so all are dark enough in both app themes.
 */
export interface ClassTheme { id: string; name: string; background: string; swatch: string; /** Solid Google-Classroom-style colour for cards and the class banner. */ flat: string }

export const CLASS_THEMES: ClassTheme[] = [
  { id: 'aurora', flat: '#0b8ea8',   name: 'Aurora',   swatch: '#0ea5c6', background: 'radial-gradient(90% 120% at 90% -10%, rgba(56,189,248,.55), transparent 60%), linear-gradient(135deg, #062a3f 0%, #0b1a2e 55%, #05070c 100%)' },
  { id: 'ocean', flat: '#1967d2',    name: 'Ocean',    swatch: '#2563eb', background: 'radial-gradient(90% 120% at 10% -10%, rgba(96,165,250,.55), transparent 60%), linear-gradient(135deg, #0c1f4d 0%, #0a1733 60%, #060b18 100%)' },
  { id: 'forest', flat: '#1e8e3e',   name: 'Forest',   swatch: '#10b981', background: 'radial-gradient(90% 120% at 85% -10%, rgba(52,211,153,.45), transparent 60%), linear-gradient(135deg, #053b2e 0%, #072a22 60%, #04110e 100%)' },
  { id: 'sunset', flat: '#e8710a',   name: 'Sunset',   swatch: '#f97316', background: 'radial-gradient(90% 120% at 90% -10%, rgba(251,146,60,.55), transparent 60%), linear-gradient(135deg, #4a1d0b 0%, #2b1320 60%, #120812 100%)' },
  { id: 'grape', flat: '#8e24aa',    name: 'Grape',    swatch: '#8b5cf6', background: 'radial-gradient(90% 120% at 15% -10%, rgba(167,139,250,.5), transparent 60%), linear-gradient(135deg, #2a1552 0%, #1a1036 60%, #0b0716 100%)' },
  { id: 'rose', flat: '#d01884',     name: 'Rose',     swatch: '#ec4899', background: 'radial-gradient(90% 120% at 85% -10%, rgba(244,114,182,.5), transparent 60%), linear-gradient(135deg, #4a0f2e 0%, #2a0c1f 60%, #10050c 100%)' },
  { id: 'gold', flat: '#c26401',     name: 'Gold',     swatch: '#eab308', background: 'radial-gradient(90% 120% at 90% -10%, rgba(250,204,21,.45), transparent 60%), linear-gradient(135deg, #3f2f05 0%, #241b06 60%, #0d0a03 100%)' },
  { id: 'graphite', flat: '#455a64', name: 'Graphite', swatch: '#64748b', background: 'radial-gradient(90% 120% at 50% -20%, rgba(148,163,184,.35), transparent 60%), linear-gradient(135deg, #1e293b 0%, #111827 60%, #05070c 100%)' },
];

/** A class theme id may end in ":glow" for the gradient banner; the colour is the same. */
export const classThemeFor = (id?: string) => CLASS_THEMES.find((t) => t.id === String(id || '').split(':')[0]) || CLASS_THEMES[0];
export const isGlowTheme = (id?: string) => String(id || '').endsWith(':glow');

/** The faint grid laid over every banner, echoing the landing page floor. */
export const BANNER_GRID =
  'linear-gradient(to right, rgba(255,255,255,.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.06) 1px, transparent 1px)';
