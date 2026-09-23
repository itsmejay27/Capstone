import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import OllamaConfigControl, { AIEngineType } from '../components/OllamaConfigControl';
import { generateReviewerWithOllama, extractFilesContent } from '../services/ollamaService';
import { generateReviewerWithGemini, buildTopicDrivenModules } from '../services/geminiService';
import {
  Container, Paper, Typography, Box, TextField, Button, Grid,
  FormControl, InputLabel, Select, MenuItem, Chip, LinearProgress,
  Card, CardContent, Alert,
} from '@mui/material';
import {
  ArrowBack, AutoAwesome, Upload, School, Article, CheckCircle, ArrowForward,
} from '@mui/icons-material';

// ─────────────────────────────────────────────
// Difficulty configuration
// ─────────────────────────────────────────────
const DIFFICULTY_CONFIG: Record<string, any> = {
  none: { moduleCount: 1, itemsPerModule: 10, label: 'Direct Quiz Only (No Modules – 10 items)', topics: ['Direct Practice Quiz'] },
  easy: { moduleCount: 3, itemsPerModule: 5, label: 'Easy – True or False (3 modules × 5 items)', topics: ['Introduction & Overview', 'Core Concepts & Definitions', 'Review & Practical Application'] },
  normal: { moduleCount: 5, itemsPerModule: 8, label: 'Normal – Multiple Choice (5 modules × 8 items)', topics: ['Introduction & Fundamentals', 'Key Principles', 'Methods & Approaches', 'Practical Applications', 'Synthesis & Mastery'] },
  hard: { moduleCount: 8, itemsPerModule: 12, label: 'Hard – Mixed MC + Identification (8 modules × 12 items)', topics: ['Introduction & Context', 'Foundational Principles', 'Core Methodologies', 'Analytical Frameworks', 'Advanced Applications', 'Critical Evaluation', 'Problem-Solving Strategies', 'Comprehensive Integration'] },
};

// ─────────────────────────────────────────────
// Lesson content generator
// ─────────────────────────────────────────────
function generateLesson(subject: string, topic: string, num: number, total: number): string {
  return `**${topic}**

Welcome to Module ${num} of ${total}. This section covers *${topic}* as it applies to **${subject}**. Read carefully before taking the quiz.

---

**Learning Objectives**

By completing this module, you will be able to:
1. Explain the core principles of ${topic.toLowerCase()} within ${subject}.
2. Identify key components and their relationships.
3. Apply your understanding in structured assessment contexts.
4. Connect theoretical concepts to practical scenarios.

---

**Introduction**

The study of ${subject} requires a solid understanding of its components, one of which is **${topic.toLowerCase()}**. Scholars in the field emphasize that learners who engage deeply with this material demonstrate significantly stronger academic and professional outcomes.

This module provides the conceptual grounding necessary to tackle the assessment that follows. As you read, note recurring themes and key terminology.

---

**Core Discussion**

${topic} in ${subject} is best understood as a multifaceted area requiring both knowledge and application. At its core, this topic explores how fundamental ideas are structured, how they interact, and how they can be applied in real-world contexts.

Researchers and educators agree that students who approach ${subject} with curiosity and systematic thinking are better prepared to navigate complex scenarios. The goal is not simply to memorize information, but to internalize concepts in a way that supports flexible, critical thinking.

Every concept in ${subject} is interconnected. Ideas introduced here form a foundation for subsequent modules, so a solid understanding is essential for continued progress.

---

**Key Points**

• **${topic}** is a central component of ${subject}.
• Active engagement with the material significantly improves retention.
• Practical application reinforces theoretical understanding.
• A minimum passing score of **80%** is required to advance to the next module.
• If you do not pass the quiz, you may retry after reviewing this lesson.

---

**Summary**

You have completed the reading for Module ${num}. Focus especially on the learning objectives — the quiz is designed to test your mastery of these specific areas. When ready, click **"Start Quiz"** to begin.`.trim();
}

