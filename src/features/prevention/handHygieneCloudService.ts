import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { deletePreventionRecord, findPreventionDepartment, loadPreventionDepartments, type PreventionOrgId } from './preventionCloud'
import {
  normalizeWhoMoments,
  observationWeight,
  whoStatsFromObservations,
} from './whoHandHygieneStats'
import { loadHandHygieneLocal, saveHandHygieneLocal } from './preventionStore'
import { assertCloud, cloudClient, currentUserId } from '../../core/supabase/cloudContext'
import type { AnyRecord } from '../../types/featureTypes'

function mapSession(row: AnyRecord) {
  const items = (row.observations_detail || [])
    .sort((a: AnyRecord, b: AnyRecord) => (a.sort_order || 0) - (b.sort_order || 0))
    .map((x: AnyRecord) => ({
      id: x.id,
      professionalsCount: x.professionals_count,
      professionalCategory: x.professional_category,
      moment: x.who_moment,
      moments:
        Array.isArray(x.who_moments) && x.who_moments.length
          ? x.who_moments
          : [x.who_moment].filter(Boolean),
      action: x.action,
      gloves: Boolean(x.gloves),
      notes: x.notes || '',
    }))
  const stats = whoStatsFromObservations(items)
  const department = row.department?.name || ''
  const professional = row.professional_category?.startsWith('Ιατ') ? 'medical' : 'nursing'
  return {
    id: row.id,
    date: row.observation_date,
    departmentEl: department,
    departmentEn: department,
    profession: professional,
    observations: Number(row.observations || stats.opportunities || 0),
    compliant: Number(row.compliant_observations || stats.compliant || 0),
    rate:
      Number(row.observations) > 0
        ? Number(
            ((Number(row.compliant_observations || 0) / Number(row.observations)) * 100).toFixed(1),
          )
        : stats.compliance,
    observer: row.observer_name || '',
    session: {
      department,
      date: row.observation_date,
      observer: row.observer_name || '',
      startTime: row.start_time || '',
      endTime: row.end_time || '',
    },
    whoObservations: items,
    whoStats: stats,
    lifecycleStatus: row.status === 'cancelled' ? 'voided' : 'active',
    createdAt: row.created_at,
    createdById: row.created_by,
    updatedAt: row.updated_at,
    updatedById: row.updated_by,
  }
}

export function loadHandHygieneDepartments(organizationId: PreventionOrgId) {
  return loadPreventionDepartments(organizationId)
}

export async function loadHandHygieneSessions(organizationId: PreventionOrgId): Promise<AnyRecord[]> {
  if (isDemoDataEnvironment()) return loadHandHygieneLocal()
  assertCloud(organizationId)
  const { data, error } = await cloudClient()
    .from('hand_hygiene_sessions')
    .select('*,department:departments(id,name),observations_detail:hand_hygiene_observations(*)')
    .eq('organization_id', organizationId as string)
    .order('observation_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(mapSession)
}

export async function saveHandHygieneSession(organizationId: PreventionOrgId, record: AnyRecord, { existingId = null }: { existingId?: string | null } = {}) {
  if (isDemoDataEnvironment()) {
    const rows = loadHandHygieneLocal()
    const id = existingId || `HH-${Date.now()}`
    const saved = { ...record, id, lifecycleStatus: 'active' }
    const next = existingId
      ? rows.map(row => (row.id === existingId ? saved : row))
      : [saved, ...rows]
    saveHandHygieneLocal(next)
    return saved
  }
  assertCloud(organizationId)
  const userId = await currentUserId()
  const department = await findPreventionDepartment(
    organizationId,
    record.departmentEl || record.session?.department || '',
  )
  const items: AnyRecord[] = record.whoObservations || []
  if (!items.length) throw new Error('At least one WHO observation is required.')
  if (items.some(item => !normalizeWhoMoments(item).length))
    throw new Error('Each WHO opportunity requires at least one indication.')
  const stats = whoStatsFromObservations(items)
  const payload = {
    organization_id: organizationId as string,
    department_id: department.id,
    observation_date: record.date || record.session?.date,
    professional_category: items[0]?.professionalCategory || null,
    observations: stats.opportunities,
    compliant_observations: stats.compliant,
    observer_id: userId,
    observer_name: record.observer || record.session?.observer || '',
    source_standard: 'WHO',
    source_version: 'WHO 5 Moments',
    status: 'completed',
    start_time: record.session?.startTime || null,
    end_time: record.session?.endTime || null,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  }
  let session
  if (existingId) {
    const { data, error } = await cloudClient()
      .from('hand_hygiene_sessions')
      .update(payload)
      .eq('organization_id', organizationId as string)
      .eq('id', existingId)
      .select('*')
      .single()
    if (error) throw error
    session = data
    const { error: deleteError } = await cloudClient()
      .from('hand_hygiene_observations')
      .delete()
      .eq('organization_id', organizationId as string)
      .eq('session_id', existingId)
    if (deleteError) throw deleteError
  } else {
    const { data, error } = await cloudClient()
      .from('hand_hygiene_sessions')
      .insert({ ...payload, created_by: userId })
      .select('*')
      .single()
    if (error) throw error
    session = data
  }
  const observationRows = items.map((item, index) => {
    const moments = normalizeWhoMoments(item)
    return {
      session_id: session.id,
      organization_id: organizationId as string,
      professional_category: item.professionalCategory || 'Άλλο',
      professionals_count: observationWeight(item),
      who_moment: moments[0],
      who_moments: moments,
      action: item.action,
      gloves: Boolean(item.gloves),
      notes: item.notes || null,
      sort_order: index,
    }
  })
  const { error: observationsError } = await cloudClient()
    .from('hand_hygiene_observations')
    .insert(observationRows)
  if (observationsError) throw observationsError
  const rows = await loadHandHygieneSessions(organizationId)
  return rows.find(x => x.id === session.id) || null
}

export function deleteHandHygieneSession(organizationId: PreventionOrgId, id: string | null | undefined) {
  return deletePreventionRecord(organizationId, id, { table: 'hand_hygiene_sessions', localTable: 'prevention_hand_hygiene', label: 'Υγιεινή χεριών', loadLocal: loadHandHygieneLocal, saveLocal: saveHandHygieneLocal, children: [{ table: 'hand_hygiene_observations', column: 'session_id' }] })
}
