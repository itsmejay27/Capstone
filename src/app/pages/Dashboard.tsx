import { teachesClass } from '../services/classAccess';
import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import {
  Box, Paper, Typography, Button, TextField, Dialog, DialogTitle, DialogContent,
  DialogActions, IconButton, Menu, MenuItem, Snackbar, Alert, Chip, Stack, Tooltip,
  ListItemIcon, ListItemText,
} from '@mui/material';
import {
  Add, Login, MoreVert, ContentCopy, Archive, Unarchive, School, Quiz,
  People,
  Link as LinkIcon, AutoAwesome, LibraryBooks, Bolt,
} from '@mui/icons-material';
import {
  PageContainer, PageHeader, SectionHeading, SearchField, FilterBar, FilterPill,
  CardGrid, EntityCard, FolderCard, StatusPill, StatTile, EmptyState, Field, FieldRow,
} from '../components/ui-kit';
import { palette, radius, font, tintFor } from '../theme/tokens';
import { classThemeFor } from '../theme/classThemes';
import { useIsMobile } from '../hooks/useResponsive';

/**
 * Home — the classroom index.
 *
 * All classroom CRUD behaviour (create, join by code, archive/unarchive, copy code) is
 * unchanged from the previous version; this is a presentation rewrite onto the shared design
 * system. Favourites are read from the same localStorage key the sidebar writes, so starring
 * a class in the rail surfaces it here too.
 */

const FAVOURITES_KEY = 'classroomFavourites';

