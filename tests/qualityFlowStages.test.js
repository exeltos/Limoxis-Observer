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

  it('keeps an incident open until every CAPA is effective, and a voided one out of the flow', () => {
    const capas = [{ status: 'closed', effectivenessStatus: 'effective' }, { status: 'inProgress' }]
    expect(incidentStage({ status: 'underReview' }, capas)).toBe('action')
    expect(incidentFlow({ status: 'underReview' }, capas).find(step => step.id === 'closed').status).toBe('todo')
    const rows = registerRows([{ id: 'INC-1', status: 'reported', lifecycleStatus: 'voided' }], [], [])
    expect(rows[0].stage).toBe('voided')
    expect(registerCounts(rows)).toMatchObject({ open: 0, stages: { toAssess: 0 } })
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

describe('Quality: actions with their source, audits with their figures', async () => {
  const { actionCounts, actionRows, auditCounts, auditRows, filterActions } = await import('../src/features/quality/QualityLists')
  const base = { query: '', kind: 'all', status: 'all', department: 'all', quick: null }

  it('shows a finding only while no action handles it, and names each action’s source', () => {
    const rows = actionRows(
      [{ id: 'FND-1', title: 'Handled', status: 'open' }, { id: 'FND-2', title: 'Waiting', status: 'open' }],
      [{ id: 'CAPA-1', title: 'Fix', status: 'open', sourceId: 'FND-1' }, { id: 'CAPA-2', title: 'From control', status: 'open', sourceId: 'CTRL-9#e1' }],
    )
    expect(rows.filter(row => row.kind === 'finding').map(row => row.id)).toEqual(['FND-2'])
    expect(rows.find(row => row.id === 'CAPA-1')).toMatchObject({ sourceKind: 'finding', sourceTitle: 'Handled' })
    expect(rows.find(row => row.id === 'CAPA-2')).toMatchObject({ sourceKind: 'control', sourceCode: 'CTRL-9' })
    expect(actionCounts(rows)).toMatchObject({ open: 2, orphans: 1 })
    // Searching the source's code finds the action.
    expect(filterActions(rows, { ...base, query: 'ctrl-9' }, false).map(row => row.id)).toEqual(['CAPA-2'])
    // «Open actions» lists the actions it counts, not the findings waiting for one.
    expect(filterActions(rows, { ...base, quick: 'open' }, false).map(row => row.id).sort()).toEqual(['CAPA-1', 'CAPA-2'])
  })

  it('names a management-review decision as the source of its action', () => {
    const rows = actionRows([], [{ id: 'CAPA-3', title: 'Decision', status: 'open', source: 'other', sourceId: 'MR:MR-2026-01' }])
    expect(rows[0].sourceKind).toBe('review')
  })

  it('counts this month’s, late and finding-bearing audits', () => {
    const now = new Date().toISOString().slice(0, 10)
    const rows = auditRows(
      [{ id: 'AUD-1', status: 'planned', plannedDate: now }, { id: 'AUD-2', status: 'planned', plannedDate: '2020-01-01' }, { id: 'AUD-3', status: 'completed', plannedDate: now, completedDate: now, checklist: [{ answer: 'yes' }] }],
      [{ id: 'FND-1', sourceId: 'AUD-3', status: 'open' }],
    )
    expect(auditCounts(rows)).toMatchObject({ month: 1, overdue: 1, withFindings: 1 })
  })
})
