-- Quality Center, phase 3 (audits): an audit carries its checklist, answered
-- Yes / No / N/A with a note, and where the list came from (a control that is
-- a checklist, or items typed for the audit). Each «No» becomes a finding
-- whose source is the audit (source_type 'audit', source_id = the audit code),
-- and the finding id is kept on the row so it is created only once.

alter table public.quality_audits
  add column if not exists checklist jsonb not null default '[]'::jsonb,
  add column if not exists checklist_source text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'quality_audits_checklist_is_array') then
    alter table public.quality_audits add constraint quality_audits_checklist_is_array
      check (jsonb_typeof(checklist) = 'array');
  end if;
end
$$;

comment on column public.quality_audits.checklist is 'Audit checklist: [{id,item,itemEn,required,answer(yes|no|na),note,findingId}].';
comment on column public.quality_audits.checklist_source is 'Where the checklist came from: control:<control id>, or manual.';
