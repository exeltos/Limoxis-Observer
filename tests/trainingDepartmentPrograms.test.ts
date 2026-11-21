// «Εκπαίδευση τμήματος» and the programme's read-only page (owner, 21/11/2026): the model, the Demo's service, the
// screens' wiring and the migration (supabase/migrations/20261231608000_training_department_programs.sql) read as text.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readSource } from './helpers/readSource'
import { configureDataEnvironment } from '../src/core/data/dataEnvironment'
import { canCreateDepartmentTraining, canManageDepartmentProgram, departmentEmployees, departmentParticipants, departmentTrainingDraft, departmentTrainingIsValid, findOwnDepartment, ownDepartmentKeys, programInDepartment, trainingProgramPageMode } from '../src/features/training/trainingDepartmentPrograms'
import { cancelDepartmentTrainingAsync, saveDepartmentTrainingAsync, setDepartmentTrainingParticipantsAsync } from '../src/features/training/trainingDepartmentService'
import { programFromRow, PROGRAM_SELECT, PROGRAM_DETAIL_SELECT } from '../src/features/training/trainingMappers'
import type { TrainingState } from '../src/features/training/trainingData'
import type { TrainingEmployee, TrainingProgram } from '../src/features/training/trainingTypes'

const icu = { id: 'D-ICU', name: 'ΜΕΘ', nameEn: 'ICU' }
const medicine = { id: 'D-MED', name: 'Παθολογική', nameEn: 'Internal Medicine' }
const today = '2026-11-21'
const deptProgram = (extra: Partial<TrainingProgram> = {}) => ({ id: 'TRN-D-1', title: 'Αναρρόφηση', owner: 'ΜΕΘ', status: 'active', departmentManaged: true, organizerDepartmentId: 'D-ICU', ...extra }) as TrainingProgram

describe('the programme’s page: editor, read-only or the list', () => {
  it('opens the editor for those who manage training and a read-only page for everyone else', () => {
    expect(trainingProgramPageMode({ canManage: true, found: true })).toBe('editor')
    expect(trainingProgramPageMode({ canManage: false, found: true })).toBe('readonly')
    expect(trainingProgramPageMode({ canManage: false, found: false })).toBe('list')
    expect(trainingProgramPageMode({ canManage: true, found: false })).toBe('list')
  })

  it('the page: the manager keeps ProgramRecord, the others get TrainingProgramView; «Πίσω» keeps the list’s choice', () => {
    const page = readSource('src/features/training/TrainingProductionPage.tsx')
    expect(page).toContain('if(selected&&canManage)return <ProgramRecord')
    expect(page).toContain("if(selected&&trainingProgramPageMode({canManage,found:true})==='readonly')return <TrainingProgramView program={selected}")
    expect(page).toContain("navigate('/training',{state:location.state?.trainingMyView?{trainingMyView:location.state.trainingMyView}:undefined})")
    expect(page.indexOf('<TrainingProgramView')).toBeLessThan(page.indexOf('if(!canManage)return <TrainingMyView'))
    const view = readSource('src/features/training/TrainingProgramView.tsx')
    // No edit for the others: the menu only for the Department Manager of his own department training.
    expect(view).toContain('const manages=canManageDepartmentProgram(role,program,ownDepartment)')
    expect(view).toContain('const menu=manages?<OverflowMenu')
    expect(view).toContain('useTrainingOwnActions({state,language,isDemo,organizationId,setRequests})')
    expect(view).toContain('isDemo?participationFromAssignments(state):(participation||[])')
    expect(view).toContain("loadAttachments(organizationId,'training_program',program.dbId)")
  })
})

