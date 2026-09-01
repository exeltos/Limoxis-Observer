import { describe,expect,it } from 'vitest'
import { sanitizeUserMessage,userFacingError } from '../src/core/feedback/userFacingError'

describe('user-facing feedback',()=>{
  it('never exposes backend product terminology',()=>{
    const message=sanitizeUserMessage('Supabase RLS error while calling RPC',{language:'el'})
    expect(message.toLowerCase()).not.toContain('supabase')
    expect(message.toLowerCase()).not.toContain('rls')
    expect(message.toLowerCase()).not.toContain('rpc')
  })

  it('explains permission failures in plain language',()=>{
    expect(userFacingError(new Error('row-level security policy violation'),{language:'el',context:'save'})).toBe('Δεν έχετε δικαίωμα να ολοκληρώσετε αυτή την ενέργεια.')
  })

  it('explains relational delete failures without database language',()=>{
    const message=userFacingError({code:'23503',message:'foreign key violation'},{language:'el',context:'delete'})
    expect(message).toContain('δεν μπορεί να διαγραφεί')
    expect(message.toLowerCase()).not.toContain('foreign key')
  })

  it('uses context-specific generic messages',()=>{
    expect(userFacingError(new Error('unknown failure'),{language:'el',context:'save'})).toContain('αποθήκευση')
    expect(userFacingError(new Error('unknown failure'),{language:'en',context:'load'})).toContain('could not be loaded')
  })
})
