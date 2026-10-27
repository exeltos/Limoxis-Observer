-- Quality → Audits: the fields FileMaker kept for an audit and the platform lacked.
--   duration_days       how many days the audit took (FileMaker «Days»)
--   audit_body          who carried it out: internal (the hospital's own people),
--                       consultant, certification (a certification body) or other
--                       (FileMaker «AuditOrganization»)
--   notes               free notes (FileMaker «Notes»)
--   report_sent_on      when the report went to the department
--   corrections_due_on  the deadline for the corrections it asks for
-- The audit report itself is a document on the audit's «Έγγραφα» tab.

alter table public.quality_audits add column if not exists duration_days smallint;
alter table public.quality_audits add column if not exists audit_body text;
alter table public.quality_audits add column if not exists notes text;
alter table public.quality_audits add column if not exists report_sent_on date;
alter table public.quality_audits add column if not exists corrections_due_on date;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'quality_audits_audit_body_check' and conrelid = 'public.quality_audits'::regclass) then
    alter table public.quality_audits add constraint quality_audits_audit_body_check
      check (audit_body is null or audit_body in ('internal', 'consultant', 'certification', 'other'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'quality_audits_duration_days_check' and conrelid = 'public.quality_audits'::regclass) then
    alter table public.quality_audits add constraint quality_audits_duration_days_check
      check (duration_days is null or (duration_days >= 0 and duration_days <= 60));
  end if;
end $$;
