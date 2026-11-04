-- Εργαζόμενοι: «Τμήμα HR» (όπως το καταγράφει το προσωπικό) και «Διεύθυνση» στην οποία ανήκουν.
-- Είναι ξεχωριστά πεδία κειμένου, ανεξάρτητα από το τμήμα της εφαρμογής (department_id).
alter table public.employees add column if not exists hr_department_name text;
alter table public.employees add column if not exists directorate_name text;
