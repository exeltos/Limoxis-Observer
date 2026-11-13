import { describe,expect,it } from 'vitest'
import { canForRecord,CAPABILITIES,ROLES } from '../src/core/permissions/roles'

describe('committee assignment authorization identity',()=>{
  it('matches committee secretariat assignments against the persisted committee uuid',()=>{
    const committee={id:'COM-001',dbId:'11111111-1111-1111-1111-111111111111',resourceType:'committee',organizationId:'org-1'}
    const context={
      role:ROLES.COMMITTEE_SECRETARIAT,
      organizationId:'org-1',
      assignments:[{sourceType:'committee',sourceId:'11111111-1111-1111-1111-111111111111',status:'open'}],
    }
    expect(canForRecord(CAPABILITIES.EDIT_COMMITTEE_MINUTES,committee,context)).toBe(true)
  })

  it('does not authorize a secretariat assignment linked to another committee',()=>{
    const committee={id:'COM-001',dbId:'11111111-1111-1111-1111-111111111111',resourceType:'committee',organizationId:'org-1'}
    const context={
      role:ROLES.COMMITTEE_SECRETARIAT,
      organizationId:'org-1',
      assignments:[{sourceType:'committee',sourceId:'22222222-2222-2222-2222-222222222222',status:'open'}],
    }
    expect(canForRecord(CAPABILITIES.EDIT_COMMITTEE_MINUTES,committee,context)).toBe(false)
  })
})
