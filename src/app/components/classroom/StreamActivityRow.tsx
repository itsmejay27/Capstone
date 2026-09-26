import { Box, Typography, Paper } from '@mui/material';
import { AssignmentOutlined, BookmarkBorder, HelpOutline, Quiz } from '@mui/icons-material';

const ICON: Record<string, any> = { assignment: AssignmentOutlined, material: BookmarkBorder, question: HelpOutline, exam: Quiz };
const WORD: Record<string, string> = { assignment: 'assignment', material: 'material', question: 'question', exam: 'assessment' };

/** "LEONARD FLORES posted a new material: Lesson 3" — one line in the class stream. */
export default function StreamActivityRow({
  kind, author, title, at, accent, onOpen,
}: { kind: string; author: string; title: string; at: string; accent: string; onOpen: () => void }) {
  const Icon = ICON[kind] || AssignmentOutlined;
  const d = new Date(at);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  const when = d.toDateString() === today.toDateString()
    ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : d.toDateString() === yesterday.toDateString() ? 'Yesterday' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return (
    <Paper
      elevation={0} onClick={onOpen} role="link" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}
      sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, mb: 2, borderRadius: '10px', cursor: 'pointer', border: '1px solid var(--c-border)', bgcolor: 'var(--c-surface)', '&:hover': { boxShadow: '0 1px 6px rgba(0,0,0,.15)' } }}
    >
      <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: accent, color: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        <Icon fontSize="small" />
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 500, display: '-webkit-box', WebkitLineClamp: { xs: 2, sm: 1 }, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {/* Phones drop the author, like the Google Classroom app: "New material: Lesson 3". */}
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>{author} posted a new {WORD[kind] || 'item'}: </Box>
          <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>New {WORD[kind] || 'item'}: </Box>
          {title}
        </Typography>
        {d.getTime() > Date.now() ? (
          // Only the instructor sees a future item; students get it at this time.
          <Typography variant="caption" sx={{ color: 'var(--c-amber-700)', fontWeight: 700 }}>
            Scheduled · students see it {d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </Typography>
        ) : (
          <Typography variant="caption" sx={{ color: 'var(--c-ink-secondary)' }}>{when}</Typography>
        )}
      </Box>
    </Paper>
  );
}
