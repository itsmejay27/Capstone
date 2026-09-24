import { useState, useEffect, useRef } from 'react';
import { useExamGuard } from '../hooks/useExamGuard';
import { useToast } from '../components/Toast';
import { useParams, useNavigate } from 'react-router';
import { scoreAttempt } from '../services/grading';
import { useAuth } from '../context/AuthContext';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  TextField,
  LinearProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Divider,
  Card,
} from '@mui/material';
import { Timer, Warning, CheckCircle, Image as ImageIcon, AutoAwesome, HelpOutline } from '@mui/icons-material';

// Shuffler utility
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function TakeExam() {
  const { examId } = useParams();
  const { currentUser, exams, examAttempts, submitExamAttempt } = useAuth();
  const navigate = useNavigate();

  const exam = exams.find((e) => e.id === examId);
  
  const [attempt, setAttempt] = useState<any | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [openSubmitDialog, setOpenSubmitDialog] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [preparedAttempt, setPreparedAttempt] = useState<any | null>(null);

  // Integrity + timing while the exam is open (see useExamGuard). Warnings are throttled so
  // a held key does not stack toasts.
  const { toast, ToastHost } = useToast();
  const lastWarn = useRef(0);
  const guard = useExamGuard(hasStarted && !submitted, (msg) => {
    if (Date.now() - lastWarn.current > 2500) { lastWarn.current = Date.now(); toast(msg, 'error'); }
  }, { timing: attempt?.timing, integrity: attempt?.integrity });

  // Initialize randomized subset or load existing attempt
  useEffect(() => {
    if (!exam || !currentUser) return;

    const existing = examAttempts.find(
      (a) => a.examId === exam.id && a.studentId === currentUser.id
    );

    if (existing) {
      setAttempt(existing);
      setAnswers(existing.answers || {});
      setHasStarted(true);
      
      const start = new Date(existing.startedAt).getTime();
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const totalSec = exam.duration * 60;
      const remaining = Math.max(0, totalSec - elapsed);
      setTimeRemaining(remaining);
      
      if (existing.submittedAt) {
        setSubmitted(true);
      }
    } else {
      const N = exam.activeQuestionCount || exam.questions.length;
      const pool = exam.questions;
      
      // `shuffleQuestions` is undefined on exams assigned before the setting existed, so
      // it defaults to true — the behaviour every existing exam already had.
      const shouldShuffle = exam.shuffleQuestions !== false;
      const orderedPool = shouldShuffle ? shuffleArray(pool) : pool;
      const selectedQuestions = orderedPool.slice(0, Math.min(N, pool.length));

      const finalizedQuestions = selectedQuestions.map((q: any) => {
        if (q.type === 'multiple-choice' && q.options) {
          const originalCorrectIdx = q.correctAnswer;
          const originalCorrectValue = q.options[originalCorrectIdx];
          
          const zipped = q.options.map((opt: string, idx: number) => ({
            text: opt,
            img: q.optionsImages?.[idx] || '',
            isCorrect: idx === originalCorrectIdx,
          }));

          const shuffledZipped = shuffleArray(zipped);

          const newOptions = shuffledZipped.map(z => z.text);
          const newOptionsImages = shuffledZipped.map(z => z.img);
          const newCorrectIdx = shuffledZipped.findIndex(z => z.isCorrect);

          return {
            ...q,
            options: newOptions,
            optionsImages: newOptionsImages,
            correctAnswer: newCorrectIdx,
            originalCorrectText: originalCorrectValue,
          };
        }
        return q;
      });

      const newAttempt = {
        id: `attempt-${Date.now()}`,
        examId: exam.id,
        studentId: currentUser.id,
        answers: {},
        questions: finalizedQuestions,
      };

      setPreparedAttempt(newAttempt);
    }
  }, [exam, currentUser, examAttempts]);

  const handleStartExam = () => {
    if (preparedAttempt) {
      const attemptToStart = {
        ...preparedAttempt,
        startedAt: new Date().toISOString()
      };
      submitExamAttempt(attemptToStart);
      setAttempt(attemptToStart);
      setTimeRemaining(exam.duration * 60);
      setHasStarted(true);
    }
  };

  // Timer loop
  useEffect(() => {
    if (!hasStarted || submitted || timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining, hasStarted, submitted]);

  if (!exam || (!attempt && !preparedAttempt)) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography>Loading assessment environment...</Typography>
      </Container>
    );
  }

  const dueAt = exam.dueDate ? new Date(exam.dueDate) : null;
  const isPastDue = Boolean(dueAt && Date.now() > dueAt.getTime());
  const lateAllowed = exam.allowLate !== false;

  // Past due and late work is not accepted: refuse entry rather than let a student sit an
  // exam whose submission would be rejected.
  if (!hasStarted && isPastDue && !lateAllowed) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Paper sx={{ p: { xs: 4, md: 6 }, borderRadius: 4, textAlign: 'center' }}>
          <Typography variant="h5" fontWeight={900} sx={{ mb: 1.5, color: 'var(--c-slate-900)' }}>
            This exam has closed
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {exam.title} was due on {dueAt?.toLocaleString()}, and late submissions are not
            being accepted. Speak to your instructor if you think this is a mistake.
          </Typography>
          <Button variant="contained" onClick={() => navigate('/dashboard')}>
            Back to dashboard
          </Button>
        </Paper>
      </Container>
    );
  }

  if (!hasStarted) {
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Paper sx={{ p: 6, borderRadius: 4, textAlign: 'center', boxShadow: '0 8px 30px rgba(15,23,42,0.08)' }}>
          <Typography variant="h4" fontWeight={900} gutterBottom sx={{ letterSpacing: '-0.02em', color: 'var(--c-slate-900)' }}>
            {exam.title}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, px: { md: 4 } }}>
            {exam.instructions || exam.description || 'Please read the instructions carefully before starting the assessment.'}
          </Typography>
          
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: { xs: 2, sm: 4 }, my: 4, flexWrap: 'wrap' }}>
            <Box sx={{ px: 3, py: 1.5, bgcolor: 'var(--c-slate-50)', borderRadius: 3 }}>
              <Typography variant="h5" fontWeight="black" color="primary.main">{exam.duration} Mins</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>TIME LIMIT</Typography>
            </Box>
            <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />
            <Box sx={{ px: 3, py: 1.5, bgcolor: 'var(--c-slate-50)', borderRadius: 3 }}>
              <Typography variant="h5" fontWeight="black" color="primary.main">{exam.activeQuestionCount || exam.questions.length}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>QUESTIONS</Typography>
            </Box>
            <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />
            <Box sx={{ px: 3, py: 1.5, bgcolor: 'var(--c-slate-50)', borderRadius: 3 }}>
              <Typography variant="h5" fontWeight="black" color="primary.main">{exam.totalPoints} pts</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>TOTAL WEIGHT</Typography>
            </Box>
          </Box>

          <Alert severity="warning" sx={{ mb: 4, textAlign: 'left', borderRadius: 3 }}>
            <strong>Important Notice:</strong> Once the assessment begins, the timer runs continuously. Do not exit, refresh, or navigate away from the exam workspace.
          </Alert>

          <Button 
            variant="contained" 
            size="large" 
            onClick={handleStartExam}
            startIcon={<AutoAwesome />}
            sx={{
              px: 6,
              py: 1.8,
              fontSize: '1.05rem',
              borderRadius: 3.5,
              textTransform: 'none',
              fontWeight: 700,
              background: 'linear-gradient(135deg, var(--c-banner-from) 0%, var(--c-banner-to) 100%)',
              boxShadow: '0 10px 25px -5px rgba(15,23,42,0.3)'
            }}
          >
            Start Assessment
          </Button>
        </Paper>
      </Container>
    );
  }

  const activeQuestions = attempt.questions || [];
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;

  const handleAnswerChange = (qId: string, value: any) => {
    guard.focusQuestion(qId);
    const updatedAnswers = { ...answers, [qId]: value };
    setAnswers(updatedAnswers);

    const updatedAttempt = {
      ...attempt,
      answers: updatedAnswers,
      // Saved as the student goes, so timing survives a refresh or a dropped connection.
      ...guard.snapshot(activeQuestions.length),
    };
    submitExamAttempt(updatedAttempt);
  };

  const handleSubmit = () => {
    setSubmitted(true);
    setOpenSubmitDialog(false);

    // Short-answer and essay items wait for the instructor; only the rest is scored now.
    const scored = scoreAttempt(activeQuestions, answers);
    const score = scored.total;

    const finalizedAttempt = {
      ...attempt,
      answers,
      ...guard.snapshot(activeQuestions.length),
      score,
      gradingStatus: scored.pendingIds.length > 0 ? 'pending' : 'graded',
      manualScores: {},
      submittedAt: new Date().toISOString(),
      // Recorded so a submission accepted after the due date is visible when grading,
      // rather than being silently indistinguishable from an on-time one.
      isLate: Boolean(exam.dueDate && Date.now() > new Date(exam.dueDate).getTime()),
    };

    submitExamAttempt(finalizedAttempt);

    setTimeout(() => {
      navigate(`/exam/${examId}/results`);
    }, 1500);
  };

  const answeredCount = Object.keys(answers).length;
  const unansweredCount = activeQuestions.length - answeredCount;
  const progress = (answeredCount / activeQuestions.length) * 100;

  if (submitted) {
    return (
      <Container maxWidth="md" sx={{ py: 8, textAlign: 'center' }}>
        <Paper sx={{ p: 6, borderRadius: 4, boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
          <CheckCircle sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
          <Typography variant="h4" gutterBottom fontWeight="black" sx={{ letterSpacing: '-0.02em' }}>
            Assessment Logged Successfully!
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Your attempt has been submitted to the instructor's gradebook. Loading results...
          </Typography>
        </Paper>
      </Container>
    );
  }

  return (
    <Container
      maxWidth="lg"
      className="exam-guarded"
      sx={{
        py: 4, position: 'relative',
        // Blurred whenever the window loses focus — screen-capture tools and other apps
        // take focus first, so what they capture is unreadable.
        // No transition: the content must vanish on the same frame the key goes down.
        '& > *:not(.exam-cover)': { visibility: guard.obscured ? 'hidden' : 'visible' },
      }}
    >
      {guard.obscured && (
        <Box className="exam-cover" sx={{ position: 'fixed', inset: 0, zIndex: 1400, bgcolor: 'var(--c-canvas, #0b1020)', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', p: 3 }}>
          <Typography sx={{ fontWeight: 800, color: 'var(--c-ink, #fff)' }}>
            The exam is hidden while this window is not in focus.<br />Click here to continue.
          </Typography>
        </Box>
      )}
      {/* Faint name watermark: a photo of the screen still identifies whose exam it is. */}
      <Box
        aria-hidden
        sx={{
          pointerEvents: 'none', position: 'fixed', inset: 0, zIndex: 1300, opacity: 0.05,
          backgroundImage: `url("data:image/svg+xml;utf8,${encodeURIComponent(
            `<svg xmlns='http://www.w3.org/2000/svg' width='360' height='200'><text x='20' y='110' transform='rotate(-20 180 100)' font-family='sans-serif' font-size='16' fill='currentColor'>${(currentUser?.email || '').replace(/[<>&]/g, '')} · ${new Date().toLocaleDateString()}</text></svg>`
          )}")`,
          color: 'var(--c-ink)',
        }}
      />
      {ToastHost}

      {/* High-End Header Banner */}
      <Box sx={{
        background: 'linear-gradient(135deg, var(--c-banner-from) 0%, var(--c-banner-to) 100%)',
        borderRadius: 4,
        p: { xs: 3, md: 4 },
        mb: 4,
        color: 'white',
        boxShadow: '0 8px 30px rgba(15,23,42,0.15)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <Typography variant="overline" sx={{ opacity: 0.8, letterSpacing: '0.1em', fontWeight: 700 }}>ACTIVE ASSESSMENT</Typography>
        <Typography variant="h4" fontWeight={900} sx={{ letterSpacing: '-0.02em', mb: 1, fontSize: { xs: '1.75rem', md: '2.25rem' } }}>
          {exam.title}
        </Typography>
        {exam.type && (
          <Chip
            label={exam.type.toUpperCase()}
            size="small"
            sx={{ mb: 1.5, bgcolor: 'rgba(255,255,255,0.15)', color: 'white', fontWeight: 800, fontSize: '0.7rem', border: '1px solid rgba(255,255,255,0.3)' }}
          />
        )}
        <Typography variant="body2" sx={{ color: 'var(--c-slate-300)', opacity: 0.9 }}>
          {exam.instructions || exam.description || 'Answer all questions in the pool. Review your answers before submitting.'}
        </Typography>
      </Box>

      {timeRemaining < 300 && (
        <Alert severity="error" icon={<Warning />} sx={{ mb: 3, borderRadius: 3, fontWeight: 700 }}>
          Warning: Less than 5 minutes remaining! Your attempt will auto-submit when the timer expires.
        </Alert>
      )}

      {/* Two-column flex layout: Questions (left) + Sticky Sidebar (right) */}
      <Box sx={{ display: 'flex', gap: 4, alignItems: 'flex-start' }}>

        {/* LEFT: All Questions Stacked Vertically */}
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {activeQuestions.map((q: any, idx: number) => {
            const isAnswered = answers[q.id] !== undefined && String(answers[q.id]).trim() !== '';
            return (
              <Card
                id={q.id}
                key={q.id}
                data-question-id={q.id}
                onPointerDown={() => guard.focusQuestion(q.id)}
                onFocusCapture={() => guard.focusQuestion(q.id)}
                variant="outlined"
                sx={{
                  borderRadius: 4,
                  borderColor: isAnswered ? 'var(--c-emerald-500)' : 'var(--c-slate-200)',
                  borderLeft: `6px solid ${isAnswered ? 'var(--c-emerald-500)' : 'var(--c-slate-300)'}`,
                  boxShadow: '0 4px 15px rgba(0,0,0,0.01)',
                  transition: 'all 0.2s',
                  '&:hover': { boxShadow: '0 6px 20px rgba(0,0,0,0.04)' }
                }}
              >
                <Box sx={{ p: { xs: 2.5, md: 4 } }}>

                  {/* Header chips */}
                  <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mb: 2.5, flexWrap: 'wrap' }}>
                    <Chip label={`QUESTION ${idx + 1}`} color={isAnswered ? 'primary' : 'default'} size="small" sx={{ fontWeight: 800, fontSize: '0.65rem' }} />
                    <Chip label={q.type.toUpperCase()} size="small" variant="outlined" sx={{ fontWeight: 700, fontSize: '0.65rem' }} />
                    <Chip label={`${q.points} pts`} size="small" variant="outlined" sx={{ fontWeight: 700, fontSize: '0.65rem' }} />
                    {isAnswered && (
                      <Chip label="ANSWERED" size="small" color="success" variant="outlined" sx={{ fontWeight: 700, fontSize: '0.65rem' }} />
                    )}
                  </Box>

                  {/* Question Statement */}
                  <Typography variant="h6" fontWeight="bold" sx={{ color: 'var(--c-slate-800)', mb: 2, fontSize: '1.1rem', lineHeight: 1.6 }}>
                    {q.question}
                  </Typography>

                  {/* Image Asset */}
                  {q.image && (
                    <Box sx={{ my: 2 }}>
                      <img
                        src={q.image}
                        alt={`Question ${idx + 1} Diagram`}
                        style={{ maxWidth: '100%', maxHeight: '220px', borderRadius: '8px', border: '1px solid var(--c-slate-100)' }}
                      />
                    </Box>
                  )}

                  {/* Multiple Choice */}
                  {q.type === 'multiple-choice' && q.options && (
                    <FormControl component="fieldset" fullWidth sx={{ mt: 1.5 }}>
                      <RadioGroup
                        value={answers[q.id] ?? ''}
                        onChange={(e) => handleAnswerChange(q.id, Number(e.target.value))}
                      >
                        {q.options.map((option: string, optIdx: number) => {
                          const isSelected = answers[q.id] === optIdx;
                          return (
                            <FormControlLabel
                              key={optIdx}
                              value={optIdx}
                              control={<Radio />}
                              label={
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, py: 0.5 }}>
                                  <Typography sx={{ fontWeight: isSelected ? 700 : 400, fontSize: '0.95rem' }}>
                                    <strong>{String.fromCharCode(65 + optIdx)}.</strong> {option}
                                  </Typography>
                                  {q.optionsImages?.[optIdx] && (
                                    <Box sx={{ mt: 0.5 }}>
                                      <img
                                        src={q.optionsImages[optIdx]}
                                        alt={`Option ${String.fromCharCode(65 + optIdx)}`}
                                        style={{ width: '45px', height: '45px', objectFit: 'cover', borderRadius: '4px' }}
                                      />
                                    </Box>
                                  )}
                                </Box>
                              }
                              sx={{
                                border: isSelected ? '2px solid var(--c-emerald-500)' : '1px solid var(--c-slate-200)',
                                bgcolor: isSelected ? 'rgba(14,165,198,0.04)' : 'transparent',
                                borderRadius: 3,
                                mb: 1.5,
                                mr: 0,
                                p: 2,
                                transition: 'all 0.15s ease',
                                '&:hover': {
                                  bgcolor: isSelected ? 'rgba(14,165,198,0.06)' : 'var(--c-slate-50)',
                                  borderColor: isSelected ? 'var(--c-emerald-500)' : 'var(--c-slate-300)',
                                },
                              }}
                            />
                          );
                        })}
                      </RadioGroup>
                    </FormControl>
                  )}

                  {/* True / False */}
                  {q.type === 'true-false' && (
                    <FormControl component="fieldset" fullWidth sx={{ mt: 1.5 }}>
                      <RadioGroup
                        value={answers[q.id] ?? ''}
                        onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                      >
                        {['true', 'false'].map((val) => {
                          const isSelected = String(answers[q.id]) === val;
                          return (
                            <FormControlLabel
                              key={val}
                              value={val}
                              control={<Radio />}
                              label={val === 'true' ? 'True (Factual statement)' : 'False (Incorrect statement)'}
                              sx={{
                                border: isSelected ? '2px solid var(--c-emerald-500)' : '1px solid var(--c-slate-200)',
                                bgcolor: isSelected ? 'rgba(14,165,198,0.04)' : 'transparent',
                                borderRadius: 3,
                                mb: 1.5,
                                mr: 0,
                                p: 2,
                                transition: 'all 0.15s ease',
                                '&:hover': {
                                  bgcolor: isSelected ? 'rgba(14,165,198,0.06)' : 'var(--c-slate-50)',
                                  borderColor: isSelected ? 'var(--c-emerald-500)' : 'var(--c-slate-300)',
                                },
                              }}
                            />
                          );
                        })}
                      </RadioGroup>
                    </FormControl>
                  )}

                  {/* Short Answer / Essay */}
                  {(q.type === 'short-answer' || q.type === 'essay') && (
                    <Box sx={{ mt: 1.5 }}>
                      <TextField
                        fullWidth
                        multiline
                        rows={q.type === 'essay' ? 6 : 2}
                        value={answers[q.id] ?? ''}
                        onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                        placeholder="Type your response here..."
                        variant="outlined"
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                      />
                    </Box>
                  )}

                </Box>
              </Card>
            );
          })}
        </Box>

        {/* RIGHT: Sticky Timer + Question Grid Sidebar — always on the right */}
        <Box
          sx={{
            width: { xs: '100%', md: 320 },
            flexShrink: 0,
            display: { xs: 'none', md: 'flex' },
            flexDirection: 'column',
            gap: 3,
            position: 'sticky',
            top: 24,
            alignSelf: 'flex-start',
          }}
        >
          {/* Timer & Progress Card */}
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 4,
              border: timeRemaining < 300 ? '2px solid var(--c-red-300)' : '1px solid var(--c-slate-200)',
              boxShadow: timeRemaining < 300
                ? '0 4px 20px rgba(239,68,68,0.12)'
                : '0 4px 20px rgba(0,0,0,0.05)',
              transition: 'all 0.3s',
            }}
          >
            {/* Timer Display */}
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                py: 2,
                mb: 2,
                borderRadius: 3,
                bgcolor: timeRemaining < 300 ? 'rgba(239,68,68,0.05)' : 'rgba(14,165,198,0.04)',
                border: timeRemaining < 300 ? '1px solid var(--c-red-200)' : '1px solid var(--c-emerald-100)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Timer color={timeRemaining < 300 ? 'error' : 'primary'} sx={{ fontSize: 20 }} />
                <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', letterSpacing: '0.08em' }}>
                  TIME REMAINING
                </Typography>
              </Box>
              <Typography
                variant="h3"
                fontWeight={900}
                color={timeRemaining < 300 ? 'error.main' : 'primary.main'}
                sx={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}
              >
                {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
              </Typography>
              {timeRemaining < 300 && (
                <Typography variant="caption" color="error.main" sx={{ fontWeight: 700, mt: 0.5 }}>
                  ⚠ AUTO-SUBMIT IMMINENT
                </Typography>
              )}
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Progress metrics */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary' }}>PROGRESS</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: 'primary.main' }}>
                    {answeredCount} / {activeQuestions.length}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={progress}
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    bgcolor: 'var(--c-slate-100)',
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 4,
                      background: 'linear-gradient(90deg, var(--c-emerald-500), var(--c-emerald-600))',
                    }
                  }}
                />
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">Answered</Typography>
                <Chip label={answeredCount} color="success" size="small" sx={{ fontWeight: 800, minWidth: 40 }} />
              </Box>

              {unansweredCount > 0 ? (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">Unanswered</Typography>
                  <Chip label={unansweredCount} color="warning" size="small" sx={{ fontWeight: 800, minWidth: 40 }} />
                </Box>
              ) : (
                <Box sx={{ p: 1.5, bgcolor: 'var(--c-green-50)', borderRadius: 2, border: '1px solid var(--c-green-200)', textAlign: 'center' }}>
                  <Typography variant="body2" color="var(--c-green-800)" fontWeight="bold">✓ All Questions Answered!</Typography>
                </Box>
              )}
            </Box>

            {/* Submit Button */}
            <Button
              variant="contained"
              fullWidth
              size="large"
              onClick={() => setOpenSubmitDialog(true)}
              sx={{
                py: 1.5,
                borderRadius: 3,
                fontWeight: 800,
                textTransform: 'none',
                fontSize: '0.95rem',
                background: 'linear-gradient(135deg, var(--c-emerald-500) 0%, var(--c-emerald-600) 100%)',
                boxShadow: '0 4px 15px rgba(14,165,198,0.3)',
                '&:hover': {
                  transform: 'translateY(-1px)',
                  boxShadow: '0 6px 20px rgba(14,165,198,0.4)',
                }
              }}
            >
              Submit Assessment
            </Button>
          </Paper>

          {/* Question Grid Index Card */}
          <Paper
            elevation={0}
            sx={{ p: 3, borderRadius: 4, border: '1px solid var(--c-slate-200)', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'text.secondary' }}>
                QUESTION INDEX
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: 'var(--c-emerald-500)' }} />
                <Typography variant="caption" color="text.secondary" fontWeight={600}>Done</Typography>
                <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: 'var(--c-slate-100)', border: '1px solid var(--c-slate-300)', ml: 1 }} />
                <Typography variant="caption" color="text.secondary" fontWeight={600}>Blank</Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {activeQuestions.map((q: any, idx: number) => {
                const isAnswered = answers[q.id] !== undefined && String(answers[q.id]).trim() !== '';
                return (
                  <Box
                    key={q.id}
                    onClick={() => {
                      const el = document.getElementById(q.id);
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: isAnswered ? 'var(--c-emerald-500)' : 'var(--c-slate-100)',
                      color: isAnswered ? 'white' : 'var(--c-slate-500)',
                      fontWeight: 800,
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      border: '1.5px solid transparent',
                      transition: 'all 0.15s',
                      '&:hover': {
                        borderColor: 'var(--c-emerald-500)',
                        transform: 'scale(1.1)',
                        bgcolor: isAnswered ? 'var(--c-emerald-600)' : 'var(--c-slate-200)',
                      }
                    }}
                  >
                    {idx + 1}
                  </Box>
                );
              })}
            </Box>
          </Paper>
        </Box>

        {/* Mobile: Bottom fixed bar for timer on small screens */}
      </Box>

      {/* Mobile sticky bottom bar */}
      <Box
        sx={{
          display: { xs: 'flex', md: 'none' },
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          bgcolor: 'var(--c-surface)',
          borderTop: '1px solid var(--c-slate-200)',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.08)',
          p: 2,
          gap: 2,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Timer color={timeRemaining < 300 ? 'error' : 'primary'} />
          <Typography
            variant="h6"
            fontWeight={900}
            color={timeRemaining < 300 ? 'error.main' : 'primary.main'}
            sx={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </Typography>
          <Typography variant="caption" color="text.secondary" fontWeight={700}>
            {answeredCount}/{activeQuestions.length} done
          </Typography>
        </Box>
        <Button
          variant="contained"
          size="small"
          onClick={() => setOpenSubmitDialog(true)}
          sx={{
            fontWeight: 800,
            textTransform: 'none',
            borderRadius: 2.5,
            background: 'linear-gradient(135deg, var(--c-emerald-500) 0%, var(--c-emerald-600) 100%)',
            px: 3
          }}
        >
          Submit
        </Button>
      </Box>

      {/* Confirmation Submit Dialog */}
      <Dialog open={openSubmitDialog} onClose={() => setOpenSubmitDialog(false)} PaperProps={{ sx: { borderRadius: 4, p: 1 } }}>
        <DialogTitle sx={{ fontWeight: 900 }}>Submit Your Assessment?</DialogTitle>
        <DialogContent sx={{ mt: 1 }}>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            Are you sure you want to finalize and log your assessment answers?
          </Typography>
          <Box sx={{ mt: 2.5, p: 2, bgcolor: 'var(--c-slate-50)', borderRadius: 3 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Answered: <strong>{answeredCount} / {activeQuestions.length}</strong>
            </Typography>
            {unansweredCount > 0 ? (
              <Typography variant="body2" color="error.main" fontWeight="bold">
                Attention: You have {unansweredCount} unanswered question(s)!
              </Typography>
            ) : (
              <Typography variant="body2" color="success.main" fontWeight="bold">
                Excellent! All questions have been addressed.
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenSubmitDialog(false)} sx={{ fontWeight: 700 }}>Continue Exam</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            color="success"
            sx={{ borderRadius: 2.5, fontWeight: 700, px: 3 }}
          >
            Submit Exam
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