describe('who manages a department training', () => {
  it('only the Department Manager creates one, for a department of his own', () => {
    expect(canCreateDepartmentTraining('department_manager', false, icu)).toBe(true)
    expect(canCreateDepartmentTraining('department_manager', false, null)).toBe(false)
    expect(canCreateDepartmentTraining('department_manager', true, icu)).toBe(false)
    expect(canCreateDepartmentTraining('department_user', false, icu)).toBe(false)
    expect(canCreateDepartmentTraining('division_director', false, icu)).toBe(false)
  })

  it('edits only a department training of his own department, while it is open', () => {
    expect(canManageDepartmentProgram('department_manager', deptProgram(), icu)).toBe(true)
    expect(canManageDepartmentProgram('department_manager', deptProgram(), medicine)).toBe(false)
    expect(canManageDepartmentProgram('department_manager', deptProgram({ departmentManaged: false }), icu)).toBe(false)
    expect(canManageDepartmentProgram('department_manager', deptProgram({ status: 'completed' }), icu)).toBe(false)
    expect(canManageDepartmentProgram('department_manager', deptProgram({ status: 'cancelled' }), icu)).toBe(false)
    expect(canManageDepartmentProgram('department_user', deptProgram(), icu)).toBe(false)
    // The Demo's departments carry their name as id: the organiser's name matches too.
    expect(programInDepartment({ organizerDepartmentId: null, owner: 'μεθ' }, icu)).toBe(true)
    expect(programInDepartment({ organizerDepartmentId: 'D-ICU', owner: '' }, icu)).toBe(true)
    expect(programInDepartment({ organizerDepartmentId: 'D-MED', owner: 'Παθολογική' }, icu)).toBe(false)
  })

  it('the form starts as «Ενδοτμηματική» of the department, without a knowledge test', () => {
    const draft = departmentTrainingDraft(icu)
    expect(draft).toMatchObject({ deliveryKind: 'intra_department', owner: 'ΜΕΘ', audience: 'ΜΕΘ', requiresAssessment: false })
    expect(departmentTrainingDraft(icu, 'en').audience).toBe('ICU')
    expect(departmentTrainingIsValid(draft)).toBe(false)
    expect(departmentTrainingIsValid({ ...draft, title: 'Τ', trainer: 'Χ', dueDate: '2026-12-01' })).toBe(true)
    expect(departmentTrainingIsValid({ ...draft, title: 'Τ', trainer: 'Χ', startDate: '2026-12-05', dueDate: '2026-12-01' })).toBe(false)
  })

  it('the participants: only the department’s active staff', () => {
    const staff = [
      { id: 'E1', department: 'ΜΕΘ', employmentStatus: 'active' },
      { id: 'E2', departmentId: 'D-ICU', department: 'Άλλο όνομα' },
      { id: 'E3', department: 'ΜΕΘ', employmentStatus: 'inactive' },
      { id: 'E4', department: 'Παθολογική' },
    ] as TrainingEmployee[]
    expect(departmentEmployees(staff, icu).map(e => e.id)).toEqual(['E1', 'E2'])
    expect(departmentEmployees(staff, null)).toEqual([])
  })

  it('the department’s people in a programme: who has not completed first, the cancelled left out', () => {
    const records = { assignments: [
      { id: 'A1', programId: 'P', employeeName: 'Βήτα', department: 'ΜΕΘ', status: 'completed', dueDate: '2026-11-01' },
      { id: 'A2', programId: 'P', employeeName: 'Άλφα', department: 'ΜΕΘ', status: 'assigned', dueDate: '2026-12-01' },
      { id: 'A3', programId: 'P', employeeName: 'Γάμμα', department: 'ΜΕΘ', status: 'cancelled', dueDate: '2026-12-01' },
      { id: 'A4', programId: 'P', employeeName: 'Δέλτα', department: 'Παθολογική', status: 'assigned', dueDate: '2026-12-01' },
      { id: 'A5', programId: 'P', employeeName: 'Έψιλον', departmentId: 'D-ICU', department: '', status: 'in_progress', dueDate: '2026-11-25' },
    ] } as unknown as TrainingState
    const people = departmentParticipants(records, 'P', icu, today)
    expect(people.map(p => [p.id, p.status, p.started])).toEqual([['A5', 'in_progress', true], ['A2', 'assigned', false], ['A1', 'completed', true]])
  })

  it('finds the user’s own department by id or by name', () => {
    const keys = ownDepartmentKeys({ all: false, departments: ['μεθ'] }, null)
    expect(findOwnDepartment([medicine, icu], keys)).toEqual(icu)
    expect(findOwnDepartment([medicine, icu], ownDepartmentKeys({ all: true, departments: [] }, { departmentIds: ['D-MED'] }))).toEqual(medicine)
    expect(findOwnDepartment([medicine], keys)).toBeNull()
  })
})

