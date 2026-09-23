/**
 * send-email — Supabase Edge Function (Deno).
 *
 * WHY THIS EXISTS INSTEAD OF CALLING RESEND FROM THE BROWSER:
 *  1. Vite inlines every `VITE_*` variable into the public JS bundle. A Resend key shipped
 *     that way is readable by anyone who opens devtools on the deployed site, who could then
 *     send mail as this domain, burn the quota, and get the sending domain blacklisted.
 *  2. Resend's API does not permit browser-origin requests (no CORS), so a direct client
 *     call would fail anyway.
 *
 * The key therefore lives ONLY as a Supabase secret, never in the repo or the bundle:
 *     supabase secrets set RESEND_API_KEY=re_xxx RESEND_FROM="Aspire e Learning <no-reply@yourdomain>"
 *     supabase functions deploy send-email
 *
 * Deploy note: this function is invoked with the project's anon key, which every visitor
 * has. That makes it an open relay unless it is constrained — hence the allow-list of
 * template kinds, the recipient cap, and the per-invocation payload validation below.
 * Tighten further with `--no-verify-jwt=false` + real Supabase Auth when available.
 */

// @ts-nocheck -- Deno runtime; not type-checked by the app's Vite/tsc setup.

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Only these templates may be sent. An arbitrary subject/body from the client is refused. */
const TEMPLATES = {
  announcement: {
    subject: (d) => `[${d.className}] ${d.title || 'New announcement'}`,
    heading: (d) => d.title || 'New announcement',
    intro: (d) => `${d.authorName || 'Your instructor'} posted in ${d.className}.`,
  },
  assignment: {
    subject: (d) => `[${d.className}] New assignment: ${d.title}`,
    heading: (d) => d.title,
    intro: (d) => `A new assignment was posted in ${d.className}${d.dueLabel ? ` — ${d.dueLabel}` : ''}.`,
  },
  due_reminder: {
    subject: (d) => `[${d.className}] Due soon: ${d.title}`,
    heading: (d) => `Due soon: ${d.title}`,
    intro: (d) => `This is a reminder that "${d.title}" in ${d.className} is ${d.dueLabel || 'due shortly'}.`,
  },
  comment: {
    subject: (d) => `[${d.className}] ${d.authorName || 'Someone'} commented on "${d.title || 'your post'}"`,
    heading: (d) => `New comment on "${d.title || 'your post'}"`,
    intro: (d) => `${d.authorName || 'Someone'} commented in ${d.className}.`,
  },
  graded: {
    subject: (d) => `[${d.className}] Your work was graded: ${d.title}`,
    heading: (d) => `${d.title} — graded`,
    intro: (d) => `Your submission for "${d.title}" in ${d.className} has been returned${d.grade !== undefined ? ` with a score of ${d.grade}` : ''}.`,
  },
};

const MAX_RECIPIENTS = 50;

/** Minimal HTML escaping — all interpolated values are untrusted client input. */
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isEmail(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
}

function renderHtml({ heading, intro, body, ctaUrl, ctaLabel, className }) {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f6f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#16161d;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f8;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e8e8ed;border-radius:14px;overflow:hidden;">
        <tr><td style="padding:18px 24px;border-bottom:1px solid #e8e8ed;">
          <span style="font-size:13px;font-weight:700;color:#4f46e5;letter-spacing:.02em;">Aspire e Learning</span>
          ${className ? `<div style="font-size:12px;color:#8e8e9e;margin-top:2px;">${esc(className)}</div>` : ''}
        </td></tr>
        <tr><td style="padding:26px 24px;">
          <h1 style="margin:0 0 10px;font-size:19px;font-weight:800;line-height:1.3;">${esc(heading)}</h1>
          <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#5c5c6b;">${esc(intro)}</p>
          ${body ? `<div style="font-size:14px;line-height:1.65;color:#16161d;border-left:3px solid #e8e8ed;padding-left:14px;margin:16px 0;">${esc(body)}</div>` : ''}
          ${ctaUrl ? `<a href="${esc(ctaUrl)}" style="display:inline-block;margin-top:8px;background:#4f46e5;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:11px 20px;border-radius:10px;">${esc(ctaLabel || 'Open Aspire e Learning')}</a>` : ''}
        </td></tr>
        <tr><td style="padding:16px 24px;background:#fafafb;border-top:1px solid #e8e8ed;font-size:11px;color:#8e8e9e;">
          Sent by Aspire e Learning. You are receiving this because you are enrolled in this class.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('RESEND_FROM') || 'Aspire e Learning <no-reply@aspire-e-learning.site>';

  if (!apiKey) {
    // Configuration problem, not a caller problem — say so explicitly so it is debuggable.
    return new Response(
      JSON.stringify({ error: 'RESEND_API_KEY is not configured on this function. Run: supabase secrets set RESEND_API_KEY=...' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Body must be JSON' }), {
      status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  const { template, to, data = {} } = payload || {};

  const tpl = TEMPLATES[template];
  if (!tpl) {
    return new Response(
      JSON.stringify({ error: `Unknown template "${template}". Allowed: ${Object.keys(TEMPLATES).join(', ')}` }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }

  const recipients = (Array.isArray(to) ? to : [to]).filter(isEmail);
  if (recipients.length === 0) {
    return new Response(JSON.stringify({ error: 'No valid recipient addresses' }), {
      status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
  if (recipients.length > MAX_RECIPIENTS) {
    return new Response(
      JSON.stringify({ error: `Too many recipients (${recipients.length}); the cap is ${MAX_RECIPIENTS}.` }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
    );
  }

  const html = renderHtml({
    heading: tpl.heading(data),
    intro: tpl.intro(data),
    body: data.body,
    ctaUrl: data.ctaUrl,
    ctaLabel: data.ctaLabel,
    className: data.className,
  });

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        // BCC so a class email never leaks the roster's addresses to every student.
        to: [from.replace(/^.*<([^>]+)>.*$/, '$1')],
        bcc: recipients,
        subject: tpl.subject(data),
        html,
      }),
    });

    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      return new Response(JSON.stringify({ error: result?.message || `Resend returned ${res.status}` }), {
        status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, id: result?.id, sent: recipients.length }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: `Send failed: ${e?.message || e}` }), {
      status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
