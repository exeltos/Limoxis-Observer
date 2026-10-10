-- Demo evaluation guide, phase 2 (docs/ROLE_MENU_AND_DEMO_GUIDANCE_DESIGN.md):
-- 1. scenarios for every role: the guide's step keys now include the scenarios
--    of HR, occupational health, quality, pharmacy, committee secretariat,
--    hospital administration and department management;
-- 2. a short questionnaire per scenario: besides the existing 1-5 rating
--    (usefulness), ease and clarity (1-5) and the time the scenario took.
-- No SELECT/EXECUTE/RETURNING ... INTO (the Supabase SQL editor rewrites those).

-- 1. Step keys --------------------------------------------------------------------
alter table public.demo_evaluation_progress drop constraint if exists demo_evaluation_progress_step_key_check;
alter table public.demo_evaluation_progress add constraint demo_evaluation_progress_step_key_check check (step_key in (
  'guide_opened',
  'patient_admission', 'clabsi_classification', 'microbiology_mdro', 'hand_hygiene', 'incident_capa', 'analysis_export',
  'employee_record', 'performance_evaluation',
  'occupational_visit', 'occupational_vaccination', 'occupational_exposure',
  'quality_audit',
  'antimicrobial_consumption',
  'committee_minutes',
  'users_roles', 'operating_profile',
  'department_overview', 'staff_training'
));

-- 2. Questionnaire ------------------------------------------------------------------
alter table public.demo_evaluation_progress
  add column if not exists ease smallint check (ease between 1 and 5),
  add column if not exists clarity smallint check (clarity between 1 and 5),
  add column if not exists duration_seconds integer check (duration_seconds is null or duration_seconds between 0 and 86400);

-- Stores the signed-in Demo member's questionnaire for a completed scenario
-- (or, for 'guide_opened', the guide as a whole): usefulness (the existing
-- rating), ease, clarity, the time it took and a comment. Returns every
-- rating of that member, as demo_rate_evaluation_step does.
create or replace function public.demo_submit_scenario_feedback(p_organization_id uuid, p_step text, p_rating integer,
  p_ease integer default null, p_clarity integer default null, p_duration_seconds integer default null, p_comment text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.organization_members om join public.organizations o on o.id = om.organization_id
    where om.organization_id = p_organization_id and om.user_id = auth.uid() and om.status = 'active' and o.is_demo
  ) then
    raise exception 'Not a member of this Demo' using errcode = '42501';
  end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'A rating from 1 to 5 is required' using errcode = '22023';
  end if;
  if (p_ease is not null and (p_ease < 1 or p_ease > 5)) or (p_clarity is not null and (p_clarity < 1 or p_clarity > 5)) then
    raise exception 'Ease and clarity range from 1 to 5' using errcode = '22023';
  end if;
  insert into public.demo_evaluation_progress(demo_organization_id, user_id, step_key, completed_at, updated_at,
    rating, ease, clarity, duration_seconds, rating_comment, rated_at)
  values (p_organization_id, auth.uid(), p_step, now(), now(), p_rating, p_ease, p_clarity,
    case when p_duration_seconds between 0 and 86400 then p_duration_seconds end,
    left(nullif(btrim(coalesce(p_comment, '')), ''), 1000), now())
  on conflict (demo_organization_id, user_id, step_key)
  do update set rating = excluded.rating, ease = excluded.ease, clarity = excluded.clarity,
    duration_seconds = coalesce(excluded.duration_seconds, public.demo_evaluation_progress.duration_seconds),
    rating_comment = excluded.rating_comment, rated_at = excluded.rated_at,
    completed_at = coalesce(public.demo_evaluation_progress.completed_at, now()), updated_at = now();
  return coalesce((select jsonb_object_agg(p.step_key, jsonb_build_object('rating', p.rating, 'comment', p.rating_comment,
      'ease', p.ease, 'clarity', p.clarity, 'durationSeconds', p.duration_seconds))
    from public.demo_evaluation_progress p
    where p.demo_organization_id = p_organization_id and p.user_id = auth.uid() and p.rating is not null), '{}'::jsonb);
end;
$function$;

revoke all on function public.demo_submit_scenario_feedback(uuid, text, integer, integer, integer, integer, text) from public, anon;
grant execute on function public.demo_submit_scenario_feedback(uuid, text, integer, integer, integer, integer, text) to authenticated;
