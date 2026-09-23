import { Outlet, useNavigate, useLocation } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';
import { commentActivityFor, getCommentsSeenAt, unreadCount } from '../services/commentActivity';
import { useDeviceTrusted } from '../services/deviceTrust';
import { hasAcceptedTermsLocally, rememberTermsAccepted, saveAccount } from '../services/savedAccounts';
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
    accountSyncing,
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

  // A new account must confirm its email before it can use the app. Read the flag from the
  // users list too, since a background refresh may already have the server's answer.
  // Verification happens in the sign-in dialog on the landing page, so an unverified
  // account is kept on '/' instead of being sent into the app.
  const me = currentUser ? users.find((u: any) => u.id === currentUser.id) || currentUser : null;
  const emailUnverified = Boolean(isAuthenticated && me && me.emailVerified === false && currentUser?.emailVerified !== true);
  // A new device or browser must be confirmed with an emailed code too.
  const deviceTrusted = useDeviceTrusted(me?.email);
  const termsNeeded = Boolean(isAuthenticated && me && !accountSyncing && !me.termsAcceptedAt && !currentUser?.termsAcceptedAt && !hasAcceptedTermsLocally(me.id));
  const needsVerification = emailUnverified || Boolean(isAuthenticated && me && !deviceTrusted) || termsNeeded;

  // Remember an account on this device once it is fully signed in, so the switcher can
  // return to it later without another code.
  useEffect(() => {
    if (isAuthenticated && me && !needsVerification && !accountSyncing) {
      saveAccount(me.id);
      if (me.termsAcceptedAt) rememberTermsAccepted(me.id);
    }
  }, [isAuthenticated, me?.id, me?.termsAcceptedAt, needsVerification, accountSyncing]);

  // While the profile is still loading, stay put instead of flashing a gate or bouncing.
  useEffect(() => {
    if (accountSyncing && isAuthenticated) return;
    if ((!isAuthenticated || needsVerification) && location.pathname !== '/') {
      navigate('/');
    } else if (isAuthenticated && !needsVerification && location.pathname === '/') {
      navigate('/dashboard');
    }
  }, [isAuthenticated, needsVerification, accountSyncing, navigate, location.pathname]);

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
      {isAuthenticated && !needsVerification ? (
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
