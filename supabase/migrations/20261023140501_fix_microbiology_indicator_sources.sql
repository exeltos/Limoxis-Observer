-- Keep the indicator engine aligned with analysis_microbiology_findings.
-- MDR bloodstream infection and bacteremia metrics use current validated results,
-- the exact SAMPLE-BLOOD library item and relational organisms when available.

do $patch$
declare
  v_def text;
  v_start integer;
  v_rel_end integer;
  v_end integer;
  v_new text;
begin
  select pg_get_functiondef('private.indicator_metric_snapshot(uuid,date,date,uuid)'::regprocedure) into v_def;

  v_start := strpos(v_def, '  select count(distinct m.id) into v_mdro');
  if v_start = 0 then raise exception 'mdro block start not found'; end if;
  v_rel_end := strpos(substr(v_def, v_start), E'  select\n    count(distinct m.id) filter');
  if v_rel_end = 0 then raise exception 'mdro block end not found'; end if;
  v_end := v_start + v_rel_end - 1;
  v_new := $sql$  select count(distinct m.id) into v_mdro
  from public.microbiology_results m
  join public.laboratory_samples l on l.id=m.sample_id and l.organization_id=m.organization_id
  left join public.master_library_items st on st.id=l.specimen_type_id and st.organization_id=l.organization_id and st.library_key='sampleTypes' and st.is_active=true
  where m.organization_id=p_organization_id
    and m.result_status='positive'
    and m.validation_status in ('validated','amended')
    and not exists(select 1 from public.microbiology_results m2 where m2.organization_id=m.organization_id and m2.amended_from=m.id)
    and l.collected_at::date between p_from and p_to
    and (p_department_id is null or l.department_id=p_department_id)
    and coalesce(l.subject_type,'patient')='patient'
    and (st.code='SAMPLE-BLOOD' or (st.id is null and lower(coalesce(l.sample_type,'')) like '%blood%'))
    and (upper(coalesce(m.resistance_class,'')) in ('MDR','XDR','PDR') or exists(select 1 from public.amr_classifications a where a.organization_id=p_organization_id and a.microbiology_result_id=m.id and a.status<>'rejected' and upper(coalesce(a.classification,'')) in ('MDR','XDR','PDR')));
$sql$;
  v_def := substr(v_def,1,v_start-1) || v_new || substr(v_def,v_end);

  v_start := strpos(v_def, E'  select\n    count(distinct m.id) filter');
  if v_start = 0 then raise exception 'bacteremia block start not found'; end if;
  v_rel_end := strpos(substr(v_def, v_start), E'  select\n    count(*) filter(where lower(coalesce(a.organism');
  if v_rel_end = 0 then raise exception 'bacteremia block end not found'; end if;
  v_end := v_start + v_rel_end - 1;
  v_new := $sql$  select
    count(distinct m.id) filter(where lower(coalesce(org.organism,'')) like '%escherichia coli%' or lower(coalesce(org.organism,'')) like '%proteus%' or lower(coalesce(org.organism,'')) like '%acinetobacter%' or lower(coalesce(org.organism,'')) like '%klebsiella%' or lower(coalesce(org.organism,'')) like '%enterobacter%' or lower(coalesce(org.organism,'')) like '%pseudomonas%' or lower(coalesce(org.organism,'')) like '%staphylococcus aureus%' or lower(coalesce(org.organism,'')) like '%enterococcus%'),
    count(distinct m.id) filter(where lower(coalesce(org.organism,'')) like '%escherichia coli%'),
    count(distinct m.id) filter(where lower(coalesce(org.organism,'')) like '%proteus%'),
    count(distinct m.id) filter(where lower(coalesce(org.organism,'')) like '%acinetobacter%'),
    count(distinct m.id) filter(where lower(coalesce(org.organism,'')) like '%klebsiella%'),
    count(distinct m.id) filter(where lower(coalesce(org.organism,'')) like '%enterobacter%'),
    count(distinct m.id) filter(where lower(coalesce(org.organism,'')) like '%pseudomonas%'),
    count(distinct m.id) filter(where lower(coalesce(org.organism,'')) like '%staphylococcus aureus%'),
    count(distinct m.id) filter(where lower(coalesce(org.organism,'')) like '%enterococcus%')
  into v_bact_total,v_bact_ecoli,v_bact_proteus,v_bact_acineto,v_bact_kleb,v_bact_entb,v_bact_pseudo,v_bact_saureus,v_bact_entc
  from public.microbiology_results m
  join public.laboratory_samples l on l.id=m.sample_id and l.organization_id=m.organization_id
  left join public.master_library_items st on st.id=l.specimen_type_id and st.organization_id=l.organization_id and st.library_key='sampleTypes' and st.is_active=true
  join lateral (
    select private.canonical_microbiology_organism(o.organism) as organism
    from public.microbiology_result_organisms o
    where o.organization_id=m.organization_id and o.microbiology_result_id=m.id and nullif(btrim(o.organism),'') is not null
      and o.organism not in ('Ανάπτυξη χλωρίδας ανωτέρας','Αναπτύχθηκαν 3 είδη μικροβίων')
    union all
    select private.canonical_microbiology_organism(m.organism)
    where not exists(select 1 from public.microbiology_result_organisms ox where ox.organization_id=m.organization_id and ox.microbiology_result_id=m.id and nullif(btrim(ox.organism),'') is not null and ox.organism not in ('Ανάπτυξη χλωρίδας ανωτέρας','Αναπτύχθηκαν 3 είδη μικροβίων'))
      and nullif(btrim(m.organism),'') is not null
  ) org on true
  where m.organization_id=p_organization_id
    and m.result_status='positive'
    and m.validation_status in ('validated','amended')
    and not exists(select 1 from public.microbiology_results m2 where m2.organization_id=m.organization_id and m2.amended_from=m.id)
    and l.collected_at::date between p_from and p_to
    and (p_department_id is null or l.department_id=p_department_id)
    and coalesce(l.subject_type,'patient')='patient'
    and (st.code='SAMPLE-BLOOD' or (st.id is null and lower(coalesce(l.sample_type,'')) like '%blood%'));
$sql$;
  v_def := substr(v_def,1,v_start-1) || v_new || substr(v_def,v_end);

  execute v_def;
end
$patch$;
