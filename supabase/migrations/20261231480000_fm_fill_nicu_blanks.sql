-- Μητρώο ΜΕΝΝ: συμπλήρωση των ΚΕΝΩΝ πεδίων νεογνών που υπάρχουν ήδη στο μητρώο, από το FileMaker (12/11/2026,
-- εγκρίθηκε από τον ιδιοκτήτη). Ο νυχτερινός συγχρονισμός (fm_sync_nicu) μεταφέρει ένα νεογνό μόνο όταν δεν υπάρχει
-- στο μητρώο· όσα είχαν περαστεί νωρίτερα (π.χ. με την εισαγωγή) έμεναν χωρίς έξοδο, έκβαση, APGAR κ.ά. που συμπληρώθηκαν
-- αργότερα στο FileMaker. Εδώ ΜΟΝΟ γεμίζουν κενά πεδία: ό,τι έχει ήδη τιμή στην πλατφόρμα δεν αλλάζει ποτέ, και οι
-- κλειδωμένες εγγραφές δεν αγγίζονται. Αντιστοίχιση: αριθμός περιστατικού + ημερομηνία εισαγωγής στη ΜΕΝΝ.
create or replace function private.fm_fill_nicu()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_count integer := 0;
  v_num constant text := '^-?[0-9]+(\.[0-9]+)?$';
