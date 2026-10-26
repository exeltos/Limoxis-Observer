-- ΙΑΣΩ ΘΕΣΣΑΛΙΑΣ: το «Τροχήλατο ΚΑΡΠΑ» της Παιδιατρικής (FM-CTRL-1397) περνά στο κοινό «Τροχήλατο ΚΑΡΠΑ» (FM-CTRL-0145).
-- Τρέχει ΜΟΝΟ από τον ιδιοκτήτη στο SQL Editor (περιέχει delete). Έχουν την ίδια λίστα φαρμάκων/υλικών και τις ίδιες ενέργειες.
-- Η Παιδιατρική κρατά το δικό της πρόγραμμα (μία φορά την ημέρα) και τις 38 εκτελέσεις της. Ο παιδιατρικός δίσκος διασωλήνωσης
-- θα έρθει ως ξεχωριστός έλεγχος όταν υπάρξει το έντυπό του.
begin;
set local session_replication_role = replica;

create temp table merge_pairs(dup_code text, s_code text) on commit drop;
insert into merge_pairs values
  ('FM-CTRL-1397', 'FM-CTRL-0145');

create temp table merge_map on commit drop as
select dup.id as dup_id, dup.code as dup_code, sv.id as s_id, sv.code as s_code,
       dup.frequency_config as dup_frequency, sv.frequency_config as s_frequency,
       dup.response_config as dup_rc, sv.response_config as s_rc
from merge_pairs p
join public.control_definitions dup on dup.code = p.dup_code and dup.organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd'
join public.control_definitions sv on sv.code = p.s_code and sv.organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd';

-- Έλεγχοι πριν τη μεταφορά
do $$
declare v_pairs bigint; v_other bigint; v_shared bigint;
begin
  select count(*) into v_pairs from merge_map;
  if v_pairs <> 1 then raise exception 'Βρέθηκαν % ζεύγη αντί για 1', v_pairs; end if;
  select count(*) into v_other from merge_map
   where (dup_rc #- '{__meta}' #- '{min}' #- '{max}' #- '{deviationActions}')
         is distinct from (s_rc #- '{__meta}' #- '{min}' #- '{max}' #- '{deviationActions}')
      or (select category from public.control_definitions where id = dup_id) is distinct from (select category from public.control_definitions where id = s_id);
  if v_other <> 0 then raise exception '% ζεύγη διαφέρουν και σε κάτι άλλο εκτός από όρια/ενέργειες', v_other; end if;
  select count(*) into v_shared from merge_map m
   join public.control_assignments a1 on a1.control_id = m.dup_id
   join public.control_assignments a2 on a2.control_id = m.s_id and a2.department_id = a1.department_id;
  select v_shared + count(*) into v_shared from merge_map a join merge_map b on a.s_id = b.s_id and a.dup_id < b.dup_id
   join public.control_assignments x on x.control_id = a.dup_id
   join public.control_assignments y on y.control_id = b.dup_id and y.department_id = x.department_id;
  if v_shared <> 0 then raise exception '% τμήματα υπάρχουν σε περισσότερους από έναν ελέγχους που ενώνονται', v_shared; end if;
end $$;

create temp table before_counts on commit drop as
select (select count(*) from public.control_assignments where organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd') as assignments,
       (select count(*) from public.control_executions where organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd') as executions,
       (select count(*) from public.control_definitions where organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd') as definitions;

-- Το ίδιο «Θερμοκρασία χώρου» για όλα τα τμήματα (τα όρια ανά τμήμα μπαίνουν παρακάτω)
-- Μεταφορά αντιστοιχίσεων με ό,τι διέφερε: όρια/κείμενο (response_override) και πρόγραμμα (frequency_config)
update public.control_assignments a
set control_id = m.s_id,
    response_override = nullif(jsonb_strip_nulls(jsonb_build_object(
      'min',  case when (m.dup_rc->'min')  is distinct from (m.s_rc->'min')  then coalesce(m.dup_rc->'min',  '""'::jsonb) end,
      'max',  case when (m.dup_rc->'max')  is distinct from (m.s_rc->'max')  then coalesce(m.dup_rc->'max',  '""'::jsonb) end,
      'deviationActions', case when coalesce(m.dup_rc->>'deviationActions','') is distinct from coalesce(m.s_rc->>'deviationActions','')
                               then m.dup_rc->'deviationActions' end)), '{}'::jsonb),
    frequency_config = coalesce(a.frequency_config, case when m.dup_frequency is distinct from m.s_frequency then m.dup_frequency end)
from merge_map m
where a.control_id = m.dup_id;

update public.control_executions e set control_id = m.s_id from merge_map m where e.control_id = m.dup_id;

update public.control_drafts x set control_id = m.s_code
from merge_map m
where x.control_id = m.dup_code and x.organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd';

-- Έλεγχοι πριν σβηστούν οι διπλοί
do $$
declare
  v_before record; v_left bigint; v_assignments bigint; v_executions bigint; v_orphans bigint; v_assignees bigint;
begin
  select * into v_before from before_counts;
  select (select count(*) from public.control_assignments where control_id in (select dup_id from merge_map))
       + (select count(*) from public.control_executions where control_id in (select dup_id from merge_map))
       + (select count(*) from public.control_drafts where control_id in (select dup_code from merge_map))
    into v_left;
  select count(*) into v_assignments from public.control_assignments where organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd';
  select count(*) into v_executions from public.control_executions where organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd';
  select count(*) into v_orphans from public.control_executions e
    where e.organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd'
      and not exists (select 1 from public.control_assignments a
                      where a.id = e.assignment_id and a.control_id = e.control_id and a.department_id = e.department_id);
  select count(*) into v_assignees from merge_map m join public.control_definitions dup on dup.id = m.dup_id
    where jsonb_typeof(dup.response_config #> '{__meta,assignees}') = 'object' and dup.response_config #> '{__meta,assignees}' <> '{}'::jsonb;
  if v_left <> 0 then raise exception 'Έμειναν δεδομένα στους διπλούς ελέγχους (%)', v_left; end if;
  if v_assignments <> v_before.assignments or v_executions <> v_before.executions then
    raise exception 'Άλλαξε το πλήθος αντιστοιχίσεων/εκτελέσεων (% → %, % → %)', v_before.assignments, v_assignments, v_before.executions, v_executions;
  end if;
  if v_orphans <> 0 then raise exception '% εκτελέσεις δεν δείχνουν σε αντιστοίχιση του ελέγχου τους', v_orphans; end if;
  if v_assignees <> 0 then raise exception '% διπλοί έλεγχοι έχουν υπευθύνους ανά τμήμα: δεν συγχωνεύονται αυτόματα', v_assignees; end if;
end $$;

delete from public.control_definitions where id in (select dup_id from merge_map);

select (select count(*) from merge_pairs) as ελεγχοι_που_συγχωνευθηκαν,
       (select definitions from before_counts) as ελεγχοι_πριν,
       (select count(*) from public.control_definitions where organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd') as ελεγχοι_μετα,
       (select assignments from before_counts) as αντιστοιχισεις,
       (select executions from before_counts) as εκτελεσεις;
commit;
