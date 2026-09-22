/**
 * Every colour the pages use, paired light ↔ dark.
 *
 * The pages were written against a light slate palette with several hundred inline hex
 * literals. Rather than maintain two copies of every page, each distinct literal becomes a
 * CSS custom property with a value per theme, and the pages reference `var(--c-…)`. Flipping
 * `data-theme` on <html> then re-themes the whole app with no React re-render and no
 * per-component conditional.
 *
 * `name` is the custom-property suffix; `light` is the original literal the sweep replaced,
 * which is what makes the mapping auditable — you can still grep a page for the var and see
 * which colour it used to be.
 */
export interface ColorPair {
  name: string;
  light: string;
  dark: string;
}

export const COLOR_PAIRS: ColorPair[] = [
  // ── Slate scale, inverted for dark ──
  { name: 'slate-50', light: '#f8fafc', dark: '#0f1626' },
  { name: 'gray-50', light: '#f9fafb', dark: '#0f1626' },
  { name: 'slate-100', light: '#f1f5f9', dark: '#1a2338' },
  { name: 'gray-100', light: '#f3f4f6', dark: '#1a2338' },
  { name: 'slate-200', light: '#e2e8f0', dark: '#25304a' },
  { name: 'gray-200', light: '#e5e7eb', dark: '#25304a' },
  { name: 'slate-300', light: '#cbd5e1', dark: '#33415c' },
  { name: 'gray-300', light: '#d1d5db', dark: '#33415c' },
  { name: 'slate-400', light: '#94a3b8', dark: '#7482a0' },
  { name: 'gray-400', light: '#9ca3af', dark: '#7482a0' },
  { name: 'slate-500', light: '#64748b', dark: '#a3b0c7' },
  { name: 'gray-500', light: '#6b7280', dark: '#a3b0c7' },
  { name: 'slate-600', light: '#475569', dark: '#c3cddf' },
  { name: 'gray-600', light: '#4b5563', dark: '#c3cddf' },
  { name: 'slate-700', light: '#334155', dark: '#dbe3f0' },
  { name: 'gray-700', light: '#374151', dark: '#dbe3f0' },
  { name: 'slate-800', light: '#1e293b', dark: '#e8edf7' },
  { name: 'gray-800', light: '#1f2937', dark: '#e8edf7' },
  { name: 'slate-900', light: '#0f172a', dark: '#e8edf7' },
  { name: 'gray-900', light: '#111827', dark: '#e8edf7' },

  // ── Emerald / green ──
  { name: 'emerald-600', light: '#059669', dark: '#10b981' },
  { name: 'emerald-700', light: '#047857', dark: '#34d399' },
  { name: 'emerald-800', light: '#065f46', dark: '#6ee7b7' },
  { name: 'emerald-900', light: '#064e3b', dark: '#a7f3d0' },
  { name: 'green-800', light: '#166534', dark: '#86efac' },
  { name: 'green-700', light: '#15803d', dark: '#4ade80' },
  { name: 'green-600', light: '#16a34a', dark: '#4ade80' },
  { name: 'emerald-50', light: '#ecfdf5', dark: 'rgba(16, 185, 129, 0.13)' },
  { name: 'emerald-100', light: '#d1fae5', dark: 'rgba(16, 185, 129, 0.18)' },
  { name: 'green-100', light: '#dcfce7', dark: 'rgba(74, 222, 128, 0.16)' },
  { name: 'green-50', light: '#f0fdf4', dark: 'rgba(74, 222, 128, 0.09)' },
  { name: 'emerald-200', light: '#a7f3d0', dark: 'rgba(16, 185, 129, 0.38)' },
  { name: 'green-300', light: '#86efac', dark: 'rgba(74, 222, 128, 0.45)' },
  { name: 'green-200', light: '#bbf7d0', dark: 'rgba(74, 222, 128, 0.35)' },
  { name: 'emerald-400', light: '#34d399', dark: '#6ee7b7' },
  { name: 'emerald-300', light: '#6ee7b7', dark: '#a7f3d0' },
  { name: 'emerald-500', light: '#10b981', dark: '#34d399' },

  // ── Red / danger ──
  { name: 'red-600', light: '#dc2626', dark: '#f87171' },
  { name: 'red-700', light: '#b91c1c', dark: '#f87171' },
  { name: 'red-800', light: '#991b1b', dark: '#fca5a5' },
  { name: 'red-900', light: '#7f1d1d', dark: '#fecaca' },
  { name: 'red-100', light: '#fee2e2', dark: 'rgba(248, 113, 113, 0.14)' },
  { name: 'red-50', light: '#fef2f2', dark: 'rgba(248, 113, 113, 0.08)' },
  { name: 'red-300', light: '#fca5a5', dark: 'rgba(248, 113, 113, 0.42)' },
  { name: 'red-200', light: '#fecaca', dark: 'rgba(248, 113, 113, 0.30)' },
  { name: 'rose-500', light: '#f43f5e', dark: '#fb7185' },

  // ── Amber / warning ──
  { name: 'amber-700', light: '#b45309', dark: '#fbbf24' },
  { name: 'amber-600', light: '#d97706', dark: '#fbbf24' },
  { name: 'amber-800', light: '#92400e', dark: '#fcd34d' },
  { name: 'amber-900', light: '#78350f', dark: '#fde68a' },
  { name: 'amber-100', light: '#fef3c7', dark: 'rgba(251, 191, 36, 0.14)' },
  { name: 'amber-50', light: '#fffbeb', dark: 'rgba(251, 191, 36, 0.08)' },
  { name: 'amber-200', light: '#fde68a', dark: 'rgba(251, 191, 36, 0.38)' },
  { name: 'amber-300', light: '#fcd34d', dark: 'rgba(251, 191, 36, 0.48)' },
  { name: 'amber-500', light: '#f59e0b', dark: '#fbbf24' },
  { name: 'orange-400', light: '#fb923c', dark: '#fdba74' },
  { name: 'orange-800', light: '#9a3412', dark: '#fdba74' },
  { name: 'orange-100', light: '#ffedd5', dark: 'rgba(251, 146, 60, 0.14)' },
  { name: 'orange-50', light: '#fff7ed', dark: 'rgba(251, 146, 60, 0.08)' },

  // ── Sky / info ──
  { name: 'sky-700', light: '#0369a1', dark: '#38bdf8' },
  { name: 'sky-600', light: '#0284c7', dark: '#38bdf8' },
  { name: 'sky-800', light: '#075985', dark: '#7dd3fc' },
  { name: 'sky-900', light: '#0c4a6e', dark: '#bae6fd' },
  { name: 'sky-500', light: '#0ea5e9', dark: '#38bdf8' },
  { name: 'sky-400', light: '#38bdf8', dark: '#7dd3fc' },
  { name: 'sky-100', light: '#e0f2fe', dark: 'rgba(56, 189, 248, 0.14)' },
  { name: 'sky-50', light: '#f0f9ff', dark: 'rgba(56, 189, 248, 0.08)' },
  { name: 'sky-200', light: '#bae6fd', dark: 'rgba(56, 189, 248, 0.38)' },
  { name: 'sky-300', light: '#7dd3fc', dark: 'rgba(56, 189, 248, 0.48)' },
  { name: 'blue-900', light: '#1e3a8a', dark: '#bfdbfe' },
  { name: 'blue-800', light: '#1e40af', dark: '#93c5fd' },
  { name: 'blue-600', light: '#2563eb', dark: '#60a5fa' },
  { name: 'blue-100', light: '#dbeafe', dark: 'rgba(96, 165, 250, 0.16)' },
  { name: 'blue-50', light: '#eff6ff', dark: 'rgba(96, 165, 250, 0.08)' },

  // ── Teal / cyan accent ──
  { name: 'teal-600', light: '#0d9488', dark: '#2dd4bf' },
  { name: 'teal-700', light: '#0f766e', dark: '#5eead4' },
  { name: 'teal-100', light: '#ccfbf1', dark: 'rgba(45, 212, 191, 0.16)' },
  { name: 'cyan-800', light: '#155e75', dark: '#67e8f9' },
  { name: 'cyan-100', light: '#cffafe', dark: 'rgba(34, 211, 238, 0.14)' },
  { name: 'cyan-50', light: '#ecfeff', dark: 'rgba(34, 211, 238, 0.08)' },

  // ── Violet / pink leftovers from the retired brand ──
  { name: 'purple-900', light: '#581c87', dark: '#a5f3fc' },
  { name: 'purple-800', light: '#6b21a8', dark: '#67e8f9' },
  { name: 'purple-600', light: '#7b1fa2', dark: '#22d3ee' },
  { name: 'purple-500', light: '#9c27b0', dark: '#22d3ee' },
  { name: 'purple-50', light: '#faf5ff', dark: 'rgba(34, 211, 238, 0.08)' },
  { name: 'purple-100', light: '#f3e8ff', dark: 'rgba(34, 211, 238, 0.14)' },
  { name: 'pink-100', light: '#fce7f3', dark: 'rgba(244, 114, 182, 0.14)' },
  { name: 'pink-50', light: '#fdf2f8', dark: 'rgba(244, 114, 182, 0.08)' },
  { name: 'pink-800', light: '#9d174d', dark: '#f9a8d4' },

  // ── Panels that stay dark in both themes (white text sits on them) ──
  { name: 'banner-from', light: '#1e293b', dark: '#18243c' },
  { name: 'banner-to', light: '#0f172a', dark: '#0d1526' },
  { name: 'banner-ink', light: '#ffffff', dark: '#e8edf7' },
  { name: 'banner-ink-dim', light: '#c3cddf', dark: '#a3b0c7' },

  // ── Neutral surfaces the token palette is built from ──
  { name: 'canvas', light: '#eceef3', dark: '#0b1120' },
  { name: 'surface', light: '#ffffff', dark: '#131b2e' },
  { name: 'surface-muted', light: '#f6f7fa', dark: '#18223a' },
  { name: 'surface-sunken', light: '#e4e7ee', dark: '#1c2740' },
  { name: 'border', light: '#d5d9e2', dark: '#25304a' },
  { name: 'border-strong', light: '#bcc2d0', dark: '#33415c' },
  { name: 'ink', light: '#16161d', dark: '#e8edf7' },
  { name: 'ink-secondary', light: '#5c5c6b', dark: '#a3b0c7' },
  { name: 'ink-tertiary', light: '#7a7a8c', dark: '#7482a0' },
  { name: 'ink-disabled', light: '#b4b4c0', dark: '#55627d' },
];

