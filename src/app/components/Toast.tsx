import { useCallback, useState } from 'react';
import { Alert, Snackbar } from '@mui/material';

type Severity = 'success' | 'error' | 'warning' | 'info';

/**
 * In-app replacement for window.alert().
 *
 * alert() halts the page, renders as an unstyled browser chrome dialog attributed to
 * "capstone-…vercel.app says", and cannot be dismissed by anything but a click, so it
 * reads as a browser warning rather than as part of the app.
 *
 * Usage:
 *   const { toast, ToastHost } = useToast();
 *   toast('Saved to the repository.');            // success by default
 *   toast('Title is required.', 'error');
 *   ...and render {ToastHost} once in the page.
 */
export function useToast() {
  const [state, setState] = useState<{ open: boolean; message: string; severity: Severity }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const toast = useCallback((message: string, severity: Severity = 'success') => {
    setState({ open: true, message, severity });
  }, []);

  const close = useCallback(() => setState((s) => ({ ...s, open: false })), []);

  const ToastHost = (
    <Snackbar
      open={state.open}
      // Errors stay until dismissed; confirmations get out of the way on their own.
      autoHideDuration={state.severity === 'error' ? null : 4000}
      onClose={close}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert
        onClose={close}
        severity={state.severity}
        variant="filled"
        sx={{ borderRadius: 2.5, fontWeight: 600, alignItems: 'center', maxWidth: 520 }}
      >
        {state.message}
      </Alert>
    </Snackbar>
  );

  return { toast, ToastHost };
}
