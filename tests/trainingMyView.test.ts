// «Εκπαίδευση» for the departments that do not manage training (owner, 20/11/2026): «Οι δικές μου» is one line per
// programme of the user (the latest assignment, how many times); «Του τμήματός μου» and «Όλο το νοσοκομείο» list
// programmes, never employees; four figures; a certificate expired, expiring within 90 days or valid.
import { describe, expect, it } from 'vitest'
import { readSource } from './helpers/readSource'
import { canSeeDepartmentNames, certificateState, departmentPendingPeople, filterProgramRows, filterTrainingRows, hospitalProgramRows, ownTrainingRows, participationFromAssignments, programConcernsDepartment, programParticipation, programState, programStatusCounts, programTiles, trainingMeState, trainingRowAction, trainingStatusCounts, trainingTiles, type TrainingParticipationRequest } from '../src/features/training/trainingMyView'
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

  it('the status choice and its counts', () => {
    const rows = ownTrainingRows(records, me, today)
    expect(trainingStatusCounts(rows)).toEqual({ open: 2, completed: 1, all: 3 })
    expect(filterTrainingRows(rows, 'open').every(row => row.status !== 'completed')).toBe(true)
    expect(filterTrainingRows(rows, 'completed').map(row => row.id)).toEqual(['A5'])
  })

  it('the four figures of «Οι δικές μου»: to complete (the next deadline), overdue, completed in the last year, certificates', () => {
    const own = ownTrainingRows(records, me, today)
    expect(trainingTiles(own, today, { records, own: me })).toEqual({ open: 2, nextDue: '2026-12-10', overdue: 1, completedYear: 1, certificates: { count: 2, expired: 1 } })
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
    expect(view).toContain("const initialView: TrainingMyScope=scope.all?'hospital':PLAIN_ROLES.has(String(role))&&!managerView?'mine':'department'")
    expect(view).toContain('useState<TrainingMyScope>(memory?.view||initialView)')
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

  it('«Τρέχοντα | Προγραμματισμένα | Ολοκληρωμένα | Όλα», the category and the search', () => {
    expect(programStatusCounts(rows)).toEqual({ current: 2, planned: 1, completed: 2, all: 5 })
    expect(filterProgramRows(rows, 'completed').map(row => row.id)).toEqual(['P3', 'P6'])
    expect(filterProgramRows(rows, 'all', '', () => [], 'ipc').length).toBe(5)
    expect(filterProgramRows(rows, 'all', '', () => [], 'quality')).toEqual([])
    expect(filterProgramRows(rows, 'current').map(row => row.id)).toEqual(['P2', 'P1'])
    expect(filterProgramRows(rows, 'planned').map(row => row.id)).toEqual(['P5'])
    expect(filterProgramRows(rows, 'all', 'ρηγας').map(row => row.id)).toEqual(['P1'])
    expect(filterProgramRows(rows, 'all', 'παθολογικη').map(row => row.id)).toEqual(['P5'])
    expect(filterProgramRows(rows, 'all', 'λοιμωξεων', row => [row.program.category === 'ipc' ? 'Πρόληψη & Έλεγχος Λοιμώξεων' : '']).length).toBe(5)
    expect(filterProgramRows(rows, 'current', 'απομονωση')).toEqual([])
  })

  it('the four figures: in progress, planned (the next start), still to complete, the user’s requests', () => {
    expect(programTiles(rows, today)).toEqual({ current: 2, planned: 1, nextStart: '2027-01-15', pending: 4, requests: 0, rejected: 0 })
    expect(programTiles([], today)).toEqual({ current: 0, planned: 0, nextStart: '', pending: 0, requests: 0, rejected: 0 })
  })

  it('the screen: three choices, the filters in the filters window, a row opens the programme’s page, no employee list', () => {
    const view = readSource('src/features/training/TrainingMyView.tsx')
    expect(view).toContain("{value:'mine',label:tr('Οι δικές μου','Mine')}")
    expect(view).toContain("{value:'department',label:tr('Του τμήματός μου','My department')}")
    expect(view).toContain("{value:'hospital',label:tr('Όλο το νοσοκομείο','Whole hospital')}")
    expect(view).not.toContain("tr('Όλο το προσωπικό','All staff')")
    expect(view).not.toContain("tr('Όλο το τμήμα','Whole department')")
    expect(view).toContain('hospitalProgramRows(state,scope,today,{department,participation:counted,requests})')
    expect(view).toContain("<FilterSelect label={tr('Τμήμα','Department')}")
    expect(view).toContain("<FilterSelect label={tr('Κατάσταση','Status')}")
    expect(view).toContain("<FilterSelect label={tr('Κατηγορία','Category')}")
    expect(view).toContain("tr('Συμμετοχή τμήματος','Department participation')")
    expect(view).toContain("{key:'me',label:tr('Εγώ','Me')}")
    expect(view).not.toContain("label:tr('Εργαζόμενος','Employee')},{key:'title'")
    // A row opens /training/<programKey> (the read-only page, TrainingProgramView) and keeps the list's choice for «Πίσω».
    expect(view).toContain('navigate(`/training/${encodeURIComponent(programId)}`,{state:{trainingMyView:keep}})')
    expect(view).toContain('rowProps={(row: TrainingProgramRow)=>rowOpen(row.id)}')
  })
})

