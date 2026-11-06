-- Οι βακτηριαιμίες ανά μικρόβιο γίνονται ενημερωτικοί δείκτες: χωρίς προεπιλεγμένο στόχο (στόχοι του νοσοκομείου
-- μένουν η συνολική επίπτωση βακτηριαιμιών και τα πολυανθεκτικά). Εμφανίζονται στους Δείκτες με «Όλοι», χωρίς
-- «Χρειάζεται προσοχή». Γράφεται στο ιστορικό ως ο γενικός λογαριασμός «Platform Owner».
do $$
begin
  perform set_config('request.jwt.claims', '{"sub":"84066ee0-57b7-4cae-9186-09e491d3ea6d","role":"authenticated"}', true);
  update public.indicator_definitions
  set target_value = null
  where organization_id is null
    and indicator_key in ('bacteremia-acinetobacter-rate', 'bacteremia-ecoli-rate', 'bacteremia-enterobacter-rate', 'bacteremia-enterococcus-rate',
      'bacteremia-klebsiella-rate', 'bacteremia-proteus-rate', 'bacteremia-pseudomonas-rate', 'bacteremia-saureus-rate');
end $$;
