/**
 * Browser side of billing.
 *
 * Deliberately thin: the browser never sees the PayMongo secret key, never names a price,
 * and never marks a subscription paid. It asks the server for a checkout URL and follows
 * it. Activation happens in the webhook once PayMongo reports the money has moved.
 */

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  priceCentavos: number;
  currency: string;
  interval: string;
  features: string[];
  maxClassrooms: number | null;
  maxExamsPerMonth: number | null;
  sortOrder: number;
  /** Who the plan is for: instructors or students. */
  audience: 'instructor' | 'student';
}

export interface UserSubscription {
  id: string;
  userId: string;
  planId: string;
  status: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  amountCentavos?: number;
}

/** "₱299" — centavos to a display price. */
export function formatPrice(centavos: number, currency = 'PHP'): string {
  if (!centavos) return 'Free';
  const amount = centavos / 100;
  try {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency,
      minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `₱${amount.toFixed(2)}`;
  }
}

/**
 * Starts a PayMongo checkout and returns the URL to send the user to.
 * Throws with a readable message on any failure, including a server that is not yet
 * configured, so the page can show exactly what is missing.
 */
export async function startCheckout(planId: string, userId: string, userEmail?: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch('/api/paymongo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId, userId, userEmail }),
    });
  } catch {
    throw new Error('Could not reach the payment server. Check your connection and try again.');
  }

  let body: any = null;
  try {
    body = await response.json();
  } catch {
    // Running under `vite dev`, /api/* is not served at all — the response is the SPA's
    // index.html, which is not JSON. Say so rather than showing a parse error.
    throw new Error('The payment endpoint is not available here. Checkout works on the deployed site (or under `vercel dev`).');
  }

  if (!response.ok || !body?.checkoutUrl) {
    throw new Error(body?.error || 'Could not start checkout.');
  }
  return body.checkoutUrl as string;
}
