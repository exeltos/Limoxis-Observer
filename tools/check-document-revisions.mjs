import fs from 'node:fs'
const checks=[
 ['src/features/documents/documentStore.js','createDocumentRevision'],
 ['src/features/documents/documentStore.js','revisionOfId:source.id'],
 ['src/features/documents/documentStore.js','supersedesId:source.id'],
 ['src/features/documents/DocumentRecordPage.jsx',"record.status==='published'&&<button"],
 ['src/features/documents/DocumentRecordPage.jsx','createRevision'],
 ['src/features/documents/DocumentRecordPage.jsx',"record.status!=='draft'"],
 ['src/features/documents/DocumentRecordPage.jsx','Αντικατάσταση από νέα έκδοση'],
 ['src/features/documents/DocumentRecordPage.jsx','supersededById:record.id'],
]
let failed=0
for(const [file,needle] of checks){const text=fs.readFileSync(file,'utf8');if(!text.includes(needle)){console.error(`Missing ${needle} in ${file}`);failed++}}
if(failed)process.exit(1)
console.log(`Document revision lifecycle passed: ${checks.length}/${checks.length}`)
