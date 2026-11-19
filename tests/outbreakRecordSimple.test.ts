import {describe,expect,it} from 'vitest'
import {readSource} from './helpers/readSource'
import {buildOutbreakLineList} from '../src/features/lira/liraOutbreakInvestigation'
const ui=readSource('src/features/management/LiraOutbreakInvestigationsPanel.tsx')
// The simple investigation record (owner, 19/11/2026): two tabs, one main button, clickable cases, the patient's name.
describe('outbreak investigation record, simplified',()=>{
 it('keeps the patient code as the label and adds the name beside it',()=>{
  const lab=(x: object)=>({resultId:'r',patientId:'p',department:'ΜΕΘ',organism:'Klebsiella',collectedAt:'2026-09-10',...x})
  const [withCode,withoutCode,dash]=buildOutbreakLineList({laboratory:[lab({resultId:'a',patient:'Ελένη Παπά',patientCode:'P-01'}),lab({resultId:'b',patient:'Νίκος Ρ'}),lab({resultId:'c',patient:'—',patientCode:'P-03'})]}).rows
  expect(withCode).toMatchObject({patientLabel:'P-01',patientName:'Ελένη Παπά'})
  expect(withoutCode).toMatchObject({patientLabel:'Νίκος Ρ',patientName:'Νίκος Ρ'})
  expect(dash).toMatchObject({patientLabel:'P-03',patientName:null})
 })
 it('has two tabs and one main button by step',()=>{
  expect(ui).toContain("const RECORD_TABS=['cases','actions']")
  expect(ui).toContain("'Ενέργειες & αποφάσεις'")
  expect(ui).not.toContain("'Σύνοψη'")
  expect(ui).not.toContain('Χρονογραμμή πρόσωπο')
  expect(ui).not.toContain('variant="danger"')
 })
 it('pages the cases and keeps the evidence trail and the timeline in the report',()=>{
  expect(ui).toContain('rows={casePageRows}')
  expect(ui).toContain("onClick:()=>reviewCase(row)")
  expect(ui).toContain('timeline={timeline}')
  expect(ui).toContain('events={events as OutbreakEventLike[]}')
 })
})
