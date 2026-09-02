import { PatientClinicalRecordPage } from './PatientClinicalRecordPage'
import { PatientClinicalCloudRecordPage } from './PatientClinicalCloudRecordPage'
import { useTenant } from '../../core/tenant/TenantContext'

export function PatientClinicalRecordRoute({patientMode=false}){
  const {isDemo}=useTenant()
  return isDemo
    ? <PatientClinicalRecordPage patientMode={patientMode}/>
    : <PatientClinicalCloudRecordPage patientMode={patientMode}/>
}
