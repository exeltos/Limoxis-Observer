-- Limoxis Observer Supabase cleanup — phase 0 (READ ONLY)
-- Run this entire file in the Supabase SQL Editor. It returns ONE JSON result so
-- hosted SQL Editor clients that display only the final result do not hide earlier grids.
-- Copy the value of `inventory` and send it for KEEP / REPLACE / UNKNOWN review.

with
relations as (
  select coalesce(jsonb_agg(to_jsonb(x) order by x.schema_name,x.relation_type,x.relation_name),'[]'::jsonb) as value
  from (
    select n.nspname as schema_name,c.relname as relation_name,
      case c.relkind when 'r' then 'table' when 'p' then 'partitioned_table'
        when 'v' then 'view' when 'm' then 'materialized_view'
        when 'S' then 'sequence' else c.relkind::text end as relation_type,
      c.reltuples::bigint as estimated_rows,
      pg_size_pretty(pg_total_relation_size(c.oid)) as total_size,
      c.relrowsecurity as rls_enabled,c.relforcerowsecurity as rls_forced
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in ('public','storage') and c.relkind in ('r','p','v','m','S')
  ) x
),
policies as (
  select coalesce(jsonb_agg(to_jsonb(x) order by x.schema_name,x.table_name,x.policy_name),'[]'::jsonb) as value
  from (
    select schemaname as schema_name,tablename as table_name,policyname as policy_name,
      permissive,roles,cmd,qual as using_expression,with_check as check_expression
    from pg_policies where schemaname in ('public','storage')
  ) x
),
functions as (
  select coalesce(jsonb_agg(to_jsonb(x) order by x.function_name,x.identity_arguments),'[]'::jsonb) as value
  from (
    select n.nspname as schema_name,p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as identity_arguments,
      pg_get_function_result(p.oid) as result_type,l.lanname as language,
      p.prosecdef as security_definer,pg_get_userbyid(p.proowner) as owner,
      obj_description(p.oid,'pg_proc') as description
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    join pg_language l on l.oid=p.prolang
    where n.nspname='public'
  ) x
),
triggers as (
  select coalesce(jsonb_agg(to_jsonb(x) order by x.schema_name,x.table_name,x.trigger_name),'[]'::jsonb) as value
  from (
    select event_object_schema as schema_name,event_object_table as table_name,
      trigger_name,action_timing,
      string_agg(event_manipulation,',' order by event_manipulation) as events,
      action_statement
    from information_schema.triggers
    where event_object_schema in ('public','storage')
    group by event_object_schema,event_object_table,trigger_name,action_timing,action_statement
  ) x
),
foreign_keys as (
  select coalesce(jsonb_agg(to_jsonb(x) order by x.table_name,x.constraint_name),'[]'::jsonb) as value
  from (
    select ns.nspname as schema_name,child.relname as table_name,
      con.conname as constraint_name,pg_get_constraintdef(con.oid,true) as definition
    from pg_constraint con
    join pg_class child on child.oid=con.conrelid
    join pg_namespace ns on ns.oid=child.relnamespace
    where con.contype='f' and ns.nspname='public'
  ) x
),
buckets as (
  select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) as value
  from (
    select id,name,public,file_size_limit,allowed_mime_types,created_at,updated_at
    from storage.buckets
  ) x
),
migration_history as (
  select jsonb_build_object(
    'relation',to_regclass('supabase_migrations.schema_migrations'),
    'status',case when to_regclass('supabase_migrations.schema_migrations') is null
      then 'not available — valid for projects created outside the CLI migration flow'
      else 'available — export separately only if required' end
  ) as value
)
select jsonb_build_object(
  'relations',relations.value,
  'policies',policies.value,
  'functions',functions.value,
  'triggers',triggers.value,
  'foreign_keys',foreign_keys.value,
  'storage_buckets',buckets.value,
  'migration_history',migration_history.value
) as inventory
from relations,policies,functions,triggers,foreign_keys,buckets,migration_history;
