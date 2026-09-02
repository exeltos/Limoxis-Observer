import { describe,expect,it } from 'vitest'
import { analyzeHaiContext,compareHaiContext } from '../src/features/lira/liraCorrelation'

const data={
 haiClassifications:[{id:'h1',department:'ΜΕΘ',haiType:'CLABSI',criteriaMet:true,classifiedAt:'2026-09-03'},{id:'h2',department:'ΜΕΘ',haiType:'CLABSI',criteriaMet:true,classifiedAt:'2026-08-03'}],
 devices:[{id:'d1',department:'ΜΕΘ',deviceType:'central_line',insertedAt:'2026-09-01',removedAt:'2026-09-10'},{id:'d2',department:'ΜΕΘ',deviceType:'central_line',insertedAt:'2026-08-01',removedAt:'2026-08-20'}],
 handHygiene:[{id:'hh1',departmentEl:'ΜΕΘ',observations:100,rate:60,signalDate:'2026-09-03'},{id:'hh2',departmentEl:'ΜΕΘ',observations:100,rate:90,signalDate:'2026-08-03'}],
 bundles:[{id:'b1',departmentEl:'ΜΕΘ',allOrNone:false,signalDate:'2026-09-03'},{id:'b2',departmentEl:'ΜΕΘ',allOrNone:true,signalDate:'2026-08-03'}],
 laboratory:[{id:'l1',department:'ΜΕΘ',result:'positive',resistance:'MDR',signalDate:'2026-09-03'},{id:'l2',department:'ΜΕΘ',result:'positive',resistance:null,signalDate:'2026-08-03'}],
}

describe('LIRA HAI contextual analysis',()=>{
 it('reviews prevention and microbiology alongside HAI rate',()=>{
  const answer=analyzeHaiContext(data,'clabsi',{department:'ΜΕΘ',window:{start:'2026-09-01',end:'2026-09-10'},today:'2026-09-10',language:'el'})
  expect(answer.metrics.hai.rate).toBe(100)
  expect(answer.metrics.handHygiene).toBe(60)
  expect(answer.metrics.bundleCompliance).toBe(0)
  expect(answer.metrics.amr).toBe(1)
  expect(answer.points.join(' ')).toContain('όχι για απόδειξη αιτιότητας')
 })

 it('compares contextual signals without claiming causality',()=>{
  const answer=compareHaiContext(data,'clabsi',{start:'2026-09-01',end:'2026-09-10',label:'September'},{start:'2026-08-01',end:'2026-08-10',label:'August'},{department:'ΜΕΘ',today:'2026-09-10',language:'el'})
  expect(answer.points.join(' ')).toContain('Υγιεινή χεριών')
  expect(answer.points.join(' ')).toContain('Bundle all-or-none')
  expect(answer.points.join(' ')).toContain('δεν συμπεραίνει')
 })
})
