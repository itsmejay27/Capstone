import { useMemo, useState } from 'react';
import {
  Box, Typography, Dialog, DialogTitle, DialogContent, IconButton, TextField, MenuItem, Avatar, Chip, Paper,
  useMediaQuery, useTheme,
} from '@mui/material';
import { Close, Flag, Timer } from '@mui/icons-material';
import { formatDuration } from '../../hooks/useExamGuard';
import AttemptInsight from '../AttemptInsight';

/** What the exam guard records while a student takes an exam. */
const FLAG_TYPES: [key: string, label: string][] = [
  ['tabSwitches', 'Left the tab'],
  ['copyAttempts', 'Copy'],
  ['pasteAttempts', 'Paste'],
  ['screenshotAttempts', 'Screenshot keys'],
  ['rightClicks', 'Right-click'],
  ['shortcutAttempts', 'Blocked shortcuts'],
];

const flagTotal = (a: any) => FLAG_TYPES.reduce((n, [k]) => n + (Number(a?.integrity?.[k]) || 0), 0);

/**
 * Exam integrity report, kept out of the grade grid: pick an exam and see, per student,
 * how long they took and what the exam guard recorded (tab switches, copy/paste,
 * screenshot keys…). Most-flagged students first.
 */
export default function IntegrityReport({ open, onClose, exams, attempts, students }: {
  open: boolean; onClose: () => void; exams: any[]; attempts: any[]; students: any[];
}) {
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('sm'));
  const [examId, setExamId] = useState<string>('');
  const selected = exams.find((e) => e.id === examId) || exams[0];

  const rows = useMemo(() => {
    if (!selected) return [];
    return students
      .map((st) => ({ st, a: attempts.find((x) => x.examId === selected.id && x.studentId === st.id && x.submittedAt) }))
      .filter((r) => r.a)
      .sort((x, y) => flagTotal(y.a) - flagTotal(x.a) || String(x.st.name).localeCompare(String(y.st.name)));
  }, [selected, attempts, students]);

  const flagged = rows.filter((r) => flagTotal(r.a) > 0).length;

  return (
    <Dialog open={open} onClose={onClose} fullScreen={phone} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 6 }}>
        <Flag color="warning" /> Exam flags
        <IconButton onClick={onClose} aria-label="Close" sx={{ position: 'absolute', right: 12, top: 12 }}><Close /></IconButton>
      </DialogTitle>
      <DialogContent>
        {exams.length === 0 ? (
          <Typography sx={{ py: 4, textAlign: 'center', color: 'var(--c-ink-secondary)' }}>No exams in this class yet.</Typography>
        ) : (
          <>
            <TextField select fullWidth label="Exam" value={selected?.id || ''} onChange={(e) => setExamId(e.target.value)} sx={{ mb: 2, mt: 1 }}>
              {exams.map((e) => <MenuItem key={e.id} value={e.id}>{e.title}</MenuItem>)}
            </TextField>

            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
              <Chip label={`${rows.length} submitted`} />
              <Chip color={flagged ? 'warning' : 'success'} label={flagged ? `${flagged} with flags` : 'No flags'} />
            </Box>

            {rows.length === 0 ? (
              <Typography sx={{ py: 3, textAlign: 'center', color: 'var(--c-ink-secondary)' }}>No submissions for this exam yet.</Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                {rows.map(({ st, a }) => {
                  const total = flagTotal(a);
                  const found = FLAG_TYPES.filter(([k]) => Number(a.integrity?.[k]) > 0);
                  return (
                    <Paper key={st.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2, borderColor: total ? 'var(--c-amber-300)' : 'var(--c-border)' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
                        <Avatar src={st.avatar} sx={{ width: 32, height: 32 }}>{st.name?.charAt(0)}</Avatar>
                        <Box sx={{ flex: 1, minWidth: 140 }}>
                          <Typography sx={{ fontWeight: 700, fontSize: '0.92rem' }} noWrap>{st.name}</Typography>
                          <Typography variant="caption" sx={{ color: 'var(--c-ink-tertiary)', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Timer sx={{ fontSize: 14 }} />
                            {a.timing ? `${formatDuration(a.timing.totalSeconds)} total · ${formatDuration(a.timing.averageSecondsPerQuestion)} per question` : 'No timing recorded'}
                          </Typography>
                        </Box>
                        <Chip size="small" color={total ? 'warning' : 'success'} label={total ? `${total} flag${total === 1 ? '' : 's'}` : 'Clean'} sx={{ fontWeight: 700 }} />
                      </Box>
                      {found.length > 0 && (
                        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 1.25 }}>
                          {found.map(([k, label]) => (
                            <Chip key={k} size="small" variant="outlined" label={`${label}: ${a.integrity[k]}`} />
                          ))}
                        </Box>
                      )}
                      {(a.timing || total > 0) && (
                        <Box sx={{ mt: 1, '& > div': { justifyContent: 'flex-start' } }}>
                          <Typography variant="caption" sx={{ color: 'var(--c-ink-tertiary)' }}>Tap for time per question:</Typography>
                          <AttemptInsight attempt={a} studentName={st.name} />
                        </Box>
                      )}
                    </Paper>
                  );
                })}
              </Box>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
