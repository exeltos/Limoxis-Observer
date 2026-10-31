-- TEST DATA, demo hospitals only (is_demo): two audit rounds a year of three days each, every
-- department answering the basic questionnaire, spring 2024 to spring 2026 completed and the
-- autumn 2026 round planned, plus three small findings from the spring 2026 round. Every record says
-- «δοκιμαστικό» in its title or notes, and its code carries -98. Safe to repeat: existing codes are skipped.
do $$
declare
  tpl uuid := (select id from public.quality_audit_templates where template_key = 'core' and is_system limit 1);
  org record;
  pick record;
  test_note text := 'ΔΟΚΙΜΑΣΤΙΚΗ ΚΑΤΑΧΩΡΗΣΗ: εικονικά δεδομένα για προβολή του προγράμματος επιθεωρήσεων.';
begin
  if tpl is null then raise exception 'the basic questionnaire is not in the library'; end if;
  for org in select id from public.organizations where is_demo loop
    insert into public.quality_audits (organization_id, code, title, audit_type, audit_kind, audit_body, department_id, scope, planned_date, completed_date,
      status, lifecycle_status, source, template_id, template_title, template_version, checklist_source, standards, frequency_months, duration_days,
      risk_level, lead_auditor_label, conclusion, notes)
    select org.id,
      'AUD-' || to_char(rd.d + ((dp.rn - 1) / 3), 'YYMMDD') || '-98' || lpad(dp.rn::text, 2, '0') || lpad(rd.n::text, 2, '0'),
      'Επιθεώρηση τμήματος · ' || dp.name || ' · ' || case when extract(month from rd.d) = 5 then 'Άνοιξη ' else 'Φθινόπωρο ' end || extract(year from rd.d)::int || ' (δοκιμαστικό)',
      'internal', 'internal', 'internal', dp.id, 'Βασικό ερωτηματολόγιο τμήματος (ISO 9001 · JCI · TEMOS)',
      rd.d + ((dp.rn - 1) / 3), case when rd.n < 6 then rd.d + ((dp.rn - 1) / 3) end,
      case when rd.n < 6 then 'completed' else 'planned' end, 'active', 'seed', tpl,
      'Βασικό ερωτηματολόγιο τμήματος (ISO 9001 · JCI · TEMOS)', 1, 'template:' || tpl, array['iso9001', 'jci', 'temos'], 6, 3,
      'medium', 'Υπεύθυνος Ποιότητας',
      case when rd.n < 6 then 'Το τμήμα συμμορφώνεται στο μεγαλύτερο μέρος των απαιτήσεων. Δοκιμαστικά δεδομένα.' end, test_note
    from (values (1, date '2024-05-14'), (2, date '2024-11-12'), (3, date '2025-05-13'), (4, date '2025-11-11'), (5, date '2026-05-12'), (6, date '2026-11-10')) rd(n, d)
    cross join (select id, name, row_number() over (order by name) rn from public.departments where organization_id = org.id) dp
    on conflict (organization_id, code) do nothing;

    -- The answers: later rounds are better, a few partial or missing, the critical ones mostly in place.
    insert into public.quality_audit_checklist_items (organization_id, audit_id, position, item, required, answer, result, template_question_id,
      chapter_ref, chapter_title, clause_ref, guidance, evidence_required, weight, critical, finding_class, ad_hoc)
    select a.organization_id, a.id, q.position, q.question, true,
      case r.v when 'yes' then 'yes' else 'no' end, r.v, q.id, q.chapter_ref, q.chapter_title, q.clause_ref, q.guidance, q.evidence, q.weight, q.critical,
      case r.v when 'partial' then 'observation' when 'no' then case when q.critical then 'major' else 'minor' end end, false
    from public.quality_audits a
    join public.quality_audit_template_questions q on q.template_id = tpl
    cross join lateral (select abs(hashtext(a.code || ':' || q.position)) % 100 h, right(a.code, 2)::int n) k
    cross join lateral (select case when k.h < 70 + k.n * 4 then 'yes' when k.h < least(97, 82 + k.n * 4) then 'partial' else 'no' end v) r
    where a.organization_id = org.id and a.notes = test_note and a.status = 'completed'
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
      where a.organization_id = org.id and a.notes = test_note and a.code like 'AUD-26051_-98__05'
        and ((q.position = 4 and a.code like '%-9803__') or (q.position = 14 and a.code like '%-9805__') or (q.position = 19 and a.code like '%-9807__'))
    loop
      update public.quality_audit_checklist_items set result = 'no', answer = 'no', finding_class = 'minor', note = 'Δοκιμαστική διαπίστωση.' where id = pick.item_id;
      insert into public.quality_findings (organization_id, code, title, department_id, identified_at, severity, status, description, source_type, source_id,
        audit_item_id, finding_class, clause_ref, standard, due_date, verification_status, owner_label, owner_labels)
      values (org.id, 'FND-2605-98' || lpad(pick.position::text, 2, '0') || right(pick.audit_code, 4), pick.title, pick.department_id, pick.completed_date + time '12:00',
        'medium', pick.st, 'Επιθεώρηση ' || pick.audit_code || '. Δοκιμαστική διαπίστωση για προβολή.', 'audit', pick.audit_code, pick.item_id, 'minor', pick.clause,
        pick.standard, date '2026-12-15', 'pending', 'Υπεύθυνος Ποιότητας', array['Υπεύθυνος Ποιότητας'])
      on conflict (organization_id, code) do nothing;
      update public.quality_audit_checklist_items c set finding_id = f.id from public.quality_findings f
        where c.id = pick.item_id and f.organization_id = org.id and f.audit_item_id = pick.item_id;
    end loop;
  end loop;
end
$$;