function readFavourites(): string[] {
  try {
    const raw = localStorage.getItem(FAVOURITES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

type SortKey = 'recent' | 'name' | 'students';

export default function Dashboard() {
  const {
    currentUser,
    users,
    classrooms,
    addClassroom,
    joinClassroom,
    exams,
    savedExams,
    examAttempts,
    archiveClassroom,
    unarchiveClassroom,
  } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [openJoinDialog, setOpenJoinDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [classroomTab, setClassroomTab] = useState<'active' | 'archived'>('active');
  const [sortKey, setSortKey] = useState<SortKey>('recent');

  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedClassroomId, setSelectedClassroomId] = useState<string | null>(null);

  const [className, setClassName] = useState('');
  const [subject, setSubject] = useState('');
  const [section, setSection] = useState('');
  const [description, setDescription] = useState('');
  const [classCode, setClassCode] = useState('');
  const [level, setLevel] = useState('');
  const [room, setRoom] = useState('');
  const [joinError, setJoinError] = useState('');



  const [copySnackbar, setCopySnackbar] = useState({ open: false, code: '' });

  const favourites = readFavourites();
  const isInstructor = currentUser?.role === 'instructor';

  // An invite link carries ?join=CODE. Opening it lands a student on the join form with
  // the code already filled in, rather than leaving them to find the form themselves.
  useEffect(() => {
    if (isInstructor) return;
    // An unauthenticated visitor is bounced to the login screen first, which drops the
    // query string, so the code is stashed on the way past and read back here.
    let stashed: string | null = null;
    try { stashed = sessionStorage.getItem('pendingJoinCode'); } catch { /* blocked storage */ }
    const code = new URLSearchParams(window.location.search).get('join') || stashed;
    if (!code) return;
    try { sessionStorage.removeItem('pendingJoinCode'); } catch { /* blocked storage */ }
    setClassCode(code);
    setOpenJoinDialog(true);
    // Drop the parameter so a refresh does not reopen the dialog after joining.
    window.history.replaceState({}, '', window.location.pathname);
  }, [isInstructor]);

  const userClassrooms = classrooms.filter((classroom) =>
    isInstructor
      ? teachesClass(classroom, currentUser?.id)
      : classroom.students.includes(currentUser?.id || '')
  );

  const activeClassrooms = userClassrooms.filter((c) => !c.isArchived);
  const archivedClassrooms = userClassrooms.filter((c) => c.isArchived === true);
  const currentList = classroomTab === 'active' ? activeClassrooms : archivedClassrooms;

  const filteredClassrooms = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    const matched = currentList.filter((classroom) => {
      if (!query) return true;
      return (
        classroom.name.toLowerCase().includes(query) ||
        classroom.subject.toLowerCase().includes(query) ||
        classroom.section.toLowerCase().includes(query) ||
        classroom.classCode.toLowerCase().includes(query)
      );
    });
    const sorted = [...matched];
    if (sortKey === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortKey === 'students') sorted.sort((a, b) => (b.students?.length || 0) - (a.students?.length || 0));
    else sorted.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    return sorted;
  }, [currentList, searchQuery, sortKey]);

  const favouriteClassrooms = activeClassrooms.filter((c) => favourites.includes(c.id));

  // Instructor count reads savedExams so deleting a template updates the figure immediately;
  // students see exams assigned to the classes they are enrolled in.
  const totalExamsCount = isInstructor
    ? savedExams?.length ?? 0
    : exams?.filter((e) => userClassrooms.some((c) => c.id === e.classroomId)).length ?? 0;

  const totalStudents = useMemo(
    () => new Set(activeClassrooms.flatMap((c) => c.students || [])).size,
    [activeClassrooms]
  );

  const pendingWork = useMemo(() => {
    if (!currentUser) return 0;
    const myExams = (exams || []).filter((e) => userClassrooms.some((c) => c.id === e.classroomId));
    if (isInstructor) {
      return (examAttempts || []).filter((a) => a.submittedAt && myExams.some((e) => e.id === a.examId)).length;
    }
    return myExams.filter(
      (e) => !(examAttempts || []).some((a) => a.examId === e.id && a.studentId === currentUser.id && a.submittedAt)
    ).length;
  }, [currentUser, isInstructor, exams, examAttempts, userClassrooms]);

  const handleCreateClassroom = () => {
    // Only the class name is required, as in Google Classroom. The join code is derived
    // from whichever identifier the instructor did give, so it stays recognisable.
    if (!className.trim()) return;
    const codeSeed = (subject || className).replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8) || 'CLASS';
    const newClassroom = {
      id: `class-${Date.now()}`,
      name: className.trim(),
      subject: subject.trim(),
      section: section.trim(),
      level: level.trim(),
      room: room.trim(),
      instructorId: currentUser?.id || '',
      classCode: `${codeSeed}-${Math.floor(1000 + Math.random() * 9000)}`,
      students: [],
      createdAt: new Date().toISOString(),
      description,
      isArchived: false,
    };
    addClassroom(newClassroom);
    setClassName('');
    setSubject('');
    setSection('');
    setLevel('');
    setRoom('');
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
      setOpenJoinDialog(false);
      setClassCode('');
      setJoinError('');
      if (targetClass) navigate(`/classroom/${targetClass.id}`);
    } else {
      // Replaces a blocking alert() with inline validation in the dialog.
      setJoinError('That class code did not match any class. Check it with your instructor and try again.');
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopySnackbar({ open: true, code });
  };

  /**
   * Copies a shareable invite link. The code alone means a student has to find the join
   * form first; the link drops them straight onto it with the code already filled in.
   */
  const handleCopyInviteLink = (classroom: any) => {
    const url = `${window.location.origin}/?join=${encodeURIComponent(classroom.classCode)}`;
    navigator.clipboard.writeText(url);
    setCopySnackbar({ open: true, code: 'link' });
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
    if (isArchived) unarchiveClassroom(classroomId);
    else archiveClassroom(classroomId);
    handleCloseMenu();
  };

  const selectedClassroom = classrooms.find((c) => c.id === selectedClassroomId);

  /** Enrolled members, for the avatar stack on a card. */
  const membersOf = (classroom: any) =>
    users
      .filter((u) => classroom.students?.includes(u.id))
      .map((u) => ({ name: u.name, avatar: u.avatar }));

  const cardAction = (classroomId: string) => (
    <IconButton
      size="small"
      onClick={(e) => handleOpenMenu(e, classroomId)}
      aria-label="Classroom actions"
      sx={{ bgcolor: `${palette.surface}d9`, '&:hover': { bgcolor: palette.surface } }}
    >
      <MoreVert fontSize="small" />
    </IconButton>
  );

  return (
    <PageContainer>
      <PageHeader
        title={`Welcome back, ${currentUser?.name?.split(' ')[0] || 'there'}`}
        subtitle={
          isInstructor
            ? 'Your classes, exam templates and everything waiting on you.'
            : 'Your enrolled classes and the work assigned to you.'
        }
        actions={
          isInstructor ? (
            <>
              <Button variant="outlined" startIcon={<AutoAwesome />} onClick={() => navigate('/exam-generator')}>
                Generate exam
              </Button>
              <Button variant="contained" startIcon={<Add />} onClick={() => setOpenCreateDialog(true)}>
                Create class
              </Button>
            </>
          ) : (
            <Button variant="contained" startIcon={<Login />} onClick={() => setOpenJoinDialog(true)}>
              Join a class
            </Button>
          )
        }
      />

      {/* At-a-glance tiles */}
      <Stack direction="row" sx={{ gap: 1.5, flexWrap: 'wrap', mb: 3 }}>
        <StatTile
          label="Active classes"
          value={String(activeClassrooms.length)}
          hint={archivedClassrooms.length > 0 ? `${archivedClassrooms.length} archived` : undefined}
          icon={<School sx={{ fontSize: 16, color: palette.primary }} />}
        />
        <StatTile
          label={isInstructor ? 'Exam templates' : 'Assigned exams'}
          value={String(totalExamsCount)}
          icon={<Quiz sx={{ fontSize: 16, color: palette.instructor }} />}
        />
        {isInstructor && (
          <StatTile
            label="Students"
            value={String(totalStudents)}
            hint="across active classes"
            icon={<People sx={{ fontSize: 16, color: palette.student }} />}
          />
        )}
        <StatTile
          label={isInstructor ? 'To review' : 'To do'}
          value={String(pendingWork)}
          tone={pendingWork > 0 ? 'warning' : 'neutral'}
          hint={pendingWork > 0 ? 'needs attention' : 'all caught up'}
          icon={<Bolt sx={{ fontSize: 16, color: palette.warning }} />}
        />
      </Stack>

      {/* Favourites, as the reference's tinted folder tiles */}
      {favouriteClassrooms.length > 0 && classroomTab === 'active' && !searchQuery && (
        <Box sx={{ mb: 4 }}>
          <SectionHeading title="Favourites" count={favouriteClassrooms.length} />
          <CardGrid min={240}>
            {favouriteClassrooms.map((classroom) => (
              <FolderCard
                key={classroom.id}
                id={classroom.id}
                bannerBackground={classroom.theme ? classThemeFor(classroom.theme).background : undefined}
                title={classroom.name}
                meta={`${classroom.students?.length || 0} student${classroom.students?.length === 1 ? '' : 's'}`}
                members={membersOf(classroom)}
                onClick={() => navigate(`/classroom/${classroom.id}`)}
                action={cardAction(classroom.id)}
              />
            ))}
          </CardGrid>
        </Box>
      )}

      <SectionHeading
        title="My Classrooms"
        count={filteredClassrooms.length}
        action={
          <SearchField
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search classes…"
            sx={{ maxWidth: { xs: '100%', sm: 260 } }}
          />
        }
      />

      <FilterBar>
        <FilterPill<'active' | 'archived'>
          label="Status"
          value={classroomTab}
          onChange={setClassroomTab}
          options={[
            { value: 'active', label: `Active (${activeClassrooms.length})` },
            { value: 'archived', label: `Archived (${archivedClassrooms.length})` },
          ]}
        />
        <FilterPill<SortKey>
          label="Sort"
          value={sortKey}
          onChange={setSortKey}
          options={[
            { value: 'recent', label: 'Most recent' },
            { value: 'name', label: 'Name (A–Z)' },
            { value: 'students', label: 'Most students' },
          ]}
        />
        {isInstructor && (
          <Button variant="outlined" size="small" startIcon={<LibraryBooks />} onClick={() => navigate('/exam-repository')}
            sx={{ borderRadius: '999px', whiteSpace: 'nowrap' }}>
            Repository
          </Button>
        )}
      </FilterBar>

      {filteredClassrooms.length === 0 ? (
        <EmptyState
          icon={<School />}
          title={
            searchQuery
              ? 'No classes match that search'
              : classroomTab === 'archived'
                ? 'No archived classes'
                : isInstructor
                  ? 'You have not created a class yet'
                  : 'You are not enrolled in a class yet'
          }
          description={
            searchQuery
              ? 'Try a different name, subject, section or class code.'
              : isInstructor
                ? 'Create your first class, then generate an exam for it with AI.'
                : 'Ask your instructor for a class code, then join to see your classwork.'
          }
          action={
            searchQuery ? (
              <Button variant="outlined" onClick={() => setSearchQuery('')}>Clear search</Button>
            ) : isInstructor ? (
              <Button variant="contained" startIcon={<Add />} onClick={() => setOpenCreateDialog(true)}>
                Create class
              </Button>
            ) : (
              <Button variant="contained" startIcon={<Login />} onClick={() => setOpenJoinDialog(true)}>
                Join a class
              </Button>
            )
          }
        />
      ) : (
        <CardGrid>
          {filteredClassrooms.map((classroom) => {
            const instructor = users.find((u) => u.id === classroom.instructorId);
            const examCount = (exams || []).filter((e) => e.classroomId === classroom.id).length;
            return (
              <EntityCard
                key={classroom.id}
                id={classroom.id}
                title={classroom.name}
                metaLeft={`${classroom.subject} · ${classroom.section}`}
                metaRight={
                  classroom.isArchived
                    ? <StatusPill label="Archived" tone="neutral" />
                    : <StatusPill label="Active" tone="success" />
                }
                members={membersOf(classroom)}
                onClick={() => navigate(`/classroom/${classroom.id}`)}
                action={cardAction(classroom.id)}
                footerRight={
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <Typography variant="caption" sx={{ color: palette.inkTertiary, whiteSpace: 'nowrap' }}>
                      {examCount} exam{examCount === 1 ? '' : 's'}
                    </Typography>
                    {isInstructor && (
                      <Tooltip title={`Copy class code ${classroom.classCode}`}>
                        <Chip
                          label={classroom.classCode}
                          size="small"
                          icon={<ContentCopy sx={{ fontSize: '0.7rem !important' }} />}
                          onClick={(e) => { e.stopPropagation(); handleCopyCode(classroom.classCode); }}
                          sx={{
                            bgcolor: palette.surfaceSunken, color: palette.inkSecondary,
                            fontFamily: font.mono, fontWeight: 700, cursor: 'pointer',
                            '&:hover': { bgcolor: palette.primarySoft, color: palette.primary },
                          }}
                        />
                      </Tooltip>
                    )}
                    {!isInstructor && instructor && (
                      <Typography variant="caption" sx={{ color: palette.inkTertiary }} noWrap>
                        {instructor.name}
                      </Typography>
                    )}
                  </Stack>
                }
              />
            );
          })}
        </CardGrid>
      )}

      {/* Card action menu */}
      <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={handleCloseMenu}>
        <MenuItem onClick={() => { if (selectedClassroomId) navigate(`/classroom/${selectedClassroomId}`); handleCloseMenu(); }}>
          <ListItemIcon><School fontSize="small" /></ListItemIcon>
          <ListItemText>Open class</ListItemText>
        </MenuItem>
        {isInstructor && selectedClassroom && (
          <MenuItem onClick={() => { handleCopyInviteLink(selectedClassroom); handleCloseMenu(); }}>
            <ListItemIcon><LinkIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Copy invite link</ListItemText>
          </MenuItem>
        )}
        {isInstructor && selectedClassroom && (
          <MenuItem onClick={() => { handleCopyCode(selectedClassroom.classCode); handleCloseMenu(); }}>
            <ListItemIcon><ContentCopy fontSize="small" /></ListItemIcon>
            <ListItemText>Copy class code</ListItemText>
          </MenuItem>
        )}
        {isInstructor && selectedClassroom && (
          <MenuItem onClick={() => handleToggleArchive(selectedClassroom.id, Boolean(selectedClassroom.isArchived))}>
            <ListItemIcon>
              {selectedClassroom.isArchived ? <Unarchive fontSize="small" /> : <Archive fontSize="small" />}
            </ListItemIcon>
            <ListItemText>{selectedClassroom.isArchived ? 'Restore class' : 'Archive class'}</ListItemText>
          </MenuItem>
        )}
      </Menu>

      {/* Create class */}
      <Dialog
        open={openCreateDialog}
        onClose={() => setOpenCreateDialog(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>Create a new class</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: palette.inkSecondary, mb: 2.5 }}>
            A join code is generated automatically — share it with your students so they can enrol.
          </Typography>
          <Field label="Class name" required>
            <TextField
              autoFocus
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="e.g. Integrative Programming and Technologies 2"
            />
          </Field>
          <FieldRow>
            <Field label="Section">
              <TextField value={section} onChange={(e) => setSection(e.target.value)} placeholder="e.g. BSIT 3A" />
            </Field>
            <Field label="Level(s)">
              <TextField value={level} onChange={(e) => setLevel(e.target.value)} placeholder="e.g. 3rd Year" />
            </Field>
          </FieldRow>
          <FieldRow>
            <Field label="Subject">
              <TextField value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. IPT2" />
            </Field>
            <Field label="Room">
              <TextField value={room} onChange={(e) => setRoom(e.target.value)} placeholder="e.g. Lab 2" />
            </Field>
          </FieldRow>
          <Field label="Description" hint="Optional — a short overview students will see on the class page.">
            <TextField
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              multiline
              rows={3}
              placeholder="What this course covers…"
            />
          </Field>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreateDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateClassroom}
            disabled={!className.trim()}
          >
            Create class
          </Button>
        </DialogActions>
      </Dialog>

      {/* Join class */}
      <Dialog
        open={openJoinDialog}
        onClose={() => { setOpenJoinDialog(false); setJoinError(''); }}
        maxWidth="xs"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>Join a class</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: palette.inkSecondary, mb: 2.5 }}>
            Enter the class code your instructor gave you.
          </Typography>
          <Field label="Class code" required>
            <TextField
              autoFocus
              value={classCode}
              onChange={(e) => { setClassCode(e.target.value); setJoinError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && classCode.trim()) handleJoinClassroom(); }}
              placeholder="e.g. IPT2-4821"
              error={Boolean(joinError)}
              helperText={joinError || undefined}
              inputProps={{ style: { fontFamily: font.mono, letterSpacing: '0.04em' } }}
            />
          </Field>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setOpenJoinDialog(false); setJoinError(''); }}>Cancel</Button>
          <Button variant="contained" onClick={handleJoinClassroom} disabled={!classCode.trim()}>
            Join
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={copySnackbar.open}
        autoHideDuration={2500}
        onClose={() => setCopySnackbar({ open: false, code: '' })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setCopySnackbar({ open: false, code: '' })}>
          {copySnackbar.code === 'link'
            ? 'Invite link copied — share it with your students.'
            : <>Class code <strong>{copySnackbar.code}</strong> copied.</>}
        </Alert>
      </Snackbar>
    </PageContainer>
  );
}
