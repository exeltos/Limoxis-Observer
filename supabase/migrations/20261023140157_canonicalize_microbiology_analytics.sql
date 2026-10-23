-- Canonicalize microbiology labels for analytics without mutating validated source results.
-- Exact specimen names come from the central sampleTypes library; sample_type remains the
-- stable technical category used for clinical/environment/staff grouping.

create or replace function private.canonical_microbiology_organism(p_value text)
returns text
language sql
immutable
set search_path = ''
as $function$
  select case
    when nullif(btrim(p_value), '') is null then null
    when lower(regexp_replace(btrim(p_value), '[[:space:]._-]+', '', 'g')) in ('ecoli','escherichiacoli') then 'Escherichia coli'
    when lower(btrim(p_value)) = 'mrsa' then 'Staphylococcus aureus'
    when lower(btrim(p_value)) like 'coagulase-negative staphylococc%'
      or lower(btrim(p_value)) like 'coagulase negative staphylococc%'
      or lower(btrim(p_value)) like 'coagulase negative staphylococ%'
      then 'Coagulase-negative staphylococci (CoNS)'
    when lower(btrim(p_value)) in ('candida spp','candida spp.') then 'Candida spp.'
    when lower(btrim(p_value)) in ('pseudomonas spp','pseudomonas spp.') then 'Pseudomonas spp.'
    when lower(btrim(p_value)) in ('klebsiella spp','klebsiella spp.') then 'Klebsiella spp.'
    when lower(btrim(p_value)) in ('proteus spp','proteus spp.') then 'Proteus spp.'
    when lower(btrim(p_value)) in ('enterobacter spp','enterobacter spp.') then 'Enterobacter spp.'
    when lower(btrim(p_value)) in ('enterococcus spp','enterococcus spp.') then 'Enterococcus spp.'
    when lower(btrim(p_value)) like 'klebsiella pneumoniae ssp pneu%' then 'Klebsiella pneumoniae'
    else btrim(p_value)
  end
$function$;

create or replace function public.analysis_microbiology_findings(
  p_organization_id uuid,
  p_from date default null::date,
  p_to date default null::date,
  p_department_id uuid default null::uuid
)
returns table(
  organization_id uuid,
  microbiology_result_id uuid,
  organism text,
  resistance_class text,
  is_critical boolean,
  department_id uuid,
  department_name text,
  source text,
  sample_type text,
  event_date date
)
language sql
stable security definer
set search_path to 'public'
as $function$
  select
    m.organization_id,
    m.id,
    private.canonical_microbiology_organism(org.organism),
    case
      when exists (
        select 1 from amr_classifications a
        where a.organization_id = m.organization_id
          and a.microbiology_result_id = m.id
          and a.status <> 'rejected'
          and upper(coalesce(a.classification, '')) in ('MDR', 'XDR', 'PDR')
      ) then (
        select upper(a.classification) from amr_classifications a
        where a.organization_id = m.organization_id
          and a.microbiology_result_id = m.id
          and a.status <> 'rejected'
          and upper(coalesce(a.classification, '')) in ('MDR', 'XDR', 'PDR')
        order by a.created_at desc limit 1
      )
      else m.resistance_class
    end as resistance_class,
    m.is_critical,
    l.department_id,
    d.name,
    coalesce(st.name_el, nullif(btrim(l.source_site), ''), l.sample_type, '—') as source,
    l.sample_type,
    coalesce(m.resulted_at::date, l.collected_at::date)
  from microbiology_results m
  join laboratory_samples l on l.id = m.sample_id and l.organization_id = m.organization_id
  left join departments d on d.id = l.department_id
  left join master_library_items st
    on st.id = l.specimen_type_id
   and st.organization_id = l.organization_id
   and st.library_key = 'sampleTypes'
   and st.is_active = true
  join lateral (
    select o.organism
    from microbiology_result_organisms o
    where o.organization_id = m.organization_id
      and o.microbiology_result_id = m.id
      and nullif(btrim(o.organism), '') is not null
      and o.organism not in ('Ανάπτυξη χλωρίδας ανωτέρας', 'Αναπτύχθηκαν 3 είδη μικροβίων')
    union all
    select m.organism
    where not exists (
      select 1 from microbiology_result_organisms ox
      where ox.organization_id = m.organization_id
        and ox.microbiology_result_id = m.id
        and nullif(btrim(ox.organism), '') is not null
        and ox.organism not in ('Ανάπτυξη χλωρίδας ανωτέρας', 'Αναπτύχθηκαν 3 είδη μικροβίων')
    )
      and nullif(btrim(m.organism), '') is not null
      and m.organism not in ('Ανάπτυξη χλωρίδας ανωτέρας', 'Αναπτύχθηκαν 3 είδη μικροβίων')
  ) org on true
  where m.organization_id = p_organization_id
    and (
      select public.current_user_is_platform_owner()
        or public.current_user_has_org_role(
          p_organization_id,
          array['hospital_admin','infection_control_lead','infection_control_member','laboratory','doctor_reviewer','hospital_director']::public.app_role[]
        )
    )
    and not (
      select private.org_modules_locked(p_organization_id, array['analysis'])
        or private.org_modules_locked(p_organization_id, array['laboratory','surveillance'])
    )
    and (p_department_id is null or l.department_id = p_department_id)
    and m.result_status = 'positive'
    and m.validation_status in ('validated', 'amended')
    and not exists (
      select 1 from microbiology_results m2
      where m2.organization_id = m.organization_id and m2.amended_from = m.id
    )
    and (p_from is null or coalesce(m.resulted_at::date, l.collected_at::date) >= p_from)
    and (p_to is null or coalesce(m.resulted_at::date, l.collected_at::date) <= p_to);
$function$;
