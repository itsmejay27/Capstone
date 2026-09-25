/**
 * Google Gemini AI Service Integration
 * Connects directly to Google Gemini REST API for fast cloud question generation.
 */

import { getDifficultyPromptDirective } from './generationUtils';
import { TOSData, buildTOSConstraintText, normaliseCogLevel, isAdministrativeMetadata } from './tosParser';
import { geminiEndpoint, isGeminiAvailable } from './geminiEndpoint';

export const DEFAULT_GEMINI_API_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) || '';

export const GEMINI_MODELS = [
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite · Ultra fast · Best for multiple choice & true/false (Recommended)' },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash · Fast · Best overall' },
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash · Balanced · Best for essay & hard questions' },
];

export function getStoredGeminiApiKey(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('gemini_api_key');
    if (saved && saved.trim()) return saved.trim();
  }
  return DEFAULT_GEMINI_API_KEY;
}

export { geminiEndpoint, isGeminiAvailable } from './geminiEndpoint';

/** Which hosted model service a generation request is routed to. */
export type AIProvider = 'gemini' | 'nvidia';

/** NVIDIA NIM is always reached through the server proxy, which holds NVIDIA_API_KEY. */
const NVIDIA_PROXY_URL = '/api/nvidia';

/**
 * Empty until the live catalogue is fetched.
 *
 * NVIDIA retires models on a schedule — the ids shipped here previously (llama-3.3-70b,
 * llama-3.1-8b) reached end of life on 2026-08-26 and every request came back 410 Gone.
 * A baked-in list is therefore a slow-motion outage, so the catalogue is read at runtime
 * and the dropdown is built from whatever is actually being served.
 */
export const DEFAULT_NVIDIA_MODEL = '';

export interface NvidiaModel {
  id: string;
  name: string;
  speed?: ModelSpeed;
  bestFor?: string;
  recommended?: boolean;
}

export type ModelSpeed = 'Ultra fast' | 'Fast' | 'Balanced' | 'Slow · deep thinking';

/**
 * Hand-picked NVIDIA models, best first. Matched by pattern so a new version of the same
 * family (e.g. -v3.1 → -v3.2) keeps its label. `rank` orders the dropdown.
 */
const CURATED: { re: RegExp; speed: ModelSpeed; bestFor: string; rank: number }[] = [
  { re: /\/deepseek-v4\.1-flash$/i, speed: 'Fast', bestFor: 'Best overall', rank: 1 },
  { re: /\/nemotron-3\.5-lightning-30b-a3b$/i, speed: 'Ultra fast', bestFor: 'Multiple choice & true/false', rank: 2 },
  { re: /\/glm-5-3-flash$/i, speed: 'Fast', bestFor: 'Best overall', rank: 3 },
  { re: /\/gpt-oss-120b$/i, speed: 'Balanced', bestFor: 'Essay & hard questions', rank: 4 },
  { re: /\/gpt-oss-20b$/i, speed: 'Ultra fast', bestFor: 'Multiple choice & true/false', rank: 5 },
  { re: /\/qwen3-next-80b-a3b-instruct$/i, speed: 'Ultra fast', bestFor: 'Short answer', rank: 6 },
  { re: /\/llama-4-maverick-17b-128e-instruct$/i, speed: 'Fast', bestFor: 'Short answer', rank: 7 },
  { re: /\/llama-3\.3-nemotron-super-49b-v1\.5$/i, speed: 'Balanced', bestFor: 'Best overall', rank: 8 },
  { re: /\/glm-5-3$/i, speed: 'Slow · deep thinking', bestFor: 'Essay & hard questions', rank: 9 },
  { re: /\/kimi-k3$/i, speed: 'Slow · deep thinking', bestFor: 'Essay & hard questions', rank: 10 },
];

