-- Συνεντεύξεις: η αίτηση του υποψηφίου από tablet, με τις συναινέσεις και την υπογραφή.
--
--   hr_application_links       a single-use link HR opens on a tablet (QR / short code):
--                              only the SHA-256 of the code is stored, valid 24 hours,
--                              bound to the organization and the position;
--   hr_candidate_signatures    the candidate's signature (PNG) under the consents, kept
--                              apart so the list does not load the images;
--   hr_candidates              + the consents (processing, keeping the CV for other
--                              positions, contacting previous employers, truthfulness),
--                              their texts and version, and the source «tablet».
--
-- The candidate has no account: hr_application_public shows only the hospital's name,
-- logo and the position of a valid link; hr_application_submit records one application
-- through it (sanitised, limited, at most 10 a minute per hospital) and spends the link.
-- Nothing of another application is ever returned to anon.
--
-- Language levels: + «Πολύ καλά» (very_good). The FileMaker grid keeps its mapping
-- (owner-confirmed): «<ΓΛΩΣΣΑ> ΕΥΧ / ΜΕΤΡ» = Ομιλία, «… Copy» = Ανάγνωση, «… Copy2» =
-- Γραφή, ΕΥΧ = ευχερώς (Άριστα), ΜΕΤΡ = μετρίως (Μέτρια), CERT = πιστοποιητικό; the rows
-- are stored as level codes, so no stored value needs rewriting.
-- No SELECT/EXECUTE/RETURNING ... INTO (the Supabase SQL editor rewrites those).

-- 1. Language levels ----------------------------------------------------------------------

alter table public.hr_candidate_languages drop constraint if exists hr_candidate_languages_reading_check;
alter table public.hr_candidate_languages drop constraint if exists hr_candidate_languages_writing_check;
alter table public.hr_candidate_languages drop constraint if exists hr_candidate_languages_speaking_check;
alter table public.hr_candidate_languages add constraint hr_candidate_languages_reading_check check (reading in ('fluent','very_good','good','fair','basic'));
alter table public.hr_candidate_languages add constraint hr_candidate_languages_writing_check check (writing in ('fluent','very_good','good','fair','basic'));
alter table public.hr_candidate_languages add constraint hr_candidate_languages_speaking_check check (speaking in ('fluent','very_good','good','fair','basic'));

create or replace function private.hr_fm_level(p text)
returns text language sql immutable set search_path = ''
as $$
  select case when private.hr_fm_norm(p) ~ 'ΕΥΧΕΡ|FLUENT|ΑΡΙΣΤ|EXCELLENT' then 'fluent'
    when private.hr_fm_norm(p) ~ 'ΠΟΛΥ ΚΑΛ|VERY GOOD' then 'very_good'
    when private.hr_fm_norm(p) ~ 'ΚΑΛ|GOOD|ΠΟΛΥ' then 'good'
    when private.hr_fm_norm(p) ~ 'ΜΕΤΡ|FAIR' then 'fair'
    when private.hr_fm_norm(p) ~ 'ΒΑΣΙΚ|ΣΤΟΙΧ|BASIC|ΛΙΓ' then 'basic' end;
$$;
revoke all on function private.hr_fm_level(text) from public, anon, authenticated;

-- 2. The consents on the application -------------------------------------------------------

alter table public.hr_candidates add column if not exists consent_future boolean;
alter table public.hr_candidates add column if not exists consent_references boolean;
alter table public.hr_candidates add column if not exists declaration_truth boolean;
alter table public.hr_candidates add column if not exists consent_version text;
alter table public.hr_candidates add column if not exists consent_texts jsonb not null default '{}'::jsonb;
alter table public.hr_candidates add column if not exists signed_at timestamptz;
alter table public.hr_candidates add column if not exists application_link_id uuid;
alter table public.hr_candidates drop constraint if exists hr_candidates_source_check;
alter table public.hr_candidates add constraint hr_candidates_source_check check (source in ('app','filemaker','demo','tablet'));
alter table public.hr_candidates drop constraint if exists hr_candidates_consent_texts_check;
alter table public.hr_candidates add constraint hr_candidates_consent_texts_check check (jsonb_typeof(consent_texts) = 'object');

