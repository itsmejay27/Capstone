import { Box, Typography, IconButton } from '@mui/material';
import { InsertDriveFile, PictureAsPdf, Description, Close, Link as LinkIcon } from '@mui/icons-material';
import type { AnnouncementAttachment } from '../../types';

function fileKind(att: AnnouncementAttachment) {
  const n = (att.name || '').toLowerCase();
  const t = (att.mimeType || '').toLowerCase();
  if (t === 'text/uri-list') return /youtu\.?be/i.test(att.fileUrl || '') ? { label: 'YouTube', Icon: InsertDriveFile, color: '#ff0000' } : { label: 'Link', Icon: LinkIcon, color: '#1a73e8' };
  if (t.includes('pdf') || n.endsWith('.pdf')) return { label: 'PDF', Icon: PictureAsPdf, color: '#d93025' };
  if (n.endsWith('.doc') || n.endsWith('.docx') || t.includes('word')) return { label: 'Microsoft Word', Icon: Description, color: '#1a73e8' };
  if (n.endsWith('.ppt') || n.endsWith('.pptx') || t.includes('presentation')) return { label: 'PowerPoint', Icon: Description, color: '#d24726' };
  if (n.endsWith('.xls') || n.endsWith('.xlsx') || t.includes('sheet')) return { label: 'Excel', Icon: Description, color: '#188038' };
  if (t.startsWith('image/')) return { label: 'Image', Icon: InsertDriveFile, color: '#8e24aa' };
  return { label: (n.split('.').pop() || 'File').toUpperCase(), Icon: InsertDriveFile, color: '#5f6368' };
}

/** File card with a preview strip, like Classroom's attachment tiles. */
export default function FileCard({ att, onRemove }: { att: AnnouncementAttachment; onRemove?: () => void }) {
  const k = fileKind(att);
  const isImage = (att.mimeType || '').startsWith('image/');
  return (
    <Box sx={{ display: 'flex', border: '1px solid var(--c-border)', borderRadius: '8px', overflow: 'hidden', height: 72, bgcolor: 'var(--c-surface)', minWidth: 0 }}>
      <Box component="a" href={att.fileUrl} target="_blank" rel="noopener noreferrer"
        sx={{ flex: 1, minWidth: 0, px: 2, display: 'flex', flexDirection: 'column', justifyContent: 'center', color: 'inherit', textDecoration: 'none', '&:hover .n': { textDecoration: 'underline' } }}>
        <Typography className="n" noWrap sx={{ fontWeight: 500, fontSize: '0.9rem', textDecoration: 'underline' }} title={att.name}>{att.name}</Typography>
        <Typography variant="caption" sx={{ color: 'var(--c-ink-secondary)' }}>{k.label}</Typography>
      </Box>
      <Box sx={{ width: 90, flexShrink: 0, borderLeft: '1px solid var(--c-border)', position: 'relative', display: 'grid', placeItems: 'center',
        background: isImage && att.fileUrl ? `center/cover no-repeat url("${att.fileUrl}")` : `linear-gradient(135deg, ${k.color}22, ${k.color}08)` }}>
        {!isImage && <k.Icon sx={{ color: k.color, fontSize: 30 }} />}
        {onRemove && (
          <IconButton size="small" onClick={onRemove} aria-label={`Remove ${att.name}`} sx={{ position: 'absolute', top: 2, right: 2, bgcolor: 'var(--c-surface)' }}>
            <Close sx={{ fontSize: 14 }} />
          </IconButton>
        )}
      </Box>
    </Box>
  );
}

