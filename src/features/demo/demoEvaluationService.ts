import { supabase } from '../../core/supabase/client'
import type { AnyRecord } from '../../types/featureTypes'

// The evaluation guide's progress and "I want the application" requests of a
// Demo organization (tables keyed by demo_organization_id; see
// supabase/migrations/20261014120000_demo_evaluation_experience.sql).

const progressMap = (rows: AnyRecord[] | null): Record<string, string> => Object.fromEntries((rows || []).filter((row) => row.completed_at).map((row) => [row.step_key, row.completed_at]))

export async function loadMyDemoProgress(organizationId: string | null | undefined, userId: string | null | undefined): Promise<Record<string, string>> {
  if (!supabase || !organizationId || !userId) return {}
  const { data, error } = await supabase.from('demo_evaluation_progress').select('step_key,completed_at')
    .eq('demo_organization_id', organizationId).eq('user_id', userId)
  if (error) throw error
  return progressMap(data)
}

export async function setDemoEvaluationStep(organizationId: string | null | undefined, step: string, done = true) {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED')
  const { data, error } = await supabase.rpc('demo_set_evaluation_step', { p_organization_id: organizationId as string, p_step: step, p_done: done })
  if (error) throw error
  return (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
}

// Ratings of the guide's scenarios ('guide_opened' = the guide as a whole):
// { step: { rating, comment, ease, clarity, durationSeconds } }. The
// questionnaire columns come with 20261028120000_demo_role_guidance.sql; until
// that migration is applied the plain rating is read and written instead.
export interface DemoRating { rating: number, comment: string, ease: number | null, clarity: number | null, durationSeconds: number | null }
const ratingsMap = (rows: AnyRecord[]): Record<string, DemoRating> => Object.fromEntries((rows || []).filter((row) => row.rating).map((row) => [row.step_key, {
  rating: row.rating, comment: row.rating_comment || '', ease: row.ease ?? null, clarity: row.clarity ?? null, durationSeconds: row.duration_seconds ?? null,
}]))
const QUESTIONNAIRE_COLUMNS = 'ease,clarity,duration_seconds'
export const isMissingSchema = (error: { code?: string } | null | undefined) => ['PGRST202', 'PGRST204', '42703', '42883'].includes(error?.code || '')

// Whether 20261028120000_demo_role_guidance.sql is applied (null until a read
// tells): the scenarios of the other roles need its step keys.
let extendedSchema: boolean | null = null
export const hasExtendedDemoSchema = () => extendedSchema

// The column list is put together here (with or without the questionnaire), so the
// read goes through a client that only knows what it is used for.
interface ProgressQuery extends PromiseLike<{ data: AnyRecord[] | null, error: { code?: string } | null }> { eq(column: string, value: string): ProgressQuery }
const cloud = () => supabase as unknown as { from(table: string): { select(columns: string): ProgressQuery } }

async function selectProgress(columns: string, organizationId: string, userId: string | null = null): Promise<AnyRecord[]> {
  const supabase = cloud()
  let query = supabase.from('demo_evaluation_progress').select(`${columns},${QUESTIONNAIRE_COLUMNS}`).eq('demo_organization_id', organizationId)
  if (userId) query = query.eq('user_id', userId)
  let result = await query
  extendedSchema = !isMissingSchema(result.error)
  if (!extendedSchema) {
    query = supabase.from('demo_evaluation_progress').select(columns).eq('demo_organization_id', organizationId)
    if (userId) query = query.eq('user_id', userId)
    result = await query
  }
  if (result.error) throw result.error
  return result.data || []
}

export async function loadMyDemoRatings(organizationId: string | null | undefined, userId: string | null | undefined): Promise<Record<string, DemoRating>> {
  if (!supabase || !organizationId || !userId) return {}
  return ratingsMap(await selectProgress('step_key,rating,rating_comment', organizationId, userId))
}

// The questionnaire of a completed scenario: usefulness (the rating), ease and
// clarity 1-5, the seconds it took and a comment.
export async function submitDemoScenarioFeedback(organizationId: string | null | undefined, step: string, { rating, ease = null, clarity = null, durationSeconds = null, comment = '' }: { rating: number, ease?: number | null, clarity?: number | null, durationSeconds?: number | null, comment?: string }) {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED')
  const { data, error } = await supabase.rpc('demo_submit_scenario_feedback', {
    p_organization_id: organizationId as string, p_step: step, p_rating: rating, p_ease: ease as number | undefined, p_clarity: clarity as number | undefined,
    p_duration_seconds: (Number.isFinite(durationSeconds) ? Math.max(0, Math.round(Number(durationSeconds))) : null) as number | undefined, p_comment: (comment || null) as string | undefined,
  })
  if (isMissingSchema(error)) return rateDemoEvaluationStep(organizationId, step, rating, comment)
  if (error) throw error
  return (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
}

export async function rateDemoEvaluationStep(organizationId: string | null | undefined, step: string, rating: number, comment = '') {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED')
  const { data, error } = await supabase.rpc('demo_rate_evaluation_step', { p_organization_id: organizationId as string, p_step: step, p_rating: rating, p_comment: (comment || null) as string | undefined })
  if (error) throw error
  return (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
}

export async function requestDemoApplication(organizationId: string | null | undefined, { contactName, contactPhone = '', message = '' }: { contactName: string, contactPhone?: string, message?: string }) {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED')
  const { data, error } = await supabase.rpc('demo_request_application', {
    p_organization_id: organizationId as string, p_contact_name: contactName, p_contact_phone: (contactPhone || null) as string | undefined, p_message: (message || null) as string | undefined,
  })
  if (error) throw error
  // The request is also e-mailed to the Platform Owner; the outbox is sent now
  // and a failure here never undoes the request.
  supabase.functions.invoke('process-notification-outbox', { body: { organizationId } }).catch(() => {})
  return data
}

export async function loadMyDemoApplicationRequests(organizationId: string | null | undefined, userId: string | null | undefined) {
  if (!supabase || !organizationId || !userId) return []
  const { data, error } = await supabase.from('demo_application_requests').select('id,created_at,status')
    .eq('demo_organization_id', organizationId).eq('user_id', userId).order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// Platform Owner: every evaluator's progress and requests in one Demo.
export async function loadDemoEvaluationOverview(organizationId: string | null | undefined): Promise<{ progress: AnyRecord[], requests: AnyRecord[] }> {
  if (!supabase || !organizationId) return { progress: [], requests: [] }
  const [progress, requests] = await Promise.all([
    selectProgress('user_id,step_key,completed_at,updated_at,rating,rating_comment', organizationId).then((data): { data: AnyRecord[] | null, error: unknown } => ({ data, error: null }), (error: unknown) => ({ data: null, error })),
    supabase.from('demo_application_requests').select('id,user_id,contact_name,contact_email,contact_phone,message,status,created_at,handled_at')
      .eq('demo_organization_id', organizationId).order('created_at', { ascending: false }),
  ])
  if (progress.error) throw progress.error
  if (requests.error) throw requests.error
  return { progress: progress.data || [], requests: requests.data || [] }
}

export async function updateDemoApplicationRequestStatus(requestId: string, status: string, userId: string | null | undefined) {
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