create table if not exists public.hr_candidate_signatures (
  candidate_id uuid primary key,
  organization_id uuid not null,
  image text not null check (image ~ '^data:image/png;base64,[A-Za-z0-9+/=]+$' and length(image) <= 300000),
  signed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (candidate_id, organization_id) references public.hr_candidates (id, organization_id) on delete cascade
);
create index if not exists hr_candidate_signatures_org_idx on public.hr_candidate_signatures (organization_id);

create table if not exists public.hr_application_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  token_hash text not null unique,
  requested_position text check (requested_position is null or length(requested_position) <= 160),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  cancelled_at timestamptz,
  candidate_id uuid,
  foreign key (candidate_id, organization_id) references public.hr_candidates (id, organization_id) on delete set null (candidate_id)
);
create index if not exists hr_application_links_org_idx on public.hr_application_links (organization_id, created_at desc);
create index if not exists hr_application_links_candidate_idx on public.hr_application_links (candidate_id);

-- Read by HR (view_interviews / manage_interviews); written only by the functions below,
-- apart from HR deleting a signature together with its application.
alter table public.hr_candidate_signatures enable row level security;
alter table public.hr_application_links enable row level security;
revoke all on public.hr_candidate_signatures from anon;
revoke all on public.hr_application_links from anon;
revoke insert, update, delete on public.hr_candidate_signatures from authenticated;
revoke insert, update, delete on public.hr_application_links from authenticated;
grant select on public.hr_candidate_signatures to authenticated;
grant select on public.hr_application_links to authenticated;
drop policy if exists hr_candidate_signatures_read on public.hr_candidate_signatures;
create policy hr_candidate_signatures_read on public.hr_candidate_signatures for select to authenticated
  using (public.current_user_has_capability(organization_id, 'view_interviews') or public.current_user_has_capability(organization_id, 'manage_interviews'));
drop policy if exists hr_application_links_read on public.hr_application_links;
create policy hr_application_links_read on public.hr_application_links for select to authenticated
  using (public.current_user_has_capability(organization_id, 'view_interviews') or public.current_user_has_capability(organization_id, 'manage_interviews'));

comment on table public.hr_application_links is 'Συνεντεύξεις: σύνδεσμος μίας χρήσης για αίτηση από tablet (μόνο το SHA-256 του κωδικού, λήξη 24 ωρών).';
comment on table public.hr_candidate_signatures is 'Συνεντεύξεις: η υπογραφή του υποψηφίου κάτω από τις συναινέσεις της αίτησης (tablet).';

-- 3. The consent texts (the app shows the same, src/features/interviews/applicationModel.js)

create or replace function private.hr_application_consents()
returns jsonb language sql immutable set search_path = ''
as $$
  select jsonb_build_object('version', '2026-10', 'retentionMonths', 24,
    'el', jsonb_build_object(
      'gdpr', 'Συναινώ στην επεξεργασία των προσωπικών μου δεδομένων που περιέχει αυτή η αίτηση από το Νοσοκομείο, ως υπεύθυνο επεξεργασίας, αποκλειστικά για την αξιολόγηση της υποψηφιότητάς μου και τη διαδικασία επιλογής προσωπικού (Κανονισμός (ΕΕ) 2016/679 και ν. 4624/2019). Τα στοιχεία τα βλέπουν μόνο το Γραφείο Προσωπικού και όσοι συμμετέχουν στη συνέντευξη, δεν διαβιβάζονται σε τρίτους και διατηρούνται έως 24 μήνες από την υποβολή, εκτός αν προσληφθώ. Έχω δικαίωμα πρόσβασης, διόρθωσης, διαγραφής, περιορισμού και φορητότητας, μπορώ να ανακαλέσω τη συναίνεσή μου οποτεδήποτε με αίτημα στο Γραφείο Προσωπικού ή στον Υπεύθυνο Προστασίας Δεδομένων και να υποβάλω καταγγελία στην Αρχή Προστασίας Δεδομένων Προσωπικού Χαρακτήρα.',
      'future', 'Συναινώ να εξεταστεί η αίτησή μου και για άλλες θέσεις που θα προκύψουν στο Νοσοκομείο μέσα στους επόμενους 24 μήνες.',
      'references', 'Συναινώ το Γραφείο Προσωπικού να επικοινωνήσει με τους προηγούμενους εργοδότες που δηλώνω, για συστάσεις σχετικά με την εργασία μου.',
      'truth', 'Δηλώνω υπεύθυνα ότι τα στοιχεία της αίτησης είναι αληθή και πλήρη. Γνωρίζω ότι ανακριβή στοιχεία μπορεί να οδηγήσουν σε απόρριψη της αίτησης ή σε λύση της συνεργασίας.'),
    'en', jsonb_build_object(
      'gdpr', 'I consent to the Hospital, as data controller, processing the personal data in this application solely to assess my candidacy and for staff selection (Regulation (EU) 2016/679 and Greek Law 4624/2019). Only the HR office and those taking part in the interview see them; they are not passed to third parties and are kept for up to 24 months from submission, unless I am hired. I have the right of access, rectification, erasure, restriction and portability, I may withdraw my consent at any time by asking the HR office or the Data Protection Officer, and I may lodge a complaint with the Hellenic Data Protection Authority.',
      'future', 'I consent to my application also being considered for other positions that open at the Hospital within the next 24 months.',
      'references', 'I consent to the HR office contacting the previous employers I list, for references about my work.',
      'truth', 'I declare that the details in this application are true and complete. I understand that inaccurate details may lead to the application being rejected or the employment being terminated.'));
