import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth, mockQuestionBank } from '../context/AuthContext';
import {
  Container,
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  ArrowBack,
  Add,
  Edit,
  Delete,
  Search,
  FilterList,
  LibraryBooks,
} from '@mui/icons-material';

export default function QuestionBank() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
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

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate('/dashboard')}
        sx={{ mb: 3 }}
      >
        Back to Dashboard
      </Button>

      <Paper sx={{ p: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <LibraryBooks sx={{ fontSize: 40, color: '#9c27b0', mr: 2 }} />
            <Box>
              <Typography variant="h4" fontWeight="bold">
                Question Bank
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Browse, manage, and reuse questions
              </Typography>
            </Box>
          </Box>
          {isInstructor && (
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setOpenDialog(true)}
            >
              Add Question
            </Button>
          )}
        </Box>

        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              placeholder="Search questions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                label="Type"
              >
                <MenuItem value="all">All Types</MenuItem>
                <MenuItem value="multiple-choice">Multiple Choice</MenuItem>
                <MenuItem value="true-false">True/False</MenuItem>
                <MenuItem value="short-answer">Short Answer</MenuItem>
                <MenuItem value="essay">Essay</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Difficulty</InputLabel>
              <Select
                value={filterDifficulty}
                onChange={(e) => setFilterDifficulty(e.target.value)}
                label="Difficulty"
              >
                <MenuItem value="all">All Levels</MenuItem>
                <MenuItem value="easy">Easy</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="hard">Hard</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Subject</InputLabel>
              <Select
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                label="Subject"
              >
                <MenuItem value="all">All Subjects</MenuItem>
                {subjects.map((subject) => (
                  <MenuItem key={subject} value={subject}>
                    {subject}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<FilterList />}
              sx={{ height: '56px' }}
              onClick={() => {
                setFilterType('all');
                setFilterDifficulty('all');
                setFilterSubject('all');
                setSearchTerm('');
              }}
            >
              Clear
            </Button>
          </Grid>
        </Grid>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Showing {filteredQuestions.length} questions
        </Typography>

        <Grid container spacing={2}>
          {filteredQuestions.map((question) => (
            <Grid size={12} key={question.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="h6" gutterBottom>
                        {question.question}
                      </Typography>
                      {question.options && (
                        <Box sx={{ ml: 2, mt: 1 }}>
                          {question.options.map((option, index) => (
                            <Typography
                              key={index}
                              variant="body2"
                              color={
                                index === question.correctAnswer
                                  ? 'success.main'
                                  : 'text.secondary'
                              }
                              sx={{ fontWeight: index === question.correctAnswer ? 'bold' : 'normal' }}
                            >
                              {String.fromCharCode(65 + index)}. {option}
                            </Typography>
                          ))}
                        </Box>
                      )}
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
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
                    {question.topic && (
                      <Chip label={question.topic} size="small" variant="outlined" />
                    )}
                    {question.subject && (
                      <Chip
                        label={question.subject}
                        size="small"
                        variant="outlined"
                        color="primary"
                      />
                    )}
                    {question.tags?.map((tag) => (
                      <Chip key={tag} label={tag} size="small" variant="outlined" />
                    ))}
                  </Box>
                </CardContent>
                {isInstructor && (
                  <CardActions>
                    <IconButton size="small" color="primary">
                      <Edit />
                    </IconButton>
                    <IconButton size="small" color="error">
                      <Delete />
                    </IconButton>
                  </CardActions>
                )}
              </Card>
            </Grid>
          ))}
        </Grid>

        {filteredQuestions.length === 0 && (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary">
              No questions found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Try adjusting your filters or add new questions
            </Typography>
          </Paper>
        )}
      </Paper>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Add New Question</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Question"
            multiline
            rows={3}
            margin="dense"
            sx={{ mb: 2 }}
          />
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Question Type</InputLabel>
                <Select label="Question Type">
                  <MenuItem value="multiple-choice">Multiple Choice</MenuItem>
                  <MenuItem value="true-false">True/False</MenuItem>
                  <MenuItem value="short-answer">Short Answer</MenuItem>
                  <MenuItem value="essay">Essay</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Difficulty</InputLabel>
                <Select label="Difficulty">
                  <MenuItem value="easy">Easy</MenuItem>
                  <MenuItem value="medium">Medium</MenuItem>
                  <MenuItem value="hard">Hard</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth label="Points" type="number" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField fullWidth label="Topic" />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => setOpenDialog(false)}>
            Add Question
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
