// Protocol runs of a surveillance episode and the 48–72 h antimicrobial reviews:
// Supabase tables clinical_protocol_runs / _steps / _events and
// antimicrobial_therapy_reviews (20261203300000), or the session store in the Demo.
import { supabase as configuredClient, type Cloud } from '../../../core/supabase/client'
import { assertCloud, currentUserId } from '../../../core/supabase/cloudContext'
import { protocolByKey } from './protocolCatalogue'
import { therapyStart } from './therapyReview'
import { demoProtocolRuns, demoTherapyReviews } from './protocolDemoData'
import type { AntimicrobialTherapy, ClinicalCaseLike } from '../clinicalTypes'
import type { OpenProtocolRun, ProtocolActor, ProtocolEventDetail, ProtocolEventInput, ProtocolEventRow, ProtocolFinishDraft, ProtocolRun, ProtocolRunEvent, ProtocolRunRow, ProtocolRunStep, ProtocolStartDraft, ProtocolStepDraft, ProtocolStepRow, RecognitionTimeDraft, TherapyReview, TherapyReviewDraft, TherapyReviewRow } from './protocolTypes'

// The calls below run with a configured client: the demo and an unconfigured build return before them.
const supabase = configuredClient as Cloud

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const nowIso = () => new Date().toISOString()
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const demoId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`

function mapStep(row: ProtocolStepRow): ProtocolRunStep {
  return {
    id: row.id,
    key: row.step_key,
    status: row.status,
    doneAt: row.done_at,
    value: row.value_text || '',
    notIndicatedReason: row.not_indicated_reason || '',
    therapyId: row.therapy_id,
    recordedByName: row.recorded_by_name || '',
    recordedAt: row.updated_at || row.recorded_at,
  }
}
function mapEvent(row: ProtocolEventRow): ProtocolRunEvent {
  // detail is a Json column the service writes as ProtocolEventDetail (appendEvent).
  return { id: row.id, type: row.event_type, stepKey: row.step_key, detail: (row.detail || {}) as ProtocolEventDetail, reason: row.reason || '', actorName: row.actor_name || '', at: row.occurred_at }
}
function mapRun(row: ProtocolRunRow, steps: ProtocolStepRow[] = [], events: ProtocolEventRow[] = []): ProtocolRun {
  return {
    id: row.id,
    caseId: row.surveillance_case_id,
    protocolKey: row.protocol_key,
    recognizedAt: row.recognized_at,
    recognitionSource: row.recognition_source || '',
    weightKg: row.weight_kg == null ? null : Number(row.weight_kg),
    status: row.status,
    startedBy: row.started_by || '',
    startedByName: row.started_by_name || '',
    startedAt: row.started_at,
    completedAt: row.completed_at,
    completedByName: row.completed_by_name || '',
    closeReason: row.close_reason || '',
    steps: steps.filter(step => step.run_id === row.id).map(mapStep),
    events: events.filter(event => event.run_id === row.id).map(mapEvent),
  }
}
function mapReview(row: TherapyReviewRow): TherapyReview {
  return {
    id: row.id,
    therapyId: row.therapy_id,
    caseId: row.surveillance_case_id,
    decision: row.decision,
    reasons: row.reasons || [],
    note: row.note || '',
    newRegimen: row.new_regimen || '',
    reviewedAt: row.reviewed_at,
    reviewerName: row.reviewer_name || '',
    reviewerJobTitle: row.reviewer_job_title || '',
  }
}

const caseKey = (record: ClinicalCaseLike | null | undefined) => record?.recordId || record?.id

interface LoadProtocolRunsOptions {
  isDemo?: boolean
}
// Runs of one episode, newest first, with their steps and history.
export async function loadProtocolRuns(organizationId: string | null | undefined, record: ClinicalCaseLike | null | undefined, { isDemo = false }: LoadProtocolRunsOptions = {}): Promise<ProtocolRun[]> {
  if (isDemo) return clone(demoProtocolRuns.filter(run => String(run.caseId) === String(record?.id)))
  assertCloud()
  const caseId = caseKey(record)
  if (!organizationId || !UUID.test(String(caseId || ''))) return []
  // caseId is a UUID by the test above.
  const { data: runs, error } = await supabase
    .from('clinical_protocol_runs')
    .select('*')
    .eq('organization_id', organizationId as string)
    .eq('surveillance_case_id', caseId as string)
    .order('started_at', { ascending: false })
  if (error) throw error
  if (!runs?.length) return []
  const ids = runs.map(run => run.id)
  const [steps, events] = await Promise.all([
    supabase.from('clinical_protocol_steps').select('*').in('run_id', ids),
    supabase.from('clinical_protocol_events').select('*').in('run_id', ids).order('occurred_at', { ascending: false }),
  ])
  if (steps.error) throw steps.error
  if (events.error) throw events.error
  return runs.map(run => mapRun(run, steps.data || [], events.data || []))
}

interface LoadOpenProtocolRunsOptions {
  isDemo?: boolean
}
// Open runs of the organization, for the badge of the surveillance list:
// one entry per episode with the protocol key and its recognition time.
export async function loadOpenProtocolRuns(organizationId: string | null | undefined, { isDemo = false }: LoadOpenProtocolRunsOptions = {}): Promise<OpenProtocolRun[]> {
  if (isDemo) return demoProtocolRuns.filter(run => run.status === 'open').map(run => ({ caseId: run.caseId, protocolKey: run.protocolKey, recognizedAt: run.recognizedAt }))
  if (!supabase || !organizationId) return []
  const { data, error } = await supabase
    .from('clinical_protocol_runs')
    .select('surveillance_case_id,protocol_key,recognized_at')
    .eq('organization_id', organizationId as string)
    .eq('status', 'open')
  if (error) throw error
  return (data || []).map(row => ({ caseId: row.surveillance_case_id, protocolKey: row.protocol_key, recognizedAt: row.recognized_at }))
}

async function appendEvent(organizationId: string | null | undefined, runId: string, actor: ProtocolActor | null, event: ProtocolEventInput) {
  const actorId = await currentUserId()
  const { error } = await supabase.from('clinical_protocol_events').insert({
    organization_id: organizationId as string,
    run_id: runId,
    event_type: event.type,
    step_key: event.stepKey || null,
    detail: event.detail || {},
    reason: event.reason || null,
    actor_id: actorId,
    actor_name: actor?.name || null,
  })
  if (error) throw error
}
function demoEvent(run: ProtocolRun, actor: ProtocolActor | null, event: ProtocolEventInput) {
  run.events = [{ id: demoId('EV'), ...event, detail: event.detail || {}, reason: event.reason || '', actorName: actor?.name || 'Demo user', at: nowIso() }, ...(run.events || [])]
}
// Demo: the run on screen is always in the session list.
const demoRun = (runId: string) => demoProtocolRuns.find(run => run.id === runId)!
// Demo: the bin takes a protocol run out of the session list and puts it back on restore.
export function removeDemoProtocolRun(runId: string) {
  const index = demoProtocolRuns.findIndex(run => run.id === runId)
  return index < 0 ? null : demoProtocolRuns.splice(index, 1)[0]
}
export function restoreDemoProtocolRun(row: ProtocolRun) {
  if (row && !demoProtocolRuns.some(run => run.id === row.id)) demoProtocolRuns.unshift(row)
}

interface StartProtocolRunOptions {
  isDemo?: boolean
  actor?: ProtocolActor | null
}
export async function startProtocolRun(organizationId: string | null | undefined, record: ClinicalCaseLike, draft: ProtocolStartDraft, { isDemo = false, actor = null }: StartProtocolRunOptions = {}) {
  if (!protocolByKey(draft.protocolKey)) throw new Error('Unknown protocol')
  if (isDemo) {
    const run: ProtocolRun = { id: demoId('PRT'), caseId: record.id, protocolKey: draft.protocolKey, recognizedAt: draft.recognizedAt, recognitionSource: draft.recognitionSource || 'clinical', weightKg: draft.weightKg ?? null, status: 'open', startedByName: actor?.name || 'Demo user', startedAt: nowIso(), completedAt: null, completedByName: '', closeReason: '', steps: [], events: [] }
    demoEvent(run, actor, { type: 'started', detail: { source: run.recognitionSource } })
    demoProtocolRuns.unshift(run)
    return clone(run)
  }
  assertCloud(organizationId)
  const actorId = await currentUserId()
  const { data, error } = await supabase
    .from('clinical_protocol_runs')
    .insert({
      organization_id: organizationId as string,
      // An episode on screen always has its id.
      surveillance_case_id: caseKey(record) as string,
      patient_id: record.patientRecordId || null,
      admission_id: UUID.test(String(record.admissionId || '')) ? record.admissionId : null,
      department_id: record.departmentId || null,
      protocol_key: draft.protocolKey,
      protocol_version: protocolByKey(draft.protocolKey)!.version,
      recognized_at: new Date(draft.recognizedAt).toISOString(),
      recognition_source: draft.recognitionSource || 'clinical',
      trigger_assessment_id: UUID.test(String(draft.triggerAssessmentId || '')) ? draft.triggerAssessmentId : null,
      weight_kg: draft.weightKg ?? null,
      started_by: actorId,
      started_by_name: actor?.name || null,
      updated_by: actorId,
    })
    .select('*')
    .single()
  if (error) throw error
  await appendEvent(organizationId, data.id, actor, { type: 'started', detail: { source: draft.recognitionSource || 'clinical' } })
  return mapRun(data)
}

interface RecordProtocolStepOptions {
  isDemo?: boolean
  actor?: ProtocolActor | null
}
// Records a step as done (time, value) or «not indicated» (reason); status
// 'pending' clears it again. Each change is also an event of the run.
export async function recordProtocolStep(organizationId: string | null | undefined, run: ProtocolRun, draft: ProtocolStepDraft, { isDemo = false, actor = null }: RecordProtocolStepOptions = {}) {
  const status = draft.status
  const row = {
    status,
    done_at: status === 'done' ? new Date(draft.doneAt).toISOString() : null,
    value_text: status === 'done' ? draft.value || null : null,
    not_indicated_reason: status === 'not_indicated' ? draft.notIndicatedReason || null : null,
    therapy_id: status === 'done' && UUID.test(String(draft.therapyId || '')) ? draft.therapyId : null,
  }
  const eventType = status === 'pending' ? 'step_cleared' : 'step_recorded'
  if (isDemo) {
    const target = demoRun(run.id)
    if (!target) throw new Error('Protocol not found')
    const step = { key: draft.key, status, doneAt: row.done_at, value: row.value_text || '', notIndicatedReason: row.not_indicated_reason || '', therapyId: draft.therapyId || null, recordedByName: actor?.name || 'Demo user', recordedAt: nowIso() }
    target.steps = [...(target.steps || []).filter(item => item.key !== draft.key), step]
    demoEvent(target, actor, { type: eventType, stepKey: draft.key, detail: { status } })
    return clone(target)
  }
  assertCloud(organizationId)
  const actorId = await currentUserId()
  const { error } = await supabase.from('clinical_protocol_steps').upsert(
    { organization_id: organizationId as string, run_id: run.id, step_key: draft.key, ...row, recorded_by: actorId, recorded_by_name: actor?.name || null, updated_by: actorId, updated_at: nowIso() },
    { onConflict: 'run_id,step_key' },
  )
  if (error) throw error
  await appendEvent(organizationId, run.id, actor, { type: eventType, stepKey: draft.key, detail: { status } })
  return null
}

interface ChangeRecognitionTimeOptions {
  isDemo?: boolean
  actor?: ProtocolActor | null
}
// The recognition time changes only with a reason, which stays in the history.
export async function changeRecognitionTime(organizationId: string | null | undefined, run: ProtocolRun, draft: RecognitionTimeDraft, { isDemo = false, actor = null }: ChangeRecognitionTimeOptions = {}) {
  if (!String(draft.reason || '').trim()) throw new Error('A reason is required')
  const detail = { from: run.recognizedAt, to: new Date(draft.recognizedAt).toISOString() }
  if (isDemo) {
    const target = demoRun(run.id)
    target.recognizedAt = detail.to
    if (draft.weightKg !== undefined) target.weightKg = draft.weightKg
    demoEvent(target, actor, { type: 'recognition_changed', detail, reason: draft.reason })
    return clone(target)
  }
  assertCloud(organizationId)
  const actorId = await currentUserId()
  const { error } = await supabase
    .from('clinical_protocol_runs')
    .update({ recognized_at: detail.to, updated_by: actorId, updated_at: nowIso() })
    .eq('organization_id', organizationId as string)
    .eq('id', run.id)
  if (error) throw error
  await appendEvent(organizationId, run.id, actor, { type: 'recognition_changed', detail, reason: draft.reason })
  return null
}

interface SetProtocolWeightOptions {
  isDemo?: boolean
  actor?: ProtocolActor | null
}
export async function setProtocolWeight(organizationId: string | null | undefined, run: ProtocolRun, weightKg: number | null, { isDemo = false, actor = null }: SetProtocolWeightOptions = {}) {
  if (isDemo) {
    const target = demoRun(run.id)
    target.weightKg = weightKg
    demoEvent(target, actor, { type: 'weight_changed', detail: { weightKg } })
    return clone(target)
  }
  assertCloud(organizationId)
  const actorId = await currentUserId()
  const { error } = await supabase.from('clinical_protocol_runs').update({ weight_kg: weightKg, updated_by: actorId, updated_at: nowIso() }).eq('organization_id', organizationId as string).eq('id', run.id)
  if (error) throw error
  await appendEvent(organizationId, run.id, actor, { type: 'weight_changed', detail: { weightKg } })
  return null
}

interface FinishProtocolRunOptions {
  isDemo?: boolean
  actor?: ProtocolActor | null
}
// completed: every step recorded; closed: ended early, with a reason.
export async function finishProtocolRun(organizationId: string | null | undefined, run: ProtocolRun, { status, reason = '' }: ProtocolFinishDraft, { isDemo = false, actor = null }: FinishProtocolRunOptions = {}) {
  if (!['completed', 'closed'].includes(status)) throw new Error('Unknown status')
  if (isDemo) {
    const target = demoRun(run.id)
    Object.assign(target, { status, completedAt: nowIso(), completedByName: actor?.name || 'Demo user', closeReason: reason })
    demoEvent(target, actor, { type: status, reason })
    return clone(target)
  }
  assertCloud(organizationId)
  const actorId = await currentUserId()
  const { error } = await supabase
    .from('clinical_protocol_runs')
    .update({ status, completed_at: nowIso(), completed_by: actorId, completed_by_name: actor?.name || null, close_reason: reason || null, updated_by: actorId, updated_at: nowIso() })
    .eq('organization_id', organizationId as string)
    .eq('id', run.id)
  if (error) throw error
  await appendEvent(organizationId, run.id, actor, { type: status, reason })
  return null
}

interface LoadTherapyReviewsOptions {
  isDemo?: boolean
}
// Reviews of the therapies of one episode, newest first.
export async function loadTherapyReviews(organizationId: string | null | undefined, therapies: AntimicrobialTherapy[] = [], { isDemo = false }: LoadTherapyReviewsOptions = {}): Promise<TherapyReview[]> {
  const ids = therapies.map(therapy => therapy.id).filter(Boolean)
  if (!ids.length) return []
  if (isDemo) {
    const starts = new Map(therapies.map(therapy => [String(therapy.id), therapyStart(therapy)]))
    return demoTherapyReviews
      .filter(row => starts.has(String(row.therapyId)))
      .map(row => ({ ...row, reviewedAt: row.reviewedAt || (starts.get(String(row.therapyId)) ? new Date(starts.get(String(row.therapyId))!.getTime() + (row.hoursAfterStart || 0) * 3600000).toISOString() : nowIso()) }))
      .sort((a, b) => new Date(b.reviewedAt).getTime() - new Date(a.reviewedAt).getTime())
  }
  assertCloud()
  const cloudIds = ids.filter(id => UUID.test(String(id)))
  if (!organizationId || !cloudIds.length) return []
  const { data, error } = await supabase
    .from('antimicrobial_therapy_reviews')
    .select('*')
    .eq('organization_id', organizationId as string)
    .in('therapy_id', cloudIds)
    .order('reviewed_at', { ascending: false })
  if (error) throw error
  return (data || []).map(mapReview)
}

interface CreateTherapyReviewOptions {
  isDemo?: boolean
  actor?: ProtocolActor | null
}
export async function createTherapyReview(organizationId: string | null | undefined, record: ClinicalCaseLike, therapy: AntimicrobialTherapy, draft: TherapyReviewDraft, { isDemo = false, actor = null }: CreateTherapyReviewOptions = {}) {
  if (!draft.decision || !draft.reasons?.length) throw new Error('Decision and reason are required')
  if (isDemo) {
    const row = { id: demoId('REVW'), therapyId: therapy.id, caseId: record.id, decision: draft.decision, reasons: [...draft.reasons], note: draft.note || '', newRegimen: draft.newRegimen || '', reviewedAt: nowIso(), reviewerName: actor?.name || 'Demo user', reviewerJobTitle: actor?.jobTitle || '' }
    demoTherapyReviews.unshift(row)
    return clone(row)
  }
  assertCloud(organizationId)
  const actorId = await currentUserId()
  const { data, error } = await supabase
    .from('antimicrobial_therapy_reviews')
    .insert({
      organization_id: organizationId as string,
      // A therapy on screen always has its id.
      therapy_id: therapy.id as string,
      surveillance_case_id: caseKey(record),
      decision: draft.decision,
      reasons: draft.reasons,
      note: draft.note || null,
      new_regimen: draft.newRegimen || null,
      reviewed_by: actorId,
      reviewer_name: actor?.name || null,
      reviewer_job_title: actor?.jobTitle || null,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapReview(data)
}
