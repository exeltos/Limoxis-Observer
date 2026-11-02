-- FileMaker → Limoxis, daily sync: the NICU register (one entry per newborn),
-- approved by the owner on 27/10/2026. A newborn is added once its stay is
-- closed (discharge date entered), so the entry is complete; a case number
-- already in the register is only linked. The values follow the register's
-- options as the first transfer mapped them (age on admission and length of
-- stay are computed by the register).

create or replace function private.fm_nicu_reasons(p_text text)
returns text[] language sql immutable set search_path = '' as $$
  with t as (select upper(translate(coalesce(p_text, ''), 'άέήίόύώϊϋΐΰ', 'αεηιουωιυιυ')) as s)
  select coalesce(nullif(array_remove(array[
    case when s ~ 'ΠΡΟΩΡ' then 'prematurity' end,
    case when s ~ 'ΧΑΜΗΛΟ Β|ΧΒΓ|ΧΑΒΗΛΟ ΒΑΡ' then 'low_birth_weight' end,
    case when s ~ 'IUGR|S ?G ?A|ΕΝΔΟΜΗΤΡΙΑ ΚΑΘΥΣΤ' then 'iugr' end,
    case when s ~ 'ΑΝΑΠΝΕΥΣΤ|ΓΟΓΓΥΣΜ|ΤΑΧΥΠΝ' then 'respiratory' end,
    case when s ~ 'ΙΚΤΕΡ|ΧΟΛΕΡΥΘΡ' then 'jaundice' end,
    case when s ~ 'ΛΟΙΜΩΞ|ΛΟΙΜΨΞ|ΕΜΠΥΡΕΤ|ΟΜΦΑΛΙΤ|ΑΠΟΣΤΗΜ' then 'infection' end,
    case when s ~ 'ΔΙΔΥΜ|ΠΟΛΥΔΥΜ' then 'twins' end,
    case when s ~ 'ΣΥΓΓΕΝ|ΣΧΙΣΤΙΑ|ΑΤΡΗΣΙΑ|DOWN' then 'congenital' end,
    case when s ~ 'ΚΥΑΝΩ|ΑΠΝΟΙ' then 'cyanosis' end,
    case when s ~ 'ΣΙΤΙΣ|ΕΜΕΤ' then 'feeding' end,
    case when s ~ 'ΑΝΑΙΜΙ' then 'anaemia' end,
    case when s ~ 'ΠΑΡΑΚΟΛΟΥΘ|ΔΙΕΡΕΥΝ' then 'observation' end,
    case when s ~ 'ΦΙΛΟΞΕΝ' then 'hosting' end], null), '{}'), array['other'])
  from t
$$;

create or replace function private.fm_sync_nicu()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_register uuid; v_department uuid; v_version integer; v_count integer := 0;
  r record; v_id uuid; v_admit date; v_birth date; v_out date; v_gest numeric; v_outcome text; v_bottle text; v_milk text; v_resus text;
  v_num constant text := '^-?[0-9]+(\.[0-9]+)?$';
