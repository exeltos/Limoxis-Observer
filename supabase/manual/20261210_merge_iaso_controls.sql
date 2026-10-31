-- ΙΑΣΩ ΘΕΣΣΑΛΙΑΣ: συγχώνευση των ελέγχων που το FileMaker έσπασε ανά τμήμα/πρόγραμμα.
-- Τρέχει ΜΟΝΟ από τον ιδιοκτήτη στο SQL Editor (περιέχει delete). Όλα γίνονται σε μία συναλλαγή:
-- αν κάποιος έλεγχος αποτύχει, δεν αλλάζει τίποτα.
--
-- Τι κάνει:
--  1. Μετονομάζει τους ελέγχους που ονομάζονταν ίδια αλλά είναι διαφορετικοί
--     (Έλεγχος ναρκωτικών · ποσότητα / · λήξεις, Θερμοκρασία χώρου · 21–24 °C / · 15–25 °C).
--  2. Βρίσκει τους ελέγχους με ίδιο όνομα (χωρίς τόνους/κεφαλαία), ίδιο είδος και ίδιο τρόπο καταχώρησης
--     και τους συγχωνεύει σε έναν (μένει αυτός με τον μικρότερο κωδικό FM-CTRL-…).
--  3. Μεταφέρει σε αυτόν τις αντιστοιχίσεις τμημάτων, τις εκτελέσεις και τα προσχέδια. Όπου το πρόγραμμα
--     (συχνότητα/ώρες) διέφερε, το τμήμα κρατά το δικό του πρόγραμμα (control_assignments.frequency_config).
--  4. Ελέγχει ότι δεν χάθηκε εκτέλεση ή αντιστοίχιση και μετά σβήνει τους κενούς διπλούς ελέγχους.
--
-- Μετά το τρέξιμο ελέγχω εγώ με ερώτημα μόνο ανάγνωσης.

begin;
-- Οι έλεγχοι ξένων κλειδιών και τα triggers δεν ενεργοποιούνται για αυτή τη συναλλαγή: οι μεταφορές
-- δεν πρέπει να δημιουργήσουν νέες αναθεωρήσεις εκτελέσεων ούτε να ξαναϋπολογίσουν προθεσμίες.
set local session_replication_role = replica;

-- 1. Μετονομασίες (τίτλος και αγγλικός τίτλος)
with names(code, title) as (values
  ('FM-CTRL-0114', 'Έλεγχος ναρκωτικών · ποσότητα'),
  ('FM-CTRL-0123', 'Έλεγχος ναρκωτικών · λήξεις'),
  ('FM-CTRL-0124', 'Έλεγχος ναρκωτικών · λήξεις'),
  ('FM-CTRL-1269', 'Έλεγχος ναρκωτικών · λήξεις'),
  ('FM-CTRL-0003', 'Θερμοκρασία χώρου · 21–24 °C'),
  ('FM-CTRL-0007', 'Θερμοκρασία χώρου · 15–25 °C'),
  ('FM-CTRL-0063', 'Θερμοκρασία χώρου · 15–25 °C')
)
update public.control_definitions d
set title = n.title,
    response_config = jsonb_set(d.response_config, '{__meta,titleEn}', to_jsonb(n.title::text), true)
from names n
where d.organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd' and d.code = n.code;

