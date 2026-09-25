import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
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
  onSaveSubmission, onSaveComment, onDeleteComment, className, extraGroups = [],
}: {
  className?: string;
  /** Other things shown as Classwork sections: the class's quizzes/exams and older course files. */
  extraGroups?: {
    id: string; name: string;
    rows: { id: string; title: string; kind: 'quiz' | 'file'; when: string; status?: string; onOpen: () => void; onDelete?: () => void }[];
  }[];
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
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [toast, setToast] = useState<{ severity: 'success' | 'error'; message: string } | null>(null);
  const [menuFor, setMenuFor] = useState<{ el: HTMLElement; work: Classwork } | null>(null);
  const [busy, setBusy] = useState(false);
  const [createEl, setCreateEl] = useState<HTMLElement | null>(null);
  const [topicFilter, setTopicFilter] = useState('all');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [topicMenu, setTopicMenu] = useState<{ el: HTMLElement; topic: ClassroomTopic } | null>(null);
  const [reuseOpen, setReuseOpen] = useState(false);
  const [yourWorkOpen, setYourWorkOpen] = useState(false);

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

  const openEditor = (work?: Classwork, kind?: ClassworkKind, template?: Partial<Classwork>) => {
    setEditing(work ?? null);
    const src: Partial<Classwork> | undefined = work ?? template;
    setForm({
      title: src?.title ?? '',
      instructions: src?.instructions ?? '',
      kind: work?.kind ?? kind ?? src?.kind ?? 'assignment',
      points: src?.points != null ? String(src.points) : '',
      dueDate: toLocalInput(src?.dueDate),
      topicId: src?.topicId ?? '',
      attachments: src?.attachments ?? [],
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
    report(await onSaveClasswork(work), editing ? 'Saved.' : `${KIND_META[work.kind].label} posted.`);
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

  const whenLabel = (w: Classwork) => {
    if (w.dueDate) {
      const d = new Date(w.dueDate);
      return `Due ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    }
    const c = new Date(w.createdAt);
    const today = new Date();
    if (c.toDateString() === today.toDateString()) return `Posted ${c.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    if (c.toDateString() === new Date(Date.now() - 86_400_000).toDateString()) return 'Posted Yesterday';
    return `Posted ${c.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  };

  const shownGroups = grouped.filter((g) => topicFilter === 'all' || (g.topic?.id ?? 'none') === topicFilter);
  const shownExtra = extraGroups.filter((g) => g.rows.length > 0 && (topicFilter === 'all' || topicFilter === `x:${g.id}`));
  const allCollapsed = shownGroups.length + shownExtra.length > 0 && shownGroups.every((g) => collapsed.has(g.topic?.id ?? 'none')) && shownExtra.every((g) => collapsed.has(`x:${g.id}`));
  const toggleGroup = (id: string) => setCollapsed((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const openWork = (w: Classwork) => navigate(`/classroom/${classroomId}/work/${w.id}`);

  const addLink = (kind: string) => {
    const url = window.prompt(kind === 'youtube' ? 'Paste a YouTube link' : 'Paste a link');
    if (!url || !/^https?:\/\//i.test(url.trim())) return;
    const clean = url.trim();
    const att: AnnouncementAttachment = {
      id: crypto.randomUUID(),
      name: /youtu\.?be/i.test(clean) ? `YouTube: ${clean.replace(/^https?:\/\//, '')}` : clean.replace(/^https?:\/\//, ''),
      size: 0, mimeType: 'text/uri-list', fileUrl: clean, storagePath: null, isDataUrl: false,
    };
    setForm((f) => ({ ...f, attachments: [...f.attachments, att] }));
  };

  const createKinds: { kind: ClassworkKind | 'quiz' | 'reuse' | 'topic'; label: string; icon: any }[] = [
    { kind: 'assignment', label: 'Assignment', icon: AssignmentTurnedIn },
    { kind: 'quiz', label: 'Quiz assignment', icon: Grading },
    { kind: 'question', label: 'Question', icon: HelpOutline },
    { kind: 'material', label: 'Material', icon: Description },
    { kind: 'reuse', label: 'Reuse post', icon: Undo },
  ];

  return (
    <Box sx={{ maxWidth: 940, mx: 'auto' }}>
      {/* Toolbar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 2.5 }}>
        {isInstructor && (
          <Button variant="contained" startIcon={<Add />} onClick={(e) => setCreateEl(e.currentTarget)}
            sx={{ borderRadius: 999, px: 2.5, textTransform: 'none', fontWeight: 600 }}>
            Create
          </Button>
        )}
        {(topics.length > 0 || extraGroups.some((g) => g.rows.length > 0)) && (
          <TextField select size="small" label="Topic filter" value={topicFilter} onChange={(e) => setTopicFilter(e.target.value)} fullWidth={false} sx={{ width: { xs: '100%', sm: 300 }, flex: '0 0 auto' }}>
            <MenuItem value="all">All topics</MenuItem>
            {[...topics].sort((x, y) => x.position - y.position).map((t) => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
            {extraGroups.filter((g) => g.rows.length > 0).map((g) => <MenuItem key={g.id} value={`x:${g.id}`}>{g.name}</MenuItem>)}
          </TextField>
        )}
        <Box sx={{ flex: 1 }} />
        {!isInstructor && (
          <Button variant="outlined" startIcon={<AssignmentTurnedIn />} onClick={() => setYourWorkOpen(true)}
            sx={{ borderRadius: 999, textTransform: 'none', fontWeight: 600 }}>
            View your work
          </Button>
        )}
        {shownGroups.length + shownExtra.length > 1 && (
          <Button startIcon={allCollapsed ? <ExpandMore /> : <ExpandLess />} sx={{ textTransform: 'none', fontWeight: 600 }}
            onClick={() => setCollapsed(allCollapsed ? new Set() : new Set([...shownGroups.map((g) => g.topic?.id ?? 'none'), ...shownExtra.map((g) => `x:${g.id}`)]))}>
            {allCollapsed ? 'Expand all' : 'Collapse all'}
          </Button>
        )}
      </Box>

      <Menu anchorEl={createEl} open={Boolean(createEl)} onClose={() => setCreateEl(null)}>
        {createKinds.map((k) => (
          <MenuItem key={k.kind} onClick={() => {
            setCreateEl(null);
            if (k.kind === 'quiz') navigate(`/exam-generator/${classroomId}`);
            else if (k.kind === 'reuse') setReuseOpen(true);
            else openEditor(undefined, k.kind as ClassworkKind);
          }}>
            <ListItemIcon><k.icon fontSize="small" /></ListItemIcon>
            <ListItemText>{k.label}</ListItemText>
          </MenuItem>
        ))}
        <Divider />
        <MenuItem onClick={() => { setCreateEl(null); setTopicOpen(true); }}>
          <ListItemIcon><Folder fontSize="small" /></ListItemIcon>
          <ListItemText>Topic</ListItemText>
        </MenuItem>
      </Menu>

      {visibleWork.length === 0 && topics.length === 0 && !extraGroups.some((g) => g.rows.length > 0) ? (
        <Box sx={{ textAlign: 'center', py: 8, borderTop: `1px solid ${palette.border}` }}>
          <AssignmentTurnedIn sx={{ fontSize: 72, color: palette.inkDisabled, mb: 1 }} />
          <Typography sx={{ fontWeight: 600 }}>{isInstructor ? 'This is where you’ll assign work' : 'No classwork yet'}</Typography>
          <Typography variant="body2" sx={{ color: palette.inkSecondary, maxWidth: 360, mx: 'auto', mt: 0.5 }}>
            {isInstructor
              ? 'You can add assignments and other work for the class, then organize it into topics.'
              : 'Assignments and materials your teacher posts will appear here.'}
          </Typography>
        </Box>
      ) : (
        shownGroups.map(({ topic, items }) => {
          const gid = topic?.id ?? 'none';
          const isCollapsed = collapsed.has(gid);
          return (
            <Box key={gid} sx={{ mb: 4 }}>
              {(topic || grouped.length > 1) && (
                <Box sx={{ display: 'flex', alignItems: 'center', px: 1, py: 1, borderBottom: `1px solid ${palette.border}` }}>
                  <Typography sx={{ flex: 1, fontSize: '1.45rem', fontWeight: 400, color: palette.ink }}>{topic?.name ?? 'No topic'}</Typography>
                  <IconButton size="small" onClick={() => toggleGroup(gid)} aria-label={isCollapsed ? 'Expand topic' : 'Collapse topic'}>
                    {isCollapsed ? <ExpandMore /> : <ExpandLess />}
                  </IconButton>
                  {isInstructor && topic && (
                    <IconButton size="small" aria-label={`Topic options for ${topic.name}`} onClick={(e) => setTopicMenu({ el: e.currentTarget, topic })}>
                      <MoreVert fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              )}
              <Collapse in={!isCollapsed}>
                {items.length === 0 && (
                  <Typography variant="body2" sx={{ color: palette.inkTertiary, px: 1, py: 2 }}>Nothing under this topic yet.</Typography>
                )}
                {items.map((work) => {
                  const Icon = KIND_META[work.kind].icon;
                  const sub = mySubmission(work.id);
                  const done = sub && sub.status !== 'assigned';
                  const filled = work.kind !== 'material';
                  return (
                    <Box key={work.id} onClick={() => openWork(work)} role="link" tabIndex={0}
                      onKeyDown={(e) => { if (e.key === 'Enter') openWork(work); }}
                      sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 1, py: 1.25, borderBottom: `1px solid ${palette.border}`, cursor: 'pointer', '&:hover': { bgcolor: palette.surfaceMuted } }}>
                      <Box sx={{
                        width: 36, height: 36, borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0,
                        bgcolor: filled ? (done ? palette.surfaceSunken : palette.primarySoft) : 'transparent',
                        border: filled ? 'none' : `2px solid ${palette.inkTertiary}`,
                      }}>
                        <Icon sx={{ fontSize: 19, color: filled ? (done ? palette.inkTertiary : palette.primary) : palette.inkSecondary }} />
                      </Box>
                      <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: '0.95rem' }}>{work.title}</Typography>
                      {!isInstructor && done && <StatusPill label={sub?.status === 'returned' ? 'Graded' : 'Done'} tone="success" />}
                      <Typography variant="body2" sx={{ color: isOverdue(work.dueDate) && !done && !isInstructor ? palette.danger : palette.inkSecondary, whiteSpace: 'nowrap', display: { xs: 'none', sm: 'block' } }}>
                        {whenLabel(work)}
                      </Typography>
                      <IconButton size="small" aria-label="Options" onClick={(e) => { e.stopPropagation(); setMenuFor({ el: e.currentTarget, work }); }}>
                        <MoreVert fontSize="small" />
                      </IconButton>
                    </Box>
                  );
                })}
              </Collapse>
            </Box>
          );
        })
      )}

      {shownExtra.map((g) => {
        const gid = `x:${g.id}`;
        const isCollapsed = collapsed.has(gid);
        return (
          <Box key={gid} sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', px: 1, py: 1, borderBottom: `1px solid ${palette.border}` }}>
              <Typography sx={{ flex: 1, fontSize: '1.45rem', fontWeight: 400, color: palette.ink }}>{g.name}</Typography>
              <IconButton size="small" onClick={() => toggleGroup(gid)} aria-label={isCollapsed ? 'Expand' : 'Collapse'}>
                {isCollapsed ? <ExpandMore /> : <ExpandLess />}
              </IconButton>
            </Box>
            <Collapse in={!isCollapsed}>
              {g.rows.map((r) => (
                <Box key={r.id} onClick={r.onOpen} role="link" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') r.onOpen(); }}
                  sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 1, py: 1.25, borderBottom: `1px solid ${palette.border}`, cursor: 'pointer', '&:hover': { bgcolor: palette.surfaceMuted } }}>
                  <Box sx={{ width: 36, height: 36, borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0,
                    bgcolor: r.kind === 'quiz' ? palette.primarySoft : 'transparent', border: r.kind === 'quiz' ? 'none' : `2px solid ${palette.inkTertiary}` }}>
                    {r.kind === 'quiz' ? <Grading sx={{ fontSize: 19, color: palette.primary }} /> : <InsertDriveFile sx={{ fontSize: 18, color: palette.inkSecondary }} />}
                  </Box>
                  <Typography noWrap sx={{ flex: 1, minWidth: 0, fontSize: '0.95rem' }}>{r.title}</Typography>
                  {r.status && <StatusPill label={r.status} tone="success" />}
                  <Typography variant="body2" sx={{ color: palette.inkSecondary, whiteSpace: 'nowrap', display: { xs: 'none', sm: 'block' } }}>{r.when}</Typography>
                  {r.onDelete && (
                    <IconButton size="small" aria-label={`Delete ${r.title}`} onClick={(e) => { e.stopPropagation(); r.onDelete?.(); }}>
                      <Delete fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              ))}
            </Collapse>
          </Box>
        );
      })}

      {/* Item menu */}
      <Menu anchorEl={menuFor?.el} open={Boolean(menuFor)} onClose={() => setMenuFor(null)}>
        <MenuItem onClick={async () => {
          if (menuFor) { try { await navigator.clipboard.writeText(`${window.location.origin}/classroom/${classroomId}/work/${menuFor.work.id}`); setToast({ severity: 'success', message: 'Link copied.' }); } catch { /* ignore */ } }
          setMenuFor(null);
        }}>
          <ListItemIcon><InsertDriveFile fontSize="small" /></ListItemIcon>
          <ListItemText>Copy link</ListItemText>
        </MenuItem>
        {isInstructor && menuFor?.work.kind !== 'material' && (
          <MenuItem onClick={() => { if (menuFor) setGradingFor(menuFor.work); setMenuFor(null); }}>
            <ListItemIcon><Grading fontSize="small" /></ListItemIcon>
            <ListItemText>Review submissions</ListItemText>
          </MenuItem>
        )}
        {isInstructor && (
          <MenuItem onClick={() => { if (menuFor) openEditor(menuFor.work); setMenuFor(null); }}>
            <ListItemIcon><Edit fontSize="small" /></ListItemIcon>
            <ListItemText>Edit</ListItemText>
          </MenuItem>
        )}
        {isInstructor && (
          <MenuItem sx={{ color: palette.danger }} onClick={async () => {
            if (menuFor && window.confirm(`Delete "${menuFor.work.title}"? Comments and student work will also be deleted.`)) report(await onDeleteClasswork(menuFor.work.id), 'Classwork deleted.');
            setMenuFor(null);
          }}>
            <ListItemIcon><Delete fontSize="small" sx={{ color: palette.danger }} /></ListItemIcon>
            <ListItemText>Delete</ListItemText>
          </MenuItem>
        )}
      </Menu>

      {/* Topic menu */}
      <Menu anchorEl={topicMenu?.el} open={Boolean(topicMenu)} onClose={() => setTopicMenu(null)}>
        <MenuItem onClick={async () => {
          const t = topicMenu?.topic; setTopicMenu(null);
          const name = t ? window.prompt('Rename topic', t.name) : null;
          if (t && name && name.trim()) report(await onSaveTopic({ ...t, name: name.trim() }), 'Topic renamed.');
        }}>Rename</MenuItem>
        <MenuItem sx={{ color: palette.danger }} onClick={async () => {
          const t = topicMenu?.topic; setTopicMenu(null);
          if (t && window.confirm(`Delete topic "${t.name}"? Its classwork is kept under "No topic".`)) report(await onDeleteTopic(t.id), 'Topic removed.');
        }}>Delete</MenuItem>
      </Menu>

      {/* Create / edit classwork: full screen, like Google Classroom */}
      <Dialog open={editorOpen} onClose={() => setEditorOpen(false)} fullScreen>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1, borderBottom: `1px solid ${palette.border}` }}>
          <IconButton onClick={() => setEditorOpen(false)} aria-label="Close"><Close /></IconButton>
          <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: palette.primarySoft, display: 'grid', placeItems: 'center' }}>
            {(() => { const I = KIND_META[form.kind].icon; return <I sx={{ fontSize: 20, color: palette.primary }} />; })()}
          </Box>
          <Typography sx={{ fontSize: '1.4rem', flex: 1 }}>{KIND_META[form.kind].label}</Typography>
          <Button variant="contained" onClick={saveWork} disabled={!form.title.trim() || busy || uploading} sx={{ borderRadius: 999, px: 3, textTransform: 'none', fontWeight: 600 }}>
            {editing ? 'Save' : form.kind === 'assignment' || form.kind === 'question' ? 'Assign' : 'Post'}
          </Button>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, flex: 1, overflow: 'auto', bgcolor: palette.canvas }}>
          <Box sx={{ flex: 1, p: { xs: 2, md: 4 }, display: 'flex', flexDirection: 'column', gap: 2.5, alignItems: 'center' }}>
            <Paper elevation={0} sx={{ width: '100%', maxWidth: 900, p: 3, borderRadius: '10px', border: `1px solid ${palette.border}` }}>
              <TextField fullWidth variant="filled" label="Title" required autoFocus value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })} helperText="*Required" sx={{ mb: 2 }} />
              <TextField fullWidth variant="filled" multiline minRows={4}
                label={form.kind === 'question' ? 'Question details (optional)' : form.kind === 'material' ? 'Description (optional)' : 'Instructions (optional)'}
                value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
            </Paper>
            <Paper elevation={0} sx={{ width: '100%', maxWidth: 900, p: 3, borderRadius: '10px', border: `1px solid ${palette.border}` }}>
              <Typography sx={{ fontWeight: 500, mb: 2 }}>Attach</Typography>
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: { xs: 2, sm: 4 }, flexWrap: 'wrap' }}>
                {[
                  { key: 'upload', label: uploading ? 'Uploading…' : 'Upload', icon: <AttachFile /> },
                  { key: 'youtube', label: 'YouTube', icon: <Box component="span" sx={{ color: '#ff0000', fontWeight: 900, fontSize: 18 }}>▶</Box> },
                  { key: 'link', label: 'Link', icon: <InsertDriveFile /> },
                ].map((b) => (
                  <Box key={b.key} sx={{ textAlign: 'center' }}>
                    {b.key === 'upload' ? (
                      <IconButton component="label" disabled={uploading} sx={{ width: 52, height: 52, border: `1px solid ${palette.border}` }}>
                        {b.icon}
                        <input type="file" hidden multiple onChange={(e) => { uploadTo(e.target.files, 'work'); e.target.value = ''; }} />
                      </IconButton>
                    ) : (
                      <IconButton onClick={() => addLink(b.key)} sx={{ width: 52, height: 52, border: `1px solid ${palette.border}` }}>{b.icon}</IconButton>
                    )}
                    <Typography variant="body2" sx={{ mt: 0.5 }}>{b.label}</Typography>
                  </Box>
                ))}
              </Box>
              {form.attachments.length > 0 && (
                <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap', mt: 2 }}>
                  {form.attachments.map((a) => (
                    <AttachmentRow key={a.id} att={a} onRemove={() => setForm((f) => ({ ...f, attachments: f.attachments.filter((x) => x.id !== a.id) }))} />
                  ))}
                </Stack>
              )}
            </Paper>
          </Box>
          <Box sx={{ width: { xs: '100%', md: 340 }, borderLeft: { md: `1px solid ${palette.border}` }, p: 3, bgcolor: palette.surface, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.75 }}>For</Typography>
              <TextField fullWidth size="small" value={className || 'This class'} InputProps={{ readOnly: true }} />
            </Box>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.75 }}>Assign to</Typography>
              <Button fullWidth variant="outlined" disabled sx={{ borderRadius: 999, textTransform: 'none' }}>All students</Button>
            </Box>
            {form.kind !== 'material' && (
              <>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.75 }}>Points</Typography>
                  <TextField fullWidth size="small" type="number" placeholder="Ungraded" value={form.points}
                    onChange={(e) => setForm({ ...form, points: e.target.value })} inputProps={{ min: 0 }} />
                </Box>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.75 }}>Due</Typography>
                  <TextField fullWidth size="small" type="datetime-local" value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })} helperText={form.dueDate ? '' : 'No due date'} />
                </Box>
              </>
            )}
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.75 }}>Topic</Typography>
              <TextField select fullWidth size="small" value={form.topicId} SelectProps={{ displayEmpty: true }} onChange={(e) => {
                if (e.target.value === '__new') { setTopicOpen(true); return; }
                setForm({ ...form, topicId: e.target.value });
              }}>
                <MenuItem value="">No topic</MenuItem>
                {topics.map((t) => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
                <MenuItem value="__new"><em>Create topic…</em></MenuItem>
              </TextField>
            </Box>
          </Box>
        </Box>
      </Dialog>

      {/* Reuse post */}
      <Dialog open={reuseOpen} onClose={() => setReuseOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Reuse post</DialogTitle>
        <DialogContent dividers>
          {classwork.length === 0 ? (
            <Typography variant="body2" sx={{ color: palette.inkSecondary }}>Nothing to reuse yet.</Typography>
          ) : classwork.map((w) => {
            const I = KIND_META[w.kind].icon;
            return (
              <MenuItem key={w.id} onClick={() => {
                setReuseOpen(false);
                openEditor(undefined, w.kind, { ...w, title: `${w.title} (copy)`, dueDate: undefined });
              }}>
                <ListItemIcon><I fontSize="small" /></ListItemIcon>
                <ListItemText primary={w.title} secondary={KIND_META[w.kind].label} />
              </MenuItem>
            );
          })}
        </DialogContent>
        <DialogActions><Button onClick={() => setReuseOpen(false)}>Cancel</Button></DialogActions>
      </Dialog>

      {/* View your work (students) */}
      <Dialog open={yourWorkOpen} onClose={() => setYourWorkOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Your work</DialogTitle>
        <DialogContent dividers>
          {visibleWork.filter((w) => w.kind !== 'material').length === 0 ? (
            <Typography variant="body2" sx={{ color: palette.inkSecondary }}>No assigned work yet.</Typography>
          ) : visibleWork.filter((w) => w.kind !== 'material').map((w) => {
            const sub = mySubmission(w.id);
            const st = sub?.status === 'returned' ? (sub.grade != null ? `${sub.grade}/${w.points ?? '—'}` : 'Returned')
              : sub && sub.status !== 'assigned' ? (sub.isLate ? 'Turned in late' : 'Turned in')
              : isOverdue(w.dueDate) ? 'Missing' : 'Assigned';
            return (
              <MenuItem key={w.id} onClick={() => { setYourWorkOpen(false); openWork(w); }} sx={{ justifyContent: 'space-between', gap: 2 }}>
                <ListItemText primary={w.title} secondary={whenLabel(w)} />
                <StatusPill label={st} tone={st === 'Missing' ? 'danger' : st === 'Assigned' ? 'info' : 'success'} />
              </MenuItem>
            );
          })}
        </DialogContent>
        <DialogActions><Button onClick={() => setYourWorkOpen(false)}>Close</Button></DialogActions>
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
