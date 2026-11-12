-- Demo data for the modules that every Demo organization had empty: the department shift rosters and the
-- requests of their people (src/features/rosters/rosterService.js, demo part), the regulations with their
-- editions, drafts and signatures (src/features/regulations/regulationService.js, demoState), the Hour-1 sepsis
-- protocols and the 48–72 h antimicrobial reviews of the episodes (protocolDemoData.js), the epidemiological
-- questionnaires of the episodes (epiQuestionnaireDemoHistory.js) and the protocol update suggestions of the
-- controlled documents (protocolReviewDemoData.js). Everything is built from the Demo's own departments,
-- employees, episodes, therapies and documents (seeded before this), with dates relative to today.
-- Names are made up. Safe on a freshly wiped Demo; a second run adds nothing that already exists.

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

-- Requests of the people of the three largest rotas: leave approved, a wish and a swap waiting, one refused,
-- a sick day of the running period, one cancelled by the employee.
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
    select d.id, (row_number() over (order by count(e.id) desc, d.name)) - 1 as idx
    from public.departments d
    join public.employees e on e.organization_id = v_org and e.department_id = d.id and e.employment_status = 'active'
      and e.staff_category <> 'physician' and coalesce(e.profession_name, '') !~* 'ιατρ|physician|doctor'
      and coalesce(e.position_name, '') !~* 'προϊστάμεν|head of department'
    where d.organization_id = v_org and d.is_active is not false
    group by d.id, d.name having count(e.id) >= 2
    order by count(e.id) desc, d.name limit 3
  loop
    select array_agg(e.id order by e.last_name, e.first_name) into v_people
    from public.employees e
    where e.organization_id = v_org and e.department_id = r.id and e.employment_status = 'active'
      and e.staff_category <> 'physician' and coalesce(e.profession_name, '') !~* 'ιατρ|physician|doctor'
      and coalesce(e.position_name, '') !~* 'προϊστάμεν|head of department';
    n := cardinality(v_people);
    insert into public.roster_requests (organization_id, department_id, employee_id, requested_by, kind, date_from, date_to,
      swap_employee_id, swap_date, note, status, decided_by, decided_at, created_at)
    select v_org, r.id, v_people[(q.p % n) + 1], null, q.kind, q.f, q.t,
      case when q.kind = 'swap' then v_people[(3 % n) + 1] end, case when q.kind = 'swap' then v_cur + 18 end,
      q.note, q.status, case when q.status in ('approved', 'rejected') then p_actor end,
      case when q.status in ('approved', 'rejected') then now() - make_interval(days => q.decided_ago, hours => 2) end,
      now() - make_interval(days => q.created_ago, hours => r.idx::integer)
    from (values
      (0, 'leave', v_cur + 6 + r.idx::integer, v_cur + 8 + r.idx::integer, 'approved', 'Οικογενειακός λόγος.', 9, 3),
      (1, 'wish', v_cur + 12, v_cur + 12, 'pending', 'Γάμος στην οικογένεια.', 4, 0),
      (2, 'swap', v_cur + 17, v_cur + 17, 'pending', 'Ανταλλαγή απογευματινής με πρωινή.', 2, 0),
      (1, 'unavailable', v_cur + 22, v_cur + 22, 'approved', null, 7, 2),
      (2, 'leave', v_cur - 20, v_cur - 18, 'rejected', 'Ήδη δύο άτομα σε άδεια τις ίδιες ημέρες.', 28, 25),
      (0, 'sick', v_run + 3, v_run + 4, 'approved', 'Με ιατρική βεβαίωση.', 18, 17),
      (1, 'leave', v_cur + 25, v_cur + 27, 'cancelled', 'Αλλαγή οικογενειακού προγραμματισμού.', 6, 0)
    ) q(p, kind, f, t, status, note, created_ago, decided_ago)
    where q.kind <> 'swap' or n >= 2;
  end loop;
end;
$function$;
revoke all on function private.demo_seed_roster_requests(uuid, uuid, date, date) from public, anon, authenticated;

-- One roster of a department for one period. The ward rota turns over a fixed cycle that runs on across
-- periods (so a period starts where the previous ended): mornings only with two people, mornings and
-- afternoons with three, nights too from four. The head works weekday mornings. Approved requests (leave,
-- sick, a day they cannot work, a wish) are on the roster; p_leave_emp is on leave on days 10–12.
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
  v_id uuid;
