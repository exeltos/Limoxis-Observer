import { describe,expect,it } from 'vitest'
import fs from 'node:fs'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

describe('unified committee approval UI',()=>{
  it('uses the governed approval panel in the normal meeting dialog',()=>{
    const ui=read('src/features/committees/CommitteeRecordPage.jsx')
    expect(ui).toContain("import { CommitteeApprovalPanel }")
    expect(ui).toContain('<CommitteeApprovalPanel approvals={meeting.approvals||[]}')
    expect(ui).toContain("onRequestChanges={(id,comment)=>onApproval(id,'rejected',comment)}")
    expect(ui).not.toContain("onApproval(pendingMine.id,'rejected')")
  })

  it('shows the correction reason when minutes return to draft',()=>{
    const ui=read('src/features/committees/CommitteeRecordPage.jsx')
    expect(ui).toContain("meeting.status==='draft'&&latestChangeRequest")
    expect(ui).toContain('Ζητήθηκαν διορθώσεις στα πρακτικά')
  })

  it('maps approver names from committee membership data',()=>{
    const service=read('src/features/committees/committeeService.js')
    expect(service).toContain('memberNameByDbId')
    expect(service).toContain('approverName:')
  })
})
