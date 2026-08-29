import fs from 'node:fs'
const lab=fs.readFileSync('src/features/laboratory/LaboratoryPage.jsx','utf8')
const employees=fs.readFileSync('src/features/employees/EmployeesPage.jsx','utf8')
const app=fs.readFileSync('src/app/App.jsx','utf8')
const ci=fs.readFileSync('.github/workflows/ci.yml','utf8')
const checks=[
  [lab,"return <MetricCard icon={Icon} value={value} label={label} tone={danger?'danger':'neutral'}/>"],
  [employees,'registry.openRecord(navigate,`/employees/${encodeURIComponent(row.id)}`'],
  [app,'path="employees/:employeeId" element={<Suspense fallback={<RouteLoading/>}><EmployeeRecordPage /></Suspense>}'],
  [app,'path="my-profile" element={<Suspense fallback={<RouteLoading/>}><EmployeeRecordPage selfMode /></Suspense>}'],
  [ci,'push:'],
  [ci,'branches: [main]'],
  [ci,'run: npm run check'],
]
let failed=0
for(const [text,needle] of checks){if(!text.includes(needle)){console.error(`Missing ${needle}`);failed++}}
if(/return <div className={`lab-kpi/.test(lab)){console.error('Legacy laboratory KPI markup still active');failed++}
if(failed)process.exit(1)
console.log(`v0.27.7 hotfix regression passed: ${checks.length}/${checks.length} + legacy lab scan`)
