-- Να το τρέξει ο ιδιοκτήτης στο SQL Editor (αλλαγή σε υπάρχοντα πίνακα).
-- Η σοβαρότητα ενός συμβάντος μπορεί να μείνει κενή, για να την ορίσει η Ποιότητα
-- (τα 257 συμβάντα του FileMaker που δεν είχαν «Σημαντικότητα»).
alter table public.quality_incidents alter column severity drop not null;
