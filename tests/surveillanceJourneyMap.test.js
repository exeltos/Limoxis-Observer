import { describe,expect,it } from 'vitest'
import { buildSurveillanceJourneyStages } from '../src/features/surveillance/SurveillanceJourneyMap'

const t=key=>key
const fmtDate=value=>value||'—'

describe('production surveillance journey stages',()=>{
  it('keeps every surveillance domain independently accessible before any evidence exists',()=>{
    const stages=buildSurveillanceJourneyStages({startedAt:'2026-09-12',samples:[],therapy:[],reassessments:[]},t,fmtDate)
    expect(stages.find(stage=>stage.id==='assessment')).toMatchObject({locked:false,status:'pending'})
    expect(stages.every(stage=>!stage.locked)).toBe(true)
  })

  it('marks each domain complete as assessment, devices, validated laboratory evidence, isolation, therapy and reassessment arrive',()=>{
    const stages=buildSurveillanceJourneyStages({
      startedAt:'2026-09-12',
      assessment:{date:'2026-09-12'},
      devices:[{id:'d1',name:'Central line'}],
      samples:[{organism:'K. pneumoniae'}],
      haiClassification:{status:'confirmed'},
      isolation:{status:'active'},
      therapy:[{antimicrobial:'Meropenem'}],
      reassessments:[{date:'2026-09-13'}],
      outcome:null,
    },t,fmtDate)

    expect(stages.every(stage=>!stage.locked)).toBe(true)
    expect(stages.map(stage=>stage.status)).toEqual(['complete','complete','complete','complete','complete','complete','complete','pending'])
  })
})
