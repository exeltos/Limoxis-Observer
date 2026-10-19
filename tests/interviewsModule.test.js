import fs from 'node:fs'
import { beforeEach, describe, expect, it } from 'vitest'
import { CRITERIA, ageOn, candidateProblems, decisionProblems, employeeDraftFor, filterCandidates, interviewProblems, latestEvaluation, matchingEmployees, newCandidate, newInterview, nextInterview, overallRating, pipelineCounts, positionsOf, splitFullName, statusAfterDecision, statusAfterEvaluation, statusAfterSchedule, statusLabel, upcomingInterviews } from '../src/features/interviews/interviewsModel'
import { interviewsDemoState } from '../src/features/interviews/interviewsDemoData'
import { evaluationDocument } from '../src/features/interviews/interviewsReports'
import { decide, fromRow, loadInterviews, markHired, saveCandidate, saveInterview, toRow } from '../src/features/interviews/interviewsService'
import { configureDataEnvironment } from '../src/core/data/dataEnvironment'
import { CAPABILITIES, ROLES, can } from '../src/core/permissions/roles'

describe('Interviews model', () => {
  it('counts the pipeline and filters the list by status, position and search', () => {
    const { candidates } = interviewsDemoState()
    const counts = pipelineCounts(candidates)
    expect(counts.total).toBe(candidates.length)
    expect(counts.new + counts.screening + counts.interview_scheduled + counts.interviewed + counts.offer).toBe(counts.open)
    expect(counts.rejected).toBe(1)
    expect(filterCandidates(candidates, { status: 'open' }).every(item => !['hired', 'rejected', 'withdrawn'].includes(item.status))).toBe(true)
    expect(filterCandidates(candidates, { position: 'ΤΕ Νοσηλευτική' }).length).toBe(3)
    expect(filterCandidates(candidates, { query: 'μιχαηλιδου' }).map(item => item.code)).toEqual(['ΥΠ-0003'])
    expect(positionsOf(candidates)).toContain('Μάγειρας')
    expect(statusLabel('interview_scheduled', 'en')).toBe('Interview scheduled')
  })

  it('rates an interview by the mean of the criteria scored', () => {
    expect(CRITERIA).toHaveLength(6)
    expect(overallRating({ presentation: 4, knowledge: 5 })).toBe(4.5)
    expect(overallRating({ presentation: 4, knowledge: 4, experience: 3 })).toBe(3.7)
    expect(overallRating({ presentation: 9, knowledge: 0 })).toBeNull()
    expect(overallRating({})).toBeNull()
  })

  it('moves the application forward, never back', () => {
    expect(statusAfterSchedule('new')).toBe('interview_scheduled')
    expect(statusAfterSchedule('offer')).toBe('offer')
    expect(statusAfterEvaluation('interview_scheduled')).toBe('interviewed')
    expect(statusAfterEvaluation('offer')).toBe('offer')
    expect(statusAfterDecision('hire', 'interviewed')).toBe('offer')
    expect(statusAfterDecision('reject', 'interviewed')).toBe('rejected')
    expect(statusAfterDecision('reserve', 'offer')).toBe('interviewed')
    expect(statusAfterDecision('reject', 'hired')).toBe('hired')
  })

  it('asks for the name and the consent of an application, and checks the rest', () => {
    expect(candidateProblems(newCandidate(), 'en')).toEqual(['full name', 'consent to the processing of personal data'])
    expect(candidateProblems({ ...newCandidate(), fullName: 'Α Β', consentGiven: true, email: 'bad', birthDate: '2999-01-01' }, 'en')).toEqual(['a valid email', 'a birth date in the past'])
    expect(candidateProblems({ ...newCandidate(), fullName: 'Α Β', source: 'filemaker' })).toEqual([])
    expect(candidateProblems({ ...newCandidate(), fullName: 'Α Β', consentGiven: true, employers: [{ employer: 'X', fromOn: '2020-01-01', toOn: '2019-01-01' }] }, 'en')).toEqual(['employer dates in order'])
    expect(interviewProblems(newInterview('c'), 'en')).toEqual(['date and time'])
    expect(interviewProblems({ ...newInterview('c'), scores: { knowledge: 4 } }, 'en', { evaluation: true })).toEqual(['the recommendation', 'an evaluator'])
    expect(decisionProblems({ decision: 'reject', decisionOn: '2026-10-19' }, 'en')).toEqual(['the reason'])
  })

  it('finds the next and the latest interview, and the ones to come', () => {
    const { candidates } = interviewsDemoState()
    const scheduled = candidates.find(item => item.status === 'interview_scheduled')
    expect(nextInterview(scheduled)?.status).toBe('scheduled')
    expect(latestEvaluation(candidates.find(item => item.status === 'offer'))?.overallRating).toBe(4.5)
    expect(upcomingInterviews(candidates).map(item => item.candidate.id)).toEqual([scheduled.id])
  })

  it('prepares the employee of a hired candidate and finds one already in the registry', () => {
    expect(splitFullName('Αθανασίου Ελένη Μαρία')).toEqual({ lastName: 'Αθανασίου', firstName: 'Ελένη Μαρία' })
    const candidate = { ...newCandidate(), fullName: 'Αθανασίου Ελένη', email: 'e@example.org', phoneMobile: '69', requestedPosition: 'ΤΕ Νοσηλευτική', birthDate: '1995-11-08' }
    expect(employeeDraftFor(candidate, '2026-10-19')).toMatchObject({ lastName: 'Αθανασίου', firstName: 'Ελένη', phone: '69', position: 'ΤΕ Νοσηλευτική', hireDate: '2026-10-19' })
    expect(matchingEmployees(candidate, [{ id: '1', firstName: 'ΕΛΕΝΗ', lastName: 'ΑΘΑΝΑΣΙΟΥ' }, { id: '2', firstName: 'Νίκος', lastName: 'Άλλος' }, { id: '3', firstName: 'X', lastName: 'Y', email: 'E@example.org' }]).map(item => item.id)).toEqual(['1', '3'])
    expect(ageOn('1995-11-08', '2026-10-19')).toBe(30)
    expect(ageOn('1995-10-19', '2026-10-19')).toBe(31)
  })

  it('prints the evaluation sheet with the score per criterion and the panel', () => {
    const { candidates } = interviewsDemoState()
    const candidate = candidates.find(item => item.status === 'offer')
    const doc = evaluationDocument(candidate, latestEvaluation(candidate), { language: 'en' })
    expect(doc.code).toBe(candidate.code)
    const scores = doc.sections.find(section => section.title.startsWith('Score'))
    expect(scores.table.rows).toHaveLength(6)
    expect(scores.table.foot[1].text).toBe('4.5 / 5')
    expect(doc.signatures.map(item => item.role)).toContain('HR office')
  })
})

