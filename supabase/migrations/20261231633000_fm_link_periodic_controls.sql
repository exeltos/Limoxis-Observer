-- ΙΑΣΩ Θεσσαλίας, 23/11/2026: 28 περιοδικοί έλεγχοι του FileMaker (μηνιαίοι έως ετήσιοι) γίνονταν αλλά δεν είχαν σύνδεση
-- «έλεγχος FileMaker → έλεγχος τμήματος»: απολύμανση πνευματικού ταχυδρομείου (15 τμήματα, ένας έλεγχος πλατφόρμας
-- FM-CTRL-1341 με 15 αναθέσεις), διεργαστηριακά σχήματα, συντήρηση/διακρίβωση εξοπλισμού (Αιμοδοσία, Κεντρικά Εργαστήρια),
-- απόρριψη αρχείων εργαστηρίου, καλλιέργειες κουζίνας/φαγητού/κλιβάνων. Οι έλεγχοι τμήματος υπάρχουν ήδη· εδώ μπαίνει μόνο
-- η σύνδεση, όπως στις 22/11 (`20261231623000`): το τμήμα από τη σύνδεση Departments του FileMaker, ο έλεγχος από τον κωδικό.
-- Εκτός μένουν ο «Έλεγχος Ναρκωτικών» (απόφαση ιδιοκτήτη) και 3 χωρίς έλεγχο στην πλατφόρμα (σακίδιο ΜΕΘ, τσάντα ΤΕΠ,
-- φιάλη οξυγόνου Χειρουργείων).
insert into public.fm_stage_links (base_table, record_id, target_table, target_id, how, note, linked_at)
select 'Controls', m.record_id, 'control_assignments', a.id, 'matched', 'matched by control code and department (23/11/2026)', now()
from (values
  ('1341','FM-CTRL-1341'),('1342','FM-CTRL-1341'),('1343','FM-CTRL-1341'),('1344','FM-CTRL-1341'),('1345','FM-CTRL-1341'),
  ('1346','FM-CTRL-1341'),('1347','FM-CTRL-1341'),('1348','FM-CTRL-1341'),('1349','FM-CTRL-1341'),('1350','FM-CTRL-1341'),
  ('1351','FM-CTRL-1341'),('1352','FM-CTRL-1341'),('1353','FM-CTRL-1341'),('1354','FM-CTRL-1341'),('1395','FM-CTRL-1341'),
  ('1288','FM-CTRL-1288'),('1289','FM-CTRL-1289'),('1290','FM-CTRL-1290'),('1291','FM-CTRL-1291'),
  ('1302','FM-CTRL-1302'),('1303','FM-CTRL-1303'),('1304','FM-CTRL-1304'),('1305','FM-CTRL-1305'),
  ('1309','FM-CTRL-1290'),('1310','FM-CTRL-1291'),
  ('198','FM-CTRL-0198'),('1359','FM-CTRL-1359'),('1375','FM-CTRL-1375')
) as m(record_id, control_code)
join public.fm_stage_records c on c.base_table = 'Controls' and c.record_id = m.record_id
join lateral (
  select ld.target_id as department_id
  from public.fm_stage_records fd
  join public.fm_stage_links ld on ld.base_table = 'Departments' and ld.record_id = fd.record_id and ld.target_table = 'departments'
  where fd.base_table = 'Departments' and fd.data::text ilike '%"' || (c.data->>'DepartmentID') || '"%'
  limit 1
) dep on true
join public.control_definitions def on def.organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd' and def.code = m.control_code
join public.control_assignments a on a.control_id = def.id and a.department_id = dep.department_id and a.status = 'scheduled'
where c.data->>'ControlName' not ilike '%ναρκωτικ%'
on conflict (base_table, record_id, target_table) do nothing;

-- Οι εκτελέσεις που περιμένουν (ίδιο παράθυρο με τον νυχτερινό συγχρονισμό).
select private.fm_sync_controls();
