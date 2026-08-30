import { readFileSync } from 'node:fs'
import { URL } from 'node:url'
import { describe,expect,it } from 'vitest'

const migration=readFileSync(new URL('../supabase/migrations/202608300015_v0272_governance_schema_coverage.sql',import.meta.url),'utf8')

describe('governance migration authorization contract',()=>{
  it('binds committee secretariat authority to an active record assignment',()=>{
    expect(migration).toContain("om.role::text='committee_secretariat'")
    expect(migration).toContain("wa.source_type='committee' and wa.source_id=target_committee")
    expect(migration).toContain("wa.status in ('open','in_progress','overdue')")
  })

  it('uses explicit committee lifecycle capabilities instead of a blanket manage policy',()=>{
    expect(migration).toContain("'create_committee'")
    expect(migration).toContain("'finalize_committee_minutes'")
    expect(migration).toContain("'archive_committee'")
    expect(migration).not.toContain("current_user_has_governance_capability(organization_id,''manage_committees'')")
  })

  it('keeps routine minutes edits separate from finalization states',()=>{
    expect(migration).toContain("status in ('draft','planned','in_progress') and public.current_user_can_manage_committee(organization_id,committee_id,'edit_committee_minutes')")
    expect(migration).toContain("status in ('approval_pending','finalized') and (status='approval_pending' or finalized_at is not null)")
  })

  it('covers the complete committee evidence graph with tenant-aware RLS',()=>{
    for(const table of ['committee_meeting_attendance','committee_minutes_approvals','committee_plan_items','committee_documents','committee_history']){
      expect(migration).toContain(`create table public.${table}`)
      expect(migration).toContain(`alter table public.${table} enable row level security`)
    }
    expect(migration).toContain('committee_attendance_meeting_tenant_fk')
    expect(migration).toContain('committee_minutes_approvals_meeting_tenant_fk')
    expect(migration).toContain('committee_documents_document_tenant_fk')
  })

  it('lets only the named approver decide a pending minutes approval',()=>{
    expect(migration).toContain('create policy committee_minutes_approvals_decide')
    expect(migration).toContain("approver_id=auth.uid() and status='pending'")
    expect(migration).toContain("approver_id=auth.uid() and status in ('approved','rejected') and decided_at is not null")
    expect(migration).toContain('Committee minutes approval identity is immutable')
  })

  it('locks attendance when the parent meeting leaves its editable lifecycle',()=>{
    expect(migration).toContain("m.status in ('draft','planned','in_progress')")
    expect(migration).toContain("current_user_can_manage_committee(organization_id,committee_id,'edit_committee_minutes')")
  })

  it('enforces the controlled-document review and approval sequence',()=>{
    expect(migration).toContain('create policy controlled_documents_submit_review')
    expect(migration).toContain("status='review' and public.current_user_has_governance_capability(organization_id,'submit_document_review')")
    expect(migration).toContain('create policy controlled_documents_approve')
    expect(migration).toContain("status='approved' and public.current_user_has_governance_capability(organization_id,'approve_document')")
    expect(migration).toContain("status='approved' and public.current_user_has_governance_capability(organization_id,'publish_document')")
    expect(migration).toContain('Document approval identity is immutable')
  })

  it('keeps supersede and archive as different governed transitions',()=>{
    expect(migration).toContain('create policy controlled_documents_supersede')
    expect(migration).toContain("status='superseded' and public.current_user_has_governance_capability(organization_id,'supersede_document')")
    expect(migration).toContain("status='archived' and public.current_user_has_governance_capability(organization_id,'archive_document')")
  })
})
