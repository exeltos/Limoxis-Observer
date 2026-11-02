-- Συνεντεύξεις, φάση 1: διευθύνσεις, γνώμη ανά ρόλο, ρύθμιση για ανέβασμα αρχείων από tablet.
--
--   hr_divisions               the divisions of the hospital (Νοσηλευτική Υπηρεσία, Διεύθυνση Λειτουργιών, …);
--   hr_division_categories     which professional category (Νοσηλευτής, Τεχνικός, …) belongs to which division;
--   hr_division_members        which users direct a division (role «Διευθυντής Διεύθυνσης»);
--   hr_candidates.professional_category   the category of the position the candidate asks for;
--   hr_interview_opinions      one opinion per person: propose / reserve / reject / approve + comment.
--                              No direct access: the functions below show someone else's opinion only
--                              after the reader has submitted his / her own;
--   hr_interview_settings      per hospital: may the candidate attach CV / certificates on the tablet
--                              (off by default; the capability is for later use).
--
-- Who sees what: HR office and Hospital Admin read everything (view_interviews, as before).
-- A Division Director reads ONLY, through hr_division_candidates(), the candidates whose category
-- belongs to his / her division, and ONLY the professional data and the CV (no ID, family, health,
-- address or contact), never the table itself.

alter table public.hr_candidates add column if not exists professional_category text;
alter table public.hr_candidates add column if not exists tablet_attachments_allowed boolean not null default false;

create table if not exists public.hr_divisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  created_at timestamptz not null default now(),
  unique (organization_id, name),
  unique (id, organization_id)
);

create table if not exists public.hr_division_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  division_id uuid not null,
  professional_category text not null check (length(btrim(professional_category)) > 0),
  created_at timestamptz not null default now(),
  unique (organization_id, professional_category),
  foreign key (division_id, organization_id) references public.hr_divisions (id, organization_id) on delete cascade
);

create table if not exists public.hr_division_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  division_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (division_id, user_id),
  foreign key (division_id, organization_id) references public.hr_divisions (id, organization_id) on delete cascade
);
create index if not exists hr_division_members_user_idx on public.hr_division_members (user_id, organization_id);

create table if not exists public.hr_interview_opinions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  candidate_id uuid not null,
  author_id uuid not null references auth.users(id) on delete cascade,
  role_kind text not null check (role_kind in ('hr_office','division')),
  division_id uuid,
  stance text check (stance in ('propose','reserve','reject','approve')),
  comment text,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (candidate_id, author_id),
  check (submitted_at is null or stance is not null),
  foreign key (candidate_id, organization_id) references public.hr_candidates (id, organization_id) on delete cascade
);
create index if not exists hr_interview_opinions_org_idx on public.hr_interview_opinions (organization_id, candidate_id);

create table if not exists public.hr_interview_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  tablet_attachments boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Row-level security ------------------------------------------------------------------------
do $policies$
declare
  t text;
begin
  foreach t in array array['hr_divisions','hr_division_categories','hr_division_members','hr_interview_settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_read') then
      execute format('create policy %I on public.%I for select to authenticated using (public.current_user_has_capability(organization_id, ''view_interviews'') or public.current_user_has_capability(organization_id, ''manage_interviews''))', t || '_read', t);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_write') then
      execute format('create policy %I on public.%I for all to authenticated using (public.current_user_has_capability(organization_id, ''manage_interviews'')) with check (public.current_user_has_capability(organization_id, ''manage_interviews''))', t || '_write', t);
    end if;
  end loop;
  -- The opinions table has no policy for people: only the functions below read and write it.
  alter table public.hr_interview_opinions enable row level security;
  revoke all on public.hr_interview_opinions from anon, authenticated;
end;
$policies$;

