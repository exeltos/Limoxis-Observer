import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readSource } from './readSource'

// Resolved without the global URL, which is jsdom's in jsdom test files.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

// The patient clinical record page is split across PatientClinicalCanonicalPage.jsx
// and the modules below; source-level assertions read them as one text.
export const PATIENT_CLINICAL_RECORD_FILES = [
  'src/features/surveillance/PatientClinicalCanonicalPage.jsx',
  'src/features/surveillance/ClinicalAdmissions.jsx',
  'src/features/surveillance/ClinicalSurveillanceWorkspace.jsx',
  'src/features/surveillance/ClinicalJourney.jsx',
  'src/features/surveillance/ClinicalJourneyCareStages.tsx',
  'src/features/surveillance/ClinicalJourneyWindows.tsx',
  'src/features/surveillance/ClinicalJourneyParts.jsx',
  'src/features/surveillance/clinicalRecordLabels.js',
  'src/features/surveillance/ClinicalRecordViews.jsx',
  'src/features/surveillance/ClinicalRecordDialogs.jsx',
]
export function readPatientClinicalRecordSource() {
  return PATIENT_CLINICAL_RECORD_FILES.map(file => readSource(path.join(root, file))).join('\n')
}
