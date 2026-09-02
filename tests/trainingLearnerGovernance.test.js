import { describe,expect,it } from 'vitest'
import fs from 'node:fs'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

describe('training learner governance',()=>{
  const learner=read('supabase/migrations/202609020004_v0318_training_authenticated_learner_actions.sql')
  const hardened=read('supabase/migrations/202609020005_v0319_training_learner_rpc_execution_context.sql')
  const feedback=read('supabase/migrations/202609020006_v0320_training_completion_feedback_projection.sql')
  const identity=read('supabase/migrations/202609020007_v0321_training_assignment_identity_projection.sql')

  it('binds check-in and completion to auth identity and assigned records',()=>{
    expect(learner).toContain('auth.uid()')
    expect(learner).toContain("employee_user_id=auth.uid()")
    expect(learner).toContain("payload->>'programId'=v_program.record_key")
  })

  it('uses narrowly granted security definer functions rather than broader learner table writes',()=>{
    expect(hardened).toContain('security definer')
    expect(hardened).toContain('grant execute on function public.training_check_in(text) to authenticated')
    expect(hardened).toContain('grant execute on function public.training_complete(text,jsonb,jsonb,text) to authenticated')
  })

  it('calculates assessment results server-side and refuses incomplete or missing assessments',()=>{
    expect(learner).toContain('TRAINING_ASSESSMENT_NOT_CONFIGURED')
    expect(learner).toContain('TRAINING_ASSESSMENT_INCOMPLETE')
    expect(learner).toContain('round(v_earned/v_total*100)')
  })

  it('projects learner feedback and assignment identity without exposing generic write access',()=>{
    expect(feedback).toContain("'{feedbackResponses}'")
    expect(identity).toContain('project_training_assignment_identity')
    expect(identity).toContain('employee_code')
    expect(identity).toContain('employee_user_id')
  })
})
