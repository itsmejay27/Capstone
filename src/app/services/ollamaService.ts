/**
 * Ollama Local AI Service Integration
 * Connects directly to local Ollama API (http://localhost:11434 or proxy /api/ollama)
 */

import { buildTopicDrivenQuestions, buildTopicDrivenModules } from './geminiService';
import { TOSData, buildTOSConstraintText, normaliseCogLevel, extractFileText, isAdministrativeMetadata } from './tosParser';

export const DEFAULT_OLLAMA_URL = '/api/ollama';

export interface OllamaModelInfo {
  name: string;
  size?: number;
  modified_at?: string;
}

export interface OllamaConnectionState {
  connected: boolean;
  models: string[];
  activeModel: string;
  error?: string;
}

export interface ExamGenerationParams {
  model: string;
  mcCount: number;
  tfCount: number;
  saCount: number;
  essayCount: number;
  extraCount: number;
  difficulty: string;
  topics: string[];
  generationPrompt: string;
  uploadedText?: string;
  baseUrl?: string;
  tosData?: TOSData;
}

export interface ReviewerGenerationParams {
  model: string;
  subject: string;
  difficulty: 'easy' | 'normal' | 'hard';
  customInstructions?: string;
  uploadedText?: string;
  baseUrl?: string;
}

/**
 * Checks connection to local Ollama instance and returns available models.
 */
export async function checkOllamaConnection(baseUrl: string = DEFAULT_OLLAMA_URL): Promise<OllamaConnectionState> {
  const endpointsToTry = [baseUrl, 'http://localhost:11434', 'http://127.0.0.1:11434'];

  for (const endpoint of endpointsToTry) {
    try {
      const cleanEndpoint = endpoint.replace(/\/$/, '');
      const response = await fetch(`${cleanEndpoint}/api/tags`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        const models = (data.models || []).map((m: any) => m.name || m.model);
        // Prioritize lightweight 1B / 3B / phi / qwen models for ultra-fast local execution
        const preferredFastModel = models.find((m: string) => m.includes('1b') || m.includes('3.2') || m.includes('3b') || m.includes('phi') || m.includes('qwen') || m.includes('tiny')) || models[0] || 'llama3.2:latest';
        return {
          connected: true,
          models: models.length > 0 ? models : ['llama3.2:latest'],
          activeModel: preferredFastModel,
        };
      }
    } catch (err) {
      // Continue to next endpoint attempt
    }
  }

  return {
    connected: false,
    models: [],
    activeModel: '',
    error: 'Could not connect to Ollama. Make sure Ollama is running on your laptop (e.g., run "ollama serve" in terminal).',
  };
}

/**
 * Extracts plain text from uploaded files with PDF, DOCX, XLSX, and text support.
 */
export async function extractFilesContent(files: (File | null)[]): Promise<string> {
  const textParts: string[] = [];

  for (const file of files) {
    if (!file) continue;
    try {
      const content = await extractFileText(file);
      if (content.trim()) {
        textParts.push(`--- Attached Document (${file.name}) ---\n${content.substring(0, 4000)}`);
      } else {
        textParts.push(`--- Attached File (${file.name}, ${(file.size / 1024).toFixed(1)} KB) ---`);
      }
    } catch (err) {
      console.warn(`Error reading file ${file.name}:`, err);
    }
  }

  return textParts.join('\n\n');
}

/**
 * Robustly auto-repairs truncated or malformed JSON payloads from local LLMs.
 */
