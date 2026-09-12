-- High-value workflow indexes for production-facing Limoxis Observer flows.
-- These indexes are intentionally selective: they target known access paths and
-- important foreign-key lookups rather than mechanically indexing every advisor hint.

create index if not exists training_records_org_employee_updated_idx
  on public.training_records (organization_id, employee_user_id, updated_at desc)
  where employee_user_id is not null;

create index if not exists notification_outbox_org_created_idx
  on public.notification_outbox (organization_id, created_at desc);

create index if not exists committee_members_employee_id_idx
  on public.committee_members (employee_id)
  where employee_id is not null;

create index if not exists committee_minutes_approvals_approver_status_idx
  on public.committee_minutes_approvals (approver_id, status, created_at desc);

create index if not exists committee_minutes_approvals_member_id_idx
  on public.committee_minutes_approvals (member_id)
  where member_id is not null;

create index if not exists patients_org_department_status_idx
  on public.patients (organization_id, department_id, status)
  where department_id is not null;

create index if not exists laboratory_samples_org_department_status_collected_idx
  on public.laboratory_samples (organization_id, department_id, status, collected_at desc)
  where department_id is not null;

create index if not exists surveillance_cases_org_patient_status_idx
  on public.surveillance_cases (organization_id, patient_id, status)
  where patient_id is not null;

create index if not exists microbiology_results_org_resulted_idx
  on public.microbiology_results (organization_id, resulted_at desc);
