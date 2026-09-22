import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import { GOOGLE_CLIENT_ID } from '../config/authConfig';
import {
  Container,
  Paper,
  Button,
  Typography,
  Box,
  Alert,
  Avatar,
  Chip,
  ToggleButtonGroup,
  ToggleButton,
  IconButton,
  Dialog,
  DialogContent,
} from '@mui/material';
import {
  School,
  Login as LoginIcon,
  RecordVoiceOver,
  Person,
  AutoAwesome,
  Psychology,
  Analytics,
  Shield,
  Close as CloseIcon,
  MenuBook,
  Quiz,
  CheckCircle,
  Speed,
  HelpOutline,
  AssignmentTurnedIn,
  GroupAdd,
  AutoStories,
  Lightbulb,
} from '@mui/icons-material';

declare global {
  interface Window {
    google?: any;
  }
}

export default function LoginPage() {
  const [openLoginModal, setOpenLoginModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>('instructor');
  const [error, setError] = useState('');
  const [gsiLoaded, setGsiLoaded] = useState(false);
  const [activeWorkflowTab, setActiveWorkflowTab] = useState<'instructor' | 'student'>('instructor');

  const { login, loginWithGoogle, users } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const initGoogleGsi = () => {
      // Initialising with an empty client_id makes Google's iframe answer 400 and log
      // "Parameter client_id is not set correctly", leaving a button that cannot work.
      // Better to not render it at all and say why.
      if (!GOOGLE_CLIENT_ID) return;
      if (window.google?.accounts?.id && openLoginModal) {
        setGsiLoaded(true);
        try {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: (response: any) => {
              if (response?.credential) {
                const success = loginWithGoogle(response.credential, selectedRole);
                if (success) {
                  setOpenLoginModal(false);
                  navigate('/dashboard');
                } else {
                  setError('Failed to log in with Google account. Please try again.');
                }
              }
            },
          });

          const btnDiv = document.getElementById('googleGsiButtonModal');
          if (btnDiv) {
            btnDiv.innerHTML = '';
            window.google.accounts.id.renderButton(btnDiv, {
              theme: 'outline',
              size: 'large',
              width: 320,
              text: 'continue_with',
              shape: 'pill',
              logo_alignment: 'left',
              locale: 'en',
            });
          }
        } catch (e) {
          console.error('Google GSI initialization error:', e);
        }
      }
    };

    if (openLoginModal) {
      initGoogleGsi();
      const timer = setInterval(() => {
        if (window.google?.accounts?.id && !gsiLoaded) {
          initGoogleGsi();
        }
      }, 400);
      return () => clearInterval(timer);
    }
  }, [loginWithGoogle, navigate, selectedRole, gsiLoaded, openLoginModal]);

  const quickLogin = (userEmail: string, userPassword: string) => {
    if (login(userEmail, userPassword)) {
      setOpenLoginModal(false);
      navigate('/dashboard');
    }
  };

  const handleFallbackGoogleLogin = () => {
    setError('');
    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
    } else {
      setError('Google Sign-In service is loading. Please refresh if it does not load.');
    }
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const isInstructorRole = selectedRole === 'instructor';
  const roleGradient = isInstructorRole
    ? 'linear-gradient(135deg, #059669 0%, #0d9488 100%)'
    : 'linear-gradient(135deg, #0284c7 0%, #0d9488 100%)';
  const roleShadow = isInstructorRole
    ? '0 10px 25px rgba(16, 185, 129, 0.40)'
    : '0 10px 25px rgba(56, 189, 248, 0.40)';

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#ffffff', color: '#f8fafc', overflowX: 'hidden' }}>
      {/* ── 1. Top Navigation Bar ── */}
      <AppBarNav onOpenLogin={() => setOpenLoginModal(true)} onScrollTo={scrollToSection} />

      {/* ── 2. Hero Intro Banner Section ── */}
      <Box
        sx={{
          background: 'radial-gradient(circle at 50% 10%, #ecfdf5 0%, #f6f9fb 55%, #ffffff 100%)',
          pt: { xs: 8, md: 12 },
          pb: { xs: 8, md: 11 },
          px: 3,
          position: 'relative',
          overflow: 'hidden',
          textAlign: 'center',
        }}
      >
        <Box sx={{ position: 'absolute', top: -100, left: '25%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(5,150,105,0.13) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <Box sx={{ position: 'absolute', bottom: -100, right: '25%', width: 450, height: 450, borderRadius: '50%', background: 'radial-gradient(circle, rgba(13,148,136,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1.2,
              px: 2.5,
              py: 0.8,
              borderRadius: 10,
              bgcolor: '#ffffff',
              border: '1px solid #e8e8ed',
              backdropFilter: 'blur(10px)',
              mb: 3,
            }}
          >
            <School sx={{ color: '#047857', fontSize: 20 }} />
            <Typography variant="caption" sx={{ color: '#3f3f4d', fontWeight: 800, letterSpacing: '0.06em' }}>
              OCCIDENTAL MINDORO STATE COLLEGE &bull; CAPSTONE SYSTEM
            </Typography>
          </Box>

          <Typography
            variant="h2"
            sx={{
              fontWeight: 900,
              background: 'linear-gradient(120deg, #16161d 0%, #047857 55%, #0d9488 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: '-0.03em',
              lineHeight: 1.15,
              mb: 2.5,
              fontSize: { xs: '2.2rem', sm: '3rem', md: '3.8rem' },
              maxWidth: 950,
              mx: 'auto',
            }}
          >
            AI-Powered Examination & Classroom Management System
          </Typography>

          <Typography
            variant="h6"
            sx={{
              color: '#5c5c6b',
              fontSize: { xs: '1rem', md: '1.2rem' },
              fontWeight: 400,
              lineHeight: 1.6,
              mb: 4.5,
              maxWidth: 780,
              mx: 'auto',
            }}
          >
            Streamlining test composition, Bloom's Taxonomy difficulty alignment, smart study reviewers, and automated grade analytics for OMSC educators and students.
          </Typography>

          {/* Action CTA Buttons */}
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap', mb: 6 }}>
            <Button
              variant="contained"
              size="large"
              startIcon={<LoginIcon />}
              onClick={() => setOpenLoginModal(true)}
              sx={{
                background: 'linear-gradient(90deg, #059669 0%, #0d9488 100%)',
                color: '#ffffff',
                fontWeight: 800,
                px: 4,
                py: 1.6,
                borderRadius: 3,
                fontSize: '1.05rem',
                textTransform: 'none',
                boxShadow: '0 8px 30px rgba(16,185,129,0.4)',
                '&:hover': { filter: 'brightness(1.08)', transform: 'translateY(-2px)' },
              }}
            >
              Sign In to System Portal
            </Button>
            <Button
              variant="outlined"
              size="large"
              startIcon={<HelpOutline />}
              onClick={() => scrollToSection('how-it-works')}
              sx={{
                borderColor: '#dcdce3',
                color: '#3f3f4d',
                fontWeight: 700,
                px: 3.5,
                py: 1.6,
                borderRadius: 3,
                fontSize: '1rem',
                textTransform: 'none',
                backdropFilter: 'blur(8px)',
                '&:hover': { borderColor: 'white', bgcolor: '#ffffff' },
              }}
            >
              Learn How It Works
            </Button>
          </Box>

          {/* Even Grid for Hero Feature Pills */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
              gap: 2,
              maxWidth: 820,
              mx: 'auto',
            }}
          >
            <Paper elevation={0} sx={{ p: 2, borderRadius: 3, bgcolor: '#ffffff', border: '1px solid #e8e8ed', textAlign: 'center' }}>
              <Speed sx={{ color: '#047857', mb: 0.5, fontSize: 24 }} />
              <Typography variant="caption" sx={{ color: '#3f3f4d', fontWeight: 800, display: 'block' }}>15-Sec Generation</Typography>
            </Paper>
            <Paper elevation={0} sx={{ p: 2, borderRadius: 3, bgcolor: '#ffffff', border: '1px solid #e8e8ed', textAlign: 'center' }}>
              <Psychology sx={{ color: '#0284c7', mb: 0.5, fontSize: 24 }} />
              <Typography variant="caption" sx={{ color: '#3f3f4d', fontWeight: 800, display: 'block' }}>Bloom's Taxonomy</Typography>
            </Paper>
            <Paper elevation={0} sx={{ p: 2, borderRadius: 3, bgcolor: '#ffffff', border: '1px solid #e8e8ed', textAlign: 'center' }}>
              <Analytics sx={{ color: '#059669', mb: 0.5, fontSize: 24 }} />
              <Typography variant="caption" sx={{ color: '#3f3f4d', fontWeight: 800, display: 'block' }}>Auto Analytics</Typography>
            </Paper>
            <Paper elevation={0} sx={{ p: 2, borderRadius: 3, bgcolor: '#ffffff', border: '1px solid #e8e8ed', textAlign: 'center' }}>
              <Shield sx={{ color: '#fb923c', mb: 0.5, fontSize: 24 }} />
              <Typography variant="caption" sx={{ color: '#3f3f4d', fontWeight: 800, display: 'block' }}>Class Code Roster</Typography>
            </Paper>
          </Box>
        </Container>
      </Box>

      {/* ── 3. Section: About Our System ── */}
      <Box id="about" sx={{ py: 10, px: 3, bgcolor: '#ffffff', borderTop: '1px solid #e8e8ed' }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Chip label="ABOUT THE PLATFORM" size="small" sx={{ bgcolor: 'rgba(4,120,87,0.15)', color: '#047857', fontWeight: 800, mb: 1.5 }} />
            <Typography variant="h3" fontWeight={900} sx={{ color: '#16161d', letterSpacing: '-0.02em', mb: 2 }}>
              Revolutionizing Educational Assessments
            </Typography>
            <Typography variant="body1" sx={{ color: '#5c5c6b', maxWidth: 720, mx: 'auto', fontSize: '1.05rem', lineHeight: 1.6 }}>
              The OMSC AI-Generated Quiz Classroom is a specialized academic software built for Occidental Mindoro State College, designed to automate exam preparation and empower students with smart revision tools.
            </Typography>
          </Box>

          {/* Even 3-Column Grid */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
              gap: 3.5,
              width: '100%',
            }}
          >
            <Paper
              elevation={0}
              sx={{
                p: 4,
                borderRadius: 4,
                bgcolor: '#ffffff',
                border: '1px solid #e8e8ed',
                boxSizing: 'border-box',
                height: '100%',
              }}
            >
              <Box sx={{ width: 48, height: 48, borderRadius: 3, bgcolor: 'rgba(4,120,87,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2.5 }}>
                <RecordVoiceOver sx={{ color: '#047857', fontSize: 26 }} />
              </Box>
              <Typography variant="h6" fontWeight={800} sx={{ color: '#16161d', mb: 1.5 }}>
                For Educators & Instructors
              </Typography>
              <Typography variant="body2" sx={{ color: '#5c5c6b', lineHeight: 1.6 }}>
                Quickly input course topics or syllabus text to generate comprehensive examinations. Select question types (Multiple Choice, Identification, True/False, Essay) and configure Bloom's Taxonomy cognitive weights.
              </Typography>
            </Paper>

            <Paper
              elevation={0}
              sx={{
                p: 4,
                borderRadius: 4,
                bgcolor: '#ffffff',
                border: '1px solid #e8e8ed',
                boxSizing: 'border-box',
                height: '100%',
              }}
            >
              <Box sx={{ width: 48, height: 48, borderRadius: 3, bgcolor: 'rgba(5,150,105,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2.5 }}>
                <Person sx={{ color: '#0284c7', fontSize: 26 }} />
              </Box>
              <Typography variant="h6" fontWeight={800} sx={{ color: '#16161d', mb: 1.5 }}>
                For Enrolled Students
              </Typography>
              <Typography variant="body2" sx={{ color: '#5c5c6b', lineHeight: 1.6 }}>
                Join classrooms using unique instructor Class Codes. Generate personalized AI study reviewers, interactive flashcards, and summary notes per subject to prepare for official examinations.
              </Typography>
            </Paper>

            <Paper
              elevation={0}
              sx={{
                p: 4,
                borderRadius: 4,
                bgcolor: '#ffffff',
                border: '1px solid #e8e8ed',
                boxSizing: 'border-box',
                height: '100%',
              }}
            >
              <Box sx={{ width: 48, height: 48, borderRadius: 3, bgcolor: 'rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2.5 }}>
                <Psychology sx={{ color: '#059669', fontSize: 26 }} />
              </Box>
              <Typography variant="h6" fontWeight={800} sx={{ color: '#16161d', mb: 1.5 }}>
                AI Accuracy & Integrity
              </Typography>
              <Typography variant="body2" sx={{ color: '#5c5c6b', lineHeight: 1.6 }}>
                Powered by state-of-the-art AI, the engine guarantees academically sound questions, rationales, automatic grading with item analysis, and secure classroom code rosters.
              </Typography>
            </Paper>
          </Box>
        </Container>
      </Box>

      {/* ── 4. Section: How It Works (Even 4-Column Step Grid) ── */}
      <Box id="how-it-works" sx={{ py: 10, px: 3, bgcolor: '#0f172a', borderTop: '1px solid #e8e8ed' }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 5 }}>
            <Chip label="STEP-BY-STEP WORKFLOW" size="small" sx={{ bgcolor: 'rgba(56,189,248,0.15)', color: '#0284c7', fontWeight: 800, mb: 1.5 }} />
            <Typography variant="h3" fontWeight={900} sx={{ color: '#16161d', letterSpacing: '-0.02em', mb: 2 }}>
              How to Use the OMSC Platform
            </Typography>
            <Typography variant="body1" sx={{ color: '#5c5c6b', maxWidth: 650, mx: 'auto', fontSize: '1.05rem' }}>
              Select your role below to view the simple 4-step workflow.
            </Typography>

            {/* Workflow Switcher */}
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <ToggleButtonGroup
                value={activeWorkflowTab}
                exclusive
                onChange={(_, val) => val && setActiveWorkflowTab(val)}
                sx={{
                  bgcolor: '#ffffff',
                  p: 0.5,
                  borderRadius: 3,
                  border: '1px solid #e8e8ed',
                  '& .MuiToggleButton-root': {
                    color: '#5c5c6b',
                    px: 3.5,
                    py: 1,
                    fontWeight: 800,
                    fontSize: '0.9rem',
                    textTransform: 'none',
                    borderRadius: '10px !important',
                    border: 'none !important',
                  },
                  '& .Mui-selected': {
                    bgcolor: activeWorkflowTab === 'instructor' ? '#047857 !important' : '#059669 !important',
                    color: 'white !important',
                  },
                }}
              >
                <ToggleButton value="instructor">
                  <RecordVoiceOver sx={{ mr: 1, fontSize: 18 }} /> Instructor Workflow
                </ToggleButton>
                <ToggleButton value="student">
                  <Person sx={{ mr: 1, fontSize: 18 }} /> Student Workflow
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Box>

          {/* Even 4-Column Grid for Steps */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
              gap: 3,
              width: '100%',
            }}
          >
            {activeWorkflowTab === 'instructor' ? (
              <>
                <StepItem
                  step="01"
                  title="Create Classroom"
                  description="Click '+ Create Classroom' in your instructor dashboard. Enter your subject title and section to receive a unique Class Code."
                  icon={<GroupAdd sx={{ color: '#047857' }} />}
                />
                <StepItem
                  step="02"
                  title="Provide Course Topics"
                  description="Open the AI Exam Generator. Input your lecture topics, paste syllabus text, or upload reference files for the AI engine."
                  icon={<AutoStories sx={{ color: '#047857' }} />}
                />
                <StepItem
                  step="03"
                  title="Set Bloom's Taxonomy"
                  description="Select your target question distribution across Remembering, Understanding, Applying, and Analyzing cognitive levels."
                  icon={<Psychology sx={{ color: '#047857' }} />}
                />
                <StepItem
                  step="04"
                  title="Publish & Auto-Grade"
                  description="Publish the exam to your classroom. Enrolled students take the test online, and scores are automatically calculated with item analytics."
                  icon={<AssignmentTurnedIn sx={{ color: '#047857' }} />}
                />
              </>
            ) : (
              <>
                <StepItem
                  step="01"
                  title="Join with Class Code"
                  description="Log in as a student and click 'Join Classroom'. Enter the unique Class Code provided by your course instructor."
                  icon={<GroupAdd sx={{ color: '#0284c7' }} />}
                />
                <StepItem
                  step="02"
                  title="Generate AI Reviewers"
                  description="Generate smart study flashcards, key concept summaries, and self-quizzes to master your course subjects."
                  icon={<Lightbulb sx={{ color: '#0284c7' }} />}
                />
                <StepItem
                  step="03"
                  title="Take Online Exams"
                  description="Access active examinations published in your classroom. Complete timed assessments with clear question navigation."
                  icon={<Quiz sx={{ color: '#0284c7' }} />}
                />
                <StepItem
                  step="04"
                  title="Instant Results & Feedback"
                  description="View your score breakdown immediately upon submission, with question rationale explanations to boost retention."
                  icon={<CheckCircle sx={{ color: '#0284c7' }} />}
                />
              </>
            )}
          </Box>
        </Container>
      </Box>

      {/* ── 5. Section: Core Platform Capabilities (Perfect 3x2 Grid) ── */}
      <Box id="features" sx={{ py: 10, px: 3, bgcolor: '#ffffff', borderTop: '1px solid #e8e8ed' }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Chip label="CORE CAPABILITIES" size="small" sx={{ bgcolor: '#ecfdf5', color: '#059669', fontWeight: 800, mb: 1.5 }} />
            <Typography variant="h3" fontWeight={900} sx={{ color: '#16161d', letterSpacing: '-0.02em', mb: 2 }}>
              Built for Academic Excellence
            </Typography>
            <Typography variant="body1" sx={{ color: '#5c5c6b', maxWidth: 650, mx: 'auto', fontSize: '1.05rem' }}>
              Designed to meet Occidental Mindoro State College standards for examination accuracy and integrity.
            </Typography>
          </Box>

          {/* Even 3x2 CSS Grid for 6 Feature Cards */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
              gap: 3,
              width: '100%',
            }}
          >
            <FeatureItem
              title="Instant AI Question Generator"
              description="Supports Multiple Choice, Identification, True or False, and Essay question formats generated in seconds."
              icon={<AutoAwesome sx={{ color: '#047857' }} />}
            />
            <FeatureItem
              title="Bloom's Cognitive Taxonomy"
              description="Categorize questions from basic recall to complex problem-solving and critical evaluation."
              icon={<Psychology sx={{ color: '#0284c7' }} />}
            />
            <FeatureItem
              title="Smart Study Reviewers"
              description="Interactive flashcards, key concept summaries, and self-assessment tools generated for student revision."
              icon={<MenuBook sx={{ color: '#059669' }} />}
            />
            <FeatureItem
              title="Automated Grading & Analytics"
              description="Instant exam scoring, detailed item analysis, and class gradebook tracking for instructors."
              icon={<Analytics sx={{ color: '#fb923c' }} />}
            />
            <FeatureItem
              title="Secure Class Code Roster"
              description="Dedicated class codes ensure only authorized OMSC students can join specific course sections."
              icon={<Shield sx={{ color: '#f43f5e' }} />}
            />
            <FeatureItem
              title="Central Exam Repository"
              description="Save, manage, export, and republish past examinations across academic terms."
              icon={<Quiz sx={{ color: '#047857' }} />}
            />
          </Box>
        </Container>
      </Box>

      {/* ── 5b. Section: The numbers the system is built around ──
          These are the fixed parameters of the OMSC Table of Specifications workflow, not
          usage metrics — the platform is a capstone deployment, so inventing adoption
          figures here would be dishonest. */}
      <Box sx={{ py: { xs: 7, md: 9 }, px: 3, bgcolor: '#f6f6f8', borderTop: '1px solid #e8e8ed' }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 5 }}>
            <Chip label="BY THE NUMBERS" size="small" sx={{ bgcolor: '#ccfbf1', color: '#0f766e', fontWeight: 800, mb: 1.5 }} />
            <Typography variant="h3" fontWeight={900} sx={{ color: '#16161d', letterSpacing: '-0.02em' }}>
              What One Generation Run Produces
            </Typography>
          </Box>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
              gap: { xs: 2, md: 3 },
            }}
          >
            <LandingStat value="60" label="Items per exam" caption="Exactly as the TOS specifies" />
            <LandingStat value="3" label="Cognitive bands" caption="Remember · Apply · Evaluate" />
            <LandingStat value="4" label="Question formats" caption="MCQ, ID, True/False, Essay" />
            <LandingStat value="100%" label="TOS coverage" caption="Validated before release" />
          </Box>
        </Container>
      </Box>

      {/* ── 5c. Section: what each role gets ── */}
      <Box sx={{ py: { xs: 8, md: 10 }, px: 3, bgcolor: '#ffffff', borderTop: '1px solid #e8e8ed' }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Chip label="TWO PORTALS, ONE SYSTEM" size="small" sx={{ bgcolor: '#ecfdf5', color: '#047857', fontWeight: 800, mb: 1.5 }} />
            <Typography variant="h3" fontWeight={900} sx={{ color: '#16161d', letterSpacing: '-0.02em', mb: 2 }}>
              Made for Instructors and Students Alike
            </Typography>
            <Typography variant="body1" sx={{ color: '#5c5c6b', maxWidth: 680, mx: 'auto', fontSize: '1.05rem' }}>
              The same class roster drives both sides — an exam an instructor publishes is the
              exam a student sits, and the results flow straight back into the gradebook.
            </Typography>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
            <RoleCard
              accent="#10b981"
              icon={<RecordVoiceOver sx={{ color: '#047857', fontSize: 26 }} />}
              title="For Instructors"
              points={[
                'Upload a Table of Specifications and generate a compliant exam',
                'Review, edit and bank individual items before publishing',
                'Print exams in OMSC letterhead format, A4 or Letter',
                'Read item analysis: difficulty index and distractor performance',
                'Post announcements, classwork and materials to a class stream',
              ]}
            />
            <RoleCard
              accent="#22d3ee"
              icon={<Person sx={{ color: '#0f766e', fontSize: 26 }} />}
              title="For Students"
              points={[
                'Join a section with the class code your instructor shares',
                'Sit published exams with an on-screen timer and autosave',
                'Generate study reviewers and flashcards from course material',
                'See scores and per-topic breakdowns as soon as grading finishes',
                'Track upcoming classwork and due dates in one feed',
              ]}
            />
          </Box>
        </Container>
      </Box>

      {/* ── 5d. Section: FAQ ── */}
      <Box id="faq" sx={{ py: { xs: 8, md: 10 }, px: 3, bgcolor: '#f6f6f8', borderTop: '1px solid #e8e8ed' }}>
        <Container maxWidth="md">
          <Box sx={{ textAlign: 'center', mb: 5 }}>
            <Chip label="QUESTIONS" size="small" sx={{ bgcolor: '#fef3c7', color: '#b45309', fontWeight: 800, mb: 1.5 }} />
            <Typography variant="h3" fontWeight={900} sx={{ color: '#16161d', letterSpacing: '-0.02em' }}>
              Frequently Asked
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <FaqItem
              question="Does the generated exam actually follow my Table of Specifications?"
              answer="Yes. The uploaded TOS is parsed into a per-topic, per-cognitive-level item count, and the generated set is validated against that matrix before it is shown to you. If a band comes up short, the system regenerates the missing items rather than padding the exam with whatever the model produced."
            />
            <FaqItem
              question="Which AI engine does it use?"
              answer="It supports Google Gemini and NVIDIA NIM as cloud engines, and Ollama for a locally hosted model. The engine is chosen per generation run, so a class can fall back to a different one without losing its exam history."
            />
            <FaqItem
              question="Can I edit the questions before publishing?"
              answer="Every generated item is editable — stem, options, correct answer and cognitive tag. You can also drop an item and pull a replacement from the Question Bank, or save a good item back into the bank for reuse next term."
            />
            <FaqItem
              question="How do students get into my class?"
              answer="Each class has a unique code. A student enters that code once to join the section, and from then on sees only the exams, materials and announcements you publish to it."
            />
            <FaqItem
              question="Can exams be printed for a paper-based sitting?"
              answer="Yes. The printable view lays the exam out on A4 or Letter with the OMSC header, an answer-sheet grid and a separate answer key, so the same generated exam works online or on paper."
            />
          </Box>
        </Container>
      </Box>

      {/* ── 6. Bottom Call-To-Action (CTA) Banner ── */}
      <Box
        sx={{
          py: 10,
          px: 3,
          background: 'linear-gradient(135deg, #022c22 0%, #064e3b 50%, #047857 100%)',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{ width: 64, height: 64, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2.5, backdropFilter: 'blur(10px)' }}>
            <School sx={{ fontSize: 36, color: 'white' }} />
          </Box>
          <Typography variant="h3" fontWeight={900} sx={{ color: '#16161d', letterSpacing: '-0.02em', mb: 2, fontSize: { xs: '2rem', md: '2.8rem' } }}>
            Ready to Access the OMSC AI Portal?
          </Typography>
          <Typography variant="body1" sx={{ color: '#a7f3d0', fontSize: '1.1rem', mb: 4, maxWidth: 600, mx: 'auto' }}>
            Click below to sign in with your Instructor or Student account, join classrooms, and generate AI exams.
          </Typography>

          <Button
            variant="contained"
            size="large"
            startIcon={<LoginIcon />}
            onClick={() => setOpenLoginModal(true)}
            sx={{
              bgcolor: '#ffffff',
              color: '#064e3b',
              fontWeight: 900,
              px: 4.5,
              py: 1.8,
              borderRadius: 3.5,
              fontSize: '1.1rem',
              textTransform: 'none',
              boxShadow: '0 10px 35px rgba(0,0,0,0.3)',
              '&:hover': { bgcolor: '#f8fafc', transform: 'translateY(-2px)' },
            }}
          >
            Sign In to OMSC Account
          </Button>
        </Container>
      </Box>

      {/* ── 7. Footer ── */}
      <Box sx={{ py: 4, px: 3, bgcolor: '#f2f2f5', textAlign: 'center', borderTop: '1px solid #e8e8ed' }}>
        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
          &copy; {new Date().getFullYear()} Occidental Mindoro State College &bull; AI Examination Platform Capstone Project
        </Typography>
      </Box>

      {/* ── 8. SIGN IN POPUP DIALOG (GOOGLE SIGN-IN ONLY + QUICK DEMO) ── */}
      <Dialog
        open={openLoginModal}
        onClose={() => setOpenLoginModal(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 4,
            p: 1,
            bgcolor: '#ffffff',
            border: '1px solid #e8e8ed',
            backgroundImage: 'none',
            boxShadow: '0 25px 70px rgba(0,0,0,0.65)',
          },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1 }}>
          <IconButton size="small" onClick={() => setOpenLoginModal(false)}>
            <CloseIcon />
          </IconButton>
        </Box>

        <DialogContent sx={{ pt: 0, px: 3, pb: 3 }}>
          {/* Header */}
          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Box
              sx={{
                width: 58,
                height: 58,
                borderRadius: 3.5,
                background: roleGradient,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 1.5,
                boxShadow: roleShadow,
              }}
            >
              <School sx={{ fontSize: 32, color: '#ffffff' }} />
            </Box>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 900, color: '#16161d', letterSpacing: '-0.02em' }}>
              OMSC AI Classroom
            </Typography>
            <Typography variant="caption" sx={{ color: '#5c5c6b', fontWeight: 700, mt: 0.3, display: 'block' }}>
              Occidental Mindoro State College Examination Portal
            </Typography>
          </Box>

          {/* Role Switcher */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="caption" sx={{ fontWeight: 800, color: '#5c5c6b', mb: 1, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.68rem' }}>
              Select Login Role
            </Typography>
            <ToggleButtonGroup
              value={selectedRole}
              exclusive
              onChange={(_, newRole) => {
                if (newRole) setSelectedRole(newRole);
              }}
              size="small"
              sx={{
                width: '100%',
                bgcolor: '#fafafb',
                p: 0.5,
                borderRadius: 3,
                border: '1px solid #e8e8ed',
                '& .MuiToggleButton-root': {
                  flex: 1,
                  py: 1.1,
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  textTransform: 'none',
                  borderRadius: '10px !important',
                  border: 'none !important',
                  color: '#5c5c6b',
                },
                '& .Mui-selected': {
                  background: `${roleGradient} !important`,
                  color: '#ffffff !important',
                  boxShadow: '0 3px 10px rgba(0,0,0,0.15)',
                },
              }}
            >
              <ToggleButton value="instructor">
                <RecordVoiceOver sx={{ mr: 0.8, fontSize: 16 }} /> Instructor
              </ToggleButton>
              <ToggleButton value="student">
                <Person sx={{ mr: 0.8, fontSize: 16 }} /> Student
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2, py: 0.5, borderRadius: 2, fontSize: '0.8rem', fontWeight: 600 }}>
              {error}
            </Alert>
          )}

          {/* English Google Sign-In Container */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
            {!GOOGLE_CLIENT_ID ? (
              <Alert severity="info" sx={{ width: '100%', borderRadius: 2, fontSize: '0.8rem' }}>
                Google Sign-In is not configured. Set <strong>VITE_GOOGLE_CLIENT_ID</strong> to enable it —
                use the demo accounts below in the meantime.
              </Alert>
            ) : (
              <>
            <div id="googleGsiButtonModal" style={{ minHeight: 44, display: 'flex', justifyContent: 'center', width: '100%' }}></div>
            {!gsiLoaded && (
              <Button
                variant="outlined"
                onClick={handleFallbackGoogleLogin}
                fullWidth
                startIcon={
                  <svg width="20" height="20" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.29v3.15C3.26 21.3 7.31 24 12 24z" />
                    <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.29C.47 8.21 0 10.05 0 12s.47 3.79 1.29 5.42l3.99-3.15z" />
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.58l3.99 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
                  </svg>
                }
                sx={{
                  py: 1.3,
                  borderRadius: 3,
                  borderColor: '#dcdce3',
                  color: '#16161d',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  textTransform: 'none',
                  '&:hover': { bgcolor: '#fafafb', borderColor: '#8e8e9e' },
                }}
              >
                Continue with Google
              </Button>
            )}
              </>
            )}
          </Box>

          {/* Quick Demo Sign-In Bar */}
          <Box sx={{ pt: 2.5, borderTop: '1px dashed #e8e8ed' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: '#5c5c6b', display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.72rem' }}>
                <AutoAwesome sx={{ fontSize: 14, color: '#059669' }} /> Quick Demo Sign-In
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                Click to auto-login
              </Typography>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
              {users.map((u) => {
                const isInstructorUser = u.role === 'instructor';
                return (
                  <Paper
                    key={u.id}
                    variant="outlined"
                    onClick={() => {
                      setSelectedRole(u.role);
                      quickLogin(u.email, u.password || 'instructor123');
                    }}
                    sx={{
                      p: 1,
                      borderRadius: 2.5,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.2,
                      bgcolor: '#fafafb',
                      borderColor: '#e8e8ed',
                      transition: 'all 0.15s ease',
                      '&:hover': {
                        borderColor: isInstructorUser ? '#10b981' : '#38bdf8',
                        bgcolor: isInstructorUser ? '#ecfdf5' : '#e0f2fe',
                        transform: 'translateY(-1px)',
                      },
                    }}
                  >
                    <Avatar
                      src={u.avatar}
                      sx={{
                        width: 28,
                        height: 28,
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        bgcolor: isInstructorUser ? '#047857' : '#0284c7',
                        color: '#ffffff',
                      }}
                    >
                      {u.name.charAt(0)}
                    </Avatar>
                    <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                      <Typography variant="caption" noWrap sx={{ fontWeight: 800, color: '#16161d', display: 'block', fontSize: '0.72rem', lineHeight: 1.1 }}>
                        {u.name.split(' ')[0]}
                      </Typography>
                      <Chip
                        label={u.role}
                        size="small"
                        sx={{
                          height: 15,
                          fontSize: '0.55rem',
                          fontWeight: 800,
                          bgcolor: isInstructorUser ? '#d1fae5' : '#e0f2fe',
                          color: isInstructorUser ? '#065f46' : '#075985',
                          p: 0,
                          mt: 0.2,
                        }}
                      />
                    </Box>
                  </Paper>
                );
              })}
            </Box>
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}

{/* Helper Subcomponents */}
function AppBarNav({ onOpenLogin, onScrollTo }: { onOpenLogin: () => void; onScrollTo: (id: string) => void }) {
  return (
    <Box
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        bgcolor: 'rgba(255, 255, 255, 0.88)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        py: 1.5,
        px: { xs: 2, sm: 4 },
      }}
    >
      <Container maxWidth="xl">
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer' }} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <Box sx={{ width: 38, height: 38, borderRadius: 2.5, background: 'linear-gradient(135deg, #059669 0%, #0d9488 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', fontWeight: 900 }}>
              <School sx={{ fontSize: 22 }} />
            </Box>
            <Box>
              <Typography variant="subtitle1" fontWeight={900} sx={{ color: '#16161d', lineHeight: 1.1, letterSpacing: '-0.01em' }}>
                OMSC AI Classroom
              </Typography>
              <Typography variant="caption" sx={{ color: '#5c5c6b', fontSize: '0.65rem' }}>
                Occidental Mindoro State College
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 3.5 }}>
            <Typography variant="body2" onClick={() => onScrollTo('about')} sx={{ color: '#3f3f4d', fontWeight: 600, cursor: 'pointer', '&:hover': { color: 'white' } }}>
              About System
            </Typography>
            <Typography variant="body2" onClick={() => onScrollTo('how-it-works')} sx={{ color: '#3f3f4d', fontWeight: 600, cursor: 'pointer', '&:hover': { color: 'white' } }}>
              How It Works
            </Typography>
            <Typography variant="body2" onClick={() => onScrollTo('features')} sx={{ color: '#3f3f4d', fontWeight: 600, cursor: 'pointer', '&:hover': { color: 'white' } }}>
              Features
            </Typography>
            <Typography variant="body2" onClick={() => onScrollTo('faq')} sx={{ color: '#3f3f4d', fontWeight: 600, cursor: 'pointer', '&:hover': { color: 'white' } }}>
              FAQ
            </Typography>
          </Box>

          <Button
            variant="contained"
            startIcon={<LoginIcon />}
            onClick={onOpenLogin}
            sx={{
              background: 'linear-gradient(90deg, #059669 0%, #0d9488 100%)',
              color: '#ffffff',
              fontWeight: 800,
              borderRadius: 2.5,
              px: 2.5,
              py: 0.8,
              fontSize: '0.85rem',
              textTransform: 'none',
              boxShadow: '0 4px 14px rgba(16,185,129,0.34)',
              '&:hover': { filter: 'brightness(1.08)', boxShadow: '0 6px 20px rgba(16,185,129,0.45)' },
            }}
          >
            Sign In / Register
          </Button>
        </Box>
      </Container>
    </Box>
  );
}

