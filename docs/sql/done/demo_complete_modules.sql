-- Demo πλήρες: όλες οι ενότητες γεμάτες και «Επαναφορά δεδομένων» από τον αξιολογητή.
-- Τρέχει στο SQL Editor του Supabase (περιέχει revoke, που δεν τα εκτελεί ο agent).
-- Δημιουργεί/αντικαθιστά μόνο συναρτήσεις· δεν αλλάζει δεδομένα κανενός νοσοκομείου.
-- Τα Demo γεμίζουν με τα νέα δεδομένα όταν δημιουργηθούν ή γίνει «Επαναφορά δεδομένων».
-- Πηγές: supabase/migrations/20261231350000 … 20261231410000.
begin;

-- ===== 20261231350000_demo_seed_rosters_regulations.sql =====
-- Demo data for the modules that every Demo organization had empty: the department shift rosters and the
-- requests of their people (src/features/rosters/rosterService.js, demo part), the regulations with their
-- editions, drafts and signatures (src/features/regulations/regulationService.js, demoState), the Hour-1 sepsis
-- protocols and the 48–72 h antimicrobial reviews of the episodes (protocolDemoData.js), the epidemiological
-- questionnaires of the episodes (epiQuestionnaireDemoHistory.js) and the protocol update suggestions of the
-- controlled documents (protocolReviewDemoData.js). Everything is built from the Demo's own departments,
-- employees, episodes, therapies and documents (seeded before this), with dates relative to today; the
-- rotas get six ward staff per department. Names are made up. Safe on a freshly wiped Demo; a second run adds nothing that already exists.

-- The approved content of a regulation from its template (as contentFromTemplate in regulationModel.js):
-- {hospital} filled in, each section keeps its origin; an approved text loses the «fill in» hints.
create or replace function private.demo_regulation_content(p_key text, p_hospital text, p_note text, p_strip boolean)
returns jsonb language sql stable set search_path = ''
as $function$
  select jsonb_build_object('chapters', coalesce(jsonb_agg(jsonb_build_object(
    'id', c.ch->>'id',
    'title', replace(c.ch->>'title', '{hospital}', p_hospital),
    'sections', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', x.s->>'id', 'origin', x.s->>'id',
        'title', replace(x.s->>'title', '{hospital}', p_hospital),
        'html', case when p_strip then regexp_replace(replace(coalesce(x.s->>'html', ''), '{hospital}', replace(replace(replace(p_hospital, '&', '&amp;'), '<', '&lt;'), '>', '&gt;')), '<p class="reg-fill">[^<]*</p>', '', 'g')
                     else replace(coalesce(x.s->>'html', ''), '{hospital}', replace(replace(replace(p_hospital, '&', '&amp;'), '<', '&lt;'), '>', '&gt;')) end
          || case when c.ci = 1 and x.si = 1 and p_note is not null then '<p>' || p_note || '</p>' else '' end)
        order by x.si), '[]'::jsonb)
      from jsonb_array_elements(c.ch->'sections') with ordinality x(s, si)))
    order by c.ci), '[]'::jsonb))
  from public.regulation_templates t
  cross join lateral jsonb_array_elements(t.content->'chapters') with ordinality c(ch, ci)
  where t.key = p_key;
$function$;
revoke all on function private.demo_regulation_content(text, text, text, boolean) from public, anon, authenticated;

-- The ward staff of the rotas: six nurses and nursing assistants in each of the eight Demo departments
-- (EMP-101 on), a head nurse where the department has none and one more nurse in the Internal Medicine
-- ward (one of its people is on leave), with the same columns as the other Demo employees
-- (demo_seed_hand_hygiene_employees). Their vaccinations follow demo_seed_occupational_health; their job
-- description acceptances, certificates and evaluations come from demo_seed_people_employees and their
-- trainings from demo_seed_training, which add what is missing and rewrite their own rows in place.
create or replace function private.demo_seed_roster_staff(v_org uuid, p_actor uuid)
returns void language plpgsql set search_path = ''
as $function$
declare
  d0 date := current_date;
  ff text[] := array['Αικατερίνη','Ζωή','Ειρήνη','Θεοδώρα','Παρασκευή','Φωτεινή','Ευτυχία','Σταυρούλα','Αθηνά','Χρυσούλα','Ολυμπία','Δέσποινα'];
  fm text[] := array['Ηλίας','Στέλιος','Θοδωρής','Λευτέρης','Μάνος','Αλέξανδρος','Στάθης','Πέτρος','Φώτης','Άρης','Τάσος','Ορέστης'];
  lf text[] := array['Τσιρίγου','Λαζαρίδου','Καραλή','Μπακάλη','Ζαχαρίου','Χατζή','Ρήγα','Σαββίδου','Πετράκη','Αλεξίου','Μιχαηλίδου','Ξυδάκη'];
  lm text[] := array['Τσίριγος','Λαζαρίδης','Καραλής','Μπακάλης','Ζαχαρίου','Χατζής','Ρήγας','Σαββίδης','Πετράκης','Αλεξίου','Μιχαηλίδης','Ξυδάκης'];
begin
  insert into public.employees(organization_id, employee_code, first_name, last_name, first_name_en, last_name_en, department_id, department_name,
    profession_name, position_name, employment_status, hire_date, email, created_by, updated_by)
  select v_org, 'EMP-' || s.g::text,
    case when s.g % 3 = 0 then fm[1 + (s.g * 5) % 12] else ff[1 + (s.g * 5) % 12] end,
    case when s.g % 3 = 0 then lm[1 + (s.g * 7 + s.ord) % 12] else lf[1 + (s.g * 7 + s.ord) % 12] end,
    null, null, s.dep_id, s.dep_name,
    case when s.k in (5, 6) then 'Βοηθός Νοσηλευτή' when s.code in ('ΜΑΙ', 'ΑΤ') then 'Μαία / Μαιευτής' else 'Νοσηλευτής / Νοσηλεύτρια' end,
    case when s.k = 7 then 'Προϊστάμενος Τμήματος' when s.k in (5, 6) then 'Βοηθός Νοσηλευτή' when s.code in ('ΜΑΙ', 'ΑΤ') then 'Μαία Τμήματος' else 'Νοσηλευτής Τμήματος' end,
    -- One of the new people is on leave in the register (and comes in out of the roster).
    case when s.g = 113 then 'leave' else 'active' end,
    d0 - (150 + (s.g * 67) % 3200), 'emp' || s.g::text || '@demo.invalid', p_actor, p_actor
  from (
    select dep.id as dep_id, dep.name as dep_name, o.code, o.ord, k, 100 + (o.ord - 1) * 8 + k as g
    from (values ('ΜΕΘ', 1), ('ΠΑΘ', 2), ('ΧΕΙΡ', 3), ('ΚΑΡΔ', 4), ('ΟΡΘ', 5), ('ΝΕΦ', 6), ('ΠΑΙΔ', 7), ('ΜΕΝΝ', 8),
      ('ΜΑΙ', 9), ('ΑΤ', 10), ('ΤΕΠ', 11), ('ΕΝΔ', 12)) o(code, ord)
    join public.departments dep on dep.organization_id = v_org and dep.code = o.code
    cross join generate_series(1, 8) k
    where k < 7 or (k = 8 and o.code = 'ΠΑΘ') or (k = 7 and not exists (select 1 from public.employees e where e.organization_id = v_org and e.department_id = dep.id
      and e.staff_category <> 'physician' and coalesce(e.position_name, '') ~* 'προϊστάμεν'))
  ) s
  on conflict (organization_id, employee_code) do nothing;

  insert into public.employee_vaccinations(organization_id, employee_id, vaccine_item_id, vaccine_label_snapshot, dose, vaccination_date, valid_until, status, clinical_notes, created_by, updated_by)
  select v_org, e.id, mli.id, v.label, v.dose, v.vdate, v.valid, v.status, v.notes, p_actor, p_actor
  from public.employees e
  cross join lateral (select substring(e.employee_code from 5)::int g) n
  cross join lateral (values
    ('VAC-INFLUENZA', 'Γρίπη εποχική', 'Εποχική δόση',
      case when n.g % 5 in (3, 4) then d0 - 380 else d0 - (n.g % 40) * 2 end,
      case when n.g % 5 in (3, 4) then d0 - 15 when n.g % 5 = 0 then null else d0 - (n.g % 40) * 2 + 365 end,
      -- About two in five vaccinated this season, as among the Demo's other employees.
      case when n.g % 5 = 0 then 'declined' when n.g % 5 in (3, 4) then 'overdue' else 'complete' end,
      case when n.g % 5 = 0 then 'Άρνηση εμβολιασμού – ενημερώθηκε για τους κινδύνους.' end),
    ('VAC-HBV', 'Ηπατίτιδα Β', 'Πλήρης σειρά (3 δόσεις)', d0 - 900 - (n.g % 40) * 20, null::date,
      case when n.g % 11 = 0 then 'renew_soon' else 'complete' end, case when n.g % 11 = 0 then 'Anti-HBs < 10 mIU/mL – προγραμματισμός αναμνηστικής δόσης.' end),
    ('VAC-MMR', 'Ιλαρά-παρωτίτιδα-ερυθρά (MMR)', '2 δόσεις', d0 - 2000 - (n.g % 40) * 30, null::date, 'complete', null)
  ) v(code, label, dose, vdate, valid, status, notes)
  left join public.master_library_items mli on mli.organization_id = v_org and mli.library_key = 'vaccines' and mli.code = v.code
  where e.organization_id = v_org and e.employee_code ~ '^EMP-1[0-9][0-9]$' and (v.code <> 'VAC-MMR' or n.g % 3 <> 0)
    and not exists (select 1 from public.employee_vaccinations x where x.organization_id = v_org and x.employee_id = e.id and x.vaccine_label_snapshot = v.label);

  perform private.demo_seed_people_employees(v_org, p_actor);
  perform private.demo_seed_training(v_org, p_actor);
end;
$function$;
revoke all on function private.demo_seed_roster_staff(uuid, uuid) from public, anon, authenticated;

-- The people of a department's ward rota (physicians have their own rota), the head first. off: where each
-- regular member stands in the rota's cycle.
create or replace function private.demo_roster_staff(v_org uuid, p_department uuid, p_cycle integer)
returns table (id uuid, name text, profession text, is_head boolean, active boolean, user_id uuid, ord integer, off integer)
language sql stable set search_path = ''
as $function$
  with s as (
    select e.id, btrim(e.last_name || ' ' || e.first_name) as name, coalesce(e.profession_name, '') as profession,
      coalesce(e.position_name, '') ~* 'προϊστάμεν|head of department' as is_head,
      e.employment_status = 'active' as active, e.user_id, e.last_name, e.first_name
    from public.employees e
    where e.organization_id = v_org and e.department_id = p_department
      and e.staff_category <> 'physician' and coalesce(e.profession_name, '') !~* 'ιατρ|physician|doctor'),
  o as (
    select s.*, (row_number() over (partition by (s.active and not s.is_head) order by s.last_name, s.first_name))::integer - 1 as ord,
      (count(*) filter (where s.active and not s.is_head) over ())::integer as regular
    from s)
  select o.id, o.name, o.profession, o.is_head, o.active, o.user_id, o.ord,
    case when o.active and not o.is_head and o.regular > 0 then (o.ord * p_cycle) / o.regular else 0 end
  from o;
$function$;
revoke all on function private.demo_roster_staff(uuid, uuid, integer) from public, anon, authenticated;

-- Requests of the people of every rota: leave approved, a wish and a swap waiting, one refused, a sick day of
-- the running period, one cancelled by the employee.
create or replace function private.demo_seed_roster_requests(v_org uuid, p_actor uuid, v_cur date, v_run date)
returns void language plpgsql set search_path = ''
as $function$
declare
  r record;
  v_people uuid[];
  n integer;
begin
  if exists (select 1 from public.roster_requests x where x.organization_id = v_org) then return; end if;
  for r in
    select d.id, ((row_number() over (order by d.name)) - 1)::integer as idx
    from public.departments d
    where d.organization_id = v_org and d.is_active is not false
  loop
    select array_agg(s.id order by s.ord) into v_people
    from private.demo_roster_staff(v_org, r.id, 1) s where s.active and not s.is_head;
    n := coalesce(cardinality(v_people), 0);
    continue when n < 2;
    insert into public.roster_requests (organization_id, department_id, employee_id, requested_by, kind, date_from, date_to,
      swap_employee_id, swap_date, note, status, decided_by, decided_at, created_at)
    select v_org, r.id, v_people[((q.p + r.idx) % n) + 1], null, q.kind, q.f, q.t,
      case when q.kind = 'swap' then v_people[((q.p + r.idx + 1) % n) + 1] end, case when q.kind = 'swap' then v_cur + 18 end,
      q.note, q.status, case when q.status in ('approved', 'rejected') then p_actor end,
      case when q.status in ('approved', 'rejected') then now() - make_interval(days => q.decided_ago, hours => 2) end,
      now() - make_interval(days => q.created_ago, hours => r.idx)
    from (values
      (0, 'leave', v_cur + 6 + r.idx % 4, v_cur + 8 + r.idx % 4, 'approved', 'Οικογενειακός λόγος.', 9, 3),
      (1, 'wish', v_cur + 12, v_cur + 12, 'pending', 'Γάμος στην οικογένεια.', 4, 0),
      (2, 'swap', v_cur + 17, v_cur + 17, 'pending', 'Ανταλλαγή απογευματινής με πρωινή.', 2, 0),
      (1, 'unavailable', v_cur + 22, v_cur + 22, 'approved', null, 7, 2),
      (3, 'leave', v_cur - 20, v_cur - 18, 'rejected', 'Ήδη δύο άτομα σε άδεια τις ίδιες ημέρες.', 28, 25),
      (4, 'sick', v_run + 3, v_run + 4, 'approved', 'Με ιατρική βεβαίωση.', 18, 17),
      (5, 'leave', v_cur + 25, v_cur + 27, 'cancelled', 'Αλλαγή οικογενειακού προγραμματισμού.', 6, 0)
    ) q(p, kind, f, t, status, note, created_ago, decided_ago)
    -- Every department has the leave, the wish and the swap; the others alternate between departments.
    where q.p <= 2 or (q.p + r.idx) % 2 = 0;
  end loop;
end;
$function$;
revoke all on function private.demo_seed_roster_requests(uuid, uuid, date, date) from public, anon, authenticated;

-- One roster of a department for one period. The ward rota turns over a fixed cycle that runs on across
-- periods (so a period starts where the previous ended): from seven people two mornings, two afternoons, a
-- night and three days off in eight days; with four to six a morning, two afternoons, a night and two days
-- off in six; mornings and afternoons with three; mornings only with two. The head works weekday mornings. Approved requests (leave, sick, a day they cannot work, a wish)
-- are on the roster; p_leave_emp is on leave on days 10–12.
create or replace function private.demo_seed_roster_period(v_org uuid, p_actor uuid, p_department uuid, p_start date,
  p_status text, p_leave_emp uuid)
returns jsonb language plpgsql set search_path = ''
as $function$
declare
  v_end date := (p_start + interval '1 month')::date - 1;
  v_regular integer;
  v_cycle text[];
  v_members jsonb;
  v_assignments jsonb;
  v_demand jsonb;
  v_need jsonb;
  v_id uuid;
begin
  select count(*) into v_regular from private.demo_roster_staff(v_org, p_department, 1) s where s.active and not s.is_head;
  if v_regular < 2 then return null; end if;
  v_cycle := case when v_regular >= 7 then array['M','M','A','A','N','R','R','R']
                  when v_regular >= 4 then array['M','A','A','N','R','R']
                  when v_regular = 3 then array['M','M','A','A','R','R']
                  else array['M','M','R','R'] end;
  v_need := jsonb_build_object('M', case when v_regular >= 7 then 2 else 1 end, 'I', 0,
    'A', case when v_regular >= 7 then 2 when v_regular >= 3 then 1 else 0 end, 'N', case when v_regular >= 4 then 1 else 0 end);
  v_demand := jsonb_build_object('weekday', v_need, 'weekend', v_need, 'overrides', '{}'::jsonb);

  with days as (select g::date as d from generate_series(p_start, v_end, interval '1 day') g),
  staff as (select * from private.demo_roster_staff(v_org, p_department, cardinality(v_cycle))),
  req as (
    select r.employee_id, r.kind, r.date_from, coalesce(r.date_to, r.date_from) as date_to
    from public.roster_requests r
    where r.organization_id = v_org and r.department_id = p_department and r.status = 'approved' and r.kind <> 'swap'),
  cells as (
    select s.id, d.d,
      (select case q.kind when 'leave' then 'L' when 'sick' then 'S' when 'unpaid' then 'U' else 'R' end
         from req q where q.employee_id = s.id and d.d between q.date_from and q.date_to limit 1) as req_code,
      case when s.id = p_leave_emp and d.d between p_start + 9 and p_start + 11 then 'L' end as leave_code,
      case when s.is_head then case when extract(isodow from d.d) < 6 then 'M' else 'R' end
           else v_cycle[((d.d - date '2000-01-03' + s.off) % cardinality(v_cycle)) + 1] end as pattern
    from staff s cross join days d
    where s.active)
  select coalesce(jsonb_object_agg(x.id, x.row), '{}'::jsonb) into v_assignments
  from (select c.id, jsonb_object_agg(c.d::text, coalesce(c.req_code, c.leave_code, c.pattern)) as row from cells c group by c.id) x;

  with days as (select g::date as d from generate_series(p_start, v_end, interval '1 day') g),
  staff as (select * from private.demo_roster_staff(v_org, p_department, cardinality(v_cycle))),
  req as (
    select r.employee_id, r.kind, r.date_from, coalesce(r.date_to, r.date_from) as date_to
    from public.roster_requests r
    where r.organization_id = v_org and r.department_id = p_department and r.status = 'approved' and r.kind <> 'swap')
  select jsonb_agg(jsonb_build_object('employeeId', s.id, 'name', s.name, 'profession', s.profession, 'isHead', s.is_head,
      'userId', s.user_id, 'inactiveInRegister', not s.active, 'active', s.active,
      'fixed', coalesce((select jsonb_object_agg(d.d::text, case when s.id = p_leave_emp and d.d between p_start + 9 and p_start + 11 then 'L'
                                  else (select case q.kind when 'leave' then 'L' when 'sick' then 'S' when 'unpaid' then 'U' else 'R' end
                                          from req q where q.employee_id = s.id and q.kind <> 'wish' and d.d between q.date_from and q.date_to limit 1) end)
                         from days d
                         where (s.id = p_leave_emp and d.d between p_start + 9 and p_start + 11)
                            or exists (select 1 from req q where q.employee_id = s.id and q.kind <> 'wish' and d.d between q.date_from and q.date_to)), '{}'::jsonb),
      'wishes', coalesce((select jsonb_object_agg(d.d::text, 'R') from days d
                          where exists (select 1 from req q where q.employee_id = s.id and q.kind = 'wish' and d.d between q.date_from and q.date_to)), '{}'::jsonb))
    order by s.is_head desc, s.active desc, s.ord) into v_members
  from staff s;

  insert into public.department_rosters (organization_id, department_id, period_start, period_end, demand, rules, members, assignments,
    status, published_at, change_log, created_by, updated_by, created_at, updated_at)
  values (v_org, p_department, p_start, v_end, v_demand, '{}'::jsonb, v_members, v_assignments, p_status,
    case when p_status = 'published' then ((p_start - 5) + time '10:00') at time zone 'UTC' end, '[]'::jsonb, p_actor, p_actor,
    ((p_start - 12) + time '09:00') at time zone 'UTC', least(now(), ((p_start - 5) + time '10:00') at time zone 'UTC'))
  on conflict (organization_id, department_id, period_start) do nothing
  returning id into v_id;
  if v_id is null then return null; end if;
  return jsonb_build_object('id', v_id, 'assignments', v_assignments,
    'head', v_members->0->>'name',
    'first', (select s.id from private.demo_roster_staff(v_org, p_department, 1) s where s.active and not s.is_head order by s.ord limit 1));
end;
$function$;
revoke all on function private.demo_seed_roster_period(uuid, uuid, uuid, date, text, uuid) from public, anon, authenticated;

-- The rosters of every department with a ward rota: two earlier periods and the running one published (the
-- last with one change logged after publishing), the next one as a draft.
create or replace function private.demo_seed_rosters(v_org uuid, p_actor uuid)
returns void language plpgsql set search_path = ''
as $function$
declare
  d0 date := current_date;
  -- The hospital's roster period: from the 21st of a month to the 20th of the next.
  v_run date := case when extract(day from d0) >= 21 then date_trunc('month', d0)::date + 20
                     else (date_trunc('month', d0) - interval '1 month')::date + 20 end;
  v_cur date := (v_run + interval '1 month')::date;
  r record;
  k integer;
  v_start date;
  v_made jsonb;
  v_last uuid;
  v_date date;
  v_to text;
begin
  perform private.demo_seed_roster_staff(v_org, p_actor);
  perform private.demo_seed_roster_requests(v_org, p_actor, v_cur, v_run);
  for r in select d.id from public.departments d where d.organization_id = v_org and d.is_active is not false order by d.name loop
    -- The last of the department's active ward staff takes three days of leave in the running period.
    select s.id into v_last from private.demo_roster_staff(v_org, r.id, 1) s where s.active and not s.is_head order by s.ord desc limit 1;
    for k in -2..1 loop
      v_start := (v_run + make_interval(months => k))::date;
      v_made := private.demo_seed_roster_period(v_org, p_actor, r.id, v_start, case when k = 1 then 'draft' else 'published' end,
        case when k = 0 then v_last end);
      if k = 0 and v_made is not null and v_made->>'first' is not null then
        -- One shift changed by the head after publishing (kept in the change log).
        v_date := v_start + 14;
        v_to := v_made->'assignments'->(v_made->>'first')->>v_date::text;
        update public.department_rosters set change_log = jsonb_build_array(jsonb_build_object(
            'at', to_char(v_date, 'YYYY-MM-DD') || 'T08:30:00.000Z', 'by', v_made->>'head', 'employeeId', v_made->>'first',
            'date', v_date::text, 'from', case when v_to = 'M' then 'A' else 'M' end, 'to', coalesce(v_to, 'R'))),
          updated_at = least(now(), (v_date + time '08:30') at time zone 'UTC')
        where id = (v_made->>'id')::uuid;
      end if;
    end loop;
  end loop;
end;
$function$;
revoke all on function private.demo_seed_rosters(uuid, uuid) from public, anon, authenticated;

-- Six regulations from the templates: infection control in its second edition with a third under signature,
-- three more approved, waste management as a new draft, central sterilisation signed and waiting for approval.
create or replace function private.demo_seed_regulations(v_org uuid, p_actor uuid)
returns void language plpgsql set search_path = ''
as $function$
declare
  d0 date := current_date;
  v_hospital text;
  v_admin text := 'Ε. Καραγιάννη';
  v_admin_title text := 'Διοικήτρια';
  v_lead text := 'Ν. Σωτηρίου';
  v_lead_title text := 'Προϊστάμενη Νοσηλευτικής Επιτήρησης Λοιμώξεων';
  v_body text;
  r record;
  v_id uuid;
  v_content jsonb;
  v_signed jsonb;
  v_ed integer;
begin
  if exists (select 1 from public.regulations x where x.organization_id = v_org) then return; end if;
  select o.name into v_hospital from public.organizations o where o.id = v_org;
  v_body := 'Διοίκηση ' || coalesce(v_hospital, 'Νοσοκομείου');
  -- (code, template, editions, first issued days ago, last issued days ago, note on the approved text, archived)
  for r in
    select * from (values
      ('REG-01', 'infection_control', 2, 760, 275, 'Η παρούσα έκδοση εγκρίθηκε από τη Διοίκηση μετά από εισήγηση της Επιτροπής Νοσοκομειακών Λοιμώξεων.',
        'Ενσωμάτωση του Προγράμματος «Προκρούστης» και νέοι στόχοι υγιεινής χεριών.'),
      ('REG-02', 'healthcare_waste', 0, null, null, null, null),
      ('REG-03', 'food_safety', 1, 577, 577, 'Η Διοίκηση ενέκρινε τον κανονισμό μετά από εισήγηση του Υπευθύνου Διατροφής.', null),
      ('REG-04', 'patient_safety', 1, 416, 416, 'Η Διοίκηση ενέκρινε τον κανονισμό μετά από εισήγηση της Επιτροπής Ποιότητας και Ασφάλειας Ασθενών.', null),
      ('REG-05', 'water_safety', 1, 241, 241, 'Η Διοίκηση ενέκρινε το σχέδιο μετά από εισήγηση της Επιτροπής Νοσοκομειακών Λοιμώξεων και της Τεχνικής Υπηρεσίας.', null),
      ('REG-06', 'sterilization', 0, null, null, null, null)
    ) v(code, key, editions, first_ago, last_ago, note, change_note)
    join public.regulation_templates t on t.key = v.key
  loop
    v_content := private.demo_regulation_content(r.key, v_hospital, r.note, true);
    insert into public.regulations (organization_id, code, title, category, description, template_key, template_version, edition,
      issued_on, approved_at, approved_by, approved_by_name, content, archived, created_by, created_at, updated_at, signatures)
    values (v_org, r.code, r.title, r.category, null, r.key, r.version, r.editions,
      case when r.editions > 0 then d0 - r.last_ago end,
      case when r.editions > 0 then ((d0 - r.last_ago) + time '10:00') at time zone 'UTC' end,
      case when r.editions > 0 then p_actor end, case when r.editions > 0 then v_body end,
      case when r.editions > 0 then v_content else '{"chapters":[]}'::jsonb end, false, p_actor,
      ((d0 - coalesce(r.first_ago, 20) - 30) + time '09:00') at time zone 'UTC', now(), '[]'::jsonb)
    returning id into v_id;
    for v_ed in 1..r.editions loop
      -- Both signatures of each edition, kept with it (as regulation_approve keeps them).
      insert into public.regulation_signatures (regulation_id, organization_id, role, draft_revision, signer_name, signer_title, image, signed_by, signed_at, edition)
      values (v_id, v_org, 'administrator', 1, v_admin, v_admin_title, null, p_actor,
          ((d0 - case when v_ed = r.editions then r.last_ago else r.first_ago end) + time '09:00') at time zone 'UTC', v_ed),
        (v_id, v_org, 'infection_lead', 1, v_lead, v_lead_title, null, p_actor,
          ((d0 - case when v_ed = r.editions then r.last_ago else r.first_ago end) + time '09:30') at time zone 'UTC', v_ed);
      select jsonb_agg(jsonb_build_object('role', s.role, 'name', s.signer_name, 'title', s.signer_title, 'image', s.image,
          'signedAt', s.signed_at, 'signedBy', s.signed_by) order by s.role) into v_signed
        from public.regulation_signatures s where s.regulation_id = v_id and s.edition = v_ed;
      insert into public.regulation_editions (regulation_id, organization_id, edition, content, change_note, issued_on, template_version,
        approved_at, approved_by, approved_by_name, signatures)
      values (v_id, v_org, v_ed, v_content, case when v_ed = 1 then 'Πρώτη έκδοση.' else r.change_note end,
        d0 - case when v_ed = r.editions then r.last_ago else r.first_ago end, r.version,
        ((d0 - case when v_ed = r.editions then r.last_ago else r.first_ago end) + time '10:00') at time zone 'UTC', p_actor, v_body, v_signed);
      if v_ed = r.editions then update public.regulations set signatures = v_signed where id = v_id; end if;
    end loop;

    if r.code = 'REG-01' then
      -- The third edition in preparation: revised text, signed by the administration, the infection lead pending.
      insert into public.regulation_drafts (regulation_id, organization_id, content, change_note, updated_by, updated_at, active, revision)
      values (v_id, v_org, private.demo_regulation_content(r.key, v_hospital,
          'Αναθεώρηση ' || extract(year from d0)::text || ': ενημέρωση των μέτρων επιτήρησης των πολυανθεκτικών (CRE, CRAB) και του προγράμματος ελέγχου κατανάλωσης αντιμικροβιακών.', true),
        'Επικαιροποίηση των μέτρων για τα πολυανθεκτικά και των δεικτών κατανάλωσης αντιμικροβιακών.', p_actor, now() - interval '4 days', true, 2);
      insert into public.regulation_signatures (regulation_id, organization_id, role, draft_revision, signer_name, signer_title, image, signed_by, signed_at, edition)
      values (v_id, v_org, 'administrator', 2, v_admin, v_admin_title, null, p_actor, now() - interval '2 days 3 hours', null);
    elsif r.code = 'REG-02' then
      -- A new regulation, still being written from its template.
      insert into public.regulation_drafts (regulation_id, organization_id, content, change_note, updated_by, updated_at, active, revision)
      values (v_id, v_org, private.demo_regulation_content(r.key, v_hospital, null, false), null, p_actor, now() - interval '6 days', true, 1);
    elsif r.code = 'REG-06' then
      -- Written and signed by both: waiting for the administration's approval.
      insert into public.regulation_drafts (regulation_id, organization_id, content, change_note, updated_by, updated_at, active, revision)
      values (v_id, v_org, private.demo_regulation_content(r.key, v_hospital, null, true), 'Πρώτη έκδοση.', p_actor, now() - interval '9 days', true, 1);
      insert into public.regulation_signatures (regulation_id, organization_id, role, draft_revision, signer_name, signer_title, image, signed_by, signed_at, edition)
      values (v_id, v_org, 'administrator', 1, v_admin, v_admin_title, null, p_actor, now() - interval '7 days 2 hours', null),
        (v_id, v_org, 'infection_lead', 1, v_lead, v_lead_title, null, p_actor, now() - interval '8 days 5 hours', null);
    end if;
  end loop;
end;
$function$;
revoke all on function private.demo_seed_regulations(uuid, uuid) from public, anon, authenticated;

-- The Hour-1 sepsis bundles of the bloodstream episodes: the newest one running now (recognised 72 minutes
-- ago), the others completed (septic shock for every third), and one respiratory episode closed because
-- sepsis was ruled out. Steps and history as the screen records them.
create or replace function private.demo_seed_protocol_runs(v_org uuid, p_actor uuid)
returns void language plpgsql set search_path = ''
as $function$
declare
  c record;
  v_run uuid;
  v_zero timestamptz;
  v_key text;
  v_shock boolean;
  v_lactate text;
  v_status text;
  v_end timestamptz;
  v_doctor text;
  v_nurse text;
  v_staff text[] := array['Δρ. Κ. Μαργαρίτης', 'Μ. Κωνσταντίνου', 'Δρ. Ε. Λαμπράκη', 'Α. Νικολάου', 'Δρ. Σ. Καλλέργης', 'Δ. Παπαδάκη'];
begin
  if exists (select 1 from public.clinical_protocol_runs x where x.organization_id = v_org) then return; end if;
  for c in
    select x.*, (row_number() over (order by x.closed_run, x.started_at desc))::integer as rn from (
      select sc.id, sc.patient_id, sc.admission_id, sc.department_id, sc.started_at, false as closed_run,
        (select t.id from public.antimicrobial_therapies t where t.surveillance_case_id = sc.id and t.organization_id = v_org order by t.started_at limit 1) as therapy_id,
        (select btrim(t.antimicrobial || ' ' || coalesce(t.dose, '') || ' ' || coalesce(t.route, '')) from public.antimicrobial_therapies t
          where t.surveillance_case_id = sc.id and t.organization_id = v_org order by t.started_at limit 1) as therapy_text
      from public.surveillance_cases sc
      left join public.departments d on d.id = sc.department_id
      where sc.organization_id = v_org and sc.suspected_source = 'bloodstream' and coalesce(d.code, '') <> 'ΜΕΝΝ'
      union all
      (select sc.id, sc.patient_id, sc.admission_id, sc.department_id, sc.started_at, true, null, null
      from public.surveillance_cases sc
      where sc.organization_id = v_org and sc.suspected_source = 'respiratory'
      order by sc.started_at limit 1)) x
  loop
    v_doctor := v_staff[1 + 2 * (c.rn % 3)];
    v_nurse := v_staff[2 + 2 * (c.rn % 3)];
    v_shock := not c.closed_run and c.rn > 1 and c.rn % 3 = 0;
    v_key := case when v_shock then 'septic_shock' else 'sepsis_hour1' end;
    v_zero := case when c.rn = 1 and not c.closed_run then now() - interval '72 minutes' else c.started_at - interval '25 minutes' end;
    v_lactate := case when c.rn = 1 and not c.closed_run then '4.2' when v_shock then '5.1' when c.closed_run then '1.4' when c.rn % 2 = 1 then '1.6' else '2.8' end;
    v_status := case when c.closed_run then 'closed' when c.rn = 1 then 'open' else 'completed' end;
    v_end := case when v_status = 'open' then null when c.closed_run then v_zero + interval '40 minutes'
                  when v_lactate::numeric > 2 then v_zero + interval '185 minutes' else v_zero + interval '70 minutes' end;
    insert into public.clinical_protocol_runs (organization_id, surveillance_case_id, patient_id, admission_id, department_id, protocol_key,
      protocol_version, recognized_at, recognition_source, weight_kg, status, started_by, started_by_name, started_at, completed_at,
      completed_by, completed_by_name, close_reason, updated_by, updated_at)
    values (v_org, c.id, c.patient_id, c.admission_id, c.department_id, v_key, 'SSC-2018/2021', v_zero,
      case when v_shock then 'clinical' else 'qsofa' end, 62 + (c.rn * 7) % 30, v_status, p_actor, v_doctor, v_zero + interval '1 minute', v_end,
      case when v_end is not null then p_actor end, case when v_end is not null then v_doctor end,
      case when c.closed_run then 'Δεν πληρούνται τα κριτήρια σήψης (SOFA < 2, γαλακτικό 1,4 mmol/L).' end,
      p_actor, coalesce(v_end, v_zero + interval '55 minutes'))
    returning id into v_run;

    insert into public.clinical_protocol_steps (organization_id, run_id, step_key, status, done_at, value_text, not_indicated_reason, therapy_id,
      recorded_by, recorded_by_name, recorded_at, updated_by, updated_at)
    select v_org, v_run, s.k, s.st, case when s.st = 'done' then v_zero + make_interval(mins => s.m) end, s.val, s.why,
      case when s.k = 'antibiotic' then c.therapy_id end, p_actor, s.who, v_zero + make_interval(mins => s.m + 2), p_actor, v_zero + make_interval(mins => s.m + 2)
    from (values
      ('lactate', 12 + c.rn % 3, 'done', v_lactate, null::text, v_nurse, true),
      ('blood_cultures', 18 + c.rn % 4, 'done', '2 σετ αιμοκαλλιεργειών', null, v_nurse, true),
      ('fluids', case when c.rn = 1 then 35 else 44 + c.rn % 10 end, 'done', case when v_shock then '2.100 / 2.100 ml' else '1.000 / 2.100 ml' end, null, v_nurse, not c.closed_run),
      ('antibiotic', case when c.rn = 1 then 53 else 38 + c.rn % 15 end, 'done', coalesce(c.therapy_text, 'Μεροπενέμη 1 g IV'), null, v_doctor, not c.closed_run),
      ('vasopressor', 56, case when v_shock then 'done' else 'not_indicated' end, case when v_shock then 'Νοραδρεναλίνη 0,1 mcg/kg/min' end,
        case when v_shock then null else 'ΜΑΠ ≥ 65 mmHg μετά τα υγρά' end, v_doctor, v_status = 'completed'),
      ('lactate_repeat', 170, 'done', case when v_shock then '3.4' else '1.7' end, null, v_nurse, v_status = 'completed' and v_lactate::numeric > 2)
    ) s(k, m, st, val, why, who, keep)
    where s.keep;

    insert into public.clinical_protocol_events (organization_id, run_id, event_type, step_key, detail, reason, actor_id, actor_name, occurred_at)
    select v_org, v_run, 'started', null, jsonb_build_object('source', case when v_shock then 'clinical' else 'qsofa' end), null, p_actor, v_doctor, v_zero + interval '1 minute'
    union all
    select v_org, v_run, 'step_recorded', s.step_key, jsonb_build_object('status', s.status), s.not_indicated_reason, p_actor, s.recorded_by_name, s.recorded_at
      from public.clinical_protocol_steps s where s.run_id = v_run
    union all
    select v_org, v_run, case when c.closed_run then 'closed' else 'completed' end, null, '{}'::jsonb,
      case when c.closed_run then 'Δεν πληρούνται τα κριτήρια σήψης.' end, p_actor, v_doctor, v_end
    where v_end is not null;
  end loop;
end;
$function$;
revoke all on function private.demo_seed_protocol_runs(uuid, uuid) from public, anon, authenticated;

-- The 48–72 h reviews of the antimicrobial therapies (empirical treatment narrowed to the targeted one,
-- colonisation stopped, targeted treatment continued) and the epidemiological questionnaire of each episode
-- (every fifth left pending, one started with its core incomplete).
create or replace function private.demo_seed_reviews_questionnaires(v_org uuid, p_actor uuid)
returns void language plpgsql set search_path = ''
as $function$
begin
  insert into public.antimicrobial_therapy_reviews (organization_id, therapy_id, surveillance_case_id, decision, reasons, note, new_regimen,
    reviewed_at, reviewed_by, reviewer_name, reviewer_job_title, created_at)
  select v_org, x.id, x.surveillance_case_id, x.decision,
    case x.decision when 'deescalate' then array['susceptibility', 'clinical_improvement'] when 'stop' then array['no_infection']
      when 'iv_to_oral' then array['clinical_improvement', 'oral_route_possible']
      else case when x.n % 2 = 0 then array['susceptibility'] else array['clinical_improvement'] end end,
    case x.decision when 'deescalate' then 'Στοχευμένη αγωγή κατά το αντιβιόγραμμα: ' || x.next_drug || '.'
      when 'stop' then 'Αποικισμός χωρίς κλινική λοίμωξη: διακοπή της αντιμικροβιακής αγωγής.'
      when 'iv_to_oral' then 'Απύρετος 48 ώρες, σιτίζεται: μετάβαση σε από του στόματος αγωγή.'
      else 'Συνέχιση ' || x.antimicrobial || ' κατά το αντιβιόγραμμα· καλή κλινική πορεία.' end,
    case when x.decision = 'deescalate' then x.next_drug end,
    least(now() - interval '1 hour', x.started_at + make_interval(hours => (50 + (x.n % 5) * 4)::integer)), p_actor,
    case when x.n % 2 = 0 then 'Δρ. Ε. Λαμπράκη' else 'Δρ. Σ. Καλλέργης' end, 'Λοιμωξιολόγος',
    least(now() - interval '1 hour', x.started_at + make_interval(hours => (50 + (x.n % 5) * 4)::integer))
  from (
    select t.*, row_number() over (order by t.started_at) as n,
      case when t.status = 'stopped' and nx.antimicrobial is not null then 'deescalate'
           when sc.reason ilike '%αποικισμ%' and nx.antimicrobial is null then 'stop'
           when t.route = 'PO' then 'iv_to_oral' else 'continue' end as decision,
      btrim(nx.antimicrobial || ' ' || coalesce(nx.dose, '') || ' ' || coalesce(nx.route, '')) as next_drug,
      row_number() over (partition by t.status = 'active' order by t.started_at desc) as recent
    from public.antimicrobial_therapies t
    join public.surveillance_cases sc on sc.id = t.surveillance_case_id
    left join lateral (select t2.antimicrobial, t2.dose, t2.route from public.antimicrobial_therapies t2
      where t2.surveillance_case_id = t.surveillance_case_id and t2.started_at > t.started_at order by t2.started_at limit 1) nx on true
    where t.organization_id = v_org and t.status <> 'planned' and t.started_at < now() - interval '50 hours'
  ) x
  -- The newest active therapy past 48 hours keeps its review card waiting.
  where not (x.status = 'active' and x.recent = 1)
    and not exists (select 1 from public.antimicrobial_therapy_reviews r where r.therapy_id = x.id);

  insert into public.surveillance_case_questionnaires (organization_id, surveillance_case_id, definition_version, answers, prefilled,
    answered_by, answered_at, updated_by, created_at)
  select v_org, q.id, 1,
    case when q.n % 9 = 3 then jsonb_build_object('icu_stay', jsonb_build_object('a', 'yes', 'detail', '', 'src', 'manual'))
    else jsonb_build_object(
      'antibiotics_90d', case when q.n % 3 = 0 then jsonb_build_object('a', 'yes', 'detail', 'Κεφτριαξόνη', 'src', 'manual')
                              else jsonb_build_object('a', 'no', 'detail', '', 'src', 'manual') end,
      'icu_stay', case when q.code in ('ΜΕΘ', 'ΜΕΝΝ') then jsonb_build_object('a', 'yes', 'detail', '', 'src', 'prefill')
                       else jsonb_build_object('a', 'no', 'detail', '', 'src', 'manual') end,
      'transfer_from_facility', case when q.n % 7 = 0 then jsonb_build_object('a', 'unknown', 'detail', '', 'src', 'manual')
                                     when q.n % 4 = 1 then jsonb_build_object('a', 'yes', 'detail', 'Γ.Ν. Λάρισας', 'src', 'manual')
                                     else jsonb_build_object('a', 'no', 'detail', '', 'src', 'prefill') end)
      || case when q.n % 3 = 2 then '{}'::jsonb else jsonb_build_object(
        'other_admission_90d', jsonb_build_object('a', case when q.n % 5 = 0 then 'yes' else 'no' end, 'detail', '', 'src', 'manual'),
        'invasive_device_48h', case q.suspected_source
            when 'bloodstream' then jsonb_build_object('a', 'yes', 'detail', 'Κεντρικός φλεβικός καθετήρας', 'src', 'prefill')
            when 'urinary' then jsonb_build_object('a', 'yes', 'detail', 'Ουροκαθετήρας', 'src', 'prefill')
            when 'respiratory' then jsonb_build_object('a', 'yes', 'detail', 'Ενδοτραχειακός σωλήνας', 'src', 'prefill')
            else jsonb_build_object('a', 'no', 'detail', '', 'src', 'manual') end,
        'surgery_30d', jsonb_build_object('a', case when q.suspected_source = 'surgicalSite' or q.code in ('ΧΕΙΡ', 'ΟΡΘ') then 'yes' else 'no' end, 'detail', '', 'src', 'manual'),
        'known_mdro', case when q.reason ilike '%πολυανθεκτικ%' then jsonb_build_object('a', 'yes', 'detail', 'KPC, ' || extract(year from q.started_at)::text, 'src', 'manual')
                           else jsonb_build_object('a', 'no', 'detail', '', 'src', 'manual') end,
        'dialysis', jsonb_build_object('a', case when q.code = 'ΝΕΦ' then 'yes' else 'no' end, 'detail', '', 'src', 'manual'),
        'ltcf_residence', jsonb_build_object('a', 'no', 'detail', '', 'src', 'manual'),
        'abroad_12m', jsonb_build_object('a', 'unknown', 'detail', '', 'src', 'manual')) end
    end,
    '{}'::jsonb, p_actor, least(now() - interval '30 minutes', q.started_at + make_interval(days => 1, mins => (q.n % 40)::integer)), p_actor,
    least(now() - interval '30 minutes', q.started_at + make_interval(days => 1, mins => (q.n % 40)::integer))
  from (
    select sc.id, sc.started_at, sc.reason, sc.suspected_source, d.code, row_number() over (order by sc.started_at, sc.id) as n
    from public.surveillance_cases sc left join public.departments d on d.id = sc.department_id
    where sc.organization_id = v_org and sc.voided_at is null
  ) q
  where q.n % 5 <> 4
  on conflict (surveillance_case_id) do nothing;
end;
$function$;
revoke all on function private.demo_seed_reviews_questionnaires(uuid, uuid) from public, anon, authenticated;

-- Protocol update suggestions on the published protocols, instructions and policies: changed sources, some
-- with a drafted paragraph, one postponed, one rejected and one accepted.
create or replace function private.demo_seed_protocol_suggestions(v_org uuid, p_actor uuid)
returns void language plpgsql set search_path = ''
as $function$
begin
  insert into public.protocol_update_suggestions (organization_id, document_id, reason, source_kind, source_ref, source_label, source_url,
    trigger_key, what_changed, affected_sections, details, source_excerpt, draft_text, draft_citation, draft_generated_at, draft_attempted_at,
    status, decided_by, decided_at, rejection_reason, snoozed_until, created_at, updated_at)
  select v_org, doc.id, 'source_changed', v.kind, v.ref, v.label, v.url, v.ref || ':demo-' || to_char(current_date - v.ago, 'YYYYMMDD'),
    v.what, v.sections, jsonb_build_object('changedAt', to_char(current_date - v.ago - 1, 'YYYY-MM-DD'), 'matched', v.matched), v.excerpt,
    v.draft, v.citation, case when v.draft is not null then now() - make_interval(days => v.ago) + interval '2 hours' end,
    now() - make_interval(days => v.ago) + interval '2 hours',
    v.status, case when v.status in ('accepted', 'rejected') then p_actor end,
    case when v.status <> 'open' then now() - make_interval(days => greatest(v.ago - 5, 1)) end,
    v.rejection, case when v.status = 'snoozed' then current_date + 21 end,
    now() - make_interval(days => v.ago, hours => 3), now() - make_interval(days => greatest(v.ago - 5, 1))
  from (values
    ('%υγιεινής χεριών%', 'clinical_source', 'clinical:demo-who-hand-hygiene', 'WHO · Guidelines on hand hygiene in health care', 'https://www.who.int/publications',
      'Η πηγή «WHO · Guidelines on hand hygiene in health care» άλλαξε: νέα σύσταση για την παρακολούθηση της συμμόρφωσης με άμεση παρατήρηση και ανατροφοδότηση ανά τμήμα.',
      array['instructions', 'references'], 'WHO', 'Παρακολούθηση της συμμόρφωσης με άμεση παρατήρηση και μηνιαία ανατροφοδότηση ανά τμήμα.',
      'Η συμμόρφωση στην υγιεινή των χεριών μετράται κάθε μήνα σε κάθε τμήμα με άμεση παρατήρηση των 5 στιγμών του ΠΟΥ (τουλάχιστον 100 ευκαιρίες ανά τμήμα). Τα αποτελέσματα κοινοποιούνται στον προϊστάμενο και στο προσωπικό του τμήματος εντός 7 ημερών.',
      'WHO · Guidelines on hand hygiene in health care, ' || extract(year from current_date)::text, 'open', null::text, 12),
    ('%πολυανθεκτικ%', 'legislation', 'legislation:demo-ecdc-cre', 'ECDC · Carbapenem-resistant Enterobacterales guidance', 'https://www.ecdc.europa.eu',
      'Νέα έκδοση της καθοδήγησης ECDC για τα CRE: ενημερωμένα κριτήρια ενεργητικής επιτήρησης κατά την εισαγωγή.',
      array['instructions', 'references'], 'ECDC', 'Ενεργητική επιτήρηση κατά την εισαγωγή για ασθενείς με νοσηλεία σε άλλο νοσοκομείο τους τελευταίους 12 μήνες.',
      null, null, 'open', null, 6),
    ('%αντιμικροβιακ%', 'clinical_source', 'clinical:demo-escmid-stewardship', 'ESCMID · Antimicrobial stewardship guidance', 'https://www.escmid.org',
      'Η πηγή «ESCMID · Antimicrobial stewardship guidance» άλλαξε: επανεκτίμηση κάθε εμπειρικής αγωγής στις 48–72 ώρες με τεκμηριωμένη απόφαση.',
      array['instructions', 'dosages'], 'ESCMID', 'Επανεκτίμηση της εμπειρικής αγωγής στις 48–72 ώρες.',
      'Κάθε εμπειρική αντιμικροβιακή αγωγή επανεκτιμάται 48–72 ώρες μετά την έναρξη. Ο θεράπων ιατρός καταγράφει απόφαση (συνέχιση, αποκλιμάκωση, μετάβαση σε από του στόματος, διακοπή) με βάση τις καλλιέργειες και την κλινική πορεία.',
      'ESCMID · Antimicrobial stewardship guidance, ' || extract(year from current_date)::text, 'snoozed', null, 20),
    ('%ΚΦΚ%', 'clinical_source', 'clinical:demo-cdc-clabsi', 'CDC · Prevention of intravascular catheter-related infections', 'https://www.cdc.gov',
      'Η πηγή «CDC · Prevention of intravascular catheter-related infections» άλλαξε: χλωρεξιδίνη 2% σε αλκοόλη για την αντισηψία και καθημερινή εκτίμηση της ανάγκης του καθετήρα.',
      array['instructions', 'references'], 'CDC', 'Χλωρεξιδίνη >0,5% σε αλκοόλη και καθημερινή εκτίμηση της ανάγκης.',
      null, null, 'open', null, 3),
    ('%ουρολοιμ%', 'clinical_source', 'clinical:demo-epic-cauti', 'EPIC3 · Urinary catheter guidance', 'https://www.ncbi.nlm.nih.gov',
      'Η πηγή «EPIC3 · Urinary catheter guidance» άλλαξε: διατύπωση για την αλλαγή του συστήματος συλλογής.',
      array['instructions'], 'EPIC3', null, null, null, 'rejected', 'Η αλλαγή δεν αφορά την πρακτική του νοσοκομείου· η οδηγία ισχύει ως έχει.', 34),
    ('%καθαρισμού%', 'clinical_source', 'clinical:demo-cdc-environmental', 'CDC · Environmental infection control', 'https://www.cdc.gov',
      'Η πηγή «CDC · Environmental infection control» άλλαξε: σποροκτόνο απολυμαντικό στους θαλάμους ασθενών με C. difficile.',
      array['instructions', 'dosages'], 'C. difficile', null, null, null, 'accepted', null, 45)
  ) v(pattern, kind, ref, label, url, what, sections, matched, excerpt, draft, citation, status, rejection, ago)
  cross join lateral (
    select d.id from public.controlled_documents d
    where d.organization_id = v_org and d.status = 'published' and d.title ilike v.pattern
    order by d.code limit 1) doc
  on conflict (document_id, reason, source_ref, trigger_key) do nothing;
end;
$function$;
revoke all on function private.demo_seed_protocol_suggestions(uuid, uuid) from public, anon, authenticated;

-- Entry point, called by private.demo_seed_data after the departments, employees, episodes, therapies and
-- documents are in place.
create or replace function private.demo_seed_rosters_regulations(p_organization_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
begin
  if p_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organizations o where o.id = v_org and o.is_demo) then
    raise exception 'Only Demo organizations get the Demo rosters and regulations' using errcode = '42501';
  end if;
  perform private.demo_seed_rosters(v_org, p_actor);
  perform private.demo_seed_regulations(v_org, p_actor);
  perform private.demo_seed_protocol_runs(v_org, p_actor);
  perform private.demo_seed_reviews_questionnaires(v_org, p_actor);
  perform private.demo_seed_protocol_suggestions(v_org, p_actor);
end;
$function$;
revoke all on function private.demo_seed_rosters_regulations(uuid, uuid) from public, anon, authenticated;

-- ===== 20261231360000_demo_seed_registers.sql =====
-- Demo: Μητρώα τμημάτων με δείκτες, στόχους και περιστατικά.
--
-- Κάθε νέο ή επαναφερόμενο Demo νοσοκομείο παίρνει επτά μητρώα, φτιαγμένα από
-- τα ίδια πρότυπα με την εφαρμογή (registerTemplates.js → registerCloud.definitionRows,
-- εδώ ως jsonb) και με τον ίδιο πίνακα δεδομένων που φτιάχνει το
-- public.department_register_sync:
--   REG-001 Μητρώο ασθενών ΜΕΘ                (ΜΕΘ)   ~6 μήνες νοσηλειών
--   REG-002 Μητρώο νεογνών ΜΕΝΝ                (ΜΕΝΝ)  ~6 μήνες νεογνών
--   REG-003 Μητρώο νοσηλευομένων Παιδιατρικής  (ΠΑΙΔ)  ~6 μήνες νοσηλειών
--   REG-004 Πράξεις Ενδοσκοπικού (φύλλο)       (ΕΝΔ)   3 μηνιαία σύνολα και ημερήσια φύλλα
--   REG-005 Μητρώο λεχωίδων Μαιευτικής         (ΜΑΙ)   ~5 μήνες τοκετών
--   REG-006 Πράξεις Αίθουσας Τοκετών (φύλλο)   (ΑΤ)    οι τοκετοί του REG-005 ανά ημέρα / μήνα
--   REG-007 Δραστηριότητα ΤΕΠ ανά βάρδια (φύλλο) (ΤΕΠ) 3 μηνιαία σύνολα και ημερήσια φύλλα
-- Το Demo δεν έχει από το demo_seed_departments_patients Μαιευτική, Αίθουσα
-- Τοκετών, ΤΕΠ και Ενδοσκοπικό· προστίθενται εδώ όπως στο ΙΑΣΩ (χωριστά τμήματα),
-- χωρίς κλινοημέρες. Στόχοι: μόνο όσοι έχουν εγκριθεί για τα πραγματικά μητρώα
-- (ο στόχος καισαρικών του Μητρώου λεχωίδων είναι πρόταση και δεν μπαίνει).
-- Ονόματα και αριθμοί περιστατικών είναι επινοημένα· ημερομηνίες σχετικές με τη
-- σημερινή ημέρα σε ώρα Ευρώπης/Αθήνας.
--
-- Πίνακες δεδομένων: το demo_wipe_data σβήνει τις γραμμές του μητρώου (και, μέσω
-- on delete cascade, τις γραμμές των πινάκων του), αλλά ο ίδιος ο πίνακας
-- register_<πρότυπο>_<8> μένει. Για να μη μαζεύονται άδειοι πίνακες σε κάθε
-- επαναφορά, το Demo μητρώο παίρνει σταθερό όνομα πίνακα ανά νοσοκομείο και πρότυπο
-- (md5 του νοσοκομείου και του προτύπου), οπότε η επόμενη επαναφορά ξαναχρησιμοποιεί
-- τον ίδιο πίνακα: το sync ξαναδένει τον trigger στο νέο μητρώο και το
-- register_fast_policies τις πολιτικές ανάγνωσης.
--
-- Η επαναφορά τρέχει και από τον ίδιο τον αξιολογητή (demo_reset_my_organization),
-- με όποιον ρόλο έχει διαλέξει (π.χ. Σύνδεσμος νοσηλευτής). Γι' αυτό ο πίνακας
-- φτιάχνεται από το private.demo_register_sync, ίδιο με το
-- public.department_register_sync χωρίς τον έλεγχο «ποιος ορίζει μητρώα»
-- (το demo_seed_data έχει ήδη ελέγξει ότι πρόκειται για Demo).

-- Ψευδοτυχαίος αριθμός [0,1) σταθερός ανά περιστατικό και χαρακτηριστικό.
create or replace function private.demo_register_rand(p_i integer, p_salt integer)
returns double precision
language sql
immutable
set search_path = ''
as $function$
  select (('x' || substr(md5(p_i::text || ':' || p_salt::text), 1, 8))::bit(32)::bigint)::double precision / 4294967296.0;
$function$;
revoke all on function private.demo_register_rand(integer, integer) from public, anon, authenticated;

-- Τα πρότυπα της εφαρμογής (registerTemplates.js, registerTemplatesHospital.js) ως
-- γραμμές ορισμού, χωρίς τα ονόματα στηλών του FileMaker (aliases, match). Η
-- Αίθουσα Τοκετών έχει τις διορθώσεις δεικτών που ενέκρινε ο ιδιοκτήτης
-- (20261231221000)· η Μαιευτική επινοημένους θεράποντες ιατρούς.
create or replace function private.demo_register_template(p_key text)
returns jsonb
language sql
immutable
set search_path = ''
as $function$
  select case p_key
    when 'icu' then $tpl${"name_el":"Μητρώο ασθενών ΜΕΘ","name_en":"ICU patient register","description_el":"Μία καρτέλα ανά νοσηλεία, Γενική και Καρδιοχειρουργική ΜΕΘ. Δείκτες: θνησιμότητα, SMR έναντι APACHE II, ημέρες ΜΕΘ, κατακλίσεις, επανεισαγωγές 48ώρου.","description_en":"One card per stay, General and Cardiac surgery ICU. Indicators: mortality, observed vs APACHE II predicted, ICU days, pressure ulcers, 48-hour readmissions.","kind":"case","entry_date_field":"admission_date","identity_case_number":true,"identity_patient_name":true,"sections":[{"key":"admission","label_el":"Εισαγωγή","label_en":"Admission","position":0},{"key":"severity","label_el":"Βαρύτητα","label_en":"Severity","position":1},{"key":"stay","label_el":"Νοσηλεία","label_en":"Stay","position":2},{"key":"discharge","label_el":"Έξοδος από τη ΜΕΘ","label_en":"Leaving the ICU","position":3}],"fields":[{"key":"admission_date","section_key":"admission","position":0,"field_type":"date","label_el":"Ημερομηνία εισαγωγής","label_en":"Admission date","required":true,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"category","section_key":"admission","position":1,"field_type":"choice","label_el":"Κατηγορία ασθενούς","label_en":"Patient category","required":true,"in_list":true,"in_breakdown":true,"provisional":false,"aliases":[],"archived":false},{"key":"age","section_key":"admission","position":2,"field_type":"number","label_el":"Ηλικία","label_en":"Age","unit_el":"έτη","unit_en":"years","min_value":0,"max_value":120,"required":false,"in_list":true,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"sex","section_key":"admission","position":3,"field_type":"choice","label_el":"Φύλο","label_en":"Sex","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"admission_reason","section_key":"admission","position":4,"field_type":"choice","label_el":"Αιτία εισαγωγής","label_en":"Reason for admission","required":false,"in_list":false,"in_breakdown":true,"provisional":true,"aliases":[],"archived":false},{"key":"requisition","section_key":"admission","position":5,"field_type":"yes_no","label_el":"Επίταξη","label_en":"Requisitioned bed","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"readmission_48h","section_key":"admission","position":6,"field_type":"yes_no","label_el":"Επανεισαγωγή εντός 48 ωρών","label_en":"Readmission within 48 h","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"apache_score","section_key":"severity","position":7,"field_type":"number","label_el":"APACHE II score","label_en":"APACHE II score","min_value":0,"max_value":71,"required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"apache_postop","section_key":"severity","position":8,"field_type":"yes_no","label_el":"Μετεγχειρητικός ασθενής","label_en":"Post-operative admission","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"help_el":"Για τον πίνακα θνητότητας APACHE II.","help_en":"Selects the APACHE II mortality table.","aliases":[],"archived":false},{"key":"apache_mortality","section_key":"severity","position":9,"field_type":"computed","label_el":"Προβλεπόμενη θνητότητα APACHE II","label_en":"APACHE II predicted mortality","unit_el":"%","unit_en":"%","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"help_el":"Υπολογίζεται από το APACHE II score και το αν ο ασθενής είναι μετεγχειρητικός.","help_en":"Computed from the APACHE II score and whether the admission is post-operative.","computed_kind":"apache_ii","computed_from":"apache_score","computed_to":"apache_postop","aliases":[],"archived":false},{"key":"euroscore","section_key":"severity","position":10,"field_type":"number","label_el":"EuroSCORE II","label_en":"EuroSCORE II","unit_el":"%","unit_en":"%","min_value":0,"max_value":100,"required":false,"in_list":false,"in_breakdown":false,"provisional":false,"help_el":"Μόνο για την Καρδιοχειρουργική ΜΕΘ, ως %.","help_en":"Cardiac surgery ICU only, as %.","show_when_key":"category","show_when_value":"cardiac","aliases":[],"archived":false},{"key":"ventilator_hours","section_key":"stay","position":11,"field_type":"number","label_el":"Ώρες στον αναπνευστήρα","label_en":"Ventilator hours","unit_el":"ώρες","unit_en":"hours","min_value":0,"max_value":8760,"required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"pressure_ulcer","section_key":"stay","position":12,"field_type":"yes_no","label_el":"Εμφάνιση κατάκλισης","label_en":"Pressure ulcer developed","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"vap","section_key":"stay","position":13,"field_type":"yes_no","label_el":"VAP","label_en":"VAP","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"help_el":"Θα συνδεθεί με το επεισόδιο στην Επιτήρηση.","help_en":"To be linked with the Surveillance episode.","aliases":[],"archived":false},{"key":"air_mattress","section_key":"stay","position":14,"field_type":"yes_no","label_el":"Αερόστρωμα","label_en":"Air mattress","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"daily_cleaning","section_key":"stay","position":15,"field_type":"yes_no","label_el":"Καθημερινή καθαριότητα","label_en":"Daily cleaning","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"line_care","section_key":"stay","position":16,"field_type":"yes_no","label_el":"Καθημερινή περιποίηση γραμμών","label_en":"Daily line care","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"cultures","section_key":"stay","position":17,"field_type":"yes_no","label_el":"Λήψη καλλιεργειών","label_en":"Cultures taken","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"discharge_date","section_key":"discharge","position":18,"field_type":"date","label_el":"Ημερομηνία εξόδου","label_en":"Discharge date","required":false,"in_list":true,"in_breakdown":false,"provisional":false,"not_before_key":"admission_date","aliases":[],"archived":false},{"key":"length_of_stay","section_key":"discharge","position":19,"field_type":"computed","label_el":"Ημέρες ΜΕΘ","label_en":"ICU days","unit_el":"ημέρες","unit_en":"days","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"computed_kind":"days","computed_from":"admission_date","computed_to":"discharge_date","aliases":[],"archived":false},{"key":"outcome","section_key":"discharge","position":20,"field_type":"choice","label_el":"Πού πήγε","label_en":"Where to","required":false,"in_list":true,"in_breakdown":true,"provisional":false,"show_when_key":"discharge_date","aliases":[],"archived":false},{"key":"transfer_department","section_key":"discharge","position":21,"field_type":"choice","label_el":"Τμήμα μεταφοράς","label_en":"Receiving ward","required":false,"in_list":false,"in_breakdown":false,"provisional":true,"help_el":"Το νοσηλευτικό τμήμα όπου πήγε ο ασθενής. Η λίστα συμπληρώνεται με τα τμήματα του νοσοκομείου.","help_en":"The ward the patient went to. The list is completed with the hospital’s wards.","show_when_key":"outcome","show_when_value":"transfer_ward","aliases":[],"archived":false}],"options":[{"fieldKey":"category","value":"general","label_el":"Γενική ΜΕΘ","label_en":"General ICU","position":0,"match":[],"archived":false},{"fieldKey":"category","value":"cardiac","label_el":"Καρδιοχειρουργική ΜΕΘ","label_en":"Cardiac surgery ICU","position":1,"match":[],"archived":false},{"fieldKey":"sex","value":"male","label_el":"Άνδρας","label_en":"Male","position":0,"match":[],"archived":false},{"fieldKey":"sex","value":"female","label_el":"Γυναίκα","label_en":"Female","position":1,"match":[],"archived":false},{"fieldKey":"admission_reason","value":"respiratory","label_el":"Αναπνευστική ανεπάρκεια","label_en":"Respiratory failure","position":0,"match":[],"archived":false},{"fieldKey":"admission_reason","value":"sepsis","label_el":"Σήψη / σηπτική καταπληξία","label_en":"Sepsis / septic shock","position":1,"match":[],"archived":false},{"fieldKey":"admission_reason","value":"cardiac_surgery","label_el":"Καρδιοχειρουργική επέμβαση","label_en":"Cardiac surgery","position":2,"match":[],"archived":false},{"fieldKey":"admission_reason","value":"postop","label_el":"Μετεγχειρητική παρακολούθηση","label_en":"Post-operative care","position":3,"match":[],"archived":false},{"fieldKey":"admission_reason","value":"cardiac","label_el":"Καρδιολογική","label_en":"Cardiac","position":4,"match":[],"archived":false},{"fieldKey":"admission_reason","value":"neuro","label_el":"Νευρολογική","label_en":"Neurological","position":5,"match":[],"archived":false},{"fieldKey":"admission_reason","value":"trauma","label_el":"Τραύμα","label_en":"Trauma","position":6,"match":[],"archived":false},{"fieldKey":"admission_reason","value":"other","label_el":"Άλλο","label_en":"Other","position":7,"match":[],"archived":false},{"fieldKey":"outcome","value":"transfer_ward","label_el":"Μεταφορά σε νοσηλευτικό τμήμα","label_en":"Transfer to a ward","position":0,"match":[],"archived":false},{"fieldKey":"outcome","value":"transfer_hospital","label_el":"Διακομιδή σε άλλο νοσοκομείο","label_en":"Transfer to another hospital","position":1,"match":[],"archived":false},{"fieldKey":"outcome","value":"death","label_el":"Θάνατος","label_en":"Death","position":2,"match":[],"archived":false},{"fieldKey":"transfer_department","value":"internal","label_el":"Παθολογική","label_en":"Internal Medicine","position":0,"match":[],"archived":false},{"fieldKey":"transfer_department","value":"surgical","label_el":"Χειρουργική","label_en":"Surgery","position":1,"match":[],"archived":false},{"fieldKey":"transfer_department","value":"cardiology","label_el":"Καρδιολογική","label_en":"Cardiology","position":2,"match":[],"archived":false},{"fieldKey":"transfer_department","value":"cardiac_surgery_ward","label_el":"Καρδιοχειρουργική κλινική","label_en":"Cardiac surgery ward","position":3,"match":[],"archived":false},{"fieldKey":"transfer_department","value":"neurology","label_el":"Νευρολογική","label_en":"Neurology","position":4,"match":[],"archived":false},{"fieldKey":"transfer_department","value":"orthopaedic","label_el":"Ορθοπαιδική","label_en":"Orthopaedics","position":5,"match":[],"archived":false},{"fieldKey":"transfer_department","value":"pulmonary","label_el":"Πνευμονολογική","label_en":"Pulmonology","position":6,"match":[],"archived":false},{"fieldKey":"transfer_department","value":"other_ward","label_el":"Άλλο τμήμα","label_en":"Other ward","position":7,"match":[],"archived":false}],"axes":[],"indicators":[{"key":"patients","position":0,"title_el":"Ασθενείς","title_en":"Patients","aggregation":"count","sheet_rows":[],"denominator_rows":[],"daily_only":false,"direction":"context","archived":false},{"key":"cardiac_share","position":1,"title_el":"% Καρδιοχειρουργικής ΜΕΘ","title_en":"% Cardiac surgery ICU","aggregation":"percent","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"context","archived":false},{"key":"mean_age","position":2,"title_el":"Μέση ηλικία","title_en":"Mean age","aggregation":"mean","field_key":"age","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"έτη","unit_en":"years","direction":"context","archived":false},{"key":"mean_icu_days","position":3,"title_el":"Μέσες ημέρες ΜΕΘ","title_en":"Mean ICU days","aggregation":"mean","field_key":"length_of_stay","date_field_key":"discharge_date","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"ημέρες","unit_en":"days","direction":"lower","archived":false},{"key":"mortality","position":4,"title_el":"Θνησιμότητα ΜΕΘ","title_en":"ICU mortality","aggregation":"percent","date_field_key":"discharge_date","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"lower","archived":false},{"key":"predicted_mortality","position":5,"title_el":"Μέση προβλεπόμενη θνητότητα (APACHE II)","title_en":"Mean predicted mortality (APACHE II)","aggregation":"mean","field_key":"apache_mortality","date_field_key":"discharge_date","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"context","archived":false},{"key":"mortality_scored","position":6,"title_el":"Θνησιμότητα ασθενών με APACHE II","title_en":"Mortality of APACHE II-scored patients","aggregation":"percent","date_field_key":"discharge_date","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"lower","note_el":"Συγκρίνεται με τη μέση προβλεπόμενη θνητότητα: ίδιοι ασθενείς.","note_en":"Compare with the mean predicted mortality: same patients.","archived":false},{"key":"smr","position":7,"title_el":"SMR (θνησιμότητα προς προβλεπόμενη)","title_en":"SMR (observed to predicted mortality)","aggregation":"smr","field_key":"apache_mortality","date_field_key":"discharge_date","sheet_rows":[],"denominator_rows":[],"daily_only":false,"direction":"lower","note_el":"Θάνατοι ÷ θάνατοι που προβλέπει το APACHE II. Κάτω από 1: λιγότεροι από τους αναμενόμενους. Χρειάζεται αρκετούς ασθενείς.","note_en":"Deaths ÷ deaths predicted by APACHE II. Below 1: fewer than expected. Needs enough patients.","archived":false},{"key":"mean_apache","position":8,"title_el":"Μέσο APACHE II","title_en":"Mean APACHE II","aggregation":"mean","field_key":"apache_score","sheet_rows":[],"denominator_rows":[],"daily_only":false,"direction":"context","archived":false},{"key":"mean_ventilator_hours","position":9,"title_el":"Μέσες ώρες αναπνευστήρα (διασωληνωμένοι)","title_en":"Mean ventilator hours (ventilated)","aggregation":"mean","field_key":"ventilator_hours","date_field_key":"discharge_date","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"ώρες","unit_en":"hours","direction":"lower","archived":false},{"key":"pressure_ulcers","position":10,"title_el":"% με κατάκλιση","title_en":"% pressure ulcers","aggregation":"percent","date_field_key":"discharge_date","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"lower","note_el":"Μόνο όσοι βγήκαν, στον μήνα εξόδου.","note_en":"Discharged patients only, in the month of discharge.","archived":false},{"key":"readmissions_48h","position":11,"title_el":"% επανεισαγωγών 48ώρου","title_en":"% readmissions within 48 h","aggregation":"percent","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"lower","archived":false},{"key":"requisitions","position":12,"title_el":"Επιτάξεις","title_en":"Requisitioned beds","aggregation":"count","sheet_rows":[],"denominator_rows":[],"daily_only":false,"direction":"context","archived":false}],"filters":[{"indicatorKey":"cardiac_share","part":"numerator","position":0,"field_key":"category","op":"eq","value":"cardiac"},{"indicatorKey":"mean_icu_days","part":"numerator","position":0,"field_key":"discharge_date","op":"filled"},{"indicatorKey":"mortality","part":"numerator","position":0,"field_key":"outcome","op":"eq","value":"death"},{"indicatorKey":"mortality","part":"denominator","position":0,"field_key":"outcome","op":"filled"},{"indicatorKey":"predicted_mortality","part":"numerator","position":0,"field_key":"outcome","op":"filled"},{"indicatorKey":"mortality_scored","part":"numerator","position":0,"field_key":"outcome","op":"eq","value":"death"},{"indicatorKey":"mortality_scored","part":"denominator","position":0,"field_key":"outcome","op":"filled"},{"indicatorKey":"mortality_scored","part":"denominator","position":1,"field_key":"apache_mortality","op":"filled"},{"indicatorKey":"smr","part":"numerator","position":0,"field_key":"outcome","op":"eq","value":"death"},{"indicatorKey":"smr","part":"denominator","position":0,"field_key":"outcome","op":"filled"},{"indicatorKey":"smr","part":"denominator","position":1,"field_key":"apache_mortality","op":"filled"},{"indicatorKey":"mean_ventilator_hours","part":"numerator","position":0,"field_key":"ventilator_hours","op":"gt","value":"0"},{"indicatorKey":"pressure_ulcers","part":"numerator","position":0,"field_key":"pressure_ulcer","op":"yes"},{"indicatorKey":"pressure_ulcers","part":"denominator","position":0,"field_key":"discharge_date","op":"filled"},{"indicatorKey":"readmissions_48h","part":"numerator","position":0,"field_key":"readmission_48h","op":"yes"},{"indicatorKey":"readmissions_48h","part":"denominator","position":0,"field_key":"readmission_48h","op":"filled"},{"indicatorKey":"requisitions","part":"numerator","position":0,"field_key":"requisition","op":"yes"}]}$tpl$::jsonb
    when 'nicu' then $tpl${"name_el":"Μητρώο νεογνών ΜΕΝΝ","name_en":"NICU neonatal register","description_el":"Μία καρτέλα ανά νεογνό: εισαγωγή, τοκετός, νοσηλεία, έξοδος. Δείκτες: καισαρικές, διάρκεια νοσηλείας, αναπνευστήρας, θνησιμότητα, λοιμώξεις.","description_en":"One card per neonate: admission, birth, stay, discharge. Indicators: caesareans, length of stay, ventilation, mortality, infections.","kind":"case","entry_date_field":"admission_date","identity_case_number":true,"identity_patient_name":true,"sections":[{"key":"admission","label_el":"Εισαγωγή","label_en":"Admission","position":0},{"key":"birth","label_el":"Κύηση και τοκετός","label_en":"Pregnancy and birth","position":1},{"key":"stay","label_el":"Νοσηλεία","label_en":"Stay","position":2},{"key":"discharge","label_el":"Έξοδος","label_en":"Discharge","position":3}],"fields":[{"key":"admission_date","section_key":"admission","position":0,"field_type":"date","label_el":"Ημερομηνία εισαγωγής","label_en":"Admission date","required":true,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"birth_date","section_key":"admission","position":1,"field_type":"date","label_el":"Ημερομηνία γέννησης","label_en":"Date of birth","required":true,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"age_on_admission","section_key":"admission","position":2,"field_type":"computed","label_el":"Ηλικία κατά την εισαγωγή","label_en":"Age on admission","unit_el":"ημέρες","unit_en":"days","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"help_el":"Διακρίνει τα νεογνά του μαιευτηρίου από όσα έρχονται αργότερα.","help_en":"Separates neonates born here from later admissions.","computed_kind":"age_days","computed_from":"birth_date","computed_to":"admission_date","aliases":[],"archived":false},{"key":"readmission","section_key":"admission","position":3,"field_type":"yes_no","label_el":"Επανεισαγωγή","label_en":"Readmission","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"admission_reason","section_key":"admission","position":4,"field_type":"choice","label_el":"Αιτία εισαγωγής","label_en":"Reason for admission","required":false,"in_list":false,"in_breakdown":true,"provisional":true,"help_el":"Με πολλές αιτίες κρατιέται η πρώτη.","help_en":"With several reasons, the first one is kept.","aliases":[],"archived":false},{"key":"admission_origin","section_key":"admission","position":5,"field_type":"choice","label_el":"Προέλευση εισαγωγής","label_en":"Admitted from","required":false,"in_list":false,"in_breakdown":true,"provisional":true,"aliases":[],"archived":false},{"key":"gestation","section_key":"birth","position":6,"field_type":"gestation","label_el":"Διάρκεια κύησης","label_en":"Gestational age","min_value":154,"max_value":308,"required":false,"in_list":true,"in_breakdown":false,"provisional":false,"help_el":"Εβδομάδες + ημέρες, π.χ. 37+4.","help_en":"Weeks + days, e.g. 37+4.","aliases":[],"archived":false},{"key":"pregnancy_type","section_key":"birth","position":7,"field_type":"choice","label_el":"Τύπος κύησης","label_en":"Pregnancy","required":false,"in_list":false,"in_breakdown":false,"provisional":true,"aliases":[],"archived":false},{"key":"delivery","section_key":"birth","position":8,"field_type":"choice","label_el":"Είδος τοκετού","label_en":"Mode of delivery","required":true,"in_list":true,"in_breakdown":false,"provisional":false,"help_el":"Σικυουλκία, εμβρυουλκία και τοκετός εκτός νοσοκομείου μετρούν ως φυσιολογικός.","help_en":"Vacuum, forceps and births before arrival count as vaginal.","aliases":[],"archived":false},{"key":"ivf","section_key":"birth","position":9,"field_type":"yes_no","label_el":"Εξωσωματική (IVF)","label_en":"IVF","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"prom_24h","section_key":"birth","position":10,"field_type":"yes_no","label_el":"Ρήξη θυλακίου > 24 ώρες","label_en":"Rupture of membranes > 24 h","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"birth_weight","section_key":"birth","position":11,"field_type":"number","label_el":"Βάρος εισόδου","label_en":"Admission weight","unit_el":"g","unit_en":"g","min_value":300,"max_value":6000,"usual_min":500,"usual_max":5000,"required":true,"in_list":true,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"apgar_1","section_key":"birth","position":12,"field_type":"number","label_el":"APGAR 1′","label_en":"APGAR 1 min","min_value":0,"max_value":10,"required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"apgar_5","section_key":"birth","position":13,"field_type":"number","label_el":"APGAR 5′","label_en":"APGAR 5 min","min_value":0,"max_value":10,"required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"resuscitation","section_key":"birth","position":14,"field_type":"choice","label_el":"Ανάνηψη","label_en":"Resuscitation","required":false,"in_list":false,"in_breakdown":false,"provisional":true,"aliases":[],"archived":false},{"key":"congenital_anomalies","section_key":"birth","position":15,"field_type":"yes_no","label_el":"Συγγενείς ανωμαλίες","label_en":"Congenital anomalies","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"ventilator_days","section_key":"stay","position":16,"field_type":"number","label_el":"Ημέρες στον αναπνευστήρα","label_en":"Ventilator days","unit_el":"ημέρες","unit_en":"days","min_value":0,"max_value":365,"required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"hfov","section_key":"stay","position":17,"field_type":"yes_no","label_el":"HFOV","label_en":"HFOV","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"show_when_key":"ventilator_days","aliases":[],"archived":false},{"key":"cpap_days","section_key":"stay","position":18,"field_type":"number","label_el":"Ημέρες σε CPAP","label_en":"CPAP days","unit_el":"ημέρες","unit_en":"days","min_value":0,"max_value":365,"required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"oxygen_days","section_key":"stay","position":19,"field_type":"number","label_el":"Ημέρες χορήγησης οξυγόνου","label_en":"Oxygen days","unit_el":"ημέρες","unit_en":"days","min_value":0,"max_value":365,"required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"oxygen_after_36w","section_key":"stay","position":20,"field_type":"yes_no","label_el":"Οξυγόνο μετά τις 36 εβδ.","label_en":"Oxygen after 36 weeks","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"help_el":"Στην εισαγωγή: ημέρες πάνω από 0 σημαίνουν Ναι.","help_en":"On import: days above 0 mean Yes.","aliases":[],"archived":false},{"key":"umbilical_catheter","section_key":"stay","position":21,"field_type":"choice","label_el":"Ομφαλικός καθετήρας","label_en":"Umbilical catheter","required":false,"in_list":false,"in_breakdown":false,"provisional":true,"aliases":[],"archived":false},{"key":"central_line_days","section_key":"stay","position":22,"field_type":"number","label_el":"Ημέρες φλεβικού καθετήρα","label_en":"Central line days","unit_el":"ημέρες","unit_en":"days","min_value":0,"max_value":365,"required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"arterial_line_days","section_key":"stay","position":23,"field_type":"number","label_el":"Ημέρες αρτηριακού καθετήρα","label_en":"Arterial line days","unit_el":"ημέρες","unit_en":"days","min_value":0,"max_value":365,"required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"tpn_days","section_key":"stay","position":24,"field_type":"number","label_el":"Ημέρες TPN","label_en":"TPN days","unit_el":"ημέρες","unit_en":"days","min_value":0,"max_value":365,"required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"picc_days","section_key":"stay","position":25,"field_type":"number","label_el":"Ημέρες PICC line","label_en":"PICC line days","unit_el":"ημέρες","unit_en":"days","min_value":0,"max_value":365,"required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"nasogastric","section_key":"stay","position":26,"field_type":"yes_no","label_el":"Σίτιση με ρινογαστρικό","label_en":"Nasogastric feeding","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"bottle_feeding","section_key":"stay","position":27,"field_type":"yes_no","label_el":"Αποκλειστική σίτιση με μπιμπερό","label_en":"Exclusive bottle feeding","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"help_el":"Στην εισαγωγή: μια ημερομηνία σημαίνει Ναι.","help_en":"On import: a date means Yes.","aliases":[],"archived":false},{"key":"breast_milk","section_key":"stay","position":28,"field_type":"choice","label_el":"Διατήρηση μητρικού γάλακτος","label_en":"Breast milk","required":false,"in_list":false,"in_breakdown":false,"provisional":true,"aliases":[],"archived":false},{"key":"early_infection","section_key":"stay","position":29,"field_type":"yes_no","label_el":"Επιβεβαιωμένη πρώιμη λοίμωξη","label_en":"Confirmed early-onset infection","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"help_el":"Θα συνδεθεί με το επεισόδιο στην Επιτήρηση.","help_en":"To be linked with the Surveillance episode.","aliases":[],"archived":false},{"key":"late_infection","section_key":"stay","position":30,"field_type":"yes_no","label_el":"Επιβεβαιωμένη όψιμη λοίμωξη","label_en":"Confirmed late-onset infection","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"help_el":"Θα συνδεθεί με το επεισόδιο στην Επιτήρηση.","help_en":"To be linked with the Surveillance episode.","aliases":[],"archived":false},{"key":"discharge_date","section_key":"discharge","position":31,"field_type":"date","label_el":"Ημερομηνία εξόδου","label_en":"Discharge date","required":false,"in_list":true,"in_breakdown":false,"provisional":false,"not_before_key":"admission_date","aliases":[],"archived":false},{"key":"length_of_stay","section_key":"discharge","position":32,"field_type":"computed","label_el":"Διάρκεια νοσηλείας","label_en":"Length of stay","unit_el":"ημέρες","unit_en":"days","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"help_el":"Υπολογίζεται από την εισαγωγή και την έξοδο.","help_en":"From admission and discharge.","computed_kind":"days","computed_from":"admission_date","computed_to":"discharge_date","aliases":[],"archived":false},{"key":"discharge_weight","section_key":"discharge","position":33,"field_type":"number","label_el":"Βάρος εξόδου","label_en":"Discharge weight","unit_el":"g","unit_en":"g","min_value":300,"max_value":8000,"required":false,"in_list":false,"in_breakdown":false,"provisional":false,"show_when_key":"discharge_date","aliases":[],"archived":false},{"key":"outcome","section_key":"discharge","position":34,"field_type":"choice","label_el":"Έκβαση","label_en":"Outcome","required":false,"in_list":true,"in_breakdown":true,"provisional":false,"show_when_key":"discharge_date","aliases":[],"archived":false}],"options":[{"fieldKey":"admission_reason","value":"observation","label_el":"Παρακολούθηση - διερεύνηση","label_en":"Observation - investigation","position":0,"match":[],"archived":false},{"fieldKey":"admission_reason","value":"prematurity","label_el":"Προωρότητα","label_en":"Prematurity","position":1,"match":[],"archived":false},{"fieldKey":"admission_reason","value":"respiratory","label_el":"Αναπνευστική δυσχέρεια","label_en":"Respiratory distress","position":2,"match":[],"archived":false},{"fieldKey":"admission_reason","value":"jaundice","label_el":"Ίκτερος","label_en":"Jaundice","position":3,"match":[],"archived":false},{"fieldKey":"admission_reason","value":"infection","label_el":"Λοίμωξη / σήψη","label_en":"Infection / sepsis","position":4,"match":[],"archived":false},{"fieldKey":"admission_reason","value":"low_weight","label_el":"Χαμηλό βάρος γέννησης / IUGR","label_en":"Low birth weight / IUGR","position":5,"match":[],"archived":false},{"fieldKey":"admission_reason","value":"congenital","label_el":"Συγγενής ανωμαλία","label_en":"Congenital anomaly","position":6,"match":[],"archived":false},{"fieldKey":"admission_reason","value":"boarding","label_el":"Φιλοξενία","label_en":"Boarding","position":7,"match":[],"archived":false},{"fieldKey":"admission_reason","value":"other","label_el":"Άλλο","label_en":"Other","position":8,"match":[],"archived":false},{"fieldKey":"admission_origin","value":"delivery_room","label_el":"Αίθουσα Τοκετών","label_en":"Delivery room","position":0,"match":[],"archived":false},{"fieldKey":"admission_origin","value":"maternity","label_el":"Μαιευτική κλινική","label_en":"Maternity ward","position":1,"match":[],"archived":false},{"fieldKey":"admission_origin","value":"other_hospital","label_el":"Άλλο νοσοκομείο","label_en":"Other hospital","position":2,"match":[],"archived":false},{"fieldKey":"admission_origin","value":"home","label_el":"Από το σπίτι","label_en":"From home","position":3,"match":[],"archived":false},{"fieldKey":"pregnancy_type","value":"single","label_el":"Μονήρης","label_en":"Singleton","position":0,"match":[],"archived":false},{"fieldKey":"pregnancy_type","value":"twin","label_el":"Δίδυμη","label_en":"Twin","position":1,"match":[],"archived":false},{"fieldKey":"pregnancy_type","value":"multiple","label_el":"Πολύδυμη","label_en":"Higher order","position":2,"match":[],"archived":false},{"fieldKey":"delivery","value":"vaginal","label_el":"Φυσιολογικός τοκετός (Φ/Τ)","label_en":"Vaginal delivery","position":0,"match":[],"archived":false},{"fieldKey":"delivery","value":"cs","label_el":"Καισαρική τομή (Κ/Τ)","label_en":"Caesarean section","position":1,"match":[],"archived":false},{"fieldKey":"resuscitation","value":"none","label_el":"Καμία","label_en":"None","position":0,"match":[],"archived":false},{"fieldKey":"resuscitation","value":"oxygen","label_el":"Οξυγόνο","label_en":"Oxygen","position":1,"match":[],"archived":false},{"fieldKey":"resuscitation","value":"bag_mask","label_el":"Μάσκα - ασκός","label_en":"Bag and mask","position":2,"match":[],"archived":false},{"fieldKey":"resuscitation","value":"intubation","label_el":"Διασωλήνωση","label_en":"Intubation","position":3,"match":[],"archived":false},{"fieldKey":"resuscitation","value":"cpr","label_el":"ΚΑΡΠΑ","label_en":"CPR","position":4,"match":[],"archived":false},{"fieldKey":"resuscitation","value":"unspecified","label_el":"Ναι, χωρίς είδος","label_en":"Yes, type not recorded","position":5,"match":[],"archived":false},{"fieldKey":"umbilical_catheter","value":"none","label_el":"Όχι","label_en":"None","position":0,"match":[],"archived":false},{"fieldKey":"umbilical_catheter","value":"venous","label_el":"Φλεβικός","label_en":"Venous","position":1,"match":[],"archived":false},{"fieldKey":"umbilical_catheter","value":"arterial","label_el":"Αρτηριακός","label_en":"Arterial","position":2,"match":[],"archived":false},{"fieldKey":"umbilical_catheter","value":"both","label_el":"Φλεβικός και αρτηριακός","label_en":"Venous and arterial","position":3,"match":[],"archived":false},{"fieldKey":"umbilical_catheter","value":"unspecified","label_el":"Ναι, χωρίς είδος","label_en":"Yes, type not recorded","position":4,"match":[],"archived":false},{"fieldKey":"breast_milk","value":"exclusive","label_el":"Αποκλειστικά μητρικό","label_en":"Exclusive","position":0,"match":[],"archived":false},{"fieldKey":"breast_milk","value":"mixed","label_el":"Μικτή σίτιση","label_en":"Mixed","position":1,"match":[],"archived":false},{"fieldKey":"breast_milk","value":"none","label_el":"Όχι","label_en":"None","position":2,"match":[],"archived":false},{"fieldKey":"breast_milk","value":"unspecified","label_el":"Ναι, χωρίς είδος","label_en":"Yes, type not recorded","position":3,"match":[],"archived":false},{"fieldKey":"outcome","value":"home","label_el":"Εξιτήριο","label_en":"Discharged home","position":0,"match":[],"archived":false},{"fieldKey":"outcome","value":"transfer_hospital","label_el":"Διακομιδή σε άλλο νοσοκομείο","label_en":"Transfer to another hospital","position":1,"match":[],"archived":false},{"fieldKey":"outcome","value":"transfer_ward","label_el":"Μεταφορά σε άλλη κλινική","label_en":"Transfer to another ward","position":2,"match":[],"archived":false},{"fieldKey":"outcome","value":"death","label_el":"Θάνατος","label_en":"Death","position":3,"match":[],"archived":false}],"axes":[],"indicators":[{"key":"admissions","position":0,"title_el":"Εισαγωγές νεογνών","title_en":"Neonatal admissions","aggregation":"count","sheet_rows":[],"denominator_rows":[],"daily_only":false,"direction":"context","archived":false},{"key":"cs_rate","position":1,"title_el":"% με καισαρική τομή","title_en":"% caesarean section","aggregation":"percent","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"context","archived":false},{"key":"vaginal_rate","position":2,"title_el":"% με φυσιολογικό τοκετό","title_en":"% vaginal delivery","aggregation":"percent","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"context","archived":false},{"key":"mean_los","position":3,"title_el":"Μέση διάρκεια νοσηλείας","title_en":"Mean length of stay","aggregation":"mean","field_key":"length_of_stay","date_field_key":"discharge_date","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"ημέρες","unit_en":"days","direction":"lower","note_el":"Μόνο όσα νεογνά βγήκαν, στον μήνα εξόδου.","note_en":"Discharged neonates only, in the month of discharge.","archived":false},{"key":"median_los","position":4,"title_el":"Διάμεση διάρκεια νοσηλείας","title_en":"Median length of stay","aggregation":"median","field_key":"length_of_stay","date_field_key":"discharge_date","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"ημέρες","unit_en":"days","direction":"context","archived":false},{"key":"mean_ventilator","position":5,"title_el":"Μέσες ημέρες στον αναπνευστήρα","title_en":"Mean ventilator days","aggregation":"mean","field_key":"ventilator_days","date_field_key":"discharge_date","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"ημέρες","unit_en":"days","direction":"lower","note_el":"Μόνο όσα νεογνά χρειάστηκαν αναπνευστήρα.","note_en":"Neonates who were ventilated only.","archived":false},{"key":"mean_cpap","position":6,"title_el":"Μέσες ημέρες σε CPAP","title_en":"Mean CPAP days","aggregation":"mean","field_key":"cpap_days","date_field_key":"discharge_date","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"ημέρες","unit_en":"days","direction":"lower","archived":false},{"key":"mortality","position":7,"title_el":"Θνησιμότητα","title_en":"Mortality","aggregation":"percent","date_field_key":"discharge_date","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"lower","archived":false},{"key":"readmissions","position":8,"title_el":"% επανεισαγωγών","title_en":"% readmissions","aggregation":"percent","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"lower","archived":false},{"key":"apgar_1","position":9,"title_el":"Μέσο APGAR 1′","title_en":"Mean APGAR 1 min","aggregation":"mean","field_key":"apgar_1","sheet_rows":[],"denominator_rows":[],"daily_only":false,"direction":"context","archived":false},{"key":"apgar_5","position":10,"title_el":"Μέσο APGAR 5′","title_en":"Mean APGAR 5 min","aggregation":"mean","field_key":"apgar_5","sheet_rows":[],"denominator_rows":[],"daily_only":false,"direction":"context","archived":false},{"key":"late_infection_rate","position":11,"title_el":"Όψιμες λοιμώξεις ανά 1.000 ημέρες καθετήρα","title_en":"Late-onset infections per 1,000 line days","aggregation":"rate","date_field_key":"discharge_date","denominator_field_key":"central_line_days","multiplier":1000,"sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"/1.000 ημέρες καθετήρα","unit_en":"/1,000 line days","direction":"lower","archived":false},{"key":"breast_milk","position":12,"title_el":"% με αποκλειστικά μητρικό γάλα","title_en":"% exclusive breast milk","aggregation":"percent","date_field_key":"discharge_date","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"higher","archived":false},{"key":"no_breast_milk","position":13,"title_el":"% χωρίς μητρικό γάλα","title_en":"% without breast milk","aggregation":"percent","date_field_key":"discharge_date","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"lower","archived":false}],"filters":[{"indicatorKey":"cs_rate","part":"numerator","position":0,"field_key":"delivery","op":"eq","value":"cs"},{"indicatorKey":"cs_rate","part":"denominator","position":0,"field_key":"delivery","op":"filled"},{"indicatorKey":"vaginal_rate","part":"numerator","position":0,"field_key":"delivery","op":"eq","value":"vaginal"},{"indicatorKey":"vaginal_rate","part":"denominator","position":0,"field_key":"delivery","op":"filled"},{"indicatorKey":"mean_los","part":"numerator","position":0,"field_key":"discharge_date","op":"filled"},{"indicatorKey":"median_los","part":"numerator","position":0,"field_key":"discharge_date","op":"filled"},{"indicatorKey":"mean_ventilator","part":"numerator","position":0,"field_key":"ventilator_days","op":"gt","value":"0"},{"indicatorKey":"mean_cpap","part":"numerator","position":0,"field_key":"cpap_days","op":"gt","value":"0"},{"indicatorKey":"mortality","part":"numerator","position":0,"field_key":"outcome","op":"eq","value":"death"},{"indicatorKey":"mortality","part":"denominator","position":0,"field_key":"outcome","op":"filled"},{"indicatorKey":"readmissions","part":"numerator","position":0,"field_key":"readmission","op":"yes"},{"indicatorKey":"late_infection_rate","part":"numerator","position":0,"field_key":"late_infection","op":"yes"},{"indicatorKey":"breast_milk","part":"numerator","position":0,"field_key":"breast_milk","op":"eq","value":"exclusive"},{"indicatorKey":"breast_milk","part":"denominator","position":0,"field_key":"breast_milk","op":"filled"},{"indicatorKey":"no_breast_milk","part":"numerator","position":0,"field_key":"breast_milk","op":"eq","value":"none"},{"indicatorKey":"no_breast_milk","part":"denominator","position":0,"field_key":"breast_milk","op":"filled"}]}$tpl$::jsonb
    when 'paediatrics' then $tpl${"name_el":"Μητρώο νοσηλευομένων Παιδιατρικής","name_en":"Paediatrics inpatient register","description_el":"Νέο μητρώο: μία καρτέλα ανά νοσηλεία παιδιού. Αιτία εισαγωγής ως λίστα, ηλικία από την ημερομηνία γέννησης, διάρκεια νοσηλείας υπολογιζόμενη, επανεισαγωγές 30 ημερών, μεταφορές σε ΜΕΘ Παίδων.","description_en":"New register: one card per child stay. Reason as a list, age from the date of birth, length of stay computed, 30-day readmissions, transfers to the paediatric ICU.","kind":"case","entry_date_field":"admission_date","identity_case_number":true,"identity_patient_name":true,"sections":[{"key":"admission","label_el":"Εισαγωγή","label_en":"Admission","position":0},{"key":"stay","label_el":"Νοσηλεία","label_en":"Stay","position":1},{"key":"discharge","label_el":"Έξοδος","label_en":"Discharge","position":2}],"fields":[{"key":"admission_date","section_key":"admission","position":0,"field_type":"date","label_el":"Ημερομηνία εισαγωγής","label_en":"Admission date","required":true,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"birth_date","section_key":"admission","position":1,"field_type":"date","label_el":"Ημερομηνία γέννησης","label_en":"Date of birth","required":true,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"age","section_key":"admission","position":2,"field_type":"computed","label_el":"Ηλικία","label_en":"Age","unit_el":"έτη","unit_en":"years","required":false,"in_list":true,"in_breakdown":false,"provisional":false,"computed_kind":"age_years","computed_from":"birth_date","computed_to":"admission_date","aliases":[],"archived":false},{"key":"age_group","section_key":"admission","position":3,"field_type":"choice","label_el":"Ηλικιακή ομάδα","label_en":"Age group","required":true,"in_list":false,"in_breakdown":true,"provisional":false,"aliases":[],"archived":false},{"key":"sex","section_key":"admission","position":4,"field_type":"choice","label_el":"Φύλο","label_en":"Sex","required":true,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"admission_reason","section_key":"admission","position":5,"field_type":"choice","label_el":"Αιτία εισαγωγής","label_en":"Reason for admission","required":true,"in_list":true,"in_breakdown":true,"provisional":false,"aliases":[],"archived":false},{"key":"admission_reason_text","section_key":"admission","position":6,"field_type":"text","label_el":"Αιτία εισαγωγής (λεπτομέρειες)","label_en":"Reason (details)","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"from_ed","section_key":"admission","position":7,"field_type":"yes_no","label_el":"Από τα ΤΕΠ","label_en":"Admitted through the ED","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"readmission_30d","section_key":"admission","position":8,"field_type":"yes_no","label_el":"Επανεισαγωγή εντός 30 ημερών","label_en":"Readmission within 30 days","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"physician","section_key":"admission","position":9,"field_type":"text","label_el":"Θεράπων ιατρός","label_en":"Attending physician","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"isolation","section_key":"stay","position":10,"field_type":"yes_no","label_el":"Απομόνωση","label_en":"Isolation","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"iv_antibiotics","section_key":"stay","position":11,"field_type":"yes_no","label_el":"Ενδοφλέβια αντιβίωση","label_en":"IV antibiotics","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"iv_antibiotic_days","section_key":"stay","position":12,"field_type":"number","label_el":"Ημέρες ενδοφλέβιας αντιβίωσης","label_en":"IV antibiotic days","unit_el":"ημέρες","unit_en":"days","min_value":0,"max_value":365,"required":false,"in_list":false,"in_breakdown":false,"provisional":false,"show_when_key":"iv_antibiotics","show_when_value":"true","aliases":[],"archived":false},{"key":"peripheral_line_days","section_key":"stay","position":13,"field_type":"number","label_el":"Ημέρες περιφερικού φλεβοκαθετήρα","label_en":"Peripheral line days","unit_el":"ημέρες","unit_en":"days","min_value":0,"max_value":365,"required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"phlebitis","section_key":"stay","position":14,"field_type":"yes_no","label_el":"Φλεβίτιδα περιφερικού καθετήρα","label_en":"Peripheral line phlebitis","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"help_el":"Για τον δείκτη φλεβίτιδας ανά 1.000 ημέρες καθετήρα.","help_en":"For the phlebitis rate per 1,000 line days.","show_when_key":"peripheral_line_days","aliases":[],"archived":false},{"key":"hai","section_key":"stay","position":15,"field_type":"yes_no","label_el":"Λοίμωξη σχετιζόμενη με τη νοσηλεία","label_en":"Healthcare-associated infection","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"help_el":"Θα συνδεθεί με το επεισόδιο στην Επιτήρηση.","help_en":"To be linked with the Surveillance episode.","aliases":[],"archived":false},{"key":"fall","section_key":"stay","position":16,"field_type":"yes_no","label_el":"Πτώση","label_en":"Fall","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"help_el":"Κάθε πτώση δηλώνεται και ως αναφορά συμβάντος.","help_en":"Every fall is also reported as an incident.","aliases":[],"archived":false},{"key":"discharge_date","section_key":"discharge","position":17,"field_type":"date","label_el":"Ημερομηνία εξόδου","label_en":"Discharge date","required":false,"in_list":true,"in_breakdown":false,"provisional":false,"not_before_key":"admission_date","aliases":[],"archived":false},{"key":"length_of_stay","section_key":"discharge","position":18,"field_type":"computed","label_el":"Διάρκεια νοσηλείας","label_en":"Length of stay","unit_el":"ημέρες","unit_en":"days","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"computed_kind":"days","computed_from":"admission_date","computed_to":"discharge_date","aliases":[],"archived":false},{"key":"outcome","section_key":"discharge","position":19,"field_type":"choice","label_el":"Έκβαση","label_en":"Outcome","required":false,"in_list":true,"in_breakdown":true,"provisional":false,"show_when_key":"discharge_date","aliases":[],"archived":false},{"key":"notes","section_key":"discharge","position":20,"field_type":"text","label_el":"Παρατηρήσεις","label_en":"Notes","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false}],"options":[{"fieldKey":"age_group","value":"infant","label_el":"Βρέφος (< 1 έτους)","label_en":"Infant (< 1 year)","position":0,"match":[],"archived":false},{"fieldKey":"age_group","value":"toddler","label_el":"Νήπιο (1–4)","label_en":"Toddler (1–4)","position":1,"match":[],"archived":false},{"fieldKey":"age_group","value":"child","label_el":"Παιδί (5–11)","label_en":"Child (5–11)","position":2,"match":[],"archived":false},{"fieldKey":"age_group","value":"adolescent","label_el":"Έφηβος (12–16)","label_en":"Adolescent (12–16)","position":3,"match":[],"archived":false},{"fieldKey":"sex","value":"male","label_el":"Άρρεν","label_en":"Male","position":0,"match":[],"archived":false},{"fieldKey":"sex","value":"female","label_el":"Θήλυ","label_en":"Female","position":1,"match":[],"archived":false},{"fieldKey":"admission_reason","value":"respiratory","label_el":"Λοίμωξη αναπνευστικού","label_en":"Respiratory infection","position":0,"match":[],"archived":false},{"fieldKey":"admission_reason","value":"gastro","label_el":"Γαστρεντερίτιδα / αφυδάτωση","label_en":"Gastroenteritis / dehydration","position":1,"match":[],"archived":false},{"fieldKey":"admission_reason","value":"fever","label_el":"Πυρετός προς διερεύνηση","label_en":"Fever under investigation","position":2,"match":[],"archived":false},{"fieldKey":"admission_reason","value":"uti","label_el":"Ουρολοίμωξη","label_en":"Urinary tract infection","position":3,"match":[],"archived":false},{"fieldKey":"admission_reason","value":"seizure","label_el":"Σπασμοί","label_en":"Seizures","position":4,"match":[],"archived":false},{"fieldKey":"admission_reason","value":"injury","label_el":"Ατύχημα / τραυματισμός","label_en":"Injury","position":5,"match":[],"archived":false},{"fieldKey":"admission_reason","value":"surgical","label_el":"Χειρουργικό","label_en":"Surgical","position":6,"match":[],"archived":false},{"fieldKey":"admission_reason","value":"other","label_el":"Άλλο","label_en":"Other","position":7,"match":[],"archived":false},{"fieldKey":"outcome","value":"home","label_el":"Εξιτήριο","label_en":"Discharged home","position":0,"match":[],"archived":false},{"fieldKey":"outcome","value":"picu","label_el":"Μεταφορά σε ΜΕΘ Παίδων","label_en":"Transfer to paediatric ICU","position":1,"match":[],"archived":false},{"fieldKey":"outcome","value":"transfer_hospital","label_el":"Διακομιδή σε άλλο νοσοκομείο","label_en":"Transfer to another hospital","position":2,"match":[],"archived":false},{"fieldKey":"outcome","value":"against_advice","label_el":"Αποχώρηση με ευθύνη γονέων","label_en":"Left against medical advice","position":3,"match":[],"archived":false},{"fieldKey":"outcome","value":"death","label_el":"Θάνατος","label_en":"Death","position":4,"match":[],"archived":false}],"axes":[],"indicators":[{"key":"admissions","position":0,"title_el":"Εισαγωγές","title_en":"Admissions","aggregation":"count","sheet_rows":[],"denominator_rows":[],"daily_only":false,"direction":"context","archived":false},{"key":"mean_los","position":1,"title_el":"Μέση διάρκεια νοσηλείας","title_en":"Mean length of stay","aggregation":"mean","field_key":"length_of_stay","date_field_key":"discharge_date","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"ημέρες","unit_en":"days","direction":"lower","archived":false},{"key":"median_los","position":2,"title_el":"Διάμεση διάρκεια νοσηλείας","title_en":"Median length of stay","aggregation":"median","field_key":"length_of_stay","date_field_key":"discharge_date","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"ημέρες","unit_en":"days","direction":"context","archived":false},{"key":"readmissions","position":3,"title_el":"% επανεισαγωγών 30 ημερών","title_en":"% 30-day readmissions","aggregation":"percent","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"lower","archived":false},{"key":"picu","position":4,"title_el":"% μεταφορών σε ΜΕΘ Παίδων","title_en":"% transfers to paediatric ICU","aggregation":"percent","date_field_key":"discharge_date","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"lower","archived":false},{"key":"iv_antibiotics","position":5,"title_el":"% με ενδοφλέβια αντιβίωση","title_en":"% on IV antibiotics","aggregation":"percent","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"context","archived":false},{"key":"hai","position":6,"title_el":"% με λοίμωξη σχετιζόμενη με τη νοσηλεία","title_en":"% healthcare-associated infection","aggregation":"percent","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"lower","archived":false},{"key":"falls","position":7,"title_el":"Πτώσεις","title_en":"Falls","aggregation":"count","sheet_rows":[],"denominator_rows":[],"daily_only":false,"direction":"lower","archived":false},{"key":"hai_rate","position":8,"title_el":"Λοιμώξεις νοσηλείας ανά 1.000 ημέρες νοσηλείας","title_en":"Healthcare-associated infections per 1,000 patient-days","aggregation":"rate","date_field_key":"discharge_date","denominator_field_key":"length_of_stay","multiplier":1000,"sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"/1.000 ημέρες νοσηλείας","unit_en":"/1,000 patient-days","direction":"lower","note_el":"Μόνο όσα παιδιά βγήκαν, στον μήνα εξόδου.","note_en":"Discharged children only, in the month of discharge.","archived":false},{"key":"falls_rate","position":9,"title_el":"Πτώσεις ανά 1.000 ημέρες νοσηλείας","title_en":"Falls per 1,000 patient-days","aggregation":"rate","date_field_key":"discharge_date","denominator_field_key":"length_of_stay","multiplier":1000,"sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"/1.000 ημέρες νοσηλείας","unit_en":"/1,000 patient-days","direction":"lower","note_el":"Μόνο όσα παιδιά βγήκαν, στον μήνα εξόδου.","note_en":"Discharged children only, in the month of discharge.","archived":false},{"key":"phlebitis_rate","position":10,"title_el":"Φλεβίτιδα ανά 1.000 ημέρες περιφερικού καθετήρα","title_en":"Phlebitis per 1,000 peripheral line days","aggregation":"rate","date_field_key":"discharge_date","denominator_field_key":"peripheral_line_days","multiplier":1000,"sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"/1.000 ημέρες καθετήρα","unit_en":"/1,000 line days","direction":"lower","archived":false},{"key":"isolation","position":11,"title_el":"% παιδιών σε απομόνωση","title_en":"% children in isolation","aggregation":"percent","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"context","archived":false},{"key":"from_ed","position":12,"title_el":"% εισαγωγών από τα ΤΕΠ","title_en":"% admitted through the ED","aggregation":"percent","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"context","archived":false}],"filters":[{"indicatorKey":"mean_los","part":"numerator","position":0,"field_key":"discharge_date","op":"filled"},{"indicatorKey":"median_los","part":"numerator","position":0,"field_key":"discharge_date","op":"filled"},{"indicatorKey":"readmissions","part":"numerator","position":0,"field_key":"readmission_30d","op":"yes"},{"indicatorKey":"picu","part":"numerator","position":0,"field_key":"outcome","op":"eq","value":"picu"},{"indicatorKey":"picu","part":"denominator","position":0,"field_key":"outcome","op":"filled"},{"indicatorKey":"iv_antibiotics","part":"numerator","position":0,"field_key":"iv_antibiotics","op":"yes"},{"indicatorKey":"hai","part":"numerator","position":0,"field_key":"hai","op":"yes"},{"indicatorKey":"falls","part":"numerator","position":0,"field_key":"fall","op":"yes"},{"indicatorKey":"hai_rate","part":"numerator","position":0,"field_key":"hai","op":"yes"},{"indicatorKey":"hai_rate","part":"denominator","position":0,"field_key":"discharge_date","op":"filled"},{"indicatorKey":"falls_rate","part":"numerator","position":0,"field_key":"fall","op":"yes"},{"indicatorKey":"falls_rate","part":"denominator","position":0,"field_key":"discharge_date","op":"filled"},{"indicatorKey":"phlebitis_rate","part":"numerator","position":0,"field_key":"phlebitis","op":"yes"},{"indicatorKey":"phlebitis_rate","part":"denominator","position":0,"field_key":"peripheral_line_days","op":"gt","value":"0"},{"indicatorKey":"isolation","part":"numerator","position":0,"field_key":"isolation","op":"yes"},{"indicatorKey":"from_ed","part":"numerator","position":0,"field_key":"from_ed","op":"yes"}]}$tpl$::jsonb
    when 'endoscopy' then $tpl${"name_el":"Πράξεις Ενδοσκοπικού","name_en":"Endoscopy procedures","description_el":"Ένα φύλλο ανά μήνα με το πλήθος κάθε πράξης. Δείκτες: σύνολο, μερίδιο γαστροσκοπήσεων και κολονοσκοπήσεων.","description_en":"One sheet per month with the number of each procedure. Indicators: total, share of gastroscopies and colonoscopies.","kind":"sheet","entry_date_field":null,"identity_case_number":false,"identity_patient_name":false,"sections":[],"fields":[],"options":[],"axes":[{"axis":"row","key":"gastroscopy","label_el":"Γαστροσκοπήσεις","label_en":"Gastroscopies","position":0,"aliases":[],"archived":false},{"axis":"row","key":"colonoscopy","label_el":"Κολονοσκοπήσεις","label_en":"Colonoscopies","position":1,"aliases":[],"archived":false},{"axis":"row","key":"gastrostomy","label_el":"Γαστροστομίες","label_en":"Gastrostomies","position":2,"aliases":[],"archived":false},{"axis":"row","key":"cystoscopy","label_el":"Κυστεοσκοπήσεις","label_en":"Cystoscopies","position":3,"aliases":[],"archived":false},{"axis":"row","key":"bronchoscopy","label_el":"Βρογχοσκοπήσεις","label_en":"Bronchoscopies","position":4,"aliases":[],"archived":false},{"axis":"row","key":"ercp","label_el":"ERCP","label_en":"ERCP","position":5,"aliases":[],"archived":false},{"axis":"row","key":"eus","label_el":"EUS","label_en":"EUS","position":6,"aliases":[],"archived":false},{"axis":"row","key":"ebus","label_el":"EBUS","label_en":"EBUS","position":7,"aliases":[],"archived":false},{"axis":"measure","key":"count","label_el":"Αριθμός","label_en":"Number","position":0,"aliases":[],"archived":false}],"indicators":[{"key":"total","position":0,"title_el":"Σύνολο πράξεων","title_en":"Total procedures","aggregation":"sum","sheet_rows":[],"denominator_rows":[],"daily_only":false,"direction":"context","archived":false},{"key":"gastroscopy_share","position":1,"title_el":"% γαστροσκοπήσεων","title_en":"% gastroscopies","aggregation":"percent","sheet_rows":["gastroscopy"],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"context","archived":false},{"key":"colonoscopy_share","position":2,"title_el":"% κολονοσκοπήσεων","title_en":"% colonoscopies","aggregation":"percent","sheet_rows":["colonoscopy"],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"context","archived":false},{"key":"advanced_share","position":3,"title_el":"% προηγμένων πράξεων (ERCP, EUS, EBUS)","title_en":"% advanced procedures (ERCP, EUS, EBUS)","aggregation":"percent","sheet_rows":["ercp","eus","ebus"],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"context","archived":false},{"key":"daily_mean","position":4,"title_el":"Μέσος αριθμός πράξεων ανά ημέρα λειτουργίας","title_en":"Mean procedures per working day","aggregation":"mean","sheet_rows":[],"denominator_rows":[],"daily_only":true,"direction":"context","note_el":"Από τα ημερήσια φύλλα· οι μήνες που καταχωρίστηκαν με ένα σύνολο δεν μετράνε.","note_en":"From the daily sheets; months recorded as a single total are left out.","archived":false},{"key":"days_recorded","position":5,"title_el":"Ημέρες με καταχώριση","title_en":"Days recorded","aggregation":"count","sheet_rows":[],"denominator_rows":[],"daily_only":true,"direction":"context","archived":false}],"filters":[]}$tpl$::jsonb
    when 'obstetrics' then $tpl${"name_el":"Μητρώο λεχωίδων Μαιευτικής","name_en":"Obstetrics postpartum register","description_el":"Μία καρτέλα ανά λεχωίδα: τοκετός, θηλασμός κατά την έξοδο, προγεννητικά μαθήματα, θήλαστρο.","description_en":"One card per mother: delivery, breastfeeding at discharge, antenatal classes, breast pump.","kind":"case","entry_date_field":"date","identity_case_number":true,"identity_patient_name":true,"sections":[{"key":"main","label_el":"Λεχωίδα","label_en":"Mother","position":0}],"fields":[{"key":"date","section_key":"main","position":0,"field_type":"date","label_el":"Ημερομηνία τοκετού","label_en":"Delivery date","required":true,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"delivery","section_key":"main","position":1,"field_type":"choice","label_el":"Τοκετός","label_en":"Delivery","required":true,"in_list":true,"in_breakdown":true,"provisional":false,"aliases":[],"archived":false},{"key":"breastfeeding","section_key":"main","position":2,"field_type":"choice","label_el":"Μητρικός θηλασμός κατά την έξοδο","label_en":"Breastfeeding at discharge","required":false,"in_list":true,"in_breakdown":true,"provisional":false,"aliases":[],"archived":false},{"key":"antenatal","section_key":"main","position":3,"field_type":"choice","label_el":"Προγεννητικά μαθήματα","label_en":"Antenatal classes","required":false,"in_list":true,"in_breakdown":true,"provisional":false,"aliases":[],"archived":false},{"key":"breast_pump","section_key":"main","position":4,"field_type":"yes_no","label_el":"Θήλαστρο","label_en":"Breast pump","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false},{"key":"physician","section_key":"main","position":5,"field_type":"choice","label_el":"Θεράπων ιατρός","label_en":"Attending physician","required":false,"in_list":false,"in_breakdown":false,"provisional":true,"help_el":"Οι ιατροί προστίθενται κατά την εισαγωγή ή στον ορισμό του μητρώου.","help_en":"Physicians are added on import or in the register definition.","aliases":[],"archived":false},{"key":"notes","section_key":"main","position":6,"field_type":"text","label_el":"Παρατηρήσεις","label_en":"Notes","required":false,"in_list":false,"in_breakdown":false,"provisional":false,"aliases":[],"archived":false}],"options":[{"fieldKey":"delivery","value":"vaginal","label_el":"Φυσιολογικός (Φ/Τ)","label_en":"Vaginal","position":0,"match":[],"archived":false},{"fieldKey":"delivery","value":"cs","label_el":"Καισαρική τομή (Κ/Τ)","label_en":"Caesarean section","position":1,"match":[],"archived":false},{"fieldKey":"breastfeeding","value":"exclusive","label_el":"Αποκλειστικός μητρικός θηλασμός","label_en":"Exclusive breastfeeding","position":0,"match":[],"archived":false},{"fieldKey":"breastfeeding","value":"mixed","label_el":"Μεικτή διατροφή","label_en":"Mixed feeding","position":1,"match":[],"archived":false},{"fieldKey":"breastfeeding","value":"weaning","label_el":"Απογαλακτισμός","label_en":"Weaning","position":2,"match":[],"archived":false},{"fieldKey":"antenatal","value":"attended","label_el":"Παρακολούθησε","label_en":"Attended","position":0,"match":[],"archived":false},{"fieldKey":"antenatal","value":"aware_not_attended","label_el":"Το γνώριζε, δεν παρακολούθησε","label_en":"Aware, did not attend","position":1,"match":[],"archived":false},{"fieldKey":"antenatal","value":"not_aware","label_el":"Δεν το γνώριζε","label_en":"Not aware","position":2,"match":[],"archived":false},{"fieldKey":"antenatal","value":"no","label_el":"Όχι","label_en":"No","position":3,"match":[],"archived":false},{"fieldKey":"physician","value":"rallis_g","label_el":"Γ. Ράλλης","label_en":"G. Rallis","position":0,"match":[],"archived":false},{"fieldKey":"physician","value":"mavridou_e","label_el":"Ε. Μαυρίδου","label_en":"E. Mavridou","position":1,"match":[],"archived":false},{"fieldKey":"physician","value":"kostopoulos_d","label_el":"Δ. Κωστόπουλος","label_en":"D. Kostopoulos","position":2,"match":[],"archived":false},{"fieldKey":"physician","value":"petridou_s","label_el":"Σ. Πετρίδου","label_en":"S. Petridou","position":3,"match":[],"archived":false}],"axes":[],"indicators":[{"key":"mothers","position":0,"title_el":"Λεχωίδες","title_en":"Mothers","aggregation":"count","sheet_rows":[],"denominator_rows":[],"daily_only":false,"direction":"context","archived":false},{"key":"cs_rate","position":1,"title_el":"% καισαρικών τομών","title_en":"% caesarean sections","aggregation":"percent","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"context","note_el":"Ανά λεχωίδα του τμήματος. Η Αίθουσα Τοκετών μετράει όλους τους τοκετούς.","note_en":"Per mother on the ward. The delivery room counts every delivery.","archived":false},{"key":"exclusive_bf","position":2,"title_el":"% αποκλειστικού μητρικού θηλασμού","title_en":"% exclusive breastfeeding","aggregation":"percent","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"higher","archived":false},{"key":"weaning","position":3,"title_el":"% απογαλακτισμού","title_en":"% weaning","aggregation":"percent","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"lower","archived":false},{"key":"antenatal","position":4,"title_el":"% με προγεννητικά μαθήματα","title_en":"% attended antenatal classes","aggregation":"percent","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"higher","archived":false},{"key":"breast_pump","position":5,"title_el":"% με θήλαστρο","title_en":"% breast pump","aggregation":"percent","sheet_rows":[],"denominator_rows":[],"daily_only":false,"unit_el":"%","direction":"context","archived":false}],"filters":[{"indicatorKey":"cs_rate","part":"numerator","position":0,"field_key":"delivery","op":"eq","value":"cs"},{"indicatorKey":"cs_rate","part":"denominator","position":0,"field_key":"delivery","op":"filled"},{"indicatorKey":"exclusive_bf","part":"numerator","position":0,"field_key":"breastfeeding","op":"eq","value":"exclusive"},{"indicatorKey":"exclusive_bf","part":"denominator","position":0,"field_key":"breastfeeding","op":"filled"},{"indicatorKey":"weaning","part":"numerator","position":0,"field_key":"breastfeeding","op":"eq","value":"weaning"},{"indicatorKey":"weaning","part":"denominator","position":0,"field_key":"breastfeeding","op":"filled"},{"indicatorKey":"antenatal","part":"numerator","position":0,"field_key":"antenatal","op":"eq","value":"attended"},{"indicatorKey":"antenatal","part":"denominator","position":0,"field_key":"antenatal","op":"filled"},{"indicatorKey":"breast_pump","part":"numerator","position":0,"field_key":"breast_pump","op":"yes"}]}$tpl$::jsonb
    when 'deliveryRoom' then $tpl${"name_el":"Πράξεις Αίθουσας Τοκετών","name_en":"Delivery room activity","description_el":"Ένα φύλλο ανά ημέρα: τοκετοί και λοιπές πράξεις. Οι φυσιολογικοί μετά από καισαρική μετριούνται ως μέρος των φυσιολογικών τοκετών, όχι επιπλέον.","description_en":"One sheet per month: deliveries and other procedures. VBAC is counted within vaginal deliveries, not on top.","kind":"sheet","entry_date_field":null,"identity_case_number":false,"identity_patient_name":false,"sections":[],"fields":[],"options":[],"axes":[{"axis":"row","key":"vaginal","label_el":"Φυσιολογικοί τοκετοί","label_en":"Vaginal deliveries","group_key":"deliveries","position":0,"aliases":[],"archived":false},{"axis":"row","key":"cs","label_el":"Καισαρικές τομές","label_en":"Caesarean sections","group_key":"deliveries","position":1,"aliases":[],"archived":false},{"axis":"row","key":"vbac","label_el":"Φυσιολογικοί μετά από καισαρική (μέρος των φυσιολογικών)","label_en":"Vaginal after caesarean (within vaginal)","group_key":"deliveries","position":2,"aliases":[],"archived":false},{"axis":"row","key":"multiple_vaginal","label_el":"Πολύδυμες με φυσιολογικό τοκετό","label_en":"Multiple pregnancies, vaginal","group_key":"deliveries","position":3,"aliases":[],"archived":false},{"axis":"row","key":"multiple_cs","label_el":"Πολύδυμες με καισαρική τομή","label_en":"Multiple pregnancies, caesarean","group_key":"deliveries","position":4,"aliases":[],"archived":false},{"axis":"row","key":"born_before_arrival","label_el":"Τοκετοί πριν την άφιξη στο νοσοκομείο","label_en":"Born before arrival","group_key":"deliveries","position":5,"aliases":[],"archived":false},{"axis":"row","key":"hysteroscopy","label_el":"Υστεροσκοπήσεις","label_en":"Hysteroscopies","group_key":"other","position":6,"aliases":[],"archived":false},{"axis":"row","key":"septic","label_el":"Σηπτικά","label_en":"Septic procedures","group_key":"other","position":7,"aliases":[],"archived":false},{"axis":"row","key":"pregnancy_monitoring","label_el":"Παρακολούθηση κύησης","label_en":"Pregnancy monitoring","group_key":"other","position":8,"aliases":[],"archived":false},{"axis":"row","key":"cerclage","label_el":"Περίδεση τραχήλου","label_en":"Cervical cerclage","group_key":"other","position":9,"aliases":[],"archived":false},{"axis":"measure","key":"count","label_el":"Αριθμός","label_en":"Number","position":0,"aliases":[],"archived":false},{"axis":"group","key":"deliveries","label_el":"Τοκετοί","label_en":"Deliveries","position":0,"aliases":[],"archived":false},{"axis":"group","key":"other","label_el":"Λοιπές πράξεις","label_en":"Other procedures","position":1,"aliases":[],"archived":false}],"indicators":[{"key":"deliveries","position":0,"title_el":"Σύνολο τοκετών","title_en":"Total deliveries","aggregation":"sum","sheet_rows":["vaginal","cs"],"denominator_rows":[],"daily_only":false,"direction":"context","archived":false},{"key":"cs_rate","position":1,"title_el":"% καισαρικών τομών","title_en":"% caesarean sections","aggregation":"percent","sheet_rows":["cs"],"denominator_rows":["vaginal","cs"],"daily_only":false,"unit_el":"%","direction":"lower","archived":false},{"key":"vbac_rate","position":2,"title_el":"Φυσιολογικοί τοκετοί μετά από καισαρική","title_en":"Vaginal births after caesarean","aggregation":"sum","sheet_rows":["vbac"],"denominator_rows":[],"daily_only":false,"direction":"context","archived":false},{"key":"multiple_cs_rate","position":3,"title_el":"% πολύδυμων που γεννήθηκαν με καισαρική","title_en":"% multiple pregnancies born by caesarean","aggregation":"percent","sheet_rows":["multiple_cs"],"denominator_rows":["multiple_cs","multiple_vaginal"],"daily_only":false,"unit_el":"%","direction":"context","archived":false},{"key":"hysteroscopies","position":4,"title_el":"Υστεροσκοπήσεις","title_en":"Hysteroscopies","aggregation":"sum","sheet_rows":["hysteroscopy"],"denominator_rows":[],"daily_only":false,"direction":"context","archived":false},{"key":"septic","position":5,"title_el":"Σηπτικά","title_en":"Septic procedures","aggregation":"sum","sheet_rows":["septic"],"denominator_rows":[],"daily_only":false,"direction":"context","archived":false},{"key":"born_before_arrival","position":6,"title_el":"Τοκετοί πριν την άφιξη στο νοσοκομείο","title_en":"Births before arrival at the hospital","aggregation":"sum","sheet_rows":["born_before_arrival"],"denominator_rows":[],"daily_only":false,"direction":"context","note_el":"Δεν περιλαμβάνονται στο σύνολο των τοκετών.","note_en":"Not included in the total deliveries.","archived":false},{"key":"daily_deliveries","position":7,"title_el":"Μέσος αριθμός τοκετών ανά ημέρα","title_en":"Mean deliveries per day","aggregation":"mean","sheet_rows":["vaginal","cs"],"denominator_rows":[],"daily_only":true,"direction":"context","note_el":"Από τα ημερήσια φύλλα· οι μήνες που καταχωρίστηκαν με ένα σύνολο δεν μετράνε.","note_en":"From the daily sheets; months recorded as one total do not count.","archived":false},{"sheet_rows":["cerclage"],"denominator_rows":[],"daily_only":false,"direction":"context","archived":false,"aggregation":"sum","multiplier":1,"key":"cerclages","position":8,"title_el":"Περιδέσεις τραχήλου","title_en":"Cervical cerclages"},{"sheet_rows":["pregnancy_monitoring"],"denominator_rows":[],"daily_only":false,"direction":"context","archived":false,"aggregation":"sum","multiplier":1,"key":"pregnancy_monitoring","position":9,"title_el":"Παρακολουθήσεις κύησης","title_en":"Pregnancy monitoring"}],"filters":[]}$tpl$::jsonb
    when 'emergency' then $tpl${"name_el":"Δραστηριότητα ΤΕΠ ανά βάρδια","name_en":"Emergency department activity by shift","description_el":"Ένα φύλλο ανά μήνα: κάθε κατηγορία ανά βάρδια. Ο καταχωρητής καταγράφεται αυτόματα.","description_en":"One sheet per month: each category per shift. Who recorded it is kept automatically.","kind":"sheet","entry_date_field":null,"identity_case_number":false,"identity_patient_name":false,"sections":[],"fields":[],"options":[],"axes":[{"axis":"row","key":"surgical","label_el":"Χειρουργικά","label_en":"Surgical","position":0,"aliases":[],"archived":false},{"axis":"row","key":"urgent","label_el":"Έκτακτα","label_en":"Urgent","position":1,"aliases":[],"archived":false},{"axis":"row","key":"admissions","label_el":"Εισαγωγές","label_en":"Admissions","position":2,"aliases":[],"archived":false},{"axis":"row","key":"dressings","label_el":"Αλλαγές","label_en":"Dressings","position":3,"aliases":[],"archived":false},{"axis":"row","key":"septic","label_el":"Σηπτικά","label_en":"Septic","position":4,"aliases":[],"archived":false},{"axis":"row","key":"assessments","label_el":"Εκτιμήσεις","label_en":"Assessments","position":5,"aliases":[],"archived":false},{"axis":"row","key":"checkup","label_el":"ΗΚΓ - check up","label_en":"ECG - check-up","position":6,"aliases":[],"archived":false},{"axis":"row","key":"preop","label_el":"Προεγχειρητικός έλεγχος","label_en":"Pre-operative check","position":7,"aliases":[],"archived":false},{"axis":"row","key":"left_without_seen","label_el":"Αποχώρησαν χωρίς εξέταση","label_en":"Left without being seen","position":8,"aliases":[],"archived":false},{"axis":"row","key":"revisit_72h","label_el":"Επανεπισκέψεις εντός 72 ωρών","label_en":"Return visits within 72 hours","position":9,"aliases":[],"archived":false},{"axis":"row","key":"transfers","label_el":"Διακομιδές σε άλλο νοσοκομείο","label_en":"Transfers to another hospital","position":10,"aliases":[],"archived":false},{"axis":"measure","key":"morning","label_el":"07:00-15:00","label_en":"07:00-15:00","position":0,"aliases":[],"archived":false},{"axis":"measure","key":"afternoon","label_el":"15:00-23:00","label_en":"15:00-23:00","position":1,"aliases":[],"archived":false},{"axis":"measure","key":"night","label_el":"23:00-07:00","label_en":"23:00-07:00","position":2,"aliases":[],"archived":false}],"indicators":[{"key":"total","position":0,"title_el":"Σύνολο περιστατικών","title_en":"Total cases","aggregation":"sum","sheet_rows":["surgical","urgent","checkup","preop","assessments","septic"],"denominator_rows":[],"daily_only":false,"direction":"context","archived":false},{"key":"admissions","position":1,"title_el":"Εισαγωγές","title_en":"Admissions","aggregation":"sum","sheet_rows":["admissions"],"denominator_rows":[],"daily_only":false,"direction":"context","archived":false},{"key":"admission_rate","position":2,"title_el":"% εισαγωγών από τα ΤΕΠ","title_en":"% admitted from the emergency department","aggregation":"percent","sheet_rows":["admissions"],"denominator_rows":["surgical","urgent","checkup","preop","assessments","septic"],"daily_only":false,"unit_el":"%","direction":"context","note_el":"Εισαγωγές ÷ περιστατικά του ΤΕΠ.","note_en":"Admissions ÷ the department’s cases.","archived":false},{"key":"daily_cases","position":3,"title_el":"Μέσος αριθμός περιστατικών ανά ημέρα","title_en":"Mean cases per day","aggregation":"mean","sheet_rows":["surgical","urgent","checkup","preop","assessments","septic"],"denominator_rows":[],"daily_only":true,"direction":"context","note_el":"Από τα ημερήσια φύλλα· οι μήνες που καταχωρίστηκαν με ένα σύνολο δεν μετράνε.","note_en":"From the daily sheets; months recorded as one total do not count.","archived":false},{"key":"night_share","position":4,"title_el":"% περιστατικών στη νυχτερινή βάρδια","title_en":"% of cases on the night shift","aggregation":"percent","sheet_rows":["surgical","urgent","checkup","preop","assessments","septic"],"sheet_measure":"night","denominator_rows":["surgical","urgent","checkup","preop","assessments","septic"],"daily_only":false,"unit_el":"%","direction":"context","archived":false},{"key":"septic","position":5,"title_el":"Σηπτικά","title_en":"Septic","aggregation":"sum","sheet_rows":["septic"],"denominator_rows":[],"daily_only":false,"direction":"context","archived":false},{"key":"dressings","position":6,"title_el":"Αλλαγές τραυμάτων","title_en":"Wound dressings","aggregation":"sum","sheet_rows":["dressings"],"denominator_rows":[],"daily_only":false,"direction":"context","note_el":"Δεν περιλαμβάνονται στο σύνολο περιστατικών.","note_en":"Not part of the total cases.","archived":false},{"key":"left_without_seen_rate","position":7,"title_el":"% αποχωρήσεων χωρίς εξέταση","title_en":"% left without being seen","aggregation":"percent","sheet_rows":["left_without_seen"],"denominator_rows":["surgical","urgent","checkup","preop","assessments","septic"],"daily_only":false,"unit_el":"%","target":2,"direction":"lower","note_el":"Οι ασθενείς που έφυγαν πριν εξεταστούν, ως ποσοστό των περιστατικών του ΤΕΠ.","note_en":"Patients who left before being seen, as a share of the emergency department's cases.","archived":false},{"key":"revisit_72h_rate","position":8,"title_el":"% επανεπισκέψεων εντός 72 ωρών","title_en":"% return visits within 72 hours","aggregation":"percent","sheet_rows":["revisit_72h"],"denominator_rows":["surgical","urgent","checkup","preop","assessments","septic"],"daily_only":false,"unit_el":"%","target":5,"direction":"lower","note_el":"Ασθενείς που ξαναήρθαν στο ΤΕΠ εντός 72 ωρών από προηγούμενη επίσκεψη.","note_en":"Patients who came back to the emergency department within 72 hours of a previous visit.","archived":false},{"key":"transfer_rate","position":9,"title_el":"% διακομιδών σε άλλο νοσοκομείο","title_en":"% transfers to another hospital","aggregation":"percent","sheet_rows":["transfers"],"denominator_rows":["surgical","urgent","checkup","preop","assessments","septic"],"daily_only":false,"unit_el":"%","direction":"context","note_el":"Πληροφοριακός δείκτης: δεν κρίνεται ως καλός ή κακός.","note_en":"Informative: it is not judged as good or bad.","archived":false}],"filters":[]}$tpl$::jsonb
  end;
$function$;
revoke all on function private.demo_register_template(text) from public, anon, authenticated;

-- Ο πίνακας δεδομένων ενός Demo μητρώου: ίδιος με το public.department_register_sync
-- (20261105100000) χωρίς τον έλεγχο ρόλου του χρήστη, ώστε η επαναφορά να
-- δουλεύει με όποιον ρόλο έχει ο αξιολογητής. Μόνο για μητρώα Demo νοσοκομείων.
create or replace function private.demo_register_sync(p_register_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  r public.department_registers;
  f public.department_register_fields;
  cell record;
  base text;
  ident text;
begin
  select * into r from public.department_registers where id = p_register_id for update;
  if not found then raise exception 'Unknown register'; end if;
  if not exists (select 1 from public.organizations o where o.id = r.organization_id and o.is_demo) then
    raise exception 'Only Demo organizations' using errcode = '42501';
  end if;
  base := r.table_name;
  if base is null then
    base := 'register_' || left(regexp_replace(lower(coalesce(r.template_key, 'custom')), '[^a-z0-9]+', '_', 'g'), 20) || '_' || left(replace(r.id::text, '-', ''), 8);
    update public.department_registers set table_name = base where id = r.id;
  end if;
  ident := base || '_identity';

  execute format($t$create table if not exists public.%I (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references public.organizations(id) on delete cascade,
    department_id uuid references public.departments(id) on delete set null,
    register_id uuid not null references public.department_registers(id) on delete cascade,
    entry_date date not null default current_date,
    period_start date unique,
    status text not null default 'complete' check (status in ('draft','complete')),
    locked boolean not null default false,
    definition_version integer not null default 1,
    created_by uuid default auth.uid(),
    created_at timestamptz not null default now(),
    updated_by uuid default auth.uid(),
    updated_at timestamptz not null default now())$t$, base);
  execute format('create index if not exists %I on public.%I (entry_date desc)', base || '_date_idx', base);
  execute format('comment on table public.%I is %L', base, 'Data of the register «' || r.name_el || '» (' || r.code || '): one column per field, no names.');
  execute format('create or replace trigger trg_register_row_scope before insert or update on public.%I for each row execute function private.register_row_scope(%L)', base, r.id);
  execute format('alter table public.%I enable row level security', base);
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = base and policyname = 'register_read') then
    execute format($p$create policy register_read on public.%I for select to authenticated using (
    public.current_user_is_platform_owner()
    or public.current_user_has_org_role(organization_id, array['hospital_admin'::public.app_role,'quality_manager'::public.app_role,'infection_control_lead'::public.app_role])
    or public.current_user_has_capability(organization_id, 'view_quality')
    or (department_id is not null and public.current_user_has_department_scope(organization_id, department_id)))$p$, base);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = base and policyname = 'register_insert') then
    execute format($p$create policy register_insert on public.%I for insert to authenticated with check (
    public.current_user_is_platform_owner()
    or public.current_user_has_org_role(organization_id, array['hospital_admin'::public.app_role])
    or exists (select 1 from public.department_registers d where d.id = register_id and d.status = 'active'
      and d.department_id is not null and public.current_user_has_department_scope(d.organization_id, d.department_id)))$p$, base);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = base and policyname = 'register_update') then
    execute format($p$create policy register_update on public.%I for update to authenticated using (
    public.current_user_is_platform_owner()
    or public.current_user_has_org_role(organization_id, array['hospital_admin'::public.app_role,'quality_manager'::public.app_role])
    or public.current_user_has_capability(organization_id, 'manage_quality')
    or (department_id is not null and public.current_user_has_department_scope(organization_id, department_id)
      and (not locked or public.current_user_has_org_role(organization_id, array['department_manager'::public.app_role]))))
    with check (
    public.current_user_is_platform_owner()
    or public.current_user_has_org_role(organization_id, array['hospital_admin'::public.app_role,'quality_manager'::public.app_role])
    or public.current_user_has_capability(organization_id, 'manage_quality')
    or (department_id is not null and public.current_user_has_department_scope(organization_id, department_id)))$p$, base);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = base and policyname = 'register_delete') then
    execute format($p$create policy register_delete on public.%I for delete to authenticated using (
    public.current_user_is_platform_owner()
    or public.current_user_has_org_role(organization_id, array['hospital_admin'::public.app_role])
    or (not locked and department_id is not null and public.current_user_has_department_scope(organization_id, department_id)))$p$, base);
  end if;
  execute format('revoke all on public.%I from anon', base);
  execute format('grant select, insert, update, delete on public.%I to authenticated', base);

  for f in select * from public.department_register_fields where register_id = r.id and not archived order by (field_type = 'computed'), position loop
    if not exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = base and c.column_name = f.key) then
      execute format('alter table public.%I add column %I %s', base, f.key, private.register_column_sql(f));
    end if;
    execute format('comment on column public.%I.%I is %L', base, f.key, f.label_el || coalesce(' (' || f.unit_el || ')', ''));
  end loop;

  for cell in
    select rw.key || '__' || m.key as column_name, rw.label_el || ' · ' || m.label_el as label
    from public.department_register_sheet_axes rw
    join public.department_register_sheet_axes m on m.register_id = rw.register_id and m.axis = 'measure' and not m.archived
    where rw.register_id = r.id and rw.axis = 'row' and not rw.archived
  loop
    if not exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = base and c.column_name = cell.column_name) then
      execute format('alter table public.%I add column %I integer check (%I >= 0)', base, cell.column_name, cell.column_name);
    end if;
    execute format('comment on column public.%I.%I is %L', base, cell.column_name, cell.label);
  end loop;

  if r.kind = 'case' then
    execute format($t$create table if not exists public.%I (
      entry_id uuid primary key references public.%I(id) on delete cascade,
      organization_id uuid not null references public.organizations(id) on delete cascade,
      department_id uuid references public.departments(id) on delete set null,
      case_number text,
      patient_name text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now())$t$, ident, base);
    execute format('create index if not exists %I on public.%I (case_number)', ident || '_case_idx', ident);
    execute format('comment on table public.%I is %L', ident, 'Who each entry of «' || r.name_el || '» is about. Readable only inside the department.');
    execute format('create or replace trigger trg_register_identity_scope before insert or update on public.%I for each row execute function private.register_identity_scope(%L)', ident, base);
    execute format('alter table public.%I enable row level security', ident);
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = ident and policyname = 'register_identity_department') then
      execute format($p$create policy register_identity_department on public.%I for all to authenticated using (
      public.current_user_is_platform_owner()
      or (department_id is not null and public.current_user_has_department_scope(organization_id, department_id)))
      with check (
      public.current_user_is_platform_owner()
      or exists (select 1 from public.%I e where e.id = entry_id
        and e.department_id is not null and public.current_user_has_department_scope(e.organization_id, e.department_id)))$p$, ident, base);
    end if;
    execute format('revoke all on public.%I from anon', ident);
    execute format('grant select, insert, update, delete on public.%I to authenticated', ident);
  end if;

  notify pgrst, 'reload schema';
  return base;
end;
$function$;
revoke all on function private.demo_register_sync(uuid) from public, anon, authenticated;

-- Φτιάχνει ένα μητρώο από πρότυπο, όπως η οθόνη «Νέο μητρώο»: γραμμή μητρώου,
-- ενότητες, πεδία, επιλογές, άξονες φύλλου, δείκτες, φίλτρα, στόχοι· μετά ο
-- πίνακας και οι γρήγορες αναγνώσεις. Επιστρέφει το id.
create or replace function private.demo_register_create(p_organization_id uuid, p_department_id uuid, p_code text, p_key text, p_actor uuid, p_daily_from date default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_tpl jsonb := private.demo_register_template(p_key);
  v_id uuid;
  v_table text;
begin
  if v_tpl is null then raise exception 'Unknown register template %', p_key; end if;
  -- Σταθερό όνομα πίνακα ανά νοσοκομείο και πρότυπο (βλ. σημείωση στην κορυφή).
  v_table := 'register_' || left(regexp_replace(lower(p_key), '[^a-z0-9]+', '_', 'g'), 20) || '_' || left(md5(p_organization_id::text || ':' || p_key), 8);
  if exists (select 1 from public.department_registers r where r.table_name = v_table) then v_table := null; end if;

  insert into public.department_registers (organization_id, department_id, code, name_el, name_en, description_el, description_en, kind, status, version, template_key, entry_date_field, daily_from, identity_case_number, identity_patient_name, table_name, history, created_by)
  values (p_organization_id, p_department_id, p_code, v_tpl ->> 'name_el', v_tpl ->> 'name_en', v_tpl ->> 'description_el', v_tpl ->> 'description_en', v_tpl ->> 'kind', 'active', 1, p_key,
    v_tpl ->> 'entry_date_field', case when v_tpl ->> 'kind' = 'sheet' then p_daily_from end,
    coalesce((v_tpl ->> 'identity_case_number')::boolean, false), coalesce((v_tpl ->> 'identity_patient_name')::boolean, false), v_table,
    jsonb_build_array(jsonb_build_object('at', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'action', 'created', 'actor', coalesce((select p.full_name from public.profiles p where p.id = p_actor), 'Demo'))),
    p_actor)
  returning id into v_id;

  insert into public.department_register_sections (organization_id, register_id, key, label_el, label_en, position)
  select p_organization_id, v_id, s.key, s.label_el, s.label_en, s.position
  from jsonb_populate_recordset(null::public.department_register_sections, v_tpl -> 'sections') s;

  insert into public.department_register_fields (organization_id, register_id, key, section_key, position, field_type, label_el, label_en, unit_el, unit_en, min_value, max_value, usual_min, usual_max, required, required_from, in_list, in_breakdown, provisional, help_el, help_en, not_before_key, show_when_key, show_when_value, computed_kind, computed_from, computed_to, aliases, archived)
  select p_organization_id, v_id, f.key, f.section_key, f.position, f.field_type, f.label_el, f.label_en, f.unit_el, f.unit_en, f.min_value, f.max_value, f.usual_min, f.usual_max, f.required, f.required_from, f.in_list, f.in_breakdown, f.provisional, f.help_el, f.help_en, f.not_before_key, f.show_when_key, f.show_when_value, f.computed_kind, f.computed_from, f.computed_to, '{}', false
  from jsonb_populate_recordset(null::public.department_register_fields, v_tpl -> 'fields') f;

  insert into public.department_register_options (organization_id, register_id, field_id, value, label_el, label_en, position, match, archived)
  select p_organization_id, v_id, f.id, o ->> 'value', o ->> 'label_el', o ->> 'label_en', (o ->> 'position')::integer, '{}', false
  from jsonb_array_elements(v_tpl -> 'options') o
  join public.department_register_fields f on f.register_id = v_id and f.key = o ->> 'fieldKey';

  insert into public.department_register_sheet_axes (organization_id, register_id, axis, key, label_el, label_en, help_el, help_en, group_key, position, aliases, archived)
  select p_organization_id, v_id, a.axis, a.key, a.label_el, a.label_en, a.help_el, a.help_en, a.group_key, a.position, '{}', false
  from jsonb_populate_recordset(null::public.department_register_sheet_axes, v_tpl -> 'axes') a;

  insert into public.department_register_indicators (organization_id, register_id, key, position, title_el, title_en, aggregation, field_key, date_field_key, denominator_field_key, multiplier, sheet_rows, sheet_measure, denominator_rows, denominator_measure, daily_only, unit_el, unit_en, target, threshold, direction, note_el, note_en, archived)
  select p_organization_id, v_id, i.key, i.position, i.title_el, i.title_en, i.aggregation, i.field_key, i.date_field_key, i.denominator_field_key, i.multiplier, coalesce(i.sheet_rows, '{}'), i.sheet_measure, coalesce(i.denominator_rows, '{}'), i.denominator_measure, coalesce(i.daily_only, false), i.unit_el, i.unit_en, i.target, i.threshold, i.direction, i.note_el, i.note_en, false
  from jsonb_populate_recordset(null::public.department_register_indicators, v_tpl -> 'indicators') i;

  insert into public.department_register_indicator_filters (organization_id, register_id, indicator_id, part, position, field_key, op, value)
  select p_organization_id, v_id, i.id, x ->> 'part', (x ->> 'position')::integer, x ->> 'field_key', x ->> 'op', x ->> 'value'
  from jsonb_array_elements(v_tpl -> 'filters') x
  join public.department_register_indicators i on i.register_id = v_id and i.key = x ->> 'indicatorKey';

  -- Στόχοι Demo: όσοι εγκρίθηκαν για τα πραγματικά μητρώα (20261230110300,
  -- 20261230111100, 20261231221000, 20261231222700). Οι στόχοι του ΤΕΠ έρχονται
  -- από το πρότυπο. Ο στόχος καισαρικών του Μητρώου λεχωίδων δεν μπαίνει (πρόταση).
  update public.department_register_indicators i
  set target = t.target, threshold = t.threshold, direction = t.direction
  from (values
    ('icu', 'mortality', 15::numeric, null::numeric, 'lower'), ('icu', 'mortality_scored', 15, null, 'lower'), ('icu', 'mean_icu_days', 5, null, 'lower'),
    ('icu', 'pressure_ulcers', 5, null, 'lower'), ('icu', 'readmissions_48h', 5, null, 'lower'), ('icu', 'mean_ventilator_hours', 96, null, 'lower'),
    ('nicu', 'mortality', 2, null, 'lower'), ('nicu', 'readmissions', 5, null, 'lower'), ('nicu', 'late_infection_rate', 5, null, 'lower'),
    ('nicu', 'breast_milk', 50, null, 'higher'), ('nicu', 'no_breast_milk', 15, null, 'lower'), ('nicu', 'mean_los', 14, null, 'lower'),
    ('nicu', 'mean_ventilator', 5, null, 'lower'), ('nicu', 'mean_cpap', 7, null, 'lower'),
    ('paediatrics', 'readmissions', 5, null, 'lower'), ('paediatrics', 'hai', 2, null, 'lower'), ('paediatrics', 'picu', 3, null, 'lower'),
    ('paediatrics', 'falls', 0, null, 'lower'), ('paediatrics', 'mean_los', 3, null, 'lower'),
    ('paediatrics', 'hai_rate', 0, null, 'lower'), ('paediatrics', 'falls_rate', 0, null, 'lower'), ('paediatrics', 'phlebitis_rate', 0, null, 'lower'),
    ('obstetrics', 'exclusive_bf', 60, null, 'higher'), ('obstetrics', 'antenatal', 50, null, 'higher'), ('obstetrics', 'weaning', 10, null, 'lower'),
    ('deliveryRoom', 'cs_rate', 55, 65, 'lower')
  ) as t(template_key, indicator_key, target, threshold, direction)
  where t.template_key = p_key and i.register_id = v_id and i.key = t.indicator_key;

  perform private.demo_register_sync(v_id);
  perform private.register_fast_policies(v_id);
  return v_id;
end;
$function$;
revoke all on function private.demo_register_create(uuid, uuid, text, text, uuid, date) from public, anon, authenticated;

-- Γράφει καταχωρίσεις στον πίνακα του μητρώου: κάθε στοιχείο του p_rows είναι ένα
-- αντικείμενο με κλειδιά τις στήλες (οι υπολογιζόμενες τις γεμίζει η βάση), συν
-- _case και _name για τον πίνακα ταυτότητας.
create or replace function private.demo_register_insert(p_register_id uuid, p_actor uuid, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_table text;
  v_kind text;
  v_cols text;
  v_count integer;
begin
  select table_name, kind into v_table, v_kind from public.department_registers where id = p_register_id;
  if v_table is null then raise exception 'Register has no data table'; end if;
  select string_agg(quote_ident(c.column_name), ', ' order by c.ordinal_position) into v_cols
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = v_table and c.is_generated = 'NEVER'
    and c.column_name in (select distinct k from jsonb_array_elements(p_rows) e, jsonb_object_keys(e) k);
  execute format('insert into public.%I (%s, created_by) select %s, $2 from jsonb_populate_recordset(null::public.%I, $1)', v_table, v_cols, v_cols, v_table)
    using p_rows, p_actor;
  get diagnostics v_count = row_count;
  if v_kind = 'case' then
    execute format('insert into public.%I (entry_id, case_number, patient_name) select (e ->> ''id'')::uuid, e ->> ''_case'', e ->> ''_name'' from jsonb_array_elements($1) e where e ? ''_case''', v_table || '_identity')
      using p_rows;
  end if;
  return v_count;
end;
$function$;
revoke all on function private.demo_register_insert(uuid, uuid, jsonb) from public, anon, authenticated;

-- Επινοημένο ονοματεπώνυμο (επώνυμο, όνομα) για το Demo.
create or replace function private.demo_register_name(p_i integer, p_salt integer, p_female boolean)
returns text
language sql
immutable
set search_path = ''
as $function$
  select case when p_female
    then (array['Παπαδοπούλου','Γεωργίου','Δημητρίου','Νικολάου','Κωνσταντίνου','Ιωάννου','Αθανασίου','Βασιλείου','Οικονόμου','Μακρή','Αντωνίου','Σταθοπούλου','Κυριακίδου','Λαμπροπούλου','Χριστοδούλου','Ζαχαρίου'])[1 + floor(private.demo_register_rand(p_i, p_salt) * 16)::integer]
      || ' ' || (array['Μαρία','Ελένη','Αικατερίνη','Βασιλική','Σοφία','Αγγελική','Δήμητρα','Ευαγγελία','Ιωάννα','Χριστίνα','Παναγιώτα','Αναστασία'])[1 + floor(private.demo_register_rand(p_i, p_salt + 1) * 12)::integer]
    else (array['Παπαδόπουλος','Γεωργίου','Δημητρίου','Νικολάου','Κωνσταντίνου','Ιωάννου','Αθανασίου','Βασιλείου','Οικονόμου','Μακρής','Αντωνίου','Σταθόπουλος','Κυριακίδης','Λαμπρόπουλος','Χριστοδούλου','Ζαχαρίου'])[1 + floor(private.demo_register_rand(p_i, p_salt) * 16)::integer]
      || ' ' || (array['Γεώργιος','Ιωάννης','Κωνσταντίνος','Δημήτριος','Νικόλαος','Παναγιώτης','Βασίλειος','Χρήστος','Αθανάσιος','Μιχαήλ','Ευάγγελος','Σπυρίδων'])[1 + floor(private.demo_register_rand(p_i, p_salt + 1) * 12)::integer]
  end;
$function$;
revoke all on function private.demo_register_name(integer, integer, boolean) from public, anon, authenticated;

-- ΜΕΘ: 84 νοσηλείες σε ~6 μήνες, Γενική και Καρδιοχειρουργική, μερικοί ακόμη μέσα.
create or replace function private.demo_seed_register_icu(p_register_id uuid, p_actor uuid, d0 date)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  n constant integer := 84;
  v_rows jsonb := '[]'::jsonb;
  i integer;
  v_adm date; v_dis date; v_cardiac boolean; v_reason text; v_postop boolean; v_age integer; v_apache integer; v_los integer;
  v_vent integer; v_outcome text; v_transfer text; v_female boolean;
  r double precision[];
begin
  for i in 1..n loop
    r := array(select private.demo_register_rand(i, 1000 + k) from generate_series(1, 24) k);
    v_adm := d0 - (floor((i - 1) * 182.0 / n) + floor(r[1] * 2))::integer;
    v_cardiac := r[2] < 0.25;
    v_reason := case when v_cardiac then case when r[3] < 0.85 then 'cardiac_surgery' else 'cardiac' end
      when r[3] < 0.26 then 'respiratory' when r[3] < 0.46 then 'sepsis' when r[3] < 0.72 then 'postop'
      when r[3] < 0.82 then 'cardiac' when r[3] < 0.92 then 'neuro' when r[3] < 0.97 then 'trauma' else 'other' end;
    v_postop := v_reason in ('postop', 'cardiac_surgery');
    v_age := case when v_cardiac then 52 + floor(r[4] * 33) else 28 + floor(r[4] * 62) end;
    v_apache := case when v_cardiac then 6 + floor(r[5] * 14) when v_postop then 8 + floor(r[5] * 16) else 12 + floor(r[5] * 22) end;
    v_los := case when v_cardiac then 1 + floor(r[6] * r[6] * 5) when v_reason = 'postop' then 1 + floor(r[6] * r[6] * 6) else 2 + floor(r[6] * r[6] * 18) end;
    v_dis := case when v_adm + v_los <= d0 then v_adm + v_los end;
    v_vent := case when v_cardiac then 4 + floor(r[7] * 20)
      when v_reason in ('respiratory', 'sepsis', 'neuro', 'trauma') and r[7] < 0.85 then greatest(12, floor(v_los * 24 * (0.4 + 0.5 * r[8])))
      when r[7] < 0.3 then 6 + floor(r[8] * 30) else 0 end;
    v_outcome := case when v_dis is null then null
      when (v_cardiac and r[9] < 0.025) or (not v_cardiac and r[9] < v_apache / 115.0) then 'death'
      when r[10] < 0.05 then 'transfer_hospital' else 'transfer_ward' end;
    v_transfer := case when v_outcome is distinct from 'transfer_ward' then null
      when v_cardiac then case when r[11] < 0.7 then 'cardiac_surgery_ward' else 'cardiology' end
      when v_reason = 'postop' then case when r[11] < 0.75 then 'surgical' else 'orthopaedic' end
      when v_reason = 'respiratory' then case when r[11] < 0.6 then 'pulmonary' else 'internal' end
      when v_reason = 'neuro' then 'neurology' when v_reason = 'cardiac' then 'cardiology'
      when v_reason = 'trauma' then 'orthopaedic' else 'internal' end;
    v_female := r[21] >= 0.62;
    v_rows := v_rows || jsonb_build_object(
      'id', gen_random_uuid(), 'status', 'complete',
      'admission_date', v_adm, 'category', case when v_cardiac then 'cardiac' else 'general' end,
      'age', v_age, 'sex', case when v_female then 'female' else 'male' end, 'admission_reason', v_reason,
      'requisition', r[18] < 0.07, 'readmission_48h', r[19] < 0.03,
      'apache_score', v_apache, 'apache_postop', v_postop,
      'euroscore', case when v_cardiac then round((0.8 + r[20] * r[20] * 11)::numeric, 2) end,
      'ventilator_hours', v_vent,
      'pressure_ulcer', (v_los >= 7 and r[12] < 0.15) or r[12] < 0.01,
      'vap', v_vent > 96 and r[13] < 0.12,
      'air_mattress', v_los >= 3 and r[14] < 0.8,
      'daily_cleaning', r[15] < 0.96, 'line_care', r[16] < 0.93,
      'cultures', (not v_cardiac and r[17] < 0.7) or r[17] < 0.2,
      'discharge_date', v_dis, 'outcome', v_outcome, 'transfer_department', v_transfer,
      '_case', 'ΜΕΘ-' || to_char(v_adm, 'YY') || '-' || lpad((n + 1 - i)::text, 4, '0'),
      '_name', private.demo_register_name(i, 1100, v_female));
  end loop;
  return private.demo_register_insert(p_register_id, p_actor, v_rows);
end;
$function$;
revoke all on function private.demo_seed_register_icu(uuid, uuid, date) from public, anon, authenticated;

-- ΜΕΝΝ: 66 νεογνά σε ~6 μήνες, πρόωρα με αναπνευστήρα, CPAP, καθετήρες και TPN.
create or replace function private.demo_seed_register_nicu(p_register_id uuid, p_actor uuid, d0 date)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  n constant integer := 66;
  v_rows jsonb := '[]'::jsonb;
  i integer;
  v_adm date; v_birth date; v_dis date; v_reason text; v_origin text; v_gest integer; v_weight integer; v_preterm boolean;
  v_apgar1 integer; v_vent integer; v_cpap integer; v_umb text; v_umb_days integer; v_picc integer; v_central integer;
  v_los integer; v_outcome text; v_ptype text; v_female boolean;
  r double precision[];
begin
  for i in 1..n loop
    r := array(select private.demo_register_rand(i, 2000 + k) from generate_series(1, 32) k);
    v_adm := d0 - (floor((i - 1) * 182.0 / n) + floor(r[1] * 3))::integer;
    v_reason := case when r[2] < 0.30 then 'prematurity' when r[2] < 0.55 then 'respiratory' when r[2] < 0.70 then 'jaundice'
      when r[2] < 0.80 then 'infection' when r[2] < 0.88 then 'low_weight' when r[2] < 0.95 then 'observation'
      when r[2] < 0.98 then 'congenital' else 'other' end;
    v_gest := case when v_reason = 'prematurity' then 196 + floor(r[3] * 60)
      when v_reason = 'low_weight' then 245 + floor(r[3] * 21)
      when v_reason = 'respiratory' and r[4] < 0.33 then 231 + floor(r[3] * 28)
      else 259 + floor(r[3] * 32) end;
    v_preterm := v_gest < 259;
    -- Γεννημένα εδώ (Αίθουσα Τοκετών / Μαιευτική) ή από το σπίτι και άλλο νοσοκομείο.
    if v_preterm or r[5] < 0.75 then
      v_origin := case when v_reason = 'jaundice' or r[6] >= 0.75 then 'maternity' else 'delivery_room' end;
      v_birth := case when v_origin = 'maternity' then v_adm - (1 + floor(r[7] * 3))::integer else v_adm end;
    else
      v_origin := case when r[6] < 0.6 then 'home' else 'other_hospital' end;
      v_birth := v_adm - (3 + floor(r[7] * 18))::integer;
    end if;
    v_weight := least(4800, greatest(600, (3400 - (280 - v_gest) * 27 + (r[8] - 0.5) * 500)::integer));
    if v_reason = 'low_weight' then v_weight := least(v_weight, 2300); end if;
    v_apgar1 := case when v_gest < 224 then 4 + floor(r[9] * 4) else 7 + floor(r[9] * 3) end;
    v_vent := case when v_gest < 224 and r[10] < 0.6 then 1 + floor(r[11] * 10)
      when v_reason = 'respiratory' and r[10] < 0.2 then 1 + floor(r[11] * 3) else 0 end;
    v_cpap := case when (v_gest < 245 or v_reason = 'respiratory') and r[12] < 0.8 then 1 + floor(r[13] * 8) else 0 end;
    v_umb := case when v_gest < 224 then case when r[14] < 0.5 then 'venous' else 'both' end
      when v_gest < 245 and r[14] < 0.3 then 'venous' else 'none' end;
    v_umb_days := case when v_umb = 'none' then 0 else 3 + floor(r[15] * 5) end;
    v_picc := case when v_gest < 210 then 8 + floor(r[16] * 14) else 0 end;
    v_central := v_umb_days + v_picc;
    v_los := case when v_preterm then 7 + floor((259 - v_gest) * 0.75 + r[17] * 6) else 2 + floor(r[17] * 6) end;
    v_dis := case when v_adm + v_los <= d0 then v_adm + v_los end;
    v_outcome := case when v_dis is null then null
      when v_gest < 210 and r[18] < 0.12 then 'death'
      when r[18] < 0.04 then 'transfer_hospital' when r[18] < 0.08 then 'transfer_ward' else 'home' end;
    v_ptype := case when r[19] < 0.84 then 'single' when r[19] < 0.98 then 'twin' else 'multiple' end;
    v_female := r[20] < 0.48;
    v_rows := v_rows || jsonb_build_object(
      'id', gen_random_uuid(), 'status', 'complete',
      'admission_date', v_adm, 'birth_date', v_birth,
      'readmission', v_origin = 'home' and r[21] < 0.35,
      'admission_reason', v_reason, 'admission_origin', v_origin,
      'gestation', v_gest, 'pregnancy_type', v_ptype,
      'delivery', case when r[22] < 0.55 or v_ptype <> 'single' then 'cs' else 'vaginal' end,
      'ivf', case when v_ptype <> 'single' then r[23] < 0.6 else r[23] < 0.12 end,
      'prom_24h', case when v_reason = 'infection' then r[24] < 0.4 else r[24] < 0.06 end,
      'birth_weight', v_weight, 'apgar_1', v_apgar1, 'apgar_5', least(10, v_apgar1 + 1 + floor(r[25] * 2)::integer),
      'resuscitation', case when v_gest < 224 then case when r[26] < 0.5 then 'bag_mask' else 'intubation' end
        when v_reason = 'respiratory' then case when r[26] < 0.6 then 'oxygen' else 'bag_mask' end
        when r[26] < 0.85 then 'none' else 'oxygen' end,
      'congenital_anomalies', v_reason = 'congenital' or r[27] < 0.02,
      'ventilator_days', v_vent, 'hfov', case when v_vent > 0 then v_vent >= 6 and r[28] < 0.35 end,
      'cpap_days', v_cpap,
      'oxygen_days', case when v_vent + v_cpap > 0 then v_vent + v_cpap + floor(r[29] * 5)::integer when r[29] < 0.1 then 1 else 0 end,
      'oxygen_after_36w', v_gest < 210 and v_vent >= 5,
      'umbilical_catheter', v_umb, 'central_line_days', v_central,
      'arterial_line_days', case when v_umb = 'both' then 2 + floor(r[30] * 5)::integer else 0 end,
      'tpn_days', case when v_gest < 238 then 4 + floor(r[30] * 12)::integer else 0 end,
      'picc_days', v_picc,
      'nasogastric', v_gest < 245 or r[31] < 0.1,
      'bottle_feeding', r[31] >= 0.75,
      'breast_milk', case when v_dis is null then null when r[32] < 0.45 then 'exclusive' when r[32] < 0.85 then 'mixed' else 'none' end,
      'early_infection', v_reason = 'infection' and r[24] < 0.35,
      'late_infection', v_central >= 10 and r[11] < 0.18,
      'discharge_date', v_dis,
      'discharge_weight', case when v_dis is not null and v_outcome <> 'death' then case when v_preterm then v_weight + v_los * 18 else v_weight - 80 + v_los * 10 end end,
      'outcome', v_outcome,
      '_case', 'ΜΕΝΝ-' || to_char(v_adm, 'YY') || '-' || lpad((n + 1 - i)::text, 4, '0'),
      '_name', 'Νεογνό ' || split_part(private.demo_register_name(i, 2100, true), ' ', 1));
  end loop;
  return private.demo_register_insert(p_register_id, p_actor, v_rows);
end;
$function$;
revoke all on function private.demo_seed_register_nicu(uuid, uuid, date) from public, anon, authenticated;

-- Παιδιατρική: 132 νοσηλείες σε ~6 μήνες.
create or replace function private.demo_seed_register_paediatrics(p_register_id uuid, p_actor uuid, d0 date)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  n constant integer := 132;
  v_rows jsonb := '[]'::jsonb;
  i integer;
  v_adm date; v_dis date; v_group text; v_age_days integer; v_reason text; v_los integer; v_iv boolean; v_line integer; v_outcome text; v_female boolean;
  r double precision[];
begin
  for i in 1..n loop
    r := array(select private.demo_register_rand(i, 3000 + k) from generate_series(1, 20) k);
    v_adm := d0 - (floor((i - 1) * 182.0 / n) + floor(r[1] * 2))::integer;
    v_group := case when r[2] < 0.2 then 'infant' when r[2] < 0.5 then 'toddler' when r[2] < 0.82 then 'child' else 'adolescent' end;
    v_age_days := case v_group when 'infant' then 30 + floor(r[3] * 330) when 'toddler' then 366 + floor(r[3] * 1450)
      when 'child' then 1830 + floor(r[3] * 2550) else 4390 + floor(r[3] * 1640) end;
    v_reason := case when r[4] < 0.30 then 'respiratory' when r[4] < 0.50 then 'gastro' when r[4] < 0.62 then 'fever'
      when r[4] < 0.70 then 'uti' when r[4] < 0.76 then 'seizure' when r[4] < 0.85 then 'injury' when r[4] < 0.94 then 'surgical' else 'other' end;
    v_los := case when v_reason = 'surgical' then 1 + floor(r[5] * 3) else 1 + floor(r[5] * r[5] * 6) end;
    v_dis := case when v_adm + v_los <= d0 then v_adm + v_los end;
    v_iv := case v_reason when 'uti' then r[6] < 0.8 when 'fever' then r[6] < 0.6 when 'surgical' then r[6] < 0.5 when 'respiratory' then r[6] < 0.35 else r[6] < 0.1 end;
    v_line := case when r[7] < 0.8 then greatest(1, v_los - floor(r[8] * 2)::integer) else 0 end;
    v_outcome := case when v_dis is null then null when r[9] < 0.025 then 'picu' when r[9] < 0.05 then 'transfer_hospital'
      when r[9] < 0.065 then 'against_advice' else 'home' end;
    v_female := r[10] < 0.47;
    v_rows := v_rows || jsonb_build_object(
      'id', gen_random_uuid(), 'status', 'complete',
      'admission_date', v_adm, 'birth_date', v_adm - v_age_days, 'age_group', v_group,
      'sex', case when v_female then 'female' else 'male' end,
      'admission_reason', v_reason,
      'admission_reason_text', case when v_reason = 'other' then (array['Αλλεργική αντίδραση','Κοιλιακό άλγος προς διερεύνηση','Δηλητηρίαση από φάρμακο','Υπογλυκαιμία'])[1 + floor(r[11] * 4)::integer] end,
      'from_ed', r[12] < 0.72, 'readmission_30d', r[13] < 0.04,
      'physician', (array['Α. Παπαδημητρίου','Ε. Σταυροπούλου','Κ. Μιχαηλίδης','Μ. Αλεξανδρή'])[1 + floor(r[14] * 4)::integer],
      'isolation', v_reason in ('respiratory', 'gastro') and r[15] < 0.45,
      'iv_antibiotics', v_iv, 'iv_antibiotic_days', case when v_iv then least(greatest(v_los, 1), 2 + floor(r[16] * 5)::integer) end,
      'peripheral_line_days', v_line, 'phlebitis', case when v_line > 0 then r[17] < 0.04 end,
      'hai', r[18] < 0.015, 'fall', r[19] < 0.012,
      'discharge_date', v_dis, 'outcome', v_outcome,
      '_case', 'ΠΑΙΔ-' || to_char(v_adm, 'YY') || '-' || lpad((n + 1 - i)::text, 4, '0'),
      '_name', private.demo_register_name(i, 3100, v_female));
  end loop;
  return private.demo_register_insert(p_register_id, p_actor, v_rows);
end;
$function$;
revoke all on function private.demo_seed_register_paediatrics(uuid, uuid, date) from public, anon, authenticated;

-- Ενδοσκοπικό (φύλλο): τρία μηνιαία σύνολα πριν το daily_from και ένα φύλλο ανά
-- εργάσιμη ημέρα από εκεί ως χθες.
create or replace function private.demo_seed_register_endoscopy(p_register_id uuid, p_actor uuid, d0 date, p_daily_from date)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_rows jsonb := '[]'::jsonb;
  v_day date;
  v_month date;
  i integer := 0;
  r double precision[];
begin
  for v_month in select generate_series(p_daily_from - interval '3 months', p_daily_from - interval '1 month', interval '1 month')::date loop
    i := i + 1;
    r := array(select private.demo_register_rand(i, 4000 + k) from generate_series(1, 8) k);
    v_rows := v_rows || jsonb_build_object('period_start', v_month, 'status', 'complete',
      'gastroscopy__count', 120 + floor(r[1] * 40)::integer, 'colonoscopy__count', 95 + floor(r[2] * 35)::integer,
      'gastrostomy__count', 2 + floor(r[3] * 4)::integer, 'cystoscopy__count', 18 + floor(r[4] * 14)::integer,
      'bronchoscopy__count', 10 + floor(r[5] * 10)::integer, 'ercp__count', 5 + floor(r[6] * 6)::integer,
      'eus__count', 3 + floor(r[7] * 5)::integer, 'ebus__count', 1 + floor(r[8] * 3)::integer);
  end loop;
  for v_day in select generate_series(p_daily_from, d0 - 1, interval '1 day')::date loop
    continue when extract(isodow from v_day) > 5;
    i := i + 1;
    r := array(select private.demo_register_rand(i, 4000 + k) from generate_series(1, 8) k);
    v_rows := v_rows || jsonb_build_object('period_start', v_day, 'status', 'complete',
      'gastroscopy__count', 4 + floor(r[1] * 6)::integer, 'colonoscopy__count', 3 + floor(r[2] * 5)::integer,
      'gastrostomy__count', case when r[3] < 0.12 then 1 else 0 end, 'cystoscopy__count', floor(r[4] * 3)::integer,
      'bronchoscopy__count', floor(r[5] * 2.2)::integer, 'ercp__count', case when r[6] < 0.3 then 1 else 0 end,
      'eus__count', case when r[7] < 0.2 then 1 else 0 end, 'ebus__count', case when r[8] < 0.08 then 1 else 0 end);
  end loop;
  return private.demo_register_insert(p_register_id, p_actor, v_rows);
end;
$function$;
revoke all on function private.demo_seed_register_endoscopy(uuid, uuid, date, date) from public, anon, authenticated;


-- Μαιευτική: κάθε ημέρα από 0 ως 2 τοκετοί (~1,3), από τρεις μήνες πριν το
-- daily_from ως χθες. Η Αίθουσα Τοκετών μετρά τους ίδιους τοκετούς.
create or replace function private.demo_seed_register_obstetrics(p_register_id uuid, p_actor uuid, d0 date, p_from date)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_rows jsonb := '[]'::jsonb;
  v_day date;
  v_births integer;
  v_cs boolean;
  i integer := 0;
  b integer;
  r double precision[];
begin
  for v_day in select generate_series(p_from, d0 - 1, interval '1 day')::date loop
    v_births := floor(private.demo_register_rand((v_day - p_from), 5000) * 2.6)::integer;
    for b in 1..v_births loop
      i := i + 1;
      r := array(select private.demo_register_rand(i, 5100 + k) from generate_series(1, 8) k);
      v_cs := r[1] < 0.52;
      v_rows := v_rows || jsonb_build_object(
        'id', gen_random_uuid(), 'status', 'complete', 'date', v_day,
        'delivery', case when v_cs then 'cs' else 'vaginal' end,
        'breastfeeding', case when r[2] < (case when v_cs then 0.52 else 0.64 end) then 'exclusive' when r[2] < 0.91 then 'mixed' else 'weaning' end,
        'antenatal', case when r[3] < 0.48 then 'attended' when r[3] < 0.68 then 'aware_not_attended' when r[3] < 0.85 then 'not_aware' else 'no' end,
        'breast_pump', r[4] < 0.35,
        'physician', (array['rallis_g', 'mavridou_e', 'kostopoulos_d', 'petridou_s'])[1 + floor(r[5] * 4)::integer],
        'notes', case when r[6] < 0.04 then 'Ζήτησε συμβουλευτική θηλασμού μετά την έξοδο.' end,
        '_case', 'ΜΑΙ-' || to_char(v_day, 'YY') || '-' || lpad(i::text, 4, '0'),
        '_name', private.demo_register_name(i, 5200, true));
    end loop;
  end loop;
  return private.demo_register_insert(p_register_id, p_actor, v_rows);
end;
$function$;
revoke all on function private.demo_seed_register_obstetrics(uuid, uuid, date, date) from public, anon, authenticated;

-- Αίθουσα Τοκετών (φύλλο): μηνιαία σύνολα πριν το daily_from, ένα φύλλο ανά
-- ημέρα από εκεί ως χθες. Φυσιολογικοί και καισαρικές είναι οι τοκετοί του
-- Μητρώου λεχωίδων (p_obstetrics_register) της ίδιας ημέρας ή του ίδιου μήνα.
create or replace function private.demo_seed_register_deliveryroom(p_register_id uuid, p_actor uuid, d0 date, p_from date, p_daily_from date, p_obstetrics_register uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_rows jsonb := '[]'::jsonb;
  v_table text;
  v_counts jsonb := '{}'::jsonb;
  v_day date;
  v_month date;
  v_vag integer;
  v_cs integer;
  i integer := 0;
  r double precision[];
begin
  select table_name into v_table from public.department_registers where id = p_obstetrics_register;
  if v_table is not null then
    execute format('select coalesce(jsonb_object_agg(d::text, jsonb_build_object(''v'', v, ''c'', c)), ''{}'') from (select date as d, count(*) filter (where delivery = ''vaginal'') as v, count(*) filter (where delivery = ''cs'') as c from public.%I group by date) x', v_table)
      into v_counts;
  end if;
  -- Μηνιαία σύνολα: από τον πρώτο μήνα του Μητρώου λεχωίδων ως πριν το daily_from.
  for v_month in select generate_series(date_trunc('month', p_from)::date, p_daily_from - interval '1 month', interval '1 month')::date loop
    i := i + 1;
    r := array(select private.demo_register_rand(i, 6000 + k) from generate_series(1, 10) k);
    select coalesce(sum((e.value ->> 'v')::integer), 0), coalesce(sum((e.value ->> 'c')::integer), 0) into v_vag, v_cs
    from jsonb_each(v_counts) e where e.key::date >= v_month and e.key::date < (v_month + interval '1 month')::date;
    if v_vag + v_cs = 0 then v_vag := 16 + floor(r[9] * 8)::integer; v_cs := 20 + floor(r[10] * 8)::integer; end if;
    v_rows := v_rows || jsonb_build_object('period_start', v_month, 'status', 'complete',
      'vaginal__count', v_vag, 'cs__count', v_cs,
      'vbac__count', least(v_vag, floor(r[1] * 3)::integer), 'multiple_vaginal__count', floor(r[2] * 1.5)::integer,
      'multiple_cs__count', 1 + floor(r[3] * 2)::integer, 'born_before_arrival__count', floor(r[4] * 1.4)::integer,
      'hysteroscopy__count', 12 + floor(r[5] * 10)::integer, 'septic__count', 3 + floor(r[6] * 5)::integer,
      'pregnancy_monitoring__count', 45 + floor(r[7] * 30)::integer, 'cerclage__count', floor(r[8] * 2.5)::integer);
  end loop;
  for v_day in select generate_series(p_daily_from, d0 - 1, interval '1 day')::date loop
    i := i + 1;
    r := array(select private.demo_register_rand(i, 6000 + k) from generate_series(1, 10) k);
    v_vag := coalesce((v_counts -> v_day::text ->> 'v')::integer, case when v_table is null then floor(r[9] * 1.6)::integer else 0 end);
    v_cs := coalesce((v_counts -> v_day::text ->> 'c')::integer, case when v_table is null then floor(r[10] * 1.8)::integer else 0 end);
    v_rows := v_rows || jsonb_build_object('period_start', v_day, 'status', 'complete',
      'vaginal__count', v_vag, 'cs__count', v_cs,
      'vbac__count', case when v_vag > 0 and r[1] < 0.06 then 1 else 0 end,
      'multiple_vaginal__count', case when v_vag > 0 and r[2] < 0.02 then 1 else 0 end,
      'multiple_cs__count', case when v_cs > 0 and r[3] < 0.05 then 1 else 0 end,
      'born_before_arrival__count', case when r[4] < 0.02 then 1 else 0 end,
      'hysteroscopy__count', case when extract(isodow from v_day) <= 5 then floor(r[5] * 2.2)::integer else 0 end,
      'septic__count', case when r[6] < 0.15 then 1 else 0 end,
      'pregnancy_monitoring__count', 1 + floor(r[7] * 3)::integer,
      'cerclage__count', case when r[8] < 0.03 then 1 else 0 end);
  end loop;
  return private.demo_register_insert(p_register_id, p_actor, v_rows);
end;
$function$;
revoke all on function private.demo_seed_register_deliveryroom(uuid, uuid, date, date, date, uuid) from public, anon, authenticated;

-- ΤΕΠ (φύλλο ανά βάρδια): τρία μηνιαία σύνολα πριν το daily_from και ένα φύλλο
-- κάθε ημέρα (και Σαββατοκύριακα) από εκεί ως χθες, κάθε κατηγορία ανά βάρδια.
create or replace function private.demo_seed_register_emergency(p_register_id uuid, p_actor uuid, d0 date, p_daily_from date)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_rows jsonb := '[]'::jsonb;
  v_case_rows constant text[] := array['urgent', 'surgical', 'assessments', 'checkup', 'preop', 'septic'];
  v_base constant numeric[] := array[24, 9, 6, 7, 4, 2];
  v_shifts constant text[] := array['morning', 'afternoon', 'night'];
  v_share constant numeric[] := array[0.45, 0.35, 0.20];
  v_period date;
  v_monthly boolean;
  v_mult numeric;
  v_obj jsonb;
  v_val integer;
  v_shift_total integer;
  i integer := 0;
  s integer;
  j integer;
begin
  for v_period, v_monthly in
    select m::date, true from generate_series(p_daily_from - interval '3 months', p_daily_from - interval '1 month', interval '1 month') m
    union all
    select d::date, false from generate_series(p_daily_from, d0 - 1, interval '1 day') d
    order by 1
  loop
    i := i + 1;
    v_mult := case when v_monthly then extract(day from (v_period + interval '1 month' - interval '1 day'))::numeric * 0.95
      when extract(isodow from v_period) > 5 then 0.85 else 1 end;
    v_obj := jsonb_build_object('period_start', v_period, 'status', 'complete');
    for s in 1..3 loop
      v_shift_total := 0;
      for j in 1..6 loop
        -- Ο έλεγχος (check up) και ο προεγχειρητικός γίνονται σχεδόν μόνο τη μέρα.
        v_val := floor(v_base[j] * v_share[s] * v_mult * (case when j in (4, 5) and s = 3 then 0.1 else 1 end)
          * (0.7 + 0.6 * private.demo_register_rand(i, 7000 + s * 20 + j)))::integer;
        v_obj := v_obj || jsonb_build_object(v_case_rows[j] || '__' || v_shifts[s], v_val);
        v_shift_total := v_shift_total + v_val;
      end loop;
      v_obj := v_obj || jsonb_build_object(
        'admissions__' || v_shifts[s], round(v_shift_total * 0.12 * (0.6 + 0.8 * private.demo_register_rand(i, 7100 + s)))::integer,
        'dressings__' || v_shifts[s], floor(5 * v_share[s] * v_mult * (0.6 + 0.8 * private.demo_register_rand(i, 7110 + s)))::integer,
        'left_without_seen__' || v_shifts[s], floor(v_shift_total * 0.032 * private.demo_register_rand(i, 7120 + s))::integer,
        'revisit_72h__' || v_shifts[s], floor(v_shift_total * 0.085 * private.demo_register_rand(i, 7130 + s))::integer,
        'transfers__' || v_shifts[s], floor(v_shift_total * 0.025 * private.demo_register_rand(i, 7140 + s))::integer);
    end loop;
    v_rows := v_rows || v_obj;
  end loop;
  return private.demo_register_insert(p_register_id, p_actor, v_rows);
end;
$function$;
revoke all on function private.demo_seed_register_emergency(uuid, uuid, date, date) from public, anon, authenticated;

-- Τα επτά μητρώα του Demo και τα τμήματα που λείπουν (Μαιευτική, Αίθουσα
-- Τοκετών, ΤΕΠ, Ενδοσκοπικό, όπως στο demo_seed_departments_patients: κωδικός,
-- όνομα, τύπος, ενεργό· χωρίς κλινοημέρες). Παραλείπει ό,τι υπάρχει ήδη (ίδιο
-- πρότυπο ή κωδικό) ή όταν λείπει το τμήμα του.
create or replace function private.demo_seed_registers(p_organization_id uuid, p_actor uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
  d0 date := (now() at time zone 'Europe/Athens')::date;
  v_daily_from date := (date_trunc('month', (now() at time zone 'Europe/Athens')::date) - interval '2 months')::date;
  v_from date;
  v_dept uuid;
  v_id uuid;
  v_spec record;
begin
  if not exists (select 1 from public.organizations o where o.id = v_org and o.is_demo) then
    raise exception 'Only Demo organizations can be filled with Demo data' using errcode = '42501';
  end if;
  v_from := (v_daily_from - interval '3 months')::date;

  insert into public.departments(organization_id, code, name, department_type, is_active)
  select v_org, d.code, d.name, d.kind, true
  from (values ('ΜΑΙ', 'Μαιευτική Κλινική', 'general'), ('ΑΤ', 'Αίθουσα Τοκετών', 'general'),
    ('ΤΕΠ', 'Τμήμα Επειγόντων Περιστατικών', 'general'), ('ΕΝΔ', 'Ενδοσκοπικό Τμήμα', 'general')) d(code, name, kind)
  where not exists (select 1 from public.departments x where x.organization_id = v_org and x.code = d.code)
  on conflict (organization_id, name) do nothing;

  for v_spec in select * from (values
    ('REG-001', 'icu', 'ΜΕΘ'), ('REG-002', 'nicu', 'ΜΕΝΝ'), ('REG-003', 'paediatrics', 'ΠΑΙΔ'), ('REG-004', 'endoscopy', 'ΕΝΔ'),
    ('REG-005', 'obstetrics', 'ΜΑΙ'), ('REG-006', 'deliveryRoom', 'ΑΤ'), ('REG-007', 'emergency', 'ΤΕΠ')
  ) s(code, template_key, department_code) loop
    continue when exists (select 1 from public.department_registers r where r.organization_id = v_org and (r.template_key = v_spec.template_key or r.code = v_spec.code));
    select d.id into v_dept from public.departments d where d.organization_id = v_org and d.code = v_spec.department_code limit 1;
    continue when v_dept is null;
    v_id := private.demo_register_create(v_org, v_dept, v_spec.code, v_spec.template_key, p_actor,
      case when v_spec.template_key in ('endoscopy', 'deliveryRoom', 'emergency') then v_daily_from end);
    case v_spec.template_key
      when 'icu' then perform private.demo_seed_register_icu(v_id, p_actor, d0);
      when 'nicu' then perform private.demo_seed_register_nicu(v_id, p_actor, d0);
      when 'paediatrics' then perform private.demo_seed_register_paediatrics(v_id, p_actor, d0);
      when 'endoscopy' then perform private.demo_seed_register_endoscopy(v_id, p_actor, d0, v_daily_from);
      when 'obstetrics' then perform private.demo_seed_register_obstetrics(v_id, p_actor, d0, v_from);
      when 'deliveryRoom' then perform private.demo_seed_register_deliveryroom(v_id, p_actor, d0, v_from, v_daily_from,
        (select r.id from public.department_registers r where r.organization_id = v_org and r.template_key = 'obstetrics' limit 1));
      when 'emergency' then perform private.demo_seed_register_emergency(v_id, p_actor, d0, v_daily_from);
    end case;
  end loop;
end;
$function$;
revoke all on function private.demo_seed_registers(uuid, uuid) from public, anon, authenticated;

-- Άδειοι πίνακες μητρώων που δεν ανήκουν πια σε μητρώο (π.χ. μητρώο Demo που
-- φτιάχτηκε από την οθόνη και σβήστηκε στην επαναφορά). Μόνο ανάγνωση· το
-- καθάρισμα (drop) το τρέχει ο ιδιοκτήτης στο SQL Editor.
create or replace function private.register_orphan_tables()
returns setof text
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_name text;
  v_rows boolean;
begin
  for v_name in
    select c.relname from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    join pg_catalog.pg_attribute a on a.attrelid = c.oid and a.attname = 'register_id' and not a.attisdropped
    where n.nspname = 'public' and c.relkind = 'r' and c.relname like 'register\_%'
      and not exists (select 1 from public.department_registers r where r.table_name = c.relname)
    order by c.relname
  loop
    execute format('select exists (select 1 from public.%I)', v_name) into v_rows;
    if not v_rows then return next v_name; end if;
  end loop;
end;
$function$;
revoke all on function private.register_orphan_tables() from public, anon, authenticated;

-- ===== 20261231370000_demo_seed_interviews.sql =====
-- Συνεντεύξεις σε κάθε Demo νοσοκομείο: οι ίδιες αιτήσεις με το demo του browser
-- (src/features/interviews/interviewsDemoData.js) με ημερομηνίες από σήμερα — μία σε κάθε
-- βήμα (νέα, από tablet με υπογραφή, έλεγχος, προγραμματισμένες συνεντεύξεις τις επόμενες
-- δύο εβδομάδες, αξιολογημένες με βαθμολογίες, πρόταση, προσλήψεις, απορρίψεις, αποχώρηση),
-- γλώσσες και προηγούμενοι εργοδότες, οι διευθύνσεις με τις κατηγορίες και τα τμήματά τους
-- και η ρύθμιση του tablet. Τα ονόματα είναι επινοημένα, τα email example.org.
-- demo_seed_data την καλεί μετά τους εργαζομένους (οι προσλήψεις δείχνουν σε εργαζόμενο του Demo).

-- The professional category of an employee's profession (for the hires).
create or replace function private.demo_seed_interviews_category(p_profession text)
returns text language sql immutable set search_path = ''
as $function$
  select case when p_profession is null or p_profession like 'Νοσηλ%' or p_profession like 'Μαί%' then 'nursing'
    when p_profession like 'Ιατρ%' then 'medical'
    when p_profession like '%Τεχνολόγ%' or p_profession like '%Φυσικοθεραπ%' then 'paramedical'
    when p_profession like '%Διοικητ%' then 'administrative' else 'other' end;
$function$;
revoke all on function private.demo_seed_interviews_category(text) from public, anon, authenticated;

-- One application with its first interview (when p_int_status is given). Returns the application id.
create or replace function private.demo_seed_interviews_candidate(
  p_org uuid, p_actor uuid, p_code text, p_applied date, p_name text, p_gender text, p_position text, p_category text,
  p_status text, p_fields jsonb, p_int_at timestamptz, p_int_status text, p_panel jsonb, p_scores jsonb, p_outcome text, p_int_fields jsonb)
returns uuid language plpgsql security definer set search_path = ''
as $function$
declare
  v_id uuid;
  v_rating numeric;
begin
  insert into public.hr_candidates (organization_id, code, full_name, gender, birth_date, nationality, citizenship, area, phone_mobile, email,
    requested_position, professional_category, employment_type, military_service, practice_licence, smoker, marital_status, children,
    education_level, education, it_skills, why_us, applied_on, consent_given, consent_at, consent_text, status, decision, decision_on,
    decision_by_name, decision_notes, employee_id, source, notes, created_by, updated_by, created_at, updated_at)
  values (p_org, p_code, p_name, p_gender, (p_fields ->> 'birth')::date, 'Ελληνική', 'Ελληνική', p_fields ->> 'area', p_fields ->> 'phone', p_fields ->> 'email',
    p_position, p_category, coalesce(p_fields ->> 'employment', 'full_time'), p_fields ->> 'military', (p_fields ->> 'licence')::boolean, false, p_fields ->> 'marital', (p_fields ->> 'children')::integer,
    p_fields ->> 'level', coalesce(p_fields -> 'education', '[]'::jsonb), p_fields ->> 'it', p_fields ->> 'why', p_applied, true,
    (p_applied + time '10:00') at time zone 'Europe/Athens', 'Έντυπο συναίνεσης GDPR', p_status, p_fields ->> 'decision', (p_fields ->> 'decisionOn')::date,
    p_fields ->> 'decisionBy', p_fields ->> 'decisionNotes', (p_fields ->> 'employee')::uuid, 'demo', p_fields ->> 'notes', p_actor, p_actor,
    (p_applied + time '10:00') at time zone 'Europe/Athens', (p_applied + time '10:00') at time zone 'Europe/Athens')
  returning id into v_id;
  if p_int_status is not null then
    select round(avg(value::numeric), 1) into v_rating from jsonb_each_text(coalesce(p_scores, '{}'::jsonb));
    insert into public.hr_interviews (organization_id, candidate_id, scheduled_at, location, status, interviewers, scores, overall_rating, outcome,
      recommendation, strengths, weaknesses, salary_expectation, offered_salary, benefits, available_from, evaluated_at, evaluated_by_name, notes, source, created_by, updated_by)
    values (p_org, v_id, p_int_at, coalesce(p_int_fields ->> 'location', 'Γραφείο Προσωπικού'), p_int_status, coalesce(p_panel, '[]'::jsonb), coalesce(p_scores, '{}'::jsonb), v_rating, p_outcome,
      p_int_fields ->> 'recommendation', p_int_fields ->> 'strengths', p_int_fields ->> 'weaknesses', (p_int_fields ->> 'expects')::numeric, (p_int_fields ->> 'offered')::numeric,
      p_int_fields ->> 'benefits', (p_int_fields ->> 'available')::date, case when p_int_status = 'completed' then p_int_at + interval '1 hour' end,
      case when p_int_status = 'completed' then 'Ελένη Γεωργίου' end, p_int_fields ->> 'notes', 'demo', p_actor, p_actor);
  end if;
  return v_id;
end;
$function$;
revoke all on function private.demo_seed_interviews_candidate(uuid, uuid, text, date, text, text, text, text, text, jsonb, timestamptz, text, jsonb, jsonb, text, jsonb) from public, anon, authenticated;

-- The divisions of the hospital with their professional categories, departments and directors, and the tablet setting.
create or replace function private.demo_seed_interviews_divisions(p_organization_id uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
  v_nursing uuid;
  v_medical uuid;
  v_operations uuid;
begin
  insert into public.hr_divisions (organization_id, name) values (v_org, 'Νοσηλευτική Υπηρεσία') returning id into v_nursing;
  insert into public.hr_divisions (organization_id, name) values (v_org, 'Ιατρική Υπηρεσία') returning id into v_medical;
  insert into public.hr_divisions (organization_id, name) values (v_org, 'Διεύθυνση Λειτουργιών') returning id into v_operations;
  insert into public.hr_division_categories (organization_id, division_id, professional_category)
  values (v_org, v_nursing, 'nursing'), (v_org, v_medical, 'medical'), (v_org, v_medical, 'paramedical'),
    (v_org, v_operations, 'administrative'), (v_org, v_operations, 'technical'), (v_org, v_operations, 'support');
  -- Nursing covers every ward and the medical service the clinics; operations has no ward of its own.
  insert into public.hr_division_departments (organization_id, division_id, department_id)
  select v_org, v_nursing, d.id from public.departments d where d.organization_id = v_org;
  insert into public.hr_division_departments (organization_id, division_id, department_id)
  select v_org, v_medical, d.id from public.departments d where d.organization_id = v_org and d.name like '%Κλινική%';
  -- The Demo's active «Division Director» users, if any, direct the nursing service.
  insert into public.hr_division_members (organization_id, division_id, user_id)
  select v_org, v_nursing, om.user_id from public.organization_members om
  where om.organization_id = v_org and om.status = 'active' and om.role::text = 'division_director'
  on conflict (division_id, user_id) do nothing;
  insert into public.hr_interview_settings (organization_id, tablet_attachments) values (v_org, false)
  on conflict (organization_id) do nothing;
end;
$function$;
revoke all on function private.demo_seed_interviews_divisions(uuid) from public, anon, authenticated;

create or replace function private.demo_seed_interviews(p_organization_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
  d0 date := current_date;
  v_hr jsonb := jsonb_build_object('employeeId', '', 'name', 'Ελένη Γεωργίου', 'role', 'hr');
  v_nurse jsonb := jsonb_build_object('employeeId', '', 'name', 'Μαρία Παπαδοπούλου', 'role', 'evaluator');
  v_director jsonb := jsonb_build_object('employeeId', '', 'name', 'Νίκος Αλεξίου', 'role', 'evaluator');
  v_chef jsonb := jsonb_build_object('employeeId', '', 'name', 'Γιώργος Νικολάου', 'role', 'evaluator');
  v_hired uuid[];
  v_names text[];
  v_titles text[];
  v_id uuid;
  v_actor uuid := p_actor;
begin
  if not exists (select 1 from public.organizations o where o.id = v_org and o.is_demo) then
    raise exception 'Only Demo organizations get the Demo interviews' using errcode = '42501';
  end if;
  -- Already filled (the reset empties the Demo first): nothing to add.
  if exists (select 1 from public.hr_candidates c where c.organization_id = v_org) then return; end if;
  if v_actor is not null and not exists (select 1 from auth.users u where u.id = v_actor) then v_actor := null; end if;

  perform private.demo_seed_interviews_divisions(v_org);

  -- Two hires are employees of the Demo (the newest without a login), nurses first.
  select array_agg(x.id order by x.rk), array_agg(x.name order by x.rk), array_agg(x.title order by x.rk)
    into v_hired, v_names, v_titles
  from (select e.id, btrim(coalesce(e.last_name, '') || ' ' || coalesce(e.first_name, '')) as name, coalesce(e.profession_name, 'Νοσηλευτής / Νοσηλεύτρια') as title,
      row_number() over (order by (coalesce(e.profession_name, '') like 'Νοσηλ%') desc, e.hire_date desc nulls last, e.id) as rk
    from public.employees e where e.organization_id = v_org and e.user_id is null) x
  where x.rk <= 2;

  -- 1. Νέα αίτηση από tablet, με τις συναινέσεις και την υπογραφή.
  v_id := private.demo_seed_interviews_candidate(v_org, v_actor, 'ΥΠ-0001', d0 - 2, 'Κωνσταντίνου Δήμητρα', 'female', 'ΤΕ Νοσηλευτική', 'nursing', 'new',
    jsonb_build_object('birth', '1996-04-12', 'area', 'Λάρισα', 'phone', '6900000101', 'email', 'd.konstantinou@example.org', 'licence', true, 'marital', 'single', 'level', 'ΤΕΙ',
      'education', jsonb_build_array(jsonb_build_object('level', 'ΤΕΙ', 'school', 'Νοσηλευτική ΤΕΙ Λάρισας', 'year', '2019', 'completed', true)),
      'it', 'Office, ηλεκτρονικός φάκελος ασθενούς', 'why', 'Κοντά στο σπίτι και καλή φήμη της κλινικής.'), null, null, null, null, null, null);
  update public.hr_candidates set source = 'tablet', consent_text = 'Υπογράφηκε στο tablet, έκδοση 2026-10', consent_future = true, consent_references = false,
    declaration_truth = true, consent_version = '2026-10', signed_at = (d0 - 2 + time '10:00') at time zone 'Europe/Athens',
    consent_texts = '{"language":"el","gdpr":"Συναινώ στην επεξεργασία των προσωπικών μου δεδομένων που περιέχει αυτή η αίτηση από το Νοσοκομείο, ως υπεύθυνο επεξεργασίας, αποκλειστικά για την αξιολόγηση της υποψηφιότητάς μου και τη διαδικασία επιλογής προσωπικού (Κανονισμός (ΕΕ) 2016/679 και ν. 4624/2019). Τα στοιχεία τα βλέπουν μόνο το Γραφείο Προσωπικού και όσοι συμμετέχουν στη συνέντευξη, δεν διαβιβάζονται σε τρίτους και διατηρούνται έως 24 μήνες από την υποβολή, εκτός αν προσληφθώ. Έχω δικαίωμα πρόσβασης, διόρθωσης, διαγραφής, περιορισμού και φορητότητας, μπορώ να ανακαλέσω τη συναίνεσή μου οποτεδήποτε με αίτημα στο Γραφείο Προσωπικού ή στον Υπεύθυνο Προστασίας Δεδομένων και να υποβάλω καταγγελία στην Αρχή Προστασίας Δεδομένων Προσωπικού Χαρακτήρα.","future":"Συναινώ να εξεταστεί η αίτησή μου και για άλλες θέσεις που θα προκύψουν στο Νοσοκομείο μέσα στους επόμενους 24 μήνες.","references":"Συναινώ το Γραφείο Προσωπικού να επικοινωνήσει με τους προηγούμενους εργοδότες που δηλώνω, για συστάσεις σχετικά με την εργασία μου.","truth":"Δηλώνω υπεύθυνα ότι τα στοιχεία της αίτησης είναι αληθή και πλήρη. Γνωρίζω ότι ανακριβή στοιχεία μπορεί να οδηγήσουν σε απόρριψη της αίτησης ή σε λύση της συνεργασίας."}'::jsonb
  where id = v_id;
  insert into public.hr_candidate_signatures (candidate_id, organization_id, image, signed_at)
  values (v_id, v_org, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAWgAAAB4BAMAAAAtanXJAAAAGFBMVEUAAAAPIjMAAAAAAAAAAAAAAAAAAAAAAABcgH40AAAACHRSTlMA/wAAAAAAACXRGJEAAANwSURBVHja7VptkqwwCITUHIDc/5DhBrwf6oyOGvmI6+4rumpr/0xMp0MDiQIkEolEIpFIJBKJRCKRSCQSiUQi8fNAz6AKIPwg6eLj7Fvsg6QnvvTHlAZo/KjUDtIEDQT+VnggCADwk/FRnOPkyfjwkGZ4GC97SE/xzO7wQIpm+eIVWrxBjRTO8sXuw2CQUDzLF4cFIx0AIIBEs3xxCbUhbx0vLEGpS2As+YRmgKDUxTwph4KaQPy7NEJpn1ocT/XF7UNt0qu1fvcAgYTpIk1Wqev8twznAVW1uHbX23xjNLZcpNHKnwDaVAU/NoSoFSNGVAQmAjRoy2JxvVD6MdK0UYhRZ1yew5pWAvNDSivkmownE+u66e4uF4x1VGvKRgvIW+56ljoV2TWkNJonXk7CB0sm9y4Wq/f2zbFqZ9qKunbPeEx40BdpJtT+vlm7ABx53PoSnniue4dHKI49fER44I7E1GNiPY4UjGR5ui3lCUCFSmcUQ3WPtaTPc+MJiaVuND7QhgLZE/XFRaw7NufhdnTwwwCvnee7RiS2idPqnBlkN5ZsRqvrHIOjyvjxg1pra1O6m4AK+7KpJN3rgUhshcfkQ/xeBw9RGq/tbms3NwIRQFt33nJfl/clNbpLCwI0WHfebCDdSfk0+rpUdlcLwKprsyul6/swrQhRtpYW2t7hTDdmdBmJpT/xytKkkY4Mred2Lnn/Q0DqL7h0/YYf6mhvJlnv7U/oMUCli7Glm7hmS0MlIFUCs90RvHdmFXpTsyjWmKa9pQGrKheYL45wH0kCl++DX32fyFKptR0bakvR1yCGznHhWulPysdlxY3hntdD7OthX6rWQJqWBRlLS22OClB67rCrK0fXdv3jGkC1HhZKzx0S2HDdYAZ0XEW+lO4wt1U6H8pUBDisNC/l33PCW+IDlURYly8uSU/NGnrzhe1zENcbmOPwIHYKfXlg2x98HDOUc3f4hGbHqWWE0pM7nLNOwUW3fqpQTtXyzspAd38L8hrmju2Nz63fC92gSfX6KxYe8S7o2Q+zEom/hhuyx9HLo/abSdfBXcb9pOs5uVn9QV9d49CY6JOqowTHS/EU6mgYj+SN7h338rheIdLF41AdqgfTeCN1yS/NpZI2pjuvwL3eqoE0g5Fp2hD3jpAgkUgkEolEIpFI/Nf4B4XVBbMvFWi4AAAAAElFTkSuQmCC', (d0 - 2 + time '10:00') at time zone 'Europe/Athens');
  insert into public.hr_candidate_languages (organization_id, candidate_id, position, language, reading, writing, speaking, certificate, certificate_name)
  values (v_org, v_id, 0, 'en', 'good', 'good', 'fair', true, 'B2');

  -- 2. Νέα αίτηση από το Γραφείο Προσωπικού.
  v_id := private.demo_seed_interviews_candidate(v_org, v_actor, 'ΥΠ-0002', d0 - 1, 'Οικονόμου Βασίλης', 'male', 'Τεχνικός Βιοϊατρικής Τεχνολογίας', 'technical', 'new',
    jsonb_build_object('birth', '1992-07-21', 'area', 'Λάρισα', 'phone', '6900000108', 'email', 'v.oikonomou@example.org', 'military', 'done', 'marital', 'married', 'children', 1, 'level', 'ΤΕΙ',
      'education', jsonb_build_array(jsonb_build_object('level', 'ΤΕΙ', 'school', 'Ιατρικά Όργανα (παράδειγμα)', 'year', '2015', 'completed', true)), 'it', 'AutoCAD, Office'), null, null, null, null, null, null);
  insert into public.hr_candidate_employers (organization_id, candidate_id, position, employer, from_on, to_on, job_title, salary, leaving_reason)
  values (v_org, v_id, 0, 'Εταιρεία ιατρικού εξοπλισμού (παράδειγμα)', date '2016-03-01', d0 - 60, 'Τεχνικός service', 1100, 'Αναζήτηση μόνιμης θέσης');

  -- 3. Σε έλεγχο.
  v_id := private.demo_seed_interviews_candidate(v_org, v_actor, 'ΥΠ-0003', d0 - 6, 'Ιωάννου Πέτρος', 'male', 'Τραυματιοφορέας', 'support', 'screening',
    jsonb_build_object('birth', '1990-09-03', 'area', 'Τρίκαλα', 'phone', '6900000102', 'email', 'p.ioannou@example.org', 'military', 'done', 'marital', 'married', 'children', 2, 'level', 'Λύκειο'), null, null, null, null, null, null);
  insert into public.hr_candidate_employers (organization_id, candidate_id, position, employer, from_on, to_on, job_title, salary, leaving_reason)
  values (v_org, v_id, 0, 'Ιδιωτική κλινική (παράδειγμα)', date '2016-02-01', date '2024-12-31', 'Τραυματιοφορέας', 900, 'Μετακόμιση');

  -- 4–6. Προγραμματισμένες συνεντεύξεις τις επόμενες δύο εβδομάδες.
  v_id := private.demo_seed_interviews_candidate(v_org, v_actor, 'ΥΠ-0004', d0 - 9, 'Μιχαηλίδου Άννα', 'female', 'ΤΕ Νοσηλευτική', 'nursing', 'interview_scheduled',
    jsonb_build_object('birth', '1993-01-25', 'area', 'Λάρισα', 'phone', '6900000103', 'email', 'a.michailidou@example.org', 'licence', true, 'level', 'ΑΕΙ',
      'education', jsonb_build_array(jsonb_build_object('level', 'ΑΕΙ', 'school', 'Νοσηλευτική Πανεπιστημίου Θεσσαλίας', 'year', '2016', 'completed', true),
        jsonb_build_object('level', 'Μεταπτυχιακό', 'school', 'ΜΕΘ — Πανεπιστήμιο Θεσσαλίας', 'year', '2021', 'completed', true))),
    (d0 + 2 + time '11:00') at time zone 'Europe/Athens', 'scheduled', jsonb_build_array(v_nurse, v_hr), null, null, null);
  insert into public.hr_candidate_languages (organization_id, candidate_id, position, language, reading, writing, speaking, certificate, certificate_name)
  values (v_org, v_id, 0, 'en', 'fluent', 'fluent', 'good', true, 'C1'), (v_org, v_id, 1, 'de', 'basic', 'basic', 'basic', false, null);
  insert into public.hr_candidate_employers (organization_id, candidate_id, position, employer, from_on, to_on, job_title, salary, leaving_reason)
  values (v_org, v_id, 0, 'Γενικό Νοσοκομείο (παράδειγμα)', date '2017-03-01', date '2025-06-30', 'Νοσηλεύτρια ΜΕΘ', 1150, 'Λήξη σύμβασης');

  v_id := private.demo_seed_interviews_candidate(v_org, v_actor, 'ΥΠ-0005', d0 - 7, 'Χριστοφόρου Λευτέρης', 'male', 'Τεχνολόγος Εργαστηρίων', 'paramedical', 'interview_scheduled',
    jsonb_build_object('birth', '1994-05-30', 'area', 'Καρδίτσα', 'phone', '6900000109', 'email', 'l.christoforou@example.org', 'military', 'done', 'licence', true, 'level', 'ΤΕΙ',
      'education', jsonb_build_array(jsonb_build_object('level', 'ΤΕΙ', 'school', 'Ιατρικά Εργαστήρια ΤΕΙ Αθήνας', 'year', '2017', 'completed', true))),
    (d0 + 5 + time '10:00') at time zone 'Europe/Athens', 'scheduled', jsonb_build_array(v_director, v_hr), null, null, jsonb_build_object('location', 'Μικροβιολογικό Εργαστήριο'));
  insert into public.hr_candidate_languages (organization_id, candidate_id, position, language, reading, writing, speaking, certificate, certificate_name)
  values (v_org, v_id, 0, 'en', 'good', 'good', 'good', true, 'B2');

  v_id := private.demo_seed_interviews_candidate(v_org, v_actor, 'ΥΠ-0006', d0 - 12, 'Αλεξανδροπούλου Ζωή', 'female', 'Διοικητική υπάλληλος', 'administrative', 'interview_scheduled',
    jsonb_build_object('birth', '1997-10-11', 'area', 'Λάρισα', 'phone', '6900000110', 'email', 'z.alexandropoulou@example.org', 'level', 'ΑΕΙ', 'it', 'Office, ERP, μισθοδοσία',
      'education', jsonb_build_array(jsonb_build_object('level', 'ΑΕΙ', 'school', 'Λογιστική και Χρηματοοικονομική (παράδειγμα)', 'year', '2020', 'completed', true))),
    (d0 - 3 + time '12:00') at time zone 'Europe/Athens', 'cancelled', jsonb_build_array(v_hr), null, null, jsonb_build_object('notes', 'Ακυρώθηκε από την υποψήφια· ορίστηκε νέα ημερομηνία.'));
  insert into public.hr_interviews (organization_id, candidate_id, scheduled_at, location, status, interviewers, source, created_by, updated_by)
  values (v_org, v_id, (d0 + 9 + time '12:00') at time zone 'Europe/Athens', 'Γραφείο Προσωπικού', 'scheduled', jsonb_build_array(v_hr), 'demo', v_actor, v_actor);

  -- 7–8. Αξιολογημένες: επιφύλαξη, και πρόταση με δεύτερη συνέντευξη με τη Διεύθυνση.
  perform private.demo_seed_interviews_candidate(v_org, v_actor, 'ΥΠ-0007', d0 - 14, 'Σταματίου Γεώργιος', 'male', 'Μάγειρας', 'support', 'interviewed',
    jsonb_build_object('birth', '1988-06-17', 'area', 'Λάρισα', 'phone', '6900000104', 'email', 'g.stamatiou@example.org', 'military', 'done', 'level', 'ΙΕΚ Μαγειρικής', 'decision', 'reserve',
      'decisionOn', d0 - 4, 'decisionBy', 'Ελένη Γεωργίου', 'decisionNotes', 'Σε λίστα αναμονής για την επόμενη θέση στην κουζίνα.'),
    (d0 - 5 + time '10:00') at time zone 'Europe/Athens', 'completed', jsonb_build_array(v_chef, v_hr),
    '{"presentation": 4, "knowledge": 4, "experience": 5, "motivation": 3, "teamwork": 4, "availability": 3}'::jsonb, 'reserve',
    jsonb_build_object('recommendation', 'Πολύ καλός επαγγελματίας· διαθέσιμος μόνο πρωινές βάρδιες.', 'strengths', 'Εμπειρία σε μεγάλη κουζίνα, HACCP.', 'weaknesses', 'Περιορισμένη διαθεσιμότητα.', 'expects', 1200));

  v_id := private.demo_seed_interviews_candidate(v_org, v_actor, 'ΥΠ-0008', d0 - 16, 'Τσιρίγου Μαριλένα', 'female', 'Ειδικευόμενη Ιατρός Παθολογίας', 'medical', 'interviewed',
    jsonb_build_object('birth', '1995-03-08', 'area', 'Λάρισα', 'phone', '6900000111', 'email', 'm.tsirigou@example.org', 'licence', true, 'level', 'ΑΕΙ',
      'education', jsonb_build_array(jsonb_build_object('level', 'ΑΕΙ', 'school', 'Ιατρική Σχολή (παράδειγμα)', 'year', '2021', 'completed', true))),
    (d0 - 4 + time '13:00') at time zone 'Europe/Athens', 'completed', jsonb_build_array(v_director, v_hr),
    '{"presentation": 5, "knowledge": 4, "experience": 3, "motivation": 5, "teamwork": 4, "availability": 5}'::jsonb, 'recommend',
    jsonb_build_object('location', 'Γραφείο Ιατρικής Υπηρεσίας', 'recommendation', 'Προτείνεται· δεύτερη συνέντευξη με τον Διευθυντή της Παθολογικής.', 'strengths', 'Κίνητρο, επικοινωνία.', 'weaknesses', 'Λίγη κλινική εμπειρία.'));
  insert into public.hr_interviews (organization_id, candidate_id, scheduled_at, location, status, interviewers, source, created_by, updated_by)
  values (v_org, v_id, (d0 + 12 + time '09:30') at time zone 'Europe/Athens', 'Παθολογική Κλινική', 'scheduled', jsonb_build_array(v_director, v_nurse), 'demo', v_actor, v_actor);
  insert into public.hr_candidate_languages (organization_id, candidate_id, position, language, reading, writing, speaking, certificate, certificate_name)
  values (v_org, v_id, 0, 'en', 'fluent', 'fluent', 'fluent', true, 'Proficiency'), (v_org, v_id, 1, 'fr', 'fair', 'basic', 'basic', false, null);

  -- 9. Πρόταση πρόσληψης (εκκρεμεί η δημιουργία εργαζομένου).
  v_id := private.demo_seed_interviews_candidate(v_org, v_actor, 'ΥΠ-0009', d0 - 21, 'Αθανασίου Ελένη', 'female', 'ΤΕ Νοσηλευτική', 'nursing', 'offer',
    jsonb_build_object('birth', '1995-11-08', 'area', 'Λάρισα', 'phone', '6900000105', 'email', 'e.athanasiou@example.org', 'licence', true, 'level', 'ΑΕΙ', 'decision', 'hire',
      'decisionOn', d0 - 3, 'decisionBy', 'Νίκος Αλεξίου', 'decisionNotes', 'Έναρξη την 1η του επόμενου μήνα.',
      'education', jsonb_build_array(jsonb_build_object('level', 'ΑΕΙ', 'school', 'Νοσηλευτική ΕΚΠΑ', 'year', '2018', 'completed', true))),
    (d0 - 10 + time '12:00') at time zone 'Europe/Athens', 'completed', jsonb_build_array(v_nurse, v_director, v_hr),
    '{"presentation": 5, "knowledge": 4, "experience": 4, "motivation": 5, "teamwork": 5, "availability": 4}'::jsonb, 'recommend',
    jsonb_build_object('recommendation', 'Πρόταση συνεργασίας για τη Χειρουργική Κλινική.', 'strengths', 'Επικοινωνία, εμπειρία σε ΜΕΘ.', 'expects', 1250, 'offered', 1200,
      'benefits', 'Κουπόνια σίτισης', 'available', d0 + 12));
  insert into public.hr_candidate_languages (organization_id, candidate_id, position, language, reading, writing, speaking, certificate, certificate_name)
  values (v_org, v_id, 0, 'en', 'fluent', 'good', 'fluent', true, 'Proficiency');

  -- 10–11. Προσλήφθηκαν: συνδέονται με εργαζόμενο του Demo (χωρίς εργαζόμενο μένουν «Πρόταση πρόσληψης»).
  perform private.demo_seed_interviews_candidate(v_org, v_actor, 'ΥΠ-0010', d0 - 75, coalesce(nullif(v_names[1], ''), 'Ρήγα Αικατερίνη'), null, coalesce(v_titles[1], 'ΤΕ Νοσηλευτική'), private.demo_seed_interviews_category(v_titles[1]),
    case when v_hired[1] is null then 'offer' else 'hired' end,
    jsonb_build_object('area', 'Λάρισα', 'email', 'candidate10@example.org', 'licence', true, 'level', 'ΑΕΙ', 'decision', 'hire', 'decisionOn', d0 - 60, 'decisionBy', 'Νίκος Αλεξίου',
      'decisionNotes', 'Ανέλαβε υπηρεσία.', 'employee', v_hired[1]),
    (d0 - 66 + time '11:00') at time zone 'Europe/Athens', 'completed', jsonb_build_array(v_nurse, v_hr),
    '{"presentation": 5, "knowledge": 4, "experience": 4, "motivation": 5, "teamwork": 5, "availability": 4}'::jsonb, 'recommend',
    jsonb_build_object('recommendation', 'Προτείνεται ανεπιφύλακτα.', 'expects', 1150, 'offered', 1150, 'available', d0 - 45));
  perform private.demo_seed_interviews_candidate(v_org, v_actor, 'ΥΠ-0011', d0 - 120, coalesce(nullif(v_names[2], ''), 'Καλογεράκης Μανώλης'), null, coalesce(v_titles[2], 'Τραυματιοφορέας'), private.demo_seed_interviews_category(v_titles[2]),
    case when v_hired[2] is null then 'offer' else 'hired' end,
    jsonb_build_object('area', 'Τρίκαλα', 'email', 'candidate11@example.org', 'level', 'ΑΕΙ', 'decision', 'hire', 'decisionOn', d0 - 105, 'decisionBy', 'Νίκος Αλεξίου',
      'decisionNotes', 'Ανέλαβε υπηρεσία.', 'employee', v_hired[2]),
    (d0 - 112 + time '10:00') at time zone 'Europe/Athens', 'completed', jsonb_build_array(v_nurse, v_hr),
    '{"presentation": 4, "knowledge": 4, "experience": 4, "motivation": 4, "teamwork": 4, "availability": 5}'::jsonb, 'recommend',
    jsonb_build_object('recommendation', 'Καλή εμπειρία, άμεσα διαθέσιμος/η.', 'expects', 1100, 'offered', 1100, 'available', d0 - 90));

  -- 12–13. Απορρίφθηκαν.
  perform private.demo_seed_interviews_candidate(v_org, v_actor, 'ΥΠ-0012', d0 - 40, 'Παππά Χριστίνα', 'female', 'Διοικητική υπάλληλος', 'administrative', 'rejected',
    jsonb_build_object('birth', '1999-02-14', 'area', 'Λάρισα', 'phone', '6900000106', 'email', 'c.pappa@example.org', 'level', 'Λύκειο', 'decision', 'reject', 'decisionOn', d0 - 30,
      'decisionBy', 'Ελένη Γεωργίου', 'decisionNotes', 'Δεν καλύπτει την απαιτούμενη εμπειρία στη λογιστική.'),
    (d0 - 33 + time '09:30') at time zone 'Europe/Athens', 'completed', jsonb_build_array(v_hr),
    '{"presentation": 3, "knowledge": 2, "experience": 2, "motivation": 3, "teamwork": 3, "availability": 4}'::jsonb, 'not_recommend',
    jsonb_build_object('weaknesses', 'Χωρίς εμπειρία σε μισθοδοσία και λογιστική.'));
  perform private.demo_seed_interviews_candidate(v_org, v_actor, 'ΥΠ-0013', d0 - 55, 'Κυριακίδης Παύλος', 'male', 'Μάγειρας', 'support', 'rejected',
    jsonb_build_object('birth', '1985-12-02', 'area', 'Βόλος', 'phone', '6900000112', 'email', 'p.kyriakidis@example.org', 'military', 'done', 'level', 'Λύκειο', 'decision', 'reject',
      'decisionOn', d0 - 41, 'decisionBy', 'Νίκος Αλεξίου', 'decisionNotes', 'Δεν διαθέτει πιστοποίηση HACCP.'),
    (d0 - 47 + time '11:00') at time zone 'Europe/Athens', 'completed', jsonb_build_array(v_chef, v_hr),
    '{"presentation": 3, "knowledge": 2, "experience": 3, "motivation": 2, "teamwork": 3, "availability": 4}'::jsonb, 'not_recommend', '{}'::jsonb);

  -- 14. Αποχώρησε πριν τη συνέντευξη.
  perform private.demo_seed_interviews_candidate(v_org, v_actor, 'ΥΠ-0014', d0 - 25, 'Δημητρίου Σοφία', 'female', 'Μαία', 'nursing', 'withdrawn',
    jsonb_build_object('area', 'Βόλος', 'phone', '6900000107', 'email', 's.dimitriou@example.org', 'licence', true, 'level', 'ΑΕΙ', 'decisionNotes', 'Αποδέχθηκε θέση σε άλλο νοσοκομείο.'),
    (d0 - 18 + time '10:30') at time zone 'Europe/Athens', 'cancelled', jsonb_build_array(v_nurse, v_hr), null, null, jsonb_build_object('notes', 'Ακυρώθηκε: η υποψήφια απέσυρε την αίτηση.'));

  -- The HR office's opinion on the evaluated applications (written as the Demo's creator).
  if v_actor is not null then
    insert into public.hr_interview_opinions (organization_id, candidate_id, author_id, role_kind, stance, comment, submitted_at)
    select v_org, c.id, v_actor, 'hr_office', x.stance, x.comment, (d0 - x.ago + time '15:00') at time zone 'Europe/Athens'
    from (values ('ΥΠ-0007', 'reserve', 'Καλός υποψήφιος· να κρατηθεί για την επόμενη θέση.', 4),
      ('ΥΠ-0008', 'propose', 'Προτείνεται, εφόσον συμφωνήσει η Παθολογική.', 3),
      ('ΥΠ-0009', 'approve', 'Συμφωνώ με την πρόσληψη.', 3),
      ('ΥΠ-0012', 'reject', 'Δεν ταιριάζει στη θέση.', 31)) as x(code, stance, comment, ago)
    join public.hr_candidates c on c.organization_id = v_org and c.code = x.code
    on conflict (candidate_id, author_id) do nothing;
  end if;
end;
$function$;
revoke all on function private.demo_seed_interviews(uuid, uuid) from public, anon, authenticated;

-- ===== 20261231380000_demo_seed_quality_resources.sql =====
-- Quality › Πόροι in every Demo organization: suppliers in categories with the departments
-- that use them, certificates valid / expiring within 30 days / expired, evaluations on the
-- four Demo templates over two years with a score per criterion, nonconformities, renewal
-- requests (one proposed, one answered by the supplier, one closed) and medical equipment
-- with its maintenance, calibration and safety checks (some overdue, one out of service).
-- The same content as the browser demo (src/features/quality/resources/resourceDemoData.js),
-- with dates from today. Names, tax ids and phones are made up; every e-mail is @example.com.
-- Automatic renewal sending stays off, so nothing here queues an e-mail.

-- A department of the Demo by its name (null when the Demo has no such department).
create or replace function private.demo_quality_resources_department(p_organization_id uuid, p_name text)
returns uuid language sql stable security definer set search_path = ''
as $function$
  select d.id from public.departments d where d.organization_id = p_organization_id and d.name = p_name order by d.created_at limit 1;
$function$;
revoke all on function private.demo_quality_resources_department(uuid, text) from public, anon, authenticated;

create or replace function private.demo_seed_quality_resources(p_organization_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
  d0 date := current_date;
  v_ev record;
  v_tpl public.quality_supplier_eval_templates;
  v_eval uuid;
  v_total numeric;
  v_request uuid;
  v_cert public.quality_supplier_certifications;
begin
  if not exists (select 1 from public.organizations o where o.id = v_org and o.is_demo) then
    raise exception 'Only Demo organizations get the Demo resources' using errcode = '42501';
  end if;
  -- Runs after private.demo_wipe_data: a Demo that already has suppliers or equipment is left as it is.
  if exists (select 1 from public.quality_suppliers x where x.organization_id = v_org)
     or exists (select 1 from public.quality_equipment x where x.organization_id = v_org) then
    return;
  end if;

  -- The four evaluation templates of the Demo (20261122100100); a template already there by name is kept.
  with presets(name, categories, criteria) as (
    values
      ('Προμηθευτής Προϊόντων', array['products','medical_devices','consumables','pharmaceuticals'],
        '[["Ποιότητα προϊόντων",0.2],["Συνέπεια στους χρόνους παράδοσης",0.2],["Συμμόρφωση με τις προδιαγραφές της παραγγελίας",0.2],["Πιστοποιητικά και τεκμηρίωση (CE, ISO, δηλώσεις συμμόρφωσης)",0.15],["Εξυπηρέτηση και διαχείριση παραπόνων",0.15],["Τιμή και όροι πληρωμής",0.1]]'::jsonb),
      ('Προμηθευτής Υπηρεσιών/Υπεργολάβος', array['services','maintenance','cleaning','laundry','waste','it','certification_body'],
        '[["Ποιότητα παρεχόμενων υπηρεσιών",0.2],["Τήρηση χρονοδιαγράμματος και ανταπόκριση",0.2],["Επάρκεια και εκπαίδευση προσωπικού",0.2],["Συμμόρφωση με νομοθεσία, ασφάλεια και τεκμηρίωση",0.15],["Επικοινωνία και αναφορές",0.15],["Κόστος",0.1]]'::jsonb),
      ('Προμηθευτής Κουζίνας', array['kitchen'],
        '[["Ποιότητα προσφερόμενων προϊόντων/υπηρεσιών",0.12],["Ασφάλεια τροφίμων (HACCP / ISO 22000, άδειες)",0.16],["Θερμοκρασία και συνθήκες μεταφοράς",0.14],["Υγιεινή οχήματος και προσωπικού παράδοσης",0.12],["Επισήμανση, ιχνηλασιμότητα και ημερομηνίες λήξης",0.12],["Συνέπεια στους χρόνους παράδοσης",0.12],["Πληρότητα παραγγελίας",0.12],["Τιμή",0.1]]'::jsonb),
      ('Προμηθευτής Εργαστηρίου', array['laboratory'],
        '[["Ποιότητα προϊόντων (αντιδραστήρια, αναλώσιμα)",0.2],["Πιστοποίηση: CE-IVD / ISO 13485, ISO 15189 όπου απαιτείται",0.15],["Ποιοτικός έλεγχος παρτίδας (πιστοποιητικά ανάλυσης, εξωτερικός έλεγχος)",0.15],["Ψυχρή αλυσίδα κατά τη μεταφορά και αποθήκευση",0.15],["Τεχνική και επιστημονική υποστήριξη αναλυτών",0.15],["Συνέπεια στους χρόνους παράδοσης",0.1],["Τιμή και όροι",0.1]]'::jsonb)
  ),
  created as (
    insert into public.quality_supplier_eval_templates (organization_id, name, description, categories, pass_threshold, conditional_threshold, frequency_months, score_scale, source, created_by)
    select v_org, p.name, 'Πρότυπο της Demo· επεξεργάσιμο.', p.categories, 70, 50, 12, 5, 'seed', p_actor
    from presets p
    on conflict (organization_id, name) do nothing
    returning id, name
  )
  insert into public.quality_supplier_eval_template_criteria (organization_id, template_id, position, label, weight, created_by)
  select v_org, c.id, (e.ordinality - 1)::smallint, e.value->>0, (e.value->>1)::numeric, p_actor
  from created c
  join presets p on p.name = c.name
  cross join lateral jsonb_array_elements(p.criteria) with ordinality e;

  -- Automatic renewal requests stay off in a Demo (no e-mails).
  insert into public.quality_supplier_renewal_settings (organization_id, auto_enabled, remind_after_days, max_reminders, updated_by)
  values (v_org, false, 7, 2, p_actor)
  on conflict (organization_id) do update set auto_enabled = false, last_run_at = null, last_result = '{}'::jsonb, updated_at = now();

  -- Suppliers: (code, name, legal name, category, criticality, status, tax id, contact, phone, e-mail, city, products, contract in days, notes, departments)
  insert into public.quality_suppliers (organization_id, code, name, legal_name, category, criticality, status, tax_id, contact_name, phone, email,
    address, city, country, products, contract_ends_on, notes, department_ids, created_by)
  select v_org, s.code, s.name, s.legal, s.category, s.crit, s.status, s.tax, s.contact, s.phone, s.email,
    s.city, s.city, 'Ελλάδα', s.products, d0 + s.contract, s.notes,
    coalesce(array(select x from unnest(s.deps) n cross join lateral private.demo_quality_resources_department(v_org, n) x where x is not null), '{}'::uuid[]), p_actor
  from (values
    ('SUP-001', 'Ιατροτεχνική Θεσσαλίας Α.Ε.', 'Ιατροτεχνική Θεσσαλίας Ανώνυμη Εταιρεία', 'medical_devices', 'high', 'active', '099999001', 'Τμήμα εξυπηρέτησης', '2410 000001', 'service@example.com', 'Λάρισα',
      'Απινιδωτές, monitors, αντλίες έγχυσης· τεχνική υποστήριξη', 240, null, array['Χειρουργική Κλινική', 'Μονάδα Εντατικής Θεραπείας']),
    ('SUP-002', 'Υγειονομικά Αναλώσιμα Κεντρικής Ελλάδας', 'Υγειονομικά Αναλώσιμα Κεντρικής Ελλάδας Α.Ε.', 'consumables', 'high', 'active', '099999002', 'Πωλήσεις', '2421 000002', 'orders@example.com', 'Βόλος',
      'Γάντια, μάσκες, σύριγγες, καθετήρες', 45, 'Καθυστερήσεις στις παραδόσεις του χειμώνα.', array['Χειρουργική Κλινική', 'Μονάδα Εντατικής Θεραπείας', 'Παθολογική Κλινική']),
    ('SUP-003', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, 'maintenance', 'high', 'active', '099999003', 'Τεχνικός υπεύθυνος', '2410 000003', 'tech@example.com', 'Λάρισα',
      'Προληπτική συντήρηση, διακριβώσεις, ηλεκτρολογικοί έλεγχοι ασφάλειας', 150, null, array[]::text[]),
    ('SUP-004', 'Εργαστηριακά Αντιδραστήρια Α.Ε.', null, 'laboratory', 'medium', 'active', '099999004', null, null, 'lab-orders@example.com', 'Αθήνα',
      'Αντιδραστήρια μικροβιολογικού, καλλιεργητικά υλικά', null, null, array[]::text[]),
    ('SUP-005', 'Καθαριότητα & Υγιεινή Ι.Κ.Ε.', null, 'cleaning', 'medium', 'active', '099999005', null, '2410 000005', null, 'Λάρισα',
      'Συνεργείο καθαριότητας, απολυμαντικά επιφανειών', -10, 'Η σύμβαση έληξε· σε εξέλιξη νέος διαγωνισμός.', array[]::text[]),
    ('SUP-006', 'Διαχείριση Αποβλήτων Υγειονομικών Μονάδων', null, 'waste', 'high', 'active', '099999006', 'Γραφείο κίνησης', '2310 000006', 'waste@example.com', 'Θεσσαλονίκη',
      'Συλλογή και μεταφορά ΕΑΑΜ', 600, null, array[]::text[]),
    ('SUP-007', 'Γαλακτοκομικά Κάμπου Α.Ε.', null, 'kitchen', 'high', 'active', '099999007', 'Πωλήσεις', '2410 000007', 'orders-food@example.com', 'Λάρισα',
      'Γάλα, γιαούρτι, τυριά· καθημερινή διανομή με ψυγείο', 200, null, array[]::text[]),
    ('SUP-008', 'Οπωροπωλείο Θεσσαλίας Ο.Ε.', null, 'kitchen', 'medium', 'active', '099999008', null, '2410 000008', null, 'Λάρισα',
      'Φρούτα και λαχανικά', null, null, array[]::text[]),
    ('SUP-009', 'Κρεατεμπορική Θεσσαλίας Α.Ε.', null, 'kitchen', 'high', 'active', '099999009', 'Πωλήσεις', '2410 000009', 'meat-orders@example.com', 'Λάρισα',
      'Κρέας και πουλερικά νωπά και κατεψυγμένα', 300, null, array[]::text[]),
    ('SUP-010', 'Φαρμακαποθήκη Πηνειός Α.Ε.', null, 'pharmaceuticals', 'high', 'active', '099999010', 'Εξυπηρέτηση πελατών', '2410 000010', 'pharma@example.com', 'Λάρισα',
      'Φάρμακα, αντισηπτικά, εμβόλια', 420, null, array['Παθολογική Κλινική', 'Χειρουργική Κλινική', 'Καρδιολογική Κλινική', 'Ορθοπαιδική Κλινική', 'Νεφρολογική Κλινική', 'Παιδιατρική Κλινική', 'Μονάδα Εντατικής Θεραπείας', 'Μονάδα Εντατικής Νοσηλείας Νεογνών']),
    ('SUP-011', 'Ιματισμός Νοσοκομείων Ο.Ε.', null, 'laundry', 'medium', 'active', '099999011', null, '2410 000011', 'laundry@example.com', 'Τρίκαλα',
      'Πλύσιμο και απολύμανση ιματισμού, χειρουργικά σετ υφασμάτων', 110, null, array[]::text[]),
    ('SUP-012', 'Νεογνολογικά Συστήματα Α.Ε.', null, 'medical_devices', 'high', 'active', '099999012', 'Τεχνική υποστήριξη', '2310 000012', 'neo-support@example.com', 'Θεσσαλονίκη',
      'Θερμοκοιτίδες, φωτοθεραπεία, monitors νεογνών', 500, null, array['Μονάδα Εντατικής Νοσηλείας Νεογνών', 'Παιδιατρική Κλινική']),
    ('SUP-013', 'Πληροφορική Υγείας Ι.Κ.Ε.', null, 'it', 'medium', 'active', '099999013', 'Helpdesk', '2410 000013', 'helpdesk@example.com', 'Λάρισα',
      'Υποστήριξη πληροφοριακού συστήματος νοσοκομείου', 75, null, array[]::text[]),
    ('SUP-014', 'Καρδιολογικά Αναλώσιμα Ε.Π.Ε.', null, 'consumables', 'medium', 'active', '099999014', null, '2310 000014', 'cardio@example.com', 'Θεσσαλονίκη',
      'Ηλεκτρόδια ΗΚΓ, καθετήρες, αναλώσιμα αιμοδυναμικού', 180, null, array['Καρδιολογική Κλινική']),
    ('SUP-015', 'Ορθοπαιδικά Εμφυτεύματα Α.Ε.', null, 'medical_devices', 'high', 'active', '099999015', 'Πωλήσεις', '2100 000015', 'ortho@example.com', 'Αθήνα',
      'Εμφυτεύματα, εργαλειοθήκες σε δανεισμό', 30, null, array['Ορθοπαιδική Κλινική', 'Χειρουργική Κλινική']),
    ('SUP-016', 'Νεφρολογικά Συστήματα Α.Ε.', null, 'medical_devices', 'high', 'active', '099999016', 'Τεχνική υποστήριξη', '2100 000016', 'dialysis@example.com', 'Αθήνα',
      'Μηχανήματα αιμοκάθαρσης, φίλτρα, γραμμές', 360, null, array['Νεφρολογική Κλινική']),
    ('SUP-017', 'Γραφική Ύλη Θεσσαλίας', null, 'products', 'low', 'inactive', '099999017', null, null, null, 'Λάρισα',
      'Έντυπα και γραφική ύλη', -200, 'Δεν συνεργαζόμαστε πλέον.', array[]::text[])
  ) s(code, name, legal, category, crit, status, tax, contact, phone, email, city, products, contract, notes, deps);

  -- Contacts.
  insert into public.quality_supplier_contacts (organization_id, supplier_id, position, full_name, job_title, phone, email, created_by)
  select v_org, s.id, c.pos, c.full_name, c.job, c.phone, c.email, p_actor
  from (values
    ('SUP-001', 0, 'Νίκος Αθανασίου', 'Τεχνικός εφαρμογών', '2410 000021', 'n.athanasiou@example.com'),
    ('SUP-002', 0, 'Σοφία Καραγιάννη', 'Υπεύθυνη πωλήσεων', '2421 000022', 'sales@example.com'),
    ('SUP-003', 0, 'Τεχνικός υπεύθυνος', 'Βάρδια βλαβών', '2410 000013', 'service@example.com'),
    ('SUP-007', 0, 'Υπεύθυνος διανομής', 'Διανομή Λάρισας', '2410 000017', 'orders-food@example.com'),
    ('SUP-010', 0, 'Δημήτρης Λαμπρόπουλος', 'Υπεύθυνος ποιότητας (GDP)', '2410 000020', 'quality-pharma@example.com'),
    ('SUP-010', 1, 'Γραφείο παραγγελιών', null, '2410 000030', 'pharma@example.com'),
    ('SUP-016', 0, 'Ελένη Μαυρίδου', 'Βιοϊατρική μηχανικός', '2100 000026', 'e.mavridou@example.com')
  ) c(code, pos, full_name, job, phone, email)
  join public.quality_suppliers s on s.organization_id = v_org and s.code = c.code;

  -- Certificates and documents: (code, type, kind, number, issuer, expires in days — null when it does not expire)
  insert into public.quality_supplier_certifications (organization_id, supplier_id, certificate_type, document_kind, certificate_number, issuer, expires_on, created_by, updated_by)
  select v_org, s.id, c.type, c.kind, c.number, c.issuer, d0 + c.days, p_actor, p_actor
  from (values
    ('SUP-001', 'ISO 13485', 'certificate', 'MD-4471', 'Φορέας πιστοποίησης', 420),
    ('SUP-001', 'ISO 9001', 'certificate', 'QM-1180', 'Φορέας πιστοποίησης', 18),
    ('SUP-001', 'CE', 'certificate', 'CE-0123-771', 'Κοινοποιημένος οργανισμός', 600),
    ('SUP-002', 'ISO 9001', 'certificate', 'QM-2290', 'Φορέας πιστοποίησης', -20),
    ('SUP-002', 'ISO 14001', 'certificate', 'EM-2291', 'Φορέας πιστοποίησης', -45),
    ('SUP-002', 'ISO 45001', 'certificate', 'OH-2292', 'Φορέας πιστοποίησης', -8),
    ('SUP-002', 'CE', 'declaration', null, null, null),
    ('SUP-003', 'ISO 9001', 'certificate', 'QM-3301', 'Φορέας πιστοποίησης', 510),
    ('SUP-003', 'ISO 13485', 'certificate', 'MD-3302', 'Φορέας πιστοποίησης', -3),
    ('SUP-003', 'Σύμβαση συντήρησης', 'contract', 'ΣΥΜ-2025-14', null, 150),
    ('SUP-004', 'ISO 13485', 'certificate', 'MD-8812', 'Φορέας πιστοποίησης', 300),
    ('SUP-004', 'CE-IVD', 'certificate', 'IVD-2201', 'Κοινοποιημένος οργανισμός', 500),
    ('SUP-005', 'Άδεια λειτουργίας', 'licence', 'ΑΛ-5521', 'Περιφέρεια Θεσσαλίας', 12),
    ('SUP-006', 'ISO 14001', 'certificate', 'EM-5550', 'Φορέας πιστοποίησης', 700),
    ('SUP-006', 'Άδεια συλλογής και μεταφοράς ΕΑΑΜ', 'licence', 'ΑΔ-ΕΑΑΜ-118', 'Περιφέρεια Κεντρικής Μακεδονίας', 28),
    ('SUP-007', 'ISO 22000 / HACCP', 'certificate', 'FS-7781', 'Φορέας πιστοποίησης', 25),
    ('SUP-007', 'Βεβαίωση καταχώρισης ΕΦΕΤ', 'licence', 'EFET-4410', 'ΕΦΕΤ', -12),
    ('SUP-009', 'ISO 22000 / HACCP', 'certificate', 'FS-9902', 'Φορέας πιστοποίησης', 260),
    ('SUP-009', 'Βεβαίωση καταχώρισης ΕΦΕΤ', 'licence', 'EFET-4512', 'ΕΦΕΤ', 90),
    ('SUP-009', 'Πιστοποιητικό απολύμανσης οχημάτων', 'other', 'ΑΠ-0931', 'Συνεργείο απολυμάνσεων', -5),
    ('SUP-010', 'Άδεια χονδρικής πώλησης φαρμάκων', 'licence', 'ΕΟΦ-ΧΠ-310', 'ΕΟΦ', 380),
    ('SUP-010', 'ISO 9001', 'certificate', 'QM-1010', 'Φορέας πιστοποίησης', 9),
    ('SUP-010', 'GDP', 'certificate', 'GDP-2210', 'ΕΟΦ', 200),
    ('SUP-011', 'ISO 9001', 'certificate', 'QM-1111', 'Φορέας πιστοποίησης', 150),
    ('SUP-011', 'EN 14065 (RABC)', 'certificate', 'RABC-0411', 'Φορέας πιστοποίησης', 27),
    ('SUP-012', 'ISO 13485', 'certificate', 'MD-1212', 'Φορέας πιστοποίησης', 640),
    ('SUP-012', 'CE', 'certificate', 'CE-0123-1212', 'Κοινοποιημένος οργανισμός', 640),
    ('SUP-013', 'ISO 27001', 'certificate', 'IS-1313', 'Φορέας πιστοποίησης', -30),
    ('SUP-014', 'ISO 13485', 'certificate', 'MD-1414', 'Φορέας πιστοποίησης', 220),
    ('SUP-014', 'Δήλωση συμμόρφωσης', 'declaration', 'ΔΣ-1414', null, null),
    ('SUP-015', 'ISO 13485', 'certificate', 'MD-1515', 'Φορέας πιστοποίησης', 14),
    ('SUP-015', 'CE', 'certificate', 'CE-0123-1515', 'Κοινοποιημένος οργανισμός', 480),
    ('SUP-016', 'ISO 13485', 'certificate', 'MD-1616', 'Φορέας πιστοποίησης', 330),
    ('SUP-017', 'ISO 9001', 'certificate', 'QM-1717', 'Φορέας πιστοποίησης', -400)
  ) c(code, type, kind, number, issuer, days)
  join public.quality_suppliers s on s.organization_id = v_org and s.code = c.code;

  -- Evaluations on the templates, a score (1–5) per criterion in order: (code, template, days ago, evaluator, notes, scores)
  for v_ev in
    select s.id as supplier_id, e.tpl, e.days, e.evaluator, e.notes, e.scores
    from (values
      ('SUP-001', 'Προμηθευτής Προϊόντων', -665, 'Υπεύθυνος Ποιότητας', null, array[4,4,4,4,4,3]),
      ('SUP-001', 'Προμηθευτής Προϊόντων', -300, 'Υπεύθυνος Ποιότητας', null, array[5,4,5,4,5,3]),
      ('SUP-002', 'Προμηθευτής Προϊόντων', -720, 'Υπεύθυνος Ποιότητας', null, array[4,3,4,4,3,4]),
      ('SUP-002', 'Προμηθευτής Προϊόντων', -390, 'Υπεύθυνος Ποιότητας', 'Καθυστερήσεις στις παραδόσεις του χειμώνα.', array[4,2,4,3,3,4]),
      ('SUP-003', 'Προμηθευτής Υπηρεσιών/Υπεργολάβος', -440, 'Υπεύθυνος Ποιότητας', null, array[4,4,4,4,4,4]),
      ('SUP-003', 'Προμηθευτής Υπηρεσιών/Υπεργολάβος', -90, 'Υπεύθυνος Ποιότητας', null, array[4,4,4,5,4,4]),
      ('SUP-004', 'Προμηθευτής Εργαστηρίου', -560, 'Υπεύθυνος Εργαστηρίου', null, array[4,4,4,3,4,4,3]),
      ('SUP-004', 'Προμηθευτής Εργαστηρίου', -200, 'Υπεύθυνος Εργαστηρίου', 'Παράδοση με θερμοκρασία εκτός ορίων· αλλαγή συσκευασίας χωρίς ενημέρωση.', array[3,4,3,2,4,3,3]),
      ('SUP-006', 'Προμηθευτής Υπηρεσιών/Υπεργολάβος', -500, 'Υπεύθυνος Ποιότητας', null, array[3,3,3,3,3,3]),
      ('SUP-006', 'Προμηθευτής Υπηρεσιών/Υπεργολάβος', -150, 'Υπεύθυνος Ποιότητας', 'Παραλείψεις στα συνοδευτικά έντυπα.', array[3,2,3,3,2,3]),
      ('SUP-007', 'Προμηθευτής Κουζίνας', -700, 'Υπεύθυνη κουζίνας', null, array[4,4,4,4,4,4,4,4]),
      ('SUP-007', 'Προμηθευτής Κουζίνας', -350, 'Υπεύθυνη κουζίνας', null, array[5,4,4,4,4,5,4,3]),
      ('SUP-008', 'Προμηθευτής Κουζίνας', -40, 'Υπεύθυνη κουζίνας', 'Λαχανικά χωρίς επισήμανση προέλευσης σε δύο παραδόσεις.', array[3,3,2,3,3,4,3,4]),
      ('SUP-009', 'Προμηθευτής Κουζίνας', -380, 'Υπεύθυνη κουζίνας', null, array[4,5,4,4,4,4,4,3]),
      ('SUP-009', 'Προμηθευτής Κουζίνας', -20, 'Υπεύθυνη κουζίνας', null, array[5,5,4,4,5,4,5,3]),
      ('SUP-010', 'Προμηθευτής Προϊόντων', -600, 'Υπεύθυνος Φαρμακείου', null, array[5,5,5,5,4,3]),
      ('SUP-010', 'Προμηθευτής Προϊόντων', -250, 'Υπεύθυνος Φαρμακείου', null, array[5,5,5,5,5,3]),
      ('SUP-011', 'Προμηθευτής Υπηρεσιών/Υπεργολάβος', -330, 'Υπεύθυνος Ποιότητας', null, array[4,3,4,4,4,4]),
      ('SUP-012', 'Προμηθευτής Προϊόντων', -180, 'Υπεύθυνος Ποιότητας', null, array[5,4,5,5,5,3]),
      ('SUP-013', 'Προμηθευτής Υπηρεσιών/Υπεργολάβος', -420, 'Υπεύθυνος Πληροφορικής', 'Αργή ανταπόκριση σε δύο βλάβες.', array[4,3,3,4,3,3]),
      ('SUP-014', 'Προμηθευτής Προϊόντων', -60, 'Υπεύθυνος Ποιότητας', null, array[4,4,4,4,4,4]),
      ('SUP-015', 'Προμηθευτής Προϊόντων', -540, 'Υπεύθυνος Ποιότητας', null, array[5,4,5,5,4,3]),
      ('SUP-015', 'Προμηθευτής Προϊόντων', -200, 'Υπεύθυνος Ποιότητας', null, array[4,4,5,5,4,3]),
      ('SUP-016', 'Προμηθευτής Προϊόντων', -110, 'Υπεύθυνος Ποιότητας', null, array[5,5,5,4,5,3]),
      ('SUP-017', 'Προμηθευτής Προϊόντων', -690, 'Υπεύθυνος Ποιότητας', null, array[3,3,3,2,3,4])
    ) e(code, tpl, days, evaluator, notes, scores)
    join public.quality_suppliers s on s.organization_id = v_org and s.code = e.code
  loop
    v_tpl := (select t from public.quality_supplier_eval_templates t where t.organization_id = v_org and t.name = v_ev.tpl);
    if v_tpl.id is null then continue; end if;
    -- The weighted score as the app computes it (supplierTemplates.js, weightedScore).
    v_total := (select round(sum(v_ev.scores[c.position + 1]::numeric / v_tpl.score_scale * c.weight) / sum(c.weight) * 100, 1)
                from public.quality_supplier_eval_template_criteria c
                where c.template_id = v_tpl.id and c.organization_id = v_org and v_ev.scores[c.position + 1] is not null);
    v_eval := gen_random_uuid();
    insert into public.quality_supplier_evaluations (id, organization_id, supplier_id, evaluated_on, evaluator, notes, template_id, template_name, template_version,
      pass_threshold, conditional_threshold, score_scale, total_score, result, criteria_scores, period_year, source, created_by, updated_by)
    values (v_eval, v_org, v_ev.supplier_id, d0 + v_ev.days, v_ev.evaluator, v_ev.notes, v_tpl.id, v_tpl.name, v_tpl.version,
      v_tpl.pass_threshold, v_tpl.conditional_threshold, v_tpl.score_scale, v_total,
      case when v_total >= v_tpl.pass_threshold then 'approved' when v_total >= v_tpl.conditional_threshold then 'conditional' else 'rejected' end,
      'complete', extract(year from d0 + v_ev.days)::smallint, 'app', p_actor, p_actor);
    insert into public.quality_supplier_evaluation_scores (organization_id, evaluation_id, criterion_id, criterion_label, position, weight, score_scale, score, created_by, updated_by)
    select v_org, v_eval, c.id, c.label, c.position, c.weight, v_tpl.score_scale, v_ev.scores[c.position + 1]::smallint, p_actor, p_actor
    from public.quality_supplier_eval_template_criteria c
    where c.template_id = v_tpl.id and c.organization_id = v_org and v_ev.scores[c.position + 1] is not null;
  end loop;

  -- The approval of each supplier is the result of its latest evaluation.
  update public.quality_suppliers s set approval_status = e.result
  from (select distinct on (x.supplier_id) x.supplier_id, x.result from public.quality_supplier_evaluations x
        where x.organization_id = v_org order by x.supplier_id, x.evaluated_on desc) e
  where s.organization_id = v_org and s.id = e.supplier_id;

  -- Nonconformities: (code, days ago, description, severity, status, closed days ago)
  insert into public.quality_supplier_nonconformities (organization_id, supplier_id, occurred_on, description, severity, status, closed_on, created_by, updated_by)
  select v_org, s.id, d0 + n.days, n.description, n.severity, n.status, d0 + n.closed, p_actor, p_actor
  from (values
    ('SUP-002', -60, 'Παρτίδα γαντιών νιτριλίου με σχισίματα κατά τη χρήση (ΜΕΘ).', 'major', 'open', null::integer),
    ('SUP-002', -150, 'Παράδοση 9 ημέρες εκτός χρόνου.', 'minor', 'closed', -120),
    ('SUP-004', -30, 'Παράδοση με θερμοκρασία μεταφοράς εκτός ορίων.', 'minor', 'open', null),
    ('SUP-006', -95, 'Ελλιπή συνοδευτικά έντυπα σε παραλαβή ΕΑΑΜ.', 'major', 'closed', -70),
    ('SUP-008', -25, 'Λαχανικά χωρίς επισήμανση προέλευσης.', 'minor', 'open', null)
  ) n(code, days, description, severity, status, closed)
  join public.quality_suppliers s on s.organization_id = v_org and s.code = n.code;

  -- Renewal requests (no link is issued and no e-mail is queued here).
  -- 1. Proposed: the expired ISO 9001 and ISO 14001 of SUP-002, waiting for approval to be sent.
  v_request := gen_random_uuid();
  insert into public.quality_supplier_certificate_requests (id, organization_id, supplier_id, recipient_email, status, requested_by, requested_at, created_at, updated_at)
  select v_request, v_org, s.id, 'orders@example.com', 'proposed', p_actor, now() - interval '1 day', now() - interval '1 day', now() - interval '1 day'
  from public.quality_suppliers s where s.organization_id = v_org and s.code = 'SUP-002';
  insert into public.quality_supplier_certificate_request_items (organization_id, request_id, supplier_id, certification_id, status, certificate_snapshot, created_at, updated_at)
  select v_org, v_request, c.supplier_id, c.id, 'pending',
    jsonb_build_object('certificate_type', c.certificate_type, 'title', c.title, 'document_kind', c.document_kind,
      'certificate_number', c.certificate_number, 'issuer', c.issuer, 'expires_on', c.expires_on, 'attachment_id', c.attachment_id),
    now() - interval '1 day', now() - interval '1 day'
  from public.quality_supplier_certifications c
  join public.quality_suppliers s on s.id = c.supplier_id and s.code = 'SUP-002'
  where c.organization_id = v_org and c.certificate_number in ('QM-2290', 'EM-2291');

  -- 2. Sent six days ago; the supplier has answered with the new ΕΦΕΤ certificate, waiting for review.
  v_cert := (select c from public.quality_supplier_certifications c where c.organization_id = v_org and c.certificate_number = 'EFET-4410');
  if v_cert.id is not null then
    v_request := gen_random_uuid();
    insert into public.quality_supplier_certificate_requests (id, organization_id, supplier_id, recipient_email, status, requested_by, requested_at,
      approved_by, approved_at, token_expires_at, sent_at, first_sent_at, send_count, send_history, created_at, updated_at)
    values (v_request, v_org, v_cert.supplier_id, 'orders-food@example.com', 'sent', p_actor, now() - interval '7 days',
      p_actor, now() - interval '6 days', now() + interval '8 days', now() - interval '6 days', now() - interval '6 days', 1,
      jsonb_build_array(jsonb_build_object('kind', 'send', 'at', now() - interval '6 days', 'by', p_actor, 'expiresAt', now() + interval '8 days')),
      now() - interval '7 days', now() - interval '2 days');
    insert into public.quality_supplier_certificate_request_items (organization_id, request_id, supplier_id, certification_id, status, certificate_snapshot,
      submitted_at, certificate_type, certificate_number, issuer, issued_on, expires_on, note, owner_notified_at, created_at, updated_at)
    values (v_org, v_request, v_cert.supplier_id, v_cert.id, 'submitted',
      jsonb_build_object('certificate_type', v_cert.certificate_type, 'title', v_cert.title, 'document_kind', v_cert.document_kind,
        'certificate_number', v_cert.certificate_number, 'issuer', v_cert.issuer, 'expires_on', v_cert.expires_on, 'attachment_id', v_cert.attachment_id),
      now() - interval '2 days', v_cert.certificate_type, 'EFET-5120', 'ΕΦΕΤ', d0 - 20, d0 + 345, 'Η νέα βεβαίωση εκδόθηκε μετά την αυτοψία.', now() - interval '2 days',
      now() - interval '7 days', now() - interval '2 days');
  end if;

  -- 3. Closed: the ISO 14001 of SUP-006 was renewed by the supplier and accepted.
  v_cert := (select c from public.quality_supplier_certifications c where c.organization_id = v_org and c.certificate_number = 'EM-5550');
  if v_cert.id is not null then
    v_request := gen_random_uuid();
    insert into public.quality_supplier_certificate_requests (id, organization_id, supplier_id, recipient_email, status, requested_by, requested_at,
      approved_by, approved_at, token_expires_at, sent_at, first_sent_at, send_count, send_history, created_at, updated_at)
    values (v_request, v_org, v_cert.supplier_id, 'waste@example.com', 'closed', p_actor, now() - interval '36 days',
      p_actor, now() - interval '35 days', now() - interval '21 days', now() - interval '35 days', now() - interval '35 days', 1,
      jsonb_build_array(jsonb_build_object('kind', 'send', 'at', now() - interval '35 days', 'by', p_actor, 'expiresAt', now() - interval '21 days')),
      now() - interval '36 days', now() - interval '28 days');
    insert into public.quality_supplier_certificate_request_items (organization_id, request_id, supplier_id, certification_id, status, certificate_snapshot,
      submitted_at, certificate_type, certificate_number, issuer, issued_on, expires_on, reviewed_by, reviewed_at, review_comment, previous_values,
      owner_notified_at, created_at, updated_at)
    select v_org, v_request, v_cert.supplier_id, v_cert.id, 'accepted', old.value,
      now() - interval '30 days', v_cert.certificate_type, v_cert.certificate_number, v_cert.issuer, d0 - 32, v_cert.expires_on,
      p_actor, now() - interval '28 days', 'Ελέγχθηκε· ενημερώθηκε το μητρώο.', old.value,
      now() - interval '30 days', now() - interval '36 days', now() - interval '28 days'
    from (select jsonb_build_object('certificate_type', v_cert.certificate_type, 'title', v_cert.title, 'document_kind', v_cert.document_kind,
            'certificate_number', 'EM-4410', 'issuer', v_cert.issuer, 'expires_on', d0 - 15, 'attachment_id', null) as value) old;
  end if;

  -- Equipment: (code, name, type, department, location, manufacturer, model, serial, inventory, supplier, criticality, status,
  --             installed days ago, warranty in days, maintenance / calibration / safety months, notes)
  insert into public.quality_equipment (organization_id, code, name, equipment_type, department_id, location, manufacturer, model, serial_number, inventory_number,
    supplier_id, criticality, status, installed_on, warranty_ends_on, maintenance_months, calibration_months, safety_months, notes, created_by)
  select v_org, e.code, e.name, e.type, private.demo_quality_resources_department(v_org, e.dept), e.location, e.maker, e.model, e.serial, e.inventory,
    (select s.id from public.quality_suppliers s where s.organization_id = v_org and s.code = e.supplier), e.crit, e.status,
    d0 + e.installed, d0 + e.warranty, e.maint, e.cal, e.safety, e.notes, p_actor
  from (values
    ('EQ-0001', 'Απινιδωτής', 'Απινιδωτής', 'Μονάδα Εντατικής Θεραπείας', 'Σταθμός νοσηλευτών', 'Κατασκευαστής Α', 'D-300', 'DF30-11872', 'ΑΠ-1021', 'SUP-001', 'high', 'in_service', -1400, null::integer, 6, null::integer, 12, null),
    ('EQ-0002', 'Απινιδωτής', 'Απινιδωτής', 'Χειρουργική Κλινική', 'Αίθουσα ανάνηψης', 'Κατασκευαστής Α', 'D-300', 'DF30-11990', 'ΑΠ-1022', 'SUP-001', 'high', 'in_service', -1400, null, 6, null, 12, null),
    ('EQ-0003', 'Ψυγείο φαρμάκων', 'Ψυγείο φαρμάκων', 'Παθολογική Κλινική', 'Φαρμακείο τμήματος', 'Κατασκευαστής Β', 'MR-140', 'MR140-5521', 'ΑΠ-2210', 'SUP-003', 'high', 'in_service', -1200, null, 12, 12, null, null),
    ('EQ-0004', 'Ψυγείο εμβολίων', 'Ψυγείο εμβολίων', 'Παιδιατρική Κλινική', 'Ιατρείο', 'Κατασκευαστής Β', 'VR-90', 'VR90-0042', 'ΑΠ-2211', 'SUP-003', 'high', 'in_service', -900, null, 12, 12, null, null),
    ('EQ-0005', 'Κλίβανος αποστείρωσης ατμού', 'Κλίβανος αποστείρωσης', null, 'Κεντρική Αποστείρωση', 'Κατασκευαστής Γ', 'ST-600', 'ST6-2019-07', 'ΑΠ-0100', 'SUP-003', 'high', 'in_service', -2000, null, 3, 12, 12, null),
    ('EQ-0006', 'Πλυντήριο-απολυμαντής ενδοσκοπίων', 'Πλυντήριο-απολυμαντής ενδοσκοπίων', 'Χειρουργική Κλινική', 'Ενδοσκοπικό', 'Κατασκευαστής Δ', 'EW-2', 'EW2-7781', 'ΑΠ-0310', 'SUP-003', 'high', 'in_service', -1100, null, 6, 12, 12, null),
    ('EQ-0007', 'Αναρροφητήρας', 'Αναρροφητήρας', 'Χειρουργική Κλινική', 'Θάλαμος 4', 'Κατασκευαστής Ε', 'SU-10', 'SU10-334', 'ΑΠ-0411', 'SUP-001', 'medium', 'in_service', -1400, null, 12, null, 12, null),
    ('EQ-0008', 'Θερμοκοιτίδα', 'Θερμοκοιτίδα', 'Μονάδα Εντατικής Νοσηλείας Νεογνών', 'Θέση 2', 'Κατασκευαστής Ζ', 'IN-5', 'IN5-0912', 'ΑΠ-0520', 'SUP-012', 'high', 'in_service', -165, 200, 6, 12, 12, null),
    ('EQ-0009', 'Θάλαμος βιολογικής ασφάλειας', 'Θάλαμος βιολογικής ασφάλειας', null, 'Μικροβιολογικό εργαστήριο', 'Κατασκευαστής Η', 'BSC-II', 'BSC2-118', 'ΑΠ-0601', 'SUP-003', 'high', 'in_service', -1600, null, 12, 12, 12, null),
    ('EQ-0010', 'Παρασκευαστής πάγου', 'Παρασκευαστής πάγου', 'Καρδιολογική Κλινική', 'Office', null, null, null, null, null, 'low', 'in_service', -1000, null, 6, null, null, null),
    ('EQ-0011', 'Τροχήλατο ανάνηψης', 'Τροχήλατο ανάνηψης', 'Ορθοπαιδική Κλινική', 'Διάδρομος', null, null, null, 'ΑΠ-0711', null, 'high', 'in_service', -1500, null, 1, null, null, 'Μηνιαίος έλεγχος περιεχομένου και λήξεων.'),
    ('EQ-0012', 'Αναρροφητήρας', 'Αναρροφητήρας', 'Μονάδα Εντατικής Θεραπείας', null, 'Κατασκευαστής Ε', 'SU-8', 'SU8-101', 'ΑΠ-0402', 'SUP-001', 'medium', 'retired', -3000, null, 12, null, 12, 'Αντικαταστάθηκε από το EQ-0007.'),
    ('EQ-0013', 'Μηχάνημα αιμοκάθαρσης', 'Μηχάνημα αιμοκάθαρσης', 'Νεφρολογική Κλινική', 'Θέση 1', 'Κατασκευαστής Θ', 'HD-5008', 'HD5-2201', 'ΑΠ-0801', 'SUP-016', 'high', 'in_service', -800, 100, 6, 12, 12, null),
    ('EQ-0014', 'Μηχάνημα αιμοκάθαρσης', 'Μηχάνημα αιμοκάθαρσης', 'Νεφρολογική Κλινική', 'Θέση 2', 'Κατασκευαστής Θ', 'HD-5008', 'HD5-2202', 'ΑΠ-0802', 'SUP-016', 'high', 'in_service', -800, 100, 6, 12, 12, null),
    ('EQ-0015', 'Αναπνευστήρας', 'Αναπνευστήρας', 'Μονάδα Εντατικής Θεραπείας', 'Κλίνη 1', 'Κατασκευαστής Ι', 'V-800', 'V800-3301', 'ΑΠ-0901', 'SUP-001', 'high', 'in_service', -700, null, 6, 12, 12, null),
    ('EQ-0016', 'Αναπνευστήρας', 'Αναπνευστήρας', 'Μονάδα Εντατικής Θεραπείας', 'Κλίνη 4', 'Κατασκευαστής Ι', 'V-800', 'V800-3302', 'ΑΠ-0902', 'SUP-001', 'high', 'in_service', -700, null, 6, 12, 12, null),
    ('EQ-0017', 'Ηλεκτροκαρδιογράφος', 'Ηλεκτροκαρδιογράφος', 'Καρδιολογική Κλινική', 'Εξεταστήριο', 'Κατασκευαστής Κ', 'ECG-12', 'ECG12-778', 'ΑΠ-1001', 'SUP-014', 'medium', 'in_service', -1300, null, 12, null, 12, null),
    ('EQ-0018', 'Αντλία έγχυσης', 'Αντλία έγχυσης', 'Παθολογική Κλινική', 'Θάλαμος 2', 'Κατασκευαστής Λ', 'IP-7', 'IP7-5530', 'ΑΠ-1101', 'SUP-001', 'medium', 'in_service', -600, null, 12, 12, null, null),
    ('EQ-0019', 'Ψυγείο μητρικού γάλακτος', 'Ψυγείο', 'Μονάδα Εντατικής Νοσηλείας Νεογνών', 'Γαλακτοκομείο', 'Κατασκευαστής Β', 'MR-60', 'MR60-0088', 'ΑΠ-2212', 'SUP-003', 'high', 'in_service', -500, null, 12, 12, null, null),
    ('EQ-0020', 'Καταγραφικό θερμοκρασίας', 'Καταγραφικό θερμοκρασίας', 'Παιδιατρική Κλινική', 'Ψυγείο εμβολίων', 'Κατασκευαστής Μ', 'TL-1', 'TL1-4412', null, 'SUP-003', 'medium', 'in_service', -900, null, null, 12, null, null),
    ('EQ-0021', 'Ηλεκτρική κλίνη', 'Κλίνη νοσηλείας', 'Ορθοπαιδική Κλινική', 'Θάλαμος 6', 'Κατασκευαστής Ν', 'BED-3', 'BED3-1290', 'ΑΠ-1201', null, 'low', 'in_service', -1100, null, 12, null, 24, null)
  ) e(code, name, type, dept, location, maker, model, serial, inventory, supplier, crit, status, installed, warranty, maint, cal, safety, notes);

  -- Events: (equipment, kind, days ago, result, performed by, description, certificate)
  insert into public.quality_equipment_events (organization_id, equipment_id, kind, happened_on, result, performed_by, description, certificate, recorded_by, recorded_at)
  select v_org, q.id, v.kind, d0 + v.days, v.result, v.who, v.description, v.cert, p_actor, (d0 + v.days)::timestamp + interval '10 hours'
  from (values
    ('EQ-0001', 'maintenance', -150, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, null),
    ('EQ-0001', 'safety', -150, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, null),
    ('EQ-0002', 'maintenance', -200, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, null),
    ('EQ-0002', 'safety', -200, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, null),
    ('EQ-0003', 'maintenance', -340, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, null),
    ('EQ-0003', 'calibration', -340, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, 'ΠΔ-2291'),
    ('EQ-0004', 'maintenance', -100, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, null),
    ('EQ-0004', 'calibration', -100, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, 'ΠΔ-2302'),
    ('EQ-0005', 'maintenance', -70, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, null),
    ('EQ-0005', 'calibration', -250, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, 'ΠΔ-2250'),
    ('EQ-0005', 'safety', -250, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, null),
    ('EQ-0005', 'failure', -12, 'out_of_service', 'Προσωπικό Κεντρικής Αποστείρωσης', 'Ο κύκλος διακόπτεται με σφάλμα πίεσης· οι δείκτες Bowie-Dick απέτυχαν.', null),
    ('EQ-0006', 'maintenance', -160, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, null),
    ('EQ-0006', 'calibration', -330, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, 'ΠΔ-2260'),
    ('EQ-0006', 'safety', -330, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, null),
    ('EQ-0007', 'maintenance', -380, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, null),
    ('EQ-0007', 'safety', -380, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, null),
    ('EQ-0007', 'failure', -40, 'out_of_service', 'Προσωπικό τμήματος', 'Δεν δημιουργεί αναρρόφηση.', null),
    ('EQ-0007', 'repair', -35, 'returned', 'Βιοϊατρική Συντήρηση Ο.Ε.', 'Αντικατάσταση φίλτρου και σωλήνωσης.', null),
    ('EQ-0009', 'maintenance', -20, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, null),
    ('EQ-0009', 'calibration', -20, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, 'ΠΔ-2410'),
    ('EQ-0009', 'safety', -20, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, null),
    ('EQ-0010', 'maintenance', -175, 'pass', 'Τεχνική υπηρεσία', null, null),
    ('EQ-0011', 'maintenance', -20, 'pass', 'Προϊσταμένη τμήματος', 'Μηνιαίος έλεγχος περιεχομένου και λήξεων.', null),
    ('EQ-0011', 'maintenance', -50, 'pass', 'Προϊσταμένη τμήματος', 'Μηνιαίος έλεγχος περιεχομένου και λήξεων.', null),
    ('EQ-0012', 'maintenance', -500, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, null),
    ('EQ-0013', 'maintenance', -90, 'pass', 'Νεφρολογικά Συστήματα Α.Ε.', null, null),
    ('EQ-0013', 'calibration', -300, 'pass', 'Νεφρολογικά Συστήματα Α.Ε.', null, 'ΠΔ-2480'),
    ('EQ-0013', 'safety', -300, 'pass', 'Νεφρολογικά Συστήματα Α.Ε.', null, null),
    ('EQ-0014', 'maintenance', -210, 'pass', 'Νεφρολογικά Συστήματα Α.Ε.', null, null),
    ('EQ-0014', 'calibration', -380, 'pass', 'Νεφρολογικά Συστήματα Α.Ε.', null, 'ΠΔ-2190'),
    ('EQ-0014', 'safety', -300, 'pass', 'Νεφρολογικά Συστήματα Α.Ε.', null, null),
    ('EQ-0015', 'maintenance', -60, 'pass', 'Ιατροτεχνική Θεσσαλίας Α.Ε.', null, null),
    ('EQ-0015', 'calibration', -60, 'pass', 'Ιατροτεχνική Θεσσαλίας Α.Ε.', null, 'ΠΔ-2501'),
    ('EQ-0015', 'safety', -60, 'pass', 'Ιατροτεχνική Θεσσαλίας Α.Ε.', null, null),
    ('EQ-0016', 'maintenance', -120, 'pass', 'Ιατροτεχνική Θεσσαλίας Α.Ε.', null, null),
    ('EQ-0016', 'calibration', -120, 'pass', 'Ιατροτεχνική Θεσσαλίας Α.Ε.', null, 'ΠΔ-2502'),
    ('EQ-0016', 'safety', -120, 'fail', 'Ιατροτεχνική Θεσσαλίας Α.Ε.', 'Ρεύμα διαρροής πάνω από το όριο.', null),
    ('EQ-0016', 'repair', -115, 'returned', 'Ιατροτεχνική Θεσσαλίας Α.Ε.', 'Αντικατάσταση τροφοδοτικού.', null),
    ('EQ-0016', 'safety', -114, 'pass', 'Ιατροτεχνική Θεσσαλίας Α.Ε.', 'Επανέλεγχος μετά την επισκευή.', null),
    ('EQ-0017', 'maintenance', -400, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, null),
    ('EQ-0017', 'safety', -400, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, null),
    ('EQ-0018', 'maintenance', -250, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, null),
    ('EQ-0018', 'calibration', -250, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, 'ΠΔ-2330'),
    ('EQ-0019', 'maintenance', -30, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, null),
    ('EQ-0019', 'calibration', -30, 'pass', 'Βιοϊατρική Συντήρηση Ο.Ε.', null, 'ΠΔ-2520'),
    ('EQ-0020', 'calibration', -355, 'pass', 'Εργαστήριο διακριβώσεων', null, 'ΠΔ-2105'),
    ('EQ-0021', 'maintenance', -100, 'pass', 'Τεχνική υπηρεσία', null, null)
  ) v(code, kind, days, result, who, description, cert)
  join public.quality_equipment q on q.organization_id = v_org and q.code = v.code;
end;
$function$;
revoke all on function private.demo_seed_quality_resources(uuid, uuid) from public, anon, authenticated;

-- ===== 20261231390000_demo_seed_quality_governance.sql =====
-- Quality governance in every Demo organization: department meetings with their groups,
-- topics, decisions, corrective actions, trainings and attendance; the management review
-- (one approved last year, one being written now); the quality objectives with their monthly
-- values (some on target, some not); the departments' self-assessments on the ward checklist;
-- the satisfaction survey's answers (so the satisfaction indicators have values) and the
-- kitchen's recall drills. Dates are relative to today; names are made up and come from the
-- Demo's own employees. private.demo_seed_quality_governance fills one Demo organization.

-- A repeatable number in [0, 1) from a text: the same Demo every time.
create or replace function private.demo_unit_random(p_key text)
returns double precision language sql immutable set search_path = ''
as $function$
  select (('x' || substr(md5(p_key), 1, 8))::bit(32)::bigint)::double precision / 4294967296.0
$function$;
revoke all on function private.demo_unit_random(text) from public, anon, authenticated;

-- Department meetings: one group per department that meets, its meetings since January of
-- last year (each: two topics, a decision, sometimes a corrective action or a training, and
-- the attendance), the latest one of Surgery still a draft, Orthopaedics overdue, and an
-- extraordinary ICU meeting about a CPE cluster.
create or replace function private.demo_seed_quality_meetings(v_org uuid)
returns void language plpgsql set search_path = ''
as $function$
declare
  d0 date := current_date;
  v_start date := make_date(extract(year from current_date)::integer - 1, 1, 1);
  -- (department code, short name, frequency in days, months between meetings, day of month, days before today the meetings stop)
  v_groups text[] := array[
    array['ΜΕΘ', 'ΜΕΘ', '30', '1', '18', '3'],
    array['ΠΑΘ', 'Παθολογικής', '30', '1', '22', '3'],
    array['ΧΕΙΡ', 'Χειρουργικής', '30', '1', '8', '3'],
    array['ΜΕΝΝ', 'ΜΕΝΝ', '60', '2', '12', '3'],
    array['ΚΑΡΔ', 'Καρδιολογικής', '90', '3', '25', '3'],
    array['ΟΡΘ', 'Ορθοπαιδικής', '90', '3', '14', '130']];
  -- (topic, discussion, conclusion, decision)
  v_topics text[] := array[
    array['Δείκτες του μήνα', 'Οι δείκτες του τμήματος είναι εντός στόχου, εκτός από τη συμμόρφωση στην υγιεινή χεριών.', 'Στοχευμένες παρατηρήσεις υγιεινής χεριών τις επόμενες δύο εβδομάδες.', 'Στοχευμένες παρατηρήσεις υγιεινής χεριών σε όλες τις βάρδιες'],
    array['Συμβάντα και διορθωτικές ενέργειες', 'Συζητήθηκαν τα συμβάντα του μήνα και η πορεία των ανοιχτών διορθωτικών ενεργειών.', 'Κλείνουν όσες ολοκληρώθηκαν· οι υπόλοιπες συνεχίζονται.', 'Ενημέρωση των υπευθύνων για τις ανοιχτές διορθωτικές ενέργειες'],
    array['Λοιμώξεις και απομονώσεις', 'Δύο ασθενείς σε απομόνωση επαφής· τηρήθηκαν τα μέτρα, με μία παράλειψη στη σήμανση.', 'Υπενθύμιση της σήμανσης απομόνωσης σε κάθε βάρδια.', 'Έλεγχος της σήμανσης απομόνωσης στην πρωινή αναφορά'],
    array['Εκπαίδευση προσωπικού', 'Δύο νέοι συνάδελφοι χρειάζονται εισαγωγική εκπαίδευση.', 'Πρόγραμμα εκπαίδευσης για τους νέους συναδέλφους.', 'Εισαγωγική εκπαίδευση των νέων συναδέλφων'],
    array['Εξοπλισμός και υλικά', 'Καθυστέρηση στην προμήθεια επιθεμάτων και ένας ογκομετρικός αντλιοδότης εκτός λειτουργίας.', 'Αίτημα προς το Γραφείο Προμηθειών και τη Βιοϊατρική Τεχνολογία.', 'Αίτημα προμήθειας επιθεμάτων και επισκευής του αντλιοδότη'],
    array['Ικανοποίηση ασθενών', 'Τα σχόλια του μήνα αφορούν κυρίως τον θόρυβο τη νύχτα και τη θερμοκρασία του φαγητού.', 'Ησυχία στον διάδρομο μετά τις 23:00.', 'Μέτρα για τον θόρυβο τη νύχτα'],
    array['Πτώσεις και έλκη πίεσης', 'Μία πτώση χωρίς κάκωση· τα έλκη πίεσης μειώθηκαν.', 'Αξιολόγηση κινδύνου πτώσης σε κάθε εισαγωγή.', 'Έλεγχος της αξιολόγησης κινδύνου πτώσης στους φακέλους'],
    array['Φάρμακα υψηλού κινδύνου', 'Ο διπλός έλεγχος τηρείται στις περισσότερες χορηγήσεις· δύο παραλείψεις τη νύχτα.', 'Υπενθύμιση του διπλού ελέγχου στις βάρδιες.', 'Αυτοέλεγχος του διπλού ελέγχου στη νυχτερινή βάρδια']];
  v_programs text[] := array['TRN-DEMO-001', 'TRN-DEMO-003', 'TRN-DEMO-012', 'TRN-DEMO-016', 'TRN-DEMO-011'];
  g integer; i integer; v_dep uuid; v_dep_name text; v_group uuid; v_manager text; v_step integer; v_day integer;
  v_date date; v_next date; v_until date; v_last boolean; v_year integer; v_n integer; v_code text; v_meeting uuid;
  t1 integer; t2 integer; v_t1 uuid; v_t2 uuid; v_status text; v_program uuid; v_key text; v_capa uuid; v_prev_code text;
begin
  for g in 1..array_length(v_groups, 1) loop
    select d.id, d.name into v_dep, v_dep_name from public.departments d where d.organization_id = v_org and d.code = v_groups[g][1];
    if v_dep is null then continue; end if;
    select e.first_name || ' ' || e.last_name into v_manager from public.employees e
      where e.organization_id = v_org and e.department_id = v_dep and e.position_name like 'Προϊστάμεν%' order by e.employee_code limit 1;
    v_manager := coalesce(v_manager, 'Προϊστάμενος/η τμήματος');
    insert into public.quality_department_meeting_groups (organization_id, department_id, name, frequency_days, duration_hours, manager_label, active)
    values (v_org, v_dep, 'Συναντήσεις ' || v_groups[g][2], v_groups[g][3]::integer, case when g = 1 then 1.5 else 1 end, v_manager, true)
    returning id into v_group;
    v_step := v_groups[g][4]::integer; v_day := v_groups[g][5]::integer; v_until := d0 - v_groups[g][6]::integer;
    v_year := 0; v_n := 0; v_prev_code := null;
    for i in 0..40 loop
      v_key := v_org::text || '|meeting|' || g || '|' || i;
      v_date := (v_start + make_interval(months => i * v_step))::date + v_day - 1 + floor(private.demo_unit_random(v_key) * 5)::integer - 2;
      exit when v_date > v_until;
      v_next := (v_start + make_interval(months => (i + 1) * v_step))::date + v_day - 1 + floor(private.demo_unit_random(v_org::text || '|meeting|' || g || '|' || (i + 1)) * 5)::integer - 2;
      v_last := v_next > v_until;
      if extract(year from v_date)::integer <> v_year then v_year := extract(year from v_date)::integer; v_n := 0; end if;
      v_n := v_n + 1;
      v_code := 'DM-' || v_year || '-' || lpad(v_n::text, 2, '0');
      t1 := ((i * 3 + g * 2) % 8) + 1;
      t2 := ((i * 3 + g * 2 + 5) % 8) + 1;
      v_status := case when v_last and v_groups[g][1] = 'ΧΕΙΡ' then 'draft' else 'final' end;
      v_program := null;
      if i % 3 = 2 then
        select p.id into v_program from public.training_programs p where p.organization_id = v_org and p.program_key = v_programs[((i / 3 + g) % 5) + 1];
      end if;
      insert into public.quality_department_meetings (organization_id, department_id, group_id, code, title, kind, meeting_date, period_month, agenda, minutes,
        next_meeting_date, status, finalized_at, finalized_by_label, training_held, training_program_id)
      values (v_org, v_dep, v_group, v_code, 'Συνάντηση ' || v_groups[g][2], 'regular', v_date, (date_trunc('month', v_date) - interval '1 month')::date,
        v_topics[t1][1] || E'\n' || v_topics[t2][1], v_topics[t1][2], v_date + v_groups[g][3]::integer, v_status,
        case when v_status = 'final' then (v_date + 2 + time '13:00') at time zone 'Europe/Athens' end, case when v_status = 'final' then v_manager end,
        v_program is not null, v_program)
      returning id into v_meeting;
      insert into public.quality_department_meeting_topics (organization_id, meeting_id, position, subject, discussion, conclusion)
      values (v_org, v_meeting, 0, v_topics[t1][1], v_topics[t1][2], v_topics[t1][3]) returning id into v_t1;
      insert into public.quality_department_meeting_topics (organization_id, meeting_id, position, subject, discussion, conclusion)
      values (v_org, v_meeting, 1, v_topics[t2][1], v_topics[t2][2], v_topics[t2][3]) returning id into v_t2;
      -- A corrective action of the department behind some recent decisions.
      v_capa := null;
      if v_date > d0 - 200 and private.demo_unit_random(v_key || '|capa') < 0.4 then
        select c.id into v_capa from public.quality_capa_actions c where c.organization_id = v_org and c.department_id = v_dep order by c.code limit 1;
      end if;
      insert into public.quality_department_meeting_decisions (organization_id, meeting_id, position, topic_id, title, owner_label, due_date, status, capa_id)
      values (v_org, v_meeting, 0, v_t1, v_topics[t1][4], v_manager, v_date + case when v_groups[g][1] = 'ΠΑΘ' then 14 else 30 end,
        case when v_last then 'open' when private.demo_unit_random(v_key || '|d0') < 0.9 then 'done' else 'cancelled' end, v_capa);
      if private.demo_unit_random(v_key || '|d1') < 0.45 then
        insert into public.quality_department_meeting_decisions (organization_id, meeting_id, position, topic_id, title, owner_label, due_date, status)
        values (v_org, v_meeting, 1, v_t2, v_topics[t2][4], 'Υπεύθυνος Ποιότητας', v_date + 45,
          case when v_last then 'open' when private.demo_unit_random(v_key || '|d1s') < 0.85 then 'done' else 'cancelled' end);
      end if;
      if v_program is not null then
        insert into public.quality_department_meeting_trainings (organization_id, meeting_id, position, topic, audience, due_date, training_program_id)
        select v_org, v_meeting, 0, p.title, 'Προσωπικό ' || v_dep_name, v_date, p.id from public.training_programs p where p.id = v_program;
      end if;
      insert into public.quality_department_meeting_participants (organization_id, meeting_id, position, name, role, attended, employee_id)
      select v_org, v_meeting, (row_number() over (order by e.employee_code))::integer - 1, e.first_name || ' ' || e.last_name, e.position_name,
        private.demo_unit_random(v_key || '|p|' || e.id) < 0.9, e.id
      from public.employees e where e.organization_id = v_org and e.department_id = v_dep;
      insert into public.quality_department_meeting_participants (organization_id, meeting_id, position, name, role, attended)
      values (v_org, v_meeting, 10, 'Υπεύθυνος Ποιότητας', 'Ποιότητα', true);
      v_prev_code := v_code;
    end loop;

    -- An extraordinary ICU meeting about the CPE cluster: its decisions are open, one carried from the last regular meeting.
    if v_groups[g][1] = 'ΜΕΘ' and v_prev_code is not null then
      v_date := d0 - 9;
      if extract(year from v_date)::integer <> v_year then v_n := 0; end if;
      v_code := 'DM-' || extract(year from v_date)::integer || '-' || lpad((v_n + 1)::text, 2, '0');
      insert into public.quality_department_meetings (organization_id, department_id, group_id, code, title, kind, meeting_date, period_month, agenda, minutes,
        next_meeting_date, status, finalized_at, finalized_by_label)
      values (v_org, v_dep, v_group, v_code, 'Έκτακτη συνάντηση ΜΕΘ — συρροή CPE', 'extraordinary', v_date, (date_trunc('month', v_date) - interval '1 month')::date,
        E'Συρροή CPE στη ΜΕΘ\nΜέτρα ελέγχου', 'Τρεις ασθενείς με CPE μέσα σε δέκα ημέρες· η ομάδα πρόληψης λοιμώξεων παρουσίασε τα μέτρα.', v_date + 30, 'final',
        (v_date + 1 + time '12:00') at time zone 'Europe/Athens', v_manager)
      returning id into v_meeting;
      insert into public.quality_department_meeting_topics (organization_id, meeting_id, position, subject, discussion, conclusion)
      values (v_org, v_meeting, 0, 'Συρροή CPE στη ΜΕΘ', 'Τρεις ασθενείς με CPE μέσα σε δέκα ημέρες, όλοι στην ίδια πτέρυγα.', 'Κοόρτη των ασθενών με αφιερωμένο προσωπικό και εβδομαδιαίος έλεγχος όλων των ασθενών.')
      returning id into v_t1;
      insert into public.quality_department_meeting_topics (organization_id, meeting_id, position, subject, discussion, conclusion)
      values (v_org, v_meeting, 1, 'Καθαρισμός και απολύμανση εξοπλισμού', 'Ο υπερηχογράφος μετακινείται μεταξύ των θαλάμων χωρίς απολύμανση.', 'Απολύμανση μετά από κάθε χρήση, με καταγραφή.')
      returning id into v_t2;
      select c.id into v_capa from public.quality_capa_actions c where c.organization_id = v_org and c.code like 'CAPA-OUT-%' order by c.code limit 1;
      insert into public.quality_department_meeting_decisions (organization_id, meeting_id, position, topic_id, title, owner_label, due_date, status, capa_id, carried_from)
      values (v_org, v_meeting, 0, v_t1, 'Κοόρτη ασθενών με CPE και αφιερωμένο προσωπικό', v_manager, d0 + 5, 'open', v_capa, null),
        (v_org, v_meeting, 1, v_t2, 'Απολύμανση του υπερηχογράφου μετά από κάθε χρήση', 'Ομάδα Πρόληψης Λοιμώξεων', d0 - 2, 'open', null, null),
        (v_org, v_meeting, 2, null, (select d.title from public.quality_department_meeting_decisions d join public.quality_department_meetings m on m.id = d.meeting_id
            where m.organization_id = v_org and m.group_id = v_group and m.code = v_prev_code and d.position = 0), v_manager, d0 + 20, 'open', null, v_prev_code);
      insert into public.quality_department_meeting_participants (organization_id, meeting_id, position, name, role, attended, employee_id)
      select v_org, v_meeting, (row_number() over (order by e.employee_code))::integer - 1, e.first_name || ' ' || e.last_name, e.position_name, true, e.id
      from public.employees e where e.organization_id = v_org and e.department_id = v_dep;
      insert into public.quality_department_meeting_participants (organization_id, meeting_id, position, name, role, attended)
      values (v_org, v_meeting, 10, 'Ιατρός Λοιμώξεων', 'Επιτροπή Λοιμώξεων', true), (v_org, v_meeting, 11, 'Υπεύθυνος Ποιότητας', 'Ποιότητα', true);
    end if;
  end loop;
end;
$function$;
revoke all on function private.demo_seed_quality_meetings(uuid) from public, anon, authenticated;

-- The management review: last year's, approved and signed, and this year's, being written.
create or replace function private.demo_seed_quality_reviews(v_org uuid)
returns void language plpgsql set search_path = ''
as $function$
declare
  d0 date := current_date;
  v_year integer := extract(year from current_date)::integer;
  v_last date := make_date(extract(year from current_date)::integer - 1, 12, 12);
  v_keys text[] := array['previous_actions', 'context_changes', 'satisfaction', 'objectives', 'process_performance', 'nonconformities', 'monitoring', 'audits',
    'providers', 'risks', 'resources', 'climate', 'compliance', 'adverse_events', 'improvements', 'conclusions'];
  v_titles text[] := array['Ανασκόπηση Ενεργειών Προηγούμενων Συνεδριάσεων', 'Αλλαγές σε Εξωτερικά και Εσωτερικά Ζητήματα που Αφορούν το Σύστημα Διαχείρισης Ποιότητας',
    'Ικανοποίηση Ασθενών και Ανατροφοδότηση από τα Ενδιαφερόμενα Μέρη', 'Βαθμός Επίτευξης των Στόχων Ποιότητας', 'Επίδοση Διεργασιών και Συμμόρφωση των Παρεχόμενων Υπηρεσιών',
    'Μη Συμμορφώσεις και Διορθωτικές Ενέργειες', 'Αποτελέσματα Παρακολούθησης και Μέτρησης', 'Αποτελέσματα Εσωτερικών, Εξωτερικών και Κανονιστικών Επιθεωρήσεων',
    'Επίδοση Εξωτερικών Παρόχων', 'Αποτελεσματικότητα Ενεργειών Αντιμετώπισης Κινδύνων και Αξιοποίησης Ευκαιριών', 'Επάρκεια και Διαθεσιμότητα Απαιτούμενων Πόρων',
    'Κλιματική Αλλαγή – Υπολογισμός Ανθρακικού Αποτυπώματος', 'Συμμόρφωση με Νομοθετικές και Κανονιστικές Απαιτήσεις', 'Αναφορά και Διαχείριση Ανεπιθύμητων Συμβάντων',
    'Ευκαιρίες προς Βελτίωση', 'Γενικά Συμπεράσματα Ανασκόπησης Διοίκησης'];
  v_before text[] := array[
    'Από τις ενέργειες της προηγούμενης ανασκόπησης ολοκληρώθηκαν όλες εκτός από τη μετάβαση των ελέγχων των τμημάτων στην πλατφόρμα, που συνεχίζεται.',
    'Νέα εγκύκλιος για την επιτήρηση των πολυανθεκτικών μικροοργανισμών· αυξημένη πληρότητα της Παθολογικής το φθινόπωρο.',
    'Η συνολική ικανοποίηση ασθενών ήταν 86% (στόχος 85%)· η ικανοποίηση από τη διατροφή 76%, κάτω από τον στόχο του 80%.',
    'Οι περισσότεροι στόχοι του έτους επιτεύχθηκαν· υστέρησαν οι πτώσεις ασθενών στην Παθολογική, η εκτίμηση κινδύνου πτώσης στην Καρδιολογική και το κλείσιμο διορθωτικών ενεργειών εντός προθεσμίας.',
    'Οι διεργασίες των κλινικών τμημάτων λειτούργησαν σύμφωνα με το σχέδιο· οι έλεγχοι των τμημάτων τηρήθηκαν σε ποσοστό 92%.',
    'Οι μη συμμορφώσεις των επιθεωρήσεων αφορούσαν κυρίως την τεκμηρίωση· οι διορθωτικές ενέργειες έκλεισαν στο μεγαλύτερο μέρος τους.',
    'Οι δείκτες λοιμώξεων ήταν εντός των ορίων· η συμμόρφωση στην υγιεινή χεριών ξεπέρασε το 80%.',
    'Ολοκληρώθηκαν οι εσωτερικές επιθεωρήσεις του προγράμματος· η εξωτερική επιθεώρηση επιτήρησης έκλεισε χωρίς μείζονες μη συμμορφώσεις.',
    'Αξιολογήθηκαν οι κρίσιμοι προμηθευτές· ένας προμηθευτής τροφίμων τέθηκε σε επιτήρηση λόγω αποκλίσεων θερμοκρασίας κατά την παραλαβή.',
    'Το μητρώο κινδύνων επανεξετάστηκε· ο κίνδυνος πτώσεων στην Ορθοπαιδική μειώθηκε μετά τα μέτρα.',
    'Χρειάζεται ενίσχυση του νοσηλευτικού προσωπικού της ΜΕΘ και αντικατάσταση δύο ογκομετρικών αντλιοδοτών.',
    'Το ανθρακικό αποτύπωμα υπολογίστηκε για πρώτη φορά· προτεραιότητα η μείωση της κατανάλωσης ενέργειας στους ψύκτες.',
    'Δεν εντοπίστηκαν αποκλίσεις από τη νομοθεσία· ενημερώθηκε το μητρώο νομοθετικών απαιτήσεων.',
    'Τα περισσότερα ανεπιθύμητα συμβάντα ήταν πτώσεις και συμβάντα φαρμάκων· κανένα δεν προκάλεσε μόνιμη βλάβη.',
    'Ψηφιακή καταγραφή των ελέγχων των τμημάτων και ενιαίο πρόγραμμα εκπαίδευσης του νέου προσωπικού.',
    'Το Σύστημα Διαχείρισης Ποιότητας παραμένει κατάλληλο, επαρκές και αποτελεσματικό.'];
  -- This year's review: the first sections written, the rest still empty.
  v_now text[] := array[
    'Ολοκληρώθηκαν οι τρεις από τις τέσσερις ενέργειες της προηγούμενης ανασκόπησης· η ενίσχυση του προσωπικού της ΜΕΘ μεταφέρεται.',
    'Νέες απαιτήσεις για την αναφορά των λοιμώξεων· έναρξη λειτουργίας της ανακαινισμένης Χειρουργικής.',
    'Η ικανοποίηση ασθενών κινείται κοντά στον στόχο· η ικανοποίηση από τη διατροφή παραμένει χαμηλότερα.',
    'Οι στόχοι του έτους παρακολουθούνται μήνα προς μήνα· εκτός στόχου οι πτώσεις στην Παθολογική και το κλείσιμο διορθωτικών ενεργειών εντός προθεσμίας.',
    'Οι διεργασίες λειτουργούν σύμφωνα με το σχέδιο.',
    'Η συρροή CPE στη ΜΕΘ οδήγησε σε διορθωτικές ενέργειες που βρίσκονται σε εξέλιξη.',
    'Η συμμόρφωση στην υγιεινή χεριών και στις δέσμες μέτρων παρακολουθείται μηνιαία.',
    'Το πρόγραμμα εσωτερικών επιθεωρήσεων του έτους έχει ολοκληρωθεί κατά το μεγαλύτερο μέρος.',
    'Ο προμηθευτής τροφίμων που ήταν σε επιτήρηση βελτίωσε τις παραλαβές του.',
    '', '', '', '', '', '', ''];
  v_people text[] := array[array['Διοικητής', 'Διοίκηση'], array['Διευθυντής Ιατρικής Υπηρεσίας', 'Ιατρική Υπηρεσία'], array['Διευθύντρια Νοσηλευτικής Υπηρεσίας', 'Νοσηλευτική Υπηρεσία'],
    array['Υπεύθυνος Ποιότητας', 'Ποιότητα'], array['Πρόεδρος Επιτροπής Λοιμώξεων', 'Επιτροπή Λοιμώξεων']];
  v_review uuid; v_approved timestamptz := (v_last + 5 + time '12:00') at time zone 'Europe/Athens';
begin
  insert into public.quality_management_reviews (organization_id, code, title, review_date, period_from, period_to, frequency_days, next_review_date, status, summary, approved_at, approved_by_label)
  values (v_org, 'MR-' || (v_year - 1) || '-01', 'Ανασκόπηση Διοίκησης ' || (v_year - 1), v_last, make_date(v_year - 1, 1, 1), v_last, 365, v_last + 365, 'approved',
    'Το σύστημα λειτουργεί αποτελεσματικά· προτεραιότητες η πρόληψη πτώσεων και η ικανοποίηση από τη διατροφή.', v_approved, 'Διοικητής')
  returning id into v_review;
  insert into public.quality_management_review_sections (organization_id, review_id, key, position, title, body)
  select v_org, v_review, v_keys[s.k], s.k - 1, v_titles[s.k], v_before[s.k] from generate_series(1, 16) s(k);
  insert into public.quality_management_review_actions (organization_id, review_id, position, section_key, title, owner_label, due_date, status)
  values (v_org, v_review, 0, 'improvements', 'Μετάβαση των ελέγχων των τμημάτων στην πλατφόρμα', 'Ομάδα Ποιότητας', v_last + 60, 'done'),
    (v_org, v_review, 1, 'resources', 'Ενίσχυση του νοσηλευτικού προσωπικού της ΜΕΘ με δύο νοσηλευτές', 'Διεύθυνση Νοσηλευτικής Υπηρεσίας', v_last + 120, 'open'),
    (v_org, v_review, 2, 'satisfaction', 'Βελτίωση της θερμοκρασίας του φαγητού κατά το σερβίρισμα', 'Υπεύθυνη Κουζίνας', v_last + 90, 'done'),
    (v_org, v_review, 3, 'objectives', 'Πρόγραμμα πρόληψης πτώσεων στην Παθολογική', 'Προϊστάμενος Παθολογικής', v_last + 90, 'done');
  insert into public.quality_management_review_participants (organization_id, review_id, position, name, role, attended, signed_at)
  select v_org, v_review, s.k - 1, v_people[s.k][1], v_people[s.k][2], s.k <> 5, case when s.k <> 5 then v_approved end from generate_series(1, 5) s(k);

  insert into public.quality_management_reviews (organization_id, code, title, review_date, period_from, period_to, frequency_days, next_review_date, status)
  values (v_org, 'MR-' || v_year || '-01', 'Ανασκόπηση Διοίκησης ' || v_year, d0 - 4, v_last + 1, d0 - 4, 365, d0 - 4 + 365, 'draft')
  returning id into v_review;
  insert into public.quality_management_review_sections (organization_id, review_id, key, position, title, body)
  select v_org, v_review, v_keys[s.k], s.k - 1, v_titles[s.k], nullif(v_now[s.k], '') from generate_series(1, 16) s(k);
  insert into public.quality_management_review_actions (organization_id, review_id, position, section_key, title, owner_label, due_date, status)
  values (v_org, v_review, 0, 'resources', 'Ενίσχυση του νοσηλευτικού προσωπικού της ΜΕΘ με δύο νοσηλευτές', 'Διεύθυνση Νοσηλευτικής Υπηρεσίας', v_last + 120, 'open'),
    (v_org, v_review, 1, 'providers', 'Επαναξιολόγηση του προμηθευτή τροφίμων που ήταν σε επιτήρηση', 'Υπεύθυνος Ποιότητας', d0 + 45, 'open'),
    (v_org, v_review, 2, 'nonconformities', 'Κλείσιμο των διορθωτικών ενεργειών εντός προθεσμίας: εβδομαδιαία παρακολούθηση', 'Ομάδα Ποιότητας', d0 + 60, 'open');
  insert into public.quality_management_review_participants (organization_id, review_id, position, name, role, attended)
  select v_org, v_review, s.k - 1, v_people[s.k][1], v_people[s.k][2], true from generate_series(1, 5) s(k);
end;
$function$;
revoke all on function private.demo_seed_quality_reviews(uuid) from public, anon, authenticated;

-- The quality objectives of this year and last year: five on the platform's indicators (their
-- value comes from the hospital's data) and seven measured by a value per month, entered by
-- their owner; some on target, some not. Last year's are closed as achieved or not.
create or replace function private.demo_seed_quality_objectives(v_org uuid)
returns void language plpgsql set search_path = ''
as $function$
declare
  v_year integer := extract(year from current_date)::integer;
  v_months integer := extract(month from current_date)::integer - 1;
  r record; v_id uuid; v_past numeric[]; v_mean numeric; y integer;
begin
  for r in
    select * from (values
      (1, 'hospital', null, null, 'patient-satisfaction', 'Συνολική ικανοποίηση ασθενών ≥ 85%', 'Overall patient satisfaction ≥ 85%', 85::numeric, 'higher', '%', 'Υπεύθυνος Ποιότητας', null::numeric[], 0::numeric),
      (2, 'hospital', null, null, 'food-satisfaction', 'Ικανοποίηση από τη διατροφή ≥ 80%', 'Satisfaction with the food ≥ 80%', 80, 'higher', '%', 'Υπεύθυνη Κουζίνας', null, 0),
      (3, 'hospital', null, null, 'hh-compliance', 'Συμμόρφωση στην υγιεινή των χεριών ≥ 80%', 'Hand hygiene compliance ≥ 80%', 80, 'higher', '%', 'Νοσηλευτής/τρια Επιτήρησης Λοιμώξεων', null, 0),
      (4, 'hospital', null, null, 'bundle-compliance', 'Συμμόρφωση στις δέσμες μέτρων ≥ 95%', 'Bundle compliance ≥ 95%', 95, 'higher', '%', 'Επιτροπή Λοιμώξεων', null, 0),
      (5, 'hospital', null, null, 'training-completion', 'Ολοκλήρωση της υποχρεωτικής εκπαίδευσης ≥ 90%', 'Mandatory training completion ≥ 90%', 90, 'higher', '%', 'Υπεύθυνος Εκπαίδευσης', null, 0),
      (6, 'department', 'ΜΕΘ', null, null, 'Αφαίρεση περιττού κεντρικού φλεβικού καθετήρα εντός 24 ωρών ≥ 95%', 'Unneeded central line removed within 24 hours ≥ 95%', 95, 'higher', '%', 'Διευθυντής ΜΕΘ',
        array[96, 94, 97, 95, 93, 96, 97, 95, 96, 98, 97, 96]::numeric[], 0.5),
      (7, 'department', 'ΠΑΘ', null, null, 'Πτώσεις ασθενών ≤ 1,5 ανά 1.000 ημέρες νοσηλείας', 'Patient falls ≤ 1.5 per 1,000 patient days', 1.5, 'lower', 'ανά 1.000 ημέρες νοσηλείας', 'Προϊστάμενος Παθολογικής',
        array[1.8, 1.4, 2.1, 1.6, 1.9, 1.2, 1.7, 2.0, 1.5, 1.8, 1.6, 1.5]::numeric[], 0.3),
      (8, 'department', 'ΧΕΙΡ', null, null, 'Χρήση της λίστας ασφαλούς χειρουργείου ≥ 98%', 'Surgical safety checklist used ≥ 98%', 98, 'higher', '%', 'Διευθυντής Χειρουργικής',
        array[99, 98, 100, 99, 97, 99, 100, 98, 99, 100, 99, 100]::numeric[], 0.5),
      (9, 'department', 'ΚΑΡΔ', null, null, 'Εκτίμηση κινδύνου πτώσης κατά την εισαγωγή ≥ 95%', 'Fall risk assessed on admission ≥ 95%', 95, 'higher', '%', 'Προϊστάμενος Καρδιολογικής',
        array[88, 90, 91, 93, 92, 94, 95, 96, 95, 97, 96, 97]::numeric[], 4),
      (10, 'committee', null, 'COM-001', null, 'Κατανάλωση αλκοολούχου αντισηπτικού ≥ 20 L ανά 1.000 ημέρες νοσηλείας', 'Alcohol hand rub ≥ 20 L per 1,000 patient days', 20, 'higher', 'L/1.000 ημέρες νοσηλείας', 'Επιτροπή Λοιμώξεων',
        array[18.2, 19.5, 21.0, 20.4, 22.1, 19.8, 20.9, 21.5, 22.0, 21.2, 21.8, 22.4]::numeric[], 0.5),
      (11, 'committee', null, 'COM-002', null, 'Κλείσιμο διορθωτικών ενεργειών εντός προθεσμίας ≥ 85%', 'Corrective actions closed on time ≥ 85%', 85, 'higher', '%', 'Επιτροπή Ποιότητας και Ασφάλειας Ασθενών',
        array[78, 82, 80, 84, 79, 83, 86, 81, 85, 82, 84, 86]::numeric[], 3),
      (12, 'hospital', null, null, null, 'Αποτέλεσμα καλλιέργειας αίματος σε ≤ 72 ώρες', 'Blood culture result in ≤ 72 hours', 72, 'lower', 'ώρες', 'Υπεύθυνος Μικροβιολογικού Εργαστηρίου',
        array[70, 68, 74, 71, 66, 69, 73, 67, 65, 68, 66, 64]::numeric[], 1)
    ) as t(n, level, dep_code, com_code, platform_key, title, title_en, target, direction, unit, owner, vals, past_delta)
  loop
    for y in reverse v_year..v_year - 1 loop
      v_past := case when r.vals is null then null when y = v_year then r.vals[1:greatest(v_months, 0)]
        else array(select v + case when r.direction = 'lower' then r.past_delta else -r.past_delta end from unnest(r.vals) v) end;
      v_mean := (select avg(v) from unnest(v_past) v);
      insert into public.quality_objectives (organization_id, code, year, level, title, title_en, description, department_id, committee_id, platform_indicator_key,
        target, direction, unit, owner_label, due_date, status)
      values (v_org, 'QO-' || y || '-' || lpad(r.n::text, 2, '0'), y, r.level, r.title, r.title_en,
        case when r.platform_key is null then 'Μετριέται μήνα προς μήνα από τον υπεύθυνο του στόχου.' else 'Η τιμή υπολογίζεται από τα δεδομένα της πλατφόρμας.' end,
        (select d.id from public.departments d where d.organization_id = v_org and d.code = r.dep_code),
        (select c.id from public.committees c where c.organization_id = v_org and c.code = r.com_code),
        r.platform_key, r.target, r.direction, r.unit, r.owner, make_date(y, 12, 31),
        case when y = v_year or v_mean is null then 'active' when (r.direction = 'lower' and v_mean <= r.target) or (r.direction = 'higher' and v_mean >= r.target) then 'achieved' else 'not_achieved' end)
      returning id into v_id;
      if v_past is not null then
        insert into public.quality_objective_values (organization_id, objective_id, month, value)
        select v_org, v_id, make_date(y, m::integer, 1), v from unnest(v_past) with ordinality as u(v, m);
      end if;
    end loop;
  end loop;
end;
$function$;
revoke all on function private.demo_seed_quality_objectives(uuid) from public, anon, authenticated;

-- The departments' self-assessments on the ward checklist (the system questionnaire «ward»):
-- three rounds answered, submitted and closed, the scores improving from round to round, and
-- the current round under way (one submitted, one half answered, one not started, one draft).
create or replace function private.demo_seed_quality_self_assessments(v_org uuid, p_actor uuid)
returns void language plpgsql set search_path = ''
as $function$
declare
  d0 date := current_date;
  v_template uuid; v_standard text;
  v_deps text[] := array['ΜΕΘ', 'ΠΑΘ', 'ΧΕΙΡ', 'ΚΑΡΔ', 'ΟΡΘ', 'ΜΕΝΝ'];
  -- (round, days before today it was released, departments, answer quality)
  v_rounds text[] := array[array['r1', '600', '6', '0.78'], array['r2', '400', '4', '0.84'], array['r3', '240', '6', '0.88'], array['r4', '12', '4', '0.9']];
  v_partial text[] := array['Λείπει η υπογραφή σε δύο ημέρες.', 'Εφαρμόζεται, αλλά δεν καταγράφεται πάντα.', 'Μερική ενημέρωση του νέου προσωπικού.'];
  v_no text[] := array['Δεν βρέθηκε καταγραφή τον τελευταίο μήνα.', 'Το έντυπο δεν είναι διαθέσιμο στο τμήμα.'];
  k integer; j integer; v_released date; v_status text; v_share double precision; v_quality double precision; v_title text; v_key text;
  v_dep uuid; v_dep_name text; v_checklist jsonb; v_total integer; v_answered integer; v_score integer; v_submitted timestamptz;
begin
  select t.id, t.standard into v_template, v_standard from public.quality_audit_templates t where t.organization_id is null and t.template_key = 'ward' and t.active order by t.version desc limit 1;
  if v_template is null then return; end if;
  for k in 1..4 loop
    v_released := d0 - v_rounds[k][2]::integer;
    v_quality := v_rounds[k][4]::double precision;
    v_title := 'Αυτοαξιολόγηση ' || case when extract(month from v_released) <= 6 then 'Α΄' else 'Β΄' end || ' εξαμήνου ' || extract(year from v_released)::integer;
    for j in 1..v_rounds[k][3]::integer loop
      select d.id, d.name into v_dep, v_dep_name from public.departments d where d.organization_id = v_org and d.code = v_deps[j];
      if v_dep is null then continue; end if;
      v_status := case when k < 3 then 'closed' when k = 3 then case when j <= 4 then 'closed' else 'submitted' end else (array['submitted', 'released', 'released', 'draft'])[j] end;
      v_share := case when v_status = 'draft' then 0 when v_status = 'released' then case when j = 3 then 0 else 0.55 end else 1 end;
      v_key := v_org::text || '|self|' || k || '|' || j;
      with q as (
        select tq.*, row_number() over (order by tq.position) as rn,
          private.demo_unit_random(v_key || '|a|' || tq.id) as ra, private.demo_unit_random(v_key || '|b|' || tq.id) as rb, private.demo_unit_random(v_key || '|c|' || tq.id) as rc
        from public.quality_audit_template_questions tq where tq.template_id = v_template
      ), a as (
        select q.*, case when q.ra >= v_share then '' when q.rb < v_quality then 'yes' when q.rb < v_quality + (1 - v_quality) * 0.55 then 'partial' when q.rb < 0.97 then 'no' else 'na' end as answer
        from q
      )
      select jsonb_agg(jsonb_build_object('id', 'q-' || a.id, 'templateQuestionId', a.id, 'position', a.rn, 'chapterRef', a.chapter_ref, 'chapterTitle', coalesce(a.chapter_title, ''),
          'clauseRef', a.clause_ref, 'item', a.question, 'itemEn', a.question, 'guidance', coalesce(a.guidance, ''), 'evidenceRequired', coalesce(a.evidence, ''),
          'weight', case when a.weight > 0 then a.weight else 1 end, 'critical', a.critical, 'required', true, 'answer', a.answer,
          'note', case a.answer when 'partial' then v_partial[1 + floor(a.rc * 3)::integer] when 'no' then v_no[1 + floor(a.rc * 2)::integer] else '' end,
          'evidence', '', 'findingClass', '', 'adHoc', false) order by a.rn),
        count(*), count(*) filter (where a.answer <> ''),
        round(100 * sum(case a.answer when 'yes' then 1 when 'partial' then 0.5 else 0 end * case when a.weight > 0 then a.weight else 1 end)
          / nullif(sum(case when a.answer in ('yes', 'partial', 'no') then case when a.weight > 0 then a.weight else 1 end else 0 end), 0))
      into v_checklist, v_total, v_answered, v_score
      from a;
      v_submitted := case when v_status in ('submitted', 'closed') then (v_released + 12 + j * 3 + time '11:00') at time zone 'Europe/Athens' end;
      insert into public.quality_self_assessments (organization_id, template_id, standard, title, department_id, department_name, status, due_on, released_at, released_by,
        submitted_at, submitted_by, checklist, total_count, answered_count, score, created_by, updated_by, created_at)
      values (v_org, v_template, v_standard, v_title, v_dep, v_dep_name, v_status, v_released + case when k = 4 then 30 else 28 end,
        case when v_status <> 'draft' then (v_released + time '08:00') at time zone 'Europe/Athens' end, case when v_status <> 'draft' then p_actor end,
        v_submitted, case when v_submitted is not null then p_actor end, v_checklist, v_total, v_answered, case when v_answered > 0 then v_score end,
        p_actor, p_actor, (v_released - 3 + time '10:00') at time zone 'Europe/Athens');
    end loop;
  end loop;
end;
$function$;
revoke all on function private.demo_seed_quality_self_assessments(uuid, uuid) from public, anon, authenticated;

-- The answers of a satisfaction survey, from its own questions: p_count responses over the
-- last p_days days, most of them satisfied (4–5), the food a little less, a few unhappy ones.
create or replace function private.demo_seed_survey_answers(v_org uuid, p_survey uuid, p_count integer, p_days integer, p_departments uuid[])
returns void language plpgsql set search_path = ''
as $function$
declare
  v_questions jsonb; q jsonb; i integer; v_key text; r double precision; v_mood double precision; v_sat double precision; v_answers jsonb; v_value jsonb; v_options jsonb;
  v_comments text[] := array['Ευχαριστώ το νοσηλευτικό προσωπικό για τη φροντίδα.', 'Πολύ καλή εξυπηρέτηση από όλους.', 'Θόρυβος στον διάδρομο τη νύχτα.',
    'Το φαγητό ήταν συχνά κρύο.', 'Καθαρό δωμάτιο, ευγενικό προσωπικό.', 'Αργή διαδικασία στο εξιτήριο.'];
  v_missing text[] := array['Ασύρματο δίκτυο στα δωμάτια', 'Χώρος στάθμευσης για τους συνοδούς', 'Καφετέρια ανοιχτή τα απογεύματα'];
  v_day date; v_n integer := coalesce(array_length(p_departments, 1), 0);
begin
  select s.questions into v_questions from public.quality_surveys s where s.id = p_survey and s.organization_id = v_org;
  if v_questions is null then return; end if;
  for i in 1..p_count loop
    v_key := p_survey::text || '|response|' || i;
    v_mood := private.demo_unit_random(v_key || '|mood');
    v_day := current_date - 1 - floor(private.demo_unit_random(v_key || '|day') * greatest(p_days, 1))::integer;
    v_answers := '{}'::jsonb;
    for q in select value from jsonb_array_elements(v_questions) loop
      r := private.demo_unit_random(v_key || '|' || (q ->> 'id'));
      -- A question shown only after another's answer.
      if jsonb_typeof(q -> 'showWhen') = 'object' and (v_answers -> (q -> 'showWhen' ->> 'question')) is distinct from (q -> 'showWhen' -> 'value') then continue; end if;
      if coalesce((q ->> 'required')::boolean, false) = false and q ->> 'type' <> 'text' and private.demo_unit_random(v_key || '|skip|' || (q ->> 'id')) < 0.2 then continue; end if;
      v_value := null;
      if q ->> 'type' = 'rating' then
        v_sat := case when v_mood < 0.08 then 0.35 when q ->> 'section' = 'food' then 0.76 else 0.92 end;
        v_value := to_jsonb(case when r < v_sat * 0.55 then 5 when r < v_sat then 4 when r < v_sat + (1 - v_sat) * 0.6 then 3 when r < v_sat + (1 - v_sat) * 0.9 then 2 else 1 end);
      elsif q ->> 'type' = 'nps' then
        v_value := to_jsonb(case when v_mood < 0.08 then 2 + floor(r * 5)::integer else least(10, 6 + floor(r * 5)::integer) end);
      elsif q ->> 'type' = 'yesno' then
        v_value := to_jsonb(case when q ->> 'id' = 'technical' then r < 0.15 else r < case when v_mood < 0.08 then 0.5 else 0.93 end end);
      elsif q ->> 'type' in ('single', 'multiple') then
        v_options := q -> 'options';
        if jsonb_array_length(v_options) > 0 then
          v_value := v_options -> floor(r * jsonb_array_length(v_options))::integer -> 'value';
          if q ->> 'type' = 'multiple' then v_value := jsonb_build_array(v_value); end if;
        end if;
      elsif q ->> 'type' = 'text' and r < 0.18 then
        v_value := to_jsonb(case when q ->> 'id' = 'missing' then v_missing[1 + floor(private.demo_unit_random(v_key || '|t') * 3)::integer]
          else v_comments[1 + floor(private.demo_unit_random(v_key || '|t') * 6)::integer] end);
      end if;
      if v_value is not null then v_answers := v_answers || jsonb_build_object(q ->> 'id', v_value); end if;
    end loop;
    insert into public.quality_survey_responses (organization_id, survey_id, department_id, channel, answers, submitted_at, entered_by)
    values (v_org, p_survey, case when v_n > 0 then p_departments[1 + i % v_n] end,
      case when private.demo_unit_random(v_key || '|ch') < 0.5 then 'paper' when private.demo_unit_random(v_key || '|ch') < 0.8 then 'tablet' else 'link' end,
      v_answers, (v_day + time '09:00' + make_interval(mins => floor(private.demo_unit_random(v_key || '|t') * 540)::integer)) at time zone 'Europe/Athens', null);
  end loop;
end;
$function$;
revoke all on function private.demo_seed_survey_answers(uuid, uuid, integer, integer, uuid[]) from public, anon, authenticated;

-- The ward questionnaire (the «wards» template of src/features/quality/surveys/surveyModel.js)
-- when the Demo has none, with sixty answers over the last six months; any other patients'
-- survey of the Demo without answers gets twenty-five since it opened.
create or replace function private.demo_seed_quality_survey_responses(v_org uuid)
returns void language plpgsql set search_path = ''
as $function$
declare
  d0 date := current_date;
  v_name text; v_survey uuid; v_deps uuid[]; v_code text; r record;
  v_sections jsonb := '[
    {"key":"about","label":"Λίγα λόγια για εσάς","labelEn":"About you"},
    {"key":"choice","label":"Η επιλογή του νοσοκομείου","labelEn":"Choosing the hospital"},
    {"key":"reception","label":"Υποδοχή","labelEn":"Reception"},
    {"key":"floor","label":"Φροντίδα στον όροφο","labelEn":"Care on the floor"},
    {"key":"food","label":"Διατροφή","labelEn":"Food"},
    {"key":"room","label":"Δωμάτιο και επισκεπτήριο","labelEn":"Room and visits"},
    {"key":"services","label":"Υπηρεσίες","labelEn":"Services"},
    {"key":"overall","label":"Συνολικά","labelEn":"Overall"},
    {"key":"information","label":"Ενημέρωση","labelEn":"Information"},
    {"key":"comments","label":"Σχόλια","labelEn":"Comments"}]'::jsonb;
  v_questions jsonb := '[
    {"id":"nationality","section":"about","type":"single","label":"Υπηκοότητα","labelEn":"Nationality","required":false,"options":[{"value":"greek","label":"Ελληνική","labelEn":"Greek"},{"value":"other","label":"Άλλη","labelEn":"Other"}]},
    {"id":"sex","section":"about","type":"single","label":"Φύλο","labelEn":"Sex","required":false,"options":[{"value":"male","label":"Άνδρας","labelEn":"Man"},{"value":"female","label":"Γυναίκα","labelEn":"Woman"}]},
    {"id":"age","section":"about","type":"single","label":"Ηλικία","labelEn":"Age","required":false,"options":[{"value":"to25","label":"Έως 25","labelEn":"Up to 25"},{"value":"26_45","label":"26–45","labelEn":"26–45"},{"value":"46_65","label":"46–65","labelEn":"46–65"},{"value":"66plus","label":"66+","labelEn":"66+"}]},
    {"id":"occupation","section":"about","type":"single","label":"Επάγγελμα","labelEn":"Occupation","required":false,"options":[{"value":"public","label":"Δημόσιος υπάλληλος","labelEn":"Civil servant"},{"value":"private","label":"Ιδιωτικός υπάλληλος","labelEn":"Private employee"},{"value":"self","label":"Ελεύθερος επαγγελματίας","labelEn":"Self-employed"},{"value":"home","label":"Οικιακά","labelEn":"Homemaker"},{"value":"retired","label":"Συνταξιούχος","labelEn":"Retired"},{"value":"student","label":"Φοιτητής/τρια","labelEn":"Student"},{"value":"unemployed","label":"Άνεργος/η","labelEn":"Unemployed"},{"value":"other","label":"Άλλο","labelEn":"Other"}]},
    {"id":"reason","section":"choice","type":"single","label":"Ο λόγος που επιλέξατε το {hospital}","labelEn":"Why you chose {hospital}","required":false,"options":[{"value":"reputation","label":"Η φήμη του","labelEn":"Its reputation"},{"value":"others","label":"Σύσταση τρίτων","labelEn":"Recommended by others"},{"value":"doctor","label":"Σύσταση ιατρού","labelEn":"Recommended by a doctor"},{"value":"care","label":"Υψηλή φροντίδα νοσηλείας","labelEn":"High standard of care"}]},
    {"id":"heard","section":"choice","type":"single","label":"Πώς ενημερωθήκατε για το {hospital};","labelEn":"How did you hear about {hospital}?","required":false,"options":[{"value":"doctor","label":"Από τον ιατρό μου","labelEn":"From my doctor"},{"value":"friends","label":"Από φιλικό ή συγγενικό πρόσωπο","labelEn":"From a friend or relative"},{"value":"ads","label":"Από διαφήμιση, προωθητικές ενέργειες, ΜΜΕ","labelEn":"From advertising or the media"},{"value":"insurer","label":"Από την ασφαλιστική μου","labelEn":"From my insurer"}]},
    {"id":"admission_process","section":"reception","type":"rating","label":"Η διαδικασία εισαγωγής στο τμήμα Υποδοχής","labelEn":"The admission process at Reception","required":true,"options":[],"scale":"rating"},
    {"id":"reception_staff","section":"reception","type":"rating","label":"Η συμπεριφορά του προσωπικού της Υποδοχής","labelEn":"The behaviour of the Reception staff","required":true,"options":[],"scale":"rating"},
    {"id":"nursing","section":"floor","type":"rating","label":"Οι υπηρεσίες του νοσηλευτικού προσωπικού στον όροφο, συνολικά","labelEn":"The nursing staff’s services on the floor, overall","required":true,"options":[],"scale":"rating"},
    {"id":"doctors","section":"floor","type":"rating","label":"Οι επισκέψεις των ιατρών και η πληροφόρηση που σας παρείχαν","labelEn":"The doctors’ visits and the information they gave","required":true,"options":[],"scale":"rating"},
    {"id":"physiotherapy","section":"floor","type":"rating","label":"Η ομάδα των Φυσικοθεραπευτών (αν σας παρασχέθηκε φυσικοθεραπεία)","labelEn":"The physiotherapy team (if you had physiotherapy)","required":false,"options":[],"scale":"rating"},
    {"id":"food_quality","section":"food","type":"rating","label":"Η ποιότητα του φαγητού (αν δεν ακολουθήσατε ειδική δίαιτα)","labelEn":"The quality of the food (if you were not on a special diet)","required":false,"options":[],"scale":"rating"},
    {"id":"food_service","section":"food","type":"rating","label":"Η εξυπηρέτηση των τραπεζοκόμων","labelEn":"The service of the catering staff","required":false,"options":[],"scale":"rating"},
    {"id":"cleanliness","section":"room","type":"rating","label":"Η καθαριότητα του δωματίου","labelEn":"The cleanliness of the room","required":true,"options":[],"scale":"rating"},
    {"id":"visitors","section":"room","type":"rating","label":"Το επισκεπτήριο: ο αριθμός επισκεπτών στο δωμάτιο","labelEn":"Visiting: the number of visitors in the room","required":true,"options":[],"scale":"rating"},
    {"id":"visiting_hours","section":"room","type":"rating","label":"Το επισκεπτήριο: η τήρηση του ωραρίου","labelEn":"Visiting: keeping to the visiting hours","required":true,"options":[],"scale":"rating"},
    {"id":"technical","section":"room","type":"yesno","label":"Αντιμετωπίσατε τεχνικά προβλήματα (κλιματισμός, φώτα κ.λπ.) κατά την παραμονή σας;","labelEn":"Did you have technical problems (air conditioning, lights, etc.) during your stay?","required":true,"options":[]},
    {"id":"technical_fix","section":"room","type":"rating","label":"Εάν ναι, η επίλυσή τους ήταν:","labelEn":"If so, they were solved:","required":false,"options":[],"scale":"speed","showWhen":{"question":"technical","value":true}},
    {"id":"accounting","section":"services","type":"rating","label":"Η εξυπηρέτηση από το Λογιστήριο Ασθενών","labelEn":"The service of the Patient Accounts office","required":true,"options":[],"scale":"rating"},
    {"id":"overall","section":"overall","type":"rating","label":"Συνολικά, η διαμονή σας στο {hospital} ήταν:","labelEn":"Overall, your stay at {hospital} was:","required":true,"options":[],"scale":"rating"},
    {"id":"previous","section":"overall","type":"single","label":"Σε σχέση με προηγούμενη νοσηλεία είστε:","labelEn":"Compared with a previous stay you are:","required":false,"options":[{"value":"more","label":"Περισσότερο ικανοποιημένοι","labelEn":"More satisfied"},{"value":"same","label":"Το ίδιο ικανοποιημένοι","labelEn":"As satisfied"},{"value":"less","label":"Λιγότερο ικανοποιημένοι","labelEn":"Less satisfied"},{"value":"first","label":"Νοσηλεύομαι πρώτη φορά","labelEn":"This is my first stay"}]},
    {"id":"info_staff","section":"information","type":"rating","label":"Η ενημέρωση για τις διαδικασίες της Κλινικής από το προσωπικό","labelEn":"Information on the clinic’s procedures from the staff","required":true,"options":[],"scale":"rating"},
    {"id":"info_leaflets","section":"information","type":"rating","label":"Η ενημέρωση από τα ενημερωτικά έντυπα","labelEn":"Information from the leaflets","required":false,"options":[],"scale":"rating"},
    {"id":"info_website","section":"information","type":"rating","label":"Η ενημέρωση από τον ιστότοπο","labelEn":"Information from the website","required":false,"options":[],"scale":"rating"},
    {"id":"recommend_yes","section":"overall","type":"yesno","label":"Θα συστήνατε το {hospital};","labelEn":"Would you recommend {hospital}?","required":true,"options":[]},
    {"id":"choose_again","section":"overall","type":"yesno","label":"Θα επιλέγατε ξανά το {hospital} στο μέλλον;","labelEn":"Would you choose {hospital} again?","required":true,"options":[]},
    {"id":"missing","section":"comments","type":"text","label":"Ελλείψεις υπηρεσιών που εντοπίσατε","labelEn":"Services you found missing","required":false,"options":[]},
    {"id":"comments","section":"comments","type":"text","label":"Σχόλια","labelEn":"Comments","required":false,"options":[]}]'::jsonb;
begin
  select o.name into v_name from public.organizations o where o.id = v_org;
  select array_agg(d.id order by d.code) into v_deps from public.departments d where d.organization_id = v_org and d.code in ('ΠΑΘ', 'ΧΕΙΡ', 'ΚΑΡΔ', 'ΟΡΘ', 'ΝΕΦ');
  select s.id into v_survey from public.quality_surveys s where s.organization_id = v_org and s.template_key = 'wards' order by s.created_at limit 1;
  if v_survey is null then
    v_code := 'SRV-' || extract(year from d0 - 180)::integer || '-' || lpad((coalesce((select max(substring(s.code from '^SRV-' || extract(year from d0 - 180)::integer || '-([0-9]+)$')::integer)
      from public.quality_surveys s where s.organization_id = v_org), 0) + 1)::text, 2, '0');
    insert into public.quality_surveys (organization_id, code, title, title_en, description, description_en, audience, template_key, department_ids, sections, questions,
      status, opens_on, satisfied_target)
    values (v_org, v_code, 'Ερωτηματολόγιο Νοσηλευτικού ορόφου', 'Ward questionnaire', 'Η γνώμη σας μάς βοηθά να βελτιώνουμε τις υπηρεσίες μας. Λίγα λεπτά, ανώνυμα.',
      'Your opinion helps us improve our services. A few minutes, anonymous.', 'patients', 'wards', coalesce(v_deps, '{}'), v_sections,
      replace(v_questions::text, '{hospital}', trim(both '"' from to_jsonb(coalesce(v_name, 'νοσοκομείο'))::text))::jsonb, 'open', d0 - 180, 80)
    returning id into v_survey;
  end if;
  perform private.demo_seed_survey_answers(v_org, v_survey, 60, 175, coalesce((select s.department_ids from public.quality_surveys s where s.id = v_survey and cardinality(s.department_ids) > 0), v_deps));
  -- The survey opens with its first answer.
  update public.quality_surveys s set opens_on = (select min(x.submitted_at at time zone 'Europe/Athens')::date from public.quality_survey_responses x where x.survey_id = s.id)
  where s.id = v_survey;
  for r in
    select s.id, s.opens_on, s.department_ids from public.quality_surveys s
    where s.organization_id = v_org and s.id <> v_survey and s.audience = 'patients' and s.status <> 'draft'
      and not exists (select 1 from public.quality_survey_responses x where x.survey_id = s.id)
  loop
    perform private.demo_seed_survey_answers(v_org, r.id, 25, greatest(coalesce(d0 - r.opens_on, 90), 7), case when cardinality(r.department_ids) > 0 then r.department_ids else v_deps end);
  end loop;
end;
$function$;
revoke all on function private.demo_seed_quality_survey_responses(uuid) from public, anon, authenticated;

-- The kitchen's recall drills: an older failed one (a dish, traced in 290′ against the
-- 4-hour target) and one this week (a supplier's chicken lot, traced in 95′, balance found).
-- The recent drill keeps only the counted stock, so its screen traces the Demo kitchen's batch.
create or replace function private.demo_seed_kitchen_recall_drills(v_org uuid)
returns void language plpgsql set search_path = ''
as $function$
declare
  d0 date := current_date;
  v_manager text := 'Ελένη Γεωργίου';
  v_item record; v_used numeric := 0; v_written numeric := 0; v_stock numeric; v_days integer := 0; v_meals integer := 0; v_portions integer := 0;
begin
  insert into public.kitchen_recall_drills (organization_id, code, drill_date, started_at, finished_at, scenario, trigger_text, dish_name, target_minutes, elapsed_minutes,
    received_quantity, used_quantity, stock_quantity, written_off_quantity, quantity_unit, accounted_percent, batches_count, affected_days, affected_meals, affected_portions,
    traced_within_target, trace_snapshot, notified, actions, result, lessons, conducted_by_name, status)
  values (v_org, 'ANK-0001', d0 - 220, (d0 - 220 + time '09:00') at time zone 'Europe/Athens', (d0 - 220 + time '13:50') at time zone 'Europe/Athens', 'dish',
    'Κρούσμα γαστρεντερίτιδας σε δύο ασθενείς μετά το βραδινό· έλεγχος του ρυζόγαλου.', 'Ρυζόγαλο', 240, 290,
    0, 0, 0, 0, null, null, 0, 0, 0, 0, false,
    jsonb_build_object('batches', '[]'::jsonb, 'uses', '[]'::jsonb, 'writeoffs', '[]'::jsonb, 'backward', '[]'::jsonb, 'untraced', 0, 'unit', '', 'received', 0, 'used', 0, 'inStock', 0,
      'writtenOff', 0, 'accounted', 0, 'percent', null, 'balanced', false, 'affectedDays', 0, 'affectedMeals', 0, 'affectedPortions', 0, 'stockCounts', '{}'::jsonb),
    'Υπεύθυνος Ποιότητας, Επιτροπή Λοιμώξεων, προμηθευτής γάλακτος.', 'Αναζητήθηκαν οι παρτίδες γάλακτος· δεν βρέθηκαν οι μερίδες της πολτώδους δίαιτας στο πλάνο.', 'fail',
    'Το πλάνο γευμάτων να γράφει πάντα τις μερίδες ανά δίαιτα· οι καταναλώσεις να καταχωρίζονται με την παρτίδα την ίδια ώρα.', v_manager, 'completed');

  select i.id, i.product_id, i.product_name, i.quantity, i.unit into v_item
  from public.kitchen_receipt_items i where i.organization_id = v_org and i.batch_code = 'L2410-118' order by i.created_at limit 1;
  if v_item.id is not null then
    select coalesce(sum(u.quantity), 0), count(distinct u.production_id) into v_used, v_days from public.kitchen_material_usage u where u.organization_id = v_org and u.receipt_item_id = v_item.id;
    select coalesce(sum(w.quantity), 0) into v_written from public.kitchen_stock_writeoffs w where w.organization_id = v_org and w.receipt_item_id = v_item.id;
    select count(distinct m.id), coalesce(sum(m.portions), 0) into v_meals, v_portions
    from public.kitchen_material_usage u join public.kitchen_production_meals m on m.production_id = u.production_id and m.organization_id = u.organization_id
    where u.organization_id = v_org and u.receipt_item_id = v_item.id and u.dish_name is not null
      and (lower(m.dish) like '%' || lower(u.dish_name) || '%' or lower(u.dish_name) like '%' || lower(m.dish) || '%');
  end if;
  v_stock := greatest(coalesce(v_item.quantity, 20) - v_used - v_written, 0);
  insert into public.kitchen_recall_drills (organization_id, code, drill_date, started_at, finished_at, scenario, trigger_text, receipt_item_id, product_id, product_name, target_minutes,
    elapsed_minutes, received_quantity, used_quantity, stock_quantity, written_off_quantity, quantity_unit, accounted_percent, batches_count, affected_days, affected_meals, affected_portions,
    traced_within_target, trace_snapshot, notified, actions, result, lessons, conducted_by_name, status)
  values (v_org, 'ANK-0002', d0 - 2, (d0 - 2 + time '10:00') at time zone 'Europe/Athens', (d0 - 2 + time '11:35') at time zone 'Europe/Athens', 'supplier_lot',
    'Ειδοποίηση προμηθευτή για μολυσμένη παρτίδα (Salmonella) στο στήθος κοτόπουλο L2410-118.', v_item.id, v_item.product_id, coalesce(v_item.product_name, 'Στήθος κοτόπουλο φιλέτο'), 240,
    95, coalesce(v_item.quantity, 20), v_used, v_stock, v_written, case when v_item.unit in ('kg', 'pcs', 'l') then v_item.unit else 'kg' end,
    case when coalesce(v_item.quantity, 20) > 0 then round((v_used + v_stock + v_written) * 100 / coalesce(v_item.quantity, 20), 1) end,
    case when v_item.id is null then 0 else 1 end, v_days, v_meals, v_portions, true,
    jsonb_build_object('stockCounts', case when v_item.id is null then '{}'::jsonb else jsonb_build_object(v_item.id::text, v_stock::text) end),
    'Υπεύθυνος Ποιότητας, Διοίκηση, Ομάδα Πρόληψης Λοιμώξεων, προμηθευτής (Κρεατεμπορική Θεσσαλίας).',
    'Το υπόλοιπο απομονώθηκε στον θάλαμο ψύξης με σήμανση «ΔΕΣΜΕΥΜΕΝΟ»· βρέθηκαν οι ημέρες και τα γεύματα που σερβιρίστηκε.', 'pass',
    'Η ιχνηλάτηση ολοκληρώθηκε εντός στόχου· να προστεθεί στη διαδικασία το τηλέφωνο του προμηθευτή εκτός ωραρίου.', v_manager, 'completed');
end;
$function$;
revoke all on function private.demo_seed_kitchen_recall_drills(uuid) from public, anon, authenticated;

-- The whole of it for one Demo organization, once: after a reset (private.demo_wipe_data) or on a Demo that has none of it yet.
create or replace function private.demo_seed_quality_governance(p_organization_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
begin
  if p_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organizations o where o.id = v_org and o.is_demo) then
    raise exception 'Only Demo organizations get the Demo quality governance' using errcode = '42501';
  end if;
  -- A Demo reset empties these tables first (private.demo_wipe_data); a Demo that already has them is left as it is.
  if exists (select 1 from public.quality_department_meetings x where x.organization_id = v_org)
    or exists (select 1 from public.quality_objectives x where x.organization_id = v_org)
    or exists (select 1 from public.quality_management_reviews x where x.organization_id = v_org) then
    return;
  end if;
  perform private.demo_seed_quality_meetings(v_org);
  perform private.demo_seed_quality_reviews(v_org);
  perform private.demo_seed_quality_objectives(v_org);
  perform private.demo_seed_quality_self_assessments(v_org, p_actor);
  perform private.demo_seed_quality_survey_responses(v_org);
  perform private.demo_seed_kitchen_recall_drills(v_org);
end;
$function$;
revoke all on function private.demo_seed_quality_governance(uuid, uuid) from public, anon, authenticated;

-- ===== 20261231400000_demo_reset_by_evaluator.sql =====
-- Επαναφορά Demo από τον ίδιο τον αξιολογητή: κάθε ενεργό μέλος ενός Demo
-- νοσοκομείου (με ενεργή, μη ληγμένη πρόσβαση) μπορεί να σβήσει τα δεδομένα
-- του δικού του Demo και να ξαναγράψει το πακέτο δεδομένων Demo. Τα άλλα Demo
-- και τα νοσοκομεία παραγωγής δεν αγγίζονται (η demo_wipe_data αρνείται κάθε
-- οργανισμό που δεν είναι Demo).

-- Ο αξιολογητής είναι ο ίδιος μέλος επιτροπών του Demo· το σβήσιμο των δικών
-- του θέσεων κατά την επαναφορά δεν είναι αλλαγή δικαιωμάτων. Επιτρέπεται μόνο
-- μέσα στην επαναφορά (limoxis.test_reset) και μόνο σε Demo οργανισμό.
create or replace function public.prevent_self_member_capability_change()
returns trigger language plpgsql security definer set search_path to 'public', 'pg_temp'
as $function$
declare
  target_membership_id uuid;
  target_user_id uuid;
  target_organization_id uuid;
begin
  target_membership_id := coalesce(new.membership_id, old.membership_id);
  select om.user_id, om.organization_id into target_user_id, target_organization_id
  from public.organization_members om
  where om.id = target_membership_id;

  if auth.uid() is not null and target_user_id = auth.uid() then
    if coalesce(current_setting('limoxis.test_reset', true), '') = 'on'
       and exists (select 1 from public.organizations o where o.id = target_organization_id and o.is_demo) then
      return coalesce(new, old);
    end if;
    raise exception 'SELF_PRIVILEGE_CHANGE_FORBIDDEN'
      using errcode = '42501';
  end if;

  return coalesce(new, old);
end;
$function$;
create or replace function public.demo_reset_my_organization(p_organization_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  v_result jsonb;
  v_member record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organizations o where o.id = p_organization_id and o.is_demo) then
    raise exception 'Only Demo organizations can be reset' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.profiles p where p.id = auth.uid() and coalesce(p.is_platform_owner, false)
  ) then
    if not exists (
      select 1 from public.organization_members om
      where om.organization_id = p_organization_id and om.user_id = auth.uid() and om.status = 'active'
    ) then
      raise exception 'Not a member of this Demo' using errcode = '42501';
    end if;
    if exists (
      select 1 from public.platform_demo_entitlements e
      where e.organization_id = p_organization_id
        and (e.status <> 'active' or (e.valid_until is not null and e.valid_until < current_date))
    ) then
      raise exception 'The Demo is not active' using errcode = '42501';
    end if;
  end if;
  -- Μία επαναφορά τη φορά για κάθε Demo.
  perform pg_advisory_xact_lock(hashtext('demo_reset:' || p_organization_id::text));
  perform private.demo_wipe_data(p_organization_id);
  v_result := private.demo_seed_data(p_organization_id, auth.uid());
  perform set_config('limoxis.test_reset', 'on', true);
  for v_member in
    select om.user_id from public.organization_members om
    where om.organization_id = p_organization_id and om.status = 'active' and om.user_id is not null
  loop
    perform private.demo_seed_governance_member(p_organization_id, v_member.user_id);
  end loop;
  return v_result;
end;
$function$;
revoke all on function public.demo_reset_my_organization(uuid) from public, anon;
grant execute on function public.demo_reset_my_organization(uuid) to authenticated;

-- ===== 20261231410000_demo_seed_complete_modules.sql =====
-- Το πακέτο δεδομένων Demo γεμίζει πλέον και τις ενότητες που ήταν άδειες:
-- βάρδιες, κανονισμοί, πρωτόκολλα, μητρώα τμημάτων, συνεντεύξεις, προμηθευτές
-- και εξοπλισμός, συναντήσεις τμημάτων, ανασκόπηση, στόχοι, αυτοαξιολόγηση,
-- ερωτηματολόγια ικανοποίησης και ανάκληση κουζίνας. Κατά τα άλλα ίδιο με το
-- 20261123110200.
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
  -- The kitchen (HACCP), 20261123110200.
  perform private.demo_seed_kitchen(v_org, p_actor);
  -- Οι ενότητες που ήταν άδειες στα Demo (20261231350000–20261231390000).
  -- Τα μητρώα πρώτα: προσθέτουν τα τμήματα Μαιευτικής, Τοκετών, ΤΕΠ και
  -- Ενδοσκοπικού, ώστε οι βάρδιες να βρουν όλα τα τμήματα.
  perform private.demo_seed_registers(v_org, p_actor);
  perform private.demo_seed_rosters_regulations(v_org, p_actor);
  perform private.demo_seed_interviews(v_org, p_actor);
  perform private.demo_seed_quality_resources(v_org, p_actor);
  perform private.demo_seed_quality_governance(v_org, p_actor);
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
    'bundleAudits', (select count(*) from public.prevention_bundle_assessments x where x.organization_id = v_org),
    'kitchenReceipts', (select count(*) from public.kitchen_receipts x where x.organization_id = v_org),
    'rosters', (select count(*) from public.department_rosters x where x.organization_id = v_org),
    'regulations', (select count(*) from public.regulations x where x.organization_id = v_org),
    'registers', (select count(*) from public.department_registers x where x.organization_id = v_org),
    'candidates', (select count(*) from public.hr_candidates x where x.organization_id = v_org),
    'suppliers', (select count(*) from public.quality_suppliers x where x.organization_id = v_org),
    'equipment', (select count(*) from public.quality_equipment x where x.organization_id = v_org),
    'departmentMeetings', (select count(*) from public.quality_department_meetings x where x.organization_id = v_org),
    'objectives', (select count(*) from public.quality_objectives x where x.organization_id = v_org)
  );
end;
$function$;

commit;
