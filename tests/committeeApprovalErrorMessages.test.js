import { describe,expect,it } from 'vitest'
import { userFacingError } from '../src/core/feedback/userFacingError.js'

describe('committee approval user-facing errors',()=>{
  it('maps missing correction comments without technical wording',()=>{
    expect(userFacingError(new Error('COMMITTEE_APPROVAL_REJECTION_COMMENT_REQUIRED'),{language:'el',context:'save'})).toContain('διορθώσεις')
  })

  it('explains immutable decisions clearly',()=>{
    expect(userFacingError(new Error('COMMITTEE_APPROVAL_ALREADY_DECIDED'),{language:'el',context:'save'})).toContain('δεν μπορεί να αλλάξει')
  })

  it('explains stale approval links',()=>{
    expect(userFacingError(new Error('APPROVAL_NOT_AVAILABLE'),{language:'el',context:'load'})).toContain('δεν είναι πλέον διαθέσιμο')
  })
})
