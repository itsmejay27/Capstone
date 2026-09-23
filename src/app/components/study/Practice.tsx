import { useState } from 'react';
import { Box, Paper, Typography, Button, Radio, RadioGroup, FormControlLabel, Alert, CircularProgress, Chip, LinearProgress, IconButton } from '@mui/material';
import { Psychology, ArrowBack, AutoAwesome, Delete, CheckCircle, Cancel } from '@mui/icons-material';
import SourcePicker, { useSourcePicker } from './SourcePicker';
import { generateStudyJson } from '../../services/geminiService';
import { newId, logStudySession, type useStudyItems } from '../../services/studyStore';

type Store = ReturnType<typeof useStudyItems>;
interface Q { question: string; options: string[]; correctAnswer: number; explanation?: string; topic: string }
interface Round { questions: Q[]; answers?: Record<number, number>; score?: number; focus?: string[] }
export interface PracticeSet { source: { label: string; text: string }; rounds: Round[]; mastery: Record<string, { correct: number; total: number }> }

const SYSTEM = 'You write fair, accurate multiple-choice practice questions with exactly 4 options, one correct answer, and a one-sentence explanation. Every question has a short "topic" label.';

async function makeRound(src: { label: string; text: string }, focus: string[], mistakes: string[]): Promise<Q[]> {
  const focusLine = focus.length
    ? `\nFocus ONLY on these weak topics: ${focus.join(', ')}. The student got these wrong before — write NEW questions that test the same ideas from different angles:\n${mistakes.slice(0, 10).map((m) => `- ${m}`).join('\n')}`
    : '';
  const out = await generateStudyJson(SYSTEM,
    `Write 8 practice questions for "${src.label}".${focusLine}${src.text ? `\nUse ONLY this material:\n---\n${src.text}\n---` : ''}
Respond as JSON: {"questions":[{"question":"...","options":["A","B","C","D"],"correctAnswer":0,"explanation":"...","topic":"..."}]}`);
  const qs = (out.questions || []).filter((q: any) => q.question && Array.isArray(q.options) && q.options.length >= 2)
    .map((q: any) => ({ question: String(q.question), options: q.options.map(String).slice(0, 4), correctAnswer: Math.min(Math.max(0, Number(q.correctAnswer) || 0), 3), explanation: q.explanation ? String(q.explanation) : '', topic: String(q.topic || 'General') }));
  if (!qs.length) throw new Error('The AI returned no questions. Try again or pick a different source.');
  return qs;
}

export const weakTopics = (m: PracticeSet['mastery']) =>
  Object.entries(m).filter(([, v]) => v.total > 0 && v.correct / v.total < 0.7).map(([t]) => t);

