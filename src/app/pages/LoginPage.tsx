import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import { GOOGLE_CLIENT_ID } from '../config/authConfig';
import { sendSignInCode, verifySignInCode } from '../services/otpService';
import Landing from '../components/landing/Landing';
import {
  Container, Paper, Button, Typography, Box, Alert, Avatar, Chip, ToggleButtonGroup, ToggleButton, IconButton, Dialog, DialogContent, TextField, InputAdornment,
} from '@mui/material';
import {
  School, RecordVoiceOver, Person, AutoAwesome, Close as CloseIcon, Visibility, VisibilityOff,
} from '@mui/icons-material';

declare global {
  interface Window {
    google?: any;
  }
}

export default function LoginPage() {
  const [openLoginModal, setOpenLoginModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>('instructor');
  const [error, setError] = useState('');
  const [gsiLoaded, setGsiLoaded] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { login, loginWithGoogle, loginWithVerifiedEmail, users } = useAuth();

  // One-time email code sign-in.
  const [authMode, setAuthMode] = useState<'password' | 'code'>('password');
  const [otpStep, setOtpStep] = useState<'email' | 'code'>('email');
  const [otpCode, setOtpCode] = useState('');
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpInfo, setOtpInfo] = useState('');
  const [resendIn, setResendIn] = useState(0);
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [resendIn]);

  const handleSendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    setOtpInfo('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    setOtpBusy(true);
    const result = await sendSignInCode(email.trim());
    setOtpBusy(false);
    if (!result.ok) {
      setError(result.error || 'Could not send the code.');
      return;
    }
    setOtpStep('code');
    setOtpCode('');
    setResendIn(60);
    setOtpInfo(`We sent a 6-digit code to ${email.trim()}. It expires in 10 minutes.`);
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (otpCode.replace(/\D/g, '').length !== 6) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    setOtpBusy(true);
    const result = await verifySignInCode(email.trim(), otpCode);
    setOtpBusy(false);
    if (!result.ok) {
      setError(result.error || 'That code is not valid.');
      return;
    }
    loginWithVerifiedEmail(email.trim(), selectedRole);
    setOpenLoginModal(false);
    navigate('/dashboard');
  };

  const switchAuthMode = (mode: 'password' | 'code') => {
    setAuthMode(mode);
    setOtpStep('email');
    setOtpCode('');
    setOtpInfo('');
    setError('');
  };
  const navigate = useNavigate();

  // Google's library must be initialised exactly once per page load; calling initialize()
  // again (on every re-render or role change) is what logged the GSI "called multiple
  // times" warning and could drop the callback. The callback reads the latest role and
  // handlers through a ref, so one initialisation stays correct.
  // The server's value wins: it reflects the env var as it is NOW, while the build-time
  // value is frozen at the last deploy and goes stale when the client ID is replaced.
  // The GSI button waits for this check so it never initialises with an outdated ID.
  const [googleClientId, setGoogleClientId] = useState<string>('');
  const [googleIdChecked, setGoogleIdChecked] = useState<boolean>(false);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/public-config')
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg) => {
        if (cancelled) return;
        const runtimeId = String(cfg?.googleClientId || '').trim().replace(/^["']|["']$/g, '');
        setGoogleClientId(runtimeId || GOOGLE_CLIENT_ID);
      })
      .catch(() => { if (!cancelled) setGoogleClientId(GOOGLE_CLIENT_ID); })
      .finally(() => { if (!cancelled) setGoogleIdChecked(true); });
    return () => { cancelled = true; };
  }, []);

  const googleCallbackRef = useRef<(response: any) => void>(() => {});
  googleCallbackRef.current = (response: any) => {
    if (!response?.credential) {
      setError('Google did not return a sign-in credential. Please try again.');
      return;
    }
    if (loginWithGoogle(response.credential, selectedRole)) {
      setError('');
      setOpenLoginModal(false);
      navigate('/dashboard');
    } else {
      setError('Failed to log in with Google account. Please try again.');
    }
  };

  useEffect(() => {
    if (!googleClientId || !openLoginModal) return;

    const renderGoogleButton = (): boolean => {
      const gsi = window.google?.accounts?.id;
      const btnDiv = document.getElementById('googleGsiButtonModal');
      if (!gsi || !btnDiv) return false;
      try {
        if (!(window as any).__omscGsiInitialized) {
          gsi.initialize({
            client_id: googleClientId,
            callback: (response: any) => googleCallbackRef.current(response),
            ux_mode: 'popup',
            auto_select: false,
            cancel_on_tap_outside: true,
          });
          (window as any).__omscGsiInitialized = true;
        }
        btnDiv.innerHTML = '';
        gsi.renderButton(btnDiv, {
          theme: 'outline',
          size: 'large',
          width: 320,
          text: 'continue_with',
          shape: 'pill',
          logo_alignment: 'left',
          locale: 'en',
        });
        setGsiLoaded(true);
      } catch (e) {
        console.error('Google GSI initialization error:', e);
      }
      return true;
    };

    // The GSI script loads async and the dialog mounts after this effect, so retry briefly.
    if (renderGoogleButton()) return;
    const timer = window.setInterval(() => {
      if (renderGoogleButton()) window.clearInterval(timer);
    }, 300);
    return () => window.clearInterval(timer);
  }, [openLoginModal, googleClientId]);

  const quickLogin = (userEmail: string, userPassword: string) => {
    if (login(userEmail, userPassword)) {
      setOpenLoginModal(false);
      navigate('/dashboard');
    }
  };

  /**
   * Email + password sign-in. `login` is synchronous and returns false for both an unknown
   * email and a wrong password; the message stays deliberately vague about which, so the
   * form cannot be used to enumerate registered accounts.
   */
  const handleCredentialLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setSubmitting(true);
    const ok = login(email.trim(), password);
    setSubmitting(false);
    if (ok) {
      setPassword('');
      setOpenLoginModal(false);
      navigate('/dashboard');
    } else {
      setError('That email and password do not match an account.');
    }
  };

  const handleFallbackGoogleLogin = () => {
    setError('');
    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
    } else {
      setError('Google Sign-In service is loading. Please refresh if it does not load.');
    }
  };


  const isInstructorRole = selectedRole === 'instructor';
  const roleGradient = isInstructorRole
    ? 'linear-gradient(135deg, var(--c-emerald-600) 0%, var(--c-teal-600) 100%)'
    : 'linear-gradient(135deg, var(--c-sky-600) 0%, var(--c-teal-600) 100%)';
  const roleShadow = isInstructorRole
    ? '0 10px 25px rgba(16, 185, 129, 0.40)'
    : '0 10px 25px rgba(56, 189, 248, 0.40)';

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'var(--c-surface)', color: 'var(--c-slate-50)', overflowX: 'hidden' }}>
      <Landing
        onSignIn={() => {
          // Release focus from the landing button first: the dialog hides the page behind it
          // from screen readers, and a focused element inside hidden content is an a11y error.
          (document.activeElement as HTMLElement | null)?.blur();
          setOpenLoginModal(true);
        }}
      />

      {/* ── 8. SIGN IN POPUP DIALOG (GOOGLE SIGN-IN ONLY + QUICK DEMO) ── */}
      <Dialog
        open={openLoginModal}
        onClose={() => setOpenLoginModal(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 4,
            p: 1,
            bgcolor: 'var(--c-surface)',
            border: '1px solid var(--c-border)',
            backgroundImage: 'none',
            boxShadow: '0 25px 70px rgba(0,0,0,0.65)',
          },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1 }}>
          <IconButton size="small" onClick={() => setOpenLoginModal(false)}>
            <CloseIcon />
          </IconButton>
        </Box>

        <DialogContent sx={{ pt: 0, px: 3, pb: 3 }}>
          {/* Header */}
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Box
              sx={{
                width: 58,
                height: 58,
                borderRadius: 3.5,
                background: roleGradient,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 1.5,
                boxShadow: roleShadow,
              }}
            >
              <School sx={{ fontSize: 32, color: '#ffffff' }} />
            </Box>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 900, color: 'var(--c-ink)', letterSpacing: '-0.02em' }}>
              e Aspire Learning
            </Typography>
            <Typography variant="caption" sx={{ color: 'var(--c-ink-secondary)', fontWeight: 700, mt: 0.3, display: 'block' }}>
              AI-powered classes, exams and insight
            </Typography>
          </Box>

          {/* Role Switcher */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="caption" sx={{ fontWeight: 800, color: 'var(--c-ink-secondary)', mb: 1, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.68rem' }}>
              Select Login Role
            </Typography>
            <ToggleButtonGroup
              value={selectedRole}
              exclusive
              onChange={(_, newRole) => {
                if (newRole) setSelectedRole(newRole);
              }}
              size="small"
              sx={{
                width: '100%',
                bgcolor: 'var(--c-surface-muted)',
                p: 0.5,
                borderRadius: 3,
                border: '1px solid var(--c-border)',
                '& .MuiToggleButton-root': {
                  flex: 1,
                  py: 1.1,
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  textTransform: 'none',
                  borderRadius: '10px !important',
                  border: 'none !important',
                  color: 'var(--c-ink-secondary)',
                },
                '& .Mui-selected': {
                  background: `${roleGradient} !important`,
                  color: '#ffffff !important',
                  boxShadow: '0 3px 10px rgba(0,0,0,0.15)',
                },
              }}
            >
              <ToggleButton value="instructor">
                <RecordVoiceOver sx={{ mr: 0.8, fontSize: 16 }} /> Instructor
              </ToggleButton>
              <ToggleButton value="student">
                <Person sx={{ mr: 0.8, fontSize: 16 }} /> Student
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2, py: 0.5, borderRadius: 2, fontSize: '0.8rem', fontWeight: 600 }}>
              {error}
            </Alert>
          )}

          {/* One-time email code sign-in */}
          {authMode === 'code' && (
            <Box component="form" onSubmit={otpStep === 'email' ? handleSendCode : handleVerifyCode} sx={{ mb: 2.5 }}>
              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus={otpStep === 'email'}
                disabled={otpStep === 'code'}
                sx={{ mb: 1.5 }}
              />
              {otpStep === 'code' && (
                <>
                  {otpInfo && (
                    <Alert severity="success" sx={{ mb: 1.5, borderRadius: 2, fontSize: '0.8rem' }}>{otpInfo}</Alert>
                  )}
                  <TextField
                    label="6-digit code"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    autoComplete="one-time-code"
                    autoFocus
                    inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', maxLength: 6, style: { letterSpacing: '0.5em', fontWeight: 800, textAlign: 'center', fontSize: '1.2rem' } }}
                    sx={{ mb: 2 }}
                  />
                </>
              )}
              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={otpBusy}
                sx={{ py: 1.25, borderRadius: 3, fontWeight: 800, fontSize: '0.92rem' }}
              >
                {otpBusy
                  ? (otpStep === 'email' ? 'Sending code\u2026' : 'Checking\u2026')
                  : (otpStep === 'email' ? 'Email me a code' : 'Verify and sign in')}
              </Button>
              {otpStep === 'code' && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                  <Button size="small" onClick={() => { setOtpStep('email'); setOtpInfo(''); setError(''); }} sx={{ textTransform: 'none' }}>
                    Use a different email
                  </Button>
                  <Button size="small" disabled={resendIn > 0 || otpBusy} onClick={() => handleSendCode()} sx={{ textTransform: 'none' }}>
                    {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
                  </Button>
                </Box>
              )}
              <Button size="small" fullWidth onClick={() => switchAuthMode('password')} sx={{ mt: 1, textTransform: 'none' }}>
                Sign in with a password instead
              </Button>
            </Box>
          )}

          {/* Email + password sign-in */}
          {authMode === 'password' && (
          <Box component="form" onSubmit={handleCredentialLogin} sx={{ mb: 2.5 }}>
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
              sx={{ mb: 1.5 }}
            />
            <TextField
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              sx={{ mb: 2 }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={submitting}
              sx={{ py: 1.25, borderRadius: 3, fontWeight: 800, fontSize: '0.92rem' }}
            >
              {submitting ? 'Signing in\u2026' : 'Sign in'}
            </Button>
            <Button size="small" fullWidth onClick={() => switchAuthMode('code')} sx={{ mt: 1, textTransform: 'none' }}>
              Sign in with a one-time email code instead
            </Button>
          </Box>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
            <Box sx={{ flex: 1, height: 1, bgcolor: 'var(--c-border)' }} />
            <Typography variant="caption" sx={{ color: 'var(--c-ink-tertiary)', fontWeight: 700 }}>OR</Typography>
            <Box sx={{ flex: 1, height: 1, bgcolor: 'var(--c-border)' }} />
          </Box>

          {/* English Google Sign-In Container */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
            {!googleClientId ? (!googleIdChecked ? null : (
              <Alert severity="info" sx={{ width: '100%', borderRadius: 2, fontSize: '0.8rem', bgcolor: 'var(--c-surface-muted)', color: 'var(--c-ink)', border: '1px solid var(--c-border)', '& .MuiAlert-icon': { color: 'var(--c-primary)' } }}>
                Google Sign-In is not configured. Add <strong>GOOGLE_CLIENT_ID</strong> in Vercel → Settings → Environment Variables to enable it —
                use the demo accounts below in the meantime.
              </Alert>
            )) : (
              <>
            <div id="googleGsiButtonModal" style={{ minHeight: 44, display: 'flex', justifyContent: 'center', width: '100%' }}></div>
            {!gsiLoaded && (
              <Button
                variant="outlined"
                onClick={handleFallbackGoogleLogin}
                fullWidth
                startIcon={
                  <svg width="20" height="20" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.29v3.15C3.26 21.3 7.31 24 12 24z" />
                    <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.29C.47 8.21 0 10.05 0 12s.47 3.79 1.29 5.42l3.99-3.15z" />
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.58l3.99 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
                  </svg>
                }
                sx={{
                  py: 1.3,
                  borderRadius: 3,
                  borderColor: 'var(--c-border-strong)',
                  color: 'var(--c-ink)',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  textTransform: 'none',
                  '&:hover': { bgcolor: 'var(--c-surface-muted)', borderColor: 'var(--c-ink-tertiary)' },
                }}
              >
                Continue with Google
              </Button>
            )}
              </>
            )}
          </Box>

          {/* Quick Demo Sign-In Bar */}
          <Box sx={{ pt: 2.5, borderTop: '1px dashed var(--c-border)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: 'var(--c-ink-secondary)', display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.72rem' }}>
                <AutoAwesome sx={{ fontSize: 14, color: 'var(--c-emerald-600)' }} /> Quick Demo Sign-In
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                Click to auto-login
              </Typography>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
              {users.map((u) => {
                const isInstructorUser = u.role === 'instructor';
                return (
                  <Paper
                    key={u.id}
                    variant="outlined"
                    onClick={() => {
                      setSelectedRole(u.role);
                      quickLogin(u.email, u.password || 'instructor123');
                    }}
                    sx={{
                      p: 1,
                      borderRadius: 2.5,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.2,
                      bgcolor: 'var(--c-surface-muted)',
                      borderColor: 'var(--c-border)',
                      transition: 'all 0.15s ease',
                      '&:hover': {
                        borderColor: isInstructorUser ? 'var(--c-emerald-500)' : 'var(--c-sky-400)',
                        bgcolor: isInstructorUser ? 'var(--c-emerald-50)' : 'var(--c-sky-100)',
                        transform: 'translateY(-1px)',
                      },
                    }}
                  >
                    <Avatar
                      src={u.avatar}
                      sx={{
                        width: 28,
                        height: 28,
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        bgcolor: isInstructorUser ? 'var(--c-emerald-700)' : 'var(--c-sky-600)',
                        color: '#ffffff',
                      }}
                    >
                      {u.name.charAt(0)}
                    </Avatar>
                    <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                      <Typography variant="caption" noWrap sx={{ fontWeight: 800, color: 'var(--c-ink)', display: 'block', fontSize: '0.72rem', lineHeight: 1.1 }}>
                        {u.name.split(' ')[0]}
                      </Typography>
                      <Chip
                        label={u.role}
                        size="small"
                        sx={{
                          height: 15,
                          fontSize: '0.55rem',
                          fontWeight: 800,
                          bgcolor: isInstructorUser ? 'var(--c-emerald-100)' : 'var(--c-sky-100)',
                          color: isInstructorUser ? 'var(--c-emerald-800)' : 'var(--c-sky-800)',
                          p: 0,
                          mt: 0.2,
                        }}
                      />
                    </Box>
                  </Paper>
                );
              })}
            </Box>
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
