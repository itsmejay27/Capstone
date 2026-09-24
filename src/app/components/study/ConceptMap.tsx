import { useMemo, useState } from 'react';
import { Box, Paper, Typography, Button, Alert, CircularProgress, IconButton } from '@mui/material';
import { AccountTree, ArrowBack, AutoAwesome, Delete } from '@mui/icons-material';
import SourcePicker, { useSourcePicker } from './SourcePicker';
import StudyOptions, { useStudyOptions, LANGUAGE } from './StudyOptions';

const SIZE = { key: 'size', label: 'Map size', choices: [
  { value: '4', label: 'Small (4 branches)' }, { value: '5', label: 'Medium (5 branches)' }, { value: '7', label: 'Large (7 branches)' },
] };
const DEPTH = { key: 'depth', label: 'Details per branch', choices: [
  { value: '2', label: '2 sub-ideas' }, { value: '3', label: '3 sub-ideas' }, { value: '4', label: '4 sub-ideas' },
] };
import { generateStudyJson } from '../../services/geminiService';
import { newId, type useStudyItems } from '../../services/studyStore';

type Store = ReturnType<typeof useStudyItems>;
interface MapData { center: string; branches: { label: string; note?: string; children: { label: string; note?: string }[] }[] }

export default function ConceptMap({ store }: { store: Store }) {
  const picker = useSourcePicker();
  const opts = useStudyOptions([SIZE, DEPTH, LANGUAGE], { size: '5', depth: '3', language: 'English' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const maps = store.ofKind<MapData>('map');
  const open = maps.find((m) => m.id === openId);

  const create = async () => {
    setError(''); setBusy(true);
    try {
      const src = await picker.resolve();
      const out = await generateStudyJson(
        'You build concept maps for studying: a central idea, main branches, and specific sub-ideas per branch, each with a one-line note explaining the connection.',
        `Concept map for "${src.label}" with exactly ${opts.values.size} main branches and ${opts.values.depth} sub-ideas per branch, written in ${opts.values.language}.${src.text ? `\nUse ONLY this material:\n---\n${src.text}\n---` : ''}
Respond as JSON: {"center":"...","branches":[{"label":"...","note":"...","children":[{"label":"...","note":"..."}]}]}  (short labels, max 5 words)`
      );
      const data: MapData = {
        center: String(out.center || src.label),
        branches: (out.branches || []).slice(0, 7).map((b: any) => ({ label: String(b.label || ''), note: b.note ? String(b.note) : '', children: (b.children || []).slice(0, 4).map((c: any) => ({ label: String(c.label || ''), note: c.note ? String(c.note) : '' })) })).filter((b: any) => b.label),
      };
      if (!data.branches.length) throw new Error('The AI returned an empty map. Try again.');
      const saved = store.save({ id: newId('map'), kind: 'map', title: src.label, data });
      if (saved) setOpenId(saved.id);
    } catch (e: any) { setError(e.message || String(e)); }
    setBusy(false);
  };

  if (open) return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => setOpenId(null)} sx={{ mb: 2, textTransform: 'none' }}>All concept maps</Button>
      <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>{open.title}</Typography>
      <MapView data={open.data} />
    </Box>
  );

  return (
    <Box>
      <Paper sx={{ p: 2.5, mb: 3, borderRadius: '16px' }}>
        <Typography sx={{ fontWeight: 800, mb: 1.5 }}>New concept map</Typography>
        <SourcePicker picker={picker} />
        <StudyOptions opts={opts} />
        {error && <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>}
        <Button variant="contained" startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <AutoAwesome />} disabled={!picker.ready || busy} onClick={create} sx={{ mt: 1.5 }}>
          {busy ? 'Mapping…' : 'Build concept map'}
        </Button>
      </Paper>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' } }}>
        {maps.map((m) => (
          <Paper key={m.id} variant="outlined" onClick={() => setOpenId(m.id)} sx={{ p: 2, borderRadius: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1 }}>
            <AccountTree sx={{ color: 'var(--c-emerald-600)' }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 800 }} noWrap>{m.title}</Typography>
              <Typography variant="caption" sx={{ color: 'var(--c-ink-tertiary)' }}>{m.data.branches.length} branches</Typography>
            </Box>
            <IconButton size="small" aria-label="Delete map" onClick={(e) => { e.stopPropagation(); store.remove(m.id); }}><Delete fontSize="small" /></IconButton>
          </Paper>
        ))}
      </Box>
    </Box>
  );
}

