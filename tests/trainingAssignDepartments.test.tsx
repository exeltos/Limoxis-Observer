// @vitest-environment jsdom
// «Ανάθεση σε τμήματα» (owner, 21/11/2026): the plan (who is added, nobody twice, inactive left out), the Demo service
// (assignments and followed departments, newcomers added later), the dialog (counts, confirmation, apply), its wiring
// in the programme record, the migration (20261231609000) read as text and the two roles that now manage training.
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest'
import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { readSource } from './helpers/readSource'
import type { TrainingAssignment, TrainingEmployee } from '../src/features/training/trainingTypes'

vi.mock('../src/core/supabase/client',()=>({supabase:null}))

const { configureDataEnvironment }=await import('../src/core/data/dataEnvironment')
const { LanguageProvider }=await import('../src/core/i18n/LanguageContext')
const { departmentAssignmentPlan,departmentAssignmentMessage,departmentTargetsText,planPreview }=await import('../src/features/training/trainingDepartmentAssign')
const { assignDepartmentsAsync,loadDepartmentTargetsAsync,stopDepartmentTargetsAsync,syncDemoDepartmentTargets }=await import('../src/features/training/trainingDepartmentAssignService')
const { loadTrainingState,saveTrainingState,trainingDemoState }=await import('../src/features/training/trainingData')
const { TrainingAssignDepartmentsDialog }=await import('../src/features/training/TrainingAssignDepartmentsDialog')
const { ROLES,can,CAPABILITIES }=await import('../src/core/permissions/roles')

const departments=[{id:'ΜΕΘ',name:'ΜΕΘ',nameEn:'ICU'},{id:'ΤΕΠ',name:'ΤΕΠ',nameEn:'ED'},{id:'Παθολογική',name:'Παθολογική',nameEn:'Internal Medicine'}]
const person=(id: string,department: string,status='active'): TrainingEmployee=>({id,employeeCode:id,firstName:id,lastName:'Τ.',department,employmentStatus:status})
const employees=[person('E1','ΜΕΘ'),person('E2','ΜΕΘ'),person('E3','ΜΕΘ','inactive'),person('E4','ΤΕΠ'),person('E5','Παθολογική'),person('E6','ΤΕΠ','leave')]
const assigned=(employeeId: string,status='assigned')=>({id:`A-${employeeId}`,programId:'TRN-1',employeeId,status}) as TrainingAssignment

describe('the plan',()=>{
 it('adds the active employees of the chosen departments, nobody twice, the inactive left out',()=>{
  const plan=departmentAssignmentPlan({employees,assignments:[assigned('E1')],programId:'TRN-1',departments,selection:{all:false,departmentIds:['ΜΕΘ','ΤΕΠ']}})
  expect(plan.employees.map(e=>e.id)).toEqual(['E1','E2','E4'])
  expect(plan.toAdd.map(e=>e.id)).toEqual(['E2','E4'])
  expect(planPreview(plan)).toEqual({employees:3,already:1,toAdd:2})
 })
 it('the whole hospital: every active employee; a cancelled assignment does not count as participating',()=>{
  const plan=departmentAssignmentPlan({employees,assignments:[assigned('E1','cancelled'),{...assigned('E5'),programId:'OTHER'}],programId:'TRN-1',departments,selection:{all:true,departmentIds:[]}})
  expect(plan.toAdd.map(e=>e.id)).toEqual(['E1','E2','E4','E5'])
  expect(plan.already).toBe(0)
 })
 it('matches a hospital employee by department id and by database id',()=>{
  const hospital=[{id:'C1',dbId:'u1',employeeCode:'C1',departmentId:'d1',department:'Άλλο όνομα',employmentStatus:'active'},{id:'C2',dbId:'u2',employeeCode:'C2',departmentId:'d2',employmentStatus:'active'}]
  const plan=departmentAssignmentPlan({employees:hospital,assignments:[{id:'A',programId:'P',employeeId:'',employeeDbId:'u1',status:'assigned'} as TrainingAssignment],programId:'P',departments:[{id:'d1',name:'ΜΕΘ'}],selection:{all:false,departmentIds:['d1']}})
  expect(plan.employees.map(e=>e.id)).toEqual(['C1'])
  expect(plan.toAdd).toEqual([])
 })
 it('says how many and from where, in Greek and English',()=>{
  expect(departmentAssignmentMessage(12,{all:false,departmentIds:['ΜΕΘ','ΤΕΠ']},departments,false)).toBe('Θα προστεθούν 12 εργαζόμενοι από ΜΕΘ, ΤΕΠ')
  expect(departmentAssignmentMessage(12,{all:false,departmentIds:['ΜΕΘ','ΤΕΠ']},departments,true)).toBe('12 employees from ICU, ED will be added')
  expect(departmentAssignmentMessage(1,{all:true,departmentIds:[]},departments,false)).toBe('Θα προστεθεί 1 εργαζόμενος από όλο το νοσοκομείο')
  expect(departmentTargetsText([{id:'t1',departmentId:'ΜΕΘ',active:true},{id:'t2',departmentId:'ΤΕΠ',active:true},{id:'t3',departmentId:'Παθολογική',active:false}],departments,false)).toBe('Ανατέθηκε σε: ΜΕΘ, ΤΕΠ · και οι νέοι εργαζόμενοι')
  expect(departmentTargetsText([{id:'t',departmentId:null,active:true}],departments,true)).toBe('Assigned to: Whole hospital · and new employees')
  expect(departmentTargetsText([],departments,false)).toBe('')
 })
})

