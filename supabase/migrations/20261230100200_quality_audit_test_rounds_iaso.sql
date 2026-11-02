-- TEST DATA for the hospital ΙΑΣΩ ΘΕΣΣΑΛΙΑΣ, at the owner's request: the autumn 2025 and spring 2026
-- audit rounds (the departments of the spring 2025 round, three days each, the basic questionnaire
-- answered almost entirely «yes»), three small findings from spring 2026, and the autumn 2026 round
-- (the audits already planned for the month, all on one placeholder day) spread over 10-12 November.
-- Every new record says «δοκιμαστικό» in its title or notes and its code carries -98. Safe to repeat.
do $$
declare
  tpl uuid := (select id from public.quality_audit_templates where template_key = 'core' and is_system limit 1);
  org uuid := (select id from public.organizations where name = 'ΙΑΣΩ ΘΕΣΣΑΛΙΑΣ' and not is_demo);
  test_note text := 'ΔΟΚΙΜΑΣΤΙΚΗ ΚΑΤΑΧΩΡΗΣΗ: εικονικά δεδομένα για προβολή του προγράμματος επιθεωρήσεων.';
  pick record;
begin
  if tpl is null or org is null then raise exception 'the questionnaire or the hospital is missing'; end if;

  create temporary table iaso_departments on commit drop as
    select d.id, d.name, row_number() over (order by d.name) rn
    from public.departments d
    where d.organization_id = org
      and d.id in (select a.department_id from public.quality_audits a where a.organization_id = org and a.planned_date between '2025-05-01' and '2025-05-31' and a.department_id is not null);

  insert into public.quality_audits (organization_id, code, title, audit_type, audit_kind, audit_body, department_id, scope, planned_date, completed_date,
    status, lifecycle_status, source, template_id, template_title, template_version, checklist_source, standards, frequency_months, duration_days,
    risk_level, lead_auditor_label, conclusion, notes)
  select org,
    'AUD-' || to_char(rd.d + (((dp.rn - 1) * 3 / (select count(*) from iaso_departments))::int), 'YYMMDD') || '-98' || lpad(dp.rn::text, 2, '0') || lpad(rd.n::text, 2, '0'),
    'Επιθεώρηση τμήματος · ' || dp.name || ' · ' || case when extract(month from rd.d) = 5 then 'Άνοιξη ' else 'Φθινόπωρο ' end || extract(year from rd.d)::int || ' (δοκιμαστικό)',
    'internal', 'internal', 'internal', dp.id, 'Βασικό ερωτηματολόγιο τμήματος (ISO 9001 · JCI · TEMOS)',
    rd.d + (((dp.rn - 1) * 3 / (select count(*) from iaso_departments))::int), rd.d + (((dp.rn - 1) * 3 / (select count(*) from iaso_departments))::int),
    'completed', 'active', 'seed', tpl, 'Βασικό ερωτηματολόγιο τμήματος (ISO 9001 · JCI · TEMOS)', 1, 'template:' || tpl, array['iso9001', 'jci', 'temos'], 6, 3,
    'medium', 'Υπεύθυνος Ποιότητας', 'Το τμήμα συμμορφώνεται στις απαιτήσεις. Δοκιμαστικά δεδομένα.', test_note
  from (values (1, date '2025-11-11'), (2, date '2026-05-12')) rd(n, d)
  cross join iaso_departments dp
  on conflict (organization_id, code) do nothing;

  insert into public.quality_audit_checklist_items (organization_id, audit_id, position, item, required, answer, result, template_question_id,
    chapter_ref, chapter_title, clause_ref, guidance, evidence_required, weight, critical, ad_hoc)
  select a.organization_id, a.id, q.position, q.question, true,
    case when abs(hashtext(a.code || ':' || q.position)) % 25 = 0 then 'na' else 'yes' end,
    case when abs(hashtext(a.code || ':' || q.position)) % 25 = 0 then 'na' else 'yes' end,
    q.id, q.chapter_ref, q.chapter_title, q.clause_ref, q.guidance, q.evidence, q.weight, q.critical, false
  from public.quality_audits a
  join public.quality_audit_template_questions q on q.template_id = tpl
  where a.organization_id = org and a.notes = test_note and a.status = 'completed'
    and not exists (select 1 from public.quality_audit_checklist_items c where c.audit_id = a.id);

  -- Three small findings from the spring 2026 round.
  for pick in
    select a.id audit_id, a.code audit_code, a.department_id, q.position, c.id item_id, a.completed_date,
      case q.position when 4 then 'Δεν καταγράφεται ο μηνιαίος έλεγχος λήξεων στο φαρμακείο του τμήματος (δοκιμαστικό)'
        when 14 then 'Σε χρήση παλιά έκδοση του πρωτοκόλλου υγιεινής χεριών (δοκιμαστικό)'
        else 'Λείπει η ετήσια εκπαίδευση ΚΑΡΠΑ για τρεις νοσηλευτές (δοκιμαστικό)' end title,
      case q.position when 4 then 'jci' else 'iso9001' end standard,
      case q.position when 4 then 'MMU' when 14 then '7.5' else '7.2' end clause,
      case q.position when 14 then 'in_progress' else 'open' end st
    from public.quality_audits a
    join public.quality_audit_template_questions q on q.template_id = tpl
    join public.quality_audit_checklist_items c on c.audit_id = a.id and c.template_question_id = q.id
    where a.organization_id = org and a.notes = test_note and a.code like 'AUD-26051_-98__02'
      and ((q.position = 4 and a.code like '%-9803__') or (q.position = 14 and a.code like '%-9812__') or (q.position = 19 and a.code like '%-9821__'))
  loop
    update public.quality_audit_checklist_items set result = 'no', answer = 'no', finding_class = 'minor', note = 'Δοκιμαστική διαπίστωση.' where id = pick.item_id;
    insert into public.quality_findings (organization_id, code, title, department_id, identified_at, severity, status, description, source_type, source_id,
      audit_item_id, finding_class, clause_ref, standard, due_date, verification_status, owner_label, owner_labels)
    values (org, 'FND-2605-98' || lpad(pick.position::text, 2, '0') || right(pick.audit_code, 4), pick.title, pick.department_id, pick.completed_date + time '12:00',
      'medium', pick.st, 'Επιθεώρηση ' || pick.audit_code || '. Δοκιμαστική διαπίστωση για προβολή.', 'audit', pick.audit_code, pick.item_id, 'minor', pick.clause,
      pick.standard, date '2026-12-15', 'pending', 'Υπεύθυνος Ποιότητας', array['Υπεύθυνος Ποιότητας'])
    on conflict (organization_id, code) do nothing;
    update public.quality_audit_checklist_items c set finding_id = f.id from public.quality_findings f
      where c.id = pick.item_id and f.organization_id = org and f.audit_item_id = pick.item_id;
  end loop;

  -- The autumn 2026 round: the audits already planned for November (a placeholder day) over three working days.
  update public.quality_audits a set planned_date = date '2026-11-10' + s.day_no, planned_month_only = false
  from (select id, ((row_number() over (order by (select name from public.departments d where d.id = q.department_id), q.code) - 1) * 3 / (count(*) over ()))::int as day_no
        from public.quality_audits q
        where q.organization_id = org and q.status = 'planned' and q.lifecycle_status <> 'voided' and q.planned_date = date '2026-11-15' and q.planned_month_only) s
  where a.id = s.id;
end
$$;
