-- Επιδημιολογικό ερωτηματολόγιο επιτήρησης (σχεδιασμός: docs/design/epi-questionnaire/).
-- Μόνο προσθήκες: δύο νέοι πίνακες, δύο nullable στήλες στο patient_admissions, μία nullable
-- στήλη στο laboratory_samples. Δεν αλλάζει, δεν αφαιρείται και δεν ανακαλείται τίποτα υπάρχον.
--
-- surveillance_case_questionnaires   ΕΝΑ ερωτηματολόγιο ανά επεισόδιο επιτήρησης, που
--                                    συμπληρώνεται και διορθώνεται στον χρόνο. answers:
--                                    { "<question_key>": { "a": "yes|no|unknown", "detail": "…",
--                                    "src": "manual|prefill|prefill_edited" } }. core_complete το
--                                    υπολογίζει η βάση (οι 3 βασικές με απάντηση, και «unknown»).
-- epi_questionnaire_question_settings  τοπικές ρυθμίσεις ανά νοσοκομείο: αναδιατύπωση, χρονικό
--                                    παράθυρο, ενεργοποίηση. Οι προεπιλογές ζουν στον κώδικα
--                                    (src/features/surveillance/epiQuestionnaire/epiQuestionnaireModel.js).
-- patient_admissions.admission_source / source_facility   πηγή εισαγωγής (προσυμπλήρωση της ερώτησης μεταφοράς).
-- laboratory_samples.clinical_context   οι 3 βασικές απαντήσεις της μικρής όψης όταν το δείγμα δεν έχει επεισόδιο·
--                                    προσυμπληρώνουν το ερωτηματολόγιο όταν ανοίξει επεισόδιο.

