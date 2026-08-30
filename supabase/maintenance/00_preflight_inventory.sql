-- Limoxis Observer Supabase cleanup — phase 0 (READ ONLY)
-- Run this entire file in the Supabase SQL Editor and export/copy every result grid.
-- It intentionally performs no writes and is safe to run before we agree the cleanup allowlist.

-- 1. Application relations and approximate row counts.
select
  n.nspname as schema_name,
  c.relname as relation_name,
  case c.relkind
    when 'r' then 'table'
    when 'p' then 'partitioned_table'
    when 'v' then 'view'
    when 'm' then 'materialized_view'
    when 'S' then 'sequence'
    else c.relkind::text
  end as relation_type,
  c.reltuples::bigint as estimated_rows,
  pg_size_pretty(pg_total_relation_size(c.oid)) as total_size,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname in ('public','storage')
  and c.relkind in ('r','p','v','m','S')
order by n.nspname,c.relkind,c.relname;

-- 2. Every RLS policy, including storage policies.
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expression,
  with_check as check_expression
from pg_policies
where schemaname in ('public','storage')
order by schemaname,tablename,policyname;

-- 3. Public functions. Keep the identity arguments: overloaded functions may share a name.
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as identity_arguments,
  pg_get_function_result(p.oid) as result_type,
  l.lanname as language,
  p.prosecdef as security_definer,
  pg_get_userbyid(p.proowner) as owner,
  obj_description(p.oid,'pg_proc') as description
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
join pg_language l on l.oid=p.prolang
where n.nspname='public'
order by p.proname,identity_arguments;

-- 4. Non-internal triggers and the functions they execute.
select
  event_object_schema as schema_name,
  event_object_table as table_name,
  trigger_name,
  action_timing,
  string_agg(event_manipulation,',' order by event_manipulation) as events,
  action_statement
from information_schema.triggers
where event_object_schema in ('public','storage')
group by event_object_schema,event_object_table,trigger_name,action_timing,action_statement
order by event_object_schema,event_object_table,trigger_name;

-- 5. Foreign keys. This determines the only safe drop order.
select
  ns.nspname as schema_name,
  child.relname as table_name,
  con.conname as constraint_name,
  pg_get_constraintdef(con.oid,true) as definition
from pg_constraint con
join pg_class child on child.oid=con.conrelid
join pg_namespace ns on ns.oid=child.relnamespace
where con.contype='f' and ns.nspname='public'
order by child.relname,con.conname;

-- 6. Storage buckets are data boundaries and must be reviewed separately from SQL tables.
select id,name,public,file_size_limit,allowed_mime_types,created_at,updated_at
from storage.buckets
order by id;

-- 7. Migration-history availability. Some hosted projects do not expose or create
-- this relation, so the read-only preflight must not query it directly.
select
  to_regclass('supabase_migrations.schema_migrations') as migration_history_relation,
  case
    when to_regclass('supabase_migrations.schema_migrations') is null
      then 'not available — this is valid for projects created outside the CLI migration flow'
    else 'available — export it separately after the inventory if required'
  end as migration_history_status;
