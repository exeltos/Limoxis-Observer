-- Limoxis Observer Supabase cleanup — compact READ-ONLY manifest.
-- Use this when the full inventory JSON is too large to copy into a review thread.
-- It returns names/signatures only; no policy expressions or function bodies.
with
relations as (
  select coalesce(jsonb_agg(format('%I.%I|%s|rows~%s',n.nspname,c.relname,
    case c.relkind when 'r' then 'table' when 'p' then 'partitioned_table'
      when 'v' then 'view' when 'm' then 'materialized_view'
      when 'S' then 'sequence' else c.relkind::text end,
    c.reltuples::bigint) order by n.nspname,c.relname),'[]'::jsonb) as value
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname in ('public','storage') and c.relkind in ('r','p','v','m','S')
),
policies as (
  select coalesce(jsonb_agg(format('%I.%I|%I|%s',schemaname,tablename,policyname,cmd)
    order by schemaname,tablename,policyname),'[]'::jsonb) as value
  from pg_policies where schemaname in ('public','storage')
),
functions as (
  select coalesce(jsonb_agg(format('%I.%I(%s)|security_definer=%s',n.nspname,p.proname,
    pg_get_function_identity_arguments(p.oid),p.prosecdef)
    order by p.proname,pg_get_function_identity_arguments(p.oid)),'[]'::jsonb) as value
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
),
triggers as (
  select coalesce(jsonb_agg(format('%I.%I|%I',event_object_schema,event_object_table,trigger_name)
    order by event_object_schema,event_object_table,trigger_name),'[]'::jsonb) as value
  from information_schema.triggers
  where event_object_schema in ('public','storage')
),
foreign_keys as (
  select coalesce(jsonb_agg(format('%I.%I|%I',ns.nspname,child.relname,con.conname)
    order by child.relname,con.conname),'[]'::jsonb) as value
  from pg_constraint con
  join pg_class child on child.oid=con.conrelid
  join pg_namespace ns on ns.oid=child.relnamespace
  where con.contype='f' and ns.nspname='public'
),
buckets as (
  select coalesce(jsonb_agg(format('%s|public=%s',id,public) order by id),'[]'::jsonb) as value
  from storage.buckets
)
select jsonb_build_object(
  'relations',relations.value,
  'policies',policies.value,
  'functions',functions.value,
  'triggers',triggers.value,
  'foreign_keys',foreign_keys.value,
  'storage_buckets',buckets.value,
  'note','Names only. Use 00_preflight_inventory.sql for definitions of objects selected for KEEP.'
) as compact_manifest
from relations,policies,functions,triggers,foreign_keys,buckets;