describe('the department’s programmes (owner, 20/11/2026: «δεν θέλω να βλέπω εργαζόμενους αλλά εκπαιδεύσεις»)', () => {
  const icu = { id: 'D-ICU', name: 'ΜΕΘ', nameEn: 'ICU' }
  const medicine = { id: 'D-MED', name: 'Παθολογική', nameEn: 'Internal Medicine' }
  const surgery = { id: 'D-SUR', name: 'Χειρουργική' }
  const hospital = {
    ...records,
    programs: [
      { ...program('P1', 'Χρήση απινιδωτή'), audience: 'Ομάδα αναζωογόνησης', startDate: '2026-09-01', dueDate: '2026-12-10' },
      { ...program('P2', 'Υγιεινή χεριών'), audience: 'Όλο το προσωπικό', startDate: '2026-10-01', dueDate: '2026-11-30' },
      { ...program('P3', 'Αιχμηρά', 'completed'), audience: 'ΜΕΘ', dueDate: '2026-06-30' },
      { ...program('P4', 'Ακυρωμένο', 'cancelled'), audience: 'Χειρουργική' },
      { ...program('P5', 'Μέτρα απομόνωσης', 'planned'), startDate: '2027-01-15', dueDate: '2027-02-15', audience: 'Χειρουργική · Ορθοπαιδική' },
    ],
  } as unknown as TrainingState
  const counts = participationFromAssignments(hospital)

  it('a programme concerns a department by its audience (or the whole hospital) or by an assignment of its people', () => {
    expect(programConcernsDepartment(hospital.programs[0], surgery, counts)).toBe(false)
    expect(programConcernsDepartment(hospital.programs[1], surgery, counts)).toBe(true)
    expect(programConcernsDepartment(hospital.programs[4], surgery, counts)).toBe(true)
    // «Ομάδα αναζωογόνησης» names no department; the ICU has people in it.
    expect(programConcernsDepartment(hospital.programs[0], icu, counts)).toBe(true)
    expect(hospitalProgramRows(hospital, me, today, { department: surgery, participation: counts }).map(row => row.id)).toEqual(['P2', 'P5'])
    expect(hospitalProgramRows(hospital, me, today, { department: medicine, participation: counts }).map(row => row.id)).toEqual(['P2'])
    expect(hospitalProgramRows(hospital, me, today, { participation: counts }).map(row => row.id)).toEqual(['P2', 'P1', 'P5', 'P3'])
  })

  it('«Συμμετοχή τμήματος»: completed of assigned for the department, the hospital’s totals without one, numbers only', () => {
    expect(programParticipation('P1', counts, icu)).toEqual({ assigned: 4, completed: 2 })
    expect(programParticipation('P2', counts, medicine)).toEqual({ assigned: 1, completed: 0 })
    expect(programParticipation('P2', counts)).toEqual({ assigned: 2, completed: 0 })
    expect(programParticipation('P5', counts, icu)).toBeNull()
    // The database’s figures match a department by its id too.
    expect(programParticipation('P1', [{ programId: 'P1', departmentId: 'D-ICU', departmentName: '', assigned: 20, completed: 12 }], icu)).toEqual({ assigned: 20, completed: 12 })
    const rows = hospitalProgramRows(hospital, me, today, { department: icu, participation: counts })
    expect(JSON.stringify(rows.map(row => [row.title, row.trainer, row.audience, row.participation]))).not.toContain('Συνάδελφος')
    // In the running ones: P1 (4 − 2) and P2 (1 − 0).
    expect(programTiles(rows, today).pending).toBe(3)
  })

  const request = (id: string, programId: string, extra: Partial<TrainingParticipationRequest>): TrainingParticipationRequest => ({ id, programId, programTitle: '', requesterUserId: 'u-me', employeeId: null, requesterName: 'Εγώ', department: 'ΜΕΘ', departmentId: null, note: '', status: 'pending', decisionReason: '', decidedAt: '', createdAt: '2026-11-01T10:00:00Z', assignmentId: null, ...extra })
  it('«Εγώ»: the own button, «Ολοκληρώθηκε», a request waiting or rejected, otherwise «Αίτηση συμμετοχής»', () => {
    const requests = [
      request('R1', 'P5', { status: 'rejected', decisionReason: 'Δεν αφορά τη θέση σας', createdAt: '2026-10-01T10:00:00Z' }),
      request('R2', 'P5', { status: 'cancelled', createdAt: '2026-11-10T10:00:00Z' }),
      request('R3', 'P2', { requesterUserId: 'u-other' }),
    ]
    const rows = hospitalProgramRows(hospital, me, today, { participation: counts, requests })
    const state = (id: string) => trainingMeState(rows.find(row => row.id === id)!)
    expect(state('P1')).toBe('action')
    expect(state('P2')).toBe('action')
    expect(state('P3')).toBe('completed')
    expect(state('P5')).toBe('rejected')
    expect(rows.find(row => row.id === 'P5')!.request!.decisionReason).toBe('Δεν αφορά τη θέση σας')
    const other = { userId: 'u-other', employeeId: null }
    const theirs = hospitalProgramRows(hospital, other, today, { participation: counts, requests })
    expect(trainingMeState(theirs.find(row => row.id === 'P2')!)).toBe('pending')
    expect(trainingMeState(theirs.find(row => row.id === 'P5')!)).toBe('request')
    // A completed programme the user did not attend: nothing to ask for.
    expect(trainingMeState(theirs.find(row => row.id === 'P3')!)).toBeNull()
    expect(programTiles(theirs, today, requests, other)).toMatchObject({ requests: 1, rejected: 0 })
    expect(programTiles(rows, today, requests, me)).toMatchObject({ requests: 0, rejected: 1 })
  })

  it('the names: only the Department Manager (and the Division Director), only for a department of their own, only who has not completed', () => {
    expect(canSeeDepartmentNames('department_manager', icu, ['μεθ'])).toBe(true)
    expect(canSeeDepartmentNames('department_manager', icu, ['D-ICU'])).toBe(true)
    expect(canSeeDepartmentNames('division_director', icu, ['μεθ', 'παθολογικη'])).toBe(true)
    expect(canSeeDepartmentNames('department_manager', medicine, ['μεθ'])).toBe(false)
    expect(canSeeDepartmentNames('department_manager', null, ['μεθ'])).toBe(false)
    expect(canSeeDepartmentNames('department_user', icu, ['μεθ'])).toBe(false)
    expect(canSeeDepartmentNames('link_nurse', icu, ['μεθ'])).toBe(false)
    expect(canSeeDepartmentNames('hospital_admin', icu, ['μεθ'])).toBe(false)
    const people = departmentPendingPeople(hospital, 'P1', icu, today)
    expect(people.map(person => [person.id, person.status])).toEqual([['A7', 'assigned'], ['A3', 'assigned']])
    expect(departmentPendingPeople(hospital, 'P1', medicine, today)).toEqual([])
  })

  it('the screen: the requests, the manager’s names, the module’s request list', () => {
    expect(readSource('src/features/training/useTrainingOwnActions.tsx')).toContain('requestTrainingParticipationAsync(organizationId,requesting.program,requestNote)')
    // The names moved to the programme's page (owner, 21/11/2026): only the Department Manager / Division Director of the department.
    const programView = readSource('src/features/training/TrainingProgramView.tsx')
    expect(programView).toContain('const namesAllowed=canSeeDepartmentNames(role,ownDepartment,ownKeys)')
    expect(programView).toContain('departmentParticipants(state,program.id,ownDepartment,today)')
    const page = readSource('src/features/training/TrainingProductionPage.tsx')
    expect(page).toContain("{value:'requests',label:en?'Participation requests':'Αιτήσεις συμμετοχής',icon:Inbox,count:pendingRequests.length||null}")
    expect(page).toContain('<TrainingRequestsPanel requests={requests}')
    const panel = readSource('src/features/training/TrainingRequestsPanel.tsx')
    expect(panel).toContain('<GovernedReasonDialog')
    expect(panel).toContain("onDecide(request,true)")
    const service = readSource('src/features/training/trainingRequestService.ts')
    expect(service).toContain("rpc('training_request_participation',{p_organization_id:organizationId,p_program_key:program.id,p_note:note.trim()||null})")
    expect(service).toContain("rpc('training_decide_participation',{p_request_id:request.id,p_accept:accept,p_reason:reason.trim()||null})")
    expect(service).toContain("rpc('training_program_participation',{p_organization_id:organizationId})")
    // The Demo keeps its requests in the sample state, never in the database.
    expect(service).toContain('if(isDemoDataEnvironment())return demoRequests(loadTrainingState())')
  })
})
