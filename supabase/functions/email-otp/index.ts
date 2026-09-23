/**
 * email-otp — Supabase Edge Function (Deno). One-time email sign-in codes.
 *
 *   POST { action: 'send',   email }        -> { ok: true }
 *   POST { action: 'verify', email, code }  -> { ok: true } | { error }
 *
 * The code is generated, stored and checked HERE, never in the browser: the browser only
 * ever learns "sent" and "valid / not valid". Only a keyed hash of the code is stored, in a
 * table the publishable key cannot read (RLS on, no policies). Limits: a code lives 10
 * minutes, allows 5 wrong guesses, and an address can request one code per 60 seconds
 * and 5 per hour.
 */

// @ts-nocheck -- Deno runtime; not type-checked by the app's Vite/tsc setup.

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_PER_HOUR = 5;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function isEmail(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
}

/** Uniform 6-digit code from the CSPRNG (rejection sampling avoids modulo bias). */
function generateCode() {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0xffffffff / 1_000_000) * 1_000_000;
  do { crypto.getRandomValues(buf); } while (buf[0] >= limit);
  return String(buf[0] % 1_000_000).padStart(6, '0');
}

/** HMAC-SHA256 of email+code, keyed with a server-only secret, so a leaked row is useless. */
async function hashCode(email, code, secret) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${email}:${code}`));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
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

const PURPOSES = {
  verify: {
    subject: (c) => `${c} is your Aspire e Learning code`,
    heading: 'Your verification code',
    intro: 'Enter this code in Aspire e Learning to verify your email.',
  },
  'new-device': {
    subject: (c) => `New sign-in to Aspire e Learning — code ${c}`,
    heading: 'New sign-in on a device',
    intro: 'Someone is signing in to your Aspire e Learning account from a new device or browser. If this is you, enter this code to continue.',
  },
  'set-password': {
    subject: (c) => `${c} — confirm your new Aspire e Learning password`,
    heading: 'Set your password',
    intro: 'Enter this code to confirm it is you before your email-and-password sign-in is set up.',
  },
  reauth: {
    subject: (c) => `${c} — confirm it is you`,
    heading: 'Confirm it is you',
    intro: 'A protected action was requested in your Aspire e Learning account (changing your profile, deleting or exporting content). Enter this code to allow it.',
  },
};

function emailHtml(code, purpose) {
  const p = PURPOSES[purpose] || PURPOSES.verify;
  const warn = purpose === 'verify' ? '' :
    '<p style="margin:14px 0 0;font-size:13px;color:#b91c1c;"><b>Not you?</b> Do not share this code. Your account stays locked without it; consider setting a new password.</p>';
  return `<!doctype html><html><body style="margin:0;background:#f5f8fc;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0b1626;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:28px 12px;"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fff;border:1px solid #e3eaf3;border-radius:14px;">
      <tr><td style="padding:18px 24px;border-bottom:1px solid #e3eaf3;font-size:14px;font-weight:800;color:#0ea5c6;">Aspire e Learning</td></tr>
      <tr><td style="padding:26px 24px;">
        <h1 style="margin:0 0 10px;font-size:19px;">${p.heading}</h1>
        <p style="margin:0 0 18px;font-size:14px;color:#3c4a5e;">${p.intro} It expires in 10 minutes.</p>
        <div style="font-size:32px;font-weight:800;letter-spacing:8px;font-family:monospace;background:#f3f7fb;border-radius:10px;padding:14px;text-align:center;">${code}</div>
        ${warn}
        <p style="margin:18px 0 0;font-size:12px;color:#6b7a90;">Never share this code with anyone. Aspire e Learning will never ask you for it.</p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('RESEND_FROM') || 'Aspire e Learning <no-reply@aspire-e-learning.site>';
  if (!supabaseUrl || !serviceKey) return json({ error: 'Server is not configured.' }, 500);

  let payload;
  try { payload = await req.json(); } catch { return json({ error: 'Body must be JSON' }, 400); }
  const action = payload?.action;
  const purpose = typeof payload?.purpose === 'string' && PURPOSES[payload.purpose] ? payload.purpose : 'verify';
  const email = String(payload?.email || '').trim().toLowerCase();
  if (!isEmail(email)) return json({ error: 'Enter a valid email address.' }, 400);

  const q = db(supabaseUrl, serviceKey);
  const enc = encodeURIComponent(email);

  try {
    if (action === 'send') {
      if (!resendKey) return json({ error: 'Email sending is not configured (RESEND_API_KEY).' }, 500);

      const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const recent = await q(`email_otps?email=eq.${enc}&created_at=gte.${hourAgo}&select=created_at&order=created_at.desc`);
      if (recent.length > 0 && Date.now() - new Date(recent[0].created_at).getTime() < RESEND_COOLDOWN_MS) {
        return json({ error: 'Please wait a minute before requesting another code.' }, 429);
      }
      if (recent.length >= MAX_PER_HOUR) {
        return json({ error: 'Too many codes requested. Try again in an hour.' }, 429);
      }

      const code = generateCode();
      await q('email_otps', {
        method: 'POST',
        body: JSON.stringify({
          email,
          code_hash: await hashCode(email, code, serviceKey),
          expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
        }),
      });

      const res = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [email], subject: (PURPOSES[purpose] || PURPOSES.verify).subject(code), html: emailHtml(code, purpose) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const reason = body?.message || `Resend returned ${res.status}`;
        console.error('[email-otp] Resend rejected', email, res.status, reason);
        return json({ error: `Could not send the code: ${reason}` }, 502);
      }
      return json({ ok: true });
    }

    if (action === 'verify') {
      const code = String(payload?.code || '').replace(/\D/g, '');
      if (code.length !== 6) return json({ error: 'Enter the 6-digit code.' }, 400);

      const now = new Date().toISOString();
      const rows = await q(
        `email_otps?email=eq.${enc}&consumed_at=is.null&expires_at=gt.${now}&select=id,code_hash,attempts&order=created_at.desc&limit=1`
      );
      const row = rows[0];
      if (!row) return json({ error: 'That code has expired. Request a new one.' }, 400);
      if (row.attempts >= MAX_ATTEMPTS) return json({ error: 'Too many wrong attempts. Request a new code.' }, 429);

      const ok = safeEqual(row.code_hash, await hashCode(email, code, serviceKey));
      await q(`email_otps?id=eq.${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify(ok ? { consumed_at: now } : { attempts: row.attempts + 1 }),
      });
      if (!ok) {
        const left = MAX_ATTEMPTS - row.attempts - 1;
        return json({ error: left > 0 ? `Wrong code. ${left} attempt${left === 1 ? '' : 's'} left.` : 'Too many wrong attempts. Request a new code.' }, 400);
      }
      // Record the verification server-side. The users table ignores this column when the
      // browser writes it, so this is the only way an account becomes verified.
      await q('verified_emails?on_conflict=email', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({ email, verified_at: now }),
      });
      await q(`users?email=ilike.${enc}`, {
        method: 'PATCH',
        body: JSON.stringify({ email_verified: true }),
      });
      return json({ ok: true, email });
    }

    return json({ error: 'Unknown action.' }, 400);
  } catch (e) {
    console.error('[email-otp] failed:', e?.message || e);
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
});