function StepItem({ step, title, description, icon }: { step: string; title: string; description: string; icon: React.ReactNode }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 3.5,
        bgcolor: '#ffffff',
        border: '1px solid #e8e8ed',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: 2.5, bgcolor: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </Box>
        <Typography variant="h6" fontWeight={900} sx={{ color: 'rgba(255,255,255,0.2)', fontSize: '1.2rem' }}>
          {step}
        </Typography>
      </Box>
      <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#16161d', mb: 1 }}>
        {title}
      </Typography>
      <Typography variant="caption" sx={{ color: '#5c5c6b', lineHeight: 1.5, display: 'block' }}>
        {description}
      </Typography>
    </Paper>
  );
}

/** A single figure in the "by the numbers" band, capped by the brand gradient rule. */
function LandingStat({ value, label, caption }: { value: string; label: string; caption: string }) {
  return (
    <Paper
      elevation={0}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        p: { xs: 2.25, md: 3 },
        borderRadius: 3.5,
        bgcolor: '#ffffff',
        border: '1px solid #e8e8ed',
        textAlign: 'center',
        height: '100%',
        boxSizing: 'border-box',
        '&::before': {
          content: '""',
          position: 'absolute',
          insetInline: 0,
          top: 0,
          height: 2,
          background: 'linear-gradient(90deg, #059669 0%, #0d9488 100%)',
        },
      }}
    >
      <Typography
        sx={{
          fontWeight: 900,
          fontSize: { xs: '2.1rem', md: '2.7rem' },
          lineHeight: 1.1,
          letterSpacing: '-0.03em',
          background: 'linear-gradient(90deg, #059669 0%, #0d9488 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        {value}
      </Typography>
      <Typography variant="subtitle2" sx={{ color: '#16161d', fontWeight: 800, mt: 0.5 }}>
        {label}
      </Typography>
      <Typography variant="caption" sx={{ color: '#5c5c6b', display: 'block', mt: 0.5, lineHeight: 1.45 }}>
        {caption}
      </Typography>
    </Paper>
  );
}

