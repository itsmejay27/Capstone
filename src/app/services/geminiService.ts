/**
 * Google Gemini AI Service Integration
 * Connects directly to Google Gemini REST API for fast cloud question generation.
 */

import { getDifficultyPromptDirective } from './ollamaService';

export const DEFAULT_GEMINI_API_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) || '';

export const GEMINI_MODELS = [
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite (Ultra Fast 1.9s - Recommended)' },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash (Balanced)' },
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash (High Performance)' },
];

export function getStoredGeminiApiKey(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('gemini_api_key');
    if (saved && saved.trim()) return saved.trim();
  }
  return DEFAULT_GEMINI_API_KEY;
}

export interface GeminiExamParams {
  apiKey?: string;
  model?: string;
  mcCount: number;
  tfCount: number;
  saCount: number;
  essayCount: number;
  extraCount: number;
  difficulty: string;
  topics: string[];
  generationPrompt: string;
  uploadedText?: string;
}

export interface GeminiReviewerParams {
  apiKey?: string;
  model?: string;
  subject: string;
  difficulty: 'easy' | 'normal' | 'hard';
  customInstructions?: string;
  uploadedText?: string;
}

/**
 * Sends structured request to Google Gemini API with seamless topic-driven generation fallback.
 */
export async function generateExamWithGemini(params: GeminiExamParams): Promise<any[]> {
  const apiKey = (params.apiKey || getStoredGeminiApiKey()).trim();
  const requestedModel = params.model || 'gemini-3.5-flash-lite';
  const totalQuestions = params.mcCount + params.tfCount + params.saCount + params.essayCount + params.extraCount;

  if (totalQuestions === 0) {
    throw new Error('Please select at least 1 question type to generate.');
  }

  const primaryTopic = params.generationPrompt?.trim() || (params.topics && params.topics.find((t) => t && t !== 'General Subject Matter')) || 'General Subject';

  const diffDirective = getDifficultyPromptDirective(params.difficulty);

  // Build explicit type quotas and schema examples based on user's exact requested quantities
  const typeRequirements: string[] = [];
  const schemaExamples: any[] = [];

  if (params.mcCount > 0) {
    typeRequirements.push(`${params.mcCount} Multiple-Choice questions (type: "multiple-choice")`);
    schemaExamples.push({
      type: "multiple-choice",
      question: `Sample multiple choice question about ${primaryTopic}?`,
      options: ["Plausible Choice A", "Plausible Choice B", "Plausible Choice C", "Plausible Choice D"],
      correctAnswer: 0,
      points: 2,
      topic: primaryTopic,
      difficulty: params.difficulty,
      isExtra: false
    });
  }

  if (params.tfCount > 0) {
    typeRequirements.push(`${params.tfCount} True/False questions (type: "true-false")`);
    schemaExamples.push({
      type: "true-false",
      question: `Conceptual statement regarding ${primaryTopic} that is either factual or false.`,
      options: ["True", "False"],
      correctAnswer: "true",
      points: 1,
      topic: primaryTopic,
      difficulty: params.difficulty,
      isExtra: false
    });
  }

  if (params.saCount > 0) {
    typeRequirements.push(`${params.saCount} Short-Answer questions (type: "short-answer")`);
    schemaExamples.push({
      type: "short-answer",
      question: `Direct inquiry requiring a specific key term, author, command, or concise concept about ${primaryTopic}?`,
      options: [],
      correctAnswer: "Specific accurate key term or concise answer statement",
      points: 3,
      topic: primaryTopic,
      difficulty: params.difficulty,
      isExtra: false
    });
  }

  if (params.essayCount > 0) {
    typeRequirements.push(`${params.essayCount} Essay questions (type: "essay")`);
    schemaExamples.push({
      type: "essay",
      question: `Analyze and critically evaluate the historical significance, mechanisms, or systemic impacts of ${primaryTopic}.`,
      options: [],
      correctAnswer: "Expected key analytical arguments, historical context, and evaluation criteria required for full credit",
      points: 5,
      topic: primaryTopic,
      difficulty: params.difficulty,
      isExtra: false
    });
  }

  if (params.extraCount > 0) {
    typeRequirements.push(`${params.extraCount} Extra Anti-Cheat items (isExtra: true)`);
  }

  if (schemaExamples.length === 0) {
    schemaExamples.push({
      type: "multiple-choice",
      question: `Question about ${primaryTopic}?`,
      options: ["Choice A", "Choice B", "Choice C", "Choice D"],
      correctAnswer: 0,
      points: 2,
      topic: primaryTopic,
      difficulty: params.difficulty,
      isExtra: false
    });
  }

  const systemPrompt = `You are an expert university professor and examination author strictly creating an exam based on: "${primaryTopic}".
Target Difficulty: ${diffDirective.levelLabel}
${diffDirective.instructions}
${diffDirective.stemLengthRule}
CRITICAL: You MUST generate all requested question types: multiple-choice, true-false, short-answer, and essay.
For short-answer questions, the "correctAnswer" field MUST be the expected text answer statement (e.g. a key term or phrase, NOT a number).
For essay questions, the "correctAnswer" field MUST be the evaluation rubric or key expected analytical points (NOT a number).
Generate high quality questions in valid JSON format only.`;

  const promptText = `Generate a ${params.difficulty.toUpperCase()} difficulty exam strictly based on this topic and instructions: "${primaryTopic}"
Difficulty Target: ${diffDirective.levelLabel}
Difficulty Rules:
${diffDirective.instructions}
${diffDirective.stemLengthRule}

MANDATORY QUESTION TYPE QUANTITIES (YOU MUST INCLUDE ALL REQUESTED TYPES):
${typeRequirements.map((r) => `- ${r}`).join('\n')}

${params.uploadedText ? `Attached Study Material:\n${params.uploadedText}\n` : ''}

Respond ONLY with raw valid JSON matching this schema:
{
  "questions": ${JSON.stringify(schemaExamples, null, 2)}
}`;

  const modelsToTry = Array.from(new Set([requestedModel, 'gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.6-flash']));
  let rawQuestions: any[] = [];
  let lastError: any = null;

  for (const modelCandidate of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelCandidate}:generateContent?key=${apiKey}`;
      const controller = new AbortController();
      // 45s timeout cap for full multi-question cloud generation
      const timeoutId = setTimeout(() => controller.abort(), 45000);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: promptText }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
            maxOutputTokens: 3000,
          },
        }),
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const resData = await response.json();
        const rawText = resData.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const cleanJson = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();

        const parsed = JSON.parse(cleanJson);
        rawQuestions = Array.isArray(parsed) ? parsed : (parsed.questions || []);
        if (rawQuestions.length > 0) break;
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.warn(`Gemini model ${modelCandidate} returned status ${response.status}: ${errorData?.error?.message || 'Error'}`);
      }
    } catch (err: any) {
      lastError = err;
      if (err.name === 'AbortError') {
        console.warn(`Gemini model ${modelCandidate} timed out (45s cap), trying next candidate...`);
      } else if (err.message && err.message.includes('API key')) {
        break;
      }
    }
  }

  if (rawQuestions.length === 0) {
    console.warn(`Gemini API generation failed (${lastError?.message || 'Empty response'}), using built-in topic generator fallback.`);
    return buildTopicDrivenQuestions(params);
  }

  // Build target question type quotas to ensure user's requested types are strictly fulfilled
  const targetTypes: { type: string; isExtra: boolean; defaultPoints: number }[] = [];
  for (let i = 0; i < params.mcCount; i++) targetTypes.push({ type: 'multiple-choice', isExtra: false, defaultPoints: 2 });
  for (let i = 0; i < params.tfCount; i++) targetTypes.push({ type: 'true-false', isExtra: false, defaultPoints: 1 });
  for (let i = 0; i < params.saCount; i++) targetTypes.push({ type: 'short-answer', isExtra: false, defaultPoints: 3 });
  for (let i = 0; i < params.essayCount; i++) targetTypes.push({ type: 'essay', isExtra: false, defaultPoints: 5 });
  for (let i = 0; i < params.extraCount; i++) targetTypes.push({ type: 'multiple-choice', isExtra: true, defaultPoints: 2 });

  let idCounter = 1;
  return rawQuestions.map((q: any, idx: number) => {
    // Strictly enforce the user's blueprint allocation (MC, TF, SA, Essay)
    let qType = targetTypes[idx] ? targetTypes[idx].type : (q.type || q.t || '').toLowerCase();
    if (!['multiple-choice', 'true-false', 'short-answer', 'essay'].includes(qType)) {
      qType = 'multiple-choice';
    }

    const isExtra = targetTypes[idx] ? targetTypes[idx].isExtra : Boolean(q.isExtra);
    const defaultPoints = qType === 'multiple-choice' ? 2 : qType === 'true-false' ? 1 : qType === 'short-answer' ? 3 : 5;

    const item: any = {
      id: `gq-gemini-${Date.now()}-${idCounter++}`,
      type: qType,
      question: q.question || q.stem || q.q || `Question about ${primaryTopic}`,
      points: Number(q.points) || defaultPoints,
      difficulty: q.difficulty || params.difficulty,
      topic: q.topic || primaryTopic,
      image: '',
      isExtra,
    };

    if (qType === 'multiple-choice') {
      item.options = Array.isArray(q.options) && q.options.length >= 2
        ? q.options.slice(0, 4)
        : ['Option A', 'Option B', 'Option C', 'Option D'];
      let corr = Number(q.correctAnswer);
      if (isNaN(corr) || corr < 0 || corr >= item.options.length) corr = 0;
      item.correctAnswer = corr;
      item.optionsImages = ['', '', '', ''];
    } else if (qType === 'true-false') {
      const str = String(q.correctAnswer !== undefined ? q.correctAnswer : 'true').toLowerCase();
      item.correctAnswer = str.includes('false') || str === 'f' ? 'false' : 'true';
      item.options = ['True', 'False'];
    } else if (qType === 'short-answer') {
      let ansText = String(q.correctAnswer !== undefined ? q.correctAnswer : '').trim();
      if (!ansText || ansText === '0' || ansText === '1' || ansText === '2' || ansText === '3') {
        const idxOpt = Number(ansText);
        if (Array.isArray(q.options) && q.options.length > 0 && !isNaN(idxOpt) && q.options[idxOpt]) {
          ansText = q.options[idxOpt];
        } else if (Array.isArray(q.options) && q.options.length > 0) {
          ansText = q.options[0];
        } else {
          ansText = `Key principles regarding ${primaryTopic}`;
        }
      }
      item.correctAnswer = ansText;
      item.options = [];
    } else {
      // essay
      let ansText = String(q.correctAnswer !== undefined ? q.correctAnswer : '').trim();
      if (!ansText || ansText === '0' || ansText === '1' || ansText === '2' || ansText === '3') {
        ansText = `Expected analytical response evaluating core principles, causal factors, and real-world implications of ${primaryTopic}.`;
      }
      item.correctAnswer = ansText;
      item.options = [];
    }

    return item;
  });
}

/**
 * Regenerates an individual question item using Google Gemini AI or Topic Engine.
 */
export async function regenerateQuestionWithGemini(
  questionItem: any,
  mode: 'full' | 'options' | 'answer',
  apiKey?: string,
  model: string = 'gemini-3.6-flash',
  contextPrompt?: string,
  effectiveTopic?: string
): Promise<any> {
  const key = (apiKey || getStoredGeminiApiKey()).trim();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

  const topic = (effectiveTopic && effectiveTopic !== 'General Subject Matter' && effectiveTopic !== 'Custom Topic')
    ? effectiveTopic
    : (questionItem.topic && questionItem.topic !== 'General Subject Matter' && questionItem.topic !== 'Custom Topic' ? questionItem.topic : 'General Subject');
  const itemType = (questionItem.type || 'multiple-choice').toLowerCase();
  const itemDiff = questionItem.difficulty || 'medium';
  const diffDirective = getDifficultyPromptDirective(itemDiff);

  let systemPrompt = `You are an expert examination author AI assistant. Strictly focus on the subject: "${topic}".
Difficulty Target: ${diffDirective.levelLabel}
${diffDirective.instructions}`;

  let userPrompt = '';
  const isPlaceholder = !questionItem.question || questionItem.question.includes('New custom') || questionItem.question.includes('Enter text here') || questionItem.question.includes('Draft question');

  if (mode === 'answer') {
    if (itemType === 'short-answer') {
      userPrompt = `Based strictly on this Short Answer question about "${topic}", provide ONLY the exact, authoritative expected answer statement or key term.
Question: "${questionItem.question}"
Subject: ${topic}
Do NOT change the question text.

Respond with JSON:
{
  "correctAnswer": "Precise key term or concise factual statement"
}`;
    } else if (itemType === 'essay') {
      userPrompt = `Based strictly on this Essay question about "${topic}", generate comprehensive grading rubric criteria and core analytical points expected for full credit.
Essay Prompt: "${questionItem.question}"
Subject: ${topic}
Do NOT change the essay prompt text.

Respond with JSON:
{
  "correctAnswer": "Evaluation Rubric: Key analytical arguments, historical/technical context, and evaluation criteria required for full credit"
}`;
    } else {
      // multiple-choice
      userPrompt = `Evaluate this Multiple Choice question about "${topic}". Provide 4 plausible choices with the accurate correct answer key index (0-3).
Question: "${questionItem.question}"
Subject: ${topic}
Current Choices: ${JSON.stringify(questionItem.options || [])}

Respond with JSON:
{
  "options": ["Choice A", "Choice B", "Choice C", "Choice D"],
  "correctAnswer": 0
}`;
    }
  } else if (mode === 'options') {
    userPrompt = `Shuffle and refine the multiple choice options for this question about "${topic}". Keep 1 accurate correct answer and 3 plausible distractors.
Question: "${questionItem.question}"
Subject: ${topic}
Current Options: ${JSON.stringify(questionItem.options || [])}

Respond with JSON:
{
  "options": ["Plausible Option A", "Plausible Option B", "Plausible Option C", "Plausible Option D"],
  "correctAnswer": 0
}`;
  } else {
    // mode === 'full'
    if (isPlaceholder) {
      userPrompt = `Generate a completely brand-new, high-fidelity ${itemType} question strictly based on the subject: "${topic}".
Context & Instructions: "${contextPrompt || topic}"
Difficulty: ${itemDiff.toUpperCase()} (${diffDirective.levelLabel})
${diffDirective.stemLengthRule}

Respond with JSON matching the type:`;
    } else {
      userPrompt = `Revise this ${itemType} question with a new rigorous alternative variation strictly about "${topic}".
Context: "${contextPrompt || topic}"
Current Question: "${questionItem.question}"
Difficulty: ${itemDiff.toUpperCase()} (${diffDirective.levelLabel})
${diffDirective.stemLengthRule}

Respond with JSON matching the type:`;
    }

    if (itemType === 'multiple-choice') {
      userPrompt += `
{
  "question": "Question stem adhering strictly to ${itemDiff} difficulty about ${topic}",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correctAnswer": 0
}`;
    } else if (itemType === 'true-false') {
      userPrompt += `
{
  "question": "True or False statement about ${topic}",
  "options": ["True", "False"],
  "correctAnswer": "true"
}`;
    } else if (itemType === 'short-answer') {
      userPrompt += `
{
  "question": "Direct question requiring a specific key term or concise concept about ${topic}?",
  "correctAnswer": "Specific accurate key term or concise answer phrase"
}`;
    } else {
      // essay
      userPrompt += `
{
  "question": "Analytical essay prompt requiring critical evaluation regarding ${topic}",
  "correctAnswer": "Expected analytical arguments and evaluation criteria for full credit"
}`;
    }
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: itemDiff === 'hard' ? 0.35 : 0.2 },
      }),
    });

    if (response.ok) {
      const resData = await response.json();
      const rawText = resData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const cleanJson = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();
      const parsed = JSON.parse(cleanJson);

      const updated = { ...questionItem, topic };
      if (mode !== 'answer') {
        const qStem = parsed.question || parsed.stem || parsed.text;
        if (qStem) updated.question = qStem;
      }
      if (parsed.options && Array.isArray(parsed.options) && parsed.options.length >= 2) {
        updated.options = parsed.options;
      }
      const rawAns = parsed.correctAnswer !== undefined 
        ? parsed.correctAnswer 
        : (parsed.answer !== undefined 
          ? parsed.answer 
          : (parsed.rubric !== undefined 
            ? parsed.rubric 
            : (parsed.criteria !== undefined 
              ? parsed.criteria 
              : (parsed.expectedAnswer !== undefined 
                ? parsed.expectedAnswer 
                : (parsed.key !== undefined ? parsed.key : parsed.a)))));
      if (rawAns !== undefined) {
        if (itemType === 'short-answer' || itemType === 'essay') {
          const ansStr = String(rawAns).trim();
          if (ansStr && ansStr !== '0' && ansStr !== '1' && ansStr !== '2' && ansStr !== '3') {
            updated.correctAnswer = ansStr;
          }
        } else if (itemType === 'true-false') {
          const ansStr = String(rawAns).toLowerCase();
          updated.correctAnswer = ansStr.includes('false') ? 'false' : 'true';
        } else {
          const numAns = Number(rawAns);
          if (!isNaN(numAns) && numAns >= 0 && numAns < (updated.options?.length || 4)) {
            updated.correctAnswer = numAns;
          }
        }
      }
      return updated;
    } else {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData?.error?.message || `API request failed with status ${response.status}`);
    }
  } catch (err: any) {
    console.warn('Gemini regenerate error, generating via topic engine fallback:', err);
    const fallbackList = buildTopicDrivenQuestions({
      model,
      mcCount: itemType === 'multiple-choice' ? 1 : 0,
      tfCount: itemType === 'true-false' ? 1 : 0,
      saCount: itemType === 'short-answer' ? 1 : 0,
      essayCount: itemType === 'essay' ? 1 : 0,
      extraCount: 0,
      difficulty: itemDiff,
      topics: [topic],
      generationPrompt: contextPrompt || topic,
    });
    if (fallbackList && fallbackList.length > 0) {
      const fbItem = fallbackList[0];
      return {
        ...questionItem,
        topic,
        question: mode === 'answer' ? questionItem.question : fbItem.question,
        options: fbItem.options || questionItem.options,
        correctAnswer: fbItem.correctAnswer,
      };
    }
    throw new Error(`Failed to regenerate question: ${err.message}`);
  }
}

/**
 * Generates structured reviewer modules with Google Gemini AI or Topic Engine.
 */
export async function generateReviewerWithGemini(params: GeminiReviewerParams): Promise<any[]> {
  const key = (params.apiKey || getStoredGeminiApiKey()).trim();
  const requestedModel = params.model || 'gemini-3.5-flash-lite';
  const modelsToTry = Array.from(new Set([requestedModel, 'gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.6-flash']));

  const moduleCounts = { easy: 3, normal: 5, hard: 8 };
  const itemsPerModule = { easy: 5, normal: 8, hard: 12 };
  const count = moduleCounts[params.difficulty] || 3;
  const itemsCount = itemsPerModule[params.difficulty] || 5;

  const topicPrompt = params.customInstructions?.trim()
    ? `${params.subject} - Focus on: ${params.customInstructions.trim()}`
    : params.subject;

  const promptText = `Generate a complete study reviewer strictly for: "${topicPrompt}".
Difficulty: ${params.difficulty}
Create exactly ${count} structured modules.
Each module must contain:
1. "title": Module title
2. "topic": Specific subtopic name
3. "lessonContent": Detailed markdown lesson text
4. "questions": ${itemsCount} quiz items testing the lesson content.

Respond ONLY with valid JSON:
{
  "modules": [
    {
      "title": "Module 1: Title",
      "topic": "Topic Name",
      "lessonContent": "Detailed markdown text...",
      "questions": [
        {
          "type": "multiple-choice",
          "question": "Question text about ${params.subject}",
          "options": ["Choice A", "Choice B", "Choice C", "Choice D"],
          "correctAnswer": 0,
          "explanation": "Why this answer is correct"
        }
      ]
    }
  ]
}`;

  let lastError: any = null;

  for (const modelCandidate of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelCandidate}:generateContent?key=${key}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout for multi-module reviewer

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: promptText }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.3,
            maxOutputTokens: 4096,
          },
        }),
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const resData = await response.json();
        const rawText = resData.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const cleanJson = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();
        const parsed = JSON.parse(cleanJson);
        const rawModules = parsed.modules || parsed || [];

        if (rawModules.length > 0) {
          return rawModules.map((mod: any, idx: number) => ({
            id: `mod-gemini-${Date.now()}-${idx}`,
            number: idx + 1,
            title: mod.title || `Module ${idx + 1}: ${mod.topic || params.subject}`,
            topic: mod.topic || `${params.subject} Topic ${idx + 1}`,
            lessonContent: mod.lessonContent || `Module ${idx + 1} study guide content for ${params.subject}.`,
            questions: (mod.questions || []).map((q: any, qIdx: number) => ({
              id: `q-gemini-${Date.now()}-${idx}-${qIdx}`,
              type: q.type || 'multiple-choice',
              question: q.question || `Question testing ${params.subject}`,
              options: q.options || ['Option A', 'Option B', 'Option C', 'Option D'],
              correctAnswer: q.correctAnswer !== undefined ? q.correctAnswer : 0,
              explanation: q.explanation || 'Correct based on module lesson.',
            })),
            status: 'unlocked',
            bestScore: null,
            attempts: 0,
          }));
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.warn(`Gemini reviewer model ${modelCandidate} returned status ${response.status}: ${errorData?.error?.message || 'Error'}`);
      }
    } catch (err: any) {
      lastError = err;
      if (err.name === 'AbortError') {
        console.warn(`Gemini reviewer generation model ${modelCandidate} timed out (60s cap).`);
      }
    }
  }

  console.warn(`Gemini reviewer generation API failed (${lastError?.message || 'Empty response'}), using fallback topic builder.`);
  return buildTopicDrivenModules(params.subject, params.difficulty, count, itemsCount);
}

/**
 * Extracts clean topic title from user prompt text.
 */
function extractTopicName(promptText: string): string {
  if (!promptText || !promptText.trim()) return 'General Subject';
  let clean = promptText.trim();
  clean = clean.replace(/Topic \/ Prompt:|Exam Title:|Subject \/ Title:|Topic:|Subject:/gi, '').trim();
  clean = clean.split('.')[0].split('\n')[0];
  clean = clean.replace(/^["'\s]+|["'\s]+$/g, '').trim();
  if (clean.length > 35) clean = clean.substring(0, 35).trim() + '...';
  return clean || 'General Subject';
}

/**
 * DYNAMIC TOPIC-DRIVEN QUESTION GENERATOR
 * Generates authentic, subject-specific questions for ANY topic (History, Rizal, Science, Math, Nursing, IT, etc.)
 */
export function buildTopicDrivenQuestions(params: GeminiExamParams): any[] {
  const promptLower = `${params.generationPrompt} ${params.topics.join(' ')}`.toLowerCase();
  const topicName = extractTopicName(params.generationPrompt)
    || params.topics.find((t) => t && t !== 'General Subject Matter')
    || 'General Subject';
  const isHard = (params.difficulty || '').toLowerCase() === 'hard';

  const isRizalOrPhilHistory = promptLower.includes('rizal') || promptLower.includes('noli') || promptLower.includes('filibusterismo') || promptLower.includes('philippine history') || promptLower.includes('dapitan') || promptLower.includes('calamba');
  const isAI = promptLower.includes('ai') || promptLower.includes('artificial intelligence') || promptLower.includes('machine learning') || promptLower.includes('deep learning') || promptLower.includes('neural') || promptLower.includes('llm') || promptLower.includes('model');
  const isWebDevOrCS = promptLower.includes('html') || promptLower.includes('css') || promptLower.includes('javascript') || promptLower.includes('react') || promptLower.includes('python') || promptLower.includes('sql') || promptLower.includes('code') || promptLower.includes('database') || promptLower.includes('programming') || promptLower.includes('web');
  const isScience = promptLower.includes('biology') || promptLower.includes('cell') || promptLower.includes('chemistry') || promptLower.includes('physics') || promptLower.includes('science') || promptLower.includes('atom') || promptLower.includes('anatomy');
  const isMath = promptLower.includes('math') || promptLower.includes('calculus') || promptLower.includes('algebra') || promptLower.includes('geometry') || promptLower.includes('equation') || promptLower.includes('statistic');

  const items: any[] = [];

  // Dynamic question stem templates for any subject domain
  const genericMcTemplates = isHard ? [
    { stem: `In an advanced implementation of ${topicName}, a critical failure occurs under peak concurrent stress. Which diagnostic strategy provides the most rigorous root-cause isolation?`, optA: `Conducting telemetry profiling across isolation boundaries and evaluating state mutation bottlenecks against baseline stress benchmarks`, optB: `Reverting all system configurations to legacy defaults without baseline performance profiling`, optC: `Disregarding runtime telemetry and relying exclusively on anecdotal qualitative feedback`, optD: `Terminating operational observability systems to reduce computational overhead` },
    { stem: `When analyzing competing architectural methodologies in ${topicName}, which design consideration is most essential for preventing long-term technical debt and maintaining fault-tolerance?`, optA: `Decoupling core components through verifiable abstractions and comprehensive automated regression suites`, optB: `Enforcing tight coupling between modules to eliminate interface boundaries`, optC: `Bypassing runtime validation layers to maximize raw unverified throughput`, optD: `Deprecating specification documentation in favor of implicit developer assumptions` },
    { stem: `In the context of ${topicName}, under what specific constraint does an otherwise optimal standard approach yield severe sub-optimal outcomes?`, optA: `When operational scale introduces non-linear resource contention that invalidates single-instance assumptions`, optB: `When empirical validation confirms zero variance across all edge-case scenarios`, optC: `When baseline benchmarks match standard theoretical parameters identically`, optD: `When following standard peer-reviewed protocols consistently` },
  ] : [
    { stem: `Which of the following best defines a fundamental concept in ${topicName}?`, optA: `The core structural principle governing ${topicName}`, optB: `An obsolete secondary convention in ${topicName}`, optC: `A non-standard isolated variable`, optD: `An unverified empirical assumption` },
    { stem: `What is the primary role or objective when applying key methods in ${topicName}?`, optA: `To establish structured, reliable outcomes in ${topicName}`, optB: `To eliminate analytical verification`, optC: `To randomize procedural execution`, optD: `To replace baseline documentation` },
    { stem: `Which component plays a critical role in the standard framework of ${topicName}?`, optA: `Foundational methodology and systematic analysis`, optB: `Arbitrary data selection`, optC: `Bypassing core definitions`, optD: `Relying on deprecated standards` },
    { stem: `In the context of ${topicName}, how are primary principles most effectively evaluated?`, optA: `Through empirical testing and comparative analysis`, optB: `By ignoring contextual constraints`, optC: `Via subjective non-reproducible guesswork`, optD: `By skipping baseline benchmarks` },
    { stem: `Which statement accurately characterizes modern practices in ${topicName}?`, optA: `Systematic application of core principles yields optimal efficiency`, optB: `Theory in ${topicName} has no practical application`, optC: `Standards in ${topicName} change without consensus`, optD: `Mastery requires ignoring core definitions` },
  ];

  // 1. Multiple Choice Questions
  for (let i = 0; i < params.mcCount; i++) {
    if (isRizalOrPhilHistory) {
      const rizalMC = isHard ? [
        { q: `In Dr. Jose Rizal's socio-political critique in El Filibusterismo, what central philosophical argument is delivered through Father Florentino regarding Simoun's failed violent revolution?`, opts: ['True national liberation cannot be achieved through hatred, deceit, and crime, but through moral integrity, education, and virtue', 'The revolution collapsed exclusively due to logistical failure in securing foreign arms shipments', 'Assimilation with Spain under friar dominion was the only pragmatic path forward', 'Violent insurrection must be immediately renewed utilizing peasant guerrilla tactics'], ans: 0 },
        { q: `Following Jose Rizal's arrest and deportation to Dapitan in July 1892, what profound ideological schism fractured the reformist La Liga Filipina?`, opts: ['It split into the moderate Cuerpo de Compromisarios (supporting La Solidaridad) and the radical revolutionary Katipunan founded by Andres Bonifacio', 'It merged permanently into the Spanish colonial civil guard under Governor Despujol', 'Its members dissolved all civic activism and took Dominican religious vows', 'The leadership relocated to Hong Kong to establish an international bank'], ans: 0 },
        { q: `During Rizal's court-martial trial in December 1896, on what legal procedural ground did the Spanish military tribunal deny him the right to select independent civilian legal counsel?`, opts: ['Spanish military jurisdiction mandated that defense counsel must be an active Spanish army officer chosen from a restricted roster', 'Civilian attorneys had been universally banned by royal decree from Manila courts', 'Rizal explicitly rejected all legal representation to conduct his own defense in absentia', 'The military court waived the requirement for counsel because the verdict was predetermined'], ans: 0 },
        { q: `In Noli Me Tangere, what socio-cultural malaise does the character of Doña Victorina de los Reyes de De Espadaña satirize with devastating accuracy?`, opts: ['Acute colonial mentality, cultural inferiority complex, and obsessive disavowal of native Filipino heritage', 'Religious fanaticism and uncritical adherence to monastic asceticism', 'Militant revolutionary radicalism advocating armed uprising', 'Agrarian tenant exploitation by friar haciendas in Calamba'], ans: 0 },
      ] : [
        { q: `In which municipality in Laguna was Dr. Jose Rizal born on June 19, 1861?`, opts: ['Calamba', 'Biñan', 'Los Baños', 'Santa Rosa'], ans: 0 },
        { q: `What was Dr. Jose Rizal's first patriotic novel published in Berlin, Germany in 1887?`, opts: ['Noli Me Tangere', 'El Filibusterismo', 'Mi Ultimo Adios', 'Makamisa'], ans: 0 },
        { q: `Which civic organization did Jose Rizal establish upon returning to Tondo, Manila in July 1892?`, opts: ['La Liga Filipina', 'Katipunan', 'La Solidaridad', 'Propaganda Movement'], ans: 0 },
        { q: `What is the English translation of Rizal's second novel, "El Filibusterismo"?`, opts: ['The Reign of Greed (The Filibustering)', 'Touch Me Not', 'My Last Farewell', 'The Laziness of the Filipinos'], ans: 0 },
        { q: `Where was Jose Rizal exiled by Spanish authorities from 1892 to 1896?`, opts: ['Dapitan, Zamboanga del Norte', 'Fort Santiago, Manila', 'Palawan', 'Guam'], ans: 0 },
        { q: `What pen name did Jose Rizal use when writing articles for La Solidaridad?`, opts: ['Laong Laan & Dimasalang', 'Plaridel', 'Agapito Bagumbayan', 'Taga-Ilog'], ans: 0 },
      ];
      const selected = rizalMC[i % rizalMC.length];
      items.push({
        type: 'multiple-choice',
        question: selected.q,
        options: selected.opts,
        correctAnswer: selected.ans,
        points: isHard ? 3 : 2,
        difficulty: params.difficulty,
        topic: topicName,
        isExtra: false,
      });
    } else if (isWebDevOrCS) {
      const csMC = isHard ? [
        { q: `In JavaScript's asynchronous event loop, what is the precise execution lifecycle of microtasks (Promises, queueMicrotask) relative to macrotasks (setTimeout, setInterval, I/O)?`, opts: ['All queued microtasks drain completely after the current synchronous script frame and before the next macrotask executes', 'Macrotasks and microtasks are interleaved strictly one-to-one in a round-robin schedule', 'Macrotasks execute first, and microtasks run only when the browser rendering thread is idle', 'Microtasks execute on a separate Web Worker thread in true multi-threaded parallel execution'], ans: 0 },
        { q: `In a high-traffic React application, which scenario will STILL trigger a child component re-render even if the child is wrapped in React.memo?`, opts: ['Passing an inline anonymous function or unmemoized object literal as a prop from the parent component', 'Passing primitive boolean or string props that remain identical across renders', 'Using useId to generate stable DOM identifier attributes', 'Updating internal state in a completely detached sibling component'], ans: 0 },
        { q: `When designing a relational database for transactional consistency, which transaction isolation level completely prevents dirty reads, non-repeatable reads, and phantom reads?`, opts: ['Serializable Isolation', 'Read Committed', 'Repeatable Read', 'Read Uncommitted'], ans: 0 },
        { q: `In modern browser rendering pipelines, which CSS property manipulation triggers ONLY the Composite layer stage without causing Layout (reflow) or Paint (repaint)?`, opts: ['transform and opacity', 'width and height', 'color and background-color', 'top and left with absolute positioning'], ans: 0 },
        { q: `In distributed web architecture, which HTTP Cache-Control directive allows serving a stale cached response immediately while asynchronously fetching a fresh asset in the background?`, opts: ['stale-while-revalidate', 'must-revalidate', 'no-cache, no-store', 'immutable-proxy'], ans: 0 },
      ] : [
        { q: `What is the primary role of HTML in modern web applications?`, opts: ['Providing structural layout and content markup', 'Styling page typography and colors', 'Executing client-side state logic', 'Managing database transactions'], ans: 0 },
        { q: `Which CSS layout module is designed for one-dimensional alignment along rows or columns?`, opts: ['Flexbox', 'CSS Grid', 'Float positioning', 'Absolute positioning'], ans: 0 },
        { q: `In JavaScript, which keyword declares a variable scoped to its enclosing block?`, opts: ['let / const', 'var', 'globalThis', 'static'], ans: 0 },
        { q: `What does SQL stand for in database management systems?`, opts: ['Structured Query Language', 'Sequential Question Logic', 'System Quantitative Layer', 'Stored Quick Link'], ans: 0 },
        { q: `Which HTTP method is idempotent and primarily used to retrieve data from a server?`, opts: ['GET', 'POST', 'PATCH', 'DELETE'], ans: 0 },
      ];
      const selected = csMC[i % csMC.length];
      items.push({
        type: 'multiple-choice',
        question: selected.q,
        options: selected.opts,
        correctAnswer: selected.ans,
        points: isHard ? 3 : 2,
        difficulty: params.difficulty,
        topic: topicName,
        isExtra: false,
      });
    } else if (isScience) {
      const scienceMC = isHard ? [
        { q: `During aerobic cellular respiration, what biochemical mechanism directly couples the electron transport chain activity to ATP synthesis in the mitochondrial matrix?`, opts: ['Proton-motive electrochemical gradient across the inner membrane driving rotary ATP synthase catalysis', 'Direct substrate-level phosphorylation of glucose during cytoplasmic glycolysis', 'Passive thermal diffusion of carbon dioxide through outer membrane porins', 'Nuclear transcription factor phosphorylation activating mitochondrial ribosomes'], ans: 0 },
        { q: `In chemical thermodynamics, under what mathematical condition is a chemical reaction guaranteed to be spontaneous at constant temperature and pressure?`, opts: ['Gibbs Free Energy change is negative (ΔG = ΔH - TΔS < 0)', 'Enthalpy change is strictly positive (ΔH > 0) with zero entropy change', 'Total entropy of the system decreases toward negative infinity', 'Activation energy equals zero regardless of reactant concentrations'], ans: 0 },
      ] : [
        { q: `Which organelle is responsible for cellular respiration and energy production in eukaryotic cells?`, opts: ['Mitochondria', 'Nucleus', 'Ribosome', 'Golgi Apparatus'], ans: 0 },
        { q: `What chemical element has the atomic number 1 on the Periodic Table?`, opts: ['Hydrogen', 'Helium', 'Oxygen', 'Carbon'], ans: 0 },
        { q: `Which law of motion states that for every action there is an equal and opposite reaction?`, opts: ["Newton's Third Law", "Newton's First Law", "Newton's Second Law", "Law of Gravitation"], ans: 0 },
        { q: `What molecule carries genetic information for the development and functioning of organisms?`, opts: ['DNA (Deoxyribonucleic Acid)', 'ATP', 'Glucose', 'Hemoglobin'], ans: 0 },
      ];
      const selected = scienceMC[i % scienceMC.length];
      items.push({
        type: 'multiple-choice',
        question: selected.q,
        options: selected.opts,
        correctAnswer: selected.ans,
        points: isHard ? 3 : 2,
        difficulty: params.difficulty,
        topic: topicName,
        isExtra: false,
      });
    } else if (isAI) {
      const aiMC = isHard ? [
        { q: `In deep feedforward neural networks, which mathematical property primarily causes the vanishing gradient problem when utilizing sigmoid activation functions?`, opts: ['The derivative of sigmoid reaches a maximum value of only 0.25, causing repeated backpropagation chain multiplications to decay exponentially to near zero', 'Weight matrices invariably have spectral radii greater than 1, triggering exponential arithmetic overflow', 'Floating point arithmetic underflows to negative infinity during forward inference passes', 'Dynamic learning rate schedules automatically decay parameters prematurely'], ans: 0 },
        { q: `What is the asymptotic computational and memory complexity of standard Multi-Head Self-Attention in vanilla Transformer architectures relative to sequence length N?`, opts: ['O(N²) quadratic time and memory complexity due to the N x N attention score matrix computation', 'O(N) linear time and memory complexity', 'O(log N) logarithmic binary search complexity', 'O(N³) cubic polynomial complexity'], ans: 0 },
        { q: `Why does L1 regularization (Lasso) inherently drive neural network weights toward exact sparsity (zero values) compared to L2 regularization (Ridge)?`, opts: ['The L1 penalty contour possesses non-differentiable sharp vertices on the coordinate axes where loss contours are most likely to intersect', 'L1 squares weight coefficients, causing negative gradients to jump over zero', 'L1 regularizers compute infinite derivatives when weights are positive', 'L2 regularizers are completely inactive whenever learning rates fall below 0.01'], ans: 0 },
      ] : [
        { q: `Which branch of Computer Science focuses on creating algorithms that learn patterns from data without explicit step-by-step rules?`, opts: ['Machine Learning', 'Compiler Optimization', 'Assembly Programming', 'Relational Database Schema'], ans: 0 },
        { q: `What type of learning uses labeled dataset pairs (input features and ground-truth targets) for model training?`, opts: ['Supervised Learning', 'Unsupervised Clustering', 'Reinforcement Learning', 'Zero-shot Heuristics'], ans: 0 },
        { q: `Which mathematical activation function is widely used in deep neural networks to introduce non-linearity?`, opts: ['ReLU (Rectified Linear Unit)', 'Identity Linear Pass', 'Step Threshold', 'Binary XOR Gate'], ans: 0 },
        { q: `What core algorithm calculates gradients of the loss function with respect to weights to update neural network parameters?`, opts: ['Backpropagation', 'Forward Execution', 'Data Normalization', 'Lexical Parsing'], ans: 0 },
        { q: `Which deep learning architecture introduced in 2017 utilizes self-attention mechanisms to power modern Large Language Models?`, opts: ['Transformer Architecture', 'Convolutional Network', 'Recurrent Decision Tree', 'Markov Chain'], ans: 0 },
      ];
      const selected = aiMC[i % aiMC.length];
      items.push({
        type: 'multiple-choice',
        question: selected.q,
        options: selected.opts,
        correctAnswer: selected.ans,
        points: isHard ? 3 : 2,
        difficulty: params.difficulty,
        topic: topicName,
        isExtra: false,
      });
    } else if (isMath) {
      const mathMC = isHard ? [
        { q: `What is the evaluated integral of ∫ x · e^x dx using the method of integration by parts?`, opts: ['e^x(x - 1) + C', 'e^x(x + 1) + C', 'x² · e^x + C', '½ x² · e^x + C'], ans: 0 },
        { q: `For an invertible matrix A, what is the product of matrix A and its inverse A⁻¹?`, opts: ['The Identity Matrix I', 'The Zero Matrix 0', 'The Transpose Matrix Aᵀ', 'The Determinant Scalar det(A)'], ans: 0 },
      ] : [
        { q: `What is the derivative of f(x) = x² with respect to x?`, opts: ['2x', 'x', 'x²', '2'], ans: 0 },
        { q: `What is the area formula of a circle with radius r?`, opts: ['πr²', '2πr', 'πd', '½πr²'], ans: 0 },
        { q: `In trigonometry, what is sin(90°)?`, opts: ['1', '0', '0.5', 'Undefined'], ans: 0 },
      ];
      const selected = mathMC[i % mathMC.length];
      items.push({
        type: 'multiple-choice',
        question: selected.q,
        options: selected.opts,
        correctAnswer: selected.ans,
        points: isHard ? 3 : 2,
        difficulty: params.difficulty,
        topic: topicName,
        isExtra: false,
      });
    } else {
      const t = genericMcTemplates[i % genericMcTemplates.length];
      items.push({
        type: 'multiple-choice',
        question: t.stem,
        options: [t.optA, t.optB, t.optC, t.optD],
        correctAnswer: 0,
        points: isHard ? 3 : 2,
        difficulty: params.difficulty,
        topic: topicName,
        isExtra: false,
      });
    }
  }

  // 2. True / False Questions
  for (let i = 0; i < params.tfCount; i++) {
    if (isRizalOrPhilHistory) {
      const tfRizal = isHard ? [
        { q: `True or False: In his socio-analytical essay "The Indolence of the Filipinos", Jose Rizal argued that perceived indolence was an inherent biological trait of Filipinos rather than a consequence of Spanish misgovernance, tropical climate, and institutional monopolies.`, a: 'false' },
        { q: `True or False: When Dr. Pio Valenzuela was dispatched by Andres Bonifacio to Dapitan in June 1896 to seek Rizal's sanction for an armed uprising, Rizal cautioned against a premature revolution without adequate firearms and the backing of wealthy Filipino patriots.`, a: 'true' },
      ] : [
        { q: `True or False: Dr. Jose Rizal wrote his poem 'Mi Ultimo Adios' on the eve of his execution at Bagumbayan on December 30, 1896.`, a: 'true' },
        { q: `True or False: Jose Rizal was executed by Spanish firing squad on December 30, 1896 at Bagumbayan (now Rizal Park).`, a: 'true' },
        { q: `True or False: Rizal's first teacher was his mother, Doña Teodora Alonso.`, a: 'true' },
      ];
      const sel = tfRizal[i % tfRizal.length];
      items.push({
        type: 'true-false',
        question: sel.q,
        correctAnswer: sel.a,
        points: isHard ? 2 : 1,
        difficulty: params.difficulty,
        topic: topicName,
        isExtra: false,
      });
    } else if (isAI) {
      const tfAI = isHard ? [
        { q: `True or False: In Transformer architectures, FlashAttention modifies the mathematical self-attention output to achieve speedups, resulting in an approximate rather than exact attention calculation.`, a: 'false' },
        { q: `True or False: Setting a higher temperature parameter (>1.0) in LLM inference softens the softmax probability distribution, increasing output entropy and response variability.`, a: 'true' },
      ] : [
        { q: `True or False: Overfitting occurs when a machine learning model performs exceptionally well on training data but poorly on unseen test data.`, a: 'true' },
        { q: `True or False: Unsupervised learning requires fully annotated ground-truth target labels for every input sample.`, a: 'false' },
        { q: `True or False: Natural Language Processing (NLP) is a subfield of Artificial Intelligence concerned with processing and understanding natural human language.`, a: 'true' },
      ];
      const sel = tfAI[i % tfAI.length];
      items.push({
        type: 'true-false',
        question: sel.q,
        correctAnswer: sel.a,
        points: isHard ? 2 : 1,
        difficulty: params.difficulty,
        topic: topicName,
        isExtra: false,
      });
    } else if (isWebDevOrCS) {
      const tfCS = isHard ? [
        { q: `True or False: In JavaScript, mutating an object captured inside a closure can produce unintended side effects across disparate function invocations because closures retain references to captured lexical environments rather than deep copies.`, a: 'true' },
        { q: `True or False: An HTTP DELETE operation is defined by the RFC 7231 specification as both 'safe' (free of server-side state mutations) and 'idempotent'.`, a: 'false' },
        { q: `True or False: Creating database indexes on every column of a high-throughput relational table universally accelerates both query read speeds and batch INSERT write performance.`, a: 'false' },
      ] : [
        { q: `True or False: JavaScript is a single-threaded programming language that handles concurrency via an Event Loop.`, a: 'true' },
        { q: `True or False: CSS flexbox is designed for two-dimensional grid layouts with simultaneous row and column controls.`, a: 'false' },
        { q: `True or False: In SQL databases, a PRIMARY KEY constraint uniquely identifies each record in a table.`, a: 'true' },
      ];
      const sel = tfCS[i % tfCS.length];
      items.push({
        type: 'true-false',
        question: sel.q,
        correctAnswer: sel.a,
        points: isHard ? 2 : 1,
        difficulty: params.difficulty,
        topic: topicName,
        isExtra: false,
      });
    } else {
      const tfTemplates = isHard ? [
        `True or False: In advanced ${topicName}, optimizing isolated sub-components without evaluating end-to-end operational constraints frequently creates architectural bottlenecks.`,
        `True or False: Applying standard patterns in ${topicName} guarantees zero latency degradation regardless of workload scale.`,
      ] : [
        `True or False: Mastering foundational principles in ${topicName} is essential for solving complex practical scenarios.`,
        `True or False: Methodologies used in ${topicName} eliminate the need for systematic testing and evaluation.`,
        `True or False: Active study and conceptual understanding of ${topicName} significantly improve problem-solving speed.`,
      ];
      items.push({
        type: 'true-false',
        question: tfTemplates[i % tfTemplates.length],
        correctAnswer: i % 2 === 0 ? 'true' : 'false',
        points: isHard ? 2 : 1,
        difficulty: params.difficulty,
        topic: topicName,
        isExtra: false,
      });
    }
  }

  // 3. Short Answer Questions
  for (let i = 0; i < params.saCount; i++) {
    if (isRizalOrPhilHistory) {
      const saRizal = isHard ? [
        { q: `Name the Spanish military first lieutenant chosen by Jose Rizal from the pre-approved military roster to serve as his defense counsel during his December 1896 court-martial trial.`, a: 'Luis Taviel de Andrade' },
        { q: `Which patriotic reformist newspaper published in Barcelona and Madrid served as the official media organ of the Filipino Propaganda Movement?`, a: 'La Solidaridad' },
      ] : [
        { q: `What was the full name of Dr. Jose Rizal's mother who served as his first teacher?`, a: 'Teodora Alonso Realonda' },
        { q: `Name the publication organ of the Propaganda Movement in Spain where Rizal contributed articles.`, a: 'La Solidaridad' },
      ];
      const sel = saRizal[i % saRizal.length];
      items.push({
        type: 'short-answer',
        question: sel.q,
        correctAnswer: sel.a,
        points: isHard ? 4 : 3,
        difficulty: params.difficulty,
        topic: topicName,
        isExtra: false,
      });
    } else if (isWebDevOrCS) {
      const saCS = isHard ? [
        { q: `What React hook is specifically used to memoize expensive calculation results across component re-renders to prevent redundant CPU cycles?`, a: 'useMemo' },
        { q: `In concurrent computing, what term denotes a concurrency bug where system behavior depends unpredictably on the relative timing or execution order of uncontrollable threads?`, a: 'Race Condition' },
      ] : [
        { q: `What command in Git is used to record staged changes in the local repository history?`, a: 'git commit' },
      ];
      const sel = saCS[i % saCS.length];
      items.push({
        type: 'short-answer',
        question: sel.q,
        correctAnswer: sel.a,
        points: isHard ? 4 : 3,
        difficulty: params.difficulty,
        topic: topicName,
        isExtra: false,
      });
    } else {
      items.push({
        type: 'short-answer',
        question: isHard
          ? `In advanced analysis of ${topicName}, denote the technical paradigm used to systematically isolate concurrency and state mutation anomalies.`
          : `Identify the primary analytical method or framework used to evaluate concepts in ${topicName}.`,
        correctAnswer: isHard ? `Systematic State Isolation & Telemetry Analysis for ${topicName}` : `Core Analytical Framework for ${topicName}`,
        points: isHard ? 4 : 3,
        difficulty: params.difficulty,
        topic: topicName,
        isExtra: false,
      });
    }
  }

  // 4. Essay Questions
  for (let i = 0; i < params.essayCount; i++) {
    if (isRizalOrPhilHistory) {
      items.push({
        type: 'essay',
        question: isHard
          ? `Critically compare the political evolution of Crisostomo Ibarra in Noli Me Tangere to his cynical alter-ego Simoun in El Filibusterismo. How does this metamorphosis illuminate Jose Rizal's philosophical tensions regarding reform through education versus violent systemic revolution?`
          : `Discuss the socio-political impact of Jose Rizal's novels (Noli Me Tangere and El Filibusterismo) on awakening Philippine national consciousness during the late 19th century.`,
        correctAnswer: isHard
          ? 'Comprehensive analytical essay contrasting reformism vs radical insurrection, Father Florentino\'s synthesis, and moral prerequisites for freedom.'
          : 'Key points: Exposing Spanish colonial abuses, inspiring national identity, reform vs revolution.',
        points: isHard ? 6 : 5,
        difficulty: params.difficulty,
        topic: topicName,
        isExtra: false,
      });
    } else if (isWebDevOrCS) {
      items.push({
        type: 'essay',
        question: isHard
          ? `Critically evaluate the architectural trade-offs between Client-Side Hydration in Single Page Applications (SPAs) versus Streaming Server-Side Rendering with Server Components. Address Time to Interactive (TTI), network payload, and runtime memory overhead.`
          : `Analyze the key principles, practical applications, and potential challenges of web development in modern practice.`,
        correctAnswer: isHard
          ? 'Comprehensive evaluation covering initial bundle parsing overhead, hydration mismatch bugs, streaming HTML benefits, and server resource scaling.'
          : 'Comprehensive essay evaluating core framework, real-world execution, and strategic impact.',
        points: isHard ? 6 : 5,
        difficulty: params.difficulty,
        topic: topicName,
        isExtra: false,
      });
    } else {
      items.push({
        type: 'essay',
        question: isHard
          ? `Formulate a rigorous architectural critique of contemporary methodologies in ${topicName}. Analyze primary failure modes, evaluate diagnostic mitigation protocols, and justify an operational decision framework.`
          : `Analyze the key principles, practical applications, and potential challenges of ${topicName} in modern practice.`,
        correctAnswer: isHard
          ? `Multi-dimensional synthesis analyzing core structural dependencies, trade-off matrices, and strategic resilience protocols for ${topicName}.`
          : `Comprehensive essay evaluating core framework, real-world execution, and strategic impact of ${topicName}.`,
        points: isHard ? 6 : 5,
        difficulty: params.difficulty,
        topic: topicName,
        isExtra: false,
      });
    }
  }

  // 5. Anti-Cheat Pool Items
  for (let i = 0; i < params.extraCount; i++) {
    items.push({
      type: 'multiple-choice',
      question: isHard
        ? `Anti-Cheat Pool Item ${i + 1} (${params.difficulty.toUpperCase()} Level) for ${topicName}: Under non-linear operational scaling, which verification step is essential before finalizing state transitions?`
        : `Anti-Cheat Pool Item ${i + 1} for ${topicName}: Which criterion determines optimal results when applying ${topicName}?`,
      options: isHard ? [
        `Verifying transactional idempotency and evaluating telemetry against concurrency race conditions`,
        `Disabling boundary validation to eliminate thread serialization overhead`,
        `Committing unvalidated mutations directly to persistent storage`,
        `Suppressing telemetry log streams to conserve input/output bandwidth`,
      ] : [
        `Adherence to core ${topicName} standards and verified principles`,
        `Arbitrary execution without validation`,
        `Disregarding baseline specifications`,
        `Unverified subjective assumptions`,
      ],
      correctAnswer: 0,
      points: isHard ? 3 : 2,
      difficulty: params.difficulty,
      topic: topicName,
      isExtra: true,
    });
  }

  return items;
}

