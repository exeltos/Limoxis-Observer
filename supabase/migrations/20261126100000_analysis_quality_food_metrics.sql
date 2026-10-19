-- Analysis → «Ποιότητα & ασφάλεια τροφίμων»: audits, suppliers, the kitchen
-- (HACCP), satisfaction surveys and risks in one read.
--
-- Returns {"qualityFood": {...}} with plain counters and [key, ...counts] rows
-- (the same shape src/features/analysis/analysisQualityFood.js builds for the
-- demo), so the platform view adds hospitals up and rates are worked out when
-- shown. Counts only: never a name of a patient, an employee or a respondent.
--
--   audits       completed in the period (completed_date); answers on four
--                values, compliant = «yes» over applicable = yes / partial / no;
--                open audit findings as they stand today.
--   suppliers    the active ones; evaluations of the period with their score
--                (the stored total, else worked out from the criteria scores, as
--                the app does); certificates expiring within 60 days / expired
--                today; nonconformities of the period and still open.
--   kitchen      receipts, production days already past, heat treatments with a
--                measurement, defrosts ended and stock write-offs of the period,
--                with the in / out of limits status the database keeps.
--   surveys      the 1–5 answers of the responses of the period: satisfied = 4–5
--                over answered (surveyModel.satisfactionCounts).
--   risks        the assessment in force at the end of the period (the latest
--                assessed by then, a submitted one before a draft): residual
--                level of each risk, opportunities not yet assessed.
--
-- A department narrows audits, findings and survey responses (they carry one);
-- suppliers, the kitchen and risks belong to the organization.
--
-- Access as analysis_domain_metrics: Platform Owner, or Hospital Admin / IPC
-- Lead of the organization; the Quality Manager too (the Quality pages are
-- theirs). Date filters are on the columns themselves so the indexes are used.

create index if not exists kitchen_stock_writeoffs_org_idx on public.kitchen_stock_writeoffs (organization_id, written_off_on);
create index if not exists kitchen_defrosting_org_ended_idx on public.kitchen_defrosting (organization_id, ended_at) where ended_at is not null;
create index if not exists quality_audits_org_completed_idx on public.quality_audits (organization_id, completed_date) where status = 'completed';
create index if not exists quality_survey_responses_org_submitted_idx on public.quality_survey_responses (organization_id, submitted_at);

