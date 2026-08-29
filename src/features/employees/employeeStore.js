import { employeeRows as seedEmployees } from './employeeDemoData'
import { loadSnapshot, saveSnapshot } from '../../core/data/repository'
export function loadEmployees(){const rows=loadSnapshot('employees',structuredClone(seedEmployees));return Array.isArray(rows)?rows:structuredClone(seedEmployees)}
export function saveEmployees(rows){return saveSnapshot('employees',rows)}
export function nextEmployeeId(rows){
  const max=rows.reduce((m,x)=>Math.max(m,Number(String(x.id||'').match(/EMP-(\d+)/)?.[1]||0)),0)
  return `EMP-${String(max+1).padStart(3,'0')}`
}
