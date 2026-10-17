-- Quality Center, phase 6: satisfaction surveys (ISO 9001 §9.1.2).
--
-- quality_surveys            one survey: who it asks (patients, staff, visitors),
--                            its sections and questions (jsonb), the departments it covers
--                            (empty = the whole hospital), when it is open, the
--                            share of satisfied answers it aims at, and the
--                            random token of its public link (QR poster).
-- quality_survey_responses   one completed questionnaire: the department it is
--                            about, how it came in (link, tablet, paper) and the
--                            answers. Never who answered.
--
-- Read: Quality (roles, view_quality); a department reads the surveys that cover
-- it and the responses about it. Write: Quality (roles, manage_quality) defines
-- surveys; Quality and the department enter responses (tablet, paper).
-- Respondents without an account answer through survey_public / survey_submit,
-- which take the survey's public token.

create table if not exists public.quality_surveys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  title text not null,
  title_en text,
  description text,
  description_en text,
  audience text not null default 'patients' check (audience in ('patients','staff','visitors','other')),
  template_key text,
  department_ids uuid[] not null default '{}',
  sections jsonb not null default '[]'::jsonb check (jsonb_typeof(sections) = 'array'),
  questions jsonb not null default '[]'::jsonb check (jsonb_typeof(questions) = 'array'),
  status text not null default 'draft' check (status in ('draft','open','closed')),
  opens_on date,
  closes_on date,
  target_responses integer check (target_responses is null or target_responses > 0),
  satisfied_target numeric not null default 80 check (satisfied_target between 0 and 100),
  public_token text not null default encode(extensions.gen_random_bytes(18), 'hex'),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  unique (public_token),
  unique (id, organization_id)
);
create index if not exists quality_surveys_org_idx on public.quality_surveys (organization_id, status);

create table if not exists public.quality_survey_responses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  survey_id uuid not null,
  department_id uuid references public.departments(id) on delete set null,
  channel text not null default 'link' check (channel in ('link','tablet','paper')),
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  submitted_at timestamptz not null default now(),
  entered_by uuid default auth.uid(),
  foreign key (survey_id, organization_id) references public.quality_surveys(id, organization_id) on delete cascade
);
create index if not exists quality_survey_responses_survey_idx on public.quality_survey_responses (survey_id, submitted_at desc);
create index if not exists quality_survey_responses_department_idx on public.quality_survey_responses (organization_id, department_id);

alter table public.quality_surveys enable row level security;
alter table public.quality_survey_responses enable row level security;

drop policy if exists quality_surveys_read on public.quality_surveys;
create policy quality_surveys_read on public.quality_surveys for select to authenticated using (
  public.current_user_is_platform_owner()
  or public.current_user_has_org_role(organization_id, array['hospital_admin'::public.app_role,'quality_manager'::public.app_role,'infection_control_lead'::public.app_role])
  or public.current_user_has_capability(organization_id, 'view_quality')
  or exists (select 1 from unnest(department_ids) d where public.current_user_has_department_scope(organization_id, d)));

drop policy if exists quality_surveys_manage on public.quality_surveys;
create policy quality_surveys_manage on public.quality_surveys for all to authenticated using (
  public.current_user_is_platform_owner()
  or public.current_user_has_org_role(organization_id, array['hospital_admin'::public.app_role,'quality_manager'::public.app_role])
  or public.current_user_has_capability(organization_id, 'manage_quality'))
  with check (
  public.current_user_is_platform_owner()
  or public.current_user_has_org_role(organization_id, array['hospital_admin'::public.app_role,'quality_manager'::public.app_role])
  or public.current_user_has_capability(organization_id, 'manage_quality'));

drop policy if exists quality_survey_responses_read on public.quality_survey_responses;
create policy quality_survey_responses_read on public.quality_survey_responses for select to authenticated using (
  public.current_user_is_platform_owner()
  or public.current_user_has_org_role(organization_id, array['hospital_admin'::public.app_role,'quality_manager'::public.app_role,'infection_control_lead'::public.app_role])
  or public.current_user_has_capability(organization_id, 'view_quality')
  or (department_id is not null and public.current_user_has_department_scope(organization_id, department_id)));