describe('the Demo service',()=>{
 beforeEach(()=>{configureDataEnvironment({mode:'demo',organizationId:'demo-hospital'});saveTrainingState(structuredClone(trainingDemoState))})
 const program=()=>{const p=loadTrainingState().programs.find(x=>x.status!=='completed'&&x.status!=='cancelled')!;return p}
 it('assigns, follows the departments, adds only newcomers later and stops',async()=>{
  const p=program(),before=loadTrainingState().assignments.length
  const {result,state}=await assignDepartmentsAsync('demo-hospital',p,{all:false,departmentIds:['ΜΕΘ'],followNew:true},{employees,departments})
  expect(result).toMatchObject({employees:2,added:2,following:1})
  expect(state.assignments.length).toBe(before+2)
  expect(state.assignments.filter(a=>a.programId===p.id&&['E1','E2'].includes(String(a.employeeId))).every(a=>a.status==='assigned'&&a.dueDate===p.dueDate)).toBe(true)
  // Again: nobody twice.
  expect((await assignDepartmentsAsync('demo-hospital',p,{all:false,departmentIds:['ΜΕΘ'],followNew:false},{employees,departments})).result).toMatchObject({added:0,already:2})
  const targets=await loadDepartmentTargetsAsync('demo-hospital',p)
  expect(targets.map(t=>t.departmentId)).toEqual(['ΜΕΘ'])
  // A removed participant is not added back; a newcomer of the department is.
  saveTrainingState({...loadTrainingState(),assignments:loadTrainingState().assignments.filter(a=>!(a.programId===p.id&&a.employeeId==='E2'))})
  expect(syncDemoDepartmentTargets(employees,departments)).toBeNull()
  const next=syncDemoDepartmentTargets([...employees,person('E9','ΜΕΘ'),person('E10','ΤΕΠ')],departments)
  expect(next?.assignments.filter(a=>a.programId===p.id&&['E9','E10','E2'].includes(String(a.employeeId))).map(a=>a.employeeId)).toEqual(['E9'])
  await stopDepartmentTargetsAsync('demo-hospital',targets)
  expect(await loadDepartmentTargetsAsync('demo-hospital',p)).toEqual([])
  expect(syncDemoDepartmentTargets([...employees,person('E11','ΜΕΘ')],departments)).toBeNull()
 })
 it('refuses a completed or cancelled programme',async()=>{
  await expect(assignDepartmentsAsync('demo-hospital',{...program(),status:'cancelled'},{all:true,departmentIds:[],followNew:false},{employees,departments})).rejects.toThrow('TRAINING_PROGRAM_LOCKED')
 })
})

