import { loadSnapshot, saveSnapshot } from '../../core/data/repository'

const seed = [
  { id: 'HSS-2601', effectiveDate: '2026-01-01', totalBeds: 320, icuBeds: 24, singleRooms: 48, infectionControlNurses: 3, infectiousDiseasePhysicians: 1, microbiologists: 2, notes: '', createdAt: '2026-01-01T09:00:00', createdById: 'demo-user' },
]

export function loadHospitalStructureLocal() { const rows = loadSnapshot('management_hospital_structure', structuredClone(seed)); return Array.isArray(rows) ? rows : structuredClone(seed) }
export function saveHospitalStructureLocal(rows) { return saveSnapshot('management_hospital_structure', rows) }
