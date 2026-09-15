-- All 8 legacy_archive.*_snapshot tables carry an `id` column with values that
-- are already unique (verified row-count = distinct-id-count before applying).
-- Adding the PK constraint makes them consistent with every other table in
-- the schema and removes the no_primary_key advisory finding.
alter table legacy_archive.indicator_definitions_snapshot add primary key (id);
alter table legacy_archive.master_library_items_snapshot add primary key (id);
alter table legacy_archive.organization_members_snapshot add primary key (id);
alter table legacy_archive.organizations_snapshot add primary key (id);
alter table legacy_archive.platform_settings_snapshot add primary key (id);
alter table legacy_archive.prevention_bundle_templates_snapshot add primary key (id);
alter table legacy_archive.profiles_snapshot add primary key (id);
alter table legacy_archive.system_audit_log_snapshot add primary key (id);
