import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import {
  Dialog, DialogContent, Box, Typography, TextField, Button, Alert, CircularProgress, IconButton, InputAdornment,
} from '@mui/material';
import { Lock, Close, Visibility, VisibilityOff } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { hasPassword, checkAccountPassword, sendSignInCode, verifySignInCode } from '../services/otpService';
import { palette } from '../theme/tokens';

/**
 * "Confirm it's you" before a sensitive action — editing the profile, deleting from the
 * question bank, printing / copying / downloading an exam.
 *
 * Accounts with a password type it; accounts without one (Google-only) get a one-time code
 * by email. Both are checked on the server. A success is remembered for a few minutes so a
 * burst of edits does not prompt every time.
 */

const GRACE_MS = 5 * 60 * 1000;

type Pending = { reason: string; resolve: (ok: boolean) => void };
const ReauthContext = createContext<(reason: string) => Promise<boolean>>(async () => false);

export const useReauth = () => useContext(ReauthContext);

export function ReauthProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  const lastOk = useRef<{ email: string; at: number } | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [mode, setMode] = useState<'loading' | 'password' | 'code'>('loading');
  const [value, setValue] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const email = currentUser?.email?.toLowerCase() || '';

  const sendCode = useCallback(async (addr: string) => {
    setBusy(true);
    const r = await sendSignInCode(addr, 'reauth');
    setBusy(false);
    if (r.ok) setInfo(`We emailed a 6-digit code to ${addr}.`);
    else setError(r.error || 'Could not send the code.');
  }, []);

  const requireReauth = useCallback((reason: string) => {
    if (!email) return Promise.resolve(false);
    if (lastOk.current && lastOk.current.email === email && Date.now() - lastOk.current.at < GRACE_MS) {
      return Promise.resolve(true);
    }
    return new Promise<boolean>((resolve) => {
      setPending({ reason, resolve });
      setValue(''); setError(''); setInfo(''); setMode('loading');
      hasPassword(email).then((has) => {
        setMode(has ? 'password' : 'code');
        if (!has) void sendCode(email);
      });
    });
  }, [email, sendCode]);

  const finish = (ok: boolean) => {
    if (ok) lastOk.current = { email, at: Date.now() };
    pending?.resolve(ok);
    setPending(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!value) return;
    setBusy(true);
    const r = mode === 'password'
      ? await checkAccountPassword(email, value)
      : await verifySignInCode(email, value);
    setBusy(false);
    if (r.ok) finish(true);
    else setError(r.error || (mode === 'password' ? 'Wrong password.' : 'That code is not valid.'));
  };

  return (
    <ReauthContext.Provider value={requireReauth}>
      {children}
      <Dialog open={Boolean(pending)} onClose={() => finish(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: '20px', bgcolor: palette.surface, backgroundImage: 'radial-gradient(120% 60% at 50% -10%, var(--glow-a), transparent 60%)', border: `1px solid ${palette.borderStrong}` } }}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1 }}>
          <IconButton size="small" onClick={() => finish(false)} aria-label="Cancel"><Close /></IconButton>
        </Box>
        <DialogContent sx={{ pt: 0, px: 3, pb: 3 }}>
          <Box component="form" onSubmit={submit}>
            <Box sx={{ width: 48, height: 48, borderRadius: '14px', bgcolor: palette.primarySoft, color: palette.primary, display: 'grid', placeItems: 'center', mb: 2 }}>
              <Lock />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>Confirm it’s you</Typography>
            <Typography variant="body2" sx={{ color: palette.inkSecondary, mt: 0.5, mb: 2 }}>
              {pending?.reason} {mode === 'password' ? 'Enter your password to continue.' : mode === 'code' ? 'Enter the code we emailed you.' : ''}
            </Typography>

            {info && !error && <Alert severity="success" sx={{ mb: 2, borderRadius: 2, fontSize: '0.8rem' }}>{info}</Alert>}
            {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2, fontSize: '0.8rem' }}>{error}</Alert>}

            {mode === 'loading' ? (
              <Box sx={{ py: 2, textAlign: 'center' }}><CircularProgress size={22} /></Box>
            ) : mode === 'password' ? (
              <TextField
                fullWidth autoFocus label="Password" type={show ? 'text' : 'password'} value={value}
                onChange={(e) => setValue(e.target.value)} autoComplete="current-password" sx={{ mb: 2 }}
                InputProps={{ endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'}>
                      {show ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ) }}
              />
            ) : (
              <TextField
                fullWidth autoFocus label="6-digit code" value={value} autoComplete="one-time-code"
                onChange={(e) => setValue(e.target.value.replace(/\D/g, '').slice(0, 6))} sx={{ mb: 2 }}
                inputProps={{ inputMode: 'numeric', style: { letterSpacing: '0.5em', fontWeight: 800, textAlign: 'center', fontSize: '1.2rem' } }}
              />
            )}

            <Button type="submit" variant="contained" fullWidth disabled={busy || mode === 'loading' || !value}
              startIcon={busy ? <CircularProgress size={16} color="inherit" /> : undefined} sx={{ py: 1.1, fontWeight: 800 }}>
              Confirm
            </Button>
            {mode === 'code' && (
              <Button size="small" fullWidth disabled={busy} onClick={() => { setError(''); void sendCode(email); }} sx={{ mt: 1, textTransform: 'none' }}>
                Send a new code
              </Button>
            )}
          </Box>
        </DialogContent>
      </Dialog>
    </ReauthContext.Provider>
  );
}
