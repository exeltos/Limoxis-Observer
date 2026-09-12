import fs from 'node:fs'
const checks=[
 ['src/features/documents/DocumentRecordPage.jsx','publishedById:actor.id'],
 ['src/features/documents/DocumentRecordPage.jsx','archivedById:actor.id'],
 ['src/features/controls/controlCloudService.js','cancelled_by:userId'],
 ['src/features/controls/controlCloudService.js','editReason:(payload.reason'],
 ['QA/GOVERNANCE_LIFECYCLE_CLASSIFICATION_v0.26.81.md','Draft → Published → Archived'],
 ['QA/GOVERNANCE_LIFECYCLE_CLASSIFICATION_v0.26.81.md','formal revision/supersede workflow'],
]
let failed=0
for(const [file,needle] of checks){const text=fs.readFileSync(file,'utf8');if(!text.includes(needle)){console.error(`Missing ${needle} in ${file}`);failed++}}
if(failed)process.exit(1)
console.log(`Governance classification passed: ${checks.length}/${checks.length}`)
