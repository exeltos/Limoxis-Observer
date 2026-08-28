import { employeeRows as seedEmployees } from './employeeDemoData'
const KEY='limoxis.employees.v1'
export function loadEmployees(){
  try{const raw=localStorage.getItem(KEY);if(raw){const rows=JSON.parse(raw);if(Array.isArray(rows))return rows}}catch{}
  return structuredClone(seedEmployees)
}
export function saveEmployees(rows){try{localStorage.setItem(KEY,JSON.stringify(rows))}catch{}return rows}
export function nextEmployeeId(rows){
  const max=rows.reduce((m,x)=>Math.max(m,Number(String(x.id||'').match(/EMP-(\d+)/)?.[1]||0)),0)
  return `EMP-${String(max+1).padStart(3,'0')}`
}
