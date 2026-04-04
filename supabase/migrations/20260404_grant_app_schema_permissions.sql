-- Fix permission error: "permission denied for schema app"
-- Required because RLS policies and helper functions call app.* functions.

grant usage on schema app to anon, authenticated, service_role;

grant execute on all functions in schema app to anon, authenticated, service_role;

alter default privileges in schema app
grant execute on functions to anon, authenticated, service_role;