begin
  select x.register_id, x.department_id, x.definition_version into v_register, v_department, v_version
  from public.register_nicu_677c3c7b x order by x.created_at desc limit 1;
  if v_register is null then return 0; end if;
  for r in
    select s.record_id, s.data d
    from public.fm_stage_records s
    where s.base_table = 'Indicator ΜΕΝΝ' and s.record_id ~ '^\d+$' and s.record_id::bigint > 7256
      and nullif(s.data->>'ΗΜΕΡΟΜΗΝΙΑ ΕΙΣΑΓΩΓΗΣ ΜΕΝΝ', '') is not null
      and nullif(s.data->>'ΗΜΕΡΟΜΗΝΙΑ ΕΞΟΔΟΥ ΑΠΟ ΤΗ  ΜΕΝΝ', '') is not null
      and not exists (select 1 from public.fm_stage_links l where l.base_table = 'Indicator ΜΕΝΝ' and l.record_id = s.record_id)
    order by s.record_id::bigint
  loop
    -- A case number already in the register is the same newborn.
    select i.entry_id into v_id from public.register_nicu_677c3c7b_identity i
    where i.case_number = r.d->>'ΑΡΙΘΜΟΣ ΠΕΡΙΣΤΑΤΙΚΟΥ' and r.d->>'ΑΡΙΘΜΟΣ ΠΕΡΙΣΤΑΤΙΚΟΥ' is not null limit 1;
    if v_id is not null then
      insert into public.fm_stage_links (base_table, record_id, target_table, target_id, how, note, linked_at)
      values ('Indicator ΜΕΝΝ', r.record_id, 'register_nicu_677c3c7b', v_id, 'matched', 'daily sync', now()) on conflict do nothing;
      continue;
    end if;
    v_id := md5('fm-IndicatorNICU-' || r.record_id)::uuid;
    v_admit := (r.d->>'ΗΜΕΡΟΜΗΝΙΑ ΕΙΣΑΓΩΓΗΣ ΜΕΝΝ')::date;
    v_birth := nullif(r.d->>'ΗΜΕΡΟΜΗΝΙΑ ΓΕΝΝΗΣΗΣ', '')::date;
    v_out := (r.d->>'ΗΜΕΡΟΜΗΝΙΑ ΕΞΟΔΟΥ ΑΠΟ ΤΗ  ΜΕΝΝ')::date;
    v_gest := case when r.d->>'Διάρκεια Κύησης' ~ v_num then (r.d->>'Διάρκεια Κύησης')::numeric end;
    v_outcome := upper(btrim(coalesce(r.d->>'ΕΚΒΑΣΗ', '')));
    v_bottle := btrim(coalesce(r.d->>'ΑΠΟΚΛΕΙΣΤΙΚΗ  ΣΙΤΙΣΗ ΜΕ BIBERON', ''));
    v_milk := upper(translate(btrim(coalesce(r.d->>'ΔΙΑΤΗΡΗΣΗ ΜΗΤΡΙΚΟΥ ΓΑΛΑΚΤΟΣ', '')), 'ΌόNAIOXI', 'ΟΟΝΑΙΟΧΙ'));
    v_resus := upper(translate(btrim(coalesce(r.d->>'ΑΝΑΝΗΨΗ', '')), 'ΌόOXI', 'ΟΟΟΧΙ'));
    insert into public.register_nicu_677c3c7b (
      id, organization_id, department_id, register_id, entry_date, status, locked, definition_version, created_by, updated_by,
      admission_date, birth_date, readmission, admission_reasons, admission_reason_text, admission_origin, gestation, pregnancy_type, delivery, ivf,
      birth_weight, apgar_1, apgar_5, resuscitation, congenital_anomalies, ventilator_days, cpap_days, oxygen_days, umbilical_catheter,
      central_line_days, arterial_line_days, tpn_days, nasogastric, bottle_feeding, bottle_start, breast_milk, early_infection, late_infection,
      discharge_date, discharge_weight, outcome, transfer_destination, admission_age_hours)
    values (
      v_id, private.fm_org(), v_department, v_register, v_admit, 'complete', false, v_version, private.fm_importer(), private.fm_importer(),
      v_admit, v_birth, r.d->>'ΕΠΑΝΕΙΣΑΓΩΓΗ' = 'Ναι', private.fm_nicu_reasons(r.d->>'ΑΙΤΙΑ ΕΙΣΑΓΩΓΗΣ'), private.fm_text(r.d->>'ΑΙΤΙΑ ΕΙΣΑΓΩΓΗΣ'),
      case when r.d->>'ΠΡΟΕΛΕΥΣΗ ΕΙΣΑΓΩΓΗΣ' ~ '^(Α\.?Τ\.?|ΑΤ)$' then 'delivery_room' when upper(r.d->>'ΠΡΟΕΛΕΥΣΗ ΕΙΣΑΓΩΓΗΣ') like 'ΜΑΙΕΥΤΙΚ%' then 'maternity'
           when r.d->>'ΠΡΟΕΛΕΥΣΗ ΕΙΣΑΓΩΓΗΣ' = 'Άλλο Ίδρυμα' then 'other_hospital' when r.d->>'ΠΡΟΕΛΕΥΣΗ ΕΙΣΑΓΩΓΗΣ' = 'Σπίτι' then 'home' end,
      case when v_gest is not null then (floor(v_gest) * 7 + round((v_gest - floor(v_gest)) * 10))::integer end,
      case r.d->>'ΤΥΠΟΣ ΚΥΗΣΗΣ' when 'Μονήρης' then 'single' when 'Πολύδιμη' then 'multiple' end,
      case r.d->>'ΕΙΔΟΣ ΤΟΚΕΤΟΥ' when 'Κ/Τ' then 'cs' when 'Φ/Τ' then 'vaginal' end,
      r.d->>'IVF' = 'Ναι',
      case when r.d->>'ΒΑΡΟΣ ΕΙΣΟΔΟΥ' ~ v_num then (r.d->>'ΒΑΡΟΣ ΕΙΣΟΔΟΥ')::numeric end,
      case when r.d->>'APGAR ΣΤΟ 1ΜΙΝ' ~ v_num then (r.d->>'APGAR ΣΤΟ 1ΜΙΝ')::numeric end,
      case when r.d->>'APGAR ΣΤΑ 5ΜΙΝ' ~ v_num then (r.d->>'APGAR ΣΤΑ 5ΜΙΝ')::numeric end,
      case when v_resus = 'ΟΧΙ' then 'none' when v_resus = 'ΝΑΙ' then 'yes' when v_resus like '%ΔΙΑΣΩΛΗΝΩΣΗ%' then 'intubation'
           when v_resus like '%ΚΑΡΠΑ%' then 'cpr' when v_resus like '%NEOPUFF%' then 'bag_mask' end,
      r.d->>'ΣΥΓΓΕΝΕΙΣ ΑΝΩΜΑΛΙΕΣ' = 'Ναι',
      case when r.d->>'ΗΜΕΡΕΣ ΠΑΡΑΜΟΝΗΣ ΣΤΟΝ ΑΝΑΠΝΕΥΣΤΗΡΑ' ~ v_num then (r.d->>'ΗΜΕΡΕΣ ΠΑΡΑΜΟΝΗΣ ΣΤΟΝ ΑΝΑΠΝΕΥΣΤΗΡΑ')::numeric end,
      case when r.d->>'ΔΙΑΡΚΕΙΑ ΣΤΟ CPAP' ~ v_num then (r.d->>'ΔΙΑΡΚΕΙΑ ΣΤΟ CPAP')::numeric end,
      case when r.d->>'ΗΜΕΡΕΣ ΣΥΝΟΛΙΚΗΣ ΧΟΡΗΓΗΣΗ ΟΞΥΓΟΝΟΥ' ~ v_num then (r.d->>'ΗΜΕΡΕΣ ΣΥΝΟΛΙΚΗΣ ΧΟΡΗΓΗΣΗ ΟΞΥΓΟΝΟΥ')::numeric end,
      case btrim(coalesce(r.d->>'ΤΟΠΟΘΕΤΗΣΗ ΟΜΦΑΛΙΚΟΥ ΚΑΘΕΤΗΡΑ', '')) when 'ΝΑΙ' then 'yes' when 'ΟΧΙ' then 'none' end,
      case when r.d->>'ΔΙΑΡΚΕΙΑ ΦΛΕΒΙΚΟΥ ΚΑΘΕΤΗΡΑ' ~ v_num then (r.d->>'ΔΙΑΡΚΕΙΑ ΦΛΕΒΙΚΟΥ ΚΑΘΕΤΗΡΑ')::numeric end,
      case when r.d->>'ΔΙΑΡΚΕΙΑ ΑΡΤΗΡΙΑΚΟΥ ΚΑΘΕΤΗΡΑ' ~ v_num then (r.d->>'ΔΙΑΡΚΕΙΑ ΑΡΤΗΡΙΑΚΟΥ ΚΑΘΕΤΗΡΑ')::numeric end,
      case when r.d->>'ΔΙΑΡΚΕΙΑ TPN' ~ v_num then (r.d->>'ΔΙΑΡΚΕΙΑ TPN')::numeric end,
      r.d->>'ΣΙΤΙΣΗ ΜΕ ΡΙΝΟΓΑΣΤΡΙΚΟ' = 'Ναι',
      case when v_bottle <> '' then true end,
      case when v_bottle ~ '^\d{1,2}/\d{1,2}/\d{4}$' then to_date(v_bottle, 'DD/MM/YYYY') end,
      case when v_milk like 'ΝΑΙ%' then 'kept' when v_milk like 'ΟΧΙ%' then 'none' end,
      false, r.d->>'ΕΠΙΒΕΒΑΙΩΜ. ΕΝΔΟΝΟΣ. ΛΟΙΜΩΞΗ' = 'Ναι',
      v_out,
      case when r.d->>'ΒΑΡΟΣ ΕΞΟΔΟΥ' ~ v_num then (r.d->>'ΒΑΡΟΣ ΕΞΟΔΟΥ')::numeric end,
      case when v_outcome like '%ΑΡΝΗΣΗ%' then 'against_advice' when v_outcome like 'ΔΙΑΚΟΜΙΔΗ%' then 'transfer_hospital'
           when v_outcome like 'ΜΕΤΑΦΟΡΑ%' then 'transfer_ward' when v_outcome like '%ΘΑΝΑΤΟΣ%' then 'death'
           when v_outcome ~ '^(E|Ε)?Ε?Ξ(Ο|Δ)' then 'home' end,
      case when v_outcome ~ '^(ΔΙΑΚΟΜΙΔΗ|ΜΕΤΑΦΟΡΑ)' then nullif(btrim(regexp_replace(r.d->>'ΕΚΒΑΣΗ', '^\s*(ΔΙΑΚΟΜΙΔΗ|ΜΕΤΑΦΟΡΑ)\s*(-|ΣΤΟΝ|ΣΤΟ|ΣΤΗ)?\s*', '')), '') end,
      case when r.d->>'ΗΛΙΚΙΑ ΕΙΣΑΓΩΓΗΣ ΣΕ ΩΡΕΣ' ~ v_num then (r.d->>'ΗΛΙΚΙΑ ΕΙΣΑΓΩΓΗΣ ΣΕ ΩΡΕΣ')::numeric end)
    on conflict do nothing;
    insert into public.register_nicu_677c3c7b_identity (entry_id, organization_id, department_id, case_number, patient_name)
    values (v_id, private.fm_org(), v_department, nullif(r.d->>'ΑΡΙΘΜΟΣ ΠΕΡΙΣΤΑΤΙΚΟΥ', ''), private.fm_text(r.d->>'ΟΝΟΜΑΤΕΠΩΝΥΜΟ ΝΕΟΓΝΟΥ'))
    on conflict do nothing;
    insert into public.fm_stage_links (base_table, record_id, target_table, target_id, how, note, linked_at)
    values ('Indicator ΜΕΝΝ', r.record_id, 'register_nicu_677c3c7b', v_id, 'created', 'daily sync', now()) on conflict do nothing;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function private.fm_sync_tables()
