-- ΜΕΝΝ: αυτόματη επιτήρηση από θετική αιμοκαλλιέργεια (ιδιοκτήτης 20/11/2026, «ναι σε όλα»).
-- 1. Θετική επικυρωμένη αιμοκαλλιέργεια νεογνού σε τμήμα με ενεργό μητρώο ΜΕΝΝ, χωρίς επεισόδιο και χωρίς απόφαση:
--    ανοίγει (ή συνδέεται με το ανοιχτό) επεισόδιο επιτήρησης. Αν το δείγμα πάρθηκε ≥ 72 ώρες μετά την εισαγωγή,
--    ο υπάρχων trigger laboratory_samples_nicu_late_infection γράφει στο μητρώο «Επιβεβαιωμένη όψιμη λοίμωξη».
-- 2. Μικρόβιο δέρματος (CoNS κ.λπ., το ίδιο μοτίβο με το skinFloraOrganisms.ts): μόνο όταν το ίδιο νεογνό έχει δεύτερη
--    θετική αιμοκαλλιέργεια με μικρόβιο δέρματος μέσα σε 48 ώρες· αλλιώς μένει στο «Προς έλεγχο».
-- 3. Από εδώ και πέρα: trigger στα αποτελέσματα μικροβιολογίας.
-- Στο δείγμα γράφεται η σημείωση «Αυτόματα από κανόνα ΜΕΝΝ» (χωρίς χρήστη), στο επεισόδιο η αιτία.

create or replace function private.nicu_skin_flora(p_organism text)
returns boolean
language sql
immutable
set search_path to ''
as $function$
  select lower(btrim(coalesce(p_organism, ''))) ~ '^(coagulase[ -]negative|cons$|staphylococcus (epidermidis|haemolyticus|hominis|capitis|warneri|simulans|cohnii|xylosus|auricularis|pasteuri)|s\. ?(epidermidis|haemolyticus|hominis|capitis)|corynebacterium(?! diphtheriae)|bacillus(?! anthracis)|micrococcus|cutibacterium|propionibacterium|viridans|streptococcus (mitis|oralis|sanguinis|salivarius|parasanguinis|gordonii))';
$function$;
revoke execute on function private.nicu_skin_flora(text) from public, anon, authenticated;

create or replace function private.nicu_auto_surveillance(p_sample_id uuid)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  l public.laboratory_samples%rowtype;
  v_organism text;
  v_case uuid;
  v_late boolean := false;
begin
  select * into l from public.laboratory_samples where id = p_sample_id for update;
  if not found or l.patient_id is null or l.surveillance_case_id is not null or l.surveillance_review_status is not null
     or l.sample_type is distinct from 'bloodCulture' or coalesce(l.status, '') in ('rejected', 'cancelled') then
    return 'skip';
  end if;
  if not exists (select 1 from public.department_registers r where r.organization_id = l.organization_id
      and r.department_id = l.department_id and r.template_key = 'nicu' and r.status = 'active') then
    return 'not_nicu';
  end if;
  if private.org_modules_locked(l.organization_id, array['surveillance']) then return 'locked'; end if;
  select m.organism into v_organism from public.microbiology_results m
   where m.sample_id = l.id and m.result_status = 'positive' and m.validation_status in ('validated', 'amended')
   order by m.resulted_at desc nulls last limit 1;
  if v_organism is null then return 'not_positive'; end if;
  if private.nicu_skin_flora(v_organism) and not exists (
      select 1 from public.laboratory_samples o
      join public.microbiology_results om on om.sample_id = o.id and om.result_status = 'positive' and om.validation_status in ('validated', 'amended')
      where o.organization_id = l.organization_id and o.patient_id = l.patient_id and o.id <> l.id
        and o.sample_type = 'bloodCulture' and coalesce(o.status, '') not in ('rejected', 'cancelled')
        and private.nicu_skin_flora(om.organism)
        and abs(extract(epoch from (o.collected_at - l.collected_at))) <= 48 * 3600) then
    return 'skin_single';
  end if;
  select exists (select 1 from public.department_registers r, lateral private.nicu_late_onset_rows(r.id, l.id) x
    where r.organization_id = l.organization_id and r.department_id = l.department_id and r.template_key = 'nicu') into v_late;
  select c.id into v_case from public.surveillance_cases c
   where c.organization_id = l.organization_id and c.patient_id = l.patient_id and c.status = 'active' and c.voided_at is null
   order by c.started_at desc limit 1;
  if v_case is null then
    insert into public.surveillance_cases (organization_id, patient_id, department_id, status, started_at, reason, reason_en, hospital_acquired)
    values (l.organization_id, l.patient_id, l.department_id, 'active', coalesce(l.collected_at, now()),
      'Θετική αιμοκαλλιέργεια ΜΕΝΝ: ' || v_organism || ' (αυτόματα από κανόνα ΜΕΝΝ)',
      'Positive NICU blood culture: ' || v_organism || ' (automatic NICU rule)',
      case when v_late then true end)
    returning id into v_case;
    insert into public.surveillance_events (organization_id, surveillance_case_id, event_type, event_status, occurred_at, detail)
    values (l.organization_id, v_case, 'surveillance_start', 'completed', coalesce(l.collected_at, now()), 'auto_nicu_rule');
  end if;
  update public.laboratory_samples
     set surveillance_case_id = v_case, surveillance_review_status = 'episode_opened', surveillance_review_reason = null,
         surveillance_review_note = 'Αυτόματα από κανόνα ΜΕΝΝ', surveillance_reviewed_at = now(), updated_at = now()
   where id = l.id;
  return case when v_late then 'opened_late_onset' else 'opened' end;
end;
$function$;
revoke execute on function private.nicu_auto_surveillance(uuid) from public, anon, authenticated;

-- 3. Κάθε νέο ή αλλαγμένο θετικό επικυρωμένο αποτέλεσμα: ο κανόνας τρέχει για το δείγμα του και, για μικρόβιο
--    δέρματος, και για τις άλλες αιμοκαλλιέργειες του νεογνού που περίμεναν τη δεύτερη.
create or replace function private.nicu_auto_surveillance_on_result()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_sample record;
  v_patient uuid;
begin
  if new.result_status is distinct from 'positive' or new.validation_status not in ('validated', 'amended') then return new; end if;
  perform private.nicu_auto_surveillance(new.sample_id);
  if private.nicu_skin_flora(new.organism) then
    select patient_id into v_patient from public.laboratory_samples where id = new.sample_id;
    for v_sample in select o.id from public.laboratory_samples o
      where o.organization_id = new.organization_id and o.patient_id = v_patient and o.id <> new.sample_id
        and o.sample_type = 'bloodCulture' and o.surveillance_case_id is null and o.surveillance_review_status is null loop
      perform private.nicu_auto_surveillance(v_sample.id);
    end loop;
  end if;
  return new;
end;
$function$;
revoke execute on function private.nicu_auto_surveillance_on_result() from public, anon, authenticated;
create or replace trigger microbiology_results_nicu_auto_surveillance
  after insert or update of result_status, validation_status on public.microbiology_results
  for each row when (current_setting('limoxis.bin', true) is distinct from 'on')
  execute function private.nicu_auto_surveillance_on_result();
