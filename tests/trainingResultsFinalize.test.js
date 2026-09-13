import {describe,expect,it} from 'vitest'
import fs from 'node:fs'

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8')

describe('training completion and review behavior',()=>{
 it('does not force every free-text question into manual review',()=>{
  const assessment=read('src/features/training/trainingAssessment.js')
  expect(assessment).not.toContain("if(type==='free_text')base.manualReview=true")
  expect(assessment).toContain('manualReview:Boolean(question.manualReview)')
 })

 it('lets the author explicitly choose whether a free-text answer blocks completion',()=>{
  const editor=read('src/features/training/TrainingAssessmentEditor.jsx')
  expect(editor).toContain("Απαιτεί χειροκίνητο έλεγχο πριν από την ολοκλήρωση")
  expect(editor).toContain('manualReview:e.target.checked')
  expect(editor).toContain('δεν εμποδίζει την αυτόματη ολοκλήρωση')
 })

 it('notifies an open training record after an external assessment is submitted',()=>{
  const invitations=read('src/features/training/trainingInvitationService.js')
  expect(invitations).toContain("TRAINING_UPDATES_CHANNEL='limoxis-training-updates'")
  expect(invitations).toContain('announceTrainingUpdate')
  expect(invitations).toContain('window.location.reload()')
  expect(invitations).toContain('TRAINING_TAB_KEY')
 })

 it('only requests server-side manual review when the question explicitly opts in',()=>{
  const migration=read('supabase/migrations/202609130002_training_optional_manual_review.sql')
  expect(migration).toContain("if coalesce((v_question->>'manualReview')::boolean,false) then v_manual_review:=true")
  expect(migration).toContain("'assessmentReviewStatus',case when v_manual_review then 'pending' else 'not_required' end")
 })
})
