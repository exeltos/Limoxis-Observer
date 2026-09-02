import { describe,expect,it } from 'vitest'
import { calculateDeviceDays,calculateHaiRate,compareHaiRates,inferHaiType } from '../src/features/lira/liraHaiMetrics'

const data={
 haiClassifications:[
  {id:'h1',department:'ΜΕΘ',haiType:'CLABSI',criteriaMet:true,classifiedAt:'2026-09-03'},
  {id:'h2',department:'ΜΕΘ',haiType:'CLABSI',criteriaMet:true,classifiedAt:'2026-08-03'},
  {id:'h3',department:'ΜΕΘ',haiType:'CAUTI',criteriaMet:true,classifiedAt:'2026-09-03'},
 ],
 devices:[
  {id:'d1',department:'ΜΕΘ',deviceType:'central_line',insertedAt:'2026-09-01',removedAt:'2026-09-10'},
  {id:'d2',department:'ΜΕΘ',deviceType:'central line',insertedAt:'2026-08-01',removedAt:'2026-08-20'},
  {id:'d3',department:'ΜΕΘ',deviceType:'urinary_catheter',insertedAt:'2026-09-01',removedAt:'2026-09-05'},
 ],
}

describe('LIRA device-associated HAI metrics',()=>{
 it('recognizes device-associated HAI questions',()=>{
  expect(inferHaiType('Πόσα CLABSI είχαμε στη ΜΕΘ;')).toBe('clabsi')
  expect(inferHaiType('CAUTI rate this month')).toBe('cauti')
  expect(inferHaiType('VAP ανά 1000 ventilator days')).toBe('vap')
 })

 it('calculates inclusive device-days within a requested window',()=>{
  const days=calculateDeviceDays(data.devices,'clabsi',{department:'ΜΕΘ',window:{start:'2026-09-01',end:'2026-09-05'},today:'2026-09-05'})
  expect(days).toBe(5)
 })

 it('calculates CLABSI per 1000 central-line days',()=>{
  const metric=calculateHaiRate(data,'clabsi',{department:'ΜΕΘ',window:{start:'2026-09-01',end:'2026-09-10'},today:'2026-09-10'})
  expect(metric).toMatchObject({events:1,deviceDays:10,rate:100,normalized:true})
 })

 it('uses the correct device denominator for CAUTI',()=>{
  const metric=calculateHaiRate(data,'cauti',{department:'ΜΕΘ',window:{start:'2026-09-01',end:'2026-09-05'},today:'2026-09-05'})
  expect(metric.denominatorLabel).toBe('urinary-catheter days')
  expect(metric.deviceDays).toBe(5)
 })

 it('compares device-associated rates across periods',()=>{
  const answer=compareHaiRates(data,'clabsi',{start:'2026-09-01',end:'2026-09-10',label:'September'},{start:'2026-08-01',end:'2026-08-10',label:'August'},{department:'ΜΕΘ',today:'2026-09-10',language:'en'})
  expect(answer.points[0]).toContain('September: 100 / 1,000 central-line days')
  expect(answer.points[0]).toContain('August: 100 / 1,000 central-line days')
 })
})
