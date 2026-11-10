-- Legacy FileMaker names -> linked people.
-- Records brought over from FileMaker keep the person only as free text (owner_label, reported_by_label, ...). This adds
-- NEW nullable link columns to public.employees(id) next to those text columns, a name key, and a backfill that links a
-- text to an employee ONLY when exactly one employee of the same organization has that name (either order, Greek or
-- English, accents and case ignored). Ambiguous or unmatched names stay NULL and are listed in legacy_person_matches
-- for the hospital administrator to resolve through resolve_legacy_person(). The text columns are never changed.

-- One key per name: upper case, no Greek accents, punctuation as space, words sorted -> «ΕΠΩΝΥΜΟ ΟΝΟΜΑ» = «ΟΝΟΜΑ ΕΠΩΝΥΜΟ».
create or replace function public.normalize_person_name(p_name text)
returns text
language sql
immutable
set search_path to ''
as $$
  select coalesce(array_to_string(array(
    select w from unnest(regexp_split_to_array(
      upper(translate(coalesce(p_name, ''), 'άέήίόύώϊϋΐΰςΆΈΉΊΌΎΏΪΫ.,-_/', 'ΑΕΗΙΟΥΩΙΥΙΥΣΑΕΗΙΟΥΩΙΥ     ')),
      '\s+')) as w
    where w <> '' order by w), ' '), '')
$$;

-- New link columns (all nullable, next to the text they resolve).
alter table public.quality_findings add column if not exists owner_employee_id uuid references public.employees(id) on delete set null;
alter table public.quality_findings add column if not exists reported_by_employee_id uuid references public.employees(id) on delete set null;
alter table public.quality_findings add column if not exists verified_by_employee_id uuid references public.employees(id) on delete set null;
alter table public.quality_incidents add column if not exists owner_employee_id uuid references public.employees(id) on delete set null;
alter table public.quality_incidents add column if not exists reported_by_employee_id uuid references public.employees(id) on delete set null;
alter table public.quality_capa_actions add column if not exists owner_employee_id uuid references public.employees(id) on delete set null;
alter table public.quality_capa_sub_actions add column if not exists owner_employee_id uuid references public.employees(id) on delete set null;
alter table public.quality_audits add column if not exists owner_employee_id uuid references public.employees(id) on delete set null;
alter table public.quality_audits add column if not exists lead_auditor_employee_id uuid references public.employees(id) on delete set null;
alter table public.quality_risks add column if not exists owner_employee_id uuid references public.employees(id) on delete set null;
alter table public.quality_risk_opportunities add column if not exists owner_employee_id uuid references public.employees(id) on delete set null;
alter table public.quality_objectives add column if not exists owner_employee_id uuid references public.employees(id) on delete set null;
alter table public.quality_incident_blue_codes add column if not exists doctor_employee_id uuid references public.employees(id) on delete set null;
alter table public.quality_incident_blue_codes add column if not exists nurse_employee_id uuid references public.employees(id) on delete set null;
alter table public.committee_decisions add column if not exists owner_employee_id uuid references public.employees(id) on delete set null;
alter table public.committee_plan_items add column if not exists owner_employee_id uuid references public.employees(id) on delete set null;
alter table public.training_programs add column if not exists owner_employee_id uuid references public.employees(id) on delete set null;
alter table public.training_programs add column if not exists trainer_employee_id uuid references public.employees(id) on delete set null;

-- Which text column resolves into which link column (the only tables and columns the resolve function may touch).
create or replace function private.legacy_person_sources()
returns table (source_table text, label_column text, link_column text)
language sql
immutable
set search_path to ''
as $$
  select * from (values
    ('quality_findings', 'owner_label', 'owner_employee_id'),
    ('quality_findings', 'reported_by_label', 'reported_by_employee_id'),
    ('quality_findings', 'verified_by_label', 'verified_by_employee_id'),
    ('quality_incidents', 'owner_label', 'owner_employee_id'),
    ('quality_incidents', 'reported_by_label', 'reported_by_employee_id'),
    ('quality_capa_actions', 'owner_label', 'owner_employee_id'),
    ('quality_capa_sub_actions', 'owner_label', 'owner_employee_id'),
    ('quality_audits', 'owner_label', 'owner_employee_id'),
    ('quality_audits', 'lead_auditor_label', 'lead_auditor_employee_id'),
    ('quality_risks', 'owner_label', 'owner_employee_id'),
    ('quality_risk_opportunities', 'owner_label', 'owner_employee_id'),
    ('quality_objectives', 'owner_label', 'owner_employee_id'),
    ('quality_incident_blue_codes', 'doctor_label', 'doctor_employee_id'),
    ('quality_incident_blue_codes', 'nurse_label', 'nurse_employee_id'),
    ('committee_decisions', 'owner_label', 'owner_employee_id'),
    ('committee_plan_items', 'owner_label', 'owner_employee_id'),
    ('training_programs', 'owner', 'owner_employee_id'),
    ('training_programs', 'trainer', 'trainer_employee_id')
  ) as s(source_table, label_column, link_column)
$$;

-- One row per organization, column and distinct text: who it was matched to, or why not.
create table if not exists public.legacy_person_matches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_table text not null,
  source_column text not null,
  label text not null,
  employee_id uuid references public.employees(id) on delete set null,
  status text not null check (status in ('matched', 'ambiguous', 'unmatched')),
  candidate_employee_ids uuid[] not null default '{}',
  row_count integer not null default 0,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, source_table, source_column, label)
);
create index if not exists legacy_person_matches_org_status_idx on public.legacy_person_matches (organization_id, status);
create index if not exists legacy_person_matches_employee_idx on public.legacy_person_matches (employee_id);

