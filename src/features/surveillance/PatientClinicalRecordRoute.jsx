import { PatientClinicalCanonicalPage } from './PatientClinicalCanonicalPage'

export function PatientClinicalRecordRoute({patientMode=false}){
  return <PatientClinicalCanonicalPage patientMode={patientMode}/>
}
