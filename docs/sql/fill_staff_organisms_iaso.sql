-- ΙΑΣΩ: συμπλήρωση μικροοργανισμού και CFU σε 21 θετικά αποτελέσματα ελέγχου προσωπικού (από τις «Παρατηρήσεις» του FileMaker:
-- CONS / CoNS → Coagulase-negative staphylococci (CoNS), S.aureus → Staphylococcus aureus· CFU όπου γράφει αριθμό).
-- Τα αποτελέσματα είναι «validated» και η βάση τα προστατεύει (trg_microbiology_result_immutability)· το trigger απενεργοποιείται ΜΟΝΟ μέσα
-- σε αυτή τη συναλλαγή και ενεργοποιείται ξανά πριν το commit. Αν δεν αλλάξουν ακριβώς 21 γραμμές, η συναλλαγή ακυρώνεται ΟΛΟΚΛΗΡΗ.
-- Διαβάζει το προσωρινό αντίγραφο του πίνακα «Lab» (fm_stage_records)· τρέχει ο ιδιοκτήτης στο SQL Editor ΠΡΙΝ καθαριστεί το αντίγραφο.
-- Έλεγχος μετά (μόνο ανάγνωση): θετικά προσωπικού χωρίς μικροοργανισμό, αναμένεται 0:
-- select count(*) from public.microbiology_results m join public.laboratory_samples s on s.id=m.sample_id where s.subject_type='employee' and m.result_status='positive' and coalesce(m.organism,'')='';
begin;
select set_config('request.jwt.claims','{"sub":"84066ee0-57b7-4cae-9186-09e491d3ea6d","role":"authenticated"}',true);
alter table public.microbiology_results disable trigger trg_microbiology_result_immutability;
do $$
declare n int;
begin
  with fm as (
    select (l.data->>'SampleDate')::date d,
           case l.data->>'Eidos_Epixrismatos' when 'Χεριών' then 'handSwab' else 'nasalSwab' end site,
           upper(trim(l.data->>'Asthenis Full Name')) nm, l.data->>'thesi' pos, nullif(trim(l.data->>'Notes'),'') note
    from public.fm_stage_records l
    where l.base_table='Lab' and l.data->>'Eidos_Epixrismatos' in ('Χεριών','Ρινικό επίχρισμα') and coalesce(l.data->>'tryvlio','')<>''),
  upd as (
    update public.microbiology_results m
       set organism = case when fm.note ~* 'aureus' then 'Staphylococcus aureus' else 'Coagulase-negative staphylococci (CoNS)' end,
           cfu_count = coalesce(nullif(substring(fm.note from '(?i)([0-9]+)\s*cfu'),'')::int, nullif(substring(fm.note from '=\s*([0-9]+)'),'')::int, m.cfu_count)
      from public.laboratory_samples s
      join fm on fm.d=(s.collected_at at time zone 'Europe/Athens')::date and fm.site=s.source_site and fm.nm=upper(trim(s.subject_name)) and fm.pos=s.environmental_position
     where m.sample_id=s.id and s.organization_id='7972f286-e8b8-4bbf-aa97-cf9a3d1375bd' and s.subject_type='employee'
       and m.result_status='positive' and coalesce(m.organism,'')='' and fm.note ~* 'cons|coagulase|aureus'
    returning m.id)
  select count(*) into n from upd;
  if n<>21 then raise exception 'Αναμενόταν 21 γραμμές, βρέθηκαν %', n; end if;
end $$;
alter table public.microbiology_results enable trigger trg_microbiology_result_immutability;
commit;
