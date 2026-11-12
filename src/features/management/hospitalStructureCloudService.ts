import { supabase } from '../../core/supabase/client'
import { isDemoDataEnvironment } from '../../core/data/dataEnvironment'
import { loadHospitalStructureLocal, saveHospitalStructureLocal } from './hospitalStructureStore'

const assertCloud = organizationId => {
  if (!supabase) throw new Error('Supabase is not configured.')
  if (!organizationId) throw new Error('Organization is required.')
}

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  const id = data?.user?.id
  if (!id) throw new Error('Authenticated user is required.')
  return id
}

function mapRow(row) {
  return {
    id: row.id,
    effectiveDate: row.effective_date,
    totalBeds: row.total_beds,
    icuBeds: row.icu_beds,
    singleRooms: row.single_rooms,
    infectionControlNurses: row.infection_control_nurses,
    infectiousDiseasePhysicians: row.infectious_disease_physicians,
    microbiologists: row.microbiologists,
    notes: row.notes || '',
    createdAt: row.created_at,
    createdById: row.created_by,
  }
}

export async function loadHospitalStructureHistory(organizationId) {
  if (isDemoDataEnvironment()) return loadHospitalStructureLocal()
  assertCloud(organizationId)
  const { data, error } = await supabase.from('hospital_structure_snapshots').select('*').eq('organization_id', organizationId).order('effective_date', { ascending: false })
  if (error) throw error
  return (data || []).map(mapRow)
}

export async function saveHospitalStructureSnapshot(organizationId, record) {
  if (isDemoDataEnvironment()) {
    const rows = loadHospitalStructureLocal()
    const saved = { id: `HSS-${Date.now()}`, ...record, createdAt: new Date().toISOString(), createdById: 'demo-user' }
    saveHospitalStructureLocal([saved, ...rows])
    return saved
  }
  assertCloud(organizationId)
  const userId = await currentUserId()
  const payload = {
    organization_id: organizationId,
    effective_date: record.effectiveDate,
    total_beds: record.totalBeds === '' || record.totalBeds == null ? null : Number(record.totalBeds),
    icu_beds: record.icuBeds === '' || record.icuBeds == null ? null : Number(record.icuBeds),
    single_rooms: record.singleRooms === '' || record.singleRooms == null ? null : Number(record.singleRooms),
    infection_control_nurses: record.infectionControlNurses === '' || record.infectionControlNurses == null ? null : Number(record.infectionControlNurses),
    infectious_disease_physicians: record.infectiousDiseasePhysicians === '' || record.infectiousDiseasePhysicians == null ? null : Number(record.infectiousDiseasePhysicians),
    microbiologists: record.microbiologists === '' || record.microbiologists == null ? null : Number(record.microbiologists),
    notes: record.notes || null,
    created_by: userId,
  }
  const { data, error } = await supabase.from('hospital_structure_snapshots').insert(payload).select('*').single()
  if (error) throw error
  return mapRow(data)
}

export async function deleteHospitalStructureSnapshot(organizationId, id) {
  if (isDemoDataEnvironment()) {
    saveHospitalStructureLocal(loadHospitalStructureLocal().filter(row => row.id !== id))
    return
  }
  assertCloud(organizationId)
  if (!id) return
  const { error } = await supabase.from('hospital_structure_snapshots').delete().eq('organization_id', organizationId).eq('id', id)
  if (error) throw error
}