describe('the dialog',()=>{
 afterEach(()=>cleanup())
 it('counts the choice, confirms «Θα προστεθούν N εργαζόμενοι από …» and applies',async()=>{
  const preview=vi.fn<(selection: unknown)=>Promise<{employees: number,already: number,toAdd: number}>>(async()=>({employees:3,already:1,toAdd:2})),onApply=vi.fn<(selection: unknown)=>Promise<undefined>>(async()=>undefined),confirm=vi.fn<(options: {title?: unknown,message?: unknown})=>Promise<boolean>>(async()=>true)
  render(<LanguageProvider><TrainingAssignDepartmentsDialog en={false} departments={departments} preview={preview} onApply={onApply} onClose={vi.fn()} confirm={confirm}/></LanguageProvider>)
  expect(screen.getByText('Επιλέξτε τμήματα ή όλο το νοσοκομείο.')).toBeInTheDocument()
  expect(screen.getByRole('button',{name:'Ανάθεση'})).toBeDisabled()
  fireEvent.click(screen.getByLabelText('Όλο το νοσοκομείο'))
  await waitFor(()=>expect(screen.getByText('Θα προστεθούν: 2 · συμμετέχουν ήδη: 1')).toBeInTheDocument())
  expect(preview).toHaveBeenCalledWith({all:true,departmentIds:[],followNew:false})
  fireEvent.click(screen.getByLabelText(/^Και όσοι προστεθούν αργότερα στα τμήματα/))
  fireEvent.click(screen.getByRole('button',{name:'Ανάθεση'}))
  await waitFor(()=>expect(onApply).toHaveBeenCalledWith({all:true,departmentIds:[],followNew:true}))
  expect(confirm.mock.calls[0][0]).toMatchObject({title:'Ανάθεση σε τμήματα',message:'Θα προστεθούν 2 εργαζόμενοι από όλο το νοσοκομείο. Όσοι προστεθούν αργότερα στα τμήματα θα προστίθενται αυτόματα.'})
 })
 it('does nothing when the confirmation is declined',async()=>{
  const onApply=vi.fn(async()=>undefined)
  render(<LanguageProvider><TrainingAssignDepartmentsDialog en={false} departments={departments} preview={async()=>({employees:1,already:0,toAdd:1})} onApply={onApply} onClose={vi.fn()} confirm={async()=>false}/></LanguageProvider>)
  fireEvent.click(screen.getByLabelText('Όλο το νοσοκομείο'))
  await waitFor(()=>expect(screen.getByRole('button',{name:'Ανάθεση'})).toBeEnabled())
  fireEvent.click(screen.getByRole('button',{name:'Ανάθεση'}))
  await new Promise(resolve=>setTimeout(resolve,0))
  expect(onApply).not.toHaveBeenCalled()
 })
})

describe('the programme record',()=>{
 const page=readSource('src/features/training/TrainingProductionPage.tsx')
 it('offers «Ανάθεση σε τμήματα» in the participants of an open programme, with the followed departments and a stop',()=>{
  expect(page).toContain("onAssignDepartments={programOpen?()=>setDialog({type:'departments'}):undefined}")
  expect(page).toContain("<TrainingAssignDepartmentsDialog en={en} departments={departments} preview={previewAssign} onApply={assignToDepartments}")
  expect(page).toContain("targetsText={departmentTargetsText(targets,departments,en)} onStopTargets={programOpen?stopTargets:undefined}")
  expect(page).toContain("{en?'Assign to departments':'Ανάθεση σε τμήματα'}")
  expect(page).toContain("{en?'Stop adding automatically':'Διακοπή αυτόματης προσθήκης'}")
  expect(page).toContain('syncDemoDepartmentTargets(employees,departments)')
 })
 it('reaches the server only through the RPCs in a hospital',()=>{
  const service=readSource('src/features/training/trainingDepartmentAssignService.ts')
  for(const rpc of ["rpc('training_assign_departments_preview'","rpc('training_assign_departments'","rpc('training_stop_department_target'"])expect(service).toContain(rpc)
  expect(service).not.toMatch(/from\('training_program_department_targets'\)\.(insert|update|upsert|delete)/)
 })
})

