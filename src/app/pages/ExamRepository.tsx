import { teachesClass } from '../services/classAccess';
import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { useReauth } from '../components/ReauthProvider';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
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
  Divider,
  FormHelperText,
  Switch,
  InputAdornment,
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
  Search as SearchIcon,
  Inventory2,
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
import { palette, radius, font, tintFor } from '../theme/tokens';

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
  const requireReauth = useReauth();
  const { toast, ToastHost } = useToast();
  const { confirm, ConfirmHost } = useConfirm();
  const {
    currentUser,
    users,
    savedExams,
    classrooms,
    assignExamToClassroom,
    updateExamInRepository,
    deleteExamFromRepository,
    topics,
    saveQuestionBankItem,
    questionBank,
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
      schoolName: '',
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
  // Per-assignment detail. Title and points start from the template and can be overridden
  // for this class only, the way Google Classroom lets the same material be posted twice.
  const [assignTitle, setAssignTitle] = useState('');
  const [assignInstructions, setAssignInstructions] = useState('');
  const [assignTopicId, setAssignTopicId] = useState('');
  const [assignPoints, setAssignPoints] = useState<number | ''>('');
  const [assignAttempts, setAssignAttempts] = useState(1);
  const [assignAllowLate, setAssignAllowLate] = useState(true);
  const [assignShuffle, setAssignShuffle] = useState(true);

  // Edit modal state
  const [openEditModal, setOpenEditModal] = useState(false);
  const [editingExam, setEditingExam] = useState<any | null>(null);
  const [newQType, setNewQType] = useState('multiple-choice');
  // A 60-item pool mounted every question card at once — several hundred MUI inputs, which
  // is what made this dialog slow to open and to type in. The list is paged instead.
  const [poolFilter, setPoolFilter] = useState('');
  const [poolPage, setPoolPage] = useState(0);
  const POOL_PAGE_SIZE = 6;
  const [regeneratingMap, setRegeneratingMap] = useState<Record<string, boolean>>({});

  const filteredExams = savedExams.filter((exam) =>
    exam.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    exam.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Topics belong to a class, so the picker has to follow the class selection.
  const classTopics: any[] = (topics && selectedClassroomId ? topics[selectedClassroomId] : []) || [];

  // The pool list keeps each question's ORIGINAL index, because every editor handler
  // addresses questions by position in `editingExam.questions` — filtering or paging must
  // not renumber them.
  const filteredPoolQuestions = useMemo(() => {
    const all = (editingExam?.questions || []).map((q: any, qIdx: number) => ({ q, qIdx }));
    const needle = poolFilter.trim().toLowerCase();
    if (!needle) return all;
    return all.filter(({ q }: any) =>
      [q.question, q.topic, q.type, q.cognitiveLevel]
        .filter(Boolean)
        .some((field: string) => String(field).toLowerCase().includes(needle))
    );
  }, [editingExam, poolFilter]);

  const poolPageCount = Math.max(1, Math.ceil(filteredPoolQuestions.length / POOL_PAGE_SIZE));
  const visiblePoolQuestions = filteredPoolQuestions.slice(
    poolPage * POOL_PAGE_SIZE,
    (poolPage + 1) * POOL_PAGE_SIZE
  );

  // Opening a different template must not land the user on page 4 of the previous one.
  useEffect(() => {
    setPoolFilter('');
    setPoolPage(0);
  }, [editingExam?.id]);

  /**
   * Files a whole template's questions into the Question Bank so later exams can draw on
   * them. Items already in the bank (same stem) are skipped rather than duplicated, so
   * banking the same template twice is harmless.
   */
  const handleBankTemplate = async (exam: any) => {
    const existingStems = new Set(
      (questionBank || []).map((q: any) => (q.question || '').trim().toLowerCase())
    );
    const fresh = (exam.questions || []).filter(
      (q: any) => q.question?.trim() && !existingStems.has(q.question.trim().toLowerCase())
    );
    if (fresh.length === 0) {
      toast('Every question in this template is already in the bank.', 'error');
      return;
    }
    const ok = await confirm({
      title: 'Add to Question Bank?',
      message: `${fresh.length} of ${exam.questions.length} questions from "${exam.title}" will be added. The rest are already banked.`,
      confirmLabel: `Add ${fresh.length}`,
    });
    if (!ok) return;
    fresh.forEach((q: any, i: number) => {
      saveQuestionBankItem({
        ...q,
        id: `qb-${Date.now()}-${i}`,
        subject: q.subject || exam.title,
        createdBy: currentUser?.id,
        createdAt: new Date().toISOString(),
      });
    });
    toast(`Added ${fresh.length} questions to the Question Bank.`);
  };

  const handleOpenAssign = (examId: string) => {
    setSelectedExamId(examId);
    // Auto-select first class if available
    const myClasses = classrooms.filter((c) => teachesClass(c, currentUser?.id));
    if (myClasses.length > 0) {
      setSelectedClassroomId(myClasses[0].id);
    }
    // Seed the form from the template so the common case is one click.
    const template = savedExams.find((e) => e.id === examId);
    setAssignTitle(template?.title || '');
    setAssignInstructions(template?.description || '');
    setAssignPoints(template?.totalPoints ?? '');
    setAssignTopicId('');
    setAssignAttempts(1);
    setAssignAllowLate(true);
    setAssignShuffle(true);
    setPostDate(getLocalDateTimeString(new Date()));
    setDueDate(getLocalDateTimeString(new Date(Date.now() + 86400000)));
    setOpenAssignModal(true);
  };

  const handleAssignConfirm = () => {
    if (!selectedExamId || !selectedClassroomId || !postDate || !dueDate) {
      toast('Choose a class and set both dates.', 'error');
      return;
    }
    if (!assignTitle.trim()) {
      toast('Give the assignment a title.', 'error');
      return;
    }
    // A due date before the post date would publish an exam that is already overdue.
    if (new Date(dueDate) <= new Date(postDate)) {
      toast('The due date must come after the post date.', 'error');
      return;
    }
    const className = myClassrooms.find((c) => c.id === selectedClassroomId)?.name || 'the class';
    assignExamToClassroom(selectedExamId, selectedClassroomId, {
      postDate,
      dueDate,
      title: assignTitle,
      instructions: assignInstructions,
      topicId: assignTopicId || undefined,
      totalPoints: assignPoints === '' ? undefined : Number(assignPoints),
      allowedAttempts: assignAttempts,
      allowLate: assignAllowLate,
      shuffleQuestions: assignShuffle,
    });
    toast(`Assigned to ${className}.`);
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

  const myClassrooms = classrooms.filter((c) => teachesClass(c, currentUser?.id));

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
            <Quiz sx={{ fontSize: 40, color: 'var(--c-emerald-600)', mr: 2 }} />
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

        {/* Folder grid. Each template reads as a labelled folder rather than a full-width
            row: the tab along the top edge is what makes a card read as "a thing that holds
            questions", and a grid shows far more templates per screen than stacked rows. */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
            gap: 2.5,
            width: '100%',
          }}
        >
          {filteredExams.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center', width: '100%', gridColumn: '1 / -1' }}>
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
            filteredExams.map((exam) => {
              const tint = tintFor(exam.id);
              const sourceCount = Array.isArray(exam.sourceFiles) ? exam.sourceFiles.length : 0;
              return (
                <Box
                  key={exam.id}
                  sx={{
                    // Tab and card move as one: the hover lift lives on this wrapper, so the
                    // tab can no longer be left behind with a gap under it.
                    position: 'relative', height: '100%',
                    transition: 'transform .2s ease',
                    '&:hover': { transform: 'translateY(-3px)' },
                    '&:hover .folder-body': { boxShadow: '0 20px 44px -22px var(--glow-a), var(--shadow-md)', borderColor: 'var(--c-emerald-200)' },
                  }}
                >
                  <Paper
                    elevation={0}
                    className="folder-body"
                    sx={{
                      position: 'relative',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      p: 2.25,
                      borderRadius: '14px',
                      borderTop: `4px solid ${tint.ink}`,
                      overflow: 'hidden',
                      border: '1px solid var(--c-border)',
                      bgcolor: 'var(--c-surface)',
                      boxShadow: 'var(--shadow-xs)',
                      transition: 'box-shadow .2s ease, border-color .2s ease',
                    }}
                  >
                    {/* Header band in the folder's colour, fading into the card. */}
                    <Box
                      sx={{
                        mb: 1.5,
                        display: 'flex', alignItems: 'flex-start', gap: 1.25,
                        position: 'relative', zIndex: 2,
                      }}
                    >
                      <Box
                        sx={{
                          width: 40, height: 40, borderRadius: '12px', flexShrink: 0,
                          bgcolor: tint.from, color: tint.ink,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <Quiz sx={{ fontSize: 19 }} />
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          sx={{
                            fontSize: '1rem', fontWeight: 700, lineHeight: 1.3,
                            color: 'var(--c-ink)', minWidth: 0,
                            overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', wordBreak: 'break-word',
                          }}
                          title={exam.title}
                        >
                          {exam.title}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Two-line clamp on a plain Box. `-webkit-line-clamp` on the Typography
                        was being lost: the base stylesheet forces `display: flow-root` on it,
                        which defeats the `-webkit-box` the clamp requires, leaving the text
                        cropped mid-line. A wrapper no typography rule targets holds the
                        height reliably, and the mask fades the cut so it reads as deliberate. */}
                    {exam.description && (
                      <Box
                        sx={{
                          mb: 1.5,
                          height: '2.9em',
                          fontSize: '0.85rem',
                          lineHeight: 1.45,
                          color: 'var(--c-ink-secondary)',
                          overflow: 'hidden',
                          maskImage: 'linear-gradient(180deg, #000 82%, transparent 100%)',
                          WebkitMaskImage: 'linear-gradient(180deg, #000 82%, transparent 100%)',
                        }}
                        title={exam.description}
                      >
                        {exam.description}
                      </Box>
                    )}

                    <Typography variant="body2" sx={{ color: 'var(--c-ink-secondary)', mb: 1.5 }}>
                      {exam.activeQuestionCount && exam.activeQuestionCount !== exam.questions.length
                        ? `${exam.activeQuestionCount} of ${exam.questions.length} questions`
                        : `${exam.questions.length} questions`}
                      {` · ${exam.totalPoints} pts`}
                      {Number.isFinite(Number(exam.duration)) && Number(exam.duration) > 0 ? ` · ${exam.duration} min` : ''}
                    </Typography>

                    {/* Provenance, collapsed to a count so it cannot push the card out of the
                        grid; the full list stays available on hover. */}
                    {sourceCount > 0 && (
                      <Tooltip
                        title={exam.sourceFiles.map((f: any) => f.name).join(', ')}
                        placement="top"
                      >
                        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6, mb: 1.5 }}>
                          <Description sx={{ fontSize: 14, color: 'var(--c-ink-tertiary)' }} />
                          <Typography variant="caption" sx={{ color: 'var(--c-ink-tertiary)', fontWeight: 600 }}>
                            From {sourceCount} source file{sourceCount > 1 ? 's' : ''}
                          </Typography>
                        </Box>
                      </Tooltip>
                    )}

                    {/* Actions pin to the bottom so every card in a row lines up. */}
                    <Box sx={{ flex: 1 }} />
                    <Divider sx={{ mb: 1.5 }} />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Button
                        size="small"
                        variant="contained"
                        color="secondary"
                        startIcon={<CalendarMonth sx={{ fontSize: 16 }} />}
                        onClick={() => handleOpenAssign(exam.id)}
                        sx={{ fontWeight: 700, height: 32, flex: 1, minWidth: 0 }}
                      >
                        Assign
                      </Button>
                      <Tooltip title="Add these questions to the Question Bank">
                        <IconButton size="small" onClick={() => handleBankTemplate(exam)} sx={{ width: 32, height: 32, border: '1px solid var(--c-border)' }}>
                          <Inventory2 sx={{ fontSize: 17 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Print exam">
                        <IconButton size="small" onClick={async () => { if (await requireReauth('Printing or saving an exam exports its questions and answers.')) setPrintTarget(exam); }} sx={{ width: 32, height: 32, border: '1px solid var(--c-border)' }}>
                          <Print sx={{ fontSize: 17 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit template">
                        <IconButton size="small" onClick={() => handleOpenEdit(exam)} sx={{ width: 32, height: 32, border: '1px solid var(--c-border)' }}>
                          <Edit sx={{ fontSize: 17 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete template">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={async () => {
                            const ok = await confirm({
                              title: 'Delete this template?',
                              message: `"${exam.title}" will be removed from the repository. Exams already assigned to a class are not affected.`,
                              confirmLabel: 'Delete',
                              tone: 'danger',
                            });
                            if (ok && await requireReauth('Deleting an exam template cannot be undone.')) {
                              deleteExamFromRepository(exam.id);
                              toast('Template deleted.');
                            }
                          }}
                          sx={{
                            width: 32, height: 32,
                            border: '1px solid var(--c-red-100)',
                            bgcolor: 'var(--c-red-50)',
                            '&:hover': { bgcolor: 'var(--c-red-100)' },
                          }}
                        >
                          <Delete sx={{ fontSize: 17 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Paper>
                </Box>
              );
            })
          )}
        </Box>
      </Paper>

      {/* Assign / Schedule Modal */}
      <Dialog open={openAssignModal} onClose={() => setOpenAssignModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pb: 0.5 }}>Assign exam</DialogTitle>
        <Typography variant="body2" sx={{ px: 3, pb: 2, color: 'var(--c-ink-secondary)' }}>
          Students see this title and these instructions. The template itself is unchanged,
          so the same exam can be posted to another class with different detail.
        </Typography>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <TextField
              label="Title"
              required
              value={assignTitle}
              onChange={(e) => setAssignTitle(e.target.value)}
              inputProps={{ maxLength: 140 }}
            />

            <TextField
              label="Instructions (optional)"
              value={assignInstructions}
              onChange={(e) => setAssignInstructions(e.target.value)}
              multiline
              minRows={3}
              placeholder="What students should know before they start — materials allowed, how to submit, anything to watch for."
            />

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Class</InputLabel>
                <Select
                  value={selectedClassroomId}
                  onChange={(e) => { setSelectedClassroomId(e.target.value); setAssignTopicId(''); }}
                  label="Class"
                >
                  {myClassrooms.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.name} ({c.section})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth disabled={classTopics.length === 0}>
                <InputLabel>Topic</InputLabel>
                <Select
                  value={assignTopicId}
                  onChange={(e) => setAssignTopicId(e.target.value)}
                  label="Topic"
                >
                  <MenuItem value="">
                    <em>No topic</em>
                  </MenuItem>
                  {classTopics.map((t: any) => (
                    <MenuItem key={t.id} value={t.id}>{t.name || t.title}</MenuItem>
                  ))}
                </Select>
                <FormHelperText>
                  {classTopics.length === 0
                    ? 'This class has no topics yet.'
                    : 'Groups the exam in the class stream.'}
                </FormHelperText>
              </FormControl>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <TextField
                label="Points"
                type="number"
                value={assignPoints}
                onChange={(e) => setAssignPoints(e.target.value === '' ? '' : Number(e.target.value))}
                inputProps={{ min: 0 }}
                helperText="Total marks for this assignment."
              />
              <TextField
                label="Attempts allowed"
                type="number"
                value={assignAttempts}
                onChange={(e) => setAssignAttempts(Math.max(1, Number(e.target.value) || 1))}
                inputProps={{ min: 1, max: 10 }}
                helperText="How many times a student may sit it."
              />
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <TextField
                label="Posts on"
                type="datetime-local"
                value={postDate}
                onChange={(e) => setPostDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                helperText="Hidden from students until this time."
              />
              <TextField
                label="Due"
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                error={Boolean(postDate && dueDate) && new Date(dueDate) <= new Date(postDate)}
                helperText={
                  postDate && dueDate && new Date(dueDate) <= new Date(postDate)
                    ? 'Must be after the post date.'
                    : ' '
                }
              />
            </Box>

            <Box
              sx={{
                p: 1.75, borderRadius: '10px',
                border: '1px solid var(--c-border)', bgcolor: 'var(--c-surface-muted)',
              }}
            >
              <FormControlLabel
                control={<Switch checked={assignAllowLate} onChange={(e) => setAssignAllowLate(e.target.checked)} />}
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>Accept late submissions</Typography>
                    <Typography variant="caption" sx={{ color: 'var(--c-ink-tertiary)' }}>
                      Turn this off to close the exam once the due date passes.
                    </Typography>
                  </Box>
                }
                sx={{ alignItems: 'flex-start', m: 0, mb: 1 }}
              />
              <FormControlLabel
                control={<Switch checked={assignShuffle} onChange={(e) => setAssignShuffle(e.target.checked)} />}
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>Shuffle question order</Typography>
                    <Typography variant="caption" sx={{ color: 'var(--c-ink-tertiary)' }}>
                      Each student sees a different order. Off keeps the template order.
                    </Typography>
                  </Box>
                }
                sx={{ alignItems: 'flex-start', m: 0 }}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAssignModal(false)} sx={{ color: 'var(--c-ink-secondary)' }}>
            Cancel
          </Button>
          <Button
            onClick={handleAssignConfirm}
            variant="contained"
            disabled={!selectedClassroomId || !assignTitle.trim()}
          >
            Assign
          </Button>
        </DialogActions>
      </Dialog>

      {/* Full Template Editor Modal Upgraded with Vertical Layouts and Smart AI Regeneration */}
      <Dialog
        open={openEditModal}
        onClose={() => setOpenEditModal(false)}
        maxWidth="lg"
        fullWidth
        fullScreen={isMobile}
        PaperProps={{ sx: { borderRadius: isMobile ? 0 : 4, height: isMobile ? '100%' : '92vh' } }}
      >
        <DialogTitle sx={{ fontWeight: 900, pb: 0.5 }}>Edit exam template</DialogTitle>
        <Typography variant="body2" sx={{ px: 3, pb: 1.5, color: 'var(--c-ink-secondary)' }}>
          Changes apply to the template only. Exams already assigned to a class keep the
          questions they were published with.
        </Typography>
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
                  Questions ({editingExam.questions.length})
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

              <TextField
                fullWidth
                size="small"
                placeholder="Filter questions by text, topic or type…"
                value={poolFilter}
                onChange={(e) => { setPoolFilter(e.target.value); setPoolPage(0); }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" sx={{ color: 'var(--c-ink-tertiary)' }} />
                    </InputAdornment>
                  ),
                }}
              />

              {/* Stacked Vertical Question Cards list — paged, so only a handful of
                  question cards (and their inputs) are mounted at a time. */}
              <Grid container spacing={3.5}>
                {visiblePoolQuestions.map(({ q, qIdx }: any) => {
                  const isQRegenerating = !!regeneratingMap[q.id];
                  return (
                    <Grid size={12} key={q.id}>
                      <Paper
                        variant="outlined"
                        sx={{
                          p: { xs: 2.5, md: 4 },
                          bgcolor: 'var(--c-surface)',
                          position: 'relative',
                          borderRadius: 4,
                          borderColor: 'var(--c-slate-300)',
                          borderLeft: '5px solid var(--c-purple-600)',
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
                            <CircularProgress size={38} thickness={4} sx={{ color: 'var(--c-purple-600)', mb: 1.5 }} />
                            <Typography variant="subtitle2" fontWeight="bold" color="var(--c-purple-600)">
                              AI is constructing alternative templates...
                            </Typography>
                          </Box>
                        )}

                        {/* Unified Card Header: Tags on Left, Delete on Right (No overlapping) */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5, pb: 1.5, borderBottom: '1px solid var(--c-slate-100)' }}>
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
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 0.5, border: '1px solid var(--c-slate-200)', borderRadius: 2 }}>
                                <img src={q.image} alt="Q Thumbnail" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
                                <IconButton size="small" color="error" onClick={() => handleRemoveImg(qIdx)}>
                                  <Delete fontSize="small" />
                                </IconButton>
                              </Box>
                            )}
                          </Box>

                          {/* MC choices (Strictly Vertical option stacking) */}
                          {q.type === 'multiple-choice' && q.options && (
                            <Box sx={{ pl: { xs: 1.5, md: 3 }, borderLeft: '4px solid var(--c-purple-600)', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'var(--c-slate-600)' }}>
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
                                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, p: 0.5, border: '1px solid var(--c-slate-100)', borderRadius: 1.5 }}>
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
                            <Box sx={{ pl: 3, borderLeft: '4px solid var(--c-emerald-500)', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'var(--c-slate-600)' }}>
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
                            <Box sx={{ pl: 3, borderLeft: '4px solid var(--c-amber-500)', display: 'flex', flexDirection: 'column', gap: 1 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'var(--c-slate-700)' }}>
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
                            <Box sx={{ pl: 3, borderLeft: '4px solid var(--c-emerald-500)', display: 'flex', flexDirection: 'column', gap: 1 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'var(--c-slate-700)' }}>
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
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2, bgcolor: 'var(--c-slate-50)', borderRadius: 3, border: '1px solid var(--c-slate-100)' }}>
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
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5, pt: 1.5, borderTop: '1px solid var(--c-slate-100)' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <AutoAwesome sx={{ color: 'var(--c-emerald-500)', fontSize: 18 }} />
                              <Typography variant="caption" sx={{ fontWeight: 700, color: 'var(--c-slate-600)' }}>
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
                                  color: 'var(--c-emerald-700)',
                                  borderColor: 'var(--c-emerald-200)',
                                  bgcolor: 'var(--c-emerald-50)',
                                  '&:hover': { bgcolor: 'var(--c-emerald-100)', borderColor: 'var(--c-emerald-200)' }
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
                                    color: 'var(--c-emerald-800)',
                                    borderColor: 'var(--c-emerald-200)',
                                    bgcolor: 'var(--c-emerald-50)',
                                    '&:hover': { bgcolor: 'var(--c-emerald-100)', borderColor: 'var(--c-emerald-300)' }
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

                {filteredPoolQuestions.length === 0 && (
                  <Grid size={12}>
                    <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: '14px' }}>
                      <Typography variant="body2" sx={{ color: 'var(--c-ink-secondary)' }}>
                        No questions match “{poolFilter}”.
                      </Typography>
                    </Paper>
                  </Grid>
                )}

                {poolPageCount > 1 && (
                  <Grid size={12}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                      <Typography variant="caption" sx={{ color: 'var(--c-ink-secondary)', fontWeight: 600 }}>
                        Showing {poolPage * POOL_PAGE_SIZE + 1}–
                        {Math.min((poolPage + 1) * POOL_PAGE_SIZE, filteredPoolQuestions.length)} of{' '}
                        {filteredPoolQuestions.length}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={poolPage === 0}
                          onClick={() => setPoolPage((n) => Math.max(0, n - 1))}
                        >
                          Previous
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={poolPage >= poolPageCount - 1}
                          onClick={() => setPoolPage((n) => Math.min(poolPageCount - 1, n + 1))}
                        >
                          Next
                        </Button>
                      </Box>
                    </Box>
                  </Grid>
                )}
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
        <DialogTitle sx={{ fontWeight: 800, color: 'var(--c-slate-900)' }}>
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

          <Typography variant="caption" sx={{ fontWeight: 800, color: 'var(--c-slate-600)', display: 'block', mb: 1 }}>
            PREVIEW
          </Typography>
          <Box sx={{ maxHeight: 460, overflowY: 'auto', overflowX: 'hidden', border: '1px solid var(--c-slate-200)', borderRadius: 2, bgcolor: 'var(--c-slate-50)', p: 1 }}>
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
      {ConfirmHost}
    </Container>
  );
}
