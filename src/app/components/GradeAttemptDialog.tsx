import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, TextField, Chip, IconButton, Divider,
} from '@mui/material';
import { Close, CheckCircle, Cancel, RateReview } from '@mui/icons-material';
import { autoPoints, gradeFor, isManual, scoreAttempt } from '../services/grading';

/**
 * The instructor checks a submitted attempt here. Multiple-choice and true/false are already
 * scored; each answered short-answer or essay item gets points from the instructor. The
 * attempt gets its final grade only once every written item has been checked.
 */
export default function GradeAttemptDialog({
  open, onClose, attempt, exam, studentName, onSave,
}: {
  open: boolean;
  onClose: () => void;
  attempt: any;
  exam: any;
  studentName?: string;
  onSave: (updated: any) => void;
}) {
  const questions: any[] = (attempt?.questions?.length ? attempt.questions : exam?.questions) || [];
  const [points, setPoints] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (!open) return;
    const init: Record<string, string> = {};
    Object.entries(attempt?.manualScores || {}).forEach(([k, v]) => { init[k] = String(v); });
    setPoints(init);
    setFeedback(attempt?.feedback || '');
  }, [open, attempt?.id]);

  const manualScores: Record<string, number> = {};
  Object.entries(points).forEach(([k, v]) => {
    if (v.trim() === '') return;
    const q = questions.find((x) => x.id === k);
    const n = Math.max(0, Math.min(Number(q?.points || 0), Number(v)));
    if (!Number.isNaN(n)) manualScores[k] = n;
  });
  const scored = scoreAttempt(questions, attempt?.answers || {}, manualScores);
  const total = exam?.totalPoints || questions.reduce((a, q) => a + (q.points || 0), 0);
  const g = gradeFor(scored.total, total);

  const save = () => {
    onSave({
      ...attempt,
      manualScores,
      feedback: feedback.trim() || undefined,
      score: scored.total,
      gradingStatus: scored.pendingIds.length > 0 ? 'pending' : 'graded',
      gradedAt: scored.pendingIds.length > 0 ? attempt?.gradedAt : new Date().toISOString(),
    });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 800, pr: 6 }}>
        <RateReview sx={{ mr: 1, verticalAlign: 'middle' }} />
        {studentName ? `${studentName} — ` : ''}{exam?.title}
        <IconButton onClick={onClose} sx={{ position: 'absolute', right: 12, top: 12 }} aria-label="Close"><Close /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          <Chip label={`Auto-scored: ${scored.auto}`} />
          <Chip label={`Checked by you: ${scored.manual}`} />
          <Chip color={scored.pendingIds.length ? 'warning' : 'success'}
            label={scored.pendingIds.length ? `${scored.pendingIds.length} item(s) left to check` : `Final: ${scored.total}/${total} · Grade ${g.grade}`} />
        </Box>
        {questions.map((q, i) => {
          const ans = attempt?.answers?.[q.id];
          const manual = isManual(q);
          const auto = autoPoints(q, ans);
          const shown = q.type === 'multiple-choice' && typeof ans === 'number' ? `${String.fromCharCode(65 + ans)}. ${q.options?.[ans] ?? ''}` : ans;
          return (
            <Box key={q.id || i} sx={{ py: 1.5 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
                {i + 1}. {q.question} <Typography component="span" variant="caption" sx={{ color: 'var(--c-ink-tertiary)' }}>({q.type}, {q.points} pt{q.points === 1 ? '' : 's'})</Typography>
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-line', p: 1, borderRadius: 1, bgcolor: 'var(--c-surface-sunken)' }}>
                {shown === undefined || shown === null || String(shown).trim() === '' ? <em>No answer</em> : String(shown)}
              </Typography>
              {manual ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1, flexWrap: 'wrap' }}>
                  {q.correctAnswer !== undefined && q.correctAnswer !== '' && (
                    <Typography variant="caption" sx={{ color: 'var(--c-green-700)', flex: '1 1 240px' }}>
                      Answer key / guide: {String(q.correctAnswer)}
                    </Typography>
                  )}
                  <TextField
                    size="small" type="number" label="Points"
                    value={points[q.id] ?? ''}
                    disabled={ans === undefined || String(ans ?? '').trim() === ''}
                    onChange={(e) => setPoints((p) => ({ ...p, [q.id]: e.target.value }))}
                    inputProps={{ min: 0, max: q.points, step: 0.5 }}
                    sx={{ width: 110 }}
                    helperText={`of ${q.points}`}
                  />
                </Box>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                  {auto ? <CheckCircle fontSize="small" color="success" /> : <Cancel fontSize="small" color="error" />}
                  <Typography variant="caption">{auto}/{q.points} (automatic)</Typography>
                </Box>
              )}
              <Divider sx={{ mt: 1.5 }} />
            </Box>
          );
        })}
        <TextField label="Feedback to the student (optional)" multiline minRows={2} fullWidth value={feedback} onChange={(e) => setFeedback(e.target.value)} sx={{ mt: 1 }} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save}>
          {scored.pendingIds.length ? 'Save progress' : 'Save and release grade'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
