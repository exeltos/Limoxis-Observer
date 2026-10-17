// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

vi.mock('../src/features/management/useLibraries', async original => ({ ...(await original()), useLibraries: () => ({ libraries: { incidentCategories: [] } }) }))
const { QualityRecordDocument } = await import('../src/features/quality/QualityRecordDocument')

const t = value => value
const draw = (recordType, record) => render(<QualityRecordDocument recordType={recordType} record={{ id: 'X-1', title: 'Τίτλος', status: 'open', ...record }} language="el" t={t} />).container

afterEach(cleanup)

describe('Quality record PDF document', () => {
  it('marks a voided record as voided, with who, when and why', () => {
    const doc = draw('capas', { lifecycleStatus: 'voided', voidedAt: '2026-10-01T10:00:00Z', voidedBy: 'Υπεύθυνος', voidReason: 'Διπλή εγγραφή' })
    expect(doc).toHaveTextContent('Ακυρωμένη εγγραφή')
    expect(doc).toHaveTextContent('Διπλή εγγραφή')
  })

  it('leaves the patient outcome out of a suggestion and keeps the category', () => {
    const doc = draw('incidents', { reportKind: 'suggestion', incidentClass: 'nearMiss', category: 'falls' })
    expect(doc).toHaveTextContent('Κατηγορία')
    expect(doc).not.toHaveTextContent('Έφτασε στον ασθενή')
  })

  it('prints the whole history and a root cause analysis that has only whys', () => {
    const history = Array.from({ length: 20 }, (_, i) => ({ at: `2026-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`, action: `event${i}`, actor: 'A' }))
    const doc = draw('capas', { history, rootCauseAnalysis: { whys: ['Γιατί ένα'] } })
    expect(doc.querySelectorAll('h3 + table tbody tr').length).toBeGreaterThanOrEqual(20)
    expect(doc).toHaveTextContent('Γιατί ένα')
  })
})
