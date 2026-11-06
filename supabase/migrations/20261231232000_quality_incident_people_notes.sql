-- Incidents: the people involved, the patient's reference and room, and free notes
-- (carried over from FileMaker: «Εμπλεκόμενοι», «Patient ID», «Room No», «Notes» / «Proposed Improvements»).
alter table public.quality_incidents add column if not exists involved_people text;
alter table public.quality_incidents add column if not exists patient_reference text;
alter table public.quality_incidents add column if not exists room text;
alter table public.quality_incidents add column if not exists notes text;
comment on column public.quality_incidents.involved_people is 'Who was involved (free text, one per line).';
comment on column public.quality_incidents.patient_reference is 'The patient''s record number in the hospital system (not a link to patients).';
comment on column public.quality_incidents.room is 'Room / bed where it happened.';
comment on column public.quality_incidents.notes is 'Notes and proposed improvements.';

-- The FileMaker sync (private.fm_sync_incidents) also fills these, plus the evaluator as owner and the causes as root cause.
-- Applied by rewriting the function in place (replace on pg_get_functiondef), as the earlier FileMaker migrations do:
--   insert columns: … created_at, involved_people, patient_reference, room, notes, owner_label, owner_labels, root_cause
--   values: «Emplekomenoi Ginc» + «EmplekomenoiBlue», «Patient ID», «Room No», «Notes» + «Proposed Improvements»,
--           «Evaluator» (owner_label and owner_labels), «Causes».

-- The FileMaker syncs no longer write the migration into what people see: no «Μεταφορά από ISOWISE (FileMaker)»
-- history entry (private.fm_sync_incidents writes '[]'), «Επιπλέον καταγραφή» without «στο FileMaker»
-- (private.fm_sync_controls), decision notes without «FileMaker: » (private.hr_fm_import_candidates), and an
-- incident without «Σημαντικότητα» keeps no severity (severity is nullable: docs/sql/incident_severity_optional.sql).
