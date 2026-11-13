import { loadSnapshot, saveSnapshot } from '../../core/data/repository'
import { occupationalVisits, employeeVaccinations, employeeTraining, employeeEvaluations, employeeCertificates, employeeExposureIncidents } from './employeeDemoData'
// The visits, vaccinations and exposures are also read by Occupational Health with its own types.
import type { EmployeeCertificate, EmployeeEvaluation, EmployeeTraining } from './employeeTypes'

export const loadOccupationalVisits=()=>loadSnapshot('employee_health_visits',occupationalVisits)
export const saveOccupationalVisits=(rows: unknown)=>saveSnapshot('employee_health_visits',rows)
export const loadVaccinations=()=>loadSnapshot('employee_vaccine_records',employeeVaccinations)
export const saveVaccinations=(rows: unknown)=>saveSnapshot('employee_vaccine_records',rows)
export const loadEmployeeTraining=()=>loadSnapshot('employee_training_summary',employeeTraining) as EmployeeTraining[]
export const loadEvaluations=()=>loadSnapshot('employee_evaluations',employeeEvaluations) as EmployeeEvaluation[]
export const saveEvaluations=(rows: unknown)=>saveSnapshot('employee_evaluations',rows)
export const loadCertificates=()=>loadSnapshot('employee_certificates',employeeCertificates) as EmployeeCertificate[]
export const loadExposureIncidents=()=>loadSnapshot('occupational_exposure_incidents',employeeExposureIncidents)
export const saveExposureIncidents=(rows: unknown)=>saveSnapshot('occupational_exposure_incidents',rows)
