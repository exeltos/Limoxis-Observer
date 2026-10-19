import { beforeEach,describe,expect,it,vi } from 'vitest'

// Employee record tabs (Training, Evaluations) in production read the
// employee's assignments from training_assignments with their programme,
// answers and certificate.
const tables={}
const seen=[]
function builder(table){
 const filters=[]
 const api={select(columns){seen.push({table,columns});return api},eq(c,v){filters.push(['eq',c,v]);return api},in(c,v){filters.push(['in',c,v]);return api},or(v){filters.push(['or',v]);return api},order(){return api},
  maybeSingle(){return Promise.resolve({data:(tables[table]||[])[0]||null,error:null})},
  then(resolve,reject){let rows=tables[table]||[];for(const [kind,c,v] of filters)if(kind==='in')rows=rows.filter(r=>v.includes(r[c]));return Promise.resolve({data:rows,error:null}).then(resolve,reject)}}
 return api
}
vi.mock('../src/core/supabase/client',()=>({supabase:{from:table=>builder(table),auth:{getUser:async()=>({data:{user:{id:'u'}}})}}}))
vi.mock('../src/core/config/env',()=>({hasSupabaseConfig:true}))
const { configureDataEnvironment }=await import('../src/core/data/dataEnvironment')
const { loadEmployeeTrainingAsync,loadEvaluationsAsync }=await import('../src/features/employees/employeeSubRecordsService')

const programRow={id:'p1',program_key:'TRN-1',title:'Υγιεινή χεριών',title_en:'Hand hygiene',status:'completed',requires_assessment:true,pass_score:80,start_date:'2026-06-01',due_date:'2026-06-30',training_program_materials:[],training_assessment_questions:[{question_key:'Q1',position:1,question_type:'true_false',text:'?',points:1,required:true,correct_boolean:true,model_answer:null,manual_review:false,training_assessment_options:[]}],training_program_effectiveness:[],training_program_feedback_questions:[]}
const assignmentRow={id:'a1',assignment_key:'TRA-1',program_id:'p1',employee_id:'db-emp-1',employee_code:'EMP-101',status:'completed',assigned_date:'2026-06-01',completed_date:'2026-06-12',score:100,competent:true,assessment_submitted_at:'2026-06-12T10:45:00+00:00',feedback_submitted_at:'2026-06-12T10:42:00+00:00',assessment_review_status:'not_required',created_at:'2026-06-01T08:00:00+00:00',updated_at:'2026-06-12T10:45:00+00:00',
 training_assessment_answers:[{question_key:'Q1',answer_kind:'boolean',answer_boolean:true}],training_feedback_responses:[],training_certificates:[{certificate_key:'CERT-TRA-1'}]}

beforeEach(()=>{
 configureDataEnvironment({mode:'production',organizationId:'org-1'})
 Object.assign(tables,{employees:[{id:'db-emp-1',employee_code:'EMP-101',user_id:null}],training_assignments:[assignmentRow],training_programs:[programRow],training_certificates:[{id:'c1',certificate_key:'CERT-TRA-1',assignment_id:'a1',employee_code:'EMP-101',title:'Υγιεινή χεριών',issued_date:'2026-06-12',valid_until:'2027-06-12',issuer:'Limoxis Observer',training_assignments:{assignment_key:'TRA-1'}}],employee_evaluations:[],profiles:[]})
 seen.length=0
})

describe('employee record: training and evaluations from the relational tables',()=>{
 it('lists the employee\'s training with the programme title and keeps the source label',async()=>{
  const rows=await loadEmployeeTrainingAsync('org-1','db-emp-1','EMP-101')
  expect(seen.map(s=>s.table)).toContain('training_assignments')
  expect(seen.map(s=>s.table)).not.toContain('training_records')
  expect(rows).toEqual([expect.objectContaining({id:'TRA-1',employeeId:'db-emp-1',titleEl:'Υγιεινή χεριών',titleEn:'Hand hygiene',completedDate:'2026-06-12',status:'completed',programId:'TRN-1',score:100,competent:true,source:'training_records'})])
 })

 it('adds the knowledge assessment, its answers and certificate to the evaluations',async()=>{
  const rows=await loadEvaluationsAsync('org-1','db-emp-1','EMP-101')
  expect(rows).toEqual([expect.objectContaining({id:'training-TRA-1',titleEl:'Αξιολόγηση γνώσεων · Υγιεινή χεριών',resultEl:'Βαθμολογία 100% · Επιτυχής',assessmentAnswers:{Q1:true},certificateId:'CERT-TRA-1',source:'training'})])
  expect(rows[0].certificate).toMatchObject({id:'CERT-TRA-1',validUntil:'2027-06-12'})
  expect(rows[0].assessmentQuestions[0]).toMatchObject({id:'Q1',type:'true_false'})
 })
})
