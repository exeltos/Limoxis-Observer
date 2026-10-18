import { describe,expect,it } from 'vitest'
import fs from 'node:fs'
import { assignmentToRpc,learnerOwnedAssignmentFields,programToRpc } from '../src/features/training/trainingMappers'

const service=fs.readFileSync(new URL('../src/features/training/trainingService.js',import.meta.url),'utf8')
const migration=fs.readFileSync(new URL('../supabase/migrations/20261115100000_training_relational.sql',import.meta.url),'utf8')
const fn=name=>{const start=migration.indexOf(`create or replace function ${name}(`);return migration.slice(start,migration.indexOf('$function$;',start))}

describe('training manager and learner concurrency',()=>{
  it('never sends the learner-owned assignment outcomes with a manager save',()=>{
    expect(service).toContain('learnerOwnedAssignmentFields')
    for(const field of ['attendanceConfirmedAt','completionConfirmedAt','score','competent','assessmentAnswers','feedbackScores','accessToken'])expect(learnerOwnedAssignmentFields).toContain(field)
    expect(learnerOwnedAssignmentFields).not.toContain('checkInAt')
    const input=assignmentToRpc({id:'TRA-1',programId:'TRN-1',employeeId:'EMP-1',status:'assigned',score:100,competent:true,attendanceConfirmedAt:'x',completionConfirmedAt:'x',assessmentAnswers:{Q:1},feedbackScores:{a:5},accessToken:'T',dbId:'u',computedStatus:'overdue'})
    expect(input).toEqual({id:'TRA-1',programId:'TRN-1',employeeId:'EMP-1',status:'assigned'})
  })

  it('keeps the learner-owned columns in the database whatever an API client sends',()=>{
    const keep=fn('private.training_assignment_keep_learner_fields')
    expect(keep).toContain("if current_user <> 'authenticated' then return new; end if;")
    for(const column of ['access_token','attendance_confirmed_at','completion_confirmed_at','feedback_submitted_at','assessment_submitted_at','assessment_review_status','score','competent','completed_date'])expect(keep).toContain(`new.${column} := old.${column};`)
    expect(keep).toContain("if old.status in ('completed','in_progress') then new.status := old.status; end if;")
    expect(keep).toContain('security invoker')
    expect(migration).toContain('create trigger trg_training_assignments_learner_fields\nbefore update on public.training_assignments')
    const save=fn('public.training_save_assignment')
    expect(save).toContain("status = case when t.status in ('completed','in_progress') then t.status else excluded.status end")
    expect(save).not.toMatch(/score\s*=|competent\s*=|access_token\s*=/)
  })

  it('preserves the trainer evaluations a programme collected when a manager edits it',()=>{
    expect(programToRpc({id:'TRN-1',dbId:'u',feedbackResponses:[{assignmentId:'TRA-1'}],title:'T'})).toEqual({id:'TRN-1',title:'T'})
    expect(fn('public.training_save_program')).not.toContain('training_feedback_responses')
  })
})
