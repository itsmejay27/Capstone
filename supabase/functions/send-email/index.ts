// send-email — Supabase Edge Function (Deno). Source: supabase/functions/send-email/index.ts
// The Resend key lives only as a Supabase secret (RESEND_API_KEY), never in the app bundle.
// Only the templates below can be sent, so the function is not an open relay.
// @ts-nocheck

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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
  exam: {
    subject: (d) => `[${d.className}] New exam: ${d.title}`,
    heading: (d) => d.title,
    intro: (d) => `${d.authorName || 'Your instructor'} assigned an exam in ${d.className}${d.dueLabel ? ` — ${d.dueLabel}` : ''}.`,
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

function isPlaceholder(address) {
  const domain = address.split('@')[1]?.toLowerCase() || '';
  return /(^|\.)(example\.(com|org|net)|test|invalid|localhost)$/.test(domain);
}

function renderHtml({ heading, intro, body, ctaUrl, ctaLabel, className }) {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f5f8fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0b1626;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f8fc;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e3eaf3;border-radius:14px;overflow:hidden;">
        <tr><td style="padding:18px 24px;border-bottom:1px solid #e3eaf3;">
          <span style="font-size:14px;font-weight:800;color:#0ea5c6;">Aspire e Learning</span>
          ${className ? `<div style="font-size:12px;color:#6b7a90;margin-top:2px;">${esc(className)}</div>` : ''}
        </td></tr>
        <tr><td style="padding:26px 24px;">
          <h1 style="margin:0 0 10px;font-size:19px;font-weight:800;line-height:1.3;">${esc(heading)}</h1>
          <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#3c4a5e;">${esc(intro)}</p>
          ${body ? `<div style="font-size:14px;line-height:1.65;color:#0b1626;border-left:3px solid #e3eaf3;padding-left:14px;margin:16px 0;white-space:pre-line;">${esc(body)}</div>` : ''}
          ${ctaUrl ? `<a href="${esc(ctaUrl)}" style="display:inline-block;margin-top:8px;background:#0b1626;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:11px 20px;border-radius:999px;">${esc(ctaLabel || 'Open Aspire e Learning')}</a>` : ''}
        </td></tr>
        <tr><td style="padding:16px 24px;background:#f3f7fb;border-top:1px solid #e3eaf3;font-size:11px;color:#6b7a90;">
          Sent by Aspire e Learning. You are receiving this because you are a member of this class.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('RESEND_FROM') || 'Aspire e Learning <no-reply@aspire-e-learning.site>';
  if (!apiKey) return json({ error: 'RESEND_API_KEY is not configured on this function. Add it under Supabase → Edge Functions → Secrets.' }, 500);

  let payload;
  try { payload = await req.json(); } catch { return json({ error: 'Body must be JSON' }, 400); }

  const { template, to, data = {} } = payload || {};
  const tpl = TEMPLATES[template];
  if (!tpl) return json({ error: `Unknown template "${template}". Allowed: ${Object.keys(TEMPLATES).join(', ')}` }, 400);

  const recipients = (Array.isArray(to) ? to : [to]).filter(isEmail);
  if (recipients.length === 0) return json({ error: 'No valid recipient addresses' }, 400);
  if (recipients.length > MAX_RECIPIENTS) return json({ error: `Too many recipients (${recipients.length}); the cap is ${MAX_RECIPIENTS}.` }, 400);

  const html = renderHtml({
    heading: tpl.heading(data), intro: tpl.intro(data), body: data.body,
    ctaUrl: data.ctaUrl, ctaLabel: data.ctaLabel, className: data.className,
  });

  const subject = tpl.subject(data);
  const deliverable = recipients.filter((address) => !isPlaceholder(address));
  if (deliverable.length === 0) return json({ ok: true, sent: 0, skipped: recipients.length });

  // One message per recipient, so no student sees another's address.
  async function sendOne(address) {
    try {
      const res = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [address], subject, html }),
      });
      if (res.ok) { console.log('[send-email] sent to', address); return { address, ok: true }; }
      const body = await res.json().catch(() => ({}));
      const reason = body?.message || body?.error || `Resend returned ${res.status}`;
      console.error('[send-email] Resend rejected', address, res.status, reason);
      return { address, ok: false, reason };
    } catch (e) {
      console.error('[send-email] request failed for', address, e?.message || e);
      return { address, ok: false, reason: String(e?.message || e) };
    }
  }

  const results = [];
  for (const [i, address] of deliverable.entries()) {
    // Resend's free tier allows about two requests a second.
    if (i > 0) await new Promise((r) => setTimeout(r, 550));
    results.push(await sendOne(address));
  }

  const sent = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  if (sent === 0) return json({ error: failed[0]?.reason || 'No email could be sent.' }, 502);
  return json({ ok: true, sent, failed: failed.length });
});
