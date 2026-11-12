import { readSource } from './readSource'

// Large Surveillance files were split into cohesive parts (TypeScript migration);
// source-level assertions read a split file together with its parts as one text.
const S = 'src/features/surveillance/'
export const SURVEILLANCE_SPLITS = {
  [`${S}clinicalCloudService`]: [`${S}clinicalCloudMappers.ts`],
  [`${S}PatientClinicalCanonicalPage`]: [`${S}PatientClinicalRecordTabs.tsx`],
  [`${S}ClinicalJourney`]: [`${S}ClinicalJourneyCareStages.tsx`, `${S}ClinicalJourneyWindows.tsx`],
}

const stem = file => String(file).replace(/\.(js|jsx|ts|tsx)$/, '')

export function readSplitSource(file) {
  return [file, ...(SURVEILLANCE_SPLITS[stem(file)] || [])].map(part => readSource(part)).join('\n')
}
