import { useCallback, useRef, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button, Box,
} from '@mui/material';
import { WarningAmberRounded, InfoOutlined } from '@mui/icons-material';
import { palette } from '../theme/tokens';

export interface ConfirmOptions {
  title: string;
  message: string;
  /** Label on the accepting button. Defaults to "Confirm". */
  confirmLabel?: string;
  cancelLabel?: string;
  /** 'danger' colours the action red and shows a warning mark — use it for deletions. */
  tone?: 'danger' | 'default';
}

/**
 * In-app replacement for window.confirm().
 *
 * The native dialog is attributed to the deployment host — "capstone-git-main-…vercel.app
 * says" — which reads to a user as a browser security warning rather than as part of the
 * app, and it cannot be styled or themed. It also blocks the main thread, so nothing behind
 * it can repaint.
 *
 * Usage:
 *   const { confirm, ConfirmHost } = useConfirm();
 *   if (await confirm({ title: 'Delete template?', message: '…', tone: 'danger' })) { … }
 *   ...and render {ConfirmHost} once in the page.
 */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  // The promise's resolver is kept in a ref so re-renders while the dialog is open (a
  // parent list refreshing, say) cannot drop the pending answer on the floor.
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = useCallback((result: boolean) => {
    resolver.current?.(result);
    resolver.current = null;
    setOptions(null);
  }, []);

  const isDanger = options?.tone === 'danger';

  const ConfirmHost = (
    <Dialog
      open={Boolean(options)}
      // A backdrop click or Escape is a cancel, matching the native dialog's behaviour.
      onClose={() => settle(false)}
      maxWidth="xs"
      fullWidth
      aria-labelledby="confirm-dialog-title"
    >
      <DialogTitle id="confirm-dialog-title" sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Box
          sx={{
            width: 32, height: 32, borderRadius: '9px', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            bgcolor: isDanger ? palette.dangerSoft : palette.primarySoft,
            color: isDanger ? palette.danger : palette.primary,
          }}
        >
          {isDanger ? <WarningAmberRounded fontSize="small" /> : <InfoOutlined fontSize="small" />}
        </Box>
        {options?.title}
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ color: palette.inkSecondary, fontSize: '0.88rem' }}>
          {options?.message}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => settle(false)} sx={{ color: palette.inkSecondary }}>
          {options?.cancelLabel || 'Cancel'}
        </Button>
        <Button
          onClick={() => settle(true)}
          variant="contained"
          color={isDanger ? 'error' : 'primary'}
          autoFocus
        >
          {options?.confirmLabel || 'Confirm'}
        </Button>
      </DialogActions>
    </Dialog>
  );

  return { confirm, ConfirmHost };
}
