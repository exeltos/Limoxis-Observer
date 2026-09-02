import { describe,expect,it } from 'vitest'
import { compareLiraPeriods,inferComparisonSpec,rankLiraDepartments } from '../src/features/lira/liraComparison'

const data={
 laboratory:[
  {id:'a',department:'ΜΕΘ',result:'positive',resistance:'MDR',organism:'Klebsiella',signalDate:'2026-09-01'},
  {id:'b',department:'ΜΕΘ',result:'positive',resistance:null,organism:'Klebsiella',signalDate:'2026-08-10'},
  {id:'c',department:'Παθολογική',result:'positive',resistance:'MDR',organism:'E. coli',signalDate:'2026-08-15'},
 ],
 surveillance:[
  {id:'s1',department:'ΜΕΘ',state:'active',signalDate:'2026-09-01'},
  {id:'s2',department:'Παθολογική',state:'active',signalDate:'2026-08-01'},
 ],
 handHygiene:[
  {id:'h1',departmentEl:'ΜΕΘ',observations:100,rate:65,signalDate:'2026-09-01'},
  {id:'h2',departmentEl:'Παθολογική',observations:100,rate:90,signalDate:'2026-09-01'},
 ],
 bundles:[],qualityIncidents:[],qualityCapas:[],
}

describe('LIRA comparisons',()=>{
 it('infers current month versus previous month',()=>{
  const spec=inferComparisonSpec('Σύγκρινε αυτόν τον μήνα με τον προηγούμενο',{today:'2026-09-02'})
  expect(spec.mode).toBe('period')
  expect(spec.current.start).toBe('2026-09-01')
  expect(spec.reference.start).toBe('2026-08-01')
 })

 it('infers explicit year versus year',()=>{
  const spec=inferComparisonSpec('Σύγκρινε το 2026 με το 2025',{today:'2026-09-02'})
  expect(spec.current.label).toBe('2026')
  expect(spec.reference.label).toBe('2025')
 })

 it('compares matched periods for a topic and department',()=>{
  const spec=inferComparisonSpec('Σύγκρινε αυτόν τον μήνα με τον προηγούμενο',{today:'2026-09-02'})
  const answer=compareLiraPeriods(data,{topic:'laboratory',department:'ΜΕΘ'},spec,'el')
  expect(answer.points[0]).toContain('9/2026: 1')
  expect(answer.points[0]).toContain('8/2026: 1')
 })

 it('ranks low hand hygiene compliance as worse',()=>{
  const answer=rankLiraDepartments(data,{topic:'hand_hygiene',department:'all'},'el')
  expect(answer.points[0]).toContain('ΜΕΘ: 65%')
  expect(answer.points[1]).toContain('Παθολογική: 90%')
 })
})
