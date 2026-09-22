import { createTheme } from '@mui/material/styles';
import { palette, muiPalette, gradient, radius, shadow, layout, font } from './tokens';

/**
 * The application theme.
 *
 * This is the fix for "align all the input boxes": every form control's height, radius,
 * padding, label placement and focus ring is defined ONCE here as a component default,
 * instead of being re-specified with a different `sx` at each of the hundreds of call sites.
 * A TextField, a Select, an Autocomplete and a date input now render at exactly the same
 * height ({@link layout.controlHeight}px), so they line up when placed in a row.
 *
 * Conventions:
 * - `size="small"` everywhere is unnecessary — the default size IS the compact size.
 * - Controls default to `fullWidth` so a grid cell governs the width, not the control.
 * - Labels are shrunk-by-default outlined labels; no floating-label jump.
 */
export function createAppTheme(mode: 'light' | 'dark') {
  const mui = muiPalette(mode);
  // In dark mode the brand greens are light (they have to be, to read on navy), so text
  // sitting ON the brand must be near-black rather than white — otherwise every contained
  // button and `color="secondary"` chip is white-on-mint.
  const onBrand = mode === 'dark' ? '#04211a' : '#ffffff';
  return createTheme({
  palette: {
    mode,
    primary: { main: mui.primary, dark: mui.primaryHover, light: mui.primaryHover, contrastText: onBrand },
    secondary: { main: mui.instructor, light: mui.primarySoft, contrastText: onBrand },
    success: { main: mui.success, light: mui.successSoft },
    warning: { main: mui.warning, light: mui.warningSoft },
    error: { main: mui.danger, light: mui.dangerSoft },
    info: { main: mui.info, light: mui.infoSoft },
    background: { default: mui.canvas, paper: mui.surface },
    text: { primary: mui.ink, secondary: mui.inkSecondary, disabled: mui.inkDisabled },
    divider: mui.border,
  },

  shape: { borderRadius: radius.md },

  typography: {
    fontFamily: font.sans,
    h1: { fontSize: '1.9rem', fontWeight: 800, letterSpacing: '-0.02em' },
    h2: { fontSize: '1.55rem', fontWeight: 800, letterSpacing: '-0.02em' },
    h3: { fontSize: '1.3rem', fontWeight: 800, letterSpacing: '-0.015em' },
    h4: { fontSize: '1.15rem', fontWeight: 700, letterSpacing: '-0.01em' },
    h5: { fontSize: '1rem', fontWeight: 700 },
    h6: { fontSize: '0.95rem', fontWeight: 700 },
    subtitle1: { fontSize: '0.92rem', fontWeight: 600 },
    subtitle2: { fontSize: '0.82rem', fontWeight: 700 },
    body1: { fontSize: '0.92rem' },
    body2: { fontSize: '0.85rem' },
    caption: { fontSize: '0.75rem' },
    button: { fontWeight: 700, textTransform: 'none', letterSpacing: 0 },
  },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: palette.canvas,
          color: palette.ink,
          // No page-level horizontal scroll, ever. Wide content scrolls in its own container.
          overflowX: 'hidden',
        },
        '*::-webkit-scrollbar': { width: 10, height: 10 },
        '*::-webkit-scrollbar-thumb': {
          backgroundColor: palette.borderStrong,
          borderRadius: radius.pill,
          border: '3px solid transparent',
          backgroundClip: 'content-box',
        },
        '*::-webkit-scrollbar-track': { background: 'transparent' },
      },
    },

    // ── Form controls: one height, one radius, one focus ring ──
    MuiTextField: {
      defaultProps: { fullWidth: true, variant: 'outlined', size: 'small' },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: radius.md,
          backgroundColor: palette.surface,
          minHeight: layout.controlHeight,
          transition: 'box-shadow .15s ease, border-color .15s ease',
          '& fieldset': { borderColor: palette.border },
          '&:hover fieldset': { borderColor: palette.borderStrong },
          '&.Mui-focused fieldset': { borderColor: palette.primary, borderWidth: 1 },
          '&.Mui-focused': { boxShadow: shadow.focus },
          // A multiline field grows, so it must not be pinned to the single-line height.
          '&.MuiInputBase-multiline': { minHeight: 'unset', paddingTop: 10, paddingBottom: 10 },
        },
        input: {
          // Consistent optical padding; combined with minHeight this is what makes a
          // TextField, a Select and a Button in the same row share a baseline.
          padding: '10px 12px',
          fontSize: '0.88rem',
          '&::placeholder': { color: palette.inkTertiary, opacity: 1 },
        },
        notchedOutline: { borderColor: palette.border },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: { fontSize: '0.85rem', color: palette.inkSecondary, '&.Mui-focused': { color: palette.primary } },
      },
    },
    MuiFormHelperText: {
      styleOverrides: { root: { marginLeft: 2, marginTop: 5, fontSize: '0.73rem', color: palette.inkTertiary } },
    },
    MuiSelect: {
      defaultProps: { size: 'small' },
      styleOverrides: { select: { minHeight: 'unset !important', display: 'flex', alignItems: 'center' } },
    },
    MuiAutocomplete: {
      styleOverrides: {
        inputRoot: { paddingTop: '3px !important', paddingBottom: '3px !important' },
      },
    },
    MuiMenuItem: {
      styleOverrides: { root: { fontSize: '0.87rem', borderRadius: radius.sm, margin: '2px 6px' } },
    },
    MuiMenu: {
      styleOverrides: {
        paper: { borderRadius: radius.lg, border: `1px solid ${palette.border}`, boxShadow: shadow.lg, marginTop: 4 },
        list: { padding: 6 },
      },
    },

    // ── Buttons: match the control height so rows align ──
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: radius.md, minHeight: layout.controlHeight, padding: '8px 16px', fontSize: '0.87rem' },
        sizeSmall: { minHeight: layout.controlHeightSmall, padding: '4px 12px', fontSize: '0.8rem' },
        sizeLarge: { minHeight: 48, padding: '12px 22px', fontSize: '0.92rem' },
        contained: { boxShadow: 'none', '&:hover': { boxShadow: shadow.sm } },
        containedPrimary: {
          background: gradient.brand,
          color: onBrand,
          '&:hover': { background: gradient.brand, filter: 'brightness(1.06)', boxShadow: shadow.md },
          '&.Mui-disabled': { background: palette.surfaceSunken, color: palette.inkDisabled },
        },
        outlined: {
          borderColor: palette.border,
          color: palette.ink,
          backgroundColor: palette.surface,
          '&:hover': { borderColor: palette.borderStrong, backgroundColor: palette.surfaceMuted },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: { root: { borderRadius: radius.sm } },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          borderRadius: radius.md,
          borderColor: palette.border,
          minHeight: layout.controlHeightSmall,
          padding: '4px 12px',
          fontSize: '0.8rem',
          fontWeight: 700,
          textTransform: 'none',
          color: palette.inkSecondary,
          '&.Mui-selected': { backgroundColor: palette.primarySoft, color: palette.primary },
        },
      },
    },

    // ── Surfaces ──
    MuiPaper: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { backgroundImage: 'none' },
        rounded: { borderRadius: radius.lg },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: radius.lg,
          border: `1px solid ${palette.border}`,
          boxShadow: shadow.xs,
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            insetInline: 0,
            top: 0,
            height: 2,
            background: gradient.brand,
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: radius.xl, border: `1px solid ${palette.border}`, boxShadow: shadow.lg },
      },
    },
    MuiDialogTitle: {
      styleOverrides: { root: { fontSize: '1.05rem', fontWeight: 800, padding: '20px 24px 12px' } },
    },
    MuiDialogContent: { styleOverrides: { root: { padding: '8px 24px' } } },
    MuiDialogActions: { styleOverrides: { root: { padding: '16px 24px 20px', gap: 8 } } },

    MuiChip: {
      styleOverrides: {
        root: { borderRadius: radius.pill, fontWeight: 600, fontSize: '0.75rem' },
        sizeSmall: { height: 22, fontSize: '0.7rem' },
        outlined: { borderColor: palette.border },
      },
    },
    MuiDivider: { styleOverrides: { root: { borderColor: palette.border } } },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { backgroundColor: palette.ink, fontSize: '0.75rem', borderRadius: radius.sm, padding: '6px 10px' },
      },
    },
    MuiAlert: {
      styleOverrides: { root: { borderRadius: radius.lg, fontSize: '0.85rem', alignItems: 'flex-start' } },
    },

    // ── Tabs ──
    MuiTabs: {
      defaultProps: { variant: 'scrollable', scrollButtons: 'auto', allowScrollButtonsMobile: true },
      styleOverrides: {
        root: { minHeight: 44 },
        indicator: { height: 2, borderRadius: 2, background: gradient.brand },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 44,
          minWidth: 'auto',
          padding: '8px 14px',
          fontSize: '0.85rem',
          fontWeight: 600,
          textTransform: 'none',
          color: palette.inkSecondary,
          '&.Mui-selected': { color: palette.ink, fontWeight: 700 },
        },
      },
    },

    // ── Tables ──
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: palette.border, fontSize: '0.85rem', padding: '12px 14px' },
        head: { fontWeight: 700, color: palette.inkSecondary, backgroundColor: palette.surfaceMuted },
      },
    },

    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: radius.md,
          position: 'relative',
          '&.Mui-selected': {
            backgroundColor: palette.primarySoft,
            color: palette.primaryHover,
            '&:hover': { backgroundColor: palette.primarySoft },
            '&::after': {
              content: '""',
              position: 'absolute',
              right: 0,
              top: 6,
              bottom: 6,
              width: 3,
              borderRadius: 3,
              background: gradient.brand,
            },
          },
        },
      },
    },
    MuiListItemIcon: { styleOverrides: { root: { minWidth: 34, color: palette.inkSecondary } } },
    MuiAvatar: { styleOverrides: { root: { fontSize: '0.8rem', fontWeight: 700 } } },
    MuiLinearProgress: {
      styleOverrides: { root: { borderRadius: radius.pill, backgroundColor: palette.surfaceSunken, height: 8 } },
    },
  },
  });
}

/** Default instance, kept for modules that import the theme directly. */
export const theme = createAppTheme('light');

export default theme;
export * from './tokens';
export * from './colorPairs';
