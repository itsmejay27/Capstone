import { useParams, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import {
  Container,
  Paper,
  Typography,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  Divider,
  LinearProgress,
} from '@mui/material';
import {
  ArrowBack,
  CheckCircle,
  Cancel,
  Grade,
  Timer,
  Assignment,
  HelpOutline,
  HourglassTop,
} from '@mui/icons-material';
import { gradeFor, isPending, autoPoints } from '../services/grading';
import { formatDuration } from '../hooks/useExamGuard';

export default function ExamResults() {
  const { examId } = useParams();
  const { currentUser, exams, examAttempts, classrooms } = useAuth();
  const navigate = useNavigate();

  const exam = exams.find((e) => e.id === examId);
  const attempt = examAttempts.find(
    (a) => a.examId === examId && a.studentId === currentUser?.id
  );
  const classroom = classrooms.find((c) => c.id === exam?.classroomId);

  if (!exam || !attempt) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography>Results not found. Please complete the exam first.</Typography>
      </Container>
    );
  }

  const isInstructor = currentUser?.role === 'instructor';
  // Use the specific questions drawer preserved in the attempt!
  const questionsToReview = attempt.questions?.length ? attempt.questions : exam.questions;
  const pending = isPending(attempt);
  const result = gradeFor(attempt.score || 0, exam.totalPoints);
  const answeredCount = questionsToReview.filter((q: any) => {
    const v = attempt.answers?.[q.id];
    return v !== undefined && v !== null && String(v).trim() !== '';
  }).length;
  const typeCounts = questionsToReview.reduce((m: Record<string, number>, q: any) => ({ ...m, [q.type]: (m[q.type] || 0) + 1 }), {});
  const typeLabel: Record<string, string> = { 'multiple-choice': 'Multiple choice', 'true-false': 'True/False', 'short-answer': 'Short answer', essay: 'Essay' };
  const receiptId = String(attempt.id).replace(/[^a-z0-9]/gi, '').slice(-8).toUpperCase();
  const timing = (attempt as any).timing;

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate(`/classroom/${classroom?.id}`)}
        sx={{ mb: 3 }}
      >
        Back to Classroom
      </Button>

      {/* Confirmation that the exam was received */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 3, border: '1px solid var(--c-green-100)', bgcolor: 'var(--c-surface)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
          <CheckCircle sx={{ color: 'success.main', fontSize: 34 }} />
          <Box>
            <Typography variant="h6" fontWeight="bold">Exam submitted</Typography>
            <Typography variant="body2" color="text.secondary">
              Your answers were received{attempt.submittedAt ? ` on ${new Date(attempt.submittedAt).toLocaleString()}` : ''}. Keep this confirmation number: <strong>#{receiptId}</strong>
            </Typography>
          </Box>
        </Box>
      </Paper>

      <Paper sx={{ p: 4, mb: 3, textAlign: 'center', borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
        {pending ? (
          <>
            <HourglassTop sx={{ fontSize: 72, color: 'warning.main', mb: 1 }} />
            <Typography variant="h5" fontWeight="bold" gutterBottom>Waiting for your instructor</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 460, mx: 'auto' }}>
              This exam has short-answer or essay questions that your instructor checks by hand.
              Your grade appears here once they finish.
            </Typography>
          </>
        ) : (
          <>
            <Grade sx={{ fontSize: 80, color: result.passed ? 'success.main' : 'error.main', mb: 2 }} />
            <Typography variant="h3" fontWeight="bold" gutterBottom>
              {attempt.score} / {exam.totalPoints}
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 4, my: 2, flexWrap: 'wrap' }}>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.85rem' }}>SCORE</Typography>
                <Typography variant="h5" fontWeight="bold">{result.pct.toFixed(1)}%</Typography>
              </Box>
              <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />
              <Box>
                <Typography variant="caption" color="primary.main" sx={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold' }}>GRADE (65–100)</Typography>
                <Typography variant="h5" fontWeight="bold" sx={{ color: result.passed ? 'success.main' : 'error.main' }}>{result.grade}</Typography>
              </Box>
            </Box>
            <Chip
              label={result.passed ? `PASSED · ${result.remark}` : 'NEEDS IMPROVEMENT'}
              color={result.passed ? 'success' : 'error'}
              sx={{ mt: 1, px: 3, py: 2, fontSize: '1rem', fontWeight: 'bold' }}
            />
            <LinearProgress variant="determinate" value={Math.min(100, result.pct)} sx={{ mt: 3, height: 8, borderRadius: 4 }} />
          </>
        )}
        {(attempt as any).feedback && (
          <Box sx={{ mt: 3, textAlign: 'left', p: 2, borderRadius: 2, bgcolor: 'var(--c-surface-sunken)' }}>
            <Typography variant="caption" fontWeight="bold">Instructor feedback</Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>{(attempt as any).feedback}</Typography>
          </Box>
        )}
      </Paper>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 6 }} sx={{ display: 'flex' }}>
          <Card variant="outlined" sx={{ width: '100%', height: '100%', borderRadius: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Assignment sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6" fontWeight="bold">Exam Details</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary"><strong>Title:</strong> {exam.title}</Typography>
              <Typography variant="body2" color="text.secondary"><strong>Classroom:</strong> {classroom?.name || 'Classroom'}{classroom?.subject ? ` · ${classroom.subject}` : ''}</Typography>
              <Typography variant="body2" color="text.secondary"><strong>Items:</strong> {questionsToReview.length} · <strong>Total points:</strong> {exam.totalPoints}</Typography>
              {exam.duration ? <Typography variant="body2" color="text.secondary"><strong>Time limit:</strong> {exam.duration} minutes</Typography> : null}
              {exam.dueDate && <Typography variant="body2" color="text.secondary"><strong>Due:</strong> {new Date(exam.dueDate).toLocaleString()}</Typography>}
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
                {Object.entries(typeCounts).map(([t, n]) => <Chip key={t} size="small" label={`${typeLabel[t] || t}: ${n}`} />)}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }} sx={{ display: 'flex' }}>
          <Card variant="outlined" sx={{ width: '100%', height: '100%', borderRadius: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Timer sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6" fontWeight="bold">Submission Info</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary"><strong>Started:</strong> {attempt.startedAt ? new Date(attempt.startedAt).toLocaleString() : 'N/A'}</Typography>
              <Typography variant="body2" color="text.secondary"><strong>Submitted:</strong> {attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : 'N/A'}</Typography>
              {timing?.totalSeconds ? <Typography variant="body2" color="text.secondary"><strong>Time spent:</strong> {formatDuration(timing.totalSeconds)} (about {formatDuration(timing.averageSecondsPerQuestion)} per item)</Typography> : null}
              <Typography variant="body2" color="text.secondary"><strong>Answered:</strong> {answeredCount} of {questionsToReview.length}</Typography>
              <Typography variant="body2" color="text.secondary"><strong>Status:</strong> {pending ? 'Waiting for instructor check' : 'Graded'}{(attempt as any).isLate ? ' · submitted late' : ''}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {isInstructor && (
        <Paper sx={{ p: 3, borderRadius: 3 }}>
          <Typography variant="h6" gutterBottom fontWeight="bold">
            Question Review
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Reviewing student submission with complete grading keys.
          </Typography>
          <Divider sx={{ mb: 3 }} />

          {questionsToReview.map((question: any, index: number) => {
            const studentAnswer = attempt.answers[question.id];
            const isAnswered = studentAnswer !== undefined && studentAnswer !== null && String(studentAnswer).trim() !== '';
            
            // Determine correctness
            const auto = autoPoints(question, studentAnswer);
            const manual = (attempt as any).manualScores?.[question.id];
            const pointsEarned = auto !== null ? auto : (typeof manual === 'number' ? manual : 0);
            const isCorrect = isAnswered && pointsEarned >= (question.points || 0) && pointsEarned > 0;

            return (
              <Box key={question.id} sx={{ mb: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'start', mb: 1 }}>
                  {isCorrect ? (
                    <CheckCircle sx={{ color: 'success.main', mr: 1, mt: 0.5 }} />
                  ) : (
                    <Cancel sx={{ color: 'error.main', mr: 1, mt: 0.5 }} />
                  )}
                  
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="body1" fontWeight="bold">
                      Question {index + 1}: {question.question}
                    </Typography>

                    {/* Render question image if present */}
                    {question.image && (
                      <Box sx={{ my: 1.5 }}>
                        <img src={question.image} alt="diagram" style={{ maxWidth: '100%', maxHeight: '180px', borderRadius: '4px' }} />
                      </Box>
                    )}

                    {/* Multiple Choice rendering */}
                    {question.type === 'multiple-choice' && question.options && (
                      <Box sx={{ mt: 1, ml: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {question.options.map((option: string, optIndex: number) => {
                          const isStudentAnswer = studentAnswer === optIndex;
                          const isCorrectAnswer = question.correctAnswer === optIndex;

                          // Styling criteria based on role
                          let textColor = 'text.secondary';
                          let fontWeight = 'normal';
                          let badgeText = '';

                          if (isCorrectAnswer) {
                            textColor = 'success.main';
                            fontWeight = 'bold';
                            badgeText = ' (Correct Key)';
                          }
                          if (isStudentAnswer && !isCorrectAnswer) {
                            textColor = 'error.main';
                            fontWeight = 'bold';
                            badgeText = ' (Student Choice)';
                          } else if (isStudentAnswer && isCorrectAnswer) {
                            badgeText = ' (Student Choice & Correct)';
                          }

                          return (
                            <Box key={optIndex} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <Typography
                                variant="body2"
                                sx={{
                                  color: textColor,
                                  fontWeight: fontWeight,
                                }}
                              >
                                {String.fromCharCode(65 + optIndex)}. {option}
                                {badgeText && <span style={{ fontStyle: 'italic', fontSize: '0.85rem' }}>{badgeText}</span>}
                              </Typography>
                              {question.optionsImages?.[optIndex] && (
                                <img
                                  src={question.optionsImages[optIndex]}
                                  alt={`Option ${optIndex}`}
                                  style={{ width: '35px', height: '35px', objectFit: 'cover', borderRadius: '4px' }}
                                />
                              )}
                            </Box>
                          );
                        })}
                      </Box>
                    )}

                    {/* True / False rendering */}
                    {question.type === 'true-false' && (
                      <Box sx={{ mt: 1, ml: 2 }}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: isCorrect ? 'success.main' : 'error.main' }}>
                          Your answer: {studentAnswer ? String(studentAnswer).toUpperCase() : 'Unanswered'}
                        </Typography>
                        {!isCorrect && (
                          <Typography variant="body2" color="success.main" sx={{ fontWeight: 'bold' }}>
                            Correct Key: {String(question.correctAnswer).toUpperCase()}
                          </Typography>
                        )}
                      </Box>
                    )}

                    {/* Short Answer rendering */}
                    {question.type === 'short-answer' && (
                      <Box sx={{ mt: 1, ml: 2 }}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: isCorrect ? 'success.main' : 'error.main' }}>
                          Your answer: "{studentAnswer || ''}"
                        </Typography>
                        {!isCorrect && (
                          <Typography variant="body2" color="success.main" sx={{ fontWeight: 'bold' }}>
                            Correct Key: "{question.correctAnswer}"
                          </Typography>
                        )}
                      </Box>
                    )}

                    {/* Essay rendering */}
                    {question.type === 'essay' && (
                      <Box sx={{ mt: 1, ml: 2, p: 1.5, bgcolor: '#fbfbfb', border: '1px solid #eee', borderRadius: 1 }}>
                        <Typography variant="body2" sx={{ fontStyle: 'italic', whiteSpace: 'pre-line' }}>
                          "{studentAnswer || '(No response entered)'}"
                        </Typography>
                      </Box>
                    )}

                    <Box sx={{ mt: 1.5 }}>
                      <Chip
                        label={`Score: ${pointsEarned} / ${question.points} pts`}
                        size="small"
                        color={isCorrect ? 'success' : 'default'}
                        variant="outlined"
                      />
                    </Box>
                  </Box>
                </Box>
                <Divider sx={{ mt: 3 }} />
              </Box>
            );
          })}
        </Paper>
      )}

      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Button
          variant="contained"
          onClick={() => navigate(`/classroom/${classroom?.id}`)}
          size="large"
          sx={{ px: 4 }}
        >
          Return to Classroom
        </Button>
      </Box>
    </Container>
  );
}
