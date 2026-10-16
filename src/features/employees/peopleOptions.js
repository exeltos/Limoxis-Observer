// People picked as responsible on a record (a control, a quality record): an
// employee, linked to a user account when there is one, as {employeeId,name,
// nameEn,userId}. Controls keep the person in the definition's metadata and its
// account in control_definitions.owner_id; Quality keeps the names in
// owner_labels and the first account in owner_id.

export const employeeName=(employee,language='el')=>language==='en'
 ?[employee?.firstNameEn||employee?.firstName,employee?.lastNameEn||employee?.lastName].filter(Boolean).join(' ')
 :[employee?.lastName,employee?.firstName].filter(Boolean).join(' ')

export const personFromEmployee=employee=>employee?{employeeId:employee.dbId||employee.id,name:employeeName(employee),nameEn:employeeName(employee,'en'),userId:employee.userId||null}:null

// SearchableSelect options for active employees; those of the given departments
// come back as recentValues so they open at the top of the list.
export function employeeOptions(employees=[],language='el',departments=[]){
 const active=employees.filter(employee=>employee.employmentStatus!=='inactive'&&employeeName(employee))
 const options=active.map(employee=>({value:String(employee.dbId||employee.id),label:employeeName(employee,language),description:[language==='en'?employee.positionEn||employee.position:employee.position,employee.department].filter(Boolean).join(' · ')||undefined,keywords:`${employeeName(employee)} ${employeeName(employee,'en')} ${employee.department||''} ${employee.position||''}`})).sort((a,b)=>a.label.localeCompare(b.label,'el'))
 const wanted=new Set(departments)
 const near=active.filter(employee=>wanted.has(employee.department)).map(employee=>String(employee.dbId||employee.id))
 return {options,near}
}

export const personLabel=(person,language='el')=>person?(language==='en'?person.nameEn||person.name:person.name)||'':''

// «Position · Person» for the details sheet and the registry.
export function ownerText(record,language='el'){
 return [record?.owner,personLabel(record?.ownerPerson,language)].filter(Boolean).join(' · ')
}
