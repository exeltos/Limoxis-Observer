-- Quality → Audits → «Αυτοαξιολογήσεις»: a department fills in a questionnaire (one of the
-- audit questionnaires, the library or the hospital's own copy) about itself, as a
-- preparation for the audit. The Quality manager creates it for a department from a
-- questionnaire and releases it; only then does the department see it (and answer
-- it, with a progress bar). A submitted self-assessment gives the gaps (partial and
-- nonconforming answers) the audit starts from.
--
-- quality_self_assessments.checklist   a snapshot of the questions (the same rows as an audit
--                                      checklist: id, chapter, clause, item, weight, critical,
--                                      answer yes / partial / no / na, note, evidence).
-- quality_self_assessment_save(...)    the only way a department writes: it merges the answer,
--                                      note and evidence of the rows it knows (never the
--                                      questions), recomputes the progress and the score, and
--                                      submits when everything is answered.

create table if not exists public.quality_self_assessments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  template_id uuid references public.quality_audit_templates(id) on delete set null,
  standard text,
  title text not null check (length(btrim(title)) > 0),
  department_id uuid not null references public.departments(id) on delete cascade,
  department_name text not null default '',
  status text not null default 'draft' check (status in ('draft', 'released', 'submitted', 'closed')),
  due_on date,
  released_at timestamptz,
  released_by uuid references auth.users(id) on delete set null,
  submitted_at timestamptz,
  submitted_by uuid references auth.users(id) on delete set null,
  checklist jsonb not null default '[]'::jsonb check (jsonb_typeof(checklist) = 'array'),
  total_count integer not null default 0,
  answered_count integer not null default 0,
  score smallint check (score between 0 and 100),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
create index if not exists quality_self_assessments_org_idx on public.quality_self_assessments (organization_id, status);
create index if not exists quality_self_assessments_department_idx on public.quality_self_assessments (department_id, organization_id);
comment on table public.quality_self_assessments is 'A department''s self-assessment against an audit questionnaire; the department sees it once released.';

alter table public.quality_self_assessments enable row level security;
revoke all on table public.quality_self_assessments from anon, authenticated;
grant select, insert, update, delete on table public.quality_self_assessments to authenticated;

create policy quality_self_assessments_read on public.quality_self_assessments for select to authenticated using (
  (select public.current_user_is_platform_owner())
  or organization_id = any ((select private.current_user_quality_read_orgs())::uuid[])
  or (status in ('released', 'submitted', 'closed')
      and (organization_id::text || ':' || department_id::text) = any ((select private.current_user_department_scopes())::text[])));
create policy quality_self_assessments_insert on public.quality_self_assessments for insert to authenticated with check (
  organization_id = any ((select private.current_user_quality_manage_orgs())::uuid[]));
create policy quality_self_assessments_update on public.quality_self_assessments for update to authenticated
  using (organization_id = any ((select private.current_user_quality_manage_orgs())::uuid[]))
  with check (organization_id = any ((select private.current_user_quality_manage_orgs())::uuid[]));
create policy quality_self_assessments_delete on public.quality_self_assessments for delete to authenticated
  using (organization_id = any ((select private.current_user_quality_manage_orgs())::uuid[]));

create policy quality_self_assessments_module_gate on public.quality_self_assessments as restrictive for all to authenticated
  using ((select not private.current_user_has_locked_modules()) or organization_id is null or not (organization_id = any ((select private.current_user_locked_module_orgs('{quality}'::text[]))::uuid[])))
  with check ((select not private.current_user_has_locked_modules()) or organization_id is null or not (organization_id = any ((select private.current_user_locked_module_orgs('{quality}'::text[]))::uuid[])));

do $$
begin
  if not exists (select 1 from pg_trigger where tgrelid = 'public.quality_self_assessments'::regclass and tgname = 'trg_quality_self_assessments_audit_fields') then
    create trigger trg_quality_self_assessments_audit_fields before insert or update on public.quality_self_assessments
      for each row execute function public.set_repository_audit_fields();
  end if;
end $$;

-- The progress and the score of a checklist (the audit scale: conforming 1, partial 0.5,
-- nonconforming 0, weighted; not applicable and unanswered rows are left out).
create or replace function private.quality_self_assessment_figures(p_checklist jsonb)
returns table (total integer, answered integer, score integer)
language sql immutable set search_path = ''
as $function$
  with rows as (
    select e->>'answer' as answer, case when coalesce((e->>'weight')::numeric, 1) > 0 then coalesce((e->>'weight')::numeric, 1) else 1 end as weight
    from jsonb_array_elements(case when jsonb_typeof(p_checklist) = 'array' then p_checklist else '[]'::jsonb end) e)
  select count(*)::integer,
         (count(*) filter (where answer in ('yes', 'partial', 'no', 'na')))::integer,
         case when coalesce(sum(weight) filter (where answer in ('yes', 'partial', 'no')), 0) = 0 then null
              else round(100 * sum(weight * case answer when 'yes' then 1 when 'partial' then 0.5 else 0 end) filter (where answer in ('yes', 'partial', 'no'))
                         / sum(weight) filter (where answer in ('yes', 'partial', 'no')))::integer end
  from rows;
$function$;
revoke all on function private.quality_self_assessment_figures(jsonb) from public, anon, authenticated;

-- A department (or the Quality team) saves the answers. p_answers: [{id, answer, note, evidence}].
-- Allowed while the self-assessment is released (a department) or at any time before it is
-- closed (the Quality team). p_submit needs every row answered.
create or replace function public.quality_self_assessment_save(p_id uuid, p_answers jsonb, p_submit boolean default false)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  v_row public.quality_self_assessments;
  v_manager boolean;
  v_department boolean;
  v_checklist jsonb;
  v_total integer;
  v_answered integer;
  v_score integer;
begin
  if auth.uid() is null or p_id is null then
    raise exception 'PERMISSION_DENIED';
  end if;
  v_row := (select r from public.quality_self_assessments r where r.id = p_id);
  if v_row.id is null then
    raise exception 'SELF_ASSESSMENT_NOT_FOUND';
  end if;
  v_manager := v_row.organization_id = any (private.current_user_quality_manage_orgs());
  v_department := v_row.status = 'released' and (v_row.organization_id::text || ':' || v_row.department_id::text) = any (private.current_user_department_scopes());
  if not (v_manager or v_department) then
    raise exception 'PERMISSION_DENIED';
  end if;
  if v_row.status in ('submitted', 'closed') and not v_manager then
    raise exception 'SELF_ASSESSMENT_LOCKED';
  end if;
  if v_row.status = 'closed' then
    raise exception 'SELF_ASSESSMENT_LOCKED';
  end if;

  v_checklist := coalesce((
    select jsonb_agg(
      case when a.e is null then c.e
           else c.e || jsonb_build_object(
             'answer', case when a.e->>'answer' in ('yes', 'partial', 'no', 'na') then a.e->>'answer' else '' end,
             'note', left(coalesce(a.e->>'note', ''), 2000),
             'evidence', left(coalesce(a.e->>'evidence', ''), 2000)) end
      order by c.ord)
    from jsonb_array_elements(v_row.checklist) with ordinality as c(e, ord)
    left join lateral (select x.e from jsonb_array_elements(case when jsonb_typeof(p_answers) = 'array' then p_answers else '[]'::jsonb end) x(e) where x.e->>'id' = c.e->>'id' limit 1) a on true
  ), '[]'::jsonb);
  select f.total, f.answered, f.score into v_total, v_answered, v_score from private.quality_self_assessment_figures(v_checklist) f;
  if coalesce(p_submit, false) and (v_total = 0 or v_answered < v_total) then
    raise exception 'SELF_ASSESSMENT_INCOMPLETE';
  end if;
  update public.quality_self_assessments r
     set checklist = v_checklist, total_count = v_total, answered_count = v_answered, score = v_score,
         status = case when coalesce(p_submit, false) then 'submitted' else r.status end,
         submitted_at = case when coalesce(p_submit, false) then now() else r.submitted_at end,
         submitted_by = case when coalesce(p_submit, false) then auth.uid() else r.submitted_by end,
         updated_at = now(), updated_by = auth.uid()
   where r.id = p_id;
  return jsonb_build_object('total', v_total, 'answered', v_answered, 'score', v_score, 'submitted', coalesce(p_submit, false));
end;
$function$;
revoke all on function public.quality_self_assessment_save(uuid, jsonb, boolean) from public, anon;
grant execute on function public.quality_self_assessment_save(uuid, jsonb, boolean) to authenticated;
