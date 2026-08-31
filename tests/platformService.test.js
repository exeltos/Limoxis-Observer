import { beforeEach, describe, expect, it, vi } from 'vitest'

const queries=[]

function query(table){
  const operation={table}
  queries.push(operation)
  return {
    select(columns='*'){
      operation.select=columns
      return {
        order:()=>Promise.resolve({data:[],error:null}),
        single:()=>Promise.resolve({data:operation.payload,error:null}),
      }
    },
    insert(payload){
      operation.payload=payload
      return this
    },
  }
}

vi.mock('../src/core/config/env',()=>({hasSupabaseConfig:true}))
vi.mock('../src/core/supabase/client',()=>({supabase:{from:query}}))

const {loadPlatformSnapshot,saveDemoEntitlement}=await import('../src/features/platform/platformService')

describe('platformService demo entitlements',()=>{
  beforeEach(()=>queries.splice(0))

  it('loads demo accounts from the authentication source of truth',async()=>{
    await loadPlatformSnapshot()
    expect(queries.map(item=>item.table)).toContain('platform_demo_entitlements')
    expect(queries.map(item=>item.table)).not.toContain('demo_entitlements')
  })

  it('writes the platform entitlement schema instead of legacy-only fields',async()=>{
    await saveDemoEntitlement({organization_id:'org-1',scope_id:'org-1',scope_type:'organization',valid_from:'2026-08-31',valid_until:'',status:'active'})
    const write=queries.find(item=>item.table==='platform_demo_entitlements')
    expect(write.payload).toEqual({organization_id:'org-1',label:'org-1',contact_name:null,contact_email:null,valid_from:'2026-08-31',valid_until:'9999-12-31',status:'active'})
    expect(write.payload).not.toHaveProperty('scope_id')
    expect(write.payload).not.toHaveProperty('scope_type')
  })

  it('rejects invalid entitlement dates before writing',async()=>{
    await expect(saveDemoEntitlement({valid_from:'2026-09-02',valid_until:'2026-09-01'}))
      .rejects.toThrow('DEMO_INVALID_DATE_RANGE')
    expect(queries).toEqual([])
  })
})
