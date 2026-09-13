import fs from 'node:fs'
import {describe,expect,it} from 'vitest'

const editor=fs.readFileSync('src/features/prevention/AntisepticEntryEditor.jsx','utf8')
const service=fs.readFileSync('src/features/prevention/antisepticCloudService.js','utf8')

describe('antiseptic hospital scope and save readiness',()=>{
  it('offers an explicit whole-hospital scope alongside departments',()=>{
    expect(editor).toContain("export const HOSPITAL_SCOPE='__hospital__'")
    expect(editor).toContain("'Όλο το νοσοκομείο'")
    expect(editor).toContain("'Whole hospital'")
    expect(editor).toContain("departmentScope:hospitalScope?'hospital':'department'")
  })

  it('hydrates the first antiseptic product after support data loads so save can enable',()=>{
    expect(editor).toContain('if(draft.antisepticItemId||draft.product||!products.length)return')
    expect(editor).toContain('antisepticItemId:first.id')
    expect(editor).toContain("const valid=Boolean(draft.period&&draft.departmentEl&&draft.product&&draft.antisepticItemId")
    expect(editor).not.toContain('&&departments.length&&products.length')
  })

  it('stores hospital-wide consumption with a null department and can aggregate patient-days',()=>{
    expect(service).toContain("const hospitalScope=isHospitalRecord(record)")
    expect(service).toContain('department_id:department?.id||null')
    expect(service).toContain('const hospitalTotal=rows.find(row=>row.department_id==null)')
    expect(service).toContain('departmentRows.reduce((sum,row)=>sum+(Number(row.patient_days)||0),0)')
  })
})
