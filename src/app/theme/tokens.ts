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

export const palette = {
  // Canvas and surfaces
  canvas: '#f6f6f8',
  surface: '#ffffff',
  surfaceMuted: '#fafafb',
  surfaceSunken: '#f2f2f5',

  // Hairlines
  border: '#e8e8ed',
  borderStrong: '#dcdce3',

  // Ink
  ink: '#16161d',
  inkSecondary: '#5c5c6b',
  inkTertiary: '#8e8e9e',
  inkDisabled: '#b4b4c0',

  // Brand / action
  primary: '#059669',
  primaryHover: '#047857',
  primarySoft: '#ecfdf5',
  primaryBorder: '#a7f3d0',

  // Role accents
  instructor: '#047857',
  instructorSoft: '#ecfdf5',
  student: '#0284c7',
  studentSoft: '#e0f2fe',

  // Status
  success: '#15803d',
  successSoft: '#dcfce7',
  warning: '#b45309',
  warningSoft: '#fef3c7',
  danger: '#b91c1c',
  dangerSoft: '#fee2e2',
  info: '#0369a1',
  infoSoft: '#e0f2fe',
} as const;

/**
 * Pastel gradients for folder/class cards, matching the reference's soft tinted tiles.
 * Indexed deterministically by entity id so a class keeps its colour between renders.
 */
export const cardTints = [
  { from: '#d1fae5', to: '#ecfdf5', ink: '#065f46' }, // lavender
  { from: '#d1fae5', to: '#ecfdf5', ink: '#065f46' }, // blue
  { from: '#ffedd5', to: '#fff7ed', ink: '#9a3412' }, // peach
  { from: '#dcfce7', to: '#f0fdf4', ink: '#166534' }, // mint
  { from: '#fce7f3', to: '#fdf2f8', ink: '#9d174d' }, // rose
  { from: '#cffafe', to: '#ecfeff', ink: '#155e75' }, // cyan
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
  xs: '0 1px 2px rgba(22, 22, 29, 0.04)',
  sm: '0 1px 3px rgba(22, 22, 29, 0.06), 0 1px 2px rgba(22, 22, 29, 0.04)',
  md: '0 4px 12px rgba(22, 22, 29, 0.06)',
  lg: '0 12px 28px rgba(22, 22, 29, 0.10)',
  focus: `0 0 0 3px ${palette.primary}22`,
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
