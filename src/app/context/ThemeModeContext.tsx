import {
  createContext, useContext, useEffect, useMemo, useRef, useState, ReactNode, useCallback,
} from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { createAppTheme, buildThemeStylesheet } from '../theme';

/** What the user picked. 'system' follows the OS setting and keeps following it. */
export type ThemePreference = 'light' | 'dark' | 'system';
/** What is actually on screen once 'system' has been resolved. */
export type ResolvedMode = 'light' | 'dark';

const STORAGE_KEY = 'themePreference';
const STYLE_ELEMENT_ID = 'omsc-theme-vars';
const TRANSITION_CLASS = 'theme-transition';
/** Must match the duration in the transition rule, plus a little slack. */
const TRANSITION_MS = 380;

interface ThemeModeContextValue {
  /** The user's choice, including 'system'. */
  preference: ThemePreference;
  /** The mode currently rendered — never 'system'. */
  mode: ResolvedMode;
  setPreference: (p: ThemePreference) => void;
  /** Flips between light and dark, leaving 'system' behind. */
  toggle: () => void;
}

const ThemeModeContext = createContext<ThemeModeContextValue | undefined>(undefined);

export function useThemeMode() {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) throw new Error('useThemeMode must be used within ThemeModeProvider');
  return ctx;
}

function readStoredPreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    /* private mode / blocked storage — fall through to the default */
  }
  return 'system';
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Owns the light/dark theme.
 *
 * Colour lives in CSS custom properties (see `theme/colorPairs.ts`), so switching themes is
 * a single `data-theme` attribute change on <html> — no component re-renders to repaint the
 * several hundred inline colours the pages carry. The MUI theme is still rebuilt per mode,
 * because MUI computes hover and disabled states with real colour maths that a `var()`
 * string cannot satisfy.
 */
export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  const mode: ResolvedMode =
    preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;

  // Inject the variable definitions once. They are static, so this never re-runs.
  useEffect(() => {
    if (document.getElementById(STYLE_ELEMENT_ID)) return;
    const el = document.createElement('style');
    el.id = STYLE_ELEMENT_ID;
    el.textContent = buildThemeStylesheet();
    document.head.appendChild(el);
  }, []);

  // Keep following the OS while the preference is 'system'.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  // The attribute is what actually swaps the palette. The transition class is added just
  // for the swap and taken off again, so the cross-fade never applies to ordinary hovers
  // or route changes. It is skipped on the very first paint — there is nothing to fade
  // from, and fading in from the wrong theme is exactly the flash we are avoiding.
  const firstPaint = useRef(true);
  useEffect(() => {
    const root = document.documentElement;
    if (firstPaint.current) {
      firstPaint.current = false;
      root.setAttribute('data-theme', mode);
      return;
    }
    root.classList.add(TRANSITION_CLASS);
    root.setAttribute('data-theme', mode);
    const timer = window.setTimeout(() => root.classList.remove(TRANSITION_CLASS), TRANSITION_MS);
    return () => {
      window.clearTimeout(timer);
      root.classList.remove(TRANSITION_CLASS);
    };
  }, [mode]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* preference simply will not persist */
    }
  }, []);

  const toggle = useCallback(
    () => setPreference(mode === 'dark' ? 'light' : 'dark'),
    [mode, setPreference]
  );

  const muiTheme = useMemo(() => createAppTheme(mode), [mode]);
  const value = useMemo(
    () => ({ preference, mode, setPreference, toggle }),
    [preference, mode, setPreference, toggle]
  );

  return (
    <ThemeModeContext.Provider value={value}>
      <ThemeProvider theme={muiTheme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}
