-- Prevent the anon-table-grant / anon-execute-grant problem from silently
-- recurring on every future new table/function: change the project's
-- default privileges so anon no longer automatically gets table access or
-- function EXECUTE on objects created by postgres (the role this app's
-- own migrations run as). authenticated's defaults are untouched - the
-- app's whole RLS model assumes authenticated has broad table grants
-- gated by policy, same as it already does today.
--
-- Could not also change supabase_admin's defaults (insufficient
-- privilege - "permission denied to change default privileges"); that
-- default ACL is Supabase-internal tooling, not something this app's own
-- migrations exercise.
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke execute on functions from anon;
