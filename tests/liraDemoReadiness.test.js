import fs from 'node:fs'
import {describe,expect,it} from 'vitest'

describe('LIRA demo test readiness',()=>{
 it('keeps LIRA available from canonical demo datasets without Supabase reads',()=>{
  const source=fs.readFileSync('src/features/lira/liraDataLayer.js','utf8')
  const demo=source.slice(source.indexOf('if(isDemo)'),source.indexOf("if(!supabase||!organizationId)"))
  expect(demo).toContain("source:'demo'")
  expect(demo).toContain("mode:'demo'")
  expect(demo).toContain('surveillanceDemoData')
  expect(demo).toContain('laboratorySamples')
  expect(demo).toContain('handHygieneRows')
  expect(demo).toContain('qualityIncidents')
  expect(demo).not.toContain('supabase.from(')
 })
 it('does not confuse demo evidence with production evidence',()=>{
  const source=fs.readFileSync('src/features/lira/liraDataLayer.js','utf8')
  expect(source).toContain("provenance:{mode:'demo'")
  expect(source).toContain("source:'production',provenance:{patientDays:'patient_day_periods'")
 })
})
