-- Συνεντεύξεις: the FileMaker «HR Data» (applications), «HR Data ERGODOTES» (previous
-- employers) and «HR Language» (languages) moved into the hr_* tables. Each FileMaker
-- record moved is written in fm_stage_links, so the import runs again without
-- duplicates (a new FileMaker record is added, one already moved is left as it is).
--
-- The children find their application by the number FileMaker keeps in
-- «HR DATA ERGO ID» / «HR DATA language ID»: the digits of the application's
-- PrimaryKey read as a number (compared as double precision, as FileMaker stored it).
-- The application also has one employer and a language grid of its own (ΕΛΛΗΝΙΚΑ /
-- ΑΓΓΛΙΚΑ … ΕΥΧ / ΜΕΤΡ / CERT, with the «Copy» / «Copy2» columns read as reading and
-- writing); they are added once, a language only when «HR Language» does not have it.
-- ΑΞΙΟΛΟΓΗΤΗΣ 1 / 2 and HR become the interview's evaluators (linked to the employee of
-- the same name), ΠΡΟΤΑΣΗ ΣΥΝΕΡΓΑΣΙΑΣ its recommendation, ΜΙΣΘΟΣ ΜΜΑ the salary
-- asked, ΕΞΟΔΟΛΟΓΙΟ / ΣΚΛΑΒΕΝΙΤΗΣ / ΑΣΦΑΛΕΙΑ the benefits. A successful candidate
-- (STATUS «ΕΠΙΤΥΧΗΣ») with an employee of the same name is marked hired and linked to
-- that employee. ΥΓΕΙΑ (health) is not moved: medical data stays out of HR.

create or replace function private.hr_fm_norm(p text)
returns text language sql immutable set search_path = ''
as $$
  select nullif(btrim(regexp_replace(upper(translate(coalesce(p, ''), 'άέήίόύώϊϋΐΰΆΈΉΊΌΎΏ', 'αεηιουωιυιυΑΕΗΙΟΥΩ')), '\s+', ' ', 'g')), '');
$$;
create or replace function private.hr_fm_bool(p text)
returns boolean language sql immutable set search_path = ''
as $$
  select case when private.hr_fm_norm(p) in ('ΝΑΙ','NAI','YES','Y','TRUE','1','X') then true
    when private.hr_fm_norm(p) in ('ΟΧΙ','OXI','NO','N','FALSE','0') then false end;
$$;
create or replace function private.hr_fm_t(d jsonb, k text)
returns text language sql immutable set search_path = ''
as $$ select nullif(btrim(d ->> k), ''); $$;
create or replace function private.hr_fm_date(p text)
returns date language sql immutable set search_path = ''
as $$
  select case when p ~ '^\d{4}-\d{2}-\d{2}' then left(p, 10)::date
    when p ~ '^\d{1,2}/\d{1,2}/\d{4}$' then to_date(p, 'DD/MM/YYYY') end;
$$;
create or replace function private.hr_fm_num(p text)
returns numeric language sql immutable set search_path = ''
as $$ select case when replace(p, ',', '.') ~ '^-?\d+(\.\d+)?$' then replace(p, ',', '.')::numeric end; $$;
create or replace function private.hr_fm_key(p text)
returns double precision language sql immutable set search_path = ''
as $$ select nullif(regexp_replace(coalesce(p, ''), '\D', '', 'g'), '')::double precision; $$;
create or replace function private.hr_fm_level(p text)
returns text language sql immutable set search_path = ''
as $$
  select case when private.hr_fm_norm(p) ~ 'ΕΥΧΕΡ|FLUENT|ΑΡΙΣΤ|EXCELLENT' then 'fluent'
    when private.hr_fm_norm(p) ~ 'ΚΑΛ|GOOD|ΠΟΛΥ' then 'good'
    when private.hr_fm_norm(p) ~ 'ΜΕΤΡ|FAIR' then 'fair'
    when private.hr_fm_norm(p) ~ 'ΒΑΣΙΚ|ΣΤΟΙΧ|BASIC|ΛΙΓ' then 'basic' end;
