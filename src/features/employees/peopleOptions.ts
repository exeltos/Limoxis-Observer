// People picked as responsible on a record (a control, a quality record): an
// employee, linked to a user account when there is one, as {employeeId,name,
// nameEn,userId}. Controls keep the person in the definition's metadata and its
// account in control_definitions.owner_id; Quality keeps the names in
// owner_labels and the first account in owner_id.
import type { Employee } from './employeeTypes'

// The names of an employee (Greek and English).
type EmployeeNames = Partial<Pick<Employee, 'firstName' | 'firstNameEn' | 'lastName' | 'lastNameEn'>>
// An employee or an employee-like row of another module (whose dbId may be null).
type EmployeeLike = Partial<Omit<Employee, 'dbId'>> & { dbId?: string | null }
// A person chosen as owner of a record (personFromEmployee).
type PersonRef = { name?: string, nameEn?: string }

export const employeeName=(employee: EmployeeNames|null|undefined,language='el')=>language==='en'
 ?[employee?.firstNameEn||employee?.firstName,employee?.lastNameEn||employee?.lastName].filter(Boolean).join(' ')
 :[employee?.lastName,employee?.firstName].filter(Boolean).join(' ')

export const personFromEmployee=(employee: EmployeeLike|null|undefined)=>employee?{employeeId:employee.dbId||employee.id,name:employeeName(employee),nameEn:employeeName(employee,'en'),userId:employee.userId||null}:null

// SearchableSelect options for active employees; those of the given departments
// come back as recentValues so they open at the top of the list.
export function employeeOptions(employees: EmployeeLike[]=[],language='el',departments: string[]=[]){
 const active=employees.filter(employee=>employee.employmentStatus!=='inactive'&&employeeName(employee))
 const options=active.map(employee=>({value:String(employee.dbId||employee.id),label:employeeName(employee,language),description:[language==='en'?employee.positionEn||employee.position:employee.position,employee.department].filter(Boolean).join(' · ')||undefined,keywords:`${employeeName(employee)} ${employeeName(employee,'en')} ${employee.department||''} ${employee.position||''}`})).sort((a,b)=>a.label.localeCompare(b.label,'el'))
 const wanted=new Set(departments)
 const near=active.filter(employee=>wanted.has(employee.department as string)).map(employee=>String(employee.dbId||employee.id))
 return {options,near}
}

export const personLabel=(person: PersonRef|null|undefined,language='el')=>person?(language==='en'?person.nameEn||person.name:person.name)||'':''

// «Position · Person» for the details sheet and the registry.
export function ownerText(record: object|null|undefined,language='el'){
 const owned=record as { owner?: string|null, ownerPerson?: PersonRef|null }|null|undefined
 return [owned?.owner,personLabel(owned?.ownerPerson,language)].filter(Boolean).join(' · ')
}
