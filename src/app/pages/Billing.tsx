import { useEffect, useRef, useState } from 'react';
import {
  Box, Paper, Typography, Button, Chip, Alert, CircularProgress, Divider,
} from '@mui/material';
import { CheckCircle, WorkspacePremium, Lock } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../hooks/useSubscription';
import { startCheckout, formatPrice, SubscriptionPlan } from '../services/billing';
import { PageContainer, PageHeader } from '../components/ui-kit';
import { useToast } from '../components/Toast';
import { palette, gradient } from '../theme/tokens';

/** After returning from PayMongo, how long to wait for the webhook before giving up. */
const ACTIVATION_POLL_MS = 3000;
const ACTIVATION_POLL_ATTEMPTS = 10;

export default function Billing() {
  const { currentUser } = useAuth();
  const { plans, subscription, currentPlan, loading, refresh } = useSubscription(currentUser?.id);
  const { toast, ToastHost } = useToast();

  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState('');
  const [returnState, setReturnState] = useState<'success' | 'cancelled' | null>(null);
  const [awaitingActivation, setAwaitingActivation] = useState(false);
  const pollCount = useRef(0);

  // PayMongo sends the user back with ?billing=success|cancelled. The redirect only means
  // the checkout page closed — the webhook is what actually activates the plan, and it can
  // arrive a few seconds later, so a success return polls until the plan shows up.
  useEffect(() => {
    const state = new URLSearchParams(window.location.search).get('billing');
    if (state === 'success' || state === 'cancelled') {
      setReturnState(state);
      if (state === 'success') setAwaitingActivation(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!awaitingActivation) return;
    if (subscription) {
      setAwaitingActivation(false);
      toast('Your plan is active.');
      return;
    }
    if (pollCount.current >= ACTIVATION_POLL_ATTEMPTS) {
      setAwaitingActivation(false);
      return;
    }
    const timer = window.setTimeout(() => {
      pollCount.current += 1;
      refresh();
    }, ACTIVATION_POLL_MS);
    return () => window.clearTimeout(timer);
  }, [awaitingActivation, subscription, refresh, toast]);

  const handleSubscribe = async (plan: SubscriptionPlan) => {
    if (!currentUser) return;
    setCheckoutError('');
    setBusyPlanId(plan.id);
    try {
      const url = await startCheckout(plan.id, currentUser.id, currentUser.email);
      window.location.href = url;
    } catch (err: any) {
      setCheckoutError(err?.message || 'Could not start checkout.');
      setBusyPlanId(null);
    }
  };

  const periodEnd = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString(undefined, { dateStyle: 'medium' })
    : null;

  return (
    <PageContainer>
      <PageHeader
        title="Plans & billing"
        subtitle="Choose the plan that fits how many classes you run. Payments are processed securely by PayMongo."
      />

      {returnState === 'success' && (
        <Alert severity={subscription ? 'success' : 'info'} sx={{ mb: 3 }} icon={awaitingActivation ? <CircularProgress size={18} /> : undefined}>
          {subscription
            ? `Payment received — you are on the ${currentPlan?.name} plan.`
            : awaitingActivation
              ? 'Payment submitted. Waiting for PayMongo to confirm it…'
              : 'Your payment was submitted but has not been confirmed yet. It can take a minute; refresh this page shortly. If it does not appear, contact your administrator with your PayMongo receipt.'}
        </Alert>
      )}
      {returnState === 'cancelled' && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          Checkout was cancelled. You have not been charged.
        </Alert>
      )}
      {checkoutError && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setCheckoutError('')}>
          {checkoutError}
        </Alert>
      )}

      {/* Current plan summary */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.5, sm: 3 }, mb: 3, borderRadius: '14px',
          border: `1px solid ${palette.border}`, bgcolor: palette.surface,
          display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
        }}
      >
        <Box
          sx={{
            width: 44, height: 44, borderRadius: '12px', flexShrink: 0,
            bgcolor: palette.primarySoft, color: palette.primary,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <WorkspacePremium />
        </Box>
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography variant="caption" sx={{ color: palette.inkTertiary, fontWeight: 700 }}>
            CURRENT PLAN
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            {loading ? 'Loading…' : currentPlan?.name || 'Free'}
          </Typography>
          <Typography variant="body2" sx={{ color: palette.inkSecondary }}>
            {subscription && periodEnd
              ? `Paid through ${periodEnd}. Plans do not renew automatically — subscribe again before then to keep access.`
              : 'You are on the free plan.'}
          </Typography>
        </Box>
      </Paper>

      {/* Plan cards */}
      {loading ? (
        <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress /></Box>
      ) : plans.length === 0 ? (
        <Alert severity="warning">
          No plans could be loaded. The database may be unreachable.
        </Alert>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: `repeat(${Math.min(plans.length, 3)}, 1fr)` },
            gap: 2.5,
            alignItems: 'stretch',
          }}
        >
          {plans.map((plan) => {
            const isCurrent = plan.id === currentPlan?.id;
            const isFree = plan.priceCentavos === 0;
            // The middle paid plan is the one most instructors want.
            const isFeatured = plan.id === 'educator';
            return (
              <Paper
                key={plan.id}
                elevation={0}
                sx={{
                  position: 'relative',
                  overflow: 'hidden',
                  p: 3,
                  borderRadius: '16px',
                  border: `${isFeatured ? 2 : 1}px solid ${isFeatured ? palette.primary : palette.border}`,
                  bgcolor: palette.surface,
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: isFeatured ? 'var(--shadow-md)' : 'var(--shadow-xs)',
                }}
              >
                {isFeatured && (
                  <Box sx={{ position: 'absolute', insetInline: 0, top: 0, height: 4, background: gradient.brand }} />
                )}

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 900 }}>{plan.name}</Typography>
                  {isFeatured && <Chip size="small" label="Most popular" color="primary" sx={{ height: 22 }} />}
                  {isCurrent && <Chip size="small" label="Current" variant="outlined" sx={{ height: 22 }} />}
                </Box>
                <Typography variant="body2" sx={{ color: palette.inkSecondary, mb: 2, minHeight: 40 }}>
                  {plan.description}
                </Typography>

                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, mb: 2.5 }}>
                  <Typography sx={{ fontSize: '2.2rem', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1 }}>
                    {formatPrice(plan.priceCentavos, plan.currency)}
                  </Typography>
                  {!isFree && (
                    <Typography variant="body2" sx={{ color: palette.inkTertiary }}>/ {plan.interval}</Typography>
                  )}
                </Box>

                <Divider sx={{ mb: 2 }} />

                <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0, mb: 3, flex: 1, display: 'flex', flexDirection: 'column', gap: 1.1 }}>
                  {plan.features.map((feature) => (
                    <Box component="li" key={feature} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                      <CheckCircle sx={{ fontSize: 18, color: palette.primary, mt: '1px', flexShrink: 0 }} />
                      <Typography variant="body2">{feature}</Typography>
                    </Box>
                  ))}
                </Box>

                <Button
                  variant={isFeatured ? 'contained' : 'outlined'}
                  size="large"
                  fullWidth
                  disabled={isCurrent || isFree || Boolean(busyPlanId)}
                  onClick={() => handleSubscribe(plan)}
                  startIcon={busyPlanId === plan.id ? <CircularProgress size={16} color="inherit" /> : undefined}
                >
                  {isCurrent
                    ? 'Your current plan'
                    : isFree
                      ? 'Included'
                      : busyPlanId === plan.id
                        ? 'Opening checkout…'
                        : `Subscribe to ${plan.name}`}
                </Button>
              </Paper>
            );
          })}
        </Box>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 3, color: palette.inkTertiary }}>
        <Lock sx={{ fontSize: 16 }} />
        <Typography variant="caption">
          Payments (QR Ph — scan with any bank or e-wallet app) are handled on PayMongo's secure checkout page. Payment
          details never pass through this system.
        </Typography>
      </Box>

      {ToastHost}
    </PageContainer>
  );
}
