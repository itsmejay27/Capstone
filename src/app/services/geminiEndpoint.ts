/**
 * Shared transport detail for Gemini calls.
 *
 * This lives in its own module because both geminiService and tosParser need it, and
 * geminiService already imports tosParser — putting it in either would create a cycle.
 */

/**
 * Where to POST a generateContent request.
 *
 * With a key available in the browser (a VITE_ env var, or one pasted into localStorage
 * for local work) we call Google directly. Without one we go through /api/gemini, the
 * serverless function that holds GEMINI_API_KEY, so the key never ships to the client.
 *
 * /api/gemini only exists on the deployed site and under `vercel dev`; plain `vite dev`
 * does not serve the api/ directory, so local development still needs its own key.
 */
export function geminiEndpoint(model: string, apiKey?: string): string {
  const key = (apiKey || '').trim();
  return key
    ? `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`
    : `/api/gemini?model=${encodeURIComponent(model)}`;
}

/**
 * True when a generation attempt is worth making: either we hold a key directly, or we
 * are in a browser where the proxy can supply one.
 */
export function isGeminiAvailable(apiKey?: string): boolean {
  return Boolean((apiKey || '').trim()) || typeof window !== 'undefined';
}
