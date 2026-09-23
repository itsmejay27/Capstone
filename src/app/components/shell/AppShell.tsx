import { ReactNode, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router';
import '../../theme/app-motion.css';
import {
  Box, Drawer, IconButton, Avatar, Menu, MenuItem, Typography, Divider, Chip, Tooltip,
} from '@mui/material';
import {
  Menu as MenuIcon, AccountCircle, ExitToApp,
  LightMode, DarkMode, Settings as SettingsIcon, PersonAdd, Close as CloseIcon, SwapHoriz,
} from '@mui/icons-material';
import AppSidebar from './AppSidebar';
import GlobalSearch from './GlobalSearch';
import { palette, layout, radius } from '../../theme/tokens';
import { useIsMobile } from '../../hooks/useResponsive';
import { useThemeMode } from '../../context/ThemeModeContext';
import { useAuth } from '../../context/AuthContext';
import { useSavedAccountIds } from '../../services/savedAccounts';

const FAVOURITES_KEY = 'classroomFavourites';
const COLLAPSED_KEY = 'sidebarCollapsed';

function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Application shell: persistent left rail on desktop, temporary drawer on mobile, plus a
 * slim top bar carrying search and the account menu.
 *
 * Replaces the previous full-width AppBar. The rail is `position: fixed` and the content
 * column is offset by its width, so page scroll never moves the navigation.
 */
export default function AppShell({
  children,
  currentUser,
  users,
  classrooms,
  isInstructor,
  onLogout,
  onSwitchAccount,
  searchValue,
  onSearchChange,
  notificationCount = 0,
}: {
  children: ReactNode;
  currentUser: any;
  users: any[];
  classrooms: any[];
  isInstructor: boolean;
  onLogout: () => void;
  onSwitchAccount: (id: string) => void;
  searchValue?: string;
  onSearchChange?: (v: string) => void;
  notificationCount?: number;
}) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();
  const { mode, toggle } = useThemeMode();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => readStored(COLLAPSED_KEY, false));
  const [favourites, setFavourites] = useState<string[]>(() => readStored<string[]>(FAVOURITES_KEY, []));
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const { leaveForAnotherAccount, removeSavedAccount } = useAuth();
  const savedIds = useSavedAccountIds();
  // Other accounts already signed in on this device, ready to switch to without a code.
  const otherAccounts = savedIds
    .filter((id) => id !== currentUser?.id)
    .map((id) => users.find((u: any) => u.id === id))
    .filter(Boolean);


  useEffect(() => {
    try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify(collapsed)); } catch { /* quota */ }
  }, [collapsed]);

  useEffect(() => {
    try { localStorage.setItem(FAVOURITES_KEY, JSON.stringify(favourites)); } catch { /* quota */ }
  }, [favourites]);

  const toggleFavourite = (id: string) =>
    setFavourites((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));

  const railWidth = collapsed ? layout.sidebarCollapsedWidth : layout.sidebarWidth;

  const sidebar = (
    <AppSidebar
      collapsed={!isMobile && collapsed}
      onToggleCollapse={isMobile ? undefined : () => setCollapsed((v) => !v)}
      onNavigate={() => setDrawerOpen(false)}
      classrooms={classrooms}
      isInstructor={isInstructor}
      favourites={favourites}
      onToggleFavourite={toggleFavourite}
      notificationCount={notificationCount}
    />
  );

  return (
    <Box className="ea-app" sx={{ minHeight: '100vh', bgcolor: palette.canvas }}>
      {/* Desktop rail */}
      {!isMobile && (
        <Box
          component="nav"
          sx={{
            position: 'fixed', top: 0, left: 0, bottom: 0, width: railWidth,
            borderRight: `1px solid ${palette.border}`, bgcolor: palette.surface,
            transition: 'width .18s ease', zIndex: 1200, overflow: 'hidden',
          }}
        >
          {sidebar}
        </Box>
      )}

      {/* Mobile drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{ sx: { width: layout.sidebarWidth, border: 'none' } }}
      >
        {sidebar}
      </Drawer>

      {/* Content column, offset by the rail */}
      <Box
        sx={{
          ml: isMobile ? 0 : `${railWidth}px`,
          transition: 'margin-left .18s ease',
          minWidth: 0,
        }}
      >
        <Box
          component="header"
          sx={{
            position: 'sticky', top: 0, zIndex: 1100,
            minHeight: layout.topBarHeight,
            display: 'flex', alignItems: 'center', gap: 1.5,
            px: { xs: 2, sm: 3 },
            bgcolor: `${palette.surface}f2`,
            backdropFilter: 'blur(8px)',
            borderBottom: `1px solid ${palette.border}`,
          }}
        >
          {isMobile && (
            <IconButton onClick={() => setDrawerOpen(true)} aria-label="Open navigation" sx={{ color: palette.ink }}>
              <MenuIcon />
            </IconButton>
          )}

          <GlobalSearch />

          <Box sx={{ flex: 1 }} />

          <Tooltip title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            <IconButton
              onClick={toggle}
              size="small"
              aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              sx={{
                color: palette.inkSecondary,
                transition: 'color .2s ease, transform .35s cubic-bezier(.4,0,.2,1)',
                '&:hover': { color: palette.primary, transform: 'rotate(18deg)' },
                '& .mode-icon': {
                  display: 'block',
                  transition: 'transform .35s cubic-bezier(.4,0,.2,1), opacity .25s ease',
                },
              }}
            >
              {mode === 'dark'
                ? <LightMode className="mode-icon" fontSize="small" />
                : <DarkMode className="mode-icon" fontSize="small" />}
            </IconButton>
          </Tooltip>

          {currentUser && (
            <>
              <Chip
                label={currentUser.role?.toUpperCase()}
                size="small"
                sx={{
                  display: { xs: 'none', sm: 'flex' },
                  bgcolor: isInstructor ? palette.instructorSoft : palette.studentSoft,
                  color: isInstructor ? palette.instructor : palette.student,
                  fontWeight: 700,
                }}
              />
              <Typography variant="body2" sx={{ display: { xs: 'none', md: 'block' }, color: palette.inkSecondary, fontWeight: 600 }}>
                {currentUser.name}
              </Typography>
              <Tooltip title="Account">
                <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} size="small" aria-label="Account menu">
                  <Avatar src={currentUser.avatar} sx={{ width: 30, height: 30, bgcolor: palette.primarySoft, color: palette.primary }}>
                    {currentUser.name?.charAt(0).toUpperCase()}
                  </Avatar>
                </IconButton>
              </Tooltip>
              <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
                <Box sx={{ px: 1.5, py: 1, minWidth: 210 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }} noWrap>{currentUser.name}</Typography>
                  <Typography variant="caption" sx={{ color: palette.inkTertiary }} noWrap>{currentUser.email}</Typography>
                </Box>
                <Divider sx={{ my: 0.5 }} />
                <Typography variant="caption" sx={{ px: 1.5, color: palette.inkTertiary, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <SwapHoriz sx={{ fontSize: 14 }} /> Switch account
                </Typography>
                {otherAccounts.map((u: any) => (
                  <MenuItem key={u.id} onClick={() => { onSwitchAccount(u.id); setAnchorEl(null); }} sx={{ pr: 0.5 }}>
                    <Avatar src={u.avatar} sx={{ width: 26, height: 26, mr: 1, fontSize: '0.75rem', bgcolor: palette.primarySoft, color: palette.primary }}>
                      {u.name?.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography sx={{ fontSize: '0.8rem', fontWeight: 600 }} noWrap>{u.name}</Typography>
                      <Typography variant="caption" sx={{ color: palette.inkTertiary, display: 'block', maxWidth: 170 }} noWrap>
                        {u.role === 'student' ? 'Student' : 'Instructor'} · {u.email}
                      </Typography>
                    </Box>
                    <Tooltip title="Remove from this device">
                      <IconButton
                        size="small"
                        aria-label={`Remove ${u.email} from this device`}
                        onClick={(e) => { e.stopPropagation(); removeSavedAccount(u.id); }}
                        sx={{ ml: 0.5, color: palette.inkTertiary }}
                      >
                        <CloseIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </MenuItem>
                ))}
                <MenuItem onClick={() => { setAnchorEl(null); leaveForAnotherAccount(); navigate('/?signin=1'); }}>
                  <PersonAdd fontSize="small" sx={{ mr: 1, color: palette.inkTertiary }} />
                  <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>Add another account</Typography>
                </MenuItem>
                <Divider sx={{ my: 0.5 }} />
                <MenuItem onClick={() => { navigate('/settings'); setAnchorEl(null); }}>
                  <SettingsIcon fontSize="small" sx={{ mr: 1, color: palette.inkTertiary }} />
                  <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>Settings</Typography>
                </MenuItem>
                <Divider sx={{ my: 0.5 }} />
                <MenuItem onClick={() => { onLogout(); setAnchorEl(null); }} sx={{ color: palette.danger }}>
                  <ExitToApp fontSize="small" sx={{ mr: 1 }} /> Sign out
                </MenuItem>
              </Menu>
            </>
          )}
        </Box>

        {/* Keyed on the route so every page plays the landing page's rise-in once. */}
        <Box component="main" sx={{ minWidth: 0, position: 'relative' }}>
          <div key={location.pathname} className="ea-page">{children}</div>
        </Box>
      </Box>
    </Box>
  );
}
