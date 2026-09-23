import { createBrowserRouter } from 'react-router';
import RootLayout from './layouts/RootLayout';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import ClassroomDetail from './pages/ClassroomDetail';
import ExamGenerator from './pages/ExamGenerator';
import ExamRepository from './pages/ExamRepository';
import ReviewerGenerator from './pages/ReviewerGenerator';
import Reviewer from './pages/Reviewer';
import TakeExam from './pages/TakeExam';
import ExamResults from './pages/ExamResults';
import QuestionBank from './pages/QuestionBank';
import Notifications from './pages/Notifications';
import Settings from './pages/Settings';
import Billing from './pages/Billing';
import Terms from './pages/Terms';
import StudyHub from './pages/StudyHub';

export const router = createBrowserRouter([
  // Public: must be readable before an account exists.
  { path: '/terms', Component: Terms },
  {
    path: '/',
    Component: RootLayout,
    children: [
      { index: true, Component: LoginPage },
      { path: 'dashboard', Component: Dashboard },
      { path: 'classroom/:classroomId', Component: ClassroomDetail },
      { path: 'exam-generator', Component: ExamGenerator },
      { path: 'exam-generator/:classroomId', Component: ExamGenerator },
      { path: 'exam-repository', Component: ExamRepository },
      // QuestionBank existed as a page but was never reachable — the sidebar links it now.
      { path: 'question-bank', Component: QuestionBank },
      { path: 'notifications', Component: Notifications },
      { path: 'settings', Component: Settings },
      { path: 'billing', Component: Billing },
      { path: 'reviewer-generator', Component: ReviewerGenerator },
      { path: 'reviewer', Component: Reviewer },
      { path: 'study', Component: StudyHub },
      { path: 'exam/:examId/take', Component: TakeExam },
      { path: 'exam/:examId/results', Component: ExamResults },
    ],
  },
]);
