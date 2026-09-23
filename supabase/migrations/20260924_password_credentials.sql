-- Password sign-in for any account (including Google-created ones). Only the account-auth
-- Edge Function (service role) touches this: RLS on, no policies, so the browser can never
-- read a hash. Keyed by email: one password per email, shared by its instructor/student profiles.
create table if not exists public.password_credentials (
  email text primary key,
  hash text not null,
  salt text not null,
  iterations int not null,
  updated_at timestamptz not null default now()
);
alter table public.password_credentials enable row level security;

-- Failed sign-in attempts, for throttling password guessing.
create table if not exists public.auth_failures (
  id bigserial primary key,
  email text not null,
  created_at timestamptz not null default now()
);
create index if not exists auth_failures_email_created_idx on public.auth_failures (email, created_at desc);
alter table public.auth_failures enable row level security;
