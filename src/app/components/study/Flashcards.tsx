import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Paper, Typography, Button, LinearProgress, Chip, IconButton, Alert, CircularProgress } from '@mui/material';
import { Style, Delete, ArrowBack, AutoAwesome, Replay } from '@mui/icons-material';
import SourcePicker, { useSourcePicker } from './SourcePicker';
import StudyOptions, { useStudyOptions, countField, DIFFICULTY, LANGUAGE, difficultyRule } from './StudyOptions';

const CARD_STYLE = {
  key: 'style', label: 'Card style',
  choices: [
    { value: 'qa', label: 'Question → answer' },
    { value: 'term', label: 'Term → definition' },
    { value: 'cloze', label: 'Fill in the blank' },
    { value: 'mixed', label: 'Mixed' },
  ],
};
const STYLE_RULE: Record<string, string> = {
  qa: 'Front is a question; back is the answer.',
  term: 'Front is a key term or concept; back is its definition in plain words.',
  cloze: 'Front is a sentence with one key word replaced by "____"; back is the missing word plus a short note.',
  mixed: 'Mix question→answer, term→definition and fill-in-the-blank cards.',
};
import { generateStudyJson } from '../../services/geminiService';
import { newCard, review, isDue, retention, type SrsCard, type Grade } from '../../services/srs';
import { newId, logStudySession, type useStudyItems } from '../../services/studyStore';

type Store = ReturnType<typeof useStudyItems>;
interface Deck { cards: SrsCard[]; source: string }

