import { describe, expect, it } from 'vitest'
import { REVIEW_SECTIONS, sectionFacts } from '../src/features/quality/review/reviewTemplate'
import type { Meeting, MeetingGroup } from '../src/features/quality/meetings/meetingModel'
import type { Review } from '../src/features/quality/review/reviewTypes'

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
    expect(first).toContain('1 ενεργός προμηθευτής')
    expect(first).toContain('1 αξιολόγηση στην περίοδο')
    expect(second).toContain('1 ληγμένο πιστοποιητικό')
    expect(second).toContain('1 μη συμμόρφωση προμηθευτή στην περίοδο, 1 ανοιχτή')
  })

  it('reports the department meetings and the committees of the period', () => {
    const meetingGroups: MeetingGroup[] = [{ id: 'g1', departmentId: 'd1', frequencyDays: 90 }, { id: 'g2', departmentId: 'd2', frequencyDays: 30 }] as never
    const meetings: Meeting[] = [{ groupId: 'g1', departmentId: 'd1', meetingDate: '2026-09-01', trainingHeld: true }] as never
    const committees = [{ status: 'active', meetings: [{ date: '2026-08-05', status: 'finalized' }], decisions: [{ status: 'open', dueDate: '2026-09-01' }] }]
    const lines = sectionFacts('processes', { meetingGroups, meetings, committees }, period)
    expect(lines[0]).toContain('συναντήθηκε 1 από 2 τμήματα, 1 είναι εκπρόθεσμο')
    expect(lines[1]).toContain('1 συνάντηση τμήματος περιείχε εκπαίδευση')
    expect(lines.join(' ')).toContain('Επιτροπές: 1 συνεδρίαση 1 επιτροπής στην περίοδο· 1 απόφαση ανοιχτή, 1 εκπρόθεσμη')
  })

  it('writes one in the singular and more in the plural, in Greek and in English', () => {
    const incidents = [{ date: '2026-08-01', status: 'closed', sentinel: true }, { date: '2026-08-02', status: 'open' }]
    expect(sectionFacts('incidents', { incidents }, period)[0]).toContain('2 αναφορές στην περίοδο 1/7/2026–30/9/2026· 1 έκλεισε, 1 συμβάν-φρουρός.')
    expect(sectionFacts('incidents', { incidents }, period, 'en')[0]).toContain('2 reports in the period (1/7/2026–30/9/2026); 1 closed, 1 sentinel event.')
    const previous: Pick<Review, 'actions'> = { actions: [{ status: 'done' }, { status: 'open' }] } as never
    expect(sectionFacts('previousActions', { previous }, period)[0]).toBe('Από τις 2 ενέργειες της προηγούμενης ανασκόπησης ολοκληρώθηκε 1· 1 παραμένει ανοιχτή.')
    expect(sectionFacts('previousActions', { previous }, period, 'en')[0]).toBe('1 of 2 actions of the previous review is done; 1 remains open.')
  })

  it('reports documents past their review date and expired licences', () => {
    const documents = [{ status: 'published', reviewDate: '2026-05-01' }, { status: 'published', type: 'licence', reviewDate: '2026-06-01' }, { status: 'superseded', reviewDate: '2020-01-01' }]
    const lines = sectionFacts('compliance', { documents }, period)
    expect(lines[0]).toContain('2 έγγραφα σε ισχύ· 1 έχει ξεπεράσει')
    expect(lines[1]).toContain('1 άδεια, 1 έχει λήξει')
  })
})
