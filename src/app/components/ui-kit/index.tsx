import { ReactNode } from 'react';
import {
  Box, Paper, Typography, Chip, Button, Avatar, AvatarGroup, Stack, IconButton,
  TextField, InputAdornment, Menu, MenuItem, Tooltip,
} from '@mui/material';
import { Search, ExpandMore, Check } from '@mui/icons-material';
import { useState } from 'react';
import { palette, radius, shadow, font, tintFor, layout } from '../../theme/tokens';

/**
 * Shared presentational primitives.
 *
 * These exist so pages stop re-inventing the same card/heading/filter with slightly
 * different padding and colour each time — which is the root cause of the misalignment
 * across the app. Compose these instead of writing bespoke `sx` blocks.
 */

// ── Page scaffolding ────────────────────────────────────────────────────────

export function PageContainer({ children, maxWidth = layout.contentMaxWidth }: { children: ReactNode; maxWidth?: number }) {
  return (
    <Box
      sx={{
        // A single gutter, applied once, at one level. Nested Containers each adding their
        // own gutter is what used to eat 32px of a 390px viewport.
        px: { xs: 2, sm: 3, lg: 4 },
        py: { xs: 2.5, sm: 3 },
        mx: 'auto',
        width: '100%',
        maxWidth,
        boxSizing: 'border-box',
      }}
    >
      {children}
    </Box>
  );
}

