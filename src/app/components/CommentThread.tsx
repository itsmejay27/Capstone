import { useMemo, useState } from 'react';
import {
  Box, Avatar, Typography, TextField, Button, IconButton, Menu, MenuItem,
  Collapse, Chip, Stack, Divider, Tooltip,
} from '@mui/material';
import { Send, MoreVert, Delete, Lock, Public, ChatBubbleOutline } from '@mui/icons-material';
import { formatDistanceToNow } from 'date-fns';
import type { PostComment, CommentVisibility, MutationResult } from '../types';
import { palette, radius } from '../theme/tokens';

/**
 * Comment thread for an announcement or a classwork post.
 *
 * Two channels, as in Google Classroom:
 *  - "class"   — visible to everyone in the class
 *  - "private" — a side channel between one student and the instructor
 *
 * IMPORTANT: private comments are filtered HERE, in the client. The database policy for
 * post_comments is permissive (matching the rest of this schema), so this is a UI affordance,
 * not a security boundary. Anyone able to query the table directly can read them. Making it
 * a real boundary needs Supabase Auth + an RLS policy keyed on auth.uid().
 */

function relative(iso: string): string {
  try {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return '';
  }
}

export default function CommentThread({
  classroomId,
  postType,
  postId,
  comments,
  currentUserId,
  currentUserName,
  isInstructor,
  onSave,
  onDelete,
  /** When set, the private channel is scoped to this student (instructor viewing one turn-in). */
  privateWithStudentId,
  allowPrivate = true,
}: {
  classroomId: string;
  postType: 'announcement' | 'classwork';
  postId: string;
  comments: PostComment[];
  currentUserId: string;
  currentUserName: string;
  isInstructor: boolean;
  onSave: (c: PostComment) => Promise<MutationResult>;
  onDelete: (id: string) => Promise<MutationResult>;
  privateWithStudentId?: string;
  allowPrivate?: boolean;
}) {
  const [draft, setDraft] = useState('');
  const [visibility, setVisibility] = useState<CommentVisibility>('class');
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [menuFor, setMenuFor] = useState<{ el: HTMLElement; id: string; authorId: string } | null>(null);

  const mine = useMemo(() => {
    const forPost = comments.filter((c) => c.postType === postType && c.postId === postId);
    return forPost
      .filter((c) => {
        if (c.visibility === 'class') return true;
        // A private comment is visible to its author, to the student it concerns, and to
        // the instructor.
        if (isInstructor) {
          return privateWithStudentId ? c.privateWithId === privateWithStudentId : true;
        }
        return c.privateWithId === currentUserId || c.authorId === currentUserId;
      })
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [comments, postType, postId, isInstructor, currentUserId, privateWithStudentId]);

  const classComments = mine.filter((c) => c.visibility === 'class');
  const privateComments = mine.filter((c) => c.visibility === 'private');
  const shown = visibility === 'private' ? privateComments : classComments;

  const post = async () => {
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    const comment: PostComment = {
      id: crypto.randomUUID(),
      classroomId,
      postType,
      postId,
      authorId: currentUserId,
      authorName: currentUserName,
      body,
      visibility,
      // For a student the private channel is with themselves; for an instructor it targets
      // the student whose work is open.
      privateWithId:
        visibility === 'private' ? (isInstructor ? privateWithStudentId ?? null : currentUserId) : null,
      createdAt: new Date().toISOString(),
    };
    await onSave(comment);
    setDraft('');
    setBusy(false);
    setExpanded(true);
  };

  const canDelete = (c: PostComment) => isInstructor || c.authorId === currentUserId;

  return (
    <Box sx={{ mt: 1.5 }}>
      <Divider sx={{ mb: 1.5 }} />

      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, flexWrap: 'wrap', gap: 0.5 }}>
        <Button
          size="small"
          startIcon={<ChatBubbleOutline sx={{ fontSize: 15 }} />}
          onClick={() => setExpanded((v) => !v)}
          sx={{ color: palette.inkSecondary, fontWeight: 700 }}
        >
          {classComments.length === 0
            ? 'Add class comment'
            : `${classComments.length} class comment${classComments.length === 1 ? '' : 's'}`}
        </Button>

        {allowPrivate && (
          <Chip
            icon={visibility === 'private' ? <Lock sx={{ fontSize: '0.75rem !important' }} /> : <Public sx={{ fontSize: '0.75rem !important' }} />}
            label={visibility === 'private' ? 'Private' : 'Class'}
            size="small"
            onClick={() => { setVisibility((v) => (v === 'class' ? 'private' : 'class')); setExpanded(true); }}
            sx={{
              cursor: 'pointer', fontWeight: 700,
              bgcolor: visibility === 'private' ? palette.warningSoft : palette.surfaceSunken,
              color: visibility === 'private' ? palette.warning : palette.inkSecondary,
            }}
          />
        )}
        {privateComments.length > 0 && visibility === 'class' && (
          <Typography variant="caption" sx={{ color: palette.inkTertiary }}>
            · {privateComments.length} private
          </Typography>
        )}
      </Stack>

      <Collapse in={expanded} unmountOnExit>
        {visibility === 'private' && (
          <Typography variant="caption" sx={{ color: palette.warning, display: 'block', mb: 1, fontWeight: 600 }}>
            {isInstructor
              ? 'Private comments are seen only by you and this student.'
              : 'Private comments are seen only by you and your instructor.'}
          </Typography>
        )}

        {shown.length > 0 && (
          <Box sx={{ mb: 1.5 }}>
            {shown.map((c) => (
              <Box key={c.id} sx={{ display: 'flex', gap: 1.25, mb: 1.25, alignItems: 'flex-start' }}>
                <Avatar sx={{ width: 28, height: 28, bgcolor: palette.primarySoft, color: palette.primary, flexShrink: 0 }}>
                  {(c.authorName || '?').charAt(0).toUpperCase()}
                </Avatar>
                <Box
                  sx={{
                    flex: 1, minWidth: 0, bgcolor: palette.surfaceMuted,
                    border: `1px solid ${palette.border}`, borderRadius: '10px', px: 1.5, py: 1,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                    <Typography variant="caption" sx={{ fontWeight: 800, color: palette.ink }}>
                      {c.authorName}
                    </Typography>
                    <Typography variant="caption" sx={{ color: palette.inkTertiary }}>
                      {relative(c.createdAt)}
                    </Typography>
                    {c.visibility === 'private' && (
                      <Tooltip title="Private comment">
                        <Lock sx={{ fontSize: 12, color: palette.warning }} />
                      </Tooltip>
                    )}
                    <Box sx={{ flex: 1 }} />
                    {canDelete(c) && (
                      <IconButton
                        size="small"
                        aria-label="Comment actions"
                        onClick={(e) => setMenuFor({ el: e.currentTarget, id: c.id, authorId: c.authorId })}
                        sx={{ p: 0.25 }}
                      >
                        <MoreVert sx={{ fontSize: 14 }} />
                      </IconButton>
                    )}
                  </Box>
                  {/* Comment bodies are plain text, never HTML — rendered as text so there is
                      no markup injection surface here at all. */}
                  <Typography variant="body2" sx={{ color: palette.ink, whiteSpace: 'pre-wrap', wordBreak: 'break-word', mt: 0.25 }}>
                    {c.body}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        )}

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
          <Avatar sx={{ width: 28, height: 28, bgcolor: palette.primary, color: '#fff', flexShrink: 0 }}>
            {(currentUserName || '?').charAt(0).toUpperCase()}
          </Avatar>
          <TextField
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={visibility === 'private' ? 'Add a private comment…' : 'Add a class comment…'}
            multiline
            maxRows={4}
            onKeyDown={(e) => {
              // Enter sends; Shift+Enter makes a new line.
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); post(); }
            }}
          />
          <Button
            variant="contained"
            onClick={post}
            disabled={!draft.trim() || busy}
            sx={{ minWidth: 0, px: 1.5, flexShrink: 0 }}
            aria-label="Post comment"
          >
            <Send sx={{ fontSize: 17 }} />
          </Button>
        </Box>
      </Collapse>

      <Menu anchorEl={menuFor?.el} open={Boolean(menuFor)} onClose={() => setMenuFor(null)}>
        <MenuItem
          onClick={async () => { if (menuFor) await onDelete(menuFor.id); setMenuFor(null); }}
          sx={{ color: palette.danger }}
        >
          <Delete fontSize="small" sx={{ mr: 1 }} /> Delete
        </MenuItem>
      </Menu>
    </Box>
  );
}
