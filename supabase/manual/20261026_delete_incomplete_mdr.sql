-- ΙΑΣΩ ΘΕΣΣΑΛΙΑΣ: σβήνονται τα πολυανθεκτικά ασθενών που δεν έχουν μικρόβιο ή σωστό είδος δείγματος
-- και το είδος «Δείγμα επιτήρησης». Τρέχει ΜΟΝΟ από τον ιδιοκτήτη στο SQL Editor (περιέχει delete).
-- Μένουν μόνο ολοκληρωμένα πολυανθεκτικά (μικρόβιο + είδος δείγματος). Τα νέα θα τα δώσει το Εργαστήριο.
-- ΔΕΝ αγγίζονται: οι υπόλοιπες καλλιέργειες ασθενών, τα δείγματα χώρων/περιβάλλοντος και προσωπικού.
-- Αν οποιοσδήποτε έλεγχος αποτύχει, δεν αλλάζει τίποτα.

begin;
select set_config('request.jwt.claims', '{"sub":"84066ee0-57b7-4cae-9186-09e491d3ea6d","role":"authenticated"}', true);

create temp table doomed on commit drop as
select s.id
from public.laboratory_samples s
join public.microbiology_results r on r.sample_id = s.id
 and not exists (select 1 from public.microbiology_results y where y.amended_from = r.id)
left join public.master_library_items m on m.id = s.specimen_type_id
where s.organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd' and s.subject_type = 'patient'
  and coalesce(r.resistance_class, '') = 'MDR'
  and (coalesce(r.organism, '') = '' or s.specimen_type_id is null or m.code = 'SAMPLE-SURVEILLANCE');

create temp table before_counts on commit drop as
select (select count(*) from public.laboratory_samples where organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd') as samples,
       (select count(*) from public.laboratory_samples where organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd' and subject_type <> 'patient') as non_patient,
       (select count(distinct id) from doomed) as doomed;

do $$
declare v bigint;
begin
  select doomed into v from before_counts;
  if v <> 57 then raise exception 'Βρέθηκαν % ελλιπή πολυανθεκτικά αντί για 57', v; end if;
end $$;

delete from public.laboratory_samples where id in (select id from doomed);

delete from public.master_library_items
where organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd' and code = 'SAMPLE-SURVEILLANCE';

do $$
declare v_before record; v bigint;
begin
  select * into v_before from before_counts;
  select count(*) into v from public.laboratory_samples where organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd';
  if v <> v_before.samples - v_before.doomed then raise exception 'Σβήστηκαν % αντί για %', v_before.samples - v, v_before.doomed; end if;
  select count(*) into v from public.laboratory_samples where organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd' and subject_type <> 'patient';
  if v <> v_before.non_patient then raise exception 'Άλλαξαν δείγματα εκτός ασθενών'; end if;
  select count(*) into v from public.laboratory_samples
   where organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd' and (sample_type = 'surveillanceSpecimen' or source_site ilike '%επιτήρησης%');
  if v <> 0 then raise exception 'Έμειναν % δείγματα «Δείγμα επιτήρησης»', v; end if;
end $$;

-- Σύνοψη: ολοκληρωμένα πολυανθεκτικά που μένουν ανά έτος
select extract(year from s.collected_at at time zone 'Europe/Athens')::int as ετος,
       count(*) as καλλιεργειες_ασθενων,
       count(*) filter (where r.resistance_class = 'MDR') as πολυανθεκτικα
from public.laboratory_samples s
join public.microbiology_results r on r.sample_id = s.id
 and not exists (select 1 from public.microbiology_results y where y.amended_from = r.id)
where s.organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd' and s.subject_type = 'patient'
group by 1 order by 1;
commit;
