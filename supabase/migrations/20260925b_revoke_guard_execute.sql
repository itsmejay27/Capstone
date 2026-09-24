-- The trigger function must not be callable directly through the REST API.
revoke execute on function public.guard_email_verified() from public, anon, authenticated;
