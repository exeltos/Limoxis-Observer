// «Εκπαίδευση» for the departments that do not manage training (owner, 20/11/2026): «Οι δικές μου» is one line per
// programme of the user (the latest assignment, how many times), «Όλο το τμήμα» one line per assignment; four figures;
// «Σε εξέλιξη | Ολοκληρωμένες | Όλες»; a certificate expired, expiring within 90 days or valid.
import { describe, expect, it } from 'vitest'
import { readSource } from './helpers/readSource'
import { certificateState, departmentTrainingRows, filterProgramRows, filterTrainingRows, hospitalProgramRows, hospitalProgramTiles, ownTrainingRows, programState, programStatusCounts, trainingRowAction, trainingStatusCounts, trainingTiles } from '../src/features/training/trainingMyView'
import type { TrainingState } from '../src/features/training/trainingData'

const today = '2026-11-20'
const program = (id: string, title: string, status = 'active') => ({ id, title, status, category: 'ipc', method: 'classroom', owner: '', trainer: '', audience: '', description: '', startDate: '', dueDate: '', requiresAssessment: false, materials: [] })
const assignment = (id: string, programId: string, extra: Record<string, unknown>) => ({ id, programId, employeeId: '', employeeName: '', department: 'ΜΕΘ', assignedDate: '2026-01-01', dueDate: '', status: 'assigned', ...extra })
const records = {
  programs: [program('P1', 'Χρήση απινιδωτή'), program('P2', 'Υγιεινή χεριών'), program('P3', 'Αιχμηρά'), program('P4', 'Ακυρωμένο', 'cancelled')],
  assignments: [
    assignment('A1', 'P1', { userId: 'u-me', status: 'completed', assignedDate: '2024-09-01', dueDate: '2024-09-30', completedDate: '2024-09-10', certificateId: 'C1' }),
    assignment('A2', 'P1', { userId: 'u-me', status: 'completed', assignedDate: '2025-09-01', dueDate: '2025-09-30', completedDate: '2025-09-12', certificateId: 'C2', score: 90 }),
    assignment('A3', 'P1', { userId: 'u-me', status: 'assigned', assignedDate: '2026-09-01', dueDate: '2026-12-10' }),
    assignment('A4', 'P2', { userId: 'u-me', status: 'assigned', dueDate: '2026-11-01' }),
    assignment('A5', 'P3', { userId: 'u-me', status: 'completed', dueDate: '2026-06-30', completedDate: '2026-06-18', certificateId: 'C5', assessmentReviewStatus: 'pending' }),
    assignment('A6', 'P4', { userId: 'u-me', status: 'assigned', dueDate: '2026-12-01' }),
    assignment('A7', 'P1', { userId: 'u-other', employeeName: 'Συνάδελφος', status: 'assigned', dueDate: '2026-11-25' }),
    assignment('A8', 'P2', { employeeId: 'EMP-009', employeeName: 'Άλλο τμήμα', department: 'Παθολογική', status: 'assigned', dueDate: '2026-12-20' }),
  ],
  certificates: [
    { id: 'C1', assignmentId: 'A1', employeeId: '', title: 'Χρήση απινιδωτή', issuedDate: '2024-09-10', validUntil: '2025-09-10', issuer: '' },
    { id: 'C2', assignmentId: 'A2', employeeId: '', title: 'Χρήση απινιδωτή', issuedDate: '2025-09-12', validUntil: '2026-12-31', issuer: '', userId: 'u-me' },
    { id: 'C5', assignmentId: 'A5', employeeId: '', title: 'Αιχμηρά', issuedDate: '2026-06-18', validUntil: '2028-06-18', issuer: '' },
  ],
} as unknown as TrainingState
const me = { userId: 'u-me', employeeId: null }