describe('Interviews service (demo)', () => {
  beforeEach(() => configureDataEnvironment({ mode: 'demo', demoAccountId: `interviews-${Math.random()}` }))

  it('maps the columns both ways', () => {
    expect(toRow('hr_candidates', { fullName: ' Α Β ', children: '2', smoker: '', education: undefined, employeeId: 'EMP-1' })).toEqual({ full_name: 'Α Β', children: 2, smoker: null, education: [], employee_id: null })
    expect(fromRow('hr_interviews', { id: 'x', scores: null, interviewers: [{ name: 'Α' }], overall_rating: 4 })).toMatchObject({ id: 'x', scores: {}, interviewers: [{ name: 'Α' }], overallRating: 4, outcome: '' })
  })

  it('records an application, schedules and evaluates the interview, decides and hires', async () => {
    const id = await saveCandidate(null, { ...newCandidate(), fullName: 'Νέος Υποψήφιος', consentGiven: true, languages: [{ language: 'en', speaking: 'good' }, { language: '' }], employers: [{ employer: 'Α.Ε.' }] })
    let candidate = (await loadInterviews(null)).candidates.find(item => item.id === id)
    expect(candidate.code).toBe('ΥΠ-0008')
    expect(candidate.consentAt).toBeTruthy()
    expect(candidate.languages).toHaveLength(1)
    await saveInterview(null, candidate, { ...newInterview(id), scheduledAt: '2026-11-02T09:00:00.000Z' })
    candidate = (await loadInterviews(null)).candidates.find(item => item.id === id)
    expect(candidate.status).toBe('interview_scheduled')
    await saveInterview(null, candidate, { ...candidate.interviews[0], status: 'completed', scores: { knowledge: 5, teamwork: 4 }, outcome: 'recommend', interviewers: [{ name: 'HR' }] }, { actor: { name: 'HR' } })
    candidate = (await loadInterviews(null)).candidates.find(item => item.id === id)
    expect(candidate.status).toBe('interviewed')
    expect(candidate.interviews[0]).toMatchObject({ overallRating: 4.5, evaluatedByName: 'HR' })
    await decide(null, candidate, { decision: 'hire', decisionOn: '2026-11-03', decisionByName: 'Διευθυντής', decisionNotes: '' })
    candidate = (await loadInterviews(null)).candidates.find(item => item.id === id)
    expect(candidate.status).toBe('offer')
    await markHired(null, candidate, { id: 'EMP-900' })
    candidate = (await loadInterviews(null)).candidates.find(item => item.id === id)
    expect(candidate).toMatchObject({ status: 'hired', decision: 'hire', employeeId: 'EMP-900' })
  })
})

describe('Interviews access, database and help', () => {
  it('lets only HR and the Hospital Admin see and manage the applications', () => {
    expect(can(ROLES.HR_OFFICE, CAPABILITIES.MANAGE_INTERVIEWS)).toBe(true)
    expect(can(ROLES.HOSPITAL_ADMIN, CAPABILITIES.VIEW_INTERVIEWS)).toBe(true)
    expect(can(ROLES.INFECTION_CONTROL_LEAD, CAPABILITIES.VIEW_INTERVIEWS)).toBe(false)
    expect(can(ROLES.QUALITY_MANAGER, CAPABILITIES.VIEW_INTERVIEWS)).toBe(false)
  })

  it('keeps the personal data behind RLS by capability and imports FileMaker with links', () => {
    const sql = fs.readFileSync('supabase/migrations/20261128300000_hr_interviews.sql', 'utf8')
    for (const table of ['hr_candidates', 'hr_candidate_languages', 'hr_candidate_employers', 'hr_interviews']) expect(sql).toContain(`'${table}'`)
    expect(sql).toContain("current_user_has_capability(organization_id, ''view_interviews'')")
    expect(sql).toContain("current_user_has_capability(organization_id, ''manage_interviews'')")
    const importSql = fs.readFileSync('supabase/migrations/20261128300100_hr_interviews_filemaker_import.sql', 'utf8')
    expect(importSql).toContain('fm_stage_links')
    expect(importSql).toContain("'HR Data ERGODOTES'")
    expect(importSql).toContain("'HR Language'")
    expect(importSql).not.toContain("'ΥΓΕΙΑ'")
  })

  it('has a help section for /interviews in both languages', async () => {
    const { helpManual } = await import('../src/core/help/helpManual.js')
    const { helpManualEn } = await import('../src/core/help/helpManualEn.js')
    const { helpExtras } = await import('../src/core/help/helpExtras.js')
    expect(helpManual['/interviews'].chapters.length).toBe(helpManualEn['/interviews'].chapters.length)
    expect(helpExtras['/interviews'].checks.el.length).toBeGreaterThan(0)
  })
})
