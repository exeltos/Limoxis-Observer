-- Εικόνα νοσοκομείου › «Απόδοση περιόδου» (ιδιοκτήτης 16/11/2026): νοσοκομειακές βακτηριαιμίες, δείκτης που το νοσοκομείο
-- ήδη καταγράφει (επεισόδιο αιμοκαλλιέργειας με hospital_acquired) και συγκρίνεται με την ίδια περίοδο πέρσι.
-- Νέο κλειδί surveillance.hospitalBacteremia στο analysis_domain_metrics, πάνω στο ίδιο sc (περίοδος, τμήμα, module).
do $patch$
declare
  v_def text := pg_get_functiondef('public.analysis_domain_metrics(uuid,date,date,uuid)'::regprocedure);
  v_old text := $q$'haiConfirmed',(select count(*) from hai where case_status='confirmed'),$q$;
  v_new text := $q$'haiConfirmed',(select count(*) from hai where case_status='confirmed'),
      'hospitalBacteremia',(select count(*) from sc where case_kind='blood_culture' and hospital_acquired is true),$q$;
begin
  if position('hospitalBacteremia' in v_def) > 0 then raise notice 'already patched'; return; end if;
  if position(v_old in v_def) = 0 then raise exception 'analysis_domain_metrics: anchor not found'; end if;
  v_def := replace(v_def, v_old, v_new);
  execute v_def;
end
$patch$;
