import { useMemo, useState } from 'react';
import {
  Box, Paper, Typography, Button, IconButton, Menu, MenuItem, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Chip, Stack, Collapse, Divider, Avatar,
  Snackbar, Alert, LinearProgress, Tooltip, ListItemIcon, ListItemText, MenuList,
} from '@mui/material';
import {
  Add, MoreVert, Edit, Delete, ExpandMore, ExpandLess, AssignmentTurnedIn, Description,
  HelpOutline, AttachFile, Close, Send, CheckCircle, Schedule, Folder, InsertDriveFile,
  Grading, Undo,
} from '@mui/icons-material';
import type {
  Classwork, ClassworkKind, ClassworkSubmission, ClassroomTopic,
  AnnouncementAttachment, MutationResult, PostComment,
} from '../types';
import { palette, radius, font, shadow } from '../theme/tokens';
import { SectionHeading, EmptyState, Field, FieldRow, StatusPill } from './ui-kit';
import { uploadClassroomFile, formatBytes } from '../services/fileStorage';
import { useIsMobile } from '../hooks/useResponsive';
import { dueLabel, isOverdue } from '../services/todo';
import CommentThread from './CommentThread';

/**
 * Classwork tab: assignments, materials and questions, grouped under instructor-defined
 * topics, with student turn-in and instructor grading.
 *
 * Presentational + local dialog state; every write goes out through props so the page can
 * wire them to AuthContext and report failures.
 */

const KIND_META: Record<ClassworkKind, { label: string; icon: any; tone: string }> = {
  assignment: { label: 'Assignment', icon: AssignmentTurnedIn, tone: palette.primary },
  material: { label: 'Material', icon: Description, tone: palette.student },
  question: { label: 'Question', icon: HelpOutline, tone: palette.instructor },
};

