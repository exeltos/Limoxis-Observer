-- The patients table already enforces UNIQUE (organization_id, patient_code)
-- through patients_organization_id_patient_code_key. The explicit index below is
-- byte-for-byte equivalent and only adds write/storage overhead.

drop index if exists public.patients_organization_code_idx;