-- Responses entered in the app (a tablet at the ward, a paper form typed in).
drop policy if exists quality_survey_responses_insert on public.quality_survey_responses;
create policy quality_survey_responses_insert on public.quality_survey_responses for insert to authenticated with check (
  channel in ('tablet','paper')
  and (public.current_user_is_platform_owner()
    or public.current_user_has_org_role(organization_id, array['hospital_admin'::public.app_role,'quality_manager'::public.app_role])
    or public.current_user_has_capability(organization_id, 'manage_quality')
    or (department_id is not null and public.current_user_has_department_scope(organization_id, department_id))));

-- Quality removes a response entered by mistake.
drop policy if exists quality_survey_responses_delete on public.quality_survey_responses;
create policy quality_survey_responses_delete on public.quality_survey_responses for delete to authenticated using (
  public.current_user_is_platform_owner()
  or public.current_user_has_org_role(organization_id, array['hospital_admin'::public.app_role,'quality_manager'::public.app_role])
  or public.current_user_has_capability(organization_id, 'manage_quality'));

revoke all on public.quality_surveys from anon;
revoke all on public.quality_survey_responses from anon;
grant select, insert, update, delete on public.quality_surveys to authenticated;
grant select, insert, delete on public.quality_survey_responses to authenticated;
-- A response is never edited: removed and entered again.
revoke update on public.quality_survey_responses from authenticated;

create or replace trigger trg_quality_surveys_touch before update on public.quality_surveys
  for each row execute function private.department_register_touch();

-- Whether a survey takes answers today.
create or replace function private.quality_survey_is_open(p_survey public.quality_surveys)
returns boolean language sql stable set search_path = ''
as $$
  select p_survey.status = 'open'
    and (p_survey.opens_on is null or p_survey.opens_on <= current_date)
    and (p_survey.closes_on is null or p_survey.closes_on >= current_date);
$$;
revoke all on function private.quality_survey_is_open(public.quality_surveys) from public, anon, authenticated;

-- The answers kept from a submission: only the survey's questions, each value
-- of the kind its question asks; null when a required question is missing.
create or replace function private.quality_survey_clean_answers(p_questions jsonb, p_answers jsonb)
returns jsonb language plpgsql immutable set search_path = ''
as $$
declare
  q jsonb;
  v jsonb;
  kind text;
  kept jsonb := '{}'::jsonb;
  allowed jsonb;
