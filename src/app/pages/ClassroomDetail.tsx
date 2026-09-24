import { useParams, useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { useIsMobile } from '../hooks/useResponsive';
import { tabSlugToIndex, tabIndexToSlug } from '../constants/classroomTabs';
import { uploadClassroomFile, formatBytes, fileExtension } from '../services/fileStorage';
import { extractFileText } from '../services/tosParser';
import AnnouncementFeed from '../components/AnnouncementFeed';
import ItemAnalysisPanel from '../components/ItemAnalysisPanel';
import ClassworkPanel from '../components/ClassworkPanel';
import {
  Container,
  Paper,
  Typography,
  Box,
  Tabs,
  Tab,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Divider,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  Menu,
} from '@mui/material';
import {
  ArrowBack,
  Quiz,
  Add,
  Schedule,
  CheckCircle,
  People,
  Assignment,
  Assessment,
  MenuBook,
  Upload,
  Delete,
  PictureAsPdf,
  Description,
  InsertDriveFile,
  Visibility,
  ContentCopy,
  Code,
  FolderOpen,
  Campaign,
  Download,
  AssignmentTurnedIn,
  Palette as PaletteIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import { CLASS_THEMES, classThemeFor, BANNER_GRID } from '../theme/classThemes';
import AttemptInsight from '../components/AttemptInsight';
import GradeAttemptDialog from '../components/GradeAttemptDialog';
import GradeSheet from '../components/GradeSheet';
import { gradeFor, isPending } from '../services/grading';
import { useState } from 'react';

function getMaterialIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return <PictureAsPdf sx={{ fontSize: 28, color: 'var(--c-red-600)' }} />;
  if (ext === 'doc' || ext === 'docx') return <Description sx={{ fontSize: 28, color: 'var(--c-emerald-600)' }} />;
  return <InsertDriveFile sx={{ fontSize: 28, color: 'var(--c-slate-500)' }} />;
}

export default function ClassroomDetail() {
  const { classroomId } = useParams();
  const {
    currentUser,
    users,
    classrooms,
    exams,
    examAttempts,
    classroomMaterials,
    addClassroomMaterial,
    deleteClassroomMaterial,
    announcements,
    saveAnnouncement,
    deleteAnnouncement,
    topics,
    classwork,
    submissions,
    comments,
    saveTopic,
    deleteTopic,
    saveClasswork,
    deleteClasswork,
    saveSubmission,
    saveComment,
    deleteComment,
    updateClassroom,
    submitExamAttempt,
    getCoteachLink,
    removeCoInstructor,
  } = useAuth();
  const [grading, setGrading] = useState<{ attempt: any; exam: any; studentName: string } | null>(null);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();

  const [viewMaterial, setViewMaterial] = useState<any | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [copyToast, setCopyToast] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadToast, setUploadToast] = useState<{ severity: 'success' | 'error'; message: string } | null>(null);

  const classroom = classrooms.find((c) => c.id === classroomId);
  const instructor = users.find((u) => u.id === classroom?.instructorId);
  const students = users.filter((u) => classroom?.students?.includes(u.id));

  const isInstructor = currentUser?.role === 'instructor';
  const [themeAnchor, setThemeAnchor] = useState<HTMLElement | null>(null);
  const classTheme = classThemeFor(classroom?.theme);
  const materials = classroomMaterials[classroomId || ''] || [];
  const classAnnouncements = announcements[classroomId || ''] || [];
  const classTopics = topics[classroomId || ''] || [];
  const classClasswork = classwork[classroomId || ''] || [];

  // Tab selection lives in the URL (?tab=gradebook) so the hamburger drawer can deep-link
  // straight to a tab, and so a tab is bookmarkable and survives the browser back button.
  const activeTab = tabSlugToIndex(searchParams.get('tab'), isInstructor);
  const setActiveTab = (index: number) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', tabIndexToSlug(index, isInstructor));
    setSearchParams(next, { replace: true });
  };

  if (!classroom) {
    return (
      <Container maxWidth="lg" sx={{ py: 6, textAlign: 'center' }}>
        <Paper elevation={0} sx={{ p: 5, borderRadius: 3, border: '1px solid var(--c-slate-200)', bgcolor: 'var(--c-surface)' }}>
          <FolderOpen sx={{ fontSize: 48, color: 'var(--c-slate-400)', mb: 1.5 }} />
          <Typography variant="h6" fontWeight={800} color="text.primary">Classroom not found</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            The requested classroom may have been removed or archived.
          </Typography>
          <Button variant="contained" onClick={() => navigate('/dashboard')} sx={{ bgcolor: 'var(--c-emerald-600)', fontWeight: 700 }}>
            Back to Dashboard
          </Button>
        </Paper>
      </Container>
    );
  }

  // Filter classroom exams
  const rawClassExams = exams.filter((e) => e.classroomId === classroomId);
  const classExams = isInstructor
    ? rawClassExams
    : rawClassExams.filter((e) => {
        if (!e.postDate) return true;
        return new Date(e.postDate) <= new Date();
      });

  const getExamStatus = (examId: string) => {
    const attempt = examAttempts.find(
      (a) => a.examId === examId && a.studentId === currentUser?.id
    );
    if (attempt?.submittedAt) return 'completed';
    if (attempt?.startedAt) return 'in-progress';
    return 'not-started';
  };

  /**
   * Upload a course material.
   *
   * Previously this built a metadata-only object: the File's bytes were never read, fileUrl
   * was never set, and `content` was a hard-coded sentence — so the document could not be
   * viewed or downloaded, and after a reload it rendered as "1.2 MB • Invalid Date" with an
   * empty preview. Now the file is stored (Supabase Storage, or an inline data URL offline),
   * its text is extracted for the AI pipeline and the preview, and failures reach the user.
   */
  const handleMaterialUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !classroomId) return;

    setUploading(true);
    try {
      const stored = await uploadClassroomFile(classroomId, file);

      // Best-effort text extraction: it powers the preview dialog and the exam generator.
      // A failure here must not fail the upload — the file itself is already safe.
      let content: string | undefined;
      try {
        const text = await extractFileText(file);
        if (text && text.trim()) content = text.slice(0, 20000);
      } catch (err) {
        console.warn('[materials] text extraction failed; storing the file without extracted text:', err);
      }

      const material = {
        id: crypto.randomUUID(),
        classroomId,
        name: file.name,
        size: stored.size,
        type: stored.mimeType,
        fileType: fileExtension(file.name),
        fileUrl: stored.url,
        storagePath: stored.storagePath,
        isDataUrl: stored.isDataUrl,
        uploadedAt: new Date().toISOString(),
        uploadedBy: currentUser?.name || 'Instructor',
        uploadedById: currentUser?.id,
        content,
      };

      const result = await addClassroomMaterial(classroomId, material);
      setUploadToast(
        result.ok
          ? { severity: 'success', message: `"${file.name}" uploaded.` }
          : { severity: 'error', message: result.error || 'Upload failed.' }
      );
    } catch (err: any) {
      setUploadToast({ severity: 'error', message: err?.message || `Could not upload "${file.name}".` });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteMaterial = async (materialId: string) => {
    if (!classroomId) return;
    setDeleteConfirm(null);
    const result = await deleteClassroomMaterial(classroomId, materialId);
    if (!result.ok) {
      setUploadToast({ severity: 'error', message: result.error || 'Could not remove the document.' });
    }
  };

  const handleCopyInviteLink = async () => {
    const link = `${window.location.origin}/?join=${encodeURIComponent(classroom.classCode)}`;
    try {
      await navigator.clipboard.writeText(link);
      setUploadToast({ severity: 'success', message: `Invite link copied: ${link}` });
    } catch {
      window.prompt('Copy this invite link:', link);
    }
  };

  const handleCopyClassCode = () => {
    navigator.clipboard.writeText(classroom.classCode);
    setCopyToast(true);
  };

  // Delegates to the shared formatter, which returns an em dash for an unknown size rather
  // than the fabricated "1.2 MB" this used to print for every file whose size was lost.
  const formatFileSize = (bytes?: number) => formatBytes(bytes);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'var(--c-slate-50)', py: 3, px: { xs: 2, sm: 3, md: 5, lg: 6 } }}>
      <Container maxWidth="xl">
        {/* Navigation Breadcrumb */}
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/dashboard')}
          sx={{
            mb: 2.5,
            color: 'var(--c-slate-600)',
            fontWeight: 700,
            textTransform: 'none',
            '&:hover': { color: 'var(--c-slate-900)', bgcolor: 'rgba(0,0,0,0.04)' },
          }}
        >
          Back to Classrooms
        </Button>

        {/* ── Grounded LMS Classroom Header Banner ── */}
        <Paper
          elevation={0}
          sx={{
            mb: 3,
            borderRadius: 3.5,
            color: 'white',
            overflow: 'hidden',
            position: 'relative',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 24px 60px -30px rgba(0,0,0,0.6)',
            // The instructor's chosen theme, with the landing page's faint grid over it.
            backgroundImage: `${BANNER_GRID}, ${classTheme.background}`,
            // Grid lines tile; the theme's two gradient layers must not.
            backgroundSize: '44px 44px, 44px 44px, auto, auto',
            transition: 'background-image .3s ease',
          }}
        >
          {isInstructor && (
            <Tooltip title="Change class theme">
              <IconButton
                onClick={(e) => setThemeAnchor(e.currentTarget)}
                aria-label="Change class theme"
                sx={{ position: 'absolute', top: 12, right: 12, zIndex: 1, color: 'white', bgcolor: 'rgba(255,255,255,0.1)', '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' } }}
              >
                <PaletteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Menu anchorEl={themeAnchor} open={Boolean(themeAnchor)} onClose={() => setThemeAnchor(null)}>
            <Box sx={{ p: 1.5, display: 'grid', gridTemplateColumns: 'repeat(4, 64px)', gap: 1 }}>
              {CLASS_THEMES.map((t) => (
                <Box
                  key={t.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${t.name} theme`}
                  onClick={() => { updateClassroom(classroom.id, { theme: t.id }); setThemeAnchor(null); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { updateClassroom(classroom.id, { theme: t.id }); setThemeAnchor(null); } }}
                  sx={{ cursor: 'pointer', textAlign: 'center' }}
                >
                  <Box sx={{
                    height: 40, borderRadius: '10px', backgroundImage: t.background,
                    outline: classTheme.id === t.id ? `2px solid ${t.swatch}` : '1px solid var(--c-border)',
                    outlineOffset: 2, transition: 'transform .15s', '&:hover': { transform: 'scale(1.06)' },
                  }} />
                  <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.68rem' }}>{t.name}</Typography>
                </Box>
              ))}
            </Box>
          </Menu>
          <Box sx={{ p: { xs: 3, md: 4 }, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, gap: 3 }}>
            <Box>
              <Typography variant="h4" fontWeight={900} sx={{ letterSpacing: '-0.02em', mb: 0.5, fontSize: { xs: '1.6rem', md: '2.1rem' } }}>
                {classroom.name}
              </Typography>
              <Typography variant="subtitle1" sx={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
                {classroom.subject} &bull; Section {classroom.section}
              </Typography>
              {classroom.description && (
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.78)', mt: 1, maxWidth: 650, lineHeight: 1.5 }}>
                  {classroom.description}
                </Typography>
              )}

              {/* Class Info Pills */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 2.5, flexWrap: 'wrap' }}>
                <Tooltip title="Click to copy Class Code">
                  <Chip
                    icon={<Code sx={{ color: 'white !important', fontSize: '14px !important' }} />}
                    label={`Class Code: ${classroom.classCode}`}
                    onClick={handleCopyClassCode}
                    deleteIcon={<ContentCopy sx={{ color: 'white !important', fontSize: '13px !important' }} />}
                    onDelete={handleCopyClassCode}
                    sx={{
                      bgcolor: 'rgba(255,255,255,0.12)',
                      color: 'white',
                      fontWeight: 800,
                      fontSize: '0.75rem',
                      fontFamily: 'monospace',
                      cursor: 'pointer',
                      border: '1px solid rgba(255,255,255,0.2)',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' },
                    }}
                  />
                </Tooltip>

                {isInstructor && (
                  <Tooltip title="Copy a link students can open to join this class">
                    <Chip
                      icon={<LinkIcon sx={{ color: 'white !important', fontSize: '15px !important' }} />}
                      label="Copy invite link"
                      onClick={handleCopyInviteLink}
                      sx={{
                        bgcolor: 'rgba(255,255,255,0.12)', color: 'white', fontWeight: 800, fontSize: '0.75rem',
                        cursor: 'pointer', border: '1px solid rgba(255,255,255,0.2)',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' },
                      }}
                    />
                  </Tooltip>
                )}

                <Chip
                  icon={<People sx={{ color: 'white !important', fontSize: '14px !important' }} />}
                  label={`${classroom.students?.length || 0} Students`}
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.08)',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: '0.72rem',
                    border: '1px solid rgba(255,255,255,0.15)',
                  }}
                />

                {instructor && (
                  <Chip
                    avatar={<Avatar sx={{ width: 20, height: 20, bgcolor: 'var(--c-emerald-500)', fontSize: '0.65rem', color: 'white' }}>{instructor.name.charAt(0)}</Avatar>}
                    label={`Instructor: ${instructor.name}`}
                    sx={{
                      bgcolor: 'rgba(255,255,255,0.08)',
                      color: 'white',
                      fontWeight: 700,
                      fontSize: '0.72rem',
                      border: '1px solid rgba(255,255,255,0.15)',
                    }}
                  />
                )}
              </Box>
            </Box>

            {isInstructor && (
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => navigate(`/exam-generator/${classroomId}`)}
                  sx={{
                    bgcolor: 'var(--c-emerald-600)',
                    color: 'white',
                    fontWeight: 800,
                    px: 3,
                    py: 1.2,
                    borderRadius: 2.5,
                    textTransform: 'none',
                    boxShadow: '0 4px 14px rgba(5,150,105,0.4)',
                    '&:hover': { bgcolor: 'var(--c-emerald-700)' },
                  }}
                >
                  Create Exam for Class
                </Button>
              </Box>
            )}
          </Box>

          {/* Clean LMS Navigation Tabs */}
          <Tabs
            value={activeTab}
            onChange={(_, val) => setActiveTab(val)}
            variant="scrollable"
            scrollButtons="auto"
            // Without allowScrollButtonsMobile, MUI hides the scroll arrows on touch/small
            // viewports, leaving the tabs as an undiscoverable horizontal scroll strip.
            allowScrollButtonsMobile
            sx={{
              bgcolor: 'var(--c-banner-from)',
              borderTop: '1px solid var(--c-slate-700)',
              px: { xs: 0.5, sm: 2 },
              '& .MuiTab-root': {
                color: 'var(--c-slate-400)',
                fontWeight: 700,
                fontSize: { xs: '0.78rem', sm: '0.85rem' },
                textTransform: 'none',
                minHeight: 50,
                px: { xs: 1.5, sm: 3 },
                minWidth: 'auto',
              },
              '& .Mui-selected': {
                color: '#ffffff !important',
              },
              '& .MuiTabs-indicator': {
                bgcolor: 'var(--c-emerald-500)',
                height: 3,
              },
            }}
          >
            <Tab label="Stream" icon={<Campaign />} iconPosition="start" />
            <Tab label="Classwork" icon={<AssignmentTurnedIn />} iconPosition="start" />
            <Tab label="Assessments" icon={<Assignment />} iconPosition="start" />
            <Tab label="Course Materials" icon={<MenuBook />} iconPosition="start" />
            <Tab label="People & Roster" icon={<People />} iconPosition="start" />
            {isInstructor && (
              <Tab label="Gradebook" icon={<Assessment />} iconPosition="start" />
            )}
          </Tabs>
        </Paper>

        {/* ── TAB 0: STREAM (ANNOUNCEMENTS) ── */}
        {activeTab === 0 && (
          <AnnouncementFeed
            classroomId={classroomId || ''}
            announcements={classAnnouncements}
            isInstructor={isInstructor}
            currentUserId={currentUser?.id || ''}
            currentUserName={currentUser?.name || 'Instructor'}
            onSave={saveAnnouncement}
            onDelete={(id) => deleteAnnouncement(classroomId || '', id)}
            comments={comments}
            onSaveComment={saveComment}
            onDeleteComment={deleteComment}
          />
        )}

        {/* ── TAB 1: CLASSWORK (assignments, materials, questions, grouped by topic) ── */}
        {activeTab === 1 && (
          <ClassworkPanel
            classroomId={classroomId || ''}
            classwork={classClasswork}
            topics={classTopics}
            submissions={submissions}
            comments={comments}
            students={students}
            isInstructor={isInstructor}
            currentUserId={currentUser?.id || ''}
            currentUserName={currentUser?.name || 'User'}
            onSaveClasswork={saveClasswork}
            onDeleteClasswork={(id) => deleteClasswork(classroomId || '', id)}
            onSaveTopic={saveTopic}
            onDeleteTopic={(id) => deleteTopic(classroomId || '', id)}
            onSaveSubmission={saveSubmission}
            onSaveComment={saveComment}
            onDeleteComment={deleteComment}
          />
        )}

        {/* ── TAB 2: ASSESSMENTS (AI-generated exams) ── */}
        {activeTab === 2 && (
          <Box>
            {classExams.length === 0 ? (
              <Paper elevation={0} sx={{ p: 6, textAlign: 'center', borderRadius: 3.5, border: '1px solid var(--c-slate-200)', bgcolor: 'var(--c-surface)' }}>
                <Assignment sx={{ fontSize: 48, color: 'var(--c-slate-400)', mb: 1.5 }} />
                <Typography variant="h6" fontWeight={800} color="var(--c-slate-900)">No assessments scheduled yet</Typography>
                <Typography variant="body2" color="var(--c-slate-500)" sx={{ mb: 3, maxWidth: 360, mx: 'auto' }}>
                  {isInstructor
                    ? 'Generate a new examination with AI or assign an existing exam from your repository.'
                    : 'Your instructor has not posted any active exams yet. Check back soon.'}
                </Typography>
                {isInstructor && (
                  <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center' }}>
                    <Button variant="contained" onClick={() => navigate(`/exam-generator/${classroomId}`)} sx={{ bgcolor: 'var(--c-emerald-600)', fontWeight: 700, textTransform: 'none' }}>
                      Generate Exam
                    </Button>
                    <Button variant="outlined" onClick={() => navigate('/exam-repository')} sx={{ fontWeight: 700, textTransform: 'none' }}>
                      Assign from Repository
                    </Button>
                  </Box>
                )}
              </Paper>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {classExams.map((exam) => {
                  const status = !isInstructor ? getExamStatus(exam.id) : null;
                  const attempt = examAttempts.find(
                    (a) => a.examId === exam.id && a.studentId === currentUser?.id
                  );

                  return (
                    <Paper
                      key={exam.id}
                      elevation={0}
                      sx={{
                        p: 3,
                        borderRadius: 3,
                        bgcolor: 'var(--c-surface)',
                        border: '1px solid var(--c-slate-200)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                        display: 'flex',
                        flexDirection: { xs: 'column', md: 'row' },
                        alignItems: { xs: 'flex-start', md: 'center' },
                        justifyContent: 'space-between',
                        gap: 2.5,
                        transition: 'all 0.15s ease',
                        '&:hover': {
                          borderColor: 'var(--c-slate-300)',
                          boxShadow: '0 6px 18px rgba(0,0,0,0.05)',
                        },
                      }}
                    >
                      {/* Left: Icon + Title + Due Date */}
                      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', minWidth: 0, flexGrow: 1 }}>
                        <Box sx={{ width: 44, height: 44, borderRadius: 2.5, bgcolor: 'var(--c-emerald-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-emerald-600)', flexShrink: 0 }}>
                          <Assignment sx={{ fontSize: 24 }} />
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="subtitle1" fontWeight={800} sx={{ color: 'var(--c-slate-900)', lineHeight: 1.25, mb: 0.5 }}>
                            {exam.title}
                          </Typography>
                          {exam.description && (
                            <Typography variant="body2" noWrap sx={{ color: 'var(--c-slate-500)', fontSize: '0.82rem', mb: 1 }}>
                              {exam.description}
                            </Typography>
                          )}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                            {exam.dueDate && (
                              <Typography variant="caption" sx={{ color: 'var(--c-red-600)', fontWeight: 700 }}>
                                Due: {new Date(exam.dueDate).toLocaleDateString()} at {new Date(exam.dueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </Typography>
                            )}
                            <Typography variant="caption" sx={{ color: 'var(--c-slate-500)', fontWeight: 600 }}>
                              {exam.totalPoints} points &bull; {exam.duration} mins &bull; {exam.activeQuestionCount || exam.questions?.length || 0} questions
                            </Typography>
                          </Box>
                        </Box>
                      </Box>

                      {/* Right: Status / Action Button */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0, width: { xs: '100%', md: 'auto' }, justifyContent: { xs: 'space-between', md: 'flex-end' }, pt: { xs: 1.5, md: 0 }, borderTop: { xs: '1px solid var(--c-slate-100)', md: 'none' } }}>
                        {!isInstructor ? (
                          status === 'completed' ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              {isPending(attempt) ? (
                                <Chip label="Submitted · awaiting instructor check" size="small" sx={{ bgcolor: 'var(--c-amber-100)', color: 'var(--c-amber-800)', fontWeight: 800 }} />
                              ) : (
                                <Chip
                                  label={`Score: ${attempt?.score ?? 0} / ${exam.totalPoints} · Grade ${gradeFor(attempt?.score ?? 0, exam.totalPoints).grade}`}
                                  size="small"
                                  sx={{ bgcolor: 'var(--c-green-100)', color: 'var(--c-green-700)', fontWeight: 800 }}
                                />
                              )}
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => navigate(`/exam/${exam.id}/results`)}
                                sx={{ fontWeight: 700, textTransform: 'none' }}
                              >
                                View Results
                              </Button>
                            </Box>
                          ) : (
                            <Button
                              variant="contained"
                              onClick={() => navigate(`/exam/${exam.id}/take`)}
                              sx={{
                                bgcolor: 'var(--c-emerald-600)',
                                color: 'white',
                                fontWeight: 800,
                                px: 3,
                                py: 1,
                                borderRadius: 2,
                                textTransform: 'none',
                                '&:hover': { bgcolor: 'var(--c-emerald-700)' },
                              }}
                            >
                              Take Exam
                            </Button>
                          )
                        ) : (
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => setActiveTab(5)}
                              sx={{ fontWeight: 700, textTransform: 'none' }}
                            >
                              View Scores
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => navigate('/exam-repository')}
                              sx={{ fontWeight: 700, textTransform: 'none' }}
                            >
                              Edit in Repository
                            </Button>
                          </Box>
                        )}
                      </Box>
                    </Paper>
                  );
                })}
              </Box>
            )}
          </Box>
        )}

        {/* ── TAB 1: COURSE MATERIALS ── */}
        {activeTab === 3 && (
          <Box>
            {isInstructor && (
              <Box sx={{ mb: 3, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  component="label"
                  variant="contained"
                  startIcon={<Upload />}
                  sx={{ bgcolor: 'var(--c-emerald-600)', fontWeight: 800, textTransform: 'none', borderRadius: 2.5 }}
                >
                  {uploading ? 'Uploading…' : 'Upload Study Material'}
                  <input type="file" hidden disabled={uploading} onChange={handleMaterialUpload} accept=".pdf,.doc,.docx,.txt,.ppt,.pptx,.xlsx,.csv" />
                </Button>
              </Box>
            )}

            {materials.length === 0 ? (
              <Paper elevation={0} sx={{ p: 6, textAlign: 'center', borderRadius: 3.5, border: '1px solid var(--c-slate-200)', bgcolor: 'var(--c-surface)' }}>
                <MenuBook sx={{ fontSize: 48, color: 'var(--c-slate-400)', mb: 1.5 }} />
                <Typography variant="h6" fontWeight={800} color="var(--c-slate-900)">No study materials uploaded yet</Typography>
                <Typography variant="body2" color="var(--c-slate-500)" sx={{ maxWidth: 360, mx: 'auto' }}>
                  {isInstructor
                    ? 'Upload lecture notes, slide handouts, or syllabus files for students.'
                    : 'Course notes uploaded by your instructor will appear here.'}
                </Typography>
              </Paper>
            ) : (
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2.5 }}>
                {materials.map((mat: any) => (
                  <Paper
                    key={mat.id}
                    elevation={0}
                    sx={{
                      p: 2.5,
                      borderRadius: 3,
                      bgcolor: 'var(--c-surface)',
                      border: '1px solid var(--c-slate-200)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 2,
                      flexWrap: 'wrap',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0, flex: '1 1 200px' }}>
                      <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: 'var(--c-slate-50)', border: '1px solid var(--c-slate-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {getMaterialIcon(mat.name)}
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        {/* `noWrap` is a Typography PROP, not a CSS property — inside sx it was
                            emitted as an invalid declaration and dropped, so long filenames
                            never truncated. */}
                        <Typography variant="subtitle2" fontWeight={800} noWrap sx={{ color: 'var(--c-slate-900)' }} title={mat.name}>
                          {mat.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'var(--c-slate-500)', display: 'block' }}>
                          {formatFileSize(mat.size)}
                          {mat.uploadedAt && !Number.isNaN(new Date(mat.uploadedAt).getTime())
                            ? ` • Uploaded ${new Date(mat.uploadedAt).toLocaleDateString()}`
                            : ''}
                          {mat.uploadedBy ? ` • ${mat.uploadedBy}` : ''}
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<Visibility />}
                        onClick={() => setViewMaterial(mat)}
                        sx={{ fontWeight: 700, textTransform: 'none' }}
                      >
                        Preview
                      </Button>
                      {mat.fileUrl && (
                        <Tooltip title="Open the original file in a new tab">
                          <IconButton size="small" component="a" href={mat.fileUrl} target="_blank" rel="noopener noreferrer">
                            <Download fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {isInstructor && (
                        <IconButton size="small" color="error" onClick={() => setDeleteConfirm(mat.id)}>
                          <Delete fontSize="small" />
                        </IconButton>
                      )}
                    </Box>
                  </Paper>
                ))}
              </Box>
            )}
          </Box>
        )}

        {/* ── TAB 2: PEOPLE & ROSTER ── */}
        {activeTab === 4 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Teacher Card */}
            <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid var(--c-slate-200)', bgcolor: 'var(--c-surface)' }}>
              <Typography variant="subtitle2" fontWeight={800} sx={{ color: 'var(--c-slate-500)', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 2 }}>
                Teacher / Instructor
              </Typography>
              {instructor && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar sx={{ width: 44, height: 44, bgcolor: 'var(--c-emerald-700)', fontWeight: 800 }}>
                    {instructor.name.charAt(0)}
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle1" fontWeight={800} sx={{ color: 'var(--c-slate-900)' }}>
                      {instructor.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'var(--c-slate-500)' }}>
                      {instructor.email}
                    </Typography>
                  </Box>
                  <Chip label="Instructor" size="small" sx={{ ml: 'auto', bgcolor: 'var(--c-emerald-50)', color: 'var(--c-emerald-700)', fontWeight: 800 }} />
                </Box>
              )}
            </Paper>

            {/* Co-instructors. Only the class owner can invite or remove them. */}
            {(classroom.instructorId === currentUser?.id || (classroom.coInstructors || []).length > 0) && (
              <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid var(--c-slate-200)', bgcolor: 'var(--c-surface)' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 1, flexWrap: 'wrap' }}>
                  <Typography variant="subtitle2" fontWeight={800} sx={{ color: 'var(--c-slate-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Co-instructors ({(classroom.coInstructors || []).length})
                  </Typography>
                  {classroom.instructorId === currentUser?.id && (
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<LinkIcon />}
                      onClick={async () => {
                        const link = getCoteachLink(classroom.id);
                        if (!link) return;
                        try {
                          await navigator.clipboard.writeText(link);
                          setUploadToast({ severity: 'success', message: 'Instructor invite link copied. Only share it with instructors you trust — anyone with an instructor account who opens it can co-teach this class.' });
                        } catch {
                          window.prompt('Copy this instructor invite link:', link);
                        }
                      }}
                      sx={{ fontWeight: 700, textTransform: 'none' }}
                    >
                      Copy instructor invite link
                    </Button>
                  )}
                </Box>
                {(classroom.coInstructors || []).length === 0 ? (
                  <Typography variant="body2" color="var(--c-slate-500)">
                    No co-instructors yet. Send the instructor invite link to a colleague; they join after signing in with an instructor account.
                  </Typography>
                ) : (
                  <List disablePadding>
                    {(classroom.coInstructors || []).map((id: string) => {
                      const u = users.find((x) => x.id === id);
                      return (
                        <ListItem key={id} sx={{ px: 1 }}
                          secondaryAction={classroom.instructorId === currentUser?.id ? (
                            <Tooltip title="Remove co-instructor">
                              <IconButton edge="end" size="small" onClick={() => removeCoInstructor(classroom.id, id)}><Delete fontSize="small" /></IconButton>
                            </Tooltip>
                          ) : undefined}
                        >
                          <ListItemAvatar><Avatar src={u?.avatar} sx={{ width: 36, height: 36 }}>{u?.name?.charAt(0) || '?'}</Avatar></ListItemAvatar>
                          <ListItemText primary={u?.name || 'Instructor'} secondary={u?.email} />
                        </ListItem>
                      );
                    })}
                  </List>
                )}
              </Paper>
            )}

            {/* Students List */}
            <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid var(--c-slate-200)', bgcolor: 'var(--c-surface)' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
                <Typography variant="subtitle2" fontWeight={800} sx={{ color: 'var(--c-slate-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Enrolled Students ({students.length})
                </Typography>
              </Box>

              {students.length === 0 ? (
                <Typography variant="body2" color="var(--c-slate-500)" sx={{ py: 3, textAlign: 'center' }}>
                  No students enrolled yet. Share Class Code <strong>{classroom.classCode}</strong> with your students.
                </Typography>
              ) : (
                <List disablePadding>
                  {students.map((student, idx) => (
                    <Box key={student.id}>
                      <ListItem sx={{ px: 1, py: 1.5 }}>
                        <ListItemAvatar>
                          <Avatar sx={{ width: 36, height: 36, bgcolor: 'var(--c-emerald-600)', fontWeight: 700, fontSize: '0.85rem' }}>
                            {student.name.charAt(0)}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={<Typography fontWeight={700} sx={{ color: 'var(--c-slate-900)', fontSize: '0.9rem' }}>{student.name}</Typography>}
                          secondary={student.email}
                        />
                        <Chip label={`Student #${idx + 1}`} size="small" sx={{ bgcolor: 'var(--c-slate-100)', color: 'var(--c-slate-500)', fontSize: '0.7rem', fontWeight: 700 }} />
                      </ListItem>
                      {idx < students.length - 1 && <Divider component="li" />}
                    </Box>
                  ))}
                </List>
              )}
            </Paper>
          </Box>
        )}

        {/* ── TAB 3: GRADEBOOK (INSTRUCTOR ONLY) ── */}
        {activeTab === 5 && isInstructor && (
          <>
          <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid var(--c-slate-200)', bgcolor: 'var(--c-surface)', overflow: 'hidden', mb: 3 }}>
            <Box sx={{ p: { xs: 2, sm: 3 }, borderBottom: '1px solid var(--c-slate-200)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
              <Box>
                <Typography variant="h6" fontWeight={900} sx={{ color: 'var(--c-slate-900)' }}>Academic Gradebook</Typography>
                <Typography variant="caption" sx={{ color: 'var(--c-slate-500)' }}>
                  Grades on a 65–100 scale · 75 is passing · short-answer and essay items wait for your check
                </Typography>
              </Box>
            </Box>

            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table sx={{ minWidth: 650 }}>
                <TableHead sx={{ bgcolor: 'var(--c-slate-50)' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800, color: 'var(--c-slate-700)' }}>Student Name</TableCell>
                    {rawClassExams.map((exam) => (
                      <TableCell key={exam.id} align="center" sx={{ fontWeight: 800, color: 'var(--c-slate-700)' }}>
                        {exam.title} ({exam.totalPoints} pts)
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {students.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={rawClassExams.length + 1} align="center" sx={{ py: 4, color: 'var(--c-slate-500)' }}>
                        No enrolled students to record grades for.
                      </TableCell>
                    </TableRow>
                  ) : (
                    students.map((student) => (
                      <TableRow key={student.id} hover>
                        <TableCell sx={{ fontWeight: 700, color: 'var(--c-slate-900)' }}>
                          {student.name}
                        </TableCell>
                        {rawClassExams.map((exam) => {
                          const attempt = examAttempts.find(
                            (a) => a.examId === exam.id && a.studentId === student.id && a.submittedAt
                          );
                          if (!attempt) {
                            return (
                              <TableCell key={exam.id} align="center" sx={{ color: 'var(--c-slate-400)', fontSize: '0.85rem' }}>
                                Not submitted
                              </TableCell>
                            );
                          }

                          const pending = isPending(attempt);
                          const result = gradeFor(attempt.score || 0, exam.totalPoints);
                          return (
                            <TableCell key={exam.id} align="center">
                              {pending ? (
                                <Chip label="Needs checking" size="small" sx={{ bgcolor: 'var(--c-amber-100)', color: 'var(--c-amber-800)', fontWeight: 800, fontSize: '0.72rem' }} />
                              ) : (
                                <Chip
                                  label={`${attempt.score}/${exam.totalPoints} • ${result.grade}`}
                                  size="small"
                                  sx={{ bgcolor: result.bg, color: result.color, fontWeight: 800, fontSize: '0.72rem' }}
                                />
                              )}
                              <AttemptInsight attempt={attempt} studentName={student.name} />
                              <Button
                                size="small"
                                variant={pending ? 'contained' : 'text'}
                                onClick={() => setGrading({ attempt, exam, studentName: student.name })}
                                sx={{ mt: 0.5, fontWeight: 700, textTransform: 'none', fontSize: '0.72rem', py: 0.25 }}
                              >
                                {pending ? 'Check answers' : 'Review'}
                              </Button>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          {/* ── Item analysis ── */}
          <Box sx={{ mb: 1.5 }}>
            <Typography variant="h6" fontWeight={900} sx={{ color: 'var(--c-slate-900)' }}>Item Analysis</Typography>
            <Typography variant="caption" sx={{ color: 'var(--c-slate-500)' }}>
              Difficulty index, most-missed questions, distractor analysis and time to completion.
            </Typography>
          </Box>
          <ItemAnalysisPanel exams={rawClassExams} attempts={examAttempts} />
          <GradeSheet classroom={classroom} students={students} exams={rawClassExams} attempts={examAttempts} />
          <GradeAttemptDialog
            open={Boolean(grading)}
            onClose={() => setGrading(null)}
            attempt={grading?.attempt}
            exam={grading?.exam}
            studentName={grading?.studentName}
            onSave={submitExamAttempt}
          />
          </>
        )}

        {/* Preview Document Dialog */}
        <Dialog
          open={Boolean(viewMaterial)}
          onClose={() => setViewMaterial(null)}
          maxWidth="md"
          fullWidth
          fullScreen={isMobile}
          PaperProps={{ sx: { borderRadius: { xs: 0, sm: 3 }, p: 1 } }}
        >
          <DialogTitle sx={{ fontWeight: 800, color: 'var(--c-slate-900)', wordBreak: 'break-word' }}>
            {viewMaterial?.name}
            <Typography variant="caption" sx={{ display: 'block', color: 'var(--c-slate-500)', fontWeight: 500 }}>
              {formatFileSize(viewMaterial?.size)}
              {viewMaterial?.uploadedBy ? ` • ${viewMaterial.uploadedBy}` : ''}
            </Typography>
          </DialogTitle>
          <DialogContent dividers>
            {/* PDFs and images render inline; everything else falls back to the extracted
                text. Previously this rendered only `content`, which was a placeholder
                sentence before a reload and undefined after one — i.e. always blank. */}
            {viewMaterial?.fileUrl && /pdf$/i.test(viewMaterial?.fileType || viewMaterial?.name || '') ? (
              <Box
                component="iframe"
                src={viewMaterial.fileUrl}
                title={viewMaterial.name}
                sx={{ width: '100%', height: { xs: '60vh', sm: 520 }, border: '1px solid var(--c-slate-200)', borderRadius: 2 }}
              />
            ) : viewMaterial?.fileUrl && /^(png|jpe?g|gif|webp|svg)$/i.test(viewMaterial?.fileType || '') ? (
              <Box component="img" src={viewMaterial.fileUrl} alt={viewMaterial.name} sx={{ maxWidth: '100%', borderRadius: 2 }} />
            ) : viewMaterial?.content ? (
              <Typography
                variant="body2"
                sx={{ color: 'var(--c-slate-600)', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
              >
                {viewMaterial.content}
              </Typography>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <InsertDriveFile sx={{ fontSize: 44, color: 'var(--c-slate-400)', mb: 1 }} />
                <Typography variant="body2" sx={{ color: 'var(--c-slate-500)' }}>
                  No inline preview is available for this file type.
                  {viewMaterial?.fileUrl ? ' Use Open to view the original.' : ''}
                </Typography>
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2, flexWrap: 'wrap', gap: 1 }}>
            {viewMaterial?.fileUrl && (
              <Button
                component="a"
                href={viewMaterial.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                startIcon={<Download />}
                sx={{ fontWeight: 700, textTransform: 'none' }}
              >
                Open original
              </Button>
            )}
            <Button onClick={() => setViewMaterial(null)} sx={{ fontWeight: 700 }}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* Delete Document Confirmation */}
        <Dialog open={Boolean(deleteConfirm)} onClose={() => setDeleteConfirm(null)}>
          <DialogTitle sx={{ fontWeight: 800 }}>Confirm Removal</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary">
              Are you sure you want to remove this course document?
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button color="error" variant="contained" onClick={() => deleteConfirm && handleDeleteMaterial(deleteConfirm)}>
              Delete
            </Button>
          </DialogActions>
        </Dialog>

        {/* Toast */}
        <Snackbar open={copyToast} autoHideDuration={3000} onClose={() => setCopyToast(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
          <Alert severity="success" onClose={() => setCopyToast(false)} sx={{ fontWeight: 700, borderRadius: 2.5 }}>
            Class Code <strong>{classroom.classCode}</strong> copied to clipboard!
          </Alert>
        </Snackbar>

        {/* Upload / delete outcome. Errors linger longer because they need reading. */}
        <Snackbar
          open={Boolean(uploadToast)}
          autoHideDuration={uploadToast?.severity === 'error' ? 9000 : 3500}
          onClose={() => setUploadToast(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert severity={uploadToast?.severity} onClose={() => setUploadToast(null)} sx={{ fontWeight: 600, borderRadius: 2.5 }}>
            {uploadToast?.message}
          </Alert>
        </Snackbar>
      </Container>
    </Box>
  );
}