create or replace function public.analysis_quality_food_metrics(
  p_organization_id uuid default null,
  p_from date default null,
  p_to date default null,
  p_department_id uuid default null
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := current_date;
  v_audits jsonb;
  v_suppliers jsonb;
  v_kitchen jsonb;
  v_surveys jsonb;
  v_risks jsonb;
begin
  if public.current_user_is_platform_owner() then
    null;
  elsif p_organization_id is null or not public.current_user_has_org_role(
    p_organization_id,
    array['hospital_admin','infection_control_lead','quality_manager']::public.app_role[]
  ) then
    raise exception 'analytics access denied';
  end if;

  -- Audits and their findings.
  with au as (
    select a.id, coalesce(a.standard, 'other') as standard
    from public.quality_audits a
    where (p_organization_id is null or a.organization_id = p_organization_id)
      and (p_department_id is null or a.department_id = p_department_id)
      and a.status = 'completed' and a.voided_at is null
      and (p_from is null or a.completed_date >= p_from)
      and (p_to is null or a.completed_date <= p_to)
  ),
  ans as (
    select au.standard, coalesce(i.result, i.answer) as result
    from au
    join public.quality_audit_checklist_items i on i.audit_id = au.id
    where coalesce(i.result, i.answer) in ('yes', 'partial', 'no')
  ),
  st as (
    select ans.standard, count(*) as applicable, count(*) filter (where ans.result = 'yes') as compliant
    from ans group by ans.standard
  ),
  fo as (
    select coalesce(f.finding_class, 'unclassified') as finding_class
    from public.quality_findings f
    where (p_organization_id is null or f.organization_id = p_organization_id)
      and (p_department_id is null or f.department_id = p_department_id)
      and f.source_type = 'audit' and f.status <> 'closed' and f.voided_at is null
  )
  select jsonb_build_object(
    'audits', (select count(*) from au),
    'auditsPlanned', (
      select count(*) from public.quality_audits a
      where (p_organization_id is null or a.organization_id = p_organization_id)
        and (p_department_id is null or a.department_id = p_department_id)
        and a.status in ('planned', 'in_progress') and a.voided_at is null
        and (p_from is null or a.planned_date >= p_from)
        and (p_to is null or a.planned_date <= p_to)),
    'answersApplicable', coalesce((select sum(st.applicable) from st), 0),
    'answersCompliant', coalesce((select sum(st.compliant) from st), 0),
    'byStandard', coalesce((select jsonb_agg(jsonb_build_array(st.standard, st.applicable, st.compliant) order by st.applicable desc, st.standard) from st), '[]'::jsonb),
    'findingsOpen', (select count(*) from fo),
    'findingsMajor', (select count(*) from fo where fo.finding_class = 'major'),
    'findingsByClass', coalesce((select jsonb_agg(jsonb_build_array(x.finding_class, x.n) order by x.n desc, x.finding_class) from (select fo.finding_class, count(*) as n from fo group by fo.finding_class) x), '[]'::jsonb)
  ) into v_audits;

  -- Suppliers: evaluations, certificates, nonconformities.
  with sp as (
    select s.id from public.quality_suppliers s
    where (p_organization_id is null or s.organization_id = p_organization_id) and s.status = 'active'
  ),
  ev as (
    select e.supplier_id, e.pass_threshold, e.conditional_threshold,
      coalesce(e.total_score, (
        select round(100 * sum(sc.score::numeric / sc.score_scale * sc.weight) / nullif(sum(sc.weight), 0), 1)
        from public.quality_supplier_evaluation_scores sc
        where sc.evaluation_id = e.id and sc.organization_id = e.organization_id)) as score
    from public.quality_supplier_evaluations e
    join sp on sp.id = e.supplier_id
    where (p_from is null or e.evaluated_on >= p_from) and (p_to is null or e.evaluated_on <= p_to)
  ),
  sc as (
    select ev.supplier_id, ev.score,
      case when ev.score >= coalesce(ev.pass_threshold, 80) then 'approved'
           when ev.score >= coalesce(ev.conditional_threshold, 60) then 'conditional'
           else 'rejected' end as outcome
    from ev where ev.score is not null
  ),
  ce as (
    select c.expires_on from public.quality_supplier_certifications c
    join sp on sp.id = c.supplier_id
    where c.expires_on is not null and c.expires_on <= v_today + 60
  ),
  nc as (
    select n.occurred_on, n.status from public.quality_supplier_nonconformities n
    join sp on sp.id = n.supplier_id
  )
  select jsonb_build_object(
    'suppliersActive', (select count(*) from sp),
    'suppliersEvaluated', (select count(distinct sc.supplier_id) from sc),
    'evaluations', (select count(*) from sc),
    'evaluationScoreTotal', coalesce((select round(sum(sc.score), 1) from sc), 0),
    'evaluationsByResult', coalesce((select jsonb_agg(jsonb_build_array(x.outcome, x.n) order by x.n desc, x.outcome) from (select sc.outcome, count(*) as n from sc group by sc.outcome) x), '[]'::jsonb),
    'certificatesExpiring', (select count(*) from ce where ce.expires_on >= v_today),
    'certificatesExpired', (select count(*) from ce where ce.expires_on < v_today),
    'nonconformities', (select count(*) from nc where (p_from is null or nc.occurred_on >= p_from) and (p_to is null or nc.occurred_on <= p_to)),
    'nonconformitiesOpen', (select count(*) from nc where nc.status = 'open')
  ) into v_suppliers;

  -- Kitchen (HACCP).
  with kr as (
    select r.received_on, r.limit_status from public.kitchen_receipts r
    where (p_organization_id is null or r.organization_id = p_organization_id)
      and (p_from is null or r.received_on >= p_from) and (p_to is null or r.received_on <= p_to)
  ),
  km as (
    select to_char(kr.received_on, 'YYYY-MM') as month, count(*) as total, count(*) filter (where kr.limit_status = 'out') as out_of_limits
    from kr group by 1
  ),
  kd as (
    select p.verified_at from public.kitchen_productions p
    where (p_organization_id is null or p.organization_id = p_organization_id)
      and (p_from is null or p.production_date >= p_from) and (p_to is null or p.production_date <= p_to)
      and p.production_date < v_today
  ),
  kt as (
    select t.limit_status from public.kitchen_thermal_processes t
    where (p_organization_id is null or t.organization_id = p_organization_id)
      and (p_from is null or t.process_date >= p_from) and (p_to is null or t.process_date <= p_to)
      and t.limit_status is not null
  ),
  kf as (
    select f.verified_at from public.kitchen_defrosting f
    where (p_organization_id is null or f.organization_id = p_organization_id)
      and f.ended_at is not null
      and (p_from is null or f.ended_at >= p_from) and (p_to is null or f.ended_at < p_to + 1)
  ),
  kw as (
    select w.reason from public.kitchen_stock_writeoffs w
    where (p_organization_id is null or w.organization_id = p_organization_id)
      and (p_from is null or w.written_off_on >= p_from) and (p_to is null or w.written_off_on <= p_to)
  )
  select jsonb_build_object(
    'receipts', (select count(*) from kr),
    'receiptsOut', (select count(*) from kr where kr.limit_status = 'out'),
    'receiptsMonthly', coalesce((select jsonb_agg(jsonb_build_array(km.month, km.total, km.out_of_limits) order by km.month) from km), '[]'::jsonb),
    'productionDays', (select count(*) from kd),
    'productionDaysVerified', (select count(*) from kd where kd.verified_at is not null),
    'thermalMeasured', (select count(*) from kt),
    'thermalOut', (select count(*) from kt where kt.limit_status = 'out'),
    'defrosts', (select count(*) from kf),
    'defrostsVerified', (select count(*) from kf where kf.verified_at is not null),
    'writeoffs', (select count(*) from kw),
    'writeoffsByReason', coalesce((select jsonb_agg(jsonb_build_array(x.reason, x.n) order by x.n desc, x.reason) from (select kw.reason, count(*) as n from kw group by kw.reason) x), '[]'::jsonb)
  ) into v_kitchen;

  -- Satisfaction surveys: the 1–5 answers of the period.
  with rs as (
    select r.id, r.survey_id, r.answers, to_char(r.submitted_at, 'YYYY-MM') as month
    from public.quality_survey_responses r
    where (p_organization_id is null or r.organization_id = p_organization_id)
      and (p_department_id is null or r.department_id = p_department_id)
      and (p_from is null or r.submitted_at >= p_from) and (p_to is null or r.submitted_at < p_to + 1)
  ),
  sv as (
    select s.id, s.title, s.audience, s.questions from public.quality_surveys s
    where s.id in (select distinct rs.survey_id from rs)
  ),
  ra as (
    select rs.survey_id, rs.month, sv.audience, v.value
    from rs
    join sv on sv.id = rs.survey_id
    cross join lateral jsonb_array_elements(sv.questions) q
    cross join lateral (select rs.answers -> (q ->> 'id') as value) v
    where q ->> 'type' = 'rating'
      and v.value is not null and jsonb_typeof(v.value) <> 'null' and v.value <> '""'::jsonb
  ),
  rn as (
    select ra.survey_id, ra.month, ra.audience,
      coalesce((ra.value #>> '{}') ~ '^\s*[45](\.0+)?\s*$', false) as satisfied
    from ra
  ),
  bs as (
    select sv.title, count(distinct rs.id) as responses,
      (select count(*) from rn where rn.survey_id = sv.id) as answered,
      (select count(*) from rn where rn.survey_id = sv.id and rn.satisfied) as satisfied
    from sv join rs on rs.survey_id = sv.id
    group by sv.id, sv.title
  ),
  bm as (
    select rn.month, count(*) as answered, count(*) filter (where rn.satisfied) as satisfied from rn group by rn.month
  )
  select jsonb_build_object(
    'surveyResponses', (select count(*) from rs join sv on sv.id = rs.survey_id),
    'ratingAnswers', (select count(*) from rn),
    'satisfiedAnswers', (select count(*) from rn where rn.satisfied),
    'patientRatingAnswers', (select count(*) from rn where rn.audience = 'patients'),
    'patientSatisfiedAnswers', (select count(*) from rn where rn.audience = 'patients' and rn.satisfied),
    'bySurvey', coalesce((select jsonb_agg(jsonb_build_array(bs.title, bs.responses, bs.answered, bs.satisfied) order by bs.responses desc, bs.title) from bs), '[]'::jsonb),
    'satisfactionMonthly', coalesce((select jsonb_agg(jsonb_build_array(bm.month, bm.answered, bm.satisfied) order by bm.month) from bm), '[]'::jsonb)
  ) into v_surveys;

  -- Risks: the assessment in force at the end of the period, per organization.
  with cur as (
    select distinct on (a.organization_id) a.id, a.organization_id
    from public.quality_risk_assessments a
    where (p_organization_id is null or a.organization_id = p_organization_id)
      and (p_to is null or a.assessed_on <= p_to)
    order by a.organization_id, (a.status = 'draft'), a.assessed_on desc, a.created_at desc
  ),
  rk as (
    select case when r.residual_score is null then null
                when r.residual_score <= 3 then 'low'
                when r.residual_score <= 6 then 'moderate'
                when r.residual_score <= 12 then 'high'
                else 'very_high' end as level
    from public.quality_risks r
    join cur on cur.id = r.assessment_id and cur.organization_id = r.organization_id
  ),
  op as (
    select o.effectiveness_status as status, lower(btrim(coalesce(o.effectiveness, ''))) as note
    from public.quality_risk_opportunities o
    join cur on cur.id = o.assessment_id and cur.organization_id = o.organization_id
  )
  select jsonb_build_object(
    'risks', (select count(*) from rk),
    'risksByLevel', (
      select jsonb_agg(jsonb_build_array(l.level, (select count(*) from rk where rk.level = l.level)) order by l.position)
      from (values ('very_high', 1), ('high', 2), ('moderate', 3), ('low', 4)) l(level, position)),
    'risksHigh', (select count(*) from rk where rk.level in ('high', 'very_high')),
    'opportunities', (select count(*) from op),
    -- Open: effectiveness not assessed (no status, and a note that does not start with an outcome).
    'opportunitiesOpen', (
      select count(*) from op
      where coalesce(op.status, 'pending') = 'pending'
        and (op.status is not null or op.note !~ '^(μη αποτελεσματ|αναποτελεσματ|μερικ|αποτελεσματ|not effective|ineffective|partly|partial|effective)'))
  ) into v_risks;

  return jsonb_build_object('qualityFood', v_audits || v_suppliers || v_kitchen || v_surveys || v_risks);
end;
$$;

revoke all on function public.analysis_quality_food_metrics(uuid, date, date, uuid) from public;
revoke all on function public.analysis_quality_food_metrics(uuid, date, date, uuid) from anon;
grant execute on function public.analysis_quality_food_metrics(uuid, date, date, uuid) to authenticated;