begin
  if jsonb_typeof(p_answers) <> 'object' then return null; end if;
  for q in select value from jsonb_array_elements(p_questions) loop
    kind := q->>'type';
    v := p_answers -> (q->>'id');
    allowed := coalesce((select jsonb_agg(o->'value') from jsonb_array_elements(coalesce(q->'options', '[]'::jsonb)) o), '[]'::jsonb);
    if v is null or v = 'null'::jsonb or (jsonb_typeof(v) = 'string' and btrim(v #>> '{}') = '') or (jsonb_typeof(v) = 'array' and jsonb_array_length(v) = 0) then
      if coalesce((q->>'required')::boolean, false) then return null; end if;
      continue;
    end if;
    if kind = 'rating' and jsonb_typeof(v) = 'number' and (v #>> '{}')::numeric in (1,2,3,4,5) then kept := kept || jsonb_build_object(q->>'id', v);
    elsif kind = 'nps' and jsonb_typeof(v) = 'number' and (v #>> '{}')::numeric between 0 and 10 and (v #>> '{}')::numeric = trunc((v #>> '{}')::numeric) then kept := kept || jsonb_build_object(q->>'id', v);
    elsif kind = 'yesno' and jsonb_typeof(v) = 'boolean' then kept := kept || jsonb_build_object(q->>'id', v);
    elsif kind = 'single' and jsonb_typeof(v) = 'string' and allowed @> jsonb_build_array(v) then kept := kept || jsonb_build_object(q->>'id', v);
    elsif kind = 'multiple' and jsonb_typeof(v) = 'array' and allowed @> v then kept := kept || jsonb_build_object(q->>'id', v);
    elsif kind = 'text' and jsonb_typeof(v) = 'string' then kept := kept || jsonb_build_object(q->>'id', left(btrim(v #>> '{}'), 2000));
    elsif coalesce((q->>'required')::boolean, false) then return null;
    end if;
  end loop;
  return kept;
end;
$$;
revoke all on function private.quality_survey_clean_answers(jsonb, jsonb) from public, anon, authenticated;

-- The questionnaire behind a public link (QR poster), for a respondent without
-- an account: the questions and the departments to choose from, nothing else.
create or replace function public.survey_public(p_token text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $function$
declare
  v_survey public.quality_surveys;
begin
  if nullif(btrim(coalesce(p_token, '')), '') is null then raise exception 'SURVEY_NOT_AVAILABLE'; end if;
  v_survey := (select s from public.quality_surveys s where s.public_token = p_token);
  if v_survey.id is null or v_survey.status = 'draft' then raise exception 'SURVEY_NOT_AVAILABLE'; end if;
  return jsonb_build_object(
    'open', private.quality_survey_is_open(v_survey),
    'title', v_survey.title, 'titleEn', v_survey.title_en,
    'description', v_survey.description, 'descriptionEn', v_survey.description_en,
    'audience', v_survey.audience,
    'organizationName', (select o.name from public.organizations o where o.id = v_survey.organization_id),
    'sections', v_survey.sections,
    'questions', case when private.quality_survey_is_open(v_survey) then v_survey.questions else '[]'::jsonb end,
    'departments', case when private.quality_survey_is_open(v_survey) then coalesce((
      select jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name) order by d.name)
      from public.departments d
      where d.organization_id = v_survey.organization_id and d.is_active
        and d.id = any(v_survey.department_ids)), '[]'::jsonb) else '[]'::jsonb end);
end;
$function$;
revoke all on function public.survey_public(text) from public;
grant execute on function public.survey_public(text) to anon, authenticated;

-- One response through the public link. The survey must be open, the department
-- one it covers, the answers those of its questions (required ones present).
-- At most 60 responses a minute per survey, so a link cannot be flooded.
create or replace function public.survey_submit(p_token text, p_department_id uuid, p_answers jsonb)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $function$
declare
  v_survey public.quality_surveys;
  v_answers jsonb;
begin
  v_survey := (select s from public.quality_surveys s where s.public_token = p_token);
  if v_survey.id is null or not private.quality_survey_is_open(v_survey) then raise exception 'SURVEY_NOT_AVAILABLE'; end if;
  if p_department_id is not null and not exists (
    select 1 from public.departments d where d.id = p_department_id and d.organization_id = v_survey.organization_id
      and d.id = any(v_survey.department_ids)) then
    raise exception 'SURVEY_DEPARTMENT_INVALID';
  end if;
  if p_department_id is null and cardinality(v_survey.department_ids) = 1 then p_department_id := v_survey.department_ids[1]; end if;
  if p_department_id is null and cardinality(v_survey.department_ids) > 1 then raise exception 'SURVEY_DEPARTMENT_INVALID'; end if;
  v_answers := private.quality_survey_clean_answers(v_survey.questions, p_answers);
  if v_answers is null or v_answers = '{}'::jsonb then raise exception 'SURVEY_ANSWERS_INVALID'; end if;
  if (select count(*) from public.quality_survey_responses r where r.survey_id = v_survey.id and r.submitted_at > now() - interval '1 minute') >= 60 then
    raise exception 'SURVEY_BUSY';
  end if;
  insert into public.quality_survey_responses (organization_id, survey_id, department_id, channel, answers, entered_by)
    values (v_survey.organization_id, v_survey.id, p_department_id, 'link', v_answers, null);
  return jsonb_build_object('ok', true);
end;
$function$;
revoke all on function public.survey_submit(text, uuid, jsonb) from public;
grant execute on function public.survey_submit(text, uuid, jsonb) to anon, authenticated;
