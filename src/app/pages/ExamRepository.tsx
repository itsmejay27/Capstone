import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import {
  Container,
  FormControl,
  InputLabel,
  Select,
  Grid,
  Paper,
  Typography,
  Box,
  Stack,
  TextField,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Menu,
  ListItemIcon,
  ListItemText,
  IconButton,
  Radio,
  RadioGroup,
  FormControlLabel,
  Tooltip,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  CalendarMonth,
  Quiz,
  Image as ImageIcon,
  Save,
  AutoAwesome,
  Print,
  MoreVert,
  ArrowBack,
  Description,
} from '@mui/icons-material';
import PrintableExam, { PrintPortal } from '../components/PrintableExam';
import type { PrintPaperSize, PrintMode } from '../types';
import { useIsMobile } from '../hooks/useResponsive';
import {
  PageContainer,
  PageHeader,
  SectionHeading,
  SearchField,
  CardGrid,
  EntityCard,
  StatusPill,
  EmptyState,
  Field,
  FieldRow,
} from '../components/ui-kit';
import { palette, radius, font } from '../theme/tokens';

/**
 * Relative "created" line for a template card. `createdAt` arrives as a Date from memory and
 * as an ISO string once it has been round-tripped through localStorage / Supabase, so both
 * shapes are accepted here.
 */
