import { useState } from 'react';
import { Box, Paper, Typography, Button, Alert, CircularProgress, IconButton, TextField, Chip } from '@mui/material';
import { Article, ArrowBack, AutoAwesome, Delete } from '@mui/icons-material';
import SourcePicker, { useSourcePicker } from './SourcePicker';
import StudyOptions, { useStudyOptions, LANGUAGE } from './StudyOptions';

const LENGTH = { key: 'length', label: 'Length', choices: [
  { value: 'short', label: 'Short (quick review)' }, { value: 'standard', label: 'Standard (one page)' }, { value: 'detailed', label: 'Detailed' },
] };
const LEVEL = { key: 'level', label: 'Reading level', choices: [
  { value: 'simple', label: 'Simple words' }, { value: 'college', label: 'College level' }, { value: 'technical', label: 'Technical' },
] };
const LENGTH_RULE: Record<string, string> = {
  short: '(overview 2 sentences, 5-7 key points, 6-10 terms)',
  standard: '(overview 2-4 sentences, 8-12 key points, 10-20 terms)',
  detailed: '(overview 4-6 sentences, 12-20 key points, 15-30 terms, each key point may have one example)',
};
import { generateStudyJson } from '../../services/geminiService';
import { newId, type useStudyItems } from '../../services/studyStore';

type Store = ReturnType<typeof useStudyItems>;
interface Summary { overview: string; keyPoints: string[]; terms: { term: string; definition: string }[] }

export default function Summaries({ store }: { store: Store }) {
  const picker = useSourcePicker();
  const opts = useStudyOptions([LENGTH, LEVEL, LANGUAGE], { length: 'standard', level: 'college', language: 'English' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const items = store.ofKind<Summary>('summary');
  const open = items.find((i) => i.id === openId);

  const create = async () => {
    setError(''); setBusy(true);
    try {
      const src = await picker.resolve();
      const out = await generateStudyJson(
        'You write one-page study summaries: a short overview, the key points a student must remember, and a glossary of key terms with plain-language definitions. Be accurate and concise.',
        `Summarise "${src.label}".${src.text ? `\nUse ONLY this material:\n---\n${src.text}\n---` : ''}
Write at a ${opts.values.level} reading level, in ${opts.values.language}.
Respond as JSON: {"overview":"...","keyPoints":["..."],"terms":[{"term":"...","definition":"..."}]}  ${LENGTH_RULE[opts.values.length] || ''}`
      );
      const data: Summary = { overview: String(out.overview || ''), keyPoints: (out.keyPoints || []).map(String), terms: (out.terms || []).filter((t: any) => t.term).map((t: any) => ({ term: String(t.term), definition: String(t.definition || '') })) };
      if (!data.overview && !data.keyPoints.length) throw new Error('The AI returned an empty summary. Try again.');
      const saved = store.save({ id: newId('sum'), kind: 'summary', title: src.label, data });
      if (saved) setOpenId(saved.id);
    } catch (e: any) { setError(e.message || String(e)); }
    setBusy(false);
  };

  if (open) {
    const terms = open.data.terms.filter((t) => !filter || `${t.term} ${t.definition}`.toLowerCase().includes(filter.toLowerCase()));
    return (
      <Box>
        <Button startIcon={<ArrowBack />} onClick={() => setOpenId(null)} sx={{ mb: 2, textTransform: 'none' }}>All summaries</Button>
        <Paper sx={{ p: { xs: 2.5, md: 4 }, borderRadius: '18px', maxWidth: 860 }}>
          <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>{open.title}</Typography>
          <Typography sx={{ color: 'var(--c-ink-secondary)', lineHeight: 1.75, mb: 2.5 }}>{open.data.overview}</Typography>
          <Typography sx={{ fontWeight: 800, mb: 1 }}>Key points</Typography>
          <Box component="ul" sx={{ pl: 3, mt: 0, mb: 3, '& li': { mb: 0.75, lineHeight: 1.6 } }}>
            {open.data.keyPoints.map((p, i) => <li key={i}>{p}</li>)}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 1, flexWrap: 'wrap' }}>
            <Typography sx={{ fontWeight: 800 }}>Glossary <Chip size="small" label={open.data.terms.length} /></Typography>
            <TextField size="small" placeholder="Find a term…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          </Box>
          <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
            {terms.map((t) => (
              <Paper key={t.term} variant="outlined" sx={{ p: 1.5, borderRadius: '12px' }}>
                <Typography sx={{ fontWeight: 800, color: 'var(--c-emerald-600)' }}>{t.term}</Typography>
                <Typography variant="body2" sx={{ color: 'var(--c-ink-secondary)' }}>{t.definition}</Typography>
              </Paper>
            ))}
          </Box>
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      <Paper sx={{ p: 2.5, mb: 3, borderRadius: '16px' }}>
        <Typography sx={{ fontWeight: 800, mb: 1.5 }}>New summary &amp; glossary</Typography>
        <SourcePicker picker={picker} />
        <StudyOptions opts={opts} />
        {error && <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>}
        <Button variant="contained" startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <AutoAwesome />} disabled={!picker.ready || busy} onClick={create} sx={{ mt: 1.5 }}>
          {busy ? 'Summarising…' : 'Summarise'}
        </Button>
      </Paper>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' } }}>
        {items.map((i) => (
          <Paper key={i.id} variant="outlined" onClick={() => setOpenId(i.id)} sx={{ p: 2, borderRadius: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1 }}>
            <Article sx={{ color: 'var(--c-emerald-600)' }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 800 }} noWrap>{i.title}</Typography>
              <Typography variant="caption" sx={{ color: 'var(--c-ink-tertiary)' }}>{i.data.keyPoints.length} key points · {i.data.terms.length} terms</Typography>
            </Box>
            <IconButton size="small" aria-label="Delete summary" onClick={(e) => { e.stopPropagation(); store.remove(i.id); }}><Delete fontSize="small" /></IconButton>
          </Paper>
        ))}
      </Box>
    </Box>
  );
}
