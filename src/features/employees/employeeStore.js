import { employeeRows as seedEmployees } from './employeeDemoData'
import { loadSnapshot, saveSnapshot } from '../../core/data/repository'
export function loadEmployees(){const rows=loadSnapshot('employees',structuredClone(seedEmployees));return Array.isArray(rows)?rows:structuredClone(seedEmployees)}
export function saveEmployees(rows){return saveSnapshot('employees',rows)}
