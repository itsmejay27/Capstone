import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  Box, Typography, Paper, Button, Divider, IconButton, Menu, MenuItem, Snackbar, Alert, CircularProgress, TextField,
} from '@mui/material';
import {
  AssignmentOutlined, BookmarkBorder, HelpOutline, MoreVert, Add, PeopleOutline, PersonOutline, ArrowBack,
  InsertDriveFile, PictureAsPdf, Description, Close, Link as LinkIcon, AttachFile,
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import CommentThread from '../components/CommentThread';
import { usePrompt } from '../components/PromptDialog';
import FileCard from '../components/classroom/FileCard';
import { classThemeFor } from '../theme/classThemes';
import { uploadClassroomFile } from '../services/fileStorage';
import { isOverdue } from '../services/todo';
import type { AnnouncementAttachment, Classwork, ClassworkSubmission } from '../types';

/**
 * One piece of classwork on its own page, laid out like Google Classroom: title, teacher and
 * date, points and due date, instructions, the attached files as cards, class comments, and
 * (for students) a "Your work" panel with private comments to the teacher.
 */

const KIND_ICON: Record<string, any> = { assignment: AssignmentOutlined, material: BookmarkBorder, question: HelpOutline };

export default function ClassworkDetail() {
  const { classroomId = '', workId = '' } = useParams();
  const navigate = useNavigate();
  const {
    currentUser, users, classrooms, classwork, submissions, comments, saveSubmission, saveComment, deleteComment,
  } = useAuth();
  const [menuEl, setMenuEl] = useState<HTMLElement | null>(null);
  const [addEl, setAddEl] = useState<HTMLElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { prompt, PromptHost } = usePrompt();
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{ severity: 'success' | 'error'; message: string } | null>(null);
  const [draftFiles, setDraftFiles] = useState<AnnouncementAttachment[] | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);

  const classroom = classrooms.find((c: any) => c.id === classroomId);
  const work: Classwork | undefined = (classwork[classroomId] || []).find((w: any) => w.id === workId);
  const theme = classThemeFor(classroom?.theme);
  const isInstructor = currentUser?.role === 'instructor';

  if (!classroom || !work) {
    return (
      <Box sx={{ p: 6, textAlign: 'center' }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>This item is not available</Typography>
        <Typography variant="body2" sx={{ color: 'var(--c-ink-secondary)', mb: 2 }}>It may have been deleted, or you are not in this class.</Typography>
        <Button onClick={() => navigate(classroom ? `/classroom/${classroomId}?tab=classwork` : '/dashboard')}>Go back</Button>
      </Box>
    );
  }

  const author = users.find((u: any) => u.id === work.createdBy) || users.find((u: any) => u.id === classroom.instructorId);
  const Icon = KIND_ICON[work.kind] || AssignmentOutlined;
  const gradeable = work.kind !== 'material';
  const mine: ClassworkSubmission | undefined = submissions.find((s: any) => s.classworkId === work.id && s.studentId === currentUser?.id);
  const turnedIn = mine && mine.status !== 'assigned';
  const files = draftFiles ?? mine?.attachments ?? [];
  const text = answer ?? mine?.textAnswer ?? '';
  const status = mine?.status === 'returned'
    ? (typeof mine.grade === 'number' ? `${mine.grade}/${work.points ?? 100}` : 'Returned')
    : turnedIn ? (mine?.isLate ? 'Turned in late' : 'Turned in')
    : work.dueDate && isOverdue(work.dueDate) ? 'Missing' : 'Assigned';
  const posted = new Date(work.createdAt);
  const postedLabel = posted.toDateString() === new Date().toDateString() ? posted.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : posted.toDateString() === new Date(Date.now() - 86_400_000).toDateString() ? 'Yesterday'
    : posted.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  const addFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    setUploading(true);
    const added: AnnouncementAttachment[] = [];
    for (const file of Array.from(list)) {
      try {
        const stored = await uploadClassroomFile(classroomId, file);
        added.push({ id: crypto.randomUUID(), name: stored.name, size: stored.size, mimeType: stored.mimeType, fileUrl: stored.url, storagePath: stored.storagePath, isDataUrl: stored.isDataUrl });
      } catch (e: any) {
        setToast({ severity: 'error', message: e?.message || `Could not attach "${file.name}".` });
      }
    }
    setDraftFiles([...(files || []), ...added]);
    setUploading(false);
  };

  const save = async (next: 'turned_in' | 'assigned') => {
    if (!currentUser) return;
    setBusy(true);
    const sub: ClassworkSubmission = {
      id: mine?.id ?? crypto.randomUUID(),
      classworkId: work.id,
      studentId: currentUser.id,
      textAnswer: text,
      attachments: files,
      status: next,
      isLate: next === 'turned_in' ? isOverdue(work.dueDate) : Boolean(mine?.isLate),
      submittedAt: next === 'turned_in' ? new Date().toISOString() : undefined,
      grade: mine?.grade,
      feedback: mine?.feedback,
      createdAt: mine?.createdAt ?? new Date().toISOString(),
    };
    const r = await saveSubmission(sub);
    setBusy(false);
    setDraftFiles(null);
    setAnswer(null);
    setToast(r.ok
      ? { severity: 'success', message: next === 'turned_in' ? (files.length || text ? 'Turned in.' : 'Marked as done.') : 'Unsubmitted. Turn it in again when ready.' }
      : { severity: 'error', message: r.error || 'Could not save your work.' });
  };

  const studentCount = classroom.students?.length || 0;
  const turnedInCount = submissions.filter((s: any) => s.classworkId === work.id && s.status !== 'assigned').length;

  return (
    <Box sx={{ maxWidth: 1180, mx: 'auto', px: { xs: 2, md: 3 }, py: 3 }}>
      <Button startIcon={<ArrowBack />} onClick={() => navigate(`/classroom/${classroomId}`)} sx={{ textTransform: 'none', mb: 1, color: 'var(--c-ink-secondary)' }}>
        {classroom.name}
      </Button>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: gradeable && !isInstructor ? '1fr 300px' : '1fr' }, gap: 4, alignItems: 'start' }}>
        {/* Main column */}
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
            <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: theme.flat, color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0, mt: 0.5 }}>
              <Icon fontSize="small" />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                <Typography sx={{ flex: 1, fontSize: { xs: '1.6rem', md: '2rem' }, fontWeight: 400, color: theme.flat, lineHeight: 1.25 }}>{work.title}</Typography>
                <IconButton onClick={(e) => setMenuEl(e.currentTarget)} aria-label="More"><MoreVert /></IconButton>
              </Box>
              <Typography variant="body2" sx={{ color: 'var(--c-ink-secondary)', mt: 0.5 }}>
                {(author?.name || 'Teacher').toUpperCase()} • {postedLabel}{work.updatedAt ? ' (Edited)' : ''}
              </Typography>
              {gradeable && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, flexWrap: 'wrap', gap: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>{typeof work.points === 'number' ? `${work.points} points` : 'Ungraded'}</Typography>
                  {work.dueDate && (
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      Due {new Date(work.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      {`, ${new Date(work.dueDate).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
                    </Typography>
                  )}
                </Box>
              )}
              <Divider sx={{ my: 2, borderColor: theme.flat, opacity: 0.6 }} />

              {work.instructions && (
                <Typography sx={{ whiteSpace: 'pre-line', mb: 2, fontSize: '0.92rem' }}>{work.instructions}</Typography>
              )}
              {work.attachments?.length > 0 && (
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 300px))' }, gap: 1.5, mb: 2 }}>
                  {work.attachments.map((a) => <FileCard key={a.id} att={a} />)}
                </Box>
              )}

              {isInstructor && gradeable && (
                <Paper elevation={0} sx={{ p: 2, borderRadius: '8px', border: '1px solid var(--c-border)', mb: 2, display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
                  <Box><Typography sx={{ fontSize: '1.8rem', fontWeight: 400 }}>{turnedInCount}</Typography><Typography variant="caption">Turned in</Typography></Box>
                  <Box><Typography sx={{ fontSize: '1.8rem', fontWeight: 400 }}>{Math.max(0, studentCount - turnedInCount)}</Typography><Typography variant="caption">Assigned</Typography></Box>
                  <Box sx={{ flex: 1 }} />
                  <Button variant="outlined" onClick={() => navigate(`/classroom/${classroomId}?tab=classwork`)} sx={{ textTransform: 'none', borderRadius: 999 }}>
                    Review student work
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
                postId={work.id}
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
        {gradeable && !isInstructor && (
          <Box>
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,.2)', mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 2 }}>
                <Typography sx={{ fontSize: '1.3rem', fontWeight: 400 }}>Your work</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: status === 'Missing' ? '#d93025' : turnedIn ? 'var(--c-ink-secondary)' : '#188038' }}>{status}</Typography>
              </Box>

              {files.length > 0 && (
                <Box sx={{ display: 'grid', gap: 1, mb: 1.5 }}>
                  {files.map((a) => <FileCard key={a.id} att={a} onRemove={turnedIn ? undefined : () => setDraftFiles(files.filter((x) => x.id !== a.id))} />)}
                </Box>
              )}
              {!turnedIn && (
                <TextField fullWidth multiline minRows={2} size="small" placeholder="Type an answer (optional)" value={text}
                  onChange={(e) => setAnswer(e.target.value)} sx={{ mb: 1.5 }} />
              )}
              {turnedIn && text && <Typography variant="body2" sx={{ whiteSpace: 'pre-line', mb: 1.5, color: 'var(--c-ink-secondary)' }}>{text}</Typography>}

              {!turnedIn && (
                <>
                  <Button fullWidth variant="outlined" startIcon={uploading ? <CircularProgress size={16} /> : <Add />} disabled={uploading}
                    onClick={(e) => setAddEl(e.currentTarget)}
                    sx={{ textTransform: 'none', borderRadius: 999, mb: 1.5, color: theme.flat, borderColor: 'var(--c-border)' }}>
                    {uploading ? 'Uploading…' : 'Add or create'}
                  </Button>
                  <input ref={fileRef} type="file" hidden multiple onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
                  <Menu anchorEl={addEl} open={Boolean(addEl)} onClose={() => setAddEl(null)} PaperProps={{ sx: { width: addEl?.offsetWidth } }}>
                    <MenuItem onClick={async () => {
                      setAddEl(null);
                      const url = await prompt({ title: 'Add link', kind: 'link', message: 'Paste a link to your work (Google Docs, Drive, a website…).' });
                      if (!url) return;
                      const u = url.trim();
                      setDraftFiles([...(files || []), { id: crypto.randomUUID(), name: u.replace(/^https?:\/\//, ''), size: 0, mimeType: 'text/uri-list', fileUrl: u, storagePath: null, isDataUrl: false }]);
                    }}>
                      <LinkIcon fontSize="small" sx={{ mr: 1.5 }} /> Link
                    </MenuItem>
                    <MenuItem onClick={() => { setAddEl(null); fileRef.current?.click(); }}>
                      <AttachFile fontSize="small" sx={{ mr: 1.5 }} /> File
                    </MenuItem>
                  </Menu>
                </>
              )}
              {mine?.status === 'returned' && mine.feedback && (
                <Alert severity="info" sx={{ mb: 1.5 }}>{mine.feedback}</Alert>
              )}
              {turnedIn ? (
                mine?.status !== 'returned' && (
                  <Button fullWidth variant="outlined" disabled={busy} onClick={() => save('assigned')} sx={{ textTransform: 'none', borderRadius: 999 }}>Unsubmit</Button>
                )
              ) : (
                <Button fullWidth variant="contained" disabled={busy || uploading} onClick={() => save('turned_in')}
                  sx={{ textTransform: 'none', borderRadius: 999, bgcolor: theme.flat, '&:hover': { bgcolor: theme.flat, filter: 'brightness(.92)' } }}>
                  {files.length || text.trim() ? 'Turn in' : 'Mark as done'}
                </Button>
              )}
              {work.dueDate && isOverdue(work.dueDate) && !turnedIn && (
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
                postId={work.id}
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
          try { await navigator.clipboard.writeText(window.location.href); setToast({ severity: 'success', message: 'Link copied.' }); } catch { /* ignore */ }
        }}>
          <LinkIcon fontSize="small" sx={{ mr: 1 }} /> Copy link
        </MenuItem>
        {isInstructor && (
          <MenuItem onClick={() => { setMenuEl(null); navigate(`/classroom/${classroomId}?tab=classwork`); }}>Edit in Classwork</MenuItem>
        )}
      </Menu>

      {PromptHost}
      <Snackbar open={Boolean(toast)} autoHideDuration={4000} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={toast?.severity} onClose={() => setToast(null)}>{toast?.message}</Alert>
      </Snackbar>
    </Box>
  );
}