// ─────────────────────────────────────────────
// Question generators
// ─────────────────────────────────────────────
function makeTrueFalse(subject: string, topic: string, moduleNum: number) {
  const ts = Date.now();
  return [
    { q: `${subject} is fundamentally concerned with the study of ${topic.toLowerCase()} and its related concepts.`, a: 'true', exp: `Correct. ${topic} is a central component of ${subject} and plays an important role in overall understanding.` },
    { q: `The concepts introduced in Module ${moduleNum} are considered optional and do not affect comprehension of ${subject}.`, a: 'false', exp: `Incorrect. Module ${moduleNum} covers foundational material that is essential for understanding subsequent concepts.` },
    { q: `Students who actively engage with ${topic.toLowerCase()} demonstrate better academic outcomes in ${subject}.`, a: 'true', exp: `Correct. Research consistently shows that active engagement with core topics leads to improved performance.` },
    { q: `It is possible to fully master ${subject} by completely skipping the study of ${topic.toLowerCase()}.`, a: 'false', exp: `Incorrect. Skipping ${topic.toLowerCase()} would create significant gaps in a learner's understanding of ${subject}.` },
    { q: `A passing score of 80% is required in each module quiz to advance to the next module in this reviewer.`, a: 'true', exp: `Correct. Each module quiz requires a minimum score of 80% before the next module is unlocked.` },
  ].map((s, i) => ({ id: `q-${ts}-${moduleNum}-tf-${i}`, type: 'true-false', question: s.q, correctAnswer: s.a, explanation: s.exp }));
}

function makeMC(subject: string, topic: string, moduleNum: number) {
  const ts = Date.now();
  return [
    { q: `Which best describes the role of ${topic.toLowerCase()} in ${subject}?`, opts: [`Forms a core component essential for comprehension`, `An advanced topic unrelated to fundamentals`, `Studied only in graduate-level programs`, `Exclusively a memorization exercise`], a: 0, exp: `${topic} serves as a core component in ${subject}, essential for building comprehensive understanding.` },
    { q: `What is the primary benefit of mastering ${topic.toLowerCase()} in ${subject}?`, opts: [`It has no impact on performance`, `It enables a structured approach to solving complex problems`, `It replaces the need for any other subject knowledge`, `It is useful only in examinations`], a: 1, exp: `Mastering ${topic.toLowerCase()} provides learners with a structured framework for approaching complex problems.` },
    { q: `Which statement about ${topic.toLowerCase()} in ${subject} is most accurate?`, opts: [`Entirely theoretical with no practical value`, `Requires no prior knowledge to understand fully`, `Its principles interconnect with other areas of ${subject}`, `A recent addition with unproven relevance`], a: 2, exp: `The principles of ${topic.toLowerCase()} are interconnected with other areas of ${subject}.` },
    { q: `When a student actively engages with ${topic.toLowerCase()}, they are most likely to:`, opts: [`Become overwhelmed by unnecessary details`, `Strengthen their conceptual foundation in ${subject}`, `Replace practical skills with theory`, `Reduce their overall understanding`], a: 1, exp: `Active engagement strengthens the conceptual foundation needed for deeper study of ${subject}.` },
    { q: `Which approach to learning ${subject} is considered most effective?`, opts: [`Passive reading without note-taking`, `Focusing only on memorizing definitions`, `Engaging actively with structured modules and self-assessment`, `Avoiding complex concepts until the final exam`], a: 2, exp: `Active engagement through structured modules and self-assessment is recognized as the most effective approach.` },
    { q: `In Module ${moduleNum}, ${topic.toLowerCase()} is best understood as:`, opts: [`An isolated concept unrelated to other modules`, `A foundational element that supports advanced topics`, `A supplementary topic with limited relevance`, `A concept requiring no prior background`], a: 1, exp: `${topic} is foundational in ${subject} and directly supports understanding of more advanced topics.` },
    { q: `Why is achieving at least 80% on each module quiz important?`, opts: [`It is symbolic with no practical significance`, `It ensures foundational knowledge is consolidated before advancing`, `It is optional for motivated learners`, `It replaces the need to read lesson content`], a: 1, exp: `The 80% requirement ensures learners consolidate foundational knowledge before progressing to complex material.` },
    { q: `Which best characterizes the relationship between ${topic.toLowerCase()} and other topics in ${subject}?`, opts: [`Completely independent with no overlap`, `${topic} is a prerequisite for understanding several related concepts`, `They can be studied in any order without consequence`, `${topic} is less important than all other topics`], a: 1, exp: `${topic} serves as a prerequisite for several related concepts, highlighting its foundational importance.` },
  ].map((q, i) => ({ id: `q-${ts}-${moduleNum}-mc-${i}`, type: 'multiple-choice', question: q.q, options: q.opts, correctAnswer: q.a, explanation: q.exp }));
}