-- The divisions the signed-in user directs in this hospital.
create or replace function private.hr_my_divisions(p_org uuid)
returns setof uuid language sql stable security definer set search_path = ''
as $$
  select dm.division_id
  from public.hr_division_members dm
  join public.organization_members om on om.user_id = dm.user_id and om.organization_id = dm.organization_id
  where dm.user_id = auth.uid() and dm.organization_id = p_org and om.status = 'active' and om.role = 'division_director';
$$;
revoke all on function private.hr_my_divisions(uuid) from public, anon, authenticated;

-- May the signed-in user give an opinion on this candidate, and as which role?
create or replace function private.hr_opinion_role(p_org uuid, p_candidate uuid)
returns text language plpgsql stable security definer set search_path = ''
as $$
begin
  if public.current_user_has_capability(p_org, 'manage_interviews') then return 'hr_office'; end if;
  if exists (
    select 1 from public.hr_candidates c
    join public.hr_division_categories dc on dc.organization_id = c.organization_id and dc.professional_category = c.professional_category
    where c.id = p_candidate and c.organization_id = p_org
      and dc.division_id in (select private.hr_my_divisions(p_org))
  ) then return 'division'; end if;
  return null;
end;
$$;
revoke all on function private.hr_opinion_role(uuid, uuid) from public, anon, authenticated;

-- The candidates of the user's division, professional data and CV only.
create or replace function public.hr_division_candidates(p_organization_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $function$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'code', c.code, 'fullName', c.full_name, 'requestedPosition', c.requested_position,
      'professionalCategory', c.professional_category, 'employmentType', c.employment_type,
      'educationLevel', c.education_level, 'education', c.education, 'itSkills', c.it_skills,
      'whyUs', c.why_us, 'status', c.status, 'appliedOn', c.applied_on, 'decision', c.decision,
      'languages', coalesce((select jsonb_agg(jsonb_build_object('language', l.language, 'reading', l.reading, 'writing', l.writing, 'speaking', l.speaking, 'certificate', l.certificate, 'certificateName', l.certificate_name) order by l.position)
        from public.hr_candidate_languages l where l.candidate_id = c.id), '[]'::jsonb),
      'employers', coalesce((select jsonb_agg(jsonb_build_object('employer', e.employer, 'fromOn', e.from_on, 'toOn', e.to_on, 'jobTitle', e.job_title) order by e.position)
        from public.hr_candidate_employers e where e.candidate_id = c.id), '[]'::jsonb),
      'interviews', coalesce((select jsonb_agg(jsonb_build_object('scheduledAt', i.scheduled_at, 'status', i.status) order by i.scheduled_at)
        from public.hr_interviews i where i.candidate_id = c.id), '[]'::jsonb)
    ) order by c.applied_on desc nulls last, c.code)
    from public.hr_candidates c
    join public.hr_division_categories dc on dc.organization_id = c.organization_id and dc.professional_category = c.professional_category
    where c.organization_id = p_organization_id
      and dc.division_id in (select private.hr_my_divisions(p_organization_id))
  ), '[]'::jsonb);
end;
$function$;
revoke all on function public.hr_division_candidates(uuid) from public, anon;
grant execute on function public.hr_division_candidates(uuid) to authenticated;

