import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

/**
 * MUI-native responsive helpers.
 *
 * Deliberately NOT reusing src/app/components/ui/use-mobile.ts: that hook belongs to the
 * shadcn/Tailwind island, is keyed to Tailwind's 768px `md` (which does not line up with
 * MUI's md = 900 that every `sx` object in this app is written against), and it initialises
 * its state to `undefined` so it reports "not mobile" on the very first paint.
 *
 * `noSsr: true` makes useMediaQuery evaluate the media query during the first render instead
 * of after a mount effect, so layouts do not flash their desktop variant on a phone.
 */

/** True below MUI's `md` breakpoint (<900px) — phones and portrait tablets. */
export function useIsMobile(): boolean {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.down('md'), { noSsr: true });
}

/** True below MUI's `sm` breakpoint (<600px) — phones only. Use for the tightest reflows. */
export function useIsNarrow(): boolean {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true });
}
