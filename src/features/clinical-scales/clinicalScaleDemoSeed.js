// Demo clinical scale assessments per patient. Answers are clinical scenarios;
// score, parts and interpretation are computed by the real scale engine so the
// demo shows exactly what a user would get when recording them.
import { patientDemoData } from '../patients/patientDemoData'
import { demoClinicalScaleDefinitions } from './clinicalScaleDemoDefinitions'
import { calculateClinicalScale } from './clinicalScaleEngine'

const SCENARIOS = {
  icu: [
    { key: 'news2', day: 0, time: '08:30', answers: { respiratoryRate: 26, spo2: 91, supplementalOxygen: true, systolicBp: 96, pulse: 118, temperature: 38.9, newConfusion: false } },
    { key: 'gcs', day: 0, time: '09:00', answers: { eye: 3, verbal: 4, motor: 6 } },
    { key: 'braden', day: 1, time: '10:00', answers: { sensoryPerception: 2, moisture: 2, activity: 1, mobility: 2, nutrition: 2, frictionShear: 1 } },
    { key: 'news2', day: 2, time: '08:30', answers: { respiratoryRate: 22, spo2: 94, supplementalOxygen: true, systolicBp: 108, pulse: 104, temperature: 38.1, newConfusion: false } },
  ],
  ward: [
    { key: 'news2', day: 0, time: '09:15', answers: { respiratoryRate: 21, spo2: 95, supplementalOxygen: false, systolicBp: 112, pulse: 96, temperature: 38.4, newConfusion: false } },
    { key: 'morse', day: 0, time: '11:00', answers: { fallHistory: 25, secondaryDiagnosis: 15, ambulatoryAid: 15, ivTherapy: 20, gait: 10, mentalStatus: 0 } },
    { key: 'braden', day: 1, time: '10:30', answers: { sensoryPerception: 3, moisture: 3, activity: 3, mobility: 3, nutrition: 3, frictionShear: 2 } },
    { key: 'news2', day: 3, time: '09:15', answers: { respiratoryRate: 18, spo2: 97, supplementalOxygen: false, systolicBp: 124, pulse: 84, temperature: 37.2, newConfusion: false } },
  ],
  surgical: [
    { key: 'news2', day: 0, time: '07:45', answers: { respiratoryRate: 19, spo2: 96, supplementalOxygen: false, systolicBp: 118, pulse: 92, temperature: 38.2, newConfusion: false } },
    { key: 'morse', day: 0, time: '12:00', answers: { fallHistory: 0, secondaryDiagnosis: 15, ambulatoryAid: 15, ivTherapy: 20, gait: 10, mentalStatus: 0 } },
    { key: 'braden', day: 2, time: '10:00', answers: { sensoryPerception: 4, moisture: 3, activity: 3, mobility: 3, nutrition: 3, frictionShear: 2 } },
  ],
  neonatal: [
    { key: 'pediatric-gcs', day: 0, time: '10:00', answers: { eye: 4, verbal: 5, motor: 6 } },
    { key: 'humpty-dumpty', day: 1, time: '10:00', answers: { age: 4, diagnosis: 4, cognitiveImpairment: 3, environmentalFactors: 4, surgerySedationAnesthesia: 1 } },
    { key: 'pediatric-gcs', day: 4, time: '10:00', answers: { eye: 3, verbal: 4, motor: 5 } },
  ],
}
const ASSESSORS = [
  ['Ελένη Παπαδοπούλου', 'Νοσηλεύτρια ΜΕΘ'],
  ['Νικόλαος Δημητρίου', 'Ιατρός Παθολόγος'],
  ['Μαρία Κωνσταντίνου', 'Νοσηλεύτρια'],
]

function scenarioFor(patient) {
  const department = String(patient.department || '')
  if (department.includes('ΜΕΝΝ') || department.includes('Νεογν')) return SCENARIOS.neonatal
  if (department.includes('ΜΕΘ')) return SCENARIOS.icu
  if (department.includes('Χειρουργ') || department.includes('Ορθοπ')) return SCENARIOS.surgical
  return SCENARIOS.ward
}

function isoAt(date, dayOffset, time) {
  const base = new Date(`${String(date).slice(0, 10)}T${time}:00`)
  if (Number.isNaN(base.getTime())) return new Date().toISOString()
  base.setDate(base.getDate() + dayOffset)
  const now = new Date()
  return (base > now ? now : base).toISOString()
}

export function buildDemoScaleAssessments() {
  const definitions = new Map(demoClinicalScaleDefinitions.map(definition => [definition.scale_key, definition]))
  return patientDemoData.flatMap((patient, patientIndex) => {
    if (!patient.admissionDate) return []
    return scenarioFor(patient).map((item, index) => {
      const definition = definitions.get(item.key)
      if (!definition) return null
      const result = calculateClinicalScale(item.key, item.answers)
      if (!result?.complete) return null
      const [assessorName, assessorTitle] = ASSESSORS[(patientIndex + index) % ASSESSORS.length]
      const assessedAt = isoAt(patient.admissionDate, item.day, item.time)
      return {
        id: `DEMO-SCALE-${patient.id}-${index + 1}`,
        organization_id: 'demo-hospital',
        patient_id: patient.recordId || patient.id,
        admission_id: patient.admissionId || `ADM-${patient.id}`,
        scale_definition_id: definition.id,
        scale_key: definition.scale_key,
        scale_version: definition.version,
        assessed_at: assessedAt,
        answers: item.answers,
        score: result.score,
        score_parts: result.parts || {},
        interpretation: result.risk || null,
        status: 'final',
        assessor_name: assessorName,
        assessor_job_title: assessorTitle,
        assessor_email: null,
        scale: { name_el: definition.name_el, name_en: definition.name_en, category: definition.category },
        report_snapshot: { scaleNameEl: definition.name_el, scaleNameEn: definition.name_en, sourceAuthority: definition.source_authority, sourceReference: definition.source_reference, version: definition.version, score: result.score, parts: result.parts || {}, interpretation: result.risk || null, answers: item.answers, generatedAt: assessedAt },
      }
    }).filter(Boolean)
  })
}