create or replace function private.epi_questionnaire_before_write()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.core_complete :=
    coalesce(new.answers #>> '{antibiotics_90d,a}', '') in ('yes', 'no', 'unknown')
    and coalesce(new.answers #>> '{icu_stay,a}', '') in ('yes', 'no', 'unknown')
    and coalesce(new.answers #>> '{transfer_from_facility,a}', '') in ('yes', 'no', 'unknown');
  new.updated_at := now();
  new.updated_by := auth.uid();
  if tg_op = 'INSERT' then
    new.answered_by := coalesce(new.answered_by, auth.uid());
    new.answered_at := coalesce(new.answered_at, now());
  end if;
  return new;
end
$function$;

create table if not exists public.surveillance_case_questionnaires (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  surveillance_case_id uuid not null,
  definition_version integer not null default 1 check (definition_version >= 1),
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  prefilled jsonb not null default '{}'::jsonb check (jsonb_typeof(prefilled) = 'object'),
  core_complete boolean not null default false,
  answered_by uuid references auth.users(id) on delete set null,
  answered_at timestamptz,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint surveillance_case_questionnaires_case_fk foreign key (surveillance_case_id, organization_id)
    references public.surveillance_cases (id, organization_id) on delete cascade,
  constraint surveillance_case_questionnaires_one_per_case unique (surveillance_case_id)
);
create index if not exists surveillance_case_questionnaires_org_idx on public.surveillance_case_questionnaires (organization_id, core_complete);
create index if not exists surveillance_case_questionnaires_case_idx on public.surveillance_case_questionnaires (surveillance_case_id, organization_id);
comment on table public.surveillance_case_questionnaires is 'Το επιδημιολογικό ερωτηματολόγιο του επεισοδίου επιτήρησης (ένα ανά επεισόδιο). Η προέλευση και οι παράγοντες κινδύνου δεν αποθηκεύονται: υπολογίζονται στην ανάγνωση.';

create trigger surveillance_case_questionnaires_before_write
  before insert or update on public.surveillance_case_questionnaires
  for each row execute function private.epi_questionnaire_before_write();

alter table public.surveillance_case_questionnaires enable row level security;

-- Read: the Platform Owner, the infection-control side of the organization, or a department
-- manager / link nurse whose scope contains the episode's department (through the parent row).
create policy surveillance_case_questionnaires_read on public.surveillance_case_questionnaires for select to authenticated using (
  (select public.current_user_is_platform_owner())
  or organization_id = any ((select private.fast_orgs_role(array['hospital_admin','infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[]))::uuid[])
  or exists (
    select 1 from public.surveillance_cases c
    where c.id = surveillance_case_id and c.organization_id = organization_id
      and public.current_user_has_org_role(c.organization_id, array['department_manager','link_nurse']::public.app_role[])
      and c.department_id is not null
      and public.current_user_has_department_scope(c.organization_id, c.department_id)));

-- Write: the surveillance writers of the organization, and the department's own nurses and
-- managers inside their departments («το απαντά το τμήμα»).
create policy surveillance_case_questionnaires_insert on public.surveillance_case_questionnaires for insert to authenticated with check (
  (select public.current_user_is_platform_owner())
  or organization_id = any ((select private.fast_orgs_role(array['infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[]))::uuid[])
  or exists (
    select 1 from public.surveillance_cases c
    where c.id = surveillance_case_id and c.organization_id = organization_id
      and public.current_user_has_org_role(c.organization_id, array['department_manager','link_nurse']::public.app_role[])
      and c.department_id is not null
      and public.current_user_has_department_scope(c.organization_id, c.department_id)));

create policy surveillance_case_questionnaires_update on public.surveillance_case_questionnaires for update to authenticated
  using (
    (select public.current_user_is_platform_owner())
    or organization_id = any ((select private.fast_orgs_role(array['infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[]))::uuid[])
    or exists (
      select 1 from public.surveillance_cases c
      where c.id = surveillance_case_id and c.organization_id = organization_id
        and public.current_user_has_org_role(c.organization_id, array['department_manager','link_nurse']::public.app_role[])
        and c.department_id is not null
        and public.current_user_has_department_scope(c.organization_id, c.department_id)))
  with check (
    (select public.current_user_is_platform_owner())
    or organization_id = any ((select private.fast_orgs_role(array['infection_control_lead','infection_control_member','doctor_reviewer']::public.app_role[]))::uuid[])
    or exists (
      select 1 from public.surveillance_cases c
      where c.id = surveillance_case_id and c.organization_id = organization_id
        and public.current_user_has_org_role(c.organization_id, array['department_manager','link_nurse']::public.app_role[])
        and c.department_id is not null
        and public.current_user_has_department_scope(c.organization_id, c.department_id)));

-- The questionnaire is part of the episode: it goes with it (cascade); nobody deletes it alone
-- except the Platform Owner.
create policy surveillance_case_questionnaires_delete on public.surveillance_case_questionnaires for delete to authenticated using (
  (select public.current_user_is_platform_owner()));

create policy surveillance_case_questionnaires_module_gate on public.surveillance_case_questionnaires as restrictive for all to authenticated
  using ((select not private.current_user_has_locked_modules()) or organization_id is null or not (organization_id = any ((select private.current_user_locked_module_orgs('{surveillance}'::text[]))::uuid[])))
  with check ((select not private.current_user_has_locked_modules()) or organization_id is null or not (organization_id = any ((select private.current_user_locked_module_orgs('{surveillance}'::text[]))::uuid[])));

-- Question settings of one hospital -------------------------------------------------------

create table if not exists public.epi_questionnaire_question_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  question_key text not null check (btrim(question_key) <> ''),
  label_el text,
  label_en text,
  help_el text,
  help_en text,
  window_days integer check (window_days is null or window_days between 1 and 3650),
  is_active boolean not null default true,
  version integer not null default 1 check (version >= 1),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint epi_questionnaire_question_settings_one_per_key unique (organization_id, question_key)
);
create index if not exists epi_questionnaire_question_settings_org_idx on public.epi_questionnaire_question_settings (organization_id);
comment on table public.epi_questionnaire_question_settings is 'Τοπικές ρυθμίσεις των ερωτήσεων του επιδημιολογικού ερωτηματολογίου: διατύπωση (el/en), βοηθητικό κείμενο, χρονικό παράθυρο, ενεργοποίηση. Οι 3 βασικές ερωτήσεις δεν απενεργοποιούνται (το επιβάλλει και η εφαρμογή).';

alter table public.epi_questionnaire_question_settings enable row level security;

create policy epi_questionnaire_question_settings_read on public.epi_questionnaire_question_settings for select to authenticated using (
  (select public.current_user_is_platform_owner())
  or public.is_org_member(organization_id));
create policy epi_questionnaire_question_settings_insert on public.epi_questionnaire_question_settings for insert to authenticated with check (
  (select public.current_user_is_platform_owner())
  or organization_id = any ((select private.fast_orgs_role(array['hospital_admin']::public.app_role[]))::uuid[]));
create policy epi_questionnaire_question_settings_update on public.epi_questionnaire_question_settings for update to authenticated
  using (
    (select public.current_user_is_platform_owner())
    or organization_id = any ((select private.fast_orgs_role(array['hospital_admin']::public.app_role[]))::uuid[]))
  with check (
    (select public.current_user_is_platform_owner())
    or organization_id = any ((select private.fast_orgs_role(array['hospital_admin']::public.app_role[]))::uuid[]));

create policy epi_questionnaire_question_settings_module_gate on public.epi_questionnaire_question_settings as restrictive for all to authenticated
  using ((select not private.current_user_has_locked_modules()) or organization_id is null or not (organization_id = any ((select private.current_user_locked_module_orgs('{surveillance}'::text[]))::uuid[])))
  with check ((select not private.current_user_has_locked_modules()) or organization_id is null or not (organization_id = any ((select private.current_user_locked_module_orgs('{surveillance}'::text[]))::uuid[])));

-- Additive columns on existing tables ----------------------------------------------------

alter table public.patient_admissions
  add column if not exists admission_source text,
  add column if not exists source_facility text;
alter table public.patient_admissions
  add constraint patient_admissions_admission_source_check check (admission_source is null or admission_source in ('home', 'other_hospital', 'ltcf', 'other'));
comment on column public.patient_admissions.admission_source is 'Από πού ήρθε ο ασθενής: home, other_hospital, ltcf (μονάδα μακροχρόνιας φροντίδας), other. Null = δεν καταγράφηκε. Προσυμπληρώνει την ερώτηση μεταφοράς του επιδημιολογικού ερωτηματολογίου.';
comment on column public.patient_admissions.source_facility is 'Το νοσοκομείο ή η μονάδα από όπου ήρθε ο ασθενής (ελεύθερο κείμενο).';

alter table public.laboratory_samples
  add column if not exists clinical_context jsonb;
alter table public.laboratory_samples
  add constraint laboratory_samples_clinical_context_check check (clinical_context is null or jsonb_typeof(clinical_context) = 'object');
comment on column public.laboratory_samples.clinical_context is 'Οι 3 βασικές απαντήσεις του επιδημιολογικού ερωτηματολογίου όταν δηλώθηκαν στην καταχώριση δείγματος χωρίς επεισόδιο: { "<question_key>": { "a": "yes|no|unknown", "detail": "…" } }.';
