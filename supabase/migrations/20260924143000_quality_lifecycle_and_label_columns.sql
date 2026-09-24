-- Quality module review: qualityService.js's insert/update payloads for all
-- four quality tables (incidents/findings/capa_actions/audits) write
-- owner_label, lifecycle_status, void_reason, voided_at, voided_by,
-- correction_reason, correction_opened_at, correction_opened_by and
-- history — none of which were ever added by a tracked migration (only the
-- plural owner_labels array exists, from 20260924133500). Every create/save
-- against a real organization fails with "column does not exist" via
-- PostgREST. This is very likely the actual bug behind the string of
-- "Quality linked navigation/history" fix commits: they kept reshaping the
-- JS-side payload without the destination columns ever having existed.
--
-- Also: quality_incidents.reported_by and quality_audits.lead_auditor_id
-- are uuid FKs to auth.users, but the UI edits/displays them as free-text
-- names (an employee name, not necessarily a login account) — the existing
-- owner_label/owner_labels columns already use this same "id + free-text
-- label" split for the owner fields, so mirror that pattern here instead of
-- writing names into a uuid column.

alter table public.quality_incidents
  add column if not exists owner_label text,
  add column if not exists reported_by_label text,
  add column if not exists lifecycle_status text not null default 'active',
  add column if not exists void_reason text,
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references auth.users(id),
  add column if not exists correction_reason text,
  add column if not exists correction_opened_at timestamptz,
  add column if not exists correction_opened_by uuid references auth.users(id),
  add column if not exists history jsonb not null default '[]'::jsonb;

alter table public.quality_findings
  add column if not exists owner_label text,
  add column if not exists lifecycle_status text not null default 'active',
  add column if not exists void_reason text,
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references auth.users(id),
  add column if not exists correction_reason text,
  add column if not exists correction_opened_at timestamptz,
  add column if not exists correction_opened_by uuid references auth.users(id),
  add column if not exists history jsonb not null default '[]'::jsonb;

alter table public.quality_capa_actions
  add column if not exists owner_label text,
  add column if not exists lifecycle_status text not null default 'active',
  add column if not exists void_reason text,
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references auth.users(id),
  add column if not exists correction_reason text,
  add column if not exists correction_opened_at timestamptz,
  add column if not exists correction_opened_by uuid references auth.users(id),
  add column if not exists history jsonb not null default '[]'::jsonb;

alter table public.quality_audits
  add column if not exists owner_label text,
  add column if not exists lead_auditor_label text,
  add column if not exists lifecycle_status text not null default 'active',
  add column if not exists void_reason text,
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references auth.users(id),
  add column if not exists correction_reason text,
  add column if not exists correction_opened_at timestamptz,
  add column if not exists correction_opened_by uuid references auth.users(id),
  add column if not exists history jsonb not null default '[]'::jsonb;
