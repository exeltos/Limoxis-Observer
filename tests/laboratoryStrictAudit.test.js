import {describe,expect,it} from 'vitest'
import fs from 'node:fs'

const record=fs.readFileSync('src/features/laboratory/LaboratorySampleCloudRecordPage.jsx','utf8')
const registry=fs.readFileSync('src/features/laboratory/LaboratoryCloudPage.jsx','utf8')
const rejectionMigration=fs.readFileSync('supabase/migrations/20260902200000_laboratory_sample_rejection_state.sql','utf8')
const indexMigration=fs.readFileSync('supabase/migrations/20260902195000_laboratory_operational_indexes.sql','utf8')

describe('Laboratory strict production audit',()=>{
  it('models specimen rejection as a first-class state with mandatory reason',()=>{
    expect(rejectionMigration).toContain("'rejected'::text")
    expect(rejectionMigration).toContain('laboratory_samples_rejection_reason_check')
    expect(rejectionMigration).toContain('rejected_at is not null')
    expect(record).toContain("setDialog('reject')")
    expect(record).toContain("'rejected',{rejectionReason:reason}")
    expect(registry).toContain('<option value="rejected">')
  })

  it('does not offer AST mutation after microbiology finalization',()=>{
    expect(record).toContain("const resultIsDraft=!result||result.resultStatus==='draft'")
    expect(record).toContain('canManage&&result&&resultIsDraft')
    expect(record).toContain('finalizedAstNotice')
  })

  it('indexes the clinical Laboratory lookup paths used by the production UI',()=>{
    expect(indexMigration).toContain('laboratory_samples_org_patient_idx')
    expect(indexMigration).toContain('laboratory_samples_org_department_idx')
    expect(indexMigration).toContain('microbiology_results_amended_from_idx')
    expect(indexMigration).toContain('amr_classifications_result_idx')
  })
})
