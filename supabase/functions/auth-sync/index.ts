/**
 * auth-sync — records a Google sign-in in Supabase Authentication.
 *
 * The app signs people in with Google on the client. This function checks the Google ID
 * token with Google itself (so nobody can register an arbitrary email) and then creates the
 * matching user in Authentication > Users. It never returns a session; it only mirrors.
 *
 *   POST { credential: "<Google ID token>" } -> { ok: true, email }
 */

// @ts-nocheck -- Deno runtime; not type-checked by the app's Vite/tsc setup.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'Server is not configured.' }, 500);

  let payload;
  try { payload = await req.json(); } catch { return json({ error: 'Body must be JSON' }, 400); }
  const credential = String(payload?.credential || '');
  if (!credential || credential.length > 4096) return json({ error: 'Missing credential.' }, 400);

  // Google validates the signature and expiry for us.
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  if (!res.ok) return json({ error: 'Invalid Google credential.' }, 401);
  const info = await res.json();
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(info.iss)) return json({ error: 'Invalid issuer.' }, 401);
  const allowed = (Deno.env.get('GOOGLE_CLIENT_ID') || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (allowed.length && !allowed.includes(info.aud)) return json({ error: 'Credential is for another app.' }, 401);
  if (String(info.email_verified) !== 'true' || !info.email) return json({ error: 'Google email is not verified.' }, 401);

  const email = String(info.email).toLowerCase();
  const r = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, email_confirm: true, user_metadata: { provider: 'google', name: info.name, avatar_url: info.picture } }),
  });
  if (!r.ok && r.status !== 422) {
    console.warn('[auth-sync] create failed', r.status, await r.text());
    return json({ error: 'Could not record the user.' }, 502);
  }
  return json({ ok: true, email });
});
