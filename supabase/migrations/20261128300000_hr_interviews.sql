-- Συνεντεύξεις υποψηφίων (HR): the applications and interviews of the FileMaker «HR Data».
--
--   hr_candidates             the application: who, the position asked for, contact,
--                             education (rows as json), IT skills, why us, the GDPR
--                             consent, the pipeline status, the decision and the employee
--                             the candidate became when hired;
--   hr_candidate_languages    a language with reading / writing / speaking and certificate
--                             (FileMaker: HR Language);
--   hr_candidate_employers    a previous employer (FileMaker: HR Data ERGODOTES);
--   hr_interviews             an interview: when, the evaluators (ΑΞΙΟΛΟΓΗΤΗΣ 1 / 2, HR),
--                             the scores per criterion, the overall rating, the
--                             recommendation (ΠΡΟΤΑΣΗ ΣΥΝΕΡΓΑΣΙΑΣ), salary and notes.
--
-- Personal data: only view_interviews reads and only manage_interviews writes
-- (Hospital Admin, HR office; public.current_user_has_capability).

-- 1. Tables ------------------------------------------------------------------------------

create table if not exists public.hr_candidates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  full_name text not null check (length(btrim(full_name)) > 0),
  gender text check (gender in ('male','female','other')),
  father_name text,
  mother_name text,
  birth_date date,
  birth_place text,
  nationality text,
  citizenship text,
  id_number text,
  id_authority text,
  id_issued_on date,
  address text,
  area text,
  postcode text,
  phone_landline text,
  phone_mobile text,
  email text,
  requested_position text,
  employment_type text check (employment_type in ('full_time','part_time','seasonal','internship','other')),
  military_service text check (military_service in ('done','exempt','not_done','not_applicable')),
  work_permit boolean,
  practice_licence boolean,
  smoker boolean,
  marital_status text check (marital_status in ('single','married','divorced','widowed','other')),
  children integer check (children is null or children between 0 and 30),
  education_level text,
  education jsonb not null default '[]'::jsonb check (jsonb_typeof(education) = 'array'),
  it_skills text,
  activities text,
  why_us text,
  application_reason text,
  applied_on date default current_date,
  consent_given boolean not null default false,
  consent_at timestamptz,
  consent_text text,
  status text not null default 'new' check (status in ('new','screening','interview_scheduled','interviewed','offer','hired','rejected','withdrawn')),
  decision text check (decision in ('hire','reject','reserve')),
  decision_on date,
  decision_by_name text,
  decision_notes text,
  employee_id uuid references public.employees(id) on delete set null,
  source text not null default 'app' check (source in ('app','filemaker','demo')),
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  check (not consent_given or consent_at is not null),
  check (status <> 'hired' or employee_id is not null or source = 'filemaker'),
  unique (organization_id, code),
  unique (id, organization_id)
);
create index if not exists hr_candidates_org_idx on public.hr_candidates (organization_id, status, applied_on desc);
create index if not exists hr_candidates_employee_idx on public.hr_candidates (employee_id);

create table if not exists public.hr_candidate_languages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  candidate_id uuid not null,
  position integer not null default 0,
  language text not null check (length(btrim(language)) > 0),
  reading text check (reading in ('fluent','good','fair','basic')),
  writing text check (writing in ('fluent','good','fair','basic')),
  speaking text check (speaking in ('fluent','good','fair','basic')),
  certificate boolean,
  certificate_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (candidate_id, organization_id) references public.hr_candidates (id, organization_id) on delete cascade
);
create index if not exists hr_candidate_languages_candidate_idx on public.hr_candidate_languages (candidate_id, position);
create index if not exists hr_candidate_languages_org_idx on public.hr_candidate_languages (organization_id);

create table if not exists public.hr_candidate_employers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  candidate_id uuid not null,
  position integer not null default 0,
  employer text not null check (length(btrim(employer)) > 0),
  from_on date,
  to_on date,
  job_title text,
  salary numeric check (salary is null or salary >= 0),
  leaving_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (from_on is null or to_on is null or to_on >= from_on),
  foreign key (candidate_id, organization_id) references public.hr_candidates (id, organization_id) on delete cascade
);
create index if not exists hr_candidate_employers_candidate_idx on public.hr_candidate_employers (candidate_id, position);
create index if not exists hr_candidate_employers_org_idx on public.hr_candidate_employers (organization_id);