describe('the Demo keeps department trainings in its sample data', () => {
  beforeAll(() => configureDataEnvironment({ mode: 'demo', demoAccountId: 'department-training-test' }))
  afterAll(() => configureDataEnvironment({ mode: 'production' }))

  it('creates, edits, sets the participants of and cancels a department training', async () => {
    const draft = { ...departmentTrainingDraft(icu), title: 'Αναρρόφηση τραχειοστομίας', trainer: 'Προϊσταμένη ΜΕΘ', startDate: '2026-12-01', dueDate: '2026-12-10', deliveryKind: 'external', owner: 'Άλλο', requiresAssessment: true }
    const { state, key } = await saveDepartmentTrainingAsync(null, draft, icu)
    const created = state.programs.find(p => p.id === key)!
    expect(created).toMatchObject({ deliveryKind: 'intra_department', owner: 'ΜΕΘ', organizerDepartmentId: 'D-ICU', departmentManaged: true, requiresAssessment: false, status: 'planned' })
    const staff = [{ id: 'EMP-001', firstName: 'Μαρία', lastName: 'Π.', department: 'ΜΕΘ' }, { id: 'EMP-009', firstName: 'Ιωάννα', lastName: 'Κ.', department: 'ΜΕΘ' }] as TrainingEmployee[]
    let next = await setDepartmentTrainingParticipantsAsync(null, created, icu, [], staff)
    const mine = next.assignments.filter(a => a.programId === key)
    expect(mine.map(a => [a.employeeId, a.status, a.dueDate])).toEqual([['EMP-001', 'assigned', '2026-12-10'], ['EMP-009', 'assigned', '2026-12-10']])
    // One left out (not started): cancelled; the other kept.
    next = await setDepartmentTrainingParticipantsAsync(null, created, icu, mine.filter(a => a.employeeId === 'EMP-001'), [])
    expect(next.assignments.filter(a => a.programId === key).map(a => [a.employeeId, a.status])).toEqual([['EMP-001', 'assigned'], ['EMP-009', 'cancelled']])
    const edited = await saveDepartmentTrainingAsync(null, { ...created, dueDate: '2026-12-20' }, icu)
    expect(edited.key).toBe(key)
    expect(edited.state.assignments.find(a => a.programId === key && a.employeeId === 'EMP-001')!.dueDate).toBe('2026-12-20')
    const cancelled = await cancelDepartmentTrainingAsync(null, key)
    expect(cancelled.programs.find(p => p.id === key)!.status).toBe('cancelled')
    await expect(saveDepartmentTrainingAsync(null, { ...created, status: 'active' }, icu)).rejects.toThrow('TRAINING_PROGRAM_LOCKED')
  })
})

