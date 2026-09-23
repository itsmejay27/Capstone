import { useMemo, useState } from 'react';
import { Box, Paper, Typography, Chip, TextField, Button, MenuItem, IconButton } from '@mui/material';
import { Event, Delete, PlayArrow } from '@mui/icons-material';
import { useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext';

/**
 * Study planner. Upcoming exams (from the student's classes, plus any they add themselves)
 * each get a countdown, and the unfinished modules of a linked reviewer are spread evenly
 * over the days left, with a buffer day before the exam for revision.
 */
interface CustomExam { id: string; title: string; date: string; reviewerId?: string }
const KEY = (uid: string) => `studyPlanner:${uid}`;
const DAY = 24 * 60 * 60 * 1000;

export default function Planner() {
  const { currentUser, classrooms, exams, reviewers } = useAuth();
  const navigate = useNavigate();
  const uid = currentUser?.id || '';
  const [custom, setCustom] = useState<CustomExam[]>(() => { try { return JSON.parse(localStorage.getItem(KEY(uid)) || '[]'); } catch { return []; } });
  const [links, setLinks] = useState<Record<string, string>>(() => { try { return JSON.parse(localStorage.getItem(KEY(uid) + ':links') || '{}'); } catch { return {}; } });
  const [draft, setDraft] = useState({ title: '', date: '' });
  const persist = (c: CustomExam[], l = links) => { setCustom(c); setLinks(l); try { localStorage.setItem(KEY(uid), JSON.stringify(c)); localStorage.setItem(KEY(uid) + ':links', JSON.stringify(l)); } catch { /* */ } };

  const myClassIds = new Set(classrooms.filter((c: any) => (c.students || []).includes(uid)).map((c: any) => c.id));
  const upcoming = useMemo(() => {
    const fromClasses = (exams || []).filter((e: any) => myClassIds.has(e.classroomId) && e.dueDate && new Date(e.dueDate).getTime() > Date.now())
      .map((e: any) => ({ id: e.id, title: e.title, date: e.dueDate, className: classrooms.find((c: any) => c.id === e.classroomId)?.name, custom: false }));
    const mine = custom.filter((c) => new Date(c.date).getTime() > Date.now() - DAY).map((c) => ({ ...c, className: 'My own date', custom: true }));
    return [...fromClasses, ...mine].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [exams, custom, classrooms]); // eslint-disable-line

  const plan = (examDate: string, reviewerId?: string) => {
    const rev = reviewers.find((r: any) => r.id === reviewerId);
    if (!rev) return [];
    const todo = (rev.modules || []).filter((m: any) => m.status !== 'passed');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const days = Math.max(1, Math.floor((new Date(examDate).getTime() - today.getTime()) / DAY) - 1); // keep the eve for revision
    const perDay = Math.ceil(todo.length / days);
    const out: { date: Date; modules: any[] }[] = [];
    for (let d = 0; d < days && d * perDay < todo.length; d++) out.push({ date: new Date(today.getTime() + d * DAY), modules: todo.slice(d * perDay, d * perDay + perDay) });
    return out;
  };

  return (
    <Box>
      <Paper sx={{ p: 2.5, mb: 3, borderRadius: '16px' }}>
        <Typography sx={{ fontWeight: 800, mb: 1.5 }}>Add an exam date</Typography>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <TextField size="small" label="Exam or quiz" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          <TextField size="small" type="datetime-local" label="Date" InputLabelProps={{ shrink: true }} value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
          <Button variant="contained" disabled={!draft.title.trim() || !draft.date}
            onClick={() => { persist([...custom, { id: `ce-${Date.now()}`, title: draft.title.trim(), date: new Date(draft.date).toISOString() }]); setDraft({ title: '', date: '' }); }}>Add</Button>
        </Box>
        <Typography variant="caption" sx={{ color: 'var(--c-ink-tertiary)' }}>Exams your instructors schedule appear here automatically.</Typography>
      </Paper>

      {upcoming.length === 0 && <Typography sx={{ color: 'var(--c-ink-tertiary)' }}>No upcoming exams. Add one above.</Typography>}
      {upcoming.map((u) => {
        const ms = new Date(u.date).getTime() - Date.now();
        const d = Math.floor(ms / DAY), h = Math.floor((ms % DAY) / 3600000);
        const reviewerId = links[u.id];
        const schedule = plan(u.date, reviewerId);
        return (
          <Paper key={u.id} variant="outlined" sx={{ p: 2.5, mb: 2, borderRadius: '16px' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Event sx={{ color: 'var(--c-emerald-600)' }} />
              <Box sx={{ flex: 1, minWidth: 180 }}>
                <Typography sx={{ fontWeight: 800 }}>{u.title}</Typography>
                <Typography variant="caption" sx={{ color: 'var(--c-ink-tertiary)' }}>{u.className} · {new Date(u.date).toLocaleString()}</Typography>
              </Box>
              <Chip color={d < 2 ? 'error' : d < 7 ? 'warning' : 'primary'} label={ms < 0 ? 'Today' : d > 0 ? `${d}d ${h}h left` : `${h}h left`} sx={{ fontWeight: 800 }} />
              {u.custom && <IconButton size="small" aria-label="Remove date" onClick={() => persist(custom.filter((c) => c.id !== u.id))}><Delete fontSize="small" /></IconButton>}
            </Box>
            <TextField select size="small" label="Study with reviewer" value={reviewerId || ''} sx={{ mt: 2, minWidth: 260 }}
              onChange={(e) => persist(custom, { ...links, [u.id]: e.target.value })}>
              <MenuItem value="">— None —</MenuItem>
              {reviewers.map((r: any) => <MenuItem key={r.id} value={r.id}>{r.title}</MenuItem>)}
            </TextField>
            {reviewerId && (schedule.length === 0 ? (
              <Typography variant="body2" sx={{ mt: 1.5, color: 'var(--c-green-700)', fontWeight: 700 }}>All modules passed — use the last days for flashcards and practice.</Typography>
            ) : (
              <Box sx={{ mt: 1.5, display: 'grid', gap: 1 }}>
                {schedule.map((s, i) => (
                  <Box key={i} sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Chip size="small" label={i === 0 ? 'Today' : s.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} sx={{ minWidth: 110 }} />
                    {s.modules.map((m: any) => <Chip key={m.id} size="small" variant="outlined" label={m.title} onClick={i === 0 ? () => navigate('/reviewer') : undefined} icon={i === 0 ? <PlayArrow /> : undefined} />)}
                  </Box>
                ))}
                <Typography variant="caption" sx={{ color: 'var(--c-ink-tertiary)' }}>The day before the exam is kept free for revision.</Typography>
              </Box>
            ))}
          </Paper>
        );
      })}
    </Box>
  );
}
