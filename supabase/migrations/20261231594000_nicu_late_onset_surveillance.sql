-- ΜΕΝΝ Ν6β (ιδιοκτήτης 17/11/2026): η απόφαση για μια πιθανή όψιμη λοίμωξη παίρνεται στην Επιτήρηση › «Προς έλεγχο»
-- (ομάδα λοιμώξεων), όχι στο μητρώο της ΜΕΝΝ.
-- 1. nicu_late_onset_flags(p_organization_id): ποια δείγματα της λίστας είναι θετική αιμοκαλλιέργεια νεογνού της ΜΕΝΝ
--    ≥ 72 ώρες μετά την εισαγωγή (sample_id και ώρες· κανένα όνομα, κανένα στοιχείο του μητρώου), για την ένδειξη
--    «Πιθανή όψιμη λοίμωξη · ΜΕΝΝ». Μόνο για όσους διαβάζουν τα δείγματα όλου του νοσοκομείου.
-- 2. Όταν ανοίγει επεισόδιο επιτήρησης από ένα τέτοιο δείγμα, το μητρώο της ΜΕΝΝ γράφει «Επιβεβαιωμένη όψιμη λοίμωξη»
--    για το νεογνό (trigger· η συνάρτηση στο private, δεν καλείται απ' έξω).
-- 3. register_late_infection_candidates: η απόφαση διαβάζεται από την Επιτήρηση (επεισόδιο → επιβεβαιωμένη,
--    «Δεν χρειάζεται επιτήρηση» → όχι), ώστε ο δείκτης της ΜΕΝΝ να λέει πόσες περιμένουν απόφαση.

-- Οι υποψήφιες ενός μητρώου ΜΕΝΝ (κοινό κομμάτι 1 και 2): entry, δείγμα, ώρες μετά την εισαγωγή.
create or replace function private.nicu_late_onset_rows(p_register_id uuid, p_sample_id uuid default null)
returns table (entry_id uuid, sample_id uuid, hours_after numeric)
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  r public.department_registers;
begin
  select * into r from public.department_registers where id = p_register_id;
  if not found or r.template_key is distinct from 'nicu' or r.table_name is null or r.department_id is null then return; end if;
  return query execute format($q$
    select distinct e.id, l.id,
      round((extract(epoch from (l.collected_at - (e.admission_date + coalesce((to_jsonb(e)->>'admission_time')::time, time '00:00'))::timestamp at time zone 'Europe/Athens')) / 3600)::numeric, 1)
    from public.%I e
    join public.%I i on i.entry_id = e.id
    join public.laboratory_samples l on l.organization_id = $1 and l.department_id = $2 and l.sample_type = 'bloodCulture'
      and ($3::uuid is null or l.id = $3)
      and coalesce(l.status, '') not in ('rejected', 'cancelled')
      and (l.collected_at at time zone 'Europe/Athens')::date between e.admission_date and coalesce(e.discharge_date, e.admission_date + 120)
    join public.patients p on p.id = l.patient_id and length(btrim(p.last_name)) >= 3
      and upper(i.patient_name) like '%%' || upper(btrim(p.last_name)) || '%%'
    where e.admission_date is not null
      and exists (select 1 from public.microbiology_results m where m.sample_id = l.id and m.result_status = 'positive')
      and l.collected_at >= (e.admission_date + coalesce((to_jsonb(e)->>'admission_time')::time, time '00:00'))::timestamp at time zone 'Europe/Athens' + interval '72 hours'
  $q$, r.table_name, r.table_name || '_identity')
  using r.organization_id, r.department_id, p_sample_id;
end;
$function$;
revoke execute on function private.nicu_late_onset_rows(uuid, uuid) from public, anon, authenticated;

create or replace function public.nicu_late_onset_flags(p_organization_id uuid)
returns table (sample_id uuid, hours_after numeric)
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  reg uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  if not (public.current_user_is_platform_owner()
    or public.current_user_has_org_role(p_organization_id, array['hospital_admin'::public.app_role, 'infection_control_lead'::public.app_role,
      'infection_control_member'::public.app_role, 'doctor_reviewer'::public.app_role, 'laboratory'::public.app_role])) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if private.org_modules_locked(p_organization_id, array['laboratory']) then return; end if;
  for reg in select id from public.department_registers where organization_id = p_organization_id and template_key = 'nicu' and status = 'active' loop
    return query select distinct x.sample_id, x.hours_after from private.nicu_late_onset_rows(reg) x;
  end loop;
end;
$function$;
revoke execute on function public.nicu_late_onset_flags(uuid) from public, anon;
grant execute on function public.nicu_late_onset_flags(uuid) to authenticated;

create or replace function private.nicu_mark_late_infection()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  reg record;
begin
  if new.surveillance_case_id is null or old.surveillance_case_id is not null or new.sample_type is distinct from 'bloodCulture' then return new; end if;
  for reg in select id, table_name from public.department_registers
    where organization_id = new.organization_id and department_id = new.department_id and template_key = 'nicu' and table_name is not null loop
    execute format('update public.%I set late_infection = true where id in (select entry_id from private.nicu_late_onset_rows($1, $2)) and late_infection is distinct from true', reg.table_name)
      using reg.id, new.id;
  end loop;
  return new;
end;
$function$;
revoke execute on function private.nicu_mark_late_infection() from public, anon, authenticated;
create or replace trigger laboratory_samples_nicu_late_infection after update of surveillance_case_id on public.laboratory_samples
  for each row execute function private.nicu_mark_late_infection();

create or replace function public.register_late_infection_candidates(p_register_id uuid)
returns table (entry_id uuid, sample_id uuid, collected_at timestamptz, organism text, hours_after numeric, decision text)
language plpgsql
stable
security definer
set search_path to ''
as $function$
begin
  if auth.uid() is null then raise exception 'Not signed in' using errcode = '42501'; end if;
  if not exists (select 1 from public.department_registers where id = p_register_id) then raise exception 'Unknown register'; end if;
  if not private.register_can_read(p_register_id) then raise exception 'Not allowed' using errcode = '42501'; end if;
  if private.org_modules_locked((select organization_id from public.department_registers where id = p_register_id), array['laboratory']) then return; end if;
  return query
    select x.entry_id, x.sample_id, l.collected_at, m.organism, x.hours_after,
      case when l.surveillance_case_id is not null or l.surveillance_review_status = 'episode_opened' then 'confirmed'
        when l.surveillance_review_status = 'no_surveillance_needed' then 'rejected' end
    from private.nicu_late_onset_rows(p_register_id) x
    join public.laboratory_samples l on l.id = x.sample_id
    left join public.microbiology_results m on m.sample_id = l.id and m.result_status = 'positive'
    order by l.collected_at desc;
end;
$function$;
