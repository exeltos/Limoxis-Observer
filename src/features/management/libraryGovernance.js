export const HOSPITAL_MANAGED_LIBRARY_KEYS=Object.freeze([
  'departments',
  'positions',
])

export const SYSTEM_BASELINE_LIBRARY_KEYS=Object.freeze([
  'microorganisms',
  'antibiotics',
  'notifiableDiseases',
  'sampleTypes',
  'professionalCategories',
  'vaccines',
  'wasteTypes',
  'antiseptics',
  'isolationTypes',
  'controlTypes',
  'documentCategories',
  'deviceTypes',
  'surveillanceDefinitions',
])

export function isHospitalManagedLibraryKey(key){
  return HOSPITAL_MANAGED_LIBRARY_KEYS.includes(key)
}
