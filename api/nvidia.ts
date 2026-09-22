/**
 * Server-side proxy for NVIDIA NIM chat completions.
 *
 * NVIDIA's hosted catalogue is OpenAI-compatible, so the browser posts a standard
 * chat-completions body and this function forwards it with the API key attached. As with
 * api/gemini.ts the key is read from the server environment and is never part of the
 * client bundle — hence NVIDIA_API_KEY rather than VITE_NVIDIA_API_KEY.
 *
 * Runs on the Node runtime for the extended maxDuration: a 70B model generating a full
 * exam can take most of a minute.
 */

const NVIDIA_CHAT_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';

/**
 * Instruct models only. A reranking model (llama-nemotron-rerank-*) returns a relevance
 * score for a query/document pair, not text, so it cannot author questions — rejecting it
 * here turns a confusing empty generation into a clear message.
 */
const ALLOWED_MODELS = new Set([
  'meta/llama-3.3-70b-instruct',
  'meta/llama-3.1-70b-instruct',
  'meta/llama-3.1-8b-instruct',
  'nvidia/llama-3.1-nemotron-70b-instruct',
]);

export const config = { maxDuration: 60 };

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    res.status(503).json({
      error: 'NVIDIA_API_KEY is not configured on the server. Add it in the Vercel project settings.',
    });
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
  if (!ALLOWED_MODELS.has(model)) {
    res.status(400).json({
      error:
        `Unsupported model: ${model || '(none)'}. ` +
        `Use one of: ${Array.from(ALLOWED_MODELS).join(', ')}.`,
    });
    return;
  }

  try {
    const response = await fetch(NVIDIA_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
      // Streaming would need a different response path on this side; the client waits
      // for the whole completion, so it is forced off regardless of what was sent.
      body: JSON.stringify({ ...body, stream: false }),
    });

    const text = await response.text();
    res.status(response.status).setHeader('Content-Type', 'application/json');
    res.send(text);
  } catch (error) {
    res.status(502).json({ error: `Upstream request failed: ${(error as Error).message}` });
  }
}
