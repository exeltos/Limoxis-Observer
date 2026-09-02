-- RLS already restricts organization mutations to current_user_is_platform_owner().
-- The authenticated role still needs table-level DML privileges for those policies
-- to be reachable through PostgREST.
grant insert, update, delete on table public.organizations to authenticated;
