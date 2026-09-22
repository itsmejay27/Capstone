import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import OllamaConfigControl, { AIEngineType } from '../components/OllamaConfigControl';
import { DEFAULT_NVIDIA_MODEL } from '../services/geminiService';
import { generateExamWithOllama, regenerateQuestionWithOllama, regenerateItemsForSpecsOllama } from '../services/ollamaService';
import { generateExamWithGemini, regenerateQuestionWithGemini, buildTopicDrivenQuestions, getStoredGeminiApiKey, regenerateItemsForSpecs } from '../services/geminiService';
import { parseTOSFile, extractFilesContentEnhanced, TOSData, BLOOM_LEVELS } from '../services/tosParser';
import { enforceTOSCompliance, type TOSComplianceReport } from '../services/tosValidator';
import TOSCompliancePanel from '../components/TOSCompliancePanel';
import { useIsMobile } from '../hooks/useResponsive';
import {
  Container,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  Stepper,
  Step,
  StepLabel,
  Grid,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Alert,
  LinearProgress,
  Divider,
  Radio,
  RadioGroup,
  FormControlLabel,
  Checkbox,
  CircularProgress,
} from '@mui/material';
import {
  ArrowBack,
  Upload,
  AutoAwesome,
  Add,
  Delete,
  Save,
  Image as ImageIcon,
  CheckCircle,
  Description as FileIcon,
  ListAlt,
  Tune,
  AccessTime,
  SportsScore,
  TrendingUp,
  Assignment,
  FolderZip,
  Topic,
  Close,
  AssignmentTurnedIn,
  Psychology,
  Lock,
  QuizOutlined,
} from '@mui/icons-material';
import {
  PageContainer,
  PageHeader,
  SectionHeading,
  StatTile,
  EmptyState,
  Field,
  FieldRow,
  palette,
  radius,
  font,
} from '../components/ui-kit';

const steps = ['Exam Details & Configuration', 'Summary Checklist', 'Review & Generate'];

