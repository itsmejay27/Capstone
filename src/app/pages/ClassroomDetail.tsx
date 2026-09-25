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
  Popover,
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
  InfoOutlined,
} from '@mui/icons-material';
import { CLASS_THEMES, classThemeFor, isGlowTheme, BANNER_GRID } from '../theme/classThemes';
import AttemptInsight from '../components/AttemptInsight';
import ClassArt, { artVariant } from '../components/classroom/ClassArt';
import StreamSidebar from '../components/classroom/StreamSidebar';
import StreamActivityRow from '../components/classroom/StreamActivityRow';
import StreamWorkCard from '../components/classroom/StreamWorkCard';
import CommentThread from '../components/CommentThread';
import GradeAttemptDialog from '../components/GradeAttemptDialog';
import GradesView from '../components/classroom/GradesView';
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
  const [infoAnchor, setInfoAnchor] = useState<HTMLElement | null>(null);
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

        {/* ── Tabs, then a Google-Classroom-style banner ── */}
        <Tabs
          value={activeTab}
          onChange={(_, val) => setActiveTab(val)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{
            mb: 2, borderBottom: '1px solid var(--c-border)',
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontSize: '0.9rem', minHeight: 48, color: 'var(--c-ink-secondary)', px: { xs: 1.5, sm: 2.5 }, minWidth: 'auto' },
            '& .Mui-selected': { color: `${classTheme.flat} !important` },
            '& .MuiTabs-indicator': { bgcolor: classTheme.flat, height: 3, borderRadius: '3px 3px 0 0' },
          }}
        >
          <Tab label="Stream" />
          <Tab label="Classwork" />
          <Tab label="People" />
          {isInstructor && <Tab label="Grades" />}
        </Tabs>

        <Box
          sx={{
            position: 'relative', mb: 3, borderRadius: '10px', overflow: 'hidden', color: '#fff',
            bgcolor: classTheme.flat, minHeight: { xs: 150, md: 240 },
            ...(isGlowTheme(classroom?.theme) ? { backgroundImage: `${BANNER_GRID}, ${classTheme.background}`, backgroundSize: '32px 32px, 32px 32px, auto' } : {}), px: { xs: 2.5, md: 3.5 }, py: { xs: 2.5, md: 3 },
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
          }}
        >
          <ClassArt variant={artVariant(classroom.id)} />
          <Box sx={{ position: 'relative', maxWidth: '70%' }}>
            <Typography sx={{ fontSize: { xs: '1.8rem', md: '2.4rem' }, fontWeight: 500, lineHeight: 1.15 }}>{classroom.name}</Typography>
            <Typography sx={{ fontSize: { xs: '1rem', md: '1.3rem' }, fontWeight: 400, mt: 0.5, opacity: 0.95 }}>
              {classroom.section}{classroom.subject ? ` · ${classroom.subject}` : ''}
            </Typography>
          </Box>
          <Box sx={{ position: 'absolute', right: 10, bottom: 10, display: 'flex', gap: 0.5 }}>
            {isInstructor && classroom.instructorId === currentUser?.id && (
              <Tooltip title="Customize colour">
                <IconButton onClick={(e) => setThemeAnchor(e.currentTarget)} aria-label="Change class theme" sx={{ color: '#fff' }}>
                  <PaletteIcon />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Class information">
              <IconButton onClick={(e) => setInfoAnchor(e.currentTarget)} aria-label="Class information" sx={{ color: '#fff' }}>
                <InfoOutlined />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <Menu anchorEl={themeAnchor} open={Boolean(themeAnchor)} onClose={() => setThemeAnchor(null)}>
          <Box sx={{ px: 1.5, pt: 1, display: 'flex', gap: 1 }}>
            {(['solid', 'glow'] as const).map((style) => {
              const active = (style === 'glow') === isGlowTheme(classroom?.theme);
              return (
                <Button key={style} size="small" variant={active ? 'contained' : 'outlined'}
                  onClick={() => updateClassroom(classroom.id, { theme: `${classTheme.id}${style === 'glow' ? ':glow' : ''}` })}
                  sx={{ textTransform: 'none', flex: 1 }}>
                  {style === 'solid' ? 'Solid' : 'Glow'}
                </Button>
              );
            })}
          </Box>
          <Box sx={{ p: 1.5, display: 'grid', gridTemplateColumns: 'repeat(4, 56px)', gap: 1 }}>
            {CLASS_THEMES.map((t) => (
              <Box
                key={t.id}
                role="button"
                tabIndex={0}
                aria-label={`${t.name} colour`}
                onClick={() => { updateClassroom(classroom.id, { theme: `${t.id}${isGlowTheme(classroom?.theme) ? ':glow' : ''}` }); setThemeAnchor(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { updateClassroom(classroom.id, { theme: `${t.id}${isGlowTheme(classroom?.theme) ? ':glow' : ''}` }); setThemeAnchor(null); } }}
                sx={{ cursor: 'pointer', textAlign: 'center' }}
              >
                <Box sx={{ height: 36, borderRadius: '8px', bgcolor: t.flat, ...(isGlowTheme(classroom?.theme) ? { backgroundImage: t.background } : {}), outline: classTheme.id === t.id ? `2px solid ${t.flat}` : 'none', outlineOffset: 2 }} />
                <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.68rem' }}>{t.name}</Typography>
              </Box>
            ))}
          </Box>
        </Menu>

        <Popover
          open={Boolean(infoAnchor)} anchorEl={infoAnchor} onClose={() => setInfoAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <Box sx={{ p: 2.5, width: 300 }}>
            <Typography sx={{ fontWeight: 700, mb: 1 }}>{classroom.name}</Typography>
            {classroom.description && <Typography variant="body2" sx={{ color: 'var(--c-ink-secondary)', mb: 1.5 }}>{classroom.description}</Typography>}
            <Typography variant="caption" sx={{ color: 'var(--c-ink-tertiary)', display: 'block' }}>Class code</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <Typography sx={{ fontFamily: 'monospace', fontSize: '1.3rem', fontWeight: 700, color: classTheme.flat }}>{classroom.classCode}</Typography>
              <IconButton size="small" onClick={handleCopyClassCode} aria-label="Copy class code"><ContentCopy fontSize="small" /></IconButton>
            </Box>
            {isInstructor && (
              <Button size="small" startIcon={<LinkIcon />} onClick={handleCopyInviteLink} sx={{ textTransform: 'none', mb: 1 }}>Copy invite link</Button>
            )}
            <Typography variant="body2" sx={{ color: 'var(--c-ink-secondary)' }}>
              {instructor ? `Teacher: ${instructor.name}` : ''}{instructor ? ' · ' : ''}{classroom.students?.length || 0} students
            </Typography>
          </Box>
        </Popover>

        {/* ── TAB 0: STREAM (ANNOUNCEMENTS) ── */}
        {activeTab === 0 && (() => {
          const now = Date.now();
          const week = now + 7 * 86_400_000;
          const nameOf = (id?: string) => users.find((u) => u.id === id)?.name || instructor?.name || 'Your teacher';
          const upcoming = classClasswork
            .filter((w: any) => w.isPublished !== false && w.dueDate && w.kind !== 'material')
            .filter((w: any) => { const t = new Date(w.dueDate).getTime(); return t >= now && t <= week; })
            .filter((w: any) => isInstructor || !submissions.some((x: any) => x.classworkId === w.id && x.studentId === currentUser?.id && x.status !== 'assigned'))
            .sort((x: any, y: any) => new Date(x.dueDate).getTime() - new Date(y.dueDate).getTime())
            .map((w: any) => ({ id: w.id, title: w.title, due: `Due ${new Date(w.dueDate).toLocaleDateString(undefined, { weekday: 'long' })}` }));
          const activity = [
            ...classClasswork.filter((w: any) => w.isPublished !== false).map((w: any) => {
              const open = () => navigate(`/classroom/${classroomId}/work/${w.id}`);
              if (w.kind === 'material') {
                return { id: w.id, at: w.createdAt, node: <StreamActivityRow kind={w.kind} author={nameOf(w.createdBy).toUpperCase()} title={w.title} at={w.createdAt} accent={classTheme.flat} onOpen={open} /> };
              }
              const sub = submissions.find((x: any) => x.classworkId === w.id && x.studentId === currentUser?.id);
              const status = isInstructor ? undefined
                : sub?.status === 'returned' ? (typeof sub.grade === 'number' ? `${sub.grade}/${w.points ?? 100}` : 'Returned')
                : sub && sub.status !== 'assigned' ? 'Turned in'
                : w.dueDate && new Date(w.dueDate).getTime() < Date.now() ? 'Missing' : 'Assigned';
              return {
                id: w.id, at: w.createdAt,
                node: (
                  <StreamWorkCard work={w} author={nameOf(w.createdBy).toUpperCase()} accent={classTheme.flat} status={status} onOpen={open}
                    comments={
                      <CommentThread classroomId={classroomId || ''} postType="classwork" postId={w.id} comments={comments}
                        currentUserId={currentUser?.id || ''} currentUserName={currentUser?.name || ''} isInstructor={isInstructor}
                        onSave={saveComment} onDelete={deleteComment} fixedVisibility="class" />
                    } />
                ),
              };
            }),
            ...classExams.filter((e: any) => e.createdAt || e.postDate).map((e: any) => ({
              id: `exam-${e.id}`, at: e.postDate || e.createdAt,
              node: <StreamActivityRow kind="exam" author={(instructor?.name || 'Your teacher').toUpperCase()} title={e.title} at={e.postDate || e.createdAt} accent={classTheme.flat}
                onOpen={() => setActiveTab(1)} />,
            })),
          ];
          return (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '200px 1fr' }, gap: 3, alignItems: 'start' }}>
              <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                <StreamSidebar
                  classCode={classroom.classCode}
                  isInstructor={isInstructor}
                  upcoming={upcoming}
                  accent={classTheme.flat}
                  onCopyCode={handleCopyClassCode}
                  onViewAll={() => setActiveTab(1)}
                  onOpen={(id) => navigate(`/classroom/${classroomId}/work/${id}`)}
                  extra={isInstructor ? (
                    <Button fullWidth variant="outlined" startIcon={<Add />} onClick={() => navigate(`/exam-generator/${classroomId}`)}
                      sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '10px', borderColor: 'var(--c-border)', color: classTheme.flat }}>
                      Create exam
                    </Button>
                  ) : undefined}
                />
              </Box>
              <Box sx={{ minWidth: 0 }}>
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
                  activity={activity}
                  accent={classTheme.flat}
                  avatarFor={(id) => users.find((u: any) => u.id === id)?.avatar}
                />
              </Box>
            </Box>
          );
        })()}

        {/* ── TAB 1: CLASSWORK (assignments, materials, questions, grouped by topic) ── */}
        {activeTab === 1 && (
          <ClassworkPanel
            extraGroups={[
              {
                id: 'quizzes',
                name: 'Quizzes & exams',
                rows: classExams.map((exam: any) => {
                  const st = !isInstructor ? getExamStatus(exam.id) : null;
                  return {
                    id: exam.id,
                    title: exam.title,
                    kind: 'quiz' as const,
                    when: exam.dueDate
                      ? `Due ${new Date(exam.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${new Date(exam.dueDate).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                      : `${exam.activeQuestionCount || exam.questions?.length || 0} questions · ${exam.duration} min`,
                    status: st === 'completed' ? 'Done' : st === 'in-progress' ? 'In progress' : undefined,
                    onOpen: () => navigate(isInstructor ? `/classroom/${classroomId}?tab=gradebook` : st === 'completed' ? `/exam/${exam.id}/results` : `/exam/${exam.id}/take`),
                  };
                }),
              },
              {
                id: 'files',
                name: 'Course files',
                rows: materials.map((mat: any) => ({
                  id: mat.id,
                  title: mat.name,
                  kind: 'file' as const,
                  when: mat.uploadedAt ? `Posted ${new Date(mat.uploadedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : '',
                  onOpen: () => setViewMaterial(mat),
                  onDelete: isInstructor ? () => setDeleteConfirm(mat.id) : undefined,
                })),
              },
            ]}
            className={classroom.name}
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
        {activeTab === 3 && isInstructor && (
          <>
            <GradesView
              classroom={classroom}
              students={students}
              exams={rawClassExams}
              classwork={classClasswork}
              attempts={examAttempts}
              submissions={submissions}
              accent={classTheme.flat}
              onCheckAttempt={setGrading}
            />
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