/** `--c-slate-200` etc. */
export const varName = (name: string) => `--c-${name}`;
/** `var(--c-slate-200)` — what the pages reference. */
export const cssVar = (name: string) => `var(${varName(name)})`;

/**
 * Depth is not colour, so elevation gets its own pair: on a light canvas a short, soft
 * shadow reads as a lift, while on a dark one the same shadow is invisible and has to be
 * both darker and longer.
 */
const EFFECTS_LIGHT = `  --shadow-xs: 0 1px 2px rgba(22, 22, 29, 0.07);
  --shadow-sm: 0 1px 3px rgba(22, 22, 29, 0.10), 0 1px 2px rgba(22, 22, 29, 0.06);
  --shadow-md: 0 6px 16px rgba(22, 22, 29, 0.10);
  --shadow-lg: 0 16px 34px rgba(22, 22, 29, 0.16);
  --shadow-focus-ring: rgba(5, 150, 105, 0.22);
  --glow-a: rgba(5, 150, 105, 0.10);
  --glow-b: rgba(13, 148, 136, 0.09);`;

const EFFECTS_DARK = `  --shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.30);
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.36), 0 1px 2px rgba(0, 0, 0, 0.24);
  --shadow-md: 0 4px 14px rgba(0, 0, 0, 0.40);
  --shadow-lg: 0 18px 40px rgba(0, 0, 0, 0.55);
  --shadow-focus-ring: rgba(16, 185, 129, 0.30);
  --glow-a: rgba(16, 185, 129, 0.20);
  --glow-b: rgba(34, 211, 238, 0.16);`;

