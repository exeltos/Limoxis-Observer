import fs from 'node:fs'
import { describe,expect,it } from 'vitest'
import { buildMatchedComparisonSpec } from '../src/features/lira/liraScope'

describe('LIRA phase-1 core contracts',()=>{
 it('uses the governed patient-day period model and not the deprecated patient_days table',()=>{
  const source=fs.readFileSync('src/features/lira/liraDataLayer.js','utf8')
  expect(source).toContain("q('patient_day_periods'")
  expect(source).not.toContain("q('patient_days'")
  expect(source).toContain("provenance:{patientDays:'patient_day_periods'")
 })

 it('wires conversational plan and time-window context into the assistant',()=>{
  const source=fs.readFileSync('src/features/lira/LiraAssistantLauncher.jsx','utf8')
  expect(source).toContain('previousPlan:previousContext?.plan||null')
  expect(source).toContain('previousTimeWindow:previousContext?.timeWindow||null')
  expect(source).toContain('setConversationContext(deterministic.context)')
 })

 it('wires deterministic HAI and operational comparison engines into answers',()=>{
  const source=fs.readFileSync('src/features/lira/LiraAssistantLauncher.jsx','utf8')
  expect(source).toContain('compareHaiRates(data,haiType')
  expect(source).toContain('calculateHaiRate(data,haiType')
  expect(source).toContain('compareOperationalOverview(data,spec')
  expect(source).toContain('explainOperationalChange(data,spec')
 })

 it('builds an immediately preceding matched comparison period',()=>{
  const spec=buildMatchedComparisonSpec({start:'2026-09-01',end:'2026-09-10',label:'September MTD'},{today:'2026-09-10',language:'en'})
  expect(spec.current).toMatchObject({start:'2026-09-01',end:'2026-09-10'})
  expect(spec.reference).toMatchObject({start:'2026-08-22',end:'2026-08-31'})
 })

 it('keeps evidence provenance visible in the assistant response contract',()=>{
  const source=fs.readFileSync('src/features/lira/LiraAssistantLauncher.jsx','utf8')
  expect(source).toContain("item.provenance?.length>0")
  expect(source).toContain("source:'hai_classifications'")
  expect(source).toContain("source:'surveillance_devices'")
 })
})
