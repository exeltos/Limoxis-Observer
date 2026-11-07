-- Να το τρέξει ο ιδιοκτήτης στο SQL Editor (αλλαγή σε υπάρχοντα πίνακα).
-- Τα e-mail της πλατφόρμας προς τον Platform Owner (π.χ. η πρωινή σύνοψη νομοθεσίας) δεν ανήκουν σε νοσοκομείο:
-- το νοσοκομείο στη λίστα αποστολής γίνεται προαιρετικό, ώστε να γράφονται και να στέλνονται.
-- Η λίστα παραμένει κλειστή για τους χρήστες (πολιτική «notification_outbox_authenticated_deny»).
alter table public.notification_outbox alter column organization_id drop not null;
