-- Αρχική (dashboard_metrics): τα «Ληγμένα πιστοποιητικά» μετρούσαν και όσα έχουν ήδη αντικατασταθεί από νεότερο του ίδιου
-- τύπου στον ίδιο προμηθευτή (ΙΑΣΩ 16/11/2026: 341 στην Αρχική, 198 στην Εικόνα νοσοκομείου). Τώρα μετρά όπως η Ανάλυση
-- (20261231221100): μόνο όσα δεν έχουν ανανεωθεί· το ίδιο και για όσα λήγουν σύντομα.
do $patch$
declare
  v_def text := pg_get_functiondef('public.dashboard_metrics(uuid,uuid[])'::regprocedure);
  v_renewed text := ' and not exists (select 1 from public.quality_supplier_certifications r where r.supplier_id = c.supplier_id and r.certificate_type is not distinct from c.certificate_type and r.expires_on > c.expires_on)';
  v_old_expired text := $q$and c.expires_on is not null and c.expires_on < params.today),$q$;
  v_old_expiring text := $q$and c.expires_on >= params.today and c.expires_on <= params.soon),$q$;
begin
  if position('r.expires_on > c.expires_on' in v_def) > 0 then raise notice 'already patched'; return; end if;
  if position(v_old_expired in v_def) = 0 or position(v_old_expiring in v_def) = 0 then raise exception 'dashboard_metrics: anchors not found'; end if;
  v_def := replace(v_def, v_old_expired, replace(v_old_expired, '),', v_renewed || '),'));
  v_def := replace(v_def, v_old_expiring, replace(v_old_expiring, '),', v_renewed || '),'));
  execute v_def;
end
$patch$;
