-- Pediatric/neonatal support (platform review roadmap, P2): the patient
-- record only ever carried date_of_birth, with no way to record a
-- neonate's birth weight or gestational age — both required for NHSN
-- neonatal LCBI/CLABSI surveillance criteria and birth-weight-category
-- stratified indicator reporting. Also adds a department "type" so a
-- NICU/PICU ward can eventually be distinguished from a general/adult
-- ICU department in queries, without requiring every existing department
-- row to change (defaults to 'general').

alter table public.patients
  add column if not exists birth_weight_grams integer check (birth_weight_grams is null or birth_weight_grams > 0),
  add column if not exists gestational_age_weeks integer check (gestational_age_weeks is null or gestational_age_weeks between 20 and 45);

alter table public.departments
  add column if not exists department_type text not null default 'general' check (department_type in ('general','icu','nicu','picu'));
