// The learner's page in steps, the result after the submission, the «Έναρξη / Συνέχεια» of «Οι δικές μου» and the
// database functions behind them (owner, 20/11/2026).
import { describe, expect, it } from 'vitest'
import { readSource } from './helpers/readSource'
import { accessDetailParts, accessMissing, accessReady, accessResult, accessStepLabel, accessSteps, accessSubmitted, clampStep, questionAnswered } from '../src/features/training/trainingAccessFlow'
import { trainingRowAction } from '../src/features/training/trainingMyView'
import { trainingDeliveryKindLabel, trainingMethodLabel } from '../src/features/training/TrainingProgramForm'
import type { TrainingAssignment } from '../src/features/training/trainingTypes'

const questions = [{ id: 'Q1', type: 'single_choice', required: true }, { id: 'Q2', type: 'free_text', required: true }, { id: 'Q3', type: 'free_text', required: false }]

describe('the steps of the learner’s page', () => {
  it('has the questions step only when the programme asks for an assessment', () => {
    expect(accessSteps({ requiresAssessment: true })).toEqual(['material', 'questions', 'evaluation', 'submit'])
    expect(accessSteps({ requiresAssessment: false })).toEqual(['material', 'evaluation', 'submit'])
    expect(accessSteps(null)).toEqual(['material', 'evaluation', 'submit'])
    expect(accessSteps({ requiresAssessment: true }).map(step => accessStepLabel(step))).toEqual(['Υλικό', 'Ερωτήσεις', 'Αξιολόγηση', 'Υποβολή'])
    expect(accessSteps({ requiresAssessment: true }).map(step => accessStepLabel(step, true))).toEqual(['Material', 'Questions', 'Evaluation', 'Submit'])
  })

  it('keeps the step inside the steps', () => {
    const steps = accessSteps({ requiresAssessment: false })
    expect(clampStep(-1, steps)).toBe(0)
    expect(clampStep(7, steps)).toBe(2)
    expect(clampStep(Number.NaN, steps)).toBe(0)
  })

  it('says what still stops the submission: unanswered questions and the attendance declaration', () => {
    const program = { requiresAssessment: true }
    expect(accessMissing(program, questions, {}, false)).toEqual({ unanswered: 2, notConfigured: false, attestation: true })
    expect(accessMissing(program, questions, { Q1: 'a', Q2: '  ' }, true)).toEqual({ unanswered: 1, notConfigured: false, attestation: false })
    expect(accessReady(accessMissing(program, questions, { Q1: 0, Q2: 'κείμενο' }, true))).toBe(true)
    expect(accessMissing(program, [], {}, true).notConfigured).toBe(true)
    expect(accessReady(accessMissing({ requiresAssessment: false }, questions, {}, true))).toBe(true)
    expect(questionAnswered({ id: 'x' }, false)).toBe(true)
    expect(questionAnswered({ id: 'x' }, [])).toBe(false)
  })

  it('locks the link after the submission and shows the result', () => {
    expect(accessSubmitted({ status: 'assigned' })).toBe(false)
    expect(accessSubmitted({ status: 'in_progress', feedbackSubmittedAt: '2026-11-20T10:00:00Z' })).toBe(true)
    expect(accessSubmitted({ status: 'completed' })).toBe(true)
    expect(accessResult({ assessmentReviewStatus: 'pending', score: null })).toEqual({ kind: 'review', score: null })
    expect(accessResult({ score: 85, competent: true })).toEqual({ kind: 'passed', score: 85 })
    expect(accessResult({ score: 50, competent: false })).toEqual({ kind: 'failed', score: 50 })
    expect(accessResult({ score: null, competent: true })).toEqual({ kind: 'completed', score: null })
    // The submission's own answer wins over the assignment not read again yet.
    expect(accessResult({ score: null }, { score: 70, competent: false })).toEqual({ kind: 'failed', score: 70 })
    expect(accessResult({ score: null }, { manualReviewRequired: true })).toEqual({ kind: 'review', score: null })
  })

  it('writes the details on one line, without codes', () => {
    expect(accessDetailParts({ requiresAssessment: true, category: 'ipc', method: 'elearning', trainer: 'Δρ. Ρήγας', dueDate: '2026-12-10' })).toEqual(['Πρόληψη & Έλεγχος Λοιμώξεων', 'Ηλεκτρονική εκπαίδευση', 'Δρ. Ρήγας', 'Προθεσμία\u00a010/12/2026'])
    expect(accessDetailParts({ requiresAssessment: false, method: 'xyz_code' }, 'en')).toEqual([])
  })
})

describe('the method and the type of a training never show a code', () => {
  it('reads other spellings as the known method and hides an unknown code', () => {
    expect(trainingMethodLabel('online')).toBe('Διαδικτυακά')
    expect(trainingMethodLabel('elearning')).toBe('Ηλεκτρονική εκπαίδευση')
    expect(trainingMethodLabel('e-learning', 'en')).toBe('E-learning')
    expect(trainingMethodLabel('classroom')).toBe('Δια ζώσης')
    expect(trainingMethodLabel('Webinar', 'en')).toBe('Online')
    expect(trainingMethodLabel('some_code')).toBe('—')
    expect(trainingMethodLabel('Σεμινάριο στο αμφιθέατρο')).toBe('Σεμινάριο στο αμφιθέατρο')
    expect(trainingMethodLabel('')).toBe('—')
    expect(trainingDeliveryKindLabel('intra-department')).toBe('Ενδοτμηματική')
    expect(trainingDeliveryKindLabel('elearning')).toBe('—')
  })
})

