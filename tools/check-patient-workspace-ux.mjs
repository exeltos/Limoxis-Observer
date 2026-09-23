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

.clinical-risk-flags{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.clinical-risk-flags.compact{gap:5px;flex-wrap:nowrap}.clinical-risk-flag{display:inline-flex;align-items:center;gap:6px;min-height:30px;padding:4px 8px;border:1px solid var(--border-subtle);border-radius:999px;background:var(--surface);color:var(--text-muted);font:inherit;cursor:default}.clinical-risk-flags.compact .clinical-risk-flag{width:28px;height:28px;min-height:28px;padding:0;justify-content:center}.clinical-risk-flag.active{color:var(--success-text)}.clinical-risk-flag.warning{color:var(--warning-text)}.clinical-risk-flag.danger{color:var(--danger-text)}.clinical-risk-flag strong{font-size:12px}
