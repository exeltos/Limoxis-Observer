-- Quality Center: restore PostgREST department relationships and data integrity.
-- The Quality UI embeds department:departments(name); PostgREST can only resolve
-- that relationship when an explicit FK exists from each quality table.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'quality_incidents_department_id_fkey'
      and conrelid = 'public.quality_incidents'::regclass
  ) then
    alter table public.quality_incidents
      add constraint quality_incidents_department_id_fkey
      foreign key (department_id)
      references public.departments(id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'quality_findings_department_id_fkey'
      and conrelid = 'public.quality_findings'::regclass
  ) then
    alter table public.quality_findings
      add constraint quality_findings_department_id_fkey
      foreign key (department_id)
      references public.departments(id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'quality_capa_actions_department_id_fkey'
      and conrelid = 'public.quality_capa_actions'::regclass
  ) then
    alter table public.quality_capa_actions
      add constraint quality_capa_actions_department_id_fkey
      foreign key (department_id)
      references public.departments(id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'quality_audits_department_id_fkey'
      and conrelid = 'public.quality_audits'::regclass
  ) then
    alter table public.quality_audits
      add constraint quality_audits_department_id_fkey
      foreign key (department_id)
      references public.departments(id)
      on delete set null;
  end if;
end $$;

notify pgrst, 'reload schema';
