import { URL } from 'node:url'
import { describe,expect,it,vi } from 'vitest'
import { isLegacyRecordNumber,visibleSourceId } from '../src/features/quality/qualityVocabulary'
import { actionRows } from '../src/features/quality/QualityLists'
import { readSource } from './helpers/readSource'

vi.mock('../src/features/management/useLibraries',async importOriginal=>({...await importOriginal(),useLibraries:()=>({libraries:{}})}))

const read=name=>readSource(new URL(`../src/features/quality/${name}`,import.meta.url))

describe('FileMaker record number is not shown',()=>{
  it('recognises a bare number and keeps real references',()=>{
    expect(isLegacyRecordNumber('33331142')).toBe(true)
    expect(visibleSourceId('33331142')).toBe('')
    expect(visibleSourceId('INC-2608-003')).toBe('INC-2608-003')
    expect(visibleSourceId('')).toBe('')
    expect(visibleSourceId(undefined)).toBeUndefined()
  })

  it('leaves the number out of the action register',()=>{
    const rows=actionRows([{id:'FND-1',source:'manual',sourceId:'33331142',date:'2026-01-01'} as never],[])
    expect(rows[0].sourceCode).toBe('')
  })

  it('uses the helper wherever the source reference is printed',()=>{
    expect(read('QualityGlance.jsx')).toContain('visibleSourceId(record.sourceId)')
    expect(read('QualityRecordDocument.jsx')).toContain('visibleSourceId(record.sourceId)')
    expect(read('QualityRecordPage.jsx')).toContain('visibleSourceId(draft.sourceId)')
    expect(read('QualityRecordPage.jsx')).toContain('Εισαγωγή από FileMaker #')
    expect(read('QualityRecordPage.jsx')).not.toContain('Εισαγωγή από το αρχείο πηγής · αρ. ')
  })
})

describe('printed finding document',()=>{
  it('never contains the FileMaker number of a manual finding',async()=>{
    const { renderToStaticMarkup }=await import('react-dom/server')
    const { createElement }=await import('react')
    const { QualityRecordDocument }=await import('../src/features/quality/QualityRecordDocument')
    const { QualityGlance,glanceItems }=await import('../src/features/quality/QualityGlance')
    const record={id:'FND-261009-331142',title:'Εύρημα',titleEn:'Finding',severity:'medium',date:'2026-10-09',status:'open',source:'manual',sourceId:'33331142',history:[],lifecycleStatus:'active'}
    const t=value=>value
    for(const language of ['el','en']){
      const html=renderToStaticMarkup(createElement(QualityRecordDocument,{recordType:'findings',record,linked:[],language,t} as never))
      expect(html).not.toContain('33331142')
      expect(html).toContain(language==='en'?'Manual entry':'Χειροκίνητη καταχώρηση')
      expect(JSON.stringify(glanceItems('findings',record,{language,t,linked:[]}))).not.toContain('33331142')
      expect(renderToStaticMarkup(createElement(QualityGlance,{recordType:'findings',record,language,t,linked:[]}))).not.toContain('33331142')
    }
  })
})

describe('«Έλαβε γνώση» box on a printed record',()=>{
  it('is added for a record about a person and offered otherwise',async()=>{
    const { concernsPerson }=await import('../src/features/quality/qualityVocabulary')
    expect(concernsPerson({deviationKind:'staff_behaviour'})).toBe(true)
    expect(concernsPerson({deviationKind:'breakdown'})).toBe(false)
    const page=read('QualityRecordPage.jsx')
    expect(page).toContain("role:en?'Acknowledged':'Έλαβε γνώση'")
    expect(page).toContain('Πεδίο «Έλαβε γνώση» (αναφορά σε τρίτο πρόσωπο)')
  })
})
