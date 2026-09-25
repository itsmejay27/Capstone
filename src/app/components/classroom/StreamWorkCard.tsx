import { Box, Typography, Paper, IconButton } from '@mui/material';
import { AssignmentOutlined, HelpOutline, MoreVert } from '@mui/icons-material';
import type { ReactNode } from 'react';
import type { Classwork } from '../../types';
import FileCard from './FileCard';

/**
 * An assignment or question in the class stream, as Google Classroom shows it: a header line
 * ("X posted a new assignment: …  Due Sep 30"), then the posted date, the student's status,
 * the instructions, the attached files, and the class comments.
 */
export default function StreamWorkCard({
  work, author, accent, status, onOpen, comments,
}: {
  work: Classwork;
  author: string;
  accent: string;
  status?: string;
  onOpen: () => void;
  comments: ReactNode;
}) {
  const Icon = work.kind === 'question' ? HelpOutline : AssignmentOutlined;
  const due = work.dueDate ? `Due ${new Date(work.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : 'No due date';
  const posted = new Date(work.createdAt);
  return (
    <Paper elevation={0} sx={{ mb: 2, borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--c-border)', bgcolor: 'var(--c-surface)' }}>
      <Box onClick={onOpen} role="link" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}
        sx={{ display: 'flex', alignItems: 'center', gap: 2, px: { xs: 2, sm: 3 }, py: 1.5, cursor: 'pointer', borderBottom: '1px solid var(--c-border)', '&:hover .t': { textDecoration: 'underline' } }}>
        <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: `${accent}1f`, color: accent, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <Icon fontSize="small" />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography className="t" sx={{ fontSize: '0.92rem', display: { xs: '-webkit-box', sm: 'block' }, WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', whiteSpace: { sm: 'nowrap' }, textOverflow: 'ellipsis' }}>
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>{author} posted a new {work.kind === 'question' ? 'question' : 'assignment'}: </Box>
            <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>New {work.kind === 'question' ? 'question' : 'assignment'}: </Box>
            {work.title}
          </Typography>
          <Typography variant="caption" sx={{ display: { xs: 'block', sm: 'none' }, color: 'var(--c-ink-secondary)' }}>
            {posted.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {due}
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' }, fontWeight: 500, whiteSpace: 'nowrap', color: 'var(--c-ink-secondary)' }}>{due}</Typography>
        <IconButton size="small" aria-label="Open" onClick={(e) => { e.stopPropagation(); onOpen(); }}><MoreVert fontSize="small" /></IconButton>
      </Box>
      <Box sx={{ px: { xs: 2, sm: 3 }, pt: 1.5, pb: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="caption" sx={{ display: { xs: 'none', sm: 'block' }, fontWeight: 600, color: 'var(--c-ink-secondary)' }}>
            Posted {posted.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </Typography>
          {status && <Typography variant="body2" sx={{ fontWeight: 600, color: status === 'Missing' ? '#d93025' : 'var(--c-ink)' }}>{status}</Typography>}
        </Box>
        {work.instructions && <Typography variant="body2" sx={{ whiteSpace: 'pre-line', mb: 1.5 }}>{work.instructions}</Typography>}
        {work.attachments?.length > 0 && (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 300px))' }, gap: 1.5, mb: 1.5 }}>
            {work.attachments.map((a) => <FileCard key={a.id} att={a} />)}
          </Box>
        )}
      </Box>
      <Box sx={{ px: { xs: 1.5, sm: 2.5 }, pb: 0.5 }}>{comments}</Box>
    </Paper>
  );
}
