-- ΙΑΣΩ ΘΕΣΣΑΛΙΑΣ: καθαρισμός καλλιεργειών ασθενών. Τρέχει ΜΟΝΟ από τον ιδιοκτήτη στο SQL Editor (περιέχει delete).
-- Κανόνας του ιδιοκτήτη: μένουν οι καλλιέργειες 2024–2026 που κλείνουν ολοκληρωμένο φάκελο ασθενούς
-- (μικρόβιο + είδος δείγματος) και τα πολυανθεκτικά που θα συμπληρώσει το Εργαστήριο· όλα τα υπόλοιπα σβήνονται.
--
-- Σβήνονται:
--   1. οι καλλιέργειες ασθενών του 2023 (εκτός της περιόδου 2024–2026),
--   2. οι ελλιπείς καλλιέργειες που ΔΕΝ είναι πολυανθεκτικές (χωρίς μικρόβιο ή χωρίς είδος δείγματος),
--   3. τα διπλά του 2026: ίδια καλλιέργεια στο report του Εργαστηρίου και στη δεύτερη εισαγωγή 2026 (ίδιος αρ. φακέλου,
--      ±3 ημέρες)· σβήνεται το αντίγραφο με τα λιγότερα στοιχεία (σε ισοπαλία, της δεύτερης εισαγωγής)· ποτέ το πολυανθεκτικό.
-- ΔΕΝ αγγίζονται: τα περιβαλλοντικά δείγματα, τα δείγματα προσωπικού, οι ασθενείς, οι νοσηλείες και τα περιστατικά επιτήρησης.
-- Μαζί με κάθε δείγμα σβήνονται (cascade) τα αποτελέσματα, οι οργανισμοί και τα αντιβιογράμματά του. Το clinical audit
-- κρατά αντίγραφο κάθε γραμμής που σβήνεται. Αν οποιοσδήποτε έλεγχος αποτύχει, δεν αλλάζει τίποτα.

begin;

create temp table cult on commit drop as
select s.id, s.sample_code, s.subject_code,
       (s.collected_at at time zone 'Europe/Athens')::date as d,
       extract(year from s.collected_at at time zone 'Europe/Athens')::int as yr,
       case when s.clinical_context->>'source' = 'hospital_lis_pdf_2024_2026' then 'PDF'
            when s.sample_code like 'LIS26-%' then 'LIS26'
            when s.sample_code like 'LAB-%' then 'FM' else 'OTHER' end as origin,
       (coalesce(r.organism, '') <> '' and s.specimen_type_id is not null
        and (coalesce(s.clinical_context->>'specimen_mapping_status', '') not ilike '%unresolved%' or coalesce(s.source_site, '') <> '')) as complete,
       coalesce(r.resistance_class, '') = 'MDR' as mdr
from public.laboratory_samples s
join public.microbiology_results r on r.sample_id = s.id
 and not exists (select 1 from public.microbiology_results y where y.amended_from = r.id)
where s.organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd' and s.subject_type = 'patient';

create temp table doomed(id uuid primary key, reason text) on commit drop;

insert into doomed select id, 'έτος 2023' from cult where yr < 2024 on conflict do nothing;
insert into doomed select id, 'ελλιπής, όχι πολυανθεκτική' from cult where not complete and not mdr on conflict do nothing;
insert into doomed
select distinct case when (l.complete and not p.complete and not p.mdr) then p.id else l.id end, 'διπλή 2026'
from cult l join cult p on l.origin = 'LIS26' and p.origin = 'PDF' and l.subject_code = p.subject_code and abs(l.d - p.d) <= 3
on conflict do nothing;

create temp table before_counts on commit drop as
select (select count(*) from public.laboratory_samples where organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd') as samples,
       (select count(*) from public.laboratory_samples where organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd' and subject_type <> 'patient') as non_patient,
       (select count(*) from doomed) as doomed;

-- Έλεγχοι πριν: τίποτα εκτός ασθενών, κανένα πολυανθεκτικό 2024–2026 και καμία πλήρης καλλιέργεια (εκτός διπλών/2023)
do $$
declare v_bad bigint;
begin
  select count(*) into v_bad from doomed d join public.laboratory_samples s on s.id = d.id where s.subject_type <> 'patient';
  if v_bad <> 0 then raise exception '% δείγματα εκτός ασθενών στη λίστα διαγραφής', v_bad; end if;
  select count(*) into v_bad from doomed d join cult c on c.id = d.id where c.yr >= 2024 and c.mdr;
  if v_bad <> 0 then raise exception '% πολυανθεκτικά 2024–2026 στη λίστα διαγραφής', v_bad; end if;
  select count(*) into v_bad from doomed d join cult c on c.id = d.id where c.complete and d.reason = 'ελλιπής, όχι πολυανθεκτική';
  if v_bad <> 0 then raise exception '% πλήρεις καλλιέργειες σημειώθηκαν ελλιπείς', v_bad; end if;
end $$;

delete from public.laboratory_samples where id in (select id from doomed);

-- Έλεγχοι μετά
do $$
declare v_before record; v_samples bigint; v_non_patient bigint;
begin
  select * into v_before from before_counts;
  select count(*) into v_samples from public.laboratory_samples where organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd';
  select count(*) into v_non_patient from public.laboratory_samples where organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd' and subject_type <> 'patient';
  if v_samples <> v_before.samples - v_before.doomed then raise exception 'Σβήστηκαν % αντί για %', v_before.samples - v_samples, v_before.doomed; end if;
  if v_non_patient <> v_before.non_patient then raise exception 'Άλλαξαν δείγματα εκτός ασθενών'; end if;
end $$;

-- Σύνοψη ανά έτος (μετά τον καθαρισμό)
select c.yr as ετος,
       count(*) filter (where c.id not in (select id from doomed)) as καλλιεργειες,
       count(*) filter (where c.id not in (select id from doomed) and c.mdr) as πολυανθεκτικα,
       count(*) filter (where c.id not in (select id from doomed) and c.mdr and not c.complete) as προς_συμπληρωση_εργαστηριο,
       count(*) filter (where c.id in (select id from doomed)) as σβηστηκαν
from cult c group by c.yr order by c.yr;
commit;
