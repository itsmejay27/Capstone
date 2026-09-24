// account-auth — Supabase Edge Function (Deno). Email + password credentials.
//
//   { action: 'status',       email }                  -> { hasPassword }
//   { action: 'set-password', email, code, password }   -> { ok }   (code from email-otp 'send')
//   { action: 'check',        email, password }         -> { ok }   (sign-in and re-authentication)
//
// Passwords are stored only as PBKDF2-SHA256 hashes with a per-account salt, in a table the
// browser cannot read. Setting a password requires a fresh one-time code sent to the email,
// so only the owner of the inbox can add or change it. Wrong passwords are throttled.
// @ts-nocheck

const ITERATIONS = 150_000;
const MAX_FAILURES = 8;          // per 15 minutes per email
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

const isEmail = (s) => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
const hex = (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
const unhex = (h) => new Uint8Array(h.match(/../g).map((x) => parseInt(x, 16)));

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function pbkdf2(password, saltHex, iterations) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unhex(saltHex), iterations }, key, 256);
  return hex(bits);
}

/** Same keyed hash email-otp uses for its codes. */
async function otpHash(email, code, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${email}:${code}`)));
}

function db(url, key) {
  const headers = { apikey: key, 'Content-Type': 'application/json' };
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;
  return async (path, init = {}) => {
    const res = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init.headers || {}) } });
    const text = await res.text();
    if (!res.ok) throw new Error(`db ${res.status}: ${text.slice(0, 200)}`);
    return text ? JSON.parse(text) : null;
  };
}

function passwordProblem(p) {
  if (typeof p !== 'string' || p.length < 8) return 'Use at least 8 characters.';
  if (p.length > 128) return 'Use at most 128 characters.';
  if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) return 'Use both letters and numbers.';
  return null;
}


/**
 * Mirrors a verified person into Supabase Authentication (Dashboard > Authentication > Users),
 * so the project's user list shows everyone who signs in. "Already registered" is fine.
 */
async function ensureAuthUser(url, serviceKey, email, meta = {}) {
  try {
    const res = await fetch(`${url}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, email_confirm: true, user_metadata: meta }),
    });
    if (!res.ok && res.status !== 422) console.warn('[auth-user] create failed', res.status, await res.text());
  } catch (e) {
    console.warn('[auth-user] create failed', e?.message || e);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'Server is not configured.' }, 500);

  let payload;
  try { payload = await req.json(); } catch { return json({ error: 'Body must be JSON' }, 400); }
  const action = payload?.action;
  const email = String(payload?.email || '').trim().toLowerCase();
  if (!isEmail(email)) return json({ error: 'Enter a valid email address.' }, 400);

  const q = db(url, serviceKey);
  const enc = encodeURIComponent(email);

  try {
    if (action === 'status') {
      const rows = await q(`password_credentials?email=eq.${enc}&select=email`);
      return json({ hasPassword: rows.length > 0 });
    }

    if (action === 'set-password') {
      const problem = passwordProblem(payload?.password);
      if (problem) return json({ error: problem }, 400);
      const code = String(payload?.code || '').replace(/\D/g, '');
      if (code.length !== 6) return json({ error: 'Enter the 6-digit code from your email.' }, 400);

      const now = new Date().toISOString();
      const rows = await q(`email_otps?email=eq.${enc}&consumed_at=is.null&expires_at=gt.${now}&select=id,code_hash,attempts&order=created_at.desc&limit=1`);
      const row = rows[0];
      if (!row) return json({ error: 'That code has expired. Request a new one.' }, 400);
      if (row.attempts >= MAX_OTP_ATTEMPTS) return json({ error: 'Too many wrong attempts. Request a new code.' }, 429);
      const ok = safeEqual(row.code_hash, await otpHash(email, code, serviceKey));
      await q(`email_otps?id=eq.${row.id}`, { method: 'PATCH', body: JSON.stringify(ok ? { consumed_at: now } : { attempts: row.attempts + 1 }) });
      if (!ok) return json({ error: 'Wrong code.' }, 400);

      const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
      const hash = await pbkdf2(payload.password, salt, ITERATIONS);
      await q('password_credentials?on_conflict=email', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({ email, hash, salt, iterations: ITERATIONS, updated_at: now }),
      });
      // Owning the inbox also proves the email.
      await q('verified_emails?on_conflict=email', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ email, verified_at: now }) });
      await q(`users?email=ilike.${enc}`, { method: 'PATCH', body: JSON.stringify({ email_verified: true }) });
      await ensureAuthUser(url, serviceKey, email, { provider: 'password' });
      return json({ ok: true });
    }

    if (action === 'check') {
      const since = new Date(Date.now() - FAILURE_WINDOW_MS).toISOString();
      const failures = await q(`auth_failures?email=eq.${enc}&created_at=gte.${since}&select=id`);
      if (failures.length >= MAX_FAILURES) {
        return json({ error: 'Too many wrong passwords. Try again in 15 minutes, or sign in with Google or an email code.' }, 429);
      }
      const rows = await q(`password_credentials?email=eq.${enc}&select=hash,salt,iterations`);
      const cred = rows[0];
      const password = String(payload?.password || '');
      // Hash even when there is no credential so timing does not reveal which emails exist.
      const candidate = await pbkdf2(password, cred?.salt || '00'.repeat(16), cred?.iterations || ITERATIONS);
      if (!cred || !safeEqual(candidate, cred.hash)) {
        await q('auth_failures', { method: 'POST', body: JSON.stringify({ email }) });
        return json({ error: 'That email and password do not match an account.' }, 401);
      }
      await ensureAuthUser(url, serviceKey, email, { provider: 'password' });
      return json({ ok: true });
    }

    return json({ error: 'Unknown action.' }, 400);
  } catch (e) {
    console.error('[account-auth] failed:', e?.message || e);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
});
