-- Ο δείκτης «μηνιαία επίπτωση βακτηριαιμιών από πολυανθεκτικά» υπήρχε ήδη ως mdro-bsi-rate (ίδια μετρική):
-- ο διπλός mdro-bsi-per-1000-patient-days αποσύρεται και ο υπάρχων παίρνει τον τίτλο του κανονισμού και στόχο ≤ 1.
-- Γράφεται στο ιστορικό ως ο γενικός λογαριασμός «Platform Owner».
do $$
begin
  perform set_config('request.jwt.claims', '{"sub":"84066ee0-57b7-4cae-9186-09e491d3ea6d","role":"authenticated"}', true);
  update public.indicator_definitions set status = 'retired'
  where organization_id is null and indicator_key = 'mdro-bsi-per-1000-patient-days';
  update public.indicator_definitions
  set title_el = 'Μηνιαία επίπτωση βακτηριαιμιών από πολυανθεκτικά παθογόνα',
      title_en = 'Monthly incidence of bacteraemia from multidrug-resistant pathogens',
      target_value = coalesce(target_value, 1), direction = 'lower'
  where organization_id is null and indicator_key = 'mdro-bsi-rate' and status = 'active';
end $$;
