import { loadSnapshot, saveSnapshot } from '../../core/data/repository'

const seed = [
  { id: 'PPS-2609', surveyDate: '2026-09-15', departmentId: '', departmentEl: '', patientsTotal: 180, patientsWithHai: 9, patientsOnAntibiotics: 46, responsibleName: 'ΕΝΛ', notes: '', createdAt: '2026-09-15T10:00:00', createdById: 'demo-user' },
]

export function loadPrevalenceSurveyLocal() { const rows = loadSnapshot('management_prevalence_survey', structuredClone(seed)); return Array.isArray(rows) ? rows : structuredClone(seed) }
export function savePrevalenceSurveyLocal(rows) { return saveSnapshot('management_prevalence_survey', rows) }
