-- Αξιολόγηση 23/11/2026: ευρετήρια στα ξένα κλειδιά των πινάκων που διαβάζονται συχνά (Supabase advisor
-- «unindexed_foreign_keys»). Οι πίνακες μητρώων (register_*) μένουν εκτός: ο καθένας ανήκει σε ένα μητρώο, οπότε
-- ευρετήριο σε organization_id/register_id δεν βοηθά. Μόνο προσθήκες.
create index if not exists laboratory_samples_specimen_type_idx on public.laboratory_samples (specimen_type_id);
create index if not exists laboratory_samples_surveillance_reviewed_by_idx on public.laboratory_samples (surveillance_reviewed_by);
create index if not exists fm_stage_tables_organization_idx on public.fm_stage_tables (organization_id);
create index if not exists quality_incidents_owner_employee_idx on public.quality_incidents (owner_employee_id);
create index if not exists quality_incidents_reported_by_employee_idx on public.quality_incidents (reported_by_employee_id);
create index if not exists committee_decisions_owner_employee_idx on public.committee_decisions (owner_employee_id);
create index if not exists control_definitions_culture_department_idx on public.control_definitions (culture_department_id);
create index if not exists training_programs_owner_employee_idx on public.training_programs (owner_employee_id);
create index if not exists training_programs_trainer_employee_idx on public.training_programs (trainer_employee_id);
-- Distinct name: training_programs_organizer_department_idx already exists on (organization_id, organizer_department_id).
create index if not exists training_programs_organizer_department_fk_idx on public.training_programs (organizer_department_id);
create index if not exists quality_capa_actions_owner_employee_idx on public.quality_capa_actions (owner_employee_id);
create index if not exists kitchen_receipts_receiver_employee_idx on public.kitchen_receipts (receiver_employee_id);
create index if not exists kitchen_material_usage_product_idx on public.kitchen_material_usage (product_id);
create index if not exists kitchen_material_usage_recorded_by_employee_idx on public.kitchen_material_usage (recorded_by_employee_id);
