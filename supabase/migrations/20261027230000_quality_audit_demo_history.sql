-- Demo hospitals only (organizations.is_demo): the audit history of 2023-2026.
-- Two rounds a year (May and November, three days each, the departments spread
-- over the days): an ISO 9001 audit of every clinical department, ISO 15224 and
-- JCI audits of some, and one organization-wide TEMOS, ISO 15189 and HACCP audit a
-- year, all completed with the system questionnaires answered, a few «Partial» and
-- «No» answers classified, and at most one finding per audit (about half of them).
-- Production hospitals are never touched. Re-running adds nothing (codes AUD-…-97nnnn).
-- (Applied as one statement list; the temporary table drops itself at commit.)

create temp table seed_plan on commit drop as
with orgs as (
  select o.id from public.organizations o
  where o.is_demo
    and not exists (select 1 from public.quality_audits a where a.organization_id = o.id and a.code like 'AUD-______-97____')
),
deps as (
  select d.organization_id as org_id, d.id, d.name, row_number() over (partition by d.organization_id order by d.name) - 1 as idx
  from public.departments d join orgs on orgs.id = d.organization_id
  where d.department_type in ('general', 'icu', 'nicu')
),
rounds as (
  select y, m from generate_series(2023, 2026) y cross join (values (5), (11)) as r(m)
  where not (y = 2026 and m = 11)
),
base as (
  select d.org_id, d.id as department_id, d.name as department_name, 'iso9001'::text as standard,
         make_date(r.y, r.m, 10 + (d.idx % 3)::int) as day
  from deps d cross join rounds r
  union all
  select d.org_id, d.id, d.name, 'iso15224', make_date(r.y, 5, 13)
  from deps d cross join rounds r where r.m = 5 and (d.idx % 3) = 1
  union all
  select d.org_id, d.id, d.name, 'jci', make_date(r.y, 11, 13)
  from deps d cross join rounds r where r.m = 11 and (d.idx % 3) = 2
  union all
  select orgs.id, null, null, 'temos', make_date(y, 9, 15) from orgs cross join generate_series(2023, 2026) y
  union all
  select orgs.id, null, null, 'iso15189', make_date(y, 10, 6) from orgs cross join generate_series(2023, 2025) y
  union all
  select orgs.id, null, null, 'haccp', make_date(y, 10, 7) from orgs cross join generate_series(2023, 2025) y
)
select gen_random_uuid() as id, b.*,
       row_number() over (partition by b.org_id order by b.day, b.standard, b.department_name) as n
from base b
where b.day < date '2026-10-01';

insert into public.quality_audits (
  id, organization_id, code, title, audit_type, audit_kind, department_id, scope, planned_date, planned_month_only,
  completed_date, status, lead_auditor_label, template_id, template_title, template_version, standard,
  risk_level, frequency_months, source, history, owner_labels, duration_days, audit_body, conclusion
)
select p.id, p.org_id,
       'AUD-' || to_char(p.day, 'YYMMDD') || '-97' || lpad(p.n::text, 4, '0'),
       'Εσωτερική επιθεώρηση ' || upper(p.standard) || coalesce(' — ' || p.department_name, ' — Όλος ο οργανισμός'),
       'internal', 'internal', p.department_id, 'Εσωτερική επιθεώρηση του Τμήματος Ποιότητας', p.day, false,
       p.day, 'completed', 'Υπεύθυνος Ποιότητας', t.id, t.title, t.version, p.standard,
       'high', 6, 'seed', '[]'::jsonb, '{}', 1, 'internal',
       'Το τμήμα συμμορφώνεται στο μεγαλύτερο μέρος των απαιτήσεων· οι διαπιστώσεις παρακολουθούνται από το Τμήμα Ποιότητας.'
from seed_plan p
join public.quality_audit_templates t on t.is_system and t.standard = p.standard;

insert into public.quality_audit_checklist_items (
  organization_id, audit_id, position, item, answer, result, template_question_id, chapter_ref, chapter_title,
  clause_ref, guidance, evidence_required, weight, critical, finding_class, required
)
select p.org_id, p.id, q.position, q.question,
       case r.result when 'partial' then 'no' else r.result end, r.result, q.id, q.chapter_ref, q.chapter_title,
       q.clause_ref, q.guidance, q.evidence, coalesce(q.weight, 1), coalesce(q.critical, false),
       case r.result when 'partial' then 'observation' when 'no' then 'minor' end, true
from seed_plan p
join public.quality_audit_templates t on t.is_system and t.standard = p.standard
join public.quality_audit_template_questions q on q.template_id = t.id
cross join lateral (
  select case
    when h < 800 + (extract(year from p.day)::int - 2023) * 40 then 'yes'
    when h < 900 + (extract(year from p.day)::int - 2023) * 40 then 'partial'
    when h < 930 + (extract(year from p.day)::int - 2023) * 32 then 'no'
    else 'na' end as result
  from (select abs(hashtext(p.id::text || q.id::text)) % 1000 as h) x
) r;

with picked as (
  select distinct on (c.audit_id) c.id as item_id, c.audit_id, c.item, c.clause_ref, p.org_id, p.day, p.department_id, p.standard,
         a.code as audit_code, p.n
  from public.quality_audit_checklist_items c
  join seed_plan p on p.id = c.audit_id
  join public.quality_audits a on a.id = c.audit_id
  where c.result = 'no' and abs(hashtext(c.audit_id::text)) % 100 < 55
  order by c.audit_id, c.position
), made as (
  insert into public.quality_findings (
    organization_id, code, title, department_id, identified_at, severity, status, description, source_type, source_id,
    finding_class, audit_item_id, clause_ref, standard, due_date, verification_status, history
  )
  select pk.org_id, 'FND-' || to_char(pk.day, 'YYMMDD') || '-97' || lpad(pk.n::text, 4, '0'), left(pk.item, 140), pk.department_id,
         (pk.day::text || 'T12:00:00+02')::timestamptz, 'medium',
         case when pk.day < date '2026-01-01' then 'closed' else 'open' end,
         pk.item, 'audit', pk.audit_code, 'minor', pk.item_id, pk.clause_ref, pk.standard, pk.day + 60,
         case when pk.day < date '2026-01-01' then 'effective' else 'pending' end, '[]'::jsonb
  from picked pk
  returning id, audit_item_id
)
update public.quality_audit_checklist_items c set finding_id = m.id from made m where c.id = m.audit_item_id;
