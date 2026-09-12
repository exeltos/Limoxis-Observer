import { describe,expect,it } from 'vitest'
import { buildSurveillanceJourneyStages } from '../src/features/surveillance/SurveillanceJourneyMap'

const t=key=>key
const fmtDate=value=>value||'—'

describe('production surveillance journey stages',()=>{
  it('locks dependent clinical stages until their evidence exists',()=>{
    const stages=buildSurveillanceJourneyStages({startedAt:'2026-09-12',samples:[],therapy:[],reassessments:[]},t,fmtDate)
    expect(stages.find(stage=>stage.id==='assessment')).toMatchObject({locked:false,status:'pending'})
    expect(stages.filter(stage=>stage.id!=='assessment').every(stage=>stage.locked)).toBe(true)
  })

  it('unlocks the governed path as assessment, validated laboratory evidence and reassessment arrive',()=>{
    const stages=buildSurveillanceJourneyStages({
      startedAt:'2026-09-12',
      assessment:{date:'2026-09-12'},
      samples:[{organism:'K. pneumoniae'}],
      haiClassification:{status:'confirmed'},
      isolation:{status:'active'},
      therapy:[{antimicrobial:'Meropenem'}],
      reassessments:[{date:'2026-09-13'}],
      outcome:null,
    },t,fmtDate)

    expect(stages.every(stage=>!stage.locked)).toBe(true)
    expect(stages.map(stage=>stage.status)).toEqual(['complete','complete','complete','complete','complete','complete','pending'])
  })
})
