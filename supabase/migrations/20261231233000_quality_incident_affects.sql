-- «Αφορά σε» of the ΟΔΙΠΥ incident report form: patient, employee, companion / visitor, other.
alter table public.quality_incidents add column if not exists affects text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'quality_incidents_affects_check') then
    alter table public.quality_incidents add constraint quality_incidents_affects_check
      check (affects is null or affects in ('patient', 'employee', 'visitor', 'other'));
  end if;
end $$;
comment on column public.quality_incidents.affects is 'Who the incident concerns (ΟΔΙΠΥ form «Αφορά σε»).';

-- Categories of the ΟΔΙΠΥ form (src/features/quality/odipyCategories.js, keys «odipy-…»), applied in place:
-- * private.fm_sync_incidents: category from the FileMaker event type and injury subcategory (death → odipy-death,
--   code blue → odipy-blue-code, obstetric, readmission, haemorrhage, return to theatre → odipy-surgery, falls,
--   sharps, exposures, allergic and transfusion reactions), and affects from «WhoInjured_type».
-- * private.risk_indicator_metric_snapshot: falls and medication count both the earlier and the ΟΔΙΠΥ keys
--   (category in ('fall','odipy-fall'), category in ('medication','odipy-medication')).

-- With incident_class nullable (docs/sql/incident_class_optional.sql, run by the owner), private.fm_sync_incidents
-- writes 'harmful' for a death, 'nearMiss' only for FileMaker «Παρ'ολίγον Τραυματισμός», and nothing otherwise.
