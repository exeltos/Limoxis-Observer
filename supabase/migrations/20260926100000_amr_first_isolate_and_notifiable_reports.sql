-- 1) AMR susceptibility in Analytics counts only the first isolate per patient,
--    organism group and year (ECDC/EARS-Net, CLSI M39), so repeated cultures of
--    the same patient no longer inflate resistance percentages.
-- 2) notifiable_disease_reports: whether each laboratory finding that requires
--    a ΕΟΔΥ notification was notified, with date and reference number.

create or replace function public.analysis_amr_susceptibility(
  p_organization_id uuid,
  p_from date default null,
  p_to date default null,
  p_department_id uuid default null
)
returns table (
  organism_group text,
  tested bigint,
  resistant bigint
)
language sql
stable
set search_path to 'public'
as $function$
  with matched as (
    select
      case
        when lower(coalesce(a.organism,'')) like '%escherichia coli%' then 'Escherichia coli'
        when lower(coalesce(a.organism,'')) like '%proteus%' then 'Proteus spp.'
        when lower(coalesce(a.organism,'')) like '%acinetobacter%' then 'Acinetobacter spp.'
        when lower(coalesce(a.organism,'')) like '%klebsiella%' then 'Klebsiella spp.'
        when lower(coalesce(a.organism,'')) like '%enterobacter%' then 'Enterobacter spp.'
        when lower(coalesce(a.organism,'')) like '%pseudomonas%' then 'Pseudomonas aeruginosa'
        when lower(coalesce(a.organism,'')) like '%staphylococcus aureus%' then 'Staphylococcus aureus'
        when lower(coalesce(a.organism,'')) like '%enterococcus%' then 'Enterococcus spp.'
      end as organism_group,
      (
        (lower(coalesce(a.organism,'')) like '%escherichia coli%' and (a.antimicrobial_code='ABX-CRO' or lower(coalesce(a.antimicrobial_name,'')) like '%ceftriaxone%'))
        or (lower(coalesce(a.organism,'')) like '%proteus%' and (a.antimicrobial_code='ABX-CRO' or lower(coalesce(a.antimicrobial_name,'')) like '%ceftriaxone%'))
        or (lower(coalesce(a.organism,'')) like '%acinetobacter%' and (a.antimicrobial_code='ABX-MEM' or lower(coalesce(a.antimicrobial_name,'')) like '%meropenem%'))
        or (lower(coalesce(a.organism,'')) like '%klebsiella%' and (a.antimicrobial_code='ABX-MEM' or lower(coalesce(a.antimicrobial_name,'')) like '%meropenem%'))
        or (lower(coalesce(a.organism,'')) like '%enterobacter%' and (a.antimicrobial_code='ABX-CRO' or lower(coalesce(a.antimicrobial_name,'')) like '%ceftriaxone%'))
        or (lower(coalesce(a.organism,'')) like '%pseudomonas%' and (a.antimicrobial_code='ABX-MEM' or lower(coalesce(a.antimicrobial_name,'')) like '%meropenem%'))
        or (lower(coalesce(a.organism,'')) like '%staphylococcus aureus%' and (a.antimicrobial_code='ABX-OXA' or lower(coalesce(a.antimicrobial_name,'')) like '%oxacillin%'))
        or (lower(coalesce(a.organism,'')) like '%enterococcus%' and (a.antimicrobial_code='ABX-VAN' or lower(coalesce(a.antimicrobial_name,'')) like '%vancomycin%'))
      ) as is_reference_drug,
      a.sir_category,
      coalesce(l.patient_id::text, 'sample:' || l.id::text) as patient_key,
      l.collected_at,
      l.id as sample_id
    from antimicrobial_susceptibility_results a
    join microbiology_results m on m.id = a.microbiology_result_id and m.organization_id = a.organization_id
    join laboratory_samples l on l.id = m.sample_id
    where a.organization_id = p_organization_id
      and (p_department_id is null or l.department_id = p_department_id)
      and m.result_status = 'positive'
      and m.validation_status in ('validated', 'amended')
      and not exists (
        select 1 from microbiology_results m2
        where m2.organization_id = m.organization_id and m2.amended_from = m.id
      )
      and (p_from is null or l.collected_at::date >= p_from)
      and (p_to is null or l.collected_at::date <= p_to)
  ),
  -- ECDC/EARS-Net and CLSI M39: only the first isolate per patient, organism
  -- group and calendar year counts (the earliest one tested with the
  -- reference antimicrobial).
  first_isolates as (
    select distinct on (patient_key, organism_group, extract(year from collected_at))
      organism_group, sir_category
    from matched
    where organism_group is not null and is_reference_drug
    order by patient_key, organism_group, extract(year from collected_at), collected_at, sample_id
  )
  select organism_group, count(*) as tested, count(*) filter (where sir_category = 'R') as resistant
  from first_isolates
  group by organism_group
  order by tested desc;
$function$;

create table if not exists public.notifiable_disease_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  finding_key text not null,
  sample_id uuid references public.laboratory_samples(id) on delete set null,
  disease_code text not null,
  status text not null default 'pending' check (status in ('pending','notified','not_required')),
  notified_at date,
  reference text,
  notes text,
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (organization_id, finding_key)
);

create index if not exists notifiable_disease_reports_sample_idx on public.notifiable_disease_reports(sample_id);

alter table public.notifiable_disease_reports enable row level security;

create policy notifiable_disease_reports_read on public.notifiable_disease_reports
  for select to authenticated
  using ((select public.current_user_is_platform_owner()) or public.current_user_has_org_role(organization_id, array['hospital_admin','infection_control_lead','infection_control_member','laboratory']::public.app_role[]));

create policy notifiable_disease_reports_insert on public.notifiable_disease_reports
  for insert to authenticated
  with check (public.current_user_has_org_role(organization_id, array['hospital_admin','infection_control_lead','infection_control_member','laboratory']::public.app_role[]));

create policy notifiable_disease_reports_update on public.notifiable_disease_reports
  for update to authenticated
  using (public.current_user_has_org_role(organization_id, array['hospital_admin','infection_control_lead','infection_control_member','laboratory']::public.app_role[]))
  with check (public.current_user_has_org_role(organization_id, array['hospital_admin','infection_control_lead','infection_control_member','laboratory']::public.app_role[]));

drop trigger if exists audit_notifiable_disease_reports on public.notifiable_disease_reports;
create trigger audit_notifiable_disease_reports after insert or update or delete on public.notifiable_disease_reports for each row execute function public.capture_clinical_audit();
