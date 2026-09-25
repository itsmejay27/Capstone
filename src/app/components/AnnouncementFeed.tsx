import { useMemo, useRef, useState } from 'react';
import {
  Box, Paper, Typography, Button, IconButton, Menu, MenuItem, Avatar, Chip, Stack,
  Snackbar, Alert, Divider, Tooltip, CircularProgress, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import {
  PushPin, PushPinOutlined, MoreVert, Edit, Delete, AttachFile, Close, Campaign,
  FormatBold, FormatItalic, FormatListBulleted, InsertLink, Send, InsertDriveFile, EditOutlined, Repeat,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import type { Announcement, AnnouncementAttachment, MutationResult, PostComment } from '../types';
import CommentThread from './CommentThread';
import { usePrompt } from './PromptDialog';
import FileCard from './classroom/FileCard';
import { sanitizeRichText, isBlankRichText } from '../utils/sanitizeHtml';
import { uploadClassroomFile, formatBytes } from '../services/fileStorage';
import { useIsMobile } from '../hooks/useResponsive';

/**
 * Google-Classroom-style announcement stream for a classroom.
 *
 * Presentational + local composer state. Every mutation goes out through the onSave/onDelete
 * props so the page can wire them to AuthContext, and a failed MutationResult is always
 * surfaced — an announcement that silently failed to save is worse than no announcement.
 */

const MAX_BODY_LENGTH = 20000;

function relativeTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return '';
  }
}

