import { cssVar, lightHex, darkHex } from './colorPairs';

/**
 * Design tokens.
 *
 * Single source of truth for colour, radius, shadow and spacing across the app. Pages should
 * read from here (or from the MUI theme built on top of it) rather than hard-coding hex
 * values — the existing pages are full of one-off '#059669' / '#e2e8f0' literals, which is
 * why nothing lines up.
 *
 * The palette is a light, low-chroma "workspace" scheme: near-white canvas, white surfaces,
 * hairline borders, and colour reserved for meaning (state, role, action) rather than
 * decoration.
 */

/**
 * The palette every `sx` block reads. Each entry is a CSS custom property, so switching
 * `data-theme` on <html> re-themes the app without React re-rendering a single component.
 * MUI itself needs real colours for its alpha/darken maths, so {@link muiPalette} below
 * resolves the same names to hex per mode.
 */
export const palette = {
  canvas: cssVar('canvas'),
  surface: cssVar('surface'),
  surfaceMuted: cssVar('surface-muted'),
  surfaceSunken: cssVar('surface-sunken'),

  border: cssVar('border'),
  borderStrong: cssVar('border-strong'),

  ink: cssVar('ink'),
  inkSecondary: cssVar('ink-secondary'),
  inkTertiary: cssVar('ink-tertiary'),
  inkDisabled: cssVar('ink-disabled'),

  primary: cssVar('emerald-600'),
  primaryHover: cssVar('emerald-700'),
  primarySoft: cssVar('emerald-50'),
  primaryBorder: cssVar('emerald-200'),

  instructor: cssVar('emerald-700'),
  instructorSoft: cssVar('emerald-50'),
  student: cssVar('sky-600'),
  studentSoft: cssVar('sky-100'),

  success: cssVar('green-700'),
  successSoft: cssVar('green-100'),
  warning: cssVar('amber-700'),
  warningSoft: cssVar('amber-100'),
  danger: cssVar('red-700'),
  dangerSoft: cssVar('red-100'),
  info: cssVar('sky-700'),
  infoSoft: cssVar('sky-100'),
} as const;

/** The same names resolved to real hex, for the MUI theme factory. */
export function muiPalette(mode: 'light' | 'dark') {
  const h = mode === 'dark' ? darkHex : lightHex;
  return {
    canvas: h['canvas'], surface: h['surface'], surfaceMuted: h['surface-muted'],
    surfaceSunken: h['surface-sunken'], border: h['border'], borderStrong: h['border-strong'],
    ink: h['ink'], inkSecondary: h['ink-secondary'], inkTertiary: h['ink-tertiary'],
    inkDisabled: h['ink-disabled'],
    primary: h['emerald-600'], primaryHover: h['emerald-700'],
    primarySoft: h['emerald-50'], primaryBorder: h['emerald-200'],
    instructor: h['emerald-700'], student: h['sky-600'],
    success: h['green-700'], successSoft: h['green-100'],
    warning: h['amber-700'], warningSoft: h['amber-100'],
    danger: h['red-700'], dangerSoft: h['red-100'],
    info: h['sky-700'], infoSoft: h['sky-100'],
  };
}

/**
 * The brand gradient, used for the wordmark, page titles, primary buttons and the accent
 * strip along the top of a card — the handful of places that carry brand, never as a
 * background for text the user has to read at length.
 *
 * On a light canvas the stops are held at emerald 600 / teal 600 rather than the brighter
 * 500s, so white text on a gradient button still clears the contrast floor.
 */
export const gradient = {
  brand: `linear-gradient(90deg, ${palette.primary} 0%, ${cssVar('teal-600')} 100%)`,
  brandDiagonal: `linear-gradient(135deg, ${palette.primary} 0%, ${cssVar('teal-600')} 100%)`,
  /** Full-bleed tint behind the landing hero. */
  heroGlow:
    'radial-gradient(900px 480px at 15% -10%, var(--glow-a), transparent 60%),' +
    'radial-gradient(760px 420px at 88% 8%, var(--glow-b), transparent 62%)',
} as const;

/**
 * Pastel gradients for folder/class cards, matching the reference's soft tinted tiles.
 * Indexed deterministically by entity id so a class keeps its colour between renders.
 */
export const cardTints = [
  { from: cssVar('emerald-100'), to: cssVar('emerald-50'), ink: cssVar('emerald-800') },
  { from: cssVar('sky-100'), to: cssVar('sky-50'), ink: cssVar('sky-800') },
  { from: cssVar('orange-100'), to: cssVar('orange-50'), ink: cssVar('orange-800') },
  { from: cssVar('green-100'), to: cssVar('green-50'), ink: cssVar('green-800') },
  { from: cssVar('pink-100'), to: cssVar('pink-50'), ink: cssVar('pink-800') },
  { from: cssVar('cyan-100'), to: cssVar('cyan-50'), ink: cssVar('cyan-800') },
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
 * Soft, short shadows. The reference has almost no elevation — depth comes from hairline
 * borders, not drop shadows, so these stay deliberately subtle.
 */
export const shadow = {
  none: 'none',
  xs: 'var(--shadow-xs)',
  sm: 'var(--shadow-sm)',
  md: 'var(--shadow-md)',
  lg: 'var(--shadow-lg)',
  focus: '0 0 0 3px var(--shadow-focus-ring)',
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
  /** The reference sets entity titles in a mono face; used for card/section titles. */
  mono: "'JetBrains Mono', 'SF Mono', ui-monospace, 'Cascadia Mono', Menlo, Consolas, monospace",
} as const;
