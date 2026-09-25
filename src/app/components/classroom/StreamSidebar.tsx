import { Box, Typography, Button, Paper, IconButton, Tooltip } from '@mui/material';
import { ContentCopy } from '@mui/icons-material';

/**
 * Left column of the class stream, as in Google Classroom: the class code (teachers) and an
 * "Upcoming" box listing work due in the next week, with a link to all classwork.
 */
export default function StreamSidebar({
  classCode, isInstructor, upcoming, onViewAll, onOpen, onCopyCode, accent, extra,
}: {
  classCode?: string;
  isInstructor: boolean;
  upcoming: { id: string; title: string; due: string }[];
  onViewAll: () => void;
  onOpen: (id: string) => void;
  onCopyCode?: () => void;
  accent: string;
  extra?: React.ReactNode;
}) {
  const card = { p: 2, borderRadius: '10px', border: '1px solid var(--c-border)', bgcolor: 'var(--c-surface)', mb: 2 } as const;
  return (
    <Box>
      {isInstructor && classCode && (
        <Paper elevation={0} sx={card}>
          <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', mb: 0.5 }}>Class code</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography sx={{ fontSize: '1.4rem', fontWeight: 600, color: accent, fontFamily: 'monospace' }}>{classCode}</Typography>
            {onCopyCode && (
              <Tooltip title="Copy class code"><IconButton size="small" onClick={onCopyCode}><ContentCopy fontSize="small" /></IconButton></Tooltip>
            )}
          </Box>
        </Paper>
      )}
      <Paper elevation={0} sx={card}>
        <Typography sx={{ fontWeight: 600, fontSize: '1rem', mb: 1 }}>Upcoming</Typography>
        {upcoming.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'var(--c-ink-secondary)', fontSize: '0.8rem' }}>Woohoo, no work due soon!</Typography>
        ) : (
          upcoming.slice(0, 4).map((u) => (
            <Box key={u.id} onClick={() => onOpen(u.id)} sx={{ cursor: 'pointer', mb: 1, '&:hover .t': { textDecoration: 'underline' } }}>
              <Typography variant="caption" sx={{ color: 'var(--c-ink-secondary)', display: 'block' }}>{u.due}</Typography>
              <Typography className="t" variant="body2" sx={{ fontSize: '0.8rem' }} noWrap>{u.title}</Typography>
            </Box>
          ))
        )}
        <Box sx={{ textAlign: 'right' }}>
          <Button size="small" onClick={onViewAll} sx={{ textTransform: 'none', fontWeight: 600, color: accent }}>View all</Button>
        </Box>
      </Paper>
      {extra}
    </Box>
  );
}
