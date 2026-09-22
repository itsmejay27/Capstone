import { useState, useEffect, useRef } from 'react';
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
  TextField,
  InputAdornment,
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
  Visibility,
  VisibilityOff,
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { login, loginWithGoogle, users } = useAuth();
  const navigate = useNavigate();

  // Google's library must be initialised exactly once per page load; calling initialize()
  // again (on every re-render or role change) is what logged the GSI "called multiple
  // times" warning and could drop the callback. The callback reads the latest role and
  // handlers through a ref, so one initialisation stays correct.
  const googleCallbackRef = useRef<(response: any) => void>(() => {});
  googleCallbackRef.current = (response: any) => {
    if (!response?.credential) {
      setError('Google did not return a sign-in credential. Please try again.');
      return;
    }
    if (loginWithGoogle(response.credential, selectedRole)) {
      setError('');
      setOpenLoginModal(false);
      navigate('/dashboard');
    } else {
      setError('Failed to log in with Google account. Please try again.');
    }
  };

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !openLoginModal) return;

    const renderGoogleButton = (): boolean => {
      const gsi = window.google?.accounts?.id;
      const btnDiv = document.getElementById('googleGsiButtonModal');
      if (!gsi || !btnDiv) return false;
      try {
        if (!(window as any).__omscGsiInitialized) {
          gsi.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: (response: any) => googleCallbackRef.current(response),
            ux_mode: 'popup',
            auto_select: false,
            cancel_on_tap_outside: true,
          });
          (window as any).__omscGsiInitialized = true;
        }
        btnDiv.innerHTML = '';
        gsi.renderButton(btnDiv, {
          theme: 'outline',
          size: 'large',
          width: 320,
          text: 'continue_with',
          shape: 'pill',
          logo_alignment: 'left',
          locale: 'en',
        });
        setGsiLoaded(true);
      } catch (e) {
        console.error('Google GSI initialization error:', e);
      }
      return true;
    };

    // The GSI script loads async and the dialog mounts after this effect, so retry briefly.
    if (renderGoogleButton()) return;
    const timer = window.setInterval(() => {
      if (renderGoogleButton()) window.clearInterval(timer);
    }, 300);
    return () => window.clearInterval(timer);
  }, [openLoginModal]);

  const quickLogin = (userEmail: string, userPassword: string) => {
    if (login(userEmail, userPassword)) {
      setOpenLoginModal(false);
      navigate('/dashboard');
    }
  };

  /**
   * Email + password sign-in. `login` is synchronous and returns false for both an unknown
   * email and a wrong password; the message stays deliberately vague about which, so the
   * form cannot be used to enumerate registered accounts.
   */
  const handleCredentialLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setSubmitting(true);
    const ok = login(email.trim(), password);
    setSubmitting(false);
    if (ok) {
      setPassword('');
      setOpenLoginModal(false);
      navigate('/dashboard');
    } else {
      setError('That email and password do not match an account.');
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
    ? 'linear-gradient(135deg, var(--c-emerald-600) 0%, var(--c-teal-600) 100%)'
    : 'linear-gradient(135deg, var(--c-sky-600) 0%, var(--c-teal-600) 100%)';
  const roleShadow = isInstructorRole
    ? '0 10px 25px rgba(16, 185, 129, 0.40)'
    : '0 10px 25px rgba(56, 189, 248, 0.40)';

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'var(--c-surface)', color: 'var(--c-slate-50)', overflowX: 'hidden' }}>
      {/* ── 1. Top Navigation Bar ── */}
      <AppBarNav onOpenLogin={() => setOpenLoginModal(true)} onScrollTo={scrollToSection} />

      {/* ── 2. Hero Intro Banner Section ── */}
      <Box
        sx={{
          background: 'radial-gradient(circle at 50% 10%, var(--c-emerald-50) 0%, var(--c-canvas) 55%, var(--c-surface) 100%)',
          pt: { xs: 8, md: 12 },
          pb: { xs: 8, md: 11 },
          px: 3,
          position: 'relative',
          overflow: 'hidden',
          textAlign: 'center',
        }}
      >
        <Box sx={{ position: 'absolute', top: -100, left: '25%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, var(--glow-a) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <Box sx={{ position: 'absolute', bottom: -100, right: '25%', width: 450, height: 450, borderRadius: '50%', background: 'radial-gradient(circle, var(--glow-b) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1.2,
              px: 2.5,
              py: 0.8,
              borderRadius: 10,
              bgcolor: 'var(--c-surface)',
              border: '1px solid var(--c-border)',
              backdropFilter: 'blur(10px)',
              mb: 3,
            }}
          >
            <School sx={{ color: 'var(--c-emerald-700)', fontSize: 20 }} />
            <Typography variant="caption" sx={{ color: 'var(--c-slate-700)', fontWeight: 800, letterSpacing: '0.06em' }}>
              OCCIDENTAL MINDORO STATE COLLEGE &bull; CAPSTONE SYSTEM
            </Typography>
          </Box>

          <Typography
            variant="h2"
            sx={{
              fontWeight: 900,
              background: 'linear-gradient(120deg, var(--c-ink) 0%, var(--c-emerald-700) 55%, var(--c-teal-600) 100%)',
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
              color: 'var(--c-ink-secondary)',
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
                background: 'linear-gradient(90deg, var(--c-emerald-600) 0%, var(--c-teal-600) 100%)',
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
                borderColor: 'var(--c-border-strong)',
                color: 'var(--c-slate-700)',
                fontWeight: 700,
                px: 3.5,
                py: 1.6,
                borderRadius: 3,
                fontSize: '1rem',
                textTransform: 'none',
                backdropFilter: 'blur(8px)',
                '&:hover': { borderColor: 'var(--c-border-strong)', bgcolor: 'var(--c-surface-muted)' },
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
            <Paper elevation={0} sx={{ p: 2, borderRadius: 3, bgcolor: 'var(--c-surface)', border: '1px solid var(--c-border)', textAlign: 'center' }}>
              <Speed sx={{ color: 'var(--c-emerald-700)', mb: 0.5, fontSize: 24 }} />
              <Typography variant="caption" sx={{ color: 'var(--c-slate-700)', fontWeight: 800, display: 'block' }}>15-Sec Generation</Typography>
            </Paper>
            <Paper elevation={0} sx={{ p: 2, borderRadius: 3, bgcolor: 'var(--c-surface)', border: '1px solid var(--c-border)', textAlign: 'center' }}>
              <Psychology sx={{ color: 'var(--c-sky-600)', mb: 0.5, fontSize: 24 }} />
              <Typography variant="caption" sx={{ color: 'var(--c-slate-700)', fontWeight: 800, display: 'block' }}>Bloom's Taxonomy</Typography>
            </Paper>
            <Paper elevation={0} sx={{ p: 2, borderRadius: 3, bgcolor: 'var(--c-surface)', border: '1px solid var(--c-border)', textAlign: 'center' }}>
              <Analytics sx={{ color: 'var(--c-emerald-600)', mb: 0.5, fontSize: 24 }} />
              <Typography variant="caption" sx={{ color: 'var(--c-slate-700)', fontWeight: 800, display: 'block' }}>Auto Analytics</Typography>
            </Paper>
            <Paper elevation={0} sx={{ p: 2, borderRadius: 3, bgcolor: 'var(--c-surface)', border: '1px solid var(--c-border)', textAlign: 'center' }}>
              <Shield sx={{ color: 'var(--c-orange-400)', mb: 0.5, fontSize: 24 }} />
              <Typography variant="caption" sx={{ color: 'var(--c-slate-700)', fontWeight: 800, display: 'block' }}>Class Code Roster</Typography>
            </Paper>
          </Box>
        </Container>
      </Box>

      {/* ── 3. Section: About Our System ── */}
      <Box id="about" sx={{ py: 10, px: 3, bgcolor: 'var(--c-surface)', borderTop: '1px solid var(--c-border)' }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Chip label="ABOUT THE PLATFORM" size="small" sx={{ bgcolor: 'rgba(4,120,87,0.15)', color: 'var(--c-emerald-700)', fontWeight: 800, mb: 1.5 }} />
            <Typography variant="h3" fontWeight={900} sx={{ color: 'var(--c-ink)', letterSpacing: '-0.02em', mb: 2 }}>
              Revolutionizing Educational Assessments
            </Typography>
            <Typography variant="body1" sx={{ color: 'var(--c-ink-secondary)', maxWidth: 720, mx: 'auto', fontSize: '1.05rem', lineHeight: 1.6 }}>
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
                bgcolor: 'var(--c-surface)',
                border: '1px solid var(--c-border)',
                boxSizing: 'border-box',
                height: '100%',
              }}
            >
              <Box sx={{ width: 48, height: 48, borderRadius: 3, bgcolor: 'rgba(4,120,87,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2.5 }}>
                <RecordVoiceOver sx={{ color: 'var(--c-emerald-700)', fontSize: 26 }} />
              </Box>
              <Typography variant="h6" fontWeight={800} sx={{ color: 'var(--c-ink)', mb: 1.5 }}>
                For Educators & Instructors
              </Typography>
              <Typography variant="body2" sx={{ color: 'var(--c-ink-secondary)', lineHeight: 1.6 }}>
                Quickly input course topics or syllabus text to generate comprehensive examinations. Select question types (Multiple Choice, Identification, True/False, Essay) and configure Bloom's Taxonomy cognitive weights.
              </Typography>
            </Paper>

            <Paper
              elevation={0}
              sx={{
                p: 4,
                borderRadius: 4,
                bgcolor: 'var(--c-surface)',
                border: '1px solid var(--c-border)',
                boxSizing: 'border-box',
                height: '100%',
              }}
            >
              <Box sx={{ width: 48, height: 48, borderRadius: 3, bgcolor: 'rgba(5,150,105,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2.5 }}>
                <Person sx={{ color: 'var(--c-sky-600)', fontSize: 26 }} />
              </Box>
              <Typography variant="h6" fontWeight={800} sx={{ color: 'var(--c-ink)', mb: 1.5 }}>
                For Enrolled Students
              </Typography>
              <Typography variant="body2" sx={{ color: 'var(--c-ink-secondary)', lineHeight: 1.6 }}>
                Join classrooms using unique instructor Class Codes. Generate personalized AI study reviewers, interactive flashcards, and summary notes per subject to prepare for official examinations.
              </Typography>
            </Paper>

            <Paper
              elevation={0}
              sx={{
                p: 4,
                borderRadius: 4,
                bgcolor: 'var(--c-surface)',
                border: '1px solid var(--c-border)',
                boxSizing: 'border-box',
                height: '100%',
              }}
            >
              <Box sx={{ width: 48, height: 48, borderRadius: 3, bgcolor: 'rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2.5 }}>
                <Psychology sx={{ color: 'var(--c-emerald-600)', fontSize: 26 }} />
              </Box>
              <Typography variant="h6" fontWeight={800} sx={{ color: 'var(--c-ink)', mb: 1.5 }}>
                AI Accuracy & Integrity
              </Typography>
              <Typography variant="body2" sx={{ color: 'var(--c-ink-secondary)', lineHeight: 1.6 }}>
                Powered by state-of-the-art AI, the engine guarantees academically sound questions, rationales, automatic grading with item analysis, and secure classroom code rosters.
              </Typography>
            </Paper>
          </Box>
        </Container>
      </Box>

      {/* ── 4. Section: How It Works (Even 4-Column Step Grid) ── */}
      <Box id="how-it-works" sx={{ py: 10, px: 3, bgcolor: 'var(--c-banner-from)', borderTop: '1px solid var(--c-border)' }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 5 }}>
            <Chip label="STEP-BY-STEP WORKFLOW" size="small" sx={{ bgcolor: 'rgba(56,189,248,0.15)', color: 'var(--c-sky-600)', fontWeight: 800, mb: 1.5 }} />
            <Typography variant="h3" fontWeight={900} sx={{ color: 'var(--c-ink)', letterSpacing: '-0.02em', mb: 2 }}>
              How to Use the OMSC Platform
            </Typography>
            <Typography variant="body1" sx={{ color: 'var(--c-ink-secondary)', maxWidth: 650, mx: 'auto', fontSize: '1.05rem' }}>
              Select your role below to view the simple 4-step workflow.
            </Typography>

            {/* Workflow Switcher */}
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <ToggleButtonGroup
                value={activeWorkflowTab}
                exclusive
                onChange={(_, val) => val && setActiveWorkflowTab(val)}
                sx={{
                  bgcolor: 'var(--c-surface)',
                  p: 0.5,
                  borderRadius: 3,
                  border: '1px solid var(--c-border)',
                  '& .MuiToggleButton-root': {
                    color: 'var(--c-ink-secondary)',
                    px: 3.5,
                    py: 1,
                    fontWeight: 800,
                    fontSize: '0.9rem',
                    textTransform: 'none',
                    borderRadius: '10px !important',
                    border: 'none !important',
                  },
                  '& .Mui-selected': {
                    bgcolor: activeWorkflowTab === 'instructor' ? 'var(--c-emerald-700) !important' : 'var(--c-emerald-600) !important',
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
                  icon={<GroupAdd sx={{ color: 'var(--c-emerald-700)' }} />}
                />
                <StepItem
                  step="02"
                  title="Provide Course Topics"
                  description="Open the AI Exam Generator. Input your lecture topics, paste syllabus text, or upload reference files for the AI engine."
                  icon={<AutoStories sx={{ color: 'var(--c-emerald-700)' }} />}
                />
                <StepItem
                  step="03"
                  title="Set Bloom's Taxonomy"
                  description="Select your target question distribution across Remembering, Understanding, Applying, and Analyzing cognitive levels."
                  icon={<Psychology sx={{ color: 'var(--c-emerald-700)' }} />}
                />
                <StepItem
                  step="04"
                  title="Publish & Auto-Grade"
                  description="Publish the exam to your classroom. Enrolled students take the test online, and scores are automatically calculated with item analytics."
                  icon={<AssignmentTurnedIn sx={{ color: 'var(--c-emerald-700)' }} />}
                />
              </>
            ) : (
              <>
                <StepItem
                  step="01"
                  title="Join with Class Code"
                  description="Log in as a student and click 'Join Classroom'. Enter the unique Class Code provided by your course instructor."
                  icon={<GroupAdd sx={{ color: 'var(--c-sky-600)' }} />}
                />
                <StepItem
                  step="02"
                  title="Generate AI Reviewers"
                  description="Generate smart study flashcards, key concept summaries, and self-quizzes to master your course subjects."
                  icon={<Lightbulb sx={{ color: 'var(--c-sky-600)' }} />}
                />
                <StepItem
                  step="03"
                  title="Take Online Exams"
                  description="Access active examinations published in your classroom. Complete timed assessments with clear question navigation."
                  icon={<Quiz sx={{ color: 'var(--c-sky-600)' }} />}
                />
                <StepItem
                  step="04"
                  title="Instant Results & Feedback"
                  description="View your score breakdown immediately upon submission, with question rationale explanations to boost retention."
                  icon={<CheckCircle sx={{ color: 'var(--c-sky-600)' }} />}
                />
              </>
            )}
          </Box>
        </Container>
      </Box>

      {/* ── 5. Section: Core Platform Capabilities (Perfect 3x2 Grid) ── */}
      <Box id="features" sx={{ py: 10, px: 3, bgcolor: 'var(--c-surface)', borderTop: '1px solid var(--c-border)' }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Chip label="CORE CAPABILITIES" size="small" sx={{ bgcolor: 'var(--c-emerald-50)', color: 'var(--c-emerald-600)', fontWeight: 800, mb: 1.5 }} />
            <Typography variant="h3" fontWeight={900} sx={{ color: 'var(--c-ink)', letterSpacing: '-0.02em', mb: 2 }}>
              Built for Academic Excellence
            </Typography>
            <Typography variant="body1" sx={{ color: 'var(--c-ink-secondary)', maxWidth: 650, mx: 'auto', fontSize: '1.05rem' }}>
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
              icon={<AutoAwesome sx={{ color: 'var(--c-emerald-700)' }} />}
            />
            <FeatureItem
              title="Bloom's Cognitive Taxonomy"
              description="Categorize questions from basic recall to complex problem-solving and critical evaluation."
              icon={<Psychology sx={{ color: 'var(--c-sky-600)' }} />}
            />
            <FeatureItem
              title="Smart Study Reviewers"
              description="Interactive flashcards, key concept summaries, and self-assessment tools generated for student revision."
              icon={<MenuBook sx={{ color: 'var(--c-emerald-600)' }} />}
            />
            <FeatureItem
              title="Automated Grading & Analytics"
              description="Instant exam scoring, detailed item analysis, and class gradebook tracking for instructors."
              icon={<Analytics sx={{ color: 'var(--c-orange-400)' }} />}
            />
            <FeatureItem
              title="Secure Class Code Roster"
              description="Dedicated class codes ensure only authorized OMSC students can join specific course sections."
              icon={<Shield sx={{ color: 'var(--c-rose-500)' }} />}
            />
            <FeatureItem
              title="Central Exam Repository"
              description="Save, manage, export, and republish past examinations across academic terms."
              icon={<Quiz sx={{ color: 'var(--c-emerald-700)' }} />}
            />
          </Box>
        </Container>
      </Box>

      {/* ── 5b. Section: The numbers the system is built around ──
          These are the fixed parameters of the OMSC Table of Specifications workflow, not
          usage metrics — the platform is a capstone deployment, so inventing adoption
          figures here would be dishonest. */}
      <Box sx={{ py: { xs: 7, md: 9 }, px: 3, bgcolor: 'var(--c-canvas)', borderTop: '1px solid var(--c-border)' }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 5 }}>
            <Chip label="BY THE NUMBERS" size="small" sx={{ bgcolor: 'var(--c-teal-100)', color: 'var(--c-teal-700)', fontWeight: 800, mb: 1.5 }} />
            <Typography variant="h3" fontWeight={900} sx={{ color: 'var(--c-ink)', letterSpacing: '-0.02em' }}>
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
      <Box sx={{ py: { xs: 8, md: 10 }, px: 3, bgcolor: 'var(--c-surface)', borderTop: '1px solid var(--c-border)' }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Chip label="TWO PORTALS, ONE SYSTEM" size="small" sx={{ bgcolor: 'var(--c-emerald-50)', color: 'var(--c-emerald-700)', fontWeight: 800, mb: 1.5 }} />
            <Typography variant="h3" fontWeight={900} sx={{ color: 'var(--c-ink)', letterSpacing: '-0.02em', mb: 2 }}>
              Made for Instructors and Students Alike
            </Typography>
            <Typography variant="body1" sx={{ color: 'var(--c-ink-secondary)', maxWidth: 680, mx: 'auto', fontSize: '1.05rem' }}>
              The same class roster drives both sides — an exam an instructor publishes is the
              exam a student sits, and the results flow straight back into the gradebook.
            </Typography>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
            <RoleCard
              accent="var(--c-emerald-500)"
              icon={<RecordVoiceOver sx={{ color: 'var(--c-emerald-700)', fontSize: 26 }} />}
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
              icon={<Person sx={{ color: 'var(--c-teal-700)', fontSize: 26 }} />}
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
      <Box id="faq" sx={{ py: { xs: 8, md: 10 }, px: 3, bgcolor: 'var(--c-canvas)', borderTop: '1px solid var(--c-border)' }}>
        <Container maxWidth="md">
          <Box sx={{ textAlign: 'center', mb: 5 }}>
            <Chip label="QUESTIONS" size="small" sx={{ bgcolor: 'var(--c-amber-100)', color: 'var(--c-amber-700)', fontWeight: 800, mb: 1.5 }} />
            <Typography variant="h3" fontWeight={900} sx={{ color: 'var(--c-ink)', letterSpacing: '-0.02em' }}>
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
          background: 'linear-gradient(135deg, #022c22 0%, var(--c-emerald-900) 50%, var(--c-emerald-700) 100%)',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Container maxWidth="md" sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{ width: 64, height: 64, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2.5, backdropFilter: 'blur(10px)' }}>
            <School sx={{ fontSize: 36, color: 'white' }} />
          </Box>
          <Typography variant="h3" fontWeight={900} sx={{ color: 'var(--c-ink)', letterSpacing: '-0.02em', mb: 2, fontSize: { xs: '2rem', md: '2.8rem' } }}>
            Ready to Access the OMSC AI Portal?
          </Typography>
          <Typography variant="body1" sx={{ color: 'var(--c-emerald-200)', fontSize: '1.1rem', mb: 4, maxWidth: 600, mx: 'auto' }}>
            Click below to sign in with your Instructor or Student account, join classrooms, and generate AI exams.
          </Typography>

          <Button
            variant="contained"
            size="large"
            startIcon={<LoginIcon />}
            onClick={() => setOpenLoginModal(true)}
            sx={{
              bgcolor: 'var(--c-surface)',
              color: 'var(--c-emerald-900)',
              fontWeight: 900,
              px: 4.5,
              py: 1.8,
              borderRadius: 3.5,
              fontSize: '1.1rem',
              textTransform: 'none',
              boxShadow: '0 10px 35px rgba(0,0,0,0.3)',
              '&:hover': { bgcolor: 'var(--c-slate-50)', transform: 'translateY(-2px)' },
            }}
          >
            Sign In to OMSC Account
          </Button>
        </Container>
      </Box>

      {/* ── 7. Footer ── */}
      <Box sx={{ py: 4, px: 3, bgcolor: 'var(--c-surface-sunken)', textAlign: 'center', borderTop: '1px solid var(--c-border)' }}>
        <Typography variant="caption" sx={{ color: 'var(--c-slate-500)', fontWeight: 600 }}>
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
            bgcolor: 'var(--c-surface)',
            border: '1px solid var(--c-border)',
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
            <Typography variant="h5" component="h1" sx={{ fontWeight: 900, color: 'var(--c-ink)', letterSpacing: '-0.02em' }}>
              OMSC AI Classroom
            </Typography>
            <Typography variant="caption" sx={{ color: 'var(--c-ink-secondary)', fontWeight: 700, mt: 0.3, display: 'block' }}>
              Occidental Mindoro State College Examination Portal
            </Typography>
          </Box>

          {/* Role Switcher */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="caption" sx={{ fontWeight: 800, color: 'var(--c-ink-secondary)', mb: 1, display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.68rem' }}>
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
                bgcolor: 'var(--c-surface-muted)',
                p: 0.5,
                borderRadius: 3,
                border: '1px solid var(--c-border)',
                '& .MuiToggleButton-root': {
                  flex: 1,
                  py: 1.1,
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  textTransform: 'none',
                  borderRadius: '10px !important',
                  border: 'none !important',
                  color: 'var(--c-ink-secondary)',
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

          {/* Email + password sign-in */}
          <Box component="form" onSubmit={handleCredentialLogin} sx={{ mb: 2.5 }}>
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
              sx={{ mb: 1.5 }}
            />
            <TextField
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              sx={{ mb: 2 }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={submitting}
              sx={{ py: 1.25, borderRadius: 3, fontWeight: 800, fontSize: '0.92rem' }}
            >
              {submitting ? 'Signing in\u2026' : 'Sign in'}
            </Button>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
            <Box sx={{ flex: 1, height: 1, bgcolor: 'var(--c-border)' }} />
            <Typography variant="caption" sx={{ color: 'var(--c-ink-tertiary)', fontWeight: 700 }}>OR</Typography>
            <Box sx={{ flex: 1, height: 1, bgcolor: 'var(--c-border)' }} />
          </Box>

          {/* English Google Sign-In Container */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
            {!GOOGLE_CLIENT_ID ? (
              <Alert severity="info" sx={{ width: '100%', borderRadius: 2, fontSize: '0.8rem', bgcolor: 'var(--c-surface-muted)', color: 'var(--c-ink)', border: '1px solid var(--c-border)', '& .MuiAlert-icon': { color: 'var(--c-primary)' } }}>
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
                  borderColor: 'var(--c-border-strong)',
                  color: 'var(--c-ink)',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  textTransform: 'none',
                  '&:hover': { bgcolor: 'var(--c-surface-muted)', borderColor: 'var(--c-ink-tertiary)' },
                }}
              >
                Continue with Google
              </Button>
            )}
              </>
            )}
          </Box>

          {/* Quick Demo Sign-In Bar */}
          <Box sx={{ pt: 2.5, borderTop: '1px dashed var(--c-border)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: 'var(--c-ink-secondary)', display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.72rem' }}>
                <AutoAwesome sx={{ fontSize: 14, color: 'var(--c-emerald-600)' }} /> Quick Demo Sign-In
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
                      bgcolor: 'var(--c-surface-muted)',
                      borderColor: 'var(--c-border)',
                      transition: 'all 0.15s ease',
                      '&:hover': {
                        borderColor: isInstructorUser ? 'var(--c-emerald-500)' : 'var(--c-sky-400)',
                        bgcolor: isInstructorUser ? 'var(--c-emerald-50)' : 'var(--c-sky-100)',
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
                        bgcolor: isInstructorUser ? 'var(--c-emerald-700)' : 'var(--c-sky-600)',
                        color: '#ffffff',
                      }}
                    >
                      {u.name.charAt(0)}
                    </Avatar>
                    <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                      <Typography variant="caption" noWrap sx={{ fontWeight: 800, color: 'var(--c-ink)', display: 'block', fontSize: '0.72rem', lineHeight: 1.1 }}>
                        {u.name.split(' ')[0]}
                      </Typography>
                      <Chip
                        label={u.role}
                        size="small"
                        sx={{
                          height: 15,
                          fontSize: '0.55rem',
                          fontWeight: 800,
                          bgcolor: isInstructorUser ? 'var(--c-emerald-100)' : 'var(--c-sky-100)',
                          color: isInstructorUser ? 'var(--c-emerald-800)' : 'var(--c-sky-800)',
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
        bgcolor: 'color-mix(in srgb, var(--c-surface) 88%, transparent)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--c-border)',
        py: 1.5,
        px: { xs: 2, sm: 4 },
      }}
    >
      <Container maxWidth="xl">
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer' }} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <Box sx={{ width: 38, height: 38, borderRadius: 2.5, background: 'linear-gradient(135deg, var(--c-emerald-600) 0%, var(--c-teal-600) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', fontWeight: 900 }}>
              <School sx={{ fontSize: 22 }} />
            </Box>
            <Box>
              <Typography variant="subtitle1" fontWeight={900} sx={{ color: 'var(--c-ink)', lineHeight: 1.1, letterSpacing: '-0.01em' }}>
                OMSC AI Classroom
              </Typography>
              <Typography variant="caption" sx={{ color: 'var(--c-ink-secondary)', fontSize: '0.65rem' }}>
                Occidental Mindoro State College
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 3.5 }}>
            <Typography variant="body2" onClick={() => onScrollTo('about')} sx={{ color: 'var(--c-slate-700)', fontWeight: 600, cursor: 'pointer', '&:hover': { color: 'var(--c-ink)' } }}>
              About System
            </Typography>
            <Typography variant="body2" onClick={() => onScrollTo('how-it-works')} sx={{ color: 'var(--c-slate-700)', fontWeight: 600, cursor: 'pointer', '&:hover': { color: 'var(--c-ink)' } }}>
              How It Works
            </Typography>
            <Typography variant="body2" onClick={() => onScrollTo('features')} sx={{ color: 'var(--c-slate-700)', fontWeight: 600, cursor: 'pointer', '&:hover': { color: 'var(--c-ink)' } }}>
              Features
            </Typography>
            <Typography variant="body2" onClick={() => onScrollTo('faq')} sx={{ color: 'var(--c-slate-700)', fontWeight: 600, cursor: 'pointer', '&:hover': { color: 'var(--c-ink)' } }}>
              FAQ
            </Typography>
          </Box>

          <Button
            variant="contained"
            startIcon={<LoginIcon />}
            onClick={onOpenLogin}
            sx={{
              background: 'linear-gradient(90deg, var(--c-emerald-600) 0%, var(--c-teal-600) 100%)',
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
        bgcolor: 'var(--c-surface)',
        border: '1px solid var(--c-border)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ width: 40, height: 40, borderRadius: 2.5, bgcolor: 'var(--c-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </Box>
        <Typography variant="h6" fontWeight={900} sx={{ color: 'rgba(255,255,255,0.2)', fontSize: '1.2rem' }}>
          {step}
        </Typography>
      </Box>
      <Typography variant="subtitle1" fontWeight={800} sx={{ color: 'var(--c-ink)', mb: 1 }}>
        {title}
      </Typography>
      <Typography variant="caption" sx={{ color: 'var(--c-ink-secondary)', lineHeight: 1.5, display: 'block' }}>
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
        bgcolor: 'var(--c-surface)',
        border: '1px solid var(--c-border)',
        textAlign: 'center',
        height: '100%',
        boxSizing: 'border-box',
        '&::before': {
          content: '""',
          position: 'absolute',
          insetInline: 0,
          top: 0,
          height: 2,
          background: 'linear-gradient(90deg, var(--c-emerald-600) 0%, var(--c-teal-600) 100%)',
        },
      }}
    >
      <Typography
        sx={{
          fontWeight: 900,
          fontSize: { xs: '2.1rem', md: '2.7rem' },
          lineHeight: 1.1,
          letterSpacing: '-0.03em',
          background: 'linear-gradient(90deg, var(--c-emerald-600) 0%, var(--c-teal-600) 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        {value}
      </Typography>
      <Typography variant="subtitle2" sx={{ color: 'var(--c-ink)', fontWeight: 800, mt: 0.5 }}>
        {label}
      </Typography>
      <Typography variant="caption" sx={{ color: 'var(--c-ink-secondary)', display: 'block', mt: 0.5, lineHeight: 1.45 }}>
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
        bgcolor: 'var(--c-surface)',
        border: '1px solid var(--c-border)',
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
            bgcolor: 'var(--c-surface)',
            border: `1px solid ${accent}44`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </Box>
        <Typography variant="h6" fontWeight={900} sx={{ color: 'var(--c-ink)', letterSpacing: '-0.01em' }}>
          {title}
        </Typography>
      </Box>

      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {points.map((point) => (
          <Box component="li" key={point} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
            <CheckCircle sx={{ color: accent, fontSize: 18, mt: '2px', flexShrink: 0 }} />
            <Typography variant="body2" sx={{ color: 'var(--c-slate-700)', lineHeight: 1.55 }}>
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
        bgcolor: 'var(--c-surface)',
        border: '1px solid var(--c-border)',
        px: { xs: 2, md: 2.75 },
        py: 1.75,
        transition: 'border-color .2s ease',
        '&[open]': { borderColor: 'var(--c-emerald-200)' },
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
        <Typography variant="subtitle1" fontWeight={800} sx={{ color: 'var(--c-ink)', flex: 1 }}>
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
            color: 'var(--c-emerald-700)',
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
      <Typography variant="body2" sx={{ color: 'var(--c-ink-secondary)', lineHeight: 1.65, mt: 1.75, pr: { md: 4 } }}>
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
        bgcolor: 'var(--c-surface)',
        border: '1px solid var(--c-border)',
        height: '100%',
        boxSizing: 'border-box',
        transition: 'transform 0.2s ease, border-color 0.2s ease',
        '&:hover': { transform: 'translateY(-3px)', borderColor: 'var(--c-border-strong)' },
      }}
    >
      <Box sx={{ width: 42, height: 42, borderRadius: 2.5, bgcolor: 'var(--c-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
        {icon}
      </Box>
      <Typography variant="subtitle1" fontWeight={800} sx={{ color: 'var(--c-ink)', mb: 1 }}>
        {title}
      </Typography>
      <Typography variant="caption" sx={{ color: 'var(--c-ink-secondary)', lineHeight: 1.5, display: 'block' }}>
        {description}
      </Typography>
    </Paper>
  );
}
