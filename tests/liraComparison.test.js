import { describe,expect,it } from 'vitest'
import { compareLiraDepartments,compareLiraPeriods,inferComparisonSpec,metricForLira,rankLiraDepartments } from '../src/features/lira/liraComparison'

const data={
 laboratory:[
  {id:'a',department:'ΜΕΘ',result:'positive',resistance:'MDR',organism:'Klebsiella',signalDate:'2026-09-01'},
  {id:'b',department:'ΜΕΘ',result:'positive',resistance:null,organism:'Klebsiella',signalDate:'2026-08-01'},
  {id:'c',department:'Παθολογική',result:'positive',resistance:'MDR',organism:'E. coli',signalDate:'2026-09-01'},
 ],
 surveillance:[
  {id:'s1',department:'ΜΕΘ',state:'active',signalDate:'2026-09-01'},
  {id:'s2',department:'Παθολογική',state:'active',signalDate:'2026-08-01'},
 ],
 handHygiene:[
  {id:'h1',departmentEl:'ΜΕΘ',observations:100,rate:65,signalDate:'2026-09-01'},
  {id:'h2',departmentEl:'Παθολογική',observations:100,rate:90,signalDate:'2026-09-01'},
 ],
 patientDays:[
  {id:'pd1',department:'ΜΕΘ',date:'2026-09-01',patientDays:100,signalDate:'2026-09-01'},
  {id:'pd2',department:'ΜΕΘ',date:'2026-08-01',patientDays:200,signalDate:'2026-08-01'},
  {id:'pd3',department:'Παθολογική',date:'2026-09-01',patientDays:400,signalDate:'2026-09-01'},
 ],
 bundles:[],qualityIncidents:[],qualityCapas:[],
}

describe('LIRA comparisons',()=>{
 it('uses matched month-to-date periods',()=>{
  const spec=inferComparisonSpec('Σύγκρινε αυτόν τον μήνα με τον προηγούμενο',{today:'2026-09-02'})
  expect(spec.mode).toBe('period')
  expect(spec.current).toMatchObject({start:'2026-09-01',end:'2026-09-02'})
  expect(spec.reference).toMatchObject({start:'2026-08-01',end:'2026-08-02'})
 })

 it('infers explicit year versus year',()=>{
  const spec=inferComparisonSpec('Σύγκρινε το 2026 με το 2025',{today:'2026-09-02'})
  expect(spec.current.label).toBe('2026')
  expect(spec.reference.label).toBe('2025')
 })

 it('compares matched periods for a topic and department',()=>{
  const spec=inferComparisonSpec('Σύγκρινε αυτόν τον μήνα με τον προηγούμενο',{today:'2026-09-02'})
  const answer=compareLiraPeriods(data,{topic:'laboratory',department:'ΜΕΘ',entity:null},spec,'el')
  expect(answer.points[0]).toContain('9/2026 MTD: 1')
  expect(answer.points[0]).toContain('8/2026 MTD: 1')
 })

 it('normalizes infection counts per 1000 patient-days when denominators exist',()=>{
  const spec=inferComparisonSpec('Σύγκρινε αυτόν τον μήνα με τον προηγούμενο',{today:'2026-09-02'})
  const answer=compareLiraPeriods(data,{topic:'infections',department:'ΜΕΘ',entity:'klebsiella'},spec,'el')
  expect(answer.points[0]).toContain('10 / 1,000 patient-days')
  expect(answer.points[0]).toContain('5 / 1,000 patient-days')
  expect(answer.points.join(' ')).toContain('1 συμβάντα / 100 patient-days')
 })

 it('falls back to counts when patient-day denominator is unavailable',()=>{
  const metric=metricForLira({...data,patientDays:[]},'amr',{department:'ΜΕΘ'})
  expect(metric).toMatchObject({value:1,normalized:false,denominator:null})
 })

 it('detects and compares two named departments',()=>{
  const spec=inferComparisonSpec('Σύγκρινε ΜΕΘ σε σχέση με Παθολογική',{today:'2026-09-02',data})
  expect(spec).toEqual({mode:'department_pair',departments:['ΜΕΘ','Παθολογική']})
  const answer=compareLiraDepartments(data,{topic:'hand_hygiene',entity:null},spec,'el')
  expect(answer.points[0]).toContain('ΜΕΘ: 65%')
  expect(answer.points[0]).toContain('Παθολογική: 90%')
 })

 it('ranks infection departments by normalized rate instead of raw count',()=>{
  const answer=rankLiraDepartments(data,{topic:'infections',department:'all',entity:null},'el')
  expect(answer.points[0]).toContain('ΜΕΘ: 6.67 / 1,000 patient-days')
  expect(answer.points[0]).toContain('(2/300)')
  expect(answer.points[1]).toContain('Παθολογική: 2.5 / 1,000 patient-days')
 })

 it('ranks low hand hygiene compliance as worse',()=>{
  const answer=rankLiraDepartments(data,{topic:'hand_hygiene',department:'all',entity:null},'el')
  expect(answer.points[0]).toContain('ΜΕΘ: 65%')
  expect(answer.points[1]).toContain('Παθολογική: 90%')
 })
})