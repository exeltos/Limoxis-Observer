-- Organism clusters of patients only: environmental cultures (surfaces, water, equipment, air: the operating theatres and
-- the sterilisation unit) and samples without a patient are left out, and so is a contaminated culture whose «organism» is
-- the laboratory's note («Αναπτύχθηκαν 3 είδη μικροβίων >= 10^5 cfu/ml - επιμόλυνση», «ΑΝΑΠΤΥΞΗ 3 ΕΙΔΩΝ ΜΙΚΡΟΒΙΩΝ»).
-- The rest is 20261231220200 (one window per distinct day, patients counted).

create or replace function private.detect_organism_clusters(p_organization_id uuid, p_window_days integer default 14, p_threshold integer default 3)
returns table(department_id uuid, department_name text, organism text, resistance_class text, case_count bigint, first_event date, last_event date)
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not (public.current_user_is_platform_owner() or public.current_user_has_org_role(p_organization_id, array['hospital_admin','infection_control_lead','infection_control_member','laboratory','doctor_reviewer']::public.app_role[])) then
    raise exception 'Cluster detection access denied';
  end if;
  if p_window_days is null or p_window_days < 1 then raise exception 'Invalid window'; end if;
  if p_threshold is null or p_threshold < 2 then raise exception 'Invalid threshold'; end if;

  return query
  with isolates as (
    select l.department_id, d.name as department_name, trim(m.organism) as organism,
      upper(coalesce(m.resistance_class, '')) as resistance_class, l.collected_at::date as event_date,
      l.id as sample_id, l.patient_id as patient_key,
      lower(trim(m.organism)) ~ '^(coagulase[ -]negative|cons$|staphylococcus (epidermidis|haemolyticus|hominis|capitis|warneri|simulans|cohnii|xylosus|auricularis|pasteuri)|s\. ?(epidermidis|haemolyticus|hominis|capitis)|corynebacterium(?! diphtheriae)|bacillus(?! anthracis)|micrococcus|cutibacterium|propionibacterium|viridans|streptococcus (mitis|oralis|sanguinis|salivarius|parasanguinis|gordonii))' as is_flora
    from public.microbiology_results m
    join public.laboratory_samples l on l.id = m.sample_id and l.organization_id = m.organization_id
    join public.departments d on d.id = l.department_id
    where m.organization_id = p_organization_id
      -- Patients only: an environmental sample (surface, water, equipment, air) or a sample without a patient is no infection.
      and l.patient_id is not null
      and coalesce(l.sample_type, '') not in ('surface', 'water', 'equipment', 'air', 'environment')
      -- A contaminated culture («Αναπτύχθηκαν 3 είδη μικροβίων … επιμόλυνση», «ΑΝΑΠΤΥΞΗ 3 ΕΙΔΩΝ ΜΙΚΡΟΒΙΩΝ») names no organism.
      and m.organism !~* '(επιμ[οό]λυνσ|αναπτ[υύ]χθηκαν [0-9]+ ε[ιί]δη|αν[αά]πτυξη [0-9]+ ειδ[ωώ]ν|contaminat|mixed flora|μικτ[ηή] χλωρ[ιί]δα)'
      and m.result_status = 'positive'
      and m.validation_status in ('validated', 'amended')
      and m.organism is not null
      and l.collected_at >= now() - interval '2 years'
      and not exists (select 1 from public.microbiology_results m2 where m2.organization_id = m.organization_id and m2.amended_from = m.id)
  ),
  -- Each window starts on a distinct day: several isolates on the same day used to start the same window more than once,
  -- and every one of them multiplied the count (12 isolates of 4 patients read as 108).
  starts as (
    select distinct i.department_id, i.department_name, lower(i.organism) as org_key, i.event_date as window_start
    from isolates i
  ),
  per_patient as (
    select s.department_id, s.department_name, s.org_key, s.window_start, i.patient_key,
      min(i.organism) as organism, bool_or(i.is_flora) as is_flora,
      count(distinct i.sample_id) as n_samples, min(i.event_date) as first_d, max(i.event_date) as last_d
    from starts s
    join isolates i on i.department_id = s.department_id and lower(i.organism) = s.org_key
      and i.event_date between s.window_start and s.window_start + (p_window_days || ' days')::interval
    group by s.department_id, s.department_name, s.org_key, s.window_start, i.patient_key
  ),
  windows as (
    -- The count is of patients: a patient with repeated cultures counts once. Skin flora: only patients with 2+ distinct samples.
    select p.department_id, p.department_name, min(p.organism) as organism, p.window_start,
      count(*) filter (where not p.is_flora or p.n_samples >= 2)::bigint as window_count,
      min(p.first_d) filter (where not p.is_flora or p.n_samples >= 2) as window_first,
      max(p.last_d) filter (where not p.is_flora or p.n_samples >= 2) as window_last
    from per_patient p
    group by p.department_id, p.department_name, p.org_key, p.window_start
  ),
  best as (
    -- The single densest window per department+organism (earliest on a tie): count and dates come from the same window.
    select distinct on (w.department_id, lower(w.organism)) w.department_id, w.department_name, w.organism,
      w.window_count as case_count, w.window_first, w.window_last
    from windows w
    where w.window_count >= p_threshold
    order by w.department_id, lower(w.organism), w.window_count desc, w.window_start asc
  )
  select b.department_id, b.department_name, b.organism,
    (select string_agg(distinct i.resistance_class, ',') from isolates i where i.department_id = b.department_id and lower(i.organism) = lower(b.organism) and i.resistance_class <> '' and i.event_date between b.window_first and b.window_last) as resistance_class,
    b.case_count,
    b.window_first as first_event,
    b.window_last as last_event
  from best b
  order by b.case_count desc, b.window_last desc;
end;$function$;