function AttachmentChip({ att, onRemove }: { att: AnnouncementAttachment; onRemove?: () => void }) {
  const body = (
    <Chip
      icon={<InsertDriveFile />}
      label={`${att.name}${att.size ? ` · ${formatBytes(att.size)}` : ''}`}
      size="small"
      onDelete={onRemove}
      deleteIcon={onRemove ? <Close /> : undefined}
      sx={{
        maxWidth: '100%', bgcolor: 'var(--c-slate-100)', color: 'var(--c-slate-700)', fontWeight: 600,
        '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
      }}
    />
  );
  if (onRemove || !att.fileUrl) return body;
  return (
    <a href={att.fileUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', maxWidth: '100%' }}>
      {body}
    </a>
  );
}

/**
 * Rich-text composer built on contentEditable + document.execCommand.
 *
 * execCommand is deprecated but remains universally implemented, and it is the only way to
 * get bold/italic/list behaviour without pulling in an editor dependency (which the brief
 * forbids). Every command is guarded so an unsupported one degrades to a no-op rather than
 * throwing. The HTML is sanitized on submit, and again at render time.
 */
function Composer({
  classroomId,
  initial,
  onCancel,
  submitLabel,
  onSubmit,
  busy,
}: {
  classroomId: string;
  initial?: Announcement;
  onCancel?: () => void;
  submitLabel?: string;
  onSubmit: (bodyHtml: string, attachments: AnnouncementAttachment[], isPinned: boolean) => void;
  busy: boolean;
}) {
  const isMobile = useIsMobile();
  const editorRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<AnnouncementAttachment[]>(initial?.attachments ?? []);
  const [isPinned, setIsPinned] = useState(Boolean(initial?.isPinned));
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [empty, setEmpty] = useState(isBlankRichText(initial?.bodyHtml ?? ''));
  const { prompt, PromptHost } = usePrompt();

  const exec = (command: string, value?: string) => {
    try {
      editorRef.current?.focus();
      document.execCommand(command, false, value);
    } catch {
      /* Unsupported command: degrade to a no-op rather than breaking the composer. */
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadError(null);
    for (const file of Array.from(files)) {
      try {
        const stored = await uploadClassroomFile(classroomId, file);
        setAttachments((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            name: stored.name,
            size: stored.size,
            mimeType: stored.mimeType,
            fileUrl: stored.url,
            storagePath: stored.storagePath,
            isDataUrl: stored.isDataUrl,
          },
        ]);
      } catch (e: any) {
        setUploadError(e?.message || `Could not attach "${file.name}".`);
      }
    }
    setUploading(false);
  };

  const submit = () => {
    const raw = editorRef.current?.innerHTML ?? '';
    const clean = sanitizeRichText(raw, MAX_BODY_LENGTH);
    if (isBlankRichText(clean) && attachments.length === 0) return;
    onSubmit(clean, attachments, isPinned);
    if (!initial && editorRef.current) {
      editorRef.current.innerHTML = '';
      setAttachments([]);
      setIsPinned(false);
      setEmpty(true);
    }
  };

  const canSubmit = (!empty || attachments.length > 0) && !busy && !uploading;

  return (
    <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 3, border: '1px solid var(--c-slate-200)', bgcolor: 'var(--c-surface)', mb: 2.5 }}>
      {PromptHost}
      <Stack direction="row" spacing={0.5} sx={{ mb: 1, flexWrap: 'wrap', gap: 0.5 }}>
        <Tooltip title="Bold"><IconButton size="small" onMouseDown={(e) => { e.preventDefault(); exec('bold'); }}><FormatBold fontSize="small" /></IconButton></Tooltip>
        <Tooltip title="Italic"><IconButton size="small" onMouseDown={(e) => { e.preventDefault(); exec('italic'); }}><FormatItalic fontSize="small" /></IconButton></Tooltip>
        <Tooltip title="Bulleted list"><IconButton size="small" onMouseDown={(e) => { e.preventDefault(); exec('insertUnorderedList'); }}><FormatListBulleted fontSize="small" /></IconButton></Tooltip>
        <Tooltip title="Insert link">
          <IconButton
            size="small"
            onMouseDown={async (e) => {
              e.preventDefault();
              // The dialog takes focus, so remember where the cursor was in the editor.
              const sel = window.getSelection();
              const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
              const url = await prompt({ title: 'Insert link', kind: 'link' });
              if (!url) return;
              editorRef.current?.focus();
              if (range) { const s2 = window.getSelection(); s2?.removeAllRanges(); s2?.addRange(range); }
              if (range && !range.collapsed) exec('createLink', url);
              else exec('insertHTML', `<a href="${url.replace(/"/g, '&quot;')}">${url.replace(/</g, '&lt;')}</a>`);
            }}
          >
            <InsertLink fontSize="small" />
          </IconButton>
        </Tooltip>
        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
        <Tooltip title="Attach a file">
          <span>
            <IconButton size="small" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <CircularProgress size={18} /> : <AttachFile fontSize="small" />}
            </IconButton>
          </span>
        </Tooltip>
        <input ref={fileRef} type="file" hidden multiple onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }} />
      </Stack>

      <Box
        ref={editorRef}
        contentEditable={!busy}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Announcement body"
        onInput={() => setEmpty(isBlankRichText(editorRef.current?.innerHTML ?? ''))}
        dangerouslySetInnerHTML={{ __html: sanitizeRichText(initial?.bodyHtml ?? '', MAX_BODY_LENGTH) }}
        sx={{
          minHeight: 84, maxHeight: 340, overflowY: 'auto',
          border: '1px solid var(--c-slate-200)', borderRadius: 2, p: 1.5,
          fontSize: '0.92rem', lineHeight: 1.6, color: 'var(--c-slate-900)',
          outline: 'none', wordBreak: 'break-word',
          '&:focus': { borderColor: 'var(--c-emerald-600)', boxShadow: '0 0 0 3px rgba(5,150,105,0.12)' },
          '& ul': { pl: 3, my: 0.5 },
          '& a': { color: 'var(--c-emerald-600)' },
          '&:empty::before': {
            content: '"Share an update with your class…"',
            color: 'var(--c-slate-400)',
          },
        }}
      />

      {attachments.length > 0 && (
        <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap', mt: 1.25 }}>
          {attachments.map((a) => (
            <AttachmentChip key={a.id} att={a} onRemove={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))} />
          ))}
        </Stack>
      )}

      {uploadError && (
        <Alert severity="error" onClose={() => setUploadError(null)} sx={{ mt: 1.25, borderRadius: 2, fontSize: '0.82rem' }}>
          {uploadError}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <ToggleButtonGroup
          value={isPinned ? ['pin'] : []}
          onChange={() => setIsPinned((v) => !v)}
          size="small"
        >
          <ToggleButton value="pin" sx={{ textTransform: 'none', fontWeight: 700, gap: 0.5 }}>
            {isPinned ? <PushPin fontSize="small" /> : <PushPinOutlined fontSize="small" />}
            {isMobile ? '' : isPinned ? 'Pinned' : 'Pin'}
          </ToggleButton>
        </ToggleButtonGroup>
        <Box sx={{ flex: 1 }} />
        {onCancel && (
          <Button onClick={onCancel} sx={{ fontWeight: 700, textTransform: 'none' }} disabled={busy}>
            Cancel
          </Button>
        )}
        <Button
          variant="contained"
          startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <Send />}
          onClick={submit}
          disabled={!canSubmit}
          sx={{ bgcolor: 'var(--c-emerald-600)', fontWeight: 800, textTransform: 'none', '&:hover': { bgcolor: 'var(--c-emerald-700)' } }}
        >
          {submitLabel || (initial ? 'Save changes' : 'Post')}
        </Button>
      </Box>
    </Paper>
  );
}