$$;
-- A language as the app keeps it: el, en, fr, de, it, sq, ru or the text itself.
create or replace function private.hr_fm_lang(p text)
returns text language sql immutable set search_path = ''
as $$
  select case when private.hr_fm_norm(p) ~ 'ΑΓΓΛ|ENGL' then 'en' when private.hr_fm_norm(p) ~ 'ΓΑΛΛ|FRAN|FREN' then 'fr'
    when private.hr_fm_norm(p) ~ 'ΓΕΡΜ|GERM' then 'de' when private.hr_fm_norm(p) ~ 'ΙΤΑΛ|ITAL' then 'it'
    when private.hr_fm_norm(p) ~ 'ΑΛΒΑΝ|ALBAN' then 'sq' when private.hr_fm_norm(p) ~ 'ΡΩΣ|RUSS' then 'ru'
    when private.hr_fm_norm(p) ~ 'ΕΛΛΗΝ|GREEK' then 'el' else nullif(btrim(p), '') end;
$$;
-- The one employee of the organization with this name («ΕΠΩΝΥΜΟ ΟΝΟΜΑ» or «ΟΝΟΜΑ ΕΠΩΝΥΜΟ»).
create or replace function private.hr_fm_employee(p_org uuid, p_name text)
returns uuid language sql stable set search_path = ''
as $$
  select case when count(*) = 1 then min(e.id::text)::uuid end from public.employees e
  where e.organization_id = p_org and private.hr_fm_norm(p_name) is not null
    and private.hr_fm_norm(p_name) in (private.hr_fm_norm(e.last_name || ' ' || e.first_name), private.hr_fm_norm(e.first_name || ' ' || e.last_name));
$$;
revoke all on function private.hr_fm_norm(text), private.hr_fm_bool(text), private.hr_fm_t(jsonb, text), private.hr_fm_date(text), private.hr_fm_num(text), private.hr_fm_key(text), private.hr_fm_level(text), private.hr_fm_lang(text), private.hr_fm_employee(uuid, text) from public, anon, authenticated;

-- The app's value for a FileMaker choice: gender, employment type, military service, marital status.
create or replace function private.hr_fm_code(p_kind text, p text)
returns text language sql immutable set search_path = ''
as $$
  select case p_kind
    when 'gender' then case when private.hr_fm_norm(p) ~ '^(ΑΝΔΡ|ΑΡΡ|MALE|M$)' then 'male' when private.hr_fm_norm(p) ~ '^(ΓΥΝ|ΘΗΛ|FEMALE|F$)' then 'female' end
    when 'employment' then case when private.hr_fm_norm(p) ~ 'ΠΛΗΡ|FULL' then 'full_time' when private.hr_fm_norm(p) ~ 'ΜΕΡΙΚ|PART' then 'part_time'
      when private.hr_fm_norm(p) ~ 'ΕΠΟΧ|SEASON' then 'seasonal' when private.hr_fm_norm(p) ~ 'ΠΡΑΚΤ|INTERN' then 'internship' when private.hr_fm_norm(p) is not null then 'other' end
    when 'military' then case when private.hr_fm_norm(p) ~ 'ΑΠΑΛΛ|EXEMPT' then 'exempt' when private.hr_fm_bool(p) or private.hr_fm_norm(p) ~ 'ΕΚΠΛΗΡ' then 'done'
      when private.hr_fm_bool(p) = false then 'not_done' end
    when 'marital' then case when private.hr_fm_norm(p) ~ 'ΕΓΓΑΜ|MARRIED' then 'married' when private.hr_fm_norm(p) ~ 'ΑΓΑΜ|SINGLE' then 'single'
      when private.hr_fm_norm(p) ~ 'ΔΙΑΖ|ΔΙΑΣΤ|DIVORC' then 'divorced' when private.hr_fm_norm(p) ~ 'ΧΗΡ|WIDOW' then 'widowed' when private.hr_fm_norm(p) is not null then 'other' end
    when 'status' then case when private.hr_fm_norm(p) ~ 'ΑΡΝΗΘ' then 'withdrawn' when private.hr_fm_norm(p) ~ 'ΑΠΟΡΡ|ΑΠΟΤΥΧ|ΑΚΑΤΑΛ' then 'rejected'
      when private.hr_fm_norm(p) ~ '^ΕΠΙΤΥΧ' then 'offer' end
  end;