export default function Practice({ store }: { store: Store }) {
  const picker = useSourcePicker();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const sets = store.ofKind<PracticeSet>('practice');
  const open = sets.find((s) => s.id === openId);

  const create = async () => {
    setError(''); setBusy(true);
    try {
      const src = await picker.resolve();
      const questions = await makeRound(src, [], []);
      const saved = store.save({ id: newId('prac'), kind: 'practice', title: src.label, data: { source: src, rounds: [{ questions }], mastery: {} } });
      if (saved) setOpenId(saved.id);
    } catch (e: any) { setError(e.message || String(e)); }
    setBusy(false);
  };

  if (open) return <PracticeRun set={open} store={store} onBack={() => setOpenId(null)} />;

  return (
    <Box>
      <Paper sx={{ p: 2.5, mb: 3, borderRadius: '16px' }}>
        <Typography sx={{ fontWeight: 800, mb: 1.5 }}>New practice set</Typography>
        <SourcePicker picker={picker} />
        {error && <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>}
        <Button variant="contained" startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <AutoAwesome />} disabled={!picker.ready || busy} onClick={create} sx={{ mt: 1.5 }}>
          {busy ? 'Writing questions…' : 'Start practice'}
        </Button>
      </Paper>
      {sets.length === 0 ? (
        <Typography sx={{ color: 'var(--c-ink-tertiary)' }}>No practice sets yet.</Typography>
      ) : (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' } }}>
          {sets.map((s) => {
            const weak = weakTopics(s.data.mastery);
            const done = s.data.rounds.filter((r) => r.score !== undefined);
            return (
              <Paper key={s.id} variant="outlined" onClick={() => setOpenId(s.id)} sx={{ p: 2, borderRadius: '14px', cursor: 'pointer' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Psychology sx={{ color: 'var(--c-emerald-600)' }} />
                  <Typography sx={{ fontWeight: 800, flex: 1, minWidth: 0 }} noWrap>{s.title}</Typography>
                  <IconButton size="small" aria-label="Delete practice set" onClick={(e) => { e.stopPropagation(); store.remove(s.id); }}><Delete fontSize="small" /></IconButton>
                </Box>
                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                  <Chip size="small" label={`${done.length} round${done.length === 1 ? '' : 's'}`} />
                  <Chip size="small" color={weak.length ? 'warning' : 'success'} label={weak.length ? `${weak.length} weak topic${weak.length === 1 ? '' : 's'}` : done.length ? 'No weak topics' : 'Not started'} />
                </Box>
              </Paper>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

function PracticeRun({ set, store, onBack }: { set: any; store: Store; onBack: () => void }) {
  const data: PracticeSet = set.data;
  const round = data.rounds[data.rounds.length - 1];
  const [answers, setAnswers] = useState<Record<number, number>>(round.answers || {});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [started] = useState(Date.now());
  const submitted = round.score !== undefined;

  const submit = () => {
    const mastery = { ...data.mastery };
    let score = 0;
    round.questions.forEach((q, i) => {
      const ok = answers[i] === q.correctAnswer;
      if (ok) score += 1;
      const m = mastery[q.topic] || { correct: 0, total: 0 };
      mastery[q.topic] = { correct: m.correct + (ok ? 1 : 0), total: m.total + 1 };
    });
    const rounds = [...data.rounds.slice(0, -1), { ...round, answers, score }];
    store.save({ ...set, data: { ...data, rounds, mastery } });
    logStudySession(store.save, (Date.now() - started) / 60000, `Practice: ${set.title}`);
  };

  const nextRound = async (focusWeak: boolean) => {
    setError(''); setBusy(true);
    try {
      const focus = focusWeak ? weakTopics(data.mastery) : [];
      const mistakes = data.rounds.flatMap((r) => r.questions.filter((q, i) => r.answers && r.answers[i] !== q.correctAnswer && focus.includes(q.topic)).map((q) => q.question));
      const questions = await makeRound(data.source, focus, mistakes);
      store.save({ ...set, data: { ...data, rounds: [...data.rounds, { questions, focus }] } });
      setAnswers({});
    } catch (e: any) { setError(e.message || String(e)); }
    setBusy(false);
  };

  const weak = weakTopics(data.mastery);

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={onBack} sx={{ mb: 2, textTransform: 'none' }}>All practice sets</Button>
      <Typography variant="h6" sx={{ fontWeight: 800 }}>{set.title} — round {data.rounds.length}</Typography>
      {round.focus?.length ? <Typography variant="body2" sx={{ color: 'var(--c-ink-secondary)', mb: 1 }}>Focusing on: {round.focus.join(', ')}</Typography> : null}

      {Object.keys(data.mastery).length > 0 && (
        <Paper variant="outlined" sx={{ p: 2, my: 2, borderRadius: '14px' }}>
          <Typography sx={{ fontWeight: 800, mb: 1 }}>Mastery by topic</Typography>
          {Object.entries(data.mastery).map(([t, m]) => (
            <Box key={t} sx={{ mb: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">{t}</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{Math.round((m.correct / m.total) * 100)}%</Typography>
              </Box>
              <LinearProgress variant="determinate" value={(m.correct / m.total) * 100} color={m.correct / m.total < 0.7 ? 'warning' : 'success'} sx={{ height: 6, borderRadius: 3 }} />
            </Box>
          ))}
        </Paper>
      )}

      {round.questions.map((q, i) => {
        const chosen = answers[i];
        return (
          <Paper key={i} variant="outlined" sx={{ p: 2, mb: 1.5, borderRadius: '14px' }}>
            <Typography sx={{ fontWeight: 700, mb: 1 }}>{i + 1}. {q.question} <Chip size="small" label={q.topic} sx={{ ml: 1 }} /></Typography>
            <RadioGroup value={chosen ?? ''} onChange={(e) => !submitted && setAnswers({ ...answers, [i]: Number(e.target.value) })}>
              {q.options.map((o, oi) => {
                const right = submitted && oi === q.correctAnswer;
                const wrong = submitted && oi === chosen && oi !== q.correctAnswer;
                return (
                  <FormControlLabel key={oi} value={oi} disabled={submitted} control={<Radio size="small" />}
                    label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: right ? 'var(--c-green-700)' : wrong ? 'var(--c-red-700)' : 'inherit', fontWeight: right ? 700 : 400 }}>
                      {o} {right && <CheckCircle fontSize="small" />} {wrong && <Cancel fontSize="small" />}
                    </Box>} />
                );
              })}
            </RadioGroup>
            {submitted && q.explanation && <Typography variant="body2" sx={{ color: 'var(--c-ink-secondary)', mt: 0.5 }}>{q.explanation}</Typography>}
          </Paper>
        );
      })}

      {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
      {!submitted ? (
        <Button variant="contained" onClick={submit} disabled={Object.keys(answers).length < round.questions.length}>Check answers</Button>
      ) : (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Typography sx={{ fontWeight: 800, mr: 1 }}>Score: {round.score}/{round.questions.length}</Typography>
          {weak.length > 0 && (
            <Button variant="contained" disabled={busy} startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <Psychology />} onClick={() => nextRound(true)}>
              Practice my weak topics ({weak.length})
            </Button>
          )}
          <Button variant="outlined" disabled={busy} onClick={() => nextRound(false)}>New mixed round</Button>
        </Box>
      )}
    </Box>
  );
}
