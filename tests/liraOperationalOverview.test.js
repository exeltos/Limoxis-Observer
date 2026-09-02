import { describe,expect,it } from 'vitest'
import { buildOperationalOverview,compareOperationalOverview } from '../src/features/lira/liraOperationalOverview'

const data={
 surveillance:[{id:'s1',department:'ΜΕΘ',state:'active',reviewDue:'2026-09-01',signalDate:'2026-09-01'}],
 laboratory:[
  {id:'l1',department:'ΜΕΘ',critical:true,communications:[],resistance:'MDR',signalDate:'2026-09-01'},
  {id:'l0',department:'ΜΕΘ',critical:false,communications:[],resistance:null,signalDate:'2026-08-01'},
  {id:'l2',department:'Παθολογική',critical:false,communications:[],resistance:null,signalDate:'2026-09-01'},
 ],
 handHygiene:[{id:'h1',departmentEl:'ΜΕΘ',observations:100,rate:62,signalDate:'2026-09-01'},{id:'h0',departmentEl:'ΜΕΘ',observations:100,rate:88,signalDate:'2026-08-01'}],
 bundles:[{id:'b1',departmentEl:'ΜΕΘ',allOrNone:false,signalDate:'2026-09-01'},{id:'b0',departmentEl:'ΜΕΘ',allOrNone:true,signalDate:'2026-08-01'}],
 qualityIncidents:[{id:'i1',department:'ΜΕΘ',severity:'critical',status:'open',signalDate:'2026-09-01'}],
 qualityCapas:[{id:'c1',department:'ΜΕΘ',status:'open',dueDate:'2026-08-30',signalDate:'2026-09-01'}],
}

describe('LIRA operational overview',()=>{
 it('prioritizes urgent cross-domain signals for a department',()=>{
  const answer=buildOperationalOverview(data,{department:'ΜΕΘ',today:'2026-09-02',language:'el'})
  expect(answer.points[0]).toContain('Γνωστοποίηση κρίσιμων εργαστηριακών')
  expect(answer.points.join(' ')).toContain('Εκπρόθεσμη επανεκτίμηση επιτήρησης')
  expect(answer.points.join(' ')).toContain('Σοβαρά ανοικτά συμβάντα ποιότητας')
  expect(answer.metrics.handHygiene).toBe(75)
  expect(answer.metrics.bundleCompliance).toBe(50)
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

 it('identifies what worsened across matched periods',()=>{
  const spec={current:{start:'2026-09-01',end:'2026-09-02',label:'9/2026 MTD'},reference:{start:'2026-08-01',end:'2026-08-02',label:'8/2026 MTD'}}
  const answer=compareOperationalOverview(data,spec,{department:'ΜΕΘ',today:'2026-09-02',language:'el'})
  expect(answer.title).toBe('Τι άλλαξε;')
  expect(answer.points.join(' ')).toContain('AMR / MDR-XDR: 0 → 1 · επιδεινώθηκε')
  expect(answer.points.join(' ')).toContain('συμμόρφωση υγιεινής χεριών: 88% → 62% · επιδεινώθηκε')
  expect(answer.points.join(' ')).toContain('bundle all-or-none συμμόρφωση: 100% → 0% · επιδεινώθηκε')
  expect(answer.changes.filter(x=>x.worsened).length).toBeGreaterThanOrEqual(3)
 })
})