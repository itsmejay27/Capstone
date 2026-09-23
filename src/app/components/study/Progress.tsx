import { useMemo } from 'react';
import { Box, Paper, Typography, LinearProgress } from '@mui/material';
import { LocalFireDepartment, Schedule, EmojiEvents, Style } from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { retention, type SrsCard } from '../../services/srs';
import type { useStudyItems } from '../../services/studyStore';

/** Mastery per topic, study streak, time spent and what is waiting — from everything the student does. */
export default function Progress({ store }: { store: ReturnType<typeof useStudyItems> }) {
  const { reviewers } = useAuth();
  const sessions = store.ofKind<{ minutes: number; date: string; activity: string }>('session');

  const { streak, week, total, byDay } = useMemo(() => {
    const days = new Set(sessions.map((s) => new Date(s.data.date).toDateString()));
    let streak = 0; const d = new Date();
    if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1); // today not started yet still keeps yesterday's streak
    while (days.has(d.toDateString())) { streak++; d.setDate(d.getDate() - 1); }
    const byDay: { label: string; minutes: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date(); day.setDate(day.getDate() - i);
      byDay.push({ label: day.toLocaleDateString(undefined, { weekday: 'short' }), minutes: sessions.filter((s) => new Date(s.data.date).toDateString() === day.toDateString()).reduce((a, s) => a + s.data.minutes, 0) });
    }
    return { streak, week: byDay.reduce((a, b) => a + b.minutes, 0), total: sessions.reduce((a, s) => a + s.data.minutes, 0), byDay };
  }, [sessions]);

  // Topic mastery: practice results + reviewer module scores.
  const topics = useMemo(() => {
    const m: Record<string, { correct: number; total: number }> = {};
    for (const p of store.ofKind<any>('practice')) {
      for (const [t, v] of Object.entries<any>(p.data.mastery || {})) {
        m[t] = { correct: (m[t]?.correct || 0) + v.correct, total: (m[t]?.total || 0) + v.total };
      }
    }
    for (const r of reviewers as any[]) {
      for (const mod of r.modules || []) {
        if (mod.bestScore === null || mod.bestScore === undefined) continue;
        const t = mod.topic || mod.title;
        const n = (mod.questions || []).length || 1;
        m[t] = { correct: (m[t]?.correct || 0) + mod.bestScore, total: (m[t]?.total || 0) + n };
      }
    }
    return Object.entries(m).map(([t, v]) => ({ topic: t, pct: v.total ? v.correct / v.total : 0 })).sort((a, b) => a.pct - b.pct);
  }, [store.items, reviewers]); // eslint-disable-line

  const cards: SrsCard[] = store.ofKind<any>('deck').flatMap((d) => d.data.cards || []);
  const maxDay = Math.max(1, ...byDay.map((d) => d.minutes));

  const Stat = ({ icon, label, value }: any) => (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: '14px', flex: '1 1 160px' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'var(--c-emerald-600)' }}>{icon}<Typography variant="caption" sx={{ fontWeight: 700, color: 'var(--c-ink-secondary)' }}>{label}</Typography></Box>
      <Typography sx={{ fontSize: '1.7rem', fontWeight: 900 }}>{value}</Typography>
    </Paper>
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 3 }}>
        <Stat icon={<LocalFireDepartment />} label="Study streak" value={`${streak} day${streak === 1 ? '' : 's'}`} />
        <Stat icon={<Schedule />} label="This week" value={`${Math.round(week)} min`} />
        <Stat icon={<EmojiEvents />} label="All time" value={`${(total / 60).toFixed(1)} h`} />
        <Stat icon={<Style />} label="Cards learned" value={`${Math.round(retention(cards) * 100)}%`} />
      </Box>

      <Paper variant="outlined" sx={{ p: 2.5, mb: 3, borderRadius: '16px' }}>
        <Typography sx={{ fontWeight: 800, mb: 2 }}>Minutes studied — last 7 days</Typography>
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1.5, height: 140 }}>
          {byDay.map((d) => (
            <Box key={d.label} sx={{ flex: 1, textAlign: 'center' }}>
              <Typography variant="caption" sx={{ color: 'var(--c-ink-tertiary)' }}>{Math.round(d.minutes)}</Typography>
              <Box sx={{ height: `${(d.minutes / maxDay) * 100}px`, minHeight: 3, borderRadius: '6px 6px 2px 2px', background: 'linear-gradient(180deg, var(--c-emerald-500), var(--c-teal-600))' }} />
              <Typography variant="caption" sx={{ fontWeight: 700 }}>{d.label}</Typography>
            </Box>
          ))}
        </Box>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2.5, borderRadius: '16px' }}>
        <Typography sx={{ fontWeight: 800, mb: 1.5 }}>Mastery by topic</Typography>
        {topics.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'var(--c-ink-tertiary)' }}>Finish a practice round or a reviewer module to see your mastery here.</Typography>
        ) : topics.map((t) => (
          <Box key={t.topic} sx={{ mb: 1.25 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2">{t.topic}</Typography>
              <Typography variant="body2" sx={{ fontWeight: 800, color: t.pct < 0.7 ? 'var(--c-amber-700)' : 'var(--c-green-700)' }}>{Math.round(t.pct * 100)}%</Typography>
            </Box>
            <LinearProgress variant="determinate" value={t.pct * 100} color={t.pct < 0.7 ? 'warning' : 'success'} sx={{ height: 7, borderRadius: 4 }} />
          </Box>
        ))}
      </Paper>
    </Box>
  );
}