function relativeDate(value: unknown): string {
  if (!value) return 'No date';
  const d = value instanceof Date ? value : new Date(value as string);
  if (Number.isNaN(d.getTime())) return 'No date';
  const diff = Date.now() - d.getTime();
  const DAY = 86400000;
  if (diff < 0) return d.toLocaleDateString();
  if (diff < 3600000) {
    const m = Math.floor(diff / 60000);
    return m <= 1 ? 'Just now' : `${m} min ago`;
  }
  if (diff < DAY) {
    const h = Math.floor(diff / 3600000);
    return `${h} hour${h > 1 ? 's' : ''} ago`;
  }
  if (diff < 7 * DAY) {
    const days = Math.floor(diff / DAY);
    return days === 1 ? 'Yesterday' : `${days} days ago`;
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const MOCK_IMAGES = [
  'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400&q=80',
  'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400&q=80',
  'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=400&q=80',
  'https://images.unsplash.com/photo-1507668077129-56e32842fceb?w=400&q=80',
];

// Database of smart context-aware question alternatives for premium regeneration feedback
const ALTERNATIVE_QUESTIONS: Record<string, any[]> = {
  'multiple-choice': [
    {
      question: 'Which of the following describes the difference between block elements and inline elements in CSS?',
      options: [
        'Block elements start on a new line and take up full width; inline elements do not.',
        'Inline elements can contain block elements, but block elements cannot.',
        'Block elements ignore padding-top and padding-bottom properties completely.',
        'Inline elements are styled using flex container alignment properties only.'
      ],
      correctAnswer: 0,
      points: 2,
    },
    {
      question: 'What is the primary purpose of the React `useEffect` clean-up function?',
      options: [
        'To prevent memory leaks by unsubscribing from event listeners and clearing active timers.',
        'To force the component to re-render immediately with updated state values.',
        'To erase local storage context cache before rendering child nodes.',
        'To validate structural interfaces during static compilation evaluation.'
      ],
      correctAnswer: 0,
      points: 2,
    },
    {
      question: 'Which HTTP status code represents a successful resource creation on a REST server?',
      options: [
        '201 Created',
        '200 OK',
        '204 No Content',
        '302 Found'
      ],
      correctAnswer: 0,
      points: 2,
    },
    {
      question: 'In SQL databases, which statement is used to remove a table structure entirely including its schemas?',
      options: [
        'DROP TABLE table_name;',
        'DELETE TABLE table_name;',
        'TRUNCATE TABLE table_name;',
        'REMOVE TABLE table_name;'
      ],
      correctAnswer: 0,
      points: 2,
    }
  ],
  'true-false': [
    {
      question: 'True or False: In JavaScript, standard array structures can hold multiple data types concurrently.',
      correctAnswer: 'true',
      points: 1,
    },
    {
      question: 'True or False: The CSS grid container flex-basis determines the default aspect-ratio of images.',
      correctAnswer: 'false',
      points: 1,
    },
    {
      question: 'True or False: A standard React component will re-render anytime its parent component re-renders.',
      correctAnswer: 'true',
      points: 1,
    },
    {
      question: 'True or False: TypeScript types are compiled and strictly validated at client-side browser runtime.',
      correctAnswer: 'false',
      points: 1,
    }
  ],
  'short-answer': [
    {
      question: 'What command in Git is used to record project changes in the repository history log?',
      correctAnswer: 'git commit',
      points: 3,
    },
    {
      question: 'What is the standard name of the API method used to fetch data over networks in modern browsers?',
      correctAnswer: 'fetch',
      points: 3,
    },
    {
      question: 'What React hook is used to access the context values stored inside a ContextProvider?',
      correctAnswer: 'useContext',
      points: 3,
    },
    {
      question: 'What markup syntax standard is used by React components to render nested templates?',
      correctAnswer: 'JSX',
      points: 3,
    }
  ],
  'essay': [
    {
      question: 'Discuss the concept of asynchronous execution in JavaScript. Contrast the benefits of using async/await syntax over traditional callbacks or raw promises.',
      points: 5,
    },
    {
      question: 'Elaborate on the structural benefits of using semantic HTML elements over non-semantic divs and spans for modern SEO and web accessibility guidelines.',
      points: 5,
    },
    {
      question: 'Analyze the trade-offs between Client-Side Rendering (CSR) and Server-Side Rendering (SSR) in modern web applications. Highlight their impacts on page-load performance.',
      points: 5,
    }
  ]
};

export default function ExamRepository() {
  const { toast, ToastHost } = useToast();
  const {
    currentUser,
    users,
    savedExams,
    classrooms,
    assignExamToClassroom,
    updateExamInRepository,
    deleteExamFromRepository,
  } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [searchTerm, setSearchTerm] = useState('');

  // Per-card overflow menu (presentation only — it just routes to the handlers below).
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuExam, setMenuExam] = useState<any | null>(null);
  const closeMenu = () => { setMenuAnchor(null); setMenuExam(null); };

  // Print state
  const [printTarget, setPrintTarget] = useState<any | null>(null);
  const [printPaper, setPrintPaper] = useState<PrintPaperSize>('A4');
  const [printMode, setPrintMode] = useState<PrintMode>('student');
  const [printing, setPrinting] = useState(false);

  /**
   * Letterhead data for the printed paper. A saved template has no classroomId, so the class
   * name is only known once the template has been assigned; where it is not, the field prints
   * as a ruled blank instead of "undefined".
   */
  const printHeader = useMemo(() => {
    const assignedClass = printTarget?.classroomId
      ? classrooms.find((c: any) => c.id === printTarget.classroomId)
      : undefined;
    const author = users.find((u: any) => u.id === printTarget?.createdBy);
    return {
      className: assignedClass?.name || '',
      section: assignedClass?.section || '',
      subject: assignedClass?.subject || '',
      instructorName: author?.name || currentUser?.name || '',
      schoolName: 'Occidental Mindoro State College',
    };
  }, [printTarget, classrooms, users, currentUser]);

  // Assign modal state
  const [openAssignModal, setOpenAssignModal] = useState(false);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [selectedClassroomId, setSelectedClassroomId] = useState('');

  // Set default post date to now, due date to tomorrow
  const getLocalDateTimeString = (date: Date) => {
    const tzoffset = date.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(date.getTime() - tzoffset)).toISOString().slice(0, 16);
    return localISOTime;
  };
  const [postDate, setPostDate] = useState(getLocalDateTimeString(new Date()));
  const [dueDate, setDueDate] = useState(getLocalDateTimeString(new Date(Date.now() + 86400000)));

  // Edit modal state
  const [openEditModal, setOpenEditModal] = useState(false);
  const [editingExam, setEditingExam] = useState<any | null>(null);
  const [newQType, setNewQType] = useState('multiple-choice');
  const [regeneratingMap, setRegeneratingMap] = useState<Record<string, boolean>>({});

  const filteredExams = savedExams.filter((exam) =>
    exam.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    exam.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenAssign = (examId: string) => {
    setSelectedExamId(examId);
    // Auto-select first class if available
    const myClasses = classrooms.filter((c) => c.instructorId === currentUser?.id);
    if (myClasses.length > 0) {
      setSelectedClassroomId(myClasses[0].id);
    }
    setOpenAssignModal(true);
  };

  const handleAssignConfirm = () => {
    if (!selectedExamId || !selectedClassroomId || !postDate || !dueDate) {
      toast('Please fill out all fields.', 'error');
      return;
    }
    assignExamToClassroom(selectedExamId, selectedClassroomId, postDate, dueDate);
    toast('Exam assigned and scheduled.');
    setOpenAssignModal(false);
    setSelectedExamId(null);
  };

  // Open full template editor
  const handleOpenEdit = (exam: any) => {
    setEditingExam(JSON.parse(JSON.stringify(exam)));
    setOpenEditModal(true);
  };

  const handleSaveEditConfirm = () => {
    if (!editingExam.title.trim()) {
      toast('Title is required.', 'error');
      return;
    }
    updateExamInRepository(editingExam);
    setOpenEditModal(false);
    setEditingExam(null);
    toast('Exam template updated.');
  };

  // Edit question helpers inside Repository dialog
  const handleUpdateQText = (idx: number, val: string) => {
    if (!editingExam) return;
    const updated = { ...editingExam };
    updated.questions[idx].question = val;
    setEditingExam(updated);
  };

  const handleUpdateQOption = (qIdx: number, oIdx: number, val: string) => {
    if (!editingExam) return;
    const updated = { ...editingExam };
    updated.questions[qIdx].options[oIdx] = val;
    setEditingExam(updated);
  };

  const handleUpdateQCorrectAnswer = (qIdx: number, val: any) => {
    if (!editingExam) return;
    const updated = { ...editingExam };
    updated.questions[qIdx].correctAnswer = val;
    setEditingExam(updated);
  };

  const handleUpdateQPoints = (qIdx: number, val: number) => {
    if (!editingExam) return;
    const updated = { ...editingExam };
    updated.questions[qIdx].points = val;
    setEditingExam(updated);
  };

  const handleAttachImg = (qIdx: number, optIdx?: number) => {
    if (!editingExam) return;
    const randomImg = MOCK_IMAGES[Math.floor(Math.random() * MOCK_IMAGES.length)];
    const updated = { ...editingExam };
    if (optIdx !== undefined) {
      if (!updated.questions[qIdx].optionsImages) {
        updated.questions[qIdx].optionsImages = ['', '', '', ''];
      }
      updated.questions[qIdx].optionsImages[optIdx] = randomImg;
    } else {
      updated.questions[qIdx].image = randomImg;
    }
    setEditingExam(updated);
  };

  const handleRemoveImg = (qIdx: number, optIdx?: number) => {
    if (!editingExam) return;
    const updated = { ...editingExam };
    if (optIdx !== undefined) {
      if (updated.questions[qIdx].optionsImages) {
        updated.questions[qIdx].optionsImages[optIdx] = '';
      }
    } else {
      updated.questions[qIdx].image = '';
    }
    setEditingExam(updated);
  };

  const handleDeleteQ = (qIdx: number) => {
    if (!editingExam) return;
    const updated = { ...editingExam };
    updated.questions = updated.questions.filter((_: any, idx: number) => idx !== qIdx);
    setEditingExam(updated);
  };

  const handleAddQ = (type: string) => {
    if (!editingExam) return;
    const newQ: any = {
      id: `q-rep-new-${Date.now()}`,
      type: type,
      question: `New Template ${type === 'multiple-choice' ? 'Multiple Choice' : type === 'true-false' ? 'True/False' : type === 'short-answer' ? 'Short Answer' : 'Essay'} Question: Enter text...`,
      points: type === 'multiple-choice' ? 2 : type === 'true-false' ? 1 : type === 'short-answer' ? 3 : 5,
      difficulty: 'medium',
      image: '',
    };
    if (type === 'multiple-choice') {
      newQ.options = ['Option A', 'Option B', 'Option C', 'Option D'];
      newQ.correctAnswer = 0;
      newQ.optionsImages = ['', '', '', ''];
    } else if (type === 'true-false') {
      newQ.correctAnswer = 'true';
    } else if (type === 'short-answer') {
      newQ.correctAnswer = 'Answer text';
    }
    const updated = { ...editingExam };
    updated.questions.push(newQ);
    setEditingExam(updated);
  };

  // Smart AI Regeneration in Repository modal
  const handleRegenerateEditQ = (qIdx: number, mode: 'full' | 'options' | 'answer') => {
    if (!editingExam) return;
    const q = editingExam.questions[qIdx];
    setRegeneratingMap((prev) => ({ ...prev, [q.id]: true }));

    setTimeout(() => {
      setEditingExam((prevExam: any) => {
        if (!prevExam) return null;
        const updatedQuestions = [...prevExam.questions];
        const currentQ = updatedQuestions[qIdx];
        const type = currentQ.type;

        if (mode === 'full') {
          const list = ALTERNATIVE_QUESTIONS[type] || [];
          let chosen = list[Math.floor(Math.random() * list.length)];
          if (chosen.question === currentQ.question && list.length > 1) {
            const filtered = list.filter(item => item.question !== currentQ.question);
            chosen = filtered[Math.floor(Math.random() * filtered.length)];
          }
          updatedQuestions[qIdx] = {
            ...currentQ,
            question: chosen.question,
            options: chosen.options ? [...chosen.options] : undefined,
            correctAnswer: chosen.correctAnswer,
            points: chosen.points || currentQ.points,
          };
        } else if (mode === 'options') {
          if (type === 'multiple-choice' && currentQ.options) {
            const originalOptions = [...currentQ.options];
            const correctText = originalOptions[currentQ.correctAnswer];

            for (let i = originalOptions.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [originalOptions[i], originalOptions[j]] = [originalOptions[j], originalOptions[i]];
            }

            const newCorrectIdx = originalOptions.indexOf(correctText);
            updatedQuestions[qIdx] = {
              ...currentQ,
              options: originalOptions,
              correctAnswer: newCorrectIdx >= 0 ? newCorrectIdx : 0,
            };
          } else if (type === 'true-false') {
            const nextAnswer = currentQ.correctAnswer === 'true' ? 'false' : 'true';
            let newText = currentQ.question;
            if (nextAnswer === 'false') {
              if (!newText.includes(' NOT ') && !newText.includes(' not ')) {
                newText = newText.replace('runs in', 'does NOT run in')
                  .replace('supports', 'does NOT support')
                  .replace('is a', 'is NOT a');
              }
            } else {
              newText = newText.replace('does NOT run in', 'runs in')
                .replace('does NOT support', 'supports')
                .replace('is NOT a', 'is a');
            }
            updatedQuestions[qIdx] = {
              ...currentQ,
              question: newText,
              correctAnswer: nextAnswer,
            };
          }
        } else if (mode === 'answer') {
          if (type === 'multiple-choice' && currentQ.options) {
            const newIndex = (currentQ.correctAnswer + 1) % currentQ.options.length;
            updatedQuestions[qIdx] = {
              ...currentQ,
              correctAnswer: newIndex,
            };
          } else if (type === 'true-false') {
            const nextAnswer = currentQ.correctAnswer === 'true' ? 'false' : 'true';
            let newText = currentQ.question;
            if (nextAnswer === 'false') {
              newText = newText.replace('runs in', 'does NOT run in')
                .replace('supports', 'does NOT support')
                .replace('is a', 'is NOT a');
            } else {
              newText = newText.replace('does NOT run in', 'runs in')
                .replace('does NOT support', 'supports')
                .replace('is NOT a', 'is a');
            }
            updatedQuestions[qIdx] = {
              ...currentQ,
              question: newText,
              correctAnswer: nextAnswer,
            };
          } else if (type === 'short-answer') {
            const alternatives: Record<string, string> = {
              'let': 'const',
              'const': 'let',
              'fetch': 'axios',
              'axios': 'fetch',
              'git commit': 'git push',
              'git push': 'git commit',
              'JSX': 'TSX',
              'TSX': 'JSX',
              'Document Object Model': 'DOM',
              'flex-direction': 'justify-content',
              'flexbox': 'grid'
            };
            const currentAns = currentQ.correctAnswer;
            const nextAns = alternatives[currentAns] || 'API Endpoint';
            let newText = currentQ.question;
            if (nextAns === 'const') {
              newText = newText.replace('reassigned', 'reassigned (immutable reference)');
            }
            updatedQuestions[qIdx] = {
              ...currentQ,
              question: newText,
              correctAnswer: nextAns,
            };
          }
        }

        return {
          ...prevExam,
          questions: updatedQuestions,
        };
      });
      setRegeneratingMap((prev) => ({ ...prev, [q.id]: false }));
    }, 1500);
  };

  const myClassrooms = classrooms.filter((c) => c.instructorId === currentUser?.id);

  return (
    <Container maxWidth="xl" sx={{ py: 4, px: { xs: 2, sm: 3, md: 5, lg: 6 } }}>
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate('/dashboard')}
        sx={{ mb: 3 }}
      >
        Back to Dashboard
      </Button>

      <Paper sx={{ p: 4, borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Quiz sx={{ fontSize: 40, color: '#9c27b0', mr: 2 }} />
            <Box>
              <Typography variant="h4" fontWeight="bold">
                Exam Repository
              </Typography>
              <Typography variant="body1" color="text.secondary">
                View, modify, and schedule generated template exams to classrooms.
              </Typography>
            </Box>
          </Box>
          <Button
            variant="contained"
            color="primary"
            startIcon={<Add />}
            onClick={() => navigate('/exam-generator')}
          >
            Generate New Exam
          </Button>
        </Box>

        <TextField
          fullWidth
          placeholder="Search template exams by title or description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ mb: 4 }}
        />

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%' }}>
          {filteredExams.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center', width: '100%' }}>
              <Typography variant="h6" color="text.secondary">
                No saved exam templates found
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Create one now using the AI Exam Generator.
              </Typography>
              <Button variant="outlined" onClick={() => navigate('/exam-generator')}>
                Generate Exam
              </Button>
            </Paper>
          ) : (
            filteredExams.map((exam) => (
              <Paper
                key={exam.id}
                elevation={0}
                sx={{
                  width: '100%',
                  minHeight: { md: 110 },
                  bgcolor: 'white',
                  borderRadius: 3,
                  border: '1px solid #e2e8f0',
                  borderLeft: '6px solid #9c27b0',
                  p: 3,
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.05)',
                    borderColor: '#cbd5e1',
                  },
                  display: 'flex',
                  flexDirection: { xs: 'column', md: 'row' },
                  alignItems: { xs: 'flex-start', md: 'center' },
                  justifyContent: 'space-between',
                  gap: 3,
                  boxSizing: 'border-box',
                }}
              >
                {/* Left Section: Icon + Title & Description */}
                <Box sx={{ display: 'flex', gap: 2.5, alignItems: 'flex-start', flexGrow: 1, minWidth: 0 }}>
                  <Box sx={{
                    width: 46,
                    height: 46,
                    borderRadius: 2,
                    background: 'linear-gradient(135deg, #7b1fa2 0%, #9c27b0 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    color: 'white',
                    boxShadow: '0 4px 12px rgba(156,39,176,0.2)',
                  }}>
                    <Quiz sx={{ fontSize: 24 }} />
                  </Box>
                  <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                    <Typography
                      variant="h6"
                      fontWeight={800}
                      sx={{
                        color: 'text.primary',
                        lineHeight: 1.25,
                        letterSpacing: '-0.01em',
                        fontSize: '1.05rem',
                        mb: 0.5
                      }}
                    >
                      {exam.title}
                    </Typography>
                    {exam.description && (
                      <Typography
                        variant="body2"
                        sx={{
                          color: 'text.secondary',
                          fontSize: '0.82rem',
                          lineHeight: 1.5,
                          mb: 1.5,
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {exam.description}
                      </Typography>
                    )}
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Chip label={`Pool: ${exam.questions.length} items`} size="small" color="secondary" sx={{ height: 24, fontSize: '0.7rem', fontWeight: 700 }} />
                      <Chip label={`Set: ${exam.activeQuestionCount || exam.questions.length} items`} size="small" color="primary" sx={{ height: 24, fontSize: '0.7rem', fontWeight: 700 }} />
                      <Chip label={`Points Cap: ${exam.totalPoints} pts`} size="small" variant="outlined" sx={{ height: 24, fontSize: '0.7rem', fontWeight: 600 }} />
                      {/* A template saved before a duration was captured has none; showing
                          "undefinedm" is worse than showing nothing. */}
                      {Number.isFinite(Number(exam.duration)) && Number(exam.duration) > 0 && (
                        <Chip label={`Time limit: ${exam.duration}m`} size="small" variant="outlined" sx={{ height: 24, fontSize: '0.7rem', fontWeight: 600 }} />
                      )}
                    </Box>

                    {/* Provenance: the documents this template was generated from. */}
                    {Array.isArray(exam.sourceFiles) && exam.sourceFiles.length > 0 && (
                      <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap', alignItems: 'center', mt: 1.2 }}>
                        <Typography variant="caption" sx={{ color: palette.muted, fontWeight: 700 }}>
                          Generated from:
                        </Typography>
                        {exam.sourceFiles.map((f: any, i: number) => (
                          <Tooltip key={`${f.name}-${i}`} title={`${f.kind}${f.size ? ` · ${(f.size / 1024).toFixed(0)} KB` : ''}`}>
                            <Chip
                              icon={<Description sx={{ fontSize: 14 }} />}
                              label={f.name}
                              size="small"
                              variant="outlined"
                              sx={{ height: 24, fontSize: '0.68rem', fontWeight: 600, maxWidth: 260 }}
                            />
                          </Tooltip>
                        ))}
                      </Box>
                    )}
                  </Box>
                </Box>

                {/* Right Section: Print, Edit, Delete, Assign Actions */}
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  flexShrink: 0,
                  flexWrap: 'wrap',
                  minWidth: { md: '280px' },
                  width: { xs: '100%', md: 'auto' },
                  justifyContent: { xs: 'flex-start', md: 'flex-end' },
                  borderTop: { xs: '1px solid #f1f5f9', md: 'none' },
                  pt: { xs: 1.5, md: 0 },
                  mt: { xs: 1, md: 0 }
                }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<Print />}
                    onClick={() => setPrintTarget(exam)}
                    sx={{ fontWeight: 700, height: 32 }}
                  >
                    Print Exam
                  </Button>

                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<Edit />}
                    onClick={() => handleOpenEdit(exam)}
                    sx={{ fontWeight: 700, height: 32 }}
                  >
                    Edit Template
                  </Button>

                  <Button
                    variant="contained"
                    size="small"
                    color="secondary"
                    startIcon={<CalendarMonth />}
                    onClick={() => handleOpenAssign(exam.id)}
                    sx={{ fontWeight: 700, height: 32, px: 2 }}
                  >
                    Assign to Class
                  </Button>

                  <Tooltip title="Delete template">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => {
                        if (confirm('Delete this template from repository?')) {
                          deleteExamFromRepository(exam.id);
                        }
                      }}
                      sx={{
                        bgcolor: '#fef2f2',
                        border: '1px solid #fee2e2',
                        '&:hover': { bgcolor: '#fee2e2' },
                        width: 32,
                        height: 32,
                      }}
                    >
                      <Delete />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Paper>
            ))
          )}
        </Box>
      </Paper>

      {/* Assign / Schedule Modal */}
      <Dialog open={openAssignModal} onClose={() => setOpenAssignModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Assign Exam to Classroom & Schedule</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Select Classroom</InputLabel>
              <Select
                value={selectedClassroomId}
                onChange={(e) => setSelectedClassroomId(e.target.value)}
                label="Select Classroom"
              >
                {myClassrooms.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name} ({c.section})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Post Date and Time"
              type="datetime-local"
              fullWidth
              value={postDate}
              onChange={(e) => setPostDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />

            <TextField
              label="Due Date and Time"
              type="datetime-local"
              fullWidth
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAssignModal(false)}>Cancel</Button>
          <Button onClick={handleAssignConfirm} variant="contained" color="secondary" disabled={!selectedClassroomId}>
            Schedule Assignment
          </Button>
        </DialogActions>
      </Dialog>

      {/* Full Template Editor Modal Upgraded with Vertical Layouts and Smart AI Regeneration */}
      <Dialog open={openEditModal} onClose={() => setOpenEditModal(false)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 4 } }}>
        <DialogTitle sx={{ fontWeight: 900 }}>Edit Exam Template Pool</DialogTitle>
        <DialogContent dividers>
          {editingExam && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <TextField
                fullWidth
                label="Template Title"
                value={editingExam.title}
                onChange={(e) => setEditingExam({ ...editingExam, title: e.target.value })}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
              <TextField
                fullWidth
                label="Template Description"
                value={editingExam.description}
                onChange={(e) => setEditingExam({ ...editingExam, description: e.target.value })}
                multiline
                rows={2}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                <Typography variant="h6" fontWeight="bold">
                  Questions Pool ({editingExam.questions.length} items)
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <FormControl size="small" sx={{ minWidth: 150 }}>
                    <InputLabel>Type to Add</InputLabel>
                    <Select
                      value={newQType}
                      label="Type to Add"
                      onChange={(e) => setNewQType(e.target.value as string)}
                      sx={{ borderRadius: 2 }}
                    >
                      <MenuItem value="multiple-choice">Multiple Choice</MenuItem>
                      <MenuItem value="true-false">True / False</MenuItem>
                      <MenuItem value="short-answer">Short Answer</MenuItem>
                      <MenuItem value="essay">Essay</MenuItem>
                    </Select>
                  </FormControl>
                  <Button startIcon={<Add />} variant="outlined" size="small" onClick={() => handleAddQ(newQType)} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>
                    Add Question Item
                  </Button>
                </Box>
              </Box>

              {/* Stacked Vertical Question Cards list */}
              <Grid container spacing={3.5}>
                {editingExam.questions.map((q: any, qIdx: number) => {
                  const isQRegenerating = !!regeneratingMap[q.id];
                  return (
                    <Grid size={12} key={q.id}>
                      <Paper
                        variant="outlined"
                        sx={{
                          p: { xs: 2.5, md: 4 },
                          bgcolor: '#ffffff',
                          position: 'relative',
                          borderRadius: 4,
                          borderColor: '#cbd5e1',
                          borderLeft: '5px solid #7b1fa2',
                          boxShadow: '0 2px 10px rgba(0,0,0,0.01)',
                          transition: 'all 0.2s',
                          '&:hover': { boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }
                        }}
                      >
                        {/* Loading Frosted Overlay during Regeneration */}
                        {isQRegenerating && (
                          <Box sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            bgcolor: 'rgba(255, 255, 255, 0.85)',
                            backdropFilter: 'blur(3px)',
                            zIndex: 10,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 4
                          }}>
                            <CircularProgress size={38} thickness={4} sx={{ color: '#7b1fa2', mb: 1.5 }} />
                            <Typography variant="subtitle2" fontWeight="bold" color="#7b1fa2">
                              AI is constructing alternative templates...
                            </Typography>
                          </Box>
                        )}

                        {/* Unified Card Header: Tags on Left, Delete on Right (No overlapping) */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5, pb: 1.5, borderBottom: '1px solid #f1f5f9' }}>
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                            <Chip label={`#${qIdx + 1}`} size="small" sx={{ fontWeight: 800 }} />
                            <Chip label={q.type.toUpperCase()} size="small" color="primary" sx={{ fontWeight: 800 }} />
                            <Chip label={`${q.points || 0} points`} size="small" variant="outlined" sx={{ fontWeight: 700 }} />
                          </Box>
                          <IconButton size="small" color="error" onClick={() => handleDeleteQ(qIdx)} title="Delete Question">
                            <Delete fontSize="small" />
                          </IconButton>
                        </Box>

                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

                          {/* Question Text (Smooth auto-expand) */}
                          <TextField
                            fullWidth
                            label="Question Text"
                            value={q.question}
                            onChange={(e) => handleUpdateQText(qIdx, e.target.value)}
                            size="small"
                            multiline
                            minRows={2}
                            maxRows={6}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                          />

                          {/* Question image attachment (Vertical Stack) */}
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<ImageIcon />}
                              onClick={() => handleAttachImg(qIdx)}
                              sx={{ borderRadius: 2, textTransform: 'none', fontSize: '0.75rem' }}
                            >
                              Attach Question Image
                            </Button>
                            {q.image && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 0.5, border: '1px solid #e2e8f0', borderRadius: 2 }}>
                                <img src={q.image} alt="Q Thumbnail" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
                                <IconButton size="small" color="error" onClick={() => handleRemoveImg(qIdx)}>
                                  <Delete fontSize="small" />
                                </IconButton>
                              </Box>
                            )}
                          </Box>

                          {/* MC choices (Strictly Vertical option stacking) */}
                          {q.type === 'multiple-choice' && q.options && (
                            <Box sx={{ pl: { xs: 1.5, md: 3 }, borderLeft: '4px solid #7b1fa2', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#475569' }}>
                                Options and Answer Key Setup
                              </Typography>
                              <RadioGroup
                                value={q.correctAnswer}
                                onChange={(e) => handleUpdateQCorrectAnswer(qIdx, Number(e.target.value))}
                              >
                                {q.options.map((opt: string, optIdx: number) => {
                                  const isCorrectOpt = q.correctAnswer === optIdx;
                                  return (
                                    <Box key={optIdx} sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 1 }}>

                                      {/* Option Header Radio */}
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Radio value={optIdx} checked={isCorrectOpt} size="small" />
                                        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: isCorrectOpt ? 'success.main' : 'text.secondary' }}>
                                          Option {String.fromCharCode(65 + optIdx)} {isCorrectOpt && '(Correct Answer Key)'}
                                        </Typography>
                                      </Box>

                                      {/* TextField Full Width */}
                                      <TextField
                                        fullWidth
                                        size="small"
                                        value={opt}
                                        onChange={(e) => handleUpdateQOption(qIdx, optIdx, e.target.value)}
                                        placeholder={`Statement for Option ${String.fromCharCode(65 + optIdx)}`}
                                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                      />

                                      {/* Option image vertically under input */}
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 1 }}>
                                        <IconButton size="small" onClick={() => handleAttachImg(qIdx, optIdx)} title="Attach option image">
                                          <ImageIcon fontSize="small" />
                                        </IconButton>
                                        {q.optionsImages?.[optIdx] && (
                                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, p: 0.5, border: '1px solid #f1f5f9', borderRadius: 1.5 }}>
                                            <img src={q.optionsImages[optIdx]} alt="Opt Thumbnail" style={{ width: '28px', height: '28px', objectFit: 'cover', borderRadius: '4px' }} />
                                            <IconButton size="small" color="error" onClick={() => handleRemoveImg(qIdx, optIdx)}>
                                              <Delete fontSize="small" />
                                            </IconButton>
                                          </Box>
                                        )}
                                      </Box>
                                    </Box>
                                  );
                                })}
                              </RadioGroup>
                            </Box>
                          )}

                          {/* T/F Choice (Spaced vertically) */}
                          {q.type === 'true-false' && (
                            <Box sx={{ pl: 3, borderLeft: '4px solid #10b981', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#475569' }}>
                                Select Correct Key
                              </Typography>
                              <RadioGroup
                                value={q.correctAnswer}
                                onChange={(e) => handleUpdateQCorrectAnswer(qIdx, e.target.value)}
                                sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
                              >
                                <FormControlLabel value="true" control={<Radio />} label="True" />
                                <FormControlLabel value="false" control={<Radio />} label="False" />
                              </RadioGroup>
                            </Box>
                          )}

                          {/* Short answer choice */}
                          {q.type === 'short-answer' && (
                            <Box sx={{ pl: 3, borderLeft: '4px solid #f59e0b', display: 'flex', flexDirection: 'column', gap: 1 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#334155' }}>
                                Short Answer Key
                              </Typography>
                              <TextField
                                fullWidth
                                label="Expected Correct Answer Statement / Key Term"
                                size="small"
                                value={q.correctAnswer && q.correctAnswer !== '0' ? q.correctAnswer : ''}
                                placeholder="e.g. Specific key term, keyword, or concise statement"
                                onChange={(e) => handleUpdateQCorrectAnswer(qIdx, e.target.value)}
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                              />
                            </Box>
                          )}

                          {/* Essay choice */}
                          {q.type === 'essay' && (
                            <Box sx={{ pl: 3, borderLeft: '4px solid #10b981', display: 'flex', flexDirection: 'column', gap: 1 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#334155' }}>
                                Essay Grading Rubric & Criteria
                              </Typography>
                              <TextField
                                fullWidth
                                multiline
                                minRows={2}
                                maxRows={4}
                                label="Expected Analytical Points / Rubric Criteria"
                                size="small"
                                value={q.correctAnswer && q.correctAnswer !== '0' ? q.correctAnswer : ''}
                                placeholder="Provide key points expected in students' responses..."
                                onChange={(e) => handleUpdateQCorrectAnswer(qIdx, e.target.value)}
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                              />
                            </Box>
                          )}

                          {/* Points setting and difficulty row (Vertical Stack) */}
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2, bgcolor: '#f8fafc', borderRadius: 3, border: '1px solid #f1f5f9' }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>Metadata Weights</Typography>
                            <Grid container spacing={2}>
                              <Grid size={{ xs: 12, md: 6 }}>
                                <TextField
                                  fullWidth
                                  label="Points weight"
                                  type="number"
                                  size="small"
                                  value={q.points || 0}
                                  onChange={(e) => handleUpdateQPoints(qIdx, Number(e.target.value))}
                                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                />
                              </Grid>
                              <Grid size={{ xs: 12, md: 6 }}>
                                <FormControl fullWidth size="small">
                                  <InputLabel>Difficulty</InputLabel>
                                  <Select
                                    value={q.difficulty || 'medium'}
                                    label="Difficulty"
                                    onChange={(e) => {
                                      if (!editingExam) return;
                                      const updated = { ...editingExam };
                                      updated.questions[qIdx].difficulty = e.target.value;
                                      setEditingExam(updated);
                                    }}
                                    sx={{ borderRadius: 2 }}
                                  >
                                    <MenuItem value="easy">Easy</MenuItem>
                                    <MenuItem value="medium">Medium</MenuItem>
                                    <MenuItem value="hard">Hard</MenuItem>
                                  </Select>
                                </FormControl>
                              </Grid>
                            </Grid>
                          </Box>

                          {/* Clean, Unconfusing AI Revision Action Bar */}
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5, pt: 1.5, borderTop: '1px solid #f1f5f9' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <AutoAwesome sx={{ color: '#10b981', fontSize: 18 }} />
                              <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569' }}>
                                AI Revision:
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                              <Button
                                variant="outlined"
                                size="small"
                                startIcon={<AutoAwesome sx={{ fontSize: 14 }} />}
                                onClick={() => handleRegenerateEditQ(qIdx, 'full')}
                                sx={{
                                  textTransform: 'none',
                                  borderRadius: 2,
                                  fontWeight: 700,
                                  fontSize: '0.8rem',
                                  color: '#047857',
                                  borderColor: '#a7f3d0',
                                  bgcolor: '#ecfdf5',
                                  '&:hover': { bgcolor: '#d1fae5', borderColor: '#a7f3d0' }
                                }}
                              >
                                Re-generate with AI
                              </Button>
                              {q.type === 'multiple-choice' && (
                                <Button
                                  variant="outlined"
                                  size="small"
                                  startIcon={<AutoAwesome sx={{ fontSize: 14 }} />}
                                  onClick={() => handleRegenerateEditQ(qIdx, 'options')}
                                  sx={{
                                    textTransform: 'none',
                                    borderRadius: 2,
                                    fontWeight: 700,
                                    fontSize: '0.8rem',
                                    color: '#065f46',
                                    borderColor: '#a7f3d0',
                                    bgcolor: '#ecfdf5',
                                    '&:hover': { bgcolor: '#d1fae5', borderColor: '#6ee7b7' }
                                  }}
                                >
                                  Shuffle Choices
                                </Button>
                              )}
                            </Box>
                          </Box>

                        </Box>
                      </Paper>
                    </Grid>
                  );
                })}
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setOpenEditModal(false)}>Cancel</Button>
          <Button onClick={handleSaveEditConfirm} variant="contained" color="secondary" startIcon={<Save />} sx={{ borderRadius: 2.5, px: 3 }}>
            Save Template Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Print Exam ── */}
      <Dialog
        open={Boolean(printTarget)}
        onClose={() => setPrintTarget(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: '#0f172a' }}>
          Print “{printTarget?.title}”
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2.5 }}>
            <TextField
              select size="small" label="Paper size" value={printPaper}
              onChange={(e) => setPrintPaper(e.target.value as PrintPaperSize)}
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="A4">A4</MenuItem>
              <MenuItem value="Letter">Letter</MenuItem>
            </TextField>
            <TextField
              select size="small" label="Copy" value={printMode}
              onChange={(e) => setPrintMode(e.target.value as PrintMode)}
              sx={{ minWidth: 210 }}
              helperText={printMode === 'student'
                ? 'Answers are omitted entirely from the markup.'
                : 'Includes the answer key — do not distribute.'}
            >
              <MenuItem value="student">Student copy</MenuItem>
              <MenuItem value="key">Answer key (instructor)</MenuItem>
            </TextField>
          </Box>

          {!printHeader.className && (
            <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
              This template is not assigned to a class yet, so the Class line will print as a
              blank for you to fill in by hand.
            </Alert>
          )}

          <Typography variant="caption" sx={{ fontWeight: 800, color: '#475569', display: 'block', mb: 1 }}>
            PREVIEW
          </Typography>
          <Box sx={{ maxHeight: 460, overflowY: 'auto', overflowX: 'hidden', border: '1px solid #e2e8f0', borderRadius: 2, bgcolor: '#f8fafc', p: 1 }}>
            {printTarget && (
              <PrintableExam exam={printTarget} header={printHeader} paper={printPaper} mode={printMode} />
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, flexWrap: 'wrap', gap: 1 }}>
          <Button onClick={() => setPrintTarget(null)}>Close</Button>
          <Button
            variant="contained"
            startIcon={<Print />}
            onClick={() => setPrinting(true)}
            sx={{ borderRadius: 2.5, px: 3, fontWeight: 800 }}
          >
            Print
          </Button>
        </DialogActions>
      </Dialog>

      {/* Body-level portal: the print stylesheet hides every direct child of <body> and
          re-shows only this node, which is what makes it proof against MUI's own portals
          (the open Dialog above would otherwise print on top of the exam). */}
      <PrintPortal open={printing} onFinished={() => setPrinting(false)}>
        {printTarget && (
          <PrintableExam exam={printTarget} header={printHeader} paper={printPaper} mode={printMode} />
        )}
      </PrintPortal>
      {ToastHost}
    </Container>
  );
}
