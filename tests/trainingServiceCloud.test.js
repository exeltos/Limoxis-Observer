import { beforeEach,describe,expect,it,vi } from 'vitest'

// The training service against the cloud (mocked PostgREST): reads the
// training_* tables with embeds, sends only what changed, and writes through
// the RPCs.
const tables={}
const calls={select:[],rpc:[]}
function builder(table){
 const state={table,filters:[],range:null}
 const api={
  select(columns){calls.select.push({table,columns});return api},
  eq(column,value){state.filters.push([column,value]);return api},
  in(){return api},
  or(){return api},
  order(){return api},
  range(from,to){state.range=[from,to];return api},
  maybeSingle(){return Promise.resolve({data:(tables[table]||[])[0]||null,error:null})},
  then(resolve,reject){const rows=tables[table]||[];const [from,to]=state.range||[0,rows.length-1];return Promise.resolve({data:rows.slice(from,to+1),error:null}).then(resolve,reject)},
 }
 return api
}
const rpc=vi.fn(async(name,args)=>{calls.rpc.push({name,args});return {data:name==='training_save_program'?'new-uuid':{},error:null}})
vi.mock('../src/core/supabase/client',()=>({supabase:{from:table=>builder(table),rpc:(...args)=>rpc(...args)}}))
vi.mock('../src/core/config/env',()=>({hasSupabaseConfig:true}))

const { configureDataEnvironment }=await import('../src/core/data/dataEnvironment')
const service=await import('../src/features/training/trainingService')

const program={id:'p1',program_key:'TRN-1',title:'Hand hygiene',status:'active',requires_assessment:true,pass_score:80,valid_months:12,start_date:'2026-09-01',due_date:'2026-09-30',feedback_template_key:'TRAINER-FEEDBACK-DEFAULT',feedback_title_el:'Αξιολόγηση',feedback_title_en:'Evaluation',created_at:'2026-08-01T09:00:00+00:00',updated_at:'2026-08-02T09:00:00+00:00',
 training_program_materials:[],training_assessment_questions:[{question_key:'Q1',position:1,question_type:'free_text',text:'Why?',points:4,required:true,correct_boolean:null,model_answer:'Because',manual_review:true,training_assessment_options:[]}],
 training_program_effectiveness:null,training_program_feedback_questions:[{question_key:'clarity',position:1,label_el:'Σαφήνεια',label_en:'Clarity'}]}
const assignment={id:'a1',assignment_key:'TRA-1',program_id:'p1',employee_id:'e1',employee_code:'EMP-001',employee_name:'Μ. Π.',department_name:'ΜΕΘ',department_id:'d1',employee_user_id:null,email:'m@example.org',account_linked:true,manual_entry:false,assigned_date:'2026-09-01',due_date:'2026-09-30',status:'in_progress',invitation_sent_at:'2026-09-01T08:00:00+00:00',access_token:'TRN-ACCESS-1',attendance_response:'confirmed',attendance:true,attendance_confirmed_at:'2026-09-02T08:00:00+00:00',completion_confirmed_at:null,feedback_submitted_at:'2026-09-02T08:05:00+00:00',assessment_submitted_at:'2026-09-02T08:05:00+00:00',assessment_review_status:'pending',assessment_reviewed_at:null,assessment_reviewed_by:null,assessment_review_acknowledged:null,assessment_review_note:null,score:null,competent:null,completed_date:null,created_at:'2026-09-01T08:00:00+00:00',updated_at:'2026-09-02T08:05:00+00:00',
 training_assessment_answers:[{question_key:'Q1',answer_kind:'text',answer_text:'Because it is',answer_boolean:null,answer_number:null,answer_option_keys:null,awarded_points:null}],
 training_feedback_responses:{employee_code:'EMP-001',user_id:null,submitted_at:'2026-09-02T08:05:00+00:00',comment:'Καλό',training_feedback_scores:[{question_key:'clarity',score:5}]},training_certificates:null}

beforeEach(()=>{
 configureDataEnvironment({mode:'production',organizationId:'org-1'})
 Object.assign(tables,{training_programs:[program],training_assignments:[assignment],training_certificates:[],training_requirements:[],training_history_events:[],training_feedback_templates:[{template_key:'TRAINER-FEEDBACK-DEFAULT',title_el:'Αξιολόγηση',title_en:'Evaluation',training_feedback_template_questions:[{question_key:'clarity',position:1,label_el:'Σαφήνεια',label_en:'Clarity'}]}]})
 calls.select.length=0;calls.rpc.length=0;rpc.mockClear()
})

