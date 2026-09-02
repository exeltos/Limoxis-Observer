import { beforeEach,describe,expect,it,vi } from 'vitest'
import { configureDataEnvironment } from '../src/core/data/dataEnvironment'
import { loadSnapshot,saveSnapshot } from '../src/core/data/repository'

function storage(){
  const values=new Map()
  return {
    get length(){return values.size},
    getItem:key=>values.get(key)??null,
    setItem:(key,value)=>values.set(key,String(value)),
    removeItem:key=>values.delete(key),
    key:index=>[...values.keys()][index]??null,
    values,
  }
}

describe('demo data isolation',()=>{
  beforeEach(()=>vi.stubGlobal('localStorage',storage()))

  it('uses seed fallbacks only in the demo partition',()=>{
    const seed=[{id:'demo-record'}]
    configureDataEnvironment({mode:'production',organizationId:'hospital-1'})
    expect(loadSnapshot('documents',seed)).toEqual([])
    configureDataEnvironment({mode:'demo',organizationId:'demo-hospital',demoAccountId:'demo-user-1'})
    expect(loadSnapshot('documents',seed)).toEqual(seed)
  })

  it('does not expose demo writes to a production organization',()=>{
    configureDataEnvironment({mode:'demo',organizationId:'demo-hospital',demoAccountId:'demo-user-1'})
    saveSnapshot('documents',[{id:'demo-only'}])
    configureDataEnvironment({mode:'production',organizationId:'hospital-1'})
    expect(loadSnapshot('documents',[])).toEqual([])
    expect([...globalThis.localStorage.values.keys()]).toContain('demo.demo-user-1:limoxis.documents.v1')
    expect([...globalThis.localStorage.values.keys()]).not.toContain('org.hospital-1:limoxis.documents.v1')
  })

  it('isolates two demo accounts using the same browser',()=>{
    configureDataEnvironment({mode:'demo',organizationId:'demo-hospital',demoAccountId:'demo-user-1'})
    saveSnapshot('documents',[{id:'demo-user-1-document'}])
    configureDataEnvironment({mode:'demo',organizationId:'demo-hospital',demoAccountId:'demo-user-2'})
    expect(loadSnapshot('documents',[])).toEqual([])
    saveSnapshot('documents',[{id:'demo-user-2-document'}])
    configureDataEnvironment({mode:'demo',organizationId:'demo-hospital',demoAccountId:'demo-user-1'})
    expect(loadSnapshot('documents',[])).toEqual([{id:'demo-user-1-document'}])
  })

  it('gives a real organization empty employee sub-records instead of the demo seed', ()=>{
    const seed=[{id:'VAC-001',employeeId:'EMP-001'}]
    configureDataEnvironment({mode:'production',organizationId:'hospital-1'})
    expect(loadSnapshot('employee_vaccine_records',seed)).toEqual([])
    configureDataEnvironment({mode:'demo',organizationId:'demo-hospital',demoAccountId:'demo-user-1'})
    expect(loadSnapshot('employee_vaccine_records',seed)).toEqual(seed)
  })
})
