-- Every PL/pgSQL function in public and private is checked with plpgsql_check,
-- which finds what only fails when a function runs: a column or table that does
-- not exist, a wrong type, a misspelled variable. (Three settings RPCs once
-- wrote system_audit_log.action, a column that never existed, and every save
-- failed; see 20261026110000_fix_organization_settings_audit_column.sql.)
--
-- Everything runs inside one DO block that always ends by raising an exception,
-- so the extension is installed only for the duration of the check and nothing
-- stays in the database. The exception message carries the result:
--   PLPGSQL_CHECK_PASS <json>  no function has an error
--   PLPGSQL_CHECK_FAIL <json>  the errors listed under "errors"
-- Trigger functions are checked against a table they are attached to (with its transition
-- tables, for statement triggers); a trigger function attached to none is skipped.
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=0 -f supabase/tests/plpgsql_functions_check.sql
do $check$
declare
  r record; e record;
  checked int := 0; skipped int := 0;
  errors jsonb := '[]'::jsonb;
begin
  perform set_config('statement_timeout', '120s', true);
  create extension if not exists plpgsql_check;
  for r in
    select p.oid, n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as signature,
      p.prorettype = 'trigger'::regtype as is_trigger,
      t.tgrelid as relid, t.tgoldtable as oldtable, t.tgnewtable as newtable
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    -- The trigger with the most transition tables, so a statement trigger's «referencing … table» names are known.
    left join lateral (select t.tgrelid, t.tgoldtable, t.tgnewtable from pg_trigger t where t.tgfoid = p.oid
      order by (t.tgoldtable is not null)::int + (t.tgnewtable is not null)::int desc limit 1) t on true
    where n.nspname in ('public', 'private') and p.prokind = 'f'
      and p.prolang = (select oid from pg_language where lanname = 'plpgsql')
    order by 2
  loop
    if r.is_trigger and r.relid is null then skipped := skipped + 1; continue; end if;
    checked := checked + 1;
    for e in select * from plpgsql_check_function_tb(r.oid, coalesce(r.relid, 0), oldtable => r.oldtable, newtable => r.newtable) where level = 'error' loop
      errors := errors || jsonb_build_object('function', r.signature, 'line', e.lineno, 'message', e.message);
    end loop;
  end loop;
  if jsonb_array_length(errors) = 0 then
    raise exception 'PLPGSQL_CHECK_PASS %', jsonb_build_object('checked', checked, 'skipped', skipped);
  end if;
  raise exception 'PLPGSQL_CHECK_FAIL %', jsonb_build_object('checked', checked, 'skipped', skipped, 'errors', errors);
end $check$;
