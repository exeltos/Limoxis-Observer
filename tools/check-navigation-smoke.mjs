import fs from 'node:fs'
const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8')
const employeeList=read('src/features/employees/EmployeesPage.jsx')
const employeeRecord=read('src/features/employees/EmployeeRecordPage.jsx')
const patientRecord=read('src/features/surveillance/PatientClinicalRecordPage.jsx')
const surveillanceList=read('src/features/surveillance/SurveillancePage.jsx')
const controls=read('src/features/controls/ControlsPage.jsx')
const checks=[
  ['patients route',read('src/app/App.jsx').includes('patients/:patientId')],
  ['employees route',read('src/app/App.jsx').includes('employees/:employeeId')],
  ['laboratory route',read('src/app/App.jsx').includes('laboratory/:sampleId')],
  ['surveillance route',read('src/app/App.jsx').includes('surveillance/:caseId')],
  ['quality route',read('src/app/App.jsx').includes('quality/:recordType/:recordId')],
  ['controls route',read('src/app/App.jsx').includes('controls/:controlId')],
  ['patients registry hook',read('src/features/patients/PatientsPage.jsx').includes("useRegistryMemory('patients')")],
  ['patients row navigation',read('src/features/patients/PatientsPage.jsx').includes('registry.openRecord')],
  ['employees registry hook',employeeList.includes("useRegistryMemory('employees')")],
  ['employees registry variable',employeeList.includes("const registry=useRegistryMemory('employees')")],
  ['employees row navigation',employeeList.includes('registry.openRecord')],
  ['laboratory registry hook',read('src/features/laboratory/LaboratoryPage.jsx').includes("useRegistryMemory('laboratory')")],
  ['surveillance registry hook',read('src/features/surveillance/SurveillancePage.jsx').includes("useRegistryMemory('surveillance')")],
  ['patient contextual back',patientRecord.includes('const {goBack,restored}=useContextualNavigation')],
  ['employee contextual back',employeeRecord.includes('const {goBack,restored}=useContextualNavigation')],
  ['surveillance row navigation',surveillanceList.includes('registry.openRecord')],
  ['controls row navigation',controls.includes('registry.openRecord')],
  ['quality linked contextual navigation',read('src/features/quality/QualityRecordPage.jsx').includes('goTo(linkPath')],
]
const failed=checks.filter(([,ok])=>!ok)
for(const [name,ok] of checks) console.log(`${ok?'✓':'✗'} ${name}`)
if(failed.length){console.error(`Navigation smoke failed: ${failed.length}`);process.exit(1)}
console.log(`Navigation smoke passed: ${checks.length}/${checks.length}`)