function parseTruncatedJson(text: string): any {
  if (!text) return null;
  let clean = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();

  // 1. Try standard JSON.parse
  try {
    return JSON.parse(clean);
  } catch (e) { }

  // 2. Extract complete question objects inside array via Regex
  const questionObjects: any[] = [];
  const objRegex = /\{\s*"(?:question|q|stem|title)"\s*:\s*"[\s\S]*?\}/g;
  let match;
  while ((match = objRegex.exec(clean)) !== null) {
    try {
      const parsedObj = JSON.parse(match[0]);
      questionObjects.push(parsedObj);
    } catch (e2) {
      try {
        const repaired = match[0] + '"';
        const withBrace = repaired.endsWith('}') ? repaired : repaired + '}';
        questionObjects.push(JSON.parse(withBrace));
      } catch (e3) { }
    }
  }

  if (questionObjects.length > 0) {
    return { questions: questionObjects };
  }

  // 3. Try auto-closing open brackets and braces
  let openBrackets = 0;
  let openBraces = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    if (char === '\\' && !escaped) {
      escaped = true;
      continue;
    }
    if (char === '"' && !escaped) {
      inString = !inString;
    }
    if (!inString) {
      if (char === '{') openBraces++;
      if (char === '}') openBraces--;
      if (char === '[') openBrackets++;
      if (char === ']') openBrackets--;
    }
    escaped = false;
  }

  let repairedStr = clean;
  if (inString) repairedStr += '"';
  while (openBraces > 0) {
    repairedStr += '}';
    openBraces--;
  }
  while (openBrackets > 0) {
    repairedStr += ']';
    openBrackets--;
  }

  try {
    return JSON.parse(repairedStr);
  } catch (e4) {
    console.warn('Auto-repair JSON failed:', e4);
  }

  return null;
}

/**
 * Flexibly extracts question items from any JSON structure produced by local LLMs.
 */
function extractQuestionsFromParsedJson(parsed: any): any[] {
  if (!parsed) return [];
  if (Array.isArray(parsed)) return parsed;

  if (typeof parsed === 'object') {
    if (Array.isArray(parsed.questions)) return parsed.questions;
    if (Array.isArray(parsed.items)) return parsed.items;
    if (Array.isArray(parsed.quiz)) return parsed.quiz;
    if (Array.isArray(parsed.exam)) return parsed.exam;
    if (Array.isArray(parsed.data)) return parsed.data;
    if (Array.isArray(parsed.results)) return parsed.results;
    if (Array.isArray(parsed.content)) return parsed.content;

    for (const key of Object.keys(parsed)) {
      if (Array.isArray(parsed[key]) && parsed[key].length > 0) {
        return parsed[key];
      }
    }
  }

  return [];
}

/**
 * Difficulty prompt guidance defining cognitive depth based on Bloom's Taxonomy.
 */
export interface DifficultyDirective {
  levelLabel: string;
  instructions: string;
  stemLengthRule: string;
}

export function getDifficultyPromptDirective(difficulty: string): DifficultyDirective {
  const diff = (difficulty || 'medium').toLowerCase();

  if (diff === 'hard') {
    return {
      levelLabel: 'HARD / SYNTHESIS & EVALUATION (Bloom\'s Higher-Order Thinking)',
      instructions: `CRITICAL INSTRUCTION - ALL QUESTIONS MUST BE ACADEMICALLY RIGOROUS, HIGH DIFFICULTY, AND COGNITIVELY CHALLENGING:
- Use scenario-based problems, real-world case studies, edge cases, subtle bug diagnostics, multi-step reasoning, or architectural trade-offs.
- STRICTLY FORBIDDEN: Do NOT generate trivial recall, simple definitions, or basic terminology questions (e.g., avoid "What does X stand for?" or "What year was Y born?").
- Multiple Choice questions MUST have 4 plausible, nuanced choices where distractors represent common misconceptions or subtle errors that require deep understanding to reject.
- Short Answer / Essay questions must require critical evaluation, comparative analysis, and justification of methods.`,
      stemLengthRule: `Question stems must be detailed and contextual (20 to 50 words). Choices must be substantial phrases or complete concepts (not simple one-word answers).`,
    };
  }

  if (diff === 'easy') {
    return {
      levelLabel: 'EASY / KNOWLEDGE & RECALL (Bloom\'s Foundational Level)',
      instructions: `Questions should focus on fundamental terminology, core definitions, basic concepts, and direct factual recall.
- Ensure stems are clear, direct, and unambiguous.
- Distractors should be distinct and easily identifiable for someone who studied the basics.`,
      stemLengthRule: `Keep question stems direct and straightforward (10 to 20 words). Choices should be clear and concise.`,
    };
  }

  if (diff === 'mixed') {
    return {
      levelLabel: 'MIXED PROPORTIONAL (Bloom\'s Full Spectrum: 30% Recall, 40% Application, 30% Synthesis)',
      instructions: `Distribute question complexity across cognitive levels:
- Include foundational knowledge items, procedural application items, and advanced analytical scenario items.
- Ensure higher-numbered items feature realistic multi-step problem solving.`,
      stemLengthRule: `Vary question stems from concise conceptual queries to multi-line scenario problems.`,
    };
  }

  // Default: medium
  return {
    levelLabel: 'MEDIUM / APPLICATION & ANALYSIS (Bloom\'s Intermediate Level)',
    instructions: `Questions should focus on practical application of principles, analyzing relationships, comparing methods, and predicting procedural outcomes.
- Avoid both overly trivial recall questions and excessively arcane edge cases.
- Emphasize practical understanding, realistic use cases, and distinguishing between similar concepts.`,
    stemLengthRule: `Stems should provide sufficient context (15 to 35 words). Choices should represent realistic alternatives.`,
  };
}

