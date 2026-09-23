import { useSearchParams } from 'react-router';
import { Tabs, Tab, Box } from '@mui/material';
import { Style, Psychology, Article, AccountTree, Event, Insights, Timer } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { PageContainer, PageHeader } from '../components/ui-kit';
import { useStudyItems } from '../services/studyStore';
import Flashcards from '../components/study/Flashcards';
import Practice from '../components/study/Practice';
import Summaries from '../components/study/Summaries';
import ConceptMap from '../components/study/ConceptMap';
import Planner from '../components/study/Planner';
import Progress from '../components/study/Progress';
import FocusTimer from '../components/study/FocusTimer';

/** Student study tools, all built from class materials, uploads or a typed topic. */
const TABS = [
  { slug: 'flashcards', label: 'Flashcards', icon: <Style fontSize="small" /> },
  { slug: 'practice', label: 'Practice', icon: <Psychology fontSize="small" /> },
  { slug: 'summaries', label: 'Summaries', icon: <Article fontSize="small" /> },
  { slug: 'concept-map', label: 'Concept map', icon: <AccountTree fontSize="small" /> },
  { slug: 'planner', label: 'Planner', icon: <Event fontSize="small" /> },
  { slug: 'progress', label: 'Progress', icon: <Insights fontSize="small" /> },
  { slug: 'focus', label: 'Focus timer', icon: <Timer fontSize="small" /> },
];

export default function StudyHub() {
  const { currentUser } = useAuth();
  const store = useStudyItems(currentUser?.id);
  const [params, setParams] = useSearchParams();
  const slug = TABS.some((t) => t.slug === params.get('tool')) ? params.get('tool')! : 'flashcards';

  return (
    <PageContainer>
      <PageHeader title="Study Hub" subtitle="Flashcards, practice, summaries and more — made from your class materials, uploads or any topic." />
      <Tabs value={slug} onChange={(_, v) => setParams({ tool: v })} sx={{ mb: 3, borderBottom: '1px solid var(--c-border)' }}>
        {TABS.map((t) => <Tab key={t.slug} value={t.slug} icon={t.icon} iconPosition="start" label={t.label} sx={{ minHeight: 44, textTransform: 'none', fontWeight: 700 }} />)}
      </Tabs>
      <Box key={slug}>
        {slug === 'flashcards' && <Flashcards store={store} />}
        {slug === 'practice' && <Practice store={store} />}
        {slug === 'summaries' && <Summaries store={store} />}
        {slug === 'concept-map' && <ConceptMap store={store} />}
        {slug === 'planner' && <Planner />}
        {slug === 'progress' && <Progress store={store} />}
        {slug === 'focus' && <FocusTimer store={store} />}
      </Box>
    </PageContainer>
  );
}
