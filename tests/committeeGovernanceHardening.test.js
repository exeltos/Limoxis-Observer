import { describe,expect,it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const finalizationSql=fs.readFileSync(path.resolve('supabase/migrations/202609011730_v0300_committee_minutes_finalization_guard.sql'),'utf8')
const visibilitySql=fs.readFileSync(path.resolve('supabase/migrations/202609011815_v0301_committee_visibility_and_function_acl_hardening.sql'),'utf8')

describe('committee governance hardening',()=>{
  it('requires the minutes approval workflow for present voting members',()=>{
    expect(finalizationSql).toContain("attendance_status = 'present'")
    expect(finalizationSql).toContain('coalesce(a.has_vote, true) = true')
    expect(finalizationSql).toContain('COMMITTEE_MINUTES_APPROVER_ACCOUNT_REQUIRED')
    expect(finalizationSql).toContain('COMMITTEE_MINUTES_APPROVAL_REQUIRED')
    expect(finalizationSql).toContain("old.status <> 'approval_pending'")
  })

  it('does not grant blanket committee visibility to operational department roles',()=>{
    expect(visibilitySql).toContain("when 'view_committees' then om.role in ('hospital_admin','infection_control_lead','quality_manager')")
    expect(visibilitySql).not.toContain("when 'view_committees' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','department_manager','quality_manager')")
  })

  it('allows an active accepted member to view only the linked committee',()=>{
    expect(visibilitySql).toContain('from public.committee_members cm')
    expect(visibilitySql).toContain('cm.committee_id=target_committee')
    expect(visibilitySql).toContain('cm.user_id=auth.uid()')
    expect(visibilitySql).toContain("cm.approval_status in ('approved','not_required')")
  })

  it('removes anonymous/public execution from committee security-definer helpers',()=>{
    expect(visibilitySql).toContain('revoke all on function public.current_user_has_governance_capability(uuid,text) from public, anon')
    expect(visibilitySql).toContain('revoke all on function public.current_user_can_view_committee(uuid,uuid) from public, anon')
    expect(visibilitySql).toContain('revoke all on function public.current_user_can_manage_committee(uuid,uuid,text) from public, anon')
    expect(visibilitySql).toContain('grant execute on function public.current_user_can_view_committee(uuid,uuid) to authenticated, service_role')
  })
})
