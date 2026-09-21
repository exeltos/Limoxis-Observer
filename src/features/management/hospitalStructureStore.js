import { loadSnapshot, saveSnapshot } from '../../core/data/repository'

const seed = [
  { id: 'HSS-2401', effectiveDate: '2024-01-01', totalBeds: 310, icuBeds: 20, singleRooms: 40, infectionControlNurses: 2, infectiousDiseasePhysicians: 1, microbiologists: 1, notes: 'Αρχική καταγραφή δομικών δεικτών.', createdAt: '2024-01-01T09:00:00', createdById: 'demo-user' },
  { id: 'HSS-2501', effectiveDate: '2025-01-01', totalBeds: 314, icuBeds: 22, singleRooms: 44, infectionControlNurses: 3, infectiousDiseasePhysicians: 1, microbiologists: 1, notes: 'Πρόσληψη 2ης νοσηλεύτριας επιτήρησης λοιμώξεων.', createdAt: '2025-01-01T09:00:00', createdById: 'demo-user' },
  { id: 'HSS-2601', effectiveDate: '2026-01-01', totalBeds: 320, icuBeds: 24, singleRooms: 48, infectionControlNurses: 3, infectiousDiseasePhysicians: 1, microbiologists: 2, notes: 'Επέκταση ΜΕΘ κατά 2 κλίνες, πρόσληψη 2ου μικροβιολόγου.', createdAt: '2026-01-01T09:00:00', createdById: 'demo-user' },
]

export function loadHospitalStructureLocal() { const rows = loadSnapshot('management_hospital_structure', structuredClone(seed)); return Array.isArray(rows) ? rows : structuredClone(seed) }
export function saveHospitalStructureLocal(rows) { return saveSnapshot('management_hospital_structure', rows) }
