import { describe, expect, it } from 'vitest'
import { REVIEW_SECTIONS, sectionFacts } from '../src/features/quality/review/reviewTemplate'

const period = { from: '2026-07-01', to: '2026-09-30' }

describe('management review: facts from the other screens', () => {
  it('gives every section a short name for the list of sections', () => {
    expect(REVIEW_SECTIONS.every(section => section.short && section.shortEn)).toBe(true)
  })

  it('fills the sections that were empty from suppliers, risks, resources, documents and meetings', () => {
    const keys = Object.fromEntries(REVIEW_SECTIONS.map(section => [section.key, section.source]))
    expect(keys).toMatchObject({ providers: 'providers', risks: 'risks', resources: 'resources', compliance: 'compliance', improvements: 'improvements', process_performance: 'processes' })
  })

  it('counts the supplier evaluations, certificates and nonconformities of the period', () => {
    const suppliers = [{ status: 'active', evaluations: [{ evaluatedOn: '2026-08-10', result: 'approved', totalScore: 90 }], certifications: [{ expiresOn: '2026-01-01' }], nonconformities: [{ date: '2026-08-01', status: 'open' }] }]
    const [first, second] = sectionFacts('providers', { suppliers }, period)
    expect(first).toContain('1 ενεργοί προμηθευτές')
    expect(first).toContain('1 αξιολογήσεις στην περίοδο')
    expect(second).toContain('1 ληγμένα πιστοποιητικά')
  })

  it('reports the department meetings and the committees of the period', () => {
    const meetingGroups = [{ id: 'g1', departmentId: 'd1', frequencyDays: 90 }, { id: 'g2', departmentId: 'd2', frequencyDays: 30 }]
    const meetings = [{ groupId: 'g1', departmentId: 'd1', meetingDate: '2026-09-01', trainingHeld: true }]
    const committees = [{ status: 'active', meetings: [{ date: '2026-08-05', status: 'finalized' }], decisions: [{ status: 'open', dueDate: '2026-09-01' }] }]
    const lines = sectionFacts('processes', { meetingGroups, meetings, committees }, period)
    expect(lines[0]).toContain('συναντήθηκαν 1 από 2 τμήματα')
    expect(lines.join(' ')).toContain('Επιτροπές: 1 συνεδριάσεις 1 επιτροπών')
  })

  it('reports documents past their review date and expired licences', () => {
    const documents = [{ status: 'published', reviewDate: '2026-05-01' }, { status: 'published', type: 'licence', reviewDate: '2026-06-01' }, { status: 'superseded', reviewDate: '2020-01-01' }]
    const lines = sectionFacts('compliance', { documents }, period)
    expect(lines[0]).toContain('2 έγγραφα σε ισχύ· 1 έχουν ξεπεράσει')
    expect(lines[1]).toContain('1 άδειες, 1 έχουν λήξει')
  })
})
