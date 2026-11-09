import { describe, expect, it } from 'vitest'
import { actionsOfSource, capaSourceInfo, committeeDecisionSourceId, sourceKindLabel } from '../src/features/quality/capaSources'
import { actionRows, filterActions } from '../src/features/quality/QualityLists'

describe('Where an action came from', () => {
  it('reads every kind of source and where it opens', () => {
    expect(capaSourceInfo('DM:DM-2026-004#d1')).toMatchObject({ kind: 'meeting', code: 'DM-2026-004', path: '/meetings/DM-2026-004' })
    expect(capaSourceInfo(committeeDecisionSourceId('COM-002', 'M-7', 'TOP-1'))).toMatchObject({ kind: 'committee', code: 'COM-002', path: '/committees/COM-002?minutes=M-7' })
    expect(capaSourceInfo('COM-001')).toMatchObject({ kind: 'committee', path: '/committees/COM-001' })
    // A decision brought over without its meeting: a committee, with nothing to open.
    expect(capaSourceInfo('DEC-FM-1090')).toMatchObject({ kind: 'committee', path: null })
    expect(capaSourceInfo('QO-2024-071')).toMatchObject({ kind: 'objective', path: '/quality/objectives/QO-2024-071' })
    expect(capaSourceInfo('MR:MR-2026-01#a2')).toMatchObject({ kind: 'review', path: '/quality/reviews/MR-2026-01' })
    expect(capaSourceInfo('RISK:RA-1:r3')).toMatchObject({ kind: 'risk', path: '/quality/risks/RA-1?risk=r3' })
    expect(capaSourceInfo('')).toMatchObject({ kind: 'manual', path: null })
    expect(sourceKindLabel('meeting')).toBe('Συνάντηση τμήματος')
  })

  it('lists the live actions of a source and filters the list by source', () => {
    const capas = [
      { id: 'C1', sourceId: 'DM:DM-1#a', status: 'open' },
      { id: 'C2', sourceId: 'DM:DM-1#b', status: 'open', lifecycleStatus: 'voided' },
      { id: 'C3', sourceId: 'COM:COM-2:M#t', status: 'open' },
    ]
    expect(actionsOfSource(capas, 'DM:DM-1#', { prefix: true }).map(row => row.id)).toEqual(['C1'])
    const rows = actionRows([], capas)
    expect(rows.find(row => row.id === 'C3')).toMatchObject({ sourceKind: 'committee', sourceCode: 'COM-2', sourcePath: '/committees/COM-2?minutes=M' })
    const filters = { query: '', kind: 'all', status: 'all', department: 'all', quick: null, source: 'meeting' }
    expect(filterActions(rows, filters, false).map(row => row.id).sort()).toEqual(['C1', 'C2'])
  })
})
