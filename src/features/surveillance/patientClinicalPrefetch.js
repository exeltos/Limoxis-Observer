const cache=new Map()

export function setPatientClinicalPrefetch(patientId,data){cache.set(String(patientId),{...data,createdAt:Date.now()})}
export function takePatientClinicalPrefetch(patientId,maxAgeMs=30000){const key=String(patientId);const value=cache.get(key);cache.delete(key);return value&&Date.now()-value.createdAt<=maxAgeMs?value:null}
