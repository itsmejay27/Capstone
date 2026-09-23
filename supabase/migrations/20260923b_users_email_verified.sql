-- Email verification on first sign-in.
-- Existing accounts are grandfathered as verified; new accounts start unverified and are
-- only flipped by the email-otp Edge Function (service role) after a correct code.
alter table public.users add column if not exists email_verified boolean not null default false;
update public.users set email_verified = true;

-- The browser's key can upsert users, so it must not be able to mark itself verified.
create or replace function public.guard_email_verified() returns trigger
language plpgsql as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    if tg_op = 'INSERT' then
      new.email_verified := false;
    else
      new.email_verified := old.email_verified;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists users_guard_email_verified on public.users;
create trigger users_guard_email_verified
  before insert or update on public.users
  for each row execute function public.guard_email_verified();

-- A code can be verified before the account row exists (first sign-in by email code), so
-- verified addresses are also recorded here and applied when the row is created.
create table if not exists public.verified_emails (
  email text primary key,
  verified_at timestamptz not null default now()
);
alter table public.verified_emails enable row level security;

create or replace function public.guard_email_verified() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  proven boolean := exists (select 1 from public.verified_emails v where v.email = lower(new.email));
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    if tg_op = 'INSERT' then
      new.email_verified := proven;
    else
      new.email_verified := old.email_verified or proven;
    end if;
  end if;
  return new;
end $$;
