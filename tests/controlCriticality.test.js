import { describe, expect, it } from 'vitest'
import { compareControlPriority, controlCriticality, criticalityLabel, deviationActions, evidenceSummary, requiresEvidence } from '../src/features/controls/controlCriticality'

const control = (responseConfig = {}) => ({ responseConfig })

describe('control criticality', () => {
  it('defaults to medium and ignores unknown values', () => {
    expect(controlCriticality(control())).toBe('medium')
    expect(controlCriticality(control({ criticality: 'urgent' }))).toBe('medium')
    expect(controlCriticality(control({ criticality: 'high' }))).toBe('high')
    expect(criticalityLabel('high', 'el')).toBe('Υψηλή')
    expect(criticalityLabel('low', 'en')).toBe('Low')
  })

  it('reads evidence and deviation settings', () => {
    expect(requiresEvidence(control())).toBe(false)
    expect(requiresEvidence(control({ requiresEvidence: true }))).toBe(true)
    expect(deviationActions(control({ deviationActions: '  Move vaccines  ' }))).toBe('Move vaccines')
  })

  it('orders overdue before due soon, then high criticality first', () => {
    const rows = [
      { state: 'scheduled', item: control({ criticality: 'high' }) },
      { state: 'overdue', item: control({ criticality: 'low' }) },
      { state: 'overdue', item: control({ criticality: 'high' }) },
      { state: 'dueSoon', item: control() },
    ]
    const ordered = [...rows].sort(compareControlPriority).map((r) => `${r.state}:${controlCriticality(r.item)}`)
    expect(ordered).toEqual(['overdue:high', 'overdue:low', 'dueSoon:medium', 'scheduled:high'])
  })

  it('keeps only name, size and type of an evidence file', () => {
    expect(evidenceSummary({ name: 'print.jpg', size: 2048, type: 'image/jpeg', lastModified: 1 })).toEqual({ name: 'print.jpg', size: 2048, type: 'image/jpeg' })
  })
})
