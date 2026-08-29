import fs from 'node:fs'
const checks=[
 ['src/features/surveillance/clinicalDemoData.js',"createdById:data.createdById||'unknown'"],
 ['src/features/surveillance/clinicalDemoData.js',"actorId:data.createdById||'unknown'"],
 ['src/features/surveillance/clinicalDemoData.js',"voidedById:actorId"],
 ['src/features/surveillance/PatientClinicalRecordPage.jsx','createdById:actor.id'],
 ['src/features/surveillance/PatientClinicalRecordPage.jsx','correctionOpenedById:actor.id'],
 ['src/features/surveillance/PatientClinicalRecordPage.jsx','previousOutcome:ep.outcome'],
 ['src/features/surveillance/PatientClinicalRecordPage.jsx',"type:'surveillanceReopened',actor:actor.name,actorId:actor.id"],
]
let failed=0
for(const [file,needle] of checks){const text=fs.readFileSync(file,'utf8');if(!text.includes(needle)){console.error(`Missing ${needle} in ${file}`);failed++}}
if(failed)process.exit(1)
console.log(`Clinical evidence governance passed: ${checks.length}/${checks.length}`)