returns text[] language sql immutable set search_path = '' as $$
  select array['PerformedControls', 'People', 'Departments', 'Controls', 'Training', 'Training Participants', 'Meeting_REVIEWS', 'Μeeting_Decisions',
               'Commitees', 'Commitees_REVIEWS', 'Commitees_Decisions', 'IncidentManagement', 'Death',
               'Indicators TEP', 'Indicators Α.Τ', 'Indicators Ενδοσκοπικό', 'Indicators eyelab', 'Indicator ΜΕΝΝ']
$$;

create or replace function private.fm_sync_indicators()
returns integer language plpgsql security definer set search_path = '' as $$
begin
  return private.fm_sync_counts('Indicators TEP', 'public.register_emergency_f6ceb2a5', 1678, '{
      "admissions__morning@07:00-15:00": "ΕΙΣΑΓΩΓΕΣ", "admissions__afternoon@15:00-23:00": "ΕΙΣΑΓΩΓΕΣ", "admissions__night@23:00-07:00": "ΕΙΣΑΓΩΓΕΣ",
      "assessments__morning@07:00-15:00": "ΕΚΤΙΜΗΣΕΙΣ", "assessments__afternoon@15:00-23:00": "ΕΚΤΙΜΗΣΕΙΣ", "assessments__night@23:00-07:00": "ΕΚΤΙΜΗΣΕΙΣ",
      "checkup__morning@07:00-15:00": "CHECK UP", "checkup__afternoon@15:00-23:00": "CHECK UP", "checkup__night@23:00-07:00": "CHECK UP",
      "dressings__morning@07:00-15:00": "ΑΛΛΑΓΕΣ", "dressings__afternoon@15:00-23:00": "ΑΛΛΑΓΕΣ", "dressings__night@23:00-07:00": "ΑΛΛΑΓΕΣ",
      "preop__morning@07:00-15:00": "ΠΡΟΕΓΧΕΙΡΗΤΙΚΟΣ", "preop__afternoon@15:00-23:00": "ΠΡΟΕΓΧΕΙΡΗΤΙΚΟΣ", "preop__night@23:00-07:00": "ΠΡΟΕΓΧΕΙΡΗΤΙΚΟΣ",
      "septic__morning@07:00-15:00": "ΣΗΠΤΙΚΑ", "septic__afternoon@15:00-23:00": "ΣΗΠΤΙΚΑ", "septic__night@23:00-07:00": "ΣΗΠΤΙΚΑ",
      "surgical__morning@07:00-15:00": "ΧΕΙΡΟΥΡΓΕΙΑ", "surgical__afternoon@15:00-23:00": "ΧΕΙΡΟΥΡΓΕΙΑ", "surgical__night@23:00-07:00": "ΧΕΙΡΟΥΡΓΕΙΑ",
      "urgent__morning@07:00-15:00": "ΕΚΤΑΚΤΑ", "urgent__afternoon@15:00-23:00": "ΕΚΤΑΚΤΑ", "urgent__night@23:00-07:00": "ΕΚΤΑΚΤΑ"}'::jsonb)
  + private.fm_sync_counts('Indicators Α.Τ', 'public.register_deliveryroom_c1b3757d', 1013, '{
      "cs__count": "Κ.Τ", "vaginal__count": "Φ.Τ", "vbac__count": "Vbac", "septic__count": "Σηπτικά", "hysteroscopy__count": "Υστεροσκοπήσεις",
      "multiple_cs__count": "Πολυδ κύηση με κτ", "multiple_vaginal__count": "Πολυδ κύηση με φτ", "pregnancy_monitoring__count": "Παρακολούθηση κύησης",
      "cerclage__count": "Περίδεση", "born_before_arrival__count": "Τεκετοί εν τη πόλη"}'::jsonb)
  + private.fm_sync_counts('Indicators Ενδοσκοπικό', 'public.register_endoscopy_da85fba4', 777, '{
      "bronchoscopy__count": "Βρογχοσκοπήσεις", "colonoscopy__count": "Κολονοσκοπήσεις", "cystoscopy__count": "Κυστεοσκοπήσεις", "ebus__count": "EBUS",
      "ercp__count": "ERCP", "eus__count": "EUS", "gastroscopy__count": "Γαστροσκοπήσεις", "gastrostomy__count": "Γαστροστομίες"}'::jsonb)
  + private.fm_sync_counts('Indicators eyelab', 'public.register_ophthalmology_bbea9bde', 400, '{
      "cataract__count": "Καταράκτες", "intravitreal__count": "Ενδοϋαλικές εγχύσεις", "other_local__count": "Διάφορα με τοπική", "vitrectomy__count": "Βιτρεκτομές"}'::jsonb)
  + private.fm_sync_nicu();
end;
$$;
