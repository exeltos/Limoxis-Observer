-- Κρατά ΜΟΝΟ 1 θάνατο (Παθολογική) και 1 μαιευτικό συμβάν (Αίθουσα Τοκετών) στο ΙΑΣΩ ΘΕΣΣΑΛΙΑΣ
-- και σβήνει όλα τα άλλα συμβάντα του ίδιου νοσοκομείου.
-- Τα 4 demo νοσοκομεία ΔΕΝ αγγίζονται. Τρέχει από τον ιδιοκτήτη στο SQL Editor.
-- Κρατιούνται: INC-261014-001492 (θάνατος, Παθολογική) και INC-260922-001484 (μαιευτικό, Αίθουσα Τοκετών).
-- Πρώτα τρέξε ΜΟΝΟ το select (έλεγχος), μετά το begin…commit.

-- 1) Έλεγχος: πόσα θα σβηστούν (αναμένεται 633 - 2 = 631)
select count(*) as tha_svistoun
from public.quality_incidents
where organization_id = (select id from public.organizations where name = 'ΙΑΣΩ ΘΕΣΣΑΛΙΑΣ')
  and code not in ('INC-261014-001492', 'INC-260922-001484');

-- 2) Διαγραφή (οι υποπίνακες falls/sharps/blue_codes/obstetric ακολουθούν με cascade· αν όχι, θα σταματήσει με σφάλμα)
begin;
select set_config('request.jwt.claims', '{"sub":"84066ee0-57b7-4cae-9186-09e491d3ea6d","role":"authenticated"}', true);

do $$
declare n int;
begin
  delete from public.quality_incidents
  where organization_id = (select id from public.organizations where name = 'ΙΑΣΩ ΘΕΣΣΑΛΙΑΣ')
    and code not in ('INC-261014-001492', 'INC-260922-001484');
  get diagnostics n = row_count;
  if n <> 631 then raise exception 'unexpected row count %', n; end if;
end $$;

commit;

-- 3) Επιβεβαίωση (αναμένεται 2)
select count(*) from public.quality_incidents
where organization_id = (select id from public.organizations where name = 'ΙΑΣΩ ΘΕΣΣΑΛΙΑΣ');
