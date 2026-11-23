-- ΙΑΣΩ Θεσσαλίας, 22/11/2026: 16 έλεγχοι του FileMaker γίνονταν κανονικά αλλά δεν είχαν σύνδεση «έλεγχος FileMaker →
-- έλεγχος τμήματος» (fm_stage_links, Controls → control_assignments) μετά την αποκατάσταση της 6/11, οπότε στην
-- πλατφόρμα φαίνονταν σταματημένοι: μηχανήματα του Αναισθησιολογικού, του Αιμοδυναμικού, του Ενδοσκοπικού και του
-- Οφθαλμολογικού, έλεγχοι νερού της Τεχνικής Υπηρεσίας, εβδομαδιαίοι της Αιμοδοσίας και των Κεντρικών Εργαστηρίων.
-- Οι έλεγχοι τμήματος υπάρχουν ήδη (κωδικός FM-CTRL-…, ίδιο τμήμα)· εδώ μπαίνει μόνο η σύνδεση, όπως στις 6/11
-- (how = 'matched', ταίριασμα ονόματος + τμήματος), και μετά ο ίδιος συγχρονισμός (private.fm_sync_controls) περνά τις
-- εκτελέσεις τους που είναι ήδη στο FileMaker (id από md5, on conflict do nothing: ξανατρέχει χωρίς διπλά).
-- Ο «Έλεγχος Ναρκωτικών» μένει εκτός πλατφόρμας (απόφαση ιδιοκτήτη).
insert into public.fm_stage_links (base_table, record_id, target_table, target_id, how, note, linked_at)
select 'Controls', m.record_id, 'control_assignments', a.id, 'matched', 'matched by name and department (22/11/2026)', now()
from (values
  ('116',  'Αναισθησιολογικό',          'FM-CTRL-0116'),
  ('1386', 'Αναισθησιολογικό',          'FM-CTRL-1386'),
  ('1389', 'Αναισθησιολογικό',          'FM-CTRL-1389'),
  ('115',  'Αιμοδυναμικό',              'FM-CTRL-0116'),
  ('157',  'Αιμοδυναμικό',              'FM-CTRL-0152'),
  ('136',  'Ενδοσκοπικό',               'FM-CTRL-0116'),
  ('142',  'Ενδοσκοπικό',               'FM-CTRL-0142'),
  ('139',  'Οφθαλμολογικό Χειρουργείο', 'FM-CTRL-0116'),
  ('1371', 'Τεχνική Υπηρεσία',          'FM-CTRL-1371'),
  ('1372', 'Τεχνική Υπηρεσία',          'FM-CTRL-1372'),
  ('1373', 'Τεχνική Υπηρεσία',          'FM-CTRL-1373'),
  ('1374', 'Τεχνική Υπηρεσία',          'FM-CTRL-1374'),
  ('1287', 'Αιμοδοσία',                 'FM-CTRL-1287'),
  ('1292', 'Αιμοδοσία',                 'FM-CTRL-1292'),
  ('1296', 'Κεντρικά Εργαστήρια',       'FM-CTRL-1296'),
  ('1307', 'Κεντρικά Εργαστήρια',       'FM-CTRL-1287')
) as m(record_id, department_name, control_code)
join public.fm_stage_records c on c.base_table = 'Controls' and c.record_id = m.record_id
join public.departments d on d.organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd' and d.name = m.department_name
join public.control_definitions def on def.organization_id = d.organization_id and def.code = m.control_code
join public.control_assignments a on a.control_id = def.id and a.department_id = d.id and a.status = 'scheduled'
where c.data->>'ControlName' not ilike '%ναρκωτικ%'
on conflict (base_table, record_id, target_table) do nothing;

-- Οι εκτελέσεις που περιμένουν (ίδιο παράθυρο με τον νυχτερινό συγχρονισμό).
select private.fm_sync_controls();
