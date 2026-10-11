import { loadSnapshot, saveSnapshot } from '../../core/data/repository'
import { shiftDemoDatesInPlace } from '../../core/data/demoClock'

// Quarterly point-prevalence surveys, dated in the Demo's authored frame and
// moved forward to today like the other Demo fixtures (src/core/data/demoClock.js).
const seed = [
  { id: 'PPS-2502', surveyDate: '2025-02-12', departmentId: '', departmentEl: '', patientsTotal: 172, patientsWithHai: 15, patientsOnAntibiotics: 51, responsibleName: 'ΕΝΛ', notes: 'Αρχική μέτρηση επιπολασμού πριν την εντατικοποίηση των μέτρων IPC.', createdAt: '2025-02-12T10:00:00', createdById: 'demo-user' },
  { id: 'PPS-2505', surveyDate: '2025-05-14', departmentId: '', departmentEl: '', patientsTotal: 176, patientsWithHai: 14, patientsOnAntibiotics: 49, responsibleName: 'ΕΝΛ', notes: '', createdAt: '2025-05-14T10:00:00', createdById: 'demo-user' },
  { id: 'PPS-2508', surveyDate: '2025-08-13', departmentId: '', departmentEl: '', patientsTotal: 181, patientsWithHai: 13, patientsOnAntibiotics: 50, responsibleName: 'ΕΝΛ', notes: '', createdAt: '2025-08-13T10:00:00', createdById: 'demo-user' },
  { id: 'PPS-2511', surveyDate: '2025-11-12', departmentId: '', departmentEl: '', patientsTotal: 175, patientsWithHai: 12, patientsOnAntibiotics: 48, responsibleName: 'ΕΝΛ', notes: 'Έναρξη δέσμης μέτρων πρόληψης CLABSI/CAUTI στη ΜΕΘ.', createdAt: '2025-11-12T10:00:00', createdById: 'demo-user' },
  { id: 'PPS-2602', surveyDate: '2026-02-11', departmentId: '', departmentEl: '', patientsTotal: 178, patientsWithHai: 11, patientsOnAntibiotics: 47, responsibleName: 'ΕΝΛ', notes: '', createdAt: '2026-02-11T10:00:00', createdById: 'demo-user' },
  { id: 'PPS-2605', surveyDate: '2026-05-13', departmentId: '', departmentEl: '', patientsTotal: 183, patientsWithHai: 10, patientsOnAntibiotics: 47, responsibleName: 'ΕΝΛ', notes: '', createdAt: '2026-05-13T10:00:00', createdById: 'demo-user' },
  { id: 'PPS-2608', surveyDate: '2026-08-12', departmentId: '', departmentEl: '', patientsTotal: 180, patientsWithHai: 9, patientsOnAntibiotics: 46, responsibleName: 'ΕΝΛ', notes: 'Συνεχιζόμενη πτωτική τάση επιπολασμού HAI.', createdAt: '2026-08-12T10:00:00', createdById: 'demo-user' },
]
shiftDemoDatesInPlace([seed])

export function loadPrevalenceSurveyLocal() { const rows = loadSnapshot('management_prevalence_survey', structuredClone(seed)); return Array.isArray(rows) ? rows : structuredClone(seed) }
export function savePrevalenceSurveyLocal(rows) { return saveSnapshot('management_prevalence_survey', rows) }
