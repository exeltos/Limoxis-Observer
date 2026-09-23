-- Governed clinical content expansion, immutable assessor snapshots, and owner-only source update audit.
alter table public.patient_clinical_scale_assessments
 add column if not exists assessor_name text,
 add column if not exists assessor_job_title text,
 add column if not exists assessor_email text,
 add column if not exists report_snapshot jsonb not null default '{}'::jsonb,
 add column if not exists amended_at timestamptz;

grant update,delete on public.patient_clinical_scale_assessments to authenticated;
create policy patient_scale_update on public.patient_clinical_scale_assessments for update to authenticated
 using(created_by=auth.uid() or public.current_user_is_platform_owner())
 with check(created_by=auth.uid() or public.current_user_is_platform_owner());
create policy patient_scale_delete on public.patient_clinical_scale_assessments for delete to authenticated
 using(created_by=auth.uid() or public.current_user_is_platform_owner());

insert into public.clinical_scale_definitions
(scale_key,version,name_el,name_en,category,population,min_age_years,max_age_years,settings,definition,source_authority,source_reference,status)
values
('news2','NEWS2-2017','NEWS2 — Εθνική Βαθμολογία Έγκαιρης Προειδοποίησης','NEWS2 — National Early Warning Score 2','deterioration',array['adult'],16,null,array['ward','ed','acute_care'],
 jsonb_build_object('engine','deterministic','scoringStatus','ready','engineVersion','1.0','inputPolicy','explicit_values_only','scoreRange',jsonb_build_array(0,20),'sourceChecked','2026-09-23'),
 'Royal College of Physicians','National Early Warning Score (NEWS) 2. Updated report. London: RCP; 2017; implementation guidance active.','approved'),
('gcs','GCS-STRUCTURED','Glasgow Coma Scale — Δομημένη αξιολόγηση','Glasgow Coma Scale — Structured Assessment','neurology',array['adult','pediatric'],null,null,array['ward','icu','ed'],
 jsonb_build_object('engine','deterministic','scoringStatus','ready','engineVersion','1.0','inputPolicy','explicit_values_only','scoreRange',jsonb_build_array(3,15),'recordComponents',true,'sourceChecked','2026-09-23'),
 'University of Glasgow / Glasgow Coma Scale','Glasgow Structured Approach to Assessment; record Eye, Verbal and Motor components as well as total.','approved')
on conflict(scale_key,version) do update set definition=excluded.definition,source_reference=excluded.source_reference,status=excluded.status,updated_at=now();

create table if not exists public.clinical_content_sources(
 id uuid primary key default gen_random_uuid(),
 source_key text not null unique,
 name text not null,
 authority text not null,
 source_url text not null,
 content_area text not null default 'clinical_scales',
 current_version text,
 last_checked_at timestamptz,
 last_changed_at timestamptz,
 last_http_status integer,
 last_content_hash text,
 status text not null default 'pending' check(status in ('pending','current','changed','error')),
 updated_at timestamptz not null default now()
);
create table if not exists public.clinical_content_source_history(
 id uuid primary key default gen_random_uuid(),
 source_id uuid not null references public.clinical_content_sources(id) on delete cascade,
 checked_at timestamptz not null default now(),
 checked_by uuid references auth.users(id),
 http_status integer,
 content_hash text,
 previous_hash text,
 change_detected boolean not null default false,
 note text
);
alter table public.clinical_content_sources enable row level security;
alter table public.clinical_content_source_history enable row level security;
grant select on public.clinical_content_sources,public.clinical_content_source_history to authenticated;
grant insert,update on public.clinical_content_sources,public.clinical_content_source_history to authenticated;
create policy clinical_sources_owner_read on public.clinical_content_sources for select to authenticated using(public.current_user_is_platform_owner());
create policy clinical_sources_owner_write on public.clinical_content_sources for all to authenticated using(public.current_user_is_platform_owner()) with check(public.current_user_is_platform_owner());
create policy clinical_source_history_owner_read on public.clinical_content_source_history for select to authenticated using(public.current_user_is_platform_owner());
create policy clinical_source_history_owner_write on public.clinical_content_source_history for insert to authenticated with check(public.current_user_is_platform_owner());

insert into public.clinical_content_sources(source_key,name,authority,source_url,current_version) values
('news2','NEWS2','Royal College of Physicians','https://www.rcp.ac.uk/resources/national-early-warning-score-news-2/','2017 + implementation guidance'),
('gcs','Glasgow Coma Scale','University of Glasgow','https://www.glasgowcomascale.org/','Structured Approach'),
('pews','UK Paediatric Early Warning Systems','RCPCH','https://www.rcpch.ac.uk/resources/UK-paediatric-early-warning-systems','SPOT / national PEWS programme'),
('ssc-adult','Surviving Sepsis Campaign — Adult','SCCM / ESICM','https://www.sccm.org/survivingsepsiscampaign/guidelines-and-resources/surviving-sepsis-campaign-adult-guidelines','2026'),
('ssc-pediatric','Surviving Sepsis Campaign — Pediatric','SCCM','https://sccm.org/survivingsepsiscampaign/guidelines-and-resources/surviving-sepsis-campaign-pediatric-guidelines','2026')
on conflict(source_key) do update set source_url=excluded.source_url,current_version=excluded.current_version,updated_at=now();