$$;
-- Consent: the text of «Δήλωση συναίνεσης»; given unless it says no.
create or replace function private.hr_fm_consent(d jsonb)
returns boolean language sql immutable set search_path = ''
as $$ select private.hr_fm_t(d, 'Δήλωση συναίνεσης') is not null and private.hr_fm_bool(d ->> 'Δήλωση συναίνεσης') is distinct from false; $$;
revoke all on function private.hr_fm_code(text, text), private.hr_fm_consent(jsonb) from public, anon, authenticated;

-- The applications.
create or replace function private.hr_fm_import_candidates()
returns integer language plpgsql security definer set search_path = ''
as $$
declare
  r record; d jsonb; v_org uuid; v_id uuid; v_emp uuid; v_status text; n integer := 0;
begin
  select t.organization_id into v_org from public.fm_stage_tables t where t.base_table = 'HR Data';
  for r in select s.record_id, s.data from public.fm_stage_records s where s.base_table = 'HR Data'
    and not exists (select 1 from public.fm_stage_links l where l.base_table = 'HR Data' and l.record_id = s.record_id and l.target_table = 'hr_candidates')
    and private.hr_fm_t(s.data, 'ΟΝΟΜΑΤΕΠΩΝΥΜΟ') is not null order by s.record_id::integer
  loop
    d := r.data;
    v_emp := private.hr_fm_employee(v_org, private.hr_fm_t(d, 'ΟΝΟΜΑΤΕΠΩΝΥΜΟ'));
    v_status := coalesce(private.hr_fm_code('status', d ->> 'STATUS'), case when coalesce(d ->> 'ΑΞΙΟΛΟΓΗΤΗΣ 1', d ->> 'ΑΞΙΟΛΟΓΗΤΗΣ 2', d ->> 'HR', '') <> '' then 'interviewed' else 'new' end);
    if v_status = 'offer' and v_emp is not null then v_status := 'hired'; end if;
    insert into public.hr_candidates (organization_id, code, full_name, gender, father_name, mother_name, birth_date, birth_place, nationality, citizenship,
      id_number, id_authority, id_issued_on, address, area, postcode, phone_landline, phone_mobile, email, requested_position, employment_type,
      military_service, work_permit, practice_licence, smoker, marital_status, children, education_level, education, it_skills, activities, why_us,
      application_reason, applied_on, consent_given, consent_at, consent_text, status, decision, decision_on, decision_notes, employee_id, source, notes,
      created_by, created_at, updated_by, updated_at)
    values (v_org, '', private.hr_fm_t(d, 'ΟΝΟΜΑΤΕΠΩΝΥΜΟ'), private.hr_fm_code('gender', d ->> 'ΦΥΛΟ'),
      private.hr_fm_t(d, 'ΟΝΟΜΑ ΠΑΤΡΟΣ'), private.hr_fm_t(d, 'ΟΝΟΜΑ ΜΗΤΡΟΣ'), private.hr_fm_date(d ->> 'ΗΜΕΡΟΜΗΝΙΑ ΓΕΝΝΗΣΗΣ'), private.hr_fm_t(d, 'ΤΟΠΟΣ ΓΕΝΝΗΣΗΣ'),
      private.hr_fm_t(d, 'ΕΘΝΗΚΟΤΗΤΑ'), private.hr_fm_t(d, 'ΕΠΙΚΟΟΤΗΤΑ'), private.hr_fm_t(d, 'ΑΡ. ΤΑΥΤΟΤΗΤΑΣ'), private.hr_fm_t(d, 'ΕΚΔΟΥΣΑ ΑΡΧΗ'), private.hr_fm_date(d ->> 'ΗΜΕΡΟΜΗΝΙΑ ΕΚΔΟΣΗΣ'),
      private.hr_fm_t(d, 'ΔΙΕΥΘΥΝΣΗ ΚΑΤΟΙΚΙΑΣ'), private.hr_fm_t(d, 'ΠΕΡΙΟΧΗ'), private.hr_fm_t(d, 'ΤΚ'), private.hr_fm_t(d, 'ΣΤΑΘΕΡΟ ΤΗΛ'), private.hr_fm_t(d, 'ΚΙΝΗΤΟ ΤΗΛ'), lower(private.hr_fm_t(d, 'EMAIL')),
      private.hr_fm_t(d, 'ΑΙΤΟΥΜΕΝΗ ΘΕΣΗ ΕΡΓΑΣΙΑΣ'), private.hr_fm_code('employment', d ->> 'ΕΙΔΟΣ ΑΠΑΣΧΟΛΗΣΗΣ'), private.hr_fm_code('military', d ->> 'ΣΤΡΑΤΙΩΤΙΚΗ ΘΗΤΕΙΑ'),
      private.hr_fm_bool(d ->> 'ΑΔΕΙΑ ΕΡΓΑΣΙΑΣ'), private.hr_fm_bool(d ->> 'ΑΔΕΙΑ ΑΣΚΗΣΕΩΣ ΕΠΑΓΓΕΛΜΑΤΟΣ'), private.hr_fm_bool(d ->> 'ΚΑΠΝΙΣΜΑ'), private.hr_fm_code('marital', d ->> 'ΟΙΚΟΓΕΝΕΙΑΚΑ ΣΤΟΙΧΕΙΑ'),
      (select x::integer from private.hr_fm_num(d ->> 'ΑΡΙΘΜΟΣ ΠΑΙΔΙΩΝ') x where x between 0 and 30),
      private.hr_fm_t(d, 'ΕΚΠΑΙΔΕΥΣΗ'), private.hr_fm_education(d), private.hr_fm_t(d, 'ΠΛΗΡΟΦΟΡΙΚΗ'), private.hr_fm_t(d, 'ΔΡΑΣΤΗΡΙΟΤΗΤΕΣ'), private.hr_fm_t(d, 'ΕΠΙΛΟΓΗ ΙΑΣΩ'),
      private.hr_fm_t(d, 'ΓΙΑΤΙ'), coalesce(private.hr_fm_date(d ->> 'CreationTimestamp'), current_date),
      private.hr_fm_consent(d), case when private.hr_fm_consent(d) then coalesce((d ->> 'CreationTimestamp')::timestamptz, now()) end, private.hr_fm_t(d, 'Δήλωση συναίνεσης'),
      v_status, case when v_status in ('offer','hired','withdrawn') then 'hire' when v_status = 'rejected' then 'reject' end,
      case when d ->> 'STATUS' <> '' then private.hr_fm_date(d ->> 'ModificationTimestamp') end, 'FileMaker: ' || private.hr_fm_t(d, 'STATUS'),
      case when v_status = 'hired' then v_emp end, 'filemaker', private.hr_fm_t(d, 'NOTES'),
      null, coalesce((d ->> 'CreationTimestamp')::timestamptz, now()), null, coalesce((d ->> 'ModificationTimestamp')::timestamptz, now()))
    returning id into v_id;
    insert into public.fm_stage_links (base_table, record_id, target_table, target_id, how) values ('HR Data', r.record_id, 'hr_candidates', v_id, 'created');
    if v_status = 'hired' then
      insert into public.fm_stage_links (base_table, record_id, target_table, target_id, how, note) values ('HR Data', r.record_id, 'employees', v_emp, 'matched', 'hired candidate, employee of the same name');
    end if;
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- An application's education: up to four schools (ΣΧΟΛΗ 1–4) with the year and the degree.
create or replace function private.hr_fm_education(d jsonb)
returns jsonb language sql immutable set search_path = ''
as $$
  select coalesce(jsonb_agg(x order by i) filter (where x ? 'school' or x ? 'year'), '[]'::jsonb) from (values
    (1, jsonb_strip_nulls(jsonb_build_object('level', private.hr_fm_t(d, 'ΕΚΠΑΙΔΕΥΣΗ 2'), 'school', case when private.hr_fm_bool(d ->> 'ΣΧΟΛΗ 1') is null then private.hr_fm_t(d, 'ΣΧΟΛΗ 1') end, 'year', private.hr_fm_t(d, 'ΕΤΟΣ ΑΠΟΦΟΙΤΗΣΗΣ 1'), 'completed', private.hr_fm_bool(d ->> 'ΠΤΥΧΙΟ 1')))),
    (2, jsonb_strip_nulls(jsonb_build_object('school', case when private.hr_fm_bool(d ->> 'ΣΧΟΛΗ 2') is null then private.hr_fm_t(d, 'ΣΧΟΛΗ 2') end, 'year', private.hr_fm_t(d, 'ΕΤΟΣ ΑΠΟΦΟΙΤΗΣΗΣ 2'), 'completed', private.hr_fm_bool(d ->> 'ΠΤΥΧΙΟ 2')))),
    (3, jsonb_strip_nulls(jsonb_build_object('school', case when private.hr_fm_bool(d ->> 'ΣΧΟΛΗ 3') is null then private.hr_fm_t(d, 'ΣΧΟΛΗ 3') end, 'year', private.hr_fm_t(d, 'ΕΤΟΣ ΚΤΗΣΗΣ 1'), 'completed', private.hr_fm_bool(d ->> 'ΠΤΥΧΙΟ 3')))),
    (4, jsonb_strip_nulls(jsonb_build_object('school', case when private.hr_fm_bool(d ->> 'ΣΧΟΛΗ 4') is null then private.hr_fm_t(d, 'ΣΧΟΛΗ 4') end, 'year', private.hr_fm_t(d, 'ΕΤΟΣ ΚΤΗΣΗΣ 2'), 'completed', private.hr_fm_bool(d ->> 'ΠΤΥΧΙΟ 4'))))
  ) v(i, x);