/**
 * Cross-fade between themes.
 *
 * Deliberately gated behind a class the provider adds only for the duration of a switch:
 * a permanent global transition would also animate every hover, focus and route change,
 * which makes the whole app feel laggy. Only the colour properties are transitioned —
 * animating `all` would drag layout properties into the compositor and cause visible jank.
 *
 * Honours prefers-reduced-motion, where an instant swap is the correct behaviour.
 */
const THEME_TRANSITION = `.theme-transition, .theme-transition *, .theme-transition *::before, .theme-transition *::after {
  transition: background-color 320ms ease, background-image 320ms ease, border-color 320ms ease,
    color 320ms ease, fill 320ms ease, stroke 320ms ease, box-shadow 320ms ease !important;
}

@media (prefers-reduced-motion: reduce) {
  .theme-transition, .theme-transition *, .theme-transition *::before, .theme-transition *::after {
    transition: none !important;
  }
}
`;

/** The stylesheet text defining both themes. Injected once at startup. */
export function buildThemeStylesheet(): string {
  const light = COLOR_PAIRS.map((p) => `  ${varName(p.name)}: ${p.light};`).join('\n');
  const dark = COLOR_PAIRS.map((p) => `  ${varName(p.name)}: ${p.dark};`).join('\n');
  return (
    `:root {\n  color-scheme: light;\n${light}\n${EFFECTS_LIGHT}\n}\n\n` +
    `:root[data-theme='dark'] {\n  color-scheme: dark;\n${dark}\n${EFFECTS_DARK}\n}\n\n` +
    THEME_TRANSITION
  );
}

/** Hex lookups for the two MUI palettes, which need real colours, not var() strings. */
export const lightHex: Record<string, string> = Object.fromEntries(
  COLOR_PAIRS.map((p) => [p.name, p.light])
);
export const darkHex: Record<string, string> = Object.fromEntries(
  COLOR_PAIRS.map((p) => [p.name, p.dark])
);