const COLORS = ['#0ea5c6', '#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444'];

/** Radial layout: centre, branches on an inner ring, sub-ideas fanned around each branch. */
function MapView({ data }: { data: MapData }) {
  const [hover, setHover] = useState<string>('');
  const W = 1000, H = 720, cx = W / 2, cy = H / 2, r1 = 190, r2 = 320;
  const layout = useMemo(() => {
    const n = data.branches.length;
    return data.branches.map((b, i) => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      const bx = cx + Math.cos(a) * r1, by = cy + Math.sin(a) * r1;
      const spread = Math.min(Math.PI / n, 0.55);
      const kids = b.children.map((c, j) => {
        const ka = a + (b.children.length > 1 ? (j / (b.children.length - 1) - 0.5) * spread * 2 : 0);
        return { ...c, x: cx + Math.cos(ka) * r2, y: cy + Math.sin(ka) * r2 };
      });
      return { ...b, x: bx, y: by, color: COLORS[i % COLORS.length], kids };
    });
  }, [data]);

  const wrap = (t: string, max = 16) => {
    const words = t.split(' '); const lines: string[] = []; let cur = '';
    words.forEach((w) => { if ((cur + ' ' + w).trim().length > max) { if (cur) lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); });
    if (cur) lines.push(cur); return lines.slice(0, 3);
  };

  return (
    <Paper sx={{ p: 1, borderRadius: '18px', overflow: 'auto', backgroundImage: 'radial-gradient(60% 60% at 50% 50%, var(--glow-a), transparent 70%)' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: 640, height: 'auto', display: 'block' }} role="img" aria-label={`Concept map of ${data.center}`}>
        {layout.map((b) => (
          <g key={b.label}>
            <line x1={cx} y1={cy} x2={b.x} y2={b.y} stroke={b.color} strokeWidth={3} opacity={0.55} />
            {b.kids.map((k) => <line key={k.label} x1={b.x} y1={b.y} x2={k.x} y2={k.y} stroke={b.color} strokeWidth={1.5} opacity={0.4} strokeDasharray="4 4" />)}
          </g>
        ))}
        {layout.map((b) => (
          <g key={`n-${b.label}`}>
            {b.kids.map((k) => (
              <g key={k.label} onMouseEnter={() => setHover(k.note || k.label)} onMouseLeave={() => setHover('')} style={{ cursor: 'default' }}>
                <rect x={k.x - 70} y={k.y - 22} width={140} height={44} rx={12} fill="var(--c-surface)" stroke={b.color} strokeWidth={1.5} />
                {wrap(k.label).map((l, i, arr) => <text key={i} x={k.x} y={k.y + (i - (arr.length - 1) / 2) * 13 + 4} textAnchor="middle" fontSize={11.5} fill="var(--c-ink)">{l}</text>)}
              </g>
            ))}
            <g onMouseEnter={() => setHover(b.note || b.label)} onMouseLeave={() => setHover('')}>
              <rect x={b.x - 80} y={b.y - 26} width={160} height={52} rx={14} fill={b.color} opacity={0.95} />
              {wrap(b.label).map((l, i, arr) => <text key={i} x={b.x} y={b.y + (i - (arr.length - 1) / 2) * 14 + 5} textAnchor="middle" fontSize={13} fontWeight={700} fill="#fff">{l}</text>)}
            </g>
          </g>
        ))}
        <circle cx={cx} cy={cy} r={70} fill="url(#cm-center)" />
        <defs><radialGradient id="cm-center"><stop offset="0%" stopColor="#38bdf8" /><stop offset="100%" stopColor="#2563eb" /></radialGradient></defs>
        {wrap(data.center, 14).map((l, i, arr) => <text key={i} x={cx} y={cy + (i - (arr.length - 1) / 2) * 16 + 5} textAnchor="middle" fontSize={15} fontWeight={800} fill="#fff">{l}</text>)}
      </svg>
      <Typography variant="body2" sx={{ minHeight: 24, px: 2, pb: 1, color: 'var(--c-ink-secondary)' }}>{hover || 'Hover a node to see how it connects.'}</Typography>
    </Paper>
  );
}
