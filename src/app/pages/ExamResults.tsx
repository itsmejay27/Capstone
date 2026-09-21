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
} from '@mui/icons-material';

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
  const rawPercentage = ((attempt.score || 0) / exam.totalPoints) * 100;
  
  let transmutedPercentage = 0;
  if (rawPercentage >= 65) {
    transmutedPercentage = 75 + ((rawPercentage - 65) * 25) / 35;
  } else {
    transmutedPercentage = 50 + (rawPercentage * 25) / 65;
  }
  
  const passed = transmutedPercentage >= 75;

  // Use the specific questions drawer preserved in the attempt!
  const questionsToReview = attempt.questions || exam.questions;

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate(`/classroom/${classroom?.id}`)}
        sx={{ mb: 3 }}
      >
        Back to Classroom
      </Button>

      <Paper sx={{ p: 4, mb: 3, textAlign: 'center', borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
        <Grade sx={{ fontSize: 80, color: passed ? 'success.main' : 'error.main', mb: 2 }} />
        <Typography variant="h3" fontWeight="bold" gutterBottom>
          {attempt.score} / {exam.totalPoints}
        </Typography>
        
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 4, my: 2, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.85rem' }}>
              RAW SCORE PERCENTAGE
            </Typography>
            <Typography variant="h5" fontWeight="bold" color="text.primary">
              {rawPercentage.toFixed(1)}%
            </Typography>
          </Box>
          <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />
          <Box>
            <Typography variant="caption" color="primary.main" sx={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold' }}>
              TRANSMUTED GRADE PERCENTAGE
            </Typography>
            <Typography variant="h5" fontWeight="bold" color="#4caf50">
              {transmutedPercentage.toFixed(1)}%
            </Typography>
          </Box>
        </Box>

        <Chip
          label={passed ? 'PASSED (Base-65 Transmuted)' : 'NEEDS IMPROVEMENT'}
          color={passed ? 'success' : 'error'}
          sx={{ mt: 2, px: 3, py: 2, fontSize: '1rem', fontWeight: 'bold' }}
        />
      </Paper>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 6 }} sx={{ display: 'flex' }}>
          <Card variant="outlined" sx={{ width: '100%', height: '100%', borderRadius: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Assignment sx={{ mr: 1, color: '#1976d2' }} />
                <Typography variant="h6" fontWeight="bold">Exam Details</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                <strong>Title:</strong> {exam.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Classroom:</strong> {classroom?.name || 'Classroom'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Questions Taken:</strong> {questionsToReview.length} items
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }} sx={{ display: 'flex' }}>
          <Card variant="outlined" sx={{ width: '100%', height: '100%', borderRadius: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Timer sx={{ mr: 1, color: '#1976d2' }} />
                <Typography variant="h6" fontWeight="bold">Submission Info</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                <strong>Started At:</strong>{' '}
                {attempt.startedAt ? new Date(attempt.startedAt).toLocaleString() : 'N/A'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Submitted At:</strong>{' '}
                {attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : 'N/A'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }}>
        <Typography variant="h6" gutterBottom fontWeight="bold">
          Performance Summary
        </Typography>
        
        {/* Raw Score progress */}
        <Box sx={{ mt: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2">Raw score percentage</Typography>
            <Typography variant="body2" fontWeight="bold">
              {rawPercentage.toFixed(1)}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={Math.min(100, rawPercentage)}
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: '#e0e0e0',
              '& .MuiLinearProgress-bar': {
                bgcolor: rawPercentage >= 65 ? 'success.light' : 'error.light',
              },
            }}
          />
        </Box>

        {/* Transmuted Grade progress */}
        <Box sx={{ mt: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" fontWeight="bold">Transmuted grade percentage (Base-65 Passing)</Typography>
            <Typography variant="body2" fontWeight="bold" color="#4caf50">
              {transmutedPercentage.toFixed(1)}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={Math.min(100, transmutedPercentage)}
            sx={{
              height: 10,
              borderRadius: 5,
              bgcolor: '#e0e0e0',
              '& .MuiLinearProgress-bar': {
                bgcolor: passed ? 'success.main' : 'error.main',
              },
            }}
          />
        </Box>
      </Paper>

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
            let isCorrect = false;
            if (isAnswered) {
              if (question.type === 'multiple-choice') {
                isCorrect = studentAnswer === question.correctAnswer;
              } else if (question.type === 'true-false') {
                isCorrect = String(studentAnswer).toLowerCase() === String(question.correctAnswer).toLowerCase();
              } else if (question.type === 'short-answer') {
                isCorrect = String(studentAnswer).trim().toLowerCase() === String(question.correctAnswer).trim().toLowerCase();
              } else {
                isCorrect = true; // Essays default positive if answered
              }
            }

            const pointsEarned = isCorrect ? question.points : 0;

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