/** One half of the instructor/student split, listing what that role can actually do. */
function RoleCard({
  accent,
  icon,
  title,
  points,
}: {
  accent: string;
  icon: React.ReactNode;
  title: string;
  points: string[];
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        p: { xs: 3, md: 3.5 },
        borderRadius: 3.5,
        bgcolor: '#ffffff',
        border: '1px solid #e8e8ed',
        height: '100%',
        boxSizing: 'border-box',
        '&::before': {
          content: '""',
          position: 'absolute',
          insetInline: 0,
          top: 0,
          height: 3,
          background: `linear-gradient(90deg, ${accent} 0%, transparent 100%)`,
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75, mb: 2.5 }}>
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: 3,
            flexShrink: 0,
            bgcolor: '#ffffff',
            border: `1px solid ${accent}44`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </Box>
        <Typography variant="h6" fontWeight={900} sx={{ color: '#16161d', letterSpacing: '-0.01em' }}>
          {title}
        </Typography>
      </Box>

      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {points.map((point) => (
          <Box component="li" key={point} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
            <CheckCircle sx={{ color: accent, fontSize: 18, mt: '2px', flexShrink: 0 }} />
            <Typography variant="body2" sx={{ color: '#3f3f4d', lineHeight: 1.55 }}>
              {point}
            </Typography>
          </Box>
        ))}
      </Box>
    </Paper>
  );
}