begin
  with src as (
    select distinct on (i.entry_id) i.entry_id, s.data as d
    from public.fm_stage_records s
    join public.register_nicu_677c3c7b_identity i on i.case_number = s.data->>'ΑΡΙΘΜΟΣ ΠΕΡΙΣΤΑΤΙΚΟΥ'
    join public.register_nicu_677c3c7b r on r.id = i.entry_id and r.admission_date::text = s.data->>'ΗΜΕΡΟΜΗΝΙΑ ΕΙΣΑΓΩΓΗΣ ΜΕΝΝ'
    where s.base_table = 'Indicator ΜΕΝΝ' and s.record_id ~ '^\d+$' and nullif(s.data->>'ΑΡΙΘΜΟΣ ΠΕΡΙΣΤΑΤΙΚΟΥ', '') is not null
    order by i.entry_id, s.record_id::bigint desc
  ),
  p as (
    select entry_id, d,
      upper(btrim(coalesce(d->>'ΕΚΒΑΣΗ', ''))) as outcome_t,
      btrim(coalesce(d->>'ΑΠΟΚΛΕΙΣΤΙΚΗ  ΣΙΤΙΣΗ ΜΕ BIBERON', '')) as bottle_t,
      upper(translate(btrim(coalesce(d->>'ΔΙΑΤΗΡΗΣΗ ΜΗΤΡΙΚΟΥ ΓΑΛΑΚΤΟΣ', '')), 'ΌόNAIOXI', 'ΟΟΝΑΙΟΧΙ')) as milk_t,
      upper(translate(btrim(coalesce(d->>'ΑΝΑΝΗΨΗ', '')), 'ΌόOXI', 'ΟΟΟΧΙ')) as resus_t
    from src
  ),
  v as (
    select entry_id,
      case when d->>'ΗΜΕΡΟΜΗΝΙΑ ΕΞΟΔΟΥ ΑΠΟ ΤΗ  ΜΕΝΝ' ~ '^\d{4}-\d{2}-\d{2}$' then (d->>'ΗΜΕΡΟΜΗΝΙΑ ΕΞΟΔΟΥ ΑΠΟ ΤΗ  ΜΕΝΝ')::date end as discharge_date,
      case when d->>'ΒΑΡΟΣ ΕΞΟΔΟΥ' ~ v_num then (d->>'ΒΑΡΟΣ ΕΞΟΔΟΥ')::numeric end as discharge_weight,
      case when outcome_t like '%ΑΡΝΗΣΗ%' then 'against_advice' when outcome_t like 'ΔΙΑΚΟΜΙΔΗ%' then 'transfer_hospital'
           when outcome_t like 'ΜΕΤΑΦΟΡΑ%' then 'transfer_ward' when outcome_t like '%ΘΑΝΑΤΟΣ%' then 'death'
           when outcome_t ~ '^(E|Ε)?Ε?Ξ(Ο|Δ)' then 'home' end as outcome,
      case when outcome_t ~ '^(ΔΙΑΚΟΜΙΔΗ|ΜΕΤΑΦΟΡΑ)' then nullif(btrim(regexp_replace(d->>'ΕΚΒΑΣΗ', '^\s*(ΔΙΑΚΟΜΙΔΗ|ΜΕΤΑΦΟΡΑ)\s*(-|ΣΤΟΝ|ΣΤΟ|ΣΤΗ)?\s*', '')), '') end as transfer_destination,
      case when d->>'APGAR ΣΤΟ 1ΜΙΝ' ~ v_num then (d->>'APGAR ΣΤΟ 1ΜΙΝ')::numeric end as apgar_1,
      case when d->>'APGAR ΣΤΑ 5ΜΙΝ' ~ v_num then (d->>'APGAR ΣΤΑ 5ΜΙΝ')::numeric end as apgar_5,
      case when resus_t = 'ΟΧΙ' then 'none' when resus_t = 'ΝΑΙ' then 'yes' when resus_t like '%ΔΙΑΣΩΛΗΝΩΣΗ%' then 'intubation'
           when resus_t like '%ΚΑΡΠΑ%' then 'cpr' when resus_t like '%NEOPUFF%' then 'bag_mask' end as resuscitation,
      case when milk_t like 'ΝΑΙ%' then 'kept' when milk_t like 'ΟΧΙ%' then 'none' end as breast_milk,
      case when bottle_t <> '' then true end as bottle_feeding,
      case when bottle_t ~ '^\d{1,2}/\d{1,2}/\d{4}$' then to_date(bottle_t, 'DD/MM/YYYY') end as bottle_start,
      case when d->>'ΗΜΕΡΕΣ ΠΑΡΑΜΟΝΗΣ ΣΤΟΝ ΑΝΑΠΝΕΥΣΤΗΡΑ' ~ v_num then (d->>'ΗΜΕΡΕΣ ΠΑΡΑΜΟΝΗΣ ΣΤΟΝ ΑΝΑΠΝΕΥΣΤΗΡΑ')::numeric end as ventilator_days,
      case when d->>'ΔΙΑΡΚΕΙΑ ΣΤΟ CPAP' ~ v_num then (d->>'ΔΙΑΡΚΕΙΑ ΣΤΟ CPAP')::numeric end as cpap_days,
      case when d->>'ΗΜΕΡΕΣ ΣΥΝΟΛΙΚΗΣ ΧΟΡΗΓΗΣΗ ΟΞΥΓΟΝΟΥ' ~ v_num then (d->>'ΗΜΕΡΕΣ ΣΥΝΟΛΙΚΗΣ ΧΟΡΗΓΗΣΗ ΟΞΥΓΟΝΟΥ')::numeric end as oxygen_days,
      case btrim(coalesce(d->>'ΤΟΠΟΘΕΤΗΣΗ ΟΜΦΑΛΙΚΟΥ ΚΑΘΕΤΗΡΑ', '')) when 'ΝΑΙ' then 'yes' when 'ΟΧΙ' then 'none' end as umbilical_catheter,
      case when d->>'ΔΙΑΡΚΕΙΑ ΦΛΕΒΙΚΟΥ ΚΑΘΕΤΗΡΑ' ~ v_num then (d->>'ΔΙΑΡΚΕΙΑ ΦΛΕΒΙΚΟΥ ΚΑΘΕΤΗΡΑ')::numeric end as central_line_days,
      case when d->>'ΔΙΑΡΚΕΙΑ ΑΡΤΗΡΙΑΚΟΥ ΚΑΘΕΤΗΡΑ' ~ v_num then (d->>'ΔΙΑΡΚΕΙΑ ΑΡΤΗΡΙΑΚΟΥ ΚΑΘΕΤΗΡΑ')::numeric end as arterial_line_days,
      case when d->>'ΔΙΑΡΚΕΙΑ TPN' ~ v_num then (d->>'ΔΙΑΡΚΕΙΑ TPN')::numeric end as tpn_days,
      case when d->>'ΗΛΙΚΙΑ ΕΙΣΑΓΩΓΗΣ ΣΕ ΩΡΕΣ' ~ v_num then (d->>'ΗΛΙΚΙΑ ΕΙΣΑΓΩΓΗΣ ΣΕ ΩΡΕΣ')::numeric end as admission_age_hours
    from p
  )
  update public.register_nicu_677c3c7b r set
    discharge_date = coalesce(r.discharge_date, v.discharge_date),
    discharge_weight = coalesce(r.discharge_weight, v.discharge_weight),
    outcome = coalesce(r.outcome, v.outcome),
    transfer_destination = coalesce(r.transfer_destination, v.transfer_destination),
    apgar_1 = coalesce(r.apgar_1, v.apgar_1),
    apgar_5 = coalesce(r.apgar_5, v.apgar_5),
    resuscitation = coalesce(r.resuscitation, v.resuscitation),
    breast_milk = coalesce(r.breast_milk, v.breast_milk),
    bottle_feeding = coalesce(r.bottle_feeding, v.bottle_feeding),
    bottle_start = coalesce(r.bottle_start, v.bottle_start),
    ventilator_days = coalesce(r.ventilator_days, v.ventilator_days),
    cpap_days = coalesce(r.cpap_days, v.cpap_days),
    oxygen_days = coalesce(r.oxygen_days, v.oxygen_days),
    umbilical_catheter = coalesce(r.umbilical_catheter, v.umbilical_catheter),
    central_line_days = coalesce(r.central_line_days, v.central_line_days),
    arterial_line_days = coalesce(r.arterial_line_days, v.arterial_line_days),
    tpn_days = coalesce(r.tpn_days, v.tpn_days),
    admission_age_hours = coalesce(r.admission_age_hours, v.admission_age_hours),
    updated_at = now()
  from v
  where r.id = v.entry_id and not coalesce(r.locked, false) and (
       (r.discharge_date is null and v.discharge_date is not null) or (r.discharge_weight is null and v.discharge_weight is not null)
    or (r.outcome is null and v.outcome is not null) or (r.transfer_destination is null and v.transfer_destination is not null)
    or (r.apgar_1 is null and v.apgar_1 is not null) or (r.apgar_5 is null and v.apgar_5 is not null)
    or (r.resuscitation is null and v.resuscitation is not null) or (r.breast_milk is null and v.breast_milk is not null)
    or (r.bottle_feeding is null and v.bottle_feeding is not null) or (r.bottle_start is null and v.bottle_start is not null)
    or (r.ventilator_days is null and v.ventilator_days is not null) or (r.cpap_days is null and v.cpap_days is not null)
    or (r.oxygen_days is null and v.oxygen_days is not null) or (r.umbilical_catheter is null and v.umbilical_catheter is not null)
    or (r.central_line_days is null and v.central_line_days is not null) or (r.arterial_line_days is null and v.arterial_line_days is not null)
    or (r.tpn_days is null and v.tpn_days is not null) or (r.admission_age_hours is null and v.admission_age_hours is not null));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Ο νυχτερινός συγχρονισμός συμπληρώνει πλέον και τα κενά των υπαρχόντων νεογνών (όπως fm_sync_indicators στο 20261211160000, με μία γραμμή παραπάνω).
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
  + private.fm_sync_nicu()
  + private.fm_fill_nicu();
end;
$$;
