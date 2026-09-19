-- Splits "treatment plan" from "actual administration" for antimicrobial
-- therapy, per the audit finding that these were the same record/status
-- in code (docs/CLINICAL_DOMAIN.md's own canonical-ownership table already
-- calls for Pharmacy/stewardship to own a distinct administration record).
-- The existing antimicrobial_therapies row remains the clinical ORDER
-- (what's prescribed): antimicrobial, dose, route, planned dates, status
-- (planned/active/completed/stopped/cancelled). This adds a new,
-- append-only table for the actual administration events, and finally
-- wires up the approval_status column that has existed on
-- antimicrobial_therapies since the original table (always written as
-- 'not_required' — the frontend computes an isAdvancedAntibiotic /
-- stewardshipLinked flag today but discards it) into a real stewardship
-- gate: no administration can be recorded for a therapy still pending or
-- rejected stewardship approval.

create table public.antimicrobial_therapy_administrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  therapy_id uuid not null references public.antimicrobial_therapies(id) on delete cascade,
  administered_at timestamptz not null,
  dose text,
  route text,
  status text not null default 'administered' check (status in ('administered','withheld','refused')),
  withheld_reason text,
  administered_by uuid references auth.users(id),
  notes text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint antimicrobial_therapy_administrations_reason_required
    check (status = 'administered' or coalesce(trim(withheld_reason),'') <> '')
);

create index antimicrobial_therapy_administrations_therapy_idx
  on public.antimicrobial_therapy_administrations(therapy_id, administered_at desc);
create index antimicrobial_therapy_administrations_org_idx
  on public.antimicrobial_therapy_administrations(organization_id, administered_at desc);

alter table public.antimicrobial_therapy_administrations enable row level security;

-- Same reader set as antimicrobial_therapies itself (20260909174216).
create policy antimicrobial_therapy_administrations_select on public.antimicrobial_therapy_administrations for select to authenticated
  using (
    current_user_is_platform_owner()
    or current_user_has_org_role(organization_id, array['infection_control_lead'::app_role,'infection_control_member'::app_role,'pharmacy'::app_role,'doctor_reviewer'::app_role,'laboratory'::app_role])
  );

-- Administering a dose is a clinical/pharmacy action, not a lab one — same
-- writer set as antimicrobial_therapies_update (20260915200846), excluding
-- 'laboratory' (which is only allowed to *order* a lab-driven therapy).
create policy antimicrobial_therapy_administrations_insert on public.antimicrobial_therapy_administrations for insert to authenticated
  with check (
    current_user_is_platform_owner()
    or current_user_has_org_role(organization_id, array['infection_control_lead'::app_role,'doctor_reviewer'::app_role,'pharmacy'::app_role])
  );

-- Append-only: no update policy. A mistaken entry is corrected with a new
-- row; only platform_owner can delete, to fix genuine mistakes.
create policy antimicrobial_therapy_administrations_delete on public.antimicrobial_therapy_administrations for delete to authenticated
  using (current_user_is_platform_owner());

revoke all on public.antimicrobial_therapy_administrations from public, anon;
grant select, insert, delete on public.antimicrobial_therapy_administrations to authenticated;

create trigger audit_antimicrobial_therapy_administrations
after insert or update or delete on public.antimicrobial_therapy_administrations
for each row execute function public.capture_clinical_audit();

-- Stewardship gate: block recording an administration while the therapy's
-- own approval is still pending or was rejected. A therapy that never
-- needed approval ('not_required') or has been approved is unaffected.
create or replace function public.enforce_therapy_approved_before_administration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  therapy_approval text;
begin
  select approval_status into therapy_approval
  from public.antimicrobial_therapies
  where id = new.therapy_id and organization_id = new.organization_id;

  if not found then
    raise exception 'Therapy not found for this organization.';
  end if;

  if therapy_approval not in ('not_required','approved') then
    raise exception 'This antimicrobial requires stewardship approval before it can be administered.';
  end if;

  return new;
end;
$$;

create trigger trg_enforce_therapy_approved_before_administration
before insert on public.antimicrobial_therapy_administrations
for each row execute function public.enforce_therapy_approved_before_administration();
