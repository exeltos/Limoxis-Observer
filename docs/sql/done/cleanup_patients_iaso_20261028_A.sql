-- Καθαρισμός Α — ΙΑΣΩ Θεσσαλίας: αρχειοθετημένοι ασθενείς ΧΩΡΙΣ τίποτα πάνω τους
-- (καμία νοσηλεία, κανένα δείγμα, κανένα επεισόδιο/κλίμακα/δήλωση/δέσμη/συμβάν).
-- Να τρέξει από τον ιδιοκτήτη στο SQL Editor του Supabase (οι `delete` δεν εκτελούνται από τον agent).
-- Αναμενόμενο πλήθος (μέτρηση 28/10/2026): 581. Αν το πλήθος διαφέρει, η συναλλαγή ακυρώνεται.
-- ΔΕΝ αναιρείται μετά το commit· το αντίγραφο ασφαλείας της βάσης είναι η μόνη επαναφορά.

begin;

create temporary table _cleanup_a on commit drop as
select p.id
from public.patients p
join public.organizations o on o.id = p.organization_id
where o.name = 'ΙΑΣΩ ΘΕΣΣΑΛΙΑΣ'
  and p.archived_at is not null
  and not exists (select 1 from public.patient_admissions x where x.patient_id = p.id)
  and not exists (select 1 from public.laboratory_samples x where x.patient_id = p.id)
  and not exists (select 1 from public.surveillance_cases x where x.patient_id = p.id)
  and not exists (select 1 from public.clinical_assessments x where x.patient_id = p.id)
  and not exists (select 1 from public.antimicrobial_therapies x where x.patient_id = p.id)
  and not exists (select 1 from public.isolation_episodes x where x.patient_id = p.id)
  and not exists (select 1 from public.surveillance_reassessments x where x.patient_id = p.id)
  and not exists (select 1 from public.surveillance_outcomes x where x.patient_id = p.id)
  and not exists (select 1 from public.hai_classifications x where x.patient_id = p.id)
  and not exists (select 1 from public.surveillance_devices x where x.patient_id = p.id)
  and not exists (select 1 from public.prevention_bundle_assessments x where x.patient_id = p.id)
  and not exists (select 1 from public.patient_clinical_scale_assessments x where x.patient_id = p.id)
  and not exists (select 1 from public.notifiable_disease_reports x where x.patient_id = p.id)
  and not exists (select 1 from public.clinical_protocol_runs x where x.patient_id = p.id)
  and not exists (select 1 from public.lira_outbreak_case_reviews x where x.patient_id = p.id)
  and not exists (select 1 from public.quality_incidents x where x.linked_patient_id = p.id);

do $$
declare n int;
begin
  select count(*) into n from _cleanup_a;
  if n <> 581 then raise exception 'Αναμενόταν 581 ασθενείς, βρέθηκαν %', n; end if;
end $$;

delete from public.patients where id in (select id from _cleanup_a);

-- Έλεγχος: πρέπει να μείνουν 0 από αυτούς.
select count(*) as left_over from public.patients where id in (select id from _cleanup_a);

commit;
