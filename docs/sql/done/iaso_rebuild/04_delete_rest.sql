-- ΙΑΣΩ Θεσσαλίας — διαγραφή ΟΛΩΝ των ασθενών εκτός επιλογής, με όλα τα δεδομένα τους. ΔΕΝ αναιρείται μετά το commit.
-- Να τρέξει από τον ιδιοκτήτη στο SQL Editor, ΜΕΤΑ από αντίγραφο ασφαλείας της βάσης (Supabase → Database → Backups).
-- Κρατιούνται: (1) οι ασθενείς του πίνακα rebuild_stage (Excel 2024–2026) με νοσηλεία, (2) όσοι έχουν δηλωτέο νόσημα,
-- (3) όσοι έχουν αποτέλεσμα MDR ΚΑΙ τμήμα ΚΑΙ νοσηλεία (οι 12 MDR χωρίς τμήμα/νοσηλεία σβήνονται, απόφαση ιδιοκτήτη 29/10). Δεν αγγίζονται: δείγματα περιβάλλοντος/εργαζομένων, άλλοι οργανισμοί, συμβάντα ποιότητας (μόνο χάνεται ο σύνδεσμος).
-- Μέτρηση 29/10/2026 (πριν τη διαγραφή): 889 ασθενείς (763 αρχειοθετημένοι + 126 ορατοί), 296 δείγματα, 1116 νοσηλείες, 1272 επεισόδια. Μένουν 1204.
-- Φρουρός: αν το πλήθος διαφέρει πάνω από 15 από το αναμενόμενο (ο ωριαίος συγχρονισμός FileMaker μπορεί να έχει προσθέσει ασθενείς), η συναλλαγή ακυρώνεται.
begin;

create temporary table _del on commit drop as
with pp as (
  select p.*, exists (select 1 from public.patient_admissions a where a.patient_id = p.id) has_adm
  from public.patients p
  join public.organizations o on o.id = p.organization_id
  where o.name = 'ΙΑΣΩ ΘΕΣΣΑΛΙΑΣ')
select pp.id from pp
where not (
      -- 1. ασθενείς των Excel (με νοσηλεία· ένα διπλότυπο χωρίς νοσηλεία δεν κρατιέται)
         (coalesce(pp.hospital_record_number in (select his from public.rebuild_stage_u), false) and pp.has_adm)
      -- 2. ασθενείς με δηλωτέο νόσημα
      or exists (select 1 from public.notifiable_disease_reports n where n.patient_id = pp.id)
      -- 3. MDR μόνο όταν έχουν τμήμα και νοσηλεία (οι εξωτερικοί MDR χωρίς τμήμα σβήνονται)
      or (pp.department_id is not null and pp.has_adm and exists (
            select 1 from public.laboratory_samples s join public.microbiology_results r on r.sample_id = s.id
            where s.patient_id = pp.id and r.resistance_class = 'MDR')));

do $$
declare n int;
begin
  select count(*) into n from _del;
  if abs(n - 889) > 15 then raise exception 'Αναμενόταν περίπου 889 ασθενείς προς διαγραφή, βρέθηκαν %', n; end if;
  if (select count(*) from public.patients p join public.organizations o on o.id = p.organization_id
       where o.name = 'ΙΑΣΩ ΘΕΣΣΑΛΙΑΣ' and p.id not in (select id from _del)) < 1190 then
    raise exception 'Θα έμεναν λιγότεροι από 1190 ασθενείς — ακυρώνεται';
  end if;
end $$;

-- 1. Δείγματα ασθενών (σβήνουν και τα αποτελέσματα, μικρόβια, ταξινομήσεις).
delete from public.laboratory_samples where patient_id in (select id from _del);
-- 2. Επεισόδια επιτήρησης (σβήνουν γεγονότα, κριτήρια, απομονώσεις, συσκευές, κ.λπ. που κρέμονται από αυτά).
delete from public.surveillance_cases where patient_id in (select id from _del);
-- 3. Ό,τι έμεινε με patient_id χωρίς επεισόδιο.
delete from public.antimicrobial_therapies where patient_id in (select id from _del);
delete from public.isolation_episodes where patient_id in (select id from _del);
delete from public.surveillance_reassessments where patient_id in (select id from _del);
delete from public.surveillance_outcomes where patient_id in (select id from _del);
delete from public.hai_classifications where patient_id in (select id from _del);
delete from public.surveillance_devices where patient_id in (select id from _del);
delete from public.clinical_assessments where patient_id in (select id from _del);
delete from public.prevention_bundle_assessments where patient_id in (select id from _del);
delete from public.lira_outbreak_case_reviews where patient_id in (select id from _del);
delete from public.clinical_protocol_runs where patient_id in (select id from _del);
-- 4. Ασθενείς (οι νοσηλείες και οι κλίμακες σβήνουν μαζί).
delete from public.patients where id in (select id from _del);

-- Έλεγχος μετά (όλα πρέπει να είναι 0 / τα υπόλοιπα όπως περιμένεις).
select (select count(*) from public.patients p join public.organizations o on o.id = p.organization_id where o.name = 'ΙΑΣΩ ΘΕΣΣΑΛΙΑΣ') patients_left,
       (select count(*) from public.patients p join public.organizations o on o.id = p.organization_id where o.name = 'ΙΑΣΩ ΘΕΣΣΑΛΙΑΣ' and p.archived_at is not null) archived_left,
       (select count(*) from public.patients p join public.organizations o on o.id = p.organization_id where o.name = 'ΙΑΣΩ ΘΕΣΣΑΛΙΑΣ'
          and not exists (select 1 from public.patient_admissions a where a.patient_id = p.id)) without_admission,
       (select count(*) from public.patients p join public.organizations o on o.id = p.organization_id where o.name = 'ΙΑΣΩ ΘΕΣΣΑΛΙΑΣ'
          and not exists (select 1 from public.laboratory_samples s where s.patient_id = p.id)) without_samples;

commit;