describe('training of the departments: the model', () => {
  it('«Οι δικές μου»: one line per programme (the latest assignment), the repeats counted, cancelled programmes left out', () => {
    const rows = ownTrainingRows(records, me, today)
    expect(rows.map(row => row.id)).toEqual(['A4', 'A3', 'A5'])
    const defibrillator = rows.find(row => row.id === 'A3')!
    expect(defibrillator.times).toBe(3)
    expect(defibrillator.lastDate).toBe('2026-12-10')
    expect(rows.find(row => row.id === 'A4')!.status).toBe('overdue')
    expect(rows.find(row => row.id === 'A5')!.result).toBe('review')
  })

  it('the latest assignment is the one assigned last, not the one with the later deadline', () => {
    const repeated = { ...records, assignments: [
      assignment('B1', 'P2', { userId: 'u-me', assignedDate: '2026-01-10', dueDate: '2026-12-31' }),
      assignment('B2', 'P2', { userId: 'u-me', assignedDate: '2026-10-01', dueDate: '2026-11-10' }),
    ] } as unknown as TrainingState
    const rows = ownTrainingRows(repeated, me, today)
    expect(rows.map(row => row.id)).toEqual(['B2'])
    expect(rows[0].status).toBe('overdue')
  })
  it('the Demo’s own employee is «mine» by the employee code', () => {
    expect(ownTrainingRows(records, { userId: null, employeeId: 'EMP-009' }, today).map(row => row.id)).toEqual(['A8'])
  })

  it('«Όλο το τμήμα»: one line per assignment; in the sample data only the department’s names', () => {
    expect(departmentTrainingRows(records, today).length).toBe(7)
    const icu = departmentTrainingRows(records, today, ['μεθ'])
    expect(icu.map(row => row.id)).not.toContain('A8')
    expect(icu.length).toBe(6)
    expect(icu[0].id).toBe('A4')
    expect(icu.find(row => row.id === 'A2')!.result).toBe('score')
  })

  it('the status choice and its counts', () => {
    const rows = departmentTrainingRows(records, today, ['μεθ'])
    expect(trainingStatusCounts(rows)).toEqual({ open: 3, completed: 3, all: 6 })
    expect(filterTrainingRows(rows, 'open').every(row => row.status !== 'completed')).toBe(true)
    expect(filterTrainingRows(rows, 'completed').length).toBe(3)
    expect(filterTrainingRows(rows, 'all').length).toBe(6)
  })

  it('the four figures: to complete (the next deadline), overdue, completed in the last year, certificates', () => {
    const own = ownTrainingRows(records, me, today)
    expect(trainingTiles(own, today, { records, own: me })).toEqual({ open: 2, nextDue: '2026-12-10', overdue: 1, completedYear: 1, certificates: { count: 2, expired: 1 } })
    const department = departmentTrainingRows(records, today, ['μεθ'])
    // The department: the latest certificate of each person and programme (the renewed one replaced the expired).
    expect(trainingTiles(department, today)).toEqual({ open: 3, nextDue: '2026-11-25', overdue: 1, completedYear: 1, certificates: { count: 1, expired: 0 } })
  })

  it('a certificate: expired, expiring within 90 days, valid, none', () => {
    expect(certificateState({ validUntil: '2026-11-19' }, today)).toBe('expired')
    expect(certificateState({ validUntil: '2027-02-18' }, today)).toBe('expiring')
    expect(certificateState({ validUntil: '2027-02-19' }, today)).toBe('valid')
    expect(certificateState({ validUntil: null }, today)).toBe('valid')
    expect(certificateState(null, today)).toBe('none')
  })

  it('the page: the departments that do not manage training get the new view, with the shared switch and pages', () => {
    const page = readSource('src/features/training/TrainingProductionPage.tsx')
    const view = readSource('src/features/training/TrainingMyView.tsx')
    expect(page).toContain('if(!canManage)return <TrainingMyView')
    expect(view).toContain("useState<TrainingMyScope>(managerView?'department':'mine')")
    expect(view).toContain('<SegmentedControl')
    expect(view).toContain('<RegistryPagination')
    expect(view).toContain('useCalendarScope()')
  })
})

