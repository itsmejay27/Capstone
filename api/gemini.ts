/**
 * Server-side proxy for Google Gemini `generateContent`.
 *
 * The browser posts the same request body it would have sent to Google, but to this
 * function instead. The API key is read from the server environment and attached here,
 * so it is never part of the JavaScript bundle and never appears in a request the user
 * can inspect.
 *
 * The key is deliberately NOT named VITE_GEMINI_API_KEY: the VITE_ prefix is what
 * inlines a value into the public client bundle, which is precisely what this avoids.
 *
 * This runs on Vercel's Node runtime (the `(req, res)` signature below), because
 * generation can take most of a minute and the Node runtime is what supports the
 * extended `maxDuration`.
 */

const ALLOWED_MODELS = new Set([
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.6-flash',
]);

export const config = { maxDuration: 60 };


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
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKeys = keysFor('GEMINI_API_KEY');
  if (apiKeys.length === 0) {
    // Surfaced so a misconfigured deployment is diagnosable from the client, without
    // revealing anything about the environment itself.
    res.status(503).json({
      error: 'GEMINI_API_KEY is not configured on the server. Add it in the Vercel project settings.',
    });
    return;
  }

  const model = String(req.query?.model || 'gemini-3.5-flash-lite');
  // Only proxy to a known model, so this cannot be repurposed as an open relay to
  // arbitrary Google API paths.
  if (!ALLOWED_MODELS.has(model)) {
    res.status(400).json({ error: `Unsupported model: ${model}` });
    return;
  }

  // Vercel parses a JSON body automatically, but a string can still arrive when the
  // content type is not exactly application/json.
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

  try {
    let status = 502;
    let text = '';
    for (const apiKey of apiKeys) {
      const upstream = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(upstream, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      status = response.status;
      text = await response.text();
      if (!tryNextKey(status)) break;
    }
    // Pass Google's response through untouched, including on an error status, so the
    // client's existing parsing and model-fallback logic keep working unchanged.
    res.status(status).setHeader('Content-Type', 'application/json');
    res.send(text);
  } catch (error) {
    res.status(502).json({ error: `Upstream request failed: ${(error as Error).message}` });
  }
}
