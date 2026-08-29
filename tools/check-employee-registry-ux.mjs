import fs from 'node:fs'
const css=fs.readFileSync('src/styles/global.css','utf8')
const page=fs.readFileSync('src/features/employees/EmployeesPage.jsx','utf8')
const checks=[
 [page,'const scopedEmployees=employeeRows.filter(x=>canAccessRecord(x))'],
 [page,'employee-registry-summary'],
 [page,'employee-registry-shell'],
 [page,'registry.rowProps(x.id)'],
 [page,'EmployeeCreateDialog'],
 [css,'Employee registry refinement'],
 [css,'.employee-registry-shell>.filter-system'],
 [css,'.employee-registry-shell>.scroll-table'],
 [css,'.employee-registry-summary .employee-kpi.active'],
]
let failed=0
for(const [text,needle] of checks){if(!text.includes(needle)){console.error(`Missing ${needle}`);failed++}}
if(failed)process.exit(1)
console.log(`Employee registry UX passed: ${checks.length}/${checks.length}`)