/**
 * Sends a structured generation request to local Ollama API for Exams/Quizzes using fast streaming.
 */
export async function generateExamWithOllama(params: ExamGenerationParams): Promise<any[]> {
  const userUrl = (params.baseUrl || DEFAULT_OLLAMA_URL).replace(/\/$/, '');
  const endpointsToTry = Array.from(new Set([userUrl, 'http://localhost:11434', 'http://127.0.0.1:11434']));
  const isTosMode = Boolean(params.tosData && (params.tosData.totalItems > 0 || params.tosData.rawText));

  let totalQuestions = params.mcCount + params.tfCount + params.saCount + params.essayCount + params.extraCount;
  if (isTosMode && params.tosData && params.tosData.totalItems > 0) {
    totalQuestions = params.tosData.totalItems + params.extraCount;
  }

  if (totalQuestions === 0) {
    throw new Error('Please select at least 1 question to generate or attach a Table of Specifications.');
  }

  // Ensure user's generation prompt is prioritized as the primary subject
  const promptTextRaw = params.generationPrompt?.trim() || '';
  const primaryTopic = promptTextRaw
    || (params.topics && params.topics.find((t) => t && t !== 'General Subject Matter'))
    || (params.tosData?.itemSpecs?.[0]?.topic)
    || 'General Subject';

  const diffDirective = getDifficultyPromptDirective(params.difficulty);

  let systemPrompt = '';
  let promptText = '';

  if (isTosMode && params.tosData) {
    systemPrompt = `You are an expert examination author creating an exam strictly adhering to an official Table of Specifications (TOS).

================================================================================
=== [MANDATORY STEP 1: TOS ANALYSIS & INVENTORY] ===
================================================================================
Before generating any exam questions, perform the following verification:
1. Read the attached TOS file thoroughly.
2. List out the exact distribution requested in the TOS:
   - Topics covered and their corresponding item counts.
   - Cognitive level breakdown (e.g., Remembering/Understanding, Applying/Analyzing, Synthesizing/Evaluating).
   - Total number of questions specified.
3. ANTI-HALLUCINATION GUARDRAIL:
   - NEVER generate questions asking about document administrative metadata (such as "Effectivity Date", "Revision No", "Form No", "Prepared by", "Approved by", "OMSC", "Page 1 of 3", or dates).
   - Questions MUST exclusively test the substantive academic syllabus and domain knowledge (e.g. ${primaryTopic}).

================================================================================
=== MANDATORY STEP 2: COMPLETE QUESTION GENERATION ===
================================================================================
Generate the questions strictly matching the Table of Specifications.
For each question, output: "cognitiveLevel", "topic", and "itemPlacement".
Respond ONLY with raw, valid JSON.`;

    promptText = `[MANDATORY STEP 1: TOS ANALYSIS & INVENTORY]
Before generating any exam questions, perform the following verification:
1. Read the attached TOS file thoroughly.
2. List out the exact distribution requested in the TOS:
   - Topics covered and their corresponding item counts.
   - Cognitive level breakdown (e.g., Remembering/Understanding, Applying/Analyzing, Synthesizing/Evaluating).
   - Total number of questions specified.

${buildTOSConstraintText(params.tosData)}

${params.uploadedText ? `Context & Source Material:\n${params.uploadedText}\n` : ''}

CRITICAL ANTI-HALLUCINATION DIRECTIVE:
Under NO circumstances should you generate questions asking about document metadata such as "Effectivity Date", "Revision No", "Prepared by", "March 01, 2024", or college headers.
You MUST generate substantive, authentic academic questions covering the actual course curriculum topics (e.g. ${primaryTopic}).

Respond ONLY with valid JSON matching this schema:
{
  "questions": [
    {
      "itemPlacement": 1,
      "t": "multiple-choice",
      "cognitiveLevel": "Remembering",
      "topic": "${primaryTopic}",
      "q": "Sample question for Item 1 testing knowledge?",
      "o": ["Choice A", "Choice B", "Choice C", "Choice D"],
      "a": 0,
      "points": 1,
      "e": false
    }
  ]
}`;
  } else {
    // Build explicit type quotas and schema examples based on user's exact requested quantities
    const typeRequirements: string[] = [];
    const schemaExamples: any[] = [];

    if (params.mcCount > 0) {
      typeRequirements.push(`${params.mcCount} Multiple-Choice questions (type: "multiple-choice")`);
      schemaExamples.push({
        t: "multiple-choice",
        q: `Sample scenario or question about ${primaryTopic}?`,
        o: ["Plausible Option A", "Plausible Option B", "Plausible Option C", "Plausible Option D"],
        a: 0,
        points: 2,
        e: false
      });
    }

    if (params.tfCount > 0) {
      typeRequirements.push(`${params.tfCount} True/False questions (type: "true-false")`);
      schemaExamples.push({
        t: "true-false",
        q: `Conceptual statement regarding ${primaryTopic} that is either factual or false.`,
        o: ["True", "False"],
        a: "true",
        points: 1,
        e: false
      });
    }

    if (params.saCount > 0) {
      typeRequirements.push(`${params.saCount} Short-Answer questions (type: "short-answer")`);
      schemaExamples.push({
        t: "short-answer",
        q: `Direct question requiring a specific key term, author, command, or concise concept about ${primaryTopic}?`,
        o: [],
        a: "Specific accurate key term or concise answer phrase",
        points: 3,
        e: false
      });
    }

    if (params.essayCount > 0) {
      typeRequirements.push(`${params.essayCount} Essay / Long-Response questions (type: "essay")`);
      schemaExamples.push({
        t: "essay",
        q: `Analyze and critically evaluate the historical significance, mechanisms, or systemic impacts of ${primaryTopic}.`,
        o: [],
        a: "Expected key analytical arguments, historical context, and evaluation criteria required for full credit",
        points: 5,
        e: false
      });
    }

    if (params.extraCount > 0) {
      typeRequirements.push(`${params.extraCount} Extra Anti-Cheat items (isExtra: true)`);
    }

    if (schemaExamples.length === 0) {
      schemaExamples.push({
        t: "multiple-choice",
        q: `Question about ${primaryTopic}?`,
        o: ["Option A", "Option B", "Option C", "Option D"],
        a: 0,
        points: 2,
        e: false
      });
    }

    systemPrompt = `You are an expert examination author and university professor creating an exam strictly on: "${primaryTopic}".
Target Difficulty: ${diffDirective.levelLabel}
${diffDirective.instructions}
${diffDirective.stemLengthRule}
CRITICAL: You MUST generate all requested question types: multiple-choice, true-false, short-answer, and essay.
For short-answer questions, the "a" field MUST be the expected text answer statement (e.g. a key term or phrase, NOT a number).
For essay questions, the "a" field MUST be the evaluation rubric or key expected analytical points (NOT a number).
Respond ONLY with raw, valid JSON.`;

    promptText = `Generate a ${params.difficulty.toUpperCase()} difficulty exam strictly based on: "${primaryTopic}".
Difficulty Target: ${diffDirective.levelLabel}
Rules:
${diffDirective.instructions}
${diffDirective.stemLengthRule}

MANDATORY QUESTION TYPE QUANTITIES (YOU MUST INCLUDE ALL REQUESTED TYPES):
${typeRequirements.map((r) => `- ${r}`).join('\n')}

${params.uploadedText ? `Context & Source Material:\n${params.uploadedText.substring(0, 1200)}\n` : ''}

Respond ONLY with valid JSON matching this schema:
{
  "questions": ${JSON.stringify(schemaExamples, null, 2)}
}`;
  }

  let rawQuestions: any[] = [];
  let connectionError: string | null = null;

  for (const endpoint of endpointsToTry) {
    try {
      const cleanEndpoint = endpoint.replace(/\/$/, '');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const response = await fetch(`${cleanEndpoint}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: params.model || 'llama3.2:latest',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: promptText },
          ],
          stream: true,
          format: 'json',
          keep_alive: '15m',
          options: {
            num_ctx: 2048,
            num_predict: Math.min(2048, Math.max(900, totalQuestions * 200)),
            temperature: params.difficulty === 'hard' ? 0.35 : params.difficulty === 'easy' ? 0.05 : 0.2,
            top_k: 20,
            top_p: 0.8,
          },
        }),
      });
      clearTimeout(timeoutId);

      if (response.ok && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const jsonLine = JSON.parse(line);
              if (jsonLine.message?.content) {
                accumulatedText += jsonLine.message.content;
              }
            } catch (e) { }
          }
        }

        const parsed = parseTruncatedJson(accumulatedText);
        rawQuestions = extractQuestionsFromParsedJson(parsed);

        if (rawQuestions.length > 0) {
          break;
        }
      }
    } catch (err: any) {
      connectionError = err.name === 'AbortError'
        ? 'Ollama request timed out after 60s'
        : (err.message || 'Connection failed');
    }
  }

  // If local Ollama returned empty or parse error, fallback to topic generator
  if (rawQuestions.length === 0) {
    console.warn(`Ollama API call could not be completed (${connectionError || 'No response'}), using topic fallback engine.`);
    rawQuestions = buildTopicDrivenQuestions(params as any);
  }

  // Build target question type quotas to ensure user's requested types are strictly fulfilled
  const targetTypes: { type: string; isExtra: boolean; defaultPoints: number }[] = [];
  if (!isTosMode) {
    for (let i = 0; i < params.mcCount; i++) targetTypes.push({ type: 'multiple-choice', isExtra: false, defaultPoints: 2 });
    for (let i = 0; i < params.tfCount; i++) targetTypes.push({ type: 'true-false', isExtra: false, defaultPoints: 1 });
    for (let i = 0; i < params.saCount; i++) targetTypes.push({ type: 'short-answer', isExtra: false, defaultPoints: 3 });
    for (let i = 0; i < params.essayCount; i++) targetTypes.push({ type: 'essay', isExtra: false, defaultPoints: 5 });
    for (let i = 0; i < params.extraCount; i++) targetTypes.push({ type: 'multiple-choice', isExtra: true, defaultPoints: 2 });
  }

  let idCounter = 1;
  return rawQuestions.map((q: any, idx: number) => {
    const spec = params.tosData?.itemSpecs?.[idx];

    let qType = spec?.questionType || (targetTypes[idx] ? targetTypes[idx].type : (q.t || q.type || q.question_type || '').toLowerCase());
    if (!['multiple-choice', 'true-false', 'short-answer', 'essay'].includes(qType)) {
      qType = 'multiple-choice';
    }

    const isExtra = targetTypes[idx] ? targetTypes[idx].isExtra : Boolean(q.e || q.isExtra || q.is_extra);
    const defaultPoints = spec?.points || (qType === 'multiple-choice' ? 2 : qType === 'true-false' ? 1 : qType === 'short-answer' ? 3 : 5);
    const cogLevel = normaliseCogLevel(q.cognitiveLevel || q.bloomLevel || q.level) || spec?.cognitiveLevel || (params.difficulty === 'hard' ? 'Analyzing' : 'Understanding');
    let topicName = q.topic || spec?.topic || primaryTopic;
    if (isAdministrativeMetadata(topicName)) {
      topicName = params.tosData?.topics?.find((t) => !isAdministrativeMetadata(t)) || primaryTopic;
    }
    const placementNum = q.itemPlacement || spec?.itemNumber || (idx + 1);

    let questionStem = q.q || q.question || q.stem || q.text || q.title || `Question about ${topicName}`;
    if (
      isAdministrativeMetadata(questionStem) ||
      questionStem.toLowerCase().includes('effectivity date') ||
      questionStem.toLowerCase().includes('table of specification of') ||
      questionStem.toLowerCase().includes('reference document for the table')
    ) {
      questionStem = `In ${topicName}, which of the following best describes its core purpose and functional mechanism?`;
    }

    const formattedItem: any = {
      id: `gq-ollama-${Date.now()}-${idCounter++}`,
      type: qType,
      question: questionStem,
      points: Number(q.points || q.score) || defaultPoints,
      difficulty: q.difficulty || (['Remembering', 'Understanding'].includes(cogLevel) ? 'easy' : ['Evaluating', 'Creating'].includes(cogLevel) ? 'hard' : 'medium'),
      topic: topicName,
      cognitiveLevel: cogLevel,
      itemPlacement: placementNum,
      image: '',
      isExtra: isExtra,
    };

    const rawOptions = q.o || q.options || q.choices || q.answers || q.opts;
    const rawAnswer = q.a !== undefined
      ? q.a
      : (q.correctAnswer !== undefined ? q.correctAnswer : (q.answer !== undefined ? q.answer : q.key));

    if (qType === 'multiple-choice') {
      formattedItem.options = Array.isArray(rawOptions) && rawOptions.length >= 2
        ? rawOptions.slice(0, 4)
        : ['Option A', 'Option B', 'Option C', 'Option D'];

      let corr = Number(rawAnswer);
      if (isNaN(corr) || corr < 0 || corr >= formattedItem.options.length) {
        if (typeof rawAnswer === 'string') {
          const charCode = rawAnswer.trim().toUpperCase().charCodeAt(0);
          if (charCode >= 65 && charCode <= 68) {
            corr = charCode - 65;
          } else {
            const parsedNum = parseInt(rawAnswer, 10);
            corr = !isNaN(parsedNum) && parsedNum >= 1 && parsedNum <= formattedItem.options.length ? parsedNum - 1 : 0;
          }
        } else {
          corr = 0;
        }
      }
      formattedItem.correctAnswer = corr;
      formattedItem.optionsImages = ['', '', '', ''];
    } else if (qType === 'true-false') {
      const corrStr = String(rawAnswer !== undefined ? rawAnswer : 'true').toLowerCase();
      formattedItem.correctAnswer = corrStr.includes('false') || corrStr === 'f' ? 'false' : 'true';
      formattedItem.options = ['True', 'False'];
    } else if (qType === 'short-answer') {
      let ansText = String(rawAnswer !== undefined ? rawAnswer : '').trim();
      // Clean up artifact if LLM returned 0, 1, 2, 3 as an index from an MC template
      if (!ansText || ansText === '0' || ansText === '1' || ansText === '2' || ansText === '3') {
        const idxOpt = Number(ansText);
        if (Array.isArray(rawOptions) && rawOptions.length > 0 && !isNaN(idxOpt) && rawOptions[idxOpt]) {
          ansText = rawOptions[idxOpt];
        } else if (Array.isArray(rawOptions) && rawOptions.length > 0) {
          ansText = rawOptions[0];
        } else {
          ansText = `Key principles and terminology regarding ${primaryTopic}`;
        }
      }
      formattedItem.correctAnswer = ansText;
      formattedItem.options = [];
    } else {
      // essay
      let ansText = String(rawAnswer !== undefined ? rawAnswer : '').trim();
      if (!ansText || ansText === '0' || ansText === '1' || ansText === '2' || ansText === '3') {
        ansText = `Expected analytical response discussing core concepts, causal mechanisms, and practical implications of ${primaryTopic}.`;
      }
      formattedItem.correctAnswer = ansText;
      formattedItem.options = [];
    }

    return formattedItem;
  });
}

/**
 * Regenerates an individual question item using Ollama.
 */
export async function regenerateQuestionWithOllama(
  model: string,
  questionItem: any,
  mode: 'full' | 'options' | 'answer',
  baseUrl: string = DEFAULT_OLLAMA_URL
): Promise<any> {
  const userUrl = baseUrl.replace(/\/$/, '');
  const endpointsToTry = Array.from(new Set([userUrl, 'http://localhost:11434', 'http://127.0.0.1:11434']));
  const topic = questionItem.topic || 'Subject Matter';
  const itemDiff = questionItem.difficulty || 'medium';
  const diffDirective = getDifficultyPromptDirective(itemDiff);

  const itemType = (questionItem.type || 'multiple-choice').toLowerCase();
  let systemPrompt = `You are an expert examination author AI assistant. Revise the question strictly for topic "${topic}".
Difficulty: ${diffDirective.levelLabel}
${diffDirective.instructions}
${diffDirective.stemLengthRule}
Return ONLY a valid JSON object.`;

  let userPrompt = `Revise this question (${mode} mode) strictly about "${topic}" in JSON format:
Difficulty Target: ${itemDiff.toUpperCase()} (${diffDirective.levelLabel})
Current Question: "${questionItem.question}"
Type: ${questionItem.type}
Topic: ${topic}

Respond with JSON:
{
  "question": "Revised question stem adhering strictly to ${itemDiff} difficulty",
  "options": ["Plausible Choice A", "Plausible Choice B", "Plausible Choice C", "Plausible Choice D"],
  "correctAnswer": 0
}`;

  if (mode === 'answer') {
    if (itemType === 'short-answer') {
      systemPrompt = `You are an expert examination author AI assistant. Provide the exact expected answer key for this short answer question. Return ONLY a valid JSON object.`;
      userPrompt = `Based strictly on this Short Answer question about "${topic}", provide ONLY the exact authoritative expected answer key term or statement.
Question: "${questionItem.question}"
Subject: ${topic}
Do NOT change the question text.

Respond with JSON:
{
  "correctAnswer": "Precise key term or concise factual statement"
}`;
    } else if (itemType === 'essay') {
      systemPrompt = `You are an expert examination author AI assistant. Provide comprehensive grading rubric criteria for this essay question. Return ONLY a valid JSON object.`;
      userPrompt = `Based strictly on this Essay question about "${topic}", generate comprehensive grading rubric criteria and core analytical points expected for full credit.
Essay Prompt: "${questionItem.question}"
Subject: ${topic}
Do NOT change the essay prompt text.

Respond with JSON:
{
  "correctAnswer": "Evaluation Rubric: Key analytical arguments, historical/technical context, and evaluation criteria required for full credit"
}`;
    } else if (itemType === 'multiple-choice') {
      userPrompt = `Evaluate this Multiple Choice question about "${topic}". Provide 4 plausible choices with the accurate correct answer key index (0-3).
Question: "${questionItem.question}"
Current Choices: ${JSON.stringify(questionItem.options || [])}

Respond with JSON:
{
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "correctAnswer": 0
}`;
    }
  }

  for (const endpoint of endpointsToTry) {
    try {
      const cleanUrl = endpoint.replace(/\/$/, '');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout for question regeneration

      const response = await fetch(`${cleanUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: model || 'llama3.2:latest',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          stream: false,
          format: 'json',
          options: {
            num_ctx: 2048,
            num_predict: 400,
            temperature: itemDiff === 'hard' ? 0.35 : 0.1,
          },
        }),
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const rawText = data.message?.content || data.response || '';
        const parsed = parseTruncatedJson(rawText);
        if (parsed) {
          const updated = { ...questionItem };
          if (mode !== 'answer') {
            const qStem = parsed.question || parsed.stem || parsed.text || parsed.q;
            if (qStem) updated.question = qStem;
          }
          if (parsed.options || parsed.o) {
            if (itemType === 'multiple-choice') {
              updated.options = parsed.options || parsed.o;
            }
          }
          const rawAns = parsed.correctAnswer ?? parsed.answer ?? parsed.rubric ?? parsed.criteria ?? parsed.expectedAnswer ?? parsed.key ?? parsed.a;
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
              if (!isNaN(numAns)) updated.correctAnswer = numAns;
            }
          }
          return updated;
        }
      }
    } catch (err) {
      console.warn('Ollama regenerate attempt failed:', err);
    }
  }

  return {
    ...questionItem,
    question: `Revised Question about ${topic}: ${questionItem.question.replace(/\(AI Revised\)/g, '').trim()}`,
  };
}

