-- «MDR στην εισαγωγή» για τους νέους ασθενείς: μόλις ένα αποτέλεσμα βγει MDR/XDR/PDR, η νοσηλεία του δείγματος σημειώνεται όταν
-- (α) το δείγμα ήταν έλεγχος εισαγωγής (clinical_context.admissionScreening), ή (β) λήφθηκε μέσα σε 2 ημέρες από την εισαγωγή.
-- Δεν αλλάζει ήδη σημειωμένες νοσηλείες (π.χ. από το FileMaker).
create or replace function private.mark_admission_mdr_from_result()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  s record;
  a record;
  v_day date;
  v_screening boolean;
begin
  if new.resistance_class is null or new.resistance_class not in ('MDR', 'XDR', 'PDR') then return new; end if;
  select ls.patient_id, ls.collected_at, ls.clinical_context into s from public.laboratory_samples ls where ls.id = new.sample_id;
  if s.patient_id is null or s.collected_at is null then return new; end if;
  v_day := (s.collected_at at time zone 'Europe/Athens')::date;
  select pa.id, pa.admission_date into a from public.patient_admissions pa
   where pa.patient_id = s.patient_id and pa.admission_date <= v_day
   order by pa.admission_date desc limit 1;
  if a.id is null then return new; end if;
  v_screening := coalesce(s.clinical_context ->> 'admissionScreening', '') = 'true';
  if v_screening or v_day <= a.admission_date + 2 then
    update public.patient_admissions
       set mdr_on_admission = true,
           mdr_on_admission_date = v_day,
           mdr_on_admission_source = case when v_screening then 'screening' else 'auto48h' end,
           updated_at = now()
     where id = a.id and not mdr_on_admission;
  end if;
  return new;
end;
$$;

create trigger trg_mark_admission_mdr
  after insert or update of resistance_class on public.microbiology_results
  for each row execute function private.mark_admission_mdr_from_result();
