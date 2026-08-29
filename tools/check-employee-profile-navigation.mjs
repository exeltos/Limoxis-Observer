import fs from 'node:fs'

const app=fs.readFileSync('src/app/App.jsx','utf8')
const nav=fs.readFileSync('src/app/navigation.js','utf8')
const list=fs.readFileSync('src/features/employees/EmployeesPage.jsx','utf8')
const record=fs.readFileSync('src/features/employees/EmployeeRecordPage.jsx','utf8')
const css=fs.readFileSync('src/styles/global.css','utf8')

const checks=[
  [app,'path="my-profile"'],
  [app,'<EmployeeRecordPage selfMode />'],
  [app,'path="employees/:employeeId"'],
  [nav,"to:'/my-profile'"],
  [list,'function openEmployee(row)'],
  [list,'onClick={()=>openEmployee(x)}'],
  [record,'const employee=selfMode?selfEmployee:employeeRows.find(x=>x.id===id)||null'],
  [record,"const committeeApprovals=useMemo(()=>employee?.id?approvalsForEmployee(employee.id):[]"],
  [record,'if(!employee){'],
  [css,'v0.27.6 — compact canonical metric-card internals'],
  [css,'height:84px!important'],
  [css,'width:17px!important'],
  [css,'font-size:19px!important'],
  [css,'font-size:10px!important'],
]
let failed=0
for(const [text,needle] of checks){
  if(!text.includes(needle)){console.error(`Missing ${needle}`);failed++}
}
if(failed)process.exit(1)
console.log(`Employee/profile navigation + metric regression passed: ${checks.length}/${checks.length}`)
