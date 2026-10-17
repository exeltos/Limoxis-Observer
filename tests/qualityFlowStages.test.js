import { describe, expect, it } from 'vitest'
import { incidentFlow, incidentStage } from '../src/features/quality/qualityRecordRules'
import { filterRegister, registerCounts, registerRows } from '../src/features/quality/qualityRegister'
import { nextIncidentStep } from '../src/features/quality/IncidentFlowBar'

describe('Quality: the stage of a report in its flow', () => {
  it('reads the stage from the status and the linked CAPAs', () => {
    expect(incidentStage({ status: 'reported' })).toBe('toAssess')
    expect(incidentStage({ status: 'underReview' })).toBe('investigating')
    expect(incidentStage({ status: 'underReview' }, [{ status: 'inProgress' }])).toBe('action')
    expect(incidentStage({ status: 'underReview' }, [{ status: 'verification' }])).toBe('effectiveness')
    expect(incidentStage({ status: 'underReview' }, [{ status: 'closed', effectivenessStatus: 'effective' }])).toBe('toClose')
    expect(incidentStage({ status: 'closed' }, [{ status: 'open' }])).toBe('closed')
    // A voided CAPA does not count.
    expect(incidentStage({ status: 'underReview' }, [{ status: 'open', lifecycleStatus: 'voided' }])).toBe('investigating')
  })

  it('counts and filters the register by stage', () => {
    const rows = registerRows(
      [{ id: 'INC-1', status: 'reported', date: '2026-10-01' }, { id: 'INC-2', status: 'underReview', date: '2026-10-02' }, { id: 'INC-3', status: 'closed', date: '2026-10-03' }],
      [],
      [{ id: 'CAPA-1', sourceId: 'INC-2', status: 'open' }],
    )
    expect(registerCounts(rows).stages).toMatchObject({ toAssess: 1, action: 1, closed: 1, investigating: 0 })
    expect(filterRegister(rows, { quick: 'action' }).map(row => row.id)).toEqual(['INC-2'])
    expect(filterRegister(rows, { stage: 'closed' }).map(row => row.id)).toEqual(['INC-3'])
  })

  it('offers the next step of the flow, and none once closed', () => {
    const next = (record, capas = []) => nextIncidentStep(incidentFlow(record, capas), { record, capas, en: true })?.id
    expect(next({ status: 'reported' })).toBe('assess')
    expect(next({ status: 'underReview' })).toBe('capa')
    expect(next({ status: 'underReview' }, [{ id: 'C', status: 'open' }])).toBe('openCapa')
    expect(next({ status: 'underReview' }, [{ id: 'C', status: 'closed', effectivenessStatus: 'effective' }])).toBe('close')
    expect(next({ status: 'closed' })).toBe(undefined)
  })
})