/** "meta/llama-3.3-70b-instruct" → "Llama 3.3 70B Instruct". */
export function prettyModelName(id: string): string {
  return (id.split('/').pop() || id)
    .split(/[-_]/)
    .map((w) => (/^\d+(\.\d+)?[bm]$/i.test(w) ? w.toUpperCase() : /^[a-z]/.test(w) ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

/** Speed and "best for" label for any model id; curated first, then a size-based guess. */
export function modelProfile(id: string): { speed: ModelSpeed; bestFor: string; rank: number; recommended: boolean } {
  const hit = CURATED.find((c) => c.re.test(id));
  if (hit) return { speed: hit.speed, bestFor: hit.bestFor, rank: hit.rank, recommended: hit.rank <= 5 };
  const size = Number((id.match(/(\d+(?:\.\d+)?)b\b/i) || [])[1] || 0);
  const thinks = /(reason|thinking|\br1\b|-r1|qwq)/i.test(id);
  if (thinks) return { speed: 'Slow · deep thinking', bestFor: 'Essay & hard questions', rank: 40, recommended: false };
  if (size && size <= 12) return { speed: 'Ultra fast', bestFor: 'Multiple choice & true/false', rank: 30, recommended: false };
  if (size && size <= 40) return { speed: 'Fast', bestFor: 'Short answer', rank: 25, recommended: false };
  if (size && size > 200) return { speed: 'Slow · deep thinking', bestFor: 'Essay & hard questions', rank: 35, recommended: false };
  return { speed: 'Balanced', bestFor: 'Best overall', rank: 20, recommended: false };
}

/** A reranker scores relevance and an embedding model returns a vector: neither writes text. */
const NON_GENERATIVE_MODEL = /(^|[/_-])(rerank|embed|embedqa|reranking)([/_-]|$)/i;

/**
 * Models that do not help students or teachers write and explain questions: image/vision,
 * safety and guard classifiers, reward scorers, code-only models, speech/translation/OCR,
 * retrievers and parsers.
 */
const NOT_FOR_STUDY = /(vision|vila|neva|paligemma|kosmos|fuyu|deplot|llava|guard|safety|shield|nemoguard|reward|reranker|retriever|embed|code|coder|starcoder|codestral|granite-\d.*-code|riva|parakeet|asr|tts|translate|ocr|parse|detector|pii|cosmos|clip|sdxl|flux|stable-diffusion|audio|speech|whisper|canary)/i;
/** Chat/instruct or reasoning models — the ones that can write and explain exam questions. */
const STUDY_CAPABLE = /(instruct|chat|-it\b|[-_]it$|reason|thinking|\br1\b|-r1|qwq|deepseek|gpt-oss|kimi|glm|nemotron-(super|ultra|nano)|mixtral|mistral-(large|medium|small)|magistral|qwen3|phi-4)/i;
/** Reasoning models first: they think through a topic before writing questions. */
const REASONING = /(reason|thinking|\br1\b|-r1|qwq|gpt-oss|nemotron-(super|ultra)|kimi|qwen3|magistral|deepseek-v3)/i;

/**
 * Fetches the models NVIDIA is currently serving, newest-looking Llama first so the
 * default selection is a sensible instruct model rather than whatever sorts first.
 */
export async function fetchNvidiaModels(): Promise<NvidiaModel[]> {
  try {
    const response = await fetch(NVIDIA_PROXY_URL, { method: 'GET' });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.warn(`Could not list NVIDIA models (HTTP ${response.status}): ${detail.slice(0, 200)}`);
      return [];
    }
    const data = await response.json();
    const ids: string[] = (data?.data || [])
      .map((m: any) => String(m?.id || ''))
      .filter((id: string) => id && !NON_GENERATIVE_MODEL.test(id) && !NOT_FOR_STUDY.test(id) && STUDY_CAPABLE.test(id));

    // Only the hand-picked models are offered; the full catalogue is hundreds long.
    const curated = ids.filter((id) => CURATED.some((c) => c.re.test(id)));
    curated.sort((a, b) => modelProfile(a).rank - modelProfile(b).rank || a.localeCompare(b));

    return curated.map((id) => {
      const p = modelProfile(id);
      const recommended = curated[0] === id;
      return {
        id,
        name: `${prettyModelName(id)} · ${p.speed} · Best ${p.bestFor === 'Best overall' ? 'overall' : `for ${p.bestFor.toLowerCase()}`}${recommended ? ' (Recommended)' : ''}`,
        speed: p.speed, bestFor: p.bestFor, recommended,
      };
    });
  } catch (err) {
    console.warn('Could not list NVIDIA models:', err);
    return [];
  }
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
  tosData?: TOSData;
  onProgress?: (current: number, total: number, message: string) => void;
  /** Defaults to Gemini; 'nvidia' routes the same prompts to NVIDIA NIM via /api/nvidia. */
  provider?: AIProvider;
}

export interface GeminiReviewerParams {
  apiKey?: string;
  model?: string;
  subject: string;
  difficulty: 'easy' | 'normal' | 'hard';
  customInstructions?: string;
  uploadedText?: string;
}

/** A generation failure the user should see, with a plain-language reason. */
export class AIGenerationError extends Error {
  constructor(message: string) { super(message); this.name = 'AIGenerationError'; }
}

/** Turns an HTTP status / network failure into something a teacher can act on. */
function friendlyAIError(provider: AIProvider, status: number, detail: string): string {
  const who = provider === 'nvidia' ? 'NVIDIA' : 'Google Gemini';
  const d = detail.toLowerCase();
  if (status === 0) return 'No internet connection, or the AI server could not be reached. Check your connection and try again.';
  if (status === -1) return `${who} took too long to answer. Try again, or pick a faster model.`;
  if (status === 429) return `${who} is busy or your free quota is used up. Wait a minute, or pick another model.`;
  if (status === 401 || status === 403) return `${who} rejected the API key. Check the key in the Vercel project settings.`;
  if (status === 404 || status === 410 || d.includes('not found') || d.includes('end of life')) return `This model is no longer available on ${who}. Pick another model.`;
  if (status === 503 && d.includes('not configured')) return `The ${who} API key is not set up on the server.`;
  if (status >= 500) return `${who} is having problems right now (error ${status}). Try again in a moment or pick another model.`;
  if (status === -2) return `The model answered, but not in a usable format. Try again or pick another model.`;
  return `${who} returned an error (${status}). Try again or pick another model.`;
}

/** Pulls the JSON object/array out of a reply that may carry <think> blocks or prose. */
function extractJson(raw: string): any {
  let t = String(raw || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try { return JSON.parse(t); } catch { /* fall through */ }
  const start = t.search(/[[{]/);
  const end = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  if (start >= 0 && end > start) return JSON.parse(t.slice(start, end + 1));
  throw new Error('no json');
}

/**
 * Sends one batch to the chosen AI. Throws AIGenerationError when every model candidate
 * fails, so the generator stops and tells the user instead of quietly filling the exam
 * with placeholder questions.
 */
async function callGeminiApiForBatch(
  apiKey: string,
  modelsToTry: string[],
  systemPrompt: string,
  promptText: string,
  timeoutMs: number = 40000,
  provider: AIProvider = 'gemini'
): Promise<any[]> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new AIGenerationError(friendlyAIError(provider, 0, ''));
  }
  if (provider === 'gemini' && !apiKey && !isGeminiAvailable(apiKey)) {
    throw new AIGenerationError('Google Gemini is not set up on the server (missing API key).');
  }
  // Reasoning models think before answering and need longer.
  const wait = provider === 'nvidia' ? Math.max(timeoutMs, 110000) : timeoutMs;
  let lastError = '';
  for (const modelCandidate of modelsToTry) {
    // NVIDIA: some models reject response_format, so retry once without it.
    for (const strictJson of provider === 'nvidia' ? [true, false] : [true]) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), wait);
      try {
        const response = await fetch(
          provider === 'nvidia' ? NVIDIA_PROXY_URL : geminiEndpoint(modelCandidate, apiKey),
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify(
              provider === 'nvidia'
                ? {
                    model: modelCandidate,
                    messages: [
                      { role: 'system', content: systemPrompt },
                      { role: 'user', content: promptText },
                    ],
                    temperature: 0.25,
                    max_tokens: 8192,
                    ...(strictJson ? { response_format: { type: 'json_object' } } : {}),
                  }
                : {
                    system_instruction: { parts: [{ text: systemPrompt }] },
                    contents: [{ role: 'user', parts: [{ text: promptText }] }],
                    generationConfig: { responseMimeType: 'application/json', temperature: 0.25, maxOutputTokens: 8192 },
                  }
            ),
          }
        );
        clearTimeout(timeoutId);

        if (!response.ok) {
          const detail = await response.text().catch(() => '');
          console.warn(`${provider} batch HTTP ${response.status}: ${detail.slice(0, 300)}`);
          lastError = friendlyAIError(provider, response.status, detail);
          if (response.status === 400 && strictJson && provider === 'nvidia') continue;
          break;
        }
        const resData = await response.json();
        const msg = resData.choices?.[0]?.message || {};
        const rawText =
          provider === 'nvidia'
            ? msg.content || msg.reasoning_content || ''
            : resData.candidates?.[0]?.content?.parts?.[0]?.text || '';
        try {
          const parsed = extractJson(rawText);
          const list = Array.isArray(parsed) ? parsed : (parsed.questions || parsed.items || []);
          if (list.length > 0) return list;
        } catch { /* unusable reply */ }
        lastError = friendlyAIError(provider, -2, '');
        if (strictJson && provider === 'nvidia') continue;
        break;
      } catch (err: any) {
        clearTimeout(timeoutId);
        lastError = friendlyAIError(provider, err?.name === 'AbortError' ? -1 : 0, '');
        break;
      }
    }
  }
  throw new AIGenerationError(lastError || 'The AI could not generate questions. Try again or pick another model.');
}