function AnnouncementCard({
  announcement, isInstructor, onEdit, onDelete, onTogglePin, commentSlot, accent, authorAvatar,
}: {
  accent?: string;
  authorAvatar?: string;
  announcement: Announcement;
  isInstructor: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  /** Rendered beneath the body — the class/private comment thread for this post. */
  commentSlot?: React.ReactNode;
}) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);

  const d = new Date(announcement.createdAt);
  const when = d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : d.toDateString() === new Date(Date.now() - 86_400_000).toDateString()
      ? 'Yesterday'
      : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <Paper
      elevation={0}
      sx={{
        mb: 2, borderRadius: '10px', overflow: 'hidden', bgcolor: 'var(--c-surface)',
        border: announcement.isPinned ? '2px solid #fbbf24' : '1px solid var(--c-border)',
      }}
    >
      <Box sx={{ px: { xs: 2, sm: 3 }, pt: 2, pb: 1.5 }}>
        <Box sx={{ display: 'flex', gap: 1.75, alignItems: 'center' }}>
          <Avatar src={authorAvatar} sx={{ bgcolor: accent || '#0b8ea8', width: 40, height: 40, flexShrink: 0 }}>
            {(announcement.authorName || '?').charAt(0).toUpperCase()}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 500, fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: 1 }}>
              {announcement.authorName}
              {announcement.isPinned && <PushPin sx={{ fontSize: 15, color: '#d97706' }} />}
            </Typography>
            <Typography variant="caption" sx={{ color: 'var(--c-ink-secondary)' }}>
              {when}{announcement.updatedAt ? ' (Edited)' : ''}
            </Typography>
          </Box>
          {isInstructor && (
            <>
              <IconButton size="small" onClick={(e) => setAnchor(e.currentTarget)} aria-label="Announcement actions">
                <MoreVert fontSize="small" />
              </IconButton>
              <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
                <MenuItem onClick={() => { setAnchor(null); onTogglePin(); }}>
                  {announcement.isPinned ? <PushPinOutlined fontSize="small" sx={{ mr: 1 }} /> : <PushPin fontSize="small" sx={{ mr: 1 }} />}
                  {announcement.isPinned ? 'Unpin' : 'Move to top'}
                </MenuItem>
                <MenuItem onClick={() => { setAnchor(null); onEdit(); }}>
                  <Edit fontSize="small" sx={{ mr: 1 }} /> Edit
                </MenuItem>
                <MenuItem onClick={() => { setAnchor(null); onDelete(); }} sx={{ color: 'var(--c-red-600)' }}>
                  <Delete fontSize="small" sx={{ mr: 1 }} /> Delete
                </MenuItem>
              </Menu>
            </>
          )}
        </Box>

        {/* Re-sanitized at render: stored HTML predates any later tightening of the allow-list,
            and a database row is not a trust boundary. */}
        <Box
          sx={{
            mt: 1.5, color: 'var(--c-ink)', fontSize: '0.9rem', lineHeight: 1.6, wordBreak: 'break-word',
            '& ul, & ol': { pl: 3, my: 0.5 },
            '& a': { color: accent || 'var(--c-primary)' },
            '& p': { my: 0.5 },
          }}
          dangerouslySetInnerHTML={{ __html: sanitizeRichText(announcement.bodyHtml, MAX_BODY_LENGTH) }}
        />

        {announcement.attachments?.length > 0 && (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 300px))' }, gap: 1.5, mt: 1.5 }}>
            {announcement.attachments.map((a) => <FileCard key={a.id} att={a} />)}
          </Box>
        )}
      </Box>

      {commentSlot && (
        <Box sx={{ px: { xs: 1.5, sm: 2.5 }, pb: 0.5 }}>
          {commentSlot}
        </Box>
      )}
    </Paper>
  );
}

