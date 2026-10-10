import { supabase } from '../../core/supabase/client'

// The evaluation guide's progress and "I want the application" requests of a
// Demo organization (tables keyed by demo_organization_id; see
// supabase/migrations/20261014120000_demo_evaluation_experience.sql).

const progressMap = (rows) => Object.fromEntries((rows || []).filter((row) => row.completed_at).map((row) => [row.step_key, row.completed_at]))

export async function loadMyDemoProgress(organizationId, userId) {
  if (!supabase || !organizationId || !userId) return {}
  const { data, error } = await supabase.from('demo_evaluation_progress').select('step_key,completed_at')
    .eq('demo_organization_id', organizationId).eq('user_id', userId)
  if (error) throw error
  return progressMap(data)
}

export async function setDemoEvaluationStep(organizationId, step, done = true) {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED')
  const { data, error } = await supabase.rpc('demo_set_evaluation_step', { p_organization_id: organizationId, p_step: step, p_done: done })
  if (error) throw error
  return data && typeof data === 'object' ? data : {}
}

// Ratings of the guide's scenarios ('guide_opened' = the guide as a whole):
// { step: { rating, comment, ease, clarity, durationSeconds } }. The
// questionnaire columns come with 20261028120000_demo_role_guidance.sql; until
// that migration is applied the plain rating is read and written instead.
const ratingsMap = (rows) => Object.fromEntries((rows || []).filter((row) => row.rating).map((row) => [row.step_key, {
  rating: row.rating, comment: row.rating_comment || '', ease: row.ease ?? null, clarity: row.clarity ?? null, durationSeconds: row.duration_seconds ?? null,
}]))
const QUESTIONNAIRE_COLUMNS = 'ease,clarity,duration_seconds'
export const isMissingSchema = (error) => ['PGRST202', 'PGRST204', '42703', '42883'].includes(error?.code)

async function selectProgress(columns, organizationId, userId = null) {
  let query = supabase.from('demo_evaluation_progress').select(`${columns},${QUESTIONNAIRE_COLUMNS}`).eq('demo_organization_id', organizationId)
  if (userId) query = query.eq('user_id', userId)
  let result = await query
  if (isMissingSchema(result.error)) {
    query = supabase.from('demo_evaluation_progress').select(columns).eq('demo_organization_id', organizationId)
    if (userId) query = query.eq('user_id', userId)
    result = await query
  }
  if (result.error) throw result.error
  return result.data || []
}

export async function loadMyDemoRatings(organizationId, userId) {
  if (!supabase || !organizationId || !userId) return {}
  return ratingsMap(await selectProgress('step_key,rating,rating_comment', organizationId, userId))
}

// The questionnaire of a completed scenario: usefulness (the rating), ease and
// clarity 1-5, the seconds it took and a comment.
export async function submitDemoScenarioFeedback(organizationId, step, { rating, ease = null, clarity = null, durationSeconds = null, comment = '' }) {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED')
  const { data, error } = await supabase.rpc('demo_submit_scenario_feedback', {
    p_organization_id: organizationId, p_step: step, p_rating: rating, p_ease: ease, p_clarity: clarity,
    p_duration_seconds: Number.isFinite(durationSeconds) ? Math.max(0, Math.round(durationSeconds)) : null, p_comment: comment || null,
  })
  if (isMissingSchema(error)) return rateDemoEvaluationStep(organizationId, step, rating, comment)
  if (error) throw error
  return data && typeof data === 'object' ? data : {}
}

export async function rateDemoEvaluationStep(organizationId, step, rating, comment = '') {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED')
  const { data, error } = await supabase.rpc('demo_rate_evaluation_step', { p_organization_id: organizationId, p_step: step, p_rating: rating, p_comment: comment || null })
  if (error) throw error
  return data && typeof data === 'object' ? data : {}
}

export async function requestDemoApplication(organizationId, { contactName, contactPhone = '', message = '' }) {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED')
  const { data, error } = await supabase.rpc('demo_request_application', {
    p_organization_id: organizationId, p_contact_name: contactName, p_contact_phone: contactPhone || null, p_message: message || null,
  })
  if (error) throw error
  // The request is also e-mailed to the Platform Owner; the outbox is sent now
  // and a failure here never undoes the request.
  supabase.functions.invoke('process-notification-outbox', { body: { organizationId } }).catch(() => {})
  return data
}

export async function loadMyDemoApplicationRequests(organizationId, userId) {
  if (!supabase || !organizationId || !userId) return []
  const { data, error } = await supabase.from('demo_application_requests').select('id,created_at,status')
    .eq('demo_organization_id', organizationId).eq('user_id', userId).order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// Platform Owner: every evaluator's progress and requests in one Demo.
export async function loadDemoEvaluationOverview(organizationId) {
  if (!supabase || !organizationId) return { progress: [], requests: [] }
  const [progress, requests] = await Promise.all([
    selectProgress('user_id,step_key,completed_at,updated_at,rating,rating_comment', organizationId).then((data) => ({ data, error: null }), (error) => ({ data: null, error })),
    supabase.from('demo_application_requests').select('id,user_id,contact_name,contact_email,contact_phone,message,status,created_at,handled_at')
      .eq('demo_organization_id', organizationId).order('created_at', { ascending: false }),
  ])
  if (progress.error) throw progress.error
  if (requests.error) throw requests.error
  return { progress: progress.data || [], requests: requests.data || [] }
}

export async function updateDemoApplicationRequestStatus(requestId, status, userId) {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED')
  const { error } = await supabase.from('demo_application_requests')
    .update({ status, handled_at: status === 'new' ? null : new Date().toISOString(), handled_by: status === 'new' ? null : userId || null })
    .eq('id', requestId)
  if (error) throw error
}

// Platform Owner, Demo registry: the Demo organizations with a new request.
export async function loadDemoOrganizationsWithNewRequests() {
  if (!supabase) return []
  const { data, error } = await supabase.from('demo_application_requests').select('demo_organization_id').eq('status', 'new')
  if (error) throw error
  return [...new Set((data || []).map((row) => row.demo_organization_id))]
}
