-- Δείκτες πλατφόρμας (ζητήθηκε από τον ιδιοκτήτη 31/10/2026), διόρθωση του υπολογισμού στο private.indicator_metric_snapshot:
-- 1) Κλινοημέρες, αντισηπτικό (litres) και DDD από περιόδους που επικαλύπτουν το διάστημα αναλογούν στις ημέρες που επικαλύπτουν
--    (πριν μετρούσαν μόνο περίοδοι ολόκληρες μέσα στο διάστημα: μια ετήσια εγγραφή 2026 έδινε 0 για 1/1–31/10).
-- 2) Βακτηριαιμίες: ένα επεισόδιο ανά ασθενή και μικροοργανισμό ανά 14 ημέρες (όχι κάθε θετική καλλιέργεια).
-- Η συνάρτηση ξαναδημιουργείται από τον ίδιο τον ορισμό της με αντικατάσταση συγκεκριμένων τμημάτων· αν κάποιο τμήμα δεν βρεθεί, η migration αποτυγχάνει.
do $$
declare
  d text := pg_get_functiondef('private.indicator_metric_snapshot(uuid,date,date,uuid)'::regprocedure);
  n int;
  procedure_marker text := '-- prorated_deduped_20261231';
begin
  if position('prorated_deduped_20261231' in d) > 0 then return; end if;

  -- 1a) κλινοημέρες
  n := (length(d) - length(replace(d, 'select coalesce(sum(pp.patient_days),0) into v_patient_days from public.patient_day_periods pp where pp.organization_id=p_organization_id and pp.period_start>=p_from and pp.period_end<=p_to', ''))) / length('select coalesce(sum(pp.patient_days),0) into v_patient_days from public.patient_day_periods pp where pp.organization_id=p_organization_id and pp.period_start>=p_from and pp.period_end<=p_to');
  if n <> 1 then raise exception 'patient days block not found (%)', n; end if;
  d := replace(d, 'select coalesce(sum(pp.patient_days),0) into v_patient_days from public.patient_day_periods pp where pp.organization_id=p_organization_id and pp.period_start>=p_from and pp.period_end<=p_to',
    'select coalesce(round(sum(pp.patient_days*(least(pp.period_end,p_to)-greatest(pp.period_start,p_from)+1)::numeric/nullif(pp.period_end-pp.period_start+1,0))),0) into v_patient_days from public.patient_day_periods pp where pp.organization_id=p_organization_id and pp.period_start<=p_to and pp.period_end>=p_from');

  -- 1b) αντισηπτικό
  n := (length(d) - length(replace(d, 'select coalesce(sum(a.litres),0) into v_abhr from public.antiseptic_consumption_periods a where a.organization_id=p_organization_id and a.period_start>=p_from and a.period_end<=p_to', ''))) / length('select coalesce(sum(a.litres),0) into v_abhr from public.antiseptic_consumption_periods a where a.organization_id=p_organization_id and a.period_start>=p_from and a.period_end<=p_to');
  if n <> 1 then raise exception 'abhr block not found (%)', n; end if;
  d := replace(d, 'select coalesce(sum(a.litres),0) into v_abhr from public.antiseptic_consumption_periods a where a.organization_id=p_organization_id and a.period_start>=p_from and a.period_end<=p_to',
    'select coalesce(sum(a.litres*(least(a.period_end,p_to)-greatest(a.period_start,p_from)+1)::numeric/nullif(a.period_end-a.period_start+1,0)),0) into v_abhr from public.antiseptic_consumption_periods a where a.organization_id=p_organization_id and a.period_start<=p_to and a.period_end>=p_from');

  -- 1c) DDD
  if position('select coalesce(sum(d.quantity_grams / (' in d) = 0 or position('where d.organization_id=p_organization_id and d.period_start>=p_from and d.period_end<=p_to' in d) = 0 then raise exception 'ddd block not found'; end if;
  d := replace(d, 'select coalesce(sum(d.quantity_grams / (', 'select coalesce(sum(d.quantity_grams*(least(d.period_end,p_to)-greatest(d.period_start,p_from)+1)::numeric/nullif(d.period_end-d.period_start+1,0) / (');
  d := replace(d, 'where d.organization_id=p_organization_id and d.period_start>=p_from and d.period_end<=p_to', 'where d.organization_id=p_organization_id and d.period_start<=p_to and d.period_end>=p_from');

  -- 2) βακτηριαιμίες: ένα επεισόδιο ανά ασθενή και μικροοργανισμό ανά 14 ημέρες
  n := (length(d) - length(replace(d, 'like ''%blood%''));', ''))) / length('like ''%blood%''));');
  if n <> 1 then raise exception 'bacteraemia block not found (%)', n; end if;
  d := replace(d, 'like ''%blood%''));', 'like ''%blood%''))
    and not exists(
      select 1 from public.microbiology_results m3
      join public.laboratory_samples l3 on l3.id=m3.sample_id and l3.organization_id=m3.organization_id
      left join public.master_library_items st3 on st3.id=l3.specimen_type_id and st3.organization_id=l3.organization_id and st3.library_key=''sampleTypes'' and st3.is_active=true
      left join public.microbiology_result_organisms o3 on o3.microbiology_result_id=m3.id and o3.organization_id=m3.organization_id
      where m3.organization_id=m.organization_id and m3.id<>m.id and m3.result_status=''positive'' and m3.validation_status in (''validated'',''amended'')
        and not exists(select 1 from public.microbiology_results m4 where m4.organization_id=m3.organization_id and m4.amended_from=m3.id)
        and l.patient_id is not null and l3.patient_id=l.patient_id and coalesce(l3.subject_type,''patient'')=''patient''
        and (st3.code=''SAMPLE-BLOOD'' or (st3.id is null and lower(coalesce(l3.sample_type,'''')) like ''%blood%''))
        and l3.collected_at<l.collected_at and l3.collected_at>=l.collected_at-interval ''14 days''
        and private.canonical_microbiology_organism(coalesce(nullif(btrim(o3.organism),''''),m3.organism))=org.organism);');

  d := replace(d, E'begin\n  if (select auth.uid()) is null', E'begin\n  ' || procedure_marker || E'\n  if (select auth.uid()) is null');
  if position('prorated_deduped_20261231' in d) = 0 then raise exception 'marker not placed'; end if;
  execute d;
end $$;