$$;
revoke all on function private.hr_fm_education(jsonb) from public, anon, authenticated;

-- The previous employers: «HR Data ERGODOTES» and the one kept on the application.
create or replace function private.hr_fm_import_employers()
returns integer language plpgsql security definer set search_path = ''
as $$
declare r record; v_id uuid; n integer := 0;
begin
  for r in select s.record_id, s.data d, c.id candidate_id, c.organization_id from public.fm_stage_records s
    join public.fm_stage_records p on p.base_table = 'HR Data' and private.hr_fm_key(p.data ->> 'PrimaryKey') = (s.data ->> 'HR DATA ERGO ID')::double precision
    join public.fm_stage_links l on l.base_table = 'HR Data' and l.record_id = p.record_id and l.target_table = 'hr_candidates'
    join public.hr_candidates c on c.id = l.target_id
    where s.base_table = 'HR Data ERGODOTES' and private.hr_fm_t(s.data, 'ΕΠΩΝΥΜΙΑ ΕΡΓΟΔΟΤΗ') is not null
      and not exists (select 1 from public.fm_stage_links x where x.base_table = 'HR Data ERGODOTES' and x.record_id = s.record_id and x.target_table = 'hr_candidate_employers')
    union all
    select p.record_id, p.data, c.id, c.organization_id from public.fm_stage_records p
    join public.fm_stage_links l on l.base_table = 'HR Data' and l.record_id = p.record_id and l.target_table = 'hr_candidates'
    join public.hr_candidates c on c.id = l.target_id
    where p.base_table = 'HR Data' and private.hr_fm_t(p.data, 'ΕΠΩΝΥΜΙΑ ΕΡΓΟΔΟΤΗ') is not null
      and not exists (select 1 from public.fm_stage_links x where x.base_table = 'HR Data' and x.record_id = p.record_id and x.target_table = 'hr_candidate_employers')
  loop
    insert into public.hr_candidate_employers (organization_id, candidate_id, position, employer, from_on, to_on, job_title, salary, leaving_reason)
    values (r.organization_id, r.candidate_id, (select count(*) from public.hr_candidate_employers e where e.candidate_id = r.candidate_id),
      private.hr_fm_t(r.d, 'ΕΠΩΝΥΜΙΑ ΕΡΓΟΔΟΤΗ'), private.hr_fm_date(r.d ->> 'ΑΠΟ'),
      case when private.hr_fm_date(r.d ->> 'ΕΩΣ') >= coalesce(private.hr_fm_date(r.d ->> 'ΑΠΟ'), '-infinity'::date) then private.hr_fm_date(r.d ->> 'ΕΩΣ') end,
      private.hr_fm_t(r.d, 'ΘΕΣΗ'), private.hr_fm_num(r.d ->> 'ΜΙΣΘΟΣ'), private.hr_fm_t(r.d, 'ΛΟΓΟΣ ΑΠΟΧΩΡΗΣΗΣ'))
    returning id into v_id;
    insert into public.fm_stage_links (base_table, record_id, target_table, target_id, how, note)
    values (case when r.d ? 'HR DATA ERGO ID' then 'HR Data ERGODOTES' else 'HR Data' end, r.record_id, 'hr_candidate_employers', v_id, 'created', null);
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- The languages: «HR Language», then the application's own (ΓΛΩΣΣΑ with ΟΜΙΛΙΑ /
-- ΑΝΑΓΝΩΣΗ / ΓΡΑΦΗ, and the grid) for the languages not already there.
create or replace function private.hr_fm_import_languages()
returns integer language plpgsql security definer set search_path = ''
as $$
declare r record; g record; v_id uuid; n integer := 0;
begin
  for r in select s.record_id, s.data d, c.id candidate_id, c.organization_id from public.fm_stage_records s
    join public.fm_stage_records p on p.base_table = 'HR Data' and private.hr_fm_key(p.data ->> 'PrimaryKey') = (s.data ->> 'HR DATA language ID')::double precision
    join public.fm_stage_links l on l.base_table = 'HR Data' and l.record_id = p.record_id and l.target_table = 'hr_candidates'
    join public.hr_candidates c on c.id = l.target_id
    where s.base_table = 'HR Language' and private.hr_fm_t(s.data, 'Γλώσσα') is not null
      and not exists (select 1 from public.fm_stage_links x where x.base_table = 'HR Language' and x.record_id = s.record_id and x.target_table = 'hr_candidate_languages')
  loop
    insert into public.hr_candidate_languages (organization_id, candidate_id, position, language, reading, writing, speaking, certificate)
    values (r.organization_id, r.candidate_id, (select count(*) from public.hr_candidate_languages e where e.candidate_id = r.candidate_id), private.hr_fm_lang(r.d ->> 'Γλώσσα'),
      private.hr_fm_level(r.d ->> 'Ανάγνωση'), private.hr_fm_level(r.d ->> 'Γραφή'), private.hr_fm_level(r.d ->> 'Ομιλία'), private.hr_fm_bool(r.d ->> 'Πιστοποιητικό'))
    returning id into v_id;
    insert into public.fm_stage_links (base_table, record_id, target_table, target_id, how) values ('HR Language', r.record_id, 'hr_candidate_languages', v_id, 'created');
    n := n + 1;
  end loop;
  for r in select p.record_id, p.data d, c.id candidate_id, c.organization_id from public.fm_stage_records p
    join public.fm_stage_links l on l.base_table = 'HR Data' and l.record_id = p.record_id and l.target_table = 'hr_candidates'
    join public.hr_candidates c on c.id = l.target_id
    where p.base_table = 'HR Data'
      and not exists (select 1 from public.fm_stage_links x where x.base_table = 'HR Data' and x.record_id = p.record_id and x.target_table = 'hr_candidate_languages')
  loop
    for g in select * from (
      select 0 o, private.hr_fm_lang(r.d ->> 'ΓΛΩΣΣΑ') lang, private.hr_fm_level(r.d ->> 'ΑΝΑΓΝΩΣΗ') rd, private.hr_fm_level(r.d ->> 'ΓΡΑΦΗ') wr, private.hr_fm_level(r.d ->> 'ΟΜΙΛΙΑ') sp, null::boolean cert
      where r.d ->> 'ΓΛΩΣΣΑ' !~ '[\r\n]' and coalesce(r.d ->> 'ΑΝΑΓΝΩΣΗ', r.d ->> 'ΓΡΑΦΗ', r.d ->> 'ΟΜΙΛΙΑ', '') <> ''
      union all
      select k.o, k.code,
        case when private.hr_fm_bool(r.d ->> (k.f || ' ΕΥΧ Copy')) then 'fluent' when private.hr_fm_bool(r.d ->> (k.f || ' ΜΕΤΡ Copy')) then 'fair' end,
        case when private.hr_fm_bool(r.d ->> (k.f || ' ΕΥΧ Copy2')) then 'fluent' when private.hr_fm_bool(r.d ->> (k.f || ' ΜΕΤΡ Copy2')) then 'fair' end,
        case when private.hr_fm_bool(r.d ->> (k.f || ' ΕΥΧ')) then 'fluent' when private.hr_fm_bool(r.d ->> (k.f || ' ΜΕΤΡ')) then 'fair' end,
        private.hr_fm_bool(r.d ->> (k.f || ' CERT'))
      from (values (1, 'el', 'ΕΛΛΗΝΙΚΑ'), (2, 'en', 'ΑΓΓΛΙΚΑ'), (3, 'fr', 'ΓΑΛΛΙΚΑ'), (4, 'de', 'ΓΕΡΜΑΝΙΚΑ'), (5, 'it', 'ΙΤΑΛΙΚΑ'), (6, 'sq', 'ΑΛΒΑΝΙΚΑ'), (7, 'ru', 'ΡΩΣΙΚΑ'), (8, 'Άλλη', 'ΑΛΛΟ')) k(o, code, f)
    ) x where x.lang is not null and coalesce(x.rd, x.wr, x.sp) is not null order by x.o
    loop
      if not exists (select 1 from public.hr_candidate_languages e where e.candidate_id = r.candidate_id and e.language = g.lang) then
        insert into public.hr_candidate_languages (organization_id, candidate_id, position, language, reading, writing, speaking, certificate)
        values (r.organization_id, r.candidate_id, (select count(*) from public.hr_candidate_languages e where e.candidate_id = r.candidate_id), g.lang, g.rd, g.wr, g.sp, g.cert);
        n := n + 1;
      end if;
    end loop;
    insert into public.fm_stage_links (base_table, record_id, target_table, target_id, how, note) values ('HR Data', r.record_id, 'hr_candidate_languages', r.candidate_id, 'created', 'the application''s own languages');
  end loop;
  return n;
