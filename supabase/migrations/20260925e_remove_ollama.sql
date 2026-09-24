-- The Ollama feature was removed: drop its shared address, key and per-user address.
drop table if exists public.app_settings;
drop table if exists public.app_secrets;
alter table public.users drop column if exists ollama_server_url;
