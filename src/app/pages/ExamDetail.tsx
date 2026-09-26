import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  Box, Typography, Paper, Button, Divider, IconButton, Menu, MenuItem, Snackbar, Alert, Chip,
} from '@mui/material';
import {
  Quiz, MoreVert, PeopleOutline, PersonOutline, ArrowBack, AccessTime, HelpOutline, Replay, Link as LinkIcon,
  PlayArrow, Assessment,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import CommentThread from '../components/CommentThread';
import { classThemeFor } from '../theme/classThemes';
import { gradeFor, isPending } from '../services/grading';

/**
 * An exam on its own page, like an assignment in Google Classroom: title, teacher and date,
 * points and due date, instructions, class comments, and for students a "Your work" panel
 * with the button that starts (or continues, or reviews) the exam, plus private comments.
 * The stream, the Classwork list, To-do and the email link all open this page.
 */
export default function ExamDetail() {
  const { classroomId = '', examId = '' } = useParams();
  const navigate = useNavigate();
  const { currentUser, users, classrooms, exams, examAttempts, comments, saveComment, deleteComment } = useAuth();
  const [menuEl, setMenuEl] = useState<HTMLElement | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const classroom = classrooms.find((c: any) => c.id === classroomId);
  const exam = exams.find((e: any) => e.id === examId && e.classroomId === classroomId);
  const theme = classThemeFor(classroom?.theme);
  const isInstructor = currentUser?.role === 'instructor';
  const opensAt = exam?.postDate ? new Date(exam.postDate) : null;
  const notYetOpen = !isInstructor && opensAt && opensAt.getTime() > Date.now();

  if (!classroom || !exam || notYetOpen) {
    return (
      <Box sx={{ p: 6, textAlign: 'center' }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {notYetOpen ? 'This exam is not open yet' : 'This exam is not available'}
        </Typography>
        <Typography variant="body2" sx={{ color: 'var(--c-ink-secondary)', mb: 2 }}>
          {notYetOpen
            ? `It opens ${opensAt!.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.`
            : 'It may have been removed, or you are not in this class.'}
        </Typography>
        <Button onClick={() => navigate(classroom ? `/classroom/${classroomId}` : '/dashboard')}>Go back</Button>
      </Box>
    );
  }

  const teacher = users.find((u: any) => u.id === classroom.instructorId);
  const posted = new Date(exam.postDate || exam.createdAt || Date.now());
  const postedLabel = posted.toDateString() === new Date().toDateString()
    ? posted.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : posted.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const due = exam.dueDate ? new Date(exam.dueDate) : null;
  const pastDue = Boolean(due && due.getTime() < Date.now());
  const closed = pastDue && exam.allowLate === false;
  const questionCount = exam.activeQuestionCount || exam.questions?.length || 0;

  // ── Student's own attempt ──
  const attempt = examAttempts.find((a: any) => a.examId === exam.id && a.studentId === currentUser?.id);
  const submitted = Boolean(attempt?.submittedAt);
  const inProgress = Boolean(attempt?.startedAt) && !submitted;
  const secondsLeft = inProgress
    ? Math.max(0, Math.round((new Date(attempt.startedAt).getTime() + (exam.duration || 0) * 60_000 - Date.now()) / 1000))
    : 0;
  const graded = submitted && !isPending(attempt);
  const g = graded ? gradeFor(attempt.score || 0, exam.totalPoints || 0) : null;
  const status = submitted
    ? (graded ? `${attempt.score ?? 0}/${exam.totalPoints}` : 'Turned in')
    : inProgress ? 'In progress'
    : pastDue ? (closed ? 'Closed' : 'Missing')
    : 'Assigned';
  const statusColor = status === 'Missing' || status === 'Closed' ? '#d93025' : submitted || inProgress ? 'var(--c-ink-secondary)' : '#188038';

  // ── Instructor summary ──
  const classAttempts = examAttempts.filter((a: any) => a.examId === exam.id);
  const turnedIn = classAttempts.filter((a: any) => a.submittedAt).length;
  const toCheck = classAttempts.filter((a: any) => a.submittedAt && isPending(a)).length;
  const studentCount = classroom.students?.length || 0;

  const info = (Icon: any, label: string) => (
    <Chip size="small" icon={<Icon sx={{ fontSize: '16px !important' }} />} label={label} sx={{ bgcolor: 'var(--c-surface-sunken)', fontWeight: 600 }} />
  );

  return (
    <Box sx={{ maxWidth: 1180, mx: 'auto', px: { xs: 2, md: 3 }, py: 3 }}>
      <Button startIcon={<ArrowBack />} onClick={() => navigate(`/classroom/${classroomId}`)} sx={{ textTransform: 'none', mb: 1, color: 'var(--c-ink-secondary)' }}>
        {classroom.name}
      </Button>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: isInstructor ? '1fr' : '1fr 300px' }, gap: 4, alignItems: 'start' }}>
        {/* Main column */}
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
            <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: theme.flat, color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0, mt: 0.5 }}>
              <Quiz fontSize="small" />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                <Typography sx={{ flex: 1, fontSize: { xs: '1.6rem', md: '2rem' }, fontWeight: 400, color: theme.flat, lineHeight: 1.25, wordBreak: 'break-word' }}>{exam.title}</Typography>
                <IconButton onClick={(e) => setMenuEl(e.currentTarget)} aria-label="More"><MoreVert /></IconButton>
              </Box>
              <Typography variant="body2" sx={{ color: 'var(--c-ink-secondary)', mt: 0.5 }}>
                {(teacher?.name || 'Teacher').toUpperCase()} • {postedLabel}
                {isInstructor && opensAt && opensAt.getTime() > Date.now() && (
                  <Box component="span" sx={{ color: 'var(--c-amber-700)', fontWeight: 700 }}>
                    {' '}• Scheduled for {opensAt.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </Box>
                )}
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>{exam.totalPoints} points</Typography>
                {due && (
                  <Typography variant="body2" sx={{ fontWeight: 500, color: pastDue && !submitted && !isInstructor ? '#d93025' : 'inherit' }}>
                    Due {due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, {due.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </Typography>
                )}
              </Box>
              <Divider sx={{ my: 2, borderColor: theme.flat, opacity: 0.6 }} />

              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                {info(AccessTime, `${exam.duration} min time limit`)}
                {info(HelpOutline, `${questionCount} question${questionCount === 1 ? '' : 's'}`)}
                {info(Replay, `${exam.allowedAttempts || 1} attempt${(exam.allowedAttempts || 1) === 1 ? '' : 's'}`)}
                {exam.allowLate === false && info(AccessTime, 'No late submissions')}
              </Box>

              {(exam.instructions || exam.description) && (
                <Typography sx={{ whiteSpace: 'pre-line', mb: 2, fontSize: '0.92rem' }}>{exam.instructions || exam.description}</Typography>
              )}

              {isInstructor && (
                <Paper elevation={0} sx={{ p: 2, borderRadius: '8px', border: '1px solid var(--c-border)', mb: 2, display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
                  <Box><Typography sx={{ fontSize: '1.8rem', fontWeight: 400 }}>{turnedIn}</Typography><Typography variant="caption">Turned in</Typography></Box>
                  <Box><Typography sx={{ fontSize: '1.8rem', fontWeight: 400 }}>{Math.max(0, studentCount - turnedIn)}</Typography><Typography variant="caption">Not yet</Typography></Box>
                  {toCheck > 0 && <Box><Typography sx={{ fontSize: '1.8rem', fontWeight: 400, color: '#b06000' }}>{toCheck}</Typography><Typography variant="caption">To check</Typography></Box>}
                  <Box sx={{ flex: 1 }} />
                  <Button variant="outlined" startIcon={<Assessment />} onClick={() => navigate(`/classroom/${classroomId}?tab=gradebook`)} sx={{ textTransform: 'none', borderRadius: 999 }}>
                    Open in Grades
                  </Button>
                </Paper>
              )}

              <Divider sx={{ mb: 1 }} />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, color: 'var(--c-ink-secondary)' }}>
                <PeopleOutline fontSize="small" />
                <Typography variant="body2" sx={{ fontWeight: 600 }}>Class comments</Typography>
              </Box>
              <CommentThread
                classroomId={classroomId}
                postType="classwork"
                postId={exam.id}
                comments={comments}
                currentUserId={currentUser?.id || ''}
                currentUserName={currentUser?.name || ''}
                isInstructor={isInstructor}
                onSave={saveComment}
                onDelete={deleteComment}
                fixedVisibility="class"
              />
            </Box>
          </Box>
        </Box>

        {/* Your work + private comments (students) */}
        {!isInstructor && (
          <Box>
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,.2)', mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 2 }}>
                <Typography sx={{ fontSize: '1.3rem', fontWeight: 400 }}>Your work</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: statusColor }}>{status}</Typography>
              </Box>

              {g && (
                <Chip size="small" label={`Grade ${g.grade} · ${g.remark}`} sx={{ mb: 1.5, bgcolor: g.bg, color: g.color, fontWeight: 800 }} />
              )}
              {submitted && !graded && (
                <Typography variant="body2" sx={{ color: 'var(--c-ink-secondary)', mb: 1.5 }}>
                  Your written answers are being checked. Your score appears here once your teacher is done.
                </Typography>
              )}
              {inProgress && (
                <Typography variant="body2" sx={{ color: 'var(--c-ink-secondary)', mb: 1.5 }}>
                  You started this exam. {secondsLeft > 0 ? `About ${Math.ceil(secondsLeft / 60)} min left on the timer.` : 'Time is up — open it to submit.'}
                </Typography>
              )}
              {!submitted && !inProgress && !closed && (
                <Typography variant="body2" sx={{ color: 'var(--c-ink-secondary)', mb: 1.5 }}>
                  {exam.duration} minutes, {questionCount} questions. The timer starts when you press Start on the next screen.
                </Typography>
              )}
              {closed && !submitted && !inProgress && (
                <Typography variant="body2" sx={{ color: '#d93025', mb: 1.5 }}>
                  This exam closed on its due date and late submissions are not accepted.
                </Typography>
              )}

              {submitted ? (
                <Button fullWidth variant="outlined" onClick={() => navigate(`/exam/${exam.id}/results`)} sx={{ textTransform: 'none', borderRadius: 999 }}>
                  View results
                </Button>
              ) : (
                <Button fullWidth variant="contained" startIcon={<PlayArrow />} disabled={closed && !inProgress}
                  onClick={() => navigate(`/exam/${exam.id}/take`)}
                  sx={{ textTransform: 'none', borderRadius: 999, fontWeight: 700, bgcolor: theme.flat, '&:hover': { bgcolor: theme.flat, filter: 'brightness(.92)' } }}>
                  {inProgress ? 'Continue exam' : 'Take exam'}
                </Button>
              )}
              {pastDue && !submitted && !closed && (
                <Typography variant="caption" sx={{ display: 'block', mt: 1, color: '#d93025' }}>Past due — it will be marked late.</Typography>
              )}
            </Paper>

            <Paper elevation={0} sx={{ p: 2.5, borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <PersonOutline fontSize="small" />
                <Typography variant="body2" sx={{ fontWeight: 600 }}>Private comments</Typography>
              </Box>
              <CommentThread
                classroomId={classroomId}
                postType="classwork"
                postId={exam.id}
                comments={comments}
                currentUserId={currentUser?.id || ''}
                currentUserName={currentUser?.name || ''}
                isInstructor={false}
                onSave={saveComment}
                onDelete={deleteComment}
                fixedVisibility="private"
              />
            </Paper>
          </Box>
        )}
      </Box>

      <Menu anchorEl={menuEl} open={Boolean(menuEl)} onClose={() => setMenuEl(null)}>
        <MenuItem onClick={async () => {
          setMenuEl(null);
          try { await navigator.clipboard.writeText(window.location.href); setToast('Link copied.'); } catch { /* ignore */ }
        }}>
          <LinkIcon fontSize="small" sx={{ mr: 1 }} /> Copy link
        </MenuItem>
        {isInstructor && (
          <MenuItem onClick={() => { setMenuEl(null); navigate(`/classroom/${classroomId}?tab=gradebook`); }}>Open in Grades</MenuItem>
        )}
      </Menu>

      <Snackbar open={Boolean(toast)} autoHideDuration={3000} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" onClose={() => setToast(null)}>{toast}</Alert>
      </Snackbar>
    </Box>
  );
}
