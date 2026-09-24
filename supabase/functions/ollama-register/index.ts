/**
 * ollama-register — the laptop's tunnel script publishes its current Ollama address here,
 * so the site connects to it automatically without anyone typing the address.
 *
 *   POST { key, url }   -> { ok: true }   (url "" clears it)
 *
 * `key` must match app_secrets.ollama_register_key, which only the laptop owner has.
 */

// @ts-nocheck -- Deno runtime; not type-checked by the app's Vite/tsc setup.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'Server is not configured.' }, 500);

  let payload;
  try { payload = await req.json(); } catch { return json({ error: 'Body must be JSON' }, 400); }
  const address = String(payload?.url || '').trim().replace(/\/+$/, '');
  if (address && !/^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(address)) {
    return json({ error: 'The address must look like https://something.trycloudflare.com' }, 400);
  }

  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };
  const secretRes = await fetch(`${url}/rest/v1/app_secrets?key=eq.ollama_register_key&select=value`, { headers });
  const secret = (await secretRes.json().catch(() => []))?.[0]?.value;
  if (!secret || !safeEqual(String(payload?.key || ''), secret)) return json({ error: 'Wrong key.' }, 401);

  const save = await fetch(`${url}/rest/v1/app_settings?on_conflict=key`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ key: 'ollama_server_url', value: address || null, updated_at: new Date().toISOString() }),
  });
  if (!save.ok) return json({ error: `Could not save (${save.status}).` }, 500);
  return json({ ok: true, url: address });
});
