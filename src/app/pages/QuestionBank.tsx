import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useReauth } from '../components/ReauthProvider';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import {
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  Select,
  MenuItem,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Stack,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  DeleteSweep,
  LibraryBooks,
  CheckCircle,
} from '@mui/icons-material';
import { useIsMobile } from '../hooks/useResponsive';
import {
  PageContainer,
  PageHeader,
  SectionHeading,
  SearchField,
  FilterPill,
  FilterBar,
  EmptyState,
  Field,
  FieldRow,
  palette,
  radius,
  font,
} from '../components/ui-kit';

export default function QuestionBank() {
  const requireReauth = useReauth();
  const { currentUser, questionBank, saveQuestionBankItem, deleteQuestionBankItem } = useAuth();
  const { toast, ToastHost } = useToast();
  const { confirm, ConfirmHost } = useConfirm();
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterDifficulty, setFilterDifficulty] = useState('all');
  const [filterSubject, setFilterSubject] = useState('all');
  const [openDialog, setOpenDialog] = useState(false);

  // The dialog's fields were uncontrolled and its confirm button only called
  // setOpenDialog(false), so a typed question was discarded on submit. They are backed by
  // real state now and saved through the context.
  const emptyDraft = {
    question: '',
    type: 'multiple-choice',
    difficulty: 'medium',
    points: 2,
    topic: '',
    subject: '',
  };
  const [draft, setDraft] = useState(emptyDraft);
  /** Set while the dialog is editing an existing item rather than creating a new one. */
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleEditQuestion = (question: any) => {
    setDraft({
      question: question.question || '',
      type: question.type || 'multiple-choice',
      difficulty: question.difficulty || 'medium',
      points: question.points ?? 2,
      topic: question.topic || '',
      subject: question.subject || '',
    });
    setEditingId(question.id);
    setOpenDialog(true);
  };

  const handleDeleteQuestion = async (question: any) => {
    const ok = await confirm({
      title: 'Delete this question?',
      message: `"${(question.question || '').slice(0, 120)}" will be removed from the bank. Exams that already use it are not affected.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    if (!(await requireReauth('Deleting from your question bank cannot be undone.'))) return;
    deleteQuestionBankItem(question.id);
    toast('Question deleted.');
  };

  const handleEmptyBank = async () => {
    const ok = await confirm({
      title: `Empty the question bank?`,
      message: `All ${questionBank.length} questions will be removed. This cannot be undone, and exams already built from them are not affected.`,
      confirmLabel: 'Delete all',
      tone: 'danger',
    });
    if (!ok) return;
    if (!(await requireReauth('Emptying your question bank cannot be undone.'))) return;
    // Snapshot the ids first: deleting from the live array while iterating it would skip
    // every other entry.
    for (const id of questionBank.map((q: any) => q.id)) deleteQuestionBankItem(id);
    toast('Question bank emptied.');
  };

  const handleAddQuestion = () => {
    if (!draft.question.trim()) {
      toast('Enter the question first.', 'error');
      return;
    }
    // An edit keeps the original id, so the upsert replaces the item rather than adding a
    // near-duplicate beside it.
    const existing = editingId ? questionBank.find((q: any) => q.id === editingId) : null;
    saveQuestionBankItem({
      ...(existing || {}),
      id: editingId || `qb-${Date.now()}`,
      type: draft.type,
      question: draft.question.trim(),
      points: Number(draft.points) || 1,
      difficulty: draft.difficulty,
      topic: draft.topic.trim() || undefined,
      subject: draft.subject.trim() || undefined,
      createdBy: currentUser?.id,
      createdAt: new Date().toISOString(),
    });
    const wasEditing = Boolean(editingId);
    setDraft(emptyDraft);
    setEditingId(null);
    setOpenDialog(false);
    toast(wasEditing ? 'Question updated.' : 'Question added to the bank.');
  };

  const isInstructor = currentUser?.role === 'instructor';

  const filteredQuestions = questionBank.filter((q: any) => {
    const matchesSearch = q.question.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || q.type === filterType;
    const matchesDifficulty = filterDifficulty === 'all' || q.difficulty === filterDifficulty;
    const matchesSubject = filterSubject === 'all' || q.subject === filterSubject;
    return matchesSearch && matchesType && matchesDifficulty && matchesSubject;
  });

  const subjects = Array.from(new Set(questionBank.map((q: any) => q.subject).filter(Boolean)));

  const getTypeColor = (type: string) => {
    const colors: Record<string, any> = {
      'multiple-choice': 'primary',
      'true-false': 'success',
      'essay': 'warning',
      'short-answer': 'info',
    };
    return colors[type] || 'default';
  };

  const getDifficultyColor = (difficulty: string) => {
    const colors: Record<string, any> = {
      easy: 'success',
      medium: 'warning',
      hard: 'error',
    };
    return colors[difficulty] || 'default';
  };

  const typeOptions = [
    { value: 'all', label: 'All Types' },
    { value: 'multiple-choice', label: 'Multiple Choice' },
    { value: 'true-false', label: 'True/False' },
    { value: 'short-answer', label: 'Short Answer' },
    { value: 'essay', label: 'Essay' },
  ];

  const difficultyOptions = [
    { value: 'all', label: 'All Levels' },
    { value: 'easy', label: 'Easy' },
    { value: 'medium', label: 'Medium' },
    { value: 'hard', label: 'Hard' },
  ];

  const subjectOptions = [
    { value: 'all', label: 'All Subjects' },
    ...subjects.map((subject) => ({ value: String(subject), label: String(subject) })),
  ];

  const filtersActive =
    filterType !== 'all' || filterDifficulty !== 'all' || filterSubject !== 'all' || searchTerm !== '';

  return (
    <PageContainer>
      <PageHeader
        title="Question Bank"
        subtitle="Browse, manage, and reuse questions"
        actions={
          isInstructor && (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {questionBank.length > 0 && (
                <Button
                  variant="outlined"
                  startIcon={<DeleteSweep />}
                  onClick={handleEmptyBank}
                  sx={{ color: palette.danger, borderColor: palette.border }}
                >
                  Empty bank
                </Button>
              )}
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => { setDraft(emptyDraft); setEditingId(null); setOpenDialog(true); }}
              >
                Add Question
              </Button>
            </Box>
          )
        }
      />

      <Box sx={{ mb: 2 }}>
        <SearchField
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Search questions…"
        />
      </Box>

      <FilterBar>
        <FilterPill label="Type" value={filterType} options={typeOptions} onChange={setFilterType} />
        <FilterPill
          label="Difficulty"
          value={filterDifficulty}
          options={difficultyOptions}
          onChange={setFilterDifficulty}
        />
        <FilterPill
          label="Subject"
          value={filterSubject}
          options={subjectOptions}
          onChange={setFilterSubject}
        />
        {filtersActive && (
          <Button
            size="small"
            onClick={() => {
              setFilterType('all');
              setFilterDifficulty('all');
              setFilterSubject('all');
              setSearchTerm('');
            }}
            sx={{ color: palette.inkSecondary, whiteSpace: 'nowrap' }}
          >
            Clear
          </Button>
        )}
      </FilterBar>

      <SectionHeading title="Questions" count={filteredQuestions.length} />

      {filteredQuestions.length === 0 ? (
        <EmptyState
          icon={<LibraryBooks />}
          title="No questions found"
          description="Try adjusting your filters or add new questions."
          action={
            isInstructor && (
              <Button variant="contained" startIcon={<Add />} onClick={() => setOpenDialog(true)}>
                Add Question
              </Button>
            )
          }
        />
      ) : (
        <Stack spacing={2}>
          {filteredQuestions.map((question) => (
            <Paper
              key={question.id}
              sx={{
                p: { xs: 2, sm: 2.5 },
                borderRadius: '14px',
                border: `1px solid ${palette.border}`,
                minWidth: 0,
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 1.5,
                }}
              >
                <Typography
                  sx={{
                    fontFamily: font.mono,
                    fontSize: '0.92rem',
                    fontWeight: 600,
                    color: palette.ink,
                    lineHeight: 1.5,
                    minWidth: 0,
                    overflowWrap: 'anywhere',
                  }}
                >
                  {question.question}
                </Typography>
                {isInstructor && (
                  <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
                    <IconButton size="small" aria-label="Edit question" onClick={() => handleEditQuestion(question)}>
                      <Edit sx={{ fontSize: 18, color: palette.inkSecondary }} />
                    </IconButton>
                    <IconButton size="small" aria-label="Delete question" onClick={() => handleDeleteQuestion(question)}>
                      <Delete sx={{ fontSize: 18, color: palette.danger }} />
                    </IconButton>
                  </Stack>
                )}
              </Box>

              {question.options && (
                <Stack spacing={0.5} sx={{ mt: 1.5 }}>
                  {question.options.map((option, index) => {
                    const isCorrect = index === question.correctAnswer;
                    return (
                      <Box
                        key={index}
                        sx={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 1,
                          px: 1.25,
                          py: 0.75,
                          borderRadius: '8px',
                          bgcolor: isCorrect ? palette.successSoft : palette.surfaceMuted,
                          border: `1px solid ${isCorrect ? palette.successSoft : palette.border}`,
                          minWidth: 0,
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 700,
                            color: isCorrect ? palette.success : palette.inkTertiary,
                            flexShrink: 0,
                          }}
                        >
                          {String.fromCharCode(65 + index)}.
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            color: isCorrect ? palette.success : palette.inkSecondary,
                            fontWeight: isCorrect ? 700 : 400,
                            minWidth: 0,
                            overflowWrap: 'anywhere',
                          }}
                        >
                          {option}
                        </Typography>
                        {isCorrect && (
                          <CheckCircle sx={{ fontSize: 15, color: palette.success, ml: 'auto', flexShrink: 0 }} />
                        )}
                      </Box>
                    );
                  })}
                </Stack>
              )}

              <Box
                sx={{
                  display: 'flex',
                  gap: 0.75,
                  flexWrap: 'wrap',
                  mt: 2,
                  pt: 1.75,
                  borderTop: `1px solid ${palette.border}`,
                }}
              >
                <Chip
                  label={question.type.replace('-', ' ').toUpperCase()}
                  color={getTypeColor(question.type)}
                  size="small"
                />
                <Chip
                  label={question.difficulty.toUpperCase()}
                  color={getDifficultyColor(question.difficulty)}
                  size="small"
                />
                <Chip label={`${question.points} points`} size="small" variant="outlined" />
                {question.topic && <Chip label={question.topic} size="small" variant="outlined" />}
                {question.subject && (
                  <Chip label={question.subject} size="small" variant="outlined" color="primary" />
                )}
                {question.tags?.map((tag) => (
                  <Chip key={tag} label={tag} size="small" variant="outlined" />
                ))}
              </Box>
            </Paper>
          ))}
        </Stack>
      )}

      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        maxWidth="md"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>{editingId ? 'Edit question' : 'Add New Question'}</DialogTitle>
        <DialogContent>
          <Field label="Question" required>
            <TextField
              multiline
              rows={3}
              placeholder="Type the question stem…"
              value={draft.question}
              onChange={(e) => setDraft({ ...draft, question: e.target.value })}
            />
          </Field>

          <FieldRow>
            <Field label="Question Type">
              <Select value={draft.type} fullWidth onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
                <MenuItem value="multiple-choice">Multiple Choice</MenuItem>
                <MenuItem value="true-false">True/False</MenuItem>
                <MenuItem value="short-answer">Short Answer</MenuItem>
                <MenuItem value="essay">Essay</MenuItem>
              </Select>
            </Field>
            <Field label="Difficulty">
              <Select value={draft.difficulty} fullWidth onChange={(e) => setDraft({ ...draft, difficulty: e.target.value })}>
                <MenuItem value="easy">Easy</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="hard">Hard</MenuItem>
              </Select>
            </Field>
          </FieldRow>

          <FieldRow>
            <Field label="Points">
              <TextField
                type="number"
                value={draft.points}
                onChange={(e) => setDraft({ ...draft, points: Number(e.target.value) })}
              />
            </Field>
            <Field label="Topic">
              <TextField
                placeholder="e.g. SQL Basics"
                value={draft.topic}
                onChange={(e) => setDraft({ ...draft, topic: e.target.value })}
              />
            </Field>
          </FieldRow>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setOpenDialog(false); setEditingId(null); setDraft(emptyDraft); }}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleAddQuestion}>
            {editingId ? 'Save changes' : 'Add Question'}
          </Button>
        </DialogActions>
      </Dialog>
      {ToastHost}
      {ConfirmHost}
    </PageContainer>
  );
}