begin
  create temporary table if not exists pg_temp.demo_roster_staff (id uuid, name text, profession text, is_head boolean, active boolean,
    user_id uuid, ord integer, off integer) on commit drop;
  truncate pg_temp.demo_roster_staff;
  insert into pg_temp.demo_roster_staff
  select s.id, s.name, s.profession, s.is_head, s.active, s.user_id, s.ord, 0
  from (
    select e.id, btrim(e.last_name || ' ' || e.first_name) as name, coalesce(e.profession_name, '') as profession,
      coalesce(e.position_name, '') ~* 'προϊστάμεν|head of department' as is_head,
      e.employment_status = 'active' as active, e.user_id,
      (row_number() over (partition by (e.employment_status = 'active' and coalesce(e.position_name, '') !~* 'προϊστάμεν|head of department')
        order by e.last_name, e.first_name))::integer - 1 as ord
    from public.employees e
    where e.organization_id = v_org and e.department_id = p_department
      and e.staff_category <> 'physician' and coalesce(e.profession_name, '') !~* 'ιατρ|physician|doctor'
  ) s;
  select count(*) into v_regular from pg_temp.demo_roster_staff where active and not is_head;
  if v_regular < 2 then return null; end if;
  v_cycle := case when v_regular >= 4 then array['M','A','A','N','N','R','R']
                  when v_regular = 3 then array['M','M','A','A','R','R']
                  else array['M','M','R','R'] end;
  update pg_temp.demo_roster_staff set off = (ord * cardinality(v_cycle)) / v_regular where active and not is_head;
  v_demand := jsonb_build_object(
    'weekday', jsonb_build_object('M', 1, 'I', 0, 'A', case when v_regular >= 3 then 1 else 0 end, 'N', case when v_regular >= 4 then 1 else 0 end),
    'weekend', jsonb_build_object('M', 1, 'I', 0, 'A', case when v_regular >= 3 then 1 else 0 end, 'N', case when v_regular >= 4 then 1 else 0 end),
    'overrides', '{}'::jsonb);

  with days as (select g::date as d from generate_series(p_start, v_end, interval '1 day') g),
  req as (
    select r.employee_id, r.kind, r.date_from, coalesce(r.date_to, r.date_from) as date_to
    from public.roster_requests r
    where r.organization_id = v_org and r.department_id = p_department and r.status = 'approved' and r.kind <> 'swap'),
  cells as (
    select s.id, d.d,
      (select case q.kind when 'leave' then 'L' when 'sick' then 'S' when 'unpaid' then 'U' else 'R' end
         from req q where q.employee_id = s.id and d.d between q.date_from and q.date_to limit 1) as req_code,
      (select q.kind from req q where q.employee_id = s.id and d.d between q.date_from and q.date_to limit 1) as req_kind,
      case when s.id = p_leave_emp and d.d between p_start + 9 and p_start + 11 then 'L' end as leave_code,
      case when s.is_head then case when extract(isodow from d.d) < 6 then 'M' else 'R' end
           else v_cycle[((d.d - date '2000-01-03' + s.off) % cardinality(v_cycle)) + 1] end as pattern
    from pg_temp.demo_roster_staff s cross join days d
    where s.active)
  select coalesce(jsonb_object_agg(x.id, x.row), '{}'::jsonb) into v_assignments
  from (select c.id, jsonb_object_agg(c.d::text, coalesce(c.req_code, c.leave_code, c.pattern)) as row from cells c group by c.id) x;

  with days as (select g::date as d from generate_series(p_start, v_end, interval '1 day') g),
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
  from pg_temp.demo_roster_staff s;

  insert into public.department_rosters (organization_id, department_id, period_start, period_end, demand, rules, members, assignments,
    status, published_at, change_log, created_by, updated_by, created_at, updated_at)
  values (v_org, p_department, p_start, v_end, v_demand, '{}'::jsonb, v_members, v_assignments, p_status,
    case when p_status = 'published' then ((p_start - 5) + time '10:00') at time zone 'UTC' end, '[]'::jsonb, p_actor, p_actor,
    ((p_start - 12) + time '09:00') at time zone 'UTC', least(now(), ((p_start - 5) + time '10:00') at time zone 'UTC'))
  on conflict (organization_id, department_id, period_start) do nothing
  returning id into v_id;
  if v_id is null then return null; end if;
  return jsonb_build_object('id', v_id, 'assignments', v_assignments,
    'head', (select s.name from pg_temp.demo_roster_staff s order by s.is_head desc, s.active desc, s.ord limit 1),
    'first', (select s.id from pg_temp.demo_roster_staff s where s.active and not s.is_head order by s.ord limit 1));
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
  perform private.demo_seed_roster_requests(v_org, p_actor, v_cur, v_run);
  for r in select d.id from public.departments d where d.organization_id = v_org and d.is_active is not false order by d.name loop
    -- The last of the department's active ward staff takes three days of leave in the running period.
    select e.id into v_last from public.employees e
    where e.organization_id = v_org and e.department_id = r.id and e.employment_status = 'active'
      and e.staff_category <> 'physician' and coalesce(e.profession_name, '') !~* 'ιατρ|physician|doctor'
      and coalesce(e.position_name, '') !~* 'προϊστάμεν|head of department'
    order by e.last_name desc, e.first_name desc limit 1;
    for k in -2..1 loop
      v_start := (v_run + make_interval(months => k))::date;
      v_made := private.demo_seed_roster_period(v_org, p_actor, r.id, v_start, case when k = 1 then 'draft' else 'published' end,
        case when k = 0 then v_last end);
      -- A department without a ward rota (fewer than two people) gets none; a rerun stops at the first existing one.
      exit when v_made is null and k = -2;
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
    least(now() - interval '1 hour', x.started_at + make_interval(hours => 50 + (x.n % 5) * 4)), p_actor,
    case when x.n % 2 = 0 then 'Δρ. Ε. Λαμπράκη' else 'Δρ. Σ. Καλλέργης' end, 'Λοιμωξιολόγος',
    least(now() - interval '1 hour', x.started_at + make_interval(hours => 50 + (x.n % 5) * 4))
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
