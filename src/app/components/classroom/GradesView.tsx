import { useMemo, useState } from 'react';
import {
  Box, Typography, Paper, Avatar, ToggleButtonGroup, ToggleButton, Tooltip, Table, TableHead, TableRow, TableCell, TableBody, TableContainer, TextField, MenuItem,
} from '@mui/material';
import { useNavigate } from 'react-router';
import { gradeFor, isPending } from '../../services/grading';
import ItemAnalysisPanel from '../ItemAnalysisPanel';
import GradeSheet from '../GradeSheet';

/**
 * The Grades tab, organised like Google Classroom's grade grid: one row per student, one
 * column per graded item (quizzes/exams and assignments), newest first, with each student's
 * average and a class-average row. The class record sheet and item analysis are separate
 * views of the same tab so the main grid stays uncluttered.
 */

type Col = {
  id: string; kind: 'exam' | 'work'; title: string; outOf: number; date?: string; exam?: any; work?: any;
};

export default function GradesView({
  classroom, students, exams, classwork, attempts, submissions, accent, onCheckAttempt,
}: {
  classroom: any;
  students: any[];
  exams: any[];
  classwork: any[];
  attempts: any[];
  submissions: any[];
  accent: string;
  onCheckAttempt: (a: { attempt: any; exam: any; studentName: string }) => void;
}) {
  const navigate = useNavigate();
  const [view, setView] = useState<'grades' | 'record' | 'analysis'>('grades');
  const [sort, setSort] = useState<'last' | 'first'>('last');

  const cols: Col[] = useMemo(() => {
    const list: Col[] = [
      ...exams.map((e) => ({ id: `e-${e.id}`, kind: 'exam' as const, title: e.title, outOf: e.totalPoints || 0, date: e.dueDate || e.postDate || e.createdAt, exam: e })),
      ...classwork
        .filter((w) => w.kind !== 'material' && typeof w.points === 'number')
        .map((w) => ({ id: `w-${w.id}`, kind: 'work' as const, title: w.title, outOf: w.points, date: w.dueDate || w.createdAt, work: w })),
    ];
    return list.sort((a, b) => (new Date(b.date || 0).getTime() || 0) - (new Date(a.date || 0).getTime() || 0));
  }, [exams, classwork]);

  const sortedStudents = useMemo(() => {
    const key = (s: any) => {
      const parts = String(s.name || '').trim().split(/\s+/);
      return sort === 'last' ? `${parts[parts.length - 1]} ${parts[0]}` : String(s.name || '');
    };
    return [...students].sort((a, b) => key(a).localeCompare(key(b)));
  }, [students, sort]);

  /** Score for one student and column, or a status word, plus a fraction for averages. */
  const cell = (st: any, c: Col): { text: string; sub?: string; tone: 'score' | 'missing' | 'pending' | 'done' | 'none'; frac?: number; onClick?: () => void } => {
    if (c.kind === 'exam') {
      const a = attempts.find((x) => x.examId === c.exam.id && x.studentId === st.id && x.submittedAt);
      if (!a) {
        const overdue = c.exam.dueDate && new Date(c.exam.dueDate).getTime() < Date.now();
        return { text: overdue ? 'Missing' : '—', tone: overdue ? 'missing' : 'none' };
      }
      if (isPending(a)) return { text: 'Needs checking', tone: 'pending', onClick: () => onCheckAttempt({ attempt: a, exam: c.exam, studentName: st.name }) };
      const g = gradeFor(a.score || 0, c.outOf);
      return { text: `${a.score ?? 0}`, sub: `Grade ${g.grade}`, tone: 'score', frac: c.outOf ? (a.score || 0) / c.outOf : 0, onClick: () => onCheckAttempt({ attempt: a, exam: c.exam, studentName: st.name }) };
    }
    const s = submissions.find((x) => x.classworkId === c.work.id && x.studentId === st.id);
    const open = () => navigate(`/classroom/${classroom.id}/work/${c.work.id}`);
    if (s?.status === 'returned' && typeof s.grade === 'number') return { text: `${s.grade}`, tone: 'score', frac: c.outOf ? s.grade / c.outOf : 0, onClick: open };
    if (s && s.status !== 'assigned') return { text: 'Turned in', sub: s.isLate ? 'Late' : 'To grade', tone: 'done', onClick: open };
    const overdue = c.work.dueDate && new Date(c.work.dueDate).getTime() < Date.now();
    return { text: overdue ? 'Missing' : '—', tone: overdue ? 'missing' : 'none', onClick: open };
  };

  const studentAverage = (st: any) => {
    const fr = cols.map((c) => cell(st, c).frac).filter((f): f is number => typeof f === 'number');
    return fr.length ? fr.reduce((a, b) => a + b, 0) / fr.length : null;
  };
  const colAverage = (c: Col) => {
    const fr = students.map((st) => cell(st, c).frac).filter((f): f is number => typeof f === 'number');
    return fr.length ? fr.reduce((a, b) => a + b, 0) / fr.length : null;
  };
  const classAvg = (() => {
    const all = students.map(studentAverage).filter((v): v is number => v !== null);
    return all.length ? all.reduce((a, b) => a + b, 0) / all.length : null;
  })();
  const pendingCount = students.reduce((n, st) => n + cols.filter((c) => cell(st, c).tone === 'pending' || (cell(st, c).tone === 'done')).length, 0);

  const toneSx = (tone: string) => ({
    score: { color: 'var(--c-ink)' },
    missing: { color: '#d93025', fontWeight: 600 },
    pending: { color: '#b06000', fontWeight: 600 },
    done: { color: '#188038', fontWeight: 600 },
    none: { color: 'var(--c-ink-tertiary)' },
  } as any)[tone];

  const cellSx = { borderRight: '1px solid var(--c-border)', py: 1, px: 1.5 } as const;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 2 }}>
        <ToggleButtonGroup exclusive size="small" value={view} onChange={(_, v) => v && setView(v)}
          sx={{ '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 600, px: 2, width: { xs: 'auto', sm: 170 }, flex: { xs: 1, sm: 'none' } }, '& .Mui-selected': { color: `${accent} !important` } }}>
          <ToggleButton value="grades">Grades</ToggleButton>
          <ToggleButton value="record">Class record sheet</ToggleButton>
          <ToggleButton value="analysis">Item analysis</ToggleButton>
        </ToggleButtonGroup>
        <Box sx={{ flex: 1 }} />
        {view === 'grades' && (
          <>
            {pendingCount > 0 && (
              <Typography variant="body2" sx={{ color: '#b06000', fontWeight: 600 }}>{pendingCount} to check</Typography>
            )}
            <TextField select size="small" value={sort} onChange={(e) => setSort(e.target.value as any)} sx={{ width: 190 }}>
              <MenuItem value="last">Sort by last name</MenuItem>
              <MenuItem value="first">Sort by first name</MenuItem>
            </TextField>
          </>
        )}
      </Box>

      {view === 'grades' && (
        <Paper elevation={0} sx={{ border: '1px solid var(--c-border)', borderRadius: '10px', overflow: 'hidden' }}>
          {students.length === 0 || cols.length === 0 ? (
            <Box sx={{ p: 5, textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 600 }}>{students.length === 0 ? 'No students yet' : 'Nothing graded yet'}</Typography>
              <Typography variant="body2" sx={{ color: 'var(--c-ink-secondary)', mt: 0.5 }}>
                {students.length === 0
                  ? `Invite students with the class code ${classroom.classCode}.`
                  : 'Quizzes and assignments with points appear here as columns.'}
              </Typography>
            </Box>
          ) : (
            <TableContainer sx={{ maxHeight: '70vh' }}>
              <Table stickyHeader size="small" sx={{ tableLayout: 'fixed', width: '100%', minWidth: 220 + (cols.length + 1) * 150 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ ...cellSx, position: 'sticky', left: 0, zIndex: 3, bgcolor: 'var(--c-surface)', width: 220 }} />
                    <TableCell align="center" sx={{ ...cellSx, bgcolor: 'var(--c-surface)' }}>
                      <Typography variant="caption" sx={{ color: 'var(--c-ink-secondary)' }}>Overall</Typography>
                      <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>Average</Typography>
                    </TableCell>
                    {cols.map((c) => (
                      <TableCell key={c.id} sx={{ ...cellSx, bgcolor: 'var(--c-surface)', verticalAlign: 'top' }}>
                        <Typography variant="caption" sx={{ color: 'var(--c-ink-secondary)' }}>
                          {c.date ? new Date(c.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No date'} · {c.kind === 'exam' ? 'Quiz' : 'Assignment'}
                        </Typography>
                        <Tooltip title={c.title}>
                          <Typography
                            onClick={() => c.kind === 'work' && navigate(`/classroom/${classroom.id}/work/${c.work.id}`)}
                            sx={{ fontWeight: 600, fontSize: '0.85rem', color: accent, cursor: c.kind === 'work' ? 'pointer' : 'default', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                            {c.title}
                          </Typography>
                        </Tooltip>
                        <Typography variant="caption" sx={{ color: 'var(--c-ink-tertiary)' }}>out of {c.outOf}</Typography>
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {/* Class average */}
                  <TableRow sx={{ bgcolor: 'var(--c-surface-sunken)' }}>
                    <TableCell sx={{ ...cellSx, position: 'sticky', left: 0, zIndex: 1, bgcolor: 'var(--c-surface-sunken)', fontWeight: 600 }}>Class average</TableCell>
                    <TableCell align="center" sx={{ ...cellSx, fontWeight: 700 }}>{classAvg === null ? '—' : gradeFor(classAvg, 1).grade}</TableCell>
                    {cols.map((c) => {
                      const avg = colAverage(c);
                      return <TableCell key={c.id} align="center" sx={cellSx}>{avg === null ? '—' : (avg * c.outOf).toFixed(1).replace(/\.0$/, '')}</TableCell>;
                    })}
                  </TableRow>
                  {sortedStudents.map((st) => {
                    const avg = studentAverage(st);
                    const g = avg === null ? null : gradeFor(avg, 1);
                    return (
                      <TableRow key={st.id} hover>
                        <TableCell sx={{ ...cellSx, position: 'sticky', left: 0, zIndex: 1, bgcolor: 'var(--c-surface)' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                            <Avatar src={st.avatar} sx={{ width: 30, height: 30, fontSize: '0.85rem' }}>{st.name?.charAt(0)}</Avatar>
                            <Typography noWrap sx={{ fontSize: '0.88rem' }}>{st.name}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell align="center" sx={{ ...cellSx, fontWeight: 700, color: g ? (g.passed ? '#188038' : '#d93025') : 'var(--c-ink-tertiary)' }}>
                          {g ? g.grade : '—'}
                        </TableCell>
                        {cols.map((c) => {
                          const v = cell(st, c);
                          return (
                            <TableCell key={c.id} align="center" onClick={v.onClick}
                              sx={{ ...cellSx, cursor: v.onClick ? 'pointer' : 'default', '&:hover': v.onClick ? { bgcolor: 'var(--c-surface-sunken)' } : {} }}>
                              <Typography sx={{ fontSize: '0.88rem', ...toneSx(v.tone) }}>{v.text}</Typography>
                              {v.sub && <Typography variant="caption" sx={{ color: 'var(--c-ink-tertiary)' }}>{v.sub}</Typography>}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          <Box sx={{ px: 2, py: 1.25, borderTop: '1px solid var(--c-border)', display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            <Typography variant="caption" sx={{ color: 'var(--c-ink-secondary)' }}>Averages use the 65–100 scale · 75 is passing</Typography>
            <Typography variant="caption" sx={{ color: '#b06000' }}>Needs checking = has short-answer/essay items</Typography>
            <Typography variant="caption" sx={{ color: 'var(--c-ink-secondary)' }}>Click a cell to review or grade it</Typography>
          </Box>
        </Paper>
      )}

      {view === 'record' && <GradeSheet classroom={classroom} students={students} exams={exams} attempts={attempts} />}
      {view === 'analysis' && <ItemAnalysisPanel exams={exams} attempts={attempts} />}
    </Box>
  );
}
