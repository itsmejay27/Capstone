/**
 * Server-side proxy for PayMongo.
 *
 *   POST /api/paymongo  { planId, userId, userEmail }  -> { checkoutUrl, checkoutId }
 *
 * The secret key authorises charges against a real merchant account, so it is read from
 * the server environment and never reaches the client bundle — hence PAYMONGO_SECRET_KEY
 * rather than VITE_PAYMONGO_SECRET_KEY. The browser only ever receives a checkout URL.
 *
 * The price is looked up from the database rather than taken from the request. A client
 * that could name its own amount could buy the Department plan for one peso.
 *
 * SCOPE: this creates a Checkout Session, which is a SINGLE payment. PayMongo's recurring
 * billing is a separate product with its own onboarding, so a plan bought here grants a
 * fixed period and then lapses — it does not auto-renew. `current_period_end` is what the
 * app enforces against.
 */

const PAYMONGO_BASE = 'https://api.paymongo.com/v1';

/** Payment methods a Philippine school account can realistically accept. */
const PAYMENT_METHODS = ['card', 'gcash', 'paymaya'];

export const config = { maxDuration: 30 };

function authHeader(secretKey: string) {
  // PayMongo uses HTTP Basic with the secret key as the username and an empty password.
  return `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;
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
  const secretKey = process.env.PAYMONGO_SECRET_KEY;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secretKey) {
    res.status(503).json({
      error: 'PAYMONGO_SECRET_KEY is not configured on the server. Add it in the Vercel project settings.',
    });
    return;
  }
  if (!supabaseUrl || !serviceKey) {
    res.status(503).json({
      error: 'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured so the server can price plans and record the subscription.',
    });
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { planId, userId, userEmail } = req.body || {};
  if (!planId || !userId) {
    res.status(400).json({ error: 'planId and userId are required.' });
    return;
  }

  try {
    // 1. Price the plan server-side. Never trust an amount sent by the browser.
    const planResponse = await fetch(
      `${supabaseUrl}/rest/v1/subscription_plans?id=eq.${encodeURIComponent(planId)}&select=*`,
      { headers: supabaseHeaders(serviceKey) }
    );
    const plans = await planResponse.json();
    const plan = Array.isArray(plans) ? plans[0] : null;

    if (!plan || plan.is_active === false) {
      res.status(404).json({ error: 'That plan does not exist or is no longer offered.' });
      return;
    }
    if (!plan.price_centavos || plan.price_centavos <= 0) {
      res.status(400).json({ error: `The ${plan.name} plan is free — no payment is needed.` });
      return;
    }

    // 2. Create the checkout session.
    const origin = req.headers.origin || `https://${req.headers.host}`;
    const reference = `${userId}:${planId}:${Date.now()}`;

    const checkoutResponse = await fetch(`${PAYMONGO_BASE}/checkout_sessions`, {
      method: 'POST',
      headers: { Authorization: authHeader(secretKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: {
          attributes: {
            line_items: [{
              name: `${plan.name} plan`,
              description: plan.description || `${plan.name} subscription`,
              amount: plan.price_centavos,
              currency: plan.currency || 'PHP',
              quantity: 1,
            }],
            payment_method_types: PAYMENT_METHODS,
            description: `OMSC Exam Generator — ${plan.name} plan`,
            reference_number: reference,
            success_url: `${origin}/billing?billing=success`,
            cancel_url: `${origin}/billing?billing=cancelled`,
            // Echoed back on the webhook, which is how the payment is matched to a user.
            metadata: { user_id: String(userId), plan_id: String(planId) },
          },
        },
      }),
    });

    const checkout = await checkoutResponse.json();
    if (!checkoutResponse.ok) {
      const detail = checkout?.errors?.[0]?.detail || 'PayMongo rejected the checkout request.';
      res.status(checkoutResponse.status).json({ error: detail });
      return;
    }

    const checkoutId = checkout?.data?.id;
    const checkoutUrl = checkout?.data?.attributes?.checkout_url;
    if (!checkoutUrl) {
      res.status(502).json({ error: 'PayMongo did not return a checkout URL.' });
      return;
    }

    // 3. Record the attempt as pending. The webhook flips it to active once paid, so a
    //    user who abandons checkout is never left holding an active plan.
    await fetch(`${supabaseUrl}/rest/v1/user_subscriptions`, {
      method: 'POST',
      headers: supabaseHeaders(serviceKey, {
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      }),
      body: JSON.stringify({
        id: `sub-${Date.now()}-${String(userId).slice(0, 12)}`,
        user_id: String(userId),
        plan_id: String(planId),
        status: 'pending',
        paymongo_checkout_id: checkoutId,
        amount_centavos: plan.price_centavos,
      }),
    });

    res.status(200).json({ checkoutUrl, checkoutId });
  } catch (error) {
    res.status(502).json({ error: `Could not reach PayMongo: ${(error as Error).message}` });
  }
}