export default function Flashcards({ store }: { store: Store }) {
  const picker = useSourcePicker();
  const opts = useStudyOptions([countField('Number of cards', [10, 15, 20, 30, 40, 50]), DIFFICULTY, CARD_STYLE, LANGUAGE], { count: '20', difficulty: 'medium', style: 'qa', language: 'English' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const decks = store.ofKind<Deck>('deck');
  const open = decks.find((d) => d.id === openId);

  const create = async () => {
    setError(''); setBusy(true);
    try {
      const src = await picker.resolve();
      const out = await generateStudyJson(
        'You write concise, accurate study flashcards. Back: a short, correct answer (max 2 sentences). No trivia about document headers. Cover the material evenly and never repeat a card.',
        `Create exactly ${opts.values.count} flashcards for "${src.label}".
${STYLE_RULE[opts.values.style] || ''}
${difficultyRule(opts.values.difficulty)}
Write every card in ${opts.values.language}.${src.text ? `\nUse ONLY this material:\n---\n${src.text}\n---` : ''}
Respond as JSON: {"cards":[{"front":"...","back":"...","topic":"short subtopic"}]}`
      );
      const cards: SrsCard[] = (out.cards || []).filter((c: any) => c.front && c.back)
        .map((c: any, i: number) => newCard(`c${i}-${Date.now()}`, String(c.front), String(c.back), c.topic ? String(c.topic) : undefined));
      if (!cards.length) throw new Error('The AI returned no cards. Try a more specific topic or a different material.');
      const saved = store.save({ id: newId('deck'), kind: 'deck', title: src.label, data: { cards, source: src.label, settings: opts.label() } });
      if (saved) setOpenId(saved.id);
    } catch (e: any) { setError(e.message || String(e)); }
    setBusy(false);
  };

  if (open) return <StudyDeck deck={open} onBack={() => setOpenId(null)} store={store} />;

  return (
    <Box>
      <Paper sx={{ p: 2.5, mb: 3, borderRadius: '16px' }}>
        <Typography sx={{ fontWeight: 800, mb: 1.5 }}>New flashcard deck</Typography>
        <SourcePicker picker={picker} />
        <StudyOptions opts={opts} />
        {error && <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>}
        <Button variant="contained" startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <AutoAwesome />} disabled={!picker.ready || busy} onClick={create} sx={{ mt: 1.5 }}>
          {busy ? 'Making cards…' : `Generate ${opts.values.count} cards`}
        </Button>
      </Paper>

      {decks.length === 0 ? (
        <Typography sx={{ color: 'var(--c-ink-tertiary)' }}>No decks yet. Generate one from a class material, a file or a topic.</Typography>
      ) : (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' } }}>
          {decks.map((d) => {
            const due = d.data.cards.filter((c) => isDue(c)).length;
            return (
              <Paper key={d.id} onClick={() => setOpenId(d.id)} sx={{ p: 2, borderRadius: '14px', cursor: 'pointer', '&:hover': { borderColor: 'var(--c-emerald-200)' } }} variant="outlined">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Style sx={{ color: 'var(--c-emerald-600)' }} />
                  <Typography sx={{ fontWeight: 800, flex: 1, minWidth: 0 }} noWrap title={d.title}>{d.title}</Typography>
                  <IconButton size="small" aria-label="Delete deck" onClick={(e) => { e.stopPropagation(); store.remove(d.id); }}><Delete fontSize="small" /></IconButton>
                </Box>
                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                  <Chip size="small" label={`${d.data.cards.length} cards`} />
                  <Chip size="small" color={due ? 'primary' : 'default'} label={due ? `${due} due now` : 'All caught up'} />
                  <Chip size="small" label={`${Math.round(retention(d.data.cards) * 100)}% learned`} />
                </Box>
                {(d.data as any).settings && <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'var(--c-ink-tertiary)' }}>{(d.data as any).settings}</Typography>}
              </Paper>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

function StudyDeck({ deck, onBack, store }: { deck: any; onBack: () => void; store: Store }) {
  const [cards, setCards] = useState<SrsCard[]>(deck.data.cards);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [studyAll, setStudyAll] = useState(false);
  const started = useRef(Date.now());

  const queue = useMemo(() => {
    const due = cards.filter((c) => isDue(c)).sort((a, b) => a.due.localeCompare(b.due));
    return studyAll && due.length === 0 ? [...cards].sort((a, b) => a.reps - b.reps) : due;
  }, [cards, studyAll]);
  const card = queue[0];

  // Log the time spent when leaving the deck.
  useEffect(() => () => logStudySession(store.save, (Date.now() - started.current) / 60000, `Flashcards: ${deck.title}`), []); // eslint-disable-line

  const grade = (g: Grade) => {
    if (!card) return;
    const next = cards.map((c) => (c.id === card.id ? review(c, g) : c));
    setCards(next); setFlipped(false); setReviewed((n) => n + 1);
    store.save({ ...deck, data: { ...deck.data, cards: next } });
  };

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={onBack} sx={{ mb: 2, textTransform: 'none' }}>All decks</Button>
      <Typography variant="h6" sx={{ fontWeight: 800 }}>{deck.title}</Typography>
      <Typography variant="body2" sx={{ color: 'var(--c-ink-secondary)', mb: 2 }}>
        {queue.length} to review · {reviewed} reviewed this session · {Math.round(retention(cards) * 100)}% learned
      </Typography>
      <LinearProgress variant="determinate" value={retention(cards) * 100} sx={{ mb: 3, height: 6, borderRadius: 3 }} />

      {!card ? (
        <Paper sx={{ p: 5, textAlign: 'center', borderRadius: '18px' }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>All caught up 🎉</Typography>
          <Typography sx={{ color: 'var(--c-ink-secondary)', mb: 2 }}>Cards come back when they are due. Missed cards return sooner.</Typography>
          <Button startIcon={<Replay />} onClick={() => setStudyAll(true)}>Study all cards anyway</Button>
        </Paper>
      ) : (
        <>
          <Box onClick={() => setFlipped((f) => !f)} sx={{ perspective: '1200px', cursor: 'pointer', mb: 2 }}>
            <Box sx={{
              position: 'relative', minHeight: 240, transformStyle: 'preserve-3d', transition: 'transform .5s cubic-bezier(.2,.8,.2,1)',
              transform: flipped ? 'rotateY(180deg)' : 'none',
            }}>
              {[false, true].map((back) => (
                <Paper key={String(back)} sx={{
                  position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: back ? 'rotateY(180deg)' : 'none',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 4, textAlign: 'center', borderRadius: '20px',
                  backgroundImage: 'radial-gradient(120% 80% at 50% -20%, var(--glow-a), transparent 60%)', border: '1px solid var(--c-border-strong)',
                }}>
                  <Typography variant="overline" sx={{ color: 'var(--c-ink-tertiary)' }}>{back ? 'Answer' : card.topic || 'Question'}</Typography>
                  <Typography sx={{ fontSize: back ? '1.05rem' : '1.3rem', fontWeight: back ? 500 : 800, mt: 1 }}>{back ? card.back : card.front}</Typography>
                  {!back && <Typography variant="caption" sx={{ mt: 2, color: 'var(--c-ink-tertiary)' }}>Tap to flip</Typography>}
                </Paper>
              ))}
            </Box>
          </Box>
          {flipped && (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
              {([['again', 'Again', '<1m', 'error'], ['hard', 'Hard', '', 'warning'], ['good', 'Good', '', 'primary'], ['easy', 'Easy', '', 'success']] as const).map(([g, l, hint, color]) => (
                <Button key={g} variant="outlined" color={color as any} onClick={() => grade(g)} sx={{ py: 1.2, flexDirection: 'column', borderRadius: '12px' }}>
                  <b>{l}</b>
                  <Typography variant="caption">{hint || `${Math.max(1, review(card, g).interval)}d`}</Typography>
                </Button>
              ))}
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
