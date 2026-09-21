import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import {
  Container,
  Button,
  Typography,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Paper,
  Avatar,
  Tooltip,
  Snackbar,
  Alert,
  InputAdornment,
  IconButton,
  Menu,
  MenuItem,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  Add,
  People,
  Code,
  School,
  Quiz,
  ArrowForward,
  ContentCopy,
  Search,
  MoreVert,
  Archive,
  Unarchive,
  FolderOpen,
} from '@mui/icons-material';

// Classic Google Classroom card themes
const CLASS_THEMES = [
  { headerBg: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', badgeBg: '#dbeafe', badgeColor: '#1e40af' },
  { headerBg: 'linear-gradient(135deg, #5b21b6 0%, #8b5cf6 100%)', badgeBg: '#ede9fe', badgeColor: '#5b21b6' },
  { headerBg: 'linear-gradient(135deg, #065f46 0%, #10b981 100%)', badgeBg: '#d1fae5', badgeColor: '#065f46' },
  { headerBg: 'linear-gradient(135deg, #9a3412 0%, #f97316 100%)', badgeBg: '#ffedd5', badgeColor: '#9a3412' },
  { headerBg: 'linear-gradient(135deg, #0e7490 0%, #06b6d4 100%)', badgeBg: '#cffafe', badgeColor: '#0e7490' },
  { headerBg: 'linear-gradient(135deg, #86198f 0%, #d946ef 100%)', badgeBg: '#fae8ff', badgeColor: '#86198f' },
];

export default function Dashboard() {
  const {
    currentUser,
    users,
    classrooms,
    addClassroom,
    joinClassroom,
    exams,
    savedExams,
    archiveClassroom,
    unarchiveClassroom,
  } = useAuth();
  const navigate = useNavigate();

  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [openJoinDialog, setOpenJoinDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [classroomTab, setClassroomTab] = useState<'active' | 'archived'>('active');

  // Menu anchor for classroom card actions
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedClassroomId, setSelectedClassroomId] = useState<string | null>(null);

  const [className, setClassName] = useState('');
  const [subject, setSubject] = useState('');
  const [section, setSection] = useState('');
  const [description, setDescription] = useState('');
  const [classCode, setClassCode] = useState('');

  const [copySnackbar, setCopySnackbar] = useState({ open: false, code: '' });

  const isInstructor = currentUser?.role === 'instructor';

  // Filter classrooms by user role
  const userClassrooms = classrooms.filter((classroom) =>
    isInstructor
      ? classroom.instructorId === currentUser?.id
      : classroom.students.includes(currentUser?.id || '')
  );

  const activeClassrooms = userClassrooms.filter((c) => !c.isArchived);
  const archivedClassrooms = userClassrooms.filter((c) => c.isArchived === true);

  const currentList = classroomTab === 'active' ? activeClassrooms : archivedClassrooms;

  const filteredClassrooms = currentList.filter((classroom) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      classroom.name.toLowerCase().includes(query) ||
      classroom.subject.toLowerCase().includes(query) ||
      classroom.section.toLowerCase().includes(query) ||
      classroom.classCode.toLowerCase().includes(query)
    );
  });

  // Calculate accurate exam count
  // For Instructor: reads directly from savedExams (Exam Repository) so deleting an exam decreases the count immediately!
  // For Student: reads assigned exams for enrolled classrooms
  const totalExamsCount = isInstructor
    ? savedExams
      ? savedExams.length
      : 0
    : exams
      ? exams.filter((e) => userClassrooms.some((c) => c.id === e.classroomId)).length
      : 0;

  const handleCreateClassroom = () => {
    if (!className || !subject || !section) return;
    const newClassroom = {
      id: `class-${Date.now()}`,
      name: className,
      subject,
      section,
      instructorId: currentUser?.id || '',
      classCode: `${subject.replace(/\s+/g, '').toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
      students: [],
      createdAt: new Date().toISOString(),
      description,
      isArchived: false,
    };
    addClassroom(newClassroom);
    setClassName('');
    setSubject('');
    setSection('');
    setDescription('');
    setOpenCreateDialog(false);
  };

  const handleJoinClassroom = () => {
    const studentId = currentUser?.id || '';
    const success = joinClassroom(classCode, studentId);
    if (success) {
      const targetClass = classrooms.find(
        (c) => c.classCode.toLowerCase() === classCode.trim().toLowerCase()
      );
      if (targetClass) navigate(`/classroom/${targetClass.id}`);
    } else {
      alert('Invalid Class Code. Please check the code and try again.');
    }
    setOpenJoinDialog(false);
    setClassCode('');
  };

  const handleCopyCode = (e: React.MouseEvent, code: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopySnackbar({ open: true, code });
  };

  const handleOpenMenu = (e: React.MouseEvent<HTMLElement>, classroomId: string) => {
    e.stopPropagation();
    setMenuAnchorEl(e.currentTarget);
    setSelectedClassroomId(classroomId);
  };

  const handleCloseMenu = () => {
    setMenuAnchorEl(null);
    setSelectedClassroomId(null);
  };

  const handleToggleArchive = (classroomId: string, isArchived: boolean) => {
    if (isArchived) {
      unarchiveClassroom(classroomId);
    } else {
      archiveClassroom(classroomId);
    }
    handleCloseMenu();
  };

  const initials = currentUser?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'U';

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f8fafc', py: 4, px: { xs: 2, sm: 4, md: 6 } }}>
      <Container maxWidth="xl">
        {/* ── Top Header Banner ── */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, md: 4 },
            borderRadius: 4,
            bgcolor: '#ffffff',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
            mb: 4,
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: { xs: 'flex-start', md: 'center' },
            justifyContent: 'space-between',
            gap: 3,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5 }}>
            <Avatar
              src={currentUser?.avatar}
              sx={{
                width: 64,
                height: 64,
                fontSize: '1.4rem',
                fontWeight: 800,
                bgcolor: isInstructor ? '#7c3aed' : '#2563eb',
                color: 'white',
              }}
            >
              {initials}
            </Avatar>
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                <Typography variant="h5" fontWeight={900} sx={{ color: '#0f172a' }}>
                  Welcome back, {currentUser?.name}!
                </Typography>
                <Chip
                  label={isInstructor ? 'INSTRUCTOR' : 'STUDENT'}
                  size="small"
                  sx={{
                    bgcolor: isInstructor ? '#f5f3ff' : '#eff6ff',
                    color: isInstructor ? '#6d28d9' : '#1d4ed8',
                    fontWeight: 800,
                    fontSize: '0.65rem',
                    height: 22,
                  }}
                />
              </Box>
              <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
                {isInstructor
                  ? 'Manage your classrooms, create AI exams, and view student submissions.'
                  : 'Access your enrolled classrooms, study materials, and take assessments.'}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', width: { xs: '100%', md: 'auto' } }}>
            {isInstructor ? (
              <>
                <Button
                  variant="outlined"
                  startIcon={<Quiz />}
                  onClick={() => navigate('/exam-generator')}
                  sx={{
                    borderColor: '#cbd5e1',
                    color: '#334155',
                    fontWeight: 700,
                    px: 2.5,
                    py: 1.1,
                    borderRadius: 2.5,
                    textTransform: 'none',
                    '&:hover': { bgcolor: '#f8fafc', borderColor: '#94a3b8' },
                  }}
                >
                  AI Exam Generator
                </Button>
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => setOpenCreateDialog(true)}
                  sx={{
                    bgcolor: '#7c3aed',
                    color: 'white',
                    fontWeight: 800,
                    px: 3,
                    py: 1.1,
                    borderRadius: 2.5,
                    textTransform: 'none',
                    boxShadow: '0 4px 14px rgba(124,58,237,0.3)',
                    '&:hover': { bgcolor: '#6d28d9' },
                  }}
                >
                  Create Classroom
                </Button>
              </>
            ) : (
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => setOpenJoinDialog(true)}
                sx={{
                  bgcolor: '#2563eb',
                  color: 'white',
                  fontWeight: 800,
                  px: 3,
                  py: 1.1,
                  borderRadius: 2.5,
                  textTransform: 'none',
                  boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
                  '&:hover': { bgcolor: '#1d4ed8' },
                }}
              >
                Join Classroom
              </Button>
            )}
          </Box>
        </Paper>

        {/* ── 3-Metric Summary Cards ── */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
            gap: 3,
            mb: 4,
            width: '100%',
          }}
        >
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 3.5,
              bgcolor: '#ffffff',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <Box sx={{ width: 48, height: 48, borderRadius: 3, bgcolor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <School sx={{ color: '#2563eb', fontSize: 26 }} />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight={900} sx={{ color: '#0f172a', lineHeight: 1 }}>
                {activeClassrooms.length}
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, mt: 0.5, display: 'block' }}>
                {isInstructor ? 'Active Classrooms' : 'Enrolled Classes'}
              </Typography>
            </Box>
          </Paper>

          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 3.5,
              bgcolor: '#ffffff',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <Box sx={{ width: 48, height: 48, borderRadius: 3, bgcolor: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <People sx={{ color: '#7c3aed', fontSize: 26 }} />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight={900} sx={{ color: '#0f172a', lineHeight: 1 }}>
                {isInstructor
                  ? activeClassrooms.reduce((sum, c) => sum + (c.students?.length || 0), 0)
                  : activeClassrooms.length}
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, mt: 0.5, display: 'block' }}>
                {isInstructor ? 'Total Students' : 'Active Classes'}
              </Typography>
            </Box>
          </Paper>

          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 3.5,
              bgcolor: '#ffffff',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <Box sx={{ width: 48, height: 48, borderRadius: 3, bgcolor: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Quiz sx={{ color: '#059669', fontSize: 26 }} />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight={900} sx={{ color: '#0f172a', lineHeight: 1 }}>
                {totalExamsCount}
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, mt: 0.5, display: 'block' }}>
                {isInstructor ? 'Repository Exams' : 'Available Exams'}
              </Typography>
            </Box>
          </Paper>
        </Box>

        {/* ── Classroom Roster Section Header with Active / Archived Tabs ── */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', md: 'center' },
            gap: 2,
            mb: 3,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Typography variant="h6" fontWeight={900} sx={{ color: '#0f172a' }}>
              My Classrooms
            </Typography>

            {/* Active vs Archived Toggle */}
            <ToggleButtonGroup
              value={classroomTab}
              exclusive
              onChange={(_, val) => val && setClassroomTab(val)}
              size="small"
              sx={{
                bgcolor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: 2.5,
                '& .MuiToggleButton-root': {
                  px: 2,
                  py: 0.5,
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  textTransform: 'none',
                  border: 'none',
                  color: '#64748b',
                },
                '& .Mui-selected': {
                  bgcolor: '#f1f5f9 !important',
                  color: '#0f172a !important',
                  fontWeight: 800,
                },
              }}
            >
              <ToggleButton value="active">
                Active ({activeClassrooms.length})
              </ToggleButton>
              <ToggleButton value="archived">
                <Archive sx={{ fontSize: 14, mr: 0.5 }} /> Archived ({archivedClassrooms.length})
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {currentList.length > 0 && (
            <TextField
              placeholder="Search classrooms..."
              size="small"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search sx={{ fontSize: 20, color: '#94a3b8' }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                bgcolor: '#ffffff',
                minWidth: { xs: '100%', sm: 260 },
                '& .MuiOutlinedInput-root': { borderRadius: 2.5 },
              }}
            />
          )}
        </Box>

        {/* ── Empty State ── */}
        {filteredClassrooms.length === 0 ? (
          <Paper
            elevation={0}
            sx={{
              p: 6,
              textAlign: 'center',
              borderRadius: 4,
              border: '2px dashed #cbd5e1',
              bgcolor: '#ffffff',
            }}
          >
            {classroomTab === 'active' ? (
              <>
                <School sx={{ fontSize: 48, color: '#94a3b8', mb: 1.5 }} />
                <Typography variant="h6" fontWeight={800} sx={{ color: '#0f172a' }}>
                  {searchQuery ? 'No matching classroom found' : 'No active classrooms available'}
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b', mb: 3, maxWidth: 360, mx: 'auto' }}>
                  {isInstructor
                    ? 'Click "Create Classroom" above to set up your first class.'
                    : 'Click "Join Classroom" above and enter your Class Code.'}
                </Typography>
                {isInstructor ? (
                  <Button variant="contained" startIcon={<Add />} onClick={() => setOpenCreateDialog(true)} sx={{ bgcolor: '#7c3aed', fontWeight: 800 }}>
                    Create Classroom
                  </Button>
                ) : (
                  <Button variant="contained" startIcon={<Add />} onClick={() => setOpenJoinDialog(true)} sx={{ bgcolor: '#2563eb', fontWeight: 800 }}>
                    Join Classroom
                  </Button>
                )}
              </>
            ) : (
              <>
                <Archive sx={{ fontSize: 48, color: '#94a3b8', mb: 1.5 }} />
                <Typography variant="h6" fontWeight={800} sx={{ color: '#0f172a' }}>
                  No archived classrooms
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b', maxWidth: 360, mx: 'auto' }}>
                  When you archive past semesters or finished courses, they will safely appear here.
                </Typography>
              </>
            )}
          </Paper>
        ) : (
          /* ── Google Classroom Style Card Grid ── */
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
              gap: 3,
              width: '100%',
            }}
          >
            {filteredClassrooms.map((classroom, idx) => {
              const theme = CLASS_THEMES[idx % CLASS_THEMES.length];
              const instructor = users.find((u) => u.id === classroom.instructorId);

              return (
                <Paper
                  key={classroom.id}
                  elevation={0}
                  onClick={() => navigate(`/classroom/${classroom.id}`)}
                  sx={{
                    borderRadius: 3.5,
                    bgcolor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.03)',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    boxSizing: 'border-box',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      transform: 'translateY(-3px)',
                      boxShadow: '0 12px 28px rgba(0,0,0,0.08)',
                    },
                  }}
                >
                  {/* Google Classroom Style Card Header Banner */}
                  <Box
                    sx={{
                      background: theme.headerBg,
                      p: 2.5,
                      color: 'white',
                      position: 'relative',
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Box sx={{ minWidth: 0, pr: 1 }}>
                        <Typography
                          variant="h6"
                          fontWeight={800}
                          sx={{
                            color: 'white',
                            lineHeight: 1.25,
                            fontSize: '1.15rem',
                            mb: 0.5,
                            noWrap: true,
                          }}
                        >
                          {classroom.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.85)', fontWeight: 700, display: 'block' }}>
                          {classroom.subject} &bull; {classroom.section}
                        </Typography>
                        {instructor && (
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.72rem', display: 'block', mt: 0.3 }}>
                            {instructor.name}
                          </Typography>
                        )}
                      </Box>

                      {/* 3-Dots Menu Button */}
                      <IconButton
                        size="small"
                        onClick={(e) => handleOpenMenu(e, classroom.id)}
                        sx={{ color: 'white', bgcolor: 'rgba(255,255,255,0.15)', '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' } }}
                      >
                        <MoreVert sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Box>
                  </Box>

                  {/* Card Content Body */}
                  <Box sx={{ p: 2.5, flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography
                        variant="body2"
                        sx={{
                          color: '#64748b',
                          fontSize: '0.82rem',
                          lineHeight: 1.4,
                          mb: 2,
                          minHeight: 36,
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {classroom.description || 'Click to view classwork, assigned exams, and course materials.'}
                      </Typography>

                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                        <Tooltip title="Click to copy Class Code">
                          <Chip
                            icon={<Code sx={{ fontSize: '13px !important' }} />}
                            label={classroom.classCode}
                            size="small"
                            onClick={(e) => handleCopyCode(e, classroom.classCode)}
                            deleteIcon={<ContentCopy sx={{ fontSize: '12px !important' }} />}
                            onDelete={(e) => handleCopyCode(e, classroom.classCode)}
                            sx={{
                              bgcolor: '#f1f5f9',
                              color: '#334155',
                              fontWeight: 800,
                              fontSize: '0.7rem',
                              cursor: 'pointer',
                            }}
                          />
                        </Tooltip>

                        {classroom.isArchived && (
                          <Chip
                            icon={<Archive sx={{ fontSize: '12px !important' }} />}
                            label="Archived"
                            size="small"
                            sx={{ bgcolor: '#fef3c7', color: '#92400e', fontWeight: 800, fontSize: '0.68rem' }}
                          />
                        )}
                      </Box>
                    </Box>

                    {/* Card Footer */}
                    <Box
                      sx={{
                        pt: 2,
                        borderTop: '1px solid #f1f5f9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        mt: 2,
                      }}
                    >
                      <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <People sx={{ fontSize: 16 }} /> {classroom.students?.length || 0} student{(classroom.students?.length || 0) !== 1 ? 's' : ''}
                      </Typography>

                      <Button
                        size="small"
                        endIcon={<ArrowForward />}
                        sx={{
                          fontWeight: 800,
                          color: '#2563eb',
                          textTransform: 'none',
                        }}
                      >
                        Open Class
                      </Button>
                    </Box>
                  </Box>
                </Paper>
              );
            })}
          </Box>
        )}

        {/* 3-Dots Action Menu */}
        <Menu
          anchorEl={menuAnchorEl}
          open={Boolean(menuAnchorEl)}
          onClose={handleCloseMenu}
          slotProps={{
            paper: {
              sx: { borderRadius: 2.5, minWidth: 180, boxShadow: '0 8px 24px rgba(0,0,0,0.1)' },
            },
          }}
        >
          {selectedClassroomId && (
            <>
              <MenuItem
                onClick={() => {
                  const target = classrooms.find((c) => c.id === selectedClassroomId);
                  if (target) navigator.clipboard.writeText(target.classCode);
                  setCopySnackbar({ open: true, code: target?.classCode || '' });
                  handleCloseMenu();
                }}
                sx={{ fontSize: '0.85rem', fontWeight: 600 }}
              >
                <ContentCopy sx={{ fontSize: 16, mr: 1.5, color: '#64748b' }} /> Copy Class Code
              </MenuItem>

              <MenuItem
                onClick={() => {
                  const target = classrooms.find((c) => c.id === selectedClassroomId);
                  if (target) handleToggleArchive(target.id, !!target.isArchived);
                }}
                sx={{ fontSize: '0.85rem', fontWeight: 600 }}
              >
                {classrooms.find((c) => c.id === selectedClassroomId)?.isArchived ? (
                  <>
                    <Unarchive sx={{ fontSize: 16, mr: 1.5, color: '#059669' }} /> Restore Classroom
                  </>
                ) : (
                  <>
                    <Archive sx={{ fontSize: 16, mr: 1.5, color: '#d97706' }} /> Archive Classroom
                  </>
                )}
              </MenuItem>
            </>
          )}
        </Menu>
      </Container>

      {/* Create Classroom Dialog */}
      <Dialog open={openCreateDialog} onClose={() => setOpenCreateDialog(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4, p: 1 } }}>
        <DialogTitle sx={{ fontWeight: 800, pb: 1, color: '#0f172a' }}>Create New Classroom</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <TextField
            autoFocus margin="dense" label="Class Name" fullWidth variant="outlined" placeholder="e.g. Web Development 101"
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2.5 } }} value={className} onChange={(e) => setClassName(e.target.value)} required
          />
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2, mb: 2 }}>
            <TextField margin="dense" label="Subject Code" fullWidth variant="outlined" placeholder="e.g. ITE301"
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5 } }} value={subject} onChange={(e) => setSubject(e.target.value)} required />
            <TextField margin="dense" label="Section" fullWidth variant="outlined" placeholder="e.g. BSIT 3A"
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5 } }} value={section} onChange={(e) => setSection(e.target.value)} required />
          </Box>
          <TextField margin="dense" label="Description (optional)" fullWidth variant="outlined" multiline rows={3}
            placeholder="Brief course overview..." sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5 } }} value={description} onChange={(e) => setDescription(e.target.value)} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setOpenCreateDialog(false)} sx={{ fontWeight: 700, color: '#64748b' }}>Cancel</Button>
          <Button onClick={handleCreateClassroom} variant="contained" disabled={!className || !subject || !section} sx={{ fontWeight: 800, bgcolor: '#7c3aed', borderRadius: 2.5 }}>
            Create Classroom
          </Button>
        </DialogActions>
      </Dialog>

      {/* Join Classroom Dialog */}
      <Dialog open={openJoinDialog} onClose={() => setOpenJoinDialog(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4, p: 1 } }}>
        <DialogTitle sx={{ fontWeight: 800, pb: 1, color: '#0f172a' }}>Join a Classroom</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>
            Enter the unique Class Code provided by your instructor to enroll.
          </Typography>
          <TextField autoFocus margin="dense" label="Class Code" fullWidth variant="outlined" value={classCode} onChange={(e) => setClassCode(e.target.value)} placeholder="e.g., WEB101-9482" sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5 } }} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setOpenJoinDialog(false)} sx={{ fontWeight: 700, color: '#64748b' }}>Cancel</Button>
          <Button onClick={handleJoinClassroom} variant="contained" disabled={!classCode} sx={{ fontWeight: 800, bgcolor: '#2563eb', borderRadius: 2.5 }}>
            Join Class
          </Button>
        </DialogActions>
      </Dialog>

      {/* Copy Code Notification Toast */}
      <Snackbar open={copySnackbar.open} autoHideDuration={3000} onClose={() => setCopySnackbar({ open: false, code: '' })} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setCopySnackbar({ open: false, code: '' })} severity="success" sx={{ width: '100%', borderRadius: 3, fontWeight: 700 }}>
          Class Code <strong>{copySnackbar.code}</strong> copied to clipboard!
        </Alert>
      </Snackbar>
    </Box>
  );
}