$$;
revoke all on function private.hr_application_consents() from public, anon, authenticated;

-- 4. Sanitising helpers --------------------------------------------------------------------

-- A text field: no control characters (line breaks only when p_multiline), trimmed, cut.
create or replace function private.hr_app_t(p jsonb, p_key text, p_max integer, p_multiline boolean default false)
returns text language sql immutable set search_path = ''
as $$
  select nullif(left(btrim(case when p_multiline
      then regexp_replace(regexp_replace(coalesce(p ->> p_key, ''), '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g'), '\r\n?', E'\n', 'g')
      else regexp_replace(regexp_replace(coalesce(p ->> p_key, ''), '[\x01-\x1F\x7F]', ' ', 'g'), '\s+', ' ', 'g') end), p_max), '');
$$;
create or replace function private.hr_app_date(p text)
returns date language plpgsql immutable set search_path = ''
as $$
begin
  if p is null or p !~ '^\d{4}-\d{2}-\d{2}$' then return null; end if;
  if p::date < date '1900-01-01' or p::date > date '2100-01-01' then return null; end if;
  return p::date;
exception when others then
  return null;
end;
$$;
create or replace function private.hr_app_bool(p jsonb, p_key text)
returns boolean language sql immutable set search_path = ''
as $$ select case when jsonb_typeof(p -> p_key) = 'boolean' then (p ->> p_key)::boolean end; $$;
create or replace function private.hr_app_level(p text)
returns text language sql immutable set search_path = ''
as $$ select case when p in ('fluent','very_good','good','fair','basic') then p end; $$;
revoke all on function private.hr_app_t(jsonb, text, integer, boolean), private.hr_app_date(text), private.hr_app_bool(jsonb, text), private.hr_app_level(text) from public, anon, authenticated;

-- 5. HR: a new link ------------------------------------------------------------------------

-- A random 12-character code (A–Z without I/O, 2–9; 60 bits) for one application. Only its
-- SHA-256 is kept; the code itself is returned once, for the QR code and the screen.
create or replace function public.hr_application_link_create(p_organization_id uuid, p_position text default null)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $function$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea := uuid_send(gen_random_uuid()) || uuid_send(gen_random_uuid());
  v_code text := '';
  v_id uuid := gen_random_uuid();
  v_expires timestamptz := now() + interval '24 hours';
  i integer;