end;
$$;

-- The interview of an application: evaluators, recommendation, salary and benefits.
create or replace function private.hr_fm_import_interviews()
returns integer language plpgsql security definer set search_path = ''
as $$
declare r record; v_id uuid; n integer := 0;
begin
  for r in select p.record_id, p.data d, c.id candidate_id, c.organization_id, c.status from public.fm_stage_records p
    join public.fm_stage_links l on l.base_table = 'HR Data' and l.record_id = p.record_id and l.target_table = 'hr_candidates'
    join public.hr_candidates c on c.id = l.target_id
    where p.base_table = 'HR Data'
      and coalesce(private.hr_fm_t(p.data, 'ΑΞΙΟΛΟΓΗΤΗΣ 1'), private.hr_fm_t(p.data, 'ΑΞΙΟΛΟΓΗΤΗΣ 2'), private.hr_fm_t(p.data, 'HR'), private.hr_fm_t(p.data, 'ΠΡΟΤΑΣΗ ΣΥΝΕΡΓΑΣΙΑΣ')) is not null
      and not exists (select 1 from public.fm_stage_links x where x.base_table = 'HR Data' and x.record_id = p.record_id and x.target_table = 'hr_interviews')
  loop
    insert into public.hr_interviews (organization_id, candidate_id, status, interviewers, outcome, recommendation, salary_expectation, benefits, evaluated_at, evaluated_by_name, source, created_by, updated_by)
    values (r.organization_id, r.candidate_id, 'completed',
      (select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('name', v.name, 'role', v.role, 'employeeId', private.hr_fm_employee(r.organization_id, v.name))) order by v.o), '[]'::jsonb)
        from (values (1, private.hr_fm_t(r.d, 'ΑΞΙΟΛΟΓΗΤΗΣ 1'), 'evaluator'), (2, private.hr_fm_t(r.d, 'ΑΞΙΟΛΟΓΗΤΗΣ 2'), 'evaluator'), (3, private.hr_fm_t(r.d, 'HR'), 'hr')) v(o, name, role) where v.name is not null),
      case when r.status in ('offer','hired','withdrawn') then 'recommend' when r.status = 'rejected' then 'not_recommend' end,
      private.hr_fm_t(r.d, 'ΠΡΟΤΑΣΗ ΣΥΝΕΡΓΑΣΙΑΣ'), private.hr_fm_num(r.d ->> 'ΜΙΣΘΟΣ ΜΜΑ'),
      nullif(concat_ws(' · ', 'Εξοδολόγιο: ' || private.hr_fm_t(r.d, 'ΕΞΟΔΟΛΟΓΙΟ'), 'Σκλαβενίτης: ' || private.hr_fm_t(r.d, 'ΣΚΛΑΒΕΝΙΤΗΣ'), 'Ασφάλεια: ' || private.hr_fm_t(r.d, 'ΑΣΦΑΛΕΙΑ')), ''),
      (r.d ->> 'ModificationTimestamp')::timestamptz, private.hr_fm_t(r.d, 'HR'), 'filemaker', null, null)
    returning id into v_id;
    insert into public.fm_stage_links (base_table, record_id, target_table, target_id, how) values ('HR Data', r.record_id, 'hr_interviews', v_id, 'created');
    n := n + 1;
  end loop;
  return n;
end;
$$;

create or replace function private.hr_import_filemaker()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_c integer; v_e integer; v_l integer; v_i integer;
begin
  v_c := private.hr_fm_import_candidates();
  v_e := private.hr_fm_import_employers();
  v_l := private.hr_fm_import_languages();
  v_i := private.hr_fm_import_interviews();
  return jsonb_build_object('candidates', v_c, 'employers', v_e, 'languages', v_l, 'interviews', v_i);
end;
$$;
revoke all on function private.hr_fm_import_candidates(), private.hr_fm_import_employers(), private.hr_fm_import_languages(), private.hr_fm_import_interviews(), private.hr_import_filemaker() from public, anon, authenticated;

select private.hr_import_filemaker();
