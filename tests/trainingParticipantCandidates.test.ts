// «Προσθήκη συμμετεχόντων» (owner, 21/11/2026): whoever manages training sees the staff list through
// training_participant_candidates (20261231611000) without any change to the staff register's policies. The migration
// read as text, the service (Demo and hospital) and its wiring in the programme record.
import { afterEach,describe,expect,it,vi } from 'vitest'
import { readSource } from './helpers/readSource'
import type { TrainingEmployee } from '../src/features/training/trainingTypes'

const rpc=vi.fn()
vi.mock('../src/core/supabase/client',()=>({supabase:{rpc:(...args: unknown[])=>rpc(...args)}}))
vi.mock('../src/core/config/env',async original=>({...(await original<Record<string, unknown>>()),hasSupabaseConfig:true}))

const { configureDataEnvironment }=await import('../src/core/data/dataEnvironment')
const { loadTrainingParticipantCandidatesAsync,participantCandidateFromRow }=await import('../src/features/training/trainingParticipantCandidates')

const sql=readSource('supabase/migrations/20261231611000_training_participant_candidates.sql')
const code=sql.split('\n').filter(line=>!line.trim().startsWith('--')).join('\n')
const row={id:'0b9a1c1e-0000-4000-8000-000000000001',employee_code:'E-17',first_name:'Μαρία',last_name:'Παπά',department_id:'d1',department_name:'ΜΕΘ',email:'m@example.org',profession:'Νοσηλεύτρια',position:'Προϊσταμένη',employment_status:'active',user_id:'u1'}

afterEach(()=>{rpc.mockReset()})

describe('the migration',()=>{
 it('a private SECURITY DEFINER function with the caller checks, including manage_training and the Training module',()=>{
  const privateFn=code.slice(code.indexOf('create or replace function private.training_participant_candidates'),code.indexOf('create or replace function public.training_participant_candidates'))
  expect(privateFn).toMatch(/security definer\s+set search_path to ''/)
  expect(privateFn).toContain('auth.uid() is null')
  expect(privateFn).toContain('private.password_change_pending()')
  expect(privateFn).toMatch(/om\.user_id = auth\.uid\(\) and om\.organization_id = p_organization_id and om\.status = 'active'/)
  expect(privateFn).toContain("'training' = any (coalesce(private.org_disabled_modules(p_organization_id)")
  expect(privateFn).toContain("public.current_user_has_capability(p_organization_id, 'manage_training')")
  expect(privateFn).toContain('where e.organization_id = p_organization_id')
 })
 it('returns only the fields the picker uses',()=>{
  expect(code).toContain('returns table (id uuid, employee_code text, first_name text, last_name text, department_id uuid, department_name text,\n               email text, profession text, "position" text, employment_status text, user_id uuid)')
  for(const column of ['phone','birth_date','father_name','photo_path','hire_date'])expect(code).not.toMatch(new RegExp(`e\\.${column}\\b`))
 })
 it('the public wrapper is SECURITY INVOKER, granted to authenticated only',()=>{
  const publicFn=code.slice(code.indexOf('create or replace function public.training_participant_candidates'))
  expect(publicFn).toMatch(/security invoker\s+set search_path to ''/)
  expect(publicFn).toContain('select * from private.training_participant_candidates(p_organization_id)')
  expect(code).toContain('grant execute on function public.training_participant_candidates(uuid) to authenticated;')
  expect(code).not.toMatch(/\bto (anon|public)\b/i)
 })
 it('no policy on the staff register and nothing the agent may not run',()=>{
  expect(code).not.toMatch(/\bpolicy\b/i)
  expect(code).not.toMatch(/\b(drop|revoke|delete|truncate|alter)\b/i)
  expect(code).not.toMatch(/\b(insert|update)\b/i)
 })
})

describe('the service',()=>{
 it('maps a row to the staff shape the picker and the assignment use',()=>{
  expect(participantCandidateFromRow(row)).toEqual({id:'E-17',dbId:row.id,employeeCode:'E-17',firstName:'Μαρία',lastName:'Παπά',department:'ΜΕΘ',departmentId:'d1',email:'m@example.org',profession:'Νοσηλεύτρια',position:'Προϊσταμένη',employmentStatus:'active',userId:'u1'})
  expect(participantCandidateFromRow({...row,department_id:null,department_name:null,email:null,profession:null,position:null,employment_status:null,user_id:null})).toMatchObject({department:'',departmentId:null,email:'',profession:'',position:'',employmentStatus:'active',userId:null})
 })
 it('in a hospital reads the RPC for the organisation (rows without a code are left out)',async()=>{
  configureDataEnvironment({mode:'production',organizationId:'org-1'})
  rpc.mockResolvedValue({data:[row,{...row,id:'x',employee_code:null}],error:null})
  const list=await loadTrainingParticipantCandidatesAsync('org-1',[{id:'DEMO'} as TrainingEmployee])
  expect(rpc).toHaveBeenCalledWith('training_participant_candidates',{p_organization_id:'org-1'})
  expect(list.map(e=>e.id)).toEqual(['E-17'])
  rpc.mockResolvedValue({data:null,error:new Error('TRAINING_MANAGE_REQUIRED')})
  await expect(loadTrainingParticipantCandidatesAsync('org-1')).rejects.toThrow('TRAINING_MANAGE_REQUIRED')
  await expect(loadTrainingParticipantCandidatesAsync(null)).rejects.toThrow('PRODUCTION_TRAINING_ORGANIZATION_REQUIRED')
 })
 it('in the Demo uses the staff the page holds, never the database',async()=>{
  configureDataEnvironment({mode:'demo',organizationId:'demo-hospital'})
  const staff=[{id:'E1',employeeCode:'E1',firstName:'Α'}] as TrainingEmployee[]
  expect(await loadTrainingParticipantCandidatesAsync('demo-hospital',staff)).toBe(staff)
  expect(rpc).not.toHaveBeenCalled()
 })
})

describe('the programme record',()=>{
 const page=readSource('src/features/training/TrainingProductionPage.tsx')
 it('the picker gets the candidates (active only), with a loading state, and the assignment keeps the account link',()=>{
  expect(page).toContain("import { loadTrainingParticipantCandidatesAsync } from './trainingParticipantCandidates'")
  expect(page).toContain('loadTrainingParticipantCandidatesAsync(organizationId,employees)')
  expect(page).toContain('const activeEmployees=(candidates||[]).filter(isActiveEmployee)')
  expect(page).toContain('if(pickerOpen&&!candidates)return <RouteLoading/>')
  expect(page).toContain('if(pickerOpen)return <TrainingParticipantsDialog en={en} departments={departments} employees={activeEmployees}')
  expect(page).toContain('...(employee.userId?{userId:employee.userId}:{})')
 })
})
