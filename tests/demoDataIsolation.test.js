import { beforeEach,describe,expect,it,vi } from 'vitest'
import { configureDataEnvironment } from '../src/core/data/dataEnvironment'
import { loadSnapshot,saveSnapshot } from '../src/core/data/repository'
import { loadPatients,createPatient } from '../src/features/patients/patientsService'
import { patientDemoData } from '../src/features/patients/patientDemoData'

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
    configureDataEnvironment({mode:'demo',organizationId:'demo-hospital'})
    expect(loadSnapshot('documents',seed)).toEqual(seed)
  })

  it('does not expose demo writes to a production organization',()=>{
    configureDataEnvironment({mode:'demo',organizationId:'demo-hospital'})
    saveSnapshot('documents',[{id:'demo-only'}])
    configureDataEnvironment({mode:'production',organizationId:'hospital-1'})
    expect(loadSnapshot('documents',[])).toEqual([])
    expect([...globalThis.localStorage.values.keys()]).toContain('demo.demo-hospital:limoxis.documents.v1')
    expect([...globalThis.localStorage.values.keys()]).not.toContain('org.hospital-1:limoxis.documents.v1')
  })

  it('gives a new real organization an empty patient registry, not the demo roster',()=>{
    configureDataEnvironment({mode:'production',organizationId:'hospital-new'})
    expect(loadPatients()).toEqual([])
    configureDataEnvironment({mode:'demo',organizationId:'demo-hospital'})
    expect(loadPatients()).toEqual(patientDemoData)
  })

  it('keeps patients created in one organization out of another',()=>{
    configureDataEnvironment({mode:'production',organizationId:'hospital-a'})
    const {list}=createPatient(loadPatients(),{name:'Real Patient',department:'ICU',admissionDate:'2026-08-31'})
    expect(list).toHaveLength(1)
    expect(loadPatients()).toHaveLength(1)
    configureDataEnvironment({mode:'production',organizationId:'hospital-b'})
    expect(loadPatients()).toEqual([])
  })
})