describe('the migration',()=>{
 const sql=readSource('supabase/migrations/20261231609000_training_assign_departments.sql')
 const code=sql.replace(/--[^\n]*/g,'')
 const between=(from: string,to: string)=>{const start=sql.indexOf(from);return sql.slice(start,sql.indexOf(to,start))}
 const guard=between('create or replace function private.training_manage_guard','-- Βοηθητικές')
 const assign=between('create or replace function private.training_assign_departments(','create or replace function public.training_assign_departments(')
 const trigger=between('create or replace function private.training_follow_department_targets','create or replace trigger')
 it('changes nothing it may not: no drop, revoke, delete or alter policy',()=>{
  expect(code).not.toMatch(/\bdrop\b|\brevoke\b|\bdelete\s+from\b|\balter\s+policy\b/i)
 })
 it('the guard checks the caller, the temporary password, the membership, the module and manage_training',()=>{
  expect(guard).toContain('security definer')
  expect(guard).toContain("set search_path to ''")
  for(const part of ['auth.uid() is null','private.password_change_pending()',"om.status = 'active'","'training' = any (coalesce(private.org_disabled_modules(p_organization_id)","public.current_user_has_capability(p_organization_id, 'manage_training')"])expect(guard).toContain(part)
 })
 it('every RPC is a private SECURITY DEFINER behind a public SECURITY INVOKER granted to authenticated',()=>{
  for(const [name,args] of [['training_assign_departments','uuid, text, uuid[], boolean, boolean'],['training_assign_departments_preview','uuid, text, uuid[], boolean'],['training_stop_department_target','uuid, uuid']]){
   const body=between(`create or replace function private.${name}(`,`create or replace function public.${name}(`)
   expect(body).toContain('security definer')
   expect(body).toContain("set search_path to ''")
   expect(body).toContain('perform private.training_manage_guard(p_organization_id)')
   const wrapper=sql.slice(sql.indexOf(`create or replace function public.${name}(`))
   expect(wrapper.slice(0,600)).toContain('security invoker')
   expect(sql).toContain(`grant execute on function public.${name}(${args}) to authenticated;`)
  }
 })
 it('assigns like the department participants: the same columns, the programme due date, today in Athens, a unique key',()=>{
  const add=between('create or replace function private.training_add_program_employees','-- 5.')
  for(const part of ['employee_id, employee_code, employee_name, department_name','department_id, employee_user_id, email, account_linked, manual_entry, assigned_date, due_date, status',"'TRA-G-' || replace(gen_random_uuid()::text, '-', '')","(now() at time zone 'Europe/Athens')::date","coalesce(e.employment_status, 'active') = 'active'",'not private.training_employee_participates(p_program_id, e.id)'])expect(add).toContain(part)
  expect(assign).toContain("if v_program.status in ('completed', 'cancelled') then")
  expect(assign).toContain('private.training_checked_departments(p_organization_id, p_department_ids)')
 })
 it('the targets table: one per programme and department, read-only for training viewers, the module gate',()=>{
  expect(sql).toContain('create table if not exists public.training_program_department_targets (')
  expect(sql).toContain('foreign key (program_id, organization_id) references public.training_programs(id, organization_id) on delete cascade')
  expect(sql).toContain("on public.training_program_department_targets (program_id, coalesce(department_id, '00000000-0000-0000-0000-000000000000'::uuid))")
  expect(sql).toContain("private.fast_orgs_capability('view_training')")
  expect(sql).toContain('training_program_department_targets_module_gate')
  expect(code).not.toMatch(/create policy \w+ on public\.training_program_department_targets for (insert|update|delete|all)/)
  expect(sql).toContain('grant select on public.training_program_department_targets to authenticated;')
 })
 it('the trigger on employees: definer, empty search path, stands aside for the bin, active employees, open programmes',()=>{
  expect(trigger).toContain('security definer')
  expect(trigger).toContain("set search_path to ''")
  expect(trigger).toContain("if current_setting('limoxis.bin', true) = 'on' then return new; end if;")
  expect(trigger).toContain("if coalesce(new.employment_status, 'active') <> 'active' then return new; end if;")
  expect(trigger).toContain("p.status not in ('completed', 'cancelled')")
  expect(trigger).toContain('(t.department_id is null or t.department_id = new.department_id)')
  expect(sql).toMatch(/create or replace trigger trg_employees_training_department_targets\s+after insert or update of department_id, employment_status on public\.employees\s+for each row\s+when \(current_setting\('limoxis\.bin', true\) is distinct from 'on'\)/)
 })
 it('gives manage_training to the Infection Control Member and the Quality Manager',()=>{
  expect(sql).toContain("when 'manage_training' then om.role in ('hospital_admin','infection_control_lead','infection_control_member','quality_manager')")
  expect(sql).toMatch(/when 'view_training' then om\.role in \([^)]*'quality_manager'\)/)
  expect(sql).toContain('not private.password_change_pending()')
 })
})

describe('the roles',()=>{
 it('the Infection Control Member and the Quality Manager manage training in the app as in the database',()=>{
  for(const role of [ROLES.INFECTION_CONTROL_MEMBER,ROLES.QUALITY_MANAGER]){
   expect(can(role,CAPABILITIES.MANAGE_TRAINING)).toBe(true)
   expect(can(role,CAPABILITIES.VIEW_TRAINING)).toBe(true)
  }
  expect(can(ROLES.DEPARTMENT_MANAGER,CAPABILITIES.MANAGE_TRAINING)).toBe(false)
 })
})
