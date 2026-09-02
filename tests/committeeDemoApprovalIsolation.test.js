import { beforeEach,describe,expect,it,vi } from 'vitest'

function storage(){const values=new Map();return {get length(){return values.size},getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key),key:index=>[...values.keys()][index]??null}}

const {configureDataEnvironment}=await import('../src/core/data/dataEnvironment')
const {requestCommitteeApproval,loadCommitteeApprovals,requestMinutesApprovals}=await import('../src/features/committees/committeeApprovals')

describe('legacy committee approval storage isolation',()=>{
  beforeEach(()=>vi.stubGlobal('localStorage',storage()))

  it('does not create local membership approvals in production',()=>{
    configureDataEnvironment({mode:'production',organizationId:'org-1'})
    expect(requestCommitteeApproval({committeeId:'COM-001',employeeId:'EMP-1'})).toBeNull()
    expect(loadCommitteeApprovals()).toEqual([])
    expect(localStorage.length).toBe(0)
  })

  it('keeps the legacy membership approval flow available inside demo only',()=>{
    configureDataEnvironment({mode:'demo',organizationId:'demo-hospital',demoAccountId:'demo-user'})
    const row=requestCommitteeApproval({committeeId:'COM-001',employeeId:'EMP-1',memberName:'Demo Member'})
    expect(row.status).toBe('pending')
    expect(loadCommitteeApprovals()).toHaveLength(1)
  })

  it('fails closed if the legacy minutes approval writer is called in production',()=>{
    configureDataEnvironment({mode:'production',organizationId:'org-1'})
    expect(()=>requestMinutesApprovals({committee:{id:'COM-001',name:'Committee'},meeting:{id:'MTG-1',title:'Meeting'},presentMembers:[]})).toThrow('PRODUCTION_COMMITTEE_LOCAL_APPROVAL_FORBIDDEN')
  })
})