alter table public.legacy_person_matches enable row level security;

create policy legacy_person_matches_select on public.legacy_person_matches
  for select to authenticated
  using (
    public.current_user_is_platform_owner()
    or public.current_user_has_org_role(organization_id, array['hospital_admin'::public.app_role, 'quality_manager'::public.app_role])
    or public.current_user_has_capability(organization_id, 'manage_quality')
  );

-- The backfill. Safe to run again: it only fills link columns that are still empty and never touches a text column.
create or replace function private.legacy_person_refresh(p_organization_id uuid default null)
returns integer
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  s record;
  v_linked integer := 0;
  v_n integer;
begin
  for s in select * from private.legacy_person_sources() loop
    -- every distinct text with its candidate employees of the same organization
    execute format($q$
      insert into public.legacy_person_matches
        (organization_id, source_table, source_column, label, employee_id, status, candidate_employee_ids, row_count)
      select t.organization_id, %L, %L, t.label,
             case when cardinality(c.ids) = 1 then c.ids[1] end,
             case when cardinality(c.ids) = 1 then 'matched' when cardinality(c.ids) > 1 then 'ambiguous' else 'unmatched' end,
             coalesce(c.ids, '{}'), t.n
      from (select organization_id, %I as label, count(*)::integer as n from public.%I
            where %I is not null and btrim(%I) <> '' and ($1 is null or organization_id = $1)
            group by organization_id, %I) t
      left join lateral (
        select array_agg(e.id order by e.id) as ids from public.employees e
        where e.organization_id = t.organization_id
          and public.normalize_person_name(t.label) <> ''
          and public.normalize_person_name(t.label) in (
            public.normalize_person_name(concat_ws(' ', e.first_name, e.last_name)),
            public.normalize_person_name(concat_ws(' ', e.first_name_en, e.last_name_en)))
      ) c on true
      on conflict (organization_id, source_table, source_column, label) do update
        set row_count = excluded.row_count
        where public.legacy_person_matches.resolved_at is null
    $q$, s.source_table, s.label_column, s.label_column, s.source_table, s.label_column, s.label_column, s.label_column)
    using p_organization_id;

    -- link only the rows still empty, only for unique matches
    execute format($q$
      update public.%I r set %I = m.employee_id
      from public.legacy_person_matches m
      where m.organization_id = r.organization_id and m.source_table = %L and m.source_column = %L
        and m.status = 'matched' and m.employee_id is not null and m.label = r.%I
        and r.%I is null and ($1 is null or r.organization_id = $1)
    $q$, s.source_table, s.link_column, s.source_table, s.label_column, s.label_column, s.link_column)
    using p_organization_id;
    get diagnostics v_n = row_count;
    v_linked := v_linked + v_n;
  end loop;
  return v_linked;
end
$fn$;

-- Resolve one text by hand: hospital administrator (or Platform Owner) picks the employee (or null to clear it);
-- every row of the organization with that text gets the link. The change is written to system_audit_log.
create or replace function public.resolve_legacy_person(
  p_organization_id uuid,
  p_source_table text,
  p_source_column text,
  p_label text,
  p_employee_id uuid
)
returns integer
language plpgsql
security definer
set search_path to ''
as $fn$
declare
  v_actor uuid := auth.uid();
  v_link text;
  v_match public.legacy_person_matches%rowtype;
  v_count integer;
begin
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not public.is_org_admin(p_organization_id) then
    raise exception 'Only the hospital administrator can resolve legacy names' using errcode = '42501';
  end if;
  select s.link_column into v_link from private.legacy_person_sources() s
    where s.source_table = p_source_table and s.label_column = p_source_column;
  if v_link is null then
    raise exception 'Unknown legacy person column' using errcode = '22023';
  end if;
  select * into v_match from public.legacy_person_matches
    where organization_id = p_organization_id and source_table = p_source_table
      and source_column = p_source_column and label = p_label;
  if not found then
    raise exception 'Legacy name not found' using errcode = 'P0002';
  end if;
  if p_employee_id is not null and not exists (
    select 1 from public.employees e where e.id = p_employee_id and e.organization_id = p_organization_id
  ) then
    raise exception 'Employee does not belong to this organization' using errcode = '22023';
  end if;

  execute format('update public.%I set %I = $1 where organization_id = $2 and %I = $3', p_source_table, v_link, p_source_column)
    using p_employee_id, p_organization_id, p_label;
  get diagnostics v_count = row_count;

  update public.legacy_person_matches
     set employee_id = p_employee_id,
         status = case when p_employee_id is not null then 'matched'
                       when cardinality(candidate_employee_ids) > 1 then 'ambiguous' else 'unmatched' end,
         resolved_by = v_actor, resolved_at = now(), row_count = v_count
   where id = v_match.id;

  insert into public.system_audit_log(organization_id, actor_user_id, event_type, entity_type, entity_id, metadata)
  values (p_organization_id, v_actor, 'legacy_person.resolved', p_source_table, v_match.id::text,
          jsonb_build_object('column', p_source_column, 'label', p_label, 'employee_id', p_employee_id, 'rows', v_count));
  return v_count;
end
$fn$;

-- Only on the function created here (a new function is executable by everybody until this).
revoke execute on function public.resolve_legacy_person(uuid, text, text, text, uuid) from public, anon;
grant execute on function public.resolve_legacy_person(uuid, text, text, text, uuid) to authenticated;

-- Backfill (link columns only).
select private.legacy_person_refresh();
