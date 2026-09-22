/**
 * Design tokens.
 *
 * Single source of truth for colour, radius, shadow and spacing across the app. Pages should
 * read from here (or from the MUI theme built on top of it) rather than hard-coding hex
 * values.
 *
 * The palette is a dark "console" scheme: a deep navy canvas, slightly lifted navy surfaces,
 * hairline borders that read as a subtle lift rather than a line, and an emerald→cyan
 * gradient reserved for brand moments (headings, primary actions, card accent strips).
 */

export const palette = {
  // Canvas and surfaces
  canvas: '#0b1120',
  surface: '#131b2e',
  surfaceMuted: '#18223a',
  surfaceSunken: '#1c2740',

  // Hairlines
  border: '#25304a',
  borderStrong: '#33415c',

  // Ink
  ink: '#e8edf7',
  inkSecondary: '#a3b0c7',
  inkTertiary: '#7482a0',
  inkDisabled: '#55627d',

  // Brand / action
  primary: '#10b981',
  primaryHover: '#34d399',
  primarySoft: 'rgba(16, 185, 129, 0.13)',
  primaryBorder: 'rgba(16, 185, 129, 0.38)',

  // Role accents
  instructor: '#34d399',
  instructorSoft: 'rgba(52, 211, 153, 0.13)',
  student: '#38bdf8',
  studentSoft: 'rgba(56, 189, 248, 0.13)',

  // Status
  success: '#4ade80',
  successSoft: 'rgba(74, 222, 128, 0.13)',
  warning: '#fbbf24',
  warningSoft: 'rgba(251, 191, 36, 0.13)',
  danger: '#f87171',
  dangerSoft: 'rgba(248, 113, 113, 0.13)',
  info: '#38bdf8',
  infoSoft: 'rgba(56, 189, 248, 0.13)',
} as const;

/**
 * The brand gradient. Used for the wordmark, page titles, primary buttons and the accent
 * strip along the top of a card — the handful of places that carry brand, never as a
 * background for text the user has to read at length.
 */
export const gradient = {
  brand: `linear-gradient(90deg, ${palette.primary} 0%, #22d3ee 100%)`,
  brandDiagonal: `linear-gradient(135deg, ${palette.primary} 0%, #22d3ee 100%)`,
  /** Full-bleed glow behind the landing hero. */
  heroGlow:
    'radial-gradient(900px 480px at 15% -10%, rgba(16, 185, 129, 0.20), transparent 60%),' +
    'radial-gradient(760px 420px at 88% 8%, rgba(34, 211, 238, 0.16), transparent 62%)',
} as const;

/**
 * Tinted gradients for folder/class cards. Indexed deterministically by entity id so a
 * class keeps its colour between renders.
 */
export const cardTints = [
  { from: 'rgba(16, 185, 129, 0.16)', to: 'rgba(16, 185, 129, 0.04)', ink: '#6ee7b7' },
  { from: 'rgba(34, 211, 238, 0.16)', to: 'rgba(34, 211, 238, 0.04)', ink: '#67e8f9' },
  { from: 'rgba(251, 191, 36, 0.14)', to: 'rgba(251, 191, 36, 0.04)', ink: '#fcd34d' },
  { from: 'rgba(74, 222, 128, 0.15)', to: 'rgba(74, 222, 128, 0.04)', ink: '#86efac' },
  { from: 'rgba(244, 114, 182, 0.14)', to: 'rgba(244, 114, 182, 0.04)', ink: '#f9a8d4' },
  { from: 'rgba(56, 189, 248, 0.15)', to: 'rgba(56, 189, 248, 0.04)', ink: '#7dd3fc' },
] as const;

/** Stable tint for an entity, so a card does not change colour on re-render. */
export function tintFor(id: string | undefined | null) {
  if (!id) return cardTints[0];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return cardTints[hash % cardTints.length];
}

export const radius = {
  sm: 8,
  md: 10,
  lg: 14,
  xl: 18,
  pill: 999,
} as const;

/**
 * On a dark canvas a drop shadow is nearly invisible, so depth comes from the border and a
 * faint inner highlight. The shadows stay for focus rings and floating surfaces (menus,
 * dialogs) where a real cast shadow still separates layers.
 */
export const shadow = {
  none: 'none',
  xs: '0 1px 2px rgba(0, 0, 0, 0.30)',
  sm: '0 1px 3px rgba(0, 0, 0, 0.36), 0 1px 2px rgba(0, 0, 0, 0.24)',
  md: '0 4px 14px rgba(0, 0, 0, 0.40)',
  lg: '0 18px 40px rgba(0, 0, 0, 0.55)',
  focus: `0 0 0 3px ${palette.primarySoft}`,
  /** The soft coloured halo under a gradient button. */
  brandGlow: '0 6px 20px rgba(16, 185, 129, 0.30)',
} as const;

/** Fixed measurements the shell and pages agree on. */
export const layout = {
  sidebarWidth: 248,
  sidebarCollapsedWidth: 72,
  topBarHeight: 64,
  contentMaxWidth: 1440,
  /** Every form control is this tall, which is what makes rows of inputs line up. */
  controlHeight: 42,
  controlHeightSmall: 34,
} as const;

export const font = {
  sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  /** Entity titles are set in a mono face; used for card/section titles. */
  mono: "'JetBrains Mono', 'SF Mono', ui-monospace, 'Cascadia Mono', Menlo, Consolas, monospace",
} as const;
