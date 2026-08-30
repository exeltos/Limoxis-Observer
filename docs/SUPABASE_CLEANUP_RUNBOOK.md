# Supabase clean-room rebuild runbook

This runbook exists because deleting tables and RLS policies before inventorying the
live project can remove tenant data, storage access rules, or functions that later
migrations depend on. Cleanup is therefore split into reviewed phases.

## Phase 0 — inventory only

1. In the target Supabase project, create a database backup or verify point-in-time
   recovery before doing any destructive work.
2. Open **SQL Editor → New query**.
3. Paste and run `supabase/maintenance/00_preflight_inventory.sql` in full.
4. Export or copy every result grid: relations, policies, functions, triggers,
   foreign keys, storage buckets, and migration-history availability. It is valid
   for an older/test project not to have `supabase_migrations.schema_migrations`.
5. Mark the project as **development/staging** or **production** and record whether
   any existing records must be retained.

The phase-0 query is read-only. It contains no `DROP`, `TRUNCATE`, `DELETE`,
`UPDATE`, `INSERT`, DDL block, or function execution that changes application data.

## Phase 1 — reviewed keep/drop manifest

Using the inventory, create an explicit manifest with three groups:

- **KEEP**: functions or platform objects that are known-good and still required;
- **REPLACE**: application tables, policies, triggers, and helper functions owned by
  Limoxis Observer migrations;
- **UNKNOWN**: anything not yet attributable to this repository.

Unknown objects are never deleted automatically. Functions are identified by both
name and identity arguments because PostgreSQL supports overloads.

## Phase 2 — generated cleanup SQL

Only after the manifest is reviewed do we create the destructive script. It must:

- refuse to run unless a project/environment guard matches;
- run inside an explicit transaction;
- drop policies and dependent application views before tables;
- use an explicit allowlist rather than `drop schema public cascade`;
- leave `auth`, `storage`, extensions, Supabase-managed schemas, and KEEP functions
  untouched;
- handle storage objects separately from database rows;
- finish with verification queries and allow rollback before commit.

## Phase 3 — canonical rebuild

Apply the repository migrations to an empty development project first. Then run
schema/RLS integration tests for tenant, department, self, owner, assignment,
sensitive data, lifecycle states, and role preview denial.

## Phase 4 — data

Production organizations remain empty unless data is intentionally imported. Demo
seed data is loaded only into the dedicated demo organization and its isolated
storage paths.