/** Local datetime string for <input type="datetime-local">, which rejects an ISO Z suffix. */
function toLocalInput(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

function AttachmentRow({ att, onRemove }: { att: AnnouncementAttachment; onRemove?: () => void }) {
  return (
    <Chip
      icon={<InsertDriveFile />}
      label={`${att.name}${att.size ? ` · ${formatBytes(att.size)}` : ''}`}
      size="small"
      onDelete={onRemove}
      component={!onRemove && att.fileUrl ? 'a' : 'div'}
      href={!onRemove ? att.fileUrl : undefined}
      target={!onRemove ? '_blank' : undefined}
      rel={!onRemove ? 'noopener noreferrer' : undefined}
      clickable={!onRemove && Boolean(att.fileUrl)}
      sx={{ maxWidth: '100%', bgcolor: palette.surfaceSunken, '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }}
    />
  );
}

export default function ClassworkPanel({
  classroomId, classwork, topics, submissions, comments, students,
  isInstructor, currentUserId, currentUserName,
  onSaveClasswork, onDeleteClasswork, onSaveTopic, onDeleteTopic,
  onSaveSubmission, onSaveComment, onDeleteComment,
}: {
  classroomId: string;
  classwork: Classwork[];
  topics: ClassroomTopic[];
  submissions: ClassworkSubmission[];
  comments: PostComment[];
  students: any[];
  isInstructor: boolean;
  currentUserId: string;
  currentUserName: string;
  onSaveClasswork: (w: Classwork) => Promise<MutationResult>;
  onDeleteClasswork: (id: string) => Promise<MutationResult>;
  onSaveTopic: (t: ClassroomTopic) => Promise<MutationResult>;
  onDeleteTopic: (id: string) => Promise<MutationResult>;
  onSaveSubmission: (s: ClassworkSubmission) => Promise<MutationResult>;
  onSaveComment: (c: PostComment) => Promise<MutationResult>;
  onDeleteComment: (id: string) => Promise<MutationResult>;
}) {
  const isMobile = useIsMobile();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [toast, setToast] = useState<{ severity: 'success' | 'error'; message: string } | null>(null);
  const [menuFor, setMenuFor] = useState<{ el: HTMLElement; work: Classwork } | null>(null);
  const [busy, setBusy] = useState(false);

  // Editor dialog
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Classwork | null>(null);
  const [form, setForm] = useState({
    title: '', instructions: '', kind: 'assignment' as ClassworkKind,
    points: '', dueDate: '', topicId: '', attachments: [] as AnnouncementAttachment[],
  });
  const [uploading, setUploading] = useState(false);

  // Topic dialog
  const [topicOpen, setTopicOpen] = useState(false);
  const [topicName, setTopicName] = useState('');

  // Student turn-in
  const [turnInFor, setTurnInFor] = useState<Classwork | null>(null);
  const [answer, setAnswer] = useState('');
  const [subAttachments, setSubAttachments] = useState<AnnouncementAttachment[]>([]);

  // Instructor grading
  const [gradingFor, setGradingFor] = useState<Classwork | null>(null);

  const report = (r: MutationResult, ok: string) =>
    setToast(r.ok ? { severity: 'success', message: ok } : { severity: 'error', message: r.error || 'Something went wrong.' });

  const mySubmission = (workId: string) =>
    submissions.find((s) => s.classworkId === workId && s.studentId === currentUserId);

  const submissionsFor = (workId: string) => submissions.filter((s) => s.classworkId === workId);

  /** Published work only, for students. Instructors see drafts too. */
  const visibleWork = useMemo(() => {
    const list = isInstructor
      ? classwork
      : classwork.filter((w) => w.isPublished !== false && (!w.postDate || new Date(w.postDate) <= new Date()));
    return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [classwork, isInstructor]);

  /** Grouped by topic, in topic order, with untopiced work last. */
  const grouped = useMemo(() => {
    const sortedTopics = [...topics].sort((a, b) => a.position - b.position);
    const out: { topic: ClassroomTopic | null; items: Classwork[] }[] = sortedTopics.map((t) => ({
      topic: t,
      items: visibleWork.filter((w) => w.topicId === t.id),
    }));
    const untopiced = visibleWork.filter((w) => !w.topicId || !topics.some((t) => t.id === w.topicId));
    if (untopiced.length > 0) out.push({ topic: null, items: untopiced });
    return out.filter((g) => g.items.length > 0 || g.topic);
  }, [visibleWork, topics]);

  const openEditor = (work?: Classwork) => {
    setEditing(work ?? null);
    setForm({
      title: work?.title ?? '',
      instructions: work?.instructions ?? '',
      kind: work?.kind ?? 'assignment',
      points: work?.points != null ? String(work.points) : '',
      dueDate: toLocalInput(work?.dueDate),
      topicId: work?.topicId ?? '',
      attachments: work?.attachments ?? [],
    });
    setEditorOpen(true);
  };

  const uploadTo = async (files: FileList | null, target: 'work' | 'submission') => {
    if (!files?.length) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      try {
        const stored = await uploadClassroomFile(classroomId, file);
        const att: AnnouncementAttachment = {
          id: crypto.randomUUID(), name: stored.name, size: stored.size,
          mimeType: stored.mimeType, fileUrl: stored.url,
          storagePath: stored.storagePath, isDataUrl: stored.isDataUrl,
        };
        if (target === 'work') setForm((f) => ({ ...f, attachments: [...f.attachments, att] }));
        else setSubAttachments((prev) => [...prev, att]);
      } catch (e: any) {
        setToast({ severity: 'error', message: e?.message || `Could not attach "${file.name}".` });
      }
    }
    setUploading(false);
  };

  const saveWork = async () => {
    if (!form.title.trim()) return;
    setBusy(true);
    const work: Classwork = {
      id: editing?.id ?? crypto.randomUUID(),
      classroomId,
      topicId: form.topicId || null,
      kind: form.kind,
      title: form.title.trim(),
      instructions: form.instructions.trim(),
      attachments: form.attachments,
      points: form.points ? Number(form.points) : undefined,
      dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
      isPublished: true,
      allowLate: true,
      createdBy: currentUserId,
      createdAt: editing?.createdAt ?? new Date().toISOString(),
      // Set only when editing, so the context knows not to re-send the "new assignment" email.
      updatedAt: editing ? new Date().toISOString() : undefined,
    };
    report(await onSaveClasswork(work), editing ? 'Assignment updated.' : 'Assignment posted.');
    setBusy(false);
    setEditorOpen(false);
  };

  const submitWork = async () => {
    if (!turnInFor) return;
    setBusy(true);
    const existing = mySubmission(turnInFor.id);
    const sub: ClassworkSubmission = {
      id: existing?.id ?? crypto.randomUUID(),
      classworkId: turnInFor.id,
      studentId: currentUserId,
      textAnswer: answer,
      attachments: subAttachments,
      status: 'turned_in',
      // Stamped against the due date in force right now — editing the due date later must
      // not retroactively change whether this turn-in was late.
      isLate: isOverdue(turnInFor.dueDate),
      submittedAt: new Date().toISOString(),
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    report(await onSaveSubmission(sub), 'Work turned in.');
    setBusy(false);
    setTurnInFor(null);
    setAnswer('');
    setSubAttachments([]);
  };

  const unsubmit = async (work: Classwork) => {
    const existing = mySubmission(work.id);
    if (!existing) return;
    report(
      await onSaveSubmission({ ...existing, status: 'assigned', submittedAt: undefined }),
      'Turn-in withdrawn — remember to submit again.'
    );
  };

  const grade = async (sub: ClassworkSubmission, value: number | undefined, feedback: string) => {
    report(
      await onSaveSubmission({ ...sub, grade: value, feedback, status: 'returned', returnedAt: new Date().toISOString() }),
      'Grade returned to the student.'
    );
  };

  const addTopic = async () => {
    if (!topicName.trim()) return;
    const topic: ClassroomTopic = {
      id: crypto.randomUUID(),
      classroomId,
      name: topicName.trim(),
      position: topics.length,
    };
    report(await onSaveTopic(topic), 'Topic created.');
    setTopicName('');
    setTopicOpen(false);
  };

  return (
    <Box>
      {isInstructor && (
        <Stack direction="row" spacing={1} sx={{ mb: 2.5, flexWrap: 'wrap', gap: 1 }}>
          <Button variant="contained" startIcon={<Add />} onClick={() => openEditor()}>
            Create
          </Button>
          <Button variant="outlined" startIcon={<Folder />} onClick={() => setTopicOpen(true)}>
            Add topic
          </Button>
        </Stack>
      )}

      {visibleWork.length === 0 ? (
        <EmptyState
          icon={<AssignmentTurnedIn />}
          title="No classwork yet"
          description={
            isInstructor
              ? 'Post an assignment, share a material, or ask a question. Group them under topics to keep the page tidy.'
              : 'Assignments and materials your instructor posts will appear here.'
          }
          action={isInstructor ? <Button variant="contained" startIcon={<Add />} onClick={() => openEditor()}>Create classwork</Button> : undefined}
        />
      ) : (
        grouped.map(({ topic, items }) => (
          <Box key={topic?.id ?? 'untopiced'} sx={{ mb: 3.5 }}>
            <SectionHeading
              title={topic?.name ?? 'Other'}
              count={items.length}
              action={
                isInstructor && topic ? (
                  <Tooltip title="Delete topic (its classwork is kept)">
                    <IconButton
                      size="small"
                      aria-label={`Delete topic ${topic.name}`}
                      onClick={async () => report(await onDeleteTopic(topic.id), 'Topic removed.')}
                    >
                      <Delete sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                ) : undefined
              }
            />

            {items.length === 0 && (
              <Typography variant="body2" sx={{ color: palette.inkTertiary, mb: 1 }}>
                Nothing under this topic yet.
              </Typography>
            )}

            {items.map((work) => {
              const meta = KIND_META[work.kind];
              const Icon = meta.icon;
              const open = expanded === work.id;
              const sub = mySubmission(work.id);
              const allSubs = submissionsFor(work.id);
              const turnedIn = allSubs.filter((s) => s.submittedAt).length;
              const overdue = isOverdue(work.dueDate) && !sub?.submittedAt;

              return (
                <Paper
                  key={work.id}
                  sx={{
                    mb: 1.25, borderRadius: '14px', overflow: 'hidden',
                    border: `1px solid ${overdue && !isInstructor ? palette.dangerSoft : palette.border}`,
                  }}
                >
                  <Box
                    onClick={() => setExpanded(open ? null : work.id)}
                    sx={{
                      p: 2, display: 'flex', alignItems: 'center', gap: 1.75, cursor: 'pointer',
                      '&:hover': { bgcolor: palette.surfaceMuted },
                    }}
                  >
                    <Box
                      sx={{
                        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                        bgcolor: palette.surfaceSunken, display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Icon sx={{ fontSize: 18, color: meta.tone }} />
                    </Box>

                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontFamily: font.mono, fontSize: '0.9rem', fontWeight: 600, color: palette.ink }} noWrap>
                        {work.title}
                      </Typography>
                      <Stack direction="row" spacing={0.75} sx={{ mt: 0.3, flexWrap: 'wrap', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="caption" sx={{ color: palette.inkTertiary }}>{meta.label}</Typography>
                        {work.dueDate && (
                          <>
                            <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: palette.inkDisabled }} />
                            <Typography
                              variant="caption"
                              sx={{ color: overdue ? palette.danger : palette.inkTertiary, fontWeight: overdue ? 700 : 500 }}
                            >
                              {dueLabel(work.dueDate)}
                            </Typography>
                          </>
                        )}
                        {work.points != null && (
                          <>
                            <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: palette.inkDisabled }} />
                            <Typography variant="caption" sx={{ color: palette.inkTertiary }}>{work.points} pts</Typography>
                          </>
                        )}
                      </Stack>
                    </Box>

                    <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
                      {isInstructor ? (
                        <Chip
                          label={`${turnedIn}/${students.length} turned in`}
                          size="small"
                          sx={{ bgcolor: palette.surfaceSunken, color: palette.inkSecondary, fontWeight: 700 }}
                        />
                      ) : sub?.status === 'returned' ? (
                        <StatusPill label={sub.grade != null ? `${sub.grade}/${work.points ?? '—'}` : 'Returned'} tone="success" />
                      ) : sub?.submittedAt ? (
                        <StatusPill label={sub.isLate ? 'Turned in late' : 'Turned in'} tone={sub.isLate ? 'warning' : 'success'} />
                      ) : overdue ? (
                        <StatusPill label="Missing" tone="danger" />
                      ) : (
                        <StatusPill label="Assigned" tone="info" />
                      )}
                      {isInstructor && (
                        <IconButton
                          size="small"
                          aria-label="Classwork actions"
                          onClick={(e) => { e.stopPropagation(); setMenuFor({ el: e.currentTarget, work }); }}
                        >
                          <MoreVert fontSize="small" />
                        </IconButton>
                      )}
                      {open ? <ExpandLess sx={{ color: palette.inkTertiary }} /> : <ExpandMore sx={{ color: palette.inkTertiary }} />}
                    </Stack>
                  </Box>

                  <Collapse in={open} unmountOnExit>
                    <Divider />
                    <Box sx={{ p: 2 }}>
                      {work.instructions && (
                        <Typography variant="body2" sx={{ color: palette.inkSecondary, whiteSpace: 'pre-wrap', mb: 1.5 }}>
                          {work.instructions}
                        </Typography>
                      )}

                      {work.attachments?.length > 0 && (
                        <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap', mb: 2 }}>
                          {work.attachments.map((a) => <AttachmentRow key={a.id} att={a} />)}
                        </Stack>
                      )}

                      {/* Student turn-in */}
                      {!isInstructor && work.kind !== 'material' && (
                        <Paper sx={{ p: 2, bgcolor: palette.surfaceMuted, border: `1px solid ${palette.border}`, mb: 1.5 }}>
                          {sub?.status === 'returned' ? (
                            <>
                              <Typography variant="subtitle2" sx={{ color: palette.success, mb: 0.5 }}>
                                Graded: {sub.grade != null ? `${sub.grade} / ${work.points ?? '—'}` : 'returned'}
                              </Typography>
                              {sub.feedback && (
                                <Typography variant="body2" sx={{ color: palette.inkSecondary, whiteSpace: 'pre-wrap' }}>
                                  {sub.feedback}
                                </Typography>
                              )}
                            </>
                          ) : sub?.submittedAt ? (
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', gap: 1 }}>
                              <CheckCircle sx={{ color: palette.success, fontSize: 18 }} />
                              <Typography variant="body2" sx={{ flex: 1, color: palette.inkSecondary }}>
                                Turned in {sub.isLate ? '(late)' : ''} · {new Date(sub.submittedAt).toLocaleString()}
                              </Typography>
                              <Button size="small" startIcon={<Undo />} onClick={() => unsubmit(work)}>
                                Unsubmit
                              </Button>
                            </Stack>
                          ) : (
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', gap: 1 }}>
                              <Schedule sx={{ color: overdue ? palette.danger : palette.inkTertiary, fontSize: 18 }} />
                              <Typography variant="body2" sx={{ flex: 1, color: palette.inkSecondary }}>
                                {overdue ? 'This work is past its due date.' : 'Not turned in yet.'}
                              </Typography>
                              <Button
                                variant="contained"
                                size="small"
                                onClick={() => {
                                  setTurnInFor(work);
                                  setAnswer(sub?.textAnswer ?? '');
                                  setSubAttachments(sub?.attachments ?? []);
                                }}
                              >
                                Turn in
                              </Button>
                            </Stack>
                          )}
                        </Paper>
                      )}

                      {/* Instructor grading summary */}
                      {isInstructor && work.kind !== 'material' && (
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<Grading />}
                          onClick={() => setGradingFor(work)}
                          sx={{ mb: 1.5 }}
                        >
                          Review {turnedIn} submission{turnedIn === 1 ? '' : 's'}
                        </Button>
                      )}

                      <CommentThread
                        classroomId={classroomId}
                        postType="classwork"
                        postId={work.id}
                        comments={comments}
                        currentUserId={currentUserId}
                        currentUserName={currentUserName}
                        isInstructor={isInstructor}
                        onSave={onSaveComment}
                        onDelete={onDeleteComment}
                      />
                    </Box>
                  </Collapse>
                </Paper>
              );
            })}
          </Box>
        ))
      )}

      {/* Instructor action menu */}
      <Menu anchorEl={menuFor?.el} open={Boolean(menuFor)} onClose={() => setMenuFor(null)}>
        <MenuItem onClick={() => { if (menuFor) openEditor(menuFor.work); setMenuFor(null); }}>
          <ListItemIcon><Edit fontSize="small" /></ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem
          sx={{ color: palette.danger }}
          onClick={async () => {
            if (menuFor) report(await onDeleteClasswork(menuFor.work.id), 'Classwork deleted.');
            setMenuFor(null);
          }}
        >
          <ListItemIcon><Delete fontSize="small" sx={{ color: palette.danger }} /></ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* Create / edit classwork */}
      <Dialog open={editorOpen} onClose={() => setEditorOpen(false)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle>{editing ? 'Edit classwork' : 'Create classwork'}</DialogTitle>
        <DialogContent>
          <FieldRow>
            <Field label="Type" required>
              <TextField select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as ClassworkKind })}>
                <MenuItem value="assignment">Assignment</MenuItem>
                <MenuItem value="material">Material</MenuItem>
                <MenuItem value="question">Question</MenuItem>
              </TextField>
            </Field>
            <Field label="Topic" hint="Optional grouping">
              <TextField select value={form.topicId} onChange={(e) => setForm({ ...form, topicId: e.target.value })}>
                <MenuItem value="">No topic</MenuItem>
                {topics.map((t) => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
              </TextField>
            </Field>
          </FieldRow>

          <Field label="Title" required>
            <TextField autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Laboratory Exercise 3 — ERD Design" />
          </Field>

          <Field label="Instructions">
            <TextField
              multiline rows={4} value={form.instructions}
              onChange={(e) => setForm({ ...form, instructions: e.target.value })}
              placeholder="What students need to do…"
            />
          </Field>

          {form.kind !== 'material' && (
            <FieldRow>
              <Field label="Points" hint="Leave blank for ungraded">
                <TextField type="number" value={form.points} onChange={(e) => setForm({ ...form, points: e.target.value })} inputProps={{ min: 0 }} />
              </Field>
              <Field label="Due date">
                <TextField
                  type="datetime-local"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
              </Field>
            </FieldRow>
          )}

          <Field label="Attachments">
            <Button component="label" variant="outlined" startIcon={<AttachFile />} disabled={uploading} fullWidth>
              {uploading ? 'Uploading…' : 'Attach files'}
              <input type="file" hidden multiple onChange={(e) => { uploadTo(e.target.files, 'work'); e.target.value = ''; }} />
            </Button>
            {form.attachments.length > 0 && (
              <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap', mt: 1 }}>
                {form.attachments.map((a) => (
                  <AttachmentRow key={a.id} att={a} onRemove={() => setForm((f) => ({ ...f, attachments: f.attachments.filter((x) => x.id !== a.id) }))} />
                ))}
              </Stack>
            )}
          </Field>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditorOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveWork} disabled={!form.title.trim() || busy || uploading}>
            {editing ? 'Save changes' : 'Post'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add topic */}
      <Dialog open={topicOpen} onClose={() => setTopicOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add a topic</DialogTitle>
        <DialogContent>
          <Field label="Topic name" required>
            <TextField
              autoFocus value={topicName} onChange={(e) => setTopicName(e.target.value)}
              placeholder="e.g. Week 1 — Database Integration"
              onKeyDown={(e) => { if (e.key === 'Enter' && topicName.trim()) addTopic(); }}
            />
          </Field>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTopicOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={addTopic} disabled={!topicName.trim()}>Add topic</Button>
        </DialogActions>
      </Dialog>

      {/* Student turn-in */}
      <Dialog open={Boolean(turnInFor)} onClose={() => setTurnInFor(null)} maxWidth="sm" fullWidth fullScreen={isMobile}>
        <DialogTitle>Turn in “{turnInFor?.title}”</DialogTitle>
        <DialogContent>
          {turnInFor && isOverdue(turnInFor.dueDate) && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              This is past the due date and will be marked late.
            </Alert>
          )}
          <Field label="Your answer" hint="Optional if you are attaching files.">
            <TextField multiline rows={5} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Type your response…" />
          </Field>
          <Field label="Attachments">
            <Button component="label" variant="outlined" startIcon={<AttachFile />} disabled={uploading} fullWidth>
              {uploading ? 'Uploading…' : 'Attach your work'}
              <input type="file" hidden multiple onChange={(e) => { uploadTo(e.target.files, 'submission'); e.target.value = ''; }} />
            </Button>
            {subAttachments.length > 0 && (
              <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap', mt: 1 }}>
                {subAttachments.map((a) => (
                  <AttachmentRow key={a.id} att={a} onRemove={() => setSubAttachments((p) => p.filter((x) => x.id !== a.id))} />
                ))}
              </Stack>
            )}
          </Field>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTurnInFor(null)}>Cancel</Button>
          <Button
            variant="contained"
            startIcon={<Send />}
            onClick={submitWork}
            disabled={busy || uploading || (!answer.trim() && subAttachments.length === 0)}
          >
            Turn in
          </Button>
        </DialogActions>
      </Dialog>

      {/* Instructor grading */}
      <Dialog open={Boolean(gradingFor)} onClose={() => setGradingFor(null)} maxWidth="md" fullWidth fullScreen={isMobile}>
        <DialogTitle>
          {gradingFor?.title}
          <Typography variant="caption" sx={{ display: 'block', color: palette.inkSecondary, fontWeight: 500 }}>
            {submissionsFor(gradingFor?.id ?? '').filter((s) => s.submittedAt).length} of {students.length} turned in
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          {students.length === 0 ? (
            <Typography variant="body2" sx={{ color: palette.inkSecondary }}>No students enrolled yet.</Typography>
          ) : (
            students.map((student) => {
              const sub = submissions.find((s) => s.classworkId === gradingFor?.id && s.studentId === student.id);
              return (
                <GradeRow
                  key={student.id}
                  student={student}
                  submission={sub}
                  maxPoints={gradingFor?.points}
                  onGrade={(value, feedback) => {
                    if (!gradingFor) return;
                    const base: ClassworkSubmission = sub ?? {
                      id: crypto.randomUUID(), classworkId: gradingFor.id, studentId: student.id,
                      attachments: [], status: 'assigned', isLate: false,
                    };
                    grade(base, value, feedback);
                  }}
                />
              );
            })
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGradingFor(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={toast?.severity === 'error' ? 9000 : 3500}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={toast?.severity} onClose={() => setToast(null)}>{toast?.message}</Alert>
      </Snackbar>
    </Box>
  );
}

/** One student's row in the grading dialog. */
function GradeRow({
  student, submission, maxPoints, onGrade,
}: {
  student: any;
  submission?: ClassworkSubmission;
  maxPoints?: number;
  onGrade: (value: number | undefined, feedback: string) => void;
}) {
  const [value, setValue] = useState(submission?.grade != null ? String(submission.grade) : '');
  const [feedback, setFeedback] = useState(submission?.feedback ?? '');
  const [open, setOpen] = useState(false);

  return (
    <Paper sx={{ p: 1.75, mb: 1.25, border: `1px solid ${palette.border}` }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Avatar src={student.avatar} sx={{ width: 32, height: 32 }}>{student.name?.charAt(0)}</Avatar>
        <Box sx={{ flex: 1, minWidth: 120 }}>
          <Typography variant="subtitle2" noWrap>{student.name}</Typography>
          <Typography variant="caption" sx={{ color: palette.inkTertiary }}>
            {submission?.submittedAt
              ? `Turned in ${submission.isLate ? '(late) ' : ''}${new Date(submission.submittedAt).toLocaleString()}`
              : 'Not turned in'}
          </Typography>
        </Box>
        {submission?.status === 'returned' && <StatusPill label="Returned" tone="success" />}
        <Button size="small" onClick={() => setOpen((v) => !v)}>{open ? 'Hide' : 'Grade'}</Button>
      </Box>

      <Collapse in={open} unmountOnExit>
        <Divider sx={{ my: 1.5 }} />
        {submission?.textAnswer && (
          <Typography variant="body2" sx={{ color: palette.inkSecondary, whiteSpace: 'pre-wrap', mb: 1.5, p: 1.25, bgcolor: palette.surfaceMuted, borderRadius: '10px' }}>
            {submission.textAnswer}
          </Typography>
        )}
        {submission?.attachments?.length ? (
          <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap', mb: 1.5 }}>
            {submission.attachments.map((a) => <AttachmentRow key={a.id} att={a} />)}
          </Stack>
        ) : null}
        <FieldRow>
          <Field label={`Score${maxPoints != null ? ` (out of ${maxPoints})` : ''}`}>
            <TextField type="number" value={value} onChange={(e) => setValue(e.target.value)} inputProps={{ min: 0, max: maxPoints }} />
          </Field>
          <Field label="Feedback">
            <TextField value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Optional comments" />
          </Field>
        </FieldRow>
        <Button
          variant="contained"
          size="small"
          onClick={() => onGrade(value === '' ? undefined : Number(value), feedback)}
          disabled={!submission?.submittedAt && value === ''}
        >
          Return grade
        </Button>
      </Collapse>
    </Paper>
  );
}
