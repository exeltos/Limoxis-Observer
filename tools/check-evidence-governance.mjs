import fs from 'node:fs'
const checks=[
 ['src/features/training/TrainingPage.jsx','completedById:actor.id'],
 ['src/features/training/TrainingPage.jsx','issuedById:actor.id'],
 ['src/features/training/TrainingPage.jsx','certificateId:certId'],
 ['src/features/training/TrainingPage.jsx','updatedById:actor.id'],
 ['src/features/training/TrainingPage.jsx',"actorId:actor.id,action:'Ενημέρωση παρουσίας εκπαίδευσης'"],
 ['src/features/committees/CommitteeRecordPage.jsx','createdById:actor.id'],
 ['src/features/committees/CommitteeRecordPage.jsx','finalizedById:requests.length?null:actor.id'],
]
let failed=0
for(const [file,needle] of checks){const text=fs.readFileSync(file,'utf8');if(!text.includes(needle)){console.error(`Missing ${needle} in ${file}`);failed++}}
if(failed)process.exit(1)
console.log(`Evidence governance passed: ${checks.length}/${checks.length}`)
