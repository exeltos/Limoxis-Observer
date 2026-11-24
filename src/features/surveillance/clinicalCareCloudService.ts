import { supabase as configuredClient, type Cloud } from '../../core/supabase/client'
import { assertCloud, currentUserId } from '../../core/supabase/cloudContext'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ISOLATION_SELECT, iso, mapAdministration, mapDevice, mapIsolation, mapTherapy, textList } from './clinicalCloudMappers'
import type { AdministrationDraft, ClinicalCase, DeviceDraft, DeviceRemovalDraft, IsolationDraft, IsolationEndDraft, TherapyDraft, TherapyEndDraft } from './clinicalTypes'

// Isolation, antimicrobial therapy and devices of a clinical case (split from clinicalCloudService).
// The calls below run with a configured client: the demo and an unconfigured build return before them.
const supabase = configuredClient as Cloud

// Rows of a list in their order, for a parent record.
export async function insertListRows(table: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return []
  // The list table is chosen by the caller (no row types for it).
  const supabase = configuredClient as unknown as SupabaseClient
  const { data, error } = await supabase.from(table).insert(rows).select('*')
  if (error) throw error
  return data || []
}

export async function startIsolation(organizationId: string | null | undefined, record: ClinicalCase, draft: IsolationDraft) {
  assertCloud()
  const actorId = await currentUserId()
  const { data, error } = await supabase
    .from('isolation_episodes')
    .insert({
      organization_id: organizationId as string,
      patient_id: record.patientRecordId as string,
      surveillance_case_id: record.recordId as string,
      department_id: record.departmentId || null,
      room: draft.room || null,
      reason: draft.reason,
      started_at: iso(draft.startedAt || new Date())!,
      review_due_at: iso(draft.reviewDue),
      status: 'active',
      created_by: actorId,
    })
    .select('*')
    .single()
  if (error) throw error
  const precautionRows = await insertListRows(
    'isolation_episode_precautions',
    textList(draft.precautions).map((precaution, index) => ({
      organization_id: organizationId as string,
      isolation_episode_id: data.id,
      position: index + 1,
      precaution,
      created_by: actorId,
    })),
  )
  return mapIsolation({ ...data, precaution_rows: precautionRows })
}

export async function endIsolation(organizationId: string | null | undefined, isolationId: string | undefined, draft: IsolationEndDraft = {}) {
  assertCloud()
  const actorId = await currentUserId()
  const { data, error } = await supabase
    .from('isolation_episodes')
    .update({
      status: draft.status || 'ended',
      ended_at: iso(draft.endedAt || new Date())!,
      end_reason: draft.reason || null,
      ended_by: actorId,
      updated_by: actorId,
      updated_at: iso(new Date()),
    })
    .eq('organization_id', organizationId as string)
    .eq('id', isolationId as string)
    .select(ISOLATION_SELECT)
    .single()
  if (error) throw error
  return mapIsolation(data)
}

export async function addAntimicrobialTherapy(organizationId: string | null | undefined, record: ClinicalCase, draft: TherapyDraft) {
  assertCloud()
  const actorId = await currentUserId()
  const approvalStatus = draft.isAdvancedAntibiotic
    ? 'pending'
    : draft.approvalStatus || 'not_required'
  const { data, error } = await supabase
    .from('antimicrobial_therapies')
    .insert({
      organization_id: organizationId as string,
      patient_id: record.patientRecordId as string,
      surveillance_case_id: record.recordId,
      antimicrobial: draft.antimicrobial,
      dose: draft.dose || null,
      route: draft.route || null,
      indication: draft.indication || null,
      started_at: iso(draft.startedAt || new Date())!,
      planned_end_at: iso(draft.plannedEndAt),
      approval_status: approvalStatus,
      status: 'active',
      therapy_plan_id: draft.therapyPlanId || crypto.randomUUID(),
      created_by: actorId,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapTherapy(data)
}

export async function endAntimicrobialTherapy(organizationId: string | null | undefined, therapyId: string, draft: TherapyEndDraft = {}) {
  assertCloud()
  const actorId = await currentUserId()
  const { data, error } = await supabase
    .from('antimicrobial_therapies')
    .update({
      status: draft.status || 'completed',
      ended_at: iso(draft.endedAt || new Date())!,
      updated_by: actorId,
      updated_at: iso(new Date()),
    })
    .eq('organization_id', organizationId as string)
    .eq('id', therapyId)
    .select('*')
    .single()
  if (error) throw error
  return mapTherapy(data)
}

export async function setTherapyApproval(organizationId: string | null | undefined, therapyId: string, approvalStatus: string) {
  assertCloud()
  const actorId = await currentUserId()
  const { data, error } = await supabase
    .from('antimicrobial_therapies')
    .update({ approval_status: approvalStatus, updated_by: actorId, updated_at: iso(new Date()) })
    .eq('organization_id', organizationId as string)
    .eq('id', therapyId)
    .select('*')
    .single()
  if (error) throw error
  return mapTherapy(data)
}

export async function recordTherapyAdministration(organizationId: string | null | undefined, therapyId: string, draft: AdministrationDraft = {}) {
  assertCloud()
  const actorId = await currentUserId()
  const { data, error } = await supabase
    .from('antimicrobial_therapy_administrations')
    .insert({
      organization_id: organizationId as string,
      therapy_id: therapyId,
      administered_at: iso(draft.administeredAt || new Date())!,
      dose: draft.dose || null,
      route: draft.route || null,
      status: draft.status || 'administered',
      withheld_reason: draft.withheldReason || null,
      administered_by: actorId,
      notes: draft.notes || null,
      created_by: actorId,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapAdministration(data)
}

export async function addSurveillanceDevice(organizationId: string | null | undefined, record: ClinicalCase, draft: DeviceDraft) {
  assertCloud()
  const actorId = await currentUserId()
  const { data, error } = await supabase
    .from('surveillance_devices')
    .insert({
      organization_id: organizationId as string,
      surveillance_case_id: record.recordId as string,
      patient_id: record.patientRecordId as string,
      department_id: record.departmentId || null,
      device_type: draft.type,
      site: draft.site || null,
      indication: draft.indication || null,
      inserted_at: iso(draft.insertedAt || new Date())!,
      review_due_at: iso(draft.reviewDue),
      status: 'active',
      created_by: actorId,
    })
    .select('*')
    .single()
  if (error) throw error
  return mapDevice(data)
}

export async function removeSurveillanceDevice(organizationId: string | null | undefined, deviceId: string, draft: DeviceRemovalDraft = {}) {
  assertCloud()
  const actorId = await currentUserId()
  const { data, error } = await supabase
    .from('surveillance_devices')
    .update({
      status: 'removed',
      removed_at: iso(draft.removedAt || new Date())!,
      updated_by: actorId,
      updated_at: iso(new Date()),
    })
    .eq('organization_id', organizationId as string)
    .eq('id', deviceId)
    .select('*')
    .single()
  if (error) throw error
  return mapDevice(data)
}
