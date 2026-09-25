/**
 * Server-side proxy for NVIDIA NIM.
 *
 *   GET  /api/nvidia  -> the live model catalogue (OpenAI-style /v1/models)
 *   POST /api/nvidia  -> a chat completion
 *
 * NVIDIA's catalogue is OpenAI-compatible, so the browser sends a standard
 * chat-completions body and this function attaches the API key. As with api/gemini.ts the
 * key is read from the server environment and never reaches the client bundle — hence
 * NVIDIA_API_KEY rather than VITE_NVIDIA_API_KEY.
 *
 * The model id is NOT checked against a hard-coded list. NVIDIA retires models on a
 * schedule (meta/llama-3.3-70b-instruct reached end of life on 2026-08-26 and began
 * answering 410 Gone), so a list baked into the source goes stale and takes generation
 * down with it. The client populates its dropdown from GET instead, and the check here is
 * only structural — enough to stop this being used as an open relay to another endpoint.
 */

const NVIDIA_BASE = 'https://integrate.api.nvidia.com/v1';

/** "publisher/model-name", the only shape NVIDIA uses. Blocks slashes, dots and traversal. */
const MODEL_ID = /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/i;

/**
 * Families that cannot author text: a reranker returns a relevance score for a
 * query/document pair and an embedding model returns a vector. Pointing generation at one
 * yields an empty exam with no obvious cause, so they are named as unusable up front.
 */
const NON_GENERATIVE = /(^|[/_-])(rerank|embed|embedqa|reranking)([/_-]|$)/i;

export const config = { maxDuration: 120 };


/**
 * All configured keys for a provider, in order: NAME may hold several keys separated by
 * commas, and NAME_2 … NAME_10 add more. When one key is rate-limited or rejected, the
 * next one is tried, so several free-tier keys can share the load.
 */
function keysFor(name: string): string[] {
  const list: string[] = [];
  const push = (v?: string) => (v || '').split(/[,\s]+/).map((k) => k.trim()).filter(Boolean).forEach((k) => { if (!list.includes(k)) list.push(k); });
  push(process.env[name]);
  for (let i = 1; i <= 10; i++) push(process.env[`${name}_${i}`]);
  return list;
}
/** Worth trying another key: quota/rate limit, or this key rejected. */
const tryNextKey = (status: number) => status === 429 || status === 401 || status === 403;

export default async function handler(req: any, res: any) {
  const apiKeys = keysFor('NVIDIA_API_KEY');
  const apiKey = apiKeys[0];
  if (!apiKey) {
    res.status(503).json({
      error: 'NVIDIA_API_KEY is not configured on the server. Add it in the Vercel project settings.',
    });
    return;
  }

  if (req.method === 'GET') {
    try {
      const response = await fetch(`${NVIDIA_BASE}/models`, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      });
      const text = await response.text();
      res.status(response.status).setHeader('Content-Type', 'application/json');
      res.send(text);
    } catch (error) {
      res.status(502).json({ error: `Could not reach NVIDIA: ${(error as Error).message}` });
    }
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      res.status(400).json({ error: 'Request body must be JSON.' });
      return;
    }
  }
  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'Request body must be JSON.' });
    return;
  }

  const model = String(body.model || '');
  if (!MODEL_ID.test(model)) {
    res.status(400).json({ error: `Invalid model id: ${model || '(none)'}. Expected "publisher/model-name".` });
    return;
  }
  if (NON_GENERATIVE.test(model)) {
    res.status(400).json({
      error:
        `"${model}" is a reranking or embedding model — it scores or vectorises text and cannot write questions. ` +
        'Pick an instruct/chat model from the list.',
    });
    return;
  }

  try {
    let status = 502;
    let text = '';
    for (const key of apiKeys) {
      const response = await fetch(`${NVIDIA_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
          Accept: 'application/json',
        },
        // Streaming would need a different response path here; the client waits for the
        // whole completion, so it is forced off regardless of what was sent.
        body: JSON.stringify({ ...body, stream: false }),
      });
      status = response.status;
      text = await response.text();
      if (!tryNextKey(status)) break;
    }
    res.status(status).setHeader('Content-Type', 'application/json');
    res.send(text);
  } catch (error) {
    res.status(502).json({ error: `Upstream request failed: ${(error as Error).message}` });
  }
}
