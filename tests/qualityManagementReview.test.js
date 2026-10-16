import { describe, expect, it } from 'vitest'
import { REVIEW_SECTIONS, newReviewFrom, objectiveState, sectionFacts, nextCode } from '../src/features/quality/review/reviewTemplate'

describe('management review', () => {
  it('has the sixteen sections of the minutes form', () => {
    expect(REVIEW_SECTIONS).toHaveLength(16)
    expect(new Set(REVIEW_SECTIONS.map(section => section.key)).size).toBe(16)
  })

  it('starts a new review from the previous one: participants, frequency, open actions, period', () => {
    const previous = { reviewDate: '2026-08-26', frequencyDays: 90, participants: [{ name: 'Α' }, { name: 'Β' }], actions: [{ title: 'x', status: 'open' }, { title: 'y', status: 'done' }] }
    const next = newReviewFrom(previous, '2026-11-24')
    expect(next.periodFrom).toBe('2026-08-27')
    expect(next.nextReviewDate).toBe('2027-02-22')
    expect(next.participants.map(person => person.name)).toEqual(['Α', 'Β'])
    expect(next.actions.map(action => action.title)).toEqual(['x'])
    expect(next.sections).toHaveLength(16)
  })

  it('summarises the reports, corrective actions and audits of the period', () => {
    const period = { from: '2026-08-27', to: '2026-11-24' }
    const data = { incidents: [{ date: '2026-09-01', status: 'closed', reportKind: 'complaint' }, { date: '2026-10-01', sentinel: true }, { date: '2026-01-01' }], capas: [{ status: 'open', dueDate: '2026-10-01', date: '2026-09-02' }], audits: [{ plannedDate: '2026-09-10', status: 'completed' }] }
    expect(sectionFacts('incidents', data, period)[0]).toMatch(/^2 αναφορές.*1 έκλεισαν, 1 συμβάντα-φρουροί/)
    expect(sectionFacts('complaints', data, period)[0]).toMatch(/1 παράπονα/)
    expect(sectionFacts('capas', data, period)[0]).toMatch(/1 διορθωτικές.*1 ανοιχτές σήμερα, 1 εκπρόθεσμες/)
    expect(sectionFacts('audits', data, period)[0]).toMatch(/1 επιθεωρήσεις στην περίοδο, 1 ολοκληρωμένες/)
  })

  it('judges an objective against its target in its direction', () => {
    expect(objectiveState({ target: 12, direction: 'lower' }, 11)).toBe('met')
    expect(objectiveState({ target: 50, direction: 'higher' }, 40)).toBe('missed')
    expect(objectiveState({ target: 50, direction: 'higher' }, null)).toBe('pending')
    expect(nextCode('MR', ['MR-2026-01', 'MR-2026-03'], 2026)).toBe('MR-2026-04')
  })
})
