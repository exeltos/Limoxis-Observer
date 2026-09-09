-- Optimize selected RLS policies so auth.uid() is evaluated once per statement.
-- Authorization semantics are intentionally unchanged.

alter policy quality_incident_org_read
on public.quality_incidents
using (
  (reported_by = (select auth.uid()))
  or current_user_has_org_role(
    organization_id,
    array[
      'hospital_admin'::app_role,
      'quality_manager'::app_role,
      'infection_control_lead'::app_role
    ]
  )
  or (
    department_id is not null
    and current_user_has_org_role(
      organization_id,
      array['department_manager'::app_role]
    )
    and current_user_has_department_scope(organization_id, department_id)
  )
);

alter policy quality_finding_authorized_read
on public.quality_findings
using (
  (owner_id = (select auth.uid()))
  or current_user_has_org_role(
    organization_id,
    array[
      'hospital_admin'::app_role,
      'quality_manager'::app_role,
      'infection_control_lead'::app_role
    ]
  )
  or (
    department_id is not null
    and current_user_has_org_role(
      organization_id,
      array['department_manager'::app_role]
    )
    and current_user_has_department_scope(organization_id, department_id)
  )
);

alter policy quality_capa_authorized_read
on public.quality_capa_actions
using (
  (owner_id = (select auth.uid()))
  or current_user_has_org_role(
    organization_id,
    array[
      'hospital_admin'::app_role,
      'quality_manager'::app_role,
      'infection_control_lead'::app_role
    ]
  )
  or (
    department_id is not null
    and current_user_has_org_role(
      organization_id,
      array['department_manager'::app_role]
    )
    and current_user_has_department_scope(organization_id, department_id)
  )
);

alter policy document_approvals_read
on public.document_approvals
using (
  (approver_id = (select auth.uid()))
  or current_user_has_governance_capability(organization_id, 'view_documents'::text)
);

alter policy document_approvals_decide
on public.document_approvals
using (
  (approver_id = (select auth.uid()))
  and status = 'pending'::text
  and current_user_has_governance_capability(organization_id, 'approve_document'::text)
)
with check (
  (approver_id = (select auth.uid()))
  and status = any (array['approved'::text, 'rejected'::text])
  and decided_at is not null
  and current_user_has_governance_capability(organization_id, 'approve_document'::text)
);

alter policy committee_minutes_approvals_read
on public.committee_minutes_approvals
using (
  (approver_id = (select auth.uid()))
  or current_user_can_view_committee(organization_id, committee_id)
);

alter policy committee_minutes_approvals_decide
on public.committee_minutes_approvals
using (
  (approver_id = (select auth.uid()))
  and status = 'pending'::text
)
with check (
  (approver_id = (select auth.uid()))
  and status = any (array['approved'::text, 'rejected'::text])
  and decided_at is not null
);

alter policy committee_meetings_cancel
on public.committee_meetings
using (
  status = any (array['draft'::text, 'planned'::text, 'in_progress'::text])
  and current_user_can_manage_committee(
    organization_id,
    committee_id,
    'create_committee_meeting'::text
  )
)
with check (
  status = 'cancelled'::text
  and nullif(btrim(coalesce(cancellation_reason, ''::text)), ''::text) is not null
  and cancelled_at is not null
  and cancelled_by = (select auth.uid())
  and current_user_can_manage_committee(
    organization_id,
    committee_id,
    'create_committee_meeting'::text
  )
);

alter policy attachments_write
on public.attachments
with check (
  entity_type <> 'committee_document'::text
  and is_org_member(organization_id)
  and uploaded_by = (select auth.uid())
);

alter policy attachments_soft_delete
on public.attachments
using (
  entity_type <> 'committee_document'::text
  and (
    uploaded_by = (select auth.uid())
    or is_org_admin(organization_id)
  )
)
with check (
  entity_type <> 'committee_document'::text
  and (
    uploaded_by = (select auth.uid())
    or is_org_admin(organization_id)
  )
);
