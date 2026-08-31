import { loadSnapshot, saveSnapshot } from '../../core/data/repository'
import { occupationalVisits, employeeVaccinations, employeeTraining, employeeEvaluations, employeeCertificates } from './employeeDemoData'

export const loadOccupationalVisits=()=>loadSnapshot('employee_health_visits',occupationalVisits)
export const loadVaccinations=()=>loadSnapshot('employee_vaccine_records',employeeVaccinations)
export const loadEmployeeTraining=()=>loadSnapshot('employee_training_summary',employeeTraining)
export const loadEvaluations=()=>loadSnapshot('employee_evaluations',employeeEvaluations)
export const loadCertificates=()=>loadSnapshot('employee_certificates',employeeCertificates)
export const saveCertificates=rows=>saveSnapshot('employee_certificates',rows)
