import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import {
  Container, Paper, Typography, Box, Button, Grid, Card, CardContent,
  CardActions, Chip, LinearProgress, Alert, IconButton, Tooltip, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, Radio, RadioGroup,
  FormControlLabel, FormControl, Divider, CardActionArea,
} from '@mui/material';
import {
  ArrowBack, AutoAwesome, PlayArrow, Delete, School, CheckCircle,
  Lock, MenuBook, Quiz as QuizIcon, EmojiEvents, Replay, ArrowForward,
  Cancel, HelpOutline, SwapHoriz,
} from '@mui/icons-material';

const PASS_THRESHOLD = 0.8; // 80%

type Phase = 'list' | 'modules' | 'lesson' | 'quiz' | 'result' | 'flashcards';

export default function Reviewer() {
  const { reviewers, deleteReviewer, updateReviewer } = useAuth();
  const navigate = useNavigate();

  // Repository state
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Session state
  const [activeReviewer, setActiveReviewer] = useState<any | null>(null);
  const [moduleIdx, setModuleIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>('list');

  // Flashcards state
  const [flashcardIdx, setFlashcardIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Quiz state
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [showExplanations, setShowExplanations] = useState(false);

  const filteredReviewers = reviewers.filter((r) =>
    r.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.subject?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openReviewer = (rev: any) => {
    let normalized = { ...rev };

    // If reviewer has no modules array or modules is empty, auto-wrap questions into a single study module
    if (!normalized.modules || !Array.isArray(normalized.modules) || normalized.modules.length === 0) {
      const qList = normalized.questions || [
        {
          id: `q-norm-1`,
          type: 'multiple-choice',
          question: `Sample Question for ${normalized.subject || 'Subject'}`,
          options: ['Core Concept A', 'Option B', 'Option C', 'Option D'],
          correctAnswer: 0,
          explanation: `Fundamental rule governing ${normalized.subject || 'Subject'}.`,
        }
      ];

      normalized.modules = [
        {
          id: `mod-norm-1`,
          number: 1,
          title: `Direct Quiz & Study Guide`,
          topic: normalized.subject || 'General Subject',
          lessonContent: `### Study Guide: ${normalized.title}\n\nKey Concepts for **${normalized.subject}**:\n- Review all ${qList.length} assessment items.\n- Practice flashcards and test your mastery with the interactive quiz below.`,
          questions: qList,
          status: 'unlocked',
          bestScore: null,
          attempts: 0,
        }
      ];
    }

    setActiveReviewer(normalized);
    setModuleIdx(0);
    setPhase('modules');
    setAnswers({});
    setQuizScore(null);
    setShowExplanations(false);
  };

  const startQuiz = () => {
    setAnswers({});
    setQuizScore(null);
    setShowExplanations(false);
    setPhase('quiz');
  };

  const submitQuiz = () => {
    const module = activeReviewer.modules[moduleIdx];
    const questions = module.questions;
    let correct = 0;

    questions.forEach((q: any) => {
      const ans = answers[q.id];
      if (q.type === 'true-false') {
        if (String(ans).toLowerCase() === String(q.correctAnswer).toLowerCase()) correct++;
      } else if (q.type === 'multiple-choice') {
        if (ans === q.correctAnswer) correct++;
      } else if (q.type === 'identification') {
        const studentAns = String(ans || '').toLowerCase().trim();
        const keyAns = String(q.correctAnswer).toLowerCase().trim();
        if (studentAns && (studentAns.includes(keyAns) || keyAns.includes(studentAns))) correct++;
      }
    });

    const score = correct;
    const total = questions.length;
    const passed = true; // No locks or 80% blockages
    setQuizScore(score);
    setShowExplanations(true);

    const updatedModules = activeReviewer.modules.map((m: any, i: number) => {
      if (i === moduleIdx) {
        return {
          ...m,
          attempts: (m.attempts || 0) + 1,
          bestScore: m.bestScore === null ? score : Math.max(m.bestScore, score),
          status: 'passed', // Always mark passed
        };
      }
      return m;
    });

    const allPassed = updatedModules.every((m: any) => m.status === 'passed');

    const updatedReviewer = {
      ...activeReviewer,
      modules: updatedModules,
      currentModuleIndex: Math.min(moduleIdx + 1, updatedModules.length - 1),
      status: allPassed ? 'completed' : 'in-progress',
      ...(allPassed && { completedAt: new Date().toISOString() }),
    };

    setActiveReviewer(updatedReviewer);
    updateReviewer(updatedReviewer);
    setPhase('result');
  };

  const goToNextModule = () => {
    const next = moduleIdx + 1;
    if (next < activeReviewer.modules.length) {
      setModuleIdx(next);
      setAnswers({});
      setQuizScore(null);
      setShowExplanations(false);
      setPhase('lesson');
    }
  };

  const retryQuiz = () => {
    setAnswers({});
    setQuizScore(null);
    setShowExplanations(false);
    setPhase('lesson');
  };

  const exitModuleSession = () => {
    setAnswers({});
    setQuizScore(null);
    setShowExplanations(false);
    setPhase('modules');
  };

  const exitSession = () => {
    setActiveReviewer(null);
    setPhase('list');
    setAnswers({});
    setQuizScore(null);
    setShowExplanations(false);
  };

  const currentModule = activeReviewer?.modules?.[moduleIdx];
  const totalModules = activeReviewer?.modules?.length ?? 0;
  const passedCount = activeReviewer?.modules?.filter((m: any) => m.status === 'passed').length ?? 0;
  const totalQ = currentModule?.questions?.length ?? 0;
  const passRequired = Math.ceil(totalQ * PASS_THRESHOLD);

  const diffColor: Record<string, any> = {
    easy: { bg: '#dcfce7', color: '#16a34a', border: '#86efac' },
    normal: { bg: '#fef9c3', color: '#ca8a04', border: '#fde047' },
    hard: { bg: '#fee2e2', color: '#dc2626', border: '#fca5a5' },
  };

  // ══════════════════════════════════════════
  // REPOSITORY LIST VIEW
  // ══════════════════════════════════════════
  if (phase === 'list') {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/dashboard')} sx={{ mb: 3 }}>
          Back to Dashboard
        </Button>

        {/* Header */}
        <Paper sx={{ mb: 4, borderRadius: 4, overflow: 'hidden', boxShadow: '0 8px 30px rgba(3,105,161,0.12)' }}>
          <Box sx={{ background: 'linear-gradient(135deg, #0369a1 0%, #0ea5e9 100%)', p: { xs: 3, md: 4 }, color: 'white' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ width: 56, height: 56, borderRadius: 3, background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <School sx={{ fontSize: 30 }} />
                </Box>
                <Box>
                  <Typography variant="h5" fontWeight="bold" sx={{ letterSpacing: '-0.01em' }}>My AI Reviewers</Typography>
                  <Typography variant="body2" sx={{ opacity: 0.85 }}>
                    Select and review any module freely. Locked filters have been removed.
                  </Typography>
                </Box>
              </Box>
              <Button
                variant="contained"
                startIcon={<AutoAwesome />}
                onClick={() => navigate('/reviewer-generator')}
                sx={{ bgcolor: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.4)', color: 'white', fontWeight: 'bold', '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' } }}
              >
                Generate New Reviewer
              </Button>
            </Box>
          </Box>
          <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: '#f0f9ff', borderTop: '1px solid rgba(3,105,161,0.1)' }}>
            <TextField
              fullWidth placeholder="Search reviewers by title or subject..."
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              size="small" sx={{ bgcolor: 'white', borderRadius: 2 }}
            />
          </Box>
        </Paper>

        {filteredReviewers.length === 0 ? (
          <Paper sx={{ p: 5, textAlign: 'center', borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
            <Box sx={{ width: 80, height: 80, borderRadius: '50%', bgcolor: 'rgba(3,105,161,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
              <School sx={{ fontSize: 40, color: '#0369a1' }} />
            </Box>
            <Typography variant="h6" fontWeight="bold" gutterBottom>No reviewers yet</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Generate your first AI reviewer to start studying with structured modules, flashcards, and quizzes.
            </Typography>
            <Button variant="contained" color="primary" startIcon={<AutoAwesome />} onClick={() => navigate('/reviewer-generator')}>
              Create Reviewer
            </Button>
          </Paper>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
            {filteredReviewers.map((rev) => {
              const mods = rev.modules || [];
              const passed = mods.filter((m: any) => m.status === 'passed').length;
              const total = mods.length;
              const pct = total > 0 ? (passed / total) * 100 : 0;
              const isCompleted = rev.status === 'completed';
              const dc = diffColor[rev.difficulty] || diffColor.normal;

              return (
                <Paper
                  key={rev.id}
                  elevation={0}
                  sx={{
                    width: '100%',
                    minHeight: { md: 110 },
                    bgcolor: 'white',
                    borderRadius: 3,
                    border: isCompleted ? '1px solid #86efac' : '1px solid #e2e8f0',
                    borderLeft: `6px solid ${dc.color}`,
                    p: 3,
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.05)',
                      borderColor: isCompleted ? '#86efac' : '#cbd5e1',
                    },
                    display: 'flex',
                    flexDirection: { xs: 'column', md: 'row' },
                    alignItems: { xs: 'flex-start', md: 'center' },
                    justifyContent: 'space-between',
                    gap: 3,
                    boxSizing: 'border-box',
                  }}
                >
                  {/* Left Section: Icon + Title & Subject */}
                  <Box sx={{ display: 'flex', gap: 2.5, alignItems: 'flex-start', flexGrow: 1, minWidth: 0 }}>
                    <Box sx={{
                      width: 46,
                      height: 46,
                      borderRadius: 2,
                      background: isCompleted ? 'linear-gradient(135deg, #16a34a, #22c55e)' : 'linear-gradient(135deg, #0369a1 0%, #0ea5e9 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      color: 'white',
                      boxShadow: '0 4px 12px rgba(3,105,161,0.2)',
                    }}>
                      <MenuBook sx={{ fontSize: 24 }} />
                    </Box>
                    <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                      <Typography
                        variant="h6"
                        fontWeight={800}
                        sx={{
                          color: 'text.primary',
                          lineHeight: 1.25,
                          letterSpacing: '-0.01em',
                          fontSize: '1.05rem',
                        }}
                      >
                        {rev.title}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, fontSize: '0.78rem', display: 'block', mt: 0.5 }}>
                        Subject: {rev.subject}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }}>
                        {rev.source && (
                          <Typography variant="caption" color="text.secondary" fontWeight={500}>
                            Source: {rev.source}
                          </Typography>
                        )}
                        <Typography variant="caption" color="text.secondary" fontWeight={500}>
                          Created: {new Date(rev.createdAt).toLocaleDateString()}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>

                  {/* Middle Section: Progress Bar */}
                  <Box sx={{ flexGrow: 1, width: { xs: '100%', md: '220px' }, flexShrink: 0 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>Progress</Typography>
                      <Typography variant="caption" color="text.secondary" fontWeight={700}>{passed}/{total} modules passed</Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate" value={pct}
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        bgcolor: '#f1f5f9',
                        border: '1px solid #e2e8f0',
                        '& .MuiLinearProgress-bar': {
                          background: isCompleted ? 'linear-gradient(90deg, #16a34a, #22c55e)' : 'linear-gradient(90deg, #0369a1, #0ea5e9)'
                        }
                      }}
                    />
                  </Box>

                  {/* Right Section: Chips + Action Buttons */}
                  <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    flexShrink: 0,
                    minWidth: { md: '300px' },
                    width: { xs: '100%', md: 'auto' },
                    justifyContent: { xs: 'space-between', md: 'flex-end' },
                    borderTop: { xs: '1px solid #f1f5f9', md: 'none' },
                    pt: { xs: 1.5, md: 0 },
                    mt: { xs: 1, md: 0 }
                  }}>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Chip
                        size="small" label={rev.difficulty?.toUpperCase() || 'NORMAL'}
                        sx={{ bgcolor: dc.bg, color: dc.color, border: `1px solid ${dc.border}`, fontWeight: 700, fontSize: '0.68rem', height: 26 }}
                      />
                      <Chip size="small" label={`${total} Modules`} variant="outlined" sx={{ height: 26, fontSize: '0.68rem', fontWeight: 600 }} />
                      {isCompleted && <Chip size="small" label="Completed" icon={<CheckCircle sx={{ fontSize: '14px !important' }} />} color="success" sx={{ height: 26, fontSize: '0.68rem', fontWeight: 700 }} />}
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Button
                        variant={isCompleted ? 'outlined' : 'contained'}
                        size="small"
                        startIcon={isCompleted ? <EmojiEvents /> : <PlayArrow />}
                        onClick={() => openReviewer(rev)}
                        sx={{
                          fontWeight: 700,
                          height: 32,
                          minWidth: 120,
                          ...(isCompleted
                            ? { color: '#16a34a', borderColor: '#16a34a' }
                            : { background: 'linear-gradient(135deg, #0369a1 0%, #0ea5e9 100%)' }
                          )
                        }}
                      >
                        {isCompleted ? 'Review Again' : passed > 0 ? 'Continue' : 'Start'}
                      </Button>
                      <Tooltip title="Delete reviewer">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => setDeleteConfirmId(rev.id)}
                          sx={{
                            bgcolor: '#fef2f2',
                            border: '1px solid #fee2e2',
                            '&:hover': { bgcolor: '#fee2e2' },
                            width: 32,
                            height: 32,
                          }}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                </Paper>
              );
            })}
          </Box>
        )}

        {/* Delete Dialog */}
        <Dialog open={!!deleteConfirmId} onClose={() => setDeleteConfirmId(null)} maxWidth="xs" fullWidth>
          <DialogTitle fontWeight="bold">Delete Reviewer?</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary">
              This will permanently remove this reviewer and all your progress. This cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button color="error" variant="contained" onClick={() => { if (deleteConfirmId) { deleteReviewer(deleteConfirmId); setDeleteConfirmId(null); } }}>
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    );
  }

  // ══════════════════════════════════════════
  // MODULES LIST VIEW (LOCKS COMPLETELY REMOVED)
  // ══════════════════════════════════════════
  if (phase === 'modules') {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Button startIcon={<ArrowBack />} onClick={exitSession} sx={{ mb: 3 }}>
          Back to Reviewer List
        </Button>

        {/* Reviewer Header */}
        <Paper sx={{ mb: 4, borderRadius: 4, overflow: 'hidden', boxShadow: '0 8px 30px rgba(3,105,161,0.12)' }}>
          <Box sx={{ background: 'linear-gradient(135deg, #0369a1 0%, #0ea5e9 100%)', p: { xs: 3, md: 4 }, color: 'white' }}>
            <Typography variant="overline" sx={{ opacity: 0.8, letterSpacing: '0.1em' }}>AI STUDY REVIEWER</Typography>
            <Typography variant="h4" fontWeight="bold" gutterBottom>{activeReviewer?.title}</Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              Subject: {activeReviewer?.subject} &bull; Difficulty: {activeReviewer?.difficulty?.toUpperCase()}
            </Typography>
            <Typography variant="caption" sx={{ display: 'block', mt: 1, opacity: 0.7 }}>
              All modules are unlocked. Choose any topic to study freely!
            </Typography>
          </Box>
        </Paper>

        <Typography variant="h5" fontWeight="bold" sx={{ mb: 2 }}>
          Modules Available
        </Typography>

        <Grid container spacing={2}>
          {activeReviewer?.modules?.map((m: any, idx: number) => {
            const isPassed = m.status === 'passed';

            return (
              <Grid size={12} key={m.id}>
                <Card
                  variant="outlined"
                  sx={{
                    borderRadius: 3,
                    borderColor: isPassed ? 'success.light' : 'primary.light',
                    bgcolor: isPassed ? '#f0fdf4' : '#ffffff',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                    '&:hover': {
                      borderColor: isPassed ? 'success.main' : 'primary.main',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                      transform: 'translateY(-1px)',
                    }
                  }}
                  onClick={() => {
                    setModuleIdx(idx);
                    setAnswers({});
                    setQuizScore(null);
                    setShowExplanations(false);
                    setPhase('lesson');
                  }}
                >
                  <CardContent sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    alignItems: { xs: 'stretch', sm: 'center' },
                    p: '20px !important',
                    gap: { xs: 2, sm: 0 }
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1, minWidth: 0 }}>
                      <Box sx={{
                        width: 40, height: 40, borderRadius: '50%',
                        background: isPassed ? 'linear-gradient(135deg,#16a34a,#22c55e)' : 'linear-gradient(135deg,#0369a1,#0ea5e9)',
                        color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 'bold', mr: 2.5, flexShrink: 0
                      }}>
                        {isPassed ? <CheckCircle sx={{ fontSize: 20 }} /> : idx + 1}
                      </Box>

                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography variant="h6" fontWeight="bold" color="text.primary" sx={{ fontSize: '1rem', mb: 0.5 }}>
                          {m.title || `Module ${idx + 1}: ${m.topic}`}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                          <Chip
                            size="small"
                            label={isPassed ? 'Passed' : 'Available'}
                            color={isPassed ? 'success' : 'primary'}
                            sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600 }}
                          />
                          {m.bestScore !== null && (
                            <Typography variant="caption" color="text.secondary">
                              Best Score: {m.bestScore} / {m.questions.length}
                            </Typography>
                          )}
                          {m.attempts > 0 && (
                            <Typography variant="caption" color="text.secondary">
                              Attempts: {m.attempts}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </Box>

                    <Button
                      variant={isPassed ? 'outlined' : 'contained'}
                      color={isPassed ? 'success' : 'primary'}
                      size="small"
                      sx={{ ml: { xs: 0, sm: 2 }, mt: { xs: 1, sm: 0 }, flexShrink: 0, fontWeight: 'bold', width: { xs: '100%', sm: 'auto' } }}
                    >
                      {isPassed ? 'Review' : 'Start'}
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </Container>
    );
  }

  // ══════════════════════════════════════════
  // SESSION SPLIT LAYOUT (WITH VERTICAL ALIGNMENT MODULE SIDEBAR)
  // ══════════════════════════════════════════
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Session top bar */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Button startIcon={<ArrowBack />} onClick={exitModuleSession} sx={{ textTransform: 'none', fontWeight: 700 }}>
          Back to Modules Overview
        </Button>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Chip
            label={`${passedCount}/${totalModules} Completed`}
            color={passedCount === totalModules ? 'success' : 'default'}
            icon={passedCount === totalModules ? <EmojiEvents /> : undefined}
            sx={{ fontWeight: 700 }}
          />
          <Chip
            label={activeReviewer?.difficulty?.toUpperCase() || 'NORMAL'}
            size="small"
            sx={{ fontWeight: 700, ...(diffColor[activeReviewer?.difficulty] ? { bgcolor: diffColor[activeReviewer.difficulty].bg, color: diffColor[activeReviewer.difficulty].color } : {}) }}
          />
        </Box>
      </Box>

      <Grid container spacing={3.5}>

        {/* Left Side: Strictly Vertical Modules Navigation Sidebar */}
        <Grid size={{ xs: 12, md: 3.5 }}>
          <Paper sx={{ p: 2.5, borderRadius: 4, border: '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.02)', position: 'sticky', top: 24 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'text.secondary', mb: 2, letterSpacing: '0.05em' }}>
              MODULES PROGRESSION
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {activeReviewer?.modules?.map((m: any, i: number) => {
                const isActive = i === moduleIdx;
                const isPassed = m.status === 'passed';
                return (
                  <Paper
                    key={m.id}
                    onClick={() => {
                      setModuleIdx(i);
                      setAnswers({});
                      setQuizScore(null);
                      setShowExplanations(false);
                      setPhase('lesson');
                    }}
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: 3,
                      border: isActive ? '2px solid #0369a1' : '1px solid #e2e8f0',
                      bgcolor: isActive ? '#f0f9ff' : isPassed ? '#f0fdf4' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      '&:hover': {
                        borderColor: '#0369a1',
                        bgcolor: '#f8fafc',
                      }
                    }}
                  >
                    <Box sx={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      bgcolor: isActive ? '#0369a1' : isPassed ? '#10b981' : '#64748b',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      fontSize: '0.75rem',
                      flexShrink: 0
                    }}>
                      {isPassed ? <CheckCircle sx={{ fontSize: 16 }} /> : i + 1}
                    </Box>
                    <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                      <Typography variant="body2" fontWeight={isActive ? 800 : 600} sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isActive ? '#0369a1' : 'text.primary' }}>
                        {m.topic}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {isPassed ? 'Completed' : 'Available'}
                      </Typography>
                    </Box>
                  </Paper>
                );
              })}
            </Box>
          </Paper>
        </Grid>

        {/* Right Side: Phase Workspaces Panel */}
        <Grid size={{ xs: 12, md: 8.5 }}>

          {/* LESSON PHASE WORKSPACE */}
          {phase === 'lesson' && currentModule && (
            <Paper sx={{ borderRadius: 4, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.07)', border: '1px solid #e2e8f0' }}>
              <Box sx={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)', p: 3, color: 'white' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ width: 44, height: 44, borderRadius: 2.5, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <MenuBook sx={{ fontSize: 24 }} />
                  </Box>
                  <Box>
                    <Typography variant="overline" sx={{ opacity: 0.8, lineHeight: 1 }}>Lesson Material</Typography>
                    <Typography variant="h6" fontWeight="bold">{currentModule.title}</Typography>
                  </Box>
                </Box>
              </Box>

              <Box sx={{ p: { xs: 3, md: 4 } }}>
                {currentModule.lessonContent.split('\n').map((line: string, i: number) => {
                  const trimmed = line.trim();
                  if (!trimmed) return <Box key={i} sx={{ mb: 1 }} />;
                  if (trimmed.startsWith('**') && trimmed.endsWith('**') && !trimmed.slice(2, -2).includes('**')) {
                    return <Typography key={i} variant="h6" fontWeight="bold" sx={{ mt: 2, mb: 1, color: '#1e3a8a' }}>{trimmed.slice(2, -2)}</Typography>;
                  }
                  if (trimmed === '---') return <Divider key={i} sx={{ my: 2 }} />;
                  if (trimmed.startsWith('•')) {
                    return (
                      <Box key={i} sx={{ display: 'flex', gap: 1, mb: 0.75, pl: 1 }}>
                        <Typography variant="body2" color="primary" sx={{ mt: 0.25, flexShrink: 0 }}>•</Typography>
                        <Typography variant="body2" sx={{ lineHeight: 1.7 }}
                          dangerouslySetInnerHTML={{ __html: trimmed.slice(1).trim().replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>') }}
                        />
                      </Box>
                    );
                  }
                  return (
                    <Typography key={i} variant="body1" sx={{ mb: 1.2, lineHeight: 1.8 }}
                      dangerouslySetInnerHTML={{ __html: trimmed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>') }}
                    />
                  );
                })}

                <Divider sx={{ my: 4 }} />

                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'text.secondary', mb: 2 }}>
                  SELECT ACTIVE STUDY REVIEW MODE
                </Typography>
                <Grid container spacing={2}>

                  {/* Option 1: Study Flashcards */}
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Card variant="outlined" sx={{ borderRadius: 3, border: '1px solid #e2e8f0', transition: 'all 0.2s', '&:hover': { borderColor: '#6366f1', bgcolor: 'rgba(99,102,241,0.02)' } }}>
                      <CardActionArea sx={{ p: 2.5 }} onClick={() => { setPhase('flashcards'); setFlashcardIdx(0); setIsFlipped(false); }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                          <IconButton size="small" sx={{ bgcolor: 'rgba(99, 102, 241, 0.08)', color: '#6366f1' }}>
                            <SwapHoriz fontSize="small" />
                          </IconButton>
                          <Typography variant="subtitle1" fontWeight="bold">Interactive Flashcards</Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          Flip questions dynamically in 3D, view correct answers and study outcome explanations at your own pace.
                        </Typography>
                      </CardActionArea>
                    </Card>
                  </Grid>

                  {/* Option 2: Take Quiz */}
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Card variant="outlined" sx={{ borderRadius: 3, border: '1px solid #e2e8f0', transition: 'all 0.2s', '&:hover': { borderColor: '#10b981', bgcolor: 'rgba(16,185,129,0.02)' } }}>
                      <CardActionArea sx={{ p: 2.5 }} onClick={startQuiz}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                          <IconButton size="small" sx={{ bgcolor: 'rgba(16, 185, 129, 0.08)', color: '#10b981' }}>
                            <QuizIcon fontSize="small" />
                          </IconButton>
                          <Typography variant="subtitle1" fontWeight="bold">Practice Assessment Quiz</Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          Take the module quiz ({totalQ} items) under active scoring.
                        </Typography>
                      </CardActionArea>
                    </Card>
                  </Grid>

                </Grid>
              </Box>
            </Paper>
          )}

          {/* FLASHCARDS STUDY WORKSPACE */}
          {phase === 'flashcards' && currentModule && (() => {
            const questions = currentModule.questions || [];
            const q = questions[flashcardIdx];
            return (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5, animation: 'fadeIn 0.3s ease' }}>
                <Paper sx={{ p: 3, borderRadius: 4, bgcolor: '#fbfbfe', border: '1px solid #e0e7ff' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'primary.main', mb: 0.5 }}>
                    FLASHCARDS STUDY WORKSPACE
                  </Typography>
                  <Typography variant="h6" fontWeight="bold" color="text.primary">{currentModule.title}</Typography>
                </Paper>

                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  <Card
                    variant="outlined"
                    onClick={() => setIsFlipped(!isFlipped)}
                    sx={{
                      width: '100%',
                      maxWidth: 580,
                      minHeight: 320,
                      cursor: 'pointer',
                      borderRadius: 5,
                      border: isFlipped ? '2px solid #10b981' : '2px solid #6366f1',
                      boxShadow: isFlipped ? '0 12px 25px rgba(16,185,129,0.05)' : '0 12px 25px rgba(99,102,241,0.05)',
                      background: isFlipped
                        ? 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)'
                        : 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                      transition: 'all 0.25s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      p: 4,
                      textAlign: 'center',
                      position: 'relative'
                    }}
                  >
                    <Chip
                      icon={<SwapHoriz />}
                      label="Click Card to Flip"
                      size="small"
                      color={isFlipped ? 'success' : 'primary'}
                      sx={{ position: 'absolute', top: 16, right: 16, fontWeight: 700, fontSize: '0.65rem' }}
                    />

                    {!isFlipped ? (
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <HelpOutline sx={{ fontSize: 44, color: '#6366f1' }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'text.secondary', tracking: '0.1em' }}>
                          QUESTION {flashcardIdx + 1} OF {questions.length}
                        </Typography>
                        <Typography variant="h5" fontWeight="bold" sx={{ px: 2, lineHeight: 1.5, color: '#1e293b' }}>
                          {q.question}
                        </Typography>

                        {q.type === 'multiple-choice' && q.options && (
                          <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1, textAlign: 'left', alignSelf: 'stretch', pl: { sm: 4 } }}>
                            {q.options.map((opt: string, optIdx: number) => (
                              <Typography key={optIdx} variant="body2" color="text.secondary">
                                <strong>{String.fromCharCode(65 + optIdx)}.</strong> {opt}
                              </Typography>
                            ))}
                          </Box>
                        )}
                      </Box>
                    ) : (
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <CheckCircle sx={{ fontSize: 44, color: '#10b981' }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'success.main', tracking: '0.1em' }}>
                          CORRECT ANSWER
                        </Typography>

                        <Typography variant="h5" fontWeight="black" sx={{ color: '#065f46', mb: 1 }}>
                          {q.type === 'multiple-choice' && q.options
                            ? `${String.fromCharCode(65 + q.correctAnswer)}. ${q.options[q.correctAnswer]}`
                            : String(q.correctAnswer).toUpperCase()}
                        </Typography>

                        <Divider sx={{ width: '80%', my: 1, borderColor: 'rgba(16,185,129,0.15)' }} />

                        <Typography variant="body2" sx={{ color: '#374151', fontStyle: 'italic', px: 3, lineHeight: 1.6 }}>
                          <strong>Explanation:</strong> {q.explanation || 'No detailed explanation provided for this conceptual item.'}
                        </Typography>
                      </Box>
                    )}
                  </Card>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, alignItems: 'center' }}>
                  <Button
                    variant="outlined"
                    disabled={flashcardIdx === 0}
                    onClick={() => { setFlashcardIdx(flashcardIdx - 1); setIsFlipped(false); }}
                    sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="contained"
                    color={isFlipped ? 'success' : 'primary'}
                    onClick={() => setIsFlipped(!isFlipped)}
                    startIcon={<SwapHoriz />}
                    sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 700, px: 3 }}
                  >
                    Flip Card
                  </Button>
                  <Button
                    variant="outlined"
                    disabled={flashcardIdx === questions.length - 1}
                    onClick={() => { setFlashcardIdx(flashcardIdx + 1); setIsFlipped(false); }}
                    sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
                  >
                    Next
                  </Button>
                </Box>
              </Box>
            );
          })()}

          {/* Practice quiz workspace */}
          {phase === 'quiz' && currentModule && (
            <Box sx={{ animation: 'fadeIn 0.3s ease' }}>
              <Paper sx={{ p: 2.5, mb: 3, borderRadius: 3, background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', color: 'white' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                  <Typography fontWeight="bold">{currentModule.title} — Quiz</Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    {Object.keys(answers).length} / {totalQ} answered
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={(Object.keys(answers).length / totalQ) * 100}
                  sx={{ mt: 1.5, height: 5, borderRadius: 3, bgcolor: 'rgba(255,255,255,0.2)', '& .MuiLinearProgress-bar': { bgcolor: 'white' } }}
                />
              </Paper>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                {currentModule.questions.map((q: any, idx: number) => (
                  <Paper key={q.id} sx={{ p: 3, borderRadius: 3, border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
                    <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
                      <Box sx={{
                        minWidth: 30, height: 30, borderRadius: 2, flexShrink: 0, mt: 0.25,
                        background: answers[q.id] !== undefined ? 'linear-gradient(135deg,#1e3a8a,#3b82f6)' : '#f1f5f9',
                        color: answers[q.id] !== undefined ? 'white' : '#64748b',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem',
                      }}>
                        {idx + 1}
                      </Box>
                      <Box sx={{ flexGrow: 1 }}>
                        <Chip
                          size="small" label={q.type === 'true-false' ? 'True / False' : q.type === 'multiple-choice' ? 'Multiple Choice' : 'Identification'}
                          sx={{ mb: 1, bgcolor: q.type === 'identification' ? '#fef3c7' : '#eff6ff', color: q.type === 'identification' ? '#92400e' : '#1e40af', fontWeight: 600, fontSize: '0.7rem' }}
                        />
                        <Typography variant="body1" fontWeight={600} sx={{ lineHeight: 1.5 }}>{q.question}</Typography>
                      </Box>
                    </Box>

                    {/* True/False */}
                    {q.type === 'true-false' && (
                      <FormControl component="fieldset" fullWidth>
                        <RadioGroup
                          value={answers[q.id] ?? ''}
                          onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                        >
                          {['true', 'false'].map((val) => (
                            <FormControlLabel
                              key={val} value={val}
                              control={<Radio size="small" />}
                              label={<Typography sx={{ fontWeight: answers[q.id] === val ? 700 : 400 }}>{val === 'true' ? 'True' : 'False'}</Typography>}
                              sx={{
                                mb: 1, p: 1.5, borderRadius: 2, mr: 0,
                                border: answers[q.id] === val ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                                bgcolor: answers[q.id] === val ? '#eff6ff' : 'transparent',
                                transition: 'all 0.15s ease',
                                '&:hover': { bgcolor: '#f8fafc', borderColor: '#94a3b8' },
                              }}
                            />
                          ))}
                        </RadioGroup>
                      </FormControl>
                    )}

                    {/* Multiple Choice */}
                    {q.type === 'multiple-choice' && q.options && (
                      <FormControl component="fieldset" fullWidth>
                        <RadioGroup
                          value={answers[q.id] ?? ''}
                          onChange={(e) => setAnswers({ ...answers, [q.id]: Number(e.target.value) })}
                        >
                          {q.options.map((opt: string, i: number) => (
                            <FormControlLabel
                              key={i} value={i}
                              control={<Radio size="small" />}
                              label={<Typography sx={{ fontWeight: answers[q.id] === i ? 700 : 400 }}>{String.fromCharCode(65 + i)}. {opt}</Typography>}
                              sx={{
                                mb: 1, p: 1.5, borderRadius: 2, mr: 0,
                                border: answers[q.id] === i ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                                bgcolor: answers[q.id] === i ? '#eff6ff' : 'transparent',
                                transition: 'all 0.15s ease',
                                '&:hover': { bgcolor: '#f8fafc', borderColor: '#94a3b8' },
                              }}
                            />
                          ))}
                        </RadioGroup>
                      </FormControl>
                    )}

                    {/* Identification */}
                    {q.type === 'identification' && (
                      <TextField
                        fullWidth variant="outlined" size="small"
                        placeholder="Type your answer here..."
                        value={answers[q.id] ?? ''}
                        onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                        sx={{ mt: 1, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                      />
                    )}
                  </Paper>
                ))}
              </Box>

              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                <Button variant="outlined" onClick={() => setPhase('lesson')} startIcon={<ArrowBack />}>
                  Back to Lesson
                </Button>
                <Button
                  variant="contained" size="large"
                  onClick={submitQuiz}
                  disabled={Object.keys(answers).length === 0}
                  sx={{ background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', fontWeight: 'bold', px: 4 }}
                >
                  Submit Quiz ({Object.keys(answers).length}/{totalQ} answered)
                </Button>
              </Box>
            </Box>
          )}

          {/* Results phase workspace */}
          {phase === 'result' && quizScore !== null && currentModule && (() => {
            const pct = Math.round((quizScore / totalQ) * 100);
            const isLastModule = moduleIdx >= totalModules - 1;
            const allDone = activeReviewer?.status === 'completed';
            return (
              <Box sx={{ animation: 'fadeIn 0.3s ease' }}>
                <Paper sx={{
                  p: 4, mb: 3, borderRadius: 4, textAlign: 'center',
                  background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                  color: 'white',
                  boxShadow: '0 12px 32px rgba(15,23,42,0.15)',
                }}>
                  <EmojiEvents sx={{ fontSize: 64, mb: 1, color: '#fbbf24' }} />
                  <Typography variant="h4" fontWeight="bold">Practice Quiz Complete!</Typography>
                  <Typography variant="h2" fontWeight="bold" sx={{ my: 1 }}>{pct}%</Typography>
                  <Typography variant="h6" sx={{ opacity: 0.9 }}>
                    Score: {quizScore} / {totalQ} correct
                  </Typography>
                  {allDone && (
                    <Chip label="🎉 Reviewer Completed!" sx={{ mt: 2, bgcolor: 'rgba(255,255,255,0.25)', color: 'white', fontWeight: 'bold', fontSize: '1rem', height: 36 }} />
                  )}
                </Paper>

                {showExplanations && (
                  <Paper sx={{ p: 3, mb: 3, borderRadius: 4, boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
                    <Typography variant="h6" fontWeight="bold" gutterBottom>Answer Review & Explanations</Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {currentModule.questions.map((q: any, i: number) => {
                        const ans = answers[q.id];
                        let isCorrect = false;
                        if (q.type === 'true-false') isCorrect = String(ans).toLowerCase() === String(q.correctAnswer).toLowerCase();
                        else if (q.type === 'multiple-choice') isCorrect = ans === q.correctAnswer;
                        else if (q.type === 'identification') {
                          const sa = String(ans || '').toLowerCase().trim();
                          const ka = String(q.correctAnswer).toLowerCase().trim();
                          isCorrect = sa.length > 0 && (sa.includes(ka) || ka.includes(sa));
                        }
                        return (
                          <Box key={q.id} sx={{ p: 2, borderRadius: 2.5, border: `1.5px solid ${isCorrect ? '#86efac' : '#fca5a5'}`, bgcolor: isCorrect ? '#f0fdf4' : '#fff5f5' }}>
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 1 }}>
                              {isCorrect ? <CheckCircle sx={{ color: '#16a34a', mt: 0.25, flexShrink: 0 }} /> : <Cancel sx={{ color: '#dc2626', mt: 0.25, flexShrink: 0 }} />}
                              <Typography variant="body2" fontWeight={600}>{i + 1}. {q.question}</Typography>
                            </Box>
                            <Typography variant="caption" color={isCorrect ? 'success.main' : 'error.main'} display="block" sx={{ ml: 3.5 }}>
                              Your answer: {q.type === 'multiple-choice' && q.options ? `${String.fromCharCode(65 + (ans ?? 0))}. ${q.options[ans]}` : String(ans ?? '(no answer)')}
                            </Typography>
                            {!isCorrect && (
                              <Typography variant="caption" color="success.main" display="block" sx={{ ml: 3.5 }}>
                                Correct: {q.type === 'multiple-choice' && q.options ? `${String.fromCharCode(65 + q.correctAnswer)}. ${q.options[q.correctAnswer]}` : String(q.correctAnswer)}
                              </Typography>
                            )}
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 3.5, mt: 0.5, fontStyle: 'italic' }}>
                              {q.explanation}
                            </Typography>
                          </Box>
                        );
                      })}
                    </Box>
                  </Paper>
                )}

                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <Button variant="outlined" startIcon={<Replay />} onClick={retryQuiz}>
                    Review Lesson
                  </Button>
                  {!isLastModule && (
                    <Button
                      variant="contained" endIcon={<ArrowForward />} onClick={goToNextModule}
                      sx={{ background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', fontWeight: 'bold' }}
                    >
                      Next Module
                    </Button>
                  )}
                  {(allDone || isLastModule) && (
                    <Button
                      variant="contained" startIcon={<EmojiEvents />} onClick={exitModuleSession}
                      sx={{ background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', fontWeight: 'bold' }}
                    >
                      Finish — Back to Modules
                    </Button>
                  )}
                </Box>
              </Box>
            );
          })()}

        </Grid>
      </Grid>
    </Container>
  );
}