describe('training service on the relational tables',()=>{
 it('loads the state with embeds and keeps the in-app shapes',async()=>{
  const state=await service.loadTrainingStateAsync('org-1')
  expect(calls.select.map(c=>c.table).sort()).toEqual(['training_assignments','training_certificates','training_history_events','training_programs','training_requirements'])
  expect(calls.select.find(c=>c.table==='training_assignments').columns).toContain('training_assessment_answers(')
  expect(state.programs[0]).toMatchObject({id:'TRN-1',dbId:'p1',passScore:80,trainerFeedbackTemplate:{id:'TRAINER-FEEDBACK-DEFAULT',questions:[{id:'clarity',labelEl:'Σαφήνεια',labelEn:'Clarity'}]},feedbackResponses:[{assignmentId:'TRA-1',employeeId:'EMP-001',scores:{clarity:5},comment:'Καλό'}]})
  expect(state.programs[0]).not.toHaveProperty('effectiveness')
  expect(state.assignments[0]).toMatchObject({id:'TRA-1',dbId:'a1',programId:'TRN-1',employeeId:'EMP-001',employeeDbId:'e1',departmentId:'d1',assessmentReviewStatus:'pending',assessmentAnswers:{Q1:'Because it is'},feedbackScores:{clarity:5},feedbackComment:'Καλό',certificateId:null,accessToken:'TRN-ACCESS-1'})
 })

 it('saves only the changed records, in one training_save_state call, without learner fields',async()=>{
  const state=await service.loadTrainingStateAsync('org-1')
  await service.saveManagedTrainingStateAsync('org-1',state)
  expect(calls.rpc).toEqual([])
  const next={...state,programs:state.programs.map(p=>({...p,title:'Renamed'})),assignments:[...state.assignments,{id:'TRA-2',programId:'TRN-1',employeeId:'EMP-002',employeeName:'Ν. Δ.',status:'assigned',attendanceResponse:'not_sent',score:null}]}
  await service.saveManagedTrainingStateAsync('org-1',next)
  expect(calls.rpc).toHaveLength(1)
  const {name,args}=calls.rpc[0]
  expect(name).toBe('training_save_state')
  expect(args.p_organization_id).toBe('org-1')
  expect(args.p_programs.map(p=>p.title)).toEqual(['Renamed'])
  expect(args.p_programs[0]).not.toHaveProperty('feedbackResponses')
  expect(args.p_assignments).toEqual([{id:'TRA-2',programId:'TRN-1',employeeId:'EMP-002',employeeName:'Ν. Δ.',status:'assigned'}])
 })

 it('finishes a pending review, saves a requirement, deletes a record and creates a programme through the RPCs',async()=>{
  await service.finalizeTrainingReviewAsync('org-1','TRA-1',{points:{Q1:3},competent:null,note:'ok'})
  await service.saveTrainingRequirementAsync('org-1',{id:'REQ-1',title:'R',programIds:['TRN-1'],professions:[],positions:[],departments:[],renewalMonths:12,active:true,dbId:'x'},null)
  await service.deleteTrainingRecordAsync('org-1','TRA-9')
  const created=await service.createTrainingProgramAsync('org-1',{title:'New',requiresAssessment:true,passScore:'70',validMonths:'24'})
  expect(calls.rpc.map(c=>c.name)).toEqual(['training_finalize_review','training_save_requirement','training_delete_record','training_save_program'])
  expect(calls.rpc[0].args).toEqual({p_organization_id:'org-1',p_assignment_key:'TRA-1',p_points:{Q1:3},p_competent:null,p_note:'ok'})
  expect(calls.rpc[1].args.p_requirement).not.toHaveProperty('dbId')
  expect(calls.rpc[2].args).toEqual({p_organization_id:'org-1',p_record_key:'TRA-9'})
  expect(calls.rpc[3].args.p_program).toMatchObject({title:'New',passScore:70,validMonths:24,trainerFeedbackTemplate:{id:'TRAINER-FEEDBACK-DEFAULT'}})
  expect(created.dbId).toBe('new-uuid')
 })
})
