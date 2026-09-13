import {describe,expect,it} from 'vitest'
import fs from 'node:fs'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

describe('indicator registry navigation and record behavior',()=>{
 it('keeps result entry controls out of both the registry and indicator record',()=>{
  const list=read('src/features/indicators/IndicatorsPage.jsx')
  const record=read('src/features/indicators/IndicatorRecordPage.jsx')
  expect(list).not.toContain('className="indicator-manual-value"')
  expect(record).not.toContain('Αποτέλεσμα επιλεγμένης περιόδου')
  expect(record).not.toContain('Αποθήκευση αποτελέσματος')
  expect(record).not.toContain('savePeriodResult')
 })

 it('uses the shared registry memory so returning highlights the last indicator row',()=>{
  const list=read('src/features/indicators/IndicatorsPage.jsx')
  expect(list).toContain("useRegistryMemory('indicators')")
  expect(list).toContain('registry.rowProps')
  expect(list).toContain('registry.openRecord')
  expect(list).toContain('registry.scrollRef')
 })

 it('uses the canonical previous/next record navigation inside an indicator',()=>{
  const record=read('src/features/indicators/IndicatorRecordPage.jsx')
  expect(record).toContain("useRecordSequenceNavigation({registry:'indicators'")
  expect(record).toContain('recordNavigation={recordNavigation}')
 })

 it('removes the ambiguous bulk period save action from the registry',()=>{
  const list=read('src/features/indicators/IndicatorsPage.jsx')
  expect(list).not.toContain('savePeriod')
  expect(list).not.toContain('indicatorsRecords.savePeriod')
 })
})
