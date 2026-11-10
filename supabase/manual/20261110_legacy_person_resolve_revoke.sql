-- Παλιά ονόματα FileMaker → εργαζόμενοι: η εντολή revoke του migration 20261231270000_legacy_person_links.sql
-- (τρέχει ο ιδιοκτήτης στο SQL Editor). Η συνάρτηση ελέγχει ήδη τον καλούντα (auth.uid() + is_org_admin)·
-- αυτό απλώς κλείνει την πρόσβαση σε ανώνυμους επισκέπτες.
revoke execute on function public.resolve_legacy_person(uuid, text, text, text, uuid) from public, anon;
