import { useState } from 'react';
import { Box, Typography, Chip, Tooltip, Dialog, DialogTitle, DialogContent, Table, TableHead, TableRow, TableCell, TableBody, IconButton } from '@mui/material';
import { Timer, ReportProblem, Close } from '@mui/icons-material';
import { formatDuration } from '../hooks/useExamGuard';

/**
 * Under a gradebook score: how long the attempt took, the average per question, and any
 * integrity events (tab switches, copy/paste, screenshot keys). Click for the per-question
 * breakdown, where unusually fast or slow answers stand out.
 */
export default function AttemptInsight({ attempt, studentName }: { attempt: any; studentName?: string }) {
  const [open, setOpen] = useState(false);
  const timing = attempt?.timing;
  const integrity = attempt?.integrity || {};
  const flags = [
    ['Tab switches', integrity.tabSwitches],
    ['Copy attempts', integrity.copyAttempts],
    ['Paste attempts', integrity.pasteAttempts],
    ['Screenshot attempts', integrity.screenshotAttempts],
    ['Right-clicks', integrity.rightClicks],
    ['Blocked shortcuts', integrity.shortcutAttempts],
  ].filter(([, n]) => Number(n) > 0) as [string, number][];
  const flagCount = flags.reduce((a, [, n]) => a + n, 0);

  if (!timing && flagCount === 0) {
    return <Typography variant="caption" sx={{ display: 'block', color: 'var(--c-ink-tertiary)', mt: 0.5 }}>No timing recorded</Typography>;
  }

  const questions: any[] = Array.isArray(attempt.questions) ? attempt.questions : [];
  const per = timing?.perQuestion || {};
  const avg = timing?.averageSecondsPerQuestion || 0;

  return (
    <>
      <Box onClick={() => setOpen(true)} sx={{ display: 'flex', gap: 0.5, justifyContent: 'center', mt: 0.5, cursor: 'pointer', flexWrap: 'wrap' }}>
        {timing && (
          <Tooltip title="Total time · average per question — click for details">
            <Chip size="small" icon={<Timer sx={{ fontSize: '14px !important' }} />} label={`${formatDuration(timing.totalSeconds)} · ${formatDuration(avg)}/q`}
              sx={{ height: 22, fontSize: '0.68rem', fontWeight: 700, bgcolor: 'var(--c-surface-sunken)' }} />
          </Tooltip>
        )}
        {flagCount > 0 && (
          <Tooltip title={flags.map(([l, n]) => `${l}: ${n}`).join(' · ')}>
            <Chip size="small" icon={<ReportProblem sx={{ fontSize: '14px !important' }} />} label={`${flagCount} flag${flagCount === 1 ? '' : 's'}`}
              sx={{ height: 22, fontSize: '0.68rem', fontWeight: 800, bgcolor: 'var(--c-amber-100)', color: 'var(--c-amber-800)' }} />
          </Tooltip>
        )}
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, pr: 6 }}>
          {studentName ? `${studentName} — ` : ''}time &amp; integrity
          <IconButton onClick={() => setOpen(false)} sx={{ position: 'absolute', right: 12, top: 12 }} aria-label="Close"><Close /></IconButton>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
            <Chip label={`Total: ${formatDuration(timing?.totalSeconds)}`} />
            <Chip label={`Average per question: ${formatDuration(avg)}`} />
            {flags.length === 0 ? <Chip color="success" label="No integrity events" /> : flags.map(([l, n]) => <Chip key={l} color="warning" label={`${l}: ${n}`} />)}
          </Box>
          <Table size="small">
            <TableHead>
              <TableRow><TableCell>#</TableCell><TableCell>Question</TableCell><TableCell align="right">Time</TableCell></TableRow>
            </TableHead>
            <TableBody>
              {questions.map((q, i) => {
                const sec = per[q.id] || 0;
                // Far below or above the attempt's own average is worth a look.
                const odd = avg > 0 && (sec < avg * 0.25 || sec > avg * 3);
                return (
                  <TableRow key={q.id || i}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell sx={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={q.question}>{q.question}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: odd ? 800 : 500, color: odd ? 'var(--c-amber-700)' : 'inherit' }}>{formatDuration(sec)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: 'var(--c-ink-tertiary)' }}>
            Highlighted times are far faster or slower than this student's own average. Time is counted only while the exam tab was visible.
          </Typography>
        </DialogContent>
      </Dialog>
    </>
  );
}
