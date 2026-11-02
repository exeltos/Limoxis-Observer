-- Ένας αριθμός για τα πολυανθεκτικά (απόφαση ιδιοκτήτη 2/11/2026): «ασθενείς με πολυανθεκτικό στέλεχος», κάθε ασθενής μία
-- φορά, από θετικά επικυρωμένα αποτελέσματα MDR/XDR/PDR, χωρίς δείγματα περιβάλλοντος και χωρίς δείγματα χωρίς ασθενή.
-- 1) Δείκτης «Νέες απομονώσεις MDR» (mdr_isolation_total): όλοι οι μικροοργανισμοί, όχι μόνο οι οκτώ της λίστας
--    (ΙΑΣΩ 2026: 26 → 33)· και τα περιβαλλοντικά είδη δείγματος μένουν έξω (όχι μόνο ο τύπος υποκειμένου).
-- 2) public.analysis_mdr_patients: ο ίδιος αριθμός για την «Εικόνα νοσοκομείου» (Σύνοψη, Λοιμώξεις & μικροβιολογία).
--    SECURITY INVOKER: διαβάζει μόνο ό,τι επιτρέπουν στον χρήστη οι κανόνες πρόσβασης των πινάκων.
do $patch$
declare
  v_def text := pg_get_functiondef('private.indicator_metric_snapshot(uuid,date,date,uuid)'::regprocedure);
  v_old_total text := $q$    count(distinct l.patient_id) filter(where lower(coalesce(m.organism,'')) like '%escherichia coli%' or lower(coalesce(m.organism,'')) like '%proteus%' or lower(coalesce(m.organism,'')) like '%acinetobacter%' or lower(coalesce(m.organism,'')) like '%klebsiella%' or lower(coalesce(m.organism,'')) like '%enterobacter%' or lower(coalesce(m.organism,'')) like '%pseudomonas%' or lower(coalesce(m.organism,'')) like '%staphylococcus aureus%' or lower(coalesce(m.organism,'')) like '%enterococcus%'),
    count(distinct l.patient_id) filter(where lower(coalesce(m.organism,'')) like '%escherichia coli%'),$q$;
  v_new_total text := $q$    count(distinct l.patient_id),
    count(distinct l.patient_id) filter(where lower(coalesce(m.organism,'')) like '%escherichia coli%'),$q$;
  v_old_where text := $q$  where l.organization_id=p_organization_id and l.patient_id is not null and coalesce(l.subject_type,'patient')<>'environment' and l.collected_at::date between p_from and p_to$q$;
  v_new_where text := $q$  where l.organization_id=p_organization_id and l.patient_id is not null and coalesce(l.subject_type,'patient')<>'environment' and coalesce(l.sample_type,'') not in ('surface','water','equipment','air','environment') and l.collected_at::date between p_from and p_to$q$;
begin
  if position(v_new_where in v_def) > 0 then raise notice 'already patched'; return; end if;
  if position(v_old_total in v_def) = 0 or position(v_old_where in v_def) = 0 then raise exception 'indicator_metric_snapshot: anchors not found'; end if;
  execute replace(replace(v_def, v_old_total, v_new_total), v_old_where, v_new_where);
end
$patch$;

create or replace function public.analysis_mdr_patients(p_organization_id uuid, p_from date default null, p_to date default null, p_department_id uuid default null)
returns integer
language sql
stable
security invoker
set search_path to ''
as $function$
  select count(distinct l.patient_id)::integer
  from public.microbiology_results m
  join public.laboratory_samples l on l.id = m.sample_id and l.organization_id = m.organization_id
  where m.organization_id = p_organization_id
    and l.patient_id is not null
    and coalesce(l.subject_type, 'patient') <> 'environment'
    and coalesce(l.sample_type, '') not in ('surface', 'water', 'equipment', 'air', 'environment')
    and (p_department_id is null or l.department_id = p_department_id)
    and (p_from is null or l.collected_at::date >= p_from)
    and (p_to is null or l.collected_at::date <= p_to)
    and m.result_status = 'positive' and m.validation_status in ('validated', 'amended')
    and not exists (select 1 from public.microbiology_results m2 where m2.organization_id = m.organization_id and m2.amended_from = m.id)
    and (upper(coalesce(m.resistance_class, '')) in ('MDR', 'XDR', 'PDR')
      or exists (select 1 from public.amr_classifications a where a.organization_id = m.organization_id and a.microbiology_result_id = m.id
        and a.status <> 'rejected' and upper(coalesce(a.classification, '')) in ('MDR', 'XDR', 'PDR')));
$function$;
