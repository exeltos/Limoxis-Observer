-- Μείζονες μη συμμορφώσεις: νέα μέτρηση audit_major_findings στο private.indicator_metric_snapshot
-- (ευρήματα με κατηγορία «μείζον», όχι ακυρωμένα, που εντοπίστηκαν μέσα στην περίοδο) και ο δείκτης συστήματος
-- «audit-major-findings» (πλήθος, χαμηλότερα καλύτερα, στόχος 0).
-- Οι στόχοι του ΙΑΣΩ 2026 που έχουν ήδη δείκτη στην πλατφόρμα μετριούνται από αυτόν αντί για τιμή με το χέρι (απόφαση ιδιοκτήτη 2/11/2026):
--   QO-2026-015 → audit-major-findings (και ελληνικός τίτλος), QO-2026-011 → patient-satisfaction,
--   QO-2026-014 → audit-answers-compliance. Ο QO-2026-018 (αντιγριπικός εμβολιασμός) μένει με τιμή ανά μήνα: η πλατφόρμα
--   έχει μόνο 2 αντιγριπικούς εμβολιασμούς για 425 εργαζόμενους, οπότε ο δείκτης θα έδειχνε ψευδώς 0,2%.
do $patch$
declare
  v_def text := pg_get_functiondef('private.indicator_metric_snapshot(uuid,date,date,uuid)'::regprocedure);
  v_anchor text := E'  select count(*) filter(where coalesce(i.result,i.answer)=''yes''),count(*) into v_qa_ok,v_qa_total';
begin
  if position('audit_major_findings' in v_def) > 0 then raise notice 'already patched'; return; end if;
  if position('v_risk_high bigint;' in v_def) = 0 or position(v_anchor in v_def) = 0 or position('''supplier_evaluations_scored'',v_se_total)' in v_def) = 0 then
    raise exception 'indicator_metric_snapshot: anchors not found';
  end if;
  v_def := replace(v_def, 'v_risk_high bigint;', 'v_risk_high bigint;v_major bigint:=0;');
  v_def := replace(v_def, v_anchor, E'  select count(*) into v_major from public.quality_findings f where f.organization_id=p_organization_id and f.finding_class=''major'' and f.voided_at is null and coalesce(f.identified_at,f.created_at::date) between p_from and p_to and (p_department_id is null or f.department_id=p_department_id);\n' || v_anchor);
  v_def := replace(v_def, '''supplier_evaluations_scored'',v_se_total)', '''supplier_evaluations_scored'',v_se_total,''audit_major_findings'',v_major)');
  execute v_def;
end
$patch$;

-- The management audit trigger records the platform owner as the actor (as the earlier indicator migrations).
select set_config('request.jwt.claims', '{"sub":"84066ee0-57b7-4cae-9186-09e491d3ea6d","role":"authenticated"}', true);

insert into public.indicator_definitions (organization_id, indicator_key, version, category, title_el, title_en, numerator_definition, denominator_definition, multiplier, unit, unit_en, source_authority, effective_from, status, calculation_type, numerator_metric, denominator_metric, target_value, direction)
select null, 'audit-major-findings', '2026.5', 'quality', 'Μείζονες μη συμμορφώσεις', 'Major non-conformities',
  '{"description":"Ευρήματα επιθεωρήσεων με κατηγορία «μείζον» που εντοπίστηκαν μέσα στην περίοδο (όχι ακυρωμένα)"}'::jsonb, '{"description":""}'::jsonb,
  1, 'ευρήματα', 'findings', 'Ποιότητα · Ευρήματα επιθεωρήσεων (ISO 9001 §10.2)', date '2026-01-01', 'active', 'auto', 'audit_major_findings', null, 0, 'lower'
where not exists (select 1 from public.indicator_definitions where organization_id is null and indicator_key = 'audit-major-findings');

update public.quality_objectives o set platform_indicator_key = v.key, title = coalesce(v.title, o.title)
from (values ('QO-2026-015', 'audit-major-findings', 'Μείζονες μη συμμορφώσεις — μηδέν'),
             ('QO-2026-011', 'patient-satisfaction', null),
             ('QO-2026-014', 'audit-answers-compliance', null)) as v(code, key, title)
where o.code = v.code and o.platform_indicator_key is null and o.register_id is null
  and o.organization_id = (select id from public.organizations where name = 'ΙΑΣΩ ΘΕΣΣΑΛΙΑΣ');
