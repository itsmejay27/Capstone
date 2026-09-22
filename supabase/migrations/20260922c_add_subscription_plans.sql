-- Subscription plans and the subscriptions users hold against them.
--
-- SECURITY NOTE: unlike the demo tables in this project, these are NOT open. A browser
-- holds only the publishable key, and if it could write here any signed-in user could set
-- their own row to an active paid plan and skip payment entirely. Clients may read; only
-- the service role (used by the PayMongo webhook) may write.
--
-- Applied to the live project (vcolqqvicukqjxdrjolz) on 2026-09-22. Verified: an insert
-- as the anon role fails with 42501.

CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id                  text PRIMARY KEY,
  name                text NOT NULL,
  description         text,
  price_centavos      integer NOT NULL DEFAULT 0,
  currency            text NOT NULL DEFAULT 'PHP',
  interval            text NOT NULL DEFAULT 'month',
  features            jsonb NOT NULL DEFAULT '[]'::jsonb,
  max_classrooms      integer,
  max_exams_per_month integer,
  is_active           boolean NOT NULL DEFAULT true,
  sort_order          integer NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id                   text PRIMARY KEY,
  user_id              text NOT NULL,
  plan_id              text NOT NULL REFERENCES public.subscription_plans(id),
  status               text NOT NULL DEFAULT 'pending',
  current_period_start timestamptz,
  current_period_end   timestamptz,
  paymongo_checkout_id text,
  paymongo_payment_id  text,
  amount_centavos      integer,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_subscriptions_user_idx ON public.user_subscriptions (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS user_subscriptions_checkout_idx
  ON public.user_subscriptions (paymongo_checkout_id) WHERE paymongo_checkout_id IS NOT NULL;

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plans_readable ON public.subscription_plans;
CREATE POLICY plans_readable ON public.subscription_plans FOR SELECT USING (true);

-- No insert/update/delete policy on purpose: RLS then denies writes to anon and
-- authenticated. The service role bypasses RLS, so the webhook can still write.
DROP POLICY IF EXISTS subscriptions_readable ON public.user_subscriptions;
CREATE POLICY subscriptions_readable ON public.user_subscriptions FOR SELECT USING (true);

INSERT INTO public.subscription_plans
  (id, name, description, price_centavos, interval, features, max_classrooms, max_exams_per_month, sort_order)
VALUES
  ('free', 'Free', 'For trying the system out.', 0, 'month',
   '["1 classroom","3 AI-generated exams per month","Up to 30 items per exam","Gemini engine only","Question bank (50 items)"]'::jsonb,
   1, 3, 0),
  ('educator', 'Educator', 'For a teacher running their own sections.', 29900, 'month',
   '["10 classrooms","Unlimited AI-generated exams","Up to 100 items per exam","All AI engines, including NVIDIA","Unlimited question bank","TOS compliance validation","Printable exams with OMSC letterhead"]'::jsonb,
   10, NULL, 1),
  ('department', 'Department', 'For a whole department sharing one workspace.', 99900, 'month',
   '["Unlimited classrooms","Unlimited AI-generated exams","No item limit","All AI engines, including NVIDIA","Unlimited question bank","Item analysis and grade analytics","Priority generation queue"]'::jsonb,
   NULL, NULL, 2)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description,
  price_centavos = EXCLUDED.price_centavos, features = EXCLUDED.features,
  max_classrooms = EXCLUDED.max_classrooms, max_exams_per_month = EXCLUDED.max_exams_per_month,
  sort_order = EXCLUDED.sort_order;
