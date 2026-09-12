-- Limoxis Observer v0.29.1
-- Documents governance RLS hardening: authenticated-only policy targets.

alter table public.controlled_documents enable row level security;
alter table public.document_approvals enable row level security;

-- Recreate controlled_documents policies with explicit authenticated target.
drop policy if exists controlled_documents_read on public.controlled_documents;
drop policy if exists controlled_documents_insert on public.controlled_documents;
drop policy if exists controlled_documents_edit_draft on public.controlled_documents;
drop policy if exists controlled_documents_submit_review on public.controlled_documents;
drop policy if exists controlled_documents_approve on public.controlled_documents;
drop policy if exists controlled_documents_publish on public.controlled_documents;
drop policy if exists controlled_documents_supersede on public.controlled_documents;
drop policy if exists controlled_documents_archive on public.controlled_documents;
drop policy if exists controlled_documents_delete_draft on public.controlled_documents;

create policy controlled_documents_read on public.controlled_documents
for select to authenticated
using (public.current_user_has_governance_capability(organization_id,'view_documents'));

create policy controlled_documents_insert on public.controlled_documents
for insert to authenticated
with check (status='draft' and public.current_user_has_governance_capability(organization_id,'manage_documents'));

create policy controlled_documents_edit_draft on public.controlled_documents
for update to authenticated
using (status='draft' and public.current_user_has_governance_capability(organization_id,'manage_documents'))
with check (status='draft' and public.current_user_has_governance_capability(organization_id,'manage_documents'));

create policy controlled_documents_submit_review on public.controlled_documents
for update to authenticated
using (status='draft' and public.current_user_has_governance_capability(organization_id,'submit_document_review'))
with check (status='review' and public.current_user_has_governance_capability(organization_id,'submit_document_review'));

create policy controlled_documents_approve on public.controlled_documents
for update to authenticated
using (status='review' and public.current_user_has_governance_capability(organization_id,'approve_document'))
with check (status='approved' and public.current_user_has_governance_capability(organization_id,'approve_document'));

create policy controlled_documents_publish on public.controlled_documents
for update to authenticated
using (status='approved' and public.current_user_has_governance_capability(organization_id,'publish_document'))
with check (status='published' and public.current_user_has_governance_capability(organization_id,'publish_document'));

create policy controlled_documents_supersede on public.controlled_documents
for update to authenticated
using (status='published' and public.current_user_has_governance_capability(organization_id,'supersede_document'))
with check (status='superseded' and public.current_user_has_governance_capability(organization_id,'supersede_document'));

create policy controlled_documents_archive on public.controlled_documents
for update to authenticated
using (status='published' and public.current_user_has_governance_capability(organization_id,'archive_document'))
with check (status='archived' and public.current_user_has_governance_capability(organization_id,'archive_document'));

create policy controlled_documents_delete_draft on public.controlled_documents
for delete to authenticated
using (status='draft' and public.current_user_has_governance_capability(organization_id,'delete_document_draft'));

-- Recreate document approval policies with explicit authenticated target.
drop policy if exists document_approvals_read on public.document_approvals;
drop policy if exists document_approvals_request on public.document_approvals;
drop policy if exists document_approvals_decide on public.document_approvals;

create policy document_approvals_read on public.document_approvals
for select to authenticated
using (approver_id=auth.uid() or public.current_user_has_governance_capability(organization_id,'view_documents'));

create policy document_approvals_request on public.document_approvals
for insert to authenticated
with check (status='pending' and public.current_user_has_governance_capability(organization_id,'submit_document_review'));

create policy document_approvals_decide on public.document_approvals
for update to authenticated
using (approver_id=auth.uid() and status='pending' and public.current_user_has_governance_capability(organization_id,'approve_document'))
with check (approver_id=auth.uid() and status in ('approved','rejected') and decided_at is not null and public.current_user_has_governance_capability(organization_id,'approve_document'));