describe('«Οι δικές μου»: one small button per row', () => {
  const row = (extra: Partial<TrainingAssignment>, status = 'assigned', certificate: unknown = null) => ({ assignment: { id: 'A1', status, ...extra } as TrainingAssignment, status, certificate } as Parameters<typeof trainingRowAction>[0])
  it('«Έναρξη» before, «Συνέχεια» in progress, «Αποτέλεσμα» or the certificate after', () => {
    expect(trainingRowAction(row({}), true)).toBe('start')
    expect(trainingRowAction(row({}, 'overdue'), true)).toBe('start')
    expect(trainingRowAction(row({ status: 'in_progress' }, 'in_progress'), true)).toBe('continue')
    expect(trainingRowAction(row({ attendanceResponse: 'confirmed' }), true)).toBe('continue')
    expect(trainingRowAction(row({ status: 'in_progress', feedbackSubmittedAt: '2026-11-20T10:00:00Z', assessmentReviewStatus: 'pending' }, 'in_progress'), true)).toBe('result')
    expect(trainingRowAction(row({}, 'completed'), true)).toBe('result')
    expect(trainingRowAction(row({}, 'completed', { id: 'C1' }), true)).toBe('certificate')
  })
  it('never opens another person’s training from the department list', () => {
    expect(trainingRowAction(row({}), false)).toBeNull()
    expect(trainingRowAction(row({}, 'completed'), false)).toBeNull()
    expect(trainingRowAction(row({}, 'completed', { id: 'C1' }), false)).toBe('certificate')
  })
  it('opens the user’s own page through training_my_access, in the same tab', () => {
    // The own buttons are shared by the list and the programme's page (useTrainingOwnActions).
    const view = readSource('src/features/training/useTrainingOwnActions.tsx')
    expect(view).toContain('openOwnTrainingAccessAsync(organizationId,row.assignment.id)')
    expect(view).toContain('navigate(`/training-access/${encodeURIComponent(key)}`,{state:{trainingFromApp:true}})')
    expect(readSource('src/features/training/trainingInvitationService.ts')).toContain("supabase.rpc('training_my_access',{p_organization_id:organizationId,p_assignment_key:assignmentKey})")
  })
})

describe('the learner’s page', () => {
  const page = readSource('src/features/training/TrainingAccessPage.tsx')
  it('is a stepper with one «Εκπαιδευτικό υλικό» and a result view after the submission', () => {
    expect(page).toContain('<StepList className="training-access-steps"')
    expect(page).toContain('<AccessResultView')
    expect(page).toContain('loadTrainingAccessCertificateAsync(token)')
    expect(page).not.toContain('training-public-details')
    expect(page).not.toContain("Form already submitted")
    // The programme's listed material is shown by the reader, together with the files.
    expect(page.match(/<TrainingMaterialReader /g)?.length).toBe(2)
    expect(page).toContain('materials={program.materials||[]} readOnly')
  })
})

describe('database functions', () => {
  const sql = readSource('supabase/migrations/20261231605000_training_access_steps.sql')
  const own = sql.slice(sql.indexOf('create or replace function private.training_my_access'), sql.indexOf('create or replace function public.training_my_access'))
  const certificate = sql.slice(sql.indexOf('create or replace function public.training_access_certificate'), sql.indexOf('create or replace function private.training_my_access'))
  it('gives the personal link only of the caller’s own assignment', () => {
    expect(own).toContain('security definer')
    expect(own).toContain("set search_path to ''")
    expect(own).toContain('if auth.uid() is null then')
    expect(own).toContain('private.password_change_pending()')
    expect(own).toContain("om.user_id = auth.uid() and om.organization_id = p_organization_id and om.status = 'active'")
    expect(own).toContain("'training' = any (coalesce(private.org_disabled_modules(p_organization_id)")
    expect(own).toContain('a.organization_id = p_organization_id and a.assignment_key = p_assignment_key')
    expect(own).toContain('a.employee_user_id = auth.uid()')
    expect(own).toContain('e.id = a.employee_id and e.organization_id = a.organization_id and e.user_id = auth.uid()')
    expect(own).toContain("'TRN-ACCESS-' || replace(gen_random_uuid()::text, '-', '')")
    expect(sql).toMatch(/create or replace function public\.training_my_access[\s\S]*security invoker[\s\S]*select private\.training_my_access\(p_organization_id, p_assignment_key\)/)
    expect(sql).toContain('grant execute on function public.training_my_access(uuid, text) to authenticated;')
    expect(sql).not.toMatch(/grant execute on function public\.training_my_access[^;]*anon/)
  })
  it('returns the certificate of the link’s own assignment only', () => {
    expect(certificate).toContain('security definer')
    expect(certificate).toContain("set search_path to ''")
    expect(certificate).toContain('where a.access_token = p_token')
    expect(certificate).toContain('c.assignment_id = v_assignment.id and c.organization_id = v_assignment.organization_id')
  })
  it('only creates or replaces and grants', () => {
    expect(sql.replace(/--[^\n]*/g, '')).not.toMatch(/\b(drop|revoke|delete|alter policy)\b/i)
  })
})