begin
  if p_organization_id is null or not public.current_user_has_capability(p_organization_id, 'manage_interviews') then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  if (select count(*) from public.hr_application_links l where l.organization_id = p_organization_id and l.created_at > now() - interval '1 hour') >= 60 then
    raise exception 'HR_APPLICATION_LINKS_BUSY';
  end if;
  -- Bytes 0–5 and 10–15 of each UUID are random (6 and 8 carry the version and variant).
  foreach i in array array[0, 1, 2, 3, 4, 5, 10, 11, 12, 13, 14, 15] loop
    v_code := v_code || substr(v_alphabet, 1 + (get_byte(v_bytes, i) # get_byte(v_bytes, i + 16)) % 32, 1);
  end loop;
  insert into public.hr_application_links (id, organization_id, token_hash, requested_position, created_by, expires_at)
    values (v_id, p_organization_id, encode(sha256(convert_to(v_code, 'UTF8')), 'hex'), nullif(left(btrim(coalesce(p_position, '')), 160), ''), auth.uid(), v_expires);
  return jsonb_build_object('id', v_id, 'token', v_code, 'expiresAt', v_expires, 'position', nullif(left(btrim(coalesce(p_position, '')), 160), ''));
end;
$function$;
revoke all on function public.hr_application_link_create(uuid, text) from public, anon;
grant execute on function public.hr_application_link_create(uuid, text) to authenticated;

-- HR closes a link that was not used (the tablet was not handed over).
create or replace function public.hr_application_link_cancel(p_link_id uuid)
returns void language plpgsql volatile security definer set search_path = ''
as $function$
declare
  v_link public.hr_application_links;
begin
  v_link := (select l from public.hr_application_links l where l.id = p_link_id);
  if v_link.id is null or not public.current_user_has_capability(v_link.organization_id, 'manage_interviews') then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  update public.hr_application_links l set cancelled_at = now() where l.id = p_link_id and l.used_at is null and l.cancelled_at is null;
end;
$function$;
revoke all on function public.hr_application_link_cancel(uuid) from public, anon;
grant execute on function public.hr_application_link_cancel(uuid) to authenticated;

-- 6. The candidate (no account) ------------------------------------------------------------

-- The welcome step of a valid link: the hospital, its logo, the position and the consent
-- texts. A used, expired or cancelled link says so; nothing else is returned.
create or replace function public.hr_application_public(p_token text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $function$
declare
  v_link public.hr_application_links;
  v_org public.organizations;
begin
  p_token := upper(regexp_replace(coalesce(p_token, ''), '[^A-Za-z0-9]', '', 'g'));
  if length(p_token) <> 12 then raise exception 'HR_APPLICATION_NOT_AVAILABLE'; end if;
  v_link := (select l from public.hr_application_links l where l.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex'));
  if v_link.id is null or v_link.cancelled_at is not null then raise exception 'HR_APPLICATION_NOT_AVAILABLE'; end if;
  if v_link.used_at is not null then raise exception 'HR_APPLICATION_USED'; end if;
  if v_link.expires_at <= now() then raise exception 'HR_APPLICATION_EXPIRED'; end if;
  v_org := (select o from public.organizations o where o.id = v_link.organization_id);
  return jsonb_build_object('organizationName', v_org.name,
    'logo', case when coalesce(v_org.branding ->> 'logo', '') like 'data:image/%' and length(v_org.branding ->> 'logo') <= 420000 then v_org.branding ->> 'logo' end,
    'position', v_link.requested_position, 'expiresAt', v_link.expires_at, 'consents', private.hr_application_consents());
end;
$function$;
revoke all on function public.hr_application_public(text) from public;
grant execute on function public.hr_application_public(text) to anon, authenticated;

-- One application through a valid link: the link is spent first (so it cannot be used
-- twice), then the application is written with status «new» and source «tablet», its
-- languages and previous employers, the consents with their texts and the signature.
create or replace function public.hr_application_submit(p_token text, p_payload jsonb)
returns jsonb language plpgsql volatile security definer set search_path = ''
as $function$
declare
  v_link public.hr_application_links;
  v_p jsonb := p_payload;
  v_consents jsonb := case when jsonb_typeof(p_payload -> 'consents') = 'object' then p_payload -> 'consents' else '{}'::jsonb end;
  v_lang text := case when p_payload ->> 'language' = 'en' then 'en' else 'el' end;
  v_texts jsonb := private.hr_application_consents();
  v_signature text := p_payload ->> 'signature';
  v_name text;
  v_email text;
  v_phone text;
  v_id uuid := gen_random_uuid();
  v_count integer;
  v_row jsonb;
  v_position integer := 0;
  v_from date;
  v_to date;
begin
  p_token := upper(regexp_replace(coalesce(p_token, ''), '[^A-Za-z0-9]', '', 'g'));
  if length(p_token) <> 12 then raise exception 'HR_APPLICATION_NOT_AVAILABLE'; end if;
  v_link := (select l from public.hr_application_links l where l.token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex'));
  if v_link.id is null or v_link.cancelled_at is not null then raise exception 'HR_APPLICATION_NOT_AVAILABLE'; end if;
  if v_link.used_at is not null then raise exception 'HR_APPLICATION_USED'; end if;
  if v_link.expires_at <= now() then raise exception 'HR_APPLICATION_EXPIRED'; end if;
  if jsonb_typeof(v_p) <> 'object' or length(v_p::text) > 400000 then raise exception 'HR_APPLICATION_INVALID'; end if;
  v_name := private.hr_app_t(v_p, 'fullName', 160);
  v_email := lower(private.hr_app_t(v_p, 'email', 160));
  if v_email is not null and v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then v_email := null; end if;
  v_phone := private.hr_app_t(v_p, 'phoneMobile', 40);
  if v_name is null or length(v_name) < 3 or (v_phone is null and v_email is null) then raise exception 'HR_APPLICATION_INVALID'; end if;
  if private.hr_app_bool(v_consents, 'gdpr') is not true or private.hr_app_bool(v_consents, 'truth') is not true then raise exception 'HR_APPLICATION_CONSENT_REQUIRED'; end if;
  if v_signature is null or v_signature !~ '^data:image/png;base64,[A-Za-z0-9+/=]+$' or length(v_signature) > 300000 then raise exception 'HR_APPLICATION_SIGNATURE_REQUIRED'; end if;
  if (select count(*) from public.hr_candidates c where c.organization_id = v_link.organization_id and c.source = 'tablet' and c.created_at > now() - interval '1 minute') >= 10 then
    raise exception 'HR_APPLICATION_BUSY';
  end if;

  update public.hr_application_links l set used_at = now() where l.id = v_link.id and l.used_at is null and l.cancelled_at is null and l.expires_at > now();
  get diagnostics v_count = row_count;
  if v_count = 0 then raise exception 'HR_APPLICATION_USED'; end if;

  insert into public.hr_candidates (id, organization_id, code, full_name, gender, father_name, mother_name, birth_date, birth_place, nationality, citizenship,
    address, area, postcode, phone_landline, phone_mobile, email, requested_position, employment_type, military_service, work_permit, practice_licence,
    marital_status, children, education_level, education, it_skills, activities, why_us, applied_on,
    consent_given, consent_at, consent_text, consent_future, consent_references, declaration_truth, consent_version, consent_texts, signed_at,
    status, source, application_link_id, created_by, updated_by)
  values (v_id, v_link.organization_id, '', v_name,
    case when v_p ->> 'gender' in ('male','female','other') then v_p ->> 'gender' end,
    private.hr_app_t(v_p, 'fatherName', 80), private.hr_app_t(v_p, 'motherName', 80),
    case when private.hr_app_date(v_p ->> 'birthDate') < current_date then private.hr_app_date(v_p ->> 'birthDate') end,
    private.hr_app_t(v_p, 'birthPlace', 120), private.hr_app_t(v_p, 'nationality', 80), private.hr_app_t(v_p, 'citizenship', 80),
    private.hr_app_t(v_p, 'address', 200), private.hr_app_t(v_p, 'area', 120), private.hr_app_t(v_p, 'postcode', 12),
    private.hr_app_t(v_p, 'phoneLandline', 40), v_phone, v_email,
    coalesce(v_link.requested_position, private.hr_app_t(v_p, 'requestedPosition', 160)),
    case when v_p ->> 'employmentType' in ('full_time','part_time','seasonal','internship','other') then v_p ->> 'employmentType' end,
    case when v_p ->> 'militaryService' in ('done','exempt','not_done','not_applicable') then v_p ->> 'militaryService' end,
    private.hr_app_bool(v_p, 'workPermit'), private.hr_app_bool(v_p, 'practiceLicence'),
    case when v_p ->> 'maritalStatus' in ('single','married','divorced','widowed','other') then v_p ->> 'maritalStatus' end,
    case when v_p ->> 'children' ~ '^\d{1,2}$' and (v_p ->> 'children')::integer <= 30 then (v_p ->> 'children')::integer end,
    private.hr_app_t(v_p, 'educationLevel', 120),
    coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('level', private.hr_app_t(e, 'level', 80), 'school', private.hr_app_t(e, 'school', 160),
        'title', private.hr_app_t(e, 'title', 160), 'year', case when e ->> 'year' ~ '^(19|20)\d{2}$' then e ->> 'year' end, 'completed', coalesce(private.hr_app_bool(e, 'completed'), true))) order by n)
      from jsonb_array_elements(case when jsonb_typeof(v_p -> 'education') = 'array' then v_p -> 'education' else '[]'::jsonb end) with ordinality x(e, n)
      where n <= 10 and jsonb_typeof(e) = 'object' and coalesce(private.hr_app_t(e, 'school', 160), private.hr_app_t(e, 'title', 160)) is not null), '[]'::jsonb),
    private.hr_app_t(v_p, 'itSkills', 2000, true), private.hr_app_t(v_p, 'activities', 2000, true), private.hr_app_t(v_p, 'whyUs', 2000, true), current_date,
    true, now(), case when v_lang = 'en' then 'Signed on the tablet, version ' else 'Υπογράφηκε στο tablet, έκδοση ' end || (v_texts ->> 'version'),
    coalesce(private.hr_app_bool(v_consents, 'future'), false), coalesce(private.hr_app_bool(v_consents, 'references'), false), true,
    v_texts ->> 'version', jsonb_build_object('language', v_lang) || (v_texts -> v_lang), now(),
    'new', 'tablet', v_link.id, null, null);

  for v_row in select e from jsonb_array_elements(case when jsonb_typeof(v_p -> 'languages') = 'array' then v_p -> 'languages' else '[]'::jsonb end) with ordinality x(e, n) where n <= 12 order by n loop
    continue when jsonb_typeof(v_row) <> 'object' or private.hr_app_t(v_row, 'language', 40) is null;
    insert into public.hr_candidate_languages (organization_id, candidate_id, position, language, speaking, reading, writing, certificate, certificate_name)
      values (v_link.organization_id, v_id, v_position, private.hr_app_t(v_row, 'language', 40), private.hr_app_level(v_row ->> 'speaking'), private.hr_app_level(v_row ->> 'reading'),
        private.hr_app_level(v_row ->> 'writing'), private.hr_app_bool(v_row, 'certificate'), private.hr_app_t(v_row, 'certificateName', 120));
    v_position := v_position + 1;
  end loop;

  v_position := 0;
  for v_row in select e from jsonb_array_elements(case when jsonb_typeof(v_p -> 'employers') = 'array' then v_p -> 'employers' else '[]'::jsonb end) with ordinality x(e, n) where n <= 15 order by n loop
    continue when jsonb_typeof(v_row) <> 'object' or private.hr_app_t(v_row, 'employer', 160) is null;
    v_from := private.hr_app_date(v_row ->> 'fromOn');
    v_to := private.hr_app_date(v_row ->> 'toOn');
    if v_from is not null and v_to is not null and v_to < v_from then v_to := null; end if;
    insert into public.hr_candidate_employers (organization_id, candidate_id, position, employer, from_on, to_on, job_title, leaving_reason)
      values (v_link.organization_id, v_id, v_position, private.hr_app_t(v_row, 'employer', 160), v_from, v_to, private.hr_app_t(v_row, 'jobTitle', 120), private.hr_app_t(v_row, 'leavingReason', 300));
    v_position := v_position + 1;
  end loop;

  insert into public.hr_candidate_signatures (candidate_id, organization_id, image) values (v_id, v_link.organization_id, v_signature);
  update public.hr_application_links l set candidate_id = v_id where l.id = v_link.id;
  return jsonb_build_object('ok', true);
end;
$function$;
revoke all on function public.hr_application_submit(text, jsonb) from public;
grant execute on function public.hr_application_submit(text, jsonb) to anon, authenticated;
