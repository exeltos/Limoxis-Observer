import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import { qualityTabOf } from '../src/features/quality/qualityReturnSection'
import { actionRows, filterActions, isOpenRecord, isOverdueAction } from '../src/features/quality/QualityLists'

const page = fs.readFileSync('src/features/quality/QualityPage.jsx', 'utf8')

describe('Quality center entry and tabs', () => {
  it('starts on Reports and restores a tab only when returning from a record', () => {
    // The key is shared with the risk assessment page, which returns to its tab.
    const returnSection = fs.readFileSync('src/features/quality/qualityReturnSection.js', 'utf8')
    expect(returnSection).toContain("QUALITY_RETURN_KEY = 'limoxis.quality.returnSection'")
    expect(page).toContain("import { QUALITY_RETURN_KEY as RETURN_KEY,qualityTabOf } from './qualityReturnSection'")
    expect(page).toContain("useEffect(()=>{writeSessionValue(RETURN_KEY,'')},[])")
  })

  it('maps remembered sections, old and new, to the five tabs', () => {
    expect(qualityTabOf('')).toBe(null)
    expect(qualityTabOf('incidents')).toEqual({ tab: 'reports', view: null })
    expect(qualityTabOf('capas')).toEqual({ tab: 'actions', view: null })
    expect(qualityTabOf('findings')).toEqual({ tab: 'actions', view: null })
    expect(qualityTabOf('risks')).toEqual({ tab: 'risks', view: null })
    expect(qualityTabOf('registers')).toEqual({ tab: 'measure', view: 'registers' })
    expect(qualityTabOf('management')).toEqual({ tab: 'measure', view: 'objectives' })
    expect(qualityTabOf('measure:reviews')).toEqual({ tab: 'measure', view: 'reviews' })
  })

  it('uses the shared module frame: canonical tabs, one figures row, create top right', () => {
    expect(page).toContain('<CanonicalTabs')
    expect(page).toContain('module-summary-strip')
    expect(page).toContain('<CreateAction')
    expect(page).not.toContain('quality-tabs')
  })

  it('lists findings and corrective actions together and flags overdue actions', () => {
    const past = '2020-01-01', future = '2999-01-01'
    const rows = actionRows(
      [{ id: 'FND-1', title: 'Finding', status: 'open', date: '2026-01-01' }],
      [{ id: 'CAPA-1', title: 'Late', status: 'open', dueDate: past }, { id: 'CAPA-2', title: 'Done', status: 'completed', dueDate: past }, { id: 'CAPA-3', title: 'On time', status: 'open', dueDate: future }],
    )
    expect(rows.map(row => row.kind)).toContain('finding')
    expect(rows.filter(isOverdueAction).map(row => row.id)).toEqual(['CAPA-1'])
    const base = { query: '', kind: 'all', status: 'all', department: 'all', quick: null }
    expect(filterActions(rows, { ...base, quick: 'overdue' }, false).map(row => row.id)).toEqual(['CAPA-1'])
    expect(filterActions(rows, { ...base, kind: 'finding' }, false).map(row => row.id)).toEqual(['FND-1'])
  })

  it('does not count voided or cancelled records as needing attention', () => {
    const past = '2020-01-01'
    const rows = actionRows([], [{ id: 'V', status: 'open', lifecycleStatus: 'voided', dueDate: past }, { id: 'C', status: 'cancelled', dueDate: past }])
    expect(rows.filter(isOverdueAction)).toEqual([])
    expect(isOpenRecord({ status: 'open' })).toBe(true)
    expect(isOpenRecord({ status: 'cancelled' })).toBe(false)
  })
})
