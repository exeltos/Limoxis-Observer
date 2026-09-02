import {describe,expect,it} from 'vitest'
import fs from 'node:fs'
import {ADD_ON_CAPABILITIES,ROLES,roleCapabilities,addonCapabilityMap} from '../src/core/permissions/systemRoleMatrix.js'
import {CAPABILITIES} from '../src/core/permissions/capabilityCatalogue.js'

const roleMigration=fs.readFileSync('supabase/migrations/20260902193000_laboratory_role_alignment_and_attachment_scope.sql','utf8')
const finalizationMigration=fs.readFileSync('supabase/migrations/20260902194000_laboratory_capability_scope_and_ast_finalization.sql','utf8')

describe('Laboratory authorization alignment',()=>{
  it('lets Hospital Admin operate Laboratory without role switching',()=>{
    for(const capability of [CAPABILITIES.VIEW_LAB,CAPABILITIES.MANAGE_LAB_SAMPLES,CAPABILITIES.VALIDATE_LAB_RESULTS,CAPABILITIES.COMMUNICATE_CRITICAL_RESULTS,CAPABILITIES.CLASSIFY_RESISTANCE,CAPABILITIES.REOPEN_LAB_RECORD]){
      expect(roleCapabilities[ROLES.HOSPITAL_ADMIN]).toContain(capability)
    }
  })

  it('keeps the Laboratory add-on mapped to VIEW_LAB',()=>{
    expect(addonCapabilityMap[ADD_ON_CAPABILITIES.LAB_ACCESS]).toContain(CAPABILITIES.VIEW_LAB)
  })

  it('aligns Platform Owner, Hospital Admin and Doctor Reviewer with Laboratory RLS',()=>{
    expect(roleMigration).toContain("'hospital_admin','infection_control_lead','infection_control_member','laboratory','doctor_reviewer'")
    expect(roleMigration).toContain('current_user_is_platform_owner()')
  })

  it('isolates clinical Laboratory attachments from generic organization-member policies',()=>{
    expect(roleMigration).toContain("entity_type not in ('committee_document','laboratory_sample')")
    expect(roleMigration).toContain('attachments_laboratory_read')
    expect(roleMigration).toContain('attachments_storage_laboratory_read')
  })

  it('requires VIEW_LAB capability for department-scoped access and freezes finalized AST evidence',()=>{
    expect(finalizationMigration).toContain("current_user_has_capability(organization_id,'view_lab')")
    expect(finalizationMigration).toContain('guard_finalized_ast_mutation')
    expect(finalizationMigration).toContain("target_status is distinct from 'draft'")
  })
})