function makeMixed(subject: string, topic: string, moduleNum: number) {
  const ts = Date.now();
  const mc = [
    { q: `Which best describes the role of ${topic.toLowerCase()} in ${subject}?`, opts: [`Forms a core essential component`, `An advanced unrelated topic`, `Only studied in graduate programs`, `A memorization exercise`], a: 0, exp: `${topic} is a core essential component of ${subject}.` },
    { q: `What is the primary benefit of mastering ${topic.toLowerCase()}?`, opts: [`No impact on performance`, `Enables structured problem-solving`, `Replaces all other knowledge`, `Useful only in exams`], a: 1, exp: `Mastering ${topic.toLowerCase()} enables structured problem-solving in ${subject}.` },
    { q: `Which statement about ${topic.toLowerCase()} is most accurate?`, opts: [`Entirely theoretical`, `Requires no prior knowledge`, `Interconnects with other areas of ${subject}`, `A recent unproven addition`], a: 2, exp: `The principles of ${topic.toLowerCase()} are interconnected with other areas of ${subject}.` },
    { q: `Active engagement with ${topic.toLowerCase()} most likely results in:`, opts: [`Overwhelming detail`, `Strengthened conceptual foundation`, `Replacing practical skills`, `Reduced understanding`], a: 1, exp: `Active engagement strengthens the conceptual foundation in ${subject}.` },
    { q: `Which approach is most effective for learning ${subject}?`, opts: [`Passive reading`, `Memorizing definitions only`, `Active structured modules with self-assessment`, `Avoiding complex concepts`], a: 2, exp: `Active structured learning with self-assessment is most effective.` },
    { q: `The minimum quiz score required to advance to the next module is:`, opts: [`60%`, `70%`, `75%`, `80%`], a: 3, exp: `A minimum score of 80% is required to advance.` },
    { q: `In the context of ${subject}, ${topic.toLowerCase()} is best characterized as:`, opts: [`An isolated concept`, `A foundational element supporting advanced topics`, `A supplementary optional topic`, `Requires no academic background`], a: 1, exp: `${topic} is foundational to advanced topics in ${subject}.` },
  ].map((q, i) => ({ id: `q-${ts}-${moduleNum}-mc-${i}`, type: 'multiple-choice', question: q.q, options: q.opts, correctAnswer: q.a, explanation: q.exp }));

  const id = [
    { q: `What is the minimum passing percentage required to advance to the next module?`, a: '80', exp: `Students must score at least 80% on each module quiz to unlock the next module.` },
    { q: `What term describes the study approach that involves engaging actively with structured material and self-assessment?`, a: 'active learning', exp: `Active learning involves direct engagement with material and self-assessment to improve retention.` },
    { q: `Identify the difficulty level in this reviewer that uses True or False questions exclusively.`, a: 'easy', exp: `The Easy difficulty level uses True or False questions with 3 modules of 5 items each.` },
    { q: `What is the number of modules in the Hard difficulty reviewer?`, a: '8', exp: `The Hard difficulty level contains 8 modules, each requiring 80% to advance.` },
    { q: `Name the component of ${subject} covered in Module ${moduleNum} of this reviewer.`, a: topic.split('&')[0].trim().toLowerCase(), exp: `Module ${moduleNum} covers the concept of ${topic} within the study of ${subject}.` },
  ].map((q, i) => ({ id: `q-${ts}-${moduleNum}-id-${i}`, type: 'identification', question: q.q, correctAnswer: q.a, explanation: q.exp }));

  return [...mc, ...id];
}

