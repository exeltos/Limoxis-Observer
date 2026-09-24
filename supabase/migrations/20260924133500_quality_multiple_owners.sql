alter table if exists public.quality_incidents add column if not exists owner_labels text[] not null default '{}';
alter table if exists public.quality_findings add column if not exists owner_labels text[] not null default '{}';
alter table if exists public.quality_capa_actions add column if not exists owner_labels text[] not null default '{}';
alter table if exists public.quality_audits add column if not exists owner_labels text[] not null default '{}';