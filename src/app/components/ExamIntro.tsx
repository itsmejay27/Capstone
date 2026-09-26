import { useState } from 'react';
import {
  Box, Paper, Typography, Button, Alert, Checkbox, FormControlLabel, Divider,
} from '@mui/material';
import {
  AccessTime, HelpOutline, Star, Tab, ContentCopy, ContentPaste, Screenshot, Mouse, Keyboard,
  Timer, Save, Send, CheckCircleOutline, PlayArrow, ArrowBack,
} from '@mui/icons-material';

/** What the exam guard records, in the words a student needs. */
const FLAGS = [
  { icon: Tab, title: 'Leaving the exam', text: 'Switching tabs or apps, minimising the browser, or opening your notification shade.' },
  { icon: ContentCopy, title: 'Copying', text: 'Copying is blocked; trying it (Ctrl/⌘+C, Ctrl/⌘+X) is recorded.' },
  { icon: ContentPaste, title: 'Pasting', text: 'Pasting is blocked; trying to paste an answer is recorded.' },
  { icon: Screenshot, title: 'Screenshot keys', text: 'Print Screen, Win+Shift+S, ⌘+Shift+3/4/5 and similar.' },
  { icon: Mouse, title: 'Right-clicking', text: 'The right-click menu is blocked; trying to open it is recorded.' },
  { icon: Keyboard, title: 'Blocked shortcuts', text: 'Shortcuts such as print, save page, view source or developer tools.' },
];

const STEPS = [
  { icon: Timer, text: 'The timer starts as soon as you press Start and keeps running even if you leave the page.' },
  { icon: Save, text: 'Your answers save as you go. If your connection drops, reopen the exam to continue.' },
  { icon: Send, text: 'Press Submit when you are done. When time runs out, the exam submits itself.' },
  { icon: CheckCircleOutline, text: 'Multiple-choice and true/false are scored right away; written answers are checked by your instructor.' },
];

/**
 * The screen a student sees before an exam starts: what the exam is, how it works, and a
 * plain list of everything that gets flagged for the instructor. Start stays disabled until
 * the student confirms they have read it.
 */
export default function ExamIntro({ exam, isLate, onStart, onBack }: {
  exam: any; isLate?: boolean; onStart: () => void; onBack: () => void;
}) {
  const [agreed, setAgreed] = useState(false);
  const count = exam.activeQuestionCount || exam.questions?.length || 0;

  const stat = (Icon: any, value: string, label: string) => (
    <Box sx={{ flex: '1 1 110px', p: 1.5, borderRadius: 2, bgcolor: 'var(--c-surface-sunken)', textAlign: 'center' }}>
      <Icon sx={{ fontSize: 20, color: 'primary.main' }} />
      <Typography sx={{ fontWeight: 800, fontSize: '1.15rem' }}>{value}</Typography>
      <Typography variant="caption" sx={{ color: 'var(--c-ink-secondary)', fontWeight: 600 }}>{label}</Typography>
    </Box>
  );

  return (
    <Box sx={{ maxWidth: 760, mx: 'auto', px: { xs: 1.5, sm: 3 }, py: { xs: 2, sm: 5 } }}>
      <Button startIcon={<ArrowBack />} onClick={onBack} sx={{ mb: 1.5, textTransform: 'none' }}>Back</Button>
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 4 }, borderRadius: 3 }}>
        <Typography variant="overline" sx={{ color: 'var(--c-ink-tertiary)', fontWeight: 700 }}>Before you begin</Typography>
        <Typography variant="h5" sx={{ fontWeight: 900, mb: 1, wordBreak: 'break-word' }}>{exam.title}</Typography>
        <Typography variant="body2" sx={{ color: 'var(--c-ink-secondary)', whiteSpace: 'pre-line', mb: 2.5 }}>
          {exam.instructions || exam.description || 'Read each question carefully. Answer on your own, without outside help.'}
        </Typography>

        <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap', mb: 3 }}>
          {stat(AccessTime, `${exam.duration} min`, 'Time limit')}
          {stat(HelpOutline, String(count), 'Questions')}
          {stat(Star, `${exam.totalPoints} pts`, 'Total points')}
        </Box>

        {isLate && (
          <Alert severity="warning" sx={{ mb: 2.5 }}>This exam is past its due date. You can still take it, but it will be marked late.</Alert>
        )}

        <Typography sx={{ fontWeight: 800, mb: 1.25 }}>How this exam works</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, mb: 3 }}>
          {STEPS.map(({ icon: Icon, text }, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start' }}>
              <Icon sx={{ fontSize: 20, color: 'primary.main', mt: 0.1 }} />
              <Typography variant="body2">{text}</Typography>
            </Box>
          ))}
        </Box>

        <Divider sx={{ mb: 2.5 }} />

        <Alert severity="error" icon={false} sx={{ mb: 2, borderRadius: 2 }}>
          <Typography sx={{ fontWeight: 800, mb: 0.5 }}>⚠ Integrity monitoring is on</Typography>
          <Typography variant="body2">
            While the exam is open, the actions below are <strong>recorded and shown to your instructor</strong> as flags,
            with the time you spent on each question. Flags do not end your exam, but your instructor may review or
            invalidate a flagged attempt.
          </Typography>
        </Alert>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.25, mb: 3 }}>
          {FLAGS.map(({ icon: Icon, title, text }) => (
            <Box key={title} sx={{ display: 'flex', gap: 1.25, p: 1.25, borderRadius: 2, border: '1px solid var(--c-border)' }}>
              <Icon sx={{ fontSize: 20, color: 'var(--c-amber-600)', mt: 0.2, flexShrink: 0 }} />
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{title}</Typography>
                <Typography variant="caption" sx={{ color: 'var(--c-ink-secondary)' }}>{text}</Typography>
              </Box>
            </Box>
          ))}
        </Box>

        <Typography variant="caption" sx={{ display: 'block', color: 'var(--c-ink-tertiary)', mb: 2 }}>
          Tip: close other apps and turn on Do Not Disturb first, so a notification does not pull you out of the exam.
        </Typography>

        <FormControlLabel
          control={<Checkbox checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />}
          label={<Typography variant="body2" sx={{ fontWeight: 600 }}>I have read this and will take the exam on my own, without leaving the page.</Typography>}
          sx={{ alignItems: 'flex-start', mb: 2, '& .MuiCheckbox-root': { pt: 0.25 } }}
        />

        <Button variant="contained" size="large" fullWidth startIcon={<PlayArrow />} disabled={!agreed} onClick={onStart}
          sx={{ textTransform: 'none', fontWeight: 800, py: 1.4 }}>
          {agreed ? 'Start exam — timer begins now' : 'Tick the box above to start'}
        </Button>
      </Paper>
    </Box>
  );
}
