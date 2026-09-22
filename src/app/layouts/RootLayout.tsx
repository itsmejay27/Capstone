import { Outlet, useNavigate, useLocation } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';
import { commentActivityFor, getCommentsSeenAt, unreadCount } from '../services/commentActivity';
import { Box } from '@mui/material';
import AppShell from '../components/shell/AppShell';

/**
 * Root layout.
 *
 * Owns the theme and the application shell. The shell provides the persistent left
 * navigation rail (a temporary drawer on mobile) and the top bar; individual pages render
 * into its content column and are responsible only for their own body.
 *
 * The login screen renders outside the shell — there is no navigation to show before a
 * user is authenticated.
 */
export default function RootLayout() {
  const {
    currentUser,
    users,
    logout,
    switchAccount,
    isAuthenticated,
    classrooms,
    exams,
    examAttempts,
    comments,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isInstructor = currentUser?.role === 'instructor';

  const userClassrooms = classrooms
    ? classrooms.filter((classroom: any) =>
        isInstructor
          ? classroom.instructorId === currentUser?.id
          : classroom.students?.includes(currentUser?.id || '')
      )
    : [];

  // A classroom invite link carries ?join=CODE. The redirect below rewrites the URL, so
  // the code is preserved across sign-in here and picked up again by the dashboard.
  useEffect(() => {
    const code = new URLSearchParams(location.search).get('join');
    if (code) {
      try { sessionStorage.setItem('pendingJoinCode', code); } catch { /* blocked storage */ }
    }
  }, [location.search]);

  useEffect(() => {
    if (!isAuthenticated && location.pathname !== '/') {
      navigate('/');
    } else if (isAuthenticated && location.pathname === '/') {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate, location.pathname]);

  /**
   * Badge count for the rail: work that actually needs the current user's attention.
   * Instructors see submissions awaiting review; students see published exams they have
   * not yet submitted.
   */
  // Re-read the "seen" marker when the notifications page clears it.
  const [seenAt, setSeenAt] = useState(() => getCommentsSeenAt(currentUser?.id));
  useEffect(() => {
    setSeenAt(getCommentsSeenAt(currentUser?.id));
    const onSeen = () => setSeenAt(getCommentsSeenAt(currentUser?.id));
    window.addEventListener('comments-seen', onSeen);
    return () => window.removeEventListener('comments-seen', onSeen);
  }, [currentUser?.id]);
  const unreadComments = unreadCount(commentActivityFor(currentUser, classrooms || [], comments || []), seenAt);

  const workCount = (() => {
    if (!currentUser) return 0;
    const myClassIds = new Set(userClassrooms.map((c: any) => c.id));
    const myExams = (exams || []).filter((e: any) => myClassIds.has(e.classroomId));
    if (isInstructor) {
      return (examAttempts || []).filter(
        (a: any) => a.submittedAt && myExams.some((e: any) => e.id === a.examId)
      ).length;
    }
    return myExams.filter((e: any) => {
      if (e.postDate && new Date(e.postDate) > new Date()) return false;
      return !(examAttempts || []).some(
        (a: any) => a.examId === e.id && a.studentId === currentUser.id && a.submittedAt
      );
    }).length;
  })();
  const notificationCount = workCount + unreadComments;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleSwitchAccount = (userId: string) => {
    switchAccount(userId);
    navigate('/dashboard');
  };

  return (
    <>
      {isAuthenticated ? (
        <AppShell
          currentUser={currentUser}
          users={users}
          classrooms={userClassrooms}
          isInstructor={isInstructor}
          onLogout={handleLogout}
          onSwitchAccount={handleSwitchAccount}
          notificationCount={notificationCount}
        >
          <Outlet />
        </AppShell>
      ) : (
        <Box sx={{ minHeight: '100vh' }}>
          <Outlet />
        </Box>
      )}
    </>
  );
}
