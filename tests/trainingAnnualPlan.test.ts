import { describe,expect,it } from 'vitest'
import { annualPlanExport,annualTrainingPlan,programMonths } from '../src/features/training/trainingAnnualPlan'

describe('annual training plan',()=>{
 it('spans a programme across the months of the year it runs in',()=>{
  expect(programMonths({startDate:'2026-03-10',dueDate:'2026-05-02'},2026)).toEqual([2,3,4])
  expect(programMonths({startDate:'2025-11-01',dueDate:'2026-01-31'},2026)).toEqual([0])
  expect(programMonths({dueDate:'2026-09-30'},2026)).toEqual([8])
  expect(programMonths({startDate:'2027-01-01',dueDate:'2027-02-01'},2026)).toEqual([])
 })

 it('counts retraining per month and flags requirements with nothing scheduled',()=>{
  const employees=[{id:'E1',employeeCode:'E1',profession:'Nurse'},{id:'E2',employeeCode:'E2',profession:'Nurse'}]
  const programs=[{id:'P1',title:'Hand hygiene',startDate:'2025-03-01',dueDate:'2025-03-20',status:'completed'}]
  const assignments=[{id:'A1',programId:'P1',employeeId:'E1',status:'completed',completedDate:'2025-11-15'}]
  const requirements=[{id:'R1',title:'Hand hygiene',programIds:['P1'],professions:['Nurse'],renewalMonths:12}]
  const plan=annualTrainingPlan({programs,assignments,requirements,employees,year:2026,today:'2026-10-08'})
  expect(plan.rows).toEqual([])
  const need=plan.needs[0]
  expect(need.months[9]).toBe(1) // E2 missing → current month (October)
  expect(need.months[10]).toBe(1) // E1 expires 2026-11-15
  expect(need.uncovered).toBe(true)
  expect(plan.totals).toMatchObject({due:2,uncovered:1})
  const scheduled=annualTrainingPlan({programs:[...programs,{id:'P2',title:'Hand hygiene 2026',startDate:'2026-11-01',dueDate:'2026-11-30',status:'planned'}],assignments,requirements:[{...requirements[0],programIds:['P1','P2']}],employees,year:2026,today:'2026-10-08'})
  expect(scheduled.needs[0].uncovered).toBe(false)
  expect(scheduled.rows.map(r=>[r.program.id,r.state])).toEqual([['P2','planned']])
  const sheet=annualPlanExport(scheduled,{en:true})
  expect(sheet.headers.length).toBe(19)
  expect(sheet.rows[0].slice(7)).toEqual(['','','','','','','','','','','●',''])
 })
})
