import { Outlet, useNavigate, useLocation } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Avatar,
  IconButton,
  Menu,
  MenuItem,
  Chip,
  createTheme,
  ThemeProvider,
  CssBaseline,
  Drawer,
  List,
  Collapse,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  AccountCircle,
  ExitToApp,
  SwapHoriz,
  Menu as MenuIcon,
  Home,
  Quiz,
  LibraryBooks,
  AutoAwesome,
  School,
  ExpandLess,
  ExpandMore,
} from '@mui/icons-material';
import { useState } from 'react';
import { visibleTabSlugs, CLASSROOM_TAB_LABELS } from '../constants/classroomTabs';

const theme = createTheme({
  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    h3: { fontWeight: 700 },
    h4: { fontWeight: 700 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
  },
  palette: {
    primary: {
      main: '#1565c0',
      dark: '#0d47a1',
      light: '#42a5f5',
    },
    secondary: {
      main: '#7c3aed',
      dark: '#5b21b6',
      light: '#a78bfa',
    },
    background: {
      default: '#f5f7fa',
    },
  },
  shape: {
    borderRadius: 10,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 8,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          transition: 'box-shadow 0.2s ease-in-out, transform 0.2s ease-in-out',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500,
        },
      },
    },
  },
});

export default function RootLayout() {
  const { currentUser, users, logout, switchAccount, isAuthenticated, classrooms } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expandedClassroom, setExpandedClassroom] = useState<string | null>(null);

  const isInstructor = currentUser?.role === 'instructor';
  const userClassrooms = classrooms ? classrooms.filter((classroom: any) =>
    isInstructor
      ? classroom.instructorId === currentUser?.id
      : classroom.students.includes(currentUser?.id || '')
  ) : [];

  useEffect(() => {
    if (!isAuthenticated && location.pathname !== '/') {
      navigate('/');
    } else if (isAuthenticated && location.pathname === '/') {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate, location.pathname]);

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
    handleClose();
  };

  const handleSwitchAccount = (userId: string) => {
    switchAccount(userId);
    navigate('/dashboard');
    handleClose();
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
        {isAuthenticated && (
          <AppBar
            position="sticky"
            elevation={0}
            sx={{
              background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 60%, #1e3a8a 100%)',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            }}
          >
            <Toolbar sx={{ maxWidth: '100%', width: '100%', mx: 'auto', px: { xs: 2, sm: 3, md: 5, lg: 6 } }}>
              <IconButton
                color="inherit"
                aria-label="open drawer"
                edge="start"
                onClick={() => setDrawerOpen(true)}
                sx={{ mr: 2, p: 0.75, display: 'flex' }}
              >
                <MenuIcon />
              </IconButton>
              <Box
                sx={{ display: 'flex', alignItems: 'center', flexGrow: 1, cursor: 'pointer', gap: 1.5 }}
                onClick={() => navigate('/dashboard')}
              >
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: '8px',
                    background: 'rgba(255,255,255,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backdropFilter: 'blur(10px)',
                  }}
                >
                  <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: 'white' }}>
                    O
                  </Typography>
                </Box>
                <Box>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 700,
                      fontSize: { xs: '0.9rem', md: '1.1rem' },
                      letterSpacing: '-0.01em',
                      lineHeight: 1.2,
                    }}
                  >
                    OMSC Exam Generator
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ opacity: 0.7, fontSize: '0.7rem', display: { xs: 'none', sm: 'block' } }}
                  >
                    AI-Powered Examination System
                  </Typography>
                </Box>
              </Box>

              {currentUser && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, md: 2 } }}>
                  <Chip
                    label={currentUser.role.toUpperCase()}
                    size="small"
                    sx={{
                      bgcolor: currentUser.role === 'instructor' ? 'rgba(168, 85, 247, 0.25)' : 'rgba(96, 165, 250, 0.25)',
                      color: 'white',
                      fontWeight: 600,
                      fontSize: '0.7rem',
                      height: 24,
                      border: '1px solid rgba(255,255,255,0.2)',
                      display: { xs: 'none', sm: 'flex' },
                    }}
                  />
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 500,
                      display: { xs: 'none', md: 'block' },
                      opacity: 0.9,
                    }}
                  >
                    {currentUser.name}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={handleMenu}
                    sx={{
                      bgcolor: 'rgba(255,255,255,0.1)',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
                      color: 'white',
                    }}
                  >
                    <AccountCircle />
                  </IconButton>
                  <Menu
                    id="menu-appbar"
                    anchorEl={anchorEl}
                    anchorOrigin={{
                      vertical: 'bottom',
                      horizontal: 'right',
                    }}
                    keepMounted
                    transformOrigin={{
                      vertical: 'top',
                      horizontal: 'right',
                    }}
                    open={Boolean(anchorEl)}
                    onClose={handleClose}
                    slotProps={{
                      paper: {
                        sx: {
                          mt: 1,
                          borderRadius: 2,
                          boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
                          minWidth: 220,
                        },
                      },
                    }}
                  >
                    <MenuItem disabled>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Switch Account
                      </Typography>
                    </MenuItem>
                    {users.map((user) => (
                      <MenuItem
                        key={user.id}
                        onClick={() => handleSwitchAccount(user.id)}
                        selected={user.id === currentUser?.id}
                        sx={{ py: 1, fontSize: '0.875rem' }}
                      >
                        <Avatar
                          src={user.avatar}
                          sx={{
                            width: 28,
                            height: 28,
                            mr: 1.5,
                            fontSize: '0.75rem',
                            bgcolor: user.role === 'instructor' ? '#7c3aed' : '#1565c0',
                          }}
                        >
                          {user.name.charAt(0)}
                        </Avatar>
                        {user.name}
                        <Chip
                          label={user.role}
                          size="small"
                          sx={{ ml: 'auto', height: 20, fontSize: '0.65rem' }}
                          variant="outlined"
                        />
                      </MenuItem>
                    ))}
                    <MenuItem onClick={handleLogout} sx={{ py: 1, color: '#dc2626', mt: 0.5, borderTop: '1px solid #f0f0f0' }}>
                      <ExitToApp sx={{ mr: 1.5, fontSize: 20 }} />
                      Sign Out
                    </MenuItem>
                  </Menu>
                </Box>
              )}
            </Toolbar>
          </AppBar>
        )}

        {/* ── Sliding Navigation Drawer (Burger Menu) ── */}
        <Drawer
          anchor="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          PaperProps={{
            sx: {
              width: 280,
              bgcolor: '#ffffff',
              boxShadow: '4px 0 24px rgba(0,0,0,0.08)',
              display: 'flex',
              flexDirection: 'column',
            },
          }}
        >
          {/* Header */}
          <Box
            sx={{
              p: 3,
              background: 'linear-gradient(135deg, #0d47a1 0%, #1565c0 100%)',
              color: 'white',
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '8px',
                  background: 'rgba(255,255,255,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(10px)',
                }}
              >
                <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: 'white' }}>
                  O
                </Typography>
              </Box>
              <Box>
                <Typography variant="h6" fontWeight="bold" sx={{ fontSize: '1.05rem', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
                  OMSC System
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.8, fontSize: '0.65rem' }}>
                  AI Examination Platform
                </Typography>
              </Box>
            </Box>

            {currentUser && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 700, opacity: 0.95 }}>
                  {currentUser.name}
                </Typography>
                <Chip
                  label={currentUser.role.toUpperCase()}
                  size="small"
                  sx={{
                    bgcolor: currentUser.role === 'instructor' ? 'rgba(168, 85, 247, 0.25)' : 'rgba(96, 165, 250, 0.25)',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: '0.6rem',
                    height: 20,
                    border: '1px solid rgba(255,255,255,0.2)',
                    mt: 0.5,
                  }}
                />
              </Box>
            )}
          </Box>

          <Divider />

          {/* Navigation links */}
          <List sx={{ p: 1.5, flexGrow: 1 }}>
            <ListItem disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                onClick={() => { navigate('/dashboard'); setDrawerOpen(false); }}
                selected={location.pathname === '/dashboard'}
                sx={{
                  borderRadius: 2,
                  py: 1,
                  px: 2,
                  color: location.pathname === '/dashboard' ? 'primary.main' : 'text.primary',
                  bgcolor: location.pathname === '/dashboard' ? 'rgba(21,101,192,0.06)' : 'transparent',
                  '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: location.pathname === '/dashboard' ? 'primary.main' : 'text.secondary' }}>
                  <Home />
                </ListItemIcon>
                <ListItemText primary="Dashboard" primaryTypographyProps={{ fontWeight: 700, fontSize: '0.875rem' }} />
              </ListItemButton>
            </ListItem>

            {isInstructor ? (
              <>
                <ListItem disablePadding sx={{ mb: 0.5 }}>
                  <ListItemButton
                    onClick={() => { navigate('/exam-generator'); setDrawerOpen(false); }}
                    selected={location.pathname.startsWith('/exam-generator')}
                    sx={{
                      borderRadius: 2,
                      py: 1,
                      px: 2,
                      color: location.pathname.startsWith('/exam-generator') ? 'primary.main' : 'text.primary',
                      bgcolor: location.pathname.startsWith('/exam-generator') ? 'rgba(21,101,192,0.06)' : 'transparent',
                      '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 36, color: location.pathname.startsWith('/exam-generator') ? 'primary.main' : 'text.secondary' }}>
                      <Quiz />
                    </ListItemIcon>
                    <ListItemText primary="AI Exam Generator" primaryTypographyProps={{ fontWeight: 700, fontSize: '0.875rem' }} />
                  </ListItemButton>
                </ListItem>

                <ListItem disablePadding sx={{ mb: 0.5 }}>
                  <ListItemButton
                    onClick={() => { navigate('/exam-repository'); setDrawerOpen(false); }}
                    selected={location.pathname === '/exam-repository'}
                    sx={{
                      borderRadius: 2,
                      py: 1,
                      px: 2,
                      color: location.pathname === '/exam-repository' ? 'primary.main' : 'text.primary',
                      bgcolor: location.pathname === '/exam-repository' ? 'rgba(21,101,192,0.06)' : 'transparent',
                      '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 36, color: location.pathname === '/exam-repository' ? 'primary.main' : 'text.secondary' }}>
                      <LibraryBooks />
                    </ListItemIcon>
                    <ListItemText primary="Exam Repository" primaryTypographyProps={{ fontWeight: 700, fontSize: '0.875rem' }} />
                  </ListItemButton>
                </ListItem>
              </>
            ) : (
              <>
                <ListItem disablePadding sx={{ mb: 0.5 }}>
                  <ListItemButton
                    onClick={() => { navigate('/reviewer-generator'); setDrawerOpen(false); }}
                    selected={location.pathname === '/reviewer-generator'}
                    sx={{
                      borderRadius: 2,
                      py: 1,
                      px: 2,
                      color: location.pathname === '/reviewer-generator' ? 'secondary.main' : 'text.primary',
                      bgcolor: location.pathname === '/reviewer-generator' ? 'rgba(124,58,237,0.06)' : 'transparent',
                      '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 36, color: location.pathname === '/reviewer-generator' ? 'secondary.main' : 'text.secondary' }}>
                      <AutoAwesome />
                    </ListItemIcon>
                    <ListItemText primary="AI Reviewer Generator" primaryTypographyProps={{ fontWeight: 700, fontSize: '0.875rem' }} />
                  </ListItemButton>
                </ListItem>

                <ListItem disablePadding sx={{ mb: 0.5 }}>
                  <ListItemButton
                    onClick={() => { navigate('/reviewer'); setDrawerOpen(false); }}
                    selected={location.pathname === '/reviewer'}
                    sx={{
                      borderRadius: 2,
                      py: 1,
                      px: 2,
                      color: location.pathname === '/reviewer' ? 'secondary.main' : 'text.primary',
                      bgcolor: location.pathname === '/reviewer' ? 'rgba(124,58,237,0.06)' : 'transparent',
                      '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 36, color: location.pathname === '/reviewer' ? 'secondary.main' : 'text.secondary' }}>
                      <LibraryBooks />
                    </ListItemIcon>
                    <ListItemText primary="My Reviewers" primaryTypographyProps={{ fontWeight: 700, fontSize: '0.875rem' }} />
                  </ListItemButton>
                </ListItem>
              </>
            )}

            {userClassrooms.length > 0 && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography
                  variant="overline"
                  sx={{
                    px: 2,
                    color: 'text.secondary',
                    fontWeight: 700,
                    fontSize: '0.65rem',
                    letterSpacing: '0.05em',
                    display: 'block',
                    mb: 1,
                  }}
                >
                  My Classrooms
                </Typography>
                {userClassrooms.map((cls) => {
                  const isActive = location.pathname === `/classroom/${cls.id}`;
                  const activeColor = isInstructor ? 'primary.main' : 'secondary.main';
                  const activeBg = isInstructor ? 'rgba(21,101,192,0.06)' : 'rgba(124,58,237,0.06)';
                  const isExpanded = expandedClassroom === cls.id;
                  return (
                    <Box key={cls.id} sx={{ mb: 0.5 }}>
                      <ListItem disablePadding>
                        <ListItemButton
                          onClick={() => { navigate(`/classroom/${cls.id}`); setDrawerOpen(false); }}
                          selected={isActive}
                          sx={{
                            borderRadius: 2,
                            py: 0.75,
                            px: 2,
                            color: isActive ? activeColor : 'text.primary',
                            bgcolor: isActive ? activeBg : 'transparent',
                            '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' },
                          }}
                        >
                          <ListItemIcon sx={{ minWidth: 36, color: isActive ? activeColor : 'text.secondary' }}>
                            <School fontSize="small" />
                          </ListItemIcon>
                          <ListItemText
                            primary={cls.name}
                            secondary={cls.subject}
                            primaryTypographyProps={{ fontWeight: 600, fontSize: '0.825rem', noWrap: true }}
                            secondaryTypographyProps={{ fontSize: '0.65rem', noWrap: true }}
                          />
                        </ListItemButton>
                        {/* Expands to the classroom's sections. Gradebook, Course Materials and
                            People & Roster are TABS inside ClassroomDetail rather than routes,
                            so they are unreachable from a drawer that can only link to the
                            classroom root — these entries deep-link via ?tab=<slug>. */}
                        <IconButton
                          size="small"
                          onClick={(e) => { e.stopPropagation(); setExpandedClassroom(isExpanded ? null : cls.id); }}
                          aria-label={isExpanded ? `Collapse ${cls.name} sections` : `Expand ${cls.name} sections`}
                          sx={{ mr: 0.5 }}
                        >
                          {isExpanded ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                        </IconButton>
                      </ListItem>
                      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                        <List disablePadding sx={{ pl: 3.5 }}>
                          {visibleTabSlugs(isInstructor).map((slug) => (
                            <ListItem disablePadding key={slug}>
                              <ListItemButton
                                onClick={() => {
                                  navigate(`/classroom/${cls.id}?tab=${slug}`);
                                  setDrawerOpen(false);
                                }}
                                sx={{ borderRadius: 2, py: 0.4, px: 1.5, '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' } }}
                              >
                                <ListItemText
                                  primary={CLASSROOM_TAB_LABELS[slug]}
                                  primaryTypographyProps={{ fontSize: '0.75rem', fontWeight: 600, noWrap: true, color: 'text.secondary' }}
                                />
                              </ListItemButton>
                            </ListItem>
                          ))}
                        </List>
                      </Collapse>
                    </Box>
                  );
                })}
              </>
            )}
          </List>
        </Drawer>

        <Outlet />
      </div>
    </ThemeProvider>
  );
}