create table if not exists public.hr_interviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  candidate_id uuid not null,
  scheduled_at timestamptz,
  location text,
  status text not null default 'scheduled' check (status in ('scheduled','completed','cancelled')),
  interviewers jsonb not null default '[]'::jsonb check (jsonb_typeof(interviewers) = 'array'),
  scores jsonb not null default '{}'::jsonb check (jsonb_typeof(scores) = 'object'),
  overall_rating numeric check (overall_rating is null or overall_rating between 0 and 5),
  outcome text check (outcome in ('recommend','reserve','not_recommend')),
  recommendation text,
  strengths text,
  weaknesses text,
  salary_expectation numeric check (salary_expectation is null or salary_expectation >= 0),
  offered_salary numeric check (offered_salary is null or offered_salary >= 0),
  benefits text,
  available_from date,
  evaluated_at timestamptz,
  evaluated_by_name text,
  notes text,
  source text not null default 'app' check (source in ('app','filemaker','demo')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now(),
  foreign key (candidate_id, organization_id) references public.hr_candidates (id, organization_id) on delete cascade
);
create index if not exists hr_interviews_candidate_idx on public.hr_interviews (candidate_id, scheduled_at);
create index if not exists hr_interviews_org_idx on public.hr_interviews (organization_id, scheduled_at desc);

-- 2. Rules ---------------------------------------------------------------------------------

create or replace function private.hr_touch()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  if tg_table_name in ('hr_candidates','hr_interviews') then new.updated_by := coalesce(auth.uid(), new.updated_by); end if;
  return new;
end;
$$;
revoke all on function private.hr_touch() from public, anon, authenticated;

-- The candidate's code (ΥΠ-0001, …) when none is given.
create or replace function private.hr_candidate_code()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.code is null or btrim(new.code) = '' then
    perform pg_advisory_xact_lock(hashtext('hr_candidate_code:' || new.organization_id::text));
    new.code := 'ΥΠ-' || lpad((coalesce((select max(substring(c.code from '^ΥΠ-([0-9]+)$')::integer) from public.hr_candidates c where c.organization_id = new.organization_id), 0) + 1)::text, 4, '0');
  end if;
  if new.consent_given and new.consent_at is null then new.consent_at := now(); end if;
  if new.employee_id is not null and (tg_op = 'INSERT' or new.employee_id is distinct from old.employee_id)
    and not exists (select 1 from public.employees e where e.id = new.employee_id and e.organization_id = new.organization_id) then
    raise exception 'HR_EMPLOYEE_OTHER_ORGANIZATION' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.hr_candidate_code() from public, anon, authenticated;

create or replace trigger trg_hr_candidates_code before insert or update on public.hr_candidates for each row execute function private.hr_candidate_code();
create or replace trigger trg_hr_candidates_touch before update on public.hr_candidates for each row execute function private.hr_touch();
create or replace trigger trg_hr_candidate_languages_touch before update on public.hr_candidate_languages for each row execute function private.hr_touch();
create or replace trigger trg_hr_candidate_employers_touch before update on public.hr_candidate_employers for each row execute function private.hr_touch();
create or replace trigger trg_hr_interviews_touch before update on public.hr_interviews for each row execute function private.hr_touch();

-- 3. Row-level security --------------------------------------------------------------------

do $policies$
declare
  t text;
  v_read text := 'public.current_user_has_capability(organization_id, ''view_interviews'') or public.current_user_has_capability(organization_id, ''manage_interviews'')';
  v_manage text := 'public.current_user_has_capability(organization_id, ''manage_interviews'')';
begin
  foreach t in array array['hr_candidates','hr_candidate_languages','hr_candidate_employers','hr_interviews'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (%s)', t || '_read', t, v_read);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (%s)', t || '_insert', t, v_manage);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)', t || '_update', t, v_manage, v_manage);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for delete to authenticated using (%s)', t || '_delete', t, v_manage);
  end loop;
end;
$policies$;

comment on table public.hr_candidates is 'Συνεντεύξεις: αίτηση υποψηφίου (στοιχεία, εκπαίδευση, συναίνεση, κατάσταση, απόφαση). FileMaker: HR Data.';
comment on table public.hr_candidate_languages is 'Συνεντεύξεις: ξένη γλώσσα υποψηφίου. FileMaker: HR Language.';
comment on table public.hr_candidate_employers is 'Συνεντεύξεις: προηγούμενος εργοδότης υποψηφίου. FileMaker: HR Data ERGODOTES.';
comment on table public.hr_interviews is 'Συνεντεύξεις: συνέντευξη και αξιολόγηση (αξιολογητές, βαθμολογίες, πρόταση συνεργασίας).';
