import { useMemo, useRef, useState } from 'react';
import {
  Box, Paper, Typography, Button, IconButton, Menu, MenuItem, Avatar, Chip, Stack,
  Snackbar, Alert, Divider, Tooltip, CircularProgress, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import {
  PushPin, PushPinOutlined, MoreVert, Edit, Delete, AttachFile, Close, Campaign,
  FormatBold, FormatItalic, FormatListBulleted, InsertLink, Send, InsertDriveFile,
} from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import type { Announcement, AnnouncementAttachment, MutationResult } from '../types';
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
        maxWidth: '100%', bgcolor: '#f1f5f9', color: '#334155', fontWeight: 600,
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
  onSubmit,
  busy,
}: {
  classroomId: string;
  initial?: Announcement;
  onCancel?: () => void;
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
    <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#fff', mb: 2.5 }}>
      <Stack direction="row" spacing={0.5} sx={{ mb: 1, flexWrap: 'wrap', gap: 0.5 }}>
        <Tooltip title="Bold"><IconButton size="small" onMouseDown={(e) => { e.preventDefault(); exec('bold'); }}><FormatBold fontSize="small" /></IconButton></Tooltip>
        <Tooltip title="Italic"><IconButton size="small" onMouseDown={(e) => { e.preventDefault(); exec('italic'); }}><FormatItalic fontSize="small" /></IconButton></Tooltip>
        <Tooltip title="Bulleted list"><IconButton size="small" onMouseDown={(e) => { e.preventDefault(); exec('insertUnorderedList'); }}><FormatListBulleted fontSize="small" /></IconButton></Tooltip>
        <Tooltip title="Insert link">
          <IconButton
            size="small"
            onMouseDown={(e) => {
              e.preventDefault();
              const url = window.prompt('Link URL (http:// or https://)');
              if (url) exec('createLink', url);
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
          border: '1px solid #e2e8f0', borderRadius: 2, p: 1.5,
          fontSize: '0.92rem', lineHeight: 1.6, color: '#0f172a',
          outline: 'none', wordBreak: 'break-word',
          '&:focus': { borderColor: '#2563eb', boxShadow: '0 0 0 3px rgba(37,99,235,0.12)' },
          '& ul': { pl: 3, my: 0.5 },
          '& a': { color: '#2563eb' },
          '&:empty::before': {
            content: '"Share an update with your class…"',
            color: '#94a3b8',
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
          sx={{ bgcolor: '#2563eb', fontWeight: 800, textTransform: 'none', '&:hover': { bgcolor: '#1d4ed8' } }}
        >
          {initial ? 'Save changes' : 'Post'}
        </Button>
      </Box>
    </Paper>
  );
}

function AnnouncementCard({
  announcement, isInstructor, onEdit, onDelete, onTogglePin,
}: {
  announcement: Announcement;
  isInstructor: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
}) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 1.75, sm: 2.5 }, mb: 2, borderRadius: 3, bgcolor: '#fff',
        border: announcement.isPinned ? '2px solid #fbbf24' : '1px solid #e2e8f0',
      }}
    >
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
        <Avatar sx={{ bgcolor: '#2563eb', width: 40, height: 40, fontWeight: 800, flexShrink: 0 }}>
          {(announcement.authorName || '?').charAt(0).toUpperCase()}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography sx={{ fontWeight: 800, color: '#0f172a', fontSize: '0.92rem' }}>
              {announcement.authorName}
            </Typography>
            {announcement.isPinned && (
              <Chip icon={<PushPin sx={{ fontSize: '0.75rem !important' }} />} label="Pinned" size="small"
                sx={{ bgcolor: '#fef3c7', color: '#92400e', fontWeight: 800, height: 20, fontSize: '0.65rem' }} />
            )}
            <Typography variant="caption" sx={{ color: '#94a3b8' }}>
              {relativeTime(announcement.createdAt)}
              {announcement.updatedAt && ' · edited'}
            </Typography>
          </Box>
        </Box>
        {isInstructor && (
          <>
            <IconButton size="small" onClick={(e) => setAnchor(e.currentTarget)} aria-label="Announcement actions">
              <MoreVert fontSize="small" />
            </IconButton>
            <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
              <MenuItem onClick={() => { setAnchor(null); onTogglePin(); }}>
                {announcement.isPinned ? <PushPinOutlined fontSize="small" sx={{ mr: 1 }} /> : <PushPin fontSize="small" sx={{ mr: 1 }} />}
                {announcement.isPinned ? 'Unpin' : 'Pin to top'}
              </MenuItem>
              <MenuItem onClick={() => { setAnchor(null); onEdit(); }}>
                <Edit fontSize="small" sx={{ mr: 1 }} /> Edit
              </MenuItem>
              <MenuItem onClick={() => { setAnchor(null); onDelete(); }} sx={{ color: '#dc2626' }}>
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
          mt: 1.25, color: '#334155', fontSize: '0.92rem', lineHeight: 1.65, wordBreak: 'break-word',
          '& ul, & ol': { pl: 3, my: 0.5 },
          '& a': { color: '#2563eb' },
          '& p': { my: 0.5 },
        }}
        dangerouslySetInnerHTML={{ __html: sanitizeRichText(announcement.bodyHtml, MAX_BODY_LENGTH) }}
      />

      {announcement.attachments?.length > 0 && (
        <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap', mt: 1.5 }}>
          {announcement.attachments.map((a) => <AttachmentChip key={a.id} att={a} />)}
        </Stack>
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
}: {
  classroomId: string;
  announcements: Announcement[];
  isInstructor: boolean;
  currentUserId: string;
  currentUserName: string;
  onSave: (a: Announcement) => Promise<MutationResult>;
  onDelete: (id: string) => Promise<MutationResult>;
}) {
  const [editing, setEditing] = useState<Announcement | null>(null);
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
      {isInstructor && !editing && (
        <Composer classroomId={classroomId} onSubmit={handleCreate} busy={busy} />
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

      {ordered.length === 0 ? (
        <Paper elevation={0} sx={{ p: { xs: 3, sm: 5 }, textAlign: 'center', borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#fff' }}>
          <Campaign sx={{ fontSize: 44, color: '#94a3b8', mb: 1 }} />
          <Typography variant="h6" fontWeight={800} color="#0f172a">No announcements yet</Typography>
          <Typography variant="body2" sx={{ color: '#64748b' }}>
            {isInstructor
              ? 'Post an update, attach a handout, or pin something important to the top of the class stream.'
              : 'Your instructor has not posted any announcements yet.'}
          </Typography>
        </Paper>
      ) : (
        ordered.map((a) => (
          <AnnouncementCard
            key={a.id}
            announcement={a}
            isInstructor={isInstructor}
            onEdit={() => setEditing(a)}
            onDelete={() => handleDelete(a.id)}
            onTogglePin={() => handleTogglePin(a)}
          />
        ))
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