describe('«Όλο το νοσοκομείο»: the hospital’s programmes', () => {
  const hospital = {
    ...records,
    programs: [
      { ...program('P1', 'Χρήση απινιδωτή'), trainer: 'Δρ. Ρήγας', audience: 'Κλινικό προσωπικό', startDate: '2026-09-01', dueDate: '2026-12-10' },
      { ...program('P2', 'Υγιεινή χεριών'), owner: 'Ομάδα IPC', audience: 'ΜΕΘ', startDate: '2026-10-01', dueDate: '2026-11-30' },
      { ...program('P3', 'Αιχμηρά', 'completed'), dueDate: '2026-06-30' },
      { ...program('P4', 'Ακυρωμένο', 'cancelled') },
      { ...program('P5', 'Μέτρα απομόνωσης', 'planned'), startDate: '2027-01-15', dueDate: '2027-02-15', audience: 'Παθολογική' },
      { ...program('P6', 'Παλιό σεμινάριο', 'completed'), dueDate: '2025-05-10' },
    ],
  } as unknown as TrainingState
  const rows = hospitalProgramRows(hospital, me, today)

  it('one line per programme, the cancelled left out, no participant’s name', () => {
    expect(rows.map(row => row.id)).toEqual(['P2', 'P1', 'P5', 'P3', 'P6'])
    expect(rows.map(row => row.state)).toEqual(['in_progress', 'in_progress', 'planned', 'completed', 'completed'])
    expect(rows.find(row => row.id === 'P2')!.trainer).toBe('Ομάδα IPC')
    expect(JSON.stringify(rows.map(row => [row.title, row.trainer, row.audience]))).not.toContain('Συνάδελφος')
  })

  it('«Συμμετέχω» with the user’s own latest assignment, and the same button as «Οι δικές μου»', () => {
    expect(rows.filter(row => row.own).map(row => [row.id, row.own!.id])).toEqual([['P2', 'A4'], ['P1', 'A3'], ['P3', 'A5']])
    expect(rows.find(row => row.id === 'P5')!.own).toBeNull()
    expect(trainingRowAction(rows.find(row => row.id === 'P1')!.own!, true)).toBe('start')
    expect(trainingRowAction(rows.find(row => row.id === 'P3')!.own!, true)).toBe('certificate')
  })

  it('an active programme that has not started yet counts as planned', () => {
    expect(programState({ status: 'active', startDate: '2026-11-27' }, today)).toBe('planned')
    expect(programState({ status: 'active', startDate: '2026-11-20' }, today)).toBe('in_progress')
    expect(programState({ status: 'active', startDate: '' }, today)).toBe('in_progress')
    expect(programState({ status: 'completed', startDate: '2027-01-01' }, today)).toBe('completed')
  })

  it('«Τρέχοντα | Προγραμματισμένα | Όλα» and the search', () => {
    expect(programStatusCounts(rows)).toEqual({ current: 2, planned: 1, all: 5 })
    expect(filterProgramRows(rows, 'current').map(row => row.id)).toEqual(['P2', 'P1'])
    expect(filterProgramRows(rows, 'planned').map(row => row.id)).toEqual(['P5'])
    expect(filterProgramRows(rows, 'all', 'ρηγας').map(row => row.id)).toEqual(['P1'])
    expect(filterProgramRows(rows, 'all', 'παθολογικη').map(row => row.id)).toEqual(['P5'])
    expect(filterProgramRows(rows, 'all', 'λοιμωξεων', row => [row.program.category === 'ipc' ? 'Πρόληψη & Έλεγχος Λοιμώξεων' : '']).length).toBe(5)
    expect(filterProgramRows(rows, 'current', 'απομονωση')).toEqual([])
  })

  it('the four figures: in progress, planned (the next start), completed this year, «Συμμετέχω σε»', () => {
    expect(hospitalProgramTiles(rows, today)).toEqual({ current: 2, planned: 1, nextStart: '2027-01-15', completedYear: 1, own: 3, ownOpen: 2 })
    expect(hospitalProgramTiles([], today)).toEqual({ current: 0, planned: 0, nextStart: '', completedYear: 0, own: 0, ownOpen: 0 })
  })

  it('the screen: a third choice, its own filter, no opening of the manager’s record', () => {
    const view = readSource('src/features/training/TrainingMyView.tsx')
    expect(view).toContain("{value:'hospital',label:tr('Όλο το νοσοκομείο','Whole hospital')}")
    expect(view).toContain("tr('Όλο το προσωπικό','All staff')")
    expect(view).toContain("hospitalProgramRows(state,scope,today)")
    expect(view).toContain("tr('Τρέχοντα','Current')")
    expect(view).not.toContain('navigate(`/training/')
  })
})
