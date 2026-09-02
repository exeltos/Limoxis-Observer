import { describe,expect,it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const page=fs.readFileSync(path.resolve('src/features/committees/CommitteeRecordPage.jsx'),'utf8')
const historySql=fs.readFileSync(path.resolve('supabase/migrations/202609012305_v0306_committee_history_meeting_lifecycle.sql'),'utf8')

describe('committee record lifecycle UI',()=>{
  it('uses an Observer reason dialog instead of browser prompt for ending membership',()=>{
    expect(page).not.toContain('window.prompt')
    expect(page).toContain("dialog?.type==='endMember'")
    expect(page).toContain('ReasonDialog')
  })

  it('keeps institutional framework edits behind create committee governance',()=>{
    expect(page).toContain('canFramework=canDo(CAPABILITIES.CREATE_COMMITTEE)')
    expect(page).toContain("tab==='framework'&&<Framework record={record} canManage={canFramework&&!busy}")
  })

  it('wires governed meeting cancellation and locks cancelled minutes',()=>{
    expect(page).toContain('cancelCommitteeMeetingAsync')
    expect(page).toContain("dialog?.type==='cancelMeeting'")
    expect(page).toContain("['finalized','approval_pending','cancelled'].includes(meeting.status)")
  })

  it('persists committee documents in demo while cloud mode remains attachment-service driven',()=>{
    expect(page).toContain('value={record.documents||[]}')
    expect(page).toContain('onChange={saveDemoDocuments}')
    expect(page).toContain('entityType="committee_document"')
  })

  it('allows governed meeting lifecycle actions to append committee history',()=>{
    expect(historySql).toContain("'create_committee_meeting'")
  })
})
