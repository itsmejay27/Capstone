/**
 * Server-side proxy for Google Gemini `generateContent`.
 *
 * The browser posts the same request body it would have sent to Google, but to this
 * function instead. The API key is read from the server environment and attached here,
 * so it is never part of the JavaScript bundle and never appears in a request the user
 * can inspect.
 *
 * The key is deliberately NOT named VITE_GEMINI_API_KEY: the VITE_ prefix is what
 * inlines a value into the public client bundle, which is precisely what this exists
 * to avoid.
 */

const ALLOWED_MODELS = new Set([
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.6-flash',
]);

export const config = { maxDuration: 60 };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Surfaced to the caller so a misconfigured deployment is diagnosable, without
    // leaking anything about the environment itself.
    return json({ error: 'GEMINI_API_KEY is not configured on the server.' }, 503);
  }

  const model = new URL(req.url).searchParams.get('model') || 'gemini-3.5-flash-lite';
  // Only proxy to a known model, so this endpoint cannot be repurposed as an open
  // relay to arbitrary Google API paths.
  if (!ALLOWED_MODELS.has(model)) {
    return json({ error: `Unsupported model: ${model}` }, 400);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Request body must be JSON.' }, 400);
  }

  const upstream = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  try {
    const response = await fetch(upstream, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    // Pass Google's response through untouched so the client's existing parsing and
    // its model-fallback logic keep working, including on an error status.
    const text = await response.text();
    return new Response(text, {
      status: response.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return json({ error: `Upstream request failed: ${(error as Error).message}` }, 502);
  }
}

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
