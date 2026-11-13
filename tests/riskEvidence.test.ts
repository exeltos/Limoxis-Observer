import { describe, expect, it } from 'vitest'
import { riskEvidence } from '../src/features/quality/risk/riskModel'

describe('a risk beside what happened in practice', () => {
  it('counts the last year\'s incidents of the named departments and the findings of its JCI chapter', () => {
    const incidents = [
      { department: 'ΜΕΘ', date: '2026-05-01' },
      { department: 'ΜΕΘ', date: '2025-01-01' },
      { department: 'Παθολογική', date: '2026-06-01' },
      { department: 'ΜΕΘ', date: '2026-07-01', lifecycleStatus: 'voided' },
    ]
    const findings = [
      { standard: 'jci', clauseRef: 'IPSG.5.1', date: '2026-03-01' },
      { standard: 'jci', clauseRef: 'PCI.3', date: '2026-03-01' },
      { standard: 'iso9001', clauseRef: 'IPSG.5', date: '2026-03-01' },
    ]
    expect(riskEvidence({ scope: 'ΜΕΘ ενηλίκων', jci: 'IPSG.5' }, { incidents, findings }, '2026-10-27')).toEqual({ incidents: 1, findings: 1 })
    expect(riskEvidence({ scope: 'Χειρουργείο' }, { incidents, findings }, '2026-10-27')).toEqual({ incidents: 0, findings: 0 })
  })
})