/**
 * Generates structured learning modules with lesson text and quizzes for ReviewerGenerator.
 */
export async function generateReviewerWithOllama(params: ReviewerGenerationParams): Promise<any[]> {
  const userUrl = (params.baseUrl || DEFAULT_OLLAMA_URL).replace(/\/$/, '');
  const endpointsToTry = Array.from(new Set([userUrl, 'http://localhost:11434', 'http://127.0.0.1:11434']));

  const moduleCounts = { easy: 3, normal: 4, hard: 5 };
  const itemsPerModule = { easy: 4, normal: 5, hard: 6 };
  const targetCount = moduleCounts[params.difficulty] || 3;
  const itemsCount = itemsPerModule[params.difficulty] || 4;

  const topicPrompt = params.customInstructions?.trim()
    ? `Subject: "${params.subject}". Focus: "${params.customInstructions.trim()}"`
    : `Subject: "${params.subject}"`;

  const diffDirective = getDifficultyPromptDirective(params.difficulty === 'normal' ? 'medium' : params.difficulty);

  const systemPrompt = `You are an expert learning content authoring AI strictly creating study modules for: ${topicPrompt}.
Difficulty: ${diffDirective.levelLabel}
${diffDirective.instructions}
Respond ONLY with valid JSON.`;

  const userPrompt = `Create a comprehensive study reviewer strictly based on: ${topicPrompt}.
Difficulty Target: ${params.difficulty.toUpperCase()} (${diffDirective.levelLabel})
Create exactly ${targetCount} modules with ${itemsCount} questions per module.
Ensure the lesson content and module questions thoroughly reflect ${params.difficulty} difficulty level.

${params.uploadedText ? `Reference Material: ${params.uploadedText.substring(0, 1200)}\n` : ''}

Respond ONLY with valid JSON:
{
  "modules": [
    {
      "title": "Module 1: Title",
      "topic": "Topic Name",
      "lessonContent": "### Module Overview\\n- Detailed Point 1\\n- Detailed Point 2\\n- Detailed Point 3",
      "questions": [
        {
          "type": "multiple-choice",
          "question": "Question stem about ${params.subject}",
          "options": ["Choice A", "Choice B", "Choice C", "Choice D"],
          "correctAnswer": 0,
          "explanation": "Short explanation"
        }
      ]
    }
  ]
}`;

  let rawModules: any[] = [];
  let connectionError: string | null = null;

  for (const endpoint of endpointsToTry) {
    try {
      const cleanEndpoint = endpoint.replace(/\/$/, '');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 90000);

      const response = await fetch(`${cleanEndpoint}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: params.model || 'llama3.2:latest',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          stream: true,
          format: 'json',
          keep_alive: '15m',
          options: {
            num_ctx: 2048,
            num_predict: Math.min(2048, Math.max(900, targetCount * itemsCount * 90)),
            temperature: params.difficulty === 'hard' ? 0.3 : 0.1,
            top_k: 20,
            top_p: 0.8,
          },
        }),
      });
      clearTimeout(timeoutId);

      if (response.ok && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunkStr = decoder.decode(value, { stream: true });
          const lines = chunkStr.split('\n').filter((l) => l.trim());
          for (const line of lines) {
            try {
              const json = JSON.parse(line);
              if (json.message?.content) {
                accumulatedText += json.message.content;
              } else if (json.response) {
                accumulatedText += json.response;
              }
            } catch (e) { }
          }
        }

        const parsed = parseTruncatedJson(accumulatedText);
        if (parsed) {
          rawModules = parsed.modules || parsed.study_modules || parsed.data || (Array.isArray(parsed) ? parsed : []);
          if (rawModules.length > 0) break;
        }
      }
    } catch (err: any) {
      connectionError = err.name === 'AbortError'
        ? 'Ollama request timed out after 90s'
        : (err.message || 'Connection failed');
    }
  }

  if (rawModules.length > 0) {
    return rawModules.map((mod: any, idx: number) => ({
      id: `mod-ollama-${Date.now()}-${idx}`,
      number: idx + 1,
      title: mod.title || `Module ${idx + 1}: ${mod.topic || params.subject}`,
      topic: mod.topic || `${params.subject} Topic ${idx + 1}`,
      lessonContent: mod.lessonContent || `Module ${idx + 1} study guide content for ${params.subject}.`,
      questions: (mod.questions || mod.quiz || []).map((q: any, qIdx: number) => ({
        id: `q-ollama-${Date.now()}-${idx}-${qIdx}`,
        type: q.type || q.question_type || 'multiple-choice',
        question: q.question || q.stem || q.text || `Question testing ${params.subject}`,
        options: q.options || q.choices || ['Option A', 'Option B', 'Option C', 'Option D'],
        correctAnswer: q.correctAnswer !== undefined ? q.correctAnswer : (q.answer !== undefined ? q.answer : 0),
        explanation: q.explanation || 'Correct based on module reading content.',
      })),
      status: 'unlocked',
      bestScore: null,
      attempts: 0,
    }));
  }

  console.warn(`Ollama reviewer generation failed (${connectionError || 'No response'}), using topic fallback engine.`);
  return buildTopicDrivenModules(params.subject, params.difficulty, targetCount, itemsCount);
}
