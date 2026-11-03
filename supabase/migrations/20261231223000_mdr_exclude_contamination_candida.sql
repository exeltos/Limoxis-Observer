-- Οι απομονώσεις MDR και οι βακτηριαιμίες από πολυανθεκτικά δεν μετρούν δείγματα «επιμόλυνσης»
-- (πολλαπλά είδη μικροβίων) ούτε αποτελέσματα όπου το μόνο που αναπτύχθηκε είναι Candida.
create or replace function private.mdr_excluded_organism(p_organism text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(p_organism, '') ~* '(επιμόλυνση|επιμολυνση|contaminat|3\s+είδ|3\s+ειδ)'
    or coalesce(p_organism, '') ~* '^\s*candida[^,]*$'
$$;

do $$
declare
  v_def text := pg_get_functiondef('private.indicator_metric_snapshot(uuid,date,date,uuid)'::regprocedure);
  v_old text := E'\n    and (upper(coalesce(m.resistance_class,\'\'))';
  v_new text := E'\n    and not private.mdr_excluded_organism(m.organism)\n    and (upper(coalesce(m.resistance_class,\'\'))';
  v_count int;
begin
  if position('private.mdr_excluded_organism' in v_def) > 0 then return; end if;
  v_count := (length(v_def) - length(replace(v_def, v_old, ''))) / length(v_old);
  if v_count <> 2 then raise exception 'expected 2 MDR conditions, found %', v_count; end if;
  execute replace(v_def, v_old, v_new);
end $$;
