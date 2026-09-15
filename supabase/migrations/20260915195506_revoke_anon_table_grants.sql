-- Every table in this schema had anon granted full table-level
-- INSERT/SELECT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER - this is
-- Supabase's own project-bootstrap default (see pg_default_acl), not
-- something this app's migrations set up deliberately. Verified no
-- legitimate anon-context flow needs direct table access anywhere in the
-- app: every public/pre-auth path (training invitation/attendance/
-- evaluation) goes through SECURITY DEFINER RPCs, which run with the
-- function owner's privileges and need no table grant for the caller.
-- RLS was the only thing standing between anon and these tables, and we
-- already found one RLS policy (control_revisions_read) that was an
-- effective no-op - table grants should not be the only backstop.
revoke all on table
  public.account_invitations,
  public.antiseptic_consumption_periods,
  public.attachments,
  public.clinical_audit_log,
  public.committee_decisions,
  public.committee_documents,
  public.committee_history,
  public.committee_meeting_attendance,
  public.committee_meetings,
  public.committee_members,
  public.committee_minutes_approvals,
  public.committee_plan_items,
  public.committees,
  public.control_assignments,
  public.control_definitions,
  public.control_drafts,
  public.control_execution_revisions,
  public.control_executions,
  public.controlled_documents,
  public.document_approvals,
  public.employee_certificates,
  public.employee_evaluations,
  public.employee_surveillance_batches,
  public.employee_surveillance_records,
  public.employee_training_summary,
  public.employee_vaccinations,
  public.employees,
  public.hand_hygiene_observations,
  public.hand_hygiene_sessions,
  public.occupational_health_visits,
  public.organization_member_capabilities,
  public.organization_member_scopes,
  public.organization_members,
  public.platform_demo_entitlements,
  public.platform_settings,
  public.prevention_bundle_assessments,
  public.profiles,
  public.quality_audits,
  public.quality_capa_actions,
  public.quality_findings,
  public.quality_incidents,
  public.quality_record_links,
  public.system_audit_log,
  public.training_records,
  public.waste_measurements,
  public.work_assignments
from anon;
