-- ΙΑΣΩ Θεσσαλίας — ένωση σε μία νοσηλεία για τους 15 ασθενείς με 2 νοσηλείες σε απόσταση έως 2 ημέρες (μεταφορές ΤΕΠ → Παθολογική κ.λπ.).
-- Κρατιέται η πρώτη νοσηλεία, με το ΤΕΛΕΥΤΑΙΟ τμήμα και τη μεταγενέστερη ημερομηνία εξόδου. Τα επεισόδια, οι κλίμακες, τα συμβάντα και τα πρωτόκολλα περνούν στη νοσηλεία που μένει.
-- Οι άλλοι ασθενείς με πολλές νοσηλείες (90 επανεισαγωγές, 71 διαφορετικά τμήματα) ΔΕΝ αγγίζονται. Η δεύτερη νοσηλεία σβήνεται, γι' αυτό τρέχει από τον ιδιοκτήτη.
-- Φρουρός: αναμένονται ακριβώς 15 ασθενείς με 2 νοσηλείες ο καθένας.
begin;

create temporary table _m on commit drop as
with org as (select id from public.organizations where name = 'ΙΑΣΩ ΘΕΣΣΑΛΙΑΣ'),
g as (
  select a.patient_id from public.patient_admissions a
  where a.organization_id in (select id from org)
  group by 1
  having count(*) = 2 and max(a.admission_date) - min(a.admission_date) <= 2),
r as (
  select a.*, row_number() over (partition by a.patient_id order by a.admission_date, a.created_at, a.id) rn
  from public.patient_admissions a where a.patient_id in (select patient_id from g))
select k.id keep_id, l.id drop_id, k.patient_id, l.department_id last_dept,
       case when k.discharge_date is null or l.discharge_date is null then null
            else greatest(k.discharge_date, l.discharge_date) end last_discharge
from r k join r l on l.patient_id = k.patient_id and l.rn = 2
where k.rn = 1;

do $$
begin
  if (select count(*) from _m) <> 15 then
    raise exception 'Αναμενόντουσαν 15 ασθενείς, βρέθηκαν %', (select count(*) from _m);
  end if;
end $$;

update public.surveillance_cases c set admission_id = m.keep_id from _m m where c.admission_id = m.drop_id;
update public.patient_clinical_scale_assessments c set admission_id = m.keep_id from _m m where c.admission_id = m.drop_id;
update public.clinical_protocol_runs c set admission_id = m.keep_id from _m m where c.admission_id = m.drop_id;
update public.quality_incidents c set linked_admission_id = m.keep_id from _m m where c.linked_admission_id = m.drop_id;

update public.patient_admissions a
   set department_id = coalesce(m.last_dept, a.department_id), discharge_date = m.last_discharge, updated_at = now()
  from _m m where a.id = m.keep_id;

delete from public.patient_admissions where id in (select drop_id from _m);

select (select count(*) from public.patient_admissions a join public.organizations o on o.id = a.organization_id and o.name = 'ΙΑΣΩ ΘΕΣΣΑΛΙΑΣ') admissions_left,
       (select count(*) from (select patient_id from public.patient_admissions a join public.organizations o on o.id = a.organization_id and o.name = 'ΙΑΣΩ ΘΕΣΣΑΛΙΑΣ'
          group by 1 having count(*) > 1) x) patients_with_many;

commit;
