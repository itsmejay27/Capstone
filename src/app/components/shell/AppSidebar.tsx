import { ReactNode, useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import {
  Box, Typography, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Divider, IconButton, Collapse, Avatar, Tooltip, Badge,
} from '@mui/material';
import {
  Home, School, AutoAwesome, LibraryBooks, Quiz, MenuBook, Notifications,
  ExpandLess, ExpandMore, Star, StarBorder, ChevronLeft, ChevronRight, Inventory2,
  Settings as SettingsIcon,
  WorkspacePremium,
} from '@mui/icons-material';
import { palette, radius, layout, font } from '../../theme/tokens';
import { visibleTabSlugs, CLASSROOM_TAB_LABELS } from '../../constants/classroomTabs';

export interface SidebarNavItem {
  label: string;
  icon: ReactNode;
  path: string;
  badge?: number;
}

/**
 * The persistent left navigation rail.
 *
 * Renders identically inside the fixed desktop rail and inside the mobile Drawer, so the
 * two can never drift apart — `AppShell` decides which container it lives in.
 */
export default function AppSidebar({
  collapsed = false,
  onToggleCollapse,
  onNavigate,
  classrooms,
  isInstructor,
  favourites,
  onToggleFavourite,
  notificationCount = 0,
}: {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
  classrooms: any[];
  isInstructor: boolean;
  favourites: string[];
  onToggleFavourite: (id: string) => void;
  notificationCount?: number;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [expandedClass, setExpandedClass] = useState<string | null>(null);

  const go = (path: string) => {
    navigate(path);
    onNavigate?.();
  };

  const primaryNav: SidebarNavItem[] = [
    { label: 'Home', icon: <Home fontSize="small" />, path: '/dashboard' },
    ...(isInstructor
      ? [
          { label: 'Exam Generator', icon: <AutoAwesome fontSize="small" />, path: '/exam-generator' },
          { label: 'Exam Repository', icon: <LibraryBooks fontSize="small" />, path: '/exam-repository' },
          { label: 'Question Bank', icon: <Inventory2 fontSize="small" />, path: '/question-bank' },
        ]
      : [
          { label: 'Reviewer Generator', icon: <AutoAwesome fontSize="small" />, path: '/reviewer-generator' },
          { label: 'My Reviewers', icon: <MenuBook fontSize="small" />, path: '/reviewer' },
        ]),
  ];

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  const favouriteClassrooms = classrooms.filter((c) => favourites.includes(c.id));

  const navButton = (item: SidebarNavItem) => (
    <ListItem disablePadding key={item.path} sx={{ mb: 0.25 }}>
      <Tooltip title={collapsed ? item.label : ''} placement="right">
        <ListItemButton
          onClick={() => go(item.path)}
          selected={isActive(item.path)}
          sx={{
            py: 0.85,
            px: collapsed ? 1.25 : 1.5,
            justifyContent: collapsed ? 'center' : 'flex-start',
            color: isActive(item.path) ? palette.ink : palette.inkSecondary,
          }}
        >
          <ListItemIcon sx={{ minWidth: collapsed ? 0 : 32, color: 'inherit' }}>
            {item.badge ? (
              <Badge badgeContent={item.badge} color="error" sx={{ '& .MuiBadge-badge': { fontSize: '0.62rem', height: 16, minWidth: 16 } }}>
                {item.icon}
              </Badge>
            ) : item.icon}
          </ListItemIcon>
          {!collapsed && (
            <ListItemText
              primary={item.label}
              primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: isActive(item.path) ? 700 : 600, noWrap: true }}
            />
          )}
        </ListItemButton>
      </Tooltip>
    </ListItem>
  );

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: palette.surface }}>
      {/* Brand */}
      <Box
        sx={{
          display: 'flex', alignItems: 'center', gap: 1.25,
          px: collapsed ? 1.5 : 2, py: 2, minHeight: layout.topBarHeight,
          justifyContent: collapsed ? 'center' : 'space-between',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0, cursor: 'pointer' }} onClick={() => go('/dashboard')}>
          <Box
            sx={{
              width: 28, height: 28, borderRadius: '8px', flexShrink: 0,
              background: 'linear-gradient(135deg, var(--c-emerald-500), var(--c-teal-600))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontFamily: "'Instrument Serif', Georgia, serif", fontStyle: 'italic',
              fontSize: '1.1rem', boxShadow: '0 6px 18px -6px var(--glow-a)',
            }}
          >
            A
          </Box>
          {!collapsed && (
            <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: palette.ink, letterSpacing: '-0.02em' }} noWrap>
              Aspire e Learning
            </Typography>
          )}
        </Box>
        {!collapsed && onToggleCollapse && (
          <IconButton size="small" onClick={onToggleCollapse} aria-label="Collapse sidebar" sx={{ color: palette.inkTertiary }}>
            <ChevronLeft fontSize="small" />
          </IconButton>
        )}
      </Box>

      {collapsed && onToggleCollapse && (
        <IconButton size="small" onClick={onToggleCollapse} aria-label="Expand sidebar" sx={{ mx: 'auto', mb: 1, color: palette.inkTertiary }}>
          <ChevronRight fontSize="small" />
        </IconButton>
      )}

      {/* Primary nav */}
      <List sx={{ px: 1, py: 0 }}>{primaryNav.map(navButton)}</List>

      <Divider sx={{ my: 1.5, mx: 2 }} />

      <List sx={{ px: 1, py: 0 }}>
        {navButton({ label: 'Notifications', icon: <Notifications fontSize="small" />, path: '/notifications', badge: notificationCount })}
        {isInstructor && navButton({ label: 'Plans & billing', icon: <WorkspacePremium fontSize="small" />, path: '/billing' })}
        {navButton({ label: 'Settings', icon: <SettingsIcon fontSize="small" />, path: '/settings' })}
      </List>

      {/* Favourites */}
      {favouriteClassrooms.length > 0 && !collapsed && (
        <>
          <Divider sx={{ my: 1.5, mx: 2 }} />
          <Typography
            variant="caption"
            sx={{ px: 2.25, color: palette.inkTertiary, fontWeight: 700, display: 'block', mb: 0.75 }}
          >
            Favourites
          </Typography>
          <List sx={{ px: 1, py: 0 }}>
            {favouriteClassrooms.map((cls) => (
              <ListItem disablePadding key={cls.id} sx={{ mb: 0.25 }}>
                <ListItemButton onClick={() => go(`/classroom/${cls.id}`)} sx={{ py: 0.7, px: 1.5 }}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <Avatar sx={{ width: 22, height: 22, bgcolor: palette.primarySoft, color: palette.primary, fontSize: '0.65rem' }}>
                      {cls.name?.charAt(0).toUpperCase()}
                    </Avatar>
                  </ListItemIcon>
                  <ListItemText primary={cls.name} primaryTypographyProps={{ fontSize: '0.8rem', fontWeight: 600, noWrap: true }} />
                  <Star sx={{ fontSize: 15, color: 'var(--c-amber-500)', flexShrink: 0 }} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </>
      )}

      {/* All classes, each expanding to its tabs so the rail can deep-link to
          Stream / Classwork / Materials / People / Gradebook. */}
      {!collapsed && classrooms.length > 0 && (
        <>
          <Divider sx={{ my: 1.5, mx: 2 }} />
          <Typography variant="caption" sx={{ px: 2.25, color: palette.inkTertiary, fontWeight: 700, display: 'block', mb: 0.75 }}>
            My Classes
          </Typography>
          <Box sx={{ flex: 1, overflowY: 'auto', px: 1, pb: 2 }}>
            <List sx={{ py: 0 }}>
              {classrooms.map((cls) => {
                const open = expandedClass === cls.id;
                const fav = favourites.includes(cls.id);
                return (
                  <Box key={cls.id} sx={{ mb: 0.25 }}>
                    <ListItem disablePadding sx={{ pr: 0.5 }}>
                      <ListItemButton
                        onClick={() => go(`/classroom/${cls.id}`)}
                        selected={location.pathname === `/classroom/${cls.id}`}
                        sx={{ py: 0.7, px: 1.5, minWidth: 0 }}
                      >
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          <School sx={{ fontSize: 17 }} />
                        </ListItemIcon>
                        <ListItemText
                          primary={cls.name}
                          secondary={cls.section}
                          primaryTypographyProps={{ fontSize: '0.8rem', fontWeight: 600, noWrap: true }}
                          secondaryTypographyProps={{ fontSize: '0.68rem', noWrap: true }}
                        />
                      </ListItemButton>
                      <IconButton
                        size="small"
                        onClick={(e) => { e.stopPropagation(); onToggleFavourite(cls.id); }}
                        aria-label={fav ? `Unfavourite ${cls.name}` : `Favourite ${cls.name}`}
                        sx={{ color: fav ? 'var(--c-amber-500)' : palette.inkDisabled }}
                      >
                        {fav ? <Star sx={{ fontSize: 15 }} /> : <StarBorder sx={{ fontSize: 15 }} />}
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={(e) => { e.stopPropagation(); setExpandedClass(open ? null : cls.id); }}
                        aria-label={open ? `Collapse ${cls.name}` : `Expand ${cls.name}`}
                        sx={{ color: palette.inkTertiary }}
                      >
                        {open ? <ExpandLess sx={{ fontSize: 16 }} /> : <ExpandMore sx={{ fontSize: 16 }} />}
                      </IconButton>
                    </ListItem>
                    <Collapse in={open} unmountOnExit>
                      <List disablePadding sx={{ pl: 3.5 }}>
                        {visibleTabSlugs(isInstructor).map((slug) => (
                          <ListItem disablePadding key={slug}>
                            <ListItemButton onClick={() => go(`/classroom/${cls.id}?tab=${slug}`)} sx={{ py: 0.35, px: 1.25 }}>
                              <ListItemText
                                primary={CLASSROOM_TAB_LABELS[slug]}
                                primaryTypographyProps={{ fontSize: '0.74rem', fontWeight: 600, noWrap: true, color: palette.inkSecondary }}
                              />
                            </ListItemButton>
                          </ListItem>
                        ))}
                      </List>
                    </Collapse>
                  </Box>
                );
              })}
            </List>
          </Box>
        </>
      )}

      <Box sx={{ flex: 1 }} />
    </Box>
  );
}
