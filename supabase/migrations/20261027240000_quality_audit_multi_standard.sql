-- Quality → Audits: one audit of a department can cover several standards.
--   quality_audits.standards            the standards besides the main one (standard)
--   quality_audit_checklist_items.standard   the standard a question comes from, so
--                                       the answers, the score and the report are
--                                       kept per standard as well as overall.
alter table public.quality_audits add column if not exists standards text[] not null default '{}';
alter table public.quality_audit_checklist_items add column if not exists standard text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'quality_audit_checklist_items_standard_check' and conrelid = 'public.quality_audit_checklist_items'::regclass) then
    alter table public.quality_audit_checklist_items add constraint quality_audit_checklist_items_standard_check
      check (standard is null or standard in ('iso9001', 'iso15224', 'haccp', 'iso15189', 'temos', 'jci', 'other'));
  end if;
end $$;

-- The answers already kept come from their audit's one standard.
update public.quality_audit_checklist_items c set standard = a.standard
from public.quality_audits a
where a.id = c.audit_id and c.standard is null and a.standard is not null;

-- The next audit a completed one plans keeps all its standards (and who carries it out).
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
    template_id, template_title, template_version, standard, standards, clauses_scope,
    risk_level, frequency_months, source, history, owner_labels, audit_body
  ) values (
    next_id, a.organization_id,
    'AUD-' || to_char(due, 'YYMM') || '-' || upper(substr(md5(random()::text || next_id::text), 1, 6)),
    a.title, a.title_en, a.audit_type, a.audit_kind, a.department_id, a.scope,
    due, true, 'planned', a.lead_auditor_id, a.lead_auditor_label,
    a.template_id, a.template_title, a.template_version, a.standard, a.standards, a.clauses_scope,
    a.risk_level, coalesce(a.frequency_months, 6), 'app', '[]'::jsonb, '{}', a.audit_body
  );
  return next_id;
end;
$$;