// Preloaded mock images for simulated select
const MOCK_IMAGES = [
  'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400&q=80', // Laptop / Code
  'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400&q=80', // Charts / Work
  'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=400&q=80', // Database / Schema
  'https://images.unsplash.com/photo-1507668077129-56e32842fceb?w=400&q=80', // AI neural net
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

/**
 * Bloom level → token-backed badge colours. Colour carries meaning here (which cognitive
 * level an item sits at), so each level keeps a distinct hue — but they are drawn from the
 * design tokens rather than one-off hexes, with the hairline derived from the same token.
 */
const getBloomBadgeColor = (level?: string) => {
  const norm = (level || '').toLowerCase();
  const badge = (text: string, bg: string) => ({ bg, text, border: `${text}40` });
  if (norm.includes('rememb')) return badge(palette.info, palette.infoSoft);
  if (norm.includes('underst')) return badge(palette.student, palette.studentSoft);
  if (norm.includes('apply') || norm.includes('applic')) return badge(palette.success, palette.successSoft);
  if (norm.includes('analy')) return badge(palette.warning, palette.warningSoft);
  if (norm.includes('eval')) return badge(palette.danger, palette.dangerSoft);
  if (norm.includes('creat')) return badge(palette.instructor, palette.instructorSoft);
  return badge(palette.inkSecondary, palette.surfaceSunken);
};

/** Difficulty → token-backed badge colours, same convention as the Bloom badges. */
const getDifficultyBadgeColor = (level?: string) => {
  const norm = (level || '').toLowerCase();
  if (norm === 'hard') return { bg: palette.dangerSoft, color: palette.danger, border: `1px solid ${palette.danger}40` };
  if (norm === 'medium') return { bg: palette.warningSoft, color: palette.warning, border: `1px solid ${palette.warning}40` };
  if (norm === 'easy') return { bg: palette.successSoft, color: palette.success, border: `1px solid ${palette.success}40` };
  return { bg: palette.primarySoft, color: palette.primary, border: `1px solid ${palette.primaryBorder}` };
};

export default function ExamGenerator() {
  const { toast, ToastHost } = useToast();
  const { classroomId } = useParams();
  const { currentUser, saveExamToRepository } = useAuth();
  const navigate = useNavigate();

  const [activeStep, setActiveStep] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [regeneratingMap, setRegeneratingMap] = useState<Record<string, boolean>>({});

  // Details
  const [examTitle, setExamTitle] = useState('');
  const [examDescription, setExamDescription] = useState('');
  const [duration, setDuration] = useState(60);
  const [totalPoints, setTotalPoints] = useState(50); // Default 50. Limit: count by 10 up to 100.
  const [assessmentType, setAssessmentType] = useState('Midterm Exam'); // 'Midterm Exam', 'Final Exam', 'Other'
  const [customAssessmentType, setCustomAssessmentType] = useState('');

  // Uploads
  const [syllabus, setSyllabus] = useState<File | null>(null);
  const [materials, setMaterials] = useState<File[]>([]);
  const [tos, setTos] = useState<File | null>(null);
  const [tosData, setTosData] = useState<TOSData | null>(null);
  const [isTosParsing, setIsTosParsing] = useState(false);
  const [tosParseError, setTosParseError] = useState<string | null>(null);

  // Question Type Allocations
  const [mcCount, setMcCount] = useState(5);
  const [tfCount, setTfCount] = useState(3);
  const [saCount, setSaCount] = useState(2);
  const [essayCount, setEssayCount] = useState(1);
  const [extraCount, setExtraCount] = useState(3); // Extra questions pool size (e.g. 3 extra)
  const [difficulty, setDifficulty] = useState('medium');
  const [topics, setTopics] = useState<string[]>(['General Subject Matter']);
  const [generationPrompt, setGenerationPrompt] = useState('');

  // Generated list of N + E items
  const [generatedQuestions, setGeneratedQuestions] = useState<any[]>([]);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [newQuestionType, setNewQuestionType] = useState('multiple-choice');

  // AI Engine states
  const [aiEngine, setAiEngine] = useState<AIEngineType>('gemini');
  const [nvidiaModel, setNvidiaModel] = useState(DEFAULT_NVIDIA_MODEL);
  const [geminiModel, setGeminiModel] = useState('gemini-3.6-flash');
  const [ollamaModel, setOllamaModel] = useState('llama3.2:latest');
  const [ollamaUrl, setOllamaUrl] = useState('/api/ollama');
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationStatusText, setGenerationStatusText] = useState('');

  // TOS compliance
  const [tosReport, setTosReport] = useState<TOSComplianceReport | null>(null);
  const [tosOverride, setTosOverride] = useState(false);

  const isMobile = useIsMobile();

  const isTosActive = Boolean(tos);
  const activeQuestionCount = (tosData && tosData.totalItems > 0)
    ? tosData.totalItems
    : (mcCount + tfCount + saCount + essayCount);
  const totalGeneratedCount = (tosData && tosData.totalItems > 0)
    ? tosData.totalItems
    : (activeQuestionCount + extraCount);

  const handleNext = () => {
    if (activeStep === 1) {
      handleGenerateQuestions();
    } else {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleRemoveTos = () => {
    setTos(null);
    setTosData(null);
    setTosParseError(null);
  };

  /**
   * Validate generated questions against the uploaded Table of Specifications and
   * automatically regenerate the items that fail, before the instructor ever sees the result.
   *
   * Only the non-compliant items are re-requested — regenerating the whole exam would discard
   * items that already satisfied the blueprint. If retries are exhausted the questions are
   * still shown, but the compliance panel reports the failure and the Save button is gated
   * behind an explicit override, so a non-compliant exam can never be saved silently.
   */
  const runTosEnforcement = async (
    questions: any[],
    effectiveTos: TOSData | null,
    regenerate: (specs: any[]) => Promise<any[]>
  ): Promise<any[]> => {
    setTosOverride(false);
    if (!effectiveTos || !effectiveTos.itemSpecs || effectiveTos.itemSpecs.length === 0) {
      setTosReport(null);
      return questions;
    }
    const { questions: enforced, report } = await enforceTOSCompliance(
      questions,
      effectiveTos,
      (specs) => regenerate(specs),
      {
        maxAttempts: 3,
        onProgress: (_current, _total, msg) => setGenerationStatusText(msg),
      }
    );
    setTosReport(report);
    if (!report.compliant) {
      setGenerationError(
        `The generated exam does not yet match the Table of Specifications. ${report.summary} ` +
        `Review the compliance report below — you can regenerate, edit the flagged items by hand, ` +
        `or save anyway once you have acknowledged the mismatch.`
      );
    }
    return enforced;
  };

  const handleGenerateQuestions = async () => {
    setActiveStep(2);
    setGenerating(true);
    setGenerationError(null);
    setTosReport(null);

    try {
      setGenerationStatusText(
        isTosActive
          ? `Extracting full TOS matrix & cognitive levels for strict blueprint generation...`
          : `Reading curriculum files and preparing AI generation...`
      );

      const allFiles = [syllabus, tos, ...materials].filter(Boolean) as File[];
      const { text: extractedText, tosData: parsedFromExtractor } = await extractFilesContentEnhanced(allFiles, tos, getStoredGeminiApiKey());
      const effectiveTos = tosData || parsedFromExtractor;

      // Prioritize TOS course title or topic when prompt is empty
      const primarySubject = generationPrompt.trim()
        || (effectiveTos?.courseTitle)
        || (effectiveTos?.topics && effectiveTos.topics[0])
        || topics.find((t) => t && t !== 'General Subject Matter')
        || examTitle.trim()
        || 'General Subject';

      const effectiveTopics = Array.from(new Set([primarySubject, ...topics.filter((t) => t && t !== 'General Subject Matter')]));
      const effectivePrompt = generationPrompt.trim() || primarySubject;

      if (aiEngine === 'gemini' || aiEngine === 'nvidia') {
        try {
          setGenerationStatusText(`Connecting to Google Gemini AI (${geminiModel}) for ${isTosActive ? 'TOS-aligned' : 'topic-driven'} generation on "${primarySubject}"...`);

          const geminiParams = {
            provider: aiEngine === 'nvidia' ? 'nvidia' as const : 'gemini' as const,
            model: aiEngine === 'nvidia' ? nvidiaModel : geminiModel,
            mcCount,
            tfCount,
            saCount,
            essayCount,
            extraCount: isTosActive ? 0 : extraCount,
            difficulty,
            topics: effectiveTopics,
            generationPrompt: effectivePrompt,
            uploadedText: extractedText,
            tosData: effectiveTos,
            onProgress: (_current: number, _total: number, msg: string) => {
              setGenerationStatusText(msg);
            },
          };

          const questions = await generateExamWithGemini(geminiParams);

          // Validate against the TOS and repair only the non-compliant items.
          const finalQuestions = await runTosEnforcement(questions, effectiveTos, (specs) =>
            regenerateItemsForSpecs(specs, geminiParams)
          );
          setGeneratedQuestions(finalQuestions);
        } catch (err: any) {
          console.error('Gemini Generation error:', err);
          const fallbackQuestions = buildTopicDrivenQuestions({
            model: geminiModel,
            mcCount,
            tfCount,
            saCount,
            essayCount,
            extraCount: isTosActive ? 0 : extraCount,
            difficulty,
            topics: effectiveTopics,
            generationPrompt: effectivePrompt,
            tosData: effectiveTos,
          });
          setGeneratedQuestions(fallbackQuestions);
          setGenerationError(`Notice: Cloud AI call hit an error (${err.message || err}). Generated using topic-driven engine fallback.`);
        } finally {
          setGenerating(false);
        }
      } else {
        try {
          setGenerationStatusText(`Prompting local Ollama model (${ollamaModel}) for "${primarySubject}"...`);

          const ollamaParams = {
            model: ollamaModel,
            mcCount,
            tfCount,
            saCount,
            essayCount,
            extraCount: isTosActive ? 0 : extraCount,
            difficulty,
            topics: effectiveTopics,
            generationPrompt: effectivePrompt,
            uploadedText: extractedText,
            baseUrl: ollamaUrl,
            tosData: effectiveTos,
          };

          const questions = await generateExamWithOllama(ollamaParams);

          const finalQuestions = await runTosEnforcement(questions, effectiveTos, (specs) =>
            regenerateItemsForSpecsOllama(specs, ollamaParams)
          );
          setGeneratedQuestions(finalQuestions);
        } catch (err: any) {
          console.error('Ollama Generation error:', err);
          const fallbackQuestions = buildTopicDrivenQuestions({
            model: ollamaModel,
            mcCount,
            tfCount,
            saCount,
            essayCount,
            extraCount: isTosActive ? 0 : extraCount,
            difficulty,
            topics: effectiveTopics,
            generationPrompt: effectivePrompt,
            tosData: effectiveTos,
          });
          setGeneratedQuestions(fallbackQuestions);
          setGenerationError(`Notice: Ollama local AI connection issue (${err.message || err}). Generated using topic-driven engine fallback.`);
        } finally {
          setGenerating(false);
        }
      }
    } catch (outerErr: any) {
      console.error('Generation pipeline error:', outerErr);
      setGenerating(false);
      setGenerationError(`File extraction or generation error: ${outerErr.message || outerErr}`);
    }
  };

  const handleBack = () => {
    if (activeStep === 2) {
      setIsPreviewMode(false);
    }
    setActiveStep((prev) => prev - 1);
  };

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'syllabus' | 'materials' | 'tos'
  ) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      if (type === 'materials') {
        setMaterials([...materials, ...Array.from(files)]);
      } else if (type === 'syllabus') {
        setSyllabus(files[0]);
      } else if (type === 'tos') {
        const file = files[0];
        setTos(file);
        setIsTosParsing(true);
        setTosParseError(null);
        const apiKey = getStoredGeminiApiKey();
        parseTOSFile(file, apiKey)
          .then((parsed) => {
            setTosData(parsed);
            setIsTosParsing(false);
            if (parsed.courseTitle && !examTitle) {
              setExamTitle(`${parsed.courseTitle} Examination`);
            }
            if (parsed.topics && parsed.topics.length > 0) {
              const nonDefault = topics.filter(t => t && t !== 'General Subject Matter');
              if (nonDefault.length === 0) {
                setTopics(parsed.topics);
              }
            }
          })
          .catch((err) => {
            console.error('TOS parsing failed:', err);
            setTosParseError(`Could not extract table matrix: ${err.message || err}. AI will read raw file.`);
            setIsTosParsing(false);
          });
      }
    }
  };

  const addTopic = () => {
    setTopics([...topics, '']);
  };

  const updateTopic = (index: number, value: string) => {
    const newTopics = [...topics];
    newTopics[index] = value;
    setTopics(newTopics);
  };

  const removeTopic = (index: number) => {
    setTopics(topics.filter((_, i) => i !== index));
  };

  // Generate topic-driven questions based on configuration input
  const generateMockQuestions = () => {
    setGenerating(true);
    setTimeout(() => {
      const items = buildTopicDrivenQuestions({
        model: '',
        mcCount,
        tfCount,
        saCount,
        essayCount,
        extraCount,
        difficulty,
        topics,
        generationPrompt,
      });
      setGeneratedQuestions(items);
      setGenerating(false);
    }, 1200);
  };

  // Modify individual question content in editor state
  const handleUpdateQuestionText = (index: number, text: string) => {
    const updated = [...generatedQuestions];
    updated[index].question = text;
    setGeneratedQuestions(updated);
  };

  const handleUpdateQuestionOption = (qIdx: number, oIdx: number, val: string) => {
    const updated = [...generatedQuestions];
    if (updated[qIdx].options) {
      updated[qIdx].options[oIdx] = val;
      setGeneratedQuestions(updated);
    }
  };

  const handleUpdateCorrectAnswer = (index: number, value: any) => {
    const updated = [...generatedQuestions];
    updated[index].correctAnswer = value;
    setGeneratedQuestions(updated);
  };

  const handleUpdatePoints = (index: number, points: number) => {
    const updated = [...generatedQuestions];
    updated[index].points = points;
    setGeneratedQuestions(updated);
  };

  const handleDeleteQuestion = (index: number) => {
    setGeneratedQuestions(generatedQuestions.filter((_, idx) => idx !== index));
  };

  const handleAddNewQuestion = (type: string) => {
    let newQ: any = {
      id: `gq-new-${Date.now()}`,
      type: type,
      question: `New custom ${type === 'multiple-choice' ? 'Multiple Choice' : type === 'true-false' ? 'True/False' : type === 'short-answer' ? 'Short Answer' : 'Essay'} question: Enter text here...`,
      points: type === 'multiple-choice' ? 2 : type === 'true-false' ? 1 : type === 'short-answer' ? 3 : 5,
      difficulty: 'medium',
      cognitiveLevel: 'Applying',
      itemPlacement: generatedQuestions.length + 1,
      topic: topics[0] || 'Custom Topic',
      image: '',
      isExtra: false,
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

    setGeneratedQuestions([...generatedQuestions, newQ]);
  };

  // Simulate image upload by attaching a random curated image
  const handleAttachMockImage = (qIdx: number, optionIdx?: number) => {
    const randomImg = MOCK_IMAGES[Math.floor(Math.random() * MOCK_IMAGES.length)];
    const updated = [...generatedQuestions];
    if (optionIdx !== undefined) {
      if (!updated[qIdx].optionsImages) {
        updated[qIdx].optionsImages = ['', '', '', ''];
      }
      updated[qIdx].optionsImages[optionIdx] = randomImg;
    } else {
      updated[qIdx].image = randomImg;
    }
    setGeneratedQuestions(updated);
  };

  const handleRemoveImage = (qIdx: number, optionIdx?: number) => {
    const updated = [...generatedQuestions];
    if (optionIdx !== undefined) {
      if (updated[qIdx].optionsImages) {
        updated[qIdx].optionsImages[optionIdx] = '';
      }
    } else {
      updated[qIdx].image = '';
    }
    setGeneratedQuestions(updated);
  };

  // Smart AI Regeneration feature
  const handleRegenerateItem = async (index: number, mode: 'full' | 'options' | 'answer') => {
    const q = generatedQuestions[index];
    setRegeneratingMap((prev) => ({ ...prev, [q.id]: true }));

    if (aiEngine === 'gemini' || aiEngine === 'nvidia') {
      try {
        const updatedQ = await regenerateQuestionWithGemini(q, mode, undefined, geminiModel);
        setGeneratedQuestions((prevQuestions) => {
          const updated = [...prevQuestions];
          updated[index] = updatedQ;
          return updated;
        });
      } catch (err) {
        console.warn('Gemini regenerate failed, running mock regenerate:', err);
        runMockRegenerate(index, mode);
      } finally {
        setRegeneratingMap((prev) => ({ ...prev, [q.id]: false }));
      }
    } else {
      try {
        const updatedQ = await regenerateQuestionWithOllama(ollamaModel, q, mode, ollamaUrl);
        setGeneratedQuestions((prevQuestions) => {
          const updated = [...prevQuestions];
          updated[index] = updatedQ;
          return updated;
        });
      } catch (err) {
        console.warn('Ollama regenerate item failed, running mock regeneration:', err);
        runMockRegenerate(index, mode);
      } finally {
        setRegeneratingMap((prev) => ({ ...prev, [q.id]: false }));
      }
    }
  };

  const runMockRegenerate = (index: number, mode: 'full' | 'options' | 'answer') => {
    const q = generatedQuestions[index];
    setTimeout(() => {
      setGeneratedQuestions((prevQuestions) => {
        const updated = [...prevQuestions];
        const currentQ = updated[index];
        const type = currentQ.type;

        if (mode === 'full') {
          // Get lists of alternatives
          const list = ALTERNATIVE_QUESTIONS[type] || [];
          // Pick one that is different from current if possible
          let chosen = list[Math.floor(Math.random() * list.length)];
          if (chosen.question === currentQ.question && list.length > 1) {
            const filtered = list.filter(item => item.question !== currentQ.question);
            chosen = filtered[Math.floor(Math.random() * filtered.length)];
          }

          updated[index] = {
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

            // Fisher-Yates shuffle
            for (let i = originalOptions.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [originalOptions[i], originalOptions[j]] = [originalOptions[j], originalOptions[i]];
            }

            const newCorrectIdx = originalOptions.indexOf(correctText);
            updated[index] = {
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
            updated[index] = {
              ...currentQ,
              question: newText,
              correctAnswer: nextAnswer,
            };
          }
        } else if (mode === 'answer') {
          if (type === 'multiple-choice' && currentQ.options) {
            const newIndex = (currentQ.correctAnswer + 1) % currentQ.options.length;
            updated[index] = {
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
            updated[index] = {
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
            let nextAns = alternatives[currentAns];
            if (!nextAns) {
              const pool = [
                'Specific authoritative domain keyword and standard technical definition',
                'Core terminology with context-specific parameter',
                'Essential conceptual mechanism required for implementation',
                'Standard architectural model and operational specification'
              ];
              nextAns = pool[Math.floor(Math.random() * pool.length)];
            }
            updated[index] = {
              ...currentQ,
              correctAnswer: nextAns,
            };
          } else if (type === 'essay') {
            const rubrics = [
              'Grading Rubric: 1) Thesis Clarity (25%): Clear position addressing the core prompt. 2) Analytical Depth (35%): Evidence-backed evaluation and rigorous deductions. 3) Synthesis & Context (25%): Connection to systemic domain principles. 4) Organization (15%): Structured progression and academic precision.',
              'Evaluation Criteria: Full credit requires: a) Detailed explanation of underlying mechanisms; b) Critical analysis of trade-offs and structural implications; c) Well-reasoned conclusion supported by concrete arguments.',
              'Key Analytical Expectations: Demonstrates mastery of core subject concepts, integrates relevant domain citations, systematically evaluates counter-arguments, and articulates coherent problem-solving logic.'
            ];
            const currentAns = currentQ.correctAnswer || '';
            const chosen = rubrics.find(r => r !== currentAns) || rubrics[0];
            updated[index] = {
              ...currentQ,
              correctAnswer: chosen,
            };
          }
        }

        return updated;
      });

      setRegeneratingMap((prev) => ({ ...prev, [q.id]: false }));
    }, 1500);
  };

  // Save the exam template to the Exam Repository
  const handleSaveExam = () => {
    if (!examTitle.trim()) {
      toast('Please enter an exam title.', 'error');
      return;
    }

    // Belt and braces: the Save buttons are already disabled in this state, but never let a
    // non-compliant exam reach the repository without an explicit acknowledgement.
    if (tosReport && !tosReport.compliant && !tosOverride) {
      toast(
        `This exam does not match the uploaded Table of Specifications. ${tosReport.summary} ` +
        'Regenerate the flagged items, correct them by hand, or tick the acknowledgement box to save anyway.',
        'warning'
      );
      return;
    }

    const savedType = assessmentType === 'Other' ? (customAssessmentType || 'Custom Assessment') : assessmentType;

    const examTemplate = {
      id: `se-${Date.now()}`,
      title: examTitle,
      type: savedType,
      description: examDescription,
      questions: generatedQuestions,
      activeQuestionCount: activeQuestionCount, // Student takes N questions
      extraQuestionCount: extraCount,           // Drawer has E extra
      // With a TOS attached the blueprint's point total is authoritative, not the UI's
      // default of 50 — the two disagreeing is how a 60-item TOS ended up saved as 50 points.
      totalPoints: (tosData && tosData.totalPoints > 0) ? tosData.totalPoints : totalPoints,
      duration: duration,
      createdBy: currentUser?.id || 'instructor',
      createdAt: new Date().toISOString(),
      // Which documents this exam was generated from. Recorded at save time because the
      // File objects live only in this page's state and are gone once it unmounts.
      sourceFiles: [
        ...(tos ? [{ name: tos.name, size: tos.size, kind: 'Table of Specifications' }] : []),
        ...(syllabus ? [{ name: syllabus.name, size: syllabus.size, kind: 'Syllabus' }] : []),
        ...materials.map((f) => ({ name: f.name, size: f.size, kind: 'Course material' })),
      ],
      // Persisted so the repository can show how the exam measured up when it was generated.
      tosCompliance: tosReport
        ? {
            compliant: tosReport.compliant,
            expectedTotal: tosReport.expectedTotal,
            actualTotal: tosReport.actualTotal,
            compliantItemCount: tosReport.compliantItemCount,
            violationCount: tosReport.violations.length,
            attemptsUsed: tosReport.attemptsUsed,
            blueprintFileName: tosReport.blueprintFileName,
            checkedAt: tosReport.checkedAt,
            acknowledgedOverride: tosOverride,
          }
        : undefined,
    };

    saveExamToRepository(examTemplate);
    toast('Exam template saved to the Exam Repository.');
    // Give the confirmation a moment to be read before the page changes under it.
    setTimeout(() => navigate('/exam-repository'), 900);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4, width: '100%', px: { xs: 2, sm: 3, md: 4 } }}>
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate('/dashboard')}
        sx={{
          mb: 3,
          fontWeight: 700,
          borderRadius: 2,
          textTransform: 'none',
          color: 'text.secondary',
          '&:hover': { bgcolor: 'action.hover' }
        }}
      >
        Back to Dashboard
      </Button>

      {/* Modern High-End Banner */}
      <Box sx={{
        background: 'linear-gradient(135deg, var(--c-slate-900) 0%, var(--c-slate-800) 100%)',
        borderRadius: 4,
        p: { xs: 3, md: 4 },
        mb: 4,
        color: 'white',
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        alignItems: { xs: 'flex-start', md: 'center' },
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 10px 30px -10px rgba(15,23,42,0.3)'
      }}>
        <Box sx={{
          position: 'absolute',
          top: -20,
          right: -20,
          width: 150,
          height: 150,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16,185,129,0.15) 0%, rgba(16,185,129,0) 70%)',
        }} />

        <Box sx={{ display: 'flex', alignItems: 'center', zIndex: 1 }}>
          <Box sx={{
            width: 56,
            height: 56,
            borderRadius: '16px',
            bgcolor: 'rgba(255,255,255,0.08)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mr: 3,
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)'
          }}>
            <AutoAwesome sx={{ fontSize: 32, color: 'var(--c-emerald-400)' }} />
          </Box>
          <Box>
            <Typography variant="h4" fontWeight={900} sx={{ letterSpacing: '-0.025em', mb: 0.5, fontSize: { xs: '1.75rem', md: '2.25rem' } }}>
              AI Exam Generator
            </Typography>
            <Typography variant="body2" sx={{ color: 'var(--c-slate-300)', fontWeight: 500 }}>
              Design syllabus-aligned, high-fidelity exam pools with custom randomized question drawers.
            </Typography>
          </Box>
        </Box>
      </Box>

      <Paper sx={{ p: { xs: 3, md: 4 }, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.06)', border: '1px solid var(--c-slate-100)' }}>
        <Stepper activeStep={activeStep} sx={{ mb: 5 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel sx={{ '& .MuiStepLabel-labelContainer': { display: { xs: 'none', sm: 'block' } } }}>
                <Typography variant="body2" fontWeight={700}>{label}</Typography>
              </StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* Step 1: Exam Details & Configuration (Unified 2-Column Redesign) */}
        {activeStep === 0 && (
          <Grid container spacing={3} sx={{ animation: 'fadeIn 0.3s ease' }}>
            {/* LEFT COLUMN: Basic Details & AI Engine Selection */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Card variant="outlined" sx={{ borderRadius: 3.5, borderColor: 'var(--c-slate-200)', height: '100%', p: 1 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                    <ListAlt color="primary" />
                    <Typography variant="h6" fontWeight="bold">1. Exam Info & AI Engine</Typography>
                  </Box>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                    <TextField
                      fullWidth
                      label="Exam Title"
                      placeholder="e.g. Web Development Mechanics - Midterm Assessment"
                      value={examTitle}
                      onChange={(e) => setExamTitle(e.target.value)}
                      required
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5 } }}
                    />

                    <TextField
                      fullWidth
                      label="Description / Student Instructions"
                      placeholder="Provide basic instructions for students..."
                      value={examDescription}
                      onChange={(e) => setExamDescription(e.target.value)}
                      multiline
                      rows={2}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5 } }}
                    />

                    <Grid container spacing={2}>
                      <Grid size={6}>
                        <TextField
                          fullWidth
                          label="Duration (Minutes)"
                          type="number"
                          value={duration}
                          onChange={(e) => setDuration(Number(e.target.value))}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5 } }}
                        />
                      </Grid>
                      <Grid size={6}>
                        <FormControl fullWidth>
                          <InputLabel>Total Points Cap</InputLabel>
                          <Select
                            value={totalPoints}
                            onChange={(e) => setTotalPoints(Number(e.target.value))}
                            label="Total Points Cap"
                            sx={{ borderRadius: 2.5 }}
                          >
                            {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((pts) => (
                              <MenuItem key={pts} value={pts}>{pts} Points</MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                    </Grid>

                    {/* Assessment Type Selection Chips */}
                    <Box>
                      <Typography variant="caption" sx={{ mb: 1, fontWeight: 700, color: 'text.secondary', display: 'block' }}>
                        Assessment Type
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {['Midterm Exam', 'Final Exam', 'Quiz', 'Other'].map((type) => (
                          <Chip
                            key={type}
                            label={type}
                            onClick={() => setAssessmentType(type)}
                            color={assessmentType === type ? 'primary' : 'default'}
                            variant={assessmentType === type ? 'filled' : 'outlined'}
                            clickable
                            sx={{ fontWeight: 'bold', borderRadius: 2 }}
                          />
                        ))}
                      </Box>
                      {assessmentType === 'Other' && (
                        <TextField
                          fullWidth
                          size="small"
                          placeholder="Custom Assessment Name (e.g. Unit Test 3)"
                          value={customAssessmentType}
                          onChange={(e) => setCustomAssessmentType(e.target.value)}
                          sx={{ mt: 1.5, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                        />
                      )}
                    </Box>

                    {/* Clean AI Engine & Model Selector */}
                    <Box sx={{ mt: 1 }}>
                      <OllamaConfigControl
                        engine={aiEngine}
                        nvidiaModel={nvidiaModel}
                        onNvidiaModelChange={setNvidiaModel}
                        onEngineChange={setAiEngine}
                        selectedModel={ollamaModel}
                        onModelChange={setOllamaModel}
                        ollamaUrl={ollamaUrl}
                        onUrlChange={setOllamaUrl}
                        geminiModel={geminiModel}
                        onGeminiModelChange={setGeminiModel}
                      />
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* RIGHT COLUMN: AI Topics, Difficulty, Allocations & File Attachments */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Card variant="outlined" sx={{ borderRadius: 3.5, borderColor: isTosActive ? 'var(--c-emerald-300)' : 'var(--c-slate-200)', height: '100%', p: 1 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Tune color={isTosActive ? 'secondary' : 'primary'} />
                      <Typography variant="h6" fontWeight="bold">2. Question Rules & Content</Typography>
                    </Box>
                    {isTosActive && (
                      <Chip
                        icon={<AssignmentTurnedIn sx={{ fontSize: '0.9rem !important' }} />}
                        label="TOS Governing"
                        color="secondary"
                        size="small"
                        sx={{ fontWeight: 800 }}
                      />
                    )}
                  </Box>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                    {/* Dedicated TOS Blueprint Card when TOS is Attached */}
                    {isTosActive && (
                      <Card
                        variant="outlined"
                        sx={{
                          p: 2,
                          borderRadius: 3,
                          bgcolor: 'var(--c-purple-50)',
                          borderColor: '#d8b4fe',
                          borderLeft: '5px solid var(--c-emerald-600)',
                          boxShadow: '0 4px 12px rgba(5, 150, 105, 0.07)',
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <AssignmentTurnedIn sx={{ color: 'var(--c-emerald-700)', fontSize: 24 }} />
                            <Box>
                              <Typography variant="subtitle2" fontWeight={800} sx={{ color: 'var(--c-purple-900)', lineHeight: 1.2 }}>
                                Table of Specifications (TOS) Active
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#7e22ce', fontWeight: 600 }}>
                                {tos?.name}
                              </Typography>
                            </Box>
                          </Box>
                          <Button
                            size="small"
                            color="error"
                            variant="outlined"
                            startIcon={<Close sx={{ fontSize: '0.85rem !important' }} />}
                            onClick={handleRemoveTos}
                            sx={{ textTransform: 'none', borderRadius: 2, py: 0.2, px: 1, fontSize: '0.75rem', fontWeight: 700 }}
                          >
                            Remove TOS
                          </Button>
                        </Box>

                        {isTosParsing ? (
                          <Box sx={{ py: 1 }}>
                            <Typography variant="caption" sx={{ display: 'block', mb: 0.5, fontWeight: 700, color: 'var(--c-purple-800)' }}>
                              Reading Table of Specifications matrix & cognitive levels...
                            </Typography>
                            <LinearProgress color="secondary" sx={{ borderRadius: 2, height: 6 }} />
                          </Box>
                        ) : tosData ? (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
                            {tosData.courseTitle && (
                              <Box sx={{ p: 1, bgcolor: 'var(--c-emerald-50)', borderRadius: 1.5, border: '1px solid var(--c-emerald-200)' }}>
                                <Typography variant="caption" sx={{ fontWeight: 800, color: 'var(--c-emerald-800)', display: 'block' }}>
                                  COURSE SPECIFICATION:
                                </Typography>
                                <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--c-emerald-900)' }}>
                                  {tosData.courseTitle}
                                </Typography>
                              </Box>
                            )}
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                              <Chip
                                label={`${tosData.totalItems} Items Required`}
                                size="small"
                                color="secondary"
                                sx={{ fontWeight: 800, fontSize: '0.7rem' }}
                              />
                              {tosData.totalPoints > 0 && (
                                <Chip
                                  label={`${tosData.totalPoints} Total Points`}
                                  size="small"
                                  variant="outlined"
                                  color="secondary"
                                  sx={{ fontWeight: 700, fontSize: '0.7rem' }}
                                />
                              )}
                              <Chip
                                icon={<Lock sx={{ fontSize: '0.75rem !important' }} />}
                                label="Rules Locked by TOS"
                                size="small"
                                sx={{ fontWeight: 800, fontSize: '0.7rem', bgcolor: 'var(--c-emerald-100)', color: 'var(--c-purple-800)' }}
                              />
                            </Box>

                            <Box>
                              <Typography variant="caption" sx={{ fontWeight: 750, color: 'var(--c-emerald-900)', display: 'block', mb: 0.5 }}>
                                Bloom's Cognitive Distribution:
                              </Typography>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
                                {Object.entries(tosData.cognitiveLevels || tosData.cognitiveBreakdown || {})
                                  .filter(([_, cnt]) => cnt > 0)
                                  .map(([lvl, cnt]) => {
                                    const style = getBloomBadgeColor(lvl);
                                    return (
                                      <Chip
                                        key={lvl}
                                        label={`${lvl}: ${cnt}`}
                                        size="small"
                                        sx={{
                                          fontWeight: 750,
                                          fontSize: '0.68rem',
                                          bgcolor: style.bg,
                                          color: style.text,
                                          border: `1px solid ${style.border}`,
                                        }}
                                      />
                                    );
                                  })}
                              </Box>
                            </Box>

                            {tosData.topics && tosData.topics.length > 0 && (
                              <Box sx={{ mt: 0.3 }}>
                                <Typography variant="caption" sx={{ fontWeight: 750, color: 'var(--c-emerald-900)', display: 'block', mb: 0.2 }}>
                                  TOS Topics Detected ({tosData.topics.length}):
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'var(--c-purple-800)', fontStyle: 'italic', display: 'block', lineHeight: 1.3 }}>
                                  {tosData.topics.slice(0, 4).join(' • ')}{tosData.topics.length > 4 ? ` (+${tosData.topics.length - 4} more)` : ''}
                                </Typography>
                              </Box>
                            )}

                            <Alert severity="info" icon={<Lock fontSize="inherit" />} sx={{ py: 0.3, px: 1.2, borderRadius: 2, '& .MuiAlert-message': { fontSize: '0.72rem' } }}>
                              Difficulty Strategy, Extra Pool, and Question Type Quantities below are locked. The AI will strictly follow your TOS cognitive levels, topics, and item placement sequence.
                            </Alert>
                          </Box>
                        ) : tosParseError ? (
                          <Alert severity="warning" sx={{ py: 0.5, px: 1.2, borderRadius: 2, '& .MuiAlert-message': { fontSize: '0.75rem' } }}>
                            {tosParseError}
                          </Alert>
                        ) : null}
                      </Card>
                    )}

                    {/* Difficulty & Anti-Cheat */}
                    <Grid container spacing={2} sx={{ opacity: isTosActive ? 0.6 : 1, transition: 'opacity 0.2s' }}>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <FormControl fullWidth size="small" disabled={isTosActive}>
                          <InputLabel>Difficulty Strategy</InputLabel>
                          <Select
                            value={isTosActive ? 'mixed' : difficulty}
                            onChange={(e) => setDifficulty(e.target.value)}
                            label="Difficulty Strategy"
                            sx={{ borderRadius: 2 }}
                          >
                            <MenuItem value="easy">Easy (Knowledge)</MenuItem>
                            <MenuItem value="medium">Medium (Application)</MenuItem>
                            <MenuItem value="hard">Hard (Synthesis)</MenuItem>
                            <MenuItem value="mixed">Mixed Proportional</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Anti-Cheat Extra Items Pool"
                          type="number"
                          disabled={isTosActive}
                          value={isTosActive ? 0 : extraCount}
                          onChange={(e) => setExtraCount(Math.max(0, Number(e.target.value)))}
                          helperText={isTosActive ? 'Disabled: Fixed by TOS specifications' : undefined}
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                        />
                      </Grid>
                    </Grid>

                    <TextField
                      fullWidth
                      label="AI Prompt Focus / Guidelines"
                      placeholder="e.g. Focus on ES6 async/await, Flexbox layout, and semantic HTML accessibility..."
                      value={generationPrompt}
                      onChange={(e) => setGenerationPrompt(e.target.value)}
                      multiline
                      rows={2}
                      sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5 } }}
                    />

                    {/* Question Type Quantity Distribution */}
                    <Box sx={{ p: 2, bgcolor: isTosActive ? 'var(--c-slate-100)' : 'var(--c-slate-50)', borderRadius: 2.5, border: '1px solid var(--c-slate-200)', opacity: isTosActive ? 0.65 : 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                        <Typography variant="caption" sx={{ fontWeight: 750, color: 'text.secondary', display: 'block' }}>
                          Question Type Quantities
                        </Typography>
                        {isTosActive && (
                          <Chip
                            icon={<Lock sx={{ fontSize: '0.75rem !important' }} />}
                            label="Governed by TOS"
                            size="small"
                            sx={{ height: 20, fontSize: '0.65rem', fontWeight: 800, bgcolor: 'var(--c-slate-200)', color: 'var(--c-slate-600)' }}
                          />
                        )}
                      </Box>
                      <Grid container spacing={1.5}>
                        <Grid size={{ xs: 6, sm: 3 }}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Multiple Choice"
                            type="number"
                            disabled={isTosActive}
                            value={mcCount}
                            onChange={(e) => setMcCount(Math.max(0, Number(e.target.value)))}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: isTosActive ? 'var(--c-slate-100)' : '#fff' } }}
                          />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 3 }}>
                          <TextField
                            fullWidth
                            size="small"
                            label="True / False"
                            type="number"
                            disabled={isTosActive}
                            value={tfCount}
                            onChange={(e) => setTfCount(Math.max(0, Number(e.target.value)))}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: isTosActive ? 'var(--c-slate-100)' : '#fff' } }}
                          />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 3 }}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Short Answer"
                            type="number"
                            disabled={isTosActive}
                            value={saCount}
                            onChange={(e) => setSaCount(Math.max(0, Number(e.target.value)))}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: isTosActive ? 'var(--c-slate-100)' : '#fff' } }}
                          />
                        </Grid>
                        <Grid size={{ xs: 6, sm: 3 }}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Essay"
                            type="number"
                            disabled={isTosActive}
                            value={essayCount}
                            onChange={(e) => setEssayCount(Math.max(0, Number(e.target.value)))}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: isTosActive ? 'var(--c-slate-100)' : '#fff' } }}
                          />
                        </Grid>
                      </Grid>

                      <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
                          Active: {activeQuestionCount} questions
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 'bold' }}>
                          {isTosActive ? `Total Items: ${activeQuestionCount} (from TOS)` : `Total Pool: ${totalGeneratedCount} items (+${extraCount} anti-cheat)`}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Compact Upload Bar (Syllabus, TOS, Materials) */}
                    <Box sx={{ p: 2, bgcolor: 'var(--c-purple-50)', borderRadius: 2.5, border: '1px solid var(--c-purple-100)' }}>
                      <Typography variant="caption" sx={{ fontWeight: 750, color: 'var(--c-purple-800)', display: 'block', mb: 1 }}>
                        Attach Course Materials (Optional Alignment)
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                        <Button
                          variant={syllabus ? 'contained' : 'outlined'}
                          color="secondary"
                          component="label"
                          size="small"
                          startIcon={<Upload />}
                          sx={{ borderRadius: 2, textTransform: 'none', fontSize: '0.8rem' }}
                        >
                          {syllabus ? syllabus.name : 'Attach Syllabus'}
                          <input type="file" hidden accept=".pdf,.doc,.docx" onChange={(e) => handleFileUpload(e, 'syllabus')} />
                        </Button>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Button
                            variant={tos ? 'contained' : 'outlined'}
                            color="secondary"
                            component="label"
                            size="small"
                            startIcon={<Upload />}
                            sx={{ borderRadius: 2, textTransform: 'none', fontSize: '0.8rem' }}
                          >
                            {tos ? (tos.name.length > 18 ? `${tos.name.substring(0, 16)}...` : tos.name) : 'Attach TOS'}
                            <input type="file" hidden accept=".pdf,.doc,.docx,.xlsx" onChange={(e) => handleFileUpload(e, 'tos')} />
                          </Button>
                          {tos && (
                            <IconButton size="small" color="error" onClick={handleRemoveTos} title="Remove TOS" sx={{ p: 0.5 }}>
                              <Close fontSize="small" />
                            </IconButton>
                          )}
                        </Box>

                        <Button
                          variant={materials.length > 0 ? 'contained' : 'outlined'}
                          color="secondary"
                          component="label"
                          size="small"
                          startIcon={<Upload />}
                          sx={{ borderRadius: 2, textTransform: 'none', fontSize: '0.8rem' }}
                        >
                          {materials.length > 0 ? `${materials.length} Slides/Files` : 'Add Slides'}
                          <input type="file" hidden multiple accept=".pdf,.doc,.docx,.ppt,.pptx" onChange={(e) => handleFileUpload(e, 'materials')} />
                        </Button>
                      </Box>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Step 2: Summary checklist & Verification (Unified Step) */}
        {activeStep === 1 && (
          <Box sx={{ animation: 'fadeIn 0.3s ease' }}>
            <Box sx={{ mb: 3.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <CheckCircle color="success" sx={{ fontSize: 36 }} />
              <Box>
                <Typography variant="h5" fontWeight={900} sx={{ color: 'var(--c-slate-900)', letterSpacing: '-0.02em' }}>Verify Assessment Blueprint</Typography>
                <Typography variant="body2" color="text.secondary">Carefully review your configurations and files before the AI generates your question bank.</Typography>
              </Box>
            </Box>

            <Grid container spacing={4}>
              {/* Left Column: Config Profile */}
              <Grid size={{ xs: 12, md: 8 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>

                  {/* Summary Profile */}
                  <Card variant="outlined" sx={{ borderRadius: 4, borderColor: 'var(--c-slate-300)', borderLeft: '6px solid var(--c-emerald-600)', boxShadow: '0 4px 12px rgba(0,0,0,0.01)' }}>
                    <CardContent sx={{ p: 3.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <Assignment color="primary" sx={{ fontSize: 20 }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'primary.main', letterSpacing: '0.05em' }}>
                          EXAM PROFILE DETAILS
                        </Typography>
                      </Box>
                      <Typography variant="h5" fontWeight={900} gutterBottom sx={{ letterSpacing: '-0.025em', color: 'var(--c-slate-800)' }}>
                        {examTitle || '(No title entered)'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 3.5, fontStyle: examDescription ? 'normal' : 'italic' }}>
                        {examDescription || 'No description provided.'}
                      </Typography>

                      <Grid container spacing={2.5}>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                          <Box sx={{ p: 2, bgcolor: 'var(--c-slate-50)', borderRadius: 3, border: '1px solid var(--c-slate-200)', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Assignment sx={{ color: 'var(--c-emerald-600)', fontSize: 22 }} />
                            <Box>
                              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: 'block', lineHeight: 1.1 }}>TYPE</Typography>
                              <Typography variant="subtitle2" fontWeight="bold" sx={{ color: 'var(--c-slate-800)' }}>
                                {assessmentType === 'Other' ? (customAssessmentType || 'Custom') : assessmentType}
                              </Typography>
                            </Box>
                          </Box>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                          <Box sx={{ p: 2, bgcolor: 'var(--c-slate-50)', borderRadius: 3, border: '1px solid var(--c-slate-200)', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <AccessTime sx={{ color: 'var(--c-emerald-500)', fontSize: 22 }} />
                            <Box>
                              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: 'block', lineHeight: 1.1 }}>DURATION</Typography>
                              <Typography variant="subtitle2" fontWeight="bold" sx={{ color: 'var(--c-slate-800)' }}>{duration} mins</Typography>
                            </Box>
                          </Box>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                          <Box sx={{ p: 2, bgcolor: 'var(--c-slate-50)', borderRadius: 3, border: '1px solid var(--c-slate-200)', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <SportsScore sx={{ color: 'var(--c-amber-600)', fontSize: 22 }} />
                            <Box>
                              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: 'block', lineHeight: 1.1 }}>CAP LIMIT</Typography>
                              <Typography variant="subtitle2" fontWeight="bold" sx={{ color: 'var(--c-slate-800)' }}>{totalPoints} pts</Typography>
                            </Box>
                          </Box>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                          <Box sx={{ p: 2, bgcolor: 'var(--c-slate-50)', borderRadius: 3, border: '1px solid var(--c-slate-200)', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <TrendingUp sx={{ color: 'var(--c-emerald-600)', fontSize: 22 }} />
                            <Box>
                              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: 'block', lineHeight: 1.1 }}>DIFFICULTY</Typography>
                              <Typography variant="subtitle2" fontWeight="bold" sx={{ color: 'var(--c-slate-800)', textTransform: 'capitalize' }}>
                                {difficulty}
                              </Typography>
                            </Box>
                          </Box>
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>

                  {/* Summary Files */}
                  <Card variant="outlined" sx={{ borderRadius: 4, borderColor: 'var(--c-slate-300)', borderLeft: '6px solid var(--c-emerald-700)', boxShadow: '0 4px 12px rgba(0,0,0,0.01)' }}>
                    <CardContent sx={{ p: 3.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <FolderZip color="secondary" sx={{ fontSize: 20 }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'secondary.main', letterSpacing: '0.05em' }}>
                          ALIGNED CURRICULUM SOURCES
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1.5, borderBottom: '1px solid var(--c-slate-100)' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <FileIcon color="primary" sx={{ fontSize: 18 }} />
                            <Typography variant="body2" fontWeight="bold" color="var(--c-slate-700)">Syllabus Outline</Typography>
                          </Box>
                          {syllabus ? <Chip label={syllabus.name} color="primary" size="small" variant="outlined" sx={{ fontWeight: 700 }} /> : <Typography variant="caption" color="text.secondary">None attached</Typography>}
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1.5, borderBottom: '1px solid var(--c-slate-100)' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <FileIcon color="secondary" sx={{ fontSize: 18 }} />
                            <Typography variant="body2" fontWeight="bold" color="var(--c-slate-700)">Table of Specifications (TOS)</Typography>
                          </Box>
                          {tos ? <Chip label={tos.name} color="secondary" size="small" variant="outlined" sx={{ fontWeight: 700 }} /> : <Typography variant="caption" color="text.secondary">None attached</Typography>}
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <FileIcon color="success" sx={{ fontSize: 18 }} />
                            <Typography variant="body2" fontWeight="bold" color="var(--c-slate-700)">Learning materials</Typography>
                          </Box>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                            {materials.length > 0 ? `${materials.length} slides / readings` : 'None attached'}
                          </Typography>
                        </Box>
                        {materials.length > 0 && (
                          <Box sx={{ pl: 3, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {materials.map((m, i) => <Chip key={i} label={m.name} size="small" variant="outlined" />)}
                          </Box>
                        )}
                      </Box>
                    </CardContent>
                  </Card>

                  {/* Summary Topics */}
                  <Card variant="outlined" sx={{ borderRadius: 4, borderColor: 'var(--c-slate-300)', borderLeft: '6px solid #0891b2', boxShadow: '0 4px 12px rgba(0,0,0,0.01)' }}>
                    <CardContent sx={{ p: 3.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        <Topic sx={{ color: '#0891b2', fontSize: 20 }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0891b2', letterSpacing: '0.05em' }}>
                          OUTCOME ALIGNMENT (TOPICS)
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.2 }}>
                        {topics.filter(t => t.trim() !== '').map((t, i) => (
                          <Chip key={i} label={t} color="info" variant="outlined" sx={{ fontWeight: 700, borderRadius: 2 }} />
                        ))}
                        {topics.filter(t => t.trim() !== '').length === 0 && (
                          <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>No custom outline topics provided.</Typography>
                        )}
                      </Box>
                    </CardContent>
                  </Card>

                </Box>
              </Grid>

              {/* Sidebar Matrix Manifest (Upgraded Design) */}
              <Grid size={{ xs: 12, md: 4 }}>
                <Card variant="outlined" sx={{ borderRadius: 4, borderColor: 'var(--c-emerald-500)', bgcolor: 'rgba(16,185,129,0.01)', overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>

                  {/* Indigo Mini Header Banner */}
                  <Box sx={{ background: 'linear-gradient(135deg, var(--c-emerald-500) 0%, var(--c-emerald-600) 100%)', p: 3, color: 'white', textAlign: 'center' }}>
                    <AutoAwesome sx={{ fontSize: 28, mb: 1, color: 'var(--c-emerald-100)' }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, letterSpacing: '0.08em' }}>
                      AI BLUEPRINT MANIFEST
                    </Typography>
                  </Box>

                  <CardContent sx={{ p: 3.5, flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <Box sx={{ width: '100%' }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 4 }}>
                        {isTosActive && tosData ? (
                          <>
                            <Box sx={{ p: 1.5, bgcolor: 'var(--c-green-50)', borderRadius: 2, border: '1px solid var(--c-green-200)', mb: 0.5 }}>
                              <Typography variant="caption" sx={{ fontWeight: 800, color: 'var(--c-green-800)', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <AssignmentTurnedIn sx={{ fontSize: 16 }} /> TOS BLUEPRINT SPECIFICATION
                              </Typography>
                              <Typography variant="caption" sx={{ color: 'var(--c-green-700)', display: 'block', mt: 0.3 }}>
                                Strict Bloom cognitive levels and sequential item placement sequence active.
                              </Typography>
                            </Box>

                            <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              Cognitive Level Breakdown
                            </Typography>
                            {Object.entries(tosData.cognitiveLevels || tosData.cognitiveBreakdown || {})
                              .filter(([_, cnt]) => cnt > 0)
                              .map(([lvl, cnt]) => {
                                const style = getBloomBadgeColor(lvl);
                                return (
                                  <Box key={lvl} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: style.text }} />
                                      <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>{lvl}:</Typography>
                                    </Box>
                                    <Typography variant="body2" fontWeight="bold" color="var(--c-slate-800)">{cnt} items</Typography>
                                  </Box>
                                );
                              })}
                            <Divider sx={{ my: 0.5 }} />
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="body2" sx={{ fontWeight: 800, color: 'text.primary' }}>Total TOS Items:</Typography>
                              <Typography variant="body2" fontWeight="black" color="primary.main">{activeQuestionCount} Questions</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>Total Points:</Typography>
                              <Typography variant="body2" fontWeight="bold" color="var(--c-slate-800)">{tosData.totalPoints || activeQuestionCount} Points</Typography>
                            </Box>
                          </>
                        ) : (
                          <>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>Multiple Choice:</Typography>
                              <Typography variant="body2" fontWeight="bold" color="var(--c-slate-800)">{mcCount} items</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>True / False:</Typography>
                              <Typography variant="body2" fontWeight="bold" color="var(--c-slate-800)">{tfCount} items</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>Short Answer:</Typography>
                              <Typography variant="body2" fontWeight="bold" color="var(--c-slate-800)">{saCount} items</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>Essay:</Typography>
                              <Typography variant="body2" fontWeight="bold" color="var(--c-slate-800)">{essayCount} items</Typography>
                            </Box>
                            <Divider sx={{ my: 1 }} />
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="body2" sx={{ fontWeight: 800, color: 'text.primary' }}>Active Selected (N):</Typography>
                              <Typography variant="body2" fontWeight="black" color="primary.main">{activeQuestionCount} Questions</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>Anti-Cheat Drawer (E):</Typography>
                              <Typography variant="body2" fontWeight="bold" color="var(--c-slate-800)">{extraCount} Questions</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1.8, bgcolor: 'rgba(16, 185, 129, 0.05)', borderRadius: 3, border: '1px solid rgba(16,185,129,0.1)' }}>
                              <Typography variant="subtitle2" fontWeight="bold" color="primary.dark">Total Pool Size:</Typography>
                              <Typography variant="subtitle2" fontWeight="black" color="primary.dark">{totalGeneratedCount} Questions</Typography>
                            </Box>
                          </>
                        )}
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Step 3: Loading or Reviewing and Editing */}
        {activeStep === 2 && (
          <Box sx={{ animation: 'fadeIn 0.3s ease' }}>
            {generating ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <AutoAwesome
                  sx={{
                    fontSize: 70,
                    color: 'var(--c-emerald-500)',
                    mb: 3,
                    animation: 'pulseSpinBlue 3s infinite ease-in-out',
                    '@keyframes pulseSpinBlue': {
                      '0%': { transform: 'rotate(0deg) scale(1)', filter: 'drop-shadow(0 0 0px rgba(16,185,129,0))' },
                      '50%': { transform: 'rotate(180deg) scale(1.15)', filter: 'drop-shadow(0 0 15px rgba(16,185,129,0.4))' },
                      '100%': { transform: 'rotate(360deg) scale(1)', filter: 'drop-shadow(0 0 0px rgba(16,185,129,0))' },
                    }
                  }}
                />
                <Typography variant="h5" gutterBottom fontWeight="black" sx={{ color: 'var(--c-slate-900)', letterSpacing: '-0.02em' }}>
                  {aiEngine === 'gemini' ? `Google Gemini (${geminiModel}) Generating Exam...` : aiEngine === 'nvidia' ? `Llama (${nvidiaModel}) Generating Exam...` : `Ollama (${ollamaModel}) AI Generating Exam...`}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 4, maxWidth: 550, mx: 'auto', px: 2 }}>
                  {generationStatusText || `Analyzing source files and building ${totalGeneratedCount} high-fidelity items (${activeQuestionCount} active drawer items, ${extraCount} extra anti-cheat items).`}
                </Typography>
                <LinearProgress sx={{ maxWidth: 400, mx: 'auto', height: 6, borderRadius: 3 }} />
              </Box>
            ) : (
              <Box>
                {/* Modern AI Generation & Connection Status Banner */}
                <Card
                  variant="outlined"
                  sx={{
                    mb: 3.5,
                    borderRadius: 4,
                    borderColor: generationError ? 'var(--c-amber-300)' : 'var(--c-green-300)',
                    bgcolor: generationError ? 'var(--c-amber-50)' : 'var(--c-green-50)',
                    p: { xs: 2.5, md: 3 },
                    boxShadow: '0 4px 16px rgba(0,0,0,0.03)'
                  }}
                >
                  <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', gap: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Box sx={{
                        width: 44,
                        height: 44,
                        borderRadius: 3,
                        bgcolor: generationError ? 'var(--c-amber-100)' : 'var(--c-green-100)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        <CheckCircle sx={{ color: generationError ? 'var(--c-amber-600)' : 'var(--c-green-600)', fontSize: 26 }} />
                      </Box>
                      <Box>
                        <Typography variant="subtitle1" fontWeight={900} sx={{ color: generationError ? 'var(--c-amber-800)' : '#14532d', lineHeight: 1.2 }}>
                          {generationError ? 'Question Bank Built (Topic Engine Fallback)' : 'Question Bank Successfully Generated!'}
                        </Typography>
                        <Typography variant="body2" sx={{ color: generationError ? 'var(--c-amber-700)' : 'var(--c-green-800)', mt: 0.5, fontWeight: 500 }}>
                          {aiEngine === 'gemini'
                            ? `Engine: Google Gemini AI (${geminiModel})`
                            : `Engine: Local Ollama AI (${ollamaModel})`} &bull; Created <strong>{generatedQuestions.length} total items</strong>
                        </Typography>
                      </Box>
                    </Box>

                    <Button
                      variant="contained"
                      color="success"
                      size="large"
                      startIcon={<Save />}
                      onClick={handleSaveExam}
                      // Blocked while the exam does not match the TOS, until the instructor
                      // explicitly acknowledges the mismatch below.
                      disabled={Boolean(tosReport && !tosReport.compliant && !tosOverride)}
                      sx={{
                        borderRadius: 3,
                        px: 3.5,
                        py: 1.2,
                        fontWeight: 800,
                        textTransform: 'none',
                        boxShadow: '0 4px 14px rgba(22, 163, 74, 0.25)',
                        '&:hover': { boxShadow: '0 6px 18px rgba(22, 163, 74, 0.35)' }
                      }}
                    >
                      Save Exam to Repository
                    </Button>
                  </Box>
                  {generationError && (
                    <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: 'var(--c-amber-700)', fontWeight: 600, bgcolor: 'var(--c-amber-100)', p: 1, borderRadius: 2 }}>
                      {generationError} Note: To use real local AI models, launch Ollama in terminal (<code>ollama serve</code>) and select a pulled model.
                    </Typography>
                  )}
                </Card>

                {/* ── TOS compliance report ── */}
                {tosReport && (
                  <>
                    <TOSCompliancePanel report={tosReport} tosData={tosData} />
                    {!tosReport.compliant && (
                      <FormControlLabel
                        sx={{ mb: 3, ml: 0.5 }}
                        control={
                          <Checkbox
                            checked={tosOverride}
                            onChange={(e) => setTosOverride(e.target.checked)}
                            sx={{ color: 'var(--c-red-600)', '&.Mui-checked': { color: 'var(--c-red-600)' } }}
                          />
                        }
                        label={
                          <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--c-red-800)' }}>
                            I understand this exam does not match the uploaded Table of
                            Specifications, and I want to save it anyway.
                          </Typography>
                        }
                      />
                    )}
                  </>
                )}

                {/* Top Action & View Toolbar */}
                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'stretch', md: 'center' }, gap: 2, mb: 3.5, p: 2, bgcolor: 'var(--c-slate-50)', borderRadius: 3.5, border: '1px solid var(--c-slate-200)' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                    <Typography variant="h6" fontWeight="bold" sx={{ color: 'var(--c-slate-900)', mr: 1 }}>
                      Review & Edit Questions
                    </Typography>
                    <Chip label={`Active Exam: ${activeQuestionCount}`} color="primary" size="small" sx={{ fontWeight: 800 }} />
                    <Chip label={`Anti-Cheat Pool: +${extraCount}`} color="secondary" size="small" sx={{ fontWeight: 800 }} />
                    <Chip label={`Total: ${generatedQuestions.length}`} variant="outlined" size="small" sx={{ fontWeight: 800 }} />
                  </Box>

                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                    <FormControl size="small" sx={{ minWidth: 140 }}>
                      <InputLabel>Add Type</InputLabel>
                      <Select
                        value={newQuestionType}
                        label="Add Type"
                        onChange={(e) => setNewQuestionType(e.target.value as string)}
                        sx={{ borderRadius: 2, bgcolor: 'var(--c-surface)' }}
                      >
                        <MenuItem value="multiple-choice">Multiple Choice</MenuItem>
                        <MenuItem value="true-false">True / False</MenuItem>
                        <MenuItem value="short-answer">Short Answer</MenuItem>
                        <MenuItem value="essay">Essay</MenuItem>
                      </Select>
                    </FormControl>
                    <Button variant="outlined" startIcon={<Add />} onClick={() => handleAddNewQuestion(newQuestionType)} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, bgcolor: 'var(--c-surface)' }}>
                      Add Question
                    </Button>
                    <Button
                      variant={isPreviewMode ? 'contained' : 'outlined'}
                      color="secondary"
                      onClick={() => setIsPreviewMode(!isPreviewMode)}
                      sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
                    >
                      {isPreviewMode ? 'Switch to Editor' : 'Preview Layout'}
                    </Button>
                  </Box>
                </Box>

                {/* Strictly Vertical Full-Width Questions Listing */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5, width: '100%' }}>
                  {generatedQuestions.filter(Boolean).map((q, qIdx) => {
                    if (!q) return null;
                    const isQExtra = Boolean(q?.isExtra || qIdx >= activeQuestionCount);
                    const isQRegenerating = Boolean(q?.id && regeneratingMap[q.id]);

                    return (
                      <Card
                        key={q.id}
                        variant="outlined"
                        sx={{
                          width: '100%',
                          boxSizing: 'border-box',
                          border: isQExtra ? '2px dashed var(--c-purple-500)' : '1px solid var(--c-slate-200)',
                          borderRadius: 4.5,
                          position: 'relative',
                          transition: 'all 0.2s',
                          boxShadow: '0 2px 10px rgba(0,0,0,0.01)',
                          '&:hover': { boxShadow: '0 4px 18px rgba(0,0,0,0.04)' }
                        }}
                      >
                        {/* Smart AI Regenerating Card Glass Overlay */}
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
                            borderRadius: 4.5
                          }}>
                            <CircularProgress size={44} thickness={4} sx={{ color: 'var(--c-emerald-500)', mb: 2 }} />
                            <Typography variant="subtitle2" fontWeight="bold" color="primary.dark">
                              AI is drafting alternative variations...
                            </Typography>
                          </Box>
                        )}

                        <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
                          {/* Unified Card Header: Tags on Left, Status + Delete on Right (No overlapping) */}
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1.5, mb: 2.5, pb: 1.5, borderBottom: '1px solid var(--c-slate-100)' }}>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                              <Typography variant="subtitle1" fontWeight={900} sx={{ color: 'primary.main', mr: 0.5 }}>
                                #{q.itemPlacement || qIdx + 1}
                              </Typography>
                              <Chip label={q.type.toUpperCase()} size="small" sx={{ fontWeight: 800, fontSize: '0.65rem' }} />
                              <Chip label={`${q.points} pts`} size="small" variant="outlined" sx={{ fontWeight: 700, fontSize: '0.65rem' }} />
                              {q.cognitiveLevel && (
                                <Chip
                                  icon={<Psychology sx={{ fontSize: '0.85rem !important' }} />}
                                  label={q.cognitiveLevel.toUpperCase()}
                                  size="small"
                                  sx={{
                                    fontWeight: 800,
                                    fontSize: '0.65rem',
                                    bgcolor: getBloomBadgeColor(q.cognitiveLevel).bg,
                                    color: getBloomBadgeColor(q.cognitiveLevel).text,
                                    border: `1px solid ${getBloomBadgeColor(q.cognitiveLevel).border}`,
                                  }}
                                />
                              )}
                              {q.topic && (
                                <Chip
                                  label={q.topic}
                                  size="small"
                                  variant="outlined"
                                  color="info"
                                  sx={{ fontWeight: 600, fontSize: '0.65rem', maxWidth: { xs: 160, sm: 280 } }}
                                />
                              )}
                              {q.difficulty && (
                                <Chip
                                  label={q.difficulty.toUpperCase()}
                                  size="small"
                                  sx={{
                                    fontWeight: 800,
                                    fontSize: '0.65rem',
                                    ...(q.difficulty.toLowerCase() === 'hard'
                                      ? { bgcolor: 'var(--c-red-100)', color: 'var(--c-red-800)', border: '1px solid var(--c-red-300)' }
                                      : q.difficulty.toLowerCase() === 'medium'
                                        ? { bgcolor: 'var(--c-amber-100)', color: 'var(--c-amber-800)', border: '1px solid var(--c-amber-300)' }
                                        : q.difficulty.toLowerCase() === 'easy'
                                          ? { bgcolor: 'var(--c-green-100)', color: 'var(--c-green-800)', border: '1px solid var(--c-green-300)' }
                                          : { bgcolor: 'var(--c-emerald-100)', color: '#3730a3', border: '1px solid var(--c-emerald-200)' }),
                                  }}
                                />
                              )}
                            </Box>

                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                              {isQExtra ? (
                                <Chip label="EXTRA POOL ITEM" color="secondary" size="small" sx={{ fontWeight: 800, fontSize: '0.65rem' }} />
                              ) : (
                                <Chip label="ACTIVE STUDENT ITEM" color="primary" size="small" sx={{ fontWeight: 800, fontSize: '0.65rem' }} />
                              )}
                              <IconButton color="error" onClick={() => handleDeleteQuestion(qIdx)} size="small" title="Delete Question">
                                <Delete fontSize="small" />
                              </IconButton>
                            </Box>
                          </Box>

                          {/* Preview Mode Rendering */}
                          {isPreviewMode ? (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <Typography variant="h6" fontWeight="bold" sx={{ color: 'text.primary', pr: 2 }}>
                                {q.question}
                              </Typography>
                              {q.image && (
                                <Box sx={{ my: 1, display: 'flex' }}>
                                  <img src={q.image} alt="Question Asset" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px' }} />
                                </Box>
                              )}

                              {/* MC choices */}
                              {q.type === 'multiple-choice' && q.options && (
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pl: 1 }}>
                                  {q.options.map((opt: string, optIdx: number) => (
                                    <Box key={optIdx} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                      <Radio checked={q.correctAnswer === optIdx} disabled size="small" />
                                      <Typography variant="body2" sx={{ fontWeight: q.correctAnswer === optIdx ? 'bold' : 'normal' }}>
                                        <strong>{String.fromCharCode(65 + optIdx)}.</strong> {opt}
                                      </Typography>
                                      {q.optionsImages?.[optIdx] && (
                                        <img src={q.optionsImages[optIdx]} alt="Option Asset" style={{ width: '35px', height: '35px', objectFit: 'cover', borderRadius: '4px' }} />
                                      )}
                                      {q.correctAnswer === optIdx && (
                                        <Chip label="Correct Answer Key" color="success" size="small" variant="outlined" sx={{ height: 20, fontWeight: 700, fontSize: '0.6rem' }} />
                                      )}
                                    </Box>
                                  ))}
                                </Box>
                              )}

                              {/* True / False */}
                              {q.type === 'true-false' && (
                                <Box sx={{ display: 'flex', gap: 2, pl: 1, alignItems: 'center' }}>
                                  <Chip
                                    label={`Answer Key: ${String(q.correctAnswer).toUpperCase()}`}
                                    color={String(q.correctAnswer).toLowerCase() === 'true' ? 'success' : 'error'}
                                    variant="outlined"
                                    sx={{ fontWeight: 'bold' }}
                                  />
                                </Box>
                              )}

                              {/* Short Answer */}
                              {q.type === 'short-answer' && (
                                <Box sx={{ pl: 1, p: 1.5, bgcolor: 'var(--c-slate-50)', borderRadius: 2, border: '1px solid var(--c-slate-200)' }}>
                                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.5 }}>
                                    Expected Correct Answer Key:
                                  </Typography>
                                  <Typography variant="body2" sx={{ fontWeight: 700, color: 'var(--c-green-600)' }}>
                                    {q.correctAnswer && q.correctAnswer !== '0' ? q.correctAnswer : 'Specific technical keyword or concise statement'}
                                  </Typography>
                                </Box>
                              )}

                              {/* Essay */}
                              {q.type === 'essay' && (
                                <Box sx={{ pl: 1, p: 1.5, bgcolor: 'var(--c-slate-50)', borderRadius: 2, border: '1px solid var(--c-slate-200)' }}>
                                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.5 }}>
                                    Evaluation Rubric / Key Criteria:
                                  </Typography>
                                  <Typography variant="body2" sx={{ color: 'var(--c-slate-600)', fontStyle: q.correctAnswer ? 'normal' : 'italic' }}>
                                    {q.correctAnswer && q.correctAnswer !== '0' ? q.correctAnswer : 'Instructor will evaluate student synthesis and comprehensive analysis.'}
                                  </Typography>
                                </Box>
                              )}
                            </Box>
                          ) : (
                            /* STACKED VERTICAL EDITOR MODE */
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

                              {/* Question Text (Smooth auto-expand, no fractional scrollbar) */}
                              <TextField
                                fullWidth
                                label="Question Text"
                                value={q.question}
                                onChange={(e) => handleUpdateQuestionText(qIdx, e.target.value)}
                                multiline
                                minRows={2}
                                maxRows={6}
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                              />

                              {/* Question Image Attachment */}
                              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1.5 }}>
                                <Button
                                  variant="outlined"
                                  size="small"
                                  startIcon={<ImageIcon />}
                                  onClick={() => handleAttachMockImage(qIdx)}
                                  sx={{ borderRadius: 2, textTransform: 'none', fontSize: '0.8rem' }}
                                >
                                  Attach Question Image asset
                                </Button>
                                {q.image && (
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1, border: '1px solid var(--c-slate-200)', borderRadius: 2 }}>
                                    <img src={q.image} alt="Thumbnail" style={{ width: '45px', height: '45px', objectFit: 'cover', borderRadius: '4px' }} />
                                    <Typography variant="caption" color="text.secondary">Question Asset Active</Typography>
                                    <IconButton size="small" color="error" onClick={() => handleRemoveImage(qIdx)}>
                                      <Delete fontSize="small" />
                                    </IconButton>
                                  </Box>
                                )}
                              </Box>

                              {/* Multiple choice editor */}
                              {q.type === 'multiple-choice' && q.options && (
                                <Box sx={{ pl: { xs: 1.5, md: 3 }, borderLeft: '4px solid var(--c-emerald-500)', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'var(--c-slate-700)' }}>
                                    Configure Multiple Choice Keys and Options
                                  </Typography>

                                  {q.options.map((opt: string, optIdx: number) => {
                                    const isCorrectOpt = q.correctAnswer === optIdx;
                                    return (
                                      <Box key={optIdx} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                          <Radio
                                            checked={isCorrectOpt}
                                            value={optIdx}
                                            onChange={() => handleUpdateCorrectAnswer(qIdx, optIdx)}
                                            size="small"
                                          />
                                          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: isCorrectOpt ? 'success.main' : 'text.secondary' }}>
                                            Option {String.fromCharCode(65 + optIdx)} {isCorrectOpt && '(Marked as Correct Answer Key)'}
                                          </Typography>
                                        </Box>

                                        <TextField
                                          fullWidth
                                          size="small"
                                          value={opt}
                                          onChange={(e) => handleUpdateQuestionOption(qIdx, optIdx, e.target.value)}
                                          placeholder={`Enter content statement for Option ${String.fromCharCode(65 + optIdx)}`}
                                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                        />

                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 1 }}>
                                          <Button
                                            variant="text"
                                            size="small"
                                            startIcon={<ImageIcon />}
                                            onClick={() => handleAttachMockImage(qIdx, optIdx)}
                                            sx={{ fontSize: '0.75rem', py: 0.5 }}
                                          >
                                            Attach Option Image
                                          </Button>
                                          {q.optionsImages?.[optIdx] && (
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 0.5, border: '1px solid var(--c-slate-100)', borderRadius: 1.5 }}>
                                              <img src={q.optionsImages[optIdx]} alt="Opt Thumbnail" style={{ width: '32px', height: '32px', objectFit: 'cover', borderRadius: '4px' }} />
                                              <IconButton size="small" color="error" onClick={() => handleRemoveImage(qIdx, optIdx)}>
                                                <Delete fontSize="small" />
                                              </IconButton>
                                            </Box>
                                          )}
                                        </Box>
                                      </Box>
                                    );
                                  })}
                                </Box>
                              )}

                              {/* True / False Editor */}
                              {q.type === 'true-false' && (
                                <Box sx={{ pl: 3, borderLeft: '4px solid var(--c-emerald-500)', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'var(--c-slate-700)' }}>
                                    Configure True/False Correct Key
                                  </Typography>
                                  <RadioGroup
                                    value={String(q.correctAnswer)}
                                    onChange={(e) => handleUpdateCorrectAnswer(qIdx, e.target.value)}
                                    sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
                                  >
                                    <FormControlLabel value="true" control={<Radio />} label="True (Statement is factual)" />
                                    <FormControlLabel value="false" control={<Radio />} label="False (Statement is incorrect)" />
                                  </RadioGroup>
                                </Box>
                              )}

                              {/* Short Answer Editor with Dedicated Regenerate Answer Key Button */}
                              {q.type === 'short-answer' && (
                                <Box sx={{ pl: 3, borderLeft: '4px solid var(--c-amber-500)', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'var(--c-slate-700)' }}>
                                      Short Answer Key
                                    </Typography>
                                    <Button
                                      variant="outlined"
                                      size="small"
                                      startIcon={<AutoAwesome sx={{ fontSize: 13 }} />}
                                      disabled={isQRegenerating}
                                      onClick={() => handleRegenerateItem(qIdx, 'answer')}
                                      sx={{
                                        textTransform: 'none',
                                        borderRadius: 2,
                                        fontWeight: 700,
                                        fontSize: '0.75rem',
                                        py: 0.3,
                                        px: 1.5,
                                        bgcolor: 'var(--c-amber-50)',
                                        borderColor: 'var(--c-amber-200)',
                                        color: 'var(--c-amber-700)',
                                        '&:hover': { bgcolor: 'var(--c-amber-100)', borderColor: 'var(--c-amber-500)' }
                                      }}
                                    >
                                      {isQRegenerating ? 'Regenerating Key...' : 'Regenerate Answer Key'}
                                    </Button>
                                  </Box>
                                  <TextField
                                    fullWidth
                                    label="Expected Correct Answer Statement / Key Term"
                                    size="small"
                                    value={q.correctAnswer && q.correctAnswer !== '0' ? q.correctAnswer : ''}
                                    placeholder="e.g. Spanish mercantilism, forced labor (polo y servicios), etc."
                                    onChange={(e) => handleUpdateCorrectAnswer(qIdx, e.target.value)}
                                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                  />
                                </Box>
                              )}

                              {/* Essay Editor with Dedicated Regenerate Rubric Button */}
                              {q.type === 'essay' && (
                                <Box sx={{ pl: 3, borderLeft: '4px solid var(--c-emerald-500)', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'var(--c-slate-700)' }}>
                                      Essay Grading Rubric & Criteria
                                    </Typography>
                                    <Button
                                      variant="outlined"
                                      size="small"
                                      startIcon={<AutoAwesome sx={{ fontSize: 13 }} />}
                                      disabled={isQRegenerating}
                                      onClick={() => handleRegenerateItem(qIdx, 'answer')}
                                      sx={{
                                        textTransform: 'none',
                                        borderRadius: 2,
                                        fontWeight: 700,
                                        fontSize: '0.75rem',
                                        py: 0.3,
                                        px: 1.5,
                                        bgcolor: '#fbf7ff',
                                        borderColor: 'var(--c-emerald-200)',
                                        color: 'var(--c-emerald-800)',
                                        '&:hover': { bgcolor: 'var(--c-emerald-100)', borderColor: 'var(--c-emerald-500)' }
                                      }}
                                    >
                                      {isQRegenerating ? 'Regenerating Rubric...' : 'Regenerate Rubric / Answer Key'}
                                    </Button>
                                  </Box>
                                  <TextField
                                    fullWidth
                                    multiline
                                    minRows={2}
                                    maxRows={4}
                                    label="Expected Analytical Points / Rubric Criteria"
                                    size="small"
                                    value={q.correctAnswer && q.correctAnswer !== '0' ? q.correctAnswer : ''}
                                    placeholder="Provide key points expected in students' responses..."
                                    onChange={(e) => handleUpdateCorrectAnswer(qIdx, e.target.value)}
                                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                  />
                                </Box>
                              )}

                              {/* Item Point & Difficulty Setting */}
                              <Box sx={{ p: 2, bgcolor: 'var(--c-slate-50)', borderRadius: 2.5, border: '1px solid var(--c-slate-200)' }}>
                                <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', display: 'block', mb: 1.5 }}>
                                  Item Settings & Weight
                                </Typography>
                                <Grid container spacing={2}>
                                  <Grid size={{ xs: 12, sm: 4 }}>
                                    <TextField
                                      fullWidth
                                      label="Points"
                                      type="number"
                                      size="small"
                                      value={q.points}
                                      onChange={(e) => handleUpdatePoints(qIdx, Number(e.target.value))}
                                      sx={{ bgcolor: 'var(--c-surface)', '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                    />
                                  </Grid>
                                  <Grid size={{ xs: 12, sm: 4 }}>
                                    <FormControl fullWidth size="small" sx={{ bgcolor: 'var(--c-surface)' }}>
                                      <InputLabel>Difficulty</InputLabel>
                                      <Select
                                        value={q.difficulty || 'medium'}
                                        label="Difficulty"
                                        onChange={(e) => {
                                          const updated = [...generatedQuestions];
                                          updated[qIdx].difficulty = e.target.value;
                                          setGeneratedQuestions(updated);
                                        }}
                                        sx={{ borderRadius: 2 }}
                                      >
                                        <MenuItem value="easy">Easy (Knowledge)</MenuItem>
                                        <MenuItem value="medium">Medium (Application)</MenuItem>
                                        <MenuItem value="hard">Hard (Synthesis)</MenuItem>
                                      </Select>
                                    </FormControl>
                                  </Grid>
                                  <Grid size={{ xs: 12, sm: 4 }}>
                                    <FormControl fullWidth size="small" sx={{ bgcolor: 'var(--c-surface)' }}>
                                      <InputLabel>Cognitive Level</InputLabel>
                                      <Select
                                        value={q.cognitiveLevel || 'Applying'}
                                        label="Cognitive Level"
                                        onChange={(e) => {
                                          const updated = [...generatedQuestions];
                                          updated[qIdx].cognitiveLevel = e.target.value;
                                          setGeneratedQuestions(updated);
                                        }}
                                        sx={{ borderRadius: 2 }}
                                      >
                                        {BLOOM_LEVELS.map((lvl) => (
                                          <MenuItem key={lvl} value={lvl}>{lvl}</MenuItem>
                                        ))}
                                      </Select>
                                    </FormControl>
                                  </Grid>
                                </Grid>
                              </Box>

                              {/* Clean, Full-Featured AI Revision Action Bar */}
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
                                    disabled={isQRegenerating}
                                    onClick={() => handleRegenerateItem(qIdx, 'full')}
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
                                    <>
                                      <Button
                                        variant="outlined"
                                        size="small"
                                        startIcon={<AutoAwesome sx={{ fontSize: 14 }} />}
                                        disabled={isQRegenerating}
                                        onClick={() => handleRegenerateItem(qIdx, 'options')}
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
                                      <Button
                                        variant="outlined"
                                        size="small"
                                        startIcon={<AutoAwesome sx={{ fontSize: 14 }} />}
                                        disabled={isQRegenerating}
                                        onClick={() => handleRegenerateItem(qIdx, 'answer')}
                                        sx={{
                                          textTransform: 'none',
                                          borderRadius: 2,
                                          fontWeight: 700,
                                          fontSize: '0.8rem',
                                          color: 'var(--c-green-700)',
                                          borderColor: 'var(--c-green-200)',
                                          bgcolor: 'var(--c-green-50)',
                                          '&:hover': { bgcolor: 'var(--c-green-100)', borderColor: 'var(--c-green-300)' }
                                        }}
                                      >
                                        Regenerate Key
                                      </Button>
                                    </>
                                  )}

                                  {q.type === 'short-answer' && (
                                    <Button
                                      variant="outlined"
                                      size="small"
                                      startIcon={<AutoAwesome sx={{ fontSize: 14 }} />}
                                      disabled={isQRegenerating}
                                      onClick={() => handleRegenerateItem(qIdx, 'answer')}
                                      sx={{
                                        textTransform: 'none',
                                        borderRadius: 2,
                                        fontWeight: 700,
                                        fontSize: '0.8rem',
                                        color: 'var(--c-amber-700)',
                                        borderColor: 'var(--c-amber-200)',
                                        bgcolor: 'var(--c-amber-50)',
                                        '&:hover': { bgcolor: 'var(--c-amber-100)', borderColor: 'var(--c-amber-500)' }
                                      }}
                                    >
                                      Regenerate Answer Key
                                    </Button>
                                  )}

                                  {q.type === 'essay' && (
                                    <Button
                                      variant="outlined"
                                      size="small"
                                      startIcon={<AutoAwesome sx={{ fontSize: 14 }} />}
                                      disabled={isQRegenerating}
                                      onClick={() => handleRegenerateItem(qIdx, 'answer')}
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
                                      Regenerate Rubric / Answer Key
                                    </Button>
                                  )}

                                  {q.type === 'true-false' && (
                                    <Button
                                      variant="outlined"
                                      size="small"
                                      startIcon={<AutoAwesome sx={{ fontSize: 14 }} />}
                                      disabled={isQRegenerating}
                                      onClick={() => handleRegenerateItem(qIdx, 'answer')}
                                      sx={{
                                        textTransform: 'none',
                                        borderRadius: 2,
                                        fontWeight: 700,
                                        fontSize: '0.8rem',
                                        color: 'var(--c-sky-700)',
                                        borderColor: 'var(--c-sky-200)',
                                        bgcolor: 'var(--c-sky-50)',
                                        '&:hover': { bgcolor: 'var(--c-sky-100)', borderColor: 'var(--c-sky-300)' }
                                      }}
                                    >
                                      Toggle Correct Key
                                    </Button>
                                  )}
                                </Box>
                              </Box>
                            </Box>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </Box>

                {/* Bottom save action control */}
                <Box sx={{ mt: 5, display: 'flex', justifyContent: 'center' }}>
                  <Button
                    variant="contained"
                    color="success"
                    size="large"
                    startIcon={<Save />}
                    onClick={handleSaveExam}
                    disabled={Boolean(tosReport && !tosReport.compliant && !tosOverride)}
                    fullWidth={isMobile}
                    sx={{
                      // px: 6 (48px) around a ~200px label overflowed a ~310px content box
                      // at 390px; the horizontal padding now scales with the viewport.
                      px: { xs: 2.5, sm: 6 },
                      py: 1.8,
                      borderRadius: 3.5,
                      textTransform: 'none',
                      fontWeight: 700,
                      boxShadow: '0 4px 15px rgba(46, 125, 50, 0.2)',
                      '&:hover': {
                        transform: 'translateY(-1px)',
                        boxShadow: '0 6px 20px rgba(46, 125, 50, 0.3)',
                      }
                    }}
                  >
                    Save Template to Repository
                  </Button>
                </Box>
              </Box>
            )}
          </Box>
        )}

        {/* Navigation Step Button Controls */}
        {activeStep < 2 && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 5, pt: 2, borderTop: '1px solid var(--c-slate-100)' }}>
            <Button
              disabled={activeStep === 0}
              onClick={handleBack}
              startIcon={<ArrowBack />}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
            >
              Back
            </Button>
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={activeStep === 0 && !examTitle.trim()}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: 2.5,
                px: 3,
                boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
              }}
            >
              {activeStep === 1 ? 'Generate Question Pool' : 'Next'}
            </Button>
          </Box>
        )}
      </Paper>
      {ToastHost}
    </Container>
  );
}
