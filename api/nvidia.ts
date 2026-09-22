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

export const config = { maxDuration: 60 };

export default async function handler(req: any, res: any) {
  const apiKey = process.env.NVIDIA_API_KEY;
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
    const response = await fetch(`${NVIDIA_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
      // Streaming would need a different response path here; the client waits for the
      // whole completion, so it is forced off regardless of what was sent.
      body: JSON.stringify({ ...body, stream: false }),
    });

    const text = await response.text();
    res.status(response.status).setHeader('Content-Type', 'application/json');
    res.send(text);
  } catch (error) {
    res.status(502).json({ error: `Upstream request failed: ${(error as Error).message}` });
  }
}