let geminiIdCounter = 1;


/**
 * How many generation batches may be in flight at once.
 *
 * Batches were previously awaited one after another, so a 60-item TOS exam made eight
 * round trips end to end — roughly 6s each, 45-60s of wall time for work that has no
 * ordering dependency between batches. Four at a time keeps the total near the slowest
 * single batch while staying well inside provider rate limits; higher values start
 * drawing 429s from Gemini's free tier.
 */
const BATCH_CONCURRENCY = 4;

/**
 * Runs `worker` over `items` with at most `limit` in flight, returning results in the
 * ORIGINAL order regardless of completion order — question numbering depends on it.
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      try {
        results[index] = await worker(items[index], index);
      } catch (err) {
        cursor = items.length; // stop the other runners: one failure fails the whole run
        throw err;
      }
    }
  });
  await Promise.all(runners);
  return results;
}

function mapRawToExamItem(q: any, spec: any, defaultTopic: string, fallbackIdx: number): any {
  let qType = (spec?.questionType || q?.type || q?.t || 'multiple-choice').toLowerCase();
  if (!['multiple-choice', 'true-false', 'short-answer', 'essay'].includes(qType)) {
    qType = 'multiple-choice';
  }

  let topicName = spec?.topic || q?.topic || defaultTopic;
  if (isAdministrativeMetadata(topicName)) {
    topicName = defaultTopic;
  }

  // The TOS blueprint is authoritative, NOT the model's self-declared metadata. Previously
  // this read `normaliseCogLevel(q.cognitiveLevel) || spec.cognitiveLevel`, letting the model
  // relabel an item the blueprint required at "Applying / Analyzing" as "Remembering" — so the
  // mandated 20/50/30 distribution silently drifted while the exam still looked complete.
  // The model's claim is retained separately so the compliance report can show the drift.
  const aiClaimedCognitiveLevel = normaliseCogLevel(q?.cognitiveLevel || q?.bloomLevel || q?.level) || undefined;
  const cogLevel = spec?.cognitiveLevel || aiClaimedCognitiveLevel || 'Understanding';
  const defaultPoints = spec?.points || (qType === 'multiple-choice' ? 2 : qType === 'true-false' ? 1 : qType === 'short-answer' ? 3 : 5);
  const placementNum = spec?.itemNumber || q?.itemPlacement || (fallbackIdx + 1);

  let questionStem = q?.question || q?.stem || q?.q || `Question regarding ${topicName}`;
  if (
    isAdministrativeMetadata(questionStem) ||
    questionStem.toLowerCase().includes('effectivity date') ||
    questionStem.toLowerCase().includes('table of specification of') ||
    questionStem.toLowerCase().includes('reference document for the table')
  ) {
    questionStem = `In ${topicName}, which of the following best describes its core purpose and functional mechanism?`;
  }

  const item: any = {
    id: `gq-gemini-${Date.now()}-${geminiIdCounter++}`,
    type: qType,
    question: questionStem,
    // Points come from the blueprint when it specifies them; the model's figure is only a
    // fallback for the no-TOS path. Letting the model win here shifted the exam's total away
    // from the TOS's mandated points.
    points: spec?.points || Number(q?.points) || defaultPoints,
    difficulty: q?.difficulty || (['Remembering', 'Understanding'].includes(cogLevel) ? 'easy' : ['Evaluating', 'Creating'].includes(cogLevel) ? 'hard' : 'medium'),
    topic: topicName,
    cognitiveLevel: cogLevel,
    itemPlacement: placementNum,
    image: '',
    isExtra: Boolean(spec?.isExtra || q?.isExtra),
    // What the model claimed, kept for the TOS compliance report so drift is visible rather
    // than silently overwritten.
    aiClaimedCognitiveLevel,
    aiClaimedTopic: q?.topic || undefined,
    aiClaimedPlacement: Number(q?.itemPlacement) || undefined,
  };

  if (qType === 'multiple-choice') {
    item.options = Array.isArray(q?.options) && q.options.length >= 2
      ? q.options.slice(0, 4)
      : ['Option A', 'Option B', 'Option C', 'Option D'];
    let corr = Number(q?.correctAnswer);
    if (isNaN(corr) || corr < 0 || corr >= item.options.length) corr = 0;
    item.correctAnswer = corr;
    item.optionsImages = ['', '', '', ''];
  } else if (qType === 'true-false') {
    const str = String(q?.correctAnswer !== undefined ? q.correctAnswer : 'true').toLowerCase();
    item.correctAnswer = str.includes('false') || str === 'f' ? 'false' : 'true';
    item.options = ['True', 'False'];
  } else if (qType === 'short-answer') {
    let ansText = String(q?.correctAnswer !== undefined ? q.correctAnswer : '').trim();
    if (!ansText || ansText === '0' || ansText === '1' || ansText === '2' || ansText === '3') {
      const idxOpt = Number(ansText);
      if (Array.isArray(q?.options) && q.options.length > 0 && !isNaN(idxOpt) && q.options[idxOpt]) {
        ansText = q.options[idxOpt];
      } else {
        ansText = `Key principles regarding ${topicName}`;
      }
    }
    item.correctAnswer = ansText;
    item.options = [];
  } else {
    // essay
    let ansText = String(q?.correctAnswer !== undefined ? q.correctAnswer : '').trim();
    if (!ansText || ansText === '0' || ansText === '1' || ansText === '2' || ansText === '3') {
      ansText = `Expected analytical response evaluating core principles, causal factors, and real-world implications of ${topicName}.`;
    }
    item.correctAnswer = ansText;
    item.options = [];
  }

  return item;
}

/**
 * Sends structured request to Google Gemini API with seamless batching and topic-driven generation fallback.
 * Strictly respects Table of Specifications (TOS) item placement, topics per item, and Bloom cognitive levels.
 */
