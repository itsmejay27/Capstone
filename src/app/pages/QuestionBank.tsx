import { useState } from 'react';
import { useAuth, mockQuestionBank } from '../context/AuthContext';
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
  const { currentUser } = useAuth();
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterDifficulty, setFilterDifficulty] = useState('all');
  const [filterSubject, setFilterSubject] = useState('all');
  const [openDialog, setOpenDialog] = useState(false);

  const isInstructor = currentUser?.role === 'instructor';

  const filteredQuestions = mockQuestionBank.filter((q) => {
    const matchesSearch = q.question.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || q.type === filterType;
    const matchesDifficulty = filterDifficulty === 'all' || q.difficulty === filterDifficulty;
    const matchesSubject = filterSubject === 'all' || q.subject === filterSubject;
    return matchesSearch && matchesType && matchesDifficulty && matchesSubject;
  });

  const subjects = Array.from(new Set(mockQuestionBank.map((q) => q.subject).filter(Boolean)));

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
            <Button variant="contained" startIcon={<Add />} onClick={() => setOpenDialog(true)}>
              Add Question
            </Button>
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
                borderRadius: radius.lg,
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
                    <IconButton size="small" aria-label="Edit question">
                      <Edit sx={{ fontSize: 18, color: palette.inkSecondary }} />
                    </IconButton>
                    <IconButton size="small" aria-label="Delete question">
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
                          borderRadius: radius.sm,
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
        <DialogTitle>Add New Question</DialogTitle>
        <DialogContent>
          <Field label="Question" required>
            <TextField multiline rows={3} placeholder="Type the question stem…" />
          </Field>

          <FieldRow>
            <Field label="Question Type">
              <Select defaultValue="multiple-choice" fullWidth>
                <MenuItem value="multiple-choice">Multiple Choice</MenuItem>
                <MenuItem value="true-false">True/False</MenuItem>
                <MenuItem value="short-answer">Short Answer</MenuItem>
                <MenuItem value="essay">Essay</MenuItem>
              </Select>
            </Field>
            <Field label="Difficulty">
              <Select defaultValue="medium" fullWidth>
                <MenuItem value="easy">Easy</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="hard">Hard</MenuItem>
              </Select>
            </Field>
          </FieldRow>

          <FieldRow>
            <Field label="Points">
              <TextField type="number" />
            </Field>
            <Field label="Topic">
              <TextField placeholder="e.g. SQL Basics" />
            </Field>
          </FieldRow>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => setOpenDialog(false)}>
            Add Question
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
}
