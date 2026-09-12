create schema if not exists legacy_archive;
revoke all on schema legacy_archive from public, anon, authenticated;

drop table if exists legacy_archive.profiles_snapshot;
create table legacy_archive.profiles_snapshot as table public.profiles;

drop table if exists legacy_archive.organizations_snapshot;
create table legacy_archive.organizations_snapshot as table public.organizations;

drop table if exists legacy_archive.organization_members_snapshot;
create table legacy_archive.organization_members_snapshot as table public.organization_members;

drop table if exists legacy_archive.master_library_items_snapshot;
create table legacy_archive.master_library_items_snapshot as table public.master_library_items;

drop table if exists legacy_archive.indicator_definitions_snapshot;
create table legacy_archive.indicator_definitions_snapshot as table public.indicator_definitions;

drop table if exists legacy_archive.prevention_bundle_templates_snapshot;
create table legacy_archive.prevention_bundle_templates_snapshot as table public.prevention_bundle_templates;

drop table if exists legacy_archive.platform_settings_snapshot;
create table legacy_archive.platform_settings_snapshot as table public.platform_settings;

drop table if exists legacy_archive.system_audit_log_snapshot;
create table legacy_archive.system_audit_log_snapshot as table public.system_audit_log;
