-- PostgREST only exposes tables to the Data API when anon/authenticated/service_role
-- have privileges. Without this, clients get PGRST205 ("not in schema cache").

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on table public.profiles to anon, authenticated, service_role;
grant select, insert, update, delete on table public.ai_messages to anon, authenticated, service_role;
grant select, insert, update, delete on table public.conversations to anon, authenticated, service_role;
grant select, insert, update, delete on table public.messages to anon, authenticated, service_role;
grant select, insert, update, delete on table public.match_skips to anon, authenticated, service_role;

notify pgrst, 'reload schema';