-- The opinions of a candidate. Someone else's opinion is shown only after the reader has
-- submitted his / her own; until then only the number of opinions submitted is shown.
create or replace function public.hr_candidate_opinions(p_candidate_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $function$
declare
  v_org uuid;
  v_role text;
  v_mine public.hr_interview_opinions;
  v_submitted integer;
  v_open boolean;
  v_classes integer;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select organization_id into v_org from public.hr_candidates where id = p_candidate_id;
  if v_org is null then raise exception 'HR_CANDIDATE_NOT_FOUND'; end if;
  v_role := private.hr_opinion_role(v_org, p_candidate_id);
  if v_role is null and not public.current_user_has_capability(v_org, 'view_interviews') then raise exception 'HR_OPINION_FORBIDDEN' using errcode = '42501'; end if;
  select * into v_mine from public.hr_interview_opinions where candidate_id = p_candidate_id and author_id = auth.uid();
  select count(*) into v_submitted from public.hr_interview_opinions where candidate_id = p_candidate_id and submitted_at is not null;
  v_open := v_mine.submitted_at is not null;
  select count(distinct case when stance in ('propose','approve') then 'for' when stance = 'reserve' then 'reserve' else 'against' end)
    into v_classes from public.hr_interview_opinions where candidate_id = p_candidate_id and submitted_at is not null;
  return jsonb_build_object(
    'role', v_role,
    'mine', case when v_mine.id is null then null else jsonb_build_object('stance', v_mine.stance, 'comment', v_mine.comment, 'submittedAt', v_mine.submitted_at) end,
    'submittedCount', v_submitted,
    'visible', v_open,
    'disagreement', v_open and v_classes > 1,
    'opinions', case when v_open then coalesce((
      select jsonb_agg(jsonb_build_object('roleKind', o.role_kind, 'division', d.name, 'author', coalesce(u.raw_user_meta_data ->> 'full_name', u.email), 'stance', o.stance, 'comment', o.comment, 'submittedAt', o.submitted_at, 'mine', o.author_id = auth.uid()) order by o.submitted_at)
      from public.hr_interview_opinions o
      left join public.hr_divisions d on d.id = o.division_id
      left join auth.users u on u.id = o.author_id
      where o.candidate_id = p_candidate_id and o.submitted_at is not null), '[]'::jsonb) else '[]'::jsonb end
  );
end;
$function$;
revoke all on function public.hr_candidate_opinions(uuid) from public, anon;
grant execute on function public.hr_candidate_opinions(uuid) to authenticated;

-- Saves the caller's opinion (a draft) or submits it. A submitted opinion cannot be changed.
create or replace function public.hr_save_opinion(p_candidate_id uuid, p_stance text, p_comment text, p_submit boolean default false)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $function$
declare
  v_org uuid;
  v_role text;
  v_division uuid;
  v_old public.hr_interview_opinions;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select organization_id into v_org from public.hr_candidates where id = p_candidate_id;
  if v_org is null then raise exception 'HR_CANDIDATE_NOT_FOUND'; end if;
  v_role := private.hr_opinion_role(v_org, p_candidate_id);
  if v_role is null then raise exception 'HR_OPINION_FORBIDDEN' using errcode = '42501'; end if;
  if p_stance is not null and p_stance not in ('propose','reserve','reject','approve') then raise exception 'HR_OPINION_INVALID'; end if;
  if p_submit and p_stance is null then raise exception 'HR_OPINION_STANCE_REQUIRED'; end if;
  select * into v_old from public.hr_interview_opinions where candidate_id = p_candidate_id and author_id = auth.uid();
  if v_old.submitted_at is not null then raise exception 'HR_OPINION_SUBMITTED'; end if;
  if v_role = 'division' then
    select dc.division_id into v_division from public.hr_candidates c
      join public.hr_division_categories dc on dc.organization_id = c.organization_id and dc.professional_category = c.professional_category
      where c.id = p_candidate_id and dc.division_id in (select private.hr_my_divisions(v_org)) limit 1;
  end if;
  insert into public.hr_interview_opinions (organization_id, candidate_id, author_id, role_kind, division_id, stance, comment, submitted_at)
  values (v_org, p_candidate_id, auth.uid(), v_role, v_division, p_stance, nullif(btrim(coalesce(p_comment, '')), ''), case when p_submit then now() end)
  on conflict (candidate_id, author_id) do update set stance = excluded.stance, comment = excluded.comment, submitted_at = excluded.submitted_at, updated_at = now();
  return jsonb_build_object('ok', true, 'submitted', coalesce(p_submit, false));
end;
$function$;
revoke all on function public.hr_save_opinion(uuid, text, text, boolean) from public, anon;
grant execute on function public.hr_save_opinion(uuid, text, text, boolean) to authenticated;
