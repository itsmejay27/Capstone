-- One-time sign-in codes. Only the email-otp Edge Function (service role) touches this
-- table: RLS is on with NO policies, so the browser's publishable key can neither read
-- the hashes nor insert/verify codes directly.
create table if not exists public.email_otps (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists email_otps_email_created_idx on public.email_otps (email, created_at desc);
alter table public.email_otps enable row level security;
