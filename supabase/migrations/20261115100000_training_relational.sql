-- Training: from the single JSON table public.training_records to relational
-- tables. Every value lives in its own column; nothing is kept in a payload.
--
-- training_programs                    a programme (key = the app's programme id, e.g. TRN-001)
--   training_program_materials         its material, in order
--   training_assessment_questions      its knowledge questions, in order
--     training_assessment_options      the choices of a question, in order
--   training_program_effectiveness     level-3 evaluation (one row, only once it exists)
--   training_program_feedback_questions the trainer-evaluation questions it uses
-- training_assignments                 a participant of a programme: invitation, attendance,
--                                      attestation, assessment, review, completion
--   training_assessment_answers        the participant's answer per question
--   training_feedback_responses        the participant's trainer evaluation (one per assignment)
--     training_feedback_scores         the 1..5 rating per evaluation question
--   training_certificates              the certificate issued for an assignment
-- training_requirements                required training per profession / position / department
--   training_requirement_programs      the programmes that satisfy it
--   training_requirement_targets       who it applies to (profession / position / department name)
-- training_feedback_templates          the trainer-evaluation questionnaire new programmes copy
--   training_feedback_template_questions
-- training_history_events              the Training registry history
--
-- Row ids are kept: a programme, assignment, certificate or requirement keeps
-- the uuid of its old training_records row, so notification_outbox.entity_id
-- (assignments) and attachments.entity_id (programmes) stay valid. Record keys
-- stay the app ids (routes /training/:programId, CAPA source TRAINING:<key>).
--
-- Access mirrors training_records: programmes and requirements are read by
-- every member of the organization; assignments and certificates by the
-- admin roles, the department scope, the employee themself and
-- manage_training; children follow their parent. Writes need manage_training
-- and go through the SECURITY INVOKER RPCs below; what the learner submits
-- (answers, trainer evaluation, certificates) is written only by the
-- token-checked SECURITY DEFINER RPCs.
--
-- The copy is verified row by row against training_records and the migration
-- fails on any difference. training_records is then frozen (read-only) and
-- kept as the archive of the old payloads.

-- 1. Tables --------------------------------------------------------------------

create table public.training_programs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  program_key text not null check (length(btrim(program_key)) > 0),
  title text not null default '',
  title_en text,
  category text,
  method text,
  owner text,
  trainer text,
  audience text,
  description text,
  start_date date,
  due_date date,
  valid_months integer check (valid_months is null or valid_months between 0 and 600),
  requires_assessment boolean not null default false,
  pass_score integer check (pass_score is null or pass_score between 0 and 100),
  status text not null default 'planned' check (status in ('planned','active','completed','cancelled')),
  department_id uuid references public.departments(id) on delete set null,
  feedback_template_key text,
  feedback_title_el text,
  feedback_title_en text,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, program_key),
  unique (id, organization_id)
);
create index training_programs_department_idx on public.training_programs (department_id);

create table public.training_program_materials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  program_id uuid not null,
  material_key text not null,
  position integer not null default 0,
  title text not null default '',
  material_type text,
  url text,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, material_key),
  foreign key (program_id, organization_id) references public.training_programs(id, organization_id) on delete cascade
);
create index training_program_materials_org_idx on public.training_program_materials (organization_id);

create table public.training_assessment_questions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  program_id uuid not null,
  question_key text not null,
  position integer not null default 0,
  question_type text not null default 'single_choice' check (question_type in ('single_choice','multiple_choice','true_false','free_text')),
  text text not null default '',
  points numeric not null default 0 check (points >= 0),
  required boolean not null default true,
  correct_boolean boolean,
  model_answer text,
  manual_review boolean not null default false,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, question_key),
  unique (id, organization_id),
  foreign key (program_id, organization_id) references public.training_programs(id, organization_id) on delete cascade
);
create index training_assessment_questions_org_idx on public.training_assessment_questions (organization_id);

create table public.training_assessment_options (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  question_id uuid not null,
  option_key text not null,
  position integer not null default 0,
  text text not null default '',
  correct boolean not null default false,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (question_id, option_key),
  foreign key (question_id, organization_id) references public.training_assessment_questions(id, organization_id) on delete cascade
);
create index training_assessment_options_org_idx on public.training_assessment_options (organization_id);

-- Level 3 of training effectiveness: did practice change. One row per
-- programme, created only once the evaluation is planned or recorded.
create table public.training_program_effectiveness (
  program_id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  planned_date date,
  method text,
  criterion text,
  result text check (result is null or result in ('effective','partial','not_effective')),
  evaluated_at date,
  evaluated_by text,
  notes text,
  comment text,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (program_id, organization_id) references public.training_programs(id, organization_id) on delete cascade
);
create index training_program_effectiveness_org_idx on public.training_program_effectiveness (organization_id);

create table public.training_program_feedback_questions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  program_id uuid not null,
  question_key text not null,
  position integer not null default 0,
  label_el text not null default '',
  label_en text,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, question_key),
  foreign key (program_id, organization_id) references public.training_programs(id, organization_id) on delete cascade
);
create index training_program_feedback_questions_org_idx on public.training_program_feedback_questions (organization_id);

create table public.training_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assignment_key text not null check (length(btrim(assignment_key)) > 0),
  program_id uuid not null,
  employee_id uuid references public.employees(id) on delete set null,
  employee_code text,
  employee_name text,
  department_name text,
  department_id uuid references public.departments(id) on delete set null,
  employee_user_id uuid references auth.users(id) on delete set null,
  email text,
  account_linked boolean,
  manual_entry boolean not null default false,
  assigned_date date,
  due_date date,
  status text not null default 'assigned' check (status in ('assigned','in_progress','completed','cancelled')),
  invitation_sent_at timestamptz,
  access_token text,
  attendance_response text not null default 'not_sent' check (attendance_response in ('not_sent','sent','confirmed','declined')),
  attendance boolean,
  attendance_confirmed_at timestamptz,
  attendance_attested boolean,
  attendance_attested_at timestamptz,
  attendance_attestation_method text,
  attendance_attestation_version text,
  completion_confirmed_at timestamptz,
  feedback_submitted_at timestamptz,
  assessment_submitted_at timestamptz,
  assessment_review_status text check (assessment_review_status is null or assessment_review_status in ('not_required','pending','reviewed')),
  assessment_reviewed_at timestamptz,
  assessment_reviewed_by text,
  assessment_review_acknowledged boolean,
  assessment_review_note text,
  score integer check (score is null or score between 0 and 100),
  competent boolean,
  completed_date date,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, assignment_key),
  unique (id, organization_id),
  foreign key (program_id, organization_id) references public.training_programs(id, organization_id)
);
create unique index training_assignments_access_token_key on public.training_assignments (access_token) where access_token is not null;
create index training_assignments_program_idx on public.training_assignments (program_id);
create index training_assignments_scope_idx on public.training_assignments (organization_id, department_id, employee_user_id);
create index training_assignments_employee_idx on public.training_assignments (employee_id);
create index training_assignments_employee_code_idx on public.training_assignments (organization_id, employee_code);
create index training_assignments_department_idx on public.training_assignments (department_id);
create index training_assignments_user_idx on public.training_assignments (employee_user_id) where employee_user_id is not null;

-- One answer per question key. The kind says which column holds it: the text
-- (free text or the chosen option of a single choice), a true/false, a number,
-- or the chosen options of a multiple choice. awarded_points is set when the
-- answer is scored (automatically, or by the reviewer for free text).
create table public.training_assessment_answers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assignment_id uuid not null,
  question_key text not null,
  answer_kind text not null check (answer_kind in ('text','boolean','number','options')),
  answer_text text,
  answer_boolean boolean,
  answer_number numeric,
  answer_option_keys text[],
  awarded_points numeric check (awarded_points is null or awarded_points >= 0),
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, question_key),
  foreign key (assignment_id, organization_id) references public.training_assignments(id, organization_id) on delete cascade
);
create index training_assessment_answers_org_idx on public.training_assessment_answers (organization_id);

create table public.training_feedback_responses (
  assignment_id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  program_id uuid not null,
  employee_code text,
  user_id uuid,
  submitted_at timestamptz,
  comment text,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (assignment_id, organization_id) references public.training_assignments(id, organization_id) on delete cascade,
  foreign key (program_id, organization_id) references public.training_programs(id, organization_id) on delete cascade
);
create index training_feedback_responses_program_idx on public.training_feedback_responses (program_id);
create index training_feedback_responses_org_idx on public.training_feedback_responses (organization_id);

create table public.training_feedback_scores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assignment_id uuid not null references public.training_feedback_responses(assignment_id) on delete cascade,
  question_key text not null,
  score smallint not null check (score between 1 and 5),
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, question_key)
);
create index training_feedback_scores_org_idx on public.training_feedback_scores (organization_id);

create table public.training_certificates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  certificate_key text not null check (length(btrim(certificate_key)) > 0),
  assignment_id uuid not null unique,
  employee_code text,
  title text,
  issued_date date,
  valid_until date,
  issuer text,
  issued_at timestamptz,
  issued_by uuid,
  department_id uuid references public.departments(id) on delete set null,
  employee_user_id uuid references auth.users(id) on delete set null,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, certificate_key),
  foreign key (assignment_id, organization_id) references public.training_assignments(id, organization_id)
);
create index training_certificates_scope_idx on public.training_certificates (organization_id, department_id, employee_user_id);
create index training_certificates_department_idx on public.training_certificates (department_id);
create index training_certificates_user_idx on public.training_certificates (employee_user_id) where employee_user_id is not null;

create table public.training_requirements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requirement_key text not null check (length(btrim(requirement_key)) > 0),
  title text not null default '',
  renewal_months integer check (renewal_months is null or renewal_months between 0 and 600),
  active boolean not null default true,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, requirement_key),
  unique (id, organization_id)
);

create table public.training_requirement_programs (
  requirement_id uuid not null,
  program_id uuid not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  position integer not null default 0,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (requirement_id, program_id),
  foreign key (requirement_id, organization_id) references public.training_requirements(id, organization_id) on delete cascade,
  foreign key (program_id, organization_id) references public.training_programs(id, organization_id) on delete cascade
);
create index training_requirement_programs_program_idx on public.training_requirement_programs (program_id);
create index training_requirement_programs_org_idx on public.training_requirement_programs (organization_id);

-- Who a requirement applies to, by name (as the employee record holds them).
create table public.training_requirement_targets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  requirement_id uuid not null,
  target_kind text not null check (target_kind in ('profession','position','department')),
  value text not null,
  position integer not null default 0,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (requirement_id, target_kind, value),
  foreign key (requirement_id, organization_id) references public.training_requirements(id, organization_id) on delete cascade
);
create index training_requirement_targets_org_idx on public.training_requirement_targets (organization_id);

create table public.training_feedback_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  template_key text not null,
  title_el text,
  title_en text,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, template_key),
  unique (id, organization_id)
);

create table public.training_feedback_template_questions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  template_id uuid not null,
  question_key text not null,
  position integer not null default 0,
  label_el text not null default '',
  label_en text,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_id, question_key),
  foreign key (template_id, organization_id) references public.training_feedback_templates(id, organization_id) on delete cascade
);
create index training_feedback_template_questions_org_idx on public.training_feedback_template_questions (organization_id);

create table public.training_history_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  position integer not null default 0,
  occurred_at timestamptz,
  actor text,
  action text,
  created_by uuid default auth.uid(),
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index training_history_events_org_idx on public.training_history_events (organization_id, position);

-- 2. Copy, field by field ------------------------------------------------------
-- Empty strings become NULL; arrays keep their order in position (ordinality).

insert into public.training_programs(id, organization_id, program_key, title, title_en, category, method, owner, trainer, audience, description,
  start_date, due_date, valid_months, requires_assessment, pass_score, status, department_id,
  feedback_template_key, feedback_title_el, feedback_title_en, created_by, updated_by, created_at, updated_at)
