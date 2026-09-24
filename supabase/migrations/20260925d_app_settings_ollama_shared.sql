-- Site-wide settings readable by the browser (only whitelisted keys), and server-only secrets.
create table if not exists public.app_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
drop policy if exists app_settings_public_read on public.app_settings;
create policy app_settings_public_read on public.app_settings for select using (key in ('ollama_server_url'));

-- No policies: only Edge Functions (service role) can read these.
create table if not exists public.app_secrets (
  key text primary key,
  value text not null,
  created_at timestamptz not null default now()
);
alter table public.app_secrets enable row level security;
-- The laptop tunnel script's key is generated here, never committed:
-- insert into public.app_secrets (key, value) values ('ollama_register_key', encode(gen_random_bytes(24), 'hex')) on conflict (key) do nothing;
