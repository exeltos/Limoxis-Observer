-- Limoxis Observer v0.28.8
-- Applied live during this session's backend audit + Employees domain wiring;
-- committed here so a fresh `supabase db push` reproduces the current live
-- database exactly, rather than leaving these changes as drift that only
-- exists in the hosted project.

-- 1) Employees frontend field gap (see src/features/employees/employeeService.js
--    header comment for the full department/profession-as-text rationale).
alter table public.employees
  add column if not exists father_name text,
  add column if not exists first_name_en text,
  add column if not exists last_name_en text,
  add column if not exists birth_date date,
  add column if not exists department_name text,
  add column if not exists department_name_en text,
  add column if not exists profession_name text,
  add column if not exists profession_name_en text;

-- 2) platform_report_summary existed in v0278_platform_center.sql but was
--    missing from the live database despite loadGlobalReportSummary() in
--    platformService.js calling it — restored verbatim.
create or replace function public.platform_report_summary(p_organization_id uuid default null,p_from date default null,p_to date default null)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare r jsonb;
begin
 if not public.current_user_is_platform_owner() then raise exception 'platform owner required'; end if;
 select jsonb_build_object(
  'surveillance',(select count(*) from public.surveillance_cases s where (p_organization_id is null or s.organization_id=p_organization_id) and (p_from is null or s.created_at::date>=p_from) and (p_to is null or s.created_at::date<=p_to)),
  'laboratory',(select count(*) from public.laboratory_samples l where (p_organization_id is null or l.organization_id=p_organization_id) and (p_from is null or l.created_at::date>=p_from) and (p_to is null or l.created_at::date<=p_to)),
  'prevention',((select count(*) from public.hand_hygiene_sessions p where (p_organization_id is null or p.organization_id=p_organization_id) and (p_from is null or p.created_at::date>=p_from) and (p_to is null or p.created_at::date<=p_to)) + (select count(*) from public.waste_measurements p where (p_organization_id is null or p.organization_id=p_organization_id) and (p_from is null or p.created_at::date>=p_from) and (p_to is null or p.created_at::date<=p_to)) + (select count(*) from public.prevention_bundle_assessments p where (p_organization_id is null or p.organization_id=p_organization_id) and (p_from is null or p.created_at::date>=p_from) and (p_to is null or p.created_at::date<=p_to))),
  'controls',(select count(*) from public.control_executions c where (p_organization_id is null or c.organization_id=p_organization_id) and (p_from is null or c.created_at::date>=p_from) and (p_to is null or c.created_at::date<=p_to)),
  'quality',((select count(*) from public.quality_incidents q where (p_organization_id is null or q.organization_id=p_organization_id) and (p_from is null or q.created_at::date>=p_from) and (p_to is null or q.created_at::date<=p_to)) + (select count(*) from public.quality_findings q where (p_organization_id is null or q.organization_id=p_organization_id) and (p_from is null or q.created_at::date>=p_from) and (p_to is null or q.created_at::date<=p_to)) + (select count(*) from public.quality_capa_actions q where (p_organization_id is null or q.organization_id=p_organization_id) and (p_from is null or q.created_at::date>=p_from) and (p_to is null or q.created_at::date<=p_to))),
  'training',(select count(*) from public.training_records t where (p_organization_id is null or t.organization_id=p_organization_id) and (p_from is null or t.created_at::date>=p_from) and (p_to is null or t.created_at::date<=p_to)),
  'documents',(select count(*) from public.controlled_documents d where (p_organization_id is null or d.organization_id=p_organization_id) and (p_from is null or d.created_at::date>=p_from) and (p_to is null or d.created_at::date<=p_to)),
  'committees',(select count(*) from public.committees c where (p_organization_id is null or c.organization_id=p_organization_id) and (p_from is null or c.created_at::date>=p_from) and (p_to is null or c.created_at::date<=p_to)),
  'handHygiene',(select count(*) from public.hand_hygiene_sessions p where (p_organization_id is null or p.organization_id=p_organization_id) and (p_from is null or p.created_at::date>=p_from) and (p_to is null or p.created_at::date<=p_to)),
  'waste',(select count(*) from public.waste_measurements p where (p_organization_id is null or p.organization_id=p_organization_id) and (p_from is null or p.created_at::date>=p_from) and (p_to is null or p.created_at::date<=p_to)),
  'antimicrobial',(select count(*) from public.antimicrobial_therapies a where (p_organization_id is null or a.organization_id=p_organization_id) and (p_from is null or a.created_at::date>=p_from) and (p_to is null or a.created_at::date<=p_to)),'occupationalHealth',(select count(*) from public.occupational_health_visits o where (p_organization_id is null or o.organization_id=p_organization_id) and (p_from is null or o.created_at::date>=p_from) and (p_to is null or o.created_at::date<=p_to))
 ) into r; return r;
end $$;

grant execute on function public.platform_report_summary(uuid,date,date) to authenticated;

-- 3) generate_username's whitespace regex was '\\s+' (a plain string literal,
--    so Postgres passes the regex engine two literal backslashes followed by
--    "s+", which never matches a space) instead of '\s+'. Every real
--    "first last" name therefore got a surname initial of 'X' instead of the
--    person's actual surname. Verified live before/after with real Greek names.
create or replace function public.generate_username(source_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  parts text[];
  first_token text;
  last_token text;
  first_latin text;
  last_latin text;
  prefix text;
  candidate text;
  attempts int := 0;
begin
  parts := regexp_split_to_array(trim(coalesce(source_name,'')), '\s+');
  first_token := coalesce(parts[1], 'x');
  last_token := case when array_length(parts,1) > 1 then parts[array_length(parts,1)] else 'x' end;
  first_latin := upper(substr(public.greek_to_latin(first_token),1,1));
  last_latin := upper(substr(public.greek_to_latin(last_token),1,1));
  prefix := coalesce(nullif(first_latin,''),'X') || coalesce(nullif(last_latin,''),'X');
  loop
    attempts := attempts + 1;
    candidate := prefix || lpad((10000 + floor(random()*90000))::int::text,5,'0');
    exit when not exists(select 1 from public.profiles where username=candidate);
    if attempts >= 100 then raise exception 'Could not allocate unique username'; end if;
  end loop;
  return candidate;
end;
$$;

-- 4) public.surveillance_cases/surveillance_events had RLS enabled with a
--    read-only policy since v0.4.0 — that migration's own comment said write
--    policies were deferred to "the next hardening pass" via controlled
--    RPCs, which never happened in any of the following 28 migrations.
--    Creating a new surveillance episode — the single most central clinical
--    action in this product — was blocked outright at the database level.
--    Matches the exact role set already used by every sibling clinical
--    write policy in this domain (clinical_assessments_write,
--    isolation_episodes_write, hai_classification_write).
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='surveillance_cases' and policyname='surveillance_cases_write') then
    create policy surveillance_cases_write on public.surveillance_cases for all using (
      public.current_user_has_org_role(organization_id, array['infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[])
    ) with check (
      public.current_user_has_org_role(organization_id, array['infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[])
    );
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='surveillance_events' and policyname='surveillance_events_write') then
    create policy surveillance_events_write on public.surveillance_events for all using (
      exists (
        select 1 from public.surveillance_cases sc
        where sc.id = surveillance_case_id
          and public.current_user_has_org_role(sc.organization_id, array['infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[])
      )
    ) with check (
      exists (
        select 1 from public.surveillance_cases sc
        where sc.id = surveillance_case_id
          and public.current_user_has_org_role(sc.organization_id, array['infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[])
      )
    );
  end if;
end $$;
