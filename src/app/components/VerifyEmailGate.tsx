import { useEffect, useRef, useState } from 'react';
import { Box, Paper, Typography, Button, TextField, Alert, CircularProgress } from '@mui/material';
import { MarkEmailRead } from '@mui/icons-material';
import { sendSignInCode, verifySignInCode } from '../services/otpService';
import { palette } from '../theme/tokens';

/**
 * Shown instead of the app to a new account that has not confirmed its email yet.
 * The code is emailed as soon as the screen opens; the account is marked verified by the
 * server when the right code is entered, and only then does the app open.
 */
export default function VerifyEmailGate({
  email, onVerified, onSignOut,
}: { email: string; onVerified: () => void; onSignOut: () => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const sentOnce = useRef(false);

  const send = async () => {
    setError('');
    setBusy(true);
    const r = await sendSignInCode(email);
    setBusy(false);
    if (r.ok) {
      setInfo(`We sent a 6-digit code to ${email}. It expires in 10 minutes.`);
      setResendIn(60);
    } else {
      setError(r.error || 'Could not send the code.');
      // A cooldown refusal still means a code is on its way; let them retry shortly.
      setResendIn(/wait a minute/i.test(r.error || '') ? 60 : 0);
    }
  };

  useEffect(() => {
    if (sentOnce.current) return;
    sentOnce.current = true;
    void send();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [resendIn]);

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (code.length !== 6) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    setBusy(true);
    const r = await verifySignInCode(email, code);
    setBusy(false);
    if (r.ok) onVerified();
    else setError(r.error || 'That code is not valid.');
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, bgcolor: palette.canvas }}>
      <Paper
        component="form"
        onSubmit={verify}
        elevation={0}
        sx={{ width: '100%', maxWidth: 420, p: { xs: 3, sm: 4 }, borderRadius: '18px', border: `1px solid ${palette.border}`, bgcolor: palette.surface }}
      >
        <Box sx={{ width: 52, height: 52, borderRadius: '14px', bgcolor: palette.primarySoft, color: palette.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
          <MarkEmailRead />
        </Box>
        <Typography variant="h5" sx={{ fontWeight: 900, mb: 0.75 }}>Verify your email</Typography>
        <Typography variant="body2" sx={{ color: palette.inkSecondary, mb: 2.5 }}>
          This is your first sign-in. Enter the code we emailed to <strong>{email}</strong> to finish setting up your account.
        </Typography>

        {info && !error && <Alert severity="success" sx={{ mb: 2, borderRadius: 2, fontSize: '0.82rem' }}>{info}</Alert>}
        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2, fontSize: '0.82rem' }}>{error}</Alert>}

        <TextField
          label="6-digit code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          autoComplete="one-time-code"
          autoFocus
          fullWidth
          inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', maxLength: 6, style: { letterSpacing: '0.5em', fontWeight: 800, textAlign: 'center', fontSize: '1.3rem' } }}
          sx={{ mb: 2 }}
        />
        <Button type="submit" variant="contained" fullWidth disabled={busy} sx={{ py: 1.25, borderRadius: 3, fontWeight: 800 }}
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : undefined}>
          {busy ? 'Please wait…' : 'Verify email'}
        </Button>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1.5 }}>
          <Button size="small" onClick={onSignOut} sx={{ textTransform: 'none' }}>Sign out</Button>
          <Button size="small" disabled={resendIn > 0 || busy} onClick={() => void send()} sx={{ textTransform: 'none' }}>
            {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
