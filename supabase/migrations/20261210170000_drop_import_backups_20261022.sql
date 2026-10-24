-- Cleanup after the one-off imports of 22–23/10/2026 (laboratory PDFs, organism names,
-- deviations) and of 1/12 (FileMaker admission dates). These are copies and staging
-- tables in the private schema that the application never reads, plus the two helper
-- functions that wrote to them. The import results themselves stay in the live tables.
-- Run by the owner in the SQL Editor (the agent does not run drop statements).

begin;

drop function if exists public.temp_stage_deviation_import(text, jsonb);
drop function if exists private.fm_correct_admission_dates(uuid, timestamptz, timestamptz);

drop table if exists private.deviation_import_staging_20261022;
drop table if exists private.deviation_incident_replace_backup_20261023;
drop table if exists private.deviation_incident_text_backup_20261022;
drop table if exists private.deviation_replace_backup_20261023;
drop table if exists private.deviation_text_backup_20261022;
drop table if exists private.iaso_organism_alias_map_20261022;
drop table if exists private.lab_pdf_backup_amr_20261022;
drop table if exists private.lab_pdf_backup_critical_20261022;
drop table if exists private.lab_pdf_backup_notifiable_20261022;
drop table if exists private.lab_pdf_backup_organisms_20261022;
drop table if exists private.lab_pdf_backup_organisms_pre_normalize_20261022;
drop table if exists private.lab_pdf_backup_patients_20261022;
drop table if exists private.lab_pdf_backup_protocol_steps_20261022;
drop table if exists private.lab_pdf_backup_results_20261022;
drop table if exists private.lab_pdf_backup_results_pre_normalize_20261022;
drop table if exists private.lab_pdf_backup_sample_parent_links_20261022;
drop table if exists private.lab_pdf_backup_samples_20261022;
drop table if exists private.lab_pdf_backup_susceptibility_20261022;
drop table if exists private.lab_pdf_backup_therapies_20261022;
drop table if exists private.lab_pdf_patient_map_20261022;
drop table if exists private.lab_pdf_positive_import_exact_20261022;
drop table if exists private.lab_pdf_specimen_map_20261022;
drop table if exists private.patient_admissions_backup_20261201;
drop table if exists private.patients_backup_20261201;
drop table if exists private.tmp_menn_import_log;

commit;
