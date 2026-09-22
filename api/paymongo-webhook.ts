import crypto from 'crypto';

/**
 * PayMongo webhook. This is the ONLY thing that activates a paid subscription.
 *
 * The browser is never trusted to report its own payment: a success redirect can be typed
 * into the address bar, and the subscriptions table denies writes to the publishable key
 * precisely so that route is closed. PayMongo calls here after money actually moves, this
 * function verifies the signature, and only then does it write with the service role.
 *
 * Signature scheme: the `Paymongo-Signature` header is `t=<unix>,te=<hex>,li=<hex>` — `te`
 * for test-mode events and `li` for live. The expected value is HMAC-SHA256 of
 * `<t>.<raw body>` keyed with the webhook secret, so the RAW body is required and the
 * built-in JSON parser has to be turned off.
 */

export const config = {
  api: { bodyParser: false },
  maxDuration: 30,
};

/** How long a single payment grants access for. PayMongo Checkout does not auto-renew. */
const PERIOD_DAYS = 30;
/** Signatures older than this are refused, so a captured request cannot be replayed later. */
const MAX_SIGNATURE_AGE_SECONDS = 300;

function readRawBody(req: any): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: any) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

/** Constant-time compare, so a wrong signature cannot be found a byte at a time. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifySignature(header: string, rawBody: string, secret: string): boolean {
  const parts = Object.fromEntries(
    header.split(',').map((piece) => {
      const [k, v] = piece.split('=');
      return [k?.trim(), v?.trim()];
    })
  ) as Record<string, string>;

  const timestamp = parts.t;
  const provided = parts.te || parts.li;
  if (!timestamp || !provided) return false;

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > MAX_SIGNATURE_AGE_SECONDS) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  return safeEqual(expected, provided);
}

/**
 * Headers for a server-side Supabase REST call. Supabase has two key formats: the legacy
 * service_role key is a JWT and goes in both `apikey` and `Authorization`, while the newer
 * `sb_secret_…` key is not a JWT and belongs in `apikey` alone — sending it as a Bearer
 * token is what Supabase's own docs tell you to remove. Either works here.
 */
function supabaseHeaders(serviceKey: string, extra: Record<string, string> = {}) {
  return {
    apikey: serviceKey,
    ...(serviceKey.startsWith('eyJ') ? { Authorization: `Bearer ${serviceKey}` } : {}),
    ...extra,
  };
}

export default async function handler(req: any, res: any) {
  const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!webhookSecret || !supabaseUrl || !serviceKey) {
    // Never activate anything when the server is half-configured: a missing secret means
    // signatures cannot be checked, and an unverified event must not grant a paid plan.
    res.status(503).json({
      error: 'PAYMONGO_WEBHOOK_SECRET, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must all be configured.',
    });
    return;
  }

  const rawBody = await readRawBody(req);
  const signature = req.headers['paymongo-signature'];

  if (!signature || !verifySignature(String(signature), rawBody, webhookSecret)) {
    res.status(401).json({ error: 'Invalid signature.' });
    return;
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    res.status(400).json({ error: 'Body is not valid JSON.' });
    return;
  }

  const type = event?.data?.attributes?.type;
  const payload = event?.data?.attributes?.data;

  // Only a cleared payment activates anything.
  if (type !== 'payment.paid' && type !== 'checkout_session.payment.paid') {
    res.status(200).json({ received: true, ignored: type });
    return;
  }

  const attributes = payload?.attributes || {};
  const metadata = attributes.metadata || attributes?.data?.attributes?.metadata || {};
  const userId = metadata.user_id;
  const planId = metadata.plan_id;
  const paymentId = payload?.id;

  if (!userId || !planId) {
    // Without metadata there is no way to tell whose subscription this is. Answer 200 so
    // PayMongo stops retrying, but record nothing.
    res.status(200).json({ received: true, ignored: 'missing metadata' });
    return;
  }

  const now = new Date();
  const periodEnd = new Date(now.getTime() + PERIOD_DAYS * 24 * 60 * 60 * 1000);

  try {
    const headers = supabaseHeaders(serviceKey, {
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    });

    // Supersede any earlier subscription for this user, so status is never ambiguous.
    await fetch(
      `${supabaseUrl}/rest/v1/user_subscriptions?user_id=eq.${encodeURIComponent(userId)}&status=eq.active`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'superseded', updated_at: now.toISOString() }),
      }
    );

    const response = await fetch(`${supabaseUrl}/rest/v1/user_subscriptions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: `sub-${paymentId || Date.now()}`,
        user_id: String(userId),
        plan_id: String(planId),
        status: 'active',
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        paymongo_payment_id: paymentId || null,
        amount_centavos: attributes.amount ?? null,
        updated_at: now.toISOString(),
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      // 500 makes PayMongo retry, which is what we want if the write failed.
      res.status(500).json({ error: `Could not record the subscription: ${detail.slice(0, 300)}` });
      return;
    }

    res.status(200).json({ received: true, activated: { userId, planId } });
  } catch (error) {
    res.status(500).json({ error: `Could not record the subscription: ${(error as Error).message}` });
  }
}
