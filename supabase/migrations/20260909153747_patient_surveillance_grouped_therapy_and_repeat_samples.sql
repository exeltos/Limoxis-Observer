alter table public.antimicrobial_therapies add column if not exists therapy_plan_id uuid;
update public.antimicrobial_therapies set therapy_plan_id = gen_random_uuid() where therapy_plan_id is null;
alter table public.antimicrobial_therapies alter column therapy_plan_id set not null;
create index if not exists antimicrobial_therapies_plan_idx on public.antimicrobial_therapies(organization_id, patient_id, therapy_plan_id);

alter table public.laboratory_samples add column if not exists parent_sample_id uuid null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='laboratory_samples_parent_sample_id_fkey') then
    alter table public.laboratory_samples add constraint laboratory_samples_parent_sample_id_fkey foreign key (parent_sample_id) references public.laboratory_samples(id) on delete set null;
  end if;
end $$;
create index if not exists laboratory_samples_parent_sample_idx on public.laboratory_samples(parent_sample_id);
