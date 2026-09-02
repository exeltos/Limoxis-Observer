export const HOSPITAL_MANAGED_LIBRARY_KEYS=Object.freeze([
  'departments',
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
])

export const SPECIAL_GOVERNANCE_LIBRARY_KEYS=Object.freeze([
  'environmentalProtocols',
])

export function isHospitalManagedLibraryKey(key){
  return HOSPITAL_MANAGED_LIBRARY_KEYS.includes(key)
}

export function isSystemBaselineLibraryKey(key){
  return SYSTEM_BASELINE_LIBRARY_KEYS.includes(key)
}
