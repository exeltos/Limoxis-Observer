import fs from 'node:fs'
const css=fs.readFileSync('src/styles/global.css','utf8')
const page=fs.readFileSync('src/features/patients/PatientsPage.jsx','utf8')
const checks=[
 [page,'patient-summary-strip'],
 [page,'PatientSummaryMetric'],
 [page,'patient-registry-shell'],
 [page,'registry.rowProps(patient.id)'],
 [page,'ManualDateField label={t(\'admissionDate\')}'],
 [css,'Patient registry & intake refinement'],
 [css,'.patient-registry-shell>.filter-system'],
 [css,'.patient-entry-card footer'],
 [css,'.patient-summary-metric.active'],
]
let failed=0
for(const [text,needle] of checks){if(!text.includes(needle)){console.error(`Missing ${needle}`);failed++}}
if(failed)process.exit(1)
console.log(`Patient workspace UX passed: ${checks.length}/${checks.length}`)
