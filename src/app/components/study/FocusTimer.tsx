import { useEffect, useRef, useState } from 'react';
import { Box, Paper, Typography, Button, TextField, MenuItem, ToggleButtonGroup, ToggleButton } from '@mui/material';
import { PlayArrow, Pause, RestartAlt, SkipNext, MenuBook } from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { logStudySession, type useStudyItems } from '../../services/studyStore';

/**
 * Pomodoro: focus blocks with short breaks (a long one every fourth), tied to a reviewer
 * module. Each finished focus block is logged as study time for the streak and progress.
 */
const PRESETS = { classic: [25, 5, 15], short: [15, 3, 10], long: [50, 10, 20] } as const;

export default function FocusTimer({ store }: { store: ReturnType<typeof useStudyItems> }) {
  const { reviewers } = useAuth();
  const [preset, setPreset] = useState<keyof typeof PRESETS>('classic');
  const [phase, setPhase] = useState<'focus' | 'break'>('focus');
  const [completed, setCompleted] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(PRESETS.classic[0] * 60);
  const [running, setRunning] = useState(false);
  const [target, setTarget] = useState('');
  const [focus, brk, longBrk] = PRESETS[preset];
  const total = (phase === 'focus' ? focus : completed % 4 === 0 && completed > 0 ? longBrk : brk) * 60;
  const endAt = useRef<number | null>(null);

  const moduleOptions = (reviewers as any[]).flatMap((r) => (r.modules || []).map((m: any) => ({ id: `${r.id}::${m.id}`, label: `${r.title} — ${m.title}` })));
  const targetLabel = moduleOptions.find((o) => o.id === target)?.label || 'General study';

  useEffect(() => { if (!running) { setSecondsLeft(total); } }, [preset]); // eslint-disable-line

  useEffect(() => {
    if (!running) { endAt.current = null; return; }
    endAt.current = Date.now() + secondsLeft * 1000;
    const t = window.setInterval(() => {
      const left = Math.max(0, Math.round(((endAt.current || 0) - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left === 0) finishPhase();
    }, 250);
    return () => window.clearInterval(t);
  }, [running]); // eslint-disable-line

  const finishPhase = () => {
    setRunning(false);
    try { new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=').play().catch(() => {}); } catch { /* */ }
    if (phase === 'focus') {
      logStudySession(store.save, focus, `Focus: ${targetLabel}`);
      const n = completed + 1; setCompleted(n);
      setPhase('break'); setSecondsLeft((n % 4 === 0 ? longBrk : brk) * 60);
      if ('Notification' in window && Notification.permission === 'granted') new Notification('Focus block done — take a break.');
    } else {
      setPhase('focus'); setSecondsLeft(focus * 60);
      if ('Notification' in window && Notification.permission === 'granted') new Notification('Break over — back to focus.');
    }
  };

  useEffect(() => {
    document.title = running ? `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')} · ${phase === 'focus' ? 'Focus' : 'Break'}` : 'Aspire e Learning';
    return () => { document.title = 'Aspire e Learning — AI-Powered Teaching Platform'; };
  }, [secondsLeft, running, phase]);

  const pct = 1 - secondsLeft / total;
  const R = 110, C = 2 * Math.PI * R;

  return (
    <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, alignItems: 'start' }}>
      <Paper sx={{ p: 3, borderRadius: '20px', textAlign: 'center', backgroundImage: 'radial-gradient(80% 60% at 50% 0%, var(--glow-a), transparent 70%)' }}>
        <Typography variant="overline" sx={{ fontWeight: 800, color: phase === 'focus' ? 'var(--c-emerald-600)' : 'var(--c-green-700)' }}>
          {phase === 'focus' ? 'Focus' : 'Break'} · block {completed + (phase === 'focus' ? 1 : 0)}
        </Typography>
        <Box sx={{ position: 'relative', width: 260, height: 260, mx: 'auto', my: 1 }}>
          <svg width="260" height="260" viewBox="0 0 260 260" aria-hidden>
            <circle cx="130" cy="130" r={R} fill="none" stroke="var(--c-border)" strokeWidth="12" />
            <circle cx="130" cy="130" r={R} fill="none" stroke={phase === 'focus' ? 'var(--c-emerald-500)' : 'var(--c-green-600)'} strokeWidth="12" strokeLinecap="round"
              strokeDasharray={C} strokeDashoffset={C * (1 - pct)} transform="rotate(-90 130 130)" style={{ transition: 'stroke-dashoffset .3s linear' }} />
          </svg>
          <Typography sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3.2rem', fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>
            {String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:{String(secondsLeft % 60).padStart(2, '0')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
          <Button variant="contained" size="large" startIcon={running ? <Pause /> : <PlayArrow />}
            onClick={() => { if (!running && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission(); setRunning((r) => !r); }}>
            {running ? 'Pause' : 'Start'}
          </Button>
          <Button startIcon={<RestartAlt />} onClick={() => { setRunning(false); setSecondsLeft(total); }}>Reset</Button>
          <Button startIcon={<SkipNext />} onClick={finishPhase}>Skip</Button>
        </Box>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: '16px' }}>
        <Typography sx={{ fontWeight: 800, mb: 1.5 }}>Session</Typography>
        <ToggleButtonGroup exclusive size="small" value={preset} disabled={running} onChange={(_, v) => v && setPreset(v)} sx={{ mb: 2 }}>
          <ToggleButton value="short">15 / 3</ToggleButton>
          <ToggleButton value="classic">25 / 5</ToggleButton>
          <ToggleButton value="long">50 / 10</ToggleButton>
        </ToggleButtonGroup>
        <TextField select fullWidth size="small" label="Reviewer module to focus on" value={target} onChange={(e) => setTarget(e.target.value)} sx={{ mb: 1.5 }}>
          <MenuItem value="">General study</MenuItem>
          {moduleOptions.map((o) => <MenuItem key={o.id} value={o.id}>{o.label}</MenuItem>)}
        </TextField>
        {target && <Button startIcon={<MenuBook />} onClick={() => window.open('/reviewer', '_blank', 'noopener')} sx={{ textTransform: 'none' }}>Open reviewer in a new tab</Button>}
        <Typography variant="body2" sx={{ color: 'var(--c-ink-secondary)', mt: 2 }}>
          {completed} focus block{completed === 1 ? '' : 's'} done today in this session. Every finished block counts toward your streak and time studied.
        </Typography>
      </Paper>
    </Box>
  );
}