function generateModules(subject: string, difficulty: 'none' | 'easy' | 'normal' | 'hard') {
  const config = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.normal;
  return buildTopicDrivenModules(subject, difficulty, config.moduleCount, config.itemsPerModule);
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────
export default function ReviewerGenerator() {
  const { toast, ToastHost } = useToast();
  const { saveReviewer, classrooms, classroomMaterials, currentUser } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(0); // 0 = source, 1 = configure
  const [generating, setGenerating] = useState(false);

  // Step 0 – source
  const [selectedClassroomId, setSelectedClassroomId] = useState('');
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [promptText, setPromptText] = useState('');

  // Step 1 – configure
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [difficulty, setDifficulty] = useState<'none' | 'easy' | 'normal' | 'hard'>('normal');

  // AI Engine states
  const [aiEngine, setAiEngine] = useState<AIEngineType>('gemini');
  const [geminiModel, setGeminiModel] = useState('gemini-3.5-flash-lite');
  const [ollamaModel, setOllamaModel] = useState('llama3.2:latest');
  const [ollamaUrl, setOllamaUrl] = useState('/api/ollama');

  const userClassrooms = classrooms.filter((c) =>
    currentUser?.role === 'student'
      ? c.students.includes(currentUser?.id || '')
      : c.instructorId === currentUser?.id
  );
  const availableMaterials = selectedClassroomId ? (classroomMaterials[selectedClassroomId] || []) : [];
  const selectedMaterial = availableMaterials.find((m) => m.id === selectedMaterialId);

  /**
   * Everything the AI should study from: the chosen class material (a teacher's handout or
   * module), an uploaded file, or both. A material that only has a file link is downloaded
   * and read the same way an upload is. Previously the chosen material was never sent.
   */
  const gatherSourceText = async (): Promise<string> => {
    const parts: string[] = [];
    if (selectedMaterial) {
      if (selectedMaterial.content && String(selectedMaterial.content).trim()) {
        parts.push(`From class material "${selectedMaterial.name}":\n${selectedMaterial.content}`);
      } else if (selectedMaterial.fileUrl) {
        try {
          const res = await fetch(selectedMaterial.fileUrl);
          const blob = await res.blob();
          const file = new File([blob], selectedMaterial.name || 'material', { type: blob.type || selectedMaterial.type || '' });
          const text = await extractFilesContent([file]);
          if (text.trim()) parts.push(`From class material "${selectedMaterial.name}":\n${text}`);
        } catch (err) {
          console.warn('Could not read the class material:', err);
          toast(`Could not read "${selectedMaterial.name}". Using your topic and uploads only.`, 'error');
        }
      }
    }
    if (uploadedFile) {
      const text = await extractFilesContent([uploadedFile]);
      if (text.trim()) parts.push(`From uploaded file "${uploadedFile.name}":\n${text}`);
    }
    return parts.join('\n\n');
  };

  const handleGenerate = async () => {
    // A material or an upload is enough on its own — no need to also type a topic.
    if (!title.trim() && !subject.trim() && !promptText.trim() && !selectedMaterial && !uploadedFile) return;
    setGenerating(true);

    const sourceName = (selectedMaterial?.name || uploadedFile?.name || '').replace(/\.[^.]+$/, '');
    const effectiveSubject = subject.trim() || promptText.trim().substring(0, 40) || sourceName || 'General Subject';
    const effectiveTitle = title.trim() || `Reviewer - ${effectiveSubject}`;
    const effectiveInstructions = promptText.trim() 
      ? `Topic / Instruction: ${promptText.trim()}`
      : `Subject: ${effectiveSubject}`;

    const config = DIFFICULTY_CONFIG[difficulty];
    let modules: any[] = [];

    if (aiEngine === 'gemini') {
      try {
        const extractedText = await gatherSourceText();
        modules = await generateReviewerWithGemini({
          model: geminiModel,
          subject: effectiveSubject,
          difficulty,
          customInstructions: effectiveInstructions,
          uploadedText: extractedText,
        });
      } catch (err: any) {
        console.error('Gemini reviewer generation failed:', err);
        toast(`Gemini AI error: ${err.message || err}`, 'error');
        setGenerating(false);
        return;
      }
    } else {
      try {
        const extractedText = await gatherSourceText();
        modules = await generateReviewerWithOllama({
          model: ollamaModel,
          subject: effectiveSubject,
          difficulty,
          customInstructions: effectiveInstructions,
          uploadedText: extractedText,
          baseUrl: ollamaUrl,
        });
      } catch (err: any) {
        console.error('Ollama reviewer generation failed:', err);
        toast(`Ollama error: ${err.message || err}`, 'error');
        setGenerating(false);
        return;
      }
    }

    const newReviewer = {
      id: `rev-${Date.now()}`,
      title: effectiveTitle,
      subject: effectiveSubject,
      difficulty,
      difficultyLabel: config.label,
      moduleCount: modules.length || config.moduleCount,
      itemsPerModule: config.itemsPerModule,
      source: selectedMaterial
        ? `Classroom: ${selectedMaterial.name}`
        : uploadedFile ? `File: ${uploadedFile.name}`
          : promptText.trim() ? 'Custom Prompt'
            : 'Manual Input',
      modules,
      currentModuleIndex: 0,
      status: 'in-progress',
      createdAt: new Date().toISOString(),
    };

    saveReviewer(newReviewer);
    setGenerating(false);
    navigate('/reviewer');
  };

  // ── Generating loading screen ──────────────
  if (generating) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Paper sx={{ p: 6, borderRadius: 4, textAlign: 'center', boxShadow: '0 12px 40px rgba(4,120,87,0.15)' }}>
          <AutoAwesome sx={{
            fontSize: 72, color: 'var(--c-emerald-700)', mb: 3,
            animation: 'pulseSpin 3s infinite ease-in-out',
            '@keyframes pulseSpin': {
              '0%': { transform: 'rotate(0deg) scale(1)', filter: 'drop-shadow(0 0 0px rgba(4,120,87,0))' },
              '50%': { transform: 'rotate(180deg) scale(1.2)', filter: 'drop-shadow(0 0 18px rgba(4,120,87,0.5))' },
              '100%': { transform: 'rotate(360deg) scale(1)', filter: 'drop-shadow(0 0 0px rgba(4,120,87,0))' },
            },
          }} />
          <Typography variant="h5" fontWeight="bold" gutterBottom sx={{ color: '#022c22' }}>
            {aiEngine === 'gemini' ? `Google Gemini (${geminiModel})` : `Ollama AI (${ollamaModel})`} Generating Reviewer...
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4, lineHeight: 1.7 }}>
            Creating {DIFFICULTY_CONFIG[difficulty].moduleCount} modules with lesson content and{' '}
            {DIFFICULTY_CONFIG[difficulty].itemsPerModule} questions each for <strong>{subject}</strong>.
          </Typography>
          <LinearProgress color="secondary" sx={{ maxWidth: 380, mx: 'auto', height: 7, borderRadius: 4 }} />
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Button startIcon={<ArrowBack />} onClick={() => navigate('/dashboard')} sx={{ mb: 3 }}>
        Back to Dashboard
      </Button>

      {/* Header */}
      <Paper sx={{ mb: 4, borderRadius: 4, overflow: 'hidden', boxShadow: '0 8px 30px rgba(88,28,135,0.12)' }}>
        <Box sx={{ background: 'linear-gradient(135deg, var(--c-purple-900) 0%, var(--c-emerald-400) 100%)', p: { xs: 3, md: 4 }, color: 'white' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ width: 56, height: 56, borderRadius: 3, background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <AutoAwesome sx={{ fontSize: 30 }} />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight="bold" sx={{ letterSpacing: '-0.01em' }}>
                AI Reviewer Generator
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.85 }}>
                Choose a study source, set difficulty, and the AI will build a structured module-based reviewer.
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Step indicator pills */}
        <Box sx={{ px: { xs: 2, md: 4 }, py: 2, bgcolor: 'var(--c-purple-50)', borderTop: '1px solid rgba(168,85,247,0.15)', display: 'flex', gap: 2, alignItems: 'center' }}>
          {['Study Source', 'Configure & Generate'].map((label, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{
                width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: step >= i ? 'linear-gradient(135deg, var(--c-purple-900), var(--c-emerald-400))' : 'var(--c-slate-200)',
                color: step >= i ? 'white' : 'var(--c-slate-500)', fontWeight: 'bold', fontSize: '0.8rem',
              }}>
                {step > i ? <CheckCircle sx={{ fontSize: 16 }} /> : i + 1}
              </Box>
              <Typography variant="body2" fontWeight={step === i ? 700 : 400} color={step === i ? 'var(--c-purple-900)' : 'text.secondary'}>
                {label}
              </Typography>
              {i < 1 && <Box sx={{ width: 32, height: 2, bgcolor: step > i ? 'var(--c-emerald-400)' : 'var(--c-slate-200)', borderRadius: 1 }} />}
            </Box>
          ))}
        </Box>
      </Paper>

      {/* ── STEP 0: Study Source ── */}
      {step === 0 && (
        <Paper sx={{ p: { xs: 3, md: 4 }, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.07)' }}>
          <Typography variant="h6" fontWeight="bold" gutterBottom>Select Study Source</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Choose where the AI should pull content from — a classroom material, your own upload, or a topic prompt. This is optional; you can also skip and enter a topic directly.
          </Typography>

          {/* Classroom selector */}
          <FormControl fullWidth sx={{ mb: 2.5 }}>
            <InputLabel>Select Classroom (optional)</InputLabel>
            <Select
              value={selectedClassroomId}
              onChange={(e) => { setSelectedClassroomId(e.target.value); setSelectedMaterialId(''); }}
              label="Select Classroom (optional)"
            >
              <MenuItem value=""><em>None — I'll upload or type my own notes</em></MenuItem>
              {userClassrooms.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <School fontSize="small" color="primary" />
                    {c.name} &bull; {c.subject}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Classroom materials list */}
          {selectedClassroomId && availableMaterials.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                Materials from classroom — pick one to base the reviewer on:
              </Typography>
              <Grid container spacing={1.5}>
                {availableMaterials.map((mat) => (
                  <Grid size={12} key={mat.id}>
                    <Paper
                      onClick={() => setSelectedMaterialId(mat.id === selectedMaterialId ? '' : mat.id)}
                      elevation={0}
                      sx={{
                        width: '100%',
                        cursor: 'pointer',
                        borderRadius: 3,
                        border: mat.id === selectedMaterialId ? '1px solid var(--c-emerald-400)' : '1px solid var(--c-slate-200)',
                        borderLeft: `6px solid ${mat.id === selectedMaterialId ? 'var(--c-emerald-400)' : 'var(--c-slate-400)'}`,
                        bgcolor: mat.id === selectedMaterialId ? 'var(--c-purple-50)' : 'var(--c-surface)',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          borderColor: 'var(--c-emerald-400)',
                          boxShadow: '0 8px 20px rgba(168,85,247,0.06)'
                        },
                        p: 2.5,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 2,
                        boxSizing: 'border-box'
                      }}
                    >
                      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', minWidth: 0, flexGrow: 1 }}>
                        <Box sx={{
                          width: 40,
                          height: 40,
                          borderRadius: 2,
                          bgcolor: mat.id === selectedMaterialId ? 'var(--c-emerald-100)' : 'var(--c-slate-100)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <Article sx={{ color: mat.id === selectedMaterialId ? 'var(--c-emerald-400)' : 'var(--c-slate-400)', fontSize: 22 }} />
                        </Box>
                        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                          <Typography variant="subtitle2" fontWeight={800} sx={{ color: 'text.primary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {mat.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mt: 0.5, display: 'block' }}>
                            Uploaded: {new Date(mat.uploadedAt).toLocaleDateString()}
                          </Typography>
                        </Box>
                      </Box>
                      {mat.id === selectedMaterialId && <CheckCircle sx={{ color: 'var(--c-emerald-400)', fontSize: 24, flexShrink: 0 }} />}
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          {selectedClassroomId && availableMaterials.length === 0 && (
            <Alert severity="info" sx={{ mb: 3 }}>No materials uploaded in this classroom yet. You can upload your own notes below.</Alert>
          )}

          {/* Own upload / prompt */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box>
              <Typography variant="subtitle2" fontWeight="bold" gutterBottom>Upload Your Own Notes (optional)</Typography>
              <Button variant="outlined" component="label" startIcon={<Upload />} color="secondary">
                Upload Document
                <input type="file" hidden accept=".pdf,.doc,.docx,.txt" onChange={(e) => { const f = e.target.files?.[0]; if (f) setUploadedFile(f); e.target.value = ''; }} />
              </Button>
              {uploadedFile && (
                <Chip label={uploadedFile.name} onDelete={() => setUploadedFile(null)} sx={{ ml: 2 }} color="secondary" variant="outlined" />
              )}
            </Box>
            <TextField
              fullWidth multiline rows={3}
              label="Paste Study Notes / Topic Description (optional)"
              placeholder="Paste lecture notes, definitions, or describe the topic for the AI to use..."
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
            />
          </Box>

          <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button variant="text" onClick={() => setStep(1)}>Skip — Enter Topic Manually</Button>
            <Button variant="contained" color="secondary" endIcon={<ArrowForward />} onClick={() => setStep(1)}>
              Next: Configure
            </Button>
          </Box>
        </Paper>
      )}

      {/* ── STEP 1: Configure & Generate ── */}
      {step === 1 && (
        <Paper sx={{ p: { xs: 3, md: 4 }, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.07)' }}>
          <Typography variant="h6" fontWeight="bold" gutterBottom>Configure Your Reviewer</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Set a title, subject, and difficulty. The AI will generate structured modules with lesson content and quiz questions.
          </Typography>

          {(selectedMaterial || uploadedFile || promptText.trim()) && (
            <Alert severity="info" sx={{ mb: 3 }}>
              {selectedMaterial ? `Basing reviewer on: "${selectedMaterial.name}"` :
                uploadedFile ? `Using uploaded file: "${uploadedFile.name}"` :
                  'Using your custom prompt as study material.'}
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <TextField fullWidth label="Reviewer Title" placeholder="e.g. Study Prep – Database Normalization"
              value={title} onChange={(e) => setTitle(e.target.value)} required />

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField fullWidth label="Subject / Specific Topic" placeholder="e.g. Database Normalization"
                  value={subject} onChange={(e) => setSubject(e.target.value)} required />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormControl fullWidth required>
                  <InputLabel>Difficulty Level</InputLabel>
                  <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value as any)} label="Difficulty Level">
                    <MenuItem value="none">
                      <Box>
                        <Typography variant="body2" fontWeight="bold" color="secondary.main">⚡ Direct Quiz Only (No Modules)</Typography>
                        <Typography variant="caption" color="text.secondary">Single Study Quiz — 10 practice items (No multi-module breaks)</Typography>
                      </Box>
                    </MenuItem>
                    <MenuItem value="easy">
                      <Box>
                        <Typography variant="body2" fontWeight="bold">Easy</Typography>
                        <Typography variant="caption" color="text.secondary">True or False — 3 modules × 5 items</Typography>
                      </Box>
                    </MenuItem>
                    <MenuItem value="normal">
                      <Box>
                        <Typography variant="body2" fontWeight="bold">Normal</Typography>
                        <Typography variant="caption" color="text.secondary">Multiple Choice — 5 modules × 8 items</Typography>
                      </Box>
                    </MenuItem>
                    <MenuItem value="hard">
                      <Box>
                        <Typography variant="body2" fontWeight="bold">Hard</Typography>
                        <Typography variant="caption" color="text.secondary">MC + Identification — 8 modules × 12 items</Typography>
                      </Box>
                    </MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            {/* AI Engine Settings */}
            <Box sx={{ mt: 1 }}>
              <OllamaConfigControl
                engine={aiEngine}
                onEngineChange={setAiEngine}
                selectedModel={ollamaModel}
                onModelChange={setOllamaModel}
                ollamaUrl={ollamaUrl}
                onUrlChange={setOllamaUrl}
                geminiModel={geminiModel}
                onGeminiModelChange={setGeminiModel}
              />
            </Box>

            {/* Difficulty summary card */}
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, bgcolor: 'var(--c-purple-50)', borderColor: 'var(--c-emerald-200)' }}>
              <Typography variant="subtitle2" fontWeight="bold" color="var(--c-purple-900)" gutterBottom>
                Selected: {DIFFICULTY_CONFIG[difficulty].label}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Chip size="small" label={`${DIFFICULTY_CONFIG[difficulty].moduleCount} Modules`} sx={{ bgcolor: 'var(--c-emerald-100)', color: 'var(--c-purple-900)' }} />
                <Chip size="small" label={`${DIFFICULTY_CONFIG[difficulty].itemsPerModule} Questions / Module`} sx={{ bgcolor: 'var(--c-emerald-100)', color: 'var(--c-purple-900)' }} />
                <Chip size="small" label="80% Pass Threshold per Module" sx={{ bgcolor: 'var(--c-emerald-100)', color: 'var(--c-purple-900)' }} />
              </Box>
            </Paper>
          </Box>

          <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <Button variant="outlined" onClick={() => setStep(0)} startIcon={<ArrowBack />}>Back</Button>
            <Button
              variant="contained" color="secondary" size="large"
              startIcon={<AutoAwesome />}
              onClick={handleGenerate}
              disabled={!title.trim() && !subject.trim() && !promptText.trim() && !selectedMaterial && !uploadedFile}
              sx={{
                py: 1.5, fontWeight: 'bold',
                background: 'linear-gradient(135deg, var(--c-purple-900) 0%, var(--c-emerald-400) 100%)',
                boxShadow: '0 6px 20px rgba(88,28,135,0.3)',
                '&:hover': { boxShadow: '0 8px 24px rgba(88,28,135,0.4)' },
              }}
            >
              Generate AI Reviewer
            </Button>
          </Box>
        </Paper>
      )}
      {ToastHost}
    </Container>
  );
}
