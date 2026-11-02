-- «Ληγμένα πιστοποιητικά» (analysis_quality_food_metrics → qualityFood.certificatesExpired): μετρούσε και πιστοποιητικά
-- που έχουν ήδη αντικατασταθεί από νεότερο του ίδιου τύπου στον ίδιο προμηθευτή (ΙΑΣΩ 2/11/2026: 285, ενώ εκκρεμούν 195).
-- Τώρα μετρά μόνο όσα δεν έχουν ανανεωθεί (το ίδιο και για όσα λήγουν σε 60 ημέρες) και δίνει και σε πόσους προμηθευτές.
do $patch$
declare
  v_def text := pg_get_functiondef('public.analysis_quality_food_metrics(uuid,date,date,uuid)'::regprocedure);
  v_old_ce text := E'    select c.expires_on from public.quality_supplier_certifications c\n    join sp on sp.id = c.supplier_id\n    where c.expires_on is not null and c.expires_on <= v_today + 60';
  v_new_ce text := E'    select c.expires_on, c.supplier_id from public.quality_supplier_certifications c\n    join sp on sp.id = c.supplier_id\n    where c.expires_on is not null and c.expires_on <= v_today + 60\n      and not exists (select 1 from public.quality_supplier_certifications r where r.supplier_id = c.supplier_id and r.certificate_type is not distinct from c.certificate_type and r.expires_on > c.expires_on)';
  v_old_key text := $q$'certificatesExpired', (select count(*) from ce where ce.expires_on < v_today),$q$;
  v_new_key text := $q$'certificatesExpired', (select count(*) from ce where ce.expires_on < v_today),
    'certificatesExpiredSuppliers', (select count(distinct ce.supplier_id) from ce where ce.expires_on < v_today),$q$;
begin
  if position('certificatesExpiredSuppliers' in v_def) > 0 then raise notice 'already patched'; return; end if;
  if position(v_old_ce in v_def) = 0 or position(v_old_key in v_def) = 0 then raise exception 'analysis_quality_food_metrics: anchors not found'; end if;
  v_def := replace(replace(v_def, v_old_ce, v_new_ce), v_old_key, v_new_key);
  execute v_def;
end
$patch$;
