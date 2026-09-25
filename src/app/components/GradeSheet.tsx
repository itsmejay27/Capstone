import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Paper, Box, Typography, Button, Table, TableHead, TableRow, TableCell, TableBody, TableContainer,
  TextField, IconButton, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, Chip,
} from '@mui/material';
import { Add, Delete, Download, TableChart } from '@mui/icons-material';
import { fetchGradeSheet, saveGradeSheet } from '../services/supabaseData';
import { gradeFor, isPending } from '../services/grading';
import { useConfirm } from './ConfirmDialog';

/**
 * Class record sheet. Exam columns fill in from the system automatically; the instructor can
 * add their own columns (quizzes on paper, recitation, projects) with a max score and a
 * weight, type scores straight into the cells, and download the sheet as a CSV for Excel.
 */

type Column = { id: string; title: string; max: number; weight: number };
type Sheet = { columns: Column[]; cells: Record<string, Record<string, string>>; examWeight: number };

const EMPTY: Sheet = { columns: [], cells: {}, examWeight: 1 };
const cacheKey = (id: string) => `gradeSheet:${id}`;

export default function GradeSheet({ classroom, students, exams, attempts }: {
  classroom: any; students: any[]; exams: any[]; attempts: any[];
}) {
  const [sheet, setSheet] = useState<Sheet>(() => {
    try { return JSON.parse(localStorage.getItem(cacheKey(classroom.id)) || 'null') || EMPTY; } catch { return EMPTY; }
  });
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'local'>('saved');
  const [adding, setAdding] = useState(false);
  const { confirm, ConfirmHost } = useConfirm();
  const [draft, setDraft] = useState({ title: '', max: '100', weight: '1' });
  const loaded = useRef(false);

  useEffect(() => {
    fetchGradeSheet(classroom.id).then((remote) => {
      if (remote) setSheet({ ...EMPTY, ...remote });
      loaded.current = true;
    });
  }, [classroom.id]);

  // Save a moment after the last edit.
  useEffect(() => {
    try { localStorage.setItem(cacheKey(classroom.id), JSON.stringify(sheet)); } catch { /* quota */ }
    if (!loaded.current) return;
    setSaveState('saving');
    const t = window.setTimeout(async () => {
      setSaveState((await saveGradeSheet(classroom.id, sheet)) ? 'saved' : 'local');
    }, 800);
    return () => window.clearTimeout(t);
  }, [sheet, classroom.id]);

  const setCell = (studentId: string, colId: string, v: string) =>
    setSheet((s) => ({ ...s, cells: { ...s.cells, [studentId]: { ...(s.cells[studentId] || {}), [colId]: v } } }));

  const examScore = (studentId: string, exam: any): number | null => {
    const a = attempts.find((x) => x.examId === exam.id && x.studentId === studentId && x.submittedAt);
    if (!a || isPending(a)) return null;
    return a.score || 0;
  };

  const rows = useMemo(() => students.map((st) => {
    // Every column becomes a percentage, then a weighted average of the percentages.
    const parts: { pct: number; weight: number }[] = [];
    exams.forEach((e) => {
      const sc = examScore(st.id, e);
      if (sc !== null && e.totalPoints > 0) parts.push({ pct: sc / e.totalPoints, weight: sheet.examWeight || 1 });
    });
    sheet.columns.forEach((c) => {
      const raw = sheet.cells[st.id]?.[c.id];
      if (raw !== undefined && raw !== '' && !Number.isNaN(Number(raw)) && c.max > 0) {
        parts.push({ pct: Math.min(1, Number(raw) / c.max), weight: c.weight || 1 });
      }
    });
    const w = parts.reduce((a, p) => a + p.weight, 0);
    const avg = w > 0 ? parts.reduce((a, p) => a + p.pct * p.weight, 0) / w : null;
    return { st, final: avg === null ? null : gradeFor(avg, 1) };
  }), [students, exams, attempts, sheet]);

  const addColumn = () => {
    const title = draft.title.trim();
    if (!title) return;
    setSheet((s) => ({ ...s, columns: [...s.columns, { id: crypto.randomUUID(), title, max: Math.max(1, Number(draft.max) || 100), weight: Math.max(0, Number(draft.weight) || 1) }] }));
    setDraft({ title: '', max: '100', weight: '1' });
    setAdding(false);
  };

  const removeColumn = async (id: string) => {
    if (!(await confirm({ title: 'Remove this column?', message: 'Its scores will be deleted too.', confirmLabel: 'Remove', tone: 'danger' }))) return;
    setSheet((s) => ({ ...s, columns: s.columns.filter((c) => c.id !== id) }));
  };

  const downloadCsv = () => {
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const head = ['Student', 'Email', ...exams.map((e) => `${e.title} (/${e.totalPoints})`), ...sheet.columns.map((c) => `${c.title} (/${c.max})`), 'Final grade', 'Remark'];
    const lines = rows.map(({ st, final }) => [
      st.name, st.email,
      ...exams.map((e) => { const s = examScore(st.id, e); return s === null ? '' : s; }),
      ...sheet.columns.map((c) => sheet.cells[st.id]?.[c.id] ?? ''),
      final ? final.grade : '', final ? final.remark : '',
    ]);
    const csv = [head, ...lines].map((r) => r.map(esc).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${classroom.name || 'class'} - class record.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const cellSx = { fontSize: '0.8rem', whiteSpace: 'nowrap' } as const;

  return (
    <Paper elevation={0} sx={{ mt: 3, borderRadius: 3, border: '1px solid var(--c-slate-200)', bgcolor: 'var(--c-surface)', overflow: 'hidden' }}>
      <Box sx={{ p: { xs: 2, sm: 3 }, borderBottom: '1px solid var(--c-slate-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
        <Box>
          <Typography variant="h6" fontWeight={900} sx={{ color: 'var(--c-slate-900)', display: 'flex', alignItems: 'center', gap: 1 }}>
            <TableChart /> Class Record Sheet
          </Typography>
          <Typography variant="caption" sx={{ color: 'var(--c-slate-500)' }}>
            Exam scores fill in automatically. Add your own columns and type scores in. {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'All changes saved.' : 'Saved on this device only.'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField size="small" type="number" label="Exam weight" value={sheet.examWeight}
            onChange={(e) => setSheet((s) => ({ ...s, examWeight: Math.max(0, Number(e.target.value) || 0) }))} sx={{ width: 120 }} />
          <Button startIcon={<Add />} variant="outlined" onClick={() => setAdding(true)} sx={{ textTransform: 'none', fontWeight: 700 }}>Add column</Button>
          <Button startIcon={<Download />} variant="contained" onClick={downloadCsv} sx={{ textTransform: 'none', fontWeight: 700 }}>Download (Excel CSV)</Button>
        </Box>
      </Box>
      <TableContainer sx={{ overflowX: 'auto' }}>
        <Table size="small" sx={{ tableLayout: 'fixed', width: '100%', minWidth: { xs: 140 + (exams.length + sheet.columns.length + 1) * 110, sm: 220 + (exams.length + sheet.columns.length + 1) * 150 } }}>
          <TableHead sx={{ bgcolor: 'var(--c-slate-50)' }}>
            <TableRow>
              <TableCell sx={{ ...cellSx, width: { xs: 140, sm: 220 }, fontWeight: 800, position: 'sticky', left: 0, bgcolor: 'var(--c-slate-50)', zIndex: 1 }}>Student</TableCell>
              {exams.map((e) => (
                <TableCell key={e.id} align="center" sx={{ ...cellSx, fontWeight: 800, whiteSpace: 'normal', verticalAlign: 'top' }}><Box sx={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }} title={e.title}>{e.title}</Box><br /><Typography variant="caption">/{e.totalPoints} · exam</Typography></TableCell>
              ))}
              {sheet.columns.map((c) => (
                <TableCell key={c.id} align="center" sx={{ ...cellSx, fontWeight: 800, whiteSpace: 'normal', verticalAlign: 'top' }}>
                  {c.title}
                  <Tooltip title="Remove column"><IconButton size="small" onClick={() => removeColumn(c.id)}><Delete sx={{ fontSize: 14 }} /></IconButton></Tooltip>
                  <br /><Typography variant="caption">/{c.max} · weight {c.weight}</Typography>
                </TableCell>
              ))}
              <TableCell align="center" sx={{ ...cellSx, fontWeight: 900, verticalAlign: 'top' }}>Final grade</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={exams.length + sheet.columns.length + 2} align="center" sx={{ py: 3, color: 'var(--c-slate-500)' }}>No enrolled students yet.</TableCell></TableRow>
            )}
            {rows.map(({ st, final }) => (
              <TableRow key={st.id} hover>
                <TableCell sx={{ ...cellSx, fontWeight: 700, position: 'sticky', left: 0, bgcolor: 'var(--c-surface)', zIndex: 1 }}><Box component="span" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{st.name}</Box></TableCell>
                {exams.map((e) => {
                  const sc = examScore(st.id, e);
                  const pending = attempts.some((x) => x.examId === e.id && x.studentId === st.id && x.submittedAt && isPending(x));
                  return <TableCell key={e.id} align="center" sx={cellSx}>{pending ? <Chip size="small" label="to check" /> : sc === null ? '—' : sc}</TableCell>;
                })}
                {sheet.columns.map((c) => (
                  <TableCell key={c.id} align="center" sx={{ ...cellSx, p: 0.5 }}>
                    <TextField
                      size="small" variant="standard"
                      value={sheet.cells[st.id]?.[c.id] ?? ''}
                      onChange={(e) => setCell(st.id, c.id, e.target.value.replace(/[^\d.]/g, ''))}
                      inputProps={{ inputMode: 'decimal', style: { textAlign: 'center', width: 56 }, 'aria-label': `${st.name} ${c.title}` }}
                    />
                  </TableCell>
                ))}
                <TableCell align="center" sx={cellSx}>
                  {final ? <Chip size="small" label={`${final.grade} · ${final.remark}`} sx={{ bgcolor: final.bg, color: final.color, fontWeight: 800 }} /> : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {ConfirmHost}
      <Dialog open={adding} onClose={() => setAdding(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Add a column</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
          <TextField autoFocus label="Title (e.g. Quiz 1, Recitation)" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          <TextField type="number" label="Highest possible score" value={draft.max} onChange={(e) => setDraft({ ...draft, max: e.target.value })} />
          <TextField type="number" label="Weight" helperText="How much this counts compared to other columns (1 = normal)" value={draft.weight} onChange={(e) => setDraft({ ...draft, weight: e.target.value })} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdding(false)}>Cancel</Button>
          <Button variant="contained" onClick={addColumn}>Add</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
