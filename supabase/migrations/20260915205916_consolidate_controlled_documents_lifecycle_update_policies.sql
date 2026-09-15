-- Folds the 6 lifecycle-stage UPDATE policies (approve, archive, edit_draft,
-- publish, submit_review, supersede) into one UPDATE policy via explicit OR
-- of USING and OR of WITH CHECK. Per the empirically-verified combination
-- semantics, this is exactly identical to keeping them separate. INSERT,
-- SELECT, and DELETE policies are untouched (not flagged as overlapping).
drop policy if exists controlled_documents_approve on public.controlled_documents;
drop policy if exists controlled_documents_archive on public.controlled_documents;
drop policy if exists controlled_documents_edit_draft on public.controlled_documents;
drop policy if exists controlled_documents_publish on public.controlled_documents;
drop policy if exists controlled_documents_submit_review on public.controlled_documents;
drop policy if exists controlled_documents_supersede on public.controlled_documents;
create policy controlled_documents_update on public.controlled_documents for update to authenticated
  using (
    (status = 'review' and current_user_has_governance_capability(organization_id, 'approve_document'))
    or (status = 'published' and current_user_has_governance_capability(organization_id, 'archive_document'))
    or (status = 'draft' and current_user_has_governance_capability(organization_id, 'manage_documents'))
    or (status = 'approved' and current_user_has_governance_capability(organization_id, 'publish_document'))
    or (status = 'draft' and current_user_has_governance_capability(organization_id, 'submit_document_review'))
    or (status = 'published' and current_user_has_governance_capability(organization_id, 'supersede_document'))
  )
  with check (
    (status = 'approved' and current_user_has_governance_capability(organization_id, 'approve_document'))
    or (status = 'archived' and current_user_has_governance_capability(organization_id, 'archive_document'))
    or (status = 'draft' and current_user_has_governance_capability(organization_id, 'manage_documents'))
    or (status = 'published' and current_user_has_governance_capability(organization_id, 'publish_document'))
    or (status = 'review' and current_user_has_governance_capability(organization_id, 'submit_document_review'))
    or (status = 'superseded' and current_user_has_governance_capability(organization_id, 'supersede_document'))
  );
