-- ΙΑΣΩ Θεσσαλίας, 23/11/2026 (ΟΚ ιδιοκτήτη): 3 έλεγχοι του FileMaker χωρίς αντίστοιχο στην πλατφόρμα δημιουργούνται με τα
-- στοιχεία του FileMaker (στόχος, κριτήρια, ενέργειες απόκλισης, συχνότητα) και συνδέονται όπως οι υπόλοιποι:
-- σακίδιο επείγουσας μεταφοράς ΜΕΘ (μηνιαίος), τσάντα επείγουσας μεταφοράς ΤΕΠ (μηνιαίος), φιάλη οξυγόνου Χειρουργείων
-- (ημερήσιος). Μόνο προσθήκες· ο κωδικός FM-CTRL-<αρ. FileMaker> όπως στους υπόλοιπους.
with src(record_id, code, title, title_en, goal, criteria, actions, category, freq, department) as (values
  ('11',   'FM-CTRL-0011', 'Σακίδιο επείγουσας μεταφοράς', 'Emergency transport backpack',
   'Η διατήρηση των φαρμάκων και υλικών στις προδεδιαγραμμένες συνθήκες και η αποφυγή αλλοίωσης αυτών', 'Λίστα ελέγχου',
   'Έλεγχος όλων των υλικών και φαρμάκων για αντικατάσταση ή προσθήκη σε περίπτωση λήξης ή κατανάλωσης', 'Έλεγχος εξοπλισμού',
   '{"kind":"monthly","times":[],"interval":1,"timesPerDay":1}'::jsonb, 'ΜΕΘ'),
  ('1242', 'FM-CTRL-1242', 'Τσάντα επείγουσας μεταφοράς', 'Emergency transport bag',
   'Η διατήρηση των φαρμάκων και υλικών στις προδεδιαγραμμένες συνθήκες και η αποφυγή αλλοίωσης αυτών', 'Λίστα ελέγχου',
   'Έλεγχος όλων των υλικών και φαρμάκων για αντικατάσταση ή προσθήκη σε περίπτωση λήξης ή κατανάλωσης', 'Έλεγχος εξοπλισμού',
   '{"kind":"monthly","times":[],"interval":1,"timesPerDay":1}'::jsonb, 'ΤΕΠ'),
  ('1380', 'FM-CTRL-1380', 'Φιάλη οξυγόνου', 'Oxygen cylinder',
   'Επάρκεια οξυγόνου και έγκαιρη αντικατάσταση', 'Ένδειξη μανόμετρου', 'Ενημέρωση Τεχνικής Υπηρεσίας', 'Έλεγχος εξοπλισμού',
   '{"kind":"daily","times":["09:00"],"interval":1,"timesPerDay":1}'::jsonb, 'Χειρουργεία')
), defs as (
  insert into public.control_definitions (organization_id, code, title, goal, acceptance_criteria, category, status, frequency_config, response_config, created_by)
  select '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd', s.code, s.title, s.goal, s.criteria, s.category, 'active', s.freq,
         jsonb_build_object('mode', 'choice', 'label', 'Κατάσταση', 'options', jsonb_build_array('Συμμορφώνεται', 'Μη συμμόρφωση'),
           'reportOn', jsonb_build_array('Μη συμμόρφωση'), 'deviationActions', s.actions,
           '__meta', jsonb_build_object('titleEn', s.title_en, 'createdByScope', 'infection_control')),
         '84066ee0-57b7-4cae-9186-09e491d3ea6d'
  from src s
  where not exists (select 1 from public.control_definitions x where x.organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd' and x.code = s.code)
  returning id, code
), asg as (
  insert into public.control_assignments (organization_id, control_id, department_id, status)
  select '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd', d.id, dep.id, 'scheduled'
  from defs d join src s on s.code = d.code
  join public.departments dep on dep.organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd' and dep.name = s.department
  returning id, control_id
)
insert into public.fm_stage_links (base_table, record_id, target_table, target_id, how, note, linked_at)
select 'Controls', s.record_id, 'control_assignments', a.id, 'created', 'created from FileMaker (23/11/2026)', now()
from asg a join defs d on d.id = a.control_id join src s on s.code = d.code
on conflict (base_table, record_id, target_table) do nothing;

select private.fm_sync_controls();