export async function generateExamWithGemini(params: GeminiExamParams): Promise<any[]> {
  const apiKey = (params.apiKey || getStoredGeminiApiKey()).trim();
  const provider: AIProvider = params.provider || 'gemini';
  const requestedModel = params.model || (provider === 'nvidia' ? DEFAULT_NVIDIA_MODEL : 'gemini-3.6-flash');
  const modelsToTry = provider === 'nvidia'
    // Only the selected model: the dropdown is populated from the live catalogue, so a
    // hard-coded fallback would just retry ids NVIDIA may already have retired.
    ? [requestedModel].filter(Boolean)
    : Array.from(new Set([requestedModel, 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.5-flash']));

  const primaryTopic = params.generationPrompt?.trim()
    || (params.tosData?.courseTitle)
    || (params.tosData?.topics && params.tosData.topics.find((t) => !isAdministrativeMetadata(t)))
    || (params.topics && params.topics.find((t) => t && t !== 'General Subject Matter' && !isAdministrativeMetadata(t)))
    || (params.tosData?.itemSpecs?.[0]?.topic && !isAdministrativeMetadata(params.tosData.itemSpecs[0].topic) ? params.tosData.itemSpecs[0].topic : '')
    || 'General Subject';

  // 1. TOS BLUEPRINT MODE: Generate questions matching every TOS item spec in manageable batches
  let specsToGenerate: any[] = [];
  if (params.tosData?.itemSpecs && params.tosData.itemSpecs.length > 0) {
    specsToGenerate = params.tosData.itemSpecs;
  } else if (params.tosData && params.tosData.totalItems > 0) {
    // Synthesize specs if itemSpecs was not populated
    const numItems = params.tosData.totalItems;
    const topics = (params.tosData.topics && params.tosData.topics.length > 0)
      ? params.tosData.topics.filter((t) => !isAdministrativeMetadata(t))
      : [primaryTopic];

    specsToGenerate = Array.from({ length: numItems }, (_, i) => ({
      itemNumber: i + 1,
      topic: topics[i % topics.length],
      cognitiveLevel: i < numItems * 0.3 ? 'Remembering' : i < numItems * 0.6 ? 'Understanding' : i < numItems * 0.85 ? 'Applying' : 'Analyzing',
      points: 1,
      questionType: 'multiple-choice',
    }));
  }

  if (specsToGenerate.length > 0) {
    const totalQuestions = specsToGenerate.length;
    const finalQuestions: any[] = [];
    const BATCH_SIZE = 8; // Optimal batch size: fast execution (~5-7s), avoids 8192 token truncation and HTTP ECONNRESET

    // Slice the specs into batches up front so they can be dispatched concurrently.
    const specChunks: any[][] = [];
    for (let i = 0; i < specsToGenerate.length; i += BATCH_SIZE) {
      specChunks.push(specsToGenerate.slice(i, i + BATCH_SIZE));
    }

    let completedBatches = 0;
    params.onProgress?.(0, totalQuestions, `Generating ${totalQuestions} items in ${specChunks.length} batches...`);

    const chunkResults = await mapWithConcurrency(specChunks, BATCH_CONCURRENCY, async (chunkSpecs, chunkIndex) => {
      const batchQuestions: any[] = [];
      const baseIndex = chunkIndex * BATCH_SIZE;
      const startNum = chunkSpecs[0].itemNumber;
      const endNum = chunkSpecs[chunkSpecs.length - 1].itemNumber;

      const systemPrompt = `You are an expert academic test generator. You must parse the provided TOS document and map your output strictly to its parameters. Do not deviate from the item count, topic distribution, or cognitive levels.

Target Academic Subject / Course: "${primaryTopic}".
TOS blueprint source: ${params.tosData?.fileName || 'uploaded Table of Specifications'}${params.tosData?.totalItems ? ` (${params.tosData.totalItems} items in total)` : ''}.

CRITICAL DIRECTIVE: You are generating Items #${startNum} through #${endNum}. You must return EXACTLY ${chunkSpecs.length} question objects — no more, no fewer.
Every item MUST test its specific academic topic and cognitive level:
${chunkSpecs.map((s) => `Item #${s.itemNumber} | Placement: ${s.itemNumber} | Topic: "${s.topic}" | Cognitive Level: "${s.cognitiveLevel}" | Points: ${s.points || 1} | Type: ${s.questionType || 'multiple-choice'}`).join('\n')}

BLUEPRINT COMPLIANCE RULES (these are validated after generation; violations are regenerated):
1. Return the questions in item-placement order, and set "itemPlacement" on each one to the exact item number it fulfils.
2. Echo the assigned Topic and Cognitive Level verbatim on each question. Do NOT substitute your own judgement about which cognitive level a question belongs to — the blueprint decides, and mislabelled items are rejected.
3. Write to the assigned cognitive level. "Remembering / Understanding" = recall and explain. "Applying / Analyzing" = use the concept in a scenario, compare, or debug. "Synthesizing / Evaluating" = design, justify a trade-off, or critique a decision.
4. Every question stem must be UNIQUE. Never repeat or lightly reword a stem you have already produced in this exam.

ANTI-HALLUCINATION GUARDRAILS:
1. NEVER generate questions about document administrative metadata (such as "Effectivity Date", "Revision No", "Form No", "Prepared by", "Approved by", "March 01, 2024", or university headers).
2. Questions MUST test substantive curriculum concepts and academic domain knowledge of ${primaryTopic}.
3. Every multiple-choice question must have 4 distinct, plausible options and the correct answer index (0-3). Distractors must be plausible to a student who holds a specific misconception — never filler.`;

      const promptText = `Generate the exact ${chunkSpecs.length} questions for Items #${startNum} through #${endNum} strictly matching their specified Topic and Cognitive Level.
${params.uploadedText ? `Attached Syllabus / Curriculum Reference:\n${params.uploadedText.slice(0, 3000)}\n` : ''}

Respond ONLY with raw valid JSON:
{
  "questions": [
    {
      "itemPlacement": ${startNum},
      "type": "${chunkSpecs[0].questionType || 'multiple-choice'}",
      "cognitiveLevel": "${chunkSpecs[0].cognitiveLevel}",
      "topic": "${chunkSpecs[0].topic}",
      "question": "Clear, rigorous question stem testing ${chunkSpecs[0].topic}...",
      "options": ["Plausible Choice A", "Plausible Choice B", "Plausible Choice C", "Plausible Choice D"],
      "correctAnswer": 0,
      "points": ${chunkSpecs[0].points || 1}
    }
  ]
}
Ensure the "questions" array contains ALL ${chunkSpecs.length} items for this batch.`;

      const rawBatch = await callGeminiApiForBatch(apiKey, modelsToTry, systemPrompt, promptText, 40000, provider);

      if (rawBatch && rawBatch.length > 0) {
        // Pair each spec with its OWN returned question. The previous
        // `rawBatch[cIdx] || rawBatch[cIdx % rawBatch.length]` wrapped around whenever the
        // model returned fewer items than requested, emitting verbatim duplicate stems each
        // relabelled with a different spec's topic and cognitive level — an exam that looks
        // complete by count while repeating questions that do not match their stated topic.
        // A short batch now falls back to the spec-driven generator for the UNFILLED specs
        // only, and the TOS validator re-checks the result afterwards.
        for (let cIdx = 0; cIdx < chunkSpecs.length; cIdx++) {
          const spec = chunkSpecs[cIdx];
          const rawQ = rawBatch[cIdx];
          if (rawQ) {
            batchQuestions.push(mapRawToExamItem(rawQ, spec, primaryTopic, baseIndex + cIdx));
          } else {
            const [filled] = buildTopicDrivenQuestionsForSpecs([spec], primaryTopic, params.difficulty);
            if (filled) batchQuestions.push({ ...filled, needsAuthoring: true });
          }
        }
        if (rawBatch.length < chunkSpecs.length) {
          console.warn(
            `Gemini returned ${rawBatch.length}/${chunkSpecs.length} questions for items ${startNum}-${endNum}; ` +
            `${chunkSpecs.length - rawBatch.length} item(s) filled from the spec generator and flagged for authoring.`
          );
        }
      } else {
        // Fallback specifically for this chunk using dynamic spec generator
        console.warn(`Gemini batch for items ${startNum}-${endNum} failed or timed out, generating via dynamic spec generator.`);
        const fallbackChunk = buildTopicDrivenQuestionsForSpecs(chunkSpecs, primaryTopic, params.difficulty);
        batchQuestions.push(...fallbackChunk.map((q: any) => ({ ...q, needsAuthoring: true })));
      }

      // Batches finish out of order, so progress counts completed batches rather than
      // pretending to know which item number is currently in flight.
      completedBatches++;
      params.onProgress?.(
        Math.min(completedBatches * BATCH_SIZE, totalQuestions),
        totalQuestions,
        `Generated ${completedBatches} of ${specChunks.length} batches...`
      );
      return batchQuestions;
    });

    for (const batch of chunkResults) finalQuestions.push(...batch);

    params.onProgress?.(finalQuestions.length, totalQuestions, 'Question generation complete!');
    return finalQuestions;
  }

  // 2. MANUAL QUANTITY MODE (Without TOS)
  const targetTypes: { type: string; isExtra: boolean; defaultPoints: number }[] = [];
  for (let i = 0; i < params.mcCount; i++) targetTypes.push({ type: 'multiple-choice', isExtra: false, defaultPoints: 2 });
  for (let i = 0; i < params.tfCount; i++) targetTypes.push({ type: 'true-false', isExtra: false, defaultPoints: 1 });
  for (let i = 0; i < params.saCount; i++) targetTypes.push({ type: 'short-answer', isExtra: false, defaultPoints: 3 });
  for (let i = 0; i < params.essayCount; i++) targetTypes.push({ type: 'essay', isExtra: false, defaultPoints: 5 });
  for (let i = 0; i < params.extraCount; i++) targetTypes.push({ type: 'multiple-choice', isExtra: true, defaultPoints: 2 });

  const totalQuestions = targetTypes.length;
  if (totalQuestions === 0) {
    throw new Error('Please select at least 1 question type or attach a Table of Specifications to generate.');
  }

  const BATCH_SIZE = 8;
  const finalQuestions: any[] = [];
  const diffDirective = getDifficultyPromptDirective(params.difficulty);

  // Same treatment as the TOS path: batches are independent, so they go out concurrently.
  const typeChunks: typeof targetTypes[] = [];
  for (let i = 0; i < targetTypes.length; i += BATCH_SIZE) {
    typeChunks.push(targetTypes.slice(i, i + BATCH_SIZE));
  }

  let completedManualBatches = 0;
  params.onProgress?.(0, totalQuestions, `Generating ${totalQuestions} questions in ${typeChunks.length} batches...`);

  const manualResults = await mapWithConcurrency(typeChunks, BATCH_CONCURRENCY, async (chunkTypes, chunkIndex) => {
    const batchQuestions: any[] = [];
    const i = chunkIndex * BATCH_SIZE;
    const startNum = i + 1;
    const endNum = i + chunkTypes.length;

    const systemPrompt = `You are an expert university professor and examination author creating an exam on: "${primaryTopic}".
Difficulty Target: ${diffDirective.levelLabel}
${diffDirective.instructions}
${diffDirective.stemLengthRule}
Generate high quality questions in valid JSON format only.`;

    const promptText = `Generate ${chunkTypes.length} questions (Items #${startNum} to #${endNum}) on "${primaryTopic}":
Requested types in this batch:
${chunkTypes.map((t, idx) => `Item #${startNum + idx}: type "${t.type}"`).join('\n')}

Respond ONLY with raw valid JSON:
{
  "questions": [
    {
      "itemPlacement": ${startNum},
      "type": "${chunkTypes[0].type}",
      "cognitiveLevel": "Understanding",
      "topic": "${primaryTopic}",
      "question": "Question text...",
      "options": ["Choice A", "Choice B", "Choice C", "Choice D"],
      "correctAnswer": 0,
      "points": ${chunkTypes[0].defaultPoints}
    }
  ]
}`;

    const rawBatch = await callGeminiApiForBatch(apiKey, modelsToTry, systemPrompt, promptText, 35000, provider);

    if (rawBatch && rawBatch.length > 0) {
      for (let cIdx = 0; cIdx < chunkTypes.length; cIdx++) {
        const t = chunkTypes[cIdx];
        const rawQ = rawBatch[cIdx] || rawBatch[cIdx % rawBatch.length];
        const spec = { questionType: t.type, points: t.defaultPoints, isExtra: t.isExtra, itemNumber: startNum + cIdx, topic: primaryTopic };
        batchQuestions.push(mapRawToExamItem(rawQ, spec, primaryTopic, i + cIdx));
      }
    } else {
      const fallbackChunk = buildTopicDrivenQuestions({
        ...params,
        mcCount: chunkTypes.filter((t) => t.type === 'multiple-choice' && !t.isExtra).length,
        tfCount: chunkTypes.filter((t) => t.type === 'true-false').length,
        saCount: chunkTypes.filter((t) => t.type === 'short-answer').length,
        essayCount: chunkTypes.filter((t) => t.type === 'essay').length,
        extraCount: chunkTypes.filter((t) => t.isExtra).length,
      });
      batchQuestions.push(...fallbackChunk);
    }

    completedManualBatches++;
    params.onProgress?.(
      Math.min(completedManualBatches * BATCH_SIZE, totalQuestions),
      totalQuestions,
      `Generated ${completedManualBatches} of ${typeChunks.length} batches...`
    );
    return batchQuestions;
  });

  for (const batch of manualResults) finalQuestions.push(...batch);

  params.onProgress?.(finalQuestions.length, totalQuestions, 'Question generation complete!');
  return finalQuestions;
}

/**
 * Regenerate questions for a specific subset of TOS item specs.
 *
 * Used by the TOS compliance loop to repair ONLY the items that failed validation, instead
 * of discarding an entire exam because a handful of items drifted. It reuses the blueprint
 * path of generateExamWithGemini by handing it a blueprint narrowed to just those specs.
 */
export async function regenerateItemsForSpecs(
  specs: any[],
  params: GeminiExamParams
): Promise<any[]> {
  if (!specs || specs.length === 0) return [];
  return generateExamWithGemini({
    ...params,
    tosData: {
      ...(params.tosData as any),
      itemSpecs: specs,
      totalItems: specs.length,
    } as any,
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
  const url = geminiEndpoint(model, key);

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

  // The student's actual material (class handout, module or upload). Without it the model
  // could only write generic text about the topic name.
  const sourceBlock = params.uploadedText?.trim()
    ? `
Base every lesson and question ONLY on this source material (ignore headers, page numbers and form metadata):
---
${params.uploadedText.trim().slice(0, 24000)}
---
`
    : '';

  const promptText = `Generate a complete study reviewer strictly for: "${topicPrompt}".${sourceBlock}
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
      const url = geminiEndpoint(modelCandidate, key);
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
 * DYNAMIC SPEC-DRIVEN QUESTION GENERATOR FOR TOS BLUEPRINTS
 * Generates completely distinct, authentic questions for every individual TOS item spec.
 * Uses diverse question stems, rotated answer keys, and authentic distractors based on cognitive level.
 */
export function buildTopicDrivenQuestionsForSpecs(
  specs: any[],
  defaultTopic: string = 'General Subject',
  difficulty: string = 'medium'
): any[] {
  let idCounter = 1;
  return specs.map((spec, idx) => {
    const qTopic = (spec.topic && !isAdministrativeMetadata(spec.topic)) ? spec.topic : defaultTopic;
    const qType = spec.questionType || 'multiple-choice';
    const pts = Number(spec.points) || 1;
    const rawCog = (spec.cognitiveLevel || 'Applying').trim();
    const cogLower = rawCog.toLowerCase();

    // Determine Bloom category
    let category: 'remembering' | 'understanding' | 'applying' | 'analyzing' | 'evaluating' | 'creating' = 'applying';
    if (cogLower.includes('rem') || cogLower.includes('knowledg') || cogLower.includes('recall')) {
      category = 'remembering';
    } else if (cogLower.includes('und') || cogLower.includes('comprehen')) {
      category = 'understanding';
    } else if (cogLower.includes('appl')) {
      category = 'applying';
    } else if (cogLower.includes('analy')) {
      category = 'analyzing';
    } else if (cogLower.includes('eval')) {
      category = 'evaluating';
    } else if (cogLower.includes('creat') || cogLower.includes('synth')) {
      category = 'creating';
    }

    // Diverse, non-repetitive question templates by Bloom category
    const templates: Record<string, { stem: string; correct: string; distractors: string[] }[]> = {
      remembering: [
        {
          stem: `Which of the following defines the foundational concept of ${qTopic}?`,
          correct: `The standard architectural principle and core theoretical definition governing ${qTopic}`,
          distractors: [
            `A secondary, optional parameter not defined in ${qTopic}`,
            `An arbitrary ad-hoc runtime flag with no formal specification`,
            `A deprecated heuristic excluded from standard modern frameworks`,
          ],
        },
        {
          stem: `In the study of ${qTopic}, what does the primary terminology officially designate?`,
          correct: `The designated terminology specifying the operational baseline of ${qTopic}`,
          distractors: [
            `An isolated unverified variable in legacy scripts`,
            `A non-standard syntax variation omitted from formal documentation`,
            `A volatile temporary cache without persistent semantics`,
          ],
        },
        {
          stem: `Which property is recognized as a fundamental characteristic of ${qTopic}?`,
          correct: `Deterministic consistency and compliance with standard ${qTopic} specifications`,
          distractors: [
            `Unpredictable state mutation across subsystem boundaries`,
            `Complete absence of parameter validation and type verification`,
            `Mandatory continuous bypass of isolation barriers`,
          ],
        },
        {
          stem: `What is the canonical data model or unit of analysis associated with ${qTopic}?`,
          correct: `The formal structured schema and authoritative interface model of ${qTopic}`,
          distractors: [
            `An unconstrained global registry without scope limits`,
            `An undocumented prototype function subject to sudden deprecation`,
            `A third-party binary driver without contract verification`,
          ],
        },
      ],
      understanding: [
        {
          stem: `Which statement best explains the fundamental purpose and functional mechanism of ${qTopic}?`,
          correct: `It establishes coordinated structural rules that govern reliable execution in ${qTopic}`,
          distractors: [
            `It bypasses underlying system rules to avoid validation overhead`,
            `It forces non-deterministic behavior across concurrent threads`,
            `It completely removes structural abstractions from client code`,
          ],
        },
        {
          stem: `How does ${qTopic} primarily contribute to overall system reliability and maintainability?`,
          correct: `By enforcing modular separation of concerns and predictable behavior in ${qTopic}`,
          distractors: [
            `By tightly coupling unrelated modules into a single monolithic script`,
            `By eliminating error-handling blocks to minimize byte size`,
            `By executing arbitrary uncontrolled side-effects during startup`,
          ],
        },
        {
          stem: `What distinguishes the operation of ${qTopic} from conventional legacy approaches?`,
          correct: `Structured abstraction, improved error isolation, and systematic integration in ${qTopic}`,
          distractors: [
            `Reliance on untyped implicit global variables`,
            `Disregard for boundary conditions and race conditions`,
            `Inability to handle asynchronous state transitions`,
          ],
        },
        {
          stem: `Why is the adoption of ${qTopic} recommended in modern engineering workflows?`,
          correct: `It ensures consistency, verifiable constraints, and repeatable results across environments`,
          distractors: [
            `It prevents developer collaboration through proprietary obfuscation`,
            `It eliminates the need for automated testing and documentation`,
            `It randomly overrides user inputs without validation logging`,
          ],
        },
      ],
      applying: [
        {
          stem: `In a practical scenario involving ${qTopic}, which implementation procedure correctly executes the requirements?`,
          correct: `Configuring validated parameters and adhering to established workflow patterns of ${qTopic}`,
          distractors: [
            `Directly modifying internal private states without interface methods`,
            `Disabling input sanitization and execution guards completely`,
            `Hardcoding brittle external dependencies into core execution logic`,
          ],
        },
        {
          stem: `When configuring an environment to support ${qTopic}, what is the critical initial configuration step?`,
          correct: `Verifying prerequisites, setting strict boundary contracts, and initializing the ${qTopic} runtime`,
          distractors: [
            `Suppressing all log outputs to eliminate storage overhead`,
            `Executing commands with unrestricted administrative privileges unconditionally`,
            `Bypassing schema migrations and connection health checks`,
          ],
        },
        {
          stem: `Given a concrete problem involving ${qTopic}, how should unexpected runtime exceptions be handled?`,
          correct: `Gracefully intercepting errors with structured logging and executing failover mechanisms`,
          distractors: [
            `Silently catching and swallowing exceptions without recovery logic`,
            `Terminating the operating system process immediately without cleanup`,
            `Retrying infinitely in a tight blocking synchronous loop`,
          ],
        },
        {
          stem: `Which practical technique represents an optimal usage pattern when scaling ${qTopic}?`,
          correct: `Utilizing pooled resources, lazy initialization, and decoupled message boundaries in ${qTopic}`,
          distractors: [
            `Spawning unbounded concurrent threads without queue limits`,
            `Opening redundant persistent connections for every single query`,
            `Loading all remote datasets into unpaged memory buffers`,
          ],
        },
      ],
      analyzing: [
        {
          stem: `When diagnosing performance bottlenecks or concurrency anomalies in ${qTopic}, which factor requires primary investigation?`,
          correct: `Resource contention, state locking overhead, and communication latency within ${qTopic}`,
          distractors: [
            `Visual appearance of developer terminal syntax highlighting`,
            `Number of blank lines in project markdown documentation`,
            `Speed of static compiler comment removal routines`,
          ],
        },
        {
          stem: `An operational audit of ${qTopic} reveals elevated failure rates under load. What diagnostic deduction is most accurate?`,
          correct: `Unsynchronized shared mutations across concurrent execution paths are violating ${qTopic} invariants`,
          distractors: [
            `The software requires manual daily server reboots to clear static strings`,
            `Client browsers require mandatory hardware graphics upgrades`,
            `Compilers automatically generate faulty bytecode when comments are absent`,
          ],
        },
        {
          stem: `How do the structural trade-offs of ${qTopic} manifest when balancing execution speed against safety?`,
          correct: `Strict consistency checks add marginal latency while preventing irreversible data corruption`,
          distractors: [
            `Speed is always enhanced when validation layers are duplicated tenfold`,
            `Safety guarantees eliminate all requirements for physical network connectivity`,
            `Latency is exclusively determined by hard drive spindle speed regardless of architecture`,
          ],
        },
        {
          stem: `Which metric provides the most actionable analytical insight when monitoring ${qTopic} in production?`,
          correct: `Throughput percentiles, error rate variance, and resource utilization efficiency in ${qTopic}`,
          distractors: [
            `Total count of keystrokes registered in developer IDE logs`,
            `Alphabetical ordering of variable names in source files`,
            `File modification timestamps on read-only system libraries`,
          ],
        },
      ],
      evaluating: [
        {
          stem: `Which criterion provides the most rigorous justification when determining the optimality of a solution in ${qTopic}?`,
          correct: `Empirical benchmarks verifying systemic consistency, fault tolerance, and compliance with standards in ${qTopic}`,
          distractors: [
            `Subjective personal aesthetic preference of the author`,
            `Popularity trends on unverified social discussion boards`,
            `Adoption of experimental features despite known security flaws`,
          ],
        },
        {
          stem: `When evaluating two competing methodologies for ${qTopic}, what architectural principle decisively favors the superior choice?`,
          correct: `Superior resilience under edge-case stress, lower cognitive load, and automated testability`,
          distractors: [
            `Maximum lines of code written in the most obscure language syntax`,
            `Strict refusal to provide backwards compatibility without rationale`,
            `Complete reliance on proprietary locked-in hardware appliances`,
          ],
        },
        {
          stem: `Under what conditions should an existing implementation of ${qTopic} be refactored or replaced?`,
          correct: `When empirical technical debt impedes security updates or non-linear scaling bounds are breached`,
          distractors: [
            `Whenever a new minor cosmetic framework version is released`,
            `To alter naming conventions without functional improvement`,
            `Because standard libraries are considered too well-tested`,
          ],
        },
      ],
      creating: [
        {
          stem: `When designing and synthesizing a novel architectural solution incorporating ${qTopic}, which design strategy is most effective?`,
          correct: `Formulating a cohesive, modular architecture that synergizes core principles and abstractions of ${qTopic}`,
          distractors: [
            `Duplicating monolithic components without interface abstraction`,
            `Eliminating cohesive interface boundaries and coupling subsystems arbitrarily`,
            `Hardcoding state across disconnected global scopes`,
          ],
        },
        {
          stem: `How should a comprehensive framework integrating ${qTopic} with modern distributed subsystems be designed?`,
          correct: `Designing resilient interface contracts, observable telemetry pipelines, and declarative configuration for ${qTopic}`,
          distractors: [
            `Constructing interdependent circular dependencies across all project packages`,
            `Replacing formal schemas with unstructured arbitrary string concatenations`,
            `Disabling all regression tests to accelerate release cycles`,
          ],
        },
      ],
    };

    const pool = templates[category] || templates.applying;
    const chosen = pool[idx % pool.length];

    // Formulate 4 distinct options with rotated correct answer position
    const corrIdx = (idx * 3 + 1) % 4; // Cycles: 1, 0, 3, 2, 1...
    const allOptions = [...chosen.distractors];
    allOptions.splice(corrIdx, 0, chosen.correct);

    let corrAnswerValue: any = corrIdx;
    if (qType === 'true-false') {
      corrAnswerValue = idx % 2 === 0 ? 'true' : 'false';
    } else if (qType === 'short-answer') {
      corrAnswerValue = chosen.correct;
    } else if (qType === 'essay') {
      corrAnswerValue = `Rubric / Expected analytical response: Comprehensive discussion of ${chosen.correct} within ${qTopic}.`;
    }

    return {
      id: `gq-tos-${Date.now()}-${idCounter++}`,
      type: qType,
      question: chosen.stem,
      options: qType === 'multiple-choice' ? allOptions : (qType === 'true-false' ? ['True', 'False'] : []),
      correctAnswer: corrAnswerValue,
      points: pts,
      difficulty: ['remembering', 'understanding'].includes(category) ? 'easy' : (['evaluating', 'creating'].includes(category) ? 'hard' : 'medium'),
      topic: qTopic,
      cognitiveLevel: rawCog || 'Applying',
      itemPlacement: spec.itemNumber || (idx + 1),
      image: '',
      isExtra: false,
    };
  });
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

  // IF TOS DATA IS PRESENT: Generate items strictly matching the TOS item placement, cognitive levels, and topics
  if (params.tosData && params.tosData.itemSpecs && params.tosData.itemSpecs.length > 0) {
    return buildTopicDrivenQuestionsForSpecs(params.tosData.itemSpecs, topicName, params.difficulty);
  }

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




/**
 * General-purpose JSON generation for the study tools (flashcards, summaries, concept maps,
 * adaptive practice). Tries the Gemini models in order and returns the parsed object, or
 * throws with a readable message when every model fails.
 */
export async function generateStudyJson(systemPrompt: string, promptText: string, opts: { model?: string; maxTokens?: number } = {}): Promise<any> {
  const key = getStoredGeminiApiKey().trim();
  const modelsToTry = Array.from(new Set([opts.model || 'gemini-3.5-flash-lite', 'gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.6-flash']));
  let lastError = '';
  for (const model of modelsToTry) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 60000);
      const res = await fetch(geminiEndpoint(model, key), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: promptText }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.3, maxOutputTokens: opts.maxTokens || 6144 },
        }),
      });
      clearTimeout(t);
      if (!res.ok) { lastError = `HTTP ${res.status}`; continue; }
      const data = await res.json();
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return JSON.parse(raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim());
    } catch (e: any) {
      lastError = e?.name === 'AbortError' ? 'timed out' : (e?.message || String(e));
    }
  }
  throw new Error(`The AI could not generate this right now (${lastError || 'no response'}). Try again in a moment.`);
}
