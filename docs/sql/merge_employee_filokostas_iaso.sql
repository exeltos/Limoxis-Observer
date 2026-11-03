-- ΙΑΣΩ: συγχώνευση του διπλού εργαζομένου «Φιλοκώστας Αριστείδης».
-- Ο εργαζόμενος 433 (ΦΙΛΟΚΩΣΤΑΣ ΑΡΙΣΤΕΙΔΗΣ, 32 εκπαιδεύσεις, Νοσηλευτική Διεύθυνση) μένει και παίρνει τον λογαριασμό του
-- διαχειριστή· το αυτόματο στέλεχος ADM-0859A80A… (χωρίς εκπαιδεύσεις και χωρίς άλλες συνδέσεις) σβήνεται.
-- Τρέξε το στο SQL Editor του Supabase. Αν κάποια εγγραφή αναφέρεται ακόμα στο στέλεχος, η διαγραφή σταματά με σφάλμα και δεν αλλάζει τίποτα.
begin;
select set_config('request.jwt.claims', '{"sub":"84066ee0-57b7-4cae-9186-09e491d3ea6d","role":"authenticated"}', true);

delete from public.employees
where id = '800674fd-2d5a-4461-8aa7-10e9962af813'
  and organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd'
  and employee_code like 'ADM-%';

update public.employees
set user_id = '0859a80a-0894-4cc4-88ae-5fe751ed3da9'
where id = 'bfb293cf-5c5c-49f8-9798-b54d57e40595'
  and organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd'
  and user_id is null;

commit;

-- Επιβεβαίωση (μόνο ανάγνωση): πρέπει να υπάρχει μία γραμμή, με τον κωδικό 433 και τον λογαριασμό συνδεδεμένο.
select employee_code, first_name, last_name, user_id, department_name
from public.employees
where organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd' and (last_name ilike '%φιλοκ%' or first_name ilike '%φιλοκ%');