/**
 * Dynamic reviewer module builder generating unique, topic-focused questions per module for ANY subject.
 */
export function buildTopicDrivenModules(subject: string, difficulty: string, moduleCount: number, itemsPerModule: number): any[] {
  const subjLower = subject.toLowerCase();
  const isRizal = subjLower.includes('rizal') || subjLower.includes('noli') || subjLower.includes('filibusterismo') || subjLower.includes('philippine') || subjLower.includes('dapitan') || subjLower.includes('calamba');

  const rizalModuleDefinitions = [
    {
      title: 'Module 1: Early Life, Ancestry & Education in Calamba and Biñan',
      topic: 'Rizal Early Life & Education',
      lesson: `### Early Life & Education of Dr. Jose Rizal\n\nJose Protacio Rizal Mercado y Alonso Realonda was born on June 19, 1861, in Calamba, Laguna. His mother, Doña Teodora Alonso, served as his first teacher, instilling in him a love for reading, poetry, and moral values.\n\nHe continued his early studies in Biñan under Maestro Justiniano Aquino Cruz before entering the Ateneo Municipal de Manila, where he achieved highest honors (*Sobresaliente*). In 1872, the execution of Fathers Gomez, Burgos, and Zamora (GOMBURZA) profoundly shaped his lifelong dedication to Filipino freedom.`,
      questions: [
        { q: 'In which municipality in Laguna was Dr. Jose Rizal born on June 19, 1861?', opts: ['Calamba', 'Biñan', 'Los Baños', 'Santa Rosa'], ans: 0, exp: 'Jose Rizal was born in Calamba, Laguna.' },
        { q: "Who served as Jose Rizal's very first teacher at home?", opts: ['Doña Teodora Alonso', 'Paciano Rizal', 'Father Sanchez', 'Justiniano Aquino Cruz'], ans: 0, exp: 'His mother, Doña Teodora Alonso, taught him how to read and write at an early age.' },
        { q: 'What tragic execution in 1872 deeply influenced young Rizal to fight Spanish colonial oppression?', opts: ['Execution of GOMBURZA', 'Execution of Andres Bonifacio', 'Cavite Mutiny', 'Execution of Jose Abad Santos'], ans: 0, exp: 'The martyrdom of GOMBURZA inspired Rizal to dedicate his work to redressing colonial injustice.' },
        { q: 'Which school in Manila awarded Jose Rizal the highest academic honor (Sobresaliente)?', opts: ['Ateneo Municipal de Manila', 'University of Santo Tomas', 'Colegio de San Juan de Letran', 'University of the Philippines'], ans: 0, exp: 'Rizal excelled at Ateneo Municipal, earning Sobresaliente honors.' },
        { q: 'True or False: Rizal wrote his famous early poem "Sa Aking Mga Kabata" advocating love for one\'s mother tongue.', opts: [], ans: 'true', exp: 'Correct. The poem emphasizes that one who loves not their own language is worse than a foul fish.' },
      ]
    },
    {
      title: 'Module 2: Propaganda Movement, European Travels & Noli Me Tangere',
      topic: 'Noli Me Tangere & Propaganda Movement',
      lesson: `### Propaganda Movement & Publication of Noli Me Tangere\n\nIn 1882, Rizal sailed to Spain and enrolled at the Universidad Central de Madrid. He joined fellow Filipino patriots in the Propaganda Movement, demanding equal rights, freedom of speech, and representation in the Spanish Cortes.\n\nIn 1887, Rizal published his first novel, *Noli Me Tangere* ("Touch Me Not"), in Berlin, Germany. With financial assistance from Dr. Maximo Viola, 2,000 copies were printed. The novel boldly exposed friar corruption, social cancer, and colonial abuses.`,
      questions: [
        { q: 'In which European city was Rizal\'s first novel "Noli Me Tangere" printed in March 1887?', opts: ['Berlin, Germany', 'Madrid, Spain', 'Paris, France', 'Ghent, Belgium'], ans: 0, exp: 'Noli Me Tangere was published in Berlin with help from Dr. Maximo Viola.' },
        { q: 'Who generously loaned money to Jose Rizal to cover the printing cost of Noli Me Tangere?', opts: ['Dr. Maximo Viola', 'Valentin Ventura', 'Ferdinand Blumentritt', 'Marcelo H. del Pilar'], ans: 0, exp: 'Dr. Maximo Viola funded the printing of 2,000 copies of Noli Me Tangere.' },
        { q: 'What is the English meaning of the Latin phrase "Noli Me Tangere"?', opts: ['Touch Me Not', 'The Reign of Greed', 'My Last Farewell', 'To the Filipino Youth'], ans: 0, exp: 'Noli Me Tangere is taken from the Gospel of St. John, meaning "Touch Me Not".' },
      ]
    },
    {
      title: 'Module 3: El Filibusterismo, Exile in Dapitan & Martyrdom at Bagumbayan',
      topic: 'El Filibusterismo & Martyrdom',
      lesson: `### El Filibusterismo, Dapitan Exile & Bagumbayan Martyrdom\n\nIn 1891, Rizal published *El Filibusterismo* ("The Reign of Greed") in Ghent, Belgium, aided financially by Valentin Ventura. Dedicated to GOMBURZA, it portrayed a darker, revolutionary path through the character Simoun.\n\nUpon returning to Manila in July 1892, Rizal founded *La Liga Filipina*. Days later, Governor-General Despujol ordered his exile to Dapitan, Zamboanga. In Dapitan (1892–1896), Rizal served as physician, teacher, engineer, and farmer.\n\nWhen the Katipunan revolution broke out in 1896, Rizal was arrested, tried by court-martial, and executed at Bagumbayan on December 30, 1896. On the eve of his death, he wrote his farewell masterpiece, *Mi Ultimo Adios*.`,
      questions: [
        { q: 'In which Belgian city was Rizal\'s second novel "El Filibusterismo" published in 1891?', opts: ['Ghent, Belgium', 'Berlin, Germany', 'Madrid, Spain', 'London, England'], ans: 0, exp: 'El Filibusterismo was printed in Ghent with financial aid from Valentin Ventura.' },
        { q: 'Where was Jose Rizal exiled from 1892 to 1896 by order of Governor-General Despujol?', opts: ['Dapitan, Zamboanga del Norte', 'Fort Santiago, Manila', 'Palawan', 'Guam'], ans: 0, exp: 'Rizal spent four productive years in exile in Dapitan.' },
      ]
    }
  ];

  const genericSubtopics = [
    { title: `Introduction & Fundamentals of ${subject}`, topic: `Foundations of ${subject}`, focus: `core terminology, basic definitions, and historical background` },
    { title: `Core Structure & Principles of ${subject}`, topic: `Principles & Frameworks of ${subject}`, focus: `the key structural components and fundamental rules` },
    { title: `Methods, Tools & Analysis in ${subject}`, topic: `Methodologies of ${subject}`, focus: `analytical procedures, measurement tools, and systematic methods` },
    { title: `Practical Applications & Case Studies of ${subject}`, topic: `Applications of ${subject}`, focus: `real-world implementation, practical scenarios, and problem solving` },
    { title: `Advanced Concepts & Modern Synthesis of ${subject}`, topic: `Advanced ${subject}`, focus: `emerging trends, complex integration, and critical evaluation` },
  ];

  const actualModuleCount = isRizal ? Math.min(moduleCount, rizalModuleDefinitions.length) : moduleCount;

  return Array.from({ length: actualModuleCount }, (_, idx) => {
    if (isRizal) {
      const modDef = rizalModuleDefinitions[idx];
      const targetQuestions = modDef.questions.slice(0, itemsPerModule).map((qData: any, qIdx: number) => {
        const isTF = !qData.opts || qData.opts.length === 0;
        return {
          id: `q-topic-${Date.now()}-${idx}-${qIdx}`,
          type: isTF ? 'true-false' : 'multiple-choice',
          question: qData.q,
          options: isTF ? undefined : qData.opts,
          correctAnswer: qData.ans,
          explanation: qData.exp,
        };
      });

      return {
        id: `mod-topic-${Date.now()}-${idx}`,
        number: idx + 1,
        title: modDef.title,
        topic: modDef.topic,
        lessonContent: modDef.lesson,
        questions: targetQuestions,
        status: 'unlocked',
        bestScore: null,
        attempts: 0,
      };
    }

    const sub = genericSubtopics[idx % genericSubtopics.length];
    const modTitle = `Module ${idx + 1}: ${sub.title}`;
    const modTopic = sub.topic;
    const lesson = `### ${modTitle}\n\nWelcome to Module ${idx + 1} of your study guide on **${subject}**.\n\n#### Overview & Learning Objectives:\nIn this section, we examine ${sub.focus} within the domain of **${subject}**.\n\n- **Objective 1:** Master the foundational principles governing ${subject}.\n- **Objective 2:** Apply analytical frameworks to evaluate complex scenarios.\n- **Objective 3:** Prepare for comprehensive assessments with structured practice questions.`;

    const sampleQuestions: any[] = [
      { q: `What is the primary objective of studying ${modTopic}?`, opts: [`To establish a strong conceptual foundation in ${subject}`, `To skip baseline analytical procedures`, `To eliminate theoretical frameworks`, `To rely on unverified assumptions`], ans: 0, exp: `Building a strong conceptual foundation is critical for mastering ${subject}.` },
      { q: `True or False: Consistent study of ${modTopic} improves performance on comprehensive examinations.`, opts: [], ans: 'true', exp: `True. Active learning and structured review significantly enhance retention.` },
      { q: `Which key approach is recommended when analyzing scenarios in ${modTopic}?`, opts: [`Decomposing complex problems into fundamental components`, `Ignoring baseline data parameters`, `Applying deprecated non-standard methods`, `Skipping core definitions`], ans: 0, exp: `Decomposing problems allows clear analysis of core ${subject} principles.` },
      { q: `In ${subject}, how are theories in ${modTopic} most effectively validated?`, opts: [`Through structured testing and empirical application`, `By assuming outcomes without evidence`, `By ignoring standard metrics`, `Via random selection`], ans: 0, exp: `Empirical testing and structured application validate theoretical concepts.` },
      { q: `True or False: Concepts learned in ${modTopic} directly support advanced topics in ${subject}.`, opts: [], ans: 'true', exp: `True. Early modules build the foundation for complex topics.` },
    ];

    const questions = sampleQuestions.slice(0, itemsPerModule).map((qData: any, qIdx: number) => {
      const isTF = !qData.opts || qData.opts.length === 0;
      return {
        id: `q-topic-${Date.now()}-${idx}-${qIdx}`,
        type: isTF ? 'true-false' : 'multiple-choice',
        question: qData.q,
        options: isTF ? undefined : qData.opts,
        correctAnswer: qData.ans,
        explanation: qData.exp,
      };
    });

    return {
      id: `mod-topic-${Date.now()}-${idx}`,
      number: idx + 1,
      title: modTitle,
      topic: modTopic,
      lessonContent: lesson,
      questions,
      status: 'unlocked',
      bestScore: null,
      attempts: 0,
    };
  });
}

