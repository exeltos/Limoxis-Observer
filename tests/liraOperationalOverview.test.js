import { describe,expect,it } from 'vitest'
import { buildOperationalOverview } from '../src/features/lira/liraOperationalOverview'

const data={
 surveillance:[{id:'s1',department:'ΜΕΘ',state:'active',reviewDue:'2026-09-01'}],
 laboratory:[{id:'l1',department:'ΜΕΘ',critical:true,communications:[],resistance:'MDR'},{id:'l2',department:'Παθολογική',critical:false,communications:[],resistance:null}],
 handHygiene:[{id:'h1',departmentEl:'ΜΕΘ',observations:100,rate:62}],
 bundles:[{id:'b1',departmentEl:'ΜΕΘ',allOrNone:false}],
 qualityIncidents:[{id:'i1',department:'ΜΕΘ',severity:'critical',status:'open'}],
 qualityCapas:[{id:'c1',department:'ΜΕΘ',status:'open',dueDate:'2026-08-30'}],
}

describe('LIRA operational overview',()=>{
 it('prioritizes urgent cross-domain signals for a department',()=>{
  const answer=buildOperationalOverview(data,{department:'ΜΕΘ',today:'2026-09-02',language:'el'})
  expect(answer.points[0]).toContain('Γνωστοποίηση κρίσιμων εργαστηριακών')
  expect(answer.points.join(' ')).toContain('Εκπρόθεσμη επανεκτίμηση επιτήρησης')
  expect(answer.points.join(' ')).toContain('Σοβαρά ανοικτά συμβάντα ποιότητας')
  expect(answer.metrics.handHygiene).toBe(62)
  expect(answer.metrics.bundleCompliance).toBe(0)
  expect(answer.metrics.overdueCapas).toBe(1)
 })

 it('respects department scope',()=>{
  const answer=buildOperationalOverview(data,{department:'Παθολογική',today:'2026-09-02',language:'el'})
  expect(answer.metrics.criticalUncommunicated).toBe(0)
  expect(answer.metrics.amr).toBe(0)
  expect(answer.metrics.seriousIncidents).toBe(0)
 })

 it('does not present the prioritization as a clinical risk score',()=>{
  const answer=buildOperationalOverview(data,{department:'ΜΕΘ',today:'2026-09-02',language:'el'})
  expect(answer.points.at(-1)).toContain('όχι αυτόνομο κλινικό risk score')
 })
})