select r.id, r.organization_id, r.record_key, coalesce(r.payload->>'title', ''), nullif(r.payload->>'titleEn', ''),
  nullif(r.payload->>'category', ''), nullif(r.payload->>'method', ''), nullif(r.payload->>'owner', ''), nullif(r.payload->>'trainer', ''),
  nullif(r.payload->>'audience', ''), nullif(r.payload->>'description', ''),
  nullif(r.payload->>'startDate', '')::date, nullif(r.payload->>'dueDate', '')::date,
  round(nullif(r.payload->>'validMonths', '')::numeric)::integer, coalesce(nullif(r.payload->>'requiresAssessment', '')::boolean, false),
  round(nullif(r.payload->>'passScore', '')::numeric)::integer, coalesce(nullif(r.payload->>'status', ''), 'planned'),
  coalesce(r.department_id, case when r.payload->>'departmentId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (r.payload->>'departmentId')::uuid end),
  nullif(r.payload->'trainerFeedbackTemplate'->>'id', ''), nullif(r.payload->'trainerFeedbackTemplate'->>'titleEl', ''),
  nullif(r.payload->'trainerFeedbackTemplate'->>'titleEn', ''),
  r.created_by, r.updated_by, coalesce(nullif(r.payload->>'createdAt', '')::timestamptz, r.created_at), r.updated_at
from public.training_records r
where r.record_type = 'program';

insert into public.training_program_materials(organization_id, program_id, material_key, position, title, material_type, url, created_by, updated_by, created_at, updated_at)
select r.organization_id, r.id, coalesce(nullif(m.value->>'id', ''), 'MAT-' || m.ord), m.ord::integer, coalesce(m.value->>'title', ''),
  nullif(m.value->>'type', ''), nullif(m.value->>'url', ''), r.created_by, r.updated_by, r.created_at, r.updated_at
from public.training_records r
cross join lateral jsonb_array_elements(case when jsonb_typeof(r.payload->'materials') = 'array' then r.payload->'materials' else '[]'::jsonb end) with ordinality m(value, ord)
where r.record_type = 'program';

insert into public.training_assessment_questions(organization_id, program_id, question_key, position, question_type, text, points, required,
  correct_boolean, model_answer, manual_review, created_by, updated_by, created_at, updated_at)
select r.organization_id, r.id, coalesce(nullif(q.value->>'id', ''), 'Q-' || q.ord), q.ord::integer,
  case coalesce(nullif(q.value->>'type', ''), 'single_choice') when 'multiple' then 'single_choice' when 'boolean' then 'true_false' else coalesce(nullif(q.value->>'type', ''), 'single_choice') end,
  coalesce(q.value->>'text', ''), greatest(coalesce(nullif(q.value->>'points', '')::numeric, 1), 0), coalesce(nullif(q.value->>'required', '')::boolean, true),
  nullif(q.value->>'correctBoolean', '')::boolean, nullif(q.value->>'modelAnswer', ''), coalesce(nullif(q.value->>'manualReview', '')::boolean, false),
  r.created_by, r.updated_by, r.created_at, r.updated_at
from public.training_records r
cross join lateral jsonb_array_elements(case when jsonb_typeof(r.payload->'assessmentQuestions') = 'array' then r.payload->'assessmentQuestions' else '[]'::jsonb end) with ordinality q(value, ord)
where r.record_type = 'program';

insert into public.training_assessment_options(organization_id, question_id, option_key, position, text, correct, created_by, updated_by, created_at, updated_at)
select r.organization_id, tq.id, coalesce(nullif(o.value->>'id', ''), 'OPT-' || o.ord), o.ord::integer, coalesce(o.value->>'text', ''),
  coalesce(nullif(o.value->>'correct', '')::boolean, false), r.created_by, r.updated_by, r.created_at, r.updated_at
from public.training_records r
cross join lateral jsonb_array_elements(case when jsonb_typeof(r.payload->'assessmentQuestions') = 'array' then r.payload->'assessmentQuestions' else '[]'::jsonb end) with ordinality q(value, ord)
join public.training_assessment_questions tq on tq.program_id = r.id and tq.question_key = coalesce(nullif(q.value->>'id', ''), 'Q-' || q.ord)
cross join lateral jsonb_array_elements(case when jsonb_typeof(q.value->'options') = 'array' then q.value->'options' else '[]'::jsonb end) with ordinality o(value, ord)
where r.record_type = 'program';

insert into public.training_program_effectiveness(program_id, organization_id, planned_date, method, criterion, result, evaluated_at, evaluated_by, notes, comment,
  created_by, updated_by, created_at, updated_at)
select r.id, r.organization_id, nullif(e->>'plannedDate', '')::date, nullif(e->>'method', ''), nullif(e->>'criterion', ''), nullif(e->>'result', ''),
  nullif(e->>'evaluatedAt', '')::date, nullif(e->>'evaluatedBy', ''), nullif(e->>'notes', ''), nullif(e->>'comment', ''),
  r.created_by, r.updated_by, r.created_at, r.updated_at
from public.training_records r
cross join lateral (select r.payload->'effectiveness' e) x
where r.record_type = 'program' and jsonb_typeof(r.payload->'effectiveness') = 'object';

insert into public.training_program_feedback_questions(organization_id, program_id, question_key, position, label_el, label_en, created_by, updated_by, created_at, updated_at)
select r.organization_id, r.id, coalesce(nullif(q.value->>'id', ''), 'feedback-' || q.ord), q.ord::integer,
  coalesce(q.value->>'labelEl', q.value->>'label', ''), nullif(q.value->>'labelEn', ''), r.created_by, r.updated_by, r.created_at, r.updated_at
from public.training_records r
cross join lateral jsonb_array_elements(case when jsonb_typeof(r.payload->'trainerFeedbackTemplate'->'questions') = 'array' then r.payload->'trainerFeedbackTemplate'->'questions' else '[]'::jsonb end) with ordinality q(value, ord)
where r.record_type = 'program';

insert into public.training_assignments(id, organization_id, assignment_key, program_id, employee_id, employee_code, employee_name, department_name,
  department_id, employee_user_id, email, account_linked, manual_entry, assigned_date, due_date, status, invitation_sent_at, access_token,
  attendance_response, attendance, attendance_confirmed_at, attendance_attested, attendance_attested_at, attendance_attestation_method,
  attendance_attestation_version, completion_confirmed_at, feedback_submitted_at, assessment_submitted_at, assessment_review_status,
  assessment_reviewed_at, assessment_reviewed_by, assessment_review_acknowledged, score, competent, completed_date,
  created_by, updated_by, created_at, updated_at)
select r.id, r.organization_id, r.record_key, p.id,
  (select e.id from public.employees e where e.organization_id = r.organization_id and e.id::text = r.payload->>'employeeDbId'),
  nullif(r.payload->>'employeeId', ''), nullif(r.payload->>'employeeName', ''), nullif(r.payload->>'department', ''),
  r.department_id, r.employee_user_id, nullif(r.payload->>'email', ''), nullif(r.payload->>'accountLinked', '')::boolean,
  coalesce(nullif(r.payload->>'manualEntry', '')::boolean, false),
  nullif(r.payload->>'assignedDate', '')::date, nullif(r.payload->>'dueDate', '')::date, coalesce(nullif(r.payload->>'status', ''), 'assigned'),
  nullif(r.payload->>'invitationSentAt', '')::timestamptz, nullif(r.payload->>'accessToken', ''),
  coalesce(nullif(r.payload->>'attendanceResponse', ''), 'not_sent'), nullif(r.payload->>'attendance', '')::boolean,
  nullif(r.payload->>'attendanceConfirmedAt', '')::timestamptz, nullif(r.payload->>'attendanceAttested', '')::boolean,
  nullif(r.payload->>'attendanceAttestedAt', '')::timestamptz, nullif(r.payload->>'attendanceAttestationMethod', ''),
  nullif(r.payload->>'attendanceAttestationVersion', ''), nullif(r.payload->>'completionConfirmedAt', '')::timestamptz,
  nullif(r.payload->>'feedbackSubmittedAt', '')::timestamptz, nullif(r.payload->>'assessmentSubmittedAt', '')::timestamptz,
  nullif(r.payload->>'assessmentReviewStatus', ''), nullif(r.payload->>'assessmentReviewedAt', '')::timestamptz,
  nullif(r.payload->>'assessmentReviewedBy', ''), nullif(r.payload->>'assessmentReviewAcknowledged', '')::boolean,
  round(nullif(r.payload->>'score', '')::numeric)::integer, nullif(r.payload->>'competent', '')::boolean, nullif(r.payload->>'completedDate', '')::date,
  r.created_by, r.updated_by, coalesce(nullif(r.payload->>'createdAt', '')::timestamptz, r.created_at), r.updated_at
from public.training_records r
join public.training_programs p on p.organization_id = r.organization_id and p.program_key = r.payload->>'programId'
where r.record_type = 'assignment';

insert into public.training_assessment_answers(organization_id, assignment_id, question_key, answer_kind, answer_text, answer_boolean, answer_number, answer_option_keys,
  created_by, updated_by, created_at, updated_at)
select r.organization_id, r.id, a.key,
  case jsonb_typeof(a.value) when 'string' then 'text' when 'boolean' then 'boolean' when 'number' then 'number' else 'options' end,
  case when jsonb_typeof(a.value) = 'string' then a.value #>> '{}' end,
  case when jsonb_typeof(a.value) = 'boolean' then (a.value #>> '{}')::boolean end,
  case when jsonb_typeof(a.value) = 'number' then (a.value #>> '{}')::numeric end,
  case when jsonb_typeof(a.value) = 'array' then array(select x #>> '{}' from jsonb_array_elements(a.value) with ordinality s(x, n) order by s.n) end,
  r.created_by, r.updated_by, r.created_at, r.updated_at
from public.training_records r
cross join lateral jsonb_each(case when jsonb_typeof(r.payload->'assessmentAnswers') = 'object' then r.payload->'assessmentAnswers' else '{}'::jsonb end) a
where r.record_type = 'assignment' and jsonb_typeof(a.value) in ('string','boolean','number','array');

-- The trainer evaluations: one per assignment, from the programme's
-- feedbackResponses (identical to the assignment's feedbackScores/feedbackComment).
insert into public.training_feedback_responses(assignment_id, organization_id, program_id, employee_code, user_id, submitted_at, comment,
  created_by, updated_by, created_at, updated_at)
select distinct on (a.id) a.id, a.organization_id, a.program_id, nullif(f.value->>'employeeId', ''),
  case when f.value->>'userId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (f.value->>'userId')::uuid end,
  nullif(f.value->>'submittedAt', '')::timestamptz, f.value->>'comment', r.created_by, r.updated_by, r.created_at, r.updated_at
from public.training_records r
cross join lateral jsonb_array_elements(case when jsonb_typeof(r.payload->'feedbackResponses') = 'array' then r.payload->'feedbackResponses' else '[]'::jsonb end) with ordinality f(value, ord)
join public.training_assignments a on a.organization_id = r.organization_id and a.assignment_key = f.value->>'assignmentId'
where r.record_type = 'program'
order by a.id, f.ord desc;

insert into public.training_feedback_scores(organization_id, assignment_id, question_key, score, created_by, updated_by, created_at, updated_at)
select fr.organization_id, fr.assignment_id, s.key, round((s.value #>> '{}')::numeric)::smallint, fr.created_by, fr.updated_by, fr.created_at, fr.updated_at
from public.training_feedback_responses fr
join public.training_assignments a on a.id = fr.assignment_id
join public.training_records r on r.organization_id = a.organization_id and r.record_type = 'program' and r.id = a.program_id
cross join lateral (select f.value from jsonb_array_elements(r.payload->'feedbackResponses') with ordinality f(value, ord)
                    where f.value->>'assignmentId' = a.assignment_key order by f.ord desc limit 1) resp
cross join lateral jsonb_each(case when jsonb_typeof(resp.value->'scores') = 'object' then resp.value->'scores' else '{}'::jsonb end) s
where jsonb_typeof(s.value) = 'number';

insert into public.training_certificates(id, organization_id, certificate_key, assignment_id, employee_code, title, issued_date, valid_until, issuer,
  issued_at, issued_by, department_id, employee_user_id, created_by, updated_by, created_at, updated_at)
select r.id, r.organization_id, r.record_key, a.id, nullif(r.payload->>'employeeId', ''), nullif(r.payload->>'title', ''),
  nullif(r.payload->>'issuedDate', '')::date, nullif(r.payload->>'validUntil', '')::date, nullif(r.payload->>'issuer', ''),
  nullif(r.payload->>'issuedAt', '')::timestamptz,
  case when r.payload->>'issuedById' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (r.payload->>'issuedById')::uuid end,
  r.department_id, r.employee_user_id, r.created_by, r.updated_by, r.created_at, r.updated_at
from public.training_records r
join public.training_assignments a on a.organization_id = r.organization_id and a.assignment_key = r.payload->>'assignmentId'
where r.record_type = 'certificate';

insert into public.training_requirements(id, organization_id, requirement_key, title, renewal_months, active, created_by, updated_by, created_at, updated_at)
select r.id, r.organization_id, r.record_key, coalesce(r.payload->>'title', ''), round(nullif(r.payload->>'renewalMonths', '')::numeric)::integer,
  coalesce(nullif(r.payload->>'active', '')::boolean, true), r.created_by, r.updated_by, r.created_at, r.updated_at
from public.training_records r
where r.record_type = 'requirement';

insert into public.training_requirement_programs(requirement_id, program_id, organization_id, position, created_by, updated_by, created_at, updated_at)
select distinct on (r.id, p.id) r.id, p.id, r.organization_id, x.ord::integer, r.created_by, r.updated_by, r.created_at, r.updated_at
from public.training_records r
cross join lateral jsonb_array_elements_text(case when jsonb_typeof(r.payload->'programIds') = 'array' then r.payload->'programIds' else '[]'::jsonb end) with ordinality x(value, ord)
join public.training_programs p on p.organization_id = r.organization_id and p.program_key = x.value
where r.record_type = 'requirement'
order by r.id, p.id, x.ord;

insert into public.training_requirement_targets(organization_id, requirement_id, target_kind, value, position, created_by, updated_by, created_at, updated_at)
select distinct on (r.id, k.kind, btrim(x.value)) r.organization_id, r.id, k.kind, btrim(x.value), x.ord::integer, r.created_by, r.updated_by, r.created_at, r.updated_at
from public.training_records r
cross join (values ('profession', 'professions'), ('position', 'positions'), ('department', 'departments')) k(kind, field)
cross join lateral jsonb_array_elements_text(case when jsonb_typeof(r.payload->k.field) = 'array' then r.payload->k.field else '[]'::jsonb end) with ordinality x(value, ord)
where r.record_type = 'requirement' and btrim(x.value) <> ''
order by r.id, k.kind, btrim(x.value), x.ord;

insert into public.training_feedback_templates(id, organization_id, template_key, title_el, title_en, created_by, updated_by, created_at, updated_at)
select r.id, r.organization_id, r.record_key, nullif(r.payload->>'titleEl', ''), nullif(r.payload->>'titleEn', ''), r.created_by, r.updated_by,
  r.created_at, coalesce(nullif(r.payload->>'updatedAt', '')::timestamptz, r.updated_at)
from public.training_records r
where r.record_type = 'feedback_template';

insert into public.training_feedback_template_questions(organization_id, template_id, question_key, position, label_el, label_en, created_by, updated_by, created_at, updated_at)
select r.organization_id, r.id, coalesce(nullif(q.value->>'id', ''), 'feedback-' || q.ord), q.ord::integer,
  coalesce(q.value->>'labelEl', q.value->>'label', ''), nullif(q.value->>'labelEn', ''), r.created_by, r.updated_by, r.created_at, r.updated_at
from public.training_records r
cross join lateral jsonb_array_elements(case when jsonb_typeof(r.payload->'questions') = 'array' then r.payload->'questions' else '[]'::jsonb end) with ordinality q(value, ord)
where r.record_type = 'feedback_template';

insert into public.training_history_events(organization_id, position, occurred_at, actor, action, created_by, updated_by, created_at, updated_at)
select r.organization_id, h.ord::integer, nullif(h.value->>'at', '')::timestamptz, nullif(h.value->>'actor', ''), nullif(h.value->>'action', ''),
  r.created_by, r.updated_by, r.created_at, r.updated_at
from public.training_records r
cross join lateral jsonb_array_elements(case when jsonb_typeof(r.payload->'items') = 'array' then r.payload->'items' else '[]'::jsonb end) with ordinality h(value, ord)
where r.record_type = 'history_snapshot';

-- 3. Verify the copy -------------------------------------------------------------
-- Counts per table against the source, then the values that screens and
-- indicators read. Any difference aborts the migration.
do $verify$
declare
  v_problems text[] := array[]::text[];
  v_expected bigint;
  v_actual bigint;
  v_check record;
begin
  for v_check in
    select * from (values
      ('programs', (select count(*) from public.training_records where record_type = 'program'), (select count(*) from public.training_programs)),
      ('materials', (select coalesce(sum(jsonb_array_length(payload->'materials')), 0) from public.training_records where record_type = 'program' and jsonb_typeof(payload->'materials') = 'array'), (select count(*) from public.training_program_materials)),
      ('questions', (select coalesce(sum(jsonb_array_length(payload->'assessmentQuestions')), 0) from public.training_records where record_type = 'program' and jsonb_typeof(payload->'assessmentQuestions') = 'array'), (select count(*) from public.training_assessment_questions)),
      ('options', (select count(*) from public.training_records r, jsonb_array_elements(r.payload->'assessmentQuestions') q, jsonb_array_elements(q->'options') o where r.record_type = 'program' and jsonb_typeof(r.payload->'assessmentQuestions') = 'array' and jsonb_typeof(q->'options') = 'array'), (select count(*) from public.training_assessment_options)),
      ('effectiveness', (select count(*) from public.training_records where record_type = 'program' and jsonb_typeof(payload->'effectiveness') = 'object'), (select count(*) from public.training_program_effectiveness)),
      ('program feedback questions', (select coalesce(sum(jsonb_array_length(payload->'trainerFeedbackTemplate'->'questions')), 0) from public.training_records where record_type = 'program' and jsonb_typeof(payload->'trainerFeedbackTemplate'->'questions') = 'array'), (select count(*) from public.training_program_feedback_questions)),
      ('assignments', (select count(*) from public.training_records where record_type = 'assignment'), (select count(*) from public.training_assignments)),
      ('answers', (select count(*) from public.training_records r, jsonb_each(r.payload->'assessmentAnswers') a where r.record_type = 'assignment' and jsonb_typeof(r.payload->'assessmentAnswers') = 'object' and jsonb_typeof(a.value) <> 'null'), (select count(*) from public.training_assessment_answers)),
      ('feedback responses', (select count(*) from public.training_records r, jsonb_array_elements(r.payload->'feedbackResponses') f where r.record_type = 'program' and jsonb_typeof(r.payload->'feedbackResponses') = 'array'), (select count(*) from public.training_feedback_responses)),
      ('feedback scores', (select count(*) from public.training_records r, jsonb_array_elements(r.payload->'feedbackResponses') f, jsonb_each(f->'scores') s where r.record_type = 'program' and jsonb_typeof(r.payload->'feedbackResponses') = 'array' and jsonb_typeof(f->'scores') = 'object'), (select count(*) from public.training_feedback_scores)),
      ('certificates', (select count(*) from public.training_records where record_type = 'certificate'), (select count(*) from public.training_certificates)),
      ('requirements', (select count(*) from public.training_records where record_type = 'requirement'), (select count(*) from public.training_requirements)),
      ('requirement programs', (select count(*) from public.training_records r, jsonb_array_elements(r.payload->'programIds') x where r.record_type = 'requirement' and jsonb_typeof(r.payload->'programIds') = 'array'), (select count(*) from public.training_requirement_programs)),
      ('requirement targets', (select count(*) from public.training_records r, jsonb_array_elements_text(coalesce(r.payload->'professions', '[]') || coalesce(r.payload->'positions', '[]') || coalesce(r.payload->'departments', '[]')) x where r.record_type = 'requirement' and btrim(x) <> ''), (select count(*) from public.training_requirement_targets)),
      ('feedback templates', (select count(*) from public.training_records where record_type = 'feedback_template'), (select count(*) from public.training_feedback_templates)),
      ('feedback template questions', (select coalesce(sum(jsonb_array_length(payload->'questions')), 0) from public.training_records where record_type = 'feedback_template' and jsonb_typeof(payload->'questions') = 'array'), (select count(*) from public.training_feedback_template_questions)),
      ('history events', (select coalesce(sum(jsonb_array_length(payload->'items')), 0) from public.training_records where record_type = 'history_snapshot' and jsonb_typeof(payload->'items') = 'array'), (select count(*) from public.training_history_events)),
      ('record types', (select count(*) from public.training_records where record_type not in ('program','assignment','certificate','requirement','history_snapshot','feedback_template')), 0::bigint)
    ) c(label, expected, actual)
  loop
    if v_check.expected is distinct from v_check.actual then
      v_problems := v_problems || format('%s: %s in training_records, %s copied', v_check.label, v_check.expected, v_check.actual);
    end if;
  end loop;

  -- Values: every assignment against its payload.
  v_actual := (select count(*) from public.training_records r join public.training_assignments a on a.id = r.id join public.training_programs p on p.id = a.program_id
    left join public.training_certificates c on c.assignment_id = a.id
    where r.record_type = 'assignment' and (
      p.program_key is distinct from r.payload->>'programId'
      or a.status is distinct from coalesce(nullif(r.payload->>'status', ''), 'assigned')
      or a.score is distinct from round(nullif(r.payload->>'score', '')::numeric)::integer
      or a.competent is distinct from nullif(r.payload->>'competent', '')::boolean
      or a.completed_date is distinct from nullif(r.payload->>'completedDate', '')::date
      or a.assigned_date is distinct from nullif(r.payload->>'assignedDate', '')::date
      or a.due_date is distinct from nullif(r.payload->>'dueDate', '')::date
      or a.employee_code is distinct from nullif(r.payload->>'employeeId', '')
      or a.department_id is distinct from r.department_id
      or a.employee_user_id is distinct from r.employee_user_id
      or a.access_token is distinct from nullif(r.payload->>'accessToken', '')
      or a.feedback_submitted_at is distinct from nullif(r.payload->>'feedbackSubmittedAt', '')::timestamptz
      or c.certificate_key is distinct from nullif(r.payload->>'certificateId', '')));
  if v_actual > 0 then v_problems := v_problems || format('assignments: %s differ from their payload', v_actual); end if;

  -- The trainer evaluation of each assignment equals its feedbackScores/feedbackComment.
  v_actual := (select count(*) from public.training_records r join public.training_assignments a on a.id = r.id
    left join public.training_feedback_responses fr on fr.assignment_id = a.id
    where r.record_type = 'assignment' and (
      (jsonb_typeof(r.payload->'feedbackScores') = 'object') <> (fr.assignment_id is not null)
      or (fr.assignment_id is not null and (
        coalesce(fr.comment, '') is distinct from coalesce(r.payload->>'feedbackComment', '')
        or r.payload->'feedbackScores' is distinct from (select coalesce(jsonb_object_agg(s.question_key, s.score), '{}'::jsonb) from public.training_feedback_scores s where s.assignment_id = a.id)))));
  if v_actual > 0 then v_problems := v_problems || format('trainer evaluations: %s differ from the assignment', v_actual); end if;

  -- Answers rebuilt from the columns equal the stored answers.
  v_actual := (select count(*) from public.training_records r join public.training_assignments a on a.id = r.id
    where r.record_type = 'assignment' and jsonb_typeof(r.payload->'assessmentAnswers') = 'object'
      and (select jsonb_object_agg(k, v) from jsonb_each(r.payload->'assessmentAnswers') e(k, v) where jsonb_typeof(v) <> 'null')
        is distinct from (select jsonb_object_agg(x.question_key, case x.answer_kind when 'text' then to_jsonb(x.answer_text) when 'boolean' then to_jsonb(x.answer_boolean)
          when 'number' then to_jsonb(x.answer_number) else to_jsonb(x.answer_option_keys) end) from public.training_assessment_answers x where x.assignment_id = a.id));
  if v_actual > 0 then v_problems := v_problems || format('answers: %s assignments differ', v_actual); end if;

  -- Programmes: the scalar fields, the question order and the correct options.
  v_actual := (select count(*) from public.training_records r join public.training_programs p on p.id = r.id
    where r.record_type = 'program' and (
      p.title is distinct from coalesce(r.payload->>'title', '')
      or p.status is distinct from coalesce(nullif(r.payload->>'status', ''), 'planned')
      or p.pass_score is distinct from round(nullif(r.payload->>'passScore', '')::numeric)::integer
      or p.valid_months is distinct from round(nullif(r.payload->>'validMonths', '')::numeric)::integer
      or p.requires_assessment is distinct from coalesce(nullif(r.payload->>'requiresAssessment', '')::boolean, false)
      or (select coalesce(jsonb_agg(q->>'id' order by n), '[]'::jsonb) from jsonb_array_elements(case when jsonb_typeof(r.payload->'assessmentQuestions') = 'array' then r.payload->'assessmentQuestions' else '[]'::jsonb end) with ordinality s(q, n))
        is distinct from (select coalesce(jsonb_agg(tq.question_key order by tq.position), '[]'::jsonb) from public.training_assessment_questions tq where tq.program_id = p.id)
      or (select count(*) from jsonb_array_elements(case when jsonb_typeof(r.payload->'assessmentQuestions') = 'array' then r.payload->'assessmentQuestions' else '[]'::jsonb end) q, jsonb_array_elements(case when jsonb_typeof(q->'options') = 'array' then q->'options' else '[]'::jsonb end) o where (o->>'correct')::boolean)
        is distinct from (select count(*) from public.training_assessment_options o join public.training_assessment_questions tq on tq.id = o.question_id where tq.program_id = p.id and o.correct)
      or (jsonb_typeof(r.payload->'effectiveness') = 'object' and not exists (select 1 from public.training_program_effectiveness e where e.program_id = p.id
            and e.result is not distinct from nullif(r.payload->'effectiveness'->>'result', '') and e.planned_date is not distinct from nullif(r.payload->'effectiveness'->>'plannedDate', '')::date))));
  if v_actual > 0 then v_problems := v_problems || format('programmes: %s differ from their payload', v_actual); end if;

  if cardinality(v_problems) > 0 then
    raise exception 'TRAINING_RELATIONAL_COPY_MISMATCH: %', array_to_string(v_problems, '; ');
  end if;
end;
$verify$;

-- 4. Triggers ---------------------------------------------------------------------
-- Created after the copy so the copied created/updated stamps are kept.

do $triggers$
declare v_table text;
begin
  foreach v_table in array array['training_programs','training_program_materials','training_assessment_questions','training_assessment_options',
    'training_program_effectiveness','training_program_feedback_questions','training_assignments','training_assessment_answers',
    'training_feedback_responses','training_feedback_scores','training_certificates','training_requirements','training_requirement_programs',
    'training_requirement_targets','training_feedback_templates','training_feedback_template_questions','training_history_events']
  loop
    execute format('create trigger trg_%s_audit before insert or update on public.%I for each row execute function public.set_repository_audit_fields()', v_table, v_table);
  end loop;
end;
$triggers$;

-- An assignment names its employee by code (employee_code). Link it to the
-- employee row, take the department when none is set, and the employee's
-- account when exactly one active member of the organization has that e-mail
-- (same rule as the old project_training_assignment_identity).
create or replace function private.training_assignment_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_employee_id uuid;
  v_department_id uuid;
  v_email text;
  v_user_id uuid;
  v_count integer;
begin
  if nullif(btrim(coalesce(new.employee_code, '')), '') is null then return new; end if;
  select e.id, e.department_id, nullif(lower(btrim(e.email)), '') into v_employee_id, v_department_id, v_email
  from public.employees e
  where e.organization_id = new.organization_id and e.employee_code = new.employee_code
  limit 1;
  if v_employee_id is null then return new; end if;
  new.employee_id := v_employee_id;
  new.department_id := coalesce(new.department_id, v_department_id);
  if new.employee_user_id is null and v_email is not null then
    select count(distinct om.user_id), (array_agg(distinct om.user_id))[1] into v_count, v_user_id
    from public.organization_members om
    left join public.profiles p on p.id = om.user_id
    left join auth.users u on u.id = om.user_id
    where om.organization_id = new.organization_id and om.status = 'active'
      and lower(btrim(coalesce(nullif(p.contact_email, ''), u.email, ''))) = v_email;
    if v_count = 1 then new.employee_user_id := v_user_id; end if;
  end if;
  return new;
end;
$function$;
revoke all on function private.training_assignment_identity() from public, anon, authenticated;

create trigger trg_training_assignments_identity
before insert or update of organization_id, employee_code, department_id, employee_user_id on public.training_assignments
for each row execute function private.training_assignment_identity();

-- What the learner submits through the e-mailed link (and what follows from
-- it) is never overwritten by a manager's save: for the signed-in API role the
-- learner-owned columns keep their stored value, and a started or completed
-- assignment keeps its status. The token RPCs and the review RPC run as their
-- owner (SECURITY DEFINER), so they still write them. SECURITY INVOKER on
-- purpose: current_user must be the caller's role.
create or replace function private.training_assignment_keep_learner_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if current_user <> 'authenticated' then return new; end if;
  new.access_token := old.access_token;
  new.invitation_sent_at := old.invitation_sent_at;
  new.attendance_response := old.attendance_response;
  new.attendance := old.attendance;
  new.attendance_confirmed_at := old.attendance_confirmed_at;
  new.attendance_attested := old.attendance_attested;
  new.attendance_attested_at := old.attendance_attested_at;
  new.attendance_attestation_method := old.attendance_attestation_method;
  new.attendance_attestation_version := old.attendance_attestation_version;
  new.completion_confirmed_at := old.completion_confirmed_at;
  new.feedback_submitted_at := old.feedback_submitted_at;
  new.assessment_submitted_at := old.assessment_submitted_at;
  new.assessment_review_status := old.assessment_review_status;
  new.score := old.score;
  new.competent := old.competent;
  new.completed_date := old.completed_date;
  if old.status in ('completed','in_progress') then new.status := old.status; end if;
  return new;
end;
$function$;
revoke all on function private.training_assignment_keep_learner_fields() from public, anon, authenticated;

create trigger trg_training_assignments_learner_fields
before update on public.training_assignments
for each row execute function private.training_assignment_keep_learner_fields();

-- 5. Row level security and grants -------------------------------------------------

do $rls$
declare v_table text;
begin
  foreach v_table in array array['training_programs','training_program_materials','training_assessment_questions','training_assessment_options',
    'training_program_effectiveness','training_program_feedback_questions','training_assignments','training_assessment_answers',
    'training_feedback_responses','training_feedback_scores','training_certificates','training_requirements','training_requirement_programs',
    'training_requirement_targets','training_feedback_templates','training_feedback_template_questions','training_history_events']
  loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('revoke all on table public.%I from public, anon, authenticated', v_table);
    execute format('grant all on table public.%I to service_role', v_table);
    execute format('grant select on table public.%I to authenticated', v_table);
  end loop;
  -- What managers edit (through the SECURITY INVOKER RPCs). Answers, trainer
  -- evaluations, certificates, templates and history are written only by the
  -- SECURITY DEFINER RPCs and the Demo seed.
  foreach v_table in array array['training_programs','training_program_materials','training_assessment_questions','training_assessment_options',
    'training_program_effectiveness','training_program_feedback_questions','training_assignments','training_requirements',
    'training_requirement_programs','training_requirement_targets']
  loop
    execute format('grant insert, update, delete on table public.%I to authenticated', v_table);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.current_user_has_capability(organization_id, ''manage_training''))', v_table || '_insert', v_table);
    execute format('create policy %I on public.%I for update to authenticated using (public.current_user_has_capability(organization_id, ''manage_training'')) with check (public.current_user_has_capability(organization_id, ''manage_training''))', v_table || '_update', v_table);
    execute format('create policy %I on public.%I for delete to authenticated using (public.current_user_has_capability(organization_id, ''manage_training''))', v_table || '_delete', v_table);
  end loop;
end;
$rls$;

-- Programmes and requirements: every member of the organization.
create policy training_programs_read on public.training_programs for select to authenticated
  using (public.is_org_member(organization_id) or public.current_user_has_capability(organization_id, 'manage_training'));
create policy training_requirements_read on public.training_requirements for select to authenticated
  using (public.is_org_member(organization_id) or public.current_user_has_capability(organization_id, 'manage_training'));

-- Assignments and certificates: the admin roles, the department scope, the
-- employee themself, manage_training (as training_records_read).
create policy training_assignments_read on public.training_assignments for select to authenticated
  using (
    public.current_user_has_org_role(organization_id, array['hospital_admin','infection_control_lead','infection_control_member','hr_office']::public.app_role[])
    or (department_id is not null and public.current_user_has_org_role(organization_id, array['department_manager','department_user']::public.app_role[])
        and public.current_user_has_department_scope(organization_id, department_id))
    or employee_user_id = (select auth.uid())
    or public.current_user_has_capability(organization_id, 'manage_training')
  );
create policy training_certificates_read on public.training_certificates for select to authenticated
  using (
    public.current_user_has_org_role(organization_id, array['hospital_admin','infection_control_lead','infection_control_member','hr_office']::public.app_role[])
    or (department_id is not null and public.current_user_has_org_role(organization_id, array['department_manager','department_user']::public.app_role[])
        and public.current_user_has_department_scope(organization_id, department_id))
    or employee_user_id = (select auth.uid())
    or public.current_user_has_capability(organization_id, 'manage_training')
    or exists (select 1 from public.training_assignments a where a.id = assignment_id)
  );

-- Templates and history: the admin roles and manage_training.
create policy training_feedback_templates_read on public.training_feedback_templates for select to authenticated
  using (public.current_user_has_org_role(organization_id, array['hospital_admin','infection_control_lead','infection_control_member','hr_office']::public.app_role[])
    or public.current_user_has_capability(organization_id, 'manage_training'));
create policy training_history_events_read on public.training_history_events for select to authenticated
  using (public.current_user_has_org_role(organization_id, array['hospital_admin','infection_control_lead','infection_control_member','hr_office']::public.app_role[])
    or public.current_user_has_capability(organization_id, 'manage_training'));

-- Children follow their parent (the parent's own policy applies inside exists).
create policy training_program_materials_read on public.training_program_materials for select to authenticated
  using (exists (select 1 from public.training_programs p where p.id = program_id));
create policy training_assessment_questions_read on public.training_assessment_questions for select to authenticated
  using (exists (select 1 from public.training_programs p where p.id = program_id));
create policy training_assessment_options_read on public.training_assessment_options for select to authenticated
  using (exists (select 1 from public.training_assessment_questions q where q.id = question_id));
create policy training_program_effectiveness_read on public.training_program_effectiveness for select to authenticated
  using (exists (select 1 from public.training_programs p where p.id = program_id));
create policy training_program_feedback_questions_read on public.training_program_feedback_questions for select to authenticated
  using (exists (select 1 from public.training_programs p where p.id = program_id));
create policy training_assessment_answers_read on public.training_assessment_answers for select to authenticated
  using (exists (select 1 from public.training_assignments a where a.id = assignment_id));
create policy training_feedback_responses_read on public.training_feedback_responses for select to authenticated
  using (exists (select 1 from public.training_assignments a where a.id = assignment_id));
create policy training_feedback_scores_read on public.training_feedback_scores for select to authenticated
  using (exists (select 1 from public.training_assignments a where a.id = assignment_id));
create policy training_requirement_programs_read on public.training_requirement_programs for select to authenticated
  using (exists (select 1 from public.training_requirements r where r.id = requirement_id));
create policy training_requirement_targets_read on public.training_requirement_targets for select to authenticated
  using (exists (select 1 from public.training_requirements r where r.id = requirement_id));
create policy training_feedback_template_questions_read on public.training_feedback_template_questions for select to authenticated
  using (exists (select 1 from public.training_feedback_templates t where t.id = template_id));

-- 6. Helpers: the app's programme / assignment objects built from the columns --
-- Used by the token RPCs, which return the same JSON shapes as before.

create or replace function private.training_answers_json(p_assignment_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $function$
  select jsonb_object_agg(x.question_key, case x.answer_kind
      when 'text' then to_jsonb(x.answer_text)
      when 'boolean' then to_jsonb(x.answer_boolean)
      when 'number' then to_jsonb(x.answer_number)
      else to_jsonb(coalesce(x.answer_option_keys, array[]::text[])) end order by x.question_key)
  from public.training_assessment_answers x
  where x.assignment_id = p_assignment_id;
$function$;

-- p_public: for the learner's link (no correct answers, no model answers,
-- no collected evaluations).
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

create or replace function private.training_assignment_json(p_assignment_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $function$
  select jsonb_build_object(
      'id', a.assignment_key, 'dbId', a.id, 'programId', p.program_key, 'employeeId', coalesce(a.employee_code, ''), 'employeeDbId', a.employee_id,
      'employeeName', coalesce(a.employee_name, ''), 'department', coalesce(a.department_name, ''), 'departmentId', a.department_id,
      'userId', a.employee_user_id, 'email', coalesce(a.email, ''), 'accountLinked', a.account_linked, 'manualEntry', a.manual_entry,
      'assignedDate', a.assigned_date, 'dueDate', a.due_date, 'status', a.status, 'invitationSentAt', a.invitation_sent_at, 'accessToken', a.access_token,
      'attendanceResponse', a.attendance_response, 'attendance', a.attendance, 'attendanceConfirmedAt', a.attendance_confirmed_at,
      'attendanceAttested', a.attendance_attested, 'attendanceAttestedAt', a.attendance_attested_at)
    || jsonb_build_object(
      'attendanceAttestationMethod', a.attendance_attestation_method, 'attendanceAttestationVersion', a.attendance_attestation_version,
      'completionConfirmedAt', a.completion_confirmed_at, 'feedbackSubmittedAt', a.feedback_submitted_at, 'assessmentSubmittedAt', a.assessment_submitted_at,
      'assessmentAnswers', coalesce(private.training_answers_json(a.id), case when a.feedback_submitted_at is null then null else '{}'::jsonb end),
      'assessmentReviewStatus', a.assessment_review_status, 'assessmentReviewedAt', a.assessment_reviewed_at, 'assessmentReviewedBy', a.assessment_reviewed_by,
      'assessmentReviewAcknowledged', a.assessment_review_acknowledged, 'assessmentReviewNote', a.assessment_review_note,
      'score', a.score, 'competent', a.competent, 'completedDate', a.completed_date,
      'certificateId', (select c.certificate_key from public.training_certificates c where c.assignment_id = a.id),
      'feedbackScores', case when fr.assignment_id is null then null else coalesce((select jsonb_object_agg(s.question_key, s.score) from public.training_feedback_scores s where s.assignment_id = a.id), '{}'::jsonb) end,
      'feedbackComment', fr.comment, 'createdAt', a.created_at, 'updatedAt', a.updated_at)
  from public.training_assignments a
  join public.training_programs p on p.id = a.program_id
  left join public.training_feedback_responses fr on fr.assignment_id = a.id
  where a.id = p_assignment_id;
$function$;

-- Whether a stored answer is correct, by the rules of the old scoring:
-- single choice = the first correct option; multiple choice = exactly the
-- correct options; true/false = the correct value (unset counts as false).
create or replace function private.training_answer_correct(p_question_id uuid, p_assignment_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $function$
  select coalesce(case q.question_type
    when 'single_choice' then
      (select o.option_key from public.training_assessment_options o where o.question_id = q.id and o.correct order by o.position, o.option_key limit 1)
        = case a.answer_kind when 'text' then a.answer_text when 'number' then a.answer_number::text when 'boolean' then a.answer_boolean::text end
    when 'multiple_choice' then
      a.answer_kind = 'options'
      and (select count(*) from public.training_assessment_options o where o.question_id = q.id and o.correct) = coalesce(cardinality(a.answer_option_keys), 0)
      and (select count(*) from unnest(a.answer_option_keys) s(k) join public.training_assessment_options o on o.question_id = q.id and o.correct and o.option_key = s.k)
        = (select count(*) from public.training_assessment_options o where o.question_id = q.id and o.correct)
    when 'true_false' then
      a.question_key is not null and ((case a.answer_kind when 'boolean' then a.answer_boolean when 'number' then a.answer_number <> 0
        when 'text' then case lower(btrim(a.answer_text)) when 'true' then true when 'false' then false end end) is not distinct from coalesce(q.correct_boolean, false))
    end, false)
  from public.training_assessment_questions q
  left join public.training_assessment_answers a on a.assignment_id = p_assignment_id and a.question_key = q.question_key
  where q.id = p_question_id;
$function$;

-- The certificate of a passed assignment ('CERT-' || assignment key), valid
-- for the programme's validity in months. Returns its key.
create or replace function private.training_issue_certificate(p_assignment_id uuid, p_at timestamptz)
returns text
language plpgsql
set search_path = ''
as $function$
declare v_key text;
begin
  insert into public.training_certificates(organization_id, certificate_key, assignment_id, employee_code, title, issued_date, valid_until, issuer,
    issued_at, issued_by, department_id, employee_user_id, created_by, updated_by)
  select a.organization_id, 'CERT-' || a.assignment_key, a.id, a.employee_code, p.title, p_at::date,
    case when p.valid_months is null then null else (p_at::date + make_interval(months => p.valid_months))::date end,
    'Limoxis Observer', p_at, auth.uid(), a.department_id, a.employee_user_id, coalesce(auth.uid(), a.created_by), coalesce(auth.uid(), a.updated_by)
  from public.training_assignments a
  join public.training_programs p on p.id = a.program_id
  where a.id = p_assignment_id
  on conflict do nothing;
  v_key := (select c.certificate_key from public.training_certificates c where c.assignment_id = p_assignment_id);
  return v_key;
end;
$function$;

revoke all on function private.training_answers_json(uuid) from public, anon, authenticated;
revoke all on function private.training_program_json(uuid, boolean) from public, anon, authenticated;
revoke all on function private.training_assignment_json(uuid) from public, anon, authenticated;
revoke all on function private.training_answer_correct(uuid, uuid) from public, anon, authenticated;
revoke all on function private.training_issue_certificate(uuid, timestamptz) from public, anon, authenticated;

-- 7. The learner's e-mailed link (same names, arguments, grants and JSON) ---------

create or replace function public.training_email_access(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','auth','pg_temp'
as $function$
declare
 v_assignment public.training_assignments%rowtype;
begin
 if nullif(btrim(coalesce(p_token,'')),'') is null then raise exception 'TRAINING_ACCESS_NOT_AVAILABLE'; end if;
 select * into v_assignment from public.training_assignments a where a.access_token=p_token limit 1;
 if not found then raise exception 'TRAINING_ACCESS_NOT_AVAILABLE'; end if;
 if not exists (select 1 from public.training_programs p where p.id=v_assignment.program_id) then raise exception 'TRAINING_PROGRAM_NOT_FOUND'; end if;
 return jsonb_build_object('program',private.training_program_json(v_assignment.program_id,true),'assignment',(private.training_assignment_json(v_assignment.id)-'accessToken')||jsonb_build_object('externalAccess',true,'tokenOnlyAccess',true));
end;$function$;

create or replace function public.training_submit_evaluation(p_token text, p_answers jsonb default '{}'::jsonb, p_feedback_scores jsonb default '{}'::jsonb, p_feedback_comment text default null::text, p_attendance_attested boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'public','auth','pg_temp'
as $function$
declare
 v_assignment public.training_assignments%rowtype;
 v_program public.training_programs%rowtype;
 v_question public.training_assessment_questions%rowtype;
 v_now timestamptz:=now();
 v_answers jsonb:=case when jsonb_typeof(p_answers)='object' then p_answers else '{}'::jsonb end;
 v_scores jsonb:=case when jsonb_typeof(p_feedback_scores)='object' then p_feedback_scores else '{}'::jsonb end;
 v_comment text:=nullif(btrim(coalesce(p_feedback_comment,'')),'');
 v_answer jsonb;
 v_correct boolean;
 v_total numeric:=0;
 v_earned numeric:=0;
 v_score integer:=null;
 v_competent boolean:=true;
 v_manual_review boolean:=false;
 v_certificate_key text;
begin
 if nullif(btrim(coalesce(p_token,'')),'') is null then raise exception 'TRAINING_ACCESS_NOT_AVAILABLE'; end if;
 select * into v_assignment from public.training_assignments a where a.access_token=p_token limit 1 for update;
 if not found then raise exception 'TRAINING_ACCESS_NOT_AVAILABLE'; end if;
 if v_assignment.feedback_submitted_at is not null then raise exception 'TRAINING_ALREADY_SUBMITTED'; end if;
 if not coalesce(p_attendance_attested,false) then raise exception 'TRAINING_ATTENDANCE_ATTESTATION_REQUIRED'; end if;
 select * into v_program from public.training_programs p where p.id=v_assignment.program_id;
 if not found then raise exception 'TRAINING_PROGRAM_NOT_FOUND'; end if;
 if exists (select 1 from jsonb_each(v_scores) e where not case when jsonb_typeof(e.value)='number' then (e.value#>>'{}')::numeric between 1 and 5 else false end) then raise exception 'TRAINING_FEEDBACK_SCORE_INVALID'; end if;

 -- The answers as given, one row per question.
 delete from public.training_assessment_answers x where x.assignment_id=v_assignment.id;
 insert into public.training_assessment_answers(organization_id,assignment_id,question_key,answer_kind,answer_text,answer_boolean,answer_number,answer_option_keys)
 select v_assignment.organization_id,v_assignment.id,e.key,
  case jsonb_typeof(e.value) when 'string' then 'text' when 'boolean' then 'boolean' when 'number' then 'number' else 'options' end,
  case when jsonb_typeof(e.value)='string' then e.value#>>'{}' end,
  case when jsonb_typeof(e.value)='boolean' then (e.value#>>'{}')::boolean end,
  case when jsonb_typeof(e.value)='number' then (e.value#>>'{}')::numeric end,
  case when jsonb_typeof(e.value)='array' then array(select x#>>'{}' from jsonb_array_elements(e.value) with ordinality s(x,n) order by s.n) end
 from jsonb_each(v_answers) e where jsonb_typeof(e.value) in ('string','boolean','number','array');

 if v_program.requires_assessment then
  if not exists (select 1 from public.training_assessment_questions q where q.program_id=v_program.id) then raise exception 'TRAINING_ASSESSMENT_NOT_CONFIGURED'; end if;
  for v_question in select * from public.training_assessment_questions q where q.program_id=v_program.id order by q.position,q.question_key loop
   v_answer:=v_answers->v_question.question_key;
   if v_question.required and (v_answer is null or v_answer='null'::jsonb or (jsonb_typeof(v_answer)='string' and btrim(v_answer#>>'{}')='')) then raise exception 'TRAINING_ASSESSMENT_INCOMPLETE'; end if;
   if v_question.question_type='free_text' then if v_question.manual_review then v_manual_review:=true; end if; continue; end if;
   v_total:=v_total+v_question.points;
   v_correct:=private.training_answer_correct(v_question.id,v_assignment.id);
   update public.training_assessment_answers x set awarded_points=case when v_correct then v_question.points else 0 end where x.assignment_id=v_assignment.id and x.question_key=v_question.question_key;
   if v_correct then v_earned:=v_earned+v_question.points; end if;
  end loop;
  v_score:=case when v_total>0 then round(v_earned/v_total*100)::integer else null end;
  v_competent:=case when v_score is null then true else v_score>=coalesce(v_program.pass_score,0) end;
 end if;

 update public.training_assignments a set attendance=true,attendance_response='confirmed',attendance_confirmed_at=coalesce(a.attendance_confirmed_at,v_now),
  attendance_attested=true,attendance_attested_at=v_now,attendance_attestation_method='personal_email_token',attendance_attestation_version='1.0',
  feedback_submitted_at=v_now,assessment_submitted_at=case when v_program.requires_assessment then v_now else null end,
  assessment_review_status=case when v_manual_review then 'pending' else 'not_required' end,
  completion_confirmed_at=case when v_manual_review then null else v_now end,status=case when v_manual_review then 'in_progress' else 'completed' end,
  completed_date=case when v_manual_review then null else v_now::date end,score=v_score,competent=case when v_manual_review then null else v_competent end
 where a.id=v_assignment.id
 returning * into v_assignment;

 -- The trainer evaluation (the programme's feedbackResponses come from these rows).
 insert into public.training_feedback_responses(assignment_id,organization_id,program_id,employee_code,user_id,submitted_at,comment,created_by,updated_by)
 values(v_assignment.id,v_assignment.organization_id,v_program.id,v_assignment.employee_code,auth.uid(),v_now,v_comment,coalesce(auth.uid(),v_assignment.created_by),coalesce(auth.uid(),v_assignment.updated_by))
 on conflict (assignment_id) do update set program_id=excluded.program_id,employee_code=excluded.employee_code,user_id=excluded.user_id,submitted_at=excluded.submitted_at,comment=excluded.comment;
 delete from public.training_feedback_scores s where s.assignment_id=v_assignment.id;
 insert into public.training_feedback_scores(organization_id,assignment_id,question_key,score)
 select v_assignment.organization_id,v_assignment.id,e.key,round((e.value#>>'{}')::numeric)::smallint from jsonb_each(v_scores) e;

 v_certificate_key:=case when v_competent and not v_manual_review then private.training_issue_certificate(v_assignment.id,v_now) else null end;
 return jsonb_build_object('assignmentId',v_assignment.assignment_key,'programId',v_program.program_key,'score',v_score,'competent',case when v_manual_review then null else v_competent end,'manualReviewRequired',v_manual_review,'certificateId',v_certificate_key,'attendanceConfirmedAt',v_assignment.attendance_confirmed_at,'completedAt',v_assignment.completion_confirmed_at,'submittedAt',v_now);
end;$function$;

create or replace function public.queue_training_invitation(p_assignment_key text,p_language text default 'el')
returns jsonb
language plpgsql
security definer
set search_path to 'public','auth','pg_temp'
as $function$
declare
  v_assignment public.training_assignments%rowtype;
  v_program public.training_programs%rowtype;
  v_email text;
  v_token text;
  v_now timestamptz:=now();
  v_outbox_id uuid;
  v_question_count integer:=0;
  v_subject text;
  v_outbox_payload jsonb;
begin
  if auth.uid() is null then raise exception 'TRAINING_AUTH_REQUIRED'; end if;
  select * into v_assignment from public.training_assignments a where a.assignment_key=p_assignment_key and is_org_member(a.organization_id) limit 1;
  if not found then raise exception 'TRAINING_ASSIGNMENT_NOT_FOUND'; end if;
  if not (current_user_has_capability(v_assignment.organization_id,'manage_training') or current_user_has_org_role(v_assignment.organization_id,array['platform_owner','hospital_admin','infection_control_lead','quality_manager']::app_role[])) then raise exception 'TRAINING_MANAGE_REQUIRED'; end if;
  if v_assignment.feedback_submitted_at is not null then raise exception 'TRAINING_ALREADY_SUBMITTED'; end if;
  select * into v_program from public.training_programs p where p.id=v_assignment.program_id;
  if not found then raise exception 'TRAINING_PROGRAM_NOT_FOUND'; end if;
  v_email:=nullif(btrim(coalesce(v_assignment.email,'')),'');
  if v_email is null then raise exception 'TRAINING_PARTICIPANT_EMAIL_REQUIRED'; end if;
  v_token:=coalesce(nullif(v_assignment.access_token,''),'TRN-ACCESS-'||replace(gen_random_uuid()::text,'-',''));
  v_question_count:=(select count(*) from public.training_assessment_questions q where q.program_id=v_program.id);
  update public.training_assignments a set access_token=v_token,invitation_sent_at=v_now,attendance_response=case when a.attendance_response='confirmed' then 'confirmed' else 'sent' end where a.id=v_assignment.id;
  v_subject:=case when lower(coalesce(p_language,'el'))='en' then 'Training confirmation & evaluation: '||coalesce(v_program.title,'') else 'Επιβεβαίωση συμμετοχής & αξιολόγηση: '||coalesce(v_program.title,'') end;
  v_outbox_payload:=jsonb_build_object('path','/training-access/'||v_token,'programTitle',v_program.title,'employeeName',v_assignment.employee_name,'dueDate',v_assignment.due_date,'requiresAssessment',v_program.requires_assessment,'questionCount',v_question_count,'externalAccess',true,'language',case when lower(coalesce(p_language,'el'))='en' then 'en' else 'el' end);
  select id into v_outbox_id from public.notification_outbox where notification_type='training_invitation' and entity_type='training_assignment' and entity_id=v_assignment.id order by created_at desc limit 1;
  if v_outbox_id is null then
    insert into public.notification_outbox(organization_id,recipient_user_id,recipient_email,notification_type,entity_type,entity_id,subject,payload,status,attempts,available_at) values(v_assignment.organization_id,v_assignment.employee_user_id,v_email,'training_invitation','training_assignment',v_assignment.id,v_subject,v_outbox_payload,'pending',0,v_now) returning id into v_outbox_id;
  else
    update public.notification_outbox set organization_id=v_assignment.organization_id,recipient_user_id=v_assignment.employee_user_id,recipient_email=v_email,subject=v_subject,payload=v_outbox_payload,status='pending',attempts=0,available_at=v_now,sent_at=null,last_error=null,updated_at=v_now where id=v_outbox_id;
  end if;
  return jsonb_build_object('assignmentId',v_assignment.assignment_key,'outboxId',v_outbox_id,'queuedAt',v_now,'questionCount',v_question_count);
end;$function$;

-- 8. The manager finishes a pending manual review ---------------------------------
-- p_points: the points the reviewer awards per free-text question key (0 up
-- to the question's points). The score is recomputed from those and the
-- automatically scored answers; p_competent, when given, is the reviewer's
-- decision (otherwise score >= pass score). The assignment is completed and,
-- when competent, the certificate is issued as training_submit_evaluation does.
create or replace function public.training_finalize_review(p_organization_id uuid, p_assignment_key text, p_points jsonb default '{}'::jsonb, p_competent boolean default null, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public','auth','pg_temp'
as $function$
declare
 v_actor uuid:=auth.uid();
 v_assignment public.training_assignments%rowtype;
 v_program public.training_programs%rowtype;
 v_question public.training_assessment_questions%rowtype;
 v_points jsonb:=case when jsonb_typeof(p_points)='object' then p_points else '{}'::jsonb end;
 v_now timestamptz:=now();
 v_given numeric;
 v_awarded numeric;
 v_total numeric:=0;
 v_earned numeric:=0;
 v_score integer;
 v_competent boolean;
 v_reviewer text;
 v_certificate_key text;
begin
 if v_actor is null then raise exception 'TRAINING_AUTH_REQUIRED' using errcode='42501'; end if;
 if p_organization_id is null or not current_user_has_capability(p_organization_id,'manage_training') then raise exception 'TRAINING_MANAGE_REQUIRED' using errcode='42501'; end if;
 select * into v_assignment from public.training_assignments a where a.organization_id=p_organization_id and a.assignment_key=p_assignment_key for update;
 if not found then raise exception 'TRAINING_ASSIGNMENT_NOT_FOUND'; end if;
 if coalesce(v_assignment.assessment_review_status,'')<>'pending' then raise exception 'TRAINING_REVIEW_NOT_PENDING'; end if;
 select * into v_program from public.training_programs p where p.id=v_assignment.program_id;
 for v_question in select * from public.training_assessment_questions q where q.program_id=v_program.id order by q.position,q.question_key loop
  if v_question.question_type='free_text' then
   if not v_question.manual_review then continue; end if;
   v_given:=case when jsonb_typeof(v_points->v_question.question_key)='number' then (v_points->>v_question.question_key)::numeric else 0 end;
   v_awarded:=least(v_question.points,greatest(0,v_given));
  else
   v_awarded:=case when private.training_answer_correct(v_question.id,v_assignment.id) then v_question.points else 0 end;
  end if;
  v_total:=v_total+v_question.points;
  v_earned:=v_earned+v_awarded;
  update public.training_assessment_answers x set awarded_points=v_awarded where x.assignment_id=v_assignment.id and x.question_key=v_question.question_key;
 end loop;
 v_score:=case when v_total>0 then round(v_earned/v_total*100)::integer else null end;
 v_competent:=coalesce(p_competent,case when v_score is null then true else v_score>=coalesce(v_program.pass_score,0) end);
 v_reviewer:=coalesce((select coalesce(nullif(btrim(pr.full_name),''),nullif(btrim(pr.username),'')) from public.profiles pr where pr.id=v_actor),(select u.email from auth.users u where u.id=v_actor));
 update public.training_assignments a set status='completed',completion_confirmed_at=v_now,completed_date=v_now::date,score=v_score,competent=v_competent,
  assessment_review_status='reviewed',assessment_reviewed_at=v_now,assessment_reviewed_by=v_reviewer,assessment_review_acknowledged=true,
  assessment_review_note=nullif(btrim(coalesce(p_note,'')),'')
 where a.id=v_assignment.id;
 v_certificate_key:=case when v_competent then private.training_issue_certificate(v_assignment.id,v_now) else null end;
 return jsonb_build_object('assignmentId',v_assignment.assignment_key,'programId',v_program.program_key,'score',v_score,'competent',v_competent,'certificateId',v_certificate_key,'reviewedAt',v_now,'reviewedBy',v_reviewer);
end;$function$;

revoke all on function public.training_finalize_review(uuid,text,jsonb,boolean,text) from public, anon;
grant execute on function public.training_finalize_review(uuid,text,jsonb,boolean,text) to authenticated, service_role;

-- 9. Manager saves (SECURITY INVOKER: the caller's RLS applies) --------------------
-- JSON is only the input format: each value goes to its column. The input is
-- the app's object (programme / assignment / requirement). Children are kept
-- by key: changed ones updated, missing ones removed, new ones added.

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
    start_date, due_date, valid_months, requires_assessment, pass_score, status, department_id, feedback_template_key, feedback_title_el, feedback_title_en)
  values (p_organization_id, v_key, coalesce(p_program->>'title', ''), nullif(btrim(coalesce(p_program->>'titleEn', '')), ''),
    nullif(p_program->>'category', ''), nullif(p_program->>'method', ''), nullif(p_program->>'owner', ''), nullif(p_program->>'trainer', ''),
    nullif(p_program->>'audience', ''), nullif(p_program->>'description', ''),
    nullif(left(p_program->>'startDate', 10), '')::date, nullif(left(p_program->>'dueDate', 10), '')::date,
    round(nullif(p_program->>'validMonths', '')::numeric)::integer, coalesce(nullif(p_program->>'requiresAssessment', '')::boolean, false),
    round(nullif(p_program->>'passScore', '')::numeric)::integer, coalesce(nullif(p_program->>'status', ''), 'planned'),
    case when p_program->>'departmentId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (p_program->>'departmentId')::uuid end,
    nullif(v_template->>'id', ''), nullif(v_template->>'titleEl', ''), nullif(v_template->>'titleEn', ''))
  on conflict (organization_id, program_key) do update set
    title = excluded.title, title_en = excluded.title_en, category = excluded.category, method = excluded.method, owner = excluded.owner,
    trainer = excluded.trainer, audience = excluded.audience, description = excluded.description, start_date = excluded.start_date,
    due_date = excluded.due_date, valid_months = excluded.valid_months, requires_assessment = excluded.requires_assessment,
    pass_score = excluded.pass_score, status = excluded.status, department_id = excluded.department_id,
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

-- What a manager sets on an assignment. What the learner submits (attendance,
-- answers, evaluation, score, completion, the access token) is never taken
-- from this input; a started or completed assignment keeps its status. The
-- employee code links the employee (e-mail, department, account), as the
-- client did before (resolveAssignmentIdentity).
create or replace function public.training_save_assignment(p_organization_id uuid, p_assignment jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_key text := nullif(btrim(coalesce(p_assignment->>'id', '')), '');
  v_code text := nullif(btrim(coalesce(p_assignment->>'employeeId', '')), '');
  v_user uuid := case when p_assignment->>'userId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (p_assignment->>'userId')::uuid end;
  v_department uuid := case when p_assignment->>'departmentId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then (p_assignment->>'departmentId')::uuid end;
  v_program_id uuid;
  v_emp_user uuid;
  v_emp_department uuid;
  v_emp_email text;
  v_id uuid;
begin
  if v_key is null then raise exception 'TRAINING_RECORD_KEY_REQUIRED' using errcode = '22023'; end if;
  if p_organization_id is null or not public.current_user_has_capability(p_organization_id, 'manage_training') then
    raise exception 'TRAINING_MANAGE_REQUIRED' using errcode = '42501';
  end if;
  v_program_id := (select p.id from public.training_programs p where p.organization_id = p_organization_id and p.program_key = p_assignment->>'programId');
  if v_program_id is null then raise exception 'TRAINING_PROGRAM_NOT_FOUND' using errcode = '22023'; end if;
  if v_code is not null then
    select e.user_id, e.department_id, nullif(btrim(e.email), '') into v_emp_user, v_emp_department, v_emp_email
    from public.employees e where e.organization_id = p_organization_id and e.employee_code = v_code limit 1;
  end if;

  insert into public.training_assignments as t(organization_id, assignment_key, program_id, employee_code, employee_name, department_name, department_id,
    employee_user_id, email, account_linked, manual_entry, assigned_date, due_date, status, assessment_reviewed_at, assessment_reviewed_by, assessment_review_acknowledged)
  values (p_organization_id, v_key, v_program_id, v_code, nullif(btrim(coalesce(p_assignment->>'employeeName', '')), ''),
    nullif(btrim(coalesce(p_assignment->>'department', '')), ''), coalesce(v_emp_department, v_department), coalesce(v_user, v_emp_user),
    coalesce(v_emp_email, nullif(btrim(coalesce(p_assignment->>'email', '')), '')),
    case when v_user is not null then true when v_code is null then false else v_emp_user is not null end,
    coalesce(nullif(p_assignment->>'manualEntry', '')::boolean, false),
    nullif(left(p_assignment->>'assignedDate', 10), '')::date, nullif(left(p_assignment->>'dueDate', 10), '')::date,
    coalesce(nullif(p_assignment->>'status', ''), 'assigned'),
    nullif(p_assignment->>'assessmentReviewedAt', '')::timestamptz, nullif(p_assignment->>'assessmentReviewedBy', ''),
    nullif(p_assignment->>'assessmentReviewAcknowledged', '')::boolean)
  on conflict (organization_id, assignment_key) do update set
    program_id = excluded.program_id, employee_code = excluded.employee_code, employee_name = excluded.employee_name,
    department_name = excluded.department_name, department_id = coalesce(excluded.department_id, t.department_id),
    employee_user_id = coalesce(excluded.employee_user_id, t.employee_user_id), email = excluded.email, account_linked = excluded.account_linked,
    manual_entry = excluded.manual_entry, assigned_date = excluded.assigned_date, due_date = excluded.due_date,
    status = case when t.status in ('completed','in_progress') then t.status else excluded.status end,
    assessment_reviewed_at = coalesce(t.assessment_reviewed_at, excluded.assessment_reviewed_at),
    assessment_reviewed_by = coalesce(t.assessment_reviewed_by, excluded.assessment_reviewed_by),
    assessment_review_acknowledged = coalesce(excluded.assessment_review_acknowledged, t.assessment_review_acknowledged)
  where (t.program_id, t.employee_code, t.employee_name, t.department_name, t.department_id, t.employee_user_id, t.email, t.account_linked,
      t.manual_entry, t.assigned_date, t.due_date, t.status, t.assessment_reviewed_at, t.assessment_reviewed_by, t.assessment_review_acknowledged)
    is distinct from (excluded.program_id, excluded.employee_code, excluded.employee_name, excluded.department_name, coalesce(excluded.department_id, t.department_id),
      coalesce(excluded.employee_user_id, t.employee_user_id), excluded.email, excluded.account_linked, excluded.manual_entry, excluded.assigned_date,
      excluded.due_date, case when t.status in ('completed','in_progress') then t.status else excluded.status end,
      coalesce(t.assessment_reviewed_at, excluded.assessment_reviewed_at), coalesce(t.assessment_reviewed_by, excluded.assessment_reviewed_by),
      coalesce(excluded.assessment_review_acknowledged, t.assessment_review_acknowledged))
  returning t.id into v_id;
  if v_id is null then
    v_id := (select a.id from public.training_assignments a where a.organization_id = p_organization_id and a.assignment_key = v_key);
  end if;
  return v_id;
end;
$function$;

-- One call for a whole save of the Training screen: the programmes, then
-- the assignments (which may name a programme created in the same save).
create or replace function public.training_save_state(p_organization_id uuid, p_programs jsonb default '[]'::jsonb, p_assignments jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_item jsonb;
  v_programs integer := 0;
  v_assignments integer := 0;
begin
  if p_organization_id is null or not public.current_user_has_capability(p_organization_id, 'manage_training') then
    raise exception 'TRAINING_MANAGE_REQUIRED' using errcode = '42501';
  end if;
  for v_item in select x.value from jsonb_array_elements(case when jsonb_typeof(p_programs) = 'array' then p_programs else '[]'::jsonb end) x(value) loop
    perform public.training_save_program(p_organization_id, v_item);
    v_programs := v_programs + 1;
  end loop;
  for v_item in select x.value from jsonb_array_elements(case when jsonb_typeof(p_assignments) = 'array' then p_assignments else '[]'::jsonb end) x(value) loop
    perform public.training_save_assignment(p_organization_id, v_item);
    v_assignments := v_assignments + 1;
  end loop;
  return jsonb_build_object('programs', v_programs, 'assignments', v_assignments);
end;
$function$;

create or replace function public.training_save_requirement(p_organization_id uuid, p_requirement jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_key text := nullif(btrim(coalesce(p_requirement->>'id', '')), '');
  v_programs jsonb := case when jsonb_typeof(p_requirement->'programIds') = 'array' then p_requirement->'programIds' else '[]'::jsonb end;
  v_id uuid;
begin
  if v_key is null then raise exception 'TRAINING_RECORD_KEY_REQUIRED' using errcode = '22023'; end if;
  if p_organization_id is null or not public.current_user_has_capability(p_organization_id, 'manage_training') then
    raise exception 'TRAINING_MANAGE_REQUIRED' using errcode = '42501';
  end if;
  if exists (select 1 from jsonb_array_elements_text(v_programs) x(value)
             where not exists (select 1 from public.training_programs p where p.organization_id = p_organization_id and p.program_key = x.value)) then
    raise exception 'TRAINING_PROGRAM_NOT_FOUND' using errcode = '22023';
  end if;

  insert into public.training_requirements as t(organization_id, requirement_key, title, renewal_months, active)
  values (p_organization_id, v_key, coalesce(p_requirement->>'title', ''), round(nullif(p_requirement->>'renewalMonths', '')::numeric)::integer,
    coalesce(nullif(p_requirement->>'active', '')::boolean, true))
  on conflict (organization_id, requirement_key) do update set title = excluded.title, renewal_months = excluded.renewal_months, active = excluded.active
  returning t.id into v_id;

  delete from public.training_requirement_programs rp where rp.requirement_id = v_id
    and rp.program_id not in (select p.id from jsonb_array_elements_text(v_programs) x(value)
      join public.training_programs p on p.organization_id = p_organization_id and p.program_key = x.value);
  insert into public.training_requirement_programs as t(requirement_id, program_id, organization_id, position)
  select distinct on (p.id) v_id, p.id, p_organization_id, x.ord::integer
  from jsonb_array_elements_text(v_programs) with ordinality x(value, ord)
  join public.training_programs p on p.organization_id = p_organization_id and p.program_key = x.value
  order by p.id, x.ord
  on conflict (requirement_id, program_id) do update set position = excluded.position where t.position is distinct from excluded.position;

  delete from public.training_requirement_targets rt where rt.requirement_id = v_id
    and not exists (select 1 from (values ('profession', 'professions'), ('position', 'positions'), ('department', 'departments')) k(kind, field)
      cross join lateral jsonb_array_elements_text(case when jsonb_typeof(p_requirement->k.field) = 'array' then p_requirement->k.field else '[]'::jsonb end) x(value)
      where k.kind = rt.target_kind and btrim(x.value) = rt.value);
  insert into public.training_requirement_targets as t(organization_id, requirement_id, target_kind, value, position)
  select distinct on (k.kind, btrim(x.value)) p_organization_id, v_id, k.kind, btrim(x.value), x.ord::integer
  from (values ('profession', 'professions'), ('position', 'positions'), ('department', 'departments')) k(kind, field)
  cross join lateral jsonb_array_elements_text(case when jsonb_typeof(p_requirement->k.field) = 'array' then p_requirement->k.field else '[]'::jsonb end) with ordinality x(value, ord)
  where btrim(x.value) <> ''
  order by k.kind, btrim(x.value), x.ord
  on conflict (requirement_id, target_kind, value) do update set position = excluded.position where t.position is distinct from excluded.position;
  return v_id;
end;
$function$;

-- Deletes the programme, assignment or requirement with that key. A
-- programme with assignments, or an assignment with a certificate, is kept
-- (foreign keys); the screens do not offer those deletions.
create or replace function public.training_delete_record(p_organization_id uuid, p_record_key text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_rows integer;
  v_total integer := 0;
begin
  if p_organization_id is null or not public.current_user_has_capability(p_organization_id, 'manage_training') then
    raise exception 'TRAINING_MANAGE_REQUIRED' using errcode = '42501';
  end if;
  delete from public.training_assignments a where a.organization_id = p_organization_id and a.assignment_key = p_record_key;
  get diagnostics v_rows = row_count; v_total := v_total + v_rows;
  delete from public.training_requirements r where r.organization_id = p_organization_id and r.requirement_key = p_record_key;
  get diagnostics v_rows = row_count; v_total := v_total + v_rows;
  delete from public.training_programs p where p.organization_id = p_organization_id and p.program_key = p_record_key;
  get diagnostics v_rows = row_count; v_total := v_total + v_rows;
  return v_total > 0;
end;
$function$;

revoke all on function public.training_save_program(uuid, jsonb) from public, anon;
revoke all on function public.training_save_assignment(uuid, jsonb) from public, anon;
revoke all on function public.training_save_state(uuid, jsonb, jsonb) from public, anon;
revoke all on function public.training_save_requirement(uuid, jsonb) from public, anon;
revoke all on function public.training_delete_record(uuid, text) from public, anon;
grant execute on function public.training_save_program(uuid, jsonb) to authenticated, service_role;
grant execute on function public.training_save_assignment(uuid, jsonb) to authenticated, service_role;
grant execute on function public.training_save_state(uuid, jsonb, jsonb) to authenticated, service_role;
grant execute on function public.training_save_requirement(uuid, jsonb) to authenticated, service_role;
grant execute on function public.training_delete_record(uuid, text) to authenticated, service_role;


-- 10. Database objects that read training ------------------------------------

-- Indicators: training completion from training_assignments (whole body re-created;
-- the metric object stays split into || chunks under the 100-argument limit).
create or replace function private.indicator_metric_snapshot(p_organization_id uuid, p_from date, p_to date, p_department_id uuid default null::uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare v_scoped boolean;v_daily_count integer:=0;v_patient_days numeric:=0;v_active bigint:=0;v_resistant bigint:=0;v_hh_ok numeric:=0;v_hh_total numeric:=0;v_bundle_ok bigint:=0;v_bundle_total bigint:=0;v_abhr numeric:=0;v_staff bigint:=0;v_vaccinated bigint:=0;v_training_ok bigint:=0;v_training_total bigint:=0;v_incidents bigint:=0;v_mdro bigint:=0;
v_bact_total bigint:=0;v_bact_ecoli bigint:=0;v_bact_proteus bigint:=0;v_bact_acineto bigint:=0;v_bact_kleb bigint:=0;v_bact_entb bigint:=0;v_bact_pseudo bigint:=0;v_bact_saureus bigint:=0;v_bact_entc bigint:=0;
v_amr_t_ecoli bigint:=0;v_amr_r_ecoli bigint:=0;v_amr_t_proteus bigint:=0;v_amr_r_proteus bigint:=0;v_amr_t_acineto bigint:=0;v_amr_r_acineto bigint:=0;v_amr_t_kleb bigint:=0;v_amr_r_kleb bigint:=0;v_amr_t_entb bigint:=0;v_amr_r_entb bigint:=0;v_amr_t_pseudo bigint:=0;v_amr_r_pseudo bigint:=0;v_amr_t_saureus bigint:=0;v_amr_r_saureus bigint:=0;v_amr_t_entc bigint:=0;v_amr_r_entc bigint:=0;
v_ddd_total numeric:=0;
v_iso_total bigint:=0;v_iso_ecoli bigint:=0;v_iso_proteus bigint:=0;v_iso_acineto bigint:=0;v_iso_kleb bigint:=0;v_iso_entb bigint:=0;v_iso_pseudo bigint:=0;v_iso_saureus bigint:=0;v_iso_entc bigint:=0;
v_pps_total bigint:=0;v_pps_hai bigint:=0;v_pps_abx bigint:=0;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_from is null or p_to is null or p_to<p_from then raise exception 'Invalid indicator period'; end if;
  if not (public.current_user_is_platform_owner() or public.current_user_has_capability(p_organization_id,'view_indicators')) then raise exception 'Indicator access denied'; end if;
  select private.indicator_requires_department_scope(p_organization_id) into v_scoped;
  if v_scoped and p_department_id is null then raise exception 'Department scope required'; end if;
  if v_scoped and p_department_id is not null and not public.current_user_has_department_scope(p_organization_id,p_department_id) then raise exception 'Department scope denied'; end if;
  select count(*),coalesce(sum(pd.patient_days),0) into v_daily_count,v_patient_days from public.patient_days pd where pd.organization_id=p_organization_id and pd.census_date between p_from and p_to and (p_department_id is null or pd.department_id=p_department_id);
  if v_daily_count=0 then select coalesce(sum(pp.patient_days),0) into v_patient_days from public.patient_day_periods pp where pp.organization_id=p_organization_id and pp.period_start>=p_from and pp.period_end<=p_to and (p_department_id is null or pp.department_id=p_department_id); end if;
  select count(*) into v_active from public.surveillance_cases s where s.organization_id=p_organization_id and s.voided_at is null and s.started_at::date<=p_to and (s.closed_at is null or s.closed_at::date>=p_from) and (p_department_id is null or s.department_id=p_department_id);
  select count(distinct s.id) into v_resistant from public.surveillance_cases s join public.laboratory_samples l on l.surveillance_case_id=s.id and l.organization_id=s.organization_id join public.microbiology_results m on m.sample_id=l.id and m.organization_id=s.organization_id where s.organization_id=p_organization_id and s.voided_at is null and s.started_at::date<=p_to and (s.closed_at is null or s.closed_at::date>=p_from) and (p_department_id is null or s.department_id=p_department_id) and m.result_status='positive' and (upper(coalesce(m.resistance_class,'')) in ('MDR','XDR','PDR') or exists(select 1 from public.amr_classifications a where a.organization_id=p_organization_id and a.microbiology_result_id=m.id and a.status<>'rejected' and upper(coalesce(a.classification,'')) in ('MDR','XDR','PDR')));
  select coalesce(sum(h.compliant_observations),0),coalesce(sum(h.observations),0) into v_hh_ok,v_hh_total from public.hand_hygiene_sessions h where h.organization_id=p_organization_id and h.status='completed' and h.observation_date between p_from and p_to and (p_department_id is null or h.department_id=p_department_id);
  select count(*) filter(where b.score>=100),count(*) into v_bundle_ok,v_bundle_total from public.prevention_bundle_assessments b where b.organization_id=p_organization_id and b.status='completed' and b.assessment_date between p_from and p_to and (p_department_id is null or b.department_id=p_department_id);
  select coalesce(sum(a.litres),0) into v_abhr from public.antiseptic_consumption_periods a where a.organization_id=p_organization_id and a.period_start>=p_from and a.period_end<=p_to and (p_department_id is null or a.department_id=p_department_id);
  select count(*) into v_staff from public.employees e where e.organization_id=p_organization_id and e.employment_status='active' and (p_department_id is null or e.department_id=p_department_id);
  select count(distinct v.employee_id) into v_vaccinated from public.employee_vaccinations v join public.employees e on e.id=v.employee_id where v.organization_id=p_organization_id and e.employment_status='active' and v.vaccination_date<=p_to and (v.valid_until is null or v.valid_until>=p_to) and lower(coalesce(v.status,'active')) not in ('cancelled','canceled','rejected','expired','inactive','voided') and (lower(coalesce(v.vaccine_label_snapshot,'')) like '%γρίπ%' or lower(coalesce(v.vaccine_label_snapshot,'')) like '%influenza%' or lower(coalesce(v.vaccine_label_snapshot,'')) like '%flu%') and (p_department_id is null or e.department_id=p_department_id);
  select count(*) filter(where t.status='completed'),count(*) into v_training_ok,v_training_total from public.training_assignments t where t.organization_id=p_organization_id and coalesce(t.assigned_date,t.created_at::date) between p_from and p_to and (p_department_id is null or t.department_id=p_department_id);
  select count(*) into v_incidents from public.quality_incidents q where q.organization_id=p_organization_id and q.occurred_at::date between p_from and p_to and q.severity='high' and q.status<>'closed' and (p_department_id is null or q.department_id=p_department_id);
  select count(distinct m.id) into v_mdro from public.microbiology_results m join public.laboratory_samples l on l.id=m.sample_id where m.organization_id=p_organization_id and m.result_status='positive' and l.collected_at::date between p_from and p_to and (p_department_id is null or l.department_id=p_department_id) and lower(coalesce(l.sample_type,'')) like '%blood%' and (upper(coalesce(m.resistance_class,'')) in ('MDR','XDR','PDR') or exists(select 1 from public.amr_classifications a where a.organization_id=p_organization_id and a.microbiology_result_id=m.id and a.status<>'rejected' and upper(coalesce(a.classification,'')) in ('MDR','XDR','PDR')));
  select
    count(distinct m.id) filter(where lower(coalesce(m.organism,'')) like '%escherichia coli%' or lower(coalesce(m.organism,'')) like '%proteus%' or lower(coalesce(m.organism,'')) like '%acinetobacter%' or lower(coalesce(m.organism,'')) like '%klebsiella%' or lower(coalesce(m.organism,'')) like '%enterobacter%' or lower(coalesce(m.organism,'')) like '%pseudomonas%' or lower(coalesce(m.organism,'')) like '%staphylococcus aureus%' or lower(coalesce(m.organism,'')) like '%enterococcus%'),
    count(distinct m.id) filter(where lower(coalesce(m.organism,'')) like '%escherichia coli%'),
    count(distinct m.id) filter(where lower(coalesce(m.organism,'')) like '%proteus%'),
    count(distinct m.id) filter(where lower(coalesce(m.organism,'')) like '%acinetobacter%'),
    count(distinct m.id) filter(where lower(coalesce(m.organism,'')) like '%klebsiella%'),
    count(distinct m.id) filter(where lower(coalesce(m.organism,'')) like '%enterobacter%'),
    count(distinct m.id) filter(where lower(coalesce(m.organism,'')) like '%pseudomonas%'),
    count(distinct m.id) filter(where lower(coalesce(m.organism,'')) like '%staphylococcus aureus%'),
    count(distinct m.id) filter(where lower(coalesce(m.organism,'')) like '%enterococcus%')
  into v_bact_total,v_bact_ecoli,v_bact_proteus,v_bact_acineto,v_bact_kleb,v_bact_entb,v_bact_pseudo,v_bact_saureus,v_bact_entc
  from public.microbiology_results m join public.laboratory_samples l on l.id=m.sample_id
  where m.organization_id=p_organization_id and m.result_status='positive' and m.validation_status in ('validated','amended') and m.organism is not null and l.collected_at::date between p_from and p_to and (p_department_id is null or l.department_id=p_department_id) and lower(coalesce(l.sample_type,'')) like '%blood%'
    and not exists(select 1 from public.microbiology_results m2 where m2.organization_id=m.organization_id and m2.amended_from=m.id);
  select
    count(*) filter(where lower(coalesce(a.organism,'')) like '%escherichia coli%' and (a.antimicrobial_code='ABX-CRO' or lower(coalesce(a.antimicrobial_name,'')) like '%ceftriaxone%')),
    count(*) filter(where lower(coalesce(a.organism,'')) like '%escherichia coli%' and (a.antimicrobial_code='ABX-CRO' or lower(coalesce(a.antimicrobial_name,'')) like '%ceftriaxone%') and a.sir_category='R'),
    count(*) filter(where lower(coalesce(a.organism,'')) like '%proteus%' and (a.antimicrobial_code='ABX-CRO' or lower(coalesce(a.antimicrobial_name,'')) like '%ceftriaxone%')),
    count(*) filter(where lower(coalesce(a.organism,'')) like '%proteus%' and (a.antimicrobial_code='ABX-CRO' or lower(coalesce(a.antimicrobial_name,'')) like '%ceftriaxone%') and a.sir_category='R'),
    count(*) filter(where lower(coalesce(a.organism,'')) like '%acinetobacter%' and (a.antimicrobial_code='ABX-MEM' or lower(coalesce(a.antimicrobial_name,'')) like '%meropenem%')),
    count(*) filter(where lower(coalesce(a.organism,'')) like '%acinetobacter%' and (a.antimicrobial_code='ABX-MEM' or lower(coalesce(a.antimicrobial_name,'')) like '%meropenem%') and a.sir_category='R'),
    count(*) filter(where lower(coalesce(a.organism,'')) like '%klebsiella%' and (a.antimicrobial_code='ABX-MEM' or lower(coalesce(a.antimicrobial_name,'')) like '%meropenem%')),
    count(*) filter(where lower(coalesce(a.organism,'')) like '%klebsiella%' and (a.antimicrobial_code='ABX-MEM' or lower(coalesce(a.antimicrobial_name,'')) like '%meropenem%') and a.sir_category='R'),
    count(*) filter(where lower(coalesce(a.organism,'')) like '%enterobacter%' and (a.antimicrobial_code='ABX-CRO' or lower(coalesce(a.antimicrobial_name,'')) like '%ceftriaxone%')),
    count(*) filter(where lower(coalesce(a.organism,'')) like '%enterobacter%' and (a.antimicrobial_code='ABX-CRO' or lower(coalesce(a.antimicrobial_name,'')) like '%ceftriaxone%') and a.sir_category='R'),
    count(*) filter(where lower(coalesce(a.organism,'')) like '%pseudomonas%' and (a.antimicrobial_code='ABX-MEM' or lower(coalesce(a.antimicrobial_name,'')) like '%meropenem%')),
    count(*) filter(where lower(coalesce(a.organism,'')) like '%pseudomonas%' and (a.antimicrobial_code='ABX-MEM' or lower(coalesce(a.antimicrobial_name,'')) like '%meropenem%') and a.sir_category='R'),
    count(*) filter(where lower(coalesce(a.organism,'')) like '%staphylococcus aureus%' and (a.antimicrobial_code='ABX-OXA' or lower(coalesce(a.antimicrobial_name,'')) like '%oxacillin%')),
    count(*) filter(where lower(coalesce(a.organism,'')) like '%staphylococcus aureus%' and (a.antimicrobial_code='ABX-OXA' or lower(coalesce(a.antimicrobial_name,'')) like '%oxacillin%') and a.sir_category='R'),
    count(*) filter(where lower(coalesce(a.organism,'')) like '%enterococcus%' and (a.antimicrobial_code='ABX-VAN' or lower(coalesce(a.antimicrobial_name,'')) like '%vancomycin%')),
    count(*) filter(where lower(coalesce(a.organism,'')) like '%enterococcus%' and (a.antimicrobial_code='ABX-VAN' or lower(coalesce(a.antimicrobial_name,'')) like '%vancomycin%') and a.sir_category='R')
  into v_amr_t_ecoli,v_amr_r_ecoli,v_amr_t_proteus,v_amr_r_proteus,v_amr_t_acineto,v_amr_r_acineto,v_amr_t_kleb,v_amr_r_kleb,v_amr_t_entb,v_amr_r_entb,v_amr_t_pseudo,v_amr_r_pseudo,v_amr_t_saureus,v_amr_r_saureus,v_amr_t_entc,v_amr_r_entc
  from public.antimicrobial_susceptibility_results a
  join public.microbiology_results m on m.id=a.microbiology_result_id and m.organization_id=a.organization_id
  join public.laboratory_samples l on l.id=m.sample_id
  where a.organization_id=p_organization_id and m.result_status='positive' and m.validation_status in ('validated','amended') and l.collected_at::date between p_from and p_to and (p_department_id is null or l.department_id=p_department_id)
    and not exists(select 1 from public.microbiology_results m2 where m2.organization_id=m.organization_id and m2.amended_from=m.id);
  select coalesce(sum(d.quantity_grams / (
    select r.ddd_grams from public.who_ddd_reference r
    where r.antibiotic_code=lib.code and (r.organization_id=d.organization_id or r.organization_id is null)
    order by r.organization_id nulls last limit 1
  )),0) into v_ddd_total
  from public.antibiotic_dispensing_periods d
  join public.master_library_items lib on lib.id=d.antibiotic_item_id
  where d.organization_id=p_organization_id and d.period_start>=p_from and d.period_end<=p_to and (p_department_id is null or d.department_id=p_department_id);
  select
    count(distinct ie.id) filter(where lower(coalesce(m.organism,'')) like '%escherichia coli%' or lower(coalesce(m.organism,'')) like '%proteus%' or lower(coalesce(m.organism,'')) like '%acinetobacter%' or lower(coalesce(m.organism,'')) like '%klebsiella%' or lower(coalesce(m.organism,'')) like '%enterobacter%' or lower(coalesce(m.organism,'')) like '%pseudomonas%' or lower(coalesce(m.organism,'')) like '%staphylococcus aureus%' or lower(coalesce(m.organism,'')) like '%enterococcus%'),
    count(distinct ie.id) filter(where lower(coalesce(m.organism,'')) like '%escherichia coli%'),
    count(distinct ie.id) filter(where lower(coalesce(m.organism,'')) like '%proteus%'),
    count(distinct ie.id) filter(where lower(coalesce(m.organism,'')) like '%acinetobacter%'),
    count(distinct ie.id) filter(where lower(coalesce(m.organism,'')) like '%klebsiella%'),
    count(distinct ie.id) filter(where lower(coalesce(m.organism,'')) like '%enterobacter%'),
    count(distinct ie.id) filter(where lower(coalesce(m.organism,'')) like '%pseudomonas%'),
    count(distinct ie.id) filter(where lower(coalesce(m.organism,'')) like '%staphylococcus aureus%'),
    count(distinct ie.id) filter(where lower(coalesce(m.organism,'')) like '%enterococcus%')
  into v_iso_total,v_iso_ecoli,v_iso_proteus,v_iso_acineto,v_iso_kleb,v_iso_entb,v_iso_pseudo,v_iso_saureus,v_iso_entc
  from public.isolation_episodes ie
  join public.surveillance_cases s on s.id=ie.surveillance_case_id and s.organization_id=ie.organization_id
  join public.laboratory_samples l on l.surveillance_case_id=s.id and l.organization_id=s.organization_id
  join public.microbiology_results m on m.sample_id=l.id and m.organization_id=s.organization_id
  where ie.organization_id=p_organization_id and s.voided_at is null and ie.started_at::date between p_from and p_to and (p_department_id is null or ie.department_id=p_department_id)
    and m.result_status='positive' and m.validation_status in ('validated','amended')
    and not exists(select 1 from public.microbiology_results m2 where m2.organization_id=m.organization_id and m2.amended_from=m.id)
    and (upper(coalesce(m.resistance_class,'')) in ('MDR','XDR','PDR') or exists(select 1 from public.amr_classifications am where am.organization_id=m.organization_id and am.microbiology_result_id=m.id and am.status<>'rejected' and upper(coalesce(am.classification,'')) in ('MDR','XDR','PDR')));
  select coalesce(sum(p.patients_total),0),coalesce(sum(p.patients_with_hai),0),coalesce(sum(p.patients_on_antibiotics),0) into v_pps_total,v_pps_hai,v_pps_abx
  from public.point_prevalence_surveys p
  where p.organization_id=p_organization_id and p.survey_date between p_from and p_to and (p_department_id is null or p.department_id=p_department_id);
  return
    jsonb_build_object('patient_days',v_patient_days,'active_surveillance',v_active,'resistant_active_surveillance',v_resistant,'hh_compliant_actions',v_hh_ok,'hh_opportunities',v_hh_total,'bundle_all_or_none_pass',v_bundle_ok,'bundle_executions',v_bundle_total,'abhr_litres',v_abhr,'active_staff',v_staff,'active_staff_with_vaccination',v_vaccinated,'training_completed',v_training_ok,'training_assignments',v_training_total,'open_high_incidents',v_incidents,'mdro_bsi',v_mdro)
    || jsonb_build_object('bacteremia_total',v_bact_total,'bacteremia_ecoli',v_bact_ecoli,'bacteremia_proteus',v_bact_proteus,'bacteremia_acinetobacter',v_bact_acineto,'bacteremia_klebsiella',v_bact_kleb,'bacteremia_enterobacter',v_bact_entb,'bacteremia_pseudomonas',v_bact_pseudo,'bacteremia_saureus',v_bact_saureus,'bacteremia_enterococcus',v_bact_entc)
    || jsonb_build_object('amr_tested_ecoli',v_amr_t_ecoli,'amr_resistant_ecoli',v_amr_r_ecoli,'amr_tested_proteus',v_amr_t_proteus,'amr_resistant_proteus',v_amr_r_proteus,'amr_tested_acinetobacter',v_amr_t_acineto,'amr_resistant_acinetobacter',v_amr_r_acineto,'amr_tested_klebsiella',v_amr_t_kleb,'amr_resistant_klebsiella',v_amr_r_kleb,'amr_tested_enterobacter',v_amr_t_entb,'amr_resistant_enterobacter',v_amr_r_entb,'amr_tested_pseudomonas',v_amr_t_pseudo,'amr_resistant_pseudomonas',v_amr_r_pseudo,'amr_tested_saureus',v_amr_t_saureus,'amr_resistant_saureus',v_amr_r_saureus,'amr_tested_enterococcus',v_amr_t_entc,'amr_resistant_enterococcus',v_amr_r_entc)
    || jsonb_build_object('antibiotic_ddd_total',v_ddd_total,'mdr_isolation_total',v_iso_total,'mdr_isolation_ecoli',v_iso_ecoli,'mdr_isolation_proteus',v_iso_proteus,'mdr_isolation_acinetobacter',v_iso_acineto,'mdr_isolation_klebsiella',v_iso_kleb,'mdr_isolation_enterobacter',v_iso_entb,'mdr_isolation_pseudomonas',v_iso_pseudo,'mdr_isolation_saureus',v_iso_saureus,'mdr_isolation_enterococcus',v_iso_entc,'pps_patients_total',v_pps_total,'pps_patients_with_hai',v_pps_hai,'pps_patients_on_antibiotics',v_pps_abx);
end;$function$;

-- Analysis: training figures from training_assignments.
create or replace function public.analysis_people_metrics(
  p_organization_id uuid default null,
  p_from date default null,
  p_to date default null,
  p_department_id uuid default null
) returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  r jsonb;
  can_health boolean := p_organization_id is not null and public.current_user_has_capability(p_organization_id,'view_occupational_health');
begin
  if public.current_user_is_platform_owner() then
    null;
  elsif p_organization_id is null or not public.current_user_has_org_role(
    p_organization_id,
    array['hospital_admin','infection_control_lead']::public.app_role[]
  ) then
    raise exception 'analytics access denied';
  end if;

  with
  emp as (
    select e.* from public.employees e
    where (p_organization_id is null or e.organization_id=p_organization_id)
      and (p_department_id is null or e.department_id=p_department_id)
      and coalesce(e.employment_status,'active')='active'
  ),
  vac as (
    select v.* from public.employee_vaccinations v join emp on emp.id=v.employee_id
    where coalesce(v.status,'') not in ('cancelled','void','voided')
      and (v.valid_until is null or v.valid_until>=current_date)
  ),
  ohv as (
    select o.* from public.occupational_health_visits o join emp on emp.id=o.employee_id
    where (p_from is null or coalesce(o.visit_date,o.created_at::date)>=p_from)
      and (p_to is null or coalesce(o.visit_date,o.created_at::date)<=p_to)
  ),
  tra as (
    select t.status, t.due_date, t.score, t.department_name, t.department_id from public.training_assignments t
    where (p_organization_id is null or t.organization_id=p_organization_id)
      and (p_department_id is null or t.department_id=p_department_id)
      and (p_from is null or coalesce(t.assigned_date,t.created_at::date)>=p_from)
      and (p_to is null or coalesce(t.assigned_date,t.created_at::date)<=p_to)
  ),
  doc as (
    select d.* from public.controlled_documents d
    where (p_organization_id is null or d.organization_id=p_organization_id)
      and (p_department_id is null or d.department_id=p_department_id)
      and coalesce(d.status,'') not in ('archived','superseded','void','voided')
  ),
  mtg as (
    select m.* from public.committee_meetings m
    where p_department_id is null
      and (p_organization_id is null or m.organization_id=p_organization_id)
      and (p_from is null or m.scheduled_at::date>=p_from)
      and (p_to is null or m.scheduled_at::date<=p_to)
  ),
  dept as (select id,name from public.departments)
  select jsonb_build_object(
    'workforce', jsonb_build_object(
      'activeEmployees',(select count(*) from emp),
      'vaccinatedEmployees',case when can_health then (select count(distinct employee_id) from vac) else null end,
      'byVaccine',case when can_health then coalesce((select jsonb_agg(jsonb_build_array(k,n) order by n desc) from (select coalesce(vaccine_label_snapshot,'—') k,count(distinct employee_id) n from vac group by 1) x),'[]'::jsonb) else null end,
      'visits',case when can_health then (select count(*) from ohv) else null end,
      'byVisitType',case when can_health then coalesce((select jsonb_agg(jsonb_build_array(k,n) order by n desc) from (select coalesce(visit_type,'—') k,count(*) n from ohv group by 1) x),'[]'::jsonb) else null end,
      'followUpsDue',case when can_health then (select count(*) from public.occupational_health_visits o join emp on emp.id=o.employee_id where o.follow_up_date<current_date and coalesce(o.status,'') not in ('cancelled')) else null end,
      'byDepartment',coalesce((select jsonb_agg(jsonb_build_array(k,n) order by n desc) from (select coalesce(d.name,emp.department_name,'—') k,count(*) n from emp left join dept d on d.id=emp.department_id group by 1) x),'[]'::jsonb)
    ),
    'training', jsonb_build_object(
      'assignments',(select count(*) from tra),
      'completed',(select count(*) from tra where status='completed'),
      'overdue',(select count(*) from tra where status not in ('completed','cancelled') and due_date<current_date),
      'averageScore',(select round(avg(score::numeric),1) from tra where score is not null),
      'byDepartment',coalesce((select jsonb_agg(jsonb_build_array(k,n,c) order by n desc) from (select coalesce(d.name,tra.department_name,'—') k,count(*) n,count(*) filter (where tra.status='completed') c from tra left join dept d on d.id=tra.department_id group by 1) x),'[]'::jsonb)
    ),
    'governance', jsonb_build_object(
      'documents',(select count(*) from doc),
      'published',(select count(*) from doc where status in ('published','approved')),
      'reviewOverdue',(select count(*) from doc where status in ('published','approved') and review_date<current_date),
      'byType',coalesce((select jsonb_agg(jsonb_build_array(k,n) order by n desc) from (select coalesce(document_type,'—') k,count(*) n from doc group by 1) x),'[]'::jsonb),
      'byStatus',coalesce((select jsonb_agg(jsonb_build_array(k,n) order by n desc) from (select coalesce(status,'—') k,count(*) n from doc group by 1) x),'[]'::jsonb),
      'committees',case when p_department_id is null then (select count(*) from public.committees c where (p_organization_id is null or c.organization_id=p_organization_id) and coalesce(c.status,'active')='active') else null end,
      'meetings',(select count(*) from mtg where cancelled_at is null),
      'minutesFinalized',(select count(*) from mtg where finalized_at is not null),
      'minutesPending',(select count(*) from mtg where cancelled_at is null and finalized_at is null and scheduled_at<now())
    )
  ) into r;
  return r;
end $$;

revoke all on function public.analysis_people_metrics(uuid,date,date,uuid) from public;
grant execute on function public.analysis_people_metrics(uuid,date,date,uuid) to authenticated;

-- Platform report: 'training' counts the assignments created in the period.
create or replace function public.platform_report_summary(
  p_organization_id uuid default null,
  p_from date default null,
  p_to date default null,
  p_department_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare r jsonb;
begin
  if public.current_user_is_platform_owner() then
    null;
  elsif p_organization_id is null or not public.current_user_has_org_role(
    p_organization_id,
    array['hospital_admin','infection_control_lead']::public.app_role[]
  ) then
    raise exception 'analytics access denied';
  end if;

  select jsonb_build_object(
    'surveillance',(select count(*) from public.surveillance_cases s where (p_organization_id is null or s.organization_id=p_organization_id) and (p_department_id is null or s.department_id=p_department_id) and (p_from is null or s.created_at::date>=p_from) and (p_to is null or s.created_at::date<=p_to)),
    'laboratory',(select count(*) from public.laboratory_samples l where (p_organization_id is null or l.organization_id=p_organization_id) and (p_department_id is null or l.department_id=p_department_id) and (p_from is null or l.created_at::date>=p_from) and (p_to is null or l.created_at::date<=p_to)),
    'prevention',((select count(*) from public.hand_hygiene_sessions p where (p_organization_id is null or p.organization_id=p_organization_id) and (p_department_id is null or p.department_id=p_department_id) and (p_from is null or p.created_at::date>=p_from) and (p_to is null or p.created_at::date<=p_to)) + (select count(*) from public.waste_measurements p where (p_organization_id is null or p.organization_id=p_organization_id) and (p_department_id is null or p.department_id=p_department_id) and (p_from is null or p.created_at::date>=p_from) and (p_to is null or p.created_at::date<=p_to)) + (select count(*) from public.prevention_bundle_assessments p where (p_organization_id is null or p.organization_id=p_organization_id) and (p_department_id is null or p.department_id=p_department_id) and (p_from is null or p.created_at::date>=p_from) and (p_to is null or p.created_at::date<=p_to))),
    'controls',(select count(*) from public.control_executions c where (p_organization_id is null or c.organization_id=p_organization_id) and (p_department_id is null or c.department_id=p_department_id) and (p_from is null or c.created_at::date>=p_from) and (p_to is null or c.created_at::date<=p_to)),
    'quality',((select count(*) from public.quality_incidents q where (p_organization_id is null or q.organization_id=p_organization_id) and (p_department_id is null or q.department_id=p_department_id) and (p_from is null or q.created_at::date>=p_from) and (p_to is null or q.created_at::date<=p_to)) + (select count(*) from public.quality_findings q where (p_organization_id is null or q.organization_id=p_organization_id) and (p_department_id is null or q.department_id=p_department_id) and (p_from is null or q.created_at::date>=p_from) and (p_to is null or q.created_at::date<=p_to)) + (select count(*) from public.quality_capa_actions q where (p_organization_id is null or q.organization_id=p_organization_id) and (p_department_id is null or q.department_id=p_department_id) and (p_from is null or q.created_at::date>=p_from) and (p_to is null or q.created_at::date<=p_to))),
    'training',(select count(*) from public.training_assignments t where (p_organization_id is null or t.organization_id=p_organization_id) and (p_department_id is null or t.department_id=p_department_id) and (p_from is null or t.created_at::date>=p_from) and (p_to is null or t.created_at::date<=p_to)),
    'documents',(select count(*) from public.controlled_documents d where (p_organization_id is null or d.organization_id=p_organization_id) and (p_department_id is null or d.department_id=p_department_id) and (p_from is null or d.created_at::date>=p_from) and (p_to is null or d.created_at::date<=p_to)),
    'committees',(case when p_department_id is null then (select count(*) from public.committees c where (p_organization_id is null or c.organization_id=p_organization_id) and (p_from is null or c.created_at::date>=p_from) and (p_to is null or c.created_at::date<=p_to)) else null end),
    'handHygiene',(select count(*) from public.hand_hygiene_sessions p where (p_organization_id is null or p.organization_id=p_organization_id) and (p_department_id is null or p.department_id=p_department_id) and (p_from is null or p.created_at::date>=p_from) and (p_to is null or p.created_at::date<=p_to)),
    'waste',(select count(*) from public.waste_measurements p where (p_organization_id is null or p.organization_id=p_organization_id) and (p_department_id is null or p.department_id=p_department_id) and (p_from is null or p.created_at::date>=p_from) and (p_to is null or p.created_at::date<=p_to)),
    'antimicrobial',(case when p_department_id is null then jsonb_build_object(
        'total',(select count(*) from public.antimicrobial_therapies a where (p_organization_id is null or a.organization_id=p_organization_id) and (p_from is null or a.created_at::date>=p_from) and (p_to is null or a.created_at::date<=p_to)),
        'pending',(select count(*) from public.antimicrobial_therapies a where (p_organization_id is null or a.organization_id=p_organization_id) and (p_from is null or a.created_at::date>=p_from) and (p_to is null or a.created_at::date<=p_to) and a.approval_status='pending'),
        'administrations',(select count(*) from public.antimicrobial_therapy_administrations d join public.antimicrobial_therapies a on a.id=d.therapy_id where (p_organization_id is null or a.organization_id=p_organization_id) and (p_from is null or d.administered_at::date>=p_from) and (p_to is null or d.administered_at::date<=p_to) and d.status='administered')
      ) else null end),
    'occupationalHealth',(case when p_department_id is null and public.current_user_has_capability(p_organization_id,'view_occupational_health') then (select count(*) from public.occupational_health_visits o where (p_organization_id is null or o.organization_id=p_organization_id) and (p_from is null or o.created_at::date>=p_from) and (p_to is null or o.created_at::date<=p_to)) else null end)
  ) into r;
  return r;
end $function$;

revoke execute on function public.platform_report_summary(uuid,date,date,uuid) from public, anon;
grant execute on function public.platform_report_summary(uuid,date,date,uuid) to authenticated;

-- Demo indicators: training completion from training_assignments.
create or replace function private.demo_seed_quality_indicators(p_organization_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
  d0 date := current_date;
  v_icu uuid := (select dep.id from public.departments dep where dep.organization_id = p_organization_id and dep.code = 'ΜΕΘ');
  v_scopes uuid[];
  v_dep uuid;
  v_si integer;
  k integer;
  ms date; me date;
  v_pd numeric; v_daily integer;
  v_active numeric; v_mdro numeric; v_bact numeric; v_hh_ok numeric; v_hh_tot numeric; v_b_ok numeric; v_b_tot numeric;
  v_abhr numeric; v_ddd numeric; v_tr_ok numeric; v_tr_tot numeric; v_iso numeric; v_kl_t numeric; v_kl_r numeric;
  v_pps_t numeric; v_pps_h numeric; v_pps_a numeric;
  -- history for the months before the Demo's own records (index = months ago)
  syn_hh_ok numeric[] := array[0, 0, 0, 152, 147, 143];
  syn_hh_icu numeric[] := array[0, 0, 0, 44, 42, 40];
  syn_b_ok numeric[] := array[0, 0, 4, 5, 4, 4];
  syn_active numeric[] := array[0, 0, 10, 9, 11, 8];
  syn_mdro numeric[] := array[0, 0, 1, 1, 2, 1];
  syn_bact numeric[] := array[0, 0, 4, 4, 5, 3];
  syn_iso numeric[] := array[0, 0, 2, 2, 3, 2];
  syn_tr numeric[] := array[0, 0, 0, 21, 19, 18];
  syn_kl_r numeric[] := array[0, 0, 2, 1, 2, 1];
  m_eody_n numeric[] := array[8, 7, 9, 8, 11, 7];
  m_eody_d numeric[] := array[8, 8, 9, 8, 12, 7];
  m_clabsi_n numeric[] := array[2, 1, 1, 0, 1, 0];
  m_clabsi_icu_d numeric[] := array[312, 296, 305, 288, 301, 279];
  m_clabsi_all_d numeric[] := array[468, 441, 452, 430, 447, 419];
  m_vap_n numeric[] := array[1, 1, 0, 1, 0, 1];
  m_vap_d numeric[] := array[204, 196, 210, 188, 199, 192];
begin
  -- Hospital definitions: CLABSI / VAP (entered manually from the ICU device-day
  -- register) and hospital targets for antibiotic use and the PPS prevalence.
  -- Definitions are kept by the Demo wipe, hence the upsert.
  insert into public.indicator_definitions(organization_id, indicator_key, version, title_el, title_en, category, numerator_definition, denominator_definition,
    multiplier, unit, unit_en, source_authority, effective_from, status, created_by, approved_by, approved_at, calculation_type, numerator_metric, denominator_metric,
    target_value, direction, visible_department_ids)
  select v_org, x.k, x.ver, x.el, x.en, x.cat, x.numd::jsonb, x.dend::jsonb, x.mult, x.unit, x.unit_en, x.src, date_trunc('year', d0)::date, 'active',
    p_actor, p_actor, now(), x.calc, x.num, x.den, x.target, x.dir, '[]'::jsonb
  from (values
    ('clabsi-per-1000-cvc-days', '2026.1', 'CLABSI ανά 1.000 ημέρες κεντρικού φλεβικού καθετήρα', 'CLABSI per 1,000 central-line days', 'surveillance',
      '{"description":"Επεισόδια CLABSI (ορισμός ECDC HAI-Net ICU)"}', '{"description":"Ημέρες κεντρικού φλεβικού καθετήρα (ημερήσια καταγραφή ΜΕΘ)"}',
      1000, '/1.000 ημέρες ΚΦΚ', '/1,000 central-line days', 'ECDC HAI-Net ICU · Νοσοκομειακός στόχος ΕΝΛ', 'manual', null, null, 2.0, 'lower'),
    ('vap-per-1000-ventilator-days', '2026.1', 'VAP ανά 1.000 ημέρες μηχανικού αερισμού', 'VAP per 1,000 ventilator days', 'surveillance',
      '{"description":"Επεισόδια πνευμονίας από αναπνευστήρα (PN1–PN5, ECDC)"}', '{"description":"Ημέρες μηχανικού αερισμού"}',
      1000, '/1.000 ημέρες αναπνευστήρα', '/1,000 ventilator days', 'ECDC HAI-Net ICU · Νοσοκομειακός στόχος ΕΝΛ', 'manual', null, null, 8.0, 'lower'),
    ('antibiotic-ddd-per-100-patient-days', '2026.1-ΝΟΣ', 'Κατανάλωση αντιβιοτικών (DDD ανά 100 ασθενοημέρες)', 'Antibiotic consumption (DDD per 100 patient-days)', 'pharmacy',
      '{"description":"Σύνολο DDD αντιβιοτικών (ATC J01)"}', '{"description":"Ασθενοημέρες"}',
      100, 'DDD/100 ασθενοημέρες', 'DDD/100 patient-days', 'Φαρμακείο · ΕΟΔΥ / WHO ATC-DDD · στόχος Επιτροπής Αντιμικροβιακών', 'auto', 'antibiotic_ddd_total', 'patient_days', 75.0, 'lower'),
    ('hai-prevalence-pps', '1.0-ΝΟΣ', 'Σημειακός επιπολασμός νοσοκομειακών λοιμώξεων (PPS)', 'HAI point prevalence (PPS)', 'surveillance',
      '{"description":"Ασθενείς με τουλάχιστον μία ενεργή ΝΝΛ"}', '{"description":"Νοσηλευόμενοι ασθενείς την ημέρα της επισκόπησης"}',
      100, '%', '%', 'ECDC PPS · στόχος ΕΝΛ (εθνικός μέσος όρος ~10%)', 'auto', 'pps_patients_with_hai', 'pps_patients_total', 8.0, 'lower')
  ) x(k, ver, el, en, cat, numd, dend, mult, unit, unit_en, src, calc, num, den, target, dir)
  on conflict (organization_id, indicator_key, version) do update set
    title_el = excluded.title_el, title_en = excluded.title_en, numerator_definition = excluded.numerator_definition,
    denominator_definition = excluded.denominator_definition, multiplier = excluded.multiplier, unit = excluded.unit, unit_en = excluded.unit_en,
    source_authority = excluded.source_authority, status = 'active', calculation_type = excluded.calculation_type,
    numerator_metric = excluded.numerator_metric, denominator_metric = excluded.denominator_metric, target_value = excluded.target_value, direction = excluded.direction;

  if exists (select 1 from public.indicator_snapshots s where s.organization_id = v_org) then
    return;
  end if;

  v_scopes := array[null::uuid, v_icu];
  for v_si in 1 .. 2 loop
    v_dep := v_scopes[v_si];
    continue when v_si = 2 and v_icu is null;
    for k in 1 .. 6 loop
      ms := (date_trunc('month', d0) - k * interval '1 month')::date;
      me := (ms + interval '1 month - 1 day')::date;

      -- the same sources private.indicator_metric_snapshot reads
      v_daily := (select count(*) from public.patient_days pd where pd.organization_id = v_org and pd.census_date between ms and me and (v_dep is null or pd.department_id = v_dep));
      v_pd := case when v_daily > 0
        then (select coalesce(sum(pd.patient_days), 0) from public.patient_days pd where pd.organization_id = v_org and pd.census_date between ms and me and (v_dep is null or pd.department_id = v_dep))
        else (select coalesce(sum(pp.patient_days), 0) from public.patient_day_periods pp where pp.organization_id = v_org and pp.period_start >= ms and pp.period_end <= me and (v_dep is null or pp.department_id = v_dep)) end;
      v_active := (select count(*) from public.surveillance_cases s where s.organization_id = v_org and s.voided_at is null and s.started_at::date <= me
        and (s.closed_at is null or s.closed_at::date >= ms) and (v_dep is null or s.department_id = v_dep));
      v_hh_ok := (select coalesce(sum(h.compliant_observations), 0) from public.hand_hygiene_sessions h where h.organization_id = v_org and h.status = 'completed' and h.observation_date between ms and me and (v_dep is null or h.department_id = v_dep));
      v_hh_tot := (select coalesce(sum(h.observations), 0) from public.hand_hygiene_sessions h where h.organization_id = v_org and h.status = 'completed' and h.observation_date between ms and me and (v_dep is null or h.department_id = v_dep));
      v_b_ok := (select count(*) from public.prevention_bundle_assessments b where b.organization_id = v_org and b.status = 'completed' and b.assessment_date between ms and me and b.score >= 100 and (v_dep is null or b.department_id = v_dep));
      v_b_tot := (select count(*) from public.prevention_bundle_assessments b where b.organization_id = v_org and b.status = 'completed' and b.assessment_date between ms and me and (v_dep is null or b.department_id = v_dep));
      v_abhr := (select coalesce(sum(a.litres), 0) from public.antiseptic_consumption_periods a where a.organization_id = v_org and a.period_start >= ms and a.period_end <= me and (v_dep is null or a.department_id = v_dep));
      v_tr_ok := (select count(*) from public.training_assignments t where t.organization_id = v_org and t.status = 'completed'
        and coalesce(t.assigned_date, t.created_at::date) between ms and me and (v_dep is null or t.department_id = v_dep));
      v_tr_tot := (select count(*) from public.training_assignments t where t.organization_id = v_org
        and coalesce(t.assigned_date, t.created_at::date) between ms and me and (v_dep is null or t.department_id = v_dep));
      v_mdro := (select count(distinct m.id) from public.microbiology_results m join public.laboratory_samples l on l.id = m.sample_id
        where m.organization_id = v_org and m.result_status = 'positive' and l.collected_at::date between ms and me and (v_dep is null or l.department_id = v_dep)
          and lower(coalesce(l.sample_type, '')) like '%blood%'
          and (upper(coalesce(m.resistance_class, '')) in ('MDR', 'XDR', 'PDR') or exists (select 1 from public.amr_classifications a where a.organization_id = v_org and a.microbiology_result_id = m.id and a.status <> 'rejected' and upper(coalesce(a.classification, '')) in ('MDR', 'XDR', 'PDR'))));
      v_bact := (select count(distinct m.id) from public.microbiology_results m join public.laboratory_samples l on l.id = m.sample_id
        where m.organization_id = v_org and m.result_status = 'positive' and m.validation_status in ('validated', 'amended') and m.organism is not null
          and l.collected_at::date between ms and me and (v_dep is null or l.department_id = v_dep) and lower(coalesce(l.sample_type, '')) like '%blood%'
          and lower(m.organism) ~ '(escherichia coli|proteus|acinetobacter|klebsiella|enterobacter|pseudomonas|staphylococcus aureus|enterococcus)'
          and not exists (select 1 from public.microbiology_results m2 where m2.organization_id = m.organization_id and m2.amended_from = m.id));
      v_kl_t := (select count(*) from public.antimicrobial_susceptibility_results a join public.microbiology_results m on m.id = a.microbiology_result_id and m.organization_id = a.organization_id
        join public.laboratory_samples l on l.id = m.sample_id
        where a.organization_id = v_org and m.result_status = 'positive' and m.validation_status in ('validated', 'amended') and l.collected_at::date between ms and me
          and (v_dep is null or l.department_id = v_dep) and lower(coalesce(a.organism, '')) like '%klebsiella%' and (a.antimicrobial_code = 'ABX-MEM' or lower(coalesce(a.antimicrobial_name, '')) like '%meropenem%')
          and not exists (select 1 from public.microbiology_results m2 where m2.organization_id = m.organization_id and m2.amended_from = m.id));
      v_kl_r := (select count(*) from public.antimicrobial_susceptibility_results a join public.microbiology_results m on m.id = a.microbiology_result_id and m.organization_id = a.organization_id
        join public.laboratory_samples l on l.id = m.sample_id
        where a.organization_id = v_org and m.result_status = 'positive' and m.validation_status in ('validated', 'amended') and l.collected_at::date between ms and me
          and (v_dep is null or l.department_id = v_dep) and lower(coalesce(a.organism, '')) like '%klebsiella%' and (a.antimicrobial_code = 'ABX-MEM' or lower(coalesce(a.antimicrobial_name, '')) like '%meropenem%')
          and a.sir_category = 'R'
          and not exists (select 1 from public.microbiology_results m2 where m2.organization_id = m.organization_id and m2.amended_from = m.id));
      v_ddd := (select coalesce(sum(d.quantity_grams / nullif((select r.ddd_grams from public.who_ddd_reference r
                    where r.antibiotic_code = lib.code and (r.organization_id = d.organization_id or r.organization_id is null)
                    order by r.organization_id nulls last limit 1), 0)), 0)
        from public.antibiotic_dispensing_periods d join public.master_library_items lib on lib.id = d.antibiotic_item_id
        where d.organization_id = v_org and d.period_start >= ms and d.period_end <= me and (v_dep is null or d.department_id = v_dep));
      v_iso := (select count(distinct ie.id) from public.isolation_episodes ie
        join public.surveillance_cases s on s.id = ie.surveillance_case_id and s.organization_id = ie.organization_id
        join public.laboratory_samples l on l.surveillance_case_id = s.id and l.organization_id = s.organization_id
        join public.microbiology_results m on m.sample_id = l.id and m.organization_id = s.organization_id
        where ie.organization_id = v_org and s.voided_at is null and ie.started_at::date between ms and me and (v_dep is null or ie.department_id = v_dep)
          and m.result_status = 'positive' and m.validation_status in ('validated', 'amended')
          and lower(coalesce(m.organism, '')) ~ '(escherichia coli|proteus|acinetobacter|klebsiella|enterobacter|pseudomonas|staphylococcus aureus|enterococcus)'
          and not exists (select 1 from public.microbiology_results m2 where m2.organization_id = m.organization_id and m2.amended_from = m.id)
          and (upper(coalesce(m.resistance_class, '')) in ('MDR', 'XDR', 'PDR') or exists (select 1 from public.amr_classifications am where am.organization_id = m.organization_id and am.microbiology_result_id = m.id and am.status <> 'rejected' and upper(coalesce(am.classification, '')) in ('MDR', 'XDR', 'PDR'))));
      v_pps_t := (select coalesce(sum(p.patients_total), 0) from public.point_prevalence_surveys p where p.organization_id = v_org and p.survey_date between ms and me and (v_dep is null or p.department_id = v_dep));
      v_pps_h := (select coalesce(sum(p.patients_with_hai), 0) from public.point_prevalence_surveys p where p.organization_id = v_org and p.survey_date between ms and me and (v_dep is null or p.department_id = v_dep));
      v_pps_a := (select coalesce(sum(p.patients_on_antibiotics), 0) from public.point_prevalence_surveys p where p.organization_id = v_org and p.survey_date between ms and me and (v_dep is null or p.department_id = v_dep));

      insert into public.indicator_snapshots(organization_id, indicator_key, definition_id, department_id, period_start, period_end, numerator, denominator, value,
        unit, target_value, direction, calculation_type, source_snapshot, status, calculated_at, calculated_by, reviewed_at, reviewed_by, notes, created_at, updated_at)
      select v_org, x.key, def.id, v_dep, ms, me, x.num, x.den,
        case when x.den is null then round(x.num * def.multiplier, 1)
             when def.calculation_type = 'manual' and def.unit = '%' then round(x.num / x.den * 100, 1)
             else round(x.num / x.den * def.multiplier, 1) end,
        def.unit, def.target_value, def.direction, def.calculation_type,
        jsonb_build_object('source', coalesce(def.source_authority, ''), 'version', def.version,
          'evidence', case when def.calculation_type = 'manual' then 'manual' when x.den is null then trim(trailing '.' from to_char(x.num, 'FM999999990.##'))
            else trim(trailing '.' from to_char(x.num, 'FM999999990.##')) || ' / ' || trim(trailing '.' from to_char(x.den, 'FM999999990.##')) end,
          'numerator_definition', def.numerator_definition, 'denominator_definition', def.denominator_definition),
        case when k = 1 then 'calculated' else 'approved' end,
        least(me + 3 + time '10:00', now() - interval '1 hour'), p_actor,
        case when k = 1 then null else least(me + 9 + time '13:00', now() - interval '1 hour') end,
        case when k = 1 then null else p_actor end,
        case when x.syn then 'Ιστορική τιμή — μεταφορά από το προηγούμενο σύστημα καταγραφής.'
             when k = 1 then null
             else 'Εγκρίθηκε στη μηνιαία συνεδρίαση της ΕΝΛ.' end,
        least(me + 3 + time '10:00', now() - interval '1 hour'), least(me + 9 + time '13:00', now() - interval '1 hour')
      from (values
        ('hh-compliance', case when v_hh_tot > 0 then v_hh_ok else case when v_dep is null then syn_hh_ok[k] else syn_hh_icu[k] end end,
                          case when v_hh_tot > 0 then v_hh_tot else case when v_dep is null then 210 else 60 end end, v_hh_tot = 0),
        ('bundle-compliance', case when v_b_tot > 0 then v_b_ok else round(syn_b_ok[k] / case when v_dep is null then 1 else 3 end) end,
                              case when v_b_tot > 0 then v_b_tot else case when v_dep is null then 21 else 7 end end, v_b_tot = 0),
        ('hai-per-1000', case when k <= 2 or v_active > 0 then v_active else round(syn_active[k] / case when v_dep is null then 1 else 3 end) end, nullif(v_pd, 0), not (k <= 2 or v_active > 0)),
        ('mdro-bsi-rate', case when k <= 2 or v_mdro > 0 then v_mdro else round(syn_mdro[k] / case when v_dep is null then 1 else 2 end) end, nullif(v_pd, 0), not (k <= 2 or v_mdro > 0)),
        ('bacteremia-incidence-rate', case when k <= 2 or v_bact > 0 then v_bact else round(syn_bact[k] / case when v_dep is null then 1 else 2 end) end, nullif(v_pd, 0), not (k <= 2 or v_bact > 0)),
        ('mdr-isolation-new-cases', case when k <= 2 or v_iso > 0 then v_iso else round(syn_iso[k] / case when v_dep is null then 1 else 2 end) end, null, not (k <= 2 or v_iso > 0)),
        ('training-completion', case when v_tr_tot > 0 then v_tr_ok else syn_tr[k] end, case when v_tr_tot > 0 then v_tr_tot else 24 end, v_tr_tot = 0),
        ('abhr-use', v_abhr, case when v_abhr > 0 then nullif(v_pd, 0) end, false),
        ('antibiotic-ddd-per-100-patient-days', round(v_ddd, 1), case when v_ddd > 0 then nullif(v_pd, 0) end, false),
        ('amr-klebsiella-meropenem-rate', case when v_kl_t > 0 then v_kl_r else syn_kl_r[k] end, case when v_kl_t > 0 then v_kl_t when k >= 3 then 3 end, v_kl_t = 0),
        ('hai-prevalence-pps', v_pps_h, nullif(v_pps_t, 0), false),
        ('antibiotic-use-prevalence-pps', v_pps_a, nullif(v_pps_t, 0), false),
        ('eody-reporting-completeness', m_eody_n[k], m_eody_d[k], false),
        ('clabsi-per-1000-cvc-days', m_clabsi_n[k], case when v_dep is null then m_clabsi_all_d[k] else m_clabsi_icu_d[k] end, false),
        ('vap-per-1000-ventilator-days', m_vap_n[k], m_vap_d[k], false)
      ) x(key, num, den, syn)
      cross join lateral (
        select d.* from public.indicator_definitions d
        where d.indicator_key = x.key and (d.organization_id = v_org or d.organization_id is null) and d.status = 'active'
        order by d.organization_id nulls last limit 1
      ) def
      where x.num is not null
        and (def.calculation_type = 'manual' or def.denominator_metric is null or x.den is not null)
        and (v_dep is null or x.key in ('hh-compliance', 'bundle-compliance', 'hai-per-1000', 'mdr-isolation-new-cases', 'clabsi-per-1000-cvc-days', 'vap-per-1000-ventilator-days'));
    end loop;
  end loop;

  -- Manual values for the current month so far (the default period of the
  -- Indicators screen is "first of the month → today"), waiting for approval.
  insert into public.indicator_snapshots(organization_id, indicator_key, definition_id, department_id, period_start, period_end, numerator, denominator, value,
    unit, target_value, direction, calculation_type, source_snapshot, status, calculated_at, calculated_by, notes)
  select v_org, x.key, def.id, null, date_trunc('month', d0)::date, d0, null, null, x.val, def.unit, def.target_value, def.direction, 'manual',
    jsonb_build_object('source', coalesce(def.source_authority, ''), 'version', def.version, 'evidence', 'manual',
      'numerator_definition', def.numerator_definition, 'denominator_definition', def.denominator_definition),
    'calculated', now() - interval '2 hours', p_actor, x.note
  from (values
    ('eody-reporting-completeness', 66.7::numeric, '2 από 3 δηλώσεις του μήνα έχουν υποβληθεί· εκκρεμεί η δήλωση του νέου στελέχους KPC της ΜΕΘ.'),
    ('clabsi-per-1000-cvc-days', 9.4::numeric, '1 CLABSI σε 106 ημέρες ΚΦΚ (μέχρι σήμερα) — σχετίζεται με τη συρροή KPC της ΜΕΘ.')
  ) x(key, val, note)
  cross join lateral (
    select d.* from public.indicator_definitions d
    where d.indicator_key = x.key and (d.organization_id = v_org or d.organization_id is null) and d.status = 'active'
    order by d.organization_id nulls last limit 1
  ) def;
end;
$function$;
revoke all on function private.demo_seed_quality_indicators(uuid, uuid) from public, anon, authenticated;

-- Demo orchestrator: the counts it returns read the new tables.
create or replace function private.demo_seed_data(p_organization_id uuid, p_actor uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
begin
  if p_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organizations o where o.id = v_org and o.is_demo) then
    raise exception 'Only Demo organizations can be filled with Demo data' using errcode = '42501';
  end if;
  perform set_config('limoxis.test_reset', 'on', true);
  perform private.demo_seed_departments_patients(v_org, p_actor);
  perform private.demo_seed_surveillance(v_org, p_actor);
  perform private.demo_seed_laboratory(v_org, p_actor);
  perform private.demo_seed_microbiology(v_org, p_actor);
  perform private.demo_seed_susceptibility(v_org, p_actor);
  perform private.demo_seed_hand_hygiene_employees(v_org, p_actor);
  perform private.demo_seed_patient_days(v_org, p_actor);
  perform private.demo_seed_incidents(v_org, p_actor);
  perform private.demo_seed_capa(v_org, p_actor);
  perform private.demo_seed_documents(v_org, p_actor);
  perform private.demo_seed_committees(v_org, p_actor);
  perform private.demo_seed_controls(v_org, p_actor);
  perform private.demo_seed_training(v_org, p_actor);
  perform private.demo_seed_pharmacy(v_org, p_actor);
  perform private.demo_seed_occupational_health(v_org, p_actor);
  perform private.demo_seed_prevention(v_org, p_actor);
  -- Full, coherent data in every screen (20261018120000).
  perform private.demo_seed_clinical(v_org, p_actor);
  perform private.demo_seed_current_month(v_org, p_actor);
  perform private.demo_seed_quality(v_org, p_actor);
  perform private.demo_seed_people_clinical_scales(v_org, p_actor);
  perform private.demo_seed_people_training(v_org, p_actor);
  perform private.demo_seed_people_employees(v_org, p_actor);
  perform private.demo_seed_people_occupational_health(v_org, p_actor);
  perform private.demo_seed_governance(v_org, p_actor);
  return jsonb_build_object(
    'ok', true,
    'departments', (select count(*) from public.departments x where x.organization_id = v_org),
    'patients', (select count(*) from public.patients x where x.organization_id = v_org),
    'surveillanceCases', (select count(*) from public.surveillance_cases x where x.organization_id = v_org),
    'laboratorySamples', (select count(*) from public.laboratory_samples x where x.organization_id = v_org),
    'microbiologyResults', (select count(*) from public.microbiology_results x where x.organization_id = v_org),
    'handHygieneSessions', (select count(*) from public.hand_hygiene_sessions x where x.organization_id = v_org),
    'employees', (select count(*) from public.employees x where x.organization_id = v_org),
    'incidents', (select count(*) from public.quality_incidents x where x.organization_id = v_org),
    'capa', (select count(*) from public.quality_capa_actions x where x.organization_id = v_org),
    'documents', (select count(*) from public.controlled_documents x where x.organization_id = v_org),
    'committees', (select count(*) from public.committees x where x.organization_id = v_org),
    'controls', (select count(*) from public.control_definitions x where x.organization_id = v_org),
    'controlExecutions', (select count(*) from public.control_executions x where x.organization_id = v_org),
    'trainingPrograms', (select count(*) from public.training_programs x where x.organization_id = v_org),
    'trainingAssignments', (select count(*) from public.training_assignments x where x.organization_id = v_org),
    'antibioticDispensing', (select count(*) from public.antibiotic_dispensing_periods x where x.organization_id = v_org),
    'vaccinations', (select count(*) from public.employee_vaccinations x where x.organization_id = v_org),
    'occupationalVisits', (select count(*) from public.occupational_health_visits x where x.organization_id = v_org),
    'exposures', (select count(*) from public.occupational_exposure_incidents x where x.organization_id = v_org),
    'wasteRecords', (select count(*) from public.waste_measurements x where x.organization_id = v_org),
    'antisepticRecords', (select count(*) from public.antiseptic_consumption_periods x where x.organization_id = v_org),
    'bundleAudits', (select count(*) from public.prevention_bundle_assessments x where x.organization_id = v_org)
  );
end;
$function$;
revoke all on function private.demo_seed_data(uuid, uuid) from public, anon, authenticated;


-- 11. Demo seeds against the new tables ----------------------------------------
-- Same Demo content as 20261011120000 + 20261018120000: five programmes, two
-- requirements, the assignments (linked to employees by the identity
-- trigger), certificates, then the people pack (answers, trainer evaluations,
-- reviews, material, questions, effectiveness, history).

create or replace function private.demo_seed_training(p_organization_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
  d0 date := current_date;
begin
  insert into public.training_programs(organization_id, program_key, title, category, method, status, owner, trainer, audience,
    start_date, due_date, valid_months, requires_assessment, pass_score, description, created_by, updated_by)
  select v_org, p.id, p.title, p.category, p.method, p.status, 'Ομάδα Ελέγχου Λοιμώξεων', p.trainer, p.audience,
    d0 + p.start_offset, d0 + p.start_offset + 60, p.valid_months, true, 80, p.descr, p_actor, p_actor
  from (values
    ('TRN-DEMO-001', 'Υγιεινή των χεριών – 5 στιγμές ΠΟΥ', 'ipc', 'in_person', 'active', 'Νοσηλεύτρια Επιτήρησης Λοιμώξεων', 'Όλο το κλινικό προσωπικό', -120, 12, 'Πρακτική εκπαίδευση στις 5 στιγμές και στην τεχνική αντισηψίας χεριών.'),
    ('TRN-DEMO-002', 'Ατομικός προστατευτικός εξοπλισμός (ΑΠΕ)', 'ipc', 'on_the_job', 'active', 'Νοσηλεύτρια Επιτήρησης Λοιμώξεων', 'Νοσηλευτικό προσωπικό', -90, 24, 'Ένδυση και αφαίρεση ΑΠΕ, προφυλάξεις επαφής, σταγονιδίων και αερογενούς μετάδοσης.'),
    ('TRN-DEMO-003', 'Bundle πρόληψης CLABSI', 'clinical', 'hybrid', 'active', 'Διευθυντής ΜΕΘ', 'Προσωπικό ΜΕΘ και χειρουργείων', -60, 24, 'Τοποθέτηση και φροντίδα κεντρικών φλεβικών καθετήρων σύμφωνα με το bundle.'),
    ('TRN-DEMO-004', 'Διαχείριση νοσοκομειακών αποβλήτων', 'mandatory', 'online', 'active', 'Υπεύθυνος Περιβαλλοντικής Υγιεινής', 'Όλο το προσωπικό', -150, 36, 'Διαλογή, συσκευασία και μεταφορά ΕΑΑ/ΜΑ.'),
    ('TRN-DEMO-005', 'Ασφαλής χρήση αιχμηρών και PEP', 'occupational_health', 'in_person', 'planned', 'Ιατρός Εργασίας', 'Νοσηλευτικό και ιατρικό προσωπικό', 21, 24, 'Πρόληψη τρυπημάτων από βελόνες και διαδικασία μετά από έκθεση.')
  ) p(id, title, category, method, status, trainer, audience, start_offset, valid_months, descr);

  insert into public.training_requirements(organization_id, requirement_key, title, renewal_months, active, created_by, updated_by)
  select v_org, r.id, r.title, r.renewal, true, p_actor, p_actor
  from (values
    ('REQ-DEMO-001', 'Ετήσια εκπαίδευση υγιεινής χεριών', 12),
    ('REQ-DEMO-002', 'ΑΠΕ για νοσηλευτικό προσωπικό', 24)
  ) r(id, title, renewal);
  insert into public.training_requirement_programs(requirement_id, program_id, organization_id, position, created_by, updated_by)
  select r.id, p.id, v_org, 1, p_actor, p_actor
  from (values ('REQ-DEMO-001', 'TRN-DEMO-001'), ('REQ-DEMO-002', 'TRN-DEMO-002')) x(requirement_key, program_key)
  join public.training_requirements r on r.organization_id = v_org and r.requirement_key = x.requirement_key
  join public.training_programs p on p.organization_id = v_org and p.program_key = x.program_key;
  insert into public.training_requirement_targets(organization_id, requirement_id, target_kind, value, position, created_by, updated_by)
  select v_org, r.id, 'profession', 'Νοσηλευτής / Νοσηλεύτρια', 1, p_actor, p_actor
  from public.training_requirements r
  where r.organization_id = v_org and r.requirement_key = 'REQ-DEMO-002';

  -- Assignments (the identity trigger links each one to its employee)
  insert into public.training_assignments(organization_id, assignment_key, program_id, employee_code, employee_name, department_name, email,
    assigned_date, due_date, status, invitation_sent_at, attendance_response, completion_confirmed_at, score, competent, completed_date, created_by, updated_by)
  select v_org, 'TRA-DEMO-' || p || '-' || lpad(g::text, 3, '0'), pr.id, e.employee_code, e.last_name || ' ' || e.first_name, e.department_name, e.email,
    d0 - (150 - p * 30), d0 - (120 - p * 30) + g, st.status, (d0 - (150 - p * 30))::timestamp at time zone 'UTC', 'not_sent',
    case when st.status = 'completed' then (d0 - (145 - p * 30) + g % 9)::timestamp at time zone 'UTC' end,
    case when st.status = 'completed' then st.score end,
    case when st.status = 'completed' then st.score >= 80 end,
    case when st.status = 'completed' then d0 - (145 - p * 30) + g % 9 end,
    p_actor, p_actor
  from generate_series(1, 4) p
  cross join generate_series(1, 24) g
  join public.training_programs pr on pr.organization_id = v_org and pr.program_key = 'TRN-DEMO-00' || p
  join public.employees e on e.organization_id = v_org and e.employee_code = 'EMP-' || lpad(g::text, 3, '0')
  -- Older programs are mostly done; the most recent one is still in progress.
  cross join lateral (select case when p = 4 then (array['assigned', 'in_progress', 'completed'])[1 + g % 3]
                                  when (g + p * 3) % 9 = 0 then 'in_progress' else 'completed' end status,
                             70 + (g * 7 + p * 3) % 31 score) st
  where (g + p) % 4 <> 0;

  insert into public.training_certificates(organization_id, certificate_key, assignment_id, employee_code, title, issued_date, valid_until, issuer,
    department_id, employee_user_id, created_by, updated_by)
  select v_org, 'CRT-DEMO-' || substr(a.assignment_key, 10), a.id, a.employee_code, pr.title, a.completed_date,
    (a.completed_date + make_interval(months => pr.valid_months))::date, 'Επιτροπή Νοσοκομειακών Λοιμώξεων', a.department_id, a.employee_user_id, p_actor, p_actor
  from public.training_assignments a
  join public.training_programs pr on pr.id = a.program_id
  where a.organization_id = v_org and a.status = 'completed' and a.competent;
end;
$function$;

create or replace function private.demo_seed_people_training(p_organization_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
  d0 date := current_date;
  v_comments text[] := array['Πολύ πρακτική παρουσίαση.', '', 'Χρήσιμη η επίδειξη στο ομοίωμα.', 'Θα βοηθούσε ένα σύντομο βίντεο.', '',
    'Σαφείς οδηγίες, εφαρμόσιμες στο τμήμα.', 'Χρειάζομαι περισσότερη εξάσκηση.', ''];
begin
  -- The trainer evaluation questionnaire new programmes copy.
  insert into public.training_feedback_templates(organization_id, template_key, title_el, title_en, created_by, updated_by)
  values (v_org, 'TRAINER-FEEDBACK-DEFAULT', 'Αξιολόγηση εκπαιδευτή', 'Trainer evaluation', p_actor, p_actor)
  on conflict (organization_id, template_key) do nothing;
  insert into public.training_feedback_template_questions(organization_id, template_id, question_key, position, label_el, label_en, created_by, updated_by)
  select v_org, t.id, q.key, q.pos, q.label_el, q.label_en, p_actor, p_actor
  from public.training_feedback_templates t
  cross join (values
      ('clarity', 1, 'Σαφήνεια παρουσίασης', 'Clarity of presentation'),
      ('knowledge', 2, 'Γνώση και επάρκεια εκπαιδευτή', 'Trainer knowledge and competence'),
      ('usefulness', 3, 'Χρησιμότητα για την εργασία μου', 'Usefulness for my work'),
      ('organization', 4, 'Οργάνωση της εκπαίδευσης', 'Organization of the training'),
      ('materials', 5, 'Ποιότητα εκπαιδευτικού υλικού', 'Quality of training material')
  ) q(key, pos, label_el, label_en)
  where t.organization_id = v_org and t.template_key = 'TRAINER-FEEDBACK-DEFAULT'
  on conflict (template_id, question_key) do nothing;

  -- Participants of the planned programme (sharps / PEP): invitations not sent yet.
  insert into public.training_assignments(organization_id, assignment_key, program_id, employee_code, employee_name, department_name, email,
    assigned_date, due_date, status, attendance_response, created_by, updated_by)
  select v_org, 'TRA-DEMO-5-' || lpad(n.g::text, 3, '0'), pr.id, e.employee_code, e.last_name || ' ' || e.first_name, e.department_name, e.email,
    d0 - 3, d0 + 60, 'assigned', 'not_sent', p_actor, p_actor
  from public.employees e
  cross join lateral (select substring(e.employee_code from 5)::int g) n
  join public.training_programs pr on pr.organization_id = v_org and pr.program_key = 'TRN-DEMO-005'
  where e.organization_id = v_org and e.employee_code like 'EMP-%' and e.user_id is null
    and e.profession_name in ('Νοσηλευτής / Νοσηλεύτρια', 'Ιατρός') and n.g % 3 <> 0
  on conflict (organization_id, assignment_key) do nothing;

  -- Assignments: the app's attendance values, the learner's answers (the score
  -- follows from them, on the same side of the pass mark as before), the
  -- trainer evaluation, and the owner's review for the older programmes.
  with cand(program_id, score, answers) as (values
    ('TRN-DEMO-001', 100, '{"Q-001":"Q-001-O2","Q-002":false,"Q-003":["Q-003-O1","Q-003-O2","Q-003-O4"],"Q-004":"Q-004-O2","Q-005":true,"Q-006":"Q-006-O3","Q-007":"Όταν μετακινούμαι από μολυσμένη σε καθαρή περιοχή του σώματος του ίδιου ασθενούς."}'::jsonb),
    ('TRN-DEMO-001', 80, '{"Q-001":"Q-001-O1","Q-002":false,"Q-003":["Q-003-O1","Q-003-O2","Q-003-O4"],"Q-004":"Q-004-O2","Q-005":true,"Q-006":"Q-006-O3","Q-007":"Όταν μετακινούμαι από μολυσμένη σε καθαρή περιοχή του σώματος του ίδιου ασθενούς."}'::jsonb),
    ('TRN-DEMO-001', 60, '{"Q-001":"Q-001-O1","Q-002":true,"Q-003":["Q-003-O1","Q-003-O2","Q-003-O4"],"Q-004":"Q-004-O2","Q-005":true,"Q-006":"Q-006-O3","Q-007":"Όταν μετακινούμαι από μολυσμένη σε καθαρή περιοχή του σώματος του ίδιου ασθενούς."}'::jsonb),
    ('TRN-DEMO-001', 40, '{"Q-001":"Q-001-O1","Q-002":true,"Q-003":["Q-003-O3"],"Q-004":"Q-004-O2","Q-005":true,"Q-006":"Q-006-O3","Q-007":"Όταν μετακινούμαι από μολυσμένη σε καθαρή περιοχή του σώματος του ίδιου ασθενούς."}'::jsonb),
    ('TRN-DEMO-001', 88, '{"Q-001":"Q-001-O2","Q-002":false,"Q-003":["Q-003-O1","Q-003-O2","Q-003-O4"],"Q-004":"Q-004-O2","Q-005":false,"Q-006":"Q-006-O3","Q-007":"Όταν μετακινούμαι από μολυσμένη σε καθαρή περιοχή του σώματος του ίδιου ασθενούς."}'::jsonb),
    ('TRN-DEMO-001', 68, '{"Q-001":"Q-001-O1","Q-002":false,"Q-003":["Q-003-O1","Q-003-O2","Q-003-O4"],"Q-004":"Q-004-O2","Q-005":false,"Q-006":"Q-006-O3","Q-007":"Όταν μετακινούμαι από μολυσμένη σε καθαρή περιοχή του σώματος του ίδιου ασθενούς."}'::jsonb),
    ('TRN-DEMO-001', 48, '{"Q-001":"Q-001-O1","Q-002":true,"Q-003":["Q-003-O1","Q-003-O2","Q-003-O4"],"Q-004":"Q-004-O2","Q-005":false,"Q-006":"Q-006-O3","Q-007":"Όταν μετακινούμαι από μολυσμένη σε καθαρή περιοχή του σώματος του ίδιου ασθενούς."}'::jsonb),
    ('TRN-DEMO-001', 92, '{"Q-001":"Q-001-O2","Q-002":false,"Q-003":["Q-003-O1","Q-003-O2","Q-003-O4"],"Q-004":"Q-004-O2","Q-005":true,"Q-006":"Q-006-O1","Q-007":"Όταν μετακινούμαι από μολυσμένη σε καθαρή περιοχή του σώματος του ίδιου ασθενούς."}'::jsonb),
    ('TRN-DEMO-001', 72, '{"Q-001":"Q-001-O1","Q-002":false,"Q-003":["Q-003-O1","Q-003-O2","Q-003-O4"],"Q-004":"Q-004-O2","Q-005":true,"Q-006":"Q-006-O1","Q-007":"Όταν μετακινούμαι από μολυσμένη σε καθαρή περιοχή του σώματος του ίδιου ασθενούς."}'::jsonb),
    ('TRN-DEMO-001', 52, '{"Q-001":"Q-001-O1","Q-002":true,"Q-003":["Q-003-O1","Q-003-O2","Q-003-O4"],"Q-004":"Q-004-O2","Q-005":true,"Q-006":"Q-006-O1","Q-007":"Όταν μετακινούμαι από μολυσμένη σε καθαρή περιοχή του σώματος του ίδιου ασθενούς."}'::jsonb),
    ('TRN-DEMO-002', 100, '{"Q-101":"Q-101-O2","Q-102":true,"Q-103":["Q-103-O1","Q-103-O2","Q-103-O4"],"Q-104":false,"Q-105":"Αναδιπλώνεται με τη μολυσμένη πλευρά προς τα μέσα, χωρίς επαφή με τη στολή."}'::jsonb),
    ('TRN-DEMO-002', 70, '{"Q-101":"Q-101-O1","Q-102":true,"Q-103":["Q-103-O1","Q-103-O2","Q-103-O4"],"Q-104":false,"Q-105":"Αναδιπλώνεται με τη μολυσμένη πλευρά προς τα μέσα, χωρίς επαφή με τη στολή."}'::jsonb),
    ('TRN-DEMO-002', 80, '{"Q-101":"Q-101-O2","Q-102":false,"Q-103":["Q-103-O1","Q-103-O2","Q-103-O4"],"Q-104":false,"Q-105":"Αναδιπλώνεται με τη μολυσμένη πλευρά προς τα μέσα, χωρίς επαφή με τη στολή."}'::jsonb),
    ('TRN-DEMO-002', 50, '{"Q-101":"Q-101-O1","Q-102":false,"Q-103":["Q-103-O1","Q-103-O2","Q-103-O4"],"Q-104":false,"Q-105":"Αναδιπλώνεται με τη μολυσμένη πλευρά προς τα μέσα, χωρίς επαφή με τη στολή."}'::jsonb),
    ('TRN-DEMO-002', 40, '{"Q-101":"Q-101-O1","Q-102":true,"Q-103":["Q-103-O3"],"Q-104":false,"Q-105":"Αναδιπλώνεται με τη μολυσμένη πλευρά προς τα μέσα, χωρίς επαφή με τη στολή."}'::jsonb),
    ('TRN-DEMO-002', 20, '{"Q-101":"Q-101-O1","Q-102":false,"Q-103":["Q-103-O3"],"Q-104":false,"Q-105":"Αναδιπλώνεται με τη μολυσμένη πλευρά προς τα μέσα, χωρίς επαφή με τη στολή."}'::jsonb),
    ('TRN-DEMO-002', 60, '{"Q-101":"Q-101-O2","Q-102":false,"Q-103":["Q-103-O1","Q-103-O2","Q-103-O4"],"Q-104":true,"Q-105":"Αναδιπλώνεται με τη μολυσμένη πλευρά προς τα μέσα, χωρίς επαφή με τη στολή."}'::jsonb),
    ('TRN-DEMO-002', 30, '{"Q-101":"Q-101-O1","Q-102":false,"Q-103":["Q-103-O1","Q-103-O2","Q-103-O4"],"Q-104":true,"Q-105":"Αναδιπλώνεται με τη μολυσμένη πλευρά προς τα μέσα, χωρίς επαφή με τη στολή."}'::jsonb),
    ('TRN-DEMO-003', 100, '{"Q-201":"Q-201-O2","Q-202":["Q-202-O1","Q-202-O2","Q-202-O3"],"Q-203":true,"Q-204":"Q-204-O3","Q-205":false,"Q-206":"Q-206-O2","Q-207":"Αλλάζω άμεσα το επίθεμα με άσηπτη τεχνική και καταγράφω την αλλαγή."}'::jsonb),
    ('TRN-DEMO-003', 80, '{"Q-201":"Q-201-O1","Q-202":["Q-202-O1","Q-202-O2","Q-202-O3"],"Q-203":true,"Q-204":"Q-204-O3","Q-205":false,"Q-206":"Q-206-O2","Q-207":"Αλλάζω άμεσα το επίθεμα με άσηπτη τεχνική και καταγράφω την αλλαγή."}'::jsonb),
    ('TRN-DEMO-003', 70, '{"Q-201":"Q-201-O2","Q-202":["Q-202-O4"],"Q-203":true,"Q-204":"Q-204-O3","Q-205":false,"Q-206":"Q-206-O2","Q-207":"Αλλάζω άμεσα το επίθεμα με άσηπτη τεχνική και καταγράφω την αλλαγή."}'::jsonb),
    ('TRN-DEMO-003', 50, '{"Q-201":"Q-201-O1","Q-202":["Q-202-O4"],"Q-203":true,"Q-204":"Q-204-O3","Q-205":false,"Q-206":"Q-206-O2","Q-207":"Αλλάζω άμεσα το επίθεμα με άσηπτη τεχνική και καταγράφω την αλλαγή."}'::jsonb),
    ('TRN-DEMO-003', 90, '{"Q-201":"Q-201-O2","Q-202":["Q-202-O1","Q-202-O2","Q-202-O3"],"Q-203":false,"Q-204":"Q-204-O3","Q-205":false,"Q-206":"Q-206-O2","Q-207":"Αλλάζω άμεσα το επίθεμα με άσηπτη τεχνική και καταγράφω την αλλαγή."}'::jsonb),
    ('TRN-DEMO-003', 60, '{"Q-201":"Q-201-O2","Q-202":["Q-202-O4"],"Q-203":false,"Q-204":"Q-204-O3","Q-205":false,"Q-206":"Q-206-O2","Q-207":"Αλλάζω άμεσα το επίθεμα με άσηπτη τεχνική και καταγράφω την αλλαγή."}'::jsonb),
    ('TRN-DEMO-003', 40, '{"Q-201":"Q-201-O1","Q-202":["Q-202-O4"],"Q-203":false,"Q-204":"Q-204-O3","Q-205":false,"Q-206":"Q-206-O2","Q-207":"Αλλάζω άμεσα το επίθεμα με άσηπτη τεχνική και καταγράφω την αλλαγή."}'::jsonb),
    ('TRN-DEMO-003', 30, '{"Q-201":"Q-201-O1","Q-202":["Q-202-O4"],"Q-203":true,"Q-204":"Q-204-O1","Q-205":false,"Q-206":"Q-206-O2","Q-207":"Αλλάζω άμεσα το επίθεμα με άσηπτη τεχνική και καταγράφω την αλλαγή."}'::jsonb),
    ('TRN-DEMO-004', 100, '{"Q-401":"Q-401-O2","Q-402":true,"Q-403":["Q-403-O1","Q-403-O3"],"Q-404":"Q-404-O1","Q-405":true,"Q-406":"Τον τοποθετώ σε δεύτερο σάκο, καθαρίζω και απολυμαίνω τον χώρο και ενημερώνω τον υπεύθυνο."}'::jsonb),
    ('TRN-DEMO-004', 75, '{"Q-401":"Q-401-O1","Q-402":true,"Q-403":["Q-403-O1","Q-403-O3"],"Q-404":"Q-404-O1","Q-405":true,"Q-406":"Τον τοποθετώ σε δεύτερο σάκο, καθαρίζω και απολυμαίνω τον χώρο και ενημερώνω τον υπεύθυνο."}'::jsonb),
    ('TRN-DEMO-004', 50, '{"Q-401":"Q-401-O1","Q-402":false,"Q-403":["Q-403-O1","Q-403-O3"],"Q-404":"Q-404-O1","Q-405":true,"Q-406":"Τον τοποθετώ σε δεύτερο σάκο, καθαρίζω και απολυμαίνω τον χώρο και ενημερώνω τον υπεύθυνο."}'::jsonb),
    ('TRN-DEMO-004', 25, '{"Q-401":"Q-401-O1","Q-402":false,"Q-403":["Q-403-O2"],"Q-404":"Q-404-O1","Q-405":true,"Q-406":"Τον τοποθετώ σε δεύτερο σάκο, καθαρίζω και απολυμαίνω τον χώρο και ενημερώνω τον υπεύθυνο."}'::jsonb),
    ('TRN-DEMO-004', 85, '{"Q-401":"Q-401-O2","Q-402":true,"Q-403":["Q-403-O1","Q-403-O3"],"Q-404":"Q-404-O2","Q-405":true,"Q-406":"Τον τοποθετώ σε δεύτερο σάκο, καθαρίζω και απολυμαίνω τον χώρο και ενημερώνω τον υπεύθυνο."}'::jsonb),
    ('TRN-DEMO-004', 60, '{"Q-401":"Q-401-O1","Q-402":true,"Q-403":["Q-403-O1","Q-403-O3"],"Q-404":"Q-404-O2","Q-405":true,"Q-406":"Τον τοποθετώ σε δεύτερο σάκο, καθαρίζω και απολυμαίνω τον χώρο και ενημερώνω τον υπεύθυνο."}'::jsonb),
    ('TRN-DEMO-004', 35, '{"Q-401":"Q-401-O1","Q-402":false,"Q-403":["Q-403-O1","Q-403-O3"],"Q-404":"Q-404-O2","Q-405":true,"Q-406":"Τον τοποθετώ σε δεύτερο σάκο, καθαρίζω και απολυμαίνω τον χώρο και ενημερώνω τον υπεύθυνο."}'::jsonb),
    ('TRN-DEMO-004', 90, '{"Q-401":"Q-401-O2","Q-402":true,"Q-403":["Q-403-O1","Q-403-O3"],"Q-404":"Q-404-O1","Q-405":false,"Q-406":"Τον τοποθετώ σε δεύτερο σάκο, καθαρίζω και απολυμαίνω τον χώρο και ενημερώνω τον υπεύθυνο."}'::jsonb),
    ('TRN-DEMO-004', 65, '{"Q-401":"Q-401-O1","Q-402":true,"Q-403":["Q-403-O1","Q-403-O3"],"Q-404":"Q-404-O1","Q-405":false,"Q-406":"Τον τοποθετώ σε δεύτερο σάκο, καθαρίζω και απολυμαίνω τον χώρο και ενημερώνω τον υπεύθυνο."}'::jsonb),
    ('TRN-DEMO-004', 40, '{"Q-401":"Q-401-O1","Q-402":false,"Q-403":["Q-403-O1","Q-403-O3"],"Q-404":"Q-404-O1","Q-405":false,"Q-406":"Τον τοποθετώ σε δεύτερο σάκο, καθαρίζω και απολυμαίνω τον χώρο και ενημερώνω τον υπεύθυνο."}'::jsonb),
    ('TRN-DEMO-005', 100, '{"Q-301":"Q-301-O2","Q-302":false,"Q-303":"Q-303-O2","Q-304":["Q-304-O1","Q-304-O2","Q-304-O4"],"Q-305":true,"Q-306":"Q-306-O2","Q-307":"Τον προϊστάμενο και το Ιατρείο Εργασίας, με καταγραφή του περιστατικού."}'::jsonb),
    ('TRN-DEMO-005', 80, '{"Q-301":"Q-301-O1","Q-302":false,"Q-303":"Q-303-O2","Q-304":["Q-304-O1","Q-304-O2","Q-304-O4"],"Q-305":true,"Q-306":"Q-306-O2","Q-307":"Τον προϊστάμενο και το Ιατρείο Εργασίας, με καταγραφή του περιστατικού."}'::jsonb),
    ('TRN-DEMO-005', 60, '{"Q-301":"Q-301-O1","Q-302":true,"Q-303":"Q-303-O2","Q-304":["Q-304-O1","Q-304-O2","Q-304-O4"],"Q-305":true,"Q-306":"Q-306-O2","Q-307":"Τον προϊστάμενο και το Ιατρείο Εργασίας, με καταγραφή του περιστατικού."}'::jsonb),
    ('TRN-DEMO-005', 40, '{"Q-301":"Q-301-O1","Q-302":true,"Q-303":"Q-303-O1","Q-304":["Q-304-O1","Q-304-O2","Q-304-O4"],"Q-305":true,"Q-306":"Q-306-O2","Q-307":"Τον προϊστάμενο και το Ιατρείο Εργασίας, με καταγραφή του περιστατικού."}'::jsonb),
    ('TRN-DEMO-005', 92, '{"Q-301":"Q-301-O2","Q-302":false,"Q-303":"Q-303-O2","Q-304":["Q-304-O1","Q-304-O2","Q-304-O4"],"Q-305":false,"Q-306":"Q-306-O2","Q-307":"Τον προϊστάμενο και το Ιατρείο Εργασίας, με καταγραφή του περιστατικού."}'::jsonb),
    ('TRN-DEMO-005', 72, '{"Q-301":"Q-301-O1","Q-302":false,"Q-303":"Q-303-O2","Q-304":["Q-304-O1","Q-304-O2","Q-304-O4"],"Q-305":false,"Q-306":"Q-306-O2","Q-307":"Τον προϊστάμενο και το Ιατρείο Εργασίας, με καταγραφή του περιστατικού."}'::jsonb),
    ('TRN-DEMO-005', 52, '{"Q-301":"Q-301-O1","Q-302":true,"Q-303":"Q-303-O2","Q-304":["Q-304-O1","Q-304-O2","Q-304-O4"],"Q-305":false,"Q-306":"Q-306-O2","Q-307":"Τον προϊστάμενο και το Ιατρείο Εργασίας, με καταγραφή του περιστατικού."}'::jsonb),
    ('TRN-DEMO-005', 88, '{"Q-301":"Q-301-O2","Q-302":false,"Q-303":"Q-303-O2","Q-304":["Q-304-O1","Q-304-O2","Q-304-O4"],"Q-305":true,"Q-306":"Q-306-O1","Q-307":"Τον προϊστάμενο και το Ιατρείο Εργασίας, με καταγραφή του περιστατικού."}'::jsonb),
    ('TRN-DEMO-005', 68, '{"Q-301":"Q-301-O1","Q-302":false,"Q-303":"Q-303-O2","Q-304":["Q-304-O1","Q-304-O2","Q-304-O4"],"Q-305":true,"Q-306":"Q-306-O1","Q-307":"Τον προϊστάμενο και το Ιατρείο Εργασίας, με καταγραφή του περιστατικού."}'::jsonb),
    ('TRN-DEMO-005', 48, '{"Q-301":"Q-301-O1","Q-302":true,"Q-303":"Q-303-O2","Q-304":["Q-304-O1","Q-304-O2","Q-304-O4"],"Q-305":true,"Q-306":"Q-306-O1","Q-307":"Τον προϊστάμενο και το Ιατρείο Εργασίας, με καταγραφή του περιστατικού."}'::jsonb)
  ), a as (
    select ta.id, ta.organization_id, ta.program_id, ta.employee_code, ta.status st, ta.score old_score, ta.assigned_date assigned, ta.completed_date done,
      pr.program_key, split_part(ta.assignment_key, '-', 3)::int pn, split_part(ta.assignment_key, '-', 4)::int g
    from public.training_assignments ta
    join public.training_programs pr on pr.id = ta.program_id
    where ta.organization_id = v_org and ta.assignment_key like 'TRA-DEMO-_-___' and pr.program_key <> 'TRN-DEMO-005'
  ), x as (
    select a.*, case when a.st in ('completed', 'in_progress') then 'confirmed' when a.g % 2 = 0 then 'sent' else 'not_sent' end resp,
      c.score new_score, c.answers
    from a
    left join lateral (select cd.score, cd.answers from cand cd
                       where cd.program_id = a.program_key and a.old_score is not null
                       order by ((cd.score >= 80) <> (a.old_score >= 80)), abs(cd.score - a.old_score), cd.score desc
                       limit 1) c on true
  ), upd as (
    update public.training_assignments ta
    set attendance_response = x.resp,
      attendance = case when x.resp = 'confirmed' then true end,
      invitation_sent_at = case when x.resp = 'not_sent' then null else (x.assigned + time '09:00') at time zone 'UTC' end,
      attendance_confirmed_at = case when x.resp = 'confirmed' then (coalesce(x.done, x.assigned + 4) + time '08:55') at time zone 'UTC' end,
      completion_confirmed_at = case when x.st = 'completed' then (x.done + time '10:40') at time zone 'UTC' end,
      feedback_submitted_at = case when x.st = 'completed' then (x.done + time '10:42') at time zone 'UTC' end,
      assessment_submitted_at = case when x.st = 'completed' then (x.done + time '10:45') at time zone 'UTC' end,
      score = case when x.st = 'completed' then x.new_score end,
      assessment_reviewed_at = case when x.st = 'completed' and x.pn <= 2 then (x.done + time '14:00') at time zone 'UTC' end,
      assessment_reviewed_by = case when x.st = 'completed' and x.pn <= 2 then 'Νοσηλεύτρια Επιτήρησης Λοιμώξεων' end,
      assessment_review_acknowledged = case when x.st = 'completed' and x.pn <= 2 then true end
    from x
    where ta.id = x.id
    returning ta.id, ta.organization_id, ta.program_id, ta.employee_code, ta.feedback_submitted_at, x.st, x.g, x.pn, x.answers
  ), answers as (
    insert into public.training_assessment_answers(organization_id, assignment_id, question_key, answer_kind, answer_text, answer_boolean, answer_number,
      answer_option_keys, created_by, updated_by)
    select u.organization_id, u.id, e.key,
      case jsonb_typeof(e.value) when 'string' then 'text' when 'boolean' then 'boolean' when 'number' then 'number' else 'options' end,
      case when jsonb_typeof(e.value) = 'string' then e.value #>> '{}' end,
      case when jsonb_typeof(e.value) = 'boolean' then (e.value #>> '{}')::boolean end,
      case when jsonb_typeof(e.value) = 'number' then (e.value #>> '{}')::numeric end,
      case when jsonb_typeof(e.value) = 'array' then array(select y #>> '{}' from jsonb_array_elements(e.value) with ordinality s(y, n) order by s.n) end,
      p_actor, p_actor
    from upd u
    cross join lateral jsonb_each(u.answers) e
    where u.st = 'completed' and u.answers is not null
    returning 1
  ), responses as (
    insert into public.training_feedback_responses(assignment_id, organization_id, program_id, employee_code, submitted_at, comment, created_by, updated_by)
    select u.id, u.organization_id, u.program_id, u.employee_code, u.feedback_submitted_at, v_comments[1 + (u.g + u.pn) % 8], p_actor, p_actor
    from upd u
    where u.st = 'completed'
    returning 1
  )
  insert into public.training_feedback_scores(organization_id, assignment_id, question_key, score, created_by, updated_by)
  select u.organization_id, u.id, s.key, s.score, p_actor, p_actor
  from upd u
  cross join lateral (values
      ('clarity', case when (u.g * 2 + u.pn * 2) % 5 = 0 then 3 when (u.g + u.pn) % 3 = 0 then 4 else 5 end),
      ('knowledge', case when (u.g * 3 + u.pn) % 7 = 0 then 4 else 5 end),
      ('usefulness', case when (u.g * 4 + u.pn * 2) % 5 = 0 then 3 when (u.g * 4 + u.pn) % 3 = 0 then 4 else 5 end),
      ('organization', case when (u.g * 5 + u.pn) % 3 = 0 then 4 else 5 end),
      ('materials', case when (u.g * 6 + u.pn * 2) % 5 = 0 then 3 when (u.g * 6 + u.pn) % 3 = 1 then 4 else 5 end)
  ) s(key, score)
  where u.st = 'completed';

  -- Programmes: material, assessment questions (with their options), the
  -- trainer evaluation they use and the effectiveness follow-up. The
  -- evaluations collected are the trainer evaluations above.
  with q(program_id, questions) as (values
    ('TRN-DEMO-001', '[{"id":"Q-001","type":"single_choice","text":"Πότε εφαρμόζεται υγιεινή χεριών πριν από άσηπτη πράξη;","points":5,"required":true,"options":[{"id":"Q-001-O1","text":"Μόνο όταν δεν φοράμε γάντια","correct":false},{"id":"Q-001-O2","text":"Αμέσως πριν από κάθε άσηπτη πράξη","correct":true},{"id":"Q-001-O3","text":"Μόνο μετά την επαφή με τον ασθενή","correct":false},{"id":"Q-001-O4","text":"Μία φορά στην αρχή της βάρδιας","correct":false}],"correctBoolean":true,"modelAnswer":"","manualReview":false},{"id":"Q-002","type":"true_false","text":"Τα γάντια αντικαθιστούν την υγιεινή χεριών.","points":5,"required":true,"options":[],"correctBoolean":false,"modelAnswer":"","manualReview":false},{"id":"Q-003","type":"multiple_choice","text":"Ποιες από τις παρακάτω είναι «στιγμές» του WHO για την υγιεινή χεριών;","points":5,"required":true,"options":[{"id":"Q-003-O1","text":"Πριν από την επαφή με τον ασθενή","correct":true},{"id":"Q-003-O2","text":"Μετά από έκθεση σε βιολογικά υγρά","correct":true},{"id":"Q-003-O3","text":"Πριν από την είσοδο στο γραφείο προσωπικού","correct":false},{"id":"Q-003-O4","text":"Μετά την επαφή με το περιβάλλον του ασθενούς","correct":true}],"correctBoolean":true,"modelAnswer":"","manualReview":false},{"id":"Q-004","type":"single_choice","text":"Πόσο διαρκεί η σωστή εντριβή με αλκοολούχο αντισηπτικό;","points":5,"required":true,"options":[{"id":"Q-004-O1","text":"5–10 δευτερόλεπτα","correct":false},{"id":"Q-004-O2","text":"20–30 δευτερόλεπτα","correct":true},{"id":"Q-004-O3","text":"40–60 δευτερόλεπτα","correct":false},{"id":"Q-004-O4","text":"2 λεπτά","correct":false}],"correctBoolean":true,"modelAnswer":"","manualReview":false},{"id":"Q-005","type":"true_false","text":"Σε λοίμωξη από Clostridioides difficile προτιμάται πλύσιμο με νερό και σαπούνι.","points":3,"required":true,"options":[],"correctBoolean":true,"modelAnswer":"","manualReview":false},{"id":"Q-006","type":"single_choice","text":"Πόσο διαρκεί το πλύσιμο χεριών με νερό και σαπούνι;","points":2,"required":true,"options":[{"id":"Q-006-O1","text":"10–15 δευτερόλεπτα","correct":false},{"id":"Q-006-O2","text":"20–30 δευτερόλεπτα","correct":false},{"id":"Q-006-O3","text":"40–60 δευτερόλεπτα","correct":true},{"id":"Q-006-O4","text":"3 λεπτά","correct":false}],"correctBoolean":true,"modelAnswer":"","manualReview":false},{"id":"Q-007","type":"free_text","text":"Περιγράψτε σε μία πρόταση πότε αλλάζετε γάντια στον ίδιο ασθενή.","points":0,"required":false,"options":[],"correctBoolean":true,"modelAnswer":"Όταν μετακινούμαι από μολυσμένη σε καθαρή περιοχή του σώματος του ίδιου ασθενούς.","manualReview":false}]'::jsonb),
    ('TRN-DEMO-002', '[{"id":"Q-101","type":"single_choice","text":"Ποια είναι η σωστή σειρά ένδυσης ΜΑΠ;","points":3,"required":true,"options":[{"id":"Q-101-O1","text":"Γάντια → ποδιά → μάσκα → γυαλιά","correct":false},{"id":"Q-101-O2","text":"Ποδιά → μάσκα → γυαλιά → γάντια","correct":true},{"id":"Q-101-O3","text":"Μάσκα → γάντια → ποδιά → γυαλιά","correct":false},{"id":"Q-101-O4","text":"Γυαλιά → γάντια → μάσκα → ποδιά","correct":false}],"correctBoolean":true,"modelAnswer":"","manualReview":false},{"id":"Q-102","type":"true_false","text":"Η μάσκα FFP2 απαιτείται σε διαδικασίες που παράγουν αερολύματα.","points":2,"required":true,"options":[],"correctBoolean":true,"modelAnswer":"","manualReview":false},{"id":"Q-103","type":"multiple_choice","text":"Ποιοι μικροοργανισμοί απαιτούν προφυλάξεις επαφής;","points":3,"required":true,"options":[{"id":"Q-103-O1","text":"CPE / KPC","correct":true},{"id":"Q-103-O2","text":"MRSA","correct":true},{"id":"Q-103-O3","text":"Mycobacterium tuberculosis","correct":false},{"id":"Q-103-O4","text":"Clostridioides difficile","correct":true}],"correctBoolean":true,"modelAnswer":"","manualReview":false},{"id":"Q-104","type":"true_false","text":"Τα γάντια αφαιρούνται τελευταία, μετά τη μάσκα.","points":2,"required":true,"options":[],"correctBoolean":false,"modelAnswer":"","manualReview":false},{"id":"Q-105","type":"free_text","text":"Αναφέρετε ένα σημείο προσοχής κατά την αφαίρεση της ποδιάς.","points":0,"required":false,"options":[],"correctBoolean":true,"modelAnswer":"Αναδιπλώνεται με τη μολυσμένη πλευρά προς τα μέσα, χωρίς επαφή με τη στολή.","manualReview":false}]'::jsonb),
    ('TRN-DEMO-003', '[{"id":"Q-201","type":"single_choice","text":"Ποιο αντισηπτικό προτιμάται για την προετοιμασία του δέρματος πριν από τοποθέτηση CVC;","points":2,"required":true,"options":[{"id":"Q-201-O1","text":"Ποβιδόνη ιωδίνη 10%","correct":false},{"id":"Q-201-O2","text":"Χλωρεξιδίνη > 0,5% σε αλκοόλη","correct":true},{"id":"Q-201-O3","text":"Αλκοόλη 70% μόνη","correct":false},{"id":"Q-201-O4","text":"Φυσιολογικός ορός","correct":false}],"correctBoolean":true,"modelAnswer":"","manualReview":false},{"id":"Q-202","type":"multiple_choice","text":"Ποια στοιχεία περιλαμβάνει το bundle τοποθέτησης CVC;","points":3,"required":true,"options":[{"id":"Q-202-O1","text":"Υγιεινή χεριών","correct":true},{"id":"Q-202-O2","text":"Πλήρη μέτρα άσηπτης τεχνικής (maximal barrier)","correct":true},{"id":"Q-202-O3","text":"Αποφυγή μηριαίας φλέβας σε ενήλικες","correct":true},{"id":"Q-202-O4","text":"Προφυλακτική χορήγηση αντιβιοτικού","correct":false}],"correctBoolean":true,"modelAnswer":"","manualReview":false},{"id":"Q-203","type":"true_false","text":"Η ανάγκη διατήρησης της κεντρικής γραμμής επανεκτιμάται καθημερινά.","points":1,"required":true,"options":[],"correctBoolean":true,"modelAnswer":"","manualReview":false},{"id":"Q-204","type":"single_choice","text":"Κάθε πότε αλλάζει ένα διαφανές επίθεμα CVC, εφόσον είναι ακέραιο;","points":2,"required":true,"options":[{"id":"Q-204-O1","text":"Κάθε 24 ώρες","correct":false},{"id":"Q-204-O2","text":"Κάθε 48 ώρες","correct":false},{"id":"Q-204-O3","text":"Κάθε 7 ημέρες","correct":true},{"id":"Q-204-O4","text":"Μόνο κατά την αφαίρεση","correct":false}],"correctBoolean":true,"modelAnswer":"","manualReview":false},{"id":"Q-205","type":"true_false","text":"Τα σημεία πρόσβασης (hubs) δεν χρειάζονται απολύμανση όταν χρησιμοποιούνται συχνά.","points":1,"required":true,"options":[],"correctBoolean":false,"modelAnswer":"","manualReview":false},{"id":"Q-206","type":"single_choice","text":"Ποιος δείκτης μετρά τη συχνότητα CLABSI;","points":1,"required":true,"options":[{"id":"Q-206-O1","text":"Επεισόδια ανά 100 εισαγωγές","correct":false},{"id":"Q-206-O2","text":"Επεισόδια ανά 1.000 ημέρες κεντρικής γραμμής","correct":true},{"id":"Q-206-O3","text":"Επεισόδια ανά κλίνη","correct":false},{"id":"Q-206-O4","text":"Επεισόδια ανά μήνα","correct":false}],"correctBoolean":true,"modelAnswer":"","manualReview":false},{"id":"Q-207","type":"free_text","text":"Τι κάνετε αν το επίθεμα είναι υγρό ή αποκολλημένο;","points":0,"required":false,"options":[],"correctBoolean":true,"modelAnswer":"Αλλάζω άμεσα το επίθεμα με άσηπτη τεχνική και καταγράφω την αλλαγή.","manualReview":false}]'::jsonb),
    ('TRN-DEMO-004', '[{"id":"Q-401","type":"single_choice","text":"Σε ποιον περιέκτη απορρίπτονται τα μολυσματικά απόβλητα (ΕΑΑ-ΜΧ);","points":5,"required":true,"options":[{"id":"Q-401-O1","text":"Μαύρη σακούλα οικιακών απορριμμάτων","correct":false},{"id":"Q-401-O2","text":"Κίτρινο κυτίο ή σάκος με σήμανση βιολογικού κινδύνου","correct":true},{"id":"Q-401-O3","text":"Μπλε κάδος ανακύκλωσης","correct":false},{"id":"Q-401-O4","text":"Οποιοσδήποτε διαθέσιμος κάδος","correct":false}],"correctBoolean":true,"modelAnswer":"","manualReview":false},{"id":"Q-402","type":"true_false","text":"Τα αιχμηρά απορρίπτονται σε άκαμπτο περιέκτη ανθεκτικό στη διάτρηση.","points":5,"required":true,"options":[],"correctBoolean":true,"modelAnswer":"","manualReview":false},{"id":"Q-403","type":"multiple_choice","text":"Ποια από τα παρακάτω χαρακτηρίζονται μολυσματικά απόβλητα (ΕΑΑ-ΜΧ);","points":5,"required":true,"options":[{"id":"Q-403-O1","text":"Γάζες εμποτισμένες με αίμα","correct":true},{"id":"Q-403-O2","text":"Χάρτινες συσκευασίες φαρμάκων","correct":false},{"id":"Q-403-O3","text":"Σωληνώσεις αιμοκάθαρσης","correct":true},{"id":"Q-403-O4","text":"Υπολείμματα τροφών από θάλαμο χωρίς απομόνωση","correct":false}],"correctBoolean":true,"modelAnswer":"","manualReview":false},{"id":"Q-404","type":"single_choice","text":"Πόσο μπορούν να παραμείνουν τα ΕΑΑ-ΜΧ στον χώρο προσωρινής αποθήκευσης σε θερμοκρασία δωματίου;","points":3,"required":true,"options":[{"id":"Q-404-O1","text":"Έως 5 ημέρες","correct":true},{"id":"Q-404-O2","text":"Έως 30 ημέρες","correct":false},{"id":"Q-404-O3","text":"Χωρίς χρονικό όριο","correct":false},{"id":"Q-404-O4","text":"Έως 1 ώρα","correct":false}],"correctBoolean":true,"modelAnswer":"","manualReview":false},{"id":"Q-405","type":"true_false","text":"Οι σάκοι γεμίζουν έως τα 3/4 και κλείνουν χωρίς συμπίεση του περιεχομένου.","points":2,"required":true,"options":[],"correctBoolean":true,"modelAnswer":"","manualReview":false},{"id":"Q-406","type":"free_text","text":"Τι κάνετε αν σχιστεί σάκος μολυσματικών αποβλήτων;","points":0,"required":false,"options":[],"correctBoolean":true,"modelAnswer":"Τον τοποθετώ σε δεύτερο σάκο, καθαρίζω και απολυμαίνω τον χώρο και ενημερώνω τον υπεύθυνο.","manualReview":false}]'::jsonb),
    ('TRN-DEMO-005', '[{"id":"Q-301","type":"single_choice","text":"Τι κάνετε αμέσως μετά από τρύπημα με χρησιμοποιημένη βελόνα;","points":5,"required":true,"options":[{"id":"Q-301-O1","text":"Πιέζω για να σταματήσει η αιμορραγία","correct":false},{"id":"Q-301-O2","text":"Πλένω με νερό και σαπούνι και ενημερώνω αμέσως","correct":true},{"id":"Q-301-O3","text":"Εφαρμόζω χλωρίνη στο τραύμα","correct":false},{"id":"Q-301-O4","text":"Συνεχίζω και το αναφέρω στο τέλος της βάρδιας","correct":false}],"correctBoolean":true,"modelAnswer":"","manualReview":false},{"id":"Q-302","type":"true_false","text":"Η επανατοποθέτηση του καλύμματος στη βελόνα με δύο χέρια επιτρέπεται.","points":5,"required":true,"options":[],"correctBoolean":false,"modelAnswer":"","manualReview":false},{"id":"Q-303","type":"single_choice","text":"Μέχρι πού γεμίζει ο περιέκτης αιχμηρών;","points":5,"required":true,"options":[{"id":"Q-303-O1","text":"Μέχρι επάνω","correct":false},{"id":"Q-303-O2","text":"Έως τα 3/4 ή τη γραμμή πλήρωσης","correct":true},{"id":"Q-303-O3","text":"Μέχρι τη μέση","correct":false},{"id":"Q-303-O4","text":"Δεν υπάρχει όριο","correct":false}],"correctBoolean":true,"modelAnswer":"","manualReview":false},{"id":"Q-304","type":"multiple_choice","text":"Ποια μέτρα μειώνουν τους τραυματισμούς από αιχμηρά;","points":5,"required":true,"options":[{"id":"Q-304-O1","text":"Συσκευές ασφαλείας","correct":true},{"id":"Q-304-O2","text":"Περιέκτης στο σημείο χρήσης","correct":true},{"id":"Q-304-O3","text":"Μεταφορά βελονών στο χέρι","correct":false},{"id":"Q-304-O4","text":"Εκπαίδευση προσωπικού","correct":true}],"correctBoolean":true,"modelAnswer":"","manualReview":false},{"id":"Q-305","type":"true_false","text":"Κάθε έκθεση σε αίμα καταγράφεται ως περιστατικό έκθεσης στο Ιατρείο Εργασίας.","points":2,"required":true,"options":[],"correctBoolean":true,"modelAnswer":"","manualReview":false},{"id":"Q-306","type":"single_choice","text":"Εντός πόσου χρόνου ξεκινά ιδανικά η προφύλαξη μετά από έκθεση στον HIV;","points":3,"required":true,"options":[{"id":"Q-306-O1","text":"Εντός 2 ωρών","correct":false},{"id":"Q-306-O2","text":"Εντός 72 ωρών — ιδανικά στις 2 πρώτες ώρες","correct":true},{"id":"Q-306-O3","text":"Εντός 1 εβδομάδας","correct":false},{"id":"Q-306-O4","text":"Δεν απαιτείται προφύλαξη","correct":false}],"correctBoolean":true,"modelAnswer":"","manualReview":false},{"id":"Q-307","type":"free_text","text":"Ποιον ενημερώνετε μετά από έκθεση;","points":0,"required":false,"options":[],"correctBoolean":true,"modelAnswer":"Τον προϊστάμενο και το Ιατρείο Εργασίας, με καταγραφή του περιστατικού.","manualReview":false}]'::jsonb)
  ), m(program_id, title_en, materials, effectiveness) as (values
    ('TRN-DEMO-001', 'Hand hygiene – WHO 5 Moments',
      jsonb_build_array(jsonb_build_object('id', 'MAT-DEMO-001-1', 'title', 'Οι 5 στιγμές υγιεινής χεριών (WHO) — αφίσα', 'type', 'PDF', 'url', ''),
        jsonb_build_object('id', 'MAT-DEMO-001-2', 'title', 'Τεχνική αντισηψίας χεριών με αλκοολούχο διάλυμα — βίντεο', 'type', 'Βίντεο', 'url', ''),
        jsonb_build_object('id', 'MAT-DEMO-001-3', 'title', 'Παρουσίαση εκπαίδευσης', 'type', 'Παρουσίαση', 'url', '')),
      jsonb_build_object('plannedDate', (d0 - 5)::text, 'method', 'observation', 'criterion', 'Συμμόρφωση στην υγιεινή χεριών ≥ 85% στις παρατηρήσεις WHO του τριμήνου',
        'result', 'partial', 'evaluatedAt', (d0 - 4)::text, 'evaluatedBy', 'Ομάδα Ελέγχου Λοιμώξεων',
        'notes', 'Συμμόρφωση 79%· χαμηλότερη στη στιγμή «μετά την επαφή με το περιβάλλον του ασθενούς». Επανεκπαίδευση στο τμήμα.')),
    ('TRN-DEMO-002', 'Personal protective equipment (PPE)',
      jsonb_build_array(jsonb_build_object('id', 'MAT-DEMO-002-1', 'title', 'Σειρά ένδυσης και αφαίρεσης ΑΠΕ — οδηγός', 'type', 'PDF', 'url', ''),
        jsonb_build_object('id', 'MAT-DEMO-002-2', 'title', 'Πρωτόκολλο απομόνωσης ασθενών με πολυανθεκτικά (DOC-003)', 'type', 'Διαδικασία', 'url', ''),
        jsonb_build_object('id', 'MAT-DEMO-002-3', 'title', 'Παρουσιολόγιο πρακτικής άσκησης', 'type', 'Έντυπο', 'url', '')),
      jsonb_build_object('plannedDate', (d0 - 2)::text, 'method', 'audit', 'criterion', 'Ορθή ένδυση/αφαίρεση ΑΠΕ σε ≥ 90% των ελέγχων θαλάμων απομόνωσης',
        'result', '', 'evaluatedAt', '', 'evaluatedBy', '', 'notes', '')),
    ('TRN-DEMO-003', 'CLABSI prevention bundle',
      jsonb_build_array(jsonb_build_object('id', 'MAT-DEMO-003-1', 'title', 'Δέσμη μέτρων πρόληψης CLABSI (DOC-004)', 'type', 'Διαδικασία', 'url', ''),
        jsonb_build_object('id', 'MAT-DEMO-003-2', 'title', 'Λίστα ελέγχου τοποθέτησης κεντρικού φλεβικού καθετήρα', 'type', 'Έντυπο', 'url', ''),
        jsonb_build_object('id', 'MAT-DEMO-003-3', 'title', 'Παρουσίαση εκπαίδευσης', 'type', 'Παρουσίαση', 'url', '')),
      jsonb_build_object('plannedDate', (d0 + 90)::text, 'method', 'indicator', 'criterion', 'Συχνότητα CLABSI στη ΜΕΘ < 2 ανά 1.000 ημέρες καθετήρα',
        'result', '', 'evaluatedAt', '', 'evaluatedBy', '', 'notes', '')),
    ('TRN-DEMO-004', 'Healthcare waste management',
      jsonb_build_array(jsonb_build_object('id', 'MAT-DEMO-004-1', 'title', 'Οδηγός διαλογής ΕΑΑ/ΜΑ', 'type', 'PDF', 'url', ''),
        jsonb_build_object('id', 'MAT-DEMO-004-2', 'title', 'Σήμανση περιεκτών αποβλήτων — αφίσα', 'type', 'PDF', 'url', '')),
      jsonb_build_object('plannedDate', d0::text, 'method', 'audit', 'criterion', 'Ορθή διαλογή αποβλήτων ≥ 95% στους ελέγχους τμημάτων',
        'result', 'effective', 'evaluatedAt', (d0 - 3)::text, 'evaluatedBy', 'Γραφείο Περιβαλλοντικής Υγιεινής',
        'notes', 'Ορθή διαλογή 97% σε 18 ελέγχους· καμία ανάμιξη αιχμηρών με κοινά απορρίμματα.')),
    ('TRN-DEMO-005', 'Safe use of sharps and PEP',
      jsonb_build_array(jsonb_build_object('id', 'MAT-DEMO-005-1', 'title', 'Διαδικασία μετά από έκθεση σε αίμα (PEP)', 'type', 'Διαδικασία', 'url', ''),
        jsonb_build_object('id', 'MAT-DEMO-005-2', 'title', 'Ασφαλής χρήση και απόρριψη αιχμηρών', 'type', 'Παρουσίαση', 'url', '')),
      jsonb_build_object('plannedDate', (d0 + 171)::text, 'method', 'indicator', 'criterion', 'Καμία μη αναφερθείσα έκθεση σε αιχμηρά στο τρίμηνο',
        'result', '', 'evaluatedAt', '', 'evaluatedBy', '', 'notes', ''))
  ), upd as (
    update public.training_programs pr
    set title_en = m.title_en, feedback_template_key = 'TRAINER-FEEDBACK-DEFAULT', feedback_title_el = 'Αξιολόγηση εκπαιδευτή',
      feedback_title_en = 'Trainer evaluation', created_at = ((pr.start_date - 20) + time '09:00') at time zone 'UTC'
    from m
    where pr.organization_id = v_org and pr.program_key = m.program_id
    returning pr.id, pr.program_key
  ), materials as (
    insert into public.training_program_materials(organization_id, program_id, material_key, position, title, material_type, url, created_by, updated_by)
    select v_org, u.id, x.value->>'id', x.ord::integer, x.value->>'title', nullif(x.value->>'type', ''), nullif(x.value->>'url', ''), p_actor, p_actor
    from upd u
    join m on m.program_id = u.program_key
    cross join lateral jsonb_array_elements(m.materials) with ordinality x(value, ord)
    returning 1
  ), effectiveness as (
    insert into public.training_program_effectiveness(program_id, organization_id, planned_date, method, criterion, result, evaluated_at, evaluated_by, notes, created_by, updated_by)
    select u.id, v_org, nullif(m.effectiveness->>'plannedDate', '')::date, nullif(m.effectiveness->>'method', ''), nullif(m.effectiveness->>'criterion', ''),
      nullif(m.effectiveness->>'result', ''), nullif(m.effectiveness->>'evaluatedAt', '')::date, nullif(m.effectiveness->>'evaluatedBy', ''),
      nullif(m.effectiveness->>'notes', ''), p_actor, p_actor
    from upd u
    join m on m.program_id = u.program_key
    returning 1
  ), feedback_questions as (
    insert into public.training_program_feedback_questions(organization_id, program_id, question_key, position, label_el, label_en, created_by, updated_by)
    select v_org, u.id, fq.key, fq.pos, fq.label_el, fq.label_en, p_actor, p_actor
    from upd u
    cross join (values
      ('clarity', 1, 'Σαφήνεια παρουσίασης', 'Clarity of presentation'),
      ('knowledge', 2, 'Γνώση και επάρκεια εκπαιδευτή', 'Trainer knowledge and competence'),
      ('usefulness', 3, 'Χρησιμότητα για την εργασία μου', 'Usefulness for my work'),
      ('organization', 4, 'Οργάνωση της εκπαίδευσης', 'Organization of the training'),
      ('materials', 5, 'Ποιότητα εκπαιδευτικού υλικού', 'Quality of training material')
    ) fq(key, pos, label_el, label_en)
    returning 1
  ), questions as (
    insert into public.training_assessment_questions(organization_id, program_id, question_key, position, question_type, text, points, required,
      correct_boolean, model_answer, manual_review, created_by, updated_by)
    select v_org, u.id, x.value->>'id', x.ord::integer, x.value->>'type', x.value->>'text', (x.value->>'points')::numeric, (x.value->>'required')::boolean,
      (x.value->>'correctBoolean')::boolean, nullif(x.value->>'modelAnswer', ''), (x.value->>'manualReview')::boolean, p_actor, p_actor
    from upd u
    join q on q.program_id = u.program_key
    cross join lateral jsonb_array_elements(q.questions) with ordinality x(value, ord)
    returning id, program_id, question_key
  )
  insert into public.training_assessment_options(organization_id, question_id, option_key, position, text, correct, created_by, updated_by)
  select v_org, qs.id, o.value->>'id', o.ord::integer, o.value->>'text', (o.value->>'correct')::boolean, p_actor, p_actor
  from questions qs
  join upd u on u.id = qs.program_id
  join q on q.program_id = u.program_key
  cross join lateral jsonb_array_elements(q.questions) x(value)
  cross join lateral jsonb_array_elements(x.value->'options') with ordinality o(value, ord)
  where x.value->>'id' = qs.question_key;

  -- What happened in the training registry (Training > history).
  insert into public.training_history_events(organization_id, position, occurred_at, actor, action, created_by, updated_by)
  select v_org, (row_number() over (order by h.at desc))::integer, h.at at time zone 'UTC', h.actor, h.action, p_actor, p_actor
  from (values
    ((d0 - 170) + time '09:00', 'Ομάδα Ελέγχου Λοιμώξεων', 'Δημιουργήθηκε το πρόγραμμα «Διαχείριση νοσοκομειακών αποβλήτων»'),
    ((d0 - 140) + time '09:10', 'Ομάδα Ελέγχου Λοιμώξεων', 'Δημιουργήθηκε ο ετήσιος κύκλος «Υγιεινή των χεριών – 5 στιγμές ΠΟΥ»'),
    ((d0 - 120) + time '09:00', 'Ομάδα Ελέγχου Λοιμώξεων', 'Στάλθηκαν προσκλήσεις για την υγιεινή των χεριών'),
    ((d0 - 110) + time '11:30', 'Νοσηλεύτρια Επιτήρησης Λοιμώξεων', 'Ορίστηκε απαίτηση «ΑΠΕ για νοσηλευτικό προσωπικό»'),
    ((d0 - 80) + time '10:00', 'Διευθυντής ΜΕΘ', 'Δημιουργήθηκε το πρόγραμμα «Bundle πρόληψης CLABSI»'),
    ((d0 - 4) + time '13:00', 'Ομάδα Ελέγχου Λοιμώξεων', 'Καταγράφηκε η αποτελεσματικότητα της εκπαίδευσης υγιεινής χεριών: μερικώς αποτελεσματική'),
    ((d0 - 3) + time '09:30', 'Ομάδα Ελέγχου Λοιμώξεων', 'Προστέθηκαν συμμετέχοντες στο «Ασφαλής χρήση αιχμηρών και PEP»')
  ) h(at, actor, action)
  where not exists (select 1 from public.training_history_events e where e.organization_id = v_org);
end;
$function$;

revoke all on function private.demo_seed_training(uuid, uuid) from public, anon, authenticated;
revoke all on function private.demo_seed_people_training(uuid, uuid) from public, anon, authenticated;

-- 12. Freeze training_records -----------------------------------------------------
-- Kept read-only as the archive of the old payloads: no writes from the API
-- roles, and a trigger refuses any insert or update (and any delete except
-- the Demo reset and the organization deletion, which clear every table).

drop trigger if exists trg_project_training_assignment_identity on public.training_records;
drop function if exists public.project_training_assignment_identity();

drop policy if exists training_records_insert on public.training_records;
drop policy if exists training_records_update on public.training_records;
drop policy if exists training_records_delete on public.training_records;
revoke insert, update, delete, truncate on table public.training_records from public, anon, authenticated;

create or replace function private.training_records_frozen()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if tg_op = 'DELETE' and coalesce(current_setting('limoxis.test_reset', true), '') = 'on' then return old; end if;
  raise exception 'TRAINING_RECORDS_FROZEN' using errcode = '55000',
    hint = 'Training lives in the training_* tables (20261115100000_training_relational.sql).';
end;
$function$;
revoke all on function private.training_records_frozen() from public, anon, authenticated;

create trigger trg_training_records_frozen
before insert or update or delete on public.training_records
for each row execute function private.training_records_frozen();

comment on table public.training_records is 'Frozen archive (read-only) of the training payloads before 20261115100000_training_relational.sql. Training lives in the training_* tables.';
