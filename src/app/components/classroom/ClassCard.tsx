import { Box, Typography, Avatar, IconButton, Tooltip } from '@mui/material';
import { MoreVert, AssignmentOutlined, FolderOpenOutlined } from '@mui/icons-material';
import type { ReactNode } from 'react';
import { classThemeFor } from '../../theme/classThemes';
import ClassArt, { artVariant } from './ClassArt';

/**
 * Class card in Google Classroom's layout: a coloured header with the class name, section
 * and teacher, the teacher's photo overlapping the header, an open body for upcoming work,
 * and small shortcuts along the bottom.
 */
export default function ClassCard({
  classroom, teacherName, teacherAvatar, upcoming, onOpen, onMenu, onOpenWork, onOpenFiles, badge,
}: {
  classroom: any;
  teacherName?: string;
  teacherAvatar?: string;
  upcoming?: { id: string; title: string; due: string }[];
  onOpen: () => void;
  onMenu?: (el: HTMLElement) => void;
  onOpenWork?: () => void;
  onOpenFiles?: () => void;
  badge?: ReactNode;
}) {
  const theme = classThemeFor(classroom.theme);
  return (
    <Box
      sx={{
        borderRadius: '10px', overflow: 'hidden', bgcolor: 'var(--c-surface)', border: '1px solid var(--c-border)',
        display: 'flex', flexDirection: 'column', minHeight: 290, transition: 'box-shadow .2s',
        '&:hover': { boxShadow: '0 2px 10px rgba(0,0,0,.18)' },
      }}
    >
      <Box onClick={onOpen} role="link" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}
        sx={{ position: 'relative', height: 100, bgcolor: theme.flat, color: '#fff', cursor: 'pointer', overflow: 'hidden', px: 2, pt: 1.5 }}>
        <ClassArt variant={artVariant(classroom.id)} />
        <Box sx={{ position: 'relative', pr: 5 }}>
          <Typography noWrap title={classroom.name} sx={{ fontSize: '1.35rem', fontWeight: 500, lineHeight: 1.3, '&:hover': { textDecoration: 'underline' } }}>
            {classroom.name}
          </Typography>
          <Typography noWrap sx={{ fontSize: '0.85rem', fontWeight: 600, opacity: 0.95 }}>{classroom.section || classroom.subject}</Typography>
          {teacherName && <Typography noWrap sx={{ fontSize: '0.75rem', mt: 0.5, opacity: 0.95, textTransform: 'uppercase' }}>{teacherName}</Typography>}
        </Box>
        {onMenu && (
          <IconButton size="small" aria-label="Class options" onClick={(e) => { e.stopPropagation(); onMenu(e.currentTarget); }}
            sx={{ position: 'absolute', top: 6, right: 4, color: '#fff' }}>
            <MoreVert fontSize="small" />
          </IconButton>
        )}
      </Box>
      <Box sx={{ position: 'relative', flex: 1, px: 2, pt: 3.5, pb: 1 }}>
        <Avatar src={teacherAvatar} sx={{ position: 'absolute', top: -38, right: 16, width: 76, height: 76, fontSize: '2rem', bgcolor: '#5c6bc0', border: '3px solid var(--c-surface)' }}>
          {teacherName?.charAt(0)?.toUpperCase()}
        </Avatar>
        {badge}
        {(upcoming || []).slice(0, 3).map((u) => (
          <Box key={u.id} sx={{ mb: 1 }}>
            <Typography variant="caption" sx={{ color: 'var(--c-ink-tertiary)', display: 'block' }}>{u.due}</Typography>
            <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>{u.title}</Typography>
          </Box>
        ))}
      </Box>
      <Box sx={{ borderTop: '1px solid var(--c-border)', display: 'flex', justifyContent: 'flex-end', gap: 0.5, px: 1, py: 0.5 }}>
        {onOpenWork && (
          <Tooltip title="Classwork"><IconButton size="small" onClick={onOpenWork} aria-label="Open classwork"><AssignmentOutlined fontSize="small" /></IconButton></Tooltip>
        )}
        {onOpenFiles && (
          <Tooltip title="Course materials"><IconButton size="small" onClick={onOpenFiles} aria-label="Open course materials"><FolderOpenOutlined fontSize="small" /></IconButton></Tooltip>
        )}
      </Box>
    </Box>
  );
}
