import { loadSnapshot, saveSnapshot } from '../../core/data/repository'

const seed = [
  { id: 'PPS-2503', surveyDate: '2025-03-12', departmentId: '', departmentEl: '', patientsTotal: 172, patientsWithHai: 15, patientsOnAntibiotics: 51, responsibleName: 'ΕΝΛ', notes: 'Αρχική μέτρηση επιπολασμού πριν την εντατικοποίηση των μέτρων IPC.', createdAt: '2025-03-12T10:00:00', createdById: 'demo-user' },
  { id: 'PPS-2506', surveyDate: '2025-06-14', departmentId: '', departmentEl: '', patientsTotal: 176, patientsWithHai: 14, patientsOnAntibiotics: 49, responsibleName: 'ΕΝΛ', notes: '', createdAt: '2025-06-14T10:00:00', createdById: 'demo-user' },
  { id: 'PPS-2509', surveyDate: '2025-09-13', departmentId: '', departmentEl: '', patientsTotal: 181, patientsWithHai: 13, patientsOnAntibiotics: 50, responsibleName: 'ΕΝΛ', notes: '', createdAt: '2025-09-13T10:00:00', createdById: 'demo-user' },
  { id: 'PPS-2512', surveyDate: '2025-12-11', departmentId: '', departmentEl: '', patientsTotal: 175, patientsWithHai: 12, patientsOnAntibiotics: 48, responsibleName: 'ΕΝΛ', notes: 'Έναρξη δέσμης μέτρων πρόληψης CLABSI/CAUTI στη ΜΕΘ.', createdAt: '2025-12-11T10:00:00', createdById: 'demo-user' },
  { id: 'PPS-2603', surveyDate: '2026-03-14', departmentId: '', departmentEl: '', patientsTotal: 178, patientsWithHai: 11, patientsOnAntibiotics: 47, responsibleName: 'ΕΝΛ', notes: '', createdAt: '2026-03-14T10:00:00', createdById: 'demo-user' },
  { id: 'PPS-2606', surveyDate: '2026-06-13', departmentId: '', departmentEl: '', patientsTotal: 183, patientsWithHai: 10, patientsOnAntibiotics: 47, responsibleName: 'ΕΝΛ', notes: '', createdAt: '2026-06-13T10:00:00', createdById: 'demo-user' },
  { id: 'PPS-2609', surveyDate: '2026-09-15', departmentId: '', departmentEl: '', patientsTotal: 180, patientsWithHai: 9, patientsOnAntibiotics: 46, responsibleName: 'ΕΝΛ', notes: 'Συνεχιζόμενη πτωτική τάση επιπολασμού HAI.', createdAt: '2026-09-15T10:00:00', createdById: 'demo-user' },
]

export function loadPrevalenceSurveyLocal() { const rows = loadSnapshot('management_prevalence_survey', structuredClone(seed)); return Array.isArray(rows) ? rows : structuredClone(seed) }
export function savePrevalenceSurveyLocal(rows) { return saveSnapshot('management_prevalence_survey', rows) }
