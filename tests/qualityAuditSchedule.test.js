import { describe, expect, it } from 'vitest'
import { auditCoverage, missingNextAudits } from '../src/features/quality/audits/auditModel'

const audit = (department, status, day, extra = {}) => ({ id: `${department}-${day}`, department, status, auditType: 'internal', standard: 'iso9001', plannedDate: day, completedDate: status === 'completed' ? day : null, ...extra })

describe('audit programme: two a year per department, the next always planned', () => {
  it('counts the departments with 2, 1 and no audit this year and those without a next one', () => {
    const rows = [
      audit('ΜΕΘ', 'completed', '2026-02-10'), audit('ΜΕΘ', 'planned', '2026-11-15'),
      audit('Παθολογική', 'completed', '2026-03-05'),
      audit('Χειρουργική', 'completed', '2025-05-16'),
    ]
    const coverage = auditCoverage(rows, '2026')
    expect(coverage.full).toBe(1)
    expect(coverage.half).toBe(1)
    expect(coverage.none).toBe(1)
    expect(coverage.noNext).toBe(2)
  })

  it('plans the next audit six months after the last one, never in the past, as a month', () => {
    const planned = missingNextAudits([audit('Παθολογική', 'completed', '2026-05-10'), audit('Χειρουργική', 'completed', '2025-05-16'), audit('ΜΕΘ', 'completed', '2026-02-10'), audit('ΜΕΘ', 'planned', '2026-08-15')], '2026-10-27')
    const byDepartment = Object.fromEntries(planned.map(item => [item.department, item]))
    expect(byDepartment['Παθολογική'].plannedDate).toBe('2026-11-15')
    expect(byDepartment['Χειρουργική'].plannedDate).toBe('2026-11-15')
    expect(byDepartment['Χειρουργική'].plannedMonthOnly).toBe(true)
    expect(byDepartment['ΜΕΘ']).toBeUndefined()
  })
})

describe('audit round: the month\'s audits spread over three working days', () => {
  it('skips the weekend and splits the audits evenly in the departments\' order', async () => {
    const { spreadAuditRound, workingDays } = await import('../src/features/quality/audits/auditModel')
    expect(workingDays('2026-11-13', 3)).toEqual(['2026-11-13', '2026-11-16', '2026-11-17'])
    const rows = ['Α', 'Β', 'Γ', 'Δ', 'Ε', 'ΣΤ', 'Ζ'].map(name => audit(name, 'planned', '2026-11-15', { plannedMonthOnly: true }))
    rows.push(audit('Άλλο μήνα', 'planned', '2026-12-15'))
    const { days, assignments } = spreadAuditRound(rows, '2026-11-10', 3)
    expect(assignments).toHaveLength(7)
    const perDay = days.map(day => assignments.filter(item => item.plannedDate === day).length)
    expect(perDay.reduce((a, b) => a + b, 0)).toBe(7)
    expect(Math.max(...perDay) - Math.min(...perDay)).toBeLessThanOrEqual(1)
    expect(assignments.find(item => item.audit.department === 'Άλλο μήνα')).toBeUndefined()
  })
})

describe('one audit for several standards', () => {
  it('joins the questionnaires, tags each answer with its standard and scores each standard', async () => {
    const { questionsForStandards, auditScore } = await import('../src/features/quality/audits/auditModel')
    const q = (id, chapterRef) => ({ id, question: `Ερώτηση ${id}`, chapterRef, clauseRef: `${chapterRef}.1`, position: Number(id.slice(1)) })
    const rows = questionsForStandards([{ standard: 'iso9001', questions: [q('a1', '7'), q('a2', '8')] }, { standard: 'iso15224', questions: [q('b1', '7')] }])
    expect(rows.map(row => row.standard)).toEqual(['iso9001', 'iso9001', 'iso15224'])
    expect(new Set(rows.map(row => row.id)).size).toBe(3)
    const score = auditScore(rows.map((row, index) => ({ ...row, answer: index === 2 ? 'no' : 'yes' })))
    expect(score.chapters).toHaveLength(3)
    expect(score.standards.find(item => item.standard === 'iso9001').rate).toBe(100)
    expect(score.standards.find(item => item.standard === 'iso15224').rate).toBe(0)
  })
})

describe('readiness across standards', () => {
  it('scores each standard from each department\'s latest audit and lists what is missing', async () => {
    const { auditReadiness } = await import('../src/features/quality/audits/auditModel')
    const rows = (standard, answers) => answers.map((answer, index) => ({ id: `${standard}-${index}`, standard, chapterRef: '7', answer }))
    const audits = [
      { ...audit('ΜΕΘ', 'completed', '2025-05-10'), checklist: rows('iso9001', ['no', 'no']) },
      { ...audit('ΜΕΘ', 'completed', '2026-05-10'), standards: ['iso15224'], checklist: [...rows('iso9001', ['yes', 'yes']), ...rows('iso15224', ['yes', 'no'])] },
      { ...audit('Παθολογική', 'completed', '2025-11-10'), checklist: rows('iso9001', ['yes', 'no']) },
    ]
    const result = auditReadiness(audits, [{ id: 'f', source: 'audit', status: 'open', standard: 'iso9001', findingClass: 'major', dueDate: '2026-01-01' }], '2026-10-27')
    const iso = result.rows.find(row => row.standard === 'iso9001')
    expect(iso.departments).toBe(2)
    expect(iso.rate).toBe(75)
    expect(iso.thisYear).toBe(1)
    expect(result.rows.find(row => row.standard === 'iso15224').rate).toBe(50)
    expect(result.missing.major).toHaveLength(1)
    expect(result.missing.lateFindings).toHaveLength(1)
    expect(result.missing.noAuditThisYear).toEqual(['Παθολογική'])
  })
})