export default function AnnouncementFeed({
  classroomId,
  announcements,
  isInstructor,
  currentUserId,
  currentUserName,
  onSave,
  onDelete,
  comments = [],
  onSaveComment,
  onDeleteComment,
  activity = [],
  accent,
  avatarFor,
}: {
  avatarFor?: (userId: string) => string | undefined;
  /** Other stream items (e.g. "posted a new assignment"), interleaved by date. */
  activity?: { id: string; at: string; node: React.ReactNode }[];
  accent?: string;
  classroomId: string;
  announcements: Announcement[];
  isInstructor: boolean;
  currentUserId: string;
  currentUserName: string;
  onSave: (a: Announcement) => Promise<MutationResult>;
  onDelete: (id: string) => Promise<MutationResult>;
  comments?: PostComment[];
  onSaveComment?: (c: PostComment) => Promise<MutationResult>;
  onDeleteComment?: (id: string) => Promise<MutationResult>;
}) {
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [composing, setComposing] = useState(false);
  const [repostEl, setRepostEl] = useState<HTMLElement | null>(null);
  const [repostFrom, setRepostFrom] = useState<Announcement | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ severity: 'success' | 'error'; message: string } | null>(null);

  // Pinned first, then newest first.
  const ordered = useMemo(() => {
    return [...(announcements || [])].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      const at = new Date(a.createdAt).getTime() || 0;
      const bt = new Date(b.createdAt).getTime() || 0;
      return bt - at;
    });
  }, [announcements]);

  const report = (r: MutationResult, successMessage: string) => {
    setToast(r.ok ? { severity: 'success', message: successMessage } : { severity: 'error', message: r.error || 'Something went wrong.' });
  };

  const handleCreate = async (bodyHtml: string, attachments: AnnouncementAttachment[], isPinned: boolean) => {
    setBusy(true);
    const announcement: Announcement = {
      id: crypto.randomUUID(),
      classroomId,
      authorId: currentUserId,
      authorName: currentUserName,
      bodyHtml,
      attachments,
      isPinned,
      createdAt: new Date().toISOString(),
    };
    report(await onSave(announcement), 'Announcement posted.');
    setBusy(false);
    setComposing(false);
    setRepostFrom(null);
  };

  const handleUpdate = async (bodyHtml: string, attachments: AnnouncementAttachment[], isPinned: boolean) => {
    if (!editing) return;
    setBusy(true);
    report(
      await onSave({ ...editing, bodyHtml, attachments, isPinned, updatedAt: new Date().toISOString() }),
      'Announcement updated.'
    );
    setEditing(null);
    setBusy(false);
  };

  const handleTogglePin = async (a: Announcement) => {
    report(await onSave({ ...a, isPinned: !a.isPinned, updatedAt: new Date().toISOString() }), a.isPinned ? 'Unpinned.' : 'Pinned to the top.');
  };

  const handleDelete = async (id: string) => {
    report(await onDelete(id), 'Announcement deleted.');
  };

  return (
    <Box>
      {isInstructor && !editing && !composing && !repostFrom && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Button
          startIcon={<EditOutlined />}
          onClick={() => setComposing(true)}
          sx={{ borderRadius: 999, px: 2.5, py: 1, textTransform: 'none', fontWeight: 600,
            bgcolor: accent ? `${accent}22` : 'var(--c-primary-soft)', color: accent || 'var(--c-primary)',
            '&:hover': { bgcolor: accent ? `${accent}33` : 'var(--c-primary-soft)' } }}
        >
          New announcement
        </Button>
        {ordered.length > 0 && (
          <Button startIcon={<Repeat />} onClick={(e) => setRepostEl(e.currentTarget)} sx={{ textTransform: 'none', fontWeight: 600, color: accent || 'var(--c-primary)' }}>
            Repost
          </Button>
        )}
        </Box>
      )}
      <Menu anchorEl={repostEl} open={Boolean(repostEl)} onClose={() => setRepostEl(null)} PaperProps={{ sx: { maxWidth: 420 } }}>
        {ordered.slice(0, 15).map((a) => (
          <MenuItem key={a.id} onClick={() => { setRepostEl(null); setRepostFrom(a); }}>
            <Typography noWrap variant="body2">{(a.bodyHtml || '').replace(/<[^>]+>/g, ' ').trim().slice(0, 80) || 'Announcement'}</Typography>
          </MenuItem>
        ))}
      </Menu>
      {isInstructor && repostFrom && (
        <Composer classroomId={classroomId} initial={{ ...repostFrom, isPinned: false }} onSubmit={handleCreate} onCancel={() => setRepostFrom(null)} busy={busy} submitLabel="Post" />
      )}
      {isInstructor && !editing && composing && (
        <Composer classroomId={classroomId} onSubmit={handleCreate} onCancel={() => setComposing(false)} busy={busy} />
      )}
      {isInstructor && editing && (
        <Composer
          classroomId={classroomId}
          initial={editing}
          onCancel={() => setEditing(null)}
          onSubmit={handleUpdate}
          busy={busy}
        />
      )}

      {ordered.length === 0 && activity.length === 0 ? (
        <Paper elevation={0} sx={{ p: { xs: 3, sm: 5 }, textAlign: 'center', borderRadius: 3, border: '1px solid var(--c-slate-200)', bgcolor: 'var(--c-surface)' }}>
          <Campaign sx={{ fontSize: 44, color: 'var(--c-slate-400)', mb: 1 }} />
          <Typography variant="h6" fontWeight={800} color="var(--c-slate-900)">No announcements yet</Typography>
          <Typography variant="body2" sx={{ color: 'var(--c-slate-500)' }}>
            {isInstructor
              ? 'Post an update, attach a handout, or pin something important to the top of the class stream.'
              : 'Your instructor has not posted any announcements yet.'}
          </Typography>
        </Paper>
      ) : (
        [...ordered.map((a) => ({ kind: 'a' as const, a, at: a.createdAt, pinned: a.isPinned })),
          ...activity.map((x) => ({ kind: 'x' as const, x, at: x.at, pinned: false }))]
          .sort((p, q) => (p.pinned !== q.pinned ? (p.pinned ? -1 : 1) : (new Date(q.at).getTime() || 0) - (new Date(p.at).getTime() || 0)))
          .map((item) => item.kind === 'x' ? <Box key={`x-${item.x.id}`}>{item.x.node}</Box> : (() => { const a = item.a; return (
          <AnnouncementCard
            key={a.id}
            announcement={a}
            isInstructor={isInstructor}
            onEdit={() => setEditing(a)}
            onDelete={() => handleDelete(a.id)}
            onTogglePin={() => handleTogglePin(a)}
            accent={accent}
            authorAvatar={avatarFor?.(a.authorId)}
            commentSlot={
              onSaveComment && onDeleteComment ? (
                <CommentThread
                  classroomId={classroomId}
                  postType="announcement"
                  postId={a.id}
                  comments={comments}
                  currentUserId={currentUserId}
                  currentUserName={currentUserName}
                  isInstructor={isInstructor}
                  onSave={onSaveComment}
                  onDelete={onDeleteComment}
                  allowPrivate={false}
                />
              ) : undefined
            }
          />
        ); })())
      )}

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={toast?.severity === 'error' ? 9000 : 3500}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={toast?.severity} onClose={() => setToast(null)} sx={{ fontWeight: 600, borderRadius: 2.5 }}>
          {toast?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