export function PageHeader({
  title, subtitle, actions, breadcrumb,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
}) {
  return (
    <Box sx={{ mb: 3 }}>
      {breadcrumb && <Box sx={{ mb: 1.5 }}>{breadcrumb}</Box>}
      <Box
        sx={{
          display: 'flex',
          alignItems: { xs: 'stretch', sm: 'center' },
          justifyContent: 'space-between',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h2" sx={{ color: palette.ink, wordBreak: 'break-word', letterSpacing: '-0.025em' }}>
            {/* Landing-page flourish: the last word of a multi-word title in serif italic. */}
            {(() => {
              const cut = title.lastIndexOf(' ');
              if (cut <= 0) return title;
              return (
                <>
                  {title.slice(0, cut)}{' '}
                  <span className="ea-accent" style={{ fontSize: '1.1em', color: palette.primary }}>{title.slice(cut + 1)}</span>
                </>
              );
            })()}
          </Typography>
          {subtitle && (
            <Typography variant="body2" sx={{ color: palette.inkSecondary, mt: 0.5 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {actions && (
          <Stack direction="row" spacing={1} sx={{ flexShrink: 0, flexWrap: 'wrap', gap: 1 }}>
            {actions}
          </Stack>
        )}
      </Box>
    </Box>
  );
}

/** "Folders  (3)" — a section title with the reference's count pill. */
export function SectionHeading({
  title, count, action, sx,
}: {
  title: string;
  count?: number;
  action?: ReactNode;
  sx?: any;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.75, ...sx }}>
      <Typography variant="h4" sx={{ color: palette.ink }}>{title}</Typography>
      {count !== undefined && (
        <Box
          sx={{
            minWidth: 24, height: 22, px: 0.75, borderRadius: '999px',
            bgcolor: palette.surfaceSunken, color: palette.inkSecondary,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.75rem', fontWeight: 700,
          }}
        >
          {count}
        </Box>
      )}
      <Box sx={{ flex: 1 }} />
      {action}
    </Box>
  );
}

// ── Search & filters ────────────────────────────────────────────────────────

export function SearchField({
  value, onChange, placeholder = 'Search…', shortcut, sx,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  shortcut?: string;
  sx?: any;
}) {
  return (
    <TextField
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      sx={{
        maxWidth: 420,
        '& .MuiOutlinedInput-root': { bgcolor: palette.surfaceMuted },
        ...sx,
      }}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <Search sx={{ fontSize: 18, color: palette.inkTertiary }} />
          </InputAdornment>
        ),
        endAdornment: shortcut ? (
          <InputAdornment position="end">
            <Box
              sx={{
                px: 0.75, py: 0.25, borderRadius: '8px', border: `1px solid ${palette.border}`,
                bgcolor: palette.surface, fontSize: '0.68rem', fontWeight: 700,
                color: palette.inkTertiary, fontFamily: font.mono,
              }}
            >
              {shortcut}
            </Box>
          </InputAdornment>
        ) : undefined,
      }}
    />
  );
}

/** "Status: All ▾" pill from the reference. */
export function FilterPill<T extends string>({
  label, value, options, onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const current = options.find((o) => o.value === value);
  return (
    <>
      <Button
        onClick={(e) => setAnchor(e.currentTarget)}
        endIcon={<ExpandMore sx={{ fontSize: 16 }} />}
        sx={{
          minHeight: layout.controlHeightSmall,
          px: 1.5,
          borderRadius: '999px',
          border: `1px solid ${palette.border}`,
          bgcolor: palette.surface,
          color: palette.inkSecondary,
          fontWeight: 600,
          fontSize: '0.8rem',
          whiteSpace: 'nowrap',
          '&:hover': { bgcolor: palette.surfaceMuted, borderColor: palette.borderStrong },
        }}
      >
        {label}:&nbsp;<Box component="span" sx={{ color: palette.ink, fontWeight: 700 }}>{current?.label ?? value}</Box>
      </Button>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {options.map((o) => (
          <MenuItem
            key={o.value}
            selected={o.value === value}
            onClick={() => { onChange(o.value); setAnchor(null); }}
            sx={{ display: 'flex', gap: 1, minWidth: 160 }}
          >
            <Check sx={{ fontSize: 16, opacity: o.value === value ? 1 : 0, color: palette.primary }} />
            {o.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

/** Horizontally scrollable filter row that never widens the page. */
export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        display: 'flex', gap: 1, alignItems: 'center', mb: 2.5,
        overflowX: 'auto', pb: 0.5,
        '&::-webkit-scrollbar': { height: 0 },
        scrollbarWidth: 'none',
      }}
    >
      {children}
    </Box>
  );
}

// ── Cards ───────────────────────────────────────────────────────────────────

/** Responsive auto-fill card grid. One rule, used by every card section. */
export function CardGrid({ children, min = 268 }: { children: ReactNode; min?: number }) {
  return (
    <Box
      sx={{
        display: 'grid',
        // auto-fill + minmax(0, …) is what keeps cards equal-width and prevents a long
        // title from blowing out its column.
        gridTemplateColumns: {
          xs: '1fr',
          sm: `repeat(auto-fill, minmax(${min}px, 1fr))`,
        },
        gap: 2,
        alignItems: 'stretch',
      }}
    >
      {children}
    </Box>
  );
}

/** The tinted, folder-tab card from the reference. */
export function FolderCard({
  id, title, meta, members, onClick, action,
}: {
  id: string;
  title: string;
  meta?: string;
  members?: { name?: string; avatar?: string }[];
  onClick?: () => void;
  action?: ReactNode;
}) {
  const tint = tintFor(id);
  return (
    <Box sx={{ position: 'relative', pt: 1.25 }}>
      {/* The folder tab */}
      <Box
        sx={{
          position: 'absolute', top: 0, left: 14, width: 78, height: 14,
          borderTopLeftRadius: '10px', borderTopRightRadius: '10px',
          background: tint.from,
        }}
      />
      <Paper
        onClick={onClick}
        sx={{
          position: 'relative',
          p: 2, borderRadius: '14px',
          background: `linear-gradient(160deg, ${tint.from} 0%, ${tint.to} 100%)`,
          border: `1px solid ${palette.border}`,
          cursor: onClick ? 'pointer' : 'default',
          transition: 'transform .15s ease, box-shadow .15s ease',
          minHeight: 132,
          display: 'flex', flexDirection: 'column',
          '&:hover': onClick ? { transform: 'translateY(-2px)', boxShadow: shadow.md } : undefined,
        }}
      >
        {action && <Box sx={{ position: 'absolute', top: 8, right: 8 }}>{action}</Box>}
        <Box sx={{ flex: 1 }} />
        <Typography
          sx={{
            fontFamily: font.mono, fontSize: '0.95rem', fontWeight: 600,
            color: tint.ink, mb: 1.25, pb: 1.25,
            borderBottom: `1px solid ${palette.ink}12`,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
          title={title}
        >
          {title}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <MemberStack members={members} />
          {meta && (
            <Typography variant="caption" sx={{ color: palette.inkSecondary, fontWeight: 600, whiteSpace: 'nowrap' }}>
              {meta}
            </Typography>
          )}
        </Box>
      </Paper>
    </Box>
  );
}

/** Card with a tinted banner, a meta line and a mono title — the reference's workflow card. */
export function EntityCard({
  id, title, metaLeft, metaRight, members, footerRight, onClick, action, bannerHeight = 92, bannerBackground,
}: {
  id: string;
  /** A full CSS background for the banner (e.g. a class theme); defaults to the id tint. */
  bannerBackground?: string;
  title: string;
  metaLeft?: string;
  metaRight?: ReactNode;
  members?: { name?: string; avatar?: string }[];
  footerRight?: ReactNode;
  onClick?: () => void;
  action?: ReactNode;
  bannerHeight?: number;
}) {
  const tint = tintFor(id);
  return (
    <Paper
      onClick={onClick}
      sx={{
        borderRadius: '14px',
        border: `1px solid ${palette.border}`,
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform .15s ease, box-shadow .15s ease',
        display: 'flex', flexDirection: 'column', height: '100%',
        '&:hover': onClick ? { transform: 'translateY(-2px)', boxShadow: shadow.md } : undefined,
      }}
    >
      <Box
        sx={{
          height: bannerHeight, position: 'relative',
          background: bannerBackground || `linear-gradient(135deg, ${tint.from} 0%, ${tint.to} 100%)`,
        }}
      >
        {action && <Box sx={{ position: 'absolute', top: 8, right: 8 }}>{action}</Box>}
      </Box>
      <Box sx={{ p: 2, flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75, flexWrap: 'wrap' }}>
          {metaLeft && (
            <Typography variant="caption" sx={{ color: palette.inkTertiary, fontWeight: 600 }}>
              {metaLeft}
            </Typography>
          )}
          {metaLeft && metaRight && (
            <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: palette.inkDisabled }} />
          )}
          {metaRight}
        </Box>
        <Typography
          sx={{
            fontFamily: font.mono, fontSize: '0.95rem', fontWeight: 600, color: palette.ink,
            mb: 1.5, pb: 1.5, borderBottom: `1px solid ${palette.border}`,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
          title={title}
        >
          {title}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <MemberStack members={members} />
          {footerRight}
        </Box>
      </Box>
    </Paper>
  );
}

export function MemberStack({ members, max = 3 }: { members?: { name?: string; avatar?: string }[]; max?: number }) {
  if (!members || members.length === 0) return <Box />;
  return (
    <AvatarGroup
      max={max}
      sx={{
        '& .MuiAvatar-root': {
          width: 26, height: 26, fontSize: '0.68rem',
          border: `2px solid ${palette.surface}`,
        },
      }}
    >
      {members.map((m, i) => (
        <Tooltip key={i} title={m.name || ''}>
          <Avatar src={m.avatar} alt={m.name}>{(m.name || '?').charAt(0).toUpperCase()}</Avatar>
        </Tooltip>
      ))}
    </AvatarGroup>
  );
}

/** Small labelled status dot + text, e.g. "Active". */
export function StatusPill({ label, tone = 'neutral' }: { label: string; tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }) {
  const map = {
    success: { fg: palette.success, bg: palette.successSoft },
    warning: { fg: palette.warning, bg: palette.warningSoft },
    danger: { fg: palette.danger, bg: palette.dangerSoft },
    info: { fg: palette.info, bg: palette.infoSoft },
    neutral: { fg: palette.inkSecondary, bg: palette.surfaceSunken },
  }[tone];
  return (
    <Chip
      label={label}
      size="small"
      sx={{ bgcolor: map.bg, color: map.fg, fontWeight: 700, height: 20, fontSize: '0.68rem' }}
    />
  );
}

export function StatTile({
  label, value, hint, tone = 'neutral', icon,
}: {
  label: string; value: string; hint?: string;
  tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  icon?: ReactNode;
}) {
  const fg = {
    success: palette.success, warning: palette.warning, danger: palette.danger,
    info: palette.info, neutral: palette.ink,
  }[tone];
  return (
    <Paper sx={{ p: 2, borderRadius: '14px', border: `1px solid ${palette.border}`, flex: '1 1 160px', minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
        {icon}
        <Typography variant="caption" sx={{ color: palette.inkSecondary, fontWeight: 700 }}>{label}</Typography>
      </Box>
      <Typography sx={{ fontSize: '1.45rem', fontWeight: 800, color: fg, lineHeight: 1.15 }}>{value}</Typography>
      {hint && <Typography variant="caption" sx={{ color: palette.inkTertiary, display: 'block', mt: 0.25 }}>{hint}</Typography>}
    </Paper>
  );
}

export function EmptyState({
  icon, title, description, action,
}: {
  icon?: ReactNode; title: string; description?: string; action?: ReactNode;
}) {
  return (
    <Paper
      sx={{
        p: { xs: 3, sm: 6 }, textAlign: 'center', borderRadius: '14px',
        border: `1px dashed ${palette.borderStrong}`, bgcolor: palette.surfaceMuted,
      }}
    >
      {icon && <Box sx={{ color: palette.inkDisabled, mb: 1.5, '& svg': { fontSize: 44 } }}>{icon}</Box>}
      <Typography variant="h5" sx={{ color: palette.ink, mb: 0.5 }}>{title}</Typography>
      {description && (
        <Typography variant="body2" sx={{ color: palette.inkSecondary, maxWidth: 420, mx: 'auto', mb: action ? 2.5 : 0 }}>
          {description}
        </Typography>
      )}
      {action}
    </Paper>
  );
}

/** A labelled form row that keeps label + control alignment identical everywhere. */
export function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: ReactNode }) {
  return (
    <Box sx={{ mb: 2, minWidth: 0 }}>
      <Typography
        component="label"
        sx={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: palette.inkSecondary, mb: 0.75 }}
      >
        {label}
        {required && <Box component="span" sx={{ color: palette.danger, ml: 0.25 }}>*</Box>}
      </Typography>
      {children}
      {hint && <Typography variant="caption" sx={{ color: palette.inkTertiary, mt: 0.5, display: 'block' }}>{hint}</Typography>}
    </Box>
  );
}

/** Two-up form row that stacks below `sm`. Use instead of bespoke grid templates. */
export function FieldRow({ children, columns = 2 }: { children: ReactNode; columns?: number }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: `repeat(${columns}, minmax(0, 1fr))` },
        gap: 2,
        alignItems: 'start',
      }}
    >
      {children}
    </Box>
  );
}

export { palette, radius, shadow, font, tintFor, layout };
