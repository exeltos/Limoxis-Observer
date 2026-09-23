import {describe,expect,it} from 'vitest'
import {buildClinicalScaleContext,isClinicalScaleEligible,patientAgeYears} from '../src/features/clinical-scales/clinicalScaleContext'

const def=(extra={})=>({id:'scale-1',name_el:'SOFA',status:'active',settings:[],orgSetting:{enabled:true,availability:'required',reassessment_hours:24},...extra})

describe('clinical scale patient context',()=>{
 it('calculates age without rounding before the birthday',()=>expect(patientAgeYears('2008-12-01',new Date('2026-09-23T12:00:00Z'))).toBe(17))
 it('filters definitions by governed age limits',()=>{
  expect(isClinicalScaleEligible(def({min_age_years:18}),{age:17})).toBe(false)
  expect(isClinicalScaleEligible(def({min_age_years:18}),{age:18})).toBe(true)
 })
 it('marks a required scale due when it has never been recorded',()=>expect(buildClinicalScaleContext([def()],[],{age:70},new Date('2026-09-23T12:00:00Z'))[0].state).toBe('due'))
 it('marks reassessment overdue and exposes score trend',()=>{
  const rows=[
   {id:'a2',scale_definition_id:'scale-1',score:9,assessed_at:'2026-09-22T10:00:00Z'},
   {id:'a1',scale_definition_id:'scale-1',score:6,assessed_at:'2026-09-21T10:00:00Z'}
  ]
  const result=buildClinicalScaleContext([def()],rows,{age:70},new Date('2026-09-23T12:00:00Z'))[0]
  expect(result.state).toBe('overdue')
  expect(result.delta).toBe(3)
  expect(result.dueAt).toBe('2026-09-23T10:00:00.000Z')
 })
})
