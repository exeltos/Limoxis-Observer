-- Training programmes: the details a session has besides its dates, each in a
-- column of its own (FileMaker «Type train», «time», «Train_Hours»,
-- «Train_Location», «cost»):
--   delivery_kind   internal (the hospital's own), external (an outside body)
--                   or intra_department (within one department). Not the
--                   method (in person / online / …) nor the category (subject).
--   start_time      the time the session starts
--   duration_hours  the hours of training (> 0)
--   location        where it takes place
--   cost            what it cost (>= 0)
-- Man-days are not stored: they follow from the dates.
--
-- Additive: new nullable columns, and the programme writer / reader replaced
-- with the same signatures so they carry the new fields.

alter table public.training_programs
  add column if not exists delivery_kind text check (delivery_kind is null or delivery_kind in ('internal','external','intra_department')),
  add column if not exists start_time time,
  add column if not exists duration_hours numeric check (duration_hours is null or duration_hours > 0),
  add column if not exists location text,
  add column if not exists cost numeric check (cost is null or cost >= 0);

create or replace function private.training_program_json(p_program_id uuid, p_public boolean default false)
returns jsonb
language sql
stable
set search_path = ''
as $function$
  select jsonb_build_object(
      'id', p.program_key, 'dbId', p.id, 'title', p.title, 'titleEn', p.title_en, 'category', coalesce(p.category, ''),
      'method', coalesce(p.method, ''), 'owner', coalesce(p.owner, ''), 'trainer', coalesce(p.trainer, ''), 'audience', coalesce(p.audience, ''),
      'description', coalesce(p.description, ''), 'startDate', coalesce(p.start_date::text, ''), 'dueDate', coalesce(p.due_date::text, ''),
      'validMonths', p.valid_months, 'requiresAssessment', p.requires_assessment, 'passScore', p.pass_score, 'status', p.status,
      'departmentId', p.department_id, 'userId', null, 'createdAt', p.created_at, 'updatedAt', p.updated_at)
    || jsonb_build_object('deliveryKind', coalesce(p.delivery_kind, ''), 'startTime', coalesce(to_char(p.start_time, 'HH24:MI'), ''),
      'durationHours', p.duration_hours, 'location', coalesce(p.location, ''), 'cost', p.cost)
    || jsonb_build_object(
      'materials', coalesce((select jsonb_agg(jsonb_build_object('id', m.material_key, 'title', m.title, 'type', coalesce(m.material_type, ''), 'url', coalesce(m.url, ''))
          order by m.position, m.material_key) from public.training_program_materials m where m.program_id = p.id), '[]'::jsonb),
      'assessmentQuestions', coalesce((select jsonb_agg(
          jsonb_build_object('id', q.question_key, 'type', q.question_type, 'text', q.text, 'points', q.points, 'required', q.required, 'manualReview', q.manual_review,
            'options', coalesce((select jsonb_agg(case when p_public then jsonb_build_object('id', o.option_key, 'text', o.text)
                else jsonb_build_object('id', o.option_key, 'text', o.text, 'correct', o.correct) end order by o.position, o.option_key)
              from public.training_assessment_options o where o.question_id = q.id), '[]'::jsonb))
          || case when p_public then '{}'::jsonb else jsonb_build_object('correctBoolean', coalesce(q.correct_boolean, true), 'modelAnswer', coalesce(q.model_answer, '')) end
          order by q.position, q.question_key) from public.training_assessment_questions q where q.program_id = p.id), '[]'::jsonb))
    || case when p.feedback_template_key is null then '{}'::jsonb else jsonb_build_object('trainerFeedbackTemplate', jsonb_build_object(
      'id', p.feedback_template_key, 'titleEl', coalesce(p.feedback_title_el, ''), 'titleEn', coalesce(p.feedback_title_en, ''),
      'questions', coalesce((select jsonb_agg(jsonb_build_object('id', f.question_key, 'labelEl', f.label_el, 'labelEn', coalesce(f.label_en, ''))
          order by f.position, f.question_key) from public.training_program_feedback_questions f where f.program_id = p.id), '[]'::jsonb))) end
    || coalesce((select jsonb_build_object('effectiveness', jsonb_build_object(
      'plannedDate', coalesce(e.planned_date::text, ''), 'method', coalesce(e.method, ''), 'criterion', coalesce(e.criterion, ''), 'result', coalesce(e.result, ''),
      'evaluatedAt', coalesce(e.evaluated_at::text, ''), 'evaluatedBy', coalesce(e.evaluated_by, ''), 'notes', coalesce(e.notes, ''), 'comment', coalesce(e.comment, '')))
      from public.training_program_effectiveness e where e.program_id = p.id), '{}'::jsonb)
    || case when p_public then '{}'::jsonb else jsonb_build_object('feedbackResponses', coalesce((select jsonb_agg(jsonb_build_object(
      'employeeId', fr.employee_code, 'userId', fr.user_id, 'assignmentId', a.assignment_key, 'submittedAt', fr.submitted_at, 'comment', fr.comment,
      'scores', coalesce((select jsonb_object_agg(s.question_key, s.score) from public.training_feedback_scores s where s.assignment_id = fr.assignment_id), '{}'::jsonb))
      order by fr.submitted_at, a.assignment_key) from public.training_feedback_responses fr join public.training_assignments a on a.id = fr.assignment_id
      where fr.program_id = p.id), '[]'::jsonb)) end
  from public.training_programs p
  where p.id = p_program_id;
$function$;

create or replace function public.training_save_program(p_organization_id uuid, p_program jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_key text := nullif(btrim(coalesce(p_program->>'id', '')), '');
  v_template jsonb := case when jsonb_typeof(p_program->'trainerFeedbackTemplate') = 'object' then p_program->'trainerFeedbackTemplate' end;
  v_materials jsonb := case when jsonb_typeof(p_program->'materials') = 'array' then p_program->'materials' end;
  v_questions jsonb := case when jsonb_typeof(p_program->'assessmentQuestions') = 'array' then p_program->'assessmentQuestions' end;
  v_effectiveness jsonb := p_program->'effectiveness';
  v_id uuid;
begin
  if v_key is null then raise exception 'TRAINING_RECORD_KEY_REQUIRED' using errcode = '22023'; end if;
  if p_organization_id is null or not public.current_user_has_capability(p_organization_id, 'manage_training') then
    raise exception 'TRAINING_MANAGE_REQUIRED' using errcode = '42501';
  end if;

  insert into public.training_programs as t(organization_id, program_key, title, title_en, category, method, owner, trainer, audience, description,
    start_date, due_date, valid_months, requires_assessment, pass_score, status, department_id, feedback_template_key, feedback_title_el, feedback_title_en,
    delivery_kind, start_time, duration_hours, location, cost)
  values (p_organization_id, v_key, coalesce(p_program->>'title', ''), nullif(btrim(coalesce(p_program->>'titleEn', '')), ''),
    nullif(p_program->>'category', ''), nullif(p_program->>'method', ''), nullif(p_program->>'owner', ''), nullif(p_program->>'trainer', ''),
    nullif(p_program->>'audience', ''), nullif(p_program->>'description', ''),
    nullif(left(p_program->>'startDate', 10), '')::date, nullif(left(p_program->>'dueDate', 10), '')::date,
    round(nullif(p_program->>'validMonths', '')::numeric)::integer, coalesce(nullif(p_program->>'requiresAssessment', '')::boolean, false),
    round(nullif(p_program->>'passScore', '')::numeric)::integer, coalesce(nullif(p_program->>'status', ''), 'planned'),
    case when p_program->>'departmentId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (p_program->>'departmentId')::uuid end,
    nullif(v_template->>'id', ''), nullif(v_template->>'titleEl', ''), nullif(v_template->>'titleEn', ''),
    case when p_program->>'deliveryKind' in ('internal','external','intra_department') then p_program->>'deliveryKind' end,
    case when btrim(coalesce(p_program->>'startTime', '')) ~ '^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$' then btrim(p_program->>'startTime')::time end,
    case when btrim(coalesce(p_program->>'durationHours', '')) ~ '^[0-9]+([.,][0-9]+)?$' and replace(btrim(p_program->>'durationHours'), ',', '.')::numeric > 0
      then replace(btrim(p_program->>'durationHours'), ',', '.')::numeric end,
    nullif(btrim(coalesce(p_program->>'location', '')), ''),
    case when btrim(coalesce(p_program->>'cost', '')) ~ '^[0-9]+([.,][0-9]+)?$' then replace(btrim(p_program->>'cost'), ',', '.')::numeric end)
  on conflict (organization_id, program_key) do update set
    title = excluded.title, title_en = excluded.title_en, category = excluded.category, method = excluded.method, owner = excluded.owner,
    trainer = excluded.trainer, audience = excluded.audience, description = excluded.description, start_date = excluded.start_date,
    due_date = excluded.due_date, valid_months = excluded.valid_months, requires_assessment = excluded.requires_assessment,
    pass_score = excluded.pass_score, status = excluded.status, department_id = excluded.department_id,
    -- A client that does not know these fields yet leaves them as they are.
    delivery_kind = case when p_program ? 'deliveryKind' then excluded.delivery_kind else t.delivery_kind end,
    start_time = case when p_program ? 'startTime' then excluded.start_time else t.start_time end,
    duration_hours = case when p_program ? 'durationHours' then excluded.duration_hours else t.duration_hours end,
    location = case when p_program ? 'location' then excluded.location else t.location end,
    cost = case when p_program ? 'cost' then excluded.cost else t.cost end,
    feedback_template_key = case when v_template is null then t.feedback_template_key else excluded.feedback_template_key end,
    feedback_title_el = case when v_template is null then t.feedback_title_el else excluded.feedback_title_el end,
    feedback_title_en = case when v_template is null then t.feedback_title_en else excluded.feedback_title_en end
  returning t.id into v_id;

  if v_materials is not null then
    delete from public.training_program_materials m where m.program_id = v_id
      and m.material_key not in (select coalesce(nullif(x.value->>'id', ''), 'MAT-' || x.ord) from jsonb_array_elements(v_materials) with ordinality x(value, ord));
    insert into public.training_program_materials as t(organization_id, program_id, material_key, position, title, material_type, url)
    select distinct on (k.key) p_organization_id, v_id, k.key, x.ord::integer, coalesce(x.value->>'title', ''), nullif(x.value->>'type', ''), nullif(x.value->>'url', '')
    from jsonb_array_elements(v_materials) with ordinality x(value, ord)
    cross join lateral (select coalesce(nullif(x.value->>'id', ''), 'MAT-' || x.ord) key) k
    order by k.key, x.ord
    on conflict (program_id, material_key) do update set position = excluded.position, title = excluded.title, material_type = excluded.material_type, url = excluded.url
    where (t.position, t.title, t.material_type, t.url) is distinct from (excluded.position, excluded.title, excluded.material_type, excluded.url);
  end if;

  if v_questions is not null then
    delete from public.training_assessment_questions q where q.program_id = v_id
      and q.question_key not in (select coalesce(nullif(x.value->>'id', ''), 'Q-' || x.ord) from jsonb_array_elements(v_questions) with ordinality x(value, ord));
    insert into public.training_assessment_questions as t(organization_id, program_id, question_key, position, question_type, text, points, required,
      correct_boolean, model_answer, manual_review)
    select distinct on (k.key) p_organization_id, v_id, k.key, x.ord::integer,
      case when x.value->>'type' in ('single_choice','multiple_choice','true_false','free_text') then x.value->>'type' else 'single_choice' end,
      coalesce(x.value->>'text', ''), greatest(coalesce(nullif(x.value->>'points', '')::numeric, 1), 0), coalesce(nullif(x.value->>'required', '')::boolean, true),
      nullif(x.value->>'correctBoolean', '')::boolean, nullif(x.value->>'modelAnswer', ''), coalesce(nullif(x.value->>'manualReview', '')::boolean, false)
    from jsonb_array_elements(v_questions) with ordinality x(value, ord)
    cross join lateral (select coalesce(nullif(x.value->>'id', ''), 'Q-' || x.ord) key) k
    order by k.key, x.ord
    on conflict (program_id, question_key) do update set position = excluded.position, question_type = excluded.question_type, text = excluded.text,
      points = excluded.points, required = excluded.required, correct_boolean = excluded.correct_boolean, model_answer = excluded.model_answer,
      manual_review = excluded.manual_review
    where (t.position, t.question_type, t.text, t.points, t.required, t.correct_boolean, t.model_answer, t.manual_review)
      is distinct from (excluded.position, excluded.question_type, excluded.text, excluded.points, excluded.required, excluded.correct_boolean, excluded.model_answer, excluded.manual_review);

    delete from public.training_assessment_options o using public.training_assessment_questions q
    where o.question_id = q.id and q.program_id = v_id
      and not exists (select 1 from jsonb_array_elements(v_questions) with ordinality x(value, ord)
        cross join lateral jsonb_array_elements(case when jsonb_typeof(x.value->'options') = 'array' then x.value->'options' else '[]'::jsonb end) with ordinality y(value, ord)
        where coalesce(nullif(x.value->>'id', ''), 'Q-' || x.ord) = q.question_key and coalesce(nullif(y.value->>'id', ''), 'OPT-' || y.ord) = o.option_key);
    insert into public.training_assessment_options as t(organization_id, question_id, option_key, position, text, correct)
    select distinct on (q.id, k.key) p_organization_id, q.id, k.key, y.ord::integer, coalesce(y.value->>'text', ''), coalesce(nullif(y.value->>'correct', '')::boolean, false)
    from jsonb_array_elements(v_questions) with ordinality x(value, ord)
    join public.training_assessment_questions q on q.program_id = v_id and q.question_key = coalesce(nullif(x.value->>'id', ''), 'Q-' || x.ord)
    cross join lateral jsonb_array_elements(case when jsonb_typeof(x.value->'options') = 'array' then x.value->'options' else '[]'::jsonb end) with ordinality y(value, ord)
    cross join lateral (select coalesce(nullif(y.value->>'id', ''), 'OPT-' || y.ord) key) k
    order by q.id, k.key, y.ord
    on conflict (question_id, option_key) do update set position = excluded.position, text = excluded.text, correct = excluded.correct
    where (t.position, t.text, t.correct) is distinct from (excluded.position, excluded.text, excluded.correct);
  end if;

  if p_program ? 'effectiveness' then
    if jsonb_typeof(v_effectiveness) = 'object' then
      insert into public.training_program_effectiveness as t(program_id, organization_id, planned_date, method, criterion, result, evaluated_at, evaluated_by, notes, comment)
      values (v_id, p_organization_id, nullif(left(v_effectiveness->>'plannedDate', 10), '')::date, nullif(btrim(coalesce(v_effectiveness->>'method', '')), ''),
        nullif(btrim(coalesce(v_effectiveness->>'criterion', '')), ''), nullif(btrim(coalesce(v_effectiveness->>'result', '')), ''),
        nullif(left(v_effectiveness->>'evaluatedAt', 10), '')::date, nullif(btrim(coalesce(v_effectiveness->>'evaluatedBy', '')), ''),
        nullif(btrim(coalesce(v_effectiveness->>'notes', '')), ''), nullif(btrim(coalesce(v_effectiveness->>'comment', '')), ''))
      on conflict (program_id) do update set planned_date = excluded.planned_date, method = excluded.method, criterion = excluded.criterion,
        result = excluded.result, evaluated_at = excluded.evaluated_at, evaluated_by = excluded.evaluated_by, notes = excluded.notes, comment = excluded.comment
      where (t.planned_date, t.method, t.criterion, t.result, t.evaluated_at, t.evaluated_by, t.notes, t.comment)
        is distinct from (excluded.planned_date, excluded.method, excluded.criterion, excluded.result, excluded.evaluated_at, excluded.evaluated_by, excluded.notes, excluded.comment);
    else
      delete from public.training_program_effectiveness e where e.program_id = v_id;
    end if;
  end if;

  if v_template is not null then
    delete from public.training_program_feedback_questions f where f.program_id = v_id
      and f.question_key not in (select coalesce(nullif(x.value->>'id', ''), 'feedback-' || x.ord)
        from jsonb_array_elements(case when jsonb_typeof(v_template->'questions') = 'array' then v_template->'questions' else '[]'::jsonb end) with ordinality x(value, ord));
    insert into public.training_program_feedback_questions as t(organization_id, program_id, question_key, position, label_el, label_en)
    select distinct on (k.key) p_organization_id, v_id, k.key, x.ord::integer, coalesce(x.value->>'labelEl', x.value->>'label', ''), nullif(x.value->>'labelEn', '')
    from jsonb_array_elements(case when jsonb_typeof(v_template->'questions') = 'array' then v_template->'questions' else '[]'::jsonb end) with ordinality x(value, ord)
    cross join lateral (select coalesce(nullif(x.value->>'id', ''), 'feedback-' || x.ord) key) k
    order by k.key, x.ord
    on conflict (program_id, question_key) do update set position = excluded.position, label_el = excluded.label_el, label_en = excluded.label_en
    where (t.position, t.label_el, t.label_en) is distinct from (excluded.position, excluded.label_el, excluded.label_en);
  end if;
  return v_id;
end;
$function$;
