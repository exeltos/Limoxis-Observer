import { describe,expect,it } from 'vitest'
import { resolveLiraTimeScope } from '../src/features/lira/liraScope'

const data={laboratory:[{id:'aug',department:'ΜΕΘ',signalDate:'2026-08-12'},{id:'jul',department:'ΜΕΘ',signalDate:'2026-07-12'},{id:'other',department:'Παθολογική',signalDate:'2026-08-12'}],surveillance:[],handHygiene:[],bundles:[],qualityIncidents:[],qualityCapas:[],patientDays:[],devices:[],haiClassifications:[]}

describe('LIRA conversational time scope',()=>{
 it('applies an explicit named month after department scoping',()=>{
  const result=resolveLiraTimeScope('Τι δεν πήγε καλά στη ΜΕΘ τον Αύγουστο;',{data,plan:{department:'ΜΕΘ',periodDays:0},today:'2026-09-02'})
  expect(result.timeWindow).toMatchObject({start:'2026-08-01',end:'2026-08-31'})
  expect(result.data.laboratory.map(x=>x.id)).toEqual(['aug'])
 })
 it('lets a new explicit month replace the previous conversational period',()=>{
  const august={start:'2026-08-01',end:'2026-08-31',kind:'month'}
  const result=resolveLiraTimeScope('Και τον Ιούλιο;',{data,plan:{department:'ΜΕΘ',periodDays:0},today:'2026-09-02',previousTimeWindow:august})
  expect(result.timeWindow).toMatchObject({start:'2026-07-01',end:'2026-07-31'})
  expect(result.data.laboratory.map(x=>x.id)).toEqual(['jul'])
 })
 it('inherits the prior explicit period for a short follow-up without a new date',()=>{
  const august={start:'2026-08-01',end:'2026-08-31',kind:'month'}
  const result=resolveLiraTimeScope('Γιατί;',{data,plan:{department:'ΜΕΘ',periodDays:0},today:'2026-09-02',previousTimeWindow:august})
  expect(result.timeWindow).toBe(august)
  expect(result.data.laboratory.map(x=>x.id)).toEqual(['aug'])
 })
})
