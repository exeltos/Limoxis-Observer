import { describe,expect,it } from 'vitest'
import { capasForProgram,defaultEffectiveness,effectivenessCapaSource,effectivenessLevels,effectivenessState } from '../src/features/training/trainingEffectiveness'
import { sourcePath } from '../src/features/quality/qualityDeviations'
import { buildCalendarEvents } from '../src/features/calendar/calendarEvents'

const program={id:'TRN-9',title:'Hand hygiene',dueDate:'2026-04-30',status:'completed'}

describe('training effectiveness',()=>{
 it('plans the evaluation three months after the due date',()=>{
  expect(defaultEffectiveness(program).plannedDate).toBe('2026-07-30')
  expect(effectivenessState(program)).toBe('not_planned')
  expect(effectivenessState({...program,effectiveness:{plannedDate:'2026-07-30'}},'2026-10-08')).toBe('overdue')
  expect(effectivenessState({...program,effectiveness:{plannedDate:'2026-12-30'}},'2026-10-08')).toBe('planned')
  expect(effectivenessState({...program,effectiveness:{plannedDate:'2026-07-30',result:'partial'}},'2026-10-08')).toBe('partial')
 })
 it('summarises satisfaction and knowledge from participants',()=>{
  const levels=effectivenessLevels(program,[
   {programId:'TRN-9',status:'completed',feedbackScores:{a:5,b:4},score:90,competent:true,feedbackSubmittedAt:'x'},
   {programId:'TRN-9',status:'completed',feedbackScores:{a:3},score:60,competent:false},
   {programId:'OTHER',status:'completed',score:10,competent:false},
  ])
  expect(levels).toMatchObject({participants:2,completed:2,satisfaction:4,assessed:2,passRate:50,averageScore:75})
 })
 it('prefills a CAPA that links back to the programme',()=>{
  const source=effectivenessCapaSource({...program,effectiveness:{result:'not_effective',method:'audit',criterion:'≥ 80%',notes:'62%'}},{today:'2026-10-08'})
  expect(source).toMatchObject({source:'other',sourceId:'TRAINING:TRN-9',priority:'high',dueDate:'2026-11-08'})
  expect(source.description).toMatch(/≥ 80%[\s\S]*62%/)
  expect(source.subActions).toHaveLength(3)
  expect(sourcePath(source.sourceId)).toBe('/training/TRN-9')
  expect(capasForProgram([{sourceId:'TRAINING:TRN-9'},{sourceId:'TRAINING:TRN-9',lifecycleStatus:'voided'},{sourceId:'CTRL-1'}],'TRN-9')).toHaveLength(1)
 })
 it('shows a pending evaluation of a completed programme in the calendar',()=>{
  const events=buildCalendarEvents({training:{programs:[{...program,effectiveness:{plannedDate:'2026-10-20'}}],assignments:[],certificates:[]}},{from:'2026-10-01',to:'2026-10-31',today:'2026-10-08'})
  expect(events.map(e=>e.id)).toEqual(['trn-eff:TRN-9'])
 })
})
