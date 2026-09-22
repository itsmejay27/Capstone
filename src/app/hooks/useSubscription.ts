import { useCallback, useEffect, useState } from 'react';
import { fetchSubscriptionPlans, fetchUserSubscription } from '../services/supabaseData';
import type { SubscriptionPlan, UserSubscription } from '../services/billing';

/**
 * The plan catalogue plus the signed-in user's current plan.
 *
 * `currentPlan` falls back to the free plan when there is no active, unexpired
 * subscription — which is also what a lapsed paid plan resolves to, since PayMongo
 * Checkout does not auto-renew.
 */
export function useSubscription(userId?: string | null) {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [planRows, sub] = await Promise.all([
      fetchSubscriptionPlans(),
      userId ? fetchUserSubscription(userId) : Promise.resolve(null),
    ]);
    setPlans(planRows as SubscriptionPlan[]);
    setSubscription(sub as UserSubscription | null);
    setLoading(false);
  }, [userId]);

  useEffect(() => { refresh(); }, [refresh]);

  const currentPlan =
    plans.find((p) => p.id === subscription?.planId) ||
    plans.find((p) => p.priceCentavos === 0) ||
    null;

  return { plans, subscription, currentPlan, loading, refresh };
}