/**
 * A disclosure row in the FAQ. Uses a native <details> so the section stays keyboard
 * accessible and readable with JavaScript disabled, rather than an MUI Accordion whose
 * open state would need managing.
 */
function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <Box
      component="details"
      sx={{
        borderRadius: 3,
        bgcolor: '#ffffff',
        border: '1px solid #e8e8ed',
        px: { xs: 2, md: 2.75 },
        py: 1.75,
        transition: 'border-color .2s ease',
        '&[open]': { borderColor: '#a7f3d0' },
        '&[open] .faq-marker': { transform: 'rotate(45deg)' },
      }}
    >
      <Box
        component="summary"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          cursor: 'pointer',
          listStyle: 'none',
          '&::-webkit-details-marker': { display: 'none' },
        }}
      >
        <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#16161d', flex: 1 }}>
          {question}
        </Typography>
        <Box
          className="faq-marker"
          sx={{
            width: 20,
            height: 20,
            flexShrink: 0,
            position: 'relative',
            transition: 'transform .2s ease',
            color: '#047857',
            '&::before, &::after': {
              content: '""',
              position: 'absolute',
              background: 'currentColor',
              borderRadius: 1,
            },
            '&::before': { left: 0, right: 0, top: 9, height: 2 },
            '&::after': { top: 0, bottom: 0, left: 9, width: 2 },
          }}
        />
      </Box>
      <Typography variant="body2" sx={{ color: '#5c5c6b', lineHeight: 1.65, mt: 1.75, pr: { md: 4 } }}>
        {answer}
      </Typography>
    </Box>
  );
}

function FeatureItem({ title, description, icon }: { title: string; description: string; icon: React.ReactNode }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        borderRadius: 3.5,
        bgcolor: '#ffffff',
        border: '1px solid #e8e8ed',
        height: '100%',
        boxSizing: 'border-box',
        transition: 'transform 0.2s ease, border-color 0.2s ease',
        '&:hover': { transform: 'translateY(-3px)', borderColor: '#dcdce3' },
      }}
    >
      <Box sx={{ width: 42, height: 42, borderRadius: 2.5, bgcolor: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
        {icon}
      </Box>
      <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#16161d', mb: 1 }}>
        {title}
      </Typography>
      <Typography variant="caption" sx={{ color: '#5c5c6b', lineHeight: 1.5, display: 'block' }}>
        {description}
      </Typography>
    </Paper>
  );
}
