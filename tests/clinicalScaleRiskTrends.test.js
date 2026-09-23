import {describe,expect,it} from 'vitest'
import {buildClinicalScaleContext} from '../src/features/clinical-scales/clinicalScaleContext'

describe('clinical scale risk and trend context',()=>{
 const definition={id:'scale-1',scale_key:'sofa',name_el:'SOFA',name_en:'SOFA',status:'active',settings:[],orgSetting:{enabled:true,availability:'required',reassessment_hours:24}}
 it('keeps latest, previous and delta together for patient trend display',()=>{
  const rows=[{id:'new',scale_definition_id:'scale-1',score:8,assessed_at:'2026-09-23T08:00:00Z'},{id:'old',scale_definition_id:'scale-1',score:5,assessed_at:'2026-09-22T08:00:00Z'}]
  const [context]=buildClinicalScaleContext([definition],rows,{},new Date('2026-09-23T12:00:00Z'))
  expect(context.latest.id).toBe('new');expect(context.previous.id).toBe('old');expect(context.delta).toBe(3)
 })
 it('marks a required reassessment overdue for risk flagging',()=>{
  const rows=[{id:'old',scale_definition_id:'scale-1',score:5,assessed_at:'2026-09-21T08:00:00Z'}]
  expect(buildClinicalScaleContext([definition],rows,{},new Date('2026-09-23T12:00:00Z'))[0].state).toBe('overdue')
 })
})
