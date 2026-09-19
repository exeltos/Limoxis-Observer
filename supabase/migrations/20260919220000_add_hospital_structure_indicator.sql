-- ΥΑ Υ1.Γ.Π.114971/ΦΕΚ Β 388/2014 §2.8 (Δομικοί/Ποιοτικοί Δείκτες): total
-- beds, ICU beds, single rooms, and IC nursing/medical staffing must be
-- recorded, with a full change history retained (mandatory whenever the
-- structure changes, not just annually). Unlike the other 4 indicators
-- in this series, this one has no numeric formula at all — the legal
-- text says so explicitly ("Τύπος υπολογισμού: Καταγραφή κατάστασης,
-- όχι αριθμητικός τύπος") — so this is a status record, not a metric
-- wired into indicator_metric_snapshot.
--
-- Append-only by design: a structural change is recorded as a NEW row
-- with its own effective_date, rather than editing history in place, so
-- "ιστορικό μεταβολών" (change history) is preserved automatically. Only
-- delete (to correct a genuine data-entry mistake) is possible, and only
-- for the platform owner.

create table public.hospital_structure_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  effective_date date not null,
  total_beds integer check (total_beds is null or total_beds >= 0),
  icu_beds integer check (icu_beds is null or icu_beds >= 0),
  single_rooms integer check (single_rooms is null or single_rooms >= 0),
  infection_control_nurses integer check (infection_control_nurses is null or infection_control_nurses >= 0),
  infectious_disease_physicians integer check (infectious_disease_physicians is null or infectious_disease_physicians >= 0),
  microbiologists integer check (microbiologists is null or microbiologists >= 0),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index idx_hospital_structure_snapshots_org_date on public.hospital_structure_snapshots (organization_id, effective_date desc);

alter table public.hospital_structure_snapshots enable row level security;

create policy hospital_structure_read on public.hospital_structure_snapshots for select
  using (public.is_org_member(organization_id));
create policy hospital_structure_insert on public.hospital_structure_snapshots for insert
  with check (public.is_org_admin(organization_id));
create policy hospital_structure_delete on public.hospital_structure_snapshots for delete
  using (public.current_user_is_platform_owner());

revoke all on public.hospital_structure_snapshots from public, anon;
grant select, insert, delete on public.hospital_structure_snapshots to authenticated;

create trigger trg_audit_hospital_structure_snapshots
after insert or update or delete on public.hospital_structure_snapshots
for each row execute function private.audit_management_change();