describe('the screens', () => {
  it('«Νέα εκπαίδευση τμήματος» in the top bar, for the Department Manager only', () => {
    const view = readSource('src/features/training/TrainingMyView.tsx')
    expect(view).toContain('const canCreate=canCreateDepartmentTraining(role,canManageTraining,ownDepartment)')
    expect(view).toContain("{canCreate&&<RecordActions actions={[UI_ACTIONS.CREATE]} resourceCapability={CAPABILITIES.VIEW_TRAINING} actionLabels={{[UI_ACTIONS.CREATE]:tr('Νέα εκπαίδευση τμήματος','New department training')}}")
    // After the save the participants' picker opens on the new programme.
    expect(view).toContain('pickParticipants:true')
    const form = readSource('src/features/training/TrainingProgramForm.tsx')
    expect(form).toContain("{!departmentMode&&<SearchableSelect label={en?'Training type':'Είδος εκπαίδευσης'}")
    expect(form).toContain("{!departmentMode&&<YesNoField label={en?'Knowledge assessment required':'Απαιτείται αξιολόγηση γνώσεων'}")
    const page = readSource('src/features/training/TrainingProgramView.tsx')
    expect(page).toContain('<TrainingParticipantsDialog registryOnly en={en} employees={departmentEmployees(employees,ownDepartment)}')
  })

  it('reads the organising department and its provenance with the programmes', () => {
    expect(PROGRAM_SELECT).toContain('organizer_department_id,created_by_department_manager')
    expect(PROGRAM_DETAIL_SELECT).toContain('organizer_department_id,created_by_department_manager')
    const program = programFromRow({ id: 'u', program_key: 'TRN-D-1', organizer_department_id: 'D-ICU', created_by_department_manager: true })
    expect(program).toMatchObject({ organizerDepartmentId: 'D-ICU', departmentManaged: true })
    expect(programFromRow({ id: 'u', program_key: 'TRN-1' })).not.toHaveProperty('organizerDepartmentId')
  })

  it('writes only through the RPCs in a hospital', () => {
    const service = readSource('src/features/training/trainingDepartmentService.ts')
    expect(service).toContain("rpc('training_department_save_program',{p_organization_id:organizationId,p_program:{...program,organizerDepartmentId:department.id}})")
    expect(service).toContain("rpc('training_department_set_participants',{p_organization_id:organizationId,p_program_key:program.id,p_employee_ids:ids})")
    expect(service).toContain("rpc('training_department_cancel_program',{p_organization_id:organizationId,p_program_key:programKey})")
    expect(service).not.toMatch(/\.from\('training_/)
  })
})

describe('the migration', () => {
  const sql = readSource('supabase/migrations/20261231608000_training_department_programs.sql')
  const code = sql.replace(/--[^\n]*/g, '')
  const between = (from: string, to: string) => code.slice(code.indexOf(from), code.indexOf(to))
  const guard = between('create or replace function private.training_department_guard', 'create or replace function private.training_department_in_scope')
  const save = between('create or replace function private.training_department_save_program', 'create or replace function public.training_department_save_program')
  const participants = between('create or replace function private.training_department_set_participants', 'create or replace function public.training_department_set_participants')
  const cancel = between('create or replace function private.training_department_cancel_program', 'create or replace function public.training_department_cancel_program')

  it('only adds: columns, index, functions, grants and one guarded new policy; no drop, revoke, delete or alter policy', () => {
    expect(code).toContain('add column if not exists organizer_department_id uuid references public.departments(id) on delete set null')
    expect(code).toContain('add column if not exists created_by_department_manager boolean not null default false')
    expect(code).not.toMatch(/\bdrop\b/i)
    expect(code).not.toMatch(/\brevoke\b/i)
    // (the foreign key's «on delete set null» is not a deletion)
    expect(code.replace(/on delete set null/g, '')).not.toMatch(/\bdelete\b/i)
    expect(code).not.toMatch(/alter\s+policy/i)
    expect(code).not.toMatch(/create\s+policy[^;]*\bas\s+permissive\b/i)
    expect(code).toContain("if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'attachments' and policyname = 'attachments_training_program_insert_scope')")
    expect(code).toContain('on public.attachments as restrictive for insert to authenticated')
    expect((code.match(/create policy/g) || []).length).toBe(1)
  })

  it('the guard: signed in, no temporary password, an active Department Manager membership, the module open', () => {
    expect(guard).toContain('security definer')
    expect(guard).toContain("set search_path to ''")
    expect(guard).toContain('if auth.uid() is null then')
    expect(guard).toContain('private.password_change_pending()')
    expect(guard).toContain("om.user_id = auth.uid() and om.organization_id = p_organization_id and om.status = 'active'")
    expect(guard).toContain("om.role = 'department_manager'")
    expect(guard).toContain("'training' = any (coalesce(private.org_disabled_modules(p_organization_id), '{}'::text[]))")
    expect(code).toContain('select 1 from public.organization_member_scopes s')
    expect(code).toContain('where s.membership_id = p_membership_id and s.department_id = p_department_id and d.organization_id = p_organization_id')
  })

  it('every function is a private SECURITY DEFINER behind a public SECURITY INVOKER wrapper for authenticated', () => {
    for (const name of ['training_department_save_program', 'training_department_set_participants', 'training_department_cancel_program']) {
      const privateFn = code.slice(code.indexOf(`create or replace function private.${name}(`))
      expect(privateFn.slice(0, 400)).toContain('security definer')
      expect(privateFn.slice(0, 400)).toContain("set search_path to ''")
      const wrapper = code.slice(code.indexOf(`create or replace function public.${name}(`))
      expect(wrapper.slice(0, 300)).toContain('security invoker')
      expect(wrapper.slice(0, 300)).toContain(`select private.${name}(`)
      expect(code).toMatch(new RegExp(`grant execute on function public\\.${name}\\([^)]*\\) to authenticated;`))
    }
  })

  it('save: the department in the caller’s scopes, forced as organiser, «Ενδοτμηματική», no test, only its own open programmes', () => {
    expect(save).toContain('v_membership := private.training_department_guard(p_organization_id);')
    expect(save).toContain('if not private.training_department_in_scope(v_membership, p_organization_id, v_department) then')
    expect(save).toContain("raise exception 'TRAINING_DEPARTMENT_SCOPE_DENIED'")
    expect(save).toContain("v_department, 'intra_department'")
    expect(save).toContain("delivery_kind = 'intra_department'")
    expect(save).toContain('organizer_department_id = v_department, created_by_department_manager = true')
    expect(save).toContain('requires_assessment = false, pass_score = null')
    expect(save).toContain('if not v_existing.created_by_department_manager or v_existing.organizer_department_id is distinct from v_department then')
    expect(save).toContain("if v_existing.status in ('completed', 'cancelled') then")
    expect(save).not.toContain("'cancelled' then p_program")
  })

  it('participants: only the department’s active employees; the left out and not started are cancelled, never deleted', () => {
    expect(participants).toContain('v_membership := private.training_department_guard(p_organization_id);')
    expect(participants).toContain('private.training_department_in_scope(v_membership, p_organization_id, v_program.organizer_department_id)')
    expect(participants).toContain('and e.department_id = v_program.organizer_department_id')
    expect(participants).toContain("coalesce(e.employment_status, 'active') = 'active'")
    expect(participants).toContain("raise exception 'TRAINING_DEPARTMENT_EMPLOYEE_DENIED'")
    expect(participants).toContain("set status = 'cancelled'")
    expect(participants).toContain("a.status = 'assigned'")
    expect(participants).toContain('and a.department_id = v_program.organizer_department_id')
    expect(participants).toContain('a.feedback_submitted_at is null and a.completion_confirmed_at is null')
  })

  it('cancel: the same checks, then the status only', () => {
    expect(cancel).toContain('v_membership := private.training_department_guard(p_organization_id);')
    expect(cancel).toContain('if not v_program.created_by_department_manager')
    expect(cancel).toContain("set status = 'cancelled'")
  })
})
