-- «Ικανοποίηση από τη διατροφή»: οι απαντήσεις 4–5 στις ερωτήσεις βαθμολογίας της ενότητας «Διατροφή» (section = 'food')
-- των ερωτηματολογίων ασθενών, ως δύο νέα μεγέθη του private.indicator_metric_snapshot και ένας δείκτης του συστήματος.
-- Το σώμα της συνάρτησης διορθώνεται από τον ορισμό που ισχύει (τρεις αντικαταστάσεις), χωρίς να ξαναγραφεί ολόκληρο.
do $patch$
declare
  v_old text := pg_get_functiondef('private.indicator_metric_snapshot(uuid,date,date,uuid)'::regprocedure);
  v_new text;
begin
  if position('food_satisfied_answers' in v_old) > 0 then return; end if;
  v_new := replace(v_old, 'v_ps_ok bigint:=0;v_ps_total bigint:=0;', 'v_ps_ok bigint:=0;v_ps_total bigint:=0;v_fs_ok bigint:=0;v_fs_total bigint:=0;');
  v_new := replace(v_new, E'  if p_department_id is null then\n    select count(*) filter(where r.limit_status=''out'')',
$food$  select count(*) filter(where q.ok),count(*) into v_fs_ok,v_fs_total
  from (select coalesce((r.answers->(qq->>'id') #>> '{}') ~ '^\s*[45](\.0+)?\s*$',false) as ok
    from public.quality_survey_responses r join public.quality_surveys s on s.id=r.survey_id and s.organization_id=r.organization_id
    cross join lateral jsonb_array_elements(s.questions) qq
    where r.organization_id=p_organization_id and s.audience='patients' and r.submitted_at>=p_from and r.submitted_at<p_to+1 and (p_department_id is null or r.department_id=p_department_id)
      and qq->>'type'='rating' and qq->>'section'='food' and jsonb_typeof(r.answers->(qq->>'id')) is not null and jsonb_typeof(r.answers->(qq->>'id'))<>'null' and r.answers->(qq->>'id')<>'""'::jsonb) q;
$food$ || E'  if p_department_id is null then\n    select count(*) filter(where r.limit_status=''out'')');
  v_new := replace(v_new, '''patient_rating_answers'',v_ps_total,', '''patient_rating_answers'',v_ps_total,''food_satisfied_answers'',v_fs_ok,''food_rating_answers'',v_fs_total,');
  if v_new = v_old or position('v_fs_ok,v_fs_total' in v_new) = 0 or position('food_rating_answers' in v_new) = 0 or position('qq->>''section''=''food''' in v_new) = 0 then
    raise exception 'The snapshot function did not match the expected text';
  end if;
  execute v_new;
end
$patch$;

insert into public.indicator_definitions
select (json_populate_record(d, json_build_object(
  'id', gen_random_uuid()::text, 'indicator_key', 'food-satisfaction', 'version', '2026.1',
  'title_el', 'Ικανοποίηση από τη διατροφή', 'title_en', 'Satisfaction with food',
  'numerator_metric', 'food_satisfied_answers', 'denominator_metric', 'food_rating_answers',
  'numerator_definition', json_build_object('description', 'Απαντήσεις 4–5 στις ερωτήσεις της ενότητας «Διατροφή» των ερωτηματολογίων ασθενών'),
  'denominator_definition', json_build_object('description', 'Όλες οι απαντήσεις βαθμολογίας της ενότητας «Διατροφή» των ερωτηματολογίων ασθενών')
)::json)).*
from public.indicator_definitions d
where d.organization_id is null and d.indicator_key = 'patient-satisfaction'
  and not exists (select 1 from public.indicator_definitions x where x.organization_id is null and x.indicator_key = 'food-satisfaction');
