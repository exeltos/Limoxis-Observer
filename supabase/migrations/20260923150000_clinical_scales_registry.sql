create table if not exists public.clinical_scale_definitions (
 id uuid primary key default gen_random_uuid(),
 scale_key text not null,
 version text not null,
 name_el text not null,
 name_en text not null,
 category text not null,
 population text[] not null default '{}',
 min_age_years numeric null,
 max_age_years numeric null,
 settings text[] not null default '{}',
 definition jsonb not null default '{}'::jsonb,
 source_authority text,
 source_reference text,
 status text not null default 'draft' check(status in ('draft','approved','retired')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(scale_key,version)
);
create table if not exists public.clinical_scale_org_settings (
 organization_id uuid not null references public.organizations(id) on delete cascade,
 scale_definition_id uuid not null references public.clinical_scale_definitions(id) on delete cascade,
 availability text not null default 'available' check(availability in ('available','recommended','required','disabled')),
 reassessment_hours integer null check(reassessment_hours is null or reassessment_hours>0),
 enabled boolean not null default true,
 updated_at timestamptz not null default now(),
 primary key(organization_id,scale_definition_id)
);
alter table public.clinical_scale_definitions enable row level security;
alter table public.clinical_scale_org_settings enable row level security;
grant select on public.clinical_scale_definitions to authenticated;
grant select,insert,update,delete on public.clinical_scale_org_settings to authenticated;
create policy clinical_scale_definitions_read on public.clinical_scale_definitions for select to authenticated using(status in ('approved','retired') or public.current_user_is_platform_owner());
create policy clinical_scale_definitions_owner_write on public.clinical_scale_definitions for all to authenticated using(public.current_user_is_platform_owner()) with check(public.current_user_is_platform_owner());
create policy clinical_scale_org_settings_read on public.clinical_scale_org_settings for select to authenticated using(public.current_user_is_platform_owner() or public.current_user_has_org_role(organization_id,array['hospital_admin'::public.app_role,'infection_control_lead'::public.app_role]));
create policy clinical_scale_org_settings_write on public.clinical_scale_org_settings for all to authenticated using(public.current_user_is_platform_owner() or public.current_user_has_org_role(organization_id,array['hospital_admin'::public.app_role])) with check(public.current_user_is_platform_owner() or public.current_user_has_org_role(organization_id,array['hospital_admin'::public.app_role]));
insert into public.clinical_scale_definitions(scale_key,version,name_el,name_en,category,population,min_age_years,settings,definition,source_authority,source_reference,status) values
('sofa','SOFA-1','SOFA — Διαδοχική Αξιολόγηση Οργανικής Ανεπάρκειας','SOFA — Sequential Organ Failure Assessment','organ_dysfunction',array['adult'],18,array['icu'],jsonb_build_object('engine','deterministic','domains',array['respiratory','coagulation','liver','cardiovascular','cns','renal'],'scoringStatus','pending_governed_definition'),'ESICM / Vincent et al.','Intensive Care Med. 1996;22:707–710. PMID 8844239','approved'),
('apache-ii','APACHE-II','APACHE II — Βαρύτητα νόσου ΜΕΘ','APACHE II — Acute Physiology and Chronic Health Evaluation II','severity',array['adult'],18,array['icu'],jsonb_build_object('engine','deterministic','components',array['acute_physiology','age','chronic_health'],'scoringStatus','pending_governed_definition'),'Knaus et al.','Crit Care Med. 1985;13:818–829. PMID 3928249','approved'),
('braden','BRADEN-1988','Braden — Κίνδυνος βλάβης από πίεση','Braden Scale — Pressure Injury Risk','pressure_injury',array['adult'],18,array['ward','icu','ed'],jsonb_build_object('engine','deterministic','domains',array['sensory_perception','moisture','activity','mobility','nutrition','friction_shear'],'scoringStatus','pending_governed_definition'),'Braden & Bergstrom / AHRQ','Braden Scale, 1988; AHRQ pressure injury prevention resources','approved'),
('humpty-dumpty','HDFS-2.0','Humpty Dumpty 2.0 — Παιδιατρικός κίνδυνος πτώσης','Humpty Dumpty Falls Scale 2.0 — Pediatric Fall Risk','falls',array['pediatric'],0,array['pediatric_ward'],jsonb_build_object('engine','deterministic','scoringStatus','pending_governed_definition','licenseReviewRequired',true),'Nicklaus Children''s Health System','Updated HDFS; J Pediatr Nurs. 2026;86:148–153. PMID 41237561','approved')
on conflict(scale_key,version) do nothing;
