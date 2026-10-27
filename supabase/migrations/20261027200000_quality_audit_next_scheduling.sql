-- Quality → Audits: every department is audited twice a year, and the next audit
-- is always planned.
--
-- quality_schedule_next_audit(audit)   plans the department's next internal audit
--                                      when none is open: the same standard,
--                                      questionnaire, risk, frequency and lead
--                                      auditor, `frequency_months` (6 when not set)
--                                      after the last one, as a month only (the 15th),
--                                      never in the past. Returns its id, or null
--                                      when there is nothing to plan.
-- trigger on quality_audits            when an audit becomes «completed», its
--                                      department's next one is planned. A failure
--                                      here never stops the audit from completing.
-- quality_fill_audit_programme(org)    the same for every department whose audits
--                                      have no open one (the «Συμπλήρωση προγράμματος»
--                                      button); returns how many were planned.
--
-- Both run as the caller (security invoker): row-level security of quality_audits
-- decides who may plan.

create or replace function public.quality_schedule_next_audit(p_audit_id uuid)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  a public.quality_audits%rowtype;
  due date;
  next_id uuid := gen_random_uuid();
begin
  select * into a from public.quality_audits where id = p_audit_id;
  if not found
     or a.department_id is null
     or a.lifecycle_status = 'voided'
     or coalesce(a.audit_kind, a.audit_type) <> 'internal' then
    return null;
  end if;
  if exists (
    select 1 from public.quality_audits o
    where o.organization_id = a.organization_id
      and o.department_id = a.department_id
      and coalesce(o.standard, '') = coalesce(a.standard, '')
      and o.status in ('planned', 'in_progress')
      and o.lifecycle_status <> 'voided'
  ) then
    return null;
  end if;

  due := (date_trunc('month', coalesce(a.completed_date, a.planned_date, current_date))
          + make_interval(months => coalesce(a.frequency_months, 6)))::date + 14;
  if due < current_date then
    due := (date_trunc('month', current_date) + interval '1 month')::date + 14;
  end if;

  insert into public.quality_audits (
    id, organization_id, code, title, title_en, audit_type, audit_kind, department_id, scope,
    planned_date, planned_month_only, status, lead_auditor_id, lead_auditor_label,
    template_id, template_title, template_version, standard, clauses_scope,
    risk_level, frequency_months, source, history, owner_labels
  ) values (
    next_id, a.organization_id,
    'AUD-' || to_char(due, 'YYMM') || '-' || upper(substr(md5(random()::text || next_id::text), 1, 6)),
    a.title, a.title_en, a.audit_type, a.audit_kind, a.department_id, a.scope,
    due, true, 'planned', a.lead_auditor_id, a.lead_auditor_label,
    a.template_id, a.template_title, a.template_version, a.standard, a.clauses_scope,
    a.risk_level, coalesce(a.frequency_months, 6), 'app', '[]'::jsonb, '{}'
  );
  return next_id;
end;
$$;

create or replace function public.quality_audits_schedule_next()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  begin
    perform public.quality_schedule_next_audit(new.id);
  exception when others then
    null;
  end;
  return null;
end;
$$;

create trigger trg_quality_audits_schedule_next
  after update of status on public.quality_audits
  for each row
  when (new.status = 'completed' and old.status is distinct from 'completed')
  execute function public.quality_audits_schedule_next();

create or replace function public.quality_fill_audit_programme(p_organization_id uuid)
returns integer
language plpgsql
set search_path = public
as $$
declare
  last_audit record;
  planned integer := 0;
begin
  for last_audit in
    select distinct on (department_id, coalesce(standard, '')) id
    from public.quality_audits
    where organization_id = p_organization_id
      and department_id is not null
      and lifecycle_status <> 'voided'
      and status <> 'cancelled'
      and coalesce(audit_kind, audit_type) = 'internal'
    order by department_id, coalesce(standard, ''), coalesce(completed_date, planned_date) desc nulls last
  loop
    if public.quality_schedule_next_audit(last_audit.id) is not null then
      planned := planned + 1;
    end if;
  end loop;
  return planned;
end;
$$;

grant execute on function public.quality_fill_audit_programme(uuid) to authenticated;
