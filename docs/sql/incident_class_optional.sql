-- Να το τρέξει ο ιδιοκτήτης στο SQL Editor (αλλαγή σε υπάρχοντα πίνακα).
-- Το έντυπο του ΟΔΙΠΥ δεν έχει «παρ' ολίγον / έφτασε στον ασθενή»: το πεδίο μένει κενό όταν δεν συμπληρώνεται,
-- αντί να γράφεται αυτόματα «Παρ' ολίγον».
alter table public.quality_incidents alter column incident_class drop default;
alter table public.quality_incidents alter column incident_class drop not null;