-- 2. Ποιος έλεγχος μένει και ποιοι συγχωνεύονται σε αυτόν
create temp table merge_map on commit drop as
with c as (
  select d.id, d.code, d.frequency_config,
         lower(regexp_replace(translate(trim(d.title), 'άέήίόύώΐΰϊϋ', 'αεηιουωιυιυ'), '[^[:alnum:]α-ω]+', '', 'g')) as k,
         d.category, (d.response_config #- '{__meta,titleEn}') as r
  from public.control_definitions d
  where d.organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd'
), g as (
  select c.*, first_value(c.id) over w as s_id, first_value(c.code) over w as s_code,
         count(*) over (partition by c.k, c.category, c.r) as n
  from c
  window w as (partition by c.k, c.category, c.r order by c.code)
)
select g.id as dup_id, g.code as dup_code, g.s_id, g.s_code, g.frequency_config
from g where g.n > 1 and g.id <> g.s_id;

create temp table before_counts on commit drop as
select (select count(*) from public.control_assignments where organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd') as assignments,
       (select count(*) from public.control_executions where organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd') as executions,
       (select count(*) from public.control_definitions where organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd') as definitions,
       (select count(*) from merge_map) as merged;

-- 3. Μεταφορά: αντιστοιχίσεις (με το δικό τους πρόγραμμα όπου διέφερε), εκτελέσεις, προσχέδια
update public.control_assignments a
set control_id = m.s_id,
    frequency_config = case when m.frequency_config is distinct from sd.frequency_config then m.frequency_config else a.frequency_config end
from merge_map m
join public.control_definitions sd on sd.id = m.s_id
where a.control_id = m.dup_id;

update public.control_executions e set control_id = m.s_id from merge_map m where e.control_id = m.dup_id;

update public.control_drafts x set control_id = m.s_code
from merge_map m
where x.control_id = m.dup_code and x.organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd';

-- 4. Έλεγχοι πριν σβηστούν οι διπλοί
do $$
declare
  v_before record;
  v_left_assignments bigint; v_left_executions bigint; v_left_drafts bigint;
  v_assignments bigint; v_executions bigint; v_orphans bigint; v_dup_assignees bigint;
begin
  select * into v_before from before_counts;
  select count(*) into v_left_assignments from public.control_assignments where control_id in (select dup_id from merge_map);
  select count(*) into v_left_executions from public.control_executions where control_id in (select dup_id from merge_map);
  select count(*) into v_left_drafts from public.control_drafts where control_id in (select dup_code from merge_map);
  select count(*) into v_assignments from public.control_assignments where organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd';
  select count(*) into v_executions from public.control_executions where organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd';
  select count(*) into v_orphans from public.control_executions e
    where e.organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd'
      and not exists (select 1 from public.control_assignments a
                      where a.id = e.assignment_id and a.control_id = e.control_id and a.department_id = e.department_id);
  select count(*) into v_dup_assignees from merge_map m join public.control_definitions dup on dup.id = m.dup_id
    where jsonb_typeof(dup.response_config #> '{__meta,assignees}') = 'object' and dup.response_config #> '{__meta,assignees}' <> '{}'::jsonb;
  if v_left_assignments <> 0 or v_left_executions <> 0 or v_left_drafts <> 0 then
    raise exception 'Έμειναν δεδομένα στους διπλούς ελέγχους (αντιστοιχίσεις %, εκτελέσεις %, προσχέδια %)', v_left_assignments, v_left_executions, v_left_drafts;
  end if;
  if v_assignments <> v_before.assignments or v_executions <> v_before.executions then
    raise exception 'Άλλαξε το πλήθος αντιστοιχίσεων/εκτελέσεων (% → %, % → %)', v_before.assignments, v_assignments, v_before.executions, v_executions;
  end if;
  if v_orphans <> 0 then raise exception '% εκτελέσεις δεν δείχνουν σε αντιστοίχιση του ελέγχου τους', v_orphans; end if;
  if v_dup_assignees <> 0 then raise exception '% διπλοί έλεγχοι έχουν υπευθύνους ανά τμήμα: δεν συγχωνεύονται αυτόματα, πείτε το στον Claude', v_dup_assignees; end if;
end $$;

-- 5. Σβήνονται μόνο οι διπλοί που άδειασαν
delete from public.control_definitions where id in (select dup_id from merge_map);

-- Σύνοψη
select (select merged from before_counts) as ελεγχοι_που_συγχωνευθηκαν,
       (select definitions from before_counts) as ελεγχοι_πριν,
       (select count(*) from public.control_definitions where organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd') as ελεγχοι_μετα,
       (select assignments from before_counts) as αντιστοιχισεις,
       (select executions from before_counts) as εκτελεσεις;
commit;
