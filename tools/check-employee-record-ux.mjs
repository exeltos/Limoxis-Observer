import fs from 'node:fs'
const css=fs.readFileSync('src/styles/global.css','utf8')
const page=fs.readFileSync('src/features/employees/EmployeeRecordPage.jsx','utf8')
const checks=[
 [page,'employee-record-facts'],
 [page,'RecordFact label={t(\'department\')}'],
 [page,"tab==='occupational'&&<Occupational"],
 [page,"tab==='vaccinations'&&<Vaccinations"],
 [page,'canSeeSensitiveEmployeeHealth'],
 [css,'Employee record refinement'],
 [css,'.employee-record-shell .record-subcard'],
 [css,'.employee-record-shell .inline-edit-footer'],
 [css,'.employee-record-fact.active'],
]
let failed=0
for(const [text,needle] of checks){if(!text.includes(needle)){console.error(`Missing ${needle}`);failed++}}
if(failed)process.exit(1)
console.log(`Employee record UX passed: ${checks.length}/${checks.length}`)
