-- Composite FK constraints (typically tenant-scoped: (fk_id, organization_id)
-- or similar) whose leading columns weren't covered by any existing index.
-- Column order matches each constraint's own column order so the index
-- can serve the FK lookup directly.
create index if not exists idx_committee_decisions_meeting_tenant on public.committee_decisions (meeting_id, organization_id);
create index if not exists idx_committee_decisions_tenant on public.committee_decisions (committee_id, organization_id);
create index if not exists idx_committee_documents_document_tenant on public.committee_documents (document_id, organization_id);
create index if not exists idx_committee_documents_tenant on public.committee_documents (committee_id, organization_id);
create index if not exists idx_committee_history_tenant on public.committee_history (committee_id, organization_id);
create index if not exists idx_committee_attendance_meeting_tenant on public.committee_meeting_attendance (meeting_id, organization_id, committee_id);
create index if not exists idx_committee_attendance_member_tenant on public.committee_meeting_attendance (member_id, organization_id, committee_id);
create index if not exists idx_committee_meetings_tenant on public.committee_meetings (committee_id, organization_id);
create index if not exists idx_committee_members_tenant on public.committee_members (committee_id, organization_id);
create index if not exists idx_committee_minutes_approvals_meeting_tenant on public.committee_minutes_approvals (meeting_id, organization_id, committee_id);
create index if not exists idx_committee_minutes_approvals_member_tenant on public.committee_minutes_approvals (member_id, organization_id, committee_id);
create index if not exists idx_committee_plan_items_tenant on public.committee_plan_items (committee_id, organization_id);
create index if not exists idx_control_assignments_tenant on public.control_assignments (control_id, organization_id);
create index if not exists idx_control_executions_assignment_tenant on public.control_executions (assignment_id, organization_id, control_id, department_id);
create index if not exists idx_control_executions_definition_tenant on public.control_executions (control_id, organization_id);
create index if not exists idx_document_approvals_tenant on public.document_approvals (document_id, organization_id);
create index if not exists idx_patient_admissions_department_org on public.patient_admissions (organization_id, department_id);
create index if not exists idx_patient_admissions_patient_org on public.patient_admissions (organization_id, patient_id);
